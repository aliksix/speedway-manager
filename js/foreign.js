'use strict';
// Ligi zagraniczne: prawdziwe kluby, składy i terminarze 2026 (js/foreign-data.js – tools/build-foreign.cjs).
// Każdy mecz jest rozgrywany bieg po biegu według regulaminowej tabeli biegowej ligi (FOREIGN_PACK.heat),
// tabele, play-off i mistrzowie; mistrzostwa krajowe (indywidualne i juniorskie) jako zawody w zakładce Zawody.
// Kolejne sezony: te same terminy przesunięte o 52 tygodnie (jak kalendarz GKSŻ), kluby i składy trwają między sezonami.

const FP = typeof FOREIGN_PACK !== 'undefined' ? FOREIGN_PACK : null;
const F_HELMET = { R: 'czerwony', B: 'niebieski', W: 'biały', Y: 'żółty', GR: 'zielony', BW: 'czarno-biały' };
HELMET_COLOR.zielony = '#3fae5a';
HELMET_COLOR['czarno-biały'] = 'linear-gradient(90deg,#16181d 50%,#f4f6fa 50%)';
if (FP) {
  // nazwy i poziom lig dla modułów korzystających z FOREIGN_LEAGUES (terminarz, kadry narodowe, sprzęt)
  for (const k of Object.keys(FOREIGN_LEAGUES)) delete FOREIGN_LEAGUES[k];
  for (const [id, L] of Object.entries(FP.leagues)) FOREIGN_LEAGUES[id] = { name: L.name, full: L.full, country: L.country, prestige: L.prestige, tier: L.tier, noLimit: !!L.noLimit, days: L.days };
  for (const [id, L] of Object.entries(FP.cups || {})) FOREIGN_LEAGUES[id] = { name: L.name, full: L.full, country: L.country, prestige: L.prestige, tier: L.tier, cup: true }; // puchary (nie liczą się do limitu lig)
  for (const c of Object.values(FP.clubs)) if (c.logo && typeof ASSETS !== 'undefined') ASSETS.clubs[c.id] = c.logo; // herb klubu (crest w js/util.js)
  for (const c of Object.values(FP.clubs)) { if (!GEO[c.city]) GEO[c.city] = [c.geo[0], c.geo[1], c.country]; if (!GEO[c.venue]) GEO[c.venue] = [c.geo[0], c.geo[1], c.country]; }
  for (const ch of FP.champs) for (const r of ch.rounds) if (r.venue && r.geo && !GEO[r.venue]) GEO[r.venue] = [r.geo[0], r.geo[1], ch.cc];
  for (const ch of FP.champs) for (const r of ch.rounds) if (r.venue && !GEO[r.venue]) GEO[r.venue] = (Object.values(FP.clubs).find(c => c.city === r.venue) || {}).geo ? [...Object.values(FP.clubs).find(c => c.city === r.venue).geo, ch.cc] : COUNTRY_GEO[ch.cc] || null;
}
const fLeague = lg => FP.leagues[lg] || (FP.cups || {})[lg];
const fIsCup = lg => !!(FP && FP.cups && FP.cups[lg]);
const fTable = id => SpeedwayHeatAdapter.table(FP.heat, id);
const fClub = id => G.fclubs && G.fclubs[id];
const fShift = season => (season - FP.season) * 364;
const fClubName = id => (fClub(id) || {}).name || id;
const fClubShort = id => (fClub(id) || {}).short || id;

// ---------- Nazwiska: dopasowanie do zawodników gry ----------
const F_ALIAS = { sajfutdinow: 'sayfutdinov', sajfutdinov: 'sayfutdinov', lebiediew: 'lebedevs', lebedvs: 'lebedevs', artiom: 'artem', daniel: 'dan', czugunow: 'chugunov', chugonov: 'chugunov',
  tarasienko: 'tarasenko', loktajew: 'loktaev', thorsell: 'thorssell', jakob: 'jacob', levishin: 'levishyn', kessler: 'kossler', daniil: 'dan' };
const fFold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[łŁ]/g, 'l').replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/ß/g, 'ss')
  .toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').map(t => F_ALIAS[t] || t).join(' ');
let F_NAMES = null;
function fRiderByName(n) {
  if (!F_NAMES) { F_NAMES = new Map(); for (const r of Object.values(G.riders)) { const k = fFold(r.name); if (!F_NAMES.has(k)) F_NAMES.set(k, r); } }
  return F_NAMES.get(fFold(n)) || fFuzzyRider(n);
}
// Literówki w protokołach lig zagranicznych (np. „Timo Lathi”, „Robert Chimel”): to samo imię, nazwisko różne o jedną literę
// albo zamianę dwóch sąsiednich liter (odległość Damerau–Levenshteina ≤ 1); tylko jednoznaczne trafienie wśród zawodników z bazy
function fEdit1(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  return s.slice(i) === l.slice(i + 1);
}
function fFuzzyRider(n) {
  const [first, ...rest] = fFold(n).split(' '), last = rest.join(' ');
  if (!first || last.length < 4) return null;
  const hits = Object.values(G.riders).filter(r => !r.foreignOnly && (([f, ...l]) => f === first && fEdit1(l.join(' '), last))(fFold(r.name).split(' ')));
  return hits.length === 1 ? hits[0] : null;
}
// Zapisy sprzed dopasowania literówek: duplikat z ligi zagranicznej scalony z zawodnikiem z bazy (składy klubów zagranicznych)
function fMergeTypos() {
  let n = 0;
  for (const d of Object.values(G.riders).filter(r => r.foreignOnly && !r.clubId && !r.contract)) {
    const real = fFuzzyRider(d.name);
    if (!real || real.id === d.id) continue;
    for (const c of Object.values(G.fclubs || {})) if (c.squad.includes(d.id)) c.squad = [...new Set(c.squad.map(id => (id === d.id ? real.id : id)))];
    delete G.riders[d.id]; n++;
  }
  if (n) F_NAMES = null;
  return n > 0;
}

