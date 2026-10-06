'use strict';
// Zarządy klubów: skład na dany dzień (zmiany z datami since / until z js/board-data.js), wynagrodzenia (znane albo szacunek wg ligi
// i funkcji), powiązania ze sponsorami i miastem, reguła wyłączności sponsorów, zadłużenie na start gry.
// Zarząd a menedżer gracza (jak w FM): zaufanie zmieniające się po meczach i rozliczeniu roku, cele sportowy i finansowy,
// prośby do zarządu, zwolnienie menedżera i oferty pracy z innych klubów.
// Umiejętności menedżera (G.manager.attrs, js/manager.js) i podział zadań w klubie (G.duties): sponsorzy, miasto, kontrakty, media.

const BOARD_ROLES = {
  prezes: ['Prezes zarządu', 0], wiceprezes: ['Wiceprezes zarządu', 1], czlonek: ['Członek zarządu', 2], prokurent: ['Prokurent', 3], dyrektor: ['Dyrektor', 4],
  wlasciciel: ['Właściciel', 5], udzialowiec: ['Akcjonariusz', 5], 'rn-przew': ['Przewodniczący rady nadzorczej', 6], rn: ['Członek rady nadzorczej', 7],
};
const BOARD_OWNER = { prywatny: 'prywatny', miasto: 'miasto', stowarzyszenie: 'stowarzyszenie', mieszany: 'akcjonariat mieszany', rozproszony: 'akcjonariat rozproszony' };
// Szacunek miesięcznego wynagrodzenia brutto w PGE Ekstralidze; niższe ligi – ułamek (2. Ekstraliga 50%, KLŻ 25%)
const BOARD_WAGE = { prezes: 28000, wiceprezes: 18000, czlonek: 14000, prokurent: 12000, dyrektor: 15000, 'rn-przew': 3000, rn: 2000, wlasciciel: 0, udzialowiec: 0 };
const BOARD_LG = { PGE: 1, '2E': 0.5, KLZ: 0.25 };

const boardOf = clubId => (typeof CLUB_BOARD !== 'undefined' && CLUB_BOARD[clubId]) || null;
// Osoby we władzach klubu w dniu d
function boardPeople(clubId, d = G.date) {
  const b = boardOf(clubId);
  if (!b) return [];
  return b.people.filter(p => (!p.since || p.since <= d) && (!p.until || p.until > d)).sort(by(p => BOARD_ROLES[p.role][1]));
}
const boardPresident = (clubId, d = G.date) => { const ppl = boardPeople(clubId, d); return ppl.find(p => p.role === 'prezes') || ppl.find(p => BOARD_ROLES[p.role][1] <= 2) || null; };
// Wynagrodzenie miesięczne: znane (p.wage) albo szacunek wg ligi i funkcji
function boardWage(p, c) {
  if (p.wage != null) return { v: p.wage, est: false };
  return { v: Math.round((BOARD_WAGE[p.role] || 0) * (BOARD_LG[c.league] ?? 0.25) / 500) * 500, est: true };
}
const boardCost = (c, d = G.date) => sum(boardPeople(c.id, d).map(p => boardWage(p, c).v));

// ---------- Zadłużenie na start gry (CLUB_BOARD.debt) ----------
function boardStartDebts() {
  for (const [id, b] of Object.entries(CLUB_BOARD)) {
    const c = G.clubs[id];
    if (!c || !b.debt) continue;
    finInit(c);
    if (b.debt.overdue) c.cash = -b.debt.overdue; // bez wolnej gotówki, zaległe zobowiązania (ujemne saldo: odsetki, ryzyko licencyjne)
    if (b.debt.loan) { const [amt, rate, months, name] = b.debt.loan; addLoan(c, `${name || 'Kredyt bankowy'} (zaciągnięty przed startem gry)`, amt, rate, months, nextMonth1(G.date)); }
    c.fin.startDebt = b.debt.note;
  }
}

// ---------- Wyłączność sponsorów ----------
// gwiazdka na liście klubu (CLUB_FIN.sp) = firma, która realnie przeszła do tego klubu na sezon 2026 – rozmowy z nim są dozwolone
const firmExempt = (f, c) => f.scale === 'k' || (SPONSOR_MULTI_OK[f.name] || []).includes(c.id) || !!(CLUB_FIN[c.id] && CLUB_FIN[c.id].sp.some(l => l.split('|').includes(f.name + '*')));
// Firma → klub, z którym jest związana (sponsor tytularny / strategiczny w sezonie S albo człowiek firmy we władzach klubu)
function firmLocks(S = sportSeason()) {
  return spMemo('locks|' + S + '|' + Object.keys(G.sponsors).length, () => {
    const m = {};
    for (const [id, b] of Object.entries(CLUB_BOARD)) {
      for (const p of boardPeople(Number(id))) if (p.link && p.link.firm) m[firmKey(p.link.firm)] = { clubId: Number(id), why: 'board', who: p.name };
      for (const fn of b.firms || []) m[firmKey(fn)] = { clubId: Number(id), why: 'owner', who: fn };
    }
    for (const s of Object.values(G.sponsors)) if ((s.kind === 'tytularny' || s.kind === 'strategiczny') && s.since <= S && s.until >= S && !m[s.firm]) m[s.firm] = { clubId: s.clubId, why: s.kind };
    return m;
  });
}
function firmLockedFor(f, c, S = sportSeason()) {
  const l = firmLocks(S)[f.key];
  if (!l || l.clubId === c.id || firmExempt(f, c)) return null;
  const other = G.clubs[l.clubId];
  return l.why === 'owner' ? `${f.name} jest akcjonariuszem klubu ${other ? other.name : ''}` : l.why === 'board' ? `${l.who} (${f.name}) zasiada we władzach klubu ${other ? other.name : ''}` : `sponsor ${l.why} klubu ${other ? other.name : ''}`;
}

