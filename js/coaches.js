'use strict';
// Główni trenerzy drużyn 2026 i znani trenerzy bez klubu.
// Źródła: ekstraliga.pl (kariery trenerów PGE Ekstraligi), po-bandzie.com.pl (trenerzy 2. Ekstraligi, stan 14.02.2026;
// najlepsi trenerzy w Polsce, XI 2025), zuzlowydegustator.pl (składy KLŻ), sportowefakty.wp.pl (ranking trenerów dekady).
// Atrybuty i profile są oceną gry na podstawie osiągnięć i opisów w tych artykułach.
// a: [trening, taktyka, motywacja, praca z juniorami, psychologia, zarządzanie ludźmi, ocena talentu]; auth – autorytet
// w – pensja miesięczna (zł) według doniesień medialnych (trenerzy PGE: średnio ok. 25 tys.; Toruń ok. 27 tys., Lublin ok. 23 tys.,
//     Okoniewski ok. 20 tys., Paluch i Walasek 15–20 tys.; w KLŻ zwykle ok. 5 tys., wyraźnie więcej Kędziora w Gdańsku);
//     u wolnych trenerów – oczekiwania. Bez kwoty – stawka z modelu płac (js/world.js: staffWageFor).

const COACHES_2026 = [
  // PGE Ekstraliga
  { club: 1, name: 'Piotr Protasiewicz', w: 25000, born: '1975-01-25', a: [13, 13, 14, 12, 12, 13, 13], p: ['start', 'lines'], auth: 16, note: 'mistrz świata juniorów 1996, IMP 1999' },
  { club: 2, name: 'Piotr Baron', w: 27000, born: 1974, a: [16, 17, 15, 13, 13, 17, 15], p: ['team', 'lines'], auth: 17, note: 'mistrz Polski 2025 z Toruniem; wcześniej złoto z Unią Leszno, finał ze Spartą' },
  { club: 3, name: 'Grzegorz Walasek', w: 18000, a: [12, 12, 13, 12, 11, 12, 12], p: ['slide', 'start'], auth: 14, note: 'IMP 2004, DMP 2003 i 2009' },
  { club: 4, name: 'Maciej Kuciapa', w: 23000, a: [15, 16, 15, 12, 13, 15, 14], p: ['team', 'slide'], auth: 15, note: 'architekt pierwszego mistrzostwa Polski Motoru Lublin' },
  { club: 6, name: 'Mariusz Staszewski', w: 25000, born: 1975, a: [13, 13, 16, 15, 14, 14, 13], p: ['mental', 'basics'], auth: 13, note: 'mistrz Europy 2001; motywacja, atmosfera w drużynie, praca z juniorami' },
  { club: 7, name: 'Piotr Paluch', w: 17000, a: [13, 13, 13, 12, 11, 13, 12], p: ['lines', 'slide'], auth: 14, note: 'wychowanek i wieloletni zawodnik Stali Gorzów' },
  { club: 8, name: 'Robert Kościecha', w: 25000, a: [14, 14, 13, 15, 12, 14, 13], p: ['start', 'basics'], auth: 14, note: 'pierwszy play-off GKM (2024), mocne starty sezonu, rozwój juniorów' },
  { club: 9, name: 'Rafał Okoniewski', w: 20000, a: [12, 12, 13, 13, 12, 12, 12], p: ['start', 'lines'], auth: 13, note: 'dwukrotny mistrz Europy U-19, Złoty Kask 2003' },
  // Metalkas 2. Ekstraliga
  { club: 5, name: 'Robert Mikołajczak', a: [10, 10, 11, 11, 10, 10, 10], p: ['basics', 'start'], auth: 10, note: 'w ROW Rybnik od grudnia 2025' },
  { club: 10, name: 'Dariusz Śledź', a: [11, 12, 12, 11, 11, 11, 12], p: ['lines', 'team'], auth: 12, note: 'w Polonii Bydgoszcz od października 2025' },
  { club: 11, name: 'Piotr Świderski', a: [11, 11, 12, 12, 11, 11, 11], p: ['slide', 'start'], auth: 12, note: 'w Wilkach Krosno od października 2024' },
  { club: 20, name: 'Paweł Piskorz', a: [13, 13, 13, 12, 11, 14, 12], p: ['team', 'lines'], auth: 13, note: 'w Stali Rzeszów 2022–2025 (najdłużej pracujący trener 2. Ekstraligi), od 2026 menedżer Polonii Piła' },
  { club: 12, name: 'Krzysztof Kasprzak', a: [11, 12, 13, 10, 11, 11, 12], p: ['start', 'team'], auth: 13, note: 'menedżer Stali Rzeszów od 2026 (wcześniej zawodnik)' },
  { club: 13, name: 'Eryk Jóźwiak', a: [12, 12, 12, 12, 11, 12, 12], p: ['lines', 'team'], auth: 12, note: 'w PSŻ Poznań od października 2024' },
  { club: 14, name: 'Tomasz Bajerski', a: [12, 12, 12, 12, 11, 12, 12], p: ['start', 'team'], auth: 12, note: 'w TŻ Ostrovia od listopada 2025 (wcześniej Polonia Bydgoszcz)' },
  { club: 16, name: 'Maciej Jąder', a: [11, 11, 12, 11, 11, 11, 11], p: ['slide', 'basics'], auth: 11, note: 'w Orle Łódź od lipca 2025' },
  { club: 20, role: 'assistant', name: 'Norbert Kościuch', a: [11, 10, 12, 13, 11, 11, 11], p: ['basics', 'start'], auth: 11, note: 'w Polonii Piła od listopada 2024' },
  // Krajowa Liga Żużlowa
  { club: 17, name: 'Lech Kędziora', w: 15000, a: [13, 15, 14, 12, 12, 14, 13], p: ['team', 'mental'], auth: 15, note: 'czołówka rankingu trenerów dekady (Włókniarz, Wybrzeże)' },
  { club: 18, name: 'Radosław Majewski', a: [10, 11, 11, 10, 10, 11, 11], p: ['team', 'lines'], auth: 10 },
  { club: 19, name: 'Kjastas Puodżuks', born: '1986-08-23', country: 'LAT', note: 'prowadzi Lokomotiv od 2026 (wcześniej asystent Nikołaja Kokina)', a: [9, 10, 10, 11, 9, 10, 10], p: ['slide', 'basics'], auth: 10 },
  { club: 21, name: 'Adam Weigel-Milleret', w: 5500, a: [9, 9, 10, 10, 9, 9, 10], p: ['basics', 'start'], auth: 9 },
  { club: 22, name: 'Robert Ruszkiewicz', w: 6000, a: [10, 10, 10, 11, 10, 10, 10], p: ['basics', 'lines'], auth: 10 },
  { club: 23, name: 'Klaus Zwerschina', country: 'GER', a: [9, 10, 10, 9, 9, 10, 10], p: ['team', 'slide'], auth: 10 },
  // trenerzy w sztabach bez funkcji głównego trenera
  { club: 9, role: 'assistant', name: 'Rafał Dobrucki', a: [16, 16, 15, 17, 14, 15, 15], p: ['start', 'basics'], auth: 16, note: 'były trener kadry, sukcesy z reprezentacją juniorów' },
  // Śląsk Świętochłowice: wakat na stanowisku głównego trenera
  { club: 24, role: 'assistant', name: 'Krzysztof Bas', a: [9, 9, 10, 10, 9, 9, 9], p: ['basics', 'start'], auth: 9 },
  // bez klubu
  { club: null, name: 'Stanisław Chomski', w: 30000, a: [16, 19, 15, 13, 13, 16, 17], p: ['lines', 'team'], auth: 20, national: 'POL', note: 'selekcjoner reprezentacji Polski; „żużlowa encyklopedia”, taktyk' },
  { club: null, name: 'Michał Widera', a: [9, 9, 10, 10, 9, 9, 9], p: ['basics', 'start'], auth: 9 },
  // menedżerowie kadr narodowych (Nicki Pedersen – także czynny zawodnik)
  { club: null, name: 'Mark Lemon', country: 'AUS', a: [11, 13, 13, 11, 11, 12, 12], p: ['team', 'lines'], auth: 14, national: 'AUS', note: 'menedżer reprezentacji Australii' },
  { club: null, name: 'Oliver Allen', country: 'GBR', a: [11, 12, 13, 11, 11, 12, 12], p: ['team', 'start'], auth: 13, national: 'GBR', note: 'menedżer reprezentacji Wielkiej Brytanii' },
  { club: null, name: 'Nicki Pedersen', country: 'DEN', born: '1977-04-02', a: [12, 14, 15, 10, 12, 12, 13], p: ['mental', 'start'], auth: 18, national: 'DEN', note: 'menedżer reprezentacji Danii, trzykrotny indywidualny mistrz świata' },
  { club: null, name: 'Marek Cieślak', w: 32000, a: [15, 18, 18, 12, 14, 17, 16], p: ['mental', 'team'], auth: 20, note: 'nr 1 rankingu trenerów dekady; wieloletni selekcjoner, sukcesy z reprezentacją' },
  { club: null, name: 'Nikołaj Kokin', country: 'LAT', a: [13, 14, 13, 14, 11, 13, 14], p: ['slide', 'basics'], auth: 14, note: 'Lokomotiv Daugavpils, reprezentacja Łotwy' },
  { club: null, name: 'Jacek Frątczak', born: '1975-09-23', a: [12, 13, 17, 11, 15, 13, 12], p: ['mental', 'team'], auth: 13, note: 'Get Well Toruń; entuzjasta, świetny motywator' },
  { club: null, school: 'LIPN', role: 'youth', name: 'Adam Skórnicki', a: [14, 15, 14, 13, 13, 14, 14], p: ['lines', 'start'], auth: 15, note: 'mistrzostwo Polski z Unią Leszno, później Falubaz' },
  { club: 13, role: 'director', name: 'Sławomir Kryjom', born: '1980-06-25', w: 16000, a: [12, 14, 12, 11, 11, 12, 15], p: ['lines', 'team'], auth: 13, note: 'doceniany menedżer, od kilku lat bez pracy w klubie' },
];
// Osoby błędnie przypisane do sztabów (zawodnicy) – usuwane
const NOT_STAFF = ['Patrick Hansen', 'Kasts Puodzuks', 'Kasts Puodžuks', 'Adam Weigel']; // Puodżuks z dwóch źródeł (rejestr PZM: „Kasts Puodzuks”) – jedna osoba: Kjastas Puodżuks
// Kraj osób ze sztabów klubów zagranicznych (pozostali – POL)
const STAFF_COUNTRY = { 'Herbert Rudolph': 'GER', 'Xaver Landersdorfer': 'GER', 'Regina Mueller': 'GER', 'Gerald Simbeck': 'GER', 'Klaus Zwerschina': 'GER' };
const CLUB_COUNTRY = { 19: 'LAT' };

