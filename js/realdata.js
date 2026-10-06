'use strict';
// Rzeczywiste kadry 2026, sztaby, szkółki i osoby funkcyjne (js/rosters2026.js, skrypt tools/fetch_rosters.py).

const FUNC_LABEL = { TOR: 'Toromistrz', SP: 'Spiker', LZ: 'Lekarz zawodów', LK: 'Lekarz klubowy', KD: 'Kierownik drużyny', IN: 'Instruktor', TR: 'Trener', MK: 'Menedżer klubu', MD: 'Menedżer drużyny', KZ: 'Kierownik zawodów', KS: 'Kierownik startu', PR: 'Prezenter', SEK: 'Sekretarz', KO: 'Korespondent' };
const RST = typeof ROSTERS !== 'undefined' ? ROSTERS : null;
const LEAGUE_OF_AVG = { K: 'KLZ', '2E': '2E', E: 'PGE' };
// Kolejność ról przy wielu funkcjach jednej osoby
const ROLE_PRIORITY = ['coach', 'manager', 'youth', 'teamManager', 'track', 'doctor', 'director'];
const FUNC_ROLE = { TR: 'coach', IN: 'youth', MD: 'manager', KD: 'teamManager', TOR: 'track', LK: 'doctor', MK: 'director' };

// Transliteracja do porównań (spolszczenia rosyjskich/łotewskich/skandynawskich nazwisk)
function translit(s) {
  return normName(String(s).replace(/ø/g, 'o').replace(/Ø/g, 'O').replace(/æ/g, 'ae').replace(/ö/g, 'o').replace(/ä/g, 'a'))
    .replace(/oe/g, 'o').replace(/ae/g, 'a').replace(/sz/g, 's').replace(/cz/g, 'c').replace(/ch/g, 'h').replace(/w/g, 'v').replace(/j/g, 'i').replace(/y/g, 'i')
    .replace(/kh/g, 'h').replace(/ks$/, 'k').replace(/s$/, '').replace(/(.)\1/g, '$1');
}
function bigrams(s) { const b = new Set(); for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2)); return b; }
function similarity(a, b) { const A = bigrams(a), B = bigrams(b); let n = 0; A.forEach(x => { if (B.has(x)) n++; }); return (2 * n) / ((A.size + B.size) || 1); }
function matchRider(name, born) {
  const n = normName(name), all = Object.values(G.riders);
  const y = born ? born.slice(0, 4) : null;
  let c = all.filter(r => normName(r.name) === n);
  if (c.length > 1 && y) c = c.filter(r => r.born.slice(0, 4) === y).concat(c).slice(0, 1);
  if (c.length) return c[0];
  const p = translit(name).split(' '), first = p[0], last = p[p.length - 1];
  // to samo imię (inicjał) i podobne nazwisko; przy znanym roczniku wymagany ten sam rok urodzenia
  const scored = all.map(r => { const q = translit(r.name).split(' '); return { r, s: q[0][0] === first[0] ? similarity(q[q.length - 1], last) : 0 }; })
    .filter(x => x.s >= (y ? 0.5 : 0.75) && (!y || x.r.bornEst || x.r.born.slice(0, 4) === y)).sort(by(x => x.s, -1));
  return scored.length && (scored.length === 1 || scored[0].s > scored[1].s) ? scored[0].r : null;
}
function assignRider(r, c, season, source) {
  const keep = r.contract && r.contract.clubId === c.id && r.contract.until >= season;
  if (!keep) {
    const age = ageAt(r.born, `${season}-06-30`);
    const est = estimateContract(r.skill, age, r.potential, c.league);
    if (r.clubId && r.clubId !== c.id) r.prevClubId = r.clubId;
    r.contract = { clubId: c.id, signing: est.signing, perPoint: est.perPoint, from: season, until: season + (age <= 21 ? 1 : rint(0, 1)),
      kind: 'zawodowy', source: `skład ${season} (${source}); kwoty – estymacja modelowa`, certainty: 'kwoty szacunkowe' };
  }
  r.clubId = c.id;
}
function riderFromRoster(rr, date) {
  const age = rr.born ? ageAt(rr.born, date) : 20;
  let skill;
  if (rr.avg2025 != null) skill = LEAGUE_AVG_SKILL[LEAGUE_OF_AVG[rr.avgLeague] || 'KLZ'] + (rr.avg2025 - 1.45) * 2.4;
  else skill = age <= 19 ? 3.6 + rnd() * 1.4 : age <= 21 ? 4.2 + rnd() * 1.6 : 5 + rnd() * 1.5;
  skill = round2(clamp(skill, 3, 12.5));
  const potential = clamp(Math.round(age <= 18 ? 72 + gauss(10) : age <= 21 ? 66 + gauss(9) : age <= 25 ? 60 + gauss(7) : 50 + gauss(6)), 35, 96);
  G.seq.rider = Math.max(G.seq.rider || 30000, 30000) + 1;
  const id = G.seq.rider;
  const r = newRider({ id, name: rr.name, country: COUNTRY[rr.country] ? rr.country : 'POL', born: null, skill, potential,
    profile: 'zawodnik spoza bazy globalnej (kadra 2026)', certainty: rr.avg2025 != null ? 'szacunek ze średniej 2025' : 'szacunek z wieku', activity: rr.prev ? [`poprzedni klub: ${rr.prev}`] : [], lastSeason: 2025 }, date);
  G.riders[id] = r;
  return r;
}
function kidCategory(born, cc, date) {
  const age = ageAt(born, date);
  if (cc === '250') return 'c250';
  if (cc === '125' || cc === '85') return age >= 8 ? 'c85' : 'c50';
  const byAge = ACADEMY_CATS.slice().reverse().find(c => age >= c.ages[0]);
  return (byAge || ACADEMY_CATS[0]).id;
}
function addKid(clubId, k, date, source) {
  const exists = Object.values(G.academy).find(x => normName(x.name) === normName(k.name));
  if (exists) return exists;
  // adept, który ma już licencję i jest w kadrze klubu, nie trafia do szkółki
  const y = k.born ? k.born.slice(0, 4) : null;
  if (Object.values(G.riders).some(r => normName(r.name) === normName(k.name) && (!y || r.born.slice(0, 4) === y))) return null;
  const catIdx = ACADEMY_CATS.findIndex(c => c.id === kidCategory(k.born, k.cc, date));
  const kid = genKid(clubId, date, Math.max(0, catIdx));
  Object.assign(kid, { name: k.name, born: k.born, cat: ACADEMY_CATS[Math.max(0, catIdx)].id, real: true, source, note: k.note || null });
  G.academy[kid.id] = kid;
  return kid;
}
function realStaffFor(c, data) {
  const people = new Map();
  const put = (name, role, funcs, source) => {
    const key = normName(name);
    const p = people.get(key) || { name, roles: new Set(), funcs: new Set(), sources: new Set() };
    if (role) p.roles.add(role);
    (funcs || []).forEach(f => p.funcs.add(f));
    p.sources.add(source);
    people.set(key, p);
  };
  for (const s of data.staff || []) put(s.name, s.role, s.funcs, s.source);
  for (const o of data.officials || []) {
    const roles = o.funcs.map(f => FUNC_ROLE[f]).filter(Boolean);
    if (roles.length) roles.forEach(r => put(o.name, r, o.funcs, `PZM (${o.pzmClub})`));
  }
  // limity ról w sztabie (reszta pozostaje na liście osób funkcyjnych); pierwszeństwo mają osoby wskazane przez ligi
  const LIMIT = { coach: 2, youth: 2, manager: 1, teamManager: 1, track: 1, doctor: 1, director: 1 };
  const used = {}, out = [];
  const list = [...people.values()].map(p => ({ ...p, role: ROLE_PRIORITY.find(r => p.roles.has(r)), league: [...p.sources].some(x => !x.startsWith('PZM')) }))
    .sort(by(p => (p.league ? 0 : 1) + ROLE_PRIORITY.indexOf(p.role) / 100));
  for (const p of list) {
    if (!p.role) continue;
    let role = p.role;
    if (role === 'coach' && (used.coach || 0) >= 1) role = 'assistant';
    const lim = role === 'assistant' ? 1 : LIMIT[role];
    if ((used[role] || 0) >= lim) continue;
    used[role] = (used[role] || 0) + 1;
    out.push({ ...p, role });
  }
  return out;
}
// Zawodnicy z przerwą w karierze (Polish Speedway Database): starty w polskich ligach, brak aktywnej licencji na sezon 2026
const PSD_LEAGUE = { E: 'PGE', I: '2E', II: 'KLZ', U24: 'KLZ', 1: '2E', 2: 'KLZ' }; // kody lig w PSD: E, I (1. liga), II (2. liga)
function addInactiveRiders() {
  if (typeof RIDER_HIST === 'undefined' || !RIDER_HIST.inactive || G.inactiveAdded) return false;
  for (const sl of RIDER_HIST.inactive) {
    const d = RIDER_HIST.riders[sl];
    if (!d || !d.name) continue;
    let r = matchRider(d.name, d.born);
    if (!r) {
      const last = d.seasons.slice().sort(by(s => s.season, -1))[0];
      const lg = PSD_LEAGUE[last.leagueCode] || 'KLZ';
      const skill = round2(clamp(LEAGUE_AVG_SKILL[lg] + ((last.avg || 1.2) - 1.45) * 2.4 - 0.3 * (START_SEASON - last.season), 3, 11));
      const age = ageAt(d.born, G.date);
      G.seq.rider = Math.max(G.seq.rider || 30000, 30000) + 1;
      r = newRider({ id: G.seq.rider, name: d.name, country: COUNTRY[d.country] ? d.country : 'POL', born: null, skill,
        potential: clamp(Math.round(age <= 24 ? 62 + gauss(6) : 52 + gauss(5)), 35, 85), profile: 'licencja wygasła', certainty: 'szacunek ze średniej w ostatnim sezonie',
        activity: [], lastSeason: last.season }, G.date);
      r.born = d.born; r.bornEst = false;
      G.riders[r.id] = r;
    }
    if (r.clubId) continue; // ma kontrakt na 2026 – nie jest zawodnikiem z przerwą
    Object.assign(r, { psdSlug: sl, active: false, retired: false, lastSeason: d.lastSeason || r.lastSeason });
    r.licExpired = (r.lastSeason || START_SEASON) + 1; // licencja wygasła (brak 5 biegów w sezonie) – powrót przez egzamin „Ż”
  }
  G.inactiveAdded = true;
  return true;
}
// Poziom z biegów ligowych 2023–2025 ważony liczbą biegów i świeżością; mało biegów → silne ściągnięcie do poziomu typowego dla wieku
const CALIB_W = { 2025: 1, 2024: 0.6, 2023: 0.35 };
function leagueLevel(r) {
  if (typeof RIDER_HIST === 'undefined') return null;
  const h = RIDER_HIST.riders[r.psdSlug] || RIDER_HIST.riders[nameSlug(r.name)];
  const age = ageAt(r.born, G.date);
  const prior = age <= 19 ? 4.3 : age <= 21 ? 5 : 5.8;
  let W = 0, S = 0;
  for (const s of (h ? h.seasons : [])) {
    const w = (CALIB_W[s.season] || 0) * (s.heats || 0);
    if (!w || s.avg == null) continue;
    S += w * (LEAGUE_AVG_SKILL[PSD_LEAGUE[s.leagueCode] || 'KLZ'] + (s.avg - 1.45) * 2.4);
    W += w;
  }
  const K = 30;
  return { level: (S + K * prior) / (W + K), W, prior };
}
function calibrateSkills() {
  if (G.skillsCalibrated) return false;
  for (const r of Object.values(G.riders)) {
    if (r.retired || r.licExpired) continue;
    const c = leagueLevel(r);
    if (!c) continue;
    const old = r.skill;
    let skill;
    if (r.id < 10000) {
      // ocena ekspercka z bazy: przy dużej liczbie biegów lekka korekta, przy małej – ograniczenie zawyżeń
      skill = c.W >= 60 ? 0.75 * old + 0.25 * c.level : Math.min(old, c.level + 1.2);
    } else skill = c.level;
    if (c.W === 0 && ageAt(r.born, G.date) <= 21) skill = Math.min(skill, 5.5);
    skill = round2(clamp(skill, 3, 15.5));
    if (Math.abs(skill - old) < 0.01) continue;
    const dd = (skill - old) * 1.42;
    for (const k of ATTR_KEYS) r.attrs[k] = clamp(r.attrs[k] + dd * (0.7 + rnd() * 0.6), 1, 20);
    r.skill = skill;
    r.calibrated = { from: round2(old), heats: Math.round(c.W) };
  }
  G.skillsCalibrated = true;
  return true;
}
function licenceStatus(r) {
  if (r.retired) return { ok: false, text: 'zakończył karierę' };
  if (typeof polLicence === 'function' && !polLicence(r)) return { ok: true, text: 'licencja federacji krajowej' };
  if (!r.active) return { ok: false, text: `licencja wygasła${r.licExpired ? ` (od sezonu ${r.licExpired})` : ''} – start dopiero po egzaminie na licencję „Ż”${r.lastSeason ? ` · ostatni sezon ligowy: ${r.lastSeason}` : ''}` };
  return { ok: true, text: 'aktywna' };
}
// Zawodnicy z podwójnym obywatelstwem: w lidze jako Polacy, bez prawa startu w indywidualnych i parowych mistrzostwach Polski
// Podwójne obywatelstwa: pierwsze = kraj macierzysty (barwy w zawodach FIM, zawieszenia), polskie daje status zawodnika krajowego (js/nationality.js)
const DUAL_NATIONALITY = { 'Artem Łaguta': ['RUS', 'POL'], 'Emil Sayfutdinov': ['RUS', 'POL'], 'Vadim Tarasenko': ['RUS', 'POL'], 'Gleb Chugunov': ['RUS', 'POL'] };
function applyNationalities() {
  for (const r of Object.values(G.riders)) {
    const n = DUAL_NATIONALITY[r.name];
    if (n) { r.nationalities = n.slice(); r.country = n[0]; }
  }
  if (typeof applyCalibForeign === 'function') applyCalibForeign(); // liga rosyjska z kalibracji (js/schedule.js)
}
function applyRealRosters() {
  if (!RST) return false;
  const season = RST.season, date = G.date;
  for (const [code, data] of Object.entries(RST.clubs)) {
    const c = clubByCode(code);
    if (!c) continue;
    const src = (data.riders[0] && data.riders[0].source) || 'kadra 2026';
    // zawodnicy 500 cm³ – kadra klubu na sezon
    if (!data.rosterSkipped && data.riders.some(r => r.cc === '500')) {
      const ids = new Set();
      for (const rr of data.riders.filter(r => r.cc === '500')) {
        const r = matchRider(rr.name, rr.born) || riderFromRoster(rr, date);
        if (rr.born) { r.born = rr.born; r.bornEst = false; }
        if (COUNTRY[rr.country]) r.country = rr.country;
        if (rr.avg2025 != null && !r.avgs) r.avgs = { [`${rr.avgLeague === 'K' ? 'KLŻ' : rr.avgLeague}2025`]: rr.avg2025 };
        r.leagues2026 = rr.leagues;
        r.active = true; r.retired = false;
        assignRider(r, c, season, src.replace(/ \(.*/, ''));
        ids.add(r.id);
      }
      for (const r of clubRiders(c.id)) if (!ids.has(r.id)) { r.prevClubId = c.id; r.clubId = null; r.contract = null; }
    }
    // sztab
    const real = realStaffFor(c, data);
    if (real.length) {
      for (const s of clubStaff(c.id)) if (!s.real && ['coach', 'youth', 'track', 'doctor'].includes(s.role) && real.some(p => p.role === s.role)) delete G.staff[s.id];
      const lvl = 7 + (4 - LEAGUES[c.league].level) * 3;
      for (const p of real) {
        if (Object.values(G.staff).some(s => s.clubId === c.id && normName(s.name) === normName(p.name))) continue;
        let role = p.role;
        if (role === 'manager' && c.id === G.clubId) role = 'assistant'; // menedżerem klubu gracza jest gracz
        const s = genStaff(c.id, role, clamp(lvl + rint(-2, 3), 4, 19), date);
        Object.assign(s, { name: p.name, born: null, real: true, funcs: [...p.funcs], source: [...p.sources].join(', '), until: season });
        G.staff[s.id] = s;
      }
    }
    c.officials = (data.officials || []).map(o => ({ name: o.name, funcs: o.funcs, labels: o.labels, pzmClub: o.pzmClub }));
    if (data.track && data.track.length) c.stadium.track = data.track.length;
  }
  // adepci (250 cm³, 85–140 cm³, miniżużel) – po kadrach wszystkich klubów, żeby pominąć zawodników z licencją
  for (const [code, data] of Object.entries(RST.clubs)) {
    const c = clubByCode(code);
    if (!c) continue;
    for (const k of data.riders.filter(r => r.cc !== '500')) if (k.born) addKid(c.id, k, date, 'ekstraliga.pl');
    for (const k of data.mini || []) addKid(c.id, { ...k, cc: '85' }, date, k.miniClub ? `miniżużel: ${k.miniClub}` : 'miniżużel');
  }
  G.realRostersApplied = RST.generated;
  return true;
}
