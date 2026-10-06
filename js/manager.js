'use strict';
// Postać menedżera gracza: dane osobowe, doświadczenie, atrybuty rozdzielane punktami (jak w FM)
// i opcjonalna rola trenera pierwszej drużyny (osoba w sztabie klubu z profilem trenera).

const MGR_ATTRS = [
  ['negotiation', 'Negocjacje', 'Kontrakty zawodników, transfery i umowy sponsorskie'],
  ['strategy', 'Strategia', 'Ustalanie składu, nominacje i rezerwy taktyczne'],
  ['charisma', 'Charyzma', 'Autorytet w szatni i wpływ na morale zawodników'],
  ['manMgmt', 'Zarządzanie ludźmi', 'Rozmowy z zawodnikami i sztabem, atmosfera w klubie'],
  ['business', 'Finanse i biznes', 'Budżet, koszty, relacje z miastem i akcjonariuszami'],
  ['media', 'Media i wizerunek', 'Konferencje, kibice i wizerunek klubu'],
  ['judging', 'Ocena talentu', 'Trafność ocen zawodników i adeptów'],
  ['technical', 'Wiedza sprzętowa', 'Silniki, tunerzy i przygotowanie toru'],
  ['discipline', 'Dyscyplina', 'Egzekwowanie zasad i profesjonalizmu'],
];
// Gracz jest debiutantem: bez prowadzonych klubów i bez startów ligowych. Zaplecze menedżerskie: pula punktów, maksimum atrybutu,
// startowe zaufanie zarządu, renoma
const MGR_EXP = [
  { id: 'none', name: 'Bez doświadczenia', desc: 'Pierwsza praca w sporcie.', pool: 72, cap: 13, conf: 55, rep: 1 },
  { id: 'volunteer', name: 'Działacz społeczny', desc: 'Wolontariat przy zawodach, stowarzyszenie kibiców, pomoc w szkółce.', pool: 80, cap: 13, conf: 56, rep: 1 },
  { id: 'business', name: 'Menedżer w biznesie', desc: 'Kierowanie firmą lub zespołem poza sportem – finanse, negocjacje, ludzie.', pool: 88, cap: 14, conf: 58, rep: 2 },
  { id: 'sport', name: 'Studia z zarządzania sportem', desc: 'Wykształcenie kierunkowe i staże w klubach sportowych (bez prowadzenia drużyny).', pool: 88, cap: 14, conf: 58, rep: 2 },
];
// Doświadczenie żużlowe (bez startów w lidze): premia do puli punktów trenera i autorytet w szatni
const SPW_EXP = [
  { id: 'none', name: 'Brak', desc: 'Nigdy nie jeździł na żużlu.', coachBonus: 0, auth: 0 },
  { id: 'amateur', name: 'Amator', desc: 'Jazda amatorska i rekreacyjna, bez licencji.', coachBonus: 2, auth: 1 },
  { id: 'mini', name: 'Miniżużel', desc: 'Starty w miniżużlu jako dziecko.', coachBonus: 3, auth: 1 },
  { id: 'licence', name: 'Licencja bez kariery', desc: 'Zdał egzamin na licencję żużlową, ale nigdy nie przebił się do składu ligowego.', coachBonus: 6, auth: 2 },
];
// Kompetencje trenerskie: pula punktów i maksimum atrybutu trenera, renoma, uprawnienia (licencja trenerska PZM)
const COACH_EXP = [
  { id: 'none', name: 'Brak', desc: 'Bez uprawnień i bez doświadczenia szkoleniowego.', pool: 50, cap: 12, rep: 1 },
  { id: 'school', name: 'Treningi w szkółce', desc: 'Prowadził zajęcia z dziećmi i adeptami w szkółce, bez uprawnień.', pool: 58, cap: 13, rep: 2 },
  { id: 'instructor', name: 'Instruktor sportu żużlowego', desc: 'Uprawnienia instruktora (kurs PZM) – szkolenie adeptów i juniorów.', pool: 64, cap: 13, rep: 3, lic: 'instruktor' },
  { id: 'coach', name: 'Trener sportu żużlowego', desc: 'Uprawnienia trenera (kurs trenerski PZM lub AWF ze specjalizacją).', pool: 72, cap: 14, rep: 4, lic: 'trener' },
  { id: 'other', name: 'Trener innej dyscypliny', desc: 'Uprawnienia trenerskie w innym sporcie lub przygotowanie motoryczne (AWF).', pool: 64, cap: 14, rep: 2 },
];
const COACH_ATTRS = [
  ['coaching', 'Trening techniczny', 'Rozwój techniki jazdy zawodników'],
  ['tactics', 'Taktyka meczowa', 'Ustawienie par, nominacje, odczytanie toru'],
  ['motivation', 'Motywacja', 'Pobudzenie zawodników przed biegiem i po porażce'],
  ['youth', 'Praca z juniorami', 'Szkolenie juniorów i adeptów 250–500 cm³'],
  ['mini', 'Miniżużel', 'Szkolenie dzieci w klasach 50–125 cm³'],
  ['fitness', 'Przygotowanie motoryczne', 'Siła, wytrzymałość, zwinność'],
  ['psychology', 'Psychologia sportu', 'Opanowanie, koncentracja, radzenie sobie z presją'],
  ['tech', 'Wiedza sprzętowa', 'Dopasowanie sprzętu do toru i warunków'],
  ['discipline', 'Dyscyplina', 'Profesjonalizm i przestrzeganie zasad'],
];
const ATTR_MIN = 1;

