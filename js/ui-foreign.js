'use strict';
// Ligi zagraniczne: przegląd, tabela, terminarz, składy, regulamin, protokół meczu (biegi) i wpisy w kalendarzu (js/foreign.js).

NAV_PARENT.zagranica = 'rozgrywki';
GROUP_CAT.kraje = 'kraje';
EV_CATS.kraje = 'Mistrzostwa krajów'; EV_CATS.zagr = 'Ligi zagraniczne';
UI.calCats.kraje = true; UI.calCats.zagr = true;
const F_STAGE = { RS: 'runda zasadnicza', R: 'runda', G: 'faza grupowa', R1: '1. runda', QF: 'ćwierćfinał', SF: 'półfinał', F: 'finał' };
const F_GRP = { N: 'grupa północna', S: 'grupa południowa', SC: 'grupa szkocka' };
const fDays = L => (L.days || []).map(d => DAYS_SHORT[(d + 6) % 7]).join(', ');
// herb klubu zagranicznego (img/logos/foreign), a gdy go brak – flaga kraju
function fCrest(c, cls = 'sm') { return c && ASSETS.clubs[c.id] ? crest(c, cls) : c ? flag(c.country) : ''; }
function fClubLink(cid) { const c = fClub(cid); return c ? `<a class="clubname" href="#/zagranica/klub/${cid}" onclick="event.stopPropagation()">${fCrest(c)}<span>${esc(c.name)}</span></a>` : esc(cid); }
const fSeasons = () => [...new Set(Object.values(G.ffix || {}).map(f => f.season))].sort();
const fMyIds = () => new Set(Object.values(G.riders).filter(r => r.clubId === G.clubId).map(r => String(r.id)));
function fScore(f) {
  if (!f.played) return '';
  if (f.cancelled || !f.res) return '<span class="muted">nie odbył się</span>';
  return f.units.length === 2 ? `<b>${f.res.pts[f.units[0]] ?? 0}:${f.res.pts[f.units[1]] ?? 0}</b>` : `wygrywa ${esc(fClubShort(f.res.cls[0]))} (${f.res.pts[f.res.cls[0]]})`;
}

