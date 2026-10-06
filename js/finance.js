'use strict';
// Finanse klubów: harmonogram wpływów i wydatków (ten sam generator księguje operacje i liczy prognozę do końca sezonu),
// wypłaty ligi (prawa TV, sponsor rozgrywek, fundusz rezerwowy), nagrody i fundusze (medale, Pro Junior, Fundusz Atrakcyjności), opłaty, karnety i loże,
// wsparcie miasta w podziale na składniki i dotacje celowe (szkolenie młodzieży, organizacja imprez – rozliczane na koniec roku), kredyty,
// pomoc awaryjna i kontrola licencyjna (31 października). Sponsorzy: js/sponsors.js.
// Rok finansowy sezonu S: 1 listopada S-1 – 31 października S. Parametry: js/finance-data.js, źródła: data/finance/README.md.

const fyOf = d => { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return m >= 11 ? y + 1 : y; };
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fyDate = (S, m, d = 15) => ymd(m >= 11 ? S - 1 : S, m, d);
const FY_MONTHS = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const round1k = x => Math.round(x / 1000) * 1000;
const FL = c => FIN_LEAGUE[c.league] || FIN_LEAGUE.KLZ;
const AD = Object.fromEntries(AD_SLOTS.map(s => [s.id, s]));
// najbliższy dzień płatności (1. lub 15.) nie wcześniej niż data d
function payDayFrom(d) {
  const day = Number(d.slice(8, 10)), y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
  if (day === 1 || day === 15) return d;
  if (day < 15) return ymd(y, m, 15);
  return m === 12 ? ymd(y + 1, 1, 1) : ymd(y, m + 1, 1);
}
const FIN_KINDS = {
  sponsor: ['Sponsorzy', 1], miasto: ['Miasto i samorząd', 1], liga: ['Wypłaty ligi (TV, sponsor ligi)', 1], nagrody: ['Nagrody i fundusze ligi', 1],
  karnety: ['Karnety', 1], bilety: ['Bilety', 1], loze: ['Loże i skyboxy', 1], gastronomia: ['Gastronomia', 1], gadzety: ['Gadżety i sklep kibica', 1],
  imprezy: ['Imprezy i wynajem stadionu', 1], 'właściciel': ['Właściciel / akcjonariusze', 1], dokapitalizowanie: ['Dokapitalizowanie przez miasto (właściciel)', 1], finansowanie: ['Kredyty, pożyczki, pomoc', 1], transfer: ['Transfery', 0],
  tv: ['PRO Junior i wypłaty ligi', 1], kontrakty: ['Kontrakty zawodników', -1], punkty: ['Premie za punkty', -1], 'płace': ['Płace sztabu', -1], 'szkółka': ['Szkółka', -1], 'sprzęt': ['Sprzęt', -1],
  obozy: ['Obozy przygotowawcze', -1], skauting: ['Skauting (wyjazdy obserwatorów)', -1], administracja: ['Administracja i biuro', -1], tor: ['Tor, stadion, park maszyn', -1], mecze: ['Organizacja meczów', -1], wyjazd: ['Wyjazdy', -1],
  licencje: ['Licencje i opłaty PZM / ligi', -1], u24: ['Ekstraliga U24', -1], operacyjne: ['Pozostałe koszty', -1], kredyt: ['Raty kredytów i odsetki', -1], inwestycje: ['Inwestycje', -1], kary: ['Kary', -1],
  zwrot: ['Zwrot niewykorzystanych dotacji celowych', -1],
};

