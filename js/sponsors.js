'use strict';
// Sponsorzy: wartość marketingowa klubu, cennik miejsc reklamowych ustalany przez klub na sezony S…S+2, sprzedaż miejsc z wyprzedzeniem,
// umowy wieloletnie (kwota gwarantowana na każdy sezon, premie za wynik, klauzule na awans i spadek, wyłączność branżowa),
// firmy same zgłaszające się do klubu (zapytania przychodzące), negocjacje i rynek firm. Kluby AI korzystają z tego samego modelu.
// Dane: AD_SLOTS, PAY_PLANS, CLUB_FIN.spTotal, COMPANY_DB (js/finance-data.js).

// ---------- Wartość marketingowa ----------
const LG_BUDGET_F = { PGE: 1, '2E': 0.5, KLZ: 0.28 };
// Pamięć podręczna wycen na jeden dzień gry (tabela ligi i siła składów liczone raz dziennie)
const SP_MEMO = { d: null, m: new Map() };
function spMemo(key, fn) {
  if (SP_MEMO.d !== G.date + '|' + G.seed) { SP_MEMO.d = G.date + '|' + G.seed; SP_MEMO.m.clear(); }
  if (!SP_MEMO.m.has(key)) SP_MEMO.m.set(key, fn());
  return SP_MEMO.m.get(key);
}
// Indeks wartości marketingowej (1 = przeciętny klub swojej ligi): renoma, kibice, zamożność rynku, ostatni wynik
function marketIndex(c) { return spMemo('mi' + c.id + '|' + c.league + '|' + c.history.length, () => marketIndex0(c)); }
function marketIndex0(c) {
  const last = c.history[c.history.length - 1];
  const city = (c.fin && c.fin.city) || { wealth: 3 };
  const parts = [
    ['Renoma klubu', 0.7 + (c.rep || 40) / 200],
    ['Kibice', 0.7 + Math.min(c.fans || 0, 60000) / 60000 * 0.7],
    ['Rynek lokalny (zamożność miasta)', 0.85 + city.wealth * 0.05],
    ['Ostatni sezon', !last ? 1 : LEAGUE_ORDER.indexOf(last.league) > LEAGUE_ORDER.indexOf(c.league) ? 1.06 : last.pos <= 3 ? 1.1 : last.pos >= 7 ? 0.93 : 1],
  ];
  if (c.id === G.clubId && typeof dutyF === 'function') parts.push(['Media i wizerunek (osoba odpowiedzialna)', round2(1 + (dutyF('media', c.id) - 1) * 0.5)]);
  const v = clamp(parts.reduce((a, p) => a * p[1], 1) / 1.15, 0.45, 2.2);
  return { v: round2(v), parts };
}
// Siła składu (7 najlepszych) i ranking w lidze – do szans na wynik
function squadPower(c) { return sum(clubRiders(c.id).map(r => r.skill || 0).sort((a, b) => b - a).slice(0, 7)); }
function expectedPos(c) { return spMemo('ep' + c.id + '|' + c.league + '|' + G.seasonClosed, () => expectedPos0(c)); }
function expectedPos0(c) {
  const same = Object.values(G.clubs).filter(x => x.league === c.league && clubActive(x));
  const n = same.length || 8;
  const rank = same.sort(by(x => squadPower(x), -1)).indexOf(c) + 1 || Math.ceil(n / 2);
  let e = rank, w = 0;
  if (G.seasonClosed !== G.season) {
    const t = leagueTable(c.league), row = t.find(r => r.clubId === c.id);
    if (row && row.m) { w = clamp(row.m / 14, 0, 0.9); e = rank * (1 - w) + row.pos * w; }
  }
  return { e, n, w };
}
const logistic = x => 1 / (1 + Math.exp(-x));
// Szansa na miejsce 1..k w lidze (szacunek działu marketingu)
function posChance(c, k) { const { e, n } = expectedPos(c); return clamp(logistic((k + 0.5 - e) / Math.max(0.8, n * 0.16)), 0.01, 0.97); }
// Szanse na ligę w sezonie S (awans / spadek po bieżącym sezonie)
function leagueOdds(c, S = sportSeason()) { return spMemo('lo' + c.id + '|' + c.league + '|' + S + '|' + G.seasonClosed, () => leagueOdds0(c, S)); }
function leagueOdds0(c, S) {
  const lg = c.league, i = LEAGUE_ORDER.indexOf(lg);
  if (S <= sportSeason() || !clubActive(c)) return { [lg]: 1 };
  const up = i > 0 ? LEAGUE_ORDER[i - 1] : null, down = i < LEAGUE_ORDER.length - 1 ? LEAGUE_ORDER[i + 1] : null;
  const { e, n } = expectedPos(c);
  const pUp = up ? clamp(0.62 * logistic((1.3 - e) * 1.6) + 0.25 * logistic((2.4 - e) * 1.6), 0.02, 0.75) : 0;
  const pDown = down ? clamp(0.6 * logistic((e - n + 0.3) * 1.6) + 0.2 * logistic((e - n + 1.4) * 1.6), 0.02, 0.75) : 0;
  const o = { [lg]: 1 - pUp - pDown };
  if (up) o[up] = pUp;
  if (down) o[down] = (o[down] || 0) + pDown;
  return o;
}
const oddsMult = (c, S, f) => sum(Object.entries(leagueOdds(c, S)).map(([lg, p]) => p * f(lg)));
// Cena rynkowa miejsca reklamowego w sezonie S (wycena działu marketingu; dla przyszłych sezonów – ważona szansą awansu / spadku)
function adPrice(c, slotId, S = sportSeason()) {
  return Math.max(1000, round1k(AD[slotId].price * oddsMult(c, S, lg => FIN_LEAGUE[lg].adMult) * marketIndex(c).v));
}
// Cennik klubu (gracz ustala ceny; domyślnie wycena rynkowa)
function listPrice(c, slotId, S = sportSeason()) {
  const p = c.fin && c.fin.prices && c.fin.prices[S];
  return p && p[slotId] != null ? p[slotId] : adPrice(c, slotId, S);
}
function packageValue(c, assets, S = sportSeason()) { return sum(Object.entries(assets || {}).map(([k, n]) => listPrice(c, k, S) * n)); }
function marketValueOf(c, assets, S = sportSeason()) { return sum(Object.entries(assets || {}).map(([k, n]) => adPrice(c, k, S) * n)); }

