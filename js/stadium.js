'use strict';
// Stadion, bilety i karnety: sektory z bazy stadionów (js/venue-data.js), cenniki według sektora i kategorii wiekowej
// (normalny, ulgowy, dziecięcy, rodzinny 2+2, wstęp bezpłatny dla małych dzieci), karnety (także rodzinne i VIP na wszystkie zawody),
// osobne cenniki play-off, finału, barażu i turniejów rozgrywanych na stadionie klubu (SGP, IMP, DMPJ, U24…) oraz model frekwencji:
// popyt grup kibiców zależy od ceny, sektora, pogody i rangi zawodów; ceny wpływają na bazę kibiców w kolejnych sezonach.
// Ceny wyjściowe i warianty: tools/sources/venue/ANALIZA_stadion_bilety.md (cenniki klubów 2025–2026).

// ---------- Dane ----------
// Klub → stadion w bazie (id rekordu z tools/sources/venue/stadiony_pelne.csv)
const VENUE_OF = { WRO: 'F17', TOR: 'F07', ZIE: 'F05', LUB: 'F12', RYB: 'F09', CZE: 'F04', GOR: 'F11', GRU: 'F18', LES: 'F06', BYD: 'F14', KRO: 'F02', RZE: 'F13',
  POZ: 'F24', OST: 'F16', TAR: 'F25', LOD: 'F10', GDA: 'F15', GNI: 'F08', DAU: 'F20', PIL: 'F19', KRA: 'F23', OPO: 'F01', LAN: 'F21', 'ŚWI': 'F22', RAW: 'F03' };
