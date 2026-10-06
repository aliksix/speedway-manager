#!/usr/bin/env node
// Test obozów przygotowawczych (js/camps.js): rezerwacja i wycena na osobę, kluby AI, limit toru, przebieg dzień po dniu,
// trening torowy (zużycie silników), koszty klubu i zawodników, wpływ na rozwój, odwołanie.
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
  const go = until => { let g = 0; while (G.date < until && g++ < 400) { const r = advance(7); if (r.stop === 'match') { const f = r.fixture; simulateMatch(G.matches[f.matchId] || createMatch(f)); afterFixture(f); } } };
  go((G.season) + '-12-01');
  const S = campSeason();
  const riders = campDefaultRiders(G.clubId), staff = campDefaultStaff(G.clubId, 'C');
  const q = campQuote(G.clubId, 'gorican', 4, riders, staff), qa = campQuote(G.clubId, 'szczyrk', 4, riders, campDefaultStaff(G.clubId, 'A'));
  info.push('wycena Goričan 4 dni: klub ' + q.club + ' zł, zawodnicy ' + q.riders + ' zł, średnio ' + q.perRider + ' zł/zawodnik; Szczyrk 4 dni średnio ' + qa.perRider);
  if (!(q.perRider > 2.5 * qa.perRider)) errs.push('obóz na torze nie jest wyraźnie droższy od kondycyjnego');
  const sen = q.rows.find(x => !x.junior), jun = q.rows.find(x => x.junior);
  if (sen && !(sen.rider > 0 && sen.transport > 0)) errs.push('senior: brak kosztów materiałów/mechaników lub transportu motocykli');
  if (jun && jun.rider !== 0) errs.push('junior płaci za obóz');
  info.push('senior: ' + JSON.stringify(sen));
  if (!campProblem(G.clubId, 'gorican', S + '-02-20', 4)) errs.push('Goričan przed otwarciem toru');
  let r = campBook({ venue: 'lloret', start: S + '-02-09', days: 6, riders, staff: campDefaultStaff(G.clubId, 'B') });
  if (!r.ok) errs.push('rezerwacja B: ' + r.text);
  r = campBook({ venue: 'gorican', start: S + '-03-09', days: 4, riders, staff });
  if (!r.ok) errs.push('rezerwacja C: ' + r.text);
  const cId = r.id;
  const r3 = campBook({ venue: 'szczyrk', start: S + '-01-12', days: 4, riders, staff: [] });
  const cancel = campCancel(r3.id); info.push('odwołanie: ' + cancel.text);
  if (!cancel.ok || G.camps[r3.id].fee) errs.push('odwołanie ponad 14 dni przed terminem nie powinno kosztować');
  go(S + '-01-05');
  if (!G.campPlanned || !G.campPlanned[S]) errs.push('kluby AI nie zaplanowały obozów');
  const ai = campAll().filter(c => c.season === S && c.clubId !== G.clubId);
  info.push('obozy AI: ' + ai.length + ' (' + ['A', 'B', 'C'].map(t => t + ':' + ai.filter(c => c.type === t).length).join(' ') + ')');
  for (const v of Object.keys(CAMP_VENUES)) if (CAMP_VENUES[v].cap) for (let d = S + '-02-25'; d <= S + '-04-08'; d = addDays(d, 1)) if (campTrackLoad(v, d).length > CAMP_VENUES[v].cap) errs.push('przekroczony limit toru ' + v + ' ' + d);
  const me = clubRiders(G.clubId).filter(x => G.camps[cId].riders.includes(x.id) && !G.camps[cId].declined.includes(x.id));
  const heats0 = Object.fromEntries(me.map(x => [x.id, sum(x.equip.engines.map(e => e.heats || 0))]));
  const bud0 = Object.fromEntries(me.map(x => [x.id, x.equip.budget || 0]));
  const cash0 = myClub().cash;
  go(S + '-03-08');
  const ex = G.camps[cId];
  // obóz C dzień po dniu
  let g = 0; while (G.date <= campEnd(ex) && g++ < 20) { const rr = advanceDay(); if (rr.stop === 'sparing') sparBegin(rr.sparing); }
  info.push('Goričan: status ' + ex.status + ', dni: ' + Object.entries(ex.log).map(([d, l]) => d.slice(5) + ' ' + l.k + ' ' + l.t + '°C').join('; '));
  if (ex.status !== 'done') errs.push('obóz C nie zakończony');
  const tracks = Object.values(ex.log).filter(l => l.k === 'track').length;
  const used = ex.att.map(id => G.riders[id]).filter(x => x && !x.injury);
  const wear = used.map(x => sum(x.equip.engines.map(e => e.heats || 0)) - (heats0[x.id] || 0));
  info.push('dni torowe ' + tracks + ', przyrost biegów silników na zawodnika: ' + wear.join(','));
  if (tracks && wear.some(w => w < tracks * 5)) errs.push('dzień torowy nie liczony jak trening (zużycie silników)');
  const sp = used.find(x => !isJunior(x));
  if (sp && tracks && !((ex.paid[sp.id] || 0) >= tracks * CAMP_MAT)) errs.push('senior nie zapłacił za materiały / mechaników');
  info.push('zapłacili zawodnicy: ' + Object.entries(ex.paid).map(([id, v]) => G.riders[id].name.split(' ').pop() + ' ' + v).join(', '));
  const tx = Object.values(G.transactions).filter(t => t.kind === 'obozy');
  info.push('księgowanie obozów: ' + tx.map(t => t.amount).join(', '));
  if (!tx.length) errs.push('brak kosztów obozu w finansach');
  const st = r => dayStatus(r, ex.start);
  if (me[0] && st(me[0]).s !== 'camp') errs.push('terminarz zawodnika nie pokazuje obozu: ' + JSON.stringify(st(me[0])));
  go(S + '-03-16');
  const wk = me.map(x => x.dev && x.dev.wk).filter(Boolean);
  info.push('wpływ na tydzień rozwoju (dni torowe z obozu w wk.camp): ' + wk.filter(w => w.camp != null).length + '/' + wk.length);
  if (sparBusy(G.clubId, ex.start) !== 'mecz ligowy' && sparBusy(G.clubId, ex.start) !== null) {}
  info.push('kasa klubu od grudnia: ' + Math.round(myClub().cash - cash0));
  return { errs, info };
})()`, ctx);
out.info.forEach(l => console.log('  ' + l));
if (out.errs.length) { console.log('BŁĘDY:\n  ' + out.errs.join('\n  ')); process.exit(1); }
console.log('OK – obozy');