// ---------- Umowy ----------
const activeSponsors = (c, S = sportSeason()) => Object.values(G.sponsors).filter(s => s.clubId === c.id && s.since <= S && s.until >= S);
// Kwota gwarantowana umowy w sezonie S (umowy wieloletnie mają kwotę na każdy sezon)
const spAmount = (s, S) => s.amounts && s.amounts[S] != null ? s.amounts[S] : s.perYear;
const spBonuses = s => s.bonuses || (s.bonus ? [{ t: 'medal', amt: s.bonus }] : []);
// Miejsca zarezerwowane dla obecnego sponsora (prawo pierwszeństwa do 31 sierpnia ostatniego sezonu umowy, chyba że klub zrezygnował)
const rofrHolds = (s, S) => s.until === S - 1 && s.rofr && !s.renewed && !s.released && G.date < `${S - 1}-09-01`;
function slotUse(c, S, skipId) {
  const use = {};
  for (const s of Object.values(G.sponsors)) {
    if (s.clubId !== c.id || s.id === skipId) continue;
    if ((s.since <= S && s.until >= S) || rofrHolds(s, S)) for (const [k, n] of Object.entries(s.assets || {})) use[k] = (use[k] || 0) + n;
  }
  return use;
}
function slotFree(c, S, slotId) { return AD[slotId].cap - (slotUse(c, S)[slotId] || 0); }
const assetsText = a => Object.entries(a || {}).map(([k, n]) => `${AD[k] ? AD[k].name.replace(/^(Kevlar|Motocykl) – /, '') : k}${n > 1 ? ` ×${n}` : ''}`).join(', ');
function titleSponsor(c, S = sportSeason()) { return activeSponsors(c, S).find(s => s.assets && s.assets.name); }
function refreshClubName(c, announce = true) {
  if (!c.fin) return;
  const t = titleSponsor(c);
  const nm = t ? `${t.brand || t.name} ${c.fin.baseName}` : c.fin.baseName;
  if (nm === c.name) return;
  const old = c.name;
  c.name = nm;
  if (announce && G.date) addMsg({ category: c.id === G.clubId ? 'finanse' : 'liga', from: c.id === G.clubId ? 'Dział marketingu' : 'Serwis żużlowy', title: `Zmiana nazwy: ${nm}`,
    body: `<p>Drużyna <b>${esc(old)}</b> ${t ? `ma nowego sponsora tytularnego (<b>${esc(t.name)}</b>) i` : 'straciła sponsora tytularnego –'} od teraz występuje jako <b>${esc(nm)}</b>.</p>`, link: c.id === G.clubId ? '#/finanse/sponsorzy' : `#/zespol/${c.id}` });
}
// Premie za wynik i klauzule
const SP_BONUS = {
  title: ['Mistrzostwo ligi', c => posChance(c, 1)],
  medal: ['Medal (miejsca 1–3)', c => posChance(c, 3)],
  top4: ['Miejsca 1–4', c => posChance(c, 4)],
  top6: ['Miejsca 1–6', c => posChance(c, 6)],
  promo: ['Awans do wyższej ligi', (c, S) => { const o = leagueOdds(c, S + 1), i = LEAGUE_ORDER.indexOf(c.league); return i > 0 ? o[LEAGUE_ORDER[i - 1]] || 0 : 0; }],
  stay: ['Utrzymanie w lidze', (c, S) => { const o = leagueOdds(c, S + 1), i = LEAGUE_ORDER.indexOf(c.league); return i < LEAGUE_ORDER.length - 1 ? 1 - (o[LEAGUE_ORDER[i + 1]] || 0) : 0.98; }],
  crowd: ['Średnia frekwencja ≥ próg', (c, S, b) => clamp(logistic(((c.stadium.attendance || 0) - (b.n || 0)) / Math.max(200, (b.n || 1) * 0.08)), 0.02, 0.98)],
};
const bonusText = b => `${SP_BONUS[b.t] ? SP_BONUS[b.t][0].replace('próg', fmtNum(b.n || 0)) : b.t}${b.S ? ` (${b.S})` : ''}: ${fmtMoney(b.amt, true)}`;
function bonusChance(c, b, S) { const d = SP_BONUS[b.t]; return d ? d[1](c, S, b) : 0; }
const DOWN_OPTS = [[0, 'bez zmian'], [0.2, 'obniżka 20%'], [0.3, 'obniżka 30%'], [0.5, 'obniżka 50%'], [1, 'rozwiązanie umowy']];
const UP_OPTS = [[0, 'bez zmian'], [0.15, '+15%'], [0.3, '+30%'], [0.5, '+50%'], [1, 'podwojenie']];
function clausesText(cl) {
  if (!cl) return '';
  const a = [];
  if (cl.up) a.push(`awans: ${(UP_OPTS.find(o => o[0] === cl.up) || [0, `+${Math.round(cl.up * 100)}%`])[1]}`);
  if (cl.down) a.push(`spadek: ${cl.down >= 1 ? 'rozwiązanie' : `−${Math.round(cl.down * 100)}%`}`);
  if (cl.excl) a.push('wyłączność branżowa');
  return a.join(' · ');
}

// ---------- Baza firm ----------
const firmKey = n => normName(n).replace(/[^a-z0-9]+/g, '-');
let FIRMS = null;
function firms() {
  if (FIRMS) return FIRMS;
  FIRMS = {};
  for (const [name, industry, scale, budget, clubs, title, status, note] of COMPANY_DB) FIRMS[firmKey(name)] = { key: firmKey(name), name, industry, scale, budget, clubs, title: !!title, status, note };
  // sponsorzy z list klubów, których nie ma w bazie: lokalne firmy związane z jednym klubem
  for (const [id, cf] of Object.entries(CLUB_FIN)) cf.sp.forEach((list, tier) => list.split('|').filter(Boolean).forEach(raw => {
    const name = raw.replace('*', ''), k = firmKey(name);
    if (!FIRMS[k]) FIRMS[k] = { key: k, name, industry: 'lokalny biznes', scale: 'l', budget: [[150, 600], [40, 200], [10, 60]][tier], clubs: [Number(id)], title: tier === 0, status: 'aktualny', note: 'partner klubu (oficjalna strona)' };
    else if (!FIRMS[k].clubs.includes(Number(id))) FIRMS[k].clubs.push(Number(id));
  }));
  return FIRMS;
}
// Fikcyjne lokalne firmy z szablonów (miasto klubu)
function localFirms(c) {
  const city = (c.city || '').replace(/ Wlkp\.$/, '');
  return LOCAL_FIRM_TEMPLATES.map(([t, industry]) => { const name = t.replace('{c}', city); return { key: firmKey(name), name, industry, scale: 'l', budget: [15, 120], clubs: [c.id], title: false, status: 'fikcyjna', note: 'lokalna firma (fikcyjna)' }; });
}
function firmByKey(k, c) { return firms()[k] || (c && localFirms(c).find(f => f.key === k)) || null; }
const firmHash = (f, c, salt) => (hashStr(`${G.seed}|${f.key}|${c.id}|${salt}`) % 1000) / 1000;
// Ostrożność firmy (0 – lubi płacić za wynik, 1 – woli stałe kwoty): wpływa na wycenę premii i klauzul
const firmCaution = f => (hashStr(`${G.seed}|risk|${f.key}`) % 1000) / 1000;
// Ile firma może przeznaczyć na ten klub w sezonie S (ukryte; skala, związek z miastem, oczekiwana liga, wartość marketingowa)
function firmMax(f, c, S = sportSeason()) {
  const [lo, hi] = f.budget.map(x => x * 1000);
  const h = firmHash(f, c, S);
  const aff = f.clubs.includes(c.id) ? 1.15 : f.scale === 'k' || f.scale === 'm' ? 0.9 : 0.55;
  const lgF = oddsMult(c, S, lg => LG_BUDGET_F[lg]);
  const exposure = f.scale === 'k' || f.scale === 'm' ? lgF : 0.55 + 0.45 * lgF;
  return round1k((lo + (hi - lo) * h) * aff * exposure * marketIndex(c).v);
}
// Grupy miejsc, na których firmie zależy
function firmWants(f, c) {
  const max = firmMax(f, c);
  return f.title && max > adPrice(c, 'chest') * 0.8 ? ['druzyna', 'kevlar'] : /moto|opon|olej|części|paliw|quady|kevlar/.test(f.industry) ? ['motocykl', 'kevlar'] : f.scale === 'l' ? ['stadion', 'media'] : ['kevlar', 'stadion'];
}
// Wartość pakietu dla firmy w sezonie S: cena rynkowa × dopasowanie do jej celów × gust firmy, najwyżej jej budżet
function firmWorth(f, c, assets, S, wants = firmWants(f, c)) {
  const taste = 0.88 + 0.3 * firmHash(f, c, 'taste');
  const v = sum(Object.entries(assets).map(([k, n]) => adPrice(c, k, S) * n * (wants.includes(AD[k].group) ? 1.1 : 0.9))) * taste;
  // sponsor tytularny bez klatki piersiowej kevlaru: nazwa drużyny warta jest dla niego nieco mniej (logo nie jest na pierwszym planie)
  return Math.min(v * (assets.name && !assets.chest ? 0.9 : 1), firmMax(f, c, S) * 1.05);
}
// Branże z wyłącznością u klubu w sezonie S
function exclusiveIndustries(c, S, skipId) {
  return new Set(activeSponsors(c, S).filter(s => s.id !== skipId && s.clauses && s.clauses.excl).map(s => (firmByKey(s.firm, c) || {}).industry).filter(Boolean));
}
// Firmy, z którymi klub może rozmawiać (bez obecnych sponsorów i trwających rozmów, bez firm związanych z innym klubem – js/board.js)
function firmPool(c, S = sportSeason()) {
  const busy = new Set(Object.values(G.sponsors).filter(s => s.clubId === c.id && s.until >= S).map(s => s.firm));
  for (const t of Object.values(G.spTalks || {})) if (t.clubId === c.id && TALK_OPEN.includes(t.stage)) busy.add(t.firm);
  const titled = new Set(Object.values(G.sponsors).filter(s => s.clubId !== c.id && s.assets && s.assets.name && s.until >= S).map(s => s.firm));
  const excl = exclusiveIndustries(c, S);
  const list = Object.values(firms()).filter(f => !busy.has(f.key) && !excl.has(f.industry) && !(typeof firmLockedFor === 'function' && firmLockedFor(f, c, S)) && (f.clubs.includes(c.id) || f.scale === 'k' || f.scale === 'm' || (f.scale === 'r' && f.status === 'potencjalny')));
  return list.concat(localFirms(c).filter(f => !busy.has(f.key))).map(f => ({ ...f, title: f.title && !titled.has(f.key) }));
}