// Rodzaje sektorów: mnożnik ceny względem prostej przeciwległej i atrakcyjność miejsca przy cenie wyjściowej
const SECTOR_KINDS = {
  vip: { name: 'VIP / loża', mult: 4, pref: 0.1 },
  main: { name: 'Trybuna główna', mult: 1.8, pref: 0.85 },
  prime: { name: 'Prosta startowa', mult: 1.25, pref: 1.1 },
  straight: { name: 'Prosta przeciwległa', mult: 1, pref: 1 },
  bend: { name: 'Wiraż', mult: 0.85, pref: 0.9 },
  family: { name: 'Sektor rodzinny', mult: 0.8, pref: 0.7 },
  fan: { name: 'Sektor kibica', mult: 0.85, pref: 0.95 },
  standing: { name: 'Miejsca stojące', mult: 0.6, pref: 0.75 },
  away: { name: 'Sektor gości', mult: 1, pref: 0 },
};
// Cena normalna na prostej przeciwległej w meczu rundy zasadniczej (zł) – poziom ligi, gdy klub nie ma własnego cennika
const LEAGUE_REF = { PGE: 70, '2E': 55, KLZ: 40 };
const TICKET_CATS = { N: 'Normalny', U: 'Ulgowy', D: 'Dziecięcy', R: 'Rodzinny 2+2' };
// Cenniki klubów (stan 2025–2026, ANALIZA_stadion_bilety.md): lg – liga, w której obowiązywał cennik; lvl – cena normalna na prostej przeciwległej;
// u, d – ulgowy i dziecięcy jako część normalnego (dFix: stała cena biletu dziecięcego, kdFix: karnetu); free/child/stud/senior – progi wieku
// (wstęp bezpłatny do lat …, bilet dziecięcy do lat …, ulga dla uczniów i studentów do lat …, seniorów od lat …; 99 = brak ulgi);
// kf – karnet / suma biletów rundy zasadniczej; youth – karnet obejmuje zawody młodzieżowe; vipAll – karnet VIP na wszystkie zawody;
// loyal – rabat dla posiadaczy karnetu z poprzedniego sezonu; poDisc – zniżka karnetowiczów na play-off;
// layout – sektory: [id, nazwa, rodzaj, miejsca (>1) albo udział w pozostałych miejscach (≤1), { cov: kryty, num: numerowany, mult: własny mnożnik ceny }]
const CLUB_TICKETS = {
  WRO: { lg: 'PGE', lvl: 50, u: 0.71, d: 0.33, free: 6, child: 15, stud: 24, senior: 65, famKarnet: true },
  TOR: { lg: 'PGE', lvl: 69, u: 0.7, d: 0.5, free: 4, child: 4, stud: 24, senior: 99, loyal: 0.15, layout: [['CZ', 'Strefa czerwona (trybuna główna)', 'main', 2400, { cov: 1, num: 1, mult: 2.3 }], ['VIP', 'Loże i strefa VIP', 'vip', 300, { cov: 1, num: 1 }],
    ['NB', 'Strefa niebieska', 'straight', 0.45, { cov: 1, num: 1 }], ['ZI', 'Strefa zielona (wiraże)', 'bend', 0.4, { cov: 1, mult: 0.9 }], ['R', 'Sektor rodzinny (strefa zielona)', 'family', 0.08, { cov: 1 }], ['G', 'Sektor gości', 'away', 0.07, { cov: 1 }], ['S', 'Miejsca stojące', 'standing', 506]] },
  ZIE: { lg: 'PGE', lvl: 95, u: 0.89, d: 0.44, free: 2, child: 12, stud: 24, senior: 65, kf: 0.75, vipAll: true, poDisc: 0.2, layout: [['K', 'Trybuna K (częściowo kryta)', 'main', 1500, { cov: 1, num: 1 }], ['VI', 'Strefa VI – VIP START (kryta)', 'vip', 250, { cov: 1, num: 1 }],
    ['WS', 'Sektory pod wieżą sędziowską', 'prime', 0.16, { cov: 1, num: 1 }], ['P', 'Prosta przeciwległa', 'straight', 0.28], ['W1', 'I łuk', 'bend', 0.18], ['W2', 'II łuk', 'bend', 0.16], ['R', 'Sektor rodzinny', 'family', 0.08], ['FAN', 'Sektor kibica', 'fan', 0.08], ['G', 'Sektor gości', 'away', 0.06], ['S', 'Miejsca stojące', 'standing', 586]] },
  LUB: { lg: 'PGE', lvl: 80, u: 0.82, d: 0.45, free: 2, child: 14, stud: 26, senior: 60, layout: [['TG', 'Trybuna Główna', 'main', 1100, { cov: 1, num: 1, mult: 1.9 }], ['VIP', 'Strefa VIP', 'vip', 150, { cov: 1, num: 1 }],
    ['A', 'Sektory A', 'prime', 0.25], ['B', 'Sektory B', 'straight', 0.27], ['C', 'Sektory C (wiraże)', 'bend', 0.3], ['R', 'Sektor rodzinny', 'family', 0.07], ['G', 'Sektor gości', 'away', 0.05], ['S', 'Miejsca stojące', 'standing', 1302]] },
  CZE: { lg: 'PGE', lvl: 55, u: 0.7, dFix: 5, kdFix: 10, free: 2, child: 12, stud: 26, senior: 65 },
  GOR: { lg: 'PGE', lvl: 65, u: 0.79, d: 0.5, free: 3, child: 17, stud: 26, senior: 65 },
  GRU: { lg: 'PGE', lvl: 65, u: 0.85, d: 0.85, free: 6, child: 6, stud: 24, senior: 65, kf: 0.84, layout: [['D', 'Trybuna D (super VIP)', 'vip', 120, { cov: 1, num: 1, mult: 3.5 }],
    ['CEF', 'Trybuny C, E, F', 'prime', 0.3, { num: 1, mult: 1.18 }], ['BG', 'Trybuny B, G, H, I', 'straight', 0.55], ['R', 'Sektor rodzinny', 'family', 0.06], ['G', 'Sektor gości', 'away', 0.06]] },
  LES: { lg: 'PGE', lvl: 60, u: 0.56, d: 0.26, free: 6, child: 14, stud: 26, senior: 65, loyal: 0.1, layout: [['0', 'Sektor 0', 'vip', 400, { cov: 1, num: 1, mult: 2.86 }], ['AB', 'Sektory A i B', 'prime', 0.2, { mult: 1.37 }],
    ['PP', 'Przeciwległa prosta', 'straight', 0.22], ['W1', 'Wiraż I', 'bend', 0.17, { mult: 1.14 }], ['W2', 'Wiraż II', 'bend', 0.15, { mult: 1.14 }], ['FAN', 'Sektor fan', 'fan', 0.1, { mult: 0.83 }], ['R', 'Sektor rodzinny', 'family', 0.1, { mult: 0.77 }], ['G', 'Sektor gości', 'away', 0.06]] },
  RYB: { lg: '2E', lvl: 65 },
  BYD: { lg: '2E', lvl: 60, u: 0.86, d: 0.86, free: 6, child: 6, stud: 16, senior: 60, layout: [['TG', 'Trybuna Główna', 'main', 1200, { cov: 1, num: 1, mult: 2.7 }], ['SV', 'Trybuna Główna – SUPER VIP (catering)', 'vip', 120, { cov: 1, num: 1, mult: 12.9 }],
    ['NT', 'Nowa Trybuna', 'prime', 0.25, { cov: 1, num: 1, mult: 1.57 }], ['A', 'Sektor A', 'straight', 0.3], ['B', 'Sektor B', 'bend', 0.3, { mult: 0.86 }], ['R', 'Sektor rodzinny', 'family', 0.08], ['G', 'Sektor gości', 'away', 0.07]] },
  KRO: { lg: '2E', lvl: 55, u: 0.66, d: 0.35, free: 2, child: 15, stud: 25, senior: 60, layout: [['A1', 'Trybuna kryta A1', 'main', 500, { cov: 1, num: 1, mult: 1.72 }], ['A2', 'Trybuna kryta A2', 'main', 567, { cov: 1, num: 1, mult: 1.88 }],
    ['P', 'Prosta przeciwległa', 'straight', 0.45], ['W1', 'I łuk', 'bend', 0.35], ['R', 'Sektor rodzinny', 'family', 0.1], ['G', 'Sektor gości', 'away', 0.1], ['L2', 'II łuk (krzesełka i miejsca stojące)', 'standing', 1507]] },
  RZE: { lg: '2E', lvl: 60, u: 0.67, d: 0.25, free: 5, child: 13, stud: 26, senior: 60, kf: 1 },
  POZ: { lg: '2E', lvl: 55 },
  OST: { lg: '2E', lvl: 60 },
  LOD: { lg: '2E', lvl: 55, vip: 738 },
  PIL: { lg: '2E', lvl: 55, u: 0.8, vipMult: 3.9 },
  TAR: { lg: '2E', lvl: 40, u: 0.6, dFix: 2, kdFix: 10, free: 2, child: 7 },
  GDA: { lg: 'KLZ', lvl: 45, u: 0.78, d: 0.78, free: 8, child: 8, stud: 25, senior: 65, layout: [['CZ', 'Sektory czerwone (trybuna M. Berlińskiego, kryta)', 'main', 2500, { cov: 1, num: 1, mult: 1.22 }], ['VIP', 'Strefa VIP', 'vip', 80, { cov: 1, num: 1 }],
    ['NB', 'Sektory niebieskie', 'straight', 0.45], ['ZI', 'Sektory zielone', 'bend', 0.4, { mult: 1 }], ['R', 'Sektor rodzinny', 'family', 0.08, { mult: 1 }], ['G', 'Sektor gości', 'away', 0.07]] },
  GNI: { lg: 'KLZ', lvl: 45, u: 0.79, d: 0.21, free: 3, child: 12, stud: 26, senior: 65, kf: 0.857, youth: true, layout: [['TK', 'Trybuna kryta', 'main', 601, { cov: 1, num: 1, mult: 1.5 }], ['VIP', 'Loża VIP', 'vip', 64, { cov: 1, num: 1 }],
    ['A', 'Sektor A', 'prime', 0.25], ['B', 'Sektor B', 'straight', 0.3], ['C', 'Sektory wirażowe', 'bend', 0.3], ['R', 'Sektor rodzinny', 'family', 0.08], ['G', 'Sektor gości', 'away', 0.07]] },
  DAU: { lg: 'KLZ', lvl: 35, vipMult: 3.7 },
  KRA: { lg: 'KLZ', lvl: 40 },
  OPO: { lg: 'KLZ', lvl: 40, u: 0.75, mainMult: 1.25 },
  LAN: { lg: 'KLZ', lvl: 100, u: 0.83, dFix: 2, free: 5, child: 17, stud: 26, senior: 65, layout: [['TG', 'Trybuna główna i trybuna Seemann', 'main', 550, { num: 1, mult: 1 }], ['S', 'Miejsca stojące', 'standing', 1, { mult: 0.8 }]] },
  'ŚWI': { lg: 'KLZ', lvl: 45, u: 0.75 },
  RAW: { lg: 'KLZ', lvl: 30 },
  WAR: { lg: 'KLZ', lvl: 40 },
};
const TICKET_DEF = { u: 0.75, d: 0.35, free: 6, child: 12, stud: 26, senior: 65, kf: 0.85 };
// Mecze ligowe poza rundą zasadniczą: mnożnik ceny wyjściowej i zainteresowania kibiców
const LEAGUE_EVENTS = { RS: { name: 'Runda zasadnicza', ref: 1, att: 1 }, PO: { name: 'Play-off (półfinał, mecz o 3. miejsce)', ref: 1.4, att: 1.3 }, F: { name: 'Finał', ref: 2, att: 1.75 }, BZ: { name: 'Baraż', ref: 1.5, att: 1.5 } };
// Turnieje na stadionie klubu: ref – cena wyjściowa względem rundy zasadniczej, att – zainteresowanie względem meczu ligowego, org – koszt organizacji,
// free – domyślnie wstęp wolny (jak na zawodach młodzieżowych w Rzeszowie), fee / city – opłata licencyjna promotora i wsparcie miasta (Grand Prix)
const EVENT_CLASSES = {
  sgp: { name: 'Grand Prix', ref: 2.6, att: 3, org: 250000, fee: 1800000, city: 900000 },
  intl: { name: 'Zawody międzynarodowe', ref: 1.3, att: 0.9, org: 120000 },
  pol: { name: 'Finał mistrzostw Polski', ref: 1, att: 0.75, org: 80000 },
  tour: { name: 'Turniej / memoriał', ref: 0.9, att: 0.55, org: 150000 },
  elim: { name: 'Eliminacje', ref: 0.4, att: 0.2, org: 30000 },
  u24: { name: 'U24 / U17', ref: 0.15, att: 0.14, org: 10000 },
  youth: { name: 'Zawody młodzieżowe', ref: 0.2, att: 0.08, org: 8000, free: true },
  kids: { name: 'Zawody adeptów (250 / 500R / 125)', ref: 0.1, att: 0.04, org: 4000, free: true },
};
const COMP_CLASS = {
  SWC: 'intl', SON2: 'intl', SEC: 'intl', EPC: 'intl', ETC: 'intl', EU24T: 'intl', REP: 'intl', SGP2: 'intl',
  IMP: 'pol', ZK: 'pol', MPPK: 'pol', IMPC: 'pol',
  TOUR: 'tour', IMME: 'tour', GB: 'tour', FT: 'tour', MACEC: 'tour',
  IMPE: 'elim', SECQ: 'elim', SGPQ: 'elim', SGP2Q: 'elim', EU24C: 'elim',
  U24E: 'u24', IPEU17: 'u24',
  DMPJ: 'youth', MIMP: 'youth', MIMPE: 'youth', SK: 'youth', SKE: 'youth', BK: 'youth', BKE: 'youth', MMPPK: 'youth', IP2EU19: 'youth', TZKJ: 'youth', EU19: 'youth', EU19P: 'youth',
  DPE500: 'kids', DP2E500: 'kids', IPE500: 'kids', PG500: 'kids', IMP500: 'kids', ZSZ: 'kids', SGP3: 'kids', SGP4: 'kids', E250: 'kids', E250P: 'kids', E125: 'kids',
};
// Widzowie według wieku (części widowni na rok życia w przedziale) – do podziału na kategorie biletów
const AGE_MASS = [[0, 3, 0.015], [4, 6, 0.025], [7, 12, 0.07], [13, 15, 0.04], [16, 19, 0.05], [20, 26, 0.09], [27, 59, 0.54], [60, 64, 0.07], [65, 99, 0.1]];
const FAMILY_KIDS = 0.45; // część płacących dzieci (do 15 lat), które przychodzą z rodzicami w grupie 2+2
const SEG = { // e – wrażliwość na cenę, ratio – cena wyjściowa względem normalnego
  N: { e: 0.9 }, U: { e: 1.1 }, D: { e: 1.3 }, FAM: { e: 1.3 }, CORP: { e: 0.5 }, AWAY: { e: 0.6 },
};
const SHOW_UP = 0.9; // posiadacze karnetów obecni na meczu rundy zasadniczej

