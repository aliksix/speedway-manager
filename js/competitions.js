'use strict';
// Wszystkie zawody z kalendarza GKSŻ i FIM rozgrywane w grze:
// turnieje indywidualne, zawody parowe, drużynowe (czwórmecze i mecze dwóch drużyn) oraz egzaminy licencyjne.

const COMP_GROUPS = [['swiat', 'Mistrzostwa świata (FIM)'], ['europa', 'Mistrzostwa Europy (FIM Europe)'], ['polska', 'Mistrzostwa Polski i reprezentacja'],
  ['mlodziez', 'Młodzież, 500R i szkolenie'], ['turnieje', 'Turnieje i memoriały']];

// Rozgrywki: format (ind / pairs / team / exam), obsada (field), cykl z klasyfikacją łączną (series)
const COMPS = {
  SGP: { name: 'Indywidualne Mistrzostwa Świata – Speedway Grand Prix', short: 'SGP', group: 'swiat', format: 'ind', field: 'sgp', series: true },
  SGPQ: { name: 'Kwalifikacje do Grand Prix', short: 'Kwal. SGP', group: 'swiat', format: 'ind', field: 'sgpQual' },
  SGP2: { name: 'Indywidualne Mistrzostwa Świata U21 (SGP2)', short: 'SGP2', group: 'swiat', format: 'ind', field: 'u21', series: true },
  SGP2Q: { name: 'Kwalifikacje SGP2', short: 'Kwal. SGP2', group: 'swiat', format: 'ind', field: 'u21Qual' },
  SGP3: { name: 'Mistrzostwa Świata 250 cm³ (SGP3)', short: 'SGP3', group: 'swiat', format: 'ind', field: 'kids250' },
  SGP4: { name: 'Mistrzostwa Świata 125 cm³ (SGP4)', short: 'SGP4', group: 'swiat', format: 'ind', field: 'kids125' },
  SWC: { name: 'Drużynowy Puchar Świata (Speedway World Cup)', short: 'DPŚ', group: 'swiat', format: 'team', field: 'nations' },
  SON2: { name: 'Drużynowe Mistrzostwa Świata U21 (SON2)', short: 'SON2', group: 'swiat', format: 'pairs', field: 'nationsU21' },
  SEC: { name: 'Indywidualne Mistrzostwa Europy (SEC)', short: 'IME', group: 'europa', format: 'ind', field: 'europe', series: true },
  SECQ: { name: 'Eliminacje Indywidualnych Mistrzostw Europy', short: 'Elim. IME', group: 'europa', format: 'ind', field: 'europeQual' },
  EPC: { name: 'Mistrzostwa Europy Par', short: 'MEP', group: 'europa', format: 'pairs', field: 'nationsEU' },
  ETC: { name: 'Drużynowe Mistrzostwa Europy', short: 'DME', group: 'europa', format: 'team', field: 'nationsEU' },
  EU24T: { name: 'Drużynowe Mistrzostwa Europy U24', short: 'DME U24', group: 'europa', format: 'team', field: 'nationsEU24' },
  EU24C: { name: 'Indywidualny Puchar Europy U24', short: 'IPE U24', group: 'europa', format: 'ind', field: 'euroU24' },
  EU19: { name: 'Indywidualne Mistrzostwa Europy U19', short: 'IME U19', group: 'europa', format: 'ind', field: 'euroU19' },
  EU19P: { name: 'Mistrzostwa Europy Par U19', short: 'MEP U19', group: 'europa', format: 'pairs', field: 'nationsEU19' },
  E250: { name: 'Mistrzostwa Europy 250 cm³', short: 'ME 250', group: 'europa', format: 'ind', field: 'kids250' },
  E250P: { name: 'Mistrzostwa Europy Par 250 cm³', short: 'MEP 250', group: 'europa', format: 'pairs', field: 'clubsKids250' },
  E125: { name: 'Puchar Europy 125 cm³', short: 'PE 125', group: 'europa', format: 'ind', field: 'kids125' },
  MACEC: { name: 'Puchar MACEC', short: 'MACEC', group: 'europa', format: 'ind', field: 'u21' },
  IMP: { name: 'Indywidualne Mistrzostwa Polski', short: 'IMP', group: 'polska', format: 'ind', field: 'pol', series: true },
  IMPC: { name: 'IMP – Challenge', short: 'IMP Challenge', group: 'polska', format: 'ind', field: 'polChallenge' },
  IMPE: { name: 'IMP – eliminacje', short: 'Elim. IMP', group: 'polska', format: 'ind', field: 'polElim' },
  ZK: { name: 'Złoty Kask', short: 'Złoty Kask', group: 'polska', format: 'ind', field: 'pol' },
  MPPK: { name: 'Mistrzostwa Polski Par Klubowych', short: 'MPPK', group: 'polska', format: 'pairs', field: 'clubs' },
  REP: { name: 'Mecz reprezentacji Polski', short: 'Reprezentacja', group: 'polska', format: 'team', field: 'national' },
  SK: { name: 'Srebrny Kask (U21)', short: 'Srebrny Kask', group: 'mlodziez', format: 'ind', field: 'polU21' },
  SKE: { name: 'Srebrny Kask – eliminacje', short: 'Elim. SK', group: 'mlodziez', format: 'ind', field: 'polU21Elim' },
  BK: { name: 'Brązowy Kask (U19)', short: 'Brązowy Kask', group: 'mlodziez', format: 'ind', field: 'polU19' },
  BKE: { name: 'Brązowy Kask – eliminacje', short: 'Elim. BK', group: 'mlodziez', format: 'ind', field: 'polU19Elim' },
  MIMP: { name: 'Młodzieżowe Indywidualne Mistrzostwa Polski', short: 'MIMP', group: 'mlodziez', format: 'ind', field: 'polU21' },
  MIMPE: { name: 'MIMP – eliminacje', short: 'Elim. MIMP', group: 'mlodziez', format: 'ind', field: 'polU21Elim' },
  MMPPK: { name: 'Młodzieżowe Mistrzostwa Polski Par Klubowych', short: 'MMPPK', group: 'mlodziez', format: 'pairs', field: 'clubsU21' },
  DMPJ: { name: 'Drużynowe Mistrzostwa Polski Juniorów', short: 'DMPJ', group: 'mlodziez', format: 'team', field: 'clubsU21', table: true },
  U24E: { name: 'Ekstraliga U24', short: 'U24 Ekstraliga', group: 'mlodziez', format: 'team', field: 'clubsU24', table: true },
  IPEU17: { name: 'Indywidualny Puchar Ekstraligi U17', short: 'IPE U17', group: 'mlodziez', format: 'ind', field: 'u17', series: true },
  IP2EU19: { name: 'Indywidualny Puchar 2. Ekstraligi U19', short: 'IP2E U19', group: 'mlodziez', format: 'ind', field: 'u19', series: true },
  DPE500: { name: 'Drużynowy Puchar Ekstraligi 500R', short: 'DPE 500R', group: 'mlodziez', format: 'team', field: 'kids500PGE', table: true },
  DP2E500: { name: 'Drużynowy Puchar 2. Ekstraligi 500R', short: 'DP2E 500R', group: 'mlodziez', format: 'team', field: 'kids500_2E', table: true },
  IPE500: { name: 'Indywidualny Puchar Ekstraligi 500R', short: 'IPE 500R', group: 'mlodziez', format: 'ind', field: 'kids500', series: true },
  PG500: { name: 'Puchar GKSŻ 500R', short: 'Puchar GKSŻ', group: 'mlodziez', format: 'ind', field: 'kids500', series: true },
  IMP500: { name: 'Indywidualne Mistrzostwa Polski 500R', short: 'IMP 500R', group: 'mlodziez', format: 'ind', field: 'kids500', series: true },
  TZKJ: { name: 'Turnieje Zaplecza Kadry Juniorów', short: 'TZKJ', group: 'mlodziez', format: 'ind', field: 'polU21Reserve', series: true },
  ZSZ: { name: 'Zawody szkoleniowe', short: 'Szkoleniowe', group: 'mlodziez', format: 'ind', field: 'kidsMix' },
  EXAM: { name: 'Egzaminy na licencję żużlową', short: 'Egzaminy', group: 'mlodziez', format: 'exam', field: 'exam' },
  IMME: { name: 'Indywidualny Międzynarodowy Memoriał im. Z. Plecha (IMME)', short: 'IMME', group: 'turnieje', format: 'ind', field: 'open' },
  GB: { name: 'Golden Boy Trophy', short: 'Golden Boy', group: 'turnieje', format: 'ind', field: 'u21' },
  FT: { name: 'Flat Track Challenge', short: 'Flat Track', group: 'turnieje', format: 'ind', field: 'openLower' },
};
COMP_GROUPS.push(['mini','Miniżużel']);
for (const [key,name,format,series] of [
 ['DPE','Drużynowy Puchar Ekstraligi 85–140cc','team',true],['IPE','Indywidualny Puchar Ekstraligi 85–140cc','ind',true],
 ['DMP_A','DMP 85–140cc — grupa A','team',true],['DMP_B','DMP 85–140cc — grupa B','team',true],
 ['IPP_A','IPP 85–140cc — grupa A','ind',true],['IPP_B','IPP 85–140cc — grupa B','ind',true],
 ['DMP','DMP 85–140cc — finał','team',false],['IPP','IPP 85–140cc — finał','ind',false],
 ['IMPQ','IMP 85–140cc — półfinały','ind',false],['IMP','IMP 85–140cc — finały','ind',true],
 ['MPPKQ','MPPK 85–140cc — półfinały','pairs',false],['MPPK','MPPK 85–140cc — finał','pairs',false],
 ['OPEN','Turnieje miniżużlowe','ind',false],['INFO','Szkolenie miniżużlowe','ind',false]
]) COMPS['MINI_'+key]={name,short:key,group:'mini',format,field:format==='ind'?'mini':'miniTeams',series:format==='ind'&&series,table:format!=='ind'&&series};
// Kolejność reguł ma znaczenie (od najbardziej szczegółowych)
const EVENT_RULES = [
  [/rezerwow|rezerowa/i, null],
  [/Egzamin na licencję/, 'EXAM'],
  [/Speedway Grand Prix World Championship (QR\d|Challenge)/, 'SGPQ'],
  [/SGP2 World Championship QR/, 'SGP2Q'],
  [/SGP3/, 'SGP3'],
  [/Individual Speedway Euro Championship Final (\d)/, 'SEC'],
  [/Individual Speedway Euro Championship (QR\d|ECC)/, 'SECQ'],
  [/250cc Pairs/, 'E250P'],
  [/250cc Youth/, 'E250'],
  [/125cc/, 'E125'],
  [/U19 Pairs/, 'EU19P'],
  [/U19 Individual Speedway Championship/, 'EU19'],
  [/U24 Team Speedway Championship/, 'EU24T'],
  [/U24 Individual Speedway Cup/, 'EU24C'],
  [/European Pairs Speedway Championship/, 'EPC'],
  [/European Team Speedway Championship/, 'ETC'],
  [/Puchar MACEC/, 'MACEC'],
  [/Indywidualne Mistrzostwa Polski Finał (\d)/, 'IMP'],
  [/Indywidualne Mistrzostwa Polski Challenge/, 'IMPC'],
  [/Eliminacje Indywidualnych Mistrzostw Polski/, 'IMPE'],
  [/Finał Złotego Kasku/, 'ZK'],
  [/Finał Mistrzostw Polski Par Klubowych/, 'MPPK'],
  [/Reprezentacji Polski/, 'REP'],
  [/Finał Srebrnego Kasku/, 'SK'], [/Eliminacje Srebrnego Kasku/, 'SKE'],
  [/Finał Brązowego Kasku/, 'BK'], [/Eliminacje Brązowego Kasku/, 'BKE'],
  [/Finał Młodzieżowych Indywidualnych/, 'MIMP'], [/Eliminacje Młodzieżowych Indywidualnych/, 'MIMPE'],
  [/Młodzieżowych Mistrzostw Polski Par Klubowych/, 'MMPPK'],
  [/^DMPJ/, 'DMPJ'],
  [/^U24E - (\d+) runda/, 'U24E'],
  [/^DPE 500R - (\d+) runda/, 'DPE500'],
  [/^DP2E( 500R)? - (\d+) runda/, 'DP2E500'],
  [/^IPE U17 - (\d+) runda/, 'IPEU17'],
  [/^IP2E U19 - (\d+) runda/, 'IP2EU19'],
  [/^IPE 500R - (\d+) runda/, 'IPE500'],
  [/^Puchar GKSŻ 500R/, 'PG500'],
  [/^IMP 500R/, 'IMP500'],
  [/Zaplecza Kadry Juniorów/, 'TZKJ'],
  [/Zawody szkoleniowe/, 'ZSZ'],
  [/^IMME$/, 'IMME'],
  [/Golden Boy/, 'GB'],
  [/Flat Track/, 'FT'],
  [/Memoriał|Memorial|Kryterium Asów|Speed Masters|Koronę|Pożegnalny|Silesia Cup|Derby/, 'TOUR'],
];
const FIM_SERIES_COMP = { SGP2: 'SGP2', SGP3: 'SGP3', SGP4: 'SGP4', SON: 'SON2', SWC: 'SWC' };
const EUROPE_CC = new Set(['POL', 'GBR', 'SWE', 'DEN', 'GER', 'LAT', 'CZE', 'SLO', 'ITA', 'NOR', 'FRA', 'UKR', 'NED', 'AUT', 'SVK', 'HUN', 'EST', 'FIN']);
const COMP_POINTS = [20, 18, 16, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function compOf(ev) { return ev.comp === 'TOUR' ? { name: ev.name, short: ev.name, group: 'turnieje', format: 'ind', field: 'open' } : COMPS[ev.comp]; }
function compKey(ev) { return ev.comp === 'TOUR' ? `T:${nameSlug(ev.name.replace(/\d+/g, '').replace(/\b[IVXL]+\b\.?/g, ''))}` : ev.comp; }
function compName(key) { return key.startsWith('T:') ? (Object.values(G.events).find(e => compKey(e) === key) || {}).name || key : (COMPS[key] || {}).name || key; }

// ---------- Tworzenie wydarzeń sezonu ----------
// Sezon z kalendarzem rzeczywistym: daty GKSŻ/FIM; kolejne sezony: te same imprezy przesunięte o 52 tygodnie
function makeCompEvents(season) {
  if (!CAL) return;
  if (typeof makeMiniEvents === 'function') makeMiniEvents(season);
  G.compEventsMade = G.compEventsMade || {};
  if (G.compEventsMade[season]) return;
  G.compEventsMade[season] = true;
  const shift = (season - CAL.season) * 364;
  // kolejne sezony (daty przesunięte o 52 tygodnie): zawody krajowe nie w dniu rundy Grand Prix – przesunięte na najbliższy wolny dzień
  const gpDays = new Set(shift ? Object.values(G.events).filter(e => e.kind === 'sgp' && e.season === season).map(e => e.date) : []);
  const leagueDays = new Set(shift ? Object.values(G.fixtures).filter(f => f.season === season).map(f => f.date) : []);
  const add = (key, d0, name, place, comp, extra = {}) => {
    let d = addDays(d0, shift);
    if (gpDays.size && gpMovable(comp)) d = freeCompDay(d, comp, gpDays, leagueDays);
    if (d < G.date) return;
    const id = `C${season}-${key}`;
    G.events[id] = { id, kind: 'comp', comp, season, date: d, venue: place || '', name, played: false, calKey: key, ...extra };
  };
  CAL.events.forEach((e, i) => {
    const rule = EVENT_RULES.find(([re]) => re.test(e.name));
    if (!rule || !rule[1]) return;
    if (rule[1] === 'DMPJ' && typeof makeDmpjEvents === 'function') return; // DMPJ: grupy i fazy z regulaminu (js/dmpj.js)
    const m = e.name.match(rule[0]);
    const round = m && m[m.length - 1] && /^\d+$/.test(m[m.length - 1]) ? Number(m[m.length - 1]) : null;
    const stage = /Finał|Final/.test(e.name) ? 'finał' : /1\/2/.test(e.name) ? 'półfinał' : /1\/4/.test(e.name) ? 'ćwierćfinał' : /SF\d?/.test(e.name) ? 'półfinał' : /QR|Challenge|Eliminacje/.test(e.name) ? 'eliminacje' : null;
    // jeden wpis kalendarza z kilkoma miastami (np. eliminacje IMP) = osobne zawody w każdym z nich
    const places = (e.place || '').split(/\s*,\s*/).filter(Boolean);
    if (places.length > 1) places.forEach((p, j) => add(`e${i}-${j}`, e.d, `${e.name} (${p})`, p, rule[1], { round, stage }));
    else add(`e${i}`, e.d, e.name, e.place, rule[1], { round, stage });
  });
  CAL.fim.forEach((e, j) => {
    const comp = FIM_SERIES_COMP[e.series];
    if (!comp) return;
    add(`f${j}`, e.d, `${COMPS[comp].short} – ${e.stage}${e.venue ? ` (${e.venue})` : ''}`, e.venue, comp, { round: e.round, stage: /finał/.test(e.stage) ? 'finał' : /półfinał/.test(e.stage) ? 'półfinał' : null, time: e.time });
  });
  if (typeof makeDmpjEvents === 'function') makeDmpjEvents(season, shift, add);
  // numeracja rund w cyklach bez numeru w nazwie (DMPJ, Puchar GKSŻ, szkoleniowe…)
  const byComp = {};
  for (const ev of Object.values(G.events).filter(x => x.season === season && x.kind === 'comp')) (byComp[compKey(ev)] = byComp[compKey(ev)] || []).push(ev);
  for (const list of Object.values(byComp)) list.sort(by(x => x.date)).forEach((ev, i) => { if (ev.round == null) ev.round = i + 1; ev.of = list.length; });
}

// Zawody, które nie mogą pokrywać się z rundą Grand Prix: krajowe, turnieje, mistrzostwa innych krajów i europejskie (IME – startują zawodnicy
// spoza stałej obsady GP); bez cykli FIM rozgrywanych przy GP (SGP2–4, DPŚ) i bez zawodów młodzieżowych
const gpMovable = comp => !!COMPS[comp] && !['swiat', 'mlodziez', 'mini'].includes(COMPS[comp].group);
// Mistrzostwa Polski seniorów (IMP, Złoty Kask, MPPK…) nie w dniu kolejki ligowej – jeżdżą w nich zawodnicy wszystkich klubów
const leagueFree = comp => !!COMPS[comp] && COMPS[comp].group === 'polska';
// Najbliższy dzień bez rundy GP (i dla mistrzostw Polski – bez meczów ligowych; szukanie do 10 dni, potem wystarczy dzień bez GP)
function freeCompDay(d, comp, gpDays, leagueDays) {
  if (leagueFree(comp)) for (let k = 0, x = d; k <= 10; k++, x = addDays(x, 1)) if (!gpDays.has(x) && !leagueDays.has(x)) return x;
  while (gpDays.has(d)) d = addDays(d, 1);
  return d;
}
// Zapisy: nierozegrane zawody krajowe w dniu rundy Grand Prix (sezony z datami przesuniętymi) – na najbliższy wolny dzień
function fixGpClashes() {
  const gp = new Set(Object.values(G.events).filter(e => e.kind === 'sgp' && !e.played).map(e => e.date));
  const leagueDays = new Set(Object.values(G.fixtures).filter(f => !f.played).map(f => f.date));
  let n = 0;
  for (const ev of Object.values(G.events)) {
    if (ev.kind !== 'comp' || ev.played || ev.date <= G.date || !(gp.has(ev.date) || (leagueFree(ev.comp) && leagueDays.has(ev.date))) || !gpMovable(ev.comp) || ev.season === CAL.season) continue;
    const d = freeCompDay(ev.date, ev.comp, gp, leagueDays);
    if (d !== ev.date) { ev.date = d; n++; }
  }
  return n > 0;
}
// ---------- Uczestnicy ----------
const ageIn = (r, season) => season - Number(r.born.slice(0, 4));
let KID_CACHE = new Map();
function kidRider(k) {
  if (KID_CACHE.has(k.id)) return KID_CACHE.get(k.id);
  if (k.ca == null) initKidAbility(k, null);
  // adept jedzie w swojej klasie pojemności: poziom = CA / 5 (te same atrybuty co seniorzy)
  const r = { id: k.id, name: k.name, country: k.country, born: k.born, clubId: k.clubId, kid: true, cat: k.cat, skill: k.ca / 5, ca: k.ca, pa: k.pa,
    attrs: k.attrs, hidden: k.hidden, cond: 100, form: 0, equip: genEquipment(clamp(3 + k.ca / 10, 3, 9), 16) };
  KID_CACHE.set(k.id, r);
  return r;
}
// Prawo startu w mistrzostwach Polski: obywatelstwo polskie (bez podwójnego obywatelstwa)
const polEligible = r => !!r && r.country === 'POL'; // kraj macierzysty Polska (drugie obywatelstwo polskie – tylko liga)
// Zawodnicy zajęci danego dnia: inne zawody (lista startowa, składy, wynik) i mecze ligowe klubów
function busyOn(date, exceptId) {
  const ids = new Set();
  for (const e of Object.values(G.events)) {
    if (e.date !== date || e.id === exceptId) continue;
    const m = e.played && G.matches[e.matchId];
    if (m && m.riders) Object.keys(m.riders).forEach(id => ids.add(String(id)));
    else if (e.kind === 'sgp' && G.sgp) { G.sgp.riders.slice(0, 15).forEach(id => ids.add(String(id))); if (e.sgpExtras) [e.sgpExtras.wildcard, ...e.sgpExtras.trackReserves].forEach(id => id != null && ids.add(String(id))); } // stali + dzika karta i rezerwy toru rundy
    (e.startList || []).forEach(x => ids.add(String(x.id)));
    if (!e.played) (e.reserves || []).forEach(id => ids.add(String(id))); // rezerwowy jednych zawodów nie jest zgłaszany do innych tego dnia
    (e.units || []).forEach(u => u.riders.forEach(id => ids.add(String(id))));
  }
  for (const f of Object.values(G.fixtures)) if (f.date === date) for (const c of [f.homeId, f.awayId]) clubRiders(c).forEach(r => ids.add(String(r.id)));
  if (typeof fBusyOn === 'function') fBusyOn(date).forEach(id => ids.add(id)); // ligi zagraniczne rozegrane tego dnia (js/foreign.js)
  return ids;
}
const R = id => G.riders[id] || (G.academy[id] ? kidRider(G.academy[id]) : (G.kidAlias && G.riders[G.kidAlias[id]]) || null);
// Zawody z udziałem zawodników U-21 (i młodszych klas) – jedyne dostępne dla licencjonowanych przed 16. urodzinami
const u21Comp = ev => ev.kind === 'comp' && /U21|U19|u21|u19|u17|kids|mini/i.test(compOf(ev).field || '');
const ageOkFor = (ev, id) => u21Comp(ev) || !G.riders[id] || !u16(G.riders[id], ev.date);
// Limit wieku zawodów (rocznikowo w sezonie): uzupełnianie list, awans z eliminacji i stałe listy cykli nie mogą go łamać
const FIELD_MAX_AGE = { u21Qual: 21, u21: 21, polU21: 21, polU21Elim: 21, polU21Reserve: 21, polU19: 19, polU19Elim: 19, u19: 19, euroU19: 19, u17: 17, euroU24: 24 };
const ageLimitOk = (ev, id) => { const lim = FIELD_MAX_AGE[compOf(ev).field], r = G.riders[id]; return !lim || !r || ageIn(r, ev.season) <= lim; };
function pool(date) { return Object.values(G.riders).filter(r => r.active && !r.retired && available(r, date)).sort(by(r => r.skill, -1)); }
// starty adeptów w zawodach – tylko z licencją swojej klasy (trening w wyższej klasie jest możliwy wcześniej, js/kid-licence.js)
function kids(cats, clubFilter) { return Object.values(G.academy).filter(k => !k.catalogOnly && !k.retired && cats.includes(k.cat) && (typeof kidCanRace !== 'function' || kidCanRace(k)) && (!clubFilter || (G.clubs[k.clubId] && clubFilter(G.clubs[k.clubId])))).sort(by(k => k.ca ?? k.ability, -1)); }
function take(list, n, fill) { const out = list.slice(0, n).map(x => x.id); for (const x of fill || []) { if (out.length >= n) break; if (!out.includes(x.id)) out.push(x.id); } return out; }

// Zawody międzynarodowe: zawodnicy jeżdżący w lidze (Polacy muszą mieć klub), limit zawodników z jednego kraju
function intlPool(list) { return list.filter(r => r.clubId || r.country !== 'POL'); }
function quota(list, max) { const n = {}; return list.filter(r => (n[r.country] = (n[r.country] || 0) + 1) <= max); }
function indField(ev) {
  const capacity = eventFieldSize(ev);
  const s = ev.season, P0 = pool(ev.date);
  const sgp = new Set(G.sgp ? G.sgp.riders : []);
  const busy = ev.id ? busyOn(ev.date, ev.id) : new Set();
  const fim = isFimEvent(ev), kidsF = (c, cf) => kids(c, cf).filter(k => !(fim && fimSuspended(k.country, ev.date))); // zawieszenia FIM (js/nationality.js)
  const P = P0.filter(r => !busy.has(String(r.id)) && ageOkFor(ev, r.id) && !(fim && fimSuspended(r.country, ev.date)) && !(ev._qx && ev._qx(r.id)));
  // mistrzostwa Polski: tylko polscy zawodnicy z przynależnością klubową
  const pol = P.filter(r => polEligible(r) && r.clubId);
  const age = r => ageIn(r, s);
  const host = new Set(Object.values(G.clubs).filter(c => ev.venue && c.city && ev.venue.includes(c.city.replace(' Wlkp.', ''))).map(c => c.id));
  const rr = mulberry(hashStr(ev.id + G.seed));
  // eliminacje w kilku miastach tego samego dnia: zawodnicy klubu gospodarza najpierw u siebie
  const hostFirst = list => list.filter(r => host.has(r.clubId)).concat(list.filter(r => !host.has(r.clubId)));
  const f = compOf(ev).field;
  if (/^nat:/.test(f || '') && typeof natField === 'function') return natField(ev, P, capacity); // mistrzostwa krajowe (js/foreign.js)
  if (/^fkids:/.test(f || '') && typeof fKidsField === 'function') return fKidsField(ev, capacity); // zawody młodzieżowe za granicą (js/foreign.js)
  switch (f) {
    case 'mini': return typeof miniIndField === 'function' ? miniIndField(ev, capacity) : take(miniField().sort(by(k => k.ca ?? k.ability, -1)), capacity); // regulaminy 85–140 (js/mini-rules.js)
    case 'sgp': return gpField(ev);
    case 'sgpQual': return take(quota(intlPool(P).filter(r => !sgp.has(r.id)).slice(0, 60), 3).sort(() => rr() - 0.5), capacity, intlPool(P));
    case 'u21Qual': return take(quota(intlPool(P).filter(r => age(r) <= 21).slice(8, 70), 3).sort(() => rr() - 0.5), capacity, intlPool(P).filter(r => age(r) <= 21));
    case 'pol': return take(pol, capacity, pol);
    case 'polChallenge': return take(pol.slice(8), capacity, P);
    case 'polElim': return take(hostFirst(pol.slice(20, 80).sort(() => rr() - 0.5)), capacity, pol.slice(20));
    case 'polU21': return take(pol.filter(r => age(r) <= 21), capacity, pol.filter(r => age(r) <= 21));
    // Turnieje Zaplecza Kadry Juniorów: juniorzy spoza listy powołanych do kadry juniorów (js/nations.js)
    case 'polU21Reserve': { const ex = typeof tzkjExcluded === 'function' ? tzkjExcluded(s) : new Set(), l = pol.filter(r => age(r) <= 21 && !ex.has(String(r.id))); return take(l, capacity, l); }
    case 'polU21Elim': return take(hostFirst(pol.filter(r => age(r) <= 21).slice(6).sort(() => rr() - 0.5)), capacity, pol.filter(r => age(r) <= 21));
    case 'polU19': return take(pol.filter(r => age(r) <= 19), capacity, kidsF(['c500']));
    case 'polU19Elim': return take(hostFirst(pol.filter(r => age(r) <= 19).slice(5)), capacity, kidsF(['c500']));
    case 'u21': return take(quota(intlPool(P).filter(r => age(r) <= 21), 5), capacity, intlPool(P).filter(r => age(r) <= 21));
    // IP2E U19 / IPE U17: krajowi z licencją „Ż” klubów ligowych (art. 1211, 1201) – bez adeptów 500R
    case 'u19': return take(youthLicensed(P, 19, s), capacity);
    case 'u17': return take(youthLicensed(P, 17, s), capacity);
    case 'euroU19': return take(quota(intlPool(P).filter(r => age(r) <= 19 && EUROPE_CC.has(r.country)), 4), capacity, kidsF(['c500']));
    case 'euroU24': return take(quota(intlPool(P).filter(r => age(r) <= 24 && EUROPE_CC.has(r.country) && !sgp.has(r.id)).slice(4), 4), capacity, intlPool(P).filter(r => age(r) <= 24 && EUROPE_CC.has(r.country)));
    case 'europe': return take(quota(intlPool(P).filter(r => EUROPE_CC.has(r.country) && !sgp.has(r.id)), 4), capacity, intlPool(P));
    case 'europeQual': return take(quota(intlPool(P).filter(r => EUROPE_CC.has(r.country) && !sgp.has(r.id) && age(r) >= 19).slice(14, 90), 3).sort(() => rr() - 0.5), capacity, intlPool(P));
    case 'kids500': return typeof kids500Field === 'function' ? kids500Field(ev, capacity).filter(id => !(fim && fimSuspended((G.academy[id] || {}).country, ev.date))) : take(kidsF(['c500']), capacity, kidsF(['c250'])); // IPE 500R, Puchar GKSŻ, IMP 500R
    case 'kids250': return take(kidsF(['c250']), capacity, kidsF(['c85', 'c500']));
    case 'kids125': return take(kidsF(['c85']), capacity, kidsF(['c50']));
    case 'kidsMix': return take(kidsF(['c500']).slice(0, 8).concat(P.filter(r => age(r) <= 18).slice(-8)), capacity, kidsF(['c250']));
    case 'openLower': return take(P.slice(60, 200).sort(() => rr() - 0.5), capacity, P);
    default: return take(P.slice(0, 70).map(r => ({ id: r.id, k: r.skill + (host.has(r.clubId) ? 1.5 : 0) + rr() * 2.5 })).sort(by(x => x.k, -1)), capacity, P);
  }
}
// Ekstraliga U24 (kluby AI): zawodnicy regularnie jeżdżący w lidze (numery 1–7 składu ligowego) tylko uzupełniają braki;
// najpierw jadą młodzi obcokrajowcy na testach i juniorzy spoza pierwszego składu
// Średnia biegowa w lidze w poprzednim sezonie (gra; na starcie – historia PSD), co najmniej 10 biegów
function prevLeagueAvg(r, season) {
  const st = r.stats && r.stats[season - 1];
  if (st && st.heats >= 10) return (st.pts + st.bonus) / st.heats;
  const h = typeof RIDER_HIST !== 'undefined' && (RIDER_HIST.riders[r.psdSlug] || RIDER_HIST.riders[nameSlug(r.name)]);
  const ss = h ? h.seasons.filter(x => x.season === season - 1 && x.leagueCode !== 'U24') : [];
  const heats = sum(ss.map(x => x.heats || 0));
  return heats >= 10 ? sum(ss.map(x => (x.pts || 0) + (x.bonus || 0))) / heats : null;
}
// Ekstraliga U24 (regulamin): zawodnicy do 24 lat z kadr PGE, z wyjątkiem tych ze średnią ≥ 1,400 w poprzednim sezonie
function u24eEligible(r, season = sportSeason()) {
  if (ageIn(r, season) > 24) return false;
  const a = prevLeagueAvg(r, season);
  return a == null || a < 1.4;
}
// Skład U24E: co najmniej 2 Polaków i 2 obcokrajowców (jeśli klub ich ma); kolejność wyboru zachowana
function u24Mix(rs, size) {
  const pick = [...rs.filter(isDomestic).slice(0, 2), ...rs.filter(r => !isDomestic(r)).slice(0, 2)];
  for (const r of rs) { if (pick.length >= size) break; if (!pick.includes(r)) pick.push(r); }
  return [...rs.filter(r => pick.includes(r)), ...rs.filter(r => !pick.includes(r))];
}
function u24Order(c, rs) {
  const regular = new Set(autoLineup(c.id).slice(0, 7).filter(Boolean).map(String));
  const score = r => r.skill + (!hasNat(r, 'POL') ? 0.8 : 0);
  const out = rs.filter(r => !regular.has(String(r.id))).sort(by(score, -1));
  return out.concat(rs.filter(r => regular.has(String(r.id))).sort(by(score, -1)));
}
// Drużyny/pary: { key, name, clubId?, country?, riders: [ids] }
function teamUnits(ev, size) {
  const busy = busyOn(ev.date, ev.id);
  const fim = isFimEvent(ev), kidsF = (c, cf) => kids(c, cf).filter(k => !(fim && fimSuspended(k.country, ev.date))); // zawieszenia FIM (js/nationality.js)
  const s = ev.season, P = pool(ev.date).filter(r => !busy.has(String(r.id)) && ageOkFor(ev, r.id) && !(fim && fimSuspended(r.country, ev.date))), f = compOf(ev).field;
  const age = r => ageIn(r, s);
  const byClub = (filter, clubs, order, mix) => Object.values(G.clubs).filter(c => clubActive(c) && (!clubs || clubs(c))).map(c => {
    let rs = P.filter(r => r.clubId === c.id && filter(r));
    // klub gracza: skład wybrany w Taktyce (Ekstraliga U24, DMPJ), braki uzupełniają najlepsi uprawnieni
    const mine = c.id === G.clubId && G.compLineups && G.compLineups[ev.comp];
    if (mine) { const pref = mine.map(id => rs.find(r => r.id === id)).filter(Boolean); rs = [...pref, ...rs.filter(r => !pref.includes(r))]; }
    else if (order) rs = order(c, rs);
    if (mix) rs = mix(rs, size);
    return { key: c.short, name: c.name, clubId: c.id, riders: rs.slice(0, size).map(r => r.id), str: sum(rs.slice(0, size).map(r => r.skill)) };
  }).filter(u => u.riders.length >= Math.min(2, size));
  const byKids = (cats, clubs) => Object.values(G.clubs).filter(c => clubActive(c) && (!clubs || clubs(c))).map(c => {
    const ks = kidsF(cats, x => x.id === c.id);
    return { key: c.short, name: c.name, clubId: c.id, riders: ks.slice(0, size).map(k => k.id), str: sum(ks.slice(0, size).map(k => k.ca ?? k.ability)) };
  }).filter(u => u.riders.length >= 2);
  const byNation = (filter, junior) => {
    const m = {};
    for (const r of P.filter(filter)) (m[r.country] = m[r.country] || []).push(r);
    // powołani do kadry (seniorów / juniorów) jadą najpierw (js/nations.js)
    if (typeof squadOf === 'function') for (const [cc, rs] of Object.entries(m)) { const sq = squadOf(cc, s), ids = new Set((junior ? sq.jun : sq.sen).map(String)); m[cc] = [...rs.filter(r => ids.has(String(r.id))), ...rs.filter(r => !ids.has(String(r.id)))]; }
    return Object.entries(m).map(([cc, rs]) => ({ key: cc, name: COUNTRY[cc] || cc, country: cc, riders: rs.slice(0, size).map(r => r.id), str: sum(rs.slice(0, size).map(r => r.skill)) }))
      .filter(u => u.riders.length >= Math.min(2, size));
  };
  // pary lig zagranicznych (js/foreign.js): dostępność bez polskich zawieszeń (np. Rosjanie w Pucharze Rosji), jak mistrzostwa krajowe
  if (/^fpairs:/.test(f || '') && typeof fPairUnits === 'function') return fPairUnits(ev, Object.values(G.riders).filter(r => r.active && !r.retired && fFree(r, ev.date) && !busy.has(String(r.id)) && ageOkFor(ev, r.id)).sort(by(r => r.skill, -1)), size);
  switch (f) {
    case 'miniTeams': return miniUnits(size, s, typeof miniDomestic === 'function' ? miniDomestic : null); // tylko zawodnicy krajowi (art. 901 ust. 7)
    case 'clubs': return ev.comp === 'MPPK' && typeof mppkOrder === 'function' ? byClub(() => true, null, mppkOrder) : byClub(r => polEligible(r), c => c.league !== 'KLZ');
    case 'clubsU21': return byClub(r => age(r) <= 21 && polEligible(r));
    case 'clubsU24': return byClub(r => u24eEligible(r, s), c => c.league === 'PGE', u24Order, u24Mix);
    case 'clubsKids250': return byKids(['c250']);
    case 'kids500PGE': return byKids(['c500', 'c250'], c => c.league === 'PGE');
    case 'kids500_2E': return byKids(['c500', 'c250'], c => c.league === '2E');
    case 'nations': return byNation(() => true);
    case 'nationsU21': return byNation(r => age(r) <= 21, true);
    case 'nationsEU': return byNation(r => EUROPE_CC.has(r.country));
    case 'nationsEU24': return byNation(r => EUROPE_CC.has(r.country) && age(r) <= 24);
    case 'nationsEU19': return byNation(r => EUROPE_CC.has(r.country) && age(r) <= 19, true);
    case 'national': {
      const sqIds = typeof squadOf === 'function' ? new Set(squadOf('POL', s).sen.map(String)) : new Set();
      const polAll = P.filter(polEligible), pol = [...polAll.filter(r => sqIds.has(String(r.id))), ...polAll.filter(r => !sqIds.has(String(r.id)))].slice(0, size), rest = P.filter(r => !polEligible(r)).slice(0, size);
      return [{ key: 'POL', name: 'Polska', country: 'POL', riders: pol.map(r => r.id), str: 1 }, { key: 'ROW', name: 'Reszta Świata', country: 'UNK', riders: rest.map(r => r.id), str: 0 }];
    }
    default: return [];
  }
}
// Wybór uczestników rundy (np. półfinały DPŚ, rotacja drużyn w DMPJ)
function pickUnits(ev, units, n) {
  if (/^MINI_/.test(ev.comp) && typeof miniPickUnits === 'function') { const u = miniPickUnits(ev, units, n); if (u) return u; } // grupy, finały, DPE (js/mini-rules.js)
  const sorted = units.slice().sort(by(u => u.str, -1));
  if (ev.comp === 'REP') return units;
  if (ev.comp === 'DMPJ' && ev.dmpj && typeof dmpjUnits === 'function') return dmpjUnits(ev, units); // grupy DMPJ (js/dmpj.js)
  if (ev.comp === 'MPPK' && typeof mppkFinalUnits === 'function') return mppkFinalUnits(ev, units, n); // regulamin MPPK (js/qualification.js)
  if (['SWC', 'ETC', 'EU24T'].includes(ev.comp)) {
    const st = ev.stage;
    if (st === 'półfinał') { const k = (ev.round || 1) % 2; return sorted.filter((u, i) => i >= 2 && i % 2 === k).slice(0, n); }
    if (st === 'eliminacje') return sorted.slice(4, 4 + n);
    const prev = [...new Set(Object.values(G.events).filter(x => x.comp === ev.comp && x.season === ev.season && x.played && x.id !== ev.id && x.date < ev.date).map(x => x.winner))];
    const qualified = prev.map(k => units.find(u => u.key === k)).filter(Boolean).slice(0,n);
    return [...sorted.filter(u => !qualified.some(q => q.key === u.key)).slice(0,n-qualified.length), ...qualified];
  }
  if (ev.stage === 'finał' || ev.stage === 'półfinał') return sorted.slice(0, n);
  // rotacja w rundach cyklu – każda drużyna jedzie co kilka rund
  const off = ((ev.round || 1) - 1) * n;
  const out = [];
  for (let i = 0; i < n && sorted.length; i++) out.push(sorted[(off + i) % sorted.length]);
  return [...new Map(out.map(u => [u.key, u])).values()];
}

// ---------- Listy startowe ----------
// Awans z zawodów kwalifikacyjnych: z każdych rozegranych zawodów źródłowych awansuje `top` zawodników
const QUALIFY = {
  IMPC: { from: 'IMPE', top: 6, label: 'awans z eliminacji IMP' },
  IMP: { from: 'IMPC', top: 6, label: 'awans z IMP Challenge' },
  SK: { from: 'SKE', top: 8, label: 'awans z eliminacji' },
  BK: { from: 'BKE', top: 8, label: 'awans z eliminacji' },
  MIMP: { from: 'MIMPE', top: 8, label: 'awans z eliminacji' },
  SEC: { from: 'SECQ', top: 7, onlyStage: /ECC/, label: 'awans z ECC' },
  SGP2: { from: 'SGP2Q', top: 5, label: 'awans z kwalifikacji' },
};
// Cykle, w których lista startowa jest stała na wszystkie rundy
const FIXED_FIELD = new Set(['IMP', 'SEC', 'SGP2']);
const INTL_GROUPS = new Set(['swiat', 'europa']);
function isIntl(ev) { return ev.kind === 'sgp' || INTL_GROUPS.has(compOf(ev).group); }
function announceDate(ev) {
  const c = compOf(ev);
  const days = ev.kind === 'sgp' ? 60 : c.format === 'team' || c.format === 'pairs' ? 3 : c.group === 'mlodziez' ? 7 : 14;
  let d = addDays(ev.date, -days);
  // zawody z kwalifikacjami: lista dzień po ostatnich zawodach eliminacyjnych
  const q = QUALIFY[ev.comp];
  const src = Object.values(G.events).filter(x => (q ? x.comp === q.from && (!q.onlyStage || q.onlyStage.test(x.name)) : ev.comp === 'SECQ' && /ECC/.test(ev.name) && x.comp === 'SECQ' && /QR/.test(x.name)) && x.season === ev.season && x.date < ev.date);
  if (typeof qualSources === 'function') src.push(...qualSources(ev)); // reguły kwalifikacji (js/qualification.js)
  for (const x of src) if (addDays(x.date, 1) > d) d = addDays(x.date, 1);
  return d < ev.date ? d : addDays(ev.date, -1);
}
function seededLabel(ev) {
  const c = compOf(ev);
  if (QUALIFY[ev.comp]) return 'rozstawienie / nominacja';
  if (c.group === 'turnieje') return 'zaproszenie organizatora';
  if (c.group === 'mlodziez') return 'zgłoszenie klubu';
  if (isIntl(ev)) return 'nominacja federacji';
  // mistrzostwa innych krajów (js/foreign.js): nominuje federacja tego kraju, nie GKSŻ
  const cc = c.cc || ev.cc;
  if (cc && cc !== 'POL') {
    const fed = typeof NATION_INFO !== 'undefined' && NATION_INFO[cc] ? NATION_INFO[cc].fed : null;
    return fed ? `nominacja ${(fed.match(/\(([^)]+)\)\s*$/) || [, fed])[1]}` : 'nominacja federacji krajowej';
  }
  return 'nominacja GKSŻ';
}
// Ilu zawodników awansuje z każdych zawodów źródłowych: przy kilku eliminacjach (np. w czterech miastach) mniej z każdych, łącznie ok. 2 × top
function qualTop(q, season, before) {
  const n = Object.values(G.events).filter(x => x.comp === q.from && x.season === season && x.date < before && (!q.onlyStage || q.onlyStage.test(x.name))).length;
  return n > 1 ? Math.max(2, Math.round(q.top * 2 / n)) : q.top;
}
// Awans z zawodów `ev`: { top, to, target } – do kolejnej rundy (QUALIFY) albo z rund kwalifikacyjnych IME do ECC
function advanceInfo(ev) {
  for (const [to, q] of Object.entries(QUALIFY)) {
    if (q.from !== ev.comp || (q.onlyStage && !q.onlyStage.test(ev.name))) continue;
    const target = Object.values(G.events).filter(x => x.comp === to && x.season === ev.season && x.date > ev.date).sort(by(x => x.date))[0];
    return { top: qualTop(q, ev.season, target ? target.date : '9999'), to: COMPS[to].name, target };
  }
  if (ev.comp === 'SECQ' && /QR/.test(ev.name)) {
    const target = Object.values(G.events).filter(x => x.comp === 'SECQ' && /ECC/.test(x.name) && x.season === ev.season && x.date > ev.date)[0];
    return { top: 4, to: 'SEC Challenge (ECC)', target };
  }
  return null;
}
function qualifiersFor(ev) {
  const q = QUALIFY[ev.comp];
  if (!q) return [];
  const src = Object.values(G.events).filter(x => x.comp === q.from && x.season === ev.season && x.played && !x.cancelled && x.date < ev.date && (!q.onlyStage || q.onlyStage.test(x.name)))
    .sort(by(x => x.date));
  const out = [];
  const top = qualTop(q, ev.season, ev.date);
  for (const x of src) {
    const m = G.matches[x.matchId];
    if (!m || !m.classification) continue;
    for (const c of m.classification.slice(0, top)) if (!out.some(o => o.id === c.riderId) && R(c.riderId)) out.push({ id: c.riderId, via: `${q.label} (${c.place}. m.)` });
  }
  return out;
}
function secQualifiers(ev) {
  // ECC: po 4 najlepszych z każdej rundy kwalifikacyjnej IME
  if (ev.comp !== 'SECQ' || !/ECC/.test(ev.name)) return [];
  const out = [];
  for (const x of Object.values(G.events).filter(x => x.comp === 'SECQ' && x.season === ev.season && x.played && /QR/.test(x.name)).sort(by(x => x.date))) {
    const m = G.matches[x.matchId];
    if (m && m.classification) for (const c of m.classification.slice(0, 4)) if (!out.some(o => o.id === c.riderId)) out.push({ id: c.riderId, via: `awans z ${x.name.match(/QR\d/)[0]} (${c.place}. m.)` });
  }
  return out;
}
// Losowanie numerów startowych po ustaleniu obsady (kolejność obsady – awans, gospodarze, nominacje – nie wyznacza numerów)
function drawStartNumbers(ev) {
  if (!ev.startList || ev.startList.length < 2) return;
  const rr = mulberry(hashStr(`${ev.id}:${G.seed}:numery`)), l = ev.startList;
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  ev.drawn = true;
}
// Zapisy sprzed losowania: nierozegrane zawody z ogłoszoną listą dostają wylosowane numery
function drawPendingNumbers() {
  let n = 0;
  for (const ev of Object.values(G.events)) if (ev.kind === 'comp' && !ev.played && ev.startList && !ev.drawn) { drawStartNumbers(ev); n++; }
  return n > 0;
}
function buildStartList(ev) {
  const c = compOf(ev), capacity = eventFieldSize(ev);
  if (c.format !== 'ind') {
    if (c.format === 'exam') return;
    const ht = eventHeatTable(ev);
    const units = teamUnits(ev, ht ? heatRegularSlots(ht) + 1 : c.format === 'pairs' ? 3 : 5).filter(u => u.riders.length);
    ev.units = pickUnits(ev, units, ht?.teams || (c.format === 'pairs' ? 7 : ev.comp === 'REP' ? 2 : 4)).map(u => ({ key: u.key, name: u.name, clubId: u.clubId || null, country: u.country || null, riders: u.riders }));
    if (ev.comp === 'ETC') for (const u of ev.units) {
      const junior = pool(ev.date).find(r => r.country === u.country && ageIn(r, ev.season) <= 21 && !u16(r, ev.date) && !u.riders.slice(0,4).includes(r.id) && !busyOn(ev.date, ev.id).has(String(r.id)));
      u.riders[4] = junior?.id || null;
    }
    ev.heatProgramVersion = SPEEDWAY_HEAT_TABLES.schemaVersion;
    ev.announced = G.date;
    return;
  }
  // memoriały i turnieje: obsada z zaproszeń organizatora (js/memorial.js)
  if (typeof orgStartList === 'function' && orgStartList(ev)) { drawStartNumbers(ev); ev.heatProgramVersion = SPEEDWAY_HEAT_TABLES.schemaVersion; ev.announced = G.date; return; }
  if (FIXED_FIELD.has(ev.comp)) {
    const prev = Object.values(G.events).filter(x => x.comp === ev.comp && x.season === ev.season && x.startList && x.id !== ev.id).sort(by(x => x.date))[0];
    if (prev) {
      // dzika karta rundy (wc) nie przechodzi na kolejne rundy cyklu – nominuje ją federacja kolejnego gospodarza
      const sl = typeof qualEventSlots === 'function' ? qualEventSlots(ev) : null;
      ev.startList = prev.startList.filter(x => !x.wc && ageLimitOk(ev, x.id)).map(x => ({ ...x })); ev.reserves = (prev.reserves || []).filter(id => ageLimitOk(ev, id));
      for (const id of indField(ev)) { if (ev.startList.length >= capacity - (sl ? sl.wc : 0)) break; if (!ev.startList.some(x => String(x.id) === String(id))) ev.startList.push({ id, via: seededLabel(ev) }); }
      if (sl) addEventExtras(ev, capacity);
      const ql = typeof qualEntrants === 'function' ? qualEntrants(ev) : null;
      if (ql && (qualStage(ev).stage.entrants || []).some(e => e.type === 'host' && e.rule === 'hostClubRider')) qualHostFix(ev, ev.startList, ql.sources);
      drawStartNumbers(ev); // ta sama obsada cyklu, numery losowane na każdą rundę
      ev.announced = G.date; return;
    }
  }
  const busy = busyOn(ev.date, ev.id);
  const ql = typeof qualEntrants === 'function' ? qualEntrants(ev) : null; // reguły kwalifikacji i nominacji (js/qualification.js)
  const list = (ql ? ql.list : [...qualifiersFor(ev), ...secQualifiers(ev)]).filter(x => !busy.has(String(x.id)) && ageOkFor(ev, x.id) && ageLimitOk(ev, x.id)).slice(0, capacity);
  const blocked = id => !!ql && (ql.exclude.has(String(id)) || (R(id) && ql.closed.has(R(id).country))); // np. stali uczestnicy SGP w eliminacjach SEC, Polacy spoza nominacji GKSŻ
  if (ql) ev._qx = blocked;
  const seeded = indField(ev).filter(id => !list.some(x => String(x.id) === String(id)) && !blocked(id));
  const lab = (ql && typeof qualFillLabel === 'function' && qualFillLabel(ev)) || seededLabel(ev);
  // cykl z dziką kartą na rundę (SGP2): stałych nominacji tyle, ile w regulaminie; pozostałe wolne miejsca – uzupełnienie listy
  const sl = ql && typeof qualEventSlots === 'function' ? qualEventSlots(ev) : null;
  let nom = sl ? sl.nom : Infinity;
  for (const id of seeded) { if (list.length >= capacity - (sl ? sl.wc : 0)) break; list.push({ id, via: nom-- > 0 ? lab : 'uzupełnienie listy do formatu zawodów' }); }
  const reservePool = indField({ ...ev, id: ev.id + 'R' }).filter(id => !list.some(x => String(x.id) === String(id)) && !blocked(id));
  delete ev._qx;
  ev.startList = list;
  ev.reserves = reservePool.slice(0, 2);
  if (sl) addEventExtras(ev, capacity);
  if (ql && ql.closed.size) ev.closedCc = [...ql.closed]; // dowołania w dniu zawodów: bez zawodników krajów z zamkniętą listą nominacji
  drawStartNumbers(ev);
  ev.heatProgramVersion = SPEEDWAY_HEAT_TABLES.schemaVersion;
  ev.announced = G.date;
}
// Dzika karta i rezerwy toru rundy od federacji gospodarza (js/qualification.js: qualEventExtras)
function addEventExtras(ev, capacity) {
  const ex = qualEventExtras(ev, ev.startList);
  if (!ex) return;
  for (const id of ex.wildcards) if (ev.startList.length < capacity) ev.startList.push({ id, via: ex.label, wc: true });
  if (ex.reserves.length) ev.reserves = ex.reserves.filter(id => !ev.startList.some(x => String(x.id) === String(id)));
  ev.reservesVia = `rezerwa toru – ${ex.label.replace(/^dzika karta – /, '')}`;
}
// Codziennie: ogłoszenie list startowych i składów zawodów, których termin ogłoszenia minął
function announceStartLists() {
  for (const ev of Object.values(G.events)) {
    if (ev.kind !== 'comp' || ev.played || ev.startList || ev.units) continue;
    if (!ev.announceOn) ev.announceOn = announceDate(ev); // termin ogłoszenia liczony raz
    if (G.date < ev.announceOn) continue;
    KID_CACHE = new Map();
    buildStartList(ev);
    // nasi zawodnicy na liście (z numerem startowym) lub w awizowanym składzie naszej drużyny
    const ours = ev.units ? ev.units.filter(u => u.clubId === G.clubId).flatMap(u => u.riders).filter(id => R(id)).map(id => ({ id }))
      : (ev.startList || []).map((x, i) => ({ id: x.id, no: i + 1 })).filter(x => R(x.id) && R(x.id).clubId === G.clubId);
    if (ours.length && compOf(ev).group !== 'turnieje') addMsg({ category: 'liga', from: compOf(ev).name, title: `${ev.name}: ${ev.units ? 'awizowane składy' : 'lista startowa'} (${fmtDateShort(ev.date)})`,
      body: `<p>Ogłoszono ${ev.units ? 'składy' : 'listę startową'} zawodów ${esc(ev.name)} (${fmtDay(ev.date)}${ev.venue ? `, ${esc(ev.venue)}` : ''}). ${ours.length > 1 ? 'Nasi zawodnicy' : 'Nasz zawodnik'}:</p><ul>${ours.map(x => `<li><a href="#/zawodnik/${x.id}">${esc(R(x.id).name)}</a>${x.no ? ` – nr ${x.no}` : ''}</li>`).join('')}</ul>${ev.startList && ev.startList.length > ours.length ? `<p class="small muted">Na liście ${ev.startList.length} zawodników${ev.reserves && ev.reserves.length ? ` + ${ev.reserves.length} rezerwowych` : ''}.</p>` : ''}`,
      people: ours.map(x => x.id), link: `#/gp/${ev.id}` });
  }
}
// Dostępność w dniu zawodów: mistrzostwa krajowe za granicą bez polskich zawieszeń FIM (plBanned dotyczy startów w Polsce)
const evAvailable = (ev, r) => /^(nat|fpairs|fkids):/.test(compOf(ev).field || '') && typeof fFree === 'function' ? fFree(r, ev.date) : available(r, ev.date);
// Obsada w dniu zawodów: lista startowa z rezerwowymi za niedostępnych zawodników
function dayField(ev) {
  if (!ev.startList) buildStartList(ev);
  if (!ev.heatProgramVersion && ev.startList.length < eventFieldSize(ev)) {
    for (const id of indField(ev)) {
      if (ev.startList.length >= eventFieldSize(ev)) break;
      if (!ev.startList.some(x => String(x.id) === String(id))) ev.startList.push({ id, via: 'uzupełnienie listy do formatu zawodów' });
    }
    ev.heatProgramVersion = SPEEDWAY_HEAT_TABLES.schemaVersion;
  }
  const busy = busyOn(ev.date, ev.id);
  const free = id => (!G.riders[id] || evAvailable(ev, G.riders[id])) && !busy.has(String(id)) && ageOkFor(ev, id) && ageLimitOk(ev, id);
  const res = (ev.reserves || []).filter(id => R(id) && free(id) && !ev.startList.some(x => String(x.id) === String(id))); // rezerwowy nie może już być na liście startowej
  const field = ev.startList.map(x => (!free(x.id) ? res.shift() || null : x.id));
  // rezerwowi wyczerpani: organizator dowołuje kolejnych uprawnionych zawodników, żeby stawka była pełna
  if (field.includes(null)) {
    const used = new Set([...field, ...(ev.reserves || [])].filter(id => id != null).map(String));
    const closed = new Set(ev.closedCc || []); // np. Polacy w kwalifikacjach SGP2 – tylko z nominacji GKSŻ
    const extra = indField({ ...ev, id: ev.id + 'L' }).filter(id => !used.has(String(id)) && free(id) && !(R(id) && closed.has(R(id).country)));
    for (let i = 0; i < field.length; i++) if (field[i] == null && extra.length) { field[i] = extra.shift(); (ev.lateCalls = ev.lateCalls || []).push(field[i]); }
  }
  return field;
}

// ---------- Silniki ----------
function compHeat(entries, ctx) { return runHeat(entries, ctx); }
function recordRider(rid, pts, heats, place) {
  const r = G.riders[rid];
  if (!r) { const k = G.academy[rid]; if (k) k.meets = (k.meets || 0) + 1; return; } // starty adepta: doświadczenie (tempo rozwoju) i znajomość przez kluby
  const st = r.stats[G.season] || (r.stats[G.season] = { m: 0, heats: 0, pts: 0, bonus: 0, w: 0, falls: 0, def: 0, exc: 0, gp: 0, gpPts: 0 });
  st.tourn = (st.tourn || 0) + 1;
  if (place === 1) st.tournWins = (st.tournWins || 0) + 1;
  r.form = clamp(r.form * 0.85 + (place && place <= 3 ? 0.2 : place > 12 ? -0.15 : 0), -2, 2);
}
function unitsMeeting(ev, units, perHeat) {
  const ht = eventHeatTable(ev, units.length);
  if (ht) return tableMeeting(ev, ht, null, units);
  // Explicit legacy fallback for competitions without a verified mapping.
  // perHeat: zawodników jednej jednostki w biegu (1 – czwórmecz, 2 – pary / mecz dwóch drużyn)
  const m = { id: `X${ev.id}`, kind: ev.kind, comp: ev.comp, eventId: ev.id, date: ev.date, venue: ev.venue, track: 350, weather: weatherFor(ev.date, G.seed + ev.id), heats: [], riders: {}, units: {}, done: false, heatTableFallback: 'Niezweryfikowany format zawodów: uproszczony program gry.' };
  eventTrack(m, ev); // js/track.js
  units.forEach(u => { m.units[u.key] = { key: u.key, name: u.name, clubId: u.clubId || null, country: u.country || null, riders: u.riders.slice(), pts: 0 }; u.riders.forEach(id => { m.riders[id] = { unit: u.key, pts: 0, bonus: 0, heats: 0, line: [] }; }); });
  const keys = units.map(u => u.key);
  const plan = [];
  if (perHeat === 1) {
    for (let s = 0; s < 4; s++) for (let k = 0; k < 4; k++) plan.push(keys.map((key, t) => ({ key, slot: (k + t * (s + 1)) % 4, gate: GATES[(t + k + s) % 4] })));
  } else if (keys.length === 2) {
    const combos = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
    for (let h = 0; h < 12; h++) { const a = combos[h % 6], b = combos[(h + 3) % 6]; plan.push([...a.map((sl, j) => ({ key: keys[0], slot: sl, gate: GATES[j * 2 + (h % 2)] })), ...b.map((sl, j) => ({ key: keys[1], slot: sl, gate: GATES[j * 2 + 1 - (h % 2)] }))]); }
  } else {
    // pary: każda para z każdą (2 × 2 zawodników w biegu)
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) plan.push([{ key: keys[i], slot: 0, gate: 'A' }, { key: keys[i], slot: 1, gate: 'C' }, { key: keys[j], slot: 0, gate: 'B' }, { key: keys[j], slot: 1, gate: 'D' }]);
    for (let i = plan.length - 1; i > 0; i--) { const j = hashStr(ev.id + i) % (i + 1); [plan[i], plan[j]] = [plan[j], plan[i]]; }
  }
  for (const heat of plan) {
    const entries = heat.map(x => { const u = m.units[x.key]; const rid = u.riders[x.slot % u.riders.length]; return { riderId: rid && !m.riders[rid].out ? rid : null, team: x.key, gate: x.gate, helmet: ['czerwony', 'niebieski', 'biały', 'żółty'][GATES.indexOf(x.gate)] }; })
      .filter((e, i, a) => e.riderId && a.findIndex(z => z.riderId === e.riderId) === i);
    if (entries.length < 2) continue;
    const h = compHeat(entries, { homeClubId: -1, weather: m.weather, track: m.track, team: false, mid: m.id, surf: m.surf });
    if ((m.heats.length + 1) % 4 === 0 && m.heats.length + 1 < plan.length) h.log.push(trackBreakNote(m, null, false)); // równanie co 4 biegi
    for (const rid of h.injuries) { if (m.riders[rid]) m.riders[rid].out = true; if (G.riders[rid]) injureRider(G.riders[rid], m.date, ev.name, ev); }
    h.res.forEach(x => { const s = m.riders[x.riderId]; s.pts += x.pts; s.bonus += x.bonus; s.heats++; s.line.push(x.status || `${x.pts}${x.bonus ? '*' : ''}`); m.units[s.unit].pts += x.pts; });
    m.heats.push({ no: m.heats.length + 1, label: `Bieg ${m.heats.length + 1}`, entries: entries.map(e => ({ riderId: e.riderId, gate: e.gate, team: e.team })), res: h.res, time: h.time, log: h.log });
  }
  m.names = Object.fromEntries(Object.keys(m.riders).map(id => [id, (R(isNaN(id) ? id : Number(id)) || {}).name]));
  m.classification = unitOrder(m, ev, { noRunOff: compOf(ev).table }).map((k, i) => ({ key: k, place: i + 1, pts: m.units[k].pts })); // remisy: js/ties.js
  m.done = true;
  for (const [rid, s] of Object.entries(m.riders)) if (s.heats) recordRider(isNaN(rid) ? rid : Number(rid), s.pts, s.heats, m.classification.find(c => c.key === s.unit).place === 1 ? 1 : 5);
  return m;
}
function simulateExam(ev) {
  let cands = Object.values(G.academy).filter(k => examCandidate(k, ev.date) && examRegistered(k, ev.date));
  // kluby AI i szkółki: najwyżej roczny limit zdanych egzaminów (najlepsi adepci); egzaminy z rejestru PZM i adepci gracza bez limitu
  const used = {}, yr = ev.date.slice(0, 4);
  cands = cands.sort(by(k => k.ca ?? 0, -1)).filter(k => {
    if (k.clubId === G.clubId || realExam(k, ev.date)) return true;
    const key = k.clubId || 's' + k.schoolId;
    if (used[key] == null) used[key] = examPasses(key, yr);
    if (used[key] >= examQuota(k)) return false;
    used[key]++; return true;
  });
  const m = { id: `X${ev.id}`, kind: 'comp', comp: 'EXAM', eventId: ev.id, date: ev.date, venue: ev.venue, heats: [], riders: {}, exam: [], done: true };
  for (const k of cands) {
    k.examTried = ev.season; k.examLast = ev.date;
    const p = examChance(k);
    const ok = realExam(k, ev.date) || mulberry(hashStr(k.id + ev.id))() < p;
    const entry = { name: k.name, clubId: k.clubId, schoolId: k.schoolId || null, kidId: k.id, ca: round1(k.ca), pa: round1(k.pa), ok, riderId: null };
    if (ok) { const r = promoteKid(k); entry.riderId = r.id; }
    m.exam.push(entry);
  }
  if (typeof lowerExamRun === 'function') lowerExamRun(ev, m); // certyfikaty 85–140 cm³ i licencje 250 cm³/500R (js/kid-licence.js)
  if (typeof licExamRun === 'function') licExamRun(ev, m); // byli zawodnicy z wygasłą licencją (js/rider-licence.js)
  m.classification = [];
  const mine = m.exam.filter(e => e.clubId === G.clubId);
  if (mine.length) addMsg({ category: 'szkółka', from: 'Trener szkółki', stop: mine.some(e => e.ok), title: `Egzamin licencyjny: ${mine.filter(e => e.ok).length}/${mine.length} zdanych`, body: `<p>${fmtDay(ev.date)}${ev.venue ? `, ${esc(ev.venue)}` : ''}.</p><ul>${mine.map(e => `<li>${esc(e.name)}${e.kind ? ` (${esc(KID_LIC[e.kind].name)})` : ''} – ${e.ok ? (e.kind ? '<b class="pos">zdał</b>' : `<b class="pos">zdał</b> i dołącza do pierwszej drużyny${e.riderId ? ` – <a href="#/zawodnik/${e.riderId}">przypisz rolę</a>` : ''}`) : '<span class="neg">nie zdał</span>'}</li>`).join('')}</ul>`, link: `#/gp/${ev.id}` });
  return m;
}
function promoteKid(k) {
  G.seq.rider = Math.max(G.seq.rider || 30000, 30000) + 1;
  const id = G.seq.rider;
  const r = riderFromKid(k, id);
  r.licence = { number: null, team: G.clubs[k.clubId] ? G.clubs[k.clubId].city : '', date: G.date, place: (Object.values(G.events).find(e => e.comp === 'EXAM' && e.date === G.date) || {}).venue || '' };
  r.contract = k.clubId ? firstContract(r, k.clubId) : null;
  if (typeof schoolGraduate === 'function') schoolGraduate(r, k); // szkółka niezależna: karta w szkółce
  G.riders[id] = r;
  delete G.academy[k.id];
  if (typeof moveAttrHist === 'function') moveAttrHist(k.id, id);
  return r;
}
// Szansa zdania egzaminu licencyjnego: poziom adepta (CA). Kluby zgłaszają przygotowanych adeptów, więc zdaje większość
// (PZM 2026: 4–17 zdanych 500 cm³ na sesję, ok. 38 w sezonie). CA 18 → 50%, CA 22 → 75%, CA 26+ → 97%.
const examChance = k => clamp(0.5 + ((k.ca ?? 20) - 18) / 16, 0.25, 0.97);
const EXAM_RETRY_DAYS = 56; // po niezdanym egzaminie – kolejne podejście na późniejszej sesji (ok. 2 miesiące)
// Kandydat: adept 500 cm³ zgłoszony przez klub – ligowy albo szkółkę zrzeszoną w PZM (np. AS Akademia Lipno, MS Śląsk);
// bez żadnej przynależności nie podchodzi. Po 15. urodzinach (egzamin z rejestru PZM potwierdza wiek), bez świeżego niezdanego podejścia
const examAffiliated = k => !!((k.clubId && G.clubs[k.clubId]) || (k.schoolId && G.miniSchools && G.miniSchools[k.schoolId]));
function examCandidate(k, date = G.date) {
  // egzamin PZM tylko dla polskich adeptów w szkółce; zagraniczni zdobywają licencję w swoim kraju (js/adepts.js)
  if (!k || k.catalogOnly || k.retired || k.free || (k.country || 'POL') !== 'POL' || k.cat !== 'c500' || !examAffiliated(k) || (ageAt(k.born, date) < 15 && !realExam(k, date))) return false;
  return k.examLast ? k.examLast <= addDays(date, -EXAM_RETRY_DAYS) : k.examTried !== Number(date.slice(0, 4));
}
// Egzamin udokumentowany w rejestrze PZM (sezon 2026): adept podchodzi na tej lub najbliższej późniejszej sesji i zdaje;
// wcześniejszych sesji klub nie wykorzystuje (realExamLater)
const realExam = (k, date) => (k.licenseEvents || []).some(e => e.class === '500cc' && e.date && e.date.slice(0, 7) <= date.slice(0, 7));
const realExamLater = (k, date) => !realExam(k, date) && (k.licenseEvents || []).some(e => e.class === '500cc' && e.date && e.date.slice(0, 7) > date.slice(0, 7));
const examReady = k => examChance(k) >= 0.7;
// Nasi zdający na sesji egzaminacyjnej: licencja Ż, licencje 250 cm³/500R i certyfikaty 85–140 cm³ (js/kid-licence.js),
// powroty po wygasłej licencji (js/rider-licence.js); po sesji – z protokołu. Kalendarz, „Moje zawody”, zatrzymanie czasu.
function examMine(ev, clubId = G.clubId) {
  if (!ev || ev.comp !== 'EXAM') return [];
  const m = ev.played && G.matches[ev.matchId];
  if (m) return (m.exam || []).filter(e => e.clubId === clubId).map(e => e.name);
  // zdający przypisani do najbliższej sesji, na którą się kwalifikują (wcześniejsze nierozegrane sesje od dziś)
  const earlier = Object.values(G.events).filter(e => e.comp === 'EXAM' && !e.played && e.date >= G.date && e.date < ev.date).map(e => e.date);
  const kidOn = (k, d) => { const kind = typeof lowerExamKind === 'function' && lowerExamKind(k, d); return (examCandidate(k, d) && examRegistered(k, d)) || (kind && lowerExamRegistered(k, kind, d)); };
  const out = [];
  for (const k of Object.values(G.academy)) if (k.clubId === clubId && kidOn(k, ev.date) && !earlier.some(d => kidOn(k, d))) out.push(k.name);
  if (typeof licExamCandidates === 'function') {
    const prev = new Set(earlier.flatMap(d => licExamCandidates(d).map(r => r.id)));
    for (const r of licExamCandidates(ev.date)) if (r.clubId === clubId && !prev.has(r.id)) out.push(r.name);
  }
  return out;
}
// Zgłoszenie: kluby AI – przygotowani adepci (i starsi, których szkółka już nie trzyma); gracz – wybór w profilu adepta, domyślnie przygotowani
function examRegistered(k, date = G.date) {
  if (realExamLater(k, date) && !(k.clubId === G.clubId && k.examRegistered === true && !k.examWithdrawn)) return false;
  if (k.clubId === G.clubId) return !k.examWithdrawn && (k.examRegistered === true || examReady(k) || realExam(k, date)); // examRegistered: false z importu rejestru nie oznacza wycofania
  return realExam(k, date) || examReady(k) || (ageAt(k.born, date) >= 18 && examChance(k) >= 0.55);
}
// Roczny limit licencji „Ż” klubu AI / szkółki (kalibracja: ok. 25–35 licencji rocznie w całej Polsce, klub PGE 1,5–3 rocznie –
// WP SportoweFakty 2021–2024, espeedway 2000–2013): kluby zgłaszają tylko najlepszych adeptów
const EXAM_QUOTA = { PGE: 3, '2E': 2, KLZ: 2, school: 1 };
function examQuota(k) { const c = k.clubId && G.clubs[k.clubId]; return c ? EXAM_QUOTA[c.league] || 1 : EXAM_QUOTA.school; }
function examPasses(key, year) {
  let n = 0;
  for (const m of Object.values(G.matches)) if (m.comp === 'EXAM' && m.exam && m.date.slice(0, 4) === String(year)) for (const e of m.exam) if (e.ok && !e.returning && !e.kind && (e.clubId || 's' + e.schoolId) === key) n++; // tylko licencje „Ż” (bez 250 cm³ i certyfikatów miniżużla)
  return n;
}
// Adept z licencją: ten sam profil (CA, PA, atrybuty, cechy ukryte) przechodzi do zawodnika; test talentu na 500 cm³
// Adept → zawodnik po licencji: kidId → riderId (pole r.kidId; starsze zapisy – protokoły egzaminów)
function kidRiderMap() {
  const map = new Map();
  for (const m of Object.values(G.matches)) if (m.comp === 'EXAM') for (const e of m.exam || []) if (e.ok && e.kidId && e.riderId) map.set(e.kidId, e.riderId);
  for (const r of Object.values(G.riders)) if (r.kidId) map.set(r.kidId, r.id);
  return map;
}
// Identyfikatory zawodnika w protokołach: obecny i z okresu adepta
function riderIdsOf(r) {
  const ids = [String(r.id)];
  if (r.kidId) ids.push(String(r.kidId));
  else if (G.riders[r.id] && r.academyGraduate) for (const [kid, rid] of kidRiderMap()) if (String(rid) === String(r.id)) ids.push(String(kid));
  return ids;
}
function riderFromKid(k, id) {
  if (k.ca == null) initKidAbility(k, null);
  const r = newRider({ id, name: k.name, country: k.country || 'POL', born: null, skill: k.ca / 5, potential: k.pa, profile: 'wychowanek – świeża licencja', certainty: 'gra', activity: [], lastSeason: G.season }, G.date);
  r.born = String(k.born || '').length === 4 ? birthFromYear(Number(k.born), k.name) : k.born; r.bornEst = String(k.born || '').length !== 10;
  r.clubId = k.clubId; r.academyGraduate = true; r.academyCatalogId = k.academyCatalogId; r.schoolId = k.schoolId;
  r.kidId = k.id; if (k.honours) r.honours = k.honours.slice(); // starty i sukcesy z okresu adepta (miniżużel, 250, 500R)
  if (k.mgrChild) { r.mgrChild = true; const c = ((G.manager && G.manager.children) || []).find(x => x.kidId === k.id); if (c) { c.riderId = id; c.kidId = null; } }
  Object.assign(r, { ca: k.ca, pa: k.pa, paRange: k.paRange, calib: k.calib, attrs: { ...k.attrs }, hidden: { ...k.hidden }, dev: { ...k.dev, seasonCa: k.ca }, paLog: (k.paLog || []).slice() });
  syncSkill(r);
  if (typeof applyLicenceFloor === 'function') applyLicenceFloor(r); // zdany egzamin: co najmniej poziom debiutanta
  licencePaEvent(r);
  r.hist = [{ d: G.date, s: r.skill }];
  return r;
}
// Rozegranie dowolnych zawodów
function simulateComp(ev) {
  KID_CACHE = new Map();
  const c = compOf(ev);
  let m;
  if (c.format === 'ind') {
    m = simulateGp(ev);
  } else if (c.format === 'exam') {
    m = simulateExam(ev);
    G.matches[m.id] = m; ev.played = true; ev.matchId = m.id; ev.winner = null;
    return m;
  } else {
    if (!ev.units || !ev.heatProgramVersion) buildStartList(ev);
    const chosen = ev.units.map(u => ({ ...u, riders: u.riders.slice() }));
    if (chosen.length < 2) { ev.played = true; ev.cancelled = true; return null; }
    m = unitsMeeting(ev, chosen, c.format === 'pairs' ? 2 : chosen.length === 2 ? 2 : 1);
    G.matches[m.id] = m; ev.played = true; ev.matchId = m.id; ev.winner = m.classification[0].key;
    if (c.table) { const t = seriesTable(ev.season, ev.comp); m.classification.forEach(x => { t[x.key] = (t[x.key] || 0) + (x.tablePts ?? (4 - x.place + 1) * 2); }); }
    const mine = Object.values(m.units).find(u => u.clubId === G.clubId);
    const w = m.units[ev.winner];
    if (mine || ['SWC', 'MPPK', 'REP'].includes(ev.comp) || (ev.stage === 'finał' && c.group !== 'mlodziez')) addMsg({ category: 'liga', from: c.name, title: `${ev.name}: wygrywa ${w.name}`,
      body: `<p>${m.classification.map(x => `${x.place}. <b>${esc(m.units[x.key].name)}</b> – ${x.pts} pkt`).join('<br>')}</p>${(w.riders || []).length ? `<p>Skład zwycięzców: ${w.riders.filter(id => R(id)).map(id => `<a href="#/zawodnik/${id}">${esc(R(id).name)}</a>`).join(', ')}.</p>` : ''}`,
      people: [...(w.riders || []), ...(mine && mine !== w ? mine.riders || [] : [])].filter(id => R(id)), link: `#/gp/${ev.id}` });
  }
  if (m && c.group === 'mlodziez') payYouthComp(ev, m); // w zawodach młodzieżowych wyłącznie wynagrodzenie za punkty
  return m;
}
function unitLabel(m, key) { const u = m.units[key]; return u.clubId ? clubLink(u.clubId) : `${u.country && u.country !== 'UNK' ? flag(u.country) + ' ' : ''}${esc(u.name)}`; }