// ---------- Tworzenie umów, płatności ----------
const SP_KINDS = ['tytularny', 'strategiczny', 'główny', 'partner', 'techniczny', 'medialny'];
function spKind(c, value, assets) { return assets && assets.name ? 'tytularny' : value >= c.budget * 0.03 ? 'strategiczny' : value >= c.budget * 0.008 ? 'główny' : 'partner'; }
// o: { firm, name, brand, kind, perYear | amounts {S: kwota}, assets, plan, since, until, bonuses, clauses, rofr, signedOn }
function addSponsor(c, o) {
  const id = `SP${G.seq.sp++}`;
  const f = firmByKey(o.firm, c);
  const amounts = {};
  for (let S = o.since; S <= o.until; S++) amounts[S] = round1k(o.amounts && o.amounts[S] != null ? o.amounts[S] : o.perYear);
  const perYear = round1k(sum(Object.values(amounts)) / Object.keys(amounts).length);
  G.sponsors[id] = { id, clubId: c.id, firm: o.firm, name: o.name || (f ? f.name : o.firm), brand: o.brand || null, kind: o.kind || spKind(c, perYear, o.assets), perYear, amounts,
    assets: o.assets || {}, plan: o.plan || 'once', since: o.since, until: o.until, signedOn: o.signedOn || null, bonuses: o.bonuses || (o.bonus ? [{ t: 'medal', amt: o.bonus }] : []),
    clauses: o.clauses || {}, rofr: o.rofr ?? (perYear >= c.budget * 0.008 || !!(o.assets || {}).name), paid: {} };
  return G.sponsors[id];
}
function sponsorTranches(s, S) {
  if (s.since > S || s.until < S) return [];
  const months = (PAY_PLANS[s.plan] || PAY_PLANS.once).months;
  const amt = spAmount(s, S);
  return months.map(m => {
    let date = fyDate(S, m);
    if (s.signedOn && date < s.signedOn) date = payDayFrom(addDays(s.signedOn, 1));
    return { date, amount: Math.round(amt / months.length) };
  });
}
// Stan sponsoringu klubu (cennik, cel zarządu, punkt odniesienia dla klubów AI)
function spInit(c) {
  const f = c.fin;
  f.prices = f.prices || {};
  if (f.spBase == null) {
    const S = sportSeason();
    f.spBase = sum(activeSponsors(c, S).map(s => spAmount(s, S))) || c.budget * 0.2;
    f.spBaseMi = marketIndex(c).v; f.spBaseLg = c.league;
  }
  f.spTarget = f.spTarget || {};
  return f;
}
// Poziom przychodów od sponsorów, do którego dąży klub AI (punkt startowy skorygowany o ligę i wartość marketingową)
function spNorm(c, S = sportSeason()) {
  const f = spInit(c);
  const lgR = oddsMult(c, S, lg => FIN_LEAGUE[lg].adMult) / FIN_LEAGUE[f.spBaseLg || c.league].adMult;
  return f.spBase * Math.pow(lgR, 0.75) * (marketIndex(c).v / (f.spBaseMi || 1));
}
// Portfel sponsorów na starcie gry: realne firmy z list klubów, kwoty wg szacowanych przychodów klubu od sponsorów (CLUB_FIN.spTotal)
function finSeedSponsors(c, src) {
  const f = finInit(c), cf = CLUB_FIN[c.id] || { sp: ['', '', ''] }, lg = FL(c);
  const S = START_SEASON + 1;
  const gate = typeof stadiumSeasonGate === 'function' ? stadiumSeasonGate(c) : c.stadium.attendance * (c.stadium.ticket + lg.gastro + lg.merch) * 7;
  const nonSp = lg.tv - lg.reserve + lg.title + f.city.base + gate + c.stadium.boxes * lg.boxPrice + lg.events;
  const T = cf.spTotal ? cf.spTotal * 1e6 : Math.max(c.budget * 0.15, c.budget * 0.85 - nonSp);
  const tiers = cf.sp.map(l => l.split('|').filter(Boolean));
  for (const t of tiers) for (const n of t.filter(x => x.endsWith('*'))) f.leadsHint.push(firmKey(n.slice(0, -1)));
  const names = tiers.map(t => t.filter(x => !x.endsWith('*')));
  const minCount = { PGE: 24, '2E': 15, KLZ: 9 }[c.league];
  const locals = localFirms(c).sort(by(x => hashStr(x.key + c.id)));
  while (sum(names.map(x => x.length)) < minCount && locals.length) names[2].push(locals.shift().name);
  const title = cf.brand ? 1 : 0;
  const w = { t: 0.22, s: 0.07, m: 0.025, p: 0.008 };
  const totalW = title * w.t + names[0].length * w.s + names[1].length * w.m + names[2].length * w.p;
  const unit = T / Math.max(0.3, totalW);
  const use = {};
  const take = (assets, ids) => { for (const k of ids) { if ((use[k] || 0) >= AD[k].cap) continue; use[k] = (use[k] || 0) + 1; assets[k] = (assets[k] || 0) + 1; return k; } return null; };
  const until = n => START_SEASON + rint(0, 2) + n;
  const since = () => START_SEASON - rint(0, 5);
  // umowy wieloletnie: kwota rośnie o kilka procent rocznie, premia za medal (PGE) lub awans (niższe ligi), obniżka po spadku
  const grow = (base, a, b, g) => { const o = {}; for (let s = a; s <= b; s++) o[s] = base * Math.pow(1 + g, Math.max(0, s - S)); return o; };
  const perf = (amt, big) => c.league === 'PGE' ? [{ t: 'medal', amt: round1k(amt * (big ? 0.12 : 0.08)) }] : [{ t: 'promo', amt: round1k(amt * (big ? 0.25 : 0.15)) }];
  if (title) {
    const a = {}; ['name', 'chest', 'bar1', 'startline'].forEach(k => take(a, [k])); take(a, ['banner']); take(a, ['banner']); take(a, ['vip']);
    const k = firmKey(cf.brand);
    const known = Object.values(firms()).find(x => x.key === k || normName(x.name) === normName(cf.brand) || (src && normName(String(src.titleSponsor || '')) === normName(x.name)));
    const amt = unit * w.t, sn = since(), un = Math.max(cf.titleUntil || START_SEASON, START_SEASON);
    addSponsor(c, { firm: known ? known.key : k, name: known ? known.name : cf.brand, brand: cf.brand, kind: 'tytularny', amounts: grow(amt, sn, un, 0.03), perYear: amt, assets: a, plan: 'four', since: sn, until: un,
      bonuses: perf(amt, true), clauses: { up: c.league === 'PGE' ? 0 : 0.3, down: 0.3 }, rofr: true });
  }
  const prime = ['back', 'shoulderR', 'silencer', 'bib', 'belly', 'thigh', 'startline', 'shoulderL', 'park'];
  const mid = ['shoulderL', 'shin', 'arm', 'bar2', 'seat', 'screen', 'park', 'knee', 'guard'];
  const low = ['banner', 'heat', 'media', 'vip'];
  names[0].forEach(n => { const a = {}; take(a, prime); take(a, ['banner']); take(a, ['vip']); const amt = unit * w.s, sn = since(), un = until(1);
    addSponsor(c, { firm: firmKey(n), kind: 'strategiczny', amounts: grow(amt, sn, un, 0.02), perYear: amt, assets: a, plan: 'two', since: sn, until: un, bonuses: chance(0.5) ? perf(amt, false) : [], clauses: { down: chance(0.6) ? 0.3 : 0 } }); });
  names[1].forEach(n => { const a = {}; take(a, mid) || take(a, low); take(a, ['banner']); addSponsor(c, { firm: firmKey(n), kind: 'główny', perYear: unit * w.m, assets: a, plan: 'once', since: since(), until: until(0), clauses: { down: chance(0.4) ? 0.2 : 0 } }); });
  names[2].forEach((n, i) => { const a = {}; take(a, [low[i % low.length], ...low]); addSponsor(c, { firm: firmKey(n), kind: 'partner', perYear: Math.max(8000, unit * w.p), assets: a, plan: 'once', since: since(), until: until(0) }); });
  // prawa do nazwy stadionu (CLUB_FIN.stadium, np. GBS – stadion w Gorzowie): miejsce „Nazwa stadionu” i kwota jak za sponsora strategicznego
  const stSp = cf.stadium && Object.values(G.sponsors).find(s => s.clubId === c.id && normName(s.name) === normName(cf.stadium));
  if (stSp && !stSp.assets.stadium) {
    stSp.assets.stadium = 1; stSp.kind = 'strategiczny';
    const add = round1k(adPrice(c, 'stadium', S) * 0.8);
    for (const k of Object.keys(stSp.amounts)) stSp.amounts[k] = round1k(stSp.amounts[k] + add);
    stSp.perYear = round1k(stSp.perYear + add);
  }
  if (title) refreshClubName(c, false);
  f.spBase = null; spInit(c);
  f.spBase = T; // norma klubu AI: szacowane realne przychody od sponsorów
}

