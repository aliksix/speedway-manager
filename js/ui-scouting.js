'use strict';
// Transfery → Skauting: Obserwowani (pasywnie), Zlecenia (nowe i trwające), Polecani (z zakończonych zleceń), Raporty.
// Strona raportu (#/raport/<id>) i skrót ostatniego raportu w profilu zawodnika (js/scouting.js).

const SC_TABS = [['', 'Obserwowani'], ['zlecenia', 'Zlecenia'], ['polecani', 'Polecani'], ['raporty', 'Raporty'], ['kraje', 'Znajomość krajów']];
function scForm() {
  if (!UI.scf) UI.scf = { staffId: '', type: 'rider', riderId: '', comp: 'PGE', cc: 'SWE', profile: false, weeks: 3, crit: { role: 'any', ca: 0, pa: 0, ageMax: 0, budget: 0, cc: '' } };
  return UI.scf;
}
ACT.scSet = (k, v, num) => { const f = scForm(); f[k] = num ? Number(v) : v; render(); };
ACT.scCrit = (k, v, num) => { const f = scForm(); f.crit[k] = num ? Number(v) : v; render(); };
ACT.scGo = () => {
  const f = scForm(), target = f.type === 'rider' ? { riderId: Number(f.riderId) } : f.type === 'comp' ? { comp: f.comp } : f.type === 'country' ? { cc: f.cc, profile: f.profile, crit: f.profile ? { ...f.crit } : null } : { crit: { ...f.crit } };
  const r = scCreate(f.staffId, f.type, target, Number(f.weeks));
  toast(r.text, r.ok ? 'good' : 'bad'); changed();
};
ACT.scCancel = id => { scCancel(id); changed(); };
ACT.scWatch = rid => { ensureScoutModel(); UI.scf = { ...scForm(), type: 'rider', riderId: String(rid) }; go('#/transfery/skauting/zlecenia'); };

