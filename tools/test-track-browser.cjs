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
  await ev("START.wiz=quickWizard(9,'Test toru');ACT.startGame()");
  for (let i = 0; i < 100; i++) { gameId = await ev('G&&G.gameId'); if (gameId) break; await sleep(100); }
  check(!!gameId, 'nowa gra w SQLite');
  const ids = await ev(`(()=>{G.season=2026;G.date='2026-04-01';makeLeagueFixtures(2026);
    const fs=Object.values(G.fixtures).filter(f=>f.season===2026&&f.stage==='RS').sort(by(f=>f.date));
    return {home:fs.find(f=>f.homeId===G.clubId).id, away:fs.find(f=>f.awayId===G.clubId).id};})()`);
  // Klub → Tor
  await ev(`go('#/klub/tor/'+encodeURIComponent('${ids.home}'))`); await sleep(250);
  const txt = () => ev(`document.querySelector('#main').innerText`);
  let t = await txt();
  check(/Przy krawężniku/i.test(t) && /Czego się spodziewać/i.test(t) && /Bilans/i.test(t), 'Klub → Tor: suwaki, podgląd i bilans dopasowania');
  await ev(`ACT.tpPreset('outer')`); await sleep(150);
  t = await txt();
  check(/Pola startowe/i.test(t) && /Zmiany niezapisane/i.test(t), 'profil gotowy: podgląd pól startowych');
  await ev(`ACT.tpSlide(0, 100)`); await sleep(150);
  check(/Komisarz toru nie dopuści/i.test(await txt()), 'ostrzeżenie komisarza toru przy skrajnym planie');
  await ev(`ACT.tpPreset('outer'); ACT.tpSave()`); await sleep(150);
  check(await ev(`!!(G.trackPlan&&G.trackPlan.fx&&G.trackPlan.fx['${ids.home}'])`), 'plan na mecz zapisany');
  await shot('track-plan');
  // zapowiedź meczu domowego: próba toru
  await ev(`G.date=G.fixtures['${ids.home}'].date; go('#/zawody/${ids.home}')`); await sleep(250);
  t = await txt();
  check(/Tor i próba toru/i.test(t) && /plan na ten mecz/i.test(t), 'zapowiedź: plan toru i wybór zawodników na próbę');
  const tester = await ev(`validLineup(G.clubId, G.lineups[G.clubId] || autoLineup(G.clubId, G.date), G.date)[6]`);
  await ev(`ACT.ttSet('${ids.home}', 0, ${tester}); ACT.ttSet('${ids.home}', 1, 0)`); await sleep(150);
  check(await ev(`JSON.stringify(G.trackTest['${ids.home}'])===JSON.stringify([${tester}])`), 'gracz wskazał jednego zawodnika na próbę');
  await shot('track-preview');
  // mecz na żywo: raport z próby, przerwa po IV biegu – polecenia
  await ev(`ACT.startMatch('${ids.home}'); if (!G.fixtures['${ids.home}'].matchId) { console.warn(matchDayIssue(G.fixtures['${ids.home}'])); createMatch(G.fixtures['${ids.home}']); go('#/zawody/${ids.home}'); }`); await sleep(250);
  const mid = await ev(`G.fixtures['${ids.home}'].matchId`);
  check(await ev(`(()=>{const m=G.matches['${mid}'];return m.surf&&m.trackTest.H.length===1&&m.trackTest.H[0]===${tester}&&/Raport|raport/i.test(m.testReport.H);})()`), 'mecz: tor z planu i raport z próby');
  for (let i = 0; i < 4; i++) { await ev(`ACT.nextHeat()`); await sleep(120); }
  t = await txt();
  check(/polecenia dla toromistrza/i.test(t), 'przerwa techniczna po IV biegu: panel poleceń');
  await ev(`ACT.brSet('water', 2); ACT.brSet('mat', 'out')`); await sleep(120);
  await shot('track-break');
  await ev(`ACT.nextHeat()`); await sleep(150);
  check(await ev(`(()=>{const b=G.matches['${mid}'].breaks[0];return b.by==='gracz'&&b.water===2&&b.mat==='out';})()`), 'polecenia gracza wykonane w przerwie');
  check(/mocne polewanie/i.test(await txt()), 'komentarz przerwy w przebiegu meczu');
  await ev(`ACT.finishMatch()`); await sleep(250);
  await shot('track-done');
  check(await ev(`G.matches['${mid}'].done && G.matches['${mid}'].breaks.length===4`), 'mecz dokończony: 4 przerwy techniczne');
  // wyjazd: zapowiedź
  await ev(`G.date=G.fixtures['${ids.away}'].date; go('#/zawody/${ids.away}')`); await sleep(250);
  check(/tor przygotowuje gospodarz/i.test(await txt()), 'wyjazd: informacja o torze gospodarza');
  // zapis i wczytanie
  const snap = await ev(`JSON.stringify([G.matches['${mid}'].surf, G.trackPlan, G.trackTest])`);
  await ev('dbSaveNow()'); await ev(`dbLoad('${gameId}')`);
  const snap2 = await ev(`JSON.stringify([G.matches['${mid}'].surf, G.trackPlan, G.trackTest])`);
  if (snap !== snap2) console.log(snap, snap2);
  check(snap === snap2, 'SQLite: stan toru, plany i próby zachowane');
  await ev(`go('#/klub/stadion')`); await sleep(200);
  check(/przygotowanie toru/i.test(await txt()), 'Stadion: link do przygotowania toru');
  check(!errors.length, 'brak błędów JS: ' + errors.join(' | '));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  try { if (ws) await call('Browser.close'); } catch {} chrome?.kill(); server.close();
  if (gameId) for (const s of ['', '-wal', '-shm']) { const f = path.join(root, 'saves', gameId + '.sqlite' + s); if (fs.existsSync(f)) fs.unlinkSync(f); }
});
