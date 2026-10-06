'use strict';
// Rozstrzyganie remisów punktowych (regulaminy: FIM Europe Track Racing Rules 2026 art. 27, FIM SGP 2025 art. 9.3,
// PZM – Regulamin IMP i MIMP 2026 art. 634a, 638, 643; źródła w tools/sources/regulaminy):
// - bieg dodatkowy: o 1. miejsce zawodów, o miejsca 1–3 w klasyfikacji końcowej mistrzostw / pucharu, o ostatnie miejsce
//   awansowe i miejsce rezerwowego; w parach i drużynach jedzie po jednym zawodniku każdej jednostki (nominacja menedżera);
// - pozostałe remisy: liczba 1., 2., 3. i 4. miejsc („0” lepsze od wykluczenia / defektu), potem wynik bezpośrednich
//   spotkań („kto kogo pokonał”), w parach i drużynach – ranking (rozstawienie), na końcu losowanie;
// - cykle: SGP / SGP2 – bieg dodatkowy o tytuł, dalej liczba wygranych rund, drugich miejsc… i miejsce w ostatniej rundzie;
//   pozostałe cykle (IMP, IME…) – bieg dodatkowy o miejsca 1–3, dalej liczba miejsc w biegach wszystkich rund.

const RUNOFF = 'run-off';
const isRunOff = h => h.phase === RUNOFF;
const tieBallot = (seed, id) => hashStr(`${seed}:${id}`);

// Miejsca w biegach zawodnika (bez biegów dodatkowych): [1., 2., 3., 4.]
function heatPlaces(m, id) {
  const p = [0, 0, 0, 0];
  for (const h of m.heats || []) {
    if (isRunOff(h)) continue;
    const x = h.res.find(r => String(r.riderId) === String(id));
    if (x && x.pos >= 1 && x.pos <= 4) p[x.pos - 1]++;
  }
  return p;
}
const cmpPlaces = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]; return 0; };

// Kolejność z kluczem (malejąco) i rozstrzyganiem grup równych: resolve(grupa) → uporządkowana grupa
function orderGroups(ids, cmp, resolve) {
  const s = ids.slice().sort(cmp), out = [];
  for (let i = 0; i < s.length;) {
    let j = i + 1;
    while (j < s.length && cmp(s[i], s[j]) === 0) j++;
    out.push(...(j - i > 1 ? resolve(s.slice(i, j)) : [s[i]]));
    i = j;
  }
  return out;
}

// Bezpośrednie spotkania w grupie remisujących: 2 zawodników – kto był wyżej, 3 – kto pokonał obu, 4+ – bilans zwycięstw
// w grupie, potem podgrupy; nierozstrzygnięte – losowanie
function headToHead(m, ids, seed) {
  const key = String, set = new Set(ids.map(key)), wins = Object.fromEntries(ids.map(id => [key(id), 0]));
  for (const h of m.heats || []) {
    if (isRunOff(h)) continue;
    const met = h.res.filter(x => set.has(key(x.riderId)));
    for (const a of met) for (const b of met) if (a !== b && a.pos && (!b.pos || a.pos < b.pos)) wins[key(a.riderId)]++;
  }
  const ballot = g => g.slice().sort((a, b) => tieBallot(seed, a) - tieBallot(seed, b));
  return orderGroups(ids, (a, b) => wins[key(b)] - wins[key(a)], g => (g.length < ids.length ? headToHead(m, g, seed) : ballot(g)));
}

// Kolejność zawodników z równą liczbą punktów biegowych (bez biegu dodatkowego)
function riderTieOrder(m, ids, opt = {}) {
  const pl = Object.fromEntries(ids.map(id => [String(id), heatPlaces(m, id)]));
  const seed = m.id;
  return orderGroups(ids, (a, b) => cmpPlaces(pl[String(a)], pl[String(b)]), g => {
    if (!opt.sgp) return headToHead(m, g, seed);
    // SGP (art. 9.3): najszybszy czas biegu w zawodach, potem miejsce w klasyfikacji cyklu
    const best = id => Math.min(...(m.heats || []).filter(h => !isRunOff(h) && h.time && h.res.some(x => String(x.riderId) === String(id) && x.pos === 1)).map(h => h.time), Infinity);
    const rank = id => { const i = (opt.ranking || []).indexOf(String(id)); return i < 0 ? 999 : i; };
    return g.slice().sort((a, b) => best(a) - best(b) || rank(a) - rank(b) || tieBallot(seed, a) - tieBallot(seed, b));
  });
}

