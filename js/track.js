'use strict';
// Tor w zawodach: stan nawierzchni, przygotowanie przed zawodami, próba toru i prace torowe w przerwach technicznych.
// Regulaminy (data/heat-tables/sources): toromistrz odpowiada za tor i wykonuje polecenia sędziego i komisarza toru,
// trener i menedżer gospodarza współodpowiadają za przygotowanie (Regulamin Zawodów PZM art. 44); komisarz toru jest
// obowiązkowy w Ekstralidze, 2. Ekstralidze i KLŻ (art. 35); w zawodach FIM o polewaniu i równaniu decyduje dyrektor zawodów.
// Przerwy techniczne (równanie, max 5 min) – `gradingAfter` w tabelach biegowych; KLŻ: po VII biegu długa przerwa (10 min).
// Próba toru (Ekstraliga, 2. Ekstraliga, KLŻ): 30 min przed zawodami, po 2 zawodników drużyny, bez startów spod taśmy.

// Pasy toru: 0 – przy krawężniku, 1 – środek, 2 – zewnętrzna. g – materiał: 0 wybity, twardy … 0,5 przyczepny … 1 głęboki, grząski.
// moist – wilgotność (polewanie podnosi, słońce i wiatr suszą). Przyczepność pasa = g + (moist − 0,5) · 0,35.
const SURF_MOIST = 0.35;
const TRACK_PRESETS = {
  standard: { name: 'Standard (przyczepny, równy)', g: [0.5, 0.5, 0.5], moist: 0.5 },
  hard: { name: 'Twardy i szybki', g: [0.34, 0.36, 0.38], moist: 0.36 },
  grip: { name: 'Bardzo przyczepny', g: [0.58, 0.58, 0.6], moist: 0.6 },
  deep: { name: 'Głęboki, ciężki', g: [0.7, 0.72, 0.74], moist: 0.62 },
  wide: { name: 'Twardy krawężnik, szeroka ścieżka', g: [0.36, 0.5, 0.68], moist: 0.5 },
  outer: { name: 'Grząski krawężnik, twarda zewnętrzna', g: [0.7, 0.52, 0.36], moist: 0.5 },
};
const LANE_NAMES = ['przy krawężniku', 'środek', 'zewnętrzna'];
// Pola startowe na pasach (A – wewnętrzne, D – zewnętrzne)
const GATE_LANES = { A: [1, 0, 0], B: [0.6, 0.4, 0], C: [0, 0.6, 0.4], D: [0, 0, 1] };
const GATE_BASE = { A: 0.45, B: 0.2, C: 0.05, D: -0.1 };
// Granice komisarza toru (tor regulaminowy): materiał i wilgotność
const KOMISARZ = { lo: 0.25, hi: 0.78, mLo: 0.18, mHi: 0.82 };

