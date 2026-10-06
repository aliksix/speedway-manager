'use strict';
// Adepci: zagraniczni (licencja w swoim kraju, poza polskim egzaminem PZM), odejścia ze szkółki (wolny adept albo koniec kariery),
// trwały koniec kariery seniorów (bez możliwości powrotu).

// Zagraniczni adepci. Greg Łaguta – Łotysz z drugim obywatelstwem rosyjskim (ojciec Rosjanin); uczestnicy Golden Boy Trophy
// w Gdańsku (lista startowa, planetatrojmiasto.pl) – roczniki nieznane, szacunek.
const FOREIGN_ADEPTS = [
  { name: 'Greg Łaguta', country: 'LAT', nationalities: ['LAT', 'RUS'] },
  { name: 'Moritz Mattick', country: 'GER', add: true },
  { name: 'Oliver Graakjær', country: 'DEN', add: true },
  { name: 'Victoria Coopersen', country: 'DEN', add: true },
  { name: 'Anakin Kruse Hansen', country: 'DEN', add: true },
  { name: 'Levi Pentzek', country: 'GER', add: true },
];
const isForeignKid = k => !!k && (k.country || 'POL') !== 'POL';
const kidActive = k => !!k && !k.catalogOnly && !k.retired;

// Seniorzy nieaktywni na stałe: ostatni start (baza gry i Polish Speedway Database) przed 2024 r., bez klubu i zawieszenia,
// albo czynni w sztabie klubu (np. menedżer) bez aktywnej licencji – koniec kariery. Oznaczenie zdjęte, gdy PSD ma start w 2024–2025.
// Ostatni sezon startów: u Polaków – mecze ligowe z Polish Speedway Database (historia w profilu zawodnika); wpisy bazy typu
// „archiwum 2021–2024” nie są dowodem startów. Zagraniczni (PSD nie obejmuje ich lig) – pole lastSeason z bazy.
function psdHistOf(r) { return typeof RIDER_HIST !== 'undefined' ? RIDER_HIST.riders[r.psdSlug] || RIDER_HIST.riders[nameSlug(r.name)] || null : null; }
function lastStartSeason(r) {
  const h = psdHistOf(r), psd = h && h.seasons.length ? Math.max(...h.seasons.map(s => s.season)) : 0;
  const game = Math.max(0, ...Object.keys(r.stats || {}).filter(y => (r.stats[y].heats || 0) > 0).map(Number));
  if (hasNat(r, 'POL') && psd) return Math.max(psd, game);
  return Math.max(r.lastSeason || 0, psd, game);
}
// Korekta ostatniego sezonu i licencji Polaków wg PSD (start gry / migracja): bez startów od ≥ 2 sezonów i bez klubu – licencja wygasła
function fixLastSeasonsFromPsd() {
  for (const r of Object.values(G.riders)) {
    if (r.retired || !hasNat(r, 'POL') || !psdHistOf(r)) continue;
    const last = lastStartSeason(r);
    if (G.date <= `${START_SEASON}-12-31` && last && (r.lastSeason || 0) > last) r.lastSeason = last; // tylko dane startowe (przed pierwszym sezonem w grze)
    if (r.active && !r.clubId && last && last < sportSeason() - 2) { r.active = false; r.licExpired = r.licExpired || last + 1; }
  }
}
function markCareerEnds() {
  for (const r of Object.values(G.riders)) {
    // wygasła licencja (r.licExpired) sama nie chroni przed końcem kariery – decyduje ostatni start (przed 2024 r.)
    if (r.active || r.clubId) continue;
    const last = lastStartSeason(r);
    // zawodnicy zagraniczni mogą jeździć w swoim kraju – PSD obejmuje tylko polskie ligi, więc bez automatycznego końca kariery
    if (!hasNat(r, 'POL')) { if (r.retired && r.retiredAuto) { r.retired = false; delete r.retiredOn; delete r.retiredAuto; } continue; }
    // definitywny koniec kariery (decyzja ostateczna, bez powrotów): wiek ≥ 36 albo przerwa ≥ 5 sezonów w wieku ≥ 30;
    // praca w sztabie nie przesądza o końcu kariery – zdarzają się jeżdżący trenerzy, a zawodnicy często obejmują funkcję w klubie przed końcem ścigania;
    // pozostali bez licencji – „licencja wygasła”: mogą wrócić przez egzamin „Ż” (co sezon mogą sami ogłosić koniec kariery – licQuitChance)
    const age = riderAge(r);
    if (age >= 36 || ((last || 0) <= sportSeason() - 5 && age >= 30)) { if (!r.retired) { r.retired = true; r.retiredOn = String(last || ''); r.retiredAuto = true; } }
    else {
      if (r.retired && r.retiredAuto) { r.retired = false; delete r.retiredOn; delete r.retiredAuto; }
      if (last && last < sportSeason() - 1 && !r.licExpired) r.licExpired = last + 1;
    }
  }
}
function ensureAdeptModel() {
  if (G.adeptModel === 8) return false;
  for (const e of FOREIGN_ADEPTS) {
    let k = Object.values(G.academy).find(x => normName(x.name) === normName(e.name));
    if (!k && e.add) {
      const y = yearOf(G.date) - 14;
      k = { id: `A${G.seq.academy++}`, name: e.name, country: e.country, born: `${y}-07-01`, bornEst: true, birthYear: y, clubId: null, schoolId: null, cat: 'c250',
        real: true, source: 'Golden Boy Trophy (Gdańsk) – lista startowa', joined: G.date, progress: [], parentsSupport: 3, meets: 0 };
      G.academy[k.id] = k;
      if (typeof initKidAbility === 'function') initKidAbility(k, null);
    }
    if (!k) continue;
    k.country = e.country;
    if (e.nationalities) k.nationalities = e.nationalities.slice();
  }
  fixLastSeasonsFromPsd();
  markCareerEnds();
  G.adeptModel = 8;
  return true;
}