// ---------- Stan finansowy klubu ----------
function finInit(c) {
  const cf = CLUB_FIN[c.id] || {};
  const city = cf.city || [0.3e6, 2, 0.4, false];
  c.fin = c.fin || {};
  const f = c.fin;
  f.baseName = f.baseName || cf.base || c.name;
  f.city = f.city || { base: city[0], wealth: city[1], stance: city[2], owner: city[3], asks: {}, request: null, granted: {}, guarantee: 0 };
  cityParts(c);
  f.earmark = f.earmark || {};
  f.ownerCap = f.ownerCap ?? (cf.owner ?? 0.1);
  f.reserve = f.reserve || [];
  f.loans = f.loans || [];
  f.karnety = f.karnety || {};
  f.passes = f.passes || {};
  f.extra = f.extra || [];
  f.leadsHint = f.leadsHint || [];
  if (c.stadium.boxes == null) c.stadium.boxes = Math.max(0, Math.round(FIN_LEAGUE[c.league].boxes * clamp(c.stadium.capacity / 12000, 0.4, 1.4)));
  if (!c.tickets && typeof stadiumInit === 'function') stadiumInit(c); // sektory, cenniki, popyt (js/stadium.js)
  return f;
}
// Ile akcjonariusze są w stanie dopłacić w sezonie (CLUB_FIN.owner – udział budżetu): deklarowana dopłata nie przekracza tej kwoty
const ownerCapacity = c => round1k((c.budget || 0) * ((c.fin && c.fin.ownerCap) ?? 0.1));
// Atrakcyjność klubu dla reklamodawców: reputacja, kibice, ostatni wynik
function adAppeal(c) {
  const last = c.history[c.history.length - 1];
  const res = last ? (last.pos <= 3 ? 1.1 : last.pos >= 7 ? 0.92 : 1) : 1;
  return clamp((0.65 + c.rep / 160) * (0.85 + Math.min(c.fans || 0, 60000) / 200000) * res, 0.5, 1.6);
}
// ---------- Harmonogram (księgowanie i prognoza) ----------
// Wszystkie pozycje o stałej dacie (1. lub 15. dzień miesiąca) roku finansowego S
function finItems(c, S, { forecast = false } = {}) {
  const f = finInit(c), lg = FL(c), out = [];
  const add = (date, kind, amount, desc, extra) => { if (amount) out.push({ date, kind, amount: Math.round(amount), desc, ...extra }); };
  const active = clubActive(c);
  // przychody
  for (const s of activeSponsors(c, S)) for (const t of sponsorTranches(s, S)) if (!(s.skip && s.skip[t.date])) add(t.date, 'sponsor', t.amount, `Sponsor: ${s.name}${(PAY_PLANS[s.plan] || {}).months && PAY_PLANS[s.plan].months.length > 1 ? ' (transza)' : ''}`, { sp: s.id });
  if (active) {
    // miasto: dotacja na rozwój sportu, umowa promocyjna, dokapitalizowanie (środki ogólne) i dotacje celowe (tylko na swój cel)
    const g = cityGrants(c, S);
    FIN_MONTHS.city.forEach(m => add(fyDate(S, m), 'miasto', g.sport / FIN_MONTHS.city.length, 'Dotacja miasta na rozwój sportu (rata)'));
    FIN_MONTHS.cityPromo.forEach(m => add(fyDate(S, m), 'miasto', g.promo / FIN_MONTHS.cityPromo.length, 'Umowa promocyjna z miastem / regionem'));
    FIN_MONTHS.equity.forEach(m => add(fyDate(S, m), 'dokapitalizowanie', g.equity / FIN_MONTHS.equity.length, 'Dokapitalizowanie spółki przez miasto (właściciel)'));
    FIN_MONTHS.youth.forEach(m => add(fyDate(S, m), 'miasto', g.youth / FIN_MONTHS.youth.length, 'Dotacja celowa: szkolenie dzieci i młodzieży (rata)', { earmark: 'youth' }));
    for (const [name, amt, m] of g.own) {
      add(fyDate(S, m, 1), 'miasto', amt, `Dotacja celowa: ${name}`, { earmark: 'events' });
      add(fyDate(S, m), 'imprezy', -amt, `Organizacja: ${name}`);
    }
    // liga: prawa TV (z potrąceniem na fundusz rezerwowy) i udział w umowie sponsora tytularnego rozgrywek
    const lp = LEAGUE_PAY[c.league] || {};
    FIN_MONTHS.central.forEach(m => add(fyDate(S, m), 'liga', lg.tv / FIN_MONTHS.central.length, `Prawa TV – ${LEAGUES[c.league].short} (rata)`));
    if (lg.reserve) FIN_MONTHS.central.forEach(m => add(fyDate(S, m), 'liga', -lg.reserve / FIN_MONTHS.central.length, 'Potrącenie z wypłaty TV na fundusz rezerwowy ligi'));
    FIN_MONTHS.title.forEach(m => add(fyDate(S, m), 'liga', lg.title / FIN_MONTHS.title.length, `Sponsor tytularny rozgrywek – udział klubu${lp.title ? ` (${lp.title.split(' – ')[1].split(' (')[0]})` : ''}`));
    const k = karnetPlan(c, S);
    for (const [m, sh] of Object.entries(FIN_MONTHS.karnety)) add(fyDate(S, Number(m)), 'karnety', k.n * k.price * sh, `Sprzedaż karnetów na sezon ${S}`);
    for (const [m, sh] of Object.entries(FIN_MONTHS.boxes)) add(fyDate(S, Number(m)), 'loze', boxRevenue(c) * sh, `Loże i skyboxy (${c.stadium.boxes})`);
    FIN_MONTHS.events.forEach(m => add(fyDate(S, m), 'imprezy', lg.events * adAppeal(c) / FIN_MONTHS.events.length, 'Wynajem stadionu i imprezy pozasportowe'));
    add(fyDate(S, 12), 'gadzety', (c.fans || 0) * 3 * (0.5 + lg.adMult / 2), 'Sklep kibica – sprzedaż świąteczna');
    // koszty stałe
    add(fyDate(S, FIN_MONTHS.licence), 'licencje', -lg.licence, `Licencja klubu i opłaty ligowe na sezon ${S}`);
    add(fyDate(S, FIN_MONTHS.riderLic), 'licencje', -lg.riderLic * Math.max(8, clubRiders(c.id).length), 'Licencje i ubezpieczenia zawodników');
    if (lg.u24) FIN_MONTHS.u24.forEach(m => add(fyDate(S, m), 'u24', -lg.u24 / FIN_MONTHS.u24.length, 'Ekstraliga U24 (koszty startów)'));
    const tech = Math.max(c.budget * lg.tech[0], lg.tech[1]);
    for (const [m, sh] of Object.entries(FIN_MONTHS.tech)) add(fyDate(S, Number(m), 1), 'tor', -tech * sh, 'Tor, stadion i park maszyn');
  }
  const plan = finPlan(c, S, forecast);
  const admin = Math.max(c.budget * lg.admin[0], lg.admin[1]) * (active ? 1 : 0.3);
  for (const m of FY_MONTHS) {
    const d1 = fyDate(S, m, 1);
    add(d1, 'administracja', -admin / 12, 'Administracja i biuro klubu');
    if (plan.misc) add(d1, 'operacyjne', -plan.misc / 12, 'Pozostałe koszty (marketing, ubezpieczenia, podatki, rezerwa)');
  }
  if (plan.owner) FIN_MONTHS.owner.forEach(m => add(fyDate(S, m), 'właściciel', plan.owner / FIN_MONTHS.owner.length, 'Wpłata właściciela / akcjonariuszy'));
  const al = f.alloc && f.alloc[S];
  if (al && al.infra) [4, 5, 6, 7, 8, 9].forEach(m => add(fyDate(S, m), 'inwestycje', -al.infra / 6, 'Inwestycje: tor i park maszyn'));
  // zamrożone środki z funduszu rezerwowego ligi wracają po 3 sezonach
  for (const r of f.reserve) if (r.season + 3 === S && !r.paid) add(fyDate(S, 11), 'nagrody', r.amount, `Zwrot z funduszu rezerwowego ligi (sezon ${r.season})`, { reserve: r.season });
  // kredyty i pożyczki
  for (const l of f.loans) for (const p of l.schedule) if (fyOf(p.date) === S) add(p.date, 'kredyt', -p.amount, `${l.name}: rata ${p.no}/${l.schedule.length}`, { loan: l.id });
  // umówione wpłaty (pomoc, dotacje nadzwyczajne)
  for (const x of f.extra) if (fyOf(x.date) === S) add(x.date, x.kind, x.amount, x.desc);
  // prognoza kosztów, które księguje inny moduł (płace, szkółka, raty kontraktów)
  if (forecast) {
    const wages = sum(clubStaff(c.id).map(s => s.wage));
    for (const m of FY_MONTHS) {
      const d1 = fyDate(S, m, 1);
      add(d1, 'płace', -wages, 'Wynagrodzenia sztabu');
      if (c.academyBudget) add(d1, 'szkółka', -c.academyBudget / 12, 'Szkółka żużlowa');
    }
    for (const r of clubRiders(c.id)) {
      const k = r.contract;
      if (!k || k.clubId !== c.id || k.from > S || k.until < S) continue;
      if (r.loan && r.loan.season === S && r.loan.parentId === c.id) continue;
      if (k.kind === 'amatorski') {
        for (const m of FY_MONTHS) { add(fyDate(S, m, 1), 'kontrakty', -(k.stipend || 0), `Stypendium: ${r.name}`); add(fyDate(S, m, 1), 'sprzęt', -EQUIP_VALUE[c.league] / 12, `Sprzęt juniora: ${r.name}`); }
        continue;
      }
      const t = termsFor(k, S);
      if (!t || !t.signing) continue;
      const paidN = k.paid && k.paid.season === S ? k.paid.n : 0;
      for (let m = 2 + paidN; m <= 7; m++) add(fyDate(S, m, 1), 'kontrakty', -t.signing / 6, `Rata za podpis: ${r.name}`);
    }
  }
  return out;
}
// Sprzedaż karnetów: liczba ustalana 15 grudnia według cennika karnetów (js/stadium.js), wcześniej prognoza
function karnetPlan(c, S) {
  const f = c.fin, old = f.karnety[S];
  if (old && old.by) return old;
  const k = karnetSales(c, S);
  if (old) { // zapis sprzed nowego modelu: liczba i cena ustalone – rozkład na sektory według modelu
    const r = k.n ? old.n / k.n : 0;
    for (const row of Object.values(k.by)) for (const x of Object.keys(row)) row[x] = Math.round(row[x] * r);
    return { ...k, n: old.n, price: old.price, rev: Math.round(old.n * old.price), est: !!old.est };
  }
  return k;
}
const boxRevenue = c => (c.stadium.boxes || 0) * FL(c).boxPrice * adAppeal(c);
// Wsparcie miasta w sezonie S: przyznane w grudniu, wcześniej szacunek
function cityAmount(c, S) {
  const g = cityGrants(c, S);
  return Math.round(g.sport + g.promo + g.equity + g.youth + sum(g.own.map(x => x[1])));
}
// Składniki wsparcia miasta (CITY_PARTS); stare zapisy: podział kwoty bazowej według proporcji z danych
function cityParts(c) {
  const city = c.fin.city;
  if (city.parts) return city;
  const p = CITY_PARTS[c.id] || { sport: city.base };
  const free = (p.sport || 0) + (p.promo || 0) + (p.equity || 0);
  const tot = free + (p.youth || 0);
  const k = tot ? city.base / tot : 1;
  city.parts = { sport: free ? (p.sport || 0) / free : 1, promo: free ? (p.promo || 0) / free : 0, equity: free ? (p.equity || 0) / free : 0 };
  city.youth = round1k((p.youth || 0) * k);
  city.base = round1k(free * k);
  city.own = (p.own || []).map(x => [...x]);
  return city;
}
// Wsparcie miasta w sezonie S: przyznane w grudniu, wcześniej szacunek
function cityGrants(c, S) {
  const city = cityParts(c);
  if (city.grants && city.grants[S]) return city.grants[S];
  const free = city.granted[S] != null ? city.granted[S] : city.base;
  const act = clubActive(c, S);
  return { sport: free * city.parts.sport, promo: free * city.parts.promo, equity: free * city.parts.equity, youth: act ? city.youth : 0, own: act ? city.own : [], est: city.granted[S] == null };
}
// Dotacja celowa miasta na organizację imprezy z kalendarza (wywołanie przy rozliczeniu zawodów na stadionie klubu – js/stadium.js)
function cityEventGrant(c, ev) {
  if (!c || !c.fin || !ev) return 0;
  const f = c.fin;
  f.evGrants = f.evGrants || {};
  if (f.evGrants[ev.id] != null) return 0;
  const city = cityParts(c), sgp = ev.kind === 'sgp' || ev.comp === 'SGP';
  let amt = sgp ? (CITY_EVENT_GRANT.sgp[c.id] ?? CITY_EVENT_GRANT.sgp.def * city.wealth / 4) : CITY_EVENT_GRANT[ev.comp] || 0;
  if (!sgp) amt *= (0.6 + city.wealth * 0.1) * (0.5 + city.stance) * (COMPS[ev.comp] && COMPS[ev.comp].series && !/finał/.test(ev.stage || ev.name || '') ? 0.5 : 1);
  amt = round1k(amt);
  f.evGrants[ev.id] = amt;
  if (!amt) return 0;
  addTx(c.id, 'miasto', amt, `Dotacja celowa miasta: organizacja – ${ev.name}`);
  earmarkTrack(c, 'miasto', amt, 'events');
  return amt;
}
// Dotacje celowe: wpływ (granted) i wydatki na cel (spent) w roku finansowym; koszty szkółki i organizacji imprez zdejmują środki celowe
const EARMARK_OF = { 'szkółka': 'youth', imprezy: 'events' };
const EARMARK_NAME = { youth: 'szkolenie dzieci i młodzieży', events: 'organizacja imprez' };
function earmarkTrack(c, kind, amount, mark) {
  if (!c.fin) return;
  const S = fyOf(G.date), e = (c.fin.earmark = c.fin.earmark || {})[S] || (c.fin.earmark[S] = { youth: { granted: 0, spent: 0 }, events: { granted: 0, spent: 0 } });
  if (mark && amount > 0) e[mark].granted += amount;
  else if (amount < 0 && EARMARK_OF[kind]) e[EARMARK_OF[kind]].spent += -amount;
}
// Wydatek klubu z rozliczeniem dotacji celowych (szkółka, organizacja imprez)
function finCharge(c, kind, amount, desc) { addTx(c.id, kind, amount, desc); earmarkTrack(c, kind, amount); }
// Niewydane środki celowe (nie można ich przeznaczyć na kontrakty ani inne wydatki)
function earmarkLeft(c, S = fyOf(G.date)) {
  const e = c.fin && c.fin.earmark && c.fin.earmark[S];
  return e ? { youth: Math.max(0, e.youth.granted - e.youth.spent), events: Math.max(0, e.events.granted - e.events.spent) } : { youth: 0, events: 0 };
}
const freeCash = c => c.cash - sum(Object.values(earmarkLeft(c)));
// 31 października: rozliczenie dotacji celowych – niewykorzystana część wraca do miasta
function earmarkSettle() {
  const S = fyOf(G.date);
  for (const c of Object.values(G.clubs)) {
    if (!c.fin) continue;
    const left = earmarkLeft(c, S), e = c.fin.earmark[S];
    for (const [k, v] of Object.entries(left)) if (v >= 1000) {
      addTx(c.id, 'zwrot', -Math.round(v), `Zwrot niewykorzystanej dotacji celowej (${EARMARK_NAME[k]}, sezon ${S})`);
      e[k].returned = Math.round(v);
    }
    if (c.id === G.clubId && e && (e.youth.granted || e.events.granted)) addMsg({ category: 'finanse', from: `Urząd Miasta ${c.city}`, title: `Rozliczenie dotacji celowych ${S}`,
      body: `<p>Szkolenie dzieci i młodzieży: przyznano ${fmtMoney(e.youth.granted)}, wydano na cel ${fmtMoney(Math.min(e.youth.spent, e.youth.granted))}${left.youth >= 1000 ? `, <b class="neg">zwrot ${fmtMoney(left.youth)}</b>` : ' – rozliczone w całości'}.</p>
        ${e.events.granted ? `<p>Organizacja imprez: przyznano ${fmtMoney(e.events.granted)}, wydano ${fmtMoney(Math.min(e.events.spent, e.events.granted))}${left.events >= 1000 ? `, <b class="neg">zwrot ${fmtMoney(left.events)}</b>` : ' – rozliczone w całości'}.</p>` : ''}
        <p class="small muted">Dotacja celowa może być wydana wyłącznie na cel wskazany w umowie; niewykorzystane środki klub zwraca do budżetu miasta.</p>`, link: '#/finanse/liga' });
  }
}