const surfEff = (S, l) => clamp(S.g[l] + (S.moist - 0.5) * SURF_MOIST, 0, 1);
function surfLabel(S) {
  if (!S) return 'przyczepny';
  if (S.rain) return 'mokry';
  const e = [0, 1, 2].map(l => surfEff(S, l)), G = (e[0] + e[1] + e[2]) / 3;
  const base = G < 0.3 ? 'twardy, śliski' : G < 0.42 ? 'twardy, szybki' : G < 0.62 ? 'przyczepny' : G < 0.76 ? 'przyczepny, głęboki' : 'grząski, ciężki';
  return Math.abs(e[2] - e[0]) >= 0.18 ? `${base}${e[0] > e[2] ? ', grząsko przy krawężniku' : ', szeroka ścieżka na zewnętrznej'}` : base;
}
const laneWord = x => (x < 0.3 ? 'twardo, ślisko' : x < 0.42 ? 'twardo' : x < 0.6 ? 'przyczepnie' : x < 0.75 ? 'głęboko' : 'grząsko');
// Stan toru dawnych zapisów i zawodów bez modelu (kalibracja): z opisu w pogodzie
function legacySurf(w) {
  const t = w && w.track;
  if (w && w.rain) return { g: [0.55, 0.55, 0.55], moist: 0.9, ruts: 0, rain: true };
  if (t === 'twardy, szybki') return { g: [0.38, 0.38, 0.38], moist: 0.3, ruts: 0 };
  return { g: [0.5, 0.5, 0.5], moist: 0.5, ruts: 0 };
}
// Nawierzchnia pod polem startowym: głęboki, luźny materiał – buksowanie spod taśmy; twardsze pole lepiej „trzyma” do pewnego stopnia
const gateGround = x => (x >= 0.5 ? -10 * (x - 0.5) ** 2 : 0.6 * (0.5 - x) - 4 * (0.5 - x) ** 2);
// Wpływ stanu toru na bieg (js/engine.js: runHeat); dla toru „przyczepny, równy” wszystkie mnożniki = 1, dodatki = 0
function surfFx(S) {
  const e = [0, 1, 2].map(l => surfEff(S, l)), G = (e[0] + e[1] + e[2]) / 3, dev = G - 0.5, ruts = S.ruts || 0;
  const hard = Math.max(0, -dev) * 2, deep = Math.max(0, dev) * 2, slope = e[2] - e[0];
  const gate = {};
  for (const [k, w] of Object.entries(GATE_LANES)) {
    const x = w[0] * e[0] + w[1] * e[1] + w[2] * e[2];
    gate[k] = GATE_BASE[k] + 1.5 * gateGround(x) - ruts * (w[0] * 0.4 + w[1] * 0.2);
  }
  return { e, G, dev, hard, deep, slope, ruts, gate, wet: !!S.rain,
    surfW: Math.min(1, Math.abs(dev) * 4 + ruts * 1.5), startW: 1 + 0.1 * hard, bonusK: Math.max(0.3, 1 + 2.5 * hard - deep - 0.2 * ruts),
    noiseK: 1 + 0.35 * deep + 0.25 * ruts - 0.25 * hard, passK: 1 + 0.5 * deep - 0.2 * hard, outK: 1 + 3 * Math.max(0, slope), inK: 3 * Math.max(0, -slope),
    fallK: 1 + ruts * 0.8 + Math.max(0, deep - 0.4) * 0.6 + Math.max(0, hard - 0.5) * 0.4, time: dev * 6 + ruts * 0.8 };
}

// ---------- Profil toru klubu (na nim zawodnicy trenują na co dzień) ----------
function trackUsual(clubId) {
  const c = G.clubs[clubId];
  if (c && c.stadium && c.stadium.usual) return c.stadium.usual;
  const r = mulberry(hashStr('tor' + clubId));
  const b = 0.43 + r() * 0.14, s = (r() - 0.4) * 0.16, moist = round2(0.42 + r() * 0.16);
  return { g: [round2(b - s / 2), round2(b), round2(b + s / 2)], moist };
}
// Po meczu domowym zawodnicy przyzwyczajają się do toru, który klub przygotowuje
function trackHabit(clubId, plan) {
  const c = G.clubs[clubId];
  if (!c || !c.stadium || !plan) return;
  const u = trackUsual(clubId);
  c.stadium.usual = { g: u.g.map((x, i) => round2(x * 0.85 + plan.g[i] * 0.15)), moist: round2(u.moist * 0.85 + plan.moist * 0.15) };
}
const planDist = (a, b) => (Math.abs(a.g[0] - b.g[0]) + Math.abs(a.g[1] - b.g[1]) + Math.abs(a.g[2] - b.g[2])) / 3 + Math.abs(a.moist - b.moist) * 0.5;
// Znajomość toru gospodarzy: tor bliski codziennemu – pełny atut własnego toru
const trackFamiliarity = (plan, usual) => 1 - clamp(planDist(plan, usual) * 1.2, 0, 0.5);

