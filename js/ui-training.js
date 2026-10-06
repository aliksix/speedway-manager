'use strict';
// Ekrany treningu: trendy atrybutów, wykres atrybutów w czasie (filtr, kilka serii), panel treningu zawodnika,
// zakładka Sztab → Trening (fazy, jakość treningu, baza szkoleniowa), profile trenerów.

// ---------- Trend atrybutu (strzałka przy wartości) ----------
// Tylko u własnych zawodników i adeptów – szczegóły rozwoju zna wyłącznie nasz sztab
function attrTrendHtml(x, k) {
  if (!x || x.clubId !== G.clubId || typeof attrTrend !== 'function') return '';
  const t = attrTrend(x, k);
  if (!t || Math.abs(t.d) < 0.2) return '';
  // cienka strzałka jak w FM: skośna (45°) – wzrost / spadek, pionowa – dynamiczna zmiana
  const up = t.d > 0, big = Math.abs(t.d) >= 0.6;
  const path = big ? (up ? 'M6 11V1.5M2.5 5L6 1.5 9.5 5' : 'M6 1v9.5M2.5 7L6 10.5 9.5 7') : (up ? 'M2 10L10 2M4.5 2H10v5.5' : 'M2 2l8 8M10 4.5V10H4.5');
  return `<svg class="trend ${up ? 'up' : 'down'}" viewBox="0 0 12 12" aria-label="${up ? 'wzrost' : 'spadek'}"><path d="${path}"/></svg>`;
}

