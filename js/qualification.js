'use strict';
// Obsada zawodów mistrzowskich według reguł kwalifikacji i nominacji (paczka data/qualification: SPEEDWAY_QUALIFICATION,
// funkcje SpeedwayQualification). Listę startową buduje js/competitions.js (buildStartList): najpierw zawodnicy z reguł
// (awanse z etapów, rozstawieni, gospodarz, ścieżki nominacji federacji), resztę uzupełnia indField jako nominacje i dzikie karty.

const QP = typeof SPEEDWAY_QUALIFICATION !== 'undefined' ? SPEEDWAY_QUALIFICATION : null;
const QA = typeof SpeedwayQualification !== 'undefined' ? SpeedwayQualification : null;
// Łączna liczba awansujących, gdy ustala ją GKSŻ komunikatem (count: null): około połowy stawki finału
const QUAL_DEFAULT_ADVANCE = 10;
// Nominacje GKSŻ do zawodów FIM/FIME, gdy liczbę miejsc ustala komunikat (np. Brązowy Kask → IME U19)
const QUAL_DEFAULT_NOMINATIONS = 4;

// Etap paczki dla zawodów gry: { code, comp, stage } albo null
function qualStage(ev) {
  if (!QP || !QA || !ev || ev.kind !== 'comp') return null;
  const comp = QA.competition(QP, ev.comp);
  if (!comp) return null;
  const code = Object.keys(QP.competitions).find(k => QP.competitions[k] === comp);
  let id;
  if (ev.comp === 'SGPQ') id = /Challenge/.test(ev.name) ? 'challenge' : 'qr';
  else if (ev.comp === 'SECQ') id = /ECC|Challenge/.test(ev.name) ? 'challenge' : 'qr';
  else if (comp.stages.some(s => s.id === 'semi') && comp.stages.some(s => s.id === 'final') && comp.stages.every(s => !s.comp || s.comp === ev.comp)) id = ev.stage === 'finał' ? 'final' : 'semi';
  else id = (comp.stages.find(s => s.comp === ev.comp) || comp.stages[comp.stages.length - 1]).id;
  const stage = comp.stages.find(s => s.id === id);
  return stage ? { code, comp, stage } : null;
}
// Zawody gry należące do etapu paczki w sezonie
function qualStageEvents(code, stageId, season) {
  return Object.values(G.events).filter(e => e.kind === 'comp' && e.season === season && !e.cancelled && (q => q && q.code === code && q.stage.id === stageId)(qualStage(e))).sort(by(e => e.date));
}
const qualPlayed = e => e.played && !e.cancelled && e.matchId && G.matches[e.matchId] && G.matches[e.matchId].classification;
const qualOrder = e => G.matches[e.matchId].classification.map(c => c.riderId);
// Klasyfikacja zawodów w sezonie: cykl – tabela cyklu, pojedyncze zawody – finał (ostatnie rozegrane)
function qualCompOrder(code, season) {
  if (code === 'SGP') return G.sgp && G.sgp.season === season ? seriesOrder('SGP', season).map(Number) : [];
  const t = COMPS[code] && COMPS[code].series && G.series && G.series[`${season}-${code}`];
  if (t && Object.keys(t).length) return seriesOrder(code, season).map(id => (isNaN(id) ? id : Number(id))); // remisy: js/ties.js
  const evs = Object.values(G.events).filter(e => e.comp === code && e.season === season && qualPlayed(e)).sort(by(e => e.date));
  const fin = evs.filter(e => e.stage === 'finał');
  const last = (fin.length ? fin : evs).slice(-1)[0];
  return last ? qualOrder(last) : [];
}
// Stali uczestnicy Grand Prix w sezonie (numery 1–15)
const qualSgpPermanent = season => new Set(G.sgp && G.sgp.season === season ? G.sgp.riders.slice(0, 15).map(String) : []);
// Klub gospodarza zawodów (miasto w nazwie toru)
const qualHostClub = ev => Object.values(G.clubs).find(c => ev.venue && c.city && ev.venue.includes(c.city.replace(' Wlkp.', '')));

