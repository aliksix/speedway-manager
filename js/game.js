'use strict';
// Logika gry: upływ czasu, finanse, rozwój, play-off, koniec sezonu, transfery, szkółka.

let G = null;

// ---------- Zapytania o terminarz i tabelę ----------
const seasonFixtures = (lg, season = G.season) => Object.values(G.fixtures).filter(f => f.season === season && (!lg || f.league === lg));
const clubFixtures = (clubId, season = G.season) => Object.values(G.fixtures).filter(f => f.season === season && (f.homeId === clubId || f.awayId === clubId)).sort(by(f => f.date));
const nextFixture = clubId => clubFixtures(clubId).find(f => !f.played);
const todayUserFixture = () => Object.values(G.fixtures).find(f => f.date === G.date && !f.played && (f.homeId === G.clubId || f.awayId === G.clubId));

function leagueTable(lg, season = G.season) {
  const rows = {};
  const clubs = Object.values(G.clubs).filter(c => (season === G.season ? c.league === lg : true));
  const fx = seasonFixtures(lg, season).filter(f => f.stage === 'RS');
  const ids = new Set(fx.flatMap(f => [f.homeId, f.awayId]));
  for (const id of (ids.size ? ids : clubs.map(c => c.id))) rows[id] = { clubId: id, m: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, bonus: 0, pts: 0, form: [] };
  const pairs = {};
  for (const f of fx.filter(f => f.played).sort(by(f => f.date))) {
    const h = rows[f.homeId], a = rows[f.awayId];
    h.m++; a.m++; h.pf += f.homePts; h.pa += f.awayPts; a.pf += f.awayPts; a.pa += f.homePts;
    if (f.walkover === 'both') { h.l++; a.l++; h.pa += 40; a.pa += 40; h.form.push('P'); a.form.push('P'); } // wzajemny walkower: 0 pkt, −40
    else if (f.homePts > f.awayPts) { h.w++; a.l++; h.pts += 2; h.form.push('W'); a.form.push('P'); }
    else if (f.homePts < f.awayPts) { a.w++; h.l++; a.pts += 2; a.form.push('W'); h.form.push('P'); }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form.push('R'); a.form.push('R'); }
    const key = [f.homeId, f.awayId].sort().join('-');
    (pairs[key] = pairs[key] || []).push(f);
  }
  // punkt bonusowy za lepszy bilans dwumeczu
  for (const list of Object.values(pairs)) {
    if (list.length < 2) continue;
    const agg = {};
    for (const f of list) { agg[f.homeId] = (agg[f.homeId] || 0) + f.homePts; agg[f.awayId] = (agg[f.awayId] || 0) + f.awayPts; }
    const [x, y] = Object.keys(agg);
    const woLost = id => list.some(f => f.walkover === 'both' || (f.walkover === 'H' && String(f.homeId) === id) || (f.walkover === 'A' && String(f.awayId) === id));
    if (agg[x] !== agg[y] && !woLost(agg[x] > agg[y] ? x : y)) { const win = agg[x] > agg[y] ? x : y; rows[win].bonus++; rows[win].pts++; }
  }
  return Object.values(rows).sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf).map((r, i) => ({ ...r, pos: i + 1, form: r.form.slice(-5) }));
}

