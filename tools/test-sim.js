#!/usr/bin/env node
// Test logiki gry bez przeglądarki: nowa gra, symulacja sezonów, kontrola spójności.
// Uruchomienie: node tools/test-sim.js [liczba_sezonów]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Intl, Math, Date, JSON, Set, Map, Object, Array, Number, String };
vm.createContext(ctx);
for (const [,f] of fs.readFileSync(path.join(ROOT,'index.html'),'utf8').matchAll(/<script src="([^"]+\.js)"/g)) {
  if (/js\/(ui-|db\.)/.test(f)) continue;
  vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
}

const seasons = Number(process.argv[2]) || 1;
const out = vm.runInContext(`
  (() => {
    const t0 = Date.now();
    newGame({ clubId: 9, manager: 'Test' });
    const report = [];
    const startSeason = G.season;
    let guard = 0;
    while (G.date < (startSeason + ${seasons} + '-11-02') && guard++ < 5000) {
      const r = advance(7);
      if (r.stop === 'match') { const f = r.fixture; const m = G.matches[f.matchId] || createMatch(f); simulateMatch(m); afterFixture(f); }
    }
    const errs = [];
    if (!Object.values(G.matches).some(m => m.kind === 'league')) errs.push('brak rozegranych meczów');
    if (guard >= 5000) errs.push('nie ukończono sezonu');
    for (const f of Object.values(G.fixtures)) if (f.season === startSeason + 1 && G.season > startSeason + 1 && !f.played) errs.push('nierozegrany ' + f.id);
    for (const m of Object.values(G.matches)) if (m.kind === 'league' && m.heats.length !== 15) errs.push('mecz ' + m.id + ' biegów ' + m.heats.length);
    for (const lg of LEAGUE_ORDER) {
      const t = G.history[0];
      report.push(lg + ': mistrz ' + (t ? G.clubs[t.champions[lg]].name : '?'));
    }
    const sample = Object.values(G.matches).find(m => m.kind === 'league');
    const tot = Object.values(G.matches).filter(m => m.kind === 'league').map(m => m.score.H + m.score.A);
    const avgSum = tot.reduce((a, b) => a + b, 0) / tot.length;
    const homeWins = Object.values(G.fixtures).filter(f => f.played && f.homePts > f.awayPts).length / Object.values(G.fixtures).filter(f => f.played).length;
    const top = Object.values(G.riders).filter(r => r.career.length).map(r => ({ n: r.name, s: r.skill.toFixed(2), avg: r.career[0].avg, h: r.career[0].heats })).filter(x => x.h > 30).sort((a, b) => b.avg - a.avg).slice(0, 8);
    const me = G.clubs[G.clubId];
    const cash = Object.values(G.clubs).map(c => c.short + ':' + Math.round(c.cash / 1000) + 'k');
    const sgp = Object.entries(G.history[0] ? { w: G.history[0].world } : {}).map(([k, v]) => G.riders[v] && G.riders[v].name);
    return { ms: Date.now() - t0, date: G.date, season: G.season, errs: errs.slice(0, 10), nErr: errs.length, report, avgSum, homeWins, top, cash, sgp,
      injuries: Object.keys(G.injuries).length, msgs: Object.keys(G.messages).length, tx: Object.keys(G.transactions).length,
      squads: Object.values(G.clubs).map(c => c.short + ':' + clubRiders(c.id).length), sampleHeat: sample && sample.heats[4].log,
      moves: G.history.map(h => h.moves.map(m => G.clubs[m[0]].short + '→' + m[1]).join(' ')),
      fim: G.fimLift ? { decided: G.fimLift.decided, from: G.fimLift.from } : null, // decyzje FIM o zawieszonych federacjach
      size: JSON.stringify(G).length };
  })()
`, ctx);
console.log(JSON.stringify(out, null, 1));
if (out.nErr) process.exitCode = 1;