const roundPrice = x => x <= 0 ? 0 : x < 20 ? Math.max(1, Math.round(x)) : Math.round(x / 5) * 5;
const cityKey = c => (c.city || '').replace(' Wlkp.', '');
const tSpec = c => CLUB_TICKETS[c.short] || {};
const tDef = (c, k) => tSpec(c)[k] ?? TICKET_DEF[k];

// ---------- Stadion i sektory ----------
function stadiumInit(c) {
  const st = c.stadium;
  const v = VENUES && VENUES[VENUE_OF[c.short]];
  if (!st.sectors) {
    if (v) {
      st.venueId = v.id;
      st.capacity = v.capacity || st.capacity;
      st.seated = v.seated; st.covered = v.covered; st.lighting = v.lighting;
      st.venueName = v.name; st.owner = v.owner; st.surfaceDb = v.surface; st.lengthDb = v.length;
      if (v.lighting) st.lights = true;
    }
    st.sectors = makeSectors(c, v);
    st.capacity = sum(st.sectors.map(s => s.seats));
  }
  if (!c.tickets) {
    const sp = tSpec(c);
    c.tickets = { lvl: sp.lvl || LEAGUE_REF[c.league], lvlLg: sp.lg || c.league, prices: {}, season: null,
      policy: { free: tDef(c, 'free'), child: Math.max(tDef(c, 'free'), tDef(c, 'child')), stud: tDef(c, 'stud'), senior: tDef(c, 'senior') },
      opts: { youth: !!sp.youth, vipAll: !!sp.vipAll, loyal: sp.loyal || 0, poDisc: sp.poDisc || 0 } };
    c.tickets.defPolicy = { ...c.tickets.policy };
  }
  if (st.demand == null) calibrateDemand(c);
  return c.tickets;
}
function makeSectors(c, v) {
  const sp = tSpec(c);
  const C = (v && v.capacity) || c.stadium.capacity || 5000;
  const covered = v && v.covered, allCov = covered && covered >= C * 0.6;
  let layout = sp.layout;
  if (!layout) {
    const standing = v && v.standing != null ? v.standing : v && v.seated ? Math.max(0, C - v.seated) : 0;
    const vip = sp.vip || Math.round(clamp(C * 0.015, 40, 400));
    const main = covered && !allCov ? covered : Math.round(C * 0.1);
    layout = [['TG', 'Trybuna główna', 'main', main, { cov: 1, num: 1, mult: sp.mainMult }], ['VIP', 'Loża VIP', 'vip', vip, { cov: 1, num: 1, mult: sp.vipMult }],
      ['ST', 'Prosta startowa', 'prime', 0.16, { num: 1 }], ['PP', 'Prosta przeciwległa', 'straight', 0.28], ['W1', 'Wiraż I', 'bend', 0.17], ['W2', 'Wiraż II', 'bend', 0.15],
      ['R', 'Sektor rodzinny', 'family', 0.08], ['FAN', 'Sektor kibica', 'fan', 0.08], ['G', 'Sektor gości', 'away', 0.06]];
    if (standing > 0) layout.push(['S', 'Miejsca stojące', 'standing', standing]);
  }
  const fixed = sum(layout.filter(x => x[3] > 1).map(x => x[3]));
  const shares = layout.filter(x => x[3] <= 1), shareSum = sum(shares.map(x => x[3])) || 1;
  const rest = Math.max(0, C - fixed);
  const out = layout.map(([id, name, kind, n, o = {}]) => ({ id, name, kind, seats: n > 1 ? Math.round(n) : Math.round(rest * n / shareSum), covered: !!(o.cov || allCov), numbered: !!o.num, mult: o.mult || SECTOR_KINDS[kind].mult }));
  // zaokrąglenia: różnica do pojemności w największym sektorze z udziałem
  const diff = C - sum(out.map(s => s.seats));
  const big = out.filter((s, i) => layout[i][3] <= 1).sort(by(s => s.seats, -1))[0];
  if (big) big.seats += diff;
  return out.filter(s => s.seats > 0);
}
const sectorById = (c, id) => c.stadium.sectors.find(s => s.id === id);
// Cena normalna na prostej przeciwległej w obecnej lidze (cennik klubu przeskalowany przy awansie / spadku)
function ticketRef(c) { const T = c.tickets; return T.lvl * LEAGUE_REF[c.league] / LEAGUE_REF[T.lvlLg]; }

