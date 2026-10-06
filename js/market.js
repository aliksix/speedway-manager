'use strict';
// Rynek zawodników według przepisów PZM 2026 (Regulamin Przynależności Klubowej – RPK, Zbiór Zasad; analiza:
// tools/sources/regulaminy/ANALIZA_kontrakty_transfery.md):
// - okienka: podstawowe 16–20.11, uzupełniające 22–31.12, śródroczne (5 dni po 3., 6., 10. i 14. kolejce) tylko dla wolnych zawodników,
// - zakaz kontaktów z zawodnikiem z ważnym kontraktem do 15.06 ostatniego roku umowy; od 15.06 prekontrakty na kolejny sezon,
// - kontrakty 1–6 sezonów z kwotami osobno na każdy sezon, kwota stała w 6 ratach (luty–lipiec), kontrakt amatorski juniora,
// - ekwiwalent za wyszkolenie (do 160 tys. zł za rok) za zawodników do 21 lat, klauzula odstępnego,
// - wypożyczenia do ostatniej rundy sezonu zasadniczego, zawodnik z najwyżej 12 punktami, raz w sezonie, do 31.10,
// - negocjacje trwają kilka dni: zawodnik rozważa wszystkie oferty na stole, a kluby mogą poprawiać warunki.

const WIN_BASIC = ['11-16', '11-20'], WIN_SUPP = ['12-22', '12-31'];
const PRECONTRACT_FROM = '06-15';
const MID_ROUNDS = [3, 6, 10, 14];
const MAX_YEARS = 6;
const STIPEND_MAX = 1000; // kontrakt amatorski: stypendium do 1000 zł brutto miesięcznie (Zbiór Zasad §17)
const EQUIP_VALUE = { PGE: 120000, '2E': 80000, KLZ: 50000 }; // roczne koszty sprzętu juniora na kontrakcie amatorskim (pokrywa klub)
const COMP_PER_YEAR = 160000; // ekwiwalent za wyszkolenie – maksimum za rok (art. 240 RPK)
const NEG_OPEN = ['club', 'terms', 'pending', 'counter']; // terms: klub się zgodził, czekamy na warunki dla zawodnika (oferta dwuetapowa)

const leagueOf = clubId => (G.clubs[clubId] ? G.clubs[clubId].league : 'KLZ');
const round5k = v => Math.max(0, Math.round(v / 5000) * 5000);
const round100 = v => Math.max(0, Math.round(v / 100) * 100);

// ---------- Okienka transferowe ----------
let MW_CACHE = { key: null, map: {} };
// Okienka śródroczne ligi: pięć dni po kalendarzowej dacie 3., 6., 10. i 14. kolejki (mecze przełożone nie przesuwają okienek)
function midWindows(lg, season = G.season) {
  const key = `${season}|${Object.keys(G.fixtures).length}`;
  if (MW_CACHE.key !== key) MW_CACHE = { key, map: {} };
  if (MW_CACHE.map[lg]) return MW_CACHE.map[lg];
  const fx = Object.values(G.fixtures).filter(f => f.season === season && f.league === lg && f.stage === 'RS' && f.round);
  const out = [];
  MID_ROUNDS.forEach((n, i) => {
    const ds = fx.filter(f => f.round === n).map(f => f.date).sort();
    if (!ds.length) return;
    const weekend = ds.filter(d => dayDiff(ds[0], d) <= 3);
    const day = weekend[weekend.length - 1];
    out.push({ kind: 'mid', no: i + 1, season, league: lg, name: `okienko śródroczne ${['I', 'II', 'III', 'IV'][i]}`, from: addDays(day, 1), to: addDays(day, 5) });
  });
  return (MW_CACHE.map[lg] = out);
}
function fixedWindows(year) {
  return [{ kind: 'basic', name: 'podstawowe okienko transferowe', from: `${year}-${WIN_BASIC[0]}`, to: `${year}-${WIN_BASIC[1]}` },
    { kind: 'supp', name: 'uzupełniające okienko transferowe', from: `${year}-${WIN_SUPP[0]}`, to: `${year}-${WIN_SUPP[1]}` }];
}
// Sezon, którego dotyczą zgłoszenia w okienku (okienka listopadowe i grudniowe – sezon następnego roku)
const windowSeason = w => (w.kind === 'mid' ? w.season : yearOf(w.from) + 1);
function allWindows(lg, date = G.date) {
  const y = yearOf(date);
  return [...fixedWindows(y - 1), ...fixedWindows(y), ...fixedWindows(y + 1), ...(lg ? midWindows(lg) : [])].sort(by(w => w.from));
}
function windowAt(date = G.date, lg = null, kinds = null) {
  return allWindows(lg, date).find(w => date >= w.from && date <= w.to && (!kinds || kinds.includes(w.kind))) || null;
}
function nextWindow(date = G.date, lg = null, kinds = null) {
  return allWindows(lg, date).find(w => w.to >= date && (!kinds || kinds.includes(w.kind))) || null;
}
// Lista okienek sezonu (do wyświetlenia) dla ligi
function seasonWindows(lg, season = sportSeason()) {
  return [...fixedWindows(season - 1), ...midWindows(lg, season)];
}
function lastRegularRound(lg, season) {
  const ds = Object.values(G.fixtures).filter(f => f.season === season && f.league === lg && f.stage === 'RS').map(f => f.date).sort();
  return ds.length ? ds[ds.length - 1] : null;
}
const precontractOpen = () => G.seasonClosed !== G.season && G.date.slice(5) >= PRECONTRACT_FROM && G.date.slice(5) < '11-01';
// Stan rynku dla nagłówka zakładki Transfery
function marketPhase(lg = myClub().league) {
  const w = windowAt(G.date, lg);
  const nw = w ? null : nextWindow(G.date, lg);
  const parts = [];
  if (w) parts.push(`<span class="pos">Otwarte: ${esc(w.name)}</span> (do ${fmtDateShort(w.to)}${w.kind === 'mid' ? ', tylko zawodnicy bez klubu' : ''})`);
  else if (nw) parts.push(`Okienko zamknięte – najbliższe: ${esc(nw.name)} ${fmtDateShort(nw.from)}–${fmtDateShort(nw.to)}`);
  if (precontractOpen() || G.seasonClosed === G.season) parts.push('<span class="pos">trwa okres prekontraktów</span> (zawodnicy z kończącymi się umowami)');
  return parts.join(' · ');
}

// ---------- Kontrakty ----------
function termsFor(k, season) {
  if (!k) return null;
  const t = k.terms && k.terms[season];
  return t ? { signing: t.signing, perPoint: t.perPoint } : { signing: k.signing, perPoint: k.perPoint };
}
// Kwoty na kolejne sezony: podpis rośnie (lub maleje) o o.raise % rocznie, stawka za punkt bez zmian
function makeTerms(o, from, years) {
  const t = {};
  for (let i = 0; i < years; i++) t[from + i] = { signing: round5k((o.signing || 0) * Math.pow(1 + (o.raise || 0) / 100, i)), perPoint: round100(o.perPoint || 0) };
  return t;
}
function makeContract(clubId, o, from, source) {
  const warsaw = o.kind === 'warszawski'; // kontrakt warszawski: bez wynagrodzenia, na jeden sezon
  const years = warsaw ? 1 : clamp(o.years | 0 || 1, 1, MAX_YEARS);
  const amateur = o.kind === 'amatorski';
  if (warsaw) o = { ...o, signing: 0, perPoint: 0, pp10: 0, youthPP: 0, bonuses: [], medalBonus: 0, raise: 0 };
  const terms = amateur ? null : makeTerms(o, from, years);
  return { clubId, kind: amateur ? 'amatorski' : warsaw ? 'warszawski' : 'zawodowy', signing: amateur ? 0 : terms[from].signing, perPoint: amateur ? 0 : round100(o.perPoint),
    stipend: amateur ? clamp(Math.round(o.stipend || STIPEND_MAX), 0, STIPEND_MAX) : 0, from, until: from + years - 1, terms,
    pp10: amateur ? 0 : round100(o.pp10 || 0), youthPP: amateur ? 0 : round100(o.youthPP ?? defaultYouthPP(o.perPoint)), medalBonus: Math.round(o.medalBonus || 0), buyout: Math.round(o.buyout || 0),
    bonuses: (o.bonuses || []).filter(b => b.amount > 0 && BONUS_TYPES[b.type]).map(b => ({ type: b.type, amount: Math.round(b.amount), ...(b.thr != null ? { thr: b.thr } : {}) })),
    role: warsaw ? 'awaryjny' : o.role && typeof TEAM_ROLES !== 'undefined' && TEAM_ROLES[o.role] ? o.role : null, // rola w drużynie (js/roles.js); kontrakt warszawski – tylko „awaryjny”
    promoRaise: amateur ? 0 : clamp(Math.round(o.promoRaise || 0), 0, 100), relegDrop: amateur ? 0 : clamp(Math.round(o.relegDrop || 0), 0, 80),
    source, signed: G.date, paid: { season: from, n: 0 } };
}
// Pierwszy kontrakt po egzaminie licencyjnym: z klubem szkolącym, najdłużej do końca sezonu 21. urodzin (art. 230 RPK)
function firstContract(r, clubId, season = G.season) {
  const by = Number(r.born.slice(0, 4));
  const k = makeContract(clubId, { kind: 'amatorski', stipend: STIPEND_MAX, years: clamp(Math.min(by + 21, season + 2) - season + 1, 1, MAX_YEARS) }, season, 'wychowanek – pierwszy kontrakt');
  r.trainedBy = clubId; r.trainedSince = season; r.homeClubId = clubId;
  if (clubId === G.clubId) k.rolePending = true; // klub gracza: rolę w drużynie wybiera menedżer (js/roles.js – chooseFirstRole)
  return k;
}
const canAmateur = (r, season = sportSeason()) => hasNat(r, 'POL') && isJunior(r, season);
// Umowa, z której zawodnik jest opłacany w danej chwili (wypożyczenie albo kontrakt z klubem, w którym jeździ)
function activeDeal(r) {
  if (r.loan && r.loan.toClubId === r.clubId) return r.loan;
  return r.contract && r.contract.clubId === r.clubId ? r.contract : null;
}
// Umowa na listach (jak w FM): data wygaśnięcia i wynagrodzenie – zawodnik za punkt (amator: stypendium), sztab miesięcznie.
// Bez kwot za podpis i premii – te są w profilu (zakładka Kontrakt). Kontrakty wygasają 31 października ostatniego sezonu.
const dealEndDate = season => fmtDateShort(`${season}-10-31`);
function riderDeal(r) {
  const k = activeDeal(r) || r.contract;
  if (!k) return null;
  const loan = !!r.loan && k === r.loan;
  const pay = k.kind === 'amatorski' ? `${fmtMoney(k.stipend || 0)} / mies.` : k.kind === 'warszawski' ? 'bez wynagrodzenia'
    : `${fmtMoney((loan ? k : termsFor(k, sportSeason()) || k).perPoint || 0)} / pkt`;
  return { end: loan ? fmtDateShort(r.loan.until) : dealEndDate(k.until), pay, ppSort: loan ? k.perPoint || 0 : (termsFor(k, sportSeason()) || k).perPoint || 0, loan };
}
function staffDeal(s) {
  const has = !!(s.clubId && s.until);
  const wage = has ? s.wage || 0 : typeof staffWageFor === 'function' ? staffWageFor(s, typeof myClub === 'function' && G.clubId ? myClub() : null) : s.wage || 0;
  return { end: has ? dealEndDate(s.until) : null, pay: `${fmtMoney(wage)} / mies.${has ? '' : ' (oczek.)'}`, wage };
}
// Komórki tabel: „Kontrakt do” i „Wynagrodzenie”
const riderDealCells = r => { const d = riderDeal(r); return d ? `<td class="nowrap">${d.end}${d.loan ? ` <span class="small muted">wyp.</span>` : ''}</td><td class="num nowrap">${d.pay}</td>` : '<td>—</td><td class="num">—</td>'; };
const staffDealCells = s => { const d = staffDeal(s); return `<td class="nowrap">${d.end || '—'}</td><td class="num nowrap">${d.pay}</td>`; };
function contractLabel(k) {
  if (!k) return '—';
  return k.kind === 'amatorski' ? `amatorski (stypendium ${fmtMoney(k.stipend)}/mies.)` : k.kind === 'wypożyczenie' ? 'wypożyczenie' : k.kind === 'warszawski' ? 'warszawski (bez wynagrodzenia, do wypożyczenia w każdej chwili)' : 'zawodowy';
}
// Koszt sezonu umowy (podpis + szacowane punkty, kontrakt amatorski: stypendium i sprzęt)
function dealSeasonCost(k, r, lg, season = G.season) {
  if (!k) return 0;
  if (k.kind === 'amatorski') return (k.stipend || 0) * 12 + EQUIP_VALUE[lg];
  const t = termsFor(k, season);
  return t.signing + t.perPoint * expectedSeasonPoints(r.skill, lg);
}

// ---------- Ekwiwalent za wyszkolenie (art. 240 RPK) ----------
// Stawki maksymalne za rok szkolenia od sezonu 2026 (GKSŻ): junior 500 cm³ 160 tys., licencja 250/500R 80 tys., miniżużel 125 cm³ 60 tys.,
// 85–140 cm³ 40 tys., pit bike 20 tys. zł. Ekwiwalent jest obowiązkowy, chyba że klub odstępujący postanowi inaczej; kluby mogą uzgodnić niższą kwotę.
const COMP_RATES = [['500', 'junior 500 cm³', 160000], ['250', 'licencja 250 / 500R', 80000], ['125', 'miniżużel 125 cm³', 60000], ['85', 'miniżużel 85–140 cm³', 40000], ['pit', 'pit bike', 20000]];
// Lata szkolenia w klubie szkolącym: od licencji 500 cm³; wcześniej 250/500R (2 lata) u wychowanków klubu, miniżużel – gdy zawodnik ma udokumentowaną przeszłość w szkółce
function compParts(r, season) {
  const yb = Number(r.born.slice(0, 4)), lic = r.trainedSince || yb + 16;
  const home = r.homeClubId === r.trainedBy || r.academyGraduate;
  const mini = home && (r.academyCatalogId || r.schoolId);
  // licencja 500 cm³ najwcześniej w wieku 16 lat
  const yrs = { '500': clamp(season - lic, 1, clamp(season - yb - 15, 1, MAX_YEARS)), '250': home ? 2 : 0, '125': mini ? 2 : 0, '85': mini ? 2 : 0, pit: 0 };
  return COMP_RATES.filter(([k]) => yrs[k]).map(([k, name, rate]) => ({ k, name, years: yrs[k], rate, amount: yrs[k] * rate }));
}
// Kwota, którą klub szkolący jest gotów przyjąć: potencjał zawodnika, liga klubu, wiek (lata juniorskie przed nim) i potrzeby składu –
// junior, który jest dziś czwarty w kolejce, a za rok wejdzie do trójki juniorów klubu (starsi przejdą do seniorów), jest potrzebny
function compPolicy(r, holderId, season, max) {
  const h = G.clubs[holderId];
  if (holderId === G.clubId) return { ask: max, needed: false, refuse: false }; // gracz decyduje sam przy każdej ofercie
  const yb = Number(r.born.slice(0, 4)), age = season - yb;
  const pa = perceive(r, holderId).paMid;
  const mine = Object.values(G.riders).filter(x => x.contract && x.contract.clubId === holderId && x.contract.kind !== 'warszawski' && !x.retired);
  const rankNow = mine.filter(x => isJunior(x, season)).sort(by(x => x.skill, -1)).indexOf(r);
  const rankNext = mine.filter(x => x.contract.until > season && season + 1 - Number(x.born.slice(0, 4)) <= 21).sort(by(x => x.skill, -1)).indexOf(r);
  const needed = (rankNow >= 0 && rankNow < 3) || (rankNext >= 0 && rankNext < 3);
  const lgF = { PGE: 1, '2E': 0.8, KLZ: 0.6 }[h.league] || 0.6;
  const paF = clamp((pa - 45) / 40, 0.15, 1);
  const ageF = age <= 18 ? 1 : age === 19 ? 0.9 : age === 20 ? 0.75 : 0.55;
  let f = lgF * paF * ageF;
  if (needed) f = Math.max(f, 0.9);
  else f *= 0.7;
  if (!needed && pa < 55 && rankNow >= 5 && age >= 19) f = 0; // słaby junior spoza kadry meczowej – klub rezygnuje z ekwiwalentu
  return { ask: round5k(max * clamp(f, 0, 1)), needed, refuse: needed && pa >= 60, pa, rankNow, rankNext };
}
function trainingComp(r, toClubId, season = sportSeason()) {
  if (!r.trainedBy || r.trainedBy === toClubId || !hasNat(r, 'POL') || !G.clubs[r.trainedBy]) return null;
  const yb = Number(r.born.slice(0, 4));
  if (yearOf(G.date) - yb > 21) return null; // tylko do końca roku 21. urodzin
  if (r.lastUntil === yb + 21 && !(r.contract && r.contract.clubId === r.trainedBy && r.contract.until > yb + 21)) return null; // kontrakt wygasł w roku 21. urodzin
  const parts = compParts(r, season), max = sum(parts.map(p => p.amount));
  const pol = compPolicy(r, r.trainedBy, season, max);
  return { clubId: r.trainedBy, parts, max, amount: pol.ask, needed: pol.needed, refuse: pol.refuse, years: sum(parts.map(p => p.years)) };
}
const compText = c => c.parts.map(p => `${p.years} × ${fmtMoney(p.rate, true)} (${p.name})`).join(' + ');