// ---------- Umiejętności menedżera i podział zadań ----------
const MGR_A = k => (G.manager && G.manager.attrs && G.manager.attrs[k]) || 10;
// Zadania organizacyjne: kto może je prowadzić – menedżer (atrybuty postaci), prezes, menedżer klubu / kierownik ze sztabu
const BIZ_DUTIES = {
  sponsors: ['Pozyskiwanie sponsorów i negocjacje sponsorskie', () => MGR_A('negotiation') * 0.6 + MGR_A('media') * 0.4],
  city: ['Relacje z miastem i wnioski o dotacje', () => MGR_A('business') * 0.6 + MGR_A('charisma') * 0.2 + MGR_A('media') * 0.2],
  contracts: ['Negocjacje kontraktów zawodników', () => MGR_A('negotiation') * 0.8 + MGR_A('manMgmt') * 0.2],
  media: ['Media, kibice i wizerunek klubu', () => MGR_A('media') * 0.7 + MGR_A('charisma') * 0.3],
};
// Zadania sportowe: atrybut sztabu (gracz może wskazać osobę zamiast najlepszej w danym atrybucie – staffBest, js/world.js)
const SPORT_DUTIES = [['Trening zawodników (rozwój umiejętności)', 'coaching'], ['Taktyka meczowa i nominacje', 'tactics'], ['Szkolenie juniorów i szkółki 250–500', 'youth'],
  ['Miniżużel (50–125 cm³)', 'mini'], ['Przygotowanie motoryczne', 'fitness'], ['Psychologia sportu', 'psychology'], ['Motywacja', 'motivation'], ['Serwis sprzętu i park maszyn', 'tech'],
  ['Przygotowanie toru (atut własnego toru)', 'track'], ['Leczenie urazów', 'medical'], ['Regeneracja i kondycja', 'physio'], ['Ocena talentów (skauting)', 'judging']];
const BIZ_STAFF_ROLES = ['director', 'manager', 'teamManager'];
// Ocena prezesa w zadaniach organizacyjnych (ukryta, stała dla osoby i gry): 8–15, przy rozmowach z miastem +2, gdy ma powiązanie z miastem
function presRating(c, key) {
  const p = boardPresident(c.id);
  if (!p) return 0;
  return 8 + hashStr(`${G.seed}|pres|${p.name}`) % 8 + (key === 'city' && p.link && p.link.city ? 2 : 0);
}
function bizCandidates(key) {
  const c = myClub(), out = [{ id: 'mgr', name: `${G.manager.name} (menedżer)`, v: Math.round(BIZ_DUTIES[key][1]()) }];
  const p = boardPresident(c.id);
  if (p) out.push({ id: 'prezes', name: `${p.name} (${BOARD_ROLES[p.role][0].toLowerCase()})`, v: presRating(c, key) });
  for (const s of clubStaff(c.id).filter(s => BIZ_STAFF_ROLES.includes(s.role) && !s.player)) out.push({ id: s.id, name: `${s.name} (${STAFF_ROLES[s.role].name.toLowerCase()})`, v: Math.round(((s.attrs.manMgmt || 8) + (s.attrs.discipline || 8)) / 2) });
  return out;
}
function dutyWho(key) {
  const list = bizCandidates(key), pick = G.duties && G.duties[key];
  return list.find(x => x.id === pick) || list.slice().sort(by(x => x.v, -1))[0];
}
// Mnożnik skuteczności zadania (tylko klub gracza): ocena 10 = 1,0; 20 = 1,2; 1 = 0,82
const dutyF = (key, clubId) => clubId !== G.clubId || !G.manager ? 1 : clamp(1 + (dutyWho(key).v - 10) / 50, 0.8, 1.2);
// Rozmowy z zarządem prowadzi zawsze menedżer: finanse i biznes oraz charyzma
const mgrBoardF = () => clamp(1 + ((MGR_A('business') + MGR_A('charisma')) / 2 - 10) / 40, 0.75, 1.25);
function setDuty(key, val) {
  G.duties = G.duties || {};
  if (!val) delete G.duties[key]; else G.duties[key] = val;
  if (typeof STAFF_BEST !== 'undefined') STAFF_BEST.date = null;
}