// Plan sezonu: wpłata właściciela uzupełnia przychody do kosztów, pozostałe koszty dopełniają budżet (z limitem).
// Zatwierdzany 1 grudnia (po głównym okienku transferowym); wcześniej szacunek.
function finPlan(c, S, forecast) {
  const f = finInit(c);
  if (f.plan && f.plan.S === S) return f.plan;
  if (f.planBusy) return { S, owner: 0, misc: 0 };
  f.planBusy = true;
  const items = finItems(c, S, { forecast: true }).filter(x => x.kind !== 'właściciel' && x.kind !== 'operacyjne' && x.kind !== 'finansowanie' && x.kind !== 'kredyt');
  delete f.planBusy;
  const lg = FL(c);
  const fx = seasonFixtures(c.league, S).filter(x => x.homeId === c.id || x.awayId === c.id);
  const homeN = fx.filter(x => x.homeId === c.id).length || 7, awayN = fx.filter(x => x.awayId === c.id).length || 7;
  const matchRev = stadiumMatchRevenue(c, S, homeN); // bilety (bez karnetowiczów), gastronomia i gadżety – js/stadium.js
  const matchCost = homeN * lg.matchCost + awayN * (18000 + 360 * 20) + sum(clubRiders(c.id).map(r => { const d = activeDeal(r); return d && d.kind !== 'amatorski' ? (termsFor(d, S) || d).perPoint * expectedSeasonPoints(r.skill, c.league) : 0; }));
  // średnie nagrody i fundusze ligi (medale, Fundusz Atrakcyjności, PRO Junior) oraz play-off (ok. 1 dodatkowy mecz domowy)
  const n = Object.values(G.clubs).filter(x => x.league === c.league && clubActive(x)).length || 8;
  const awards = (sum(lg.prizes) + lg.attract + (c.league === 'PGE' && typeof PRO_JUNIOR_POOL !== 'undefined' ? PRO_JUNIOR_POOL : 0)) / n + matchRev / homeN * 0.5;
  const rev = sum(items.filter(x => x.amount > 0).map(x => x.amount)) + matchRev + awards;
  const cost = -sum(items.filter(x => x.amount < 0).map(x => x.amount)) + matchCost;
  // klub gracza: zarząd planuje wydatki do budżetu (pozostałe koszty najwyżej 12%), klub AI: do wysokości przychodów (najwyżej 20%)
  // wpłata właściciela: deklaracja zarządu (stała od 1 grudnia, js/budget.js), wcześniej szacunek – uzupełnienie przychodów do budżetu klubu;
  // właściciel nie pokrywa już automatycznie każdego deficytu – wydatki ograniczają budżety płac i transferów
  const owner = round1k(!clubActive(c, S) || typeof ownerPlan !== 'function' ? clamp(cost - rev, 0, c.budget * 0.6) // klub uśpiony: właściciel pokrywa tylko koszty
    : f.ownerDecl && f.ownerDecl[S] != null ? f.ownerDecl[S] : clamp(c.budget - rev, 0, ownerCapacity(c)));
  // pozostałe koszty (marketing, ubezpieczenia, podatki): klub gracza – stałe 3% budżetu, klub AI – wydaje nadwyżkę (najwyżej 20%)
  const misc = round1k(c.id === G.clubId ? c.budget * 0.03 : clamp(rev + owner - cost - rev * 0.05, c.budget * 0.02, c.budget * 0.2));
  const plan = { S, owner, misc, rev: round1k(rev), cost: round1k(cost + misc) };
  // plan zatwierdzony od grudnia (dla klubu gracza przy pierwszym księgowaniu po 1 grudnia)
  if (!forecast && G.date >= fyDate(S, 12, 1)) f.plan = plan;
  return plan;
}