// ---------- Ocena oferty przez firmę ----------
// o: { from, years, price, amounts: [kwota w 1., 2., 3. sezonie], assets, plan, bonuses: [{t, amt, S?, n?}], clauses: {up, down, excl} }
const offerAmounts = o => Array.from({ length: o.years }, (_, i) => round1k(o.amounts && o.amounts[i] != null ? o.amounts[i] : o.price));
// Koszt oferty dla firmy (oczekiwany: kwoty × klauzule + premie × szansa × ostrożność) i to, ile jest gotowa zapłacić (wartość pakietu)
function offerEval(f, c, o, wants) {
  const caution = firmCaution(f), am = offerAmounts(o), cl = o.clauses || {};
  let cost = 0, worth = 0, alive = 1;
  for (let i = 0; i < o.years; i++) {
    const S = o.from + i;
    const odds = leagueOdds(c, S), i0 = LEAGUE_ORDER.indexOf(c.league);
    const pUp = i > 0 && i0 > 0 ? odds[LEAGUE_ORDER[i0 - 1]] || 0 : 0, pDown = i > 0 && i0 < 2 ? odds[LEAGUE_ORDER[i0 + 1]] || 0 : 0;
    // klauzula spadkowa obniża oczekiwany koszt; rozwiązanie umowy kończy kolejne sezony
    const downF = cl.down >= 1 ? 0 : 1 - (cl.down || 0);
    cost += am[i] * alive * (1 + pUp * (cl.up || 0) - pDown * (1 - downF));
    if (cl.down >= 1) alive *= 1 - pDown;
    for (const b of (o.bonuses || []).filter(b => !b.S || b.S === S)) cost += b.amt * bonusChance(c, b, S) * (0.72 + 0.3 * caution) * alive;
    worth += firmWorth(f, c, o.assets, S, wants) * (cl.excl ? 1.12 : 1);
  }
  const plan = (PAY_PLANS[o.plan] || PAY_PLANS.once).fit;
  const yrs = [1, 1, 1.02, 1.01][o.years] || 1;
  // ostrożne firmy cenią klauzulę spadkową, odważne – premie za wynik
  // klub gracza: skuteczność osoby odpowiedzialnej za sponsorów (menedżer, prezes lub menedżer klubu – js/board.js)
  const skill = typeof dutyF === 'function' ? dutyF('sponsors', c.id) : 1;
  return { cost, worth: worth * plan * yrs * (cl.down ? 1 + 0.04 * caution : 1) * skill, am };
}
function validateOffer(c, o, renewalOf, firm) {
  if (!Object.keys(o.assets || {}).length) return 'Zaproponuj firmie przynajmniej jedno miejsce reklamowe.';
  const am = offerAmounts(o);
  if (!am.every(a => a > 0)) return 'Podaj kwotę na każdy sezon umowy.';
  for (let S = o.from; S < o.from + o.years; S++) {
    const use = slotUse(c, S, renewalOf);
    for (const [k, n] of Object.entries(o.assets)) if ((use[k] || 0) + n > AD[k].cap) return `Miejsce „${AD[k].name}” jest zajęte w sezonie ${S}.`;
    if (firm && exclusiveIndustries(c, S, renewalOf).has(firm.industry)) return `Sezon ${S}: inny sponsor ma wyłączność w branży „${firm.industry}”.`;
  }
  return null;
}

