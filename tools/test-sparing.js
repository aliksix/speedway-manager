#!/usr/bin/env node
// Test sparingów przed sezonem (js/sparing.js): zaproszenie gracza, plan klubów AI, rozegranie, brak wpływu na statystyki ligi.
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
  const go = until => { let g = 0; while (G.date < until && g++ < 400) { const r = advance(7); if (r.stop === 'match') { const f = r.fixture; const m = G.matches[f.matchId] || createMatch(f); simulateMatch(m); afterFixture(f); } } };
  go(G.season + 1 + '-01-05');
  const S = sparSeason();
  const opp = sparClubs(S).filter(c => c.id !== G.clubId).sort(by(c => sparKm(c.id, G.clubId)))[0];
  let r = sparPropose({ oppId: opp.id, date1: S + '-03-21', date2: S + '-03-22', home: true, tickets: 10 });
  if (!r.ok) errs.push('propozycja: ' + r.text);
  const bad = sparPropose({ oppId: opp.id, date1: S + '-02-10' });
  if (bad.ok) errs.push('przyjęto datę poza oknem');
  const r2 = sparAssistant(); info.push('asystent: ' + r2.text);
  go(S + '-01-20');
  const mine0 = sparOf(G.clubId, S);
  info.push('po odpowiedziach: ' + mine0.map(s => s.date.slice(5) + ' ' + sparName(s) + ' ' + s.status).join('; '));
  if (mine0.some(s => s.status === 'pending' && s.replyOn < G.date)) errs.push('brak odpowiedzi rywala');
  if (!G.sparPlanned || !G.sparPlanned[S]) errs.push('kluby AI nie zaplanowały sparingów');
  const ai = sparAll().filter(s => s.season === S && s.homeId !== G.clubId && s.awayId !== G.clubId);
  const per = {}; for (const s of ai) for (const c of [s.homeId, s.awayId]) per[c] = (per[c] || 0) + 1;
  info.push('sparingi AI: ' + ai.length + ', na klub: ' + LEAGUE_ORDER.map(lg => lg + ' ' + sparClubs(S).filter(c => c.league === lg && c.id !== G.clubId).map(c => per[c.id] || 0).join(',')).join(' | '));
  // kolizje: mecz ligowy lub dwa sparingi jednego dnia
  for (const s of sparAll().filter(x => x.season === S && sparActive(x))) for (const c of [s.homeId, s.awayId]) {
    if (sparAll().some(x => x !== s && x.date === s.date && sparActive(x) && (x.homeId === c || x.awayId === c))) errs.push('dwa sparingi jednego dnia ' + s.date + ' ' + c);
    if (Object.values(G.fixtures).some(f => f.date === s.date && (f.homeId === c || f.awayId === c))) errs.push('sparing w dniu meczu ' + s.date);
  }
  // tryb „Dalej” dzień po dniu: zatrzymanie w dniu sparingu gracza, rozegranie bieg po biegu
  let stop = null, g2 = 0;
  while (G.date < S + '-04-05' && g2++ < 200) { const r = advanceDay(); if (r.stop === 'sparing') { stop = r; break; } if (r.stop === 'match') { const f = r.fixture; simulateMatch(G.matches[f.matchId] || createMatch(f)); afterFixture(f); } }
  if (!stop) errs.push('brak zatrzymania w dniu sparingu');
  else {
    const sp = stop.sparing, m = sparBegin(sp);
    if (!m || sp.match !== m) errs.push('sparing gracza nie wystartował');
    else {
      let n = 0; while (!m.done && n++ < 20) playNextHeat(m);
      if (sp.status !== 'played' || m.heats.length !== 15) errs.push('sparing na żywo nie zakończony: ' + sp.status + ' ' + m.heats.length);
      if (advanceDay().stop === 'sparing' && G.date === sp.date) errs.push('ponowne zatrzymanie po rozegranym sparingu');
      for (const t of ['H', 'A']) { const cid = t === 'H' ? m.homeId : m.awayId, lg = G.clubs[cid].league; m.lineup[t].forEach((rid, i) => { if (rid && !slotOk(G.riders[rid], i, lg)) errs.push('sparing: skład niezgodny z zasadami ligi (' + G.clubs[cid].short + ' nr ' + (i + 1) + ' ' + G.riders[rid].name + ')'); }); }
      info.push('na żywo: ' + sparName(sp) + ' ' + m.score.H + ':' + m.score.A + ', nominacje: ' + Object.keys(m.nominations).join(','));
    }
  }
  const statsBefore = JSON.stringify(Object.values(G.riders).map(r => r.stats[S] || null));
  const cash0 = myClub().cash;
  go(S + '-04-05');
  const st = {}; for (const s of sparAll().filter(x => x.season === S)) st[s.status] = (st[s.status] || 0) + 1;
  info.push('statusy: ' + JSON.stringify(st));
  const mine = sparOf(G.clubId, S).filter(s => s.status === 'played');
  info.push('nasze rozegrane: ' + mine.map(s => s.date.slice(5) + ' ' + sparName(s) + ' ' + s.score.H + ':' + s.score.A + ' (' + s.att + ' widzów)').join('; '));
  for (const s of mine) { if (!s.match || s.match.heats.length !== 15) errs.push('protokół sparingu ' + s.id); if (s.score.H + s.score.A > 90 || s.score.H + s.score.A < 80) errs.push('suma punktów ' + s.id + ' ' + (s.score.H + s.score.A)); }
  if (!st.played) errs.push('żaden sparing nie został rozegrany');
  if (Object.values(G.matches).some(m => m.kind === 'sparing')) errs.push('sparing w G.matches');
  const leagueStarted = Object.values(G.fixtures).some(f => f.season === S && f.played);
  if (!leagueStarted && JSON.stringify(Object.values(G.riders).map(r => r.stats[S] || null)) !== statsBefore) errs.push('sparingi zmieniły statystyki ligowe');
  const r1 = clubRiders(G.clubId).find(r => (r.slog || []).some(x => x.k === 'sparing'));
  if (!r1) errs.push('brak wpisu sparingu w dzienniku startów');
  const plan = r1 ? riderPlanned(r1, S + '-03-08', S + '-04-05').filter(e => e.lbl.startsWith('sparing:')) : [];
  info.push('nasze wszystkie: ' + sparOf(G.clubId, S).map(s => s.date.slice(5) + ' ' + sparName(s) + ' ' + s.status + (s.note ? ' (' + s.note + ')' : '')).join('; '));
  info.push('plan zawodnika – sparingi: ' + plan.length);
  info.push('kasa: ' + Math.round(myClub().cash - cash0) + ' zł (cały okres, z innymi kosztami)');
  info.push('tx sparing: ' + Object.values(G.transactions).filter(t => /sparing/i.test(t.desc)).map(t => t.kind + ' ' + t.amount).join(', '));
  // egzaminy na licencję: nasi zdający, zatrzymanie czasu w dniu sesji
  const exams = Object.values(G.events).filter(e => e.comp === 'EXAM' && e.season === S).sort(by(e => e.date));
  info.push('egzaminy ' + S + ': ' + exams.map(e => e.date.slice(5) + (examMine(e).length ? ' [nasi: ' + examMine(e).join(', ') + ']' : '')).join(', '));
  for (const e of exams) if (!e.played && clubEventsOn(e.date).includes(e) !== examMine(e).length > 0) errs.push('zatrzymanie w dniu egzaminu niezgodne z listą zdających ' + e.date);
  // nasz adept zgłoszony na najbliższy egzamin – zatrzymanie czasu w dniu sesji
  const nx = exams.find(e => !e.played && e.date > G.date);
  const kid = nx && Object.values(G.academy).find(k => k.clubId === G.clubId && k.cat === 'c500' && !examMine(nx).includes(k.name));
  if (nx && kid) {
    kid.examRegistered = true; kid.examWithdrawn = false; kid.born = (Number(nx.date.slice(0, 4)) - 16) + '-01-01'; delete kid.examLast; delete kid.examTried;
    if (examMine(nx).length) { let st = null, gg = 0; while (G.date < nx.date && gg++ < 80) { const r = advanceDay(); if (G.date === nx.date) { st = clubEventsOn(G.date).includes(nx) ? r : null; break; } if (r.stop === 'lineup') autoNotifyUser(r.fixture); if (r.stop === 'sparing') sparBegin(r.sparing); if (r.stop === 'match') { const f = r.fixture; simulateMatch(G.matches[f.matchId] || createMatch(f)); afterFixture(f); } }
      if (!st) errs.push('brak zatrzymania w dniu egzaminu naszego adepta'); else info.push('zatrzymanie w dniu egzaminu ' + nx.date + ': ' + examMine(nx).join(', ')); }
    else info.push('adept ' + kid.name + ' nie spełnia warunków egzaminu – pominięto test zatrzymania');
  }
  return { errs, info };
})()`, ctx);
out.info.forEach(l => console.log('  ' + l));
if (out.errs.length) { console.log('BŁĘDY:\n  ' + out.errs.join('\n  ')); process.exit(1); }
console.log('OK – sparingi');
