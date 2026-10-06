'use strict';
// Scenariusz biegu (prototyp poza grą): z wyniku runHeat (kolejność po starcie, meta, statusy) – oś czasu ok. 60 s,
// klatki kluczowe pozycji (metry za prowadzącym, tor jazdy 0 = krawężnik … 1 = banda) i komunikaty relacji tekstowej.
// Wynik biegu się nie zmienia – scenariusz go tylko opowiada (zmiany kolejności = mijanki z modelu; ataki bez zmiany kolejności).
// Deterministyczny z ziarna (mecz + bieg).

const HS = (() => {
  const LANE = { A: 0.1, B: 0.37, C: 0.63, D: 0.9 };
  const GATE_NO = { A: 'pierwszego', B: 'drugiego', C: 'trzeciego', D: 'czwartego' };
  const LAP_WORD = ['pierwszego', 'drugiego', 'trzeciego', 'czwartego'];

  function rng(seed) { // mulberry32 – własny, nie rusza losowości gry
    let a = 0;
    for (const ch of String(seed)) a = Math.imul(a ^ ch.codePointAt(0), 2654435761) >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Geometria toru: proste (szer. wS) i łuki (szer. do wB), krawężnik – dwa półokręgi o promieniu rIn; dystans liczony po linii środkowej
  // (promień rm). Linia startu na środku prostej startowej, jazda przeciwnie do ruchu wskazówek zegara.
  function geometry(len) {
    const rIn = Math.max(24, Math.min(38, len * 0.08)), wS = 10, wB = 14, rm = rIn + wS / 2, bend = Math.PI * rm, s = (len - 2 * bend) / 2;
    const segs = [s / 2, bend, s, bend, s / 2];
    const bends = [[s / 2, s / 2 + bend], [1.5 * s + bend, 1.5 * s + 2 * bend]]; // metry od linii startu
    return { len, rIn, wS, wB, rm, bend, s, segs, bends };
  }
  // szerokość toru w miejscu d (m): na łukach szerzej, płynne przejście
  function widthAt(g, d) {
    d = ((d % g.len) + g.len) % g.len;
    let f = 0;
    for (const [a, b] of g.bends) if (d >= a - 12 && d <= b + 12) {
      const x = Math.min(d - (a - 12), b + 12 - d) / 30; f = Math.max(f, Math.min(1, x) ** 2 * (3 - 2 * Math.min(1, x)));
    }
    return g.wS + (g.wB - g.wS) * f;
  }
  const inBend = (g, d) => { d = ((d % g.len) + g.len) % g.len; return g.bends.some(([a, b]) => d >= a && d <= b); };

  // Jeden przejazd (pełny bieg albo bieg przerwany przez upadek): mijanki, ataki, klatki kluczowe
  function runPlan({ racers, finish, T, g, R, cut }) {
    const L = T / 4, lenTot = 4 * g.len, acc = 1.4, v = lenTot / (T - acc + acc * Math.exp(-T / acc));
    const leadM = t => v * (t - acc + acc * Math.exp(-t / acc));
    const timeAt = m => { let lo = 0, hi = T; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (leadM(mid) < m) lo = mid; else hi = mid; } return lo; };
    const startOrder = racers.slice().sort((a, b) => a.start - b.start).map(x => x.id);
    const byId = Object.fromEntries(racers.map(x => [x.id, x]));
    const defect = racers.filter(x => x.dnf === 'd');
    defect.forEach(x => { x.dnfAt = Math.min(T - 4, 8 + R() * (T - 14)); });
    // mijanki: minimalne zamiany sąsiadów (kolejność po starcie → meta)
    const cur = startOrder.filter(id => finish.includes(id)), swaps = [];
    for (let ch = true; ch;) { ch = false; for (let i = 0; i < cur.length - 1; i++) if (finish.indexOf(cur[i]) > finish.indexOf(cur[i + 1])) { swaps.push([cur[i + 1], cur[i]]); [cur[i], cur[i + 1]] = [cur[i + 1], cur[i]]; ch = true; } }
    // miejsca na mijankę: kolejne łuki (od drugiego łuku 1. okrążenia); wagi – najczęściej 1.–2. okrążenie
    const slots = [];
    for (let lap = 0; lap < 4; lap++) g.bends.forEach(([a, b], k) => { if (lap === 0 && k === 0) return; slots.push({ lap, k, entry: lap * g.len + a, exit: lap * g.len + b, w: [0.34, 0.27, 0.22, 0.17][lap] }); });
    // ścieżka zawodnika na cały bieg (tor jazdy w łukach): przy krawężniku, środkiem albo szeroko – według stylu jazdy
    const path = {};
    for (const x of racers) { const d = (x.style.outside ?? 10) - (x.style.inside ?? 10); path[x.id] = d > 1.5 ? 0.68 + R() * 0.14 : d < -1.5 ? 0.07 + R() * 0.07 : 0.27 + R() * 0.16; }
    // rodzaj ataku: szeroki – napędzanie się po zewnętrznej; przy krawężniku – wjazd pod rywala albo cutback (szerokie wejście, ciasne wyjście)
    const kindOf = id => (path[id] > 0.6 ? (R() < 0.85 ? 'outside' : 'cutback') : path[id] < 0.2 ? (R() < 0.55 ? 'inside' : 'cutback') : ['outside', 'cutback', 'inside'][Math.floor(R() * 3)]);
    const busy = {}, windows = [], last = {}; // last: zawodnik → indeks łuku jego ostatniej mijanki
    const campaign = (k, p, q, minT) => { // 1–2 łuki wcześniej zaczyna się pościg (gdy obaj wolni)
      for (let c = Math.min(k, 1 + Math.floor(R() * 2)); c > 0; c--) { const t0 = timeAt(slots[k - c].entry - 14); if (t0 > Math.max(busy[p] || 0, busy[q] || 0, minT)) return { c, t0 }; }
      return { c: 0, t0: null };
    };
    swaps.forEach(([p, q], n) => {
      const lp = last[p], lq = last[q];
      let minI = Math.max(lp == null ? 0 : lp.i + (lp.passer ? 0 : 1), lq == null ? 0 : lq.i + 1);
      const left = swaps.length - n - 1, maxI = Math.max(minI, slots.length - 1 - Math.ceil(left / 2));
      let k = minI;
      if (minI < slots.length) { let x = R() * slots.slice(minI, maxI + 1).reduce((s, o) => s + o.w, 0); while (k < maxI && x > slots[k].w) { x -= slots[k].w; k++; } }
      k = Math.min(k, slots.length - 1);
      const sl = slots[k], same = windows.filter(w => w.si === k).length, kind = kindOf(p);
      // podwójna mijanka w jednym łuku: druga ≥ 2 s po pierwszej i zaczyna się dopiero po niej
      const prevTp = Math.max(0, ...windows.filter(w => w.si === k).map(w => w.tp));
      // co najmniej 2,5 s między mijankami tego samego zawodnika; najpóźniej 4 s przed metą (2,5 s, gdy inaczej się nie da)
      const lastTp = Math.max(prevTp, ...windows.filter(w => [w.a, w.b].some(z => z === p || z === q)).map(w => w.tp));
      const want = Math.max(timeAt(kind === 'outside' ? sl.exit + 6 : kind === 'cutback' ? sl.exit - 3 : sl.entry + 12), lastTp ? lastTp + 2.5 : 0);
      const tp = Math.min(Math.max(T - 4, lastTp + 2.5), T - 2.5, want);
      const pre = Math.min(tp - 1.8, Math.max(kind === 'inside' ? tp - 2.4 : timeAt(sl.entry - 6), lastTp ? lastTp + 0.4 : 0));
      const cp = campaign(k, p, q, 4.5);
      const t0 = same ? pre - 0.3 : cp.c ? cp.t0 : Math.max(4.5, pre - 4, busy[p] || 0, busy[q] || 0);
      busy[p] = busy[q] = tp + 3;
      last[p] = { i: k, passer: true }; last[q] = { i: k, passer: false };
      windows.push({ type: 'pass', a: p, b: q, kind, outside: kind === 'outside', t0: Math.min(t0, pre - 0.5), pre, tp, post: Math.min(tp + 1.8, T - 0.5), lap: sl.lap, k: sl.k, si: k, chase: slots.slice(k - cp.c, k) });
    });
    const passes = windows.filter(w => w.type === 'pass');
    const orderAt = t => {
      const o = startOrder.slice();
      for (const w of passes) if (w.tp <= t) { const i = o.indexOf(w.a), j = o.indexOf(w.b); if (i > j) { o.splice(i, 1); o.splice(j, 0, w.a); } }
      return o.filter(id => !defect.some(d => d.id === id && t > d.dnfAt));
    };
    // ataki bez zmiany kolejności: wyrównana para, pościg przez 1–2 łuki i próba – rywal się obronił
    const raceOf = Object.fromEntries(racers.map(x => [x.id, x.race]));
    let attacks = 0;
    slots.forEach((sl, si) => {
      if (attacks >= 2 || R() > 0.3) return;
      const pre = timeAt(sl.entry - 6), tp = timeAt(sl.exit + 4);
      if (tp > T - 3 || (cut != null && tp > cut)) return;
      const o = orderAt(pre), oT = orderAt(tp + 6);
      const pairs = o.slice(1).map((id, i) => [id, o[i]]).filter(([a, b]) => Math.abs(raceOf[a] - raceOf[b]) < 1.1 && oT.indexOf(a) > oT.indexOf(b) && windows.every(w => !((w.a === a || w.b === a || w.a === b || w.b === b) && w.post + 3 > pre - 12 && w.t0 < tp + 6)));
      if (!pairs.length) return;
      const [a, b] = pairs[Math.floor(R() * pairs.length)];
      const cp = campaign(si, a, b, 4.5);
      busy[a] = busy[b] = tp + 6;
      windows.push({ type: 'attack', a, b, kind: kindOf(a), t0: cp.c ? cp.t0 : Math.max(4.5, pre - 4), pre, tp, post: tp + 2.2, lap: sl.lap, k: sl.k, si, chase: slots.slice(si - cp.c, si) });
      windows[windows.length - 1].outside = windows[windows.length - 1].kind === 'outside';
      attacks++;
    });
    windows.sort((a, b) => a.tp - b.tp);
    // błąd: wyniesienie w łuku i strata kilku metrów (zawodnik bez trwającej walki)
    const mistakes = [];
    if (R() < 0.4) {
      const sl = slots[Math.floor(R() * slots.length)], t1 = timeAt(sl.entry), t2 = timeAt(sl.exit);
      // tylko w łuku bez żadnej trwającej walki (korekta odstępów nie może ruszyć mijanki innych)
      const cand = windows.some(w => t2 + 6 > w.t0 - 2 && t1 - 4 < w.post + 3) ? [] : racers.filter(x => t2 < (cut ?? T) - 2 && !defect.some(d => d.id === x.id));
      if (cand.length) mistakes.push({ id: cand[Math.floor(R() * cand.length)].id, t1, t2, loss: 5 + R() * 5, k: sl.k });
    }
    // odstępy: trend z różnicy siły biegu + falowanie (raz goniący dojeżdża, raz traci), pościg, mijanka, atak
    const sm = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    const lerp = (a, b, k) => a + (b - a) * k;
    const pq = {};
    const pr = (a, b) => pq[a + '|' + b] || (pq[a + '|' + b] = { g0: 2.5 + R() * 3, ph1: R() * 6.28, ph2: R() * 6.28, amp: 0.7 + R() * 1.3 });
    const gapBase = (a, b, t) => {
      const q = pr(a, b), gF = Math.max(2, Math.min(60, 7 + 14 * (raceOf[a] - raceOf[b])));
      const tr = q.g0 + (gF - q.g0) * Math.min(1, t / T) ** 0.55;
      return Math.max(1.8, tr + q.amp * (1 + tr / 12) * (0.6 * Math.sin(2 * Math.PI * t / L + q.ph1) + 0.4 * Math.sin(2 * Math.PI * t / (0.55 * L) + q.ph2)));
    };
    const gapAt = (a, b, t) => { // a przed b
      const g0 = gapBase(a, b, t);
      for (const w of windows) {
        if (w.a === b && w.b === a && t >= w.t0 && t <= w.tp) {
          if (t < w.pre) return lerp(g0, 2.2, sm((t - w.t0) / Math.max(0.5, w.pre - w.t0)));
          return lerp(2.2, w.type === 'pass' ? 0.01 : 0.9, sm((t - w.pre) / Math.max(0.3, w.tp - w.pre)));
        }
        if (w.type === 'pass' && w.a === a && w.b === b && t > w.tp && t < w.tp + 6.5) return t < w.tp + 1.5 ? lerp(0.01, 1.4, sm((t - w.tp) / 1.5)) : lerp(1.4, Math.max(1.4, g0), sm((t - w.tp - 1.5) / 5));
        if (w.type === 'attack' && w.a === b && w.b === a && t > w.tp && t < w.tp + 6) return lerp(0.9, g0, sm((t - w.tp) / 6));
      }
      return g0;
    };
    // najmniejszy odstęp pary: przed mijanką może zejść do zera (koło w koło), po niej szybko rośnie – bez ponownego skrzyżowania
    const minGap = (a, b, t) => { const w = passes.find(x => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && t >= x.pre - 0.2 && t <= x.tp + 1.5); return !w ? 1.6 : t <= w.tp ? -9 : 0.15 + 0.85 * sm((t - w.tp) / 1.2); };
    const bendPos = d => { const x = ((d % g.len) + g.len) % g.len; for (const [a, b] of g.bends) if (x >= a && x <= b) return (x - a) / (b - a); return -1; };
    const keyT = new Set();
    for (let t = 0; t < T; t += 0.6) keyT.add(Math.round(t * 100) / 100);
    for (const w of windows) [w.t0, w.pre, w.tp, w.post].forEach(t => keyT.add(Math.round(t * 100) / 100));
    defect.forEach(d => [d.dnfAt, d.dnfAt + 3].forEach(t => keyT.add(Math.round(t * 100) / 100)));
    keyT.add(T);
    const frames = [...keyT].filter(t => t >= 0 && t <= (cut ?? T)).sort((a, b) => a - b).map(t => {
      const o = orderAt(t), off = {}, lane = {}, raw = {};
      if (t === 0) { racers.forEach(x => { off[x.id] = 0; lane[x.id] = LANE[x.gate]; }); return { t, off, lane }; }
      let accu = 0;
      o.forEach((id, i) => {
        if (i) accu += lerp(0.5 + 0.35 * i, gapAt(o[i - 1], id, t), sm(t / 4.5)); // start: zbita stawka, rozciąga się po pierwszym łuku
        raw[id] = accu;
        for (const m of mistakes) if (m.id === id && t > m.t1) raw[id] += m.loss * sm((t - m.t1) / (m.t2 - m.t1));
      });
      o.forEach((id, i) => { off[id] = i ? Math.max(raw[id], off[o[i - 1]] + minGap(o[i - 1], id, t)) : raw[id]; });
      for (const id of o) {
        const d = leadM(t) - off[id], bp = bendPos(d), inB = bp >= 0, base = path[id];
        const w = windows.find(x => (x.a === id || x.b === id) && t >= x.t0 && t <= x.post + 1.5);
        let ln = base;
        if (t < 3.2) ln = lerp(LANE[byId[id].gate] * 0.8 + 0.05, base, sm((t - 1) / 2.2));
        else if (w && w.a === id) {
          const atk = w.kind === 'outside' ? (inB ? 0.9 : 0.66) : w.kind === 'cutback' ? (inB ? 0.84 - 0.76 * bp : 0.25) : (inB ? 0.04 : Math.min(base, 0.18));
          ln = t < w.pre ? (inB ? lerp(base, atk, 0.8) : base) : atk; // pościg: w łukach przymierza się linią ataku
        } else if (w && w.b === id) ln = w.type === 'attack' && t > w.tp && w.kind === 'outside' ? Math.min(0.85, base + 0.22) : w.kind === 'inside' && base < 0.2 ? 0.3 : base;
        for (const m of mistakes) if (m.id === id && t >= m.t1 - 0.5 && t <= m.t2 + 0.5) ln = 0.9;
        lane[id] = ln;
      }
      for (const d of defect) if (t > d.dnfAt) { off[d.id] = null; lane[d.id] = -0.8; }
      return { t, off, lane };
    });
    return { L, startOrder, windows, passes, defect, mistakes, frames, orderAt, timeAt, leadM, path };
  }

  // Główna funkcja: h – bieg z gry (entries po runHeat: startPos, status, race; res; time), info – nazwiska, drużyny, wynik meczu
  function build(h, info) {
    const R = rng(info.seed || 'hs');
    const g = geometry(info.track || 350);
    const name = id => info.riders[id].short;
    const ents = h.entries.filter(e => e.riderId);
    const T0 = h.time || 60 + R() * 3;
    const tape = ents.filter(e => e.status === 't');
    const falls = ents.filter(e => e.status === 'u' || e.status === 'w');
    const resPos = Object.fromEntries(h.res.filter(x => x.pos).map(x => [x.riderId, x.pos]));
    const finish = h.res.filter(x => x.pos).sort((a, b) => a.pos - b.pos).map(x => x.riderId);
    const mk = list => list.map(e => ({ id: e.riderId, gate: e.gate, helmet: e.helmet, team: e.team, start: e.startPos ?? 9, race: e.race ?? 0, dnf: e.status === 'd' ? 'd' : null, style: info.riders[e.riderId].style }));
    const lines = [], used = new Set();
    const say = (t, text, kind = 'info', soft = false) => { if (soft && lines.some(l => Math.abs(l.t - t) < 2.2)) return; lines.push({ t, text, kind }); };
    const runs = [];
    say(-4, `Bieg ${h.no}: ${ents.map(e => `${name(e.riderId)} (${e.gate})`).join(', ')}.`, 'head');
    if (tape.length) say(-1.5, `Dotknięcie taśmy! ${tape.map(e => name(e.riderId)).join(', ')} – wykluczenie, bieg powtórzony bez tego zawodnika.`, 'key');
    let offset = 0;
    const racing = ents.filter(e => e.status !== 't' && e.status !== 'u' && e.status !== 'w');
    // upadek / wykluczenie: pierwszy przejazd przerwany czerwonym światłem, potem powtórka bez wykluczonych
    if (falls.length) {
      const all = ents.filter(e => e.status !== 't');
      const tf = 5 + R() * 14;
      const plan = runPlan({ racers: mk(all), finish: all.map(e => e.riderId).filter(id => !falls.some(f => f.riderId === id)).sort((a, b) => (resPos[a] ?? 9) - (resPos[b] ?? 9)), T: T0, g, R, cut: tf });
      runs.push({ from: 0, to: tf, plan, aborted: true, fallen: falls.map(f => f.riderId) });
      commentRun(plan, 0, tf, true);
      const f = falls[0], where = R() < 0.6 ? 'na wejściu w łuk' : 'na prostej przeciwległej';
      say(tf, f.status === 'w' ? `Upadek ${where} po kontakcie z rywalem! Czerwone światło – bieg przerwany.` : `Upadek! ${name(f.riderId)} leży ${where}. Czerwone światło – bieg przerwany.`, 'key');
      say(tf + 3, f.status === 'w' ? `Sędzia wyklucza ${name(f.riderId)} jako winnego. Powtórka bez tego zawodnika.` : `${name(f.riderId)} wykluczony – powtórka biegu bez niego.`, 'key');
      offset = tf + 9;
    }
    const plan = runPlan({ racers: mk(racing), finish, T: T0, g, R });
    runs.push({ from: offset, to: offset + T0, plan });
    commentRun(plan, offset, T0, false);
    const w = finish[0];
    const hs = { H: 0, A: 0 };
    h.res.forEach(x => { const e = ents.find(z => z.riderId === x.riderId); if (e && e.team && x.pts) hs[e.team] += x.pts; });
    if (w) say(offset + T0, `${name(w)} wygrywa bieg${h.time ? `, czas ${h.time.toFixed(2).replace('.', ',')} s` : ''}.`, 'key');
    if (info.teams) {
      const sc = info.score || { H: 0, A: 0 };
      say(offset + T0 + 2.2, `Bieg ${hs.H}:${hs.A}${hs.H === hs.A ? ' – remis' : ` – wygrywa ${hs.H > hs.A ? info.teams.H : info.teams.A}`}. W meczu ${info.teams.H} – ${info.teams.A} ${sc.H + hs.H}:${sc.A + hs.A}.`, 'score');
    }
    lines.sort((a, b) => a.t - b.t);
    for (let i = 1; i < lines.length; i++) if (lines[i].t < lines[i - 1].t + 1.8) lines[i].t = lines[i - 1].t + 1.8;
    return { T: offset + T0 + 3, runs, lines, finish, riders: info.riders, geo: g };

    // ---- relacja jednego przejazdu ----
    function commentRun(p, t0, T, aborted) {
      const L = p.L, so = p.startOrder, end = aborted ? T : t0 + T;
      const ldr = so[0], le = ents.find(e => e.riderId === ldr);
      const fav = racing.slice().sort((a, b) => info.riders[b.riderId].skill - info.riders[a.riderId].skill)[0];
      const one = arr => arr[Math.floor(R() * arr.length)];
      say(t0 + 0.2, t0 && !aborted ? 'Powtórka – taśma w górę!' : 'Taśma w górę!', 'info');
      say(t0 + 1.4, one([`Ze startu najszybciej ${name(ldr)}!`, `Świetny start – ${name(ldr)} pierwszy spod taśmy.`, `${name(ldr)} wyrywa najlepiej spod taśmy.`]) + (le && le.gate === 'D' ? ' I to z czwartego pola!' : ''), 'key');
      if (le && (le.gate === 'C' || le.gate === 'D') && R() < 0.75) say(t0 + 4, `${name(ldr)} zamknął wszystkich z ${GATE_NO[le.gate]} pola i pierwszy wchodzi w łuk.`, 'info');
      else if (so.length > 2 && R() < 0.6) say(t0 + 4, `Ciasno w pierwszym łuku – cała ${{ 2: 'dwójka', 3: 'trójka', 4: 'czwórka' }[so.length] || 'stawka'} koło w koło!`, 'info');
      else say(t0 + 4, `Po pierwszym łuku: ${so.map(name).join(', ')}.`, 'info');
      if (fav && so.indexOf(fav.riderId) === so.length - 1 && so.length > 2) say(t0 + 5.5, `Słabszy start faworyta – ${name(fav.riderId)} dopiero ostatni.`, 'info');
      const bendTxt = x => (x.k === 0 ? 'pierwszym' : 'drugim');
      for (const x of p.windows) {
        if (t0 + x.tp > end) continue;
        const A = name(x.a), B = name(x.b);
        // pościg przez kilka łuków: zbliżanie się z łuku na łuk, przymiarki linią ataku
        if (x.chase && x.chase.length) {
          say(t0 + x.t0 + 1, x.kind === 'outside' ? one([`${A} goni – szeroko przy bandzie, z każdym łukiem bliżej.`, `${A} odrabia straty po zewnętrznej, łuk po łuku.`]) : one([`${A} dojeżdża – szuka miejsca przy krawężniku.`, `${A} siedzi coraz bliżej, przymierza się do ataku.`]), 'info', true);
          if (x.chase.length > 1) say(t0 + p.timeAt(x.chase[x.chase.length - 1].exit), one([`Jeszcze nie tym razem – ${B} trzyma się z przodu.`, `${A} znów bliżej, ale ${B} nie odpuszcza.`]), 'info', true);
        }
        if (x.type === 'pass') {
          const posAfter = p.orderAt(x.tp + 0.01).indexOf(x.a) + 1, lead = posAfter === 1 ? ` ${A} prowadzi!` : '';
          if (x.kind === 'outside') {
            say(t0 + x.pre + 0.5, one([`${A} wybiera szeroką linię – napędza się po zewnętrznej w ${bendTxt(x)} łuku!`, `${A} rozpędza się przy bandzie, ${B} jedzie przy krawężniku.`, `${A} odbija szeroko, szuka prędkości po zewnętrznej.`]), 'info', true);
            say(t0 + x.tp, one([`…i na wyjściu z łuku ${A} jest już z przodu! Mijanka po zewnętrznej, ${B} na ${posAfter + 1}. miejscu.`, `${A} wyjeżdża z łuku szybciej i mija po zewnętrznej! ${B} na ${posAfter + 1}. miejscu.`, `Piękna akcja! ${A} objeżdża rywala po zewnętrznej – ${B} spada na ${posAfter + 1}. miejsce.`]) + lead, 'key');
          } else if (x.kind === 'cutback') {
            say(t0 + x.pre + 0.5, `${A} wchodzi w łuk szeroko…`, 'info', true);
            say(t0 + x.tp, one([`…i przecina pod rywalem na wyjściu! ${B} spada na ${posAfter + 1}. miejsce.`, `${A} ścina na wyjściu z łuku pod wyniesionego rywala! ${B} na ${posAfter + 1}. miejscu.`]) + lead, 'key');
          } else {
            say(t0 + x.pre, one([`${A} siedzi na tylnym kole – ${B} musi się bronić.`, `${A} coraz bliżej, szuka miejsca przy krawężniku.`]), 'info', true);
            say(t0 + x.tp, `${A} nurkuje przy krawężniku na wejściu w łuk! ${B} spada na ${posAfter + 1}. miejsce.` + lead, 'key');
          }
        } else {
          say(t0 + x.pre + 0.5, x.kind === 'outside' ? one([`${A} napędza się po zewnętrznej!`, `${A} jedzie szeroko przy bandzie, atakuje!`]) : x.kind === 'cutback' ? `${A} szeroko na wejściu – próbuje przeciąć na wyjściu!` : `${A} próbuje przy krawężniku!`, 'info', true);
          say(t0 + x.tp, one([`…ale ${B} zamyka drogę na wyjściu z łuku. Atak odparty.`, `${B} broni się skutecznie – zostaje z przodu.`, `Zabrakło metra – ${B} utrzymuje pozycję.`]), 'info');
        }
      }
      for (const m of p.mistakes || []) if (t0 + m.t2 < end) say(t0 + (m.t1 + m.t2) / 2, one([`${name(m.id)} wynosi szeroko w łuku – traci kilka metrów.`, `Błąd ${name(m.id)}! Szeroko na wyjściu z łuku, rywale bliżej.`]), 'key');
      for (const d of p.defect) if (t0 + d.dnfAt < end) say(t0 + d.dnfAt, `Defekt! ${name(d.id)} zwalnia i zjeżdża na murawę.`, 'key');
      for (let lap = 1; lap < 4; lap++) {
        const t = t0 + p.timeAt(lap * g.len);
        if (t > end - 1) break;
        const o = p.orderAt(t - t0);
        if (lap === 3) { say(t, `Ostatnie okrążenie! Prowadzi ${name(o[0])}.`, 'info'); continue; }
        const fr = p.frames.find(f => f.t >= t - t0) || p.frames[p.frames.length - 1];
        const gap = o.length > 1 && fr.off[o[1]] != null ? fr.off[o[1]] - fr.off[o[0]] : 0;
        const big = gap > 14 && !used.has('lapgap' + o[0]); if (big) used.add('lapgap' + o[0]);
        say(t, big ? `Koniec ${LAP_WORD[lap - 1]} okrążenia. ${name(o[0])} odjeżdża – kilkanaście metrów przewagi.` : gap > 14 ? `Koniec ${LAP_WORD[lap - 1]} okrążenia. ${name(o[0])} wciąż pewnie z przodu.` : gap < 4 && o.length > 1 ? `Koniec ${LAP_WORD[lap - 1]} okrążenia: ${name(o[0])} i ${name(o[1])} koło w koło!` : `Koniec ${LAP_WORD[lap - 1]} okrążenia, kolejność: ${o.map(name).join(', ')}.`, 'info');
      }
      const busyT = () => lines.filter(l => l.t >= t0 && l.t <= end).map(l => l.t);
      const teamName = k => (info.teams ? info.teams[k] : k);
      for (const t of [t0 + 9, t0 + 21, t0 + 35, t0 + 50].filter(t => t < end - 3)) {
        if (busyT().some(x => Math.abs(x - t) < 4.5)) continue;
        const o = p.orderAt(t - t0), fr = p.frames.find(f => f.t >= t - t0) || p.frames[p.frames.length - 1];
        const gap = i => (o[i + 1] != null && fr.off[o[i + 1]] != null && fr.off[o[i]] != null ? fr.off[o[i + 1]] - fr.off[o[i]] : 99);
        const cand = [];
        if (info.teams) {
          const sc = { H: 0, A: 0 };
          o.forEach((id, i) => { const e = ents.find(z => z.riderId === id); if (e && e.team) sc[e.team] += [3, 2, 1, 0][i]; });
          cand.push(['wynik', sc.H === sc.A ? `Na tę chwilę remis ${sc.H}:${sc.A}.` : `Na tę chwilę ${sc.H}:${sc.A} – prowadzi ${teamName(sc.H > sc.A ? 'H' : 'A')}.`]);
        }
        for (let i = 0; i < o.length - 1; i++) if (gap(i) < 4) cand.push(['walka' + i, i === 0 ? `${name(o[1])} cały czas tuż za ${name(o[0])} – walka o zwycięstwo!` : `Walka o ${i + 1}. miejsce: ${name(o[i])} i ${name(o[i + 1])} koło w koło.`]);
        if (gap(0) > 15 && gap(0) < 99) cand.push(['odjazd', one([`${name(o[0])} odjeżdża rywalom.`, `${name(o[0])} ma już bezpieczną przewagę.`])]);
        if (o.length > 2 && gap(o.length - 2) > 20 && gap(o.length - 2) < 99) cand.push(['tyl', `${name(o[o.length - 1])} traci kontakt ze stawką.`]);
        cand.push(['pewnie', one([`${name(o[0])} jedzie pewnie, pilnuje krawężnika.`, `${name(o[0])} prowadzi czystymi liniami.`, `Dobre tempo – tor trzyma, mało miejsca na mijanie.`])]);
        const fresh = cand.filter(([k]) => !used.has(k)), pool = fresh.length ? fresh : cand;
        const c = pool[Math.floor(R() * Math.min(2, pool.length))];
        used.add(c[0]);
        say(t, c[1], 'info');
      }
    }
  }

  // Stan w chwili t (do animacji): dystans od linii startu (m), tor jazdy 0–1 (ujemny – murawa), zatrzymanie
  function positions(S, t) {
    const run = S.runs.find(r => t >= r.from && t <= r.to + 8) || S.runs[S.runs.length - 1];
    const p = run.plan, lt = Math.max(0, Math.min(t - run.from, run.to - run.from));
    const fr = p.frames;
    let i = 0;
    while (i < fr.length - 2 && fr[i + 1].t < lt) i++;
    const a = fr[i], b = fr[Math.min(i + 1, fr.length - 1)], w = b.t > a.t ? Math.min(1, Math.max(0, (lt - a.t) / (b.t - a.t))) : 1;
    const a0 = fr[Math.max(0, i - 1)], b1 = fr[Math.min(fr.length - 1, i + 2)];
    // Catmull-Rom: ciągła prędkość między klatkami (bez szarpnięć); przy brakach (defekt) – liniowo
    const cr = (p0, p1, p2, p3) => (p0 == null || p3 == null ? p1 + (p2 - p1) * w : 0.5 * (2 * p1 + (-p0 + p2) * w + (2 * p0 - 5 * p1 + 4 * p2 - p3) * w * w + (-p0 + 3 * p1 - 3 * p2 + p3) * w * w * w));
    const lead = p.leadM(lt), out = {};
    for (const d of p.defect) if (lt > d.dnfAt) { // defekt: zwalnia ok. 3 s (ok. 20 m) i zjeżdża na murawę
      const f0 = fr.find(f => f.t >= d.dnfAt && f.off[d.id] != null) || fr[0], k = Math.min(1, (lt - d.dnfAt) / 3);
      out[d.id] = { dist: Math.max(0, p.leadM(d.dnfAt) - (f0.off[d.id] || 0)) + 20 * (1 - (1 - k) ** 2), lane: 0.3 - 1.1 * k, stopped: k >= 1 };
    }
    for (const id of Object.keys(a.off)) {
      if (out[id]) continue;
      const oa = a.off[id], ob = b.off[id];
      if (oa == null && ob == null) { out[id] = { gone: true, dist: null }; continue; }
      const off = oa == null ? ob : ob == null ? oa : cr(a0.off[id], oa, ob, b1.off[id]);
      const la = a.lane[id] ?? 0.5, lb = b.lane[id] ?? 0.5;
      out[id] = { dist: Math.max(0, lead - off), lane: cr(a0.lane[id] ?? la, la, lb, b1.lane[id] ?? lb), stopped: ob == null };
    }
    return { run, out, lt };
  }

  return { build, positions, geometry, widthAt, inBend };
})();