function coachAttrs(s, e) {
  const [tr, tac, mot, youth, psy, man, jud] = e.a;
  Object.assign(s.attrs, { coaching: tr, tactics: tac, motivation: mot, youth, psychology: psy, manMgmt: man, judging: jud, discipline: s.attrs.discipline ?? 10 });
  s.profile = { main: e.p[0], side: e.p[1] || null };
  s.hidden = { ...(s.hidden || {}), authority: e.auth };
  s.rep = Math.round((tr + tac + mot) / 3);
  if (e.note) s.note = e.note;
  if (e.w) s.wageReal = e.w;
  if (e.national) s.national = e.national === true ? 'POL' : e.national; else delete s.national;
}
// Porządek w sztabach: tylko prawdziwe osoby, kluby uśpione bez sztabu, kraje, główni trenerzy według źródeł
function applyCoachModel() {
  if (G.coachModel === 10) return false;
  for (const s of Object.values(G.staff)) {
    if (s.player) continue;
    if (!s.real || NOT_STAFF.some(n => normName(n) === normName(s.name))) { delete G.staff[s.id]; continue; }
    if (STAFF_COUNTRY[s.name]) s.country = STAFF_COUNTRY[s.name];
    else if (CLUB_COUNTRY[s.clubId]) s.country = CLUB_COUNTRY[s.clubId];
  }
  const find = name => Object.values(G.staff).find(s => !s.player && normName(s.name) === normName(name));
  for (const e of COACHES_2026) {
    const club = e.club != null ? G.clubs[e.club] : null;
    if (e.club != null && !club) continue;
    const role = e.role || 'coach';
    // poprzedni główny trener klubu zostaje w sztabie jako asystent
    if (role === 'coach' && club) for (const s of clubStaff(club.id)) if (s.role === 'coach' && !s.player && normName(s.name) !== normName(e.name)) s.role = 'assistant';
    let s = find(e.name);
    if (!s) {
      s = genStaff(club ? club.id : null, role, Math.round(e.a[0]), G.date);
      Object.assign(s, { name: e.name, born: null, real: true, funcs: ['TR'], source: 'artykuły o trenerach 2025–2026', until: G.season + 1, joined: null });
      G.staff[s.id] = s;
    }
    Object.assign(s, { name: e.name, clubId: club ? club.id : null, role, country: e.country || s.country || 'POL' }); // pisownia z listy (np. Kasts Puodžuks)
    // klub gracza: menedżerem jest gracz – dotychczasowy główny trener pozostaje bez kontraktu
    if (role === 'coach' && club && club.id === G.clubId && Object.values(G.staff).some(x => x.player && x.clubId === G.clubId)) Object.assign(s, { clubId: null, until: null });
    if (e.school) s.schoolId = e.school; else delete s.schoolId;
    if (e.born) s.born = typeof e.born === 'number' ? birthFromYear(e.born, e.name) : e.born;
    if (club && !s.until) s.until = G.season + 1;
    coachAttrs(s, e);
    if (club) s.wage = typeof staffWageFor === 'function' ? staffWageFor(s, club) : s.wage;
  }
  // pozostałe osoby ze sztabów: atrybuty trenerskie najwyżej na poziomie ligi (dane rejestru nie mówią nic o klasie),
  // pensja według obecnej roli (np. dawny główny trener jako asystent)
  const listed = new Set(COACHES_2026.map(e => normName(e.name)));
  const CAP = { PGE: 14, '2E': 12, KLZ: 10 };
  for (const s of Object.values(G.staff)) {
    if (s.player || listed.has(normName(s.name))) continue;
    const cap = CAP[s.clubId && G.clubs[s.clubId] ? G.clubs[s.clubId].league : 'KLZ'] ?? 10;
    for (const k of ['coaching', 'tactics', 'motivation', 'youth', 'judging', 'psychology', 'fitness', 'manMgmt', 'mini']) if (s.attrs[k] > cap) s.attrs[k] = cap - (hrand(s.name + k) < 0.5 ? 1 : 0);
    s.rep = Math.min(s.rep ?? cap, cap);
    if (typeof staffWageFor === 'function') s.wage = staffWageFor(s);
  }
  // daty urodzenia: Polish Speedway Database (js/staff-born.js), dla trenerów spoza bazy – z js/coaches.js
  if (typeof STAFF_BORN !== 'undefined') for (const st of Object.values(G.staff)) if (!st.player && STAFF_BORN[st.name]) st.born = STAFF_BORN[st.name];
  // ta sama osoba w bazie zawodników (np. Nicki Pedersen): data z PSD zamiast szacunkowej
  if (typeof STAFF_BORN !== 'undefined') for (const r of Object.values(G.riders)) { const b = STAFF_BORN[r.name]; if (b && b.slice(0, 4) === String(r.born).slice(0, 4)) { r.born = b; r.bornEst = false; } }
  // kluby uśpione: bez sztabu (osoby przechodzą do grona wolnych)
  for (const c of Object.values(G.clubs)) if (c.inactive) for (const s of clubStaff(c.id)) if (!s.player) s.clubId = null;
  if (G.staffShortlist) G.staffShortlist = G.staffShortlist.filter(id => G.staff[id]);
  if (typeof TQ !== 'undefined') TQ.date = null;
  if (typeof STAFF_BEST !== 'undefined') STAFF_BEST.date = null;
  if (typeof applyClubStaff2026 === 'function') applyClubStaff2026();
  G.coachModel = 10;
  return true;
}

