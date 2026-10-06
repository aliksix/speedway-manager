#!/usr/bin/env node
// Test lig zagranicznych bez przeglądarki: nowa gra, sezon 2026 dzień po dniu, kontrola meczów, tabel, play-off i mistrzostw krajowych.
// Uruchomienie: node tools/test-foreign.cjs [data_końcowa=2026-10-20]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Intl, Math, Date, JSON, Set, Map, Object, Array, Number, String };
vm.createContext(ctx);
for (const [, f] of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="([^"]+\.js)"/g)) {
  if (/js\/(ui-|db\.)/.test(f)) continue;
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`if (typeof standingsRows === 'undefined' && typeof recordSeasonHonours === 'function') recordSeasonHonours = () => {};`, ctx); // js/honours-game.js korzysta z funkcji interfejsu
const until = process.argv[2] || '2026-10-20';
const out = vm.runInContext(`
  (() => {
    const t0 = Date.now();
    newGame({ clubId: 9, manager: 'Test' });
    const created = Object.values(G.riders).filter(r => r.foreignOnly).length;
    let guard = 0;
    while (G.date < '${until}' && guard++ < 3000) {
      const r = advance(7);
      if (r.stop === 'match') { const f = r.fixture; const m = G.matches[f.matchId] || createMatch(f); simulateMatch(m); afterFixture(f); }
    }
    const errs = [], S = Number('${until}'.slice(0, 4)), leagues = {};
    for (const lg of Object.keys(FP.leagues)) {
      const fx = Object.values(G.ffix).filter(f => f.lg === lg && f.season === S);
      const reg = fx.filter(f => f.st === 'RS' || f.st === 'R'), po = fx.filter(f => !['RS', 'R'].includes(f.st));
      const heats = fx.filter(f => f.res).map(f => f.res.heats ? f.res.heats.length : 0);
      const T = fStandings(lg, S);
      leagues[lg] = { reg: reg.filter(f => f.played).length + '/' + reg.length, cancelled: fx.filter(f => f.cancelled).length, po: po.map(f => f.st + (f.tie || '') + '/' + (f.played ? 'ok' : '-')).join(' '),
        heats: heats.length ? Math.min(...heats) + '-' + Math.max(...heats) : '-', skipped: [...new Set(fx.filter(f => f.res && f.res.skipped).map(f => f.res.skipped.join(',')))].slice(0, 4).join(' | '), champ: G.fseasons[S].champions[lg] ? fClubName(G.fseasons[S].champions[lg]) : '-', top: T.slice(0, 3).map(r => fClubShort(r.cid) + ':' + r.tp).join(' ') };
      const expH = fTable(FP.leagues[lg].table === 'gb-15' ? 'gb-15-set-1' : FP.leagues[lg].table).heatCount;
      for (const f of reg) if (f.played && !f.cancelled && f.res && f.res.heats && f.res.heats.length < expH - 2) errs.push(lg + ' ' + f.id + ': tylko ' + f.res.heats.length + ' biegów');
      if (G.date > S + '-10-10' && !G.fseasons[S].champions[lg] && lg !== 'GBP') errs.push(lg + ': brak mistrza');
    }
    // średnie zawodników w ligach (min. 20 biegów)
    const avgs = {};
    for (const r of Object.values(G.riders)) for (const [lg, s] of Object.entries((r.fstats || {})[S] || {})) if (s.h >= 20) (avgs[lg] ||= []).push({ n: r.name, a: Math.round((s.p + (s.b || 0)) / s.h * 100) / 100, sk: Math.round(r.skill * 10) / 10 });
    const best = Object.fromEntries(Object.entries(avgs).map(([lg, l]) => [lg, l.sort((a, b) => b.a - a.a).slice(0, 3).map(x => x.n + ' ' + x.a + ' (' + x.sk + ')').join('; ')]));
    // zawodnicy jadący tego samego dnia w Polsce i za granicą
    let clash = 0; const clashes = [];
    for (const f of Object.values(G.ffix)) if (f.res) for (const id of Object.keys(f.res.riders)) if (f.res.riders[id].heats) { const mm = Object.values(G.matches).find(m => m.date === f.d && m.riders && m.riders[id] && m.riders[id].heats); if (mm) { clash++; clashes.push([f.id, G.riders[id] && G.riders[id].name, mm.id, mm.kind, mm.comp || '']); } }
    if (clash) errs.push('zawodnicy w dwóch meczach jednego dnia: ' + clash + ' ' + JSON.stringify(clashes.slice(0, 3)));
    const champs = Object.values(G.events).filter(e => e.kind === 'comp' && /^N_/.test(e.comp) && e.season === S);
    const ch = champs.map(e => e.comp + ' ' + e.date + ' ' + (e.played ? (e.cancelled ? 'odwołane' : (G.riders[e.winner] || {}).name || e.winner) : '-'));
    const mine = Object.values(G.riders).filter(r => r.clubId === G.clubId && r.fl && r.fl.list.length).map(r => r.name + ': ' + r.fl.list.map(x => x.id).join('/') + (r.fl.dropped.length ? ' (bez ' + r.fl.dropped.map(x => x.id).join('/') + ')' : ''));
    const poDbg = Object.values(G.ffix).filter(f => ['GBP','GBN'].includes(f.lg) && !['RS','R'].includes(f.st)).map(f => f.lg + ' ' + f.st + f.tie + '-' + f.leg + ' ' + f.d + ' ' + (f.played ? 'ok' : '-') + (f.cancelled ? ' cancelled' : ''));
    return { ms: Date.now() - t0, date: G.date, poDbg, created, errs: errs.slice(0, 20), nErr: errs.length, leagues, best, ch, mine,
      foreignInjuries: Object.values(G.injuries).filter(i => /: /.test(i.where) && Object.values(FP.leagues).some(L => i.where.startsWith(L.name))).length,
      size: JSON.stringify(G.ffix).length };
  })()
`, ctx);
console.log(JSON.stringify(out, null, 1));
if (out.nErr) process.exitCode = 1;