// ---------- Księgowanie ----------
function financeDay() {
  const d = G.date, day = Number(d.slice(8, 10)), m = Number(d.slice(5, 7)), S = fyOf(d);
  if (day === 1 || day === 15) {
    for (const c of Object.values(G.clubs)) {
      finInit(c);
      if (day === 1 && m === 12) { finPlan(c, S); cityDecision(c, S); }
      if (day === 15 && m === 12 && !c.fin.karnety[S]) c.fin.karnety[S] = { ...karnetPlan(c, S), est: false };
      for (const x of finItems(c, S)) if (x.date === d) {
        addTx(c.id, x.kind, x.amount, x.desc);
        earmarkTrack(c, x.kind, x.amount, x.earmark);
        if (x.sp && G.sponsors[x.sp]) { const s = G.sponsors[x.sp]; s.paid[S] = (s.paid[S] || 0) + x.amount; }
        if (x.reserve) { const r = c.fin.reserve.find(r => r.season === x.reserve); if (r) r.paid = true; }
      }
      if (day === 1) {
        // odsetki od zaległości (ujemne saldo)
        if (c.cash < 0) addTx(c.id, 'kredyt', Math.round(c.cash * 0.01), 'Odsetki i koszty zaległości (ujemne saldo)');
        c.fin.loans = c.fin.loans.filter(l => l.schedule.some(p => p.date >= d));
        c.fin.extra = c.fin.extra.filter(x => x.date >= d);
      }
    }
  }
  if (day === 1 && (m === 9 || m === 10)) licenceWarning();
  if (d.endsWith('-10-31')) { earmarkSettle(); licenceCheck(); if (typeof ledgerYearEnd === 'function') { ledgerYearEnd(S); infraSeasonEnd(S); } }
  if (d.endsWith('-12-01') && typeof budgetApprove === 'function') budgetApprove(S); // zarząd zatwierdza plan sezonu (js/budget.js)
  sponsorTalksDay();
  sponsorRenewalsDay();
  if (new Date(d + 'T12:00:00Z').getUTCDay() === 1) sponsorInboundWeek(); // poniedziałek: firmy zgłaszają się do klubów
  finTalksDay();
}
// Miesięczne księgowania płac, szkółki i rat kontraktów (dotychczasowa logika) – wywoływane 1. dnia miesiąca
function monthlyFinance() {
  for (const c of Object.values(G.clubs)) {
    contractMonthly(c); // raty za podpis (luty–lipiec), stypendia kontraktów amatorskich
    const wages = sum(clubStaff(c.id).map(s => s.wage));
    if (wages) addTx(c.id, 'płace', -wages, 'Wynagrodzenia sztabu');
    if (c.academyBudget) finCharge(c, 'szkółka', -Math.round(c.academyBudget / 12), 'Szkółka żużlowa');
  }
  const me = myClub();
  if (me.cash < 0 && !G.warnedDebt) {
    G.warnedDebt = true;
    addMsg({ category: 'zarząd', from: 'Prezes klubu', title: 'Klub ma ujemne saldo!', stop: true, body: `<p>Stan konta: <b class="neg">${fmtMoney(me.cash)}</b>. Od zaległości naliczane są odsetki (1% miesięcznie). Ogranicz wydatki, poszukaj sponsorów albo skorzystaj z finansowania (Finanse → Finansowanie). Do 31 października trzeba uregulować zobowiązania – to warunek licencji.</p>`, link: '#/finanse/finansowanie' });
  }
  if (me.cash >= 0) G.warnedDebt = false;
}
// Wpływy meczowe (wywoływane po meczu): bilety według sektorów i kategorii (bez karnetowiczów), gastronomia, gadżety, organizacja, wyjazd
function matchFinance(m, home, away, fx) {
  const lg = FL(home), S = fyOf(m.date);
  const g = m.gate || gateSummary(leagueGate(home, away, fx, m.weather, false));
  addTx(home.id, 'bilety', g.rev, `Bilety: ${home.short} – ${away.short} (${fmtNum(g.att)} widzów, w tym ${fmtNum(g.holders)} z karnetem)`);
  addTx(home.id, 'gastronomia', g.att * lg.gastro, `Gastronomia: mecz z ${away.name}`);
  addTx(home.id, 'gadzety', g.att * lg.merch, `Gadżety: mecz z ${away.name}`);
  addTx(home.id, 'mecze', -lg.matchCost, 'Organizacja meczu (sędzia, komisarz, karetki, ochrona, obsługa)');
  addTx(away.id, 'wyjazd', -Math.round(18000 + home.stadium.track * 20), `Wyjazd na mecz do ${home.city}`);
  if (home.fin) { home.fin.passes[S] = (home.fin.passes[S] || 0) + (m.passes || 0); gateStats(home, S, g); }
}
// Prognoza meczowa dla nierozegranych spotkań sezonu i zawodów na stadionie klubu
function matchForecast(c, S) {
  const lg = FL(c), out = [];
  const pp = sum(clubRiders(c.id).map(r => { const d = activeDeal(r); return d && d.kind !== 'amatorski' ? ((termsFor(d, S) || d).perPoint || 0) * expectedSeasonPoints(r.skill, c.league) : 0; })) / 14;
  for (const fx of seasonFixtures(c.league, S).filter(x => !x.played && (x.homeId === c.id || x.awayId === c.id) && x.date >= G.date)) {
    const d = fx.date;
    if (fx.homeId === c.id) {
      const g = leagueGate(c, G.clubs[fx.awayId], fx, null, true);
      out.push({ date: d, kind: 'bilety', amount: g.rev, desc: `Bilety (prognoza): mecz z ${G.clubs[fx.awayId].short}` });
      out.push({ date: d, kind: 'gastronomia', amount: Math.round(g.att * lg.gastro), desc: 'Gastronomia (prognoza)' });
      out.push({ date: d, kind: 'gadzety', amount: Math.round(g.att * lg.merch), desc: 'Gadżety (prognoza)' });
      out.push({ date: d, kind: 'mecze', amount: -lg.matchCost, desc: 'Organizacja meczu (prognoza)' });
    } else out.push({ date: d, kind: 'wyjazd', amount: -Math.round(18000 + G.clubs[fx.homeId].stadium.track * 20), desc: `Wyjazd do ${G.clubs[fx.homeId].city} (prognoza)` });
    if (pp) out.push({ date: d, kind: 'punkty', amount: -Math.round(pp), desc: 'Premie za punkty (prognoza)' });
  }
  return out.concat(eventsForecast(c, S));
}
// Prognoza przepływów od jutra do 31 października sezonu sportowego
function finForecast(c) {
  const end = `${sportSeason()}-10-31`, from = addDays(G.date, 1);
  const items = [];
  for (let S = fyOf(from); S <= sportSeason(); S++) items.push(...finItems(c, S, { forecast: true }), ...matchForecast(c, S));
  const S = sportSeason();
  // nagrody po sezonie (prognoza wg miejsca w tabeli)
  if (G.seasonClosed !== S) {
    const lg = FL(c), t = leagueTable(c.league, S), pos = (t.find(r => r.clubId === c.id) || {}).pos || 99;
    if (pos <= 3) items.push({ date: `${S}-10-15`, kind: 'nagrody', amount: lg.prizes[pos - 1], desc: `Nagroda za ${pos}. miejsce (prognoza wg tabeli)` });
    if (c.league === 'PGE' && typeof PRO_JUNIOR_POOL !== 'undefined' && S >= PRO_JUNIOR_FROM) items.push({ date: `${S}-10-15`, kind: 'tv', amount: Math.round(PRO_JUNIOR_POOL / 8), desc: 'PRO Junior (prognoza: średnia na klub)' });
    if (lg.attract) items.push({ date: `${S}-10-15`, kind: 'nagrody', amount: Math.round(lg.attract / 8), desc: 'Fundusz Atrakcyjności (prognoza: średnia)' });
  }
  // odsetki od prognozowanego ujemnego salda
  const list = items.filter(x => x.date >= from && x.date <= end).sort(by(x => x.date));
  let cash = c.cash;
  const out = [];
  for (const x of list) {
    if (x.date.endsWith('-01') && cash < 0 && x.kind === 'administracja') out.push({ date: x.date, kind: 'kredyt', amount: Math.round(cash * 0.01), desc: 'Odsetki od zaległości (prognoza)', fc: true });
    cash += x.amount; out.push({ ...x, fc: true });
  }
  return out;
}

