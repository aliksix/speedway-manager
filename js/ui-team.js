'use strict';
// Ekrany: Drużyna, Profil zawodnika, Sztab, Szkółka, Centrum medyczne.

// ---------- Karty ----------
function riderCard(r, extra = '') {
  const c = G.clubs[r.clubId];
  const age = riderAge(r);
  const role = riderRole(r);
  const lineNo = (G.lineups[G.clubId] || []).indexOf(r.id);
  return `<div class="card" style="--c1:${c ? c.colors[0] : '#445'};--c2:${c ? c.colors[1] : '#99a'}" onclick="setCtx(${JSON.stringify(UI.cardIds || [])}, '${esc(UI.cardLabel || '')}');go('#/zawodnik/${r.id}')">
    <div class="ph">${avatar(r, c)}${lineNo >= 0 && r.clubId === G.clubId ? `<span class="no">${lineNo + 1}</span>` : ''}
      <div class="tag">${r.injury ? '<span class="pill inj">kontuzja</span>' : ''}${role === 'Junior (U16)' ? `<span class="pill jun" title="Tylko zawody U-21, liga od ${fmtDate(leagueFrom(r))}">U16</span>` : isJunior(r) ? '<span class="pill jun">U21</span>' : role === 'Senior U24' ? '<span class="pill u24">U24</span>' : ''}${mkBadges(r)}</div></div>
    <div class="body">
      <div class="nm">${esc(r.name)}</div>
      <div class="meta">${flagCode(r.country)}<span><b>${age}</b> lat</span></div>
      <div class="born">ur. ${fmtDateShort(r.born)}${r.bornEst ? '*' : ''}</div>
      ${extra}
    </div></div>`;
}
function staffCard(s) {
  const role = STAFF_ROLES[s.role];
  const key = role.attrs.map(k => s.attrs[k]);
  const lvl = sum(key) / key.length;
  return `<div class="card staff" onclick="go('${s.player ? '#/menedzer' : `#/osoba/${s.id}`}')"><div class="ph">${staffPic(s, silhouette(s.name, ((G.clubs[s.clubId] || myClub()).colors || [])[0]))}</div>
    <div class="body"><div class="nm"><small>${esc(staffRoleNames(s))}${s.profile && typeof TRAIN_PROFILES !== 'undefined' ? ` · ${esc(TRAIN_PROFILES[s.profile.main].name.toLowerCase())}` : ''}</small>${esc(s.name)}</div>
      <div class="meta">${flagCode(s.country)}<span>${s.born ? `<b>${ageAt(s.born, G.date)}</b> lat` : ''}</span></div><div class="born">${s.born ? `ur. ${fmtDateShort(s.born)}` : s.real ? `<span>${esc((s.funcs || []).map(f => FUNC_LABEL[f] || f).join(', ') || 'sztab 2026')}</span>` : ''}</div>
      <div class="foot"><span>${starsPlain(clamp(lvl / 4, 0.5, 5))}</span><span class="muted">${s.player ? 'Ty' : s.clubId && s.until ? dealEndDate(s.until) : 'wolny'}</span></div></div></div>`;
}

// ---------- Drużyna ----------
PAGES.druzyna = parts => {
  let sub = parts[0] || '';
  if (sub === 'dostepnosc') { setTimeout(() => go('#/sztab/kalendarz'), 0); return { title: '', body: '' }; } // dostępność przeniesiona do Treningu
  if (sub === 'lista') { UI.teamView = 'lista'; sub = ''; }
  if (sub === 'sklad-meczowy') sub = 'taktyka';
  const rs = clubRiders(G.clubId).sort((a, b) => (isJunior(a) - isJunior(b)) || b.skill - a.skill);
  setCtx(rs.map(r => r.id), 'Drużyna');
  UI.cardIds = rs.map(r => r.id); UI.cardLabel = 'Drużyna';
  const T = tabs('druzyna', [['', 'Skład'], ['taktyka', 'Taktyka'], ['sztab', 'Sztab'], ['statystyki', 'Statystyki']], sub);
  const head = { title: `${crest(myClub())} Drużyna`, sub: `${rs.length} zawodników · ${rs.filter(r => isJunior(r)).length} juniorów · ${LEAGUES[myClub().league].name}`, tabs: T };
  if (sub === 'taktyka') return { ...head, body: tacticsView(rs) };
  if (sub === 'sztab') return { ...head, body: teamStaffView(G.clubId) };
  if (sub === 'statystyki') return { ...head, body: teamStats(rs) };
  if (sub === 'sprzet') { setTimeout(() => go('#/park'), 0); return { title: '', body: '' }; } // przeniesione do Park maszyn
  const view = UI.teamView === 'lista' ? 'lista' : 'karty';
  const toggle = viewToggle('teamView', view);
  if (view === 'lista') return { ...head, body: toggle + teamList(rs) };
  const sen = rs.filter(r => !isJunior(r)), jun = rs.filter(r => isJunior(r));
  const extra = r => `<div class="foot"><span>${caStars(r)}</span><span class="muted">${riderDeal(r) ? riderDeal(r).end : ''}</span></div>`;
  return { ...head, body: `${toggle}
    <div class="group-title">Seniorzy <span class="n">${sen.length}</span></div><div class="cards">${sen.map(r => riderCard(r, extra(r))).join('') || '<div class="empty">Brak seniorów</div>'}</div>
    <div class="group-title">Juniorzy (U21) <span class="n">${jun.length}</span></div><div class="cards">${jun.map(r => riderCard(r, extra(r))).join('') || '<div class="empty">Brak juniorów – sprawdź szkółkę lub rynek transferowy</div>'}</div>
    ${(lo => lo.length ? `<div class="group-title">Wypożyczeni do innych klubów <span class="n">${lo.length}</span></div><div class="cards">${lo.map(r => riderCard(r, `<div class="foot"><span>${caStars(r)}</span><span class="muted">${esc(G.clubs[r.loan.toClubId].short)}</span></div>`)).join('')}</div>` : '')(Object.values(G.riders).filter(r => r.loan && r.loan.parentId === G.clubId))}
    <p class="small muted" style="margin-top:18px">* data urodzenia szacunkowa (brak potwierdzonego rocznika w bazie). Zdjęcia: zawodnicy – img/riders/&lt;imię-nazwisko&gt;.png (po imporcie danych), sztab i menedżer – img/staff/&lt;imię-nazwisko&gt;.png (od razu, np. marek-cieslak.png), dzieci menedżera – img/riders/&lt;imię-nazwisko&gt;.png (od razu).</p>` };
};
// Przełącznik widoku Kafle / Lista (UI[key]: 'karty' | 'lista')
const viewToggle = (key, view) => `<div class="row" style="justify-content:flex-end;margin-bottom:10px"><div class="seg">${[['karty', 'Kafle'], ['lista', 'Lista']].map(([k, l]) => `<button class="btn sm ${view === k ? 'primary' : ''}" onclick="UI.${key}='${k}';render()">${l}</button>`).join('')}</div></div>`;
const STAFF_ORDER = () => ['coach', ...COACH_ROLES.filter(r => r !== 'coach'), 'fitness', 'psych', 'manager', 'director', 'teamManager', 'mechanic', 'track', 'physio', 'doctor', 'scout', 'miniCoach'];
// Sztab klubu (własnego lub innego): kafle według ról albo lista; w klubie gracza – menedżer (Ty), braki w obsadzie i płace
function teamStaffView(clubId = G.clubId) {
  const mine = clubId === G.clubId, c = G.clubs[clubId];
  const all = clubStaff(clubId), staff = all.filter(s => !s.player);
  const order = STAFF_ORDER(), rank = s => { const k = order.indexOf(s.role); return k < 0 ? 99 : k; };
  const view = UI.staffView === 'lista' ? 'lista' : 'karty';
  const lvlOf = s => (typeof staffLevel === 'function' ? staffLevel(s) : 10);
  const player = mine ? all.find(s => s.player) : null;
  let body;
  if (view === 'lista') {
    const rows = [...(player ? [player] : []), ...staff.slice().sort((a, b) => rank(a) - rank(b) || lvlOf(b) - lvlOf(a))];
    body = `<div class="panel flush"><table class="t"><thead><tr><th>Osoba</th><th>Rola</th><th>Kraj</th><th class="num">Wiek</th><th>Umiejętności</th><th>Specjalizacja</th><th>Kontrakt do</th><th class="num">Wynagrodzenie</th></tr></thead><tbody>
      ${rows.map(s => `<tr class="click ${s.player ? 'me' : ''}" onclick="go('#/osoba/${s.id}')"><td><span class="rider-cell">${staffPic(s, silhouette(s.name, c ? c.colors[0] : undefined), 'mini')}<b>${esc(s.name)}</b>${s.player ? ' <span class="pill jun">Ty</span>' : ''}</span></td>
        <td class="small">${esc(staffRoleNames(s))}</td><td>${flagCode(s.country)}</td><td class="num">${s.born ? ageAt(s.born, G.date) : '—'}</td><td>${starsPlain(clamp(lvlOf(s) / 4, 0.5, 5))}</td>
        <td class="small">${s.profile && typeof TRAIN_PROFILES !== 'undefined' && TRAIN_PROFILES[s.profile.main] ? esc(TRAIN_PROFILES[s.profile.main].name) : '—'}</td>${staffDealCells(s)}</tr>`).join('') || '<tr><td colspan="8" class="empty">Brak danych o sztabie</td></tr>'}</tbody></table></div>`;
  } else {
    // dwie grupy: sztab trenerski i osoby funkcyjne (z dopuszczalną liczbą miejsc)
    const sorted = staff.slice().sort((x, y) => rank(x) - rank(y));
    const coaches = sorted.filter(x => staffKind(x) === 'coach'), funcs = sorted.filter(x => staffKind(x) === 'func');
    const L = c ? staffLimits(c) : null;
    const lim = (n, l) => (l != null ? `<span class="n ${n > l ? 'neg' : n === l ? 'warn' : ''}" title="zatrudnieni / dopuszczalna liczba">${n} / ${l}</span>` : `<span class="n">${n}</span>`);
    body = staff.length || player ? `<div class="group-title">Sztab trenerski ${lim(coaches.length, L && L.coach)}</div><div class="cards">${player ? staffCard(player) : ''}${coaches.map(staffCard).join('')}</div>
      <div class="group-title">Osoby funkcyjne ${lim(funcs.length, L && L.func)}</div><div class="cards">${funcs.map(staffCard).join('') || '<div class="empty">Brak</div>'}</div>` : '<div class="panel empty">Brak danych o sztabie klubu.</div>';
  }
  if (!mine) return viewToggle('staffView', view) + body;
  const lg = myClub().league;
  const missing = COACH_ROLES.filter(r => r !== 'coach' && (r !== 'u24Coach' || lg === 'PGE') && !staff.some(s => staffRoles(s).includes(r))).map(r => STAFF_ROLES[r].name);
  return viewToggle('staffView', view) + body + `
    ${missing.length ? `<p class="small warn" style="margin-top:14px">Nieobsadzone role: ${esc(missing.join(', '))}. Trenerów znajdziesz w <a href="#/transfery" onclick="UI.tfMode='staff'">Transfery → Sztab</a>; rolę dodatkową nadasz w profilu osoby (zakładka Kontrakt).</p>` : ''}
    ${(() => { const L = staffLimits(myClub()), N = staffCounts(myClub()); return `<p class="small muted" style="margin-top:14px">Dopuszczalna liczba członków sztabu zależy od ligi i budżetu klubu (${esc(LEAGUES[lg].short)}: sztab trenerski ${L.coach}, osoby funkcyjne ${L.func}; menedżer – Ty – nie wlicza się). Gdy miejsc brakuje, jedna osoba może pełnić kilka ról – nadasz je w profilu (zakładka Kontrakt), kosztem skuteczności w każdej z nich.${N.coach > L.coach || N.func > L.func ? ' <span class="neg">Sztab ponad limitem – nowych osób nie zatrudnisz, dopóki ktoś nie odejdzie.</span>' : ''}</p>`; })()}
    <p class="small muted" style="margin-top:8px">Płace sztabu: ${fmtMoney(sum(all.map(s => s.wage || 0)), true)} / mies. Obowiązki, jakość treningu i baza: zakładka <a href="#/sztab">Trening</a>.</p>`;
}
function teamList(rs) {
  return `<div class="panel flush"><table class="t"><thead><tr><th>Zawodnik</th><th>Kraj</th><th>Wiek</th><th>Rola</th><th>Umiejętności</th><th class="num">KSM</th><th>Potencjał</th><th class="num">Forma</th><th>Kondycja</th><th>Sprzęt</th><th>Kontrakt do</th><th class="num">Wynagrodzenie</th><th class="num">Śr. biegowa</th></tr></thead><tbody>
    ${rs.map(r => { const s = r.stats[G.season]; return `<tr class="click" onclick="go('#/zawodnik/${r.id}')"><td><span class="rider-cell">${avatar(r, G.clubs[r.clubId], 'mini')}<b>${esc(r.name)}</b></span> ${r.injury ? '<span class="pill inj">K</span>' : ''}${mkBadges(r)}</td><td>${flagCode(r.country)}</td><td>${riderAge(r)}</td><td>${riderRole(r)}${typeof roleOf === 'function' && r.contract ? `<div class="small muted">${roleName(roleOf(r))}</div>` : ''}</td>
      <td>${caStars(r)}</td><td class="num">${r.ksm != null ? r.ksm.toFixed(2) : '—'}</td><td>${paStars(r)}</td><td class="num ${r.form > 0.3 ? 'pos' : r.form < -0.3 ? 'neg' : ''}">${r.form > 0 ? '+' : ''}${r.form.toFixed(1)}</td>
      <td style="width:90px">${bar(r.cond)}</td><td class="num">${eqBrief(r)}</td>${riderDealCells(r)}
      <td class="num">${s && s.heats ? ((s.pts + s.bonus) / s.heats).toFixed(3) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
}

// ---------- Taktyka: składy w stylu FM (numery, przeciąganie, wybór z listy) dla ligi, Ekstraligi U24 i DMPJ ----------
const SLOT_ROLE = ['Senior', 'Senior', 'Senior', 'Senior', 'Senior', 'Junior U21', 'Junior U21', 'Rezerwa U24'];
const last5Avg = r => { const l = (r.lastMatches || []).slice(0, 5), h = sum(l.map(x => x.heats || 0)); return h ? sum(l.map(x => x.pts + x.bonus)) / h : null; };
const formIcon = f => f > 0.8 ? '<span class="pos" title="Forma bardzo dobra">▲</span>' : f > 0.3 ? '<span class="pos" title="Forma dobra">▴</span>' : f < -0.8 ? '<span class="neg" title="Forma bardzo słaba">▼</span>' : f < -0.3 ? '<span class="neg" title="Forma słaba">▾</span>' : '<span class="muted" title="Forma przeciętna">●</span>';
const ageTags = r => `${isJunior(r) ? '<span class="pill jun">U21</span>' : isU24(r) ? '<span class="pill u24">U24</span>' : ''}`;
// Skład ligowy ustawiony przez gracza (puste numery zostają puste; przed meczem uzupełnia je validLineup)
function userLine() {
  const l = G.lineups[G.clubId];
  if (!l || l.length !== 8) return new Array(8).fill(null); // bez ustawionego składu – wszyscy poza składem (przed meczem skład uzupełnia się automatycznie)
  const seen = new Set();
  const d = (nextFixture(G.clubId) || {}).date || G.date; // warunki numeru na dzień najbliższego meczu
  return l.map((id, i) => { const r = G.riders[id]; if (r && r.clubId === G.clubId && !seen.has(id) && slotOk(r, i, undefined, d)) { seen.add(id); return id; } return null; });
}
// Skład drużyny na zawody młodzieżowe (5 zawodników): wybór gracza, a bez niego najlepsi uprawnieni (jak przy awizowaniu składów)
function compLine(mode) {
  const m = TAC[mode], st = (G.compLineups || {})[mode];
  if (!st) return new Array(m.n).fill(null); // bez wybranego składu – klub awizuje najlepszych uprawnionych
  const seen = new Set();
  return Array.from({ length: m.n }, (_, i) => { const r = G.riders[st[i]]; if (r && r.clubId === G.clubId && !seen.has(r.id) && m.ok(r)) { seen.add(r.id); return r.id; } return null; });
}
function compAuto(mode) {
  const m = TAC[mode];
  const ids = clubRiders(G.clubId).filter(r => m.ok(r) && available(r, G.date)).sort(by(r => r.skill, -1)).slice(0, m.n).map(r => r.id);
  return Array.from({ length: m.n }, (_, i) => ids[i] ?? null);
}
const TAC = {
  liga: { name: 'Liga', n: 8, label: i => SLOT_ROLE[i], ok: (r, i) => slotOk(r, i, myClub().league, tacDate()), get: () => userLine(), set: l => { G.lineups[G.clubId] = l; }, auto: () => autoLineup(G.clubId),
    why: (r, i) => u16(r, tacDate()) ? `Licencja przed 16. urodzinami: tylko zawody U-21, w lidze od ${fmtDate(leagueFrom(r))}.` : i === 5 || i === 6 ? (myClub().league === 'PGE' ? 'Na numerach 6–7 jadą tylko juniorzy (U21).' : 'Na numerach 6–7 jadą tylko polscy juniorzy (U21).') : i === 7 ? 'Na numerze 8 (rezerwa) może jechać tylko zawodnik U24.' : '',
    rules: 'Numery 1–5 – seniorzy (wśród nich co najmniej jeden zawodnik U24); tu można też zgłosić zawodnika zastępowanego (ZZ): kontuzjowanego zawodnika z dwójki najlepszych (przerwa od 15 dni) albo zawodnika z piątki najlepszych startującego tego dnia w zawodach FIM lub finale SEC (art. 711–712). 6–7 – juniorzy U21 (w 2. Ekstralidze i KLŻ tylko polscy, w PGE co najmniej jeden polski), 8 – rezerwa U24. Na numerach 1–7 co najmniej 4 Polaków. Na wyjeździe drużyna jedzie z numerami 1–8, u siebie 9–16. Biegi 14 i 15 są nominowane w trakcie meczu.' },
  U24E: { name: 'Ekstraliga U24', n: 5, comp: 'U24E', label: () => 'Zawodnik U24', ok: r => u24eEligible(r, sportSeason()), why: r => ageIn(r, sportSeason()) > 24 ? 'W Ekstralidze U24 jadą tylko zawodnicy, którzy w sezonie kończą najwyżej 24 lata.' : `Średnia ligowa w poprzednim sezonie ${(prevLeagueAvg(r, sportSeason()) || 0).toFixed(3)} – w Ekstralidze U24 mogą jechać tylko zawodnicy ze średnią poniżej 1,400.`,
    rules: 'Ekstraliga U24: pięciu zawodników do 24 lat (rocznikowo w sezonie) ze średnią ligową w poprzednim sezonie poniżej 1,400; w składzie co najmniej 2 Polaków i 2 obcokrajowców (jeśli klub ich ma – braki uzupełnia się przy awizowaniu). Bez wybranego składu klub awizuje najlepszych uprawnionych zawodników.' },
  DMPJ: { name: 'DMPJ', n: 5, comp: 'DMPJ', label: () => 'Junior U21', ok: r => ageIn(r, sportSeason()) <= 21 && polEligible(r), why: () => 'W DMPJ jadą tylko polscy juniorzy (do 21 lat rocznikowo).',
    rules: 'Drużynowe Mistrzostwa Polski Juniorów: pięciu polskich juniorów (U21). Bez wybranego składu klub awizuje najlepszych uprawnionych zawodników.' },
};
for (const k of ['U24E', 'DMPJ']) Object.assign(TAC[k], { get: () => compLine(k), set: l => { (G.compLineups = G.compLineups || {})[k] = l; }, auto: () => compAuto(k) });
const tacModes = () => ['liga', ...(myClub().league === 'PGE' ? ['U24E'] : []), 'DMPJ'];
const tacMode = () => tacModes().includes(UI.tacMode) ? UI.tacMode : 'liga';
// Data, na którą ustawiany jest skład: najbliższy mecz ligowy (liga) albo dziś
const tacDate = () => (tacMode() === 'liga' && nextFixture(G.clubId) ? nextFixture(G.clubId).date : G.date);
// Zawodnik zastępowany (ZZ, art. 711–712): kontuzjowany lider albo zawodnik startujący tego dnia w zawodach FIM – tylko numery 1–5 w lidze
const tacZZ = r => tacMode() === 'liga' && typeof zzEligible === 'function' && zzEligible(r, G.clubId, tacDate());
const tacFree = r => available(r, tacDate()) && !(typeof fimBusy === 'function' && tacMode() === 'liga' && fimBusy(r, tacDate()));
function tacticsView(rs) {
  const mode = tacMode(), M = TAC[mode];
  const line = M.get();
  const pick = UI.pickSlot;
  const nextEv = M.comp ? Object.values(G.events).filter(e => e.comp === M.comp && !e.played && e.date >= G.date && (!e.units || e.units.some(u => u.clubId === G.clubId))).sort(by(e => e.date))[0] : null;
  const nf = mode === 'liga' ? nextFixture(G.clubId) : null;
  const title = mode === 'liga' ? `Skład na mecz${nf ? `: ${nf.homeId === G.clubId ? 'u siebie z' : 'na wyjeździe z'} ${esc(G.clubs[nf.homeId === G.clubId ? nf.awayId : nf.homeId].name)} (${fmtDateShort(nf.date)})` : ''}`
    : `Skład: ${M.name}${nextEv ? ` – najbliższe zawody ${fmtDateShort(nextEv.date)}${nextEv.venue ? `, ${esc(nextEv.venue)}` : ''}${nextEv.units ? ' (składy już awizowane)' : ''}` : ''}`;
  const warn = [];
  const empty = line.map((id, i) => id ? null : i + 1).filter(Boolean);
  if (empty.length && mode === 'liga') { /* braki w lidze pokazuje ramka awizacji */ } else if (empty.length) warn.push(empty.length === line.length ? (mode === 'liga' ? '' : 'Skład nie jest wybrany – klub awizuje najlepszych uprawnionych zawodników.') : `Puste numery: ${empty.join(', ')} – przed zawodami zostaną uzupełnione automatycznie.`);
  // liga: warunki składu (U24, zawodnicy krajowi, juniorzy) pokazuje ramka awizacji (lineupProblems)
  if (mode === 'U24E' && line.some(Boolean)) {
    const ls = line.filter(Boolean).map(id => G.riders[id]), pol = ls.filter(r => isDomestic(r, G.clubId)).length, fr = ls.length - pol;
    const avP = clubRiders(G.clubId).filter(r => M.ok(r) && isDomestic(r, G.clubId)).length, avF = clubRiders(G.clubId).filter(r => M.ok(r) && !isDomestic(r, G.clubId)).length;
    if (pol < Math.min(2, avP) || fr < Math.min(2, avF)) warn.push('W składzie Ekstraligi U24 powinno być co najmniej 2 Polaków i 2 obcokrajowców – przy awizowaniu skład zostanie uzupełniony.');
  }
  if (mode !== 'liga' && clubRiders(G.clubId).filter(r => M.ok(r)).length < M.n) warn.push(`Klub ma tylko ${clubRiders(G.clubId).filter(r => M.ok(r)).length} uprawnionych zawodników.`);
  const cells = (r, i) => {
    const a = r ? last5Avg(r) : null;
    return `<td>${r ? `<span class="rider-cell">${avatar(r, G.clubs[r.clubId], 'mini')}<a href="#/zawodnik/${r.id}" onclick="event.stopPropagation()"><b>${esc(r.name)}</b></a> ${flagCode(r.country)} ${ageTags(r)}${r.injury ? ' <span class="pill inj">kontuzja</span>' : ''}${tacZZ(r) ? ' <span class="pill" title="Zawodnik zastępowany (art. 711–712): jego biegi przejmują koledzy z drużyny">ZZ – zawodnik zastępowany</span>' : !tacFree(r) && typeof fimBusy === 'function' && fimBusy(r, tacDate()) ? ' <span class="pill inj" title="Tego dnia startuje w zawodach FIM">zawody FIM</span>' : ''}</span>` : `<span class="muted">${i != null ? (pick === i ? '▸ wybierz zawodnika z listy poniżej' : 'Wybór zawodnika…') : ''}</span>`}</td>
      <td>${r ? caStars(r) : ''}</td><td style="width:110px">${r ? `${bar(r.cond)}<span class="small muted">${Math.round(r.cond)}%</span>` : ''}</td><td class="num">${r ? formIcon(r.form) : ''}</td>
      <td class="num">${a != null ? `<b>${a.toFixed(2)}</b>` : r ? '—' : ''}</td><td class="small muted">${r ? (r.lastMatches || []).slice(0, 5).map(x => `${x.pts}+${x.bonus}`).join(' · ') : ''}</td>`;
  };
  const slotRows = line.map((id, i) => { const r = G.riders[id];
    return `<tr class="tac-slot ${pick === i ? 'picking' : ''} ${mode === 'liga' && i >= 5 ? 'jun' : ''}" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="ACT.dropSlot(${i})" onclick="ACT.pickSlot(${i})"
      ${r ? `draggable="true" ondragstart="UI.drag={id:${r.id},from:${i}}"` : ''}><td class="no">${i + 1}</td><td class="small">${M.label(i)}</td>${cells(r, i)}<td>${r ? `<button class="btn sm ghost" title="Usuń ze składu" onclick="event.stopPropagation();ACT.clearSlot(${i})">×</button>` : ''}</td></tr>`; }).join('');
  // Ekstraliga U24 i DMPJ: na liście tylko zawodnicy uprawnieni i dostępni
  const rest = rs.filter(r => !line.includes(r.id) && !(r.loan && r.loan.parentId === G.clubId && r.clubId !== G.clubId) && (mode === 'liga' || (M.ok(r) && available(r, G.date))));
  const restRows = rest.map(r => { const elig = mode === 'liga' ? !u16(r, tacDate()) : M.ok(r), can = tacFree(r) || tacZZ(r), ok = elig && (pick == null || (M.ok(r, pick) && (tacFree(r) || (tacZZ(r) && pick < 5))));
    return `<tr class="tac-free ${ok ? '' : 'dim'}" draggable="${elig && can}" ondragstart="UI.drag={id:${r.id},from:-1}" ${pick != null && ok ? `onclick="ACT.assignPick(${r.id})" style="cursor:pointer"` : ''} ${elig ? '' : `title="${esc(M.why(r))}"`}><td class="no">–</td><td class="small muted">${riderRole(r)}</td>${cells(r, null)}<td></td></tr>`; }).join('');
  const switcher = tacModes().length > 1 ? `<div class="seg">${tacModes().map(k => `<button class="btn sm ${mode === k ? 'primary' : ''}" onclick="UI.tacMode='${k}';UI.pickSlot=null;render()">${TAC[k].name}</button>`).join('')}</div>` : '';
  return `<div class="row" style="justify-content:space-between;margin-bottom:10px">${switcher}<span class="small muted">${mode === 'liga' ? '' : 'Skład jest zapamiętany i używany przy awizowaniu składów na każde zawody tych rozgrywek.'}</span></div>
    ${mode === 'liga' ? notifyBox(nf, line) : ''}
    <div class="panel flush"><div class="ph"><h3>${title}</h3>
      <div class="row">${pick != null ? `<button class="btn sm" onclick="ACT.pickSlot(null)">Anuluj wybór</button>` : ''}<button class="btn sm" onclick="ACT.autoLineup()">Wybierz automatycznie</button></div></div>
    <table class="t tactics"><thead><tr><th>Nr</th><th>Pozycja</th><th>Zawodnik</th><th>Umiejętności</th><th>Kondycja</th><th class="num">Forma</th><th class="num" title="Średnia biegowa z ostatnich 5 występów (pkt + bonusy na bieg)">Śr. 5 ost.</th><th>Ostatnie występy</th><th></th></tr></thead>
      <tbody>${slotRows}</tbody>
      <tbody class="tac-rest" ondragover="event.preventDefault()" ondrop="ACT.dropOut()"><tr class="sep"><td colspan="9">${pick != null ? `Wybierz zawodnika na numer ${pick + 1} (${M.label(pick).toLowerCase()}) – kliknij w wiersz` : 'Pozostali zawodnicy – przeciągnij na numer albo kliknij wolny numer, aby wybrać z listy'}</td></tr>${restRows || '<tr><td colspan="9" class="empty">Brak pozostałych zawodników</td></tr>'}</tbody></table></div>
    ${warn.length ? `<div class="reply counter" style="margin-top:12px">${warn.map(esc).join('<br>')}</div>` : ''}
    <p class="small muted" style="margin-top:10px">${M.rules}</p>`;
}
// Ramka awizacji składu ligowego: termin (art. 48 ust. 2 RZMoT), braki, przycisk; po awizacji – licznik zmian (art. 710 ust. 4)
function notifyBox(nf, line) {
  if (!nf) return '';
  const base = notifiedLine(nf, G.clubId), dl = notifyDate(nf), hour = nf.homeId === G.clubId ? '15:00' : '14:00';
  if (base) {
    const ch = lineChanges(base, line), probs = lineupProblems(G.clubId, line, nf.date);
    return `<div class="reply" style="margin-bottom:12px"><b>Skład awizowany</b> na mecz ${fmtDateShort(nf.date)}. Zmiany w zgłoszeniu do zawodów: <b>${ch}/${MAX_LINE_CHANGES}</b> – inny zawodnik pod numerem albo wpis pod pustym numerem; zamiany numerów startowych są niedopuszczalne.
      ${probs.length ? `<div class="small warn" style="margin-top:6px">${probs.map(esc).join('<br>')}</div>` : ''}
      ${(() => { const fx = probs.length && G.date === nf.date && ch < MAX_LINE_CHANGES ? matchDayFixes(nf) : []; return fx.length ? `<div class="row" style="margin-top:8px"><button class="btn primary sm" onclick="ACT.matchDayFix()">Wstaw zastępstwa</button><span class="small muted">${esc(fixesText(fx))}</span></div>` : ''; })()}</div>`;
  }
  const probs = lineupProblems(G.clubId, line, nf.date), block = lineupBlocking(G.clubId, line, nf.date), cons = lineupConsequences(G.clubId, line), due = G.date >= dl;
  const can = due && !block.length && line.some(Boolean);
  return `<div class="reply ${due ? 'counter' : ''}" style="margin-bottom:12px"><b>Awizacja składu</b> na mecz ${fmtDateShort(nf.date)} – termin: ${fmtDate(dl)}, godz. ${hour}${due ? ` – <b>${G.date === dl ? 'dziś mija termin' : 'termin minął'}, upływ czasu czeka na skład</b>` : ''}.
    ${probs.length ? `<div class="small" style="margin-top:6px">${probs.map(esc).join('<br>')}</div>` : ''}
    ${cons.length ? `<div class="small warn" style="margin-top:6px">${cons.map(esc).join('<br>')}</div>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn ${can && !probs.length ? 'primary' : can ? 'danger' : ''}" onclick="ACT.notifyLineup()" ${can ? '' : 'disabled'}>${can && probs.length ? 'Awizuj niepełny skład' : 'Awizuj skład'}</button>${!due ? `<span class="small muted">Awizacja możliwa od ${fmtDate(dl)}.</span>` : ''}</div>
    <p class="small muted" style="margin-top:6px">Składy podaje się 3 dni przed meczem (gość do 14:00, gospodarz do 15:00). Później, w zgłoszeniu do zawodów, dozwolone są najwyżej ${MAX_LINE_CHANGES} zmiany nazwisk, bez zamian numerów startowych.</p></div>`;
}
ACT.notifyLineup = () => {
  const nf = nextFixture(G.clubId); if (!nf) return;
  const line = userLine(), b = lineupBlocking(G.clubId, line, nf.date), cons = lineupConsequences(G.clubId, line);
  if (b.length) return toast(b[0], 'bad');
  if (!line.some(Boolean)) return toast('Wpisz zawodników do składu.', 'bad');
  if (G.date < notifyDate(nf)) return toast(`Awizacja możliwa od ${fmtDate(notifyDate(nf))}.`, 'bad');
  (nf.notified = nf.notified || {})[G.clubId] = line.slice(); G.lineups[G.clubId] = line.slice();
  if (cons.length) addMsg({ category: 'mecz', from: 'GKSŻ', title: `Awizowany niepełny skład na mecz ${fmtDateShort(nf.date)}`, body: `<p>${cons.map(esc).join('</p><p>')}</p>`, link: '#/druzyna/taktyka' });
  toast(`Skład na mecz ${fmtDateShort(nf.date)} awizowany${cons.length ? ' – skład niepełny' : ''}.`, cons.length ? 'bad' : 'good'); changed();
};
// Liga po awizacji: najwyżej 3 zmiany nazwisk względem awizowanego składu, bez zamian numerów startowych
function tacLeagueGuard(line) {
  if (tacMode() !== 'liga') return null;
  const base = notifiedLine(nextFixture(G.clubId), G.clubId);
  if (!base) return null;
  if (numberSwap(base, line)) return 'Po awizacji nie można zamieniać numerów startowych zawodników z awizowanego składu.';
  if (lineChanges(base, line) > MAX_LINE_CHANGES) return `Po awizacji dozwolone są najwyżej ${MAX_LINE_CHANGES} zmiany nazwisk względem awizowanego składu.`;
  return null;
}
// Dzień meczu: skład niepełny lub z niedostępnym zawodnikiem, a regulamin pozwala go poprawić – gracz musi to zrobić
// Dzień meczu: zmiennicy za niedostępnych z awizowanego składu – [{ i, out, cand: [zawodnicy] }]
// (zawodnik spoza awizacji albo na swoim numerze, dostępny, spełniający warunki numeru; regulamin: najwyżej MAX_LINE_CHANGES zmian)
function matchDayFixes(f) {
  const line = userLine(), base = notifiedLine(f, G.clubId) || line, lg = myClub().league;
  const okR = (r, i) => !line.includes(r.id) && (!base.includes(r.id) || base[i] === r.id) && available(r, f.date) && !fimBusy(r, f.date) && slotOk(r, i, lg, f.date);
  const weak = i => { const r = G.riders[line[i]]; return !r || !(available(r, f.date) && !fimBusy(r, f.date)) && !(i < 5 && zzEligible(r, G.clubId, f.date)); };
  return [0, 1, 2, 3, 4, 5, 6].filter(weak).map(i => ({ i, out: line[i], cand: clubRiders(G.clubId).filter(r => okR(r, i)).sort(by(r => r.skill, -1)) })).filter(x => x.cand.length);
}
const fixesText = fx => fx.map(x => `na nr ${x.i + 1}: ${x.cand.slice(0, 3).map(r => r.name).join(' / ')}`).join('; ');
function matchDayIssue(f) {
  const line = userLine(), base = notifiedLine(f, G.clubId) || line, probs = lineupProblems(G.clubId, line, f.date);
  if (!probs.length || lineChanges(base, line) >= MAX_LINE_CHANGES) return null;
  const fx = matchDayFixes(f);
  return fx.length ? `${probs[0]} Możesz wstawić – ${fixesText(fx)} (albo przycisk „Wstaw zastępstwa” w Taktyce).` : null;
}
// Wstawia najlepszych dostępnych zmienników za niedostępnych, w limicie zmian w zgłoszeniu do zawodów
ACT.matchDayFix = () => {
  const f = nextFixture(G.clubId); if (!f) return;
  const base = notifiedLine(f, G.clubId), line = userLine().slice(), used = new Set(), done = [];
  for (const x of matchDayFixes(f)) {
    if (base && lineChanges(base, line) >= MAX_LINE_CHANGES) break;
    const r = x.cand.find(r => !used.has(r.id)); if (!r) continue;
    line[x.i] = r.id; used.add(r.id); done.push(`nr ${x.i + 1}: ${r.name}`);
  }
  if (!done.length) return toast('Nie ma kim zastąpić niedostępnych zawodników.', 'bad');
  G.lineups[G.clubId] = line; changed(); toast(`Wstawiono: ${done.join(', ')}.`, 'good');
};
function putSlot(i, id) {
  const M = TAC[tacMode()], r = G.riders[id];
  if (!r || r.clubId !== G.clubId) return;
  const zz = !tacFree(r) && tacZZ(r);
  if (!tacFree(r) && !zz) return toast(`${r.name} jest niedostępny w dniu meczu (kontuzja, zawieszenie albo zawody FIM).`, 'bad');
  if (zz && i >= 5) return toast(`${r.name} może być zgłoszony tylko jako zawodnik zastępowany (ZZ) na numerach 1–5.`, 'bad');
  if (!M.ok(r, i)) return toast(M.why(r, i), 'bad');
  const line = M.get().slice(), j = line.indexOf(id), other = line[i];
  if (j >= 0 && other && !M.ok(G.riders[other], j)) return toast(`${G.riders[other].name} nie może zająć numeru ${j + 1}. ${M.why(G.riders[other], j)}`, 'bad');
  if (j >= 0) line[j] = other || null;
  line[i] = id;
  const g = tacLeagueGuard(line); if (g) return toast(g, 'bad');
  M.set(line); UI.pickSlot = null;
  changed();
}
ACT.autoLineup = () => { const M = TAC[tacMode()], l = M.auto(), g = tacLeagueGuard(l); if (g) return toast(g, 'bad'); M.set(l); UI.pickSlot = null; changed(); };
ACT.pickSlot = i => { UI.pickSlot = UI.pickSlot === i ? null : i; render(); };
ACT.assignPick = id => { if (UI.pickSlot != null) putSlot(UI.pickSlot, id); };
ACT.dropSlot = i => { const d = UI.drag; UI.drag = null; if (d) putSlot(i, d.id); };
ACT.dropOut = () => { const d = UI.drag; UI.drag = null; if (d && d.from >= 0) ACT.clearSlot(d.from); };
ACT.clearSlot = i => { const M = TAC[tacMode()], line = M.get().slice(); line[i] = null; M.set(line); changed(); };
ACT.setSlot = (i, v) => putSlot(i, v ? Number(v) : null);
function teamStats(rs) {
  const rows = rs.map(r => ({ r, s: r.stats[G.season] || { m: 0, heats: 0, pts: 0, bonus: 0, w: 0, falls: 0, def: 0, exc: 0 } })).sort(by(x => x.s.heats ? (x.s.pts + x.s.bonus) / x.s.heats : -1, -1));
  return `<div class="panel flush"><table class="t"><thead><tr><th>Zawodnik</th><th class="num">Mecze</th><th class="num">Biegi</th><th class="num">Pkt</th><th class="num">Bonusy</th><th class="num">Średnia</th><th class="num">Wygrane</th><th class="num">Upadki</th><th class="num">Defekty</th><th class="num">Wyklucz.</th><th>Ostatnie mecze</th></tr></thead><tbody>
    ${rows.map(({ r, s }) => `<tr class="click" onclick="go('#/zawodnik/${r.id}/statystyki')"><td><b>${esc(r.name)}</b></td><td class="num">${s.m}</td><td class="num">${s.heats}</td><td class="num">${s.pts}</td><td class="num">${s.bonus}</td>
      <td class="num"><b>${s.heats ? ((s.pts + s.bonus) / s.heats).toFixed(3) : '—'}</b></td><td class="num">${s.w}</td><td class="num">${s.falls}</td><td class="num">${s.def}</td><td class="num">${s.exc}</td>
      <td class="small muted">${r.lastMatches.slice(0, 4).map(x => `${x.pts}+${x.bonus}`).join(' · ')}</td></tr>`).join('')}</tbody></table></div>`;
}
// teamEquipment, profEquip – js/ui-equipment.js

// ---------- Podgląd innej drużyny ----------
PAGES.zespol = parts => {
  const c = G.clubs[parts[0]];
  if (!c) return { title: 'Nie znaleziono klubu', body: '' };
  if (c.id === G.clubId) { setTimeout(() => go('#/druzyna'), 0); return { title: '', body: '' }; }
  const sub = parts[1] || '';
  document.documentElement.style.setProperty('--club', c.colors[0]);
  const rs = clubRiders(c.id).sort((a, b) => (isJunior(a) - isJunior(b)) || b.skill - a.skill);
  setCtx(rs.map(r => r.id), c.name);
  UI.cardIds = rs.map(r => r.id); UI.cardLabel = c.name;
  const t = leagueTable(c.league).find(r => r.clubId === c.id);
  const T = tabs(`zespol/${c.id}`, [['', 'Skład'], ['sztab', 'Sztab'], ['terminarz', 'Terminarz'], ['klub', 'Klub'], ['zarzad', 'Zarząd'], ['historia', 'Historia']], sub === 'lista' ? '' : sub);
  const head = { title: `${crest(c, 'lg')} ${esc(c.name)}`, sub: `${leagueLogo(c.league, 'sm')} ${LEAGUES[c.league].name}${!clubActive(c) ? ' · <span class="warn">nie startuje w tym sezonie</span>' : ''}${t && t.m ? ` · ${t.pos}. miejsce, ${t.pts} pkt` : ''} · ${rs.length} zawodników`, tabs: T };
  if (sub === 'sztab') return { ...head, body: teamStaffView(c.id) };
  if (sub === 'zarzad') return { ...head, body: boardPage(c) };
  const view = sub === 'lista' || UI.teamView === 'lista' ? 'lista' : 'karty'; // „lista” – dawny adres zakładki „Lista zawodników”
  if (view === 'lista') return { ...head, body: viewToggle('teamView', view) + teamList(rs) };
  if (sub === 'terminarz') {
    const fx = clubFixtures(c.id);
    return { ...head, body: fx.length ? `<div class="panel flush"><table class="t"><tbody>${fx.map(fixtureRow).join('')}</tbody></table></div>` : '<div class="panel empty">Terminarz sezonu nie został jeszcze opublikowany.</div>' };
  }
  if (sub === 'klub') {
    const sp = Object.values(G.sponsors).filter(s => s.clubId === c.id && s.until >= G.season).sort(by(s => s.perYear, -1));
    const staff = clubStaff(c.id);
    return { ...head, body: `<div class="grid g3"><div class="panel"><h3>Informacje</h3><div class="kv"><div>Miasto</div><div>${esc(c.city)}</div><div>Planowane przychody ${sportSeason()}</div><div>${revenueLabel(c)}</div><div>Reputacja</div><div>${stars(c.rep / 20)}</div><div>Baza kibiców</div><div>${fmtNum(c.fans)}</div><div>Cel zarządu</div><div>${esc(c.objective.text || '')}</div></div></div>
      <div class="panel"><h3>Stadion</h3><div class="kv"><div>Obiekt</div><div>${esc(c.stadium.name)}</div><div>Pojemność</div><div>${fmtNum(c.stadium.capacity)}</div><div>Frekwencja</div><div>${fmtNum(typeof avgAttendance === 'function' && c.fin ? avgAttendance(c) : c.stadium.attendance)}</div><div>Tor</div><div>${c.stadium.track} m</div><div>Rekord toru</div><div>${c.stadium.record ? `${c.stadium.record.time.toFixed(2).replace('.', ',')} s – ${riderLink(c.stadium.record.riderId)}` : '—'}</div></div></div>
      <div class="panel"><h3>Sponsorzy</h3>${sp.map(s => `<div class="row small"><b class="grow">${esc(s.name)}</b><span class="muted">${esc(s.kind)}</span></div>`).join('') || '<p class="muted">Brak danych</p>'}</div>
      <div class="panel" style="grid-column:1/-1"><h3>Sztab</h3><div class="row wrap">${staff.map(s => `<span class="pill" style="text-transform:none">${STAFF_ROLES[s.role].name}: ${esc(s.name)}</span>`).join(' ') || '<span class="muted">Brak danych</span>'}</div></div></div>` };
  }
  if (sub === 'historia') return { ...head, body: clubHistoryView(c, false) };

  const sen = rs.filter(r => !isJunior(r)), jun = rs.filter(r => isJunior(r));
  const extra = r => `<div class="foot"><span>${caStars(r)}</span><span class="muted">${riderDeal(r) ? riderDeal(r).end : ''}</span></div>`;
  return { ...head, body: `${viewToggle('teamView', view)}<div class="group-title">Seniorzy <span class="n">${sen.length}</span></div><div class="cards">${sen.map(r => riderCard(r, extra(r))).join('') || '<div class="empty">Brak seniorów</div>'}</div>
    <div class="group-title">Juniorzy (U21) <span class="n">${jun.length}</span></div><div class="cards">${jun.map(r => riderCard(r, extra(r))).join('') || '<div class="empty">Brak juniorów</div>'}</div>` };
};

// ---------- Profil zawodnika ----------
const PROFILE_TABS = [['', 'Przegląd'], ['kontrakt', 'Kontrakt'], ['statystyki', 'Statystyki'], ['historia', 'Historia'], ['terminarz', 'Terminarz'], ['rozwoj', 'Rozwój'], ['medyczne', 'Medyczne']];
ACT.profileStep = d => {
  const parts = location.hash.slice(2).split('/');
  const id = Number(parts[1]);
  const ids = UI.ctx && UI.ctx.ids.includes(id) ? UI.ctx.ids : null;
  if (!ids) return;
  const next = ids[ids.indexOf(id) + d];
  if (next != null) go(`#/zawodnik/${next}${parts[2] ? '/' + parts[2] : ''}`);
};
PAGES.zawodnik = parts => {
  if (parts[1] === 'sprzet') { setTimeout(() => go(`#/park/zawodnik/${parts[0]}`), 0); return { title: '', body: '' }; } // sprzęt – sekcja Park maszyn
  const r = G.riders[parts[0]];
  if (!r) return { title: 'Nie znaleziono zawodnika', body: '' };
  const sub = parts[1] || '';
  const c = G.clubs[r.clubId], mine = r.clubId === G.clubId;
  if (!UI.ctx || !UI.ctx.ids.includes(r.id)) setCtx(c ? clubRiders(c.id).sort(by(x => x.skill, -1)).map(x => x.id) : [r.id], c ? c.name : 'Zawodnik');
  const ids = UI.ctx.ids, i = ids.indexOf(r.id);
  const age = riderAge(r);
  if (c) { document.documentElement.style.setProperty('--club', c.colors[0]); }
  const k = r.contract;
  const role = riderRole(r);
  const tag = role === 'Junior (U16)' ? 'U16' : /Junior/.test(role) ? 'U21' : role === 'Senior U24' ? 'U24' : '';
  const head = `<div class="page-head"><div class="profile-head"><div class="avatar-wrap">${avatar(r, c)}${tag ? `<span class="pill ${tag === 'U24' ? 'u24' : 'jun'} avatar-tag">${tag}</span>` : ''}</div>
    <div class="who"><h1>${esc(r.name)}${mkBadges(r)}</h1>
      <div class="facts">${plBanned(r) ? `<span class="pill inj" title="${esc(plBanText(r))}">bez startów w Polsce i FIM</span>` : fimBanned(r) ? `<span class="pill inj" title="${esc(fimBanText(r))}">bez startów FIM</span>` : ''}<span class="pill ${/Junior/.test(role) ? 'jun' : /U24/.test(role) ? 'u24' : ''}">${role}</span><span class="fc">${(r.nationalities || [r.country]).map(cc => countryLink(cc)).join(' / ')}</span>
        <span><b>${age} lat</b> · ur. ${fmtDate(r.born)}${r.bornEst ? ' (szac.)' : ''}${r.birthPlace ? `, ${esc(r.birthPlace)}` : ''}</span>${u16(r) ? `<span class="warn" title="Licencja przed 16. urodzinami: do tego dnia tylko zawody z udziałem zawodników U-21">liga od ${fmtDate(leagueFrom(r))}</span>` : ''}</div></div>
    <div class="contract-box">${c ? `<div class="clubname">${crest(c, 'lg')}<div><a href="${clubHref(c.id)}"><b>${esc(c.name)}</b></a><div class="small muted">${r.loan ? `wypożyczony z ${esc(G.clubs[r.loan.parentId].short)} do 31.10.${r.loan.season}` : k ? `kontrakt ${esc(k.kind)} do końca sezonu ${k.until}${schoolOnLoan(r) ? ` – wypożyczony ze szkółki ${esc(rightsSchool(r).short)}` : ''}` : 'bez kontraktu'}${r.nextContract && r.nextContract.clubId !== (k && k.clubId) ? `<br>od ${r.nextContract.from}: ${esc(G.clubs[r.nextContract.clubId].short)}` : ''}</div></div></div>`
      : `<div><b>${r.retired ? 'zakończył karierę' : !r.active ? 'bez klubu – licencja wygasła' : rightsSchool(r) ? `zawodnik szkółki ${esc(rightsSchool(r).short)}` : 'wolny zawodnik'}</b><div class="small muted">${rightsSchool(r) ? 'karta w szkółce – sprzedaż lub wypożyczenie' : 'bez kontraktu'}</div></div>`}</div>
    <div class="coach-box"><div class="small muted">Ocena trenera</div>
      <div class="row" style="gap:18px"><div><div class="small muted">Obecnie</div>${caStars(r)}</div><div><div class="small muted">Potencjał</div>${paStars(r)}</div></div>
      <div class="small" style="margin-top:4px">${esc(coachSummary(r))}</div></div></div>
    <div class="tabs-row">${tabs(`zawodnik/${r.id}`, PROFILE_TABS, sub === 'starty' ? 'statystyki' : sub)}
      <div class="profile-nav"><button class="arrow" ${i > 0 ? '' : 'disabled'} onclick="ACT.profileStep(-1)" title="Poprzedni (←)">‹</button><div class="pos">${i + 1} / ${ids.length}<br><span class="small">${esc(UI.ctx.label)}</span></div><button class="arrow" ${i < ids.length - 1 ? '' : 'disabled'} onclick="ACT.profileStep(1)" title="Następny (→)">›</button></div></div></div>`;
  const body = { '': profOverview, atrybuty: profOverview, kontrakt: profContract, statystyki: profStats, starty: profStarts, historia: profHistory, terminarz: typeof profSchedule === 'function' ? profSchedule : profOverview, rozwoj: profDev, medyczne: profMedical }[sub] || profOverview;
  return { head, body: body(r) };
};
function attrGroup(r, g, K = knowledge(r)) {
  return g.list.map(([k, n]) => attrCell(r, k, n, K)).join('');
}
// Panel atrybutów (zawodnik i adept), tak jak zna je sztab: Technika | Mentalne + Przywództwo | Fizyczne, Warsztat, Inne
function attrPanel(x) {
  const K = knowledge(x);
  const note = K >= 0.95 ? '' : K >= 0.75 ? 'Część ocen to przedziały – sztab nie jest ich pewien.'
    : K >= 0.5 ? 'Zawodnik znany częściowo – obserwuj go, by poznać więcej cech.' : 'Zawodnik słabo znany – większość cech to przypuszczenia. Dodaj go do obserwowanych.';
  const col = (title, list) => `<h4 style="margin-top:0">${title}</h4>${list.map(([k, n]) => attrCell(x, k, n, K)).join('')}`;
  const ex = Object.fromEntries(EXTRA_ATTRS.list);
  return `<div class="attr-cols"><div>${col(ATTRS.tech.name, ATTRS.tech.list)}</div>
    <div>${col(ATTRS.mental.name, [...ATTRS.mental.list, ['leadership', ex.leadership]])}</div>
    <div>${col(ATTRS.physical.name, ATTRS.physical.list)}<div style="margin-top:14px">${col(ATTRS.workshop.name, ATTRS.workshop.list)}</div>
      <div style="margin-top:14px">${col(EXTRA_ATTRS.name, EXTRA_ATTRS.list.filter(([k]) => k !== 'leadership'))}</div></div></div>
    ${note ? `<p class="small muted" style="margin-top:10px">${note}</p>` : ''}`;
}
// Mocne i słabe strony – tylko z cech, które sztab zna
function knownAttrs(x, K = knowledge(x)) {
  return Object.values(ATTRS).flatMap(g => g.list).map(([k, n]) => { const p = perceiveAttr(x, k, G.clubId, K); return p && !p.hidden ? [n, (p.lo + p.hi) / 2, k] : null; })
    .filter(Boolean).sort(by(x => x[1], -1));
}
function scoutReport(r) {
  if (typeof scKnown === 'function' && !scKnown(r)) return '<p class="small muted">Sztab nie zna tego zawodnika – zleć obserwację skautowi albo trenerowi (Transfery → Skauting).</p>';
  const K = knowledge(r), all = knownAttrs(r, K), p = perceive(r), age = riderAge(r);
  const lines = [];
  if (all.length >= 6) lines.push(`Mocne strony: <b>${all.slice(0, 3).map(x => x[0].toLowerCase()).join(', ')}</b>.`, `Słabe strony: <b>${all.slice(-3).map(x => x[0].toLowerCase()).join(', ')}</b>.`);
  else lines.push('Za mało obserwacji, by ocenić mocne i słabe strony.');
  const gap = p.paMid - p.caMid;
  if (age <= 24 && gap > 12) lines.push(`Duży potencjał rozwoju – w szczycie może osiągnąć poziom: <b>${caClass(p.paMid).toLowerCase()}</b>.`);
  else if (age <= 27 && gap > 5) lines.push('Wciąż może się wyraźnie poprawić.');
  else if (age >= 33) lines.push('Doświadczony zawodnik – należy spodziewać się stopniowego spadku formy fizycznej.');
  else lines.push('Zawodnik blisko swojego szczytu możliwości.');
  const v = k => { const q = perceiveAttr(r, k, G.clubId, K); return q && !q.hidden ? (q.lo + q.hi) / 2 : null; };
  if (v('start') >= 16) lines.push('Jeden z groźniejszych startowców – często prowadzi po pierwszym łuku.');
  if (v('passing') >= 16 && v('fighting') >= 15) lines.push('Waleczny na dystansie – potrafi przebić się z tylnych pozycji.');
  if (v('surfaces') >= 15) lines.push('Dobrze radzi sobie na każdej nawierzchni, także na mokrym torze.');
  if (v('teamRiding') >= 15) lines.push('Dobrze jedzie w parze – często „dowozi” podwójne wygrane.');
  if (v('discipline') != null && v('discipline') <= 7) lines.push('Skłonny do ryzykownej jazdy – częściej wykluczany.');
  const ch = personalityLabel(r.hidden);
  if (ch && K >= 0.75) lines.push(`Charakter: <b>${esc(ch[0].toLowerCase())}</b> – ${esc(ch[1].charAt(0).toLowerCase() + ch[1].slice(1))}`);
  for (const e of (r.paLog || []).slice(-2)) if (K >= 0.8 && Math.abs(e.v) >= 2.5) lines.push(`Po ostatnim okresie (${esc(e.why)}) sztab ocenia jego potencjał ${e.v > 0 ? 'wyżej' : 'niżej'}.`);
  return `<ul class="report">${lines.map(l => `<li>${l}</li>`).join('')}</ul>`;
}
// Znani zawodnicy (wiarygodna ocena potencjału): sztab zna ich co najmniej w 60%
function knownRider(r) { return knowledge(r) >= 0.6; }
function coachSummary(r) {
  if (typeof scKnown === 'function' && !scKnown(r)) return 'Sztab nie zna zawodnika – poziom i potencjał do oceny po obserwacji.';
  const p = perceive(r), age = riderAge(r);
  const now = caClass(p.caMid);
  if (p.K < 0.4) return `${now} (ocena niepewna). Potencjał trudny do oceny – dodaj do obserwowanych.`;
  const fut = caClass(p.paMid);
  const tail = age >= 33 ? 'z czasem obniży poziom' : fut !== now && p.paMid - p.caMid > 4 ? `może osiągnąć poziom: ${fut.toLowerCase()}` : 'blisko szczytu możliwości';
  return `${now}, ${tail}.`;
}
// Rodzina (js/relations.js – Wikipedia i prasa): krewni obecni w grze jako linki do profili
let FAMILY_INDEX = null;
function familyOf(name) {
  if (typeof RELATIONS === 'undefined') return [];
  if (!FAMILY_INDEX) FAMILY_INDEX = new Map(Object.entries(RELATIONS.people).map(([n, l]) => [normName(n), l]));
  const gen = (G.relGen || []).filter(x => normName(x.a) === normName(name)).map(x => ({ rel: x.rel, name: x.b, game: true, gen: true }));
  const known = FAMILY_INDEX.get(normName(name)) || [];
  // krewni z profili zawodników z USA (js/usa-data.js), bez powtórzeń z Wikipedii
  const usa = (typeof USA_DATA !== 'undefined' && (USA_DATA.profiles[name] || {}).rel || []).filter(x => !known.some(k => normName(k.name) === normName(x.name)));
  return [...known, ...usa, ...gen];
}
function personHref(name) {
  const n = normName(name), f = o => Object.values(o).find(x => normName(x.name) === n);
  const r = f(G.riders); if (r) return `#/zawodnik/${r.id}`;
  const s = f(G.staff); if (s) return `#/osoba/${s.id}`;
  const k = f(G.academy); return k ? `#/adept/${k.id}` : null;
}
// Tylko postacie obecne w grze (relacje są zapisane dwustronnie, więc krewny ma w profilu link zwrotny)
function familyRow(name) {
  const list = familyOf(name).map(x => ({ ...x, href: personHref(x.name) })).filter(x => x.href);
  if (!list.length) return '';
  return `<div>Rodzina</div><div>${list.map(x => `<div>${esc(x.rel)}: <a href="${x.href}">${esc(x.name)}</a></div>`).join('')}</div>`;
}
// Wychowanek: klub, w którego barwach zdobył licencję „Ż” (historia PSD lub egzamin w grze), szkółka z rejestru PZM / gry
function pupilRow(r) {
  const h = typeof RIDER_HIST !== 'undefined' && RIDER_HIST.riders ? RIDER_HIST.riders[r.psdSlug] || RIDER_HIST.riders[nameSlug(r.name)] : null;
  const lic = h && h.licenses && h.licenses.length ? h.licenses[0] : r.licence || null;
  const home = r.homeClubId && G.clubs[r.homeClubId], sc = r.schoolId && G.miniSchools && G.miniSchools[r.schoolId];
  if (!home && !lic && !sc) return '';
  const club = home ? clubLink(home.id) : lic && lic.team ? esc(lic.team) : '';
  const licTxt = lic ? `licencja „Ż”${lic.number ? ` nr ${esc(lic.number)}` : ''}${lic.date ? `, ${/^\d{4}-/.test(lic.date) ? fmtDate(lic.date) : esc(String(lic.date))}` : ''}${lic.place ? ` (egzamin: ${esc(lic.place)})` : ''}` : '';
  return `<div>Wychowanek</div><div>${club || '—'}${sc ? ` · szkółka <a href="#/minizuzel/szkolki/${encodeURIComponent(sc.id)}">${esc(sc.short)}</a>` : ''}${licTxt ? `<div class="small muted">${licTxt}</div>` : ''}</div>`;
}
function profOverview(r) {
  const s = r.stats[G.season], k = r.contract;
  return `${roleSwitch(r, staffOfRider(r), 'rider')}${firstRolePanel(r)}<div class="grid ov-top">
    <div class="panel"><h3>Informacje</h3><div class="kv"><div>Klub</div><div>${clubLink(r.clubId)}</div><div>Rola</div><div>${riderRole(r)}${seniorFromNote(r) ? ` <span class="small muted">(${seniorFromNote(r)})</span>` : ''}</div>${teamRoleRow(r)}${pupilRow(r)}<div>Kontrakt</div><div>${k ? `do końca ${k.until} (${esc(k.kind)})` : 'brak'}</div>
      <div>Poziom (ocena sztabu)</div><div>${scKnown(r) ? esc(caClass(perceive(r).caMid)) : '<span class="muted">nieznany – zleć obserwację</span>'}</div><div>Charakter</div><div>${charLabel(r)}</div>${familyRow(r.name)}<div>Forma</div><div class="${r.form > 0.3 ? 'pos' : r.form < -0.3 ? 'neg' : ''}">${r.form > 0.8 ? 'bardzo dobra' : r.form > 0.3 ? 'dobra' : r.form < -0.8 ? 'bardzo słaba' : r.form < -0.3 ? 'słaba' : 'przeciętna'}</div>
      <div>Licencja</div><div>${(st => st.ok ? '' : `<div class="neg"><b>${esc(st.text)}</b></div>`)(licenceStatus(r))}${licenceText(r)}${licExamBox(r)}</div><div>Kondycja</div><div>${Math.round(r.cond)}%</div>${typeof rhythmOf === 'function' && r.active ? (rh => `<div>Rytm zawodów</div><div class="${rh.cls}">${esc(rh.lbl)}</div>`)(rhythmOf(r)) : ''}<div>Sprzęt</div><div><a href="#/park/zawodnik/${r.id}">${eqVisible(r) ? `${Math.round(equipRating(r))} / 100` : `${r.equip.engines.length} silników · ${esc(tunerName(r.equip.tuner))}`}</a></div><div>Wartość</div><div>${fmtMoney(riderValue(r))}</div></div></div>
    <div class="panel"><h3>Atrybuty</h3>${attrPanel(r)}</div>
  </div>
  <div class="grid g3" style="margin-top:16px">
    <div class="panel"><h3>Raport trenera</h3>${scoutReport(r)}${typeof scReportBlock === 'function' ? scReportBlock(r) : ''}</div>
    <div class="panel"><h3>Sezon ${G.season}</h3>${s && (s.heats || s.gp) ? `<div class="stat-tiles"><div class="tile"><div class="k">Mecze</div><div class="v">${s.m}</div></div><div class="tile"><div class="k">Średnia</div><div class="v">${s.heats ? ((s.pts + s.bonus) / s.heats).toFixed(3) : '—'}</div></div><div class="tile"><div class="k">Punkty</div><div class="v">${s.pts}+${s.bonus}</div></div>${s.gp ? `<div class="tile"><div class="k">Grand Prix</div><div class="v">${s.gpPts} pkt</div><div class="s">${s.gp} rund</div></div>` : ''}</div>` : '<p class="muted">Jeszcze bez startów w tym sezonie.</p>'}
      ${foreignSeasonLine(r)}
      ${r.lastMatches.length ? `<h3 style="margin-top:14px">Ostatnie mecze</h3>${r.lastMatches.slice(0, 5).map(m => `<div class="row small ${m.fid ? 'click' : ''}" ${m.fid ? `onclick="go('#/zagranica/mecz/${m.fid}')" title="${esc((FOREIGN_LEAGUES[m.lg] || {}).full || '')}"` : ''}><span class="muted" style="width:70px">${fmtDateShort(m.date)}</span>${m.lg ? `<span class="pill" style="padding:0 5px">${esc((FOREIGN_LEAGUES[m.lg] || { name: m.lg }).name)}</span>` : ''}<span style="min-width:50px">${esc(m.opp)}</span><b>${m.pts}+${m.bonus}</b><span class="muted">(${esc(m.line)})</span></div>`).join('')}` : ''}</div>
    <div class="panel"><h3>Największe sukcesy</h3>${honoursTop(r)}</div>
  </div>`;
}
ACT.setFocus = (id, v) => { G.riders[id].focus = v || null; changed(); };
function profContract(r) {
  return (typeof retireIntentPanel === 'function' ? retireIntentPanel(r) : '') + profContractInner(r);
}
function profContractInner(r) {
  const mine = r.contract && r.contract.clubId === G.clubId;
  const watched = G.shortlist.includes(r.id);
  const bar = `<div class="row wrap" style="margin-bottom:14px">${mine
    ? `<button class="btn ${r.listed ? 'primary' : ''}" onclick="ACT.toggleList(${r.id})">${mkBadge('tl', MK_NAMES.tl)} ${r.listed ? 'Zdejmij z listy transferowej' : 'Wystaw na listę transferową'}</button>
       <button class="btn ${r.loanListed ? 'primary' : ''}" onclick="ACT.toggleLoanList(${r.id})">${mkBadge('ll', MK_NAMES.ll)} ${r.loanListed ? 'Wycofaj z wypożyczeń' : 'Udostępnij do wypożyczenia'}</button>`
    : `<a class="btn primary ${!marketStatus(r).ok ? 'disabled' : ''}" href="#/oferta/${r.id}">${userNeg(r.id) ? 'Negocjacje kontraktu' : 'Złóż ofertę'}</a><a class="btn ${!loanStatus(r).ok ? 'disabled' : ''}" href="#/oferta/${r.id}/wypozyczenie">Zaproponuj wypożyczenie</a><button class="btn" onclick="ACT.toggleWatch(${r.id})">${watched ? '★ Obserwowany' : '☆ Obserwuj'}</button>`}</div>`;
  return bar + profContractBody(r);
}
function termsTable(k) {
  if (!k || k.kind === 'amatorski') return '';
  const ys = []; for (let y = k.from; y <= k.until; y++) ys.push(y);
  return `<table class="t terms-t" style="margin-top:10px"><thead><tr><th>Sezon</th><th class="num">Za podpis</th><th class="num">Za punkt</th></tr></thead><tbody>${ys.map(y => { const t = termsFor(k, y); return `<tr class="${y === G.season ? 'me' : ''}"><td>${y}</td><td class="num">${fmtMoney(t.signing)}</td><td class="num">${fmtMoney(t.perPoint)}</td></tr>`; }).join('')}</tbody></table>`;
}
function contractKv(k, r) {
  const s = r.stats[G.season];
  const paidPts = s && k && k.kind !== 'amatorski' && activeDeal(r) === k ? (s.pts + s.bonus) * termsFor(k, G.season).perPoint : 0;
  return `<div class="kv"><div>Klub</div><div>${clubLink(k.clubId)}</div><div>Rodzaj</div><div>${esc(contractLabel(k))}</div><div>Okres</div><div>sezony ${k.from}–${k.until} (do 31.10.${k.until})</div>
    ${k.kind === 'amatorski' ? '<div>Sprzęt i starty</div><div>na koszt klubu</div>' : `<div>Raty za podpis ${G.season}</div><div>${k.paid && k.paid.season === G.season ? k.paid.n : 0} / 6 (luty–lipiec)</div><div>Wypłacono za punkty w ${G.season}</div><div>${fmtMoney(paidPts)}</div>`}
    ${k.pp10 ? `<div>Stawka przy 10+ pkt</div><div>${fmtMoney(k.pp10)} / pkt</div>` : ''}${k.kind === 'amatorski' ? `<div>Zawody młodzieżowe</div><div>${k.stipend ? 'bez wynagrodzenia (stypendium)' : '100 / 150 / 250 zł za punkt'}</div>` : `<div>Zawody młodzieżowe</div><div>${fmtMoney(k.youthPP ?? defaultYouthPP(k.perPoint))} / pkt</div>`}
    ${k.deducted && k.deducted.season === G.season ? `<div>Potrącenia ${G.season}</div><div class="neg">${fmtMoney(k.deducted.amount)} (${k.deducted.n} ${plural(k.deducted.n, 'mecz', 'mecze', 'meczów')} opuszczonych – kontuzja poza ligą polską)</div>` : ''}${dealBonuses(k).map(b => `<div>Premia: ${esc(bonusLabel(b))}</div><div>${fmtMoney(b.amount)}</div>`).join('')}${k.promoRaise ? `<div>Klauzula awansu</div><div>podpis +${k.promoRaise}%</div>` : ''}${k.relegDrop ? `<div>Klauzula spadku</div><div>podpis −${k.relegDrop}%</div>` : ''}
    ${k.buyout ? `<div>Klauzula odstępnego</div><div>${fmtMoney(k.buyout)}</div>` : ''}<div>Źródło danych</div><div class="small">${esc(k.source || '—')}${k.certainty ? ` (pewność: ${esc(k.certainty)})` : ''}</div></div>${termsTable(k)}${k.note ? `<p class="small muted">${esc(k.note)}</p>` : ''}`;
}
function statusLine(r, st) {
  if (!st.ok) return `<div class="reply blocked">${esc(st.text)}</div>`;
  const when = st.completes === 'now' ? 'od razu (okienko otwarte)' : `${fmtDate(st.completes)}${st.window ? ` (${st.window.name})` : ''}`;
  if (st.mode === 'loan') return `<div class="reply accept">Wypożyczenie do 31.10.${st.season}: najpierw zgoda klubu ${esc(G.clubs[st.holder].name)}, potem rozmowa z zawodnikiem. Punkty ligowe w sezonie: ${st.pts} (limit 12).</div>`;
  const lines = st.mode === 'free' ? `Wolny zawodnik – kontrakt na sezon ${st.forSeason}, zgłoszenie ${when}.`
    : st.mode === 'precontract' ? `Kontrakt wygasa po sezonie – można podpisać prekontrakt na sezon ${st.forSeason} (przejście 1 listopada).`
    : st.mode === 'renewal' ? `Przedłużenie kontraktu od sezonu ${st.forSeason} (prekontrakt z obecnym klubem).`
    : `Ważny kontrakt do ${r.contract.until} – potrzebna zgoda klubu ${G.clubs[st.holder].name}. Transfer ${when}, kontrakt od sezonu ${st.forSeason}.`;
  const fee = st.mode === 'transfer' ? (st.buyout ? `<br>Klauzula odstępnego: <b>${fmtMoney(st.buyout)}</b> – po jej zapłaceniu klub musi zgodzić się na rozmowy.` : st.comp ? `<br>Ekwiwalent za wyszkolenie: maks. <b>${fmtMoney(st.comp.max)}</b> (${esc(compText(st.comp))}); oczekiwania klubu (szac.): ${fmtMoney(st.comp.amount, true)}.` : `<br>Odstępne (szac.): <b>${fmtMoney(st.fee, true)}</b>.`)
    : st.school ? `<br>Karta w szkółce ${esc(G.miniSchools[st.school].name)} – cena karty dla szkółki: <b>${fmtMoney(st.fee)}</b>.`
    : st.comp ? `<br>Ekwiwalent za wyszkolenie dla ${esc(G.clubs[st.comp.clubId].name)}: <b>${fmtMoney(st.comp.amount)}</b> (maks. wg regulaminu ${fmtMoney(st.comp.max, true)}: ${esc(compText(st.comp))}).` : '';
  return `<div class="reply accept">${lines}${fee}</div>`;
}
function negBox(n) {
  const r = G.riders[n.riderId];
  const kindL = { contract: n.mode === 'transfer' ? 'transfer' : n.mode === 'precontract' ? 'prekontrakt' : 'kontrakt', renewal: 'przedłużenie', loan: 'wypożyczenie' }[n.kind];
  const ours = n.clubId === G.clubId;
  const counter = n.status === 'counter' && n.counter;
  const act = ours && NEG_OPEN.includes(n.status) ? `<div class="row wrap" style="margin-top:10px">${counter ? `<button class="btn primary sm" onclick="ACT.acceptCounter('${n.id}')">Przyjmij warunki</button>` : ''}<a class="btn sm" href="#/oferta/${r.id}${n.kind === 'loan' ? '/wypozyczenie' : ''}">Zmień ofertę</a><button class="btn sm danger" onclick="ACT.arm(this, 'withdraw', '${n.id}')">Wycofaj</button></div>` : '';
  const holderAct = n.holderId === G.clubId && n.status === 'club' ? `<div class="row wrap" style="margin-top:10px"><button class="btn primary sm" onclick="ACT.negDecision('${n.id}',true)">Zgoda klubu</button><button class="btn sm danger" onclick="ACT.negDecision('${n.id}',false)">Odrzuć</button></div>` : '';
  return `<div class="neg-box"><div class="row"><span class="clubname">${crest(G.clubs[n.clubId], 'sm')}<b>${esc(G.clubs[n.clubId].name)}</b></span><span class="pill">${kindL}</span><span class="grow"></span><span class="st ${n.status === 'agreed' ? 'pos' : n.status === 'counter' ? 'warn' : ['rejected', 'withdrawn', 'expired'].includes(n.status) ? 'neg' : ''}">${esc(negStatusText(n))}</span></div>
    ${ours || n.holderId === G.clubId ? `<p class="small" style="margin-top:8px">${n.kind === 'loan' ? `Wypożyczenie do 31.10.${n.forSeason}: ${n.terms.fee ? `${fmtMoney(n.terms.fee)} dla klubu, ` : ''}${fmtMoney(n.terms.signing || 0, true)} + ${fmtMoney(n.terms.perPoint || 0)}/pkt` : `${n.terms.fee ? `${n.mode === 'transfer' ? 'Odstępne' : 'Ekwiwalent'}: <b>${fmtMoney(n.terms.fee)}</b> · ` : ''}${esc(termsText(n.terms))}`}</p>` : '<p class="small muted" style="margin-top:8px">Warunki oferty nieznane.</p>'}
    ${counter ? `<div class="reply counter">Kontrpropozycja: ${n.stage === 'club' ? `${fmtMoney(n.counter.fee || 0)} dla klubu` : esc(termsText({ ...n.terms, ...n.counter }))}</div>` : ''}
    ${act}${holderAct}${ours ? `<div class="neg-log">${n.log.slice().reverse().map(l => `<div><b>${fmtDateShort(l.d)}</b>${esc(l.t)}</div>`).join('')}</div>` : ''}</div>`;
}
// Zawodnik z kartą w szkółce niezależnej: cena karty, wypożyczenie (js/schools.js)
function schoolRightsPanel(r) {
  const s = rightsSchool(r);
  if (!s) return '';
  const ls = schoolLoanStatus(r), onLoan = schoolOnLoan(r);
  return `<h3 style="margin-top:16px">Karta w szkółce</h3><div class="kv"><div>Szkółka</div><div><a href="#/minizuzel/szkolki/${encodeURIComponent(s.id)}">${esc(s.name)}</a> <span class="small muted">(niezależna)</span></div>
    ${onLoan ? `<div>Wypożyczenie</div><div>${clubLink(r.schoolLoan.clubId)} – sezon ${r.schoolLoan.season}, opłata ${fmtMoney(r.schoolLoan.fee, true)}</div>` : ''}
    <div>Cena karty</div><div>${fmtMoney(schoolFee(r, G.clubId))} <span class="small muted">(dla naszego klubu)</span></div>
    <div>Wypożyczenie na sezon</div><div>${ls.ok ? fmtMoney(ls.fee) : `<span class="muted">${esc(ls.text)}</span>`}</div></div>
    <p class="small muted">Szkółka szkoli poza klubami: kartę sprzedaje (kontrakt z klubem, cena karty dla szkółki) albo wypożycza zawodnika na sezon – kontrakt do 31 października, karta zostaje w szkółce. Karta wygasa po sezonie 21. urodzin.</p>
    ${ls.ok ? `<button class="btn primary" onclick="ACT.arm(this, 'schoolLoan', ${r.id})">Wypożycz ze szkółki (${fmtMoney(ls.fee, true)})</button>` : ''}`;
}
ACT.schoolLoan = id => { const res = doSchoolLoan(G.riders[id], G.clubId); toast(res.text, res.ok ? 'good' : 'bad'); changed(); };
ACT.miniLoan = id => { const res = doMiniLoan(G.academy[id], G.clubId); toast(res.text, res.ok ? 'good' : 'bad'); changed(); };
function profContractBody(r) {
  const k = r.contract, mine = k && k.clubId === G.clubId;
  const ours = userNeg(r.id) || Object.values(G.negs || {}).filter(n => n.riderId === r.id && n.clubId === G.clubId).sort(by(n => n.updated, -1))[0];
  const others = openNegs(r.id).filter(n => n.clubId !== G.clubId);
  const ints = interestedClubs(r);
  const comp = trainingComp(r, 0);
  const left = `<div class="panel"><h3>Obecny kontrakt</h3>${k ? contractKv(k, r) : r.schoolRights ? '<p class="muted">Zawodnik bez kontraktu – karta w szkółce niezależnej.</p>' : '<p class="muted">Zawodnik bez kontraktu w polskiej lidze – wolny agent.</p>'}
    ${r.loan ? `<h3 style="margin-top:16px">Wypożyczenie</h3><div class="kv"><div>Z klubu</div><div>${clubLink(r.loan.parentId)}</div><div>Do klubu</div><div>${clubLink(r.loan.toClubId)}</div><div>Okres</div><div>${fmtDateShort(r.loan.from)} – ${fmtDateShort(r.loan.until)}</div><div>Kontrakt (wypożyczenie)</div><div>${fmtMoney(r.loan.signing, true)} + ${fmtMoney(r.loan.perPoint)}/pkt</div>${r.loan.fee ? `<div>Opłata za wypożyczenie</div><div>${fmtMoney(r.loan.fee)}</div>` : ''}</div>` : ''}
    ${r.nextContract ? `<h3 style="margin-top:16px">Od sezonu ${r.nextContract.from} (prekontrakt)</h3>${contractKv(r.nextContract, r)}` : ''}
    ${schoolRightsPanel(r)}${r.trainedBy && G.clubs[r.trainedBy] && isJunior(r) ? `<p class="small muted" style="margin-top:12px">Klub szkolący: ${esc(G.clubs[r.trainedBy].name)} (od ${r.trainedSince}).${comp ? ` Ekwiwalent za wyszkolenie przy zmianie klubu: maks. ${fmtMoney(comp.max)} (${esc(compText(comp))})${comp.clubId !== G.clubId ? `, klub szkolący oczekuje ok. ${fmtMoney(comp.amount, true)}` : ''}.` : ''}</p>` : ''}</div>`;
  const market = `${ints.length || others.length ? `<h3 style="margin-top:14px">Zainteresowanie innych klubów</h3><div class="club-chips">${[...new Set([...others.map(n => n.clubId), ...ints])].map(id => `${clubLink(id)}`).join('')}</div>
      ${others.length ? `<p class="small muted">${mkBadge('of', MK_NAMES.of)} Oferty na stole: ${esc(clubsShort(others.map(n => n.clubId)))}${others.length > 1 ? ' – zawodnik dłużej się zastanawia i oczekuje więcej' : ''}.</p>` : ''}` : ''}`;
  let right;
  if (mine) {
    const st = marketStatus(r);
    const incoming = others.filter(n => n.holderId === G.clubId || n.mode === 'precontract');
    right = `<div class="panel"><h3>Działania</h3>${st.ok ? `<p>Kontrakt wygasa po sezonie ${k.until}. Możesz zaproponować przedłużenie (prekontrakt od sezonu ${st.forSeason}).</p><a class="btn primary" href="#/oferta/${r.id}">${userNeg(r.id) ? 'Negocjacje przedłużenia' : 'Negocjuj przedłużenie'}</a>` : `<p class="muted">${esc(st.text)}</p>`}
      <div style="margin:10px 0">${r.sound ? `<p class="small">Rozmowa ${fmtDateShort(r.sound.d)}: <b class="${r.sound.stance === 'yes' ? 'pos' : r.sound.stance === 'no' ? 'neg' : 'warn'}">${SOUND_TXT[r.sound.stance]}</b>${r.sound.stance !== 'retire' ? ` · oczekuje ${fmtMoney(r.sound.signing, true)} + ${fmtMoney(r.sound.perPoint)}/pkt, ${r.sound.years} ${plural(r.sound.years, 'sezon', 'sezony', 'sezonów')}${r.sound.role ? `, ${roleName(r.sound.role)}` : ''}` : ''}</p>` : ''}
        <button class="btn" onclick="ACT.soundOut(${r.id})">Porozmawiaj o przyszłości</button> <span class="small muted">wybadaj, czy zawodnik chce przedłużyć umowę i na jakich warunkach (raz na 30 dni)</span></div>
      ${ours ? negBox(ours) : ''}
      ${incoming.map(negBox).join('')}${market}
      <p style="margin-top:16px">${longInjury(r) ? 'Zawodnik jest kontuzjowany od ponad 9 miesięcy – klub może jednostronnie rozwiązać kontrakt bez kosztów (Zbiór Zasad §15).' : `Rozwiązanie umowy za porozumieniem stron kosztuje ok. <b>${fmtMoney(releaseCost(r.id))}</b>.`}</p><button class="btn danger" onclick="ACT.arm(this, 'release', ${r.id})">Rozwiąż kontrakt</button></div>`;
  } else if (r.loan && r.loan.toClubId === G.clubId) {
    right = loanExtPanel(r);
  } else {
    const st = marketStatus(r), ls = loanStatus(r);
    const a = riderAsk(r, G.clubId);
    right = `<div class="panel"><h3>Rynek</h3>${statusLine(r, st)}
      <div class="kv" style="margin-top:12px"><div>Oczekiwania (szac.)</div><div>${fmtMoney(a.signing, true)} + ${fmtMoney(a.perPoint)}/pkt, ${a.years} ${plural(a.years, 'sezon', 'sezony', 'sezonów')}</div><div>Miejsce w naszym składzie</div><div>${squadOutlook(r, G.clubId)}</div>
        ${r.contract ? `<div>Wypożyczenie</div><div>${ls.ok ? `<span class="pos">możliwe</span>${r.loanListed ? ' – klub szuka chętnych' : ''}` : `<span class="muted">${esc(ls.text)}</span>`}</div>` : ''}</div>
      ${ours ? negBox(ours) : ''}${market}</div>`;
  }
  return `<div class="grid g2">${left}${right}</div>`;
}
ACT.release = id => {
  const r = G.riders[id];
  releaseRider(id); toast(`${r.name} odchodzi z klubu.`); changed();
};
ACT.toggleList = id => { const r = G.riders[id]; r.listed = !r.listed; toast(r.listed ? `${r.name} na liście transferowej – kluby mogą składać oferty.` : `${r.name} zdjęty z listy.`); changed(); };
ACT.toggleLoanList = id => { const r = G.riders[id]; r.loanListed = !r.loanListed; toast(r.loanListed ? `${r.name} dostępny do wypożyczenia.` : `${r.name} nie jest już dostępny do wypożyczenia.`); changed(); };
ACT.withdraw = id => { withdrawOffer(id); toast('Oferta wycofana.'); changed(); };
ACT.acceptCounter = id => { const res = acceptCounter(id); toast(res.text, res.ok ? 'good' : 'bad'); changed(); };
ACT.toggleWatch = id => { const i = G.shortlist.indexOf(id); if (i >= 0) G.shortlist.splice(i, 1); else G.shortlist.push(id); changed(); };
// Przełącznik lig w statystykach: Polska (domyślnie) albo jedna z lig zagranicznych zawodnika; puchary (Knockout Cup, BSN Series)
// nie są ligami – ich mecze tylko w historii startów
const fLeagueOnly = lg => !(typeof FP !== 'undefined' && FP && FP.cups && FP.cups[lg]);
function statLeagues(r) {
  // ligi bieżącego sezonu: starty w tym sezonie i zgłoszenia do lig (r.fl) na ten sezon
  const ids = new Set([...Object.keys((r.fstats || {})[G.season] || {}), ...(r.fl && r.fl.season === G.season && r.fl.list ? r.fl.list.map(x => x.id) : [])]);
  return [...ids].filter(fLeagueOnly).sort(by(id => -((FOREIGN_LEAGUES[id] || {}).prestige || 0)));
}
// Zakładki statystyk: liga polska, ligi zagraniczne zawodnika i „Zawody” (indywidualne, parowe, drużynowe, międzynarodowe) – dla każdego zawodnika
function statSwitch(r, cur) {
  const opts = [['PL', 'Polska'], ...statLeagues(r).map(id => [id, (FOREIGN_LEAGUES[id] || { name: id }).name]), ['ZAW', 'Zawody']];
  return `<div class="seg" style="flex-wrap:wrap">${opts.map(([k, l]) => `<button class="btn sm ${cur === k ? 'primary' : ''}" onclick="UI.statLg='${k}';render()">${esc(l)}</button>`).join('')}</div>`;
}
const statLgOf = r => (UI.statLg === 'ZAW' || statLeagues(r).includes(UI.statLg) ? UI.statLg : 'PL');
// Starty z danej zakładki: PL – liga polska, ZAW – zawody (bez meczów lig), inaczej – liga zagraniczna
const statFilter = cur => x => (cur === 'PL' ? x.league : cur === 'ZAW' ? !x.league && !x.lg : x.lg === cur);
// Zawody w sezonie: podsumowanie dla każdych rozgrywek (starty, biegi, punkty, najlepsze miejsce)
function compStatsTable(starts) {
  const per = new Map();
  for (const x of starts) { const k = x.comp, p = per.get(k) || { comp: k, n: 0, h: 0, pts: 0, b: 0, best: null, wins: 0 };
    p.n++; p.h += x.s.heats || 0; p.pts += x.s.pts || 0; p.b += x.s.bonus || 0; if (x.place) { p.best = p.best == null ? x.place : Math.min(p.best, x.place); if (x.place === 1) p.wins++; } per.set(k, p); }
  const rows = [...per.values()].sort(by(p => p.n, -1));
  if (!rows.length) return `<div class="panel empty">Brak startów w zawodach w sezonie ${G.season}.</div>`;
  return `<div class="panel flush"><div class="ph"><h3>Zawody – sezon ${G.season}</h3><span class="small muted">indywidualne, parowe, drużynowe i międzynarodowe (bez meczów ligowych)</span></div><table class="t"><thead><tr><th>Rozgrywki</th><th class="num">Starty</th><th class="num">Biegi</th><th class="num">Pkt</th><th class="num">Bon.</th><th class="num">Śr.</th><th class="num">Zwycięstwa</th><th class="num">Najlepsze miejsce</th></tr></thead><tbody>
    ${rows.map(p => `<tr><td><span class="pill">${esc(p.comp)}</span></td><td class="num">${p.n}</td><td class="num">${p.h}</td><td class="num"><b>${p.pts}</b></td><td class="num">${p.b}</td><td class="num">${p.h ? ((p.pts + p.b) / p.h).toFixed(3) : '—'}</td><td class="num">${p.wins || ''}</td><td class="num">${p.best ? `${p.best}.` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}
// Statystyki zawodnika w jednej lidze zagranicznej: sezony z protokołów meczów (wygrane biegi, upadki, defekty), klub i miejsce w tabeli
function foreignLeagueStats(r, lg) {
  const id = String(r.id), L = FOREIGN_LEAGUES[lg] || { name: lg }, per = {};
  for (const f of Object.values(G.ffix || {})) {
    const s = f.lg === lg && f.res && f.res.riders[id];
    if (!s || !s.heats) continue;
    const x = per[f.season] ||= { m: 0, h: 0, p: 0, b: 0, w: 0, falls: 0, def: 0, exc: 0, best: null, clubs: new Set() };
    x.m++; x.h += s.heats; x.p += s.pts; x.b += s.bonus; x.clubs.add(s.u);
    x.w += s.line.filter(v => v.startsWith('3')).length; x.falls += s.line.filter(v => v === 'u').length; x.def += s.line.filter(v => v === 'd').length; x.exc += s.line.filter(v => v === 'w' || v === 't').length;
    if (!x.best || s.pts + s.bonus > x.best.v) x.best = { v: s.pts + s.bonus, f };
  }
  // sezony sprzed zapisu protokołów (tylko sumy z r.fstats)
  for (const [y, ls] of Object.entries(r.fstats || {})) if (ls[lg] && !per[y]) per[y] = { m: ls[lg].m, h: ls[lg].h, p: ls[lg].p, b: ls[lg].b || 0, clubs: new Set() };
  const club = r.fl && r.fl.list && r.fl.list.find(x => x.id === lg);
  const pos = c => { if (typeof fStandings !== 'function' || !G.fclubs || !G.fclubs[c]) return ''; const i = fStandings(lg, G.season).findIndex(x => x.cid === c); return i >= 0 ? `${i + 1}. miejsce` : ''; };
  const ys = Object.keys(per).filter(y => Number(y) === G.season); // tylko bieżący sezon – wcześniejsze w zakładce Historia
  return `<div class="panel"><div class="row wrap" style="gap:16px"><div>${L.country ? flag(L.country) + ' ' : ''}<b>${esc(L.full || L.name)}</b></div>${club ? `<div class="small">klub: ${typeof fClubLink === 'function' && club.clubId ? fClubLink(club.clubId) : esc(club.team)}${club.clubId ? ` <span class="muted">(${pos(club.clubId)})</span>` : ''}</div>` : ''}${r.fl && r.fl.dropped && r.fl.dropped.some(x => x.id === lg) ? '<div class="small warn">w tym sezonie nie jeździ – limit lig GKSŻ</div>' : ''}<a class="small" href="#/zagranica/${lg}" style="margin-left:auto">tabela i terminarz ligi ›</a></div></div>
    <div class="panel flush"><div class="ph"><h3>Sezon ${G.season} – ${esc(L.name)}</h3><span class="small muted">średnia ligi – nie sumuje się z ligą polską</span></div><table class="t"><thead><tr><th>Sezon</th><th>Klub</th><th class="num">Mecze</th><th class="num">Biegi</th><th class="num">Pkt</th><th class="num">Bonusy</th><th class="num">Średnia</th><th class="num">Wygrane biegi</th><th class="num">Upadki</th><th class="num">Defekty</th><th class="num">Wyklucz.</th><th>Najlepszy mecz</th></tr></thead><tbody>
    ${ys.map(y => { const x = per[y]; return `<tr><td>${y}</td><td class="small">${[...x.clubs].map(c => typeof fClubShort === 'function' ? esc(fClubShort(c)) : esc(c)).join(', ')}</td><td class="num">${x.m}</td><td class="num">${x.h}</td><td class="num">${x.p}</td><td class="num">${x.b}</td><td class="num"><b>${x.h ? ((x.p + x.b) / x.h).toFixed(3) : '—'}</b></td><td class="num">${x.w ?? '—'}</td><td class="num">${x.falls ?? '—'}</td><td class="num">${x.def ?? '—'}</td><td class="num">${x.exc ?? '—'}</td><td class="small">${x.best ? `<a href="#/zagranica/mecz/${x.best.f.id}">${x.best.v} pkt – ${esc(fLabel(x.best.f))}</a>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="12" class="empty">Brak startów w tej lidze.</td></tr>'}</tbody></table></div>`;
}
function profStats(r) {
  const cur = statLgOf(r), sw = statSwitch(r, cur);
  const starts = riderStarts(r).filter(statFilter(cur));
  if (cur === 'ZAW') return `<div class="stack">${sw}${compStatsTable(starts)}${startsTable(r, starts, 5)}</div>`;
  if (cur !== 'PL') return `<div class="stack">${sw}${foreignLeagueStats(r, cur)}${startsTable(r, starts, 5)}</div>`;
  // tylko liga polska w bieżącym sezonie; ligi zagraniczne – osobne zakładki, wcześniejsze sezony – zakładka Historia
  const rows = gameSeasonRows(r).filter(x => x.season === G.season);
  const table = rows.length ? riderSeasonsTable(rows, `sezon ${G.season}`, 'Mecze ligowe w Polsce w bieżącym sezonie; wcześniejsze sezony – zakładka Historia.')
    : `<div class="panel empty">Brak startów w lidze w sezonie ${G.season}.</div>`;
  return `<div class="stack">${sw}${table}
    ${startsTable(r, starts, 5)}</div>`;
}
// Ligi zagraniczne: osobno dla każdej ligi i sezonu (średnie lig nie są porównywalne z ligą polską) – js/foreign.js
function foreignStatsTable(r) {
  const rows = Object.entries(r.fstats || {}).sort((a, b) => b[0] - a[0]).flatMap(([y, ls]) => Object.entries(ls).filter(([lg]) => fLeagueOnly(lg)).map(([lg, s]) => ({ y, lg, s })));
  if (!rows.length) return '';
  const team = (y, lg) => { const x = r.fl && r.fl.season === Number(y) && r.fl.list.find(l => l.id === lg); return x ? x.team : ''; };
  return `<div class="panel flush"><div class="ph"><h3>Ligi zagraniczne</h3><span class="small muted">średnie każdej ligi osobno – nie sumują się z ligą polską</span></div><table class="t"><thead><tr><th>Sezon</th><th>Liga</th><th>Klub</th><th class="num">Mecze</th><th class="num">Biegi</th><th class="num">Pkt</th><th class="num">Bonusy</th><th class="num">Średnia</th></tr></thead><tbody>
    ${rows.map(({ y, lg, s }) => { const L = FOREIGN_LEAGUES[lg] || { name: lg }; return `<tr class="${typeof FP !== 'undefined' && FP && FP.leagues[lg] ? 'click' : ''}" ${typeof FP !== 'undefined' && FP && FP.leagues[lg] ? `onclick="go('#/zagranica/${lg}')"` : ''}><td>${y}</td><td>${L.country ? flag(L.country) + ' ' : ''}${esc(L.name)}</td><td class="small">${esc(team(y, lg))}</td><td class="num">${s.m}</td><td class="num">${s.h}</td><td class="num">${s.p}</td><td class="num">${s.b || 0}</td><td class="num"><b>${s.h ? ((s.p + (s.b || 0)) / s.h).toFixed(3) : '—'}</b></td></tr>`; }).join('')}</tbody></table></div>`;
}
// Przegląd → Sezon: krótko o startach za granicą w bieżącym sezonie
function foreignSeasonLine(r) {
  const ls = Object.fromEntries(Object.entries((r.fstats || {})[G.season] || {}).filter(([lg]) => fLeagueOnly(lg)));
  if (!Object.keys(ls).length) return r.fl && r.fl.season === G.season && r.fl.list.length ? `<p class="small muted" style="margin-top:8px">Za granicą: ${r.fl.list.map(x => `${esc((FOREIGN_LEAGUES[x.id] || { name: x.id }).name)} (${esc(x.team)})`).join(', ')} – jeszcze bez startów.</p>` : '';
  return `<p class="small" style="margin-top:8px">Za granicą: ${Object.entries(ls).map(([lg, s]) => `<b>${esc((FOREIGN_LEAGUES[lg] || { name: lg }).name)}</b> ${s.m} m · śr. ${s.h ? ((s.p + (s.b || 0)) / s.h).toFixed(2) : '—'}`).join(' · ')} <a class="small" href="#/zawodnik/${r.id}/statystyki">szczegóły</a></p>`;
}
// Starty zawodnika w sezonie: mecze ligowe i wszystkie zawody (Grand Prix, turnieje, pary, drużynowe), od najnowszych
function riderStarts(r, season = G.season) {
  const ids = typeof riderIdsOf === 'function' ? riderIdsOf(r) : [String(r.id)], out = []; // także starty z okresu adepta
  for (const m of Object.values(G.matches)) {
    const id = ids.find(x => m.riders && m.riders[x] && m.riders[x].heats) || ids[0];
    const s = m.done && m.riders && m.riders[id];
    if (!s || !s.heats) continue;
    if (m.kind === 'league') {
      const fx = G.fixtures[m.fixtureId];
      if (!fx || fx.season !== season) continue;
      const opp = G.clubs[s.team === 'H' ? m.awayId : m.homeId];
      out.push({ date: m.date, comp: LEAGUES[fx.league] ? LEAGUES[fx.league].short : 'Liga', name: `${s.team === 'H' ? 'dom' : 'wyjazd'}: ${opp ? opp.short : '?'}`, href: `#/zawody/${fx.id}`, s, place: null, league: true });
    } else {
      const ev = G.events[m.eventId];
      if (!ev || (ev.season ?? Number(m.date.slice(0, 4))) !== season) continue;
      const c = (m.classification || []).find(x => x.riderId != null ? String(x.riderId) === id : x.key === s.unit);
      const cmp = ev.kind === 'sgp' ? 'SGP' : ev.comp && COMPS[ev.comp] ? COMPS[ev.comp].short : 'Zawody';
      out.push({ date: m.date, comp: cmp, name: ev.name, href: `#/gp/${ev.id}`, s, place: c ? c.place : null });
    }
  }
  for (const f of Object.values(G.ffix || {})) {
    const s = f.season === season && f.res && f.res.riders[String(r.id)];
    if (!s || !s.heats) continue;
    const L = FOREIGN_LEAGUES[f.lg] || { name: f.lg };
    out.push({ date: f.d, comp: L.name, name: f.units.length === 2 ? `${fClubShort(s.u)}: ${f.units[0] === s.u ? 'dom' : 'wyjazd'} – ${fClubShort(f.units.find(u => u !== s.u))}` : `${fClubShort(s.u)}: ${f.venue || ''}`, href: `#/zagranica/mecz/${f.id}`, lg: f.lg, s: { ...s, line: s.line }, place: f.units.length > 2 ? f.res.cls.indexOf(s.u) + 1 : null });
  }
  return out.sort(by(x => x.date, -1));
}
// Tabela startów; limit – tylko ostatnie starty i przycisk do pełnej listy sezonu
function startsTable(r, list, limit = 0, allHref = `#/zawodnik/${r.id}/starty`) {
  const rows = limit ? list.slice(0, limit) : list;
  return `<div class="panel flush"><div class="ph"><h3>${limit ? 'Ostatnie starty' : `Starty w sezonie (${list.length})`}</h3></div><table class="t proto"><thead><tr><th>Data</th><th>Rozgrywki</th><th>Zawody</th><th>Biegi</th><th class="num">Pkt</th><th class="num">Miejsce</th></tr></thead><tbody>
    ${rows.map(x => `<tr class="click" onclick="go('${x.href}')"><td class="nowrap">${fmtDateShort(x.date)}</td><td><span class="pill">${esc(x.comp)}</span></td><td>${esc(x.name)}</td><td class="line">${esc(x.s.line.join(','))}</td><td class="num"><b>${x.s.pts}${x.s.bonus ? `+${x.s.bonus}` : ''}</b></td><td class="num">${x.place ? `${x.place}.` : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Brak startów w tym sezonie</td></tr>'}</tbody></table>
    ${limit && list.length > limit ? `<div style="padding:10px 14px"><button class="btn sm" onclick="go('${allHref}')">Wszystkie (${list.length})</button></div>` : ''}</div>`;
}
// Wszystkie starty zawodnika w sezonie (z wyborem sezonu)
function profStarts(r) {
  const parts = location.hash.slice(2).split('/'), season = Number(parts[3]) || G.season;
  const seasons = [...new Set([G.season, ...Object.keys(r.stats).map(Number)])].filter(y => y >= START_SEASON + 1).sort((a, b) => b - a);
  return `<div class="stack"><div class="row wrap"><a class="btn sm" href="#/zawodnik/${r.id}/statystyki">◂ Statystyki</a>${seasons.length > 1 ? `<label class="fld" style="flex-direction:row;align-items:center;gap:8px">Sezon<select onchange="go('#/zawodnik/${r.id}/starty/'+this.value)">${seasons.map(y => `<option value="${y}" ${y === season ? 'selected' : ''}>${y}</option>`).join('')}</select></label>` : ''}</div>
    ${statSwitch(r, statLgOf(r))}
    ${startsTable(r, riderStarts(r, season).filter(statFilter(statLgOf(r))))}</div>`;
}
// Historia startów w polskich ligach (Polish Speedway Database do 2025, dalej sezony rozegrane w grze) i licencja
const riderHist = r => (typeof RIDER_HIST !== 'undefined' && (RIDER_HIST.riders[r.psdSlug] || RIDER_HIST.riders[nameSlug(r.name)])) || null;
function licenceText(r) {
  const h = riderHist(r);
  const lic = (h && h.licenses.length ? h.licenses.slice() : []).concat(r.licence ? [{ number: r.licence.number, team: r.licence.team, date: fmtDateShort(r.licence.date), place: r.licence.place }] : []);
  // zawodnik z USA bez licencji PZM: rok licencji z profilu speedwaybikes.com (js/usa-data.js), federacja AMA
  const usa = !lic.length && typeof USA_DATA !== 'undefined' && (USA_DATA.profiles[r.name] || {}).lic;
  if (usa) return `zdobyta w ${usa} r.<div class="small muted">licencja federacji USA – ${esc(USA_DATA.fed)}</div>`;
  if (!lic.length) return '—';
  const yr = l => (l.date || '').slice(-4);
  const [first, ...more] = lic.sort(by(l => (l.date || '').split('.').reverse().join('')));
  return `zdobyta w ${yr(first)} r.${first.number ? ` (nr ${esc(first.number)})` : ''}<div class="small muted">${esc(first.date)}${first.place ? `, egzamin: ${esc(first.place)}` : ''}${first.team ? `, klub: ${esc(first.team)}` : ''}</div>${more.length ? `<div class="small">odnowiona: ${more.map(l => `${yr(l)}${l.team ? ` (${esc(l.team)})` : ''}`).join(', ')}</div>` : ''}`;
}
// Nazwy drużyn z PSD pod inną nazwą niż miasto klubu
const TEAM_ALIAS = { 'Wanda Kraków': 'Kraków' };
function teamCell(name) {
  name = TEAM_ALIAS[name] || name;
  const c = Object.values(G.clubs).find(x => x.city && name && (x.city.startsWith(name) || name.startsWith(x.city.replace(' Wlkp.', ''))));
  return c ? `<span class="clubname">${crest(c, 'sm')}<span>${esc(name)}</span></span>` : esc(name || '—');
}
// Nazwy lig w historii jak w Polish Speedway Database (spójnie z sezonami sprzed gry): poziom, nie nazwa sponsora
const HIST_LEAGUE = { PGE: 'Ekstraliga', '2E': '1 liga', KLZ: '2 liga', U24: 'U-24 Ekstraliga' };
const histTeam = c => c.city.replace(/ Wlkp\.$/, ''); // „Gorzów”, „Ostrów” jak w bazie
const histLeague = lg => HIST_LEAGUE[lg] || (LEAGUES[lg] ? LEAGUES[lg].name : '');
// Historia klubu: sezony do 2025 z js/club-history.js (PSD 1961–2025, speedwayw.pl 1948–1961) + sezony rozegrane w grze
const CLUB_HIST_SLUG = { 'Gorzów Wlkp.': 'gorzow-wielkopolski', 'Ostrów Wlkp.': 'ostrow-wielkopolski' };
const clubHistSlug = c => CLUB_HIST_SLUG[c.city] || nameSlug(c.city);
const clubRealHist = c => (typeof CLUB_HIST !== 'undefined' && CLUB_HIST.teams[clubHistSlug(c)]) || [];
// menedżerowie sezonów sprzed gry (js/club-managers.js: protokoły PSD 2020–2025, Wikipedia, speedwayw.pl)
const clubRealMgr = (c, season) => (typeof CLUB_MGR !== 'undefined' && (CLUB_MGR.teams[clubHistSlug(c)] || {})[season]) || null;
// poziom rozgrywek: do 1999 r. najwyższa klasa nazywała się „1 liga” (odpowiednik Ekstraligi), ówczesna 2 liga – 2. Ekstraligi itd.
const histLevel = (season, league) => ({ Ekstraliga: 0, '1 liga': 1, '2 liga': 2, '3 liga': 3 }[league] ?? 9) - (season < 2000 && league !== 'Ekstraliga' ? 1 : 0);
const HIST_TAG = { up: ['awans', 'ok'], down: ['spadek', 'inj'] };
const HIST_GAME_LEAGUE = ['PGE', '2E', 'KLZ']; // poziom → liga gry (historia rozgrywek)
function clubSeasonRows(c) {
  const real = clubRealHist(c).filter(s => s.season <= START_SEASON).map(s => { const m = clubRealMgr(c, s.season); return m ? { ...s, managers: m.names, mgrSrc: m.src } : s; });
  const game = (c.history || []).map(h => {
    const t = typeof leagueTable === 'function' ? (leagueTable(h.league, h.season) || []).find(r => r.clubId === c.id) : null;
    const gh = (G.history || []).find(x => x.season === h.season), mv = gh ? gh.moves.filter(m => m[0] === c.id) : [];
    const tags = [...(mv.some(m => /^awans/.test(m[2])) ? ['up'] : []), ...(mv.some(m => /^spadek/.test(m[2])) ? ['down'] : [])];
    return { season: h.season, league: histLeague(h.league), team: histTeam(c), pos: h.pos, of: Object.values(G.clubs).filter(x => (x.history || []).some(y => y.season === h.season && y.league === h.league)).length,
      tags, ...(t && t.m ? { m: t.m, w: t.w, d: t.d, l: t.l, b: t.bonus, pts: t.pts, diff: t.pf - t.pa } : {}), managers: h.manager ? [h.manager] : [], game: true };
  });
  return [...game, ...real].sort((a, b) => b.season - a.season || histLevel(a.season, a.league) - histLevel(b.season, b.league));
}
function clubHistoryView(c, own) {
  const rows = clubSeasonRows(c);
  if (!rows.length) return '<div class="panel empty">Brak sezonów w polskich ligach – historia zapisze się po pierwszym sezonie w grze.</div>';
  const v = (x, k) => (x[k] == null ? '' : String(x[k]).replace('.', ','));
  const top = rows.filter(x => histLevel(x.season, x.league) === 0);
  const medals = p => top.filter(x => x.pos === p);
  const yrs = xs => xs.map(x => x.season).sort((a, b) => b - a).join(', ');
  const lgCount = [...new Set(rows.map(x => x.league))].sort((a, b) => histLevel(2000, a) - histLevel(2000, b)).map(l => `<div>${esc(l)}</div><div>${rows.filter(x => x.league === l).length}</div>`).join('');
  const first = rows[rows.length - 1].season, game = rows.filter(x => x.game).length;
  const stats = `<div class="panel"><h3>Klub w liczbach</h3><div class="kv"><div>Pierwszy sezon w lidze</div><div>${first}</div><div>Sezony ligowe</div><div>${rows.length}${game ? ` <span class="small muted">(w tym ${game} w grze)</span>` : ''}</div>
      <div>W najwyższej klasie</div><div>${top.length}</div>${lgCount}
      ${[1, 2, 3].map(p => `<div>${medalIcon(p)} ${['Mistrzostwa', 'Wicemistrzostwa', 'Brązowe medale'][p - 1]}</div><div><b>${medals(p).length}</b>${medals(p).length ? `<div class="small muted">${yrs(medals(p))}</div>` : ''}</div>`).join('')}
      ${own ? `<div>Rekord toru</div><div>${c.stadium.record ? `${c.stadium.record.time.toFixed(2).replace('.', ',')} s` : '—'}</div>` : ''}</div>
      <p class="small muted" style="margin-top:10px">Medale – miejsca w najwyższej klasie rozgrywkowej (do 1999 r. „1 liga”, od 2000 r. Ekstraliga).</p></div>`;
  const table = `<div class="panel flush"><div class="ph"><h3>Sezony ligowe w Polsce</h3><span class="small muted">${first}–${rows[0].season}</span></div><table class="t"><thead><tr>
    <th>Sezon</th><th>Rozgrywki</th><th>Drużyna</th><th>Miejsce</th><th class="num" title="mecze">M</th><th class="num" title="zwycięstwa">Z</th><th class="num" title="remisy">R</th><th class="num" title="porażki">P</th><th class="num" title="punkty bonusowe">B</th><th class="num">Pkt</th><th class="num" title="bilans małych punktów">+/-</th><th>Menedżer</th></tr></thead><tbody>
    ${rows.map(x => `<tr class="${x.game ? 'me' : ''}"><td>${x.season}${x.game ? ' <span class="pill">gra</span>' : ''}</td><td>${esc(x.league)}${x.group ? `<div class="small muted">${esc(x.group)}</div>` : ''}</td>
      <td>${teamCell(x.team)}${x.name ? `<div class="small muted">${esc(x.name)}</div>` : ''}</td>
      <td class="hon-cell">${x.pos && x.pos <= 3 && histLevel(x.season, x.league) === 0 ? medalIcon(x.pos) : `<b>${x.pos ? `${x.pos}.` : '—'}</b>`}${x.of ? ` <span class="small muted">/ ${x.of}</span>` : ''}${(x.tags || []).filter(t => HIST_TAG[t]).map(t => ` <span class="pill ${HIST_TAG[t][1]}">${HIST_TAG[t][0]}</span>`).join('')}</td>
      <td class="num">${v(x, 'm')}</td><td class="num">${v(x, 'w')}</td><td class="num">${v(x, 'd')}</td><td class="num">${v(x, 'l')}</td><td class="num">${v(x, 'b')}</td><td class="num"><b>${v(x, 'pts')}</b></td><td class="num">${x.diff == null ? '' : x.diff > 0 ? `+${x.diff}` : x.diff}</td>
      <td class="small" ${x.mgrSrc ? `title="${esc(x.mgrSrc)}"` : ''}>${(x.managers || []).map(esc).join('<br>') || '<span class="muted">—</span>'}</td></tr>`).join('')}
    </tbody></table></div><p class="small muted">Sezony do ${START_SEASON}: Polish Speedway Database (1961–${START_SEASON}) i speedwayw.pl (1948–1961); nazwy lig jak w historii zawodników. Tabela: runda zasadnicza, miejsce: ostateczna kolejność. Menedżer (prowadzący drużynę): protokoły PSD 2020–${START_SEASON}, wcześniej Wikipedia i speedwayw.pl – dane niepełne, kilka nazwisk to zmiana w trakcie sezonu lub duet trenerski. Wiersze „gra” to sezony rozegrane w grze.</p>`;
  return `<div class="grid g-side"><div class="stack">${table}</div>${stats}</div>`;
}
// Sukcesy: skrót na Przeglądzie i pełna lista w Historii (js/honours-game.js)
function honoursTop(r) {
  const g = honourGroups(riderHonours(r));
  if (!g.length) return '<p class="muted">Bez medali w najważniejszych rozgrywkach.</p>';
  return `${g.slice(0, 5).map(x => `<div class="hon-row">${medalIcon(x.p)}<b title="${esc(honComp(x.k)[0])}">${esc(honComp(x.k)[1])}</b><span class="small muted">${honYears(x)}</span></div>`).join('')}
    <p class="small" style="margin-top:8px"><a href="#/zawodnik/${r.id}/historia/sukcesy">Wszystkie sukcesy (${g.reduce((n, x) => n + x.years.length, 0)})</a></p>`;
}
const HON_GROUPS = [['świat', 'Świat'], ['Europa', 'Europa'], ['Polska', 'Polska'], ['kraj', 'Mistrzostwa innych krajów']];
function honoursFull(r) {
  const g = honourGroups(riderHonours(r));
  if (!g.length) return '<div class="panel empty">Zawodnik nie ma jeszcze medali w najważniejszych rozgrywkach.</div>';
  const comps = [...new Set(g.map(x => x.k))].sort(by(k => -honComp(k)[3]));
  return HON_GROUPS.map(([grp, label]) => {
    const ks = comps.filter(k => honComp(k)[2] === grp);
    if (!ks.length) return '';
    return `<div class="panel flush"><div class="ph"><h3>${label}</h3></div><table class="t"><tbody>${ks.map(k => `<tr><td style="width:34%"><b>${esc(honComp(k)[1])}</b>${honComp(k)[1] !== honComp(k)[0] ? `<div class="small muted">${esc(honComp(k)[0])}</div>` : ''}</td>
      <td class="hon-cell">${g.filter(x => x.k === k).sort(by(x => x.p)).map(x => `<span class="hon-item">${x.p <= 3 ? medalIcon(x.p) : '<span class="medal-blank"></span>'}<span>${x.p}. – ${honYears(x)}</span></span>`).join('')}</td></tr>`).join('')}</tbody></table></div>`;
  }).join('');
}
function profHistory(r) {
  const suc = location.hash.slice(2).split('/')[3] === 'sukcesy';
  const sw = `<div class="seg"><a class="btn sm ${suc ? '' : 'primary'}" href="#/zawodnik/${r.id}/historia">Liga</a><a class="btn sm ${suc ? 'primary' : ''}" href="#/zawodnik/${r.id}/historia/sukcesy">Sukcesy</a></div>`;
  return `<div class="stack">${sw}${suc ? honoursFull(r) : profLeagueHistory(r)}</div>`;
}
// Sezony ligowe rozegrane w grze w formacie tabeli historii (miejsca, defekty, upadki, wykluczenia, taśmy) – Historia i Statystyki
function gameSeasonRows(r) {
  // miejsca, defekty, upadki, wykluczenia (bez taśm) i taśmy; starsze zapisy – odtworzone z zapisanych meczów
  const full = (s, season) => { const x = s.p1 != null ? s : { ...seasonPlaceStats(r, season), ...(s.def != null ? { def: s.def, falls: s.falls, exc: s.exc } : {}) };
    return { p1: x.p1, p2: x.p2, p3: x.p3, p4: x.p4, def: x.def, falls: x.falls, exc: x.exc != null ? x.exc - (x.tape || 0) : null, tape: x.tape }; };
  const game = r.career.filter(c => c.heats).map(c => ({ season: c.season, age: c.season - Number(r.born.slice(0, 4)), league: histLeague(c.league), team: G.clubs[c.clubId] ? histTeam(G.clubs[c.clubId]) : '',
    m: c.m, heats: c.heats, ...full(c, c.season), pts: c.pts, bonus: c.bonus, avg: c.avg, game: true }));
  const cur = r.stats[G.season];
  if (cur && cur.heats && G.season > START_SEASON && !game.some(g => g.season === G.season)) game.push({ season: G.season, age: G.season - Number(r.born.slice(0, 4)), league: r.clubId ? histLeague(G.clubs[r.clubId].league) : '', team: r.clubId ? histTeam(G.clubs[r.clubId]) : '', m: cur.m, heats: cur.heats, ...full(cur, G.season), pts: cur.pts, bonus: cur.bonus, avg: round2((cur.pts + cur.bonus) / cur.heats), game: true, current: true });
  return game;
}
function profLeagueHistory(r) {
  const h = riderHist(r);
  const real = (h ? h.seasons : []).filter(s => s.season <= START_SEASON);
  const game = gameSeasonRows(r);
  const rows = [...game, ...real].sort((x, y) => y.season - x.season);
  if (!rows.length) return '<div class="panel empty">Zawodnik nie ma na koncie startów w polskich ligach.</div>';
  return riderSeasonsTable(rows, `${real.length} ${plural(real.length, 'sezon', 'sezony', 'sezonów')} do ${START_SEASON}${game.length ? ` · ${game.length} w grze` : ''}`,
    `Statystyki sezonów do ${START_SEASON}: Polish Speedway Database. Wiersze oznaczone „gra” to sezony rozegrane w grze.`);
}
// Tabela sezonów ligowych zawodnika (format Polish Speedway Database)
function riderSeasonsTable(rows, subtitle, foot) {
  const v = (x, k) => (x[k] == null ? '' : x[k]);
  const tot = k => sum(rows.map(x => Number(x[k]) || 0));
  const totH = tot('heats');
  return `<div class="panel flush"><div class="ph"><h3>Sezony ligowe w Polsce</h3><span class="small muted">${subtitle}</span></div><table class="t"><thead><tr>
    <th>Sezon</th><th class="num">Wiek</th><th>Rozgrywki</th><th>Drużyna</th><th class="num" title="mecze">M</th><th class="num" title="biegi">B</th><th class="num" title="miejsca I">I</th><th class="num">II</th><th class="num">III</th><th class="num">IV</th>
    <th class="num" title="defekty">D</th><th class="num" title="upadki">U</th><th class="num" title="wykluczenia">W</th><th class="num" title="taśmy">T</th><th class="num">Pkt</th><th class="num" title="bonusy">Bon.</th><th class="num" title="średnia biegowa">Śr.</th></tr></thead><tbody>
    ${rows.map(x => `<tr class="${x.game ? 'me' : ''}"><td>${x.season}${x.game ? ` <span class="pill">${x.current ? 'w toku' : 'gra'}</span>` : ''}</td><td class="num">${v(x, 'age')}</td><td>${esc(x.league)}</td><td>${teamCell(x.team)}</td><td class="num">${v(x, 'm')}</td><td class="num">${v(x, 'heats')}</td>
      <td class="num">${v(x, 'p1')}</td><td class="num">${v(x, 'p2')}</td><td class="num">${v(x, 'p3')}</td><td class="num">${v(x, 'p4')}</td><td class="num">${v(x, 'def')}</td><td class="num">${v(x, 'falls')}</td><td class="num">${v(x, 'exc')}</td><td class="num">${v(x, 'tape')}</td>
      <td class="num"><b>${v(x, 'pts')}</b></td><td class="num">${v(x, 'bonus')}</td><td class="num"><b>${x.avg != null ? Number(x.avg).toFixed(3) : ''}</b></td></tr>`).join('')}
    <tr><td colspan="4"><b>Razem</b></td><td class="num"><b>${tot('m')}</b></td><td class="num"><b>${totH}</b></td><td colspan="8"></td><td class="num"><b>${tot('pts')}</b></td><td class="num"><b>${tot('bonus')}</b></td><td class="num"><b>${totH ? ((tot('pts') + tot('bonus')) / totH).toFixed(3) : ''}</b></td></tr>
    </tbody></table></div><p class="small muted">${foot}</p>`;
}
function profDev(r) {
  const age = riderAge(r), p = perceive(r), own = r.clubId === G.clubId;
  const pts = r.hist.map(h => ({ v: round1(h.s * 5), l: fmtDateShort(h.d) }));
  pts.push({ v: round1(r.ca), l: 'teraz' });
  const phase = age < 16 ? 'adept – nauka jazdy' : age <= 21 ? 'junior – najszybszy rozwój' : age <= 26 ? 'rozwój' : age <= 31 ? 'szczyt' : 'schyłek – tempo starzenia zależy od odporności, regeneracji i profesjonalizmu';
  const log = p.K >= 0.8 ? (r.paLog || []) : [];
  return `<div class="grid g-side"><div class="stack"><div class="panel"><h3>Umiejętności w czasie</h3>${own ? (typeof attrChart === 'function' ? attrChart(r) : sparkline(pts, { fmt: v => v.toFixed(0) })) : '<p class="muted">Szczegółowy przebieg rozwoju znamy tylko u zawodników naszego klubu.</p>'}
      ${log.length ? `<h3 style="margin-top:14px">Zmiany oceny potencjału</h3>${log.slice(-6).reverse().map(e => `<div class="row small"><span class="muted" style="width:80px">${fmtDateShort(e.d)}</span><span class="${e.v > 0 ? 'pos' : 'neg'}" style="width:60px">${e.v > 0 ? 'wzrost' : 'spadek'}</span><span>${esc(e.why)}</span></div>`).join('')}` : ''}</div>
      ${own && typeof trainingPanel === 'function' ? `<div class="panel"><h3>Trening</h3>${trainingPanel(r)}</div>` : ''}</div>
    <div class="panel"><h3>Perspektywy</h3><div class="kv"><div>Obecnie</div><div>${caStars(r)}${scKnown(r) ? `<div class="small muted">${esc(caClass(p.caMid))}</div>` : ''}</div><div>Potencjał</div><div>${paStars(r)}${scKnown(r) ? `<div class="small muted">w szczycie: ${esc(caClass(p.paMid).toLowerCase())}</div>` : ''}</div><div>Wiek</div><div>${age}</div>
      <div>Faza kariery</div><div>${phase}</div><div>Charakter</div><div>${charLabel(r, p.K)}</div><div>Plan treningowy</div><div>${FOCUS[r.focus || ''].name}</div></div>
      ${own ? `<h3 style="margin-top:14px">Indywidualny plan treningowy</h3><select onchange="ACT.setFocus(${r.id}, this.value)" style="width:100%">${Object.entries(FOCUS).map(([k, f]) => `<option value="${k}" ${(r.focus || '') === k ? 'selected' : ''}>${f.name}</option>`).join('')}</select><p class="small muted">Wybrany obszar rozwija się szybciej kosztem pozostałych – ale tylko w swoim oknie treningowym (np. fizyczne zimą, technika na torze).</p>` : ''}
      <p class="small muted">Żółte gwiazdki – to, co sztab wie na pewno; białe – możliwy zakres. Lepszy skaut (ocena talentu) i obserwacja zawężają ocenę, a słaby skaut może przeszacować młodych.</p></div></div>`;
}
function profMedical(r) {
  const inj = Object.values(G.injuries).filter(i => i.riderId === r.id).sort(by(i => i.start, -1));
  const cur = r.injury && G.injuries[r.injury];
  return `<div class="grid g2"><div class="panel"><h3>Stan zdrowia</h3>${cur ? `<p class="neg"><b>${esc(cur.kind)}</b> – przerwa do ${fmtDate(cur.until)} (${dayDiff(G.date, cur.until)} dni)</p>` : '<p class="pos">Zdrowy, gotowy do jazdy.</p>'}
      <div class="kv"><div>Kondycja</div><div>${Math.round(r.cond)}%</div><div>Ryzyko urazu</div><div>${riskLabel(r)}</div><div>Upadki w sezonie</div><div>${(r.stats[G.season] || {}).falls || 0}</div></div></div>
    <div class="panel flush"><div class="ph"><h3>Historia urazów</h3></div><table class="t"><thead><tr><th>Uraz</th><th>Od</th><th>Do</th><th class="num">Dni</th><th>Gdzie</th></tr></thead><tbody>${inj.map(i => `<tr><td>${esc(i.kind)}</td><td>${fmtDateShort(i.start)}</td><td>${fmtDateShort(i.until)}</td><td class="num">${i.days}</td><td class="small">${esc(i.where)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Brak urazów w grze</td></tr>'}</tbody></table></div></div>`;
}
function riskValue(r) { return clamp((100 - r.cond) * 0.8 + (r.attrs.aggression - 10) * 2 + (20 - r.attrs.balance) * 1.2 + ((r.stats[G.season] || {}).falls || 0) * 3, 0, 100); }
function riskLabel(r) { const v = riskValue(r); return v > 45 ? '<span class="neg">wysokie</span>' : v > 25 ? '<span class="warn">średnie</span>' : '<span class="pos">niskie</span>'; }

// ---------- Oferta / negocjacje: ekran #/oferta (js/ui-offer.js) ----------

// ---------- Sztab ----------
PAGES.sztab = parts => {
  const sub = parts[0] || '';
  const T = tabs('sztab', [['', 'Trening'], ['kalendarz', 'Kalendarz'], ['obowiazki', 'Obowiązki'], ['funkcyjne', 'Osoby funkcyjne']], sub === 'trening' || sub === 'przeglad' ? '' : sub);
  if (sub === 'kalendarz' && typeof teamAvailability === 'function') return { title: 'Trening', sub: 'Kalendarz dostępności zawodników', tabs: T, body: teamAvailability(clubRiders(G.clubId).sort((a, b) => (isJunior(a) - isJunior(b)) || b.skill - a.skill)) };
  if ((sub === '' || sub === 'trening' || sub === 'przeglad') && typeof sztabTraining === 'function') return { title: 'Trening', sub: `Trening i baza szkoleniowa · ${esc(trainingPhase().name)} · sztab ${clubStaff(G.clubId).length} osób, płace ${fmtMoney(sum(clubStaff(G.clubId).map(s => s.wage)), true)} / mies.`, tabs: T, body: sztabTraining() };
  if (sub === 'funkcyjne') {
    const off = myClub().officials || [];
    const funcs = [...new Set(off.flatMap(o => o.funcs))];
    return { title: 'Trening', sub: `Osoby z licencją PZM przypisane do klubu (stan 26.05.2026) · ${off.length}`, tabs: T, body: off.length ? `<div class="panel flush"><table class="t"><thead><tr><th>Osoba</th><th>Funkcje</th><th>Klub w rejestrze PZM</th><th>W sztabie gry</th></tr></thead><tbody>
      ${off.sort(by(o => o.name)).map(o => `<tr><td><b>${esc(o.name)}</b></td><td>${o.labels.map(l => `<span class="pill" style="text-transform:none;margin:1px">${esc(l)}</span>`).join(' ')}</td><td class="small muted">${esc(o.pzmClub)}</td><td>${Object.values(G.staff).some(s => s.clubId === G.clubId && normName(s.name) === normName(o.name)) ? '<span class="pos">tak</span>' : ''}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Funkcje: ${funcs.map(f => `${f} – ${FUNC_LABEL[f] || f}`).join(', ')}.</p>` : '<div class="panel empty">Brak danych o osobach funkcyjnych klubu.</div>' };
  }
  const staff = clubStaff(G.clubId);
  if (sub === 'rynek') { setTimeout(() => { UI.tfMode = 'staff'; go('#/transfery'); }, 0); return { title: '', body: '' }; } // dawny rynek personelu → Transfery → Sztab
  if (sub === 'obowiazki') {
    // podział zadań: sportowe – osoba ze sztabu (domyślnie najlepsza w danym atrybucie), organizacyjne – menedżer, prezes albo menedżer klubu (js/board.js)
    const pick = (key, opts, auto) => `<select onchange="ACT.setDuty('${key}', this.value)"><option value="">Automatycznie: ${esc(auto)}</option>${opts.map(o => `<option value="${o.id}" ${G.duties && G.duties[key] === o.id ? 'selected' : ''}>${esc(o.name)} (${o.v})</option>`).join('')}</select>`;
    const sport = SPORT_DUTIES.map(([n, k]) => {
      const opts = staff.map(s => ({ id: s.id, name: s.name, v: s.attrs[k] || 0 })).sort(by(o => o.v, -1));
      const best = opts[0], cur = opts.find(o => G.duties && G.duties[k] === o.id) || best;
      return `<tr><td>${n}</td><td>${opts.length ? pick(k, opts, best ? `${best.name} (${best.v})` : '—') : '<span class="neg">brak</span>'}</td><td style="text-align:right"><b>${cur ? cur.v : '—'}</b></td></tr>`;
    }).join('');
    const biz = Object.entries(BIZ_DUTIES).map(([k, [n]]) => {
      const opts = bizCandidates(k), best = opts.slice().sort(by(o => o.v, -1))[0], cur = dutyWho(k);
      return `<tr><td>${n}</td><td>${pick(k, opts, `${best.name} (${best.v})`)}</td><td style="text-align:right"><b>${cur.v}</b></td></tr>`;
    }).join('');
    return { title: 'Trening', tabs: T, body: `<div class="panel flush"><table class="t"><thead><tr><th>Zadania sportowe</th><th>Odpowiedzialny</th><th style="text-align:right">Ocena</th></tr></thead><tbody>${sport}</tbody></table></div>
      <div class="panel flush"><table class="t"><thead><tr><th>Zadania organizacyjne</th><th>Odpowiedzialny</th><th style="text-align:right">Ocena</th></tr></thead><tbody>${biz}</tbody></table></div>` };
  }
  const groups = Object.entries(STAFF_ROLES).map(([k, r]) => [r.name, staff.filter(s => s.role === k)]).filter(g => g[1].length);
  return { title: 'Sztab', sub: `${staff.length} osób · płace ${fmtMoney(sum(staff.map(s => s.wage)), true)} / mies.`, tabs: T,
    body: `<div class="group-title">Menedżer</div><div class="cards"><div class="card staff" onclick="go('#/menedzer')"><div class="ph">${staffPic(G.manager, silhouette(G.manager.name, myClub().colors[0]))}</div><div class="body"><div class="nm"><small>${typeof mgrRole === 'function' && mgrRole() !== 'menedżer' ? 'Menedżer i trener' : 'Menedżer drużyny'}</small>${esc(G.manager.name)}</div><div class="meta"><span>w klubie od ${fmtDateShort(G.manager.since)}</span></div><div class="foot"><span>Zaufanie zarządu</span><b>${Math.round(G.board.confidence)}%</b></div></div></div></div>
    <div class="group-title">Trenerzy i specjaliści <span class="n">${staff.length}</span></div><div class="cards">${staff.sort(by(s => Object.keys(STAFF_ROLES).indexOf(s.role))).map(staffCard).join('')}</div>` };
};
const STAFF_TABS = [['', 'Przegląd'], ['kontrakt', 'Kontrakt'], ['historia', 'Historia']];
// Kontekst przewijania profili osób (strzałki ‹ ›): lista z ekranu, z którego weszliśmy, albo sztab klubu
function setStaffCtx(ids, label) { UI.sctx = { ids: ids.map(String), label }; }
ACT.staffStep = d => {
  const parts = location.hash.slice(2).split('/'), id = parts[1], ids = UI.sctx && UI.sctx.ids;
  if (!ids || !ids.includes(id)) return;
  const next = ids[ids.indexOf(id) + d];
  if (next != null) go(`#/osoba/${next}${parts[2] ? '/' + parts[2] : ''}`);
};
PAGES.osoba = parts => {
  const s = G.staff[parts[0]];
  if (!s) return { title: 'Nie znaleziono osoby', body: '' };
  const sub = parts[1] || '';
  const c = G.clubs[s.clubId];
  if (!UI.sctx || !UI.sctx.ids.includes(String(s.id))) setStaffCtx(c ? clubStaff(c.id).sort(by(x => Object.keys(STAFF_ROLES).indexOf(x.role))).map(x => x.id) : [s.id], c ? `sztab: ${c.short}` : 'Trener');
  const ids = UI.sctx.ids, i = ids.indexOf(String(s.id));
  if (c) document.documentElement.style.setProperty('--club', c.colors[0]);
  const age = s.born ? ageAt(s.born, G.date) : null;
  const v = typeof staffProfileView === 'function' ? staffProfileView(s) : null;
  const lvl = typeof staffLevel === 'function' ? staffLevel(s) : 10;
  const status = c ? `kontrakt do końca sezonu ${s.until}` : s.national ? `selekcjoner ${nationTeam(s.national)}` : s.player ? 'bez kontraktu' : 'wolny – do zatrudnienia';
  const head = `<div class="page-head"><div class="profile-head"><div class="avatar-wrap">${staffPic(s, silhouette(s.name, c ? c.colors[0] : undefined))}</div>
    <div class="who"><h1>${esc(s.name)}</h1>
      <div class="facts">${s.national && !s.clubId ? `<span class="pill">${esc(staffRoleName(s))}</span>` : staffRoles(s).map(r => `<span class="pill">${esc((STAFF_ROLES[r] || { name: r }).name)}</span>`).join('')}${s.player ? '<span class="pill jun">Ty</span>' : ''}<span class="fc">${countryLink(s.country)}</span>
        <span>${age != null ? `<b>${age} lat</b> · ur. ${fmtDate(s.born)}${s.birthPlace ? `, ${esc(s.birthPlace)}` : ''}` : '<span class="muted">data urodzenia nieznana</span>'}</span></div></div>
    <div class="contract-box">${c ? `<div class="clubname">${crest(c, 'lg')}<div><a href="${clubHref(c.id)}"><b>${esc(c.name)}</b></a><div class="small muted">${status}</div></div></div>`
      : `<div><b>${s.national ? countryLink(s.national) : 'bez klubu'}</b><div class="small muted">${status}</div></div>`}</div>
    <div class="coach-box"><div class="small muted">Ocena sztabu</div>
      <div class="row" style="gap:18px"><div><div class="small muted">Umiejętności</div>${starsPlain(clamp(lvl / 4, 0.5, 5))}</div>${v ? `<div><div class="small muted">Specjalizacja</div><b>${esc(v.main.name)}</b></div>` : ''}</div>
      ${s.note ? `<div class="small" style="margin-top:4px">${esc(s.note.charAt(0).toUpperCase() + s.note.slice(1))}.</div>` : ''}</div></div>
    <div class="tabs-row">${tabs(`osoba/${s.id}`, STAFF_TABS, sub)}
      <div class="profile-nav"><button class="arrow" ${i > 0 ? '' : 'disabled'} onclick="ACT.staffStep(-1)" title="Poprzedni">‹</button><div class="pos">${i + 1} / ${ids.length}<br><span class="small">${esc(UI.sctx.label)}</span></div><button class="arrow" ${i < ids.length - 1 ? '' : 'disabled'} onclick="ACT.staffStep(1)" title="Następny">›</button></div></div></div>`;
  const body = { kontrakt: staffContract, historia: staffHistory }[sub] || staffOverview;
  return { head, body: body(s) };
};
// Atrybuty osoby ze sztabu w trzech kolumnach (jak u zawodnika)
const STAFF_ATTR_GROUPS = [['Trening', ['coaching', 'youth', 'mini', 'fitness']], ['Ludzie i mentalność', ['motivation', 'psychology', 'manMgmt', 'discipline']],
  ['Mecz i klub', ['tactics', 'judging', 'tech', 'track', 'medical', 'physio']]];
// Osoba z dwiema funkcjami (np. Nicki Pedersen: zawodnik i menedżer kadry) – przełącznik profilu na Przeglądzie
const staffOfRider = r => Object.values(G.staff).find(s => !s.player && normName(s.name) === normName(r.name)) || null;
const riderOfStaff = s => Object.values(G.riders).find(r => normName(r.name) === normName(s.name)) || null;
function roleSwitch(rider, staff, active) {
  if (!rider || !staff) return '';
  return `<div class="row" style="margin-bottom:12px"><div class="seg">${[['rider', 'Zawodnik', `#/zawodnik/${rider.id}`], ['staff', 'Trener', `#/osoba/${staff.id}`]].map(([k, l, h]) => `<button class="btn sm ${active === k ? 'primary' : ''}" onclick="go('${h}')">${l}</button>`).join('')}</div><span class="small muted" style="margin-left:10px">${esc(rider.name)} pełni dwie funkcje</span></div>`;
}
function staffOverview(s) {
  const v = typeof staffProfileView === 'function' ? staffProfileView(s) : null, c = G.clubs[s.clubId];
  if (s.player) return playerOverview(s, v, c);
  const lbl = Object.fromEntries(STAFF_ATTRS);
  const col = ([t, keys]) => `<div><h4 style="margin-top:0">${t}</h4>${keys.map(k => `<div class="attr"><span>${lbl[k]}</span><span class="v ${attrClass(s.attrs[k])}">${s.attrs[k] ?? '—'}</span></div>`).join('')}</div>`;
  const hist = staffCoachRows(s), last = hist.find(r => !r.national);
  return `${roleSwitch(riderOfStaff(s), s, 'staff')}<div class="grid ov-top">
    <div class="panel"><h3>Informacje</h3><div class="kv"><div>Klub</div><div>${c ? clubLink(c.id) : s.national ? countryLink(s.national) : 'brak'}</div><div>Rola</div><div>${esc(staffRoleNames(s))}${staffRoles(s).length > 1 ? `<div class="small muted">kilka ról – skuteczność w każdej ${Math.round(staffEff(s) * 100)}%</div>` : ''}</div>
      <div>Kontrakt</div><div>${c ? `do końca ${s.until}` : '—'}</div><div>Pensja</div><div>${fmtMoney(c ? s.wage : staffWageFor(s, myClub()))} / mies.${c ? '' : ' <span class="small muted">(oczekiwania)</span>'}</div>
      ${s.joined && s.joined > GAME_START && c ? `<div>W klubie od</div><div>${fmtDate(s.joined)}</div>` : ''}
      <div>Ostatnio jako trener</div><div>${last ? `${last.y}: ${esc(last.team)} (${esc(last.lg)})${last.place ? `, ${last.place}. miejsce` : ''}` : '<span class="muted">brak danych</span>'}</div>
      <div>Licencja trenerska</div><div>${(l => l ? `<b>${l.kind === 'trener' ? 'trener' : 'instruktor'} sportu żużlowego</b><div class="small">${l.cert ? `uprawnienia ${esc(l.cert)}` : 'uprawnienia nadane'}${l.year ? ` · nadane w ${l.year}${l.date ? ` (${fmtDate(l.date)})` : ''}` : ''}${l.lic ? ` · licencja nr ${esc(l.lic)}` : ''}</div>` : 'brak')(typeof staffLicence === 'function' ? staffLicence(s) : null)}</div>
      ${s.schoolId && G.miniSchools && G.miniSchools[s.schoolId] ? `<div>Szkółka</div><div>${esc(G.miniSchools[s.schoolId].name)}</div>` : ''}${familyRow(s.name)}
      <div>Funkcje w rejestrze PZM</div><div class="small">${(s.funcs || []).map(f => FUNC_LABEL[f] || f).join(', ') || '—'}</div></div>
</div>
    <div class="panel"><h3>Atrybuty</h3><div class="attr-cols">${STAFF_ATTR_GROUPS.map(col).join('')}</div></div></div>
  ${v ? `<div class="grid g2" style="margin-top:16px"><div class="panel"><h3>Profil trenera</h3><div class="kv"><div>Specjalizacja</div><div><b>${esc(v.main.name)}</b><div class="small muted">${esc(v.main.desc)}</div></div><div>Profil poboczny</div><div>${esc(v.side)}</div></div>
      <p class="small muted">Specjalizacja to cechy zawodników, które pod jego okiem rosną szybciej – najszybciej u zawodników z naturalnymi predyspozycjami do nich.</p></div>
    <div class="panel"><h3>Charakter</h3>${v.chars.length ? `<ul class="report">${v.chars.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : `<p class="muted">${v.known === 'full' ? 'Bez wyraźnych cech.' : 'Nieznany – poznasz go po kilku miesiącach współpracy.'}</p>`}</div></div>` : ''}`;
}
// Profil gracza (menedżer drużyny) – te same zakładki co u innych trenerów, plus atrybuty menedżerskie i rodzina
function playerOverview(s, v, c) {
  const m = G.manager, lbl = Object.fromEntries(STAFF_ATTRS);
  const col = ([t, keys]) => `<div><h4 style="margin-top:0">${t}</h4>${keys.map(k => `<div class="attr"><span>${lbl[k]}</span><span class="v ${attrClass(s.attrs[k])}">${s.attrs[k] ?? '—'}</span></div>`).join('')}</div>`;
  const exp = findById(MGR_EXP, m.exp), sp = findById(SPW_EXP, m.spwExp), ce = findById(COACH_EXP, m.coachExp), l = staffLicence(s);
  const kid = x => `<div>${x.riderId && G.riders[x.riderId] ? `<a href="#/zawodnik/${x.riderId}">${esc(x.name)}</a>` : x.kidId && G.academy[x.kidId] ? `<a href="#/adept/${x.kidId}">${esc(x.name)}</a>` : esc(x.name)} <span class="small muted">${fmtDate(x.born)}${x.rides ? '' : ' · nie jeździ'}</span></div>`;
  return `<div class="grid ov-top">
    <div class="panel"><h3>Informacje</h3><div class="kv"><div>Klub</div><div>${c ? clubLink(c.id) : 'brak'}</div><div>Rola</div><div>${esc(staffRoleNames(s))}${staffRoles(s).length > 1 ? `<div class="small muted">kilka ról – skuteczność w każdej ${Math.round(staffEff(s) * 100)}%</div>` : ''}</div>
      <div>Kontrakt</div><div>${c ? `do końca ${s.until}` : '—'}</div><div>Pensja</div><div>${fmtMoney(s.wage)} / mies.</div><div>W klubie od</div><div>${fmtDate(s.joined || m.since)}</div>
      ${m.place ? `<div>Miejsce urodzenia</div><div>${esc(m.place)}</div>` : ''}
      <div>Ostatnio jako trener</div><div><span class="muted">debiut – pierwsza praca trenerska</span></div>
      <div>Licencja trenerska</div><div>${l ? `<b>${l.kind === 'trener' ? 'trener' : 'instruktor'} sportu żużlowego</b><div class="small">uprawnienia nadane${l.year ? ` w ${l.year}` : ''}</div>` : '<span class="muted">brak uprawnień</span>'}</div>
      <div>Zaplecze</div><div>${esc(exp.name)}</div><div>Doświadczenie żużlowe</div><div>${esc(sp.name)}</div><div>Kompetencje</div><div>${esc(ce.name)}</div>
      <div>Zaufanie zarządu</div><div>${Math.round(G.board.confidence)}%</div>
      ${(m.children || []).length ? `<div>Dzieci</div><div>${m.children.map(kid).join('')}</div>` : ''}</div></div>
    <div class="panel"><h3>Atrybuty trenera</h3><div class="attr-cols">${STAFF_ATTR_GROUPS.map(col).join('')}</div></div></div>
  <div class="grid g2" style="margin-top:16px"><div class="panel"><h3>Atrybuty menedżera</h3>${m.attrs ? `<div class="grid g2">${MGR_ATTRS.map(([k, n, d]) => `<div class="attr" title="${esc(d)}"><span>${esc(n)}</span><span class="v ${attrClass(m.attrs[k])}">${m.attrs[k]}</span></div>`).join('')}</div>` : '<p class="muted">Brak danych.</p>'}</div>
    ${v ? `<div class="panel"><h3>Profil trenera</h3><div class="kv"><div>Specjalizacja</div><div><b>${esc(v.main.name)}</b><div class="small muted">${esc(v.main.desc)}</div></div><div>Profil poboczny</div><div>${esc(v.side || '—')}</div></div>
      <p class="small muted">Specjalizacja to cechy zawodników, które pod Twoim okiem rosną szybciej – najszybciej u zawodników z naturalnymi predyspozycjami do nich.</p></div>` : ''}</div>`;
}
function playerHistory(s) {
  const sp = findById(SPW_EXP, G.manager.spwExp), mode = UI.shist === 'rider' ? 'rider' : 'coach';
  const sw = `<div class="row" style="justify-content:space-between;margin-bottom:12px"><div class="seg">${[['coach', 'Trener'], ['rider', 'Zawodnik']].map(([k, l]) => `<button class="btn sm ${mode === k ? 'primary' : ''}" onclick="ACT.staffHistMode('${k}')">${l}</button>`).join('')}</div></div>`;
  const note = { licence: ' Licencja żużlowa bez występów w składzie ligowym.', mini: ' Starty wyłącznie w miniżużlu.', amateur: ' Jazda amatorska, bez licencji.' }[sp.id] || '';
  if (mode === 'rider') return sw + `<div class="panel empty">Brak startów w polskich ligach.${note}</div>`;
  return sw + `<div class="panel empty">Debiut w roli menedżera i trenera – ${fmtDate(G.manager.since)}, ${esc(G.clubs[G.clubId] ? G.clubs[G.clubId].name : '')}. Wcześniej nie prowadził żadnej drużyny.</div>`;
}
function staffContract(s) {
  const c = G.clubs[s.clubId], mine = s.clubId === G.clubId && !s.player;
  if (s.player) return `<div class="grid g2"><div class="panel"><h3>Twoja umowa</h3><div class="kv"><div>Klub</div><div>${c ? clubLink(c.id) : 'brak'}</div><div>Funkcja</div><div>${esc(STAFF_ROLES[s.role].name)}</div>
      <div>Pensja</div><div>${fmtMoney(s.wage)} / mies.</div><div>Kontrakt do</div><div>${c ? `końca sezonu ${s.until}` : '—'}</div><div>W klubie od</div><div>${fmtDate(s.joined || G.manager.since)}</div><div>Zaufanie zarządu</div><div>${Math.round(G.board.confidence)}%</div></div></div>
    <div class="panel"><h3>Zasady</h3><p class="small muted">Pensja menedżera jest kosztem klubu jak pensje sztabu. O przedłużeniu umowy decyduje zarząd – zależy od realizacji celów i zaufania.</p></div></div>`;
  return `<div class="grid g2"><div class="panel"><h3>Umowa</h3><div class="kv"><div>Klub</div><div>${c ? clubLink(c.id) : s.national ? countryLink(s.national) : 'brak – wolny'}</div>
      <div>Pensja</div><div>${fmtMoney(c ? s.wage : staffWageFor(s, myClub()))} / mies.</div><div>Kontrakt do</div><div>${c ? `końca sezonu ${s.until} <span class="small muted">(${dealEndDate(s.until)})</span>${mine && s.until <= G.season ? ' <span class="pill inj">wygasa</span>' : ''}` : '—'}</div>
      ${mine ? `<div>Odprawa przy zwolnieniu</div><div>${fmtMoney(s.wage * 3)}</div>` : ''}</div>
      <div class="row wrap" style="margin-top:14px">${mine ? `<button class="btn danger" onclick="ACT.arm(this, 'fire', '${s.id}')">Zwolnij (odprawa ${fmtMoney(s.wage * 3, true)})</button>` : !c && !s.national ? (staffSlotFree(myClub(), s) ? `<a class="btn primary" href="#/oferta-sztab/${s.id}">${staffNeg(s.id) ? 'Rozmowy o umowie' : 'Złóż ofertę'}</a>` : `<button class="btn" disabled>Zatrudnij</button><span class="small warn">brak miejsca w sztabie (${staffCounts(myClub())[staffKind(s)]}/${staffLimits(myClub())[staffKind(s)]})</span>`) : ''}<a class="btn" href="#/sztab">‹ Sztab</a></div></div>
    ${mine ? staffRenewPanel(s) : ''}<div class="panel"><h3>Role w klubie</h3>${mine ? `<div class="stack">${COACH_ROLES.filter(r => r !== 'u24Coach' || c.league === 'PGE').map(r => `<label class="row small"><input type="checkbox" ${staffRoles(s).includes(r) ? 'checked' : ''} onchange="ACT.staffRole('${s.id}', '${r}', this.checked)"> ${esc(STAFF_ROLES[r].name)}</label>`).join('')}</div>
      <p class="small muted">Jedna osoba może pełnić kilka ról – im więcej, tym mniejsza skuteczność w każdej z nich (2 role – 80%, 3 – 65%, 4 – 55%). Każda dodatkowa rola podnosi pensję o 35% stawki tej roli.</p>` : `<p>${esc(staffRoleNames(s))}</p>`}
      <p class="small muted">Wolnej osobie składasz ofertę: role, pensja, długość umowy i premie – odpowiedź po 1–3 dniach. Osoba z kontraktem w innym klubie nie jest dostępna. Zwolnienie kosztuje trzy pensje.</p></div></div>`;
}
// Umowa: przedłużenie / oferta – negocjacje na ekranie #/oferta-sztab (js/ui-staff-offer.js, js/staff-contracts.js)
function staffRenewPanel(s) {
  if (s.until == null) return '';
  const n = staffNeg(s.id), last = staffNegLast(s.id);
  const st = n ? (n.status === 'pending' ? `oferta czeka na odpowiedź (do ${fmtDate(n.decideBy)})` : `kontroferta: ${fmtMoney(n.counter.wage)} / mies., ${n.counter.years} ${plural(n.counter.years, 'sezon', 'sezony', 'sezonów')}`)
    : last && last.status === 'rejected' && last.final && last.season === G.season ? `<span class="neg">odmowa – odejdzie po sezonie ${s.until}</span>` : '';
  if (!staffRenewable(s)) return `<div class="panel"><h3>Przedłużenie umowy</h3><p class="small muted">Umowa obowiązuje do końca sezonu ${s.until}. O przedłużeniu można rozmawiać w ostatnim roku umowy (od sezonu ${s.until}).</p></div>`;
  return `<div class="panel"><h3>Przedłużenie umowy</h3><p class="small">Umowa wygasa 31 października ${s.until}.${st ? ` Rozmowy: <b>${st}</b>.` : ''}</p>
    <a class="btn primary" href="#/oferta-sztab/${s.id}">${n ? 'Rozmowy o umowie' : 'Negocjuj przedłużenie'}</a>
    <p class="small muted" style="margin-top:8px">Ustalasz role (jedną lub kilka), pensję, długość umowy i premie za sukcesy – odpowiedź po 1–3 dniach.</p></div>`;
}
// Przypisanie / odebranie roli osobie z własnego sztabu (główna rola – pierwsza z listy ról trenerskich)
ACT.staffRole = (id, role, on) => {
  const s = G.staff[id];
  if (!s || s.clubId !== G.clubId) return;
  let roles = staffRoles(s).filter(r => r !== role);
  if (on) roles.push(role);
  if (!roles.length) return toast('Osoba musi mieć co najmniej jedną rolę.', 'bad');
  const keepOther = roles.filter(r => !COACH_ROLES.includes(r));
  const coachR = COACH_ROLES.filter(r => roles.includes(r));
  s.role = coachR[0] || keepOther[0];
  s.extraRoles = roles.filter(r => r !== s.role);
  if (!s.extraRoles.length) delete s.extraRoles;
  s.wage = staffWageFor(s);
  if (typeof TQ !== 'undefined') TQ.date = null;
  STAFF_BEST.date = null;
  changed();
}
// Historia trenerska: dane z js/staff-history.js (protokoły PSD 2020–2025, Wikipedia + wyniki PSD wcześniej)
function staffCoachRows(s) { return (typeof STAFF_HIST !== 'undefined' && STAFF_HIST.coach[s.name]) || []; }
ACT.staffHistMode = m => { UI.shist = m; render(); };
function staffHistory(s) {
  if (s.player) return playerHistory(s);
  const coach = staffCoachRows(s), rider = typeof STAFF_HIST !== 'undefined' && STAFF_HIST.riders[s.name];
  const mode = UI.shist === 'rider' ? 'rider' : 'coach';
  const sw = `<div class="row" style="justify-content:space-between;margin-bottom:12px"><div class="seg">${[['coach', 'Trener'], ['rider', 'Zawodnik']].map(([k, l]) => `<button class="btn sm ${mode === k ? 'primary' : ''}" onclick="ACT.staffHistMode('${k}')">${l}</button>`).join('')}</div></div>`;
  if (mode === 'rider') {
    if (!rider) return sw + '<div class="panel empty">Brak startów w polskich ligach w Polish Speedway Database.</div>';
    const born = s.born ? Number(s.born.slice(0, 4)) : null;
    const rows = rider.seasons.map(x => ({ ...x, age: x.age ?? (born ? x.season - born : null) })).sort((a, b) => b.season - a.season);
    return sw + riderSeasonsTable(rows, `${new Set(rows.map(r => r.season)).size} sezonów`, 'Kariera zawodnicza: Polish Speedway Database (speedway.com.pl).');
  }
  const club = coach.filter(r => !r.national), nat = coach.filter(r => r.national);
  // bieżąca praca z reprezentacją (menedżer kadry)
  if (s.national && !nat.some(r => (r.y2 || r.y) >= G.season)) nat.unshift({ y: G.season, team: `Reprezentacja: ${COUNTRY[s.national] || s.national}`, national: true });
  if (!coach.length && !s.national) return sw + '<div class="panel empty">Brak danych o pracy trenerskiej w polskich ligach (protokoły PSD od 2020 r., Wikipedia).</div>';
  const t = k => sum(club.map(r => r[k] || 0)), pct = (w, m) => (m ? `${Math.round(w / m * 100)}%` : '');
  const medal = p => (p === 1 ? '🥇 ' : p === 2 ? '🥈 ' : p === 3 ? '🥉 ' : '');
  return sw + `<div class="panel flush"><div class="ph"><h3>Kariera trenerska w polskich ligach</h3><span class="small muted">${new Set(club.map(r => r.y)).size} sezonów · ${new Set(club.map(r => r.team)).size} drużyn</span></div><table class="t"><thead><tr>
      <th>Sezon</th><th>Rozgrywki</th><th>Drużyna</th><th>Rola</th><th class="num">Miejsce</th><th class="num" title="mecze">M</th><th class="num" title="zwycięstwa">Z</th><th class="num" title="remisy">R</th><th class="num" title="porażki">P</th><th class="num">% zw.</th><th>Źródło</th></tr></thead><tbody>
    ${club.map(r => `<tr><td>${r.y}</td><td>${esc(r.lg)}</td><td>${teamCell(r.team)}</td><td class="small">${esc(r.role)}</td><td class="num">${r.place ? `${medal(r.place)}<b>${r.place}.</b>` : '—'}${r.note ? ` <span class="small muted">${esc(r.note.toLowerCase())}</span>` : ''}</td>
      <td class="num">${r.m}</td><td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num">${pct(r.w, r.m)}</td><td class="small muted">${esc(r.src)}</td></tr>`).join('')}
    <tr><td colspan="5"><b>Razem</b></td><td class="num"><b>${t('m')}</b></td><td class="num"><b>${t('w')}</b></td><td class="num"><b>${t('d')}</b></td><td class="num"><b>${t('l')}</b></td><td class="num"><b>${pct(t('w'), t('m'))}</b></td><td></td></tr></tbody></table></div>
    ${nat.length ? `<div class="panel" style="margin-top:16px"><h3>Reprezentacja</h3>${nat.map(r => `<div class="row small"><span style="width:110px">${r.y}${r.y2 && r.y2 !== r.y ? `–${r.y2}` : ''}</span><b>${esc(r.team)}</b></div>`).join('')}</div>` : ''}
    <p class="small muted">Sezony 2020–2025: protokoły meczów z Polish Speedway Database (Ekstraliga od 2020, wszystkie ligi od 2024) – bilans meczów, w których był trenerem lub menedżerem drużyny. Wcześniejsze lata: kluby i lata pracy z Wikipedii, bilans i miejsce drużyny w sezonie z wyników PSD. Miejsce – klasyfikacja końcowa ligi.</p>`;
}
ACT.staffModal = id => go(`#/osoba/${id}`);
ACT.hire = id => { const s = G.staff[id];
  if (!staffSlotFree(myClub(), s)) { const k = staffKind(s), n = staffCounts(myClub())[k], L = staffLimits(myClub())[k]; return toast(`Limit: ${k === 'coach' ? 'sztab trenerski' : 'osoby funkcyjne'} ${n}/${L}. Zwolnij kogoś albo powierz role dodatkowe obecnym trenerom.`, 'bad'); } if (s.baseWage == null) s.baseWage = s.wage; s.clubId = G.clubId; s.wage = staffWageFor(s); s.joined = G.date; if (typeof TQ !== 'undefined') TQ.date = null; STAFF_BEST.date = null; s.until = G.season + 1; addTx(G.clubId, 'płace', -s.wage, `Podpisanie umowy: ${s.name}`); toast(`${s.name} dołącza do sztabu.`, 'good'); changed(); };
ACT.fire = id => { const s = G.staff[id]; if (typeof TQ !== 'undefined') TQ.date = null; STAFF_BEST.date = null; addTx(G.clubId, 'płace', -s.wage * 3, `Odprawa: ${s.name}`); s.clubId = null; toast(`${s.name} odchodzi ze sztabu.`); changed(); };

// ---------- Szkółka ----------
PAGES.szkolka = parts => {
  const sub = parts[0] || '';
  const kids = Object.values(G.academy).filter(k => k.clubId === G.clubId);
  const c = myClub();
  const T = tabs('szkolka', [['', 'Adepci'], ['przeglad', 'Przegląd szkółki']], sub);
  if (sub === 'przeglad') {
    const coach = clubStaff(G.clubId).filter(s => s.role === 'youth');
    return { title: 'Szkółka żużlowa', tabs: T, body: `<div class="grid g2"><div class="panel"><h3>Szkółka</h3><div class="kv"><div>Poziom obiektów</div><div>${c.facilities.academy} / 5</div><div>Budżet roczny</div><div>${fmtMoney(c.academyBudget)}</div><div>Adeptów</div><div>${kids.length}${typeof academyLoad === 'function' ? (L => ` · miejsca u trenerów: ok. ${L.cap}${L.kids > L.cap ? ' <span class="neg">(przepełnienie – słabszy trening)</span>' : ''}<br><span class="small muted">budżet pokrywa ${fmtMoney(L.budget, true)} z ok. ${fmtMoney(L.need, true)} kosztów szkolenia${L.need > L.budget ? ' – za mało' : ''}</span>`)(academyLoad(G.clubId)) : ''}</div><div>Trener szkółki</div><div>${coach.map(s => `${esc(s.name)} (praca z młodzieżą ${s.attrs.youth})`).join(', ') || '<span class="neg">brak</span>'}</div></div>
      <label class="fld" style="margin-top:14px">Budżet szkółki: <b id="abv">${fmtMoney(c.academyBudget)}</b><input type="range" min="50000" max="2000000" step="50000" value="${c.academyBudget}" oninput="$('#abv').textContent=fmtMoney(+this.value)" onchange="myClub().academyBudget=+this.value;changed()"></label>
      ${typeof academyLoad === 'function' ? `<p class="small muted">Pojemność zależy od trenerów szkółki (przeciętny prowadzi 6–7 adeptów, bardzo dobry ok. 12; kolejny trener – kilka miejsc więcej) i od budżetu. Nowe dzieci przychodzą same przez cały sezon, najwięcej wiosną.</p>
      <p><button class="btn" ${myClub().openDay === G.season ? 'disabled' : ''} onclick="ACT.arm(this, 'openDay')">Dzień otwarty szkółki (${fmtMoney(OPEN_DAY_COST, true)}) – więcej chętnych 8–13 lat</button></p>` : ''}
      ${(t => t.length ? `<h3 style="margin-top:14px">Treningi próbne</h3>${t.map(k => `<div class="row small"><a href="#/adept/${k.id}">${esc(k.name)}</a> <span class="muted">(${ageAt(k.born, G.date)} lat)</span> ${k.trial.report ? `<b class="${k.trial.report.ok ? 'pos' : 'neg'}">${k.trial.report.ok ? 'rokujący' : 'nierokujący'}</b> <button class="btn sm primary" onclick="ACT.trialKeep('${k.id}')">Zostaw</button> <button class="btn sm" onclick="ACT.trialRelease('${k.id}')">Podziękuj</button>` : `<span class="muted">raport do ${fmtDateShort(k.trial.until)}</span>`}</div>`).join('')}` : '')(kids.filter(k => k.trial))}
      <p><button class="btn" onclick="ACT.arm(this, 'upgrade', 'academy')" ${c.facilities.academy >= 5 ? 'disabled' : ''}>Rozbuduj obiekty szkółki (${fmtMoney(COSTS.academy(c.facilities.academy), true)})</button></p></div>
      <div class="panel"><h3>Ścieżka szkolenia</h3><table class="t"><thead><tr><th>Klasa</th><th>Uprawnienia</th><th class="num">Adepci</th></tr></thead><tbody>${ACADEMY_CATS.map(k => `<tr><td>${k.name}</td><td class="small">${esc(k.lic)}</td><td class="num">${kids.filter(x => x.cat === k.id).length}</td></tr>`).join('')}</tbody></table>
      <p class="small muted">Adept klasy 500R (licencja 250 cm³/500R) trenuje na motocyklu 500 cm³ i po ukończeniu 15 lat może przystąpić do egzaminu na licencję Ż. Po zdaniu dołącza do pierwszej drużyny jako junior – do 16. urodzin startuje tylko w zawodach U-21, w lidze od 16. urodzin.</p></div></div>` };
  }
  UI.kidCtx = { ids: ACADEMY_CATS.flatMap(cat => kids.filter(k => k.cat === cat.id).sort(by(k => k.ca, -1)).map(k => k.id)), label: `Szkółka – ${c.short}` };
  return { title: 'Szkółka żużlowa', sub: `${kids.length} adeptów w ${ACADEMY_CATS.length} klasach pojemności`, tabs: T,
    body: ACADEMY_CATS.map(cat => { const list = kids.filter(k => k.cat === cat.id).sort(by(k => k.ca, -1));
      return `<div class="group-title"><span class="cc">${cat.cc}</span>${cat.name} <span class="n">${list.length} · ${esc(cat.lic)}</span></div><div class="cards">${list.map(k => `<div class="card" style="--c1:${c.colors[0]};--c2:${c.colors[1]}" onclick="go('#/adept/${k.id}')"><div class="ph">${avatar(k, c)}<div class="tag"><span class="pill jun">${cat.cc}</span>${k.trial ? ' <span class="pill u24">próba</span>' : ''}</div></div>
        <div class="body"><div class="nm">${esc(k.name)}</div><div class="meta">${flagCode(k.country)}<span><b>${ageAt(k.born, G.date)}</b> lat</span></div><div class="born">ur. ${fmtDateShort(k.born)}</div>
        <div class="foot"><span title="Obecne umiejętności">${caStars(k)}</span><span title="Potencjał">${paStars(k)}</span></div></div></div>`).join('') || '<div class="empty">Brak adeptów w tej klasie</div>'}</div>`; }).join('') + miniLoanedHtml(c) };
};
// Miniżużlowcy wypożyczeni ze szkółek niezależnych do naszej drużyny (sezon)
function miniLoanedHtml(c) {
  const list = Object.values(G.academy).filter(k => k.miniLoan && k.miniLoan.clubId === c.id && k.miniLoan.season === G.season);
  if (!list.length) return '';
  return `<div class="group-title"><span class="cc">wyp.</span>Wypożyczeni do drużyny miniżużla <span class="n">${list.length} · sezon ${G.season}</span></div><div class="cards">${list.map(k => `<div class="card" style="--c1:${c.colors[0]};--c2:${c.colors[1]}" onclick="go('#/adept/${k.id}')"><div class="ph">${avatar(k, c)}<div class="tag"><span class="pill">${esc((G.miniSchools[k.miniLoan.schoolId] || {}).short || '')}</span></div></div>
    <div class="body"><div class="nm">${esc(k.name)}</div><div class="meta">${flagCode(k.country)}<span><b>${ageAt(k.born, G.date)}</b> lat</span></div><div class="born">wypożyczony ze szkółki</div>
    <div class="foot"><span>${caStars(k)}</span><span>${paStars(k)}</span></div></div></div>`).join('')}</div>`;
}
// Profil adepta – ten sam układ co profil zawodnika: zdjęcie, fakty, klub/szkółka, ocena trenera, zakładki, nawigacja ‹ ›
const ADEPT_TABS = [['', 'Przegląd'], ['starty', 'Starty i sukcesy'], ['rozwoj', 'Rozwój'], ['szkolka', 'Szkółka i źródła']];
// Sezony, w których adept startował w zawodach (miniżużel, 250, 500R)
const kidSeasons = k => [...new Set([G.season, ...Object.values(G.matches).filter(m => m.done && m.riders && m.riders[k.id] && m.riders[k.id].heats).map(m => Number(m.date.slice(0, 4)))])].sort((a, b) => b - a);
function adeptStarts(k) {
  const season = Number(location.hash.slice(2).split('/')[3]) || G.season, seasons = kidSeasons(k);
  return `<div class="stack">${seasons.length > 1 ? `<label class="fld" style="flex-direction:row;align-items:center;gap:8px">Sezon<select onchange="go('#/adept/${k.id}/starty/'+this.value)">${seasons.map(y => `<option ${y === season ? 'selected' : ''}>${y}</option>`).join('')}</select></label>` : ''}
    ${startsTable(k, riderStarts(k, season))}
    <h2 style="margin-top:8px">Sukcesy</h2>${honoursFull(k).replace('Zawodnik nie ma jeszcze medali', 'Adept nie ma jeszcze medali')}</div>`;
}
const kidCtxIds = () => UI.kidCtx ? UI.kidCtx.ids.filter(id => G.academy[id]) : [];
ACT.adeptStep = d => {
  const parts = location.hash.slice(2).split('/'), ids = kidCtxIds(), next = ids[ids.indexOf(parts[1]) + d];
  if (next != null) go(`#/adept/${next}${parts[2] ? '/' + parts[2] : ''}`);
};
const kidSchool = k => k.schoolId && G.miniSchools && G.miniSchools[k.schoolId];
const kidMini = k => Object.values(G.miniPeople || {}).find(p => p.kidId === k.id || (k.academyCatalogId && p.id === k.academyCatalogId)) || null;
const kidBorn = k => String(k.born || '').length === 10 ? fmtDate(k.born) : k.born ? `rocznik ${String(k.born).slice(0, 4)}` : 'brak daty';
const schoolHref = s => `<a href="#/minizuzel/szkolki/${encodeURIComponent(s.id)}">${esc(s.name)}</a>`;
PAGES.adept = parts => {
  const k = G.academy[parts[0]];
  if (!k) return { title: 'Nie znaleziono adepta', body: '<div class="panel empty">Adept nie jest już w szkółce (zdał egzamin albo został skreślony).</div>' };
  const sub = parts[1] || '', c = G.clubs[k.clubId], sch = kidSchool(k);
  if (!UI.kidCtx || !UI.kidCtx.ids.includes(k.id)) {
    const mates = Object.values(G.academy).filter(x => c ? x.clubId === k.clubId : x.schoolId && x.schoolId === k.schoolId).sort(by(x => x.ca, -1));
    UI.kidCtx = { ids: (mates.length ? mates : [k]).map(x => x.id), label: c ? `Szkółka – ${c.short}` : sch ? sch.short : 'Adept' };
  }
  const ids = kidCtxIds(), i = ids.indexOf(k.id);
  if (c) document.documentElement.style.setProperty('--club', c.colors[0]);
  const age = ageAt(k.born, G.date), cat = ACADEMY_CATS.find(x => x.id === k.cat);
  const schTxt = sch ? `${sch.trainsFor ? 'szkolenie w' : 'szkółka'}: <a href="#/minizuzel/szkolki/${encodeURIComponent(sch.id)}">${esc(sch.short)}</a><br>` : '';
  const head = `<div class="page-head"><div class="profile-head"><div class="avatar-wrap">${avatar(k, c)}${cat ? `<span class="pill jun avatar-tag">${esc(cat.cc)}</span>` : ''}</div>
    <div class="who"><h1>${esc(k.name)}</h1>
      <div class="facts"><span class="pill jun">${cat ? esc(cat.name) : 'Adept'}</span><span class="fc">${countryLink(k.country || 'POL')}</span>
        <span><b>${age} lat</b> · ur. ${kidBorn(k)}${k.birthPlace ? `, ${esc(k.birthPlace)}` : ''}</span></div></div>
    <div class="contract-box">${c ? `<div class="clubname">${crest(c, 'lg')}<div><a href="${clubHref(c.id)}"><b>${esc(c.name)}</b></a><div class="small muted">${schTxt}w szkółce od ${fmtDate(k.joined)}</div></div></div>`
      : `<div><b>${sch ? esc(sch.name) : 'bez klubu'}</b><div class="small muted">${k.miniLoan && k.miniLoan.season === G.season && G.clubs[k.miniLoan.clubId] ? `szkółka niezależna · w sezonie ${G.season} jeździ w drużynie ${esc(G.clubs[k.miniLoan.clubId].short)}` : sch ? 'szkółka niezależna' : 'adept bez przypisanej szkółki'}</div></div>`}</div>
    <div class="coach-box"><div class="small muted">Ocena trenera</div>
      <div class="row" style="gap:18px"><div><div class="small muted">Obecnie</div>${caStars(k)}</div><div><div class="small muted">Potencjał</div>${paStars(k)}</div></div>
      <div class="small" style="margin-top:4px">${esc(coachSummary(k))}</div></div></div>
    <div class="tabs-row">${tabs(`adept/${k.id}`, ADEPT_TABS, sub)}
      <div class="profile-nav"><button class="arrow" ${i > 0 ? '' : 'disabled'} onclick="ACT.adeptStep(-1)" title="Poprzedni (←)">‹</button><div class="pos">${i + 1} / ${ids.length}<br><span class="small">${esc(UI.kidCtx.label)}</span></div><button class="arrow" ${i < ids.length - 1 ? '' : 'disabled'} onclick="ACT.adeptStep(1)" title="Następny (→)">›</button></div></div></div>`;
  const body = { '': adeptOverview, starty: adeptStarts, rozwoj: adeptDev, szkolka: adeptSchool }[sub] || adeptOverview;
  return { head, body: body(k) };
};
function adeptActions(k) {
  if (k.free && !k.retired) return `<div class="panel"><h3>Działania</h3><p class="small muted">Adept bez szkółki – chce dalej się ścigać.${isForeignKid(k) ? ` Licencję zdobędzie w swoim kraju (${esc(COUNTRY[k.country] || k.country)}).` : ''}</p><button class="btn primary" onclick="ACT.signKid('${k.id}')">Przyjmij do naszej szkółki</button></div>`;
  if (k.retired) return `<div class="panel"><h3>Koniec kariery</h3><p class="small muted">${esc(k.name)} zakończył karierę${k.retiredOn ? ` (${fmtDate(k.retiredOn)})` : ''} – nie wróci do ścigania.</p></div>`;
  if (k.clubId !== G.clubId) return '';
  if (k.trial) return `<div class="panel"><h3>Trening próbny (pit bike)</h3>${k.trial.report ? `<p><b class="${k.trial.report.ok ? 'pos' : 'neg'}">${k.trial.report.ok ? 'Rokujący' : 'Nierokujący'}</b> – ${esc(k.trial.report.text)}</p><div class="row wrap"><button class="btn primary" onclick="ACT.trialKeep('${k.id}')">Zostaw w szkółce</button><button class="btn" onclick="ACT.trialRelease('${k.id}')">Podziękuj</button></div>` : `<p class="small muted">Od ${fmtDate(k.trial.from)} na treningach próbnych. Trener oceni, czy rokuje – raport do ${fmtDate(k.trial.until)}.</p>`}</div>`;
  const age = ageAt(k.born, G.date), reg = examRegistered(k);
  const nextExam = Object.values(G.events).filter(e => e.comp === 'EXAM' && !e.played && e.date >= G.date).sort(by(e => e.date))[0];
  const lk = typeof lowerExamKind === 'function' ? lowerExamKind(k) : null, lreg = lk && lowerExamRegistered(k, lk);
  const lowerInfo = lk ? `<p class="small muted">Egzamin: ${esc(KID_LIC[lk].name)}. ${nextExam ? `Najbliższa sesja: ${fmtDate(nextExam.date)}${nextExam.venue ? ` (${esc(nextExam.venue)})` : ''}. Szansa zdania (ocena sztabu): ${lowerExamChance(k, lk) >= 0.85 ? 'wysoka' : lowerExamChance(k, lk) >= 0.7 ? 'dobra' : lowerExamChance(k, lk) >= 0.5 ? 'średnia' : 'niska'}.` : 'Brak terminu sesji w kalendarzu.'}</p>` : '';
  return `<div class="panel"><h3>Działania</h3>${lowerInfo}${k.cat === 'c500' && !lk ? `<p class="small muted">${age < 15 ? 'Egzamin na licencję Ż po ukończeniu 15 lat.' : !examCandidate(k) ? 'Niedawno podchodził do egzaminu – kolejne podejście na późniejszej sesji.' : nextExam ? `Najbliższy egzamin: ${fmtDate(nextExam.date)}${nextExam.venue ? ` (${esc(nextExam.venue)})` : ''}. Szansa zdania (ocena sztabu): ${examChance(k) >= 0.85 ? 'wysoka' : examChance(k) >= 0.7 ? 'dobra' : examChance(k) >= 0.5 ? 'średnia' : 'niska'}.` : 'Brak terminu egzaminu w kalendarzu.'}</p>` : ''}
    <div class="row wrap">${lk ? `<button class="btn ${lreg ? '' : 'primary'}" onclick="ACT.examReg('${k.id}')">${lreg ? 'Wycofaj z egzaminu' : `Zgłoś na egzamin (${esc(KID_LIC[lk].short)})`}</button>` : k.cat === 'c500' && age >= 15 ? `<button class="btn ${reg ? '' : 'primary'}" onclick="ACT.examReg('${k.id}')">${reg ? 'Wycofaj z egzaminu' : 'Zgłoś na egzamin Ż'}</button>` : ''}${(m => m ? `<button class="btn" ${m.ok ? '' : 'disabled'} title="${esc(m.ok ? 'Trening w wyższej klasie – starty po certyfikacie / licencji tej klasy' : m.text)}" onclick="ACT.kidCat('${k.id}', 1)">Przenieś do: ${esc(m.cat.name)}</button>` : '')(typeof kidMoveOk === 'function' ? kidMoveOk(k, 1) : null)}${(m => m && m.ok ? `<button class="btn ghost" onclick="ACT.kidCat('${k.id}', -1)">Cofnij do: ${esc(m.cat.name)}</button>` : '')(typeof kidMoveOk === 'function' ? kidMoveOk(k, -1) : null)}<button class="btn danger" onclick="ACT.arm(this, 'dropKid', '${k.id}')">Skreśl ze szkółki</button><a class="btn" href="#/szkolka">‹ Szkółka</a></div>${typeof kidCanRace === 'function' && !kidCanRace(k) && k.cat !== 'c50' ? '<p class="small muted" style="margin-top:8px">Trenuje w tej klasie przed egzaminem – w zawodach wystartuje po uzyskaniu certyfikatu / licencji.</p>' : ''}</div>`;
}
function adeptOverview(k) {
  const cat = ACADEMY_CATS.find(x => x.id === k.cat), sch = kidSchool(k), ps = k.parentsSupport || 0;
  return `<div class="grid ov-top">
    <div class="panel"><h3>Informacje</h3><div class="kv"><div>Klub</div><div>${G.clubs[k.clubId] ? clubLink(k.clubId) : '—'}</div><div>Szkółka</div><div>${sch ? schoolHref(sch) : '—'}</div>
      <div>Klasa</div><div>${cat ? esc(cat.name) : 'niepotwierdzona'}</div><div>Poziom (ocena sztabu)</div><div>${scKnown(k) ? esc(caClass(perceive(k).caMid)) : '<span class="muted">nieznany</span>'}</div><div>Charakter</div><div>${charLabel(k)}</div>${familyRow(k.name)}
      <div>W szkółce od</div><div>${fmtDate(k.joined)}</div><div>Wsparcie rodziców</div><div>${'●'.repeat(ps)}${'○'.repeat(5 - ps)}</div><div>Licencja</div><div>${typeof kidLicText === 'function' ? esc(kidLicText(k)) : cat ? esc(cat.lic) : '—'}</div></div></div>
    <div class="panel"><h3>Atrybuty</h3>${attrPanel(k)}</div>
  </div>
  <div class="grid g2" style="margin-top:16px"><div class="panel"><h3>Raport trenera</h3>${scoutReport(k)}</div>${adeptActions(k) || adeptMiniLoanPanel(k)}</div>
  <div class="grid g2" style="margin-top:16px">${startsTable(k, riderStarts(k), 5, `#/adept/${k.id}/starty`)}<div class="panel"><h3>Największe sukcesy</h3>${honoursTop(k).replace(`#/zawodnik/${k.id}/historia/sukcesy`, `#/adept/${k.id}/starty`)}</div></div>`;
}
function adeptMiniLoanPanel(k) {
  const st = typeof miniLoanStatus === 'function' ? miniLoanStatus(k, G.clubId) : { ok: false };
  const loan = k.miniLoan && k.miniLoan.season === G.season && G.clubs[k.miniLoan.clubId];
  return `<div class="panel"><h3>Szkolenie</h3><p class="muted">Adept spoza naszej szkółki – szczegóły szkolenia zna tylko jego szkółka.</p>${loan ? `<p>W sezonie ${G.season} jeździ w drużynie miniżużlowej: ${clubLink(k.miniLoan.clubId)}.</p>` : ''}
    ${st.ok ? `<p class="small muted">Szkółka niezależna wypożycza miniżużlowców klubom do rozgrywek drużynowych na sezon (${fmtMoney(st.fee)}).</p><button class="btn primary" onclick="ACT.arm(this, 'miniLoan', '${k.id}')">Wypożycz do drużyny miniżużla</button>` : ''}</div>`;
}
function adeptDev(k) {
  const own = k.clubId === G.clubId, p = perceive(k);
  return `<div class="grid g-side"><div class="stack"><div class="panel"><h3>Postępy</h3>${own && typeof attrChart === 'function' ? attrChart(k) : sparkline((k.progress || []).map(x => ({ v: x.a, l: fmtDateShort(x.d) })), { w: 520, h: 140 })}</div>
      ${own && typeof trainingPanel === 'function' ? `<div class="panel"><h3>Trening</h3>${trainingPanel(k)}</div>` : ''}</div>
    <div class="panel"><h3>Perspektywy</h3><div class="kv"><div>Obecnie</div><div>${caStars(k)}${scKnown(k) ? `<div class="small muted">${esc(caClass(p.caMid))}</div>` : ''}</div><div>Potencjał</div><div>${paStars(k)}${scKnown(k) ? `<div class="small muted">w szczycie: ${esc(caClass(p.paMid).toLowerCase())}</div>` : ''}</div>
      <div>Wiek</div><div>${ageAt(k.born, G.date)}</div><div>Faza kariery</div><div>adept – nauka jazdy</div><div>Charakter</div><div>${charLabel(k, p.K)}</div></div>
      <p class="small muted">Żółte gwiazdki – to, co sztab wie na pewno; białe – możliwy zakres. Lepszy skaut (ocena talentu) i obserwacja zawężają ocenę, a słaby skaut może przeszacować młodych.</p></div></div>`;
}
function adeptSchool(k) {
  const m = kidMini(k), sch = kidSchool(k), ev = (m && m.licenseEvents) || k.licenseEvents || [];
  return `<div class="grid g2"><div class="panel"><h3>Szkółka</h3><div class="kv"><div>Szkółka</div><div>${sch ? schoolHref(sch) : '—'}</div>
      <div>Klub</div><div>${sch && sch.clubId ? `${sch.trainsFor ? 'realizuje szkolenie dla: ' : ''}${clubLink(sch.clubId)}` : G.clubs[k.clubId] ? clubLink(k.clubId) : 'poza klubem ligowym'}</div>
      <div>Klasy PZM</div><div>${esc((m && m.registryClasses || []).join(', ') || 'brak wpisu')}</div><div>Podstawa przypisania</div><div>${m && m.schoolAssignment ? `<a href="${esc(m.schoolAssignment.sourceUrl)}" target="_blank" rel="noopener">${esc(m.schoolAssignment.sourceId)}</a>${m.schoolAssignment.date ? ' · ' + fmtDateShort(m.schoolAssignment.date) : ''}` : k.calibOnly ? 'protokoły zawodów' : '—'}</div></div>
</div>
    <div class="stack"><div class="panel"><h3>Egzaminy</h3>${ev.map(e => `<p>${esc(e.date)} · ${esc(e.class)}${e.sourceUrl ? ` · <a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">źródło</a>` : ''}</p>`).join('') || '<p class="muted">Brak potwierdzonych egzaminów w zebranych źródłach.</p>'}</div>
      ${m ? `<div class="panel"><h3>Daty urodzenia – źródła</h3>${(m.birthDateEvidence || []).map(e => `<p>${fmtDateShort(e.date)} · <a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">${esc(e.sourceId)}</a></p>`).join('') || '<p class="muted">Pełna data nie została opublikowana w zebranych źródłach.</p>'}</div>` : ''}</div></div>
    ${m ? `<div class="panel" style="margin-top:16px"><h3>Historia przynależności i źródła</h3>${(m.observations || []).map(o => `<p>${esc(o.date || 'bez daty')} · ${esc(o.club || o.eventClub || (G.miniSchools[o.clubCode] || {}).short || '')} · ${esc(o.class || '')} <a href="${esc(o.sourceUrl)}" target="_blank" rel="noopener">${esc(o.sourceId)}</a></p>`).join('')}${(m.warnings || []).map(w => `<p class="warn">${esc(w)}</p>`).join('')}${m.historicalOnly ? '<p class="warn">Przynależność pochodzi z historycznej listy szkółki; aktualny skład niepotwierdzony.</p>' : ''}</div>` : ''}`;
}
ACT.kidModal = id => go(`#/adept/${id}`);
ACT.kidCat = (id, dir) => { const k = G.academy[id], m = k && kidMoveOk(k, dir); if (!m || !m.ok) return toast(m ? m.text : 'Brak klasy.', 'bad'); k.cat = m.cat.id; k.catManual = true; toast(`${k.name} trenuje teraz w klasie: ${m.cat.name}.`, 'good'); changed(); };
ACT.examReg = id => { const k = G.academy[id]; const lk = typeof lowerExamKind === 'function' ? lowerExamKind(k) : null; const on = !(lk ? lowerExamRegistered(k, lk) : examRegistered(k)); k.examRegistered = on; k.examWithdrawn = !on; toast(k.examRegistered ? `${k.name} zgłoszony na najbliższy egzamin.` : `${k.name} wycofany z egzaminu.`); changed(); };
ACT.exam = id => { const r = licenceExam(id); toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) { dbQueueSave(); go(`#/zawodnik/${r.riderId}`); } else changed(); };
ACT.dropKid = id => { const k = G.academy[id]; const keep = typeof leaveAcademy === 'function' ? leaveAcademy(k, 'skreślony') : (delete G.academy[id], false); toast(keep ? `${k.name} skreślony – dalej chce się ścigać, jest wolnym adeptem.` : `${k.name} skreślony ze szkółki – kończy karierę.`); go('#/szkolka'); changed(); };

// ---------- Centrum medyczne ----------
PAGES.medyczne = parts => {
  const sub = parts[0] || '';
  const rs = clubRiders(G.clubId);
  const T = tabs('medyczne', [['', 'Kontuzje'], ['ryzyko', 'Kondycja i ryzyko'], ['historia', 'Historia urazów']], sub);
  const staff = clubStaff(G.clubId).filter(s => s.role === 'doctor' || s.role === 'physio');
  const head = { title: 'Centrum medyczne', sub: `Personel: ${staff.map(s => `${esc(s.name)} (${STAFF_ROLES[s.role].name.toLowerCase()})`).join(', ') || 'brak'}`, tabs: T };
  if (sub === 'ryzyko') {
    return { ...head, body: `<div class="panel flush"><table class="t"><thead><tr><th>Zawodnik</th><th>Kondycja</th><th class="num">Biegi w sezonie</th><th class="num">Upadki</th><th>Ryzyko urazu</th><th>Status</th></tr></thead><tbody>
      ${rs.sort(by(riskValue, -1)).map(r => `<tr class="click" onclick="go('#/zawodnik/${r.id}/medyczne')"><td><b>${esc(r.name)}</b></td><td style="width:160px">${bar(r.cond)} <span class="small muted">${Math.round(r.cond)}%</span></td><td class="num">${(r.stats[G.season] || {}).heats || 0}</td><td class="num">${(r.stats[G.season] || {}).falls || 0}</td><td>${riskLabel(r)}</td><td>${r.injury ? '<span class="pill inj">kontuzja</span>' : '<span class="pill ok">zdolny</span>'}</td></tr>`).join('')}</tbody></table></div>` };
  }
  if (sub === 'historia') {
    const inj = Object.values(G.injuries).filter(i => i.clubId === G.clubId).sort(by(i => i.start, -1));
    return { ...head, body: `<div class="panel flush"><table class="t"><thead><tr><th>Zawodnik</th><th>Uraz</th><th>Od</th><th>Do</th><th class="num">Dni</th><th>Okoliczności</th></tr></thead><tbody>${inj.map(i => `<tr><td>${riderLink(i.riderId)}</td><td>${esc(i.kind)}</td><td>${fmtDateShort(i.start)}</td><td>${fmtDateShort(i.until)}</td><td class="num">${i.days}</td><td class="small">${esc(i.where)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Brak urazów</td></tr>'}</tbody></table></div>` };
  }
  const inj = rs.filter(r => r.injury).map(r => ({ r, i: G.injuries[r.injury] }));
  return { ...head, body: `<div class="stat-tiles" style="margin-bottom:16px"><div class="tile"><div class="k">Kontuzjowani</div><div class="v ${inj.length ? 'neg' : 'pos'}">${inj.length}</div></div><div class="tile"><div class="k">Średnia kondycja</div><div class="v">${Math.round(sum(rs.map(r => r.cond)) / (rs.length || 1))}%</div></div><div class="tile"><div class="k">Wysokie ryzyko</div><div class="v warn">${rs.filter(r => riskValue(r) > 45).length}</div></div></div>
    ${inj.length ? `<div class="cards">${inj.map(({ r, i }) => riderCard(r, `<div class="foot"><span class="neg">${esc(i.kind)}</span><span class="muted">${dayDiff(G.date, i.until)} dni</span></div>`)).join('')}</div>` : '<div class="panel empty">Wszyscy zawodnicy są zdrowi.</div>'}` };
};
// Zgłoszenie zawodnika z wygasłą licencją na egzamin „Ż” (js/rider-licence.js)
ACT.licExamReg = id => {
  const r = G.riders[id];
  if (!r || r.clubId !== G.clubId || licState(r) !== 'expired') return;
  r.examRegistered = !r.examRegistered;
  const ev = nextExamEvent();
  toast(r.examRegistered ? `${r.name} zgłoszony na egzamin${ev ? ` (${fmtDateShort(ev.date)})` : ''}.` : 'Zgłoszenie wycofane.', 'good');
  changed();
};
// Licencja wygasła: zgłoszenie na egzamin „Ż” (zawodnik naszego klubu) albo informacja o warunkach powrotu
function licExamBox(r) {
  if (typeof licState !== 'function') return '';
  const st = licState(r);
  if (st === 'ok') return hasNat(r, 'POL') && G.date >= `${G.season}-08-01` ? (n => n < LIC_MIN_HEATS ? `<div class="small warn">w ${G.date.slice(0, 4)}: ${n} ${plural(n, 'bieg', 'biegi', 'biegów')} – licencja przedłuży się po ${LIC_MIN_HEATS}</div>` : '')(licHeats(r, Number(G.date.slice(0, 4)))) : '';
  if (st === 'retired') return '';
  const ev = nextExamEvent();
  if (r.clubId !== G.clubId) return `<div class="small muted">po podpisaniu kontraktu – egzamin na licencję „Ż”${ev ? ` (najbliższy ${fmtDateShort(ev.date)})` : ''}</div>`;
  return `<div class="small">${r.examRegistered ? `zgłoszony na egzamin${ev ? ` ${fmtDateShort(ev.date)}` : ''}` : 'niezgłoszony na egzamin'} · szansa ok. ${Math.round(licExamChance(r) * 100)}%</div>
    <button class="btn sm" style="margin-top:4px" onclick="ACT.licExamReg(${r.id})">${r.examRegistered ? 'Wycofaj zgłoszenie' : 'Zgłoś na egzamin „Ż”'}</button>`;
}
// Rola w drużynie (obietnica startów w kontrakcie) i morale; zawodnik naszego klubu – zmiana roli (jednostronna)
function teamRoleRow(r) {
  if (typeof roleOf !== 'function' || !r.clubId) return '';
  if (r.contract && r.contract.rolePending && r.contract.clubId === G.clubId) return `<div>Rola w drużynie</div><div><b class="warn">do wybrania</b> – panel powyżej</div>`;
  const role = roleOf(r), mine = r.contract && r.contract.clubId === G.clubId && r.clubId === G.clubId;
  const p = mine ? promiseCheck(r) : null;
  const sel = mine && r.contract.kind === 'warszawski' ? `<b>${roleName('awaryjny')}</b> <span class="small muted">(kontrakt warszawski)</span>` : mine ? `<select onchange="ACT.setRole(${r.id}, this.value)">${Object.entries(TEAM_ROLES).map(([k, x]) => `<option value="${k}" ${role === k ? 'selected' : ''}>${x.name}</option>`).join('')}</select>` : `<b>${roleName(role)}</b>${r.loanAsk ? ` · do wypożyczenia za ${fmtMoney(r.loanAsk, true)}` : ''}`;
  return `<div>Rola w drużynie</div><div>${sel}${p && (p.n || p.missed) ? `<div class="small muted">starty: ${Math.round(p.rode)}/${p.n} meczów, w których był dostępny (obietnica ok. ${Math.round(p.want * 100)}%)${p.missed ? ` · niedostępny w ${p.missed} (${esc(excusedText(p))})` : ''}</div>` : ''}</div>
    ${mine ? `<div>Morale</div><div class="${(r.morale ?? 70) < 45 ? 'neg' : (r.morale ?? 70) >= 65 ? 'pos' : ''}">${moraleLabel(r.morale ?? 70)}${r.wantsOut ? ' · <b class="neg">prosi o transfer</b>' : ''}</div>` : ''}`;
}
// Panel wyboru roli po zdaniu licencji (kontrakt amatorski w klubie gracza) – gra czeka na decyzję
function firstRolePanel(r) {
  const k = r.contract;
  if (!k || !k.rolePending || k.clubId !== G.clubId || typeof expectedRole !== 'function') return '';
  const exp = expectedRole(r, G.clubId);
  const opts = Object.entries(TEAM_ROLES).filter(([key]) => key !== 'zbedny').map(([key, x]) => `<button class="btn sm${key === exp ? ' primary' : ''}" style="display:block;width:100%;text-align:left;margin:3px 0" onclick="ACT.chooseFirstRole(${r.id}, '${key}')">
    <b>${x.name}</b>${key === exp ? ' <span class="small">(oczekiwana)</span>' : ''}<div class="small muted">${esc(x.desc)} · obietnica ok. ${Math.round(x.share * 100)}% meczów</div></button>`).join('');
  return `<div class="panel" style="margin-bottom:10px"><h3>Nowa licencja – przypisz rolę</h3>
    <p class="small">${esc(r.name)} zdał egzamin i podpisał kontrakt amatorski (stypendium ${fmtMoney(k.stipend || 0)}/mies. do końca ${k.until}). Wybierz rolę, którą klub mu obiecuje – od niej zależy, ile startów będzie oczekiwał. Rola niższa od oczekiwanej lekko obniży morale.</p>${opts}</div>`;
}
ACT.chooseFirstRole = (id, role) => { const res = chooseFirstRole(id, role); toast(res.text, res.ok ? 'good' : 'bad'); changed(); };
ACT.setRole = (id, role) => { const res = setRole(id, role); toast(res.text, res.ok ? 'good' : 'bad'); changed(); };
// akcje modułu adeptów i końca kariery (js/adepts.js ładuje się przed ui-core.js, gdzie powstaje ACT)
ACT.signKid = signFreeKid;
ACT.persuadeStay = persuadeStay;
ACT.openDay = openDayAction; // nabór i treningi próbne (js/intake.js)
ACT.trialKeep = trialKeepAction;
ACT.trialRelease = trialReleaseAction;
ACT.soundOut = id => { const r = soundOut(id); toast(r.text, r.ok ? (r.stance === 'no' ? 'bad' : 'good') : 'bad'); changed(); };
// Wypożyczony do nas zawodnik: kolejne wypożyczenie na następny sezon (od 15 czerwca) albo inne opcje
function loanExtPanel(r) {
  const l = r.loan, st = loanExtStatus(r), h = G.clubs[l.parentId];
  const x = Object.values(G.loanExt || {}).filter(q => q.riderId === r.id).sort(by(q => q.made, -1))[0];
  const d = UI.lx && UI.lx.id === r.id ? UI.lx : (UI.lx = { id: r.id, fee: 0, signing: l.signing || 0, perPoint: l.perPoint || 0 });
  const form = st.ok ? `<div class="kv" style="margin-top:8px"><div>Opłata dla ${esc(h.short)}</div><div><input type="number" step="5000" min="0" value="${d.fee}" style="width:110px" onchange="UI.lx.fee=+this.value"></div>
      <div>Za podpis (sezon ${st.season})</div><div><input type="number" step="5000" min="0" value="${d.signing}" style="width:110px" onchange="UI.lx.signing=+this.value"></div>
      <div>Za punkt</div><div><input type="number" step="100" min="0" value="${d.perPoint}" style="width:110px" onchange="UI.lx.perPoint=+this.value"></div></div>
      <button class="btn primary" style="margin-top:8px" onclick="ACT.loanExt(${r.id})">Zaproponuj wypożyczenie na sezon ${st.season}</button>` : `<p class="small ${st.alt ? '' : 'muted'}">${esc(st.text)}</p>${st.alt === 'precontract' ? `<a class="btn" href="#/oferta/${r.id}">Prekontrakt</a>` : ''}`;
  return `<div class="panel"><h3>Wypożyczenie</h3><p>Wypożyczony z <b>${clubLink(h.id)}</b> do 31.10.${l.season}. Kontrakt z klubem macierzystym do ${r.contract ? r.contract.until : '—'}.</p>
    <p class="small muted">Wypożyczenia nie można przedłużyć poza 31 października, ale od 15 czerwca można uzgodnić z klubem i zawodnikiem kolejne wypożyczenie na następny sezon. Inne opcje: wykup zawodnika (odstępne) albo – gdy kontrakt wygasa – prekontrakt.</p>
    ${x ? `<p class="small">Ostatnia propozycja (${fmtDateShort(x.made)}): <b>${{ pending: `odpowiedź do ${fmtDateShort(x.due)}`, ok: 'zgoda', rejected: 'odmowa', expired: 'wygasła', counter: `klub chce ${fmtMoney(x.terms.fee, true)}` }[x.status]}</b>${x.result ? ` – ${esc(x.result)}` : ''}${x.status === 'counter' ? ` <button class="btn sm" onclick="ACT.loanExtAccept('${x.id}')">Przyjmij</button>` : ''}</p>` : ''}
    ${r.nextLoan ? `<p class="pos">Uzgodnione wypożyczenie na sezon ${r.nextLoan.season}.</p>` : form}
    ${r.contract && r.contract.until > l.season ? `<a class="btn ghost" style="margin-top:8px" href="#/oferta/${r.id}">Wykup zawodnika</a>` : ''}</div>`;
}
ACT.loanExt = id => { const res = loanExtOffer(id, UI.lx || {}); toast(res.text, res.ok ? 'good' : 'bad'); changed(); };
ACT.loanExtAccept = id => { const res = loanExtAccept(id); toast(res.text, res.ok ? 'good' : 'bad'); changed(); };
