'use strict';
// Organizacja memoriałów i turniejów indywidualnych (zawody klasy „tour” na stadionie klubu, np. Memoriał Smoczyka w Lesznie,
// Jancarza w Gorzowie, Idzikowskiego i Czernego w Częstochowie). Organizator ustala pulę nagród (podział według miejsc)
// i zaprasza zawodników, w razie potrzeby ze startowym. Zawodnik przyjmuje zaproszenie, gdy startowe + oczekiwana nagroda
// (według spodziewanego miejsca w obsadzie) pokrywa jego oczekiwania: poziom, Grand Prix, okres (przed ligą chętniej –
// potrzebuje jazdy), lojalność wobec klubu gospodarza, przelot z zagranicy; odmawia też, gdy ma inny start albo kontuzję.
// Kluby AI organizują swoje zawody tym samym modelem według zasobności – bogatszy klub, mocniejsza obsada, więcej widzów.
// Organizator płaci pulę i startowe po zawodach (js/game.js processDay → orgPayout); pieniądze trafiają do budżetów zawodników.

const ORG_POOL = { PGE: 120000, '2E': 60000, KLZ: 30000 }; // typowa pula memoriału (szacunek do kalibracji)
const ORG_SPLIT = [25, 17, 13, 9, 6, 5, 4, 3.5, 3, 2.8, 2.6, 2.4, 2.2, 2, 1.8, 1.7]; // % puli za miejsca 1–16
const ORG_OPEN_DAYS = 75; // zaproszenia od ok. 2,5 miesiąca przed zawodami do ogłoszenia listy startowej
const ORG_ST = { pending: 'czeka na odpowiedź', accepted: 'przyjął', declined: 'odmówił', withdrawn: 'wycofane' };

const orgEligible = ev => !!ev && ev.kind === 'comp' && !ev.cancelled && typeof eventClassOf === 'function' && eventClassOf(ev) === 'tour' && compOf(ev).format === 'ind' && !!eventHost(ev);
const orgHost = ev => (orgEligible(ev) ? eventHost(ev) : null);
const orgMine = ev => { const h = orgHost(ev); return !!h && h.id === G.clubId; };
const orgCap = ev => eventFieldSize(ev) + 2; // obsada + dwóch rezerwowych toru
const orgLocked = ev => !!(ev.played || ev.startList || (ev.org && ev.org.final));
const orgOpen = ev => orgMine(ev) && !orgLocked(ev) && G.date >= addDays(ev.date, -ORG_OPEN_DAYS) && G.date < (ev.announceOn || announceDate(ev));
function orgInit(ev) {
  if (!ev.org) { const h = orgHost(ev); ev.org = { clubId: h.id, pool: ORG_POOL[h.league] || ORG_POOL.KLZ, inv: [] }; }
  return ev.org;
}
function orgPrizes(pool, n = 16) {
  const sp = ORG_SPLIT.slice(0, n), t = sum(sp);
  return sp.map(x => Math.round(pool * x / t / 100) * 100);
}
const orgAccepted = ev => (ev.org ? ev.org.inv.filter(x => x.st === 'accepted') : []);