// ---------- Cenniki ----------
// Klucze cenników: RS, PO, F, BZ (mecze ligowe) i E:<id wydarzenia> (turnieje na naszym stadionie)
function eventMeta(c, key) {
  if (LEAGUE_EVENTS[key]) return { ...LEAGUE_EVENTS[key], key, league: true };
  const ev = G.events[key.slice(2)];
  const cls = ev && eventClassOf(ev);
  if (!cls) return null;
  return { ...EVENT_CLASSES[cls], key, cls, ev, name: ev.name };
}
function eventClassOf(ev) {
  if (!ev || ev.cancelled) return null;
  if (ev.kind === 'sgp') return 'sgp';
  if (ev.kind !== 'comp') return null;
  return COMP_CLASS[ev.comp] || null;
}
// Domyślny cennik: cennik klubu (ref × mnożnik sektora, ulgi wg klubu), dla innych zawodów przemnożony; zawody młodzieżowe – wstęp wolny
function defaultTable(c, key) {
  const meta = eventMeta(c, key) || LEAGUE_EVENTS.RS;
  const ref = ticketRef(c), sp = tSpec(c);
  const u = tDef(c, 'u'), d = tDef(c, 'd');
  const out = {};
  for (const s of c.stadium.sectors) {
    if (meta.free) { out[s.id] = { N: 0, U: 0, D: 0, R: 0 }; continue; }
    const N = roundPrice(ref * s.mult * meta.ref);
    const D = sp.dFix != null ? roundPrice(sp.dFix * Math.max(1, meta.ref * 0.7)) : roundPrice(N * d);
    const famOk = s.kind === 'family' || (sp.famKarnet && s.kind === 'bend');
    out[s.id] = { N, U: roundPrice(N * u), D, R: famOk ? roundPrice((2 * N + 2 * D) * 0.8) : 0 };
  }
  if (meta.cls === 'u24') for (const id of Object.keys(out)) { out[id].D = 0; out[id].R = 0; } // U24: dzieci do 13 lat wstęp wolny (Zielona Góra)
  return out;
}
function priceTable(c, key) { return (c.tickets.prices && c.tickets.prices[key]) || defaultTable(c, key); }
function customised(c, key) { return !!(c.tickets.prices && c.tickets.prices[key]); }
// Karnety (runda zasadnicza): kf × liczba meczów × cena biletu
function homeRsCount(c, S = sportSeason()) { return Math.max(5, seasonFixtures(c.league, S).filter(x => x.homeId === c.id && x.stage === 'RS').length || 7); }
function defaultSeasonTable(c, S = sportSeason()) {
  const t = defaultTable(c, 'RS'), sp = tSpec(c), kf = tDef(c, 'kf'), n = homeRsCount(c, S), out = {};
  for (const s of c.stadium.sectors) {
    const p = t[s.id];
    out[s.id] = { N: roundPrice(p.N * n * kf), U: roundPrice(p.U * n * kf), D: sp.kdFix != null ? sp.kdFix : roundPrice(p.D * n * kf), R: p.R ? roundPrice(p.R * n * kf) : 0 };
    if (s.kind === 'away') out[s.id] = { N: 0, U: 0, D: 0, R: 0 }; // karnetów na sektor gości się nie sprzedaje
  }
  return out;
}
function seasonTable(c, S) { return c.tickets.season || defaultSeasonTable(c, S); }

// ---------- Widownia według kategorii ----------
function ageMass(a) { const b = AGE_MASS.find(([lo, hi]) => a >= lo && a <= hi); return b ? b[2] / (b[1] - b[0] + 1) : 0; }
// Udziały kategorii w widowni przy danych progach wieku; dzieci płacące, które przychodzą z rodzicami (grupy 2+2), osobno
function crowdMix(p) {
  const m = { F0: 0, D: 0, U: 0, N: 0, kidsD: 0, kidsU: 0, kidsN: 0 };
  for (let a = 0; a <= 99; a++) {
    const w = ageMass(a);
    let cat;
    if (a <= p.free) { m.F0 += w; continue; }
    if (a <= p.child) cat = 'D';
    else if (a <= 19 && a <= p.stud) cat = 'U';
    else if (a <= p.stud) { m.U += w * 0.55; m.N += w * 0.45; continue; }
    else if (a >= p.senior) cat = 'U';
    else cat = 'N';
    m[cat] += w;
    if (a <= 15) m['kids' + cat] += w;
  }
  const dis = m.N * 0.02; m.N -= dis; m.U += dis; // osoby z niepełnosprawnością: bilet ulgowy
  const fam = { D: m.kidsD * FAMILY_KIDS, U: m.kidsU * FAMILY_KIDS, N: m.kidsN * FAMILY_KIDS };
  const famKids = fam.D + fam.U + fam.N;
  return { F0: m.F0, N: Math.max(0, m.N - fam.N - famKids), U: m.U - fam.U, D: m.D - fam.D, FAM: 2 * famKids, kidShare: famKids ? { D: fam.D / famKids, U: fam.U / famKids, N: fam.N / famKids } : { D: 1, U: 0, N: 0 } };
}

