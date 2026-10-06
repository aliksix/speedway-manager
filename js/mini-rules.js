'use strict';
// Obsada zawodów miniżużla (85–140 cm³), klasy 500R i pucharów U17/U19 według regulaminów PZM/Ekstraligi 2026
// (teksty: data/minizuzel-regulaminy). Listy startowe buduje js/competitions.js: indField (pola 'mini', 'kids500', 'u17', 'u19')
// i teamUnits/pickUnits (pole 'miniTeams'); tu są reguły, kto ma prawo startu i kto awansuje.
//
// Miniżużel 85–140 (Regulamin MPiN PZM w klasie 85-140cc, art. 901–947):
// – tylko zawodnicy krajowi (art. 901 ust. 7), zgłoszeni przez kluby / szkółki;
// – DMP: drużyny w dwóch grupach (A, B), w finale po 3 najlepsze z grup + drużyna organizatora finału, a gdy ta awansowała –
//   4. drużyna z grupy organizatora (art. 904 ust. 7); skład 3 + rezerwowy;
// – IPP: każdy zawodnik startuje tylko w jednej grupie (art. 941 ust. 6), finał: po 9 najlepszych z grup + nominacja
//   organizatora + dzika karta GKSŻ (art. 942);
// – IMP: dwa półfinały (po 8 awansuje), obsadę wyznacza GKSŻ na podstawie IPP i IPE; organizator finału ma gwarantowane
//   miejsce dla swojego zawodnika (art. 921–924);
// – MPPK: 14 par w dwóch półfinałach (A, B), do finału po 3 najlepsze pary z grup (art. 937);
// – DPE 85–140 (Ekstraliga): 8 drużyn klubów Ekstraligi, 7 w każdej rundzie, para + rezerwowy (art. 1071, 1073);
// – IPE 85–140 (Ekstraliga): zawodnicy krajowi, pierwszeństwo mają zawodnicy klubów Ekstraligi (art. 1051 ust. 4).
// 500R: IPE 500R i Puchar GKSŻ 500R – zawodnicy krajowi zgłoszeni przez kluby i stowarzyszenia z licencją (art. 1041, 951);
// IMP 500R – po 6 najlepszych z IPE 500R i Pucharu GKSŻ, 3 stałych uczestników nominuje GKSŻ, 1 – organizator rundy (art. 1101).
// IPE U17 i IP2E U19 – zawodnicy krajowi z licencją „Ż” klubów ligowych, wiek rocznikowo (art. 1201, 1211).

// Grupy DMP 85–140 w sezonie 2026 (protokoły rund: grupa A – Toruń, Wawrów; grupa B – Częstochowa, Rędziny).
// Klucze jednostek jak w miniUnits: skrót klubu albo 'school-<id>' dla szkółki niezależnej; '#2' – druga drużyna klubu
// (art. 907 ust. 7; Stal Gorzów jeździ jako MX Plast Stal Wawrów i Subtel Stal Wawrów).
const MINI_DMP_GROUPS_2026 = {
  A: ['TOR', 'school-LIPN', 'ZIE', 'GOR', 'GOR#2', 'GDA'],
  B: ['RYB', 'school-REDZ', 'LES', 'CZE', 'BYD', 'WRO'],
};
const MINI_GROUP_MAX = 7; // grupa siedmiozespołowa (art. 903 ust. 1)
const miniDomestic = k => (k.country || 'POL') === 'POL';
const miniGroupLetter = ev => /\bB\b|_B$/.test(`${ev.stage || ''} ${ev.comp}`) ? 'B' : 'A';
const miniKidKey = (k, S) => { const t = typeof miniTeamOf === 'function' ? miniTeamOf(k, S) : k.clubId; return t && G.clubs[t] ? G.clubs[t].short : k.schoolId && G.miniSchools && G.miniSchools[k.schoolId] && !G.miniSchools[k.schoolId].clubId ? `school-${k.schoolId}` : null; };