// ---------- Zaufanie zarządu ----------
// Zmiana zaufania z wpisem do historii; spadki łagodzi charyzma i zarządzanie ludźmi menedżera
function boardConf(d, text) {
  if (d < 0) d *= clamp(1 - ((MGR_A('charisma') + MGR_A('manMgmt')) / 2 - 10) / 40, 0.75, 1.25);
  d = Math.round(d * 10) / 10;
  G.board.confidence = clamp(G.board.confidence + d, 0, 100);
  G.board.log = [{ date: G.date, d, text }, ...(G.board.log || [])].slice(0, 12);
}
const OBJ_LOSS = { title: 4, playoff: 3, mid: 2, stay: 1.5 }, OBJ_WIN = { title: 1.5, playoff: 2, mid: 2.5, stay: 3 };
// Po meczu ligowym klubu gracza (js/engine.js: finishMatch)
function boardAfterMatch(m) {
  const fx = G.fixtures[m.fixtureId], c = myClub();
  if (!fx || !fx.league || jobless() || (m.homeId !== G.clubId && m.awayId !== G.clubId)) return;
  const me = m.homeId === G.clubId ? 'H' : 'A', op = me === 'H' ? 'A' : 'H', home = me === 'H';
  const code = (c.objective && c.objective.code) || 'mid', opp = G.clubs[home ? m.awayId : m.homeId];
  const res = m.score[me] > m.score[op] ? 'w' : m.score[me] < m.score[op] ? 'l' : 'd';
  const st = G.board.streak || 0;
  G.board.streak = res === 'l' ? Math.min(st, 0) - 1 : res === 'w' ? Math.max(st, 0) + 1 : 0;
  let d = res === 'w' ? OBJ_WIN[code] : res === 'd' ? (code === 'title' ? -1 : 0.5) : -OBJ_LOSS[code] * (home ? 1.2 : 1);
  const losses = -Math.min(G.board.streak, 0);
  if (losses >= 3) d -= (losses - 2) * (code === 'title' || code === 'playoff' ? 2 : 1);
  const row = leagueTable(c.league).find(r => r.clubId === c.id);
  if (row && row.m >= 4 && c.objective && row.pos > c.objective.minPos + 2) d -= 1;
  boardConf(d, `${res === 'w' ? 'Zwycięstwo' : res === 'l' ? 'Porażka' : 'Remis'} ${m.score[me]}:${m.score[op]} z ${opp.short}${losses >= 3 ? ` (${losses}. porażka z rzędu)` : ''}`);
  boardSackCheck();
}
// Ostrzeżenie i zwolnienie
function boardSackCheck() {
  if (jobless() || !G.manager) return;
  const c = myClub(), conf = G.board.confidence, losses = -Math.min(G.board.streak || 0, 0);
  let reason = null;
  if (conf <= 12) reason = `Zaufanie zarządu spadło do ${Math.round(conf)}%.`;
  else if (conf < 30 && losses >= 5) reason = `${losses} porażek z rzędu – cel „${c.objective.text}” jest zagrożony.`;
  if (reason) return sackManager(reason);
  if (conf < 35 && G.board.warned !== G.season) {
    G.board.warned = G.season;
    const p = boardPresident(c.id);
    addMsg({ category: 'zarząd', from: p ? p.name : `Zarząd ${c.name}`, stop: true, title: 'Zarząd traci cierpliwość',
      body: `<p>Wyniki są dalekie od oczekiwań (cel: <b>${esc(c.objective.text)}</b>). Zaufanie zarządu: <b>${Math.round(conf)}%</b>.</p><p>Bez szybkiej poprawy zarząd rozważy zmianę menedżera.</p>`, link: '#/klub' });
  }
}
// Koniec sezonu ligowego (js/game.js): drugi z rzędu niezrealizowany cel przy niskim zaufaniu = zwolnienie
function boardSeasonEnd(ok) {
  G.board.fails = ok ? 0 : (G.board.fails || 0) + 1;
  G.board.streak = 0;
  if (G.board.fails >= 2 && G.board.confidence < 45) return sackManager(`Drugi sezon z rzędu bez realizacji celu sportowego (${myClub().objective.text}).`);
  boardSackCheck();
}

