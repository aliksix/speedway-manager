'use strict';
// Strona kraju (#/kraj/CC): przegląd (federacja, ligi, kluczowe osoby, najmocniejsze kluby, najlepsi zawodnicy) i kadra (powołania).

PAGES.kraj = parts => {
  const cc = (parts[0] || 'POL').toUpperCase(), sub = parts[1] || '';
  const name = COUNTRY[cc] || cc, info = NATION_INFO[cc] || {};
  const sq = squadOf(cc), coach = nationCoach(cc);
  const lead = sq.sen.map(id => G.riders[id]).filter(Boolean)[0];
  const T = tabs(`kraj/${cc}`, [['', 'Przegląd'], ['kadra', `Kadra (${sq.sen.length + sq.jun.length})`]], sub);
  const head = { title: `${flag(cc, 'lg')} ${esc(name)}`, sub: `${esc(info.fed || 'krajowa federacja motocyklowa')}${nationRiders(cc).length ? ` · ${nationRiders(cc).length} aktywnych zawodników` : ''}`, tabs: T };
  if (sub === 'kadra') return { ...head, body: nationSquadPage(cc, sq) };
  const top = nationRiders(cc).slice(0, 8), clubs = nationClubs(cc).slice(0, 8), lgs = nationLeagues(cc);
  const person = (role, x, extra = '') => `<div class="kp"><div class="small muted">${role}</div>${x ? `<div class="row" style="gap:10px">${x.html}<div><b>${x.label}</b><div class="small muted">${extra}</div></div></div>` : '<span class="muted">—</span>'}</div>`;
  const coachX = coach ? { html: staffPic(coach, silhouette(coach.name)), label: `<a href="#/osoba/${coach.id}">${esc(coach.name)}</a>` } : null;
  const leadX = lead ? { html: avatar(lead, G.clubs[lead.clubId]), label: `<a href="#/zawodnik/${lead.id}">${esc(lead.name)}</a>` } : null;
  return { ...head, body: `<div class="grid g2">
    <div class="panel"><h3>Profil</h3><div class="row" style="gap:20px;align-items:flex-start"><div class="nation-flag">${flag(cc)}</div>
      <div class="kv grow"><div>Federacja</div><div>${esc(info.fed || '—')}</div><div>Organizacja ligowa</div><div>${esc(info.body || '—')}</div>
        <div>Ligi żużlowe</div><div>${lgs.length ? lgs.map(l => esc(l.name)).join(', ') : '<span class="muted">brak własnych rozgrywek ligowych – zawodnicy i kluby jeżdżą w ligach innych krajów</span>'}</div>
        <div>Aktywni zawodnicy</div><div>${nationRiders(cc).length}</div>${FIM_SUSPENDED[cc] ? `<div>FIM</div><div class="small ${fimSuspended(cc) ? 'warn' : 'pos'}">${fimSuspended(cc) ? `${esc(info.note || 'federacja zawieszona przez FIM')}${G.fimLift && G.fimLift.from ? ` – zawieszenie zniesione od ${fmtDate(G.fimLift.from)}` : ''}` : `zawieszenie zniesione ${fmtDate(G.fimLift.from)} – zawodnicy startują pod swoją flagą`}</div>` : info.note ? `<div>Uwaga</div><div class="small warn">${esc(info.note)}</div>` : ''}</div></div></div>
    <div class="panel"><h3>Kluczowe osoby</h3>${person('Menedżer kadry', coachX, coach ? (coach.clubId ? `także ${esc(G.clubs[coach.clubId].short)}` : 'selekcjoner') : '')}
      ${person('Lider kadry', leadX, lead ? `${esc(caClass(perceive(lead).caMid))}` : '')}
      ${coach ? '' : '<p class="small muted">Brak danych o menedżerze kadry tego kraju.</p>'}</div></div>
  <div class="grid g3" style="margin-top:16px">
    <div class="panel flush"><div class="ph"><h3>Najmocniejsze kluby</h3></div><table class="t"><thead><tr><th>Klub</th><th>Liga</th></tr></thead><tbody>${clubs.map(c => `<tr ${c.club ? `class="click" onclick="go('${clubHref(c.club.id)}')"` : ''}><td>${c.club ? `<span class="clubname">${crest(c.club, 'sm')}<span>${esc(c.club.name)}</span></span>` : esc(c.name)}</td><td class="small">${esc(c.league)}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">Brak klubów</td></tr>'}</tbody></table></div>
    <div class="panel flush"><div class="ph"><h3>Najlepsi zawodnicy</h3></div><table class="t"><thead><tr><th>Zawodnik</th><th>Klub</th><th>Umiej.</th></tr></thead><tbody>${top.map(r => `<tr class="click" onclick="go('#/zawodnik/${r.id}')"><td><b>${esc(r.name)}</b></td><td>${r.clubId ? clubLink(r.clubId) : '<span class="muted">—</span>'}</td><td>${caStars(r)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Brak zawodników</td></tr>'}</tbody></table></div>
    <div class="panel flush"><div class="ph"><h3>Rozgrywki</h3></div><table class="t"><thead><tr><th>Liga</th><th>Poziom</th></tr></thead><tbody>${lgs.map(l => `<tr ${l.link ? `class="click" onclick="go('${l.link}')"` : ''}><td>${esc(l.name)}</td><td>${starsPlain(l.level, 3)}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">Brak lig</td></tr>'}</tbody></table></div></div>` };
};
function nationSquadPage(cc, sq) {
  const row = (id, i) => { const r = G.riders[id]; if (!r) return ''; return `<tr class="click" onclick="go('#/zawodnik/${r.id}')"><td class="num">${i + 1}</td><td><b>${esc(r.name)}</b>${mkBadges(r)}</td><td class="num">${riderAge(r)}</td><td>${r.clubId ? clubLink(r.clubId) : '<span class="muted">—</span>'}</td><td>${caStars(r)}</td><td>${r.injury ? '<span class="pill inj">kontuzja</span>' : ''}</td></tr>`; };
  const tbl = (title, ids, note) => `<div class="panel flush"><div class="ph"><h3>${title}</h3><span class="small muted">${note}</span></div><table class="t"><thead><tr><th class="num">#</th><th>Zawodnik</th><th class="num">Wiek</th><th>Klub</th><th>Umiejętności</th><th></th></tr></thead><tbody>${ids.map(row).join('') || '<tr><td colspan="6" class="empty">Brak powołanych</td></tr>'}</tbody></table></div>`;
  return `<div class="grid g2">${tbl('Kadra seniorów', sq.sen, `sezon ${sportSeason()} · ${sq.sen.length} powołanych`)}${tbl('Kadra juniorów (U21)', sq.jun, `${sq.jun.length} powołanych`)}</div>
    ${cc === 'POL' ? `<p class="small muted">Turnieje Zaplecza Kadry Juniorów są dla polskich juniorów spoza listy powołanych do kadry juniorów. W zawodach reprezentacji (DPŚ, SON2, mecze reprezentacji) najpierw jadą powołani.</p>` : '<p class="small muted" style="margin-top:12px">W zawodach reprezentacji (DPŚ, SON2, DME) najpierw jadą powołani.</p>'}`;
}
