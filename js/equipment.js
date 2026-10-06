'use strict';
// Sprzęt i park maszyn: tunerzy (prawdziwe warsztaty), silniki zawodników i klubu, ukryty budżet sprzętowy zawodnika,
// przeglądy u tunera, zakupy zimą, dobór silnika na każdy bieg, defekty i uszkodzenia po upadkach, mechanicy klubowi.
// Źródła tunerów i widełek cen: data/equipment/RAPORT.md (tools/build-equipment-research.cjs). Pary zawodnik–tuner na start
// to doniesienia prasowe; oceny liczbowe (moc, niezawodność, pojemność, specyfika) są założeniami gry, nie rankingiem.

// id, nazwisko, warsztat, kraj, renoma, moc, niezawodność, rozrzut egzemplarzy, charakterystyka (+ moment/start, − prędkość),
// klienci (limit), engCap: nowe silniki na sezon (RK ok. 40 wg Kowalskiego, Ash-Tech 55), ovhCap: remonty zimowe (Ash-Tech 60–70),
// svcDay: przeglądy dziennie (Ash-Tech 2–3 przy 4 osobach), cena silnika (ok. 30 tys. zł), cena przeglądu (5–8 tys. zł), ban: odmowy (RK),
// minimalny poziom nowego klienta, heat: zachowanie w upale (−: słabiej powyżej ~25°C, lepiej w chłodzie), form0: forma na start.
// docs: klienci na start gry [zawodnik, ...tunerzy dodatkowi] – doniesienia prasowe 2025–2026, zestawienie i źródła:
// data/equipment/TUNERZY-2025-26.md. Liczby (moc, limity, ceny, forma) to założenia gry oparte na tych doniesieniach.
const TUNER_DB = [
  { id: 'ash', name: 'Ashley Holloway', shop: 'Ash-Tech', country: 'GBR', rep: 'światowa czołówka (dominacja w SGP 2025–2026)', power: 93, rel: 0.95, cons: 2.5, drive: 0, heat: -1.5, cap: 35, engCap: 55, ovhCap: 70, svcDay: 3, engine: 32000, service: 6500, minSkill: 9, form0: 1.5,
    docs: [['Brady Kurtz'], ['Robert Lambert'], ['Mikkel Michelsen'], ['Patryk Dudek'], ['Daniel Bewley'], ['Piotr Pawlicki'], ['Janusz Kołodziej'], ['Ryan Douglas'], ['Ben Cook'], ['Oleksandr Loktaev'], ['Max Fricke'], ['Rasmus Jensen']] },
  { id: 'rk', name: 'Ryszard Kowalski', shop: 'RK Racing', ban: ['Piotr Pawlicki', 'Patryk Dudek', 'Emil Sayfutdinov'], country: 'POL', rep: 'światowa czołówka (Cierpice k. Torunia)', power: 93, rel: 1.0, cons: 2.5, drive: 0.5, heat: 0, cap: 22, engCap: 40, ovhCap: 50, svcDay: 3, engine: 32000, service: 6500, minSkill: 10, form0: 0,
    docs: [['Bartosz Zmarzlik'], ['Artem Łaguta'], ['Jack Holder'], ['Wiktor Przyjemski'], ['Kacper Woryna'], ['Szymon Woźniak'], ['Luke Becker'], ['Krzysztof Buczkowski'], ['Paweł Przedpełski'], ['Andžejs Ļebedevs', 'ash'], ['Nicolai Heiselberg'], ['Antoni Kawczyński'], ['Oskar Rumiński', 'wg', 'ash']] },
  { id: 'pj', name: 'Peter Johns', shop: 'PJR', country: 'GBR', rep: 'uznany tuner międzynarodowy (mistrzowie świata 2012–2016)', power: 90, rel: 1.0, cons: 3, drive: -0.5, heat: 0, cap: 25, engCap: 45, ovhCap: 55, svcDay: 3, engine: 30000, service: 6000, minSkill: 8.5, form0: 0.5,
    docs: [['Martin Vaculik'], ['Michael Jepsen Jensen'], ['Chris Holder'], ['Rohan Tungate'], ['Grzegorz Zengota'], ['Tobiasz Musielak'], ['Norick Blödorn', 'mk'], ['Jan Heleniak'], ['Wiktor Jasiński'], ['Niels-Kristian Iversen'], ['Mikołaj Duchiński', 'ash', 'rk']] },
  { id: 'mm', name: 'Michał Marmuszewski', shop: 'MMX Racing Team', country: 'POL', rep: 'specjalista z Lublina, klienci w Ekstralidze', power: 87, rel: 1.0, cons: 3.5, drive: 1, heat: 0, cap: 18, engCap: 30, ovhCap: 60, svcDay: 2, engine: 29000, service: 5500, minSkill: 8, form0: 0.5,
    docs: [['Emil Sayfutdinov'], ['Dominik Kubera', 'frj'], ['Jarosław Hampel'], ['Maksym Drabik'], ['Przemysław Pawlicki']] },
  { id: 'frj', name: 'Finn Rune Jensen', shop: null, country: 'DEN', rep: 'uznany tuner, wzrost formy w 2026', power: 88, rel: 1.0, cons: 3, drive: 0, heat: 0, cap: 12, engCap: 22, ovhCap: 45, svcDay: 2, engine: 30000, service: 5500, minSkill: 8.5, form0: 1,
    docs: [['Jason Doyle'], ['Jan Kvěch']] },
  { id: 'fg', name: 'Flemming Graversen', shop: 'FGM', country: 'DEN', rep: 'tuner i producent silników (kryzys, odpływ klientów)', power: 88, rel: 0.95, cons: 3.5, drive: -1, heat: 0, cap: 12, engCap: 25, ovhCap: 45, svcDay: 2, engine: 30000, service: 5500, minSkill: 8.5, form0: -1.5, brand: 'FGM',
    docs: [['Leon Madsen']] },
  { id: 'bk', name: 'Brian Karger', shop: null, country: 'DEN', rep: 'uznany duński warsztat', power: 86, rel: 1.0, cons: 4, drive: -0.5, heat: 0, cap: 10, engCap: 18, ovhCap: 35, svcDay: 2, engine: 29000, service: 5000, minSkill: 8, form0: -0.5, docs: [] },
  { id: 'jr', name: 'Jacek Rempała', shop: null, country: 'POL', rep: 'uznany polski warsztat (Tarnów)', power: 85, rel: 1.05, cons: 3.5, drive: 0.5, heat: 0, cap: 15, engCap: 28, ovhCap: 60, svcDay: 2, engine: 27000, service: 4500, minSkill: 7, form0: 0,
    docs: [['Richard Lawson'], ['Jaimon Lidsey']] },
  { id: 'kj', name: 'Krzysztof Jabłoński', shop: null, country: 'POL', rep: 'tuner z Gniezna, powrót do elity w 2025', power: 85, rel: 1.0, cons: 4, drive: 0.5, heat: 0, cap: 10, engCap: 20, ovhCap: 40, svcDay: 2, engine: 27000, service: 4500, minSkill: 7, form0: 0.5,
    docs: [['Anders Thomsen']] },
  { id: 'bve', name: 'Bert van Essen', shop: 'BvE', country: 'NED', rep: 'mała grupa klientów, bez planów rozwoju', power: 86, rel: 1.0, cons: 3, drive: 0, heat: 0, cap: 5, engCap: 10, ovhCap: 20, svcDay: 1, engine: 30000, service: 5500, minSkill: 9, form0: 0,
    docs: [['Fredrik Lindgren']] },
  { id: 'wg', name: 'Witold Gromowski', shop: null, country: 'POL', rep: 'tuner z Bydgoszczy', power: 83, rel: 1.0, cons: 4, drive: 0.5, heat: 0, cap: 15, engCap: 25, ovhCap: 60, svcDay: 2, engine: 26000, service: 4200, minSkill: 6, form0: 0, docs: [] },
  { id: 'jk', name: 'Joachim Kugelmann', shop: null, country: 'GER', rep: 'niemiecki tuner', power: 83, rel: 1.0, cons: 4, drive: 0, heat: 0, cap: 8, engCap: 15, ovhCap: 30, svcDay: 1, engine: 27000, service: 4500, minSkill: 7, form0: 0, docs: [] },
  { id: 'vm', name: 'Vittorio Marzotto', shop: 'GM (silniki fabryczne)', country: 'ITA', rep: 'producent GM – silniki „prosto z fabryki”', power: 84, rel: 1.1, cons: 2.5, drive: 0, heat: 0, cap: 8, engCap: 40, ovhCap: 30, svcDay: 2, engine: 26000, service: 4000, minSkill: 8, form0: -1,
    docs: [['Matej Žagar']] },
  { id: 'ak', name: 'Andrzej Krawczyk', shop: 'warsztat w Ostrowie (prowadzi syn)', country: 'POL', rep: 'polski warsztat ligowy', power: 81, rel: 1.0, cons: 4.5, drive: 0.5, heat: 0, cap: 15, engCap: 25, ovhCap: 50, svcDay: 2, engine: 25000, service: 4000, minSkill: 6, form0: 0, docs: [] },
  { id: 'mk', name: 'Matthias Kröger', shop: null, country: 'GER', rep: 'niemiecki tuner', power: 80, rel: 1.0, cons: 4.5, drive: 0, heat: 0, cap: 8, engCap: 15, ovhCap: 30, svcDay: 1, engine: 25000, service: 4000, minSkill: 5, form0: 0, docs: [] },
  { id: 'mg', name: 'Marcel Gerhard', shop: null, country: null, rep: 'szwajcarski tuner, renoma historyczna', power: 82, rel: 1.0, cons: 4, drive: 0, heat: 0, cap: 6, engCap: 12, ovhCap: 20, svcDay: 1, engine: 27000, service: 4500, minSkill: 7, form0: -0.5, docs: [] },
  // warsztaty bez nazwiska: zaplecze ligowe, młodzież, zawodnicy z niskim budżetem
  { id: 'reg', name: 'Warsztat regionalny', generic: true, country: null, rep: 'tuner ligowy', power: 78, rel: 1.0, cons: 4.5, drive: 0.5, heat: 0, cap: 0, engine: 25000, service: 3800, minSkill: 0, docs: [] },
  { id: 'loc', name: 'Warsztat lokalny', generic: true, country: null, rep: 'serwis lokalny', power: 73, rel: 0.95, cons: 5, drive: 0.5, heat: 0, cap: 0, engine: 23000, service: 3000, minSkill: 0, docs: [] },
  { id: 'gm', name: 'GM seryjny (bez tuningu)', generic: true, country: null, rep: 'silnik fabryczny ze sklepu', power: 67, rel: 1.1, cons: 3, drive: 0, heat: 0, cap: 0, engine: 22000, service: 2500, minSkill: 0, docs: [] },
];
const TUNER = Object.fromEntries(TUNER_DB.map(t => [t.id, t]));
const EQ_MODEL = 3; // 3: nowe silniki vs remonty zimowe, remont kapitalny, przepustowość warsztatów, tylko GM/FGM
const MECH_COST = 90000, VAN_COST = 30000; // roczny koszt mechanika (czołówka: min. 120 tys. zł) i utrzymania busa
// Stare zapisy: fikcyjne nazwy tunerów → najbliższy warsztat
const LEGACY_TUNER = { 'Nordtun Racing': 'ash', 'Svea Motor': 'pj', 'Moto-Tech Leszno': 'mm', 'Silesia Engines': 'jr', 'Albion Engines': 'bk', 'Alpen Motorsport': 'mg', 'Wschód Tuning': 'reg', 'Czech Power': 'reg', 'Baltic Speed': 'loc', 'Garaż Rodzinny': 'gm', klubowy: 'loc' };

