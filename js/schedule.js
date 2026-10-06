'use strict';
// Terminarz zawodnika: ligi zagraniczne (limit lig GKSŻ), starty w Polsce i za granicą, podróże i zmęczenie,
// rytm zawodów, dzienna dostępność (do treningu w klubie) oraz pogoda o rozkładzie sezonowym dla Polski.

// ---------- Geografia ----------
// [szerokość, długość, kraj]
const GEO = {
  'Wrocław': [51.11, 17.03, 'POL'], 'Toruń': [53.01, 18.6, 'POL'], 'Zielona Góra': [51.94, 15.51, 'POL'], 'Lublin': [51.25, 22.57, 'POL'], 'Rybnik': [50.1, 18.54, 'POL'],
  'Częstochowa': [50.81, 19.12, 'POL'], 'Gorzów Wlkp.': [52.73, 15.24, 'POL'], 'Grudziądz': [53.48, 18.75, 'POL'], 'Leszno': [51.84, 16.57, 'POL'], 'Bydgoszcz': [53.12, 18.01, 'POL'],
  'Krosno': [49.69, 21.77, 'POL'], 'Rzeszów': [50.04, 22.0, 'POL'], 'Poznań': [52.41, 16.93, 'POL'], 'Ostrów Wlkp.': [51.65, 17.81, 'POL'], 'Tarnów': [50.01, 20.99, 'POL'],
  'Łódź': [51.76, 19.46, 'POL'], 'Gdańsk': [54.35, 18.65, 'POL'], 'Gniezno': [52.54, 17.6, 'POL'], 'Piła': [53.15, 16.74, 'POL'], 'Kraków': [50.06, 19.94, 'POL'],
  'Cardiff': [51.48, -3.18, 'GBR'], 'Togliatti': [53.51, 49.42, 'RUS'], 'Balakovo': [52.03, 47.78, 'RUS'], 'Vladivostok': [43.12, 131.89, 'RUS'], 'Oktyabrsky': [54.48, 53.47, 'RUS'],
  'Opole': [50.67, 17.93, 'POL'], 'Świętochłowice': [50.29, 18.92, 'POL'], 'Rawicz': [51.61, 16.86, 'POL'], 'Warszawa': [52.23, 21.01, 'POL'],
  'Daugavpils': [55.87, 26.54, 'LAT'], 'Ryga': [56.95, 24.11, 'LAT'], 'Landshut': [48.54, 12.15, 'GER'], 'Abensberg': [48.81, 11.85, 'GER'], 'Gustrow': [53.79, 12.17, 'GER'],
  'Güstrow': [53.79, 12.17, 'GER'], 'Pocking': [48.4, 13.31, 'GER'], 'Stralsund': [54.31, 13.09, 'GER'], 'Brokstedt': [53.99, 9.82, 'GER'], 'Wolfslake': [52.69, 13.12, 'GER'],
  'Braila': [45.27, 27.96, 'ROU'], 'Debrecen': [47.53, 21.63, 'HUN'], 'Debreczyn': [47.53, 21.63, 'HUN'], 'Fjelsted': [55.4, 9.95, 'DEN'], 'Vojens': [55.25, 9.3, 'DEN'],
  'Esbjerg': [55.47, 8.45, 'DEN'], 'Holsted': [55.51, 8.92, 'DEN'], 'Grindsted': [55.76, 8.93, 'DEN'], 'Slangerup': [55.85, 12.18, 'DEN'], 'Region Varde': [55.62, 8.48, 'DEN'],
  'Glasgow': [55.86, -4.25, 'GBR'], 'Workington': [54.64, -3.55, 'GBR'], 'Manchester': [53.48, -2.24, 'GBR'], 'Leicester': [52.63, -1.13, 'GBR'], 'Ipswich': [52.06, 1.15, 'GBR'],
  'Sheffield': [53.38, -1.47, 'GBR'], 'Wolverhampton': [52.59, -2.13, 'GBR'], "King's Lynn": [52.75, 0.4, 'GBR'], 'Oxford': [51.75, -1.26, 'GBR'], 'Berwick': [55.77, -2.0, 'GBR'],
  'Edinburgh': [55.95, -3.19, 'GBR'], 'Redcar': [54.6, -1.06, 'GBR'], 'Scunthorpe': [53.58, -0.65, 'GBR'], 'Poole': [50.72, -1.98, 'GBR'], 'Plymouth': [50.38, -4.14, 'GBR'],
  'Birmingham': [52.48, -1.89, 'GBR'], 'Newcastle': [54.97, -1.61, 'GBR'], 'Belle Vue': [53.48, -2.24, 'GBR'], 'Mildenhall': [52.34, 0.51, 'GBR'], 'Kent': [51.3, 0.5, 'GBR'],
  'Krsko': [45.96, 15.49, 'SLO'], 'Lamothe-Landerron': [44.63, 0.04, 'FRA'], 'Macon': [46.31, 4.83, 'FRA'], 'Lonigo': [45.39, 11.39, 'ITA'], 'Terenzano': [46.01, 13.27, 'ITA'],
  'Mureck': [46.71, 15.77, 'AUT'], 'Målilla': [57.39, 15.8, 'SWE'], 'Vetlanda': [57.43, 15.08, 'SWE'], 'Västervik': [57.76, 16.64, 'SWE'], 'Eskilstuna': [59.37, 16.51, 'SWE'],
  'Kumla': [59.13, 15.14, 'SWE'], 'Avesta': [60.14, 16.17, 'SWE'], 'Hallstavik': [60.05, 18.6, 'SWE'], 'Norrköping': [58.59, 16.18, 'SWE'], 'Gislaved': [57.3, 13.54, 'SWE'],
  'Kumla ': [59.13, 15.14, 'SWE'], 'Pardubice': [50.04, 15.78, 'CZE'], 'Plzen': [49.74, 13.37, 'CZE'], 'Praga': [50.08, 14.44, 'CZE'], 'Żarnovica': [48.48, 18.72, 'SVK'],
};
const COUNTRY_GEO = { POL: [52.1, 19.0, 'POL'], SWE: [57.8, 15.2, 'SWE'], DEN: [55.5, 9.2, 'DEN'], GBR: [52.6, -1.5, 'GBR'], GER: [51.5, 11.0, 'GER'], CZE: [50.0, 14.8, 'CZE'],
  LAT: [56.9, 24.6, 'LAT'], AUS: [-34.9, 138.6, 'AUS'], USA: [34.0, -118.0, 'USA'], ARG: [-34.6, -58.4, 'ARG'], NOR: [59.9, 10.7, 'NOR'], FIN: [61.5, 23.8, 'FIN'],
  SLO: [46.0, 14.5, 'SLO'], ITA: [45.6, 11.9, 'ITA'], FRA: [44.8, 0.6, 'FRA'], HUN: [47.5, 19.0, 'HUN'], UKR: [50.4, 30.5, 'UKR'], SVK: [48.7, 19.1, 'SVK'], AUT: [47.5, 14.5, 'AUT'],
  NED: [52.4, 5.6, 'NED'], RUS: [55.7, 37.6, 'RUS'], EST: [59.4, 24.7, 'EST'], NZL: [-43.5, 172.6, 'NZL'], ROU: [45.3, 27.9, 'ROU'] };