// Zagraniczni adepci zdobywają licencję w swoim kraju (raz w miesiącu szansa, gdy są gotowi: klasa 500/250, od 16 lat)
function retireKid(k, why) {
  const own = k.clubId && k.clubId === G.clubId;
  k.lastClubId = k.clubId || k.lastClubId || null; k.lastSchoolId = k.schoolId || k.lastSchoolId || null;
  k.clubId = null; k.schoolId = null; k.free = false; k.retired = true; k.retiredOn = G.date; k.leftWhy = why;
  if (own) addMsg({ category: 'szkółka', from: 'Trener szkółki', title: `${k.name} kończy przygodę z żużlem`, body: `<p>${esc(k.name)} (${ageAt(k.born, G.date)} lat) zrezygnował ze szkolenia – ${esc(why)}.</p>`, link: `#/adept/${k.id}` });
}
function adeptsMonthly() {
  for (const k of Object.values(G.academy)) {
    if (!kidActive(k) || k.ca == null) continue;
    const age = ageAt(k.born, G.date), o = kidOutlook(k);
    if (k.free) {
      if (age >= 16) { retireKid(k, 'nie znalazł szkółki do 16. roku życia'); continue; }
      if (chance(clamp(0.05 + (10 - o.amb) * 0.01, 0.02, 0.2))) { retireKid(k, 'bez szkółki stracił chęć do jazdy'); continue; }
    } else if (age >= 9 && o.rel < 0.75 && o.amb < 12 && chance(clamp(0.01 + (0.75 - o.rel) * 0.06 + (12 - o.amb) * 0.002, 0.005, 0.05))) {
      retireKid(k, 'słabo mu idzie i nie widzi dla siebie przyszłości w żużlu'); continue;
    }
  }
  for (const k of Object.values(G.academy)) {
    if (!kidActive(k) || !isForeignKid(k) || k.ca == null) continue;
    const age = ageAt(k.born, G.date);
    if (age < 16 || !['c500', 'c250'].includes(k.cat) || examChance(k) < 0.7 || !chance(0.25)) continue;
    const id = G.seq.rider = Math.max(G.seq.rider || 30000, 30000) + 1;
    const r = riderFromKid(k, id);
    const fed = typeof NATION_INFO !== 'undefined' && NATION_INFO[k.country] ? NATION_INFO[k.country].fed : 'krajowa federacja';
    r.country = k.country; if (k.nationalities) r.nationalities = k.nationalities.slice();
    r.clubId = null; r.contract = null;
    r.licence = { number: null, team: '', date: G.date, place: fed, foreign: true };
    G.riders[id] = r;
    delete G.academy[k.id];
    if (typeof moveAttrHist === 'function') moveAttrHist(k.id, id);
  }
}