// ---------- Status zawodnika na rynku (dla danego klubu) ----------
// mode: free (wolny), precontract (kończy mu się umowa – prekontrakt na kolejny sezon), renewal (własny zawodnik),
// transfer (ważny kontrakt – zgoda klubu i odstępne). completes: data realizacji (rejestracja w okienku) albo 'now'.
// Zawodnik z kartą w szkółce niezależnej: opłata dla szkółki zamiast ekwiwalentu (js/schools.js)
function marketStatus(r, clubId = G.clubId) {
  const st = marketStatusBase(r, clubId);
  return r.schoolRights && typeof schoolStatus === 'function' ? schoolStatus(r, clubId, st) : st;
}
// Opłata przy podpisaniu kontraktu z wolnym zawodnikiem (null – nie można go pozyskać)
function signFee(r, clubId, S) {
  if (r.schoolRights) { const st = marketStatus(r, clubId); return st.ok ? st.fee || 0 : null; }
  const comp = trainingComp(r, clubId, S);
  return comp ? comp.amount : 0;
}
function marketStatusBase(r, clubId = G.clubId) {
  const S = sportSeason(), lg = leagueOf(clubId);
  // bez licencji można podpisać kontrakt – startować zawodnik może dopiero po egzaminie na licencję „Ż” (js/rider-licence.js)
  if (r.retired) return { ok: false, text: 'Zawodnik zakończył karierę.' }; // decyzja ostateczna – bez powrotów
  if (typeof plBanned === 'function' && plBanned(r, `${S}-01-01`)) return { ok: false, text: plBanText(r) }; // zawieszenie FIM bez polskiego obywatelstwa (js/nationality.js)
  if (r.retireIntent && !r.retireIntent.persuaded) return { ok: false, text: `${r.name} zapowiedział koniec kariery – najpierw poproś go o jeszcze jeden sezon.` };
  if (!r.active && typeof comebackOk === 'function' && !comebackOk(r)) return { ok: false, text: `${r.name} nie ma licencji i w tym sezonie nie planuje powrotu do ścigania.` };
  if (r.nextContract) return { ok: false, agreed: true, text: `${r.name} ma już uzgodniony kontrakt z klubem ${G.clubs[r.nextContract.clubId].name} od sezonu ${r.nextContract.from}.` };
  const ag = r.agreed && G.negs[r.agreed];
  if (ag && ag.status === 'agreed' && !ag.done) return { ok: false, agreed: true, text: `${r.name} uzgodnił przejście do klubu ${G.clubs[ag.clubId].name} (rejestracja ${fmtDateShort(ag.completes)}).` };
  // kontrakt warszawski z innym klubem nie blokuje podpisania umowy – zawodnik jest traktowany jak wolny
  const k = r.contract && !(r.contract.kind === 'warszawski' && r.contract.clubId !== clubId) ? r.contract : null;
  const comp = trainingComp(r, clubId, S);
  if (k && k.clubId === clubId) {
    if (k.until < S || (k.until === G.season && precontractOpen())) return { ok: true, mode: 'renewal', forSeason: k.until + 1, completes: 'now', fee: 0 };
    return { ok: false, mode: 'renewal', text: `Kontrakt obowiązuje do końca sezonu ${k.until}. Przedłużenie możliwe dopiero od 15 czerwca ${k.until} r. (art. 223 RPK).` };
  }
  if (!k || k.until < S) {
    if (k && k.until < S && G.seasonClosed === G.season) // umowa formalnie do 31.10 – prekontrakt, przejście 1 listopada
      return { ok: true, mode: 'precontract', forSeason: S, completes: `${G.season}-11-01`, fee: comp ? comp.amount : 0, comp };
    const rode = (r.stats[G.season] || {}).m > 0;
    let kinds = rode ? ['basic', 'supp'] : null; // w okienkach śródrocznych tylko zawodnicy niezgłoszeni w tym sezonie (art. 213 ust. 2)
    if (typeof licNoBasicWindow === 'function' && licNoBasicWindow(clubId)) kinds = (kinds || ['supp', 'mid']).filter(k => k !== 'basic'); // klub zagrożony finansowo
    const w = windowAt(G.date, lg, kinds), nw = w || nextWindow(G.date, lg, kinds);
    if (!nw) return { ok: false, text: 'Brak kolejnego okienka transferowego w kalendarzu.' };
    return { ok: true, mode: 'free', forSeason: windowSeason(nw), completes: w ? 'now' : nw.from, window: nw, fee: comp ? comp.amount : 0, comp };
  }
  if (k.until === G.season && G.seasonClosed !== G.season) {
    if (precontractOpen()) return { ok: true, mode: 'precontract', forSeason: G.season + 1, completes: `${G.season}-11-01`, fee: comp ? comp.amount : 0, comp };
    return { ok: false, text: `Kontrakt z klubem ${G.clubs[k.clubId].name} wygasa po sezonie ${k.until}. Zakaz kontaktów do 15 czerwca – wtedy można podpisać prekontrakt (art. 223 RPK).` };
  }
  // ważny kontrakt na kolejne sezony: zgoda klubu (odstępne, klauzula odstępnego albo ekwiwalent), rejestracja w okienku listopadowym lub grudniowym
  const tk = typeof licNoBasicWindow === 'function' && licNoBasicWindow(clubId) ? ['supp'] : ['basic', 'supp'];
  const w = windowAt(G.date, lg, tk), nw = w || nextWindow(G.date, lg, tk);
  const fee = k.buyout ? k.buyout : comp ? comp.amount : feeAsk(r);
  return { ok: true, mode: 'transfer', holder: k.clubId, forSeason: windowSeason(nw), completes: w ? 'now' : nw.from, window: nw, fee, comp, buyout: k.buyout || 0 };
}
function loanStatus(r, toClubId = G.clubId) {
  const S = sportSeason(), k = r.contract;
  if (typeof plBanned === 'function' && plBanned(r, `${S}-01-01`)) return { ok: false, text: plBanText(r) }; // zawieszenie FIM bez polskiego obywatelstwa
  if (r.schoolRights) return { ok: false, school: true, text: `Kartę zawodnika ma szkółka ${(G.miniSchools[r.schoolRights] || {}).name || ''} – wypożyczenie bezpośrednio od szkółki.` };
  if (!k || !r.clubId) return { ok: false, text: 'Wypożyczyć można tylko zawodnika z ważnym kontraktem.' };
  if (k.clubId === toClubId) return { ok: false, text: 'To zawodnik naszego klubu.' };
  if (r.loan) return { ok: false, text: `${r.name} jest już wypożyczony do klubu ${G.clubs[r.loan.toClubId].name}.` };
  if (r.nextContract || r.agreed) return { ok: false, text: `${r.name} ma uzgodnione przejście do innego klubu.` };
  if (k.until < S) return { ok: false, text: 'Kontrakt zawodnika wygasa przed sezonem, którego dotyczyłoby wypożyczenie.' };
  const st = r.stats[S], pts = st ? st.pts + st.bonus : 0;
  if (k.kind === 'warszawski') return { ok: true, season: S, pts, until: `${S}-10-31`, holder: k.clubId, warsaw: true }; // wypożyczenie w każdej chwili
  if (r.loanSeason === S) return { ok: false, text: 'Zawodnik był już wypożyczony w tym sezonie (wypożyczenie raz na sezon – art. 242 RPK).' };
  if (pts > 12) return { ok: false, text: `${r.name} zdobył w tym sezonie ${pts} pkt w lidze – wypożyczyć można zawodnika z najwyżej 12 punktami (art. 243 RPK).` };
  const last = lastRegularRound(leagueOf(toClubId), S);
  if (last && G.date > last) return { ok: false, text: `Termin wypożyczeń minął (ostatnia runda sezonu zasadniczego: ${fmtDateShort(last)}).` };
  return { ok: true, season: S, pts, until: `${S}-10-31`, holder: k.clubId };
}