// ---------- Cel finansowy (rok finansowy 1.11–31.10) ----------
// Rok finansowy celu: od 15 października – już następny (start gry 15.10.2025 → cel na rok 2026)
const finObjYear = (d = G.date) => fyOf(d) + (d.slice(5) >= '10-15' && d.slice(5) <= '10-31' ? 1 : 0);
function ledgerNet(c, S) { const y = ((c.fin && c.fin.ledger) || {})[S] || { in: {}, out: {} }; return sum(Object.values(y.in)) + sum(Object.values(y.out)); }
function finObjective(c, S = finObjYear()) {
  finInit(c);
  const o = (c.fin.finObj = c.fin.finObj || {});
  if (o[S]) return o[S];
  const debt = finDebt(c), b = boardOf(c.id);
  if (debt > c.budget * 0.05) o[S] = { code: 'debt', text: `Redukcja zadłużenia o 30% – do ${fmtMoney(round1k(debt * 0.7), true)}`, start: Math.round(debt), target: Math.round(debt * 0.7) };
  else if (b && b.fin && b.fin[2] < 0) o[S] = { code: 'balance', text: 'Zbilansowany budżet – rok finansowy bez straty' };
  else o[S] = { code: 'safe', text: 'Bez zaległości wobec zawodników, strata najwyżej 5% przychodów' };
  return o[S];
}
function finObjStatus(c, S = finObjYear()) {
  const o = finObjective(c, S), net = ledgerNet(c, S), y = ((c.fin.ledger || {})[S] || { in: {} });
  const rev = sum(Object.values(y.in)), overdue = typeof licOverdueDays === 'function' ? licOverdueDays(c.id) : 0;
  if (o.code === 'debt') { const d = finDebt(c); return { ok: d <= o.target, text: `zadłużenie teraz ${fmtMoney(d, true)} (na początku roku ${fmtMoney(o.start, true)})` }; }
  if (o.code === 'balance') return { ok: net >= 0, text: `wynik od 1 listopada: ${fmtMoney(net, true)}` };
  return { ok: overdue <= 21 && net >= -0.05 * rev, text: `wynik od 1 listopada: ${fmtMoney(net, true)}${overdue > 21 ? ` · zaległości wobec zawodników ${overdue} dni` : ''}` };
}
function boardFinYearEnd(S) {
  const c = myClub();
  if (!c.fin || !c.fin.finObj || !c.fin.finObj[S]) return; // cel na ten rok nie został postawiony (start gry pod koniec roku)
  const o = finObjective(c, S), st = finObjStatus(c, S);
  o.done = st.ok ? 'ok' : 'fail';
  boardConf(st.ok ? 8 : -12, `Rok finansowy ${S}: cel finansowy ${st.ok ? 'zrealizowany' : 'niezrealizowany'}`);
  addMsg({ category: 'zarząd', from: `Zarząd ${c.name}`, title: `Rozliczenie roku finansowego ${S}: cel ${st.ok ? 'zrealizowany' : 'niezrealizowany'}`,
    body: `<p>Cel finansowy: <b>${esc(o.text)}</b> – <b class="${st.ok ? 'pos' : 'neg'}">${st.ok ? 'zrealizowany' : 'niezrealizowany'}</b> (${st.text}).</p><p>Zaufanie zarządu: ${Math.round(G.board.confidence)}%.</p>`, link: '#/klub' });
  boardSackCheck();
}

