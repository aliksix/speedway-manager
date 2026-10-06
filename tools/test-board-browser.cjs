// Test w przeglądarce: Klub → Zarząd (władze klubów, powiązania ze sponsorami i miastem), zmiany w zarządach, wyłączność sponsorów.
// Uruchomienie: node tools/test-board-browser.cjs (zrzuty: tools/screenshots/board-*.png)
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
  await ev("START.wiz=quickWizard(7,'Test zarządu');ACT.startGame()");
  for (let i = 0; i < 100; i++) { gameId = await ev('G&&G.gameId'); if (gameId) break; await sleep(100); }
  check(!!gameId, 'nowa gra w SQLite (Stal Gorzów)');
  const txt = () => ev(`document.querySelector('#main').innerText`);
  await ev(`go('#/klub')`); await sleep(250);
  let t = await txt();
  check(/Dariusz Wróbel/.test(t) && /Prezes zarządu/.test(t) && /Zbigniew Głuchy/.test(t), 'Klub → Zarząd: prezes i rada nadzorcza');
  check(/właściciel Gezet/.test(t) && /Powiązania/i.test(t), 'tabela władz: powiązanie członka rady ze sponsorem tytularnym');
  check(/23% głosów/.test(t) && /Koszt władz klubu/i.test(t), 'właściciel i koszt władz');
  await shot('board-gorzow');
  // inny klub: Grudziądz – miasto właścicielem
  await ev(`go('#/zespol/8/zarzad')`); await sleep(250);
  t = await txt();
  check(/Marcin Murawski/.test(t) && /przedstawiciel miasta/.test(t) && !/Poproś/.test(t), 'Grudziądz: przedstawiciele miasta w radzie, bez próśb (obcy klub)');
  // zmiana prezesa w Częstochowie 16.10.2025
  check(await ev(`boardPeople(6).find(p=>p.role==='prezes').name`) === 'Michał Świącik', 'Częstochowa 15.10: ustępujący prezes');
  await ev(`G.date='2025-10-16'; boardDay()`);
  check(await ev(`boardPeople(6).find(p=>p.role==='prezes').name`) === 'Bartłomiej Januszka', 'Częstochowa 16.10: prezesem właściciel (KRS)');
  check(await ev(`Object.values(G.messages).some(m=>/Bartłomiej Januszka/.test(m.title))`), 'komunikat o zmianie prezesa');
  // wyłączność sponsorów
  const pool = id => ev(`firmPool(G.clubs[${id}]).map(f=>f.key)`);
  check(!(await pool(3)).includes('beckhoff'), 'Beckhoff (strategiczny Sparty) niedostępny dla Falubazu');
  check((await pool(16)).includes('beckhoff'), 'Beckhoff dostępny dla Orła (realne przejście na 2026)');
  check((await pool(3)).includes('orlen'), 'Orlen (spółka Skarbu Państwa) dostępny dla wielu klubów');
  check(await ev(`firmLocks()[firmKey('Krono-Plast')].clubId`) === 6 && !!(await ev(`firmLockedFor(firms()[firmKey('Krono-Plast')], G.clubs[1])`)), 'Krono-Plast związany z Włókniarzem (właściciel)');
  check(await ev(`firmLockedFor(firms()['pres-grupa-deweloperska'], G.clubs[10])`) === null, 'PRES: wyjątek Toruń + Bydgoszcz');
  check(await ev(`firmLocks()[firmKey('Investon')].clubId`) === 13 && await ev(`firmLocks()[firmKey('Nova')].why`) === 'board', 'Poznań: Investon i Nova związane z PSŻ przez zarząd');
  check(await ev(`boardPeople(19)[0].name`) === 'Andris Morozovs', 'Lokomotiv: prezes Andris Morozovs');
  check(await ev(`(()=>{const t=Object.values(G.sponsors).find(s=>s.clubId===19&&s.kind==='tytularny');return t&&t.name==='Optibet'&&t.until===2025;})()`), 'Lokomotiv: Optibet tytularny do 2025');
  check((await pool(19)).includes(await ev(`firmKey('LV BET')`)), 'Lokomotiv: LV BET w rozmowach (tytularny od 2026)');
  await ev(`go('#/zespol/13/zarzad')`); await sleep(200);
  check(/Grzegorz Struzik/.test(await txt()) && /Investon/.test(await txt()), 'Poznań → Zarząd: Struzik i powiązanie z Investonem');
  // zadłużenie Stali, GBS – nazwa stadionu
  check(await ev(`finDebt(G.clubs[7])`) > 5e6, 'Stal Gorzów: zadłużenie na start (zaległości + kredyt)');
  check(await ev(`Object.values(G.sponsors).some(s=>s.clubId===7&&/GBS/.test(s.name)&&s.assets.stadium)`), 'GBS: prawa do nazwy stadionu w Gorzowie');
  check(/Redukcja zadłużenia/.test(await ev(`finObjective(myClub()).text`)), 'cel finansowy Stali: redukcja zadłużenia');
  // obowiązki: wskazana osoba zamiast najlepszej
  const sid = await ev(`(()=>{const s=clubStaff(G.clubId).sort(by(x=>x.attrs.coaching||0))[0];return s.id;})()`);
  await ev(`setDuty('coaching','${sid}')`);
  check(await ev(`staffBest(G.clubId,'coaching')===(G.staff['${sid}'].attrs.coaching||0)`), 'obowiązki: wskazany trener zamiast najlepszego');
  await ev(`G.manager.attrs.negotiation=20;G.manager.attrs.media=20;setDuty('sponsors','mgr')`);
  check(await ev(`dutyF('sponsors',G.clubId)`) > 1.15, 'umiejętności menedżera: negocjacje sponsorskie');
  await ev(`go('#/sztab/obowiazki')`); await sleep(200);
  check(/Pozyskiwanie sponsorów/.test(await txt()) && await ev(`document.querySelectorAll('#main select').length`) >= 14, 'Trening → Obowiązki: edytowalne zadania sportowe i organizacyjne');
  await shot('board-duties');
  // zarząd: zaufanie, cele, prośby
  await ev(`go('#/klub')`); await sleep(200);
  t = await txt();
  check(/Zaufanie zarządu do menedżera/i.test(t) && /Cele zarządu/i.test(t) && /Poproś/.test(t), 'Zarząd: zaufanie, cele i prośby');
  await ev(`G.board.confidence=90; ACT.boardReq('contract')`);
  check(await ev(`G.board.pending.length===1 && !((G.board.asks||{})[finObjYear()]||{}).contract`), 'prośba czeka na decyzję zarządu');
  await ev(`G.board.pending[0].due=G.date; boardRequestsDay()`);
  check(await ev(`!!G.board.asks[finObjYear()].contract && Object.values(G.messages).some(m=>/Przedłużenie kontraktu menedżera/.test(m.title))`), 'odpowiedź zarządu w wiadomości');
  await shot('board-mine');
  // zwolnienie: cel – mistrzostwo, 6 porażek z rzędu
  await ev(`G.board.confidence=65;G.board.streak=0;myClub().objective={code:'title',text:'Walka o mistrzostwo',minPos:2}`);
  const fid = await ev(`(Object.values(G.fixtures).some(f=>f.league)||makeLeagueFixtures(2026), Object.values(G.fixtures).find(f=>f.league&&(f.homeId===G.clubId||f.awayId===G.clubId)).id)`);
  for (let i = 0; i < 6; i++) await ev(`(()=>{const f=G.fixtures['${fid}'];boardAfterMatch({fixtureId:f.id,homeId:f.homeId,awayId:f.awayId,score:f.homeId===G.clubId?{H:35,A:55}:{H:55,A:35}});})()`);
  check(await ev(`!!G.sacked`), `zwolnienie po 6 porażkach przy celu „mistrzostwo” (zaufanie ${await ev('Math.round(G.board.confidence)')}%)`);
  check(await ev(`G.sacked.offers.length===0 && !!G.clubs[7].vacancy && !G.staff[G.manager.coachId].clubId`), 'po zwolnieniu: brak ofert z automatu, Stal ma wakat');
  await ev(`Object.values(G.clubs).forEach(c=>{if(c.id!==7)c.vacancy=null})`);
  await ev(`go('#/zwolniony')`); await sleep(200);
  check(/Żaden klub nie szuka/.test(await txt()), 'bez wolnych stanowisk nie ma gdzie aplikować');
  check(['day', 'message'].includes(await ev(`advanceDay().stop`)), 'bez pracy czas płynie dalej');
  // wakaty w innych klubach: aplikacje i odpowiedzi
  const got = await ev(`(()=>{const cs=Object.values(G.clubs).filter(c=>c.id!==7&&clubActive(c)&&clubStaff(c.id).some(s=>s.role==='coach')).sort(by(c=>-LEAGUE_ORDER.indexOf(c.league))).slice(0,8);
    for(const c of cs){openVacancy(c,clubStaff(c.id).find(s=>s.role==='coach'),'test');applyJob(c.id);G.sacked.apps[c.id].due=G.date;vacanciesDay();if(G.sacked.offers.length)return c.id;}return 0;})()`);
  check(got > 0, 'aplikacja na wolne stanowisko zakończona ofertą');
  await ev(`go('#/zwolniony')`); await sleep(200);
  check(/Przyjmij/.test(await txt()) && /Wolne stanowiska/i.test(await txt()), 'ekran bez pracy: oferty i wolne stanowiska');
  await shot('board-sacked');
  await ev(`ACT.acceptJob(${got})`); await sleep(200);
  check(await ev(`G.clubId===${got} && G.staff[G.manager.coachId].clubId===${got} && !G.clubs[${got}].vacancy && !jobless()`), 'nowy klub przyjęty, wakat zamknięty');
  await ev(`G.clubs[7].vacancy.fillOn=G.date; vacanciesDay()`);
  check(await ev(`clubStaff(7).some(s=>s.role==='coach') && !G.clubs[7].vacancy`), 'Stal zatrudnia nowego menedżera po wakacie');
  await ev(`go('#/klub')`); await sleep(200);
  check(/Wynagrodzenie/i.test(await txt()), 'tabela zarządu z wynagrodzeniami');
  await ev('dbSaveNow()'); await ev(`dbLoad('${gameId}')`); await sleep(200);
  await ev(`go('#/klub')`); await sleep(200);
  check(/Właściciel/i.test(await txt()), 'po wczytaniu: zakładka Zarząd działa');
  check(!errors.length, 'brak błędów JS: ' + errors.join(' | '));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  try { if (ws) await call('Browser.close'); } catch {} chrome?.kill(); server.close();
  if (gameId) for (const s of ['', '-wal', '-shm']) { const f = path.join(root, 'saves', gameId + '.sqlite' + s); if (fs.existsSync(f)) fs.unlinkSync(f); }
});
