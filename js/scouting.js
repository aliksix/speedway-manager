'use strict';
// Skauting: zlecenia obserwacji dla skauta albo trenera (trener – wolniej i mniej informacji, a każde zlecenie obniża
// skuteczność jego treningu do 75%). Rodzaje zleceń:
//  – zawodnik: obserwacja jego startów (bez startów – nagrania, wolniej); raport po 2–6 tygodniach,
//  – rozgrywki: liga (polska / zagraniczna), puchar albo cykl zawodów – wszyscy startujący, lista polecanych,
//  – kraj: dłuższy wyjazd (2–6 tygodni), wszystkie zawody w kraju; według profilu albo ogólnie,
//  – poszukiwanie: kryteria (rola, gwiazdki umiejętności i potencjału, wiek, budżet) – statystyki i nagrania, lista polecanych.
// Skaut prowadzi 2 zlecenia (wyjazd do kraju – tylko to jedno), trener – 1. Obserwacja odbywa się na prawdziwych zawodach dnia
// (liga polska, zawody, ligi zagraniczne); wyjazdy kosztują (przejazd albo lot, pobyt) – kategoria „skauting” w finansach.
// Raport: ocena skauta (przedziały gwiazdek – może się mylić, słaby skaut zawyża ocenę młodych), mocne i słabe strony, charakter,
// przedział punktów w sezonie u nas (siła rywali w naszej lidze) i koszt sezonu ze środka przedziału.
// Kluby AI oceniają zawodników własnym, obarczonym błędem okiem sztabu (js/ability.js: perceive z ich klubem).

const SC_TYPES = { rider: 'Zawodnik', comp: 'Rozgrywki', country: 'Kraj', search: 'Poszukiwanie' };
const SC_ROLES = { any: 'dowolna', sen: 'senior krajowy', foreign: 'obcokrajowiec', u24: 'U24', jun: 'junior (U21)' };
const SC_KNOW_CAP = 0.5; // maks. dodatek do wiedzy o zawodniku z obserwacji (obserwowani bez zlecenia – 0.35)
const scAll = () => Object.values((G.scouting || {}).tasks || {});
const scActive = s => scAll().filter(t => t.status === 'active' && t.staffId === s.id);
const scIsScout = s => staffRoles(s).includes('scout');
const scJudging = s => (s.attrs && s.attrs.judging) || 8;
// Tempo zbierania informacji: skaut 1 × ocena talentu / 12, trener ~55% tego
const scRate = s => clamp(scJudging(s) / 12, 0.4, 1.6) * (scIsScout(s) ? 1 : 0.55);
function scCapacity(s) {
  const act = scActive(s);
  if (act.some(t => t.type === 'country')) return 0;
  return Math.max(0, (scIsScout(s) ? 2 : 1) - act.length);
}
// Kara treningowa (js/world.js staffEff): trener ze zleceniem – 75% skuteczności za każde zlecenie
function scoutTrainPenalty(s) { if (!G.scouting || scIsScout(s)) return 1; const n = scActive(s).length; return n ? Math.pow(0.75, n) : 1; }
// Obserwatorzy: skaut, trenerzy (sztab trenerski), menedżer organizacyjny, kierownik drużyny, dyrektor sportowy
const SC_WHO = ['scout', 'manager', 'teamManager', 'director'];
const scStaffPool = () => clubStaff(G.clubId).filter(s => s.attrs && s.attrs.judging != null && !s.national && staffRoles(s).some(r => COACH_GROUP.includes(r) || SC_WHO.includes(r)));
function ensureScoutModel() { if (!G.scouting) { G.scouting = { tasks: {}, reports: {}, recs: [], seq: 1 }; return true; } return false; }