const geoOf = name => { const n = String(name || '').split(',')[0].trim(); return GEO[n] || null; };
function kmBetween(a, b) {
  const R = 6371, rad = Math.PI / 180, dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Baza zawodnika: w sezonie (od połowy marca do końca września) miasto polskiego klubu, poza sezonem – dom (Polacy: miasto klubu)
function inSeasonBase(date) { const md = date.slice(5, 10); return md >= '03-15' && md <= '09-30'; }
function homeGeo(r) {
  if (hasNat(r, 'POL') && r.clubId && G.clubs[r.clubId]) return geoOf(G.clubs[r.clubId].city) || COUNTRY_GEO.POL;
  return COUNTRY_GEO[r.country] || COUNTRY_GEO.POL;
}
function baseOf(r, date = G.date) {
  if (r.clubId && G.clubs[r.clubId] && (inSeasonBase(date) || hasNat(r, 'POL'))) return geoOf(G.clubs[r.clubId].city) || COUNTRY_GEO.POL;
  return homeGeo(r);
}

// ---------- Podróże ----------
// Poziom komfortu podróży: zależy od pozycji (zarobków) i zaplecza zawodnika
const TRAVEL_TIERS = ['sam prowadzi busa ze sprzętem', 'bus z kierowcą lub mechanikiem – zawodnik odpoczywa w drodze', 'samolot, sprzęt jedzie busem z mechanikami', 'samolot (czasem prywatny), komplety sprzętu w kilku krajach'];
function travelTier(r) {
  if (r.skill >= 15) return 3;
  if (r.skill >= 12) return 2;
  return r.equip && r.equip.van && r.equip.mechanics >= 2 ? 1 : 0;
}
const ROAD_F = [1, 0.6, 0.55, 0.45], AIR_F = [0.5, 0.5, 0.4, 0.3];
// Czas podróży (godziny) i zmęczenie (punkty kondycji) między dwoma miejscami
function travelCost(r, a, b) {
  if (!a || !b) return { h: 0, cost: 0, mode: '' };
  const km = kmBetween(a, b);
  if (km < 15) return { h: 0, cost: 0, mode: '', km: 0 };
  const tier = travelTier(r);
  let road = km * 1.25 / 80 + 0.3;
  const sea = (x, y) => (x === 'GBR' && y !== 'GBR') || (x === 'SWE' && !['SWE', 'DEN', 'NOR'].includes(y)) || (['FIN', 'EST'].includes(x) && y !== x && !['EST', 'FIN', 'LAT'].includes(y));
  if (sea(a[2], b[2]) || sea(b[2], a[2])) road += 5; // prom / tunel
  const opts = [{ h: road, mode: 'samochód', f: ROAD_F[tier] }];
  if (km > 2500) opts.length = 0;
  if (km > 2500 || (tier >= 2 && km > 450) || (tier === 3 && km > 250)) opts.push({ h: (tier === 3 ? 1.8 : 2.8) + km / 700, mode: 'samolot', f: km > 2500 ? AIR_F[0] : AIR_F[tier] });
  const o = opts.sort(by(x => x.h * x.f))[0];
  return { h: round1(o.h), cost: round1(o.h * o.f * 0.9), mode: o.mode, km: Math.round(km) };
}

// ---------- Ligi zagraniczne ----------
// Kluby, składy, terminarze i mecze lig zagranicznych – js/foreign.js (dane: js/foreign-data.js). Tu: nazwy lig i limit GKSŻ.
const FOREIGN_LEAGUES = {};
// Limit lig (Regulamin Przynależności Klubowej art. 216): zawodnik PGE Ekstraligi i 2. Ekstraligi – maks. 3 ligi łącznie z polską,
// od sezonu 2027 – 2; KLŻ – 4. Liczą się ligi z kalendarza Speedway League Bureau (bez lig rozwojowych, np. NDL).
function foreignLimit(r, season) {
  const c = r.clubId && G.clubs[r.clubId];
  if (!c) return 4;
  if (c.league === 'KLZ') return 3;
  return season >= 2027 ? 1 : 2;
}

// ---------- Pogoda: rozkład sezonowy dla Polski, pogoda dnia skorelowana przez kilka dni ----------
const PL_CLIMATE = { t: [-1, 0, 4, 9, 14, 17, 19, 19, 14, 9, 4, 0], wet: [0.45, 0.4, 0.4, 0.35, 0.4, 0.42, 0.42, 0.4, 0.38, 0.38, 0.45, 0.47] };
const PHI = z => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z ** 3)));
function smoothNoise(key, day, period) {
  const k = Math.floor(day / period), t = day / period - k, s = t * t * (3 - 2 * t);
  return hgauss(key + k) * (1 - s) + hgauss(key + (k + 1)) * s;
}
const W_CACHE = new Map();
function dayWeather(date, seed = G ? G.seed : 1) {
  const key = seed + date;
  if (W_CACHE.has(key)) return W_CACHE.get(key);
  if (W_CACHE.size > 3000) W_CACHE.clear();
  const dn = Math.floor(D(date) / 86400000), m = Number(date.slice(5, 7));
  const temp = PL_CLIMATE.t[m - 1] + smoothNoise(seed + 'wt', dn, 4) * 3.5 + hgauss(seed + 'wtd' + date) * 1.3;
  const w = smoothNoise(seed + 'ww', dn, 3) * 0.8 + hgauss(seed + 'wwd' + date) * 0.6;
  const wet = PHI(w / 0.88) < PL_CLIMATE.wet[m - 1];
  const res = { temp, wet, frost: temp < 1.5 };
  W_CACHE.set(key, res);
  return res;
}
// Czy da się jeździć na torze (trening, sparing): co najmniej ~4°C i bez opadów w ciągu dnia
function trackUsable(date) { const w = dayWeather(date); return w.temp >= 4 && !(w.wet && hrand(G.seed + 'ru' + date) < 0.6); }
const TRACK_EXP = {};
function trackExpected(m) {
  if (TRACK_EXP[m] == null) {
    let n = 0, ok = 0;
    for (let y = 2000; y < 2030; y++) for (let d = 1; d <= 28; d++) { const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, w = dayWeather(date, 7); n++; if (w.temp >= 4 && !(w.wet && hrand('7ru' + date) < 0.6)) ok++; }
    TRACK_EXP[m] = ok / n;
  }
  return TRACK_EXP[m];
}
// Dni torowe w ostatnim tygodniu względem normy dla miesiąca (zimny marzec = mniej techniki przed sezonem)
const TWF = new Map();
function trackWeekFactor(date = G.date) {
  if (TWF.has(date)) return TWF.get(date);
  if (TWF.size > 400) TWF.clear();
  let ok = 0;
  for (let i = 0; i < 7; i++) if (trackUsable(addDays(date, -i))) ok++;
  const v = clamp(ok / 7 / Math.max(0.15, trackExpected(Number(date.slice(5, 7)))), 0.3, 1.6);
  TWF.set(date, v);
  return v;
}

