#!/usr/bin/env node
// Test przeglądarkowy lig zagranicznych (Chrome headless przez DevTools Protocol, bez pakietów):
// nowa gra → sezon do połowy maja → strony lig, meczów, klubów, mistrzostw krajowych, kalendarz → zapis i wczytanie z SQLite.
// Zrzuty: tools/screenshots/foreign-*.png. Uruchomienie: node tools/test-foreign-browser.cjs [--keep]
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { server } = require('./server.js');

const SLOTS = 10, BASE_PORT = 8799, BASE_CDP = 9231; // sloty jak w tools/test-browser.js (równoległe testy)
let PORT = BASE_PORT, CDP = BASE_CDP, SLOT = 0;
async function claimSlot() {
  const first = Math.floor(Math.random() * SLOTS);
  for (let k = 0; k < SLOTS; k++) {
    const i = (first + k) % SLOTS;
    const ok = await new Promise(r => { const onErr = () => r(false); server.once('error', onErr); server.listen(BASE_PORT + i, '127.0.0.1', () => { server.removeListener('error', onErr); r(true); }); });
    if (!ok) continue;
    const cdpFree = await new Promise(r => { const t = require('net').createServer().once('error', () => r(false)).once('listening', () => t.close(() => r(true))).listen(BASE_CDP + i, '127.0.0.1'); });
    if (!cdpFree) { await new Promise(r => server.close(r)); continue; }
    SLOT = i; PORT = BASE_PORT + i; CDP = BASE_CDP + i; return;
  }
  throw new Error('Brak wolnego slotu testów');
}
const SHOTS = path.join(__dirname, 'screenshots');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(f => fs.existsSync(f));
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, next = 0;
const pending = new Map(), errors = [];
const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) {
  const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails));
  return r.result.value;
}
async function shot(name) { const s = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, 'foreign-' + name + '.png'), Buffer.from(s.data, 'base64')); }
function check(cond, msg) { if (!cond) throw new Error('BŁĄD: ' + msg); console.log('  ✓ ' + msg); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await claimSlot();
  console.log(`  slot testu ${SLOT}: serwer ${PORT}, DevTools ${CDP}`);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${CDP}`, `--user-data-dir=${path.join(__dirname, `.browser-test-${SLOT}`)}`, 'about:blank'], { stdio: 'ignore' });
  let gameId = null;
  try {
    let targets;
    for (let i = 0; i < 60 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch (e) { await delay(250); } }
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
    });
    await call('Runtime.enable'); await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    for (let i = 0; i < 50; i++) { if (await ev('!!document.querySelector(".start-menu")')) break; await delay(100); }
    await delay(500);
    check(await ev('DB.on'), 'serwer bazy dostępny');
    // nowa gra i sezon do połowy maja 2026 (mecze gracza symulowane automatycznie)
    await ev(`(async () => { newGame({ clubId: 9, manager: 'Test' }); await dbCreate(); buildLayout(); location.hash = '#/skrzynka'; render(); })()`);
    gameId = await ev('G.gameId');
    check(!!gameId, `utworzono grę ${gameId}`);
    check(await ev(`Object.keys(G.fclubs).length === Object.keys(FP.clubs).length && Object.values(G.fclubs).every(c => c.squad.length >= 2)`), 'kluby lig zagranicznych ze składami');
    const adv = await ev(`(() => { let g = 0, last = null; const stops = {}; while (G.date < '2026-05-16' && g++ < 2000) { const d0 = G.date; const r = advance(7); stops[r.stop] = (stops[r.stop] || 0) + 1; if (r.stop === 'match') { const f = r.fixture; const m = G.matches[f.matchId] || createMatch(f); simulateMatch(m); afterFixture(f); } else if (G.date === d0) { last = r.stop; if (r.stop === 'sparing' && typeof sparPlayLive === 'function') sparPlayLive(r.sparing); else { processDay(G.date); G.date = addDays(G.date, 1); newDay(); } } } return JSON.stringify({ date: G.date, stops, last }); })()`);
    console.log('  symulacja:', adv);
    check(await ev(`Object.values(G.ffix).filter(f => f.played && f.res && f.res.heats).length > 60`), 'mecze lig zagranicznych rozegrane bieg po biegu');
    check(await ev(`Object.values(G.events).some(e => /^N_/.test(e.comp) && e.played && !e.cancelled)`), 'mistrzostwa krajowe rozegrane');
    // strony
    const fid = await ev(`Object.values(G.ffix).filter(f => f.played && f.res && f.res.heats && f.units.length === 2).sort(by(f => f.d)).pop().id`);
    const fid4 = await ev(`(Object.values(G.ffix).filter(f => f.played && f.res && f.units.length >= 4).pop() || {}).id`);
    const cid = await ev(`Object.keys(G.fclubs)[0]`);
    const rid = await ev(`(Object.values(G.riders).find(r => r.clubId === G.clubId && r.fx && r.fx.list.length) || Object.values(G.riders).find(r => r.fx && r.fx.list.length)).id`);
    const natEv = await ev(`(Object.values(G.events).find(e => e.comp === 'N_GER' && e.played) || {}).id`);
    const routes = ['#/zagranica', '#/zagranica/GBP', '#/zagranica/GBP/terminarz', '#/zagranica/GBP/sklady', '#/zagranica/GBP/regulamin', '#/zagranica/SWE1', '#/zagranica/SWE3/regulamin',
      '#/zagranica/DEN1/regulamin', '#/zagranica/FRA', '#/zagranica/FRA/regulamin', '#/zagranica/CZE2', '#/zagranica/GER2/sklady', '#/zagranica/RUS/terminarz',
      `#/zagranica/mecz/${fid}`, `#/zagranica/mecz/${fid}/biegi`, ...(fid4 ? [`#/zagranica/mecz/${fid4}`, `#/zagranica/mecz/${fid4}/biegi`] : []), `#/zagranica/klub/${cid}`,
      '#/rozgrywki', '#/rozgrywki/N_GER', '#/rozgrywki/N_GER/klasyfikacja', '#/rozgrywki/N_GBR', ...(natEv ? [`#/gp/${natEv}`] : []), `#/zawodnik/${rid}/terminarz`, '#/sztab/kalendarz'];
    for (const r of routes) {
      await ev(`location.hash = '${r}'`); await delay(120);
      const ok = await ev(`!!document.querySelector('#main') && !/Nie znaleziono/.test(document.querySelector('#main').innerText)`);
      check(ok, `strona ${r}`);
    }
    const fr = await ev(`(Object.values(G.riders).find(r => r.clubId === G.clubId && r.fstats && r.fstats[G.season]) || Object.values(G.riders).find(r => r.fstats && r.fstats[G.season] && r.clubId)).id`);
    await ev(`location.hash = '#/zawodnik/${fr}'`); await delay(150); await shot('profil-przeglad');
    check(await ev(`[...document.querySelectorAll('#main .row.small.click')].length > 0 && /Za granicą:/.test(document.querySelector('#main').innerText)`), 'profil: ostatnie mecze z ligą zagraniczną i podsumowanie startów za granicą');
    await ev(`location.hash = '#/zawodnik/${fr}/statystyki'`); await delay(150); await shot('profil-statystyki');
    check(await ev(`/Ligi zagraniczne/.test(document.querySelector('#main').textContent)`), 'profil: tabela lig zagranicznych w statystykach');
    check(await ev(`riderStarts(G.riders[${fr}]).some(x => x.href.startsWith('#/zagranica/mecz/'))`), 'profil: starty za granicą w liście startów');
    const lg1 = await ev(`statLeagues(G.riders[${fr}])[0]`);
    await ev(`UI.statLg = '${lg1}'; render()`); await delay(150); await shot('profil-statystyki-liga');
    check(await ev(`document.querySelectorAll('#main .seg .btn').length >= 3 && /Sezony – /.test(document.querySelector('#main').textContent) && [...document.querySelectorAll('#main tr.click')].every(tr => (tr.getAttribute('onclick') || '').includes('zagranica/mecz'))`), 'profil: przełącznik lig – statystyki i starty jednej ligi zagranicznej');
    await ev(`UI.statLg = 'PL'; render()`); await delay(120);
    check(await ev(`![...document.querySelectorAll('#main tr.click')].some(tr => (tr.getAttribute('onclick') || '').includes('zagranica/mecz'))`), 'profil: przełącznik „Polska” – bez startów zagranicznych');
    await ev(`UI.statLg = ''`);
    await ev(`location.hash = '#/zawodnik/${fr}/starty'`); await delay(150);
    check(await ev(`document.querySelectorAll('#main tr.click').length > 0`), 'profil: pełna lista startów z meczami zagranicznymi');
    await ev(`location.hash = '#/zagranica'`); await delay(150); await shot('przeglad');
    check(await ev(`![...document.querySelectorAll('#main .comp-card .nm')].some(x => /Puchar|BSN Series/.test(x.textContent)) && Object.values(G.riders).every(r => statLeagues(r).every(lg => !FP.cups[lg]))`), 'puchary nie są ligami: brak w przeglądzie lig i w przełączniku statystyk');
    const trc = await ev(`(() => { const l = fTransferWindow(G.season + 1); const x = l.find(t => t.to && t.from && t.kind !== 'koniec'); return x ? x.to : null; })()`);
    await ev(`location.hash = '#/zagranica/transfery'`); await delay(150); await shot('transfery');
    check(await ev(`document.querySelectorAll('#main table tbody tr').length > 10`), 'okno transferowe: lista ruchów');
    await ev(`location.hash = '#/zagranica/klub/${trc}'`); await delay(150);
    check(await ev(`/Transfery przed sezonem/.test(document.querySelector('#main').textContent) && /przychodzi/.test(document.querySelector('#main').textContent)`), 'okno transferowe: transfery na stronie klubu');
    await ev(`location.hash = '#/zagranica/SWE1'`); await delay(150); await shot('tabela');
    await ev(`location.hash = '#/zagranica/DEN1/regulamin'`); await delay(150); await shot('regulamin');
    await ev(`location.hash = '#/zagranica/GBP/statystyki'`); await delay(150); await shot('statystyki-gbp');
    check(await ev(`(() => { const t = document.querySelector('#main').textContent; return /CMA/.test(t) && /Wygrane/.test(t) && document.querySelectorAll('#main tbody tr.click').length >= 10; })()`), 'statystyki ligi: Premiership z CMA');
    await ev(`location.hash = '#/zagranica/SWE1/statystyki'`); await delay(150);
    check(await ev(`!/CMA/.test(document.querySelector('#main thead').textContent) && document.querySelectorAll('#main tbody tr.click').length >= 10`), 'statystyki ligi: Bauhaus-ligan (średnia biegowa)');
    await ev(`location.hash = '#/zagranica/SWE1/sklady'`); await delay(150); await shot('sklady');
    check(await ev(`(() => { const h = document.querySelector('#main thead').textContent; return /Mecze/.test(h) && /Biegi/.test(h) && /Średnia/.test(h) && !document.querySelector('#main .t a[href^="#/klub"]'); })()`), 'składy: mecze, biegi, średnia, bez polskiego klubu');
    await ev(`location.hash = '#/zagranica/mecz/${fid}/biegi'`); await delay(150); await shot('biegi');
    await ev(`UI.cal = '2026-05'; UI.calCats.zagr = true; UI.calCats.kraje = true; location.hash = '#/kalendarz'; render()`); await delay(200); await shot('kalendarz');
    check(await ev(`document.querySelectorAll('.cal .ev.zagr').length > 5`), 'kalendarz: terminy lig zagranicznych');
    await ev(`UI.cal = '2026-06'; render()`); await delay(150);
    check(await ev(`[...document.querySelectorAll('.cal .ev')].some(e => /Mistrzostwa (Danii|Szwecji|Wielkiej)/.test(e.innerText))`), 'kalendarz: mistrzostwa krajowe (czerwiec)'); await shot('kalendarz-czerwiec');
    await ev(`location.hash = '#/rozgrywki'`); await delay(150); await shot('zawody');
    // zapis i wczytanie: nowe kolekcje fclubs i ffix w bazie gry
    await ev('dbSaveNow()');
    const snap = await ev(`JSON.stringify({ d: G.date, ff: Object.values(G.ffix).filter(f => f.played).length, fc: Object.keys(G.fclubs).length, sq: Object.values(G.fclubs).reduce((n, c) => n + c.squad.length, 0), st: fStandings('SWE1').map(r => r.cid + r.tp).join() })`);
    await ev('ACT.mainMenu()'); await delay(200);
    await ev(`ACT.loadGame('${gameId}')`);
    for (let i = 0; i < 200; i++) { if (await ev('!!(G && G.gameId)')) break; await delay(150); }
    const snap2 = await ev(`JSON.stringify({ d: G.date, ff: Object.values(G.ffix).filter(f => f.played).length, fc: Object.keys(G.fclubs).length, sq: Object.values(G.fclubs).reduce((n, c) => n + c.squad.length, 0), st: fStandings('SWE1').map(r => r.cid + r.tp).join() })`);
    check(snap === snap2, `wczytany stan lig zagranicznych zgodny z zapisanym ${snap.slice(0, 120)}`);
    await ev(`(() => { const end = addDays(G.date, 10); let g = 0; while (G.date < end && g++ < 100) { const d0 = G.date, r = advance(7); if (r.stop === 'match') { const f = r.fixture; const m = G.matches[f.matchId] || createMatch(f); simulateMatch(m); afterFixture(f); } else if (G.date === d0) { processDay(G.date); G.date = addDays(G.date, 1); newDay(); } } })()`);
    check(await ev(`Object.values(G.ffix).filter(f => f.played).every(f => f.res)`), 'po wczytaniu: rozegrane mecze mają wyniki w G.ffix');
    check(await ev(`Object.values(G.ffix).filter(f => f.played).length > ${JSON.parse(snap).ff}`), 'po wczytaniu mecze lig zagranicznych są dalej rozgrywane');
    check(errors.length === 0, 'brak błędów JS w konsoli' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    console.log('Test lig zagranicznych zakończony. Zrzuty: tools/screenshots/foreign-*.png');
  } finally {
    try { await call('Browser.close'); } catch (e) { /* */ }
    chrome.kill();
    server.close();
    if (gameId && !process.argv.includes('--keep')) for (const x of ['', '-wal', '-shm']) { const f = path.join(__dirname, '..', 'saves', gameId + '.sqlite' + x); if (fs.existsSync(f)) fs.unlinkSync(f); }
  }
})().catch(e => { console.error(e.message || e); if (errors.length) console.error('Błędy konsoli:', errors.slice(0, 5)); process.exitCode = 1; });