// ---------- Oczekiwania i decyzja zawodnika ----------
function orgPreseason(ev) { return ev.date < seasonStart(ev.season); }
function orgAsk(r, ev) {
  const h = orgHost(ev) || {};
  let d = 1200 * Math.exp((r.skill - 8) * 0.36);
  if (G.sgp && G.sgp.riders && G.sgp.riders.includes(r.id)) d *= 1.6;
  if (orgPreseason(ev)) d *= 0.6; // przed ligą zawodnik potrzebuje jazdy i testu sprzętu
  if (r.clubId === h.id) d *= 0.4; // własny klub – memoriał „u siebie”
  if (!hasNat(r, 'POL') && !inSeasonBase(ev.date)) d += 2500; // przelot z domu przed sezonem
  return Math.round(d / 100) * 100;
}
// Obsada brana pod uwagę przy szacowaniu miejsca: przyjęci i czekający na odpowiedź, braki – przeciętny zawodnik turnieju
function orgFieldSkills(ev, extra) {
  const ids = ev.org ? ev.org.inv.filter(x => x.st === 'accepted' || x.st === 'pending').map(x => x.id) : [];
  const s = ids.filter(id => id !== extra && G.riders[id]).map(id => G.riders[id].skill);
  while (s.length < eventFieldSize(ev) - 1) s.push(9);
  return s;
}
function orgExpPrize(r, ev, pool = ev.org ? ev.org.pool : ORG_POOL[(orgHost(ev) || {}).league] || ORG_POOL.KLZ) {
  const P = orgPrizes(pool, eventFieldSize(ev)), field = orgFieldSkills(ev, r.id);
  const rank = field.filter(x => x > r.skill).length; // 0 = faworyt
  const ks = [rank - 2, rank - 1, rank, rank + 1, rank + 2].filter(k => k >= 0 && k < P.length);
  return Math.round(sum(ks.map(k => P[k])) / Math.max(1, ks.length) / 100) * 100;
}
function orgBusy(r, ev) {
  if (!r || r.retired || !r.active) return 'nie jeździ';
  if (r.injury && G.injuries[r.injury] && G.injuries[r.injury].until > ev.date) return 'kontuzja';
  if (typeof plBanned === 'function' && plBanned(r, ev.date)) return 'zawieszenie FIM';
  if (typeof riderPlanned === 'function' && riderPlanned(r, ev.date, ev.date).some(e => !(e.k === 'sparing' && !e.link) && !(e.link && e.link.includes(ev.id)))) return 'inny start tego dnia'; // bez treningu punktowanego w klubie
  if (Object.values(G.events).some(x => x !== ev && x.date === ev.date && x.org && x.org.inv.some(i => i.id === r.id && i.st === 'accepted'))) return 'przyjął inne zaproszenie';
  return null;
}
function memRiderDecides(r, ev, fee) {
  const busy = orgBusy(r, ev);
  if (busy) return { ok: false, why: busy };
  const ask = orgAsk(r, ev), got = fee + orgExpPrize(r, ev);
  const tol = 0.8 + 0.4 * hrand(G.seed + 'org' + ev.id + r.id);
  if (got >= ask * tol) return { ok: true };
  return { ok: false, why: 'warunki finansowe', short: Math.max(500, Math.round((ask * tol - got) / 500) * 500) };
}
// Sugerowane startowe: brakująca część oczekiwań po odjęciu spodziewanej nagrody
const orgSuggestFee = (r, ev) => Math.max(0, Math.round((orgAsk(r, ev) * 1.05 - orgExpPrize(r, ev)) / 500) * 500);

// ---------- Zaproszenia gracza ----------
function orgSetPool(ev, pool) {
  if (!orgOpen(ev)) return { ok: false, text: 'Zaproszenia są zamknięte.' };
  pool = Math.round(Number(pool) / 1000) * 1000;
  if (!(pool >= 0) || pool > 2e6) return { ok: false, text: 'Podaj pulę od 0 do 2 mln zł.' };
  orgInit(ev).pool = pool;
  return { ok: true, text: `Pula nagród: ${fmtMoney(pool)} (zwycięzca ${fmtMoney(orgPrizes(pool)[0])}).` };
}
function orgInvite(ev, riderId, fee = 0) {
  if (!orgOpen(ev)) return { ok: false, text: 'Zaproszenia są zamknięte.' };
  const o = orgInit(ev), r = G.riders[riderId];
  if (!r) return { ok: false, text: 'Nie ma takiego zawodnika.' };
  fee = Math.max(0, Math.round(Number(fee) / 500) * 500);
  const prev = o.inv.find(x => x.id === r.id);
  if (prev && (prev.st === 'accepted' || prev.st === 'pending')) return { ok: false, text: `${r.name}: zaproszenie już wysłane.` };
  if (prev && prev.st === 'declined' && fee < prev.fee * 1.2 + 500 && o.pool <= (prev.pool || 0)) return { ok: false, text: `${r.name} już odmówił – popraw warunki (startowe lub pulę).` };
  if (o.inv.filter(x => x.st === 'accepted' || x.st === 'pending').length >= orgCap(ev)) return { ok: false, text: `Komplet zaproszeń (${orgCap(ev)} z rezerwowymi).` };
  const x = { id: r.id, fee, pool: o.pool, st: 'pending', sent: G.date, replyOn: addDays(G.date, rint(1, 3)) };
  if (prev) Object.assign(prev, x); else o.inv.push(x);
  return { ok: true, text: `Zaproszenie dla: ${r.name}${fee ? ` (startowe ${fmtMoney(fee)})` : ''}. Odpowiedź do ${fmtDateShort(x.replyOn)}.` };
}
function orgWithdraw(ev, riderId) {
  const x = ev.org && ev.org.inv.find(i => i.id === riderId);
  if (!x || orgLocked(ev) || x.st === 'declined' || x.st === 'withdrawn') return { ok: false, text: 'Nie można wycofać.' };
  x.st = 'withdrawn';
  return { ok: true, text: `Wycofano zaproszenie: ${G.riders[riderId].name}.` };
}