// ---------- Dopasowanie toru do zawodników ----------
// Przybliżony wpływ stanu toru na dyspozycję zawodnika (te same wagi co w runHeat), względem toru przyczepnego
function riderTrackFit(r, fx) {
  const a = r.attrs, sd = k => (a[k] ?? r.skill) - r.skill;
  let d = sd('surfaces') * 0.04 * fx.surfW
    + (a.start - 12) * 0.13 * (fx.startW - 1) * 0.5
    + sd('passing') * 0.06 * (fx.passK - 1) + sd('outside') * 0.015 * (fx.outK - 1) + sd('inside') * 0.015 * fx.inK;
  const engs = (r.equip && r.equip.engines || []).filter(e => engReady(e));
  if (engs.length) { const drive = engs.reduce((s, e) => s + (e.drive || 0), 0) / engs.length; d += drive * 0.5 * (surfDrive(fx.G, fx.wet) - 0.4) / 25; }
  return d;
}
// moment silnika na torze o danej przyczepności (equipment.js: engineValue) – 0,4 na przyczepnym, −1 na twardym, 1,2 na mokrym
const surfDrive = (G, wet) => (wet ? 1.2 : clamp(0.4 + (G - 0.5) * 5.6, -1.4, 1.4));
function teamTrackFit(rids, plan) {
  const fx = surfFx({ g: plan.g, moist: plan.moist, ruts: 0.15 });
  const rs = rids.map(id => G.riders[id]).filter(Boolean);
  return rs.length ? sum(rs.map(r => riderTrackFit(r, fx))) / rs.length : 0;
}
// Siła drużyny (poziom i forma zawodników)
const teamStrength = rids => { const rs = rids.map(id => G.riders[id]).filter(Boolean); return rs.length ? sum(rs.map(r => r.skill + r.form * 0.45)) / rs.length : 0; };
// Bilans planu dla gospodarza: dopasowanie obu drużyn, losowość toru (twardy – mniej losowy, sprzyja silniejszym; głęboki – słabszym)
// i utrata znajomości własnego toru (0,35 = atut toru w runHeat)
function planBalance(homeId, homeRids, awayRids, plan) {
  const fam = trackFamiliarity(plan, trackUsual(homeId));
  const staff = (staffBest(homeId, 'track') - 10) * 0.02;
  const home = teamTrackFit(homeRids, plan), away = teamTrackFit(awayRids, plan);
  const fx = surfFx({ g: plan.g, moist: plan.moist, ruts: 0.15 }), base = surfFx({ g: [0.5, 0.5, 0.5], moist: 0.5, ruts: 0.15 });
  const luck = (teamStrength(homeRids) - teamStrength(awayRids) + 0.35) * (base.noiseK / fx.noiseK - 1);
  const famLoss = (0.35 + staff) * (1 - fam);
  return { home, away, fam, famLoss, luck, net: home - away + luck - famLoss };
}
const fitWord = x => (x > 0.06 ? 'wyraźnie dla nas' : x > 0.02 ? 'lekko dla nas' : x < -0.06 ? 'wyraźnie dla rywala' : x < -0.02 ? 'lekko dla rywala' : 'neutralnie');

// ---------- Plan przygotowania ----------
// AI gospodarza: profil najbardziej różnicujący drużyny (trafność oceny – taktyka trenera), z przywiązaniem do własnego toru
function aiTrackPlan(homeId, homeRids, awayRids, seed) {
  const rr = mulberry(hashStr('plan' + seed)), tq = staffBest(homeId, 'tactics');
  const noise = () => ((rr() + rr() + rr()) / 3 - 0.5) * (21 - tq) * 0.012;
  const usual = trackUsual(homeId);
  // zmiana toru tylko przy wyraźnym zysku – ocena sztabu jest niepewna, a utrata znajomości toru pewna; także pośrednie warianty
  let best = { g: usual.g.slice(), moist: usual.moist }, bv = 0.03;
  for (const p of trackCandidates(usual)) {
    const v = planBalance(homeId, homeRids, awayRids, p).net + noise();
    if (v > bv) { bv = v; best = { g: p.g.slice(), moist: p.moist }; }
  }
  return best;
}
const trackCandidates = usual => Object.values(TRACK_PRESETS).flatMap(p => [p, { g: p.g.map((x, i) => round2((x + usual.g[i]) / 2)), moist: round2((p.moist + usual.moist) / 2) }]);
// Plan gracza: osobny na mecz albo domyślny klubu
function userPlanFor(key) {
  const T = G.trackPlan || {};
  return (key && T.fx && T.fx[key]) || T.def || null;
}
function komisarzClamp(p) {
  const g = p.g.map(x => clamp(x, KOMISARZ.lo, KOMISARZ.hi)), moist = clamp(p.moist, KOMISARZ.mLo, KOMISARZ.mHi);
  const over = Math.max(...p.g.map((x, i) => Math.abs(x - g[i])), Math.abs(p.moist - moist));
  return { plan: { g, moist }, over };
}
// Zawody PZM organizowane przez klub gracza: sędzia i komisarz pilnują toru zbliżonego do neutralnego
function narrowPlan(p) { return { g: p.g.map(x => clamp(x, 0.4, 0.62)), moist: clamp(p.moist, 0.38, 0.62) }; }

