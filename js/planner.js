'use strict';
// Planer treningu klubu gracza (etap 3 modułu treningu) i zimowe starty za granicą.
//
// Tryb „asystent” (domyślny): trening prowadzi sztab według faz roku (js/training.js – okna faz, automatyczne treningi
// na torze w js/equipment.js i treningi punktowane w soboty przedsezonu w js/schedule.js) – tak jak w klubach AI.
// Tryb „własny plan”: gracz układa jednostki w kalendarzu dostępności (Sztab → Trening → Kalendarz) albo prosi asystenta
// o ułożenie miesiąca. Zaplanowane jednostki zastępują automatyczne okna: dawka z ostatnich 7 dni w każdej grupie
// atrybutów względem normy fazy daje mnożnik tempa rozwoju (planBoost → applyDevelopment). Jednostki zmieniają kondycję
// (r.cond), rytm zawodów (trening punktowany), zużycie sprzętu (tor) i niosą ryzyko urazu przy przeciążeniu.
// Prowadzący: trener słabszy od najlepszego w klubie w danej grupie obniża dawkę.
//
// Zima za granicą (Australia, Nowa Zelandia, Argentyna): 1 listopada zawodnicy proszą klub o zgodę na starty zimą –
// głównie zawodnicy z niższej półki (zarobek, jazda) i obcokrajowcy wracający na mistrzostwa kraju (odmowa mocno boli).
// Zgoda: okno techniki zimą, ale zmęczenie i ryzyko urazu przed sezonem; odmowa – spadek morale.

const SESSION_TYPES = {
  tor: { name: 'Trening na torze', short: 'tor', icon: '🏍', units: { tech: 1, workshop: 0.6 }, cond: -6, track: true, lead: 'tech', desc: 'Jazda na torze: technika, dopasowanie sprzętu, docieranie silników. Wymaga pogody (temp. ≥ 4°C, sucho).' },
  punkt: { name: 'Trening punktowany', short: 'punktowany', icon: '🏁', units: { tech: 1.2, mental: 0.3, workshop: 0.4 }, cond: -8, track: true, rhythm: 4, lead: 'tech', desc: 'Biegi pod taśmą jak w meczu: technika startu i walki, rytm zawodów. Wymaga pogody.' },
  motoryka: { name: 'Motoryka', short: 'motoryka', icon: '💪', units: { physical: 1 }, cond: -7, inj: 0.0006, lead: 'physical', desc: 'Siłownia, wydolność, koordynacja. Główna jednostka zimą; w sezonie męczy przed meczem.' },
  odnowa: { name: 'Odnowa', short: 'odnowa', icon: '🛁', units: {}, cond: 10, lead: 'physical', desc: 'Regeneracja: basen, sauna, fizjoterapia. Przywraca kondycję i zmniejsza ryzyko przeciążenia.' },
  wideo: { name: 'Wideo i taktyka', short: 'wideo', icon: '📺', units: { mental: 0.5, tech: 0.25 }, cond: 0, lead: 'tech', desc: 'Analiza biegów i rywali, ustawienie par. Bez zmęczenia.' },
  psycholog: { name: 'Zajęcia z psychologiem', short: 'psycholog', icon: '🧠', units: { mental: 1 }, cond: 0, morale: 1, lead: 'mental', desc: 'Koncentracja, opanowanie, radzenie sobie z presją. Lekko poprawia morale.' },
  testy: { name: 'Testy motoryczne', short: 'testy', icon: '📋', units: { physical: 0.3 }, cond: -3, lead: 'physical', desc: 'Pomiar siły, wytrzymałości i zwinności – wynik trafia do raportu motoryka.' },
};
// Norma dawki (jednostki na tydzień) w fazach roku – plan na poziomie normy daje tempo jak trening prowadzony przez sztab
const PLAN_TARGET = {
  off: { physical: 1.5, tech: 0.3, mental: 0.5, workshop: 0.3 },
  winter: { physical: 3, tech: 0.25, mental: 1.3, workshop: 0.3 },
  pre: { physical: 2, tech: 2.5, mental: 0.8, workshop: 1.2 },
  season: { physical: 1, tech: 1.2, mental: 1, workshop: 0.6 },
};
const PLAN_WHO = { all: 'wszyscy dostępni', sen: 'seniorzy', jun: 'juniorzy (U21)' };
const PLAN_OVERLOAD = 9; // jednostek tygodniowo, powyżej – przeciążenie (zmęczenie, urazy)