// ---------- Frekwencja i wpływy ----------
// Popyt grupy g na sektor s zależy od ceny względem wyjściowej (p/r)^-e; wybór sektora – od ceny, rodzaju miejsca i pogody.
// o: { key, attract, rain, awayMass, holders: 'rs' | 'free', showUp, noise, noHolders }
const priceFactor = (p, r, e) => p <= 0 ? 1.8 : r <= 0 ? 1 : clamp(Math.pow(p / r, -e), 0.03, 1.8);
function gateCalc(c, o) {
  const T = c.tickets, st = c.stadium, sectors = st.sectors;
  const meta = eventMeta(c, o.key) || LEAGUE_EVENTS.RS;
  const P = priceTable(c, o.key), R0 = defaultTable(c, o.key);
  const generic = ticketRef(c) * (meta.ref || 1);
  const mix = crowdMix(T.policy), mix0 = crowdMix(T.defPolicy || T.policy);
  const ks = mix.kidShare;
  const kidPrice = p => ks.D * p.D + ks.U * p.U + ks.N * p.N;
  const indiv = p => (2 * p.N + 2 * kidPrice(p)) / 4;
  const famPrice = p => (p.R > 0 ? Math.min(p.R / 4, indiv(p)) : indiv(p));
  const pr = (g, p) => g === 'N' || g === 'CORP' || g === 'AWAY' ? p.N : g === 'U' ? p.U : g === 'D' ? p.D : famPrice(p);
  // cena wyjściowa (odniesienie) – domyślny cennik; gdy domyślnie wstęp wolny – poziom ogólny
  const refOf = (g, s) => {
    const r = R0[s.id] || {}, base = g === 'FAM' ? (2 * (r.N || 0) + 2 * kidPrice(r)) / 4 : pr(g, r);
    if (base > 0) return base;
    const n = generic * s.mult;
    return g === 'U' ? n * 0.75 : g === 'D' ? n * 0.35 : g === 'FAM' ? n * 0.675 : n;
  };
  const league = !!meta.league;
  const pref = (g, s) => {
    const k = SECTOR_KINDS[s.kind];
    if (g === 'CORP') return s.kind === 'vip' ? 1 : s.kind === 'main' ? 0.25 : 0;
    if (g === 'AWAY') return s.kind === 'away' ? 1 : 0;
    if (s.kind === 'away') return league ? 0 : SECTOR_KINDS.bend.pref;
    return k.pref * (g === 'FAM' && s.kind === 'family' ? 3 : 1);
  };
  const weather = s => (o.rain && !s.covered ? 0.55 : 1);
  const pot = st.demand * (o.attract || 1) * (o.noise ? 0.92 + rnd() * 0.16 : 1);
  const segs = { N: mix.N, U: mix.U, D: mix.D, FAM: mix.FAM, CORP: 0.02 * (meta.cls === 'youth' || meta.cls === 'kids' || meta.cls === 'u24' ? 0.2 : 1), AWAY: league ? (o.awayMass || 0) : 0 };
  // udział grup przy progach wyjściowych – zmiana progów przesuwa widzów między kategoriami, nie zmienia populacji
  const scaleMix = 1 / (mix0.N + mix0.U + mix0.D + mix0.FAM || 1);
  // posiadacze karnetów
  const H = o.noHolders ? null : holdersOf(c, o.S);
  const out = { sectors: {}, cats: { N: 0, U: 0, D: 0, R: 0, F0: 0, H: 0, CORP: 0, AWAY: 0 }, rev: 0, revRef: 0, att: 0, holders: 0, alloc: {}, key: o.key };
  const occ = {}, single = {};
  for (const s of sectors) { occ[s.id] = 0; single[s.id] = {}; out.sectors[s.id] = { n: 0, rev: 0, cap: s.seats, h: 0 }; }
  // karnetowicze: mecz rundy zasadniczej – zajmują miejsca (część popytu); inne zawody – wejście bezpłatne (VIP na wszystko, zawody młodzieżowe)
  const holdIn = {};
  if (H) for (const s of sectors) {
    const h = H[s.id];
    if (!h) continue;
    let rate = 0;
    if (o.key === 'RS') rate = SHOW_UP;
    else if (T.opts.vipAll && s.kind === 'vip' && meta.cls !== 'sgp') rate = league ? 0.95 : 0.6;
    else if (T.opts.youth && ['youth', 'kids', 'u24'].includes(meta.cls)) rate = 0.12;
    if (!rate) continue;
    holdIn[s.id] = { N: h.N * rate, U: h.U * rate, D: h.D * rate, FAM: h.R * 4 * rate, rs: o.key === 'RS' };
  }
  for (const [g, m] of Object.entries(segs)) {
    if (!m) continue;
    const e = SEG[g].e;
    let base = 0, demandF = 0;
    const ws = sectors.map(s => {
      const w0 = s.seats * pref(g, s);
      const p = pr(g, P[s.id] || {}), r = refOf(g, s);
      base += w0; demandF += w0 * priceFactor(p, r, e) * weather(s);
      return { s, p, r, w: w0 * priceFactor(p, r, 2.5) * weather(s) };
    });
    if (!base) continue;
    const segPot = (g === 'CORP' || g === 'AWAY' ? m : m * scaleMix) * pot * demandF / base;
    const wsum = sum(ws.map(x => x.w)) || 1;
    out.alloc[g] = {};
    for (const x of ws) {
      const n = segPot * x.w / wsum;
      out.alloc[g][x.s.id] = n;
      single[x.s.id][g] = { n, p: x.p, r: x.r };
    }
  }
  // zajętość: karnetowicze, potem bilety jednorazowe; nadmiar przechodzi częściowo do sektorów z wolnymi miejscami
  const overflow = [];
  for (const s of sectors) {
    const hi = holdIn[s.id];
    let h = 0;
    if (hi) {
      h = Math.min(s.seats, hi.N + hi.U + hi.D + hi.FAM);
      if (hi.rs) for (const g of ['N', 'U', 'D', 'FAM']) if (single[s.id][g]) single[s.id][g].n = Math.max(0, single[s.id][g].n - hi[g]);
    }
    occ[s.id] = h; out.sectors[s.id].h = h; out.holders += h;
    const want = sum(Object.values(single[s.id]).map(x => x.n));
    const free = Math.max(0, s.seats - h);
    const k = want > free ? free / want : 1;
    for (const [g, x] of Object.entries(single[s.id])) { if (k < 1) overflow.push({ g, n: x.n * (1 - k) * 0.5, from: s }); x.n *= k; }
    occ[s.id] += Math.min(want, free);
  }
  for (const ov of overflow) {
    const cand = sectors.filter(s => s.seats - occ[s.id] > 1 && pref(ov.g, s) > 0);
    const tot = sum(cand.map(s => (s.seats - occ[s.id]) * pref(ov.g, s)));
    if (!tot) continue;
    for (const s of cand) {
      const n = Math.min(s.seats - occ[s.id], ov.n * (s.seats - occ[s.id]) * pref(ov.g, s) / tot);
      const p = pr(ov.g, P[s.id] || {});
      const cur = single[s.id][ov.g] || (single[s.id][ov.g] = { n: 0, p, r: refOf(ov.g, s) });
      cur.n += n; occ[s.id] += n;
    }
  }
  // wpływy
  const isPO = league && o.key !== 'RS';
  const disc = isPO && T.opts.poDisc && H ? T.opts.poDisc : 0;
  let adults = 0;
  for (const s of sectors) {
    const P1 = P[s.id] || {};
    const hs = H && H[s.id];
    for (const [g, x] of Object.entries(single[s.id])) {
      const n = x.n;
      if (!n) continue;
      let rev;
      if (g === 'FAM') { const useR = P1.R > 0 && P1.R / 4 <= indiv(P1); rev = useR ? n / 4 * P1.R : n * indiv(P1); out.cats.R += n; }
      else { rev = n * x.p; out.cats[g === 'CORP' || g === 'AWAY' ? 'N' : g] += n; if (g === 'CORP') out.cats.CORP += n; if (g === 'AWAY') out.cats.AWAY += n; }
      // zniżka karnetowiczów na play-off: tylu, ilu posiada karnet w tym sektorze
      if (disc && hs && ['N', 'U', 'D'].includes(g)) rev -= Math.min(n, hs[g] || 0) * x.p * disc;
      out.rev += rev; out.revRef += n * x.r;
      out.sectors[s.id].n += n; out.sectors[s.id].rev += rev;
      if (g !== 'D') adults += g === 'FAM' ? n / 2 : n;
    }
    out.sectors[s.id].n += out.sectors[s.id].h;
  }
  out.cats.H = out.holders;
  adults += out.holders * 0.8;
  // małe dzieci z wolnym wstępem (bez gwarancji miejsca, z opiekunem): proporcjonalnie do dorosłych widzów
  const adultMass = mix.N + mix.U + mix.FAM / 2 || 1;
  out.cats.F0 = Math.min(adults * mix.F0 / adultMass * 1.2, st.capacity * 0.04);
  for (const s of sectors) out.sectors[s.id].n = Math.round(out.sectors[s.id].n);
  const seated = sum(Object.values(out.sectors).map(x => x.n));
  out.att = Math.round(Math.min(st.capacity, seated + out.cats.F0));
  out.cats.F0 = Math.round(out.att - seated);
  out.rev = Math.round(out.rev);
  out.idx = out.revRef > 0 ? out.rev / out.revRef : 1;
  out.fill = out.att / st.capacity;
  for (const k of Object.keys(out.cats)) out.cats[k] = Math.round(out.cats[k]);
  return out;
}
// Popyt bazowy (widzowie typowego meczu rundy zasadniczej przy cenach wyjściowych) dopasowany do średniej frekwencji klubu z bazy
function calibrateDemand(c) {
  const st = c.stadium;
  const d = DATA.clubs.find(x => x.id === c.id);
  const target = Math.min(st.capacity * 0.99, (d && d.attendance) || st.attendance || 2000);
  st.demand = target;
  for (let i = 0; i < 8; i++) {
    const g = gateCalc(c, { key: 'RS', attract: 1, noHolders: true });
    if (!g.att) break;
    st.demand *= target / g.att;
    if (g.att >= st.capacity * 0.97) break;
  }
  if (target >= st.capacity * 0.95) st.demand *= 1.2; // komplety: popyt większy niż liczba miejsc
  st.demand = Math.round(st.demand);
}