// ---------- Model: kluby i składy ----------
function ensureForeignModel() {
  if (!FP || !G) return false;
  let ch = false;
  G.fclubs = G.fclubs || {}; G.ffix = G.ffix || {}; G.fseasons = G.fseasons || {};
  for (const c of Object.values(FP.clubs)) if (!G.fclubs[c.id]) {
    G.fclubs[c.id] = { id: c.id, league: c.league, name: c.name, short: c.short, country: c.country, city: c.city, venue: c.venue, geo: c.geo, homeDay: c.homeDay ?? null, squad: [], hist: [] };
    ch = true;
  }
  // składy 2026 z paczki: zawodnicy z bazy albo nowi (spoza bazy globalnej) – raz na rozgrywkę
  if (!G.fSquadsInit) {
    F_NAMES = null;
    for (const [cid, list] of Object.entries(FP.squads)) {
      const c = G.fclubs[cid];
      for (const e of list) {
        const r = (e.db && G.riders[e.db]) || fRiderByName(e.n) || fNewRider(e, c);
        if (r && !c.squad.includes(r.id)) c.squad.push(r.id);
      }
    }
    G.fSquadsInit = true; ch = true;
  }
  if (!G.fTypos1) { if (fMergeTypos()) ch = true; G.fTypos1 = true; }
  if (fAddPeople()) ch = true;
  if (fMergeKidDupes()) ch = true;
  if (fFixNameMerges()) ch = true;
  // stare przydziały lig (model statystyczny) – nowy przydział z prawdziwych składów
  if (!G.fModel) { for (const r of Object.values(G.riders)) { delete r.fl; delete r.fx; } G.flSeason = null; G.fModel = 1; ch = true; }
  return ch;
}
// Zawodnik spoza bazy globalnej: poziom z paczki (średnia w lidze albo miejsce w składzie), wiek i atrybuty – szacunek
function fNewRider(e, c) {
  G.seq.frider = Math.max(G.seq.frider || 60000, 60000) + 1;
  const id = G.seq.frider, L = fLeague(c.league), s = e.s ?? 5;
  const r = newRider({ id, name: e.n, country: e.c || c.country, born: null, skill: s, potential: clamp(Math.round(s * 5 + 30), 30, 90),
    profile: `zawodnik ligi ${L.name}`, certainty: 'szacunek: średnia ligowa albo miejsce w składzie 2026', activity: [`${COUNTRY[c.country] || c.country} – ${L.name} 2026 (${c.name})`],
    lastSeason: FP.season, note: 'spoza bazy globalnej – skład ligi zagranicznej 2026 (js/foreign-data.js)' }, G.date);
  r.foreignOnly = true;
  G.riders[id] = r;
  if (F_NAMES) F_NAMES.set(fFold(r.name), r);
  return r;
}
// Zawodnicy i adepci spoza bazy ze startów 2026 (paczka: extraRiders, youth) – uzupełnienie obsad zawodów za granicą.
// Adepci zagraniczni: bez polskiej szkółki, klasa z najwyższych startów 2026, rocznik szacowany z wieku typowego dla klasy.
const F_PEOPLE_VER = 1;
const F_YCAT = { 50: 'c50', 85: 'c85', 250: 'c250', '500R': 'c500' }, F_YAGE = { c50: 8, c85: 11, c250: 13, c500: 15 };
function fAddPeople() {
  if (!FP || !FP.youth || G.fPeople === F_PEOPLE_VER) return false;
  F_NAMES = null;
  const kidsBy = new Map(Object.values(G.academy).map(k => [fFold(k.name), k]));
  for (const e of FP.extraRiders || []) {
    if (fRiderByName(e.n) || kidsBy.has(fFold(e.n))) continue;
    G.seq.frider = Math.max(G.seq.frider || 60000, 60000) + 1;
    const id = G.seq.frider, s = e.s ?? 5;
    const r = newRider({ id, name: e.n, country: e.c, born: null, skill: s, potential: clamp(Math.round(s * 5 + 30), 30, 90), profile: `zawodnik ${COUNTRY[e.c] || e.c} (zawody krajowe)`,
      certainty: 'szacunek: wyniki zawodów krajowych 2026', activity: [e.src], lastSeason: FP.season, note: 'spoza bazy globalnej – starty 2026 (js/foreign-data.js: extraRiders)' }, G.date);
    if (e.born) { r.born = birthFromYear(Number(e.born), e.n); r.bornEst = true; }
    r.foreignOnly = true; G.riders[id] = r; F_NAMES.set(fFold(r.name), r);
  }
  for (const e of FP.youth) {
    if (kidsBy.has(fFold(e.n)) || fRiderByName(e.n)) continue;
    const cat = F_YCAT[e.cls] || 'c85', y = FP.season - F_YAGE[cat] - Math.floor(hrand(e.n + 'fy') * 2);
    const k = { id: `A${G.seq.academy++}`, name: e.n, country: e.cc, born: String(y), bornEst: true, birthYear: y, clubId: null, schoolId: null, cat, real: true, fYouth: true,
      source: e.src, joined: G.date, progress: [], parentsSupport: 1 + Math.floor(hrand(e.n + 'ps') * 5), meets: 0 };
    G.academy[k.id] = k; kidsBy.set(fFold(k.name), k);
    initKidAbility(k, null);
  }
  G.fPeople = F_PEOPLE_VER;
  return true;
}
// Zapisy sprzed poprawki dopasowania imion (paczka 5.10.2026): różne osoby o tym samym nazwisku i inicjale były jednym zawodnikiem
// (bliźniacy Mathias i Mathieu Trésarrieu) – brakujący zawodnik powstaje i zastępuje w składzie klubu tego o tym samym nazwisku
function fFixNameMerges() {
  if (G.fNameFix === 1 || !G.fSquadsInit) return false;
  G.fNameFix = 1; F_NAMES = null;
  let n = 0;
  const last = x => fFold(x).split(' ').slice(-1)[0];
  for (const [cid, list] of Object.entries(FP.squads)) {
    const c = G.fclubs[cid];
    if (!c) continue;
    for (const e of list) {
      if (e.db || Object.values(G.riders).some(r => fFold(r.name) === fFold(e.n))) continue;
      const wrong = c.squad.map(id => G.riders[id]).find(r => r && last(r.name) === last(e.n) && fFold(r.name) !== fFold(e.n) && !fFuzzyRider(e.n));
      if (!wrong) continue;
      const r = fNewRider(e, c);
      c.squad = c.squad.map(id => (id === wrong.id ? r.id : id)); n++;
    }
  }
  return n > 0;
}
// Ten sam człowiek dwa razy: adept (kalibracja miniżużla, np. Niklas Bager – DM 250/500R) i zawodnik utworzony ze składu ligi
// zagranicznej (rocznik zgadywany). Ligowiec zostaje (składy, statystyki), dostaje rocznik i potencjał adepta; adept znika
// (alias id do dawnych wyników). Adepci polskich szkółek i dzieci menedżera bez zmian.
function fMergeKidDupes() {
  if (G.fKidMerge === 1) return false;
  const kn = new Map(Object.values(G.academy).filter(k => !k.retired && !k.catalogOnly && !k.clubId && !k.schoolId && !k.mgrChild).map(k => [fFold(k.name), k]));
  let n = 0;
  for (const r of Object.values(G.riders)) {
    const k = r.foreignOnly && kn.get(fFold(r.name));
    if (!k) continue;
    r.born = typeof kidBirth === 'function' ? kidBirth(k) : r.born; r.bornEst = !!k.bornEst || String(k.born).length === 4;
    if (k.pa != null) { r.pa = Math.max(k.pa, r.ca ?? 0); if (k.paRange) r.paRange = k.paRange.slice(); }
    if (k.country && k.country !== 'POL') r.country = k.country;
    (G.kidAlias ||= {})[k.id] = r.id;
    for (const p of Object.values(G.miniPeople || {})) if (p.kidId === k.id) { p.kidId = null; p.riderId = r.id; }
    delete G.academy[k.id]; kn.delete(fFold(r.name)); n++;
  }
  G.fKidMerge = 1;
  return n > 0;
}
const fFree = (r, date) => !!r && r.active !== false && !r.retired && !(r.injury && G.injuries[r.injury] && date < G.injuries[r.injury].until) && !(r.suspendedUntil && r.suspendedUntil > date);
// Liczba zawodników drużyny w meczu (tabela biegowa ligi)
const fTeamSize = lg => fLeague(lg).teamSize;

// ---------- Sezon: terminarz, limit lig, plan startów ----------
// Limit lig GKSŻ (art. 216) i składy: zawodnik w lidze, której nie mieści się w limicie, nie jeździ w niej w tym sezonie
function fAssignLeagues(season) {
  const per = new Map();
  for (const c of Object.values(G.fclubs)) for (const id of c.squad) { if (!per.has(id)) per.set(id, []); per.get(id).push(c); }
  const lost = [];
  for (const r of Object.values(G.riders)) {
    const cs = per.get(r.id) || [];
    if (!cs.length || r.retired || !r.active) { if (r.fl) { r.fl = null; r.fx = null; } continue; }
    const lim = foreignLimit(r, season);
    const all = cs.map(c => ({ id: c.league, team: c.name, clubId: c.id })).sort(by(x => fLeague(x.id).prestige, -1));
    const list = [], dropped = [];
    for (const x of all) { if (fLeague(x.id).noLimit || list.filter(y => !fLeague(y.id).noLimit).length < lim) list.push(x); else dropped.push(x); }
    const before = r.fl && r.fl.season === season - 1 ? r.fl.list.map(x => x.id) : null;
    r.fl = { season, list, dropped };
    if (before && dropped.some(x => before.includes(x.id))) lost.push([r, dropped.filter(x => before.includes(x.id))]);
  }
  return lost;
}
function ensureForeignSeason(season, notify = false) {
  if (!FP || !G) return false;
  ensureForeignModel();
  const hasFx = Object.values(G.fixtures).some(f => f.season === season);
  if (!hasFx) return false;
  if (G.flSeason === season) return false;
  if (!G.fseasons[season]) fBuildSeason(season);
  const lost = fAssignLeagues(season);
  fPlanAll(season);
  G.flSeason = season; G.flVer = (G.flVer || 0) + 1;
  if (notify && season === 2027) addMsg({ category: 'liga', from: 'GKSŻ', title: 'Limit lig od sezonu 2027', body: `<p>Od sezonu 2027 zawodnicy PGE Ekstraligi i Metalkas 2. Ekstraligi mogą startować tylko w dwóch ligach łącznie z polską (wcześniej w trzech). W KLŻ limit wynosi cztery ligi.</p>${lost.filter(([r]) => r.clubId === G.clubId).length ? `<p>W naszej kadrze z lig zagranicznych rezygnują: ${lost.filter(([r]) => r.clubId === G.clubId).map(([r, d]) => `<a href="#/zawodnik/${r.id}/terminarz">${esc(r.name)}</a> (${d.map(x => fLeague(x.id).name).join(', ')})`).join('; ')}.</p><p>Mniej startów za granicą to więcej czasu na trening w klubie – ale i mniej okazji do ścigania.</p>` : ''}`, link: '#/druzyna/dostepnosc' });
  return true;
}
function fBuildSeason(season) {
  const sh = fShift(season), po = {};
  if (season > FP.season) fTransferWindow(season); // okno transferowe: awanse, spadki, zmiany klubów, debiuty, uzupełnienia
  for (const f of FP.fixtures) {
    const d = addDays(f.d, sh);
    if (f.st === 'RS' || f.st === 'R') {
      const id = `F${season}-${f.id}`;
      if (G.ffix[id]) continue;
      const units = f.units.filter(u => G.fclubs[u]);
      G.ffix[id] = { id, season, lg: f.lg, st: f.st, round: f.round || null, d, units, venue: f.venue || (G.fclubs[units[0]] || {}).city || '', played: false, skip: d < G.date || undefined };
    } else ((po[f.lg] ||= {})[f.st] ||= []).includes(d) || po[f.lg][f.st].push(d);
  }
  for (const x of Object.values(po)) for (const k of Object.keys(x)) x[k].sort();
  G.fseasons[season] = { po, champions: {}, cups: {} };
  for (const cup of Object.keys(FP.cups || {})) fCupStep(cup, season);
  // stare sezony: bez protokołów biegów (tabele i wyniki zostają)
  for (const f of Object.values(G.ffix)) if (f.season < season - 1 && f.res && f.res.heats) delete f.res.heats;
}
// ---------- Okno transferowe lig zagranicznych (między sezonami) ----------
// Raz na sezon, przy budowie terminarza (fBuildSeason): koniec kariery, odejścia weteranów, awanse najlepszych do wyższej ligi
// kraju (najpierw klub z tego samego miasta – np. duńskie dywizje Slangerup), spadki słabych, zmiany klubów w lidze, zwolnienia
// nadmiaru, debiuty młodych zawodników kraju bez klubu (m.in. adepci po licencji) i uzupełnienie braków. Wynik: G.ftrans[sezon].
const F_TR_KIND = { koniec: 'koniec kariery', odchodzi: 'odchodzi z ligi', awans: 'awans do wyższej ligi', spadek: 'do niższej ligi', zmiana: 'zmiana klubu',
  lepszy: 'do mocniejszego klubu', zwolniony: 'zwolniony', debiut: 'debiut w lidze', uzupelnienie: 'uzupełnienie składu' };
