'use strict';
// Rdzeń interfejsu: router (#/sekcja/podstrona), układ (pasek górny, menu boczne), ekran startowy, skrzynka, modale.

const UI = { ctx: null, cal: null, league: null, tf: null, tfPage: 0, sort: {}, inboxSel: null, inboxFilter: 'all', calAll: false, busy: false };
const PAGES = {};
const ACT = {};

// ---------- Ikony menu ----------
const ICON = {
  park: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16h4l3-6h3l2 6M13 10l-2-3H8"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.4 5.5 5.8"/>',
  staff: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  academy: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
  medical: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  league: '<path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0z"/><path d="M6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3"/>',
  transfers: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  club: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
  finance: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  comps: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13 7 21l5-3 5 3-1.5-8"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
const NAV = [
  ['skrzynka', 'Skrzynka', 'inbox'], ['druzyna', 'Drużyna', 'team'], ['park', 'Park maszyn', 'park'], ['sztab', 'Trening', 'staff'], ['szkolka', 'Szkółka', 'academy'], ['medyczne', 'Centrum medyczne', 'medical'], '-',
  ['kalendarz', 'Kalendarz', 'calendar'], ['liga', 'Liga', 'league'], ['rozgrywki', 'Zawody', 'comps'], ['minizuzel', 'Miniżużel', 'academy'], '-',
  ['transfery', 'Transfery', 'transfers'], '-',
  ['klub', 'Klub', 'club'], ['finanse', 'Finanse', 'finance'],
];
// Sekcje nieobecne w menu podświetlają nadrzędną pozycję
const NAV_PARENT = { silnik: 'park', oferta: 'transfery', osoba: 'sztab', adept: 'szkolka', zawodnik: 'druzyna', zawody: 'kalendarz', gp: 'rozgrywki', zespol: 'liga', impreza: 'kalendarz' };

// ---------- Narzędzia UI ----------
function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`; el.innerHTML = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
// Potwierdzenie bez okienek: pierwsze kliknięcie uzbraja przycisk, drugie (w ciągu 4 s) wykonuje akcję ACT[name](...args)
ACT.arm = (btn, name, ...args) => {
  if (btn.dataset.armed) { btn.disabled = true; return ACT[name](...args); }
  btn.dataset.armed = '1'; btn.dataset.label = btn.innerHTML; btn.classList.add('armed');
  btn.innerHTML = `Potwierdź: ${btn.innerHTML}`;
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.innerHTML = btn.dataset.label; btn.classList.remove('armed'); } }, 4000);
};
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function changed() { dbQueueSave(); render(); }
function tabs(base, list, active) {
  return `<nav class="tabs">${list.map(([k, label]) => `<a href="#/${base}${k ? '/' + k : ''}" class="${k === active ? 'on' : ''}">${label}</a>`).join('')}</nav>`;
}
function attrClass(v) { return v >= 16 ? 'v5' : v >= 13 ? 'v4' : v >= 10 ? 'v3' : v >= 7 ? 'v2' : 'v1'; }
// Gwiazdki oceny 1–100 (5★ = 100) z niepewnością: żółte – to, co sztab wie na pewno (dolna granica oceny),
// białe – możliwy zakres do górnej granicy. Ocena pochodzi ze sztabu klubu gracza i może się mylić (js/ability.js: perceive).
function rangeStars(lo, hi, title) {
  const a = clamp(Math.round(lo / 10), 1, 10), b = clamp(Math.round(hi / 10), a, 10); // jednostka = pół gwiazdki
  const c = u => (u <= a ? 'g' : u <= b ? 'w' : 'o');
  let h = '';
  for (let i = 0; i < 5; i++) h += `<i class="st ${c(2 * i + 1)}${c(2 * i + 2)}">★</i>`;
  return `<span class="stars2">${h}</span>`; // bez podpowiedzi – gracz widzi tylko gwiazdki
}
const fmtStars = ([lo, hi]) => { const f = v => String(clamp(Math.round(v / 10), 1, 10) / 2).replace('.', ','); return f(lo) === f(hi) ? `${f(lo)}★` : `${f(lo)}–${f(hi)}★`; };
const UNKNOWN_STARS = '<span class="small muted" title="Sztab nie zna zawodnika – zleć obserwację">nieznany</span>';
function caStars(x) { if (typeof scKnown === 'function' && !scKnown(x)) return UNKNOWN_STARS; const p = perceive(x); return rangeStars(p.ca[0], p.ca[1], `Obecne umiejętności: ${fmtStars(p.ca)} (ocena sztabu)`); }
function paStars(x) { if (typeof scKnown === 'function' && !scKnown(x)) return UNKNOWN_STARS; const p = perceive(x); return rangeStars(p.pa[0], p.pa[1], `Potencjał: ${fmtStars(p.pa)} (ocena sztabu)`); }
function skillStars(skill) { return rangeStars(skill * 5, skill * 5); }
function potStars(p) { return rangeStars(p, p); }
// Atrybut widziany przez sztab: wartość, przedział albo „?”
function attrCell(x, k, label, K) {
  const p = perceiveAttr(x, k, G.clubId, K);
  if (!p) return '';
  const v = p.hidden ? '<span class="v v0" title="Nieznany – sztab nie zna jeszcze tej cechy">?</span>'
    : p.lo === p.hi ? `<span class="v ${attrClass(p.lo)}">${p.lo}</span>` : `<span class="v rng ${attrClass((p.lo + p.hi) / 2)}" title="Ocena sztabu: ${p.lo}–${p.hi}">${p.lo}–${p.hi}</span>`;
  return `<div class="attr"><span>${label}</span><span class="vbox">${typeof attrTrendHtml === 'function' ? attrTrendHtml(x, k) : ''}${v}</span></div>`;
}
// Opis charakteru (atrybuty ukryte) – pewny, prawdopodobny albo nieznany zależnie od wiedzy sztabu
function charLabel(x, K = knowledge(x)) {
  const l = personalityLabel(x.hidden);
  if (!l) return '—';
  if (K >= 0.75) return `<b title="${esc(l[1])}">${esc(l[0])}</b>`;
  if (K >= 0.5) return `<span title="${esc(l[1])}">prawdopodobnie: ${esc(l[0].toLowerCase())}</span>`;
  return '<span class="muted">nieznany – obserwuj zawodnika</span>';
}
function clubHref(id) { return Number(id) === G.clubId ? '#/druzyna' : `#/zespol/${id}`; }
function clubLink(id, withCrest = true) { const c = G.clubs[id]; if (!c) return '<span class="muted">bez klubu</span>'; return `<a class="clubname" href="${clubHref(id)}" onclick="event.stopPropagation()">${withCrest ? crest(c, 'sm') : ''}<span>${esc(c.name)}</span></a>`; }
// ---------- Znaczniki rynku (jak ikony statusu w FM) ----------
const MK_ICON = {
  tl: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  ll: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  ol: '<path d="M3 12h13M12 6l6 6-6 6"/><path d="M21 5v14"/>',
  in: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  of: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
  ag: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  tk: '<path d="M4 5h16v11H9l-5 4z"/>',
  bid: '<path d="M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.6 5 3 5 1.1 5 3-2.2 3-5 3-5-1.1-5-3"/>',
};
const MK_NAMES = { tl: 'Na liście transferowej', ll: 'Dostępny do wypożyczenia', ol: 'Wypożyczony', in: 'Zainteresowanie innych klubów', of: 'Oferta kontraktu z innego klubu', bid: 'Oferta transferowa za zawodnika (czeka na zgodę klubu)', ag: 'Uzgodnione przejście / prekontrakt', tk: 'Negocjacje z naszym klubem' };
function mkBadge(k, title) { return `<span class="mk mk-${k}" title="${esc(title)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${MK_ICON[k]}</svg></span>`; }
const clubsShort = ids => [...new Set(ids)].map(id => G.clubs[id] ? G.clubs[id].name : '?').join(', ');
function mkBadges(r) {
  if (r && r.retired) return ' <span class="pill" title="Zakończył karierę – nie wróci do ścigania">koniec kariery</span>';
  if (!G.negs) return '';
  const out = [];
  if (r.listed) out.push(mkBadge('tl', MK_NAMES.tl));
  if (r.loanListed) out.push(mkBadge('ll', MK_NAMES.ll));
  if (r.loan) out.push(mkBadge('ol', `Wypożyczony z ${G.clubs[r.loan.parentId].name} do ${G.clubs[r.loan.toClubId].name} (do 31.10.${r.loan.season})`));
  const ag = r.nextContract ? { clubId: r.nextContract.clubId, text: `od sezonu ${r.nextContract.from}` } : r.agreed && G.negs[r.agreed] && !G.negs[r.agreed].done ? { clubId: G.negs[r.agreed].clubId, text: `rejestracja ${fmtDateShort(G.negs[r.agreed].completes)}` } : null;
  if (ag) out.push(mkBadge('ag', `${ag.clubId === (r.contract && r.contract.clubId) ? 'Przedłużył kontrakt' : `Uzgodnił kontrakt z ${G.clubs[ag.clubId].name}`} (${ag.text})`));
  const mine = userNeg(r.id);
  if (mine && mine.status !== 'agreed') out.push(mkBadge('tk', `Negocjacje z naszym klubem: ${negStatusText(mine)}`));
  const open = openNegs(r.id).filter(n => n.clubId !== G.clubId);
  const bids = open.filter(n => n.status === 'club'), offers = open.filter(n => n.status !== 'club');
  if (bids.length) out.push(mkBadge('bid', `Oferty transferowe: ${clubsShort(bids.map(n => n.clubId))}`));
  if (offers.length) out.push(mkBadge('of', `Oferty kontraktu: ${clubsShort(offers.map(n => n.clubId))}`));
  const int = interestedClubs(r).filter(id => !open.some(n => n.clubId === id));
  if (int.length && !ag) out.push(mkBadge('in', `Interesują się: ${clubsShort(int)}`));
  return out.length ? `<span class="mks">${out.join('')}</span>` : '';
}
function mkLegend() { return `<div class="mk-legend">${Object.entries(MK_NAMES).map(([k, t]) => `<span class="it">${mkBadge(k, t)}${esc(t)}</span>`).join('')}</div>`; }
function negStatusText(n) {
  if (n.status === 'club') return `${n.holderId === G.clubId ? 'czeka na naszą decyzję' : `klub ${G.clubs[n.holderId].short} odpowie`} do ${fmtDateShort(n.decideBy)}`;
  if (n.status === 'terms') return `klub się zgodził – przedstaw warunki zawodnikowi do ${fmtDateShort(n.expires)}`;
  if (n.status === 'pending') return `zawodnik odpowie do ${fmtDateShort(n.decideBy)}`;
  if (n.status === 'counter') return `kontrpropozycja – odpowiedź do ${fmtDateShort(n.expires)}`;
  if (n.status === 'agreed') return n.done ? 'uzgodniono' : `uzgodniono – rejestracja ${fmtDateShort(n.completes)}`;
  return { rejected: 'odrzucona', withdrawn: 'wycofana', expired: 'wygasła' }[n.status] || n.status;
}
function riderLink(id) { const r = G.riders[id]; return r ? `<a href="#/zawodnik/${id}">${esc(r.name)}</a>` : '—'; }
function setCtx(ids, label) { UI.ctx = { ids: ids.map(Number), label }; }
function unread() { return Object.values(G.messages).filter(m => !m.read).length; }
function bar(v, max = 100, color) { return `<div class="bar"><i style="width:${clamp(v / max * 100, 0, 100)}%;${color ? `background:${color}` : v / max < 0.5 ? 'background:var(--warn)' : ''}"></i></div>`; }
function chipLeague(lg) { return `<span class="pill">${esc(LEAGUES[lg].short)}</span>`; }
function sparkline(points, { w = 520, h = 140, min, max, fmt = v => v } = {}) {
  if (points.length < 2) return '<div class="muted small">Za mało danych – wykres pojawi się po kilku tygodniach gry.</div>';
  const vs = points.map(p => p.v), lo = min ?? Math.min(...vs) - 0.2, hi = max ?? Math.max(...vs) + 0.2;
  const X = i => 34 + (i / (points.length - 1)) * (w - 44), Y = v => 10 + (1 - (v - lo) / (hi - lo || 1)) * (h - 30);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  const ticks = [lo, (lo + hi) / 2, hi];
  return `<div class="chart"><svg viewBox="0 0 ${w} ${h}">${ticks.map(t => `<line x1="34" x2="${w - 10}" y1="${Y(t)}" y2="${Y(t)}" stroke="#242d3b"/><text x="0" y="${Y(t) + 4}">${fmt(round1(t))}</text>`).join('')}
    <path d="${d}" fill="none" stroke="var(--club)" stroke-width="2.5"/><path d="${d}L${X(points.length - 1)},${h - 20}L${X(0)},${h - 20}Z" fill="var(--club)" opacity=".12"/>
    <text x="34" y="${h - 4}">${esc(points[0].l)}</text><text x="${w - 10}" y="${h - 4}" text-anchor="end">${esc(points[points.length - 1].l)}</text></svg></div>`;
}

// ---------- Układ ----------
function renderTop() {
  const c = myClub();
  document.documentElement.style.setProperty('--club', c.colors[0]);
  document.documentElement.style.setProperty('--club2', c.colors[1]);
  const lg = LEAGUES[c.league];
  const table = leagueTable(c.league);
  const pos = table.find(r => r.clubId === c.id);
  const nf = nextFixture(c.id);
  const today = todayUserFixture();
  const opp = nf ? G.clubs[nf.homeId === c.id ? nf.awayId : nf.homeId] : null;
  $('#top').innerHTML = `
    <div class="brand" onclick="go('#/klub')">${crest(c, '')}<div><div class="club">${esc(c.name)}</div><div class="mgr">${esc(G.manager.name)} · ${typeof mgrRole === 'function' ? mgrRole() : 'menedżer'}</div></div></div>
    <div class="info">
      <div><span class="k">Data</span><span class="v">${fmtDate(G.date)}</span><span class="small muted">${DAYS[dow(G.date)]}</span></div>
      <div><span class="k">${esc(lg.short)} · sezon ${G.season}</span><span class="v">${pos && pos.m ? `${pos.pos}. miejsce · ${pos.pts} pkt` : 'przed sezonem'}</span></div>
      <div><span class="k">Następny mecz</span><span class="v">${nf ? `${nf.homeId === c.id ? 'dom' : 'wyjazd'}: ${esc(opp.short)} · ${fmtDateShort(nf.date)}` : '—'}</span></div>
      <div><span class="k">Saldo</span><span class="v ${c.cash < 0 ? 'neg' : ''}">${fmtMoney(c.cash, true)}</span></div>
    </div>
    <button class="menu-btn" onclick="ACT.mainMenu()" title="Zapis i menu główne">☰</button>
    <button class="continue ${today ? 'match' : ''} ${UI.play ? 'playing' : ''}" onclick="ACT.continue()" title="${UI.play ? 'Zatrzymaj upływ czasu' : 'Dzień po dniu (co 3 s) do najbliższego wydarzenia – kliknij ponownie, aby zatrzymać'}">${today ? `<span>Zawody<small>${esc(opp ? opp.short : '')} dziś</small></span> ▸`
      : UI.play ? '<span>Stop<small>dzień po dniu…</small></span> ■<i class="tick"></i>' : `<span>Dalej<small>${clubEventsOn(G.date).length ? 'zawody dziś' : 'dzień po dniu'}</small></span> ▸`}</button>`;
}
function renderNav(section) {
  const badges = { skrzynka: unread(), medyczne: clubRiders(G.clubId).filter(r => r.injury).length };
  $('#nav').innerHTML = NAV.map(n => n === '-' ? '<hr>' :
    `<a href="#/${n[0]}" class="${section === n[0] || NAV_PARENT[section] === n[0] ? 'on' : ''}">${icon(n[2])}<span>${n[1]}</span>${badges[n[0]] ? `<span class="badge ${n[0] === 'skrzynka' ? 'info' : ''}">${badges[n[0]]}</span>` : ''}</a>`).join('') +
    `<div class="save">${DB.local ? 'Zapis w pamięci przeglądarki' : DB.on ? `Baza: saves/${esc(G.gameId || '')}.sqlite` : '<span class="warn">Brak serwera – gra nie jest zapisywana</span>'}</div>`;
}
function render() {
  if (!G) return renderStart();
  document.body.classList.remove('start');
  const parts = (location.hash || '#/skrzynka').slice(2).split('/').filter(Boolean).map(decodeURIComponent);
  const section = parts[0] || 'skrzynka';
  const page = PAGES[section] || PAGES.skrzynka;
  renderTop();
  renderNav(section);
  let p;
  try { p = page(parts.slice(1)); } catch (e) { console.error(e); p = { title: 'Błąd', body: `<div class="content"><div class="panel neg">${esc(e.stack || e.message)}</div></div>` }; }
  const main = $('#main');
  const keep = main.dataset.page === location.hash ? main.scrollTop : 0;
  main.innerHTML = `${p.head !== undefined ? p.head : `<div class="page-head"><h1>${p.title || ''}</h1>${p.sub ? `<div class="sub">${p.sub}</div>` : ''}${p.tabs || '<div style="height:14px"></div>'}</div>`}${p.raw ? p.body : `<div class="content">${p.body}</div>`}`;
  main.dataset.page = location.hash;
  main.scrollTop = keep;
  if (p.after) p.after();
}

// ---------- Akcje globalne ----------
// Upływ czasu: „Dalej” uruchamia tryb dzień po dniu (co DAY_DELAY ms) aż do wydarzenia – meczu, zawodów z udziałem
// naszych zawodników lub nowej wiadomości. Ponowne kliknięcie zatrzymuje.
const DAY_DELAY = 3000;
ACT.continue = () => {
  if (UI.play) return stopPlay();
  if (UI.busy) return;
  if (typeof jobless === 'function' && jobless()) { UI.play = { timer: null }; renderTop(); return playStep(); } // bez pracy: czas płynie do odpowiedzi klubów
  const today = todayUserFixture();
  if (today) {
    if (!location.hash.startsWith(`#/zawody/${today.id}`)) return go(`#/zawody/${today.id}`);
    return toast('Dziś jedziesz mecz – rozegraj go (lub zasymuluj), aby przejść dalej.');
  }
  if (pendingNotify()) return stopAt({ stop: 'lineup', fixture: pendingNotify() });
  if (typeof pendingRoles === 'function' && pendingRoles().length) return stopAt({ stop: 'role', rider: pendingRoles()[0] });
  UI.play = { timer: null };
  renderTop();
  playStep();
};
function stopPlay() {
  if (!UI.play) return;
  clearTimeout(UI.play.timer);
  UI.play = null;
  if (G) renderTop();
}
async function playStep() {
  if (!UI.play || !G || UI.busy) return;
  UI.busy = true;
  let res = null;
  try {
    res = advanceDay();
    UI.cal = null;
    await dbSaveNow();
  } catch (e) { console.error(e); toast('Błąd symulacji dnia: ' + esc(e.message), 'bad'); } finally { UI.busy = false; }
  if (!G) return;
  if (!res || res.stop !== 'day') { UI.play = null; return res ? stopAt(res) : render(); }
  if (!UI.play) return render(); // zatrzymano w trakcie liczenia dnia
  softRender();
  UI.play.timer = setTimeout(playStep, DAY_DELAY);
}
function stopAt(res) {
  if (res.stop === 'sacked') return go('#/zwolniony');
  if (res.stop === 'match') return go(`#/zawody/${res.fixture.id}`);
  if (res.stop === 'sparing') { toast(`Dziś sparing: ${esc(sparName(res.sparing))} – ustaw skład i rozpocznij albo kliknij Dalej (symulacja).`); return go(`#/kalendarz/sparing/${res.sparing.id}`); }
  if (res.stop === 'lineup') { UI.tacMode = 'liga'; toast(`Termin awizacji składu na mecz ${fmtDateShort(res.fixture.date)} – ustaw i awizuj skład, aby przejść dalej.`, 'bad'); return go('#/druzyna/taktyka'); }
  if (res.stop === 'role') { toast(`${esc(res.rider.name)} ma licencję i kontrakt amatorski – przypisz mu rolę w drużynie, aby przejść dalej.`, 'bad'); return go(`#/zawodnik/${res.rider.id}`); }
  if (res.stop === 'message') { UI.inboxSel = res.message.id; if (res.count > 1) toast(`Nowe wiadomości: ${res.count}`); return go('#/skrzynka'); }
  if (res.stop === 'event') { toast(res.event.comp === 'EXAM' ? `Dziś egzamin na licencję: ${esc(examMine(res.event).join(', '))}` : `Dziś zawody z udziałem naszych zawodników: ${esc(res.event.name)}`); return go(`#/gp/${res.event.id}`); }
  render();
}
// Odświeżenie w trakcie upływu czasu bez przerywania pisania w polach formularza
function softRender() {
  const a = document.activeElement;
  if (a && a.closest && a.closest('#main') && a.matches('input,select,textarea')) { renderTop(); renderNav(((location.hash || '#/skrzynka').slice(2).split('/')[0]) || 'skrzynka'); }
  else render();
}
// Przeskok o kilka dni naraz (testy, narzędzia) – dawne działanie przycisku „Dalej”
ACT.skipDays = async (n = 7) => {
  if (UI.busy) return;
  stopPlay();
  const today = todayUserFixture();
  if (today) return go(`#/zawody/${today.id}`);
  UI.busy = true;
  try {
    const res = advance(n, { stopOnLineup: true });
    UI.cal = null;
    await dbSaveNow();
    if (res.stop === 'match') go(`#/zawody/${res.fixture.id}`);
    else if (res.stop === 'lineup' || res.stop === 'sparing') stopAt(res);
    else if (res.stop === 'message') { UI.inboxSel = res.message.id; go('#/skrzynka'); }
    else render();
  } finally { UI.busy = false; }
};
ACT.mainMenu = async () => {
  stopPlay();
  await dbSaveNow();
  G = null; UI.ctx = null;
  history.replaceState(null, '', location.pathname);
  renderStart();
};

function buildLayout() {
  $('#app').innerHTML = '<header id="top"></header><aside id="nav"></aside><main id="main"></main>';
}

// ---------- Skrzynka ----------
// Osoby w wiadomości: m.people (id zawodników/sztabu), linki #/zawodnik/<id> i #/osoba/<id> oraz pełne imiona i nazwiska
// zawodników i sztabu w tytule i treści (w kolejności pojawienia się). Bez nikogo – nadawca: osoba ze sztabu lub herb klubu.
let MSG_NAMES = null;
function msgNameIndex() {
  const n = Object.keys(G.riders).length + Object.keys(G.staff).length;
  if (MSG_NAMES && MSG_NAMES.n === n && MSG_NAMES.g === G) return MSG_NAMES.list;
  const map = new Map(), put = (name, ref, ours) => {
    if (!name || !/\S+\s+\S/.test(name) || name.length < 6) return;
    const was = map.get(name);
    if (!was || (ours && !was.ours)) map.set(name, { ...ref, ours }); // ten sam napis: pierwszeństwo dla naszego klubu
  };
  for (const r of Object.values(G.riders)) put(r.name, { k: 'r', id: r.id }, r.clubId === G.clubId);
  for (const s of Object.values(G.staff)) put(s.name, { k: 's', id: s.id }, s.clubId === G.clubId);
  MSG_NAMES = { n, g: G, list: [...map].map(([name, ref]) => ({ name: esc(name), ...ref })) };
  return MSG_NAMES.list;
}
const MSG_FROM_ROLE = { 'Trener szkółki': 'youth', 'Kierownik parku maszyn': 'mechanic', 'Trener': 'assistant', 'Asystent trenera': 'assistant', 'Kierownik drużyny': 'teamManager',
  'Lekarz klubowy': 'doctor', 'Motoryk': 'fitness', 'Dyrektor klubu': 'director', 'Toromistrz': 'track', 'Skaut': 'scout', 'Psycholog sportowy': 'psych', 'Fizjoterapeuta': 'physio' };
function msgPeople(m) {
  const out = [], seen = new Set(), add = (k, id, at) => { const key = `${k}${id}`; if (!seen.has(key) && (k === 'r' ? G.riders[id] : G.staff[id])) { seen.add(key); out.push({ k, id, at }); } };
  (m.people || []).forEach((id, i) => add(G.riders[id] ? 'r' : 's', id, -1000 + i));
  const text = `${esc(m.title)} ${m.body || ''}`;
  for (const x of text.matchAll(/#\/(zawodnik|osoba)\/([\w-]+)/g)) add(x[1] === 'zawodnik' ? 'r' : 's', x[2], x.index);
  const plain = text.replace(/<[^>]+>/g, ' ');
  for (const p of msgNameIndex()) { const at = plain.indexOf(p.name); if (at >= 0) add(p.k, p.id, at); }
  out.sort((a, b) => a.at - b.at);
  if (!out.length) {
    const role = MSG_FROM_ROLE[m.from], s = role && clubStaff(G.clubId).find(x => x.role === role && !x.player);
    if (s) out.push({ k: 's', id: s.id, sender: true });
  }
  return out;
}
function msgPeopleStrip(m) {
  const ppl = msgPeople(m);
  if (!ppl.length) {
    const club = Object.values(G.clubs).find(c => c.name === m.from || c.short === m.from) || Object.values(G.clubs).find(c => c.name && String(m.from || '').includes(c.name));
    return club ? `<div class="msg-people"><a class="pp" href="${clubHref(club.id)}">${crest(club)}<span>${esc(club.short || club.name)}</span></a></div>` : '';
  }
  const MAX = 12;
  return `<div class="msg-people">${ppl.slice(0, MAX).map(p => {
    if (p.k === 'r') { const r = G.riders[p.id], c = G.clubs[r.clubId]; return `<a class="pp" href="#/zawodnik/${r.id}" title="${esc(r.name)}">${avatar(r, c)}<span>${esc(r.name)}</span>${c ? `<small>${esc(c.short)}</small>` : ''}</a>`; }
    const s = G.staff[p.id], c = G.clubs[s.clubId];
    return `<a class="pp" href="${s.player ? '#/menedzer' : `#/osoba/${s.id}`}" title="${esc(s.name)}">${staffPic(s, silhouette(s.name, c ? c.colors[0] : undefined))}<span>${esc(s.name)}</span><small>${esc((STAFF_ROLES[s.role] || {}).name || (c ? c.short : ''))}</small></a>`;
  }).join('')}${ppl.length > MAX ? `<span class="pp more">+${ppl.length - MAX}</span>` : ''}</div>`;
}
const MSG_CATS = [['all', 'Wszystkie'], ['unread', 'Nieprzeczytane'], ['mecz', 'Mecze'], ['transfer', 'Transfery'], ['medyczne', 'Medyczne'], ['zarząd', 'Zarząd'], ['liga', 'Liga'], ['szkółka', 'Szkółka']];
PAGES.skrzynka = parts => {
  const f = parts[0] || 'all';
  let list = Object.values(G.messages).sort((a, b) => b.date.localeCompare(a.date) || Number(b.id.slice(1)) - Number(a.id.slice(1)));
  if (f === 'unread') list = list.filter(m => !m.read);
  else if (f !== 'all') list = list.filter(m => m.category === f);
  let sel = G.messages[UI.inboxSel];
  if (!sel || !list.includes(sel)) sel = list[0];
  if (sel && !sel.read) { sel.read = true; dbQueueSave(); setTimeout(() => renderNav('skrzynka'), 0); }
  UI.inboxSel = sel && sel.id;
  const a = sel && sel.action;
  return {
    title: 'Skrzynka', sub: `${unread()} nieprzeczytanych`, tabs: tabs('skrzynka', MSG_CATS.map(([k, l]) => [k === 'all' ? '' : k, l]), f === 'all' ? '' : f), raw: true,
    body: `<div class="inbox"><div class="list">${list.length ? list.map(m => `<div class="item ${m.read ? 'read' : ''} ${sel && m.id === sel.id ? 'on' : ''}" onclick="UI.inboxSel='${m.id}';render()"><span class="dot"></span><div><div class="t">${esc(m.title)}</div><div class="m"><span>${esc(m.from)}</span><span>${fmtDateShort(m.date)}</span></div></div></div>`).join('') : '<div class="empty">Brak wiadomości</div>'}</div>
      <div class="msg">${sel ? `<span class="cat">${esc(sel.category)}</span><h2>${esc(sel.title)}</h2><div class="from">Od: <b>${esc(sel.from)}</b> · ${fmtDay(sel.date)}</div>${msgPeopleStrip(sel)}<div class="body">${sel.body}</div>
        ${a && a.kind === 'neg' ? (a.state === 'open' && G.negs[a.negId] && G.negs[a.negId].status === 'club' ? `<div class="row" style="margin-top:18px"><button class="btn primary" onclick="ACT.negDecision('${a.negId}',true)">Zgoda klubu</button><button class="btn danger" onclick="ACT.negDecision('${a.negId}',false)">Odrzuć</button></div>` : `<p class="muted">${a.state === 'accepted' ? 'Oferta przyjęta przez klub.' : a.state === 'rejected' ? 'Oferta odrzucona.' : 'Oferta jest już nieaktualna.'}</p>`) : a && a.kind === 'bid' ? '<p class="muted">Oferta jest już nieaktualna.</p>' : ''}
        ${sel.link ? `<p style="margin-top:18px"><a class="btn" href="${sel.link}">Przejdź ▸</a></p>` : ''}` : '<div class="empty">Wybierz wiadomość</div>'}</div></div>`,
  };
};
ACT.negDecision = (negId, ok) => { const t = userClubDecision(negId, ok); toast(t, ok ? 'good' : ''); changed(); };

// ---------- Start aplikacji ----------
window.addEventListener('hashchange', () => { if (G) render(); });
document.addEventListener('keydown', e => {
  if (!G || e.target.closest('input,select,textarea')) return;
  if (location.hash.startsWith('#/zawodnik/') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { ACT.profileStep(e.key === 'ArrowLeft' ? -1 : 1); e.preventDefault(); }
  if (location.hash.startsWith('#/adept/') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { ACT.adeptStep(e.key === 'ArrowLeft' ? -1 : 1); e.preventDefault(); }
});
// boot: js/ui-start.js (ładowany jako ostatni)