// Odejście ze szkółki: kto chce się dalej ścigać, zostaje wolnym adeptem (do pozyskania przez szkółki); reszta kończy karierę
// Ambicja i postępy (CA względem rówieśników z tej samej klasy) – podstawa decyzji o dalszym ściganiu
function kidOutlook(k) {
  const amb = k.hidden ? k.hidden.ambition ?? 10 : 10;
  const mates = Object.values(G.academy).filter(x => kidActive(x) && x.cat === k.cat && x.ca != null).map(x => x.ca).sort((a, b) => a - b);
  const med = mates.length ? mates[Math.floor(mates.length / 2)] : k.ca ?? 0;
  return { amb, rel: med ? (k.ca ?? 0) / med : 1 };
}
function leaveAcademy(k, why) {
  const age = ageAt(k.born, G.date), o = kidOutlook(k);
  // od 16 lat bez szkółki nie ma już szans na licencję – koniec kariery; młodsi decydują od razu albo później (adeptsMonthly)
  const keep = age < 16 && chance(clamp(0.35 + (o.amb - 10) * 0.06 + (o.rel - 1) * 0.5, 0.05, 0.9));
  k.lastClubId = k.clubId || k.lastClubId || null; k.lastSchoolId = k.schoolId || k.lastSchoolId || null;
  k.clubId = null; k.schoolId = null;
  if (keep) { k.free = true; k.leftOn = G.date; k.leftWhy = why; }
  else { k.retired = true; k.free = false; k.retiredOn = G.date; k.leftWhy = why; }
  return keep;
}
// Nowy sezon: wolni adepci powyżej 22 lat bez licencji kończą karierę
function adeptsNewSeason() {
  for (const k of Object.values(G.academy)) {
    if (k.catalogOnly || k.retired) continue;
    const age = ageAt(k.born, G.date);
    if (k.free && age >= 16) retireKid(k, 'nie znalazł szkółki do 16. roku życia');
    else if (!k.free && age > 19 && !isForeignKid(k)) leaveAcademy(k, 'wiek');
  }
}
// Przyjęcie wolnego adepta do własnej szkółki
function signFreeKid(id) { // akcja ACT.signKid (js/ui-team.js)
  const k = G.academy[id];
  if (!k || !k.free || k.retired) return;
  k.clubId = G.clubId; k.free = false; k.joined = G.date;
  toast(`${k.name} dołącza do naszej szkółki.`, 'good'); changed();
}
// Oznaczenia na listach i w profilach
const adeptBadge = k => (k.retired ? ' <span class="pill" title="Zakończył karierę">koniec kariery</span>' : k.free ? ' <span class="pill u24" title="Bez szkółki – można go przyjąć">wolny</span>' : ''); // kraj licencji widać po fladze narodowości

// Juniorzy z licencją, którzy mało zarabiają, prawie nie jeżdżą w lidze i przywożą „ogony” – po sezonie mogą skończyć karierę
function juniorRetirements() {
  const S = G.season;
  for (const r of Object.values(G.riders)) {
    if (r.retired || !r.active || !isJunior(r, S)) continue;
    const k = r.contract;
    if (k && k.until > S) continue; // ważny kontrakt na kolejne sezony – jeździ dalej
    if (!hasNat(r, 'POL') || (r.fl && r.fl.list && r.fl.list.length)) continue; // zagraniczni mogą jeździć w swoim kraju; liga zagraniczna
    if (r.licence && String(r.licence.date || '').slice(0, 4) === String(S)) continue; // pierwszy sezon z licencją
    const st = r.stats[S] || {}, fs = Object.values((r.fstats || {})[S] || {});
    const heats = (st.heats || 0) + sum(fs.map(x => x.h || 0)), pts = (st.pts || 0) + (st.bonus || 0) + sum(fs.map(x => x.p || 0));
    const avg = heats ? pts / heats : 0;
    const pay = k ? (k.kind === 'amatorski' ? 0 : typeof termsFor === 'function' ? termsFor(k, S).signing || 0 : k.signing || 0) : 0;
    if (heats >= 25 || avg >= 1.0 || pay >= 40000) continue;
    const amb = r.hidden ? r.hidden.ambition ?? 10 : 10;
    const p = clamp(0.08 + (10 - amb) * 0.03 + (heats < 8 ? 0.08 : 0) + (avg < 0.5 ? 0.06 : 0) - (r.pa > 60 ? 0.1 : 0), 0.02, 0.45);
    if (!chance(p)) continue;
    if (r.clubId === G.clubId) { announceRetirement(r, 'mało startów i niskie zarobki', `jeździł niewiele (${heats} biegów, średnia ${avg.toFixed(2).replace('.', ',')}) i zarabiał niewiele`); continue; }
    r.retired = true; r.retiredOn = G.date; r.retiredWhy = 'mało startów i niskie zarobki';
  }
}