const tunerOf = id => TUNER[id] || TUNER[LEGACY_TUNER[id]] || TUNER.loc;
const shopOf = x => tunerOf(x.shop || x.tuner); // warsztat, który w tym sezonie serwisuje silnik
const tunerName = id => { const t = tunerOf(id); return t.shop ? `${t.name} (${t.shop})` : t.name; };
const tunerForm = id => (G.tuners && G.tuners[id] ? G.tuners[id].form : 0);
// przewaga technologiczna warsztatu (innowacje, nowe specyfikacje) – zmienia się powoli, z rzadkimi przełomami
const tunerLead = id => (G.tuners && G.tuners[id] && G.tuners[id].lead) || 0;
// postęp techniczny w ostatnim sezonie (punkty mocy, o które „starzeją się” wszystkie dotychczasowe silniki)
const lastGrowth = () => (G.eqTech && G.eqTech.length ? G.eqTech[G.eqTech.length - 1].growth : 1);
const engReady = (e, date = G.date) => !e.away || e.away <= date;
const engOwnerClub = e => (typeof e.club === 'number' ? e.club : null);

// ---------- Budżet zawodnika (ukryty – gracz i sztaby go nie widzą) ----------
function riderIncome(r) {
  const k = typeof activeDeal === 'function' ? activeDeal(r) : null;
  const lg = r.clubId && G.clubs[r.clubId] ? G.clubs[r.clubId].league : '2E';
  let inc = 0;
  if (k && k.kind === 'amatorski') inc = (k.stipend || 0) * 12;
  else if (k) inc = dealSeasonCost(k, r, lg);
  else if (r.active && !r.retired) inc = estimateContract(r.skill, riderAge(r), r.potential, '2E').signing * 0.4;
  const fl = r.fl && r.fl.season === G.season ? r.fl.list.length : 0;
  inc += fl * Math.max(20000, (r.skill - 5) * 30000); // ligi zagraniczne
  inc += Math.pow(Math.max(0, r.skill - 8), 2) * 8000; // sponsorzy osobiści
  return inc;
}
// Roczna kwota na sprzęt: udział w dochodach (profesjonalizm, wiek) + sprzęt z kontraktu amatorskiego (płaci klub)
function equipAnnual(r) {
  const prof = r.hidden ? r.hidden.professionalism : 10, age = riderAge(r);
  const share = clamp(0.3 + (prof - 10) * 0.012 + (age <= 24 ? 0.06 : age >= 34 ? -0.06 : 0), 0.2, 0.5);
  const k = typeof activeDeal === 'function' ? activeDeal(r) : null;
  const lg = r.clubId && G.clubs[r.clubId] ? G.clubs[r.clubId].league : null;
  return riderIncome(r) * share + (k && k.kind === 'amatorski' && lg ? EQUIP_VALUE[lg] : 0);
}
// Klub zalega z wypłatami (ujemne saldo dłużej niż 21 dni) – zawodnik dostaje tylko część pieniędzy z klubu
const clubArrears = r => !!(r.clubId && G.clubs[r.clubId] && G.clubs[r.clubId].cash < 0 && typeof licOverdueDays === 'function' && licOverdueDays(r.clubId) > 21);
// liczba silników: Zmarzlik (ok. 2 mln zł/rok na sprzęt) ma 12–18, czołówka (ok. 1 mln) ok. 12, zaplecze 3–5
const fleetTarget = r => clamp(Math.round(equipAnnual(r) / 100000) + 2, 2, 16);