function fTransferWindow(season) {
  const prev = season - 1, rr = mulberry(hashStr(`ftr${season}|${G.seed}`)), log = [];
  const all = Object.values(G.fclubs), L = c => fLeague(c.league), cap = c => L(c).teamSize + 5;
  const need = c => Math.min(L(c).teamSize + 2, Math.max(L(c).teamSize + 1, (FP.squads[c.id] || []).length)); // Francja: składy 3-osobowe + rezerwowy
  const R = id => G.riders[id], live = r => r && !r.retired && r.active !== false;
  const inLg = (lg, id) => all.some(c => c.league === lg && c.squad.includes(id));
  const move = (id, from, to, kind) => {
    if (from) from.squad = from.squad.filter(x => x !== id);
    if (to && !to.squad.includes(id)) to.squad.push(id);
    log.push({ id, from: from ? from.id : null, to: to ? to.id : null, kind });
  };
  const avg = (r, lg) => { const s = r.fstats && r.fstats[prev] && r.fstats[prev][lg]; return s && s.h >= 8 ? (s.p + (s.b || 0)) / s.h : null; };
  const lvl = c => { const rs = c.squad.map(R).filter(live).sort(by(r => r.skill, -1)).slice(0, L(c).teamSize); return rs.length ? sum(rs.map(r => r.skill)) / rs.length : 0; };
  const tierClubs = (cc, tier) => all.filter(c => L(c).country === cc && L(c).tier === tier);
  // klub docelowy: z tego samego miasta, potem najsłabszy (najbardziej potrzebujący), bez przepełnionych
  const pick = (cands, from, id, strongest, leaving) => {
    // jeden klub w lidze (zawodnik może jeździć w dwóch ligach kraju); leaving – klub, z którego odchodzi
    const ok = cands.filter(c => c.squad.length < cap(c) && !all.some(x => x !== leaving && x.league === c.league && x.squad.includes(id)));
    return ok.find(c => from && c.city === from.city) || ok.sort(by(c => lvl(c) * (strongest ? -1 : 1)))[0] || null;
  };
  // 1. koniec kariery i nieaktywni
  for (const c of all) for (const id of [...c.squad]) if (!live(R(id))) move(id, c, null, 'koniec');
  // 2. weterani odchodzą z lig zagranicznych (od 36 lat, słabsi od typowego zawodnika składu)
  for (const c of all) for (const id of [...c.squad]) { const r = R(id), a = ageIn(r, season); if (a >= 36 && r.skill < lvl(c) && rr() < (a - 35) * 0.09) move(id, c, null, 'odchodzi'); }
  // 3. awanse: wyróżniający się zawodnicy niższych lig (średnia, poziom ponad ligą wyżej), do 30 lat
  for (const c of all.filter(x => L(x).tier > 1)) {
    const up = tierClubs(L(c).country, L(c).tier - 1);
    if (!up.length) continue;
    const bar = up.map(lvl).sort((a, b) => a - b)[Math.floor(up.length / 2)] - 0.8;
    for (const id of [...c.squad]) {
      const r = R(id), a = avg(r, c.league);
      if (ageIn(r, season) > 30 || up.some(x => x.squad.includes(id))) continue;
      if ((r.skill >= bar || (a != null && a >= 2.3)) && rr() < 0.45) { const to = pick(up, c, id); if (to) move(id, c, to, 'awans'); }
    }
  }
  // 4. spadki: słaba średnia i poziom wyraźnie poniżej składu – do niższej ligi kraju albo zwolnienie
  for (const c of all) {
    const down = tierClubs(L(c).country, L(c).tier + 1);
    for (const id of [...c.squad]) {
      const r = R(id), a = avg(r, c.league);
      if (a == null || a >= 1.25 || r.skill >= lvl(c) - 0.8 || rr() > 0.4) continue;
      const to = down.find(x => x.squad.includes(id)) || (down.length && pick(down, c, id)); // już jeździ niżej (np. GBP + GBC) – zostaje tam
      move(id, c, to || null, to ? 'spadek' : 'zwolniony');
    }
  }
  // 5. zmiany klubów w lidze: liderzy słabych drużyn do mocniejszych, część pozostałych losowo do potrzebujących
  for (const c of all) for (const id of [...c.squad]) {
    const r = R(id), mates = all.filter(x => x.league === c.league && x !== c);
    if (!mates.length) continue;
    if (r.skill > lvl(c) + 1.2 && rr() < 0.18) { const to = pick(mates.filter(x => lvl(x) > lvl(c)), null, id, true, c); if (to) { move(id, c, to, 'lepszy'); continue; } }
    if (rr() < 0.07) { const to = pick(mates, null, id, false, c); if (to) move(id, c, to, 'zmiana'); }
  }
  // 6. przepełnione składy: zwolnienie najsłabszych bez startów w poprzednim sezonie
  for (const c of all) while (c.squad.length > cap(c)) {
    const w = c.squad.map(R).sort(by(r => (avg(r, c.league) != null ? 10 : 0) + r.skill))[0];
    move(w.id, c, null, 'zwolniony');
  }
  // 7. debiuty: młodzi (do 21 lat) zawodnicy kraju bez klubu w jego ligach – najpierw najniższa liga
  const tiers = {}; for (const lg of Object.values(FP.leagues)) (tiers[lg.country] ||= []).push(lg.tier);
  for (const r of Object.values(G.riders).filter(x => live(x) && ageIn(x, season) <= 21 && tiers[x.country]).sort(by(x => x.skill, -1))) {
    if (all.some(c => L(c).country === r.country && c.squad.includes(r.id))) continue;
    const t = Math.max(...tiers[r.country]), cands = tierClubs(r.country, t).filter(c => c.squad.length < need(c) + 1);
    if (!cands.length || rr() > 0.6) continue;
    const to = cands.sort(by(c => c.squad.length))[0];
    move(r.id, null, to, 'debiut');
  }
  // 8. braki: wolni zawodnicy kraju ligi o zbliżonym poziomie
  for (const c of all) {
    const lv = lvl(c) || 6;
    if (c.squad.filter(id => live(R(id))).length >= need(c)) continue;
    const free = r => live(r) && !inLg(c.league, r.id) && r.skill <= lv + 2;
    const cand = Object.values(G.riders).filter(r => free(r) && (r.country === c.country || r.country === L(c).country)).sort(by(r => Math.abs(r.skill - lv)));
    // mało zawodników kraju (Francja, niższe ligi czeskie): obcokrajowcy bez innej ligi zagranicznej, potem jeżdżący w innych krajach
    const abroad = Object.values(G.riders).filter(r => free(r) && !cand.includes(r) && r.country !== 'POL').sort(by(r => (all.some(x => x.squad.includes(r.id)) ? 5 : 0) + Math.abs(r.skill - lv)));
    for (const r of [...cand, ...abroad]) { if (c.squad.filter(id => live(R(id))).length >= need(c)) break; move(r.id, null, c, 'uzupelnienie'); }
  }
  (G.ftrans ||= {})[season] = log;
  fTransferNews(season, log);
  return log;
}
function fTransferNews(season, log) {
  const real = log.filter(x => x.kind !== 'koniec');
  if (!real.length) return;
  const lbl = x => `${x.from ? esc(fClubShort(x.from)) : '—'} → ${x.to ? esc(fClubShort(x.to)) : '—'}`;
  const ours = real.filter(x => G.riders[x.id] && G.riders[x.id].clubId === G.clubId);
  const top = real.filter(x => x.to && ['awans', 'lepszy', 'zmiana'].includes(x.kind)).map(x => ({ x, r: G.riders[x.id] })).filter(o => o.r).sort(by(o => o.r.skill, -1)).slice(0, 8);
  const cnt = {}; for (const x of real) cnt[x.kind] = (cnt[x.kind] || 0) + 1;
  addMsg({ category: 'liga', from: 'Ligi zagraniczne', title: `Okno transferowe za granicą przed sezonem ${season}${ours.length ? ` – nasi zawodnicy: ${ours.length}` : ''}`,
    body: `${ours.length ? `<p><b>Nasi zawodnicy:</b> ${ours.map(x => `<a href="#/zawodnik/${x.id}">${esc(G.riders[x.id].name)}</a> – ${esc(F_TR_KIND[x.kind])} (${lbl(x)})`).join('; ')}.</p>` : ''}
      <p>${Object.entries(cnt).map(([k, n]) => `${esc(F_TR_KIND[k])}: ${n}`).join(' · ')}</p>
      ${top.length ? `<p>Najgłośniejsze ruchy: ${top.map(o => `<a href="#/zawodnik/${o.r.id}">${esc(o.r.name)}</a> (${lbl(o.x)})`).join('; ')}.</p>` : ''}`, link: '#/zagranica/transfery' });
}
// Plan startów: mecze klubów zagranicznych, w których zawodnik jest w przewidywanym składzie (najlepsi dostępni ze składu)
function fExpected(cid) {
  const c = G.fclubs[cid], L = fLeague(c.league);
  return c.squad.map(id => G.riders[id]).filter(r => r && !r.retired && r.active !== false && r.fl && r.fl.list.some(x => x.clubId === cid))
    .sort(by(r => r.skill, -1)).slice(0, L.teamSize).map(r => r.id);
}
function fPlanAll(season) {
  const exp = {};
  for (const cid of Object.keys(G.fclubs)) exp[cid] = new Set(fExpected(cid));
  for (const r of Object.values(G.riders)) if (r.fx) r.fx = null;
  for (const f of Object.values(G.ffix)) {
    if (f.season !== season || f.skip) continue;
    const g = fGeo(f), vn = fLabel(f);
    for (const cid of f.units) for (const id of exp[cid] || []) {
      const r = G.riders[id]; if (!r) continue;
      (r.fx ||= { season, list: [] }).list.push({ d: f.d, lg: f.lg, vn, g, fid: f.id, done: !!f.played });
    }
  }
  for (const r of Object.values(G.riders)) if (r.fx) r.fx.list.sort(by(e => e.d));
}
const fGeo = f => { const c = G.fclubs[f.units[0]]; return geoOf(f.venue) || (c ? [c.geo[0], c.geo[1], c.country] : null); };
const fLabel = f => f.units.length === 2 ? `${fClubShort(f.units[0])} – ${fClubShort(f.units[1])}` : `${f.venue || fClubName(f.units[0])} (${f.units.length} drużyny)`;
// Zawodnicy, którzy jechali tego dnia w lidze zagranicznej – zajęci dla zawodów ogłaszanych w dniu startu (js/competitions.js busyOn)
function fBusyOn(date) { const ids = []; for (const f of (FFX_IDX.map.get(date) || [])) if (f.res) for (const [id, s] of Object.entries(f.res.riders)) if (s.heats) ids.push(String(id)); return ids; }
// zgodność z js/schedule.js (plan dnia budowany z r.fx)
function foreignOn() { return []; }

