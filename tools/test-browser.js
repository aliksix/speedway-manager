#!/usr/bin/env node
// Test w przeglądarce (Chrome headless przez DevTools Protocol, bez pakietów):
// nowa gra → wszystkie ekrany → mecz bieg po biegu → zapis w SQLite → ponowne wczytanie.
// Zrzuty ekranu: tools/screenshots/. Uruchomienie: node tools/test-browser.js
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { server, gamesApi } = require('./server.js');
// Kasowanie zapisu gry utworzonego przez test (także przy przerwaniu Ctrl+C / zabiciu procesu); --keep zostawia zapis
let TEST_GAME = null;
function wipeTestGame() {
  if (!TEST_GAME || process.argv.includes('--keep')) return;
  for (let i = 0; i < 20; i++) { // Windows: plik bywa chwilę zablokowany po zamknięciu serwera
    try { gamesApi.wipe(TEST_GAME); TEST_GAME = null; return; } catch (e) { const t = Date.now() + 150; while (Date.now() < t) { /* czekaj */ } }
  }
  console.error(`Nie udało się skasować zapisu testu ${TEST_GAME}`);
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { wipeTestGame(); process.exit(130); });
process.on('exit', wipeTestGame);

// Sloty testów (kilka sesji może testować równocześnie): 10 par portów – serwer gry 8799–8808, DevTools Chrome 9231–9240.
// Start od losowego slotu; zajęty → następny (cyklicznie). Zajęcie portu serwera rezerwuje cały slot (port DevTools i profil przeglądarki).
const SLOTS = 10, BASE_PORT = 8799, BASE_CDP = 9231;
let PORT = BASE_PORT, CDP = BASE_CDP, SLOT = 0;
async function claimSlot() {
  const first = Math.floor(Math.random() * SLOTS);
  for (let k = 0; k < SLOTS; k++) {
    const i = (first + k) % SLOTS;
    const ok = await new Promise(r => {
      const onErr = () => r(false);
      server.once('error', onErr);
      server.listen(BASE_PORT + i, '127.0.0.1', () => { server.removeListener('error', onErr); r(true); });
    });
    if (!ok) continue;
    // port DevTools tego slotu też musi być wolny (np. po przerwanym teście została przeglądarka)
    const cdpFree = await new Promise(r => { const t = require('net').createServer().once('error', () => r(false)).once('listening', () => t.close(() => r(true))).listen(BASE_CDP + i, '127.0.0.1'); });
    if (!cdpFree) { await new Promise(r => server.close(r)); continue; }
    SLOT = i; PORT = BASE_PORT + i; CDP = BASE_CDP + i;
    return;
  }
  throw new Error(`Brak wolnego slotu testów (porty ${BASE_PORT}–${BASE_PORT + SLOTS - 1})`);
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
async function shot(name) { const s = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(s.data, 'base64')); }
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
    await delay(600);
    check(await ev('DB.on'), 'serwer bazy dostępny');
    await shot('00-start');
    // kreator postaci: dane i dzieci, menedżer, żużel (z rolą trenera), profil trenera, klub
    await ev('ACT.newCareer()'); await delay(120); await shot('01-kreator-dane');
    await ev('ACT.wizNext()'); await delay(60);
    check(await ev(`START.wiz.step === 'dane' && /imię/.test(START.wiz.err)`), 'kreator: walidacja danych osobowych');
    await ev(`Object.assign(START.wiz.person, { first: 'Test', last: 'Menedżer', born: '1978-03-12', place: 'Leszno' }); ACT.wizKid(); ACT.wizKid(); Object.assign(START.wiz.kids[0], { first: 'Kacper', born: '2016-04-02', rides: true }); Object.assign(START.wiz.kids[1], { first: 'Ola', born: '2009-01-01', rides: false }); ACT.wizNext()`); await delay(60);
    check(await ev(`START.wiz.step === 'dane' && /15 lat/.test(START.wiz.err)`), 'kreator: dziecko starsze niż 15 lat (rocznikowo 2026) odrzucone');
    await ev(`START.wiz.kids[1].born = '2013-06-01'; ACT.wizKid(); Object.assign(START.wiz.kids[2], { first: 'Zosia', born: '2022-03-10', rides: true }); renderStart()`); await delay(80); await shot('01-kreator-dzieci');
    check(await ev(`!document.querySelector('input[type=file]') && typeof photoFile === 'undefined'`), 'kreator: bez wgrywania zdjęć menedżera i dzieci');
    await ev('ACT.wizNext()'); await delay(60);
    check(await ev(`START.wiz.step === 'menedzer'`), 'kreator: krok menedżera');
    check(await ev(`!MGR_EXP.some(x => /Ekstralig|niższej lidze|renom/.test(x.name)) && !SPW_EXP.some(x => /Ekstralig|Grand Prix|Reprezentant|niższych lig/.test(x.name))`), 'kreator: debiutant – bez opcji z prowadzeniem klubów i startami w lidze');
    await ev(`ACT.wizSet('mgrExp', 'business'); ACT.wizAttr('mgr', 'negotiation', 3)`); await delay(80); await shot('02-kreator-menedzer');
    check(await ev(`pointsSpent(START.wiz.mgr) === 88 && Object.values(START.wiz.mgr).every(v => v <= 14)`), 'kreator: punkty przeskalowane do nowej puli i limitu');
    await ev(`ACT.wizEven('mgr'); ACT.wizNext()`); await delay(60);
    check(await ev(`START.wiz.step === 'kwalifikacje'`), 'kreator: krok kwalifikacji trenerskich');
    await ev(`ACT.wizSet('spwExp', 'licence'); ACT.wizSet('coachExp', 'coach')`); await delay(80); await shot('03-kreator-kwalifikacje');
    await ev('ACT.wizNext()'); await delay(60);
    check(await ev(`START.wiz.step === 'kwalifikacje' && /uprawnień/.test(START.wiz.err)`), 'kreator: uprawnienia trenera wymagają roku uzyskania');
    await ev(`START.wiz.licYear = '2021'; ACT.wizNext()`); await delay(60);
    check(await ev(`START.wiz.step === 'trener' && coachPool(START.wiz) === 78`), 'kreator: pula trenera = kompetencje + doświadczenie żużlowe');
    await ev(`ACT.wizSet('profile', 'lines'); ACT.wizEven('coach')`); await delay(80); await shot('04-kreator-trener');
    await ev('ACT.wizNext()'); await delay(60);
    await ev(`ACT.wizSet('club', 9); START.wiz.years = 3`); await delay(80); await shot('05-kreator-klub');
    const oldCoach = await ev(`(() => { const s = Object.values(G ? G.staff : {}).find(x => x.clubId === 9 && x.role === 'coach'); return s ? s.name : null; })()`);
    await ev('ACT.startGame()');
    for (let i = 0; i < 80; i++) { if (await ev('!!(G && G.gameId)')) break; await delay(150); }
    gameId = await ev('G.gameId'); TEST_GAME = gameId;
    check(!!gameId, `utworzono grę ${gameId}`);
    check(await ev(`G.manager.attrs && G.manager.born === '1978-03-12' && G.manager.exp === 'business' && G.manager.spwExp === 'licence' && G.manager.coachExp === 'coach'`), 'postać menedżera zapisana w grze');
    check(await ev(`(() => { const s = G.staff[G.manager.coachId]; return s.until === G.season + 3 && s.wage > 0 && s.licence && s.licence.kind === 'trener' && s.licence.year === 2021; })()`), 'kontrakt gracza (3 sezony, pensja) i licencja trenerska w profilu');
    check(await ev(`(() => { const freed = Object.values(G.staff).filter(x => x.prevClubId === G.clubId && x.clubId == null && !x.player); return freed.length >= 1 && freed.every(x => x.role === 'coach'); })()`), 'dotychczasowy menedżer zwolniony – trener bez kontraktu');
    check(await ev(`(() => { const s = G.staff[G.manager.coachId]; return s && s.player && s.role === 'coach' && s.clubId === G.clubId && s.profile.main === 'lines' && !clubStaff(G.clubId).some(x => x.role === 'coach' && !x.player); })()`), 'menedżer jest trenerem, dotychczasowi trenerzy zostali asystentami');
    check(await ev(`(() => { const ch = G.manager.children; const k = G.academy[ch[0].kidId]; return ch.length === 3 && k && k.clubId === G.clubId && k.name === 'Kacper Menedżer' && k.ca != null && !ch[1].kidId; })()`), 'jeżdżące dziecko dopisane do szkółki klubu, niejeżdżące tylko w profilu');
    check(await ev(`(() => { const k = G.academy[G.manager.children[0].kidId]; const s = G.staff[G.manager.coachId]; return !k.photo && !s.photo && !G.manager.photo; })()`), 'zdjęcia menedżera i dzieci nie są zapisywane w danych gry');
    check(await ev(`(() => { const z = G.manager.children[2]; return z.joinOn === childJoinDate('2022-03-10') && !z.kidId; })()`), 'młodsze dziecko czeka na urodziny uprawniające do szkółki');
    check(await ev(`(() => { const z = G.manager.children[2], d = G.date; G.date = addDays(z.joinOn, -1); managerChildrenDay(); const before = !z.kidId; G.date = z.joinOn; managerChildrenDay(); G.date = d; return before && !!G.academy[z.kidId] && G.academy[z.kidId].cat === 'c50'; })()`), 'dziecko dołącza do szkółki w dniu urodzin uprawniających do szkółki');
    // tymczasowe zdjęcie menedżera (img/staff/test-menedzer.png): po wczytaniu sylwetka zastępcza ma zniknąć
    const mgrPic = path.join(__dirname, '..', 'img', 'staff', 'test-menedzer.png');
    fs.copyFileSync(path.join(__dirname, '..', 'img', 'staff', 'piotr-protasiewicz.png'), mgrPic);
    try {
      await ev(`location.hash = '#/druzyna/sztab'`); await delay(400);
      check(await ev(`(() => { const i = document.querySelector('.card.staff img'), sil = document.querySelector('.card.staff .sil'); return !!(i && i.src.includes('/test-menedzer.') && i.complete && i.naturalWidth) && (!sil || getComputedStyle(sil).display === 'none'); })()`), 'zdjęcie menedżera z img/staff w Drużyna → Sztab, bez sylwetki pod spodem'); await shot('sztab-zdjecie');
    } finally { fs.rmSync(mgrPic, { force: true }); }
    await ev(`location.hash = '#/szkolka'`); await delay(120); await shot('szkolka-zdjecie');
    await ev(`location.hash = '#/menedzer'`); await delay(250);
    check(await ev(`location.hash === '#/osoba/' + G.manager.coachId && document.querySelectorAll('.tabs a').length >= 3`), 'profil gracza jak u trenerów (Przegląd / Kontrakt / Historia)'); await shot('menedzer-profil');
    await ev(`location.hash = '#/osoba/' + G.manager.coachId + '/historia'`); await delay(150);
    check(await ev(`/Debiut/.test(document.querySelector('#main').innerText)`), 'historia gracza: debiut, bez prowadzonych drużyn'); await shot('menedzer-historia');
    await ev(`location.hash = '#/osoba/' + G.manager.coachId + '/kontrakt'`); await delay(150); await shot('menedzer-kontrakt');
    // inny klub: Skład (kafle / lista) i Sztab; sztab z przełącznikiem kafle / lista
    await ev(`UI.teamView = 'karty'; location.hash = '#/zespol/1'`); await delay(150);
    check(await ev(`(() => { const t = [...document.querySelectorAll('.tabs a')].map(a => a.textContent); return t.includes('Sztab') && !t.includes('Lista zawodników') && !!document.querySelector('#main .cards') && [...document.querySelectorAll('#main .seg button')].some(b => b.textContent === 'Lista'); })()`), 'inny klub: zakładki Skład (kafle / lista) i Sztab');
    await ev(`UI.teamView = 'lista'; render()`); await delay(120);
    check(await ev(`document.querySelectorAll('#main table.t tbody tr').length > 3`), 'inny klub: skład jako lista');
    await ev(`UI.teamView = 'karty'; UI.staffView = 'karty'; location.hash = '#/zespol/1/sztab'`); await delay(150); await shot('zespol-sztab-kafle');
    check(await ev(`document.querySelectorAll('#main .card.staff').length > 0`), 'inny klub: sztab jako kafle');
    await ev(`UI.staffView = 'lista'; render()`); await delay(120); await shot('zespol-sztab-lista');
    check(await ev(`document.querySelectorAll('#main table.t tbody tr.click').length > 0`), 'inny klub: sztab jako lista');
    await ev(`location.hash = '#/druzyna/sztab'`); await delay(150);
    check(await ev(`!!document.querySelector('#main table.t tbody tr.me') && /Ty/.test(document.querySelector('#main table.t tbody tr.me').textContent)`), 'własny sztab jako lista (z menedżerem – Ty)');
    await ev(`UI.staffView = 'karty'; render()`); await delay(80);
    // upływ czasu dzień po dniu: start, zatrzymanie na wydarzeniu albo ręcznie
    const d0 = await ev('G.date');
    await ev('ACT.continue()'); await delay(400);
    check(await ev(`G.date > '${d0}'`), 'Dalej: pierwszy dzień mija od razu');
    await ev('stopPlay()'); await delay(50);
    check(await ev('!UI.play'), 'Dalej: zatrzymanie trybu dzień po dniu');
    const routes = ['#/skrzynka', '#/druzyna', '#/park', '#/park/warsztat', '#/park/tunerzy', '#/park/szkolka', '#/park/rynek', '#/park/rynek/szkolka', '#/kraj/POL', '#/kraj/POL/kadra', '#/kraj/DEN', '#/kraj/LAT', '#/druzyna/taktyka', '#/druzyna/sztab', '#/sztab/kalendarz', '#/druzyna/statystyki', '#/sztab', '#/sztab/trening', '#/sztab/obowiazki', '#/szkolka', '#/szkolka/przeglad', '#/medyczne', '#/medyczne/ryzyko', '#/medyczne/historia',
      '#/kalendarz', '#/kalendarz/lista', '#/kalendarz/sparingi', '#/kalendarz/obozy', '#/liga', '#/liga/terminarz', '#/liga/statystyki', '#/zawodnik/1/starty', '#/liga/historia', '#/transfery', '#/transfery/obserwowani', '#/transfery/negocjacje', '#/transfery/moi', '#/transfery/okienka', '#/transfery/historia',
      '#/zespol/1', '#/zespol/1/lista', '#/zespol/1/sztab', '#/zespol/1/terminarz', '#/zespol/1/klub', '#/zespol/1/historia', '#/kalendarz/imprezy', '#/impreza/e0', '#/gp/EV2026-e0', '#/klub', '#/klub/licencja', '#/klub/stadion', '#/klub/bilety', '#/klub/bilety/PO', '#/klub/bilety/F', '#/klub/karnety', '#/klub/frekwencja', '#/klub/historia', '#/finanse', '#/finanse/kontrakty', '#/finanse/sponsorzy', '#/finanse/budzet', '#/finanse/przeplywy', '#/finanse/reklama', '#/finanse/finansowanie', '#/finanse/transakcje'];
    for (const h of routes) {
      await ev(`location.hash = ${JSON.stringify(h)}`); await delay(120);
      const txt = await ev('document.querySelector("#main").innerText');
      if (/Błąd|undefined|NaN/.test(txt)) throw new Error(`Ekran ${h} zawiera błąd: ${txt.match(/.{0,80}(Błąd|undefined|NaN).{0,80}/)[0]}`);
      await shot(h.slice(2).replace(/\//g, '-'));
    }
    check(true, `${routes.length} ekranów bez błędów`);
    // sparingi: zaproszenie rywala z formularza (Kalendarz → Sparingi)
    await ev(`UI.spar.opp = sparClubs(sparSeason()).filter(c => c.id !== G.clubId).sort(by(c => sparKm(c.id, G.clubId)))[0].id; UI.spar.date1 = sparSeason() + '-03-24'; UI.spar.date2 = sparSeason() + '-03-25'; location.hash = '#/kalendarz/sparingi'; render()`); await delay(150);
    await ev(`[...document.querySelectorAll('#main button')].find(b => b.textContent.includes('Wyślij zaproszenie')).click()`); await delay(150); await shot('sparingi-zaproszenie');
    check(await ev(`sparOf(G.clubId).filter(s => s.status === 'pending').length === 2 && document.querySelector('#main').textContent.includes('czeka na odpowiedź')`), 'sparingi: zaproszenie na dwumecz wysłane z formularza');
    // obóz: wybór ośrodka, wycena na osobę, rezerwacja z formularza
    await ev(`UI.camp = { venue: 'gorican', start: campSeason() + '-03-10', days: 4, riders: null, staff: null }; location.hash = '#/kalendarz/obozy'; render()`); await delay(150); await shot('obozy-wycena');
    check(await ev(`document.querySelector('#main').textContent.includes('Koszt na osobę') && document.querySelector('#main').textContent.includes('Motocykle / busy')`), 'obozy: wycena na osobę z transportem motocykli');
    await ev(`[...document.querySelectorAll('#main button')].find(b => b.textContent.trim() === 'Zarezerwuj').click()`); await delay(150);
    const campId = await ev(`(campOfClub(G.clubId)[0] || {}).id || null`);
    check(!!campId, 'obozy: rezerwacja z formularza');
    if (campId) { await ev(`location.hash = '#/kalendarz/oboz/${campId}'`); await delay(150); await shot('oboz'); check(await ev(`document.querySelector('#main .camp-grid') !== null`), 'obozy: strona obozu z programem dni'); }
    // kalendarz: filtry (kraj, rodzaje, nasi zawodnicy) i puchar brytyjski (js/ui-comp.js, js/ui-foreign.js)
    await ev(`UI.cal = '2026-07'; UI.calF = { who: 'all', cc: 'GBR', allLeague: false, types: {} }; location.hash = '#/kalendarz'; render()`); await delay(150); await shot('kalendarz-filtr-gbr');
    check(await ev(`document.querySelectorAll('#main .chip-row .chip').length >= 10 && document.querySelectorAll('#main .cal .ev').length > 0`), 'kalendarz: filtr kraju (Wielka Brytania) pokazuje zawody');
    await ev(`UI.calF = { who: 'mine', cc: '', allLeague: false, types: {} }; render()`); await delay(120);
    check(await ev(`!!document.querySelector('#main .chip.on') && /ukryto/.test(document.querySelector('#main').textContent)`), 'kalendarz: filtr „z naszymi zawodnikami” ukrywa pozostałe');
    await ev(`UI.calF = null; location.hash = '#/zagranica/GBPK'`); await delay(150); await shot('puchar-premiership');
    check(await ev(`/Premiership Knockout Cup/.test(document.querySelector('#main').textContent) && document.querySelectorAll('#main table.t').length >= 2`), 'puchar Premiership: grupy i dwumecze');
    // memoriał: zakładka organizatora (pula, zaproszenia) – pierwszy turniej na naszym stadionie
    const orgEv = await ev(`(Object.values(G.events).filter(e => orgEligible(e) && orgMine(e) && !e.played).sort(by(e => e.date))[0] || {}).id || null`);
    if (orgEv) {
      await ev(`location.hash = '#/gp/${orgEv}/organizacja'`); await delay(200); await shot('memorial-organizacja');
      check(await ev(`document.querySelector('#main').textContent.includes('Pula nagród')`), 'memoriał: zakładka organizatora z pulą nagród');
    }
    // sparing na żywo: dziś, start z ekranu sparingu, biegi ręcznie, reszta symulacją (pogoda wymuszona)
    const liveId = await ev(`(() => { window._sto = sparTrackOk; sparTrackOk = () => true; const o = sparClubs(sparSeason()).find(c => c.id !== G.clubId && !sparBusy(c.id, G.date)); const id = 'S' + (G.seq.spar = (G.seq.spar || 1) + 1); G.sparings[id] = { id, season: sparSeason(), date: G.date, homeId: G.clubId, awayId: o.id, status: 'agreed', by: G.clubId, leg: 0, tickets: 0, created: G.date }; return id; })()`);
    await ev(`location.hash = '#/kalendarz/sparing/${liveId}'`); await delay(150); await shot('sparing-dzien');
    await ev(`[...document.querySelectorAll('#main button')].find(b => b.textContent.includes('Rozpocznij sparing')).click()`); await delay(150);
    for (let i = 0; i < 2; i++) { await ev(`[...document.querySelectorAll('#main button')].find(b => b.textContent.includes('Jedź bieg')).click()`); await delay(120); }
    await shot('sparing-na-zywo');
    check(await ev(`G.sparings['${liveId}'].match.heats.length === 2 && !!document.querySelector('#main .next-heat') && document.querySelector('#main').textContent.includes('po 2 z 15')`), 'sparing na żywo: biegi jeden po drugim z panelem decyzji trenera');
    await ev(`[...document.querySelectorAll('#main button')].find(b => b.textContent.includes('Do końca')).click()`); await delay(150); await shot('sparing-koniec');
    check(await ev(`G.sparings['${liveId}'].status === 'played' && document.querySelectorAll('#main .heat').length === 15 && document.querySelector('#main').textContent.includes('Koniec meczu')`), 'sparing na żywo: dokończony symulacją, 15 biegów, wynik zapisany');
    await ev(`delete G.sparings['${liveId}']; sparTrackOk = window._sto; render()`);
    // profil zawodnika – wszystkie zakładki i strzałki
    const rid = await ev('clubRiders(G.clubId).sort(by(r => r.skill, -1))[0].id');
    await ev(`location.hash = '#/druzyna'`); await delay(100);
    await ev(`document.querySelector('.card').click()`); await delay(120);
    for (const t of ['', '/kontrakt', '/statystyki', '/historia', '/terminarz', '/rozwoj', '/medyczne']) {
      await ev(`location.hash = '#/zawodnik/${rid}${t}'`); await delay(100);
      const txt = await ev('document.querySelector("#main").innerText');
      if (/undefined|NaN/.test(txt)) throw new Error(`Profil${t}: ${txt.match(/.{0,60}(undefined|NaN).{0,60}/)[0]}`);
      await shot('profil' + (t || '-przeglad').replace('/', '-'));
    }
    const before = await ev('location.hash');
    await ev('ACT.profileStep(1)'); await delay(100);
    check((await ev('location.hash')) !== before, 'strzałka → przechodzi do następnego profilu');
    // transfery – filtry
    await ev(`location.hash = '#/transfery'; UI.tf = { ...TF_DEFAULT, country: 'DEN', contract: 'free' }; render()`); await delay(100);
    check(await ev(`tfRows().every(r => r.country === 'DEN' && !r.clubId)`), 'filtr narodowość + bez kontraktu');
    await shot('transfery-filtr');
    // oferta dla wolnego zawodnika
    // zawodnik, na którego klub stać (budżet płac – js/budget.js): najtańszy według oczekiwań
    const fa = await ev(`(tfRows().slice().sort(by(r => riderAsk(r, G.clubId).signing))[0] || {}).id`);
    if (fa) {
      await ev(`location.hash = '#/oferta/${fa}'`); await delay(150);
      await ev(`ACT.dBonusAdd('playoff')`); await delay(60); await ev(`ACT.dBonus(0, 'amount', 50000)`); await ev(`ACT.dBonusAdd('avg')`); await ev(`ACT.dClauseAdd('buyout')`); await delay(100);
      const otxt = await ev('document.querySelector("#main").innerText');
      if (/undefined|NaN/.test(otxt)) throw new Error('Ekran oferty: ' + otxt.match(/.{0,60}(undefined|NaN).{0,60}/)[0]);
      await shot('oferta'); await ev('ACT.dSend()'); await delay(150);
      check(await ev(`!!userNeg(${fa})`), 'oferta dla wolnego zawodnika czeka na decyzję (negocjacje rozłożone w czasie)');
      await ev(`location.hash = '#/zawodnik/${fa}/kontrakt'`); await delay(120); await shot('oferta-negocjacje');
      await ev(`location.hash = '#/transfery/negocjacje'`); await delay(120); await shot('transfery-negocjacje-oferta');
    }
    // wypożyczenie: formularz dla juniora z innego klubu
    const lj = await ev(`(Object.values(G.riders).find(r => r.contract && r.contract.clubId !== G.clubId && isJunior(r) && loanStatus(r).ok) || {}).id`);
    if (lj) { await ev(`location.hash = '#/oferta/${lj}/wypozyczenie'`); await delay(150); await shot('wypozyczenie-formularz'); }
    const sid = await ev(`clubStaff(G.clubId)[0].id`); await ev(`location.hash = '#/osoba/${sid}'`); await delay(100); await shot('osoba');
    const kid = await ev(`(Object.values(G.academy).find(k => k.clubId === G.clubId) || {}).id`); if (kid) { await ev(`location.hash = '#/adept/${kid}'`); await delay(100); await shot('adept'); }
    check(!(await ev('typeof modal === "function"')), 'brak okien modalnych');
    // do pierwszego meczu
    let guard = 0, notifyChecked = false;
    const notifyIfDue = () => ev(`(() => { const f = pendingNotify(); if (!f) return false; UI.tacMode = 'liga'; ACT.autoLineup(); ACT.notifyLineup(); return !!notifiedLine(f, G.clubId); })()`);
    while (!(await ev('!!todayUserFixture()')) && guard++ < 160) {
      await ev('ACT.skipDays(7)'); await delay(60);
      if (!notifyChecked && await ev('!!pendingNotify()')) {
        // awizacja składu: zatrzymanie w terminie, blokada dalszego upływu czasu, limit zmian po awizacji
        const f = await ev('pendingNotify().id');
        check(await ev(`location.hash === '#/druzyna/taktyka' && G.date >= notifyDate(G.fixtures['${f}'])`), 'upływ czasu zatrzymany w terminie awizacji składu (3 dni przed meczem)');
        const d0 = await ev('G.date'); await ev('ACT.skipDays(7)'); await delay(60);
        check(await ev(`G.date === '${d0}'`), 'bez awizowanego składu czas nie płynie dalej');
        await shot('taktyka-awizacja');
        check(await notifyIfDue(), 'skład awizowany');
        check(await ev(`(() => { const f = G.fixtures['${f}'], base = notifiedLine(f, G.clubId), out = clubRiders(G.clubId).filter(r => !base.includes(r.id)).map(r => r.id);
          const swap = base.slice(); [swap[0], swap[1]] = [swap[1], swap[0]];
          const four = base.slice(); let n = 0; for (let i = 0; i < 5 && n < 4; i++) { const sub = out.find(id => !four.includes(id) && slotOk(G.riders[id], i)); if (sub) { four[i] = sub; n++; } }
          return numberSwap(base, swap) && (n < 4 || lineChanges(base, four) === 4) && !!tacLeagueGuard(swap) && (n < 4 || !!tacLeagueGuard(four)); })()`), 'po awizacji: zamiana numerów i więcej niż 3 zmiany zablokowane');
        notifyChecked = true;
      }
      await notifyIfDue();
    }
    if (fa) check(await ev(`(() => { const n = Object.values(G.negs).find(n => n.riderId === ${fa} && n.clubId === G.clubId); return n && n.status !== 'pending'; })()`), 'zawodnik odpowiedział na ofertę po kilku dniach');
    await ev(`location.hash = '#/transfery/negocjacje'`); await delay(120); await shot('transfery-negocjacje-sezon');
    // trening: wykres atrybutów (kilka serii) i trendy po kilku miesiącach gry
    const tr = await ev(`(() => { const rs = clubRiders(G.clubId).filter(r => G.attrhist[r.id]); const d = r => { const h = attrHistSeries(r); return h.length ? r.attrs.strength - h[0].v.strength : 0; }; return rs.sort(by(d, -1))[0].id; })()`);
    await ev(`location.hash = '#/zawodnik/${tr}/rozwoj'`); await delay(120); await ev(`ACT.attrSeriesTop(${tr})`); await delay(120);
    check(await ev(`document.querySelectorAll('.mchart path').length >= 3`), 'wykres atrybutów pokazuje kilka serii');
    await ev(`(() => { const s = document.querySelector('.mchart svg'), r = s.getBoundingClientRect(); s.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + r.width * 0.6, clientY: r.top + 40, bubbles: true })); })()`); await delay(80);
    await shot('profil-rozwoj-atrybuty');
    check(await ev(`Object.keys(G.attrhist).length > 100 && document.querySelectorAll('.trend').length >= 0`), 'historia atrybutów zapisywana co miesiąc');
    await ev(`location.hash = '#/zawodnik/${tr}'`); await delay(100); await shot('profil-trendy');
    // terminarz: zawodnik z ligą zagraniczną (sezon w toku) i dostępność drużyny z wybranym dniem
    const fr = await ev(`(clubRiders(G.clubId).find(r => r.fl && r.fl.list.length) || clubRiders(G.clubId)[0]).id`);
    await ev(`UI.rcal = '2026-05'; location.hash = '#/zawodnik/${fr}/terminarz'`); await delay(150); await shot('profil-terminarz');
    check(await ev(`document.querySelectorAll('.cal .day').length >= 28`), 'terminarz zawodnika – kalendarz miesiąca');
    await ev(`UI.acal = '2026-05'; UI.avDay = '2026-05-12'; location.hash = '#/sztab/kalendarz'`); await delay(150); await shot('druzyna-dostepnosc-maj');
    check(await ev(`document.querySelectorAll('.cal .day .avn').length >= 28`), 'dostępność drużyny – liczba dostępnych zawodników w każdym dniu');
    // planer treningu: własny plan, asystent układa miesiąc, jednostka w szczegółach dnia (js/planner.js)
    check(await ev(`['planMode', 'planAssist', 'winterDecide', 'signKid', 'persuadeStay', 'openDay', 'trialKeep', 'trialRelease'].every(k => typeof ACT[k] === 'function')`), 'akcje planera, adeptów i naboru zarejestrowane w ACT');
    await ev(`ACT.planMode('manual'); ACT.planAssist('2026-05')`); await delay(150);
    await ev(`UI.avDay = planAll().filter(s => s.status === 'plan' && s.date.startsWith('2026-05')).map(s => s.date).sort()[0] || null; render()`); await delay(150); await shot('trening-plan-maj');
    check(await ev(`document.querySelectorAll('.cal .ev.k-tren').length > 5 && !!document.querySelector('#main select') && /Dodaj jednostkę/.test(document.querySelector('#main').textContent)`), 'planer treningu: jednostki w kalendarzu i edycja dnia');
    await ev(`ACT.planClear('2026-05'); ACT.planMode('auto')`); await delay(100);
    await ev(`location.hash = '#/transfery'; UI.tf = { ...TF_DEFAULT, contract: 'loan' }; render()`); await delay(120); await shot('transfery-wypozyczenia');
    // transfery sztabu: przełącznik Zawodnicy / Sztab, wyszukiwarka głównych trenerów
    await ev(`ACT.tfMode('staff')`); await delay(120); await shot('transfery-sztab');
    check(await ev(`document.querySelectorAll('.t tbody tr.click').length > 0 && [...document.querySelectorAll('.t tbody tr.click')].length <= 50`), 'transfery sztabu – lista głównych trenerów');
    await ev(`UI.sf = { ...SF_DEFAULT, contract: 'free' }; ACT.sfSort('age')`); await delay(80); await ev(`ACT.tfMode('riders')`); await delay(80);
    check(await ev(`!document.querySelector('#main').textContent.includes('Rynek personelu')`), 'brak zakładki rynek personelu');
    // zdjęcie trenera z img/staff (bez importu danych)
    const mc = await ev(`(Object.values(G.staff).find(s => s.name === 'Marek Cieślak') || {}).id`);
    if (mc) { await ev(`location.hash = '#/osoba/${mc}'`); await delay(600); await shot('osoba-zdjecie');
      check(await ev(`(() => { const i = document.querySelector('#main .avatar.photo img'); return !!(i && i.complete && i.naturalWidth > 0 && i.src.includes('img/staff/')); })()`), 'zdjęcie trenera z img/staff'); }
    // profil trenera: układ jak u zawodnika, historia trener / zawodnik
    if (mc) { await ev(`UI.shist = 'coach'; location.hash = '#/osoba/${mc}/historia'`); await delay(250); await shot('osoba-historia-trener');
      check(await ev(`document.querySelectorAll('#main table.t tbody tr').length > 10 && !!document.querySelector('.profile-head')`), 'historia trenerska (kluby, miejsca, bilans)');
      await ev(`ACT.staffHistMode('rider')`); await delay(200); await shot('osoba-historia-zawodnik');
      check(await ev(`document.querySelectorAll('#main table.t tbody tr').length > 3`), 'historia zawodnicza trenera z PSD');
      const kk = await ev(`(Object.values(G.staff).find(s => s.name === 'Robert Kościecha') || {}).id`);
      if (kk) { await ev(`location.hash = '#/osoba/${kk}'`); await delay(200); await shot('osoba-licencja');
        check(await ev(`document.querySelector('#main').textContent.includes('T/7/2019')`), 'licencja trenera w profilu (T/7/2019)'); }
      await ev(`UI.shist = 'coach'; location.hash = '#/osoba/${mc}'`); await delay(200); await shot('osoba-przeglad'); }
    // umowa sztabu: przedłużenie w ostatnim roku umowy (js/staff-contracts.js)
    const sc = await ev(`(() => { const s = clubStaff(G.clubId).find(x => !x.player); if (!s) return null; s.until = G.season; return s.id; })()`);
    if (sc) { await ev(`location.hash = '#/osoba/${sc}/kontrakt'`); await delay(200);
      check(await ev(`/Negocjuj przedłużenie|Rozmowy o umowie/.test(document.querySelector('#main').textContent)`), 'umowa sztabu: panel przedłużenia w profilu');
      await ev(`location.hash = '#/oferta-sztab/${sc}'`); await delay(200); await ev(`ACT.sdBonusAdd('stay')`); await delay(100); await shot('oferta-sztab');
      check(await ev(`document.querySelectorAll('#main .offer-t input[type=checkbox]').length >= 4 && /Premie za sukcesy/.test(document.querySelector('#main').textContent) && /Oczekiwania/.test(document.querySelector('#main').textContent)`), 'umowa sztabu: ekran oferty (role, pensja, premie)');
      await ev(`ACT.sdAsk(); ACT.sdSend()`); await delay(150);
      check(await ev(`!!staffNeg('${sc}') || staffNegLast('${sc}').status === 'agreed'`), 'umowa sztabu: oferta złożona'); }
    // skauting: zakładka w Transferach, zlecenie, raport (js/ui-scouting.js)
    await ev(`UI.scf = null; location.hash = '#/transfery/skauting/zlecenia'`); await delay(200);
    await ev(`(() => { const f = scForm(); f.type = 'search'; f.weeks = 1; f.crit.role = 'jun'; render(); ACT.scGo(); })()`); await delay(200); await shot('skauting-zlecenia');
    check(await ev(`/Nowe zlecenie/.test(document.querySelector('#main').textContent) && scAll().some(t => t.status === 'active')`), 'skauting: zlecenie przyjęte');
    await ev(`(() => { const t = scAll().find(t => t.status === 'active'); t.end = G.date; scoutDay(G.date); location.hash = '#/transfery/skauting/polecani'; })()`); await delay(200); await shot('skauting-polecani');
    check(await ev(`scAll().some(t => t.status === 'done') && (document.querySelectorAll('#main table.t tbody tr.click').length > 0 || /Brak polecanych/.test(document.querySelector('#main').textContent))`), 'skauting: polecani po zleceniu');
    await ev(`UI.scMapCc = 'AUS'; location.hash = '#/transfery/skauting/kraje'`); await delay(250); await shot('skauting-mapa');
    check(await ev(`document.querySelectorAll('#main svg.sc-map path.sc-c').length >= 15 && /Australia/.test(document.querySelector('#main').textContent) && /Źródła/.test(document.querySelector('#main').textContent)`), 'skauting: mapa znajomości krajów');
    check(await ev(`(() => { const r = Object.values(G.riders).find(r => r.active && !r.clubId && !scKnown(r)); if (!r) return true; location.hash = '#/zawodnik/' + r.id; render(); return /nieznany/.test(document.querySelector('#main').textContent); })()`), 'skauting: nieznany zawodnik bez gwiazdek');
    const rpId = await ev(`(Object.keys(G.scouting.reports)[0] || '')`);
    if (rpId) { await ev(`location.hash = '#/raport/${rpId}'`); await delay(200); await shot('skauting-raport');
      check(await ev(`/Punkty w sezonie/.test(document.querySelector('#main').textContent) && /Koszt sezonu/.test(document.querySelector('#main').textContent)`), 'skauting: raport z prognozą punktów i kosztem'); }
    // osoba z dwiema funkcjami: przełącznik Zawodnik / Trener na Przeglądzie (Nicki Pedersen)
    const np = await ev(`(Object.values(G.riders).find(r => r.name === 'Nicki Pedersen') || {}).id`);
    if (np) { await ev(`location.hash = '#/zawodnik/${np}'`); await delay(200); await shot('profil-dwie-funkcje');
      check(await ev(`[...document.querySelectorAll('#main .seg .btn')].map(b => b.textContent).join('|') === 'Zawodnik|Trener'`), 'przełącznik zawodnik / trener (Nicki Pedersen)');
      await ev(`[...document.querySelectorAll('#main .seg .btn')][1].click()`); await delay(200);
      check(await ev(`location.hash.startsWith('#/osoba/') && [...document.querySelectorAll('#main .seg .btn')].length === 2`), 'przełączenie na profil trenera (z przełącznikiem z powrotem)'); }
    await ev(`location.hash = '#/liga'`); await delay(60);
    const fid = await ev('todayUserFixture().id');
    check(!!fid, `dzień meczowy ${await ev('G.date')}`);
    await ev(`location.hash = '#/zawody/${fid}'`); await delay(150);
    await shot('zawody-zapowiedz');
    await ev(`(() => { const f = G.fixtures['${fid}']; if (matchDayIssue(f)) G.lineups[G.clubId] = finalLineup(G.clubId, f); })()`);
    await ev(`ACT.startMatch('${fid}')`); await delay(150);
    for (let i = 0; i < 5; i++) { await ev('ACT.nextHeat()'); await delay(80); }
    await shot('zawody-bieg5');
    // sprzęt: wybór silnika na bieg (js/ui-equipment.js) – wskazany silnik jedzie w następnym biegu
    const pickRes = await ev(`(() => { const m = G.matches[G.fixtures['${fid}'].matchId], sel = document.querySelector('#main select[onchange^="ACT.engPick"]'); if (!sel || sel.options.length < 2) return 'brak listy';
      const rid = Number(sel.getAttribute('onchange').split(',')[1]); sel.value = sel.options[sel.options.length - 1].value; sel.dispatchEvent(new Event('change'));
      const want = Number(sel.value); ACT.nextHeat(); const h = m.heats[m.heats.length - 1], e = h.entries.find(x => x.riderId === rid);
      return !e ? 'zawodnik nie pojechał' : e.eng && e.eng.id === want ? 'ok' : 'inny silnik ' + JSON.stringify(e.eng) + ' ' + want; })()`);
    check(pickRes === 'ok' || pickRes === 'zawodnik nie pojechał', `wybór silnika na bieg (${pickRes})`);
    for (let i = 0; i < 7; i++) { await ev('ACT.nextHeat()'); await delay(60); } // 5 + 1 (wybór silnika) + 7 = 13 biegów
    await shot('zawody-nominacje');
    await ev('ACT.nextHeat()'); await delay(60); await ev('ACT.nextHeat()'); await delay(100);
    check(await ev(`G.fixtures['${fid}'].played`), 'mecz rozegrany (15 biegów)');
    await shot('zawody-koniec');
    await ev(`location.hash = '#/zawody/${fid}/protokol'`); await delay(100); await shot('zawody-protokol');
    await ev(`location.hash = '#/zawody/${fid}/program'`); await delay(100); await shot('zawody-program');
    check(await ev(`[...document.querySelectorAll('#nav a')].some(a => a.getAttribute('href') === '#/park' && a.textContent.includes('Park maszyn'))`), 'menu: sekcja Park maszyn');
    await ev(`location.hash = '#/klub'`); await delay(80);
    check(await ev(`![...document.querySelectorAll('#main .tabs a')].some(a => /Park maszyn|Tunerzy|Rynek silników/.test(a.textContent))`), 'Klub bez zakładek sprzętu (przeniesione do Park maszyn)');
    await ev(`location.hash = '#/druzyna'`); await delay(80);
    check(await ev(`![...document.querySelectorAll('#main .tabs a')].some(a => a.textContent.trim() === 'Sprzęt')`), 'Drużyna bez zakładki Sprzęt');
    await ev(`location.hash = '#/klub/tunerzy'`); await delay(150);
    check(await ev(`location.hash === '#/park/tunerzy'`), 'stary link #/klub/tunerzy przekierowuje do Park maszyn');
    await ev(`location.hash = '#/park/szkolka'`); await delay(120); await shot('park-szkolka');
    const nb = await ev('myClub().park.bikes.length'); await ev(`ACT.bikeBuy('c85')`); await delay(60);
    check(await ev(`myClub().park.bikes.length === ${nb} + 1 && document.querySelector('#main').textContent.includes('Sprzęt szkółki według klas')`), 'szkółka: motocykle według klas, zakup nowego');
    await ev(`location.hash = '#/park/rynek/szkolka'`); await delay(120); await shot('park-rynek-szkolka');
    const ub = await ev('G.usedBikes.find(L => L.seller !== "c" + G.clubId).b.sn'); await ev(`ACT.bikeUsed('${ub}')`); await delay(60);
    check(await ev(`myClub().park.bikes.some(b => b.sn === '${ub}')`), 'rynek używanych motocykli szkółkowych: zakup');
    await ev(`location.hash = '#/park/tunerzy'`); await delay(100); await shot('park-tunerzy');
    check(await ev(`document.querySelector('#main').textContent.includes('Ryszard Kowalski') && document.querySelector('#main').textContent.includes('Ash-Tech')`), 'tunerzy: prawdziwe warsztaty z klientami');
    await ev(`location.hash = '#/park/warsztat'`); await delay(100); await shot('park-warsztat');
    check(await ev(`document.querySelector('#main').textContent.includes('Jakość obsługi')`), 'park maszyn: mechanicy klubowi i jakość obsługi');
    // rejestr silników: karta silnika (numer seryjny, przebieg, remonty) i rynek wtórny
    const snOwn = await ev(`clubRiders(G.clubId).flatMap(r => r.equip.engines).find(x => x.sn).sn`);
    await ev(`location.hash = '#/silnik/' + encodeURIComponent('${snOwn}')`); await delay(120); await shot('silnik-karta');
    check(await ev(`(() => { const t = document.querySelector('#main').textContent; return t.includes('${snOwn}') && t.includes('Przebieg') && t.includes('Zbudowany w warsztacie') && t.includes('Remonty'); })()`), `karta silnika ${snOwn}: przebieg, historia, remonty`);
    await ev(`(() => { const r = clubRiders(G.clubId)[0], x = r.equip.engines[r.equip.engines.length - 1]; listEngine(Object.assign(JSON.parse(JSON.stringify(x)), { sn: 'TEST-0000-001' }), G.riders[Object.values(G.riders).find(o => o.clubId && o.clubId !== G.clubId).id]); })()`);
    await ev(`location.hash = '#/park/rynek'`); await delay(120); await shot('park-rynek-silnikow');
    check(await ev(`document.querySelector('#main').textContent.includes('Rynek wtórny silników') && document.querySelector('#main').textContent.includes('TEST-0000-001')`), 'rynek wtórny silników: lista z numerami i szacunkiem mocy');
    const cash0 = await ev('myClub().cash'); await ev(`ACT.buyUsed('TEST-0000-001', 'park')`); await delay(80);
    check(await ev(`myClub().park.clubEngines.some(x => x.sn === 'TEST-0000-001') && myClub().cash < ${cash0} && findEngine('TEST-0000-001').x.hist.some(h => h[1] === 'P')`), 'zakup używanego silnika do parku maszyn (zapis w historii, płatność)');
    const own = await ev('clubRiders(G.clubId).sort((a, b) => b.skill - a.skill)[0].id'), foreign = await ev('Object.values(G.riders).find(r => r.active && r.clubId && r.clubId !== G.clubId && r.equip.engines.length).id');
    await ev(`location.hash = '#/park/zawodnik/${own}'`); await delay(120); await shot('park-zawodnik');
    check(await ev(`document.querySelector('#main').textContent.includes('Moc (ocena mechaników)') && !!document.querySelector('#main select')`), 'sprzęt własnego zawodnika: moc, stan, zamówienie u tunera');
    await ev(`location.hash = '#/park/zawodnik/${foreign}'`); await delay(120); await shot('park-zawodnik-obcy');
    check(await ev(`(() => { const t = document.querySelector('#main').textContent; return t.includes('Główny tuner') && !t.includes('Moc (ocena') && !/budżet/i.test(t.replace('Ile zawodnik wydaje na sprzęt', '')); })()`), 'sprzęt zawodnika innego klubu: tylko silniki i tunerzy, bez mocy i budżetu');
    for (let i = 0; i < 24; i++) { await notifyIfDue(); const t = await ev('todayUserFixture()'); if (t) await ev(`(() => { const f = G.fixtures['${t.id}']; if (matchDayIssue(f)) G.lineups[G.clubId] = finalLineup(G.clubId, f); ACT.quickMatch(f.id); })()`); await ev('ACT.skipDays(7)'); await delay(60); }
    await ev(`location.hash = '#/kalendarz'`); await delay(100); await shot('kalendarz-sezon');
    const spId = await ev(`(sparOf(G.clubId, G.season).find(s => s.status === 'played' && s.match) || {}).id || null`);
    if (spId) { await ev(`location.hash = '#/kalendarz/sparing/${spId}'`); await delay(150); await shot('sparing-przebieg'); check(await ev(`document.querySelectorAll('#main .heat').length === 15`), 'sparing gracza: 15 biegów z przebiegiem'); await ev(`location.hash = '#/kalendarz/sparing/${spId}/protokol'`); await delay(120); await shot('sparing-protokol'); }
    else check(await ev(`sparOf(G.clubId, G.season).some(s => ['cancelled', 'rejected'].includes(s.status))`), 'sparingi gracza odwołane lub odrzucone (brak rozegranego)');
    // zawody: przegląd, strony rozgrywek i wszystkie formaty
    await ev(`location.hash = '#/rozgrywki'`); await delay(150); await shot('rozgrywki');
    const played = await ev(`(() => { const e = Object.values(G.events).filter(x => x.played && !x.cancelled); const f = fmt => (e.find(x => (x.kind === 'sgp' ? 'ind' : compOf(x).format) === fmt) || {}).id; return { ind: f('ind'), pairs: f('pairs'), team: f('team'), exam: f('exam') }; })()`);
    for (const [fmt, id] of Object.entries(played)) {
      if (!id) continue;
      for (const sub of ['', '/biegi', '/cykl']) {
        await ev(`location.hash = '#/gp/${id}${sub}'`); await delay(100);
        const txt = await ev('document.querySelector("#main").innerText');
        if (/undefined|NaN|Błąd/.test(txt)) throw new Error(`Zawody ${fmt} ${id}${sub}: ${txt.match(/.{0,60}(undefined|NaN|Błąd).{0,60}/)[0]}`);
      }
      await ev(`location.hash = '#/gp/${id}'`); await delay(100); await shot('zawody-' + fmt);
      const key = await ev(`evKey(G.events['${id}'])`);
      for (const sub of ['', '/klasyfikacja', '/historia']) { await ev(`location.hash = '#/rozgrywki/' + encodeURIComponent(${JSON.stringify(key)}) + '${sub}'`); await delay(100); const t = await ev('document.querySelector("#main").innerText'); if (/undefined|NaN|Błąd/.test(t)) throw new Error(`Rozgrywki ${key}${sub}`); }
    }
    const upcoming = await ev(`(Object.values(G.events).filter(x => x.kind === 'comp' && !x.played && x.startList).sort(by(x => x.date))[0] || {}).id`);
    if (upcoming) { await ev(`location.hash = '#/gp/${upcoming}'`); await delay(120); await shot('zawody-lista-startowa'); }
    check(Object.values(played).filter(Boolean).length >= 3, 'zawody indywidualne, parowe/drużynowe i egzaminy rozegrane i wyświetlone');
    // statystyki zawodnika: Polska – tylko liga polska, Zawody – pozostałe rozgrywki (indywidualne, parowe, międzynarodowe); pełna lista sezonu
    const sr = await ev(`(() => { const rs = Object.values(G.riders).map(r => { const l = riderStarts(r); return { r, pl: l.filter(statFilter('PL')).length, zaw: l.filter(statFilter('ZAW')).length }; });
      const x = rs.find(x => x.pl > 5 && x.zaw > 0) || rs.sort(by(x => x.pl + x.zaw, -1))[0]; return { id: x.r.id, pl: x.pl, zaw: x.zaw }; })()`);
    const rowsN = () => ev(`document.querySelectorAll('#main table.proto tbody tr.click').length`);
    await ev(`UI.statLg = 'PL'; location.hash = '#/zawodnik/${sr.id}/statystyki'`); await delay(150);
    check(await rowsN() === Math.min(5, sr.pl) && (sr.pl <= 5 || await ev(`document.querySelector('#main').innerText.includes('Wszystkie (${sr.pl})')`)) && await ev(`[...document.querySelectorAll('#main table.proto tbody tr.click')].every(tr => tr.getAttribute('onclick').includes('#/zawody/'))`),
      `statystyki – Polska: tylko liga polska, 5 ostatnich meczów i przycisk Wszystkie (${sr.pl} meczów)`); await shot('profil-ostatnie-starty');
    await ev(`location.hash = '#/zawodnik/${sr.id}/starty'`); await delay(120);
    check(await rowsN() === sr.pl && await ev(`document.querySelector('.tabs a.on').textContent === 'Statystyki'`), 'wszystkie mecze ligi polskiej w sezonie'); await shot('profil-starty-sezon');
    await ev(`UI.statLg = 'ZAW'; location.hash = '#/zawodnik/${sr.id}/statystyki'`); await delay(150);
    check(await rowsN() === Math.min(5, sr.zaw) && await ev(`[...document.querySelectorAll('.seg button')].some(b => b.textContent === 'Zawody' && b.classList.contains('primary')) && (${sr.zaw} === 0 || [...document.querySelectorAll('#main table.proto tbody tr.click')].every(tr => !tr.getAttribute('onclick').includes('#/zawody/')))`),
      `statystyki – Zawody: pozostałe rozgrywki (${sr.zaw} startów)`); await shot('profil-zawody');
    await ev(`UI.statLg = 'PL'`);
    // licencja od 15 lat: do 16. urodzin tylko zawody U-21 (bez ligi i zawodów seniorskich)
    check(await ev(`(() => { const r = clubRiders(G.clubId).find(x => isJunior(x)) || clubRiders(G.clubId)[0], b = r.born; r.born = addDays(G.date, -15 * 365 - 40);
      const ev = c => ({ kind: 'comp', comp: c, date: G.date, season: G.season, id: 'T' + c });
      const res = !slotOk(r, 5, myClub().league) && !autoLineup(G.clubId).includes(r.id) && !validLineup(G.clubId, [r.id, null, null, null, null, null, null, null]).includes(r.id)
        && u21Comp(ev('MIMP')) && u21Comp(ev('DMPJ')) && u21Comp(ev('SK')) && !u21Comp(ev('IMP')) && !u21Comp(ev('U24E')) && !u21Comp(ev('ZK')) && ageOkFor(ev('MIMP'), r.id) && !ageOkFor(ev('IMP'), r.id)
        && leagueFrom(r) > G.date && u16(r);
      r.born = b; return res; })()`), 'licencja przed 16. urodzinami: bez ligi i zawodów seniorskich, zawody U-21 dozwolone');
    check(await ev(`(() => { const k = Object.values(G.academy).find(x => x.clubId === G.clubId) ; if (!k) return true; const s = { cat: k.cat, born: k.born, t: k.examTried, cash: myClub().cash }; k.cat = 'c500'; k.born = addDays(G.date, -15 * 365 - 40); k.examTried = null; const r = licenceExam(k.id); const ok = !/skończył 15/.test(r.text); if (G.academy[k.id]) Object.assign(k, { cat: s.cat, born: s.born, examTried: s.t }); return ok; })()`), 'egzamin licencyjny dostępny dla 15-latka');
    await ev(`location.hash = '#/liga'`); await delay(100); await shot('liga-tabela-sezon');
    await ev(`location.hash = '#/finanse'`); await delay(100); await shot('finanse-sezon');
    for (const sub of ['przeplywy', 'budzet', 'podsumowanie', 'sponsorzy', 'sponsorzy/cennik', 'sponsorzy/partnerzy', 'sponsorzy/negocjacje', 'sponsorzy/rynek', 'liga', 'finansowanie']) { await ev(`location.hash = '#/finanse/${sub}'`); await delay(120); const t = await ev('document.querySelector("#main").innerText'); if (/undefined|NaN|Błąd/.test(t)) throw new Error(`Finanse/${sub}: ${t.match(/.{0,60}(undefined|NaN|Błąd).{0,60}/)[0]}`); await shot('finanse-sezon-' + sub.replace('/', '-')); }
    // negocjacje ze sponsorem: szukanie → spotkanie → oferta → odpowiedź po kilku dniach
    const days = n => `(() => { for (let i = 0; i < ${n}; i++) { const r = advance(1); if (r.stop === 'match') { const f = r.fixture; const m = G.matches[f.matchId] || createMatch(f); simulateMatch(m); afterFixture(f); } } return G.date; })()`;
    await ev('ACT.findSponsors()');
    await ev(days(11));
    const lead = await ev(`(Object.values(G.spTalks).find(t => t.clubId === G.clubId && t.stage === 'lead') || {}).id`);
    check(!!lead, 'dział marketingu znalazł zainteresowane firmy');
    await ev(`ACT.spMeet('${lead}')`); await ev(days(8));
    check(await ev(`G.spTalks['${lead}'].stage`) === 'talk', 'po spotkaniu firma podała widełki budżetu');
    await ev(`location.hash = '#/finanse/sponsorzy'`); await delay(100);
    await ev(`ACT.spOffer('${lead}')`); await delay(200);
    await ev(`(() => { const free = AD_SLOTS.filter(a => slotFree(myClub(), sportSeason(), a.id) > 0 && a.group !== 'druzyna').sort(by(a => a.price))[0]; ACT.spSlot(free.id, 1); UI.spo.o.price = Math.round(G.spTalks['${lead}'].hint[0] * 0.8 / 1000) * 1000; UI.spo.auto = false; drawSpOffer(); })()`);
    await delay(100); await shot('finanse-oferta-sponsor');
    await ev('ACT.spSend()');
    check(await ev(`G.spTalks['${lead}'].stage`) === 'pending', 'oferta sponsorska czeka na odpowiedź firmy');
    await ev(days(6));
    const st = await ev(`G.spTalks['${lead}'].stage`);
    check(['signed', 'counter', 'closed'].includes(st), `firma odpowiedziała na ofertę (${st})`);
    await ev(`location.hash = '#/finanse/sponsorzy'`); await delay(100); await shot('finanse-sponsorzy-negocjacje');
    // wniosek o kredyt
    await ev(`location.hash = '#/finanse/finansowanie'`); await delay(100);
    await ev(`$('#fr-loan').value = 300000; ACT.finReq('loan')`); await ev(days(11));
    check(['offer', 'rejected'].includes(await ev(`Object.values(G.finTalks).find(x => x.kind === 'loan').status`)), 'bank rozpatrzył wniosek kredytowy');
    await ev(`location.hash = '#/finanse/finansowanie'`); await delay(100); await shot('finanse-finansowanie-kredyt');
    await ev(`location.hash = '#/transfery'; UI.tf = { ...TF_DEFAULT, contract: 'interest' }; render()`); await delay(150); await shot('transfery-zainteresowanie');
    await ev(`location.hash = '#/transfery/negocjacje'`); await delay(120); await shot('transfery-negocjacje-czerwiec');
    const exp = await ev(`(clubRiders(G.clubId).find(r => r.contract && r.contract.until === G.season) || {}).id`);
    if (exp) { await ev(`location.hash = '#/zawodnik/${exp}/kontrakt'`); await delay(120); await shot('profil-kontrakt-prekontrakt'); }
    await ev(`location.hash = '#/skrzynka'`); await delay(100); await shot('skrzynka-sezon');
    const gp = await ev(`Object.values(G.events).find(e => e.played)`);
    if (gp) { await ev(`location.hash = '#/gp/${gp.id}'`); await delay(100); await shot('gp'); }
    // zapis i ponowne wczytanie z bazy
    await ev('dbSaveNow()');
    const snap = await ev(`JSON.stringify({ d: G.date, c: Math.round(myClub().cash), f: Object.values(G.fixtures).filter(f => f.played).length, r: Object.keys(G.riders).length, m: Object.keys(G.messages).length })`);
    await ev('ACT.mainMenu()'); await delay(200);
    await ev(`ACT.loadGame('${gameId}')`);
    for (let i = 0; i < 200; i++) { if (await ev('!!(G && G.gameId)')) break; await delay(150); }
    const snap2 = await ev(`JSON.stringify({ d: G.date, c: Math.round(myClub().cash), f: Object.values(G.fixtures).filter(f => f.played).length, r: Object.keys(G.riders).length, m: Object.keys(G.messages).length })`);
    // obywatelstwa: kraj macierzysty pierwszy (zawieszenie FIM), polski paszport = zawodnik krajowy w lidze
    check(await ev(`['Artem Łaguta', 'Emil Sayfutdinov', 'Vadim Tarasenko', 'Gleb Chugunov'].every(n => { const r = Object.values(G.riders).find(x => x.name === n); return r && r.country === 'RUS' && r.nationalities.join() === 'RUS,POL' && fimBanned(r) && !polEligible(r) && (!r.clubId || isDomestic(r)); })`), 'Rosjanie z polskim obywatelstwem: kraj macierzysty Rosja, w lidze zawodnicy krajowi');
    check(await ev(`(() => { const k = Object.values(G.academy).find(x => x.name === 'Greg Łaguta') || Object.values(G.riders).find(x => x.name === 'Greg Łaguta'); return !k || (k.country === 'LAT' && nats(k).join() === 'LAT,RUS' && !fimBanned(k)); })()`), 'Greg Łaguta: Łotwa, drugie obywatelstwo Rosja');
    check(await ev(`(() => { const evs = Object.values(G.events).filter(e => e.played && isFimEvent(e) && e.matchId && G.matches[e.matchId]); const bad = evs.flatMap(e => Object.keys(G.matches[e.matchId].riders || {})).filter(id => fimBanned(G.riders[id] || G.academy[id])); return evs.length > 0 && bad.length === 0; })()`), 'w rozegranych zawodach FIM nie startują zawodnicy zawieszonych federacji');
    check(await ev(`!squadOf('RUS').sen.length && !nationalSquads()['POL'].sen.some(id => fimBanned(G.riders[id]))`), 'brak kadry Rosji; zawieszeni nie są w kadrze Polski');
    check(await ev(`(() => { const ru = Object.values(G.riders).filter(r => r.country === 'RUS'); const solo = ru.filter(r => !hasNat(r, 'POL')), dual = ru.filter(r => hasNat(r, 'POL'));
      return solo.length > 0 && solo.every(r => { const a = { ...r, active: true, retired: false, retireIntent: null }; return plBanned(a) && !available(a, G.date) && !marketStatus(a).ok && /polskiego obywatelstwa/.test(marketStatus(a).text); }) && dual.every(r => !plBanned(r)); })()`), 'Rosjanie bez polskiego obywatelstwa: bez startów i kontraktów w Polsce; z polskim – jeżdżą');
    check(await ev(`(() => { const keep = G.fimLift, r = Object.values(G.riders).find(x => x.country === 'RUS' && !hasNat(x, 'POL')); G.fimLift = { from: '2028-01-01', decided: {} }; const ok = plBanned(r, '2027-12-31') && !plBanned(r, '2028-01-01'); G.fimLift = keep; return ok; })()`), 'po zniesieniu zawieszenia Rosjanie mogą znowu jeździć w Polsce');
    check(await ev(`(() => { const ru = Object.values(G.riders).filter(r => (r.activity || []).some(a => /Rosja – Drużynowe/.test(a)));
      const names = ['Egor Shchurin', 'Vitaliy Kotlyar', 'Grigorij Łaguta', 'Roman Lachbaum']; const byName = n => ru.find(r => r.name === n);
      return ru.length >= 30 && names.every(byName) && ru.filter(r => r.active && !r.retired).length >= 28 && ru.every(r => r.ca > 20 && r.country === 'RUS' && !r.clubId) && byName('Grigorij Łaguta').ca > 50; })()`), 'liga rosyjska: zawodnicy dopisani i aktywni, CA z kalibracji, bez polskich klubów');
    check(await ev(`(() => { const ru = Object.values(G.riders).filter(r => (r.activity || []).some(a => /Rosja – Drużynowe/.test(a)));
      const fl = ru.filter(r => r.fl && r.fl.list.some(x => x.id === 'RUS')), starts = ru.flatMap(r => (r.fx ? r.fx.list : []).filter(e => e.lg === 'RUS' && e.d <= G.date));
      return fl.length >= 30 && starts.length > 50; })()`), 'liga rosyjska: przydział ligi i starty w sezonie');
    check(await ev(`[2026, 2027, 2030].map(fimLiftChance).map(x => Math.round(x * 100)).join() === '10,20,50'`), 'FIM: szansa przywrócenia 10% w 2026, rośnie co roku');
    check(await ev(`(() => { const d = G.date, keep = G.fimLift, m0 = G.seq.msg; const res = [];
      G.date = '2026-12-01'; G.fimLift = null; fimDay(false); res.push(G.fimLift.decided[2026] === false && !G.fimLift.from && fimSuspended('RUS', '2027-05-01'));
      G.date = '2027-12-01'; fimDay(true); res.push(G.fimLift.from === '2028-01-01' && fimSuspended('RUS', '2027-12-31') && !fimSuspended('RUS', '2028-01-01') && /Koniec wojny/.test(G.messages['M' + (G.seq.msg - 1)].title));
      for (let i = m0; i < G.seq.msg; i++) delete G.messages['M' + i]; G.fimLift = keep; G.date = d; return res.every(Boolean); })()`), 'FIM: decyzja 1 grudnia – utrzymanie albo przywrócenie od 1 stycznia z komunikatem');
    check(snap === snap2, `wczytany stan zgodny z zapisanym ${snap}`);
    check(await ev(`G.manager.children.filter(c => c.kidId || c.riderId).every(c => G.academy[c.kidId] || G.riders[c.riderId]) && !G.manager.photo`), 'dzieci menedżera zostają po wczytaniu gry (bez zapisanych zdjęć)');
    check(errors.length === 0, 'brak błędów JS w konsoli' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    console.log('Test przeglądarkowy zakończony. Zrzuty: tools/screenshots/');
  } finally {
    try { await call('Browser.close'); } catch (e) { /* */ }
    chrome.kill();
    server.close();
    wipeTestGame(); // zapis gry z testu – skasowany, żeby nie mnożyły się zapisy
  }
})().catch(e => { console.error(e.message || e); if (errors.length) console.error('Błędy konsoli:', errors.slice(0, 5)); process.exitCode = 1; });
