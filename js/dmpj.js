'use strict';
// Drużynowe Mistrzostwa Polski Juniorów (MDMP / DMPJ) – regulamin 2026, art. 802–807: eliminacje w 5 grupach (4–5 drużyn, czwórmecze
// u kolejnych gospodarzy, w grupach pięciodrużynowych jedna drużyna pauzuje), ćwierćfinały (4 grupy × 4: trzy najlepsze z każdej grupy
// eliminacyjnej i najlepsza z czwartych miejsc), półfinały (2 grupy × 4: po dwie najlepsze z ćwierćfinałów) i finał (4 drużyny, 4 turnieje).
// Punkty meczowe w każdej rundzie: 4–3–2–1 (art. 804). Grupy i terminarz eliminacji: komunikat GKSŻ, kwiecień 2026 (nawirazu.com, zuzlowydegustator.pl).

const DMPJ_PLAN = {
  season: 2026,
  // grupy eliminacyjne: [gospodarz, pauzuje] w kolejnych rundach; AJK – Akademia Żużlowa Janusza Kołodzieja (Tarnów, szkółka TARC)
  groups: {
    A: { name: 'Grupa A im. Romualda Łosia', teams: ['OST', 'GNI', 'WRO', 'LES'], rounds: [['OST'], ['GNI'], ['WRO'], ['LES']] },
    B: { name: 'Grupa B im. Konstantego Pociejkowicza', teams: ['GRU', 'GDA', 'BYD', 'TOR'], rounds: [['GRU'], ['GDA'], ['BYD'], ['TOR']] },
    C: { name: 'Grupa C im. Mariana Staweckiego', teams: ['RZE', 'LUB', 'KRO', 'KRA', 'AJK'], rounds: [['RZE', 'AJK'], ['LUB', 'RZE'], ['KRO', 'LUB'], ['KRA', 'KRO'], ['AJK', 'KRA']] },
    D: { name: 'Grupa D im. Roberta Nawrockiego', teams: ['ŚWI', 'LOD', 'CZE', 'OPO', 'RYB'], rounds: [['ŚWI', 'RYB'], ['LOD', 'ŚWI'], ['CZE', 'LOD'], ['OPO', 'CZE'], ['RYB', 'OPO']] },
    E: { name: 'Grupa E im. Stanisława Skowrona', teams: ['GOR', 'PIL', 'ZIE', 'POZ'], rounds: [['GOR'], ['PIL'], ['ZIE'], ['POZ']] },
  },
  elim: ['2026-04-22', '2026-04-29', '2026-05-06', '2026-05-13', '2026-05-20'],
  qf: ['2026-06-03', '2026-06-10', '2026-06-17', '2026-07-01'],
  sf: ['2026-07-22', '2026-07-29', '2026-08-05', '2026-08-12'],
  final: ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23'],
};
const DMPJ_EXTRA = { AJK: { name: 'Akademia Żużlowa Janusza Kołodzieja Tarnów', city: 'Tarnów', school: 'TARC' } };
const DMPJ_STAGE = { elim: 'eliminacje', qf: 'ćwierćfinał', sf: 'półfinał', final: 'finał' };

const dmpjCity = code => (DMPJ_EXTRA[code] ? DMPJ_EXTRA[code].city : (typeof clubByCode === 'function' && clubByCode(code) ? clubByCode(code).city.replace(' Wlkp.', '') : code));
const dmpjName = code => (DMPJ_EXTRA[code] ? DMPJ_EXTRA[code].name : (typeof clubByCode === 'function' && clubByCode(code) ? clubByCode(code).name : code));

