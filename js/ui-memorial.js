'use strict';
// Zakładka „Organizacja” zawodów (#/gp/<id>/organizacja): pula nagród, zaproszenia zawodników, startowe, wypłaty (js/memorial.js).

UI.org = UI.org || { min: 0, nat: '', fees: {} };

function orgPrizeTable(ev, pool) {
  const P = orgPrizes(pool, eventFieldSize(ev));
  return `<div class="small">${P.map((p, i) => `<span style="display:inline-block;min-width:118px">${i + 1}. ${fmtMoney(p)}</span>`).join('')}</div>`;
}
function orgPage(ev) {
  const o = ev.org, mine = orgMine(ev), h = orgHost(ev);
  if (!o && !mine) return `<div class="panel muted">Organizator: ${clubLink(h.id)}. Warunki zawodów zostaną podane przy ogłoszeniu listy startowej.</div>`;
  const pl = o ? o.pool : ORG_POOL[h.league] || ORG_POOL.KLZ;
  const inv = o ? o.inv.filter(x => !x.auto || x.st === 'accepted') : [];
  const acc = o ? orgAccepted(ev) : [];
  const fees = sum(acc.map(x => x.fee));
  const head = `<div class="panel"><div class="kv">
    <div>Organizator</div><div>${clubLink(h.id)}${o && o.assisted ? ' <span class="small muted">· braki w obsadzie uzupełnił asystent</span>' : ''}</div>
    <div>Pula nagród</div><div><b>${fmtMoney(pl)}</b> ${orgPrizeTable(ev, pl)}</div>
    <div>Przyjęli</div><div><b>${acc.length}</b> z ${eventFieldSize(ev)} (+2 rezerwowych) · startowe razem ${fmtMoney(fees)} · koszt organizatora ok. ${fmtMoney(pl + fees)} + organizacja zawodów</div>
    <div>Atrakcyjność obsady</div><div>× ${round2(orgStarFactor(ev))} frekwencji <span class="small muted">(czołówka i zawodnicy Grand Prix przyciągają kibiców)</span></div>
    ${o && o.paid ? `<div>Wypłacono</div><div>nagrody ${fmtMoney(o.paid.tot)}, startowe ${fmtMoney(o.paid.feeTot)}</div>` : ''}</div></div>`;
  const invTable = inv.length ? `<div class="panel flush"><div class="ph"><h3>Zaproszenia</h3></div><table class="t"><thead><tr><th>Zawodnik</th><th>Klub</th><th class="num">Startowe</th><th>Status</th><th>Odpowiedź</th><th></th></tr></thead><tbody>
    ${inv.sort(by(x => G.riders[x.id] ? -G.riders[x.id].skill : 0)).map(x => `<tr><td>${riderLink(x.id)}</td><td class="small">${G.riders[x.id] && G.clubs[G.riders[x.id].clubId] ? esc(G.clubs[G.riders[x.id].clubId].short) : '—'}</td><td class="num">${x.fee ? fmtMoney(x.fee) : '—'}</td>
      <td class="small ${x.st === 'accepted' ? 'pos' : x.st === 'declined' ? 'neg' : 'muted'}">${ORG_ST[x.st]}${x.why ? ` – ${esc(x.why)}` : ''}${x.short ? ` (brakuje ok. ${fmtMoney(x.short)})` : ''}</td><td class="small">${x.st === 'pending' ? `do ${fmtDateShort(x.replyOn)}` : x.ans ? fmtDateShort(x.ans) : ''}</td>
      <td class="num">${orgOpen(ev) && ['pending', 'accepted'].includes(x.st) ? `<button class="btn ghost sm" onclick="ACT.orgWithdraw('${ev.id}',${x.id})">Wycofaj</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '';
  if (!orgOpen(ev)) {
    const note = !mine ? '' : orgLocked(ev) ? '<div class="panel small muted">Lista startowa ogłoszona – zaproszenia zamknięte.</div>' : `<div class="panel small">Zaproszenia otwieramy ${fmtDate(addDays(ev.date, -ORG_OPEN_DAYS))} (ok. 2,5 miesiąca przed zawodami).</div>`;
    return head + note + invTable;
  }
  const U = UI.org, taken = new Set(inv.filter(x => x.st !== 'declined' && x.st !== 'withdrawn').map(x => x.id));
  const cands = pool(ev.date).filter(r => !taken.has(r.id) && r.skill >= U.min && (!U.nat || (U.nat === 'POL' ? hasNat(r, 'POL') : !hasNat(r, 'POL')))).slice(0, 60);
  const form = `<div class="panel"><div class="row wrap" style="gap:10px;align-items:flex-end">
      <label>Pula nagród (zł)<br><input type="number" step="5000" min="0" value="${pl}" id="orgPool" style="width:130px"></label><button class="btn" onclick="ACT.orgPool('${ev.id}')">Ustaw pulę</button>
      <span class="small muted">Lista startowa: ${fmtDateShort(ev.announceOn || announceDate(ev))} – do tego dnia zaproszenia; niepełną obsadę uzupełni asystent zawodnikami bez startowego.</span></div></div>
    <div class="panel flush"><div class="ph"><h3>Zaproś zawodników</h3><div class="row small"><label>poziom od <select onchange="UI.org.min=+this.value;render()">${[0, 8, 10, 12, 14].map(v => `<option value="${v}" ${U.min === v ? 'selected' : ''}>${v ? '★'.repeat(Math.round((v - 6) / 2)) : 'wszyscy'}</option>`).join('')}</select></label>
      <label>kraj <select onchange="UI.org.nat=this.value;render()"><option value="">wszyscy</option><option value="POL" ${U.nat === 'POL' ? 'selected' : ''}>Polacy</option><option value="X" ${U.nat === 'X' ? 'selected' : ''}>obcokrajowcy</option></select></label></div></div>
    <table class="t"><thead><tr><th>Zawodnik</th><th>Klub</th><th>Poziom</th><th class="num">Oczekiwania (szac.)</th><th class="num">Spodziewana nagroda</th><th>Dostępność</th><th class="num">Startowe</th><th></th></tr></thead><tbody>
    ${cands.map(r => { const ask = orgAsk(r, ev), exp = orgExpPrize(r, ev), busy = orgBusy(r, ev), fee = U.fees[r.id] ?? orgSuggestFee(r, ev), pr = inv.find(x => x.id === r.id);
      return `<tr><td>${flag(r.country)} ${riderLink(r.id)}${G.sgp && G.sgp.riders && G.sgp.riders.includes(r.id) ? ' <span class="pill">GP</span>' : ''}</td><td class="small">${G.clubs[r.clubId] ? esc(G.clubs[r.clubId].short) : '—'}</td><td>${caStars(r)}</td>
        <td class="num small">${fmtMoney(Math.round(ask * 0.8 / 1000) * 1000)}–${fmtMoney(Math.round(ask * 1.2 / 1000) * 1000)}</td><td class="num small">${fmtMoney(exp)}</td>
        <td class="small ${busy ? 'neg' : ''}">${busy ? esc(busy) : pr && pr.st === 'declined' ? 'odmówił – popraw warunki' : 'wolny'}</td>
        <td class="num"><input type="number" step="500" min="0" value="${fee}" style="width:90px" onchange="UI.org.fees[${r.id}]=+this.value"></td>
        <td class="num"><button class="btn sm ${busy ? 'ghost' : 'primary'}" ${busy ? 'disabled' : ''} onclick="ACT.orgInvite('${ev.id}',${r.id})">Zaproś</button></td></tr>`; }).join('')}</tbody></table>
    <p class="small muted" style="padding:0 12px 10px">Spodziewana nagroda wynika z puli i miejsca, jakie zawodnik zająłby w obecnej obsadzie (przyjęci i czekający). Startowe uzupełnia różnicę do oczekiwań; przed ligą zawodnicy jadą taniej (potrzebują jazdy), zawodnicy naszego klubu – najtaniej.</p></div>`;
  return head + invTable + form;
}
ACT.orgPool = id => { const ev = G.events[id], r = orgSetPool(ev, $('#orgPool').value); toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) changed(); };
ACT.orgInvite = (id, rid) => { const ev = G.events[id], fee = UI.org.fees[rid] ?? orgSuggestFee(G.riders[rid], ev), r = orgInvite(ev, rid, fee); toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) changed(); };
ACT.orgWithdraw = (id, rid) => { const r = orgWithdraw(G.events[id], rid); toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) changed(); };