const findById = (list, id) => list.find(x => x.id === id) || list[0];
const pointsSpent = obj => sum(Object.values(obj));
// Równy podział puli na atrybuty (z limitem maksimum)
function evenSpread(defs, pool, cap) {
  const out = {}, n = defs.length, base = Math.floor(pool / n);
  defs.forEach(([k], i) => { out[k] = clamp(base + (i < pool - base * n ? 1 : 0), ATTR_MIN, cap); });
  return out;
}
function coachPool(w) { return findById(COACH_EXP, w.coachExp).pool + findById(SPW_EXP, w.spwExp).coachBonus; }
function newWizard() {
  const me = MGR_EXP[0], ce = COACH_EXP[0];
  return {
    step: 'dane', person: { first: '', last: '', born: '1985-06-15', place: '', country: 'POL' },
    mgrExp: me.id, mgr: evenSpread(MGR_ATTRS, me.pool, me.cap),
    spwExp: 'none', coachExp: ce.id, coachAttrs: evenSpread(COACH_ATTRS, ce.pool, ce.cap), profile: 'start', side: '',
    licYear: '', years: 2, kids: [], club: null, err: '',
  };
}
// Gracz zawsze jest menedżerem drużyny (główny trener w sztabie klubu): kwalifikacje trenerskie i profil trenera to stałe kroki
function wizSteps() { return ['dane', 'menedzer', 'kwalifikacje', 'trener', 'klub']; }
const CONTRACT_YEARS = [1, 2, 3];