// ---------- Prośby do zarządu (jak w FM) ----------
const BOARD_REQS = {
  budget: ['Zwiększenie budżetu płac i transferów', 'Właściciel dopłaca do budżetu sezonu (ok. 8% budżetu klubu).'],
  workshop: ['Rozbudowa parku maszyn', 'Właściciel finansuje rozbudowę warsztatu (+1 poziom).'],
  training: ['Modernizacja toru treningowego', 'Właściciel finansuje obiekty treningowe (+1 poziom).'],
  academy: ['Większy budżet szkółki', 'Budżet szkółki +50%, różnicę pokrywa właściciel.'],
  contract: ['Przedłużenie kontraktu menedżera', 'Kontrakt dłuższy o sezon (wymaga zaufania co najmniej 60%).'],
};
// Złożenie prośby: zarząd odpowiada po kilku dniach wiadomością (boardDay → boardRequestDecide)
function boardRequest(kind) {
  const S = finObjYear();
  G.board.asks = G.board.asks || {}; G.board.pending = G.board.pending || [];
  if (!BOARD_REQS[kind] || (G.board.asks[S] || {})[kind] || G.board.pending.some(x => x.kind === kind)) return { ok: false, text: 'Ta prośba jest już u zarządu albo została rozpatrzona w tym roku.' };
  G.board.pending.push({ kind, S, date: G.date, due: addDays(G.date, rint(3, 8)) });
  return { ok: true, text: 'Prośba przekazana zarządowi.' };
}
const boardReqOpen = (S = finObjYear()) => Object.keys(BOARD_REQS).filter(k => !((G.board.asks || {})[S] || {})[k] && !(G.board.pending || []).some(x => x.kind === k));
function boardRequestsDay() {
  const due = (G.board.pending || []).filter(x => G.date >= x.due);
  if (!due.length) return;
  G.board.pending = G.board.pending.filter(x => G.date < x.due);
  const c = myClub(), p = boardPresident(c.id);
  for (const x of due) {
    const r = boardRequestDecide(x.kind, x.S);
    addMsg({ category: 'zarząd', from: p ? p.name : `Zarząd ${c.name}`, stop: true, title: `${BOARD_REQS[x.kind][0]}: ${r.ok ? 'zgoda zarządu' : 'odmowa'}`, body: `<p>${esc(r.text)}</p>`, link: '#/klub' });
  }
}
function boardRequestDecide(kind, S) {
  const c = myClub(), f = finInit(c);
  G.board.asks = G.board.asks || {};
  const asks = G.board.asks[S] = G.board.asks[S] || {};
  if (kind === 'budget') { const r = budgetRequest(round1k(c.budget * 0.08), sportSeason()); asks[kind] = r.ok ? 'ok' : 'no'; if (r.ok) G.board.log = [{ date: G.date, d: 0, text: 'Zarząd zwiększył budżet' }, ...(G.board.log || [])].slice(0, 12); return r; }
  const s = G.staff[G.manager.coachId];
  if (kind === 'contract' && G.board.confidence < 60) { asks[kind] = 'no'; return { ok: false, text: 'Zarząd nie rozmawia o przedłużeniu kontraktu przy zaufaniu poniżej 60%.' }; }
  const fac = c.facilities || (c.facilities = {});
  if ((kind === 'workshop' || kind === 'training') && (fac[kind] || 1) >= 5) { asks[kind] = 'no'; return { ok: false, text: 'Obiekt ma już najwyższy poziom.' }; }
  const money = c.cash > 0 || kind === 'contract' ? 1 : 0.6, owner = clamp((f.ownerCap || 0.1) * 5, 0.4, 1.3);
  const base = { workshop: 0.7, training: 0.7, academy: 0.8, contract: 1 }[kind];
  const p = clamp(G.board.confidence / 100 * mgrBoardF() * money * (kind === 'contract' ? 1 : owner) * base, 0.05, 0.92);
  const ok = chance(p);
  asks[kind] = ok ? 'ok' : 'no';
  let text;
  if (!ok) { boardConf(-1, `Odmowa: ${BOARD_REQS[kind][0].toLowerCase()}`); return { ok: false, text: `Zarząd odmawia (${BOARD_REQS[kind][0].toLowerCase()}). ${c.cash < 0 ? 'Najpierw trzeba uporządkować finanse.' : 'Teraz nie ma na to środków ani woli.'}` }; }
  if (kind === 'workshop' || kind === 'training') { fac[kind] = (fac[kind] || 1) + 1; if (typeof TQ !== 'undefined') TQ.date = null; text = `Właściciel sfinansuje inwestycję – ${kind === 'workshop' ? 'park maszyn' : 'tor treningowy'}: poziom ${fac[kind]}/5.`; boardConf(-2, 'Zgoda na inwestycję'); }
  if (kind === 'academy') { const add = round1k(Math.max(20000, (c.academyBudget || 0) * 0.5)); c.academyBudget = (c.academyBudget || 0) + add; f.extra.push({ date: payDayFrom(addDays(G.date, 7)), kind: 'właściciel', amount: add, desc: 'Dopłata właściciela do szkółki' }); text = `Budżet szkółki zwiększony o ${fmtMoney(add, true)} – różnicę pokrywa właściciel.`; boardConf(-1, 'Zgoda na większy budżet szkółki'); }
  if (kind === 'contract' && s) { s.until += 1; text = `Zarząd przedłuża Twój kontrakt do końca sezonu ${s.until}.`; boardConf(2, 'Przedłużenie kontraktu menedżera'); }
  if (typeof budReset === 'function') budReset();
  return { ok: true, text };
}

