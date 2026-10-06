'use strict';
// Procedura licencyjna klubów ligowych (Regulamin Licencyjny PZM 2026, RPK art. 215, 216, 218, 223, 234, 235) – ścieżka naprawy zadłużonych klubów.
// Moduł tylko czyta finanse (saldo, budżet, zobowiązania kontraktowe) i nakłada skutki sportowo-kontraktowe.
// Kalendarz cyklu licencyjnego na sezon T (zaczyna się jesienią sezonu T-1):
//   20.10  wniosek licencyjny: bilans, zobowiązania, plan budżetu na sezon T
//   31.10  termin uregulowania wszystkich zobowiązań; ratunek klubów (miasto, akcjonariusze) – bez gwarancji
//   10.11  rekomendacja: pozytywna / „klub zagrożony finansowo” / negatywna; zagrożony i negatywny nie rejestrują zawodników w okienku 16–20.11
//   14.12  decyzja Zespołu ds. Licencji: licencja / licencja z nadzorem finansowym (nakaz obniżki wynagrodzeń) / odmowa (degradacja, zwolnienie seniorów)
//   sezon  nadzór: miesięczne raporty, zawieszenie licencji przy utrzymujących się zaległościach; zawodnicy z zaległościami ponad 21 dni mogą rozwiązać kontrakt
const LIC_FROM = 2027; // pierwszy cykl w grze: licencje na sezon 2027 (licencje na 2026 przyznano przed startem gry)
const LIC_DATES = { apply: '10-20', settle: '10-31', rec: '11-10', decision: '12-14' };
const LIC_REC = { ok: 'pozytywna', risk: 'klub zagrożony finansowo', neg: 'negatywna' };
const LIC_DEC = { ok: 'licencja', sup: 'licencja z nadzorem finansowym', deny: 'odmowa licencji' };
const licDebt = c => Math.max(0, -Math.round(c.cash));
const licOf = c => c.lic || (c.lic = { season: null });
// Sezon, którego dotyczy bieżący cykl licencyjny
const licSeason = () => (G.date.slice(5) >= '10-15' && G.seasonClosed === G.season ? G.season + 1 : G.season);

// ---------- Ograniczenia wynikające z licencji (używane przez rynek, js/market.js) ----------
// Klub z rekomendacją „zagrożony” lub negatywną nie rejestruje zawodników w podstawowym okienku (art. 215 ust. 8 RPK)
function licNoBasicWindow(clubId) {
  const L = G.clubs[clubId] && G.clubs[clubId].lic;
  return !!L && L.season === G.season && L.rec && L.rec !== 'ok' && !L.decision;
}
// Zaległości wobec zawodników dłuższe niż 21 dni (ujemne saldo)
function licOverdueDays(clubId) {
  const L = G.clubs[clubId] && G.clubs[clubId].lic;
  return L && L.negSince ? dayDiff(L.negSince, G.date) : 0;
}
// Nadzór finansowy: licencja z nadzorem albo klub zdegradowany po odmowie licencji
const licSupervised = L => !!L && (L.decision === 'sup' || L.decision === 'deny');
// Blokada umowy: tekst przyczyny albo null
function licBlock(clubId, kind, terms, mode) {
  const c = G.clubs[clubId], L = c && c.lic;
  if (!L) return null;
  const pro = kind === 'loan' || terms.kind !== 'amatorski';
  if (L.suspended && pro) return `Licencja klubu jest zawieszona (nadzór finansowy) – do spłaty zaległości liga nie zarejestruje nowych umów zawodowych ani wypożyczeń.`;
  if (licSupervised(L) && c.cash < 0 && pro) return `Licencja z nadzorem finansowym: przy zaległościach (${fmtMoney(-c.cash, true)}) liga nie zatwierdzi nowej umowy zawodowej. Spłać zaległości (Finanse → Finansowanie).`;
  if ((mode === 'precontract' || mode === 'renewal') && licOverdueDays(clubId) > 21) return `Klub ma przeterminowane zobowiązania wobec zawodników (${licOverdueDays(clubId)} dni) – podmiot zarządzający nie zatwierdzi prekontraktu (art. 223 ust. 4 RPK).`;
  return null;
}