// ---------- Karnety ----------
// Liczba posiadaczy karnetów w sektorach (N/U/D – osoby, R – karnety rodzinne)
function holdersOf(c, S) {
  S = S || sportSeason();
  const k = c.fin && c.fin.karnety && (c.fin.karnety[S] || null);
  if (k && k.by) return k.by;
  return karnetPlan(c, S).by || {};
}
// Sprzedaż karnetów w sezonie S: popyt na mecz rundy zasadniczej × część kupujących karnet zależna od opłacalności karnetu
function karnetSales(c, S) {
  stadiumInit(c);
  const T = c.tickets, lg = FL(c), home = homeRsCount(c, S);
  const P = priceTable(c, 'RS'), K = seasonTable(c, S);
  const base = gateCalc(c, { key: 'RS', attract: 1, noHolders: true });
  const appeal = clamp(adAppeal(c), 0.7, 1.3) * (1 + T.opts.loyal * 1.5) * (T.opts.youth ? 1.04 : 1);
  const by = {};
  let n = 0, rev = 0;
  for (const s of c.stadium.sectors) {
    if (s.kind === 'away') continue;
    const p = P[s.id] || {}, k = K[s.id] || {};
    const row = { N: 0, U: 0, D: 0, R: 0 };
    for (const [cat, g] of [['N', 'N'], ['U', 'U'], ['D', 'D'], ['R', 'FAM']]) {
      const pk = k[cat], p1 = cat === 'R' ? p.R : p[cat];
      if (!(pk > 0)) continue;
      const single = p1 > 0 ? p1 : (cat === 'R' ? (2 * p.N + 2 * p.D) * 0.8 : p.N || 1);
      const value = home * single / pk;
      let share = lg.seasonShare * clamp(Math.pow(value / 1.15, 2.5), 0.1, 2.2) * appeal * (T.opts.vipAll && s.kind === 'vip' ? 1.4 : 1);
      const dem = ((base.alloc[g] || {})[s.id] || 0) / (cat === 'R' ? 4 : 1);
      row[cat] = dem * Math.min(0.95, share);
    }
    const persons = row.N + row.U + row.D + row.R * 4;
    const cap = s.seats * (s.numbered ? 0.85 : 0.7);
    if (persons > cap) { const f = cap / persons; for (const x of Object.keys(row)) row[x] *= f; }
    for (const x of Object.keys(row)) row[x] = Math.round(row[x]);
    by[s.id] = row;
    n += row.N + row.U + row.D + row.R * 4;
    rev += (row.N * k.N + row.U * k.U + row.D * k.D + row.R * (k.R || 0)) * (1 - T.opts.loyal * 0.6);
  }
  return { n, rev: Math.round(rev), price: n ? rev / n : 0, by, est: true };
}