// ---------- Rynek pracy menedżerów: zwolnienia, wakaty, aplikacje ----------
// Klub bez menedżera (głównego trenera) ma wakat (c.vacancy) – po kilku tygodniach zatrudnia trenera bez kontraktu. Kluby AI zwalniają
// menedżerów po serii porażek albo słabym sezonie. Zwolniony gracz nie dostaje ofert z automatu: aplikuje na wolne stanowiska, czas płynie dalej.
const jobless = () => !!(G.sacked && !G.sacked.done);
const hasCoach = c => clubStaff(c.id).some(s => s.role === 'coach');
function openVacancy(c, coach, reason) {
  if (coach) Object.assign(coach, { clubId: null, until: null, prevClubId: c.id, left: G.date });
  c.vacancy = { since: G.date, fillOn: addDays(G.date, rint(10, 30)), reason };
  if (c.id !== G.clubId) addMsg({ category: 'liga', from: 'Serwis żużlowy', title: `${c.name} zwalnia menedżera${coach ? `: ${coach.name}` : ''}`, body: `<p>${esc(reason)}</p><p>Klub szuka nowego menedżera drużyny.</p>`, link: jobless() ? '#/zwolniony' : `#/zespol/${c.id}`, job: jobless(), stop: jobless() });
}
// Klub AI po meczu ligowym (js/engine.js): seria porażek przy ambitnym celu
function aiCoachAfterMatch(m) {
  for (const [id, me] of [[m.homeId, 'H'], [m.awayId, 'A']]) {
    const c = G.clubs[id];
    if (!c || id === G.clubId || c.vacancy) continue;
    const lost = m.score[me] < m.score[me === 'H' ? 'A' : 'H'];
    c.aiStreak = lost ? (c.aiStreak || 0) + 1 : 0;
    const code = c.objective && c.objective.code, coach = clubStaff(c.id).find(s => s.role === 'coach');
    if (!coach) continue;
    if ((c.aiStreak >= 5 && (code === 'title' || code === 'playoff') && chance(0.35)) || (c.aiStreak >= 7 && chance(0.25)))
      openVacancy(c, coach, `${c.aiStreak} porażek z rzędu – zarząd traci cierpliwość (cel: ${c.objective.text}).`);
  }
}
// Koniec sezonu: kluby AI wyraźnie poniżej celu zmieniają menedżera
function aiCoachSeasonEnd(results) {
  for (const order of Object.values(results)) order.forEach((id, i) => {
    const c = G.clubs[id];
    if (!c || id === G.clubId || c.vacancy || !c.objective) return;
    const coach = clubStaff(c.id).find(s => s.role === 'coach');
    if (coach && i + 1 > c.objective.minPos + 2 && chance(0.4)) openVacancy(c, coach, `${i + 1}. miejsce przy celu „${c.objective.text}”.`);
  });
}
function vacanciesDay() {
  for (const c of Object.values(G.clubs)) {
    if (!c.vacancy) continue;
    if (G.date < c.vacancy.fillOn) continue;
    const app = jobless() && G.sacked.apps[c.id];
    if (jobless() && ((app && !app.done) || G.sacked.offers.some(o => o.clubId === c.id && o.until >= G.date))) continue; // klub czeka na decyzję gracza
    const free = Object.values(G.staff).filter(x => x.role === 'coach' && !x.clubId && !x.player && !x.retired).sort(by(x => x.rep || 0, -1))[0];
    if (!free) { c.vacancy.fillOn = addDays(G.date, 7); continue; }
    Object.assign(free, { clubId: c.id, until: G.season + 1, joined: G.date });
    free.wage = staffWageFor(free, c);
    c.vacancy = null;
    if (jobless()) G.sacked.offers = G.sacked.offers.filter(o => o.clubId !== c.id);
    addMsg({ category: 'liga', from: 'Serwis żużlowy', title: `${c.name}: nowym menedżerem ${free.name}`, body: `<p>${esc(c.name)} zatrudnia nowego menedżera drużyny: <b>${esc(free.name)}</b>.</p>`, link: `#/zespol/${c.id}` });
  }
  if (!jobless()) return;
  // odpowiedzi na aplikacje gracza
  for (const [id, a] of Object.entries(G.sacked.apps)) {
    if (a.done || G.date < a.due) continue;
    a.done = true;
    const c = G.clubs[id];
    if (!c.vacancy) { a.result = 'obsadzone'; continue; }
    const lvl = LEAGUE_ORDER.indexOf(c.league);
    const p = clamp(0.3 + 0.15 * lvl + 0.04 * ((G.manager.rep || 1) - 1) - 0.05 * (G.manager.career || []).filter(x => x.left === 'zwolniony').length + (MGR_A('media') - 10) / 60, 0.08, 0.85);
    if (chance(p)) {
      a.result = 'oferta';
      G.sacked.offers.push({ clubId: c.id, until: addDays(G.date, 7) });
      c.vacancy.fillOn = addDays(G.date, 8);
      addMsg({ category: 'zarząd', from: `Zarząd ${c.name}`, stop: true, job: true, title: `Oferta pracy: ${c.name}`, body: `<p>Po rozmowie zarząd ${esc(c.name)} chce Cię zatrudnić jako menedżera drużyny. Cel: <b>${esc(c.objective.text)}</b>.</p><p>Oferta ważna do ${fmtDate(addDays(G.date, 7))}.</p>`, link: '#/zwolniony' });
    } else {
      a.result = 'odmowa';
      c.vacancy.fillOn = addDays(G.date, rint(1, 4));
      addMsg({ category: 'zarząd', from: `Zarząd ${c.name}`, stop: true, job: true, title: `${c.name} wybiera innego kandydata`, body: '<p>Dziękujemy za zainteresowanie – zarząd postawił na innego kandydata.</p>', link: '#/zwolniony' });
    }
  }
}
function sackManager(reason) {
  if (jobless()) return;
  const c = myClub(), p = boardPresident(c.id), s = G.staff[G.manager.coachId];
  G.sacked = { date: G.date, reason, clubId: c.id, apps: {}, offers: [] };
  openVacancy(c, s, reason); // były klub szuka następcy
  if (typeof UI !== 'undefined' && UI.play && typeof stopPlay === 'function') stopPlay();
  const open = Object.values(G.clubs).filter(x => x.vacancy && x.id !== c.id).length;
  addMsg({ category: 'zarząd', from: p ? p.name : `Zarząd ${c.name}`, stop: true, title: 'Zarząd rozwiązuje umowę z menedżerem',
    body: `<p>${esc(reason)}</p><p>Zarząd ${esc(c.name)} podjął decyzję o rozwiązaniu Twojego kontraktu ze skutkiem natychmiastowym.</p><p>${open ? `Wolne stanowiska menedżera: ${open}. Możesz aplikować.` : 'Żaden klub nie szuka teraz menedżera – poczekaj, aż zwolni się stanowisko.'}</p>`, link: '#/zwolniony' });
}
function applyJob(clubId) {
  const c = G.clubs[clubId];
  if (!jobless() || !c || !c.vacancy || clubId === G.sacked.clubId) return { ok: false, text: 'Ten klub nie szuka menedżera.' };
  if (G.sacked.apps[clubId]) return { ok: false, text: 'Aplikacja już wysłana.' };
  G.sacked.apps[clubId] = { date: G.date, due: addDays(G.date, rint(3, 7)) };
  return { ok: true, text: `Aplikacja wysłana – ${c.name} odpowie do ${fmtDate(G.sacked.apps[clubId].due)}.` };
}
function acceptJob(clubId) {
  const o = jobless() && G.sacked.offers.find(x => x.clubId === clubId && x.until >= G.date), nc = G.clubs[clubId];
  if (!o || !nc.vacancy) return { ok: false, text: 'Ta oferta jest nieaktualna.' };
  const old = G.clubs[G.sacked.clubId], s = G.staff[G.manager.coachId];
  if (s) { Object.assign(s, { clubId, joined: G.date, until: G.season + 1, left: null }); s.wage = staffWageFor({ ...s, player: false }, nc); }
  (G.manager.career = G.manager.career || []).push({ clubId: old.id, from: G.manager.since, to: G.sacked.date, left: 'zwolniony', reason: G.sacked.reason });
  nc.vacancy = null;
  G.clubId = clubId; G.manager.since = G.date;
  G.board = { confidence: 50, log: [{ date: G.date, d: 0, text: `Zatrudnienie w ${nc.name}` }], streak: 0, fails: 0 };
  G.duties = {}; G.trackPlan = null; G.trackTest = {};
  G.sacked.done = true;
  addMsg({ category: 'zarząd', from: `Zarząd ${nc.name}`, title: `Witamy w ${nc.name}`, body: `<p>Zostajesz menedżerem drużyny. Cel zarządu: <b>${esc(nc.objective.text)}</b>.</p>`, link: '#/klub' });
  return { ok: true, text: `Jesteś menedżerem ${nc.name}.` };
}
// Dzień bez pracy: świat toczy się dalej (mecze byłego klubu symuluje AI), zatrzymanie tylko na wiadomościach o pracy
function joblessDay() {
  const before = G.seq.msg;
  const fx = pendingNotify(); if (fx) autoNotifyUser(fx);
  processDay(G.date);
  G.date = addDays(G.date, 1);
  seedRng(hashStr(G.seed + G.date));
  newDay();
  const fresh = Object.values(G.messages).filter(m => Number(m.id.slice(1)) >= before && m.job && m.stop);
  return fresh.length ? { stop: 'message', message: fresh[0] } : { stop: 'day' };
}