// ---------- Kluby AI i asystent: organizacja według zasobności ----------
function orgAuto(ev, assistant = false) {
  const h = orgHost(ev), o = orgInit(ev);
  if (!assistant) o.pool = Math.round((ORG_POOL[h.league] || ORG_POOL.KLZ) * (0.6 + (h.rep || 50) / 125) * (h.cash < 0 ? 0.6 : 1) / 5000) * 5000;
  let budget = o.pool * (h.league === 'PGE' ? 0.5 : 0.3) - sum(orgAccepted(ev).map(x => x.fee));
  const cap = orgCap(ev), taken = new Set(o.inv.map(x => x.id));
  // cała pula zawodników od najlepszych (z lekkim losowaniem i premią dla własnego klubu) – kolejni są tańsi, więc słabszy organizator
  // schodzi niżej, aż skompletuje obsadę
  const cand = pool(ev.date).filter(r => !taken.has(r.id) && !u16(r, ev.date)).map(r => ({ r, k: r.skill + hrand(G.seed + 'oa' + ev.id + r.id) * 2 + (r.clubId === h.id ? 2 : 0) })).sort(by(x => x.k, -1));
  for (const { r } of cand) {
    if (orgAccepted(ev).length >= cap) break;
    let fee = orgSuggestFee(r, ev);
    if (fee > budget) fee = 0;
    const d = memRiderDecides(r, ev, fee);
    o.inv.push({ id: r.id, fee: d.ok ? fee : 0, pool: o.pool, st: d.ok ? 'accepted' : 'declined', sent: G.date, why: d.why, auto: true });
    if (d.ok) budget -= fee;
  }
}
// Ogłoszenie listy startowej (js/competitions.js buildStartList): przyjęci według poziomu, braki – zawodnicy z obsady domyślnej
function orgStartList(ev) {
  if (!orgEligible(ev)) return false;
  const o = orgInit(ev);
  for (const x of o.inv) if (x.st === 'pending') { const d = memRiderDecides(G.riders[x.id], ev, x.fee); x.st = d.ok ? 'accepted' : 'declined'; x.why = d.why; }
  if (!o.final && (!orgMine(ev) || orgAccepted(ev).length < eventFieldSize(ev))) {
    if (orgMine(ev) && orgAccepted(ev).length < eventFieldSize(ev)) o.assisted = true;
    orgAuto(ev, orgMine(ev));
  }
  o.final = G.date;
  const acc = orgAccepted(ev).filter(x => G.riders[x.id] && !orgBusy(G.riders[x.id], ev)).sort(by(x => G.riders[x.id].skill, -1));
  const n = eventFieldSize(ev);
  ev.startList = acc.slice(0, n).map(x => ({ id: x.id, via: 'zaproszenie organizatora' }));
  // ostateczność (za mało chętnych): uzupełnienie obsadą domyślną bez tych, którzy odmówili
  const no = new Set(o.inv.filter(x => x.st === 'declined').map(x => String(x.id)));
  if (ev.startList.length < n) for (const id of indField(ev)) { if (ev.startList.length >= n) break; if (!no.has(String(id)) && !ev.startList.some(x => String(x.id) === String(id))) ev.startList.push({ id, via: 'zaproszenie organizatora (zawodnik bez startowego)' }); }
  ev.reserves = acc.slice(n, n + 2).map(x => x.id);
  return true;
}