// ---------- Ocena skauta (osobny błąd skauta wobec zawodnika) ----------
function perceiveBy(x, s) {
  const K = knowledge(x), J = scJudging(s), e = 1 - K, age = ageYears(x.born), key = 'S' + s.id + ':' + x.id, sk = 1.4 - J / 20;
  const caC = x.ca + hgauss(key + ':ca') * e * 12 * sk, caH = 0.8 + e * 18;
  const youth = age <= 18 ? 1 : age <= 21 ? 0.6 : age <= 24 ? 0.25 : 0;
  const opt = Math.max(0, 14 - J) / 14 * 10 * youth * (e + 0.15); // słaby skaut zawyża ocenę młodych
  const paC = x.pa + hgauss(key + ':pa') * e * 18 * sk + opt, paH = 1.5 + e * 30 + (age < 18 ? 6 * e : 0);
  const caLo = clamp(caC - caH, 1, 100), caHi = clamp(caC + caH, caLo, 100);
  const paLo = clamp(Math.max(paC - paH, caLo), 1, 100), paHi = clamp(Math.max(paC + paH, caHi), paLo, 100);
  return { K, ca: [caLo, caHi], pa: [paLo, paHi], caMid: (caLo + caHi) / 2, paMid: (paLo + paHi) / 2 };
}
// Siła rywali w naszej lidze (średnia 5 najlepszych seniorów pozostałych klubów) – zmienia się z transferami
let SC_RIVAL = { key: null, v: null };
function scRivalSkill(lg = myClub().league) {
  const key = G.date + lg;
  if (SC_RIVAL.key === key) return SC_RIVAL.v;
  const per = Object.values(G.clubs).filter(c => c.league === lg && c.id !== G.clubId && clubActive(c)).map(c => {
    const sk = clubRiders(c.id).filter(r => !r.retired && r.active !== false).map(r => r.skill).sort((a, b) => b - a).slice(0, 5);
    return sk.length ? sum(sk) / sk.length : null;
  }).filter(v => v != null);
  return (SC_RIVAL = { key, v: per.length ? sum(per) / per.length : LEAGUE_AVG_SKILL[lg] }).v;
}
// Przedział punktów w sezonie u nas: umiejętności w ocenie skauta (CA/5) względem rywali, ok. 5 biegów w meczu
function scPointsRange(view, lg = myClub().league) {
  const riv = scRivalSkill(lg), matches = Math.max(10, clubFixtures(G.clubId, sportSeason()).filter(f => f.stage === 'RS').length || 14);
  const pts = ca => Math.round(clamp(1.45 + (ca / 5 - riv) * 0.33, 0.25, 2.7) * 5 * matches * 0.9);
  return [pts(view.ca[0]), pts(view.ca[1])];
}
const scSeasonCost = (r, pts) => { const a = riderAsk(r, G.clubId); return Math.round(a.signing + a.perPoint * (pts[0] + pts[1]) / 2); };

// ---------- Zawody dnia: kto startował i gdzie ----------
function scMeetingsOn(date) {
  const out = [];
  for (const m of Object.values(G.matches)) {
    if (m.date !== date || !m.done || !m.riders) continue;
    const ids = Object.entries(m.riders).filter(([, s]) => s.heats).map(([id]) => Number(id));
    if (m.kind === 'league') { const f = G.fixtures[m.fixtureId]; if (!f) continue; const h = G.clubs[f.homeId]; out.push({ comp: f.league, cc: 'POL', geo: geoOf(h.city) || COUNTRY_GEO.POL, label: `${h.short} – ${G.clubs[f.awayId].short}`, ids }); continue; }
    const e = G.events[m.eventId]; if (!e) continue;
    const g = geoOf(e.venue); out.push({ comp: e.kind === 'sgp' ? 'SGP' : compKey(e), cc: (g && g[2]) || (COMPS[e.comp] || {}).cc || 'POL', geo: g || COUNTRY_GEO.POL, label: e.name, ids });
  }
  for (const f of Object.values(G.ffix || {})) {
    if (f.d !== date || !f.res) continue;
    const L = fLeague(f.lg);
    out.push({ comp: f.lg, cc: L.country, geo: fGeo(f) || COUNTRY_GEO[L.country], label: `${L.name}: ${fLabel(f)}`, ids: Object.entries(f.res.riders).filter(([, s]) => s.heats).map(([id]) => Number(id)) });
  }
  return out;
}
// Koszt wyjazdu: dojazd (do 1200 km) albo lot, pobyt za dzień (Polska / Europa / poza Europą)
const scHome = () => geoOf(myClub().city) || COUNTRY_GEO.POL;
function scTripCost(geo, days = 1) {
  const km = geo ? kmBetween(scHome(), geo) : 0, far = geo && !EUROPE_CC.has(geo[2]) && geo[2] !== 'POL';
  const travel = km < 40 ? 0 : km <= 1200 ? Math.round(km * 2 * 0.95) : Math.round(900 + km * 0.42);
  const stay = (geo && geo[2] === 'POL' ? (km > 250 ? 280 : 0) : far ? 620 : 450) * days;
  return travel + stay;
}
function scCharge(t, amount, what) {
  if (!amount) return;
  t.cost = (t.cost || 0) + amount;
  addTx(G.clubId, 'skauting', -amount, `Skauting (${staffName(t.staffId)}): ${what}`);
}
const staffName = id => (G.staff[id] || {}).name || '—';
// Wiedza o zawodniku rośnie z obserwacji (nagrania – wolniej)
function scGain(t, r, base) {
  if (!r || r.clubId === G.clubId) return 0;
  G.scout = G.scout || {};
  const s = G.staff[t.staffId], g = base * scRate(s);
  const before = G.scout[r.id] || 0;
  G.scout[r.id] = Math.min(SC_KNOW_CAP, before + g);
  t.seen[r.id] = (t.seen[r.id] || 0) + 1;
  return G.scout[r.id] - before;
}

