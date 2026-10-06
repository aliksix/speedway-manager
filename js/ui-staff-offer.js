'use strict';
// Ekran oferty dla osoby ze sztabu (zatrudnienie wolnej osoby albo przedłużenie umowy) – jak oferta kontraktu zawodnika:
// nasza oferta obok oczekiwań, role (kilka), pensja, długość umowy, premie za sukcesy, ocena oferty, koszty, przebieg rozmów.

// Szkic: UI.sdraft = { id, t: { roles, wage, years, bonuses } }
function staffDraft(s) {
  const d = UI.sdraft;
  if (d && d.id === s.id) return d;
  const n = staffNeg(s.id), roles = n ? n.terms.roles : staffRoles(s).filter(r => STAFF_ROLES[r]), ask = staffAsk(s, roles);
  const t = n ? JSON.parse(JSON.stringify(n.terms)) : { roles: roles.slice(), wage: Math.round(ask.wage * 0.95 / 500) * 500, years: ask.years, bonuses: [] };
  return (UI.sdraft = { id: s.id, t });
}
ACT.sdRole = (r, on) => { const t = UI.sdraft.t; t.roles = on ? [...new Set([...t.roles, r])] : t.roles.filter(x => x !== r); render(); };
ACT.sdMain = r => { const t = UI.sdraft.t; t.roles = [r, ...t.roles.filter(x => x !== r)]; render(); };
ACT.sdSet = (k, v) => { UI.sdraft.t[k] = dNum(v); render(); };
ACT.sdBonusAdd = type => { if (!type) return; UI.sdraft.t.bonuses.push({ type, amount: Math.round(UI.sdraft.t.wage * 2 / 1000) * 1000 || 10000 }); render(); };
ACT.sdBonus = (i, v) => { UI.sdraft.t.bonuses[i].amount = dNum(v); render(); };
ACT.sdBonusDel = i => { UI.sdraft.t.bonuses.splice(i, 1); render(); };
ACT.sdAsk = () => { const s = G.staff[UI.sdraft.id], n = staffNeg(s.id), t = UI.sdraft.t;
  if (n && n.status === 'counter' && n.counter) Object.assign(t, n.counter); else { const a = staffAsk(s, t.roles); t.wage = a.wage; t.years = a.years; } render(); };
ACT.sdReset = () => { UI.sdraft = null; render(); };
ACT.sdSend = () => { const r = staffOffer(UI.sdraft.id, UI.sdraft.t); toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) UI.sdraft = null; changed(); };
ACT.sdWithdraw = nid => { staffWithdraw(nid); UI.sdraft = null; changed(); };