// ---------- Tunerzy ----------
// Współpraca z tunerem jest zwykle wieloletnia: stali klienci mają pierwszeństwo przy zamówieniach i dostają
// lepsze egzemplarze, nowemu trudno się „wbić” do czołowego warsztatu, a zmiana tunera to ryzyko (nowe silniki
// są loterią, trzeba je rozjeździć). Moce przerobowe warsztatu (engCap) ograniczają liczbę silników na sezon.
function tunerClients() {
  const n = {};
  for (const r of Object.values(G.riders)) if (r.active && !r.retired && r.equip && r.equip.tuner) n[r.equip.tuner] = (n[r.equip.tuner] || 0) + 1;
  return n;
}
const tunerYears = r => Math.max(0, G.season - (r.equip.since ?? G.season));
// obecny tuner zatrzymuje klienta, o ile nie jest ponad limit (po napływie nowych zawodników)
const tunerFree = (t, clients, cur) => t.generic || (clients[t.id] || 0) < t.cap + (t.id === cur ? 1 : 0);
const tunerBuilt = id => (G.tuners && G.tuners[id] && G.tuners[id].built) || 0;
// stać zawodnika na tunera: roczna kwota na sprzęt wobec ceny silnika (juniorów wspiera klub, wystarcza mniej)
const affords = (r, t, annual = equipAnnual(r)) => annual >= t.engine * (isJunior(r) ? 1.2 : 2);
const tunerCanBuild = id => { const t = tunerOf(id); return t.generic || tunerBuilt(id) < t.engCap; };
// Wybór tunera: renoma zawodnika (poziom; obecny klient nie musi jej spełniać), wolne miejsca, stać go na silniki, lojalność wobec obecnego
function chooseTuner(r, clients, keepBias = 2) {
  const annual = equipAnnual(r), cur = r.equip && r.equip.tuner;
  const loyal = keepBias + Math.min(4, tunerYears(r) * 0.8);
  const opts = TUNER_DB.filter(t => t.id === 'gm' || (!(t.ban && t.ban.includes(r.name)) && (t.id === cur || t.minSkill <= r.skill) && tunerFree(t, clients, cur) && affords(r, t, annual)));
  let best = null, bs = -1e9;
  for (const t of opts) {
    const s = t.power + tunerForm(t.id) + (t.id === cur ? loyal : cur ? -1.5 : 0) + gauss(1.5); // −1,5: ryzyko zmiany
    if (s > bs) { bs = s; best = t; }
  }
  return best ? best.id : 'gm';
}
function newEngineFrom(r, tid, ownerClub = null) {
  const t = tunerOf(tid), e = r.equip;
  const id = Math.max(0, ...e.engines.map(x => x.id)) + 1;
  const spec = pick(['short', 'any', 'any', 'long']);
  // stały klient dostaje lepsze egzemplarze; nowy – loteria (pierwsza seria bywa trafiona albo chybiona)
  const main = t.id === e.tuner, years = main && e.since != null ? G.season - e.since : 0;
  const bonus = main ? (years >= 1 ? Math.min(2, years * 0.4) : gauss(2.5) - 1) : -0.5;
  const eng = { id, brand: t.brand && chance(0.6) ? t.brand : 'GM', tuner: t.id, q: clamp(round1(t.power + tunerForm(t.id) + tunerLead(t.id) + bonus + gauss(t.cons)), 40, 99),
    drive: round1(clamp(t.drive + gauss(1.2), -3, 3)), rel: round2(clamp(t.rel + gauss(0.05), 0.8, 1.2)), spec, cond: 100, heats: 0, svc: t.generic ? rint(20, 25) : rint(15, 20), life: 0, lifeMax: rint(90, 110),
    feel: 30, born: G && G.season ? G.season : 2025 };
  if (ownerClub) eng.club = ownerClub;
  if (!t.generic && G.tuners && G.tuners[t.id]) G.tuners[t.id].built = tunerBuilt(t.id) + 1;
  e.engines.push(eng);
  if (r.id != null && !r.kid && typeof engRegister === 'function') engRegister(eng, r);
  return eng;
}
// Dodatkowe pola silnika (stare zapisy, silniki z generatora)
function upgradeEngine(x, tid) {
  if (x.tuner == null || !TUNER[x.tuner]) x.tuner = TUNER[x.tuner] ? x.tuner : LEGACY_TUNER[x.tuner] || tid || 'loc';
  const t = tunerOf(x.tuner);
  if (x.drive == null) x.drive = round1(clamp(t.drive + gauss(1.2), -3, 3));
  if (x.rel == null) x.rel = round2(clamp(t.rel + gauss(0.05), 0.8, 1.2));
  if (!x.spec) x.spec = pick(['short', 'any', 'any', 'long']);
  if (x.svc == null) x.svc = t.generic ? rint(20, 25) : rint(15, 20);
  if (x.feel == null) x.feel = rint(55, 85);
  if (x.born == null) x.born = G.season - rint(0, 2);
  if (x.life == null) { x.life = rint(0, 80); x.lifeMax = rint(90, 110); }
  if (x.brand === 'Jawa') x.brand = 'GM'; // Jawa wycofana z klasycznego żużla
  if (x.club === true) x.club = null; // dawne „od klubu” bez numeru klubu – przypisanie w ensureEquipmentModel
}

// Sprzęt nowego zawodnika (bez kontroli limitów tunerów – te pilnuje zimowy przegląd)
function genEquipment(skill, age, r) {
  const n = skill >= 12 ? 6 : skill >= 10 ? 5 : skill >= 8 ? 4 : age != null && age < 18 ? 2 : 3;
  // nowy zawodnik zaczyna u warsztatu bez nazwiska; do renomowanych tunerów trafia przy zimowym przeglądzie (limity klientów)
  const main = skill >= 8 ? 'reg' : skill >= 5 ? pick(['reg', 'loc', 'gm']) : pick(['loc', 'gm']);
  const e = { engines: [], frames: Math.max(2, n - 1), mechanics: skill >= 12 ? 3 : skill >= 9 ? 2 : 1, van: skill >= 7, clubSupport: 0, tuner: main, since: G && G.season ? G.season : 2025, budget: 0 };
  const fake = { equip: e };
  for (let i = 0; i < n; i++) {
    const eng = newEngineFrom(fake, i < n - 1 || chance(0.5) ? main : 'reg');
    eng.cond = rint(62, 100); eng.heats = rint(0, 12); eng.feel = rint(50, 85); eng.born = (G && G.season ? G.season : 2025) - rint(0, 2);
  }
  return e;
}
// Silnik przeliczony na warsztat tunera (przypisanie na start gry)
function retuneEngine(x, tid) {
  const t = tunerOf(tid);
  x.tuner = tid;
  x.q = clamp(Math.round(x.q * 0.3 + (t.power + tunerForm(tid) + gauss(t.cons)) * 0.7), 40, 99);
  x.drive = round1(clamp(t.drive + gauss(1.2), -3, 3)); x.rel = round2(clamp(t.rel + gauss(0.05), 0.8, 1.2));
  x.svc = t.generic ? rint(20, 25) : rint(15, 20);
}

// Model sprzętu: tunerzy (forma sezonu), klienci z doniesień prasowych, pozostali według renomy i limitów, konwersja silników
function ensureEquipmentModel() {
  if (G.eqModel === EQ_MODEL) return false;
  if (G.eqModel === 2) { // zapis z modelu 2: tylko nowe pola (remonty, Jawa → GM), bez zmiany przypisań tunerów
    for (const r of Object.values(G.riders)) if (r.equip) for (const x of r.equip.engines) upgradeEngine(x, x.tuner);
    for (const c of Object.values(G.clubs)) if (c.park) for (const x of c.park.clubEngines || []) upgradeEngine(x, x.tuner);
    for (const t of TUNER_DB) if (G.tuners[t.id]) G.tuners[t.id].ovh = G.tuners[t.id].ovh || 0; else G.tuners[t.id] = { form: 0, season: G.season, built: 0, ovh: 0 };
    G.eqModel = EQ_MODEL;
    return true;
  }
  G.tuners = G.tuners || {};
  // Ash-Tech na start z przewagą technologiczną (tyrystory – regulacja zapłonu w trakcie zawodów)
  for (const t of TUNER_DB) G.tuners[t.id] = { form: t.generic ? 0 : round1((t.form0 || 0) + gauss(0.5)), season: G.season, built: 0, ovh: 0, lead: t.id === 'ash' ? 1 : 0 };
  G.eqSeason = G.season;
  const byName = new Map(Object.values(G.riders).map(r => [r.name, r]));
  const fixed = new Map(); // id zawodnika → [tuner główny, ...dodatkowi]
  for (const t of TUNER_DB) for (const [n, ...sec] of t.docs) if (byName.has(n)) fixed.set(byName.get(n).id, [t.id, ...sec]);
  const clients = {};
  for (const [, [tid]] of fixed) clients[tid] = (clients[tid] || 0) + 1;
  const rs = Object.values(G.riders).filter(r => r.equip).sort(by(r => r.skill, -1));
  for (const r of rs) {
    const e = r.equip, doc = fixed.get(r.id);
    e.clubSupport = e.clubSupport || 0;
    for (const x of e.engines) upgradeEngine(x, tunerOf(x.tuner).id);
    let tid;
    if (doc) tid = doc[0];
    else { tid = r.active && !r.retired ? chooseTuner(r, clients, 0) : 'loc'; clients[tid] = (clients[tid] || 0) + 1; }
    e.tuner = tid;
    // znani klienci pracują z tunerem od lat; pozostali – od 0 do 4 sezonów
    e.since = G.season - (doc ? rint(2, 6) : TUNER[tid].generic ? rint(0, 3) : rint(0, 4));
    // silniki: ok. 3/4 od głównego tunera, reszta od tunerów dodatkowych (jeśli są w doniesieniach)
    const sec = doc ? doc.slice(1) : [];
    e.engines.forEach((x, i) => {
      const want = sec.length && i % 3 === 2 ? sec[(i / 3 | 0) % sec.length] : tid;
      if (tunerOf(x.tuner).id !== want && (doc || chance(0.75))) retuneEngine(x, want);
      if (x.club === null && r.clubId) x.club = r.clubId;
      x.q = Math.max(40, round1(x.q - Math.max(0, raceSeason() - x.born) * 1.2)); // starsze roczniki: zmęczenie i zaległość technologiczna
    });
    if (e.budget == null) e.budget = Math.round(equipAnnual(r) * 0.35);
  }
  for (const c of Object.values(G.clubs)) if (c.park) { if (!c.park.clubEngines) c.park.clubEngines = []; if (c.park.baseMech == null) c.park.baseMech = c.park.mechanics; }
  G.eqModel = EQ_MODEL;
  return true;
}