// ---------- Nagrody i fundusze ligi (koniec sezonu) ----------
function finSeasonEnd(results) {
  const S = G.season;
  for (const lg of Object.keys(results)) {
    const p = FIN_LEAGUE[lg], order = results[lg];
    order.slice(0, 3).forEach((id, i) => addTx(id, 'nagrody', p.prizes[i], `Nagroda za ${i + 1}. miejsce w ${LEAGUES[lg].name} ${S}`));
    if (p.reserve) for (const id of order) { const c = G.clubs[id]; finInit(c).reserve.push({ season: S, amount: p.reserve }); }
    if (p.attract) {
      const passes = Object.fromEntries(order.map(id => [id, (G.clubs[id].fin && G.clubs[id].fin.passes[S]) || 0]));
      const tot = sum(Object.values(passes));
      if (tot) for (const id of order) if (passes[id]) addTx(id, 'nagrody', Math.round(p.attract * passes[id] / tot), `Fundusz Atrakcyjności: ${passes[id]} mijanek w meczach domowych (${Math.round(p.attract / tot)} zł za mijankę)`);
    }
    // Ekstraliga Pro Junior System: payProJunior() w js/market.js (pula 8 mln zł, punkty wychowanków w PGE)
  }
  stadiumSeasonEnd(); // baza kibiców po sezonie: ceny biletów, dzieci na trybunach (js/stadium.js)
  sponsorsSeasonEnd(results); // premie sponsorów za wynik, klauzule awans / spadek, cel zarządu (js/sponsors.js)

}