// Pełna kolejność według punktów (malejąco) z rozstrzyganiem remisów
function rankByPoints(m, ids, pts, opt) {
  return orderGroups(ids, (a, b) => pts(b) - pts(a), g => riderTieOrder(m, g, opt));
}

// ---------- Bieg dodatkowy ----------
const RO_HELMETS = ['czerwony', 'niebieski', 'biały', 'żółty'];
const RO_GATES = { 2: ['A', 'C'], 3: ['A', 'B', 'C'], 4: ['A', 'B', 'C', 'D'] };
// Jeden bieg dodatkowy (2–4 zawodników, `ids` w kolejności wyboru pól); zwraca kolejność. Biegi nie liczą się do punktów zawodów.
function runOffHeat(m, ids, label, opt = {}) {
  const able = ids.filter(id => (opt.ok ? opt.ok(id) : m.riders[id] && !m.riders[id].out) && R(id) && available(R(id), m.date));
  const unable = ids.filter(id => !able.includes(id));
  if (able.length < 2) return [...able, ...unable];
  const gates = RO_GATES[able.length];
  const entries = able.map((id, i) => ({ riderId: isNaN(id) ? id : Number(id), gate: gates[i], helmet: RO_HELMETS[i], team: opt.team ? opt.team(id) : null }));
  const h = runHeat(entries, { homeClubId: -1, weather: m.weather, track: m.track || 350, mid: `${m.id}:ro${(m.heats || []).length}`, points: [3, 2, 1, 0], surf: m.surf });
  for (const id of h.injuries) { if (m.riders[id]) m.riders[id].out = true; if (G.riders[id]) injureRider(G.riders[id], m.date, label, null); }
  m.heats.push({ no: m.heats.length + 1, phase: RUNOFF, label, entries, res: h.res, time: h.time, log: h.log });
  m.names = m.names || {};
  for (const id of able) if (!m.names[id]) m.names[id] = R(id).name;
  const fin = h.res.filter(x => x.pos).sort((a, b) => a.pos - b.pos).map(x => x.riderId);
  const rest = able.filter(id => !fin.some(f => String(f) === String(id)));
  return [...fin, ...rest, ...unable].map(id => ids.find(x => String(x) === String(id)));
}
// Bieg(i) dodatkowy dla grupy: do 4 zawodników – jeden bieg; 5–6 – system z art. 643 regulaminu IMP (FIM SGP art. 9.4);
// więcej – kolejność wg miejsc w biegach, bieg dodatkowy dla czterech pierwszych
function runOff(m, ids, label, opt) {
  if (ids.length <= 4) return runOffHeat(m, ids, label, opt);
  if (ids.length > 6) { const top = runOffHeat(m, ids.slice(0, 4), label, opt); return [...top, ...ids.slice(4)]; }
  const drawn = ids.slice().sort((a, b) => tieBallot(m.id + label, a) - tieBallot(m.id + label, b));
  const h1 = runOffHeat(m, drawn.slice(0, 3), `${label} – bieg 1`, opt), h2 = runOffHeat(m, drawn.slice(3), `${label} – bieg 2`, opt);
  const h3 = runOffHeat(m, [h1[1], h1[2], ...h2.slice(1)], `${label} – bieg 3`, opt);
  const fin = runOffHeat(m, [h1[0], h2[0], h3[0], h3[1]], `${label} – finał`, opt);
  return [...fin, ...h3.slice(2)];
}