// ---------- Obsada ról w klubach na sezon 2026 ----------
// Role: menedżer (główny trener) = coach, trener (asystent) = assistant, trener juniorów = juniorCoach, trener drużyny U24 = u24Coach
// (tylko PGE Ekstraliga), trener szkółki = youth. Źródła: zestawienia prasowe sztabów 2026 (data/staff: sportowefakty.wp.pl, ekstraliga.pl,
// polskizuzel.pl, zuzlowydegustator.pl, strony klubów) – „prasa”; luki uzupełnione z rejestru osób funkcyjnych PZM 2026 (uprawnienia
// trenera / instruktora w klubie) – „rejestr”. Trenerów drużyn U24 źródła nie podają – wakaty.
// other: [osoba, rola] – funkcje spoza pięciu ról trenerskich (dyrektor, menedżer organizacyjny, kierownik drużyny, motoryk).
const CLUB_STAFF_2026 = {
  1: { coach: 'Piotr Protasiewicz', assistant: ['Sławomir Drabik'], juniorCoach: ['Wojciech Kończyło'], youth: ['Marek Kończyło'], other: [['Mariusz Cieśliński', 'fitness'], ['Jakub Król', 'director']] },
  2: { coach: 'Piotr Baron', assistant: ['Tomasz Zieliński', 'Karol Ząbik'], youth: ['Marcin Kowalik', 'Jan Ząbik'] },
  // Falubaz – strona klubu: Walasek – menedżer pierwszej drużyny i trener szkółki żużlowej
  3: { coach: 'Grzegorz Walasek', assistant: ['Tomasz Szymankiewicz'], juniorCoach: ['Nikodem Bartoch'], youth: ['Grzegorz Walasek', 'Przemysław Zarzycki'], other: [['Aleksander Janas', 'director'], ['Marek Mróz', 'teamManager']] },
  // Motor – drużynę U24 prowadzi sztab Ekstraligi z Kuciapą
  4: { coach: 'Maciej Kuciapa', assistant: ['Rafał Trojanowski'], juniorCoach: ['Piotr Więckowski'], u24Coach: ['Maciej Kuciapa'], youth: ['Maciej Kuromonow', 'Maciej Więckowski', 'Mirosław Cierniak'], other: [['Jacek Ziółkowski', 'manager']] },
  6: { coach: 'Mariusz Staszewski', assistant: ['Janusz Ślączka'], juniorCoach: ['Bartosz Świącik'], youth: ['Józef Kafel'], other: [['Krzysztof Wójcik', 'manager']] },
  7: { coach: 'Piotr Paluch', assistant: ['Piotr Rembas', 'Piotr Świst'], juniorCoach: ['Paweł Parys'], youth: ['Mieczysław Woźniak', 'Jarosław Gała', 'Krzysztof Okupski'], other: [['Krzysztof Orzeł', 'manager']] },
  // GKM – strona klubu (gkm.grudziadz.net/informacje): trener pierwszej drużyny, trener drużyny U24, szkolenie młodzieży, kierownik drużyny, psycholog
  8: { coach: 'Robert Kościecha', u24Coach: ['Robert Kempiński'], youth: ['Robert Kościecha', 'Krzysztof Buczkowski'], other: [['Rafał Wojciechowski', 'teamManager'], ['Natalia Kobylańska', 'psych']] },
  9: { coach: 'Rafał Okoniewski', assistant: ['Rafał Dobrucki'], juniorCoach: ['Roman Jankowski'], youth: ['Adrian Gomólski'] },
  5: { coach: 'Robert Mikołajczak', assistant: ['Antoni Skupień'], other: [['Konrad Sobala', 'manager']] },
  10: { coach: 'Dariusz Śledź', assistant: ['Adrian Miedziński'], juniorCoach: ['Jacek Woźniak'], youth: ['Waldemar Cisoń'], other: [['Krzysztof Kanclerz', 'manager']] },
  11: { coach: 'Piotr Świderski', assistant: ['Ireneusz Kwieciński'], juniorCoach: ['Maciej Gilowski'], other: [['Michał Finfa', 'manager']] },
  12: { coach: 'Krzysztof Kasprzak', assistant: ['Kamil Brzozowski'], juniorCoach: ['Dawid Lampart'], youth: ['Stanisław Kępowicz'] },
  13: { coach: 'Eryk Jóźwiak', other: [['Jacek Kannenberg', 'manager'], ['Sławomir Kryjom', 'director']] },
  14: { coach: 'Tomasz Bajerski', assistant: ['Tomasz Gapiński'] },
  16: { coach: 'Maciej Jąder', juniorCoach: ['Marcel Kajzer'], other: [['Piotr Mikołajczak', 'manager']] },
  20: { coach: 'Paweł Piskorz', assistant: ['Norbert Kościuch'] },
  17: { coach: 'Lech Kędziora', juniorCoach: ['Piotr Szymko'], other: [['Mariusz Kędzielski', 'teamManager']] },
  18: { coach: 'Radosław Majewski', juniorCoach: ['Norbert Krakowiak'], youth: ['Błażej Skrzeszewski'] },
  19: { coach: 'Kjastas Puodżuks', other: [['Aleksejs Lomass', 'teamManager']] },
  21: { coach: 'Adam Weigel-Milleret', assistant: ['Mirosław Kowalik'], youth: ['Stanisław Burza', 'Jacek Rempała'], other: [['Kamil Jelonek', 'manager']] },
  22: { coach: 'Robert Ruszkiewicz', juniorCoach: ['Marcin Sekulla'], other: [['Jarosław Dymek', 'manager']] },
  23: { coach: 'Klaus Zwerschina', assistant: ['Herbert Rudolph'], other: [['Bernhard Muggenthaler', 'teamManager']] },
  24: { coach: null, assistant: ['Krzysztof Bas'], youth: ['Sebastian Kowolik', 'Jacek Folkert'], other: [['Krzysztof Wlaźlak', 'teamManager']] },
};
// Szkółki miniżużlowe spoza klubów ligowych (id szkółki z js/mini-data.js) – trenerzy / instruktorzy z rejestru PZM 2026 i kursu 2026
const SCHOOL_STAFF_2026 = {
  GDAN: ['Kacper Gomólski', 'Adrian Gała'], LIPN: ['Adam Skórnicki'], RYBN: ['Paweł Trześniewski', 'Adam Pawliczek'], REDZ: ['Szymon Wolski'],
  SWIE: [], TARC: [], BYDG: [], LAMB: [], TORU: [], ZIEL: [], GORZ: [], LESZ: [], RAW: [], WAW: [],
};
// Szacowane osoby wymagające weryfikacji (z rejestru, nie z prasy)
const STAFF_2026_FROM_REGISTRY = ['Tomasz Szymankiewicz', 'Piotr Świst', 'Antoni Skupień', 'Adrian Miedziński', 'Nikodem Bartoch', 'Paweł Parys', 'Bartosz Świącik', 'Piotr Więckowski',
  'Maciej Gilowski', 'Dawid Lampart', 'Marcel Kajzer', 'Piotr Szymko', 'Marcin Sekulla', 'Mirosław Kowalik', 'Karol Ząbik', 'Herbert Rudolph', 'Jarosław Gała', 'Krzysztof Okupski',
  'Stanisław Burza', 'Jacek Rempała', 'Mirosław Cierniak', 'Maciej Więckowski', 'Adam Pawliczek', 'Szymon Wolski', 'Krzysztof Wójcik', 'Krzysztof Orzeł'];