// ---------- Upływ czasu ----------
// Przesuwa grę do następnego dnia z wydarzeniem (mecz gracza, ważna wiadomość) – najwyżej o 7 dni.
// opts.stopOnLineup: zatrzymanie w terminie awizacji składu (przycisk w grze); bez niego (narzędzia, testy) skład awizuje się sam
function advance(maxDays = 7, opts = {}) {
  if (typeof jobless === 'function' && jobless()) { for (let i = 0; i < maxDays; i++) { const r = joblessDay(); if (r.stop !== 'day') return r; } return { stop: 'day' }; } // bez pracy (js/board.js)
  if (todayUserFixture()) return { stop: 'match', fixture: todayUserFixture() };
  const lineupDue = () => { const fx = pendingNotify(); if (fx && !opts.stopOnLineup) autoNotifyUser(fx); return opts.stopOnLineup ? pendingNotify() : null; };
  if (lineupDue()) return { stop: 'lineup', fixture: pendingNotify() };
  const before = G.seq.msg;
  for (let i = 0; i < maxDays; i++) {
    processDay(G.date);
    G.date = addDays(G.date, 1);
    seedRng(hashStr(G.seed + G.date));
    newDay();
    notifyLineups();
    if (todayUserFixture()) return { stop: 'match', fixture: todayUserFixture() };
    if (lineupDue()) return { stop: 'lineup', fixture: pendingNotify() };
    if (opts.stopOnLineup && typeof sparUserToday === 'function' && sparUserToday()) return { stop: 'sparing', sparing: sparUserToday() };
    const fresh = Object.values(G.messages).filter(m => Number(m.id.slice(1)) >= before && m.stop);
    if (fresh.length) return { stop: 'message', message: fresh[0] };
    if (dow(G.date) === 0 && i > 0) break;
  }
  return { stop: 'day' };
}
// Awizacja składu gracza bez jego udziału (narzędzia i testy): ustawiony skład uzupełniony automatycznie
function autoNotifyUser(fx) {
  const line = validLineup(G.clubId, G.lineups[G.clubId] || autoLineup(G.clubId, fx.date), fx.date);
  G.lineups[G.clubId] = line.slice();
  (fx.notified = fx.notified || {})[G.clubId] = line.slice();
}
// Jeden dzień gry (tryb „dzień po dniu”). Zatrzymanie: mecz drużyny, zawody z udziałem naszych zawodników
// lub adeptów, każda nowa wiadomość.
function advanceDay() {
  if (typeof jobless === 'function' && jobless()) return joblessDay(); // bez pracy: czas płynie, mecze byłego klubu symuluje AI
  if (todayUserFixture()) return { stop: 'match', fixture: todayUserFixture() };
  if (pendingNotify()) return { stop: 'lineup', fixture: pendingNotify() };
  if (typeof pendingRoles === 'function' && pendingRoles().length) return { stop: 'role', rider: pendingRoles()[0] }; // świeża licencja: gracz wybiera rolę w drużynie
  const before = G.seq.msg;
  processDay(G.date);
  G.date = addDays(G.date, 1);
  seedRng(hashStr(G.seed + G.date));
  newDay();
  notifyLineups(); // kluby AI awizują składy 3 dni przed meczem
  if (todayUserFixture()) return { stop: 'match', fixture: todayUserFixture() };
  if (pendingNotify()) return { stop: 'lineup', fixture: pendingNotify() }; // gracz musi awizować skład
  const spar = typeof sparUserToday === 'function' && sparUserToday(); // sparing gracza: rozgrywany na żywo (js/sparing.js)
  if (spar) return { stop: 'sparing', sparing: spar };
  const fresh = Object.values(G.messages).filter(m => Number(m.id.slice(1)) >= before).sort(by(m => Number(m.id.slice(1))));
  if (fresh.length) return { stop: 'message', message: fresh.find(m => m.stop) || fresh[0], count: fresh.length };
  const evs = clubEventsOn(G.date);
  if (evs.length) return { stop: 'event', event: evs[0] };
  return { stop: 'day' };
}
// Zawody danego dnia, w których startują zawodnicy, adepci lub drużyna klubu gracza
function clubEventsOn(date, clubId = G.clubId) {
  const mine = id => { const x = G.riders[id] || G.academy[id]; return !!x && x.clubId === clubId; };
  return Object.values(G.events).filter(ev => {
    if (ev.date !== date || ev.played || ev.cancelled || ev.kind === 'mini-info') return false;
    if (ev.kind === 'sgp') return !!(G.sgp && G.sgp.season === ev.season && G.sgp.riders.some(mine));
    if (ev.comp === 'EXAM') return typeof examMine === 'function' && examMine(ev, clubId).length > 0; // egzamin naszego adepta
    return (ev.units || []).some(u => u.clubId === clubId) || (ev.startList || []).some(x => mine(x.id));
  });
}
function processDay(date) {
  if (typeof orgDay === 'function') orgDay(date); // memoriały: zaproszenia i odpowiedzi zawodników (js/memorial.js)
  if (typeof campDay === 'function') campDay(date); // obozy przygotowawcze (js/camps.js)
  if (typeof sparingDay === 'function') sparingDay(date); // sparingi przed sezonem: odpowiedzi, plan klubów AI, mecze (js/sparing.js)
  if (typeof scheduleBeforeRaces === 'function') scheduleBeforeRaces(date); // podróże, ligi zagraniczne, sparingi (js/schedule.js)
  for (const f of Object.values(G.fixtures).filter(f => f.date === date && !f.played)) {
    if (f.homeId === G.clubId || f.awayId === G.clubId) {
      const m = G.matches[f.matchId] || createMatch(f);
      simulateMatch(m);
    } else simulateMatch(createMatch(f));
    afterFixture(f);
  }
  for (const ev of Object.values(G.events).filter(e => e.date === date && !e.played && e.kind !== 'mini-info')) { if (ev.kind === 'comp') simulateComp(ev); else simulateGp(ev); if (typeof eventGate === 'function') eventGate(ev); if (typeof orgPayout === 'function') orgPayout(ev); if (typeof recordEventHonours === 'function') recordEventHonours(ev); } // sukcesy od razu po ostatnich zawodach rozgrywek
  if (typeof scheduleAfterRaces === 'function') scheduleAfterRaces(date); // dziennik startów (rytm zawodów), powroty do bazy
  if (typeof planDay === 'function') planDay(date); // jednostki treningowe z planu gracza, zimowe starty za granicą (js/planner.js)
  if (typeof scoutDay === 'function') scoutDay(date); // zlecenia skautingu: obserwacje na zawodach dnia (js/scouting.js)
}
function newDay() {
  const d = G.date, day = Number(d.slice(8, 10)), month = Number(d.slice(5, 7));
  // regeneracja i leczenie
  for (const r of Object.values(G.riders)) {
    if (r.retired) continue;
    const physio = r.clubId ? staffBest(r.clubId, 'physio') : 8;
    // regeneracja: atrybut Regeneracja, fizjoterapeuta; w dniu podróży o połowę wolniej
    r.cond = clamp(r.cond + (2 + (r.attrs.recovery ?? 10) * 0.12 + physio * 0.1) * (r.trav && dayDiff(r.trav, d) <= 1 ? 0.5 : 1), 0, 100);
    if (r.injury) {
      const inj = G.injuries[r.injury];
      if (!inj || d >= inj.until) {
        if (inj) inj.healed = true;
        r.injury = null; r.cond = Math.min(r.cond, 80);
        if (r.clubId === G.clubId) addMsg({ category: 'medyczne', from: 'Lekarz klubowy', title: `${r.name} wraca do jazdy`, body: `<p>${esc(r.name)} jest już zdrowy i gotowy do startów.</p>`, link: `#/zawodnik/${r.id}` });
      }
    }
    // sprzęt: przeglądy u tunera, powroty z remontu, bieżąca obsługa przez mechaników (js/equipment.js)
    if (typeof equipmentDay === 'function') equipmentDay(r);
  }
  if (dow(d) === 0) { weeklyDevelopment(); if (typeof foreignLicences === 'function') foreignLicences(); if (typeof trialsWeekly === 'function') trialsWeekly(); } // licencje zagranicznych adeptów, raporty z treningów próbnych
  if (d.slice(5) === '03-01' && typeof youthYearly === 'function') youthYearly(); // znane nazwiska w szkółkach, adepci z zagranicy (js/intake.js)
  if (typeof trainingDay === 'function') trainingDay();
  if (typeof staffContractsDay === 'function') staffContractsDay(); // przypomnienia o kończących się umowach sztabu
  if (typeof fimDay === 'function') fimDay(); // decyzja FIM o zawieszonych federacjach (js/nationality.js)
  if (typeof managerChildrenDay === 'function') managerChildrenDay(); // dzieci menedżera: szkółka od 5. urodzin (js/manager.js)
  // po zimowych transferach: ligi zagraniczne według nowego klubu
  if (d.slice(5) === '03-01' && typeof ensureForeignSeason === 'function') { G.flSeason = null; ensureForeignSeason(G.season); }
  if (typeof financeDay === 'function') financeDay();
  if (typeof boardDay === 'function') boardDay(); // zmiany we władzach klubów (js/board.js)
  if (day === 1 && typeof equipmentMonthly === 'function') equipmentMonthly(); // budżety sprzętowe, zakupy, zimowy wybór tunera
  if (day === 1 && typeof moraleMonthly === 'function') moraleMonthly(); // role w drużynie: obietnica startów i morale (js/roles.js)
  if (day === 1) { monthlyFinance(); monthlyAcademy(); if (typeof scXpMonthly === 'function') scXpMonthly(); for (const r of Object.values(G.riders)) if (r.active && !r.retired) { r.hist.push({ d, s: round2(r.skill) }); if (r.hist.length > 120) r.hist.shift(); } if (typeof monthlyAttrHist === 'function') monthlyAttrHist(); }
  if (d.endsWith('-12-31') && typeof licYearEnd === 'function') licYearEnd(); // licencje: min. 5 biegów w roku (js/rider-licence.js)
  if (d === `${G.season}-10-15`) seasonEnd();
  if (d === `${G.season}-11-01` && G.seasonClosed === G.season) newSeason();
  if (d === `${G.season}-09-01`) dormantDecisions(); // kluby uśpione: decyzja o reaktywacji
  if (dow(d) === 6 && typeof aiWarsawWeek === 'function') aiWarsawWeek(); // kontrakty warszawskie klubów uśpionych
  checkPlayoffs();
  marketDay(); // rynek: negocjacje, okienka, kluby AI (js/market.js)
  if (typeof announceStartLists === 'function') announceStartLists();
}

