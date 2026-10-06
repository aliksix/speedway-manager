'use strict';
// Trening i rozwój atrybutów: fazy roku (okna treningowe), jakość treningu (sztab × baza × wpływ klubu),
// profile trenerów (które atrybuty rosną szybciej), naturalny rozwój młodych, zmiany cech ukrytych, historia atrybutów.
//
// Model: tygodniowy przyrost CA z krzywej wieku (js/ability.js: developWeek) to „budżet” rozwoju. Dzielimy go na grupy
// atrybutów według fazy kariery, a każda grupa realizuje się w swoim oknie roku (fizyczne – zima, technika – tor),
// w tempie zależnym od jakości treningu. CA wynika z atrybutów (5 × średnia ważona), a PA pozostaje sufitem.
// Dobry trening pozwala wyprzedzić krzywą (przełomowy rok), słaby zostawia zaległość, którą z wiekiem coraz trudniej odrobić.

// ---------- Fazy roku ----------
const TRAIN_PHASES = {
  off: { name: 'Roztrenowanie', short: 'roztrenowanie', win: { tech: 0.2, physical: 0.3, mental: 0.5, workshop: 1 },
    desc: 'Odpoczynek po sezonie, leczenie urazów, przegląd i budowa sprzętu na nowy sezon.' },
  winter: { name: 'Zima – przygotowanie motoryczne', short: 'motoryka', win: { tech: 0.1, physical: 2.5, mental: 0.8, workshop: 0.8 },
    desc: 'Siłownia, wydolność, koordynacja. Bez toru technika praktycznie stoi – najmocniej rosną atrybuty fizyczne.' },
  pre: { name: 'Przedsezon – treningi na torze', short: 'tor', win: { tech: 2, physical: 0.8, mental: 0.6, workshop: 1.2 },
    desc: 'Pierwsze jazdy, sparingi i dopasowanie sprzętu – najszybciej rośnie technika jazdy.' },
  season: { name: 'Sezon', short: 'sezon', win: { tech: 1, physical: 0.3, mental: 1.2, workshop: 1 },
    desc: 'Technika rośnie z liczbą startów, mentalność z doświadczeniem meczowym; fizyczne są głównie utrzymywane.' },
};
function phaseIdOf(date) {
  const md = date.slice(5, 10);
  if (md >= '10-15' && md <= '11-30') return 'off';
  if (md >= '12-01' || md < '03-01') return 'winter';
  if (md < '04-11') return 'pre';
  return 'season';
}
const trainingPhase = (date = G.date) => ({ id: phaseIdOf(date), ...TRAIN_PHASES[phaseIdOf(date)] });
// Średnie okno w roku = 1 (rozkład w czasie zmienia się, roczna suma nie)
const WIN_NORM = (() => {
  const n = { tech: 0, physical: 0, mental: 0, workshop: 0 };
  const d = new Date(Date.UTC(2025, 0, 1));
  for (let i = 0; i < 365; i++, d.setUTCDate(d.getUTCDate() + 1)) { const w = TRAIN_PHASES[phaseIdOf(d.toISOString().slice(0, 10))].win; for (const g in n) n[g] += w[g] / 365; }
  return n;
})();

// ---------- Profile trenerów ----------
const TRAIN_PROFILES = {
  start: { name: 'Startowiec', desc: 'Start spod taśmy i pierwszy łuk.', attrs: { start: 1, firstBend: 1, reflexes: 0.7, anticipation: 0.6, concentration: 0.4 } },
  lines: { name: 'Ścieżki i mijanie', desc: 'Wybór ścieżek, mijanie i obrona pozycji.', attrs: { lines: 1, passing: 1, inside: 0.8, outside: 0.8, defending: 0.7, decisions: 0.4 } },
  slide: { name: 'Ślizg i nawierzchnie', desc: 'Kontrola gazu, ślizg i jazda na trudnym torze.', attrs: { slide: 1, throttle: 1, surfaces: 0.9, balance: 0.6, adaptability: 0.6 } },
  fitness: { name: 'Motoryk', desc: 'Siła, wytrzymałość, zwinność i równowaga.', attrs: { strength: 1, stamina: 1, agility: 0.9, balance: 0.8, reflexes: 0.5, recovery: 0.6 } },
  mental: { name: 'Mentalny motywator', desc: 'Opanowanie, koncentracja i waleczność.', attrs: { composure: 1, concentration: 1, fighting: 0.8, bravery: 0.7, decisions: 0.6 } },
  team: { name: 'Drużynowy', desc: 'Jazda parą, współpraca i dyscyplina.', attrs: { teamRiding: 1, teamwork: 1, discipline: 0.8, leadership: 0.4 } },
  workshop: { name: 'Warsztatowiec', desc: 'Dopasowanie sprzętu i wiedza techniczna.', attrs: { setup: 1, techKnowledge: 1 } },
  basics: { name: 'Wychowawca', desc: 'Podstawy jazdy: gaz, równowaga, ślizg i start.', attrs: { throttle: 0.9, balance: 0.9, slide: 0.8, start: 0.7, discipline: 0.7, bravery: 0.5 } },
};
// Nowe role sztabu (trening) – kluby AI zatrudniają je z prawdopodobieństwem zależnym od ligi
const TRAIN_ROLES = ['fitness', 'psych', 'miniCoach'];
const TRAIN_ROLE_CHANCE = { fitness: { PGE: 0.9, '2E': 0.5, KLZ: 0.25 }, psych: { PGE: 0.45, '2E': 0.15, KLZ: 0.05 }, miniCoach: { PGE: 0.7, '2E': 0.5, KLZ: 0.35 } };
const NEW_STAFF_ATTRS = ['fitness', 'psychology', 'mini', 'manMgmt'];

