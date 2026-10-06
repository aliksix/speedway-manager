'use strict';
// Sparingi przed sezonem (wzorzec 2025–2026: kluby jeżdżą 2–3 dwumecze od połowy marca do startu ligi, mecz i rewanż
// zwykle dzień po dniu, np. Sparta 24/25.03 z Włókniarzem, 1/2.04 z Unią). Gracz zaprasza rywala jak w FM
// (rywal odpowiada po 1–3 dniach), może zlecić to asystentowi albo przyjąć zaproszenie innego klubu.
// Kluby AI układają swoje sparingi 15 stycznia. Sparing jest rozgrywany silnikiem meczu ligowego (15 biegów),
// ale nie liczy się do statystyk, tabeli, licencji ani premii za punkty: daje rytm startowy (r.slog → trening techniki),
// formę, obserwację rywali i ryzyko kontuzji. Pełny przebieg biegów zostaje tylko dla sparingów gracza.

const SPAR_FROM = '03-08', SPAR_TO = '04-30', SPAR_MAX = 6, SPAR_AI_PLAN = '01-15';
const SPAR_LVL = { PGE: 3, '2E': 2, KLZ: 1 };
const SPAR_TICKETS = { 0: 'wstęp wolny', 10: '10 zł', 20: '20 zł' };
const SPAR_ST = { pending: 'czeka na odpowiedź', invite: 'zaproszenie dla nas', agreed: 'umówiony', played: 'rozegrany', cancelled: 'odwołany', rejected: 'odrzucony' };

const sparSeason = () => sportSeason();
const sparWindow = (S = sparSeason()) => [`${S}-${SPAR_FROM}`, `${S}-${SPAR_TO}`];
const sparAll = () => Object.values(G.sparings || {});
const sparActive = s => ['pending', 'agreed', 'played'].includes(s.status);
const sparOf = (clubId, S = sparSeason()) => sparAll().filter(s => s.season === S && (s.homeId === clubId || s.awayId === clubId)).sort(by(s => s.date));
const sparClubs = (S = sparSeason()) => {
  const ids = new Set();
  for (const f of Object.values(G.fixtures)) if (f.season === S) { ids.add(f.homeId); ids.add(f.awayId); }
  // przed publikacją terminarza (do 1 listopada): aktywne kluby polskich lig
  if (!ids.size) return Object.values(G.clubs).filter(c => SPAR_LVL[c.league] && clubActive(c, S));
  return [...ids].map(id => G.clubs[id]).filter(Boolean);
};
const sparGeo = c => geoOf(c.city) || COUNTRY_GEO.POL;
const sparKm = (a, b) => Math.round(kmBetween(sparGeo(G.clubs[a]), sparGeo(G.clubs[b])));
function sparName(s) { return `${G.clubs[s.homeId].short} – ${G.clubs[s.awayId].short}`; }
function sparLegLabel(s) { return s.pair ? (s.leg === 1 ? 'dwumecz, 1. mecz' : 'dwumecz, rewanż') : 'pojedynczy'; }

// Dzień zajęty dla klubu: mecz ligi, inny sparing (umówiony albo czekający na odpowiedź)
function sparBusy(clubId, date, skip = null) {
  if (Object.values(G.fixtures).some(f => f.date === date && (f.homeId === clubId || f.awayId === clubId))) return 'mecz ligowy';
  if (sparAll().some(s => s !== skip && s.date === date && sparActive(s) && (s.homeId === clubId || s.awayId === clubId))) return 'inny sparing';
  if (typeof campBusy === 'function' && campBusy(clubId, date)) return 'obóz';
  return null;
}
function sparDateProblem(clubId, date) {
  const [a, b] = sparWindow();
  if (!/^\d{4}-\d\d-\d\d$/.test(date || '')) return 'podaj datę';
  if (date < a || date > b) return `okno sparingowe: ${fmtDateShort(a)} – ${fmtDateShort(b)}`;
  if (date < addDays(G.date, 3)) return 'za mało czasu na organizację (min. 3 dni)';
  return sparBusy(clubId, date);
}