// ---------- Rozwój ----------
// Silnik rozwoju (js/ability.js): CA dąży do PA × krzywa wieku (z indywidualnym dojrzewaniem), tempo zależy od
// środowiska (trener, obiekty, starty, sprzęt) i charakteru; po 30. roku życia starzenie zależne od odporności, regeneracji i profesjonalizmu.
function weeklyDevelopment() {
  for (const r of Object.values(G.riders)) {
    if (r.retired || (!r.active && !r.clubId) || r.ca == null) continue; // licencja wygasła: trenuje dalej, jeśli ma klub
    const focus = r.focus && FOCUS[r.focus] ? FOCUS[r.focus].attrs : null;
    developWeek(r, devEnvRider(r), focus);
  }
  for (const k of Object.values(G.academy)) {
    if (k.catalogOnly || k.retired) continue;
    if (k.ca == null) initKidAbility(k, null);
    developWeek(k, devEnvKid(k), null);
    k.ability = k.ca;
  }
  // obserwowani zawodnicy: sztab poznaje ich coraz lepiej (ocena talentu skautów)
  G.scout = G.scout || {};
  const J = judgingOf(G.clubId);
  for (const id of G.shortlist) G.scout[id] = Math.min(0.35, (G.scout[id] || 0) + 0.012 + J / 700);
}

// ---------- Finanse ----------
// Księgowanie, prognozy, sponsorzy, miasto, kredyty i licencja: js/finance.js

// ---------- Szkółka ----------
// Progi CA awansu do wyższej klasy pojemności
const CAT_UP_CA = { c50: 6, c85: 12, c250: 18 };
function monthlyAcademy() {
  if (typeof kidLicMonthly === 'function') kidLicMonthly(); // koniec ważności certyfikatu / licencji 250 cm³
  if (typeof academyIntakeMonthly === 'function') academyIntakeMonthly(); // nabór: pojedyncze dzieci na treningach próbnych, rezygnacje (js/intake.js)
  if (typeof adeptsMonthly === 'function') adeptsMonthly(); // zagraniczni adepci – licencja w swoim kraju
  for (const k of Object.values(G.academy)) {
    if (k.catalogOnly || k.ca == null) continue;
    const age = ageAt(k.born, G.date);
    k.progress.push({ d: G.date, a: round1(k.ca) });
    if (k.progress.length > 36) k.progress.shift();
    const ci = ACADEMY_CATS.findIndex(x => x.id === k.cat);
    const next = ACADEMY_CATS[ci + 1];
    // awans na trening w wyższej klasie od jej wieku treningowego (także przed certyfikatem / egzaminem – starty dopiero z licencją);
    // własny klub: awans automatyczny tylko adeptów, których gracz nie przenosi ręcznie (k.catManual)
    if (next && age >= next.ages[0] && k.ca >= (CAT_UP_CA[k.cat] || 99) && !(k.clubId === G.clubId && k.catManual)) {
      k.cat = next.id;
      if (k.clubId === G.clubId) addMsg({ category: 'szkółka', from: 'Trener szkółki', title: `${k.name} awansuje do klasy ${next.cc}`, body: `<p>${esc(k.name)} (${age} lat) robi postępy i przechodzi do klasy <b>${next.name}</b>.</p>`, link: '#/szkolka' });
    }
  }
}
function licenceExam(kidId) {
  const k = G.academy[kidId];
  const age = ageAt(k.born, G.date);
  if ((k.country || 'POL') !== 'POL') return { ok: false, text: `${k.name} zdobywa licencję w swoim kraju (${COUNTRY[k.country] || k.country}), nie na egzaminie PZM.` };
  if (k.cat !== 'c500' || age < 15) return { ok: false, text: 'Do egzaminu na licencję Ż można zgłosić adepta klasy 500R, który skończył 15 lat.' };
  if (!examCandidate(k)) return { ok: false, text: 'Adept niedawno podchodził do egzaminu – kolejne podejście na późniejszej sesji.' };
  k.examTried = G.season; k.examLast = G.date;
  addTx(k.clubId, 'szkółka', -3500, `Egzamin licencyjny: ${k.name}`);
  if (!chance(examChance(k))) return { ok: false, text: `${k.name} nie zdał egzaminu na licencję. Może podejść ponownie za ok. 2 miesiące.` };
  const id = G.seq.rider = (G.seq.rider || 20001) + 1;
  const r = riderFromKid(k, id);
  r.contract = firstContract(r, k.clubId);
  G.riders[id] = r;
  delete G.academy[kidId];
  if (typeof moveAttrHist === 'function') moveAttrHist(kidId, id);
  addMsg({ category: 'szkółka', from: 'Trener szkółki', title: `${r.name} z licencją żużlową!`, body: `<p>${esc(r.name)} zdał egzamin i dołącza do kadry pierwszej drużyny jako junior na kontrakcie amatorskim (stypendium).</p><p><b>Przypisz mu rolę w drużynie</b> w profilu zawodnika.</p>`, link: `#/zawodnik/${id}`, stop: true });
  return { ok: true, text: `${r.name} zdał egzamin! Dołącza do pierwszej drużyny.`, riderId: id };
}