// ---------- Dzień gry ----------
let FFX_IDX = { key: null, map: new Map() };
function fFixturesOn(date) {
  const key = Object.keys(G.ffix).length + '|' + (G.flVer || 0);
  if (FFX_IDX.key !== key || FFX_IDX.src !== G.ffix) { FFX_IDX = { key, src: G.ffix, map: new Map() }; /* po wczytaniu gry – nowe obiekty meczów */ for (const f of Object.values(G.ffix)) { if (!FFX_IDX.map.has(f.d)) FFX_IDX.map.set(f.d, []); FFX_IDX.map.get(f.d).push(f); } }
  return (FFX_IDX.map.get(date) || []).filter(f => !f.played && !f.skip);
}
// Wszystkie mecze lig zagranicznych dnia (racing – zawodnicy startujący tego dnia w Polsce i w zawodach)
function foreignDay(date, racing) {
  if (!FP || !G.ffix) return;
  fPlayoffDeadline(date);
  const todays = fFixturesOn(date).sort(by(f => fLeague(f.lg).tier * 10 - fLeague(f.lg).prestige));
  if (!todays.length) return;
  const used = new Set([...racing.keys()].map(String));
  // liga polska ma pierwszeństwo: zawodnicy klubów grających tego dnia w Polsce (skład ustalany przy meczu) i rezerwowi zawodów
  // także mecz już rozegrany tego dnia (mecz naszego klubu – gra zatrzymuje się na nim przed startami za granicą)
  for (const pf of Object.values(G.fixtures)) if (pf.date === date) { for (const cid of [pf.homeId, pf.awayId]) clubRiders(cid).forEach(r => used.add(String(r.id))); const pm = G.matches[pf.matchId || `X${pf.id}`]; if (pm && pm.riders) Object.keys(pm.riders).forEach(id => used.add(String(id))); }
  for (const e of Object.values(G.events)) if (e.date === date && !e.played) { (e.reserves || []).forEach(id => used.add(String(id))); (e.units || []).forEach(u => u.riders.forEach(id => id != null && used.add(String(id)))); }
  const mine = [];
  for (const f of todays) {
    const units = f.units.map(cid => { const riders = fLineup(cid, f, used); riders.forEach(id => id != null && used.add(String(id))); return { cid, riders }; });
    if (units.filter(u => u.riders.some(id => id != null)).length < 2) { f.played = true; f.cancelled = true; continue; }
    for (const u of units) for (const id of u.riders) if (id != null) travelTo(G.riders[id], fGeo(f), date);
    const m = fMeeting(f, units);
    fApply(f, m);
    if (Object.keys(m.riders).some(id => G.riders[id] && G.riders[id].clubId === G.clubId && m.riders[id].heats)) mine.push(f);
    fAfter(f);
  }
  if (mine.length) fDigest(date, mine);
}
// Skład meczowy: najlepsi dostępni zawodnicy składu (bez startujących tego dnia gdzie indziej); braki – zawodnicy gościnni z kraju ligi
function fLineup(cid, f, used) {
  const c = G.fclubs[cid], L = fLeague(c.league), n = L.teamSize;
  const ok = r => fFree(r, f.d) && !used.has(String(r.id)) && !(r.fl && r.fl.dropped && r.fl.dropped.some(x => x.clubId === cid));
  const own = c.squad.map(id => G.riders[id]).filter(r => ok(r)).sort(by(r => r.skill, -1)).slice(0, n);
  if (own.length < n) {
    const cap = own.length ? own[Math.floor(own.length / 2)].skill : sum(c.squad.map(id => (G.riders[id] || {}).skill || 0)) / Math.max(1, c.squad.length) || 6; // gość nie lepszy od typowego zawodnika składu
    const inLg = new Set(Object.values(G.fclubs).filter(x => x.league === c.league).flatMap(x => x.squad).map(String));
    const guests = Object.values(G.riders).filter(r => (r.country === L.country || r.country === c.country) && ok(r) && !inLg.has(String(r.id)) && r.skill <= cap && !own.includes(r))
      .sort(by(r => r.skill, -1)).slice(0, n - own.length);
    own.push(...guests);
    f.guests = (f.guests || []).concat(guests.map(r => r.id));
  }
  const ids = own.sort(by(r => r.skill, -1)).map(r => r.id);
  while (ids.length < n) ids.push(null);
  return ids;
}
// Tabela biegowa meczu: liga, faza (czwórmecze play-off w Danii), wariant pól (Wielka Brytania – rzut monetą)
function fTableId(f) {
  const L = fLeague(f.lg);
  if (f.st !== 'RS' && f.st !== 'R' && L.playoff && L.playoff.semiTable) return L.playoff.semiTable;
  if (L.table === 'gb-15') return `gb-15-set-${1 + hashStr(G.seed + f.id) % 2}`;
  return L.table;
}
// Mecz według tabeli biegowej: jak tableMeeting (js/heat-runtime.js), z selektorami teamSlot/rank/nomination i miejscami drużyn (Francja)
function fMeeting(f, units) {
  const tid = fTableId(f), t = fTable(tid);
  const codes = t.teamCodes || [...new Set(t.heats.flatMap(h => h.entries.map(e => e.team)).filter(Boolean))].sort();
  const m = { id: `FM${f.id}`, date: f.d, venue: f.venue, track: 350, weather: weatherFor(f.d, G.seed + f.id), heatTableId: tid, heats: [], riders: {}, units: {} };
  const ctx = { startNumbers: {}, teamRiders: {}, rankings: {}, results: {}, nominations: {}, gateChoices: {} };
  const codeUnit = {};
  units.forEach((u, i) => {
    const code = codes[i]; if (!code) return;
    codeUnit[code] = u.cid;
    ctx.teamRiders[code] = u.riders.slice();
    m.units[u.cid] = { key: u.cid, name: fClubName(u.cid), code, riders: u.riders.filter(id => id != null), pts: 0 };
    u.riders.forEach((id, j) => { if (id != null) m.riders[id] = { unit: u.cid, no: j + 1, pts: 0, bonus: 0, heats: 0, line: [], places: {} }; });
    // tabele z numerami startowymi (pary): kolejne numery drużyn
    const per = t.regular || 2;
    u.riders.slice(0, per).forEach((id, j) => { ctx.startNumbers[i * per + j + 1] = id; });
  });
  const rankSlots = t.rankSlots || t.regular || 5;
  const rankAll = () => {
    for (const code of codes) if (ctx.teamRiders[code]) ctx.rankings[code] = heatRank(m, ctx.teamRiders[code].slice(0, rankSlots).filter(id => id != null && m.riders[id] && !m.riders[id].out).map(String));
    const order = Object.values(m.units).sort((a, b) => b.pts - a.pts || hashStr(m.id + a.key) - hashStr(m.id + b.key));
    order.forEach((u, i) => { ctx.rankings[`P${i + 1}`] = ctx.rankings[u.code] || []; codeUnit[`P${i + 1}`] = u.key; });
  };
  const nominatedSet = 1 + hashStr(m.id + ':nom') % 2;
  foreignTrack(m, (units[0] || {}).riders || [], (units[1] || {}).riders || [], units[0] ? units[0].cid : f.venue); // tor gospodarza (js/track.js)
  for (const heat of t.heats) {
    if (heat.entries.some(e => e.participant.type === 'rank' || e.participant.type === 'nomination') && !ctx.ranked) { rankAll(); ctx.ranked = true; }
    if (heat.entries.some(e => e.participant.type === 'nomination')) for (const e of heat.entries) if (e.participant.type === 'nomination') ctx.nominations[e.participant.key] = (ctx.rankings[e.team] || [])[20 - heat.no] ?? (ctx.rankings[e.team] || [])[0];
    const hc = { ...ctx, startNumbers: { ...ctx.startNumbers }, teamRiders: Object.fromEntries(Object.entries(ctx.teamRiders).map(([k, v]) => [k, v.slice()])),
      rankings: Object.fromEntries(Object.entries(ctx.rankings).map(([k, v]) => [k, v.slice()])), nominations: { ...ctx.nominations }, nominatedSet };
    heat.entries.forEach((e, i) => {
      const p = e.participant, empty = `__empty_${heat.no}_${i}`;
      const val = heatResolve(p, hc);
      if (val != null && !(m.riders[val] && m.riders[val].out)) return;
      if (p.type === 'startNumber') hc.startNumbers[p.number] = empty;
      if (p.type === 'teamSlot') (hc.teamRiders[p.team] ||= [])[p.slot - 1] = empty;
      if (p.type === 'rank') (hc.rankings[p.ranking] ||= [])[p.place - 1] = empty;
      if (p.type === 'nomination') hc.nominations[p.key] = empty;
    });
    if (heat.gatePolicy === 'ballot' || heat.gatePolicy === 'rider-choice') {
      const ids = heat.entries.map(e => heatResolve(e.participant, hc));
      hc.gateChoices = { [heat.no]: heat.gatePolicy === 'ballot' ? ids.slice().sort((a, b) => hashStr(m.id + heat.no + a) - hashStr(m.id + heat.no + b)) : ids };
    }
    const resolved = heat.entries.map(e => heatResolve(e.participant, hc));
    if (new Set(resolved.map(String)).size !== 4) { (m.skipped ||= []).push(heat.no); continue; } // zawodnik nominowany dwa razy (za mało zawodników w drużynie) – bieg pominięty
    let entries = SpeedwayHeatAdapter.toRunHeatEntries(FP.heat, tid, heat.no, hc);
    entries = entries.map(e => {
      const unit = codeUnit[e.team] || null, u = unit && m.units[unit];
      const id = typeof e.riderId === 'string' && e.riderId.startsWith('__empty') ? null : e.riderId;
      const live = id != null && m.riders[id] && !m.riders[id].out && fFree(G.riders[id], f.d) ? (isNaN(id) ? id : Number(id)) : null;
      return { ...e, riderId: live, team: unit, helmet: e.helmet || (u ? F_HELMET[u.code] : null) };
    });
    const h = runHeat(entries, { homeClubId: -1, weather: m.weather, track: m.track, mid: m.id, points: t.points, surf: m.surf });
    if (heat.gradingAfter && heat !== t.heats[t.heats.length - 1]) h.log.push(trackBreakNote(m, null, false)); // przerwa techniczna
    h.res.forEach(x => {
      const s = m.riders[x.riderId]; if (!s) return;
      s.pts += x.pts; s.bonus += x.bonus; s.heats++; s.line.push(x.status || `${x.pts}${x.bonus ? '*' : ''}`);
      if (x.pos) s.places[x.pos] = (s.places[x.pos] || 0) + 1;
      m.units[s.unit].pts += x.pts;
    });
    for (const id of h.injuries) if (m.riders[id]) m.riders[id].out = true;
    m.injuries = (m.injuries || []).concat(h.injuries);
    ctx.results[heat.no] = h.res.map(x => x.riderId);
    m.heats.push({ no: heat.no, phase: heat.phase, label: `${heat.phase === 'nominated' ? 'Bieg nominowany' : heat.phase === 'final' ? 'Finał' : 'Bieg'} ${heat.no}`, entries: entries.map(e => ({ riderId: e.riderId, gate: e.gate, helmet: e.helmet, team: e.team })), res: h.res, time: h.time, log: h.log });
  }
  m.classification = Object.values(m.units).sort((a, b) => b.pts - a.pts || fWins(m, b.key) - fWins(m, a.key) || hashStr(m.id + a.key) - hashStr(m.id + b.key)).map((u, i) => ({ key: u.key, place: i + 1, pts: u.pts }));
  return m;
}
const fWins = (m, cid) => sum(Object.values(m.riders).filter(s => s.unit === cid).map(s => s.places[1] || 0));
// Skutki meczu: statystyki zawodnika w lidze, forma, kondycja, sprzęt, rytm startów, kontuzje; zapis wyniku
function fApply(f, m) {
  const L = fLeague(f.lg), mineMatch = Object.keys(m.riders).some(id => G.riders[id] && G.riders[id].clubId === G.clubId);
  for (const [rid, s] of Object.entries(m.riders)) {
    const r = G.riders[rid]; if (!r || !s.heats) continue;
    const st = ((r.fstats ||= {})[f.season] ||= {})[f.lg] ||= { m: 0, h: 0, p: 0, b: 0 };
    st.m++; st.h += s.heats; st.p += s.pts; st.b = (st.b || 0) + s.bonus;
    const avg = (s.pts + s.bonus) / s.heats, lvl = clamp(1.2 + (r.skill - 8) * 0.12, 0.4, 2.6);
    r.form = clamp(r.form * 0.92 + (avg - lvl) * 0.1, -2, 2);
    r.cond = clamp(r.cond - s.heats * (2.2 - (r.attrs.stamina ?? 10) * 0.05), 30, 100);
    if (typeof foreignEquipWear === 'function') foreignEquipWear(r, s.heats);
    logStart(r, f.d, s.heats, 'zagranica');
    // ostatnie mecze (forma): także starty za granicą, z ligą i rywalem
    const opp = f.units.length === 2 ? fClubShort(f.units.find(u => u !== s.unit)) : `${f.units.length} druż.`;
    r.lastMatches = [{ date: f.d, fid: f.id, lg: f.lg, team: fClubShort(s.unit), opp, pts: s.pts, bonus: s.bonus, heats: s.heats, line: s.line.join(',') }, ...(r.lastMatches || [])].sort(by(x => x.date, -1)).slice(0, 10);
  }
  for (const id of new Set(m.injuries || [])) { const r = G.riders[id]; if (r) injureRider(r, f.d, `${L.name}: ${fLabel(f)}`, { kind: 'foreign' }); }
  f.played = true;
  f.res = { skipped: m.skipped || undefined, tableId: m.heatTableId, weather: m.weather, pts: Object.fromEntries(Object.values(m.units).map(u => [u.key, u.pts])), cls: m.classification.map(x => x.key),
    riders: Object.fromEntries(Object.entries(m.riders).map(([id, s]) => [id, { u: s.unit, no: s.no, pts: s.pts, bonus: s.bonus, heats: s.heats, line: s.line }])),
    heats: m.heats.map(h => ({ ...h, log: mineMatch ? h.log : [] })) };
  for (const r of Object.values(G.riders)) if (r.fx) { const e = r.fx.list.find(x => x.fid === f.id); if (e) e.done = true; }
}
function fDigest(date, list) {
  const rows = [];
  for (const f of list) for (const [id, s] of Object.entries(f.res.riders)) { const r = G.riders[id]; if (r && r.clubId === G.clubId && s.heats) rows.push(`<li><a href="#/zawodnik/${r.id}">${esc(r.name)}</a> – ${s.pts}${s.bonus ? `+${s.bonus}` : ''} pkt w ${s.heats} ${plural(s.heats, 'biegu', 'biegach', 'biegach')} (${esc(fLeague(f.lg).name)}: <a href="#/zagranica/mecz/${f.id}">${esc(fLabel(f))}</a>, ${esc(fClubShort(s.u))})</li>`); }
  if (rows.length) addMsg({ category: 'drużyna', from: 'Dział sportowy', title: `Ligi zagraniczne ${fmtDateShort(date)}: nasi zawodnicy (${rows.length})`, body: `<ul>${rows.join('')}</ul>`, link: '#/zagranica' });
}

