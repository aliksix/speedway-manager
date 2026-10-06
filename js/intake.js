'use strict';
// Nabór adeptów, pojemność szkółek, znane nazwiska i adepci z zagranicy.
// Model (wywiady i relacje: TŻ Ostrovia, Falubaz, AS Wybrzeże, GUKS Wawrów, Włókniarz – Sportowe Fakty; rejestr PZM 2026):
// - dzieci przychodzą pojedynczo przez cały sezon (najwięcej wiosną), w małych ośrodkach 2–4 rocznie, w mocnych klubach 8–15;
//   nabór jest ciągły, a rotacja duża („słomiany zapał” – część rezygnuje w pierwszym roku),
// - każdy zaczyna od okresu próbnego na pit bike'u; po kilku tygodniach trener szkółki ocenia: rokujący / nierokujący
//   (trafność zależy od jego oceny talentu), a klub decyduje, kogo zostawić,
// - pojemność szkółki zależy od trenerów: przeciętny trener prowadzi 6–7 adeptów, bardzo dobry ok. 12, asystent dodaje kilka miejsc;
//   budżet szkółki musi pokryć sprzęt, paliwo i wyjazdy; ponad limit – słabszy trening wszystkich (js/training.js) i więcej rezygnacji.
// Imiona i nazwiska: PESEL (roczniki, województwa) i bazy innych krajów – js/names-data.js (tools/build-names.py).

// ---------- Imiona i nazwiska ----------
const WOJ_OF_CITY = {
  'Wrocław': 'DOLNOŚLĄSKIE', 'Toruń': 'KUJAWSKO-POMORSKIE', 'Bydgoszcz': 'KUJAWSKO-POMORSKIE', 'Grudziądz': 'KUJAWSKO-POMORSKIE', 'Lipno': 'KUJAWSKO-POMORSKIE',
  'Lublin': 'LUBELSKIE', 'Zielona Góra': 'LUBUSKIE', 'Gorzów Wielkopolski': 'LUBUSKIE', 'Gorzów': 'LUBUSKIE', 'Wawrów': 'LUBUSKIE', 'Łódź': 'ŁÓDZKIE',
  'Kraków': 'MAŁOPOLSKIE', 'Tarnów': 'MAŁOPOLSKIE', 'Warszawa': 'MAZOWIECKIE', 'Opole': 'OPOLSKIE', 'Krosno': 'PODKARPACKIE', 'Rzeszów': 'PODKARPACKIE',
  'Gdańsk': 'POMORSKIE', 'Rybnik': 'ŚLĄSKIE', 'Częstochowa': 'ŚLĄSKIE', 'Świętochłowice': 'ŚLĄSKIE', 'Rędziny': 'ŚLĄSKIE',
  'Leszno': 'WIELKOPOLSKIE', 'Poznań': 'WIELKOPOLSKIE', 'Ostrów Wielkopolski': 'WIELKOPOLSKIE', 'Ostrów': 'WIELKOPOLSKIE', 'Piła': 'WIELKOPOLSKIE',
  'Gniezno': 'WIELKOPOLSKIE', 'Rawicz': 'WIELKOPOLSKIE',
};
const SCHOOL_CITY = { LIPN: 'Lipno', REDZ: 'Rędziny', WAW: 'Wawrów', TARC: 'Tarnów' };
const NAME_CACHE = new Map();
// losowanie ważone ze spłaszczeniem (liczebność^0,6): częste nazwiska częściej, ale bez dominacji – długi ogon daje oryginalne nazwiska
function namePick(key, list, power = 0.6) {
  let c = NAME_CACHE.get(key);
  if (!c) {
    let t = 0;
    const cum = list.map(([n, w]) => (t += Math.pow(w, power)));
    c = { cum, t, list };
    NAME_CACHE.set(key, c);
  }
  const x = rnd() * c.t;
  let lo = 0, hi = c.cum.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (c.cum[m] < x) lo = m + 1; else hi = m; }
  return c.list[lo][0];
}
function plNational() {
  if (NAME_CACHE.has('pl-nat')) return NAME_CACHE.get('pl-nat').list;
  const m = new Map();
  for (const l of Object.values(NAMES_DATA.pl.sur)) for (const [n, w] of l) m.set(n, (m.get(n) || 0) + w);
  const list = [...m.entries()];
  NAME_CACHE.set('pl-nat', { list, cum: null });
  return list;
}
const plFirst = year => {
  const ys = Object.keys(NAMES_DATA.pl.first).map(Number);
  const y = ys.reduce((a, b) => (Math.abs(b - year) < Math.abs(a - year) ? b : a), ys[0]);
  return [String(y), NAMES_DATA.pl.first[String(y)]];
};
const plSurname = woj => (woj && NAMES_DATA.pl.sur[woj] && rnd() < 0.7 ? namePick('pl-sur-' + woj, NAMES_DATA.pl.sur[woj]) : namePick('pl-nat-pick', plNational()));
// Imię i nazwisko z prawdziwych rozkładów (chłopcy). opts: { woj – województwo (Polska), year – rocznik, last – nazwisko z góry }
function realName(country = 'POL', opts = {}) {
  if (typeof NAMES_DATA === 'undefined') return null;
  const year = opts.year || yearOf(G ? G.date : '2026-01-01') - 8;
  if (country === 'POL') {
    const [y, list] = plFirst(year);
    return `${namePick('pl-first-' + y, list, 0.75)} ${opts.last || plSurname(opts.woj)}`;
  }
  const d = NAMES_DATA.foreign[country];
  if (!d) return null;
  let first = namePick('f-first-' + country, d.first, 1);
  if (['DEN', 'SWE', 'NOR'].includes(country) && rnd() < 0.2) { const f2 = namePick('f-first-' + country, d.first, 1); if (f2 !== first) first += ' ' + f2; }
  let last = opts.last || namePick('f-last-' + country, d.last, 0.6);
  if (!opts.last && country === 'DEN' && rnd() < 0.12) { const l2 = namePick('f-last-' + country, d.last, 0.6); if (l2 !== last) last = l2 + ' ' + last; }
  if (!opts.last && country === 'ARG' && rnd() < 0.3) { const l2 = namePick('f-last-' + country, d.last, 0.6); if (l2 !== last) last += ' ' + l2; }
  return `${first} ${last}`;
}
// nazwisko unikalne w grze (bez przypadkowych imienników prawdziwych postaci)
function uniqueName(country, opts) {
  const taken = new Set([...Object.values(G.riders), ...Object.values(G.staff), ...Object.values(G.academy)].map(x => normName(x.name)));
  let n = null;
  for (let i = 0; i < 30; i++) { n = realName(country, opts) || genName(country); if (!taken.has(normName(n))) return n; }
  return n;
}