// ---------- Negocjacje ----------
// neg: { id, riderId, clubId, holderId, kind: contract|renewal|loan, stage: club|rider, status: club|pending|counter|agreed|rejected|withdrawn|expired,
//        terms, counter, decideBy, expires, round, mode, forSeason, completes, log[] }
const openNegs = riderId => Object.values(G.negs).filter(n => n.riderId === riderId && NEG_OPEN.includes(n.status));
const userNeg = riderId => Object.values(G.negs).find(n => n.riderId === riderId && n.clubId === G.clubId && (NEG_OPEN.includes(n.status) || (n.status === 'agreed' && !n.done)));
function negLog(n, text) { n.log.push({ d: G.date, t: text }); n.updated = G.date; }
// Wartość oferty dla zawodnika w złotych na sezon
function dealMoney(t, r, lg, clubId = null) {
  if (t.kind === 'amatorski') return (t.stipend || 0) * 12 + EQUIP_VALUE[lg];
  const pts = expectedSeasonPoints(r.skill, lg), yrs = clamp(t.years || 1, 1, MAX_YEARS);
  let v = (t.signing || 0) * (1 + (t.raise || 0) / 100 * (yrs - 1) / 2) + (t.perPoint || 0) * pts;
  if (t.pp10 > t.perPoint) v += (t.pp10 - t.perPoint) * pts * clamp((r.skill - 9) / 8, 0, 0.6); // stawka przy dwucyfrówce
  if (t.medalBonus) v += t.medalBonus * 0.25;
  v += 0.85 * bonusesEV(t, r, clubId); // premie wyceniane według szansy spełnienia warunku (zawodnik woli pewne pieniądze)
  if (clubId && yrs > 1 && (t.promoRaise || t.relegDrop)) {
    const rk = clubRank(clubId, r), later = (yrs - 1) / yrs;
    v += (t.signing || 0) * later * ((t.promoRaise || 0) / 100 * bonusChance({ type: 'promotion' }, r, clubId, rk) - (t.relegDrop || 0) / 100 * (1 - bonusChance({ type: 'stay' }, r, clubId, rk)));
  }
  return v;
}
// Miejsce w składzie: zawodnik słabszy od wielu kolegów będzie rzadko jeździł
function squadOutlook(r, clubId) {
  const jun = isJunior(r);
  const better = Object.values(G.riders).filter(x => x.clubId === clubId && x.id !== r.id && isJunior(x) === jun && x.skill > r.skill).length;
  return better >= (jun ? 3 : 6) ? 'rezerwa' : better >= (jun ? 2 : 5) ? 'rotacja' : 'skład';
}
function clubAppeal(r, clubId, kind) {
  const c = G.clubs[clubId], lvl = LEAGUES[c.league].level;
  let a = 1 + (c.rep - 50) / 500;
  const fit = r.skill >= 11.5 ? 1 : r.skill >= 9 ? 2 : 3; // liga pasująca do umiejętności
  if (lvl > fit) a *= 1 - 0.07 * (lvl - fit);
  if (r.contract && r.contract.clubId === clubId) a *= 1.06; // przywiązanie do obecnego klubu
  if (r.trainedBy === clubId && isJunior(r)) a *= 1.04;
  const out = squadOutlook(r, clubId);
  if (out === 'rezerwa') a *= kind === 'loan' ? 0.75 : 0.9;
  if (kind === 'loan' && out === 'skład') a *= 1.15; // wypożyczenie po to, by jeździć
  return a;
}
// Czego zawodnik oczekuje (zł/sezon) – oczekiwania rosną z liczbą ofert na stole i maleją, gdy czasu zostaje mało
function riderTarget(r, clubId, kind) {
  const lg = leagueOf(clubId), a = riderAsk(r, clubId);
  let want = a.signing + a.perPoint * expectedSeasonPoints(r.skill, lg);
  if (kind === 'loan') want *= 0.55 * remainingSeasonShare();
  const rivals = new Set(openNegs(r.id).filter(n => n.clubId !== clubId).map(n => n.clubId)).size;
  want *= 1 + Math.min(0.15, 0.05 * rivals);
  want *= urgency(r);
  return Math.max(want, 1000);
}
function remainingSeasonShare() { const m = Number(G.date.slice(5, 7)); return m >= 11 || m <= 2 ? 1 : clamp((8 - m) / 6, 0.25, 1); }
function urgency(r) {
  const md = G.date.slice(5);
  if (r.contract && r.contract.until >= sportSeason()) return 1.05; // ma ważną umowę – nie musi się spieszyć
  if (md >= '11-01' || G.seasonClosed === G.season) return md >= '12-15' ? 0.86 : md >= '12-01' ? 0.92 : 1; // wolny zawodnik przed końcem okienek (po sezonie)
  if (md <= '10-31' && md >= '04-01' && !(r.contract && r.contract.until >= G.season)) return 0.8; // wolny w trakcie sezonu
  if (md >= '10-01') return 0.95;
  return 1;
}
// Zawodnik zgadza się na kontrakt warszawski, gdy nie ma ważnego kontraktu, okienka są zamknięte i nie ma innych ofert
function warsawUtility(r, clubId) {
  if (r.contract && r.contract.kind !== 'warszawski' && r.contract.until >= sportSeason()) return 0;
  if (r.contract && r.contract.clubId === clubId) return 0;
  const md = G.date.slice(5);
  if (windowAt(G.date, leagueOf(clubId), ['basic', 'supp']) || md > '10-31') return 0.6; // trwają okienka – czeka na kontrakt zawodowy
  if (openNegs(r.id).some(n => n.clubId !== clubId && n.terms.kind !== 'warszawski')) return 0.3;
  return 1.05;
}
// Młody zawodnik z dużą rezerwą rozwoju nie chce wiązać się na długo: liczy, że za 2–3 lata dostanie dużo lepszy kontrakt
// (np. w wyższej lidze). Zwraca najdłuższą umowę, na którą zgodzi się bez dodatkowej rekompensaty (9 – bez ograniczeń).
function youngMaxYears(r) {
  const age = riderAge(r), gap = (r.pa ?? r.potential ?? 0) - (r.ca ?? (r.skill || 0) * 5);
  if (age > 23 || gap < 10) return 9;
  return gap >= 25 ? 2 : 3;
}
function negUtility(r, clubId, t, kind) {
  if (t.kind === 'warszawski') return warsawUtility(r, clubId);
  const lg = leagueOf(clubId);
  let u = dealMoney(t, r, lg, clubId) * clubAppeal(r, clubId, kind) / riderTarget(r, clubId, kind);
  if (typeof roleFit === 'function') u *= roleFit(r, clubId, t.role) * moraleFit(r, clubId); // obiecana rola i morale (js/roles.js)
  if (typeof dutyF === 'function') u *= 1 + (dutyF('contracts', clubId) - 1) * 0.5; // negocjator klubu gracza (js/board.js)
  // senior, który u nas byłby rezerwowym, a w innym klubie (choćby niższej ligi) jeździłby w składzie, nie chce siedzieć na ławce
  if (kind !== 'loan' && typeof expectedRole === 'function' && !isJunior(r) && r.skill >= LEAGUE_AVG_SKILL.KLZ) {
    const er = expectedRole(r, clubId, precontractOpen() || G.seasonClosed === G.season ? sportSeason() + (G.seasonClosed === G.season ? 0 : 1) : sportSeason());
    if (roleLvl(er) <= 3) u *= r.skill >= LEAGUE_AVG_SKILL['2E'] ? 0.6 : 0.75;
  }
  if (kind !== 'loan') {
    const want = riderAsk(r, clubId).years;
    u -= Math.min(0.1, Math.abs((t.years || 1) - want) * 0.025);
    // za długa umowa dla rozwijającego się młodego zawodnika: wyraźna kara; łagodzi ją klauzula odstępnego (furtka do odejścia) i rosnący kontrakt
    const over = (t.years || 1) - youngMaxYears(r);
    if (over > 0 && t.kind !== 'warszawski') {
      const gap = (r.pa ?? r.potential ?? 0) - (r.ca ?? (r.skill || 0) * 5);
      let pen = over * (0.1 + gap / 200);
      if (t.buyout && t.buyout <= riderValue(r) * 2.5) pen *= 0.5;
      if ((t.raise || 0) >= 10) pen *= 0.75;
      u -= pen;
    }
    if (t.buyout && t.buyout <= riderValue(r) * 2) u += 0.03; // klauzula odstępnego daje zawodnikowi swobodę
  }
  return u;
}
// Ostatni dzień na decyzję zawodnika
function negDeadline(n) {
  if (n.kind === 'loan') return addDays(G.date, 10);
  if (n.mode === 'precontract' || n.mode === 'renewal') return `${G.season}-10-31`; // 1 listopada umowa wygasa
  const w = n.mode === 'transfer' ? nextWindow(G.date, leagueOf(n.clubId), ['basic', 'supp']) : nextWindow(G.date, leagueOf(n.clubId));
  return w ? w.to : addDays(G.date, 14);
}
function thinkDays(n, u) {
  if (u < 0.6) return 1; // oferta niepoważna – szybka odpowiedź
  let d = rint(2, 5) + 2 * new Set(openNegs(n.riderId).filter(x => x.id !== n.id).map(x => x.clubId)).size;
  const slack = dayDiff(G.date, negDeadline(n));
  if (slack > 30) d += rint(3, 9); // dużo czasu do końca okna – zawodnik czeka na inne oferty
  return clamp(d, 1, Math.max(1, slack));
}
function newNeg(clubId, r, kind, terms, st) {
  G.seq.neg = G.seq.neg || 1;
  const id = `N${G.seq.neg++}`;
  const holder = kind === 'loan' ? r.contract.clubId : st.mode === 'transfer' ? st.holder : null;
  const n = G.negs[id] = { id, riderId: r.id, clubId, holderId: holder, kind, mode: kind === 'loan' ? 'loan' : st.mode, forSeason: kind === 'loan' ? st.season : st.forSeason,
    terms: { ...terms }, stage: holder && !(st.mode === 'transfer' && st.buyout && terms.fee >= st.buyout) ? 'club' : 'rider', status: 'pending', counter: null,
    created: G.date, updated: G.date, decideBy: null, expires: null, round: 0, log: [], twoStep: clubId === G.clubId && !!holder };
  if (n.twoStep && n.stage === 'rider') { n.status = 'terms'; n.expires = addDays(G.date, 14); return n; } // klauzula odstępnego: od razu rozmowy z zawodnikiem
  if (n.stage === 'club') { n.status = 'club'; n.decideBy = addDays(G.date, holder === G.clubId ? 7 : rint(1, 3)); }
  else n.decideBy = addDays(G.date, thinkDays(n, negUtility(r, clubId, n.terms, kind)));
  return n;
}
// Złożenie oferty (gracz lub klub AI). terms: { kind, signing, perPoint, years, raise, pp10, medalBonus, buyout, stipend, fee }
function makeOffer(clubId, riderId, terms, kind = 'contract') {
  const r = G.riders[riderId];
  const st = kind === 'loan' ? loanStatus(r, clubId) : marketStatus(r, clubId);
  if (!st.ok) return { ok: false, text: st.text };
  const lb = typeof licBlock === 'function' ? licBlock(clubId, kind, terms, st.mode) : null; // licencja: nadzór, zawieszenie, zaległości (js/licence.js)
  if (lb) return { ok: false, text: lb };
  const ban = G.negBan && G.negBan[`${clubId}|${riderId}`];
  if (ban && ban > G.date) return { ok: false, text: `${r.name} nie chce rozmawiać z klubem do ${fmtDate(ban)}.` };
  const old = Object.values(G.negs).find(n => n.riderId === riderId && n.clubId === clubId && NEG_OPEN.includes(n.status));
  if (old) return amendOffer(old.id, terms);
  if (kind !== 'loan' && st.mode === 'renewal') kind = 'renewal';
  const t = { ...terms, years: clamp(terms.years | 0 || 1, 1, MAX_YEARS) };
  if (t.kind === 'amatorski' && !canAmateur(r, st.forSeason || sportSeason())) return { ok: false, text: 'Kontrakt amatorski można zawrzeć tylko z krajowym zawodnikiem młodzieżowym (do 21 lat).' };
  if (t.kind === 'warszawski' && (st.mode !== 'free' || !canWarsaw(G.clubs[clubId]))) return { ok: false, text: 'Kontrakt warszawski można zawrzeć tylko z zawodnikiem bez ważnego kontraktu (i tylko przez klub aktywny w rozgrywkach).' };
  if (kind !== 'loan') t.fee = st.mode === 'transfer' ? Math.max(0, Math.round(t.fee || 0)) : st.fee || 0; // wolny zawodnik: ekwiwalent wg polityki klubu szkolącego
  if (kind !== 'loan' && st.mode === 'transfer' && st.comp && !st.buyout) t.fee = Math.min(t.fee, st.comp.max); // ekwiwalent nie może przekroczyć stawek z regulaminu
  const cap = capCheck(clubId, r, t, kind === 'loan' ? st.season : st.forSeason, kind);
  if (!cap.ok) return { ok: false, text: cap.text };
  if (typeof budgetCheck === 'function') { const bc = budgetCheck(clubId, r, t, kind === 'loan' ? st.season : st.forSeason, kind); if (!bc.ok) return { ok: false, budget: true, text: bc.text }; } // budżety płac i transferów
  const me = G.clubs[clubId];
  if (clubId === G.clubId && t.fee && me.cash < t.fee * 0.5) return { ok: false, text: `Klub nie ma środków na ${kind === 'loan' ? 'opłatę za wypożyczenie' : st.mode === 'transfer' ? 'odstępne' : 'ekwiwalent za wyszkolenie'} (${fmtMoney(t.fee, true)}).` };
  const n = newNeg(clubId, r, kind, t, st);
  negLog(n, n.stage === 'club' ? `Oferta dla klubu ${G.clubs[n.holderId].name}: ${fmtMoney(t.fee || 0)}${kind === 'loan' ? ' za wypożyczenie' : ' odstępnego'}.` : `Oferta dla zawodnika: ${termsText(n.terms)}.`);
  if (clubId !== G.clubId) noteInterest(r, clubId);
  if (n.holderId === G.clubId) userBidMessage(n);
  else if (clubId !== G.clubId && r.contract && r.contract.clubId === G.clubId && kind !== 'loan') notifyRivalOffer(n);
  return { ok: true, neg: n, text: n.stage === 'club' ? `Oferta wysłana do klubu ${G.clubs[n.holderId].name}. Odpowiedź do ${fmtDate(n.decideBy)}.` : `Oferta wysłana. ${r.name} odpowie najpóźniej ${fmtDate(n.decideBy)}.` };
}
function amendOffer(negId, terms) {
  const n = G.negs[negId], r = G.riders[n.riderId];
  if (!NEG_OPEN.includes(n.status)) return { ok: false, text: 'Negocjacje są zakończone.' };
  const t = { ...n.terms, ...terms, years: clamp((terms.years ?? n.terms.years) | 0 || 1, 1, MAX_YEARS) };
  if (n.kind !== 'loan' && n.mode !== 'transfer') t.fee = n.terms.fee;
  if (n.holderId && n.stage === 'rider') t.fee = n.terms.fee; // kwota uzgodniona z klubem
  if (typeof budgetCheck === 'function') { const bc = budgetCheck(n.clubId, r, n.stage === 'club' ? { fee: t.fee } : t, n.forSeason, n.kind, n.id); if (!bc.ok) return { ok: false, budget: true, text: bc.text }; }
  n.terms = t; n.counter = null; n.round++;
  if (n.stage === 'club') { n.status = 'club'; n.decideBy = addDays(G.date, n.holderId === G.clubId ? 7 : rint(1, 2)); }
  else { n.status = 'pending'; n.decideBy = addDays(G.date, Math.min(thinkDays(n, negUtility(r, n.clubId, t, n.kind)), rint(1, 3))); }
  negLog(n, `Nowe warunki: ${n.stage === 'club' ? `${fmtMoney(t.fee || 0)} dla klubu` : termsText(t)}.`);
  return { ok: true, neg: n, text: `Warunki zmienione. Odpowiedź do ${fmtDate(n.decideBy)}.` };
}
function withdrawOffer(negId, text = 'Oferta wycofana.') {
  const n = G.negs[negId];
  if (!n || !NEG_OPEN.includes(n.status)) return;
  n.status = 'withdrawn'; negLog(n, text);
}
function acceptCounter(negId) {
  const n = G.negs[negId];
  if (!n || n.status !== 'counter' || !n.counter) return { ok: false, text: 'Brak kontrpropozycji.' };
  n.terms = { ...n.terms, ...n.counter }; n.counter = null;
  n.status = n.stage === 'club' ? 'club' : 'pending'; n.decideBy = addDays(G.date, 1);
  negLog(n, 'Przyjęto warunki drugiej strony.');
  return { ok: true, text: 'Zaakceptowano warunki – odpowiedź jutro.' };
}
function termsText(t) {
  if (t.kind === 'warszawski') return 'kontrakt warszawski: bez wynagrodzenia, 1 sezon, wypożyczenie w każdej chwili';
  if (t.kind === 'amatorski') return `kontrakt amatorski, stypendium ${fmtMoney(t.stipend || 0)}/mies., ${t.years} ${plural(t.years, 'sezon', 'sezony', 'sezonów')}`;
  const extra = [t.raise ? `podpis ${t.raise > 0 ? '+' : ''}${t.raise}% rocznie` : '', t.pp10 ? `${fmtMoney(t.pp10)}/pkt przy 10+ pkt` : '', t.youthPP ? `${fmtMoney(t.youthPP)}/pkt w zawodach młodzieżowych` : '', ...dealBonuses(t).map(b => `premia: ${bonusLabel(b)} ${fmtMoney(b.amount, true)}`), t.promoRaise ? `+${t.promoRaise}% po awansie` : '', t.relegDrop ? `−${t.relegDrop}% po spadku` : '', t.buyout ? `klauzula odstępnego ${fmtMoney(t.buyout, true)}` : ''].filter(Boolean);
  return `${fmtMoney(t.signing || 0, true)} za podpis + ${fmtMoney(t.perPoint || 0)}/pkt${t.years ? `, ${t.years} ${plural(t.years, 'sezon', 'sezony', 'sezonów')}` : ''}${extra.length ? ` (${extra.join(', ')})` : ''}`;
}
// Kontrpropozycja zawodnika: podnosi kwoty tak, by oferta osiągnęła oczekiwany poziom
function counterTerms(n, goal) {
  const r = G.riders[n.riderId], lg = leagueOf(n.clubId), ask = riderAsk(r, n.clubId);
  let t = { ...n.terms };
  if (t.kind === 'amatorski' && negUtility(r, n.clubId, { ...t, stipend: STIPEND_MAX }, n.kind) < goal) t = { ...t, kind: 'zawodowy', signing: ask.signing * 0.6, perPoint: ask.perPoint * 0.8, stipend: 0 };
  else if (t.kind === 'amatorski') { t.stipend = STIPEND_MAX; return t; }
  if (n.kind !== 'loan' && Math.abs((t.years || 1) - ask.years) > 1) t.years = ask.years;
  if (n.kind !== 'loan' && (t.years || 1) > youngMaxYears(r) && t.kind !== 'amatorski') t.years = Math.min(t.years, Math.max(ask.years, youngMaxYears(r))); // młody zawodnik skraca umowę
  for (let i = 0; i < 4; i++) {
    const u = negUtility(r, n.clubId, t, n.kind);
    if (u >= goal) break;
    const f = Math.min(goal / Math.max(u, 0.2), 2.5);
    t.signing = round5k(Math.max(t.signing || 0, 5000) * f);
    t.perPoint = round100(Math.max(t.perPoint || 0, 300) * (1 + (f - 1) * 0.6));
  }
  return t;
}
function closeNeg(n, status, text, notify = true) {
  n.status = status; negLog(n, text);
  if (notify && n.clubId === G.clubId) addMsg({ category: 'transfer', from: G.riders[n.riderId].name, stop: status !== 'withdrawn', title: `${G.riders[n.riderId].name}: ${status === 'rejected' ? 'oferta odrzucona' : status === 'expired' ? 'rozmowy wygasły' : 'koniec rozmów'}`,
    body: `<p>${esc(text)}</p>`, link: `#/zawodnik/${n.riderId}/kontrakt` });
}
function setCounter(n, terms, text) {
  n.status = 'counter'; n.counter = terms; n.expires = addDays(G.date, Math.min(7, Math.max(1, dayDiff(G.date, negDeadline(n)))));
  negLog(n, text);
  if (n.clubId === G.clubId) addMsg({ category: 'transfer', from: n.stage === 'club' ? G.clubs[n.holderId].name : G.riders[n.riderId].name, stop: true,
    title: `${G.riders[n.riderId].name}: kontrpropozycja`, body: `<p>${esc(text)}</p><p>Odpowiedz do ${fmtDate(n.expires)} – przyjmij warunki albo zmień ofertę w profilu zawodnika.</p>`, link: `#/zawodnik/${n.riderId}/kontrakt` });
  else aiCounterReply(n);
}
// Zawodnik podejmuje decyzję (w dniu decideBy)
function riderDecides(n) {
  const r = G.riders[n.riderId];
  const st = n.kind === 'loan' ? loanStatus(r, n.clubId) : marketStatus(r, n.clubId);
  if (!st.ok) return closeNeg(n, 'rejected', st.text);
  if (n.terms.kind === 'warszawski') return negUtility(r, n.clubId, n.terms, n.kind) >= 1 ? agreeNeg(n) : closeNeg(n, 'rejected', `${r.name} nie chce kontraktu warszawskiego – woli poczekać na kontrakt zawodowy.`);
  const u = negUtility(r, n.clubId, n.terms, n.kind) + gauss(0.02);
  const rivals = openNegs(r.id).filter(x => x.id !== n.id && x.stage === 'rider' && x.kind !== 'loan' === (n.kind !== 'loan'));
  const best = rivals.reduce((m, x) => Math.max(m, negUtility(r, x.clubId, x.terms, x.kind)), 0);
  n.round++;
  if (u >= 1 && u >= best - 0.01) return agreeNeg(n);
  if (n.round >= 5) {
    G.negBan = G.negBan || {}; G.negBan[`${n.clubId}|${r.id}`] = addDays(G.date, 21);
    return closeNeg(n, 'rejected', `${r.name} zrywa rozmowy – nie doszliśmy do porozumienia.`);
  }
  if (u >= 1 && best > u) { const t = counterTerms(n, Math.min(best + 0.03, 1.35)); return setCounter(n, t, `${r.name} ma na stole lepszą ofertę innego klubu i oczekuje poprawy warunków: ${termsText(t)}.`); }
  if (u >= 0.7) { const t = counterTerms(n, 1.03); return setCounter(n, t, `${r.name} jest zainteresowany, ale oczekuje: ${termsText(t)}.`); }
  if (u >= 0.5 && n.round <= 2) { const t = counterTerms(n, 1.05); return setCounter(n, t, `${r.name} uważa ofertę za zbyt niską. Oczekuje: ${termsText(t)}.`); }
  return closeNeg(n, 'rejected', `${r.name} odrzuca ofertę klubu ${G.clubs[n.clubId].name}.`);
}
// Klub (właściciel karty zawodnika) odpowiada na ofertę odstępnego albo wypożyczenia
function clubDecides(n) {
  const r = G.riders[n.riderId], holder = G.clubs[n.holderId];
  if (n.holderId === G.clubId) { // gracz nie odpowiedział na czas
    closeNeg(n, 'expired', `Oferta klubu ${G.clubs[n.clubId].name} wygasła bez odpowiedzi.`, false);
    return;
  }
  const st = n.kind === 'loan' ? loanStatus(r, n.clubId) : marketStatus(r, n.clubId);
  if (!st.ok) return closeNeg(n, 'rejected', st.text);
  const toRider = text => { if (n.twoStep) return clubAgreed(n, text); n.stage = 'rider'; n.status = 'pending'; n.decideBy = addDays(G.date, thinkDays(n, negUtility(r, n.clubId, n.terms, n.kind))); negLog(n, text);
    if (n.clubId === G.clubId) addMsg({ category: 'transfer', from: holder.name, stop: true, title: `${holder.short} zgadza się – rozmowy z: ${r.name}`, body: `<p>${esc(text)}</p><p>Zawodnik odpowie na warunki kontraktu do ${fmtDate(n.decideBy)}.</p>`, link: `#/zawodnik/${r.id}/kontrakt` }); };
  const rank = Object.values(G.riders).filter(x => x.clubId === holder.id && x.skill > r.skill).length;
  if (n.kind === 'loan') {
    const lp = typeof holderPolicy === 'function' ? holderPolicy(r, holder.id, 'loan', n.forSeason || sportSeason()) : null;
    if (lp && lp.refuse && !r.loanListed && chance(0.85)) return closeNeg(n, 'rejected', `${holder.name}: ${lp.text}`);
    const spare = r.loanListed || (lp && !lp.refuse) || (isJunior(r) ? squadOutlook(r, holder.id) !== 'skład' : rank >= 7);
    // rywal z tej samej ligi: klub niechętnie go wzmacnia – zwłaszcza gdy rywalowi brakuje zawodnika do pierwszego składu
    const rival = loanRival(r, holder.id, n.clubId, n.forSeason || sportSeason());
    if (rival.same && !r.loanAsk) {
      if (chance(rival.gap ? 0.8 : 0.45)) return closeNeg(n, 'rejected', `${holder.name} nie wypożyczy zawodnika ligowemu rywalowi${rival.gap ? ` – ${G.clubs[n.clubId].short} brakuje go do pierwszego składu` : ''}.`);
    }
    // cena wypożyczenia ustalona przez klub (np. zawodnik z zawieszonymi startami): z każdą rundą rozmów klub schodzi z ceny, ale nie poniżej minimum
    const want = r.loanAsk ? round5k(Math.max(r.loanMin || 0, r.loanAsk * Math.pow(0.8, n.round || 0))) : round5k((r.loanListed ? 0 : riderValue(r) * 0.04) + (rival.same ? riderValue(r) * (rival.gap ? 0.12 : 0.06) : 0)); // rywal z ligi płaci więcej
    if (r.loanAsk && (n.terms.fee || 0) < want && (n.terms.fee || 0) >= (r.loanMin || 0)) { n.round = (n.round || 0) + 1; if (n.round > 4) return toRider(`${holder.name} zgadza się na wypożyczenie za ${fmtMoney(n.terms.fee || 0)}.`); }
    if (!spare && chance(0.8)) return closeNeg(n, 'rejected', `${holder.name} nie chce wypożyczać zawodnika – jest potrzebny w składzie.`);
    if ((n.terms.fee || 0) < want) return setCounter(n, { fee: want }, `${holder.name} zgodzi się na wypożyczenie za ${fmtMoney(want)}.`);
    return toRider(`${holder.name} zgadza się na wypożyczenie zawodnika.`);
  }
  const fee = n.terms.fee || 0;
  if (st.buyout && fee >= st.buyout) return toRider(`Zapłacono kwotę z klauzuli odstępnego (${fmtMoney(st.buyout)}) – klub musi zgodzić się na rozmowy.`);
  let need = st.comp && !st.buyout ? st.comp.amount : feeAsk(r) * (r.listed ? 0.8 : 1);
  const hp = typeof holderPolicy === 'function' ? holderPolicy(r, holder.id, 'transfer', n.forSeason || sportSeason()) : { mult: 1, role: rank < 3 ? 'lider' : 'podst' };
  const key = ['lider', 'wazny'].includes(hp.role) && !r.listed;
  if (hp.refuse && !r.listed) return closeNeg(n, 'rejected', `${holder.name}: ${r.name} to ${hp.text}`);
  if (key && G.seasonClosed !== G.season && Number(G.date.slice(5, 7)) <= 10 && chance(0.6)) return closeNeg(n, 'rejected', `${holder.name} nie sprzeda kluczowego zawodnika w trakcie sezonu.`);
  if (!st.comp || st.buyout) need *= hp.mult || 1;
  if (st.comp && !st.buyout && st.comp.refuse && !r.listed && chance(0.75)) return closeNeg(n, 'rejected', `${holder.name} nie odda ${r.name} – ${st.comp.needed ? 'junior jest potrzebny w składzie (także w przyszłym sezonie, gdy starsi juniorzy przejdą do seniorów)' : 'to utalentowany wychowanek'}.`);
  need = round5k(need);
  if (fee >= need) return toRider(`${holder.name} przyjmuje ofertę ${fmtMoney(fee)}.`);
  if (fee >= need * 0.7 && n.round < 3) { n.round++; return setCounter(n, { fee: need }, `${holder.name} oczekuje ${fmtMoney(need)}${st.comp ? ' (ekwiwalent za wyszkolenie)' : ' odstępnego'}.`); }
  return closeNeg(n, 'rejected', `${holder.name} odrzuca ofertę ${fmtMoney(fee)}.`);
}
// Oferta dwuetapowa (gracz): klub zgodził się na kwotę – teraz 14 dni na uzgodnienie kontraktu z zawodnikiem
function clubAgreed(n, text) {
  const r = G.riders[n.riderId], holder = G.clubs[n.holderId];
  n.stage = 'rider'; n.status = 'terms'; n.expires = addDays(G.date, 14); negLog(n, text);
  addMsg({ category: 'transfer', from: holder.name, stop: true, title: `${holder.short} zgadza się – teraz kontrakt z: ${r.name}`, body: `<p>${esc(text)}</p><p>Przedstaw zawodnikowi warunki ${n.kind === 'loan' ? 'wypożyczenia' : 'kontraktu'} (rola w drużynie, pieniądze) do ${fmtDate(n.expires)}. Bez porozumienia z zawodnikiem transfer nie dojdzie do skutku, a ${n.kind === 'loan' ? 'opłata' : 'odstępne'} nie zostanie zapłacone.</p>`, link: `#/oferta/${r.id}${n.kind === 'loan' ? '/wypozyczenie' : ''}` });
}
// Klub AI odpowiada na kontrpropozycję zawodnika lub klubu
function aiCounterReply(n) {
  const r = G.riders[n.riderId], c = G.clubs[n.clubId], lg = c.league;
  const t = { ...n.terms, ...n.counter };
  const before = n.stage === 'club' ? n.terms.fee || 0 : dealMoney(n.terms, r, lg, c.id), after = n.stage === 'club' ? t.fee || 0 : dealMoney(t, r, lg, c.id);
  const room = aiRoom(c, n.forSeason) + (n.stage === 'club' ? 0 : before);
  const wanted = n.kind === 'renewal' || n.kind === 'loan' || isJunior(r); // własnego zawodnika i juniora klub próbuje zatrzymać mimo budżetu
  const ok = after <= Math.max(before * 1.3, before + 20000) && (n.stage === 'club' ? after <= c.cash * 0.4 + 50000 : after <= room || wanted);
  if (ok) { n.terms = t; n.counter = null; n.status = n.stage === 'club' ? 'club' : 'pending'; n.decideBy = addDays(G.date, 1); negLog(n, `${c.name} przyjmuje warunki.`); }
  else { G.negBan = G.negBan || {}; G.negBan[`${c.id}|${r.id}`] = addDays(G.date, 28); closeNeg(n, 'withdrawn', `${c.name} wycofuje się z rozmów.`); }
}
function agreeNeg(n) {
  const r = G.riders[n.riderId];
  const st = n.kind === 'loan' ? loanStatus(r, n.clubId) : marketStatus(r, n.clubId);
  const cap = capCheck(n.clubId, r, n.terms, n.kind === 'loan' ? st.season : st.forSeason, n.kind);
  if (!cap.ok) return closeNeg(n, 'rejected', cap.text);
  const warsaw = n.terms.kind === 'warszawski'; // kontrakt warszawski: od razu, na bieżący sezon
  n.status = 'agreed'; n.completes = n.kind === 'loan' || warsaw || st.completes === 'now' ? G.date : st.completes; n.forSeason = n.kind === 'loan' ? st.season : warsaw ? sportSeason() : st.forSeason;
  negLog(n, n.kind === 'loan' ? `${r.name} zgadza się na wypożyczenie.` : `${r.name} akceptuje warunki: ${termsText(n.terms)}.`);
  for (const x of openNegs(r.id)) if (x.id !== n.id && (x.kind === 'loan') === (n.kind === 'loan')) closeNeg(x, 'rejected', `${r.name} wybrał ofertę klubu ${G.clubs[n.clubId].name}.`);
  if (n.clubId === G.clubId) addMsg({ category: 'transfer', from: r.name, stop: true, title: n.kind === 'loan' ? `${r.name} dołącza na wypożyczenie` : `${r.name} akceptuje warunki!`,
    body: `<p>${esc(n.kind === 'loan' ? `Wypożyczenie do 31 października ${n.forSeason}.` : `Warunki: ${termsText(n.terms)}.`)}</p>${n.completes > G.date ? `<p>Zgłoszenie zawodnika nastąpi ${fmtDate(n.completes)}${n.mode === 'precontract' || n.mode === 'renewal' ? ` – kontrakt obowiązuje od sezonu ${n.forSeason}` : ' (najbliższe okienko transferowe)'}.</p>` : ''}`, link: `#/zawodnik/${r.id}/kontrakt` });
  else if (r.clubId === G.clubId || (r.contract && r.contract.clubId === G.clubId)) addMsg({ category: 'transfer', from: 'Sekretariat', stop: true, title: `${r.name} odchodzi do ${G.clubs[n.clubId].short}`,
    body: `<p>${esc(r.name)} ${n.kind === 'loan' ? 'zostaje wypożyczony do klubu' : 'uzgodnił kontrakt z klubem'} <b>${esc(G.clubs[n.clubId].name)}</b>${n.completes > G.date ? ` (od ${fmtDate(n.completes)})` : ''}.</p>`, link: `#/zawodnik/${r.id}/kontrakt` });
  if (n.mode === 'precontract' || n.mode === 'renewal') {
    r.nextContract = makeContract(n.clubId, n.terms, n.forSeason, n.mode === 'renewal' ? 'przedłużenie (prekontrakt)' : 'prekontrakt (gra)');
    if (n.terms.fee) r.nextContract.comp = r.schoolRights ? { schoolId: r.schoolRights, amount: n.terms.fee } : { clubId: r.trainedBy, amount: n.terms.fee };
    n.done = n.completes <= G.date;
    if (n.mode === 'renewal') { n.done = true; logTransfer(r, n.clubId, n.clubId, 0, 'przedłużenie'); }
  } else if (n.completes <= G.date) executeDeal(n);
  else r.agreed = n.id;
}
function logTransfer(r, from, to, fee, kind) {
  G.transfersLog = G.transfersLog || [];
  G.transfersLog.push({ date: G.date, riderId: r.id, to, from: from || null, fee, kind, renewal: kind === 'przedłużenie' });
}
// Realizacja uzgodnionej umowy (w otwartym okienku albo od razu przy wypożyczeniu)
function executeDeal(n) {
  const r = G.riders[n.riderId], c = G.clubs[n.clubId];
  n.done = true; delete r.agreed;
  const old = r.clubId;
  if (n.kind === 'loan') {
    const parent = r.contract.clubId;
    if (n.terms.fee) { addTx(c.id, 'transfer', -n.terms.fee, `Wypożyczenie: ${r.name} (${G.clubs[parent].short})`); addTx(parent, 'transfer', n.terms.fee, `Wypożyczenie: ${r.name} do ${c.short}`); }
    r.loan = { kind: 'wypożyczenie', parentId: parent, toClubId: c.id, season: n.forSeason, from: G.date, until: `${n.forSeason}-10-31`, signing: round5k(n.terms.signing || 0), perPoint: round100(n.terms.perPoint || 0), fee: n.terms.fee || 0 };
    if (r.loan.signing) addTx(c.id, 'kontrakty', -r.loan.signing, `Kontrakt na wypożyczenie: ${r.name}`);
    r.loanSeason = n.forSeason; r.clubId = c.id; r.loanListed = false; delete r.loanAsk; delete r.loanMin;
    r.loan.role = n.terms.role || (typeof expectedRole === 'function' ? expectedRole(r, c.id) : null);
    logTransfer(r, parent, c.id, n.terms.fee || 0, 'wypożyczenie');
  } else {
    const holder = n.mode === 'transfer' ? r.contract && r.contract.clubId : null;
    if (r.schoolRights) schoolSold(r, c.id, n.terms.fee || 0);
    else if (holder && n.terms.fee) {
      addTx(c.id, 'transfer', -n.terms.fee, `${r.contract.buyout && n.terms.fee >= r.contract.buyout ? 'Klauzula odstępnego' : 'Odstępne'}: ${r.name} (${G.clubs[holder].short})`);
      addTx(holder, 'transfer', n.terms.fee, `Odstępne za ${r.name} (${c.short})`);
    } else if (n.terms.fee && r.trainedBy && G.clubs[r.trainedBy]) {
      addTx(c.id, 'transfer', -n.terms.fee, `Ekwiwalent za wyszkolenie: ${r.name} (${G.clubs[r.trainedBy].short})`);
      addTx(r.trainedBy, 'transfer', n.terms.fee, `Ekwiwalent za wyszkolenie: ${r.name}`);
    }
    if (r.loan) endLoan(r, true);
    if (old && old !== c.id) r.prevClubId = old;
    afterMove(r, c.id);
    r.clubId = c.id;
    r.contract = makeContract(c.id, n.terms, n.forSeason, n.mode === 'transfer' ? 'transfer (gra)' : 'wolny zawodnik (gra)');
    if (n.forSeason > G.season) r.contract.paid = { season: n.forSeason, n: 0 };
    logTransfer(r, holder || r.prevClubId, c.id, n.terms.fee || 0, n.mode === 'transfer' ? 'transfer' : 'wolny');
    if (typeof licOnSign === 'function') licOnSign(r, c.id); // zawodnik bez licencji: egzamin „Ż”
  }
  r.listed = false; r.morale = Math.max(r.morale ?? 70, 70); delete r.wantsOut; delete r.promiseWarn; // nowy klub – nowy start
  if (n.clubId === G.clubId) G.shortlist = G.shortlist.filter(x => x !== r.id);
  dropFromLineups(r.id);
  if (n.clubId === G.clubId && n.completes > n.created) addMsg({ category: 'transfer', from: 'Sekretariat', title: `${r.name} zgłoszony do klubu`, body: `<p>${esc(r.name)} został zgłoszony do rozgrywek w barwach klubu (${n.kind === 'loan' ? 'wypożyczenie' : `kontrakt do ${r.contract.until}`}).</p>`, link: `#/zawodnik/${r.id}` });
}
// Ekwiwalent przysługuje klubowi szkolącemu; klub, który pozyskał juniora od klubu szkolącego, przejmuje to prawo (art. 240 ust. 1 pkt 1b)
function afterMove(r, toClubId) {
  if (!r.trainedBy || r.trainedBy === toClubId) return;
  if (!r.trainedHop && isJunior(r)) { r.trainedBy = toClubId; r.trainedSince = sportSeason(); r.trainedHop = true; }
  else r.trainedBy = null;
}
function endLoan(r, silent) {
  const l = r.loan;
  if (!l) return;
  r.loan = null;
  const parentOk = r.contract && r.contract.clubId === l.parentId && r.contract.until >= G.season;
  r.clubId = parentOk ? l.parentId : null;
  if (!parentOk) { r.prevClubId = l.parentId; r.contract = null; }
  dropFromLineups(r.id);
  if (!silent && (l.parentId === G.clubId || l.toClubId === G.clubId)) addMsg({ category: 'transfer', from: 'Sekretariat', title: `Koniec wypożyczenia: ${r.name}`, body: `<p>${esc(r.name)} wraca do klubu ${esc(G.clubs[l.parentId].name)} po wypożyczeniu do ${esc(G.clubs[l.toClubId].name)}.</p>`, link: `#/zawodnik/${r.id}` });
}