// ---------- Tabele ----------
let FST_CACHE = new Map();
function fStandings(lg, season = G.season) {
  const played = Object.values(G.ffix).filter(f => f.lg === lg && f.season === season && (f.st === 'RS' || f.st === 'R'));
  const key = `${lg}|${season}|${played.filter(f => f.played).length}`;
  if (FST_CACHE.has(key)) return FST_CACHE.get(key);
  const L = fLeague(lg), rows = {};
  const row = cid => rows[cid] ||= { cid, m: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, bp: 0, tp: 0, pl: {} };
  for (const cid of Object.values(G.fclubs).filter(c => c.league === lg).map(c => c.id)) row(cid);
  for (const f of played) {
    if (!f.played || f.cancelled || !f.res) continue;
    if (L.kind === 'two') {
      const [h, a] = f.units, ph = f.res.pts[h] || 0, pa = f.res.pts[a] || 0;
      for (const [x, y, px, py] of [[h, a, ph, pa], [a, h, pa, ph]]) { const R0 = row(x); R0.m++; R0.pf += px; R0.pa += py; if (px > py) { R0.w++; R0.tp += L.points.win; } else if (px === py) { R0.d++; R0.tp += L.points.draw; } else R0.l++; }
    } else {
      f.res.cls.forEach((cid, i) => { const R0 = row(cid); R0.m++; R0.pf += f.res.pts[cid] || 0; R0.tp += (L.meetingPoints[i] ?? 0); R0.pl[i + 1] = (R0.pl[i + 1] || 0) + 1; });
    }
  }
  // punkt bonusowy za dwumecz (Wielka Brytania, Szwecja, 1. Bundesliga)
  if (L.kind === 'two' && L.points.aggregate) {
    const pairs = new Map();
    for (const f of played) if (f.played && f.res && !f.cancelled) { const k = f.units.slice().sort().join('|'); if (!pairs.has(k)) pairs.set(k, []); pairs.get(k).push(f); }
    for (const fs of pairs.values()) for (let i = 0; i + 1 < fs.length; i += 2) {
      const [x, y] = fs[i].units, sx = (fs[i].res.pts[x] || 0) + (fs[i + 1].res.pts[x] || 0), sy = (fs[i].res.pts[y] || 0) + (fs[i + 1].res.pts[y] || 0);
      if (sx !== sy) { const w = sx > sy ? x : y; row(w).bp += L.points.aggregate; row(w).tp += L.points.aggregate; }
    }
  }
  const out = Object.values(rows).sort((a, b) => b.tp - a.tp || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.cid.localeCompare(b.cid));
  FST_CACHE.set(key, out);
  return out;
}