// ---------- Plan startów zawodnika ----------
let SQ_CACHE = { date: null, map: new Map() };
// Przewidywany skład meczowy: ustawiony skład albo 6 najlepszych seniorów + 2 juniorów
const injuredOn = (r, d) => { const i = r.injury && G.injuries[r.injury]; return !!(i && d < i.until); };
function expectedSquad(clubId, date = G.date) {
  if (SQ_CACHE.date !== G.date) SQ_CACHE = { date: G.date, map: new Map() };
  const key = clubId + '|' + date;
  if (SQ_CACHE.map.has(key)) return SQ_CACHE.map.get(key);
  let ids = (G.lineups[clubId] || []).filter(id => id && G.riders[id] && !injuredOn(G.riders[id], date));
  if (ids.length < 6) {
    const rs = clubRiders(clubId).filter(r => !injuredOn(r, date));
    const jun = rs.filter(r => isJunior(r)).sort(by(r => r.skill, -1)).slice(0, 2);
    const sen = rs.filter(r => !jun.includes(r)).sort(by(r => r.skill, -1)).slice(0, 6);
    ids = [...sen, ...jun].map(r => r.id);
  }
  const s = new Set(ids);
  SQ_CACHE.map.set(key, s);
  return s;
}
let FXC = { date: null, map: new Map() };
function clubFixturesCached(clubId, season) {
  if (FXC.date !== G.date) FXC = { date: G.date, map: new Map() };
  const k = clubId + '|' + season;
  if (!FXC.map.has(k)) FXC.map.set(k, clubFixtures(clubId, season));
  return FXC.map.get(k);
}
let EVW = { key: null, list: [] };
function eventsIn(from, to) {
  const key = from + to + G.date;
  if (EVW.key !== key) EVW = { key, list: Object.values(G.events).filter(e => e.date >= from && e.date <= to && e.kind !== 'mini-info') };
  return EVW.list;
}
const SPARING_FROM = '03-14', SPARING_TO = '04-10';
// Starty zawodnika w przedziale dat (rozegrane i planowane): mecze ligi polskiej, zawody, Grand Prix, liga zagraniczna, sparingi
function riderPlanned(r, from, to, { noForeign = false } = {}) {
  const out = [];
  const club = r.clubId && G.clubs[r.clubId];
  if (club) {
    for (const f of clubFixturesCached(r.clubId, Number(from.slice(0, 4)))) {
      if (f.date < from || f.date > to) continue;
      const m = f.matchId && G.matches[f.matchId];
      const rides = m && m.done ? !!(m.riders[r.id] && m.riders[r.id].heats) : expectedSquad(r.clubId, f.date).has(r.id);
      if (!rides) continue;
      const host = G.clubs[f.homeId];
      out.push({ d: f.date, k: 'liga', lbl: `${LEAGUES[f.league] ? LEAGUES[f.league].short : 'liga'}: ${f.homeId === r.clubId ? G.clubs[f.awayId].short + ' (dom)' : host.short + ' (wyjazd)'}`, g: geoOf(host.city) || COUNTRY_GEO.POL, link: `#/zawody/${f.id}`, done: !!(m && m.done) });
    }
    // sparingi umówione przez kluby (js/sparing.js), a w pozostałe soboty okresu przygotowawczego trening punktowany w klubie
    if (typeof sparPlannedFor === 'function') for (const e of sparPlannedFor(r, from, to)) if (!out.some(x => x.d === e.d)) out.push(e);
    if (typeof campPlannedFor === 'function') for (const e of campPlannedFor(r, from, to)) if (!out.some(x => x.d === e.d)) out.push(e); // obozy (js/camps.js)
    const y = from.slice(0, 4), s0 = `${y}-${SPARING_FROM}`, s1 = `${y}-${SPARING_TO}`;
    if (to >= s0 && from <= s1) for (let d = from > s0 ? from : s0; d <= s1 && d <= to; d = addDays(d, 1)) {
      if (dow(d) !== 5 || out.some(e => e.d === d) || !hasNat(r, 'POL') && !inSeasonBase(d)) continue;
      if (typeof planManual === 'function' && planManual(r.clubId)) break; // własny plan treningu – treningi punktowane planuje gracz (js/planner.js)
      out.push({ d, k: 'sparing', lbl: 'trening punktowany', g: geoOf(club.city) || COUNTRY_GEO.POL, weather: true });
    }
  }
  for (const e of eventsIn(from, to)) {
    let rides = false;
    const m = e.matchId && G.matches[e.matchId];
    if (m && m.riders) rides = !!m.riders[r.id];
    else if (e.kind === 'sgp') rides = !!(G.sgp && G.sgp.season === e.season && (G.sgp.riders.slice(0, 15).includes(r.id) || (e.sgpExtras && [e.sgpExtras.wildcard, ...e.sgpExtras.trackReserves].includes(r.id))));
    else rides = (e.startList || []).some(x => String(x.id) === String(r.id));
    if (rides) out.push({ d: e.date, k: e.kind === 'sgp' ? 'gp' : 'zawody', lbl: e.name, g: geoOf(e.venue) || COUNTRY_GEO.POL, link: `#/gp/${e.id}`, done: !!e.played });
  }
  if (r.winter && typeof winterPlanned === 'function') for (const e of winterPlanned(r, from, to)) if (!out.some(x => x.d === e.d)) out.push(e); // zima za granicą (js/planner.js)
  if (!noForeign && r.fx) for (const e of r.fx.list) if (e.d >= from && e.d <= to && !out.some(x => x.d === e.d)) out.push({ d: e.d, k: 'zagranica', lbl: `${(FOREIGN_LEAGUES[e.lg] || { name: e.lg }).name} – ${e.vn}`, g: e.g, lg: e.lg, link: e.fid ? `#/zagranica/mecz/${e.fid}` : null, done: e.d < G.date });
  return out.sort(by(e => e.d));
}
// Status dnia: start, podróż, za granicą, w domu (poza Polską zimą), kontuzja albo wolny (dostępny do treningu w klubie)
function dayStatusFrom(r, list, date) {
  const inj = r.injury && G.injuries[r.injury];
  if (inj && date >= (inj.start || '') && date < inj.until) return { s: 'inj', lbl: `kontuzja (${inj.kind})`, avail: false };
  const ev = list.find(e => e.d === date);
  if (ev && ev.k === 'oboz') return { s: 'camp', lbl: ev.lbl, avail: true, ev, abroad: ev.g && ev.g[2] !== 'POL' }; // obóz klubu: trening z klubem
  if (ev) return { s: ev.k === 'sparing' ? 'spar' : 'race', lbl: ev.lbl, avail: ev.k === 'sparing', ev, abroad: ev.g && ev.g[2] !== 'POL' };
  const wa = r.winter && typeof winterAway === 'function' && winterAway(r, date);
  if (wa) return { s: 'abroad', lbl: wa, avail: false };
  const base = baseOf(r, date);
  if (base[2] !== 'POL' && !inSeasonBase(date)) return { s: 'home', lbl: `w domu (${COUNTRY[r.country] || r.country})`, avail: false };
  const next = list.find(e => e.d > date && dayDiff(date, e.d) <= 2), prev = [...list].reverse().find(e => e.d < date && dayDiff(e.d, date) <= 2);
  if (next && dayDiff(date, next.d) === 1) { const t = travelCost(r, prev && prev.g ? prev.g : base, next.g); if (t.h >= 7) return { s: 'travel', lbl: `podróż (${t.mode}, ~${Math.round(t.h)} h)`, avail: false }; }
  if (prev && next && prev.g && next.g && prev.g[2] !== 'POL' && next.g[2] !== 'POL') return { s: 'abroad', lbl: 'za granicą (między startami)', avail: false };
  if (prev && dayDiff(prev.d, date) === 1 && prev.g && prev.g[2] !== base[2]) { const t = travelCost(r, prev.g, base); if (t.h >= 7) return { s: 'travel', lbl: `powrót (${t.mode}, ~${Math.round(t.h)} h)`, avail: false }; }
  if (base[2] !== 'POL') return { s: 'home', lbl: 'poza Polską', avail: false };
  return { s: 'free', lbl: 'dostępny', avail: true };
}
function dayStatus(r, date) { return dayStatusFrom(r, riderPlanned(r, addDays(date, -3), addDays(date, 3)), date); }
// Udział dni dostępnych w klubie (okno 4 tygodni) – podstawa wpływu klubu na trening
function availShare(r) {
  const dv = r.dev || (r.dev = {});
  if (dv.av && dv.av.d > addDays(G.date, -7) && dv.av.d <= G.date) return dv.av.v;
  const from = addDays(G.date, -10), to = addDays(G.date, 17), N = 28;
  const un = new Set(), inW = d => d >= from && d <= to;
  // poza Polską (zimą zawodnicy zagraniczni w domu) – dzień po dniu tylko wtedy, gdy baza na krańcach okna nie jest w Polsce
  if (baseOf(r, from)[2] !== 'POL' || baseOf(r, to)[2] !== 'POL') for (let d = from; d <= to; d = addDays(d, 1)) if (baseOf(r, d)[2] !== 'POL') un.add(d);
  const inj = r.injury && G.injuries[r.injury];
  if (inj) for (let d = inj.start > from ? inj.start : from; d < inj.until && d <= to; d = addDays(d, 1)) un.add(d);
  const list = riderPlanned(r, addDays(from, -3), addDays(to, 3)).filter(e => e.k !== 'sparing' && e.k !== 'oboz');
  list.forEach((e, i) => {
    if (inW(e.d)) un.add(e.d);
    const prev = list[i - 1], next = list[i + 1];
    const base = baseOf(r, e.d);
    const pg = prev && dayDiff(prev.d, e.d) <= 2 ? prev.g : base;
    if (travelCost(r, pg, e.g).h >= 7) { const d = addDays(e.d, -1); if (inW(d)) un.add(d); }
    if (next && dayDiff(e.d, next.d) <= 2) {
      if (e.g[2] !== 'POL' && next.g[2] !== 'POL') for (let d = addDays(e.d, 1); d < next.d; d = addDays(d, 1)) if (inW(d)) un.add(d);
    } else if (e.g[2] !== base[2] && travelCost(r, e.g, base).h >= 7) { const d = addDays(e.d, 1); if (inW(d)) un.add(d); }
  });
  if (typeof campPlannedFor === 'function') for (const e of campPlannedFor(r, from, to)) un.delete(e.d); // obóz: zawodnik z klubem (także obcokrajowiec zimą)
  dv.av = { d: G.date, v: round2(1 - un.size / N) };
  return dv.av.v;
}