// ---------- Mecze i zawody ----------
function leagueEventKey(stage) { return stage === 'RS' ? 'RS' : stage === 'F' ? 'F' : stage === 'BZ' ? 'BZ' : 'PO'; }
function leagueGate(home, away, fx, weather, forecast) {
  stadiumInit(home);
  const key = leagueEventKey(fx.stage);
  const attract = (0.75 + home.rep / 200 + away.rep / 400) / (0.75 + home.rep / 200 + 50 / 400) * LEAGUE_EVENTS[key].att;
  const awayMass = clamp((away.fans || 10000) / 20000, 0.3, 2.5) * 0.035 * (key === 'RS' ? 1 : 1.5);
  return gateCalc(home, { key, attract, rain: !!(weather && weather.rain), awayMass, noise: !forecast });
}
// Klub, na którego stadionie odbywają się zawody (miasto w opisie zawodów; klub musi mieć stadion w bazie)
function eventHost(ev) {
  if (!ev || !eventClassOf(ev)) return null;
  if (ev.hostId) return G.clubs[ev.hostId] || null;
  // DMPJ, Ekstraliga U24 i inne zawody drużynowe bez miasta w kalendarzu: gospodarzem jest pierwsza drużyna z awizowanych składów
  if (!ev.venue) {
    const u = (ev.units || []).find(x => x.clubId && G.clubs[x.clubId]);
    if (!u) return null;
    ev.hostId = u.clubId;
    return G.clubs[u.clubId];
  }
  return Object.values(G.clubs).find(c => c.stadium && (c.stadium.venueId || VENUE_OF[c.short]) && cityKey(c) && ev.venue.includes(cityKey(c))) || null;
}
function eventGateCalc(c, ev, forecast) {
  stadiumInit(c);
  const cls = eventClassOf(ev), E = EVENT_CLASSES[cls];
  const attract = cls === 'sgp' ? Math.max(3, c.stadium.capacity * 1.3 / c.stadium.demand) : E.att * (typeof orgStarFactor === 'function' ? orgStarFactor(ev) : 1); // obsada memoriału (js/memorial.js)
  return gateCalc(c, { key: `E:${ev.id}`, attract, rain: !!(ev.weather && ev.weather.rain), noise: !forecast });
}
// Imprezy sezonu na naszym stadionie (do cenników): nierozegrane i rozegrane
function hostedEvents(c, S = sportSeason()) {
  return Object.values(G.events).filter(e => e.season === S && eventClassOf(e) && eventHost(e) === c).sort(by(e => e.date));
}
// Rozliczenie zawodów po ich rozegraniu (wywoływane z advanceDay)
function eventGate(ev) {
  if (!ev || ev.gate || !ev.played || ev.cancelled) return;
  const c = eventHost(ev);
  if (!c || !c.fin) return;
  const m = ev.matchId && G.matches[ev.matchId];
  const g = eventGateCalc(c, { ...ev, weather: m && m.weather }, false);
  const cls = eventClassOf(ev), E = EVENT_CLASSES[cls], lg = FL(c), S = fyOf(ev.date);
  ev.gate = { att: g.att, rev: g.rev, fill: g.fill, cats: g.cats, hostId: c.id };
  if (m) m.attendance = g.att;
  if (g.rev) addTx(c.id, 'bilety', g.rev, `Bilety: ${ev.name} (${fmtNum(g.att)} widzów)`);
  if (g.att) addTx(c.id, 'gastronomia', Math.round(g.att * lg.gastro * 0.8), `Gastronomia: ${ev.name}`);
  // koszty organizacji: z konta celowego dotacji miasta na imprezy, jeśli moduł dotacji je udostępnia (js/finance.js)
  const charge = (amount, desc) => typeof finCharge === 'function' ? finCharge(c, 'imprezy', -amount, desc) : addTx(c.id, 'imprezy', -amount, desc);
  charge(E.org, `Organizacja zawodów: ${ev.name}`);
  if (E.fee) charge(E.fee, `Opłata licencyjna promotora: ${ev.name}`);
  const grant = typeof cityEventGrant === 'function' ? cityEventGrant(c, ev) : (E.city ? (addTx(c.id, 'miasto', E.city, `Wsparcie miasta: organizacja ${ev.name}`), E.city) : 0);
  gateStats(c, S, g, true);
  if (c.id === G.clubId) addMsg({ category: 'finanse', from: 'Dział organizacji imprez', title: `${ev.name}: ${fmtNum(g.att)} widzów`,
    body: `<p>Zawody na naszym stadionie: <b>${fmtNum(g.att)}</b> widzów (${Math.round(g.fill * 100)}% pojemności), bilety ${fmtMoney(g.rev)}, koszty organizacji ${fmtMoney(E.org + (E.fee || 0))}${grant ? `, wsparcie miasta ${fmtMoney(grant)}` : ''}.</p>`, link: '#/klub/frekwencja' });
}
// Prognoza wpływów i kosztów nierozegranych zawodów na naszym stadionie
function eventsForecast(c, S) {
  const out = [];
  if (!c.stadium.sectors) return out;
  for (const ev of hostedEvents(c, S).filter(e => !e.played && e.date > G.date)) {
    const g = eventGateCalc(c, ev, true), E = EVENT_CLASSES[eventClassOf(ev)], lg = FL(c);
    if (g.rev) out.push({ date: ev.date, kind: 'bilety', amount: g.rev, desc: `Bilety (prognoza): ${ev.name}` });
    if (g.att) out.push({ date: ev.date, kind: 'gastronomia', amount: Math.round(g.att * lg.gastro * 0.8), desc: `Gastronomia (prognoza): ${ev.name}` });
    out.push({ date: ev.date, kind: 'imprezy', amount: -E.org, desc: `Organizacja (prognoza): ${ev.name}` });
    if (E.fee) out.push({ date: ev.date, kind: 'imprezy', amount: -E.fee, desc: `Opłata promotora (prognoza): ${ev.name}` });
    if (E.city && typeof cityEventGrant !== 'function') out.push({ date: ev.date, kind: 'miasto', amount: E.city, desc: `Wsparcie miasta (prognoza): ${ev.name}` });
  }
  return out;
}
// Statystyki sezonu (do zmian bazy kibiców): frekwencja, wpływy, indeks cen, dzieci na trybunach
function gateStats(c, S, g, event) {
  const f = c.fin;
  f.gate = f.gate || {};
  const x = f.gate[S] || (f.gate[S] = { n: 0, att: 0, rev: 0, idx: 0, kids: 0, ev: 0, evAtt: 0 });
  if (event) { x.ev++; x.evAtt += g.att; return; }
  x.n++; x.att += g.att; x.rev += g.rev; x.idx += g.idx; x.kids += (g.cats.D + g.cats.R / 2 + g.cats.F0) / Math.max(1, g.att);
}
// Skrót wyniku do zapisu meczu: frekwencja, wpływy, karnetowicze, kategorie i sektory
function gateSummary(g) {
  return { att: g.att, rev: g.rev, holders: Math.round(g.holders), fill: Math.round(g.fill * 1000) / 1000, idx: Math.round(g.idx * 1000) / 1000, key: g.key, cats: g.cats,
    sectors: Object.fromEntries(Object.entries(g.sectors).map(([id, x]) => [id, [x.n, Math.round(x.rev)]])) };
}
// Plan sezonu: wpływy z meczów domowych rundy zasadniczej (bilety jednorazowe, gastronomia, gadżety) przy obecnym cenniku
function stadiumMatchRevenue(c, S, homeN) {
  stadiumInit(c);
  const lg = FL(c), g = gateCalc(c, { key: 'RS', attract: 1, S });
  return homeN * (g.rev + g.att * (lg.gastro + lg.merch));
}
// Przychód z jednego meczu rundy zasadniczej przy cenach wyjściowych (do planu sezonu i doboru sponsorów)
function stadiumSeasonGate(c) {
  stadiumInit(c);
  const lg = FL(c), g = gateCalc(c, { key: 'RS', attract: 1 }), k = karnetSales(c, sportSeason());
  return (g.rev + g.att * (lg.gastro + lg.merch)) * homeRsCount(c) + k.rev;
}
// Średnia frekwencja w meczach ligowych sezonu (gdy brak meczów – popyt bazowy)
function avgAttendance(c, S = sportSeason()) {
  const x = c.fin && c.fin.gate && c.fin.gate[S];
  return x && x.n ? Math.round(x.att / x.n) : Math.min(c.stadium.capacity, Math.round(c.stadium.demand || c.stadium.attendance));
}