const planOn = () => !!(G.tplan && G.tplan.mode === 'manual');
const planManual = clubId => clubId === G.clubId && planOn();
function ensurePlanModel() {
  if (G.tplan) return false;
  G.tplan = { mode: 'auto', s: {}, seq: 1 };
  return true;
}
const planAll = () => Object.values((G.tplan && G.tplan.s) || {});
let PLAN_IDX = { key: null, map: new Map() };
function planOnDay(d) {
  const key = G.tplan ? G.tplan.seq + '|' + G.tplan.ver : '';
  if (PLAN_IDX.key !== key) {
    PLAN_IDX = { key, map: new Map() };
    for (const s of planAll()) { if (!PLAN_IDX.map.has(s.date)) PLAN_IDX.map.set(s.date, []); PLAN_IDX.map.get(s.date).push(s); }
  }
  return PLAN_IDX.map.get(d) || [];
}
const planTouch = () => { G.tplan.ver = (G.tplan.ver || 0) + 1; };
function planWhoOk(r, who, d) {
  if (who === 'jun') return isJunior(r, Number(d.slice(0, 4)));
  if (who === 'sen') return !isJunior(r, Number(d.slice(0, 4)));
  return true;
}
// Uczestnicy jednostki: zawodnicy klubu dostępni tego dnia (bez startu, podróży, pobytu za granicą, kontuzji), bez wykluczonych
function sessionRiders(s, d = s.date) {
  return clubRiders(G.clubId).filter(r => r.active !== false && !r.retired && !(s.ex || []).includes(r.id) && planWhoOk(r, s.who || 'all', d) && dayStatus(r, d).avail);
}
// Prowadzący: najlepszy w klubie w grupie, którą jednostka głównie rozwija (wybór gracza nadpisuje)
function sessionLeadDefault(type) {
  const g = SESSION_TYPES[type].lead, t = clubTraining(G.clubId, 'senior');
  return t.lead[g] || (clubStaff(G.clubId).find(s => COACH_GROUP.includes(s.role)) || {}).id || null;
}
function sessionCoachQ(s) {
  const g = SESSION_TYPES[s.type].lead, st = G.staff[s.coach];
  if (!st || st.clubId !== G.clubId) return 0.75;
  const best = G.staff[clubTraining(G.clubId, 'senior').lead[g]];
  const b = best ? staffSkillFor(best, g, 'senior') : 10, m = staffSkillFor(st, g, 'senior');
  return clamp(0.6 + 0.4 * m / Math.max(4, b), 0.6, 1);
}
function planProblem(date, type) {
  const T = SESSION_TYPES[type];
  if (!T) return 'nieznany rodzaj jednostki';
  if (date <= G.date) return 'tylko od jutra';
  if (planOnDay(date).length >= 2) return 'maksymalnie 2 jednostki dziennie';
  if (planOnDay(date).some(s => s.type === type)) return 'ta jednostka jest już w planie dnia';
  if (T.track) {
    const md = date.slice(5, 10);
    if (md > '10-31' || md < '02-25') return 'tor zamknięty zimą (od 25 lutego do października)';
  }
  return null;
}
function addSession(date, type, { coach, who = 'all', by = 'gracz' } = {}) {
  ensurePlanModel();
  const p = planProblem(date, type);
  if (p) return { ok: false, text: p };
  const id = `T${G.tplan.seq++}`;
  G.tplan.s[id] = { id, date, type, who, ex: [], coach: coach || sessionLeadDefault(type), status: 'plan', by };
  planTouch();
  return { ok: true, id };
}
function removeSession(id) {
  const s = G.tplan && G.tplan.s[id];
  if (!s || s.status !== 'plan') return false;
  delete G.tplan.s[id]; planTouch();
  return true;
}

