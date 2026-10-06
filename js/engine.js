'use strict';
// Silnik zawodów: mecz ligowy (15 biegów, 2 × 8 zawodników) i turniej indywidualny Grand Prix (20 biegów + półfinały + finał).

// Program meczu: [gość, gość, gospodarz, gospodarz]; goście 1–8, gospodarze 9–16. Biegi 14–15 – nominowane.
const PROGRAM = [
  [1, 2, 9, 10], [6, 7, 14, 15], [3, 4, 11, 12], [5, 8, 13, 16], [1, 3, 10, 12], [2, 5, 9, 14], [4, 6, 11, 13],
  [1, 8, 12, 15], [3, 5, 9, 16], [2, 4, 10, 13], [1, 7, 11, 9], [2, 3, 10, 13], [4, 5, 11, 12],
];
const GATES = ['A', 'B', 'C', 'D'];
const HELMET = { H: ['czerwony', 'niebieski'], A: ['biały', 'żółty'] };
const HELMET_COLOR = { czerwony: '#e5484d', niebieski: '#2f7ae5', biały: '#f4f6fa', żółty: '#f2c14e' };
const MAX_HEATS = 6;
const GP_POINTS = [20, 18, 16, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

const SLOT_LABEL = n => { const k = ((n - 1) % 8) + 1; return k <= 5 ? 'senior' : k <= 7 ? 'junior U21' : 'U24'; };

// ---------- Skład meczowy ----------
function available(r, date) { return r && r.active !== false && !r.retired && !(r.sitOut && !r.loan && r.sitOut >= Number(String(date || G.date).slice(0, 4))) && !r.injury && !(typeof plBanned === 'function' && plBanned(r, date)) && !(r.suspendedUntil && r.suspendedUntil > date); }
// Zasady składu: numery 6–7 – juniorzy (U21), numer 8 (rezerwa) – zawodnik U24, a wśród numerów 1–5 co najmniej jeden U24.
// Regulamin (art. 709 / 759 / 1159): na numerach 1–7 co najmniej 4 zawodników krajowych; na 6–7 tylko polscy juniorzy –
// w PGE Ekstralidze (od 2026) jeden z nich może być zagraniczny; rezerwa nr 8 – do 24 lat, dowolna narodowość
const isU24 = r => sportSeason() - Number(r.born.slice(0, 4)) <= 24;
// Zawodnik krajowy: obywatel kraju klubu – dla klubów zagranicznych w KLŻ (art. 1159 ust. 4) kraj ich federacji
const CLUB_NATION = { Daugavpils: 'LAT', Landshut: 'GER' };
const clubNation = clubId => CLUB_NATION[(G.clubs[clubId] || {}).city] || 'POL';
const isDomestic = (r, clubId) => !!r && hasNat(r, clubNation(clubId ?? r.clubId)); // także drugie obywatelstwo (js/nationality.js)
const MIN_DOMESTIC = 4;
// Licencja przed 16. urodzinami (egzamin od 15 lat): tylko zawody z udziałem zawodników U-21 – bez ligi i zawodów seniorskich
const u16 = (r, date = G.date) => !!(r && r.born && ageAt(r.born, date) < 16);
const leagueFrom = r => `${Number(r.born.slice(0, 4)) + 16}${r.born.slice(4)}`; // 16. urodziny – od tego dnia liga
// date – dzień meczu: licencja przed 16. urodzinami liczy się na dzień zawodów, nie awizacji
const slotOk = (r, i, lg, date = G.date) => !!r && !u16(r, date) && (i === 5 || i === 6 ? isJunior(r) && (isDomestic(r) || (lg || (G.clubs[r.clubId] || {}).league) === 'PGE') : i === 7 ? isU24(r) : true);
// Co najmniej 4 Polaków na numerach 1–7 (i w PGE co najmniej jeden polski junior na 6–7): braki zastępują najlepsi wolni Polacy,
// bez łamania wymogu U24 na numerach 1–5. Gdy klub nie ma dość Polaków, skład zostaje jaki jest.
function enforceDomestic(line, rs, lg, strength) {
  const rid = id => G.riders[id];
  const free = () => rs.filter(r => !line.includes(r.id) && isDomestic(r));
  if (lg === 'PGE' && [5, 6].every(i => line[i] && !isDomestic(rid(line[i])))) {
    const j = free().filter(r => isJunior(r)).sort(by(strength, -1))[0];
    if (j) line[[5, 6].sort(by(i => strength(rid(line[i]))))[0]] = j.id;
  }
  for (let guard = 0; guard < 7 && line.slice(0, 7).filter(id => id && isDomestic(rid(id))).length < MIN_DOMESTIC; guard++) {
    const cand = free().sort(by(strength, -1));
    if (!cand.length) break;
    const empty = [0, 1, 2, 3, 4].find(i => !line[i]);
    if (empty != null) { line[empty] = cand[0].id; continue; }
    const u24n = line.slice(0, 5).filter(id => id && isU24(rid(id))).length;
    let done = false;
    for (const i of [0, 1, 2, 3, 4].filter(i => !isDomestic(rid(line[i]))).sort(by(i => strength(rid(line[i]))))) {
      const keepU = isU24(rid(line[i])) && u24n <= 1;
      const c = cand.find(r => !keepU || isU24(r));
      if (c) { line[i] = c.id; done = true; break; }
    }
    if (!done) break;
  }
  return line;
}
// Brak U24 na numerach 1–5: najsłabszego z nich zastępuje najlepszy wolny zawodnik U24
function ensureU24(line, rs, strength) {
  if (line.slice(0, 5).some(id => id && isU24(G.riders[id]))) return line;
  const free = rs.filter(r => isU24(r) && !line.includes(r.id)).sort(by(strength, -1))[0];
  if (!free) return line;
  const idx = [0, 1, 2, 3, 4].filter(i => line[i]).sort(by(i => strength(G.riders[line[i]])))[0];
  line[idx ?? line.slice(0, 5).indexOf(null)] = free.id;
  return line;
}
// Obsada numerów 1–5: wystarczy 5 zawodników – seniorów albo juniorów ponad dwóch potrzebnych na numery 6–7
const slots15 = list => list.length - Math.min(list.filter(r => isJunior(r)).length, 2);
// Puste numery 1–7 w najlepszym możliwym składzie klubu na dany dzień (brak w składzie = numer, którego nie da się obsadzić)
const lineupGaps = (clubId, date = G.date) => autoLineup(clubId, date).slice(0, 7).map((id, i) => (id ? null : i)).filter(i => i != null);
function autoLineup(clubId, date = G.date) {
  const strength = r => r.skill + r.form * 0.3;
  const rs = clubRiders(clubId).filter(r => available(r, date) && !fimBusy(r, date) && !u16(r, date)).sort(by(strength, -1)); // startujący tego dnia w zawodach FIM nie jadą
  const used = new Set(), take = r => { if (r) used.add(r.id); return r ? r.id : null; };
  const line = new Array(8).fill(null);
  const lg = (G.clubs[clubId] || {}).league;
  // juniorzy 6–7 (poza PGE tylko polscy)
  const juniors = rs.filter(r => slotOk(r, 5, lg, date));
  line[5] = take(juniors[0]); line[6] = take(juniors[1]);
  // seniorzy 1–5 (najlepsi pozostali), potem rezerwa 8 – najlepszy wolny U24
  rs.filter(r => !used.has(r.id)).slice(0, 5).forEach((r, i) => { line[i] = take(r); });
  ensureU24(line, rs, strength);
  used.clear(); line.forEach(id => id && used.add(id));
  line[7] = take(rs.find(r => !used.has(r.id) && isU24(r)));
  // uzupełnienie braków zawodnikami spełniającymi warunki numeru
  for (let i = 0; i < 8; i++) if (!line[i]) line[i] = take(rs.find(r => !used.has(r.id) && slotOk(r, i, lg, date)));
  return enforceDomestic(line, rs, lg, strength);
}
function validLineup(clubId, line, date = G.date) {
  if (!line || line.length !== 8) return autoLineup(clubId, date);
  const auto = autoLineup(clubId, date), used = new Set(), lg = (G.clubs[clubId] || {}).league;
  const out = line.map((id, i) => { const r = G.riders[id]; if (r && r.clubId === clubId && !u16(r, date) && ((available(r, date) && !fimBusy(r, date)) || (i < 5 && zzEligible(r, clubId, date))) && !used.has(id) && slotOk(r, i, lg, date)) { used.add(id); return id; } return null; });
  for (let i = 0; i < 8; i++) if (!out[i]) { const f = auto.find(id => id && !used.has(id) && slotOk(G.riders[id], i, lg, date)) || clubRiders(clubId).map(r => r.id).find(id => !used.has(id) && available(G.riders[id], date) && !fimBusy(G.riders[id], date) && slotOk(G.riders[id], i, lg, date)); if (f) { out[i] = f; used.add(f); } }
  const rs = clubRiders(clubId).filter(r => available(r, date) && !fimBusy(r, date) && !u16(r, date)), strength = r => r.skill + r.form * 0.3;
  return enforceDomestic(ensureU24(out, rs, strength), rs, lg, strength);
}

// ---------- Warunki ----------
function weatherFor(date, seed) {
  const m = Number(date.slice(5, 7));
  const r = mulberry(hashStr(seed + date))();
  // pogoda dnia w Polsce (js/schedule.js: rozkład sezonowy, kilkudniowe układy) + lokalne warunki w czasie zawodów
  if (typeof dayWeather === 'function' && G) {
    const w = dayWeather(date);
    const temp = Math.round(w.temp + 4 + (r - 0.5) * 3); // wieczorne zawody w ciepłej części dnia
    const rain = w.wet && r < 0.3;
    return { temp, rain, sky: rain ? 'deszcz' : w.wet ? 'pochmurno' : r < 0.4 ? 'zachmurzenie umiarkowane' : 'słonecznie', track: rain ? 'mokry' : r > 0.85 ? 'twardy, szybki' : 'przyczepny' };
  }
  const temp = Math.round([2, 3, 8, 13, 18, 21, 23, 23, 18, 12, 6, 3][m - 1] + (r - 0.5) * 8);
  const rain = r < 0.1;
  return { temp, rain, sky: rain ? 'deszcz' : r < 0.35 ? 'pochmurno' : r < 0.6 ? 'zachmurzenie umiarkowane' : 'słonecznie', track: rain ? 'mokry' : r > 0.85 ? 'twardy, szybki' : 'przyczepny' };
}

// ---------- Bieg ----------
// Styl jazdy: odchylenie atrybutu od poziomu zawodnika (poziom liczy się raz – przez umiejętności)
const styleDev = (r, k) => (r.attrs[k] ?? r.skill) - r.skill;
function riderHeatPerf(r, { homeClubId, wet, day, eng, len, temp, fx, fam = 1 }) {
  // sprzęt: silnik wybrany na ten bieg (tor, przyczepność nawierzchni, dopasowanie, mechanicy) albo ogólna ocena parku maszyn
  const eq = eng ? engineValue(eng, r, { track: len, grip: fx.G, wet, homeClubId, temp }) : equipRating(r);
  let base = r.skill + (eq - 75) / 25 + r.form * 0.45 + (r.cond - 85) / 30;
  // atut własnego toru: pełny, gdy tor jest przygotowany jak na co dzień (js/track.js: trackFamiliarity)
  if (r.clubId === homeClubId) base += ((typeof HEAT_MODEL !== 'undefined' && !HEAT_MODEL.legacy ? HEAT_MODEL.homeU / HEAT_MODEL.beta : 0.35) + (staffBest(homeClubId, 'track') - 10) * 0.02) * fam; // przewaga gospodarza z protokołów (js/heat-model.js)
  if (wet) base += styleDev(r, 'surfaces') * 0.08 + styleDev(r, 'adaptability') * 0.03;
  else base += styleDev(r, 'surfaces') * 0.04 * fx.surfW; // tor odbiegający od przyczepnego, koleiny
  base += styleDev(r, 'setup') * 0.03;
  if (day) base += dayForm(r, day); // forma dnia – zależy od powtarzalności
  if (typeof rhythmMod === 'function') base += rhythmMod(r); // rytm zawodów: „rdza” albo przeciążenie startami (js/schedule.js)
  return base;
}
// Losowość biegu: skala szumu startu i dystansu (kalibracja do średnich Ekstraligi 2025 i wyników rund SGP – tools/calibrate-heats.js)
// 2,7: nachylenie średnich symulacja/PSD 2025 ≈ 1, rozrzut średnich ≈ realny, zwycięzca rundy GP – mediana 13 pkt w 20 biegach (jak w SGP 2025)
let HEAT_NOISE = 2.7;
function runHeat(entries, ctx) {
  // entries: [{ riderId, team, gate, helmet, slot }]
  const wet = ctx.weather && ctx.weather.rain;
  const live = entries.filter(e => e.riderId && R(e.riderId));
  const log = [];
  // stan toru (js/track.js): przyczepność pasów, koleiny; pola startowe – według pasów pod polami
  const S = ctx.surf || legacySurf(ctx.weather), fx = surfFx(S), gateBonus = fx.gate;
  const day = ctx.mid || (ctx.weather ? JSON.stringify(ctx.weather) : '') + ctx.homeClubId;
  for (const e of live) {
    const r = R(e.riderId), a = r.attrs;
    // silnik na bieg: wybór gracza (ctx.pick) albo zawodnika; wyłączone w tych zawodach maszyny pomija (js/equipment.js)
    // wiedza drużyny o torze (próba toru) zmniejsza błąd wyboru silnika
    const know = ctx.know && e.team && ctx.know[e.team] != null ? ctx.know[e.team] : 0.5;
    e.eng = pickEngine(r, { track: ctx.track, grip: fx.G, wet, know, temp: ctx.weather && ctx.weather.temp, homeClubId: ctx.homeClubId, mid: ctx.mid, pick: ctx.pick ? ctx.pick[e.riderId] : null });
    if (ctx.mid && e.eng) { e.bike = bikeLetter(ctx.mid, e.riderId, e.eng); e.engId = e.eng.id; } // motocykl A/B/C (js/equipment.js)
    e.perf = riderHeatPerf(r, { homeClubId: ctx.homeClubId, wet, day, eng: e.eng, len: ctx.track, temp: ctx.weather && ctx.weather.temp, fx, fam: S.fam ?? 1 });
    e.startScore = e.perf * 0.5 + a.start * 0.13 * fx.startW + a.reflexes * 0.05 + a.concentration * 0.03 + a.firstBend * 0.04 + gateBonus[e.gate] * 2 + gauss(1.35 * HEAT_NOISE);
    e.status = '';
    const pTape = 0.007 * (1.4 - (a.concentration + a.discipline) / 40);
    const pDef = defectChance(e.eng, r);
    const pFall = 0.018 * (0.65 + (a.aggression + a.bravery) / 80) * (wet ? 1.6 : 1) * (1.2 - a.balance / 50) * fx.fallK;
    const x = rnd();
    if (x < pTape) e.status = 't';
    else if (x < pTape + pDef) e.status = 'd';
    else if (x < pTape + pDef + pFall) e.status = chance(0.3 + (20 - a.discipline) / 80) ? 'w' : 'u';
  }
  // meta: model Plackett–Luce (js/heat-model.js, protokoły lig szwedzkich) – u = beta·(forma dnia + styl jazdy + start) + pole,
  // kolejność według u + szum Gumbela; głęboki, koleinowy tor – więcej losowości (fx.noiseK)
  const M = HEAT_MODEL;
  const racing = live.filter(e => e.status !== 't');
  if (M.legacy) { // dawny silnik: kolejność po starcie + premia za pozycję + szum normalny (porównania jakości modelu)
    const so = racing.slice().sort(by(e => e.startScore, -1)), bonus = [0.95, 0.45, 0.15, 0].map(x => x * fx.bonusK);
    so.forEach((e, i) => { const r = R(e.riderId); e.race = e.perf + bonus[i] + gauss(1.15 * HEAT_NOISE * fx.noiseK) + (i > 0 ? styleDev(r, 'passing') * 0.06 * fx.passK : styleDev(r, 'defending') * 0.05); });
  } else for (const e of racing) {
    const r = R(e.riderId), a = r.attrs;
    const style = styleDev(r, 'passing') * 0.03 * fx.passK + styleDev(r, 'fighting') * 0.015 + styleDev(r, 'defending') * 0.025 + styleDev(r, 'throttle') * 0.025
      + styleDev(r, 'outside') * 0.008 * fx.outK + styleDev(r, 'inside') * 0.008 * fx.inK + styleDev(r, 'slide') * 0.02 + styleDev(r, 'lines') * 0.02
      + (a.start * 0.13 * fx.startW + a.reflexes * 0.05 + a.firstBend * 0.04 - r.skill * 0.22) * 0.25; // start: odchylenie od ogólnego poziomu
    const u = M.beta * (e.perf + style) + (M.gate[e.gate] || 0) + M.track * ((gateBonus[e.gate] ?? GATE_BASE[e.gate]) - GATE_BASE[e.gate]);
    e.race = u / fx.noiseK - Math.log(-Math.log(Math.min(1 - 1e-12, Math.max(1e-12, rnd()))));
  }
  // kolejność po pierwszym łuku (relacja biegu): meta z szumem – na twardym torze start decyduje, na głębokim więcej mijanek
  const startOrder = racing.slice().sort(by(e => e.race + gauss(0.75 * fx.passK / Math.max(0.5, fx.bonusK)) + e.startScore * 0.02, -1));
  startOrder.forEach((e, i) => { e.startPos = i + 1; });
  const finishers = startOrder.filter(e => !e.status).sort(by(e => e.race, -1));
  const out = live.filter(e => e.status);
  const name = e => R(e.riderId).name;
  if (startOrder.length) log.push(`Start: najszybciej spod taśmy ${pick(['wyszedł', 'wystartował', 'wyrwał'])} ${name(startOrder[0])} (pole ${startOrder[0].gate}).`);
  for (const e of live.filter(x => x.status === 't')) log.push(`${name(e)} dotknął taśmy – wykluczenie, bieg powtórzony bez niego.`);
  // mijanki
  const order0 = startOrder.filter(e => !e.status).map(e => e.riderId);
  let passes = 0;
  finishers.forEach((e, i) => {
    const was = order0.indexOf(e.riderId);
    if (was > i) {
      passes += was - i;
      const passed = order0[i];
      const r = R(e.riderId);
      const how = r.attrs.outside >= r.attrs.inside ? pick(['po zewnętrznej', 'szeroką linią po zewnętrznej', 'z impetem po zewnętrznej']) : pick(['przy krawężniku', 'po wewnętrznej', 'ciasno przy krawężniku']);
      log.push(`${rint(1, 4)}. okrążenie: ${name(e)} ${pick(['awansuje', 'przebija się', 'wychodzi'])} na ${i + 1}. pozycję ${how} (mija: ${R(passed).name}).`);
    }
  });
  for (const e of out) {
    const lap = rint(1, 4);
    if (e.status === 'd') log.push(`Defekt motocykla${e.bike && e.bike !== 'P' ? ` ${e.bike}` : ''} ${name(e)} na ${lap}. okrążeniu (silnik ${engLabel(e.eng)}).`);
    if (e.status === 'u') log.push(`Upadek ${name(e)} na ${rint(1, 4)}. łuku ${lap}. okrążenia.`);
    if (e.status === 'w') log.push(`${name(e)} upada po kontakcie z rywalem – sędzia wyklucza go z biegu.`);
  }
  // punkty
  const res = [];
  finishers.forEach((e, i) => res.push({ riderId: e.riderId, team: e.team, pos: i + 1, pts: (ctx.points || [3, 2, 1, 0])[i], bonus: 0, status: '' }));
  for (const e of out) res.push({ riderId: e.riderId, team: e.team, pos: null, pts: 0, bonus: 0, status: e.status });
  for (let i = 1; i < finishers.length; i++) {
    const cur = res[i], prev = res[i - 1];
    if (cur.team != null && cur.team === prev.team && cur.pts > 0 && prev.pos === cur.pos - 1) cur.bonus = 1;
  }
  // czas
  const track = ctx.track || 350;
  let time = null;
  if (finishers.length) {
    time = round2(track * 0.171 - (R(finishers[0].riderId).skill - 10) * 0.13 + gauss(0.35) + (wet ? 1.9 : fx.time));
    const w = res[0];
    const t = { H: 0, A: 0 }; res.forEach(x => { if (x.team) t[x.team] += x.pts; });
    log.push(`Wygrywa ${R(w.riderId).name}, czas ${time.toFixed(2).replace('.', ',')} s.${ctx.team ? ` Bieg ${t.H}:${t.A}.` : ''}`);
  }
  // zużycie sprzętu, zmęczenie, kontuzje
  const injuries = [];
  for (const e of live) {
    const r = R(e.riderId);
    heatEquipment(e, r, ctx, log); // zużycie, naprawy w parku maszyn, uszkodzenia po upadku
    r.cond = clamp(r.cond - 2.2 + r.attrs.stamina * 0.05, 40, 100);
    if ((e.status === 'u' || e.status === 'w') && chance(0.2 * (1.3 - r.attrs.balance / 40) * (1.25 - (r.attrs.resilience ?? 10) / 40) * (1 + Math.max(0, 85 - (r.cond ?? 100)) / 40))) injuries.push(e.riderId);
  }
  if (ctx.surf) surfAfterHeat(ctx.surf, ctx.weather, live.length); // tor po biegu: materiał na zewnętrzną, wysychanie, koleiny
  return { res, time, log, injuries, passes };
}

// ---------- Mecz ligowy ----------
function createMatch(fx) {
  const home = G.clubs[fx.homeId], away = G.clubs[fx.awayId];
  const id = `X${fx.id}`;
  // kluby AI: kontuzjowany lider jako zawodnik zastępowany (art. 711); gracz – jeśli wpisał go do składu w Taktyce
  const hl = fx.homeId === G.clubId && G.lineups[G.clubId] ? validLineup(fx.homeId, G.lineups[G.clubId], fx.date) : finalLineup(fx.homeId, fx);
  const al = fx.awayId === G.clubId && G.lineups[G.clubId] ? validLineup(fx.awayId, G.lineups[G.clubId], fx.date) : finalLineup(fx.awayId, fx);
  const m = {
    id, kind: 'league', fixtureId: fx.id, date: fx.date, homeId: home.id, awayId: away.id, venue: home.stadium.name, track: home.stadium.track,
    weather: weatherFor(fx.date, G.seed), lineup: { A: al, H: hl }, heats: [], score: { H: 0, A: 0 }, subs: { H: 0, A: 0 }, done: false,
    heatTableId: 'league-15-set-' + (1 + hashStr(id) % 2), heatTableVersion: SPEEDWAY_HEAT_TABLES.schemaVersion, attendance: null, nominations: {}, riders: {},
  };
  for (const t of ['A', 'H']) m.lineup[t].forEach((rid, i) => { if (rid) m.riders[rid] = { team: t, no: t === 'A' ? i + 1 : i + 9, pts: 0, bonus: 0, heats: 0, line: [], ...(i < 5 && (!available(G.riders[rid], fx.date) || fimBusy(G.riders[rid], fx.date)) ? { zz: true } : {}) }; });
  G.matches[id] = m;
  fx.matchId = id;
  // przygotowanie toru (gospodarz) i próba toru – zawodnicy wskazani przez trenera albo AI (js/track.js)
  const sel = G.trackTest && G.trackTest[fx.id], mine = fx.homeId === G.clubId ? 'H' : fx.awayId === G.clubId ? 'A' : null;
  teamMeetingTrack(m, { planKey: fx.id, testers: mine && sel ? { [mine]: sel } : null });
  const lost = ['H', 'A'].filter(t => !teamCanStart(m, t));
  if (lost.length) return walkoverMatch(m, fx, lost); // drużyna nie spełnia warunków przystąpienia do meczu (art. 713)
  return m;
}
function slotRider(m, no) { return no <= 8 ? m.lineup.A[no - 1] : m.lineup.H[no - 9]; }
function heatEntries(m, idx) {
  // In-progress legacy matches finish using their original program.
  if (!m.heatTableId && !m.heats.length) m.heatTableId = 'league-15-set-' + (1 + hashStr(m.id) % 2);
  if (m.heatTableId) return leagueTableEntries(m, idx);
  if (idx < 13) {
    const nos = PROGRAM[idx];
    const odd = idx % 2 === 0;
    const gates = odd ? { A: ['B', 'D'], H: ['A', 'C'] } : { A: ['A', 'C'], H: ['B', 'D'] };
    return nos.map((no, k) => {
      const team = no <= 8 ? 'A' : 'H', j = k % 2;
      return { slot: no, riderId: slotRider(m, no), team, gate: gates[team][j], helmet: HELMET[team][j] };
    });
  }
  const nom = m.nominations[idx] || nominate(m, idx);
  m.nominations[idx] = nom;
  const gates = idx === 13 ? { A: ['A', 'C'], H: ['B', 'D'] } : { A: ['B', 'D'], H: ['A', 'C'] };
  return ['A', 'H'].flatMap(team => nom[team].map((rid, j) => ({ slot: m.riders[rid] ? m.riders[rid].no : null, riderId: rid, team, gate: gates[team][j], helmet: HELMET[team][j] })));
}
// Nominacje do biegów 14 (3. i 4. zawodnik meczu) i 15 (dwóch najlepszych) – spośród seniorów 1–5 i nr 8
function nominate(m, idx, team) {
  if (m.nominationRanking?.[idx]) {
    const frozen = m.nominationRanking[idx];
    return team ? frozen[team].slice() : { A: frozen.A.slice(), H: frozen.H.slice() };
  }
  // art. 722: do XV dwaj najlepsi z numerów 1–5, do XIV pozostali; w ich miejsce rezerwa zwykła (nr 6–8, np. junior z największą liczbą
  // punktów jedzie w XV za słabszego z dwóch najlepszych seniorów). Najpierw obsada XV (najskuteczniejsi w meczu), potem XIV z pozostałych
  const form = rid => m.riders[rid].pts + m.riders[rid].bonus * 0.5 + G.riders[rid].skill * 0.05;
  const pickTeam = t => {
    const o15 = nominationOptions(m, 14, t), xv = [...o15.seniors, ...o15.reserves].sort(by(form, -1)).slice(0, 2);
    if (idx === 14) return xv;
    const o14 = nominationOptions(m, 13, t);
    return [...o14.seniors, ...o14.reserves].filter(rid => !xv.includes(rid)).sort(by(form, -1)).slice(0, 2);
  };
  if (team) return pickTeam(team);
  return { A: pickTeam('A'), H: pickTeam('H') };
}
// Kogo drużyna może zgłosić do biegu XIV (idx 13) / XV (idx 14) – art. 721–722: numery 1–5 klasyfikowane według punktów;
// do XV dwaj najlepsi, do XIV pozostali; w obu biegach w ich miejsce rezerwa zwykła (nr 6–8), jeśli ma wolny start
// (zagraniczny nr 8 tylko za zawodnika do lat 24 – art. 718 ust. 5)
function nominationOptions(m, idx, team) {
  const line = m.lineup[team], ok = rid => rid && canStart(m, rid) && !G.riders[rid].injury;
  const ranked = line.slice(0, 5).filter(rid => rid && !m.riders[rid].out && !m.riders[rid].zz).sort(by(rid => m.riders[rid].pts, -1));
  const xiv = idx === 14 ? ((m.nominations[13] || {})[team] || []) : [];
  const seniors = (idx === 14 ? ranked.slice(0, 2) : ranked.slice(2)).filter(rid => ok(rid) && !xiv.includes(rid));
  const pool = idx === 14 ? ranked.slice(0, 2) : ranked.slice(2);
  const reserves = line.slice(5, 8).filter(rid => ok(rid) && !xiv.includes(rid) && pool.some(t => subOk(m, team, rid, t)));
  return { seniors, reserves };
}
// ---------- Rezerwy w meczu (regulamin art. 718–720) ----------
// Starty zawodnika: 5 + 1 jako rezerwa taktyczna (rt) + 1 jako rezerwa zastępująca (rz); każdą z tych rezerw – raz w meczu
const BASE_STARTS = 5;
function canStart(m, rid, kind = '') {
  const s = m.riders[rid];
  if (!s || s.out || s.zz) return false;
  if ((kind === 'rt' && s.rt) || (kind === 'rz' && s.rz)) return false;
  const extra = (s.rt ? 1 : 0) + (s.rz ? 1 : 0) + (kind === 'rt' || kind === 'rz' ? 1 : 0);
  return s.heats < BASE_STARTS + extra;
}
// Czy `inId` może zastąpić `outId` (art. 718 ust. 3–5): za juniorów 6–7 tylko juniorzy 6–7 albo krajowy junior z numerem 8;
// zagraniczny zawodnik z numerem 8 – tylko za zawodnika do lat 24, a za krajowego U24 tylko przy ≥ 3 krajowych na numerach 1–5
function subOk(m, team, inId, outId) {
  const line = m.lineup[team], si = line.indexOf(inId), ti = outId ? line.indexOf(outId) : -1;
  if (si < 0 || inId === outId) return false;
  const S = G.riders[inId], T = outId ? G.riders[outId] : null, cid = team === 'H' ? m.homeId : m.awayId;
  if ((ti === 5 || ti === 6) && !(si === 5 || si === 6 || (si === 7 && isJunior(S) && isDomestic(S, cid)))) return false;
  if (si === 7 && !isDomestic(S, cid)) {
    if (!T || !isU24(T)) return false;
    if (isDomestic(T, cid) && line.slice(0, 5).filter(id => id && isDomestic(G.riders[id], cid)).length < 3) return false;
  }
  return true;
}
const subNote = (m, idx, txt) => { m.heatsNote = m.heatsNote || {}; m.heatsNote[idx] = m.heatsNote[idx] ? `${m.heatsNote[idx]}; ${txt}` : txt; };
// Zawodnicy startujący danego dnia w zawodach FIM (SGP, SGP2, DPŚ, SoN…) lub w finale IME (SEC) – art. 712
let FIM_BUSY = { date: null, ids: null };
function fimBusySet(date) {
  if (FIM_BUSY.date === date && FIM_BUSY.ids) return FIM_BUSY.ids;
  const ids = new Set();
  for (const e of Object.values(G.events || {})) {
    if (e.date !== date) continue;
    if (e.kind === 'sgp') { (G.sgp && G.sgp.season === e.season ? G.sgp.riders : []).forEach(id => ids.add(String(id))); continue; }
    const c = typeof compOf === 'function' && e.kind === 'comp' ? compOf(e) : null;
    if (!c || !(c.group === 'swiat' || e.comp === 'SEC')) continue;
    (e.startList || []).forEach(x => ids.add(String(x.id)));
    (e.units || []).forEach(u => u.riders.forEach(id => ids.add(String(id))));
  }
  FIM_BUSY = { date, ids };
  return ids;
}
const fimBusy = (r, date) => !!r && fimBusySet(date).has(String(r.id));
// Zawodnik zastępowany: art. 711 – jeden z dwóch najlepszych w klubie na zwolnieniu lekarskim (≥ 15 dni);
// art. 712 – jeden z pięciu najlepszych, który tego dnia startuje w zawodach FIM lub w finale SEC (średnią indywidualną przybliża poziom zawodnika)
function zzEligible(r, clubId, date) {
  if (!r) return false;
  const rank = clubRiders(clubId).filter(x => !x.retired).sort(by(x => x.skill, -1)).findIndex(x => x.id === r.id);
  if (rank < 0) return false;
  const inj = r.injury && G.injuries[r.injury];
  if (inj && inj.until >= date && dayDiff(inj.start, inj.until) >= 15 && rank < 2) return true;
  return rank < 5 && fimBusy(r, date);
}
// Klub AI zgłasza kontuzjowanego lidera jako zawodnika zastępowanego w miejsce najsłabszego seniora (jeśli lider jest lepszy)
function addZZ(clubId, line, date) {
  const zz = clubRiders(clubId).filter(r => !line.includes(r.id) && zzEligible(r, clubId, date)).sort(by(r => r.skill, -1))[0];
  if (!zz) return line;
  const u24 = line.slice(0, 5).filter(id => id && isU24(G.riders[id])).length;
  const slot = [0, 1, 2, 3, 4].filter(i => !line[i] || !(isU24(G.riders[line[i]]) && u24 <= 1) && (isDomestic(G.riders[line[i]], clubId) ? isDomestic(zz, clubId) || line.slice(0, 7).filter(id => id && isDomestic(G.riders[id], clubId)).length > MIN_DOMESTIC : true))
    .sort(by(i => line[i] ? G.riders[line[i]].skill : -1))[0];
  if (slot != null && (!line[slot] || G.riders[line[slot]].skill < zz.skill - 1)) line[slot] = zz.id;
  return line;
}

// ---------- Awizowanie składów ligowych ----------
// Art. 48 ust. 2 RZMoT: składy na mecz ligowy przesyła się najpóźniej 3 dni przed meczem (gość do 14:00, gospodarz do 15:00).
// Art. 710 ust. 4 regulaminów DMP, 2. Ekstraligi i DM II Ligi: w zgłoszeniu do zawodów (90 min przed meczem) najwyżej trzy zmiany
// nazwisk względem awizowanego składu, bez zamian numerów startowych. Zmiana: inny zawodnik pod numerem albo wpis pod pustym numerem
// (poza rezerwą nr 8 – art. 48 ust. 5 pkt 2).
const NOTIFY_DAYS = 3, MAX_LINE_CHANGES = 3;
// Skład ustawiony w Taktyce zostaje do odwołania: zmiana klubu zawodnika usuwa tylko jego, nie cały skład
function dropFromLineups(riderId) { for (const [cid, l] of Object.entries(G.lineups || {})) if (Array.isArray(l) && l.includes(riderId)) G.lineups[cid] = l.map(x => (x === riderId ? null : x)); }
const notifyDate = fx => addDays(fx.date, -NOTIFY_DAYS);
const notifiedLine = (fx, clubId) => (fx && fx.notified && fx.notified[clubId]) || null;
function lineChanges(base, line) {
  let n = 0;
  for (let i = 0; i < 8; i++) { const a = base[i] || null, b = line[i] || null; if (b && a !== b && !(i === 7 && !a)) n++; }
  return n;
}
// Zamiana numerów: zawodnik z awizowanego składu pod innym numerem niż awizowany
const numberSwap = (base, line) => line.some((id, i) => id && base.includes(id) && base[i] !== id);
// Błędy, przy których składu nie da się awizować: zawodnik spoza kadry albo na numerze, na którym jechać nie może
function lineupBlocking(clubId, line, date = G.date) {
  const out = [], lg = (G.clubs[clubId] || {}).league;
  line.forEach((id, i) => {
    const r = G.riders[id];
    if (!id) return;
    if (!r || r.clubId !== clubId) out.push(`Nr ${i + 1}: zawodnik spoza kadry klubu.`);
    else if (!slotOk(r, i, lg, date)) out.push(`Nr ${i + 1}: ${r.name} nie spełnia warunków numeru.`);
  });
  return out;
}
// Skutki niepełnego składu (art. 48 i 713 regulaminów lig): awizacja < 6 zawodników – przewinienie dyscyplinarne klubu;
// w dniu meczu < 6 obecnych (5 z zawodnikiem zastępowanym) lub bez juniora z nr 6–7 – walkower
function lineupConsequences(clubId, line) {
  const out = [], n = line.filter(Boolean).length;
  if (n < 6) out.push(`Skład liczy ${n} ${plural(n, 'zawodnika', 'zawodników', 'zawodników')}: podanie składu poniżej 6 zawodników to przewinienie dyscyplinarne klubu.`);
  if (n < 6 || !(line[5] || line[6])) out.push(`Jeśli w dniu meczu w drużynie nie będzie co najmniej 6 zawodników (5 z zawodnikiem zastępowanym), w tym juniora z numerów 6–7 – walkower: 0 pkt, −40 pkt biegowych i odszkodowanie (${fmtMoney(WALKOVER_FEE[(G.clubs[clubId] || {}).league || 'KLZ'].opp + WALKOVER_FEE[(G.clubs[clubId] || {}).league || 'KLZ'].league, true)}).`);
  return out;
}
// Braki w składzie (ostrzeżenia w Taktyce; numery 1–7 obowiązkowe, nr 8 – rezerwa U24 opcjonalna)
function lineupProblems(clubId, line, date) {
  const out = [], lg = (G.clubs[clubId] || {}).league;
  const empty = [0, 1, 2, 3, 4, 5, 6].filter(i => !line[i]).map(i => i + 1);
  if (empty.length) out.push(`Puste numery: ${empty.join(', ')} (numery 1–7 są obowiązkowe).`);
  line.forEach((id, i) => {
    const r = G.riders[id];
    if (!id) return;
    if (!r || r.clubId !== clubId) { out.push(`Nr ${i + 1}: zawodnik spoza kadry klubu.`); return; }
    if (!slotOk(r, i, lg, date)) out.push(`Nr ${i + 1}: ${r.name} nie spełnia warunków numeru.`);
    else if (!(available(r, date) && !fimBusy(r, date)) && !(i < 5 && zzEligible(r, clubId, date))) out.push(`Nr ${i + 1}: ${r.name} jest niedostępny w dniu meczu.`);
  });
  if (line.some(Boolean) && !line.slice(0, 5).some(id => id && isU24(G.riders[id]))) out.push('Na numerach 1–5 musi jechać co najmniej jeden zawodnik U24.');
  const dom = line.slice(0, 7).filter(id => id && G.riders[id] && isDomestic(G.riders[id], clubId)).length;
  if (line.some(Boolean) && dom < MIN_DOMESTIC) out.push(`Na numerach 1–7 musi jechać co najmniej ${MIN_DOMESTIC} zawodników krajowych (teraz ${dom}).`);
  if (lg === 'PGE' && (line[5] || line[6]) && !line.slice(5, 7).some(id => id && G.riders[id] && isDomestic(G.riders[id], clubId))) out.push('Na numerach 6–7 musi jechać co najmniej jeden polski junior.');
  return out;
}
// Kluby AI awizują skład w terminie (najlepszy skład na dzień meczu)
function notifyLineups() {
  for (const fx of Object.values(G.fixtures)) {
    if (fx.played || G.date < notifyDate(fx) || G.date > fx.date) continue;
    fx.notified = fx.notified || {};
    for (const cid of [fx.homeId, fx.awayId]) if (cid !== G.clubId && !fx.notified[cid]) fx.notified[cid] = autoLineup(cid, fx.date);
  }
}
// Mecz gracza, na który minął termin awizacji, a skład nie został podany – upływ czasu czeka na decyzję gracza
function pendingNotify() {
  return Object.values(G.fixtures).filter(fx => !fx.played && (fx.homeId === G.clubId || fx.awayId === G.clubId) && G.date >= notifyDate(fx) && !notifiedLine(fx, G.clubId))
    .sort(by(fx => fx.date))[0] || null;
}
// Walkower (art. 713–715 PGE, 763–765 2. Ekstraligi, 1162–1164 DM II Ligi): odszkodowanie dla rywala i dla organizatora rozgrywek
const WALKOVER_FEE = { PGE: { opp: 300000, league: 150000, to: 'Ekstraliga Żużlowa' }, '2E': { opp: 150000, league: 75000, to: 'Ekstraliga Żużlowa' }, KLZ: { opp: 50000, league: 80000, to: 'PZM' } };
// Czy drużyna może przystąpić do meczu: co najmniej 6 obecnych i uprawnionych (5, gdy jest zawodnik zastępowany), w tym junior z nr 6–7
function teamCanStart(m, t) {
  const clubId = t === 'H' ? m.homeId : m.awayId, line = m.lineup[t] || [];
  const here = id => { const r = G.riders[id]; return !!r && r.clubId === clubId && available(r, m.date) && !fimBusy(r, m.date); };
  const zz = line.slice(0, 5).some(id => id && !here(id) && zzEligible(G.riders[id], clubId, m.date));
  const present = line.filter(id => id && here(id)).length;
  return present >= (zz ? 5 : 6) && line.slice(5, 7).some(id => id && here(id));
}
function walkoverMatch(m, fx, lost) {
  const both = lost.length === 2, loser = both ? null : lost[0];
  m.done = true; m.walkover = both ? 'both' : loser; m.heats = [];
  m.score = both ? { H: 0, A: 0 } : loser === 'H' ? { H: 0, A: 40 } : { H: 40, A: 0 };
  fx.played = true; fx.homePts = m.score.H; fx.awayPts = m.score.A; fx.walkover = m.walkover;
  const fee = WALKOVER_FEE[fx.league] || WALKOVER_FEE.KLZ;
  for (const t of lost) {
    const cid = t === 'H' ? m.homeId : m.awayId, opp = t === 'H' ? m.awayId : m.homeId, c = G.clubs[cid];
    if (!both) { addTx(cid, 'kary', -fee.opp, `Walkower: odszkodowanie dla ${G.clubs[opp].name}`); addTx(opp, 'kary', fee.opp, `Walkower: odszkodowanie od ${c.name}`); }
    addTx(cid, 'kary', -(both ? fee.opp : fee.league), `Walkower: odszkodowanie dla ${fee.to}`);
  }
  const mine = [m.homeId, m.awayId].includes(G.clubId);
  if (mine) {
    const myT = m.homeId === G.clubId ? 'H' : 'A', weLost = lost.includes(myT);
    addMsg({ category: 'mecz', from: 'GKSŻ', stop: true, title: `Walkower: ${G.clubs[m.homeId].short} ${m.score.H}:${m.score.A} ${G.clubs[m.awayId].short}`,
      body: `<p>${weLost ? 'Nasza drużyna nie spełniła' : 'Drużyna rywala nie spełniła'} warunków przystąpienia do meczu: co najmniej 6 obecnych zawodników (5 z zawodnikiem zastępowanym), w tym junior z numerów 6–7.</p>
        <p>${both ? 'Wzajemny walkower: obie drużyny 0 pkt i −40 pkt biegowych.' : weLost ? `Walkower dla rywala: 0 pkt, −40 pkt biegowych, bez punktu bonusowego w dwumeczu. Odszkodowania: ${fmtMoney(fee.opp)} dla rywala i ${fmtMoney(fee.league)} dla ${fee.to}.` : `Walkower na naszą korzyść: 2 pkt i +40 pkt biegowych, odszkodowanie ${fmtMoney(fee.opp)}.`}</p>`, link: `#/zawody/${fx.id}` });
  }
  return m;
}
// Skład AI na dzień meczu: awizowany, a za niedostępnych zawodników najwyżej trzy zmiany
function finalLineup(clubId, fx) {
  const base = notifiedLine(fx, clubId);
  if (!base) return addZZ(clubId, autoLineup(clubId, fx.date), fx.date);
  const lg = (G.clubs[clubId] || {}).league, line = base.slice();
  const ok = id => { const r = G.riders[id]; return !!r && r.clubId === clubId && available(r, fx.date) && !fimBusy(r, fx.date) && !u16(r, fx.date); };
  const pool = [...autoLineup(clubId, fx.date), ...clubRiders(clubId).sort(by(r => r.skill, -1)).map(r => r.id)];
  let changes = 0;
  for (let i = 0; i < 8; i++) {
    if (line[i] && (ok(line[i]) || (i < 5 && zzEligible(G.riders[line[i]], clubId, fx.date)))) continue;
    line[i] = null;
    if (changes >= MAX_LINE_CHANGES) continue;
    const sub = pool.find(id => id && !line.includes(id) && !base.includes(id) && ok(id) && slotOk(G.riders[id], i, lg, fx.date));
    if (sub) { line[i] = sub; changes++; }
  }
  return line;
}
// Rezerwa zwykła (nr 6–8) za brakującego / kontuzjowanego zawodnika i rezerwa zastępująca za zawodnika zastępowanego (biegi I, III–XIII)
// Miejsce w biegu do obsadzenia zastępcą: zawodnik nieobecny, wykluczony z meczu, zastępowany (ZZ) albo pusty numer w składzie
const needsSub = (m, e) => { const s = e.riderId && m.riders[e.riderId]; return !(e.riderId && s && !s.out && !s.zz && canStart(m, e.riderId)); };
// Kandydaci na zastępcę (art. 718–720): rezerwa zastępująca za zawodnika zastępowanego (dowolny zawodnik drużyny, raz w meczu,
// nie partner z pary) w biegach I, III–XIII, a poza tym rezerwa zwykła – nr 6–8, której zostanie start na każdy jej bieg z programu
function subCandidates(m, idx, entries, e) {
  const s = e.riderId && m.riders[e.riderId], line = m.lineup[e.team];
  const used = new Set(entries.filter(x => x !== e).map(x => x.riderId).filter(Boolean));
  const target = e.riderId || (e.slot ? slotRider(m, e.slot) : null);
  const zz = s && s.zz && idx !== 1 && idx <= 12 ? line.filter(x => x && !used.has(x) && canStart(m, x, 'rz') && subOk(m, e.team, x, target)) : [];
  const rz = [5, 6, 7].map(i => line[i]).filter(x => x && !used.has(x) && !zz.includes(x) && canStart(m, x) && startsLeft(m, x, idx) && subOk(m, e.team, x, target));
  const best = list => list.slice().sort(by(rid => G.riders[rid].skill, -1));
  return { zz: best(zz), rz: best(rz), target };
}
function applyReserves(m, idx, entries, dry = false) {
  // wybór gracza z ekranu meczu (m.subPick: { idx, team, slots: { nr: id | 0 } }) – mecz prowadzony bieg po biegu
  const pick = m.subPick && m.subPick.idx === idx ? m.subPick : null;
  for (const e of entries) {
    if (!needsSub(m, e)) continue;
    const c = subCandidates(m, idx, entries, e), target = c.target;
    const best = list => list[0];
    let rid = null, kind = 'rezerwa zwykła';
    if (pick && e.team === pick.team && e.slot in pick.slots) {
      const want = pick.slots[e.slot] || null;
      if (want && c.zz.includes(want)) { rid = want; if (!dry) m.riders[rid].rz = true; kind = 'rezerwa zastępująca'; }
      else if (want && c.rz.includes(want)) rid = want;
      if (!want || rid) { if (rid) { if (!dry) subNote(m, idx, `${kind === 'rezerwa zwykła' ? 'Rezerwa zwykła' : 'Rezerwa zastępująca'}: ${G.riders[rid].name}${target && G.riders[target] ? ` za ${G.riders[target].name}` : ''}`); e.riderId = rid; e.slot = m.riders[rid].no; } else e.riderId = null; continue; }
    }
    if (c.zz.length) {
      rid = best(c.zz);
      if (rid) { if (!dry) m.riders[rid].rz = true; kind = 'rezerwa zastępująca'; }
    }
    if (!rid) rid = best(c.rz);
    if (rid) { if (!dry) subNote(m, idx, `${kind === 'rezerwa zwykła' ? 'Rezerwa zwykła' : 'Rezerwa zastępująca'}: ${G.riders[rid].name}${target && G.riders[target] ? ` za ${G.riders[target].name}` : ''}`); e.riderId = rid; e.slot = m.riders[rid].no; }
    else e.riderId = null;
  }
  return entries;
}
// dry – podgląd biegu (ekran meczu): bez oznaczania wykorzystanych rezerw i adnotacji
function withReserves(m, idx, entries, dry = false) { return applyReserves(m, idx, entries, dry); }
function tacticalAllowed(m, team, idx) {
  if (idx < 2 || idx > 14) return false; // biegi III–XV
  return m.score[team === 'H' ? 'A' : 'H'] - m.score[team] >= 6;
}
// Czy rezerwa taktyczna `inId` za `outId` w biegu jest dozwolona (art. 718 ust. 1 pkt 3, art. 719 ust. 4)
function tacticalOk(m, team, idx, entries, inId, outId) {
  if (!tacticalAllowed(m, team, idx) || !outId || entries.some(e => e.riderId === inId)) return false;
  const so = m.riders[outId];
  if (!so || so.zz || !canStart(m, inId, 'rt')) return false;
  return subOk(m, team, inId, outId);
}
// AI: rezerwa taktyczna – najsłabszego w biegu zastępuje najlepszy dostępny
function aiTactical(m, idx, entries, team) {
  if (!tacticalAllowed(m, team, idx)) return;
  const mine = entries.filter(e => e.team === team && e.riderId).sort(by(e => G.riders[e.riderId].skill));
  for (const w of mine) {
    const cand = m.lineup[team].filter(rid => rid && tacticalOk(m, team, idx, entries, rid, w.riderId) && !G.riders[rid].injury)
      .sort(by(rid => G.riders[rid].skill + m.riders[rid].pts * 0.1, -1))[0];
    if (cand && G.riders[cand].skill > G.riders[w.riderId].skill + 0.8) { applyTactical(m, idx, w, cand, team); return; }
  }
}
function applyTactical(m, idx, entry, inId, team) {
  m.subs[team] = (m.subs[team] || 0) + 1;
  m.riders[inId].rt = true;
  subNote(m, idx, `Rezerwa taktyczna: ${G.riders[inId].name} za ${G.riders[entry.riderId].name}`);
  entry.riderId = inId; entry.slot = m.riders[inId].no;
}
// Biegi z programu (I–XIII) od biegu `from`, w których zawodnik jest wpisany swoim numerem
// numer startowy → biegi programu (I–XIII), liczone raz dla każdej tabeli biegów
const PROGRAM_SLOTS = {};
function programSlots(m) {
  const key = m.heatTableId || 'legacy';
  if (PROGRAM_SLOTS[key]) return PROGRAM_SLOTS[key];
  const map = {};
  for (let k = 0; k < 13; k++) {
    const nos = m.heatTableId ? SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES, m.heatTableId).heats[k].entries.map(e => e.participant.number) : PROGRAM[k];
    for (const no of nos) (map[no] = map[no] || []).push(k);
  }
  return (PROGRAM_SLOTS[key] = map);
}
function programLeft(m, rid, from) {
  const s = m.riders[rid];
  if (!s || !s.no) return 0;
  return (programSlots(m)[s.no] || []).filter(k => k >= from).length;
}
// Rezerwa zwykła z wyboru trenera (art. 718 ust. 1 pkt 1, art. 720 ust. 2): zawodnik z numerem 6, 7 lub 8 za dowolny numer
// w biegach I, III–XV, niezależnie od wyniku – pod warunkiem, że starczy mu startów na własne biegi z programu
// Czy zawodnikowi zostanie start na każdy jego bieg z programu po starcie w biegu `idx`
function startsLeft(m, rid, idx) {
  const s = m.riders[rid], cap = BASE_STARTS + (s.rt ? 1 : 0) + (s.rz ? 1 : 0);
  return s.heats + 1 + programLeft(m, rid, idx + 1) <= cap;
}
function regularOk(m, team, idx, entries, inId, outId) {
  if (!outId || inId === outId || entries.some(e => e.riderId === inId)) return false;
  const line = m.lineup[team], si = line.indexOf(inId);
  if (si < 5 || !entries.some(e => e.team === team && e.riderId === outId)) return false;
  const so = m.riders[outId], s = m.riders[inId];
  if (!so || so.zz || !s || !canStart(m, inId)) return false;
  if (!startsLeft(m, inId, idx)) return false;
  // juniorów (6–7) rezerwa zwykła zastępuje tylko po kontuzji (applyReserves); z wyboru – wyłącznie krajowy junior z numerem 8,
  // w biegach II–XIII, najwyżej raz za każdego z nich (art. 718 ust. 2 i 4)
  const ti = line.indexOf(outId);
  if (idx === 1 && ti !== 5 && ti !== 6) return false; // bieg II (młodzieżowy): tylko junior 8 za juniora 6–7
  if (ti === 5 || ti === 6) {
    if (si !== 7 || idx > 12 || !isJunior(G.riders[inId]) || !isDomestic(G.riders[inId], team === 'H' ? m.homeId : m.awayId)) return false;
    if ((s.r8for || []).includes(outId)) return false;
  }
  return subOk(m, team, inId, outId);
}
function applyRegular(m, idx, entry, inId) {
  const ti = m.lineup[m.riders[inId].team].indexOf(entry.riderId);
  if (ti === 5 || ti === 6) (m.riders[inId].r8for = m.riders[inId].r8for || []).push(entry.riderId);
  subNote(m, idx, `Rezerwa zwykła: ${G.riders[inId].name} za ${G.riders[entry.riderId].name}`);
  entry.riderId = inId; entry.slot = m.riders[inId].no;
}
// Dyspozycja w meczu: poziom + forma, a po pierwszych biegach także punkty na bieg w tym meczu
function matchForm(m, rid) {
  const r = G.riders[rid], s = m.riders[rid];
  return r.skill + r.form * 0.45 + (s && s.heats ? ((s.pts + s.bonus) / s.heats - 1.5) * Math.min(s.heats, 3) / 3 : 0);
}
// AI: junior (6–7) lub nr 8 w lepszej dyspozycji zastępuje najsłabiej jadącego zawodnika drużyny w biegu
function aiRegular(m, idx, entries, team) {
  const mine = entries.filter(e => e.team === team && e.riderId).sort(by(e => matchForm(m, e.riderId)));
  for (const w of mine) {
    const cand = [5, 6, 7].map(i => m.lineup[team][i]).filter(rid => rid && !G.riders[rid].injury && regularOk(m, team, idx, entries, rid, w.riderId))
      .sort(by(rid => matchForm(m, rid), -1))[0];
    if (cand && matchForm(m, cand) > matchForm(m, w.riderId) + 1.5) { applyRegular(m, idx, w, cand); return; }
  }
}
function playNextHeat(m, override) {
  if (m.done) return null;
  const idx = m.heats.length;
  let entries = withReserves(m, idx, heatEntries(m, idx));
  if (override) entries = override(entries) || entries;
  for (const team of ['A', 'H']) {
    const userTeam = (team === 'H' ? m.homeId : m.awayId) === G.clubId;
    if (!userTeam) { aiRegular(m, idx, entries, team); aiTactical(m, idx, entries, team); }
  }
  // zawodnik niedostępny, bez możliwej rezerwy – pusty tor
  entries.forEach(e => { if (e.riderId && m.riders[e.riderId] && (m.riders[e.riderId].out || m.riders[e.riderId].zz)) e.riderId = null; });
  // przerwa techniczna przed tym biegiem: prace torowe według poleceń gracza (gospodarz) albo AI / sędziego (js/track.js)
  let breakNote = null;
  if (m.pendingBreak && m.surf) { breakNote = trackBreakNote(m, m.breakOrders, longBreak(m, m.pendingBreak)); delete m.pendingBreak; delete m.breakOrders; }
  const h = runHeat(entries, { homeClubId: m.homeId, weather: m.weather, track: m.track, team: true, mid: m.id, pick: m.engPick, surf: m.surf, know: m.know });
  m.passes = (m.passes || 0) + (h.passes || 0); // mijanki – Fundusz Atrakcyjności PGE Ekstraligi
  const score = { H: 0, A: 0 };
  h.res.forEach(x => { score[x.team] += x.pts; });
  for (const x of h.res) {
    const s = m.riders[x.riderId] || (m.riders[x.riderId] = { team: x.team, no: null, pts: 0, bonus: 0, heats: 0, line: [] });
    s.pts += x.pts; s.bonus += x.bonus; s.heats++;
    s.line.push(x.status ? x.status : `${x.pts}${x.bonus ? '*' : ''}`);
  }
  for (const rid of h.injuries) {
    if (m.riders[rid]) m.riders[rid].out = true;
    const inj = injureRider(G.riders[rid], m.date, `${m.kind === 'league' ? 'mecz' : m.kind === 'sparing' ? 'sparing' : 'zawody'} ${m.venue}`);
    h.log.push(`<span class="neg">${G.riders[rid].name} odnosi kontuzję (${inj.kind}) i nie pojedzie już w tych zawodach.</span>`);
  }
  if (m.heatsNote && m.heatsNote[idx]) h.log.unshift(m.heatsNote[idx]);
  if (breakNote) h.log.unshift(breakNote);
  m.score.H += score.H; m.score.A += score.A;
  const heat = { no: idx + 1, entries: entries.map(e => ({ riderId: e.riderId, team: e.team, gate: e.gate, helmet: e.helmet, slot: e.slot, bike: e.bike, engId: e.engId, eng: e.eng ? { id: e.eng.id, tuner: e.eng.tuner, brand: e.eng.brand, temp: !!e.eng.temp, lent: !!e.eng.lent } : null })), res: h.res, time: h.time, log: h.log, heatScore: score, total: { ...m.score } };
  if (m.surf) heat.surf = surfSnap(m.surf);
  m.heats.push(heat);
  if (m.surf && m.heats.length < 15 && heatGrading(m.heatTableId, idx + 1)) m.pendingBreak = idx + 1;
  if (h.time && m.kind !== 'sparing' && (!G.clubs[m.homeId].stadium.record || h.time < G.clubs[m.homeId].stadium.record.time)) {
    const w = h.res[0];
    G.clubs[m.homeId].stadium.record = { time: h.time, riderId: w.riderId, date: m.date };
    h.log.push(`<b class="pos">Nowy rekord toru!</b>`);
  }
  if (m.heats.length === 15) { if (m.kind === 'sparing') finishSparing(m); else finishMatch(m); } // sparingi: js/sparing.js
  return heat;
}
function simulateMatch(m) { while (!m.done) playNextHeat(m); return m; }