// ---------- Zlecenia ----------
// target: rider { riderId }, comp { comp }, country { cc, profile }, search { crit }; crit: { role, ca, pa, ageMax, budget, cc }
function scTaskProblem(staffId, type, target, weeks) {
  const s = G.staff[staffId];
  if (!s || s.clubId !== G.clubId) return 'Wybierz osobę ze sztabu.';
  if (!scCapacity(s)) return `${s.name} ma już ${scIsScout(s) ? 'pełne obłożenie (2 zlecenia albo wyjazd)' : 'zlecenie'}.`;
  if (type === 'country' && scActive(s).length) return 'Wyjazd do kraju wymaga wolnego skauta – bez innych zleceń.';
  if (type === 'rider' && !G.riders[target.riderId]) return 'Wybierz zawodnika.';
  if (type === 'rider' && scAll().some(t => t.status === 'active' && t.type === 'rider' && t.target.riderId === target.riderId)) return 'Ten zawodnik jest już obserwowany.';
  if (type === 'comp' && !target.comp) return 'Wybierz rozgrywki.';
  if (type === 'country' && !target.cc) return 'Wybierz kraj.';
  if (!(weeks >= 1 && weeks <= 8)) return 'Czas zlecenia: 1–8 tygodni.';
  return null;
}
function scEstimate(type, target, weeks) {
  if (type === 'country') { const g = COUNTRY_GEO[target.cc]; return scTripCost(g, weeks * 7); }
  if (type === 'search') return 0;
  if (type === 'rider') { const r = G.riders[target.riderId]; return r ? scTripCost(baseOf(r), 1) * Math.min(4, weeks) : 0; }
  return scTripCost(null) + 1500 * weeks; // rozgrywki: kilka wyjazdów na mecze
}
function scCreate(staffId, type, target, weeks) {
  ensureScoutModel();
  const p = scTaskProblem(staffId, type, target, weeks);
  if (p) return { ok: false, text: p };
  const id = `SC${G.scouting.seq++}`;
  const t = G.scouting.tasks[id] = { id, type, staffId, target: JSON.parse(JSON.stringify(target)), start: G.date, end: addDays(G.date, weeks * 7), weeks, status: 'active', seen: {}, cost: 0, obs: 0, recs: [], reports: [] };
  if (type === 'country') scCharge(t, scTripCost(COUNTRY_GEO[target.cc], 0), `wyjazd – ${COUNTRY[target.cc] || target.cc}`);
  if (typeof TQ !== 'undefined') TQ.date = null;
  return { ok: true, id, text: `Zlecenie przyjęte: ${staffName(staffId)} – ${scTaskLabel(t)} do ${fmtDate(t.end)}.` };
}
function scCancel(id) { const t = G.scouting && G.scouting.tasks[id]; if (!t || t.status !== 'active') return; t.status = 'cancelled'; t.done = G.date; if (typeof TQ !== 'undefined') TQ.date = null; }
function scTaskLabel(t) {
  if (t.type === 'rider') return `obserwacja: ${(G.riders[t.target.riderId] || {}).name || '?'}`;
  if (t.type === 'comp') return `rozgrywki: ${scCompName(t.target.comp)}`;
  if (t.type === 'country') return `wyjazd: ${COUNTRY[t.target.cc] || t.target.cc}${t.target.profile ? ' (według profilu)' : ''}`;
  return `poszukiwanie: ${scCritLabel(t.target.crit)}`;
}
function scCompName(k) {
  if (LEAGUES[k]) return LEAGUES[k].name;
  if (typeof fLeague === 'function' && FP && fLeague(k)) return fLeague(k).full;
  if (k === 'SGP') return 'Speedway Grand Prix';
  return (COMPS[k] || { name: k }).name;
}
function scCritLabel(c) {
  if (!c) return 'ogólnie';
  const a = [];
  if (c.role && c.role !== 'any') a.push(SC_ROLES[c.role]);
  if (c.ca) a.push(`umiejętności ≥ ${String(c.ca).replace('.', ',')}★`);
  if (c.pa) a.push(`potencjał ≥ ${String(c.pa).replace('.', ',')}★`);
  if (c.ageMax) a.push(`do ${c.ageMax} lat`);
  if (c.budget) a.push(`koszt sezonu ≤ ${fmtMoney(c.budget, true)}`);
  if (c.cc) a.push(COUNTRY[c.cc] || c.cc);
  return a.join(', ') || 'ogólnie';
}
// Spełnienie kryteriów w ocenie skauta
function scFits(r, c, view, S = sportSeason()) {
  if (!c) return true;
  const age = r.born ? ageIn(r, S) : 26; // zawodnicy lig zagranicznych bez daty urodzenia
  if (c.role === 'jun' && !isJunior(r, S)) return false;
  if (c.role === 'u24' && (isJunior(r, S) || age > 24)) return false;
  if (c.role === 'sen' && (isJunior(r, S) || !hasNat(r, 'POL'))) return false;
  if (c.role === 'foreign' && hasNat(r, 'POL')) return false;
  if (c.ageMax && age > c.ageMax) return false;
  if (c.cc && r.country !== c.cc) return false;
  if (c.ca && view.caMid < c.ca * 20 - 5) return false;
  if (c.pa && view.paMid < c.pa * 20 - 5) return false;
  if (c.budget && scSeasonCost(r, scPointsRange(view)) > c.budget) return false;
  return true;
}
const scPool = () => Object.values(G.riders).filter(r => r.active && !r.retired && r.clubId !== G.clubId && !isKid(r) && (!r.born || ageYears(r.born) >= 15));

