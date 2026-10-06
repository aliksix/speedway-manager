'use strict';
// Umiejętności zawodników: 28 atrybutów (1–20), CA i PA (1–100), krzywa wieku, rozwój i starzenie,
// wiedza klubów o zawodnikach (gwiazdki z niepewnością), opisy charakteru z atrybutów ukrytych.
// CA = 5 × średnia ważona 28 atrybutów (ATTR_W). Prawdziwe CA/PA są ukryte; gracz widzi ocenę swojego sztabu.

const ATTR_W = {
  start: 3, firstBend: 2.5, throttle: 2.5, slide: 2, lines: 2, passing: 2, reflexes: 2, setup: 2,
  inside: 1.5, outside: 1.5, defending: 1.5, surfaces: 1.5, concentration: 1.5, fighting: 1.5, decisions: 1.5, anticipation: 1.5,
  composure: 1, aggression: 1, bravery: 1, adaptability: 1, balance: 1, agility: 1, techKnowledge: 1,
  strength: 0.75, stamina: 0.75, teamRiding: 0.5, discipline: 0.5, teamwork: 0.5,
};
const ATTR_W_SUM = Object.values(ATTR_W).reduce((s, x) => s + x, 0);
const ATTR_GROUP = {};
for (const [g, def] of Object.entries(ATTRS)) for (const [k] of def.list) ATTR_GROUP[k] = g;
const HIDDEN_ATTRS = [['consistency', 'Powtarzalność'], ['professionalism', 'Profesjonalizm'], ['ambition', 'Ambicja']];

// Krzywa wieku: odsetek docelowego CA (PA) w danym wieku – szczyt 28–31 lat
const AGE_CURVE = { 5: .10, 6: .12, 7: .14, 8: .17, 9: .20, 10: .23, 11: .27, 12: .31, 13: .36, 14: .42, 15: .49, 16: .56, 17: .62, 18: .68, 19: .74, 20: .79,
  21: .83, 22: .87, 23: .90, 24: .93, 25: .955, 26: .975, 27: .99, 28: 1, 29: 1, 30: 1, 31: 1, 32: .995, 33: .99, 34: .985, 35: .975, 36: .965,
  37: .955, 38: .945, 39: .935, 40: .925, 41: .91, 42: .895, 43: .88, 44: .86, 45: .84, 46: .815, 47: .79, 48: .76, 49: .725, 50: .69 };
function ageCurve(a) {
  if (a <= 5) return AGE_CURVE[5] * Math.max(0.5, a / 5);
  if (a >= 50) return Math.max(0.3, AGE_CURVE[50] - (a - 50) * 0.04);
  const lo = Math.floor(a), t = a - lo;
  return AGE_CURVE[lo] * (1 - t) + AGE_CURVE[Math.min(50, lo + 1)] * t;
}
// Wiek odwrotny: w jakim wieku krzywa osiąga dany odsetek (część rosnąca)
function ageForCurve(f) { for (let a = 5; a <= 28; a += 0.05) if (ageCurve(a) >= f) return a; return 28; }
const ageYears = (born, date = G.date) => Math.max(0, (D(date) - D(String(born).length === 4 ? `${born}-07-01` : born)) / 31557600000);

// Klasy zawodników (CA w szczycie / obecnie)
const CA_CLASSES = [[87.5, 'Legenda'], [82.5, 'Gwiazda światowa'], [75, 'Czołówka Grand Prix'], [69, 'Lider PGE Ekstraligi'], [62.5, 'Solidny zawodnik PGE Ekstraligi'],
  [57.5, 'Zawodnik rotacyjny PGE / lider 2. Ekstraligi'], [50, 'Solidny zawodnik 2. Ekstraligi'], [42.5, 'Średniak niższych lig'], [35, 'Słaby ligowiec'],
  [27.5, 'Rezerwowy'], [17.5, 'Amator'], [0, 'Hobbysta']];
const caClass = ca => CA_CLASSES.find(c => ca >= c[0])[1];