// ---------- Play-off ----------
// Termin play-off z kalendarza ligi: zaległe mecze rundy zasadniczej przypadające po jego starcie nie są rozgrywane (tabela na dzień startu)
function fPlayoffDeadline(date) {
  for (const [season, S] of Object.entries(G.fseasons || {})) for (const [lg, po] of Object.entries(S.po || {})) {
    const first = [...(po.QF || []), ...(po.SF || []), ...(po.F || [])].sort()[0];
    if (!first || date < addDays(first, -2) || ((S.state || {})[lg] || {}).cut) continue;
    ((S.state ||= {})[lg] ||= {}).cut = true;
    const left = Object.values(G.ffix).filter(f => f.lg === lg && f.season === Number(season) && (f.st === 'RS' || f.st === 'R') && !f.played && !f.skip);
    for (const f of left) { f.skip = true; f.void = true; }
    const any = Object.values(G.ffix).find(f => f.lg === lg && f.season === Number(season));
    if (any) fAfter(any);
  }
}
function fAfter(f) {
  FST_CACHE = new Map();
  if (fIsCup(f.lg)) { fCupStep(f.lg, f.season); return; }
  const L = fLeague(f.lg), S = G.fseasons[f.season];
  if (!S) return;
  const reg = Object.values(G.ffix).filter(x => x.lg === f.lg && x.season === f.season && (x.st === 'RS' || x.st === 'R'));
  const done = reg.every(x => x.played || x.skip);
  if (!done) return;
  const st = S.state ||= {}, ls = st[f.lg] ||= {};
  const table = fStandings(f.lg, f.season).map(r => r.cid);
  const P = L.playoff;
  if (!P) { if (!ls.done) { ls.done = true; fChampion(f.lg, f.season, table[0], table); } return; }
  const dates = (S.po[f.lg] || {});
  const after = (k, n) => { const ds = dates[k] && dates[k].length ? dates[k].filter(d => d > G.date) : []; while (ds.length < n) ds.push(addDays(ds.length ? ds[ds.length - 1] : G.date, 4)); return ds.slice(0, n); };
  const mk = (st2, tie, leg, d, units) => { const id = `F${f.season}-${f.lg}-${st2}${tie}-${leg}`; if (!G.ffix[id]) G.ffix[id] = { id, season: f.season, lg: f.lg, st: st2, tie, leg, d, units, venue: G.fclubs[units[0]].city, played: false }; };
  const ties = st2 => { const out = {}; for (const x of Object.values(G.ffix).filter(y => y.lg === f.lg && y.season === f.season && y.st === st2)) (out[x.tie] ||= []).push(x); return out; };
  const tieWinner = list => { const [a, b] = list[0].units, s = id => sum(list.map(x => (x.res && x.res.pts[id]) || 0)); return s(a) === s(b) ? (table.indexOf(a) < table.indexOf(b) ? a : b) : s(a) > s(b) ? a : b; };
  const allDone = st2 => Object.values(G.ffix).filter(y => y.lg === f.lg && y.season === f.season && y.st === st2).every(y => y.played);
  if (P.dk || P.dkDiv) { // Dania: półfinał (miejsca 3–6) i finał (1–2 + dwie najlepsze drużyny półfinału) – czwórmecze
    if (!ls.sf) { ls.sf = true; mk('SF', 1, 1, after('SF', 1)[0], [table[2], table[3], table[4], table[5]].filter(Boolean)); return; }
    if (!ls.f && allDone('SF')) { const sf = ties('SF')[1][0]; ls.f = true; mk('F', 1, 1, after('F', 1)[0], [table[0], table[1], ...(sf.res ? sf.res.cls.slice(0, 2) : [])].filter(Boolean)); return; }
    if (ls.f && !ls.done && allDone('F')) { const fin = ties('F')[1][0]; ls.done = true; fChampion(f.lg, f.season, fin.res.cls[0], [...fin.res.cls, ...table.filter(c => !fin.res.cls.includes(c))]); }
    return;
  }
  const legs = P.legs || 2, twoLeg = (stg, tie, a, b) => { const ds = after(stg, legs); mk(stg, tie, 1, ds[0], [b, a]); if (legs > 1) mk(stg, tie, 2, ds[1] > ds[0] ? ds[1] : addDays(ds[0], 7), [a, b]); };
  if (P.quarter) { // Szwecja: 1–6, 2–5, 3–4; do półfinału zwycięzcy i najlepszy przegrany (suma punktów dwumeczu)
    if (!ls.qf) { ls.qf = true; [[0, 5], [1, 4], [2, 3]].forEach(([a, b], i) => twoLeg('QF', i + 1, table[a], table[b])); return; }
    if (!ls.sf && allDone('QF')) {
      const T = Object.values(ties('QF')), win = T.map(tieWinner), lose = T.map((l, i) => l[0].units.find(u => u !== win[i]));
      const score = id => sum(T.flat().map(x => (x.res && x.res.pts[id]) || 0));
      const four = [...win, lose.sort(by(score, -1))[0]].sort(by(id => table.indexOf(id)));
      ls.sf = true; twoLeg('SF', 1, four[0], four[3]); twoLeg('SF', 2, four[1], four[2]); return;
    }
  } else if (!ls.sf && P.top >= 4) { ls.sf = true; (P.pairs || [[1, 4], [2, 3]]).forEach(([a, b], i) => twoLeg('SF', i + 1, table[a - 1], table[b - 1])); return; }
  else if (!ls.f && P.top === 2) { ls.f = true; ls.sf = true; twoLeg('F', 1, table[0], table[1]); return; }
  if (ls.sf && !ls.f && allDone('SF')) { const T = Object.values(ties('SF')), w = T.map(tieWinner).sort(by(id => table.indexOf(id))); ls.f = true; twoLeg('F', 1, w[0], w[1]); return; }
  if (ls.f && !ls.done && allDone('F')) { const T = ties('F')[1], w = tieWinner(T), lo = T[0].units.find(u => u !== w); ls.done = true; fChampion(f.lg, f.season, w, [w, lo, ...table.filter(c => c !== w && c !== lo)]); }
}
function fChampion(lg, season, cid, order) {
  const S = G.fseasons[season]; S.champions[lg] = cid;
  order.forEach((id, i) => { const c = G.fclubs[id]; if (c && !c.hist.some(h => h.season === season)) c.hist.push({ season, pos: i + 1 }); });
  const mine = G.fclubs[cid].squad.filter(id => G.riders[id] && G.riders[id].clubId === G.clubId);
  addMsg({ category: 'liga', from: fLeague(lg).full, title: `${fLeague(lg).name} ${season}: mistrzem ${fClubName(cid)}`, body: `<p>Mistrzem ${esc(fLeague(lg).full)} w sezonie ${season} została drużyna <b>${esc(fClubName(cid))}</b>.</p>${mine.length ? `<p>W składzie nasi zawodnicy: ${mine.map(id => `<a href="#/zawodnik/${id}">${esc(G.riders[id].name)}</a>`).join(', ')}.</p>` : ''}`, link: `#/zagranica/${lg}` });
}

// ---------- Puchary (Wielka Brytania): grupy i drabinka dwumeczów ----------
// Sloty par: klub, W:<runda>-<para> (zwycięzca dwumeczu), G1:<grupa> (zwycięzca grupy), GW1–GW3 (zwycięzcy grup wg punktów), BR (najlepszy z drugich)
function fCupGroupTable(cup, grp, season) {
  const K = FP.cups[cup], rows = Object.fromEntries((K.groups[grp] || []).map(cid => [cid, { cid, m: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, tp: 0 }]));
  for (const f of Object.values(G.ffix)) {
    if (f.lg !== cup || f.season !== season || f.st !== 'G' || f.grp !== grp || !f.played || f.cancelled || !f.res) continue;
    const [h, a] = f.units, ph = f.res.pts[h] || 0, pa = f.res.pts[a] || 0;
    for (const [x, px, py] of [[h, ph, pa], [a, pa, ph]]) { const R0 = rows[x]; if (!R0) continue; R0.m++; R0.pf += px; R0.pa += py; if (px > py) { R0.w++; R0.tp += 2; } else if (px === py) { R0.d++; R0.tp += 1; } else R0.l++; }
  }
  return Object.values(rows).sort((a, b) => b.tp - a.tp || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.cid.localeCompare(b.cid));
}
function fCupGroupsDone(cup, season) { return Object.values(G.ffix).filter(f => f.lg === cup && f.season === season && f.st === 'G').every(f => f.played || f.skip); }
function fCupTie(cup, season, st, tie) { return Object.values(G.ffix).filter(f => f.lg === cup && f.season === season && f.st === st && f.tie === tie).sort(by(f => f.leg)); }
function fCupTieWinner(list) {
  if (list.length < 2 || list.some(f => !f.played)) return null;
  const [a, b] = list[0].units, sc = id => sum(list.map(x => (x.res && x.res.pts[id]) || 0));
  if (sc(a) !== sc(b)) return sc(a) > sc(b) ? a : b;
  return hrand(G.seed + list[0].id) < 0.5 ? a : b; // remis w dwumeczu: wyścig dodatkowy (losowo)
}
function fCupSlot(cup, season, slot) {
  if (G.fclubs[slot]) return slot;
  const K = FP.cups[cup], w = slot.match(/^W:(\w+)-(\d+)$/);
  if (w) return fCupTieWinner(fCupTie(cup, season, w[1], Number(w[2])));
  if (!fCupGroupsDone(cup, season)) return null;
  const g = slot.match(/^G(\d):(\w+)$/);
  if (g) return (fCupGroupTable(cup, g[2], season)[Number(g[1]) - 1] || {}).cid || null;
  const tabs = Object.keys(K.groups).map(grp => fCupGroupTable(cup, grp, season));
  const key = r => r.tp * 1000 + (r.pf - r.pa);
  if (/^GW\d$/.test(slot)) return (tabs.map(t => t[0]).filter(Boolean).sort(by(key, -1))[Number(slot[2]) - 1] || {}).cid || null;
  if (slot === 'BR') return (tabs.map(t => t[1]).filter(Boolean).sort(by(key, -1))[0] || {}).cid || null;
  return null;
}
function fCupStep(cup, season) {
  const K = FP.cups[cup], S = G.fseasons[season];
  if (!K || !S) return;
  const cs = (S.cups ||= {})[cup] ||= {}, sh = fShift(season);
  // mecze grupowe (pary znane z terminarza)
  if (!cs.groups) {
    cs.groups = true;
    for (const g of K.group || []) { const id = `F${season}-${g.id}`, d = addDays(g.d, sh); if (!G.ffix[id]) G.ffix[id] = { id, season, lg: cup, st: 'G', grp: g.grp, d, units: g.units.filter(u => G.fclubs[u]), venue: (G.fclubs[g.units[0]] || {}).city || '', played: false, skip: d < G.date || undefined }; }
  }
  // dwumecze: tworzone, gdy znane są obie drużyny
  for (const t of K.ties) {
    if (fCupTie(cup, season, t.st, t.tie).length) continue;
    const units = t.slots.map(x => fCupSlot(cup, season, x));
    if (units.some(u => !u)) continue;
    t.legs.forEach((l, i) => {
      let d = addDays(l.d, sh); if (d <= G.date) d = addDays(G.date, 2 + i * 3);
      const home = units[l.home] || units[i % 2], away = units.find(u => u !== home);
      const id = `F${season}-${cup}-${t.st}${t.tie}-${i + 1}`;
      G.ffix[id] = { id, season, lg: cup, st: t.st, tie: t.tie, leg: i + 1, d, units: [home, away], venue: G.fclubs[home].city, played: false, approx: !!l.approx };
      fPlanFixture(G.ffix[id]);
    });
    if (typeof FFX_IDX !== 'undefined') FFX_IDX.key = null;
  }
  // zdobywca pucharu
  const fin = K.ties.find(t => t.st === 'F');
  const w = fin && !cs.done ? fCupTieWinner(fCupTie(cup, season, 'F', fin.tie)) : null;
  if (w) {
    cs.done = true; S.champions[cup] = w;
    const mine = G.fclubs[w].squad.filter(id => G.riders[id] && G.riders[id].clubId === G.clubId);
    addMsg({ category: 'liga', from: K.full, title: `${K.name} ${season}: wygrywa ${fClubName(w)}`, body: `<p>${esc(K.full)} ${season}: zwycięża <b>${esc(fClubName(w))}</b>.</p>${mine.length ? `<p>W składzie zwycięzców: ${mine.map(id => esc(G.riders[id].name)).join(', ')}.</p>` : ''}`, link: `#/zagranica/${cup}` });
  }
}
// Plan startów dla nowego meczu (puchary – pary znane dopiero po wcześniejszych rundach)
function fPlanFixture(f) {
  const g = fGeo(f), vn = fLabel(f);
  for (const cid of f.units) for (const id of fExpected(cid)) {
    const r = G.riders[id]; if (!r) continue;
    const fx = r.fx && r.fx.season === f.season ? r.fx : (r.fx = { season: f.season, list: [] });
    if (!fx.list.some(e => e.fid === f.id)) { fx.list.push({ d: f.d, lg: f.lg, vn, g, fid: f.id, done: false }); fx.list.sort(by(e => e.d)); }
  }
}