// Powrót zawodnika bez licencji (licencja wygasła): szansa odmowy rośnie z wiekiem i latami przerwy; młodzi mogą wracać nawet po długiej przerwie.
// Powyżej 40 lat – bez powrotu. Decyzja stała w danym sezonie (nie losowana przy każdej ofercie). Koniec kariery (retired) jest ostateczny.
function comebackRefuseChance(r) {
  const age = riderAge(r), off = Math.max(0, sportSeason() - 1 - lastStartSeason(r));
  return clamp(0.05 + 0.04 * Math.max(0, off - 1) + (age > 30 ? 0.06 * (age - 30) : 0), 0, 0.95);
}
function comebackOk(r) {
  if (r.retired) return false;
  if (r.active) return true;
  if (riderAge(r) > 40) return false;
  const u = (hashStr(`${G.seed}|comeback|${r.id}|${sportSeason()}`) % 1000) / 1000;
  return u >= comebackRefuseChance(r);
}
// Obcokrajowcy: koniec kariery po sezonie przy dwóch warunkach łącznie – wiek ponad 40 lat i duży spadek umiejętności
// (o ≥ 3 pkt CA w sezonie albo do ≤ 85% najlepszego poziomu); szansa rośnie z wiekiem
function foreignRetirements() {
  for (const r of Object.values(G.riders)) {
    if (r.retired || r.country === 'POL' || r.ca == null) continue;
    const age = riderAge(r);
    if (age <= 40) continue;
    const prev = r.dev && r.dev.seasonCa != null ? r.dev.seasonCa : r.ca;
    const hist = typeof attrHistSeries === 'function' ? attrHistSeries(r).map(p => p.v.ca) : [];
    const peak = Math.max(r.ca, prev, r.pa || 0, ...(r.hist || []).map(h => h.s * 5), ...hist); // PA – poziom w szczycie kariery
    const drop = prev - r.ca;
    if (!(drop >= 3 || r.ca <= peak * 0.85)) continue;
    if (!chance(clamp(0.15 + (age - 41) * 0.07 + Math.max(0, drop - 3) * 0.03, 0.1, 0.85))) continue;
    if (r.clubId === G.clubId) { announceRetirement(r, 'wiek i spadek formy', `ma ${age} lat, a forma wyraźnie spadła`); continue; }
    r.retired = true; r.retiredOn = G.date; r.retiredWhy = 'wiek i spadek formy';
  }
}