// ---------- Oferty za zawodników gracza ----------
// Powód propozycji wypożyczenia od klubu AI (wiadomość dla gracza)
function loanReason(n) {
  const r = G.riders[n.riderId], c = G.clubs[n.clubId], S = n.forSeason;
  if (typeof isWarsaw === 'function' && isWarsaw(r)) return `Powód: ${c.short} nie jest w stanie obsadzić wszystkich numerów składu meczowego (kontuzje), a zawodnik ma kontrakt warszawski – do wypożyczenia w każdej chwili.`;
  if (isJunior(r, S)) return `Powód: ${c.short} szuka juniora lepszego od swojego drugiego juniora w składzie meczowym.`;
  return '';
}
function userBidMessage(n) {
  const r = G.riders[n.riderId], b = G.clubs[n.clubId];
  addMsg({ category: 'transfer', from: b.name, stop: true, title: n.kind === 'loan' ? `Propozycja wypożyczenia: ${r.name}` : `Oferta za ${r.name}: ${fmtMoney(n.terms.fee || 0, true)}`,
    body: n.kind === 'loan' ? `<p><b>${esc(b.name)}</b> chce wypożyczyć zawodnika <b>${esc(r.name)}</b> do końca sezonu ${n.forSeason}${n.terms.fee ? ` i zapłaci ${fmtMoney(n.terms.fee)}` : ' bez opłaty'}. ${loanReason(n)} Klub wypożyczający przejmuje wynagrodzenie zawodnika.</p>`
      : `<p><b>${esc(b.name)}</b> oferuje ${fmtMoney(n.terms.fee || 0)} odstępnego za zawodnika <b>${esc(r.name)}</b>. Po zgodzie klubu zawodnik negocjuje kontrakt; transfer nastąpi ${n.forSeason > G.season ? `w okienku przed sezonem ${n.forSeason}` : 'w najbliższym okienku'}.</p>`,
    link: `#/zawodnik/${r.id}/kontrakt`, action: { kind: 'neg', negId: n.id, state: 'open' } });
}
function notifyRivalOffer(n) {
  const r = G.riders[n.riderId];
  addMsg({ category: 'transfer', from: 'Sekretariat', title: `${r.name} otrzymał ofertę z ${G.clubs[n.clubId].short}`,
    body: `<p>${esc(G.clubs[n.clubId].name)} złożył ofertę kontraktu zawodnikowi <b>${esc(r.name)}</b>, któremu kończy się umowa z naszym klubem. Jeśli chcesz go zatrzymać, zaproponuj przedłużenie.</p>`, link: `#/zawodnik/${r.id}/kontrakt` });
}
// Decyzja gracza w sprawie oferty innego klubu (odstępne / wypożyczenie)
function userClubDecision(negId, accept) {
  const n = G.negs[negId];
  const msg = Object.values(G.messages).find(m => m.action && m.action.negId === negId);
  if (msg) msg.action.state = accept ? 'accepted' : 'rejected';
  if (!n || n.status !== 'club') return 'Oferta jest już nieaktualna.';
  const r = G.riders[n.riderId];
  if (!accept) { closeNeg(n, 'rejected', 'Klub odrzucił ofertę.', false); return 'Oferta odrzucona.'; }
  n.stage = 'rider'; n.status = 'pending'; n.decideBy = addDays(G.date, thinkDays(n, negUtility(r, n.clubId, n.terms, n.kind)));
  negLog(n, 'Klub wyraził zgodę – rozmowy z zawodnikiem.');
  return `Zgoda wyrażona. ${G.clubs[n.clubId].name} negocjuje teraz z zawodnikiem.`;
}

// ---------- Zainteresowanie klubów ----------
function noteInterest(r, clubId) { G.interest = G.interest || {}; (G.interest[r.id] = G.interest[r.id] || {})[clubId] = G.date; }
const interestedClubs = r => Object.keys((G.interest || {})[r.id] || {}).map(Number).filter(id => id !== G.clubId && id !== r.clubId && G.clubs[id]);
const offersOnTable = r => openNegs(r.id).filter(n => n.clubId !== G.clubId && n.status !== 'club');

