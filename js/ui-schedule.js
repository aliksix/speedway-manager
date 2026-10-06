'use strict';
// Ekrany terminarza: kalendarz zawodnika (starty w Polsce i za granicą, podróże, pobyt w domu, kontuzje),
// dostępność drużyny dzień po dniu (liczba zawodników dostępnych do treningu w klubie).

const ST_CLASS = { race: 'st-race', spar: 'st-spar', travel: 'st-travel', abroad: 'st-abroad', home: 'st-home', inj: 'st-inj', camp: 'st-camp', free: '' };
function monthGrid(ym) {
  const first = `${ym}-01`, start = addDays(first, -dow(first)), days = [];
  for (let i = 0; i < 42; i++) { const d = addDays(start, i); days.push(d); if (i >= 34 && d.slice(0, 7) !== ym && dow(d) === 6) break; }
  return days;
}
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const t = y * 12 + m - 1 + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
ACT.calShift = (key, n) => { UI[key] = shiftMonth(UI[key] || G.date.slice(0, 7), n); render(); };
ACT.calToday = key => { UI[key] = G.date.slice(0, 7); render(); };
function calHead(key) {
  const ym = UI[key] || G.date.slice(0, 7), [y, m] = ym.split('-').map(Number);
  return `<div class="cal-head"><button class="arrow" onclick="ACT.calShift('${key}', -1)">‹</button><h2>${MONTHS[m - 1]} ${y}</h2><button class="arrow" onclick="ACT.calShift('${key}', 1)">›</button><button class="btn sm" onclick="ACT.calToday('${key}')">dziś</button></div>`;
}
function evKindClass(ev) { return ev ? { liga: 'k-liga', gp: 'k-gp', zawody: 'k-zaw', zagranica: 'k-zag', sparing: 'k-spar', oboz: 'k-oboz' }[ev.k] || '' : ''; }

