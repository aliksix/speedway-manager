'use strict';
// Świat gry: definicje (ligi, atrybuty, role sztabu, klasy szkółki) i tworzenie nowej rozgrywki z bazy DATA.

const START_SEASON = 2025;
const LEAGUES = {
  PGE: { id: 'PGE', name: 'PGE Ekstraliga', short: 'PGE', level: 1, tv: 3.6e6, ticket: 70, rounds: 14 },
  '2E': { id: '2E', name: 'Metalkas 2. Ekstraliga', short: '2. Ekstraliga', level: 2, tv: 1.2e6, ticket: 50, rounds: 14 },
  KLZ: { id: 'KLZ', name: 'Krajowa Liga Żużlowa', short: 'KLŻ', level: 3, tv: 0.3e6, ticket: 35, rounds: 14 },
};
const LEAGUE_ORDER = ['PGE', '2E', 'KLZ'];

// Atrybuty zawodnika (1–20), odpowiednik sekcji atrybutów z FM dopasowany do żużla. CA = 5 × średnia ważona tych 28 atrybutów (js/ability.js)
const ATTRS = {
  tech: { name: 'Technika jazdy', list: [['start', 'Start spod taśmy'], ['firstBend', 'Pierwszy łuk'], ['slide', 'Ślizg kontrolowany'], ['throttle', 'Kontrola gazu'],
    ['inside', 'Jazda przy krawężniku'], ['outside', 'Jazda po zewnętrznej'], ['lines', 'Wybór ścieżek'], ['passing', 'Mijanie'], ['defending', 'Obrona pozycji'],
    ['surfaces', 'Jazda na różnych nawierzchniach'], ['teamRiding', 'Jazda parą']] },
  mental: { name: 'Mentalne', list: [['concentration', 'Koncentracja'], ['composure', 'Opanowanie'], ['fighting', 'Waleczność'], ['aggression', 'Agresja'], ['bravery', 'Odwaga'],
    ['decisions', 'Decyzje'], ['anticipation', 'Antycypacja'], ['adaptability', 'Adaptacja'], ['discipline', 'Dyscyplina'], ['teamwork', 'Współpraca']] },
  physical: { name: 'Fizyczne', list: [['reflexes', 'Refleks'], ['strength', 'Siła'], ['balance', 'Równowaga'], ['agility', 'Zwinność'], ['stamina', 'Wytrzymałość']] },
  workshop: { name: 'Warsztat', list: [['setup', 'Dopasowanie sprzętu'], ['techKnowledge', 'Wiedza techniczna']] },
};
const ATTR_KEYS = Object.values(ATTRS).flatMap(g => g.list.map(a => a[0]));
// Atrybuty poza średnią (CA): wpływają na drużynę, zdrowie i starzenie
const EXTRA_ATTRS = { name: 'Inne', list: [['leadership', 'Przywództwo'], ['resilience', 'Odporność'], ['recovery', 'Regeneracja']] };

// Indywidualne plany treningowe
const FOCUS = { '': { name: 'Ogólny (zrównoważony)', attrs: [] }, start: { name: 'Starty spod taśmy', attrs: ['start', 'reflexes', 'firstBend', 'concentration'] },
  pass: { name: 'Mijanie i ścieżki', attrs: ['passing', 'outside', 'inside', 'lines', 'throttle'] }, fit: { name: 'Przygotowanie fizyczne', attrs: ['stamina', 'strength', 'agility', 'balance'] },
  mind: { name: 'Mentalność', attrs: ['composure', 'concentration', 'decisions', 'anticipation'] }, wet: { name: 'Jazda w trudnych warunkach', attrs: ['surfaces', 'slide', 'adaptability', 'balance'] },
  tech: { name: 'Warsztat i sprzęt', attrs: ['setup', 'techKnowledge'] } };

const STAFF_ROLES = {
  coach: { name: 'Menedżer (główny trener)', attrs: ['coaching', 'motivation', 'tactics'] },
  manager: { name: 'Menedżer organizacyjny', attrs: ['tactics', 'motivation', 'judging'] },
  teamManager: { name: 'Kierownik drużyny', attrs: ['discipline', 'tactics'] },
  director: { name: 'Menedżer klubu', attrs: ['judging', 'discipline'] },
  assistant: { name: 'Trener (asystent)', attrs: ['coaching', 'tactics', 'judging'] },
  juniorCoach: { name: 'Trener juniorów', attrs: ['youth', 'coaching', 'judging'] },
  u24Coach: { name: 'Trener drużyny U24', attrs: ['coaching', 'youth', 'tactics'] },
  youth: { name: 'Trener szkółki', attrs: ['youth', 'coaching', 'judging'] },
  mechanic: { name: 'Kierownik parku maszyn', attrs: ['tech', 'discipline'] },
  track: { name: 'Toromistrz', attrs: ['track', 'discipline'] },
  physio: { name: 'Fizjoterapeuta', attrs: ['physio', 'medical'] },
  doctor: { name: 'Lekarz klubowy', attrs: ['medical', 'physio'] },
  scout: { name: 'Skaut', attrs: ['judging', 'tactics'] },
  fitness: { name: 'Trener przygotowania motorycznego', attrs: ['fitness', 'physio'] },
  psych: { name: 'Psycholog sportowy', attrs: ['psychology', 'motivation'] },
  miniCoach: { name: 'Trener miniżużla', attrs: ['mini', 'youth'] },
};
const STAFF_ATTRS = [['coaching', 'Trening techniczny'], ['tactics', 'Taktyka meczowa'], ['motivation', 'Motywacja'], ['youth', 'Praca z juniorami'],
  ['judging', 'Ocena talentu'], ['tech', 'Wiedza sprzętowa'], ['track', 'Przygotowanie toru'], ['medical', 'Medycyna'], ['physio', 'Fizjoterapia'], ['discipline', 'Dyscyplina'],
  ['fitness', 'Przygotowanie motoryczne'], ['psychology', 'Psychologia sportu'], ['mini', 'Miniżużel'], ['manMgmt', 'Zarządzanie ludźmi']];