// ---------- Mechanicy klubowi ----------
// Kierownik parku maszyn i mechanicy: najlepsza „technika” w roli mechanika + liczba mechaników klubu
let MECH_Q = { date: null, map: new Map() }; // pamięć podręczna na dzień gry
function clubMechQ(clubId) {
  if (!clubId || !G.clubs[clubId]) return 6;
  if (MECH_Q.date !== G.date || MECH_Q.n !== G.seq.staff) MECH_Q = { date: G.date, n: G.seq.staff, map: new Map() };
  if (MECH_Q.map.has(clubId)) return MECH_Q.map.get(clubId);
  const m = clubStaff(clubId).filter(s => s.role === 'mechanic');
  const best = m.length ? Math.max(...m.map(s => s.attrs.tech || 8)) : 6;
  const n = (G.clubs[clubId].park || {}).mechanics || 1;
  const q = clamp(best + (n - 2) * 0.5 + ((G.clubs[clubId].facilities || {}).workshop - 3) * 0.5, 3, 20);
  MECH_Q.map.set(clubId, q);
  return q;
}
// Czy zawodnik korzysta z mechaników klubu: juniorzy, zawodnicy z małym zespołem, każdy na torze domowym
const usesClubMech = r => isJunior(r) || (r.equip.mechanics || 1) <= 1;

// ---------- Wartość silnika w biegu ----------
const trackKind = len => (len && len <= 330 ? 'short' : len && len >= 370 ? 'long' : 'mid');
function engineValue(eng, r, o = {}) {
  let v = eng.q * (0.55 + 0.45 * eng.cond / 100);
  const k = trackKind(o.track);
  if (eng.spec !== 'any' && k !== 'mid') v += eng.spec === k ? 1.5 : -1.2;
  // moment na przyczepnym/mokrym, prędkość na twardym: przyczepność toru z modelu nawierzchni (js/track.js) albo dawny opis toru
  const surf = o.surface || 'przyczepny';
  const f = o.grip != null ? surfDrive(o.grip, o.wet) : surf === 'twardy, szybki' ? -1 : surf === 'mokry' ? 1.2 : 0.4;
  v += f * (eng.drive || 0) * 0.5;
  v += ((eng.feel ?? 70) - 60) / 15;
  // po ok. 15 biegach od serwisu silnik zaczyna tracić, po 25 wyraźnie słabnie (pierścienie, łożysko korbowodu, sprężyny zaworowe)
  const hs = eng.heats || 0;
  v -= Math.min(6, Math.max(0, hs - 15) * 0.08 + Math.max(0, hs - 25) * 0.25);
  const th = tunerOf(eng.tuner).heat || 0; // charakter warsztatu w upale/chłodzie (np. Ash-Tech: słabiej w upale, lepiej w chłodzie)
  if (th && o.temp != null) v += o.temp > 25 ? th * Math.min(1, (o.temp - 25) / 6) : o.temp < 15 ? -th * 0.5 : 0;
  const home = o.homeClubId && r.clubId === o.homeClubId;
  if (r.clubId && (home || usesClubMech(r))) v += (clubMechQ(r.clubId) - 10) * (home ? 0.25 : 0.15); // ustawienia od mechaników klubu
  return v;
}
// Silnik do biegu: wybór zawodnika (ocena z błędem zależnym od Dopasowania sprzętu) albo wybór gracza (m.engPick)
const EQ_MEET = new Map(); // mid → Set('rid:engId') silników wyłączonych w tych zawodach
const meetKey = mid => String(mid).replace(/:ro\d+$/, ''); // bieg dodatkowy (js/ties.js) – te same motocykle co w zawodach
function meetOut(mid) {
  mid = meetKey(mid);
  if (!EQ_MEET.has(mid)) { EQ_MEET.set(mid, new Set()); if (EQ_MEET.size > 600) EQ_MEET.delete(EQ_MEET.keys().next().value); }
  return EQ_MEET.get(mid);
}
function usableEngines(r, mid) {
  const out = mid ? meetOut(mid) : null;
  return r.equip.engines.filter(e => engReady(e) && !(out && out.has(`${r.id}:${e.id}`)));
}
function pickEngine(r, o = {}) {
  const list = usableEngines(r, o.mid);
  if (!o.mid) return pickEngine0(r, o, list);
  // zawody: motocykle A/B przygotowane z dwóch najlepszych silników pod tor; po wyłączeniu – zapasowy (C, w zawodach FIM też D)
  const bikes = meetBikes(o.mid, r.id), out = meetOut(o.mid);
  const usable = b => !b.out && list.some(e => e.id === b.eng) && !out.has(`${r.id}:${b.eng}`);
  const ready = () => bikes.filter(usable);
  const frames = framesOK(r);
  const addBike = () => {
    if (bikes.length >= maxBikes(o.mid) || bikes.filter(b => !b.out).length >= frames) return null;
    const used = new Set(bikes.map(b => b.eng)), cand = list.filter(e => !used.has(e.id)).sort(by(e => engineValue(e, r, o), -1))[0];
    if (!cand) return null;
    const b = { l: BIKE_L[bikes.length], eng: cand.id, frame: bikes.length + 1, out: false };
    bikes.push(b); return b;
  };
  if (!bikes.length) { addBike(); if (frames >= 2) addBike(); } // przed zawodami: A i B w boksie
  if (!ready().length) addBike(); // A i B wyłączone – zapasowy z zamkniętego parku / strefy maszyn zapasowych
  const act = ready();
  const chosen = act.length ? pickEngine0(r, o, act.map(b => bikeEngine(r, b))) : borrowedEngine(r, o);
  return chosen;
}
function pickEngine0(r, o, list) {
  if (o.pick != null) { const p = list.find(e => e.id === o.pick); if (p) return p; }
  if (!list.length) return borrowedEngine(r, o);
  // błąd oceny: Dopasowanie sprzętu i wiedza drużyny o torze (próba toru; 0,5 – bez wpływu)
  const setup = r.attrs.setup ?? 10, noise = (21 - setup) / 9 * (1.25 - 0.5 * (o.know ?? 0.5));
  let best = null, bv = -1e9;
  for (const e of list) { const v = engineValue(e, r, o) + gauss(noise); if (v > bv) { bv = v; best = e; } }
  return best;
}
// Brak sprawnego silnika: motocykl z parku maszyn klubu albo pożyczony od kolegi
function borrowedEngine(r, o) {
  const c = r.clubId && G.clubs[r.clubId], fleet = c && c.park ? c.park.clubEngines.filter(e => engReady(e)) : [];
  if (fleet.length) return Object.assign(fleet.slice().sort(by(e => e.q * e.cond, -1))[0], { lent: true });
  return { id: 0, brand: 'GM', tuner: 'loc', q: 68, drive: 0, rel: 1, spec: 'any', cond: 85, heats: 0, svc: 99, feel: 20, temp: true };
}
const engLabel = e => e ? `${e.temp ? 'pożyczony ' : ''}${e.brand}${e.id ? ` nr ${e.id}` : ''}${e.lent ? ' (park maszyn klubu)' : ''}` : '';