// Pozycje (od 0) rozstrzygane biegiem dodatkowym w zawodach: 1. miejsce zawsze; 1–3 w mistrzostwach / pucharach rozgrywanych
// jako jedne zawody (finał); ostatnie miejsce awansowe i miejsce rezerwowego w eliminacjach
function runOffPlaces(ev) {
  const set = new Set([0]);
  const c = ev.kind === 'comp' && typeof compOf === 'function' ? compOf(ev) : null;
  if (c && !c.series && !c.table && c.group !== 'turnieje') [1, 2].forEach(i => set.add(i));
  const adv = typeof advanceInfo === 'function' && ev.kind === 'comp' ? advanceInfo(ev) : null;
  if (adv && adv.top) { set.add(adv.top - 1); set.add(adv.top); }
  return set;
}
const placeLabel = i => `o ${i + 1}. miejsce`;

// Zawody indywidualne, w których o kolejności decydują punkty (bez biegu finałowego): biegi dodatkowe na pozycjach z runOffPlaces
function applyRiderRunOffs(m, ev, order) {
  const pts = id => m.riders[id].pts, places = runOffPlaces(ev);
  const out = order.slice();
  for (let i = 0; i < out.length;) {
    let j = i + 1;
    while (j < out.length && pts(out[j]) === pts(out[i])) j++;
    const hit = [...places].filter(p => p >= i && p < j).sort((a, b) => a - b);
    if (j - i > 1 && hit.length) out.splice(i, j - i, ...runOff(m, out.slice(i, j), `Bieg dodatkowy ${placeLabel(hit[0])}`));
    i = j;
  }
  return out;
}

// Klasyfikacja par / drużyn: punkty, bieg dodatkowy (po jednym zawodniku jednostki) o 1. miejsce, miejsca 1–3 i awans,
// dalej miejsca zawodników jednostki w biegach, ranking (kolejność rozstawienia), losowanie
function unitOrder(m, ev, opt = {}) {
  const keys = Object.keys(m.units), seedIdx = k => { const i = (ev.units || []).findIndex(u => u.key === k); return i < 0 ? 99 : i; };
  const pl = Object.fromEntries(keys.map(k => [k, m.units[k].riders.map(id => heatPlaces(m, id)).reduce((s, p) => s.map((v, i) => v + p[i]), [0, 0, 0, 0])]));
  const tie = g => g.slice().sort((a, b) => cmpPlaces(pl[a], pl[b]) || seedIdx(a) - seedIdx(b) || tieBallot(m.id, a) - tieBallot(m.id, b));
  let order = orderGroups(keys, (a, b) => m.units[b].pts - m.units[a].pts, tie);
  if (opt.noRunOff) return order;
  const places = runOffPlaces(ev);
  for (let i = 0; i < order.length;) {
    let j = i + 1;
    while (j < order.length && m.units[order[j]].pts === m.units[order[i]].pts) j++;
    const hit = [...places].filter(p => p >= i && p < j).sort((a, b) => a - b);
    if (j - i > 1 && hit.length && j - i <= 4) {
      // nominacja menedżera: najlepszy punktowo zawodnik jednostki w tych zawodach, który może jechać
      const rep = k => m.units[k].riders.filter(id => m.riders[id] && !m.riders[id].out).sort((a, b) => m.riders[b].pts - m.riders[a].pts || (R(b).ca || 0) - (R(a).ca || 0))[0];
      const grp = order.slice(i, j), reps = grp.map(rep);
      const unitOf = id => grp[reps.findIndex(r => String(r) === String(id))];
      const res = runOffHeat(m, reps.filter(r => r != null), `Bieg dodatkowy ${placeLabel(hit[0])}`, { team: unitOf });
      const ranked = res.map(unitOf);
      order.splice(i, j - i, ...ranked, ...grp.filter(k => !ranked.includes(k)));
    }
    i = j;
  }
  return order;
}