// ---------- Dzień rynku ----------
function marketDay() {
  const d = G.date, md = d.slice(5);
  if (typeof licenceDay === 'function') licenceDay(); // procedura licencyjna (js/licence.js)
  for (const n of Object.values(G.negs)) {
    if ((n.status === 'pending' || n.status === 'club') && n.decideBy <= d) (n.stage === 'club' ? clubDecides : riderDecides)(n);
    else if (n.status === 'counter' && n.expires < d) closeNeg(n, 'expired', `Brak odpowiedzi na kontrpropozycję – rozmowy z ${G.riders[n.riderId].name} wygasły.`);
    else if (n.status === 'terms' && n.expires < d) closeNeg(n, 'expired', `Nie przedstawiliśmy warunków zawodnikowi w terminie – porozumienie z klubem ${G.clubs[n.holderId].short} wygasło.`);
  }
  for (const n of Object.values(G.negs)) {
    if (n.status !== 'agreed' || n.done || n.completes > d || n.mode === 'precontract') continue;
    const w = n.kind === 'loan' ? null : windowAt(d, leagueOf(n.clubId));
    if (w && w.kind === 'basic' && typeof licNoBasicWindow === 'function' && licNoBasicWindow(n.clubId)) { n.completes = `${d.slice(0, 4)}-${WIN_SUPP[0]}`; negLog(n, 'Klub zagrożony finansowo – rejestracja przesunięta na okienko uzupełniające.'); continue; }
    executeDeal(n);
  }
  const lg = myClub().league;
  const w = windowAt(d, lg);
  if (w && w.from === d) addMsg({ category: 'transfer', from: 'GKSŻ', title: `Otwarte: ${w.name}`, body: `<p>Od dziś do ${fmtDate(w.to)} trwa ${esc(w.name)}${w.kind === 'mid' ? ' – można zgłaszać tylko zawodników bez przynależności klubowej, niezgłoszonych w tym sezonie' : ''}. Uzgodnione wcześniej transfery zostają zarejestrowane.</p>`, link: '#/transfery/negocjacje' });
  if (md === PRECONTRACT_FROM) precontractNotice();
  if (md === '06-08' && G.seasonClosed !== G.season) precontractReminder();
  loanExtDay();
  if (dow(d) === 0) { aiMarketWeek(); if (typeof schoolMarketWeek === 'function') schoolMarketWeek(); }
  if (dow(d) === 1) aiBidsForUser();
  if (md === '12-30' || md === '03-25' || md === '04-05') aiForceFill(); // przed sezonem: kluby z niepełną kadrą dobierają wolnych zawodników
  for (const L of LEAGUE_ORDER) { const mw = midWindows(L).find(x => x.from === d); if (mw) aiMidFill(L); }
}
// Wypożyczenie do klubu z tej samej ligi: rywal; gap – zawodnik wszedłby rywalowi do pierwszego składu (junior: dwóch najlepszych juniorów, senior: piątka)
function loanRival(r, holderId, toId, S) {
  const h = G.clubs[holderId], t = G.clubs[toId];
  if (!h || !t || h.league !== t.league) return { same: false, gap: false };
  const sq = squadFor(t, S).filter(x => x.id !== r.id), jun = isJunior(r, S);
  const same = sq.filter(x => isJunior(x, S) === jun).map(x => x.skill).sort((a, b) => b - a);
  const slots = jun ? 2 : 5;
  return { same: true, gap: same.length < slots || r.skill > (same[slots - 1] ?? 0) };
}
// 15 czerwca: otwarcie okna przedłużeń i prekontraktów
function precontractNotice() {
  const ex = clubRiders(G.clubId).filter(r => r.contract && r.contract.clubId === G.clubId && r.contract.until === G.season && !r.nextContract && !r.retired);
  const st = r => r.sound && r.sound.season === G.season ? ` – ${SOUND_TXT[r.sound.stance]}` : '';
  addMsg({ category: 'transfer', from: 'Sekretariat', stop: true, title: `Otwarte okno przedłużeń i prekontraktów (${ex.length} ${plural(ex.length, 'kończąca się umowa', 'kończące się umowy', 'kończących się umów')})`,
    body: `<p>Od dziś (15 czerwca) można przedłużać umowy wygasające po sezonie ${G.season} i podpisywać prekontrakty na sezon ${G.season + 1}. Nasi zawodnicy z kończącymi się umowami mogą też rozmawiać z innymi klubami (art. 223 RPK) – kluby AI najpierw przedłużają swoich liderów i ważnych zawodników.</p>
      ${ex.length ? `<p>Kończą się umowy:</p><ul>${ex.sort(by(r => r.skill, -1)).map(r => `<li><a href="#/zawodnik/${r.id}/kontrakt">${esc(r.name)}</a> (${typeof roleOf === 'function' ? roleName(roleOf(r)) : ''})${st(r)}</li>`).join('')}</ul>` : '<p>Żadnemu z naszych zawodników nie kończy się umowa.</p>'}
      <p>Prekontrakty z zawodnikami innych klubów, którym umowa wygasa: Transfery → filtr „kontrakt kończy się w tym sezonie”.</p>`, link: '#/transfery' });
}
// 8 czerwca: przypomnienie – tydzień do otwarcia okna
function precontractReminder() {
  const ex = clubRiders(G.clubId).filter(r => r.contract && r.contract.clubId === G.clubId && r.contract.until === G.season && !r.nextContract && !r.retired);
  if (!ex.length) return;
  addMsg({ category: 'transfer', from: 'Sekretariat', title: 'Za tydzień okno przedłużeń i prekontraktów', body: `<p>15 czerwca rusza okno przedłużeń i prekontraktów. Umowy kończą się: ${ex.map(r => `<a href="#/zawodnik/${r.id}/kontrakt">${esc(r.name)}</a>`).join(', ')}. Już teraz możesz wybadać, czy zawodnicy chcą zostać (profil zawodnika → Kontrakt → „Porozmawiaj o przyszłości”).</p>` });
}
// ---------- Przedłużenie wypożyczenia ----------
// Regulamin: wypożyczenie trwa najwyżej do 31 października danego sezonu – nie da się go przedłużyć, ale od 15 czerwca można uzgodnić
// nowe wypożyczenie tego samego zawodnika na kolejny sezon (zgoda klubu macierzystego i zawodnika; kontrakt z klubem macierzystym musi
// obejmować ten sezon). Wypożyczenie zaczyna się 1 listopada; limit 12 punktów liczy się w nowym sezonie od zera.
function loanExtStatus(r) {
  const l = r.loan, S = G.season;
  if (!l || l.toClubId !== G.clubId) return { ok: false, text: 'Zawodnik nie jest wypożyczony do naszego klubu.' };
  if (r.nextLoan) return { ok: false, text: `Wypożyczenie na sezon ${r.nextLoan.season} jest już uzgodnione.` };
  if (!precontractOpen()) return { ok: false, text: 'Kolejne wypożyczenie można uzgodnić od 15 czerwca (razem z przedłużeniami i prekontraktami).' };
  if (!r.contract || r.contract.until < S + 1) return { ok: false, alt: 'precontract', text: `Kontrakt z ${G.clubs[l.parentId].short} kończy się po sezonie ${S} – zamiast wypożyczenia możesz podpisać z zawodnikiem prekontrakt na sezon ${S + 1}.` };
  if (Object.values(G.loanExt || {}).some(x => x.riderId === r.id && x.status === 'pending')) return { ok: false, text: 'Propozycja czeka na odpowiedź.' };
  return { ok: true, season: S + 1, parentId: l.parentId };
}
function loanExtOffer(riderId, t) {
  const r = G.riders[riderId], st = loanExtStatus(r);
  if (!st.ok) return st;
  const terms = { fee: round5k(Math.max(0, t.fee || 0)), signing: round5k(Math.max(0, t.signing || 0)), perPoint: round100(Math.max(0, t.perPoint || 0)), role: t.role || r.loan.role || null };
  if (typeof budgetCheck === 'function') { const bc = budgetCheck(G.clubId, r, terms, st.season, 'loan'); if (!bc.ok) return { ok: false, text: bc.text }; }
  G.loanExt = G.loanExt || {};
  const id = `LX${G.seq.lx = (G.seq.lx || 0) + 1}`;
  G.loanExt[id] = { id, riderId, parentId: st.parentId, season: st.season, terms, status: 'pending', due: addDays(G.date, rint(2, 5)), made: G.date };
  return { ok: true, text: `Propozycja wypożyczenia na sezon ${st.season} wysłana do ${G.clubs[st.parentId].short}. Odpowiedź do ${fmtDate(G.loanExt[id].due)}.` };
}
function loanExtDay() {
  for (const x of Object.values(G.loanExt || {})) {
    if (x.status !== 'pending' || G.date < x.due) continue;
    const r = G.riders[x.riderId], h = G.clubs[x.parentId];
    const done = (status, text) => { x.status = status; x.result = text; addMsg({ category: 'transfer', from: status === 'ok' ? 'Sekretariat' : h.name, stop: true, title: `${r.name}: ${status === 'ok' ? 'wypożyczenie na kolejny sezon' : 'brak zgody na kolejne wypożyczenie'}`, body: `<p>${esc(text)}</p>`, link: `#/zawodnik/${r.id}/kontrakt` }); };
    if (!r.loan || r.loan.toClubId !== G.clubId || !r.contract || r.contract.clubId !== x.parentId || r.contract.until < x.season) { done('rejected', 'Propozycja nieaktualna.'); continue; }
    // klub macierzysty: czy zawodnik będzie mu potrzebny w kolejnym sezonie, rywal z ligi, opłata
    const S = x.season, pol = typeof holderPolicy === 'function' ? holderPolicy(r, x.parentId, 'loan', S) : null;
    const rival = loanRival(r, x.parentId, G.clubId, S);
    const sqNext = squadFor(h, S).filter(y => y.id !== r.id && isJunior(y, S) === isJunior(r, S)).map(y => y.skill).sort((a, b) => b - a);
    const needed = r.skill > (sqNext[isJunior(r, S) ? 1 : 4] ?? 0);
    if ((needed && chance(0.75)) || (pol && pol.refuse && chance(0.6)) || (rival.same && chance(rival.gap ? 0.7 : 0.35))) { done('rejected', `${h.name} chce mieć ${r.name} u siebie w sezonie ${S}${rival.same ? ' (nie wzmocni ligowego rywala)' : ''}.`); continue; }
    const want = round5k(riderValue(r) * (0.03 + (rival.same ? 0.06 : 0)));
    if (x.terms.fee < want && !x.raised) { x.raised = true; x.terms.fee = want; x.due = addDays(G.date, 7); x.status = 'counter'; addMsg({ category: 'transfer', from: h.name, stop: true, title: `${r.name}: ${h.short} chce ${fmtMoney(want, true)}`, body: `<p>${esc(h.name)} zgodzi się na wypożyczenie na sezon ${S} za ${fmtMoney(want)}. Przyjmij w profilu zawodnika (7 dni).</p>`, link: `#/zawodnik/${r.id}/kontrakt` }); continue; }
    // zawodnik: wynagrodzenie, rola, morale
    // oczekiwania przy wypożyczeniu skalują się z resztą sezonu – na pełny kolejny sezon zawodnik oczekuje całości
    const u = negUtility(r, G.clubId, { signing: x.terms.signing, perPoint: x.terms.perPoint, role: x.terms.role }, 'loan') * remainingSeasonShare();
    if (u < 0.85) { done('rejected', `${r.name} nie chce zostać na tych warunkach – oczekuje wyższego wynagrodzenia albo większej roli.`); continue; }
    r.nextLoan = { parentId: x.parentId, toClubId: G.clubId, season: S, ...x.terms };
    done('ok', `${h.name} i ${r.name} zgodzili się: wypożyczenie na sezon ${S} (od 1 listopada), ${fmtMoney(x.terms.signing, true)} za podpis + ${fmtMoney(x.terms.perPoint)}/pkt${x.terms.fee ? `, opłata ${fmtMoney(x.terms.fee, true)}` : ''}.`);
  }
  for (const x of Object.values(G.loanExt || {})) if (x.status === 'counter' && G.date > x.due) { x.status = 'expired'; }
}
function loanExtAccept(id) {
  const x = G.loanExt && G.loanExt[id];
  if (!x || x.status !== 'counter') return { ok: false, text: 'Propozycja nieaktualna.' };
  x.status = 'pending'; x.due = addDays(G.date, 1);
  return { ok: true, text: 'Przyjęto kwotę klubu – odpowiedź zawodnika jutro.' };
}
// 1 listopada: start uzgodnionego wypożyczenia na nowy sezon
function loanNextStart(r) {
  const x = r.nextLoan; delete r.nextLoan;
  if (!r.contract || r.contract.clubId !== x.parentId || r.contract.until < x.season || r.retired) return;
  const c = G.clubs[x.toClubId];
  if (x.fee) { addTx(c.id, 'transfer', -x.fee, `Wypożyczenie: ${r.name} (${G.clubs[x.parentId].short})`); addTx(x.parentId, 'transfer', x.fee, `Wypożyczenie: ${r.name} do ${c.short}`); }
  r.loan = { kind: 'wypożyczenie', parentId: x.parentId, toClubId: c.id, season: x.season, from: G.date, until: `${x.season}-10-31`, signing: x.signing || 0, perPoint: x.perPoint || 0, fee: x.fee || 0, role: x.role || null };
  if (r.loan.signing) addTx(c.id, 'kontrakty', -r.loan.signing, `Kontrakt na wypożyczenie: ${r.name}`);
  r.loanSeason = x.season; r.clubId = c.id;
  logTransfer(r, x.parentId, c.id, x.fee || 0, 'wypożyczenie');
  if (c.id === G.clubId) addMsg({ category: 'transfer', from: 'Sekretariat', title: `${r.name} zostaje u nas na kolejny sezon`, body: `<p>Wypożyczenie z ${esc(G.clubs[x.parentId].name)} na sezon ${x.season} zaczęło się 1 listopada.</p>`, link: `#/zawodnik/${r.id}` });
}
// ---------- Wybadanie zawodnika: chęć przedłużenia umowy (przed oknem i w jego trakcie) ----------
const SOUND_TXT = { yes: 'chętnie przedłuży', open: 'otwarty, ale oczekuje lepszych warunków', no: 'nie zamierza przedłużać', retire: 'myśli o końcu kariery' };
function soundOut(riderId) {
  const r = G.riders[riderId], k = r && r.contract;
  if (!k || k.clubId !== G.clubId || r.loan) return { ok: false, text: 'Rozmawiać o przedłużeniu można tylko z zawodnikiem naszego klubu.' };
  if (r.sound && dayDiff(r.sound.d, G.date) < 30) return { ok: false, text: `Rozmawialiśmy z ${r.name} ${fmtDateShort(r.sound.d)} – zawodnik nie zmieni zdania tak szybko (ponownie od ${fmtDateShort(addDays(r.sound.d, 30))}).` };
  const T = k.until + 1;
  let sc = ((r.morale ?? 70) - 60) / 60;
  const p = typeof promiseCheck === 'function' ? promiseCheck(r) : null;
  if (p && p.n >= 4) sc -= Math.max(0, p.want - p.share) * 1.2; // obietnica startów niedotrzymana
  sc += (clubAppeal(r, G.clubId, 'renewal') - 1) * 1.5;
  const exp = typeof expectedRole === 'function' ? expectedRole(r, G.clubId, T) : null, cur = typeof roleOf === 'function' ? roleOf(r) : null;
  if (exp && cur && roleLvl(cur) < roleLvl(exp)) sc -= 0.12 * (roleLvl(exp) - roleLvl(cur)); // czuje, że zasługuje na więcej
  const rivals = Object.keys((G.interest || {})[r.id] || {}).filter(id => Number(id) !== G.clubId).length;
  sc -= 0.08 * Math.min(rivals, 4) + (r.wantsOut ? 0.6 : 0) - (hashStr(`${G.seed}|sound|${r.id}|${G.season}`) % 100 - 50) / 400;
  const stance = r.retireIntent ? 'retire' : sc >= 0.12 ? 'yes' : sc >= -0.2 ? 'open' : 'no';
  const a = riderAsk(r, G.clubId), f = { yes: 1, open: 1.12, no: 1.3, retire: 1 }[stance];
  r.sound = { d: G.date, season: G.season, stance, signing: round5k(a.signing * f), perPoint: round100(a.perPoint * f), years: a.years, role: exp, rivals };
  const ask = stance === 'retire' ? '' : ` Oczekiwania: ${fmtMoney(r.sound.signing, true)} za podpis + ${fmtMoney(r.sound.perPoint)}/pkt, ${a.years} ${plural(a.years, 'sezon', 'sezony', 'sezonów')}${exp ? `, rola: ${roleName(exp)}` : ''}.`;
  const why = stance === 'no' ? (r.wantsOut ? ' Chce odejść – za mało jeździ.' : rivals ? ' Słyszał o zainteresowaniu innych klubów.' : ' Nie jest zadowolony z sytuacji w klubie.') : stance === 'open' && rivals ? ' Wie, że interesują się nim inne kluby.' : '';
  return { ok: true, stance, text: `${r.name}: ${SOUND_TXT[stance]}.${why}${ask}` };
}

