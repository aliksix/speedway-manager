'use strict';
// Budżety klubu (jak w FM): plan sezonu S (rok finansowy 1.11–31.10) – planowane przychody (ostrożnie) + zadeklarowana wpłata właściciela
// − koszty stałe − szkółka − tor i park maszyn − rezerwa = kwota do rozdzielenia suwakiem między płace (zawodnicy + sztab) i transfery
// (odstępne, ekwiwalenty, opłaty za wypożyczenia). Kontrakty zawodników w PGE ogranicza dodatkowo regulaminowy limit 70% przychodów.
// Koszt zawodnika w budżecie: podpis + stawka za punkt × przewidywane punkty (rola, średnia z poprzedniego sezonu przeliczona na ligę,
// model z poziomu) + oczekiwane premie. Kluby AI używają tych samych budżetów (wolne środki zamiast stałego udziału w budżecie).

const BUD_W = { PGE: 0.9, '2E': 0.9, KLZ: 0.92 }; // domyślny udział płac w kwocie do rozdzielenia (reszta: transfery)
const HEATS_ROLE = { lider: 5.2, wazny: 4.8, podst: 4.4, doparowy: 4.4, u24: 4.2, junior: 4.2, talent: 1.2, dmpj: 0.8, rezerwa: 1.5, awaryjny: 0.4, zbedny: 0.3 };
const MATCHES_LG = { PGE: 14, '2E': 14, KLZ: 12 };
const BUD_MEMO = { d: null, m: new Map() };
function budMemo(key, fn) {
  if (BUD_MEMO.d !== G.date) { BUD_MEMO.d = G.date; BUD_MEMO.m.clear(); }
  if (!BUD_MEMO.m.has(key)) BUD_MEMO.m.set(key, fn());
  return BUD_MEMO.m.get(key);
}
const budReset = () => BUD_MEMO.m.clear();

// ---------- Przewidywane punkty i koszt zawodnika ----------
function leagueOfSeason(r, S) {
  const c = (r.career || []).find(x => x.season === S);
  return c && c.league ? c.league : null;
}
// Punkty na bieg: 50% średnia z poprzedniego sezonu (przeliczona przez różnicę poziomów lig), 50% model z poziomu zawodnika
function predPtsPerHeat(r, lg, S) {
  const model = clamp(1.45 + ((r.skill || 5) - LEAGUE_AVG_SKILL[lg]) * 0.33, 0.3, 2.6);
  const last = r.stats && r.stats[S - 1];
  if (!last || (last.heats || 0) < 15) return model;
  const lastLg = leagueOfSeason(r, S - 1) || lg;
  const avg = (last.pts + last.bonus) / last.heats + 0.3 * (LEAGUES[lg].level - LEAGUES[lastLg].level);
  return clamp(0.5 * avg + 0.5 * model, 0.2, 2.9);
}
// Przewidywane punkty ligowe w sezonie (z marginesem 10% – zawodnik może pojechać lepiej)
function predPoints(r, clubId, S, role) {
  const c = G.clubs[clubId], lg = c.league;
  return budMemo(`pp|${r.id}|${clubId}|${S}|${role}|${lg}`, () => {
    const rl = role || (typeof expectedRole === 'function' ? expectedRole(r, clubId, S) : 'podst');
    const fx = seasonFixtures(lg, S).filter(f => f.stage === 'RS' && (f.homeId === clubId || f.awayId === clubId)).length;
    const m = (fx || MATCHES_LG[lg] || 14) * 1.05; // runda zasadnicza + szansa na play-off
    return Math.round(predPtsPerHeat(r, lg, S) * (HEATS_ROLE[rl] ?? 3) * m * 1.05); // +5% marginesu
  });
}
// Koszt umowy (kontrakt, wypożyczenie albo warunki oferty) w budżecie sezonu S
function plannedCost(r, k, clubId, S) {
  if (!k) return 0;
  const lg = G.clubs[clubId].league;
  if (k.kind === 'warszawski') return 0;
  if (k.kind === 'amatorski') return (k.stipend || 0) * 12 + EQUIP_VALUE[lg];
  const t = k.terms && k.terms[S] ? k.terms[S] : k;
  const pts = predPoints(r, clubId, S, k.role);
  const ev = typeof bonusesEV === 'function' ? bonusesEV(k, r, clubId) : 0;
  return Math.round((t.signing || 0) + (t.perPoint || 0) * pts + (ev || 0));
}