// ---------- Rytm zawodów ----------
// Optymalnie 2–3 starty w tygodniu (więcej przy dobrej regeneracji i wytrzymałości)
function rhythmOpt(r) { const a = r.attrs || {}; return clamp(2 + ((a.recovery ?? 10) - 10) / 10 + ((a.stamina ?? 10) - 10) / 20, 1.5, 3.5); }
function startsRecent(r, days = 14, date = G.date) {
  const from = addDays(date, -days);
  return new Set((r.slog || []).filter(s => s.d > from && s.d <= date).map(s => s.d)).size;
}
function rhythmOf(r, date = G.date) {
  const rate = startsRecent(r, 14, date) / 2, opt = rhythmOpt(r);
  let mod, lbl, cls;
  if (rate < opt) { mod = -0.45 * Math.pow(1 - rate / opt, 1.3); lbl = rate === 0 ? 'brak startów' : 'za mało startów'; cls = rate === 0 ? 'neg' : 'warn'; }
  else if (rate <= opt + 0.75) { mod = 0.08; lbl = 'optymalny rytm'; cls = 'pos'; }
  else { mod = 0.08 - 0.15 * (rate - opt - 0.75); lbl = 'przeciążony startami'; cls = 'warn'; }
  return { rate, opt, mod, lbl, cls };
}
let RH_CACHE = { date: null, map: new Map() };
function rhythmMod(r) {
  if (!G.riders[r.id] || !r.slog) return r.slog ? 0 : 0;
  if (RH_CACHE.date !== G.date) RH_CACHE = { date: G.date, map: new Map() };
  if (!RH_CACHE.map.has(r.id)) RH_CACHE.map.set(r.id, rhythmOf(r).mod);
  return RH_CACHE.map.get(r.id);
}
function logStart(r, date, heats, k) {
  r.slog = (r.slog || []).filter(s => dayDiff(s.d, date) <= 40);
  r.slog.push({ d: date, h: heats, k });
  if (RH_CACHE.date === date) RH_CACHE.map.delete(r.id);
}
function heatsRecent(r, days = 7) { const from = addDays(G.date, -days); return sum((r.slog || []).filter(s => s.d > from).map(s => s.h)); }