// ---------- Kluby AI ----------
// Kadra klubu na sezon T: zawodnicy z umową obejmującą sezon T i uzgodnione prekontrakty
function squadFor(c, T) {
  return Object.values(G.riders).filter(r => !r.retired && ((r.contract && r.contract.clubId === c.id && r.contract.until >= T && !(r.agreed && G.negs[r.agreed] && G.negs[r.agreed].clubId !== c.id))
    || (r.nextContract && r.nextContract.clubId === c.id) || (r.agreed && G.negs[r.agreed] && G.negs[r.agreed].clubId === c.id)));
}
function commitmentsFor(c, T) {
  return sum(squadFor(c, T).map(r => dealSeasonCost(r.nextContract && r.nextContract.clubId === c.id ? r.nextContract : r.contract && r.contract.clubId === c.id ? r.contract : null, r, c.league, T)));
}
function aiRoom(c, T) {
  if (typeof ridersRoom === 'function' && c.fin) return ridersRoom(c, T); // budżet płac zawodników (js/budget.js)
  const pending = sum(Object.values(G.negs).filter(n => n.clubId === c.id && NEG_OPEN.includes(n.status)).map(n => dealMoney(n.terms, G.riders[n.riderId], c.league, c.id)));
  return c.budget * 0.62 - commitmentsFor(c, T) - pending;
}
function aiOfferTerms(r, c, kind, T = sportSeason()) {
  const a = riderAsk(r, c.id), f = 0.86 + rnd() * 0.2;
  if (canAmateur(r) && a.signing + a.perPoint * expectedSeasonPoints(r.skill, c.league) < EQUIP_VALUE[c.league] * 1.05 && chance(0.7)) return { kind: 'amatorski', stipend: STIPEND_MAX, years: clamp(a.years, 1, 3) };
  const bonuses = [];
  if (chance(0.35)) bonuses.push({ type: c.league === 'PGE' ? pick(['playoff', 'medal']) : pick(['playoff', 'promotion']), amount: round5k(a.signing * (0.05 + rnd() * 0.1)) });
  if (chance(0.15) && r.skill >= 9) bonuses.push({ type: 'avg', thr: round2(clamp(1.45 + (r.skill - LEAGUE_AVG_SKILL[c.league]) * 0.33, 1, 2.6)), amount: round5k(a.signing * 0.08) });
  const role = typeof expectedRole === 'function' ? expectedRole(r, c.id, T) : null; // rola w sezonie, na który klub buduje skład
  // długość umowy: młodzi – do końca wieku juniorskiego (21 lat), jeśli klub nie widzi ich później jako U24, albo do końca wieku U24,
  // jeśli nie widzi ich jako seniorów; senior spoza składu – na rok (talent – najwyżej 2 lata)
  const yb = Number(String(r.born).slice(0, 4)), pa = perceive(r, c.id).paMid;
  const BAR = { PGE: [68, 80], '2E': [58, 70], KLZ: [50, 62] }[c.league] || [55, 65]; // [potencjał zawodnika U24 w składzie, seniora]
  let years = role && roleLvl(role) <= 3 && role !== 'dmpj' ? 1 : role === 'talent' ? Math.min(a.years, 2) : a.years;
  if (T - yb <= 21) years = pa >= BAR[1] ? Math.max(years, yb + 24 - T + 1) : pa >= BAR[0] ? yb + 24 - T + 1 : yb + 21 - T + 1;
  else if (T - yb <= 24 && pa < BAR[1]) years = yb + 24 - T + 1;
  years = clamp(years, 1, MAX_YEARS);
  return { kind: 'zawodowy', signing: round5k(a.signing * f), perPoint: round100(a.perPoint * f), years, raise: 0, bonuses, role };
}
function aiMarketWeek() {
  const md = G.date.slice(5), closed = G.seasonClosed === G.season;
  const pre = precontractOpen() || closed;
  const winter = md >= '11-01' || md <= '03-31'; // zima i przedsezonie: wolni zawodnicy (rejestracja w najbliższym okienku)
  if (!pre && !winter) { aiLoanWeek(); return; }
  const T = pre ? G.season + 1 : G.season;
  G.interest = G.interest || {};
  for (const [rid, m] of Object.entries(G.interest)) { for (const [cid, d] of Object.entries(m)) if (dayDiff(d, G.date) > 45) delete m[cid]; if (!Object.keys(m).length) delete G.interest[rid]; }
  const S = sportSeason();
  const pool = Object.values(G.riders).filter(r => r.active && !r.retired && !r.nextContract && !(r.agreed && G.negs[r.agreed] && G.negs[r.agreed].status === 'agreed')
    && (!r.contract || r.contract.until < T || isWarsaw(r)) && !(r.injury && G.injuries[r.injury] && dayDiff(G.date, G.injuries[r.injury].until) > 60));
  const ban = G.negBan || {};
  for (const c of shuffle(Object.values(G.clubs).filter(c => c.id !== G.clubId && clubActive(c, T)))) {
    const sq = squadFor(c, T);
    // przedłużenia własnych zawodników (prekontrakt z obecnym klubem)
    // najpierw najważniejsi (lider, ważni zawodnicy) – klub przedłuża ich w pierwszej kolejności
    if (pre) for (const r of Object.values(G.riders).filter(r => r.contract && r.contract.clubId === c.id && r.contract.until === T - 1 && !r.nextContract && !r.retired && !openNegs(r.id).some(n => n.clubId === c.id)).sort(by(r => typeof roleOf === 'function' ? roleLvl(roleOf(r)) : r.skill, -1))) {
      const age = riderAge(r) + 1;
      const rl = typeof roleOf === 'function' ? roleLvl(roleOf(r)) : 0;
      const bar = { PGE: 10.5, '2E': 8.5, KLZ: 6.5 }[c.league];
      // rola nie chroni weterana poniżej poziomu ligi (np. 41-latek w PGE) – klub szuka lepszego zawodnika
      if (rl >= 6 && !(age >= 37 && r.skill < bar)) { if (chance(0.95)) aiRenewOffer(c, r, T); continue; }
      const keep = (r.skill >= bar && !(age >= 37 && r.skill < bar + 1)) || (age <= 21 && perceive(r, c.id).paMid >= 70) || (isJunior(r, T) && sq.filter(x => isJunior(x, T)).length < 3);
      if (keep && chance(r.skill >= bar + 1.5 || age <= 24 ? 0.85 : 0.5)) aiRenewOffer(c, r, T); // dobrych i młodych klub zatrzymuje prawie zawsze
    }
    const pend = Object.values(G.negs).filter(n => n.clubId === c.id && NEG_OPEN.includes(n.status) && n.kind !== 'loan').map(n => G.riders[n.riderId]);
    // kadra: 3 juniorów, 4 seniorów powyżej U24 i 1 senior U24 (skład 1–5 = 4 seniorów + U24; rezerwę nr 8 może zająć junior) – seniorów nie ponad potrzeby
    const isU = r => !isJunior(r, T) && ageIn(r, T) <= 24, isFull = r => !isJunior(r, T) && !isU(r);
    const all = sq.concat(pend);
    const needJ = Math.max(0, 3 - all.filter(r => isJunior(r, T)).length);
    const needS = Math.max(0, 4 - all.filter(isFull).length);
    const needU = Math.max(0, 1 - all.filter(isU).length);
    // regulamin: co najmniej 4 Polaków na numerach 1–7 – przy 2 polskich juniorach potrzeba 2 polskich seniorów (PGE: 3, bo jeden junior może być zagraniczny)
    const nat = clubNation(c.id); // kraj „zawodników krajowych” (kluby zagraniczne w KLŻ – własny)
    // krajowi juniorzy ze składu (dwóch najlepszych) też się liczą do czwórki krajowych na numerach 1–7
    const polJun = Math.min(2, all.filter(r => isJunior(r, T)).sort(by(r => r.skill, -1)).slice(0, 2).filter(r => hasNat(r, nat)).length);
    const needPol = Math.max(0, 4 - polJun - all.filter(r => !isJunior(r, T) && hasNat(r, nat)).length);
    // limit kadry juniorskiej: klub z kilkoma juniorami nie dokupuje kolejnych (wychowankowie dochodzą z egzaminów)
    const jCount = all.filter(r => isJunior(r, T) && !(r.loan && r.loan.toClubId !== c.id)).length;
    const pc = new Map(), est = r => pc.get(r.id) || (pc.set(r.id, perceive(r, c.id)), pc.get(r.id)); // ocena sztabu klubu (może się mylić)
    // kluby PGE nie zapychają kadry pod Ekstraligę U24 – szukają młodych gwiazd: zawodnika (U24 lub zagranicznego juniora),
    // który w ocenie sztabu rokuje na jednego z dwóch najlepszych młodych zawodników klubu
    let starBar = null;
    if (c.league === 'PGE') {
      const pas = all.filter(r => ageIn(r, T) <= 24).map(r => est(r).paMid).sort((a, b) => b - a);
      starBar = Math.max(60, pas[1] ?? 0);
    }
    // bez braków klub czasem i tak rozgląda się za wzmocnieniem formacji juniorskiej (zakup juniora lepszego od drugiego juniora klubu)
    if (!needJ && !needS && !needU && !needPol && starBar == null && !(c.league !== 'PGE' && chance(0.6))) { aiListings(c, sq, T); continue; }
    let room = aiRoom(c, T);
    const costOf = r => { const a = riderAsk(r, c.id); return a.signing + a.perPoint * expectedSeasonPoints(r.skill, c.league); };
    const cands = pool.filter(r => r.contract?.clubId !== c.id && !(ban[`${c.id}|${r.id}`] > G.date) && !openNegs(r.id).some(n => n.clubId === c.id));
    let made = 0;
    const tryGroup = (list, need, score) => {
      const sc = new Map(list.map(r => [r.id, score(r)]));
      const top = list.sort(by(r => sc.get(r.id), -1)).slice(0, 8);
      top.slice(0, 4).forEach(r => noteInterest(r, c.id));
      for (const r of top) {
        if (need <= 0 || made >= 3) break;
        const cost = costOf(r);
        if (cost > room * 0.95 && !(isJunior(r, T) && cost < EQUIP_VALUE[c.league] * 1.2)) continue;
        if (c.lic && c.lic.repair && cost > EQUIP_VALUE[c.league] * 1.5) continue; // ścieżka naprawy: tylko tani zawodnicy
        if (!chance(pre ? 0.45 : 0.7)) continue;
        const t = aiOfferTerms(r, c, 'contract', T);
        const ms = marketStatus(r, c.id);
        if (ms.ok && ms.forSeason && ms.forSeason < T) t.years = Math.max(t.years || 1, T - ms.forSeason + 1); // umowa musi obejmować sezon, na który klub uzupełnia skład
        const res = makeOffer(c.id, r.id, t);
        if (res.ok) { room -= cost; need--; made++; }
      }
    };
    if (needJ) tryGroup(cands.filter(r => isJunior(r, T) && hasNat(r, nat)), needJ, r => est(r).caMid / 5 + est(r).paMid / 25);
    // zakup juniora spoza czołówki juniorów klubu z wyższej ligi albo rywala z tej samej ligi, lepszego od naszego drugiego juniora
    const juns = all.filter(r => isJunior(r, T)).map(r => est(r).caMid).sort((a, b) => b - a);
    if (made < 3 && jCount < 5 && chance(needJ ? 0.6 : 0.35)) { // oferta przed sezonem – rejestracja w najbliższym okienku
      const surplus = Object.values(G.riders).filter(r => r.contract && r.contract.clubId !== c.id && r.contract.clubId !== G.clubId && r.contract.kind !== 'warszawski' && !r.loan && isJunior(r, T) && r.country === 'POL'
        && r.loanListed && LEAGUES[leagueOf(r.contract.clubId)].level <= LEAGUES[c.league].level && !openNegs(r.id).length && !(ban[`${c.id}|${r.id}`] > G.date) && est(r).caMid > (juns[1] ?? 0) + 3);
      const r = surplus.sort(by(r => est(r).caMid / 5 + est(r).paMid / 25, -1))[0];
      const st = r && marketStatus(r, c.id);
      if (st && st.ok && st.mode === 'transfer' && costOf(r) + st.fee <= room) { const res = makeOffer(c.id, r.id, { ...aiOfferTerms(r, c, 'contract'), fee: round5k(st.fee * (0.75 + rnd() * 0.3)) }); if (res.ok) made++; }
    }
    // najpierw brakujący polscy seniorzy (liczą się też do potrzeby seniorów / U24)
    const before = made;
    if (needPol) tryGroup(cands.filter(r => !isJunior(r, T) && hasNat(r, nat)), needPol, r => est(r).caMid - Math.max(0, costOf(r) - room) / 20000);
    const polMade = made - before;
    if (needS > polMade) tryGroup(cands.filter(isFull), needS - polMade, r => est(r).caMid - Math.max(0, costOf(r) - room) / 20000);
    // U24 do składu ligowego: liczy się potencjał, nie tylko cena
    // U24 jedzie w składzie 1–5: liczy się przede wszystkim obecny poziom, potencjał dodatkowo
    const youngScore = r => est(r).caMid / 5 + est(r).paMid / 40 - costOf(r) / 60000;
    if (needU) tryGroup(cands.filter(isU), needU, youngScore);
    // młoda gwiazda pod Ekstraligę U24 (najwyżej jedna naraz, rzadko – to wyjątkowe okazje)
    const youngN = all.filter(r => ageIn(r, T) <= 23 && (isU(r) || (isJunior(r, T) && !hasNat(r, 'POL')))).length;
    if (starBar != null && made < 3 && jCount < 6 && youngN < 3 && chance(0.35)) {
      const stars = cands.filter(r => (isU(r) || (isJunior(r, T) && !hasNat(r, 'POL'))) && ageIn(r, T) <= 23 && est(r).paMid >= starBar);
      if (stars.length) tryGroup(stars, 1, r => est(r).paMid - costOf(r) / 50000);
    }
    // wzmocnienie: wolny zawodnik wyraźnie lepszy od piątego seniora klubu (składu 1–5), jeśli budżet pozwala
    // pozycja U24 w składzie jest obowiązkowa – wzmocnienie dotyczy czwórki seniorów powyżej 24 lat (zastępuje najsłabszego z nich)
    const full = all.filter(isFull).sort(by(r => est(r).caMid, -1)), sen4 = full[3];
    if (made < 3 && room > 0 && sen4 && full.length < 5 && chance(0.4)) tryGroup(cands.filter(r => isFull(r) && est(r).caMid >= est(sen4).caMid + 8), 1, r => est(r).caMid - costOf(r) / 40000);
    // zakupy zawodników z listy transferowej innych klubów w okienkach listopadowym i grudniowym
    if (windowAt(G.date, c.league, ['basic', 'supp']) && needS && chance(0.3)) {
      const listed = Object.values(G.riders).filter(r => r.listed && r.contract && r.contract.clubId !== c.id && r.contract.clubId !== G.clubId && marketStatus(r, c.id).ok && costOf(r) < room);
      const r = listed.sort(by(r => est(r).caMid, -1))[0];
      if (r) { const st = marketStatus(r, c.id); makeOffer(c.id, r.id, { ...aiOfferTerms(r, c, 'contract'), fee: round5k(st.fee * (0.8 + rnd() * 0.25)) }); }
    }
  }
  aiLoanWeek();
}
// Kluby AI wystawiają zbędnych zawodników na listę transferową i do wypożyczenia
function aiListings(c, sq, T) {
  const sen = sq.filter(r => !isJunior(r, T)).sort(by(r => r.skill)), jun = sq.filter(r => isJunior(r, T)).sort(by(r => r.skill));
  if (sen.length > 9 && sen[0].contract && sen[0].contract.until > T - 1) sen[0].listed = true;
  for (const r of jun.slice(0, Math.max(0, jun.length - 3))) if (r.contract && r.contract.clubId === c.id) r.loanListed = true;
}
// Kontrakt warszawski: zawodnik formalnie związany z klubem (uśpionym), bez wynagrodzenia i gwarancji startów
const isWarsaw = r => !!(r.contract && r.contract.kind === 'warszawski' && r.clubId === r.contract.clubId && !r.loan);
// Stawka za punkt zawodnika z kontraktem warszawskim, gdy pojedzie w barwach swojego klubu (minimum ligowe)
const WARSAW_PP = { PGE: 2000, '2E': 1000, KLZ: 500 };
// Kontrakty warszawskie podpisują wszystkie aktywne kluby (uśpione – nie, także po decyzji o reaktywacji): po zamknięciu okienek
// (styczeń–sierpień) wiążą bez wynagrodzenia wolnych zawodników jako zaplecze – najpierw byłych zawodników i wychowanków
const canWarsaw = c => !!c && !c.dormant && clubActive(c, sportSeason());
function aiWarsawWeek() {
  const md = G.date.slice(5);
  if (md < '01-02' || md > '08-31') return;
  for (const c of Object.values(G.clubs).filter(c => canWarsaw(c) && c.id !== G.clubId)) {
    const rs = Object.values(G.riders).filter(r => r.contract && r.contract.clubId === c.id && r.contract.until >= G.season);
    // kontrakty warszawskie są rzadkie (zwłaszcza w mocnych klubach): tylko przy brakach w składzie seniorów (4 + U24), najwyżej jeden
    const have = rs.filter(r => r.contract.kind === 'warszawski').length, sen = slots15(rs);
    if (have >= 1 || sen >= 5 || !chance({ PGE: 0.01, '2E': 0.03, KLZ: 0.06 }[c.league] || 0.03)) continue;
    const free = Object.values(G.riders).filter(r => !r.clubId && !r.schoolRights && r.active && !r.retired && !r.nextContract && !r.agreed && !r.contract && !openNegs(r.id).length && r.skill >= 5 && !(typeof plBanned === 'function' && plBanned(r, `${G.season}-01-01`)));
    const tie = r => (r.prevClubId === c.id || r.trainedBy === c.id || r.homeClubId === c.id ? 10 : 0) + (hasNat(r, 'POL') ? 2 : 0) + r.skill / 5;
    const r = free.sort(by(tie, -1))[0];
    if (!r || tie(r) < 3 || warsawUtility(r, c.id) < 1) continue;
    r.clubId = c.id;
    r.contract = makeContract(c.id, { kind: 'warszawski' }, G.season, 'kontrakt warszawski (gra)');
    logTransfer(r, r.prevClubId || null, c.id, 0, 'kontrakt warszawski');
  }
}
// Wypożyczenia między klubami AI i propozycje wypożyczeń dla zawodników gracza
// Juniorzy spoza czołówki juniorów klubu (poza trzema najlepszymi) są do wypożyczenia, a poza pięcioma najlepszymi – także na sprzedaż
function aiJuniorSurplus(S) {
  for (const c of Object.values(G.clubs)) {
    if (c.id === G.clubId) continue;
    const jun = Object.values(G.riders).filter(r => r.contract && r.contract.clubId === c.id && r.clubId === c.id && !r.loan && r.contract.kind !== 'warszawski' && r.contract.until >= S && isJunior(r, S)).sort(by(r => r.skill, -1));
    jun.forEach((r, i) => { if (i >= 3) r.loanListed = true; if (i >= 5) r.listed = true; });
  }
}
// Nowy sezon: klub AI trzyma najwyżej 8 juniorów z licencją; nadmiar – słabi bez perspektyw tracą kontrakt (wolni zawodnicy),
// rokujący trafiają na listę transferową i do wypożyczenia (np. do niższej ligi)
const JUNIOR_KEEP = 8;
function aiJuniorRelease(S) {
  const out = [];
  for (const c of Object.values(G.clubs)) {
    if (c.id === G.clubId) continue;
    const jun = Object.values(G.riders).filter(r => r.contract && r.contract.clubId === c.id && !r.retired && !r.loan && !r.nextLoan && r.contract.kind !== 'warszawski' && r.contract.until >= S && isJunior(r, S));
    if (jun.length <= JUNIOR_KEEP) continue;
    const val = r => { const p = perceive(r, c.id); return p.caMid + p.paMid * 0.6; };
    for (const r of jun.sort(by(val, -1)).slice(JUNIOR_KEEP)) {
      if (perceive(r, c.id).paMid < 60 && !openNegs(r.id).length) {
        r.prevClubId = c.id; r.clubId = null; r.contract = null; r.listed = false; r.loanListed = false; dropFromLineups(r.id);
        logTransfer(r, c.id, null, 0, 'rozwiązanie');
        out.push(r.name);
      } else { r.listed = true; r.loanListed = true; }
    }
  }
  return out;
}
function aiLoanWeek() {
  const S = sportSeason();
  const md = G.date.slice(5);
  if (md > '09-15' && md < '11-01') return;
  aiJuniorSurplus(S);
  // w trakcie sezonu kluby AI udostępniają do wypożyczenia juniorów, którzy nie mieszczą się w składzie
  if (md >= '03-01' && md <= '08-31') for (const r of Object.values(G.riders)) {
    if (!r.clubId || r.clubId === G.clubId || r.loan || r.loanListed || !r.contract || r.contract.clubId !== r.clubId || !isJunior(r)) continue;
    if (!((r.stats[G.season] || {}).m > 1) && squadOutlook(r, r.clubId) === 'rezerwa' && loanStatus(r, 0).ok) r.loanListed = true;
  }
  const avail = Object.values(G.riders).filter(r => r.loanListed && r.contract && r.clubId && !r.loan && !openNegs(r.id).some(n => n.kind === 'loan'));
  if (!avail.length) return;
  for (const c of shuffle(Object.values(G.clubs).filter(c => c.id !== G.clubId && clubActive(c, S)))) {
    const sq = squadFor(c, S);
    // klub szuka juniora lepszego od swojego drugiego juniora (w składzie jadą dwaj) – u silniejszych klubów albo u rywali z ligi; najwyżej 2 wypożyczonych
    const juns = sq.filter(r => isJunior(r, S)).map(r => perceive(r, c.id).caMid).sort((a, b) => b - a);
    const bar2 = juns[1] ?? 0;
    if (Object.values(G.riders).filter(r => r.loan && r.loan.toClubId === c.id && r.loan.season === S).length >= 2 || !chance(juns.length < 3 ? 0.5 : 0.3)) continue;
    const r = avail.filter(r => isJunior(r, S) && r.contract.clubId !== c.id && (leagueOf(r.contract.clubId) !== c.league || chance(0.35)) && !(G.negBan && G.negBan[`${c.id}|${r.id}`] > G.date) && LEAGUES[leagueOf(r.contract.clubId)].level <= LEAGUES[c.league].level && perceive(r, c.id).caMid > bar2 + 3 && loanStatus(r, c.id).ok).sort(by(r => perceive(r, c.id).caMid, -1))[0];
    if (!r) continue;
    const a = riderAsk(r, c.id);
    makeOffer(c.id, r.id, { fee: 0, signing: round5k(a.signing * 0.5 * remainingSeasonShare()), perPoint: round100(a.perPoint * 0.9) }, 'loan');
    avail.splice(avail.indexOf(r), 1);
  }
  aiWarsawLoans(S);
}
// W trakcie sezonu kluby AI z brakami w składzie seniorów wypożyczają zawodników z kontraktami warszawskimi
function aiWarsawLoans(S) {
  const md = G.date.slice(5);
  if (md < '03-15' || md > '08-31') return;
  const pool = Object.values(G.riders).filter(r => isWarsaw(r) && !r.injury && !openNegs(r.id).length);
  if (!pool.length) return;
  for (const c of shuffle(Object.values(G.clubs).filter(c => c.id !== G.clubId && clubActive(c, S)))) {
    // brak w składzie: numer 1–7, którego klub nie obsadzi (na 1–5 jadą też juniorzy ponad dwóch z numerów 6–7)
    const gaps = lineupGaps(c.id);
    if (!gaps.length || !chance(0.5)) continue;
    const bar = { PGE: 6, '2E': 4.5, KLZ: 3.5 }[c.league] ?? 3.5; // minimalny poziom ligi
    const r = pool.filter(r => loanStatus(r, c.id).ok && r.skill >= bar && gaps.some(i => slotOk(r, i, c.league))).sort(by(r => r.skill, -1))[0];
    if (!r) continue;
    const a = riderAsk(r, c.id);
    makeOffer(c.id, r.id, { fee: 0, signing: round5k(a.signing * 0.3 * remainingSeasonShare()), perPoint: round100(a.perPoint * 0.85) }, 'loan');
    pool.splice(pool.indexOf(r), 1);
  }
}
// Oferty klubów AI za zawodników gracza (lista transferowa, czasem niezamówione oferty za najlepszych)
function aiBidsForUser() {
  const md = G.date.slice(5);
  if (!(md >= '08-01' || md <= '01-05')) return;
  for (const r of clubRiders(G.clubId)) {
    if (!r.contract || r.contract.clubId !== G.clubId || r.loan || openNegs(r.id).some(n => n.clubId !== G.clubId && n.kind !== 'loan')) continue;
    const listed = r.listed;
    if (!(listed ? chance(0.3) : riderValue(r) > 300000 && chance(0.03))) continue;
    // kupujący musi potrzebować zawodnika (brak seniora albo wzmocnienie czołowej trójki) i mieć na niego budżet płac i transferowy
    const T0 = G.seasonClosed === G.season ? G.season + 1 : G.season;
    const needs = c => { const sen = squadFor(c, T0).filter(x => !isJunior(x, T0)).sort(by(x => x.skill, -1)); return isJunior(r, T0) ? squadFor(c, T0).filter(x => isJunior(x, T0)).length < 3 : slots15(squadFor(c, T0)) < 6 || (sen[2] && r.skill > sen[2].skill + 0.5); };
    const buyers = Object.values(G.clubs).filter(c => c.id !== G.clubId && clubActive(c) && c.cash > riderValue(r) * 0.5 && LEAGUES[c.league].level <= LEAGUES[myClub().league].level + (listed ? 1 : 0) && needs(c));
    if (!buyers.length) continue;
    const b = pick(buyers);
    const st = marketStatus(r, b.id);
    if (!st.ok || st.mode !== 'transfer') continue;
    noteInterest(r, b.id);
    makeOffer(b.id, r.id, { ...aiOfferTerms(r, b, 'contract'), fee: round5k(st.fee * (listed ? 0.6 + rnd() * 0.5 : 0.9 + rnd() * 0.4)) });
  }
}
// Warunki dopasowane do budżetu płac klubu AI: kwoty obniżone do wolnych środków (najniżej minimum ligowe za punkt, bez podpisu);
// junior na kontrakcie amatorskim zawsze się mieści (sprzęt i stypendium); null – klubu nie stać nawet na minimum
function fitTerms(c, r, t, S) {
  if (t.kind === 'amatorski' || typeof ridersRoom !== 'function') return t;
  const room = ridersRoom(c, S, r.id), cost = plannedCost(r, t, c.id, S);
  if (cost <= room) return t;
  const minT = { ...t, signing: 0, perPoint: WARSAW_PP[c.league] || 1000, bonuses: [] };
  if (plannedCost(r, minT, c.id, S) > Math.max(room, 0)) return canAmateur(r, S) ? { kind: 'amatorski', stipend: 0, years: 1 } : null;
  const f = clamp(Math.max(room, 0) / cost, 0, 1);
  return { ...t, signing: round5k((t.signing || 0) * f), perPoint: Math.max(minT.perPoint, round100((t.perPoint || 0) * f)), bonuses: [] };
}
// Przedłużenie kontraktu przez klub AI w ramach budżetu: kluczowym zawodnikom klub proponuje tyle, ile zostało (nawet poniżej oczekiwań)
// Minimalny koszt zawodnika do składu (stawka minimalna ligi × punkty słabego zawodnika) – zapas budżetu na braki w kadrze
const MIN_SLOT_COST = { PGE: 350000, '2E': 140000, KLZ: 60000 };
function squadShortfall(c, T, skipId) {
  const sq = squadFor(c, T).filter(r => r.id !== skipId);
  return Math.max(0, 5 - sq.filter(r => !isJunior(r, T)).length) + Math.max(0, 2 - sq.filter(r => isJunior(r, T)).length); // 5 seniorów, 2 juniorów
}
function aiRenewOffer(c, r, T) {
  let t = { ...aiOfferTerms(r, c, 'renewal'), role: typeof roleOf === 'function' ? roleOf(r) : null };
  // klub nie wydaje na jednego zawodnika budżetu potrzebnego na skompletowanie składu
  if (typeof ridersRoom === 'function') {
    const room = ridersRoom(c, T, r.id) - (squadShortfall(c, T, r.id) - 1) * (MIN_SLOT_COST[c.league] || 60000), cost = plannedCost(r, t, c.id, T);
    if (cost > room) { const f = room / cost; if (f < 0.6) return { ok: false, text: 'brak budżetu na resztę składu' }; t = { ...t, signing: round5k(t.signing * f), perPoint: round100(t.perPoint * f), bonuses: [] }; }
  }
  const res = makeOffer(c.id, r.id, t);
  if (res.ok || !res.budget) return res;
  const room = ridersRoom(c, T, r.id), cost = plannedCost(r, t, c.id, T);
  if (room < cost * 0.6) return res; // nie stać klubu – zawodnik odejdzie
  const f = room / cost * 0.97;
  return makeOffer(c.id, r.id, { ...t, signing: round5k(t.signing * f), perPoint: round100(t.perPoint * f), bonuses: [] });
}
// Domknięcie kadr w ostatnich dniach okienka uzupełniającego: kluby AI biorą najtańszych wolnych zawodników
function aiForceFill() {
  const S = G.season;
  const free = Object.values(G.riders).filter(r => r.active && !r.retired && (!r.clubId || isWarsaw(r)) && !r.nextContract && !r.agreed && !(r.injury) && !(typeof plBanned === 'function' && plBanned(r, `${S}-01-01`)));
  for (const c of shuffle(Object.values(G.clubs).filter(c => c.id !== G.clubId && clubActive(c, S)))) {
    const sq = squadFor(c, S);
    let jun = sq.filter(r => isJunior(r, S)).length, sen = sq.length - jun; // kadra docelowa: 5 seniorów (juniorzy na 1–5 tylko awaryjnie)
    const cheap = pool => pool.sort(by(r => { const a = riderAsk(r, c.id); return a.signing + a.perPoint * 40 - r.skill * 50000; })); // jakość do ceny (pod koniec okienka wolni zawodnicy schodzą z ceny)
    const sign = r => {
      // ostatnie dni okienka: zawodnik przyjmie mniej; klub bez budżetu i tak bierze go na minimalnych warunkach (walkower kosztuje więcej)
      const t = fitTerms(c, r, aiOfferTerms(r, c, 'contract'), S) || (canAmateur(r, S) ? { kind: 'amatorski', stipend: 0, years: 1 } : { kind: 'zawodowy', signing: 0, perPoint: WARSAW_PP[c.league] || 1000, years: 1, bonuses: [] });
      for (const n of openNegs(r.id)) closeNeg(n, 'rejected', `${r.name} podpisał kontrakt z klubem ${c.name}.`);
      const fee = signFee(r, c.id, S);
      if (fee == null || (fee && c.cash < fee)) return false;
      const n = newNeg(c.id, r, 'contract', { ...t, fee }, { mode: 'free', forSeason: S });
      n.status = 'agreed'; n.completes = G.date; negLog(n, 'Podpisanie kontraktu w ostatnich dniach okienka.');
      executeDeal(n);
      free.splice(free.indexOf(r), 1);
      return true;
    };
    for (const r of cheap(free.filter(r => isJunior(r, S)))) { if (jun >= 2) break; if (sign(r)) jun++; }
    for (const r of cheap(free.filter(r => !isJunior(r, S)))) { if (sen >= 5) break; /* skład 1–5: 4 seniorów + U24 */ if (sign(r)) sen++; }
  }
}
// Okienko śródroczne: kluby AI z brakami (kontuzje) dobierają wolnych zawodników
function aiMidFill(lg) {
  const S = G.season;
  const free = Object.values(G.riders).filter(r => r.active && !r.retired && (!r.clubId || isWarsaw(r)) && !r.nextContract && !r.agreed && !r.injury && !((r.stats[S] || {}).m > 0) && !(typeof plBanned === 'function' && plBanned(r, `${S}-01-01`)));
  for (const c of Object.values(G.clubs).filter(c => c.id !== G.clubId && c.league === lg && clubActive(c, S))) {
    const fit = clubRiders(c.id).filter(r => !r.injury);
    const jun = fit.filter(r => isJunior(r)).length, sen = fit.length - jun;
    const need = jun < 2 ? free.filter(r => isJunior(r)) : slots15(fit) < 5 ? free.filter(r => !isJunior(r)) : null; // na 1–5 jadą też juniorzy ponad dwóch
    if (!need || !need.length) continue;
    const r = need.sort(by(r => r.skill, -1))[0];
    const fee = signFee(r, c.id, S);
    if (fee == null || (fee && c.cash < fee)) continue;
    const t = fitTerms(c, r, aiOfferTerms(r, c, 'contract'), S);
    if (!t) continue;
    const n = newNeg(c.id, r, 'contract', { ...t, fee }, { mode: 'free', forSeason: S });
    n.status = 'agreed'; n.completes = G.date; negLog(n, 'Kontrakt w okienku śródrocznym.');
    executeDeal(n);
    free.splice(free.indexOf(r), 1);
  }
}