// ---------- Zmiany w zarządach i daty (codziennie, js/game.js) ----------
function boardDay() {
  const d = G.date;
  for (const [id, b] of Object.entries(CLUB_BOARD)) {
    const c = G.clubs[id];
    if (!c) continue;
    const inn = b.people.filter(p => p.since === d && !b.people.some(q => q.name === p.name && q.until === d && q.role === p.role));
    const out = b.people.filter(p => p.until === d && !b.people.some(q => q.name === p.name && q.since === d));
    const moved = b.people.filter(p => p.since === d && b.people.some(q => q.name === p.name && q.until === d && q.role !== p.role));
    if (!inn.length && !out.length) continue;
    const mine = Number(id) === G.clubId;
    const li = [...out.map(p => `<li>${esc(p.name)} – odchodzi (${BOARD_ROLES[p.role][0].toLowerCase()})</li>`),
      ...inn.map(p => `<li><b>${esc(p.name)}</b> – ${BOARD_ROLES[p.role][0].toLowerCase()}${moved.includes(p) ? ' (zmiana funkcji)' : ''}</li>`)];
    const pres = inn.find(p => p.role === 'prezes'), own = inn.find(p => p.role === 'wlasciciel');
    addMsg({ category: mine ? 'zarząd' : 'liga', from: mine ? 'Rada nadzorcza' : 'Serwis żużlowy', title: pres ? `${c.name}: nowym prezesem ${pres.name}` : own ? `${c.name} ma nowego właściciela` : `${c.name}: zmiany we władzach klubu`,
      body: `<ul>${li.join('')}</ul>`, link: mine ? '#/klub' : `#/zespol/${id}/zarzad` });
  }
  if (G.manager && !jobless()) boardRequestsDay();
  if (d.endsWith('-10-31') && G.manager && !jobless()) boardFinYearEnd(fyOf(d));
  vacanciesDay();
}