// Przydział drużyn do grup w sezonie (zapamiętany): skład grup 2026; w kolejnych sezonach nowe drużyny klubów
// z co najmniej 3 zawodnikami trafiają do mniej licznej grupy (do 7 drużyn)
function miniGroups(S = G.season) {
  G.miniGroups = G.miniGroups || {};
  if (G.miniGroups[S]) return G.miniGroups[S];
  const g = {};
  for (const [L, keys] of Object.entries(MINI_DMP_GROUPS_2026)) for (const k of keys) g[k] = L;
  if (S > 2026 && typeof miniUnits === 'function') {
    const fresh = miniUnits(4, S, miniDomestic).filter(u => u.riders.length >= 3 && !g[u.key]).sort(by(u => u.key));
    for (const u of fresh) {
      const n = L => Object.values(g).filter(x => x === L).length;
      const L = n('A') <= n('B') ? 'A' : 'B';
      if (n(L) < MINI_GROUP_MAX) g[u.key] = L;
    }
  }
  return (G.miniGroups[S] = g);
}
// Grupa zawodnika w IPP: grupa jego drużyny; zawodnicy klubów spoza DMP – grupa wyznaczona stale z identyfikatora klubu
function miniRiderGroup(k, S) {
  const key = miniKidKey(k, S);
  if (!key) return null;
  return miniGroups(S)[key] || (hashStr(key) % 2 ? 'B' : 'A');
}
// Gospodarz zawodów: klub z miasta toru albo szkółka niezależna z miejscowości w nazwie toru (np. Rędziny, Wawrów)
function miniHostKey(ev) {
  const c = typeof qualHostClub === 'function' ? qualHostClub(ev) : null;
  if (c) return c.short;
  const s = Object.values(G.miniSchools || {}).find(s => !s.clubId && ev.venue && s.short.split(/\s+/).some(w => w.length > 4 && ev.venue.includes(w)));
  return s ? `school-${s.id}` : null;
}
// Klasyfikacja cyklu (tabela G.series): klucze od najlepszego
const miniTable = (S, comp) => Object.entries((G.series || {})[`${S}-${comp}`] || {}).sort(by(([, p]) => p, -1)).map(([k]) => k);
// Klasyfikacja rozegranych zawodów (jednostki lub zawodnicy)
const miniEvOrder = e => { const m = e.played && e.matchId && G.matches[e.matchId]; return m && m.classification ? m.classification.map(c => c.key ?? c.riderId) : []; };
const miniPlayed = (S, comp, re) => Object.values(G.events).filter(e => e.comp === comp && e.season === S && e.played && !e.cancelled && (!re || re.test(e.stage || ''))).sort(by(e => e.date));

