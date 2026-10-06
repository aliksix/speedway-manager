#!/usr/bin/env node
// Test organizacji memoriałów (js/memorial.js): pula nagród, zaproszenia i odpowiedzi zawodników, lista startowa z zaproszeń,
// wypłata nagród i startowego, memoriały klubów AI (zasobniejszy organizator – mocniejsza obsada).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Intl, Math, Date, JSON, Set, Map, Object, Array, Number, String };
vm.createContext(ctx);
for (const [, f] of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="([^"]+\.js)"/g)) {
  if (/js\/(ui-|db\.)/.test(f)) continue;
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const out = vm.runInContext(`(() => {
  newGame({ clubId: 9, manager: 'Test' });
  const errs = [], info = [];
  const go = until => { let g = 0; while (G.date < until && g++ < 500) { const r = advance(7); if (r.stop === 'match') { const f = r.fixture; simulateMatch(G.matches[f.matchId] || createMatch(f)); afterFixture(f); } } };
  go(G.season + '-12-01');
  const S = G.season;
  const ev = Object.values(G.events).filter(e => e.season === S && orgMine(e)).sort(by(e => e.date))[0];
  if (!ev) return { errs: ['brak memoriału organizowanego przez klub gracza'], info };
  info.push('nasz turniej: ' + ev.name + ' ' + ev.date + ', lista ' + (ev.announceOn || announceDate(ev)));
  go(addDays(ev.date, -ORG_OPEN_DAYS + 3));
  if (!Object.values(G.messages).some(m => m.title.startsWith('Organizujemy'))) errs.push('brak wiadomości o organizacji');
  let r = orgSetPool(ev, 150000); if (!r.ok) errs.push('pula: ' + r.text);
  const top = pool(ev.date).filter(x => !orgBusy(x, ev)).slice(0, 24);
  // gwiazdy bez startowego, reszta ze startowym sugerowanym
  top.forEach((x, i) => { const rr = orgInvite(ev, x.id, i < 4 ? 0 : orgSuggestFee(x, ev)); if (!rr.ok && !/Komplet/.test(rr.text)) errs.push('zaproszenie: ' + rr.text); });
  go(addDays(G.date, 5));
  const st = {}; for (const x of ev.org.inv) st[x.st] = (st[x.st] || 0) + 1;
  info.push('odpowiedzi: ' + JSON.stringify(st) + '; odmowy: ' + ev.org.inv.filter(x => x.st === 'declined').map(x => G.riders[x.id].name + ' (' + x.why + (x.short ? ', brakuje ' + x.short : '') + ')').join(', '));
  if (st.pending) errs.push('zawodnicy nie odpowiedzieli w terminie');
  if (!st.accepted) errs.push('nikt nie przyjął zaproszenia');
  const d0 = ev.org.inv.find(x => x.st === 'declined' && x.why === 'warunki finansowe');
  if (d0) { const again = orgInvite(ev, d0.id, d0.fee); if (again.ok) errs.push('ponowne zaproszenie bez lepszych warunków przyjęte'); }
  const budgets = {}; for (const x of ev.org.inv) if (G.riders[x.id]) budgets[x.id] = G.riders[x.id].equip.budget || 0;
  go(addDays(ev.date, 1));
  if (!ev.startList) errs.push('brak listy startowej');
  else { const via = ev.startList.filter(x => /zaproszenie organizatora/.test(x.via)).length; info.push('lista: ' + ev.startList.length + ' (z zaproszeń ' + via + '), rezerwowi ' + (ev.reserves || []).length); if (via < ev.startList.length) errs.push('lista startowa nie z zaproszeń'); }
  if (!ev.played) errs.push('turniej nie rozegrany');
  if (ev.played && !ev.cancelled) {
    if (!ev.org.paid) errs.push('brak wypłaty nagród');
    else info.push('wypłacono: nagrody ' + ev.org.paid.tot + ', startowe ' + ev.org.paid.feeTot + '; zwycięzca ' + G.riders[ev.org.paid.prizes[0].id].name + ' ' + ev.org.paid.prizes[0].prize);
    const tx = Object.values(G.transactions).filter(t => t.desc.includes(ev.name) && /Nagrody|Startowe/.test(t.desc)).map(t => t.desc.split(':')[0] + ' ' + t.amount);
    info.push('księgowanie: ' + tx.join(', '));
    if (ev.gate) info.push('frekwencja ' + ev.gate.att + ', obsada × ' + round2(orgStarFactor(ev)));
  }
  // memoriały AI: pula i siła obsady
  go(S + '-05-01');
  const rows = Object.values(G.events).filter(e => e.season === S && e.org && !orgMine(e) && e.startList).map(e => { const h = orgHost(e); const sk = e.startList.map(x => G.riders[x.id]).filter(Boolean).map(r => r.skill).sort((a, b) => b - a).slice(0, 6); return { n: e.name.slice(0, 40), lg: h.league, pool: e.org.pool, top6: round1(sum(sk) / Math.max(1, sk.length)), gp: e.startList.filter(x => G.sgp && G.sgp.riders.includes(x.id)).length }; });
  rows.forEach(x => info.push('AI: ' + x.lg + ' pula ' + x.pool + ' top6 ' + x.top6 + ' GP ' + x.gp + ' – ' + x.n));
  const avg = lg => { const l = rows.filter(x => x.lg === lg); return l.length ? sum(l.map(x => x.top6)) / l.length : null; };
  if (avg('PGE') != null && avg('KLZ') != null && !(avg('PGE') > avg('KLZ'))) errs.push('memoriał PGE nie ma mocniejszej obsady niż KLŻ');
  return { errs, info };
})()`, ctx);
out.info.forEach(l => console.log('  ' + l));
if (out.errs.length) { console.log('BŁĘDY:\n  ' + out.errs.join('\n  ')); process.exit(1); }
console.log('OK – memoriały');
