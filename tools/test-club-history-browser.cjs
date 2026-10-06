// Test w przeglądarce: Klub → Tor (plan), próba toru w zapowiedzi meczu, polecenia dla toromistrza w przerwie, zapis w SQLite.
// Uruchomienie: node tools/test-track-browser.cjs (zrzuty: tools/screenshots/track-*.png)
const fs = require('fs'), path = require('path'), net = require('net'), { spawn } = require('child_process'), { server } = require('./server.js');
const root = path.resolve(__dirname, '..'), SHOTS = path.join(__dirname, 'screenshots');
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0, gameId, chrome, port, debug, slot;
const pending = new Map(), errors = [];
const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function shot(name) { const s = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(s.data, 'base64')); }
function check(ok, msg) { if (!ok) throw Error('BŁĄD: ' + msg); console.log('  ✓ ' + msg); }
// sloty jak w tools/test-browser.js: serwer 8799–8808, DevTools 9231–9240
async function claimSlot() {
  const first = Math.floor(Math.random() * 10);
  for (let k = 0; k < 10; k++) {
    const i = (first + k) % 10;
    const ok = await new Promise(r => { const onErr = () => r(false); server.once('error', onErr); server.listen(8799 + i, '127.0.0.1', () => { server.removeListener('error', onErr); r(true); }); });
    if (!ok) continue;
    const free = await new Promise(r => { const t = net.createServer().once('error', () => r(false)).once('listening', () => t.close(() => r(true))).listen(9231 + i, '127.0.0.1'); });
    if (!free) { await new Promise(r => server.close(r)); continue; }
    slot = i; port = 8799 + i; debug = 9231 + i; return;
  }
  throw Error('Brak wolnego slotu testów');
}
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await claimSlot();
  chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,1000', `--remote-debugging-port=${debug}`, `--user-data-dir=${path.join(__dirname, `.browser-test-${slot}`)}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let targets; for (let i = 0; i < 60 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${debug}/json`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: `http://127.0.0.1:${port}` });
  for (let i = 0; i < 100; i++) { if (await ev('typeof ACT!=="undefined"&&typeof DB!=="undefined"&&DB.on')) break; await sleep(100); }
  await ev("START.wiz=quickWizard(9,'Test historii');ACT.startGame()");
  for (let i = 0; i < 100; i++) { gameId = await ev('G&&G.gameId'); if (gameId) break; await sleep(100); }
  check(!!gameId, 'nowa gra w SQLite');
  const txt = () => ev(`document.querySelector('#main').innerText`);
  const counts = await ev(`Object.values(G.clubs).map(c=>c.short+':'+clubSeasonRows(c).length).join(' ')`);
  console.log('  ' + counts);
  check(await ev(`Object.values(G.clubs).filter(c=>c.short!=='WAR').every(c=>clubSeasonRows(c).length>0)`), 'każdy klub ma sezony sprzed gry');
  await ev(`go('#/klub/historia')`); await sleep(300);
  let t = await txt();
  check(/Sezony ligowe w Polsce/i.test(t) && /1948/.test(t) && /2025/.test(t) && /Ekstraliga/.test(t) && /1 liga/.test(t), 'Klub → Historia: sezony 1948–2025 z nazwami lig');
  check(await ev(`clubSeasonRows(myClub()).filter(x=>x.pos===1&&histLevel(x.season,x.league)===0).length`) === 19, 'Unia Leszno: 19 tytułów DMP (1949–54, 1979–80, 1984, 1987–89, 2007, 2010, 2015, 2017–20)');
  await shot('club-history-own');
  // sezon rozegrany w grze
  await ev(`G.clubs[7].history.push({season:2026,league:'PGE',pos:1,label:'Mistrz',top:'Bartosz Zmarzlik',manager:clubStaff(7).find(s=>s.role==='coach').name}); go('#/zespol/7/historia')`); await sleep(300);
  t = await txt();
  check(/Gorzów/.test(t) && /gra/.test(t) && /1955/.test(t) && !/Bartosz Zmarzlik/.test(t), 'Stal Gorzów: sezon z gry + historia od 1955, bez najlepszego zawodnika');
  check(/Menedżer/i.test(t) && /Stanisław Chomski/.test(t) && /Ryszard Nieścieruk/.test(t) && /Edward Jancarz/.test(t), 'kolumna Menedżer uzupełniona historycznie');
  check(await ev(`clubSeasonRows(G.clubs[7]).find(x=>x.season===2026).managers[0]===clubStaff(7).find(s=>s.role==='coach').name`), 'sezon z gry: menedżer (główny trener AI)');
  await shot('club-history-other');
  // historia ligi: medaliści, awanse i spadki od 1948 (dawna 1 liga = Ekstraliga, dawna 2 liga = 2. Ekstraliga)
  await ev(`UI.league='PGE'; go('#/liga/historia')`); await sleep(300);
  t = await txt();
  check(/1948/.test(t) && /PKM Warszawa/.test(t) && /Unia Leszno/.test(t) && /2025/.test(t) && /spadek/.test(t), 'Liga → Historia (PGE): medaliści 1948–2025, spadki');
  await shot('league-history-pge');
  await ev(`UI.league='2E'; render()`); await sleep(300);
  t = await txt();
  check(/1948/.test(t) && /Polonia Bytom/.test(t) && /1999/.test(t) && /2000/.test(t) && /awans/.test(t), 'Liga → Historia (2. Ekstraliga): dawna 2 liga do 1999, 1 liga od 2000, awanse');
  await shot('league-history-2e');
  await ev(`UI.league='KLZ'; render()`); await sleep(300);
  t = await txt();
  check(/1957/.test(t) && /grupa/i.test(t) && /2025/.test(t), 'Liga → Historia (KLŻ): 3 liga 1957–59 (grupy) i 2 liga od 2000');
  check(!errors.length, 'brak błędów JS: ' + errors.join(' | '));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  try { if (ws) await call('Browser.close'); } catch {} chrome?.kill(); server.close();
  if (gameId) for (const s of ['', '-wal', '-shm']) { const f = path.join(root, 'saves', gameId + '.sqlite' + s); if (fs.existsSync(f)) fs.unlinkSync(f); }
});