// ---------- Przebieg dnia ----------
// Po zawodach dnia: jednostki klubu gracza (tylko tryb własnego planu), zimowe starty za granicą (wszyscy)
function planDay(date) {
  if (G.tplan && planOn()) for (const s of planOnDay(date)) if (s.status === 'plan') runSession(s, date);
  winterDay(date);
  // stare jednostki – porządek w zapisie (dziennik dawek zostaje w r.tlog)
  if (G.tplan && date.slice(8) === '01') for (const s of planAll()) if (s.status !== 'plan' && dayDiff(s.date, date) > 120) { delete G.tplan.s[s.id]; planTouch(); }
}
function runSession(s, date) {
  const T = SESSION_TYPES[s.type];
  if (T.track && !trackUsable(date)) { s.status = 'off'; s.why = 'pogoda – tor nieprzejezdny'; planTouch(); return; }
  const list = sessionRiders(s, date).filter(r => !(r.slog || []).some(x => x.d === date) && !(typeof onCamp === 'function' && onCamp(r, date)));
  const q = sessionCoachQ(s);
  s.att = list.map(r => r.id); s.q = round2(q); s.status = 'done';
  for (const r of list) {
    const load = planLoad(r, date);
    const over = Math.max(0, load + sum(Object.values(T.units)) - PLAN_OVERLOAD);
    if (T.cond < 0) r.cond = clamp(r.cond + T.cond * (1.2 - (r.attrs.stamina ?? 10) * 0.02) - over * 3, 30, 100);
    else if (T.cond > 0) r.cond = clamp(r.cond + T.cond * (0.8 + staffBest(G.clubId, 'physio') / 40), 0, 100);
    if (T.morale && r.morale != null) r.morale = clamp(r.morale + T.morale, 0, 100);
    if (T.rhythm) logStart(r, date, T.rhythm, 'sparing');
    if (T.track && typeof trackSession === 'function' && r.equip) trackSession(r);
    if ((T.inj || over) && !r.injury && chance((T.inj || 0.0004) * (1 + over * 0.5) * (1 + Math.max(0, 80 - r.cond) / 30))) injureRider(r, date, `${T.name.toLowerCase()} (przeciążenie)`, { kind: 'training' });
    r.tlog = (r.tlog || []).filter(x => dayDiff(x.d, date) <= 14);
    r.tlog.push({ d: date, t: s.type, q: s.q });
  }
  if (s.type === 'testy' && list.length) {
    const rows = list.slice().sort(by(r => -(r.attrs.strength + r.attrs.stamina + r.attrs.agility))).map(r => `<tr><td>${esc(r.name)}</td><td class="num">${r.attrs.strength}</td><td class="num">${r.attrs.stamina}</td><td class="num">${r.attrs.agility}</td><td class="num">${r.attrs.balance}</td><td class="num">${Math.round(r.cond)}%</td></tr>`).join('');
    addMsg({ category: 'drużyna', from: 'Motoryk', title: `Testy motoryczne ${fmtDateShort(date)}`, body: `<table class="t"><thead><tr><th>Zawodnik</th><th class="num">Siła</th><th class="num">Wytrz.</th><th class="num">Zwinność</th><th class="num">Równowaga</th><th class="num">Kondycja</th></tr></thead><tbody>${rows}</tbody></table>`, link: '#/sztab/kalendarz' });
  }
  planTouch();
}
// Obciążenie zawodnika w ostatnich 7 dniach (jednostki + biegi w zawodach w przeliczeniu ~5 biegów = 1 jednostka)
function planLoad(r, date = G.date) {
  const from = addDays(date, -7);
  const u = sum((r.tlog || []).filter(x => x.d > from && x.d <= date).map(x => sum(Object.values(SESSION_TYPES[x.t].units))));
  return u + sum((r.slog || []).filter(s => s.d > from && s.d <= date && s.k !== 'sparing').map(s => s.h)) / 5;
}
function planDose(r, date = G.date) {
  const from = addDays(date, -7), dose = { tech: 0, physical: 0, mental: 0, workshop: 0 };
  for (const x of r.tlog || []) {
    if (x.d <= from || x.d > date) continue;
    for (const [g, u] of Object.entries(SESSION_TYPES[x.t].units)) dose[g] += u * (x.q ?? 1);
  }
  return dose;
}
// Udział dni w klubie w ostatnim tygodniu (dostępny albo na zajęciach z klubem)
function planPresence(r, date = G.date) {
  const list = riderPlanned(r, addDays(date, -10), addDays(date, 3));
  let n = 0;
  for (let i = 0; i < 7; i++) if (dayStatusFrom(r, list, addDays(date, -i)).avail) n++;
  return n / 7;
}
// Mnożniki okien tygodnia (applyDevelopment): plan gracza w miejsce automatycznych okien + zimowe starty
function planBoost(x) {
  if (!x || !G.riders[x.id]) return null;
  const out = { mul: {}, add: {} };
  let any = false;
  if (x.clubId && planManual(x.clubId)) {
    // plan klubu działa tylko w dni, gdy zawodnik był w klubie (zimą obcokrajowcy w domu trenują sami – jak w trybie sztabu)
    const ph = phaseIdOf(G.date), T = PLAN_TARGET[ph], dose = planDose(x), sh = planPresence(x);
    // dni sprzed przełączenia na własny plan liczą się jak trening sztabu (tempo 100%)
    const own = G.tplan.since ? clamp(dayDiff(G.tplan.since, G.date) / 7, 0, 1) : 1, w = sh * own;
    for (const g of Object.keys(T)) out.mul[g] = w ? 1 + w * (clamp(0.55 + 0.45 * dose[g] / (T[g] * w), 0.55, 1.3) - 1) : 1;
    // tor przed sezonem: pogoda jest już w odwołanych jednostkach – bez podwójnego liczenia w ocenie tygodnia
    if (ph === 'pre' && typeof trackWeekFactor === 'function') out.mul.tech /= Math.max(0.35, trackWeekFactor());
    any = true;
  }
  const w = winterMeets(x);
  if (w) { out.add.tech = (out.add.tech || 0) + 0.12 * w; out.mul.mental = (out.mul.mental || 1) * (1 + 0.04 * w); any = true; }
  return any ? out : null;
}
// Podsumowanie tygodnia dla ekranu: średnia dawka dostępnych zawodników
function planWeekSummary(date = G.date) {
  const rs = clubRiders(G.clubId).filter(r => r.active !== false && !r.retired);
  const ph = phaseIdOf(date), T = PLAN_TARGET[ph], d = { tech: 0, physical: 0, mental: 0, workshop: 0 };
  for (const r of rs) { const x = planDose(r, date); for (const g in d) d[g] += x[g] / Math.max(1, rs.length); }
  const own = G.tplan.since ? clamp(dayDiff(G.tplan.since, date) / 7, 0, 1) : 1;
  const f = Object.fromEntries(Object.keys(T).map(g => [g, own ? 1 + own * (clamp(0.55 + 0.45 * d[g] / (T[g] * own), 0.55, 1.3) - 1) : 1]));
  return { ph, T, d, f, own, over: rs.filter(r => planLoad(r, date) > PLAN_OVERLOAD).length };
}