// Szkółka – klasy pojemności silnika (miniżużel → licencja 500 cm³)
const ACADEMY_CATS = [
  // Klasy szkolenia PZM (regulamin szkoleniowy 2026, egzaminy „licencja Ż i 250cc/500R”): miniżużel 85–140 cm³ (certyfikat),
  // licencja 250 cm³/500R (jedna licencja – jazda na 250 cm³ albo na 500R), licencja Ż (500 cm³; egzamin od 15 lat, liga od 16).
  // ages – wiek treningów w klasie (ekstraliga.pl/se/szkolenie: pit bike 6–10, 85–140 cm³ od 8, 250 cm³/500R 11–15, 500 cm³ od 14);
  // ages[0] – od kiedy adept może trenować w klasie (także przed certyfikatem / egzaminem – starty dopiero z licencją, js/kid-licence.js).
  { id: 'c50', cc: 'pit bike', name: 'Pit bike', ages: [6, 10], lic: 'bez licencji – treningi od 6 lat (zawody pit bike 8–10 lat), pierwsze kroki przed miniżużlem' },
  { id: 'c85', cc: '85–140 cm³', name: 'Miniżużel 85–140 cm³', ages: [8, 13], lic: 'certyfikat 85–140 cm³ (egzamin po ukończeniu 10 lat, przed 12. urodzinami); treningi od 8 lat' },
  { id: 'c250', cc: '250 cm³', name: 'Klasa 250 cm³', ages: [11, 15], lic: 'licencja 250 cm³/500R (egzamin 13–15 lat) – jazda na 250 cm³; treningi od 11 lat' },
  { id: 'c500', cc: '500R', name: 'Klasa 500R', ages: [14, 18], lic: 'licencja 250 cm³/500R – jazda na 500R, trening na 500 cm³ od 14 lat; egzamin na licencję Ż możliwy po ukończeniu 15 lat' },
];

const INJURIES = [
  ['stłuczenie barku', 5, 14], ['naciągnięcie mięśnia uda', 7, 18], ['uraz kolana', 14, 40], ['złamanie obojczyka', 30, 60], ['wstrząśnienie mózgu', 7, 21],
  ['uraz nadgarstka', 10, 28], ['złamanie kości śródstopia', 28, 50], ['stłuczenie żeber', 7, 20], ['uraz kręgosłupa', 35, 90], ['złamanie ręki', 35, 70],
  ['skręcenie stawu skokowego', 6, 16], ['rozcięcie łuku brwiowego', 2, 6],
];
const SGP_VENUES = ['Landshut', 'Warszawa', 'Praga', 'Gorzów Wlkp.', 'Cardiff', 'Vojens', 'Målilla', 'Ryga', 'Wrocław', 'Toruń'];
const GENERIC_SPONSORS = ['Transbud', 'Agro-Mix', 'ElektroSerwis', 'Budmat', 'Moto-Części 24', 'Piekarnia Złoty Kłos', 'AutoKomis Premium', 'Drukarnia Grafix',
  'Hurtownia Stal-Pol', 'Browar Regionalny', 'Okna-Pro', 'Kancelaria Lex', 'Energia Plus', 'LogiTrans', 'Dom Meblowy Klasyk', 'Stacja Paliw Rondo'];