function pickWeighted(list, u) { const t = sum(list.map(x => x[1])); let x = u * t; for (const [k, w] of list) { if ((x -= w) < 0) return k; } return list[list.length - 1][0]; }
function profileCandidates(s) {
  const a = s.attrs, r = s.role;
  if (r === 'fitness') return [['fitness', 1]];
  if (r === 'psych') return [['mental', 1]];
  if (r === 'mechanic') return [['workshop', 1]];
  if (r === 'miniCoach') return [['basics', 3], ['start', 0.5], ['slide', 0.5]];
  if (!['coach', 'assistant', 'manager', 'youth'].includes(r)) return null;
  return [['start', 1], ['lines', 1], ['slide', 1], ['fitness', (a.fitness || 5) / 20], ['mental', ((a.motivation || 5) + (a.psychology || 5)) / 30],
    ['team', 0.5], ['workshop', (a.tech || 5) / 40], ['basics', r === 'youth' ? 1.5 : (a.youth || 5) / 40]];
}
// Uzupełnia osobę ze sztabu o nowe atrybuty, profil i cechy ukryte (deterministycznie – zapis i nowa gra dają to samo)
function ensureStaffModel(s) {
  const role = STAFF_ROLES[s.role];
  const key = s.name + '|' + s.role;
  const lvl = role ? sum(role.attrs.map(k => s.attrs[k] || 8)) / role.attrs.length : 8;
  for (const k of NEW_STAFF_ATTRS) if (s.attrs[k] == null) {
    const own = role && role.attrs.includes(k);
    s.attrs[k] = clamp(Math.round(own ? lvl + hgauss(key + k) * 2 : lvl * 0.55 + hgauss(key + k) * 2.5), own ? 3 : 1, 20);
  }
  if (s.profile === undefined) {
    const cand = profileCandidates(s);
    if (!cand) s.profile = null;
    else {
      const main = pickWeighted(cand, hrand(key + 'pm'));
      const rest = cand.filter(c => c[0] !== main);
      s.profile = { main, side: rest.length && hrand(key + 'ps') < 0.7 ? pickWeighted(rest, hrand(key + 'ps2')) : null };
    }
  }
  if (!s.hidden) {
    const age = s.born ? ageAt(s.born, G.date) : 40 + Math.round(hgauss(key + 'age') * 8);
    s.hidden = { authority: clamp(Math.round((s.rep || lvl) + hgauss(key + 'au') * 3), 1, 20), modern: clamp(Math.round(13 - (age - 40) / 4 + hgauss(key + 'mo') * 3), 1, 20),
      determination: clamp(Math.round(11 + hgauss(key + 'de') * 3.5), 1, 20) };
  }
  return s;
}
// Opis cech ukrytych trenera (jak charakter zawodnika)
function staffCharLines(s) {
  const h = s.hidden || {}, out = [];
  if (h.authority >= 15) out.push('Wielki autorytet – słuchają go także gwiazdy.'); else if (h.authority <= 6) out.push('Mały autorytet – doświadczeni zawodnicy go nie słuchają.');
  if (h.modern >= 15) out.push('Nowoczesne metody: dane, wideo, praca z psychologiem.'); else if (h.modern <= 6) out.push('Trener starej daty – „tor uczy najlepiej”.');
  if (h.determination >= 15) out.push('Bardzo zdeterminowany, wymagający.'); else if (h.determination <= 6) out.push('Mało wymagający, pobłażliwy.');
  return out;
}
// Co o profilu trenera wie klub gracza: główny profil to reputacja w środowisku; poboczny i cechy ukryte – po ~4 miesiącach
// współpracy albo z oceny dyrektora/skauta (ocena talentu), która może się mylić
function staffKnown(s) {
  if (s.clubId === G.clubId) return !s.joined || s.joined <= GAME_START || dayDiff(s.joined, G.date) >= 120 ? 'full' : 'main';
  return judgingOf(G.clubId) >= 13 ? 'guess' : 'main';
}
function staffProfileView(s) {
  if (!s.profile) return null;
  const k = staffKnown(s), main = TRAIN_PROFILES[s.profile.main];
  let side = '—';
  if (k === 'full') side = s.profile.side ? TRAIN_PROFILES[s.profile.side].name : 'brak';
  else if (k === 'guess') {
    const wrong = hrand(G.clubId + ':' + s.id + 'side') > 0.55 + judgingOf(G.clubId) / 60;
    const shown = wrong ? Object.keys(TRAIN_PROFILES).filter(p => p !== s.profile.main)[Math.floor(hrand(s.id + 'ws') * 7)] : s.profile.side;
    side = shown ? `prawdopodobnie: ${TRAIN_PROFILES[shown].name.toLowerCase()}` : 'prawdopodobnie brak';
  } else side = 'nieznany – poznasz go po kilku miesiącach współpracy';
  return { main, side, known: k, chars: k === 'full' ? staffCharLines(s) : k === 'guess' ? staffCharLines(s).map(l => 'Podobno: ' + l.charAt(0).toLowerCase() + l.slice(1)) : [] };
}