// Źródła osób spoza rejestru
const STAFF_2026_SRC = { 'Sławomir Drabik': 'sztab Sparty 2026 (strona klubu)', 'Mariusz Cieśliński': 'sztab Sparty 2026 (strona klubu)', 'Jacek Ziółkowski': 'sztaby 2026 (sportowefakty.wp.pl)',
  'Bernhard Muggenthaler': 'sztaby KLŻ 2026 (zuzlowydegustator.pl)', 'Jacek Folkert': 'kurs instruktorów PZM 28.03.2026 (speedwaysw.pl), Śląsk Świętochłowice' };
// Licencjonowani instruktorzy (lista PZM / kurs 2026) bez funkcji w klubie w 2026 – wolni; czynni zawodnicy z licencją instruktora nie są dopisywani
const FREE_INSTRUCTORS_2026 = ['Kamil Walczak', 'Maciej Fajfer', 'Paweł Baran', 'Robert Jucha', 'Tomasz Szupienko', 'Cyprian Szymko', 'Rafał Koszałka', 'Martyna Mróz'];
// Byli prowadzący drużyny (protokoły PSD 2020–2025) bez pracy w klubie w 2026 – wolni trenerzy
const FREE_COACHES_2026 = ['Piotr Żyto', 'Robert Jabłoński', 'Robert Sawina', 'Janusz Stachyra', 'Krzysztof Gałańdziuk', 'Przemysław Buszkiewicz'];
const LEAGUE_LVL = { PGE: 12, '2E': 10, KLZ: 8 };
function applyClubStaff2026() {
  const find = name => Object.values(G.staff).find(s => !s.player && normName(s.name) === normName(name));
  const placed = new Map(); // osoba → rola główna nadana w tym przebiegu (kolejne role → extraRoles)
  const place = (name, clubId, role, schoolId = null) => {
    let s = find(name);
    if (s && placed.has(s.id) && s.clubId === clubId) { if (s.role !== role && !(s.extraRoles || []).includes(role)) s.extraRoles = [...(s.extraRoles || []), role]; if (clubId && typeof staffWageFor === 'function') s.wage = staffWageFor(s, G.clubs[clubId]); return s; }
    const c = clubId ? G.clubs[clubId] : null, lvl = c ? LEAGUE_LVL[c.league] ?? 8 : 9;
    if (!s) {
      s = genStaff(clubId, role, lvl + Math.round(hgauss(name + 'lv') * 1.5), G.date);
      Object.assign(s, { name, born: null, real: true, joined: null, funcs: [], source: STAFF_2026_SRC[name] || (STAFF_2026_FROM_REGISTRY.includes(name) ? 'rejestr osób funkcyjnych PZM 2026'
        : FREE_COACHES_2026.includes(name) ? 'prowadzący drużynę w protokołach PSD 2020–2025' : FREE_INSTRUCTORS_2026.includes(name) ? 'lista instruktorów sportu żużlowego PZM' : 'sztaby 2026 (prasa, strony klubów)') });
      G.staff[s.id] = s;
    }
    // trenerzy z listy głównych (js/coaches.js) mają już role i atrybuty – zmieniamy tylko, gdy lista klubu ich przypisuje
    s.clubId = clubId; s.role = role; delete s.extraRoles; placed.set(s.id, role);
    if (role === 'coach' && clubId === G.clubId && Object.values(G.staff).some(x => x.player && x.clubId === G.clubId)) { s.clubId = null; s.until = null; } // menedżerem klubu gracza jest gracz
    if (schoolId) s.schoolId = schoolId; else delete s.schoolId;
    if (c && typeof staffWageFor === 'function') s.wage = staffWageFor(s, c);
    if (typeof ensureStaffModel === 'function') { s.profile = s.profile === undefined ? undefined : s.profile; ensureStaffModel(s); }
    return s;
  };
  for (const [cid, r] of Object.entries(CLUB_STAFF_2026)) {
    const clubId = Number(cid);
    if (!G.clubs[clubId]) continue;
    // główny trener klubu: jeden; dotychczasowi „główni” spoza listy zostają jako asystenci
    for (const s of clubStaff(clubId)) if (s.role === 'coach' && !s.player && (!r.coach || normName(s.name) !== normName(r.coach))) s.role = 'assistant';
    if (r.coach) place(r.coach, clubId, 'coach');
    for (const n of r.assistant || []) place(n, clubId, 'assistant');
    for (const n of r.juniorCoach || []) place(n, clubId, 'juniorCoach');
    if (G.clubs[clubId].league === 'PGE') for (const n of r.u24Coach || []) place(n, clubId, 'u24Coach');
    for (const n of r.youth || []) place(n, clubId, 'youth');
    for (const [n, role] of r.other || []) place(n, clubId, role);
  }
  for (const [sid, names] of Object.entries(SCHOOL_STAFF_2026)) for (const n of names) {
    const s = find(n);
    if (s && s.clubId) continue; // osoba pracuje też w klubie ligowym (np. AS Wybrzeże – szkółka Wybrzeża Gdańsk)
    place(n, null, 'youth', sid);
  }
  for (const n of FREE_COACHES_2026) if (!find(n)) place(n, null, 'coach');
  for (const n of FREE_INSTRUCTORS_2026) if (!find(n)) place(n, null, 'youth');
  if (typeof STAFF_BORN !== 'undefined') for (const st of Object.values(G.staff)) if (!st.player && STAFF_BORN[st.name]) st.born = STAFF_BORN[st.name];
}
// Licencja trenera / instruktora sportu żużlowego (lista PZM 11.07.2025, kurs 28.03.2026)
function staffLicence(s) {
  if (s.licence) return s.licence; // gracz: uprawnienia podane w kreatorze postaci
  if (s.player) return null;
  if (typeof STAFF_LIC === 'undefined') return null;
  return STAFF_LIC[s.name] || Object.entries(STAFF_LIC).find(([n]) => normName(n) === normName(s.name))?.[1] || null;
}