// ---------- Widok: Klub → Zarząd ----------
function boardLinkText(p) { return p.link ? p.link.text : ''; }
// info: true – pierwsza zakładka Klubu (podstawowe informacje + władze klubu)
function boardPage(c, info = false) {
  const b = boardOf(c.id);
  if (!b) return '<div class="panel empty">Brak danych o władzach klubu.</div>';
  const ppl = boardPeople(c.id), pres = boardPresident(c.id), cost = boardCost(c), mine = c.id === G.clubId;
  const presCard = pres ? `<div class="cards" style="grid-template-columns:minmax(190px,260px)"><div class="card staff"><div class="ph">${folderPic(pres.name, silhouette(pres.name, c.colors[0]), '', '', ['board', 'staff'])}</div><div class="body"><div class="nm"><small>${BOARD_ROLES[pres.role][0]}</small>${esc(pres.name)}</div><div class="meta"><span>${pres.since ? `od ${fmtDate(pres.since)}` : '&nbsp;'}</span></div></div></div></div>` : '';
  const infoPanel = `<div class="panel"><h3>Informacje</h3><div class="kv"><div>Pełna nazwa</div><div>${esc(c.name)}</div><div>Miasto</div><div>${esc(c.city)}</div><div>Liga</div><div>${LEAGUES[c.league].name}</div><div>Reputacja</div><div>${stars(c.rep / 20)}</div></div></div>`;
  const ownerPanel = `<div class="panel"><h3>Właściciel</h3><div class="kv"><div>Podmiot</div><div>${esc(b.form)}</div><div>Akcjonariusze</div><div>${esc(b.owner.text)}</div><div>Koszt władz klubu</div><div>${fmtMoney(cost)} / mies. · ${fmtMoney(cost * 12, true)} / rok</div></div></div>`;
  const table = `<div class="panel flush" style="margin-top:14px"><table class="t"><thead><tr><th>Osoba</th><th>Funkcja</th><th>Od</th><th style="text-align:right">Wynagrodzenie</th><th>Powiązania</th></tr></thead><tbody>
      ${ppl.map(p => { const w = boardWage(p, c); return `<tr><td><b>${esc(p.name)}</b></td><td>${BOARD_ROLES[p.role][0]}</td><td>${p.since ? fmtDate(p.since) : ''}</td><td style="text-align:right">${w.v ? `${fmtMoney(w.v)} / mies.` : p.role === 'wlasciciel' || p.role === 'udzialowiec' ? '—' : 'bez wynagrodzenia'}</td><td>${esc(boardLinkText(p))}</td></tr>`; }).join('')}</tbody></table></div>`;
  if (!info || !mine || !G.manager) return `<div class="grid ${info ? 'g3' : 'g2'}">${info ? infoPanel : ''}${ownerPanel}${presCard}</div>${table}`;
  // klub gracza: informacje, właściciel, zaufanie i cele (2 kolumny) | prezes i prośby do zarządu
  const row = leagueTable(c.league).find(r => r.clubId === c.id), S = finObjYear(), fo = finObjective(c, S), fs = finObjStatus(c, S);
  const open = boardReqOpen(S);
  const reqRow = open.length ? `<div style="display:flex;gap:8px;margin-top:14px"><select id="boardReqSel" style="flex:1;min-width:0">${open.map(k => `<option value="${k}">${BOARD_REQS[k][0]}</option>`).join('')}</select><button class="btn" onclick="ACT.boardReq(document.getElementById('boardReqSel').value)">Poproś</button></div>` : '';
  const trust = `<div class="panel"><h3>Zaufanie zarządu do menedżera</h3><p style="font-size:22px;margin:0 0 6px"><b>${Math.round(G.board.confidence)}%</b></p>${bar(G.board.confidence)}${reqRow}</div>`;
  const goals = `<div class="panel"><h3>Cele zarządu</h3><div class="kv"><div>Sportowy</div><div><b>${esc(c.objective.text)}</b>${row && row.m ? `<div class="small muted">teraz ${row.pos}. miejsce po ${row.m} meczach</div>` : ''}</div>
      <div>Finansowy (rok ${S})</div><div><b>${esc(fo.text)}</b><div class="small ${fs.ok ? 'pos' : 'neg'}">${esc(fs.text)}</div></div></div></div>`;
  return `<div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:14px;align-items:start"><div class="grid g2">${infoPanel}${ownerPanel}${trust}${goals}</div><div>${presCard}</div></div>${table}`;
}
