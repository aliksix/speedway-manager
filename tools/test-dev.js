#!/usr/bin/env node
// Pomiar rozwoju zawodników: symulacja 1 sezonu (od startu gry do 1.11.2026) i zmiany CA / grup atrybutów według wieku.
// Uruchomienie: node tools/test-dev.js [katalog_js]   (domyślnie js/; podanie innego katalogu pozwala porównać wersje)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const JS = path.resolve(process.argv[2] || path.join(ROOT, 'js'));
const ctx = { console, Intl, Math, Date, JSON, Set, Map, Object, Array, Number, String };
vm.createContext(ctx);
const files = ['data.js', 'calendar.js', 'rosters2026.js', 'riderhistory.js', 'calib-data.js', 'util.js', 'nationality.js', 'world.js', 'ability.js', 'training.js', 'realdata.js', 'staff-born.js', 'staff-licences.js', 'coaches.js', 'engine.js', 'competitions.js', 'schedule.js', 'nations.js', 'adepts.js', 'game.js', 'market.js', 'finance-data.js', 'finance.js', 'sponsors.js', 'venue-data.js', 'stadium.js', 'planner.js'];
for (const f of files) {
  const p = fs.existsSync(path.join(JS, f)) ? path.join(JS, f) : path.join(ROOT, 'js', f);
  if (['training.js', 'schedule.js', 'nationality.js'].includes(f) && !fs.existsSync(path.join(JS, f))) continue;
  vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
const out = vm.runInContext(`
  (() => {
    const t0 = Date.now();
    newGame({ clubId: 9, manager: 'Test' });
    const groups = Object.keys(ATTRS);
    const gAvg = r => Object.fromEntries(groups.map(g => [g, ATTRS[g].list.reduce((s, [k]) => s + r.attrs[k], 0) / ATTRS[g].list.length]));
    const snap = () => Object.fromEntries(Object.values(G.riders).filter(r => r.active && !r.retired && r.ca != null).map(r => [r.id, { ca: r.ca, g: gAvg(r), age: ageYears(r.born) }]));
    const s0 = snap(), marks = { start: G.date };
    const phases = [];
    let prev = s0, guard = 0;
    const stopAt = ['2026-03-01', '2026-04-15', '2026-11-01'];
    for (const stop of stopAt) {
      while (G.date < stop && guard++ < 5000) {
        const r = advance(7);
        if (r.stop === 'match') { const f = r.fixture; const m = G.matches[f.matchId] || createMatch(f); simulateMatch(m); afterFixture(f); }
      }
      const now = snap();
      phases.push([stop, now]);
    }
    const bands = [[0, 16], [16, 19], [19, 22], [22, 26], [26, 30], [30, 34], [34, 60]];
    const res = [];
    let from = s0, fromD = marks.start;
    for (const [d, s] of phases) {
      const rows = bands.map(([a, b]) => {
        const ids = Object.keys(s0).filter(id => s[id] && s0[id].age >= a && s0[id].age < b);
        const m = f => ids.length ? (ids.reduce((x, id) => x + f(id), 0) / ids.length).toFixed(2) : '-';
        return a + '-' + b + ' n=' + ids.length + ' dCA=' + m(id => s[id].ca - from[id].ca) + ' ' + groups.map(g => g + '=' + m(id => s[id].g[g] - from[id].g[g])).join(' ');
      });
      res.push(fromD + ' → ' + d, ...rows);
      from = s; fromD = d;
    }
    const kids = Object.values(G.academy).filter(k => k.ca != null && !k.catalogOnly);
    return { ms: Date.now() - t0, res, kidsMeanCa: (kids.reduce((s, k) => s + k.ca, 0) / kids.length).toFixed(2), nKids: kids.length };
  })()
`, ctx);
console.log(out.res.join('\n'));
console.log('adepci: n=' + out.nKids + ' średnie CA=' + out.kidsMeanCa + '  czas ' + out.ms + ' ms');