// ---------- Plan sezonu ----------
function finAlloc(c, S) {
  const f = c.fin;
  f.alloc = f.alloc || {};
  return f.alloc[S] || (f.alloc[S] = { w: BUD_W[c.league] || 0.9, academy: c.academyBudget || round1k(c.budget * 0.02), infra: 0 });
}
// Przychody bez właściciela: plan sezonu (finPlan), dla przyszłego sezonu – bieżący skorygowany o oczekiwaną ligę (TV, sponsor ligi, sponsorzy)
const leaguePay = lg => (FIN_LEAGUE[lg].tv || 0) - (FIN_LEAGUE[lg].reserve || 0) + (FIN_LEAGUE[lg].title || 0);
function planRevenue(c, S) {
  const cur = fyOf(G.date);
  if (S <= cur) return finPlan(c, S, true).rev || 0;
  const base = finPlan(c, cur, true).rev || 0;
  const odds = typeof leagueOdds === 'function' ? leagueOdds(c, S) : { [c.league]: 1 };
  const sp = typeof sponsorSummary === 'function' ? sponsorSummary(c, cur).guaranteed : 0;
  let adj = 0;
  for (const [lg, p] of Object.entries(odds)) adj += p * (leaguePay(lg) - leaguePay(c.league) + sp * (FIN_LEAGUE[lg].adMult / FIN_LEAGUE[c.league].adMult - 1) * 0.7);
  return Math.max(0, base + adj);
}
// Wpłata właściciela: deklaracja zarządu (stała od 1 grudnia), wcześniej szacunek – dopłata do budżetu klubu w granicach możliwości akcjonariuszy (ownerCapacity)
function ownerPlan(c, S) {
  const f = c.fin;
  if (f.ownerDecl && f.ownerDecl[S] != null) return f.ownerDecl[S];
  if (!clubActive(c, S)) return 0; // klub uśpiony – bez budżetu na zawodników
  return round1k(clamp(c.budget - planRevenue(c, S), 0, ownerCapacity(c)));
}
const FIXED_KINDS = ['administracja', 'tor', 'licencje', 'u24', 'kredyt', 'imprezy'];
function budgetPlan(c, S = sportSeason()) {
  return budMemo(`bp|${c.id}|${S}|${c.league}`, () => {
    finInit(c);
    const al = finAlloc(c, S), lg = FL(c);
    if (S === fyOf(G.date)) al.academy = c.academyBudget || 0; // szkółka bieżącego roku = budżet ustawiony w szkółce
    const rev = planRevenue(c, S), owner = ownerPlan(c, S);
    const items = finItems(c, Math.max(S, fyOf(G.date)), { forecast: true });
    const fixed = {};
    for (const x of items) if (x.amount < 0 && FIXED_KINDS.includes(x.kind)) fixed[x.kind] = (fixed[x.kind] || 0) - x.amount;
    const fx = seasonFixtures(c.league, S).filter(x => x.homeId === c.id || x.awayId === c.id);
    const homeN = fx.filter(x => x.homeId === c.id).length || 7, awayN = fx.filter(x => x.awayId === c.id).length || 7;
    fixed.mecze = homeN * lg.matchCost; fixed.wyjazd = awayN * (18000 + 360 * 20);
    const fixedSum = sum(Object.values(fixed));
    const reserve = round1k(rev * 0.05);
    const free = Math.max(0, rev + owner - fixedSum - al.academy - al.infra - reserve);
    const staff = sum(clubStaff(c.id).map(s => s.wage)) * 12;
    const wages = free * al.w, transfers = free - wages;
    const cap = typeof capInfo === 'function' && S >= CAP_FROM ? capInfo(c, S) : { applies: false };
    let riders = Math.max(0, wages - staff);
    if (cap.applies) riders = Math.min(riders, cap.limit);
    const wMax = cap.applies && free ? clamp((cap.limit + staff) / free, 0.3, 1) : 1;
    return { S, rev: round1k(rev), owner, ownerFixed: !!(c.fin.ownerDecl && c.fin.ownerDecl[S] != null), fixed, fixedSum: round1k(fixedSum), academy: al.academy, infra: al.infra, reserve,
      free: round1k(free), w: al.w, wMax, wages: round1k(wages), staff: round1k(staff), riders: round1k(riders), transfers: round1k(transfers), cap, prelim: G.date < fyDate(S, 12, 1) };
  });
}
// Zaangażowane środki: kontrakty i wypożyczenia na sezon S, uzgodnione transfery i oferty w toku (rezerwacja)
function ridersCommitted(c, S, skipRiderId = null) {
  let used = 0;
  const list = [];
  for (const r of squadFor(c, S)) {
    if (r.id === skipRiderId) continue;
    const ag = r.agreed && G.negs[r.agreed];
    const k = r.nextContract && r.nextContract.clubId === c.id && r.nextContract.from <= S ? r.nextContract : ag && ag.clubId === c.id ? { ...ag.terms, kind: ag.terms.kind || 'zawodowy' } : r.contract && r.contract.clubId === c.id ? r.contract : null;
    const v = plannedCost(r, k, c.id, S);
    used += v; list.push({ r, v });
  }
  for (const r of Object.values(G.riders)) if (r.nextLoan && r.nextLoan.toClubId === c.id && r.nextLoan.season === S && r.id !== skipRiderId) { const v = plannedCost(r, { ...r.nextLoan, kind: 'wypożyczenie' }, c.id, S); used += v; list.push({ r, v, loan: true }); }
  for (const r of Object.values(G.riders)) if (r.loan && r.loan.toClubId === c.id && r.loan.season === S && r.id !== skipRiderId) { const v = plannedCost(r, { ...r.loan, kind: 'wypożyczenie' }, c.id, S); used += v; list.push({ r, v, loan: true }); }
  let pending = 0;
  for (const n of Object.values(G.negs)) {
    if (n.clubId !== c.id || !NEG_OPEN.includes(n.status) || n.riderId === skipRiderId || (n.forSeason && n.forSeason !== S)) continue;
    if (n.stage === 'club' || n.status === 'terms') continue; // krok 1 (kwota dla klubu) – bez warunków dla zawodnika
    pending += plannedCost(G.riders[n.riderId], { ...n.terms, kind: n.kind === 'loan' ? 'wypożyczenie' : n.terms.kind || 'zawodowy' }, c.id, S);
  }
  return { used: Math.round(used), pending: Math.round(pending), total: Math.round(used + pending), list };
}
function transfersCommitted(c, S, skipNegId = null) {
  const spent = -(((c.fin.ledger || {})[S] || {}).out || {}).transfer || 0;
  let pending = 0;
  for (const n of Object.values(G.negs)) if (n.id !== skipNegId && n.clubId === c.id && (NEG_OPEN.includes(n.status) || (n.status === 'agreed' && !n.done)) && n.terms.fee && (n.forSeason || S) === S) pending += n.terms.fee;
  return { spent: Math.round(spent), pending: Math.round(pending), total: Math.round(spent + pending) };
}
const ridersRoom = (c, S, skip) => budgetPlan(c, S).riders - ridersCommitted(c, S, skip).total;
const transfersRoom = (c, S, skipNeg) => budgetPlan(c, S).transfers - transfersCommitted(c, S, skipNeg).total;
// Sprawdzenie oferty względem budżetów klubu (gracz i kluby AI): kontrakt / wypożyczenie i kwota dla klubu
function budgetCheck(clubId, r, terms, season, kind, negId = null) {
  const c = G.clubs[clubId];
  if (!c || !c.fin || !season) return { ok: true };
  const k = kind === 'loan' ? { ...terms, kind: 'wypożyczenie' } : { ...terms, kind: terms.kind || 'zawodowy' };
  const cost = terms.signing != null || terms.perPoint != null || terms.kind ? plannedCost(r, k, clubId, season) : 0;
  const roomR = ridersRoom(c, season, r.id), roomT = transfersRoom(c, season, negId);
  if (cost > roomR + 1000) return { ok: false, cost, roomR, roomT, text: `Ta umowa (${fmtMoney(cost, true)} w sezonie ${season}) przekracza budżet płac zawodników – zostało ${fmtMoney(Math.max(0, roomR), true)}. Przesuń suwak w Finanse → Budżet albo poproś zarząd o zwiększenie budżetu.` };
  const fee = terms.fee || 0;
  if (fee > roomT + 1000) return { ok: false, cost, roomR, roomT, text: `Kwota dla klubu (${fmtMoney(fee, true)}) przekracza budżet transferowy – zostało ${fmtMoney(Math.max(0, roomT), true)}. Przesuń suwak w Finanse → Budżet albo poproś zarząd o zwiększenie budżetu.` };
  return { ok: true, cost, roomR, roomT };
}

