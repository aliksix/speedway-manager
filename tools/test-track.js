#!/usr/bin/env node
// Test modelu toru (js/track.js): neutralność, przygotowanie, komisarz toru, próba toru, przerwy techniczne, wpływ na wyniki biegów.
// Uruchomienie: node tools/test-track.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Intl, Math, Date, JSON, Set, Map, Object, Array, Number, String, assert };
vm.createContext(ctx);
for (const [, f] of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="([^"]+\.js)"/g)) {
  if (/js\/(ui-|db\.)/.test(f)) continue;
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const out = vm.runInContext(`(() => {
  const log = [];
  // 1. tor przyczepny i równy: brak modyfikatorów (zgodność z kalibracją)
  const n = surfFx({ g: [0.5, 0.5, 0.5], moist: 0.5, ruts: 0 });
  for (const k of ['surfW', 'inK', 'time']) assert.strictEqual(n[k], 0, k);
  for (const k of ['startW', 'bonusK', 'noiseK', 'passK', 'outK', 'fallK']) assert.strictEqual(n[k], 1, k);
  assert.deepStrictEqual(n.gate, { A: 0.45, B: 0.2, C: 0.05, D: -0.1 });
  // 2. pola startowe z profilu: grząsko przy krawężniku, twardo na zewnętrznej – premia dla pola D
  const o = surfFx({ g: [0.75, 0.52, 0.42], moist: 0.5, ruts: 0.1 });
  assert(o.gate.D > o.gate.A, 'pole D lepsze od A przy grząskim krawężniku');
  log.push('pola (grząski krawężnik): ' + Object.entries(o.gate).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', '));

  newGame({ clubId: 9, manager: 'Tor' });
  G.season = 2026; G.date = '2026-04-01'; makeLeagueFixtures(2026);
  const fxs = Object.values(G.fixtures).filter(f => f.league === 'PGE' && f.season === 2026);
  // 3. mecz ligowy AI: tor, komisarz, próba toru, 4 przerwy techniczne, stan toru po biegach
  const fa = fxs.find(f => f.homeId !== G.clubId && f.awayId !== G.clubId);
  const ma = createMatch(fa);
  assert(ma.surf && ma.surf.komisarz && ma.surf.ctl === 'H', 'tor meczu ligowego');
  assert.strictEqual(ma.trackTest.H.length, 2); assert.strictEqual(ma.trackTest.A.length, 2);
  assert(ma.know.H > 0 && ma.know.A > 0 && ma.testReport.A, 'próba toru');
  simulateMatch(ma);
  assert.strictEqual(ma.heats.length, 15);
  assert.deepStrictEqual(ma.breaks.map(b => b.after), [4, 7, 10, 13], 'przerwy po biegach IV, VII, X, XIII');
  assert(ma.heats.every(h => h.surf), 'stan toru po każdym biegu');
  assert(ma.heats[4].log[0].includes('Przerwa techniczna'), 'komentarz przerwy w biegu V');
  log.push('mecz AI: ' + ma.weather.track + ' · ' + ma.testReport.A);
  // 4. plan gracza poza normą – komisarz toru koryguje; gracz wskazuje zawodników na próbę
  const fu = fxs.find(f => f.homeId === G.clubId && !f.matchId);
  G.trackPlan = { def: { g: [0.95, 0.6, 0.1], moist: 0.95 } };
  const lineup = validLineup(G.clubId, autoLineup(G.clubId), fu.date);
  G.trackTest = { [fu.id]: [lineup[5]] };
  const mu = createMatch(fu);
  assert(mu.surf.note && /Komisarz/.test(mu.surf.note), 'korekta komisarza');
  assert(Math.max(...mu.surf.plan.g) <= KOMISARZ.hi && Math.min(...mu.surf.plan.g) >= KOMISARZ.lo);
  assert.deepStrictEqual(mu.trackTest.H, [lineup[5]]);
  // polecenia gracza w przerwie
  for (let i = 0; i < 4; i++) playNextHeat(mu);
  assert.strictEqual(mu.pendingBreak, 4);
  mu.breakOrders = { water: 2, mat: 'in' };
  const before = mu.surf.moist;
  playNextHeat(mu);
  assert(mu.breaks[0].by === 'gracz' && mu.breaks[0].water === 2, 'polecenia gracza');
  assert(mu.heats[3].surf.moist < before + 0.5 && mu.heats[4].log[0].includes('mocne polewanie'));
  simulateMatch(mu);
  log.push('mecz gracza: ' + mu.surf.note);
  // 5. zawody z tabeli biegowej i ligi zagraniczne
  const ids = Object.values(G.riders).filter(r => r.active !== false).sort((a, b) => b.skill - a.skill).slice(0, 16).map(r => r.id);
  const ev = { id: 'trk-ind', kind: 'comp', comp: 'IMP', season: 2026, date: G.date, name: 'Test', venue: 'Leszno' };
  const em = tableMeeting(ev, SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES, 'individual-16-20'), ids, null);
  assert(em.surf && em.surf.ctl === 'ref', 'tor zawodów indywidualnych');
  assert.strictEqual(em.heats.filter(h => h.log.some(l => /Przerwa techniczna/.test(l))).length, 4, 'przerwy po 4, 8, 12, 16');
  // 6. wpływ na bieg: głęboki tor – więcej mijanek, twardy – start decyduje; grząski krawężnik – lepsze pole D
  const top = Object.values(G.riders).filter(r => r.active !== false && r.skill > 8).slice(0, 40).map(r => r.id);
  const W = { temp: 20, rain: false, sky: 'pochmurno', track: 'przyczepny' };
  const stats = (g, moist) => {
    let passes = 0, falls = 0, gw = { A: 0, B: 0, C: 0, D: 0 };
    for (let i = 0; i < 8000; i++) {
      const pick = []; while (pick.length < 4) { const id = top[Math.floor(rnd() * top.length)]; if (!pick.includes(id)) pick.push(id); }
      const h = runHeat(pick.map((id, j) => ({ riderId: id, team: 'X' + j, gate: 'ABCD'[j] })), { homeClubId: -1, weather: W, track: 350, surf: { g: g.slice(), moist, ruts: 0.1 } });
      passes += h.passes; falls += h.res.filter(x => x.status === 'u' || x.status === 'w').length;
      const st = /pole ([ABCD])/.exec(h.log[0] || ""); if (st) gw[st[1]]++; // prowadzący po starcie
    }
    for (const id of top) { const r = G.riders[id]; r.cond = 100; r.injury = null; }
    return { passes: passes / 8000, falls: falls / 8000, gw };
  };
  const hard = stats([0.34, 0.36, 0.38], 0.36), std = stats([0.5, 0.5, 0.5], 0.5), deep = stats([0.72, 0.74, 0.76], 0.62), outer = stats([0.76, 0.52, 0.4], 0.5);
  log.push('mijanki/bieg: twardy ' + hard.passes.toFixed(2) + ', standard ' + std.passes.toFixed(2) + ', głęboki ' + deep.passes.toFixed(2));
  log.push('upadki/bieg: twardy ' + hard.falls.toFixed(3) + ', standard ' + std.falls.toFixed(3) + ', głęboki ' + deep.falls.toFixed(3));
  log.push('prowadzenie po starcie z pól (standard): ' + JSON.stringify(std.gw) + ' · (grząski krawężnik): ' + JSON.stringify(outer.gw));
  console.log(log.slice(-3).join(' | '));
  assert(deep.passes > std.passes && std.passes > hard.passes, 'mijanki rosną z głębokością toru');
  assert(outer.gw.D > std.gw.D && outer.gw.A < std.gw.A, 'grząski krawężnik: rzadziej prowadzi A, częściej D');
  // 7. AI gospodarza dobiera tor pod drużynę; bilans planu dla gracza
  const b = planBalance(fu.homeId, lineup, validLineup(fu.awayId, autoLineup(fu.awayId), fu.date), TRACK_PRESETS.hard);
  assert(Number.isFinite(b.net));
  return log;
})()`, ctx, { timeout: 600000 });
console.log(out.join('\n'));
console.log('OK');