// ---------- Mistrzostwa krajowe (indywidualne i juniorskie) ----------
const F_KIND = { ind: { lab: '', age: null }, u21: { lab: 'U21', age: 21 }, u19: { lab: 'U19', age: 19 }, u23: { lab: 'U23', age: 23 }, meet: { lab: '', age: null }, inv: { lab: '', age: null },
  pairs: { lab: 'pary', age: null }, youth: { lab: 'młodzież', age: null }, info: { lab: '', age: null } };
// klucz rozgrywek: mistrzostwa – N_<kraj>[_<kategoria>]; turnieje, pary, młodzież – z nazwy (kilka imprez w kraju)
const fChampKey = ch => ['ind', 'u21', 'u19', 'u23'].includes(ch.kind) ? `N_${ch.cc}${ch.kind === 'ind' ? '' : '_' + ch.kind.toUpperCase()}`
  : `N_${ch.cc}_${ch.kind.toUpperCase()}_${hashStr(ch.name).toString(36).slice(0, 5)}`;
// rodzaj imprezy w kalendarzu: mistrzostwa indywidualne, turniej, pary/drużyny, młodzież, informacja
const F_TYPE = { ind: 'ind', u21: 'ind', u19: 'ind', u23: 'ind', meet: 'turniej', inv: 'turniej', pairs: 'pary', youth: 'mlodziez', info: 'info' };
if (FP) {
  COMP_GROUPS.push(['kraje', 'Mistrzostwa krajowe (za granicą)']);
  for (const ch of FP.champs) {
    const key = fChampKey(ch), staged = ch.rounds.some(r => /półfinał|kwalifikacje/.test(r.stage || '')) && ch.kind !== 'youth';
    if (ch.kind === 'pairs') {
      COMPS[key] = { name: ch.name, short: `${ch.cc} pary`, group: 'kraje', format: 'pairs', field: `fpairs:${(ch.lgs || []).join(',')}`, cc: ch.cc, fType: 'pary',
        age: ch.age || null, nations: ch.nations || null, snake: !!ch.snake, src: ch.src };
      SPEEDWAY_HEAT_TABLES.competitionMappings[key] = { status: 'select-by-stage-and-team-count', byTeams: { 5: 'pairs-5-pzm', 6: 'pairs-6-pzm', 7: 'pairs-7-pzm' }, note: 'program par PZM (art. 827) – format uproszczony' };
      continue;
    }
    if (ch.kind === 'youth') { // klasy młodzieżowe: adepci kraju (fKidsField)
      COMPS[key] = { name: ch.name, short: `${ch.cc} ${ch.cls || 'młodzież'}`, group: 'kraje', format: 'ind', field: `fkids:${ch.cc}:${fYouthCats(ch.cls).join(',')}`, cc: ch.cc, fType: 'mlodziez', cls: ch.cls || null, series: !!ch.series, src: ch.src };
      SPEEDWAY_HEAT_TABLES.competitionMappings[key] = { tableId: 'individual-16-20', status: 'verified', note: 'format uproszczony: do 16 zawodników, 20 biegów' };
      continue;
    }
    COMPS[key] = { name: ch.name, short: `${ch.cc}${F_KIND[ch.kind].lab ? ' ' + F_KIND[ch.kind].lab : ''}`, group: 'kraje', format: 'ind', cc: ch.cc, fType: F_TYPE[ch.kind] || 'ind',
      field: `nat:${ch.cc}:${ch.kind}:${ch.open || ch.kind === 'meet' ? 'open' : ''}:${(ch.lgs || []).join(',')}:${ch.age || ''}:${ch.top ? 'top' : ''}:${ch.winter ? 'winter' : ''}`, series: !!ch.series, src: ch.src, approx: !!ch.approx };
    SPEEDWAY_HEAT_TABLES.competitionMappings[key] = { tableId: 'individual-16-20', status: 'verified', note: 'format uproszczony: 16 zawodników, 20 biegów' };
    if (staged) {
      COMPS[key + 'Q'] = { ...COMPS[key], name: `${ch.name} – eliminacje`, short: `${COMPS[key].short} el.`, series: false };
      SPEEDWAY_HEAT_TABLES.competitionMappings[key + 'Q'] = SPEEDWAY_HEAT_TABLES.competitionMappings[key];
      QUALIFY[key] = { from: key + 'Q', top: 8, label: 'awans z eliminacji' };
    }
    if (ch.series) FIXED_FIELD.add(key);
  }
}
// klasy adeptów z opisu klasy zawodów (np. „85–250”, „250/500R”, „125–500”: zakres – wszystkie klasy pomiędzy)
function fYouthCats(cls) {
  const s = String(cls || ''), order = ['c50', 'c85', 'c250', 'c500'];
  const hit = [/(^|\D)50(\D|$)/.test(s), /85|125|140|150|190/.test(s), /250/.test(s), /500/.test(s)];
  let idx = hit.map((h, i) => (h ? i : -1)).filter(i => i >= 0);
  if (!idx.length) idx = [1, 2];
  if (/–/.test(s)) idx = order.map((_, i) => i).filter(i => i >= idx[0] && i <= idx[idx.length - 1]);
  return idx.map(i => order[i]);
}
const F_CHAMPS_VER = 4; // 2: turnieje, pary, młodzież i zawody zimowe; 3: młodzież i drużynowe rozgrywane (październik 2026); 4: „rundy 1–2” przy dwóch rundach jednego dnia
function makeForeignChampEvents(season) {
  if (!FP || !G) return false;
  G.fchampsMade = G.fchampsMade || {};
  if (G.fchampsMade[season] === F_CHAMPS_VER) return false;
  G.fchampsMade[season] = F_CHAMPS_VER;
  // wpisy informacyjne (młodzież, drużynowe) z wcześniejszych wersji – zastąpione zawodami rozgrywanymi
  for (const e of Object.values(G.events)) if (e.foreign && e.kind === 'mini-info' && e.season === season && !e.played) delete G.events[e.id];
  const sh = fShift(season);
  for (const ch of FP.champs) {
    const key = fChampKey(ch), n = ch.rounds.length;
    ch.rounds.forEach((r, i) => {
      const d = addDays(r.d, sh);
      if (d < G.date || (i > 0 && ch.rounds[i - 1].d === r.d)) return; // dwie rundy jednego dnia (Australia) – jedne zawody
      const q = /półfinał|kwalifikacje/.test(r.stage || '') && !!COMPS[key + 'Q']; // młodzież: kwalifikacje jako zwykła runda
      const id = `N${season}-${key}-${i + 1}`;
      let j = i; while (j + 1 < n && ch.rounds[j + 1].d === r.d) j++; // kolejne rundy tego samego dnia: „rundy 1–2”
      const name = `${ch.name}${r.stage ? ` – ${r.stage}` : n > 1 ? (j > i ? ` – rundy ${i + 1}–${j + 1}` : ` – runda ${i + 1}`) : ''}`;
      if (G.events[id]) { if (!G.events[id].played) G.events[id].name = name; return; }
      G.events[id] = { id, kind: 'comp', comp: q ? key + 'Q' : key, season, date: d, venue: r.venue || COUNTRY[ch.cc] || ch.cc, played: false,
        name, round: ch.series ? i + 1 : null, of: ch.series ? n : null, stage: r.stage === 'finał' ? 'finał' : q ? 'eliminacje' : null, cc: ch.cc, ...(ch.kind === 'youth' && ch.cls ? { cls: ch.cls } : {}) };
    });
  }
  return true;
}
// Sąsiedzi zapraszani na mistrzostwa otwarte krajów bez własnej ligi (Słowenia, Włochy, Łotwa, Ukraina, USA)
const F_NEAR = { NED: ['GER', 'BEL', 'DEN'], NZL: ['AUS', 'GBR'], SLO: ['CRO', 'AUT', 'HUN', 'ITA', 'CZE'], ITA: ['SLO', 'AUT', 'CRO'], LAT: ['EST', 'UKR', 'POL', 'FIN'], UKR: ['POL', 'LAT'] };
// Obsada mistrzostw kraju: zawodnicy z krajem macierzystym (wiek dla juniorów); otwarte – uzupełniają goście jeżdżący w ligach tego kraju
function natField(ev, P, capacity) {
  const [, cc, kind, open, lgsS, ageS, topS, winter] = compOf(ev).field.split(':');
  const lim = ageS ? Number(ageS) : F_KIND[kind] ? F_KIND[kind].age : null, s = ev.season;
  if (kind === 'meet' || kind === 'inv' || winter) return fOpenField(ev, cc, kind, (lgsS || '').split(',').filter(Boolean), lim, !!topS, !!winter, capacity);
  const busy = ev.id ? busyOn(ev.date, ev.id) : new Set();
  // zawodnik polskiego klubu bez zgody na zimowe starty w tym kraju (js/planner.js) – nie jedzie
  const refused = r => r.winter && r.winter.status === 'no' && typeof WINTER_SERIES !== 'undefined' && (WINTER_SERIES[r.winter.ser] || {}).geo && WINTER_SERIES[r.winter.ser].geo[2] === cc;
  const pool = Object.values(G.riders).filter(r => fFree(r, ev.date) && !busy.has(String(r.id)) && ageOkFor(ev, r.id) && (!lim || ageIn(r, s) <= lim) && !refused(r) && !fOverseasBusy(r, cc, ev.date)).sort(by(r => r.skill, -1));
  const home = pool.filter(r => r.country === cc);
  const top = home.length ? home[0].skill : 99, near = F_NEAR[cc] || [];
  const guests = open || home.length < 8 ? pool.filter(r => r.country !== cc && ((r.fl && r.fl.list.some(x => fLeague(x.id).country === cc)) || near.includes(r.country)) && r.skill <= top).slice(0, open ? 6 : capacity) : [];
  return take(home, capacity, guests);
}