// Zawodnicy z reguł dla zawodów: { list: [{id, via}], exclude: Set, closed: Set (kraje z obsadą wyłącznie z nominacji), sources: [zawody] }
function qualEntrants(ev) {
  const q = qualStage(ev);
  if (!q) return null;
  const S = ev.season, out = [], sources = [];
  const exclude = new Set((q.stage.exclude || []).some(x => x.rule === 'sgpPermanent') ? qualSgpPermanent(S) : []);
  // nominacje federacji do kilku rund jednego etapu: zawodnik startuje tylko w jednej z nich
  if ((q.stage.entrants || []).some(e => e.type === 'federationEntry' || e.type === 'clubEntry' || e.type === 'nomination'))
    for (const x of qualStageEvents(q.code, q.stage.id, S)) if (x.id !== ev.id && x.startList) for (const s of x.startList) exclude.add(String(s.id));
  const add = (id, via) => { if (id != null && R(id) && !exclude.has(String(id)) && !out.some(o => String(o.id) === String(id))) { out.push({ id, via }); return true; } return false; };
  const before = e => e.date < ev.date && e.id !== ev.id;
  // awans: z każdych zawodów źródłowych (per event) albo z łącznej klasyfikacji
  const advance = (events, rule, label) => {
    const done = events.filter(qualPlayed);
    sources.push(...events);
    if (!done.length) return;
    const total = rule.count ?? (rule.places ? null : QUAL_DEFAULT_ADVANCE);
    const perEvent = rule.per === 'event' || (!rule.places && done.length > 1);
    const n = rule.places ? rule.places[1] - rule.places[0] + 1 : perEvent ? Math.max(2, Math.round(total / done.length)) : total;
    for (const e of done) {
      let k = 0;
      for (const [i, id] of qualOrder(e).entries()) {
        if (k >= n) break;
        if (rule.places && i < rule.places[0] - 1) continue;
        const tag = (e.name.match(/\(([^)]*)\)$/) || [])[1] || (e.name.match(/QR\d|SF\d|ECC/) || [])[0] || '';
        if (add(id, `${label}${tag ? ` ${tag}` : ''}: ${i + 1}. m.`)) k++; // wykluczony lub już na liście – miejsce przechodzi na kolejnego
      }
      if (!perEvent) break;
    }
  };
  for (const e of q.stage.entrants || []) {
    if (e.type === 'fromStage') advance(qualStageEvents(q.code, e.stage, S).filter(before), e, `awans: ${((q.comp.stages.find(s => s.id === e.stage) || {}).name || e.stage).toLowerCase()}`);
    else if (e.type === 'fromComp' && (e.seasonOffset || 0) === 0) {
      const evs = Object.values(G.events).filter(x => x.season === S && before(x) && (z => z && z.code === e.comp && (!e.stage || z.stage.id === e.stage))(qualStage(x)));
      advance(evs.sort(by(x => x.date)), e, `awans z ${COMPS[e.comp] ? COMPS[e.comp].short : e.comp}`);
    } else if (e.type === 'fromComp' || (e.type === 'seeded' && e.rule === 'prevClassification')) {
      const off = e.seasonOffset ?? -1, ord = qualCompOrder(e.comp, S + off);
      const [a, b] = e.places || [1, 1];
      ord.slice(a - 1, b).forEach((id, i) => add(id, `${COMPS[e.comp] ? COMPS[e.comp].short : e.comp} ${S + off}: ${a + i}. miejsce`));
    } else if (e.type === 'seeded' && e.rule === 'sgpPermanent') {
      for (const id of qualSgpPermanent(S)) { const r = G.riders[id]; if (r && (q.comp.country !== 'POL' || polEligible(r)) && r.clubId) add(Number(id), 'stały uczestnik Grand Prix'); }
    } else if (e.type === 'seeded' && e.rule === 'sgpQualifyingParticipant') {
      for (const x of Object.values(G.events).filter(x => x.comp === e.comp && x.season === S && before(x) && x.startList)) for (const s of x.startList) { const r = G.riders[s.id]; if (r && polEligible(r)) add(s.id, `uczestnik eliminacji ${COMPS[e.comp].short}`); }
    }
  }
  // gospodarz: zawodnik klubu organizatora (najlepszy z etapu źródłowego) w miejsce ostatniego awansującego
  if ((q.stage.entrants || []).some(e => e.type === 'host' && e.rule === 'hostClubRider')) qualHostFix(ev, out, sources);
  // ścieżki nominacji federacji (np. Złoty Kask → eliminacje GP i SEC): nominowani rozdzieleni między zawody etapu
  const closed = new Set();
  for (let p of QA.pathwaysTo(QP, q.code)) {
    if (p.country !== 'POL') continue; // w grze rozgrywane są zawody krajowe tylko w Polsce
    const tgt = (Array.isArray(p.to) ? p.to : [p.to]).find(t => t.comp === q.code && (!t.stage || t.stage === q.stage.id) && (t.seasonOffset || 0) === 0);
    if (!tgt) continue;
    const src = Object.values(G.events).filter(x => x.season === S && x.date < ev.date && qualPlayed(x) && (z => z && z.code === p.from.comp && (!p.from.stage || z.stage.id === p.from.stage))(qualStage(x))).sort(by(x => x.date)).slice(-1)[0];
    if (!src) continue;
    const sgp = qualSgpPermanent(S);
    if (p.count == null && !p.from.places) p = { ...p, count: QUAL_DEFAULT_NOMINATIONS }; // liczbę miejsc ustala GKSŻ komunikatem
    const res = QA.applyPathway(p, qualOrder(src).filter(id => G.riders[id] && polEligible(G.riders[id])), { season: S,
      skip: (id, rule) => rule === 'sgpPermanent' ? sgp.has(String(id)) : rule === 'secSeeded' ? qualCompOrder('SEC', S - 1).slice(0, 6).map(String).includes(String(id)) : false,
      coachPick: n => qualCoachPicks(n, S, p, q) });
    const all = [...res.nominated.map(id => [id, `nominacja GKSŻ: ${src.name.replace(/^Finał /, '')}`]), ...res.coachPicks.map(id => [id, 'nominacja trenera kadry'])];
    const evs = qualStageEvents(q.code, q.stage.id, S), k = Math.max(0, evs.findIndex(x => x.id === ev.id));
    const free = (id, x) => (!G.riders[id] || available(G.riders[id], x.date)) && !busyOn(x.date, x.id).has(String(id));
    all.forEach(([id, via], i) => {
      if (evs.length <= 1) return add(id, via);
      const slot = [0, 1, 2, 3, 4, 5].slice(0, evs.length).map(d => (i + d) % evs.length).find(j => free(id, evs[j]));
      if ((slot ?? i % evs.length) === k) add(id, via);
    });
    closed.add('POL');
  }
  return { code: q.code, stage: q.stage.id, list: out, exclude, closed, sources };
}
// Wybór trenera kadry: najlepsi polscy zawodnicy spoza nominowanych (kadra seniorów najpierw)
function qualCoachPicks(n, season, pathway, q) {
  const sq = typeof squadOf === 'function' ? new Set(squadOf('POL', season).sen.map(String)) : new Set();
  const sgp = qualSgpPermanent(season);
  const src = Object.values(G.events).filter(x => x.season === season && qualPlayed(x) && x.comp === pathway.from.comp).slice(-1)[0];
  const done = new Set(src ? qualOrder(src).slice(0, pathway.from.places ? pathway.from.places[1] : 0).map(String) : []);
  return Object.values(G.riders).filter(r => r.active && !r.retired && polEligible(r) && r.clubId && !sgp.has(String(r.id)) && !done.has(String(r.id)) && (q.comp.eligibility?.ageMax == null || ageIn(r, season) <= q.comp.eligibility.ageMax))
    .sort(by(r => r.skill + (sq.has(String(r.id)) ? 1 : 0), -1)).slice(0, n).map(r => r.id);
}
// Miejsce gwarantowane klubowi organizatora (IMP, MIMP): gdy w stawce nie ma jego zawodnika – najlepszy z etapu źródłowego
function qualHostFix(ev, list, sources) {
  const c = qualHostClub(ev);
  if (!c || list.some(x => R(x.id) && R(x.id).clubId === c.id)) return;
  let best = null;
  for (const e of (sources || []).filter(qualPlayed)) for (const id of qualOrder(e)) { const r = G.riders[id]; if (r && r.clubId === c.id && !list.some(x => String(x.id) === String(id))) { best = best || id; break; } }
  if (!best) { const r = Object.values(G.riders).filter(r => r.clubId === c.id && r.active && polEligible(r)).sort(by(r => r.skill, -1))[0]; best = r && r.id; }
  if (!best) return;
  const i = list.map(x => /awans/.test(x.via)).lastIndexOf(true);
  const entry = { id: best, via: `miejsce klubu organizatora (${c.short})` };
  if (i >= 0) list.splice(i, 1, entry); else list.push(entry);
}
// Zawody źródłowe dla terminu ogłoszenia listy startowej (lista dzień po ostatnich z nich)
function qualSources(ev) {
  const q = qualStage(ev);
  if (!q) return [];
  const S = ev.season, out = [];
  for (const e of q.stage.entrants || []) {
    if (e.type === 'fromStage') out.push(...qualStageEvents(q.code, e.stage, S));
    if (e.type === 'fromComp' && (e.seasonOffset || 0) === 0) out.push(...Object.values(G.events).filter(x => x.season === S && (z => z && z.code === e.comp && (!e.stage || z.stage.id === e.stage))(qualStage(x))));
  }
  for (const p of QA.pathwaysTo(QP, q.code)) if (p.country === 'POL') out.push(...Object.values(G.events).filter(x => x.season === S && (z => z && z.code === p.from.comp && (!p.from.stage || z.stage.id === p.from.stage))(qualStage(x))));
  return out.filter(x => x.date < ev.date && x.id !== ev.id);
}
// Stawka Grand Prix na sezon (FIM): 7 najlepszych poprzedniego cyklu, 4 z GP Challenge, mistrz Europy; resztę nominuje SGP commission
// via: { id: droga kwalifikacji } – opis na liście uczestników (js/ui-comps.js)
function sgpQualifiedFor(season, via = {}) {
  const ok = id => G.riders[id] && G.riders[id].active && !G.riders[id].retired && !fimSuspended(G.riders[id].country, `${season}-03-01`);
  const out = [], add = (id, lab) => { if (ok(id) && !out.includes(id)) { out.push(id); via[id] = lab; } };
  const rule = QP && QP.competitions.SGP.stages[0].entrants;
  const top = (rule && rule.find(e => e.comp === 'SGP' && e.rule === 'prevClassification') || { places: [1, 7] }).places[1];
  if (G.sgp && G.sgp.season === season - 1) Object.entries(G.sgp.standings).sort(by(([, p]) => p, -1)).slice(0, top).forEach(([id], i) => add(Number(id), `GP ${season - 1}: ${i + 1}. miejsce`));
  const ch = Object.values(G.events).filter(e => e.season === season - 1 && qualPlayed(e) && (q => q && q.code === 'SGPQ' && q.stage.id === 'challenge')(qualStage(e)))[0];
  if (ch) { let n = 0; qualOrder(ch).forEach((id, i) => { if (n < 4 && ok(id) && !out.includes(id)) { add(id, `GP Challenge ${season - 1}: ${i + 1}. miejsce`); n++; } }); }
  qualCompOrder('SEC', season - 1).slice(0, 1).forEach(id => add(Number(id) || id, `mistrz Europy ${season - 1}`));
  return out;
}
// MPPK: kolejność par w finale (gospodarz, 1–4 PGE i zwycięzca 2. Ekstraligi z poprzedniego sezonu, najlepsza pozostała para poprzedniego finału)
function mppkFinalUnits(ev, units, n) {
  const S = ev.season, out = [];
  const add = u => { if (u && !out.includes(u) && out.length < n) out.push(u); };
  const byClub = id => units.find(u => u.clubId === id);
  const host = qualHostClub(ev);
  if (host) add(byClub(host.id));
  const table = lg => (typeof leagueTable === 'function' ? leagueTable(lg, S - 1) : []).filter(r => r.m > 0);
  table('PGE').slice(0, 4).forEach(r => add(byClub(r.clubId)));
  table('2E').slice(0, 1).forEach(r => add(byClub(r.clubId)));
  const prev = Object.values(G.events).filter(e => e.comp === 'MPPK' && e.season === S - 1 && qualPlayed(e))[0];
  if (prev) for (const c of G.matches[prev.matchId].classification) { const u = units.find(x => x.key === c.key); if (u && !out.includes(u)) { add(u); break; } }
  for (const u of units.slice().sort(by(u => u.str, -1))) add(u); // pierwszy sezon gry lub brak tabel – najmocniejsze pary
  return out;
}
// MPPK: para i rezerwowy – zawodnicy kadry z najwyższą średnią z poprzedniego sezonu, najwyżej 1 zagraniczny
function mppkOrder(c, rs) {
  const S = sportSeason(), avg = r => { const a = prevLeagueAvg(r, S); return a != null ? a : r.skill / 6; };
  const sorted = rs.slice().sort(by(avg, -1)), out = [];
  for (const r of sorted) if (isDomestic(r, c.id) || !out.some(x => !isDomestic(x, c.id))) out.push(r);
  return out.concat(sorted.filter(r => !out.includes(r)));
}
// Etykieta zawodników uzupełniających stawkę (indField) według regulaminu etapu
function qualFillLabel(ev) {
  const q = qualStage(ev);
  if (!q) return null;
  const es = q.stage.entrants || [];
  const w = es.find(e => e.type === 'wildcard'), f = es.find(e => e.type === 'federationEntry'), n = es.find(e => e.type === 'nomination'), c = es.find(e => e.type === 'clubEntry');
  if (f) return 'nominacja federacji';
  if (c) return 'zgłoszenie klubu';
  if (n) return n.role === 'permanentWildcard' ? 'stała dzika karta (komisja SGP)' : `nominacja: ${n.by}`;
  if (w) return `dzika karta ${w.by}`;
  return 'nominacja organizatora';
}