// ---------- Negocjacje ----------
// Etapy: lead (firma zainteresowana) → meeting → talk (znane oczekiwania) → pending (oferta u firmy) → counter (propozycja firmy) → signed / closed
const TALK_OPEN = ['search', 'lead', 'meeting', 'talk', 'pending', 'counter'];
function talkFirm(t) { const c = G.clubs[t.clubId]; return firmByKey(t.firm, c) || { key: t.firm, name: t.name, industry: t.industry || '', scale: t.scale || 'l', budget: t.budget || [10, 100], clubs: [c.id], title: false, status: 'aktualny' }; }
function sponsorSearch() {
  const c = myClub();
  G.spTalks = G.spTalks || {};
  if (Object.values(G.spTalks).some(t => t.clubId === c.id && t.stage === 'search')) return { ok: false, text: 'Dział marketingu już szuka partnerów.' };
  const id = `ST${G.seq.spt = (G.seq.spt || 0) + 1}`;
  G.spTalks[id] = { id, clubId: c.id, stage: 'search', due: addDays(G.date, rint(5, 10)), started: G.date };
  return { ok: true, text: `Dział marketingu rozsyła oferty sponsorskie. Pierwsze odpowiedzi do ${fmtDate(G.spTalks[id].due)}.` };
}
function newTalk(c, f, extra = {}) {
  G.spTalks = G.spTalks || {};
  const id = `ST${G.seq.spt = (G.seq.spt || 0) + 1}`;
  const max = firmMax(f, c);
  const t = G.spTalks[id] = { id, clubId: c.id, firm: f.key, name: f.name, industry: f.industry, scale: f.scale, status: f.status, budget: f.budget, max, wants: firmWants(f, c), patience: 3 + (f.clubs.includes(c.id) ? 1 : 0), stage: 'lead',
    interest: f.clubs.includes(c.id) ? 'wysokie' : max > c.budget * 0.02 ? 'średnie' : 'niskie', started: G.date, expires: addDays(G.date, 45), log: [], ...extra };
  return t;
}
// Zaproszenie konkretnej firmy z rynku (zakładka Rynek firm)
function inviteFirm(key) {
  const c = myClub(), f = firmPool(c).find(x => x.key === key);
  if (!f) return { ok: false, text: 'Z tą firmą nie można teraz rozmawiać.' };
  const S = fyOf(G.date);
  c.fin.invites = c.fin.invites || {};
  const k = G.date.slice(0, 7);
  if ((c.fin.invites[k] || 0) >= 4) return { ok: false, text: 'Dział marketingu ma w tym miesiącu pełny kalendarz spotkań (4 zaproszenia).' };
  c.fin.invites[k] = (c.fin.invites[k] || 0) + 1;
  const p = clamp((f.clubs.includes(c.id) ? 0.85 : 0.45) * (f.status === 'byly' ? 0.6 : 1) * (0.7 + marketIndex(c).v * 0.3) * (typeof dutyF === 'function' ? dutyF('sponsors', c.id) : 1), 0.1, 0.95);
  if (!chance(p)) return { ok: false, text: `${f.name} dziękuje za zaproszenie – w tym roku nie planuje sponsoringu sportu.` };
  const t = newTalk(c, f, { invited: true });
  t.log.push({ d: G.date, t: 'Firma przyjęła zaproszenie do rozmów.' });
  void S;
  return { ok: true, text: `${f.name} jest zainteresowana – umów spotkanie.` };
}
function openRenewalTalk(s) {
  const c = G.clubs[s.clubId], f = firmByKey(s.firm, c) || { key: s.firm, name: s.name, industry: '', scale: 'l', budget: [10, 100], clubs: [c.id], title: !!s.assets.name, status: 'aktualny' };
  const last = c.history[c.history.length - 1], pos = last ? last.pos : 5;
  const from = s.until + 1;
  const t = newTalk(c, f, { renewal: s.id, stage: 'talk', interest: 'wysokie', expires: s.until >= sportSeason() ? `${s.until}-10-31` : `${sportSeason()}-01-31` });
  const prev = spAmount(s, s.until);
  t.max = round1k(Math.max(t.max, prev * (1.1 - pos * 0.02) * (0.92 + rnd() * 0.16)));
  t.loyal = round1k(prev * (1.04 - pos * 0.01) * (0.95 + rnd() * 0.12)); // ile firma gotowa jest płacić za te same miejsca
  t.hint = [round1k(prev * 0.85), round1k(prev * 1.1)];
  t.wants = [...new Set(Object.keys(s.assets).map(k => AD[k].group))];
  t.offer = { assets: { ...s.assets }, years: 2, plan: s.plan, price: prev, amounts: [], bonuses: spBonuses(s).map(b => ({ ...b, S: null })), clauses: { ...(s.clauses || {}) }, from };
  t.log.push({ d: G.date, t: s.until >= sportSeason() ? `Umowa wygasa po sezonie ${s.until} – firma chce rozmawiać o przedłużeniu.` : 'Umowa wygasła – firma chce rozmawiać o przedłużeniu na podobnych warunkach.' });
  return t;
}
function talkMeeting(id) {
  const t = G.spTalks[id];
  if (!t || t.stage !== 'lead') return { ok: false, text: 'Spotkanie już się odbyło.' };
  t.stage = 'meeting'; t.due = addDays(G.date, rint(3, 7));
  t.log.push({ d: G.date, t: `Umówiono spotkanie (${fmtDate(t.due)}).` });
  return { ok: true, text: `Spotkanie z ${t.name}: ${fmtDate(t.due)}.` };
}
// Ocena oferty: wartość pakietu dla firmy, jej budżet, przywiązanie (przedłużenia) i cierpliwość
function talkJudge(t, o) {
  const c = G.clubs[t.clubId], f = talkFirm(t);
  const e = offerEval(f, c, o, t.wants);
  let worth = e.worth;
  if (t.renewal && t.loyal) worth = Math.max(worth, t.loyal * o.years * (PAY_PLANS[o.plan] || PAY_PLANS.once).fit);
  // budżet firmy na sezon (z zapasem na premie)
  const capOk = e.am.every((a, i) => a <= Math.max(firmMax(f, c, o.from + i), t.max || 0) * 1.15);
  return { ok: capOk && e.cost <= worth, ratio: worth / Math.max(1, e.cost), e };
}
function talkOffer(id, o) {
  const t = G.spTalks[id], c = G.clubs[t.clubId];
  if (!['talk', 'counter'].includes(t.stage)) return { ok: false, text: 'Teraz nie można złożyć oferty.' };
  const err = validateOffer(c, o, t.renewal, talkFirm(t));
  if (err) return { ok: false, text: err };
  t.offer = { ...o, assets: { ...o.assets }, amounts: offerAmounts(o), bonuses: (o.bonuses || []).map(b => ({ ...b })), clauses: { ...(o.clauses || {}) } };
  t.stage = 'pending'; t.due = addDays(G.date, rint(2, 5));
  t.log.push({ d: G.date, t: `Oferta: ${offerText(t.offer)}.` });
  return { ok: true, text: `Oferta wysłana do ${t.name}. Odpowiedź do ${fmtDate(t.due)}.` };
}
function offerText(o) {
  const am = offerAmounts(o), same = am.every(a => a === am[0]);
  return `${same ? `${fmtMoney(am[0])} / sezon × ${o.years}` : am.map((a, i) => `${o.from + i}: ${fmtMoney(a, true)}`).join(', ')} (${o.from}–${o.from + o.years - 1}; ${assetsText(o.assets)}; ${(PAY_PLANS[o.plan] || {}).name || ''}`
    + `${(o.bonuses || []).length ? `; premie: ${o.bonuses.map(bonusText).join(', ')}` : ''}${clausesText(o.clauses) ? `; ${clausesText(o.clauses)}` : ''})`;
}
function talkSign(t, o) {
  const c = G.clubs[t.clubId];
  const err = validateOffer(c, o, t.renewal, talkFirm(t));
  if (err) return { ok: false, text: err };
  const old = t.renewal && G.sponsors[t.renewal];
  if (old) old.renewed = true;
  const am = offerAmounts(o), amounts = {};
  am.forEach((a, i) => { amounts[o.from + i] = a; });
  const s = addSponsor(c, { firm: t.firm, name: t.name, brand: o.assets.name ? t.name : null, amounts, perYear: am[0], assets: o.assets, plan: o.plan, since: o.from, until: o.from + o.years - 1,
    bonuses: (o.bonuses || []).map(b => ({ ...b })), clauses: { ...(o.clauses || {}) }, signedOn: G.date });
  t.stage = 'signed'; t.signed = s.id;
  t.log.push({ d: G.date, t: `Umowa podpisana: ${offerText(o)}.` });
  c.fin.leadsHint = c.fin.leadsHint.filter(k => k !== t.firm);
  refreshClubName(c);
  return { ok: true, text: `Umowa z ${t.name} podpisana: ${fmtMoney(sum(am), true)} gwarantowane za ${o.years} ${plural(o.years, 'sezon', 'sezony', 'sezonów')}.` };
}
function talkAcceptCounter(id) {
  const t = G.spTalks[id];
  if (!t || t.stage !== 'counter') return { ok: false, text: 'Brak propozycji firmy.' };
  return talkSign(t, t.counter);
}
function talkClose(id, why) {
  const t = G.spTalks[id];
  if (!t) return;
  t.stage = 'closed'; t.log.push({ d: G.date, t: why || 'Rozmowy zakończone.' });
}
// Rezygnacja z przedłużenia: zwalnia miejsca obecnego sponsora na kolejny sezon
function spRelease(spId) {
  const s = G.sponsors[spId];
  if (!s || s.clubId !== G.clubId) return { ok: false, text: 'Brak umowy.' };
  s.released = true;
  for (const t of Object.values(G.spTalks || {})) if (t.renewal === spId && TALK_OPEN.includes(t.stage)) talkClose(t.id, 'Klub nie przedłuża umowy.');
  return { ok: true, text: `Nie przedłużamy umowy z ${s.name} – miejsca na sezon ${s.until + 1} są wolne do sprzedaży.` };
}
function sponsorTalksDay() {
  for (const t of Object.values(G.spTalks || {})) {
    if (!TALK_OPEN.includes(t.stage)) continue;
    const c = G.clubs[t.clubId];
    if (t.stage === 'search' && G.date >= t.due) {
      const pool = firmPool(c).filter(f => f.status !== 'byly' || chance(0.3));
      const hinted = pool.filter(f => c.fin.leadsHint.includes(f.key));
      const rest = shuffle(pool.filter(f => !hinted.includes(f)).map(f => ({ f, w: firmMax(f, c) * (f.clubs.includes(c.id) ? 2 : 1) * rnd() }))).sort(by(x => x.w, -1)).map(x => x.f);
      const n = rint(2, 4) + (c.rep > 70 ? 1 : 0);
      const picked = [...hinted.slice(0, 2), ...rest].slice(0, n).filter(f => chance(f.clubs.includes(c.id) ? 0.9 : 0.55));
      const leads = picked.map(f => newTalk(c, f));
      t.stage = 'closed';
      addMsg({ category: 'finanse', from: 'Dział marketingu', stop: true, title: leads.length ? `Zainteresowani sponsorzy: ${leads.length}` : 'Brak zainteresowanych sponsorów',
        body: leads.length ? `<p>Na nasze zaproszenie odpowiedzieli:</p><ul>${leads.map(l => `<li><b>${esc(l.name)}</b> (${esc(l.industry)}) – zainteresowanie: ${l.interest}</li>`).join('')}</ul><p>Umów spotkanie, żeby poznać oczekiwania i budżet firmy.</p>`
          : '<p>Tym razem nikt nie odpowiedział. Spróbuj ponownie za kilka tygodni – lepsze wyniki i frekwencja zwiększają zainteresowanie.</p>', link: '#/finanse/sponsorzy/negocjacje' });
      continue;
    }
    if (t.expires && G.date > t.expires && ['lead', 'talk', 'counter'].includes(t.stage)) {
      talkClose(t.id, t.inbound ? 'Firma nie doczekała się odpowiedzi i wycofała propozycję.' : 'Firma straciła zainteresowanie (brak odpowiedzi klubu).');
      if (t.renewal && c.id === G.clubId) addMsg({ category: 'finanse', from: 'Dział marketingu', title: `${t.name} odchodzi`, body: `<p>Nie przedłużyliśmy umowy z <b>${esc(t.name)}</b> – firma kończy współpracę.</p>`, link: '#/finanse/sponsorzy/partnerzy' });
      if (t.renewal) { const s = G.sponsors[t.renewal]; if (s) s.released = true; refreshClubName(c); }
      continue;
    }
    if (t.stage === 'meeting' && G.date >= t.due) {
      if (t.interest === 'niskie' && chance(0.35)) { talkClose(t.id, 'Po spotkaniu firma odmówiła – nie ma budżetu na sport w tym roku.'); notifyTalk(t, 'odmawia po spotkaniu'); continue; }
      t.stage = 'talk';
      const lo = round1k(t.max * (0.65 + rnd() * 0.15)), hi = round1k(t.max * (1.05 + rnd() * 0.15));
      t.hint = [lo, hi];
      t.expires = addDays(G.date, 30);
      const caut = firmCaution(talkFirm(t));
      t.log.push({ d: G.date, t: `Spotkanie: firma mówi o budżecie ${fmtMoney(lo, true)}–${fmtMoney(hi, true)} na sezon; interesuje ją: ${t.wants.map(g => AD_GROUPS[g]).join(', ')}. ${caut > 0.6 ? 'Woli stałe kwoty i zabezpieczenie na wypadek spadku.' : caut < 0.35 ? 'Chętnie płaci premie za wynik.' : ''}` });
      notifyTalk(t, `po spotkaniu: budżet ${fmtMoney(lo, true)}–${fmtMoney(hi, true)}`);
      continue;
    }
    if (t.stage === 'pending' && G.date >= t.due) {
      const o = t.offer, j = talkJudge(t, o);
      if (j.ok) { const r = talkSign(t, o); notifyTalk(t, r.ok ? 'akceptuje ofertę – umowa podpisana' : r.text, true); continue; }
      t.patience -= j.ratio < 0.74 ? 2 : 1;
      if (t.patience <= 0) { talkClose(t.id, 'Firma zerwała rozmowy – oczekiwania klubu są za wysokie.'); notifyTalk(t, 'zrywa rozmowy'); continue; }
      // kontroferta: te same miejsca i klauzule, kwoty obniżone do poziomu akceptowalnego dla firmy
      const k = clamp(j.ratio * (0.92 + rnd() * 0.06), 0.3, 1);
      const counter = { ...o, assets: { ...o.assets }, amounts: j.e.am.map(a => round1k(a * k)), bonuses: (o.bonuses || []).map(b => ({ ...b })), clauses: { ...(o.clauses || {}) } };
      counter.price = counter.amounts[0];
      t.counter = counter;
      t.stage = 'counter'; t.expires = addDays(G.date, 21);
      t.log.push({ d: G.date, t: `Kontroferta: ${offerText(counter)}.` });
      notifyTalk(t, `kontroferta ${fmtMoney(counter.amounts[0], true)} / sezon`);
    }
  }
}
function notifyTalk(t, what, good) {
  if (t.clubId !== G.clubId) return;
  addMsg({ category: 'finanse', from: 'Dział marketingu', stop: true, title: `${t.name}: ${what}`, body: `<p>${t.log.slice(-1).map(l => esc(l.t)).join('')}</p>`, link: '#/finanse/sponsorzy/negocjacje' });
  void good;
}
// Przedpłata transzy przez sponsora (pomoc w płynności): następna transza teraz, z rabatem 4%
function sponsorAdvance(spId) {
  const s = G.sponsors[spId], c = myClub(), S = fyOf(G.date);
  if (!s || s.clubId !== c.id) return { ok: false, text: 'Brak umowy.' };
  if (s.advanced === S) return { ok: false, text: `${s.name} już raz w tym sezonie zapłacił z góry.` };
  const next = sponsorTranches(s, S).find(x => x.date > G.date);
  if (!next) return { ok: false, text: 'W tym sezonie nie ma już transz do przyspieszenia.' };
  s.advanced = S;
  if (!chance(0.65)) return { ok: false, text: `${s.name} odmawia wcześniejszej płatności.` };
  const amt = Math.round(next.amount * 0.96);
  addTx(c.id, 'sponsor', amt, `Przedpłata transzy: ${s.name} (rabat 4%)`);
  s.paid[S] = (s.paid[S] || 0) + next.amount;
  s.skip = s.skip || {}; s.skip[next.date] = true;
  return { ok: true, text: `${s.name} wpłaci transzę z góry: ${fmtMoney(amt)}.` };
}

