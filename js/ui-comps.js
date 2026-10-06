'use strict';
// Zakładka „Zawody” (przegląd wszystkich rozgrywek) i ekran zawodów dla każdego formatu (indywidualne, pary, drużynowe, egzamin).

const GROUP_CAT = { swiat: 'fim', europa: 'fime', polska: 'pzm', turnieje: 'pzm', mlodziez: 'mlodziez', mini: 'mini' };
const evComp = e => (e.kind === 'sgp' ? COMPS.SGP : compOf(e));
const evKey = e => (e.kind === 'sgp' ? 'SGP' : compKey(e));
function miniAvatar(id) {
  const r = R(id);
  if (!r) return '<span class="avatar mini"></span>';
  const c = G.clubs[r.clubId];
  return avatar(r, c, 'mini');
}
// Komórka zawodnika: mały awatar, flaga i imię i nazwisko (w zawodach międzynarodowych bez klubu)
function riderCell(id, m) { const r = R(id); return `<span class="rider-cell">${miniAvatar(id)}${r ? (r.nationalities || (r.country ? [r.country] : [])).map(cc => flag(cc)).join('') : ''}${whoLink(id, m)}</span>`; }
// Punkty w półfinale i finale (turnieje z fazą finałową)
function stagePts(m, id, prefix) {
  const h = m.heats.find(x => x.label && x.label.startsWith(prefix) && x.res.some(r => String(r.riderId) === String(id)));
  if (!h) return '—';
  const x = h.res.find(r => String(r.riderId) === String(id));
  return x.status ? `<span class="neg">${x.status}</span>` : x.pts;
}
function nameOf(id, m) { const r = R(id); return r ? r.name : (m && m.names && m.names[id]) || String(id); }
function whoLink(id, m) {
  if (G.riders[id]) return `<a href="#/zawodnik/${id}">${esc(G.riders[id].name)}</a>`;
  const k = G.academy[id];
  return k ? `<a href="#/adept/${esc(k.id)}" title="adept szkółki – ${esc(G.clubs[k.clubId] ? G.clubs[k.clubId].name : '')}">${esc(k.name)}</a> <span class="pill jun" style="padding:0 5px">${esc((ACADEMY_CATS.find(c => c.id === k.cat) || {}).cc || '')}</span>` : esc(nameOf(id, m));
}
function winnerLabel(e) {
  if (!e.played) return '';
  if (e.cancelled) return '<span class="muted">odwołane</span>';
  const m = G.matches[e.matchId];
  if (!m) return '';
  if (m.exam) return `${m.exam.filter(x => x.ok).length}/${m.exam.length} zdało`;
  if (m.units) return unitLabel(m, e.winner);
  return whoLink(e.winner, m);
}
function compEvents(key, season) { return Object.values(G.events).filter(e => evKey(e) === key && e.season === season).sort(by(e => e.date)); }
function standingsRows(key, season, events) {
  // SGP w trakcie sezonu: G.sgp; poprzednie sezony: archiwum G.series (zapis przy starcie nowego sezonu, js/world.js)
  let tab = seriesTableOf(key, season);
  if (!tab && key === 'SGP') { // zapisy sprzed archiwum: suma punktów rund z protokołów, zapamiętana na stałe
    tab = {};
    for (const e of events || compEvents(key, season)) { const m = e.played && G.matches[e.matchId]; for (const x of (m && m.classification) || []) if (x.riderId != null) tab[x.riderId] = (tab[x.riderId] || 0) + (x.gp || 0); }
    if (season < G.season && Object.keys(tab).length) (G.series = G.series || {})[`${season}-SGP`] = tab;
  }
  if (!tab) return [];
  // kolejność z rozstrzygniętymi remisami (bieg dodatkowy po ostatniej rundzie, miejsca w rundach / biegach) – js/ties.js
  return seriesOrder(key, season, events || compEvents(key, season)).map(id => ({ id, p: tab[id] }));
}
function unitName(key, events) {
  for (const e of events) { const m = e.played && G.matches[e.matchId]; if (m && m.units && m.units[key]) return unitLabel(m, key); }
  return esc(key);
}

