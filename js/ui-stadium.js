'use strict';
// Ekrany stadionu (Klub → Stadion, Bilety, Karnety, Frekwencja): sektory z bazy stadionów, cenniki według sektora i kategorii wiekowej,
// osobne cenniki play-off, finału, barażu i zawodów na naszym stadionie, karnety z opcjami oraz prognoza frekwencji i wpływów (js/stadium.js).

const STADIUM_TABS = [['stadion', 'Stadion'], ['tor', 'Tor'], ['bilety', 'Bilety'], ['karnety', 'Karnety'], ['frekwencja', 'Frekwencja']];
const CAT_KEYS = ['N', 'U', 'D', 'R'];
const pctTxt = x => `${Math.round(x * 100)}%`;
const lux = s => s.lighting ? `${fmtNum(s.lighting)} lx` : s.lights ? 'tak' : 'brak';
// Zawody, dla których można ustalić cennik w tym sezonie: mecze ligowe i imprezy na naszym stadionie
function priceLists(c) {
  const S = sportSeason();
  const fx = seasonFixtures(c.league, S).filter(f => f.homeId === c.id);
  const when = key => fx.filter(f => leagueEventKey(f.stage) === key).map(f => fmtDateShort(f.date)).join(', ');
  const out = Object.entries(LEAGUE_EVENTS).map(([k, e]) => ({ key: k, name: e.name, sub: k === 'RS' ? (fx.length ? `${fx.filter(f => f.stage === 'RS').length} meczów domowych` : 'terminarz ligi – od 1 listopada') : when(k) || 'jeśli drużyna awansuje / zagra u siebie' }));
  for (const ev of hostedEvents(c, S)) out.push({ key: `E:${ev.id}`, name: ev.name, sub: `${fmtDateShort(ev.date)} · ${EVENT_CLASSES[eventClassOf(ev)].name}${ev.played ? ' · rozegrane' : ''}`, ev });
  return out;
}
// Prognoza dla wybranego cennika
function gateForecast(c, key) {
  if (key.startsWith('E:')) { const ev = G.events[key.slice(2)]; return ev ? eventGateCalc(c, ev, true) : null; }
  return gateCalc(c, { key, attract: LEAGUE_EVENTS[key].att, awayMass: 0.035 * (key === 'RS' ? 1 : 1.5) });
}

function stadiumPage(c, sub, arg) {
  stadiumInit(c);
  return { stadion: stadiumInfoPage, tor: trackPage, bilety: ticketsPage, karnety: seasonTicketsPage, frekwencja: attendancePage }[sub](c, arg); // tor: js/ui-track.js
}

