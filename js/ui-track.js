'use strict';
// Ekrany toru (model: js/track.js): Klub → Tor (plan przygotowania toru na mecze domowe), próba toru w zapowiedzi meczu,
// stan toru i polecenia dla toromistrza w przerwach technicznych w meczu na żywo.

const TP_MIN = 0.1, TP_MAX = 0.9;
const tpVal = x => Math.round((clamp(x, TP_MIN, TP_MAX) - TP_MIN) / (TP_MAX - TP_MIN) * 100);
const tpOf = v => round2(TP_MIN + v / 100 * (TP_MAX - TP_MIN));
const lanesTxt = p => LANE_NAMES.map((n, l) => `${n}: <b>${laneWord(clamp(p.g[l] + (p.moist - 0.5) * SURF_MOIST, 0, 1))}</b>`).join(' · ');
const rutsWord = x => (x < 0.12 ? 'równy' : x < 0.3 ? 'lekkie koleiny' : x < 0.5 ? 'koleiny' : 'koleiny i dziury');
const moistWord = x => (x < 0.3 ? 'suchy' : x < 0.45 ? 'przesychający' : x < 0.62 ? 'wilgotny' : x < 0.8 ? 'mocno polany' : 'bardzo mokry');

// Zawody, na które gracz może przygotować tor: mecze domowe, sparingi u siebie, zawody PZM na naszym stadionie
function trackTargets(c) {
  const S = sportSeason();
  const out = [{ key: '', name: 'Plan domyślny klubu', sub: 'mecze bez osobnego planu, sparingi i zawody PZM na naszym torze' }];
  for (const f of Object.values(G.fixtures).filter(f => f.homeId === c.id && !f.played && !f.matchId && f.season === S).sort(by(f => f.date)))
    out.push({ key: f.id, name: `${fmtDateShort(f.date)} · ${G.clubs[f.awayId].name}`, sub: `${LEAGUES[f.league].name}, ${fxLabel(f)}`, f });
  for (const s of Object.values(G.sparings || {}).filter(s => s.homeId === c.id && !s.match && ['agreed', 'invite', 'pending'].includes(s.status)).sort(by(s => s.date)))
    out.push({ key: 'S' + s.id, name: `${fmtDateShort(s.date)} · sparing z ${G.clubs[s.awayId].name}`, sub: 'sparing (bez komisarza toru)', s });
  if (typeof hostedEvents === 'function') for (const ev of hostedEvents(c, S).filter(e => !e.played && !(typeof isFimEvent === 'function' && isFimEvent(e))))
    out.push({ key: 'E:' + ev.id, name: `${fmtDateShort(ev.date)} · ${ev.name}`, sub: 'zawody PZM – tor zbliżony do neutralnego (sędzia, komisarz toru)', ev });
  return out;
}
function tpCurrent(c, key) {
  if (UI.tp && UI.tp.key === key && UI.tp.club === c.id) return UI.tp;
  const T = G.trackPlan || {}, p = (key && T.fx && T.fx[key]) || T.def || trackUsual(c.id);
  UI.tp = { key, club: c.id, g: p.g.slice(), moist: p.moist, own: !!(key ? T.fx && T.fx[key] : T.def) };
  return UI.tp;
}
function tpLineups(t) {
  if (t.f) return { H: validLineup(G.clubId, G.lineups[G.clubId] || autoLineup(G.clubId, t.f.date), t.f.date), A: notifiedLine(t.f, t.f.awayId) || autoLineup(t.f.awayId, t.f.date) };
  if (t.s) return { H: sparLineup(G.clubId, t.s.date, t.s.lineup), A: autoLineup(t.s.awayId, t.s.date) };
  return null;
}
function trackPage(c, arg) {
  const mine = c.id === G.clubId, u = trackUsual(c.id), q = staffBest(c.id, 'track'), fac = (c.facilities && c.facilities.training) || 1;
  const tm = clubStaff(c.id).filter(x => x.role === 'track');
  const info = `<div class="panel"><h3>Tor na co dzień</h3><div class="kv">
      <div>Toromistrz</div><div>${tm.map(x => `${esc(x.name)} (przygotowanie toru ${x.attrs.track})`).join(', ') || '<span class="neg">brak – tor przygotowuje obsługa stadionu</span>'}</div>
      <div>Infrastruktura toru</div><div>${fac}/5 <span class="small muted">(sprzęt do konserwacji, nawierzchnia)</span></div>
      <div>Profil toru</div><div>${lanesTxt(u)} <span class="small muted">· ${esc(surfLabel(u))}</span></div>
      <div>Komisarz toru</div><div class="small">obowiązkowy w Ekstralidze, 2. Ekstralidze i KLŻ – pilnuje toru regulaminowego, w przerwach kontroluje nawierzchnię</div></div>
    <p class="small muted">Zawodnicy gospodarzy trenują na tym torze na co dzień: pełny atut własnego toru mają, gdy tor na mecz jest przygotowany podobnie. Profil zmienia się powoli – po każdym meczu domowym przesuwa się w stronę toru, który klub przygotowuje.</p></div>`;
  if (!mine) return info;
  const targets = trackTargets(c), key = arg ? decodeURIComponent(arg) : '', t = targets.find(x => x.key === key) || targets[0];
  const p = tpCurrent(c, t.key), fx = surfFx({ g: p.g, moist: p.moist, ruts: 0 });
  const league = t.f, narrow = !!t.ev, kom = league ? komisarzClamp(p) : { over: 0 };
  const gates = Object.entries(fx.gate).sort(by(([, v]) => v, -1));
  const fam = trackFamiliarity(p, u);
  const L = tpLineups(t), bal = L ? planBalance(c.id, L.H, L.A, p) : null;
  const slider = (i, label, val, lo, hi) => `<label class="fld">${label}: <b>${i < 3 ? laneWord(clamp(p.g[i] + (p.moist - 0.5) * SURF_MOIST, 0, 1)) : moistWord(p.moist)}</b>
      <input type="range" min="0" max="100" step="1" value="${val}" onchange="ACT.tpSlide(${i}, +this.value)"><span class="small muted">${lo} ↔ ${hi}</span></label>`;
  const list = `<div class="panel flush"><div class="ph"><h3>Zawody na naszym torze</h3></div><table class="t"><tbody>${targets.map(x => {
    const own = x.key ? G.trackPlan && G.trackPlan.fx && G.trackPlan.fx[x.key] : G.trackPlan && G.trackPlan.def;
    return `<tr class="${x.key === t.key ? 'sel' : ''}"><td><a href="#/klub/tor/${encodeURIComponent(x.key)}">${esc(x.name)}</a><div class="small muted">${esc(x.sub)}</div></td><td class="small">${own ? esc(surfLabel(own)) : `<span class="muted">${x.key ? 'plan domyślny' : 'profil codzienny'}</span>`}</td></tr>`; }).join('')}</tbody></table></div>`;
  const editor = `<div class="panel stack"><h3>${esc(t.name)}</h3>
      <div class="chip-row"><span class="chip-lbl">Gotowe profile</span>${Object.entries(TRACK_PRESETS).map(([k, x]) => `<span class="chip" onclick="ACT.tpPreset('${k}')">${esc(x.name)}</span>`).join('')}<span class="chip ghost" onclick="ACT.tpPreset('usual')">Jak na co dzień</span></div>
      ${slider(0, 'Przy krawężniku', tpVal(p.g[0]), 'twardo, wybity', 'głęboko, grząsko')}
      ${slider(1, 'Środek toru', tpVal(p.g[1]), 'twardo', 'głęboko')}
      ${slider(2, 'Zewnętrzna', tpVal(p.g[2]), 'twardo', 'dużo materiału (szeroka ścieżka)')}
      ${slider(3, 'Polewanie przed zawodami', tpVal(p.moist), 'sucho', 'mocno polany')}
      <div class="row wrap"><button class="btn primary" onclick="ACT.tpSave()">Zapisz ${t.key ? 'plan na te zawody' : 'plan domyślny'}</button>
        ${t.key && G.trackPlan && G.trackPlan.fx && G.trackPlan.fx[t.key] ? '<button class="btn" onclick="ACT.tpClear()">Użyj planu domyślnego</button>' : ''}
        ${!t.key && G.trackPlan && G.trackPlan.def ? '<button class="btn" onclick="ACT.tpClear()">Bez planu – sztab przygotowuje tor sam</button>' : ''}
        ${L ? '<button class="btn ghost" onclick="ACT.tpSuggest()">Propozycja sztabu</button>' : ''}</div>
      ${UI.tp.dirty ? '<p class="small warn">Zmiany niezapisane.</p>' : ''}</div>`;
  const preview = `<div class="panel"><h3>Czego się spodziewać</h3><div class="kv">
      <div>Tor</div><div>${esc(surfLabel(p))}</div>
      <div>Charakter</div><div class="small">${fx.hard > 0.15 ? 'twardy – start decyduje, mniej mijanek, szybkie czasy; liczą się silniki „na prędkość”' : fx.deep > 0.15 ? 'głęboki – więcej mijanek i walki, wolniejsze czasy, częstsze upadki; liczą się silniki z momentem' : 'przyczepny – wyrównana walka na starcie i na dystansie'}${fx.slope > 0.12 ? '; materiał na zewnętrznej premiuje jazdę szeroką ścieżką' : fx.slope < -0.12 ? '; twarda zewnętrzna premiuje jazdę przy krawężniku' : ''}</div>
      <div>Pola startowe</div><div class="small">${gates.map(([g, v], i) => `${i ? ' › ' : ''}<b>${g}</b>`).join('')} <span class="muted">(od najlepszego; pola wynikają z nawierzchni na prostej startowej)</span></div>
      <div>Atut własnego toru</div><div>${Math.round(fam * 100)}% <span class="small muted">${fam < 0.9 ? '– tor inny niż na treningach' : '– zawodnicy znają taki tor'}</span></div>
      ${bal ? `<div>Dopasowanie: my</div><div>${bal.home >= 0 ? '+' : ''}${(bal.home * 100).toFixed(0)}</div><div>Dopasowanie: rywal</div><div>${bal.away >= 0 ? '+' : ''}${(bal.away * 100).toFixed(0)}</div>
        ${Math.abs(bal.luck) > 0.005 ? `<div>Losowość toru</div><div class="${bal.luck > 0 ? 'pos' : 'neg'}">${bal.luck > 0 ? '+' : '−'}${Math.abs(bal.luck * 100).toFixed(0)} <span class="small muted" style="font-weight:400">(twardy tor sprzyja silniejszym, głęboki – słabszym)</span></div>` : ''}
        ${bal.famLoss > 0.005 ? `<div>Utrata atutu toru</div><div class="neg">−${(bal.famLoss * 100).toFixed(0)}</div>` : ''}
        <div>Bilans</div><div class="${bal.net > 0.02 ? 'pos' : bal.net < -0.02 ? 'neg' : ''}">${fitWord(bal.net)}</div>` : ''}</div>
      ${kom.over > 0.005 ? `<p class="small warn">Komisarz toru nie dopuści takiego toru – nakaże korektę (dopuszczalny materiał i polewanie mieszczą się w ok. ${tpVal(KOMISARZ.lo)}–${tpVal(KOMISARZ.hi)} na suwakach).</p>` : ''}
      ${narrow ? '<p class="small muted">Na zawodach PZM sędzia i komisarz toru pilnują toru zbliżonego do neutralnego: plan zostanie złagodzony, a o pracach w przerwach decyduje sędzia.</p>' : ''}
      <p class="small muted">Dopasowanie liczone ze stylu jazdy zawodników składu (start, mijanie, jazda po zewnętrznej i przy krawężniku, jazda na trudnych nawierzchniach) i silników (moment / prędkość). Tor wyjdzie tym bliżej planu, im lepszy toromistrz i infrastruktura; pogoda (upał, słońce, deszcz) zmienia wilgotność.</p></div>`;
  return `<div class="grid g2" style="margin-bottom:16px">${editor}${preview}</div><div class="grid g2">${list}${info}</div>`;
}
ACT.tpSlide = (i, v) => { const p = UI.tp; if (!p) return; if (i < 3) p.g[i] = tpOf(v); else p.moist = tpOf(v); p.dirty = true; render(); };
ACT.tpPreset = k => { const p = UI.tp; if (!p) return; const x = k === 'usual' ? trackUsual(p.club) : TRACK_PRESETS[k]; p.g = x.g.slice(); p.moist = x.moist; p.dirty = true; render(); };
ACT.tpSave = () => {
  const p = UI.tp; if (!p) return;
  const T = G.trackPlan = G.trackPlan || {}, plan = { g: p.g.map(round2), moist: round2(p.moist) };
  if (p.key) (T.fx = T.fx || {})[p.key] = plan; else T.def = plan;
  p.dirty = false; toast('Plan przygotowania toru zapisany – toromistrz dostał wytyczne.', 'good'); changed();
};
ACT.tpClear = () => {
  const p = UI.tp, T = G.trackPlan; if (!p || !T) return;
  if (p.key) { if (T.fx) delete T.fx[p.key]; } else delete T.def;
  UI.tp = null; changed();
};
ACT.tpSuggest = () => {
  const p = UI.tp; if (!p) return;
  const t = trackTargets(G.clubs[p.club]).find(x => x.key === p.key), L = t && tpLineups(t);
  if (!L) return;
  const s = aiTrackPlan(p.club, L.H, L.A, 'ui' + p.key + G.date);
  p.g = s.g.slice(); p.moist = s.moist; p.dirty = true;
  toast('Sztab proponuje profil toru – ocena zależy od taktyki trenerów.', 'good'); render();
};

