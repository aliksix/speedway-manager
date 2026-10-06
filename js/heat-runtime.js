'use strict';
// The source package is immutable; all draw/ranking decisions belong to the saved meeting.
function eventHeatTable(ev, teamCount) {
  if (ev.heatTableId) return SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES, ev.heatTableId);
  const key = ev.kind === 'sgp' ? 'SGP' : ev.comp;
  const map = SPEEDWAY_HEAT_TABLES.competitionMappings[key];
  if (!map || /not-mapped|non-racing|requires-supplementary/.test(map.status)) return null;
  const counts = map.byTeams || map.qualifyingByTeams;
  const requested = teamCount || ev.units?.length;
  const supported = counts ? Object.keys(counts).map(Number).sort((a,b) => a-b) : [];
  const count = supported.length ? supported.find(n => n >= requested) || supported.at(-1) : requested;
  return SpeedwayHeatAdapter.selectTable(SPEEDWAY_HEAT_TABLES, key, {
    stage: /elimin|kwalif|półfinał/i.test(ev.stage || '') ? 'qualifying' : 'final', teamCount: count
  });
}
function eventFieldSize(ev) { return eventHeatTable(ev)?.riders || 16; }
function heatTeamCodes(t) { return [...new Set(t.heats.flatMap(h => h.entries.map(e => e.team)).filter(Boolean))].sort(); }
function heatRegularSlots(t) { return t.id === 'etc-4-22' ? 4 : t.rosterSlots ? t.rosterSlots.length - 1 : t.riders / t.teams; }
// Klasyfikacja pośrednia: punkty, miejsca w biegach, bezpośrednie spotkania (SGP: najszybszy czas, ranking cyklu), losowanie – js/ties.js
function heatRank(m, ids) {
  const live = ids.filter(id => m.riders[id]), sgp = /^sgp-/.test(m.heatTableId || '');
  const ranking = sgp && G.sgp ? Object.entries(G.sgp.standings).sort(by(([, p]) => p, -1)).map(([id]) => id) : null;
  return [...rankByPoints(m, live, id => m.riders[id].pts, { sgp, ranking }), ...ids.filter(id => !m.riders[id])];
}
function heatResolve(p, ctx) {
  if (p.type === 'startNumber') return ctx.startNumbers[p.number];
  if (p.type === 'teamSlot') return ctx.teamRiders[p.team]?.[p.slot - 1];
  if (p.type === 'rank') return ctx.rankings[p.ranking]?.[p.place - 1];
  if (p.type === 'result') return ctx.results[p.heat]?.[p.place - 1];
  if (p.type === 'nomination') return ctx.nominations[p.key];
  throw Error('Unknown heat selector: ' + p.type);
}
function tableMeeting(ev, t, field, units) {
  const m = { id: `X${ev.id}`, kind: ev.kind, comp: ev.comp, eventId: ev.id, date: ev.date, venue: ev.venue,
    track: 350, weather: weatherFor(ev.date, G.seed + ev.id), heatTableId: t.id, heatTableVersion: SPEEDWAY_HEAT_TABLES.schemaVersion,
    heats: [], riders: {}, gateChoices: {}, rankings: {}, done: false };
  eventTrack(m, ev); // tor organizatora; prace torowe – sędzia / komisarz toru / dyrektor zawodów (js/track.js)
  const ctx = { startNumbers: {}, teamRiders: {}, rankings: m.rankings, results: {}, nominations: {}, gateChoices: m.gateChoices };
  const codes = heatTeamCodes(t), regular = units ? heatRegularSlots(t) : 0, teamKeys = {}, reserveOf = {};
  // limit startów rezerwowego: tyle, ile biegów w programie ma zawodnik podstawowy (najwięcej)
  const progCount = {};
  for (const h of t.heats) for (const e of h.entries) {
    const p = e.participant, k = p.type === 'startNumber' ? `n${p.number}` : p.type === 'teamSlot' ? `${p.team}:${p.slot}` : null; // DPŚ: miejsca w drużynie
    if (k) progCount[k] = (progCount[k] || 0) + 1;
  }
  const reserveCap = Math.max(1, ...Object.values(progCount));
  const pairs = units && regular === 2 && /pairs/.test((typeof compOf === 'function' && ev.kind === 'comp' ? compOf(ev).format : '') || '');
  const add = (id, no, unit) => { if (id != null && R(id)) m.riders[id] = { no, unit, pts: 0, bonus: 0, heats: 0, line: [], places: {}, w: 0 }; };
  if (units) {
    m.units = {};
    codes.forEach((code, i) => {
      const u = units[i], ids = u ? u.riders.slice() : [];
      ctx.teamRiders[code] = ids;
      if (u) { teamKeys[code] = u.key; m.units[u.key] = { ...u, riders: ids.filter(id => id != null && R(id)), pts: 0 }; }
      for (let j = 0; j < regular; j++) ctx.startNumbers[i * regular + j + 1] = ids[j];
      if (t.reserveNumbers?.[i]) ctx.startNumbers[t.reserveNumbers[i]] = ids[regular];
      if (u && ids[regular] != null) reserveOf[u.key] = ids[regular];
      ids.forEach((id, j) => add(id, j < regular ? i * regular + j + 1 : t.reserveNumbers?.[i] ?? codes.length * regular + i + 1, u?.key)); // rezerwowy bez numeru w tabeli – kolejny wolny
    });
  } else field.forEach((id, i) => { ctx.startNumbers[i + 1] = id; add(id, i + 1, null); });
  if (t.id === 'sgp-sprint') ctx.rankings.sprintQualifiers = field.slice(0,4);
  const all = Object.keys(m.riders);
  for (const heat of t.heats) {
    if (heat.entries.some(e => e.participant.type === 'rank' || e.participant.type === 'nomination') && !ctx.rankings.main) {
      ctx.rankings.main = heatRank(m, all);
      for (const code of codes) ctx.rankings[code] = heatRank(m, ctx.teamRiders[code].slice(0, regular));
    }
    if (heat.phase === 'nominated') for (const code of codes) ctx.nominations[`${heat.no}:${code}`] = ctx.rankings[code]?.[20 - heat.no];
    // Missing starters keep their program number and lane, using unique internal placeholders for adapter validation.
    const hc = { ...ctx, startNumbers: { ...ctx.startNumbers }, teamRiders: Object.fromEntries(Object.entries(ctx.teamRiders).map(([k,v]) => [k,v.slice()])),
      rankings: Object.fromEntries(Object.entries(ctx.rankings).map(([k,v]) => [k,v.slice()])), results: Object.fromEntries(Object.entries(ctx.results).map(([k,v]) => [k,v.slice()])), nominations: { ...ctx.nominations } };
    heat.entries.forEach((e, i) => {
      const p = e.participant; if (heatResolve(p, hc) != null) return;
      const empty = `__empty_${heat.no}_${i}`;
      if (p.type === 'startNumber') hc.startNumbers[p.number] = empty;
      if (p.type === 'teamSlot') (hc.teamRiders[p.team] ||= [])[p.slot - 1] = empty;
      if (p.type === 'rank') (hc.rankings[p.ranking] ||= [])[p.place - 1] = empty;
      if (p.type === 'result') (hc.results[p.heat] ||= [])[p.place - 1] = empty;
      if (p.type === 'nomination') hc.nominations[p.key] = empty;
    });
    if (heat.gatePolicy === 'rider-choice') {
      // The simulation favours A, then B/C/D. Each rider chooses in the regulation's priority order.
      const ids = heat.entries.map(e => heatResolve(e.participant, hc));
      m.gateChoices[heat.no] = heat.choiceOrder === 'main-top-two-then-lcq-winners-by-main-ranking'
        ? [...ids.slice(0, 2), ...ids.slice(2).sort((a,b) => ctx.rankings.main.indexOf(String(a)) - ctx.rankings.main.indexOf(String(b)))] : ids;
    } else if (heat.gatePolicy === 'ballot') {
      m.gateChoices[heat.no] = heat.entries.map(e => heatResolve(e.participant, hc)).sort((a,b) => hashStr(m.id + heat.no + a) - hashStr(m.id + heat.no + b));
    }
    const resolved = heat.entries.map(e => heatResolve(e.participant, hc));
    if (new Set(resolved.map(String)).size !== 4) throw Error(`Duplicate rider: ${ev.id}, ${t.id}, heat ${heat.no}: ${resolved.join(',')}`);
    const entries = SpeedwayHeatAdapter.toRunHeatEntries(SPEEDWAY_HEAT_TABLES, t.id, heat.no, hc).map(e => ({ ...e,
      riderId: m.riders[e.riderId] && !m.riders[e.riderId].out && (typeof evAvailable === 'function' && ev.kind === 'comp' ? evAvailable(ev, R(e.riderId)) : available(R(e.riderId), ev.date)) ? e.riderId : null,
      team: units ? teamKeys[e.team] || null : null }));
    // Rezerwowy drużyny/pary (np. MPPK art. 824 ust. 2 – za dowolny numer od pierwszego biegu): za zawodnika, który nie może jechać,
    // a w zawodach parowych także za zawodnika z pary jadącego słabo (co najmniej 2 starty, średnio < 1 pkt), w limicie startów
    if (units) entries.forEach(e => {
      const rid = reserveOf[e.team], rs = rid != null && m.riders[rid];
      if (!rs || rs.out || rs.heats >= reserveCap || entries.some(x => String(x.riderId) === String(rid))) return;
      if (!(typeof evAvailable === 'function' && ev.kind === 'comp' ? evAvailable(ev, R(rid)) : available(R(rid), ev.date))) return;
      const cur = e.riderId != null && m.riders[e.riderId];
      const avg = x => (x.heats ? x.pts / x.heats : null);
      // zmiana tylko, dopóki rezerwowy nie jedzie słabiej od podstawowego – inaczej para wraca do zawodnika podstawowego
      const weak = pairs && cur && cur.heats >= 2 && avg(cur) < 1 && (R(rid).ca ?? R(rid).skill * 5) >= (R(e.riderId).ca ?? R(e.riderId).skill * 5) - 3 && (!rs.heats || avg(rs) >= avg(cur));
      if (e.riderId == null || weak) { (m.reserveUses = m.reserveUses || []).push({ heat: heat.no, unit: e.team, in: rid, out: e.riderId ?? null }); e.riderId = rid; }
    });
    const h = runHeat(entries, { homeClubId: -1, weather: m.weather, track: m.track, mid: m.id, points: t.points, surf: m.surf });
    h.res.forEach(x => { const s = m.riders[x.riderId]; s.pts += x.pts; s.bonus += x.bonus; s.heats++; s.line.push(x.status || String(x.pts));
      if (x.pos) s.places[x.pos] = (s.places[x.pos] || 0) + 1;
      if (x.pos === 1) s.w++;
      if (units) m.units[s.unit].pts += x.pts;
    });
    for (const id of h.injuries) { m.riders[id].out = true; if (G.riders[id]) injureRider(G.riders[id], ev.date, ev.name, ev); }
    ctx.results[heat.no] = h.res.map(x => x.riderId);
    const labels = { final: 'Finał', 'classification-final': 'Finał', lcq: 'LCQ', 'last-chance': 'Bieg ostatniej szansy', 'team-ranked': 'Bieg nominowany', nominated: 'Bieg nominowany', reserve: 'Bieg U21' };
    if (heat.gradingAfter && heat !== t.heats[t.heats.length - 1]) h.log.push(trackBreakNote(m, null, false)); // przerwa techniczna (równanie)
    m.heats.push({ no: heat.no, phase: heat.phase, label: `${labels[heat.phase] || 'Bieg'} ${heat.no}`, entries, res: h.res, time: h.time, log: h.log });
  }
  if (units) {
    // pary / drużyny: punkty, bieg dodatkowy (o 1. miejsce, podium, awans), miejsca w biegach, rozstawienie – js/ties.js;
    // tabele kilku rund (DMPJ, U24, mini DMP): remisy dzielą punkty tabeli, bez biegu dodatkowego
    const table = typeof compOf === 'function' && ev.kind === 'comp' && compOf(ev).table;
    const sorted = unitOrder(m, ev, { noRunOff: table }).map(k => m.units[k]);
    m.classification = sorted.map((u,i) => {
      const first = table ? sorted.findIndex(v => v.pts === u.pts) : i, tied = table ? sorted.filter(v => v.pts === u.pts).length : 1;
      const base = ev.comp === 'U24E' ? 3 : /^MINI_DMP/.test(ev.comp) ? 7 : t.teams;
      return { key: u.key, place: first + 1, pts: u.pts, tablePts: base - first - (tied - 1) / 2 };
    });
    for (const [id,s] of Object.entries(m.riders)) if (s.heats) recordRider(isNaN(id) ? id : Number(id), s.pts, s.heats, m.classification.find(c => c.key === s.unit).place);
  } else {
    const rank = ctx.rankings.main || heatRank(m, all), order = [];
    const push = ids => ids.forEach(id => { if (id != null && m.riders[id] && !order.includes(String(id))) order.push(String(id)); });
    if (t.id === 'sgp-sprint') push(ctx.results[0]);
    const finals = t.heats.filter(h => h.phase === 'final' || h.phase === 'classification-final').reverse();
    finals.forEach(h => { push(ctx.results[h.no]); push(h.entries.map(e => heatResolve(e.participant, ctx))); });
    const lcq = t.heats.filter(h => h.phase === 'lcq');
    if (lcq.length) for (let p = 1; p < 4; p++) push(lcq.map(h => ctx.results[h.no][p]).filter(id => id != null).sort((a,b) => rank.indexOf(String(a)) - rank.indexOf(String(b))));
    else t.heats.filter(h => h.phase === 'last-chance').forEach(h => push(ctx.results[h.no]));
    push(rank);
    // o kolejności decydują same punkty (bez finału): bieg dodatkowy przy remisie o 1. miejsce, podium mistrzostw, awans
    if (!finals.length && !lcq.length && !t.heats.some(h => h.phase === 'last-chance') && t.id !== 'sgp-sprint') order.splice(0, order.length, ...applyRiderRunOffs(m, ev, order).map(String));
    m.classification = order.map((id,i) => {
      const s = m.riders[id], excluded = t.seriesScoring?.excludedHeats || [];
      const scoringPts = m.heats.filter(h => !isRunOff(h) && !excluded.includes(h.no)).reduce((n,h) => n + (h.res.find(x => String(x.riderId) === id)?.pts || 0), 0);
      return { riderId: isNaN(id) ? id : Number(id), place: i + 1, heatPts: s.pts, gp: t.id === 'sgp-16-23' ? GP_POINTS[i] || 0 : scoringPts };
    });
  }
  m.done = true;
  m.names = Object.fromEntries(all.map(id => [id, R(id)?.name]));
  return m;
}
// Kto wybiera zestaw torów na biegi XIV–XV (art. 717 ust. 1): drużyna przegrywająca po biegu XIII, przy remisie goście
const nominatedChooser = m => (m.score.H < m.score.A ? 'H' : 'A');
// Pola startowe drużyny w biegu nominowanym (idx 13 / 14) przy danym zestawie torów
function nominatedGates(m, idx, team, set) {
  const h = SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES, m.heatTableId).heats[idx];
  return h.entries.filter(e => e.team === team).map(e => GATES[h.gateSets[set].indexOf(e.helmet)]).sort();
}
function leagueTableEntries(m, idx) {
  const t = SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES, m.heatTableId), h = t.heats[idx];
  if (idx < 13) return h.entries.map(e => ({ riderId: slotRider(m, e.participant.number), slot: e.participant.number, team: e.team, gate: e.gate, helmet: e.helmet }));
  // Freeze the ranking after heat 13; UI may subsequently replace either team's nominations.
  if (!m.nominationRanking) m.nominationRanking = { 13: nominate(m,13), 14: nominate(m,14) };
  const nom = m.nominations[idx] || m.nominationRanking[idx];
  m.nominations[idx] = nom;
  m.nominatedSet ||= 1 + hashStr(m.id + ':nominated') % 2; // AI wybierającego zestaw; gracz wybiera na ekranie meczu (nominatedChooser)
  return h.entries.map(e => { const j = HELMET[e.team].indexOf(e.helmet), id = nom[e.team][j] || null;
    return { riderId: id, slot: m.riders[id]?.no || null, team: e.team, helmet: e.helmet, gate: GATES[h.gateSets[m.nominatedSet].indexOf(e.helmet)] }; });
}