PAGES.zagranica = parts => {
  if (!FP || !G.fclubs) return { title: 'Ligi zagraniczne', body: '<div class="panel empty">Brak danych lig zagranicznych.</div>' };
  if (parts[0] === 'mecz') return fMatchPage(parts[1], parts[2] || '');
  if (parts[0] === 'klub') return fClubPage(parts[1]);
  if (parts[0] === 'transfery') return fTransfersPage(parts[1]);
  if (parts[0] && FP.leagues[parts[0]]) return fLeaguePage(parts[0], parts[1] || '');
  if (parts[0] && FP.cups && FP.cups[parts[0]]) return fCupPage(parts[0]);
  const season = Number(UI.fSeason) || G.season, seasons = fSeasons();
  const selS = seasons.length ? `<select onchange="UI.fSeason=this.value;render()">${seasons.map(s => `<option ${s === season ? 'selected' : ''}>${s}</option>`).join('')}</select> · ` : '';
  const my = fMyIds();
  const byCc = {};
  // tylko ligi – puchary (np. Knockout Cup) to pojedyncze mecze: terminarz w kalendarzu, wyniki w historii startów zawodnika
  for (const L of Object.values(FP.leagues)) (byCc[L.country] ||= []).push(L);
  const card = L => {
    const fx = Object.values(G.ffix).filter(f => f.lg === L.id && f.season === season), played = fx.filter(f => f.played);
    const next = fx.filter(f => !f.played && !f.skip).sort(by(f => f.d))[0], champ = G.fseasons[season] && G.fseasons[season].champions[L.id];
    const lead = played.length && !L.cup ? fStandings(L.id, season)[0] : null;
    const ours = Object.values(G.fclubs).filter(c => c.league === (L.cup ? L.parent : L.id)).reduce((n, c) => n + c.squad.filter(id => my.has(String(id))).length, 0);
    return `<div class="panel comp-card" onclick="go('#/zagranica/${L.id}')"><div class="small muted">${flag(L.country)} ${esc(COUNTRY[L.country] || L.country)} · poziom ${L.tier}${L.days ? ` · ${fDays(L)}` : ''}</div>
      <div class="nm">${L.cup ? '🏆 ' : ''}${esc(L.name)}</div><div class="small muted">${esc(L.full)} · ${L.cup ? `puchar (${esc(fLeague(L.parent).name)})` : `${L.clubs.length} drużyn`}</div>
      <div class="small" style="margin-top:6px">${champ ? `mistrz: <b>${esc(fClubName(champ))}</b>` : next ? `następny mecz: <b>${fmtDateShort(next.d)}</b>` : fx.length ? '<span class="muted">sezon zakończony</span>' : '<span class="muted">terminarz po publikacji sezonu</span>'}</div>
      ${lead && !champ ? `<div class="small muted">prowadzi: ${esc(fClubName(lead.cid))}</div>` : ''}${ours && !L.cup ? `<div class="small pos">naszych zawodników w składach: ${ours}</div>` : ''}
      <div class="bar" style="margin-top:8px"><i style="width:${fx.length ? Math.round(played.length / fx.length * 100) : 0}%"></i></div></div>`;
  };
  return { title: 'Ligi zagraniczne', sub: `${selS}${Object.keys(FP.leagues).length} lig, ${Object.keys(G.fclubs).length} drużyn${Object.keys(G.ftrans || {}).length ? ' · <a href="#/zagranica/transfery">transfery</a>' : ''} · wszystkie mecze rozgrywane bieg po biegu według regulaminowych tabel biegowych`,
    body: `<div class="panel small"><b>Dni meczowe</b> (zweryfikowane w terminarzach ${FP.season}): Premiership – poniedziałek i czwartek („as per SLB”, SCB 010.1.1); Championship – stały dzień domowy klubu (wt–nd); Bauhaus-ligan – wtorek; Allsvenskan – czwartek; SpeedwayLigaen – środa; duńskie 1. i 2. division – sobota; Division 1 – weekend. Pierwszeństwo: SGP, DPŚ/SON, kwalifikacje, mistrzostwa kraju, potem ligi; zawodnik startujący tego dnia w Polsce nie jedzie za granicą.</div>
      ${Object.entries(byCc).map(([cc, ls]) => `<div class="group-title">${flag(cc)} ${esc(COUNTRY[cc] || cc)} <span class="n">${ls.length}</span></div><div class="comp-grid">${ls.map(card).join('')}</div>`).join('')}` };
};
// Średnia wymagana przez limit składu ligi: Wielka Brytania – CMA (średnia meczowa, 4 biegi: (pkt + bonusy) × 4 / biegi, SCB);
// Szwecja, Dania, Niemcy – średnia biegowa (snitt / snit / Schnitt) – ta sama co kolumna „Średnia”
const F_KSM = { GBP: 'CMA', GBC: 'CMA', GBN: 'CMA' };
const fAvg = x => (x.h ? (x.p + x.b) / x.h : 0);
// Statystyki zawodników jednej ligi w sezonie – z protokołów meczów (G.ffix), także play-off; klub: ostatni mecz w sezonie
function fLeagueStats(lg, season) {
  const per = {};
  for (const f of Object.values(G.ffix).filter(x => x.lg === lg && x.season === season && x.res).sort(by(x => x.d))) {
    for (const [id, s] of Object.entries(f.res.riders)) {
      if (!s.heats) continue;
      const x = per[id] ||= { id, m: 0, h: 0, p: 0, b: 0, w: 0, falls: 0, def: 0, exc: 0, c: null };
      const line = s.line || [];
      x.m++; x.h += s.heats; x.p += s.pts; x.b += s.bonus || 0; x.c = s.u || x.c;
      x.w += line.filter(v => String(v).startsWith('3')).length; x.falls += line.filter(v => v === 'u').length; x.def += line.filter(v => v === 'd').length; x.exc += line.filter(v => v === 'w' || v === 't').length;
    }
  }
  return per;
}
function fStatsPage(lg, season) {
  const ksm = F_KSM[lg], my = fMyIds();
  const rows = Object.values(fLeagueStats(lg, season)).filter(x => x.h >= 5 && G.riders[x.id]).sort(by(x => fAvg(x), -1));
  setCtx(rows.map(x => x.id), `Statystyki: ${FP.leagues[lg].name}`);
  return `<div class="panel flush"><table class="t"><thead><tr><th>#</th><th>Zawodnik</th><th>Klub</th><th class="num">Mecze</th><th class="num">Biegi</th><th class="num">Pkt</th><th class="num">Bonus</th><th class="num">Średnia</th>${ksm ? `<th class="num" title="średnia meczowa (4 biegi) – podstawa limitu składu">${ksm}</th>` : ''}<th class="num">Wygrane</th><th class="num">Upadki</th><th class="num">Defekty</th><th class="num">Wyklucz.</th></tr></thead><tbody>
    ${rows.map((x, i) => { const r = G.riders[x.id]; return `<tr class="click ${my.has(String(x.id)) ? 'me' : ''}" onclick="go('#/zawodnik/${x.id}/statystyki')"><td>${i + 1}</td><td>${flag(r.country)} <b>${esc(r.name)}</b></td><td>${x.c ? fClubLink(x.c) : ''}</td><td class="num">${x.m}</td><td class="num">${x.h}</td><td class="num">${x.p}</td><td class="num">${x.b}</td><td class="num"><b>${fAvg(x).toFixed(3)}</b></td>${ksm ? `<td class="num">${(fAvg(x) * 4).toFixed(2)}</td>` : ''}<td class="num">${x.w}</td><td class="num">${x.falls || ''}</td><td class="num">${x.def || ''}</td><td class="num">${x.exc || ''}</td></tr>`; }).join('') || `<tr><td colspan="${ksm ? 13 : 12}" class="empty">Statystyki pojawią się po pierwszych meczach (min. 5 biegów).</td></tr>`}</tbody></table></div>
    <p class="small muted">Średnia: (punkty + bonusy) / biegi w tej lidze – średnie lig nie są porównywalne z ligą polską.${ksm ? ' CMA – średnia meczowa (średnia × 4), według niej liczony jest limit składu (SCB).' : FP.leagues[lg].limit ? ' Limit składu liczony jest ze średniej biegowej (kolumna „Średnia”).' : ''}</p>`;
}
function fLeaguePage(lg, sub) {
  const L = FP.leagues[lg], season = Number(UI.fSeason) || G.season;
  const T = tabs(`zagranica/${lg}`, [['', 'Tabela'], ['terminarz', 'Terminarz'], ['sklady', 'Składy'], ['statystyki', 'Statystyki'], ['regulamin', 'Regulamin']], sub);
  const head = { title: `${flag(L.country)} ${esc(L.full)}`, sub: `Sezon ${season} · ${esc(COUNTRY[L.country] || L.country)} · ${esc(L.fed)}${L.days ? ` · mecze: ${fDays(L)}` : ''}`, tabs: T };
  const fx = Object.values(G.ffix).filter(f => f.lg === lg && f.season === season).sort(by(f => f.d + (f.tie || '') + (f.leg || '')));
  if (sub === 'terminarz') {
    const groups = {};
    for (const f of fx) (groups[f.st] ||= []).push(f);
    return { ...head, body: Object.entries(groups).map(([st, list]) => `<div class="panel flush" style="margin-bottom:12px"><div class="ph"><h3>${esc(F_STAGE[st] || st)}</h3><span class="small muted">${list.length} ${plural(list.length, 'mecz', 'mecze', 'meczów')}</span></div><table class="t"><tbody>
      ${list.map(f => `<tr class="click ${f.played ? '' : 'dim'}" onclick="go('#/zagranica/mecz/${f.id}')"><td class="nowrap">${fmtDateShort(f.d)} <span class="small muted">${DAYS_SHORT[dow(f.d)]}</span></td><td>${f.units.map(fClubLink).join(f.units.length === 2 ? ' – ' : ', ')}${f.leg ? ` <span class="pill">mecz ${f.leg}</span>` : ''}</td><td class="small muted">${esc(f.venue || '')}</td><td class="num">${f.void ? '<span class="muted">nierozegrany (play-off)</span>' : f.skip ? '<span class="muted">przed startem gry</span>' : fScore(f)}</td></tr>`).join('')}</tbody></table></div>`).join('') || '<div class="panel empty">Terminarz sezonu zostanie opublikowany razem z terminarzem ligi polskiej.</div>' };
  }
  if (sub === 'statystyki') return { ...head, body: fStatsPage(lg, season) };
  if (sub === 'sklady') {
    const my = fMyIds(), st0 = fLeagueStats(lg, season), ksm = F_KSM[lg];
    return { ...head, body: `<div class="grid g2">${L.clubs.map(cid => { const c = fClub(cid);
      return `<div class="panel flush"><div class="ph"><h3>${fClubLink(cid)}</h3><span class="small muted">${esc(c.city)}</span></div><table class="t"><thead><tr><th>Zawodnik</th><th></th><th class="num">Mecze</th><th class="num">Biegi</th><th class="num">Średnia</th>${ksm ? `<th class="num" title="średnia meczowa – limit składu">${ksm}</th>` : ''}</tr></thead><tbody>${c.squad.map(id => G.riders[id]).filter(Boolean).sort(by(r => r.skill, -1)).map(r => {
        const st = st0[r.id], drop = r.fl && r.fl.dropped && r.fl.dropped.some(x => x.clubId === cid);
        return `<tr class="${my.has(String(r.id)) ? 'me' : ''} ${r.retired || drop ? 'dim' : ''}"><td>${riderCell(r.id)}</td><td class="small muted">${drop ? 'limit lig GKSŻ' : r.retired ? 'koniec kariery' : ''}</td><td class="num small">${st ? st.m : ''}</td><td class="num small">${st ? st.h : ''}</td><td class="num small">${st ? `<b>${fAvg(st).toFixed(3)}</b>` : ''}</td>${ksm ? `<td class="num small">${st ? (fAvg(st) * 4).toFixed(2) : ''}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>`; }).join('')}</div>
      <p class="small muted">Składy ${FP.season}: ${esc(FP.leagues[lg].country === 'GBR' ? 'Wikipedia (sezony 2026 lig BSPL)' : FP.leagues[lg].country === 'SWE' ? 'protokoły Svemo TA' : FP.leagues[lg].country === 'DEN' ? 'system wyników DMU i listy SpeedwayLigaen' : 'protokoły federacji')}; zawodnik należy do klubu, w którym jechał najczęściej. Średnia: (punkty + bonusy) / biegi w tej lidze.</p>` };
  }
  if (sub === 'regulamin') {
    const t = fTable(L.table === 'gb-15' ? 'gb-15-set-1' : L.table), md = FP.matchDays[lg];
    const src = FP.heat.sources;
    return { ...head, body: `<div class="grid g2"><div class="panel"><h3>Format</h3><p>${esc(t.name)} – ${t.heatCount} biegów, ${t.teams} ${plural(t.teams, 'drużyna', 'drużyny', 'drużyn')}; skład meczowy: ${L.teamSize} zawodników.</p>
        ${L.kind === 'two' ? `<p>Punkty tabeli: zwycięstwo ${L.points.win}, remis ${L.points.draw}${L.points.aggregate ? `, punkt bonusowy za wygrany dwumecz (${L.points.aggregate})` : ''}.</p>` : `<p>Punkty za miejsce w rundzie: ${L.meetingPoints.join('–')}.</p>`}
        ${L.limit ? `<p>Limit składu: ${esc(L.limit)}.</p>` : ''}${L.playoff ? `<p>Play-off: ${L.playoff.dk || L.playoff.dkDiv ? 'półfinał (miejsca 3–6) i finał (miejsca 1–2 + dwie najlepsze drużyny półfinału) jako czwórmecze' : L.playoff.quarter ? 'ćwierćfinały 1–6, 2–5, 3–4 (do półfinałów zwycięzcy i najlepszy przegrany), półfinały i finał – dwumecze' : `${L.playoff.top} najlepsze drużyny, dwumecze`}.</p>` : ''}
        <ul class="small">${(t.notes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
      <div class="panel"><h3>Dni meczowe ${FP.season}</h3><p>${L.days ? `deklarowane: <b>${fDays(L)}</b>` : 'bez stałego dnia (rundy w terminach federacji)'}</p><p class="small">W terminarzu ${md.n} ${plural(md.n, 'mecz', 'mecze', 'meczów')}: ${Object.entries(md.observed).map(([d, n]) => `${d} ${n}`).join(', ')}.</p>
        <h3>Źródła tabeli biegowej</h3><ul class="small">${t.sources.map(s => { const x = src.find(y => y.id === s.id) || (SPEEDWAY_HEAT_TABLES.sources || []).find(y => y.id === s.id); return `<li>${x && x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(s.id)}</a>` : esc(s.id)} – ${esc(s.locator)}</li>`; }).join('')}</ul></div></div>
      <div class="panel flush" style="margin-top:12px"><div class="ph"><h3>Program biegów</h3><span class="small muted">${esc(t.id)}</span></div><table class="t"><thead><tr><th>Bieg</th>${['A', 'B', 'C', 'D'].map(g => `<th>pole ${g}</th>`).join('')}</tr></thead><tbody>${t.heats.map(h => `<tr><td>${h.no}${h.phase !== 'main' ? ` <span class="small muted">${esc(h.phase === 'final' ? 'finał' : 'nominowany')}</span>` : ''}</td>${['A', 'B', 'C', 'D'].map(g => { const e = h.entries.find(x => x.gate === g) || (h.entries.every(x => !x.gate) ? h.entries[['A', 'B', 'C', 'D'].indexOf(g)] : null); if (!e) return '<td></td>';
        const p = e.participant, lbl = p.type === 'teamSlot' ? `${p.team}${p.slot}` : p.type === 'startNumber' ? `nr ${p.number}` : p.type === 'rank' ? `${p.ranking}: ${p.place}. w drużynie` : p.type === 'nomination' ? 'nominacja' : '';
        return `<td>${e.helmet ? helmet(e.helmet) : ''} ${esc(lbl)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` };
  }
  const rows = fStandings(lg, season), champ = G.fseasons[season] && G.fseasons[season].champions[lg];
  const my = fMyIds();
  const ours = cid => fClub(cid).squad.filter(id => my.has(String(id))).length;
  return { ...head, body: `${champ ? `<div class="panel"><b>Mistrz ${season}: ${fClubLink(champ)}</b></div>` : ''}<div class="panel flush"><table class="t"><thead><tr><th>#</th><th>Drużyna</th><th class="num">M</th>${L.kind === 'two' ? '<th class="num">Z</th><th class="num">R</th><th class="num">P</th><th class="num">Bilans</th><th class="num">Bonus</th>' : '<th class="num">Pkt biegowe</th><th class="small">miejsca</th>'}<th class="num">Pkt</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr class="${ours(r.cid) ? 'me' : ''}"><td>${i + 1}</td><td>${fClubLink(r.cid)}${ours(r.cid) ? ` <span class="small pos">(${ours(r.cid)} nasz.)</span>` : ''}</td><td class="num">${r.m}</td>${L.kind === 'two' ? `<td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num">${r.pf}:${r.pa}</td><td class="num">${r.bp}</td>` : `<td class="num">${r.pf}</td><td class="small muted">${Object.entries(r.pl).map(([p, n]) => `${p}.×${n}`).join(' ')}</td>`}<td class="num"><b>${r.tp}</b></td></tr>`).join('')}</tbody></table></div>` };
}
function fMatchPage(id, sub) {
  const f = G.ffix[id];
  if (!f) return { title: 'Nie znaleziono meczu', body: '' };
  const L = fLeague(f.lg), res = f.res;
  const T = tabs(`zagranica/mecz/${id}`, [['', res ? 'Wynik' : 'Zapowiedź'], ...(res && res.heats ? [['biegi', 'Biegi']] : [])], sub);
  const head = { title: f.units.length === 2 ? `${fCrest(fClub(f.units[0]), '')} ${esc(fClubName(f.units[0]))} – ${esc(fClubName(f.units[1]))} ${fCrest(fClub(f.units[1]), '')}` : `${flag(L.country)} ${esc(`${L.name}: ${f.venue}`)}`,
    sub: `<a href="#/zagranica/${f.lg}">${esc(L.full)}</a> · ${esc(F_STAGE[f.st] || f.st)}${f.grp ? ` (${esc(F_GRP[f.grp] || f.grp)})` : ''}${f.round ? ` ${f.round}` : ''}${f.leg ? ` · mecz ${f.leg}` : ''} · ${fmtDay(f.d)}${f.venue ? ` · ${esc(f.venue)}` : ''}${res && res.weather ? ` · ${esc(res.weather.sky)}, tor ${esc(res.weather.track)}` : ''}${res ? ` · ${esc(fTable(res.tableId).name)}` : ''}`, tabs: T };
  if (!res) {
    const exp = f.units.map(cid => ({ cid, ids: fExpected(cid) }));
    return { ...head, body: f.skip ? '<div class="panel empty">Mecz odbył się przed rozpoczęciem gry.</div>' : f.cancelled ? '<div class="panel empty">Mecz się nie odbył (brak zawodników).</div>' : `<p class="small muted">Przewidywane składy (najlepsi dostępni zawodnicy składu; ostateczny skład w dniu meczu).</p><div class="grid g2">${exp.map(u => `<div class="panel"><h3>${fClubLink(u.cid)}</h3>${u.ids.map(x => `<div style="margin:4px 0">${riderCell(x)}</div>`).join('') || '<span class="muted">brak zawodników</span>'}</div>`).join('')}</div>` };
  }
  const m = { units: Object.fromEntries(f.units.map(cid => [cid, { name: fClubShort(cid) }])), names: {} };
  if (sub === 'biegi' && res.heats) return { ...head, body: res.heats.slice().reverse().map(h => heatCard({ ...h, log: h.log || [] }, m)).join('') };
  const my = fMyIds();
  return { ...head, body: `<div class="grid g2">${res.cls.map((cid, i) => `<div class="panel flush"><div class="ph"><h3>${f.units.length > 2 ? `${i + 1}. ` : ''}${fClubLink(cid)}</h3><b>${res.pts[cid]} pkt</b></div><table class="t proto"><tbody>
    ${Object.entries(res.riders).filter(([, s]) => s.u === cid).sort(by(([, s]) => s.no)).map(([rid, s]) => `<tr class="${my.has(String(rid)) ? 'me' : ''}"><td class="small muted">${s.no}</td><td>${riderCell(isNaN(rid) ? rid : Number(rid))}${(f.guests || []).map(String).includes(rid) ? ' <span class="small muted">(gość)</span>' : ''}</td><td class="line">${s.line.join(', ') || '—'}</td><td class="num"><b>${s.pts}</b>${s.bonus ? `+${s.bonus}` : ''}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div>` };
}
function fClubPage(cid) {
  const c = fClub(cid);
  if (!c) return { title: 'Nie znaleziono klubu', body: '' };
  const L = FP.leagues[c.league], season = G.season;
  const fx = Object.values(G.ffix).filter(f => f.season === season && f.units.includes(cid)).sort(by(f => f.d));
  return { title: `${fCrest(c, '')} ${esc(c.name)}`, sub: `<a href="#/zagranica/${c.league}">${esc(L.full)}</a> · ${esc(c.city)} · tor: ${esc(c.venue)}${c.homeDay != null ? ` · mecze domowe: ${DAYS_SHORT[(c.homeDay + 6) % 7]}` : ''}`,
    body: `<div class="grid g2"><div class="panel flush"><div class="ph"><h3>Skład</h3></div><table class="t"><thead><tr><th>Zawodnik</th><th class="num">Sezon ${season}</th></tr></thead><tbody>${c.squad.map(id => G.riders[id]).filter(Boolean).sort(by(r => r.skill, -1)).map(r => { const st = r.fstats && r.fstats[season] && r.fstats[season][c.league];
      return `<tr class="${r.retired ? 'dim' : ''}"><td>${riderCell(r.id)}</td><td class="num small">${st ? `${st.m} m · ${st.p}+${st.b || 0} pkt · śr. ${round2((st.p + (st.b || 0)) / Math.max(1, st.h))}` : ''}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="panel flush"><div class="ph"><h3>Mecze ${season}</h3></div><table class="t"><tbody>${fx.map(f => `<tr class="click ${f.played ? '' : 'dim'}" onclick="go('#/zagranica/mecz/${f.id}')"><td class="nowrap">${fmtDateShort(f.d)}</td><td>${esc(fLabel(f))}</td><td class="num">${fScore(f)}</td></tr>`).join('') || '<tr><td class="empty">Brak meczów w sezonie.</td></tr>'}</tbody></table>
      ${fClubTransfers(cid)}
      ${c.hist.length ? `<div class="ph"><h3>Historia</h3></div><table class="t"><tbody>${c.hist.slice().reverse().map(h => `<tr><td>${h.season}</td><td>${h.pos}. miejsce${h.pos === 1 ? ' 🏆' : ''}</td></tr>`).join('')}</tbody></table>` : ''}</div></div>` };
}
// Okno transferowe (js/foreign.js fTransferWindow): ruchy przed sezonem – lista wszystkich i w klubie
const fTrRow = (x, cid) => { const r = G.riders[x.id]; if (!r) return ''; const dir = cid ? (x.to === cid ? '<span class="pos">przychodzi</span>' : '<span class="neg">odchodzi</span>') : '';
  return `<tr><td>${riderCell(r.id)}</td><td class="small">${dir}${dir ? ' · ' : ''}${esc(F_TR_KIND[x.kind] || x.kind)}</td><td class="small">${x.from ? fClubLink(x.from) : '—'}</td><td class="small">${x.to ? fClubLink(x.to) : '—'}</td><td class="num small">${r.skill.toFixed(1)}</td></tr>`; };
function fClubTransfers(cid) {
  const ys = Object.keys(G.ftrans || {}).map(Number).sort((a, b) => b - a), y = ys[0];
  const list = y ? G.ftrans[y].filter(x => (x.from === cid || x.to === cid) && x.kind !== 'koniec') : [];
  return list.length ? `<div class="ph"><h3>Transfery przed sezonem ${y}</h3><a class="small" href="#/zagranica/transfery/${y}">wszystkie</a></div><table class="t"><tbody>${list.map(x => fTrRow(x, cid)).join('')}</tbody></table>` : '';
}
function fTransfersPage(ys) {
  const seasons = Object.keys(G.ftrans || {}).map(Number).sort((a, b) => b - a), y = Number(ys) || seasons[0];
  if (!y) return { title: 'Transfery – ligi zagraniczne', body: '<div class="panel empty">Okno transferowe otwiera się przed kolejnym sezonem (po zakończeniu bieżącego).</div>' };
  const cc = UI.ftrCc || '', kind = UI.ftrKind || '';
  const list = G.ftrans[y].filter(x => x.kind !== 'koniec' && (!kind || x.kind === kind) && (!cc || [x.from, x.to].some(c => c && G.fclubs[c] && G.fclubs[c].country === cc)))
    .sort(by(x => -((G.riders[x.id] || {}).skill || 0)));
  const ccs = [...new Set(Object.values(G.fclubs).map(c => c.country))];
  const sel = `<select onchange="go('#/zagranica/transfery/'+this.value)">${seasons.map(s => `<option ${s === y ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <select onchange="UI.ftrCc=this.value;render()"><option value="">wszystkie kraje</option>${ccs.map(c => `<option value="${c}" ${c === cc ? 'selected' : ''}>${esc(COUNTRY[c] || c)}</option>`).join('')}</select>
    <select onchange="UI.ftrKind=this.value;render()"><option value="">wszystkie ruchy</option>${Object.entries(F_TR_KIND).filter(([k]) => k !== 'koniec').map(([k, l]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return { title: `Transfery przed sezonem ${y} – ligi zagraniczne`, sub: `<a href="#/zagranica">‹ Ligi zagraniczne</a> · ${list.length} ruchów`,
    body: `<div class="row wrap" style="gap:8px;margin-bottom:10px">${sel}</div><div class="panel flush"><table class="t"><thead><tr><th>Zawodnik</th><th>Ruch</th><th>Skąd</th><th>Dokąd</th><th class="num">Poziom</th></tr></thead><tbody>${list.map(x => fTrRow(x)).join('') || '<tr><td colspan="5" class="empty">Brak ruchów.</td></tr>'}</tbody></table></div>` };
}
// Puchar: tabele grup i dwumecze kolejnych rund
function fCupPage(cup) {
  const K = FP.cups[cup], season = Number(UI.fSeason) || G.season, S = G.fseasons[season] || {};
  const fx = Object.values(G.ffix).filter(f => f.lg === cup && f.season === season).sort(by(f => f.d + (f.tie || '') + (f.leg || '')));
  const win = S.champions && S.champions[cup];
  const groups = Object.keys(K.groups || {}).map(g => `<div class="panel flush"><div class="ph"><h3>${esc(F_GRP[g] || g)}</h3></div><table class="t"><thead><tr><th>#</th><th>Drużyna</th><th class="num">M</th><th class="num">Z</th><th class="num">R</th><th class="num">P</th><th class="num">Pkt+</th><th class="num">Pkt−</th><th class="num">Pkt</th></tr></thead><tbody>
    ${fCupGroupTable(cup, g, season).map((r, i) => `<tr><td>${i + 1}</td><td>${fClubLink(r.cid)}</td><td class="num">${r.m}</td><td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num">${r.pf}</td><td class="num">${r.pa}</td><td class="num"><b>${r.tp}</b></td></tr>`).join('')}</tbody></table></div>`).join('');
  const slotLbl = x => G.fclubs[x] ? fClubLink(x) : /^W:/.test(x) ? `zwycięzca ${esc(F_STAGE[x.slice(2).split('-')[0]] || '')} ${x.split('-')[1]}` : /^G1:/.test(x) ? `zwycięzca: ${esc(F_GRP[x.slice(3)] || x.slice(3))}` : x === 'BR' ? 'najlepsza druga drużyna grup' : /^GW/.test(x) ? `${x[2]}. zwycięzca grupy` : esc(x);
  const ties = K.ties.map(t => {
    const legs = fCupTie(cup, season, t.st, t.tie), w = fCupTieWinner(legs);
    const head = legs.length ? `${fClubLink(legs[0].units[0])} – ${fClubLink(legs[0].units[1])}` : t.slots.map(slotLbl).join(' – ');
    const agg = legs.length && legs.every(f => f.played && f.res) ? (() => { const [a, b] = legs[0].units, sc = id => sum(legs.map(x => x.res.pts[id] || 0)); return ` · dwumecz <b>${sc(a)}:${sc(b)}</b>`; })() : '';
    return `<tr><td>${esc(F_STAGE[t.st] || t.st)}${K.ties.filter(x => x.st === t.st).length > 1 ? ` ${t.tie}` : ''}</td><td>${head}${agg}${w ? ` → <b>${esc(fClubShort(w))}</b>` : ''}</td>
      <td class="small">${(legs.length ? legs.map(f => `<a href="#/zagranica/mecz/${f.id}">${fmtDateShort(f.d)}${f.approx ? '*' : ''}</a> ${fScore(f)}`) : t.legs.map(l => `${fmtDateShort(addDays(l.d, fShift(season)))}${l.approx ? '*' : ''}`)).join('<br>')}</td></tr>`;
  }).join('');
  const gfx = fx.filter(f => f.st === 'G');
  return { title: `${flag(K.country)} ${esc(K.full)}`, sub: `Sezon ${season} · puchar ${esc(fLeague(K.parent).name)} · ${esc(K.fed)} · mecze według tabeli biegowej ligi (2 × 7, 15 biegów)`,
    body: `${win ? `<div class="panel"><b>Zdobywca pucharu ${season}: ${fClubLink(win)}</b></div>` : ''}${groups ? `<div class="grid g2">${groups}</div>` : ''}
      <div class="panel flush" style="margin-top:12px"><div class="ph"><h3>Dwumecze</h3></div><table class="t"><tbody>${ties}</tbody></table>
      <p class="small muted" style="padding:0 12px 10px">${esc(K.src)}. * termin przybliżony. Remis w dwumeczu rozstrzyga wyścig dodatkowy.</p></div>
      ${gfx.length ? `<div class="panel flush" style="margin-top:12px"><div class="ph"><h3>Mecze grupowe</h3></div><table class="t"><tbody>${gfx.map(f => `<tr class="click ${f.played ? '' : 'dim'}" onclick="go('#/zagranica/mecz/${f.id}')"><td class="nowrap">${fmtDateShort(f.d)}</td><td class="small muted">${esc(F_GRP[f.grp] || '')}</td><td>${f.units.map(fClubLink).join(' – ')}</td><td class="num">${fScore(f)}</td></tr>`).join('')}</tbody></table></div>` : ''}` };
}
// Kalendarz (miesiąc): mecze z udziałem naszych zawodników osobno, pozostałe zbiorczo dla ligi; wpisy z danymi do filtrów
// (kraj, rodzaj: liga zagraniczna / puchar, nasi zawodnicy, obserwowani)
function fCalEntries(days) {
  if (!FP || !G.ffix) return [];
  const set = new Set(days), out = [], my = fMyIds(), watch = new Set((G.shortlist || []).map(String)), agg = {};
  for (const f of Object.values(G.ffix)) {
    if (!set.has(f.d) || f.skip) continue;
    const L = fLeague(f.lg), t = L.cup ? 'puchar' : 'zagr';
    const ids = (f.res ? Object.entries(f.res.riders).filter(([, s]) => s.heats).map(([id]) => id) : f.units.flatMap(cid => fExpected(cid)).map(String));
    const ours = ids.filter(id => my.has(id)), w = ids.some(id => watch.has(id));
    if (ours.length) out.push({ d: f.d, cc: L.country, t, mine: true, watch: w, html: `<div class="ev zagr" onclick="go('#/zagranica/mecz/${f.id}')" title="${esc(L.full)}">${flag(L.country)} ${esc(fLabel(f))}${f.played ? ` <span class="res">${f.units.length === 2 && f.res ? `${f.res.pts[f.units[0]] ?? 0}:${f.res.pts[f.units[1]] ?? 0}` : ''}</span>` : ''}<div class="small muted">${esc(L.name)} · nasi: ${ours.map(id => esc((G.riders[id] || {}).name || id)).join(', ')}</div></div>` });
    else { const k = `${f.d}|${f.lg}`; (agg[k] ||= { n: 0, w: false }).n++; if (w) agg[k].w = true; }
  }
  for (const [k, a] of Object.entries(agg)) { const [d, lg] = k.split('|'), L = fLeague(lg); out.push({ d, cc: L.country, t: L.cup ? 'puchar' : 'zagr', mine: false, watch: a.w, html: `<div class="ev zagr" onclick="go('#/zagranica/${lg}${L.cup ? '' : '/terminarz'}')">${flag(L.country)} ${L.cup ? '🏆 ' : ''}${esc(L.name)}<div class="small muted">${a.n} ${plural(a.n, 'mecz', 'mecze', 'meczów')}</div></div>` }); }
  return out;
}