// ---------- Zarząd: deklaracja właściciela i prośby o zwiększenie budżetu ----------
// 1 grudnia: zarząd zatwierdza plan sezonu – wpłata właściciela staje się stała
function budgetApprove(S) {
  for (const c of Object.values(G.clubs)) {
    finInit(c);
    c.fin.ownerDecl = c.fin.ownerDecl || {};
    if (c.fin.ownerDecl[S] == null && clubActive(c, S)) c.fin.ownerDecl[S] = round1k(clamp(c.budget - planRevenue(c, S), 0, ownerCapacity(c)));
  }
  budReset();
  const me = myClub(), p = budgetPlan(me, S);
  addMsg({ category: 'zarząd', from: 'Zarząd klubu', title: `Budżet sezonu ${S} zatwierdzony`, body: `<p>Planowane przychody ${fmtMoney(p.rev, true)}, wpłata właściciela ${fmtMoney(p.owner, true)}, koszty stałe ${fmtMoney(p.fixedSum, true)}.</p><p>Budżet płac zawodników: <b>${fmtMoney(p.riders, true)}</b>, budżet transferowy: <b>${fmtMoney(p.transfers, true)}</b>${p.cap.applies ? ` (limit Ekstraligi: ${fmtMoney(p.cap.limit, true)})` : ''}.</p>`, link: '#/finanse/budzet' });
}
function budgetRequest(amount, S = sportSeason()) {
  const c = myClub();
  amount = round1k(Math.max(0, amount || 0));
  if (amount < 50000) return { ok: false, text: 'Minimalna kwota prośby to 50 tys. zł.' };
  const f = c.fin;
  f.budgetAsks = f.budgetAsks || {};
  if ((f.budgetAsks[S] || 0) >= 2) return { ok: false, text: 'Zarząd rozpatrzył już dwie prośby na ten sezon.' };
  f.budgetAsks[S] = (f.budgetAsks[S] || 0) + 1;
  const cur = ownerPlan(c, S), capOwner = ownerCapacity(c) * 1.5; // prośba: najwyżej o połowę więcej niż zwykła dopłata
  const give = Math.min(amount, Math.max(0, capOwner - cur));
  const p = clamp(G.board.confidence / 100 * (1 - cur / Math.max(1, capOwner)) * 1.3, 0.05, 0.9);
  if (give < 50000 || !chance(p)) { G.board.confidence = clamp(G.board.confidence - 2, 0, 100); return { ok: false, text: 'Zarząd odmawia zwiększenia budżetu – właściciel nie dołoży więcej w tym sezonie.' }; }
  f.ownerDecl = f.ownerDecl || {}; f.ownerDecl[S] = round1k(cur + give);
  G.board.confidence = clamp(G.board.confidence - Math.round(3 + give / Math.max(1, c.budget) * 40), 0, 100);
  budReset();
  return { ok: true, text: `Zarząd zwiększa budżet sezonu ${S} o ${fmtMoney(give, true)} (wyższa wpłata właściciela). Zaufanie zarządu spada.` };
}
// Kluby AI ponad budżetem (np. po ratowaniu przy licencji): renegocjacja kontraktów w dół (nowy sezon)
function budgetRenegotiate(S) {
  for (const c of Object.values(G.clubs)) {
    if (c.id === G.clubId || !clubActive(c, S) || !c.fin) continue;
    const b = budgetPlan(c, S).riders, used = ridersCommitted(c, S).used;
    if (!b || used <= b * 1.05) continue;
    const f = clamp(b / used, 0.7, 1);
    for (const r of squadFor(c, S)) {
      const k = r.contract && r.contract.clubId === c.id ? r.contract : null;
      if (!k || k.kind !== 'zawodowy' || !k.terms || !k.terms[S]) continue;
      k.terms[S].signing = round5k(k.terms[S].signing * f); k.terms[S].perPoint = round100(k.terms[S].perPoint * f);
      if (k.from === S || !k.terms[k.from]) { k.signing = k.terms[S].signing; k.perPoint = k.terms[S].perPoint; }
    }
    c.fin.reneg = { S, f: round2(f) };
  }
  budReset();
}
// Inwestycje w tor i park maszyn: po sezonie podnoszą poziom obiektów (park maszyn – warsztat, tor – trening)
const INFRA_STEP = { PGE: 600000, '2E': 250000, KLZ: 120000 };
function infraSeasonEnd(S) {
  for (const c of Object.values(G.clubs)) {
    const al = c.fin && c.fin.alloc && c.fin.alloc[S];
    if (!al || !al.infra) continue;
    const steps = Math.floor(al.infra / (INFRA_STEP[c.league] || 300000));
    const fac = c.facilities || (c.facilities = {});
    for (let i = 0; i < steps; i++) { const k = (fac.workshop || 1) <= (fac.training || 1) ? 'workshop' : 'training'; fac[k] = Math.min(5, (fac[k] || 1) + 1); }
    if (steps && c.id === G.clubId) addMsg({ category: 'finanse', from: 'Dyrektor klubu', title: 'Inwestycje w obiekty zakończone', body: `<p>Park maszyn: poziom ${fac.workshop || 1}/5, tor treningowy: ${fac.training || 1}/5.</p>`, link: '#/finanse/budzet' });
  }
}