function finishMatch(m) {
  m.done = true;
  const fx = G.fixtures[m.fixtureId];
  const home = G.clubs[m.homeId], away = G.clubs[m.awayId];
  fx.played = true; fx.homePts = m.score.H; fx.awayPts = m.score.A;
  // frekwencja i przychody
  // frekwencja według sektorów i kategorii biletów: cennik, karnety, ranga meczu, pogoda (js/stadium.js)
  m.gate = gateSummary(leagueGate(home, away, fx, m.weather, false));
  m.attendance = m.gate.att;
  if (m.surf) trackHabit(m.homeId, m.surf.plan); // zawodnicy gospodarzy przyzwyczajają się do przygotowywanego toru (js/track.js)
  matchFinance(m, home, away, fx); // bilety (bez karnetowiczów), gastronomia, gadżety, organizacja, wyjazd (js/finance.js)
  // statystyki, forma, wypłaty za punkty
  for (const [rid, s] of Object.entries(m.riders)) {
    const r = G.riders[rid];
    if (!r) continue;
    const st = r.stats[G.season] || (r.stats[G.season] = { m: 0, heats: 0, pts: 0, bonus: 0, w: 0, falls: 0, def: 0, exc: 0, gp: 0, gpPts: 0 });
    if (!s.heats) continue;
    st.m++; st.heats += s.heats; st.pts += s.pts; st.bonus += s.bonus;
    st.w += s.line.filter(x => x.startsWith('3')).length;
    st.falls += s.line.filter(x => x === 'u').length; st.def += s.line.filter(x => x === 'd').length; st.exc += s.line.filter(x => x === 'w' || x === 't').length;
    if (st.p1 == null && st.m > 1) Object.assign(st, seasonPlaceStats(r, G.season, m.id)); // zapis sprzed liczenia miejsc – wcześniejsze mecze sezonu
    addPlaceStats(st, s.line); // miejsca I–IV i taśmy (historia sezonów jak w Polish Speedway Database)
    const exp = (r.skill - 6) / 9 * 2.1; // spodziewane pkt na bieg
    const got = (s.pts + s.bonus) / s.heats;
    r.form = clamp(r.form * 0.65 + (got - exp) * 0.6, -2, 2);
    r.lastMatches.unshift({ date: m.date, match: m.id, opp: s.team === 'H' ? away.short : home.short, pts: s.pts, bonus: s.bonus, heats: s.heats, line: s.line.join(',') });
    r.lastMatches = r.lastMatches.slice(0, 10);
    payPoints(r, s); // stawka z kontraktu lub umowy wypożyczenia (js/market.js)
  }
  absenceDeductions(m); // potrącenia za mecze opuszczone z powodu kontuzji spoza ligi polskiej (js/market.js)
  if ((m.homeId === G.clubId || m.awayId === G.clubId) && typeof boardAfterMatch === 'function') boardAfterMatch(m); // zaufanie zarządu (js/board.js)
  if (fx.league && typeof aiCoachAfterMatch === 'function') aiCoachAfterMatch(m); // kluby AI zwalniają menedżerów po serii porażek
  if (m.homeId === G.clubId || m.awayId === G.clubId) { matchReport(m); G.scout = G.scout || {}; for (const rid of Object.keys(m.riders)) G.scout[rid] = Math.min(0.35, (G.scout[rid] || 0) + 0.02); }
}
function matchReport(m) {
  const me = m.homeId === G.clubId ? 'H' : 'A', op = me === 'H' ? 'A' : 'H';
  const home = G.clubs[m.homeId], away = G.clubs[m.awayId];
  const res = m.score[me] > m.score[op] ? 'Zwycięstwo' : m.score[me] < m.score[op] ? 'Porażka' : 'Remis';
  const top = Object.entries(m.riders).filter(([, s]) => s.team === me).sort(by(([, s]) => s.pts + s.bonus, -1))[0];
  addMsg({ category: 'mecz', from: 'Asystent trenera', title: `${res}: ${home.short} ${m.score.H}:${m.score.A} ${away.short}`,
    body: `<p>${fmtDay(m.date)}, ${esc(m.venue)} – ${fmtNum(m.attendance)} widzów, tor ${m.weather.track}.</p>
      <p><b>${esc(home.name)} ${m.score.H} : ${m.score.A} ${esc(away.name)}</b></p>
      ${top ? `<p>Najskuteczniejszy w naszej drużynie: <b>${esc(G.riders[top[0]].name)}</b> – ${top[1].pts}+${top[1].bonus} pkt.</p>` : ''}`, link: `#/zawody/${m.fixtureId}` });
}