// ---------- Pomocnicze ----------
const skillToAttr = s => 1 + ((s - 3) / 12) * 17;
const potentialSkill = p => 3 + (p / 99) * 12;
function birthFromYear(year, seed) {
  const h = hashStr(seed);
  const m = 1 + (h % 12), d = 1 + ((h >>> 4) % 28);
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function estimateContract(skill, age, potential, league) {
  const rows = DATA.contractModel.filter(r => r.league === league).sort(by(r => r.min, -1));
  const row = rows.find(r => skill >= r.min) || rows[rows.length - 1];
  let f = 1;
  if (age != null && age <= 21) f = clamp(0.55 + (potential - 70) / 60, 0.4, 1.15);
  const top = rows[0];
  if (skill > top.min + 1) f *= 1 + (skill - top.min - 1) * 0.15;
  const signing = Math.round((row.signing * f) / 5000) * 5000;
  const perPoint = Math.round((row.perPoint * clamp(f, 0.6, 1.3)) / 100) * 100;
  return { signing, perPoint, role: row.role };
}
// genEquipment – js/equipment.js
function newRider(src, date) {
  const born = src.born ? birthFromYear(src.born, src.name) : null;
  let bornIso = born, bornEst = false;
  if (!bornIso) {
    const y = /junior/.test(src.profile || '') ? rint(2004, 2008) : rint(1988, 2003);
    bornIso = birthFromYear(y, src.name); bornEst = true;
  }
  const age = ageAt(bornIso, date);
  const r = {
    id: src.id, name: src.name, country: src.country, born: bornIso, bornEst,
    clubId: null, skill: src.skill, potential: src.potential, profile: src.profile, certainty: src.certainty,
    activity: src.activity, lastSeason: src.lastSeason, active: src.lastSeason >= 2024, note: src.note || null,
    attrs: {},
    cond: 100, form: 0, morale: 70, fatigue: 0, contract: null, injury: null,
    equip: genEquipment(src.skill, age), stats: {}, career: [], hist: [{ d: date, s: src.skill }], listed: false, lastMatches: [],
  };
  initRiderAbility(r); // CA/PA (kalibracja albo szacunek), atrybuty, cechy ukryte – js/ability.js
  r.hist = [{ d: date, s: r.skill }];
  return r;
}
function riderAge(r, date = G.date) { return ageAt(r.born, date); }
// Sezon sportowy: po zamknięciu sezonu (od 15 października) obowiązują już zasady wiekowe kolejnego roku
function sportSeason() { return G.seasonClosed === G.season ? G.season + 1 : G.season; }
function isJunior(r, season = sportSeason()) { return season - Number(r.born.slice(0, 4)) <= 21; }

// Płace sztabu (zł/mies.) według roli i ligi. Trener: PGE ok. 25 tys. (15–27 tys.), 2. Ekstraliga 10–20 tys., KLŻ 5–10 tys.
// (po-bandzie.com.pl); Stal Gorzów: trener ok. 20 tys., toromistrz ok. 10 tys., dział sportowy ponad 20 tys. (kosztorys klubu).
// W niższych ligach lekarz, fizjoterapeuta, toromistrz itp. pracują na umowach zlecenia – stąd niskie stawki. Poziom osoby: ±30%.
const ROLE_WAGE = {
  coach: { PGE: 25000, '2E': 15000, KLZ: 7500 }, manager: { PGE: 18000, '2E': 10000, KLZ: 4000 }, director: { PGE: 20000, '2E': 10000, KLZ: 4000 },
  assistant: { PGE: 12000, '2E': 7000, KLZ: 3000 }, teamManager: { PGE: 8000, '2E': 5000, KLZ: 2500 }, youth: { PGE: 7000, '2E': 4500, KLZ: 2500 },
  juniorCoach: { PGE: 9000, '2E': 5500, KLZ: 3000 }, u24Coach: { PGE: 10000, '2E': 6000, KLZ: 3000 },
  miniCoach: { PGE: 5000, '2E': 4000, KLZ: 3000 }, mechanic: { PGE: 9000, '2E': 6000, KLZ: 3000 }, track: { PGE: 10000, '2E': 6000, KLZ: 3000 },
  physio: { PGE: 8000, '2E': 4000, KLZ: 2000 }, doctor: { PGE: 6000, '2E': 3000, KLZ: 1500 }, scout: { PGE: 7000, '2E': 4000, KLZ: 2000 },
  fitness: { PGE: 8000, '2E': 4000, KLZ: 2000 }, psych: { PGE: 6000, '2E': 3000, KLZ: 1500 },
};
// Role osoby w klubie: główna (s.role) i dodatkowe (s.extraRoles). Kilka ról = mniejsza skuteczność w każdej z nich.
const staffRoles = s => [s.role, ...((s.extraRoles || []).filter(r => r !== s.role))];
const ROLE_EFF = [1, 0.8, 0.65, 0.55, 0.5];
const staffEff = s => ROLE_EFF[Math.min(ROLE_EFF.length, staffRoles(s).length) - 1] * (typeof scoutTrainPenalty === 'function' ? scoutTrainPenalty(s) : 1); // trener ze zleceniem skautingu – 75% (js/scouting.js)
const staffRoleNames = s => (s && s.national && !s.clubId ? `Menedżer ${nationTeam(s.national)}` : staffRoles(s).map(r => (STAFF_ROLES[r] || { name: r }).name).join(' · '));
const staffRoleName = s => (s && s.national && !s.clubId ? `Menedżer ${nationTeam(s.national)}` : (STAFF_ROLES[s.role] || { name: s.role }).name);
const COACH_ROLES = ['coach', 'assistant', 'juniorCoach', 'u24Coach', 'youth'];
// Sztab trenerski (trenerzy i specjaliści treningu) i osoby funkcyjne (kierownicy, toromistrz, lekarz, mechanicy…)
const COACH_GROUP = [...COACH_ROLES, 'fitness', 'psych', 'miniCoach'];
const staffKind = s => (COACH_GROUP.includes(s.role) ? 'coach' : 'func');
// Dopuszczalna liczba członków sztabu (jak w FM): wyższa liga i większy budżet – więcej miejsc; w niższych ligach jedna osoba pełni kilka ról.
// Menedżer-gracz nie wlicza się do limitu.
const STAFF_LIMIT = { PGE: { coach: 5, func: 6, tiers: [20e6, 28e6] }, '2E': { coach: 3, func: 4, tiers: [10e6, 15e6] }, KLZ: { coach: 2, func: 3, tiers: [3.5e6, 5e6] } };
function staffLimits(c) {
  const t = STAFF_LIMIT[c.league] || STAFF_LIMIT.KLZ;
  const bonus = t.tiers.filter(x => (c.budget || 0) >= x).length;
  return { coach: t.coach + bonus, func: t.func + bonus };
}
function staffCounts(c) {
  const st = clubStaff(c.id).filter(s => !s.player);
  return { coach: st.filter(s => staffKind(s) === 'coach').length, func: st.filter(s => staffKind(s) === 'func').length };
}
const staffSlotFree = (c, s) => staffCounts(c)[staffKind(s)] < staffLimits(c)[staffKind(s)];
function staffWageFor(s, c = s.clubId ? G.clubs[s.clubId] : null) {
  if (s.player) return s.wage || 0; // menedżer gracza (trener-zawodnik) – bez zmian
  if (s.wageDeal) return s.wageDeal; // pensja z przedłużonej umowy (js/staff-contracts.js)
  if (s.wageReal) return s.wageReal; // znana pensja trenera (js/coaches.js)
  const lg = c ? c.league : 'PGE', t = ROLE_WAGE[s.role];
  if (!t) return s.baseWage ?? s.wage ?? 0;
  const lvl = s.rep ?? 10;
  let w = (t[lg] ?? t.PGE) * clamp(0.75 + (lvl - 5) / 30, 0.7, 1.3);
  // dodatkowe role: +35% stawki każdej z nich
  for (const r of s.extraRoles || []) if (ROLE_WAGE[r]) w += (ROLE_WAGE[r][lg] ?? ROLE_WAGE[r].PGE) * 0.35;
  if (c && c.dormant && !c.activeFrom) w *= 0.2; // klub uśpiony: szczątkowy sztab
  return Math.round(w / 100) * 100;
}
function rescaleStaffWages() {
  for (const s of Object.values(G.staff)) {
    if (s.baseWage == null) s.baseWage = s.wage || 0;
    s.wage = staffWageFor(s); // wolni: stawka jak w PGE (przy zatrudnieniu – według ligi klubu)
  }
}
// Budżety klubów potwierdzone przez kluby (Śląsk Świętochłowice: sezon w KLŻ za 2,3 mln zł)
const BUDGET_FIX = { 'ŚWI': 2.3e6 };
function genStaff(clubId, role, level, date) {
  const born = `${rint(1958, 1995)}-${String(rint(1, 12)).padStart(2, '0')}-${String(rint(1, 28)).padStart(2, '0')}`;
  const s = { id: `S${G.seq.staff++}`, name: genName('POL'), country: 'POL', born, role, clubId, attrs: {}, until: G.season + rint(0, 2) };
  for (const [k] of STAFF_ATTRS) s.attrs[k] = clamp(Math.round(level * 0.55 + gauss(2.5)), 1, 20);
  for (const k of STAFF_ROLES[role].attrs) s.attrs[k] = clamp(Math.round(level + gauss(2)), 3, 20);
  s.rep = level;
  s.wage = staffWageFor(s, clubId ? G.clubs[clubId] : null);
  s.joined = date;
  if (typeof ensureStaffModel === 'function') ensureStaffModel(s); // profil trenera, cechy ukryte (js/training.js)
  return s;
}
function genKid(clubId, date, catIdx) {
  const cat = ACADEMY_CATS[catIdx];
  const age = rint(cat.ages[0], cat.ages[1] - (cat.id === 'c500' ? 2 : 1));
  const y = yearOf(date) - age;
  const born = `${y}-${String(rint(1, 12)).padStart(2, '0')}-${String(rint(1, 28)).padStart(2, '0')}`;
  const potential = clamp(Math.round(55 + gauss(14)), 25, 97);
  return {
    id: `A${G.seq.academy++}`, name: genName('POL'), country: 'POL', born, clubId, cat: cat.id,
    potential, ability: clamp(Math.round(potential * (0.25 + catIdx * 0.13) + gauss(6)), 5, 90),
    attrs: { talent: clamp(Math.round(potential / 5 + gauss(2)), 1, 20), technique: rint(3, 14), bravery: rint(4, 18), discipline: rint(3, 18), start: rint(3, 15) },
    joined: date, progress: [], parentsSupport: rint(1, 5),
  };
}

// ---------- Terminarze ----------
function roundRobin(ids) {
  const t = ids.slice();
  if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a != null && b != null) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    t.splice(1, 0, t.pop());
  }
  return rounds.concat(rounds.map(ps => ps.map(([a, b]) => [b, a])));
}
function firstSunday(year, month, day) { let d = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; while (dow(d) !== 6) d = addDays(d, 1); return d; }
function roundDates(season, n = 14) {
  const out = [];
  let d = firstSunday(season, 4, 1);
  const pauses = n > 14 ? new Set([6]) : new Set([4, 9, 12]);
  for (let i = 0; i < n; i++) { if (pauses.has(i)) d = addDays(d, 7); out.push(d); d = addDays(d, 7); }
  return out;
}
// ---------- Kalendarz rzeczywisty (js/calendar.js: terminarze GKSŻ, kalendarz FIM) ----------
const CAL = typeof CALENDAR !== 'undefined' ? CALENDAR : null;
const realSeason = season => !!(CAL && CAL.season === season);
const clubByCode = code => { const d = DATA.clubs.find(c => c.short === code); return d ? G.clubs[d.id] : null; };
// Skład lig w sezonie z oficjalnego terminarza; kluby spoza terminarzy nie startują w tym sezonie
function applyRealLeagues(season) {
  if (!realSeason(season)) return;
  const inCal = new Set();
  for (const [lg, L] of Object.entries(CAL.leagues)) for (const code of L.teams) {
    const c = clubByCode(code);
    if (!c) continue;
    inCal.add(c.id);
    if (c.league !== lg) { c.prevLeague = c.prevLeague || c.league; c.league = lg; }
    c.stadium.ticket = LEAGUES[lg].ticket;
  }
  for (const c of Object.values(G.clubs)) if (!inCal.has(c.id)) c.inactive = season;
}
// Kluby uśpione (bez drużyny seniorskiej): nie startują, nie podpisują kontraktów (poza warszawskimi) ani umów sponsorskich
// do decyzji o reaktywacji. Decyzja raz w roku (1 września) z podaną szansą; start od kolejnego sezonu w KLŻ.
const DORMANT_CLUBS = { TAR: 0.05, RAW: 0.025, WAR: 0.01 };
const clubActive = (c, season = G.season) => (!c.dormant || (!!c.activeFrom && season >= c.activeFrom)) && c.inactive !== season;
function markDormantClubs() {
  let ch = false;
  for (const c of Object.values(G.clubs)) {
    const p = DORMANT_CLUBS[c.short];
    if (p == null || c.reactivated) continue;
    if (!c.dormant) {
      if (clubActive(c, sportSeason())) continue; // klub już startuje w lidze
      c.dormant = true; ch = true;
    }
    if (c.joinChance !== p) { c.joinChance = p; ch = true; }
    if (c.activeFrom) continue;
    for (const s of Object.values(G.sponsors)) if (s.clubId === c.id) { delete G.sponsors[s.id]; ch = true; }
    for (const r of Object.values(G.riders)) {
      if (!r.contract || r.contract.clubId !== c.id || r.contract.kind === 'warszawski') continue;
      if (r.clubId === c.id) { r.clubId = null; r.prevClubId = c.id; }
      r.lastUntil = r.contract.until; r.contract = null; ch = true;
    }
    for (const r of Object.values(G.riders)) if (r.nextContract && r.nextContract.clubId === c.id) { delete r.nextContract; ch = true; }
    if (G.negs) for (const n of Object.values(G.negs)) if (n.clubId === c.id && (['club', 'pending', 'counter'].includes(n.status) || (n.status === 'agreed' && !n.done))) { n.status = 'withdrawn'; n.done = true; ch = true; }
  }
  return ch;
}
function playoffDates(season, lg) {
  if (realSeason(season) && lg && CAL.leagues[lg]) { const p = CAL.leagues[lg].playoff; return { sf1: p.sf[0], sf2: p.sf[1], f1: p.f[0], f2: p.f[1] }; }
  if (realSeason(season)) return playoffDates(season, 'PGE');
  const rs = Object.values(G.fixtures).filter(f => f.season === season && f.stage === 'RS' && (!lg || f.league === lg)).map(f => f.date).sort();
  const last = rs.length ? rs[rs.length - 1] : roundDates(season)[13];
  return { sf1: addDays(last, 14), sf2: addDays(last, 21), f1: addDays(last, 35), f2: addDays(last, 42) };
}
function seasonStart(season) {
  const ds = Object.values(G.fixtures).filter(f => f.season === season).map(f => f.date).sort();
  return ds[0] || addDays(roundDates(season)[0], -2);
}
function makeLeagueFixtures(season) {
  if (realSeason(season)) {
    for (const [lg, L] of Object.entries(CAL.leagues)) {
      const k = {};
      for (const f of L.fixtures) {
        const h = clubByCode(f.h), a = clubByCode(f.a);
        if (!h || !a) continue;
        k[f.r] = (k[f.r] || 0) + 1;
        const id = `F${season}-${lg}-${String(f.r).padStart(2, '0')}-${k[f.r]}`;
        G.fixtures[id] = { id, season, league: lg, stage: 'RS', round: f.r, date: f.d, homeId: h.id, awayId: a.id, played: false, homePts: null, awayPts: null, real: true };
      }
    }
    return;
  }
  for (const lg of LEAGUE_ORDER) {
    const ids = shuffle(Object.values(G.clubs).filter(c => c.league === lg && clubActive(c, season)).map(c => c.id));
    const rounds = roundRobin(ids);
    const dates = roundDates(season, rounds.length);
    rounds.forEach((pairs, ri) => {
      pairs.forEach(([h, a], k) => {
        const id = `F${season}-${lg}-${String(ri + 1).padStart(2, '0')}-${k + 1}`;
        const date = k === 0 ? addDays(dates[ri], -2) : dates[ri]; // pierwszy mecz kolejki w piątek
        G.fixtures[id] = { id, season, league: lg, stage: 'RS', round: ri + 1, date, homeId: h, awayId: a, played: false, homePts: null, awayPts: null };
      });
    });
  }
}
const normName = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().replace(/[^a-z ]/g, '').trim();
function findRiderByName(name) {
  const n = normName(name), all = Object.values(G.riders);
  let r = all.find(x => normName(x.name) === n);
  if (!r) { const p = n.split(' '), last = p[p.length - 1]; r = all.find(x => { const q = normName(x.name).split(' '); return q[q.length - 1] === last && q[0][0] === p[0][0]; }); }
  return r || null;
}
// Stali rezerwowi SGP z kalendarza FIM (R1–R4 w kolejności) – w sezonach z prawdziwymi danymi
function realSgpReserves(season, riders) {
  if (!realSeason(season) || !CAL || !(CAL.sgpReserves || []).length) return [];
  return CAL.sgpReserves.map(x => findRiderByName(x.name)).filter(r => r && !riders.includes(r.id)).map(r => r.id);
}
// Zapisy sprzed uzupełnienia bazy: stali uczestnicy i rezerwowi niezgodni z listą FIM (np. brakujący zawodnik zastąpiony
// najlepszym spoza listy) – poprawka bez ruszania rozegranych rund; punkty zawodnika spoza listy przepadają w klasyfikacji
function fixRealSgp() {
  if (!G.sgp || !G.sgp.real || !CAL || G.sgp.season !== CAL.season || G.sgp.fixedFim === 2) return false;
  G.sgp.fixedFim = 2;
  const list = CAL.sgpRiders.map(x => findRiderByName(x.name)).filter(Boolean).map(r => r.id);
  const missing = list.filter(id => !G.sgp.riders.includes(id)), extra = G.sgp.riders.filter(id => !list.includes(id));
  const out = [];
  for (const id of missing) {
    const old = extra.shift();
    if (old == null) break;
    G.sgp.riders[G.sgp.riders.indexOf(old)] = id;
    delete G.sgp.standings[old];
    G.sgp.standings[id] = G.sgp.standings[id] || 0;
    out.push([old, id]);
  }
  G.sgp.via = G.sgp.via || {};
  for (const x of CAL.sgpRiders) { const r = findRiderByName(x.name); if (r && x.via) G.sgp.via[r.id] = x.via; }
  const real = realSgpReserves(G.sgp.season, G.sgp.riders);
  if (real.length) G.sgp.reserves = [...real, ...(G.sgp.reserves || []).filter(id => !real.includes(id) && !G.sgp.riders.includes(id))].slice(0, 4);
  // wyznaczone wcześniej dzikie karty i rezerwy toru nierozegranych rund – od nowa (mogły wskazywać nowego stałego uczestnika)
  for (const id of G.sgp.rounds) { const e = G.events[id]; if (e && !e.played) delete e.sgpExtras; }
  return out.length > 0;
}
function makeSgp(season) {
  const pool = Object.values(G.riders).filter(r => r.active && !r.retired && !fimSuspended(r.country, `${season}-03-01`)).sort(by(r => r.skill, -1)); // bez zawieszonych federacji (js/nationality.js)
  let riders = [];
  const via = {};
  if (realSeason(season) && CAL.sgpRiders.length) riders = CAL.sgpRiders.map(x => { const r = findRiderByName(x.name); if (r) via[r.id] = x.via || 'lista FIM'; return r; }).filter(Boolean).map(r => r.id);
  else if (typeof sgpQualifiedFor === 'function') riders = sgpQualifiedFor(season, via); // FIM: 7 najlepszych, 4 z GP Challenge, mistrz Europy (js/qualification.js)
  else if (G.sgp && G.sgp.season === season - 1) {
    const top8 = seriesOrder('SGP', season - 1).slice(0, 8).map(Number).filter(id => G.riders[id] && G.riders[id].active && !G.riders[id].retired);
    const ch = Object.values(G.events).find(e => e.comp === 'SGPQ' && e.season === season - 1 && /Challenge/.test(e.name) && e.played && !e.cancelled);
    const quals = ch && G.matches[ch.matchId] ? G.matches[ch.matchId].classification.slice(0, 3).map(c => c.riderId).filter(id => G.riders[id]) : [];
    riders = [...new Set([...top8, ...quals])].filter(id => !fimSuspended(G.riders[id].country, `${season}-03-01`));
  }
  for (const r of pool) { if (riders.length >= 15) break; if (!riders.includes(r.id)) { riders.push(r.id); via[r.id] = 'stała dzika karta promotora'; } }
  // dzika karta i rezerwy toru: osobno na każdą rundę, od federacji kraju gospodarza (js/qualification.js: sgpRoundExtras)
  const real = realSgpReserves(season, riders);
  const reserves = [...real, ...pool.filter(r => !riders.includes(r.id) && !real.includes(r.id)).map(r => r.id)].slice(0, 4);
  if (G.sgp && G.sgp.season < season && Object.keys(G.sgp.standings || {}).length) (G.series = G.series || {})[`${G.sgp.season}-SGP`] = { ...G.sgp.standings }; // archiwum klasyfikacji poprzedniego sezonu
  G.sgp = { season, riders, reserves, via, standings: Object.fromEntries(riders.map(id => [id, 0])), rounds: [], real: realSeason(season), fixedFim: 2 };
  let rounds;
  if (realSeason(season)) rounds = CAL.fim.filter(e => e.series === 'SGP').map(e => ({ date: e.d, venue: e.venue, time: e.time }));
  else rounds = [[5, 3], [5, 17], [5, 31], [6, 14], [6, 28], [7, 19], [8, 9], [8, 30], [9, 13], [9, 27]].map(([m, d], i) => {
    let date = `${season}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    while (dow(date) !== 5) date = addDays(date, 1);
    return { date, venue: SGP_VENUES[i] };
  });
  rounds.forEach((r, i) => {
    const id = `SGP${season}-${i + 1}`;
    G.events[id] = { id, kind: 'sgp', season, round: i + 1, date: r.date, time: r.time || null, venue: r.venue, name: `Grand Prix ${r.venue}${rounds.filter(x => x.venue === r.venue).length > 1 ? ` (runda ${i + 1})` : ''}`, played: false };
    G.sgp.rounds.push(id);
  });
}

// Klub gry z rekordu bazy DATA.clubs
function newClub(c) {
  const lg = LEAGUES[c.league];
  const budgetRank = DATA.clubs.slice().sort(by(x => x.budget, -1)).map(x => x.id);
  return {
    id: c.id, name: c.name, short: c.short, city: c.city, league: c.league, colors: c.colors.slice(),
    budget: BUDGET_FIX[c.short] ?? c.budget, cash: Math.round((BUDGET_FIX[c.short] ?? c.budget) * 0.12), rep: clamp(Math.round(95 - budgetRank.indexOf(c.id) * 3.4), 20, 95),
    stadium: { name: c.stadium, capacity: c.capacity, attendance: c.attendance, track: c.track, surface: 'granit / łupek', lights: c.league !== 'KLZ', record: null, ticket: lg.ticket },
    fans: c.fans, fanMult: c.fanMult, facilities: { workshop: clamp(Math.round(c.budget / 7e6) + 1, 1, 5), academy: clamp(Math.round(c.budget / 9e6) + 1, 1, 5), training: clamp(Math.round(c.budget / 8e6) + 1, 1, 5) },
    park: { boxes: c.league === 'PGE' ? 16 : 12, clubEngines: [], mechanics: c.league === 'PGE' ? 4 : 2, dyno: c.league === 'PGE' },
    history: [], budgetInfo: c.budgetType, academyBudget: Math.round(c.budget * 0.02 / 1000) * 1000,
    objective: null, joinChance: c.joinChance ?? null,
  };
}
// ---------- Nowa gra ----------
const GAME_START = `${START_SEASON}-10-15`;
function newGame({ clubId, manager }) {
  const date = GAME_START;
  G = {
    v: 1, seed: (Math.random() * 2 ** 31) >>> 0, season: START_SEASON, date, clubId, manager: { name: manager || 'Menedżer', since: date },
    seq: { staff: 1, academy: 1, msg: 1, tx: 1, inj: 1, sp: 1, match: 1 },
    riders: {}, clubs: {}, staff: {}, academy: {}, attrhist: {}, fixtures: {}, matches: {}, messages: {}, injuries: {}, transactions: {}, sponsors: {}, events: {},
    shortlist: [], history: [], board: { confidence: 65 }, sgp: null, offers: [], lineups: {}, log: [], spTalks: {}, finTalks: {},
  };
  seedRng(G.seed);
  for (const c of DATA.clubs) G.clubs[c.id] = newClub(c);
  // zawodnicy + kontrakty
  for (const src of DATA.riders) {
    const r = newRider(src, date);
    const club = src.club && Object.values(G.clubs).find(c => c.name === src.club);
    if (club && src.contract) {
      r.clubId = club.id;
      r.contract = { clubId: club.id, signing: src.contract.signing, perPoint: src.contract.perPoint, from: src.contract.from, until: src.contract.until,
        kind: src.contract.kind, source: src.contract.source, certainty: src.contract.certainty, note: src.contract.note };
    }
    G.riders[r.id] = r;
  }
  addDaneRiders(date);
  // sztab: tylko prawdziwe osoby (kadry 2026, rejestr PZM, trenerzy z js/coaches.js) – bez generowanych
  // sponsorzy
  for (const c of DATA.clubs) finSeedSponsors(G.clubs[c.id], c); // portfel sponsorów i finanse klubu (js/finance.js)
  if (typeof boardStartDebts === 'function') boardStartDebts(); // zadłużenie na start (Stal Gorzów – js/board-data.js)
  // Start 15.10.2025: sezon 2025 zakończony (bez wyników w grze); 1 listopada rusza sezon 2026 – terminarz, cele, okienko
  G.seasonClosed = START_SEASON;
  applyRealLeagues(START_SEASON + 1);
  applyRosters2026();
  if (typeof applyRealRosters === 'function') applyRealRosters();
  markDormantClubs(); // Unia Tarnów, Kolejarz Rawicz, WTS Warszawa – uśpione do decyzji o reaktywacji
  if (typeof addInactiveRiders === 'function') addInactiveRiders();
  if (typeof licMigrate === 'function') licMigrate();
  if (typeof rolesMigrate === 'function') rolesMigrate(); // role zawodników w drużynach (js/roles.js)
  if (typeof applyContractCases === 'function') applyContractCases(); // rzeczywiste sytuacje kontraktowe 2026 (js/contract-cases.js) // licencja wygasła zamiast „kariery zawieszonej” (js/rider-licence.js)
  if (typeof applyNationalities === 'function') applyNationalities();
  if (typeof calibrateSkills === 'function') calibrateSkills();
  G.rosters2026Applied = true;
  if (typeof applyMiniData === 'function') applyMiniData();
  applyAbilityModel(true); // CA/PA z kalibracji, nowe atrybuty, adepci miniżużla z protokołów
  ensureSeasonEvents();
  G.sgp = { season: START_SEASON, riders: [], reserves: [], standings: {}, rounds: [] };
  for (const c of Object.values(G.clubs)) c.objective = boardObjective(c);
  migrateMarket(); // rynek: negocjacje, wypożyczenia, kluby szkolące (js/market.js)
  scaleStartContracts(); // kwoty kontraktów startowych do 75% budżetu klubu
  rescaleStaffWages(); // płace sztabu według ligi (etaty i umowy zlecenia)
  if (typeof ensureTrainingModel === 'function') ensureTrainingModel(); // trening: nowe role, obiekty, historia atrybutów
  if (typeof ensureScheduleModel === 'function') ensureScheduleModel(); // terminarz: ligi zagraniczne, dziennik startów
  if (typeof ensureEquipmentModel === 'function') ensureEquipmentModel(); // tunerzy, silniki, budżety sprzętowe (js/equipment.js)
  if (typeof ensureEngineRegistry === 'function') ensureEngineRegistry(); // numery seryjne i karty silników (js/engine-registry.js)
  if (typeof ensureAcademyBikes === 'function') ensureAcademyBikes(); // motocykle szkółki i ich rynek używanych
  if (typeof applyCoachModel === 'function') applyCoachModel(); // sztaby: tylko prawdziwe osoby, główni trenerzy 2026 (js/coaches.js)
  if (typeof ensureAdeptModel === 'function') ensureAdeptModel(); // zagraniczni adepci, koniec kariery (js/adepts.js)
  if (typeof ensurePlanModel === 'function') ensurePlanModel(); // planer treningu (js/planner.js)
  if (typeof ensureScoutModel === 'function') ensureScoutModel(); // skauting (js/scouting.js)
  offseasonWelcome();
  return G;
}
// Zawodnicy spoza bazy globalnej oraz KSM, średnie 2023–2025, roczniki i kraje z Dane.xlsx
function addDaneRiders(date) {
  if (!DATA.rosters2026) return;
  for (const src of DATA.rosters2026.newRiders) {
    if (G.riders[src.id]) continue;
    const r = newRider({ ...src, country: COUNTRY[src.country] ? src.country : 'POL', profile: 'zawodnik spoza bazy globalnej (Dane.xlsx)', certainty: 'szacunek z KSM', activity: [], lastSeason: 2025 }, date);
    G.riders[r.id] = r;
  }
  for (const e of [...DATA.rosters2026.riders, ...DATA.rosters2026.newRiders]) {
    const r = G.riders[e.id];
    if (!r) continue;
    r.ksm = e.ksm; r.avgs = e.avgs;
    if (e.country && COUNTRY[e.country]) r.country = e.country;
    if (e.born && (r.bornEst || Number(r.born.slice(0, 4)) !== e.born)) { r.born = birthFromYear(e.born, r.name); r.bornEst = false; }
  }
}
// Zapis utworzony przed wczytaniem Dane.xlsx i kalendarza GKSŻ: uzupełnienie przed startem sezonu 2026
function migrateSave() {
  if (G.rosters2026Applied || !DATA.rosters2026 || G.date >= `${DATA.rosters2026.season - 1}-11-01`) return false;
  addDaneRiders(G.date);
  applyRealLeagues(DATA.rosters2026.season);
  applyRosters2026();
  if (typeof applyRealRosters === 'function') applyRealRosters();
  for (const c of Object.values(G.clubs)) c.objective = boardObjective(c);
  G.lineups = {};
  G.rosters2026Applied = true;
  addMsg({ category: 'zarząd', from: 'Sekretariat', stop: true, title: `Kadry i terminarze na sezon ${DATA.rosters2026.season}`,
    body: `<p>Wczytano kadry klubów na sezon ${DATA.rosters2026.season} (${esc(DATA.rosters2026.source)}) oraz podział na ligi według oficjalnych terminarzy GKSŻ. Terminarz meczów i kalendarz Grand Prix zostaną opublikowane 1 listopada.</p>${squadReportHtml(G.clubId)}`, link: '#/druzyna' });
  return true;
}
// Kluby dopisane do bazy po utworzeniu zapisu (np. Kolejarz Rawicz, WTS Warszawa) – dołączają jako nieaktywne
function addMissingClubs() {
  let added = false;
  for (const src of DATA.clubs) {
    if (G.clubs[src.id]) continue;
    const c = G.clubs[src.id] = newClub(src);
    c.inactive = G.season;
    c.objective = boardObjective(c);
    finSeedSponsors(c, src);
    added = true;
  }
  return added;
}
// Składy na sezon 2026 z Dane.xlsx: zawodnik z klubem dostaje umowę na 2026, pozostali są wolni
function applyRosters2026() {
  const R = DATA.rosters2026;
  if (!R) return;
  const assign = new Map([...R.riders, ...R.newRiders].map(e => [e.id, e.club]));
  for (const r of Object.values(G.riders)) {
    const code = assign.get(r.id);
    const c = code ? clubByCode(code) : null;
    if (!c) {
      if (r.clubId) { r.prevClubId = r.clubId; r.clubId = null; r.contract = null; }
      continue;
    }
    const keep = r.contract && r.contract.clubId === c.id && r.contract.until >= R.season;
    if (!keep) {
      const age = ageAt(r.born, `${R.season}-06-30`);
      const est = estimateContract(r.skill, age, r.potential, c.league);
      if (r.clubId && r.clubId !== c.id) r.prevClubId = r.clubId;
      r.contract = { clubId: c.id, signing: est.signing, perPoint: est.perPoint, from: R.season, until: R.season + (age <= 21 ? 1 : rint(0, 1)),
        kind: 'zawodowy', source: `skład ${R.season} (${R.source}); kwoty – estymacja modelowa`, certainty: 'kwoty szacunkowe' };
    }
    r.clubId = c.id;
  }
}
// Grand Prix i wszystkie zawody kalendarza sezonu sportowego (po zamknięciu sezonu – już kolejnego)
function ensureSeasonEvents() {
  const s = sportSeason();
  if (!G.sgp || G.sgp.season !== s) makeSgp(s);
  fixRealSgp();
  if (typeof makeCompEvents === 'function') makeCompEvents(s);
  if (typeof makeForeignChampEvents === 'function') makeForeignChampEvents(s); // mistrzostwa krajowe za granicą (js/foreign.js)
}
function offseasonWelcome() {
  const c = myClub(), lg = LEAGUES[c.league];
  const expiring = clubRiders(c.id).filter(r => r.contract && r.contract.until <= G.season);
  addMsg({ category: 'zarząd', from: `Zarząd ${c.name}`, title: `Witamy w ${c.name}!`,
    body: `<p>Zarząd klubu wita Cię na stanowisku menedżera drużyny. Sezon ${G.season} właśnie się zakończył – przed nami przygotowania do sezonu ${G.season + 1} w rozgrywkach <b>${lg.name}</b>.</p>
      <p>Na koncie mamy <b>${fmtMoney(c.cash, true)}</b>. Cele i budżet na nowy sezon zarząd przedstawi 1 listopada, razem z publikacją terminarza. Okienka transferowe: podstawowe 16–20 listopada i uzupełniające 22–31 grudnia; w trakcie sezonu można dobierać tylko wolnych zawodników w okienkach śródrocznych.</p>
      <p>Pamiętaj: w meczu ligowym jedzie 8 zawodników – numery 1–5 (seniorzy), 6–7 (juniorzy U21) i 8 (U24).</p>`, link: '#/druzyna' });
  addMsg({ category: 'transfer', from: 'Sekretariat', title: expiring.length ? `Kończące się kontrakty (${expiring.length})` : 'Kontrakty na kolejny sezon',
    body: expiring.length ? `<p>Z końcem sezonu ${G.season} wygasają umowy: ${expiring.map(r => `<a href="#/zawodnik/${r.id}/kontrakt">${esc(r.name)}</a>`).join(', ')}.</p><p>Trwa okres prekontraktów: do 31 października możesz uzgodnić przedłużenie (profil zawodnika → Kontrakt), ale inne kluby też mogą składać oferty. 1 listopada zawodnicy bez nowej umowy staną się wolni.</p>`
      : '<p>Wszyscy zawodnicy mają ważne umowy na kolejny sezon.</p>', link: '#/finanse/kontrakty' });
  addMsg({ category: 'sztab', from: 'Trener', title: `Kadra na sezon ${G.season + 1}`, body: `${DATA.rosters2026 && !DATA.rosters2026.ignoredClubs.includes(c.short) ? `<p>Kadry wszystkich klubów na sezon ${G.season + 1} pochodzą z pliku ${esc(DATA.rosters2026.source)}; kwoty kontraktów są szacunkowe.</p>` : `<p>Klub nie ma jeszcze skompletowanej kadry na sezon ${G.season + 1} – zawodników pozyskasz w okienku transferowym od 1 listopada.</p>`}${squadReportHtml(c.id)}`, link: '#/druzyna/lista' });
}
function boardObjective(c) {
  const same = Object.values(G.clubs).filter(x => x.league === c.league).sort(by(x => x.budget, -1));
  const rank = same.indexOf(c) + 1, n = same.length;
  if (rank <= 2) return { code: 'title', text: 'Walka o mistrzostwo', minPos: 2 };
  if (rank <= 4) return { code: 'playoff', text: 'Awans do fazy play-off (top 4)', minPos: 4 };
  if (rank <= n - 2) return { code: 'mid', text: 'Miejsce w środku tabeli', minPos: n - 2 };
  return { code: 'stay', text: c.league === 'KLZ' ? 'Rozwój drużyny i młodzieży' : 'Utrzymanie w lidze', minPos: n - 1 };
}
function squadReportHtml(clubId) {
  const rs = clubRiders(clubId);
  const jun = rs.filter(r => isJunior(r)), sen = rs.filter(r => !isJunior(r));
  const best = rs.slice().sort(by(r => r.skill, -1))[0];
  const warn = [];
  const n15 = slots15(rs); // na numery 1–5 także juniorzy ponad dwóch potrzebnych na 6–7
  if (n15 < 6) warn.push(n15 < 5 ? `Na numery 1–5 mamy tylko ${n15} ${plural(n15, 'zawodnika', 'zawodników', 'zawodników')} (seniorzy i juniorzy ponad dwóch na numery 6–7) – potrzeba pięciu.` : 'Na numery 1–5 mamy dokładnie pięciu zawodników – bez rezerwy na wypadek kontuzji.');
  if (jun.length < 2) warn.push(`Mamy tylko ${jun.length} ${plural(jun.length, 'juniora', 'juniorów', 'juniorów')} (U21) – potrzebujemy dwóch do numerów 6 i 7.`);
  return `<p>W kadrze: ${sen.length} seniorów i ${jun.length} juniorów.${best ? ` Liderem jest <b>${esc(best.name)}</b> (${esc(caClass(best.ca).toLowerCase())}).` : ''}</p>${warn.length ? `<ul>${warn.map(w => `<li>${w}</li>`).join('')}</ul><p>Warto przejrzeć listę wolnych zawodników w zakładce Transfery.</p>` : '<p>Skład wygląda na kompletny.</p>'}`;
}

// ---------- Zapytania ----------
const clubRiders = id => Object.values(G.riders).filter(r => r.clubId === id);
const clubStaff = id => Object.values(G.staff).filter(s => s.clubId === id);
const myClub = () => G.clubs[G.clubId] || NO_CLUB;
const NO_CLUB = { id: 0, name: '', league: null, cash: 0, history: [], objective: {} };
// Najlepsza wartość atrybutu w sztabie klubu – pamięć podręczna na dany dzień gry (sztab zmienia się rzadko)
let STAFF_BEST = { date: null, map: new Map() };
function staffBest(clubId, attr) {
  if (STAFF_BEST.date !== G.date || STAFF_BEST.n !== G.seq.staff) STAFF_BEST = { date: G.date, n: G.seq.staff, map: new Map() };
  // klub gracza: osoba wskazana do zadania w podziale obowiązków (Trening → Obowiązki, js/board.js)
  if (clubId === G.clubId && G.duties && G.duties[attr] && G.staff[G.duties[attr]] && G.staff[G.duties[attr]].clubId === clubId) return G.staff[G.duties[attr]].attrs[attr] || 0;
  const key = clubId + '|' + attr;
  if (!STAFF_BEST.map.has(key)) { const s = clubStaff(clubId); STAFF_BEST.map.set(key, s.length ? Math.max(...s.map(x => x.attrs[attr] || 0)) : 5); }
  return STAFF_BEST.map.get(key);
}
function addMsg(m) {
  const id = `M${G.seq.msg++}`;
  G.messages[id] = { id, date: G.date, read: false, category: 'inne', from: '', ...m };
  return G.messages[id];
}
function addTx(clubId, kind, amount, desc) {
  const c = G.clubs[clubId];
  c.cash += amount;
  if (typeof ledgerAdd === 'function') ledgerAdd(c, kind, amount); // księga roczna wszystkich klubów (js/budget.js)
  if (clubId !== G.clubId) return;
  const id = `T${G.seq.tx++}`;
  G.transactions[id] = { id, date: G.date, clubId, kind, amount: Math.round(amount), desc, season: G.season };
}
// Ocena sprzętu: średnia dwóch najlepszych silników parku maszyn (także tych na przeglądzie/remoncie zimowym, bez awaryjnych);
// tor, warunki i dostępność liczą się dopiero przy wyborze silnika na bieg (js/equipment.js)
function equipRating(r) {
  const e = r.equip.engines.filter(x => x.job !== 'repair' || engReady(x)).map(x => engineValue(x, r)).sort((a, b) => b - a).slice(0, 2);
  if (!e.length) return 30;
  return sum(e) / e.length;
}
function riderValue(r) {
  const age = riderAge(r);
  const est = estimateContract(r.skill, age, r.potential, 'PGE');
  let v = est.signing * 1.4;
  if (age <= 21) v *= 1 + (r.potential - 75) / 40;
  if (age >= 33) v *= 0.6;
  return Math.max(10000, Math.round(v / 10000) * 10000);
}
// Status juniora rocznikowo do końca roku kalendarzowego, w którym zawodnik kończy 21 lat. Regulamin, składy i rynek patrzą na sezon
// sportowy (po zakończeniu sezonu – na następny), a etykieta do 31 grudnia pokazuje bieżący rok (z dopiskiem seniorFromNote)
const calJunior = r => Number(G.date.slice(0, 4)) - Number(r.born.slice(0, 4)) <= 21;
const seniorFromNote = r => (calJunior(r) && !isJunior(r) ? `senior od ${sportSeason()}` : '');
function riderRole(r) {
  if (ageAt(r.born, G.date) < 16) return 'Junior (U16)'; // według daty urodzenia (nieukończone 16 lat)
  if (isJunior(r) || calJunior(r)) return 'Junior (U21)';
  if (sportSeason() - Number(r.born.slice(0, 4)) <= 24) return 'Senior U24';
  return 'Senior';
}