// ---------- Play-off ----------
function aggregate(f1, f2) {
  const a = {}; for (const f of [f1, f2]) { a[f.homeId] = (a[f.homeId] || 0) + f.homePts; a[f.awayId] = (a[f.awayId] || 0) + f.awayPts; }
  return a;
}
function tieWinner(f1, f2, hi) {
  const a = aggregate(f1, f2), [x, y] = Object.keys(a).map(Number);
  if (a[x] !== a[y]) return a[x] > a[y] ? x : y;
  // bieg dodatkowy: najlepsi zawodnicy obu drużyn w rewanżu
  const m = G.matches[f2.matchId];
  const best = t => Object.entries(m.riders).filter(([id, s]) => s.team === t && !G.riders[id].injury).sort(by(([, s]) => s.pts, -1))[0];
  const bh = best('H'), ba = best('A');
  if (!bh || !ba) return hi;
  const h = runHeat([{ riderId: Number(bh[0]), team: 'H', gate: 'A', helmet: 'czerwony' }, { riderId: Number(ba[0]), team: 'A', gate: 'B', helmet: 'biały' }], { homeClubId: m.homeId, weather: m.weather, track: m.track, team: true, mid: m.id + '-dod', surf: m.surf, know: m.know });
  f2.runoff = { winner: h.res[0].riderId, riders: [Number(bh[0]), Number(ba[0])], log: h.log, time: h.time };
  return h.res[0].team === 'H' ? m.homeId : m.awayId;
}
function afterFixture(f) {
  if (f.stage === 'RS') return;
  const pair = Object.values(G.fixtures).find(x => x.season === f.season && x.league === f.league && x.stage === f.stage && x.tie === f.tie && x.id !== f.id);
  if (!pair || !pair.played || f.leg !== 2) return;
  f.tieWinner = tieWinner(pair, f, f.homeId);
  pair.tieWinner = f.tieWinner;
}
// Baraż o miejsce w wyższej lidze: przedostatni zespół sezonu zasadniczego wyższej ligi – przegrany finału niższej ligi
const LOWER = { PGE: '2E', '2E': 'KLZ' };
// Kluby zagraniczne (Lokomotiv Daugavpils, Landshut) jeżdżą tylko w KLŻ: regulamin KLŻ uznaje u nich za „krajowych” zawodników ich kraju,
// a regulaminy 2. Ekstraligi i Ekstraligi takiego wyjątku nie mają (min. 4 krajowych z licencją PZM; licencja Ekstraligi Żużlowej) – bez prawa awansu
const canPromoteTo = (clubId, league) => league === 'KLZ' || clubNation(clubId) === 'POL';
const promotable = (lower, upper, season = G.season) => finalStandings(lower, season).filter(id => canPromoteTo(id, upper));
function barazDates(season, lg) {
  const f2 = playoffDates(season, LOWER[lg]).f2;
  return realSeason(season) ? [`${season}-09-27`, `${season}-10-04`] : [addDays(f2, 7), addDays(f2, 14)];
}
function checkBaraz() {
  for (const [upper, lower] of Object.entries(LOWER)) {
    const ufx = seasonFixtures(upper), lfx = seasonFixtures(lower);
    if (ufx.some(f => f.stage === 'BZ') || !ufx.some(f => f.stage === 'RS') || ufx.some(f => f.stage === 'RS' && !f.played)) continue;
    const lf2 = lfx.find(f => f.stage === 'F' && f.leg === 2);
    if (!lf2 || !lf2.tieWinner) continue;
    const t = leagueTable(upper).map(r => r.clubId);
    // do barażu: przegrany finału niższej ligi; gdy w finale był klub bez prawa awansu – kolejny uprawniony w końcowej kolejności
    const up = t[t.length - 2], loser = lf2.tieWinner === lf2.homeId ? lf2.awayId : lf2.homeId, elig = promotable(lower, upper);
    const low = canPromoteTo(lf2.tieWinner, upper) && canPromoteTo(loser, upper) ? loser : elig[1];
    if (!up || !low) continue;
    const [d1, d2] = barazDates(G.season, upper);
    for (const [leg, date, h, a] of [[1, d1, low, up], [2, d2, up, low]]) {
      const id = `F${G.season}-${upper}-BZ1-${leg}`;
      G.fixtures[id] = { id, season: G.season, league: upper, stage: 'BZ', tie: 1, leg, round: null, date, homeId: h, awayId: a, played: false, homePts: null, awayPts: null };
    }
    if ([up, low].includes(G.clubId)) addMsg({ category: 'liga', from: 'GKSŻ', stop: true, title: `Baraż o ${LEAGUES[upper].name}: ${G.clubs[up].short} – ${G.clubs[low].short}`,
      body: `<p>Dwumecz barażowy: ${esc(G.clubs[low].name)} – ${esc(G.clubs[up].name)} (${fmtDate(d1)}) i rewanż (${fmtDate(d2)}). Zwycięzca wystąpi w ${LEAGUES[upper].name} w przyszłym sezonie.</p>`, link: '#/liga/terminarz' });
  }
}
function checkPlayoffs() {
  checkBaraz();
  for (const lg of LEAGUE_ORDER) {
    const dates = playoffDates(G.season, lg);
    const fx = seasonFixtures(lg);
    const rs = fx.filter(f => f.stage === 'RS');
    if (!rs.length || rs.some(f => !f.played)) continue;
    const mk = (stage, tie, leg, date, h, a) => {
      const id = `F${G.season}-${lg}-${stage}${tie}-${leg}`;
      if (!G.fixtures[id]) G.fixtures[id] = { id, season: G.season, league: lg, stage, tie, leg, round: null, date, homeId: h, awayId: a, played: false, homePts: null, awayPts: null };
    };
    if (!fx.some(f => f.stage === 'SF')) {
      const t = leagueTable(lg).map(r => r.clubId);
      mk('SF', 1, 1, dates.sf1, t[3], t[0]); mk('SF', 1, 2, dates.sf2, t[0], t[3]);
      mk('SF', 2, 1, dates.sf1, t[2], t[1]); mk('SF', 2, 2, dates.sf2, t[1], t[2]);
      const me = t.indexOf(G.clubId);
      if (myClub().league === lg) {
        addMsg({ category: 'liga', from: LEAGUES[lg].name, stop: true, title: me >= 0 && me < 4 ? `Awans do play-off! (${me + 1}. miejsce)` : `Koniec sezonu zasadniczego – ${me + 1}. miejsce`,
          body: `<p>Półfinały: <b>${esc(G.clubs[t[0]].name)}</b> – ${esc(G.clubs[t[3]].name)}, <b>${esc(G.clubs[t[1]].name)}</b> – ${esc(G.clubs[t[2]].name)}.</p><p>Pierwsze mecze ${fmtDate(dates.sf1)}, rewanże ${fmtDate(dates.sf2)} (u drużyny wyżej w tabeli).</p>`, link: '#/liga/terminarz' });
      }
      continue;
    }
    const sf = fx.filter(f => f.stage === 'SF');
    if (sf.every(f => f.played && f.tieWinner) && !fx.some(f => f.stage === 'F')) {
      const t = leagueTable(lg).map(r => r.clubId);
      const w1 = sf.find(f => f.tie === 1).tieWinner, w2 = sf.find(f => f.tie === 2).tieWinner;
      const l1 = [t[0], t[3]].find(x => x !== w1), l2 = [t[1], t[2]].find(x => x !== w2);
      const [hiW, loW] = t.indexOf(w1) < t.indexOf(w2) ? [w1, w2] : [w2, w1];
      const [hiL, loL] = t.indexOf(l1) < t.indexOf(l2) ? [l1, l2] : [l2, l1];
      mk('F', 1, 1, dates.f1, loW, hiW); mk('F', 1, 2, dates.f2, hiW, loW);
      mk('B', 1, 1, dates.f1, loL, hiL); mk('B', 1, 2, dates.f2, hiL, loL);
      if (myClub().league === lg) addMsg({ category: 'liga', from: LEAGUES[lg].name, title: `Finał: ${G.clubs[hiW].name} – ${G.clubs[loW].name}`, body: `<p>O brązowy medal: ${esc(G.clubs[hiL].name)} – ${esc(G.clubs[loL].name)}.</p>`, link: '#/liga/terminarz', stop: [hiW, loW, hiL, loL].includes(G.clubId) });
    }
  }
}
function finalStandings(lg, season = G.season) {
  const fx = seasonFixtures(lg, season);
  const table = leagueTable(lg, season).map(r => r.clubId);
  const tieOf = st => { const f = fx.find(x => x.stage === st && x.leg === 2); return f && f.tieWinner ? [f.tieWinner, f.tieWinner === f.homeId ? f.awayId : f.homeId] : null; };
  const fin = tieOf('F'), br = tieOf('B');
  const order = fin && br ? [...fin, ...br, ...table.filter(id => ![...fin, ...br].includes(id))] : table;
  return order;
}