// ---------- Kontuzje ----------
function injureRider(r, date, where, ev = null) {
  const [kind, lo, hi] = pick(INJURIES);
  const med = r.clubId ? (staffBest(r.clubId, 'medical') + staffBest(r.clubId, 'physio')) / 2 : 8;
  const days = Math.max(1, Math.round(rint(lo, hi) * (1.25 - med / 40)));
  const id = `I${G.seq.inj++}`;
  const inj = { id, riderId: r.id, clubId: r.clubId, kind, start: date, until: addDays(date, days), days, where, healed: false, covered: typeof injuryCovered === 'function' ? injuryCovered(ev) : true };
  G.injuries[id] = inj;
  r.injury = id;
  if (typeof injuryPaEvent === 'function') injuryPaEvent(r, days);
  if (r.clubId === G.clubId) addMsg({ category: 'medyczne', from: 'Lekarz klubowy', title: `Kontuzja: ${r.name}`,
    body: `<p><b>${esc(r.name)}</b> doznał urazu (${kind}) podczas: ${esc(where)}.</p><p>Przewidywana przerwa: <b>${days} ${plural(days, 'dzień', 'dni', 'dni')}</b> (powrót ok. ${fmtDate(inj.until)}).</p>`, link: `#/medyczne` });
  return inj;
}