// ---------- Decyzja rywala ----------
// Chęć klubu do sparingu: odległość, poziom ligi, renoma, liczba już umówionych sparingów, dwumecz / mecz u siebie
function sparInterest(oppId, mineId, { pair = true, oppHome = true } = {}) {
  const o = G.clubs[oppId], me = G.clubs[mineId];
  const km = sparKm(oppId, mineId), n = sparOf(oppId).filter(sparActive).length;
  const dl = (SPAR_LVL[o.league] || 1) - (SPAR_LVL[me.league] || 1);
  let s = 1.3 - km / 260 - Math.max(0, dl) * 0.7 + Math.max(0, -dl) * 0.35 + ((me.rep || 50) - (o.rep || 50)) / 60;
  s += pair ? 0.45 : oppHome ? 0.25 : -0.35;
  s -= n >= 4 ? 0.8 : n * 0.12;
  return n >= SPAR_MAX ? -9 : s;
}
const sparChance = s => clamp(1 / (1 + Math.exp(-s * 1.6)), 0, 1);
function sparChanceLabel(p) { return p >= 0.7 ? ['duże', 'pos'] : p >= 0.4 ? ['średnie', 'warn'] : ['małe', 'neg']; }

// ---------- Zaproszenia gracza ----------
function sparPropose({ oppId, date1, date2 = null, home = true, tickets = 0, via = 'menedżer' }) {
  const me = G.clubId;
  oppId = Number(oppId);
  if (!G.clubs[oppId] || oppId === me) return { ok: false, text: 'Wybierz rywala.' };
  const dates = date2 ? [date1, date2] : [date1];
  if (date2 && date1 === date2) return { ok: false, text: 'Mecz i rewanż muszą być w różne dni.' };
  for (const d of dates) { const p = sparDateProblem(me, d); if (p) return { ok: false, text: `${fmtDateShort(d)}: ${p}.` }; }
  G.sparings = G.sparings || {};
  G.seq.spar = G.seq.spar || 1;
  const reply = addDays(G.date, rint(1, 3)), recs = [];
  dates.forEach((d, i) => {
    const h = (i === 0) === home;
    const id = `S${G.seq.spar++}`;
    recs.push(G.sparings[id] = { id, season: sparSeason(), date: d, homeId: h ? me : oppId, awayId: h ? oppId : me, status: 'pending', by: me, via, leg: date2 ? i + 1 : 0, tickets: Number(tickets) || 0, created: G.date, replyOn: reply });
  });
  if (recs.length === 2) { recs[0].pair = recs[1].id; recs[1].pair = recs[0].id; }
  return { ok: true, text: `Zaproszenie wysłane do: ${G.clubs[oppId].name}. Odpowiedź do ${fmtDateShort(reply)}.`, ids: recs.map(r => r.id) };
}
function sparAnswer(recs) {
  const s0 = recs[0], oppId = s0.homeId === G.clubId ? s0.awayId : s0.homeId, opp = G.clubs[oppId];
  const busy = recs.map(s => sparBusy(oppId, s.date, s)).find(Boolean);
  const sc = sparInterest(oppId, G.clubId, { pair: recs.length === 2, oppHome: s0.homeId === oppId });
  const ok = !busy && rnd() < sparChance(sc);
  for (const s of recs) { s.status = ok ? 'agreed' : 'rejected'; s.answered = G.date; }
  const why = busy ? `w tym terminie mamy już ${busy}` : sc < -5 ? 'mamy już komplet sparingów' : sparKm(oppId, G.clubId) > 380 ? 'to dla nas zbyt daleki wyjazd przed sezonem' : 'planujemy przygotowania inaczej';
  addMsg({ category: 'mecz', from: opp.name, title: ok ? `Sparing umówiony: ${recs.map(sparName).join(', ')}` : `${opp.short} odrzuca sparing`,
    body: ok ? `<p>Przyjmujemy zaproszenie: ${recs.map(s => `<b>${sparName(s)}</b> – ${fmtDay(s.date)}`).join('; ')}.</p><p>Skład na sparing ustawisz w Kalendarzu → Sparingi.</p>`
      : `<p>Dziękujemy za zaproszenie, ale ${why}.</p>`, link: '#/kalendarz/sparingi' });
}