// ---------- Miasto ----------
// Decyzja o wsparciu na sezon (grudzień): bazowa kwota, wniosek klubu, przychylność władz, liga i frekwencja
function cityDecision(c, S) {
  const city = cityParts(c);
  if (city.granted[S] != null) return;
  const lgF = { PGE: 1, '2E': 0.85, KLZ: 0.6 }[c.league];
  const prev = city.leagueAt;
  if (prev && prev !== c.league) city.base *= LEAGUE_ORDER.indexOf(c.league) < LEAGUE_ORDER.indexOf(prev) ? 1.25 : 0.8;
  city.leagueAt = c.league;
  const base = city.base * (0.95 + rnd() * 0.1);
  const req = c.id === G.clubId && city.request ? city.request : base;
  let granted = base;
  if (req > base) granted = base + (req - base) * clamp(city.stance * (0.4 + city.wealth / 10) * (0.7 + rnd() * 0.6) * (typeof dutyF === 'function' ? dutyF('city', c.id) : 1), 0, 1);
  else granted = req;
  const act = clubActive(c);
  city.granted[S] = round1k(granted * (act ? 1 : 0.2));
  void lgF;
  // dotacje celowe: szkolenie młodzieży i własne turnieje klubu – niezależne od wniosku, tylko na swój cel
  city.grants = city.grants || {};
  const free = city.granted[S];
  city.grants[S] = { sport: free * city.parts.sport, promo: free * city.parts.promo, equity: free * city.parts.equity, youth: act ? round1k(city.youth * (0.95 + rnd() * 0.1)) : 0, own: act ? city.own.map(x => [...x]) : [] };
  city.request = null;
  const g = city.grants[S];
  if (c.id === G.clubId) addMsg({ category: 'finanse', from: `Urząd Miasta ${c.city}`, title: `Wsparcie miasta na sezon ${S}: ${fmtMoney(cityAmount(c, S), true)}`,
    body: `<p>Rada Miasta przyjęła budżet${req > base * 1.02 ? ` (wnioskowano ${fmtMoney(round1k(req))} środków ogólnych)` : ''}:</p><ul>
      ${g.sport ? `<li>dotacja na rozwój sportu: <b>${fmtMoney(g.sport)}</b> (raty marzec–wrzesień)</li>` : ''}${g.promo ? `<li>umowa promocyjna: <b>${fmtMoney(g.promo)}</b> (kwiecień, lipiec)</li>` : ''}
      ${g.equity ? `<li>dokapitalizowanie spółki: <b>${fmtMoney(g.equity)}</b> (luty, czerwiec)</li>` : ''}${g.youth ? `<li>dotacja celowa na szkolenie dzieci i młodzieży: <b>${fmtMoney(g.youth)}</b> – tylko na szkółkę</li>` : ''}
      ${g.own.map(([n, a]) => `<li>dotacja celowa na turniej „${esc(n)}”: <b>${fmtMoney(a)}</b> – tylko na jego organizację</li>`).join('')}</ul>
      <p class="small muted">Imprezy z kalendarza (Grand Prix, finały mistrzostw) dostają osobną dotację celową, gdy odbywają się na naszym stadionie. Niewykorzystane dotacje celowe wracają do miasta 31 października.</p>`, link: '#/finanse/liga' });
}

// ---------- Licencja ----------
function licenceWarning() {
  const c = myClub();
  if (!c.fin) return;
  const fc = finForecast(c);
  const end = c.cash + sum(fc.map(x => x.amount));
  if (end >= 0) return;
  addMsg({ category: 'zarząd', from: 'Dyrektor finansowy', stop: true, title: `Prognoza na 31 października: ${fmtMoney(end, true)}`,
    body: `<p>Przy obecnych umowach skończymy sezon z saldem <b class="neg">${fmtMoney(end)}</b>. Zaległości wobec zawodników i kontrahentów na 31 października oznaczają licencję nadzorowaną i zakaz zatwierdzania nowych kontraktów.</p><p>Możliwości: nowi sponsorzy, kredyt (najlepiej z poręczeniem miasta), dotacja nadzwyczajna, dokapitalizowanie przez akcjonariuszy, zbiórka kibiców, sprzedaż zawodnika.</p>`, link: '#/finanse/finansowanie' });
}
function licenceCheck() {
  if (typeof licenceSettlement === 'function') return licenceSettlement(); // pełna procedura licencyjna: js/licence.js
  const S = sportSeason() + (G.seasonClosed === G.season ? 0 : 1);
  for (const c of Object.values(G.clubs)) {
    finInit(c);
    if (c.cash >= 0) { if (c.fin.licence && c.fin.licence.status !== 'ok') c.fin.licence = { S, status: 'ok' }; continue; }
    const debt = -c.cash;
    if (c.id !== G.clubId) {
      // klub AI: akcjonariusze i miasto ratują klub w miarę możliwości (jak w Gorzowie: akcjonariusze, kredyt z poręczeniem, miasto)
      const city = c.fin.city;
      const fromCity = Math.min(debt * 0.5, city.base * (city.owner ? 1 : city.stance * 0.6));
      if (fromCity > 0) addTx(c.id, 'miasto', round1k(fromCity), 'Pomoc miasta (licencja)');
      const fromOwner = Math.min(-c.cash, c.budget * c.fin.ownerCap * (0.5 + rnd()));
      if (fromOwner > 0) addTx(c.id, 'właściciel', round1k(fromOwner), 'Dokapitalizowanie przez akcjonariuszy (licencja)');
      // reszta: nowy inwestor / układ z wierzycielami – klub musi ciąć budżet o tyle samo
      if (c.cash < 0) { c.fin.rescued = -c.cash; addTx(c.id, 'finansowanie', -c.cash, 'Nowy inwestor / układ z wierzycielami (licencja)'); }
      continue;
    }
    const heavy = debt > c.budget * 0.2;
    c.fin.licence = { S, status: heavy ? 'warunkowa' : 'nadzorowana', debt: round1k(debt) };
    G.board.confidence = clamp(G.board.confidence - (heavy ? 30 : 15), 0, 100);
    let forced = 0;
    if (heavy) { forced = round1k(debt - c.budget * 0.1); addTx(c.id, 'właściciel', forced, 'Przymusowe dokapitalizowanie przez akcjonariuszy (warunek licencji)'); }
    addMsg({ category: 'zarząd', from: 'Komisja licencyjna', stop: true, title: heavy ? 'Licencja warunkowa – klub na krawędzi' : 'Licencja nadzorowana',
      body: `<p>Na 31 października klub ma zaległości: <b class="neg">${fmtMoney(debt)}</b>.</p>${heavy ? `<p>Akcjonariusze musieli pilnie dopłacić ${fmtMoney(forced)}, żeby klub w ogóle otrzymał licencję. Zarząd jest wściekły.</p>` : ''}
        <p>Do czasu spłaty zaległości obowiązuje <b>zakaz zatwierdzania nowych kontraktów</b> (poza amatorskimi) i nadzór finansowy ligi.</p>`, link: '#/finanse/finansowanie' });
  }
}
// Czy klub może podpisać kontrakt zawodowy (blokada licencyjna)
function finBlocked(clubId) {
  const c = G.clubs[clubId];
  return !!(c && c.fin && c.fin.licence && c.fin.licence.status !== 'ok' && c.cash < 0);
}

