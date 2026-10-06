#!/usr/bin/env node
// Lokalny serwer gry Żużlowy Menedżer: pliki gry + baza zapisów (SQLite, bez zewnętrznych pakietów).
// Uruchomienie: node tools/server.js  (albo start.bat) → http://127.0.0.1:8770 (lub kolejny wolny port)
//
// Każda rozgrywka to osobny plik saves/<id>.sqlite z pełną bazą danych gry:
//   meta, state (stan ogólny), snapshots (kopie zapasowe stanu) oraz tabele encji
//   riders, clubs, staff, academy, fixtures, matches, messages, injuries, transactions, sponsors, events.
// Tabele encji mają kolumny do wyszukiwania (indeksy) i kolumnę json z pełnym rekordem.
// Zapis jest przyrostowy: klient wysyła tylko zmienione i usunięte rekordy, całość w jednej transakcji.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8770;
const SAVES = path.join(ROOT, 'saves');
fs.mkdirSync(SAVES, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };

// Kolumny indeksowane w tabelach encji (reszta w json). Typy: T = TEXT, I = INTEGER, R = REAL.
const TABLES = {
  riders: { name: 'T', country: 'T', born: 'T', club_id: 'I', skill: 'R', potential: 'I', contract_until: 'I' },
  clubs: { name: 'T', league: 'T', city: 'T', cash: 'I' },
  staff: { name: 'T', role: 'T', club_id: 'I' },
  academy: { name: 'T', category: 'T', club_id: 'I', born: 'T' },
  fixtures: { date: 'T', season: 'I', league: 'T', stage: 'T', round: 'I', home_id: 'I', away_id: 'I', home_pts: 'I', away_pts: 'I', played: 'I' },
  matches: { fixture_id: 'T', date: 'T', kind: 'T' },
  messages: { date: 'T', category: 'T', read: 'I', title: 'T' },
  injuries: { rider_id: 'I', start: 'T', until: 'T', kind: 'T' },
  transactions: { date: 'T', club_id: 'I', kind: 'T', amount: 'I' },
  sponsors: { club_id: 'I', name: 'T', until: 'I' },
  events: { date: 'T', kind: 'T', season: 'I' },
  attrhist: { updated: 'T' },
  fclubs: { name: 'T', league: 'T' },
  ffix: { date: 'T', season: 'I', league: 'T', played: 'I' },
};
const TYPE = { T: 'TEXT', I: 'INTEGER', R: 'REAL' };
const SCHEMA = [
  'PRAGMA journal_mode = WAL',
  'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)',
  'CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, game_date TEXT, json TEXT NOT NULL, saved TEXT NOT NULL)',
  ...Object.entries(TABLES).flatMap(([t, cols]) => [
    `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, ${Object.entries(cols).map(([c, ty]) => `${c} ${TYPE[ty]}`).join(', ')}, json TEXT NOT NULL)`,
    ...Object.keys(cols).filter(c => /_id$|^date$|^league$|^season$|^category$/.test(c)).map(c => `CREATE INDEX IF NOT EXISTS ${t}_${c} ON ${t}(${c})`),
  ]),
].join(';\n');
const SNAPSHOTS = 8;

function gameFile(id) {
  if (!/^[a-z0-9-]{1,80}$/.test(id || '')) throw Object.assign(new Error('Niepoprawny identyfikator gry'), { code: 400 });
  return path.join(SAVES, `${id}.sqlite`);
}
function withGame(id, create, fn) {
  const file = gameFile(id);
  if (!create && !fs.existsSync(file)) throw Object.assign(new Error('Nie ma takiej gry'), { code: 404 });
  const db = new DatabaseSync(file);
  try { db.exec(SCHEMA); return fn(db); } finally { db.close(); }
}
function readMeta(db) {
  const m = {};
  for (const r of db.prepare('SELECT key, value FROM meta').all()) { try { m[r.key] = JSON.parse(r.value); } catch (e) { m[r.key] = r.value; } }
  return m;
}
const val = v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