// ---------- Kluby AI ----------
function sparTarget(c) { const L = SPAR_LVL[c.league] || 1; return L === 3 ? rint(4, 6) : L === 2 ? rint(3, 5) : rint(2, 4); }
// Wolne kolejne dni (mecz + rewanż) dla dwóch klubów; preferencja środka tygodnia i weekendów jak w kalendarzach klubów
function sparPairDates(a, b, S, lastDay) {
  const [w0] = sparWindow(S);
  const from = addDays(w0, 6), cands = [];
  for (let d = from; d < lastDay; d = addDays(d, 1)) {
    const d2 = addDays(d, 1);
    if (d2 >= lastDay || [a, b].some(c => sparBusy(c, d) || sparBusy(c, d2))) continue;
    cands.push(d);
  }
  return cands.length ? pick(cands) : null;
}
function sparFirstMatch(clubId, S) { const f = Object.values(G.fixtures).filter(x => x.season === S && (x.homeId === clubId || x.awayId === clubId)).map(x => x.date).sort()[0]; return f || seasonStart(S); }
function aiPlanSparings(S = sparSeason()) {
  G.sparings = G.sparings || {};
  G.seq.spar = G.seq.spar || 1;
  // stare sezony: zostają tylko sparingi gracza (bez protokołów biegowych sprzed dwóch sezonów)
  for (const s of sparAll()) if (s.season < S && !(s.homeId === G.clubId || s.awayId === G.clubId)) delete G.sparings[s.id];
  for (const s of sparAll()) if (s.season < S - 1 && s.match) delete s.match;
  const clubs = shuffle(sparClubs(S).filter(c => c.id !== G.clubId));
  const need = Object.fromEntries(clubs.map(c => [c.id, sparTarget(c) - sparOf(c.id, S).filter(sparActive).length]));
  for (let round = 0; round < 6; round++) for (const c of clubs) {
    if (need[c.id] < 2) continue;
    const opps = clubs.filter(o => o.id !== c.id && need[o.id] >= (round < 3 ? 2 : 1) && !sparOf(c.id, S).some(s => sparActive(s) && (s.homeId === o.id || s.awayId === o.id)))
      .map(o => ({ o, w: sparKm(c.id, o.id) / 120 + Math.abs((SPAR_LVL[o.league] || 1) - (SPAR_LVL[c.league] || 1)) * 0.9 + rnd() * 1.2 })).sort(by(x => x.w));
    for (const { o } of opps.slice(0, 8)) {
      const last = [sparFirstMatch(c.id, S), sparFirstMatch(o.id, S)].sort()[0];
      const d = sparPairDates(c.id, o.id, S, addDays(last, -1));
      if (!d) continue;
      const ids = [`S${G.seq.spar++}`, `S${G.seq.spar++}`], hFirst = rnd() < 0.5;
      [d, addDays(d, 1)].forEach((dd, i) => {
        const h = (i === 0) === hFirst ? c.id : o.id;
        G.sparings[ids[i]] = { id: ids[i], season: S, date: dd, homeId: h, awayId: h === c.id ? o.id : c.id, status: 'agreed', by: c.id, leg: i + 1, pair: ids[1 - i], tickets: pick([0, 0, 10, 10, 20]), created: G.date };
      });
      need[c.id] -= 2; need[o.id] -= 2;
      break;
    }
  }
  (G.sparPlanned = G.sparPlanned || {})[S] = G.date;
  sparInvites(S, clubs, need);
}
// Zaproszenia dla gracza: kluby, którym brakuje sparingów, gdy gracz ma mniej niż dwa dwumecze
function sparInvites(S, clubs, need) {
  if (sparOf(G.clubId, S).filter(sparActive).length >= 4) return;
  const cand = clubs.filter(c => need[c.id] >= 1 && sparKm(c.id, G.clubId) < 420).sort(by(c => sparKm(c.id, G.clubId) + rnd() * 150)).slice(0, rint(1, 2));
  for (const c of cand) {
    const last = [sparFirstMatch(c.id, S), sparFirstMatch(G.clubId, S)].sort()[0];
    const d = sparPairDates(c.id, G.clubId, S, addDays(last, -1));
    if (!d) continue;
    const ids = [`S${G.seq.spar++}`, `S${G.seq.spar++}`];
    [d, addDays(d, 1)].forEach((dd, i) => {
      const h = i === 0 ? c.id : G.clubId;
      G.sparings[ids[i]] = { id: ids[i], season: S, date: dd, homeId: h, awayId: h === c.id ? G.clubId : c.id, status: 'invite', by: c.id, leg: i + 1, pair: ids[1 - i], tickets: 10, created: G.date, expires: addDays(G.date, 10) };
    });
    addMsg({ category: 'mecz', from: c.name, title: `Zaproszenie na sparing: ${c.short}`, stop: true,
      body: `<p>Proponujemy dwumecz sparingowy przed sezonem: <b>${esc(c.short)} – ${esc(myClub().short)}</b> (${fmtDay(d)}) i rewanż <b>${esc(myClub().short)} – ${esc(c.short)}</b> (${fmtDay(addDays(d, 1))}).</p>
        <p class="small muted">Odległość ${sparKm(c.id, G.clubId)} km. Zaproszenie ważne do ${fmtDateShort(addDays(G.date, 10))}.</p>
        <div class="row"><button class="btn primary" onclick="ACT.sparInvite('${ids[0]}',1)">Przyjmij</button><button class="btn" onclick="ACT.sparInvite('${ids[0]}',0)">Odrzuć</button></div>`, link: '#/kalendarz/sparingi' });
  }
}
function sparInviteAnswer(id, yes) {
  const s = G.sparings[id];
  if (!s || s.status !== 'invite') return { ok: false, text: 'Zaproszenie jest już nieaktualne.' };
  const recs = [s, s.pair && G.sparings[s.pair]].filter(Boolean);
  if (yes) { const b = recs.map(x => sparBusy(G.clubId, x.date, x)).find(Boolean); if (b) return { ok: false, text: `Termin zajęty (${b}). Odwołaj kolidujące wydarzenie albo odrzuć zaproszenie.` }; }
  for (const x of recs) x.status = yes ? 'agreed' : 'rejected';
  return { ok: true, text: yes ? 'Sparing umówiony.' : 'Zaproszenie odrzucone.' };
}
function sparCancel(id) {
  const s = G.sparings[id];
  if (!s || !['pending', 'agreed', 'invite'].includes(s.status) || s.date <= G.date) return { ok: false, text: 'Tego sparingu nie można już odwołać.' };
  s.status = 'cancelled'; s.note = 'odwołany przez nas';
  return { ok: true, text: `Odwołano: ${sparName(s)} (${fmtDateShort(s.date)}).` };
}
// Asystent organizuje sparingi: do dwóch dwumeczów z najbliższymi klubami o dużej chęci
function sparAssistant() {
  const S = sparSeason(), mine = sparOf(G.clubId, S).filter(sparActive);
  let want = Math.max(0, 4 - mine.length), sent = [];
  const last = sparFirstMatch(G.clubId, S);
  const opps = sparClubs(S).filter(c => c.id !== G.clubId && !mine.some(s => s.homeId === c.id || s.awayId === c.id))
    .map(c => ({ c, p: sparChance(sparInterest(c.id, G.clubId)) - sparKm(c.id, G.clubId) / 2000 - Math.abs((SPAR_LVL[c.league] || 1) - (SPAR_LVL[myClub().league] || 1)) * 0.25 })).sort(by(x => x.p, -1));
  for (const { c } of opps) {
    if (want < 2) break;
    const d = sparPairDates(c.id, G.clubId, S, addDays([last, sparFirstMatch(c.id, S)].sort()[0], -1));
    if (!d || d < addDays(G.date, 3)) continue;
    const r = sparPropose({ oppId: c.id, date1: d, date2: addDays(d, 1), home: rnd() < 0.5, tickets: 10, via: 'asystent' });
    if (r.ok) { want -= 2; sent.push(c.short); }
  }
  return sent.length ? { ok: true, text: `Asystent wysłał zaproszenia: ${sent.join(', ')}.` } : { ok: false, text: 'Asystent nie znalazł wolnych terminów u rywali.' };
}