// ---------- Pojemność szkółki ----------
// roczny koszt klubu na adepta (sprzęt klubowy, paliwo, tor, wyjazdy); dużą część kosztów ponoszą rodzice (GUKS Wawrów: ok. 50 tys. zł na 7 adeptów)
const KID_COST = { c50: 2000, c85: 5000, c250: 8000, c500: 12000 };
const schoolKidsOf = clubId => Object.values(G.academy).filter(k => k.clubId === clubId && !k.catalogOnly && !k.retired && !k.free);
// Trenerzy szkółki: prowadzący – 3 + 0,25 × praca z młodzieżą + 0,2 × zarządzanie (przeciętny ≈ 6–7, bardzo dobry ≈ 12);
// każdy kolejny trener szkółki (co najmniej przeciętny) dodaje ok. 3 miejsca; instruktorzy i pomoc: +2,5 za każdy poziom obiektów powyżej 1;
// bez trenera – rodzice i wolontariusze (3)
function academyCapacity(clubId) {
  const st = clubStaff(clubId).filter(s => staffRoles(s).includes('youth')).map(s => ({ s, v: Math.max(s.attrs.youth || 0, s.attrs.mini || 0) })).sort(by(x => x.v, -1));
  // instruktorzy i pomoc (rodzice, byli zawodnicy) – rośnie z poziomem obiektów szkółki
  const help = 2.5 * (((G.clubs[clubId] && G.clubs[clubId].facilities.academy) || 1) - 1);
  if (!st.length) return Math.round(3 + help);
  const lead = st[0];
  let cap = (3 + 0.25 * lead.v + 0.2 * (lead.s.attrs.manMgmt || 8)) * staffEff(lead.s);
  for (const x of st.slice(1)) if (x.v >= 8) cap += 3 * staffEff(x.s);
  return clamp(Math.round(cap + help), 3, 30);
}
function academyLoad(clubId) {
  const c = G.clubs[clubId], kids = schoolKidsOf(clubId);
  const cap = academyCapacity(clubId);
  const need = sum(kids.map(k => KID_COST[k.cat] || 15000));
  const budget = (c && c.academyBudget) || 0;
  const avg = kids.length ? need / kids.length : 12000;
  const covCoach = kids.length ? Math.min(1, cap / kids.length) : 1;
  const covBudget = need ? clamp(Math.pow(budget / need, 0.35), 0.7, 1) : 1; // za mały budżet – mniej treningów i sprzętu (łagodnie)
  return { kids: kids.length, cap, need, budget, budgetCap: Math.floor(budget / avg), cov: covCoach * covBudget, covCoach, covBudget };
}

