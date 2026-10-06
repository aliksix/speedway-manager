#!/usr/bin/env node
// Test skautingu (js/scouting.js): zlecenia zawodnik / rozgrywki / kraj / poszukiwanie, obserwacje na zawodach dnia,
// koszty wyjazdów, wiedza o zawodnikach, raporty (ocena skauta, przedział punktów, koszt sezonu), kara treningowa trenera.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Intl, Math, Date, JSON, Set, Map, Object, Array, Number, String };
vm.createContext(ctx);
for (const [, f] of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="([^"]+\.js)"/g)) {
  if (/js\/(ui-|db\.)/.test(f)) continue;
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`if (typeof standingsRows === 'undefined' && typeof recordSeasonHonours === 'function') recordSeasonHonours = () => {};`, ctx); // js/honours-game.js korzysta z funkcji interfejsu
const out = vm.runInContext(`(() => {
  newGame({ clubId: 9, manager: 'Test' });
  const errs = [], info = [];
  const go = until => { let g = 0; while (G.date < until && g++ < 500) { const r = advance(7); if (r.stop === 'match') { const f = r.fixture; simulateMatch(G.matches[f.matchId] || createMatch(f)); afterFixture(f); } } };
  go('2026-05-04');
  if (!G.scouting) errs.push('brak modelu skautingu');
  const pool = scStaffPool();
  info.push('osoby do zleceń: ' + pool.map(s => s.name + ' (' + s.role + ', ocena talentu ' + scJudging(s) + ', pojemność ' + scCapacity(s) + ')').join('; '));
  if (pool.length < 4) { errs.push('za mało osób w sztabie do testu'); return { errs, info }; }
  const [a, b, c, d] = pool;
  // zawodnik innego klubu PGE startujący regularnie
  const target = Object.values(G.riders).filter(r => r.clubId && r.clubId !== G.clubId && G.clubs[r.clubId].league === 'PGE' && r.active).sort(by(r => -r.skill))[3];
  const k0 = knowledge(target), eff0 = staffEff(a);
  let r1 = scCreate(a.id, 'rider', { riderId: target.id }, 4);
  const eff1 = staffEff(a);
  info.push('zawodnik: ' + r1.text + '; skuteczność treningu ' + a.name + ': ' + eff0.toFixed(2) + ' → ' + eff1.toFixed(2));
  if (!r1.ok) errs.push('zlecenie zawodnika: ' + r1.text);
  if (!(Math.abs(eff1 / eff0 - 0.75) < 0.01)) errs.push('kara treningowa trenera nie wynosi 75%');
  const dup = scCreate(a.id, 'comp', { comp: 'SWE1' }, 3);
  if (dup.ok) errs.push('trener przyjął drugie zlecenie');
  const r2 = scCreate(b.id, 'comp', { comp: 'SWE1' }, 3), r3 = scCreate(c.id, 'country', { cc: 'GBR', profile: true, crit: { role: 'foreign', ca: 2.5, pa: 0, ageMax: 26, budget: 0 } }, 2);
  const r4 = scCreate(d.id, 'search', { crit: { role: 'jun', ca: 0, pa: 3, ageMax: 21, budget: 800000, cc: '' } }, 3);
  info.push([r2, r3, r4].map(x => x.text).join(' | '));
  for (const x of [r2, r3, r4]) if (!x.ok) errs.push(x.text);
  const cash0 = myClub().cash;
  go('2026-06-10');
  const T = scAll();
  for (const t of T) info.push(t.type + ': ' + t.status + ', obserwacje ' + t.obs + ', zawodnicy ' + Object.keys(t.seen).length + ', koszt ' + Math.round(t.cost || 0) + ', polecani ' + t.recs.map(id => G.riders[id].name).join(', '));
  if (T.some(t => t.status !== 'done')) errs.push('niezakończone zlecenia: ' + T.filter(t => t.status !== 'done').map(t => t.type).join(','));
  const k1 = knowledge(target);
  info.push('wiedza o ' + target.name + ': ' + k0.toFixed(2) + ' → ' + k1.toFixed(2));
  if (!(k1 > k0 + 0.05)) errs.push('obserwacja nie zwiększa wiedzy');
  const rep = scLastReport(target.id);
  if (!rep) errs.push('brak raportu zawodnika');
  else { info.push('raport: ' + JSON.stringify({ ca: rep.ca, pa: rep.pa, pts: rep.pts, cost: rep.cost, strong: rep.strong, char: rep.char, prawdziwe_ca: Math.round(target.ca), skill: target.skill }));
    if (!(rep.pts[0] <= rep.pts[1] && rep.pts[1] < 400 && rep.cost > 0)) errs.push('zły przedział punktów / koszt'); }
  const tx = Object.values(G.transactions).filter(t => t.kind === 'skauting' && t.clubId === G.clubId);
  info.push('koszty skautingu: ' + tx.length + ' pozycji, ' + Math.round(-sum(tx.map(t => t.amount))) + ' zł');
  if (!tx.length) errs.push('brak kosztów wyjazdów');
  const t4 = T.find(t => t.type === 'search');
  if (t4 && t4.recs.some(id => { const r = G.riders[id]; return !isJunior(r, sportSeason()); })) errs.push('poszukiwanie juniorów poleciło nie-juniora');
  const t3 = T.find(t => t.type === 'country');
  if (t3 && t3.recs.some(id => hasNat(G.riders[id], 'POL'))) errs.push('profil „obcokrajowiec” polecił Polaka');
  if (Math.abs(staffEff(a) - eff0) > 1e-9) errs.push('kara treningowa nie zniknęła po zleceniu');
  // ocena dwóch obserwatorów różni się (osobny błąd skauta)
  const v1 = perceiveBy(target, a), v2 = perceiveBy(target, b);
  info.push('ocena ' + a.name + ': ' + v1.ca.map(Math.round) + ' / ' + b.name + ': ' + v2.ca.map(Math.round));
  return { errs, info };
})()`, ctx);
out.info.forEach(l => console.log('  ' + l));
if (out.errs.length) { console.log('BŁĘDY:\n  ' + out.errs.join('\n  ')); process.exit(1); }
console.log('OK – skauting');