// Zawody za oceanem (USA) w sezonie europejskim (marzec–październik): zawodnicy z kontraktem w klubie polskim albo w lidze europejskiej
// nie przylatują (np. Luke Becker – w rzeczywistości mistrzostwa AMA i turnieje w Kalifornii obsadzają zawodnicy jeżdżący w USA)
const F_OVERSEAS = { USA: 1 };
const fOverseasBusy = (r, cc, date) => !!F_OVERSEAS[cc] && +date.slice(5, 7) >= 3 && +date.slice(5, 7) <= 10 && !!(r.clubId || (r.fl && r.fl.list.length));
// Turniej krajowy (meet): zawodnicy kraju i jeżdżący w jego ligach; zaproszeniowy (inv): mocna obsada międzynarodowa, gospodarze
// najpierw (Złoty Kask – czołówka świata); zima (Argentyna): miejscowi i zawodnicy ze zgodą klubu na starty zimą w tym kraju (js/planner.js)
function fOpenField(ev, cc, kind, lgs, lim, top, winter, capacity) {
  const busy = ev.id ? busyOn(ev.date, ev.id) : new Set(), s = ev.season;
  const pool = Object.values(G.riders).filter(r => fFree(r, ev.date) && !busy.has(String(r.id)) && ageOkFor(ev, r.id) && (!lim || ageIn(r, s) <= lim) && !fOverseasBusy(r, cc, ev.date)).sort(by(r => r.skill, -1));
  const rr = mulberry(hashStr(ev.id + G.seed));
  const wint = r => winter && r.winter && r.winter.status === 'ok' && typeof WINTER_SERIES !== 'undefined' && WINTER_SERIES[r.winter.ser] && WINTER_SERIES[r.winter.ser].geo[2] === cc && ev.date >= (r.winter.from || '') && ev.date <= (r.winter.to || '');
  const inLg = r => lgs.length && r.fl && r.fl.list.some(x => lgs.includes(x.id) || (fLeague(x.id) && lgs.includes(x.id)));
  if (kind === 'inv') {
    const home = pool.filter(r => r.country === cc).slice(0, 3);
    const sgp = new Set(G.sgp ? G.sgp.riders : []);
    const intl = pool.filter(r => !home.includes(r) && (top || !sgp.has(r.id))).slice(top ? 0 : 6, top ? 40 : 90).map(r => ({ r, k: r.skill + rr() * (top ? 1.5 : 3) })).sort(by(x => x.k, -1)).map(x => x.r);
    const per = {}, list = [...home];
    for (const r of intl) { if (list.length >= capacity) break; if ((per[r.country] = (per[r.country] || 0) + 1) <= (top ? 4 : 2)) list.push(r); }
    return take(list, capacity, pool);
  }
  const home = pool.filter(r => r.country === cc || inLg(r) || wint(r));
  const guests = pool.filter(r => !home.includes(r) && ((r.fl && r.fl.list.some(x => (fLeague(x.id) || {}).country === cc)) || (F_NEAR[cc] || []).includes(r.country)));
  // turniej ligowy: mieszanka czołówki i średniaków (zaproszenia organizatora), nie zawsze najlepsi
  const mix = home.map(r => ({ r, k: r.skill + rr() * 2.5 + (r.country === cc ? 0.8 : 0) + (wint(r) ? 2 : 0) })).sort(by(x => x.k, -1)).map(x => x.r);
  return take(mix, capacity, guests);
}
// Pary klubowe lig zagranicznych: kluby z jednego miasta razem (np. Pardubice), najmocniejsze pary
function fPairUnits(ev, P, size) {
  const C = compOf(ev), lgs = C.field.slice(7).split(',');
  const ageOk = r => !C.age || ageIn(r, ev.season) <= C.age;
  // reprezentacje krajów (np. Puchar Wielkanocny w Debreczynie)
  if (C.nations) return C.nations.map(cc => { const rs = P.filter(r => r.country === cc && fFree(r, ev.date)).slice(0, size); return { key: cc, name: COUNTRY[cc] || cc, country: cc, riders: rs.map(r => r.id), str: sum(rs.map(r => r.skill)) }; })
    .filter(u => u.riders.length >= 2).slice(0, 7);
  // pary dobrane z zawodników kraju bez klubów w grze (Finlandia): najlepszy z najsłabszym z czołówki
  if (C.snake) {
    const rs = P.filter(r => r.country === C.cc && fFree(r, ev.date) && ageOk(r)), n = Math.min(7, Math.floor(rs.length / 2));
    return Array.from({ length: n }, (_, i) => { const a = rs[i], b = rs[2 * n - 1 - i], nm = x => x.name.split(' ').slice(-1)[0];
      return { key: `P${i + 1}`, name: `${nm(a)} / ${nm(b)}`, country: C.cc, riders: [a.id, b.id], str: a.skill + b.skill }; });
  }
  const ok = new Set(P.filter(ageOk).map(r => String(r.id))), by_city = {};
  for (const c of Object.values(G.fclubs).filter(x => lgs.includes(x.league))) (by_city[c.city] ||= []).push(c);
  // zawodnik jeździ tylko w jednej parze: kluby wyższej ligi wybierają pierwsze
  const used = new Set();
  return Object.values(by_city).map(cs => cs.sort(by(x => fLeague(x.league).tier))).sort(by(cs => fLeague(cs[0].league).tier)).map(cs => {
    const c = cs[0];
    const rs = [...new Set(cs.flatMap(x => x.squad))].map(id => G.riders[id]).filter(r => r && !used.has(r.id) && ok.has(String(r.id)) && fFree(r, ev.date)).sort(by(r => r.skill, -1)).slice(0, size);
    rs.forEach(r => used.add(r.id));
    return { key: c.short, name: c.name.replace(/\s+(II|B|Junior)$/, ''), country: c.country, riders: rs.map(r => r.id), str: sum(rs.slice(0, 2).map(r => r.skill)) };
  }).filter(u => u.riders.length >= 2);
}

// Zawody młodzieżowe: adepci kraju w klasach zawodów (prawdziwe nazwiska ze startów 2026 – fAddPeople); przy małej obsadzie
// goście z sąsiednich krajów (np. Szwedzi w duńskich pucharach), potem sąsiednie klasy tego kraju
const F_YNEAR = { DEN: ['SWE', 'GER'], SWE: ['DEN', 'NOR', 'FIN'], GBR: [], CZE: ['SVK', 'GER'], AUS: ['NZL'] };
const F_YORD = ['c50', 'c85', 'c250', 'c500'];
function fKidsField(ev, capacity) {
  const [, cc, catsS] = compOf(ev).field.split(':'), cats = catsS.split(',');
  const busy = ev.id ? busyOn(ev.date, ev.id) : new Set(), rr = mulberry(hashStr(ev.id + G.seed));
  const pool = cs => kids(cs).filter(k => !busy.has(String(k.id))).map(k => ({ id: k.id, country: k.country || 'POL', k: (k.ca ?? 0) + rr() * 6 })).sort(by(x => x.k, -1));
  const own = pool(cats).filter(x => x.country === cc);
  if (own.length >= 8) return take(own, capacity);
  const near = F_YNEAR[cc] || F_NEAR[cc] || [];
  const adj = F_YORD.filter(c => !cats.includes(c) && cats.some(x => Math.abs(F_YORD.indexOf(x) - F_YORD.indexOf(c)) === 1));
  return take(own, capacity, [...pool(cats).filter(x => near.includes(x.country)).slice(0, 6), ...pool(adj).filter(x => x.country === cc)]);
}

// ---------- Migracja zapisu ----------
function foreignMigrate() {
  if (!FP || !G) return false;
  FFX_IDX = { key: null, map: new Map() }; FST_CACHE = new Map(); F_NAMES = null;
  let ch = ensureForeignModel();
  if (makeForeignChampEvents(sportSeason())) ch = true;
  // puchary w zapisach sprzed ich dodania
  for (const [season, S] of Object.entries(G.fseasons || {})) if (Number(season) >= G.season && !S.cups) { S.cups = {}; for (const cup of Object.keys(FP.cups || {})) fCupStep(cup, Number(season)); ch = true; }
  if (G.flSeason !== G.season && ensureForeignSeason(G.season)) ch = true;
  return ch;
}
