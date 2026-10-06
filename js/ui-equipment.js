'use strict';
// Widoki sprzętu: park maszyn zawodnika (profil), sprzęt drużyny, park maszyn klubu, tunerzy, wybór silnika w meczu.
// Gracz i sztaby nie znają budżetu sprzętowego zawodnika – widać tylko, ile ma silników, jakich i kto je tuninguje.
// Szczegóły (moc, stan, dopasowanie) zna wyłącznie park maszyn własnego klubu.

const SPEC_LABEL = { short: 'krótkie tory', long: 'długie tory', any: 'uniwersalny' };
const driveLabel = d => (d >= 1 ? 'moment (start, przyczepny tor)' : d <= -1 ? 'prędkość (twardy, szybki tor)' : 'zbalansowany');
const tunerShort = id => tunerOf(id).name;
const eqVisible = r => r.clubId === G.clubId;
// Skrót sprzętu do list: własny zawodnik – ocena mechaników; obcy – liczba silników i główny tuner
function eqBrief(r) {
  if (eqVisible(r)) return `${Math.round(equipRating(r))}`;
  return `<span class="small">${r.equip.engines.length} · ${esc(tunerShort(r.equip.tuner))}</span>`;
}
function engineStatus(x, r) {
  if (x.away && x.away > G.date) return `<span class="pill">${x.job === 'new' ? 'nowy – odbiór' : `${JOB_LABEL[x.job] || 'u tunera'} do`} ${fmtDateShort(x.away)}</span>`;
  if (r && x.heats >= (engOwnerClub(x) ? 20 : svcLimit(r))) return '<span class="pill inj">do serwisu</span>';
  if (x.heats > 25) return '<span class="pill inj">słabnie (ponad 25 biegów)</span>';
  return '';
}