// ---------- Dzień gry: przypomnienie, odpowiedzi zawodników ----------
function orgDay(date) {
  for (const ev of Object.values(G.events)) {
    if (ev.kind !== 'comp' || ev.played || ev.season < G.season - 1 || !orgMine(ev) || orgLocked(ev)) continue;
    const open = addDays(ev.date, -ORG_OPEN_DAYS);
    if (date >= open && !(ev.org && ev.org.msg)) {
      orgInit(ev).msg = date;
      addMsg({ category: 'klub', from: 'Dział organizacji imprez', title: `Organizujemy: ${ev.name}`, stop: true,
        body: `<p>${fmtDay(ev.date)} na naszym stadionie: <b>${esc(ev.name)}</b>. Ustal pulę nagród i zaproś zawodników – lista startowa zostanie ogłoszona ${fmtDateShort(ev.announceOn || announceDate(ev))}.</p><p>Gwiazdy przyjmą zaproszenie, jeśli nagrody (i ewentualne startowe) będą dla nich atrakcyjne. Braki uzupełni asystent.</p>`, link: `#/gp/${ev.id}/organizacja` });
    }
    const due = ev.org ? ev.org.inv.filter(x => x.st === 'pending' && x.replyOn <= date) : [];
    if (!due.length) continue;
    const lines = [];
    for (const x of due) {
      const r = G.riders[x.id], d = memRiderDecides(r, ev, x.fee);
      x.st = d.ok ? 'accepted' : 'declined'; x.why = d.why; x.short = d.short; x.ans = date;
      lines.push(d.ok ? `<b class="pos">${esc(r.name)}</b> przyjmuje zaproszenie${x.fee ? ` (startowe ${fmtMoney(x.fee)})` : ''}.` : `<b>${esc(r.name)}</b> odmawia – ${esc(d.why)}${d.short ? ` (menedżer: brakuje ok. ${fmtMoney(d.short)})` : ''}.`);
    }
    addMsg({ category: 'klub', from: 'Dział organizacji imprez', title: `${ev.name}: odpowiedzi zawodników`, body: `<p>${lines.join('<br>')}</p><p class="small muted">Przyjęło: ${orgAccepted(ev).length} z ${eventFieldSize(ev)} (+2 rezerwowych).</p>`, link: `#/gp/${ev.id}/organizacja` });
  }
}
// ---------- Po zawodach: nagrody i startowe ----------
function orgPayout(ev) {
  const o = ev.org;
  if (!o || o.paid || !ev.played || ev.cancelled) return;
  const m = G.matches[ev.matchId];
  if (!m || !m.classification) return;
  const P = orgPrizes(o.pool, eventFieldSize(ev)), paid = [];
  m.classification.forEach((c, i) => { const r = G.riders[c.riderId]; if (r && P[i]) { r.equip.budget = (r.equip.budget || 0) + P[i]; paid.push({ id: r.id, place: c.place, prize: P[i] }); } });
  const fees = o.inv.filter(x => x.st === 'accepted' && x.fee && m.riders[x.id]).map(x => ({ id: x.id, fee: x.fee }));
  for (const f of fees) G.riders[f.id].equip.budget = (G.riders[f.id].equip.budget || 0) + f.fee;
  const tot = sum(paid.map(x => x.prize)), feeTot = sum(fees.map(x => x.fee));
  if (tot) addTx(o.clubId, 'imprezy', -tot, `Nagrody: ${ev.name}`);
  if (feeTot) addTx(o.clubId, 'imprezy', -feeTot, `Startowe zawodników: ${ev.name}`);
  o.paid = { prizes: paid, fees, tot, feeTot };
}
// Obsada a frekwencja (js/stadium.js eventGateCalc): czołówka w stawce przyciąga kibiców
function orgStarFactor(ev) {
  if (!orgEligible(ev)) return 1;
  const ids = ev.startList ? ev.startList.map(x => x.id) : orgAccepted(ev).map(x => x.id);
  const sk = ids.map(id => G.riders[id]).filter(Boolean).map(r => r.skill + (G.sgp && G.sgp.riders && G.sgp.riders.includes(r.id) ? 1.5 : 0)).sort((a, b) => b - a).slice(0, 6);
  if (!sk.length) return 1;
  return clamp(0.55 + sum(sk.map(s => Math.max(0, s - 9))) / 20, 0.6, 1.8);
}