// ---------- Rozegranie ----------
// Skład sparingowy według zasad ligi (js/engine.js): juniorzy na 6–7, U24 na 8 i wśród 1–5, min. 4 zawodników krajowych,
// zastępstwo zawodnika; wybór gracza (numery 1–8) sprawdzany jak awizacja w Taktyce, puste numery uzupełnia automat
function sparAvail(r, date) { return available(r, date) && !u16(r, date) && !fimBusy(r, date); }
// Skład sparingowy: klub gracza – skład z Taktyki, nadpisany numerami wybranymi na ekranie sparingu; braki uzupełnia validLineup
function sparLineup(clubId, date, pref) {
  const tac = clubId === G.clubId && G.lineups && Array.isArray(G.lineups[clubId]) ? G.lineups[clubId] : null;
  const merged = pref && pref.some(Boolean) ? (tac || Array(8).fill(null)).map((id, i) => pref[i] || id) : tac;
  return merged && merged.some(Boolean) ? validLineup(clubId, merged, date) : autoLineup(clubId, date);
}
function sparMatch(s) {
  const home = G.clubs[s.homeId];
  const id = `XS${s.id}`;
  const lH = sparLineup(s.homeId, s.date, s.homeId === G.clubId && s.lineup), lA = sparLineup(s.awayId, s.date, s.awayId === G.clubId && s.lineup);
  const m = { id, kind: 'sparing', sparingId: s.id, date: s.date, homeId: s.homeId, awayId: s.awayId, venue: home.stadium.name, track: home.stadium.track,
    weather: weatherFor(s.date, G.seed), lineup: { A: lA, H: lH }, heats: [], score: { H: 0, A: 0 }, subs: { H: 0, A: 0 }, done: false,
    heatTableId: 'league-15-set-' + (1 + hashStr(id) % 2), heatTableVersion: SPEEDWAY_HEAT_TABLES.schemaVersion, nominations: {}, riders: {} };
  for (const t of ['A', 'H']) m.lineup[t].forEach((rid, i) => { if (rid) m.riders[rid] = { team: t, no: t === 'A' ? i + 1 : i + 9, pts: 0, bonus: 0, heats: 0, line: [], ...(i < 5 && !sparAvail(G.riders[rid], s.date) ? { zz: true } : {}) }; }); // zastępstwo zawodnika jak w lidze
  // tor i próba toru jak w meczu ligowym (bez komisarza toru); plan gracza: osobny na sparing albo domyślny (js/track.js)
  const sel = G.trackTest && G.trackTest['S' + s.id], mine = s.homeId === G.clubId ? 'H' : s.awayId === G.clubId ? 'A' : null;
  teamMeetingTrack(m, { planKey: 'S' + s.id, testers: mine && sel ? { [mine]: sel } : null });
  return m;
}
// Wywołanie z silnika po 15. biegu (js/engine.js: playNextHeat)
function finishSparing(m) {
  m.done = true;
  const s = G.sparings[m.sparingId];
  if (!s) return;
  const home = G.clubs[s.homeId], away = G.clubs[s.awayId], mine = s.homeId === G.clubId || s.awayId === G.clubId;
  const wf = m.weather && /deszcz|mokr/i.test(m.weather.sky + m.weather.track) ? 0.7 : 1;
  const att = Math.round(clamp((home.fans || 5000) * 0.09 * ({ 0: 1.5, 10: 1, 20: 0.7 }[s.tickets] || 1) * wf * (0.8 + rnd() * 0.4) * (1 + Math.max(0, (SPAR_LVL[away.league] || 1) - (SPAR_LVL[home.league] || 1)) * 0.25), 150, (home.stadium.capacity || 8000) * 0.5));
  const cost = { 3: 24000, 2: 16000, 1: 10000 }[SPAR_LVL[home.league] || 1];
  m.attendance = att;
  if (s.tickets) addTx(s.homeId, 'bilety', att * s.tickets * 0.85, `Bilety – sparing ${sparName(s)}`);
  addTx(s.homeId, 'mecze', -cost, `Organizacja sparingu ${sparName(s)} (tor, sędzia, karetki, ochrona)`);
  const km = sparKm(s.homeId, s.awayId);
  if (km >= 15) addTx(s.awayId, 'wyjazd', -Math.round(2500 + km * 2 * 14), `Wyjazd na sparing ${sparName(s)} (${km} km)`);
  for (const [rid, x] of Object.entries(m.riders)) {
    const r = G.riders[rid];
    if (!r || !x.heats) continue;
    logStart(r, s.date, x.heats, 'sparing');
    if (typeof licFriendly === 'function') licFriendly(r, s.date, x.heats); // zawody towarzyskie – przedłużenie licencji
    const exp = (r.skill - 6) / 9 * 2.1;
    r.form = clamp(r.form * 0.9 + ((x.pts + x.bonus) / x.heats - exp) * 0.15, -2, 2);
  }
  s.status = 'played';
  s.score = { ...m.score };
  s.att = att;
  s.top = Object.entries(m.riders).sort(by(([, x]) => x.pts + x.bonus, -1)).slice(0, 3).map(([id, x]) => ({ id: Number(id), pts: x.pts, bonus: x.bonus }));
  s.riders = Object.keys(m.riders).map(Number);
  if (!mine) return;
  s.match = m; // pełny protokół tylko dla sparingów gracza
  G.scout = G.scout || {};
  for (const [rid, x] of Object.entries(m.riders)) if (x.team !== (s.homeId === G.clubId ? 'H' : 'A')) G.scout[rid] = Math.min(0.35, (G.scout[rid] || 0) + 0.015);
  const me = s.homeId === G.clubId ? 'H' : 'A', op = me === 'H' ? 'A' : 'H';
  const ours = Object.entries(m.riders).filter(([, x]) => x.team === me).sort(by(([, x]) => x.pts + x.bonus, -1));
  addMsg({ category: 'mecz', from: 'Asystent trenera', title: `Sparing: ${home.short} ${m.score.H}:${m.score.A} ${away.short}`,
    body: `<p>${fmtDay(s.date)}, ${esc(m.venue)} – ${fmtNum(att)} widzów (${SPAR_TICKETS[s.tickets] || ''}), tor ${esc(m.weather.track)}.</p>
      <p><b>${esc(home.name)} ${m.score.H} : ${m.score.A} ${esc(away.name)}</b> ${m.score[me] > m.score[op] ? '– wygrana' : m.score[me] < m.score[op] ? '– porażka' : '– remis'}, wynik bez znaczenia sportowego.</p>
      <p>Nasi: ${ours.map(([id, x]) => `${esc(G.riders[id].name)} ${x.pts}${x.bonus ? '+' + x.bonus : ''}`).join(', ')}.</p>`, link: `#/kalendarz/sparing/${s.id}` });
}
// Pogoda na sparing: łagodniej niż trening torowy (trackUsable) – tor przygotowany pod zawody, jedzie się od ~2–3°C; odwołuje głównie deszcz
function sparTrackOk(date) { const w = dayWeather(date); return w.temp >= 2.5 && !(w.wet && hrand(G.seed + 'ru' + date) < 0.6); }
// Dzień gry: odpowiedzi rywali, wygasłe zaproszenia, plan klubów AI, sparingi z pogodą
function sparingDay(date) {
  if (!G.sparings) G.sparings = {};
  const S = sparSeason(), md = date.slice(5);
  if (md >= SPAR_AI_PLAN && md <= SPAR_TO && !(G.sparPlanned && G.sparPlanned[S])) aiPlanSparings(S);
  const done = new Set();
  for (const s of sparAll()) {
    if (s.status === 'pending' && s.replyOn <= date && !done.has(s.id)) {
      const recs = [s, s.pair && G.sparings[s.pair]].filter(x => x && x.status === 'pending');
      recs.forEach(x => done.add(x.id));
      sparAnswer(recs);
    }
    if (s.status === 'invite' && (s.expires <= date || s.date <= addDays(date, 2))) { s.status = 'rejected'; s.note = 'zaproszenie wygasło'; }
    if (s.status === 'pending' && s.date <= date) { s.status = 'rejected'; s.note = 'brak odpowiedzi przed terminem'; }
  }
  for (const s of sparAll().filter(x => x.date === date && x.status === 'agreed')) {
    // sparing gracza rozpoczęty na żywo (Kalendarz → Sparing): dokończenie symulacją
    if (s.match && !s.match.done) { simulateMatch(s.match); continue; }
    const m = sparWeather(s, date) && sparBegin(s);
    if (m) simulateMatch(m);
  }
}
// Pogoda w dniu sparingu: deszcz albo mróz – przełożenie (najwyżej dwa razy) na najbliższy wolny dzień w ciągu 3 dni
// w oknie sparingowym, w przeciwnym razie odwołanie. Zwraca true, gdy sparing może się odbyć.
function sparWeather(s, date) {
  if (s.match || sparTrackOk(date)) return true;
  const mine = s.homeId === G.clubId || s.awayId === G.clubId;
  const nd = [1, 2, 3].map(k => addDays(date, k)).find(d => d <= sparWindow(s.season)[1] && !sparBusy(s.homeId, d, s) && !sparBusy(s.awayId, d, s));
  if ((s.moves || 0) < 2 && nd) { s.date = nd; s.moves = (s.moves || 0) + 1; s.note = `przełożony z ${fmtDateShort(date)} (pogoda)`; }
  else { s.status = 'cancelled'; s.note = 'odwołany z powodu pogody'; }
  if (mine) addMsg({ category: 'mecz', from: 'Kierownik drużyny', title: `Sparing ${sparName(s)}: ${s.status === 'cancelled' ? 'odwołany' : 'przełożony'}`, body: `<p>Tor nie nadaje się do jazdy (${dayWeather(date).temp < 2.5 ? 'za zimno' : 'opady'}). ${s.status === 'cancelled' ? 'Sparing odwołany.' : `Nowy termin: ${fmtDay(s.date)}.`}</p>`, link: '#/kalendarz/sparingi' });
  return false;
}
// Start sparingu: składy, dojazd gości; mecz gracza zapisany od razu (rozgrywanie bieg po biegu)
function sparBegin(s) {
  if (s.match) return s.match;
  const m = sparMatch(s);
  if (['H', 'A'].some(t => m.lineup[t].filter(Boolean).length < 4)) { s.status = 'cancelled'; s.note = 'brak zawodników'; return null; }
  const g = sparGeo(G.clubs[s.homeId]);
  for (const rid of m.lineup.A) if (rid) travelTo(G.riders[rid], g, s.date);
  if (s.homeId === G.clubId || s.awayId === G.clubId) s.match = m;
  return m;
}
// Sparing gracza na dziś (po decyzji pogodowej) – zatrzymanie upływu czasu jak w dniu meczu
function sparUserToday(date = G.date) {
  const s = sparAll().find(x => x.date === date && x.status === 'agreed' && (x.homeId === G.clubId || x.awayId === G.clubId));
  return s && !(s.match && s.match.done) && sparWeather(s, date) ? s : null;
}
const sparMatchById = mid => { const s = sparAll().find(x => x.match && x.match.id === mid); return s ? s.match : null; };
// Plan startów zawodnika (js/schedule.js riderPlanned): umówione i rozegrane sparingi klubu
function sparPlannedFor(r, from, to) {
  if (!r.clubId || !G.sparings) return [];
  return sparAll().filter(s => s.date >= from && s.date <= to && (s.homeId === r.clubId || s.awayId === r.clubId) && (s.status === 'agreed' || (s.status === 'played' && (s.riders || []).includes(r.id))))
    .map(s => ({ d: s.date, k: 'sparing', lbl: `sparing: ${sparName(s)}`, g: sparGeo(G.clubs[s.homeId]), link: `#/kalendarz/sparing/${s.id}`, done: s.status === 'played' }));
}
