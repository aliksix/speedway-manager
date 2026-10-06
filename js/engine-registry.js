'use strict';
// Rejestr silników i rynek wtórny. Każdy silnik ma numer seryjny (kod warsztatu-rocznik-numer, np. RK-2026-017)
// i kartę: budowa, właściciele, przebieg (biegi w sezonie), remonty zimowe i kapitalne, naprawy po awariach, sprzedaże.
// Rynek wtórny: zawodnicy zimą wystawiają najstarsze/nadmiarowe silniki, kupują je słabsi zawodnicy (i klub gracza);
// nieprzydatne idą za granicę albo na złom. Por. Kowalski: zachęca do zakupu używanych silników i informuje o ich
// pochodzeniu i roczniku (data/equipment/TUNERZY-2025-26.md).

const SN_CODE = { ash: 'ASH', rk: 'RK', pj: 'PJR', mm: 'MMX', frj: 'FRJ', fg: 'FGM', bk: 'BK', jr: 'JR', kj: 'KJ', bve: 'BVE', wg: 'WG', jk: 'JK', vm: 'GMF', ak: 'AK', mk: 'MK', mg: 'MG', reg: 'REG', loc: 'LOK', gm: 'GM' };
const HIST_MAX = 60;
const ownerRef = o => (o && o.equip ? `r${o.id}` : o && o.park ? `c${o.id}` : '');
function engLog(x, code, a = null, b = null) {
  if (!x.sn) return;
  (x.hist = x.hist || []).push([G.date, code, a, b]);
  if (x.hist.length > HIST_MAX) x.hist.splice(1, x.hist.length - HIST_MAX); // zachowaj wpis o budowie
}
// Nadanie numeru seryjnego (nowy silnik albo silnik z zapisu sprzed rejestru)
function engRegister(x, owner, built = true) {
  if (x.sn) return x;
  const code = SN_CODE[tunerOf(x.tuner).id] || 'GM', key = `${code}-${x.born}`;
  G.engSeq = G.engSeq || {};
  G.engSeq[key] = (G.engSeq[key] || 0) + 1;
  x.sn = `${key}-${String(G.engSeq[key]).padStart(3, '0')}`;
  x.hist = [[built ? G.date : `${x.born}-03-01`, 'B', tunerOf(x.tuner).id, ownerRef(owner)]];
  x.use = x.use || {};
  return x;
}
// Przebieg: biegi przejechane na tym silniku w sezonie przez danego zawodnika
function engUse(x, r, heats = 1) {
  if (!x || !x.sn) return;
  const k = `${sportSeason()}|${r.id}`;
  (x.use = x.use || {})[k] = (x.use[k] || 0) + heats;
}
const engOwners = x => [...new Set(Object.keys(x.use || {}).map(k => k.split('|')[1]))].map(id => G.riders[isNaN(id) ? id : Number(id)]).filter(Boolean);
const engHeatsTotal = x => sum(Object.values(x.use || {})) + sum(Object.values(x.tr || {}));
// Przebieg treningowy (dzień na torze = ok. 5 biegów)
function engTrain(x, r) {
  if (!x.sn) return;
  const k = `${sportSeason()}|${r.id}`;
  (x.tr = x.tr || {})[k] = (x.tr[k] || 0) + 1;
}