// ---------- Grand Prix (turniej indywidualny, 16 zawodników) ----------
// Zgodność interfejsu starego programu indywidualnego; kolejność pochodzi z paczki.
function gpProgram() {
  return SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES, 'individual-16-20').heats.map(h => h.entries.map(e => ({ p: e.participant.number - 1, gate: e.gate })));
}
function gpField(ev) {
  if (typeof sgpRoundField === 'function') return sgpRoundField(ev); // stali + dzika karta rundy (js/qualification.js)
  const reserves = G.sgp.reserves.slice();
  return G.sgp.riders.map(id => {
    if (available(G.riders[id], ev.date) && !fimSuspended(G.riders[id].country, ev.date)) return id;
    const busy = typeof busyOn === 'function' ? busyOn(ev.date, ev.id) : new Set();
    const sub = reserves.find(x => available(G.riders[x], ev.date) && !fimSuspended(G.riders[x].country, ev.date) && !busy.has(String(x)));
    if (sub) { reserves.splice(reserves.indexOf(sub), 1); return sub; }
    return id;
  });
}
function simulateGp(ev) {
  const isSgp = ev.kind === 'sgp';
  const field = isSgp ? gpField(ev) : ev.kind === 'comp' ? dayField(ev) : indField(ev);
  if (field.filter(id => id != null && R(id)).length < 4) { ev.played = true; ev.cancelled = true; return null; }
  const selected = eventHeatTable(ev);
  const t = selected || SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES, 'individual-16-20');
  const m = tableMeeting(ev, t, field.slice(0, t.riders), null);
  if (!selected) m.heatTableFallback = 'Niezweryfikowany format zawodów: standardowy turniej 16/20.';
  const order = m.classification.map(c => c.riderId);
  const comp = isSgp ? COMPS.SGP : ev.kind === 'comp' ? compOf(ev) : { name: ev.label, series: !!ev.series };
  const table = isSgp ? G.sgp.standings : comp.series ? seriesTable(ev.season, ev.kind === 'comp' ? compKey(ev) : ev.series) : null;
  for (const c of m.classification) {
    if (table) table[c.riderId] = (table[c.riderId] || 0) + c.gp;
    const r = G.riders[c.riderId];
    if (!r) { recordRider(c.riderId, c.heatPts, m.riders[c.riderId].heats, c.place); continue; }
    const st = r.stats[G.season] || (r.stats[G.season] = { m: 0, heats: 0, pts: 0, bonus: 0, w: 0, falls: 0, def: 0, exc: 0, gp: 0, gpPts: 0 });
    if (isSgp) { st.gp++; st.gpPts += c.gp; } else { st.tourn = (st.tourn || 0) + 1; if (c.place === 1) st.tournWins = (st.tournWins || 0) + 1; }
    r.form = clamp(r.form * 0.8 + (c.place <= 4 ? 0.3 : c.place > 12 ? -0.25 : 0), -2, 2);
  }
  m.done = true;
  m.names = Object.fromEntries(Object.keys(m.riders).map(id => [id, (R(isNaN(id) ? id : Number(id)) || {}).name]));
  G.matches[m.id] = m;
  ev.played = true; ev.matchId = m.id; ev.winner = order[0];
  if (table && (isSgp || ev.kind === 'comp')) finalizeSeries(isSgp ? 'SGP' : compKey(ev), ev.season); // ostatnia runda: klasyfikacja końcowa z biegami dodatkowymi (js/ties.js)
  const mine = m.classification.filter(c => R(c.riderId) && R(c.riderId).clubId === G.clubId);
  const major = isSgp || ['IMP', 'ZK', 'SEC', 'SGP2', 'MIMP', 'SK', 'BK'].includes(ev.comp) || ev.major;
  if (major || mine.length) addMsg({ category: mine.length && !major ? 'szkółka' : 'liga', from: isSgp ? 'FIM Speedway Grand Prix' : comp.name, title: `${ev.name}: wygrywa ${R(order[0]).name}`,
    body: `<p>Podium: ${order.slice(0, 3).map((id, i) => `${i + 1}. <b>${esc(R(id).name)}</b>`).join(', ')}.</p>${mine.length ? `<p>Nasi zawodnicy: ${mine.map(c => `${esc(R(c.riderId).name)} – ${c.place}. miejsce`).join('; ')}.</p>` : ''}`,
    link: `#/gp/${ev.id}` });
  return m;
}
function seriesTable(season, series) {
  G.series = G.series || {};
  return G.series[`${season}-${series}`] || (G.series[`${season}-${series}`] = {});
}