// ---------- Kto trenuje kogo ----------
const MINI_CATS = ['c50', 'c85'];
const TC_W = new WeakMap();
function trainCat(x) {
  if (x.cat) return MINI_CATS.includes(x.cat) ? 'mini' : 'academy';
  const c = TC_W.get(x);
  if (c && c.d === G.date) return c.v;
  const v = isKid(x) ? (MINI_CATS.includes(x.cat) ? 'mini' : 'academy') : ageYears(x.born) <= 21.5 ? 'junior' : 'senior';
  TC_W.set(x, { d: G.date, v });
  return v;
}
// Waga roli w treningu danej grupy zawodników
const ROLE_REL = {
  senior: { coach: 1, assistant: 0.6, u24Coach: 0.4, manager: 0.3, youth: 0.2, fitness: 1, psych: 1, mechanic: 1 },
  junior: { juniorCoach: 1, youth: 0.8, coach: 0.8, u24Coach: 0.7, assistant: 0.6, manager: 0.2, fitness: 1, psych: 1, mechanic: 1, miniCoach: 0.3 },
  academy: { youth: 1, juniorCoach: 0.6, miniCoach: 0.5, coach: 0.3, assistant: 0.3, fitness: 0.6, psych: 0.5, mechanic: 0.6 },
  mini: { miniCoach: 1, youth: 0.7, coach: 0.15, fitness: 0.3, psych: 0.3, mechanic: 0.4 },
};
// Umiejętność osoby w treningu grupy atrybutów
function staffSkillFor(s, g, cat) {
  const a = s.attrs;
  if (g === 'tech') return cat === 'mini' ? Math.max(a.mini || 0, (a.youth || 0) * 0.8) : (cat === 'junior' || cat === 'academy') && staffRoles(s).some(r => ['youth', 'juniorCoach', 'u24Coach'].includes(r)) ? Math.max(a.youth || 0, a.coaching || 0) : a.coaching || 0;
  if (g === 'physical') return a.fitness || 0;
  if (g === 'mental') return 0.6 * (a.psychology || 0) + 0.4 * (a.motivation || 0);
  return a.tech || 0;
}
// Ile osób w kategorii obsługuje sztab (pojemność zależy od zarządzania ludźmi)
let CAT_N = { date: null, map: new Map() };
function catSize(clubId, cat) {
  if (CAT_N.date !== G.date) {
    CAT_N = { date: G.date, map: new Map() };
    const add = (c, k) => { const key = c + '|' + k; CAT_N.map.set(key, (CAT_N.map.get(key) || 0) + 1); };
    for (const r of Object.values(G.riders)) if (r.clubId && !r.retired) add(r.clubId, trainCat(r));
    for (const k of Object.values(G.academy)) if (k.clubId && !k.catalogOnly) add(k.clubId, trainCat(k));
  }
  return CAT_N.map.get(clubId + '|' + cat) || 0;
}
const FAC_FOR = { tech: c => c.facilities.training, physical: c => c.facilities.gym ?? 1, mental: () => 3, workshop: c => c.facilities.workshop };
function facilityFor(c, g, cat) {
  // motocykle szkółki: za mało maszyn – adepci dzielą się sprzętem, mniej jazdy (js/engine-registry.js: academyBikeFactor)
  const bf = typeof academyBikeFactor === 'function' && (cat === 'mini' || cat === 'academy') ? academyBikeFactor(c, cat) : 1;
  if (g === 'tech' && cat === 'mini') return (c.facilities.miniTrack || 0) * bf;
  if (g === 'tech' && cat === 'academy') return (c.facilities.training + (c.facilities.academy || 1)) / 2 * bf;
  return FAC_FOR[g](c);
}
// Jakość treningu klubu dla kategorii i grupy (~0.6–1.35, przeciętny klub ≈ 1) + profile trenerów (premie do atrybutów)
let TQ = { date: null, map: new Map() };
function clubTraining(clubId, cat) {
  if (TQ.date !== G.date) TQ = { date: G.date, map: new Map() };
  const key = clubId + '|' + cat;
  if (TQ.map.has(key)) return TQ.map.get(key);
  const c = G.clubs[clubId], rel = ROLE_REL[cat];
  // wkład osoby: najważniejsza z jej ról dla tej grupy zawodników × skuteczność (kilka ról – mniej czasu na każdą)
  const relOf = s => Math.max(0, ...staffRoles(s).map(r => rel[r] || 0)) * staffEff(s);
  const staff = clubStaff(clubId).filter(s => relOf(s) > 0);
  const n = Math.max(1, catSize(clubId, cat));
  const res = { q: {}, lead: {}, boost: {}, cov: {} };
  for (const g of Object.keys(ATTRS)) {
    const eff = staff.map(s => [s, relOf(s) * staffSkillFor(s, g, cat)]).sort(by(x => x[1], -1));
    const S = eff.length ? eff[0][1] + 0.15 * sum(eff.slice(1, 3).map(x => Math.max(0, x[1] - 6))) : 4;
    const lead = eff.length ? eff[0][0] : null;
    const cap = 6 + (lead ? (lead.attrs.manMgmt || 8) / 2 : 0) + 3 * eff.slice(1).filter(x => x[1] >= 8).length;
    // szkółka: pojemność trenerów i budżet (js/intake.js: academyLoad) – przepełnienie osłabia trening wszystkich adeptów
    const cov = (cat === 'mini' || cat === 'academy') && typeof academyLoad === 'function' ? academyLoad(clubId).cov : Math.min(1, cap / n);
    const F = facilityFor(c, g, cat);
    let st = 0.032 * (S - 8);
    if (st > 0) st *= Math.min(1, 0.55 + 0.1 * F);
    // autorytet: gwiazdy słabo reagują na trenera bez autorytetu (seniorzy)
    res.q[g] = clamp((1 + st + 0.04 * (F - 2.5)) * (0.7 + 0.3 * cov), 0.5, 1.4);
    res.lead[g] = lead ? lead.id : null;
    res.cov[g] = cov;
  }
  // profile: premia do atrybutów = suma (waga roli × kompetencja × profil)
  for (const s of staff) {
    if (!s.profile) continue;
    const comp = clamp((Math.max(...Object.keys(ATTRS).map(g => staffSkillFor(s, g, cat))) - 6) / 12, 0, 1) * relOf(s);
    for (const [p, w] of [[s.profile.main, 1], [s.profile.side, 0.5]]) {
      if (!p) continue;
      for (const [k, v] of Object.entries(TRAIN_PROFILES[p].attrs)) res.boost[k] = (res.boost[k] || 0) + comp * w * v;
    }
  }
  TQ.map.set(key, res);
  return res;
}
// Ligi zagraniczne zawodnika – im więcej lig, tym mniej czasu w klubie: przydział sezonu (składy lig, js/foreign.js), bez niego baza startów 2021–2025
function foreignLeagues(r) {
  if (r.fl && r.fl.season === G.season) return r.fl.list.length;
  const seen = new Set();
  for (const a of r.activity || []) {
    if (!/20(2[4-9])/.test(a) || /^Polska|Rider Index|archiwum|Grand Prix|SGP|Mistrz/i.test(a)) continue;
    const m = a.match(/^([^–-]+)[–-]\s*([^(0-9]+)/);
    if (m) seen.add((m[1] + m[2]).trim());
  }
  return seen.size;
}
// Wpływ klubu (0–1): juniorzy prawie cały czas w klubie, gwiazdy z kilkoma ligami i Grand Prix – rzadko
const CI_W = new WeakMap();
function clubInfluence(x) {
  const c = CI_W.get(x);
  if (c && c.d === G.date && c.club === x.clubId) return c.v;
  const v = clubInfluenceCalc(x);
  CI_W.set(x, { d: G.date, club: x.clubId, v });
  return v;
}
function clubInfluenceCalc(x) {
  if (!x.clubId) return 0;
  if (x.cat || isKid(x)) return 1;
  const age = ageYears(x.born);
  // dni dostępne w klubie (terminarz: starty, podróże, ligi zagraniczne, pobyt w domu poza Polską) – js/schedule.js
  if (typeof availShare === 'function' && G.riders[x.id]) {
    const a = availShare(x), gp = G.sgp && G.sgp.riders && G.sgp.riders.includes(x.id);
    return age <= 21.5 ? clamp(0.3 + 0.65 * a, 0.3, 0.95) : clamp(0.2 + 0.7 * a - (gp ? 0.15 : 0), 0.2, 0.9);
  }
  if (age <= 21.5) return 0.9;
  const gp = G.sgp && G.sgp.riders && G.sgp.riders.includes(x.id);
  return clamp(0.8 - 0.12 * foreignLeagues(x) - (gp ? 0.15 : 0) - (!hasNat(x, 'POL') ? 0.1 : 0), 0.3, 0.85);
}
// Prywatny sztab zawodnika (trener, motoryk, psycholog na własny koszt) – rośnie z poziomem i profesjonalizmem
function privateStaff(x) {
  if (x.cat || isKid(x)) return 4 + (x.parentsSupport || 3) * 0.8;
  const p = x.hidden ? x.hidden.professionalism : 10;
  return clamp(4.5 + (x.ca / 5) * 0.55 + (p - 10) * 0.3, 2, 17);
}
// Jakość treningu konkretnego zawodnika w grupie atrybutów
function trainQuality(x, g, a = clubInfluence(x)) {
  const cat = trainCat(x);
  const qPriv = clamp(1 + 0.032 * (privateStaff(x) - 8), 0.6, 1.3);
  if (!a || !G.clubs[x.clubId]) return qPriv;
  let qc = clubTraining(x.clubId, cat).q[g];
  // trener bez autorytetu u gwiazdy – mniejszy efekt
  if (cat === 'senior') {
    const lead = G.staff[clubTraining(x.clubId, cat).lead[g]];
    if (lead && lead.hidden && x.ca / 5 > lead.hidden.authority + 2) qc = 1 + (qc - 1) * 0.6;
  }
  return a * qc + (1 - a) * qPriv;
}
function profileBoost(x) {
  if (!x.clubId || !G.clubs[x.clubId]) return {};
  return clubTraining(x.clubId, trainCat(x)).boost;
}

// ---------- Naturalny rozwój młodych ----------
// Część przyrostu, która przychodzi sama (dojrzewanie, rodzice, sama jazda), niezależnie od okna i trenera
const NATURAL = { physical: 0.6, mental: 0.5, tech: 0.15, workshop: 0.3 };
function naturalShare(g, age, x) {
  const f = age <= 14 ? 1 : age >= 20 ? 0 : (20 - age) / 6;
  let n = NATURAL[g] * f;
  if (g === 'mental') n = Math.max(n, 0.2); // dojrzałość życiowa i doświadczenie przez całe życie
  if ((g === 'mental' || g === 'workshop') && x.parentsSupport) n *= 0.8 + 0.08 * x.parentsSupport;
  return clamp(n, 0, 0.8);
}

// ---------- Rozwój tygodniowy: rozkład na grupy i atrybuty ----------
const GROUPS = Object.keys(ATTRS);
const GROUP_KEYS = Object.fromEntries(GROUPS.map(g => [g, ATTRS[g].list.map(l => l[0])]));
const GROUP_W = (() => { const w = {}; for (const k in ATTR_W) w[ATTR_GROUP[k]] = (w[ATTR_GROUP[k]] || 0) + ATTR_W[k]; return w; })();
const GS_CACHE = new Map();
function groupShares(age, up) {
  const ck = (age < 22 ? 0 : age < 30 ? 1 : 2) + (up ? 'u' : 'd') + (age >= 30 ? '' : '');
  if (GS_CACHE.has(ck)) return GS_CACHE.get(ck);
  const raw = {};
  for (const g of Object.keys(GROUP_W)) raw[g] = phaseMult(g, age, up) * GROUP_W[g];
  const t = sum(Object.values(raw));
  for (const g in raw) raw[g] /= t;
  GS_CACHE.set(ck, raw);
  return raw;
}
// Ekspozycja na tor w sezonie: liczba biegów (zawodnik) lub zawodów (adept) w ostatnim tygodniu
function trackExposure(x, dv) {
  let n;
  if (x.cat || isKid(x)) { n = (x.meets || 0) - (dv.wm ?? (x.meets || 0)); dv.wm = x.meets || 0; n *= 5; }
  else {
    const st = x.stats && x.stats[G.season], h = st ? st.heats || 0 : 0;
    n = dv.whS === G.season ? h - (dv.wh || 0) : h;
    dv.wh = h; dv.whS = G.season;
    if (x.slog && typeof heatsRecent === 'function') n = heatsRecent(x, 7); // wszystkie starty: Polska, zagranica, zawody, sparingi
  }
  return clamp(0.75 + 0.06 * Math.max(0, n), 0.75, 1.35);
}
// Przyrost (grow ≥ 0) i spadek (decl ≤ 0) CA z tygodnia → zmiany atrybutów; CA = wynik atrybutów (sufit PA)
function applyDevelopment(x, grow, decl, age, focusKeys, noise = 0) {
  const a = x.attrs, ph = trainingPhase(), dv = x.dev;
  const exp = trackExposure(x, dv);
  const boost = profileBoost(x), infl = clubInfluence(x);
  const q = {};
  for (const g of GROUPS) q[g] = trainQuality(x, g, infl);
  const cb = typeof campBoost === 'function' ? campBoost(x) : null; // obozy przygotowawcze (js/camps.js)
  const pl = typeof planBoost === 'function' ? planBoost(x) : null; // własny plan treningu klubu gracza, zimowe starty (js/planner.js)
  const log = dv.wk = { d: G.date, ph: ph.id, g: {}, ...(cb ? { camp: cb.track } : {}) };
  if (grow > 0) {
    const sh = groupShares(age, true);
    for (const g of Object.keys(ATTRS)) {
      const nat = naturalShare(g, age, x);
      let win = ph.win[g] / WIN_NORM[g];
      if (g === 'tech' && (ph.id === 'season' || ph.id === 'pre')) win *= exp;
      if (g === 'tech' && ph.id === 'pre' && typeof trackWeekFactor === 'function') { const tw = trackWeekFactor(); win *= cb && cb.track ? (tw * (7 - Math.min(7, cb.track)) + 1.25 * Math.min(7, cb.track)) / 7 : tw; } // zimny marzec – mniej jazdy; dni torowe na obozie za granicą liczą się jak dobre
      if (cb) win = win * (cb.mul[g] || 1) + (cb.add[g] || 0);
      if (pl) win = win * (pl.mul[g] || 1) + (pl.add[g] || 0);
      // premia profilu: trenerzy wyspecjalizowani w danej grupie podnoszą jej tempo
      const keys = GROUP_KEYS[g];
      let pb = 0; for (const k of keys) pb += ATTR_W[k] * Math.min(1.5, boost[k] || 0);
      pb /= GROUP_W[g];
      // część naturalna liczona z przeciętną jakością treningu ligi (≈1.12), żeby młodzi nie tracili na samym podziale
      const amt = grow * sh[g] * (nat * 1.12 + (1 - nat) * win * q[g] * (1 + 0.25 * pb * infl));
      log.g[g] = round2(amt);
      spreadGroup(x, g, amt, focusKeys, boost, infl);
    }
  }
  if (decl < 0) {
    const sh = groupShares(age, false);
    for (const g of Object.keys(ATTRS)) {
      // motoryka hamuje starzenie fizyczne (zima + dobry motoryk + siłownia)
      const f = g === 'physical' ? clamp(1 + (1.1 - q.physical) * 1.5, 0.6, 1.4) : 1;
      const amt = decl * sh[g] * f;
      log.g[g] = round2((log.g[g] || 0) + amt);
      spreadGroup(x, g, amt, null, null, 0);
    }
  }
  // losowe wahania tygodnia – neutralne (bez mnożników treningu)
  if (noise) { const sh = groupShares(age, noise > 0); for (const g of Object.keys(ATTRS)) spreadGroup(x, g, noise * sh[g], null, null, 0, true); }
  // motoryka zimą wzmacnia też regenerację (atrybut spoza CA)
  if (ph.id === 'winter' && age < 32 && a.recovery != null) a.recovery = clamp(a.recovery + 0.004 * (q.physical - 0.8), 1, 20);
  let ca = caOfAttrs(a);
  // doświadczenie: decyzje i spokój rosną do ok. 36 lat nawet przy spadku formy – bez zmiany CA (przesunięcie profilu)
  if (age >= 27 && age <= 36) { for (const k of ['decisions', 'anticipation', 'composure', 'adaptability']) a[k] = clamp(a[k] + 0.008, 1, 20); const dd = (ca - caOfAttrs(a)) / 5; for (const k in ATTR_W) a[k] = clamp(a[k] + dd, 1, 20); }
  if (ca > x.pa && grow > 0) { normalizeAttrs(a, Math.max(x.pa, Math.min(ca, x.ca))); ca = caOfAttrs(a); }
  x.ca = clamp(ca, 1, 100);
}
// Rozdział przyrostu grupy (w jednostkach CA) na atrybuty: podatność zawodnika × profil trenerów × plan indywidualny
function spreadGroup(x, g, amt, focusKeys, boost, infl, plain = false) {
  if (!amt) return;
  const a = x.attrs, up = amt > 0;
  const keys = GROUP_KEYS[g];
  const w = {};
  for (const k of keys) {
    const aff = plain ? 1 : attrAffinity(x, k, up);
    let f = aff * (0.7 + rnd() * 0.6);
    if (up && boost) {
      const b = Math.min(1.5, boost[k] || 0) * infl;
      f *= 1 + 0.6 * b;
      if (b > 0.3 && aff > 1.15) f *= 1.15; // trener trafił w naturalny styl zawodnika
    }
    if (up && focusKeys && focusKeys.length) f *= focusKeys.includes(k) ? 1.8 : 0.75;
    w[k] = f;
  }
  const den = sum(keys.map(k => ATTR_W[k] * w[k])) || 1;
  for (const k of keys) a[k] = clamp(a[k] + amt * (ATTR_W_SUM / 5) * w[k] / den, 1, 20);
}

// ---------- Cechy ukryte: powolne zmiany (koniec sezonu) ----------
function seasonHiddenEvents(x) {
  const h = x.hidden;
  if (!h) return;
  const age = ageYears(x.born);
  const plast = age <= 19 ? 1 : age <= 23 ? 0.7 : age <= 28 ? 0.35 : 0.12;
  const c = x.clubId && G.clubs[x.clubId];
  const disc = c ? staffBest(c.id, 'discipline') : 8;
  const psy = c ? Math.max(5, ...clubStaff(c.id).filter(s => s.role === 'psych').map(s => s.attrs.psychology || 0)) : 5;
  // mentor: doświadczony lider w drużynie (dla młodych)
  const mentor = c && age <= 23 ? Math.max(8, ...clubRiders(c.id).filter(r => ageYears(r.born) >= 28).map(r => r.attrs.leadership || 0)) : 10;
  const k = (x.id || x.name) + '|' + G.season;
  const before = h.professionalism;
  const dP = clamp(plast * (hgauss(k + 'hp') * 0.35 + 0.04 * (disc - 10) + 0.03 * (psy - 8) + 0.03 * (mentor - 10) + 0.03 * ((h.ambition ?? 10) - 10)), -1, 1);
  const dC = clamp(plast * 0.7 * (hgauss(k + 'hc') * 0.25 + 0.04 * (psy - 8)), -0.7, 0.7);
  const dA = clamp(plast * (hgauss(k + 'ha') * 0.3 + (x.dev && x.ca - x.dev.seasonCa > 3 ? 0.25 : 0)), -0.8, 0.8);
  h.professionalism = round1(clamp(h.professionalism + dP, 1, 20));
  h.consistency = round1(clamp(h.consistency + dC, 1, 20));
  h.ambition = round1(clamp((h.ambition ?? 10) + dA, 1, 20));
  if (x.clubId === G.clubId && G.riders[x.id] && Math.abs(h.professionalism - before) >= 0.6) {
    const up = h.professionalism > before;
    addMsg({ category: 'drużyna', from: 'Trener', title: up ? `${x.name} poważniej podchodzi do przygotowań` : `${x.name} – spadek zaangażowania`,
      body: `<p>${up ? `${esc(x.name)} zrozumiał, że bez codziennej pracy nie osiągnie sukcesu – trenuje sumienniej i dba o regenerację.` : `${esc(x.name)} odpuszcza treningi i przygotowanie sprzętu. Warto z nim porozmawiać – pomogą wymagający trener, psycholog i doświadczony lider w drużynie.`}</p>`,
      link: `#/zawodnik/${x.id}/rozwoj` });
  }
}

// ---------- Historia atrybutów (osobna kolekcja G.attrhist, zapisywana raz w miesiącu) ----------
// Wpis miesięczny: ciąg znaków, 2 znaki base-36 na wartość × 50 (dokładność 0,02); kolejność AH_KEYS
const AH_KEYS = [...ATTR_KEYS, 'leadership', 'resilience', 'recovery', 'ca'];
const AH_MAX = 72;
function packAttrs(x) { return AH_KEYS.map(k => Math.round(clamp(k === 'ca' ? x.ca / 5 : x.attrs[k] ?? 0, 0, 25.9) * 50).toString(36).padStart(2, '0')).join(''); }
function unpackAttrs(s) { const o = {}; AH_KEYS.forEach((k, i) => { const v = parseInt(s.substr(i * 2, 2), 36) / 50; o[k] = k === 'ca' ? v * 5 : v; }); return o; }
function recordAttrHist(x) {
  if (x.ca == null || !x.attrs) return;
  G.attrhist = G.attrhist || {};
  const id = String(x.id), h = G.attrhist[id] || (G.attrhist[id] = { id, d: [], v: [] });
  const d = G.date.slice(0, 7);
  const p = packAttrs(x);
  if (h.d[h.d.length - 1] === d) h.v[h.v.length - 1] = p;
  else { h.d.push(d); h.v.push(p); }
  while (h.d.length > AH_MAX) { h.d.shift(); h.v.shift(); }
  h.u = G.date;
}
function moveAttrHist(fromId, toId) {
  // adept z licencją dostaje nowe id zawodnika – wyniki jego dawnych zawodów (protokoły z id adepta) wskazują przez alias (R w js/competitions.js)
  if (/^A/.test(String(fromId))) (G.kidAlias ||= {})[fromId] = toId;
  if (!G.attrhist || !G.attrhist[fromId]) return;
  G.attrhist[toId] = { ...G.attrhist[fromId], id: String(toId) };
  delete G.attrhist[fromId];
}
function monthlyAttrHist() {
  for (const r of Object.values(G.riders)) if (r.active && !r.retired) recordAttrHist(r);
  for (const k of Object.values(G.academy)) if (!k.catalogOnly && k.ca != null) recordAttrHist(k);
  // usuwanie historii zawodników, którzy zniknęli z gry
  for (const id of Object.keys(G.attrhist || {})) if (!G.riders[id] && !G.academy[id]) delete G.attrhist[id];
}
function attrHistSeries(x) {
  const h = G.attrhist && G.attrhist[String(x.id)];
  return h ? h.d.map((d, i) => ({ d, v: unpackAttrs(h.v[i]) })) : [];
}
// Zmiana atrybutu w ostatnich ~3 miesiącach (porównanie z wpisem sprzed 3 miesięcy albo najstarszym)
function attrTrend(x, k) {
  const h = G.attrhist && G.attrhist[String(x.id)];
  if (!h || !h.v.length) return null;
  const cur = G.date.slice(0, 7);
  let i = h.d.length - 1;
  while (i > 0 && monthsBetween(h.d[i], cur) < 3) i--;
  if (h.d[i] === cur) return null;
  const old = parseInt(h.v[i].substr(AH_KEYS.indexOf(k) * 2, 2), 36) / 50;
  const now = k === 'ca' ? x.ca / 5 : x.attrs[k];
  return { d: now - old, months: monthsBetween(h.d[i], cur) };
}
function monthsBetween(a, b) { return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)); }