// ---------- Zakładka Zawody ----------
PAGES.rozgrywki = parts => {
  const season = Number(UI.compSeason) || G.season;
  const seasons = [...new Set(Object.values(G.events).map(e => e.season))].sort();
  const selS = `<select onchange="UI.compSeason=this.value;render()">${seasons.map(s => `<option ${s === season ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
  if (parts[0] && /^\d{4}$/.test(parts[2] || '') && Number(parts[2]) !== season) { UI.compSeason = parts[2]; return PAGES.rozgrywki(parts); } // link z sukcesów zawodnika: sezon w adresie
  if (parts[0]) return compPage(decodeURIComponent(parts[0]), parts[1] || '', season, selS);
  const evs = Object.values(G.events).filter(e => e.season === season);
  const keys = [...new Set(evs.map(evKey))];
  const card = key => {
    const list = compEvents(key, season), c = evComp(list[0]);
    const played = list.filter(e => e.played), next = list.find(e => !e.played);
    const last = played[played.length - 1];
    const lead = (c.series || c.table) ? standingsRows(key, season, list)[0] : null;
    return `<div class="panel comp-card" onclick="go('#/rozgrywki/${encodeURIComponent(key)}')">
      <div class="small muted">${esc(c.short || '')}${list.length > 1 ? ` · ${list.length} ${plural(list.length, 'runda', 'rundy', 'rund')}` : ''}</div><div class="nm">${esc(key.startsWith('T:') ? list[0].name : c.name)}</div>
      <div class="small" style="margin-top:6px">${next ? `następne: <b>${fmtDateShort(next.date)}</b>${next.venue ? ` · ${esc(next.venue)}` : ''}` : '<span class="muted">zakończone</span>'}</div>
      ${last ? `<div class="small muted">${lead ? 'prowadzi' : 'ostatnio'}: ${lead ? (c.table ? unitName(lead.id, list) : whoLink(lead.id)) : winnerLabel(last)}</div>` : ''}
      <div class="bar" style="margin-top:8px">${`<i style="width:${Math.round(played.length / list.length * 100)}%"></i>`}</div></div>`;
  };
  const fl = typeof FP !== 'undefined' && FP && G.fclubs ? `<div class="panel comp-card" onclick="go('#/zagranica')" style="margin-bottom:12px"><div class="nm">🌍 Ligi zagraniczne</div><div class="small muted">${Object.keys(FP.leagues).length} lig w 7 krajach: Wielka Brytania, Szwecja, Dania, Francja, Czechy, Niemcy, Rosja – tabele, terminarze i protokoły meczów</div></div>` : '';
  return { title: 'Zawody', sub: `${selS} · ${evs.length} imprez w sezonie (${evs.filter(e => e.played).length} rozegranych)`, body: fl + COMP_GROUPS.map(([g, label]) => {
    const ks = keys.filter(k => evComp(compEvents(k, season)[0]).group === g).sort(by(k => compEvents(k, season)[0].date));
    return ks.length ? `<div class="group-title">${label} <span class="n">${ks.length}</span></div><div class="comp-grid">${ks.map(card).join('')}</div>` : '';
  }).join('') || '<div class="panel empty">Kalendarz zawodów sezonu zostanie opublikowany 1 listopada.</div>' };
};
// DMPJ: tabele grup w kolejnych fazach (punkty meczowe 4–3–2–1, punkty biegowe); awans zaznaczony
function dmpjStandings(season) {
  const unitCell = code => { const c = clubByCode(code); return c ? clubLink(c.id) : esc(dmpjName(code)); };
  const block = (stage, groups, adv, label) => {
    const tabs = groups.map(g => [g, dmpjTable(season, stage, g)]).filter(([, t]) => t.length);
    if (!tabs.length) return `<div class="panel empty">${label}: skład grup zostanie ustalony po zakończeniu poprzedniej fazy.</div>`;
    return `<div class="group-title">${label}</div><div class="grid g2">${tabs.map(([g, t]) => `<div class="panel flush"><div class="ph"><h3>${esc(stage === 'elim' ? DMPJ_PLAN.groups[g].name : stage === 'final' ? 'Finał' : `Grupa ${g}`)}</h3></div><table class="t"><thead><tr><th>#</th><th>Drużyna</th><th class="num">Rundy</th><th class="num">Pkt meczowe</th><th class="num">Pkt biegowe</th></tr></thead><tbody>
      ${t.map((r, i) => `<tr class="${clubByCode(r.key) && clubByCode(r.key).id === G.clubId ? 'me' : ''}"><td>${i + 1}${i < adv ? ' <span class="pill ok">awans</span>' : ''}</td><td>${unitCell(r.key)}</td><td class="num">${r.n}</td><td class="num"><b>${r.mp}</b></td><td class="num">${r.hp}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div>`;
  };
  return block('elim', Object.keys(DMPJ_PLAN.groups), 3, 'Eliminacje') + block('qf', ['I', 'II', 'III', 'IV'], 2, 'Ćwierćfinały') + block('sf', ['I', 'II'], 2, 'Półfinały') + block('final', [null], 3, 'Finał')
    + '<p class="small muted">Regulamin DMPJ 2026: z eliminacji awansują po trzy najlepsze drużyny z grupy i najlepsza z czwartych miejsc; z ćwierćfinałów i półfinałów – po dwie najlepsze z grupy. Punkty meczowe 4–3–2–1 w każdej rundzie.</p>';
}
function compPage(key, sub, season, selS) {
  const list = compEvents(key, season);
  if (!list.length) {
    const uc = COMPS[key] && usaRulesCat(COMPS[key]); // zawody w USA: regulamin także przed utworzeniem terminów sezonu
    return { title: uc ? `🏁 ${esc(COMPS[key].name)}` : 'Zawody', sub: selS, body: '<div class="panel empty">Brak zawodów w wybranym sezonie.</div>' + (uc ? `<div style="margin-top:16px">${usaRulesPage(uc)}</div>` : '') };
  }
  const c = evComp(list[0]);
  const hasTable = c.series || c.table;
  // klasyfikacja generalna jako widok domyślny: cykl / tabela po pierwszej rundzie, zawody jednodniowe – wynik finału
  const finEv = hasTable ? null : list.filter(e => e.stage === 'finał' && e.played && !e.cancelled).pop() || (list.length === 1 && list[0].played && !list[0].cancelled ? list[0] : null);
  const hasCls = (hasTable && list.some(e => e.played && !e.cancelled)) || !!(finEv && G.matches[finEv.matchId] && G.matches[finEv.matchId].classification);
  if (sub === '' || sub === 'klasyfikacja') sub = hasCls ? 'klasyfikacja' : 'terminarz';
  const sgpTab = key === 'SGP' && G.sgp && G.sgp.season === season;
  const usaCat = usaRulesCat(c);
  const T = tabs(`rozgrywki/${encodeURIComponent(key)}`, [...(hasCls ? [['', 'Klasyfikacja']] : []), [hasCls ? 'terminarz' : '', 'Terminarz'], ...(sgpTab ? [['uczestnicy', 'Uczestnicy']] : []), ['historia', 'Historia'], ...(usaCat ? [['regulamin', 'Regulamin']] : [])], sub === 'klasyfikacja' ? '' : sub === 'terminarz' && !hasCls ? '' : sub);
  const head = { title: `🏁 ${esc(key.startsWith('T:') ? list[0].name : c.name)}`, sub: `${selS} · ${COMP_GROUPS.find(g => g[0] === c.group)[1]} · format: ${{ ind: 'turniej indywidualny', pairs: 'zawody parowe', team: 'zawody drużynowe', exam: 'egzamin licencyjny' }[c.format]}`, tabs: T };
  if (sub === 'uczestnicy' && sgpTab) return { ...head, body: sgpEntrantsPage(list) };
  if (sub === 'regulamin' && usaCat) return { ...head, body: usaRulesPage(usaCat) };
  if (sub === 'klasyfikacja' && key === 'DMPJ' && typeof dmpjTable === 'function' && list.some(e => e.dmpj)) return { ...head, body: dmpjStandings(season) };
  if (sub === 'klasyfikacja' && finEv) {
    const m = G.matches[finEv.matchId], units = !!m.units;
    return { ...head, body: `<div class="panel flush"><div class="ph"><h3><a href="#/gp/${finEv.id}">${esc(finEv.name)}</a></h3><span class="small muted">${fmtDateShort(finEv.date)}${finEv.venue ? ` · ${esc(finEv.venue)}` : ''}</span></div><table class="t"><thead><tr><th>#</th><th>${units ? (c.format === 'pairs' ? 'Para' : 'Drużyna') : 'Zawodnik'}</th><th class="num">Pkt</th></tr></thead><tbody>
      ${m.classification.map(x => `<tr><td>${x.place}</td><td>${units ? unitLabel(m, x.key) : whoLink(x.riderId, m)}</td><td class="num"><b>${x.pts ?? x.heatPts ?? ''}</b></td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">Klasyfikacja końcowa – wynik finału. Pełny protokół biegów: <a href="#/gp/${finEv.id}">ekran zawodów</a>.</p>` };
  }
  if (sub === 'klasyfikacja') {
    const rows = standingsRows(key, season, list);
    return { ...head, body: rows.length ? `<div class="panel flush"><table class="t"><thead><tr><th>#</th><th>${c.table ? 'Drużyna' : 'Zawodnik'}</th>${list.map((e, i) => `<th class="num" title="${esc(e.name)}">${i + 1}</th>`).join('')}<th class="num">Pkt</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${c.table ? unitName(r.id, list) : whoLink(r.id)}</td>${list.map(e => { const m = e.played && G.matches[e.matchId]; if (!m || !m.classification) return '<td></td>'; const x = m.classification.find(k => String(k.riderId ?? k.key) === String(r.id)); return `<td class="num small">${x ? (x.gp != null ? x.gp : x.place) : ''}</td>`; }).join('')}<td class="num"><b>${round1(r.p)}</b></td></tr>`).join('')}</tbody></table></div>
      ${(last => (last && G.matches[last.matchId] ? runOffNote(G.matches[last.matchId], true) : ''))(list.filter(e => e.played && !e.cancelled).pop())}
      <p class="small muted">${c.table ? 'Punkty tabeli według formatu zawodów: DMPJ 4–3–2–1, U24 3–2–1–0, mini DMP od 7. Remisy dzielą punkty za zajęte miejsca; w kolumnach rund podano miejsce.' : 'SGP: punkty za miejsce; przy remisie bieg dodatkowy o tytuł, dalej liczba wygranych rund, drugich miejsc… i miejsce w ostatniej rundzie. Pozostałe cykle: punkty biegowe zgodnie z formatem zawodów (bez biegu ostatniej szansy w IMP i SEC); remis o miejsca 1–3 – bieg dodatkowy po ostatniej rundzie, dalej liczba miejsc w biegach.'}</p>` : '<div class="panel empty">Klasyfikacja pojawi się po pierwszej rundzie.</div>' };
  }
  if (sub === 'historia') {
    const seasons = [...new Set(Object.values(G.events).filter(e => evKey(e) === key).map(e => e.season))].sort().reverse();
    const rows = seasons.map(s => {
      const evs = compEvents(key, s), done = evs.filter(e => e.played && !e.cancelled);
      if (!done.length) return null;
      const st = standingsRows(key, s, evs);
      const fin = done.filter(e => e.stage === 'finał').pop() || done[done.length - 1];
      const champ = (c.series || c.table) && done.length === evs.length && st.length ? (c.table ? unitName(st[0].id, evs) : whoLink(st[0].id)) : winnerLabel(fin);
      return `<tr><td>${s}</td><td>${champ}</td><td class="small muted">${done.length}/${evs.length} ${plural(evs.length, 'impreza', 'imprezy', 'imprez')}</td></tr>`;
    }).filter(Boolean);
    return { ...head, body: rows.length ? `<div class="panel flush"><table class="t"><thead><tr><th>Sezon</th><th>${c.format === 'exam' ? 'Wynik' : 'Zwycięzca'}</th><th>Rozegrane</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : '<div class="panel empty">Historia zapisze się po pierwszych rozegranych zawodach.</div>' };
  }
  return { ...head, body: `<div class="panel flush"><table class="t"><thead><tr><th>Data</th><th>Zawody</th><th>Miejsce</th><th>Wynik</th></tr></thead><tbody>
    ${list.map(e => `<tr class="click ${e.played ? '' : 'dim'}" onclick="go('#/gp/${e.id}')"><td class="nowrap">${fmtDateShort(e.date)} <span class="small muted">${DAYS_SHORT[dow(e.date)]}</span></td><td><b>${esc(e.name)}</b>${e.stage ? ` <span class="pill">${esc(e.stage)}</span>` : ''}</td><td>${esc(e.venue || '')}</td><td>${winnerLabel(e) || '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>` };
}

// ---------- Ekran zawodów (wszystkie formaty) ----------
PAGES.gp = parts => {
  const e = G.events[parts[0]];
  if (!e) return { title: 'Nie znaleziono zawodów', body: '' };
  const isSgp = e.kind === 'sgp';
  const c = evComp(e), key = evKey(e);
  const m = e.played && G.matches[e.matchId];
  const hasTable = c.series || c.table;
  const org = typeof orgEligible === 'function' && orgEligible(e) && (e.org || orgMine(e)); // organizacja memoriału (js/memorial.js)
  const T = [['', m ? 'Wyniki' : 'Obsada'], ...(m && m.heats && m.heats.length ? [['biegi', 'Biegi']] : []), ...(hasTable ? [['cykl', 'Klasyfikacja']] : []), ...(org ? [['organizacja', orgMine(e) ? 'Organizacja' : 'Nagrody']] : [])];
  const head = `<div class="page-head"><div class="small muted"><a href="#/rozgrywki/${encodeURIComponent(key)}">${esc(c.name)}</a>${e.round && (e.of || 0) > 1 ? ` · runda ${e.round}${e.of ? ` z ${e.of}` : ''}` : ''}${e.stage ? ` · ${esc(e.stage)}` : ''}</div>
    <h1>${isSgp ? '🏆' : '🏁'} ${esc(e.name)}</h1><div class="sub">${fmtDay(e.date)}${e.time ? `, ${e.time}` : ''}${e.venue ? ` · ${esc(e.venue)}` : ''}${m && m.weather ? ` · ${esc(m.weather.sky)}, tor ${esc(m.weather.track)}` : ''}${e.cancelled ? ' · <span class="warn">odwołane (brak uczestników)</span>' : ''}</div>
    ${m?.heatTableId ? `<div class="small muted">${esc(SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES, m.heatTableId).name)}</div>` : ''}${m?.heatTableFallback ? `<div class="small warn">${esc(m.heatTableFallback)}</div>` : ''}${tabs(`gp/${e.id}`, T, parts[1] || '')}</div>`;
  if (parts[1] === 'cykl') { const p = compPage(key, 'klasyfikacja', e.season, ''); return { head, body: p.body }; }
  if (parts[1] === 'organizacja' && org) return { head, body: orgPage(e) }; // js/ui-memorial.js
  if (!m) {
    const a = typeof advanceInfo === 'function' && e.kind === 'comp' ? advanceInfo(e) : null;
    const note = a ? `<div class="panel small" style="margin-bottom:12px"><b>Awans:</b> ${a.top} ${plural(a.top, 'najlepszy zawodnik', 'najlepszych zawodników', 'najlepszych zawodników')} awansuje do: ${esc(a.to)}${a.target ? ` (${fmtDate(a.target.date)}${a.target.venue ? ', ' + esc(a.target.venue) : ''})` : ''}.</div>` : '';
    return { head, body: note + previewBody(e, c) };
  }
  if (parts[1] === 'biegi') return { head, body: m.heats.slice().reverse().map(h => heatCard(h, m)).join('') };
  if (m.exam) return { head, body: `<div class="panel flush"><table class="t"><thead><tr><th>Adept</th><th>Klub</th><th>Egzamin</th><th class="num">Umiejętności</th><th>Wynik</th></tr></thead><tbody>
    ${m.exam.sort(by(x => x.ok ? 0 : 1)).map(x => `<tr class="${x.clubId === G.clubId ? 'me' : ''}"><td>${x.riderId && G.riders[x.riderId] ? riderLink(x.riderId) : esc(x.name)}</td><td>${examClubCell(x)}</td><td class="small">${x.kind && typeof KID_LIC !== 'undefined' ? esc(KID_LIC[x.kind].short) : 'licencja Ż'}</td><td>${(e => e ? caStars(e) : '')(R(x.riderId || x.kidId))}</td><td>${x.ok ? `<b class="pos">${x.kind ? 'zdany' : 'licencja'}</b>` : '<span class="neg">niezdany</span>'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Brak kandydatów.</td></tr>'}</tbody></table></div>` };
  if (m.units) {
    return { head, body: `<div class="grid g2">${m.classification.map(x => { const u = m.units[x.key];
      return `<div class="panel flush ${u.clubId === G.clubId ? 'mine-unit' : ''}"><div class="ph"><h3>${x.place}. ${unitLabel(m, x.key)}</h3><b>${x.pts} pkt</b></div><table class="t proto"><tbody>
        ${u.riders.filter(id => m.riders[id]).map(id => { const s = m.riders[id]; return `<tr><td>${riderCell(id, m)}</td><td class="line">${s.line.join(', ') || '—'}</td><td class="num"><b>${s.pts}</b>${s.bonus ? `+${s.bonus}` : ''}</td></tr>`; }).join('')}</tbody></table></div>`; }).join('')}</div>${runOffNote(m)}` };
  }
  setCtx(m.classification.map(x => x.riderId).filter(id => G.riders[id]), e.name);
  const intl = isIntl(e);
  const finals = m.heats.some(h => h.label && /^(Półfinał|Finał)/.test(h.label));
  // zawody z awansem (eliminacje, kwalifikacje): ilu awansuje i dokąd; po ogłoszeniu listy kolejnej rundy – faktyczni awansujący
  const adv = typeof advanceInfo === 'function' && e.kind === 'comp' ? advanceInfo(e) : null;
  const advIds = adv && adv.target && adv.target.startList ? adv.target.startList.filter(x => /awans/.test(x.via || '')).map(x => String(x.id)) : null;
  const advUp = x => adv && (advIds ? advIds.includes(String(x.riderId)) : x.place <= adv.top);
  return { head, body: `<div class="panel flush"><table class="t proto"><thead><tr><th>Miejsce</th><th>Zawodnik</th>${intl ? '<th>Kraj</th>' : '<th>Klub</th>'}<th>Biegi</th><th class="num">Pkt w biegach</th>${finals ? '<th class="num">Bieg awansu</th><th class="num">Finał</th>' : ''}${hasTable ? '<th class="num">Pkt klasyf.</th>' : ''}</tr></thead><tbody>
    ${m.classification.map(x => { const r = R(x.riderId), up = advUp(x), sub = subLabel(e, x.riderId); return `<tr class="${r && r.clubId === G.clubId ? 'me' : ''}${adv && x.place === adv.top ? ' adv-cut' : ''}"${adv && x.place === adv.top ? ' style="border-bottom:2px solid var(--accent, #4caf50)"' : ''}><td><b>${x.place}</b></td><td>${riderCell(x.riderId, m)}${sub ? ` <span class="pill" title="nie było go na liście startowej">${sub}</span>` : ''}${up ? ' <span class="pill ok" title="awans do: ' + esc(adv.to) + '">awans</span>' : ''}</td><td class="small">${intl ? esc(r && COUNTRY[r.country] || '') : evClubCell(e, r)}</td><td class="line">${m.riders[x.riderId].line.join(', ')}</td><td class="num">${x.heatPts}</td>${finals ? `<td class="num">${['Półfinał', 'LCQ', 'Bieg ostatniej szansy'].map(p => stagePts(m, x.riderId, p)).filter(p => p !== '—').join(', ') || '—'}</td><td class="num"><b>${stagePts(m, x.riderId, 'Finał')}</b></td>` : ''}${hasTable ? `<td class="num"><b>${x.gp}</b></td>` : ''}</tr>`; }).join('')}</tbody></table>
    ${adv ? `<p class="small" style="padding:0 14px"><b>Awans:</b> ${adv.top} ${plural(adv.top, 'najlepszy zawodnik', 'najlepszych zawodników', 'najlepszych zawodników')} awansuje do: ${esc(adv.to)}${adv.target ? ` (${fmtDate(adv.target.date)}${adv.target.venue ? ', ' + esc(adv.target.venue) : ''})` : ''}.${advIds ? ' Oznaczeni zawodnicy są na liście startowej kolejnej rundy (zawodnik, który awansował już wcześniej, nie zajmuje drugiego miejsca).' : ''}</p>` : ''}
    ${finals ? '<p class="small muted" style="padding:0 14px">Kolejność według finału i biegów awansu właściwych dla tych zawodów. Punkty biegowe obejmują wszystkie starty.</p>' : ''}</div>${runOffNote(m)}${runOffNote(m, true)}` };
};
// Zawodnik spoza listy startowej w protokole: rezerwowy albo dowołany przez organizatora w dniu zawodów
function subLabel(e, id) {
  if (e.kind !== 'comp' || !e.startList || e.startList.some(x => String(x.id) === String(id))) return '';
  if ((e.lateCalls || []).some(x => String(x) === String(id))) return 'dowołany';
  return (e.reserves || []).some(x => String(x) === String(id)) ? 'rezerwowy' : 'zastępca';
}
// Biegi dodatkowe (remisy punktowe, js/ties.js): wynik pod klasyfikacją; series – tylko klasyfikacji generalnej cyklu
function runOffNote(m, series) {
  const ro = (m.heats || []).filter(h => h.phase === 'run-off' && /klasyfikacja generalna/.test(h.label) === !!series);
  if (!ro.length) return '';
  return `<div class="panel" style="margin-top:12px"><h3>${ro.length > 1 ? 'Biegi dodatkowe' : 'Bieg dodatkowy'}</h3>${ro.map(h => `<div class="row small" style="gap:8px;flex-wrap:wrap"><b>${esc(h.label.replace(/^Bieg dodatkowy\s*[–-]?\s*/, ''))}:</b> ${h.res.slice().sort((a, b) => (a.pos || 9) - (b.pos || 9)).map(x => `${x.pos ? `${x.pos}.` : `<span class="neg">${x.status}</span>`} ${esc(nameOf(x.riderId, m))}${(h.entries.find(e => String(e.riderId) === String(x.riderId)) || {}).team && m.units ? ` <span class="muted">(${esc(m.units[h.entries.find(e => String(e.riderId) === String(x.riderId)).team].name)})</span>` : ''}`).join(', ')}</div>`).join('')}
    <p class="small muted">Remis punktowy rozstrzyga bieg dodatkowy (o 1. miejsce, podium mistrzostw, awans); pozostałe remisy – liczba miejsc w biegach, bezpośrednie spotkania, losowanie.</p></div>`;
}
function heatCard(h, m) {
  return `<div class="heat"><div class="hh"><span>${esc(h.label || `Bieg ${h.no}`)}</span><span class="small muted">${h.time ? h.time.toFixed(2).replace('.', ',') + ' s' : ''}</span></div><div class="rows"><div class="riders">
    ${h.res.map(x => { const en = h.entries.find(z => z.riderId === x.riderId) || {}; const r = R(x.riderId); return `<div class="hr ${r && r.clubId === G.clubId ? 'me' : ''}">${helmet(en.helmet || ['czerwony', 'niebieski', 'biały', 'żółty'][GATES.indexOf(en.gate)] || 'biały')}<span class="gate">${en.gate || ''}</span><span class="nm">${esc(nameOf(x.riderId, m))}${typeof bikeBadge === 'function' ? bikeBadge(en) : ''}${en.team && m.units ? ` <span class="small muted">${esc(m.units[en.team].name)}</span>` : ''}</span><span class="p">${x.status ? `<span class="neg">${x.status}</span>` : x.pts}</span></div>`; }).join('')}</div>
    <div class="log">${h.log.map(l => `<div>${l}</div>`).join('')}</div></div></div>`;
}
// Obsada rundy GP: rozegrana – z protokołu; nierozegrana – po ogłoszeniu dzikiej karty (js/qualification.js: sgpRoundField)
function sgpRoundInfo(e) {
  const perm = G.sgp.riders.slice(0, 15), m = e.played && G.matches[e.matchId];
  const ex = e.sgpExtras || (!e.played && e.date <= addDays(G.date, typeof SGP_EXTRAS_DAYS !== 'undefined' ? SGP_EXTRAS_DAYS : 30) && typeof sgpRoundExtras === 'function' ? sgpRoundExtras(e) : null);
  const field = m ? Object.keys(m.riders || {}).map(Number) : ex && typeof sgpRoundField === 'function' ? sgpRoundField(e) : null;
  if (!field) return { ex, field: null, out: [], subs: [] };
  const inF = id => field.some(x => String(x) === String(id)), same = (a, b) => String(a) === String(b);
  const wc = ex && ex.wildcard, trAll = ex ? ex.trackReserves : [];
  // nierozegrana: sgpRoundField zwraca zastępcę na miejscu zastępowanego; rozegrana: kolejność zastępców nieznana
  const out = m ? perm.filter(id => !inF(id)) : perm.filter((id, i) => !same(field[i], id));
  const repl = m ? field.filter(id => !perm.some(p => same(p, id)) && !same(id, wc)) : perm.map((id, i) => field[i]).filter((id, i) => !same(id, perm[i]));
  const isTr = id => trAll.some(t => same(t, id));
  if (m) repl.sort((a, b) => isTr(a) - isTr(b)); // rezerwa toru, która weszła tylko do biegu, nie zastępuje stałego uczestnika
  repl.length = Math.min(repl.length, out.length);
  return { ex, field, out, subs: repl.map(id => (isTr(id) ? null : id)), tr: repl.map(id => (isTr(id) ? id : null)) };
}
function sgpEntrantsPage(list) {
  const S = G.sgp, via = S.via || {}, cty = id => `<td class="small">${R(id) ? `${flag(R(id).country)} ${esc(COUNTRY[R(id).country] || R(id).country)}` : ''}</td>`;
  const mine = id => R(id) && R(id).clubId === G.clubId ? 'me' : '';
  const sgpRules = 'Stali uczestnicy (FIM): 7 najlepszych poprzedniego cyklu, mistrz Europy, 4 najlepszych z GP Challenge (zawodnik już zakwalifikowany oddaje miejsce następnemu) i 3 stałe dzikie karty promotora. Stałych rezerwowych wyznaczają FIM i promotor – zastępują nieobecnego stałego uczestnika w kolejności R1–R4; gdy żaden nie może, jedzie rezerwa toru.';
  const rounds = list.filter(e => e.kind === 'sgp').map(e => {
    const x = sgpRoundInfo(e), ex = x.ex, nm = id => id != null && R(id) ? riderLink(id) : '—';
    const repl = x.out.length ? x.out.map((id, i) => `${nm(id)} → ${x.subs[i] != null ? nm(x.subs[i]) : x.tr[i] != null ? `${nm(x.tr[i])} <span class="muted">(rezerwa toru)</span>` : '—'}`).join('<br>') : x.field ? '<span class="muted">bez zmian</span>' : '';
    return `<tr><td>${e.round}</td><td><a href="#/gp/${e.id}">${esc(e.venue)}</a></td><td class="small">${fmtDateShort(e.date)}</td>${ex ? `<td>${nm(ex.wildcard)}</td><td class="small">${ex.trackReserves.map(nm).join('<br>')}</td>` : `<td colspan="2" class="small muted">ogłoszenie ok. ${typeof SGP_EXTRAS_DAYS !== 'undefined' ? SGP_EXTRAS_DAYS : 30} dni przed rundą</td>`}<td class="small">${repl}</td></tr>`;
  }).join('');
  return `<div class="grid g2"><div class="panel flush"><div class="ph"><h3>Stali uczestnicy ${S.season}</h3></div><table class="t"><tbody>
    ${S.riders.slice(0, 15).map((id, i) => `<tr class="${mine(id)}"><td>${i + 1}</td><td>${riderLink(id)}</td>${cty(id)}<td class="small muted">${esc(via[id] || '')}</td></tr>`).join('')}</tbody></table></div>
    <div class="panel flush"><div class="ph"><h3>Stali rezerwowi</h3></div><table class="t"><tbody>
    ${(S.reserves || []).map((id, i) => `<tr class="${mine(id)}"><td>R${i + 1}</td><td>${riderLink(id)}</td>${cty(id)}</tr>`).join('') || '<tr><td class="empty">Brak listy</td></tr>'}</tbody></table>
    <p class="small muted" style="padding:0 14px">${sgpRules}</p></div></div>
    <div class="panel flush" style="margin-top:12px"><div class="ph"><h3>Rundy: dzikie karty, rezerwy toru i zastępstwa</h3></div><table class="t"><thead><tr><th>#</th><th>Runda</th><th>Data</th><th>Dzika karta (16)</th><th>Rezerwy toru (17–18)</th><th>Zastępstwa</th></tr></thead><tbody>${rounds}</tbody></table>
    <p class="small muted" style="padding:0 14px">Dziką kartę i dwie rezerwy toru nominuje federacja kraju gospodarza na każdą rundę osobno.</p></div>`;
}
const QUAL_TEXT = {
  IMP: 'Finały IMP: zawodnicy rozstawieni przez GKSŻ oraz awans z IMP Challenge. Lista stała na wszystkie finały.',
  IMPC: 'IMP Challenge: awans z eliminacji IMP oraz zawodnicy nominowani.', SK: 'Finał Srebrnego Kasku: awans z eliminacji oraz rozstawieni juniorzy (U21).',
  BK: 'Finał Brązowego Kasku: awans z eliminacji oraz rozstawieni zawodnicy U19.', MIMP: 'Finał MIMP: awans z eliminacji oraz rozstawieni juniorzy.',
  SEC: 'Finały IME: awans z Eliminacji (ECC) oraz nominacje. Lista stała na wszystkie finały.', SGP2: 'SGP2: awans z rund kwalifikacyjnych oraz nominacje. Lista stała na cały cykl.',
};
// Klub zgłaszający do egzaminu: ligowy albo szkółka zrzeszona w PZM
const examClubCell = x => x.clubId && G.clubs[x.clubId] ? clubLink(x.clubId) : x.schoolId && G.miniSchools && G.miniSchools[x.schoolId] ? `<span class="small">${esc(G.miniSchools[x.schoolId].name)}</span>` : '<span class="muted">bez klubu</span>';
// Klub zawodnika w zawodach krajowych: w Polsce – klub ligowy; w mistrzostwach innych krajów – klub z ligi tego kraju (skład 2026), inaczej „—”
function evClubCell(ev, r) {
  if (!r) return '—';
  const cc = (compOf(ev) || {}).cc;
  if (!cc || cc === 'POL') return clubLink(r.clubId);
  const fc = Object.values(G.fclubs || {}).find(c => c.country === cc && c.squad.includes(r.id));
  return fc && typeof fClubLink === 'function' ? fClubLink(fc.id) : '<span class="muted">—</span>';
}
function previewBody(e, c) {
  const intl = isIntl(e);
  if (c.format === 'exam') {
    const cands = Object.values(G.academy).filter(k => examCandidate(k, e.date) && (examRegistered(k, e.date) || k.clubId === G.clubId));
    return `<div class="panel flush"><div class="ph"><h3>Kandydaci zgłoszeni przez kluby (adepci 500 cm³ po 15. urodzinach)</h3><span class="small muted">egzamin ${fmtDate(e.date)}</span></div><table class="t"><tbody>${cands.map(k => `<tr class="${k.clubId === G.clubId ? 'me' : ''}"><td>${riderCell(k.id)}</td><td>${examClubCell(k)}</td><td>${caStars(k)}</td><td>${k.clubId === G.clubId ? (!examRegistered(k, e.date) ? '<span class="muted">niezgłoszony</span>' : '<span class="pos">zgłoszony</span>') : ''}</td></tr>`).join('') || '<tr><td class="empty">Brak kandydatów</td></tr>'}</tbody></table></div>${(ret => ret.length ? `<div class="panel flush" style="margin-top:12px"><div class="ph"><h3>Powroty – zawodnicy z wygasłą licencją</h3></div><table class="t"><tbody>${ret.map(r => `<tr class="${r.clubId === G.clubId ? 'me' : ''}"><td>${riderLink(r.id)}</td><td>${clubLink(r.clubId)}</td><td>${caStars(r)}</td><td>${r.clubId === G.clubId && !r.examRegistered ? '<span class="muted">niezgłoszony</span>' : '<span class="pos">zgłoszony</span>'}</td></tr>`).join('')}</tbody></table></div>` : '')(typeof licExamCandidates === 'function' ? Object.values(G.riders).filter(r => licState(r) === 'expired' && r.clubId && G.clubs[r.clubId]) : [])}`;
  }
  if (e.kind === 'sgp') {
    const soon = e.date <= addDays(G.date, typeof SGP_EXTRAS_DAYS !== 'undefined' ? SGP_EXTRAS_DAYS : 30);
    const ex = soon && typeof sgpRoundExtras === 'function' && G.sgp.season === e.season ? sgpRoundExtras(e) : null;
    const fed = ex && ex.country ? (NATION_INFO[ex.country] || {}).fed || COUNTRY[ex.country] || ex.country : 'federacja gospodarza';
    const row = (n, id, lab) => `<tr class="${R(id) && R(id).clubId === G.clubId ? 'me' : ''}"><td>${n}</td><td>${riderCell(id)}</td><td class="small">${esc(COUNTRY[R(id).country] || '')}</td><td class="small muted">${lab}</td></tr>`;
    const info = ex ? sgpRoundInfo(e) : { out: [], subs: [], tr: [] }, via = G.sgp.via || {};
    const permRow = (id, i) => { const k = info.out.indexOf(id); if (k < 0) return row(i + 1, id, `stały uczestnik${via[id] ? ` – ${esc(via[id])}` : ''}`);
      const sub = info.subs[k] ?? info.tr[k];
      return sub != null ? row(i + 1, sub, `za: ${esc(R(id) ? R(id).name : '')} (${info.subs[k] != null ? `stały rezerwowy R${G.sgp.reserves.indexOf(sub) + 1}` : 'rezerwa toru'})`) : row(i + 1, id, '<span class="neg">nieobecny – brak zastępcy</span>'); };
    const resRows = (G.sgp.reserves || []).filter(id => !info.subs.includes(id) && !(ex && (ex.wildcard === id || ex.trackReserves.includes(id)))).map(id => `<tr class="dim"><td>R${G.sgp.reserves.indexOf(id) + 1}</td><td>${riderCell(id)}</td><td class="small">${esc(COUNTRY[R(id).country] || '')}</td><td class="small muted">stały rezerwowy</td></tr>`).join('');
    return `<div class="panel flush"><div class="ph"><h3>Lista startowa</h3><span class="small muted">zawody ${fmtDate(e.date)} · <a href="#/rozgrywki/SGP/uczestnicy">uczestnicy cyklu</a></span></div><table class="t"><tbody>${G.sgp.riders.slice(0, 15).map(permRow).join('')}
      ${ex ? `${ex.wildcard != null ? row(16, ex.wildcard, `dzika karta – ${esc(fed)}${ex.clubId && R(ex.wildcard).clubId === ex.clubId ? ', zawodnik miejscowego klubu' : ''}`) : ''}${ex.trackReserves.map((id, i) => row(17 + i, id, `rezerwa toru – ${esc(fed)}`)).join('')}`
        : `<tr><td>16–18</td><td colspan="3" class="small muted">Dzika karta i rezerwy toru: nominacja federacji kraju gospodarza, ogłoszenie ok. ${typeof SGP_EXTRAS_DAYS !== 'undefined' ? SGP_EXTRAS_DAYS : 30} dni przed rundą.</td></tr>`}${resRows}</tbody></table></div>`;
  }
  if (!e.startList && !e.units) {
    const rule = QUAL_TEXT[e.comp] || (c.group === 'turnieje' ? 'Listę startową ogłasza organizator zawodów.' : c.format === 'ind' ? 'Lista startowa według zasad kwalifikacji i nominacji.' : 'Składy drużyn są awizowane przed zawodami.');
    return `<div class="panel"><h3>${c.format === 'ind' ? 'Lista startowa' : 'Składy'}</h3><p>${c.format === 'ind' ? 'Lista startowa' : 'Awizowane składy'} zostaną ogłoszone <b>${fmtDate(announceDate(e))}</b>.</p><p class="small muted">${rule}</p></div>`;
  }
  if (e.units) return `<p class="small muted">Składy awizowane ${fmtDate(e.announced)}.</p><div class="grid g2">${e.units.map(u => `<div class="panel"><h3>${u.clubId && !intl ? clubLink(u.clubId) : `${u.country && u.country !== 'UNK' ? flag(u.country) : ''}${esc(u.name)}`}</h3>${u.riders.map(id => `<div style="margin:4px 0">${riderCell(id)}</div>`).join('')}</div>`).join('')}</div>`;
  return `<div class="panel flush"><div class="ph"><h3>Lista startowa</h3><span class="small muted">ogłoszona ${fmtDate(e.announced)}</span></div><table class="t"><tbody>
    ${e.startList.map((x, i) => { const r = R(x.id); return `<tr class="${r && r.clubId === G.clubId ? 'me' : ''}"><td>${i + 1}</td><td>${riderCell(x.id)}</td><td class="small">${intl ? esc(r && COUNTRY[r.country] || '') : evClubCell(e, r)}</td><td class="small muted">${esc(x.via)}</td></tr>`; }).join('')}
    ${(e.reserves || []).map((id, i) => `<tr class="dim"><td>R${i + 1}</td><td>${riderCell(id)}</td><td class="small">${intl ? esc(R(id) && COUNTRY[R(id).country] || '') : evClubCell(e, R(id))}</td><td class="small muted">${esc(e.reservesVia || 'rezerwowy')}</td></tr>`).join('')}</tbody></table></div>`;
}

// Zawody w USA: regulamin kategorii mistrzostw i ogólne zasady AMA (js/usa-data.js – tools/build-usa.cjs, źródła w data/usa/sources)
const USA_CAT_BY_NAME = [[/AMA National/, 'ama-national'], [/U\.S\. National/, 'us-national'], [/młodzieży|Youth/, 'ama-youth'], [/Silver Cup/, 'silver-cup'],
  [/Nowy Jork|New York/, 'ny-state'], [/US Open/, 'us-open'], [/Track Championship|toru Fast Fridays/, 'ff-track'], [/U21/, 'ama-u21'], [/Kalifornii|California/, 'cal-state']];
function usaRulesCat(c) {
  if (typeof USA_DATA === 'undefined' || !c || c.cc !== 'USA') return null;
  const hit = USA_CAT_BY_NAME.find(([re]) => re.test(c.name || ''));
  return { cat: hit ? USA_DATA.categories.find(x => x.key === hit[1]) : null, comp: c };
}
function usaRulesPage({ cat, comp }) {
  const R = USA_DATA.rules;
  const sec = r => `<div class="panel"><h3>${esc(r.name)}</h3><ul class="report">${r.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul><p class="small muted">Źródło: ${esc(r.src)}</p></div>`;
  const medals = cat ? USA_DATA.medals.filter(([k]) => k === cat.key || k.startsWith(cat.key + '-')) : [];
  const med = medals.length ? `<h4>Medaliści</h4><table class="t"><thead><tr><th>Rok</th><th>Kategoria</th><th>Złoto</th><th>Srebro</th><th>Brąz</th></tr></thead><tbody>${medals.map(([k, y, pod]) => `<tr><td>${y}</td><td class="small">${esc(USA_DATA.medalLabels[k] || k)}</td>${[0, 1, 2].map(i => `<td>${pod[i] ? esc(pod[i]) : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  const head = cat ? `<div class="panel"><h3>${esc(cat.name)}</h3><p><b>${esc(cat.pl)}</b></p><p>${esc(cat.format)}</p><p class="small"><b>Edycje:</b> ${esc(cat.editions)}</p>${med}<p class="small muted">Źródło: ${esc(cat.src)}</p></div>`
    : `<div class="panel"><h3>${esc(comp.name)}</h3><p class="small muted">${esc(comp.src || '')}</p></div>`;
  return `<div class="stack">${head}<div class="grid g3" style="margin-top:16px">${sec(R.champFormat)}${sec(R.licences)}${sec(R.programs)}</div></div>`;
}