// ---------- Drużyny i pary ----------
// Drużyny DMP: pierwsza – 3 najlepszych + rezerwowy; druga drużyna (klucz '#2', gdy zgłoszona) – kolejni zawodnicy klubu.
// Zawodnik jeździ w sezonie tylko w jednej drużynie swojego klubu (art. 907 ust. 7).
function miniDmpUnits(S) {
  const G1 = miniGroups(S), out = [];
  for (const u of miniUnits(8, S, miniDomestic)) {
    const one = u.riders.slice(0, 4), two = u.riders.slice(4, 8), str = ids => sum(ids.map(id => (G.academy[id] || {}).ca ?? 0));
    out.push({ ...u, riders: one, str: str(one) });
    if (G1[`${u.key}#2`] && two.length >= 2) out.push({ ...u, key: `${u.key}#2`, name: `${u.name} II`, riders: two, str: str(two) });
  }
  return out.filter(u => u.riders.length >= 2);
}
// Wybór drużyn do zawodów (pickUnits): units – wszystkie drużyny z co najmniej 2 zawodnikami krajowymi
function miniPickUnits(ev, units, n) {
  const S = ev.season, G1 = miniGroups(S), byKey = k => units.find(u => u.key === k), str = list => list.slice().sort(by(u => u.str, -1));
  if (/^MINI_DMP/.test(ev.comp)) units = miniDmpUnits(S); // drużyny 3 + rezerwowy, druga drużyna klubu z kolejnych zawodników
  if (ev.comp === 'MINI_DMP_A' || ev.comp === 'MINI_DMP_B') {
    const L = miniGroupLetter(ev);
    return str(units.filter(u => G1[u.key] === L)).slice(0, MINI_GROUP_MAX);
  }
  if (ev.comp === 'MINI_DMP') { // finał: po 3 najlepsze z grup + organizator (art. 904 ust. 7)
    const rank = L => { const t = miniTable(S, `MINI_DMP_${L}`).map(byKey).filter(Boolean); return t.length ? t : str(units.filter(u => G1[u.key] === L)); };
    const A = rank('A'), B = rank('B'), out = [...A.slice(0, 3), ...B.slice(0, 3)];
    const host = byKey(miniHostKey(ev));
    if (host && !out.includes(host)) out.push(host);
    else { const L = host ? G1[host.key] : 'A', next = (L === 'B' ? B : A).slice(3).find(u => !out.includes(u)); if (next) out.push(next); }
    return out.slice(0, n);
  }
  if (ev.comp === 'MINI_DPE') { // kluby Ekstraligi, 7 z 8 w rundzie – organizator jedzie zawsze, pauzujący rotacyjnie
    const pge = units.filter(u => u.clubId && G.clubs[u.clubId].league === 'PGE').sort(by(u => u.key));
    if (pge.length <= n) return pge;
    const host = miniHostKey(ev), others = pge.filter(u => u.key !== host);
    const off = (ev.round || 1) - 1, sit = new Set();
    for (let i = 0; sit.size < pge.length - n; i++) sit.add(others[(off + i) % others.length].key);
    return pge.filter(u => !sit.has(u.key));
  }
  if (ev.comp === 'MINI_MPPKQ') { // półfinały A i B po 7 par (art. 937 ust. 1); pary przydzielone według grup DMP
    const L = miniGroupLetter(ev), all = str(units), inGroup = all.filter(u => (G1[u.key] || (hashStr(u.key) % 2 ? 'B' : 'A')) === L);
    return inGroup.slice(0, n);
  }
  if (ev.comp === 'MINI_MPPK') { // finał: po 3 najlepsze pary z półfinałów A i B (art. 937 ust. 7)
    const semis = miniPlayed(S, 'MINI_MPPKQ'), out = [];
    for (const L of ['A', 'B']) {
      const e = semis.find(x => miniGroupLetter(x) === L);
      const order = e ? miniEvOrder(e).map(byKey).filter(Boolean) : str(units.filter(u => (G1[u.key] || 'A') === L));
      out.push(...order.filter(u => !out.includes(u)).slice(0, 3));
    }
    for (const u of str(units)) if (out.length < Math.min(n, 6) && !out.includes(u)) out.push(u);
    return out.slice(0, n);
  }
  return null;
}

