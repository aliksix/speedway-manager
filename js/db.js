'use strict';
// Zapis gry w bazie SQLite (serwer tools/server.js). Każda rozgrywka = osobny plik bazy z pełnymi danymi.
// Zapis przyrostowy: porównanie rekordów z ostatnio zapisanymi i wysłanie tylko zmian.

const COLLECTIONS = {
  riders: r => ({ name: r.name, country: r.country, born: r.born, club_id: r.clubId, skill: round2(r.skill), potential: r.potential, contract_until: r.contract ? r.contract.until : null }),
  clubs: c => ({ name: c.name, league: c.league, city: c.city, cash: Math.round(c.cash) }),
  staff: s => ({ name: s.name, role: s.role, club_id: s.clubId }),
  academy: k => ({ name: k.name, category: k.cat, club_id: k.clubId, born: k.born }),
  fixtures: f => ({ date: f.date, season: f.season, league: f.league, stage: f.stage, round: f.round, home_id: f.homeId, away_id: f.awayId, home_pts: f.homePts, away_pts: f.awayPts, played: f.played }),
  matches: m => ({ fixture_id: m.fixtureId || m.eventId, date: m.date, kind: m.kind }),
  messages: m => ({ date: m.date, category: m.category, read: m.read, title: m.title }),
  injuries: i => ({ rider_id: i.riderId, start: i.start, until: i.until, kind: i.kind }),
  transactions: t => ({ date: t.date, club_id: t.clubId, kind: t.kind, amount: t.amount }),
  sponsors: s => ({ club_id: s.clubId, name: s.name, until: s.until }),
  events: e => ({ date: e.date, kind: e.kind, season: e.season }),
  attrhist: h => ({ updated: h.u || null }),
  fclubs: c => ({ name: c.name, league: c.league }), // ligi zagraniczne: kluby i składy (js/foreign.js)
  ffix: f => ({ date: f.d, season: f.season, league: f.lg, played: f.played ? 1 : 0 }), // mecze lig zagranicznych z wynikami
};
const IMMUTABLE_DONE = { matches: m => m.done, transactions: () => true, ffix: f => f.played };

const DB = { on: false, cache: new Map(), frozen: new Set(), timer: null, saving: false, again: false, lastSaved: null, lastSnapshotDate: null };
const JSON_HDR = { 'Content-Type': 'application/json' };

