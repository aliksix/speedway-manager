'use strict';
// Ekrany: Transfery, Klub, Finanse.

// ---------- Transfery ----------
const TF_DEFAULT = { q: '', country: '', ageMin: 14, ageMax: 45, contract: 'all', league: '', skillMin: 0, lic: 'ok' }; // lic: ok – z licencją, expired – licencja wygasła, retired – koniec kariery, all // skillMin: gwiazdki (0–5) w ocenie sztabu
const TF_COLS = [['name', 'Zawodnik'], ['country', 'Kraj'], ['age', 'Wiek'], ['club', 'Klub'], ['skill', 'Umiej.'], ['potential', 'Potencjał'], ['until', 'Kontrakt do'], ['pay', 'Wynagrodzenie'], ['value', 'Wartość']];
function tfRows() {
  const f = UI.tf || (UI.tf = { ...TF_DEFAULT });
  const q = f.q.trim().toLowerCase();
  let rows = Object.values(G.riders).filter(r => {
    if (r.clubId === G.clubId) return false;
    if (f.lic && f.lic !== 'all' && licState(r) !== f.lic) return false;
    if (q && !r.name.toLowerCase().includes(q)) return false;
    if (f.country && !hasNat(r, f.country)) return false;
    const age = riderAge(r);
    if (age < f.ageMin || age > f.ageMax) return false;
    if (f.contract === 'free' && r.clubId) return false;
    if (f.contract === 'contract' && !r.clubId) return false;
    if (f.contract === 'ending' && !(r.contract && r.contract.until <= G.season)) return false;
    if (f.contract === 'listed' && !r.listed) return false;
    if (f.contract === 'loan' && !(r.loanListed || (r.contract && r.contract.clubId !== G.clubId && loanStatus(r).ok && isJunior(r) && squadOutlook(r, r.clubId) === 'rezerwa'))) return false;
    if (f.contract === 'available' && !marketStatus(r).ok) return false;
    if (f.contract === 'interest' && !interestedClubs(r).length && !openNegs(r.id).some(n => n.clubId !== G.clubId)) return false;
    if (f.league && (f.league === 'none' ? r.clubId : !r.clubId || G.clubs[r.clubId].league !== f.league)) return false;
    if (f.skillMin && (!scKnown(r) || perceive(r).caMid / 20 < f.skillMin)) return false; // nieznanych sztab nie ocenia
    return true;
  });
  const s = UI.sort.tf || { k: 'skill', d: -1 };
  const key = { name: r => r.name, country: r => r.country, age: r => riderAge(r), club: r => (r.clubId ? G.clubs[r.clubId].name : 'ż'), skill: r => (scKnown(r) ? perceive(r).caMid : -1), potential: r => (scKnown(r) ? perceive(r).paMid : -1), pay: r => (riderDeal(r) ? riderDeal(r).ppSort : -1), until: r => (r.contract ? r.contract.until : 0), value: r => riderValue(r) }[s.k];
  return rows.sort(by(key, s.d));
}
ACT.tfSort = k => { const s = UI.sort.tf || { k: 'skill', d: -1 }; UI.sort.tf = { k, d: s.k === k ? -s.d : k === 'name' || k === 'country' || k === 'club' ? 1 : -1 }; UI.tfPage = 0; render(); };
ACT.tfSet = (k, v) => { UI.tf[k] = v; UI.tfPage = 0; render(); };
PAGES.transfery = parts => {
  // tryb Sztab: wyszukiwarka i obserwowani; pozostałe zakładki (negocjacje, okienka…) dotyczą zawodników
  if (UI.tfMode === 'staff' && ['', 'obserwowani'].includes(parts[0] || '')) return staffTransfersPage(parts);
  if (UI.tfMode === 'staff') UI.tfMode = 'riders';
  const sub = parts[0] || '';
  const myNegs = Object.values(G.negs).filter(n => n.clubId === G.clubId && (NEG_OPEN.includes(n.status) || (n.status === 'agreed' && !n.done)));
  const T = tabs('transfery', [['', 'Wyszukiwarka'], ['skauting', `Skauting (${G.shortlist.length})`], ['negocjacje', `Negocjacje (${myNegs.length})`], ['moi', 'Moi zawodnicy na rynku'], ['okienka', 'Okienka i przepisy'], ['historia', 'Historia transferów']], sub);
  const head = { title: `Transfery ${tfModeSwitch()}`, sub: `${marketPhase()} · saldo ${fmtMoney(myClub().cash, true)}`, tabs: T };
  if (sub === 'skauting' || sub === 'obserwowani') return scoutingPage(head, parts[1] || ''); // Obserwowani, zlecenia, polecani, raporty (js/ui-scouting.js)
  if (sub === 'negocjacje') return { ...head, body: negotiationsPage() };
  if (sub === 'moi') return { ...head, body: myMarketPage() };
  if (sub === 'okienka') return { ...head, body: windowsPage() };
  if (sub === 'historia') {
    const log = (G.transfersLog || []).slice().reverse().slice(0, 300);
    const kindL = t => t.renewal ? 'przedłużenie' : t.kind || (t.fee ? 'transfer' : 'wolny');
    return { ...head, body: `<div class="panel flush"><table class="t"><thead><tr><th>Data</th><th>Zawodnik</th><th>Z klubu</th><th>Do klubu</th><th>Rodzaj</th><th class="num">Kwota</th></tr></thead><tbody>${log.map(t => `<tr class="click ${t.to === G.clubId || t.from === G.clubId ? 'me' : ''}" onclick="go('#/zawodnik/${t.riderId}')"><td>${fmtDateShort(t.date)}</td><td><b>${esc(G.riders[t.riderId] ? G.riders[t.riderId].name : '?')}</b></td><td>${t.from ? clubLink(t.from) : '<span class="muted">wolny</span>'}</td><td>${t.to ? clubLink(t.to) : '<span class="muted">wolny zawodnik</span>'}</td><td>${esc(kindL(t))}</td><td class="num">${t.fee ? fmtMoney(t.fee, true) : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Brak transferów</td></tr>'}</tbody></table></div>` };
  }
  const f = UI.tf || (UI.tf = { ...TF_DEFAULT });
  const rows = tfRows();
  setCtx(rows.map(r => r.id), 'Wyniki wyszukiwania');
  const countries = [...new Set(Object.values(G.riders).map(r => r.country))].filter(c => COUNTRY[c]).sort((a, b) => COUNTRY[a].localeCompare(COUNTRY[b], 'pl'));
  const per = 50, pages = Math.max(1, Math.ceil(rows.length / per));
  UI.tfPage = clamp(UI.tfPage, 0, pages - 1);
  return { ...head, body: `<div class="filters panel">
      <label class="fld">Nazwisko<input value="${esc(f.q)}" onchange="ACT.tfSet('q', this.value)" placeholder="szukaj…"></label>
      <label class="fld">Narodowość<select onchange="ACT.tfSet('country', this.value)"><option value="">wszystkie</option>${countries.map(c => `<option value="${c}" ${f.country === c ? 'selected' : ''}>${esc(COUNTRY[c])}</option>`).join('')}</select></label>
      <label class="fld">Wiek od<input type="number" min="12" max="50" value="${f.ageMin}" style="width:70px" onchange="ACT.tfSet('ageMin', +this.value)"></label>
      <label class="fld">do<input type="number" min="12" max="50" value="${f.ageMax}" style="width:70px" onchange="ACT.tfSet('ageMax', +this.value)"></label>
      <label class="fld">Status<select onchange="ACT.tfSet('contract', this.value)">${[['all', 'wszyscy'], ['available', 'dostępni teraz (można negocjować)'], ['free', 'bez kontraktu (wolni)'], ['contract', 'z kontraktem'], ['ending', 'kontrakt kończy się w tym sezonie'], ['listed', 'na liście transferowej'], ['loan', 'do wypożyczenia'], ['interest', 'zainteresowanie / oferty innych klubów']].map(([k, l]) => `<option value="${k}" ${f.contract === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="fld">Liga<select onchange="ACT.tfSet('league', this.value)"><option value="">wszystkie</option>${LEAGUE_ORDER.map(l => `<option value="${l}" ${f.league === l ? 'selected' : ''}>${LEAGUES[l].short}</option>`).join('')}<option value="none" ${f.league === 'none' ? 'selected' : ''}>bez klubu w PL</option></select></label>
      <label class="fld">Umiejętności min. (★)<input type="number" step="0.5" min="0" max="5" value="${f.skillMin}" style="width:80px" onchange="ACT.tfSet('skillMin', +this.value)"></label>
      <label class="fld">Licencja<select onchange="ACT.tfSet('lic', this.value)">${[['ok', 'z licencją'], ['expired', 'licencja wygasła'], ['retired', 'zakończyli karierę'], ['all', 'wszyscy']].map(([k, l]) => `<option value="${k}" ${(f.lic || 'ok') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn ghost" onclick="UI.tf=null;render()">Wyczyść</button></div>
    ${tfTable(rows.slice(UI.tfPage * per, UI.tfPage * per + per), true)}
    <div class="pager"><span class="small muted">${rows.length} zawodników</span><button class="btn sm" ${UI.tfPage ? '' : 'disabled'} onclick="UI.tfPage--;render()">‹</button><span class="small">${UI.tfPage + 1} / ${pages}</span><button class="btn sm" ${UI.tfPage < pages - 1 ? '' : 'disabled'} onclick="UI.tfPage++;render()">›</button></div>
    <div class="panel" style="margin-top:12px">${mkLegend()}</div>` };
};
const NEG_KIND = n => n.kind === 'loan' ? 'wypożyczenie' : n.kind === 'renewal' ? 'przedłużenie' : n.mode === 'transfer' ? 'transfer' : n.mode === 'precontract' ? 'prekontrakt' : 'wolny zawodnik';
function negRow(n, side) {
  const r = G.riders[n.riderId];
  const who = side === 'out' ? clubLink(n.clubId) : r.contract ? clubLink(r.contract.clubId) : '<span class="muted">wolny</span>';
  const terms = n.kind === 'loan' ? `${n.terms.fee ? `${fmtMoney(n.terms.fee, true)} · ` : ''}${fmtMoney(n.terms.signing || 0, true)} + ${fmtMoney(n.terms.perPoint || 0)}/pkt` : side === 'out' && n.clubId !== G.clubId && n.holderId !== G.clubId ? '<span class="muted">nieznane</span>' : `${n.terms.fee ? `${fmtMoney(n.terms.fee, true)} · ` : ''}${esc(termsText(n.terms))}`;
  return `<tr class="click" onclick="go('#/zawodnik/${r.id}/kontrakt')"><td><b>${esc(r.name)}</b>${mkBadges(r)}</td><td>${who}</td><td>${NEG_KIND(n)}</td><td class="${n.status === 'counter' ? 'warn' : n.status === 'agreed' ? 'pos' : ''}">${esc(negStatusText(n))}</td><td class="small">${terms}</td></tr>`;
}
function negotiationsPage() {
  const all = Object.values(G.negs);
  const mine = all.filter(n => n.clubId === G.clubId && (NEG_OPEN.includes(n.status) || (n.status === 'agreed' && !n.done))).sort(by(n => n.decideBy || n.completes || ''));
  const past = all.filter(n => n.clubId === G.clubId && !mine.includes(n) && dayDiff(n.updated, G.date) <= 45).sort(by(n => n.updated, -1));
  const incoming = all.filter(n => n.clubId !== G.clubId && NEG_OPEN.includes(n.status) && (n.holderId === G.clubId || (G.riders[n.riderId].contract && G.riders[n.riderId].contract.clubId === G.clubId)));
  const tbl = (rows, side, empty) => `<table class="t"><thead><tr><th>Zawodnik</th><th>${side === 'out' ? 'Klub składający ofertę' : 'Obecny klub'}</th><th>Rodzaj</th><th>Status</th><th>Warunki</th></tr></thead><tbody>${rows.map(n => negRow(n, side)).join('') || `<tr><td colspan="5" class="empty">${empty}</td></tr>`}</tbody></table>`;
  return `<div class="panel flush" style="margin-bottom:16px"><div class="ph"><h3>Nasze negocjacje</h3><span class="small muted">zawodnicy odpowiadają po kilku dniach – dłużej, gdy mają inne oferty lub dużo czasu do końca okienka</span></div>${tbl(mine, 'in', 'Brak trwających negocjacji – złóż ofertę w profilu zawodnika.')}</div>
    <div class="panel flush" style="margin-bottom:16px"><div class="ph"><h3>Oferty innych klubów za naszych zawodników</h3></div>${tbl(incoming, 'out', 'Brak ofert.')}</div>
    <div class="panel flush"><div class="ph"><h3>Zakończone (ostatnie 45 dni)</h3></div>${tbl(past, 'in', 'Brak.')}</div>`;
}
function myMarketPage() {
  const rs = Object.values(G.riders).filter(r => r.contract && r.contract.clubId === G.clubId);
  const listed = rs.filter(r => r.listed || r.loanListed);
  const loaned = rs.filter(r => r.loan);
  const loanedIn = clubRiders(G.clubId).filter(r => r.loan);
  const watched = rs.filter(r => interestedClubs(r).length || openNegs(r.id).some(n => n.clubId !== G.clubId));
  const ending = rs.filter(r => r.contract.until === G.season && !r.nextContract && G.seasonClosed !== G.season);
  const row = r => `<tr class="click" onclick="go('#/zawodnik/${r.id}/kontrakt')"><td><b>${esc(r.name)}</b>${mkBadges(r)}</td><td>${riderAge(r)}</td><td>${caStars(r)}</td>${riderDealCells(r)}<td class="num">${fmtMoney(riderValue(r), true)}</td></tr>`;
  const tbl = (list, empty) => `<table class="t"><thead><tr><th>Zawodnik</th><th>Wiek</th><th>Umiej.</th><th>Kontrakt do</th><th class="num">Wynagrodzenie</th><th class="num">Wartość</th></tr></thead><tbody>${list.map(row).join('') || `<tr><td colspan="6" class="empty">${empty}</td></tr>`}</tbody></table>`;
  return `<div class="grid g2"><div class="panel flush"><div class="ph"><h3>Na liście transferowej / do wypożyczenia</h3></div>${tbl(listed, 'Nikogo nie wystawiono – zrobisz to w profilu zawodnika (zakładka Kontrakt).')}</div>
    <div class="panel flush"><div class="ph"><h3>Zainteresowanie innych klubów</h3></div>${tbl(watched, 'Na razie nikt się nie interesuje naszymi zawodnikami.')}</div>
    <div class="panel flush"><div class="ph"><h3>Wypożyczeni do innych klubów</h3></div>${tbl(loaned, 'Brak.')}</div>
    <div class="panel flush"><div class="ph"><h3>Wypożyczeni do nas</h3></div><table class="t"><tbody>${loanedIn.map(r => `<tr class="click" onclick="go('#/zawodnik/${r.id}/kontrakt')"><td><b>${esc(r.name)}</b>${mkBadges(r)}</td><td>z ${clubLink(r.loan.parentId)}</td><td>do 31.10.${r.loan.season}</td></tr>`).join('') || '<tr><td class="empty">Brak.</td></tr>'}</tbody></table></div>
    <div class="panel flush" style="grid-column:1/-1"><div class="ph"><h3>Kontrakty kończące się po sezonie ${G.season}</h3><span class="small muted">przedłużenie (prekontrakt) możliwe od 15 czerwca – wcześniej obowiązuje zakaz kontaktów</span></div>${tbl(ending, 'Brak kończących się umów.')}</div></div>`;
}
function windowsPage() {
  const lg = myClub().league, S = sportSeason();
  const ws = seasonWindows(lg, S);
  const st = w => G.date > w.to ? '<span class="muted">zakończone</span>' : G.date >= w.from ? '<span class="pos">trwa</span>' : `za ${dayDiff(G.date, w.from)} dni`;
  const last = lastRegularRound(lg, S);
  return `<div class="grid g2"><div class="panel flush"><div class="ph"><h3>Okienka transferowe – sezon ${S} (${esc(LEAGUES[lg].short)})</h3></div><table class="t win-list"><thead><tr><th>Okienko</th><th>Termin</th><th>Kto może być zgłoszony</th><th>Status</th></tr></thead><tbody>
      ${ws.map(w => `<tr class="${G.date >= w.from && G.date <= w.to ? 'on' : ''}"><td><b>${esc(w.name)}</b></td><td>${fmtDateShort(w.from)} – ${fmtDateShort(w.to)}</td><td class="small">${w.kind === 'mid' ? 'tylko zawodnicy bez klubu, niezgłoszeni w tym sezonie' : w.kind === 'supp' ? 'wszyscy; kluby z rekomendacją „zagrożony finansowo” tylko tutaj' : 'wszyscy (transfery, wolni zawodnicy, rejestracja prekontraktów)'}</td><td>${st(w)}</td></tr>`).join('')}
      <tr><td><b>Prekontrakty</b></td><td>15.06 – 31.10.${S}</td><td class="small">zawodnicy, którym kontrakt wygasa po sezonie ${S}; nowa umowa od sezonu ${S + 1}</td><td>${precontractOpen() ? '<span class="pos">trwa</span>' : ''}</td></tr>
      <tr><td><b>Wypożyczenia</b></td><td>do ${last ? fmtDateShort(last) : 'ostatniej rundy sezonu zasadniczego'}</td><td class="small">zawodnik z najwyżej 12 pkt w lidze w sezonie, raz w sezonie, do 31.10</td><td></td></tr></tbody></table></div>
    <div class="panel"><h3>Najważniejsze przepisy (RPK 2026, Zbiór Zasad)</h3><ul class="small" style="margin:0;padding-left:18px;line-height:1.6">
      <li>Sezon trwa od 1.11 do 31.10. Kontrakty kończą się 31.10 ostatniego sezonu umowy.</li>
      <li>Kontrakt: od 1 do 6 sezonów, kwoty ustalane osobno na każdy sezon. Kwota za podpis w PGE i 2. Ekstralidze wypłacana w 6 ratach (luty–lipiec).</li>
      <li>Do 15.06 ostatniego roku umowy obowiązuje zakaz rozmów z zawodnikiem innego klubu i zakaz przedłużania kontraktu.</li>
      <li>Zawodnik z ważnym kontraktem zmienia klub tylko za zgodą klubu: odstępne, klauzula odstępnego (zapłata rozwiązuje kontrakt) albo ekwiwalent za wyszkolenie.</li>
      <li>Ekwiwalent za wyszkolenie: zawodnik do 21 lat; stawki maksymalne za rok szkolenia (od 2026): junior 500 cm³ 160 tys., 250/500R 80 tys., miniżużel 125 cm³ 60 tys., 85–140 cm³ 40 tys., pit bike 20 tys. zł; klub szkolący może przyjąć mniej lub zrezygnować (zależnie od potencjału, wieku i tego, czy junior jest mu potrzebny); płaci klub pozyskujący także za wolnego zawodnika; nie przysługuje, gdy kontrakt wygasa w roku 21. urodzin.</li>
      <li>Kontrakt amatorski (junior do 21 lat): klub pokrywa sprzęt i starty, stypendium do 1000 zł brutto miesięcznie, bez pieniędzy za punkty w lidze.</li>
      <li>W zawodach młodzieżowych wolno płacić wyłącznie za punkty.</li>
      <li>Wypożyczenie: zgoda obu klubów i zawodnika; klub wypożyczający płaci według nowego kontraktu – dzielenie pensji jest zakazane.</li>
      <li>Premie (medal, awans, stawka za dwucyfrówkę) muszą być wpisane do kontraktu.</li>
      <li>Kontuzja odniesiona poza ligą polską, zawodami PZM i startami reprezentacji: klub potrąca kwotę za podpis ÷ liczba meczów drużyny za każdy opuszczony mecz. W czasie kontuzji nie ma pieniędzy za punkty; po 9 miesiącach klub może rozwiązać kontrakt.</li>
      <li>PRO Junior (PGE): po sezonie co najmniej 8 mln zł dzielone między kluby według punktów ligowych juniorów-wychowanków.</li>
      <li>Od sezonu 2027 w PGE Ekstralidze wydatki na kontrakty (podpis + stawka × punkty z poprzedniego sezonu + premie) nie mogą przekroczyć 70% przychodów; beniaminek ma wyższy przelicznik. Umowa ponad limit nie zostanie potwierdzona.</li></ul></div>
    <div class="panel" style="grid-column:1/-1"><h3>Oznaczenia zawodników</h3>${mkLegend()}</div></div>`;
}
function tfTable(rows, sortable) {
  const s = UI.sort.tf || { k: 'skill', d: -1 };
  return `<div class="panel flush"><table class="t"><thead><tr>${TF_COLS.map(([k, l]) => sortable ? `<th class="sort ${s.k === k ? 'sorted' : ''} ${['age', 'value', 'pay'].includes(k) ? 'num' : ''}" onclick="ACT.tfSort('${k}')">${l}${s.k === k ? (s.d > 0 ? ' ▲' : ' ▼') : ''}</th>` : `<th>${l}</th>`).join('')}<th></th></tr></thead><tbody>
    ${rows.map(r => `<tr class="click" onclick="go('#/zawodnik/${r.id}')"><td><b>${esc(r.name)}</b>${r.injury ? ' <span class="pill inj">K</span>' : ''}${mkBadges(r)}</td><td>${flagCode(r.country)}</td><td class="num">${riderAge(r)}${r.bornEst ? '*' : ''}</td>
      <td>${r.clubId ? clubLink(r.clubId) : `<span class="muted">${r.retired ? 'koniec kariery' : !r.active ? 'licencja wygasła' : 'wolny'}</span>`}</td><td>${caStars(r)}</td><td>${paStars(r)}</td>
      ${riderDealCells(r)}<td class="num">${fmtMoney(riderValue(r), true)}</td>
      <td onclick="event.stopPropagation()"><button class="btn sm" onclick="ACT.toggleWatch(${r.id})" title="Obserwuj">${G.shortlist.includes(r.id) ? '★' : '☆'}</button></td></tr>`).join('') || '<tr><td colspan="10" class="empty">Brak zawodników spełniających kryteria</td></tr>'}</tbody></table></div>`;
}

// ---------- Transfery: sztab ----------
// Przełącznik rynku: zawodnicy / sztab (na razie główni trenerzy drużyn)
function tfModeSwitch() {
  const m = UI.tfMode === 'staff' ? 'staff' : 'riders';
  return `<span class="seg" style="margin-left:16px;vertical-align:middle">${[['riders', 'Zawodnicy'], ['staff', 'Sztab']].map(([k, l]) => `<button class="btn sm ${m === k ? 'primary' : ''}" onclick="ACT.tfMode('${k}')">${l}</button>`).join('')}</span>`;
}
ACT.tfMode = m => { UI.tfMode = m; if (!['', 'obserwowani'].includes((location.hash.split('/')[2] || ''))) go('#/transfery'); else render(); };
const SF_ROLES = ['coach', 'assistant', 'juniorCoach', 'u24Coach', 'youth']; // role trenerskie na rynku sztabu
const SF_DEFAULT = { q: '', country: '', ageMin: 18, ageMax: 85, contract: 'all', league: '', levelMin: 0, profile: '', role: '' };
const SF_COLS = [['name', 'Trener'], ['role', 'Rola'], ['country', 'Kraj'], ['age', 'Wiek'], ['club', 'Klub'], ['level', 'Umiejętności'], ['profile', 'Specjalizacja'], ['until', 'Kontrakt do'], ['wage', 'Wynagrodzenie']];
const staffLevel = s => { const k = (STAFF_ROLES[s.role] || STAFF_ROLES.coach).attrs.map(a => s.attrs[a] || 0); return sum(k) / k.length; };
const staffWageShown = s => (s.clubId ? s.wage : typeof staffWageFor === 'function' ? staffWageFor(s, myClub()) : s.wage);
function sfRows() {
  const f = UI.sf || (UI.sf = { ...SF_DEFAULT });
  const q = f.q.trim().toLowerCase();
  const rows = Object.values(G.staff).filter(s => {
    if (!staffRoles(s).some(r => SF_ROLES.includes(r)) || s.player || s.clubId === G.clubId) return false;
    if (f.role && !staffRoles(s).includes(f.role)) return false;
    if (q && !s.name.toLowerCase().includes(q)) return false;
    if (f.country && s.country !== f.country) return false;
    if (s.born) { const age = ageAt(s.born, G.date); if (age < f.ageMin || age > f.ageMax) return false; }
    if (f.contract === 'free' && (s.clubId || s.national)) return false;
    if (f.contract === 'contract' && !s.clubId) return false;
    if (f.contract === 'ending' && !(s.clubId && s.until <= G.season)) return false;
    if (f.league && (f.league === 'none' ? s.clubId : !s.clubId || G.clubs[s.clubId].league !== f.league)) return false;
    if (f.levelMin && staffLevel(s) / 4 < f.levelMin) return false;
    if (f.profile && !(s.profile && s.profile.main === f.profile)) return false;
    return true;
  });
  const st = UI.sort.sf || { k: 'level', d: -1 };
  const key = { name: s => s.name, role: s => SF_ROLES.indexOf(s.role), country: s => s.country, age: s => (s.born ? ageAt(s.born, G.date) : 0), club: s => (s.clubId ? G.clubs[s.clubId].name : 'ż'), level: staffLevel,
    profile: s => (s.profile ? TRAIN_PROFILES[s.profile.main].name : 'ż'), until: s => (s.clubId ? s.until : 0), wage: staffWageShown }[st.k];
  return rows.sort(by(key, st.d));
}
ACT.sfSort = k => { const s = UI.sort.sf || { k: 'level', d: -1 }; UI.sort.sf = { k, d: s.k === k ? -s.d : ['name', 'country', 'club', 'profile'].includes(k) ? 1 : -1 }; UI.sfPage = 0; render(); };
ACT.sfSet = (k, v) => { UI.sf[k] = v; UI.sfPage = 0; render(); };
ACT.staffWatch = id => { G.staffShortlist = G.staffShortlist || []; const i = G.staffShortlist.indexOf(id); if (i >= 0) G.staffShortlist.splice(i, 1); else G.staffShortlist.push(id); changed(); };
function sfTable(rows, sortable) {
  const st = UI.sort.sf || { k: 'level', d: -1 }, watch = G.staffShortlist || [];
  return `<div class="panel flush"><table class="t"><thead><tr>${SF_COLS.map(([k, l]) => sortable ? `<th class="sort ${st.k === k ? 'sorted' : ''} ${['age', 'wage'].includes(k) ? 'num' : ''}" onclick="ACT.sfSort('${k}')">${l}${st.k === k ? (st.d > 0 ? ' ▲' : ' ▼') : ''}</th>` : `<th>${l}</th>`).join('')}<th></th></tr></thead><tbody>
    ${rows.map(s => `<tr class="click" onclick="go('#/osoba/${s.id}')"><td><b>${esc(s.name)}</b></td><td class="small">${esc(staffRoleNames(s))}</td><td>${flagCode(s.country)}</td><td class="num">${s.born ? ageAt(s.born, G.date) : '—'}</td>
      <td>${s.clubId ? clubLink(s.clubId) : s.national ? countryLink(s.national) : '<span class="muted">wolny</span>'}</td><td>${starsPlain(clamp(staffLevel(s) / 4, 0.5, 5))}</td><td>${s.profile ? esc(TRAIN_PROFILES[s.profile.main].name) : '—'}</td>
      ${staffDealCells(s)}
      <td onclick="event.stopPropagation()"><button class="btn sm" onclick="ACT.staffWatch('${s.id}')" title="Obserwuj">${watch.includes(s.id) ? '★' : '☆'}</button></td></tr>`).join('') || '<tr><td colspan="10" class="empty">Brak trenerów spełniających kryteria</td></tr>'}</tbody></table></div>`;
}
function staffTransfersPage(parts) {
  const sub = parts[0] === 'obserwowani' ? 'obserwowani' : '';
  const watch = (G.staffShortlist || []).map(id => G.staff[id]).filter(s => s && !s.player);
  const T = tabs('transfery', [['', 'Wyszukiwarka'], ['obserwowani', `Obserwowani (${watch.length})`]], sub);
  const Lm = staffLimits(myClub()), Nm = staffCounts(myClub());
  const head = { title: `Transfery ${tfModeSwitch()}`, sub: `Sztab: trenerzy (menedżerowie, asystenci, trenerzy juniorów, U24 i szkółek) · Twój sztab trenerski: <b class="${Nm.coach >= Lm.coach ? 'warn' : ''}">${Nm.coach} / ${Lm.coach}</b> miejsc · saldo ${fmtMoney(myClub().cash, true)}`, tabs: T };
  if (sub === 'obserwowani') return { ...head, body: watch.length ? sfTable(watch) : '<div class="panel empty">Lista obserwowanych trenerów jest pusta – dodaj ich gwiazdką w wyszukiwarce.</div>' };
  const f = UI.sf || (UI.sf = { ...SF_DEFAULT });
  const rows = sfRows();
  if (typeof setStaffCtx === 'function') setStaffCtx(rows.map(x => x.id), 'Wyniki wyszukiwania');
  const all = Object.values(G.staff).filter(s => SF_ROLES.includes(s.role));
  const countries = [...new Set(all.map(s => s.country))].filter(c => COUNTRY[c]).sort((a, b) => COUNTRY[a].localeCompare(COUNTRY[b], 'pl'));
  const per = 50, pages = Math.max(1, Math.ceil(rows.length / per));
  UI.sfPage = clamp(UI.sfPage || 0, 0, pages - 1);
  return { ...head, body: `<div class="filters panel">
      <label class="fld">Nazwisko<input value="${esc(f.q)}" onchange="ACT.sfSet('q', this.value)" placeholder="szukaj…"></label>
      <label class="fld">Narodowość<select onchange="ACT.sfSet('country', this.value)"><option value="">wszystkie</option>${countries.map(c => `<option value="${c}" ${f.country === c ? 'selected' : ''}>${esc(COUNTRY[c])}</option>`).join('')}</select></label>
      <label class="fld">Wiek od<input type="number" min="18" max="90" value="${f.ageMin}" style="width:70px" onchange="ACT.sfSet('ageMin', +this.value)"></label>
      <label class="fld">do<input type="number" min="18" max="90" value="${f.ageMax}" style="width:70px" onchange="ACT.sfSet('ageMax', +this.value)"></label>
      <label class="fld">Status<select onchange="ACT.sfSet('contract', this.value)">${[['all', 'wszyscy'], ['free', 'wolni (do zatrudnienia)'], ['contract', 'z kontraktem'], ['ending', 'kontrakt kończy się w tym sezonie']].map(([k, l]) => `<option value="${k}" ${f.contract === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="fld">Liga<select onchange="ACT.sfSet('league', this.value)"><option value="">wszystkie</option>${LEAGUE_ORDER.map(l => `<option value="${l}" ${f.league === l ? 'selected' : ''}>${LEAGUES[l].short}</option>`).join('')}<option value="none" ${f.league === 'none' ? 'selected' : ''}>bez klubu</option></select></label>
      <label class="fld">Rola<select onchange="ACT.sfSet('role', this.value)"><option value="">wszystkie</option>${SF_ROLES.map(r => `<option value="${r}" ${f.role === r ? 'selected' : ''}>${esc(STAFF_ROLES[r].name)}</option>`).join('')}</select></label>
      <label class="fld">Specjalizacja<select onchange="ACT.sfSet('profile', this.value)"><option value="">wszystkie</option>${Object.entries(TRAIN_PROFILES).map(([k, p]) => `<option value="${k}" ${f.profile === k ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="fld">Umiejętności min. (★)<input type="number" step="0.5" min="0" max="5" value="${f.levelMin}" style="width:80px" onchange="ACT.sfSet('levelMin', +this.value)"></label>
      <button class="btn ghost" onclick="UI.sf=null;render()">Wyczyść</button></div>
    ${sfTable(rows.slice(UI.sfPage * per, UI.sfPage * per + per), true)}
    <div class="pager"><span class="small muted">${rows.length} trenerów</span><button class="btn sm" ${UI.sfPage ? '' : 'disabled'} onclick="UI.sfPage--;render()">‹</button><span class="small">${UI.sfPage + 1} / ${pages}</span><button class="btn sm" ${UI.sfPage < pages - 1 ? '' : 'disabled'} onclick="UI.sfPage++;render()">›</button></div>
    <p class="small muted" style="margin-top:12px">Wolnego trenera zatrudnisz w jego profilu; trener z kontraktem w innym klubie nie jest dostępny. Pensja zależy od roli (menedżer najwyżej) i ligi klubu.</p>` };
}

// ---------- Klub ----------
PAGES.klub = parts => {
  const sub = parts[0] || '';
  const c = myClub();
  const T = tabs('klub', [['', 'Informacje'], ...STADIUM_TABS, ['licencja', 'Licencja'], ['historia', 'Historia']], sub);
  const head = { title: `${crest(c)} ${esc(c.name)}`, sub: `${esc(c.city)} · ${LEAGUES[c.league].name}`, tabs: T };
  if (STADIUM_TABS.some(t => t[0] === sub)) return { ...head, body: stadiumPage(c, sub, parts[1]) }; // stadion, bilety, karnety, frekwencja (js/ui-stadium.js)
  const moved = { park: 'warsztat', tunerzy: 'tunerzy', silniki: 'rynek' }; // sprzęt przeniesiony do sekcji Park maszyn
  if (moved[sub]) { setTimeout(() => go(`#/park/${moved[sub]}`), 0); return { title: '', body: '' }; }
  if (sub === 'zarzad') { setTimeout(() => go('#/klub'), 0); return { title: '', body: '' }; } // dawna zakładka Zarząd – teraz Informacje
  if (sub === 'licencja') return { ...head, body: licencePage(c) };
  if (sub === 'historia') return { ...head, body: clubHistoryView(c, true) };

  return { ...head, body: boardPage(c, true) }; // informacje i władze klubu: właściciel, prezes, zarząd, zaufanie, cele, prośby (js/board.js)
};
ACT.lights = () => { const c = myClub(); if (c.cash < 1.5e6) return toast('Brak środków.', 'bad'); addTx(c.id, 'inwestycje', -1.5e6, 'Oświetlenie stadionu'); c.stadium.lights = true; c.stadium.lighting = Math.max(c.stadium.lighting || 0, 1800); changed(); };
ACT.dyno = () => { const c = myClub(); if (c.cash < 250000) return toast('Brak środków.', 'bad'); addTx(c.id, 'inwestycje', -250000, 'Hamownia silników'); c.park.dyno = true; c.facilities.workshop = Math.min(5, c.facilities.workshop); changed(); };
ACT.upgrade = kind => {
  const c = myClub(), lvl = c.facilities[kind], cost = COSTS[kind](lvl);
  if (lvl >= 5) return;
  if (c.cash < cost) return toast('Klub nie ma wystarczających środków.', 'bad');
  addTx(c.id, 'inwestycje', -cost, `Rozbudowa: ${(typeof FAC_LABEL !== 'undefined' ? FAC_LABEL : { workshop: 'warsztat / park maszyn', academy: 'szkółka', training: 'obiekty treningowe' })[kind]}`);
  c.facilities[kind] = (c.facilities[kind] || 0) + 1;
  if (typeof TQ !== 'undefined') TQ.date = null;
  toast('Inwestycja zakończona.', 'good'); changed();
};

// ---------- Finanse ----------
// Ekrany finansów (przegląd, przepływy, budżet, sponsorzy, reklama, finansowanie): js/ui-finance.js
