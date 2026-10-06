// Sukcesy zawodników: historia do 2025 (js/honours.js – Speedway History Info, FIM, Wikipedia) i wyniki sezonów rozegranych w grze (x.honours)
// Wynik końcowy rozgrywek: klasyfikacja cyklu (SGP, SGP2, IMP, SEC…), w innym razie finał; DMP – podium najwyższej ligi.
const HON_GAME = { SGP: 'IMS', SGP2: 'IMSJ', SGP3: 'MS250', SGP4: 'MS125', SWC: 'DMS', SON2: 'DMSJ', SEC: 'IME', EPC: 'MEP', ETC: 'DME', EU19: 'IMEJ',
  IMP: 'IMP', ZK: 'ZK', MPPK: 'MPPK', SK: 'SK', BK: 'BK', MIMP: 'MIMP', MMPPK: 'MMPPK', DMPJ: 'MDMP', MACEC: 'MACEC',
  // młodzież: 500R, U17/U19 i miniżużel 85–140 (js/mini-rules.js)
  IPEU17: 'IPEU17', IP2EU19: 'IP2EU19', IMP500: 'IMP500', IPE500: 'IPE500', PG500: 'PG500', DPE500: 'DPE500', DP2E500: 'DP2E500',
  MINI_IMP: 'IMPMINI', MINI_DMP: 'DMPMINI', MINI_MPPK: 'MPPKMINI', MINI_IPP: 'IPPMINI', MINI_IPE: 'IPEMINI', MINI_DPE: 'DPEMINI' };
// Rozgrywki młodzieżowe spoza słownika historii (js/honours.js): [nazwa, skrót, grupa, ranga, miejsca 4–8]
const HON_EXTRA = {
  IPEU17: ['Indywidualny Puchar Ekstraligi U17', 'IPE U17', 'Polska', 30, 0], IP2EU19: ['Indywidualny Puchar 2. Ekstraligi U19', 'IP2E U19', 'Polska', 28, 0],
  IMP500: ['Indywidualne mistrzostwa Polski 500R', 'IMP 500R', 'Polska', 26, 0], IPE500: ['Indywidualny Puchar Ekstraligi 500R', 'IPE 500R', 'Polska', 22, 0],
  PG500: ['Puchar GKSŻ 500R', 'Puchar GKSŻ 500R', 'Polska', 20, 0], DPE500: ['Drużynowy Puchar Ekstraligi 500R', 'DPE 500R', 'Polska', 20, 0],
  DP2E500: ['Drużynowy Puchar 2. Ekstraligi 500R', 'DP2E 500R', 'Polska', 18, 0],
  DMPMINI: ['Drużynowe mistrzostwa Polski w miniżużlu (85–140 cm³)', 'DMP mini', 'Polska', 19, 0], MPPKMINI: ['Mistrzostwa Polski par klubowych w miniżużlu', 'MPPK mini', 'Polska', 17, 0],
  IPPMINI: ['Indywidualny Puchar Polski 85–140 cm³', 'IPP mini', 'Polska', 16, 0], IPEMINI: ['Indywidualny Puchar Ekstraligi 85–140 cm³', 'IPE mini', 'Polska', 15, 0],
  DPEMINI: ['Drużynowy Puchar Ekstraligi 85–140 cm³', 'DPE mini', 'Polska', 14, 0],
};
// Mistrzostwa krajowe za granicą (js/foreign.js, N_<kraj>[_U21/_U19/_U23]): klucz historii „IM Francji” / „MIM Francji”, a gdy go brak – własny
const honNatRe = /^N_([A-Z]{3})(?:_(U\d\d))?$/;
function honNatKey(comp) {
  const mt = honNatRe.exec(comp);
  if (!mt || typeof COMPS === 'undefined' || !COMPS[comp]) return null;
  const gen = (typeof COUNTRY_GEN !== 'undefined' && COUNTRY_GEN[mt[1]]) || (COUNTRY[mt[1]] || mt[1]), short = `${mt[2] ? 'MIM' : 'IM'} ${gen}`;
  const hit = typeof HONOURS !== 'undefined' && Object.entries(HONOURS.comps).find(([k, v]) => k.startsWith('X:') && v[1] === short);
  return hit ? hit[0] : comp;
}
const honComp = k => (typeof HONOURS !== 'undefined' && HONOURS.comps[k]) || HON_EXTRA[k]
  || (honNatRe.test(k) && typeof COMPS !== 'undefined' && COMPS[k] ? [COMPS[k].name, `${/_U\d\d$/.test(k) ? 'MIM' : 'IM'} ${(typeof COUNTRY_GEN !== 'undefined' && COUNTRY_GEN[k.slice(2, 5)]) || k.slice(2, 5)}`, 'kraj', /_U\d\d$/.test(k) ? 30 : 40, 0] : null); // [nazwa, skrót, grupa, ranga, miejsca 4–8]
