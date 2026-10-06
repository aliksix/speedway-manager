'use strict';
// Ekrany budżetu: Finanse → Budżet (plan sezonu z suwakami: płace ↔ transfery, szkółka, tor i park maszyn; limit Ekstraligi; prośba do zarządu),
// Finanse → Podsumowanie (lata finansowe i ranking ligi) oraz panel „Wpływ na budżet” na ekranie oferty.

FIN_TABS.splice(FIN_TABS.findIndex(t => t[0] === 'budzet') + 1, 0, ['podsumowanie', 'Podsumowanie']);
const FIN_BUDZET_EXEC = FIN_PAGES.budzet; // wykonanie budżetu (przychody i wydatki sezonu) – dotychczasowa zakładka
const kM = v => fmtMoney(Math.round(v || 0), true);
function budBar(used, total, warnAt = 0.9) {
  const r = total > 0 ? used / total : used > 0 ? 2 : 0;
  return bar(Math.min(used, total * 1.0001), Math.max(total, 1), r > 1 ? 'var(--neg)' : r > warnAt ? 'var(--warn)' : 'var(--pos)');
}
FIN_PAGES.budzet = (c, S, fl) => {
  const cur = fyOf(G.date);
  const BS = UI.budS && UI.budS >= cur ? UI.budS : Math.max(S, cur);
  const p = budgetPlan(c, BS), rc = ridersCommitted(c, BS), tc = transfersCommitted(c, BS);
  const lg = c.league, step = Math.max(10000, round1k(c.budget * 0.005));
  const fixedRows = Object.entries(p.fixed).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="small muted">· ${esc(kindLabel(k))}</div><div class="small muted">${kM(v)}</div>`).join('');
  const capPct = p.cap.applies ? Math.round(p.wMax * 100) : null;
  const seasons = [cur, cur + 1].filter((x, i, a) => a.indexOf(x) === i);
  const riderRows = rc.list.sort(by(x => x.v, -1)).map(({ r, v, loan }) => { const k = loan ? r.loan : r.nextContract && r.nextContract.clubId === c.id ? r.nextContract : r.contract; const role = k && k.role;
    return `<tr><td>${riderLink(r.id)}${loan ? ' <span class="pill">wyp.</span>' : ''}</td><td class="small">${role ? roleName(role) : '—'}</td><td class="num">${k && k.kind === 'amatorski' ? 'amatorski' : kM(((k && k.terms && k.terms[BS]) || k || {}).signing)}</td><td class="num">${k && k.kind !== 'amatorski' ? predPoints(r, c.id, BS, role) : '—'}</td><td class="num"><b>${kM(v)}</b></td></tr>`; }).join('');
  const panel = `<div class="panel" style="margin-bottom:16px"><div class="row" style="margin-bottom:8px"><h3 class="grow">Plan budżetu – sezon ${BS} <span class="small muted">(1.11.${BS - 1}–31.10.${BS})</span></h3>
      <div class="seg">${seasons.map(x => `<button class="btn sm ${x === BS ? 'primary' : ''}" onclick="UI.budS=${x};render()">${x}</button>`).join('')}</div></div>
    ${p.prelim ? `<p class="small muted">Plan wstępny – zarząd zatwierdza budżet 1 grudnia ${BS - 1} r. (po decyzji miasta); do tego czasu wpłata właściciela jest szacunkiem.</p>` : ''}
    <div class="grid g2"><div><div class="kv">
        <div>Planowane przychody</div><div class="pos">${kM(p.rev)}</div>
        <div>Wpłata właściciela ${p.ownerFixed ? '(zadeklarowana)' : '(szacunek)'}</div><div class="pos">${kM(p.owner)}</div>
        <div>Koszty stałe</div><div class="neg">−${kM(p.fixedSum)}</div>${fixedRows}
        <div>Szkółka</div><div class="neg">−${kM(p.academy)}</div>
        <div>Tor i park maszyn (inwestycje)</div><div class="neg">−${kM(p.infra)}</div>
        <div>Rezerwa na 31 października (5%)</div><div class="neg">−${kM(p.reserve)}</div>
        <div><b>Do rozdzielenia</b></div><div><b>${kM(p.free)}</b></div></div>
      <label class="fld" style="margin-top:12px">Szkółka: <b>${kM(p.academy)}</b><input type="range" min="0" max="${round1k(Math.max(c.budget * 0.08, p.academy))}" step="${step}" value="${p.academy}" onchange="ACT.budSet(${BS}, 'academy', +this.value)"></label>
      <label class="fld">Tor i park maszyn: <b>${kM(p.infra)}</b><input type="range" min="0" max="${round1k(Math.max(c.budget * 0.1, p.infra))}" step="${step}" value="${p.infra}" onchange="ACT.budSet(${BS}, 'infra', +this.value)"><span class="small muted">każde ${kM(INFRA_STEP[lg])} podnosi po sezonie poziom parku maszyn lub toru (obecnie ${c.facilities.workshop || 1}/5 i ${c.facilities.training || 1}/5)</span></label></div>
      <div><label class="fld">Płace ${Math.round(p.w * 100)}% ↔ transfery ${100 - Math.round(p.w * 100)}%<input type="range" min="0.5" max="${p.wMax.toFixed(2)}" step="0.01" value="${Math.min(p.w, p.wMax)}" onchange="ACT.budSet(${BS}, 'w', +this.value)">
          ${p.cap.applies ? `<span class="small warn">limit Ekstraligi: kontrakty zawodników najwyżej ${kM(p.cap.limit)} (${CAP_SHARE * 100}% przychodów) – suwak zatrzymuje się na ${capPct}%</span>` : '<span class="small muted">bez limitu regulaminowego w tej lidze – ogranicza tylko budżet</span>'}</label>
        <h3 style="margin:12px 0 4px">Zawodnicy: ${kM(rc.total)} z ${kM(p.riders)}</h3>${budBar(rc.total, p.riders)}
        <div class="small muted">umowy ${kM(rc.used)}${rc.pending ? ` + oferty w toku ${kM(rc.pending)}` : ''} · zostało <b class="${p.riders - rc.total < 0 ? 'neg' : 'pos'}">${kM(p.riders - rc.total)}</b>${p.cap.applies ? ` · limit regulaminowy (punkty z ubiegłego sezonu): ${kM(p.cap.used)} z ${kM(p.cap.limit)}` : ''}</div>
        <h3 style="margin:12px 0 4px">Sztab: ${kM(p.staff)}</h3><div class="small muted">pensje × 12 miesięcy – część budżetu płac (${kM(p.wages)})</div>
        <h3 style="margin:12px 0 4px">Transfery: ${kM(tc.total)} z ${kM(p.transfers)}</h3>${budBar(tc.total, p.transfers)}
        <div class="small muted">wydane ${kM(tc.spent)}${tc.pending ? ` + uzgodnione i w toku ${kM(tc.pending)}` : ''} · zostało <b class="${p.transfers - tc.total < 0 ? 'neg' : 'pos'}">${kM(p.transfers - tc.total)}</b> (odstępne, ekwiwalenty, opłaty za wypożyczenia)</div>
        <div class="row" style="margin-top:14px;gap:6px"><input type="number" id="bud-ask" step="50000" min="50000" value="${round1k(Math.max(100000, c.budget * 0.05))}" style="width:130px"><button class="btn" onclick="ACT.budAsk(${BS})">Poproś zarząd o zwiększenie budżetu</button></div>
        <p class="small muted">Zarząd zgadza się zależnie od zaufania i możliwości właściciela (najwyżej dwie prośby na sezon); każda zgoda obniża zaufanie.</p></div></div></div>
    <div class="panel flush" style="margin-bottom:16px"><div class="ph"><h3>Koszty zawodników w budżecie sezonu ${BS}</h3><span class="small muted">podpis + stawka × przewidywane punkty (rola, średnia z ubiegłego sezonu przeliczona na ligę, poziom; play-off i 5% marginesu) + oczekiwane premie</span></div>
      <table class="t"><thead><tr><th>Zawodnik</th><th>Rola</th><th class="num">Za podpis</th><th class="num">Przew. pkt</th><th class="num">Koszt</th></tr></thead><tbody>${riderRows || '<tr><td colspan="5" class="empty">Brak umów na ten sezon</td></tr>'}</tbody></table></div>`;
  return panel + (BS === S ? FIN_BUDZET_EXEC(c, S, fl) : '');
};
ACT.budSet = (S, k, v) => {
  const c = myClub(), al = finAlloc(c, S);
  al[k] = k === 'w' ? clamp(v, 0.5, 1) : Math.max(0, round1k(v));
  if (k === 'academy' && S === fyOf(G.date)) c.academyBudget = al.academy;
  budReset(); changed();
};
ACT.budAsk = S => { const el = $('#bud-ask'); const r = budgetRequest(el ? +el.value : 0, S); if (r.ok) delete myClub().fin.plan; toast(r.text, r.ok ? 'good' : 'bad'); changed(); };

// ---------- Podsumowanie lat ----------
FIN_PAGES.podsumowanie = (c, S) => {
  const L = c.fin.ledger || {}, cur = fyOf(G.date);
  const years = [...new Set([...Object.keys(L).map(Number), cur])].sort((a, b) => a - b);
  const G2 = Object.fromEntries(years.map(y => [y, ledgerGroups(L[y] || { in: {}, out: {} })]));
  const names = side => [...new Set(years.flatMap(y => G2[y][side].map(x => x[0])))];
  const val = (y, side, name) => (G2[y][side].find(x => x[0] === name) || [0, 0])[1];
  const tot = (y, side) => sum(G2[y][side].map(x => x[1]));
  const head = `<tr><th></th>${years.map(y => `<th class="num">Sezon ${y}${y === cur ? '*' : ''}<div class="small muted">${y - 1}/${String(y).slice(2)}</div></th>`).join('')}</tr>`;
  const rows = (side, cls) => names(side).filter(n => years.some(y => val(y, side, n))).map(n => `<tr><td>${esc(n)}</td>${years.map(y => `<td class="num ${cls}">${val(y, side, n) ? kM(Math.abs(val(y, side, n))) : '<span class="muted">·</span>'}</td>`).join('')}</tr>`).join('');
  const ye = c.fin.yearEnd || {};
  const planRow = (label, f) => `<tr><td>${label}</td>${years.map(y => `<td class="num small muted">${f(y)}</td>`).join('')}</tr>`;
  const tbl = `<div class="panel flush" style="margin-bottom:16px"><div class="ph"><h3>Podsumowanie lat finansowych</h3><span class="small muted">rok finansowy sezonu: 1 listopada – 31 października · * bieżący (wykonanie do dziś)</span></div>
    <div class="scroll-x"><table class="t fin-table"><thead>${head}</thead><tbody>
      <tr class="sec"><td colspan="${years.length + 1}">Przychody</td></tr>${rows('in', 'pos')}
      <tr class="tot"><td>Przychody razem</td>${years.map(y => `<td class="num pos">${kM(tot(y, 'in'))}</td>`).join('')}</tr>
      <tr class="sec"><td colspan="${years.length + 1}">Koszty</td></tr>${rows('out', 'neg')}
      <tr class="tot"><td>Koszty razem</td>${years.map(y => `<td class="num neg">${kM(-tot(y, 'out'))}</td>`).join('')}</tr>
      <tr class="tot"><td>Wynik roku</td>${years.map(y => { const v = tot(y, 'in') + tot(y, 'out'); return `<td class="num ${v < 0 ? 'neg' : 'pos'}">${kM(v)}</td>`; }).join('')}</tr>
      <tr><td>Saldo 31 października</td>${years.map(y => `<td class="num">${ye[y] ? kM(ye[y].cash) : y === cur ? `<span class="muted">teraz ${kM(c.cash)}</span>` : '—'}</td>`).join('')}</tr>
      ${planRow('Budżet płac zawodników (plan)', y => ye[y] ? kM(ye[y].riders) : y === cur ? kM(budgetPlan(c, y).riders) : '—')}
      ${planRow('Budżet transferowy (plan)', y => ye[y] ? kM(ye[y].transfers) : y === cur ? kM(budgetPlan(c, y).transfers) : '—')}
      ${planRow('Liga', y => ye[y] ? esc(LEAGUES[ye[y].league].short) : y === cur ? esc(LEAGUES[c.league].short) : '—')}
    </tbody></table></div></div>`;
  // ranking finansowy ligi (bieżący rok finansowy)
  const clubs = Object.values(G.clubs).filter(x => x.league === c.league && clubActive(x) && x.fin);
  const rk = clubs.map(x => { const y = (x.fin.ledger || {})[cur] || { in: {}, out: {} }; const inn = y.in || {}, out = y.out || {};
    const own = (inn['właściciel'] || 0) + (inn.finansowanie || 0), revv = sum(Object.values(inn)) - own, riders = -((out.kontrakty || 0) + (out.punkty || 0));
    return { x, rev: revv, own, riders, res: sum(Object.values(inn)) + sum(Object.values(out)), cash: x.cash }; }).sort(by(z => z.rev, -1));
  const rank = `<div class="panel flush"><div class="ph"><h3>Ranking finansowy – ${esc(LEAGUES[c.league].name)}, sezon ${cur}</h3><span class="small muted">wykonanie od 1 listopada</span></div>
    <table class="t"><thead><tr><th>Klub</th><th class="num">Przychody (bez właściciela)</th><th class="num">Właściciel i finansowanie</th><th class="num">Zawodnicy</th><th class="num">Wynik</th><th class="num">Saldo</th></tr></thead><tbody>
    ${rk.map(z => `<tr class="${z.x.id === c.id ? 'me' : ''}"><td>${clubLink(z.x.id)}</td><td class="num">${kM(z.rev)}</td><td class="num">${kM(z.own)}</td><td class="num">${kM(z.riders)}</td><td class="num ${z.res < 0 ? 'neg' : 'pos'}">${kM(z.res)}</td><td class="num ${z.cash < 0 ? 'neg' : ''}">${kM(z.cash)}</td></tr>`).join('')}</tbody></table></div>`;
  return tbl + rank;
};

// ---------- Panel „Wpływ na budżet” (ekran oferty) ----------
function budgetImpactPanel(r, kind, t, season, n, clubStep) {
  const c = myClub();
  if (!c.fin || !season) return '';
  const p = budgetPlan(c, season), rc = ridersCommitted(c, season, r.id), tc = transfersCommitted(c, season, n ? n.id : null);
  const fee = t.fee || 0;
  const cost = clubStep ? 0 : plannedCost(r, kind === 'loan' ? { ...t, kind: 'wypożyczenie' } : { ...t, kind: t.kind || 'zawodowy' }, c.id, season);
  const leftR = p.riders - rc.total - cost, leftT = p.transfers - tc.total - fee;
  const cls = v => v < 0 ? 'neg' : 'pos';
  const tt = t.terms && t.terms[season] ? t.terms[season] : t;
  const pts = !clubStep && t.kind !== 'amatorski' && t.kind !== 'warszawski' ? predPoints(r, c.id, season, t.role) : 0;
  const split = !clubStep && pts ? `<div class="small muted">podpis ${kM(tt.signing)} + ok. ${pts} pkt × ${kM(tt.perPoint)} = ${kM((tt.signing || 0) + (tt.perPoint || 0) * pts)}${cost > (tt.signing || 0) + (tt.perPoint || 0) * pts + 1000 ? ' + oczekiwane premie' : ''}</div>` : '';
  const later = !clubStep && kind !== 'loan' && (t.years || 1) > 1 ? Array.from({ length: Math.min(t.years, 3) - 1 }, (_, i) => season + 1 + i).map(s => { const pp = budgetPlan(c, s), used = ridersCommitted(c, s, r.id).total, v = plannedCost(r, { ...t, kind: t.kind || 'zawodowy', terms: makeTerms(t, season, t.years) }, c.id, s);
    return `<div>Sezon ${s} (wstępnie)</div><div class="${cls(pp.riders - used - v)}">${kM(v)} · zostanie ${kM(pp.riders - used - v)}</div>`; }).join('') : '';
  const warn = leftR < 0 || leftT < 0 ? `<div class="reply blocked">Oferta przekracza budżet${leftR < 0 ? ' płac zawodników' : ''}${leftR < 0 && leftT < 0 ? ' i' : ''}${leftT < 0 ? ' transferowy' : ''}. <a href="#/finanse/budzet">Zmień suwak albo poproś zarząd →</a></div>`
    : leftR < (c.league === 'PGE' ? 300000 : c.league === '2E' ? 120000 : 50000) && !clubStep ? '<div class="reply counter">Po tej umowie w budżecie płac zostanie niewiele – może zabraknąć na uzupełnienie składu.</div>' : '';
  return `<div class="panel"><h3>Wpływ na budżet – sezon ${season}</h3><div class="kv">
      ${clubStep ? '' : `<div>Płace zawodników</div><div>${kM(p.riders)}</div><div>Już zajęte</div><div>${kM(rc.total)}</div><div><b>Ta umowa</b></div><div><b>${kM(cost)}</b>${split}</div><div>Zostanie</div><div class="${cls(leftR)}"><b>${kM(leftR)}</b></div>`}
      ${fee || clubStep ? `<div>Budżet transferowy</div><div>${kM(p.transfers)}</div><div>Już zajęte</div><div>${kM(tc.total)}</div><div><b>${kind === 'loan' ? 'Opłata za wypożyczenie' : 'Kwota dla klubu'}</b></div><div><b>${kM(fee)}</b></div><div>Zostanie</div><div class="${cls(leftT)}"><b>${kM(leftT)}</b></div>` : ''}
      ${later}</div>${warn}
    ${!clubStep && p.cap.applies ? `<p class="small muted" style="margin-top:6px">Limit Ekstraligi liczony osobno (punkty z ubiegłego sezonu) – patrz panel Koszty.</p>` : ''}</div>`;
}