// ---------- Koniec sezonu i nowy sezon ----------
function seasonEnd() {
  if (G.seasonClosed === G.season) return;
  G.seasonClosed = G.season;
  const moves = [];
  const results = {};
  for (const lg of LEAGUE_ORDER) {
    const order = finalStandings(lg);
    results[lg] = order;
    order.forEach((id, i) => {
      const c = G.clubs[id];
      const label = i === 0 ? 'Mistrz' : i === 1 ? 'Wicemistrz' : i === 2 ? 'Brązowy medal' : `${i + 1}. miejsce`;
      const top = clubRiders(id).filter(r => r.stats[G.season]).sort(by(r => { const s = r.stats[G.season]; return s.heats ? (s.pts + s.bonus) / s.heats : 0; }, -1))[0];
      const coach = id === G.clubId ? null : clubStaff(id).find(s => s.role === 'coach'); // menedżer drużyny: gracz albo główny trener AI
      c.history.push({ season: G.season, league: lg, pos: i + 1, label, top: top ? top.name : null, manager: id === G.clubId ? G.manager.name : coach ? coach.name : null });
    });
  }
  // awanse i spadki
  const swap = (upper, lower) => {
    const down = results[upper][results[upper].length - 1], up = results[lower].find(id => canPromoteTo(id, upper));
    if (results[lower][0] && results[lower][0] !== up) moves.push([results[lower][0], lower, 'mistrz bez prawa awansu (klub zagraniczny)']);
    if (down && up) { G.clubs[down].league = lower; G.clubs[up].league = upper; moves.push([up, upper, 'awans'], [down, lower, 'spadek']); }
  };
  swap('PGE', '2E'); swap('2E', 'KLZ');
  // baraże: zwycięzca z niższej ligi zamienia się miejscem z drużyną z wyższej
  for (const [upper, lower] of Object.entries(LOWER)) {
    const b2 = seasonFixtures(upper).find(f => f.stage === 'BZ' && f.leg === 2);
    if (!b2 || !b2.tieWinner) continue;
    const upTeam = b2.homeId, lowTeam = b2.awayId;
    if (b2.tieWinner === lowTeam && G.clubs[upTeam].league === upper && G.clubs[lowTeam].league === lower) {
      G.clubs[upTeam].league = lower; G.clubs[lowTeam].league = upper;
      moves.push([lowTeam, upper, 'awans (baraż)'], [upTeam, lower, 'spadek (baraż)']);
    }
  }
  // potencjał: dryf talentu młodych i przełomowe sezony (js/ability.js)
  // cechy ukryte: powolne zmiany profesjonalizmu, powtarzalności i ambicji (js/training.js)
  if (typeof seasonHiddenEvents === 'function') { for (const r of Object.values(G.riders)) if (!r.retired && r.active && r.ca != null) seasonHiddenEvents(r); for (const k of Object.values(G.academy)) if (!k.catalogOnly && k.ca != null) seasonHiddenEvents(k); }
  if (typeof juniorRetirements === 'function') juniorRetirements(); // juniorzy z małą liczbą startów i niskimi zarobkami (js/adepts.js)
  if (typeof foreignRetirements === 'function') foreignRetirements(); // obcokrajowcy po 40. roku życia z dużym spadkiem formy (js/adepts.js)
  if (typeof ownVeteranIntents === 'function') ownVeteranIntents(); // weterani naszego klubu: zapowiedź końca kariery (js/adepts.js)
  for (const r of Object.values(G.riders)) if (!r.retired && r.ca != null) seasonPaEvents(r, (r.stats[G.season] || {}).heats || 0);
  for (const k of Object.values(G.academy)) if (!k.catalogOnly && k.ca != null) seasonPaEvents(k, 0);
  // kariera zawodników
  for (const r of Object.values(G.riders)) {
    const s = r.stats[G.season];
    if (s && (s.heats || s.gp)) r.career.push({ season: G.season, clubId: r.clubId, league: r.clubId ? results && Object.keys(results).find(l => results[l].includes(r.clubId)) : null, m: s.m, heats: s.heats, pts: s.pts, bonus: s.bonus, avg: s.heats ? round2((s.pts + s.bonus) / s.heats) : 0, gp: s.gp, gpPts: s.gpPts,
      ...(s.p1 != null ? { p1: s.p1, p2: s.p2, p3: s.p3, p4: s.p4, tape: s.tape } : seasonPlaceStats(r, G.season)), def: s.def, falls: s.falls, exc: s.exc });
  }
  for (const k of new Set(Object.values(G.events).filter(e => e.season === G.season && (e.kind === 'sgp' || (e.kind === 'comp' && compOf(e).series))).map(e => (e.kind === 'sgp' ? 'SGP' : compKey(e))))) finalizeSeries(k, G.season); // cykle z odwołaną ostatnią rundą
  if (typeof recordSeasonHonours === 'function') recordSeasonHonours(G.season, results); // medale i czołowe miejsca sezonu (js/honours-game.js)
  // Grand Prix – mistrz świata
  const sgpOrder = seriesOrder('SGP', G.season); // z biegiem dodatkowym o tytuł (js/ties.js)
  G.history.push({ season: G.season, champions: Object.fromEntries(LEAGUE_ORDER.map(l => [l, results[l][0]])), world: sgpOrder.length ? Number(sgpOrder[0]) : null, moves });
  marketSeasonEnd(results, moves); // premie z kontraktów za medal / awans
  if (typeof staffBonuses === 'function') staffBonuses(results, moves); // premie sztabu (js/staff-contracts.js)
  finSeasonEnd(results); // nagrody, Pro Junior, Fundusz Atrakcyjności, fundusz rezerwowy, premie sponsorów (js/finance.js)
  if (typeof aiCoachSeasonEnd === 'function') aiCoachSeasonEnd(results); // kluby AI poniżej celu zmieniają menedżera (js/board.js)
  if (typeof jobless === 'function' && jobless()) return; // gracz bez pracy – bez oceny zarządu
  // ocena zarządu
  const me = myClub();
  const myLg = Object.keys(results).find(l => results[l].includes(me.id));
  if (!myLg) return;
  const pos = results[myLg].indexOf(me.id) + 1;
  const ok = pos <= me.objective.minPos;
  if (typeof boardConf === 'function') boardConf((ok ? 15 : -20) + (pos === 1 ? 15 : 0), `Sezon ${G.season}: ${pos}. miejsce – cel ${ok ? 'zrealizowany' : 'niezrealizowany'}`);
  else G.board.confidence = clamp(G.board.confidence + (ok ? 15 : -20) + (pos === 1 ? 15 : 0), 0, 100);
  if (typeof boardSeasonEnd === 'function') boardSeasonEnd(ok); // zwolnienie po drugim nieudanym sezonie (js/board.js)
  const myMove = moves.find(x => x[0] === me.id);
  addMsg({ category: 'zarząd', from: `Zarząd ${me.name}`, stop: true, title: `Podsumowanie sezonu ${G.season}: ${pos}. miejsce`,
    body: `<p>Zakończyliśmy sezon na <b>${pos}. miejscu</b> w ${LEAGUES[myLg].name}. Cel: ${me.objective.text} – <b class="${ok ? 'pos' : 'neg'}">${ok ? 'zrealizowany' : 'niezrealizowany'}</b>.</p>
      ${myMove ? `<p><b>${myMove[2].startsWith('awans') ? 'Awansowaliśmy' : 'Spadamy'} do ${LEAGUES[myMove[1]].name}${myMove[2].includes('baraż') ? ' (po barażu)' : ''}!</b></p>` : ''}
      <p>Mistrz świata (Grand Prix): <b>${sgpOrder.length ? esc(G.riders[sgpOrder[0]].name) : '—'}</b>.</p>
      <p>Zaufanie zarządu: ${Math.round(G.board.confidence)}%. 1 listopada wygasają kontrakty kończące się w tym sezonie i wchodzą w życie prekontrakty; okienka transferowe: 16–20 listopada i 22–31 grudnia.</p>`, link: '#/klub/historia' });
}
function newSeason() {
  const old = G.season;
  G.season++;
  marketRollover(); // koniec wypożyczeń, prekontrakty, kwoty kontraktów na nowy sezon
  if (typeof finalizeRetireIntents === 'function') finalizeRetireIntents(); // zapowiedziany koniec kariery bez nowej umowy (js/adepts.js)
  // wygasające kontrakty, emerytury
  const freed = [];
  for (const r of Object.values(G.riders)) {
    const age = riderAge(r);
    const signed = r.contract && r.contract.until >= G.season; // kontrakt na nowy sezon – zawodnik jeździ dalej
    if (!r.retired && !signed && ((!r.active && !r.clubId && typeof licQuitChance === 'function' && chance(licQuitChance(r))) || age >= 43 || (age >= 38 && r.skill < 8 && chance(0.4)) || (age >= 30 && r.skill < 4.2 && chance(0.3)))) {
      if (r.clubId === G.clubId) addMsg({ category: 'transfer', from: 'Sekretariat', title: `${r.name} kończy karierę`, body: `<p>${esc(r.name)} (${age} lat) ogłosił zakończenie kariery.</p>` });
      r.retired = true; r.retiredOn = String(G.season - 1); r.active = false; r.clubId = null; r.contract = null; continue;
    }
    if (r.contract && r.contract.until < G.season) {
      if (r.clubId === G.clubId) freed.push(r);
      r.prevClubId = r.clubId; r.clubId = null; r.contract = null;
    }
    r.form *= 0.4;
    r.listed = false;
  }
  if (freed.length) addMsg({ category: 'transfer', from: 'Sekretariat', stop: true, title: `Wygasły kontrakty (${freed.length})`, body: `<p>Z klubem pożegnali się: ${freed.map(r => `<a href="#/zawodnik/${r.id}">${esc(r.name)}</a>`).join(', ')}.</p><p>Zawodnicy są teraz wolni – możesz spróbować podpisać ich ponownie.</p>` });
  // młodzi zawodnicy w klubach AI (wychowankowie)
  for (const c of Object.values(G.clubs)) {
    if (c.id === G.clubId) continue;
    const n = rint(0, 2);
    for (let i = 0; i < n; i++) {
      const id = G.seq.rider = (G.seq.rider || 20001) + 1;
      const country = c.city === 'Daugavpils' ? 'LAT' : c.city === 'Landshut' ? 'GER' : 'POL';
      const r = newRider({ id, name: genName(country), country, born: G.season - 16, skill: round2(3 + rnd() * 2), potential: clamp(Math.round(62 + gauss(12)), 35, 97), profile: 'wychowanek – świeża licencja', certainty: 'gra', activity: [], lastSeason: G.season }, G.date);
      r.clubId = c.id; r.academyGraduate = true;
      r.licence = { number: null, team: c.city, date: G.date, place: '' }; // świeża licencja „Ż” (pkt 27 – ważna także w następnym roku)
      r.contract = firstContract(r, c.id);
      G.riders[id] = r;
    }
  }
  // szkółka: nabór i odejścia
  // adepci po 19. roku życia bez licencji: wolni (jeśli dalej chcą się ścigać) albo koniec kariery – zostają w bazie (js/adepts.js)
  if (typeof adeptsNewSeason === 'function') adeptsNewSeason();
  else for (const k of Object.values(G.academy)) if (ageAt(k.born, G.date) > 19) delete G.academy[k.id];
  // budżety na nowy sezon
  for (const c of Object.values(G.clubs)) {
    const last = c.history[c.history.length - 1];
    const lgF = { PGE: 1, '2E': 0.45, KLZ: 0.2 }[c.league];
    const prevF = { PGE: 1, '2E': 0.45, KLZ: 0.2 }[c.prevLeague || (last ? last.league : c.league)];
    delete c.prevLeague;
    // klub AI przeznacza połowę nadwyżki ponad rezerwę (12% budżetu) na kolejny sezon, a zadłużony tnie budżet o połowę długu
    const adj = c.id !== G.clubId ? clamp((c.cash - c.budget * 0.12) * 0.5 - (c.fin && c.fin.rescued || 0), -c.budget * 0.3, c.budget * 0.3) : 0;
    if (c.fin) delete c.fin.rescued;
    c.budget = Math.round(Math.max(c.budget * 0.6, c.budget * Math.sqrt(lgF / prevF) * (1 + (last && last.pos <= 2 ? 0.06 : 0)) + adj) / 100000) * 100000;
    c.objective = boardObjective(c);
    c.stadium.ticket = LEAGUES[c.league].ticket;
    if (typeof ticketsNewSeason === 'function') ticketsNewSeason(c); // cenniki: AI wraca do wyjściowych (js/stadium.js)
  }
  applyRealLeagues(G.season);
  if (typeof rescaleStaffWages === 'function') rescaleStaffWages(); // awanse i spadki zmieniają stawki sztabu
  if (typeof aiJuniorRelease === 'function') aiJuniorRelease(G.season); // nadmiar juniorów w klubach AI
  if (typeof rolesAssign === 'function') for (const c of Object.values(G.clubs)) rolesAssign(c, G.season, c.id !== G.clubId); // role na nowy sezon (kluby AI – od nowa wg składu)
  if (typeof budgetRenegotiate === 'function') { for (const c of Object.values(G.clubs)) { const al = c.fin && c.fin.alloc && c.fin.alloc[G.season]; if (al && al.academy != null) c.academyBudget = al.academy; } budgetRenegotiate(G.season); } // budżety: szkółka wg planu, renegocjacje klubów AI ponad budżetem
  finNewSeason(); // sponsorzy: odnowienia, rozmowy o przedłużeniu, zmiany nazw drużyn (js/finance.js)
  // kluby, które nie startują w sezonie – zawodnicy odchodzą jako wolni
  for (const c of Object.values(G.clubs)) {
    if (c.dormant) {
      // klub uśpiony: startuje dopiero w sezonie wskazanym przy decyzji o reaktywacji
      if (c.activeFrom && c.activeFrom <= G.season) {
        delete c.dormant; delete c.inactive; delete c.activeFrom; c.reactivated = G.season; c.league = 'KLZ'; c.stadium.ticket = LEAGUES.KLZ.ticket; c.objective = boardObjective(c);
        if (typeof aiReplaceSponsor === 'function') { aiReplaceSponsor(c, null); aiReplaceSponsor(c, { perYear: c.budget * 0.03, assets: { banner: 1 }, kind: 'partner' }); }
        addMsg({ category: 'liga', from: 'GKSŻ', title: `${c.name} wraca do rozgrywek`, body: `<p><b>${esc(c.name)}</b> po reaktywacji startuje w ${LEAGUES.KLZ.name} w sezonie ${G.season}.</p>`, link: `#/zespol/${c.id}` });
      } else c.inactive = G.season;
    } else if (c.inactive && c.inactive < G.season) {
      // powrót po przerwie (np. po odmowie licencji) – od najniższej ligi
      if (c.joinChance == null || chance(c.joinChance)) {
        delete c.inactive; c.league = 'KLZ'; c.stadium.ticket = LEAGUES.KLZ.ticket;
        addMsg({ category: 'liga', from: 'GKSŻ', title: `${c.name} w rozgrywkach ligowych`, body: `<p><b>${esc(c.name)}</b> zgłosił drużynę do rozgrywek ${LEAGUES.KLZ.name} w sezonie ${G.season}.</p>`, link: `#/zespol/${c.id}` });
      } else c.inactive = G.season;
    }
    if (clubActive(c)) continue;
    for (const r of clubRiders(c.id)) { if (r.contract && r.contract.kind === 'warszawski' && r.contract.until >= G.season) continue; r.prevClubId = c.id; r.clubId = null; r.contract = null; }
    for (const s of clubStaff(c.id)) if (!s.player) s.clubId = null; // klub uśpiony nie ma sztabu
  }
  makeLeagueFixtures(G.season);
  if (typeof ensureForeignSeason === 'function') ensureForeignSeason(G.season, true); // ligi zagraniczne: limit GKSŻ, terminy (js/schedule.js)
  if (typeof nationsNewSeason === 'function') nationsNewSeason(); // powołania do kadr narodowych (js/nations.js)
  if (!G.sgp || G.sgp.season !== G.season) makeSgp(G.season);
  makeCompEvents(G.season);
  if (typeof makeForeignChampEvents === 'function') makeForeignChampEvents(G.season); // mistrzostwa krajowe za granicą (js/foreign.js)
  if (typeof staffContractsNewSeason === 'function') staffContractsNewSeason(); // wygasające umowy sztabu (js/staff-contracts.js)
  // kontrakt menedżera gracza: po wygaśnięciu zarząd przedłuża umowę o dwa sezony (o zwolnieniu decyduje zaufanie zarządu)
  const ps = G.manager && G.staff[G.manager.coachId];
  if (ps && ps.player && ps.until != null && ps.until < G.season) {
    ps.until = G.season + 1;
    addMsg({ category: 'zarząd', from: `Zarząd ${myClub().name}`, title: 'Przedłużenie umowy menedżera', body: `<p>Zarząd przedłużył Twoją umowę do końca sezonu ${ps.until} na dotychczasowych warunkach (${fmtMoney(ps.wage)} miesięcznie).</p>`, link: `#/osoba/${ps.id}/kontrakt` });
  }
  // skład z Taktyki zostaje na nowy sezon (bez zawodników, którzy odeszli lub nie spełniają już warunków numeru)
  for (const [cid, l] of Object.entries(G.lineups || {})) if (Array.isArray(l)) G.lineups[cid] = l.map((id, i) => { const r = G.riders[id]; return r && r.clubId === Number(cid) && slotOk(r, i, G.clubs[cid] && G.clubs[cid].league) ? id : null; });
  const me = myClub();
  addMsg({ category: 'zarząd', from: `Zarząd ${me.name}`, stop: true, title: `Sezon ${G.season} – nowe cele`, body: `<p>Liga: <b>${LEAGUES[me.league].name}</b>. Cel zarządu: <b>${me.objective.text}</b>. Budżet: ${fmtMoney(me.budget, true)}.</p>${squadReportHtml(me.id)}`, link: '#/druzyna' });
}