// klucz sukcesu dla rozgrywek z gry
const honKeyOf = comp => HON_GAME[comp] || honNatKey(comp);
const honLimit = k => (honComp(k) && honComp(k)[4] ? 8 : 3);
// historia (zgodny rocznik – imiennicy nie dzielą medali) + sezony z gry
function riderHonours(x) {
  if (!x) return [];
  const out = new Map();
  const hist = typeof HONOURS !== 'undefined' ? HONOURS.people[x.name] : null, by = typeof HONOURS !== 'undefined' ? HONOURS.by[x.name] : null;
  const y = Number(String(x.born || '').slice(0, 4));
  if (hist && (!by || !y || Math.abs(by - y) <= 1)) for (const h of hist) out.set(`${h[0]}|${h[1]}`, h);
  for (const h of x.honours || []) out.set(`${h[0]}|${h[1]}`, h); // [klucz, sezon, miejsce, link do wyniku w grze]
  return [...out.values()].filter(h => honComp(h[0]) && h[2] <= honLimit(h[0]));
}
// lista pogrupowana: rozgrywki → miejsce → lata (od najcenniejszych); links: rok → ekran wyniku w grze
function honourGroups(list) {
  const g = new Map();
  for (const [k, y, p, href] of list) {
    const key = `${k}|${p}`;
    if (!g.has(key)) g.set(key, { k, p, years: [], links: {} });
    g.get(key).years.push(y);
    if (href) g.get(key).links[y] = href;
  }
  const val = x => honComp(x.k)[3] * 10 - (x.p <= 3 ? x.p * 12 : 40 + x.p * 4); // złoto IMŚ > srebro > brąz > 4.–8. IMŚ > złoto IMŚJ…
  return [...g.values()].map(x => ({ ...x, years: x.years.sort((a, b) => b - a) })).sort((a, b) => val(b) - val(a));
}
const honYears = x => x.years.map(y => (x.links[y] ? `<a href="${x.links[y]}">${y}</a>` : y)).join(', ');
function medalIcon(p) {
  const c = { 1: ['#e4b62c', '#9a7410'], 2: ['#c9ced6', '#7d838c'], 3: ['#cd8a4f', '#7f4e22'] }[p];
  if (!c) return `<span class="medal-pos">${p}.</span>`;
  return `<svg class="medal" viewBox="0 0 20 20" width="18" height="18" aria-label="${p}. miejsce"><path d="M6 1h3l1 6H7zM11 1h3l-1 6h-3z" fill="#3b6fb6"/><circle cx="10" cy="12.5" r="6.5" fill="${c[0]}" stroke="${c[1]}" stroke-width="1.2"/><text x="10" y="15.6" text-anchor="middle" font-size="8.5" font-weight="700" fill="${c[1]}">${p}</text></svg>`;
}
// wpis sukcesu (zawodnik albo adept; adept, który zdał już egzamin – sukces trafia do zawodnika)
function honAdd(season, kidMap) {
  return (id, k, p, href) => {
    if (!p || p > honLimit(k)) return;
    const x = G.riders[id] || G.academy[id] || G.riders[kidMap.get(String(id))];
    if (!x) return;
    x.honours = (x.honours || []).filter(h => !(h[0] === k && h[1] === season));
    x.honours.push([k, season, p, href]);
  };
}
// Sukcesy jednych rozgrywek – gdy wszystkie ich zawody w sezonie są rozegrane (lub odwołane). Zwraca true po zapisie.
function recordCompHonours(comp, season, add) {
  const k = honKeyOf(comp);
  if (!k || !honComp(k)) return false;
  const list = compEvents(comp, season);
  if (!list.length || list.some(e => !e.played && !e.cancelled)) return false;
  add = add || honAdd(season, typeof kidRiderMap === 'function' ? kidRiderMap() : new Map());
  const riders = (key, evs) => { // zawodnicy jednostki (para, drużyna), którzy wystartowali
    const ids = new Set();
    for (const e of evs) { const m = e.played && G.matches[e.matchId]; if (m && m.units && m.units[key]) m.units[key].riders.forEach(id => { if (m.riders[id] && m.riders[id].heats) ids.add(id); }); }
    return [...ids];
  };
  const c = evComp(list[0]);
  if (c.series || c.table) {
    const href = `#/rozgrywki/${encodeURIComponent(comp)}/klasyfikacja/${season}`;
    let rows = standingsRows(comp, season, list);
    if (!rows.length && comp === 'SGP') { // klasyfikacja SGP (G.sgp) czyszczona na nowy sezon – suma punktów rund z protokołów
      const t = {};
      for (const e of list) { const m = e.played && G.matches[e.matchId]; for (const x of (m && m.classification) || []) if (x.riderId != null) t[x.riderId] = (t[x.riderId] || 0) + (x.gp || 0); }
      rows = Object.entries(t).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).map(([id, p]) => ({ id, p }));
    }
    rows.forEach((r, i) => { if (c.table) riders(r.id, list).forEach(id => add(id, k, i + 1, href)); else add(r.id, k, i + 1, href); });
    return rows.length > 0;
  }
  const fin = list.filter(e => e.stage === 'finał').pop() || (list.length === 1 ? list[0] : null);
  const m = fin && fin.played && G.matches[fin.matchId];
  if (!m || !m.classification) return false;
  for (const x of m.classification) {
    if (x.riderId != null) add(x.riderId, k, x.place, `#/gp/${fin.id}`);
    else riders(x.key, [fin]).forEach(id => add(id, k, x.place, `#/gp/${fin.id}`));
  }
  return true;
}
// rozgrywki z gry, z których zapisujemy sukcesy: słownik HON_GAME + mistrzostwa krajowe za granicą
const honComps = () => [...Object.keys(HON_GAME), ...(typeof COMPS !== 'undefined' ? Object.keys(COMPS).filter(k => honNatRe.test(k)) : [])];
// Zaraz po zawodach (js/game.js): ostatnie zawody rozgrywek – sukcesy od razu w profilach, bez czekania na koniec sezonu
function recordEventHonours(ev) {
  if (!ev || !ev.played || typeof compEvents !== 'function') return;
  const comp = ev.kind === 'sgp' ? 'SGP' : ev.kind === 'comp' ? compKey(ev) : null;
  if (comp) recordCompHonours(comp, ev.season);
}
// zapis sukcesów sezonu rozegranego w grze (koniec sezonu, js/game.js) – results: kolejność lig z finalStandings
function recordSeasonHonours(season, results) {
  const add = honAdd(season, typeof kidRiderMap === 'function' ? kidRiderMap() : new Map());
  for (const comp of honComps()) recordCompHonours(comp, season, add);
  // DMP: podium Ekstraligi – zawodnicy, którzy jechali w drużynie w tym sezonie (kariera: klub sezonu, także po późniejszym transferze)
  (results.PGE || []).slice(0, 3).forEach((cid, i) => Object.values(G.riders).filter(r => (r.career || []).some(c => c.season === season && c.clubId === cid && c.m) || (r.clubId === cid && (r.stats[season] || {}).m && !(r.career || []).some(c => c.season === season)))
    .forEach(r => add(r.id, 'DMP', i + 1, `#/zespol/${cid}/historia`)));
  G.honSeasons = [...new Set([...(G.honSeasons || []), season])];
}
// Zapisy sprzed zapisu sukcesów: zakończone sezony z gry odtwarzane z zawodów (G.events) i tabel ligowych (historia klubów)
function backfillHonours() {
  let done = false;
  const redo = G.honMiniV !== 2; // 1: miniżużel i klasy młodzieżowe; 2: mistrzostwa krajowe za granicą – ponowny zapis rozegranych sezonów
  G.honMiniV = 2;
  for (let s = START_SEASON + 1; s < G.season; s++) {
    if (!redo && (G.honSeasons || []).includes(s)) continue;
    const results = {};
    for (const c of Object.values(G.clubs)) for (const h of c.history || []) if (h.season === s) (results[h.league] = results[h.league] || [])[h.pos - 1] = c.id;
    for (const lg of Object.keys(results)) results[lg] = results[lg].filter(Boolean);
    recordSeasonHonours(s, results);
    done = true;
  }
  // bieżący sezon: rozgrywki zakończone przed zapisem sukcesów zaraz po zawodach (recordEventHonours)
  if (G.honLiveV !== 1 && typeof compEvents === 'function') {
    G.honLiveV = 1;
    const add = honAdd(G.season, typeof kidRiderMap === 'function' ? kidRiderMap() : new Map());
    for (const comp of honComps()) if (recordCompHonours(comp, G.season, add)) done = true;
  }
  return done;
}
