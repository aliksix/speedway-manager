'use strict';
// Umowy sztabu – negocjacje jak z zawodnikami: role (jedna lub kilka), pensja miesięczna, długość umowy, premie za sukcesy drużyny.
// Ta sama ścieżka dla przedłużenia umowy własnej osoby i zatrudnienia wolnej. Odpowiedź po 1–3 dniach: zgoda, kontroferta
// (oczekiwania) albo odmowa; najwyżej 3 rundy. Umowa „do końca sezonu X” obowiązuje do 31 października X; w newSeason
// (sezon X+1) nieprzedłużona osoba odchodzi. Kluby AI przedłużają albo zatrudniają nowego głównego trenera z rynku wolnych.

const staffDealLevel = s => s.rep ?? (() => { const v = Object.values(s.attrs || {}).filter(Number.isFinite); return v.length ? sum(v) / v.length : 10; })();
const staffAge = s => s.born ? ageYears(s.born) : 50;
const SNEG_OPEN = ['pending', 'counter'];
// premie drużynowe w umowach sztabu (wypłata po sezonie)
const STAFF_BONUS = {
  champion: { name: 'Mistrzostwo ligi', short: 'mistrzostwo' },
  medal: { name: 'Medal ligi (miejsca 1–3)', short: 'medal' },
  playoff: { name: 'Awans do fazy play-off', short: 'play-off' },
  promotion: { name: 'Awans do wyższej ligi', short: 'awans' },
  stay: { name: 'Utrzymanie w lidze', short: 'utrzymanie' },
};
// Przedłużenie: w ostatnim roku umowy; zatrudnienie: osoba wolna (bez klubu, nie selekcjoner)
const staffRenewable = s => !!(s && s.clubId === G.clubId && !s.player && !s.national && s.until != null && s.until <= sportSeason());
const staffHireable = s => !!(s && !s.clubId && !s.player && !s.national);
// Koniec nowej umowy: przedłużenie – kolejne sezony po obecnym końcu; zatrudnienie od kwietnia (sezon w toku) – reszta sezonu + pełne sezony
const staffDealUntil = (s, years) => s.clubId === G.clubId ? Math.max(s.until, G.season) + years : sportSeason() + years - (G.seasonClosed !== G.season && G.date.slice(5) >= '04-01' ? 0 : 1);
const staffNeg = id => Object.values(G.snegs || {}).find(n => n.staffId === id && n.clubId === G.clubId && SNEG_OPEN.includes(n.status)) || null;
const staffNegLast = id => Object.values(G.snegs || {}).filter(n => n.staffId === id && n.clubId === G.clubId).sort(by(n => n.created + n.id, -1))[0] || null;