// ---------- Zawody indywidualne 85–140 ----------
// Pula: adepci z ważnym certyfikatem 85–140, krajowi, zgłoszeni przez klub lub szkółkę
function miniPool(S) {
  return (typeof miniField === 'function' ? miniField() : []).filter(k => miniDomestic(k) && miniKidKey(k, S)).sort(by(k => k.ca ?? k.ability, -1));
}
function miniIndField(ev, capacity) {
  const S = ev.season, pool = miniPool(S), ok = new Set(pool.map(k => String(k.id)));
  const out = [], add = id => { if (id != null && ok.has(String(id)) && !out.some(x => String(x) === String(id)) && out.length < capacity) out.push(isNaN(id) ? id : Number(id)); };
  const hostKey = miniHostKey(ev), hostPick = () => pool.find(k => miniKidKey(k, S) === hostKey && !out.some(x => String(x) === String(k.id)));
  switch (ev.comp) {
    case 'MINI_IPP_A': case 'MINI_IPP_B': {
      const L = miniGroupLetter(ev);
      pool.filter(k => miniRiderGroup(k, S) === L).forEach(k => add(k.id));
      break;
    }
    case 'MINI_IPP': { // finał: po 9 z grup, organizator, dzika karta GKSŻ (art. 942)
      for (const L of ['A', 'B']) miniTable(S, `MINI_IPP_${L}`).filter(id => ok.has(String(id))).slice(0, 9).forEach(add);
      const h = hostPick(); if (h) add(h.id);
      pool.forEach(k => add(k.id)); // dzika karta i uzupełnienie
      break;
    }
    case 'MINI_IPE': // pierwszeństwo zawodników klubów Ekstraligi (art. 1051 ust. 4)
      pool.filter(k => { const t = miniTeamOf(k, S); return t && G.clubs[t] && G.clubs[t].league === 'PGE'; }).forEach(k => add(k.id));
      pool.forEach(k => add(k.id));
      break;
    case 'MINI_IMPQ': { // półfinały: ranking GKSŻ z IPP (grupy) i IPE, rozstawienie „wężykiem” do półfinałów A i B
      const pts = {};
      for (const c of ['MINI_IPP_A', 'MINI_IPP_B', 'MINI_IPE']) for (const [id, p] of Object.entries((G.series || {})[`${S}-${c}`] || {})) if (ok.has(id)) pts[id] = (pts[id] || 0) + p;
      const rank = [...Object.keys(pts).sort(by(id => pts[id], -1)), ...pool.map(k => String(k.id)).filter(id => !(id in pts))];
      const L = miniGroupLetter(ev), sem = Object.values(G.events).filter(e => e.comp === 'MINI_IMPQ' && e.season === S).length;
      rank.slice(0, capacity * Math.max(1, sem)).forEach((id, i) => { const g = sem > 1 ? (i % 4 === 0 || i % 4 === 3 ? 'A' : 'B') : 'A'; if (g === L) add(id); });
      rank.forEach(add);
      break;
    }
    case 'MINI_IMP': { // finały: po 8 z półfinałów; organizator ma gwarantowane miejsce (art. 922 ust. 2, art. 924 ust. 1)
      const semis = miniPlayed(S, 'MINI_IMPQ');
      const q = semis.flatMap(e => miniEvOrder(e).filter(id => ok.has(String(id))).slice(0, 8));
      if (q.length) {
        const h = hostKey && !q.some(id => miniKidKey(G.academy[id] || {}, S) === hostKey) ? hostPick() : null;
        (h ? q.slice(0, capacity - 1) : q).forEach(add);
        if (h) add(h.id);
      }
      pool.forEach(k => add(k.id));
      break;
    }
    default: pool.forEach(k => add(k.id));
  }
  return out;
}

// ---------- 500R, U17, U19 ----------
// Adepci 500R z licencją swojej klasy, krajowi, zgłoszeni przez klub lub stowarzyszenie (szkółkę)
function kids500Pool() {
  return Object.values(G.academy).filter(k => !k.catalogOnly && !k.retired && k.cat === 'c500' && miniDomestic(k) && (typeof kidCanRace !== 'function' || kidCanRace(k))
    && ((k.clubId && G.clubs[k.clubId]) || (k.schoolId && G.miniSchools && G.miniSchools[k.schoolId]))).sort(by(k => k.ca ?? k.ability, -1));
}
function kids500Field(ev, capacity) {
  const S = ev.season, pool = kids500Pool(), ok = new Set(pool.map(k => String(k.id))), out = [];
  const add = id => { if (id != null && ok.has(String(id)) && !out.some(x => String(x) === String(id)) && out.length < capacity) out.push(id); };
  if (ev.comp === 'IMP500') { // po 6 z IPE 500R i Pucharu GKSŻ 500R, 3 stałych z nominacji GKSŻ, 1 – organizator rundy (art. 1101)
    const ipe = miniTable(S, 'IPE500').filter(id => ok.has(id)), gk = miniTable(S, 'PG500').filter(id => ok.has(id));
    ipe.slice(0, 6).forEach(add); gk.slice(0, 6).forEach(add);
    for (const id of [...ipe, ...gk]) if (out.length < 12) add(id); // zawodnik z obu klasyfikacji – GKSŻ nominuje kolejnego
    pool.forEach(k => { if (out.length < Math.min(15, capacity - 1)) add(k.id); }); // stali uczestnicy z nominacji GKSŻ
    const host = typeof qualHostClub === 'function' ? qualHostClub(ev) : null, h = host && pool.find(k => k.clubId === host.id && !out.includes(k.id));
    if (h) add(h.id);
  }
  pool.forEach(k => add(k.id));
  return out;
}
// IPE U17 / IP2E U19: krajowi z licencją „Ż” w klubach ligowych, wiek rocznikowo
const youthLicensed = (P, maxAge, S) => P.filter(r => polEligible(r) && r.clubId && ageIn(r, S) <= maxAge);