// Zawody sezonu (w kolejnych sezonach te same grupy i terminy przesunięte o 52 tygodnie)
function makeDmpjEvents(season, shift, add) {
  const P = DMPJ_PLAN;
  for (const [g, gr] of Object.entries(P.groups)) gr.rounds.forEach(([host, pause], i) => {
    const teams = gr.teams.filter(t => t !== pause);
    add(`dmpj-e-${g}-${i + 1}`, P.elim[i], `DMPJ – eliminacje, gr. ${g}, runda ${i + 1} (${dmpjCity(host)})`, dmpjCity(host), 'DMPJ',
      { stage: 'eliminacje', round: i + 1, dmpj: { stage: 'elim', group: g, host, teams: [host, ...teams.filter(t => t !== host)], pause: pause || null } });
  });
  for (const [st, ngroups] of [['qf', 4], ['sf', 2], ['final', 1]]) for (let gi = 0; gi < ngroups; gi++) P[st].forEach((d, i) => {
    const g = st === 'final' ? null : ['I', 'II', 'III', 'IV'][gi];
    add(`dmpj-${st}-${g || 'F'}-${i + 1}`, d, `DMPJ – ${DMPJ_STAGE[st]}${g ? `, gr. ${g}` : ''}, runda ${i + 1}`, '', 'DMPJ', { stage: DMPJ_STAGE[st], round: i + 1, dmpj: { stage: st, group: g, slot: i, teams: null } });
  });
}
// Tabela grupy w danej fazie: punkty meczowe (4–3–2–1, remisy dzielą punkty) i biegowe z rozegranych rund
function dmpjTable(season, stage, group) {
  const rows = {};
  for (const ev of Object.values(G.events)) {
    if (ev.comp !== 'DMPJ' || ev.season !== season || !ev.dmpj || ev.dmpj.stage !== stage || ev.dmpj.group !== group || !ev.played) continue;
    const m = G.matches[ev.matchId];
    if (!m || !m.classification) continue;
    for (const c of m.classification) { const r = rows[c.key] || (rows[c.key] = { key: c.key, mp: 0, hp: 0, n: 0 }); r.mp += c.tablePts ?? 0; r.hp += c.pts || 0; r.n++; }
  }
  const teams = dmpjGroupTeams(season, stage, group) || Object.keys(rows);
  for (const k of teams) rows[k] = rows[k] || { key: k, mp: 0, hp: 0, n: 0 };
  return Object.values(rows).sort((a, b) => b.mp - a.mp || b.hp - a.hp || a.key.localeCompare(b.key));
}
const dmpjState = season => ((G.dmpj = G.dmpj || {})[season] = G.dmpj[season] || {});
// Skład grup fazy (eliminacje – plan; dalsze fazy – ustalane po zakończeniu poprzedniej, rozstawienie wężykiem)
function dmpjGroupTeams(season, stage, group) {
  if (stage === 'elim') return DMPJ_PLAN.groups[group] ? DMPJ_PLAN.groups[group].teams.slice() : null;
  const st = dmpjState(season);
  if (!st[stage]) {
    const prev = { qf: 'elim', sf: 'qf', final: 'sf' }[stage];
    const prevGroups = prev === 'elim' ? Object.keys(DMPJ_PLAN.groups) : prev === 'qf' ? ['I', 'II', 'III', 'IV'] : ['I', 'II'];
    const pending = Object.values(G.events).some(e => e.comp === 'DMPJ' && e.season === season && e.dmpj && e.dmpj.stage === prev && !e.played);
    if (pending) return null;
    const tables = prevGroups.map(g => dmpjTable(season, prev, g));
    let seeds = [];
    if (stage === 'qf') {
      for (let p = 0; p < 3; p++) seeds.push(...tables.map(t => t[p]).filter(Boolean).sort((a, b) => b.mp - a.mp || b.hp - a.hp));
      const fourth = tables.map(t => t[3]).filter(Boolean).sort((a, b) => b.mp - a.mp || b.hp - a.hp)[0];
      if (fourth) seeds.push(fourth);
    } else for (let p = 0; p < 2; p++) seeds.push(...tables.map(t => t[p]).filter(Boolean).sort((a, b) => b.mp - a.mp || b.hp - a.hp));
    const n = { qf: 4, sf: 2, final: 1 }[stage], groups = Array.from({ length: n }, () => []);
    seeds.forEach((s, i) => { const row = Math.floor(i / n), k = i % n; groups[row % 2 ? n - 1 - k : k].push(s.key); });
    st[stage] = Object.fromEntries(groups.map((l, i) => [stage === 'final' ? 'F' : ['I', 'II', 'III', 'IV'][i], l]));
    if (stage === 'final') st.finalHosts = dmpjFinalHosts(season, tables);
  }
  return (st[stage][group || 'F'] || []).slice();
}
// Gospodarze finału (art. 807): 1. – druga drużyna półfinałów z mniejszą liczbą pkt, 2. – druga z większą, 3. i 4. – zwycięzcy grup (słabszy, potem lepszy)
function dmpjFinalHosts(season, tables) {
  const by = (a, b) => a.mp - b.mp || a.hp - b.hp;
  const seconds = tables.map(t => t[1]).filter(Boolean).sort(by), firsts = tables.map(t => t[0]).filter(Boolean).sort(by);
  return [...seconds, ...firsts].map(r => r.key);
}
// Drużyny konkretnych zawodów: gospodarz pierwszy (stadion, kolejność w awizacji)
function dmpjEventTeams(ev) {
  const d = ev.dmpj;
  if (d.teams) return d.teams;
  const teams = dmpjGroupTeams(ev.season, d.stage, d.group);
  if (!teams || !teams.length) return null;
  const host = d.stage === 'final' ? (dmpjState(ev.season).finalHosts || teams)[d.slot] : teams[d.slot % teams.length];
  d.teams = [host, ...teams.filter(t => t !== host)];
  d.host = host;
  ev.venue = dmpjCity(host);
  ev.name = `${ev.name.replace(/ \(.*\)$/, '')} (${ev.venue})`;
  return d.teams;
}
// Jednostki zawodów (pickUnits): drużyny klubów z planu, Akademia Kołodzieja – z zawodników szkółki
function dmpjUnits(ev, units) {
  const teams = dmpjEventTeams(ev);
  if (!teams) return [];
  return teams.map(code => units.find(u => u.key === code) || dmpjExtraUnit(ev, code)).filter(u => u && u.riders.length >= 2);
}
function dmpjExtraUnit(ev, code) {
  const x = DMPJ_EXTRA[code];
  if (!x) return null;
  const busy = typeof busyOn === 'function' ? busyOn(ev.date, ev.id) : new Set();
  const rs = Object.values(G.riders).filter(r => r.schoolId === x.school && r.active && !r.retired && available(r, ev.date) && !busy.has(String(r.id)) && ageIn(r, ev.season) <= 21 && polEligible(r))
    .sort(by(r => r.skill, -1)).slice(0, 5);
  return { key: code, name: x.name, clubId: null, riders: rs.map(r => r.id), str: sum(rs.map(r => r.skill)) };
}
// Zapisy z DMPJ według kalendarza (rotacja drużyn): nierozegrane rundy zastąpione strukturą z regulaminu
function migrateDmpj() {
  const season = G.season < DMPJ_PLAN.season ? DMPJ_PLAN.season : G.season;
  const old = Object.values(G.events).filter(e => e.comp === 'DMPJ' && e.season === season && !e.dmpj);
  if (!old.length || old.some(e => e.played)) return false;
  for (const e of old) delete G.events[e.id];
  const shift = (season - CAL.season) * 364;
  makeDmpjEvents(season, shift, (key, d0, name, place, comp, extra = {}) => {
    const d = addDays(d0, shift);
    if (d < G.date) return;
    const id = `C${season}-${key}`;
    G.events[id] = { id, kind: 'comp', comp, season, date: d, venue: place || '', name, played: false, calKey: key, ...extra };
  });
  return true;
}