// ---------- Zamiar zakończenia kariery (zawodnik naszego klubu) ----------
// Po sezonie zawodnik ogłasza zamiar; do 1 listopada można go poprosić o jeszcze jeden sezon (jedna rozmowa) i wynegocjować kontrakt.
// Bez nowego kontraktu na kolejny sezon – przy starcie nowego sezonu kończy karierę.
function announceRetirement(r, why, detail) {
  r.retireIntent = { on: G.date, why, season: G.season };
  addMsg({ category: 'drużyna', from: 'Sekretariat', stop: true, title: `${r.name} chce zakończyć karierę`,
    body: `<p>${esc(r.name)} zapowiada koniec kariery po sezonie ${G.season} – ${esc(detail)}.</p><p>Możesz poprosić go o jeszcze jeden sezon i wynegocjować nowy kontrakt (profil zawodnika → Kontrakt). Bez umowy na sezon ${G.season + 1} zakończy karierę 1 listopada.</p>`,
    link: `#/zawodnik/${r.id}/kontrakt` });
}
// Szansa, że zawodnik da się namówić na kolejny sezon: ambicja, forma, wiek, powód decyzji
function persuadeChance(r) {
  const amb = r.hidden ? r.hidden.ambition ?? 10 : 10, age = riderAge(r), why = r.retireIntent ? r.retireIntent.why : '';
  let p = 0.4 + (amb - 10) * 0.04 + clamp(r.form || 0, -1, 1) * 0.08;
  if (/wiek/.test(why)) p -= Math.max(0, age - 40) * 0.05; else p += 0.15; // młody, któremu brakuje startów i pieniędzy – łatwiej go przekonać
  return clamp(p, 0.08, 0.9);
}
function persuadeStay(id) { // akcja ACT.persuadeStay (js/ui-team.js)
  const r = G.riders[id], it = r && r.retireIntent;
  if (!it || it.asked) return;
  it.asked = true;
  it.persuaded = chance(persuadeChance(r));
  toast(it.persuaded ? `${r.name} zgadza się pojeździć jeszcze sezon – zaproponuj mu kontrakt.` : `${r.name} podtrzymuje decyzję o końcu kariery.`, it.persuaded ? 'good' : 'bad');
  changed();
}
// Start nowego sezonu: zamiar bez nowej umowy → koniec kariery; z umową → zostaje
function finalizeRetireIntents() {
  for (const r of Object.values(G.riders)) {
    const it = r.retireIntent;
    if (!it) continue;
    const signed = (r.contract && r.contract.until >= G.season) || (r.nextContract && r.nextContract.from <= G.season);
    if (it.persuaded && signed) { delete r.retireIntent; continue; }
    r.retired = true; r.retiredOn = G.date; r.retiredWhy = it.why; delete r.retireIntent;
    r.prevClubId = r.clubId || r.prevClubId; r.clubId = null; r.contract = null;
    if (r.prevClubId === G.clubId) addMsg({ category: 'drużyna', from: 'Sekretariat', title: `${r.name} zakończył karierę`, body: `<p>${esc(r.name)} zakończył karierę${it.persuaded ? ' – mimo zgody na rozmowy nie podpisaliśmy nowej umowy' : ''}.</p>`, link: `#/zawodnik/${r.id}` });
  }
}
// Panel w zakładce Kontrakt
function retireIntentPanel(r) {
  const it = r.retireIntent;
  if (!it || r.clubId !== G.clubId) return '';
  return `<div class="panel" style="margin-bottom:14px;border-color:var(--warn)"><h3>Zamiar zakończenia kariery</h3>
    <p>${esc(r.name)} zapowiedział koniec kariery po sezonie ${it.season} (${esc(it.why)}). Bez nowej umowy na sezon ${it.season + 1} zakończy karierę 1 listopada.</p>
    ${!it.asked ? `<button class="btn primary" onclick="ACT.persuadeStay(${r.id})">Poproś o jeszcze jeden sezon</button> <span class="small muted">Masz jedną rozmowę – szansa zależy od ambicji, formy i wieku zawodnika.</span>`
      : it.persuaded ? '<p class="pos"><b>Zgodził się pojeździć jeszcze sezon.</b> Zaproponuj mu kontrakt (przedłużenie) poniżej.</p>' : '<p class="neg">Podtrzymuje decyzję – zakończy karierę.</p>'}</div>`;
}

// Weterani naszego klubu z kończącym się kontraktem (reguła nowego sezonu w game.js: 43+ lat albo 38+ i słaby poziom) – zapowiedź przy końcu sezonu,
// żeby można było ich przekonać i przedłużyć umowę (podpisany kontrakt wyłącza tę regułę)
function ownVeteranIntents() {
  for (const r of Object.values(G.riders)) {
    if (r.clubId !== G.clubId || r.retired || r.retireIntent || !r.contract || r.contract.until > G.season) continue;
    const age = riderAge(r);
    const p = age >= 43 ? 1 : age >= 38 && r.skill < 8 ? 0.4 : 0;
    if (p && chance(p)) announceRetirement(r, 'wiek', `ma ${age} lat i myśli o zakończeniu kariery`);
  }
}