// body: { meta, state, rows: { table: [{ id, cols: {...}, data }] }, removed: { table: [id] }, snapshot }
function writeGame(db, { meta = {}, state, rows = {}, removed = {}, snapshot }) {
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    const setMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries({ ...meta, updated: now })) setMeta.run(k, JSON.stringify(v));
    if (state) {
      const json = JSON.stringify(state);
      db.prepare('INSERT OR REPLACE INTO state (id, json, updated) VALUES (1, ?, ?)').run(json, now);
      if (snapshot) {
        db.prepare('INSERT INTO snapshots (game_date, json, saved) VALUES (?, ?, ?)').run(state.date || null, json, now);
        db.prepare(`DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT ${SNAPSHOTS})`).run();
      }
    }
    for (const [t, list] of Object.entries(rows)) {
      const cols = TABLES[t];
      if (!cols) throw Object.assign(new Error(`Nieznana tabela ${t}`), { code: 400 });
      const names = Object.keys(cols);
      const up = db.prepare(`INSERT OR REPLACE INTO ${t} (id, ${names.join(', ')}, json) VALUES (?, ${names.map(() => '?').join(', ')}, ?)`);
      for (const r of list) up.run(String(r.id), ...names.map(c => val(r.cols && r.cols[c])), JSON.stringify(r.data));
    }
    for (const [t, ids] of Object.entries(removed)) {
      if (!TABLES[t]) continue;
      const del = db.prepare(`DELETE FROM ${t} WHERE id = ?`);
      for (const id of ids) del.run(String(id));
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
const slug = s => String(s || 'gra').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'gra';

const gamesApi = {
  list() {
    const games = [];
    for (const f of fs.readdirSync(SAVES).filter(f => f.endsWith('.sqlite'))) {
      try {
        withGame(f.slice(0, -7), false, db => {
          games.push({ id: f.slice(0, -7), ...readMeta(db), riders: db.prepare('SELECT COUNT(*) c FROM riders').get().c,
            size: fs.statSync(path.join(SAVES, f)).size });
        });
      } catch (e) { /* uszkodzony plik – pomiń */ }
    }
    return games.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  },
  create(body) {
    const id = `${Date.now().toString(36)}-${slug(body.meta && body.meta.club)}`;
    withGame(id, true, db => writeGame(db, { ...body, meta: { ...body.meta, created: new Date().toISOString() }, snapshot: true }));
    return { id };
  },
  load(id) {
    return withGame(id, false, db => {
      const st = db.prepare('SELECT json FROM state WHERE id = 1').get();
      const tables = {};
      for (const t of Object.keys(TABLES)) tables[t] = db.prepare(`SELECT json FROM ${t}`).all().map(r => JSON.parse(r.json));
      return { id, meta: readMeta(db), state: st ? JSON.parse(st.json) : null, tables };
    });
  },
  save(id, body) { withGame(id, false, db => writeGame(db, body)); return { ok: true }; },
  wipe(id) {
    const f = gameFile(id);
    for (const x of [f, f + '-wal', f + '-shm']) if (fs.existsSync(x)) fs.unlinkSync(x);
    return { ok: true };
  },
};

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', d => { size += d.length; if (size > limit) { reject(Object.assign(new Error('Za duże dane'), { code: 413 })); req.destroy(); } else chunks.push(d); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(Object.assign(e, { code: 400 })); } });
    req.on('error', reject);
  });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const gm = url.pathname.match(/^\/api\/games(?:\/([a-z0-9-]+))?$/);
  if (gm) {
    (async () => {
      const id = gm[1], m = req.method;
      if (!id && m === 'GET') return json(res, 200, { games: gamesApi.list() });
      if (!id && m === 'POST') return json(res, 200, gamesApi.create(await readBody(req, 400e6)));
      if (id && m === 'GET') return json(res, 200, gamesApi.load(id));
      if (id && m === 'PUT') return json(res, 200, gamesApi.save(id, await readBody(req, 400e6)));
      if (id && m === 'DELETE') return json(res, 200, gamesApi.wipe(id));
      json(res, 405, { error: 'Niedozwolona metoda' });
    })().catch(e => { if (res.headersSent || res.destroyed) return; json(res, Number.isInteger(e.code) && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message }); }); // np. ECONNRESET – przerwane połączenie nie może zatrzymać serwera
    return;
  }
  // pliki gry (tylko z katalogu gry, bez tools/ i saves/)
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
  if (!file.startsWith(ROOT) || [`${path.sep}tools${path.sep}`, `${path.sep}saves${path.sep}`].some(x => file.includes(x))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Nie znaleziono'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

function portBusy(port) {
  const probe = host => new Promise(res => {
    const s = net.connect({ port, host }, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    s.setTimeout(400, () => { s.destroy(); res(false); });
  });
  return Promise.all([probe('127.0.0.1'), probe('::1')]).then(r => r.some(Boolean));
}
if (require.main === module) {
  (async () => {
    let port = PORT;
    while (await portBusy(port)) { console.log(`Port ${port} jest zajęty – próbuję ${port + 1}.`); port++; }
    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${port}`;
      console.log(`Żużlowy Menedżer: ${url}`);
      if (process.argv.includes('--open')) require('child_process').exec(`start "" ${url}`);
    });
  })();
}
module.exports = { server, gamesApi, TABLES };