PAGES['oferta-sztab'] = parts => {
  const s = G.staff[parts[0]];
  if (!s) return { title: 'Nie znaleziono osoby', body: '' };
  const renew = s.clubId === G.clubId, c = myClub();
  const head = { title: `${esc(s.name)} – ${renew ? 'przedłużenie umowy' : 'oferta'}`, sub: `${esc(staffRoleNames(s))} · ${s.born ? `${staffAge(s)} lat · ` : ''}${s.clubId ? `${clubLink(s.clubId)} · umowa do końca sezonu ${s.until}` : 'wolny'} · <a href="#/osoba/${s.id}/kontrakt">‹ profil</a>` };
  const last = staffNegLast(s.id);
  if (!staffRenewable(s) && !staffHireable(s)) return { ...head, body: `<div class="panel"><p>${s.clubId === G.clubId ? `Umowa obowiązuje do końca sezonu ${s.until}. O przedłużeniu można rozmawiać w ostatnim roku umowy.` : s.clubId ? 'Osoba ma umowę z innym klubem.' : 'Z tą osobą nie można negocjować.'}</p></div>` };
  if (last && last.status === 'rejected' && last.final && last.season === G.season && !staffNeg(s.id)) return { ...head, body: `<div class="panel"><p class="neg">${esc(s.name)} nie chce już rozmawiać w tym sezonie${renew ? ` – odejdzie po sezonie ${s.until}` : ''}.</p>${sNegLogHtml(last)}</div>` };
  const d = staffDraft(s), t = d.t, n = staffNeg(s.id);
  const ask = staffAsk(s, t.roles.length ? t.roles : staffRoles(s)), u = t.roles.length ? staffUtility(s, t) : 0, [vc, vt] = staffVerdict(u);
  const dem = n && n.status === 'counter' ? n.counter : null;
  const row = (label, ours, theirs = '', hint = '') => `<tr><td>${label}${hint ? `<div class="small muted">${hint}</div>` : ''}</td><td>${ours}</td><td class="dem">${theirs}</td></tr>`;
  const roles = [...COACH_ROLES.filter(r => r !== 'u24Coach' || c.league === 'PGE'), ...['fitness', 'psych', 'miniCoach'].filter(r => STAFF_ROLES[r]), ...(COACH_GROUP.includes(s.role) ? [] : [s.role])];
  const roleHtml = `<div class="stack">${[...new Set(roles)].map(r => `<label class="row small"><input type="checkbox" ${t.roles.includes(r) ? 'checked' : ''} onchange="ACT.sdRole('${r}', this.checked)"> ${esc(STAFF_ROLES[r].name)}${t.roles[0] === r ? ' <span class="pill">główna</span>' : t.roles.includes(r) ? ` <a class="small" href="javascript:void 0" onclick="ACT.sdMain('${r}')">ustaw jako główną</a>` : ''}</label>`).join('')}</div>`;
  const eff = t.roles.length ? Math.round((ROLE_EFF[Math.min(t.roles.length, ROLE_EFF.length) - 1] || 0.5) * 100) : 0;
  const basics = row('Role', roleHtml, `<span class="muted">${esc(staffRoleNames(s))}</span>`, t.roles.length > 1 ? `kilka ról – skuteczność w każdej ${eff}%` : '')
    + row('Pensja miesięczna', moneyIn(t.wage, "ACT.sdSet('wage', this.value)", 500), dem ? `<b class="warn">${fmtMoney(dem.wage)}</b>` : `<span class="muted">${fmtMoney(ask.wage)}</span>`, `obecnie ${fmtMoney(s.wage || ask.base)}`)
    + row('Długość umowy', `<select onchange="ACT.sdSet('years', this.value)">${[1, 2, 3].map(y => `<option value="${y}" ${t.years === y ? 'selected' : ''}>${y} ${plural(y, 'sezon', 'sezony', 'sezonów')} (do ${staffDealUntil(s, y)})</option>`).join('')}</select>`,
      dem && dem.years !== t.years ? `<b class="warn">${dem.years} ${plural(dem.years, 'sezon', 'sezony', 'sezonów')}</b>` : `<span class="muted">${ask.years} ${plural(ask.years, 'sezon', 'sezony', 'sezonów')}</span>`, 'umowa do 31 października ostatniego sezonu');
  const bonusRows = `<div class="panel flush"><div class="ph"><h3>Premie za sukcesy</h3><select class="add-sel" onchange="ACT.sdBonusAdd(this.value)"><option value="">+ Dodaj premię</option>${Object.entries(STAFF_BONUS).filter(([k]) => !t.bonuses.some(b => b.type === k) && !(k === 'promotion' && c.league === 'PGE')).map(([k, b]) => `<option value="${k}">${esc(b.name)}</option>`).join('')}</select></div>
    <table class="t offer-t"><tbody>${t.bonuses.map((b, i) => `<tr><td>${esc(STAFF_BONUS[b.type].name)}<div class="small muted">szansa ok. ${Math.round(staffBonusChance(b.type) * 100)}%</div></td><td>${moneyIn(b.amount, `ACT.sdBonus(${i}, this.value)`, 1000)}</td><td class="x-cell"><button class="btn sm ghost" onclick="ACT.sdBonusDel(${i})" title="Usuń">✕</button></td></tr>`).join('') || '<tr><td class="muted small">Bez premii. Premie liczą się do oceny oferty według szansy na sukces.</td></tr>'}</tbody></table></div>`;
  const yearCost = t.wage * 12, ev = staffBonusEV(t);
  const side = `<div class="panel"><h3>Ocena oferty</h3><p class="${vc}" style="font-weight:600">${vt}</p>${bar(clamp(u, 0, 1.3) * 100 / 1.3, 100, vc === 'pos' ? 'var(--pos)' : vc === 'warn' ? 'var(--warn)' : 'var(--neg)')}
      <p class="small muted" style="margin-top:8px">Zgoda zależy też od renomy klubu, ambicji osoby${renew ? ' i stażu w klubie' : ''}. Główny trener niechętnie przyjmuje tylko rolę asystenta.</p></div>
    <div class="panel"><h3>Koszty</h3><div class="kv"><div>Pensje (sezon)</div><div>${fmtMoney(yearCost)}</div>${ev ? `<div>Premie (oczekiwane)</div><div>${fmtMoney(ev)}</div>` : ''}<div>Całość umowy</div><div>${fmtMoney(yearCost * t.years)}</div>${renew ? `<div>Zmiana pensji</div><div class="${t.wage > s.wage ? 'neg' : 'pos'}">${t.wage >= s.wage ? '+' : ''}${fmtMoney(t.wage - s.wage)} / mies.</div>` : ''}</div>
      ${!renew ? `<p class="small muted" style="margin-top:8px">Sztab: ${staffCounts(c)[staffKind({ ...s, role: t.roles[0] || s.role })]}/${staffLimits(c)[staffKind({ ...s, role: t.roles[0] || s.role })]} miejsc.</p>` : ''}</div>
    <div class="panel"><h3>Rozmowy</h3>${n ? `<p class="small">Status: <b>${n.status === 'pending' ? `czeka na odpowiedź (do ${fmtDate(n.decideBy)})` : 'kontroferta'}</b> · runda ${n.round}/3</p>${sNegLogHtml(n)}` : last ? `<p class="small muted">Ostatnie rozmowy: ${esc({ agreed: 'umowa podpisana', rejected: 'odmowa', withdrawn: 'wycofane', expired: 'wygasły' }[last.status] || last.status)}.</p>${sNegLogHtml(last)}` : '<p class="small muted">Rozmowy jeszcze się nie zaczęły.</p>'}</div>`;
  const pend = n && n.status === 'pending';
  const actions = `<div class="row wrap offer-actions"><button class="btn primary" ${pend ? 'disabled' : ''} onclick="ACT.sdSend()">${n ? 'Wyślij nowe warunki' : renew ? 'Zaproponuj przedłużenie' : 'Złóż ofertę'}</button>
    <button class="btn" onclick="ACT.sdAsk()">${dem ? 'Przyjmij oczekiwania' : 'Wpisz oczekiwania'}</button><button class="btn ghost" onclick="ACT.sdReset()">Przywróć</button>
    ${n ? `<button class="btn danger" onclick="ACT.sdWithdraw('${n.id}')">Wycofaj ofertę</button>` : ''}</div>`;
  return { ...head, body: `<div class="offer-page"><div class="stack"><div class="panel flush"><div class="ph"><h3>Warunki umowy</h3></div>
      <table class="t offer-t"><thead><tr><th></th><th>Nasza oferta</th><th>Oczekiwania</th></tr></thead><tbody>${basics}</tbody></table></div>${bonusRows}${actions}</div>
    <div class="stack">${side}</div></div>` };
};
function staffVerdict(u) {
  if (!u) return ['neg', 'Wybierz co najmniej jedną rolę.'];
  if (u < 0.6) return ['neg', 'Oferta niepoważna – odmowa bez rozmów.'];
  if (u < 0.9) return ['neg', 'Wyraźnie poniżej oczekiwań – spodziewaj się kontroferty.'];
  if (u < 0.98) return ['warn', 'Blisko oczekiwań – może poprosić o trochę więcej.'];
  if (u < 1.12) return ['pos', 'Oferta spełnia oczekiwania.'];
  return ['pos', 'Wyraźnie powyżej oczekiwań – możesz przepłacać.'];
}
const sNegLogHtml = n => `<div class="neg-log">${n.log.slice().reverse().map(l => `<div><b>${fmtDateShort(l.d)}</b>${esc(l.t)}</div>`).join('')}</div>`;