// ---------- Etapy cyklu ----------
function licenceDay() {
  const md = G.date.slice(5), T = licSeason();
  if (T < LIC_FROM) return licMonitor();
  if (md === LIC_DATES.apply) licApply(T);
  if (md === LIC_DATES.rec) licRecommend(G.season);
  if (md === LIC_DATES.decision) licDecide(G.season);
  licMonitor();
}
// 20.10: wnioski licencyjne
function licApply(T) {
  for (const c of Object.values(G.clubs).filter(c => clubActive(c, T) || c.id === G.clubId)) {
    const L = (c.lic = { season: T, applied: G.date, cashApply: Math.round(c.cash), plan: Math.round(commitmentsFor(c, T)), budget: c.budget, history: (c.lic && c.lic.history) || [] });
    L.history.push({ d: G.date, t: `Wniosek o licencję na sezon ${T}: saldo ${fmtMoney(c.cash, true)}, zobowiązania kontraktowe na ${T}: ${fmtMoney(L.plan, true)} przy budżecie ${fmtMoney(c.budget, true)}.` });
  }
  const c = myClub(), L = c.lic;
  addMsg({ category: 'zarząd', from: 'Dział licencji', stop: c.cash < 0, title: `Wniosek o licencję na sezon ${T} złożony`,
    body: `<p>Złożyliśmy dokumenty licencyjne: bilans, zestawienie zobowiązań i plan budżetu na sezon ${T}.</p><p>Saldo: <b class="${c.cash < 0 ? 'neg' : 'pos'}">${fmtMoney(c.cash)}</b>. Kontrakty zawodników na ${T}: ${fmtMoney(L.plan)} (budżet ${fmtMoney(c.budget)}).</p>
      <p><b>Do 31 października wszystkie zobowiązania muszą być uregulowane.</b> Zaległości oznaczają rekomendację „klub zagrożony finansowo” (10.11) – bez rejestracji zawodników w okienku 16–20.11 – a przy dużym długu odmowę licencji (14.12).</p>`, link: '#/klub/licencja' });
}
// 31.10: rozliczenie zobowiązań – zastępuje kontrolę z js/finance.js (licenceCheck); ratunek klubów AI nie jest gwarantowany
function licenceSettlement() {
  const T = G.season + 1;
  for (const c of Object.values(G.clubs)) {
    if (typeof finInit === 'function') finInit(c);
    const L = licOf(c);
    if (L.season !== T) { L.season = T; L.history = L.history || []; }
    if (c.cash < 0 && c.id !== G.clubId) licRescue(c, 'licencja');
    L.debt31 = licDebt(c);
    L.history = L.history || [];
    L.history.push({ d: G.date, t: L.debt31 ? `Na 31 października zaległości: ${fmtMoney(L.debt31)}.` : 'Zobowiązania na 31 października uregulowane.' });
    if (c.fin) c.fin.licence = L.debt31 ? { S: T, status: 'w procedurze', debt: L.debt31 } : { S: T, status: 'ok' };
  }
  if (licSeasonActive(T)) {
    const c = myClub(), d = c.lic.debt31;
    addMsg({ category: 'zarząd', from: 'Dział licencji', stop: !!d, title: d ? `Zaległości na 31 października: ${fmtMoney(d, true)}` : 'Zobowiązania uregulowane na 31 października',
      body: d ? `<p>Klub nie uregulował zobowiązań w terminie (<b class="neg">${fmtMoney(d)}</b>). 10 listopada Ekstraliga / GKSŻ wyda rekomendację – spodziewaj się statusu „klub zagrożony finansowo”${d > c.budget * 0.25 ? ' lub negatywnej' : ''}.</p><p>Do decyzji Zespołu ds. Licencji (14 grudnia) możesz poprawić sytuację: sprzedaż zawodników, rozwiązanie drogich kontraktów, kredyt lub pomoc miasta i akcjonariuszy.</p>` : '<p>Klub spełnił najważniejszy warunek licencyjny. Rekomendacja 10 listopada.</p>', link: '#/klub/licencja' });
  }
}
const licSeasonActive = T => T >= LIC_FROM;
// Ratunek klubu AI: miasto i akcjonariusze w miarę możliwości (bez gwarancji pełnej spłaty)
function licRescue(c, why) {
  const debt = licDebt(c);
  if (!debt) return;
  const f = c.fin || {}, city = f.city || { base: c.budget * 0.05, owner: false, stance: 0.4 };
  const fromCity = Math.min(debt * 0.4, city.base * (city.owner ? 0.8 : city.stance * 0.5)) * (0.6 + rnd() * 0.4);
  if (fromCity > 10000) addTx(c.id, 'miasto', round5k(fromCity), `Pomoc miasta (${why})`);
  const left = licDebt(c);
  const fromOwner = Math.min(left, c.budget * (f.ownerCap ?? 0.1) * (0.3 + rnd() * 0.7));
  if (left && fromOwner > 10000) addTx(c.id, 'właściciel', round5k(fromOwner), `Dokapitalizowanie przez akcjonariuszy (${why})`);
}
// 10.11: rekomendacja
function licRecommend(T) {
  if (!licSeasonActive(T)) return;
  const news = [];
  for (const c of Object.values(G.clubs).filter(c => clubActive(c, T))) {
    const L = licOf(c);
    if (L.season !== T) { L.season = T; L.history = L.history || []; L.debt31 = licDebt(c); }
    const debt = Math.max(L.debt31 || 0, licDebt(c));
    const plan = commitmentsFor(c, T);
    L.rec = debt > c.budget * 0.25 ? 'neg' : debt > 0 || plan > c.budget * 0.85 ? 'risk' : 'ok';
    L.history.push({ d: G.date, t: `Rekomendacja: ${LIC_REC[L.rec]}${debt ? ` (zaległości ${fmtMoney(debt, true)})` : ''}${plan > c.budget * 0.85 ? `, kontrakty ${Math.round(plan / c.budget * 100)}% budżetu` : ''}.` });
    if (L.rec !== 'ok') {
      news.push(`${esc(c.name)} – <b>${LIC_REC[L.rec]}</b>`);
      L.repair = true; // ścieżka naprawy: cięcie kosztów, sprzedaż zawodników
      if (c.id !== G.clubId) licAiRepair(c, T);
    }
    if (c.fin) c.fin.licence = L.rec === 'ok' ? { S: T, status: 'ok' } : { S: T, status: LIC_REC[L.rec], debt };
  }
  const c = myClub(), L = c.lic;
  addMsg({ category: 'liga', from: c.league === 'KLZ' ? 'GKSŻ' : 'Ekstraliga Żużlowa', stop: L && L.rec !== 'ok', title: `Rekomendacje licencyjne na sezon ${T}${L ? `: ${LIC_REC[L.rec]}` : ''}`,
    body: `<p>${news.length ? `Kluby z zastrzeżeniami: ${news.join('; ')}.` : 'Wszystkie kluby otrzymały rekomendację pozytywną.'}</p>${L && L.rec !== 'ok' ? `<p><b>Nasz klub: ${LIC_REC[L.rec]}.</b> Nie możemy rejestrować zawodników w podstawowym okienku (16–20.11) – uzgodnione umowy zostaną zarejestrowane w okienku uzupełniającym (22–31.12), o ile otrzymamy licencję.</p><p>Decyzja Zespołu ds. Licencji 14 grudnia. ${L.rec === 'neg' ? 'Przy obecnym długu grozi nam <b>odmowa licencji</b>.' : 'Spłata zaległości i ograniczenie kosztów kontraktów pozwolą uniknąć nadzoru.'}</p>` : ''}`, link: '#/klub/licencja' });
}
// Klub AI na ścieżce naprawy: wystawia najdroższych zawodników, wycofuje oferty zawodowe, akcjonariusze dopłacają
function licAiRepair(c, T) {
  const sq = squadFor(c, T).filter(r => r.contract && r.contract.clubId === c.id && r.contract.kind !== 'amatorski').sort(by(r => dealSeasonCost(r.contract, r, c.league, T), -1));
  for (const r of sq.slice(0, 2)) r.listed = true;
  for (const n of Object.values(G.negs)) if (n.clubId === c.id && NEG_OPEN.includes(n.status) && n.terms.kind !== 'amatorski' && n.kind !== 'renewal') withdrawOffer(n.id, `${c.name} wycofuje ofertę – klub na ścieżce naprawy finansowej.`);
}
// 14.12: decyzja Zespołu ds. Licencji
function licDecide(T) {
  if (!licSeasonActive(T)) return;
  const out = [];
  for (const c of Object.values(G.clubs).filter(c => clubActive(c, T))) {
    const L = licOf(c);
    if (L.season !== T || !L.rec) continue;
    if (L.rec !== 'ok' && c.id !== G.clubId) licRescue(c, 'decyzja licencyjna');
    const debt = licDebt(c), plan = commitmentsFor(c, T);
    let dec = 'ok';
    if (L.rec !== 'ok' || debt > 0 || plan > c.budget * 0.85) dec = 'sup';
    if (debt > c.budget * 0.25 || (L.rec === 'neg' && debt > c.budget * 0.1)) dec = 'deny';
    L.decision = dec; L.decided = G.date; L.repair = dec !== 'ok'; L.debtDec = debt;
    L.history.push({ d: G.date, t: `Decyzja: ${LIC_DEC[dec]}${debt ? ` (zaległości ${fmtMoney(debt, true)})` : ''}.` });
    if (dec === 'deny') out.push(c);
  }
  // Zespół ds. Licencji nie rozbija rozgrywek: najwyżej jedna odmowa na ligę (największy dłużnik względem budżetu),
  // liga musi zachować co najmniej 6 drużyn; pozostali dłużnicy – układ z wierzycielami i licencja z nadzorem
  const denied = [];
  for (const lg of LEAGUE_ORDER) {
    const cand = out.filter(c => c.league === lg).sort(by(c => c.lic.debtDec / c.budget, -1));
    const size = Object.values(G.clubs).filter(c => c.league === lg && clubActive(c, T)).length;
    if (cand.length && (lg !== 'KLZ' || size > 6)) denied.push(cand[0]);
  }
  for (const c of Object.values(G.clubs).filter(c => clubActive(c, T) && c.lic && c.lic.season === T && c.lic.decision)) {
    const L = c.lic;
    if (L.decision === 'deny' && !denied.includes(c)) {
      L.decision = 'sup';
      const cut = round5k(licDebt(c) * 0.5);
      if (cut > 0) addTx(c.id, 'finansowanie', cut, 'Układ z wierzycielami (warunek licencji z nadzorem)');
      L.history.push({ d: G.date, t: `Zamiast odmowy: licencja z nadzorem po układzie z wierzycielami${cut ? ` (umorzono ${fmtMoney(cut, true)})` : ''}.` });
    }
    const plan = commitmentsFor(c, T);
    if (L.decision === 'sup') { L.monitor = { warnings: 0 }; if (plan > c.budget * 0.85) licWageOrder(c, T, plan); }
    if (c.fin) c.fin.licence = L.decision === 'ok' ? { S: T, status: 'ok' } : { S: T, status: L.decision === 'sup' ? 'nadzorowana' : 'odmowa', debt: licDebt(c) };
    if (c.id === G.clubId && !denied.includes(c)) licDecisionMsg(c, T, L.decision, licDebt(c));
  }
  if (denied.length) licDenials(denied, T);
  const me = myClub();
  if (denied.includes(me)) licDecisionMsg(me, T, me.lic.decision, licDebt(me));
}
function licDecisionMsg(c, T, dec, debt) {
  const L = c.lic;
  addMsg({ category: 'zarząd', from: 'Zespół ds. Licencji', stop: true, title: `Licencja na sezon ${T}: ${LIC_DEC[dec]}`,
    body: dec === 'ok' ? '<p>Klub otrzymał licencję bez zastrzeżeń.</p>'
      : dec === 'sup' ? `<p>Klub otrzymał licencję z <b>nadzorem finansowym</b> na sezon ${T}.</p><ul><li>Przy ujemnym saldzie liga nie zatwierdzi nowych umów zawodowych.</li><li>Co miesiąc raport finansowy – utrzymujące się zaległości oznaczają zawieszenie licencji.</li>${L.wageOrder ? `<li>Nakaz obniżki wynagrodzeń o ${L.wageOrder.pct}% (art. 235 ust. 4 RPK) – zawodnicy mają 14 dni na podpisanie aneksów, inaczej kontrakty wygasają.</li>` : ''}</ul>`
      : `<p><b>Odmowa licencji</b> na sezon ${T} – zaległości ${fmtMoney(debt)}.</p><p>${L.denyText || ''}</p>`, link: '#/klub/licencja' });
  G.board.confidence = clamp(G.board.confidence - (dec === 'deny' ? 35 : dec === 'sup' ? 10 : 0), 0, 100);
}
// Nakaz zmiany wynagrodzeń: zawodnicy podpisują aneks albo kontrakt wygasa (art. 235 ust. 4 RPK)
function licWageOrder(c, T, plan) {
  const pct = clamp(Math.round((plan - c.budget * 0.8) / plan * 100 / 5) * 5, 5, 30);
  c.lic.wageOrder = { pct, until: addDays(G.date, 14), done: false };
  c.lic.history.push({ d: G.date, t: `Nakaz obniżki wynagrodzeń zawodowych o ${pct}% – aneksy do ${fmtDateShort(c.lic.wageOrder.until)}.` });
}
function licApplyWageOrder(c) {
  const W = c.lic.wageOrder, T = G.season, signed = [], left = [];
  for (const r of Object.values(G.riders).filter(r => r.contract && r.contract.clubId === c.id && r.contract.kind !== 'amatorski' && r.contract.until >= T)) {
    const k = r.contract, key = r.skill >= LEAGUE_AVG_SKILL[c.league] + 1.5;
    const accept = chance(key ? 0.55 : 0.8) || isJunior(r);
    if (accept) {
      for (const y of Object.keys(k.terms || {}).map(Number).filter(y => y >= T)) { k.terms[y].signing = round5k(k.terms[y].signing * (1 - W.pct / 100)); k.terms[y].perPoint = round100(k.terms[y].perPoint * (1 - W.pct / 100)); }
      k.signing = round5k(k.signing * (1 - W.pct / 100)); k.perPoint = round100(k.perPoint * (1 - W.pct / 100));
      signed.push(r);
    } else {
      r.lastUntil = k.until; r.prevClubId = c.id; r.clubId = r.loan ? r.clubId : null; r.contract = null; left.push(r);
      dropFromLineups(r.id);
    }
  }
  W.done = true;
  c.lic.history.push({ d: G.date, t: `Aneksy podpisało ${signed.length} zawodników; ${left.length} odchodzi.` });
  if (c.id === G.clubId) addMsg({ category: 'transfer', from: 'Zespół ds. Licencji', stop: true, title: `Nakaz obniżki wynagrodzeń: ${signed.length} aneksów, ${left.length} odejść`,
    body: `<p>Wynagrodzenia obniżone o ${W.pct}%: ${signed.map(r => esc(r.name)).join(', ') || '—'}.</p>${left.length ? `<p>Nie podpisali aneksów – kontrakty rozwiązane, zawodnicy są wolni: ${left.map(r => `<a href="#/zawodnik/${r.id}">${esc(r.name)}</a>`).join(', ')}.</p>` : ''}`, link: '#/druzyna' });
}
// Odmowa licencji: degradacja o jedną ligę (KLŻ – klub nie startuje), seniorzy zwolnieni lub mogą odejść, juniorzy zostają (art. 218, 235 RPK)
function licDenials(list, T) {
  const lines = [];
  for (const c of list) {
    const from = c.league;
    const down = { PGE: '2E', '2E': 'KLZ' }[from];
    const L = c.lic;
    let freed = [];
    if (!down && c.id !== G.clubId) {
      c.inactive = T; // KLŻ: klub nie przystępuje do rozgrywek (jak Unia Tarnów 2026)
      freed = licReleaseSeniors(c, 1);
      L.denyText = `Klub nie wystartuje w sezonie ${T}. Seniorzy zostali zwolnieni, juniorzy zachowują przynależność.`;
    } else if (!down) {
      // klub gracza w KLŻ: licencja tylko po przymusowej dopłacie akcjonariuszy i z nadzorem
      const need = licDebt(c);
      addTx(c.id, 'właściciel', need, 'Przymusowe dokapitalizowanie przez akcjonariuszy (warunek licencji)');
      L.decision = 'sup'; L.monitor = { warnings: 0 };
      L.denyText = '';
      if (c.fin) c.fin.licence = { S: T, status: 'nadzorowana', debt: 0 };
      lines.push(`${esc(c.name)} – licencja po przymusowej dopłacie akcjonariuszy`);
      continue;
    } else {
      c.league = down; c.stadium.ticket = LEAGUES[down].ticket; L.monitor = { warnings: 0 };
      freed = licReleaseSeniors(c, 0.6);
      L.denyText = `Klub może wystartować tylko w ${LEAGUES[down].name}. ${freed.length ? `Odeszli zawodnicy: ${freed.map(r => esc(r.name)).join(', ')}.` : ''}`;
    }
    lines.push(`${esc(c.name)} – ${down ? `degradacja do ${LEAGUES[down].name}` : 'nie wystartuje w rozgrywkach'}${freed.length ? ` (odchodzi ${freed.length} seniorów)` : ''}`);
    c.lic.history.push({ d: G.date, t: L.denyText });
  }
  licRebuildFixtures(T);
  addMsg({ category: 'liga', from: 'Zespół ds. Licencji', stop: true, title: `Odmowa licencji na sezon ${T}`, body: `<p>${lines.join('<br>')}</p><p>Terminarz sezonu ${T} został ułożony ponownie. Zwolnieni zawodnicy mogą podpisać kontrakty w okienku uzupełniającym (22–31.12).</p>`, link: '#/liga/terminarz' });
}
function licReleaseSeniors(c, share) {
  const out = [];
  for (const r of Object.values(G.riders).filter(r => r.contract && r.contract.clubId === c.id && !isJunior(r))) {
    if (!chance(share)) continue;
    for (const n of openNegs(r.id)) if (n.holderId === c.id) closeNeg(n, 'rejected', 'Klub stracił licencję.', false);
    if (r.loan) endLoan(r, true);
    r.lastUntil = r.contract.until; r.prevClubId = c.id; r.clubId = null; r.contract = null; delete r.nextContract;
    out.push(r);
    dropFromLineups(r.id);
  }
  return out;
}
// Ponowne ułożenie terminarza sezonu (tylko sezony generowane przez grę, gdy nie rozegrano jeszcze żadnego meczu)
function licRebuildFixtures(T) {
  if (realSeason(T) || Object.values(G.fixtures).some(f => f.season === T && f.played)) return;
  for (const f of Object.values(G.fixtures)) if (f.season === T) delete G.fixtures[f.id];
  makeLeagueFixtures(T);
}
// ---------- Monitoring: nadzór, zaległości wobec zawodników ----------
function licMonitor() {
  const d = G.date, md = d.slice(5);
  for (const c of Object.values(G.clubs)) {
    const L = licOf(c);
    if (c.cash < 0) { if (!L.negSince) L.negSince = d; } else { delete L.negSince; delete L.demandSent; if (L.suspended) licUnsuspend(c); }
    if (L.wageOrder && !L.wageOrder.done && d >= L.wageOrder.until) licApplyWageOrder(c);
  }
  if (dow(d) === 0) licOverdueWeek();
  if (d.endsWith('-01') && md >= '03-01' && md <= '10-01') licSupervisionMonth();
}
// Zawodnik może wnioskować o rozwiązanie kontraktu z winy klubu, gdy zaległość przekracza 21 dni i klub dostał wezwanie (art. 234 ust. 2 RPK)
function licOverdueWeek() {
  for (const c of Object.values(G.clubs)) {
    const days = licOverdueDays(c.id);
    if (days <= 21) continue;
    const L = c.lic;
    const rs = Object.values(G.riders).filter(r => r.contract && r.contract.clubId === c.id && !['amatorski', 'warszawski'].includes(r.contract.kind) && !isJunior(r)).sort(by(r => r.skill, -1));
    if (!rs.length) continue;
    if (!L.demandSent) {
      L.demandSent = G.date;
      if (c.id === G.clubId) addMsg({ category: 'zarząd', from: 'Kancelaria prawna', stop: true, title: 'Zawodnicy wzywają do zapłaty',
        body: `<p>Klub od ${days} dni nie reguluje zobowiązań (saldo ${fmtMoney(c.cash, true)}). Zawodnicy wysłali wezwania do zapłaty. Jeśli zaległości nie znikną, mogą złożyć wniosek o rozwiązanie kontraktu z winy klubu (art. 234 ust. 2 RPK) i odejść bez odstępnego.</p>`, link: '#/finanse/finansowanie' });
      continue;
    }
    if (dayDiff(L.demandSent, G.date) < 7) continue;
    const r = rs.find(x => chance(x.skill >= LEAGUE_AVG_SKILL[c.league] ? 0.12 : 0.06));
    if (!r) continue;
    for (const n of openNegs(r.id)) if (n.holderId === c.id) closeNeg(n, 'rejected', 'Kontrakt rozwiązany z winy klubu.', false);
    if (r.loan) endLoan(r, true);
    r.lastUntil = r.contract.until; r.prevClubId = c.id; r.clubId = null; r.contract = null; delete r.nextContract;
    dropFromLineups(r.id);
    L.history = L.history || []; L.history.push({ d: G.date, t: `${r.name} rozwiązał kontrakt z winy klubu (zaległości).` });
    logTransfer(r, c.id, null, 0, 'rozwiązanie z winy klubu');
    if (c.id === G.clubId) addMsg({ category: 'transfer', from: 'Zespół ds. Licencji', stop: true, title: `${r.name} rozwiązuje kontrakt z winy klubu`,
      body: `<p>Z powodu zaległości trwających ${days} dni ${esc(r.name)} złożył wniosek o rozwiązanie kontraktu. Wniosek uwzględniono – zawodnik jest wolny i może podpisać umowę w najbliższym okienku.</p>`, link: `#/zawodnik/${r.id}` });
  }
}
// Nadzór finansowy: miesięczne raporty, zawieszenie licencji po dwóch ostrzeżeniach
function licSupervisionMonth() {
  for (const c of Object.values(G.clubs)) {
    const L = c.lic;
    if (!L || !licSupervised(L) || L.season !== G.season) continue;
    L.monitor = L.monitor || { warnings: 0 };
    if (c.cash >= 0) { L.monitor.warnings = 0; continue; }
    L.monitor.warnings++;
    if (c.id !== G.clubId) licRescue(c, 'nadzór finansowy');
    if (L.monitor.warnings >= 3 && !L.suspended && c.cash < 0) {
      L.suspended = G.date;
      L.history.push({ d: G.date, t: 'Zawieszenie licencji – zaległości mimo nadzoru.' });
      addMsg({ category: 'liga', from: c.league === 'KLZ' ? 'GKSŻ' : 'Ekstraliga Żużlowa', stop: c.id === G.clubId, title: `Zawieszona licencja: ${c.name}`,
        body: `<p>Mimo nadzoru finansowego ${esc(c.name)} nie reguluje zobowiązań (${fmtMoney(-c.cash, true)}). Licencja zostaje zawieszona: zakaz rejestracji nowych zawodników i wypożyczeń do czasu spłaty.</p>`, link: c.id === G.clubId ? '#/klub/licencja' : `#/zespol/${c.id}` });
    } else if (c.id === G.clubId) addMsg({ category: 'zarząd', from: 'Zespół ds. Licencji', stop: true, title: `Nadzór finansowy: ostrzeżenie ${L.monitor.warnings}/2`,
      body: `<p>Raport miesięczny wykazał zaległości ${fmtMoney(-c.cash)}. ${L.monitor.warnings >= 2 ? 'Kolejne ostrzeżenie oznacza zawieszenie licencji.' : 'Ureguluj zobowiązania przed kolejnym raportem.'}</p>`, link: '#/finanse/finansowanie' });
  }
}
function licUnsuspend(c) {
  c.lic.suspended = null; if (c.lic.monitor) c.lic.monitor.warnings = 0;
  c.lic.history.push({ d: G.date, t: 'Zaległości spłacone – zawieszenie licencji uchylone.' });
  if (c.id === G.clubId) addMsg({ category: 'zarząd', from: 'Zespół ds. Licencji', title: 'Zawieszenie licencji uchylone', body: '<p>Klub spłacił zaległości – może ponownie rejestrować zawodników.</p>', link: '#/klub/licencja' });
}