// Przygotowanie toru do zawodów: plan + pogoda + jakość toromistrza i infrastruktury (stały szum z id zawodów)
function trackInit(m, o = {}) {
  const w = m.weather || {}, rr = mulberry(hashStr('surf' + m.id));
  const gr = () => (rr() + rr() + rr() + rr() - 2) * 0.866; // ~N(0,1)
  const club = o.clubId && G.clubs[o.clubId];
  const q = o.q ?? (club ? staffBest(o.clubId, 'track') : 10), fac = club && club.facilities ? club.facilities.training || 2 : 3;
  const usual = o.usual || (o.clubId ? trackUsual(o.clubId) : { g: [0.5, 0.5, 0.5], moist: 0.5 });
  let plan = o.plan || usual, note = null;
  if (o.komisarz) { const k = komisarzClamp(plan); if (k.over > 0.005) note = `Komisarz toru nakazał korektę przygotowania – tor musi być regulaminowy (${k.over > 0.1 ? 'znaczne' : 'niewielkie'} odstępstwo od planu).`; plan = k.plan; }
  const sd = (0.015 + (20 - q) * 0.0045) * (1.15 - fac * 0.05);
  const temp = w.temp ?? 18;
  let moist = plan.moist - (temp - 18) * 0.008 - (/słonecznie/.test(w.sky || '') ? 0.04 : /pochmurno/.test(w.sky || '') ? -0.03 : 0) - (w.track === 'twardy, szybki' ? 0.12 : 0) + gr() * sd * 0.8;
  if (w.rain) moist = 0.92;
  const S = { g: plan.g.map(x => round2(clamp(x + gr() * sd, 0.05, 0.95))), moist: round2(clamp(moist, 0.05, 1)), ruts: 0, rain: !!w.rain,
    plan: { g: plan.g.slice(), moist: plan.moist }, fam: o.clubId ? trackFamiliarity(plan, usual) : 1, ctl: o.ctl || 'ref', komisarz: !!o.komisarz, q, n: 0 };
  if (note) S.note = note;
  m.surf = S;
  if (m.weather) m.weather.track = surfLabel(S);
  return S;
}
// Po biegu: wywożenie materiału na zewnętrzną, wysychanie, koleiny
function surfAfterHeat(S, w, riders = 4) {
  if (!S) return;
  const fx = surfFx(S), k = (riders / 4) * (0.6 + fx.G);
  const temp = (w && w.temp) ?? 18;
  if (S.rain) S.moist = Math.min(1, S.moist + 0.02);
  else S.moist = Math.max(0, S.moist - (0.01 + Math.max(0, temp - 15) * 0.0012 + (/słonecznie/.test((w && w.sky) || '') ? 0.005 : 0)));
  S.g[0] = clamp(S.g[0] - 0.01 * k, 0, 1); S.g[1] = clamp(S.g[1] - 0.004 * k, 0, 1); S.g[2] = clamp(S.g[2] + 0.012 * k, 0, 1);
  S.ruts = clamp((S.ruts || 0) + 0.025 + 0.04 * fx.deep + (S.rain ? 0.04 : 0), 0, 1);
  S.n = (S.n || 0) + 1;
  for (const key of ['moist', 'ruts']) S[key] = Math.round(S[key] * 1000) / 1000;
  S.g = S.g.map(x => Math.round(x * 1000) / 1000);
}