// ---------- Kluby uśpione: decyzja o reaktywacji (1 września) ----------
function dormantDecisions() {
  for (const c of Object.values(G.clubs)) {
    if (!c.dormant || c.activeFrom || !chance(c.joinChance || 0)) continue;
    c.activeFrom = G.season + 1; c.league = 'KLZ'; c.stadium.ticket = LEAGUES.KLZ.ticket; c.objective = boardObjective(c);
    addMsg({ category: 'liga', from: 'GKSŻ', stop: true, title: `${c.name} reaktywuje drużynę`, body: `<p><b>${esc(c.name)}</b> zgłosił drużynę do rozgrywek ${LEAGUES.KLZ.name} od sezonu ${c.activeFrom}. Klub może już podpisywać kontrakty na sezon ${c.activeFrom} (prekontrakty i okienko listopadowe).</p>`, link: `#/zespol/${c.id}` });
  }
}

// ---------- Kontrakty ----------
// Rynek, negocjacje, okienka i wypożyczenia: js/market.js
// Ile punktów (z bonusami) zawodnik zdobędzie w sezonie – do porównywania ofert
const LEAGUE_AVG_SKILL = { PGE: 11, '2E': 8.5, KLZ: 6.5 };
function expectedSeasonPoints(skill, lg = 'PGE') { return Math.round(clamp(1.45 + (skill - LEAGUE_AVG_SKILL[lg]) * 0.33, 0.3, 2.7) * 60); }
// Oczekiwania zawodnika wobec klubu (kwoty na sezon, długość umowy)
// Zawodnik bez kontraktu na nadchodzący sezon: od grudnia oczekiwania spadają o ok. 12% miesięcznie (najniżej 40%) – bez klubu nie zarobi nic
function freeAgentDiscount(r) {
  const S = sportSeason();
  const signed = (r.contract && r.contract.until >= S && r.contract.kind !== 'warszawski') || (r.nextContract && r.nextContract.from <= S);
  if (signed) return 1;
  const months = dayDiff(`${S - 1}-12-01`, G.date) / 30.4;
  return months <= 0 ? 1 : clamp(1 - 0.12 * months, 0.4, 1);
}
function riderAsk(r, clubId) {
  const c = G.clubs[clubId], age = riderAge(r);
  const est = estimateContract(r.skill, age, r.potential, c.league);
  let f = 1.05;
  const lvl = LEAGUES[c.league].level;
  if (lvl === 3 && r.skill >= 10) f *= 1.5;
  if (lvl === 2 && r.skill >= 12) f *= 1.35;
  f *= 1.1 - c.rep / 500;
  if (r.form > 1) f *= 1.08;
  f *= freeAgentDiscount(r);
  return { signing: Math.round(est.signing * f / 5000) * 5000, perPoint: Math.round(est.perPoint * f / 100) * 100, years: Math.min(age <= 21 ? 3 : age <= 26 ? 2 : 1, typeof youngMaxYears === 'function' ? youngMaxYears(r) : 9) };
}
function offerValue(o, skill) { return o.signing + o.perPoint * expectedSeasonPoints(skill, myClub().league); }
// Odstępne, jakiego klub oczekuje za zawodnika z ważnym kontraktem
function feeAsk(r) {
  const holder = r.contract ? r.contract.clubId : r.clubId;
  const yrs = r.contract ? Math.max(1, r.contract.until - sportSeason() + 1) : 1;
  const rank = clubRiders(holder).sort(by(x => x.skill, -1)).indexOf(r);
  const role = typeof roleOf === 'function' && TEAM_ROLES[roleOf(r)];
  return Math.round(riderValue(r) * (0.35 + 0.25 * yrs) * (role ? role.sell : rank >= 0 && rank < 3 ? 1.6 : 1) / 10000) * 10000; // rola w drużynie (js/roles.js)
}
// Rozwiązanie kontraktu za porozumieniem stron: zawodnik oczekuje części niewypłaconych pieniędzy
function releaseCost(riderId) {
  const r = G.riders[riderId], k = r.contract;
  if (!k || k.clubId !== G.clubId) return 0;
  if (longInjury(r)) return 0; // kontuzja ponad 9 miesięcy – klub może rozwiązać kontrakt bez kosztów (Zbiór Zasad §15)
  const S = G.season;
  if (k.kind === 'amatorski') return Math.round((k.stipend || 0) * 6);
  const now = termsFor(k, S);
  const paidN = k.paid && k.paid.season === S ? k.paid.n : 0;
  const rest = k.until >= S && k.from <= S ? now.signing * (6 - paidN) / 6 : 0;
  let future = 0;
  for (let y = Math.max(S + 1, k.from); y <= k.until; y++) future += termsFor(k, y).signing;
  return Math.round((rest * 0.5 + future * 0.3) / 1000) * 1000;
}
function releaseRider(riderId) {
  const r = G.riders[riderId];
  const left = releaseCost(riderId);
  addTx(G.clubId, 'kontrakty', -left, `Rozwiązanie kontraktu: ${r.name}`);
  for (const n of openNegs(riderId)) if (n.holderId === G.clubId) closeNeg(n, 'rejected', 'Kontrakt zawodnika został rozwiązany.', false);
  if (r.loan) endLoan(r, true);
  r.lastUntil = r.contract ? r.contract.until : r.lastUntil;
  r.prevClubId = r.clubId; r.clubId = null; r.contract = null; r.listed = false; r.loanListed = false;
  G.lineups[G.clubId] = (G.lineups[G.clubId] || []).map(x => (x === riderId ? null : x));
  return left;
}
// Zobowiązania kontraktowe klubu w bieżącym sezonie (podpis + szacowane punkty, kontrakty amatorskie, wypożyczeni)
function clubCommitments(c) { return sum(clubRiders(c.id).map(r => { const k = activeDeal(r); return k ? (k.kind === 'wypożyczenie' ? k.signing + k.perPoint * expectedSeasonPoints(r.skill, c.league) : dealSeasonCost(k, r, c.league)) : 0; })); }