// ---------- Księga roczna (wszystkie kluby) i podsumowanie lat ----------
function ledgerAdd(c, kind, amount, date = G.date) {
  if (!c || !c.fin || !amount || typeof fyOf !== 'function') return;
  const S = fyOf(date), L = (c.fin.ledger = c.fin.ledger || {}), y = L[S] || (L[S] = { in: {}, out: {} });
  const side = amount >= 0 ? y.in : y.out;
  side[kind] = (side[kind] || 0) + Math.round(amount);
}
function ledgerMigrate() {
  if (G.ledger1) return false;
  const c = myClub();
  if (c && c.fin) { c.fin.ledger = {}; for (const t of Object.values(G.transactions)) if (t.clubId === c.id) ledgerAdd(c, t.kind, t.amount, t.date); }
  G.ledger1 = true;
  return true;
}
// 31 października: zamknięcie roku – saldo i plan
function ledgerYearEnd(S) {
  for (const c of Object.values(G.clubs)) {
    if (!c.fin) continue;
    const p = budgetPlan(c, S);
    (c.fin.yearEnd = c.fin.yearEnd || {})[S] = { cash: Math.round(c.cash), rev: p.rev, owner: p.owner, riders: p.riders, transfers: p.transfers, league: c.league };
  }
}
const LEDGER_GROUPS = {
  in: [['Sponsorzy', ['sponsor']], ['Liga (TV, sponsor ligi, PRO Junior)', ['liga', 'tv']], ['Miasto i samorząd', ['miasto']], ['Dzień meczowy (bilety, karnety, loże, gastronomia, gadżety)', ['bilety', 'karnety', 'loze', 'gastronomia', 'gadzety']],
    ['Imprezy i wynajem stadionu', ['imprezy']], ['Nagrody i fundusze ligi', ['nagrody']], ['Sprzedaż i wypożyczenia zawodników', ['transfer']], ['Właściciel / akcjonariusze', ['właściciel']], ['Dokapitalizowanie przez miasto', ['dokapitalizowanie']], ['Kredyty, pożyczki, pomoc', ['finansowanie']]],
  out: [['Zawodnicy (podpisy, punkty, premie, stypendia)', ['kontrakty', 'punkty']], ['Sztab', ['płace', 'obozy']], ['Szkółka', ['szkółka']], ['Sprzęt', ['sprzęt']], ['Tor, park maszyn, inwestycje', ['tor', 'inwestycje']],
    ['Mecze i wyjazdy', ['mecze', 'wyjazd']], ['Organizacja imprez', ['imprezy']], ['Administracja i pozostałe', ['administracja', 'operacyjne']], ['Licencje, U24', ['licencje', 'u24']], ['Transfery (odstępne, ekwiwalenty, wypożyczenia)', ['transfer']],
    ['Kredyty i odsetki', ['kredyt']], ['Zwroty dotacji, kary', ['zwrot', 'kary']]],
};
function ledgerGroups(y) {
  const used = { in: new Set(), out: new Set() }, out = { in: [], out: [] };
  for (const side of ['in', 'out']) {
    for (const [name, kinds] of LEDGER_GROUPS[side]) { const v = sum(kinds.map(k => (y[side] || {})[k] || 0)); kinds.forEach(k => used[side].add(k)); out[side].push([name, v]); }
    const rest = sum(Object.entries(y[side] || {}).filter(([k]) => !used[side].has(k)).map(([, v]) => v));
    if (rest) out[side].push(['Inne', rest]);
  }
  return out;
}
// Planowane przychody klubu w sezonie S (zamiast wpisanego na starcie „budżetu”): przychody z planu sezonu + wpłata właściciela
function seasonRevenue(c, S = sportSeason()) {
  if (!c || !c.fin) return { rev: 0, owner: 0, total: c ? c.budget || 0 : 0 };
  const p = budgetPlan(c, S);
  return { rev: p.rev, owner: p.owner, total: p.rev + p.owner };
}
// Ekran startowy (przed rozpoczęciem gry): szacunek przychodów z danych – sponsorzy, miasto, wypłaty ligi, bilety
function startRevenueEst(src, lg) {
  const cf = (typeof CLUB_FIN !== 'undefined' && CLUB_FIN[src.id]) || {}, L = FIN_LEAGUE[lg] || FIN_LEAGUE.KLZ;
  const gate = (src.attendance || 2000) * ((LEAGUES[lg] || LEAGUES.KLZ).ticket + L.gastro + L.merch) * 7;
  return round1k((cf.spTotal || 0) * 1e6 + ((cf.city || [0])[0] || 0) + leaguePay(lg) + gate + (L.boxes || 0) * (L.boxPrice || 0));
}
const revenueLabel = (c, S = sportSeason()) => { const x = seasonRevenue(c, S); return `${fmtMoney(x.total, true)}${x.owner ? ` <span class="small muted">(w tym właściciel ${fmtMoney(x.owner, true)})</span>` : ''}`; };
