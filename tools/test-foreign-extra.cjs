#!/usr/bin/env node
// Test zawodów dodatkowych za granicą (js/foreign.js): puchary brytyjskie (grupy, drabinka, zdobywcy), turnieje krajowe
// i zaproszeniowe, pary klubowe, wpisy informacyjne (młodzież, drużyny bez składów), zima w Argentynie z gośćmi ze zgodą klubu.
// Uruchomienie: node tools/test-foreign-extra.cjs [data_końcowa=2026-10-20]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Intl, Math, Date, JSON, Set, Map, Object, Array, Number, String };
vm.createContext(ctx);
for (const [, f] of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="([^"]+\.js)"/g)) {
  if (/js\/(ui-|db\.)/.test(f)) continue;
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
// funkcje z plików interfejsu używane przez logikę (np. js/honours-game.js) – zastępcze dla testu bez przeglądarki
vm.runInContext(`if (typeof standingsRows === 'undefined' && typeof recordSeasonHonours === 'function') recordSeasonHonours = () => {};`, ctx); // js/honours-game.js korzysta z funkcji interfejsu
const until = process.argv[2] || '2026-10-20';
const out = vm.runInContext(`(() => {
  newGame({ clubId: 9, manager: 'Test' });
  const errs = [], info = [];
  const S = sportSeason();
  const ev = Object.values(G.events).filter(e => /^N_/.test(e.comp || '') && e.season === S);
  const kinds = {}; for (const e of ev) { const c = COMPS[e.comp]; const k = e.kind === 'mini-info' ? 'info/' + c.fType : c.format + '/' + (c.fType || ''); kinds[k] = (kinds[k] || 0) + 1; }
  info.push('zdarzenia za granicą sezonu ' + S + ': ' + JSON.stringify(kinds));
  for (const need of ['pairs/pary', 'ind/turniej', 'ind/mlodziez']) if (!kinds[need]) errs.push('brak zdarzeń: ' + need);
  if (Object.keys(kinds).some(k => /^info/.test(k))) errs.push('pozostały wpisy informacyjne: ' + JSON.stringify(kinds));
  const fk = Object.values(G.academy).filter(k => k.fYouth), fr = Object.values(G.riders).filter(r => (r.note || '').includes('extraRiders'));
  const byc = {}; for (const k of fk) byc[k.country + '/' + k.cat] = (byc[k.country + '/' + k.cat] || 0) + 1;
  info.push('adepci zagraniczni z paczki: ' + fk.length + ' ' + JSON.stringify(byc) + '; zawodnicy spoza bazy: ' + fr.length);
  if (fk.length < 100) errs.push('za mało adeptów zagranicznych: ' + fk.length);
  const cupFx = Object.values(G.ffix).filter(f => FP.cups[f.lg]);
  info.push('mecze pucharowe na start: ' + cupFx.length + ' (' + Object.keys(FP.cups).map(c => c + ':' + cupFx.filter(f => f.lg === c).length).join(', ') + ')');
  // zima: zgoda dla zawodnika do Argentyny
  let g = 0;
  while (G.date < S + '-01-31' && g++ < 200) { const r = advance(7); if (r.stop === 'match') { const f = r.fixture; simulateMatch(G.matches[f.matchId] || createMatch(f)); afterFixture(f); } }
  const arg = Object.values(G.events).filter(e => COMPS[e.comp] && COMPS[e.comp].cc === 'ARG' && /winter/.test(COMPS[e.comp].field || '') && e.played && !e.cancelled);
  const wg = Object.values(G.riders).filter(r => r.winter && r.winter.status === 'ok' && r.winter.ser === 'ARG');
  const rode = wg.filter(r => arg.some(e => G.matches[e.matchId] && G.matches[e.matchId].riders[r.id]));
  info.push('Torneo Internacional rozegrane rundy: ' + arg.length + '; goście zimowi ze zgodą: ' + wg.length + ', jechali: ' + rode.map(r => r.name + ' (' + r.country + ')').join(', '));
  if (!arg.length) errs.push('Torneo Internacional się nie odbywa');
  if (arg.length) { const m = G.matches[arg[0].matchId]; info.push('obsada 1. rundy: ' + Object.keys(m.riders).length + ' zawodników, kraje: ' + [...new Set(Object.keys(m.riders).map(id => (G.riders[id] || {}).country))].join(',')); }
  const aus = Object.values(G.events).filter(e => e.comp === 'N_AUS' && e.played);
  info.push('mistrzostwa Australii: ' + aus.length + ' rund; zwycięzcy: ' + aus.map(e => (G.riders[e.winner] || {}).name).join(', '));
  g = 0;
  while (G.date < '${until}' && g++ < 400) { const r = advance(7); if (r.stop === 'match') { const f = r.fixture; simulateMatch(G.matches[f.matchId] || createMatch(f)); afterFixture(f); } }
  for (const cup of Object.keys(FP.cups)) {
    const fx = Object.values(G.ffix).filter(f => f.lg === cup && f.season === S), pl = fx.filter(f => f.played && !f.cancelled);
    const win = G.fseasons[S].champions[cup];
    info.push(cup + ': mecze ' + pl.length + '/' + fx.length + ', zdobywca: ' + (win ? fClubName(win) : '—') + '; finał: ' + fx.filter(f => f.st === 'F').map(f => f.d + ' ' + f.units.map(fClubShort).join('-') + ' ' + (f.res ? f.units.map(u => f.res.pts[u]).join(':') : '')).join(' / '));
    if (!win) errs.push(cup + ': brak zdobywcy');
    for (const f of fx.filter(x => x.played && !x.cancelled)) if (!f.res || f.units.length !== 2) errs.push(cup + ': zły wynik ' + f.id);
  }
  const done = ev.map(e => G.events[e.id]).filter(e => e && e.kind === 'comp' && e.date <= '${until}');
  const notPlayed = done.filter(e => !e.played && e.date < G.date);
  info.push('zawody za granicą do ' + '${until}' + ': ' + done.length + ', rozegrane ' + done.filter(e => e.played && !e.cancelled).length + ', odwołane ' + done.filter(e => e.cancelled).length + ', nierozegrane ' + notPlayed.length);
  if (notPlayed.length) errs.push('nierozegrane: ' + notPlayed.slice(0, 5).map(e => e.id).join(', '));
  const show = k => { const e = done.find(x => x.comp && COMPS[x.comp].name.includes(k) && x.played); return e ? k + ': ' + (e.cancelled ? 'odwołane' : (COMPS[e.comp].format === 'pairs' ? 'para ' + e.winner : (G.riders[e.winner] || {}).name) + ', ' + Object.keys((G.matches[e.matchId] || {}).riders || {}).length + ' zawodników') : k + ': —'; };
  for (const k of ['Championship Best Pairs', 'Par (MČR', 'Złoty Kask', 'Debreczyna', 'Peter Craven', 'Ole Olsen', 'Holandii', 'Słowacji', 'U.S. National']) info.push('  ' + show(k));
  for (const k of ['Championship Best Pairs', 'Złoty Kask', 'Peter Craven']) { const e = done.find(x => COMPS[x.comp].name.includes(k)); if (!e || !e.played || e.cancelled) errs.push('nie rozegrano: ' + k); }
  // młodzież i drużynowe (dawniej wpisy informacyjne)
  const yd = done.filter(e => COMPS[e.comp].fType === 'mlodziez' && e.played);
  const ycan = yd.filter(e => e.cancelled);
  info.push('zawody młodzieżowe: rozegrane ' + (yd.length - ycan.length) + ', odwołane (brak obsady) ' + ycan.length + (ycan.length ? ' – ' + [...new Set(ycan.map(e => COMPS[e.comp].name))].join('; ') : ''));
  for (const k of ['British Youth', 'Ungdomsserien', 'Danmarksturneringen 85 cm³ – 1.', 'Mistrzostwa Danii 50', '125 cm³ (krótki', 'USM) 250']) {
    const e = yd.find(x => COMPS[x.comp].name.includes(k) && !x.cancelled), m = e && G.matches[e.matchId];
    info.push('  ' + k + ': ' + (m ? R(e.winner).name + ' (' + (R(e.winner).country) + '), ' + Object.keys(m.riders).length + ' zawodników: ' + Object.keys(m.riders).slice(0, 6).map(id => R(id).name).join(', ') : '—'));
    if (!m) errs.push('nie rozegrano młodzieżowych: ' + k);
  }
  for (const k of ['Regina Chain', 'Vetlanda Lagcup', 'drużyn juniorskich', 'Wielkanocny', 'Finlandii Par', 'Puchar Rosji Par', 'Teesside', 'Woffinden', 'Guldhjälm']) {
    const e = done.find(x => COMPS[x.comp].name.includes(k) && x.played && !x.cancelled), m = e && G.matches[e.matchId];
    info.push('  ' + k + ': ' + (m ? (COMPS[e.comp].format === 'pairs' ? 'zwycięzca ' + m.units[e.winner].name + ' (' + Object.keys(m.units).length + ' drużyn)' : (G.riders[e.winner] || {}).name) : '—'));
    if (!m && !(k === 'Teesside' && '${until}' < '2026-10-16')) errs.push('nie rozegrano: ' + k);
  }
  if (Object.values(G.events).some(e => e.kind === 'mini-info' && e.foreign)) errs.push('pozostały zagraniczne wpisy informacyjne');
  // okno transferowe przed kolejnym sezonem (fTransferWindow): ruchy, brak zawodnika w dwóch klubach jednej ligi, pełne składy
  const tl = fTransferWindow(S + 1), tc = {}; for (const x of tl) tc[x.kind] = (tc[x.kind] || 0) + 1;
  info.push('okno transferowe ' + (S + 1) + ': ' + tl.length + ' ruchów ' + JSON.stringify(tc));
  const mem = {}; for (const c of Object.values(G.fclubs)) for (const id of c.squad) (mem[c.league + '|' + id] ||= []).push(c.id);
  const twice = Object.entries(mem).filter(([, v]) => v.length > 1);
  if (twice.length) errs.push('zawodnik w dwóch klubach jednej ligi: ' + twice.slice(0, 3).map(([k, v]) => k + ' ' + v).join('; '));
  const thin = Object.values(G.fclubs).filter(c => c.squad.filter(id => G.riders[id] && !G.riders[id].retired).length < fLeague(c.league).teamSize);
  if (thin.length) errs.push('za małe składy po oknie: ' + thin.map(c => c.id + ':' + c.squad.length).join(', '));
  for (const k of ['awans', 'zmiana', 'debiut']) if (!tc[k]) errs.push('okno transferowe bez ruchów: ' + k);
  const tr = Object.values(G.riders).find(r => /Tr.sarrieu/.test(r.name) && /Mathieu/.test(r.name));
  if (!tr) errs.push('brak Mathieu Trésarrieu (bliźniak Mathiasa)');
  return { errs, info };
})()`, ctx);
out.info.forEach(l => console.log('  ' + l));
if (out.errs.length) { console.log('BŁĘDY:\n  ' + out.errs.join('\n  ')); process.exit(1); }
console.log('OK – zawody za granicą');