// ---------- Dzień: obserwacje, koszty, zakończenie ----------
function scoutDay(date) {
  if (!G.scouting) return;
  const act = scAll().filter(t => t.status === 'active');
  if (!act.length) return;
  const meets = scMeetingsOn(date);
  for (const t of act) {
    const s = G.staff[t.staffId];
    if (!s || s.clubId !== G.clubId) { t.status = 'cancelled'; t.done = date; continue; }
    if (t.type === 'rider') {
      const r = G.riders[t.target.riderId], m = meets.find(x => x.ids.includes(r.id));
      if (m) { scGain(t, r, 0.06); t.obs++; scCharge(t, scTripCost(m.geo, 1), `${r.name} – ${m.label}`); }
      else if (dow(date) === 2) scGain(t, r, 0.012); // nagrania i rozmowy
      if (t.obs >= 4) scFinish(t);
    } else if (t.type === 'comp') {
      const ms = meets.filter(x => x.comp === t.target.comp);
      // jeden mecz dziennie na żywo (najbliższy), pozostałe z nagrań
      if (ms.length) {
        scXp(ms[0].cc, 0.004 * scRate(s));
        const live = ms.slice().sort(by(x => kmBetween(scHome(), x.geo)))[0];
        for (const x of ms) for (const id of x.ids) scGain(t, G.riders[id], x === live ? 0.035 : 0.012);
        t.obs++; scCharge(t, scTripCost(live.geo, 1), live.label);
      }
    } else if (t.type === 'country') {
      const ms = meets.filter(x => x.cc === t.target.cc);
      for (const x of ms) for (const id of x.ids) scGain(t, G.riders[id], 0.04 * (0.7 + scCountryKnow(G.clubId, t.target.cc) * 0.6));
      scXp(t.target.cc, 0.01 * scRate(s));
      if (ms.length) t.obs++;
      scCharge(t, scTripCost(COUNTRY_GEO[t.target.cc], 1) - scTripCost(COUNTRY_GEO[t.target.cc], 0), `pobyt – ${COUNTRY[t.target.cc] || t.target.cc}`);
    } else if (t.type === 'search' && dow(date) === 0) {
      // co tydzień: przegląd statystyk i nagrań zawodników pasujących do roli i wieku (bez oceny gwiazdek – ta w raporcie)
      const c = t.target.crit || {}, pool = scPool().filter(r => scFits(r, { role: c.role, ageMax: c.ageMax, cc: c.cc }, null));
      const top = pool.map(r => [r, perceiveBy(r, s)]).filter(([r, v]) => (!c.ca || v.caMid >= c.ca * 20 - 15) && (!c.pa || v.paMid >= c.pa * 20 - 15)).sort(by(([, v]) => v.caMid + v.paMid, -1)).slice(0, 25);
      for (const [r] of top) scGain(t, r, 0.02);
      t.obs++;
    }
    if (t.status === 'active' && date >= t.end) scFinish(t);
  }
}
// Zakończenie: raporty i lista polecanych
function scFinish(t) {
  const s = G.staff[t.staffId];
  t.status = 'done'; t.done = G.date;
  let picks = [];
  if (t.type === 'rider') picks = [G.riders[t.target.riderId]];
  else {
    const ids = Object.keys(t.seen).map(Number).filter(id => G.riders[id] && G.riders[id].clubId !== G.clubId);
    const crit = t.type === 'search' ? t.target.crit : t.target.profile ? t.target.crit : null;
    const cand = (t.type === 'search' ? ids : ids).map(id => G.riders[id]).filter(r => r.active && !r.retired).map(r => [r, perceiveBy(r, s)]).filter(([r, v]) => scFits(r, crit, v));
    picks = cand.sort(by(([r, v]) => v.caMid * 0.6 + v.paMid * 0.4 + (r.born && ageYears(r.born) <= 21 ? 4 : 0), -1)).slice(0, t.type === 'search' ? 6 : 8).map(([r]) => r);
  }
  for (const r of picks) {
    const rep = scReport(r, s, t);
    t.reports.push(rep.id);
    if (t.type !== 'rider') { t.recs.push(r.id); G.scouting.recs = [{ riderId: r.id, taskId: t.id, reportId: rep.id, date: G.date }, ...G.scouting.recs.filter(x => x.riderId !== r.id)].slice(0, 60); }
  }
  if (typeof TQ !== 'undefined') TQ.date = null;
  addMsg({ category: 'transfer', from: s ? s.name : 'Skauting', title: `Skauting: ${scTaskLabel(t)} – raport`, link: t.type === 'rider' && t.reports[0] ? `#/raport/${t.reports[0]}` : '#/transfery/skauting/polecani',
    body: `<p>Zlecenie zakończone (${fmtDate(t.start)} – ${fmtDate(G.date)}, obserwacji: ${t.obs}, zawodników: ${Object.keys(t.seen).length}, koszt: ${fmtMoney(t.cost || 0)}).</p>${picks.length ? `<p>${t.type === 'rider' ? 'Raport' : 'Polecani'}: ${picks.map(r => `<a href="#/zawodnik/${r.id}">${esc(r.name)}</a>`).join(', ')}.</p>` : '<p>Nikt nie spełnił kryteriów.</p>'}` });
}
function scReport(r, s, t) {
  const v = perceiveBy(r, s), K = v.K, pts = scPointsRange(v), id = `RP${G.scouting.seq++}`;
  const known = Object.values(ATTRS).flatMap(g => g.list).map(([k, n]) => { const p = perceiveAttr(r, k, G.clubId, K); return p && !p.hidden ? [n, (p.lo + p.hi) / 2] : null; }).filter(Boolean).sort(by(x => x[1], -1));
  const ch = K >= 0.7 && typeof personalityLabel === 'function' ? personalityLabel(r.hidden) : null;
  const ask = riderAsk(r, G.clubId);
  G.scouting.reports[id] = { id, riderId: r.id, staffId: s.id, taskId: t.id, date: G.date, scout: scIsScout(s), K: round2(K), ca: v.ca.map(Math.round), pa: v.pa.map(Math.round),
    strong: known.length >= 6 ? known.slice(0, 3).map(x => x[0]) : [], weak: known.length >= 6 ? known.slice(-3).map(x => x[0]) : [], char: ch ? ch[0] : null,
    pts, cost: scSeasonCost(r, pts), ask: { signing: ask.signing, perPoint: ask.perPoint }, club: r.clubId || null, until: r.contract ? r.contract.until : null, age: r.born ? ageIn(r, sportSeason()) : null };
  return G.scouting.reports[id];
}
const scLastReport = rid => Object.values((G.scouting || {}).reports || {}).filter(x => x.riderId === rid).sort(by(x => x.date + x.id, -1))[0] || null;