// Miejsca nominowane osobno na każdą rundę cyklu (SGP2: dzika karta i 2 rezerwy toru federacji gospodarza) oraz liczba stałych nominacji
function qualEventSlots(ev) {
  const q = qualStage(ev);
  if (!q) return null;
  const es = q.stage.entrants || [];
  const w = es.find(e => e.type === 'wildcard' && e.per === 'event'), t = es.find(e => e.type === 'trackReserve' && e.per === 'event');
  if (!w && !t) return null;
  return { wc: w ? w.count || 1 : 0, tr: t ? t.count || 2 : 0, nom: es.filter(e => e.type === 'nomination').reduce((a, e) => a + (e.count || 0), 0) };
}
// Dzika karta i rezerwy toru rundy: najlepsi dostępni zawodnicy kraju gospodarza (limit wieku zawodów), w braku – najlepsi pozostali
function qualEventExtras(ev, list) {
  const sl = qualEventSlots(ev);
  if (!sl) return null;
  const cc = sgpHostCountry(ev), fed = cc ? ((NATION_INFO[cc] || {}).fed || COUNTRY[cc] || cc) : 'federacja gospodarza';
  const short = fed.match(/\(([^)]+)\)\s*$/)?.[1] || fed;
  const busy = busyOn(ev.date, ev.id), taken = new Set(list.map(x => String(x.id)));
  const pool = Object.values(G.riders).filter(r => r.active && !r.retired && available(r, ev.date) && !busy.has(String(r.id)) && !taken.has(String(r.id))
    && ageOkFor(ev, r.id) && ageLimitOk(ev, r.id) && !fimSuspended(r.country, ev.date)).sort(by(r => r.skill, -1));
  const home = pool.filter(r => cc && r.country === cc), picks = home.length >= sl.wc + sl.tr ? home : home.concat(pool.filter(r => !home.includes(r)));
  return { wildcards: picks.slice(0, sl.wc).map(r => r.id), reserves: picks.slice(sl.wc, sl.wc + sl.tr).map(r => r.id), label: `dzika karta – ${short}`, country: cc };
}
// ---------- Grand Prix: dzika karta i rezerwy toru na każdą rundę ----------
// Nominuje federacja kraju gospodarza (FMNR) z organizatorem: dzika karta (nr 16) – najlepszy zawodnik kraju spoza stałych
// uczestników albo zawodnik miejscowego klubu (także obcokrajowiec: Kvěch – Wrocław 2025, Huckenbeck – Gorzów 2025);
// rezerwy toru (nr 17–18) – zawodnicy miejscowego klubu w dowolnym wieku (Łódź 2026: seniorzy Orła Nowak i Szlauderbach),
// a bez nich najlepsi zawodnicy kraju (Landshut 2026: Wölbert, Grobauer; Ryga: Mihailovs, Kostigovs). Na podstawie obsad
// rund SGP 2025–2026 (Wikipedia). Wybór zapisany w zawodach (ev.sgpExtras); ogłoszenie ok. 30 dni przed rundą.
const SGP_EXTRAS_DAYS = 30;
const sgpHostCountry = ev => { const g = typeof geoOf === 'function' ? geoOf(ev.venue) : null; return g ? g[2] : null; };
function sgpRoundExtras(ev, force) {
  if (ev.sgpExtras && !force) return ev.sgpExtras;
  if (!G.sgp) return null;
  const perm = new Set(G.sgp.riders.slice(0, 15).map(String));
  const cc = sgpHostCountry(ev), club = qualHostClub(ev);
  const busy = typeof busyOn === 'function' ? busyOn(ev.date, ev.id) : new Set();
  const ok = r => r.active && !r.retired && !perm.has(String(r.id)) && available(r, ev.date) && !busy.has(String(r.id)) && !fimSuspended(r.country, ev.date) && !u16(r, ev.date);
  const local = r => !!club && r.clubId === club.id;
  // kandydaci: zawodnicy kraju gospodarza; w rundach w Polsce dziką kartę może dostać też obcokrajowiec miejscowego klubu
  // (Kvěch – Sparta, Wrocław 2025; Huckenbeck – Stal, Gorzów 2025). Rezerwy toru zawsze z kraju gospodarza.
  const home = r => !cc || r.country === cc;
  let cands = Object.values(G.riders).filter(r => ok(r) && (home(r) || (cc === 'POL' && local(r))));
  if (cands.length < 3) cands = cands.concat(Object.values(G.riders).filter(r => ok(r) && !cands.includes(r)).sort(by(r => r.skill, -1)).slice(0, 3 - cands.length));
  const wc = cands.slice().sort(by(r => r.skill + (r.form || 0) * 0.3 + (local(r) ? 1.5 : 0), -1))[0];
  // rezerwy toru: najpierw zawodnicy miejscowego klubu (dowolny wiek – seniorzy, U24 albo juniorzy), potem najlepsi zawodnicy kraju gospodarza
  const trPool = cands.filter(r => r !== wc && home(r));
  const tr = (trPool.length >= 2 ? trPool : cands.filter(r => r !== wc)).sort(by(r => (local(r) ? 100 : 0) + r.skill + (r.form || 0) * 0.2, -1)).slice(0, 2);
  ev.sgpExtras = { wildcard: wc ? wc.id : null, trackReserves: tr.map(r => r.id), country: cc, clubId: club ? club.id : null, announced: G.date };
  return ev.sgpExtras;
}
// Obsada rundy: 15 stałych (nieobecnych zastępują zawodnicy z listy zastępców, potem rezerwy toru) + dzika karta
function sgpRoundField(ev) {
  const perm = G.sgp.riders.slice(0, 15), subs = (G.sgp.reserves || []).slice();
  const busy = typeof busyOn === 'function' ? busyOn(ev.date, ev.id) : new Set();
  const free = id => id != null && G.riders[id] && available(G.riders[id], ev.date) && !fimSuspended(G.riders[id].country, ev.date) && !busy.has(String(id));
  // stali uczestnicy: zawody FIM mają pierwszeństwo przed krajowymi i ligą tego dnia (tam jadą rezerwowi / zawodnik zastępowany)
  const permFree = id => id != null && G.riders[id] && available(G.riders[id], ev.date) && !fimSuspended(G.riders[id].country, ev.date);
  let ex = sgpRoundExtras(ev);
  if (ex && ex.wildcard != null && !free(ex.wildcard)) ex = sgpRoundExtras(ev, true); // kontuzja lub inny start – nowa nominacja
  const field = perm.map(id => {
    if (permFree(id)) return id;
    const sub = subs.find(x => free(x) && (!ex || x !== ex.wildcard));
    if (sub) { subs.splice(subs.indexOf(sub), 1); return sub; }
    return null;
  });
  const tr = (ex ? ex.trackReserves : []).filter(id => free(id) && !field.includes(id));
  for (let i = 0; i < field.length; i++) if (field[i] == null) field[i] = tr.shift() ?? perm[i];
  const wc = ex && free(ex.wildcard) && !field.includes(ex.wildcard) ? ex.wildcard : tr.shift();
  if (wc != null) field.push(wc);
  return field;
}