// ---------- Sprzęt i infrastruktura ----------
const COSTS = { service: 7000, engine: 55000, mechanic: 60000, workshop: lvl => 350000 * lvl, academy: lvl => 250000 * lvl, training: lvl => 300000 * lvl, gym: lvl => 180000 * (lvl + 1), miniTrack: lvl => 220000 * (lvl + 1), seats: 1800 };
// Przegląd opłacony przez klub: silnik jedzie do tunera (kilka dni), wraca ze stanem 100%
function serviceEngine(riderId, engineId) {
  const r = G.riders[riderId], e = r.equip.engines.find(x => x.id === engineId);
  const owner = e.club; e.club = G.clubId; // koszt na klub (po ok. 100 biegach przegląd staje się remontem kapitalnym)
  sendToShop(r, e, 'svc');
  e.club = owner;
}
// Silnik kupiony przez klub u wybranego tunera – własność klubu (po odejściu zawodnika wraca do parku maszyn)
function buyEngine(riderId, tid) {
  const r = G.riders[riderId], t = tunerOf(tid || r.equip.tuner);
  const eng = newEngineFrom(r, t.id, G.clubId);
  const m = Number(G.date.slice(5, 7)); // zamówienie zimą – odbiór w marcu; później – 3–5 tygodni
  eng.job = 'new'; eng.away = m >= 11 || m === 1 ? `${raceSeason()}-03-${String(rint(5, 25)).padStart(2, '0')}` : addDays(G.date, rint(21, 35));
  addTx(G.clubId, 'sprzęt', -t.engine, `Nowy silnik (${t.name}) dla: ${r.name}`);
  r.equip.clubSupport += t.engine;
  return eng;
}