// Zapisy sprzed poprawki: nierozegrane zawody z zawodnikami ponad limit wieku na liście startowej – lista zostanie ogłoszona ponownie
function fixAgeFields() {
  let n = 0;
  for (const ev of Object.values(G.events)) {
    if (ev.kind !== 'comp' || ev.played || !ev.startList || ev.startList.every(x => ageLimitOk(ev, x.id))) continue;
    delete ev.startList; delete ev.reserves; delete ev.heatProgramVersion; n++;
  }
  // cykle z dziką kartą na rundę (SGP2): listy ogłoszone przed poprawką kopiowały dziką kartę i rezerwy pierwszej rundy – ogłoszenie ponowne
  for (const ev of Object.values(G.events)) {
    if (ev.kind !== 'comp' || ev.played || !ev.startList || ev.startList.some(x => x.wc) || typeof qualEventSlots !== 'function' || !qualEventSlots(ev)) continue;
    delete ev.startList; delete ev.reserves; delete ev.heatProgramVersion; n++;
  }
  // klasyfikacja cyklu (np. SGP2): bez zawodników ponad limit wieku; wyniki rozegranych rund zostają w historii
  for (const ev of Object.values(G.events)) {
    if (ev.kind !== 'comp' || !ev.played || !FIELD_MAX_AGE[compOf(ev).field] || !compOf(ev).series) continue;
    const t = seriesTable(ev.season, compKey(ev));
    for (const id of Object.keys(t)) if (!ageLimitOk(ev, id)) { delete t[id]; n++; }
  }
  return n > 0;
}