// Miejsca I–IV i taśmy z zapisu biegów zawodnika ('3', '2*', '1', '0', 'd', 'u', 'w', 't'); exc liczy wykluczenia razem z taśmami
function addPlaceStats(st, line) {
  for (const k of ['p1', 'p2', 'p3', 'p4', 'tape']) st[k] = st[k] || 0;
  for (const x of line) {
    if (x === 't') st.tape++;
    else if (/^[0-3]/.test(x)) st['p' + (4 - Number(x[0]))]++;
  }
}
// Pełne statystyki ligowego sezonu z zapisanych meczów – sezony z zapisów sprzed liczenia miejsc
function seasonPlaceStats(r, season, skipId) {
  const st = { p1: 0, p2: 0, p3: 0, p4: 0, tape: 0, def: 0, falls: 0, exc: 0 };
  let n = 0;
  for (const m of Object.values(G.matches || {})) {
    const s = m.homeId != null && m.riders && m.riders[r.id];
    if (!s || !s.heats || m.id === skipId || String(m.date || '').slice(0, 4) !== String(season)) continue;
    n++;
    addPlaceStats(st, s.line || []);
    st.falls += (s.line || []).filter(x => x === 'u').length; st.def += (s.line || []).filter(x => x === 'd').length; st.exc += (s.line || []).filter(x => x === 'w' || x === 't').length;
  }
  return n ? st : {}; // brak zapisanych meczów sezonu – kolumny puste
}