// ---------- Znajomość krajów przez klub (0–1): mapa w Transfery → Skauting ----------
// Źródła: obcokrajowcy zatrudniani przez klub w poprzednich sezonach (historia PSD, maleje z wiekiem), kontakty sztabu
// (zagraniczni koledzy z drużyny z kariery zawodniczej i zawodnicy prowadzeni jako trener – także w Polsce; obcokrajowiec
// w sztabie zna swój kraj), obecni zawodnicy klubu i ligi, w których jeżdżą, zlecenia skautingu (z powolnym zapominaniem).
const SC_BIG = { SWE: 0.08, DEN: 0.08, GBR: 0.08, AUS: 0.06, CZE: 0.04, GER: 0.04, LAT: 0.03, SLO: 0.02, USA: 0.02 }; // znane z TV i Grand Prix
const scFold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLowerCase().replace(/^wanda /, '').split(/[ .]/)[0];
const scDecay = y => Math.pow(0.85, Math.max(0, sportSeason() - 1 - y));
let SC_TEAMS = null; // team PSD|sezon → kraje obcokrajowców
function scTeamIndex() {
  if (SC_TEAMS) return SC_TEAMS;
  SC_TEAMS = new Map();
  if (typeof RIDER_HIST === 'undefined') return SC_TEAMS;
  for (const r of Object.values(RIDER_HIST.riders)) {
    if (!r.country || r.country === 'POL') continue;
    for (const s of r.seasons || []) { const k = scFold(s.team) + '|' + s.season; if (!SC_TEAMS.has(k)) SC_TEAMS.set(k, []); SC_TEAMS.get(k).push(r.country); }
  }
  return SC_TEAMS;
}
const SC_BASE = new Map(); // clubId → { kraj: wartość } (historia klubu i sztab; liczone raz na sezon)
function scClubBase(clubId) {
  const key = clubId + '|' + sportSeason() + '|' + ((G.seq && G.seq.staff) || 0) + '|' + clubStaff(clubId).map(s => s.id).join(',');
  const hit = SC_BASE.get(clubId);
  if (hit && hit.key === key) return hit;
  const c = G.clubs[clubId], idx = scTeamIndex(), team = scFold(c.city), out = { key, hist: {}, staff: {}, src: {} };
  const add = (obj, cc, v, cap) => { obj[cc] = Math.min(cap, (obj[cc] || 0) + v); };
  for (let y = sportSeason() - 12; y < sportSeason(); y++) for (const cc of idx.get(team + '|' + y) || []) { add(out.hist, cc, 0.03 * scDecay(y), 0.35); (out.src[cc] ||= new Set()).add('historia klubu'); }
  const H = typeof STAFF_HIST !== 'undefined' ? STAFF_HIST : null;
  for (const s of clubStaff(clubId)) {
    if (s.country && s.country !== 'POL') { add(out.staff, s.country, 0.35, 0.4); (out.src[s.country] ||= new Set()).add(`${s.name} (kraj pochodzenia)`); }
    const stints = [];
    const hr = H && H.riders && H.riders[s.name];
    if (hr) for (const x of hr.seasons || []) stints.push([x.team, x.season, 0.5]); // koledzy z drużyny
    for (const x of (H && H.coach && H.coach[s.name]) || []) if (x.team && !x.national) for (let y = x.y; y <= (x.y2 || x.y); y++) stints.push([x.team, y, 1]); // prowadzeni zawodnicy
    for (const [t, y, w] of stints) for (const cc of idx.get(scFold(t) + '|' + y) || []) { add(out.staff, cc, 0.012 * w * scDecay(y), 0.25); (out.src[cc] ||= new Set()).add(`kontakty: ${s.name}`); }
  }
  SC_BASE.set(clubId, out);
  return out;
}
let SC_CK = { key: null, map: new Map() };
function scCountryKnow(clubId, cc) {
  if (!cc) return 0;
  if (cc === 'POL') return 1;
  if (SC_CK.key !== G.date) SC_CK = { key: G.date, map: new Map() };
  const ck = clubId + '|' + cc;
  if (SC_CK.map.has(ck)) return SC_CK.map.get(ck);
  const v = scCountryKnowCalc(clubId, cc);
  SC_CK.map.set(ck, v);
  return v;
}
function scCountryKnowCalc(clubId, cc) {
  const b = scClubBase(clubId);
  let v = 0.05 + (SC_BIG[cc] || 0) + (b.hist[cc] || 0) + (b.staff[cc] || 0);
  const rs = clubRiders(clubId).filter(r => !r.retired);
  v += Math.min(0.12, rs.filter(r => r.country === cc).length * 0.05);
  v += Math.min(0.08, rs.filter(r => r.fl && r.fl.list.some(x => (fLeague(x.id) || {}).country === cc)).length * 0.015); // ligi zagraniczne naszych zawodników
  if (clubId === G.clubId && G.scouting && G.scouting.xp) v += G.scouting.xp[cc] || 0;
  return clamp(v, 0, 0.95);
}
function scCountrySources(clubId, cc) {
  const b = scClubBase(clubId), out = [...(b.src[cc] || [])];
  const n = clubRiders(clubId).filter(r => !r.retired && r.country === cc).length;
  if (n) out.push(`${n} ${plural(n, 'zawodnik', 'zawodników', 'zawodników')} w kadrze`);
  if (clubId === G.clubId && G.scouting && G.scouting.xp && G.scouting.xp[cc] > 0.01) out.push('zlecenia skautingu');
  if (SC_BIG[cc]) out.push('transmisje i Grand Prix');
  return [...new Set(out.map(x => x.replace(/^kontakty: (.*)$/, 'kontakty: $1')))];
}
// Wpływ na wiedzę o zawodniku (js/ability.js knowledge): kraj pochodzenia i kraje lig, w których jeździ
function scCountryBonus(x, clubId) {
  if (!G.clubs[clubId] || isKid(x)) return 0;
  const ccs = [x.country, ...((x.fl && x.fl.list) || []).map(l => (fLeague(l.id) || {}).country)].filter(Boolean);
  const best = Math.max(0, ...ccs.map(cc => scCountryKnow(clubId, cc)));
  return (best - 0.3) * 0.25;
}
// Zlecenia podnoszą znajomość kraju (powoli zapominana: −3% miesięcznie)
function scXp(cc, v) { G.scouting.xp = G.scouting.xp || {}; G.scouting.xp[cc] = Math.min(0.4, (G.scouting.xp[cc] || 0) + v); SC_CK.key = null; }
function scXpMonthly() { if (G.scouting && G.scouting.xp) for (const k of Object.keys(G.scouting.xp)) G.scouting.xp[k] *= 0.97; }
// Gwiazdki tylko dla zawodników, których klub zna (własni, znani z ligi, obserwowani, z raportem)
const SC_KNOWN = 0.4;
const scKnown = x => !x || (x.clubId && x.clubId === G.clubId) || (x.cat && x.clubId === G.clubId) || knowledge(x) >= SC_KNOWN || !!(typeof scLastReport === 'function' && G.scouting && scLastReport(x.id));