// ---------- Stadion ----------
function stadiumInfoPage(c) {
  const s = c.stadium, v = VENUES[s.venueId] || null;
  const H = holdersOf(c), P = priceTable(c, 'RS');
  const seated = sum(s.sectors.filter(x => x.kind !== 'standing').map(x => x.seats)), covered = sum(s.sectors.filter(x => x.covered).map(x => x.seats));
  const rows = s.sectors.map(x => { const h = H[x.id] || {}; const hn = (h.N || 0) + (h.U || 0) + (h.D || 0) + (h.R || 0) * 4;
    return `<tr><td><b>${esc(x.name)}</b></td><td>${esc(SECTOR_KINDS[x.kind].name)}</td><td class="num">${fmtNum(x.seats)}</td><td>${x.covered ? 'kryty' : '—'}</td><td>${x.numbered ? 'numerowane' : 'nienumerowane'}</td>
      <td class="num">×${x.mult.toFixed(2).replace('.', ',')}</td><td class="num">${P[x.id] && P[x.id].N ? fmtMoney(P[x.id].N) : '—'}</td><td class="num">${hn ? fmtNum(hn) : '—'}</td></tr>`; }).join('');
  const rec = s.record ? `${s.record.time.toFixed(2).replace('.', ',')} s – ${riderLink(s.record.riderId)} (${fmtDateShort(s.record.date)})` : v && v.record ? `${String(v.record.time).replace('.', ',')} s – ${esc(v.record.holder)} (${esc(v.record.date)}, baza PZM)` : '—';
  return `<div class="stat-tiles" style="margin-bottom:16px">
      <div class="tile"><div class="k">Pojemność</div><div class="v">${fmtNum(s.capacity)}</div><div class="s">${s.sectors.length} sektorów</div></div>
      <div class="tile"><div class="k">Miejsca siedzące</div><div class="v">${fmtNum(seated)}</div><div class="s">stojące: ${fmtNum(s.capacity - seated)}</div></div>
      <div class="tile"><div class="k">Pod dachem</div><div class="v">${fmtNum(covered)}</div><div class="s">${pctTxt(covered / s.capacity)} widowni</div></div>
      <div class="tile"><div class="k">Oświetlenie</div><div class="v">${lux(s)}</div><div class="s">${s.lighting >= 1600 ? 'mecze wieczorne z transmisją TV' : s.lights ? 'mecze wieczorne' : 'tylko mecze dzienne'}</div></div>
      <div class="tile"><div class="k">Popyt bazowy</div><div class="v">${fmtNum(s.demand)}</div><div class="s">widzów typowego meczu przy cenach wyjściowych</div></div></div>
    <div class="grid g2" style="margin-bottom:16px"><div class="panel"><h3>${esc(s.venueName || s.name)}</h3><div class="kv">
      ${v ? `<div>Adres</div><div>${esc(v.address)}</div>` : ''}<div>Właściciel / operator</div><div>${s.owner === 'miasto' ? 'miasto (MOSiR / OSiR)' : c.short === 'LAN' ? 'klub (dzierżawa od 2026)' : 'brak danych'}</div>
      <div>Długość toru</div><div>${s.track} m${v && v.length && Math.abs(v.length - s.track) >= 2 ? ` <span class="small muted">(baza PZM 2026: ${String(v.length).replace('.', ',')} m)</span>` : ''}</div>
      ${v && v.straights[0] ? `<div>Proste / łuki</div><div>${v.straights.map(x => String(x).replace('.', ',')).join(' / ')} m · ${v.bends.map(x => String(x).replace('.', ',')).join(' / ')} m</div>` : ''}
      <div>Nawierzchnia</div><div>${esc(s.surfaceDb || s.surface)}</div><div>Rekord toru</div><div>${rec}</div>
      ${v && v.licenceTo ? `<div>Licencja PZM do</div><div>${fmtDateShort(v.licenceTo)}</div>` : ''}
      <div>Toromistrz</div><div>${clubStaff(c.id).filter(x => x.role === 'track').map(x => `${esc(x.name)} (${x.attrs.track})`).join(', ') || '<span class="neg">brak</span>'} <a class="small" href="#/klub/tor">przygotowanie toru →</a></div></div>
      ${v ? `<p class="small muted">${esc([v.extra, v.paddock].filter(Boolean).join(' '))}</p>${v.conflict ? `<p class="small muted">Rozbieżności w źródłach: ${esc(v.conflict)}</p>` : ''}<p class="small muted">Pewność danych: ${esc(v.confidence)}. Źródło: baza stadionów żużlowych 2026 (tools/sources/venue).</p>` : '<p class="small muted">Klub nie ma stałego stadionu w bazie licencjonowanych torów PZM – sektory według szablonu.</p>'}</div>
      <div class="panel stack"><h3>Inwestycje</h3>
        <div class="row wrap"><select id="exp-sec">${s.sectors.filter(x => x.kind !== 'vip').map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
          <button class="btn" onclick="ACT.arm(this, 'expandSector', $('#exp-sec').value)">Rozbudowa sektora +1 000 miejsc (${fmtMoney(COSTS.seats * 1000, true)})</button></div>
        ${s.lighting && s.lighting >= 1600 ? '' : `<button class="btn" onclick="ACT.arm(this, 'lights')">${s.lights ? 'Modernizacja oświetlenia do 1 800 lx (mecze w TV)' : 'Montaż oświetlenia'} (${fmtMoney(1500000, true)})</button>`}
        <p class="small muted">Podział na sektory pochodzi z bazy stadionów i cenników klubów; tam, gdzie baza nie podaje liczby miejsc w sektorach, wielkości są szacunkowe (uzupełnione według typowego układu stadionu żużlowego). Mnożnik ceny to relacja ceny sektora do prostej przeciwległej w cenniku wyjściowym klubu.</p></div></div>
    <div class="panel flush"><div class="ph"><h3>Sektory</h3><a class="btn sm" href="#/klub/bilety">Cennik biletów →</a></div><div class="scroll-x"><table class="t"><thead><tr><th>Sektor</th><th>Rodzaj</th><th class="num">Miejsca</th><th>Dach</th><th>Miejsca</th><th class="num">Mnożnik</th><th class="num">Bilet normalny</th><th class="num">Karnety</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

// ---------- Bilety ----------
function policyPanel(c) {
  const p = c.tickets.policy, mix = crowdMix(p);
  const opt = (from, to, val, extra = []) => [...extra, ...Array.from({ length: to - from + 1 }, (_, i) => [from + i, `${from + i} lat`])].map(([v, l]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${l}</option>`).join('');
  const tot = mix.F0 + mix.N + mix.U + mix.D + mix.FAM;
  return `<div class="panel stack"><h3>Kategorie biletów (wszystkie zawody)</h3>
    <div class="offer-grid">
      <label class="fld">Wstęp bezpłatny (z opiekunem, bez gwarancji miejsca) do lat<select onchange="ACT.tkPolicy('free', +this.value)">${opt(0, 8, p.free, [[-1, 'brak']])}</select></label>
      <label class="fld">Bilet dziecięcy do lat<select onchange="ACT.tkPolicy('child', +this.value)">${opt(Math.max(0, p.free + 1), 18, p.child, [[p.free, 'brak biletu dziecięcego']])}</select></label>
      <label class="fld">Ulgowy: uczniowie i studenci do lat<select onchange="ACT.tkPolicy('stud', +this.value)">${opt(16, 26, p.stud)}</select></label>
      <label class="fld">Ulgowy: seniorzy od lat<select onchange="ACT.tkPolicy('senior', +this.value)">${opt(60, 70, p.senior, [[99, 'brak ulgi']])}</select></label></div>
    <div class="small">Widownia według kategorii (przy cenach wyjściowych): normalny <b>${pctTxt(mix.N / tot)}</b> · ulgowy <b>${pctTxt(mix.U / tot)}</b> · dziecięcy <b>${pctTxt(mix.D / tot)}</b> · rodziny (2+2) <b>${pctTxt(mix.FAM / tot)}</b> · bezpłatnie <b>${pctTxt(mix.F0 / tot)}</b></div>
    <p class="small muted">Ulgowy przysługuje też osobom z niepełnosprawnością. Dzieci poniżej 13 lat wchodzą tylko pod opieką dorosłego (ustawa o bezpieczeństwie imprez masowych). Szerszy wstęp bezpłatny i tańsze bilety dziecięce zmniejszają dziś wpływy, ale przyciągają rodziny i budują bazę kibiców na kolejne sezony.</p></div>`;
}
function ticketsPage(c, arg) {
  const lists = priceLists(c);
  const key = lists.some(l => l.key === arg) ? arg : 'RS';
  const L = lists.find(l => l.key === key), meta = eventMeta(c, key);
  const P = priceTable(c, key), D0 = defaultTable(c, key);
  const g = gateForecast(c, key), g0 = (() => { const keep = c.tickets.prices[key]; delete c.tickets.prices[key]; const r = gateForecast(c, key); if (keep) c.tickets.prices[key] = keep; return r; })();
  const played = L.ev && L.ev.played;
  const noChild = c.tickets.policy.child <= c.tickets.policy.free;
  const cell = (s, cat) => { const v = (P[s.id] || {})[cat] || 0, d = (D0[s.id] || {})[cat] || 0;
    if (cat === 'D' && noChild) return '<td class="num muted small" title="Brak biletu dziecięcego – próg ustawisz w kategoriach biletów">—</td>';
    if (cat === 'R' && !v && !d && s.kind !== 'family') return `<td class="num"><input type="number" min="0" step="5" value="" placeholder="—" title="Bilet rodzinny 2 dorosłych + 2 dzieci; puste = niedostępny" style="width:74px" ${played ? 'disabled' : ''} onchange="ACT.tkPrice('${key}','${s.id}','${cat}',this.value)"></td>`;
    return `<td class="num"><input type="number" min="0" step="${v >= 20 ? 5 : 1}" value="${v}" title="wyjściowo ${fmtMoney(d)}" style="width:74px${v !== d ? ';border-color:var(--accent)' : ''}" ${played ? 'disabled' : ''} onchange="ACT.tkPrice('${key}','${s.id}','${cat}',this.value)"></td>`; };
  const rows = c.stadium.sectors.map(s => { const x = g.sectors[s.id];
    return `<tr><td><b>${esc(s.name)}</b><div class="small muted">${esc(SECTOR_KINDS[s.kind].name)}${s.covered ? ' · kryty' : ''}</div></td><td class="num">${fmtNum(s.seats)}</td>${CAT_KEYS.map(k => cell(s, k)).join('')}
      <td class="num">${fmtNum(x.n)}<div class="small muted">${pctTxt(x.n / s.seats)}${x.h ? ` · karnety ${fmtNum(x.h)}` : ''}</div></td><td style="width:90px">${bar(x.n, s.seats)}</td><td class="num">${fmtMoney(x.rev, true)}</td></tr>`; }).join('');
  const dAtt = g.att - g0.att, dRev = g.rev - g0.rev;
  const sel = `<div class="tk-lists">${lists.map(l => `<a class="save-item ${l.key === key ? 'active' : ''}" href="#/klub/bilety/${encodeURIComponent(l.key)}"><div class="grow"><b>${esc(l.name)}</b>${customised(c, l.key) ? ' <span class="pill">własny cennik</span>' : ''}<div class="small muted">${esc(l.sub)}</div></div></a>`).join('')}</div>`;
  return `<div class="grid g-side"><div class="stack">
      <div class="panel flush"><div class="ph"><h3>Cennik: ${esc(L.name)}</h3><span class="small muted">${esc(L.sub)}</span></div>
        ${played ? '<div class="reply" style="margin:8px 14px">Zawody już się odbyły – cennik tylko do wglądu.</div>' : ''}
        <div class="scroll-x"><table class="t"><thead><tr><th>Sektor</th><th class="num">Miejsca</th>${CAT_KEYS.map(k => `<th class="num">${TICKET_CATS[k]}</th>`).join('')}<th class="num">Prognoza widzów</th><th></th><th class="num">Wpływy</th></tr></thead><tbody>${rows}
          <tr class="tot"><td>Razem</td><td class="num">${fmtNum(c.stadium.capacity)}</td><td colspan="4" class="small muted">${g.cats.F0 ? `+ ${fmtNum(g.cats.F0)} dzieci z wolnym wstępem` : ''}</td><td class="num"><b>${fmtNum(g.att)}</b><div class="small muted">${pctTxt(g.fill)}</div></td><td></td><td class="num"><b>${fmtMoney(g.rev, true)}</b></td></tr></tbody></table></div></div>
      <div class="stat-tiles">
        <div class="tile"><div class="k">Prognoza widzów</div><div class="v">${fmtNum(g.att)}</div><div class="s ${dAtt < 0 ? 'neg' : dAtt > 0 ? 'pos' : ''}">${dAtt ? `${dAtt > 0 ? '+' : ''}${fmtNum(dAtt)} wobec cennika wyjściowego` : 'jak przy cenniku wyjściowym'}</div></div>
        <div class="tile"><div class="k">Wpływy z biletów</div><div class="v">${fmtMoney(g.rev, true)}</div><div class="s ${dRev < 0 ? 'neg' : dRev > 0 ? 'pos' : ''}">${dRev ? `${dRev > 0 ? '+' : ''}${fmtMoney(dRev, true)} wobec wyjściowego` : 'jak przy cenniku wyjściowym'}</div></div>
        <div class="tile"><div class="k">Średnia cena</div><div class="v">${fmtMoney(g.rev / Math.max(1, g.att - g.holders - g.cats.F0))}</div><div class="s">bilet jednorazowy</div></div>
        <div class="tile"><div class="k">Ceny wobec wyjściowych</div><div class="v">${pctTxt(g.idx)}</div><div class="s">wpływ na bazę kibiców po sezonie</div></div></div>
      <div class="panel"><div class="row wrap">
        <label class="fld">Wszystkie ceny<select id="tk-mult">${[0.5, 0.75, 0.8, 0.9, 1.1, 1.2, 1.25, 1.5, 2].map(m => `<option value="${m}" ${m === 1.1 ? 'selected' : ''}>×${String(m).replace('.', ',')}</option>`).join('')}</select></label>
        <button class="btn sm" ${played ? 'disabled' : ''} onclick="ACT.tkScale('${key}', +$('#tk-mult').value)">Przelicz</button>
        <button class="btn sm" ${played ? 'disabled' : ''} onclick="ACT.tkFree('${key}')">Wstęp wolny</button>
        <button class="btn sm ghost" ${played || !customised(c, key) ? 'disabled' : ''} onclick="ACT.tkReset('${key}')">Cennik wyjściowy</button></div>
        <p class="small muted">Prognoza dla typowego rywala przy dobrej pogodzie${key === 'RS' ? ', z posiadaczami karnetów (zajmują miejsca, nie kupują biletów)' : ''}. ${meta && meta.league && key !== 'RS' ? `Cennik wyjściowy: ${String(meta.ref).replace('.', ',')} × cennik rundy zasadniczej. ` : ''}${meta && meta.cls ? `Organizacja: ${fmtMoney(EVENT_CLASSES[meta.cls].org + (EVENT_CLASSES[meta.cls].fee || 0), true)}${EVENT_CLASSES[meta.cls].fee ? ' (w tym opłata licencyjna promotora)' : ''}. ` : ''}Bilet rodzinny 2+2 (dwoje dorosłych i dwoje dzieci) kupują rodziny, gdy jest tańszy niż cztery bilety osobno; puste pole = wariant niedostępny w sektorze. Deszcz zmniejsza popyt na sektory bez dachu.</p></div>
      ${policyPanel(c)}</div>
    <div class="panel stack"><h3>Cenniki zawodów</h3><p class="small muted">Osobny cennik dla meczów play-off, finału, baraży i każdych zawodów rozgrywanych w tym sezonie na naszym stadionie. Bez zmian obowiązuje cennik wyjściowy (dla zawodów młodzieżowych i adeptów – wstęp wolny).</p>${sel}</div></div>`;
}