// ---------- Losowość deterministyczna (profil zawodnika nie zależy od kolejności losowań w grze) ----------
const hrand = key => mulberry(hashStr(key))();
function hgauss(key) { const g = mulberry(hashStr(key)); let u = 0, v = 0; while (!u) u = g(); while (!v) v = g(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------- Atrybuty i CA ----------
function weightedAvg(a) { let s = 0; for (const k in ATTR_W) s += (a[k] ?? 10) * ATTR_W[k]; return s / ATTR_W_SUM; }
function caOfAttrs(a) { return weightedAvg(a) * 5; }
// Przesuwa atrybuty tak, żeby 5 × średnia ważona = CA (profil zachowany, granice 1–20)
function normalizeAttrs(a, ca) {
  const target = clamp(ca / 5, 1, 20);
  for (let i = 0; i < 6; i++) {
    const d = target - weightedAvg(a);
    if (Math.abs(d) < 0.005) break;
    const free = Object.keys(ATTR_W).filter(k => (d > 0 ? a[k] < 20 : a[k] > 1));
    const wFree = sum(free.map(k => ATTR_W[k])) || 1;
    for (const k of free) a[k] = clamp(a[k] + d * ATTR_W_SUM / wFree, 1, 20);
  }
  return a;
}
function syncSkill(r) {
  r.skill = round2(clamp(r.ca, 1, 100) / 5);
  r.potential = Math.round(clamp(r.pa, 1, 100));
}

// Profile wzorcowe (ustalone z użytkownikiem na podstawie stylu jazdy); skalowane do CA zawodnika
const STAR_PROFILES = {
  'Bartosz Zmarzlik': { attrs: { start: 18, firstBend: 18, slide: 19, throttle: 20, inside: 18, outside: 18, lines: 19, passing: 19, defending: 17, surfaces: 17, teamRiding: 13,
    concentration: 18, composure: 19, fighting: 20, aggression: 15, bravery: 17, decisions: 19, anticipation: 18, adaptability: 18, discipline: 18, teamwork: 13,
    reflexes: 17, strength: 15, balance: 18, agility: 16, stamina: 18, setup: 18, techKnowledge: 19, leadership: 16, resilience: 17, recovery: 18 },
    hidden: { consistency: 19, professionalism: 20, ambition: 19 } },
  'Maksym Drabik': { attrs: { start: 14, firstBend: 13, slide: 15, throttle: 15, inside: 13, outside: 16, lines: 14, passing: 16, defending: 12, surfaces: 13, teamRiding: 13,
    concentration: 13, composure: 11, fighting: 16, aggression: 16, bravery: 16, decisions: 13, anticipation: 13, adaptability: 12, discipline: 11, teamwork: 12,
    reflexes: 14, strength: 14, balance: 15, agility: 16, stamina: 15, setup: 12, techKnowledge: 13, leadership: 9, resilience: 14, recovery: 15 },
    hidden: { consistency: 9, professionalism: 15, ambition: 15 } },
};
// Style jazdy (odchylenia od poziomu zawodnika)
const STYLES = [
  ['startowiec', 0.22, { start: 2.5, firstBend: 2, reflexes: 1.5, defending: 1.5, concentration: 1, passing: -1.5, fighting: -1, outside: -1 }],
  ['dystansowiec', 0.22, { passing: 2.5, throttle: 1.5, slide: 1.5, outside: 1.5, fighting: 1.5, start: -2, firstBend: -1, defending: -1 }],
  ['technik', 0.2, { lines: 2, inside: 1.5, slide: 1.5, surfaces: 1.5, decisions: 1, anticipation: 1, setup: 1, aggression: -1.5, bravery: -1 }],
  ['wojownik', 0.14, { aggression: 2.5, bravery: 2, fighting: 2, passing: 1, outside: 1, discipline: -2, composure: -1.5, decisions: -1 }],
  ['wszechstronny', 0.22, {}],
];
function styleOf(name) { let x = hrand(name + '|styl'); for (const s of STYLES) { if ((x -= s[1]) < 0) return s; } return STYLES[STYLES.length - 1]; }

// Pełny profil zawodnika: atrybuty, ukryte cechy, parametry rozwoju. ext – atrybuty z pliku kalibracji (opcjonalnie)
function buildProfile(r, ext) {
  const age = ageYears(r.born);
  const key = r.name + '|' + (String(r.born).slice(0, 4));
  const star = STAR_PROFILES[r.name];
  const a = {};
  if (ext || star) {
    const src = star ? star.attrs : ext; // profile uzgodnione z użytkownikiem mają pierwszeństwo przed plikiem kalibracji
    for (const k of [...Object.keys(ATTR_W), 'leadership', 'resilience', 'recovery']) a[k] = clamp(src[k] ?? 10, 1, 20);
  } else {
    const base = r.ca / 5;
    const st = styleOf(key)[2];
    for (const k of Object.keys(ATTR_W)) {
      const g = ATTR_GROUP[k];
      let v = base + (st[k] || 0) + hgauss(key + k) * 1.15;
      if (age < 22) { if (g === 'mental' || g === 'workshop' || k === 'lines') v -= 1.3 * (22 - age) / 6; if (g === 'physical' || k === 'bravery' || k === 'aggression') v += 0.8; }
      if (age < 15 && g === 'workshop') v -= 1.5;
      if (age > 30) { if (['decisions', 'anticipation', 'composure', 'adaptability', 'lines'].includes(k) || g === 'workshop') v += Math.min(2, (age - 30) * 0.3);
        if (['reflexes', 'agility', 'stamina'].includes(k)) v -= Math.min(3, (age - 31) * 0.3); }
      a[k] = clamp(v, 1, 20);
    }
    a.leadership = clamp(5 + Math.max(0, age - 18) * 0.35 + (r.ca - 50) / 12 + hgauss(key + 'lead') * 2.5, 1, 20);
    a.resilience = clamp(12 + hgauss(key + 'res') * 3, 1, 20);
    a.recovery = clamp(12.5 - Math.max(0, age - 30) * 0.3 + hgauss(key + 'rec') * 3, 1, 20);
  }
  normalizeAttrs(a, r.ca);
  const hid = star ? { ...star.hidden }
    : ext && ext.consistency != null ? { consistency: ext.consistency, professionalism: ext.professionalism, ambition: ext.ambition }
    : { consistency: clamp(10.5 + (r.ca - 55) / 15 + hgauss(key + 'kons') * 3.5, 1, 20), professionalism: clamp(11 + (r.pa - 60) / 12 + hgauss(key + 'prof') * 3.5, 1, 20),
        ambition: clamp(11.5 + (r.pa - 60) / 15 + hgauss(key + 'amb') * 3.5, 1, 20) };
  for (const k in hid) hid[k] = round1(clamp(hid[k], 1, 20));
  for (const k in a) a[k] = round2(a[k]);
  r.attrs = a;
  r.hidden = hid;
  // dojrzewanie: przesunięcie krzywej (lata) dopasowane do obecnego CA/PA; starzenie: odporność, regeneracja, profesjonalizm
  const ratio = r.pa > 0 ? clamp(r.ca / r.pa, 0.05, 1) : 1;
  const mat = age < 27 && ratio < 0.999 ? clamp(ageForCurve(ratio) - age, -2.5, 3) : 0;
  r.dev = { maturity: round2(mat + hgauss(key + 'mat') * 0.3), aging: round2(clamp(0.5 * ((a.resilience + a.recovery) / 2 - 11) + 0.2 * (hid.professionalism - 11) + hgauss(key + 'age') * 1, -4, 5)),
    pa0: r.pa, seasonCa: r.ca };
  syncSkill(r);
  return r;
}

// ---------- Rozwój tygodniowy ----------
function devEnvRider(r) {
  const c = r.clubId && G.clubs[r.clubId];
  // trener i obiekty działają przez jakość treningu w oknach (js/training.js); bez tego modułu – stara formuła
  const coach = typeof applyDevelopment === 'function' ? 8.5 : c ? (staffBest(c.id, 'coaching') + c.facilities.training * 2) / 2 : 7;
  const st = r.stats && r.stats[G.season];
  return clamp(0.45 + coach / 25 + Math.min(0.25, (st ? st.heats : 0) / 400) + (equipRating(r) - 70) / 200, 0.4, 1.6);
}
function devEnvKid(k) {
  const c = k.clubId && G.clubs[k.clubId];
  const youth = typeof applyDevelopment === 'function' ? 9 : c ? staffBest(c.id, 'youth') : 8;
  return clamp(0.4 + youth / 30 + (typeof applyDevelopment === 'function' ? 2.5 : c ? c.facilities.academy : 1.5) * 0.08 + (k.parentsSupport || 3) * 0.08 + Math.min(0.15, (k.meets || 0) * 0.01), 0.4, 1.6);
}
const personality = h => clamp(0.7 + 0.03 * ((h ? h.professionalism : 10) - 1) + 0.01 * ((h ? h.ambition : 10) - 10), 0.7, 1.3);
// Mnożniki fazy kariery dla grup atrybutów (wzrost / spadek)
function phaseMult(g, age, up) {
  if (up) return age < 22 ? { tech: 1.4, mental: 0.7, physical: 1.2, workshop: 0.6 }[g] : age < 30 ? { tech: 1, mental: 1.2, physical: 0.8, workshop: 1.2 }[g] : { tech: 0.8, mental: 1.3, physical: 0.6, workshop: 1.2 }[g];
  return age >= 30 ? { tech: 1, mental: 0.3, physical: 2, workshop: 0.2 }[g] : 1;
}
function developWeek(x, env, focusKeys) {
  if (x.ca == null) return 0;
  const age = ageYears(x.born), h = x.hidden, dv = x.dev || (x.dev = { maturity: 0, aging: 0, pa0: x.pa, seasonCa: x.ca });
  const pers = personality(h);
  let dca = 0;
  if (age < 31) {
    const ae = age + dv.maturity;
    const tgtAt = a => { let t = a >= 28 ? x.pa : x.pa * ageCurve(a); if (age < 17) t *= 0.7 + 0.3 * env; return t; };
    const tgt = tgtAt(ae);
    // późny rozwój jest rzadki: pełne tempo do 23 lat, potem coraz wolniej
    const growF = age < 23 ? 1 : age < 27 ? 1 - (age - 23) * 0.15 : Math.max(0.05, 0.4 - (age - 27) * 0.12);
    if (tgt > x.ca) {
      // podążanie za krzywą (jej przyrost w tym tygodniu) + domykanie zaległości
      const slope = Math.max(0, tgt - tgtAt(ae - 1 / 52)) * clamp(0.55 + 0.45 * env * pers, 0.5, 1.2);
      const gapF = (tgt - x.ca) / tgt;
      // najzdolniejsi, którzy nie nadążają za krzywą, nadrabiają szybciej
      const boost = 1 + clamp((gapF - 0.04) * 8, 0, 1) * clamp((x.pa - 60) / 25, 0, 1);
      dca = (slope + (tgt - x.ca) * (1 - Math.exp(-0.9 * env * pers)) / 52 * boost) * growF;
      // po ciężkiej kontuzji rozwój jest wolniejszy przez kilka miesięcy
      if (dv.slow > 0) dca *= 0.55;
    }
  }
  let agingD = 0;
  if (age >= 30) {
    const ae = Math.max(30, age - dv.aging);
    agingD = x.ca * (ageCurve(ae) - ageCurve(ae - 1 / 52)) / ageCurve(ae - 1 / 52);
    dca += agingD;
  }
  if (x.injury) dca = Math.min(dca, 0) - 0.01; // kontuzja: rozwój stoi
  if (dv.slow > 0) dv.slow--;
  const before = x.ca;
  if (typeof applyDevelopment === 'function') {
    // przyrost (budżet z krzywej) i starzenie osobno: przyrost realizuje się w oknach treningowych (js/training.js)
    let grow = Math.max(0, dca - Math.min(0, agingD)), decl = Math.min(0, agingD);
    if (x.injury) { grow = 0; decl -= 0.01; }
    applyDevelopment(x, grow, decl, age, focusKeys, gauss(0.03));
  } else {
    dca += gauss(0.03);
    x.ca = clamp(x.ca + dca, 1, 100);
    shiftAttrs(x, x.ca - before, age, focusKeys);
  }
  // powrót po przerwie: część umiejętności utraconych bez jazdy wraca szybko w treningu (js/rider-licence.js)
  if (dv.rust > 0 && (x.clubId || x.active)) {
    const rec = Math.min(dv.rust, Math.max(0.25, dv.rust / 12));
    dv.rust = round1(dv.rust - rec);
    const c0 = x.ca;
    rustShift(x, rec);
    x.ca = clamp(caOfAttrs(x.attrs), c0, 100);
  }
  // atrybuty spoza CA
  const a = x.attrs;
  if (age >= 20 && age <= 36) a.leadership = clamp(a.leadership + 0.004 + (x.ca > 60 ? 0.002 : 0), 1, 20);
  if (age > 30) a.recovery = clamp(a.recovery - 0.005 * (1.2 - (h ? h.professionalism : 10) / 25), 1, 20);
  if (age > 33) a.resilience = clamp(a.resilience - 0.004, 1, 20);
  if (x.skill != null) syncSkill(x);
  return x.ca - before;
}
// Indywidualna podatność atrybutu na rozwój i spadek: stała dla zawodnika + akcent sezonu (nad czym pracował)
const AFF_W = new WeakMap();
function attrAffinity(x, k, up) {
  let c = AFF_W.get(x);
  if (!c || c.s !== G.season) { c = { s: G.season, u: {}, d: {} }; AFF_W.set(x, c); }
  const t = up ? c.u : c.d;
  if (t[k] !== undefined) return t[k];
  const key = x.name + '|' + String(x.born).slice(0, 4) + '|' + k;
  const st = styleOf(x.name + '|' + String(x.born).slice(0, 4))[2][k] || 0;
  let f = 1 + 0.3 * hgauss(key + (up ? 'u' : 'd')) + 0.2 * hgauss(key + G.season) + (up ? st * 0.08 : -st * 0.05);
  f = clamp(f, 0.4, 1.8);
  t[k] = f;
  return f;
}
function shiftAttrs(x, dca, age, focusKeys) {
  const a = x.attrs, up = dca >= 0, d = dca / 5;
  for (const k in ATTR_W) {
    let f = phaseMult(ATTR_GROUP[k], age, up) * attrAffinity(x, k, up) * (0.7 + rnd() * 0.6);
    if (focusKeys && focusKeys.length) f *= focusKeys.includes(k) ? 1.8 : 0.75;
    a[k] = clamp(a[k] + d * f, 1, 20);
  }
  // doświadczenie: decyzje i spokój rosną do ok. 36 lat nawet przy spadku formy
  if (age >= 27 && age <= 36) for (const k of ['decisions', 'anticipation', 'composure', 'adaptability']) a[k] = clamp(a[k] + 0.008, 1, 20);
  if (focusKeys && focusKeys.length && age <= 30) for (const k of focusKeys) a[k] = clamp(a[k] + 0.006, 1, 20);
  normalizeAttrs(a, x.ca);
}

// ---------- Zmiany potencjału (prawdziwe przeskoki klas) ----------
const PA_CAP = 15; // łączna zmiana PA w karierze (±)
function changePa(x, d, why) {
  const dv = x.dev || (x.dev = { maturity: 0, aging: 0, pa0: x.pa, seasonCa: x.ca });
  const pa = clamp(x.pa + d, Math.max(1, dv.pa0 - PA_CAP), Math.min(100, dv.pa0 + PA_CAP));
  if (Math.abs(pa - x.pa) < 0.05) return 0;
  const real = pa - x.pa;
  x.pa = round1(pa);
  (x.paLog = x.paLog || []).push({ d: G.date, v: round1(real), why });
  if (x.skill != null) syncSkill(x);
  return real;
}
// Koniec sezonu: dryf talentu młodych (ambicja, profesjonalizm), przełomowe sezony
function seasonPaEvents(x, heats) {
  const age = ageYears(x.born), h = x.hidden || {};
  if (age >= 14 && age <= 23) changePa(x, 0.75 * ((h.ambition ?? 10) - 10) / 10 + 0.5 * ((h.professionalism ?? 10) - 10) / 10 + gauss(1.25), 'rozwój talentu');
  const dv = x.dev;
  if (dv && age >= 17 && age <= 24 && x.ca - dv.seasonCa > 7.5 && (heats || 0) >= 40 && chance(0.25)) changePa(x, 2.5 + rnd() * 5, 'przełomowy sezon');
  if (dv) dv.seasonCa = x.ca;
}
// Egzamin licencyjny: przejście na 500 cm³ weryfikuje talent z mini
function licencePaEvent(x) {
  const a = x.attrs;
  changePa(x, gauss(4) + ((a.bravery + a.balance + a.strength) - 3 * (x.ca / 5) - 0) / 25 * 5, 'przejście na 500 cm³');
}
// Ciężka kontuzja nie zmienia potencjału: zatrzymuje rozwój na czas leczenia, a potem przez kilka miesięcy
// spowalnia go (słabsza Odporność – dłużej), więc trudniej dobić CA do PA
function injuryPaEvent(r, days) {
  if (days < 30) return;
  const res = r.attrs.resilience ?? 10;
  const dv = r.dev || (r.dev = { maturity: 0, aging: 0, pa0: r.pa, seasonCa: r.ca });
  dv.slow = Math.max(dv.slow || 0, Math.round(days / 7 * clamp(1.6 - res / 20, 0.6, 1.6)));
}

// ---------- Forma dnia (powtarzalność) ----------
function dayForm(x, key) {
  const c = x.hidden ? x.hidden.consistency : 10;
  return hgauss(key + '|' + x.id) * (0.2 + (20 - c) * 0.045);
}

// ---------- Wiedza klubu o zawodniku i ocena sztabu ----------
const isKid = x => !!(x && (x.cat || x.kid) && !G.riders[x.id]);
const PSD_HEATS = new Map();
function psdHeats(r) {
  if (PSD_HEATS.has(r.id)) return PSD_HEATS.get(r.id);
  const h = typeof riderHist === 'function' ? riderHist(r) : null, v = h ? sum(h.seasons.map(s => s.heats || 0)) : 0;
  PSD_HEATS.set(r.id, v);
  return v;
}
function knowledge(x, clubId = G.clubId) {
  let k;
  const age = ageYears(x.born);
  if (isKid(x)) {
    k = x.clubId && x.clubId === clubId ? 0.85 : 0.22 + Math.min(0.2, (x.protocols || 0) / 150) + Math.min(0.1, (x.meets || 0) * 0.01);
  } else if (x.clubId && x.clubId === clubId) k = 0.97;
  else {
    const lg = x.clubId && G.clubs[x.clubId] ? G.clubs[x.clubId].league : null;
    // zawodnicy innych klubów: znani z telewizji i meczów, ale bez wglądu w trening – oceny to przedziały,
    // zawodnicy spoza polskiej ligi prawie nieznani, dopóki skauci ich nie obejrzą
    k = lg === 'PGE' ? 0.6 : lg === '2E' ? 0.5 : lg === 'KLZ' ? 0.42 : hasNat(x, 'POL') ? 0.3 : 0.12;
    if (G.sgp && G.sgp.riders && G.sgp.riders.includes(x.id)) k = Math.max(k, 0.66);
    if (lg && G.clubs[clubId] && G.clubs[clubId].league === lg) k += 0.05;
    k += Math.min(0.08, psdHeats(x) / 2000);
    if (age < 17) k -= 0.15; else if (age < 19) k -= 0.1; else if (age < 21) k -= 0.05;
    k = Math.min(k, 0.8);
  }
  if (!(x.clubId && x.clubId === clubId) && typeof scCountryBonus === 'function') k += scCountryBonus(x, clubId); // znajomość kraju przez klub (js/scouting.js)
  if (clubId === G.clubId && G.scout && G.scout[x.id]) k += G.scout[x.id];
  k += (judgingOf(clubId) - 10) / 100;
  return clamp(k, 0.08, x.clubId && x.clubId === clubId ? 1 : 0.97);
}
const judgingOf = clubId => (clubId && G.clubs[clubId] ? staffBest(clubId, 'judging') : 10);
// Ocena CA/PA przez klub: przedziały mogą nie zawierać prawdy (stały błąd sztabu wobec zawodnika, optymizm słabych skautów)
function perceive(x, clubId = G.clubId) {
  const K = knowledge(x, clubId), J = judgingOf(clubId), e = 1 - K, age = ageYears(x.born);
  const key = clubId + ':' + x.id;
  const skill = 1.4 - J / 20;
  const caC = x.ca + hgauss(key + ':ca') * e * 12 * skill;
  const caH = 0.8 + e * 18;
  const youth = age <= 18 ? 1 : age <= 21 ? 0.6 : age <= 24 ? 0.25 : 0;
  const opt = Math.max(0, 14 - J) / 14 * 10 * youth * (e + 0.15);
  const paC = x.pa + hgauss(key + ':pa') * e * 18 * skill + opt;
  const paH = 1.5 + e * 30 + (age < 18 ? 6 * e : 0);
  const caLo = clamp(caC - caH, 1, 100), caHi = clamp(caC + caH, caLo, 100);
  const paLo = clamp(Math.max(paC - paH, caLo), 1, 100), paHi = clamp(Math.max(paC + paH, caHi), paLo, 100);
  return { K, ca: [caLo, caHi], pa: [paLo, paHi], caMid: (caLo + caHi) / 2, paMid: (paLo + paHi) / 2 };
}
// Atrybut widziany przez klub: dokładnie, w przedziale albo nieznany
function perceiveAttr(x, k, clubId = G.clubId, K = knowledge(x, clubId)) {
  const v = x.attrs[k];
  if (v == null) return null;
  const key = clubId + ':' + x.id + ':' + k, u = hrand(key);
  if (u < clamp((0.7 - K) * 1.3, 0, 0.85)) return { hidden: true };
  const w = Math.round((1 - K) * 8 * (0.5 + hrand(key + 'w')));
  if (!w) return { lo: Math.round(v), hi: Math.round(v) };
  const c = v + hgauss(key + 'c') * (1 - K) * 3;
  const lo = clamp(Math.round(c - w / 2 - hrand(key + 's') * 0.5), 1, 20), hi = clamp(lo + w, lo, 20);
  return { lo, hi };
}

// ---------- Opisy charakteru (Profesjonalizm × Powtarzalność, modyfikowane Ambicją) ----------
function personalityLabel(h) {
  if (!h) return null;
  const P = h.professionalism, W = h.consistency, A = h.ambition;
  if (P >= 18 && W >= 17 && A >= 17) return ['Perfekcjonista', 'Maksymalne zaangażowanie i powtarzalność – rozwija się najszybciej i najdłużej utrzymuje formę.'];
  if (A >= 17 && W <= 7) return ['Szalony talent', 'Wielkie ambicje i duże wahania formy – potrafi zaskoczyć w obie strony.'];
  if (A >= 16 && P >= 15) return ['Głodny sukcesu', 'Ambitny profesjonalista – chce walczyć o medale i oczekuje wysokich zarobków.'];
  if (A >= 16 && P <= 8) return ['Ambitny, ale niecierpliwy', 'Chce szybkiej kariery, ale nie wkłada w nią dość pracy – skłonny do konfliktów i zmian klubu.'];
  if (A <= 6 && P <= 8) return ['Bez motywacji', 'Niska ambicja i słabe zaangażowanie – ryzyko wcześniejszego końca kariery.'];
  if (A <= 6 && P >= 12) return ['Lojalny ligowiec', 'Solidny i lojalny, zadowolony z tego, co ma – łatwo przedłuża kontrakt.'];
  const p = P >= 15 ? 2 : P >= 9 ? 1 : 0, w = W >= 15 ? 2 : W >= 9 ? 1 : 0;
  return [[['Lekkoduch', 'Nierówny i mało pracowity – wolno się rozwija i szybciej się starzeje.'], ['Niedbały', 'Zaniedbuje trening i sprzęt.'], ['Naturszczyk', 'Jeździ równo dzięki talentowi, ale prawie się nie rozwija.']],
    [['Nieprzewidywalny', 'Raz komplet punktów, raz zero.'], ['Zrównoważony', 'Typowy charakter, bez wyraźnych mocnych i słabych stron.'], ['Solidny rzemieślnik', 'Wiadomo, czego się po nim spodziewać.']],
    [['Pracowity, ale chimeryczny', 'Trenuje sumiennie, ale wyniki falują.'], ['Profesjonalista', 'Sumienny i poukładany – rozwija się szybko.'], ['Wzorowy profesjonalista', 'Szybki rozwój, równa jazda i wolniejsze starzenie.']]][p][w];
}

// ---------- Kalibracja (js/calib-data.js) i migracja zawodników na nowe atrybuty ----------
const CAL_DATA = typeof CALIB !== 'undefined' ? CALIB : null;
function calibExtFor(x) {
  if (!CAL_DATA || !CAL_DATA.attrs) return null;
  const byId = CAL_DATA.attrs[String(x.id)];
  if (byId && (!byId._n || normName(byId._n) === normName(x.name))) return byId;
  return CAL_DATA.attrs['n:' + x.name] || null;
}
// CA/PA z kalibracji; brak – szacunek z dotychczasowej oceny umiejętności i wieku
let CALIB_BY_NAME = null;
function calibRider(r) {
  if (!CAL_DATA) return null;
  let c = CAL_DATA.riders[String(r.id)];
  if (c && c.n && normName(c.n) === normName(r.name)) return c;
  if (!CALIB_BY_NAME) { CALIB_BY_NAME = new Map(); for (const x of Object.values(CAL_DATA.riders)) if (x.n) CALIB_BY_NAME.set(normName(x.n), x); }
  return CALIB_BY_NAME.get(normName(r.name)) || (c && !c.n ? c : null);
}
function initRiderAbility(r, { keepCa } = {}) {
  const c = calibRider(r);
  const age = ageYears(r.born);
  if (!keepCa) {
    if (c) { r.ca = c.ca; r.pa = Math.max(c.pa, c.ca); r.paRange = [c.lo, c.hi]; r.calib = c.conf || 'kalibracja'; }
    else {
      r.ca = clamp(2.5 + 5.12 * (r.skill ?? 5), 5, 90);
      const peak = age >= 28 ? r.ca * (1.03 + hrand(r.name + 'pk') * 0.12) : r.ca / ageCurve(age) * (0.95 + hrand(r.name + 'pk') * 0.15);
      r.pa = clamp(Math.max(r.ca, r.potential != null && age < 24 ? (r.potential + peak) / 2 : peak), 1, 100);
      r.paRange = [Math.max(r.ca, r.pa - 8), Math.min(100, r.pa + 8)];
      r.calib = 'szacunek gry';
    }
  }
  r.ca = round1(r.ca); r.pa = round1(r.pa);
  return buildProfile(r, calibExtFor(r));
}
// Adept szkółki (miniżużel / 250 / 500 przed licencją)
function initKidAbility(k, c) {
  const age = ageYears(k.born);
  // brak wpisu miniżużla: kalibracja po nazwisku (np. adept z licencją 2026 zapisany w kalibracji jak zawodnik – Karol Skórnicki)
  if (!c && k.name && typeof calibRider === 'function') { const x = calibRider(k); if (x && x.n && normName(x.n) === normName(k.name)) c = x; }
  if (c) { k.ca = c.ca; k.pa = Math.max(c.pa, c.ca); k.paRange = [c.lo, c.hi]; k.protocols = c.protocols || 0; k.calib = c.conf || 'kalibracja'; }
  else if (k.ca == null) {
    k.pa = clamp(55 + hgauss(k.name + 'kpa') * 10, 30, 90);
    k.ca = clamp(k.pa * ageCurve(age) * (0.85 + hrand(k.name + 'kca') * 0.15), 1, 60);
    // prawdziwy adept bez wyników (np. licencja „Ż” dopiero w wieku 19–20 lat): debiutant, nie poziom rówieśników z ligi
    if (k.real && age >= 15) k.ca = Math.min(k.ca, 18 + hrand(k.name + 'kcap') * 8);
    k.paRange = [Math.max(k.ca, k.pa - 18), Math.min(100, k.pa + 18)];
    k.calib = 'szacunek gry (brak wyników)';
  }
  k.ca = round1(k.ca); k.pa = round1(k.pa);
  buildProfile(k, calibExtFor(k));
  delete k.skill; delete k.potential;
  k.ability = k.ca; // zgodność ze starszym kodem (sortowanie, siła drużyn)
  return k;
}
// Najniższy poziom zawodnika z licencją „Ż”: zdany egzamin to co najmniej poziom debiutanta (CA 18–26, skill 3,6–5,2)
const licenceFloorCa = x => 18 + hrand(x.name + 'kcap') * 8;
function applyLicenceFloor(r) {
  const f = licenceFloorCa(r);
  if (r.ca == null || r.ca >= f) return false;
  r.ca = round1(f); r.pa = round1(Math.max(r.pa ?? r.ca, r.ca));
  if (r.paRange) r.paRange = [Math.max(r.paRange[0], r.ca), Math.max(r.paRange[1], r.ca)];
  buildProfile(r, calibExtFor(r)); syncSkill(r);
  if (r.dev) r.dev.seasonCa = r.ca;
  return true;
}
// Zapisy sprzed poprawki: adepci (i świeżo licencjonowani wychowankowie) z szacunkiem z wieku zamiast kalibracji po nazwisku
function fixKidCalibByName() {
  if (!G || G.kidCalibFix === 2) return false;
  const v = G.kidCalibFix || 0;
  G.kidCalibFix = 2;
  let n = 0;
  // v2: dolna granica dla zawodników ze świeżą licencją (applyLicenceFloor)
  if (v >= 1) { for (const r of Object.values(G.riders)) if (r.profile === 'wychowanek – świeża licencja' && applyLicenceFloor(r)) n++; return n > 0; }
  const pick = x => { const c = calibRider(x); return c && c.n && normName(c.n) === normName(x.name) ? c : null; };
  for (const k of Object.values(G.academy)) {
    if (k.calib !== 'szacunek gry (brak wyników)' || !k.real) continue;
    const c = pick(k), cap = 18 + hrand(k.name + 'kcap') * 8;
    if (c && c.ca < k.ca) { initKidAbility(k, c); n++; }
    else if (!c && ageYears(k.born) >= 15 && k.ca > cap) { k.ca = round1(cap); k.pa = Math.max(k.pa, k.ca); buildProfile(k, calibExtFor(k)); k.ability = k.ca; n++; }
  }
  for (const r of Object.values(G.riders)) {
    if (r.profile !== 'wychowanek – świeża licencja' || r.calib !== 'szacunek gry (brak wyników)') continue;
    const c = pick(r);
    if (!c || c.ca >= r.ca) continue;
    r.ca = round1(c.ca); r.pa = round1(Math.max(c.pa, c.ca)); r.paRange = [c.lo, c.hi]; r.calib = c.conf || 'kalibracja';
    buildProfile(r, calibExtFor(r)); syncSkill(r);
    if (r.dev) r.dev.seasonCa = r.ca;
    n++;
  }
  for (const r of Object.values(G.riders)) if (r.profile === 'wychowanek – świeża licencja' && applyLicenceFloor(r)) n++;
  return n > 0;
}
const MINI_CLS = cls => (/500R/.test(cls) ? 'c500' : /250/.test(cls) ? 'c250' : /85|125|140/.test(cls) ? 'c85' : null);
function kidCatFor(cls, age) {
  const c = MINI_CLS(cls || '');
  // klasa z wyników to dolna granica; starszy od zakresu klasy (np. 17-latek z 250 cm³) przechodzi do klasy według wieku
  if (c && !(age > ACADEMY_CATS.find(x => x.id === c).ages[1])) return c;
  if (age >= 15.5) return 'c500';
  if (age >= 12.5) return 'c250';
  if (age >= 8) return 'c85';
  return 'c50';
}
function schoolFor(name) {
  const n = normName(name || '');
  if (!n) return null;
  const sch = Object.values(G.miniSchools || {}).find(s => normName(s.short) === n || normName(s.name) === n);
  if (sch) return { schoolId: sch.id, clubId: sch.clubId || null };
  const club = Object.values(G.clubs).find(c => normName(c.name) === n || (c.city && n.includes(normName(c.city))));
  return club ? { schoolId: null, clubId: club.id } : null;
}
// Zastosowanie kalibracji do całej bazy (nowa gra i migracja zapisu). full=false: tylko nowe profile atrybutów i brakujący zawodnicy
function applyAbilityModel(full = true) {
  if (!G) return false;
  const old = full && G.date > GAME_START;
  for (const r of Object.values(G.riders)) {
    if (full || r.ca == null) {
      // zapis w toku: zachowany postęp z gry (zmiana umiejętności od pierwszego miesięcznego pomiaru po starcie)
      const h0 = old && r.hist ? r.hist.find(h => h.d > GAME_START) : null, drift = h0 ? (r.skill - h0.s) * 5 : 0;
      initRiderAbility(r);
      if (drift) { r.ca = round1(clamp(r.ca + drift, 1, 100)); normalizeAttrs(r.attrs, r.ca); syncSkill(r); }
      if (full) r.hist = [{ d: G.date, s: r.skill }];
    } else if (calibExtFor(r) && r.calibAttrs !== CAL_DATA.version) { buildProfile(r, calibExtFor(r)); r.calibAttrs = CAL_DATA.version; }
  }
  // zawodnicy z kalibracji spoza bazy gry
  for (const e of (CAL_DATA ? CAL_DATA.extra : [])) {
    if (Object.values(G.riders).some(r => normName(r.name) === normName(e.name))) continue;
    G.seq.rider = Math.max(G.seq.rider || 30000, 30000) + 1;
    const born = e.born && e.born.length === 10 ? e.born : birthFromYear(e.born ? Number(e.born.slice(0, 4)) : yearOf(G.date) - (e.age || 20), e.name);
    const r = newRider({ id: G.seq.rider, name: e.name, country: COUNTRY[e.country] ? e.country : 'POL', born: null, skill: e.ca / 5, potential: e.pa,
      profile: 'zawodnik spoza polskiej ligi (kalibracja)', certainty: 'kalibracja: ' + e.source, activity: e.source ? [e.source] : [], lastSeason: 2025 }, G.date);
    r.born = born; r.bornEst = !(e.born && e.born.length === 10);
    r.ca = e.ca; r.pa = Math.max(e.pa, e.ca); r.paRange = [e.lo, e.hi]; r.calib = 'kalibracja (zawody spoza polskiej ligi)';
    buildProfile(r, calibExtFor(r));
    G.riders[r.id] = r;
  }
  // miniżużel: dopasowanie wyników do adeptów, brakujący – nowi adepci (tylko potwierdzeni w protokołach)
  const kids = Object.values(G.academy);
  const used = new Set();
  for (const m of (CAL_DATA ? CAL_DATA.mini : [])) {
    const n = normName(m.name), y = m.born ? m.born.slice(0, 4) : null;
    const yOk = x => !y || !x.born || String(x.born).slice(0, 4) === y || m.bornEst;
    const rider = Object.values(G.riders).find(r => normName(r.name) === n && yOk(r));
    if (rider) { if (!(CAL_DATA.riders[String(rider.id)]) && full) { /* licencjonowany wychowanek bez KSM: zostaje ocena gry */ } continue; }
    let k = kids.find(x => normName(x.name) === n && yOk(x));
    // kraj z kalibracji (np. zawodnicy SGP3/SGP4 dopisani wcześniej bez kraju) – także w zapisach w toku
    if (k && k.calibOnly && m.country && COUNTRY[m.country] && k.country !== m.country) k.country = m.country;
    if (!k && !full && kids.some(x => x.calibName === m.name)) continue;
    if (!k) {
      const sch = schoolFor(m.school);
      const born = m.born || String(yearOf(G.date) - Math.round(m.age || 12));
      const age = ageYears(born);
      if (age < 6) continue; // szkolenie (pit bike) od 6 lat (ekstraliga.pl/se/szkolenie)
      k = { id: `A${G.seq.academy++}`, name: m.name, country: COUNTRY[m.country] ? m.country : 'POL', born, birthYear: Number(String(born).slice(0, 4)), clubId: sch ? sch.clubId : null, schoolId: sch ? sch.schoolId : null,
        cat: kidCatFor(m.cls, age), real: true, calibOnly: true, calibName: m.name, source: m.source, joined: G.date, progress: [], parentsSupport: 1 + Math.floor(hrand(m.name + 'ps') * 5), meets: 0 };
      G.academy[k.id] = k;
      kids.push(k);
    }
    used.add(k.id);
    if (full || k.ca == null) initKidAbility(k, m);
  }
  for (const k of kids) if (!used.has(k.id) && (full || k.ca == null)) initKidAbility(k, null);
  applyBirthDates(); // pełne daty urodzenia (js/birthdates.js) – przed licencjami zagranicznych adeptów
  foreignLicences(); // zagraniczni adepci po 16. urodzinach – zawodnicy z licencją swojego kraju
  if (typeof ensureKidLicences === 'function') ensureKidLicences(); // licencje niższych klas (js/kid-licence.js)
  if (typeof addCalibMiniPeople === 'function') addCalibMiniPeople();
  G.skillsCalibrated = true;
  G.abilityModel = CAL_DATA ? CAL_DATA.version : 'brak-kalibracji';
  return true;
}
// Nowe wersje kalibracji: zapis w toku zachowuje CA/PA, dostaje nowe profile atrybutów i brakujących zawodników
function migrateAbility() {
  if (!G) return false;
  const v = CAL_DATA ? CAL_DATA.version : 'brak-kalibracji';
  if (!G.abilityModel) return applyAbilityModel(true);
  if (G.abilityModel !== v) return applyAbilityModel(false);
  return false;
}

// Zagraniczni adepci spoza polskich szkółek (np. zawodnicy SGP3/SGP4) po 16. urodzinach mają licencję w swoim kraju:
// w grze są zawodnikami (bez polskiego klubu, do pozyskania na rynku), a nie adeptami miniżużla
// sam rocznik: ta sama data urodzenia, którą dostanie zawodnik (birthFromYear w riderFromKid)
const kidBirth = k => (String(k.born || '').length === 4 ? birthFromYear(Number(k.born), k.name) : k.born);
const foreignLicenceDue = (k, date = G.date) => !!(k && k.country && k.country !== 'POL' && !k.clubId && !k.schoolId && !k.mgrChild && !k.retired && !k.catalogOnly && ageAt(kidBirth(k), date) >= 16);
function foreignLicences() {
  let n = 0;
  for (const k of Object.values(G.academy)) {
    if (!foreignLicenceDue(k)) continue;
    if (k.ca == null) initKidAbility(k, null);
    G.seq.rider = Math.max(G.seq.rider || 30000, 30000) + 1;
    const r = riderFromKid(k, G.seq.rider);
    const fed = typeof NATION_INFO !== 'undefined' && NATION_INFO[k.country] ? NATION_INFO[k.country].fed : 'krajowa federacja';
    r.licence = { number: null, team: '', date: G.date, place: fed, foreign: true }; // jak w adeptsMonthly (js/adepts.js)
    r.country = k.country; if (k.nationalities) r.nationalities = k.nationalities.slice();
    r.contract = null; r.clubId = null; r.foreignLicence = true; r.calib = k.calib || r.calib; if (k.birthPlace) r.birthPlace = k.birthPlace;
    G.riders[r.id] = r;
    delete G.academy[k.id];
    if (typeof moveAttrHist === 'function') moveAttrHist(k.id, r.id);
    for (const p of Object.values(G.miniPeople || {})) if (p.kidId === k.id) { p.kidId = null; p.riderId = r.id; }
    n++;
  }
  return n;
}

// Pełne daty i miejsca urodzenia z Polish Speedway Database i Speedway History Info (js/birthdates.js): data zastępuje datę szacowaną albo sam rocznik, gdy rok się
// zgadza (±1); force – poprawki błędów w bazie gry. Miejsce urodzenia tylko przy zgodnym roczniku (inaczej to imiennik).
function applyBirthDates() {
  if (typeof BIRTH_DATES === 'undefined' || G.birthDates === BIRTH_DATES.version) return false;
  const psd = new Set(BIRTH_DATES.psd || []);
  const near = (a, b) => !a || !b || Math.abs(Number(String(a).slice(0, 4)) - Number(String(b).slice(0, 4))) <= 1;
  const fix = x => {
    const d = BIRTH_DATES.people[x.name], force = (BIRTH_DATES.force || []).includes(x.name);
    const place = (BIRTH_DATES.places || {})[x.name], py = (BIRTH_DATES.placeYears || {})[x.name];
    if (force && d) { x.born = d; x.bornEst = false; }
    if (place && (!py || near(x.born, py))) x.birthPlace = place; // bez rocznika – miejsce podane ręcznie
    const cur = String(x.born || '');
    if (d && !force && psd.has(x.name) && cur.length === 10 && cur !== d && Math.abs(Date.parse(cur) - Date.parse(d)) < 400 * 864e5) {
      x.born = d; x.bornEst = false; if ('birthDatePrecision' in x) x.birthDatePrecision = 'day'; return; // PSD przed przybliżoną datą z bazy gry
    }
    if (!d || force || (cur.length === 10 && !x.bornEst && !x.birthDatePrecision) || x.birthDatePrecision === 'day') return;
    if (!near(cur, d)) return; // inna osoba o tym samym nazwisku
    x.born = d; x.bornEst = false;
    if ('birthYear' in x) x.birthYear = Number(d.slice(0, 4));
    if ('birthDatePrecision' in x) x.birthDatePrecision = 'day';
  };
  for (const o of [G.riders, G.staff, G.academy]) for (const x of Object.values(o || {})) fix(x);
  for (const p of Object.values(G.miniPeople || {})) { // katalog miniżużla (rejestr PZM podaje zwykle sam rocznik)
    const d = BIRTH_DATES.people[p.name];
    if (d && !p.birthDate && near(p.birthYear, d)) { p.birthDate = d; p.birthYear = Number(d.slice(0, 4)); p.birthDatePrecision = 'day'; }
  }
  G.birthDates = BIRTH_DATES.version;
  return true;
}