// Szansa defektu: stan, niezawodność egzemplarza, przegląd po terminie, Dopasowanie sprzętu, mechanicy
function defectChance(eng, r) {
  if (!eng) return 0.05;
  const setup = r.attrs.setup || 10, mech = r.equip.mechanics || 1;
  return (0.0045 + (100 - eng.cond) / 100 * 0.05 * (1.15 - setup / 70)) / (eng.rel || 1) * Math.min(2.2, 1 + Math.max(0, (eng.heats || 0) - 25) * 0.03) * (1.08 - mech * 0.03);
}
// Skutki biegu dla sprzętu: zużycie, defekt (naprawa w parku maszyn lub wyłączenie), uszkodzenie po upadku
function heatEquipment(e, r, ctx, log) {
  const eng = e.eng;
  if (!eng || eng.temp) return;
  if (!r.kid) { if (!eng.sn) engRegister(eng, r, false); engUse(eng, r); }
  // jazda z przodu = mniej pyłu w silniku, płynny gaz = łagodniejsza eksploatacja (J. Krawczyk, Przegląd Sportowy)
  const gentle = (e.startPos === 1 ? 0.75 : 1) * clamp(1.15 - (r.attrs.throttle || 10) / 70, 0.85, 1.1);
  eng.cond = clamp(eng.cond - rint(1, 3) * (eng.heats > 25 ? 1.4 : 1) * gentle - (e.status === 'd' ? rint(6, 14) : 0), 5, 100);
  eng.heats++; eng.life = (eng.life || 0) + 1;
  eng.feel = clamp((eng.feel ?? 60) + (100 - (eng.feel ?? 60)) * 0.04 * (0.7 + (r.attrs.setup || 10) / 40), 0, 100);
  if (!ctx.mid) return;
  const out = { add: k => { meetOut(ctx.mid).add(k); bikeOut(ctx.mid, r.id, eng.id); } }, key = `${r.id}:${eng.id}`; // wyłączony silnik = wyłączony motocykl
  const home = r.clubId && r.clubId === ctx.homeClubId;
  const clubHelp = r.clubId && (home || usesClubMech(r)) ? clubMechQ(r.clubId) / 100 : 0;
  const name = r.name;
  if (e.status === 'd') {
    if (chance(0.12 * (1.25 - (eng.rel || 1)) / 0.25)) { breakEngine(r, eng, rint(7, 21), ctx); out.add(key); log.push(`<span class="neg">Silnik ${engLabel(eng)} (${name}) poważnie uszkodzony – wraca do tunera.</span>`); }
    else if (!chance(0.35 + (r.equip.mechanics || 1) * 0.1 + clubHelp)) { out.add(key); log.push(`Mechanicy ${name} nie zdążą naprawić motocykla – zmiana maszyny.`); }
  } else if ((e.status === 'u' || e.status === 'w') && chance(0.35)) {
    eng.cond = clamp(eng.cond - rint(3, 10), 5, 100);
    if (chance(0.3)) { damageFrame(r); bikeOut(ctx.mid, r.id, eng.id); log.push(`Rama motocykla ${bikeLetter(ctx.mid, r.id, eng) || ''} ${name} uszkodzona w upadku – motocykl wycofany.`.replace('  ', ' ')); }
    if (chance(0.05)) { breakEngine(r, eng, rint(5, 14), ctx); out.add(key); log.push(`<span class="neg">Po upadku ${name} silnik ${engLabel(eng)} do remontu.</span>`); }
    else if (chance(0.4 - clubHelp)) { out.add(key); log.push(`Motocykl ${name} uszkodzony w upadku – na kolejne biegi inna maszyna.`); }
  }
}
// Poważna awaria: silnik u tunera kilka tygodni, remont płaci właściciel (zawodnik z budżetu albo klub)
function breakEngine(r, eng, days, ctx) {
  const t = tunerOf(eng.tuner), cost = Math.round(t.service * 2 * (0.8 + rnd() * 0.6) / 100) * 100;
  eng.away = addDays(G.date, days); eng.job = 'repair'; eng.cond = 100; eng.heats = 0;
  eng.q = Math.max(40, round1(eng.q - rnd() * 2)); eng.life = (eng.life || 0) + rint(5, 15); // rozbity silnik nie wraca do pełni
  engLog(eng, 'R', shopOf(eng).id);
  payEquip(r, eng, cost, `Remont silnika ${eng.brand} nr ${eng.id} (${t.name}): ${r.name}`);
  if (r.clubId === G.clubId && r.equip.engines.filter(x => engReady(x)).length <= 1)
    addMsg({ category: 'drużyna', from: 'Kierownik parku maszyn', title: `${r.name}: brak zapasowego silnika`, body: `<p>Po awarii ${esc(r.name)} ma sprawny najwyżej jeden silnik – kolejny wraca od tunera ${fmtDay(eng.away)}.</p>`, link: `#/park/zawodnik/${r.id}` });
}
function payEquip(r, eng, amount, desc) {
  const cid = engOwnerClub(eng);
  if (cid && G.clubs[cid]) { addTx(cid, 'sprzęt', -amount, desc); r.equip.clubSupport += amount; }
  else r.equip.budget = (r.equip.budget || 0) - amount;
}