// ---------- Nabór: pojedyncze przyjścia przez cały sezon ----------
const INTAKE_MONTH_W = [0.04, 0.05, 0.12, 0.16, 0.15, 0.12, 0.08, 0.08, 0.09, 0.05, 0.03, 0.03];
const SPEEDWAY_TRADITION = { 'Leszno': 2.5, 'Toruń': 2, 'Gorzów Wielkopolski': 2, 'Rybnik': 2, 'Zielona Góra': 1.5, 'Częstochowa': 1.5, 'Wrocław': 1.5,
  'Bydgoszcz': 1.5, 'Ostrów Wielkopolski': 1, 'Grudziądz': 1, 'Gdańsk': 1, 'Tarnów': 1, 'Rzeszów': 0.5, 'Lublin': 0.5, 'Piła': 0.5, 'Gniezno': 0.5,
  'Krosno': 0.5, 'Łódź': 0.5, 'Opole': 0.5, 'Świętochłowice': 0.5, 'Rawicz': 0.5 };
// Oczekiwana liczba nowych dzieci w roku (2–4 mały ośrodek, 8–15 mocny klub)
function intakeRate(c) {
  if (!c || !WOJ_OF_CITY[c.city]) return 0; // szkółki w Polsce (Daugavpils, Landshut – poza modelem naboru)
  const hero = Math.min(2, 0.5 * Object.values(G.riders).filter(r => r.clubId === c.id && r.academyGraduate && (r.ca || 0) >= 55).length);
  const lg = { PGE: 2, '2E': 1, KLZ: 0 }[c.league] || 0;
  return clamp(1 + 1.5 * Math.log10((c.fans || 3000) / 1000 + 1) + lg + 0.5 * ((c.facilities.academy || 1) - 1) + (c.facilities.miniTrack ? 1.5 : 0)
    + (SPEEDWAY_TRADITION[c.city] || 0) + hero - (c.dormant ? 1.5 : 0), 1, 14);
}
const schoolRate = s => ({ TARC: 3, LIPN: 3, REDZ: 2.5, WAW: 2 }[s.id] || 1.5);
function poisson(lambda) { let k = 0, p = Math.exp(-lambda), s = p; const u = rnd(); while (u > s && k < 30) { k++; p *= lambda / k; s += p; } return k; }
const ARRIVAL_AGE = [[6, 25], [7, 22], [8, 18], [9, 13], [10, 10], [11, 7], [12, 5]];
function arrivalAge(min = 6) { const l = ARRIVAL_AGE.filter(a => a[0] >= min); let x = rnd() * sum(l.map(a => a[1])); for (const [a, w] of l) if ((x -= w) <= 0) return a; return min; }
// Potencjał nowego dziecka – mieszanka: przeciętni N(47 + base, 11), perełki N(77, 6) w widełkach 66–90, gwiazdy N(88, 6) w widełkach 80–99.
// Kalibracja do młodych roczników z danych (2009–2013, średnio na rocznik):
//   Polska (ok. 40–55 dzieci): najlepszy ~86, drugi ~80, średnia top 10 ~69, PA 85+ ~0,8, PA 75+ ~2,5 – gem = 1,
//   zagranica (ok. 35 w puli): najlepszy ~89, drugi ~84, średnia top 10 ~75, PA 85+ ~1,5, PA 75+ ~5 – gem = 2,4 (do puli trafia selekcja z programów krajowych).
// Mediana wygenerowanych (~48) jest niższa niż w danych (~58), bo w danych są tylko ci, którzy przeszli selekcję w szkółkach.
function arrivalPotential(base = 0, gem = 1) {
  const u = rnd();
  if (u < 0.013 * gem) return round1(clamp(88 + gauss(6), 80, 99));
  if (u < 0.073 * gem) return round1(clamp(77 + gauss(6), 66, 90));
  return round1(clamp(47 + base + gauss(11), 25, 85));
}
// Szkółka, w której klub szkoli nowych adeptów: stowarzyszenie realizujące szkolenie dla klubu (trainsFor, np. MS Śląsk
// dla Śląska Świętochłowice), jeśli ma adeptów w rejestrze PZM; inaczej szkółka klubu (leagueCode)
const clubSchoolId = clubId => {
  const ss = Object.values(G.miniSchools || {}).filter(s => s.clubId === clubId);
  if (!ss.length) return null;
  const cnt = s => Object.values(G.academy).filter(k => k.schoolId === s.id && !k.gen && !k.mgrChild).length; // adepci z rejestru, bez naboru gry
  return ss.sort(by(s => (s.trainsFor && cnt(s) ? 2000 : s.leagueCode ? 1000 : 0) + cnt(s), -1))[0].id;
};
function makeKid({ clubId = null, schoolId = null, country = 'POL', age, woj = null, name = null, pa = null, trial = true, source = 'nabór' }) {
  const y = yearOf(G.date) - age;
  const born = `${y}-${String(rint(1, 12)).padStart(2, '0')}-${String(rint(1, 28)).padStart(2, '0')}`;
  const P = pa ?? arrivalPotential();
  const ca = clamp(P * ageCurve(ageYears(born)) * (0.85 + rnd() * 0.15), 1, 60);
  const k = { id: `A${G.seq.academy++}`, name: name || uniqueName(country, { woj, year: y }), country, born, clubId, schoolId, real: true, gen: true, source,
    cat: trial ? 'c50' : kidCatFor('', age), joined: G.date, progress: [], parentsSupport: rint(1, 5), meets: 0, lic: null,
    pa: round1(P), ca: round1(ca), paRange: [round1(Math.max(ca, P - 20)), round1(Math.min(100, P + 20))], calib: 'nabór (gra)' };
  if (trial) k.trial = { from: G.date, until: addDays(G.date, rint(28, 56)) };
  initKidAbility(k, null);
  G.academy[k.id] = k;
  return k;
}
function arrival(c, s, minAge = 6) {
  const city = c ? c.city : SCHOOL_CITY[s.id];
  const k = makeKid({ clubId: c ? c.id : null, schoolId: c ? clubSchoolId(c.id) : s.id, age: arrivalAge(minAge), woj: WOJ_OF_CITY[city] || null });
  if (c && c.id === G.clubId) addMsg({ category: 'szkółka', from: 'Trener szkółki', title: `Nowy chłopak na treningu próbnym: ${k.name}`,
    body: `<p>Na pierwszy trening na pit bike'u przyszedł <b>${esc(k.name)}</b> (${ageAt(k.born, G.date)} lat) z rodzicami. Przez kilka tygodni sprawdzimy, czy rokuje – raport do ${fmtDate(k.trial.until)}.</p>`, link: `#/adept/${k.id}` });
  return k;
}
function academyIntakeMonthly() {
  const m = Number(G.date.slice(5, 7)) - 1;
  for (const c of Object.values(G.clubs)) {
    const lam = intakeRate(c) * INTAKE_MONTH_W[m];
    for (let i = poisson(lam); i > 0; i--) arrival(c, null);
  }
  for (const s of Object.values(G.miniSchools || {}).filter(s => !s.clubId && SCHOOL_CITY[s.id])) for (let i = poisson(schoolRate(s) * INTAKE_MONTH_W[m]); i > 0; i--) arrival(null, s);
  kidDropouts();
}
// Dzień otwarty: jednorazowo więcej chętnych (test sprawnościowy, 8–13 lat)
const OPEN_DAY_COST = 15000;
function openDayAction() { // akcja ACT.openDay (js/ui-team.js)
  const c = myClub();
  if (c.openDay === G.season) return toast('Dzień otwarty był już w tym sezonie.', 'bad');
  if (c.cash < OPEN_DAY_COST) return toast('Brak środków na organizację dnia otwartego.', 'bad');
  c.openDay = G.season;
  addTx(c.id, 'szkółka', -OPEN_DAY_COST, 'Dzień otwarty szkółki');
  const n = Math.max(1, poisson(intakeRate(c) * 0.5));
  for (let i = 0; i < n; i++) arrival(c, null, 8);
  toast(`Dzień otwarty: ${n} ${n === 1 ? 'chłopak przyszedł' : 'chłopców przyszło'} na trening próbny.`, 'good');
  changed();
}