// ---------- Zapytania przychodzące (firmy same zgłaszają się do klubu) ----------
// Sezon, na który firmy kupują miejsca: bieżący do końca maja, od czerwca – następny
const salesSeason = () => { const S = sportSeason(); return G.seasonClosed !== G.season && G.date >= `${S}-06-01` ? S + 1 : S; };
// Wolne miejsca w sezonie S z relacją ceny klubu do wyceny rynkowej (tańsze od rynku sprzedają się szybciej)
function freeSlots(c, S) {
  const use = slotUse(c, S);
  return AD_SLOTS.filter(a => a.cap - (use[a.id] || 0) > 0).map(a => ({ a, free: a.cap - (use[a.id] || 0), list: listPrice(c, a.id, S), market: adPrice(c, a.id, S) }));
}
// Propozycja firmy: 1–3 wolne miejsca najkorzystniejsze dla niej, kwota = cena z cennika (nie więcej niż wartość pakietu dla firmy)
function firmProposal(c, f, S) {
  const wants = firmWants(f, c), max = firmMax(f, c, S);
  const free = freeSlots(c, S).filter(x => (x.a.id !== 'name' || f.title) && (x.a.id !== 'stadium' || f.scale !== 'l'))
    .map(x => ({ ...x, score: (wants.includes(x.a.group) ? 1.25 : 0.85) * x.market / Math.max(1, x.list) * (0.85 + rnd() * 0.3) }))
    .filter(x => x.list <= max && x.list <= x.market * 1.5).sort(by(x => x.score, -1));
  if (!free.length) return null;
  const assets = {};
  let total = 0;
  for (const x of free) {
    if (Object.keys(assets).length >= (f.scale === 'l' ? 2 : 3)) break;
    if (total + x.list > max) continue;
    assets[x.a.id] = 1; total += x.list;
    if (x.a.id === 'name' && !assets.chest && slotFree(c, S, 'chest') > 0 && total + listPrice(c, 'chest', S) <= max) { assets.chest = 1; total += listPrice(c, 'chest', S); } // tytularny chętnie bierze też klatkę, jeśli wolna
  }
  if (!Object.keys(assets).length) return null;
  const years = 1 + (firmCaution(f) < 0.5 ? rint(0, 2) : rint(0, 1));
  const o = { from: S, years, assets, plan: f.scale === 'l' ? 'once' : 'two', bonuses: [], clauses: {} };
  const worth = firmWorth(f, c, assets, S, wants);
  const price = round1k(Math.min(packageValue(c, assets, S), worth));
  // cennik powyżej wartości: firma zaproponuje mniej i kawałek w premii za wynik
  o.price = price; o.amounts = [];
  if (price < packageValue(c, assets, S) * 0.97 && firmCaution(f) < 0.6) o.bonuses.push({ t: c.league === 'PGE' ? 'medal' : 'promo', amt: round1k((packageValue(c, assets, S) - price) * 1.5) });
  if (years > 1 && c.league !== 'KLZ') o.clauses.down = firmCaution(f) > 0.5 ? 0.3 : 0.2;
  return price >= 5000 ? o : null;
}
// Raz w tygodniu: kluby dostają zapytania firm. Gracz – jako propozycje do akceptacji, kluby AI podpisują od razu (do poziomu swojej normy).
function sponsorInboundWeek() {
  const S0 = salesSeason(), cur = sportSeason();
  for (const c of Object.values(G.clubs)) {
    const mine = c.id === G.clubId;
    // kluby AI uzupełniają tylko bieżący sezon (listopad–lipiec); miejsca na kolejny sezon odnawiają po sezonie
    const S = mine ? S0 : cur;
    if (!mine && G.date > `${cur}-07-31`) continue;
    if (c.dormant || !clubActive(c, S) || !c.fin) continue;
    spInit(c);
    const free = freeSlots(c, S).filter(x => x.a.id !== 'vip' && x.a.id !== 'media');
    if (!free.length) continue;
    const attract = clamp(sum(free.map(x => x.market * x.free)) / Math.max(1, sum(free.map(x => x.list * x.free))), 0.3, 1.8);
    const lgF = { PGE: 1.25, '2E': 1, KLZ: 0.75 }[c.league] || 0.75;
    if (!mine) {
      const have = sum(activeSponsors(c, S).map(s => spAmount(s, S)));
      if (have >= spNorm(c, S) * 0.97) continue;
    }
    if (!chance(clamp(0.16 * lgF * Math.pow(attract, 1.6) * (0.7 + marketIndex(c).v * 0.3), 0.02, 0.6))) continue;
    const cool = c.fin.spCool = c.fin.spCool || {};
    const pool = firmPool(c, S).filter(f => (f.status !== 'byly' || chance(0.25)) && !(cool[f.key] && G.date < cool[f.key]));
    if (!pool.length) continue;
    const f = pool.map(x => ({ x, w: firmMax(x, c, S) * (x.clubs.includes(c.id) ? 2 : 1) * rnd() })).sort(by(z => z.w, -1))[0].x;
    const o = firmProposal(c, f, S);
    if (!o) continue;
    cool[f.key] = addDays(G.date, 150); // firma wraca z propozycją najwcześniej za kilka miesięcy
    if (mine) {
      const t = newTalk(c, f, { stage: 'counter', inbound: true, interest: 'wysokie', expires: addDays(G.date, 14) });
      t.offer = { ...o }; t.counter = o; t.hint = [round1k(o.price * 0.9), round1k(firmMax(f, c, S))];
      t.log.push({ d: G.date, t: `Firma sama zgłosiła się do klubu: ${offerText(o)}.` });
      addMsg({ category: 'finanse', from: 'Dział marketingu', title: `${f.name} chce zostać sponsorem`, body: `<p><b>${esc(f.name)}</b> (${esc(f.industry)}) proponuje: ${esc(offerText(o))}.</p><p>Możesz przyjąć propozycję, złożyć własną ofertę albo ją zignorować (wygaśnie za 2 tygodnie).</p>`, link: '#/finanse/sponsorzy/negocjacje' });
    } else {
      addSponsor(c, { firm: f.key, name: f.name, amounts: Object.fromEntries(offerAmounts(o).map((a, i) => [S + i, a])), perYear: o.price, assets: o.assets, plan: o.plan, since: S, until: S + o.years - 1, bonuses: o.bonuses, clauses: o.clauses, signedOn: G.date });
      if (o.assets.name) refreshClubName(c);
    }
  }
}

