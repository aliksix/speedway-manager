#!/usr/bin/env node
// Test przeglądarkowy zawodników z USA (js/usa-data.js): licencja AMA z rokiem z profilu, data i miejsce urodzenia,
// krewni z profili, adept, regulamin mistrzostw USA. Zrzuty: tools/screenshots/usa-*.png. Uruchomienie: node tools/test-usa-browser.cjs
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
async function shot(name) { const s = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(SHOTS, 'usa-' + name + '.png'), Buffer.from(s.data, 'base64')); }
function check(cond, msg) { if (!cond) throw new Error('BŁĄD: ' + msg); console.log('  ✓ ' + msg); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await claimSlot();
  console.log(`  slot testu ${SLOT}: serwer ${PORT}, DevTools ${CDP}`);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${CDP}`, `--user-data-dir=${path.join(__dirname, `.browser-test-${SLOT}`)}`, 'about:blank'], { stdio: 'ignore' });
  let code = 0;
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
    // gra bez zapisu na serwerze (sam interfejs)
    await ev(`(() => { newGame({ clubId: 9, manager: 'Test' }); buildLayout(); location.hash = '#/skrzynka'; render(); })()`);
    check(await ev(`typeof USA_DATA === 'object' && Object.keys(USA_DATA.profiles).length >= 20`), 'js/usa-data.js wczytany');
    const nicol = await ev(`(Object.values(G.riders).find(r => r.name === 'Broc Nicol') || {}).id`);
    check(!!nicol, 'Broc Nicol w bazie');
    await ev(`location.hash = '#/zawodnik/${nicol}'`); await delay(300);
    const txt = await ev(`document.querySelector('#main').textContent`);
    check(!/Profil – żużel w USA|B-Rock/.test(txt), 'bez nowych pól profilu (przydomek, numer…)');
    check(/zdobyta w 2014/.test(txt) && /licencja federacji USA – American Motorcyclist Association/.test(txt), 'licencja AMA z rokiem z profilu (Nicol: 2014)');
    check(/Torrance/.test(txt) && /1998/.test(txt), 'data i miejsce urodzenia z profilu');
    await shot('profil-nicol');
    const ruml = await ev(`(Object.values(G.riders).find(r => r.name === 'Max Ruml') || {}).id`);
    await ev(`location.hash = '#/zawodnik/${ruml}'`); await delay(300);
    check(/Dillon Ruml/.test(await ev(`document.querySelector('#main').textContent`)), 'krewni z profilu (brat Dillon Ruml)');
    const kid = await ev(`(Object.values(G.academy).find(k => k.name === 'Mason Howell') || {}).id`);
    check(!!kid, 'adept Mason Howell w bazie');
    await ev(`location.hash = '#/adept/${kid}'`); await delay(300);
    check(/Mason Howell/i.test(await ev(`document.querySelector('#main').textContent`)), 'karta adepta z USA');
    await shot('adept-howell');
    await ev(`location.hash = '#/rozgrywki/N_USA'`); await delay(300);
    check(!/Nie znaleziono/.test(await ev(`document.querySelector('#main').textContent`)), 'strona mistrzostw USA');
    await shot('rozgrywki');
    await ev(`location.hash = '#/rozgrywki/N_USA/regulamin'`); await delay(300);
    const reg = await ev(`document.querySelector('#main').textContent`);
    check(/20 biegów/.test(reg) && /Licencje i klasy/.test(reg) && /Medaliści/.test(reg) && !/sidecar|długim torze/i.test(reg), 'regulamin mistrzostw USA (bez sidecarów i długiego toru)');
    await shot('regulamin');
    check(!errors.length, 'brak błędów w konsoli' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    console.log('OK – profile USA w przeglądarce');
  } catch (e) { console.error(e.message); if (errors.length) console.error(errors.slice(0, 5)); code = 1; }
  try { await call('Browser.close'); } catch (e) { /* zamknięte */ }
  chrome.kill(); server.close();
  process.exit(code);
})();
