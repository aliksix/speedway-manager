'use strict';
// Ekrany obozów: Kalendarz → Obozy (ośrodki, rezerwacja z wyceną na osobę, nasze obozy) i strona obozu (przebieg, koszty).

UI.camp = UI.camp || { venue: '', start: '', days: 0, riders: null, staff: null };

function campVenueRows(S) {
  const me = G.clubs[G.clubId], home = geoOf(me.city) || COUNTRY_GEO.POL;
  return Object.entries(CAMP_TYPES).map(([t, T]) => {
    const [a, b] = campWindow(t, S);
    const vs = Object.entries(CAMP_VENUES).filter(([, v]) => v.type === t);
    return `<div class="panel flush"><div class="ph"><h3>${t}. ${esc(T.name)}</h3><span class="small muted">${fmtDateShort(a)} – ${fmtDateShort(b)} · ${T.min}–${T.max} dni · rezerwacja min. ${T.lead} dni wcześniej</span></div>
      <p class="small" style="padding:0 12px">${esc(T.desc)}</p>
      <table class="t"><thead><tr><th>Ośrodek</th><th class="num">Odległość</th><th class="num">Pobyt / os. / dzień</th><th class="num">${t === 'C' ? 'Tor / zawodnik / dzień' : t === 'B' ? 'Crossy / dzień · lot' : ''}</th><th>${t === 'C' ? 'Rezerwacje innych klubów' : ''}</th><th></th></tr></thead><tbody>
      ${vs.map(([k, v]) => {
        const taken = t === 'C' ? campAll().filter(c => c.venue === k && campLive(c) && c.season === S && c.clubId !== G.clubId).sort(by(c => c.start)).map(c => `${esc(G.clubs[c.clubId].short)} ${fmtDateShort(c.start).slice(0, 5)}–${fmtDateShort(campEnd(c)).slice(0, 5)}`) : [];
        return `<tr><td><b>${esc(v.name)}</b>${v.open ? ` <span class="small muted">od ${v.open.split('-').reverse().join('.')}</span>` : ''}</td><td class="num">${Math.round(kmBetween(home, v.geo))} km</td><td class="num">${fmtMoney(v.stay)}</td>
          <td class="num">${t === 'C' ? fmtMoney(v.track) : t === 'B' ? `${fmtMoney(v.mx)} · ${fmtMoney(v.flight)}` : ''}</td><td class="small">${taken.join(', ')}</td>
          <td class="num"><button class="btn sm" onclick="UI.camp.venue='${k}';UI.camp.days=0;UI.camp.start='';render()">Wybierz</button></td></tr>`;
      }).join('')}</tbody></table></div>`;
  }).join('');
}
function campQuoteTable(q, type) {
  const C = type === 'C', B = type === 'B';
  return `<table class="t"><thead><tr><th>Osoba</th><th class="num">Pobyt</th><th class="num">${B ? 'Lot' : 'Przejazd'}</th>${B ? '<th class="num">Crossy</th>' : ''}${C ? '<th class="num">Tor</th><th class="num">Motocykle / busy</th><th class="num">Transport</th><th class="num">Mechanicy</th><th class="num">Materiały</th>' : ''}<th class="num">Klub</th><th class="num">Zawodnik</th></tr></thead><tbody>
    ${q.rows.map(x => `<tr><td>${riderLink(x.id)}${x.junior ? ' <span class="small muted">U21 – klub płaci wszystko</span>' : ''}</td><td class="num">${fmtMoney(x.stay)}</td><td class="num">${fmtMoney(x.travel)}</td>${B ? `<td class="num">${fmtMoney(x.mx)}</td>` : ''}
      ${C ? `<td class="num">${fmtMoney(x.track)}</td><td class="num">${x.bikes} / ${x.vans}</td><td class="num">${fmtMoney(x.transport)}</td><td class="num">${x.mechN} · ${fmtMoney(x.mech)}</td><td class="num">${fmtMoney(x.mat)}</td>` : ''}
      <td class="num">${fmtMoney(x.club)}</td><td class="num">${x.rider ? fmtMoney(x.rider) : '—'}</td></tr>`).join('')}
    ${q.staff.map(x => `<tr class="muted"><td>${esc(x.name)} <span class="small">(${esc((STAFF_ROLES[x.role] || {}).name || x.role)})</span></td><td class="num">${fmtMoney(x.stay)}</td><td class="num">${fmtMoney(x.travel)}</td>${B ? '<td></td>' : ''}${C ? '<td></td><td></td><td></td><td></td><td></td>' : ''}<td class="num">${fmtMoney(x.total)}</td><td></td></tr>`).join('')}
    <tr><td><b>Razem</b> <span class="small muted">(średnio ${fmtMoney(q.perRider)} na zawodnika)</span></td><td colspan="${2 + (B ? 1 : 0) + (C ? 5 : 0)}"></td><td class="num"><b>${fmtMoney(q.club)}</b></td><td class="num"><b>${fmtMoney(q.riders)}</b></td></tr></tbody></table>`;
}
function campsPage(T) {
  const S = campSeason(), U = UI.camp, v = CAMP_VENUES[U.venue], mine = campOfClub(G.clubId, S);
  let form = '';
  if (v) {
    const Tt = CAMP_TYPES[v.type], [a, b] = campWindow(v.type, S);
    const min0 = [addDays(G.date, Tt.lead), a, v.open ? `${S}-${v.open}` : a].sort()[2];
    if (!U.days) U.days = v.type === 'C' ? 4 : v.type === 'B' ? 6 : 5;
    if (!U.start || U.start < min0) U.start = min0;
    const rs = clubRiders(G.clubId).filter(r => r.active !== false && !r.retired && !u16(r)).sort(by(r => r.skill, -1));
    const st = clubStaff(G.clubId).filter(s => CAMP_STAFF_ROLES.includes(s.role) || s.player);
    if (!U.riders) U.riders = campDefaultRiders(G.clubId);
    if (!U.staff) U.staff = campDefaultStaff(G.clubId, v.type);
    const q = campQuote(G.clubId, U.venue, U.days, U.riders, U.staff), prob = campProblem(G.clubId, U.venue, U.start, U.days);
    const sq = campStaffQ(U.staff);
    form = `<div class="panel"><div class="ph"><h3>Rezerwacja: ${esc(v.name)}</h3><button class="btn ghost sm" onclick="UI.camp.venue='';render()">✕</button></div>
      <div class="row wrap" style="gap:10px;align-items:flex-end">
        <label>Początek<br><input type="date" value="${U.start}" min="${min0}" max="${b}" onchange="UI.camp.start=this.value;render()"></label>
        <label>Dni<br><select onchange="UI.camp.days=+this.value;render()">${Array.from({ length: Tt.max - Tt.min + 1 }, (_, i) => Tt.min + i).map(n => `<option ${n === U.days ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <span class="small muted">do ${fmtDateShort(addDays(U.start, U.days - 1))}${v.type === 'C' ? ` · dni torowe: ${U.days - 1} (pierwszy dzień – dojazd busami z motocyklami)` : v.type === 'B' ? ` · dni z motocrossem: ${q.mxDays}` : ''}</span>
        <button class="btn primary" onclick="ACT.campBook()" ${prob ? 'disabled' : ''}>Zarezerwuj</button></div>
      ${prob ? `<p class="neg small">${esc(prob)}</p>` : ''}
      <div class="grid g2" style="margin-top:10px"><div><b>Zawodnicy</b> <span class="small muted">(${U.riders.length})</span><div class="small">${rs.map(r => { const p = campDeclineChance(r, v.type); return `<label class="row"><input type="checkbox" ${U.riders.includes(r.id) ? 'checked' : ''} onchange="ACT.campPick('riders',${r.id},this.checked)"> ${esc(r.name)}${isJunior(r) ? ' <span class="muted">U21</span>' : ''}${p >= 0.3 ? ' <span class="warn">może odmówić</span>' : ''}${r.injury ? ' <span class="neg">kontuzja</span>' : ''}</label>`; }).join('')}</div></div>
        <div><b>Sztab</b> <span class="small muted">(${U.staff.length})</span><div class="small">${st.map(s => `<label class="row"><input type="checkbox" ${U.staff.includes(s.id) ? 'checked' : ''} onchange="ACT.campPick('staff','${s.id}',this.checked)"> ${esc(s.name)} <span class="muted">${esc((STAFF_ROLES[s.role] || {}).name || s.role)}</span></label>`).join('')}</div>
          <p class="small" style="margin-top:8px">Bez motoryka trening fizyczny daje ok. 60% efektu, bez trenera – technika ok. 60%, bez mechanika parku maszyn – praca nad sprzętem 70%. Fizjoterapeuta lub lekarz zmniejsza zmęczenie.
          ${[sq.physical < 1 && 'brak motoryka', sq.tech < 1 && 'brak trenera', v.type === 'C' && sq.workshop < 1 && 'brak mechanika'].filter(Boolean).map(t => `<span class="warn">${t}</span>`).join(', ')}</p></div></div>
      <div class="panel flush" style="margin-top:10px"><div class="ph"><h3>Koszt na osobę</h3><span class="small muted">klub: pobyt, przejazdy, ${v.type === 'C' ? 'tor, transport motocykli' : v.type === 'B' ? 'loty, wynajem crossów' : 'obiekty'}; senior: własni mechanicy i materiały (budżet sprzętowy)</span></div>${campQuoteTable(q, v.type)}</div></div>`;
  }
  const list = mine.length ? `<table class="t"><thead><tr><th>Termin</th><th>Ośrodek</th><th>Typ</th><th class="num">Zawodnicy</th><th>Status</th><th class="num">Koszt klubu</th><th></th></tr></thead><tbody>
    ${mine.map(c => `<tr class="click" onclick="go('#/kalendarz/oboz/${c.id}')"><td>${fmtDateShort(c.start)} – ${fmtDateShort(campEnd(c))}</td><td><b>${esc(campVenue(c).name)}</b></td><td class="small">${esc(CAMP_TYPES[c.type].short)}</td>
      <td class="num">${(c.att || c.riders.filter(x => !c.declined.includes(x))).length}${c.declined.length ? ` <span class="small muted">(${c.declined.length} odmówiło)</span>` : ''}</td><td class="small">${CAMP_ST[c.status]}</td><td class="num">${fmtMoney(c.status === 'cancelled' ? c.fee || 0 : c.quote.club)}</td>
      <td class="num">${c.status === 'booked' ? `<button class="btn ghost sm" onclick="event.stopPropagation();ACT.campCancel('${c.id}')">Odwołaj</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Brak obozów w tym sezonie.</div>';
  return { title: 'Kalendarz', sub: `Sezon ${S} · obozy przygotowawcze`, tabs: T, body: `
    <div class="panel"><div class="kv"><div>Jak to działa</div><div class="small">Obóz wzmacnia trening w oknie fazy: zima – atrybuty fizyczne (A, B), marzec – technika na torze (C). Dni torowe za granicą nie zależą od polskiej pogody. Każdy dzień na torze to zwykły trening: silniki się zużywają i docierają, można upaść. Na motocrossie jest ryzyko urazu. Obcokrajowiec na obozie trenuje z klubem, zamiast w domu.</div>
      <div>Kluby AI</div><div class="small">${G.campPlanned && G.campPlanned[S] ? `zarezerwowały obozy ${fmtDateShort(G.campPlanned[S])} – tory za granicą mają limit 2 klubów dziennie` : 'rezerwują obozy od 10 grudnia – wcześniej łatwiej o wolny tor'}</div></div></div>
    <div class="panel flush"><div class="ph"><h3>Nasze obozy</h3></div>${list}</div>
    ${form}${campVenueRows(S)}` };
}
function campPage(id) {
  const c = G.camps && G.camps[id];
  if (!c) return { title: 'Nie znaleziono obozu', body: '<a href="#/kalendarz/obozy">Obozy</a>' };
  const v = campVenue(c), days = Array.from({ length: c.days }, (_, i) => addDays(c.start, i));
  const att = c.att || c.riders.filter(x => !c.declined.includes(x));
  return { title: esc(v.name), sub: `<a href="#/kalendarz/obozy">Obozy</a> · ${esc(CAMP_TYPES[c.type].name)} · ${fmtDate(c.start)} – ${fmtDate(campEnd(c))} · ${CAMP_ST[c.status]}`, body: `
    <div class="panel"><div class="ph"><h3>Program</h3></div><div class="camp-grid">${days.map((d, i) => { const l = c.log && c.log[d]; const k = l ? l.k : campDayKind(c, i); return `<div class="cd ${k === 'rain' ? 'rain' : ''}"><b>${fmtDateShort(d).slice(0, 5)}</b><br>${CAMP_DAY[k]}${l ? `<br><span class="muted">${l.t}°C</span>` : ''}</div>`; }).join('')}</div></div>
    <div class="grid g2"><div class="panel"><div class="ph"><h3>Zawodnicy (${att.length})</h3></div><div class="small">${att.map(x => `${riderLink(x)}${(c.inj || []).includes(x) ? ' <span class="neg">kontuzja</span>' : ''}`).join('<br>')}</div>
      ${c.declined.length ? `<p class="small muted">Odmówili: ${c.declined.map(x => riderLink(x)).join(', ')}</p>` : ''}</div>
      <div class="panel"><div class="ph"><h3>Sztab (${c.staff.length})</h3></div><div class="small">${c.staff.map(x => G.staff[x] ? esc(G.staff[x].name) : '').join('<br>') || 'bez sztabu'}</div></div></div>
    <div class="panel flush"><div class="ph"><h3>Koszty</h3>${c.status === 'booked' ? '<span class="small muted">wycena – płatność w dniu wyjazdu</span>' : ''}</div>${campQuoteTable(c.quote, c.type)}</div>` };
}
// Wpisy obozów w widoku miesiąca kalendarza
function campCalEntries(days) {
  const out = [];
  for (const c of campAll()) {
    if (c.clubId !== G.clubId || c.status === 'cancelled') continue;
    for (const d of days) if (campOn(c, d)) out.push([d, `<div class="ev k-oboz mine" onclick="go('#/kalendarz/oboz/${c.id}')" title="${esc(campVenue(c).name)}">⛺ ${esc(campVenue(c).name.split(' (')[0])}<div class="small muted">obóz · ${(c.log && c.log[d] && CAMP_DAY[c.log[d].k]) || CAMP_TYPES[c.type].short}</div></div>`]);
  }
  return out;
}
ACT.campPick = (k, id, on) => { const list = UI.camp[k] || []; const v = k === 'riders' ? Number(id) : id; UI.camp[k] = on ? [...new Set([...list, v])] : list.filter(x => x !== v); render(); };
ACT.campBook = () => {
  const U = UI.camp, r = campBook({ venue: U.venue, start: U.start, days: U.days, riders: U.riders, staff: U.staff });
  toast(r.text, r.ok ? 'good' : 'bad');
  if (r.ok) { UI.camp = { venue: '', start: '', days: 0, riders: null, staff: null }; changed(); }
};
ACT.campCancel = id => { const r = campCancel(id); toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) changed(); };