// ---------- Serwis, ramy, treningi ----------
// Kiedy zawodnik oddaje silnik do serwisu (Przegląd Sportowy, tuner J. Krawczyk): w PGE Ekstralidze mało kto jeździ dłużej niż
// 15 biegów, w II lidze średnio 40 – słabszych nie stać na częsty serwis (do 7 tys. zł), choć silnik po 25 biegach wyraźnie słabnie.
function svcLimit(r) { const a = equipAnnual(r); return a >= 600000 ? 15 : a >= 300000 ? 20 : a >= 150000 ? 28 : 40; }
// Ramy: upadek może uszkodzić podwozie – naprawa 3–8 tys. zł (kilka dni) albo nowa rama ok. 20 tys. zł (data/equipment)
const framesOK = r => Math.max(1, (r.equip.frames || 2) - ((r.equip.frameRep || []).filter(u => u > G.date).length));
function damageFrame(r) {
  const e = r.equip, nowa = chance(0.3), cost = nowa ? 20000 : rint(3, 8) * 1000;
  (e.frameRep = e.frameRep || []).push(addDays(G.date, nowa ? rint(7, 14) : rint(2, 6)));
  e.budget = (e.budget || 0) - cost;
  if (r.clubId === G.clubId && framesOK(r) <= 1) addMsg({ category: 'drużyna', from: 'Kierownik parku maszyn', title: `${r.name}: uszkodzona rama`, body: `<p>Po upadku ${esc(r.name)} ${nowa ? 'potrzebuje nowej ramy' : 'oddał ramę do naprawy'}. Do powrotu ramy ma tylko jeden sprawny motocykl.</p>`, link: `#/park/zawodnik/${r.id}` });
}
// Motocykle zawodnika w zawodach – jak w transmisjach TV: A i B w boksie, C zapasowy (art. 10 ust. 2 RZMoT: w boksie najwyżej dwa,
// trzeci w zamkniętym parku pod nadzorem komisarza technicznego); w zawodach FIM (SGP, IME…) dwa w parku maszyn i zapasowe w strefie
// maszyn zapasowych (regulamin FIM SGP) – tu najwyżej D. Każdy motocykl to konkretna rama i silnik (zużycie, defekty, upadki)
const BIKE_L = ['A', 'B', 'C', 'D'];
const EQ_BIKES = new Map(); // mid → Map(id zawodnika → [{ l, eng (id silnika), frame, out }])
function maxBikes(mid) {
  mid = meetKey(mid);
  const ev = typeof mid === 'string' && mid[0] === 'X' && G.events[mid.slice(1)];
  return ev && typeof isIntl === 'function' && isIntl(ev) ? 4 : 3;
}
function meetBikes(mid, rid) {
  mid = meetKey(mid); rid = String(rid); // w biegach finałowych identyfikatory przychodzą jako tekst (rankingi), w programie – jako liczby
  if (!EQ_BIKES.has(mid)) {
    EQ_BIKES.set(mid, new Map()); if (EQ_BIKES.size > 600) EQ_BIKES.delete(EQ_BIKES.keys().next().value);
    // mecz wznowiony po wczytaniu gry: motocykle odtworzone z zapisanych biegów
    const m = G.matches[mid], mp = EQ_BIKES.get(mid);
    if (m && m.heats) for (const h of m.heats) for (const e of h.entries || []) if (e.riderId != null && e.bike && e.engId != null) {
      const k = String(e.riderId), l = mp.get(k) || (mp.set(k, []), mp.get(k));
      if (!l.some(b => b.l === e.bike)) l.push({ l: e.bike, eng: e.engId, frame: BIKE_L.indexOf(e.bike) + 1, out: false });
    }
  }
  const m = EQ_BIKES.get(mid);
  if (!m.has(rid)) m.set(rid, []);
  return m.get(rid);
}
// Litera motocykla, na którym jedzie dany silnik (relacja z biegu)
function bikeLetter(mid, rid, eng) { if (!mid || !eng || eng.temp) return eng && eng.temp ? 'P' : ''; const b = meetBikes(mid, rid).find(x => x.eng === eng.id); return b ? b.l : ''; }
// Wyłączenie motocykla (poważny defekt, upadek, uszkodzona rama) – na kolejne biegi zapasowy
function bikeOut(mid, rid, engId) { const b = meetBikes(mid, rid).find(x => x.eng === engId); if (b) b.out = true; }
function bikeEngine(r, b) { return r.equip.engines.find(e => e.id === b.eng); }
// Treningi na torze (1.03–10.04 kilka razy w tygodniu, w sezonie ok. raz w tygodniu, gdy pogoda pozwala i nie ma startu).
// Dzień treningu = ok. 5 biegów (jak mecz) rozłożonych na 2–3 silniki: docieranie nowych i jazda na starszych.
let TRACK_DAY = { date: null, ok: false };
function trackTraining(r) {
  if (!r.active || r.retired || r.injury || !r.clubId || r.kid) return;
  const md = G.date.slice(5), pre = md >= '03-01' && md <= '04-10', season = md >= '04-11' && md <= '10-15';
  if (!pre && !season) return;
  if (TRACK_DAY.date !== G.date) TRACK_DAY = { date: G.date, ok: typeof trackUsable === 'function' ? trackUsable(G.date) : true };
  if (!TRACK_DAY.ok || !chance(pre ? 0.55 : 0.15)) return;
  const yday = addDays(G.date, -1);
  if ((r.slog || []).some(s => s.d === G.date || s.d === yday)) return; // dzień zawodów albo dzień po
  if (typeof onCamp === 'function' && onCamp(r)) return; // na obozie trening liczy js/camps.js
  if (typeof planManual === 'function' && planManual(r.clubId)) return; // własny plan treningu: tor tylko w zaplanowanych jednostkach (js/planner.js)
  trackSession(r);
}
// Jedna sesja treningowa na torze (ok. 5 wyjazdów): zużycie i docieranie silników, ryzyko upadku – trening w klubie i na obozie (js/camps.js)
function trackSession(r) {
  const list = r.equip.engines.filter(x => engReady(x));
  if (!list.length) return;
  const runIn = list.filter(x => (x.feel ?? 60) < 70).sort(by(x => x.feel ?? 60));
  const old = list.filter(x => !runIn.includes(x)).sort(by(x => x.q));
  const pickList = [...runIn.slice(0, 2), ...old].slice(0, rint(2, 3));
  for (let i = 0; i < 5; i++) {
    const x = pickList[i % pickList.length];
    x.cond = clamp(x.cond - rint(1, 2), 5, 100); x.heats++; x.life = (x.life || 0) + 1;
    x.feel = clamp((x.feel ?? 60) + (100 - (x.feel ?? 60)) * 0.06 * (0.7 + (r.attrs.setup || 10) / 40), 0, 100);
    if (typeof engTrain === 'function') engTrain(x, r);
    if (chance(0.003)) { trainingCrash(r, x); break; } // upadki na treningu rzadsze niż w zawodach
  }
}
function trainingCrash(r, x) {
  x.cond = clamp(x.cond - rint(3, 10), 5, 100);
  if (chance(0.3)) damageFrame(r);
  if (chance(0.05)) breakEngine(r, x, rint(5, 14));
  if (chance(0.1) && typeof injureRider === 'function') injureRider(r, G.date, 'trening na torze');
}

