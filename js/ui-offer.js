'use strict';
// Ekran oferty kontraktu i wypożyczenia (zamiast okna modalnego) – układ jak w Football Managerze:
// warunki podstawowe obok żądań zawodnika, premie i klauzule dodawane z listy, opinia o ofercie, konkurencja, koszty, przebieg rozmów.

// Szkic oferty: UI.draft = { id, kind: 'contract' | 'loan', negId, t }
function offerDraft(r, kind) {
  const d = UI.draft;
  if (d && d.id === r.id && d.kind === kind) return d;
  const n = kind === 'loan' ? Object.values(G.negs).find(x => x.riderId === r.id && x.clubId === G.clubId && x.kind === 'loan' && NEG_OPEN.includes(x.status)) : userNeg(r.id);
  const ask = riderAsk(r, G.clubId);
  let t;
  if (kind === 'loan') t = { fee: 0, signing: round5k(ask.signing * 0.5 * remainingSeasonShare()), perPoint: round100(ask.perPoint * 0.8) };
  else {
    const st = marketStatus(r);
    t = { kind: 'zawodowy', signing: round5k(ask.signing * 0.85), perPoint: ask.perPoint, years: ask.years, stipend: STIPEND_MAX, bonuses: [],
      fee: st.mode === 'transfer' ? st.buyout || st.fee : st.fee || 0 };
    if (st.ok && st.forSeason - Number(r.born.slice(0, 4)) <= 24) t.youthPP = defaultYouthPP(ask.perPoint);
  }
  if (typeof expectedRole === 'function') t.role = expectedRole(r, G.clubId);
  if (n && (n.kind === 'loan') === (kind === 'loan')) Object.assign(t, JSON.parse(JSON.stringify(n.terms))); // oferta dwuetapowa: po zgodzie klubu w warunkach jest tylko kwota
  t.bonuses = t.bonuses || [];
  return (UI.draft = { id: r.id, kind, negId: n && (n.kind === 'loan') === (kind === 'loan') && NEG_OPEN.includes(n.status) ? n.id : null, t });
}
const dNum = v => { const x = Number(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
ACT.dSet = (k, v, num = true) => { UI.draft.t[k] = num ? dNum(v) : v; render(); };
ACT.dBonusAdd = type => { if (!type) return; const b = { type, amount: round5k((UI.draft.t.signing || 100000) * 0.05) || 5000 }; if (BONUS_TYPES[type].thr) b.thr = BONUS_TYPES[type].thr.def; UI.draft.t.bonuses.push(b); render(); };
ACT.dBonus = (i, k, v) => { UI.draft.t.bonuses[i][k] = dNum(v); render(); };
ACT.dBonusDel = i => { UI.draft.t.bonuses.splice(i, 1); render(); };
ACT.dClauseAdd = k => { if (!k) return; UI.draft.t[k] = CLAUSES[k].def || (k === 'pp10' ? round100(UI.draft.t.perPoint * 1.2) : k === 'youthPP' ? defaultYouthPP(UI.draft.t.perPoint) : k === 'buyout' ? round5k(riderValue(G.riders[UI.draft.id]) * 1.5) : 0); render(); };
ACT.dClauseDel = k => { delete UI.draft.t[k]; render(); };
ACT.dReset = () => { UI.draft = null; render(); };
ACT.dUseDemands = () => {
  const d = UI.draft, r = G.riders[d.id], n = d.negId && G.negs[d.negId];
  if (n && n.status === 'counter' && n.counter) Object.assign(d.t, JSON.parse(JSON.stringify(n.counter)));
  else { const a = riderAsk(r, G.clubId); Object.assign(d.t, { signing: a.signing, perPoint: a.perPoint, years: a.years }); }
  render();
};
ACT.dSend = () => {
  const d = UI.draft;
  const t = d.clubStep ? { fee: d.t.fee || 0 } : d.t; // krok 1: tylko kwota dla klubu
  const res = d.negId ? amendOffer(d.negId, t) : makeOffer(G.clubId, d.id, t, d.kind);
  toast(res.text, res.ok ? 'good' : 'bad');
  if (res.ok) { UI.draft = null; dbQueueSave(); }
  render();
};
ACT.offerModal = id => go(`#/oferta/${id}`); // zgodność ze starszymi odnośnikami
ACT.loanModal = id => go(`#/oferta/${id}/wypozyczenie`);

const moneyIn = (val, on, step = 5000, extra = '') => `<input class="num-in" type="number" step="${step}" value="${val ?? 0}" onchange="${on}" ${extra}>`;
function offerVerdict(u) {
  if (u < 0.6) return ['neg', 'Zawodnik uzna ofertę za niepoważną.'];
  if (u < 0.9) return ['neg', 'Oferta wyraźnie poniżej oczekiwań – spodziewaj się kontrpropozycji.'];
  if (u < 1) return ['warn', 'Blisko oczekiwań – zawodnik może poprosić o trochę więcej.'];
  if (u < 1.12) return ['pos', 'Oferta spełnia oczekiwania zawodnika.'];
  return ['pos', 'Oferta wyraźnie powyżej oczekiwań – możesz przepłacać.'];
}
PAGES.oferta = parts => {
  const r = G.riders[parts[0]];
  if (!r) return { title: 'Nie znaleziono zawodnika', body: '' };
  const kind = parts[1] === 'wypozyczenie' ? 'loan' : 'contract';
  const st = kind === 'loan' ? loanStatus(r) : marketStatus(r);
  const c = G.clubs[r.clubId];
  if (c) document.documentElement.style.setProperty('--club', c.colors[0]);
  const canLoan = r.contract && r.contract.clubId !== G.clubId;
  const T = tabs(`oferta/${r.id}`, [['', st.mode === 'renewal' ? 'Przedłużenie kontraktu' : 'Kontrakt'], ...(canLoan ? [['wypozyczenie', 'Wypożyczenie']] : [])], parts[1] || '');
  const head = `<div class="page-head"><div class="offer-head"><div class="avatar-wrap sm">${avatar(r, c)}</div><div class="grow"><h1>${esc(r.name)}${mkBadges(r)}</h1>
      <div class="small muted">${esc(riderRole(r))} · ${riderAge(r)} lat · ${c ? clubLink(c.id) : 'wolny zawodnik'}${r.contract ? ` · kontrakt do ${r.contract.until}` : ''}</div></div>
      <div class="row"><a class="btn" href="#/zawodnik/${r.id}/kontrakt">‹ Profil zawodnika</a></div></div>${T}</div>`;
  if (!st.ok) return { head, raw: true, body: `<div class="content"><div class="panel"><div class="reply blocked">${esc(st.text)}</div></div></div>` };
  const d = offerDraft(r, kind), t = d.t, lg = myClub().league;
  const n = d.negId && G.negs[d.negId];
  // wykup / wypożyczenie: najpierw kwota z klubem (bez warunków dla zawodnika), po zgodzie klubu – kontrakt z zawodnikiem
  const holderId = kind === 'loan' ? r.contract && r.contract.clubId : st.mode === 'transfer' ? st.holder : null;
  const clubStep = !!holderId && holderId !== G.clubId && !(n && n.stage === 'rider');
  d.clubStep = clubStep;
  if (clubStep) return offerClubStep(r, st, kind, d, n, head, holderId);
  const season = kind === 'loan' ? st.season : st.forSeason;
  const u = negUtility(r, G.clubId, t, kind);
  const [vc, vt] = offerVerdict(u);
  const others = openNegs(r.id).filter(x => x.clubId !== G.clubId && x.status !== 'club');
  const ask = riderAsk(r, G.clubId);
  const dem = n && n.status === 'counter' && n.counter ? { ...t, ...n.counter } : null;
  const ci = capInfo(myClub(), season, r.id);
  const pts = expectedSeasonPoints(r.skill, lg);
  const ev = bonusesEV(t, r, G.clubId);
  const base = kind === 'loan' ? (t.signing || 0) + (t.perPoint || 0) * pts * remainingSeasonShare() : t.kind === 'amatorski' ? (t.stipend || 0) * 12 + EQUIP_VALUE[lg] : (t.signing || 0) + (t.perPoint || 0) * pts;
  const capV = kind === 'loan' ? capDealValue(r, { kind: 'wypożyczenie', signing: t.signing, perPoint: t.perPoint }, season, lg) : capDealValue(r, t, season, lg);
  // ---- warunki podstawowe (nasza oferta | żądanie zawodnika)
  const row = (label, ours, theirs = '', hint = '') => `<tr><td>${label}${hint ? `<div class="small muted">${hint}</div>` : ''}</td><td>${ours}</td><td class="dem">${theirs}</td></tr>`;
  const want = (k, f = v => fmtMoney(v)) => dem && dem[k] != null && dem[k] !== t[k] ? `<b class="warn">${f(dem[k])}</b>` : '';
  const exp = typeof expectedRole === 'function' ? expectedRole(r, G.clubId, season) : null;
  const roleRow = exp && t.kind !== 'warszawski' ? row('Rola w drużynie', `<select onchange="ACT.dSet('role', this.value, false)">${Object.entries(TEAM_ROLES).map(([k, x]) => `<option value="${k}" ${t.role === k ? 'selected' : ''}>${x.name}</option>`).join('')}</select>`,
    t.role && roleLvl(t.role) < roleLvl(exp) ? `<b class="warn">${roleName(exp)}</b>` : `<span class="muted">${roleName(exp)}</span>`, esc((TEAM_ROLES[t.role] || {}).desc || '')) : '';
  const fixedFee = holderId && n && n.stage === 'rider';
  let basics;
  if (kind === 'loan') {
    basics = (fixedFee ? row(`Opłata dla ${esc(G.clubs[r.contract.clubId].short)}`, `<b>${fmtMoney(t.fee || 0)}</b>`, '', 'uzgodnione z klubem') : row(`Opłata dla ${esc(G.clubs[r.contract.clubId].short)}`, moneyIn(t.fee, "ACT.dSet('fee', this.value)"), want('fee'), 'jednorazowo, przy zgłoszeniu'))
      + roleRow
      + row('Za podpis (do końca sezonu)', moneyIn(t.signing, "ACT.dSet('signing', this.value)"), want('signing') || `<span class="muted">${fmtMoney(round5k(ask.signing * 0.55 * remainingSeasonShare()), true)}</span>`, 'płaci nasz klub')
      + row('Za punkt', moneyIn(t.perPoint, "ACT.dSet('perPoint', this.value)", 100), want('perPoint') || `<span class="muted">${fmtMoney(ask.perPoint)}</span>`)
      + row('Okres', `do 31.10.${season}`, '', 'wypożyczenie zawsze kończy się 31 października');
  } else {
    const am = t.kind === 'amatorski', wa = t.kind === 'warszawski';
    basics = roleRow + row('Rodzaj kontraktu', `<select onchange="ACT.dSet('kind', this.value, false)"><option value="zawodowy" ${!am && !wa ? 'selected' : ''}>zawodowy</option>${canAmateur(r, season) ? `<option value="amatorski" ${am ? 'selected' : ''}>amatorski (junior)</option>` : ''}${st.mode === 'free' ? `<option value="warszawski" ${wa ? 'selected' : ''}>warszawski (bez wynagrodzenia)</option>` : ''}</select>`, '')
      + (wa ? row('Warunki', 'bez wynagrodzenia, do końca sezonu', '', `zawodnik może być wypożyczony w każdej chwili; gdy pojedzie w naszych barwach – ${fmtMoney(WARSAW_PP[lg])}/pkt. Zgoda tylko po zamknięciu okienek i bez innych ofert.`) : row('Długość', `<select onchange="ACT.dSet('years', this.value)">${[1, 2, 3, 4, 5, 6].map(y => `<option value="${y}" ${t.years === y ? 'selected' : ''}>${y} – do ${season + y - 1}</option>`).join('')}</select>`, want('years', v => `${v} ${plural(v, 'sezon', 'sezony', 'sezonów')}`) || `<span class="muted">${ask.years} ${plural(ask.years, 'sezon', 'sezony', 'sezonów')}</span>`)
      + (am ? row(`Stypendium miesięczne`, moneyIn(t.stipend, "ACT.dSet('stipend', this.value)", 100, `max="${STIPEND_MAX}"`), '', `maks. ${STIPEND_MAX} zł; sprzęt i starty na koszt klubu`)
        : row('Za podpis (rocznie)', moneyIn(t.signing, "ACT.dSet('signing', this.value)"), want('signing') || `<span class="muted">${fmtMoney(ask.signing, true)}</span>`, `kwota na przygotowanie do sezonu – płacona w każdym sezonie umowy (od ${season}), w 6 ratach luty–lipiec${t.raise ? `; zmiana ${t.raise > 0 ? '+' : ''}${t.raise}% rocznie` : ''}`)
        + row('Za punkt', moneyIn(t.perPoint, "ACT.dSet('perPoint', this.value)", 100), want('perPoint') || `<span class="muted">${fmtMoney(ask.perPoint)}</span>`, `ok. ${pts} pkt w sezonie`)))
      + (st.mode === 'transfer' && fixedFee ? row(`Odstępne dla ${esc(G.clubs[st.holder].short)}`, `<b>${fmtMoney(t.fee || 0)}</b>`, '', 'uzgodnione z klubem')
        : st.mode === 'transfer' ? row(`${st.comp && !st.buyout ? 'Ekwiwalent' : 'Odstępne'} dla ${esc(G.clubs[st.holder].short)}`, moneyIn(t.fee, "ACT.dSet('fee', this.value)", 10000), n && n.stage === 'club' && dem ? want('fee') : `<span class="muted">${fmtMoney(st.fee, true)}</span>`, st.buyout ? 'klauzula odstępnego – po zapłacie klub musi zgodzić się na rozmowy' : st.comp ? `ekwiwalent: maks. ${fmtMoney(st.comp.max, true)} wg regulaminu (${esc(compText(st.comp))}); klub może przyjąć mniej` : 'zgoda klubu wymagana')
        : st.school ? row('Cena karty dla szkółki', fmtMoney(st.fee), '', `dla ${esc(G.miniSchools[st.school].name)} – szkółka niezależna sprzedaje kartę zawodnika`)
        : st.comp ? row('Ekwiwalent za wyszkolenie', fmtMoney(st.fee), '', `dla ${esc(G.clubs[st.comp.clubId].name)} – kwota przyjęta przez klub szkolący (maks. wg regulaminu ${fmtMoney(st.comp.max, true)})`) : '');
  }
  // ---- premie
  const bonusRows = kind === 'loan' || t.kind === 'amatorski' ? '' : `<div class="panel flush"><div class="ph"><h3>Premie</h3><select class="add-sel" onchange="ACT.dBonusAdd(this.value)"><option value="">+ Dodaj premię…</option>${Object.entries(BONUS_TYPES).filter(([k]) => !(k === 'promotion' && lg === 'PGE')).map(([k, b]) => `<option value="${k}">${esc(b.name)}</option>`).join('')}</select></div>
    <table class="t offer-t"><tbody>${t.bonuses.map((b, i) => { const ty = BONUS_TYPES[b.type], p = bonusChance(b, r, G.clubId);
      return `<tr><td>${esc(ty.name)}${ty.thr ? ` <input class="num-in thr" type="number" step="${ty.thr.step}" min="${ty.thr.min}" max="${ty.thr.max}" value="${b.thr}" onchange="ACT.dBonus(${i}, 'thr', this.value)">` : ''}<div class="small muted">szansa ok. ${Math.round(p * 100)}%</div></td>
        <td>${moneyIn(b.amount, `ACT.dBonus(${i}, 'amount', this.value)`, 5000)}</td><td class="x-cell"><button class="btn sm ghost" onclick="ACT.dBonusDel(${i})" title="Usuń">✕</button></td></tr>`; }).join('') || '<tr><td class="empty" colspan="3">Brak premii. Premie za wynik drużyny lub zawodnika wypłacane są po sezonie.</td></tr>'}</tbody></table></div>`;
  // ---- klauzule
  const clauseRows = kind === 'loan' || t.kind === 'amatorski' ? '' : `<div class="panel flush"><div class="ph"><h3>Klauzule</h3><select class="add-sel" onchange="ACT.dClauseAdd(this.value)"><option value="">+ Dodaj klauzulę…</option>${Object.entries(CLAUSES).filter(([k]) => t[k] == null).map(([k, c]) => `<option value="${k}">${esc(c.name)}</option>`).join('')}</select></div>
    <table class="t offer-t"><tbody>${Object.entries(CLAUSES).filter(([k]) => t[k] != null).map(([k, c]) => `<tr><td>${esc(c.name)}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap">${moneyIn(t[k], `ACT.dSet('${k}', this.value)`, c.step)}<span class="small muted">${c.unit}</span></div></td><td class="x-cell"><button class="btn sm ghost" onclick="ACT.dClauseDel('${k}')" title="Usuń">✕</button></td></tr>`).join('') || '<tr><td class="empty" colspan="3">Brak klauzul.</td></tr>'}</tbody></table></div>`;
  // ---- prawa kolumna: opinia, konkurencja, koszty, przebieg rozmów
  const log = n ? `<div class="neg-log">${n.log.slice().reverse().map(l => `<div><b>${fmtDateShort(l.d)}</b>${esc(l.t)}</div>`).join('')}</div>` : '';
  const impact = typeof budgetImpactPanel === 'function' ? budgetImpactPanel(r, kind, t, season, n, false) : '';
  const side = `<div class="panel"><h3>Ocena oferty</h3><p class="${vc}" style="font-weight:600">${vt}</p>${bar(clamp(u, 0, 1.3) * 100 / 1.3, 100, vc === 'pos' ? 'var(--pos)' : vc === 'warn' ? 'var(--warn)' : 'var(--neg)')}
      <p class="small muted" style="margin-top:8px">${others.length ? `Na stole ${others.length === 1 ? 'jest oferta' : 'są oferty'}: ${esc(clubsShort(others.map(x => x.clubId)))} – zawodnik dłużej się zastanawia i oczekuje więcej.` : 'Brak znanych ofert innych klubów.'} Miejsce w naszym składzie: ${squadOutlook(r, G.clubId)}.</p></div>
    ${impact}
    <div class="panel"><h3>Koszty</h3><div class="kv"><div>Sezon ${season}</div><div>${fmtMoney(base)}</div>${ev ? `<div>Premie (oczekiwane)</div><div>${fmtMoney(ev)}</div>` : ''}${t.fee && kind !== 'loan' || kind === 'loan' && t.fee ? `<div>Jednorazowo</div><div>${fmtMoney(t.fee)}</div>` : ''}<div>Saldo klubu</div><div class="${myClub().cash < 0 ? 'neg' : ''}">${fmtMoney(myClub().cash, true)}</div></div>
      ${ci.applies ? `<h3 style="margin-top:12px">Limit płac PGE ${season}</h3><div class="kv"><div>Wykorzystane</div><div>${fmtMoney(ci.used, true)} / ${fmtMoney(ci.limit, true)}</div><div>Ta umowa</div><div class="${ci.used + capV > ci.limit ? 'neg' : ''}">${fmtMoney(capV, true)}</div></div>` : ''}</div>
    <div class="panel"><h3>Rozmowy</h3>${statusLine(r, kind === 'loan' ? { ...st, mode: 'loan' } : st)}${n ? `<p class="small" style="margin-top:8px">Status: <b>${esc(negStatusText(n))}</b></p>` : ''}${log}</div>`;
  const actions = `<div class="row wrap offer-actions"><button class="btn primary" onclick="ACT.dSend()">${d.negId ? 'Wyślij nowe warunki' : st.mode === 'transfer' && kind !== 'loan' ? `Złóż ofertę klubowi ${esc(G.clubs[st.holder].short)}` : kind === 'loan' ? 'Zaproponuj wypożyczenie' : 'Złóż ofertę'}</button>
    <button class="btn" onclick="ACT.dUseDemands()">${dem ? 'Przyjmij żądania zawodnika' : 'Wpisz oczekiwania zawodnika'}</button><button class="btn ghost" onclick="ACT.dReset()">Przywróć</button>
    ${n ? `<button class="btn danger" onclick="ACT.arm(this, 'withdraw', '${n.id}')">Wycofaj ofertę</button>` : ''}</div>`;
  return { head, raw: true, body: `<div class="content"><div class="offer-page"><div class="stack"><div class="panel flush"><div class="ph"><h3>${kind === 'loan' ? 'Warunki wypożyczenia' : 'Warunki kontraktu'}</h3><span class="small muted">sezon ${season}</span></div>
      <table class="t offer-t"><thead><tr><th></th><th>Nasza oferta</th><th>Żądanie zawodnika</th></tr></thead><tbody>${basics}</tbody></table></div>${actions}
      ${kind === 'loan' ? '<p class="small muted">Klub wypożyczający płaci zawodnikowi według nowego kontraktu – dzielenie wynagrodzenia z klubem macierzystym jest zakazane (art. 226 RPK).</p>' : t.kind === 'amatorski' ? '<p class="small muted">Kontrakt amatorski (Zbiór Zasad §17): w lidze bez wynagrodzenia za punkty; w zawodach młodzieżowych przy stypendium 0 zł – 100/150/250 zł za punkt.</p>' : ''}</div>
    <div class="stack">${bonusRows}${clauseRows}</div><div class="stack">${side}</div></div></div>` };
};
// Krok 1 wykupu / wypożyczenia: negocjacje z klubem – tylko kwota; warunki dla zawodnika po zgodzie klubu
function offerClubStep(r, st, kind, d, n, head, holderId) {
  const t = d.t, h = G.clubs[holderId], role = typeof roleOf === 'function' ? roleOf(r) : null;
  const dem = n && n.status === 'counter' && n.counter ? n.counter : null;
  const pol = typeof holderPolicy === 'function' ? holderPolicy(r, holderId, kind === 'loan' ? 'loan' : 'transfer', kind === 'loan' ? st.season : st.forSeason) : null;
  const label = kind === 'loan' ? `Opłata za wypożyczenie dla ${esc(h.short)}` : st.comp && !st.buyout ? `Ekwiwalent dla ${esc(h.short)}` : `Odstępne dla ${esc(h.short)}`;
  const hint = kind === 'loan' ? 'jednorazowo, przy zgłoszeniu' : st.buyout ? `klauzula odstępnego ${fmtMoney(st.buyout, true)} – po zapłacie klub musi zgodzić się na rozmowy` : st.comp ? `maks. ${fmtMoney(st.comp.max, true)} wg regulaminu (${esc(compText(st.comp))})` : `szacowana wycena klubu: ${fmtMoney(st.fee || 0, true)}`;
  const log = n ? `<div class="neg-log">${n.log.slice().reverse().map(l => `<div><b>${fmtDateShort(l.d)}</b>${esc(l.t)}</div>`).join('')}</div>` : '';
  const policy = pol && pol.refuse ? `<div class="reply blocked">${esc(h.short)}: ${esc(r.name)} to ${esc(pol.text)}</div>` : pol && pol.repl ? `<p class="small muted">Klub ma kim go zastąpić (${pol.repl.kind === 'deal' ? 'uzgodniony kontrakt' : 'zawodnik dostępny na rynku'}) – może się zgodzić, ale za wysoką kwotę.</p>` : '';
  return { head, raw: true, body: `<div class="content"><div class="offer-page"><div class="stack"><div class="panel flush"><div class="ph"><h3>Krok 1: ${kind === 'loan' ? 'wypożyczenie' : 'transfer'} – rozmowy z klubem ${esc(h.short)}</h3></div>
      <table class="t offer-t"><thead><tr><th></th><th>Nasza oferta</th><th>Żądanie klubu</th></tr></thead><tbody>
      <tr><td>${label}<div class="small muted">${hint}</div></td><td>${moneyIn(t.fee, "ACT.dSet('fee', this.value)", 10000)}</td><td class="dem">${dem && dem.fee != null ? `<b class="warn">${fmtMoney(dem.fee)}</b>` : ''}</td></tr></tbody></table></div>
      <div class="row wrap offer-actions"><button class="btn primary" onclick="ACT.dSend()">${n ? 'Wyślij nową kwotę' : `Złóż ofertę klubowi ${esc(h.short)}`}</button>${dem ? `<button class="btn" onclick="ACT.arm(this, 'acceptCounter', '${n.id}')">Przyjmij żądanie klubu</button>` : ''}${n ? `<button class="btn danger" onclick="ACT.arm(this, 'withdraw', '${n.id}')">Wycofaj ofertę</button>` : ''}</div>
      <p class="small muted">Warunki kontraktu (rola w drużynie, pieniądze) ustalisz z zawodnikiem dopiero po zgodzie klubu – będziesz mieć na to 14 dni. Bez porozumienia z zawodnikiem transfer nie dojdzie do skutku.</p></div>
    <div class="stack">${typeof budgetImpactPanel === 'function' ? budgetImpactPanel(r, kind, t, kind === 'loan' ? st.season : st.forSeason, n, true) : ''}<div class="panel"><h3>Zawodnik w klubie ${esc(h.short)}</h3><div class="kv"><div>Rola</div><div>${role ? roleName(role) : '—'}</div><div>Kontrakt do</div><div>${r.contract ? r.contract.until : '—'}</div></div>${policy}
      <p class="small muted">Kluby rzadko oddają liderów i ważnych zawodników – zgadzają się tylko wtedy, gdy mają ich kim zastąpić. Dobrych zawodników, zwłaszcza Polaków, jest mało; wykup bywa nieopłacalny – najczęściej pozyskuje się zawodników po zakończeniu kontraktu.</p></div>
      <div class="panel"><h3>Rozmowy</h3>${n ? `<p class="small">Status: <b>${esc(negStatusText(n))}</b></p>` : '<p class="small muted">Brak rozmów.</p>'}${log}</div></div></div></div>` };
}