// ---------- Kluby AI: odnowienia i zastępstwa ----------
function renewSponsor(s, perYear, years) {
  const c = G.clubs[s.clubId];
  s.renewed = true;
  const from = Math.max(s.until + 1, sportSeason());
  return addSponsor(c, { firm: s.firm, name: s.name, brand: s.brand, kind: s.kind, perYear, assets: s.assets, plan: s.plan, since: from, until: from + years - 1, bonuses: spBonuses(s).map(b => ({ ...b, S: null })), clauses: { ...(s.clauses || {}) }, signedOn: G.date });
}
function aiReplaceSponsor(c, old) {
  const S = sportSeason();
  const title = !old || (old.assets && old.assets.name);
  const pool = firmPool(c).filter(f => !title || f.title);
  if (!pool.length) return;
  const hint = pool.find(f => c.fin.leadsHint.includes(f.key));
  const scored = pool.map(f => ({ f, v: firmMax(f, c, S) * (f.clubs.includes(c.id) ? 1.4 : 1) * (0.7 + rnd() * 0.6) })).sort(by(x => x.v, -1));
  const f = hint || scored[0].f;
  const prev = old ? spAmount(old, Math.min(old.until || S, S)) || old.perYear : 0;
  const value = title ? Math.max(firmMax(f, c, S), prev ? prev * 0.75 : c.budget * 0.08) : Math.min(firmMax(f, c, S), (prev || c.budget * 0.02) * (0.7 + rnd() * 0.5));
  if (old && old.id) old.renewed = true;
  c.fin.leadsHint = c.fin.leadsHint.filter(k => k !== f.key);
  addSponsor(c, { firm: f.key, name: f.name, brand: title ? f.name : null, perYear: value, assets: old ? old.assets : { name: 1, ...(slotFree(c, S, 'chest') > 0 ? { chest: 1 } : {}), ...(slotFree(c, S, 'bar1') > 0 ? { bar1: 1 } : {}) }, plan: title ? 'four' : 'once', since: S, until: S + rint(0, 2), signedOn: G.date,
    bonuses: title ? [{ t: c.league === 'PGE' ? 'medal' : 'promo', amt: round1k(value * 0.15) }] : [], clauses: { down: 0.3 } });
}
// Sponsorzy na nowy sezon (wywoływane z finNewSeason dla każdego klubu)
function sponsorsNewSeason(c, S) {
  spInit(c);
  const expired = Object.values(G.sponsors).filter(s => s.clubId === c.id && s.until === S - 1 && !s.renewed);
  const last = c.history[c.history.length - 1];
  const pos = last ? last.pos : 5;
  if (c.id === G.clubId) {
    const auto = [], talks = [];
    for (const s of expired) {
      if (s.released) continue;
      const open = Object.values(G.spTalks || {}).find(t => t.renewal === s.id && TALK_OPEN.includes(t.stage));
      if (open) { open.expires = `${S}-01-31`; talks.push(open); continue; }
      if (spAmount(s, s.until) < c.budget * 0.01 && s.kind !== 'tytularny') {
        if (chance(0.72 - pos * 0.01)) { renewSponsor(s, spAmount(s, s.until) * (1.06 - pos * 0.012), rint(1, 2)); auto.push(s.name); }
      } else talks.push(openRenewalTalk(s));
    }
    if (expired.length) addMsg({ category: 'finanse', from: 'Dział marketingu', stop: talks.length > 0, title: `Umowy sponsorskie po sezonie ${S - 1}`,
      body: `<p>Wygasło ${expired.length} ${plural(expired.length, 'umowa', 'umowy', 'umów')}.${auto.length ? ` Dział marketingu przedłużył umowy z mniejszymi partnerami: ${auto.map(esc).join(', ')}.` : ''}</p>
        ${talks.length ? `<p>Rozmowy o przedłużeniu czekają na Ciebie (${talks.map(t => esc(t.name)).join(', ')}). Firmy wstrzymują płatności do podpisania nowych umów – bez porozumienia do końca stycznia odejdą.</p>` : ''}`, link: '#/finanse/sponsorzy/partnerzy' });
    c.fin.spTarget[S] = round1k(Math.max(sum(activeSponsors(c, S).map(s => spAmount(s, S))), spNorm(c, S)) * 1.03);
  } else if (!c.dormant) { // klub uśpiony nie podpisuje umów sponsorskich
    for (const s of expired) {
      const prev = spAmount(s, s.until);
      if (chance(0.74 - (pos - 4) * 0.02)) renewSponsor(s, prev * (1.07 - pos * 0.013) * (0.95 + rnd() * 0.1) * oddsMult(c, S, lg => FIN_LEAGUE[lg].adMult) / FIN_LEAGUE[c.league].adMult, rint(1, 3));
      else aiReplaceSponsor(c, s);
    }
    // klub AI nie trzyma pustych miejsc tytularnych – szuka sponsora
    if (!titleSponsor(c, S) && chance(0.6)) aiReplaceSponsor(c, null);
  }
  refreshClubName(c);
}
// Od lipca ostatniego sezonu umowy: obecni sponsorzy klubu gracza zgłaszają się w sprawie przedłużenia (prawo pierwszeństwa do 31 sierpnia)
function sponsorRenewalsDay() {
  const c = myClub(), S = sportSeason();
  if (!c || !c.fin || G.date !== `${S}-07-01` || G.seasonClosed === G.season) return;
  const due = activeSponsors(c, S).filter(s => s.until === S && !s.renewed && !s.released && spAmount(s, S) >= c.budget * 0.01);
  const talks = due.filter(s => !Object.values(G.spTalks || {}).some(t => t.renewal === s.id && TALK_OPEN.includes(t.stage))).map(openRenewalTalk);
  if (talks.length) addMsg({ category: 'finanse', from: 'Dział marketingu', stop: true, title: `Przedłużenia umów sponsorskich na sezon ${S + 1}`,
    body: `<p>Po sezonie wygasają umowy z: ${talks.map(t => `<b>${esc(t.name)}</b>`).join(', ')}. Firmy chcą rozmawiać o przedłużeniu – do 31 sierpnia mają pierwszeństwo do swoich miejsc reklamowych.</p><p>Jeśli nie chcesz przedłużać, zrezygnuj w zakładce Partnerzy – miejsca od razu trafią do sprzedaży na sezon ${S + 1}.</p>`, link: '#/finanse/sponsorzy/partnerzy' });
}