// Tworzy postać menedżera w nowej grze (po newGame): gracz zostaje menedżerem drużyny (główny trener w sztabie klubu),
// a dotychczasowy menedżer odchodzi z klubu do trenerów bez kontraktu.
function applyManagerProfile(w) {
  const p = w.person, me = findById(MGR_EXP, w.mgrExp), sp = findById(SPW_EXP, w.spwExp), ce = findById(COACH_EXP, w.coachExp);
  const name = `${p.first.trim()} ${p.last.trim()}`.trim(), club = G.clubs[G.clubId];
  G.manager = { name, first: p.first.trim(), last: p.last.trim(), born: p.born, place: p.place.trim(), country: p.country, since: G.date,
    exp: me.id, spwExp: sp.id, coachExp: ce.id, attrs: { ...w.mgr }, rep: me.rep, coachId: null };
  G.board.confidence = me.conf;
  addManagerChildren(w);
  const released = [];
  for (const s of clubStaff(G.clubId)) if (s.role === 'coach' && !s.player) {
    Object.assign(s, { clubId: null, until: null, prevClubId: G.clubId, left: G.date });
    released.push(s);
  }
  const m = G.manager.attrs, ca = w.coachAttrs, years = CONTRACT_YEARS.includes(Number(w.years)) ? Number(w.years) : 2;
  const s = { id: `S${G.seq.staff++}`, name, country: p.country, born: p.born, place: p.place.trim(), role: 'coach', clubId: G.clubId, attrs: {}, until: G.season + years, // gra startuje po sezonie 2025: 1 sezon = do końca 2026
    wage: 0, rep: ce.rep, joined: G.date, player: true, funcs: ce.lic ? ['TR'] : [] };
  for (const [k] of STAFF_ATTRS) s.attrs[k] = ca[k] ?? 3;
  Object.assign(s.attrs, { judging: m.judging, manMgmt: m.manMgmt, track: clamp(Math.round(3 + m.technical * 0.5), 1, 20), medical: 3, physio: 4 });
  s.profile = { main: w.profile, side: w.side && w.side !== w.profile ? w.side : null };
  const age = ageAt(p.born, G.date);
  s.hidden = { authority: clamp(Math.round(3 + ce.rep * 0.6 + sp.auth + (m.charisma - 10) * 0.3), 1, 20),
    modern: clamp(Math.round(14 - (age - 40) / 4), 1, 20), determination: clamp(Math.round(7 + m.discipline * 0.45), 1, 20) };
  if (ce.lic) s.licence = { kind: ce.lic, year: Number(w.licYear) || null, src: 'dane podane w kreatorze postaci' };
  s.wage = staffWageFor({ ...s, player: false }, club); // pensja debiutanta według ligi i renomy
  G.staff[s.id] = s;
  G.manager.coachId = s.id;
  if (released.length) addMsg({ category: 'zarząd', from: `Zarząd ${club.name}`, title: `Zmiana menedżera: ${released.map(x => x.name).join(', ')} odchodzi`,
    body: `<p>Wraz z Twoim zatrudnieniem klub rozwiązał umowę z dotychczasowym menedżerem: <b>${released.map(x => esc(x.name)).join(', ')}</b>. Jest teraz trenerem bez kontraktu.</p><p>Twój kontrakt: do końca sezonu ${s.until}, ${fmtMoney(s.wage)} miesięcznie.</p>`, link: `#/osoba/${s.id}` });
  return G.manager;
}
// Dzieci menedżera: do 15 lat rocznikowo w sezonie 2026. Jeżdżące trafiają do szkółki miniżużla klubu gracza –
// od razu albo (młodsze niż 6 lat) w dniu 6. urodzin – szkolenie od 6 lat (ekstraliga.pl/se/szkolenie).
const CHILD_SEASON = START_SEASON + 1, CHILD_MAX_AGE = 15, CHILD_JOIN_AGE = 6, MAX_CHILDREN = 5;
const childYearOk = born => { const y = Number(String(born).slice(0, 4)); return y >= CHILD_SEASON - CHILD_MAX_AGE && born <= GAME_START; };
const childJoinDate = born => `${Number(born.slice(0, 4)) + CHILD_JOIN_AGE}${born.slice(4)}`;
function childError(c, p) {
  if (!c.first.trim()) return 'Podaj imię każdego dziecka.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.born || '')) return `Podaj datę urodzenia: ${c.first.trim()}.`;
  if (!childYearOk(c.born)) return `${c.first.trim()}: można dodać tylko dzieci do ${CHILD_MAX_AGE} lat (rocznik ${CHILD_SEASON - CHILD_MAX_AGE} lub młodszy), urodzone przed ${fmtDate(GAME_START)}.`;
  if (/^\d{4}/.test(p.born || '') && Number(c.born.slice(0, 4)) - Number(p.born.slice(0, 4)) < 16) return `${c.first.trim()}: dziecko musi być co najmniej 16 lat młodsze od menedżera.`;
  return '';
}
// Adept szkółki z dziecka menedżera (klub gracza, klasa według wieku, talent ukryty jak u innych adeptów)
function childToAcademy(rec) {
  const k = { id: `A${G.seq.academy++}`, name: rec.name, country: rec.country || G.manager.country || 'POL', born: rec.born, birthYear: Number(rec.born.slice(0, 4)), clubId: G.clubId, schoolId: typeof clubSchoolId === 'function' ? clubSchoolId(G.clubId) : null,
    cat: kidCatFor(null, ageYears(rec.born)), joined: G.date, progress: [], parentsSupport: 5, meets: 0, mgrChild: true };
  G.academy[k.id] = k;
  initKidAbility(k, null);
  rec.kidId = k.id;
  rec.joinOn = null;
  return k;
}
function addManagerChildren(w) {
  const p = w.person;
  G.manager.children = [];
  for (const c of w.kids || []) {
    const rec = { name: `${c.first.trim()} ${p.last.trim()}`, born: c.born, country: p.country, rides: !!c.rides, kidId: null, joinOn: null };
    if (c.rides) { const j = childJoinDate(c.born); if (j <= G.date) childToAcademy(rec); else rec.joinOn = j; }
    G.manager.children.push(rec);
  }
}
// Codziennie (js/game.js: newDay): młodsze dzieci dołączają do szkółki w dniu 6. urodzin
function managerChildrenDay() {
  for (const rec of (G.manager && G.manager.children) || []) {
    if (!rec.rides || rec.kidId || rec.riderId || !rec.joinOn || G.date < rec.joinOn) continue;
    const k = childToAcademy(rec), c = myClub();
    addMsg({ category: 'szkółka', from: 'Trener szkółki', title: `${rec.name} dołącza do szkółki miniżużla`, link: `#/adept/${k.id}`,
      body: `<p>${esc(rec.name)} skończył${/a$/.test(rec.name.split(' ')[0]) ? 'a' : ''} 5 lat i rozpoczyna treningi w szkółce ${esc(c.name)} (${esc(ACADEMY_CATS.find(x => x.id === k.cat).name)}). Na ocenę talentu przyjdzie czas.</p>` });
  }
}
// Atrybut menedżera (zapisy sprzed kreatora postaci: wartość przeciętna)
function mgrAttr(k) { return (G.manager && G.manager.attrs && G.manager.attrs[k]) || 10; }
function mgrRole() { return G.manager && G.manager.coachId && G.staff[G.manager.coachId] && G.staff[G.manager.coachId].clubId === G.clubId ? 'menedżer i trener' : 'menedżer'; }