// ---------- Finanse kontraktów ----------
// Kwota stała w 6 równych ratach (luty–lipiec), kontrakt amatorski: stypendium co miesiąc i sprzęt klubowy
function contractMonthly(c) {
  const month = Number(G.date.slice(5, 7));
  for (const r of Object.values(G.riders)) {
    const k = r.contract;
    if (!k || k.clubId !== c.id || k.from > G.season || k.until < G.season) continue;
    if (r.loan && r.loan.season === G.season && r.loan.parentId === c.id) continue; // wypożyczony – płaci klub wypożyczający
    if (k.kind === 'amatorski') {
      if (k.stipend) addTx(c.id, 'kontrakty', -k.stipend, `Stypendium (kontrakt amatorski): ${r.name}`);
      addTx(c.id, 'sprzęt', -Math.round(EQUIP_VALUE[c.league] / 12), `Sprzęt i starty juniora (kontrakt amatorski): ${r.name}`);
      continue;
    }
    if (month < 2 || month > 7) continue;
    const t = termsFor(k, G.season);
    if (!t.signing) continue;
    if (!k.paid || k.paid.season !== G.season) k.paid = { season: G.season, n: 0 };
    const due = month - 1 - k.paid.n;
    if (due > 0) { addTx(c.id, 'kontrakty', -Math.round(t.signing / 6 * due), `Rata za podpis${due > 1 ? ` (${due} raty)` : ''}: ${r.name}`); k.paid.n += due; }
  }
}
// Wypłata za punkty w meczu ligowym (stawka przy dwucyfrówce, wypożyczenie)
function payPoints(r, s) {
  const k = activeDeal(r);
  if (!k || k.kind === 'amatorski') return;
  const pts = s.pts + s.bonus, t = k.kind === 'wypożyczenie' ? k : termsFor(k, G.season);
  const rate = k.kind === 'warszawski' ? WARSAW_PP[leagueOf(r.clubId)] || 0 : k.pp10 && pts >= 10 ? k.pp10 : t.perPoint;
  if (rate && pts) addTx(r.clubId, 'punkty', -pts * rate, `Za punkty: ${r.name} (${s.pts}+${s.bonus})`);
}
// Premie z kontraktów za medal DMP albo awans
function marketSeasonEnd(results, moves) {
  payProJunior();
  payBonuses(results, moves);
}
// Nowy sezon (1 listopada): koniec wypożyczeń, wejście w życie prekontraktów, kwoty na nowy sezon
function marketRollover() {
  applyLeagueClauses(); // klauzule awansu i spadku (kluby zmieniły ligę po sezonie)
  for (const r of Object.values(G.riders)) {
    if (r.loan && r.loan.season < G.season) endLoan(r, !!(r.nextLoan && r.nextLoan.season === G.season));
    if (r.nextLoan && r.nextLoan.season <= G.season) loanNextStart(r);
    if (r.nextContract && r.nextContract.from <= G.season) {
      const k = r.nextContract;
      delete r.nextContract;
      if (k.comp && k.comp.schoolId && r.schoolRights === k.comp.schoolId) schoolSold(r, k.clubId, k.comp.amount);
      else if (k.comp && k.comp.amount && G.clubs[k.comp.clubId]) { addTx(k.clubId, 'transfer', -k.comp.amount, `Ekwiwalent za wyszkolenie: ${r.name}`); addTx(k.comp.clubId, 'transfer', k.comp.amount, `Ekwiwalent za wyszkolenie: ${r.name}`); }
      if (r.clubId && r.clubId !== k.clubId) { r.prevClubId = r.clubId; afterMove(r, k.clubId); logTransfer(r, r.prevClubId, k.clubId, k.comp ? k.comp.amount : 0, 'prekontrakt'); }
      delete k.comp;
      r.clubId = k.clubId; r.contract = k;
      dropFromLineups(r.id);
    }
    const k = r.contract;
    if (k && k.terms && k.terms[G.season]) { k.signing = k.terms[G.season].signing; k.perPoint = k.terms[G.season].perPoint; }
    if (k && k.until < G.season) r.lastUntil = k.until;
    r.loanListed = false;
  }
  if (typeof schoolRollover === 'function') schoolRollover();
  for (const n of Object.values(G.negs)) {
    if (NEG_OPEN.includes(n.status) && (n.mode === 'precontract' || n.mode === 'renewal')) { n.status = 'expired'; negLog(n, 'Kontrakt zawodnika wygasł – rozmowy o prekontrakcie nieaktualne.'); }
    if (!NEG_OPEN.includes(n.status) && (n.done || n.status !== 'agreed') && dayDiff(n.updated, G.date) > 120) delete G.negs[n.id];
  }
}
function migrateMarket() {
  if (G.marketV >= 1) return false;
  G.negs = G.negs || {}; G.interest = G.interest || {}; G.negBan = G.negBan || {};
  G.seq.neg = G.seq.neg || 1;
  const month = Number(G.date.slice(5, 7));
  const paidN = month >= 11 ? 0 : Math.round(Math.min(month, 10) / 10 * 6);
  for (const r of Object.values(G.riders)) {
    if (r.contract && !r.contract.paid) r.contract.paid = { season: G.season, n: r.contract.from > G.season ? 0 : paidN };
    if (r.loanListed == null) r.loanListed = false;
    // klub szkolący zawodników do 21 lat (ekwiwalent): obecny klub, o ile zawodnik nie zmieniał barw w grze
    if (!r.trainedBy && r.clubId && hasNat(r, 'POL') && isJunior(r) && !r.prevClubId) {
      r.trainedBy = r.clubId;
      const h = typeof riderHist === 'function' ? riderHist(r) : null;
      const lic = h && h.licenses && h.licenses.length ? Number(String(h.licenses[0].date || '').slice(-4)) : r.licence ? yearOf(r.licence.date) : null;
      r.trainedSince = lic || Number(r.born.slice(0, 4)) + 16;
    }
  }
  G.marketV = 1;
  migrateMarket2();
  return true;
}

// ---------- Zawody młodzieżowe: wyłącznie wynagrodzenie za punkty (Zbiór Zasad §16 ust. 5, §16a, §17) ----------
// Kontrakt zawodowy: stawka youthPP za punkt; kontrakt amatorski bez stypendium: 100 / 150 / 250 zł za punkt zależnie od zdobyczy.
const youthRateAmateur = pts => (pts > 10 ? 250 : pts >= 6 ? 150 : 100);
const defaultYouthPP = perPoint => round100(clamp((perPoint || 0) * 0.25, 200, 2000));
function payYouthComp(ev, m) {
  if (!m || !m.riders) return;
  const c = compOf(ev);
  for (const [rid, s] of Object.entries(m.riders)) {
    const r = G.riders[rid];
    if (!r || !r.clubId) continue;
    const k = activeDeal(r), pts = (s.pts || 0) + (s.bonus || 0);
    if (!k || !pts) continue;
    const rate = k.kind === 'amatorski' ? (k.stipend ? 0 : youthRateAmateur(pts)) : k.kind === 'wypożyczenie' ? defaultYouthPP(k.perPoint) : k.youthPP ?? defaultYouthPP(k.perPoint);
    if (rate) addTx(r.clubId, 'punkty', -pts * rate, `Za punkty (${c.short}): ${r.name} (${pts} pkt × ${fmtMoney(rate)})`);
  }
}

// ---------- Absencje i kontuzje (Zbiór Zasad §15, §18) ----------
// Kontuzja odniesiona poza ligą polską, zawodami PZM / SE i startami reprezentacji (DPŚ, SON) daje klubowi prawo do potrącenia.
function injuryCovered(ev) {
  if (!ev) return true;
  if (ev.kind === 'sgp') return false;
  const key = ev.kind === 'comp' && typeof compKey === 'function' ? compKey(ev) : ev.comp;
  if (['SWC', 'SON', 'SON2', 'REP'].includes(key)) return true;
  const c = ev.kind === 'comp' ? compOf(ev) : null;
  return !!c && ['polska', 'mlodziez'].includes(c.group);
}
// Po meczu ligowym: potrącenie kwoty stałej (podpis ÷ liczba meczów drużyny) za każdy opuszczony mecz
function absenceDeductions(m) {
  for (const clubId of [m.homeId, m.awayId]) {
    const games = Object.values(G.fixtures).filter(f => f.season === G.season && f.stage === 'RS' && (f.homeId === clubId || f.awayId === clubId)).length || 14;
    for (const r of clubRiders(clubId)) {
      const inj = r.injury && G.injuries[r.injury];
      if (!inj || inj.covered !== false || m.riders[r.id]) continue;
      const k = activeDeal(r);
      if (!k || k.kind === 'amatorski') continue;
      const signing = k.kind === 'wypożyczenie' ? k.signing : termsFor(k, G.season).signing;
      const amount = Math.round(signing / games);
      if (!amount) continue;
      k.deducted = k.deducted && k.deducted.season === G.season ? k.deducted : { season: G.season, amount: 0, n: 0 };
      k.deducted.amount += amount; k.deducted.n++;
      addTx(clubId, 'kontrakty', amount, `Potrącenie z kontraktu – absencja (${inj.kind}, ${inj.where}): ${r.name}`);
    }
  }
}
// Kontuzja dłuższa niż 9 miesięcy: klub może jednostronnie rozwiązać kontrakt bez kosztów (§15 ust. 2)
function longInjury(r) {
  const inj = r.injury && G.injuries[r.injury];
  return !!inj && dayDiff(inj.start, G.date) >= 270;
}

