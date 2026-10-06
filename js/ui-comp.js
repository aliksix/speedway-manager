'use strict';
// Ekrany: Kalendarz, Liga, Zawody (mecz ligowy).

const STAGE = { RS: 'Runda zasadnicza', SF: 'Półfinał', F: 'Finał', B: 'Mecz o 3. miejsce', BZ: 'Baraż' };
function fxLabel(f) { return f.stage === 'RS' ? `${f.round}. kolejka` : `${STAGE[f.stage]} – ${f.leg}. mecz`; }
function isMine(f) { return f.homeId === G.clubId || f.awayId === G.clubId; }

// ---------- Kalendarz ----------
PAGES.kalendarz = parts => {
  const sub = parts[0] || '';
  const T = tabs('kalendarz', [['', 'Miesiąc'], ['lista', 'Moje zawody'], ['sparingi', 'Sparingi'], ['obozy', 'Obozy'], ['imprezy', 'Kalendarz GKSŻ i FIM']], sub === 'sparing' ? 'sparingi' : sub === 'oboz' ? 'obozy' : sub);
  if (sub === 'obozy') return campsPage(T); // js/ui-camps.js
  if (sub === 'oboz') return { ...campPage(parts[1]), tabs: T };
  if (sub === 'sparingi') return sparingsPage(T); // js/ui-sparing.js
  if (sub === 'sparing') return sparingPage(parts[1], parts[2] || '');
  if (sub === 'imprezy') return { title: 'Kalendarz', sub: CAL ? `Sezon ${CAL.season} · kalendarz GKSŻ i FIM` : 'Brak kalendarza', tabs: T, body: eventsList() };
  if (sub === 'lista') {
    const list = clubFixtures(G.clubId);
    const gps = Object.values(G.events).filter(e => e.season === G.season && (e.kind === 'sgp' || (G.matches[e.matchId] && Object.keys(G.matches[e.matchId].riders || {}).some(id => R(id) && R(id).clubId === G.clubId)) || (e.comp === 'EXAM' && examMine(e).length) || (typeof orgMine === 'function' && orgMine(e))));
    const spars = typeof sparOf === 'function' ? sparOf(G.clubId, G.season).filter(s => s.status === 'agreed' || s.status === 'played') : [];
    const all = [...list.map(f => ({ d: f.date, f })), ...gps.map(e => ({ d: e.date, e })), ...spars.map(s => ({ d: s.date, s }))].sort(by(x => x.d));
    return { title: 'Kalendarz', sub: `Sezon ${G.season}`, tabs: T, body: `<div class="panel flush"><table class="t"><thead><tr><th>Data</th><th>Zawody</th><th>Rozgrywki</th><th class="num">Wynik</th></tr></thead><tbody>
      ${all.map(x => x.f ? fixtureRow(x.f) : x.s ? `<tr class="click" onclick="go('#/kalendarz/sparing/${x.s.id}')"><td>${fmtDateShort(x.s.date)}</td><td>🤝 ${esc(sparName(x.s))}</td><td>Sparing (${sparLegLabel(x.s)})</td><td class="num">${x.s.score ? `${x.s.score.H}:${x.s.score.A}` : ''}</td></tr>` : `<tr class="click" onclick="go('#/gp/${x.e.id}')"><td>${fmtDateShort(x.e.date)}</td><td>${x.e.kind === 'sgp' ? '🏆' : x.e.comp === 'EXAM' ? '🎓' : '🏁'} ${esc(x.e.name)}${x.e.comp === 'EXAM' ? ` <span class="small muted">– ${esc(examMine(x.e).join(', '))}</span>` : typeof orgMine === 'function' && orgMine(x.e) ? ' <span class="small muted">– organizator</span>' : ''}</td><td>${esc(evComp(x.e).name)}</td><td class="num">${winnerLabel(x.e)}</td></tr>`).join('')}</tbody></table></div>` };
  }
  if (!UI.cal) UI.cal = G.date.slice(0, 7);
  const [y, m] = UI.cal.split('-').map(Number);
  const first = `${UI.cal}-01`;
  let start = addDays(first, -dow(first));
  const days = [];
  for (let i = 0; i < 42; i++) { const d = addDays(start, i); days.push(d); if (i >= 34 && d.slice(0, 7) !== UI.cal && dow(d) === 6) break; }
  const F = calFilter(), my = calMyIds(), watch = new Set((G.shortlist || []).map(String));
  const all = []; // { d, html, cc, t, mine, watch }
  const add = (d, html, cc, t, ids = [], mine = false) => all.push({ d, html, cc, t, mine: mine || ids.some(id => my.has(String(id))), watch: ids.some(id => watch.has(String(id))) });
  for (const f of Object.values(G.fixtures)) {
    if (!days.includes(f.date)) continue;
    const mine = isMine(f);
    if (!mine && !F.allLeague) continue;
    const h = G.clubs[f.homeId], a = G.clubs[f.awayId];
    let cls = mine ? 'mine' : '';
    if (f.played && mine) { const me = f.homeId === G.clubId ? f.homePts : f.awayPts, op = f.homeId === G.clubId ? f.awayPts : f.homePts; cls += me > op ? ' win' : me < op ? ' loss' : ''; }
    add(f.date, `<div class="ev ${cls}" onclick="go('#/zawody/${f.id}')" title="${esc(h.name)} – ${esc(a.name)} (${fxLabel(f)})">${esc(h.short)} – ${esc(a.short)}${f.played ? ` <span class="res">${f.homePts}:${f.awayPts}</span>` : ''}<div class="small muted">${esc(LEAGUES[f.league].short)} · ${fxLabel(f)}</div></div>`,
      'POL', 'liga', [...clubRiders(f.homeId), ...clubRiders(f.awayId)].map(r => r.id), mine);
  }
  if (typeof sparCalEntries === 'function') { const sv = UI.calAll; UI.calAll = F.allLeague; for (const [d, html] of sparCalEntries(days)) add(d, html, 'POL', 'spar', [], /mine/.test(html)); UI.calAll = sv; } // sparingi (js/ui-sparing.js)
  if (typeof campCalEntries === 'function') for (const [d, html] of campCalEntries(days)) add(d, html, 'POL', 'spar', [], true); // obozy (js/ui-camps.js)
  for (const e of Object.values(G.events)) if (e.kind === 'sgp' && days.includes(e.date)) add(e.date, `<div class="ev gp" onclick="go('#/gp/${e.id}')">🏆 ${esc(e.name)}${e.played ? `<div class="small muted">wygrał ${esc(nameOf(e.winner, G.matches[e.matchId]))}</div>` : '<div class="small muted">Speedway GP</div>'}</div>`,
    (geoOf(e.venue) || [])[2] || 'INT', 'fim', calEventIds(e));
  const S = G.season, info = [[`${S}-11-01`, 'Otwarcie okna transferowego'], [`${S}-03-31`, 'Zamknięcie okna transferowego'], [`${S}-10-15`, 'Koniec sezonu'], [seasonStart(S), 'Start ligi']];
  for (const [d, t] of info) if (days.includes(d)) add(d, `<div class="ev info">${t}</div>`, 'POL', 'info', [], true);
  // imprezy z kalendarza GKSŻ, mistrzostwa FIM, zawody krajowe za granicą (bez rund SGP – te są wyżej)
  for (const e of Object.values(G.events)) {
    if (!['comp', 'mini-info'].includes(e.kind) || !days.includes(e.date)) continue;
    const c = evComp(e), cat = GROUP_CAT[c.group], exam = e.comp === 'EXAM', ours = exam ? examMine(e) : [];
    const ids = calEventIds(e), mineUnit = (e.units || []).some(u => u.clubId === G.clubId) || ours.length > 0;
    const cc = c.cc || (['fim', 'fime'].includes(cat) ? (geoOf(e.venue) || [])[2] || 'INT' : 'POL'), t = calTypeOf(e, c, cat);
    if (exam) { add(e.date, `<div class="ev ${cat} play ${ours.length ? 'mine' : ''}" onclick="go('#/gp/${e.id}')" title="${esc(e.name)}${e.venue ? ' – ' + esc(e.venue) : ''}${ours.length ? ' · nasi: ' + esc(ours.join(', ')) : ''}">🎓 Egzamin na licencję<div class="small muted">${ours.length ? `nasi: ${esc(ours.join(', '))}` : esc(e.venue || '')}</div></div>`, cc, 'mlodziez', ids, mineUnit); continue; }
    const info = e.kind === 'mini-info';
    add(e.date, `<div class="ev ${cat || 'kraje'} ${info ? 'info' : 'play'}" onclick="go('#/gp/${e.id}')" title="${esc(e.name)}${e.venue ? ' – ' + esc(e.venue) : ''}${info && e.foreign ? ' · w kalendarzu, bez symulacji (brak zawodników tej klasy w grze)' : ''}">${c.cc && c.cc !== 'POL' ? flag(c.cc) + ' ' : info ? '' : '🏁 '}${esc(e.name)}<div class="small muted">${e.played ? winnerLabel(e).replace(/<a [^>]*>|<\/a>/g, '') : esc(e.venue || '')}${e.cls ? ` · ${esc(e.cls)} cm³` : ''}</div></div>`, cc, t, ids, mineUnit);
  }
  if (typeof fCalEntries === 'function') for (const x of fCalEntries(days)) all.push(x); // ligi zagraniczne i puchary (js/ui-foreign.js)
  for (const e of realEvents()) if (days.includes(e.d) && !gameEventFor(e)) add(e.d, `<div class="ev ${e.cat} reserve" title="${esc(e.name)}">${esc(e.name.replace(/\s*-\s*data\s+rezer\w*/i, ''))}<div class="small muted">termin rezerwowy</div></div>`,
    e.cat === 'fim' || e.cat === 'fime' ? (geoOf(e.place) || [])[2] || 'INT' : 'POL', e.cat === 'fim' || e.cat === 'fime' ? 'fim' : e.cat === 'mlodziez' || e.cat === 'mini' ? 'mlodziez' : 'ind');
  // filtr: rodzaj, kraj, udział naszych / obserwowanych zawodników
  const ccs = [...new Set(all.map(x => x.cc).filter(Boolean))];
  const shown = all.filter(x => F.types[x.t] !== false && (!F.cc || x.cc === F.cc) && (F.who === 'all' || x.t === 'info' || (F.who === 'mine' ? x.mine : x.watch)));
  const byDate = {};
  for (const x of shown) (byDate[x.d] ||= []).push(x.html);
  const hidden = all.length - shown.length;
  return { title: 'Kalendarz', sub: `Sezon ${G.season} · dziś ${fmtDay(G.date)}`, tabs: T, body: `
    <div class="cal-head"><button class="btn" onclick="ACT.calMove(-1)">‹</button><h2>${MONTHS[m - 1]} ${y}</h2><button class="btn" onclick="ACT.calMove(1)">›</button><button class="btn ghost" onclick="UI.cal=null;render()">Dziś</button></div>
    ${calFilterBar(F, ccs, hidden)}
    <div class="cal">${DAYS_SHORT.map(d => `<div class="dh">${d}</div>`).join('')}${days.map(d => `<div class="day ${d.slice(0, 7) !== UI.cal ? 'out' : ''} ${d === G.date ? 'today' : ''} ${d < G.date ? 'past' : ''}"><div class="n"><span>${Number(d.slice(8))}</span>${d === G.date ? '<span>dziś</span>' : ''}</div>${(byDate[d] || []).join('')}</div>`).join('')}</div>` };
};
// ---------- Filtry kalendarza ----------
// Kto: wszystkie imprezy / z udziałem naszych zawodników (także adeptów) / z udziałem obserwowanych; kraj; rodzaje imprez
const CAL_TYPES = { liga: 'Liga polska', zagr: 'Ligi zagraniczne', puchar: 'Puchary', ind: 'Mistrzostwa indywidualne', pary: 'Pary i drużyny', turniej: 'Turnieje', fim: 'FIM i FIM Europe', mlodziez: 'Młodzież i miniżużel', spar: 'Sparingi i obozy', info: 'Terminy' };
const CAL_WHO = { all: 'wszystkie', mine: 'z naszymi zawodnikami', watch: 'z obserwowanymi' };
function calFilter() {
  if (!UI.calF) UI.calF = { who: 'all', cc: '', allLeague: false, types: { mlodziez: false } };
  return UI.calF;
}
function calMyIds() {
  const s = new Set(Object.values(G.riders).filter(r => r.clubId === G.clubId).map(r => String(r.id)));
  for (const k of Object.values(G.academy || {})) if (k.clubId === G.clubId) s.add(String(k.id));
  return s;
}
function calEventIds(e) {
  const m = e.matchId && G.matches[e.matchId];
  if (m && m.riders) return Object.keys(m.riders);
  if (e.kind === 'sgp' && G.sgp) return (G.sgp.riders || []).slice(0, 16).map(String);
  if (e.startList) return e.startList.map(x => String(x.id));
  if (e.units) return e.units.flatMap(u => u.riders || []).filter(x => x != null).map(String);
  return [];
}
function calTypeOf(e, c, cat) {
  if (c.fType) return c.fType;
  if (cat === 'fim' || cat === 'fime') return 'fim';
  if (cat === 'mlodziez' || cat === 'mini' || e.mini) return 'mlodziez';
  return c.format === 'ind' ? (c.group === 'turnieje' ? 'turniej' : 'ind') : 'pary';
}
function calFilterBar(F, ccs, hidden) {
  const cc = [...new Set(['POL', ...ccs, ...(F.cc ? [F.cc] : [])])].sort((a, b) => (a === 'POL' ? -1 : b === 'POL' ? 1 : (COUNTRY[a] || a).localeCompare(COUNTRY[b] || b, 'pl')));
  return `<div class="chip-groups" style="margin:8px 0 10px">
    <div class="chip-row"><span class="chip-lbl">Pokaż</span>${Object.entries(CAL_WHO).map(([k, l]) => `<span class="chip ${F.who === k ? 'on' : ''}" onclick="UI.calF.who='${k}';render()">${l}</span>`).join('')}
      <label class="small" style="margin-left:12px">Kraj <select onchange="UI.calF.cc=this.value;render()"><option value="">wszystkie kraje</option>${cc.map(c => `<option value="${c}" ${F.cc === c ? 'selected' : ''}>${c === 'INT' ? 'międzynarodowe' : esc(COUNTRY[c] || c)}</option>`).join('')}</select></label>
      <label class="small row" style="margin-left:12px"><input type="checkbox" ${F.allLeague ? 'checked' : ''} onchange="UI.calF.allLeague=this.checked;render()"> wszystkie mecze lig polskich</label></div>
    <div class="chip-row"><span class="chip-lbl">Rodzaje</span>${Object.entries(CAL_TYPES).map(([k, l]) => `<span class="chip ${F.types[k] !== false ? 'on' : 'ghost'}" onclick="UI.calF.types['${k}']=UI.calF.types['${k}']===false;render()">${l}</span>`).join('')}
      <span class="chip ghost" onclick="UI.calF={who:'all',cc:'',allLeague:false,types:{}};render()">pokaż wszystko</span>${hidden ? `<span class="small muted" style="margin-left:8px">ukryto: ${hidden}</span>` : ''}</div></div>`;
}
// Imprezy spoza gry: kalendarz GKSŻ/PZM i mistrzostwa FIM (js/calendar.js)
const EV_CATS = { fim: 'FIM', fime: 'Europa (FIM Europe)', pzm: 'GKSŻ – krajowe', mlodziez: 'młodzież / 500R', mini: 'Miniżużel' };
UI.calCats = { fim: true, fime: true, pzm: true, mlodziez: false, mini: true };
function realEvents() {
  if (!CAL) return [];
  if (!CAL._ev) CAL._ev = [...CAL.events.map((e, i) => ({ ...e, key: `e${i}` })),
    ...CAL.fim.map((e, j) => ({ d: e.d, name: `${e.label} – ${e.stage}`, place: e.venue, cat: 'fim', major: e.series === 'SWC' || e.series === 'SON', time: e.time, key: `f${j}`, series: e.series })).filter(e => e.series !== 'SGP')].sort(by(e => e.d));
  return [...CAL._ev, ...(typeof MINI_CALENDAR === 'undefined' ? [] : MINI_CALENDAR.events.map(e => ({ d:e.date, name:e.name || COMPS[e.comp].name, place:e.venue, cat:'mini', key:e.id })))].sort(by(e=>e.d));
}
function gameEventFor(e) { return Object.values(G.events).find(x => x.calKey === e.key && x.season === yearOf(e.d)) || null; }
// Karta wpisu kalendarza (terminy rezerwowe); zawody rozgrywane w grze otwierają ekran zawodów
PAGES.impreza = parts => {
  const e = realEvents().find(x => x.key === parts[0]);
  if (!e) return { title: 'Nie znaleziono imprezy', body: '' };
  const ge = gameEventFor(e);
  if (ge) { setTimeout(() => go(`#/gp/${ge.id}`), 0); return { title: '', body: '' }; }
  const name = e.name.replace(/\s*-\s*data\s+rezer\w*/i, '');
  return { title: esc(name), sub: `${fmtDay(e.d)} · termin rezerwowy`, body: `<div class="panel"><div class="kv"><div>Zawody</div><div>${esc(name)}</div><div>Termin</div><div>${fmtDay(e.d)}</div><div>Rodzaj</div><div>termin rezerwowy – wykorzystywany w razie przełożenia zawodów</div></div></div>` };
};
function eventsList() {
  const q = UI.evCat || '';
  const sgp = Object.values(G.events).filter(e => e.kind === 'sgp' && CAL && e.season === CAL.season).map(e => ({ d: e.date, name: `Speedway Grand Prix – runda ${e.round}`, place: e.venue, cat: 'fim', major: true, gp: e.id, time: e.time }));
  const list = [...realEvents().map(e => { const ge = gameEventFor(e); return ge ? { ...e, gp: ge.id, played: ge.played } : { ...e, info: true }; }), ...sgp].filter(e => !q || e.cat === q).sort(by(e => e.d));
  return `<div class="filters"><label class="fld">Kategoria<select onchange="UI.evCat=this.value;render()"><option value="">wszystkie</option>${Object.entries(EV_CATS).map(([k, l]) => `<option value="${k}" ${q === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><span class="small muted">${list.length} imprez</span></div>
    <div class="panel flush"><table class="t"><thead><tr><th>Data</th><th>Impreza</th><th>Miejsce</th><th>Kategoria</th></tr></thead><tbody>
    ${list.map(e => `<tr class="${e.gp ? 'click' : ''} ${e.d < G.date ? 'dim' : ''}" ${e.gp ? `onclick="go('#/gp/${e.gp}')"` : ''}><td class="nowrap">${fmtDateShort(e.d)} <span class="small muted">${DAYS_SHORT[dow(e.d)]}${e.time ? ' ' + e.time : ''}</span></td><td>${e.gp ? '🏁 ' : ''}${e.major ? '<b>' : ''}${esc(e.name)}${e.major ? '</b>' : ''}</td><td>${esc(e.place || '')}</td><td><span class="ev-dot ${e.cat}"></span>${EV_CATS[e.cat]}</td></tr>`).join('')}</tbody></table></div>`;
}
ACT.calMove = d => { const [y, m] = UI.cal.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1 + d, 1)); UI.cal = iso(dt).slice(0, 7); render(); };
function fixtureRow(f) {
  const h = G.clubs[f.homeId], a = G.clubs[f.awayId];
  return `<tr class="click ${isMine(f) ? 'me' : ''}" onclick="go('#/zawody/${f.id}')"><td class="nowrap">${fmtDateShort(f.date)} <span class="small muted">${DAYS_SHORT[dow(f.date)]}</span></td><td><a href="${clubHref(h.id)}" onclick="event.stopPropagation()">${crest(h, 'sm')} <b>${esc(h.name)}</b></a> – <a href="${clubHref(a.id)}" onclick="event.stopPropagation()">${crest(a, 'sm')} ${esc(a.name)}</a></td><td class="small muted">${esc(LEAGUES[f.league].short)} · ${fxLabel(f)}</td><td class="num"><b>${f.played ? `${f.homePts} : ${f.awayPts}` : '–'}</b>${f.runoff ? ' <span class="small muted">(b. dod.)</span>' : ''}</td></tr>`;
}

// ---------- Liga ----------
PAGES.liga = parts => {
  const sub = parts[0] || '';
  const lg = UI.league && (LEAGUES[UI.league] || UI.league === 'U24') ? UI.league : myClub().league;
  const T = tabs('liga', [['', 'Tabela'], ['terminarz', 'Terminarz'], ['statystyki', 'Statystyki'], ['historia', 'Historia']], sub);
  const sel = `<select onchange="UI.league=this.value;render()">${LEAGUE_ORDER.map(l => `<option value="${l}" ${l === lg ? 'selected' : ''}>${LEAGUES[l].name}</option>`).join('')}<option value="U24" ${lg === 'U24' ? 'selected' : ''}>Ekstraliga U24</option></select>`;
  // sezony z rozegranymi lub zaplanowanymi meczami ligowymi (przełącznik – także po zakończeniu sezonu)
  const seasons = [...new Set([G.season, ...Object.values(G.fixtures).map(f => f.season)])].filter(Boolean).sort((a, b) => b - a);
  const S = seasons.includes(Number(UI.leagueSeason)) ? Number(UI.leagueSeason) : G.season;
  const selS = lg === 'U24' || sub === 'historia' ? `sezon ${G.season}` : `<select onchange="UI.leagueSeason=this.value;render()">${seasons.map(y => `<option value="${y}" ${y === S ? 'selected' : ''}>sezon ${y}</option>`).join('')}</select>`;
  const head = { title: `${leagueLogo(lg)} Liga`, sub: `${sel} · ${selS}`, tabs: T };
  if (lg === 'U24') return { ...head, body: u24League(sub) };
  if (sub === 'terminarz') return { ...head, body: leagueFixtures(lg, S) };
  if (sub === 'statystyki') return { ...head, body: leagueStats(lg, S) };
  if (sub === 'historia') return { ...head, body: leagueHistory(lg) };
  const t = leagueTable(lg, S);
  const n = t.length;
  return { ...head, body: `<div class="grid g-side"><div class="panel flush"><table class="t"><thead><tr><th>#</th><th>Klub</th><th class="num">M</th><th class="num">Z</th><th class="num">R</th><th class="num">P</th><th class="num">Pkt biegowe</th><th class="num">+/-</th><th class="num">Bonus</th><th class="num">Pkt</th><th>Forma</th></tr></thead><tbody>
    ${t.map(r => { const c = G.clubs[r.clubId]; return `<tr class="${r.clubId === G.clubId ? 'me' : ''} ${r.pos <= 4 ? 'zone-po' : r.pos === n ? 'zone-dn' : ''}"><td>${r.pos}</td><td><a class="clubname" href="${clubHref(c.id)}">${crest(c, 'sm')}<b>${esc(c.name)}</b></a></td><td class="num">${r.m}</td><td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num">${r.pf}:${r.pa}</td><td class="num ${r.pf - r.pa > 0 ? 'pos' : r.pf - r.pa < 0 ? 'neg' : ''}">${r.pf - r.pa > 0 ? '+' : ''}${r.pf - r.pa}</td><td class="num">${r.bonus}</td><td class="num"><b>${r.pts}</b></td><td>${r.form.map(x => `<span class="pill ${x === 'W' ? 'ok' : x === 'P' ? 'inj' : ''}" style="padding:1px 5px">${x}</span>`).join(' ')}</td></tr>`; }).join('')}</tbody></table>
    <p class="small muted" style="padding:0 14px">Zielony pasek – miejsca premiowane grą w play-off. Czerwony – spadek (w 2. Ekstralidze i KLŻ awansuje zwycięzca finału). Punkt bonusowy za lepszy bilans dwumeczu.</p></div>
    <div class="panel"><h3>Play-off</h3>${bracket(lg, S)}</div></div>` };
};
// Ekstraliga U24: cykl czwórmeczów (zawody U24E) – tabela, terminarz i historia jak w zakładce Zawody, statystyki z protokołów rund
function u24League(sub) {
  const page = s => compPage('U24E', s, G.season, '').body;
  if (!compEvents('U24E', G.season).length) return '<div class="panel empty">Terminarz Ekstraligi U24 zostanie opublikowany razem z kalendarzem sezonu.</div>';
  if (sub === 'terminarz') return page('');
  if (sub === 'historia') return page('historia');
  if (sub === 'statystyki') {
    const acc = {};
    for (const e of compEvents('U24E', G.season)) {
      const m = e.played && G.matches[e.matchId];
      if (!m || !m.riders) continue;
      for (const [id, s] of Object.entries(m.riders)) {
        const heats = (s.line || []).filter(x => x !== '-' && x !== '').length;
        if (!heats) continue;
        const a = acc[id] = acc[id] || { id, m: 0, heats: 0, pts: 0, bonus: 0, w: 0 };
        a.m++; a.heats += heats; a.pts += s.pts || 0; a.bonus += s.bonus || 0; a.w += (s.line || []).filter(x => String(x).startsWith('3')).length;
      }
    }
    const rows = Object.values(acc).filter(a => a.heats >= 3 && R(a.id)).sort(by(a => (a.pts + a.bonus) / a.heats, -1));
    setCtx(rows.filter(a => G.riders[a.id]).map(a => a.id), 'Statystyki Ekstraligi U24');
    return `<div class="panel flush"><table class="t"><thead><tr><th>#</th><th>Zawodnik</th><th>Klub</th><th class="num">Rundy</th><th class="num">Biegi</th><th class="num">Pkt</th><th class="num">Bonus</th><th class="num">Średnia</th><th class="num">Wygrane</th></tr></thead><tbody>
      ${rows.map((a, i) => { const r = R(a.id); return `<tr class="${r.clubId === G.clubId ? 'me' : ''}"><td>${i + 1}</td><td>${riderCell(a.id)}</td><td>${clubLink(r.clubId)}</td><td class="num">${a.m}</td><td class="num">${a.heats}</td><td class="num">${a.pts}</td><td class="num">${a.bonus}</td><td class="num"><b>${((a.pts + a.bonus) / a.heats).toFixed(3)}</b></td><td class="num">${a.w}</td></tr>`; }).join('') || '<tr><td colspan="9" class="empty">Statystyki pojawią się po pierwszych rundach (min. 3 biegi).</td></tr>'}</tbody></table></div>`;
  }
  return page('klasyfikacja');
}
function bracket(lg, season = G.season) {
  const fx = seasonFixtures(lg, season).filter(f => f.stage !== 'RS');
  if (!fx.length) return season === G.season ? `<p class="muted">Faza play-off rozpocznie się po 14. kolejce (${fmtDate(playoffDates(G.season, lg).sf1)}).</p>` : '<p class="muted">Brak danych o fazie play-off.</p>';
  const tie = (st, n) => {
    const a = fx.filter(f => f.stage === st && f.tie === n).sort(by(f => f.leg));
    if (!a.length) return '';
    const [f1, f2] = a, agg = f1.played && f2 && f2.played ? aggregate(f1, f2) : null;
    const hi = f2 ? f2.homeId : f1.homeId, lo = f2 ? f2.awayId : f1.awayId;
    const w = f2 && f2.tieWinner;
    return `<div class="tie" onclick="go('#/zawody/${(f2 && f2.played ? f2 : f1).id}')" style="cursor:pointer"><div class="small muted">${STAGE[st]}${st === 'SF' ? ` ${n}` : ''}</div>
      <div class="${w === hi ? 'w' : ''}">${esc(G.clubs[hi].name)} <span style="float:right">${agg ? agg[hi] : ''}</span></div><div class="${w === lo ? 'w' : ''}">${esc(G.clubs[lo].name)} <span style="float:right">${agg ? agg[lo] : ''}</span></div>
      <div class="small muted">${a.map(f => f.played ? `${f.homePts}:${f.awayPts}` : fmtDateShort(f.date)).join(' · ')}${f2 && f2.runoff ? ' · bieg dodatkowy' : ''}</div></div>`;
  };
  return `${tie('SF', 1)}${tie('SF', 2)}${tie('F', 1)}${tie('B', 1)}${tie('BZ', 1)}`;
}
function leagueFixtures(lg, season = G.season) {
  const fx = seasonFixtures(lg, season).sort(by(f => f.date + f.id));
  const groups = {};
  for (const f of fx) { const k = f.stage === 'RS' ? `${f.round}. kolejka` : STAGE[f.stage]; (groups[k] = groups[k] || []).push(f); }
  return Object.entries(groups).map(([k, list]) => `<div class="panel flush" style="margin-bottom:12px"><div class="ph"><h3>${k}</h3><span class="small muted">${fmtDate(list[0].date)}</span></div><table class="t"><tbody>${list.map(fixtureRow).join('')}</tbody></table></div>`).join('');
}
function leagueStats(lg, season = G.season) {
  // drużyny ligi w danym sezonie (z terminarza); zawodnik – klub z kariery sezonu, w bieżącym sezonie obecny klub
  const clubs = new Set(seasonFixtures(lg, season).flatMap(f => [f.homeId, f.awayId]));
  if (!clubs.size) Object.values(G.clubs).filter(c => c.league === lg).forEach(c => clubs.add(c.id));
  const clubOf = r => { const k = (r.career || []).find(x => x.season === season); return k ? k.clubId : season === G.season ? r.clubId : null; };
  const rows = Object.values(G.riders).filter(r => clubs.has(clubOf(r)) && r.stats[season] && r.stats[season].heats >= 5).map(r => ({ r, s: r.stats[season], c: clubOf(r) }))
    .sort(by(x => (x.s.pts + x.s.bonus) / x.s.heats, -1));
  setCtx(rows.map(x => x.r.id), 'Statystyki ligi');
  return `<div class="panel flush"><table class="t"><thead><tr><th>#</th><th>Zawodnik</th><th>Klub</th><th class="num">Mecze</th><th class="num">Biegi</th><th class="num">Pkt</th><th class="num">Bonus</th><th class="num">Średnia</th><th class="num">Wygrane</th></tr></thead><tbody>
    ${rows.map((x, i) => `<tr class="click ${x.r.clubId === G.clubId ? 'me' : ''}" onclick="go('#/zawodnik/${x.r.id}/statystyki')"><td>${i + 1}</td><td>${flag(x.r.country)} <b>${esc(x.r.name)}</b></td><td>${clubLink(x.c)}</td><td class="num">${x.s.m}</td><td class="num">${x.s.heats}</td><td class="num">${x.s.pts}</td><td class="num">${x.s.bonus}</td><td class="num"><b>${((x.s.pts + x.s.bonus) / x.s.heats).toFixed(3)}</b></td><td class="num">${x.s.w}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Statystyki pojawią się po pierwszych meczach (min. 5 biegów).</td></tr>'}</tbody></table></div>`;
}
// Historia ligi: medaliści sezonów rozegranych w grze (miejsca końcowe z historii klubów) i ruchy między ligami
function leagueHistory(lg) {
  const medal = ['🥇', '🥈', '🥉'];
  // sezony rozegrane w grze
  const seasons = [...new Set(Object.values(G.clubs).flatMap(c => (c.history || []).filter(h => h.league === lg).map(h => h.season)))].sort((a, b) => b - a);
  const rows = seasons.map(y => {
    const order = Object.values(G.clubs).map(c => [c, (c.history || []).find(h => h.season === y && h.league === lg)]).filter(([, h]) => h).sort((a, b) => a[1].pos - b[1].pos);
    const ids = new Set(order.map(([c]) => c.id)), gh = G.history.find(h => h.season === y);
    const moves = gh ? gh.moves.filter(m => ids.has(m[0])) : [];
    return `<tr class="me"><td><b>${y}</b> <span class="pill">gra</span></td><td>${esc(LEAGUES[lg].name)}</td>${[0, 1, 2].map(i => `<td>${order[i] ? `${medal[i]} ${clubLink(order[i][0].id)}` : '—'}</td>`).join('')}
      <td class="small">${moves.map(m => `${esc(G.clubs[m[0]].short)} – ${esc(m[2])} (${esc(LEAGUES[m[1]] ? LEAGUES[m[1]].short : m[1])})`).join('<br>') || '—'}</td></tr>`;
  });
  // sezony do startu gry (js/club-history.js) – według poziomu: dawna 1 liga = Ekstraliga, dawna 2 liga = 2. Ekstraliga, 3 liga = KLŻ
  const level = HIST_GAME_LEAGUE.indexOf(lg);
  if (level >= 0 && typeof CLUB_HIST !== 'undefined') {
    const bySlug = new Map(Object.values(G.clubs).map(c => [clubHistSlug(c), c]));
    const team = (slug, r) => { const c = bySlug.get(slug); return c ? `<a class="clubname" href="${clubHref(c.id)}">${crest(c, 'sm')}<span>${esc(r.name || r.team)}</span></a>` : esc(r.name || r.team); };
    const real = {};
    for (const [slug, list] of Object.entries(CLUB_HIST.teams)) for (const r of list) if (r.season <= START_SEASON && histLevel(r.season, r.league) === level) (real[r.season] = real[r.season] || []).push({ ...r, slug });
    for (const y of Object.keys(real).map(Number).sort((a, b) => b - a)) {
      const rs = real[y], groups = [...new Set(rs.map(r => r.group || ''))];
      const at = p => groups.map(g => rs.find(r => (r.group || '') === g && r.pos === p)).filter(Boolean);
      const cell = (p, i) => { const xs = at(p); return xs.length ? xs.map(r => `${medal[i]} ${team(r.slug, r)}${r.group ? ` <span class="small muted">(${esc(r.group)})</span>` : ''}`).join('<br>') : '—'; };
      const mv = rs.filter(r => (r.tags || []).some(t => t === 'up' || t === 'down')).sort((a, b) => a.pos - b.pos)
        .map(r => `${esc(r.name || r.team)} – ${(r.tags || []).includes('up') ? 'awans' : 'spadek'}`);
      rows.push(`<tr><td><b>${y}</b></td><td>${esc(rs[0].league)}</td>${[1, 2, 3].map(cell).map(c => `<td>${c}</td>`).join('')}<td class="small">${mv.join('<br>') || '—'}</td></tr>`);
    }
  }
  if (!rows.length) return '<div class="panel empty">Historia rozgrywek zapisze się po zakończeniu pierwszego sezonu.</div>';
  const sub = level === 0 ? 'do 1999 r. najwyższa klasa – „1 liga”' : level === 1 ? 'do 1999 r. – „2 liga”, 2000–2025 – „1 liga”' : level === 2 ? '1957–1959 – „3 liga”, 2000–2025 – „2 liga”' : 'sezony rozegrane w grze';
  return `<div class="panel flush"><div class="ph"><h3>${esc(LEAGUES[lg].name)} – medaliści</h3><span class="small muted">${sub}</span></div><table class="t"><thead><tr><th>Sezon</th><th>Rozgrywki</th><th>Mistrz</th><th>Wicemistrz</th><th>Brązowy medal</th><th>Awanse / spadki</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
    <p class="small muted">Sezony do ${START_SEASON}: Polish Speedway Database (1961–${START_SEASON}) i speedwayw.pl (1948–1961), przypisane do dzisiejszej ligi według poziomu rozgrywek. Miejsca – ostateczna kolejność; w sezonach z grupami – osobno każda grupa.</p>`;
}

// ---------- Zawody ----------
function helmet(color) { return `<span class="helmet" style="background:${HELMET_COLOR[color]}" title="kask ${color}"></span>`; }
PAGES.zawody = parts => {
  const f = G.fixtures[parts[0]];
  if (!f) return { title: 'Nie znaleziono zawodów', body: '' };
  const sub = parts[1] || '';
  const m = f.matchId && G.matches[f.matchId];
  const h = G.clubs[f.homeId], a = G.clubs[f.awayId];
  const today = f.date === G.date && !f.played && isMine(f);
  const w = m ? m.weather : weatherFor(f.date, G.seed);
  const score = m ? m.score : f.played ? { H: f.homePts, A: f.awayPts } : null;
  const head = `<div class="page-head"><div class="small muted">${leagueLogo(f.league, 'sm')} ${esc(LEAGUES[f.league].name)} · ${fxLabel(f)} · ${fmtDay(f.date)}</div>
    <div class="scoreboard"><div class="team"><a href="${clubHref(h.id)}">${crest(h, 'lg')}</a><span>${esc(h.name)}<div class="small muted" style="text-transform:none">gospodarz · ${esc(h.stadium.name)}</div></span></div>
      <div class="score">${score ? `${score.H} : ${score.A}` : 'vs'}<small>${m && !m.done ? `po ${m.heats.length} z 15 biegów` : f.played ? 'koniec' : fmtDateShort(f.date)}${f.runoff ? ' · bieg dodatkowy' : ''}</small></div>
      <div class="team away"><a href="${clubHref(a.id)}">${crest(a, 'lg')}</a><span>${esc(a.name)}<div class="small muted" style="text-transform:none">goście</div></span></div></div>
    <div class="weather"><span>🌡 ${w.temp}°C</span><span>${esc(w.sky)}</span><span>tor: ${esc(w.track)}</span><span>długość toru ${h.stadium.track} m</span>${m && /set-\d$/.test(m.heatTableId || '') ? `<span title="Zestaw torów na biegi I–XIII losuje sędzia po próbie toru (art. 717); na XIV–XV wybiera drużyna przegrywająca">zestaw torów ${m.heatTableId.slice(-1)}${m.nominatedSet && m.heats.length >= 13 ? ` · XIV–XV: ${m.nominatedSet}` : ''}</span>` : ''}${m && m.attendance ? `<span>widzów: ${fmtNum(m.attendance)}</span>` : ''}</div>
    ${m ? tabs(`zawody/${f.id}`, [['', 'Przebieg'], ['protokol', 'Protokół'], ['program', 'Program']], sub) : '<div style="height:14px"></div>'}</div>`;
  if (!m) return { head, body: matchPreview(f, today) };
  if (sub === 'protokol') return { head, body: protocol(m) };
  if (sub === 'program') return { head, body: programView(m) };
  return { head, body: matchLive(m, f) };
};
function matchPreview(f, today) {
  const side = id => {
    const line = id === G.clubId ? validLineup(id, G.lineups[G.clubId] || autoLineup(id), f.date) : (notifiedLine(f, id) || autoLineup(id, f.date));
    const base = id === f.homeId ? 9 : 1;
    return `<table class="t"><tbody>${line.map((rid, i) => { const r = G.riders[rid]; return `<tr><td style="width:36px"><b>${base + i}</b></td><td>${r ? `${flag(r.country)} ${riderLink(rid)}` : '<span class="neg">brak</span>'}</td><td class="small muted">${SLOT_LABEL(i + 1)}</td><td>${r ? caStars(r) : ''}</td></tr>`; }).join('')}</tbody></table>`;
  };
  const t = f.stage === 'RS' ? leagueTable(f.league) : [];
  const pos = id => { const r = t.find(x => x.clubId === id); return r && r.m ? `${r.pos}. miejsce, ${r.pts} pkt` : ''; };
  const past = f.date < G.date || f.played;
  return `${today ? `<div class="panel next-heat" style="margin-bottom:16px"><div class="row wrap"><div class="grow"><b>Dzień meczowy!</b> Sprawdź skład, a następnie rozpocznij zawody – możesz śledzić mecz bieg po biegu (nominacje do biegów 14–15, rezerwa taktyczna) albo zasymulować całość.</div>
      <a class="btn" href="#/druzyna/taktyka">Ustaw skład</a><button class="btn primary lg" onclick="ACT.startMatch('${f.id}')">Rozpocznij zawody</button><button class="btn" onclick="ACT.quickMatch('${f.id}')">Symuluj cały mecz</button></div></div>` : ''}
    ${past && !f.played ? '<div class="panel muted">Mecz nie został rozegrany.</div>' : ''}
    ${!past && (f.homeId === G.clubId || f.awayId === G.clubId) ? trackPrepPanel(f.id, f.homeId, f.awayId, validLineup(G.clubId, G.lineups[G.clubId] || autoLineup(G.clubId, f.date), f.date)) : ''}
    <div class="grid g2"><div class="panel flush"><div class="ph"><h3>${esc(G.clubs[f.homeId].name)} (9–16)</h3><span class="small muted">${pos(f.homeId)}</span></div>${side(f.homeId)}</div>
      <div class="panel flush"><div class="ph"><h3>${esc(G.clubs[f.awayId].name)} (1–8)</h3><span class="small muted">${pos(f.awayId)}</span></div>${side(f.awayId)}</div></div>
    <p class="small muted">Składy awizowane – mogą się jeszcze zmienić do dnia zawodów.</p>`;
}
const matchDayGate = f => { const iss = !f.matchId && typeof matchDayIssue === 'function' && matchDayIssue(f); if (iss) { UI.tacMode = 'liga'; toast(`Uzupełnij skład przed meczem: ${iss}`, 'bad'); go('#/druzyna/taktyka'); } return !!iss; };
ACT.startMatch = id => { const f = G.fixtures[id]; if (matchDayGate(f)) return; if (!f.matchId) createMatch(f); dbQueueSave(); go(`#/zawody/${id}`); };
ACT.quickMatch = id => { const f = G.fixtures[id]; if (matchDayGate(f)) return; const m = f.matchId ? G.matches[f.matchId] : createMatch(f); simulateMatch(m); afterFixture(f); changed(); toast(`Koniec meczu: ${m.score.H}:${m.score.A}`, 'good'); };
function heatRiders(heat, m) {
  const mineTeam = m.homeId === G.clubId ? 'H' : m.awayId === G.clubId ? 'A' : null;
  const byR = Object.fromEntries((heat.res || []).map(x => [x.riderId, x]));
  const ord = heat.entries.slice().sort(by(e => { const x = byR[e.riderId]; return x ? (x.pos || 9) : 5; }));
  return ord.map(e => { const x = byR[e.riderId]; const r = G.riders[e.riderId];
    return `<div class="hr ${e.team === mineTeam ? 'me' : ''}">${helmet(e.helmet)}<span class="gate">${e.gate}</span><span class="nm">${r ? `${e.slot ? `<span class="muted">${e.slot}.</span> ` : ''}${esc(r.name)}${e.team === mineTeam ? heatEngineNote(e) : ''} <span class="small muted">${esc(G.clubs[r.clubId] ? G.clubs[r.clubId].short : '')}</span>` : '<span class="muted">— brak zawodnika —</span>'}</span>
      <span class="p">${x ? (x.status ? `<span class="neg">${x.status}</span>` : `${x.pts}${x.bonus ? '<sup>*</sup>' : ''}`) : ''}</span></div>`; }).join('');
}
function heatBox(heat, m) {
  return `<div class="heat"><div class="hh"><span>Bieg ${heat.no}${heat.no >= 14 ? ' (nominowany)' : ''}</span><span class="small muted">${heat.time ? `${heat.time.toFixed(2).replace('.', ',')} s` : ''}</span><span class="hs">${heat.heatScore.H}:${heat.heatScore.A} <span class="muted small">(${heat.total.H}:${heat.total.A})</span></span></div>
    <div class="rows"><div class="riders">${heatRiders(heat, m)}</div><div class="log">${heat.log.map(l => `<div>${l}</div>`).join('')}</div></div></div>`;
}
function matchLive(m, f) {
  const mineTeam = m.homeId === G.clubId ? 'H' : m.awayId === G.clubId ? 'A' : null;
  let ctrl = '';
  if (!m.done && mineTeam) {
    const idx = m.heats.length;
    const raw = idx < 13 ? heatEntries(m, idx) : null;
    // braki w naszej drużynie (nieobecny, zastępowany, pusty numer): zastępcę wskazuje gracz
    const gaps = raw ? raw.filter(e => e.team === mineTeam && needsSub(m, e)).map(e => ({ e, c: subCandidates(m, idx, raw, e) })) : [];
    const entries = withReserves(m, idx, heatEntries(m, idx), true); // podgląd – rezerwy bez oznaczania
    delete m.nominations[idx];
    const inHeat = entries.filter(e => e.team === mineTeam);
    let extra = '';
    if (idx === 13) {
      // art. 722 ust. 1: po biegu XIII kierownik zgłasza od razu obsadę biegów XIV i XV; XV – dwaj najlepsi z numerów 1–5, XIV – pozostali,
      // w obu biegach w ich miejsce rezerwa zwykła (nr 6–8) z wolnym startem. Art. 717: zestaw torów XIV–XV wybiera drużyna przegrywająca (remis – goście)
      const o14 = nominationOptions(m, 13, mineTeam), o15 = nominationOptions(m, 14, mineTeam);
      const pad = l => [l[0] || 0, l[1] || 0];
      const keep = UI.nom && UI.nom.idx === 13 && UI.nom.m === m.id;
      const chooser = nominatedChooser(m) === mineTeam;
      UI.nom = keep ? UI.nom : { m: m.id, idx: 13, x14: pad(nominate(m, 13, mineTeam)), x15: pad(nominate(m, 14, mineTeam)), set: 1 };
      const label = (o, rid) => `${esc(G.riders[rid].name)} (${m.riders[rid].pts}+${m.riders[rid].bonus}${o.reserves.includes(rid) ? `, rezerwa zwykła, startów ${m.riders[rid].heats}` : ''})`;
      const sels = (o, key) => [0, 1].map(k => `<select onchange="UI.nom.${key}[${k}]=+this.value"><option value="0">— brak —</option>${[...o.seniors, ...o.reserves].map(rid => `<option value="${rid}" ${UI.nom[key][k] === rid ? 'selected' : ''}>${label(o, rid)}</option>`).join('')}</select>`).join('');
      extra = `<div class="row wrap" style="margin-top:10px"><b>Bieg XIV:</b>${sels(o14, 'x14')}<span class="small muted">pozostali zawodnicy z numerów 1–5 albo rezerwa zwykła</span></div>
        <div class="row wrap" style="margin-top:6px"><b>Bieg XV:</b>${sels(o15, 'x15')}<span class="small muted">dwaj zawodnicy z numerów 1–5 z najwyższą sumą punktów albo rezerwa zwykła; limit startów 5</span></div>
        ${chooser ? `<div class="row wrap" style="margin-top:6px"><b>Zestaw torów na biegi XIV–XV:</b><select onchange="UI.nom.set=+this.value">${[1, 2].map(s => `<option value="${s}" ${UI.nom.set === s ? 'selected' : ''}>zestaw ${s} – XIV: pola ${nominatedGates(m, 13, mineTeam, s).join(', ')} · XV: pola ${nominatedGates(m, 14, mineTeam, s).join(', ')}</option>`).join('')}</select><span class="small muted">wybiera drużyna przegrywająca, przy remisie goście (art. 717)</span></div>`
          : '<div class="small muted" style="margin-top:6px">Zestaw torów na biegi XIV–XV wybiera rywal (drużyna przegrywająca, przy remisie goście).</div>'}`;
    } else if (idx === 14) {
      const n = (m.nominations[14] || {})[mineTeam] || [];
      extra = `<div class="small muted" style="margin-top:10px">Obsada biegu XV zgłoszona po biegu XIII: ${n.map(id => id && G.riders[id] ? esc(G.riders[id].name) : '—').join(', ') || '—'}.</div>`;
    } else {
      // rezerwa zwykła z wyboru trenera (biegi I, III–XIII; w biegu II tylko krajowy junior nr 8 za juniora): zawodnik z numerem 6–8
      const benchR = [5, 6, 7].map(i => m.lineup[mineTeam][i]).filter(rid => rid && inHeat.some(e => e.riderId && regularOk(m, mineTeam, idx, entries, rid, e.riderId)));
      if (benchR.length) extra += `<div class="row wrap" style="margin-top:10px"><b>Rezerwa zwykła</b> <span class="small muted">(nr ${mineTeam === 'H' ? '14–16' : '6–8'} za dowolnego zawodnika, bez względu na wynik; musi mu zostać start na każdy jego bieg z programu; limit 5 startów)</span>
        <select id="rzOut">${inHeat.filter(e => e.riderId).map(e => `<option value="${e.riderId}">zmień: ${esc(G.riders[e.riderId].name)} (${m.riders[e.riderId].pts}+${m.riders[e.riderId].bonus})</option>`).join('')}</select>
        <select id="rzIn"><option value="">— bez zmian —</option>${benchR.map(rid => `<option value="${rid}">na: ${esc(G.riders[rid].name)} (${m.riders[rid].pts}+${m.riders[rid].bonus}, startów ${m.riders[rid].heats})</option>`).join('')}</select></div>`;
    }
    if (gaps.length) {
      const picked = entries.filter(x => x.team === mineTeam).map(x => x.riderId);
      extra = `<div class="row wrap" style="margin-top:10px"><b>Brak zawodnika – wskaż zastępcę:</b> <span class="small muted">(art. 718–720: za zawodnika zastępowanego rezerwa zastępująca – dowolny zawodnik drużyny, raz w meczu; w pozostałych przypadkach rezerwa zwykła z nr ${mineTeam === 'H' ? '14–16' : '6–8'}, limit startów)</span></div>`
        + gaps.map(({ e, c }) => { const def = [...c.zz, ...c.rz].find(id => picked.includes(id)) || '';
          return `<div class="row wrap" style="margin-top:6px"><span>Nr ${e.slot}${c.target && G.riders[c.target] ? ` (${esc(G.riders[c.target].name)} – ${m.riders[c.target] && m.riders[c.target].zz ? 'zastępowany' : 'nie może jechać'})` : ' (pusty numer w składzie)'}:</span>
            <select class="gap-pick" data-slot="${e.slot}"><option value="0" ${def ? '' : 'selected'}>— nikt (bieg bez zawodnika) —</option>${c.zz.map(id => `<option value="${id}" ${def === id ? 'selected' : ''}>rez. zastępująca: ${esc(G.riders[id].name)} (startów ${m.riders[id].heats})</option>`).join('')}${c.rz.map(id => `<option value="${id}" ${def === id ? 'selected' : ''}>rez. zwykła: ${esc(G.riders[id].name)} (startów ${m.riders[id].heats})</option>`).join('')}</select>${!c.zz.length && !c.rz.length ? '<span class="small warn">brak uprawnionych zastępców</span>' : ''}</div>`; }).join('') + extra;
    }
    if (tacticalAllowed(m, mineTeam, idx)) { // biegi III–XV, także nominowane (art. 718 ust. 1 pkt 3, art. 722 ust. 2 i 4)
      const bench = m.lineup[mineTeam].filter(rid => rid && inHeat.some(e => e.riderId && tacticalOk(m, mineTeam, idx, entries, rid, e.riderId)));
      extra += `<div class="row wrap" style="margin-top:10px"><b>Rezerwa taktyczna</b> <span class="small muted">(przegrywamy ≥ 6 pkt; każdy zawodnik raz w meczu; za juniorów tylko juniorzy, zagraniczny nr ${mineTeam === 'H' ? 16 : 8} – tylko za U24)</span>
        <select id="tsOut">${inHeat.filter(e => e.riderId).map(e => `<option value="${e.riderId}">zmień: ${esc(G.riders[e.riderId].name)}</option>`).join('')}</select>
        <select id="tsIn"><option value="">— bez zmian —</option>${bench.map(rid => `<option value="${rid}">na: ${esc(G.riders[rid].name)} (${m.riders[rid].pts}+${m.riders[rid].bonus})</option>`).join('')}</select></div>`;
    }
    ctrl = `<div class="heat next-heat"><div class="hh"><span>Następny: bieg ${idx + 1}</span><span class="row"><button class="btn primary" onclick="ACT.nextHeat()">Jedź bieg ▸</button><button class="btn" onclick="ACT.finishMatch()">Do końca ▸▸</button></span></div>
      <div class="riders">${idx < 13 ? entries.map(e => `<div class="hr ${e.team === mineTeam ? 'me' : ''}">${helmet(e.helmet)}<span class="gate">${e.gate}</span><span class="nm">${e.riderId ? `<span class="muted">${e.slot}.</span> ${esc(G.riders[e.riderId].name)}` : '<span class="muted">brak</span>'}</span><span></span></div>`).join('') : '<span class="muted small">Skład biegu zostanie ustalony po nominacjach.</span>'}${extra}${idx < 13 ? matchEnginePicker(m, entries, mineTeam) : ''}</div></div>`;
  }
  const done = m.done ? `<div class="panel" style="margin-bottom:12px"><b>${m.walkover ? `Walkower${m.walkover === 'both' ? ' wzajemny' : ` dla: ${esc(G.clubs[m.walkover === 'H' ? m.awayId : m.homeId].name)}`} – drużyna nie spełniła warunków przystąpienia do meczu (co najmniej 6 zawodników, w tym junior z nr 6–7).` : 'Koniec meczu.'}</b> ${esc(G.clubs[m.homeId].name)} ${m.score.H} : ${m.score.A} ${esc(G.clubs[m.awayId].name)}${f && f.runoff ? `<div class="small">Bieg dodatkowy (dwumecz): wygrał ${riderLink(f.runoff.winner)}.</div>` : ''} <a href="${f ? `#/zawody/${f.id}` : `#/kalendarz/sparing/${m.sparingId}`}/protokol">Protokół ▸</a></div>` : '';
  return `${done}${matchTrackPanel(m, mineTeam)}${ctrl}${m.heats.slice().reverse().map(h => heatBox(h, m)).join('')}${!m.heats.length && !mineTeam ? '<div class="empty">Brak danych</div>' : ''}`;
}
// Mecz na bieżącym ekranie: mecz ligowy (#/zawody/<id>) albo sparing gracza (#/kalendarz/sparing/<id>, js/ui-sparing.js)
function liveMatch() {
  const p = location.hash.slice(2).split('/');
  if (p[0] === 'kalendarz' && p[1] === 'sparing') { const s = G.sparings && G.sparings[p[2]]; return { f: null, m: s && s.match }; }
  const f = G.fixtures[p[1]];
  return { f, m: f && G.matches[f.matchId] };
}
ACT.nextHeat = () => {
  const { f, m } = liveMatch();
  if (!m || m.done) return;
  const mineTeam = m.homeId === G.clubId ? 'H' : 'A', idx = m.heats.length;
  if (idx === 13 && UI.nom && UI.nom.idx === 13 && UI.nom.m === m.id) {
    const o14 = nominationOptions(m, 13, mineTeam), o15 = nominationOptions(m, 14, mineTeam);
    const x14 = UI.nom.x14.filter(Boolean), x15 = UI.nom.x15.filter(Boolean), all = [...x14, ...x15];
    const okIn = (o, l) => l.every(id => o.seniors.includes(id) || o.reserves.includes(id));
    if (new Set(all).size !== all.length) return toast('Ten sam zawodnik nie może jechać w biegu XIV i XV ani dwa razy w jednym biegu.', 'bad');
    if (!okIn(o14, x14) || !okIn(o15, x15)) return toast('Ta nominacja jest niezgodna z regulaminem (art. 722).', 'bad');
    const need = o => Math.min(2, new Set([...o.seniors, ...o.reserves]).size);
    if (x14.length < need(o14) || x15.length < need(o15)) return toast('Uzupełnij obsadę biegów XIV i XV – są jeszcze uprawnieni zawodnicy.', 'bad');
    m.nominations[13] = { ...nominate(m, 13), [mineTeam]: x14 };
    m.nominations[14] = { ...nominate(m, 14), [mineTeam]: x15 };
    if (nominatedChooser(m) === mineTeam) m.nominatedSet = UI.nom.set === 2 ? 2 : 1;
  }
  const pick = (o, i) => { const outEl = $(o), inEl = $(i); return outEl && inEl && inEl.value ? { out: Number(outEl.value), in: Number(inEl.value) } : null; };
  // zastępcy za brakujących zawodników wskazani przez gracza
  const gapSel = [...document.querySelectorAll('.gap-pick')];
  if (gapSel.length) {
    const slots = Object.fromEntries(gapSel.map(el => [el.dataset.slot, Number(el.value) || 0]));
    const ids = Object.values(slots).filter(Boolean);
    if (new Set(ids).size !== ids.length) return toast('Ten sam zawodnik nie może zastąpić dwóch brakujących zawodników w jednym biegu.', 'bad');
    m.subPick = { idx, team: mineTeam, slots };
  } else delete m.subPick;
  const sub = pick('#tsOut', '#tsIn'), reg = pick('#rzOut', '#rzIn');
  const preview = withReserves(m, idx, heatEntries(m, idx), true);
  if (reg && !regularOk(m, mineTeam, idx, preview, reg.in, reg.out)) return toast('Ta zmiana jest niezgodna z regulaminem (rezerwa zwykła).', 'bad');
  if (sub && !tacticalOk(m, mineTeam, idx, preview, sub.in, sub.out)) return toast('Ta zmiana jest niezgodna z regulaminem (rezerwa taktyczna).', 'bad');
  if (sub && reg && (sub.out === reg.out || sub.in === reg.in)) return toast('Rezerwa zwykła i taktyczna muszą dotyczyć różnych zawodników.', 'bad');
  playNextHeat(m, sub || reg ? entries => {
    if (reg) { const e = entries.find(x => x.riderId === reg.out); if (e) applyRegular(m, idx, e, reg.in); }
    if (sub) { const e = entries.find(x => x.riderId === sub.out); if (e) applyTactical(m, idx, e, sub.in, mineTeam); }
    return entries;
  } : null);
  if (m.done && f) afterFixture(f);
  changed();
};
ACT.finishMatch = () => { const { f, m } = liveMatch(); if (!m) return; simulateMatch(m); if (f) afterFixture(f); changed(); };
function protocol(m) {
  // wszystkie numery zgłoszonego składu (1–8 / 9–16): pusty numer – „brak zawodnika”, zawodnik zastępowany – „z/z”
  const side = t => {
    const base = t === 'A' ? 1 : 9, line = (m.lineup && m.lineup[t]) || [];
    const rows = Array.from({ length: 8 }, (_, i) => ({ no: base + i, rid: line[i] || null }));
    for (const [rid, s] of Object.entries(m.riders)) if (s.team === t && !line.some(id => String(id) === rid)) rows.push({ no: s.no || null, rid }); // zgodność ze starszymi meczami
    const tot = sum(Object.values(m.riders).filter(s => s.team === t).map(s => s.pts));
    return `<div class="panel flush"><div class="ph"><h3>${esc(G.clubs[t === 'H' ? m.homeId : m.awayId].name)}</h3><b>${tot}</b></div><table class="t proto"><thead><tr><th>Nr</th><th>Zawodnik</th><th>Biegi</th><th class="num">Pkt</th><th class="num">Bonus</th></tr></thead><tbody>
      ${rows.map(({ no, rid }) => {
        const s = rid && m.riders[rid], r = rid && G.riders[rid];
        if (!s || !r) return `<tr class="dim"><td>${no || ''}</td><td class="muted">brak zawodnika</td><td class="line muted">—</td><td class="num">—</td><td class="num">—</td></tr>`;
        return `<tr class="click" onclick="go('#/zawodnik/${rid}')"><td>${no || s.no || ''}</td><td>${flag(r.country)} <b>${esc(r.name)}</b>${s.zz ? ' <span class="pill" title="zawodnik zastępowany – jego biegi jadą rezerwy">z/z</span>' : ''}</td><td class="line">${s.zz && !s.line.length ? 'z/z' : s.line.join(', ') || '—'}</td><td class="num"><b>${s.pts}</b></td><td class="num">${s.bonus}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  };
  const best = m.heats.filter(h => h.time).sort(by(h => h.time))[0];
  return `<div class="grid g2">${side('H')}${side('A')}</div><div class="panel" style="margin-top:16px"><div class="kv"><div>Najlepszy czas</div><div>${best ? `${best.time.toFixed(2).replace('.', ',')} s – ${esc(G.riders[best.res[0].riderId].name)} (bieg ${best.no})` : '—'}</div>
    <div>Rekord toru</div><div>${(r => r ? `${r.time.toFixed(2).replace('.', ',')} s – ${esc(G.riders[r.riderId].name)} (${fmtDateShort(r.date)})` : '—')(G.clubs[m.homeId].stadium.record)}</div><div>Oznaczenia</div><div class="small">* bonus, u – upadek, d – defekt, w – wykluczenie, t – taśma, z/z – zawodnik zastępowany (jego biegi jadą rezerwy), brak zawodnika – numer bez zgłoszonego zawodnika</div></div></div>`;
}
function programView(m) {
  return `<div class="panel flush"><table class="t"><thead><tr><th>Bieg</th><th>Pole A</th><th>Pole B</th><th>Pole C</th><th>Pole D</th><th class="num">Wynik</th></tr></thead><tbody>
    ${Array.from({ length: 15 }, (_, i) => { const h = m.heats[i]; const ents = h ? h.entries : i < 13 ? heatEntries(m, i) : null;
      if (!ents) return `<tr><td>${i + 1}</td><td colspan="4" class="muted">nominacje</td><td></td></tr>`;
      return `<tr><td>${i + 1}</td>${GATES.map(g => { const e = ents.find(x => x.gate === g); return `<td>${e && e.riderId ? `${helmet(e.helmet)} ${esc(G.riders[e.riderId].name)}` : '—'}</td>`; }).join('')}<td class="num">${h ? `${h.heatScore.H}:${h.heatScore.A}` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
}