function profEquip(r) {
  const e = r.equip, mine = eqVisible(r);
  const engines = e.engines.slice().sort(by(x => (engReady(x) ? 0 : 1000) - engineValue(x, r)));
  const tuners = TUNER_DB.reduce((m, t) => { const n = e.engines.filter(x => tunerOf(x.tuner).id === t.id).length; if (n) m.push(`${esc(tunerName(t.id))} – ${n}`); return m; }, []);
  if (!mine) {
    return `<div class="grid g-side"><div class="panel flush"><div class="ph"><h3>Silniki (${e.engines.length})</h3></div>
      ${engines.map(x => `<div class="engine"><div class="ico ${x.brand === 'Jawa' ? 'jawa' : 'gm'}">${x.brand}</div><div><b>${x.brand}</b> ${snLink(x)}<div class="small muted">Tuner: ${esc(tunerName(x.tuner))} · rocznik ${x.born}</div></div><div></div><div></div><div></div></div>`).join('')}</div>
      <div class="stack"><div class="panel"><h3>Park maszyn zawodnika</h3><div class="kv"><div>Główny tuner</div><div><a href="#/park/tunerzy">${esc(tunerName(e.tuner))}</a>${e.since != null ? ` <span class="small muted">od sezonu ${e.since}</span>` : ''}</div><div>Silniki</div><div>${e.engines.length}</div><div>Tunerzy</div><div class="small">${tuners.join('<br>')}</div><div>Mechanicy</div><div>${e.mechanics}</div><div>Bus serwisowy</div><div>${e.van ? 'tak' : 'nie'}</div></div></div>
      <div class="panel small muted">Moc, stan i przygotowanie silników zna tylko zespół zawodnika i park maszyn jego klubu. Ile zawodnik wydaje na sprzęt – nie wiadomo.</div></div></div>`;
  }
  const opts = tunersForClubOrder(r);
  const sel = UI.buyTuner && opts.some(t => t.id === UI.buyTuner) ? UI.buyTuner : (opts.find(t => t.id === e.tuner) || opts[0] || TUNER.gm).id;
  const T = tunerOf(sel);
  return `<div class="grid g-side"><div class="panel flush"><div class="ph"><h3>Silniki (${e.engines.length})</h3></div>
      ${engines.map((x, i) => `<div class="engine"><div class="ico ${x.brand === 'Jawa' ? 'jawa' : 'gm'}">${x.brand}</div>
        <div><b>Silnik nr ${x.id}</b> ${snLink(x)} ${i < 2 && engReady(x) ? '<span class="pill ok">podstawowy</span>' : ''}${engOwnerClub(x) ? ' <span class="pill">klubowy</span>' : ''} ${engineStatus(x, r)}
          <div class="small muted">Tuner: ${esc(tunerName(x.tuner))}${x.shop ? ` · serwis w tym sezonie: ${esc(tunerName(x.shop))}` : ''} · ${SPEC_LABEL[x.spec] || 'uniwersalny'} · ${driveLabel(x.drive)}</div>
          <div class="small muted">${x.heats} biegów od serwisu (zawodnik serwisuje co ok. ${engOwnerClub(x) ? 20 : svcLimit(r)}) · ${Math.max(0, (x.lifeMax || 100) - (x.life || 0))} do remontu kapitalnego · dopasowanie ${Math.round(x.feel ?? 60)}% · rocznik ${x.born}</div></div>
        <div><div class="small muted">Moc (ocena mechaników)</div><b>${Math.round(x.q)}</b></div><div><div class="small muted">Stan ${Math.round(x.cond)}%</div>${bar(x.cond)}</div>
        <div><button class="btn sm" onclick="ACT.arm(this, 'service', ${r.id}, ${x.id})" ${!engReady(x) || (x.cond >= 99 && x.heats < 3) ? 'disabled' : ''}>Przegląd na koszt klubu ${fmtMoney(shopOf(x).service, true)}</button></div></div>`).join('')}</div>
    <div class="stack"><div class="panel"><h3>Park maszyn zawodnika</h3><div class="kv"><div>Ocena sprzętu</div><div>${Math.round(equipRating(r))} / 100</div><div>Główny tuner</div><div><a href="#/park/tunerzy">${esc(tunerName(e.tuner))}</a>${e.since != null ? ` <span class="small muted">od sezonu ${e.since}</span>` : ''}</div><div>Sprawne silniki</div><div>${e.engines.filter(x => engReady(x)).length} / ${e.engines.length}</div><div>Ramy</div><div>${e.frames}${(e.frameRep || []).filter(u => u > G.date).length ? ` <span class="small neg">(w naprawie: ${(e.frameRep || []).filter(u => u > G.date).length})</span>` : ''}</div>
      <div>Mechanicy</div><div>${e.mechanics}${usesClubMech(r) ? ' <span class="small muted">+ mechanicy klubu</span>' : ''}</div><div>Bus serwisowy</div><div>${e.van ? 'tak' : 'nie'}</div><div>Wsparcie sprzętowe klubu</div><div>${fmtMoney(e.clubSupport)}</div></div></div>
      <div class="panel"><h3>Silnik na koszt klubu</h3>
        ${opts.length ? `<div class="row wrap"><select onchange="UI.buyTuner=this.value;render()">${opts.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(tunerName(t.id))} – ${fmtMoney(t.engine, true)}</option>`).join('')}</select>
          <button class="btn primary" onclick="ACT.arm(this, 'buyEngine', ${r.id}, '${sel}')" ${tunerCanBuild(sel) ? '' : 'disabled'}>${tunerCanBuild(sel) ? `Zamów (${fmtMoney(T.engine, true)})` : 'Komplet zamówień na ten sezon'}</button></div>
          <p class="small muted">Silnik pozostaje własnością klubu – po odejściu zawodnika wraca do parku maszyn. Przeglądy takiego silnika opłaca klub. Nowy silnik trzeba rozjeździć (dopasowanie rośnie z każdym biegiem i na treningach przedsezonowych).</p>`
          : '<p class="small muted">Żaden renomowany tuner nie ma teraz wolnego miejsca dla tego zawodnika.</p>'}</div>
      <div class="panel small muted">Przed każdym biegiem zawodnik wybiera silnik pod tor i nawierzchnię (trafność zależy od Dopasowania sprzętu); w meczu możesz wskazać silnik sam. Po defekcie albo upadku motocykl bywa wyłączony do końca zawodów, a poważna awaria oznacza remont u tunera.</div></div></div>`;
}
ACT.service = (rid, eid) => { serviceEngine(rid, eid); toast('Silnik pojechał na przegląd do tunera.', 'good'); changed(); };
ACT.buyEngine = (rid, tid) => { const x = buyEngine(rid, tid); toast(`Zamówiono silnik u: ${tunerName(x.tuner)}.`, 'good'); changed(); };

function teamEquipment(rs) {
  return `<div class="panel flush"><table class="t"><thead><tr><th>Zawodnik</th><th class="num">Ocena sprzętu</th><th class="num">Sprawne / silniki</th><th>Główny tuner</th><th>Najlepszy silnik</th><th>Najsłabszy stan</th><th class="num">Do serwisu</th><th class="num">Mechanicy</th><th class="num">Wsparcie klubu</th></tr></thead><tbody>
    ${rs.map(r => { const e = r.equip, ready = e.engines.filter(x => engReady(x)), best = ready.slice().sort(by(x => engineValue(x, r), -1))[0], worst = e.engines.slice().sort(by(x => x.cond))[0], late = e.engines.filter(x => x.heats >= svcLimit(r)).length;
      return `<tr class="click" onclick="go('#/park/zawodnik/${r.id}')"><td><b>${esc(r.name)}</b></td><td class="num"><b>${Math.round(equipRating(r))}</b></td><td class="num">${ready.length} / ${e.engines.length}</td><td>${esc(tunerName(e.tuner))}</td><td>${best ? `${best.brand} nr ${best.id} · ${esc(tunerShort(best.tuner))} (${Math.round(best.q)})` : '—'}</td>
      <td style="width:130px">${worst ? bar(worst.cond) : ''}</td><td class="num ${late ? 'neg' : ''}">${late || ''}</td><td class="num">${e.mechanics}</td><td class="num">${fmtMoney(e.clubSupport, true)}</td></tr>`; }).join('')}</tbody></table></div>`;
}

// ---------- Klub: park maszyn i tunerzy ----------
function parkPage(c) {
  const rs = clubRiders(c.id), fleet = c.park.clubEngines || [], mq = clubMechQ(c.id);
  const heads = clubStaff(c.id).filter(x => x.role === 'mechanic');
  return `<div class="grid g2"><div class="stack"><div class="panel"><h3>Park maszyn</h3><div class="kv"><div>Poziom warsztatu</div><div>${c.facilities.workshop} / 5</div><div>Boksy</div><div>${c.park.boxes}</div><div>Hamownia</div><div>${c.park.dyno ? 'tak' : 'nie'}</div><div>Obiekty treningowe</div><div>${c.facilities.training} / 5</div>
      <div>Kierownik parku maszyn</div><div>${heads.map(x => `<a href="#/osoba/${x.id}">${esc(x.name)}</a> (technika ${x.attrs.tech})`).join(', ') || '<span class="neg">brak</span>'}</div>
      <div>Mechanicy klubowi</div><div>${c.park.mechanics} <button class="btn sm" onclick="ACT.arm(this, 'mech', 1)" ${c.park.mechanics >= 6 ? 'disabled' : ''}>Zatrudnij (${fmtMoney(MECH_COST, true)}/rok)</button> <button class="btn sm" onclick="ACT.arm(this, 'mech', -1)" ${c.park.mechanics <= (c.park.baseMech ?? 1) ? 'disabled' : ''}>Zwolnij dodatkowego</button></div>
      <div>Jakość obsługi</div><div><b>${mq.toFixed(1)}</b> / 20 ${bar(mq * 5)}</div></div>
      <div class="row wrap" style="margin-top:14px"><button class="btn" onclick="ACT.arm(this, 'upgrade', 'workshop')" ${c.facilities.workshop >= 5 ? 'disabled' : ''}>Rozbuduj warsztat (${fmtMoney(COSTS.workshop(c.facilities.workshop), true)})</button><button class="btn" onclick="ACT.arm(this, 'upgrade', 'training')" ${c.facilities.training >= 5 ? 'disabled' : ''}>Obiekty treningowe (${fmtMoney(COSTS.training(c.facilities.training), true)})</button>${!c.park.dyno ? `<button class="btn" onclick="ACT.dyno()">Hamownia (${fmtMoney(250000, true)})</button>` : ''}</div>
      <p class="small muted">Mechanicy klubowi ustawiają motocykle pod domowy tor (premia dla wszystkich na własnym stadionie), obsługują juniorów i zawodników bez własnego zespołu (także na wyjazdach), szybciej naprawiają maszyny po defekcie i upadku w trakcie zawodów. Jakość zależy od kierownika parku maszyn, liczby mechaników i warsztatu.</p></div>
    <div class="panel flush"><div class="ph"><h3>Silniki klubowe w parku maszyn (${fleet.length})</h3></div>
      ${fleet.length ? `<table class="t"><thead><tr><th>Silnik</th><th>Tuner</th><th class="num">Moc</th><th>Stan</th><th>Przydziel</th></tr></thead><tbody>${fleet.map((x, i) => `<tr><td>${snLink(x)} · rocznik ${x.born}</td><td>${esc(tunerName(x.tuner))}</td><td class="num">${Math.round(x.q)}</td><td style="width:110px">${bar(x.cond)}</td>
        <td><select onchange="if(this.value)ACT.fleetAssign(${i},+this.value)"><option value="">— zawodnik —</option>${rs.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select> <button class="btn sm" onclick="ACT.arm(this, 'fleetSell', ${i})">Sprzedaj</button></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty small">Brak. Silniki kupione przez klub dla zawodników wracają tu po ich odejściu; w razie braku sprawnej maszyny zawodnik dostaje motocykl z parku.</div>'}</div></div>
    </div>`;
}
ACT.mech = d => { const c = myClub(); c.park.mechanics = clamp(c.park.mechanics + d, 1, 6); toast(d > 0 ? 'Zatrudniono mechanika.' : 'Zwolniono mechanika.', 'good'); changed(); };
ACT.fleetAssign = (i, rid) => {
  const c = myClub(), x = c.park.clubEngines.splice(i, 1)[0], r = G.riders[rid];
  if (!x || !r) return;
  x.id = Math.max(0, ...r.equip.engines.map(e => e.id)) + 1; x.club = c.id; x.feel = Math.min(x.feel ?? 40, 40);
  r.equip.engines.push(x); engLog(x, 'T', `r${r.id}`);
  toast(`Silnik z parku maszyn przydzielony: ${r.name}.`, 'good'); changed();
};

function tunersPage() {
  const all = Object.values(G.riders).filter(r => r.active && !r.retired && r.equip);
  const cl = {};
  for (const r of all) (cl[r.equip.tuner] = cl[r.equip.tuner] || []).push(r);
  const rumor = t => { if (t.generic) return ''; const f = tunerForm(t.id), l = tunerLead(t.id), out = [];
    if (l >= 1.5) out.push('<span class="pos">nowa specyfikacja – przewaga technologiczna</span>'); else if (l <= -1.5) out.push('<span class="neg">technologicznie w tyle</span>');
    out.push(f >= 1.5 ? '<span class="pos">silniki chwalone w tym sezonie</span>' : f <= -1.5 ? '<span class="neg">słychać narzekania na prędkość</span>' : l > -1.5 && l < 1.5 ? '<span class="muted">bez sygnałów</span>' : '');
    return out.filter(Boolean).join('<br>'); };
  return `<div class="panel flush"><table class="t"><thead><tr><th>Tuner</th><th>Kraj</th><th>Renoma</th><th class="num">Klienci</th><th class="num">Nowe silniki</th><th class="num">Remonty zimą</th><th>Znani klienci</th><th class="num">Silnik</th><th class="num">Przegląd</th><th>Opinie w środowisku</th></tr></thead><tbody>
    ${TUNER_DB.map(t => { const rs = (cl[t.id] || []).sort(by(r => r.skill, -1)), free = t.generic || rs.length < t.cap;
      return `<tr><td><b>${esc(t.name)}</b>${t.shop ? `<div class="small muted">${esc(t.shop)}</div>` : ''}</td><td>${t.country ? flag(t.country) : '—'}</td><td class="small">${esc(t.rep)}</td>
        <td class="num">${rs.length}${t.generic ? '' : ` / ${t.cap}`} ${t.generic ? '' : free ? '<span class="pill ok">wolne miejsca</span>' : '<span class="pill">komplet</span>'}</td>
        <td class="num">${t.generic ? '—' : `${tunerBuilt(t.id)} / ${t.engCap}`}</td><td class="num">${t.generic ? '—' : `${tunerOvh(t.id)} / ${t.ovhCap}`}</td>
        <td class="small">${rs.slice(0, 5).map(r => `<a href="#/zawodnik/${r.id}">${esc(r.name)}</a>`).join(', ')}${rs.length > 5 ? ` i ${rs.length - 5} innych` : ''}</td>
        <td class="num">${fmtMoney(t.engine, true)}</td><td class="num">${fmtMoney(t.service, true)}</td><td class="small">${rumor(t)}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="small muted" style="margin-top:12px">Lista tunerów i współprace na start gry według doniesień prasowych z lat 2025–2026 (data/equipment/TUNERZY-2025-26.md); część zawodników ma silniki od kilku tunerów. Moce przerobowe według wypowiedzi tunerów: Ash-Tech (4 osoby) – 55 nowych silników i 60–70 remontów zimowych, 2–3 przeglądy dziennie, ok. 35 klientów; RK Racing – ok. 40 silników w sezonie. Silnik od tunera ok. 30 tys. zł, przegląd 5–8 tys. zł co ok. 3 mecze, remont kapitalny po ok. 100 biegach. Pozostałe liczby to założenia gry. W klasycznym żużlu jeździ się na silnikach GM (Jawa wycofała się, fabryka w Divišovie zamknięta w 2024), Graversen buduje własne FGM.</p>
    <p class="small muted">Współpraca z tunerem trwa zwykle latami: stali klienci mają pierwszeństwo w kolejce do warsztatu i dostają lepsze egzemplarze, a do czołowych warsztatów trudno się dostać. Zmiana tunera to ryzyko – pierwsze silniki nowego warsztatu bywają trafione albo chybione i trzeba je rozjeździć. Zawodnicy decydują zimą; liczą się renoma zawodnika, wolne miejsca, forma warsztatu i pieniądze przeznaczane na sprzęt (nieznane klubom). Silniki Ash-Tech słabiej spisują się w upale, lepiej w chłodzie.</p>`;
}

// ---------- Mecz: wybór silnika na bieg ----------
function matchEnginePicker(m, entries, mineTeam) {
  const mine = entries.filter(e => e.team === mineTeam && e.riderId && G.riders[e.riderId]);
  if (!mine.length) return '';
  m.engPick = m.engPick || {};
  return `<div class="row wrap" style="margin-top:10px"><b>Silniki</b> <span class="small muted">(wybór obowiązuje do zmiany; „wybór zawodnika” – zawodnik dobiera sam pod tor i warunki)</span>
    ${mine.map(e => { const r = G.riders[e.riderId], all = usableEngines(r, m.id), cur = m.engPick[r.id];
      // w zawodach: tylko motocykle zawodnika (A/B w boksie, zapasowy po wyłączeniu); przed pierwszym startem – silniki, z których przygotuje A i B
      const bk = typeof meetBikes === 'function' ? meetBikes(m.id, r.id).filter(b => !b.out) : [], list = bk.length ? bk.map(b => all.find(x => x.id === b.eng)).filter(Boolean) : all;
      const lt = x => (bk.find(b => b.eng === x.id) || {}).l;
      return `<label class="small">${esc(r.name)} <select onchange="ACT.engPick('${m.id}', ${r.id}, this.value)"><option value="">wybór zawodnika</option>${list.map(x => `<option value="${x.id}" ${cur === x.id ? 'selected' : ''}>${lt(x) ? `motocykl ${lt(x)} – ` : ''}nr ${x.id} · ${esc(tunerShort(x.tuner))} · ${Math.round(x.q)}/${Math.round(x.cond)}% · ${SPEC_LABEL[x.spec]}</option>`).join('')}</select></label>`; }).join('')}</div>`;
}
ACT.engPick = (mid, rid, v) => { const m = G.matches[mid] || (typeof sparMatchById === 'function' && sparMatchById(mid)); if (!m) return; m.engPick = m.engPick || {}; if (v) m.engPick[rid] = Number(v); else delete m.engPick[rid]; };
// Motocykl w biegu (A/B/C – jak w transmisjach TV); silnik i warsztat w podpowiedzi
const bikeBadge = e => e && e.bike ? `<span class="bike-tag" title="${e.bike === 'P' ? 'motocykl pożyczony' : `motocykl ${e.bike}`}${e.eng ? ` – ${esc(e.eng.temp ? 'pożyczony' : `${e.eng.brand} nr ${e.eng.id}, ${tunerShort(e.eng.tuner)}`)}` : ''}">${e.bike}</span>` : '';
const heatEngineNote = e => e.eng ? `${bikeBadge(e)}<span class="small muted"> ·${e.eng.temp ? 'pożyczony motocykl' : `${e.eng.brand} nr ${e.eng.id}${e.eng.lent ? ' (park klubu)' : ''}, ${esc(tunerShort(e.eng.tuner))}`}</span>` : '';

// ---------- Rejestr silników: karta silnika i rynek wtórny (js/engine-registry.js) ----------
const snLink = x => x && x.sn ? `<a href="#/silnik/${encodeURIComponent(x.sn)}" onclick="event.stopPropagation()">${esc(x.sn)}</a>` : '';
function refLabel(ref) {
  if (!ref) return '—';
  const id = Number(ref.slice(1));
  if (ref[0] === 'r' && G.riders[id]) return `<a href="#/zawodnik/${id}">${esc(G.riders[id].name)}</a>`;
  if (ref[0] === 'c' && G.clubs[id]) return `park maszyn: ${esc(G.clubs[id].short || G.clubs[id].name)}`;
  return '—';
}
const refMine = ref => !!ref && ((ref[0] === 'c' && Number(ref.slice(1)) === G.clubId) || (ref[0] === 'r' && G.riders[Number(ref.slice(1))] && G.riders[Number(ref.slice(1))].clubId === G.clubId));
// Szacunek mocy cudzego silnika przez park maszyn klubu: im lepsi mechanicy, tym węższy zakres
function powerGuess(x) {
  const err = Math.max(1, Math.round((22 - clubMechQ(G.clubId)) / 3)), mid = x.q + (hrand(x.sn + '|' + G.clubId) - 0.5) * err;
  return `${Math.round(mid - err)}–${Math.round(mid + err)}`;
}
const HIST_TXT = {
  B: h => `Zbudowany w warsztacie ${esc(tunerName(h[2]))}${h[3] ? ` dla: ${refLabel(h[3])}` : ''}`,
  P: h => `Nowy właściciel: ${refLabel(h[2])}${refMine(h[2]) ? ` (cena ${fmtMoney(h[3], true)})` : ''}`,
  M: h => `Wystawiony na sprzedaż przez: ${refLabel(h[2])} – cena wywoławcza ${fmtMoney(h[3], true)}`,
  O: h => `Remont zimowy: ${esc(tunerName(h[2]))}`, K: h => `Remont kapitalny: ${esc(tunerName(h[2]))}`, R: h => `Naprawa po awarii: ${esc(tunerName(h[2]))}`,
  T: h => `Przekazany: ${refLabel(h[2])}`, E: () => 'Sprzedany za granicę (niższe ligi)', X: () => 'Wycofany z eksploatacji (części, złom)',
};
const engRepairs = x => (x.hist || []).filter(h => 'OKR'.includes(h[1]));
PAGES.silnik = parts => {
  const sn = parts[0] || '', f = findEngine(sn);
  if (!f) return { title: `Silnik ${esc(sn)}`, body: '<div class="panel empty">Silnik wycofany z eksploatacji albo sprzedany za granicę – brak w rejestrze.</div>' };
  const x = f.x, mine = (f.rider && f.rider.clubId === G.clubId) || (f.club && f.club.id === G.clubId);
  const where = f.rider ? `<a href="#/park/zawodnik/${f.rider.id}">${esc(f.rider.name)}</a>${engOwnerClub(x) ? ` (silnik klubu ${esc(G.clubs[engOwnerClub(x)].short)})` : ''}` : f.club ? `park maszyn: ${esc(f.club.name)}` : `rynek wtórny – ${fmtMoney(f.market.price, true)}`;
  const keys = [...new Set([...Object.keys(x.use || {}), ...Object.keys(x.tr || {})])];
  const use = keys.map(k => { const [s, id] = k.split('|'); const u = (x.use || {})[k] || 0; return { s, r: G.riders[isNaN(id) ? id : Number(id)], h: Array.isArray(u) ? u[0] : u, t: (x.tr || {})[k] || 0 }; }).sort(by(o => o.s, -1));
  const rep = engRepairs(x);
  return { title: `Silnik ${esc(x.sn)}`, sub: `${x.brand} · ${esc(tunerName(x.tuner))} · rocznik ${x.born}`, body: `<div class="grid g-side"><div class="stack">
    <div class="panel flush"><div class="ph"><h3>Przebieg</h3></div>${use.length ? `<table class="t"><thead><tr><th>Sezon</th><th>Zawodnik</th><th class="num">Biegi w zawodach</th><th class="num">Biegi treningowe</th></tr></thead><tbody>
      ${use.map(o => `<tr><td>${o.s}</td><td>${o.r ? `<a href="#/zawodnik/${o.r.id}">${esc(o.r.name)}</a>` : '—'}</td><td class="num">${o.h}</td><td class="num">${o.t}</td></tr>`).join('')}</tbody></table>` : '<div class="empty small">Brak zapisanych startów (silnik sprzed rejestru albo jeszcze nieużywany).</div>'}</div>
    <div class="panel flush"><div class="ph"><h3>Historia: remonty, właściciele</h3></div><table class="t"><tbody>${(x.hist || []).slice().reverse().map(h => `<tr><td style="width:110px">${fmtDateShort(h[0])}</td><td>${(HIST_TXT[h[1]] || (() => h[1]))(h)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="stack"><div class="panel"><h3>Silnik</h3><div class="kv"><div>Numer</div><div><b>${esc(x.sn)}</b></div><div>Tuner</div><div><a href="#/park/tunerzy">${esc(tunerName(x.tuner))}</a></div><div>Rocznik</div><div>${x.born}</div>
      <div>Obecnie</div><div>${where}</div><div>Biegi łącznie</div><div>${engHeatsTotal(x)}</div><div>Od remontu kapitalnego</div><div>${x.life || 0} biegów (kolejny za ok. ${Math.max(0, (x.lifeMax || 100) - (x.life || 0))})</div>
      <div>Remonty</div><div>${rep.filter(h => h[1] === 'O').length} zimowe · ${rep.filter(h => h[1] === 'K').length} kapitalne · ${rep.filter(h => h[1] === 'R').length} po awariach</div>
      ${mine ? `<div>Moc (ocena mechaników)</div><div><b>${Math.round(x.q)}</b></div><div>Stan</div><div>${bar(x.cond)}</div>` : f.market ? `<div>Moc (szacunek naszych mechaników)</div><div>${powerGuess(x)}</div><div>Stan</div><div>${Math.round(x.cond)}%</div>` : ''}</div></div>
      <div class="panel small muted">Każdy silnik ma numer seryjny (kod warsztatu, rocznik, numer) i kartę: kto go zbudował, kto na nim jeździł i ile biegów przejechał, remonty zimowe, kapitalne i naprawy po awariach, zmiany właściciela. Moc i stan znają tylko mechanicy właściciela; przy zakupie na rynku wtórnym widać szacunek naszego parku maszyn.</div></div></div>` };
};
function usedMarketPage(c) {
  const list = (G.used || []).map((L, i) => ({ L, i })).sort(by(o => o.L.price, -1));
  const rs = clubRiders(c.id);
  return `<div class="panel flush"><div class="ph"><h3>Rynek wtórny silników (${list.length})</h3></div>${list.length ? `<table class="t"><thead><tr><th>Silnik</th><th>Tuner</th><th class="num">Rocznik</th><th>Jeździli</th><th class="num">Biegi</th><th class="num">Od kapitalnego</th><th class="num">Remonty</th><th class="num">Moc (szacunek)</th><th>Stan</th><th class="num">Cena</th><th>Kup dla</th></tr></thead><tbody>
    ${list.slice(0, 200).map(({ L, i }) => { const x = L.x, own = engOwners(x), rep = engRepairs(x);
      return `<tr><td>${snLink(x)}</td><td class="small">${esc(tunerName(x.tuner))}</td><td class="num">${x.born}</td><td class="small">${own.slice(0, 3).map(o => `<a href="#/zawodnik/${o.id}">${esc(o.name)}</a>`).join(', ') || '—'}</td><td class="num">${engHeatsTotal(x)}</td>
        <td class="num">${x.life || 0}</td><td class="num">${rep.length}</td><td class="num">${powerGuess(x)}</td><td style="width:90px">${bar(x.cond)}</td><td class="num"><b>${fmtMoney(L.price, true)}</b></td>
        <td><select onchange="if(this.value)ACT.buyUsed('${esc(x.sn)}', this.value)"><option value="">—</option><option value="park">park maszyn klubu</option>${rs.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></td></tr>`; }).join('')}</tbody></table>` : '<div class="empty small">Rynek jest pusty – zawodnicy wystawiają silniki zimą (listopad), po przeglądzie swoich parków maszyn.</div>'}</div>
    <p class="small muted" style="margin-top:12px">Zawodnicy zimą wystawiają najstarsze i nadmiarowe silniki; kupują je zawodnicy, których nie stać na nowy albo których tuner ma komplet zamówień. Cena zależy od rocznika, stanu, przebiegu od remontu kapitalnego i rodowodu (silnik z parku maszyn czołowego zawodnika jest droższy). Moc to szacunek naszych mechaników – im lepszy park maszyn, tym dokładniejszy. Niesprzedane silniki trafiają za granicę albo na złom.</p>`;
}
ACT.buyUsed = (sn, target) => {
  const f = findEngine(sn), c = myClub();
  if (!f || !f.market) return toast('Silnik został już sprzedany.', 'bad');
  const r = target === 'park' ? null : G.riders[Number(target)];
  buyUsed(f.idx, c, r);
  toast(`Kupiono silnik ${sn}${r ? ` dla: ${r.name}` : ' do parku maszyn'}.`, 'good'); changed();
};
ACT.fleetSell = i => { const c = myClub(), x = c.park.clubEngines.splice(i, 1)[0]; if (!x) return; const p = listEngine(x, c); toast(`Silnik ${x.sn} wystawiony na sprzedaż (${fmtMoney(p, true)}).`, 'good'); changed(); };

// ---------- Sekcja „Park maszyn” (menu): zawodnicy, warsztat klubu, tunerzy, szkółka, rynek używanych ----------
const PARK_TABS = [['', 'Zawodnicy'], ['warsztat', 'Warsztat klubu'], ['tunerzy', 'Tunerzy'], ['szkolka', 'Szkółka'], ['rynek', 'Rynek używanych']];
PAGES.park = parts => {
  const sub = parts[0] || '', c = myClub();
  const T = tabs('park', PARK_TABS, sub === 'zawodnik' ? '' : sub);
  const head = { title: `${crest(c)} Park maszyn`, sub: `${esc(c.name)} · warsztat ${c.facilities.workshop}/5 · jakość obsługi ${clubMechQ(c.id).toFixed(1)}/20`, tabs: T };
  if (sub === 'zawodnik') {
    const r = G.riders[Number(parts[1])];
    if (!r) return { ...head, body: '<div class="panel empty">Brak zawodnika.</div>' };
    return { ...head, title: `Park maszyn: ${esc(r.name)}`, sub: `<a href="#/zawodnik/${r.id}">profil zawodnika</a>${r.clubId && G.clubs[r.clubId] ? ` · ${esc(G.clubs[r.clubId].name)}` : ''}`, body: profEquip(r) };
  }
  if (sub === 'warsztat') return { ...head, body: parkPage(c) };
  if (sub === 'tunerzy') return { ...head, body: tunersPage() };
  if (sub === 'szkolka') return { ...head, body: academyBikesPage(c) };
  if (sub === 'rynek') {
    const kind = parts[1] === 'szkolka' ? 'szkolka' : '';
    const sw = `<div class="row" style="margin-bottom:12px"><a class="btn ${kind ? '' : 'primary'}" href="#/park/rynek">Silniki 500 cm³</a><a class="btn ${kind ? 'primary' : ''}" href="#/park/rynek/szkolka">Motocykle szkółkowe</a></div>`;
    return { ...head, body: sw + (kind ? usedBikesPage(c) : usedMarketPage(c)) };
  }
  return { ...head, body: teamEquipment(clubRiders(c.id).sort((a, b) => b.skill - a.skill)) };
};
function academyBikesPage(c) {
  const bikes = c.park.bikes || [];
  const rows = Object.entries(ACAD_BIKE).map(([cls, d]) => {
    const kids = academyKids(c.id, cls), own = bikes.filter(b => b.cls === cls), ok = own.filter(b => b.cond >= 15).length;
    const cov = kids ? ok / kids : null;
    return `<tr><td><b>${esc(d.name)}</b><div class="small muted">${esc((ACADEMY_CATS.find(x => x.id === cls) || {}).cc || '')}</div></td><td class="num">${kids}</td><td class="num">${own.length}</td>
      <td class="num ${cov != null && cov < 0.6 ? 'neg' : cov != null && cov >= BIKE_TARGET ? 'pos' : ''}">${cov == null ? '—' : `${Math.round(cov * 100)}%`}</td><td class="num">${fmtMoney(d.price, true)}</td><td class="num">${fmtMoney(d.upkeep, true)}</td>
      <td><button class="btn sm" onclick="ACT.arm(this, 'bikeBuy', '${cls}')">Kup nowy</button> <a class="btn sm" href="#/park/rynek/szkolka">Używane</a></td></tr>`;
  }).join('');
  return `<div class="grid g2"><div class="panel flush"><div class="ph"><h3>Sprzęt szkółki według klas</h3></div><table class="t"><thead><tr><th>Klasa</th><th class="num">Adepci</th><th class="num">Motocykle</th><th class="num">Pokrycie</th><th class="num">Nowy</th><th class="num">Przegląd / rok</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <p class="small muted" style="margin:12px">Wpływ na trening techniczny adeptów: miniżużel (pit bike, 85–140) ×${academyBikeFactor(c, 'mini').toFixed(2)}, klasy 250/500R ×${academyBikeFactor(c, 'academy').toFixed(2)}. Typowe pokrycie to ok. 80% (część adeptów jeździ na sprzęcie rodziców); poniżej adepci dzielą się maszynami i mniej jeżdżą.</p></div>
    <div class="panel flush"><div class="ph"><h3>Motocykle szkółki (${bikes.length})</h3></div>${bikes.length ? `<table class="t"><thead><tr><th>Numer</th><th>Klasa</th><th class="num">Rocznik</th><th>Stan</th><th class="num">Wartość</th><th></th></tr></thead><tbody>
      ${bikes.slice().sort(by(b => b.cls + b.born)).map(b => `<tr><td>${esc(b.sn)}</td><td class="small">${esc(ACAD_BIKE[b.cls].name)}</td><td class="num">${b.born}</td><td style="width:110px">${bar(b.cond)}</td><td class="num">${fmtMoney(bikePrice(b), true)}</td><td><button class="btn sm" onclick="ACT.arm(this, 'bikeSell', '${esc(b.sn)}')">Sprzedaj</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty small">Klub nie ma motocykli dla szkółki.</div>'}</div></div>
    <p class="small muted" style="margin-top:12px">Zimą (listopad) motocykle przechodzą przegląd (koszt według klasy), zużyte i ponad 7-letnie są wycofywane. Silniki 500 cm³ juniorów i zawodników klubu – zakładki Zawodnicy i Warsztat klubu.</p>`;
}
function usedBikesPage(c) {
  const list = (G.usedBikes || []).map((L, i) => ({ L, i })).sort(by(o => o.L.b.cls + o.L.price));
  const seller = ref => ref === 'p' ? 'rodzina adepta' : ref === `c${G.clubId}` ? '<b>nasz klub</b>' : refLabel(ref).replace('park maszyn: ', 'szkółka: ');
  return `<div class="panel flush"><div class="ph"><h3>Używane motocykle szkółkowe (${list.length})</h3></div>${list.length ? `<table class="t"><thead><tr><th>Numer</th><th>Klasa</th><th class="num">Rocznik</th><th>Stan</th><th>Sprzedający</th><th class="num">Cena</th><th></th></tr></thead><tbody>
    ${list.map(({ L, i }) => `<tr><td>${esc(L.b.sn)}</td><td class="small">${esc(ACAD_BIKE[L.b.cls].name)}</td><td class="num">${L.b.born}</td><td style="width:110px">${bar(L.b.cond)}</td><td class="small">${seller(L.seller)}</td><td class="num"><b>${fmtMoney(L.price, true)}</b></td>
      <td>${L.seller === `c${G.clubId}` ? '<span class="small muted">wystawiony</span>' : `<button class="btn sm" onclick="ACT.arm(this, 'bikeUsed', '${esc(L.b.sn)}')">Kup</button>`}</td></tr>`).join('')}</tbody></table>` : '<div class="empty small">Brak ofert – nowe pojawiają się jesienią.</div>'}</div>
    <p class="small muted" style="margin-top:12px">Oferty innych szkółek i rodzin adeptów (odnawiane w listopadzie). Wystawione przez nas motocykle znajdują kupca w ciągu kilku miesięcy.</p>`;
}
ACT.bikeBuy = cls => { const c = myClub(), b = newBike(cls); c.park.bikes.push(b); addTx(c.id, 'sprzęt', -ACAD_BIKE[cls].price, `Szkółka: nowy motocykl (${ACAD_BIKE[cls].name})`); toast(`Kupiono: ${ACAD_BIKE[cls].name}.`, 'good'); changed(); };
ACT.bikeUsed = sn => {
  const c = myClub(), i = (G.usedBikes || []).findIndex(L => L.b.sn === sn);
  if (i < 0) return toast('Motocykl został już sprzedany.', 'bad');
  const L = G.usedBikes.splice(i, 1)[0];
  if (L.seller[0] === 'c' && G.clubs[Number(L.seller.slice(1))]) addTx(Number(L.seller.slice(1)), 'sprzęt', L.price, `Szkółka: sprzedaż używanego motocykla ${sn}`);
  c.park.bikes.push(L.b); addTx(c.id, 'sprzęt', -L.price, `Szkółka: używany motocykl ${sn} (${ACAD_BIKE[L.b.cls].name})`);
  toast(`Kupiono używany motocykl ${sn}.`, 'good'); changed();
};
ACT.bikeSell = sn => {
  const c = myClub(), b = c.park.bikes.find(x => x.sn === sn);
  if (!b) return;
  c.park.bikes.splice(c.park.bikes.indexOf(b), 1);
  G.usedBikes.push({ b, seller: `c${c.id}`, price: bikePrice(b), since: G.date });
  toast(`Motocykl ${sn} wystawiony na sprzedaż.`, 'good'); changed();
};