// ---------- Koniec sezonu: premie za wynik i klauzule awans / spadek ----------
function sponsorsSeasonEnd(results) {
  const S = G.season;
  const lgOf = id => Object.keys(results).find(l => results[l].includes(id));
  const msgs = [];
  for (const s of Object.values(G.sponsors)) {
    if (s.since > S || s.until < S) continue;
    const c = G.clubs[s.clubId], lg = lgOf(s.clubId);
    if (!c || !lg) continue;
    const pos = results[lg].indexOf(s.clubId) + 1;
    const up = LEAGUE_ORDER.indexOf(c.league) < LEAGUE_ORDER.indexOf(lg), down = LEAGUE_ORDER.indexOf(c.league) > LEAGUE_ORDER.indexOf(lg);
    for (const b of spBonuses(s)) {
      if (b.S && b.S !== S) continue;
      const ok = { title: pos === 1, medal: pos <= 3, top4: pos <= 4, top6: pos <= 6, promo: up, stay: !down, crowd: (c.stadium.attendance || 0) >= (b.n || 0) }[b.t];
      if (ok) { addTx(c.id, 'sponsor', b.amt, `Premia od sponsora ${s.name}: ${SP_BONUS[b.t] ? SP_BONUS[b.t][0].toLowerCase() : b.t}`); if (c.id === G.clubId) msgs.push(`${esc(s.name)}: premia ${fmtMoney(b.amt)} (${SP_BONUS[b.t][0].toLowerCase()})`); }
    }
    const cl = s.clauses || {};
    if (s.until > S && (up && cl.up || down && cl.down)) {
      if (down && cl.down >= 1) { s.until = S; s.terminated = S; if (c.id === G.clubId) msgs.push(`${esc(s.name)}: umowa rozwiązana po spadku (klauzula)`); continue; }
      const k = up ? 1 + cl.up : 1 - cl.down;
      s.amounts = s.amounts || {};
      for (let x = S + 1; x <= s.until; x++) s.amounts[x] = round1k(spAmount(s, x) * k);
      s.perYear = round1k(sum(Object.values(s.amounts)) / Object.keys(s.amounts).length);
      if (c.id === G.clubId) msgs.push(`${esc(s.name)}: kwota od sezonu ${S + 1} ${up ? `+${Math.round(cl.up * 100)}% (awans)` : `−${Math.round(cl.down * 100)}% (spadek)`}`);
    }
  }
  // cel zarządu: przychody od sponsorów
  const me = myClub();
  if (me && me.fin && me.fin.spTarget && me.fin.spTarget[S]) {
    const got = sum(activeSponsors(me, S).map(s => spAmount(s, S))), tgt = me.fin.spTarget[S];
    const d = got >= tgt * 1.05 ? 3 : got < tgt * 0.9 ? -4 : 0;
    if (d) G.board.confidence = clamp(G.board.confidence + d, 0, 100);
    msgs.push(`Cel zarządu – sponsorzy ${S}: ${fmtMoney(got, true)} z ${fmtMoney(tgt, true)}${d > 0 ? ' (zarząd zadowolony)' : d < 0 ? ' (zarząd rozczarowany)' : ''}`);
  }
  if (msgs.length) addMsg({ category: 'finanse', from: 'Dział marketingu', title: `Sponsorzy po sezonie ${S}`, body: `<ul>${msgs.map(m => `<li>${m}</li>`).join('')}</ul>`, link: '#/finanse/sponsorzy/partnerzy' });
}
// Przychody sponsorskie sezonu S: gwarantowane i oczekiwane premie
function sponsorSummary(c, S) {
  const list = activeSponsors(c, S);
  const guaranteed = sum(list.map(s => spAmount(s, S)));
  const bonus = sum(list.flatMap(s => spBonuses(s).filter(b => !b.S || b.S === S).map(b => b.amt * bonusChance(c, b, S))));
  return { guaranteed, bonus: round1k(bonus), n: list.length };
}