// ---------- Asystent układa miesiąc ----------
function planAssistant() {
  const st = clubStaff(G.clubId);
  return st.find(s => staffRoles(s).includes('assistant')) || st.find(s => staffRoles(s).includes('coach')) || null;
}
function assistantQ(s) {
  if (!s) return 6;
  const a = s.attrs;
  return (staffSkillFor(s, 'tech', 'senior') + (a.fitness || 0) + (a.psychology || a.motivation || 0) + (a.manMgmt || a.motivation || 0)) / 4;
}
function templateDay(d, fx) {
  const ph = phaseIdOf(d), w = dow(d), md = d.slice(5, 10);
  if (ph === 'off') return w === 1 || w === 3 ? ['motoryka'] : w === 4 ? ['odnowa'] : [];
  if (ph === 'winter') {
    if (w === 0 && (d.slice(8) <= '07') && ['12', '02'].includes(d.slice(5, 7))) return ['testy'];
    return [['motoryka'], ['wideo'], ['motoryka'], ['psycholog'], ['motoryka'], ['odnowa'], []][w];
  }
  if (ph === 'pre') {
    if (md === '03-01') return ['testy'];
    if (md < '03-05') return [['motoryka'], ['wideo'], ['motoryka'], ['psycholog'], ['motoryka'], ['odnowa'], []][w];
    return [['motoryka'], ['tor'], ['motoryka', 'wideo'], ['tor'], ['tor'], ['punkt'], []][w];
  }
  // sezon: względem meczów klubu
  if (fx.has(d)) return [];
  if (fx.has(addDays(d, -1))) return ['odnowa'];
  if (fx.has(addDays(d, 1))) return ['wideo'];
  if (fx.has(addDays(d, 2))) return ['tor'];
  return [['motoryka'], ['tor'], ['motoryka'], ['tor', 'psycholog'], ['odnowa'], [], []][w];
}
function planAssistMonth(ym) {
  ensurePlanModel();
  const asst = planAssistant(), aq = assistantQ(asst);
  const err = clamp(0.32 - aq * 0.016, 0.03, 0.25); // słaby asystent: pominięte jednostki, gorszy wybór prowadzącego
  const fx = new Set(clubFixtures(G.clubId).map(f => f.date));
  const rs = clubRiders(G.clubId).filter(r => r.active !== false && !r.retired);
  const types = Object.keys(SESSION_TYPES);
  let n = 0, miss = 0;
  for (let d = `${ym}-01`; d.slice(0, 7) === ym; d = addDays(d, 1)) {
    if (d <= G.date || planOnDay(d).length) continue;
    if (typeof campBusy === 'function' && campBusy(G.clubId, d)) continue;
    if (typeof sparOf === 'function' && sparOf(G.clubId).some(s => s.date === d && sparActive(s))) continue;
    const avail = rs.filter(r => dayStatus(r, d).avail).length;
    if (rs.length && avail / rs.length < 0.35) continue;
    for (let t of templateDay(d, fx)) {
      if (chance(err)) { miss++; if (chance(0.5)) continue; t = pick(types); }
      const coach = chance(err * 2) && asst ? asst.id : undefined;
      if (addSession(d, t, { coach, by: 'asystent' }).ok) n++;
    }
  }
  return { n, miss, asst, aq };
}