// ---------- Dzień gry ----------
// Przed zawodami dnia: podróże (zmęczenie), sparingi i mecze lig zagranicznych
function scheduleBeforeRaces(date) {
  if ((!G.flSeason || G.flSeason !== G.season) && typeof ensureForeignSeason === 'function') ensureForeignSeason(G.season);
  const racing = new Map();
  for (const f of Object.values(G.fixtures)) {
    if (f.date !== date || f.played) continue;
    const host = G.clubs[f.homeId], g = geoOf(host.city) || COUNTRY_GEO.POL;
    for (const cid of [f.homeId, f.awayId]) for (const id of expectedSquad(cid)) racing.set(id, g);
  }
  for (const e of eventsIn(date, date)) {
    if (e.played) continue;
    const g = geoOf(e.venue) || COUNTRY_GEO.POL;
    const ids = e.kind === 'sgp' ? (G.sgp && G.sgp.riders) || [] : (e.startList || []).map(x => x.id);
    for (const id of ids) if (G.riders[id]) racing.set(Number(id), g);
  }
  for (const [id, g] of racing) travelTo(G.riders[id], g, date);
  // ligi zagraniczne: wszystkie mecze dnia; jadą zawodnicy, którzy tego dnia nie startują w Polsce ani w zawodach (js/foreign.js)
  if (typeof foreignDay === 'function') foreignDay(date, racing);
  // trening punktowany w soboty okresu przygotowawczego (zawodnicy bez sparingu tego dnia – js/sparing.js), przy dobrej pogodzie
  const md = date.slice(5, 10);
  if (dow(date) === 5 && md >= SPARING_FROM && md <= SPARING_TO && trackUsable(date)) {
    for (const r of Object.values(G.riders)) {
      if (!r.clubId || r.retired || !r.active || r.injury || racing.has(r.id) || (r.slog || []).some(s => s.d === date)) continue;
      if (typeof planManual === 'function' && planManual(r.clubId)) continue; // własny plan treningu (js/planner.js)
      if (typeof onCamp === 'function' && onCamp(r, date)) continue; // na obozie
      if (!hasNat(r, 'POL') && !inSeasonBase(date)) continue;
      logStart(r, date, 4, 'sparing');
      if (typeof licFriendly === 'function') licFriendly(r, date, 4); // sparing klubu – zawody towarzyskie (licencja)
      r.cond = clamp(r.cond - 4 * (2.2 - r.attrs.stamina * 0.05), 40, 100);
    }
  }
}
function travelTo(r, g, date) {
  if (!r || !g) return;
  const from = r.loc && dayDiff(r.loc.d, date) <= 2 ? r.loc.g : baseOf(r, date);
  const t = travelCost(r, from, g);
  if (t.cost > 0) { r.cond = clamp(r.cond - t.cost, 30, 100); r.trav = date; }
  r.loc = { g, d: date };
}
// Po zawodach: dziennik startów (rytm, ekspozycja na tor) i powroty do bazy
function scheduleAfterRaces(date) {
  for (const m of Object.values(G.matches)) {
    if (m.date !== date || !m.riders) continue;
    for (const [rid, s] of Object.entries(m.riders)) {
      const r = G.riders[rid];
      if (!r) continue;
      const h = s.heats || (m.kind === 'sgp' ? 5 : 0);
      if (h && !(r.slog || []).some(x => x.d === date && x.k !== 'sparing')) logStart(r, date, h, m.kind || 'liga');
    }
  }
  for (const r of Object.values(G.riders)) {
    if (!r.loc || r.loc.d >= date) continue;
    if (dayDiff(r.loc.d, date) < 2) continue;
    const t = travelCost(r, r.loc.g, baseOf(r, date));
    if (t.cost > 0) { r.cond = clamp(r.cond - t.cost * 0.6, 30, 100); r.trav = date; }
    r.loc = null;
  }
}
// ---------- Nowa gra i migracja ----------
function ensureScheduleModel() {
  let ch = false;
  for (const r of Object.values(G.riders)) if (!r.slog) { r.slog = []; ch = true; }
  if (typeof ensureForeignModel === 'function' && ensureForeignModel()) ch = true; // kluby i składy lig zagranicznych (js/foreign.js)
  if (typeof ensureForeignSeason === 'function' && G.flSeason !== G.season && ensureForeignSeason(G.season)) ch = true;
  return ch;
}

// Starty w ligach zagranicznych z kalibracji (liga rosyjska 2025 – tools/fetch_rus.py): zawodnicy z gry dostają ligę
// i wracają do ścigania (bez klubu w Polsce: zawieszenie FIM bez polskiego obywatelstwa – js/nationality.js)
function applyCalibForeign() {
  const F = typeof CAL_DATA !== 'undefined' && CAL_DATA && CAL_DATA.foreign;
  if (!F || !G) return false;
  let ch = false;
  for (const r of Object.values(G.riders)) {
    const a = F[String(r.id)] || F['n:' + r.name];
    if (!a || (r.activity || []).includes(a)) continue;
    r.activity = [...(r.activity || []), a];
    r.lastSeason = Math.max(r.lastSeason || 0, 2025);
    if (!r.clubId) { r.active = true; r.retired = false; delete r.retiredOn; delete r.retiredAuto; delete r.licExpired; }
    if (r.fl && r.fl.season) r.fl = null; // nowy przydział lig w najbliższym sezonie
    ch = true;
  }
  return ch;
}