// ---------- Nowy sezon: odnowienia sponsorów, nazwy, budżety ----------
function finNewSeason() {
  const S = G.season;
  for (const c of Object.values(G.clubs)) {
    finInit(c);
    if (c.fin.licence && c.cash >= 0) c.fin.licence = null;
    sponsorsNewSeason(c, S); // odnowienia, rozmowy o przedłużeniu, cel zarządu, nazwa drużyny (js/sponsors.js)
  }
}
// ---------- Kredyty i pomoc awaryjna ----------
// Wnioski rozpatrywane z opóźnieniem: bank (7–10 dni), sesja rady miasta (2–5 tygodni), akcjonariusze (10–20 dni), zbiórka kibiców (3 tygodnie)
const FIN_REQ = {
  loan: 'Kredyt bankowy', guarantee: 'Poręczenie kredytu przez miasto', cityGrant: 'Dotacja nadzwyczajna miasta', cityShares: 'Zakup akcji klubu przez miasto',
  ownerEquity: 'Dokapitalizowanie przez akcjonariuszy', ownerLoan: 'Pożyczka akcjonariusza', fans: 'Zbiórka kibiców („cegiełki”)',
};
function finRevenue(c) { const p = finPlan(c, fyOf(G.date), true); return Math.max(c.budget * 0.5, p.rev || c.budget); }
function finDebt(c) { return sum(c.fin.loans.map(l => sum(l.schedule.filter(p => p.date >= G.date).map(p => p.principal)))) + Math.max(0, -c.cash); }
function loanTerms(c, amount, years) {
  const R = finRevenue(c), D = finDebt(c), g = c.fin.city.guarantee || 0;
  const max = round1k(Math.max(0, R * 0.25 + g - D * 0.5));
  const rate = 0.075 + 0.06 * clamp(D / R, 0, 1) + (c.fin.licence && c.fin.licence.status !== 'ok' ? 0.02 : 0) - (g ? 0.015 : 0);
  return { max, rate: round2(rate * 100) / 100, amount: Math.min(amount, max), years };
}
function annuity(amount, rate, months) { const r = rate / 12; return r ? amount * r / (1 - Math.pow(1 + r, -months)) : amount / months; }
function addLoan(c, name, amount, rate, months, startDate) {
  const id = `L${G.seq.loan = (G.seq.loan || 0) + 1}`;
  const pay = annuity(amount, rate, months);
  let left = amount;
  const schedule = [];
  let d = startDate;
  for (let i = 1; i <= months; i++) {
    const interest = left * rate / 12, principal = pay - interest;
    left -= principal;
    schedule.push({ no: i, date: d, amount: Math.round(pay), principal: Math.round(principal), interest: Math.round(interest) });
    const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
    d = m === 12 ? ymd(y + 1, 1, 1) : ymd(y, m + 1, 1);
  }
  c.fin.loans.push({ id, name, amount, rate, months, schedule, since: G.date });
}
const nextMonth1 = d => { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return m === 12 ? ymd(y + 1, 1, 1) : ymd(y, m + 1, 1); };
function finRequest(kind, amount, years = 2) {
  const c = myClub(), f = finInit(c), S = fyOf(G.date);
  G.finTalks = G.finTalks || {};
  if (Object.values(G.finTalks).some(x => x.kind === kind && x.status === 'pending')) return { ok: false, text: 'Taki wniosek jest już rozpatrywany.' };
  amount = round1k(Math.max(0, amount || 0));
  if (kind !== 'fans' && amount < 50000) return { ok: false, text: 'Minimalna kwota wniosku to 50 tys. zł.' };
  if (kind === 'fans' && f.fundraiser === S) return { ok: false, text: 'Zbiórkę wśród kibiców można zorganizować raz w sezonie.' };
  if (['cityShares'].includes(kind) && !f.city.owner && f.city.stance < 0.6) return { ok: false, text: 'Władze miasta nie są zainteresowane kupowaniem akcji klubu.' };
  const days = { loan: rint(7, 10), guarantee: rint(14, 35), cityGrant: rint(14, 35), cityShares: rint(21, 45), ownerEquity: rint(10, 20), ownerLoan: rint(5, 12), fans: 21 }[kind];
  const id = `FR${G.seq.fr = (G.seq.fr || 0) + 1}`;
  G.finTalks[id] = { id, kind, amount, years, status: 'pending', due: addDays(G.date, days), made: G.date };
  if (kind === 'fans') f.fundraiser = S;
  if (kind.startsWith('city') || kind === 'guarantee') f.city.asks[S] = (f.city.asks[S] || 0) + 1;
  return { ok: true, text: `${FIN_REQ[kind]}: decyzja do ${fmtDate(G.finTalks[id].due)}.` };
}
function finTalksDay() {
  const c = myClub();
  if (!c.fin) return;
  const f = c.fin, city = f.city, S = fyOf(G.date);
  const fansF = clamp((c.fans || 5000) / 30000, 0.3, 1.5);
  const asks = city.asks[S] || 0;
  for (const x of Object.values(G.finTalks || {})) {
    if (x.status !== 'pending' || G.date < x.due) continue;
    let ok = false, text = '', amount = x.amount;
    if (x.kind === 'loan') {
      const t = loanTerms(c, x.amount, x.years);
      if (t.max < 100000) text = 'Bank odmawia: zbyt wysokie zadłużenie w stosunku do przychodów. Poręczenie miasta poprawiłoby zdolność kredytową.';
      else { x.offer = t; x.status = 'offer'; addMsg({ category: 'finanse', from: 'Bank', stop: true, title: `Decyzja kredytowa: ${fmtMoney(t.amount, true)}`, body: `<p>Bank może udzielić kredytu <b>${fmtMoney(t.amount)}</b>${t.amount < x.amount ? ` (wnioskowano ${fmtMoney(x.amount)})` : ''} na ${x.years} ${plural(x.years, 'rok', 'lata', 'lat')}, oprocentowanie <b>${(t.rate * 100).toFixed(1).replace('.', ',')}%</b>. Raty miesięczne od ${fmtDate(nextMonth1(G.date))}.</p><p>Przyjmij ofertę w zakładce Finanse → Finansowanie.</p>`, link: '#/finanse/finansowanie' }); continue; }
    } else if (x.kind === 'guarantee' || x.kind === 'cityGrant' || x.kind === 'cityShares') {
      const cap = { guarantee: city.wealth * 1.2e6 + city.base * 0.5, cityGrant: Math.max(300000, city.base * 0.6), cityShares: city.wealth * 1.5e6 }[x.kind];
      const p = clamp((city.owner ? 0.5 : 0) + city.stance * (0.45 + city.wealth / 12) * fansF * Math.pow(0.75, asks - 1) * (x.kind === 'cityGrant' ? 0.8 : 1) * (typeof dutyF === 'function' ? dutyF('city', c.id) : 1), 0.02, 0.95);
      amount = round1k(Math.min(x.amount, cap));
      ok = chance(p);
      if (ok) {
        city.stance = clamp(city.stance - (city.owner ? 0.02 : 0.08), 0.05, 1); // każda złotówka dla żużla to temat polityczny
        if (x.kind === 'guarantee') { city.guarantee = (city.guarantee || 0) + amount; text = `Rada Miasta poręczyła kredyt klubu do kwoty ${fmtMoney(amount)}. Bank zaoferuje teraz lepsze warunki i wyższą kwotę.`; }
        else if (x.kind === 'cityGrant') { f.extra.push({ date: payDayFrom(addDays(G.date, 14)), kind: 'miasto', amount: Math.round(amount / 2), desc: 'Dotacja nadzwyczajna miasta (1/2)' }, { date: payDayFrom(addDays(G.date, 45)), kind: 'miasto', amount: Math.round(amount / 2), desc: 'Dotacja nadzwyczajna miasta (2/2)' }); text = `Rada Miasta przesunęła w budżecie ${fmtMoney(amount)} na wsparcie klubu (cel: kontrakty i organizacja meczów). Pieniądze wpłyną w dwóch ratach.`; }
        else { f.extra.push({ date: payDayFrom(addDays(G.date, 10)), kind: 'finansowanie', amount, desc: 'Objęcie akcji klubu przez miasto' }); text = `Miasto obejmie nowe akcje klubu za ${fmtMoney(amount)}.`; }
      } else text = `Rada Miasta nie poparła wniosku (${FIN_REQ[x.kind].toLowerCase()}). ${city.stance < 0.4 ? 'Wsparcie żużla budzi w mieście duże kontrowersje.' : 'Radni oczekują najpierw planu naprawczego.'}`;
    } else if (x.kind === 'ownerEquity' || x.kind === 'ownerLoan') {
      const cap = c.budget * f.ownerCap * (x.kind === 'ownerLoan' ? 1.2 : 1);
      const p = clamp((G.board.confidence / 100) * (x.kind === 'ownerLoan' ? 1 : 0.75) + 0.15, 0.05, 0.95);
      amount = round1k(Math.min(x.amount, cap));
      ok = chance(p) && amount >= 50000;
      if (ok && x.kind === 'ownerEquity') { f.extra.push({ date: payDayFrom(addDays(G.date, 7)), kind: 'finansowanie', amount, desc: 'Dokapitalizowanie przez akcjonariuszy' }); G.board.confidence = clamp(G.board.confidence - 5, 0, 100); text = `Akcjonariusze dopłacą ${fmtMoney(amount)} (emisja akcji). Oczekują poprawy wyników finansowych.`; }
      else if (ok) { f.extra.push({ date: payDayFrom(addDays(G.date, 5)), kind: 'finansowanie', amount, desc: 'Pożyczka od akcjonariusza' }); addLoan(c, 'Pożyczka akcjonariusza', amount, 0.03, 12, nextMonth1(addDays(G.date, 35))); text = `Akcjonariusz pożyczy ${fmtMoney(amount)} na 3% (spłata w 12 ratach).`; }
      else text = 'Akcjonariusze nie zgodzili się na dopłatę. Zarząd oczekuje cięcia kosztów.';
    } else if (x.kind === 'fans') {
      amount = round1k((c.fans || 5000) * (4 + rnd() * 8) * (0.6 + G.board.confidence / 200));
      ok = true;
      f.extra.push({ date: payDayFrom(addDays(G.date, 1)), kind: 'finansowanie', amount, desc: 'Zbiórka kibiców („cegiełki”)' });
      text = `Kibice zebrali ${fmtMoney(amount)}. Dziękujemy!`;
    }
    x.status = ok ? 'ok' : 'rejected'; x.result = text; x.granted = ok ? amount : 0;
    addMsg({ category: 'finanse', from: x.kind === 'fans' ? 'Stowarzyszenie kibiców' : x.kind.startsWith('owner') ? 'Akcjonariusze' : x.kind === 'loan' ? 'Bank' : `Rada Miasta ${c.city}`, stop: true, title: `${FIN_REQ[x.kind]}: ${ok ? 'zgoda' : 'odmowa'}`, body: `<p>${text}</p>`, link: '#/finanse/finansowanie' });
  }
}
function acceptLoan(id) {
  const x = G.finTalks[id], c = myClub();
  if (!x || x.status !== 'offer') return { ok: false, text: 'Oferta nieaktualna.' };
  addTx(c.id, 'finansowanie', x.offer.amount, `Kredyt bankowy (${(x.offer.rate * 100).toFixed(1).replace('.', ',')}%, ${x.years} ${plural(x.years, 'rok', 'lata', 'lat')})`);
  addLoan(c, 'Kredyt bankowy', x.offer.amount, x.offer.rate, x.years * 12, nextMonth1(G.date));
  x.status = 'ok'; x.granted = x.offer.amount;
  return { ok: true, text: `Kredyt ${fmtMoney(x.offer.amount)} wpłynął na konto.` };
}