// ---------- Klasyfikacja generalna cykli ----------
const SERIES_SGP_RULE = new Set(['SGP', 'SGP2']); // FIM SGP: bieg dodatkowy tylko o tytuł, dalej miejsca w rundach
function seriesEvents(key, season) {
  return Object.values(G.events).filter(e => (e.kind === 'sgp' ? 'SGP' : typeof compKey === 'function' ? compKey(e) : e.comp) === key && e.season === season).sort(by(e => e.date));
}
function seriesTableOf(key, season) {
  if (key === 'SGP' && G.sgp && G.sgp.season === season) return G.sgp.standings;
  return (G.series || {})[`${season}-${key}`] || null;
}
// Kolejność w cyklu: po zakończeniu – zapisana klasyfikacja końcowa (z biegami dodatkowymi); w trakcie – punkty i remisy
function seriesOrder(key, season, events) {
  const tab = seriesTableOf(key, season);
  if (!tab) return [];
  const ids = Object.keys(tab).filter(id => tab[id] > 0);
  const fin = (G.seriesFinal || {})[`${season}-${key}`];
  if (fin) return [...fin.filter(id => ids.includes(id)), ...ids.filter(id => !fin.includes(id)).sort((a, b) => tab[b] - tab[a])];
  return seriesRank(key, ids, tab, events || seriesEvents(key, season));
}
function seriesRank(key, ids, tab, events) {
  const ms = events.map(e => e.played && !e.cancelled && G.matches[e.matchId]).filter(m => m && m.classification);
  const last = ms[ms.length - 1];
  const lastPlace = id => { const x = last && last.classification.find(c => String(c.riderId) === id); return x ? x.place : 999; };
  let key2;
  if (SERIES_SGP_RULE.has(key)) { // liczba 1., 2., 3.… miejsc w rundach
    const pl = Object.fromEntries(ids.map(id => [id, Array.from({ length: 20 }, (_, i) => ms.filter(m => m.classification.some(c => String(c.riderId) === id && c.place === i + 1)).length)]));
    key2 = (a, b) => cmpPlaces(pl[a], pl[b]);
  } else { // liczba miejsc w biegach wszystkich rund (IMP art. 634a ust. 3)
    const pl = Object.fromEntries(ids.map(id => [id, ms.reduce((s, m) => heatPlaces(m, id).map((v, i) => v + s[i]), [0, 0, 0, 0])]));
    key2 = (a, b) => cmpPlaces(pl[a], pl[b]);
  }
  return orderGroups(ids, (a, b) => tab[b] - tab[a], g => g.slice().sort((a, b) => key2(a, b) || lastPlace(a) - lastPlace(b) || tieBallot(`${key}`, a) - tieBallot(`${key}`, b)));
}
// Po ostatniej rundzie: biegi dodatkowe o tytuł (SGP, SGP2) albo o miejsca 1–3, rozgrywane po ostatniej rundzie na jej torze;
// klasyfikacja końcowa zapisana w G.seriesFinal
function finalizeSeries(key, season) {
  const evs = seriesEvents(key, season);
  if (!evs.length || evs.some(e => !e.played && !e.cancelled)) return null;
  const done = `${season}-${key}`;
  G.seriesFinal = G.seriesFinal || {};
  if (G.seriesFinal[done]) return G.seriesFinal[done];
  const tab = seriesTableOf(key, season);
  if (!tab) return null;
  const order = seriesOrder(key, season, evs);
  const lastEv = evs.filter(e => e.played && !e.cancelled).pop(), m = lastEv && G.matches[lastEv.matchId];
  const places = SERIES_SGP_RULE.has(key) ? [0] : [0, 1, 2];
  if (m) for (let i = 0; i < order.length;) {
    let j = i + 1;
    while (j < order.length && tab[order[j]] === tab[order[i]]) j++;
    const hit = places.filter(p => p >= i && p < j);
    if (j - i > 1 && hit.length) order.splice(i, j - i, ...runOff(m, order.slice(i, j), `Bieg dodatkowy – klasyfikacja generalna ${placeLabel(hit[0])}`, { ok: id => !(m.riders[id] && m.riders[id].out) }));
    i = j;
  }
  G.seriesFinal[done] = order.map(String);
  return G.seriesFinal[done];
}