// ---------- Karnety ----------
function seasonTicketsPage(c) {
  const T = c.tickets, Sfy = sportSeason(), sold = c.fin.karnety[Sfy] && !c.fin.karnety[Sfy].est && c.fin.karnety[Sfy].by;
  const S = sold ? Sfy + 1 : Sfy;
  const K = seasonTable(c, S), K0 = defaultSeasonTable(c, S), P = priceTable(c, 'RS'), n = homeRsCount(c, S);
  const fc = karnetSales(c, S), cur = sold ? c.fin.karnety[Sfy] : null;
  const noChild = T.policy.child <= T.policy.free;
  const cell = (s, cat) => { const v = (K[s.id] || {})[cat] || 0, d = (K0[s.id] || {})[cat] || 0;
    if (cat === 'D' && noChild) return '<td class="num muted small" title="Brak biletu dziecięcego">—</td>';
    return `<td class="num"><input type="number" min="0" step="5" value="${v || ''}" placeholder="—" title="wyjściowo ${d ? fmtMoney(d) : 'brak'}" style="width:80px${v !== d ? ';border-color:var(--accent)' : ''}" onchange="ACT.kpPrice('${s.id}','${cat}',this.value)"></td>`; };
  const rows = c.stadium.sectors.filter(s => s.kind !== 'away').map(s => { const h = fc.by[s.id] || {}, k = K[s.id] || {}, p = P[s.id] || {};
    const save = k.N && p.N ? 1 - k.N / (n * p.N) : null;
    return `<tr><td><b>${esc(s.name)}</b><div class="small muted">${fmtNum(s.seats)} miejsc</div></td>${CAT_KEYS.map(cat => cell(s, cat)).join('')}
      <td class="num">${save != null ? `<span class="${save < 0 ? 'neg' : ''}">${pctTxt(save)}</span>` : '—'}</td><td class="num">${fmtNum((h.N || 0) + (h.U || 0) + (h.D || 0) + (h.R || 0) * 4)}${h.R ? `<div class="small muted">w tym ${fmtNum(h.R)} rodzinnych</div>` : ''}</td>
      <td class="num">${fmtMoney(((h.N || 0) * (k.N || 0) + (h.U || 0) * (k.U || 0) + (h.D || 0) * (k.D || 0) + (h.R || 0) * (k.R || 0)) * (1 - T.opts.loyal * 0.6), true)}</td></tr>`; }).join('');
  const o = T.opts;
  const soldRows = cur ? c.stadium.sectors.filter(s => cur.by[s.id]).map(s => { const h = cur.by[s.id]; const t = h.N + h.U + h.D + h.R * 4; return t ? `<tr><td>${esc(s.name)}</td><td class="num">${fmtNum(h.N)}</td><td class="num">${fmtNum(h.U)}</td><td class="num">${fmtNum(h.D)}</td><td class="num">${fmtNum(h.R)}</td><td class="num"><b>${fmtNum(t)}</b></td></tr>` : ''; }).join('') : '';
  return `<div class="stat-tiles" style="margin-bottom:16px">
      ${cur ? `<div class="tile"><div class="k">Sprzedane na sezon ${Sfy}</div><div class="v">${fmtNum(cur.n)}</div><div class="s">${fmtMoney(cur.n * cur.price, true)}</div></div>` : ''}
      <div class="tile"><div class="k">Prognoza sezon ${S}</div><div class="v">${fmtNum(fc.n)}</div><div class="s">${pctTxt(fc.n / c.stadium.capacity)} pojemności</div></div>
      <div class="tile"><div class="k">Wpływy z karnetów ${S}</div><div class="v">${fmtMoney(fc.rev, true)}</div><div class="s">grudzień–marzec</div></div>
      <div class="tile"><div class="k">Mecze w karnecie</div><div class="v">${n}</div><div class="s">runda zasadnicza${o.youth ? ' + zawody młodzieżowe' : ''}</div></div></div>
    ${sold ? `<div class="reply" style="margin-bottom:16px">Sprzedaż karnetów na sezon ${Sfy} zakończyła się 15 grudnia. Zmiany cennika obowiązują od sezonu ${S}.</div>` : `<div class="reply counter" style="margin-bottom:16px">Liczba sprzedanych karnetów na sezon ${S} ustala się 15 grudnia (wpływy w ratach: grudzień–marzec). Do tego czasu możesz zmieniać cennik.</div>`}
    <div class="grid g-side"><div class="panel flush"><div class="ph"><h3>Cennik karnetów – sezon ${S}</h3><span class="small muted">oszczędność = ile taniej niż ${n} biletów normalnych</span></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Sektor</th>${CAT_KEYS.map(k => `<th class="num">${TICKET_CATS[k]}</th>`).join('')}<th class="num">Oszczędność</th><th class="num">Prognoza</th><th class="num">Wpływy</th></tr></thead><tbody>${rows}
        <tr class="tot"><td>Razem</td><td colspan="5"></td><td class="num"><b>${fmtNum(fc.n)}</b></td><td class="num"><b>${fmtMoney(fc.rev, true)}</b></td></tr></tbody></table></div></div>
    <div class="stack"><div class="panel stack"><h3>Warianty karnetu</h3>
      <label class="row"><input type="checkbox" ${o.youth ? 'checked' : ''} onchange="ACT.kpOpt('youth', this.checked)"> Karnet obejmuje zawody młodzieżowe (DMPJ, U24, Kaski, 500R)</label>
      <label class="row"><input type="checkbox" ${o.vipAll ? 'checked' : ''} onchange="ACT.kpOpt('vipAll', this.checked)"> Karnet VIP na wszystkie zawody klubu (play-off, finał, turnieje; bez Grand Prix)</label>
      <label class="fld">Rabat dla posiadaczy karnetu z poprzedniego sezonu<select onchange="ACT.kpOpt('loyal', +this.value)">${[0, 0.05, 0.1, 0.15, 0.2].map(v => `<option value="${v}" ${v === o.loyal ? 'selected' : ''}>${v ? pctTxt(v) : 'brak'}</option>`).join('')}</select></label>
      <label class="fld">Zniżka karnetowiczów na bilety play-off, finału i barażu<select onchange="ACT.kpOpt('poDisc', +this.value)">${[0, 0.1, 0.2, 0.3].map(v => `<option value="${v}" ${v === o.poDisc ? 'selected' : ''}>${v ? pctTxt(v) : 'brak'}</option>`).join('')}</select></label>
      <div class="row wrap"><label class="fld">Karnet = suma biletów ×<select id="kp-f">${[0.7, 0.75, 0.8, 0.85, 0.9, 1].map(v => `<option value="${v}" ${v === 0.85 ? 'selected' : ''}>${String(v).replace('.', ',')}</option>`).join('')}</select></label>
        <button class="btn sm" onclick="ACT.kpFactor(+$('#kp-f').value)">Przelicz</button><button class="btn sm ghost" ${T.season ? '' : 'disabled'} onclick="ACT.kpReset()">Cennik wyjściowy</button></div>
      <p class="small muted">Karnet opłaca się kibicom, gdy jest wyraźnie tańszy niż bilety na wszystkie mecze (w klubach: 0,75 sumy biletów w Zielonej Górze, 6 meczów w cenie 7 w Gnieźnie, bez rabatu w Rzeszowie). Karnetowicze zajmują miejsca na każdym meczu rundy zasadniczej; play-off nie jest w cenie karnetu. Karnet rodzinny: dwoje dorosłych i dwoje dzieci; puste pole = wariant niedostępny.</p></div>
      ${soldRows ? `<div class="panel flush"><div class="ph"><h3>Sprzedane karnety ${Sfy}</h3></div><table class="t compact"><thead><tr><th>Sektor</th><th class="num">N</th><th class="num">U</th><th class="num">D</th><th class="num">Rodz.</th><th class="num">Osób</th></tr></thead><tbody>${soldRows}</tbody></table></div>` : ''}</div></div>`;
}