// ---------- Zgodność ze starszym API (limit kontraktów w js/market.js) ----------
// seasonPlan / expectedRevenue: plan sezonu z modułu finansów; c.subsidy = wpłata właściciela
function seasonPlan(c) { if (!c || !c.fin) return c; c.subsidy = finPlan(c, sportSeason(), true).owner; return c; }
function expectedRevenue(c) {
  const p = finPlan(c, sportSeason(), true);
  const items = finItems(c, sportSeason(), { forecast: true });
  const part = k => sum(items.filter(x => k.includes(x.kind)).map(x => x.amount));
  return { sponsors: part(['sponsor']), tv: part(['liga']), tickets: p.rev - part(['sponsor', 'liga', 'miasto']), city: part(['miasto']), total: p.rev };
}

// ---------- Migracja zapisu i start ----------
function finMigrate() {
  let ch = false;
  G.spTalks = G.spTalks || {}; G.finTalks = G.finTalks || {};
  for (const c of Object.values(G.clubs)) {
    if (c.fin && !c.fin.prices) { spInit(c); ch = true; }
    if (c.fin) continue;
    ch = true;
    finInit(c);
    for (const s of Object.values(G.sponsors).filter(s => s.clubId === c.id)) {
      if (s.assets) continue;
      s.firm = firmKey(s.name); s.since = Math.min(s.since || G.season, G.season); s.paid = {};
      s.assets = s.kind === 'tytularny' ? { name: 1, chest: 1 } : s.kind === 'miasto' ? {} : { banner: 1 };
      s.plan = s.kind === 'tytularny' ? 'four' : 'once';
      if (s.kind === 'miasto') { c.fin.city.base = Math.max(c.fin.city.base, s.perYear); delete G.sponsors[s.id]; }
      if (s.kind === 'tytularny') s.brand = (CLUB_FIN[c.id] || {}).brand || s.name;
    }
  }
  return ch;
}