// ---------- Okres próbny: raport trenera i decyzja ----------
const trialPromising = k => perceive(k, k.clubId || null).paMid >= 55;
function trialReport(k) {
  const p = perceive(k, k.clubId || null), ok = p.paMid >= 55;
  const lines = [ok ? 'Rokuje – szybko łapie jazdę i nie boi się motocykla.' : 'Na razie nie rokuje – brakuje wyczucia i odwagi.'];
  if (k.hidden && k.hidden.ambition >= 14) lines.push('Bardzo ambitny, chce wygrywać każdy trening.');
  if (k.hidden && k.hidden.ambition <= 7) lines.push('Szybko się zniechęca.');
  if (k.parentsSupport >= 4) lines.push('Rodzice mocno go wspierają.');
  return { ok, text: lines.join(' '), date: G.date };
}
function trialKeep(k) {
  delete k.trial;
  k.cat = ageAt(k.born, G.date) >= 8 ? 'c85' : 'c50';
}
function trialRelease(k, why) {
  for (const p of Object.values(G.miniPeople || {})) if (p.kidId === k.id) p.kidId = null;
  delete G.academy[k.id];
}
function trialsWeekly() {
  for (const k of Object.values(G.academy)) {
    const t = k.trial;
    if (!t || G.date < t.until) continue;
    if (!t.report) {
      t.report = trialReport(k);
      // dziecko samo rezygnuje (słomiany zapał): nierokujący i mało ambitni – częściej
      const amb = k.hidden ? k.hidden.ambition : 10;
      if (chance(clamp((t.report.ok ? 0.08 : 0.3) + (10 - amb) * 0.02 - (k.parentsSupport - 3) * 0.03, 0.02, 0.6))) {
        if (k.clubId === G.clubId) addMsg({ category: 'szkółka', from: 'Trener szkółki', title: `${k.name} rezygnuje po treningach próbnych`, body: `<p>${esc(k.name)} po kilku treningach stwierdził, że żużel to nie dla niego.</p>` });
        trialRelease(k);
        continue;
      }
      if (k.clubId === G.clubId) {
        t.decideBy = addDays(G.date, 14);
        const L = academyLoad(G.clubId);
        addMsg({ category: 'szkółka', from: 'Trener szkółki', stop: true, title: `Raport po treningach próbnych: ${k.name} – ${t.report.ok ? 'rokujący' : 'nierokujący'}`,
          body: `<p><b>${esc(k.name)}</b> (${ageAt(k.born, G.date)} lat): ${esc(t.report.text)}</p><p>Szkółka: ${L.kids} adeptów przy ok. ${L.cap} miejscach u trenerów.</p>
            <p><button class="btn primary" onclick="ACT.trialKeep('${k.id}')">Zostaw w szkółce</button> <button class="btn" onclick="ACT.trialRelease('${k.id}')">Podziękuj</button></p>
            <p class="small muted">Bez decyzji do ${fmtDate(t.decideBy)} trener zostawi go, jeśli są wolne miejsca.</p>`, link: `#/adept/${k.id}` });
        continue;
      }
    }
    // klub AI / szkółka niezależna albo brak decyzji gracza: zostaje rokujący, gdy są miejsca (nierokujący – czasem, przy wolnych miejscach)
    if (k.clubId === G.clubId && t.decideBy && G.date < t.decideBy) continue;
    const L = k.clubId ? academyLoad(k.clubId) : { kids: 0, cap: 99 };
    const free = L.kids <= L.cap;
    if ((t.report.ok && (free || chance(0.5))) || (!t.report.ok && free && chance(0.3))) trialKeep(k);
    else trialRelease(k);
  }
}
// akcje ACT.trialKeep / ACT.trialRelease (rejestrowane w js/ui-team.js – ACT powstaje w js/ui-core.js, ładowanym po tym pliku)
function trialKeepAction(id) { const k = G.academy[id]; if (!k || !k.trial) return toast('Decyzja już zapadła.'); trialKeep(k); toast(`${k.name} zostaje w szkółce.`, 'good'); changed(); }
function trialReleaseAction(id) { const k = G.academy[id]; if (!k || !k.trial) return toast('Decyzja już zapadła.'); const n = k.name; trialRelease(k); toast(`Podziękowaliśmy: ${n}.`); go('#/szkolka'); changed(); }
// Rezygnacje w pierwszym roku (ok. 30–40%): mała ambicja, słabe wsparcie rodziców, przepełniona szkółka
function kidDropouts() {
  for (const k of Object.values(G.academy)) {
    if (!k.gen || k.trial || k.retired || k.catalogOnly || !k.clubId || dayDiff(k.joined, G.date) > 365) continue;
    const amb = k.hidden ? k.hidden.ambition : 10, L = academyLoad(k.clubId);
    const p = clamp(0.03 + (10 - amb) * 0.004 + (3 - k.parentsSupport) * 0.006 + (1 - L.cov) * 0.05, 0.005, 0.12);
    if (chance(p) && typeof retireKid === 'function') retireKid(k, 'stracił zapał do treningów');
  }
}