// Oczekiwania: pensja dla ról (stawki ligi klubu, znana pensja przy tych samych rolach), podwyżka wg poziomu; długość wg wieku
function staffAsk(s, roles = staffRoles(s), clubId = G.clubId) {
  const c = G.clubs[clubId], same = roles.join('|') === staffRoles(s).join('|');
  const probe = { ...s, role: roles[0], extraRoles: roles.slice(1), wageDeal: null, wageReal: same ? s.wageReal : null };
  const base = staffWageFor(probe, c), lvl = staffDealLevel(s), renew = s.clubId === clubId;
  const up = renew ? clamp(1.03 + (lvl - 10) * 0.012, 1, 1.2) : clamp(1.08 + (lvl - 10) * 0.015, 1.03, 1.3); // nowy klub – premia za zmianę
  const age = staffAge(s);
  return { wage: Math.round(base * up / 500) * 500, years: age >= 62 ? 1 : age >= 50 ? 2 : 3, base };
}
// Chęć (0–1): renoma klubu względem poziomu osoby, ambicja (determinacja), staż w klubie (przedłużenie); stała w danym sezonie
function staffWill(s, clubId = G.clubId) {
  const c = G.clubs[clubId], lvl = staffDealLevel(s), det = (s.hidden || {}).determination ?? 11, renew = s.clubId === clubId;
  const yrs = renew && s.joined ? Math.max(0, Number(G.date.slice(0, 4)) - Number(String(s.joined).slice(0, 4))) : renew ? 1 : 0;
  let w = (renew ? 0.78 : 0.72) + ((c.rep ?? 50) - 50) / 160 - (det - 11) * 0.02 + Math.min(0.1, yrs * 0.03);
  if (lvl >= 14 && c.league !== 'PGE') w -= 0.18; // czołowy trener w niższej lidze – szuka lepszego klubu
  if (renew && c.objective && c.objective.failed) w -= 0.1;
  return clamp(w + (hrand(`${G.seed}|sw|${s.id}|${clubId}|${G.season}`) - 0.5) * 0.2, 0.15, 0.95);
}
// Szansa premii (siła składu klubu w lidze, jak przy kontraktach zawodników)
function staffBonusChance(type, clubId = G.clubId) {
  const rk = typeof clubRank === 'function' ? clubRank(clubId) : { rank: 3, n: 8, lg: G.clubs[clubId].league }, at = (a, i) => a[Math.min(i, a.length - 1)];
  return { champion: at([0.35, 0.25, 0.15, 0.1, 0.06, 0.04, 0.03, 0.02], rk.rank), medal: at([0.75, 0.65, 0.5, 0.35, 0.2, 0.12, 0.08, 0.05], rk.rank),
    playoff: at([0.95, 0.9, 0.8, 0.6, 0.4, 0.25, 0.15, 0.08], rk.rank), promotion: rk.lg === 'PGE' ? 0 : at([0.45, 0.3, 0.15, 0.08, 0.04, 0.02], rk.rank),
    stay: rk.rank >= rk.n - 1 ? 0.55 : rk.rank >= rk.n - 2 ? 0.8 : 0.95 }[type] || 0;
}
const staffBonusEV = (t, clubId = G.clubId) => sum((t.bonuses || []).map(b => (b.amount || 0) * staffBonusChance(b.type, clubId)));
// Ocena oferty (1 = zgodna z oczekiwaniami): pensja + premie (wartość oczekiwana / 12), długość, role
function staffUtility(s, t, clubId = G.clubId) {
  const ask = staffAsk(s, t.roles, clubId);
  let u = (t.wage + staffBonusEV(t, clubId) / 12 * 0.8) / ask.wage;
  u *= t.years === ask.years ? 1 : Math.abs(t.years - ask.years) === 1 ? 0.95 : 0.88;
  const lvl = staffDealLevel(s), head = t.roles.includes('coach');
  if (!head && lvl >= 13 && staffRoles(s).includes('coach')) u *= 0.88; // główny trener niechętnie schodzi do roli asystenta
  if (t.roles.length > Math.max(2, staffRoles(s).length)) u *= 0.95;
  return u;
}
function sNegLog(n, t) { n.log.push({ d: G.date, t }); }
function staffOfferProblem(s, t) {
  if (!t.roles || !t.roles.length) return 'Wybierz co najmniej jedną rolę.';
  if (!(t.wage > 0)) return 'Podaj pensję.';
  if (!(t.years >= 1 && t.years <= 3)) return 'Umowa na 1–3 sezony.';
  if (t.roles.includes('u24Coach') && myClub().league !== 'PGE') return 'Trener U24 – tylko w PGE Ekstralidze.';
  if (staffHireable(s) && !staffSlotFree(myClub(), { ...s, role: t.roles[0] })) { const k = staffKind({ ...s, role: t.roles[0] }); return `Brak miejsca w sztabie (${staffCounts(myClub())[k]}/${staffLimits(myClub())[k]}).`; }
  if (!staffHireable(s) && !staffRenewable(s)) return 'Z tą osobą nie można teraz negocjować.';
  return null;
}
// Złożenie oferty (nowa albo nowe warunki w trwających rozmowach)
function staffOffer(id, terms) {
  const s = G.staff[id], t = { roles: terms.roles.slice(), wage: Math.round(terms.wage), years: terms.years, bonuses: (terms.bonuses || []).filter(b => b.amount > 0).map(b => ({ ...b })) };
  const p = staffOfferProblem(s, t);
  if (p) return { ok: false, text: p };
  const last = staffNegLast(id);
  if (last && last.status === 'rejected' && last.final && last.season === G.season) return { ok: false, text: `${s.name} nie chce już rozmawiać w tym sezonie.` };
  G.snegs = G.snegs || {}; G.seq.sneg = G.seq.sneg || 1;
  let n = staffNeg(id);
  if (n) { if (n.round >= 3) return { ok: false, text: 'Wyczerpano trzy rundy rozmów – poczekaj na odpowiedź.' }; n.terms = t; n.status = 'pending'; n.counter = null; n.round++; }
  else { const nid = `SN${G.seq.sneg++}`; n = G.snegs[nid] = { id: nid, staffId: id, clubId: G.clubId, kind: s.clubId === G.clubId ? 'renew' : 'hire', season: G.season, created: G.date, terms: t, status: 'pending', counter: null, round: 1, log: [] }; }
  n.decideBy = addDays(G.date, staffUtility(s, t) < 0.6 ? 1 : rint(1, 3));
  sNegLog(n, `Oferta: ${t.roles.map(r => STAFF_ROLES[r].name).join(' + ')}, ${fmtMoney(t.wage)} / mies., ${t.years} ${plural(t.years, 'sezon', 'sezony', 'sezonów')}${t.bonuses.length ? `, premie: ${t.bonuses.map(b => `${STAFF_BONUS[b.type].short} ${fmtMoney(b.amount, true)}`).join(', ')}` : ''}.`);
  return { ok: true, text: `Oferta wysłana. ${s.name} odpowie do ${fmtDate(n.decideBy)}.` };
}
function staffWithdraw(nid) { const n = G.snegs && G.snegs[nid]; if (!n || !SNEG_OPEN.includes(n.status)) return; n.status = 'withdrawn'; sNegLog(n, 'Klub wycofał ofertę.'); }
// Odpowiedź osoby
function staffDecide(n) {
  const s = G.staff[n.staffId], t = n.terms;
  if (!s || (n.kind === 'hire' && s.clubId) || (n.kind === 'renew' && s.clubId !== n.clubId)) { n.status = 'expired'; sNegLog(n, 'Rozmowy nieaktualne.'); return; }
  const u = staffUtility(s, t, n.clubId), will = staffWill(s, n.clubId), ask = staffAsk(s, t.roles, n.clubId);
  const roll = hrand(`${G.seed}|sd|${n.id}|${n.round}`);
  const msg = (title, body) => addMsg({ category: 'drużyna', from: s.name, title, body: `<p>${body}</p>`, link: `#/oferta-sztab/${s.id}` });
  if (u >= 0.98 && roll < clamp(will + (u - 1) * 2, 0.1, 0.98)) return staffAgree(n);
  if (will < 0.3 || u < 0.6 || n.round >= 3) {
    n.status = 'rejected'; n.final = will < 0.3 || n.round >= 3;
    sNegLog(n, n.final ? 'Odmowa – koniec rozmów.' : 'Odmowa – oferta niepoważna.');
    return msg(`${s.name} odrzuca ofertę`, n.kind === 'renew' && n.final ? `${esc(s.name)} nie przedłuży umowy – odejdzie po sezonie ${s.until}.` : `${esc(s.name)} odrzucił naszą ofertę${n.final ? ' i nie chce dalej rozmawiać' : ' – możesz złożyć nową'}.`);
  }
  // kontroferta: oczekiwana pensja i długość umowy (premie zostają)
  n.status = 'counter'; n.counter = { wage: Math.max(ask.wage, t.wage), years: ask.years };
  sNegLog(n, `Kontroferta: ${fmtMoney(n.counter.wage)} / mies., ${n.counter.years} ${plural(n.counter.years, 'sezon', 'sezony', 'sezonów')}.`);
  msg(`${s.name}: kontroferta`, `${esc(s.name)} oczekuje ${fmtMoney(n.counter.wage)} miesięcznie i umowy na ${n.counter.years} ${plural(n.counter.years, 'sezon', 'sezony', 'sezonów')}.`);
}
function staffAgree(n) {
  const s = G.staff[n.staffId], t = n.terms, c = G.clubs[n.clubId];
  if (n.kind === 'hire' && !staffSlotFree(c, { ...s, role: t.roles[0] })) { n.status = 'expired'; sNegLog(n, 'Brak miejsca w sztabie – umowa niepodpisana.'); return; }
  n.status = 'agreed'; sNegLog(n, 'Zgoda – umowa podpisana.');
  s.until = staffDealUntil(s, t.years);
  if (n.kind === 'hire') { s.clubId = n.clubId; s.joined = G.date; }
  s.role = t.roles[0]; s.extraRoles = t.roles.slice(1); if (!s.extraRoles.length) delete s.extraRoles;
  s.wageDeal = t.wage; s.wage = t.wage; s.bonuses = t.bonuses.length ? t.bonuses.map(b => ({ ...b })) : undefined;
  if (typeof TQ !== 'undefined') TQ.date = null;
  STAFF_BEST.date = null;
  addMsg({ category: 'drużyna', from: 'Sekretariat', title: n.kind === 'hire' ? `${s.name} w sztabie` : `${s.name} przedłuża umowę`,
    body: `<p>${esc(s.name)} – ${esc(staffRoleNames(s))}, umowa do końca sezonu ${s.until}, ${fmtMoney(t.wage)} / mies.${t.bonuses.length ? `; premie: ${t.bonuses.map(b => `${STAFF_BONUS[b.type].short} ${fmtMoney(b.amount)}`).join(', ')}` : ''}.</p>`, link: `#/osoba/${s.id}/kontrakt` });
}
// Dzień: odpowiedzi, przypomnienia (1 sierpnia i 1 października)
function staffContractsDay() {
  for (const n of Object.values(G.snegs || {})) if (n.status === 'pending' && n.decideBy <= G.date) staffDecide(n);
  const md = G.date.slice(5);
  if (md !== '08-01' && md !== '10-01') return;
  const list = clubStaff(G.clubId).filter(s => !s.player && s.until != null && s.until <= G.season);
  if (!list.length) return;
  addMsg({ category: 'zarząd', from: `Zarząd ${myClub().name}`, title: `Kończące się umowy sztabu (${list.length})`,
    body: `<p>Z końcem sezonu ${G.season} (31 października) wygasają umowy: ${list.map(s => `<a href="#/oferta-sztab/${s.id}">${esc(s.name)}</a>`).join(', ')}.</p><p>Bez przedłużenia te osoby odejdą z klubu. Rozmowy rozpoczniesz w profilu osoby → Kontrakt.</p>`, link: '#/druzyna/sztab' });
}
// Premie sztabu po sezonie (wyniki ligi i awanse/spadki jak przy kontraktach zawodników)
function staffBonuses(results, moves) {
  const mine = [];
  for (const s of Object.values(G.staff)) {
    if (!s.clubId || !s.bonuses || !s.bonuses.length) continue;
    const lg = Object.keys(results).find(l => results[l].includes(s.clubId)), pos = lg ? results[lg].indexOf(s.clubId) + 1 : 99;
    const top4 = lg && typeof leagueTable === 'function' ? leagueTable(lg).slice(0, 4).map(x => x.clubId) : [];
    const mv = (moves || []).find(m => m[0] === s.clubId);
    const ok = b => ({ champion: pos === 1, medal: pos <= 3, playoff: top4.includes(s.clubId), promotion: !!mv && mv[2].startsWith('awans'), stay: !(mv && mv[2].startsWith('spadek')) }[b.type]);
    for (const b of s.bonuses) if (b.amount && ok(b)) { addTx(s.clubId, 'płace', -b.amount, `Premia sztabu (${STAFF_BONUS[b.type].short}): ${s.name}`); if (s.clubId === G.clubId) mine.push(`${esc(s.name)} – ${esc(STAFF_BONUS[b.type].short)}: ${fmtMoney(b.amount)}`); }
  }
  if (mine.length) addMsg({ category: 'finanse', from: 'Księgowość', title: `Premie sztabu za sezon ${G.season} (${mine.length})`, body: `<p>${mine.join('<br>')}</p>`, link: '#/finanse/transakcje' });
}