async function dbCheck() {
  DB.local = false;
  if (/^https?:$/.test(location.protocol)) { try { DB.on = (await fetch('api/games', { cache: 'no-store' })).ok; } catch (e) { DB.on = false; } }
  if (!DB.on && typeof indexedDB !== 'undefined') { // bez serwera (GitHub Pages, plik z dysku): zapis w pamięci przeglądarki
    try { await ldb(); DB.on = DB.local = true; if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { DB.on = false; }
  }
  return DB.on;
}
// ---------- Zapis w przeglądarce (IndexedDB) – to samo API co serwer tools/server.js ----------
// games: id → { id, meta, state (JSON), size }; rows: [id gry, tabela, id rekordu] → rekord (JSON)
let LDB = null;
function ldb() {
  if (LDB) return LDB;
  LDB = new Promise((ok, fail) => {
    const rq = indexedDB.open('zuzlowy-menedzer', 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore('games', { keyPath: 'id' }); rq.result.createObjectStore('rows'); };
    rq.onsuccess = () => ok(rq.result);
    rq.onerror = () => { LDB = null; fail(rq.error); };
  });
  return LDB;
}
const ldbReq = rq => new Promise((ok, fail) => { rq.onsuccess = () => ok(rq.result); rq.onerror = () => fail(rq.error); });
const ldbDone = tx => new Promise((ok, fail) => { tx.oncomplete = ok; tx.onerror = tx.onabort = () => fail(tx.error || new Error('Zapis w przeglądarce przerwany')); });
const ldbRange = id => IDBKeyRange.bound([id], [id, []]);
async function localApi(url, method, body) {
  const db = await ldb(), id = (url.match(/games\/([a-z0-9-]+)/) || [])[1];
  if (!id && method === 'GET') {
    const games = await ldbReq(db.transaction('games').objectStore('games').getAll());
    return { games: games.map(g => ({ id: g.id, ...g.meta, size: g.size || 0 })).sort((a, b) => String(b.updated).localeCompare(String(a.updated))) };
  }
  if (id && method === 'GET') {
    const tx = db.transaction(['games', 'rows']);
    const [g, keys, vals] = await Promise.all([ldbReq(tx.objectStore('games').get(id)), ldbReq(tx.objectStore('rows').getAllKeys(ldbRange(id))), ldbReq(tx.objectStore('rows').getAll(ldbRange(id)))]);
    if (!g) throw new Error('Nie ma takiej gry w pamięci przeglądarki');
    const tables = {};
    keys.forEach((k, i) => (tables[k[1]] = tables[k[1]] || []).push(JSON.parse(vals[i])));
    return { id, meta: g.meta, state: JSON.parse(g.state), tables };
  }
  if (id && method === 'DELETE') {
    const tx = db.transaction(['games', 'rows'], 'readwrite');
    tx.objectStore('games').delete(id); tx.objectStore('rows').delete(ldbRange(id));
    await ldbDone(tx); return { ok: true };
  }
  if (method === 'POST' || (id && method === 'PUT')) {
    const gid = id || `${Date.now().toString(36)}-${String((body.meta && body.meta.club) || 'gra').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)}`;
    const tx = db.transaction(['games', 'rows'], 'readwrite'), gs = tx.objectStore('games'), rs = tx.objectStore('rows');
    const old = id ? await ldbReq(gs.get(gid)) : null;
    if (id && !old) throw new Error('Nie ma takiej gry w pamięci przeglądarki');
    const now = new Date().toISOString(), state = JSON.stringify(body.state);
    let size = (old && old.rowSize) || 0;
    for (const [t, list] of Object.entries(body.rows || {})) for (const r of list) { const j = JSON.stringify(r.data); if (!id) size += j.length; rs.put(j, [gid, t, String(r.id)]); } // rozmiar: z pełnego zapisu przy tworzeniu gry
    for (const [t, ids] of Object.entries(body.removed || {})) for (const rid of ids) rs.delete([gid, t, String(rid)]);
    gs.put({ id: gid, meta: { ...(old ? old.meta : { created: now }), ...body.meta, updated: now }, state, rowSize: size, size: size + state.length });
    await ldbDone(tx);
    return id ? { ok: true } : { id: gid };
  }
  throw new Error('Niedozwolona operacja');
}
async function api(url, method = 'GET', body) {
  if (DB.local) return localApi(url, method, body);
  url = url.replace(/^\//, ''); // ścieżka względna – działa też pod adresem z podkatalogiem
  const r = await fetch(url, { method, headers: body ? JSON_HDR : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
function gameMeta() {
  const c = myClub();
  return { clubId: c.id, club: c.name, clubShort: c.short, colors: c.colors, manager: G.manager.name, date: G.date, season: G.season, league: LEAGUES[c.league].name, cash: Math.round(c.cash) };
}
function stateOnly() {
  const s = {};
  for (const [k, v] of Object.entries(G)) if (!COLLECTIONS[k]) s[k] = v;
  return s;
}
// Zmienione rekordy od ostatniego zapisu
function diffRows(full) {
  const rows = {}, removed = {}, seen = new Set(), pending = [];
  for (const [t, cols] of Object.entries(COLLECTIONS)) {
    for (const [id, obj] of Object.entries(G[t] || {})) {
      const key = `${t}:${id}`;
      seen.add(key);
      // rekord zakończony pomijamy tylko wtedy, gdy zapisano go już w stanie końcowym (mecz zapisany w trakcie trzeba zapisać po zakończeniu)
      const done = !!(IMMUTABLE_DONE[t] && IMMUTABLE_DONE[t](obj));
      if (!full && done && DB.frozen.has(key)) continue;
      const json = JSON.stringify(obj);
      if (!full && DB.cache.get(key) === json) { if (done) DB.frozen.add(key); continue; }
      (rows[t] = rows[t] || []).push({ id, cols: cols(obj), data: obj });
      pending.push([key, json, done]);
    }
  }
  for (const key of DB.cache.keys()) if (!seen.has(key)) { const [t, id] = key.split(/:(.+)/); (removed[t] = removed[t] || []).push(id); }
  return { rows, removed, pending };
}
function commitCache({ pending, removed }) {
  for (const [k, v, done] of pending) { DB.cache.set(k, v); if (done) DB.frozen.add(k); }
  for (const [t, ids] of Object.entries(removed)) for (const id of ids) { DB.cache.delete(`${t}:${id}`); DB.frozen.delete(`${t}:${id}`); }
}
async function dbCreate() {
  const d = diffRows(true);
  const j = await api('/api/games', 'POST', { meta: gameMeta(), state: stateOnly(), rows: d.rows });
  G.gameId = j.id;
  commitCache(d);
  DB.lastSnapshotDate = G.date;
  await dbSaveNow();
  return j.id;
}
function dbQueueSave() { clearTimeout(DB.timer); DB.timer = setTimeout(dbSaveNow, 400); }
async function dbSaveNow() {
  clearTimeout(DB.timer);
  if (!DB.on || !G || !G.gameId) return;
  if (DB.saving) { DB.again = true; return DB.waiter || (DB.waiter = new Promise(r => { DB.wake = r; })); } // czeka na kolejny zapis, który obejmie bieżące zmiany
  DB.saving = true;
  const d = diffRows(false);
  // kopia zapasowa stanu raz na tydzień gry
  const snapshot = !DB.lastSnapshotDate || dayDiff(DB.lastSnapshotDate, G.date) >= 7;
  try {
    await api(`/api/games/${G.gameId}`, 'PUT', { meta: gameMeta(), state: stateOnly(), rows: d.rows, removed: d.removed, snapshot });
    commitCache(d);
    if (snapshot) DB.lastSnapshotDate = G.date;
    DB.lastSaved = Date.now();
    document.body.dataset.saved = new Date().toLocaleTimeString('pl-PL');
  } catch (e) {
    console.warn('Zapis do bazy nie powiódł się', e);
    if (typeof toast === 'function') toast(DB.local ? `Nie udało się zapisać gry w pamięci przeglądarki: ${esc(e.message || e)}` : 'Nie udało się zapisać gry – czy serwer (start.bat) działa?', 'bad');
  } finally {
    DB.saving = false;
    if (DB.again) { DB.again = false; const wake = DB.wake; DB.waiter = DB.wake = null; dbSaveNow().then(wake, wake); }
  }
}
async function dbList() { return (await api('/api/games')).games; }
async function dbLoad(id) {
  const j = await api(`/api/games/${id}`);
  G = j.state;
  G.gameId = id;
  DB.cache.clear(); DB.frozen.clear();
  for (const t of Object.keys(COLLECTIONS)) {
    G[t] = {};
    for (const obj of j.tables[t] || []) { G[t][obj.id] = obj; DB.cache.set(`${t}:${obj.id}`, JSON.stringify(obj)); if (IMMUTABLE_DONE[t] && IMMUTABLE_DONE[t](obj)) DB.frozen.add(`${t}:${obj.id}`); }
  }
  DB.lastSnapshotDate = G.date;
  if (typeof migrateSave === 'function' && migrateSave()) dbQueueSave();
  if (typeof migrateMarket === 'function' && migrateMarket()) dbQueueSave();
  if (typeof migrateMarket2 === 'function' && migrateMarket2()) dbQueueSave();
  if (typeof scaleStartContracts === 'function' && !G.contractsScaled && G.date < '2026-02-01' && scaleStartContracts()) dbQueueSave(); // przed pierwszą ratą za podpis
  if (typeof addMissingClubs === 'function' && addMissingClubs()) dbQueueSave();
  if (typeof markDormantClubs === 'function' && markDormantClubs()) dbQueueSave();
  if (typeof fixAgeFields === 'function' && fixAgeFields()) dbQueueSave(); // listy startowe zawodów z limitem wieku
  if (typeof drawPendingNumbers === 'function' && drawPendingNumbers()) dbQueueSave();
  if (typeof migrateDmpj === 'function' && migrateDmpj()) dbQueueSave();
  if (typeof fixGpClashes === 'function' && fixGpClashes()) dbQueueSave(); // zawody krajowe nie w dniu rundy Grand Prix // DMPJ: grupy eliminacyjne i fazy z regulaminu 2026 // numery startowe losowane, nie według kolejności obsady
  if (typeof foreignMigrate === 'function' && foreignMigrate()) dbQueueSave(); // ligi zagraniczne: kluby, składy, terminarz, mistrzostwa krajowe (js/foreign.js)
  if (!G.noUserPhotos) { // zdjęcia gracza i dzieci z dawnego kreatora – teraz tylko pliki z img/staff i img/riders
    for (const x of [G.manager, ...((G.manager && G.manager.children) || []), ...Object.values(G.staff), ...Object.values(G.academy), ...Object.values(G.riders)]) if (x && x.photo) delete x.photo;
    G.noUserPhotos = true;
  }
  for (const d of DATA.clubs) { const c = G.clubs[d.id]; if (c) { c.colors = d.colors.slice(); c.short = d.short; } } // barwy (z herbu) i skrót są stałe – nadpisują stare zapisy
  if (typeof rescaleStaffWages === 'function') rescaleStaffWages(); // płace sztabu według ligi
  if (!G.budgetFix1) { for (const c of Object.values(G.clubs)) if (BUDGET_FIX[c.short] && G.season <= START_SEASON + 1) c.budget = BUDGET_FIX[c.short]; G.budgetFix1 = true; } // kluby uśpione: bez kontraktów i sponsorów do reaktywacji
  if (typeof finMigrate === 'function' && finMigrate()) dbQueueSave();
  if (typeof stadiumMigrate === 'function' && stadiumMigrate()) dbQueueSave(); // sektory z bazy stadionów, cenniki biletów i karnetów
  if (typeof addInactiveRiders === 'function' && addInactiveRiders()) dbQueueSave();
  if (typeof licMigrate === 'function' && licMigrate()) dbQueueSave();
  if (statsRecount()) dbQueueSave();
  if (typeof ledgerMigrate === 'function' && ledgerMigrate()) dbQueueSave(); // księga roczna (podsumowanie lat) // statystyki ligowe: mecze tylko z przejechanym biegiem (starsze zapisy liczyły rezerwowych bez startu)
  if (typeof rolesMigrate === 'function' && rolesMigrate()) dbQueueSave();
  if (typeof applyContractCases === 'function' && applyContractCases()) dbQueueSave();
  if (typeof applyNationalities === 'function') applyNationalities();
  // scalenie duplikatów zawodników z rejestru PZM (inna pisownia tego samego zawodnika w tym samym klubie)
  if (!G.dedupeRiders1) {
    for (const r of Object.values(G.riders)) {
      if (!r.academyCatalogId || r.id < 30000 || !G.riders[r.id]) continue;
      const other = Object.values(G.riders).find(x => x.id !== r.id && x.clubId === r.clubId && !x.academyCatalogId && x.born.slice(0, 4) === r.born.slice(0, 4) &&
        translit(x.name).split(' ').pop() === translit(r.name).split(' ').pop() && translit(x.name)[0] === translit(r.name)[0]);
      if (!other) continue;
      Object.assign(other, { academyCatalogId: r.academyCatalogId, schoolId: r.schoolId });
      if (G.miniPeople) for (const p of Object.values(G.miniPeople)) if (p.riderId === r.id) p.riderId = other.id;
      delete G.riders[r.id];
    }
    G.dedupeRiders1 = true; dbQueueSave();
  }
  if (typeof calibrateSkills === 'function' && G.date < `${START_SEASON}-11-01` && calibrateSkills()) dbQueueSave();
  if (typeof RST !== 'undefined' && RST && !G.realRostersApplied && G.date < `${RST.season - 1}-11-01`) {
    applyRealRosters();
    addMsg({ category: 'zarząd', from: 'Sekretariat', stop: true, title: `Oficjalne kadry i sztaby na sezon ${RST.season}`, body: `<p>Wczytano kadry klubów, sztaby szkoleniowe, szkółki i osoby funkcyjne na sezon ${RST.season} (ekstraliga.pl, polskizuzel.pl, PZM).</p>${squadReportHtml(G.clubId)}`, link: '#/druzyna' });
    dbQueueSave();
  }
  if (!(G.compEventsMade && G.compEventsMade[sportSeason()])) {
    for (const e of Object.values(G.events)) if (e.kind === 'turniej' && !e.played) delete G.events[e.id];
    ensureSeasonEvents(); dbQueueSave();
  }
  // poprawki nazwisk (pełne imiona) i usunięcie wirtualnych adeptów szkółek
  for (const r of Object.values(G.riders)) { const d = DATA.riders.find(x => x.id === r.id); if (d && d.name !== r.name && r.id < 10000) r.name = d.name; }
  // poprawki kolejności imienia i nazwiska adeptów; usunięcie adeptów zdublowanych z zawodnikami
  const KID_NAME_FIX = { 'Kostera Maksymilian': 'Maksymilian Kostera' };
  for (const k of Object.values(G.academy)) {
    if (KID_NAME_FIX[k.name]) k.name = KID_NAME_FIX[k.name];
    if (Object.values(G.riders).some(r => normName(r.name) === normName(k.name) && String(r.born || '').slice(0, 4) === String(k.born || '').slice(0, 4))) delete G.academy[k.id];
  }
  if (!G.academyVirtualRemoved) { for (const k of Object.values(G.academy)) if (!k.real && !k.mgrChild) delete G.academy[k.id]; G.academyVirtualRemoved = true; dbQueueSave(); }
  // naprawa dat urodzenia z błędnym dniem (starsze zapisy)
  for (const r of Object.values(G.riders)) if (!/^\d{4}-\d{2}-\d{2}$/.test(r.born) || r.born.endsWith('-00')) r.born = birthFromYear(Number(r.born.slice(0, 4)), r.name);
  seedRng(hashStr(G.seed + G.date));
  if (typeof applyMiniData === 'function') {
    const imported = applyMiniData();
    const calendarAdded = makeMiniEvents(Math.max(G.season, MINI_DATA.season));
    if (imported || calendarAdded) dbQueueSave();
  }
  // nowy system umiejętności: CA/PA 1–100 z kalibracji, 28 atrybutów, cechy ukryte (js/ability.js)
  if (typeof migrateAbility === 'function') {
    let ch = migrateAbility();
    for (const r of Object.values(G.riders)) if (r.ca == null) { initRiderAbility(r); ch = true; }
    for (const k of Object.values(G.academy)) if (k.ca == null) { initKidAbility(k, null); ch = true; }
    if (typeof fixKidCalibByName === 'function' && fixKidCalibByName()) ch = true;
    if (ch) dbQueueSave();
  }
  // klasy szkolenia PZM: dawna klasa 125 cm³ to miniżużel 85–140 cm³
  for (const k of Object.values(G.academy)) if (k.cat === 'c125') { k.cat = 'c85'; dbQueueSave(); }
  // pełne daty urodzenia (js/birthdates.js) i licencje zagranicznych adeptów po 16. urodzinach (js/ability.js)
  if (typeof applyBirthDates === 'function' && applyBirthDates()) dbQueueSave();
  if (typeof backfillHonours === 'function' && backfillHonours()) dbQueueSave(); // sukcesy sezonów rozegranych przed zapisem sukcesów (js/honours-game.js)
  if (typeof foreignLicences === 'function' && foreignLicences()) dbQueueSave();
  if (typeof ensureKidLicences === 'function' && ensureKidLicences()) dbQueueSave(); // licencje 85–140 cm³ i 250 cm³/500R (js/kid-licence.js)
  // trening: profile i nowe role sztabu, baza szkoleniowa, historia atrybutów (js/training.js)
  if (typeof ensureTrainingModel === 'function' && ensureTrainingModel()) dbQueueSave();
  if (typeof ensureScheduleModel === 'function' && ensureScheduleModel()) dbQueueSave(); // terminarz: ligi zagraniczne, dziennik startów
  if (typeof ensureEquipmentModel === 'function' && ensureEquipmentModel()) dbQueueSave(); // tunerzy i park maszyn (js/equipment.js)
  if (typeof ensureEngineRegistry === 'function' && ensureEngineRegistry()) dbQueueSave(); // numery seryjne silników, rynek wtórny
  if (typeof ensureAcademyBikes === 'function' && ensureAcademyBikes()) dbQueueSave(); // motocykle szkółki
  if (typeof applyCoachModel === 'function' && applyCoachModel()) dbQueueSave(); // sztaby: bez generowanych osób, główni trenerzy 2026
  if (typeof ensureAdeptModel === 'function' && ensureAdeptModel()) dbQueueSave(); // zagraniczni adepci, koniec kariery
  if (typeof ensurePlanModel === 'function' && ensurePlanModel()) dbQueueSave(); // planer treningu (js/planner.js)
  if (typeof ensureScoutModel === 'function' && ensureScoutModel()) dbQueueSave(); // skauting (js/scouting.js)
}
async function dbDelete(id) { await api(`/api/games/${id}`, 'DELETE'); }
// Przeliczenie statystyk ligowych sezonów rozegranych w grze z protokołów (G.matches): mecz liczy się tylko, gdy zawodnik przejechał bieg
function statsRecount() {
  if (G.statsRecount1) return false;
  const agg = {};
  for (const m of Object.values(G.matches)) {
    const fx = m.done && m.fixtureId && G.fixtures[m.fixtureId];
    if (!fx || !m.riders) continue;
    const S = fx.season;
    for (const [rid, s] of Object.entries(m.riders)) {
      if (!s || !s.heats || !G.riders[rid]) continue;
      const a = ((agg[rid] = agg[rid] || {})[S] = agg[rid][S] || { m: 0, heats: 0, pts: 0, bonus: 0, w: 0, falls: 0, def: 0, exc: 0 });
      const line = s.line || [];
      a.m++; a.heats += s.heats; a.pts += s.pts; a.bonus += s.bonus;
      a.w += line.filter(x => String(x).startsWith('3')).length; a.falls += line.filter(x => x === 'u').length; a.def += line.filter(x => x === 'd').length; a.exc += line.filter(x => x === 'w' || x === 't').length;
    }
  }
  const seasons = new Set(Object.values(G.fixtures).filter(f => f.played).map(f => f.season));
  for (const r of Object.values(G.riders)) for (const S of seasons) {
    const st = r.stats && r.stats[S];
    if (!st) continue;
    Object.assign(st, (agg[r.id] && agg[r.id][S]) || { m: 0, heats: 0, pts: 0, bonus: 0, w: 0, falls: 0, def: 0, exc: 0 });
    if (typeof seasonPlaceStats === 'function') Object.assign(st, seasonPlaceStats(r, S, null));
  }
  G.statsRecount1 = true;
  return true;
}