// ---------- Ekran: Klub → Licencja ----------
function licencePage(c) {
  const L = c.lic || {}, T = licSeason();
  const steps = [['20.10', 'Wniosek licencyjny', L.applied ? 'złożony' : ''], ['31.10', 'Termin uregulowania zobowiązań', L.debt31 != null ? (L.debt31 ? `zaległości ${fmtMoney(L.debt31, true)}` : 'uregulowane') : ''],
    ['10.11', 'Rekomendacja', L.rec ? LIC_REC[L.rec] : ''], ['16–20.11', 'Podstawowe okienko transferowe', L.rec && L.rec !== 'ok' ? 'bez rejestracji zawodników' : ''],
    ['14.12', 'Decyzja Zespołu ds. Licencji', L.decision ? LIC_DEC[L.decision] : ''], ['22–31.12', 'Uzupełniające okienko transferowe', L.decision === 'deny' ? 'zgodnie z decyzją' : '']];
  const cls = v => /zaległ|zagrożony|negatywna|odmowa|bez rejestracji/.test(v) ? 'neg' : /nadzor/.test(v) ? 'warn' : v ? 'pos' : 'muted';
  const debtDays = licOverdueDays(c.id);
  return `<div class="grid g2"><div class="stack"><div class="panel flush"><div class="ph"><h3>Procedura licencyjna – sezon ${L.season || T}</h3>${!licSeasonActive(L.season || T) ? '<span class="small muted">licencje na 2026 przyznano przed startem gry – pierwszy cykl w grze: jesień 2026</span>' : ''}</div>
      <table class="t"><tbody>${steps.map(([d, n, v]) => `<tr><td style="width:90px"><b>${d}</b></td><td>${n}</td><td class="${cls(v)}">${esc(v || '—')}</td></tr>`).join('')}</tbody></table></div>
    <div class="panel"><h3>Stan klubu</h3><div class="kv"><div>Saldo</div><div class="${c.cash < 0 ? 'neg' : 'pos'}">${fmtMoney(c.cash)}</div><div>Zaległości</div><div>${debtDays ? `<span class="neg">${debtDays} dni</span>${debtDays > 21 ? ' – zawodnicy mogą rozwiązywać kontrakty z winy klubu' : ''}` : 'brak'}</div>
      <div>Kontrakty na sezon ${T}</div><div>${fmtMoney(commitmentsFor(c, T))} (${Math.round(commitmentsFor(c, T) / c.budget * 100)}% budżetu)</div>
      ${licSupervised(L) ? `<div>Nadzór finansowy</div><div class="warn">tak${L.monitor ? ` – ostrzeżenia ${L.monitor.warnings}/2` : ''}</div>` : ''}${L.suspended ? `<div>Licencja</div><div class="neg">zawieszona od ${fmtDateShort(L.suspended)}</div>` : ''}
      ${L.wageOrder ? `<div>Nakaz obniżki wynagrodzeń</div><div>${L.wageOrder.pct}% – ${L.wageOrder.done ? 'wykonany' : `aneksy do ${fmtDateShort(L.wageOrder.until)}`}</div>` : ''}</div>
      <p class="small" style="margin-top:10px"><a href="#/finanse/finansowanie">Finansowanie: kredyty, miasto, akcjonariusze →</a></p></div>
    ${(L.history || []).length ? `<div class="panel"><h3>Przebieg</h3><div class="neg-log">${L.history.slice().reverse().map(h => `<div><b>${fmtDateShort(h.d)}</b>${esc(h.t)}</div>`).join('')}</div></div>` : ''}</div>
    <div class="panel"><h3>Zasady (Regulamin Licencyjny, RPK)</h3><ul class="small" style="margin:0;padding-left:18px;line-height:1.6">
      <li>Do 20 października klub składa wniosek: bilans, zestawienie zobowiązań i plan budżetu na kolejny sezon.</li>
      <li>Do 31 października muszą być uregulowane wszystkie zobowiązania – wobec zawodników, pracowników i kontrahentów.</li>
      <li>10 listopada rekomendacja. Zaległości albo kontrakty ponad 85% budżetu = „klub zagrożony finansowo”; dług ponad 25% budżetu = negatywna. Taki klub nie rejestruje zawodników w okienku 16–20.11, tylko w uzupełniającym 22–31.12 – po licencji.</li>
      <li>14 grudnia decyzja: licencja, licencja z nadzorem finansowym (zakaz nowych umów zawodowych przy zaległościach, comiesięczne raporty, możliwy nakaz obniżki wynagrodzeń – zawodnik podpisuje aneks albo kontrakt wygasa) albo odmowa.</li>
      <li>Odmowa licencji: klub może wystartować tylko ligę niżej, seniorzy mogą odejść; w KLŻ klub nie startuje, seniorzy są wolni, juniorzy zostają.</li>
      <li>W trakcie sezonu: zaległości wobec zawodnika ponad 21 dni po wezwaniu – zawodnik może rozwiązać kontrakt z winy klubu. Klub z przeterminowanymi płatnościami nie podpisze prekontraktu. Przy nadzorze dwa ostrzeżenia, potem zawieszenie licencji.</li></ul></div></div>`;
}