// ---------- Koniec sezonu: wygasające umowy ----------
function staffContractsNewSeason() {
  const left = [], aiOut = [];
  for (const n of Object.values(G.snegs || {})) if (SNEG_OPEN.includes(n.status)) { n.status = 'expired'; sNegLog(n, 'Koniec sezonu – rozmowy wygasły.'); }
  for (const s of Object.values(G.staff)) {
    if (!s.clubId || s.player || s.national || s.until == null || s.until >= G.season) continue;
    const c = G.clubs[s.clubId];
    if (s.clubId === G.clubId) { left.push(s); s.prevClubId = s.clubId; s.clubId = null; delete s.extraRoles; delete s.wageDeal; delete s.bonuses; continue; }
    // klub AI: przedłużenie (częściej przy dobrym trenerze i bogatym klubie) albo rozstanie
    if (hrand(`${G.seed}|ai|${s.id}|${G.season}`) < clamp(0.62 + (staffDealLevel(s) - 10) * 0.03 + ((c && c.rep) || 50) / 500, 0.4, 0.9)) s.until = G.season + (hrand(`${G.seed}|ay|${s.id}`) < 0.5 ? 0 : 1);
    else { aiOut.push([s, s.clubId]); s.prevClubId = s.clubId; s.clubId = null; delete s.extraRoles; delete s.wageDeal; delete s.bonuses; }
  }
  // kluby AI bez głównego trenera: najlepszy wolny trener, na którego klub stać
  for (const [, cid] of aiOut) {
    const c = G.clubs[cid];
    if (!c || clubStaff(cid).some(x => x.role === 'coach') || (typeof clubActive === 'function' && !clubActive(c))) continue;
    const pick = Object.values(G.staff).filter(x => !x.clubId && !x.player && !x.national && x.role === 'coach' && x.prevClubId !== cid && staffWageFor(x, c) * 12 <= c.budget * 0.04)
      .sort(by(x => staffDealLevel(x), -1))[0];
    if (pick) { pick.clubId = cid; pick.until = G.season + 1; pick.joined = G.date; pick.wage = staffWageFor(pick, c); }
  }
  if (typeof TQ !== 'undefined') TQ.date = null;
  STAFF_BEST.date = null;
  if (left.length) addMsg({ category: 'drużyna', from: 'Sekretariat', title: `Wygasły umowy sztabu (${left.length})`,
    body: `<p>Po sezonie ${G.season - 1} klub opuszczają: ${left.map(s => `<a href="#/osoba/${s.id}">${esc(s.name)}</a> (${esc(staffRoleNames(s) || STAFF_ROLES[s.role].name)})`).join(', ')}.</p><p>Brakujące role uzupełnisz w Transfery → Sztab.</p>`, link: '#/druzyna/sztab' });
}