// ---------- Zapowiedź meczu / sparingu: tor i próba toru ----------
function trackPrepPanel(key, homeId, awayId, line) {
  const mineH = homeId === G.clubId, ids = line.filter(id => id && G.riders[id]);
  const sel = G.trackTest && G.trackTest[key], cur = sel || aiTesters(line);
  const plan = mineH ? userPlanFor(key) : null;
  const opt = j => `<select onchange="ACT.ttSet('${key}', ${j}, +this.value || 0)"><option value="">— nikt —</option>${ids.map(id => { const r = G.riders[id];
    return `<option value="${id}" ${cur[j] === id ? 'selected' : ''}>${esc(r.name)} (dopasowanie sprzętu ${r.attrs.setup ?? '?'}, wiedza tech. ${r.attrs.techKnowledge ?? '?'})</option>`; }).join('')}</select>`;
  return `<div class="panel" style="margin-bottom:16px"><div class="ph" style="padding:0 0 8px"><h3>Tor i próba toru</h3>${mineH ? `<a class="btn sm" href="#/klub/tor/${encodeURIComponent(key)}">Przygotowanie toru →</a>` : ''}</div><div class="kv">
      <div>Przygotowanie</div><div>${mineH ? (plan ? `${esc(surfLabel(plan))} <span class="small muted">(${G.trackPlan.fx && G.trackPlan.fx[key] ? 'plan na ten mecz' : 'plan domyślny klubu'})</span>` : '<span class="muted">sztab przygotuje tor sam (pod nasz skład)</span>') : `<span class="muted">tor przygotowuje gospodarz; na co dzień:</span> <span class="small">${lanesTxt(trackUsual(homeId))}</span>`}</div>
      <div>Próba toru</div><div class="row wrap">${opt(0)}${opt(1)}${sel ? '' : '<span class="small muted">wybór sztabu</span>'}</div></div>
    <p class="small muted">Próba toru: 30 min przed zawodami, po 2 zawodników drużyny, 2 sesje po 1,5 min, bez startów spod taśmy. Zawodnicy z wysokim Dopasowaniem sprzętu i wiedzą techniczną przywiozą dokładniejszy raport – drużyna trafniej dobierze silniki. Kosztuje to trochę kondycji i zużycia silnika.${mineH ? '' : ' Na wyjeździe próba jest najważniejszym źródłem wiedzy o torze.'}</p></div>`;
}
ACT.ttSet = (key, j, id) => {
  const T = G.trackTest = G.trackTest || {};
  const cur = (T[key] || []).slice(); cur[j] = id || null;
  T[key] = [cur[0], cur[1]].filter((x, i, a) => x && a.indexOf(x) === i);
  changed();
};