// ---------- Profil zawodnika → Terminarz ----------
function profSchedule(r) {
  const ym = UI.rcal || G.date.slice(0, 7), days = monthGrid(ym);
  const list = riderPlanned(r, addDays(days[0], -3), addDays(days[days.length - 1], 3));
  const cells = days.map(d => {
    const st = dayStatusFrom(r, list, d), past = d < G.date;
    const started = past && (r.slog || []).find(s => s.d === d);
    const chip = st.s === 'free' ? (started ? `<div class="ev k-spar">${esc(started.k === 'sparing' ? 'sparing' : 'start')} · ${started.h} biegów</div>` : '')
      : `<div class="ev ${ST_CLASS[st.s]} ${evKindClass(st.ev)}" ${st.ev && st.ev.link ? `onclick="go('${st.ev.link}')"` : ''}>${esc(st.lbl)}${started && st.ev ? `<div class="small muted">${started.h} biegów</div>` : ''}</div>`;
    return `<div class="day ${d.slice(0, 7) !== ym ? 'out' : ''} ${d === G.date ? 'today' : ''} ${past ? 'past' : ''}"><div class="n"><span>${Number(d.slice(8))}</span>${st.avail && st.s === 'free' ? '<span class="dot ok" title="dostępny do treningu w klubie"></span>' : ''}</div>${chip}</div>`;
  }).join('');
  const fl = r.fl && r.fl.season === G.season ? r.fl : null;
  const rh = rhythmOf(r), tier = travelTier(r), base = baseOf(r);
  const cityOf = g => Object.entries(GEO).find(([, v]) => v === g)?.[0] || COUNTRY[g[2]] || g[2];
  const fs = (o => (Object.keys(o).length ? o : null))(Object.fromEntries(Object.entries((r.fstats && r.fstats[G.season]) || {}).filter(([lg]) => fLeagueOnly(lg)))); // bez pucharów
  const lim = foreignLimit(r, G.season);
  return `<div class="grid g-side"><div class="panel">${calHead('rcal')}<div class="cal">${DAYS_SHORT.map(x => `<div class="dh">${x}</div>`).join('')}${cells}</div>
      <div class="legend" style="margin-top:10px"><span><i class="lg k-liga"></i>liga polska</span><span><i class="lg k-zag"></i>liga zagraniczna</span><span><i class="lg k-gp"></i>Grand Prix</span><span><i class="lg k-zaw"></i>zawody</span><span><i class="lg k-spar"></i>sparing</span><span><i class="lg k-oboz"></i>obóz</span><span><i class="lg st-travel"></i>podróż</span><span><i class="lg st-home"></i>poza Polską</span><span><i class="lg st-inj"></i>kontuzja</span><span><span class="dot ok"></span> dostępny do treningu</span></div></div>
    <div class="stack"><div class="panel"><h3>Starty i podróże</h3><div class="kv">
      <div>Ligi zagraniczne ${G.season}</div><div>${fl && fl.list.length ? fl.list.map(x => `<div>${esc(FOREIGN_LEAGUES[x.id].name)}${x.team ? ` <span class="muted small">(${esc(x.team)})</span>` : ''}</div>`).join('') : '<span class="muted">brak</span>'}
        ${fl && fl.dropped.length ? `<div class="small warn">rezygnacja (limit lig): ${esc(fl.dropped.map(x => FOREIGN_LEAGUES[x.id].name).join(', '))}</div>` : ''}</div>
      <div>Limit lig</div><div class="small">${r.clubId && G.clubs[r.clubId] ? `${lim + 1} ${plural(lim + 1, 'liga', 'ligi', 'lig')} łącznie z polską (${esc(LEAGUES[G.clubs[r.clubId].league].short)}${G.clubs[r.clubId].league !== 'KLZ' ? ', od 2027: 2' : ''})` : 'bez polskiego klubu – bez limitu'}</div>
      <div>Baza</div><div>${esc(cityOf(base))}<div class="small muted">${inSeasonBase(G.date) ? 'w sezonie mieszka przy klubie' : r.country === 'POL' ? 'mieszka w Polsce' : 'poza sezonem w domu'}</div></div>
      <div>Podróże</div><div>${esc(TRAVEL_TIERS[tier])}<div class="small muted">${tier >= 2 ? 'mniej zmęczony po podróży – zdąży się zregenerować' : tier === 1 ? 'odpoczywa w drodze' : 'długie trasy mocno męczą'}</div></div>
      <div>Kondycja</div><div>${bar(r.cond)} <span class="small">${Math.round(r.cond)}%</span></div>
      <div>Rytm zawodów</div><div><b class="${rh.cls}">${esc(rh.lbl)}</b><div class="small muted">${String(rh.rate.toFixed(1)).replace('.', ',')} startu / tydz. (ostatnie 14 dni), optimum ~${rh.opt.toFixed(1).replace('.', ',')}</div></div>
      <div>Dostępność w klubie</div><div>${Math.round(availShare(r) * 100)}% dni <span class="small muted">(±2 tygodnie)</span></div></div>
      <p class="small muted">Optymalnie 2–3 starty w tygodniu (więcej przy dobrej regeneracji i wytrzymałości). Za mało startów – „rdza” (słabszy start i decyzje), za dużo – zmęczenie i większe ryzyko urazu.</p></div>
      ${fs ? `<div class="panel flush"><div class="ph"><h3>Ligi zagraniczne ${G.season}</h3></div><table class="t"><thead><tr><th>Liga</th><th class="num">Mecze</th><th class="num">Biegi</th><th class="num">Pkt</th><th class="num">Śr.</th></tr></thead><tbody>${Object.entries(fs).map(([lg, s]) => `<tr><td>${esc(FOREIGN_LEAGUES[lg].name)}</td><td class="num">${s.m}</td><td class="num">${s.h}</td><td class="num">${s.p}</td><td class="num">${(s.p / s.h).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>` : ''}</div></div>`;
}

// ---------- Drużyna → Dostępność i plan treningu ----------
ACT.avDay = d => { UI.avDay = UI.avDay === d ? null : d; render(); };
// planer treningu i zima za granicą (js/planner.js)
ACT.planMode = m => { ensurePlanModel(); if (m === 'manual' && G.tplan.mode !== 'manual') G.tplan.since = G.date; G.tplan.mode = m; planTouch(); render(); };
ACT.planAdd = (d, t) => { const r = addSession(d, t); if (!r.ok) toast(r.text); render(); };
ACT.planDel = id => { removeSession(id); render(); };
ACT.planCoach = (id, sid) => { const s = G.tplan.s[id]; if (s && s.status === 'plan') { s.coach = sid || null; planTouch(); } render(); };
ACT.planWho = (id, who) => { const s = G.tplan.s[id]; if (s && s.status === 'plan') { s.who = who; planTouch(); } render(); };
ACT.planEx = (id, rid) => { const s = G.tplan.s[id]; if (!s || s.status !== 'plan') return; s.ex = s.ex || []; s.ex = s.ex.includes(rid) ? s.ex.filter(x => x !== rid) : [...s.ex, rid]; planTouch(); render(); };
ACT.planAssist = ym => {
  const r = planAssistMonth(ym);
  toast(r.n ? `${r.asst ? r.asst.name : 'Sztab'} ułożył plan: ${r.n} ${plural(r.n, 'jednostka', 'jednostki', 'jednostek')}${r.miss ? ` (${r.miss} ${plural(r.miss, 'niedociągnięcie', 'niedociągnięcia', 'niedociągnięć')} – sprawdź plan)` : ''}.` : 'Brak wolnych dni do zaplanowania w tym miesiącu.');
  render();
};
ACT.planClear = ym => { for (const s of planAll()) if (s.status === 'plan' && s.date.slice(0, 7) === ym && s.date > G.date) delete G.tplan.s[s.id]; planTouch(); render(); };
ACT.winterDecide = (rid, ok) => { winterDecide(G.riders[rid], ok); render(); };
const GROUP_PL = { tech: 'Technika', physical: 'Fizyczne', mental: 'Mentalne', workshop: 'Warsztat' };
function planHead(ym) {
  const man = typeof planOn === 'function' && planOn();
  const mode = `<div class="chip-row"><span class="chip-lbl">Trening prowadzi</span>
    <span class="chip ${man ? '' : 'on'}" onclick="ACT.planMode('auto')">sztab (automatycznie)</span><span class="chip ${man ? 'on' : ''}" onclick="ACT.planMode('manual')">własny plan</span></div>`;
  if (!man) return `<div class="panel"><h3>Plan treningu</h3>${mode}<p class="small muted">Sztab prowadzi trening według faz roku: motoryka zimą, tor i treningi punktowane przed sezonem, utrzymanie w sezonie. Wybierz „własny plan”, żeby samemu układać jednostki w kalendarzu – dobry plan przyspiesza rozwój, zły (za mało lub przeciążenie) go hamuje.</p></div>`;
  const w = planWeekSummary(), asst = planAssistant();
  const rows = Object.keys(GROUP_PL).map(g => {
    const t = w.T[g], v = w.d[g], f = w.f[g];
    return `<tr><td>${GROUP_PL[g]}</td><td class="num">${v.toFixed(1).replace('.', ',')}</td><td class="num muted">${t.toFixed(1).replace('.', ',')}</td><td style="width:140px">${bar(v, t * 1.6)}</td><td class="num ${f >= 1.05 ? 'pos' : f < 0.9 ? 'neg' : ''}">${Math.round(f * 100)}%</td></tr>`;
  }).join('');
  return `<div class="panel"><h3>Plan treningu</h3>${mode}
    <div class="chip-row" style="margin-top:8px"><button class="btn sm" onclick="ACT.planAssist('${ym}')">${asst ? `${esc(asst.name)} – ułóż miesiąc` : 'Asystent – ułóż miesiąc'}</button><button class="btn sm" onclick="ACT.planClear('${ym}')">Wyczyść plan miesiąca</button></div>
    <table class="t" style="margin-top:10px"><thead><tr><th>Ostatnie 7 dni</th><th class="num">Dawka</th><th class="num">Norma</th><th></th><th class="num">Tempo rozwoju</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="small muted">Faza: ${esc(TRAIN_PHASES[w.ph].name.toLowerCase())}. Dawka to średnia liczba jednostek na zawodnika w grupie atrybutów (ważona jakością prowadzącego). Norma odpowiada treningowi prowadzonemu przez sztab; 55–130% tempa okna.${w.own < 1 ? ` Własny plan od ${fmtDate(G.tplan.since)} – dni wcześniejsze liczą się jak trening sztabu, pełny wpływ planu po tygodniu.` : ''}${w.over ? ` <span class="neg">Przeciążonych zawodników: ${w.over}</span> – więcej urazów i zmęczenia, zaplanuj odnowę.` : ''} Tor i trening punktowany tylko przy dobrej pogodzie – inaczej jednostka przepada.</p></div>`;
}
function planDayPanel(d) {
  if (typeof planOn !== 'function' || !planOn()) return '';
  const ss = planOnDay(d), fut = d > G.date;
  const coaches = clubStaff(G.clubId).filter(s => COACH_GROUP.includes(s.role) || ['fitness', 'psych'].includes(s.role));
  const wthr = dayWeather(d), track = d >= G.date ? `${Math.round(wthr.temp)}°C${wthr.wet ? ', opady' : ''}` : '';
  const sessRows = ss.map(s => {
    const T = SESSION_TYPES[s.type], live = s.status === 'plan';
    const ppl = live ? sessionRiders(s, d) : (s.att || []).map(id => G.riders[id]).filter(Boolean);
    const all = clubRiders(G.clubId).filter(r => r.active !== false && !r.retired && planWhoOk(r, s.who || 'all', d));
    return `<div class="panel" style="margin:8px 0 0"><div class="chip-row"><b>${T.icon} ${esc(T.name)}</b>
        <span class="small ${s.status === 'off' ? 'neg' : s.status === 'done' ? 'pos' : 'muted'}">${s.status === 'plan' ? `zaplanowana${s.by === 'asystent' ? ' (asystent)' : ''}` : s.status === 'done' ? `odbyta – ${ppl.length} ${plural(ppl.length, 'zawodnik', 'zawodników', 'zawodników')}` : `odwołana: ${esc(s.why || '')}`}</span>
        ${live ? `<button class="btn sm" style="margin-left:auto" onclick="ACT.planDel('${s.id}')">Usuń</button>` : ''}</div>
      ${live ? `<div class="chip-row" style="margin-top:6px"><label class="small">Prowadzi <select onchange="ACT.planCoach('${s.id}', this.value ? +this.value : null)">${coaches.map(c => `<option value="${c.id}" ${c.id === s.coach ? 'selected' : ''}>${esc(c.name)} (${esc(staffRoleNames(c))})</option>`).join('')}</select></label>
        <label class="small">Grupa <select onchange="ACT.planWho('${s.id}', this.value)">${Object.entries(PLAN_WHO).map(([k, l]) => `<option value="${k}" ${k === (s.who || 'all') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <span class="small muted">jakość prowadzenia ${Math.round(sessionCoachQ(s) * 100)}%</span></div>
        <div class="chip-row" style="margin-top:6px">${all.map(r => { const av = dayStatus(r, d).avail, ex = (s.ex || []).includes(r.id); return `<span class="chip ${av && !ex ? 'on' : 'ghost'}" title="${av ? (ex ? 'wykluczony – kliknij, żeby dodać' : 'kliknij, żeby wykluczyć') : 'niedostępny tego dnia'}" ${av ? `onclick="ACT.planEx('${s.id}', ${r.id})"` : ''}>${esc(r.name)}</span>`; }).join('')}</div>`
      : `<div class="small muted" style="margin-top:4px">${ppl.map(r => esc(r.name)).join(', ')}</div>`}</div>`;
  }).join('');
  const add = fut ? `<div class="chip-row" style="margin-top:8px"><span class="chip-lbl">Dodaj jednostkę</span>${Object.entries(SESSION_TYPES).map(([k, T]) => { const p = planProblem(d, k); return `<span class="chip ${p ? 'ghost' : ''}" title="${esc(p || T.desc)}" ${p ? '' : `onclick="ACT.planAdd('${d}', '${k}')"`}>${T.icon} ${esc(T.short)}</span>`; }).join('')}</div>` : '';
  return `<div class="panel" style="margin-top:16px"><div class="chip-row"><h3 style="margin:0">Trening ${fmtDate(d)}</h3>${track ? `<span class="small muted" style="margin-left:auto">prognoza: ${track}${trackUsable(d) ? '' : ' – tor raczej nieprzejezdny'}</span>` : ''}</div>${add}${sessRows || (fut ? '' : '<p class="small muted">Brak jednostek tego dnia.</p>')}</div>`;
}
function winterPanel() {
  if (typeof winterYear !== 'function') return '';
  const Y = winterYear(), rs = clubRiders(G.clubId).filter(r => r.winter && r.winter.y === Y);
  if (!rs.length) return '';
  return `<div class="panel flush" style="margin-top:16px"><div class="ph"><h3>Zima ${Y}/${String(Y + 1).slice(2)} za granicą</h3></div><table class="t"><thead><tr><th>Zawodnik</th><th>Gdzie</th><th>Powód</th><th>Status</th><th></th></tr></thead><tbody>
    ${rs.map(r => { const w = r.winter, S = WINTER_SERIES[w.ser]; return `<tr><td><a href="#/zawodnik/${r.id}/terminarz"><b>${esc(r.name)}</b></a></td><td>${esc(S.name)}</td><td class="small">${w.kind === 'champ' ? `${esc(S.champ)} – powrót do domu` : 'starty zarobkowe'}</td>
      <td class="small ${w.status === 'ok' ? 'pos' : w.status === 'no' ? 'neg' : 'warn'}">${WINTER_ST[w.status]}${w.status === 'ok' && w.dates ? ` · ${w.dates.length} startów` : ''}</td>
      <td class="num">${w.status === 'req' ? `<button class="btn sm" onclick="ACT.winterDecide(${r.id}, true)">Zgoda</button> <button class="btn sm" onclick="ACT.winterDecide(${r.id}, false)">Odmowa</button>` : ''}</td></tr>`; }).join('')}</tbody></table>
    <p class="small muted" style="padding:0 12px">Zgoda: jazda zimą (technika, morale), ale zmęczenie i ryzyko urazu przed sezonem. Odmowa obniża morale – mocno, gdy zawodnik chce wrócić do domu na mistrzostwa kraju.</p></div>`;
}
function teamAvailability(rs) {
  const ym = UI.acal || G.date.slice(0, 7), days = monthGrid(ym);
  const from = addDays(days[0], -3), to = addDays(days[days.length - 1], 3);
  const lists = rs.map(r => [r, riderPlanned(r, from, to)]);
  const fx = Object.fromEntries(clubFixtures(G.clubId).map(f => [f.date, f]));
  const man = typeof planOn === 'function' && planOn();
  const cells = days.map(d => {
    const sts = lists.map(([r, l]) => dayStatusFrom(r, l, d));
    const n = sts.filter(s => s.avail).length, ratio = rs.length ? n / rs.length : 0;
    const f = fx[d], ss = man ? planOnDay(d) : [];
    return `<div class="day av ${d.slice(0, 7) !== ym ? 'out' : ''} ${d === G.date ? 'today' : ''} ${d < G.date ? 'past' : ''} ${UI.avDay === d ? 'sel' : ''}" onclick="ACT.avDay('${d}')">
      <div class="n"><span>${Number(d.slice(8))}</span>${d.slice(0, 7) === ym ? `<span class="avn ${ratio >= 0.75 ? 'pos' : ratio >= 0.45 ? 'warn' : 'neg'}" title="Zawodnicy dostępni do treningu w klubie">${n}/${rs.length}</span>` : ''}</div>
      ${f ? `<div class="ev k-liga">${esc(G.clubs[f.homeId].short)} – ${esc(G.clubs[f.awayId].short)}</div>` : ''}
      ${ss.map(s => `<div class="ev k-tren ${s.status === 'off' ? 'off' : ''}" title="${esc(SESSION_TYPES[s.type].name)}${s.status === 'off' ? ' – odwołana' : ''}">${SESSION_TYPES[s.type].icon} ${esc(SESSION_TYPES[s.type].short)}</div>`).join('')}
      ${d.slice(0, 7) === ym ? `<div class="mini-bars">${sts.map(s => `<i class="${s.avail ? 'ok' : ST_CLASS[s.s] || ''}"></i>`).join('')}</div>` : ''}</div>`;
  }).join('');
  let detail = '';
  if (UI.avDay) {
    const rows = lists.map(([r, l]) => [r, dayStatusFrom(r, l, UI.avDay)]).sort(by(([, s]) => (s.avail ? 0 : 1)));
    detail = `${planDayPanel(UI.avDay)}<div class="panel flush" style="margin-top:16px"><div class="ph"><h3>${fmtDate(UI.avDay)} · ${DAYS[dow(UI.avDay)]}</h3></div><table class="t"><thead><tr><th>Zawodnik</th><th>Status</th><th>Kondycja</th><th>Rytm zawodów</th>${man ? '<th class="num">Obciążenie 7 dni</th>' : ''}</tr></thead><tbody>
      ${rows.map(([r, s]) => { const rh = rhythmOf(r), ld = man ? planLoad(r) : 0; return `<tr class="click" onclick="go('#/zawodnik/${r.id}/terminarz')"><td><b>${esc(r.name)}</b></td><td><span class="${s.avail ? 'pos' : s.s === 'inj' ? 'neg' : 'muted'}">${esc(s.lbl)}</span></td><td style="width:120px">${bar(r.cond)}</td><td class="small ${rh.cls}">${esc(rh.lbl)}</td>${man ? `<td class="num ${ld > PLAN_OVERLOAD ? 'neg' : ''}">${ld.toFixed(1).replace('.', ',')}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>`;
  }
  return `${planHead(ym)}<div class="panel" style="margin-top:16px">${calHead('acal')}<div class="cal">${DAYS_SHORT.map(x => `<div class="dh">${x}</div>`).join('')}${cells}</div>
    <p class="small muted" style="margin-top:10px">Liczba zawodników dostępnych do treningu w klubie: bez startu, podróży, pobytu za granicą (ligi zagraniczne, dom poza sezonem, zima za oceanem) i kontuzji. Paski: każdy zawodnik kadry. Kliknij dzień, żeby zobaczyć, kto jest gdzie${man ? ', i zaplanować jednostki treningowe' : ''}. Terminy lig zagranicznych są szacowane według typowych dni meczowych lig.</p></div>${detail}${winterPanel()}`;
}
