#!/usr/bin/env node
// Test żużla w USA (data/usa, tools/build-usa.cjs): zawodnicy i adepci z USA w nowej grze (kalibracja CA/PA, daty urodzenia, profile),
// brak duplikatów, rozegranie zawodów w USA 2026 (AMA National, U.S. National, młodzież, US Open…) z obsadą z amerykańskich zawodników.
// Uruchomienie: node tools/test-usa.cjs [data_końcowa=2026-10-12]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Intl, Math, Date, JSON, Set, Map, Object, Array, Number, String };
vm.createContext(ctx);
for (const [, f] of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="([^"]+\.js)"/g)) {
  if (/js\/(ui-|db\.)/.test(f)) continue;
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`if (typeof standingsRows === 'undefined' && typeof recordSeasonHonours === 'function') recordSeasonHonours = () => {};`, ctx);
const until = process.argv[2] || '2026-10-12';
const out = vm.runInContext(`(() => {
  newGame({ clubId: 9, manager: 'Test' });
  const errs = [], info = [];
  const us = Object.values(G.riders).filter(r => r.country === 'USA' && !r.retired);
  const kids = Object.values(G.academy).filter(k => k.country === 'USA');
  info.push('zawodnicy z USA: ' + us.length + ', adepci: ' + kids.length + ', z licencją AMA z profilu: ' + us.filter(x => (USA_DATA.profiles[x.name] || {}).lic).length);
  // do gry tylko uczestnicy mistrzostw w klasycznym żużlu i rokujący z potwierdzoną datą urodzenia (ok. 50 osób), bez amatorów i sidecarów
  if (us.length < 25 || us.length > 45) errs.push('liczba zawodników z USA poza 25–45: ' + us.length);
  if (kids.length < 8 || kids.length > 22) errs.push('liczba adeptów z USA poza 8–22: ' + kids.length);
  for (const n of ['Mike Newnham', 'Marc Denniston', 'Ray Holt Jr.', 'Shawn McConnell', 'Kevin Kale', 'Joe Jones', 'Charles "Dukie" Ermolenko', 'Kensei Matsudaira', 'Jimmy Fishback']) if (us.some(r => r.name === n)) errs.push('amator / sidecar w bazie: ' + n);
  const seen = new Map();
  for (const r of Object.values(G.riders)) { const k = normName(r.name); if (seen.has(k) && r.country === 'USA') errs.push('duplikat: ' + r.name); seen.set(k, r); }
  const need = { 'Max Ruml': [45, 62], 'Broc Nicol': [45, 62], 'Billy Janniro': [35, 52], 'Brady Landon': [32, 55], 'Luke Becker': [55, 70] };
  for (const [n, [lo, hi]] of Object.entries(need)) {
    const r = us.find(x => x.name === n);
    if (!r) { errs.push('brak: ' + n); continue; }
    if (!(r.ca >= lo && r.ca <= hi)) errs.push(n + ': CA ' + r.ca + ' poza [' + lo + ', ' + hi + ']');
    if (r.bornEst) errs.push(n + ': data urodzenia szacowana');
    if (!r.attrs || !r.attrs.start) errs.push(n + ': brak atrybutów');
  }
  info.push('top 10 CA: ' + us.slice().sort((a, b) => b.ca - a.ca).slice(0, 10).map(r => r.name + ' ' + r.ca + '/' + r.pa).join(', '));
  info.push('najwyższy PA wśród adeptów: ' + kids.slice().sort((a, b) => b.pa - a.pa).slice(0, 5).map(k => k.name + ' ' + k.pa + ' (' + k.cat + ')').join(', '));
  let g = 0;
  while (G.date < '${until}' && g++ < 400) { const r = advance(7); if (r.stop === 'match') { const f = r.fixture; simulateMatch(G.matches[f.matchId] || createMatch(f)); afterFixture(f); } }
  const ev = Object.values(G.events).filter(e => e.comp && COMPS[e.comp] && COMPS[e.comp].cc === 'USA' && e.date <= '${until}');
  info.push('zawody w USA do ${until}: ' + ev.length + ', rozegrane ' + ev.filter(e => e.played && !e.cancelled).length);
  for (const e of ev.sort((a, b) => a.date.localeCompare(b.date))) {
    const m = G.matches[e.matchId] || {}, ids = Object.keys(m.riders || {});
    const who = ids.map(id => G.riders[id] || G.academy[id]).filter(Boolean);
    const usShare = who.filter(x => x.country === 'USA').length;
    info.push('  ' + e.date + ' ' + COMPS[e.comp].name + ': ' + (e.cancelled ? 'odwołane' : ((G.riders[e.winner] || G.academy[e.winner] || {}).name || '—') + ', ' + who.length + ' zawodników (' + usShare + ' z USA)'));
    if (!e.played && e.date < G.date) errs.push('nierozegrane: ' + COMPS[e.comp].name + ' ' + e.date);
    if (e.played && !e.cancelled && who.length && usShare / who.length < 0.6) errs.push(COMPS[e.comp].name + ': mało Amerykanów w obsadzie (' + usShare + '/' + who.length + ')');
  }
  return { errs, info };
})()`, ctx);
for (const l of out.info) console.log(l);
if (out.errs.length) { console.log('BŁĘDY:'); for (const e of out.errs) console.log('  ' + e); process.exit(1); }
console.log('OK – żużel w USA');
