#!/usr/bin/env node
// Test umów sztabu (js/staff-contracts.js): przedłużenie (oczekiwania, odpowiedź, limit prób), wygasanie po sezonie,
// kluby AI (przedłużenie albo nowy główny trener z rynku), przypomnienia.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Intl, Math, Date, JSON, Set, Map, Object, Array, Number, String };
vm.createContext(ctx);
for (const [, f] of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="([^"]+\.js)"/g)) {
  if (/js\/(ui-|db\.)/.test(f)) continue;
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`if (typeof standingsRows === 'undefined' && typeof recordSeasonHonours === 'function') recordSeasonHonours = () => {};`, ctx); // js/honours-game.js korzysta z funkcji interfejsu
const out = vm.runInContext(`(() => {
  newGame({ clubId: 9, manager: 'Test' });
  const errs = [], info = [];
  const go = until => { let g = 0; while (G.date < until && g++ < 500) { const r = advance(7); if (r.stop === 'match') { const f = r.fixture; simulateMatch(G.matches[f.matchId] || createMatch(f)); afterFixture(f); } } };
  go('2026-07-25');
  const mine = clubStaff(G.clubId).filter(s => !s.player);
  info.push('nasz sztab: ' + mine.map(s => s.name + ' (' + s.role + ', do ' + s.until + ')').join(', '));
  if (!mine.length) { errs.push('brak sztabu'); return { errs, info }; }
  // wszystkim kończy się umowa z sezonem 2026
  for (const s of mine) s.until = G.season;
  const [a, b] = mine;
  const day = n => go(addDays(G.date, n));
  // przedłużenie: oferta 125% oczekiwań + premia za medal
  const askA = staffAsk(a), rolesA = staffRoles(a);
  info.push(a.name + ': pensja ' + a.wage + ', oczekiwania ' + askA.wage + ' na ' + askA.years + ' l., chęć ' + staffWill(a).toFixed(2));
  let r = staffOffer(a.id, { roles: rolesA, wage: Math.round(askA.wage * 1.25), years: askA.years, bonuses: [{ type: 'medal', amount: 20000 }] });
  info.push('oferta 125%: ' + r.text);
  day(4);
  let n = staffNegLast(a.id);
  info.push('odpowiedź: ' + n.status + ' – ' + n.log.map(l => l.t).join(' | '));
  if (n.status === 'agreed' && !(a.until === G.season + askA.years && staffWageFor(a) === Math.round(askA.wage * 1.25) && a.bonuses && a.bonuses[0].type === 'medal')) errs.push('przedłużenie: zła data, pensja lub premie ' + a.until + ' ' + staffWageFor(a));
  if (n.status === 'pending') errs.push('brak odpowiedzi po 4 dniach');
  // niska oferta: kontroferta albo odmowa, najwyżej 3 rundy
  if (b) {
    const lo = Math.round(staffAsk(b).wage * 0.8);
    staffOffer(b.id, { roles: staffRoles(b), wage: lo, years: 1, bonuses: [] }); day(4);
    let nb = staffNegLast(b.id);
    info.push(b.name + ' – oferta 80%: ' + nb.status + (nb.counter ? ' (żąda ' + nb.counter.wage + ', ' + nb.counter.years + ' l.)' : ''));
    if (nb.status === 'counter') { staffOffer(b.id, { roles: staffRoles(b), wage: nb.counter.wage, years: nb.counter.years, bonuses: [] }); day(4); nb = staffNegLast(b.id); info.push('  po przyjęciu oczekiwań: ' + nb.status + ', umowa do ' + b.until); }
  }
  // zatrudnienie wolnego trenera w dwóch rolach
  const free = Object.values(G.staff).filter(x => staffHireable(x) && x.role === 'coach').sort(by(x => -staffDealLevel(x)))[0];
  if (free) {
    const roles = ['juniorCoach', 'youth'];
    if (!staffSlotFree(myClub(), { ...free, role: roles[0] })) { const out = clubStaff(G.clubId).find(x => !x.player && x !== a && COACH_GROUP.includes(x.role)); if (out) out.clubId = null; }
    const ask = staffAsk(free, roles);
    const rr = staffOffer(free.id, { roles, wage: Math.round(ask.wage * 1.3), years: ask.years, bonuses: [] });
    day(4);
    const nf = staffNegLast(free.id);
    info.push('wolny ' + free.name + ' (poziom ' + staffDealLevel(free).toFixed(1) + '): ' + rr.text + ' → ' + (nf ? nf.status : '-') + (free.clubId === G.clubId ? ', role: ' + staffRoleNames(free) + ', do ' + free.until : ''));
    if (nf && nf.status === 'agreed' && !(free.clubId === G.clubId && free.role === 'juniorCoach' && (free.extraRoles || []).includes('youth'))) errs.push('zatrudnienie: złe role lub klub');
  }
  const msgs0 = G.messages ? Object.keys(G.messages).length : 0;
  go('2026-10-02');
  const rem = Object.values(G.messages || {}).filter(m => /Kończące się umowy sztabu/.test(m.title));
  info.push('przypomnienia: ' + rem.length);
  if (!rem.length) errs.push('brak przypomnienia o kończących się umowach');
  const aiBefore = Object.values(G.staff).filter(s => s.clubId && s.clubId !== G.clubId && !s.national && s.until != null && s.until < G.season + 1).length;
  const coachless0 = Object.values(G.clubs).filter(c => c.id !== G.clubId && clubStaff(c.id).length && !clubStaff(c.id).some(s => s.role === 'coach')).length;
  go('2026-11-03');
  const stay = mine.filter(s => s.clubId === G.clubId), gone = mine.filter(s => s.clubId !== G.clubId && s.prevClubId === G.clubId);
  info.push('po 1.11: zostali ' + stay.map(s => s.name + ' (do ' + s.until + ')').join(', ') + '; odeszli ' + gone.map(s => s.name).join(', '));
  for (const s of gone) if (s.until >= G.season) errs.push('odszedł mimo ważnej umowy: ' + s.name);
  for (const s of stay) if (s.until < G.season) errs.push('został mimo wygasłej umowy: ' + s.name);
  const expiredAi = Object.values(G.staff).filter(s => s.clubId && !s.player && !s.national && s.until != null && s.until < G.season);
  if (expiredAi.length) errs.push('wygasłe umowy nadal w klubach: ' + expiredAi.length);
  const coachless = Object.values(G.clubs).filter(c => c.id !== G.clubId && clubActive(c) && clubStaff(c.id).length && !clubStaff(c.id).some(s => s.role === 'coach')).map(c => c.short);
  info.push('kluby AI z wygasającymi umowami: ' + aiBefore + '; bez głównego trenera przed: ' + coachless0 + ', po: ' + coachless.length + ' (' + coachless.join(', ') + ')');
  const msg = Object.values(G.messages || {}).find(m => /Wygasły umowy sztabu/.test(m.title));
  if (gone.length && !msg) errs.push('brak komunikatu o wygasłych umowach');
  return { errs, info };
})()`, ctx);
out.info.forEach(l => console.log('  ' + l));
if (out.errs.length) { console.log('BŁĘDY:\n  ' + out.errs.join('\n  ')); process.exit(1); }
console.log('OK – umowy sztabu');