// ---------- Dzień i miesiąc ----------
// ---------- Warsztat: przeglądy, remonty, dostawy ----------
// Kalibracja (data/equipment/TUNERZY-2025-26.md): przegląd co ok. 3 mecze / 15–20 biegów (5–8 tys. zł u czołowych),
// remont kapitalny po ok. 100 biegach (ok. 15 tys. zł), zimą remont silników z poprzedniego sezonu, nowe silniki
// zamawiane do początku grudnia i odbierane w marcu (RK: zamówienia do 4.12, gotowe do 20.03). Ash-Tech: 4 osoby,
// 2–3 przeglądy dziennie – przy większym ruchu silnik dłużej czeka w kolejce.
const JOB_LABEL = { svc: 'przegląd', cap: 'remont kapitalny', ovh: 'remont zimowy', new: 'nowy – w budowie', repair: 'naprawa po awarii' };
const raceSeason = () => Number(G.date.slice(0, 4)) + (Number(G.date.slice(5, 7)) >= 11 ? 1 : 0); // sezon, na który pracuje warsztat
// Termin odbioru z warsztatu: czas pracy + kolejka (dzienna przepustowość tunera)
function shopDays(t, base) {
  if (t.generic || !G.tuners[t.id]) return base;
  const q = G.tuners[t.id];
  if (q.day !== G.date) { q.day = G.date; q.n = 0; }
  q.n++;
  return base + Math.floor((q.n - 1) / (t.svcDay || 2));
}
function sendToShop(r, x, job) {
  const t = shopOf(x), cap = job !== 'new' && (x.life || 0) >= (x.lifeMax || 100);
  const kind = cap ? 'cap' : job;
  if (kind === 'cap' || kind === 'ovh') engLog(x, kind === 'cap' ? 'K' : 'O', t.id);
  const cost = Math.round(t.service * (kind === 'cap' ? 2.3 : 1));
  payEquip(r, x, cost, `${JOB_LABEL[kind][0].toUpperCase() + JOB_LABEL[kind].slice(1)} silnika ${x.brand} nr ${x.id} (${t.name}): ${r.name}`);
  x.job = kind;
  x.away = addDays(G.date, shopDays(t, kind === 'cap' ? rint(10, 14) : kind === 'ovh' ? rint(14, 30) : t.generic ? 3 : 4));
  if (kind === 'cap') { x.life = 0; x.lifeMax = rint(90, 110); }
  return cost;
}
function equipmentDay(r) {
  const e = r.equip;
  if (!e || !e.engines.length) return;
  trackTraining(r);
  const d = G.date, lim = svcLimit(r);
  if (e.frameRep && e.frameRep.length) e.frameRep = e.frameRep.filter(u => u > d); // ramy wracają z naprawy
  for (const x of e.engines) {
    if (x.away && x.away <= d) { x.away = null; x.cond = 100; x.heats = 0; if (x.job === 'cap') x.q = Math.min(99, x.q + 1); x.job = null; }
    if (x.away) continue;
    // przegląd u tunera po przekroczeniu interwału – jeśli zawodnika (albo klub) na to stać
    if (x.heats >= (engOwnerClub(x) ? 20 : lim)) {
      const t = shopOf(x), cid = engOwnerClub(x);
      const price = t.service * ((x.life || 0) >= (x.lifeMax || 100) ? 2.3 : 1);
      if (cid || (e.budget || 0) >= price) sendToShop(r, x, 'svc');
      else if (r.clubId === G.clubId && x.heats === lim && e.postponed !== d.slice(0, 7)) {
        e.postponed = d.slice(0, 7);
        addMsg({ category: 'drużyna', from: 'Kierownik parku maszyn', title: `${r.name} odkłada przegląd silników`, body: `<p>${esc(r.name)} jeździ na silnikach po terminie przeglądu – ${clubArrears(r) ? 'klub zalega mu z wypłatami' : 'brakuje mu pieniędzy na tunera'}. Rośnie ryzyko defektów.</p>${clubArrears(r) ? '<p>Uregulowanie zaległości pozwoli mu wrócić do normalnego serwisu.</p>' : '<p>Klub może opłacić przegląd w zakładce Sprzęt zawodnika.</p>'}`, link: `#/park/zawodnik/${r.id}` });
      }
    }
    // bieżąca obsługa przez mechaników zawodnika (i klubu): drobne naprawy, bez zastępowania przeglądu u tunera
    if (x.cond < 90) {
      const ws = r.clubId && usesClubMech(r) ? clubMechQ(r.clubId) * 0.05 : 0;
      x.cond = clamp(x.cond + (e.mechanics || 1) * 0.6 + ws, 0, 90);
    }
  }
}
const tunerOvh = id => (G.tuners && G.tuners[id] && G.tuners[id].ovh) || 0;
// Warsztat na zimowy remont: własny tuner silnika, jeśli ma moce i zawodnika na niego stać; inaczej najlepszy dostępny
// (wolne remonty, bez odmowy, w zasięgu budżetu); w ostateczności najtańszy serwis – silnik nie może zostać bez remontu
function ovhShop(r, x) {
  const own = tunerOf(x.tuner), budget = ovhBudget(r, x);
  if (ovhOpen(r, own) && budget >= own.service) return own;
  // najpierw tunerzy z nazwiskiem z wolnymi mocami, dopiero potem warsztat regionalny/lokalny
  const alt = TUNER_DB.filter(t => t.id !== own.id && ovhOpen(r, t) && budget >= t.service && (t.generic || t.minSkill <= r.skill + 2))
    .sort(by(t => (t.generic ? 0 : 100) + t.power + tunerForm(t.id), -1));
  return alt[0] || TUNER.loc;
}
// Nowy sezon sprzętowy (listopad): forma warsztatów, moce przerobowe, postęp techniczny.
// Każdego roku tunerzy i GM wprowadzają nowe rozwiązania (zapłon, gaźniki, głowice, wydech) – nowe silniki są o ok. 1 pkt
// mocy lepsze, więc każdy dotychczasowy silnik względnie traci (skala mocy pozostaje stała). Warsztaty, które wprowadzają
// innowacje (przełom ok. raz na kilkanaście lat na warsztat, np. tyrystory Ash-Tech), zyskują trwałą przewagę.
function newEquipSeason() {
  G.eqSeason = G.season;
  marketSeason(); // niesprzedane silniki: eksport albo złom
  const growth = round1(clamp(1 + gauss(0.3), 0.4, 1.8));
  (G.eqTech = G.eqTech || []).push({ season: raceSeason(), growth });
  for (const t of TUNER_DB) {
    if (t.generic) continue;
    const o = G.tuners[t.id] || {};
    let lead = clamp((o.lead || 0) * 0.8 + gauss(0.4), -3, 4), news = null;
    if (chance(0.07)) { lead = Math.min(4, lead + 1.5); news = t; }
    G.tuners[t.id] = { form: round1(clamp((o.form || 0) * 0.5 + gauss(1.5), -4, 4)), season: G.season, built: 0, ovh: 0, lead: round1(lead) };
    if (news) addMsg({ category: 'inne', from: 'Prasa żużlowa', title: `Nowa specyfikacja silników: ${t.name}`, body: `<p>W środowisku głośno o rozwiązaniu, które ${esc(tunerName(t.id))} wprowadza w silnikach na sezon ${raceSeason()}. Jego klienci mogą zyskać przewagę – o ile dostaną nowe silniki.</p>`, link: '#/park/tunerzy' });
  }
  for (const r of Object.values(G.riders)) if (r.equip) for (const x of r.equip.engines) x.q = Math.max(40, round1(x.q - growth));
  for (const c of Object.values(G.clubs)) if (c.park) for (const x of c.park.clubEngines || []) x.q = Math.max(40, round1(x.q - growth));
}
function equipmentMonthly() {
  const m = Number(G.date.slice(5, 7)), rs = raceSeason();
  // listopad: forma warsztatów na nowy sezon (kontynuacja + losowość: „trafiona” albo „zgubiona” specyfikacja), nowe moce przerobowe
  if (m === 11 && (G.eqSeason ?? G.tuners.rk.season) !== G.season) newEquipSeason();
  // dodatkowi mechanicy zatrudnieni przez gracza ponad obsadę z budżetu parku maszyn
  const me = G.clubs[G.clubId];
  if (me && me.park && me.park.mechanics > (me.park.baseMech ?? me.park.mechanics)) addTx(me.id, 'sprzęt', -Math.round((me.park.mechanics - me.park.baseMech) * MECH_COST / 12), `Dodatkowi mechanicy klubowi (${me.park.mechanics - me.park.baseMech})`);
  const clients = tunerClients();
  // stali klienci pierwsi w kolejce do warsztatu (lata współpracy), potem renoma zawodnika
  const order = Object.values(G.riders).filter(r => r.equip && r.active && !r.retired).sort(by(r => tunerYears(r) * 20 + r.skill, -1));
  for (const r of order) {
    const e = r.equip;
    // budżet: miesięczna część rocznej kwoty, koszty zespołu; zaległości klubu tną wpływy z kontraktu
    let ann = equipAnnual(r);
    if (clubArrears(r)) ann *= 0.35;
    e.budget = Math.round((e.budget || 0) + ann / 12 - ((e.mechanics || 1) - 1) * MECH_COST / 12 - (e.van ? VAN_COST / 12 : 0));
    e.budget = Math.min(e.budget, Math.round(Math.max(ann, 30000))); // nadwyżka ponad roczną kwotę zostaje prywatnie u zawodnika
    // silniki klubowe wracają do parku maszyn klubu po odejściu zawodnika
    for (const x of e.engines.filter(x => engOwnerClub(x) && engOwnerClub(x) !== r.clubId)) {
      const c = G.clubs[engOwnerClub(x)];
      if (c && c.park) { x.away = null; x.job = null; c.park.clubEngines.push(x); engLog(x, 'T', ownerRef(c)); }
      e.engines.splice(e.engines.indexOf(x), 1);
    }
    for (const x of e.engines) if (!x.sn) engRegister(x, r, false);
    if (m === 11) winterReview(r, clients);
    if (m >= 11 || m <= 3) aiBuyUsed(r); // rynek wtórny: kto nie kupi nowego, szuka używanego
    // nowe silniki: zamówienia XI–I z odbiorem w marcu, II–III z krótszym terminem; w sezonie – pogoń za prędkością przy słabej formie
    const t = tunerOf(e.tuner);
    const winter = m >= 11 || m <= 3, maxNew = clamp(1 + Math.floor(ann / 400000), 1, 6);
    if (m === 11) e.newFor = { season: rs, n: 0 };
    for (let k = 0, perMonth = winter ? Math.ceil(maxNew / 3) : 1; k < perMonth; k++) {
    const ordered = e.newFor && e.newFor.season === rs ? e.newFor.n : 0, own = e.engines.filter(x => !engOwnerClub(x));
    const want = winter ? ordered < maxNew && (own.length < fleetTarget(r) || own.some(x => x.q < t.power - 6)) && own.length < 16 && e.budget >= t.engine * 1.2
      : r.form < -0.7 && e.budget >= t.engine * 2 && chance(0.3);
    if (want && !tunerCanBuild(e.tuner)) {
      if (r.clubId === G.clubId && e.queued !== rs) { e.queued = rs; addMsg({ category: 'drużyna', from: 'Kierownik parku maszyn', title: `${r.name} czeka na silnik`, body: `<p>Warsztat ${esc(tunerName(t.id))} ma wyczerpane moce przerobowe na ten sezon – pierwszeństwo mają jego wieloletni klienci. ${esc(r.name)} jeździ na dotychczasowym sprzęcie.</p>`, link: `#/park/zawodnik/${r.id}` }); }
    } else if (want) {
      const eng = newEngineFrom(r, e.tuner);
      e.budget -= t.engine; // zaliczka przy zamówieniu
      e.newFor = { season: rs, n: ordered + 1 };
      eng.job = 'new';
      eng.away = m >= 11 || m === 1 ? `${rs}-03-${String(rint(5, 25)).padStart(2, '0')}` : addDays(G.date, rint(21, 35));
      if (r.clubId === G.clubId && k === 0) addMsg({ category: 'drużyna', from: 'Kierownik parku maszyn', title: `${r.name} zamówił silnik u: ${t.name}`, body: `<p>${esc(r.name)} zamówił nowy silnik (${esc(tunerName(t.id))}), odbiór ${fmtDateShort(eng.away)}.${winter ? ' Przed sezonem będzie go rozjeżdżał na treningach.' : ' Szuka prędkości po słabszych występach.'}</p>`, link: `#/park/zawodnik/${r.id}` });
    }
    if (!want || !tunerCanBuild(e.tuner)) break;
    }
  }
  if (m >= 11 || m <= 2) winterOverhauls(order, rs);
  if (typeof academyBikesMonthly === 'function') academyBikesMonthly(m); // motocykle szkółki (js/engine-registry.js)
}
// Zimowe remonty (XI–II) – każdy silnik z minionego sezonu musi przejść remont.
// Etap 1: każdy warsztat najpierw przyjmuje silniki własnych klientów (wg stażu współpracy).
// Etap 2: silniki, dla których zabrakło miejsca (albo pieniędzy), przejmują inni tunerzy z wolnymi mocami –
// najpierw silniki najlepszych zawodników, do najlepszego dostępnego warsztatu.
// Silniki z warsztatów bez nazwiska (GM seryjne, lokalne) remontują warsztaty bez nazwiska – nie zajmują miejsc u tunerów.
function winterOverhauls(order, rs) {
  const need = r => r.equip.engines.filter(x => !x.away && x.ovhFor !== rs && (x.heats > 0 || x.cond < 100) && x.born < rs);
  const left = [];
  for (const r of order) for (const x of need(r)) {
    const own = tunerOf(x.tuner);
    if (own.generic || own.id === 'gm') { x.shop = own.id === 'gm' ? 'reg' : null; doOverhaul(r, x, x.shop ? TUNER.reg : own); continue; }
    if (ovhOpen(r, own) && ovhBudget(r, x) >= own.service) { x.shop = null; doOverhaul(r, x, own); }
    else left.push([r, x]);
  }
  left.sort(by(([r]) => r.skill, -1));
  for (const [r, x] of left) {
    const own = tunerOf(x.tuner), shop = ovhShop(r, x), was = x.shop;
    x.shop = shop.id;
    if (was !== shop.id) x.q = clamp(Math.round(x.q + Math.min(0, shop.power - own.power) * 0.15 - 0.5 + gauss(1)), 40, 99); // obcy warsztat zna silnik słabiej
    if (r.clubId === G.clubId && r.equip.ovhMsg !== rs) { r.equip.ovhMsg = rs; addMsg({ category: 'drużyna', from: 'Kierownik parku maszyn', title: `${r.name}: remont silnika u innego tunera`, body: `<p>${esc(tunerName(own.id))} ${tunerOvh(own.id) >= own.ovhCap ? 'nie ma wolnych mocy przerobowych na zimowe remonty' : 'jest poza zasięgiem budżetu zawodnika'} – ${esc(r.name)} oddał silnik ${x.brand} nr ${x.id} do: <b>${esc(tunerName(shop.id))}</b>. Obcy warsztat zna ten silnik słabiej, więc przygotowanie bywa mniej trafione. Na kolejną zimę silnik wraca najpierw do swojego tunera.</p>`, link: `#/park/zawodnik/${r.id}` }); }
    doOverhaul(r, x, shop);
  }
}
function doOverhaul(r, x, shop) {
  // zmęczenie materiału rośnie z wiekiem silnika: remont przywraca stan, ale nie fabryczną moc;
  // u tunera, który go zbudował, silnik dostaje część nowych rozwiązań (modernizacja), w obcym warsztacie – nie
  const age = raceSeason() - x.born, fatigue = [0, 0.5, 1, 1.5][Math.min(age, 3)] + Math.max(0, age - 3) * 0.5;
  const upgrade = shop.id === x.tuner && !shop.generic ? lastGrowth() * 0.4 : 0;
  x.q = clamp(round1(x.q - fatigue * (0.7 + rnd() * 0.6) + upgrade), 40, 99);
  sendToShop(r, x, 'ovh'); x.ovhFor = raceSeason();
  if (!shop.generic) G.tuners[shop.id].ovh = tunerOvh(shop.id) + 1;
}
// zimą zawodnik może chwilowo zadłużyć budżet sprzętowy (ok. 30% rocznej kwoty) – remont jest konieczny
const ovhBudget = (r, x) => engOwnerClub(x) ? Infinity : (r.equip.budget || 0) + equipAnnual(r) * 0.3;
const ovhOpen = (r, t) => t.id !== 'gm' && (t.generic || tunerOvh(t.id) < t.ovhCap) && !(t.ban && t.ban.includes(r.name));
// Przegląd zimowy: tuner na nowy sezon, wielkość zespołu, wyprzedaż starych silników
function winterReview(r, clients) {
  const e = r.equip, cur = e.tuner, ct = tunerOf(cur);
  // zmiana tunera rozważana tylko z powodu: słaby sezon, kryzys warsztatu, brak miejsca/pieniędzy, rzadziej z ciekawości
  const over = !ct.generic && (clients[cur] || 0) > ct.cap, poor = !ct.generic && !affords(r, ct);
  const climb = ct.generic && r.skill >= 8; // zawodnik, który wyrósł z lokalnego warsztatu
  const reason = over || poor || climb || tunerForm(cur) <= -1.5 || r.form < -0.5 || chance(0.06);
  const tid = reason ? chooseTuner(r, clients, over ? -3 : 2.5) : cur;
  if (tid !== cur) {
    clients[cur] = Math.max(0, (clients[cur] || 1) - 1); clients[tid] = (clients[tid] || 0) + 1;
    e.tuner = tid; e.since = raceSeason();
    if (r.clubId === G.clubId) addMsg({ category: 'drużyna', from: 'Kierownik parku maszyn', title: `${r.name} zmienia tunera`, body: `<p>${esc(r.name)} na nowy sezon zamawia silniki u: <b>${esc(tunerName(tid))}</b> (dotąd ${esc(tunerName(cur))}). Nowe silniki trzeba będzie rozjeździć.</p>`, link: `#/park/zawodnik/${r.id}` });
  }
  const ann = equipAnnual(r);
  e.mechanics = ann > 900000 ? 4 : ann > 450000 ? 3 : ann > 180000 ? 2 : 1;
  e.van = ann > 120000;
  // najstarsze i najsłabsze silniki idą na rynek wtórny (używane silniki dla niższych lig); starzenie – newEquipSeason i doOverhaul
  const own = e.engines.filter(x => !engOwnerClub(x) && !x.away).sort(by(x => x.q, 1));
  let n = own.length - fleetTarget(r);
  for (const x of own) {
    if (n <= 0 && raceSeason() - x.born < 4) break;
    if (e.engines.length <= 2) break;
    e.engines.splice(e.engines.indexOf(x), 1); n--;
    listEngine(x, r); // rynek wtórny – pieniądze zawodnik dostanie przy sprzedaży
  }
  e.frames = clamp(Math.round(e.engines.length / 2.5), 2, 6); // Zmarzlik: 5 podwozi na 12–18 silników
  e.frameRep = [];
}

// Wyjazdowe starty w ligach zagranicznych: zawodnik jedzie na drugim komplecie (słabsze silniki zostają w Polsce)
function foreignEquipWear(r, heats) {
  const list = r.equip.engines.filter(x => engReady(x)).sort(by(x => x.q * x.cond, -1));
  const eng = list[1] || list[0];
  if (!eng) return;
  eng.cond = clamp(eng.cond - heats * rint(1, 3) * 0.7, 5, 100);
  eng.heats += heats; eng.life = (eng.life || 0) + heats;
  if (!eng.sn) engRegister(eng, r, false);
  engUse(eng, r, heats);
}

// ---------- Akcje klubu ----------
// Tunerzy przyjmujący zamówienie klubu dla zawodnika: renoma zawodnika i klubu, wolne miejsca
function tunersForClubOrder(r) {
  const clients = tunerClients(), c = G.clubs[G.clubId];
  const clout = r.skill + (c.league === 'PGE' ? 1 : 0) + ((c.facilities.workshop || 1) - 3) * 0.3;
  return TUNER_DB.filter(t => t.minSkill <= clout + 1 && tunerFree(t, clients, r.equip.tuner) && !(t.ban && t.ban.includes(r.name)));
}