// ---------- Dzień gry: komunikaty o fazach ----------
function trainingDay() {
  const md = G.date.slice(5, 10);
  if (!['12-01', '03-01', '04-11', '10-15'].includes(md)) return;
  const ph = trainingPhase();
  addMsg({ category: 'drużyna', from: 'Trener', title: `Trening: ${ph.name.toLowerCase()}`, body: `<p>${esc(ph.desc)}</p><p>Jakość treningu w poszczególnych obszarach i bazę szkoleniową sprawdzisz w zakładce Sztab → Trening.</p>`, link: '#/sztab/trening' });
}

// ---------- Nowe role i obiekty: nowa gra i migracja zapisu ----------
function facilityDefaults(c) {
  const f = c.facilities;
  if (f.gym == null) f.gym = clamp(Math.round(c.budget / 8e6) + (c.league === 'PGE' ? 1 : 0), 1, 5);
  if (f.miniTrack == null) {
    const mini = Object.values(G.academy).some(k => k.clubId === c.id && MINI_CATS.includes(k.cat));
    f.miniTrack = mini ? clamp((f.academy || 1) - 1 + Math.round(hrand(c.name + 'mt')), 1, 4) : 0;
  }
}
function ensureTrainingModel() {
  let ch = false;
  for (const s of Object.values(G.staff)) if (!s.profile && s.profile !== null || !s.hidden || NEW_STAFF_ATTRS.some(k => s.attrs[k] == null)) { ensureStaffModel(s); ch = true; }
  if (G.trainingModel !== 1) {
    // obiekty treningowe; nowe role (motoryk, psycholog, trener miniżużla) – tylko prawdziwe osoby, bez generowania
    for (const c of Object.values(G.clubs)) facilityDefaults(c);
    G.attrhist = G.attrhist || {};
    G.trainingModel = 1;
    ch = true;
  }
  if (!G.attrhist || !Object.keys(G.attrhist).length) { G.attrhist = {}; monthlyAttrHist(); ch = true; }
  return ch;
}