// ---------- Frekwencja ----------
function attendancePage(c) {
  const S = sportSeason();
  const ms = Object.values(G.matches).filter(m => m.kind === 'league' && m.homeId === c.id && m.gate && m.date.startsWith(String(S)));
  const evs = Object.values(G.events).filter(e => e.gate && e.gate.hostId === c.id && e.season === S);
  const list = [...ms.map(m => ({ d: m.date, name: `${c.short} – ${G.clubs[m.awayId].short}`, sub: LEAGUE_EVENTS[m.gate.key || 'RS'].name, g: m.gate, link: `#/zawody/${m.fixtureId}` })),
    ...evs.map(e => ({ d: e.date, name: e.name, sub: EVENT_CLASSES[eventClassOf(e)].name, g: e.gate, link: `#/gp/${e.id}` }))].sort(by(x => x.d));
  const x = c.fin.gate && c.fin.gate[S];
  const k = c.fin.karnety[S];
  return `<div class="stat-tiles" style="margin-bottom:16px">
      <div class="tile"><div class="k">Średnia frekwencja (liga)</div><div class="v">${x && x.n ? fmtNum(x.att / x.n) : '—'}</div><div class="s">${x && x.n ? `${pctTxt(x.att / x.n / c.stadium.capacity)} pojemności` : 'brak meczów w sezonie'}</div></div>
      <div class="tile"><div class="k">Bilety (liga)</div><div class="v">${x ? fmtMoney(x.rev, true) : '—'}</div><div class="s">${x ? `${x.n} ${plural(x.n, 'mecz', 'mecze', 'meczów')}` : ''}</div></div>
      <div class="tile"><div class="k">Karnety</div><div class="v">${k ? fmtNum(k.n) : '—'}</div><div class="s">${k ? fmtMoney(k.n * k.price, true) : ''}</div></div>
      <div class="tile"><div class="k">Zawody na stadionie</div><div class="v">${x ? x.ev : 0}</div><div class="s">${x && x.evAtt ? `${fmtNum(x.evAtt)} widzów` : ''}</div></div>
      <div class="tile"><div class="k">Baza kibiców</div><div class="v">${fmtNum(c.fans)}</div><div class="s">popyt bazowy ${fmtNum(c.stadium.demand)}</div></div></div>
    <div class="panel flush"><div class="ph"><h3>Mecze i zawody na naszym stadionie – sezon ${S}</h3></div><div class="scroll-x"><table class="t"><thead><tr><th>Data</th><th>Zawody</th><th class="num">Widzów</th><th></th><th class="num">Karnety</th><th class="num">Dzieci</th><th class="num">Bilety</th><th class="num">Ceny</th></tr></thead><tbody>
      ${list.map(r => `<tr class="click" onclick="go('${r.link}')"><td>${fmtDateShort(r.d)}</td><td><b>${esc(r.name)}</b><div class="small muted">${esc(r.sub)}</div></td><td class="num">${fmtNum(r.g.att)}</td><td style="width:100px">${bar(r.g.att, c.stadium.capacity)}</td>
        <td class="num">${fmtNum(r.g.holders || (r.g.cats && r.g.cats.H) || 0)}</td><td class="num">${r.g.cats ? fmtNum(r.g.cats.D + r.g.cats.R / 2 + r.g.cats.F0) : '—'}</td><td class="num">${fmtMoney(r.g.rev, true)}</td><td class="num">${r.g.idx ? pctTxt(r.g.idx) : '—'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Brak rozegranych meczów i zawodów w tym sezonie.</td></tr>'}</tbody></table></div></div>
    <p class="small muted">„Ceny” – wpływy z biletów wobec cennika wyjściowego klubu przy tej samej liczbie widzów. Po sezonie baza kibiców rośnie przy przystępnych cenach i dużej liczbie dzieci i rodzin na trybunach (także na zawodach młodzieżowych), a maleje przy drogich biletach.</p>`;
}

// ---------- Akcje ----------
const myTickets = () => { const c = myClub(); stadiumInit(c); return c.tickets; };
function editTable(key) { const T = myTickets(); if (!T.prices[key]) T.prices[key] = JSON.parse(JSON.stringify(priceTable(myClub(), key))); return T.prices[key]; }
ACT.tkPrice = (key, sid, cat, v) => { const t = editTable(key); t[sid] = t[sid] || { N: 0, U: 0, D: 0, R: 0 }; t[sid][cat] = Math.max(0, Math.round(+v || 0)); changed(); };
ACT.tkScale = (key, m) => { const t = editTable(key); for (const row of Object.values(t)) for (const k of CAT_KEYS) row[k] = roundPrice(row[k] * m); changed(); };
ACT.tkFree = key => { const t = editTable(key); for (const row of Object.values(t)) for (const k of CAT_KEYS) row[k] = 0; changed(); };
ACT.tkReset = key => { delete myTickets().prices[key]; changed(); };
ACT.tkPolicy = (k, v) => { const p = myTickets().policy; p[k] = v; if (p.child < p.free) p.child = p.free; changed(); };
function editSeason() { const c = myClub(), T = myTickets(); if (!T.season) T.season = JSON.parse(JSON.stringify(seasonTable(c, sportSeason()))); return T.season; }
ACT.kpPrice = (sid, cat, v) => { const t = editSeason(); t[sid] = t[sid] || { N: 0, U: 0, D: 0, R: 0 }; t[sid][cat] = Math.max(0, Math.round(+v || 0)); changed(); };
ACT.kpOpt = (k, v) => { myTickets().opts[k] = v; changed(); };
ACT.kpReset = () => { myTickets().season = null; changed(); };
ACT.kpFactor = f => {
  const c = myClub(), t = editSeason(), P = priceTable(c, 'RS'), n = homeRsCount(c);
  for (const s of c.stadium.sectors) { if (s.kind === 'away' || !t[s.id]) continue; for (const k of CAT_KEYS) if (t[s.id][k] && P[s.id][k]) t[s.id][k] = roundPrice(P[s.id][k] * n * f); }
  changed();
};
ACT.expandSector = id => {
  const c = myClub(), cost = COSTS.seats * 1000;
  if (c.cash < cost) return toast('Brak środków.', 'bad');
  if (!expandSector(c, id)) return;
  addTx(c.id, 'inwestycje', -cost, `Rozbudowa trybun: ${sectorById(c, id).name}`);
  toast('Sektor rozbudowany o 1 000 miejsc.', 'good'); changed();
};