// ---------- Prace torowe w przerwie technicznej ----------
// Polecenia (proste): polewanie 0/1/2, materiał: 'in' zgarnąć do krawężnika, 'keep' tylko równanie, 'out' zostawić szeroką ścieżkę
const BREAK_WATER = ['bez polewania', 'lekkie polewanie', 'mocne polewanie'];
const BREAK_MAT = { in: 'materiał zgarnięty do krawężnika', keep: 'równanie bez przesuwania materiału', out: 'szeroka ścieżka zostawiona na zewnętrznej' };
function aiBreakOrders(S, target) {
  const t = target || S.plan || { g: [0.5, 0.5, 0.5], moist: 0.5 };
  const fx = surfFx(S), tfx = surfFx({ g: t.g, moist: t.moist, ruts: 0 });
  const dG = tfx.G - fx.G, dS = fx.slope - tfx.slope;
  return { water: S.rain ? 0 : dG > 0.12 ? 2 : dG > 0.04 ? 1 : 0, mat: dS > 0.08 ? 'in' : dS < -0.08 ? 'out' : 'keep' };
}
function surfGrade(S, orders, long) {
  if (!S) return '';
  const o = orders || aiBreakOrders(S), q = S.q ?? 10, k = (0.65 + q / 50) * (long ? 1.5 : 1);
  const rr = mulberry(hashStr('grade' + S.n + S.moist + S.g.join()));
  S.ruts = Math.round((S.ruts || 0) * Math.max(0.05, 1 - 0.75 * Math.min(1.2, k)) * 1000) / 1000;
  const mean = (S.g[0] + S.g[1] + S.g[2]) / 3, eq = o.mat === 'in' ? 0.55 * k : o.mat === 'keep' ? 0.2 * k : 0.05;
  S.g = S.g.map(x => x + (mean - x) * Math.min(1, eq));
  if (o.mat === 'in') { S.g[0] += 0.04 * k; S.g[2] -= 0.04 * k; }
  if (o.mat === 'out') { S.g[2] += 0.02 * k; S.g[0] -= 0.015 * k; }
  if (!S.rain) S.moist += [0, 0.12, 0.25][o.water || 0] * k;
  S.g = S.g.map(x => Math.round(clamp(x + (rr() - 0.5) * 0.02 * (21 - q) / 10, 0.05, 0.95) * 1000) / 1000);
  S.moist = Math.round(clamp(S.moist, 0, 1) * 1000) / 1000;
  let extra = '';
  if (S.komisarz) {
    const e = [0, 1, 2].map(l => surfEff(S, l));
    if (Math.min(...e) < 0.15 || Math.max(...e) > 0.88) {
      const c = komisarzClamp({ g: S.g, moist: S.moist });
      S.g = c.plan.g; S.moist = c.plan.moist;
      extra = ' Komisarz toru zgłasza sędziemu miejsca niebezpieczne – dodatkowa korekta nawierzchni.';
    }
  }
  return `<span class="muted">Przerwa techniczna${long ? ' (długa)' : ''}: równanie toru – ${BREAK_WATER[o.water || 0]}, ${BREAK_MAT[o.mat] || BREAK_MAT.keep}.${extra} Tor: ${surfLabel(S)}.</span>`;
}