// ---------- Wykres atrybutów w czasie ----------
// Kolory kategoryczne (zwalidowane na tle panelu #151b25): kolor przypisany do cechy przy wyborze i stały, dopóki jest wybrana
const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
UI.attrSel = UI.attrSel || ['ca'];
UI.attrCol = UI.attrCol || { ca: 0 };
const ATTR_LABEL = Object.fromEntries([...Object.values(ATTRS).flatMap(g => g.list), ...EXTRA_ATTRS.list, ['ca', 'CA (skala ÷ 5)']]);
function seriesColor(k) {
  if (UI.attrCol[k] == null) {
    const used = new Set(UI.attrSel.map(x => UI.attrCol[x]));
    UI.attrCol[k] = [0, 1, 2, 3, 4, 5, 6, 7].find(i => !used.has(i)) ?? 7;
  }
  return SERIES_COLORS[UI.attrCol[k]];
}
ACT.attrSeries = k => {
  const i = UI.attrSel.indexOf(k);
  if (i >= 0) { if (UI.attrSel.length > 1) { UI.attrSel.splice(i, 1); delete UI.attrCol[k]; } }
  else if (UI.attrSel.length >= 8) return toast('Najwyżej 8 serii na wykresie – odznacz którąś cechę.', 'bad');
  else { UI.attrSel.push(k); seriesColor(k); }
  render();
};
ACT.attrSeriesTop = id => {
  const x = G.riders[id] || G.academy[id];
  const rows = attrChartRows(x);
  if (rows.length < 2) return;
  const a = rows[0].v, b = rows[rows.length - 1].v;
  const top = ATTR_KEYS.filter(k => a[k] != null && b[k] != null).sort(by(k => Math.abs(b[k] - a[k]), -1)).slice(0, 4);
  UI.attrSel = ['ca', ...top]; UI.attrCol = { ca: 0 };
  UI.attrSel.forEach(seriesColor);
  render();
};
ACT.attrSeriesGroup = g => {
  UI.attrSel = ATTRS[g].list.map(l => l[0]).slice(0, 8); UI.attrCol = {};
  UI.attrSel.forEach(seriesColor);
  render();
};
// Wiersze wykresu: miesiące z historii (CA także z wcześniejszych pomiarów) + stan obecny
function attrChartRows(x) {
  const rows = new Map();
  const caHist = x.hist ? x.hist.map(h => [h.d.slice(0, 7), h.s]) : (x.progress || []).map(p => [p.d.slice(0, 7), p.a / 5]);
  for (const [d, v] of caHist) rows.set(d, { d, v: { ca: v } });
  for (const p of attrHistSeries(x)) { const row = rows.get(p.d) || { d: p.d, v: {} }; Object.assign(row.v, p.v); row.v.ca = p.v.ca / 5; rows.set(p.d, row); }
  const list = [...rows.values()].sort(by(r => r.d));
  const now = { d: 'teraz', v: { ca: x.ca / 5 } };
  for (const k of [...ATTR_KEYS, ...EXTRA_ATTRS.list.map(l => l[0])]) if (x.attrs[k] != null) now.v[k] = x.attrs[k];
  list.push(now);
  return list;
}
const monthLabel = d => d === 'teraz' ? 'teraz' : `${['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'][Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`;
function attrChart(x) {
  const rows = attrChartRows(x);
  const sel = UI.attrSel.filter(k => k === 'ca' || x.attrs[k] != null);
  sel.forEach(seriesColor);
  const chips = `<div class="chip-groups"><div class="chip-row"><button class="chip ${sel.includes('ca') ? 'on' : ''}" onclick="ACT.attrSeries('ca')">${sel.includes('ca') ? `<i style="background:${seriesColor('ca')}"></i>` : ''}CA</button>
      <button class="chip ghost" onclick="ACT.attrSeriesTop('${x.id}')" title="CA i 4 cechy, które zmieniły się najbardziej">największe zmiany</button>
      ${Object.entries(ATTRS).map(([g, d]) => `<button class="chip ghost" onclick="ACT.attrSeriesGroup('${g}')">${esc(d.name.toLowerCase())}</button>`).join('')}</div>
    ${Object.values(ATTRS).map(g => `<div class="chip-row"><span class="chip-lbl">${esc(g.name)}</span>${g.list.map(([k, n]) => `<button class="chip ${sel.includes(k) ? 'on' : ''}" onclick="ACT.attrSeries('${k}')">${sel.includes(k) ? `<i style="background:${seriesColor(k)}"></i>` : ''}${esc(n)}</button>`).join('')}</div>`).join('')}</div>`;
  if (rows.length < 2) return chips + '<div class="muted small">Za mało danych – wykres pojawi się po pierwszym miesiącu gry.</div>';
  const w = 640, h = 230, L = 34, R = sel.length <= 4 ? 118 : 12, T = 10, B = 24;
  const vals = sel.flatMap(k => rows.map(r => r.v[k]).filter(v => v != null));
  let lo = Math.floor(Math.min(...vals) - 0.5), hi = Math.ceil(Math.max(...vals) + 0.5);
  if (hi - lo < 4) { const m = (hi + lo) / 2; lo = Math.floor(m - 2); hi = Math.ceil(m + 2); }
  lo = Math.max(0, lo); hi = Math.min(21, hi);
  const X = i => L + (i / (rows.length - 1)) * (w - L - R), Y = v => T + (1 - (v - lo) / (hi - lo)) * (h - T - B);
  const step = Math.max(1, Math.round((hi - lo) / 4));
  const ticks = []; for (let t = Math.ceil(lo); t <= hi; t += step) ticks.push(t);
  const paths = sel.map(k => {
    let d = '', pen = false;
    rows.forEach((r, i) => { const v = r.v[k]; if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; });
    return `<path d="${d}" fill="none" stroke="${seriesColor(k)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  // podpisy bezpośrednie na końcu linii (do 4 serii), rozsunięte, żeby się nie nakładały
  let labels = '';
  if (sel.length <= 4) {
    const ends = sel.map(k => ({ k, y: Y(rows[rows.length - 1].v[k] ?? lo) })).sort(by(e => e.y));
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
    labels = ends.map(e => `<circle cx="${X(rows.length - 1)}" cy="${Y(rows[rows.length - 1].v[e.k] ?? lo)}" r="3.5" fill="${seriesColor(e.k)}" stroke="var(--panel)" stroke-width="2"/><text x="${X(rows.length - 1) + 8}" y="${e.y + 4}" class="lbl">${esc(e.k === 'ca' ? 'CA' : ATTR_LABEL[e.k])}</text>`).join('');
  }
  const xl = [0, Math.floor((rows.length - 1) / 2), rows.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const data = { x: rows.map((r, i) => [X(i), monthLabel(r.d)]), s: sel.map(k => ({ n: k === 'ca' ? 'CA' : ATTR_LABEL[k], c: seriesColor(k), v: rows.map(r => r.v[k] == null ? null : (k === 'ca' ? round1(r.v[k] * 5) : round1(r.v[k]))), y: rows.map(r => r.v[k] == null ? null : Y(r.v[k])) })) };
  return `${chips}<div class="chart mchart" data-chart='${esc(JSON.stringify(data))}'>
    <svg viewBox="0 0 ${w} ${h}" onmousemove="ACT.chartMove(event, this)" onmouseleave="ACT.chartLeave(this)">
      ${ticks.map(t => `<line x1="${L}" x2="${w - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="#242d3b"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
      ${xl.map(i => `<text x="${X(i)}" y="${h - 6}" text-anchor="${i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}">${esc(monthLabel(rows[i].d))}</text>`).join('')}
      ${paths}${labels}<g class="hover" style="display:none"><line y1="${T}" y2="${h - B}" stroke="#5d6b80" stroke-dasharray="3 3"/></g>
      <rect x="${L}" y="${T}" width="${w - L - R}" height="${h - T - B}" fill="transparent"/></svg><div class="tip" style="display:none"></div></div>
    ${sel.length > 4 ? `<div class="legend">${sel.map(k => `<span><i style="background:${seriesColor(k)}"></i>${esc(ATTR_LABEL[k])}</span>`).join('')}</div>` : ''}
    <p class="small muted">Skala atrybutów 1–20; CA pokazane jako CA ÷ 5. Punkty: pomiar na początku każdego miesiąca i stan obecny.</p>`;
}
ACT.chartMove = (ev, svg) => {
  const box = svg.closest('.mchart'), d = JSON.parse(box.dataset.chart);
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  let i = 0; for (let j = 1; j < d.x.length; j++) if (Math.abs(d.x[j][0] - p.x) < Math.abs(d.x[i][0] - p.x)) i = j;
  const g = svg.querySelector('.hover');
  g.style.display = ''; g.querySelector('line').setAttribute('x1', d.x[i][0]); g.querySelector('line').setAttribute('x2', d.x[i][0]);
  g.querySelectorAll('circle').forEach(c => c.remove());
  for (const s of d.s) if (s.y[i] != null) g.insertAdjacentHTML('beforeend', `<circle cx="${d.x[i][0]}" cy="${s.y[i]}" r="4" fill="${s.c}" stroke="#151b25" stroke-width="2"/>`);
  const tip = box.querySelector('.tip');
  tip.innerHTML = `<b>${esc(d.x[i][1])}</b>${d.s.map(s => `<div><i style="background:${s.c}"></i>${esc(s.n)}<b>${s.v[i] == null ? '—' : String(s.v[i]).replace('.', ',')}</b></div>`).join('')}`;
  tip.style.display = '';
  const r = svg.getBoundingClientRect(), xPx = (d.x[i][0] / svg.viewBox.baseVal.width) * r.width;
  tip.style.left = `${Math.min(xPx + 14, r.width - tip.offsetWidth - 4)}px`;
  if (xPx + 14 + tip.offsetWidth > r.width) tip.style.left = `${Math.max(0, xPx - tip.offsetWidth - 14)}px`;
};
ACT.chartLeave = svg => { svg.querySelector('.hover').style.display = 'none'; svg.closest('.mchart').querySelector('.tip').style.display = 'none'; };

// ---------- Panel treningu zawodnika (zakładka Rozwój) ----------
const GROUP_SHORT = { tech: 'Technika', mental: 'Mentalne', physical: 'Fizyczne', workshop: 'Warsztat' };
const qLabel = q => q >= 1.25 ? ['bardzo dobra', 'pos'] : q >= 1.1 ? ['dobra', 'pos'] : q >= 0.95 ? ['przeciętna', ''] : q >= 0.8 ? ['słaba', 'warn'] : ['bardzo słaba', 'neg'];
function trainingPanel(x) {
  const ph = trainingPhase(), infl = clubInfluence(x), cat = trainCat(x);
  const rows = Object.keys(ATTRS).map(g => {
    const q = trainQuality(x, g), [l, cls] = qLabel(q), win = ph.win[g] / WIN_NORM[g];
    return `<tr><td>${GROUP_SHORT[g]}</td><td style="width:110px">${bar(q - 0.4, 1, cls === 'neg' || cls === 'warn' ? 'var(--warn)' : null)}</td><td class="${cls}">${l}</td><td class="small muted">${win >= 1.6 ? 'okno teraz otwarte ▲' : win <= 0.4 ? 'poza oknem' : 'normalnie'}</td></tr>`;
  }).join('');
  let trainers = '';
  if (x.clubId && G.clubs[x.clubId]) {
    const rel = ROLE_REL[cat];
    const st = clubStaff(x.clubId).filter(s => rel[s.role] >= 0.5 && s.profile).sort(by(s => rel[s.role], -1)).slice(0, 4);
    const fit = k => attrAffinity(x, k, true) > 1.15;
    trainers = st.map(s => {
      const v = staffProfileView(s), keys = Object.keys(TRAIN_PROFILES[s.profile.main].attrs);
      const match = keys.filter(k => x.attrs[k] != null && fit(k)).map(k => ATTR_LABEL[k].toLowerCase());
      return `<div class="row small" style="gap:8px;margin:4px 0"><a href="#/osoba/${s.id}">${esc(s.name)}</a><span class="muted">${esc(STAFF_ROLES[s.role].name.toLowerCase())}</span><span class="pill" style="text-transform:none">${esc(v.main.name)}</span>${match.length && x.clubId === G.clubId ? `<span class="pos" title="Trener pracuje nad cechami, do których zawodnik ma naturalne predyspozycje – rozwijają się szybciej">pasuje do stylu: ${esc(match.slice(0, 2).join(', '))}</span>` : ''}</div>`;
    }).join('');
  }
  const wk = x.dev && x.dev.wk;
  return `<div class="kv"><div>Faza roku</div><div><b>${esc(ph.name)}</b><div class="small muted">${esc(ph.desc)}</div></div>
      <div>Wpływ klubu</div><div>${Math.round(infl * 100)}%<div class="small muted">${infl >= 0.85 ? 'zawodnik trenuje głównie w klubie' : infl >= 0.55 ? 'część czasu spędza w innych ligach – trenuje też z własnym sztabem' : 'gwiazda kilku lig – klub ma ograniczony wpływ, liczy się jego prywatny sztab'}</div></div></div>
    <table class="t" style="margin-top:10px"><thead><tr><th>Obszar</th><th colspan="2">Jakość treningu</th><th>Okno</th></tr></thead><tbody>${rows}</tbody></table>
    ${trainers ? `<h4 style="margin:12px 0 4px">Trenerzy</h4>${trainers}` : ''}
    ${wk && x.clubId === G.clubId ? `<p class="small muted" style="margin-top:8px">Ostatni tydzień (${fmtDateShort(wk.d)}): ${Object.entries(wk.g).filter(([, v]) => Math.abs(v) >= 0.005).map(([g, v]) => `${GROUP_SHORT[g].toLowerCase()} ${v > 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}`).join(' · ') || 'bez zmian'} CA.</p>` : ''}`;
}

// ---------- Sztab → Trening ----------
const FAC_INFO = [
  ['training', 'Tor i zaplecze treningowe', 'Technika jazdy: treningi torowe i sparingi.'],
  ['gym', 'Centrum przygotowania motorycznego', 'Atrybuty fizyczne – zwłaszcza zimą; hamuje spadek formy fizycznej weteranów.'],
  ['miniTrack', 'Tor do miniżużla', 'Technika adeptów 50–125 cm³; bez niego miniżużel trenuje tylko na wyjazdach.'],
  ['academy', 'Obiekty szkółki', 'Technika adeptów 250–500 cm³, nabór do szkółki.'],
  ['workshop', 'Warsztat / park maszyn', 'Warsztat zawodników, serwis sprzętu.'],
];
const FAC_LABEL = { workshop: 'warsztat / park maszyn', academy: 'szkółka', training: 'obiekty treningowe', gym: 'centrum przygotowania motorycznego', miniTrack: 'tor do miniżużla' };
function sztabTraining() {
  const c = myClub(), ph = trainingPhase();
  const cats = [['senior', 'Seniorzy'], ['junior', 'Juniorzy'], ['academy', 'Szkółka 250–500'], ['mini', 'Miniżużel']];
  const cell = (cat, g) => {
    const t = clubTraining(c.id, cat), q = t.q[g], [l, cls] = qLabel(q), lead = G.staff[t.lead[g]];
    return `<td><span class="${cls}"><b>${l}</b></span><div class="small muted">${lead ? esc(lead.name) : 'brak trenera'}${t.cov[g] < 1 ? ` · <span class="warn">przeciążony (${catSize(c.id, cat)} os.)</span>` : ''}</div></td>`;
  };
  const phases = ['off', 'winter', 'pre', 'season'].map(id => { const p = TRAIN_PHASES[id]; return `<div class="phase ${ph.id === id ? 'on' : ''}"><b>${esc(p.name)}</b><div class="small">${{ off: '15.10–30.11', winter: '1.12–28.02', pre: '1.03–10.04', season: '11.04–14.10' }[id]}</div><div class="small muted">${esc(p.desc)}</div>
    <div class="small">${Object.keys(ATTRS).map(g => { const w = p.win[g] / WIN_NORM[g]; return `<span class="${w >= 1.6 ? 'pos' : w <= 0.4 ? 'muted' : ''}">${GROUP_SHORT[g].toLowerCase()} ×${w.toFixed(1).replace('.', ',')}</span>`; }).join(' · ')}</div></div>`; }).join('');
  const fac = FAC_INFO.map(([k, n, d]) => `<tr><td><b>${n}</b><div class="small muted">${d}</div></td><td class="num">${c.facilities[k] ?? 0} / 5</td><td><button class="btn sm" onclick="ACT.arm(this, 'upgrade', '${k}')" ${(c.facilities[k] ?? 0) >= 5 ? 'disabled' : ''}>Rozbuduj (${fmtMoney(COSTS[k](c.facilities[k] ?? 0), true)})</button></td></tr>`).join('');
  const missing = TRAIN_ROLES.filter(r => !clubStaff(c.id).some(s => s.role === r)).map(r => STAFF_ROLES[r].name.toLowerCase());
  return `<div class="panel"><h3>Rok treningowy</h3><div class="phases">${phases}</div>
      <p class="small muted">Przyrost umiejętności z wieku i talentu to roczny „budżet”. Każdy obszar realizuje go w swoim oknie: fizyczne zimą, technika na torze (przedsezon i starty), mentalne przez cały rok, najmocniej w sezonie. Jakość treningu decyduje, ile z budżetu zawodnik wykorzysta – świetne warunki pozwalają wyprzedzić rozwój (przełomowy rok), słabe zostawiają zaległość, którą z wiekiem coraz trudniej odrobić. Potencjał pozostaje górną granicą.</p></div>
    <div class="panel flush" style="margin-top:16px"><div class="ph"><h3>Jakość treningu</h3></div><table class="t"><thead><tr><th>Grupa</th>${Object.keys(ATTRS).map(g => `<th>${GROUP_SHORT[g]}</th>`).join('')}</tr></thead>
      <tbody>${cats.map(([cat, n]) => `<tr><td><b>${n}</b><div class="small muted">${catSize(c.id, cat)} os.</div></td>${Object.keys(ATTRS).map(g => cell(cat, g)).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="small muted">Technika – trener (u juniorów trener młodzieży, w miniżużlu trener miniżużla); fizyczne – trener przygotowania motorycznego; mentalne – psycholog sportowy i motywacja trenera; warsztat – kierownik parku maszyn. Dodatkowi trenerzy w obszarze pomagają mniej niż pierwszy, ale zwiększają pojemność (ilu zawodników można dobrze prowadzić). Profil trenera decyduje, które cechy rosną szybciej – najszybciej te, do których zawodnik ma naturalne predyspozycje. Wpływ klubu na gwiazdy startujące w kilku ligach jest ograniczony.${missing.length ? ` <b>Brakuje w sztabie: ${esc(missing.join(', '))}</b>.` : ''}</p>
    <div class="panel flush" style="margin-top:16px"><div class="ph"><h3>Baza szkoleniowa</h3></div><table class="t"><tbody>${fac}</tbody></table></div>`;
}
