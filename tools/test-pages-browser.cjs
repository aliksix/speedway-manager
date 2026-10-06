const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
// Test zapisu gry bez serwera (GitHub Pages): statyczne pliki, zapis w IndexedDB – zgodność stanu i tabel, lista gier, kasowanie
const ROOT = path.join(__dirname, '..'), PORT = 8851, CDP = 9281;
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname); const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(PORT);
const CH = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(f => fs.existsSync(f));
const prof = path.join(__dirname, '.browser-pages');
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${CDP}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0; const pend = new Map(); const errs = [];
const call = (method, params = {}) => new Promise((ok, no) => { const id = ++seq; pend.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => { const r = await call('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description)); return r.result.value; };
(async () => {
  let t; for (let i = 0; i < 60 && !t; i++) { try { t = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch (e) { await delay(250); } }
  ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.no(m.error) : p.ok(m.result); } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception.description.slice(0, 200)); });
  await call('Runtime.enable'); ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.consoleAPICalled' && m.params.args[0] && /^[a-d]$/.test(m.params.args[0].value)) console.log('  krok', m.params.args[0].value, new Date().toISOString().slice(11, 19)); }); await call('Page.enable');
  await call('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }); for (let i = 0; i < 120; i++) { await delay(500); try { if (await ev(`typeof DB !== 'undefined' && DB.on`)) break; } catch (e) {} }
  console.log('DB:', await ev(`JSON.stringify({ on: DB.on, local: DB.local })`));
  console.log(await ev(`(async () => { console.log('a'); for (const g of await dbList()) await dbDelete(g.id); console.log('b'); newGame({ clubId: 9, manager: 'Pages Test' }); await dbCreate(); console.log('c'); advance(1); await dbSaveNow(); console.log('d');
    const want = {}; for (const t of Object.keys(COLLECTIONS)) want[t] = JSON.stringify(Object.values(G[t] || {}).sort((a, b) => String(a.id).localeCompare(String(b.id))));
    const st = JSON.stringify(stateOnly());
    const raw = await localApi('api/games/' + G.gameId, 'GET');
    const bad = Object.keys(COLLECTIONS).filter(t => JSON.stringify((raw.tables[t] || []).sort((a, b) => String(a.id).localeCompare(String(b.id)))) !== want[t]);
    return 'tabele niezgodne: ' + (bad.join(',') || 'brak') + '; stan zgodny: ' + (JSON.stringify(raw.state) === st); })()`));
  console.log('menu:', await ev(`(async () => { START.saves = null; await renderStart(); await new Promise(r => setTimeout(r, 300)); const t = document.body.innerText; return [t.includes('Pages Test'), t.includes('pamięci tej przeglądarki')].join(); })()`));
  console.log('kasowanie:', await ev(`(async () => { await dbDelete(G.gameId); return (await dbList()).length; })()`));
  console.log('błędy:', errs.length ? errs.slice(0, 3) : 'brak');
})().catch(e => console.error('BŁĄD', e.message || e)).finally(() => { chrome.kill(); srv.close(); setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {} }, 3000); });