// ---------- Próba toru ----------
const testerScore = (r, i) => ((r.attrs.setup ?? r.skill) + (r.attrs.techKnowledge ?? r.skill)) / 2 - (i < 5 ? 2.5 : 0) - (r.injury ? 99 : 0);
function aiTesters(lineup) {
  return lineup.map((id, i) => ({ id, i, r: G.riders[id] })).filter(x => x.r).sort(by(x => testerScore(x.r, x.i), -1)).slice(0, 2).map(x => x.id);
}
// Wiedza drużyny o torze (0–1): zmniejsza błąd wyboru silnika (js/equipment.js: pickEngine0)
function testKnowledge(ids, home, clubId) {
  // gospodarze jeżdżą na tym torze na co dzień; goście bez próby wiedzą najmniej
  const base = home ? clamp(0.68 + ((clubId ? staffBest(clubId, 'track') : 10) - 10) * 0.015, 0.55, 0.82) : 0.15;
  const rs = (ids || []).map(id => G.riders[id]).filter(Boolean);
  if (!rs.length) return base;
  const acc = sum(rs.map(r => ((r.attrs.setup ?? r.skill) + (r.attrs.techKnowledge ?? r.skill)) / 2)) / rs.length / 20;
  return round2(Math.max(base, clamp(0.3 + 0.65 * acc + (rs.length - 1) * 0.05 + (home ? 0.1 : 0), 0, 0.95)));
}
// Raport z próby: odczyt pasów z błędem zależnym od wiedzy; o polach startowych próba nie mówi (zakaz startów spod taśmy)
function trackReading(S, know, seed) {
  const rr = mulberry(hashStr('read' + seed));
  const err = (1 - know) * 0.22;
  return [0, 1, 2].map(l => clamp(surfEff(S, l) + (rr() - 0.5) * 2 * err, 0, 1));
}
function testReport(S, ids, know, seed) {
  const e = trackReading(S, know, seed);
  const who = ids.map(id => G.riders[id] ? G.riders[id].name : '').filter(Boolean).join(' i ');
  return `${who ? `${who}: ` : ''}${LANE_NAMES.map((n, l) => `${n} ${laneWord(e[l])}`).join(', ')}. ${know >= 0.75 ? 'Raport dokładny.' : know >= 0.5 ? 'Raport orientacyjny.' : 'Raport niepewny.'} Pola startowe nieznane – na próbie nie wolno startować spod taśmy.`;
}
// Próba toru przed meczem ligowym / sparingiem: zawodnicy wskazani przez trenera (gracz) albo przez AI
function runTrackTest(m, testers) {
  m.trackTest = {}; m.know = {}; m.testReport = {};
  for (const t of ['H', 'A']) {
    const clubId = t === 'H' ? m.homeId : m.awayId;
    const ids = (testers && testers[t] != null ? testers[t] : aiTesters(m.lineup[t])).filter(id => id && G.riders[id] && !G.riders[id].injury).slice(0, 2);
    m.trackTest[t] = ids;
    m.know[t] = testKnowledge(ids, t === 'H', clubId);
    m.testReport[t] = ids.length ? testReport(m.surf, ids, m.know[t], m.id + t) : null;
    for (const id of ids) { // 2 sesje po 1,5 min: kondycja i zużycie silnika
      const r = G.riders[id];
      r.cond = clamp((r.cond ?? 100) - 1.5, 40, 100);
      const eng = r.equip && r.equip.engines.find(e => engReady(e));
      if (eng) eng.heats = round2((eng.heats || 0) + 0.3);
    }
  }
}