// ---------- Znane nazwiska: dzieci i krewni ludzi żużla (co sezon, 1 marca) ----------
const REL_BACK = { syn: 'ojciec', bratanek: 'stryj', siostrzeniec: 'wuj', wnuk: 'dziadek' };
function addGenRelation(kid, rel, other) {
  G.relGen = G.relGen || [];
  G.relGen.push({ a: kid, rel: REL_BACK[rel], b: other }, { a: other, rel, b: kid });
}
const surnameOf = n => { const w = n.split(' '); return w.length > 2 && /^(van|de|von|der)$/i.test(w[w.length - 2]) ? w.slice(-2).join(' ') : w[w.length - 1]; };
function famePeople() {
  const S = yearOf(G.date), out = [];
  for (const r of Object.values(G.riders)) {
    const by = Number(String(r.born || '').slice(0, 4));
    if (by && S - by >= 30 && S - by <= 75) out.push({ p: r, by, fame: Math.max(r.pa || 0, r.ca || 0, (r.skill || 0) * 5), staff: false });
  }
  for (const s of Object.values(G.staff)) {
    const by = Number(String(s.born || '').slice(0, 4));
    if (by && S - by >= 30 && S - by <= 75 && !out.some(x => normName(x.p.name) === normName(s.name))) out.push({ p: s, by, fame: 40 + Math.max(...Object.values(s.attrs || {}).map(Number).filter(Number.isFinite), 0), staff: true });
  }
  return out;
}
function dynastiesYearly() {
  if (typeof NAMES_DATA === 'undefined') return;
  const S = yearOf(G.date);
  G.dynParents = G.dynParents || [];
  const used = new Set(G.dynParents), pool = famePeople().filter(x => !used.has(x.p.name));
  const take = (list, n) => {
    for (let i = 0; i < n && list.length; i++) {
      // dzieci mają też przeciętni zawodnicy i ludzie ze sztabów – sława rodzica tylko lekko zwiększa szansę (np. Paluch: ojciec ligowiec, syn talent)
      const w = list.map(x => 1 + Math.max(0, x.fame - 40) / 40);
      let r = rnd() * sum(w), j = 0;
      while ((r -= w[j]) > 0 && j < list.length - 1) j++;
      const x = list.splice(j, 1)[0];
      const age = rint(6, 9), ky = S - age, gap = ky - x.by, cc = x.p.country || 'POL';
      if (!NAMES_DATA.foreign[cc] && cc !== 'POL') { i--; continue; }
      // relacja zgodna z wiekiem: syn (rodzic 22–42 lata przy narodzinach), wnuk (50+), w pozostałych bratanek / siostrzeniec
      let rel = gap >= 50 ? 'wnuk' : gap >= 22 && gap <= 42 && rnd() < 0.65 ? 'syn' : rnd() < 0.6 ? 'bratanek' : 'siostrzeniec';
      const last = rel === 'siostrzeniec' ? null : surnameOf(x.p.name);
      const club = cc === 'POL' ? dynastyClub(x.p) : null;
      const kid = makeKid({ clubId: club ? club.id : null, schoolId: club ? clubSchoolId(club.id) : null, country: cc, age, trial: cc === 'POL',
        woj: club ? WOJ_OF_CITY[club.city] : null, pa: Math.max(arrivalPotential(3, 2), clamp(52 + (x.fame - 50) * 0.45 + gauss(12), 25, 97)), source: 'rodzina żużlowa',
        name: uniqueName(cc, { year: ky, last, woj: club ? WOJ_OF_CITY[club.city] : null }) });
      kid.parentsSupport = rint(4, 5);
      addGenRelation(kid.name, rel, x.p.name);
      G.dynParents.push(x.p.name);
      if (cc === 'POL' || x.fame >= 65) addMsg({ category: 'szkółka', from: 'Media', title: `${{ syn: 'Syn', bratanek: 'Bratanek', siostrzeniec: 'Siostrzeniec', wnuk: 'Wnuk' }[rel]} ${x.p.name} zaczyna przygodę z żużlem`,
        body: `<p>${esc(kid.name)} (${age} lat) ${club ? `trenuje w szkółce: ${esc(club.name)}` : `trenuje w kraju (${esc(COUNTRY[cc] || cc)})`}. ${x.staff ? 'Żużel ma w rodzinie – jego krewny pracuje w sztabie.' : 'Rodzinna tradycja żużlowa trwa.'}</p>`, link: `#/adept/${kid.id}` });
    }
  };
  take(pool.filter(x => (x.p.country || 'POL') === 'POL'), poisson(1.5));
  take(pool.filter(x => (x.p.country || 'POL') !== 'POL'), poisson(2.5));
}
// szkółka dziecka z rodziny żużlowej: klub rodzica, klub z miasta urodzenia, inaczej klub z dużym naborem
function dynastyClub(p) {
  const ok = c => c && WOJ_OF_CITY[c.city];
  if (p.clubId && ok(G.clubs[p.clubId])) return G.clubs[p.clubId];
  const home = Object.values(G.clubs).find(c => ok(c) && p.birthPlace && normName(p.birthPlace).includes(normName(c.city)));
  if (home) return home;
  if (p.homeClubId && ok(G.clubs[p.homeClubId])) return G.clubs[p.homeClubId];
  const cs = Object.values(G.clubs).filter(ok);
  return cs[Math.floor(rnd() * cs.length)];
}

// ---------- Adepci z zagranicy (co sezon, 1 marca): pule krajowe zasilające SGP4, SGP3 i Puchar Europy ----------
const FOREIGN_POOL = { DEN: 5, SWE: 5, GBR: 5, AUS: 4, GER: 3, CZE: 2, FIN: 2, ARG: 2, LAT: 1, USA: 1, NED: 1, NOR: 1, FRA: 1, SLO: 1, UKR: 1 };
function foreignPoolYearly() {
  for (const [cc, n] of Object.entries(FOREIGN_POOL)) for (let i = poisson(n); i > 0; i--) makeKid({ country: cc, age: rint(9, 11), trial: false, source: 'adept z zagranicy', pa: arrivalPotential(5, 2.4) });
}
function youthYearly() {
  if (G.youthYear === G.season) return false;
  G.youthYear = G.season;
  dynastiesYearly();
  foreignPoolYearly();
  return true;
}