// ---------- Koniec sezonu: baza kibiców ----------
// Tanie bilety i dużo dzieci na trybunach budują bazę kibiców; drogie bilety ją kurczą (±kilka procent na sezon)
function stadiumSeasonEnd() {
  const S = G.season;
  for (const c of Object.values(G.clubs)) {
    const x = c.fin && c.fin.gate && c.fin.gate[S];
    if (!x || !x.n || !c.stadium.demand) continue;
    const idx = x.idx / x.n, kids = x.kids / x.n;
    const ref = crowdMix(c.tickets.defPolicy || c.tickets.policy), kidsRef = ref.D + ref.FAM / 2 + ref.F0;
    const f = 1 + clamp(0.05 * (1 - idx), -0.05, 0.04) + clamp(0.3 * (kids - kidsRef), -0.02, 0.03) + Math.min(0.01, x.evAtt / (c.stadium.demand * 40));
    c.fans = Math.round((c.fans || 5000) * f);
    c.stadium.demand = Math.round(c.stadium.demand * f);
    if (c.id === G.clubId && Math.abs(f - 1) >= 0.005) addMsg({ category: 'zarząd', from: 'Dział marketingu', title: `Kibice po sezonie ${S}: ${f > 1 ? '+' : ''}${((f - 1) * 100).toFixed(1).replace('.', ',')}%`,
      body: `<p>Średnia frekwencja w meczach ligowych: <b>${fmtNum(Math.round(x.att / x.n))}</b>. Ceny biletów względem cennika wyjściowego: <b>${Math.round(idx * 100)}%</b>; dzieci i rodziny: ${Math.round(kids * 100)}% widowni.</p><p>${f > 1 ? 'Przystępne ceny, bilety rodzinne i zawody młodzieżowe przyciągnęły nowych kibiców.' : 'Wysokie ceny zniechęciły część kibiców – baza kibiców zmalała.'}</p>`, link: '#/klub/frekwencja' });
  }
}
// Nowy sezon: klub AI wraca do cennika wyjściowego (przeskalowanego do ligi); klub gracza zachowuje swoje ceny
function ticketsNewSeason(c) {
  if (!c.tickets) return;
  if (c.id !== G.clubId) { c.tickets.prices = {}; c.tickets.season = null; return; }
  // cenniki zawodów z poprzedniego sezonu są nieaktualne
  for (const k of Object.keys(c.tickets.prices)) if (k.startsWith('E:')) { const ev = G.events[k.slice(2)]; if (!ev || ev.season < G.season) delete c.tickets.prices[k]; }
}
// Rozbudowa sektora (+1000 miejsc)
function expandSector(c, id, n = 1000) {
  const s = sectorById(c, id);
  if (!s) return false;
  s.seats += n; c.stadium.capacity += n;
  return true;
}
// Migracja zapisu: sektory, cenniki i popyt dla starych gier
function stadiumMigrate() {
  let ch = false;
  for (const c of Object.values(G.clubs)) if (!c.tickets || !c.stadium.sectors || c.stadium.demand == null) { stadiumInit(c); ch = true; }
  return ch;
}