// ---------- Podpięcie do zawodów ----------
const KOMISARZ_LEAGUES = ['PGE', '2E', 'KLZ'];
// Mecz ligowy i sparing: przygotowanie gospodarza (gracz: plan z zakładki Tor; AI: aiTrackPlan) + próba toru
function teamMeetingTrack(m, o = {}) {
  const userHome = m.homeId === G.clubId, lg = G.clubs[m.homeId] && G.clubs[m.homeId].league;
  const rids = t => (m.lineup[t] || []).filter(Boolean);
  const plan = (userHome && userPlanFor(o.planKey)) || aiTrackPlan(m.homeId, rids('H'), rids('A'), m.id);
  trackInit(m, { clubId: m.homeId, plan, ctl: 'H', komisarz: m.kind === 'league' && KOMISARZ_LEAGUES.includes(lg) });
  m.surfLog = [];
  runTrackTest(m, o.testers);
}
// Zawody z tabeli biegowej (indywidualne, parowe, drużynowe PZM i FIM): tor organizatora, prace torowe decyduje sędzia / komisarz / dyrektor
function eventHostClub(ev) {
  const hc = typeof eventHost === 'function' && eventHost(ev); // gospodarz zawodów jak w rozliczeniu biletów (js/stadium.js)
  if (hc) return hc.id;
  if (ev.dmpj && G.clubs[ev.dmpj.host]) return ev.dmpj.host;
  const c = Object.values(G.clubs).find(c => ev.venue && c.city && ev.venue.includes(c.city.replace(' Wlkp.', '')));
  return c ? c.id : null;
}
function eventTrack(m, ev) {
  const host = ev ? eventHostClub(ev) : null, fim = ev && typeof isFimEvent === 'function' && isFimEvent(ev);
  const usual = host ? trackUsual(host) : { g: [0.5, 0.5, 0.5], moist: 0.5 };
  const user = !fim && host === G.clubId && userPlanFor(ev && 'E:' + ev.id);
  const neutral = { g: usual.g.map(x => (x + 0.5) / 2), moist: (usual.moist + 0.5) / 2 };
  trackInit(m, { clubId: host, usual, plan: user ? narrowPlan(user) : fim ? { g: [0.5, 0.5, 0.5], moist: 0.5 } : neutral, ctl: 'ref', komisarz: !fim });
  m.know = null; // oficjalny trening / wyjazd zapoznawczy dla wszystkich
}
// Mecze lig zagranicznych: gospodarz przygotowuje tor (AI)
function foreignTrack(m, homeRids, awayRids, homeKey) {
  const rr = mulberry(hashStr('ftor' + homeKey));
  const b = 0.43 + rr() * 0.14, s = (rr() - 0.4) * 0.16, usual = { g: [b - s / 2, b, b + s / 2], moist: 0.42 + rr() * 0.16 };
  // dopasowanie jak u klubów polskich; znajomość – względem profilu toru gospodarza
  let best = usual, bv = 0.03;
  const luckOf = p => (teamStrength(homeRids) - teamStrength(awayRids) + 0.35) * (surfFx({ g: [0.5, 0.5, 0.5], moist: 0.5, ruts: 0.15 }).noiseK / surfFx({ g: p.g, moist: p.moist, ruts: 0.15 }).noiseK - 1);
  for (const p of trackCandidates(usual)) {
    const v = teamTrackFit(homeRids, p) - teamTrackFit(awayRids, p) + luckOf(p) - 0.35 * (1 - trackFamiliarity(p, usual)) + (rr() - 0.5) * 0.04;
    if (v > bv) { bv = v; best = p; }
  }
  trackInit(m, { usual, plan: { g: best.g.slice(), moist: best.moist }, q: 10, ctl: 'ref' });
}
// Przerwa techniczna po biegu (gradingAfter): polecenia gracza (gospodarz meczu na żywo) albo AI / sędziego
function trackBreakNote(m, orders, long) {
  if (!m.surf) return '';
  const S = m.surf;
  let o = orders;
  if (!o) {
    let target = S.plan;
    // AI gospodarza przegrywające co najmniej 6 pkt szuka toru lepszego dla swoich (z poziomu punktowego w meczu)
    if (S.ctl === 'H' && m.score && m.score.H - m.score.A <= -6 && m.homeId !== G.clubId) {
      const rids = t => Object.entries(m.riders).filter(([, s]) => s.team === t && !s.out).map(([id]) => Number(id));
      target = aiTrackPlan(m.homeId, rids('H'), rids('A'), m.id + ':' + m.heats.length);
    }
    o = aiBreakOrders(S, target);
  }
  (m.breaks = m.breaks || []).push({ after: m.heats.length, ...o, by: orders ? 'gracz' : S.ctl === 'H' ? 'gospodarz' : 'sędzia' });
  return surfGrade(S, o, long);
}
// Długa przerwa techniczna: KLŻ po VII biegu (10 min)
const longBreak = (m, heatNo) => heatNo === 7 && m.kind === 'league' && G.clubs[m.homeId] && G.clubs[m.homeId].league === 'KLZ';
function heatGrading(tableId, heatNo) {
  try { const t = SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES, tableId); const h = t && t.heats.find(x => x.no === heatNo); return !!(h && h.gradingAfter); } catch (e) { return false; }
}
const surfSnap = S => S ? { g: S.g.map(x => round2(x)), moist: round2(S.moist), ruts: round2(S.ruts || 0) } : null;
