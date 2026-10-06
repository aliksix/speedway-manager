#!/usr/bin/env node
// Test planera treningu (js/planner.js): tryb własnego planu, plan asystenta, przebieg jednostek (kondycja, rytm, pogoda),
// wpływ na tempo rozwoju (planBoost), zastąpienie automatycznych treningów punktowanych, zimowe starty za granicą.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Intl, Math, Date, JSON, Set, Map, Object, Array, Number, String };
vm.createContext(ctx);
for (const [, f] of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="([^"]+\.js)"/g)) {
  if (/js\/(ui-|db\.)/.test(f)) continue;
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const out = vm.runInContext(`(() => {
  newGame({ clubId: 9, manager: 'Test' });
  const errs = [], info = [];
  const go = until => { let g = 0; while (G.date < until && g++ < 400) { const r = advance(1); if (r.stop === 'match') { const f = r.fixture; simulateMatch(G.matches[f.matchId] || createMatch(f)); afterFixture(f); } else if (r.stop === 'sparing' && typeof sparBegin === 'function') sparBegin(r.sparing); } };
  if (!G.tplan || G.tplan.mode !== 'auto') errs.push('brak modelu planu albo tryb inny niż automatyczny');
  info.push('start gry: ' + G.date);
  const Y0 = Number(G.date.slice(0, 4)) + (G.date.slice(5) > '11-02' ? 1 : 0);
  go(Y0 + '-11-03');
  // zima za granicą
  const Y = winterYear(), req = Object.values(G.riders).filter(r => r.winter && r.winter.y === Y);
  info.push('prośby o zimę ' + Y + ': ' + req.length + ' (mistrzostwa: ' + req.filter(r => r.winter.kind === 'champ').length + ', zarobkowe: ' + req.filter(r => r.winter.kind === 'race').length + '); przykłady: ' + req.slice(0, 6).map(r => r.name + ' ' + r.winter.ser + '/' + r.winter.kind + '/' + r.winter.status).join(', '));
  if (!req.length) errs.push('brak próśb o starty zimą');
  if (req.filter(r => r.clubId !== G.clubId).some(r => r.winter.status === 'req')) errs.push('klub AI nie zdecydował');
  const mine = req.filter(r => r.clubId === G.clubId);
  info.push('nasze prośby: ' + mine.map(r => r.name + ' (' + r.winter.kind + ')').join(', '));
  const pol = Object.values(G.riders).find(r => r.winter && r.winter.y === Y && r.winter.status === 'ok' && hasNat(r, 'POL'));
  if (pol) { const st = dayStatus(pol, Y + '-12-20'); info.push('Polak zimą: ' + pol.name + ' 20.12 → ' + st.lbl); if (st.avail) errs.push('zawodnik zimą za granicą dostępny w klubie'); }
  for (const r of mine) { const m0 = r.morale; winterDecide(r, r.winter.kind !== 'champ' ? false : true); info.push(r.name + ': morale ' + m0 + ' → ' + r.morale); }
  // tryb własnego planu: asystent układa grudzień–marzec
  G.tplan.mode = 'manual'; G.tplan.since = G.date;
  go(Y + '-11-30');
  let n = 0;
  for (const ym of [Y + '-12', (Y + 1) + '-01', (Y + 1) + '-02', (Y + 1) + '-03']) { const r = planAssistMonth(ym); n += r.n; if (ym.endsWith('-12')) info.push('asystent: ' + (r.asst ? r.asst.name : '—') + ', jakość ' + r.aq.toFixed(1) + ', pominięcia ' + r.miss); }
  info.push('zaplanowane jednostki XII–III: ' + n);
  if (n < 60) errs.push('asystent zaplanował za mało jednostek: ' + n);
  const bad = addSession(Y + '-12-10', 'tor');
  if (bad.ok) errs.push('tor w grudniu przyjęty');
  const rs = clubRiders(G.clubId).filter(r => r.active !== false && !r.retired);
  const b = [];
  for (const d of [Y + '-12-14', Y + '-12-28', (Y + 1) + '-01-11', (Y + 1) + '-01-25']) { go(d); for (const r of rs) if (planPresence(r) > 0.5) b.push(planBoost(r)); }
  const done = planAll().filter(s => s.status === 'done');
  info.push('odbyte jednostki do 25.01: ' + done.length + ', śr. uczestników ' + (done.length ? (done.reduce((a, s) => a + s.att.length, 0) / done.length).toFixed(1) : 0));
  if (!done.length) errs.push('jednostki się nie odbywają');
  const avg = g => b.reduce((a, x) => a + (x.mul[g] || 1), 0) / Math.max(1, b.length);
  info.push('zima, mnożniki okien obecnych w klubie (średnio 4 tygodnie): fizyczne ' + avg('physical').toFixed(2) + ', mentalne ' + avg('mental').toFixed(2) + ', technika ' + avg('tech').toFixed(2));
  if (!(avg('physical') > 0.8 && avg('physical') <= 1.3)) errs.push('plan asystenta zimą daje nietypowe tempo fizyczne');
  // pusty plan na tydzień → wolniejszy rozwój
  for (const s of planAll()) if (s.status === 'plan' && s.date > G.date && s.date <= addDays(G.date, 8)) removeSession(s.id);
  go(addDays(G.date, 8));
  const b2 = rs.map(r => planBoost(r)).filter(Boolean), ph = b2.reduce((a, x) => a + x.mul.physical, 0) / Math.max(1, b2.length);
  info.push('tydzień bez planu: fizyczne ' + ph.toFixed(2));
  if (!(ph < 0.85)) errs.push('brak treningu nie spowalnia rozwoju');
  const wr = Object.values(G.riders).filter(r => r.winter && r.winter.y === Y && r.winter.status === 'ok' && r.winter.dates && r.winter.dates.some(e => e.ran));
  info.push('zawodnicy po zimowych startach: ' + wr.length + ', np. ' + wr.slice(0, 3).map(r => r.name + ' ' + r.winter.dates.filter(e => e.ran).length + ' startów').join(', '));
  if (!wr.length) errs.push('zimowe starty się nie odbywają');
  go((Y + 1) + '-04-05');
  const spar = rs.filter(r => (r.slog || []).some(s => s.k === 'sparing'));
  const auto = rs.flatMap(r => (r.slog || []).filter(s => s.k === 'sparing' && dow(s.d) === 5 && !planOnDay(s.d).some(x => x.type === 'punkt' && x.status === 'done') && !(typeof sparOf === 'function' && sparOf(G.clubId).some(x => x.date === s.d))));
  info.push('rytm z treningów punktowanych/sparingów: ' + spar.length + '/' + rs.length + ' zawodników; automatyczne soboty: ' + auto.length);
  if (auto.length) errs.push('automatyczne treningi punktowane mimo własnego planu');
  const tor = planAll().filter(s => s.type === 'tor' || s.type === 'punkt');
  info.push('punktowane: ' + planAll().filter(s => s.type === 'punkt').map(s => s.date.slice(5) + ':' + s.status).join(' '));
  info.push('tor w marcu: odbyte ' + tor.filter(s => s.status === 'done').length + ', odwołane (pogoda) ' + tor.filter(s => s.status === 'off').length);
  const over = rs.filter(r => planLoad(r) > PLAN_OVERLOAD).length;
  info.push('przeciążeni na 5.04: ' + over + '; kondycja śr. ' + Math.round(rs.reduce((a, r) => a + r.cond, 0) / rs.length));
  return { errs, info };
})()`, ctx);
out.info.forEach(l => console.log('  ' + l));
if (out.errs.length) { console.log('BŁĘDY:\n  ' + out.errs.join('\n  ')); process.exit(1); }
console.log('OK – planer treningu');