// ---------- PRO Junior (PGE Ekstraliga od 2026) ----------
// Pula co najmniej 8 mln zł dzielona po sezonie przez punkty wychowanków (juniorów jadących w klubie, który ich wyszkolił).
const PRO_JUNIOR_POOL = 8000000, PRO_JUNIOR_FROM = 2026;
function proJuniorPoints(season = G.season) {
  const pts = {};
  for (const m of Object.values(G.matches)) {
    if (m.kind !== 'league') continue;
    const f = G.fixtures[m.fixtureId];
    if (!f || !f.played || f.season !== season || f.league !== 'PGE') continue;
    for (const [rid, s] of Object.entries(m.riders)) {
      const r = G.riders[rid], clubId = s.team === 'H' ? m.homeId : m.awayId;
      if (!r || !isJunior(r, season) || r.homeClubId !== clubId) continue;
      const p = s.pts + s.bonus;
      if (!p) continue;
      const e = pts[clubId] || (pts[clubId] = { total: 0, riders: {} });
      e.total += p; e.riders[rid] = (e.riders[rid] || 0) + p;
    }
  }
  return pts;
}
function payProJunior() {
  if (G.season < PRO_JUNIOR_FROM || (G.proJuniorPaid || 0) >= G.season) return;
  G.proJuniorPaid = G.season;
  const pts = proJuniorPoints();
  const total = sum(Object.values(pts).map(e => e.total));
  if (!total) return;
  const rate = Math.round(PRO_JUNIOR_POOL / total);
  for (const [cid, e] of Object.entries(pts)) addTx(Number(cid), 'tv', e.total * rate, `PRO Junior ${G.season}: ${e.total} pkt wychowanków × ${fmtMoney(rate)}`);
  G.proJunior = G.proJunior || {};
  G.proJunior[G.season] = { rate, pts: Object.fromEntries(Object.entries(pts).map(([k, e]) => [k, e.total])) };
  const mine = pts[G.clubId];
  if (myClub().league === 'PGE' || mine) {
    const rows = Object.entries(pts).sort(by(([, e]) => e.total, -1)).map(([cid, e]) => `${esc(G.clubs[cid].name)}: <b>${e.total} pkt</b> → ${fmtMoney(e.total * rate, true)}`).join('<br>');
    addMsg({ category: 'finanse', from: 'Ekstraliga Żużlowa', stop: !!mine, title: `PRO Junior ${G.season}: ${mine ? `${fmtMoney(mine.total * rate, true)} dla klubu` : 'podział puli'}`,
      body: `<p>Pula ${fmtMoney(PRO_JUNIOR_POOL, true)} podzielona przez ${total} punktów zdobytych w PGE Ekstralidze przez juniorów-wychowanków: <b>${fmtMoney(rate)} za punkt</b>.</p><p>${rows}</p>${mine ? `<p>Nasi wychowankowie: ${Object.entries(mine.riders).map(([rid, p]) => `${esc(G.riders[rid].name)} (${p} pkt)`).join(', ')}.</p>` : ''}`, link: '#/finanse' });
  }
}

// ---------- Limit wydatków na kontrakty (PGE Ekstraliga od 2027) ----------
// Wydatki na kontrakty najwyżej 70% przychodów klubu (z udokumentowanym finansowaniem właściciela). Wartość kontraktu = podpis
// + stawka za punkt × punkty z poprzedniego sezonu + premie. Beniaminek ma wyższy przelicznik. Kontrakt ponad limit nie zostanie potwierdzony.
const CAP_FROM = 2027, CAP_SHARE = 0.7, CAP_PROMOTED = 1.15;
function capDealValue(r, k, season, lg) {
  if (!k) return 0;
  if (k.kind === 'amatorski') return (k.stipend || 0) * 12 + EQUIP_VALUE[lg];
  const last = r.stats[season - 1], pts = last && last.heats ? last.pts + last.bonus : expectedSeasonPoints(r.skill, lg);
  const t = k.kind === 'wypożyczenie' || !k.from ? k : termsFor(k, season);
  return (t.signing || 0) + (t.perPoint || 0) * pts + sum(dealBonuses(k).map(b => b.amount || 0)); // „wszystkie możliwe bonusy”
}
function capInfo(c, season = sportSeason(), skipRiderId = null) {
  if (!c || c.league !== 'PGE' || season < CAP_FROM) return { applies: false };
  seasonPlan(c);
  const last = c.history[c.history.length - 1];
  const promoted = !!last && last.season === season - 1 && last.league !== 'PGE';
  const limit = Math.round((expectedRevenue(c).total + (c.subsidy || 0)) * CAP_SHARE * (promoted ? CAP_PROMOTED : 1));
  let used = 0;
  for (const r of squadFor(c, season)) {
    if (r.id === skipRiderId) continue;
    const ag = r.agreed && G.negs[r.agreed];
    const k = r.nextContract && r.nextContract.clubId === c.id ? r.nextContract : ag && ag.clubId === c.id ? ag.terms : r.contract;
    used += capDealValue(r, k, season, c.league);
  }
  for (const r of Object.values(G.riders)) if (r.loan && r.loan.toClubId === c.id && r.loan.season === season && r.id !== skipRiderId) used += capDealValue(r, r.loan, season, c.league);
  used = Math.round(used);
  return { applies: true, limit, used, free: limit - used, promoted };
}
// Czy nowa umowa zmieści się w limicie (przy przedłużeniu nie liczy się dotychczasowa umowa zawodnika)
function capCheck(clubId, r, terms, season, kind) {
  const c = G.clubs[clubId], info = capInfo(c, season, r.id);
  if (!info.applies) return { ok: true, info };
  const k = kind === 'loan' ? { kind: 'wypożyczenie', signing: terms.signing, perPoint: terms.perPoint } : terms;
  const v = capDealValue(r, k, season, c.league);
  if (info.used + v <= info.limit) return { ok: true, info, value: v };
  return { ok: false, info, value: v, text: `Ekstraliga Żużlowa nie potwierdzi tej umowy: wydatki na kontrakty w sezonie ${season} wyniosłyby ${fmtMoney(info.used + v, true)} przy limicie ${fmtMoney(info.limit, true)} (${Math.round(CAP_SHARE * 100)}% przychodów).` };
}
// Klub szkolący (wychowankowie – PRO Junior): licencja zdobyta w barwach klubu
function migrateMarket2() {
  if (G.marketV >= 2) return false;
  for (const r of Object.values(G.riders)) {
    if (r.homeClubId) continue;
    const h = typeof RIDER_HIST !== 'undefined' && RIDER_HIST.riders ? RIDER_HIST.riders[r.psdSlug] || RIDER_HIST.riders[nameSlug(r.name)] : null;
    const team = h && h.licenses && h.licenses.length ? h.licenses[0].team : r.licence ? r.licence.team : null;
    const byCity = team ? Object.values(G.clubs).find(c => c.city && (c.city.startsWith(team) || team.startsWith(c.city.replace(' Wlkp.', '')))) : null;
    if (byCity) r.homeClubId = byCity.id;
    else if (r.trainedBy && !r.trainedHop) r.homeClubId = r.trainedBy;
  }
  G.marketV = 2;
  return true;
}

// ---------- Kontrakty startowe ----------
// Kwoty kontraktów z kadr 2026 są szacunkiem modelu; na starcie gry zobowiązania klubu (podpis + szacowane punkty)
// skalujemy do najwyżej START_CAP budżetu, żeby kluby niższych lig nie zaczynały z deficytem
const START_CAP = 0.75;
function scaleStartContracts() {
  if (G.contractsScaled) return false;
  const S = sportSeason(), out = [];
  for (const c of Object.values(G.clubs)) {
    if (!clubActive(c, S)) continue;
    const rs = Object.values(G.riders).filter(r => r.contract && r.contract.clubId === c.id && r.contract.until >= S && !['amatorski', 'warszawski'].includes(r.contract.kind));
    // koszt w budżecie (js/budget.js): podpis + przewidywane punkty; cel – budżet płac zawodników z planu sezonu (przychody − koszty stałe),
    // najwyżej START_CAP budżetu klubu – małe kluby KLŻ mają duże koszty stałe w stosunku do budżetu
    const cost = r => typeof plannedCost === 'function' ? plannedCost(r, r.contract, c.id, S) : dealSeasonCost(r.contract, r, c.league, S);
    const fixed = sum(Object.values(G.riders).filter(r => r.contract && r.contract.clubId === c.id && r.contract.kind === 'amatorski').map(cost));
    const pro = sum(rs.map(cost));
    const target = typeof budgetPlan === 'function' && c.fin ? budgetPlan(c, S).riders : c.budget * START_CAP;
    if (!pro || fixed + pro <= target) continue;
    const f = clamp((target - fixed) / pro, 0.3, 1);
    for (const r of rs) {
      const k = r.contract;
      k.signing = round5k(k.signing * f); k.perPoint = round100(k.perPoint * f);
      if (k.pp10) k.pp10 = round100(k.pp10 * f);
      if (k.terms) for (const t of Object.values(k.terms)) { t.signing = round5k(t.signing * f); t.perPoint = round100(t.perPoint * f); }
      if (k.bonuses) for (const b of k.bonuses) b.amount = round5k(b.amount * f);
    }
    if (typeof budReset === 'function') budReset();
    out.push(`${c.short} ×${f.toFixed(2)}`);
  }
  G.contractsScaled = out.join(', ') || 'bez zmian';
  return true;
}

// ---------- Premie i klauzule kontraktu ----------
// Premie wpisane do kontraktu jako „inne świadczenia pieniężne” (Zbiór Zasad §16 ust. 4), wypłacane po sezonie.
const BONUS_TYPES = {
  champion: { name: 'Mistrzostwo Polski / wygranie ligi', short: 'mistrzostwo ligi' },
  medal: { name: 'Medal ligi (miejsca 1–3)', short: 'medal' },
  playoff: { name: 'Awans do fazy play-off', short: 'play-off' },
  promotion: { name: 'Awans do wyższej ligi', short: 'awans' },
  stay: { name: 'Utrzymanie w lidze', short: 'utrzymanie' },
  avg: { name: 'Średnia biegowa w lidze co najmniej', short: 'średnia', thr: { def: 2.0, step: 0.05, min: 0.5, max: 3 } },
  pts: { name: 'Punkty ligowe w sezonie (z bonusami) co najmniej', short: 'punkty', thr: { def: 100, step: 5, min: 5, max: 300 } },
  matches: { name: 'Mecze ligowe w sezonie co najmniej', short: 'mecze', thr: { def: 10, step: 1, min: 1, max: 20 } },
};
// Klauzule: pola umowy (null / undefined = brak klauzuli)
const CLAUSES = {
  raise: { name: 'Zmiana kwoty za podpis rok do roku', unit: '%', step: 5, def: 10, min: -30, max: 50 },
  pp10: { name: 'Stawka za punkt przy 10+ pkt w meczu', unit: 'zł', step: 100, def: 0 },
  youthPP: { name: 'Stawka za punkt w zawodach młodzieżowych i U24E', unit: 'zł', step: 100, def: 0 },
  buyout: { name: 'Klauzula odstępnego', unit: 'zł', step: 50000, def: 0 },
  promoRaise: { name: 'Podwyżka podpisu po awansie klubu', unit: '%', step: 5, def: 20, min: 0, max: 100 },
  relegDrop: { name: 'Obniżka podpisu po spadku klubu', unit: '%', step: 5, def: 25, min: 0, max: 80 },
};
const sigm = x => 1 / (1 + Math.exp(-x));
// Siła klubu w lidze (średnia najlepszych sześciu zawodników) – miejsce w rankingu ligi
function clubRank(clubId, withRider) {
  const lg = leagueOf(clubId);
  const str = c => { const sk = Object.values(G.riders).filter(r => r.clubId === c.id && !r.retired).map(r => r.skill); if (withRider && c.id === clubId) sk.push(withRider.skill); return sum(sk.sort((a, b) => b - a).slice(0, 6)) / 6; };
  const clubs = Object.values(G.clubs).filter(c => c.league === lg && clubActive(c)).map(c => [c.id, str(c)]).sort((a, b) => b[1] - a[1]);
  return { rank: Math.max(0, clubs.findIndex(x => x[0] === clubId)), n: clubs.length || 8, lg };
}
// Prawdopodobieństwo spełnienia warunku premii (szacunek zawodnika i klubu)
function bonusChance(b, r, clubId, rk = clubRank(clubId, r)) {
  const { rank, n, lg } = rk, at = (arr, i) => arr[Math.min(i, arr.length - 1)];
  const perHeat = clamp(1.45 + (r.skill - LEAGUE_AVG_SKILL[lg]) * 0.33, 0.3, 2.7);
  switch (b.type) {
    case 'champion': return at([0.35, 0.25, 0.15, 0.1, 0.06, 0.04, 0.03, 0.02], rank);
    case 'medal': return at([0.75, 0.65, 0.5, 0.35, 0.2, 0.12, 0.08, 0.05], rank);
    case 'playoff': return at([0.95, 0.9, 0.8, 0.6, 0.4, 0.25, 0.15, 0.08], rank);
    case 'promotion': return lg === 'PGE' ? 0 : at([0.45, 0.3, 0.15, 0.08, 0.04, 0.02], rank);
    case 'stay': return rank >= n - 1 ? 0.55 : rank >= n - 2 ? 0.8 : 0.95;
    case 'avg': return sigm((perHeat - (b.thr || 2)) / 0.12);
    case 'pts': { const e = expectedSeasonPoints(r.skill, lg); return sigm((e - (b.thr || 100)) / (0.18 * e + 5)); }
    case 'matches': { const e = { 'skład': 13, rotacja: 9, rezerwa: 4 }[squadOutlook(r, clubId)]; return sigm((e - (b.thr || 10)) / 2); }
  }
  return 0;
}
function bonusesEV(t, r, clubId) {
  const list = t.bonuses || [];
  if (!list.length || !clubId) return 0;
  const rk = clubRank(clubId, r);
  return sum(list.map(b => (b.amount || 0) * bonusChance(b, r, clubId, rk)));
}
const bonusLabel = b => `${BONUS_TYPES[b.type] ? BONUS_TYPES[b.type].short : b.type}${BONUS_TYPES[b.type] && BONUS_TYPES[b.type].thr ? ` ≥ ${b.type === 'avg' ? Number(b.thr).toFixed(2) : b.thr}` : ''}`;
// Lista premii z umowy (również ze starego pola medalBonus)
const dealBonuses = k => [...(k.bonuses || []), ...(k.medalBonus ? [{ type: 'medal', amount: k.medalBonus }] : [])];
// Wypłata premii po sezonie
function payBonuses(results, moves) {
  const mine = [];
  for (const r of Object.values(G.riders)) {
    const k = activeDeal(r);
    if (!k || !r.clubId) continue;
    const list = dealBonuses(k);
    if (!list.length) continue;
    const lg = Object.keys(results).find(l => results[l].includes(r.clubId));
    const pos = lg ? results[lg].indexOf(r.clubId) + 1 : 99;
    const top4 = lg ? leagueTable(lg).slice(0, 4).map(x => x.clubId) : [];
    const mv = moves.find(m => m[0] === r.clubId);
    const s = r.stats[G.season] || { m: 0, heats: 0, pts: 0, bonus: 0 };
    const ok = b => ({ champion: pos === 1, medal: pos <= 3, playoff: top4.includes(r.clubId), promotion: !!mv && mv[2].startsWith('awans'), stay: !(mv && mv[2].startsWith('spadek')),
      avg: s.heats >= 12 && (s.pts + s.bonus) / s.heats >= (b.thr || 99), pts: s.pts + s.bonus >= (b.thr || 9999), matches: s.m >= (b.thr || 99) }[b.type]);
    for (const b of list) if (b.amount && ok(b)) { addTx(r.clubId, 'kontrakty', -b.amount, `Premia z kontraktu (${bonusLabel(b)}): ${r.name}`); if (r.clubId === G.clubId) mine.push(`${esc(r.name)} – ${esc(bonusLabel(b))}: ${fmtMoney(b.amount)}`); }
  }
  if (mine.length) addMsg({ category: 'finanse', from: 'Księgowość', title: `Premie z kontraktów za sezon ${G.season} (${mine.length})`, body: `<p>${mine.join('<br>')}</p>`, link: '#/finanse/transakcje' });
}
// Klauzule awansu i spadku: zmiana kwot za podpis od nowego sezonu
function applyLeagueClauses() {
  for (const r of Object.values(G.riders)) {
    const k = r.contract;
    if (!k || !k.terms || !(k.promoRaise || k.relegDrop)) continue;
    const c = G.clubs[k.clubId], last = c && c.history[c.history.length - 1];
    if (!last || last.season !== G.season - 1 || last.league === c.league) continue;
    const up = LEAGUES[c.league].level < LEAGUES[last.league].level;
    const f = up ? 1 + (k.promoRaise || 0) / 100 : 1 - (k.relegDrop || 0) / 100;
    if (f === 1) continue;
    for (const y of Object.keys(k.terms).map(Number).filter(y => y >= G.season)) k.terms[y].signing = round5k(k.terms[y].signing * f);
    if (k.clubId === G.clubId) addMsg({ category: 'transfer', from: 'Sekretariat', title: `Klauzula ${up ? 'awansu' : 'spadku'}: ${r.name}`, body: `<p>Kwota za podpis od sezonu ${G.season}: ${up ? '+' : '−'}${up ? k.promoRaise : k.relegDrop}% (${fmtMoney(k.terms[G.season] ? k.terms[G.season].signing : 0)}).</p>`, link: `#/zawodnik/${r.id}/kontrakt` });
  }
}