function scoutingPage(head, sub) {
  ensureScoutModel();
  const act = scAll().filter(t => t.status === 'active');
  const T2 = `<div class="seg" style="margin-bottom:12px">${SC_TABS.map(([k, l]) => `<a class="btn sm ${(sub || '') === k ? 'primary' : ''}" href="#/transfery/skauting${k ? '/' + k : ''}">${l}${k === 'zlecenia' && act.length ? ` (${act.length})` : k === '' ? ` (${G.shortlist.length})` : k === 'polecani' && G.scouting.recs.length ? ` (${G.scouting.recs.length})` : ''}</a>`).join('')}</div>`;
  if (sub === 'zlecenia') return { ...head, body: T2 + scTasksPage() };
  if (sub === 'polecani') return { ...head, body: T2 + scRecsPage() };
  if (sub === 'raporty') return { ...head, body: T2 + scReportsPage() };
  if (sub === 'kraje') return { ...head, body: T2 + scMapPage() };
  const rows = G.shortlist.map(id => G.riders[id]).filter(Boolean);
  setCtx(rows.map(r => r.id), 'Obserwowani');
  return { ...head, body: T2 + `<p class="small muted">Obserwowani zawodnicy są poznawani powoli i bez kosztów (oglądanie meczów, statystyki). Raport z przedziałem punktów i kosztem sezonu przygotuje skaut albo trener po zleceniu obserwacji.</p>`
    + (rows.length ? tfTable(rows) : '<div class="panel empty">Lista obserwowanych jest pusta – dodaj zawodników przyciskiem „Obserwuj” w ich profilu.</div>') };
}
function scCompOptions() {
  const out = LEAGUE_ORDER.map(l => [l, LEAGUES[l].name]);
  if (typeof FP !== 'undefined' && FP) for (const L of [...Object.values(FP.leagues), ...Object.values(FP.cups || {})]) out.push([L.id, `${COUNTRY[L.country] || L.country}: ${L.name}`]);
  out.push(['SGP', 'Speedway Grand Prix']);
  const seen = new Set(out.map(x => x[0]));
  for (const e of Object.values(G.events).filter(e => e.kind === 'comp' && !e.played && e.season === G.season && e.comp !== 'EXAM' && e.date >= G.date).sort(by(e => e.date))) {
    const k = compKey(e); if (seen.has(k)) continue; seen.add(k); out.push([k, (COMPS[e.comp] || { name: e.name }).name]);
  }
  return out;
}
function scCountryOptions() {
  const cc = new Set(['POL']);
  if (typeof FP !== 'undefined' && FP) { for (const L of Object.values(FP.leagues)) cc.add(L.country); for (const c of FP.champs) cc.add(c.cc); }
  return [...cc].filter(c => COUNTRY_GEO[c]).sort((a, b) => (COUNTRY[a] || a).localeCompare(COUNTRY[b] || b, 'pl'));
}
function scCritFields(f) {
  const c = f.crit, num = (k, step, w, ph) => `<input type="number" step="${step}" min="0" value="${c[k] || ''}" placeholder="${ph}" style="width:${w}px" onchange="ACT.scCrit('${k}', this.value, true)">`;
  return `<label class="fld">Rola<select onchange="ACT.scCrit('role', this.value)">${Object.entries(SC_ROLES).map(([k, l]) => `<option value="${k}" ${c.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="fld">Umiejętności min. (★)${num('ca', 0.5, 70, '—')}</label><label class="fld">Potencjał min. (★)${num('pa', 0.5, 70, '—')}</label>
    <label class="fld">Wiek do${num('ageMax', 1, 60, '—')}</label><label class="fld">Koszt sezonu do (zł)${num('budget', 50000, 110, 'bez limitu')}</label>
    ${f.type === 'search' ? `<label class="fld">Narodowość<select onchange="ACT.scCrit('cc', this.value)"><option value="">wszystkie</option>${[...new Set(Object.values(G.riders).map(r => r.country))].filter(x => COUNTRY[x]).sort((a, b) => COUNTRY[a].localeCompare(COUNTRY[b], 'pl')).map(x => `<option value="${x}" ${c.cc === x ? 'selected' : ''}>${esc(COUNTRY[x])}</option>`).join('')}</select></label>` : ''}`;
}
function scTasksPage() {
  const f = scForm(), pool = scStaffPool();
  if (!f.staffId || !G.staff[f.staffId] || G.staff[f.staffId].clubId !== G.clubId) f.staffId = (pool.find(s => scIsScout(s) && scCapacity(s)) || pool.find(s => scCapacity(s)) || pool[0] || {}).id || '';
  const watch = [...new Set([...G.shortlist, ...(f.riderId ? [Number(f.riderId)] : [])])].map(id => G.riders[id]).filter(r => r && r.clubId !== G.clubId);
  if (f.type === 'rider' && !f.riderId && watch[0]) f.riderId = String(watch[0].id);
  const target = f.type === 'rider' ? `<label class="fld">Zawodnik<select onchange="ACT.scSet('riderId', this.value)">${watch.map(r => `<option value="${r.id}" ${String(f.riderId) === String(r.id) ? 'selected' : ''}>${esc(r.name)} (${r.clubId ? esc(G.clubs[r.clubId].short) : 'wolny'})</option>`).join('') || '<option value="">– dodaj zawodników do obserwowanych –</option>'}</select></label>`
    : f.type === 'comp' ? `<label class="fld">Rozgrywki<select onchange="ACT.scSet('comp', this.value)">${scCompOptions().map(([k, l]) => `<option value="${esc(k)}" ${f.comp === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`
    : f.type === 'country' ? `<label class="fld">Kraj<select onchange="ACT.scSet('cc', this.value)">${scCountryOptions().map(c => `<option value="${c}" ${f.cc === c ? 'selected' : ''}>${esc(COUNTRY[c] || c)}</option>`).join('')}</select></label>
        <label class="fld row"><input type="checkbox" ${f.profile ? 'checked' : ''} onchange="ACT.scSet('profile', this.checked)"> według profilu</label>` : '';
  const crit = f.type === 'search' || (f.type === 'country' && f.profile) ? `<div class="filters" style="margin-top:8px">${scCritFields(f)}</div>` : '';
  const s = G.staff[f.staffId], est = scEstimate(f.type, f.type === 'rider' ? { riderId: Number(f.riderId) } : f.type === 'country' ? { cc: f.cc } : { comp: f.comp }, Number(f.weeks));
  const staffOpt = pool.map(x => `<option value="${x.id}" ${f.staffId === x.id ? 'selected' : ''} ${scCapacity(x) ? '' : 'disabled'}>${esc(x.name)} – ${esc(staffRoleNames(x))}, ocena talentu ${scJudging(x)}${scIsScout(x) ? '' : ' (trener: wolniej, trening 75%)'}${scCapacity(x) ? '' : ' – zajęty'}</option>`).join('');
  const form = `<div class="panel"><h3>Nowe zlecenie</h3>
    <div class="filters"><label class="fld">Kto<select onchange="ACT.scSet('staffId', this.value)">${staffOpt}</select></label>
      <label class="fld">Rodzaj<select onchange="ACT.scSet('type', this.value)">${Object.entries(SC_TYPES).map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${target}<label class="fld">Czas<select onchange="ACT.scSet('weeks', this.value, true)">${[1, 2, 3, 4, 6, 8].map(w => `<option value="${w}" ${Number(f.weeks) === w ? 'selected' : ''}>${w} ${plural(w, 'tydzień', 'tygodnie', 'tygodni')}</option>`).join('')}</select></label></div>${crit}
    <div class="row wrap" style="margin-top:10px;gap:12px"><button class="btn primary" onclick="ACT.scGo()">Zleć</button><span class="small muted">Szacowany koszt wyjazdów: <b>${fmtMoney(est)}</b>${s && !scIsScout(s) ? ` · ${esc(s.name)} trenuje w tym czasie z 75% skuteczności` : ''}</span></div>
    <p class="small muted" style="margin-top:8px">${{ rider: 'Obserwacja startów zawodnika (bez startów – nagrania i rozmowy). Raport po 4 obserwacjach albo po upływie czasu.', comp: 'Wyjazdy na mecze wybranych rozgrywek (jeden na żywo dziennie, reszta z nagrań). Na koniec – lista polecanych.', country: 'Wyjazd na cały okres: wszystkie zawody w kraju. Według profilu – polecani tylko spełniający kryteria. Skaut na wyjeździe nie prowadzi innych zleceń.', search: 'Przegląd statystyk i nagrań zawodników pasujących do roli i wieku; polecani według gwiazdek w ocenie skauta. Bez kosztów wyjazdów.' }[f.type]}</p></div>`;
  const list = scAll().sort(by(t => (t.status === 'active' ? '0' : '1') + (t.status === 'active' ? t.end : '') + t.start, 1)).reverse().sort(by(t => t.status === 'active' ? 0 : 1));
  const rows = list.slice(0, 40).map(t => `<tr class="${t.status === 'active' ? '' : 'dim'}"><td>${esc(staffName(t.staffId))}</td><td>${esc(SC_TYPES[t.type])}</td><td>${esc(scTaskLabel(t))}</td>
    <td class="small">${fmtDateShort(t.start)} – ${fmtDateShort(t.status === 'active' ? t.end : t.done || t.end)}</td><td class="num">${t.obs}</td><td class="num">${Object.keys(t.seen).length}</td><td class="num">${fmtMoney(t.cost || 0, true)}</td>
    <td>${t.status === 'active' ? `<button class="btn sm" onclick="ACT.scCancel('${t.id}')">Przerwij</button>` : t.status === 'done' ? `${t.reports.length ? `<a href="${t.type === 'rider' ? `#/raport/${t.reports[0]}` : '#/transfery/skauting/polecani'}">${t.type === 'rider' ? 'raport' : `${t.recs.length} polecanych`}</a>` : 'brak polecanych'}` : '<span class="small muted">przerwane</span>'}</td></tr>`).join('');
  return form + `<div class="panel flush" style="margin-top:12px"><div class="ph"><h3>Zlecenia</h3></div><table class="t"><thead><tr><th>Kto</th><th>Rodzaj</th><th>Cel</th><th>Okres</th><th class="num">Obserwacje</th><th class="num">Zawodnicy</th><th class="num">Koszt</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="muted">Brak zleceń.</td></tr>'}</tbody></table></div>`;
}
function scRepRow(rp, extra = '') {
  const r = G.riders[rp.riderId]; if (!r) return '';
  return `<tr class="click" onclick="go('#/raport/${rp.id}')"><td>${riderCell(r.id)}</td><td class="small">${r.clubId ? clubLink(r.clubId, false) : '<span class="muted">wolny</span>'}</td><td class="num">${rp.age ?? '—'}</td>
    <td>${rangeStars(rp.ca[0], rp.ca[1])}</td><td>${rangeStars(rp.pa[0], rp.pa[1])}</td><td class="num">${rp.pts[0]}–${rp.pts[1]}</td><td class="num">${fmtMoney(rp.cost, true)}</td><td class="small">${fmtDateShort(rp.date)} · ${esc(staffName(rp.staffId))}</td>${extra}</tr>`;
}
const SC_HEAD = '<thead><tr><th>Zawodnik</th><th>Klub</th><th class="num">Wiek</th><th>Umiejętności</th><th>Potencjał</th><th class="num">Punkty u nas</th><th class="num">Koszt sezonu</th><th>Raport</th><th></th></tr></thead>';
function scRecsPage() {
  const recs = G.scouting.recs.filter(x => G.scouting.reports[x.reportId]);
  if (!recs.length) return '<div class="panel empty">Brak polecanych – zleć skautowi obserwację rozgrywek, kraju albo poszukiwanie według kryteriów.</div>';
  return `<div class="panel flush"><table class="t">${SC_HEAD}<tbody>${recs.map(x => scRepRow(G.scouting.reports[x.reportId], `<td onclick="event.stopPropagation()"><button class="btn sm" onclick="ACT.toggleWatch(${x.riderId})">${G.shortlist.includes(x.riderId) ? 'Obserwowany' : 'Obserwuj'}</button></td>`)).join('')}</tbody></table>
    <p class="small muted" style="padding:0 12px 10px">Ocena skauta może się mylić – słabszy skaut częściej przecenia młodych zawodników. Punkty: przedział w sezonie u nas (siła rywali w naszej lidze, ok. 5 biegów w meczu); koszt sezonu ze środka przedziału.</p></div>`;
}
function scReportsPage() {
  const reps = Object.values(G.scouting.reports).sort(by(x => x.date + x.id, -1)).slice(0, 200);
  return reps.length ? `<div class="panel flush"><table class="t">${SC_HEAD}<tbody>${reps.map(rp => scRepRow(rp, '<td></td>')).join('')}</tbody></table></div>` : '<div class="panel empty">Brak raportów.</div>';
}
PAGES.raport = parts => {
  const rp = G.scouting && G.scouting.reports[parts[0]], r = rp && G.riders[rp.riderId];
  if (!r) return { title: 'Nie znaleziono raportu', body: '' };
  const s = G.staff[rp.staffId], mid = Math.round((rp.pts[0] + rp.pts[1]) / 2);
  return { title: `Raport: ${esc(r.name)}`, sub: `${fmtDate(rp.date)} · ${esc(staffName(rp.staffId))}${s ? ` (${esc(staffRoleNames(s))})` : ''} · <a href="#/zawodnik/${r.id}">profil zawodnika</a> · <a href="#/transfery/skauting/raporty">wszystkie raporty</a>`,
    body: `<div class="grid g2"><div class="panel"><h3>Ocena</h3><div class="kv">
      <div>Klub</div><div>${r.clubId ? clubLink(r.clubId) : 'wolny zawodnik'}${rp.until ? ` · kontrakt do ${rp.until}` : ''}</div><div>Wiek</div><div>${rp.age ?? '—'}</div>
      <div>Umiejętności</div><div>${rangeStars(rp.ca[0], rp.ca[1])} <span class="small muted">${fmtStars(rp.ca)}</span></div><div>Potencjał</div><div>${rangeStars(rp.pa[0], rp.pa[1])} <span class="small muted">${fmtStars(rp.pa)}</span></div>
      <div>Znajomość zawodnika</div><div>${bar(rp.K * 100)}</div>
      ${rp.strong.length ? `<div>Mocne strony</div><div>${esc(rp.strong.join(', ').toLowerCase())}</div><div>Słabe strony</div><div>${esc(rp.weak.join(', ').toLowerCase())}</div>` : '<div>Mocne i słabe strony</div><div class="muted">za mało obserwacji</div>'}
      ${rp.char ? `<div>Charakter</div><div>${esc(rp.char.toLowerCase())}</div>` : ''}</div>
      <p class="small muted" style="margin-top:8px">To ocena ${rp.scout ? 'skauta' : 'trenera'} – może się mylić, zwłaszcza przy młodych zawodnikach i słabszym obserwatorze.</p></div>
    <div class="panel"><h3>Prognoza u nas (sezon ${sportSeason()})</h3><div class="kv"><div>Punkty w sezonie</div><div><b>${rp.pts[0]}–${rp.pts[1]}</b></div>
      <div>Koszt sezonu</div><div><b>${fmtMoney(rp.cost)}</b> <span class="small muted">(za podpis ${fmtMoney(rp.ask.signing, true)} + ${fmtMoney(rp.ask.perPoint)} za punkt × ${mid} pkt)</span></div></div>
      <p class="small muted" style="margin-top:8px">Przedział punktów: umiejętności w ocenie obserwatora względem siły rywali w ${esc(LEAGUES[myClub().league].name)}. Koszt ze środka przedziału i oczekiwań zawodnika w dniu raportu.</p>
      <div class="row wrap" style="margin-top:10px"><a class="btn primary" href="#/oferta/${r.id}">Złóż ofertę</a><button class="btn" onclick="ACT.toggleWatch(${r.id})">${G.shortlist.includes(r.id) ? 'Usuń z obserwowanych' : 'Obserwuj'}</button><button class="btn" onclick="ACT.scWatch(${r.id})">Zleć kolejną obserwację</button></div></div></div>` };
};
// Profil zawodnika: ostatni raport (skrót)
function scReportBlock(r) {
  const rp = typeof scLastReport === 'function' && scLastReport(r.id);
  const act = G.scouting && scAll().find(t => t.status === 'active' && t.type === 'rider' && t.target.riderId === r.id);
  if (!rp && !act) return r.clubId === G.clubId ? '' : `<div class="row" style="margin-top:10px"><button class="btn sm" onclick="ACT.scWatch(${r.id})">Zleć obserwację</button></div>`;
  return `<div class="small" style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px">${rp ? `<b>Raport ${fmtDateShort(rp.date)}</b> (${esc(staffName(rp.staffId))}): ${fmtStars(rp.ca)} / potencjał ${fmtStars(rp.pa)}, ${rp.pts[0]}–${rp.pts[1]} pkt u nas, koszt sezonu ${fmtMoney(rp.cost, true)} · <a href="#/raport/${rp.id}">raport</a>` : ''}
    ${act ? `<div class="muted">Obserwuje: ${esc(staffName(act.staffId))} do ${fmtDateShort(act.end)}</div>` : r.clubId === G.clubId ? '' : ` <a href="javascript:void 0" onclick="ACT.scWatch(${r.id})">zleć kolejną</a>`}</div>`;
}

// ---------- Znajomość krajów: mapa (Natural Earth, js/world-map.js) i lista ----------
const SC_MAP_STEPS = ['#4b5d72', '#3f74a6', '#4a90cf', '#6cb0ec', '#a6d4fa']; // jedna barwa, coraz jaśniejsza (więcej wiedzy)
const scMapColor = v => SC_MAP_STEPS[Math.min(4, Math.floor(v * 5 / 0.95))];
ACT.scMapPick = cc => { UI.scMapCc = UI.scMapCc === cc ? null : cc; render(); };
ACT.scTrip = cc => { UI.scf = { ...scForm(), type: 'country', cc }; go('#/transfery/skauting/zlecenia'); };
function scMapCountries() {
  const set = new Set(Object.values(G.riders).filter(r => !r.retired && COUNTRY[r.country]).map(r => r.country));
  if (typeof FP !== 'undefined' && FP) for (const L of Object.values(FP.leagues)) set.add(L.country);
  set.delete('UNK');
  return [...set];
}
function scMapPage() {
  if (typeof WORLD_MAP === 'undefined') return '<div class="panel empty">Brak mapy (js/world-map.js).</div>';
  const M = WORLD_MAP.world, ccs = new Set(scMapCountries()), sel = UI.scMapCc;
  const paths = Object.entries(M.paths).map(([code, d]) => {
    const game = ccs.has(code), v = game ? scCountryKnow(G.clubId, code) : 0;
    return `<path d="${d}" class="${game ? 'sc-c' : 'sc-x'} ${sel === code ? 'sel' : ''}" ${game ? `fill="${scMapColor(v)}" onclick="ACT.scMapPick('${code}')"` : ''}><title>${esc(COUNTRY[code] || '')}${game ? ` – znajomość ${Math.round(v * 100)}%` : ''}</title></path>`;
  }).join('');
  const rows = [...ccs].map(cc => [cc, scCountryKnow(G.clubId, cc)]).sort(by(x => x[1], -1));
  const n = cc => Object.values(G.riders).filter(r => !r.retired && r.active && r.country === cc).length;
  const detail = sel ? (() => { const v = scCountryKnow(G.clubId, sel), src = scCountrySources(G.clubId, sel), all = Object.values(G.riders).filter(r => !r.retired && r.active && r.country === sel), known = all.filter(r => scKnown(r)).length;
    return `<div class="panel"><h3>${flag(sel)} ${esc(COUNTRY[sel] || sel)}</h3><div class="kv"><div>Znajomość</div><div>${bar(v * 100)} <span class="small">${Math.round(v * 100)}%</span></div>
      <div>Zawodnicy</div><div>${all.length} aktywnych, znanych sztabowi: <b>${known}</b></div><div>Źródła</div><div class="small">${src.length ? src.map(esc).join('<br>') : '<span class="muted">brak – kraj znany tylko z wyników</span>'}</div></div>
      ${sel !== 'POL' ? `<button class="btn primary" style="margin-top:10px" onclick="ACT.scTrip('${sel}')">Zleć wyjazd do kraju</button>` : ''}</div>`; })() : '';
  return `<div class="grid g-side"><div class="panel"><div class="row wrap" style="margin-bottom:8px"><div class="legend">${SC_MAP_STEPS.map((c, i) => `<span><i class="lg" style="background:${c};width:14px;height:10px"></i>${i * 20}–${i * 20 + 20}%</span>`).join('')}</div></div>
      <svg class="sc-map" viewBox="0 0 ${M.w} ${M.h}" preserveAspectRatio="xMidYMid meet">${paths}</svg>
      <p class="small muted" style="margin-top:6px">Znajomość kraju: obcokrajowcy zatrudniani przez klub w poprzednich sezonach, kontakty sztabu (koledzy z drużyny i prowadzeni zawodnicy – także w polskiej lidze, kraj pochodzenia), obecni zawodnicy i ich ligi, zlecenia skautingu. Lepsza znajomość – dokładniejsze oceny zawodników z tego kraju i szybsza obserwacja.</p></div>
    <div class="stack">${detail}<div class="panel flush"><div class="ph"><h3>Kraje</h3></div><table class="t"><tbody>${rows.map(([cc, v]) => `<tr class="click ${sel === cc ? 'me' : ''}" onclick="ACT.scMapPick('${cc}')"><td>${flag(cc)} ${esc(COUNTRY[cc] || cc)}</td><td style="width:110px">${bar(v * 100)}</td><td class="num">${Math.round(v * 100)}%</td><td class="num small muted">${n(cc)}</td></tr>`).join('')}</tbody></table></div></div></div>`;
}