// ---------- Zima za granicą ----------
const WINTER_SERIES = {
  AUS: { name: 'Australia', from: '12-05', to: '01-26', champ: 'mistrzostwa Australii', geo: [-34.9, 138.6, 'AUS'], tracks: ['Gillman', 'Mildura', 'Kurri Kurri', 'Undera', 'Gillman'] },
  NZL: { name: 'Nowa Zelandia', from: '12-10', to: '01-26', champ: 'mistrzostwa Nowej Zelandii', geo: [-43.5, 172.6, 'NZL'], tracks: ['Christchurch', 'Auckland (Western Springs)', 'Rosebank'] },
  ARG: { name: 'Argentyna', from: '12-10', to: '02-15', champ: 'mistrzostwa Argentyny', geo: [-38.7, -62.27, 'ARG'], tracks: ['Bahía Blanca', 'La Plata', 'Carhué'] },
};
const WINTER_ST = { req: 'prośba – czeka na decyzję', ok: 'zgoda klubu', no: 'odmowa klubu' };
const winterYear = () => Number(G.date.slice(0, 4)) + (G.date.slice(5, 7) >= '07' ? 0 : -1); // zima przełomu roku Y/Y+1
function winterHome(r) {
  if (['AUS', 'NZL', 'ARG'].includes(r.country)) return r.country;
  const a = (r.activity || []).join('|');
  if (/Australian Solo Championship/.test(a)) return 'AUS';
  if (/Nowa Zelandia – mistrzostwa/.test(a)) return 'NZL';
  return null;
}
function winterRequests() {
  const Y = winterYear(), mine = [];
  for (const r of Object.values(G.riders)) {
    if (!r.clubId || r.retired || r.active === false || isKid(r) || (r.winter && r.winter.y === Y)) continue;
    if (r.injury && G.injuries[r.injury] && G.injuries[r.injury].until > `${Y}-12-01`) continue;
    const home = winterHome(r), age = ageYears(r.born), amb = r.hidden ? r.hidden.ambition ?? 10 : 10;
    let w = null;
    if (home && hrand(G.seed + 'wc' + r.id + Y) < 0.8) w = { kind: 'champ', ser: home };
    else if (!home && r.skill < 11 && age >= 18 && age <= 34 && hrand(G.seed + 'wr' + r.id + Y) < 0.06 + (amb - 10) * 0.012 + (r.skill < 8 ? 0.04 : 0))
      w = { kind: 'race', ser: ['GBR', 'DEN', 'SWE'].includes(r.country) && hrand(G.seed + 'ws' + r.id) < 0.6 ? 'AUS' : 'ARG' };
    if (!w) continue;
    r.winter = { y: Y, ...w, status: 'req' };
    if (r.clubId === G.clubId) mine.push(r);
    else winterDecide(r, hrand(G.seed + 'wa' + r.id + Y) < (w.kind === 'champ' ? 0.97 : 0.75), true);
  }
  if (mine.length) addMsg({ category: 'drużyna', from: 'Asystent trenera', title: `Zima za granicą: ${mine.length} ${plural(mine.length, 'prośba', 'prośby', 'próśb')}`,
    body: `<p>Zawodnicy proszą o zgodę na starty zimą:</p><ul>${mine.map(r => `<li><b>${esc(r.name)}</b> – ${esc(WINTER_SERIES[r.winter.ser].name)}${r.winter.kind === 'champ' ? ` (${esc(WINTER_SERIES[r.winter.ser].champ)} – powrót do domu; odmowa mocno obniży morale)` : ' (starty zarobkowe)'}</li>`).join('')}</ul><p>Zgoda: jazda zimą (technika), ale zmęczenie i ryzyko urazu przed sezonem. Decyzję podejmiesz w Sztab → Trening → Kalendarz do 25 listopada – potem zdecyduje asystent.</p>`, link: '#/sztab/kalendarz' });
}
function winterDecide(r, ok, silent = false) {
  const w = r.winter;
  if (!w || w.status !== 'req') return false;
  w.status = ok ? 'ok' : 'no';
  const champ = w.kind === 'champ';
  if (r.morale != null) r.morale = clamp(r.morale + (ok ? (champ ? 3 : 4) : champ ? -15 : -6), 0, 100);
  if (ok) winterDates(r);
  if (!silent && r.clubId === G.clubId && !ok && champ) addMsg({ category: 'drużyna', from: 'Asystent trenera', title: `${r.name} rozczarowany decyzją`, body: `<p>${esc(r.name)} nie pojedzie na ${esc(WINTER_SERIES[w.ser].champ)}. Odmowa wyjazdu do domu mocno obniżyła jego morale.</p>`, link: `#/zawodnik/${r.id}` });
  return true;
}
function winterDates(r) {
  const w = r.winter, S = WINTER_SERIES[w.ser], Y = w.y;
  const from = `${Y}-${S.from}`, to = `${Y + 1}-${S.to}`, list = [];
  const n = w.kind === 'champ' ? 6 : 8;
  let k = 0;
  for (let d = addDays(from, (12 - dow(from)) % 7); d <= to; d = addDays(d, 7)) {
    if (d.slice(5) >= '12-22' && d.slice(5) <= '12-27') continue; // święta
    if (hrand(`${r.id}|w|${Y}|${k++}`) > n / 7) continue;
    list.push({ d, vn: S.tracks[Math.floor(hrand(`${r.id}|wv|${d}`) * S.tracks.length)] });
  }
  // prawdziwe zawody w tym kraju (js/foreign.js: mistrzostwa Australii, Torneo Internacional w Argentynie) – rozgrywane w grze;
  // syntetyczne mitingi tylko w pozostałe tygodnie
  const cc = S.geo[2], real = Object.values(G.events).filter(e => e.kind === 'comp' && e.date >= from && e.date <= to && (COMPS[e.comp] || {}).cc === cc
    && (w.kind === 'champ' || /winter/.test((COMPS[e.comp] || {}).field || '')));
  const realD = new Set(real.map(e => e.date));
  const out = list.filter(e => ![...realD].some(d => Math.abs(dayDiff(d, e.d)) <= 2));
  if (w.kind === 'champ' && !real.length) { const cd = `${Y + 1}-01-${String(3 + Math.floor(hrand(r.id + 'wcd' + Y) * 3) * 2).padStart(2, '0')}`; if (!out.some(e => e.d === cd)) out.push({ d: cd, vn: `${S.champ} (finał)`, champ: true }); }
  for (const e of real) out.push({ d: e.date, vn: e.venue, real: e.id });
  w.from = addDays(from, -2); w.to = addDays(to, 2);
  w.dates = out.sort(by(e => e.d));
}
// Zawodnik polski zimą za granicą – dzień poza klubem (obcokrajowcy i tak są wtedy w domu)
function winterAway(r, date) {
  const w = r.winter;
  if (!w || w.status !== 'ok' || !w.from || date < w.from || date > w.to) return null;
  return `zima za granicą (${WINTER_SERIES[w.ser].name})`;
}
function winterPlanned(r, from, to) {
  const w = r.winter;
  if (!w || w.status !== 'ok' || !w.dates) return [];
  const S = WINTER_SERIES[w.ser];
  return w.dates.filter(e => e.d >= from && e.d <= to).map(e => ({ d: e.d, k: 'zagranica', lbl: `${S.name} – ${e.vn}`, g: S.geo, done: e.d < G.date }));
}
function winterMeets(x) {
  const w = x.winter;
  if (!w || w.status !== 'ok' || !w.dates) return 0;
  const from = addDays(G.date, -7);
  return w.dates.filter(e => e.d > from && e.d <= G.date && (e.ran || (e.real && (x.slog || []).some(s => s.d === e.d)))).length;
}
function winterDay(date) {
  const md = date.slice(5);
  if (md === '11-01') winterRequests();
  if (md === '11-25') for (const r of clubRiders(G.clubId)) if (r.winter && r.winter.status === 'req') winterDecide(r, chance(r.winter.kind === 'champ' ? 0.95 : 0.6), true);
  if (md > '02-16' && md < '12-01') return;
  for (const r of Object.values(G.riders)) {
    const w = r.winter;
    if (!w || w.status !== 'ok' || !w.dates || r.injury || r.retired) continue;
    const e = w.dates.find(x => x.d === date);
    if (!e || e.real) continue; // prawdziwe zawody rozgrywa js/competitions.js
    const heats = rint(4, 6);
    e.ran = true;
    r.cond = clamp(r.cond - heats * (2.2 - r.attrs.stamina * 0.05), 30, 100);
    r.form = clamp(r.form * 0.95 + gauss(0.15), -2, 2);
    logStart(r, date, heats, 'zagranica');
    const p = 0.0016 * heats * (1.3 - r.attrs.balance / 40) * (1.25 - (r.attrs.resilience ?? 10) / 40);
    if (chance(p)) injureRider(r, date, `${WINTER_SERIES[w.ser].name} (${e.vn})`, { kind: 'foreign' });
  }
}