// ---------- Rynek wtórny ----------
// Cena: rocznik, stan, przebieg od remontu kapitalnego, rodowód (silnik czołowego zawodnika jest droższy)
function usedPrice(x) {
  const t = tunerOf(x.tuner), age = raceSeason() - x.born;
  const best = Math.max(0, ...engOwners(x).map(r => r.skill));
  let p = t.engine * clamp(0.75 - 0.15 * age, 0.15, 0.75) * (0.85 + 0.15 * (x.cond ?? 90) / 100) * (1 - Math.min(1, (x.life || 0) / (x.lifeMax || 100)) * 0.15);
  if (best >= 15) p *= 1.2; else if (best >= 12) p *= 1.08;
  return Math.max(2000, Math.round(p / 500) * 500);
}
// Wystawienie silnika na sprzedaż (zawodnik albo klub); pieniądze sprzedający dostaje dopiero przy sprzedaży
function listEngine(x, seller) {
  G.used = G.used || [];
  x.away = null; x.job = null; x.shop = null;
  const price = usedPrice(x);
  G.used.push({ x, seller: ownerRef(seller), price, since: G.date });
  engLog(x, 'M', ownerRef(seller), price);
  return price;
}
function paySeller(ref, price, x) {
  const id = Number(ref.slice(1));
  if (ref[0] === 'r' && G.riders[id]) G.riders[id].equip.budget = (G.riders[id].equip.budget || 0) + price;
  else if (ref[0] === 'c' && G.clubs[id]) addTx(id, 'sprzęt', price, `Sprzedaż używanego silnika ${x.sn}`);
}
// Zakup z rynku: nowy właściciel (zawodnik – własny silnik; klub – do parku maszyn albo dla zawodnika)
function buyUsed(i, buyer, forRider = null) {
  const L = G.used[i];
  if (!L) return null;
  G.used.splice(i, 1);
  const x = L.x;
  paySeller(L.seller, L.price, x);
  x.feel = 25; x.shop = null; // nowy właściciel musi silnik dopasować
  engLog(x, 'P', ownerRef(forRider || buyer), L.price);
  if (buyer.park) {
    addTx(buyer.id, 'sprzęt', -L.price, `Używany silnik ${x.sn}${forRider ? ` dla: ${forRider.name}` : ''}`);
    x.club = buyer.id;
    if (forRider) { x.id = Math.max(0, ...forRider.equip.engines.map(e => e.id)) + 1; forRider.equip.engines.push(x); forRider.equip.clubSupport += L.price; }
    else buyer.park.clubEngines.push(x);
  } else {
    buyer.equip.budget -= L.price;
    x.club = null;
    x.id = Math.max(0, ...buyer.equip.engines.map(e => e.id)) + 1;
    buyer.equip.engines.push(x);
  }
  return x;
}
// Zakupy zawodników AI (XI–III): kto potrzebuje silnika, a nie stać go na nowy albo tuner ma komplet – kupuje używany
function aiBuyUsed(r) {
  const e = r.equip, own = e.engines.filter(x => !engOwnerClub(x));
  if (!G.used || !G.used.length || own.length >= fleetTarget(r)) return;
  const t = tunerOf(e.tuner);
  if (e.budget >= t.engine * 1.2 && tunerCanBuild(e.tuner) && r.skill >= 9) return; // stać go na nowy – woli nowy
  const worst = Math.min(...own.map(x => x.q), 99), cash = (e.budget || 0) + equipAnnual(r) * 0.1;
  let best = -1, bs = -1e9;
  G.used.forEach((L, i) => {
    if (L.price > cash || L.seller === `r${r.id}`) return;
    if (own.length >= 2 && L.x.q <= worst) return;
    const s = L.x.q - L.price / 2500 + (L.x.tuner === e.tuner ? 1 : 0) + gauss(1);
    if (s > bs) { bs = s; best = i; }
  });
  if (best < 0) return;
  const x = buyUsed(best, r);
  if (r.clubId === G.clubId) addMsg({ category: 'drużyna', from: 'Kierownik parku maszyn', title: `${r.name} kupił używany silnik`, body: `<p>${esc(r.name)} kupił na rynku wtórnym silnik <a href="#/silnik/${encodeURIComponent(x.sn)}">${esc(x.sn)}</a> (${esc(tunerName(x.tuner))}, rocznik ${x.born}${engOwners(x).length ? `, wcześniej: ${engOwners(x).map(o => esc(o.name)).join(', ')}` : ''}).</p>`, link: `#/silnik/${encodeURIComponent(x.sn)}` });
}
// Listopad: niesprzedane silniki – część kupują zawodnicy z zagranicznych niższych lig (60% ceny), najstarsze idą na złom
function marketSeason() {
  if (!G.used) return;
  G.used = G.used.filter(L => {
    const age = raceSeason() - L.x.born, old = dayDiff(L.since, G.date) > 300;
    if (L.x.q < 55 || age > 6 || (old && chance(0.5))) { engLog(L.x, 'X'); return false; } // złom / części
    if (chance(0.35)) { paySeller(L.seller, Math.round(L.price * 0.6 / 500) * 500, L.x); engLog(L.x, 'E', null, null); return false; } // eksport
    L.price = usedPrice(L.x);
    return true;
  });
}
// Szukanie silnika po numerze (zawodnicy, parki maszyn klubów, rynek)
function findEngine(sn) {
  for (const r of Object.values(G.riders)) if (r.equip) { const x = r.equip.engines.find(e => e.sn === sn); if (x) return { x, rider: r }; }
  for (const c of Object.values(G.clubs)) { const x = (c.park && c.park.clubEngines || []).find(e => e.sn === sn); if (x) return { x, club: c }; }
  const i = (G.used || []).findIndex(L => L.x.sn === sn);
  return i >= 0 ? { x: G.used[i].x, market: G.used[i], idx: i } : null;
}
// Numery seryjne dla silników z zapisów sprzed rejestru
function ensureEngineRegistry() {
  if (G.engReg) return false;
  G.used = G.used || [];
  for (const r of Object.values(G.riders)) if (r.equip) for (const x of r.equip.engines) engRegister(x, r, false);
  for (const c of Object.values(G.clubs)) if (c.park) for (const x of c.park.clubEngines || []) engRegister(x, c, false);
  G.engReg = 1;
  return true;
}