// ---------- Mecz na żywo: stan toru, raport z próby, polecenia w przerwie ----------
function matchTrackPanel(m, mineTeam) {
  const S = m.surf;
  if (!S) return '';
  const know = m.know && mineTeam && m.know[mineTeam] != null ? m.know[mineTeam] : 0.5;
  const read = trackReading(S, know, m.id + ':' + m.heats.length);
  const wins = { A: 0, B: 0, C: 0, D: 0 };
  for (const h of m.heats) { const w = (h.res || []).find(x => x.pos === 1), e = w && h.entries.find(x => x.riderId === w.riderId); if (e && wins[e.gate] != null) wins[e.gate]++; }
  let brk = '';
  if (m.pendingBreak && !m.done) {
    if (S.ctl === 'H' && mineTeam === 'H') {
      const o = m.breakOrders || aiBreakOrders(S, S.plan);
      const chip = (k, v, label) => `<span class="chip ${o[k] === v ? 'on' : ''}" onclick="ACT.brSet('${k}', ${typeof v === 'string' ? `'${v}'` : v})">${label}</span>`;
      brk = `<div class="next-heat" style="margin-top:10px;padding:10px"><b>Przerwa techniczna po biegu ${m.pendingBreak}${longBreak(m, m.pendingBreak) ? ' (długa, 10 min)' : ''} – polecenia dla toromistrza</b>
        <div class="chip-row" style="margin-top:6px"><span class="chip-lbl">Polewanie</span>${chip('water', 0, 'bez polewania')}${chip('water', 1, 'lekko')}${chip('water', 2, 'mocno')}</div>
        <div class="chip-row" style="margin-top:4px"><span class="chip-lbl">Materiał</span>${chip('mat', 'in', 'zgarnąć do krawężnika')}${chip('mat', 'keep', 'tylko równać')}${chip('mat', 'out', 'zostawić szeroką ścieżkę')}</div>
        <div class="small muted" style="margin-top:4px">${m.breakOrders ? 'Polecenia trenera.' : 'Propozycja toromistrza (wraca do planu przygotowania).'} Przerwa trwa najwyżej 5 min – tor zmieni się tylko trochę; komisarz toru może nakazać dodatkową korektę.</div></div>`;
    } else brk = `<div class="small muted" style="margin-top:8px">Przerwa techniczna po biegu ${m.pendingBreak}: równanie toru – ${S.ctl === 'H' ? 'decyduje gospodarz' : 'decyduje sędzia / komisarz toru'}.</div>`;
  }
  const report = mineTeam && m.testReport && m.testReport[mineTeam];
  const hist = (m.breaks || []).map(b => `po ${b.after}.: ${BREAK_WATER[b.water || 0]}, ${BREAK_MAT[b.mat] || ''} <span class="muted">(${b.by})</span>`).join('<br>');
  return `<div class="panel" style="margin-bottom:12px"><h3>Tor</h3><div class="kv">
      <div>Stan${know < 0.6 ? ' (ocena)' : ''}</div><div>${LANE_NAMES.map((n, l) => `${n}: <b>${laneWord(read[l])}</b>`).join(' · ')} <span class="small muted">· ${rutsWord(S.ruts || 0)}${S.rain ? ', mokry' : ''}</span></div>
      ${m.heats.length ? `<div>Wygrane z pól</div><div class="small">${Object.entries(wins).map(([g, n]) => `${g}: <b>${n}</b>`).join(' · ')}</div>` : ''}
      ${report ? `<div>Próba toru</div><div class="small" style="font-weight:400">${esc(report)}</div>` : mineTeam && m.trackTest && m.trackTest[mineTeam] && !m.trackTest[mineTeam].length ? '<div>Próba toru</div><div class="small muted">drużyna nie brała udziału</div>' : ''}
      ${S.note && mineTeam === 'H' ? `<div>Komisarz toru</div><div class="small warn">${esc(S.note)}</div>` : ''}
      ${hist ? `<div>Prace torowe</div><div class="small" style="font-weight:400">${hist}</div>` : ''}</div>${brk}</div>`;
}
ACT.brSet = (k, v) => {
  const { m } = liveMatch();
  if (!m || !m.surf || !m.pendingBreak) return;
  m.breakOrders = { ...(m.breakOrders || aiBreakOrders(m.surf, m.surf.plan)), [k]: v };
  render();
};