// ---------- Motocykle szkółki (pit bike, miniżużel 85–140, 250 cm³, 500R) ----------
// Klub zapewnia adeptom motocykle w każdej klasie. Za mało maszyn – adepci dzielą się sprzętem, trening techniczny słabnie
// (js/training.js: facilityFor). Ceny nowych: Shupa 125 ok. 3800–4150 € (2023, data/equipment/RAPORT.md); pozostałe – założenia gry.
const ACAD_BIKE = {
  c50: { name: 'Pit bike', price: 7000, upkeep: 1000 },
  c85: { name: 'Miniżużel 85–140 cm³ (np. Shupa 125)', price: 17000, upkeep: 3000 },
  c250: { name: 'Motocykl 250 cm³', price: 30000, upkeep: 6000 },
  c500: { name: 'Motocykl 500R', price: 55000, upkeep: 10000 },
};
const BIKE_TARGET = 0.8; // typowe pokrycie: ok. 4 motocykle na 5 adeptów (część adeptów ma sprzęt rodziców)
const academyKids = (clubId, cls) => Object.values(G.academy).filter(k => k.clubId === clubId && !k.catalogOnly && k.cat === cls).length;
function newBike(cls, born = raceSeason()) {
  G.bikeSeq = (G.bikeSeq || 0) + 1;
  return { sn: `${cls.toUpperCase()}-${born}-${String(G.bikeSeq).padStart(4, '0')}`, cls, born, cond: 100 };
}
function ensureAcademyBikes() {
  if (G.bikesReady) return false;
  G.usedBikes = G.usedBikes || [];
  for (const c of Object.values(G.clubs)) {
    if (!c.park) continue;
    c.park.bikes = c.park.bikes || [];
    for (const cls of Object.keys(ACAD_BIKE)) {
      const n = Math.round(academyKids(c.id, cls) * BIKE_TARGET);
      for (let i = 0; i < n; i++) { const b = newBike(cls, raceSeason() - rint(0, 4)); b.cond = rint(45, 95); c.park.bikes.push(b); }
    }
  }
  seedUsedBikes();
  G.bikesReady = 1;
  return true;
}
// Pokrycie sprzętem w grupie klas (mini: pit bike + 85–140; szkółka: 250 + 500R) → mnożnik obiektów w treningu technicznym
function academyBikeFactor(c, cat) {
  if (!c || !c.park || !c.park.bikes) return 1;
  const classes = Object.keys(ACAD_BIKE).filter(cls => (MINI_CATS.includes(cls) ? 'mini' : 'academy') === cat);
  const kids = sum(classes.map(cls => academyKids(c.id, cls)));
  if (!kids) return 1;
  const bikes = c.park.bikes.filter(b => classes.includes(b.cls) && b.cond >= 15).length;
  return round2(0.7 + 0.3 * Math.min(1.25, bikes / kids / BIKE_TARGET));
}
const bikePrice = b => Math.max(1000, Math.round(ACAD_BIKE[b.cls].price * clamp(0.75 - 0.1 * (raceSeason() - b.born), 0.2, 0.75) * (0.6 + 0.4 * b.cond / 100) / 500) * 500);
// Rynek używanych motocykli szkółkowych: oferty innych szkółek i rodzin (co roku jesienią), oferty klubu gracza
function seedUsedBikes() {
  G.usedBikes = (G.usedBikes || []).filter(L => L.seller === `c${G.clubId}`);
  const sellers = Object.values(G.clubs).filter(c => c.id !== G.clubId);
  for (let i = rint(15, 25); i > 0; i--) {
    const cls = pick(['c50', 'c85', 'c85', 'c250', 'c250', 'c500']), b = newBike(cls, raceSeason() - rint(1, 5));
    b.cond = rint(35, 90);
    G.usedBikes.push({ b, seller: chance(0.6) ? `c${pick(sellers).id}` : 'p', price: bikePrice(b), since: G.date });
  }
}
function academyBikesMonthly(m) {
  for (const c of Object.values(G.clubs)) {
    if (!c.park || !c.park.bikes) continue;
    // zużycie w sezonie treningowym (III–X) – motocykle w klasach, w których są adepci
    if (m >= 3 && m <= 10) for (const b of c.park.bikes) if (academyKids(c.id, b.cls)) b.cond = Math.max(0, b.cond - rint(1, 3));
    if (m !== 11) continue;
    // listopad: przegląd zimowy (koszt utrzymania), wycofanie zużytych, kluby AI uzupełniają sprzęt
    const out = c.park.bikes.filter(b => b.cond < 15 || raceSeason() - b.born > 7);
    c.park.bikes = c.park.bikes.filter(b => !out.includes(b));
    const upkeep = sum(c.park.bikes.map(b => ACAD_BIKE[b.cls].upkeep));
    for (const b of c.park.bikes) b.cond = Math.min(100, b.cond + 35);
    if (upkeep) addTx(c.id, 'sprzęt', -upkeep, `Szkółka: przegląd zimowy motocykli (${c.park.bikes.length})`);
    if (c.id === G.clubId) {
      if (out.length) addMsg({ category: 'szkółka', from: 'Kierownik parku maszyn', title: `Szkółka: ${out.length} motocykli wycofanych`, body: `<p>Wycofane z eksploatacji (zużycie, wiek): ${out.map(b => `${esc(ACAD_BIKE[b.cls].name)} ${esc(b.sn)}`).join(', ')}.</p><p>Sprawdź pokrycie sprzętem w klasach szkółki.</p>`, link: '#/park/szkolka' });
    } else for (const cls of Object.keys(ACAD_BIKE)) {
      const need = Math.round(academyKids(c.id, cls) * BIKE_TARGET) - c.park.bikes.filter(b => b.cls === cls).length;
      for (let i = 0; i < need; i++) { c.park.bikes.push(newBike(cls)); addTx(c.id, 'sprzęt', -ACAD_BIKE[cls].price, `Szkółka: nowy motocykl (${ACAD_BIKE[cls].name})`); }
    }
  }
  if (m === 11) seedUsedBikes();
  // oferty klubu gracza: co miesiąc szansa, że ktoś kupi
  for (const L of (G.usedBikes || []).filter(L => L.seller === `c${G.clubId}`)) if (chance(0.35)) {
    G.usedBikes.splice(G.usedBikes.indexOf(L), 1);
    addTx(G.clubId, 'sprzęt', L.price, `Szkółka: sprzedaż używanego motocykla ${L.b.sn}`);
  }
}
