'use strict';
// Ekrany finansów: przegląd z prognozą salda, przepływy miesięczne (wykonanie + prognoza), budżet sezonu, finansowanie (miasto, kredyty,
// pomoc awaryjna, licencja), kontrakty i transakcje. Sponsorzy oraz liga i miasto: js/ui-sponsors.js.

const kindLabel = k => (FIN_KINDS[k] || [k])[0];
const monthKey = d => d.slice(0, 7);
const monthShort = k => `${MONTHS[Number(k.slice(5)) - 1].slice(0, 3)} ${k.slice(2, 4)}`;
// Miesiące od początku bieżącego roku finansowego (nie wcześniej niż start gry) do października sezonu sportowego
function finMonths() {
  const S = sportSeason(), out = [];
  let y = fyOf(G.date) - 1, m = 11;
  const start = GAME_START.slice(0, 7);
  while (`${y}-${String(m).padStart(2, '0')}` <= `${S}-10`) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    if (k >= start) out.push(k);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}
// Przepływy: wykonanie (transakcje do dziś) i prognoza (od jutra) w podziale na miesiące i kategorie
function finFlows(c) {
  const months = finMonths(), first = months[0];
  const act = {}, fc = {};
  const txs = Object.values(G.transactions).filter(t => monthKey(t.date) >= first && t.date <= G.date);
  for (const t of txs) { const k = monthKey(t.date); (act[k] = act[k] || {})[t.kind] = (act[k][t.kind] || 0) + t.amount; }
  const forecast = finForecast(c);
  for (const x of forecast) { const k = monthKey(x.date); if (!months.includes(k)) continue; (fc[k] = fc[k] || {})[x.kind] = (fc[k][x.kind] || 0) + x.amount; }
  const open = c.cash - sum(txs.map(t => t.amount));
  let run = open, low = { v: c.cash, d: G.date };
  const rows = months.map(k => {
    const a = act[k] || {}, f = fc[k] || {};
    const all = { ...a };
    for (const [kk, v] of Object.entries(f)) all[kk] = (all[kk] || 0) + v;
    const inc = sum(Object.values(all).filter(v => v > 0)), out = sum(Object.values(all).filter(v => v < 0));
    run += inc + out;
    const past = k < monthKey(G.date), now = k === monthKey(G.date);
    return { k, a, f, all, inc, out, end: run, past, now };
  });
  run = c.cash;
  for (const x of forecast) { run += x.amount; if (run < low.v) low = { v: run, d: x.date }; }
  return { months, rows, open, end: c.cash + sum(forecast.map(x => x.amount)), low, forecast };
}

// ---------- Wykresy ----------
// Saldo: linia wykonania i przerywana prognoza, linia zera; podpowiedź po najechaniu na miesiąc
function cashChart(fl) {
  const w = 900, h = 190, padL = 46, padR = 12, top = 12, bot = 26;
  const pts = [{ k: 'start', v: fl.open }, ...fl.rows.map(r => ({ k: r.k, v: r.end, fc: !r.past && !r.now, now: r.now }))];
  const vs = pts.map(p => p.v).concat(0), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const X = i => padL + i / (pts.length - 1) * (w - padL - padR), Y = v => top + (1 - (v - lo) / span) * (h - top - bot);
  const nowI = Math.max(1, pts.findIndex(p => p.now) >= 0 ? pts.findIndex(p => p.now) : pts.findIndex(p => p.fc) - 1);
  const path = (a, b) => pts.slice(a, b + 1).map((p, j) => `${j ? 'L' : 'M'}${X(a + j).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  const ticks = [lo, (lo + hi) / 2, hi];
  return `<div class="chart fin-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Saldo klubu: wykonanie i prognoza">
    ${ticks.map(t => `<line x1="${padL}" x2="${w - padR}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)"/><text x="${padL - 6}" y="${Y(t) + 4}" text-anchor="end">${(t / 1e6).toFixed(1).replace('.', ',')}</text>`).join('')}
    ${lo < 0 ? `<line x1="${padL}" x2="${w - padR}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--neg)" stroke-dasharray="2 3" opacity=".7"/>` : ''}
    <path d="${path(0, nowI)}" fill="none" stroke="var(--club)" stroke-width="2"/>
    <path d="${path(nowI, pts.length - 1)}" fill="none" stroke="var(--club)" stroke-width="2" stroke-dasharray="6 5" opacity=".85"/>
    ${pts.map((p, i) => i ? `<g class="hit"><rect x="${X(i) - (w - padL) / pts.length / 2}" y="${top}" width="${(w - padL) / pts.length}" height="${h - top - bot}" fill="transparent"><title>${monthShort(p.k)}${p.fc ? ' (prognoza)' : ''}: saldo na koniec miesiąca ${fmtMoney(p.v)}</title></rect><circle cx="${X(i)}" cy="${Y(p.v)}" r="4" fill="${p.fc ? 'var(--panel)' : 'var(--club)'}" stroke="var(--club)" stroke-width="2"/></g>` : '').join('')}
    ${pts.map((p, i) => i && (i % 2 === 1 || pts.length < 10) ? `<text x="${X(i)}" y="${h - 8}" text-anchor="${i === pts.length - 1 ? 'end' : 'middle'}">${monthShort(p.k)}</text>` : '').join('')}
  </svg><div class="legend small muted"><span><i class="ln"></i>wykonanie</span><span><i class="ln dash"></i>prognoza</span><span>mln zł</span></div></div>`;
}
// Wpływy (w górę) i wydatki (w dół) miesięcznie; prognoza kreskowana
function flowChart(fl) {
  const w = 900, h = 220, padL = 46, padR = 12, top = 10, bot = 26;
  const max = Math.max(1, ...fl.rows.map(r => Math.max(r.inc, -r.out)));
  const zero = top + (h - top - bot) / 2, sc = (h - top - bot) / 2 / max;
  const slot = (w - padL - padR) / fl.rows.length, bw = Math.min(26, slot * 0.34);
  const bar = (x, v, cls, fc, label) => { const hh = Math.max(1, Math.abs(v) * sc), y = v >= 0 ? zero - hh : zero; return `<rect x="${x}" y="${y}" width="${bw}" height="${hh}" rx="3" class="${cls}${fc ? ' prog' : ''}"><title>${label}</title></rect>`; };
  return `<div class="chart fin-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Wpływy i wydatki miesięczne">
    <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--panel)" stroke-width="3"/></pattern></defs>
    ${[max, 0, -max].map(t => `<line x1="${padL}" x2="${w - padR}" y1="${zero - t * sc}" y2="${zero - t * sc}" stroke="var(--line)"/><text x="${padL - 6}" y="${zero - t * sc + 4}" text-anchor="end">${(t / 1e6).toFixed(1).replace('.', ',')}</text>`).join('')}
    ${fl.rows.map((r, i) => { const x = padL + i * slot + slot / 2 - bw - 1, fc = !r.past && !r.now;
      return `<g>${bar(x, r.inc, 'in', fc, `${monthShort(r.k)}${fc ? ' (prognoza)' : r.now ? ' (wykonanie + prognoza)' : ''}: wpływy ${fmtMoney(r.inc)}`)}${bar(x + bw + 2, r.out, 'out', fc, `${monthShort(r.k)}${fc ? ' (prognoza)' : ''}: wydatki ${fmtMoney(-r.out)}`)}
        ${fc ? `<rect x="${x}" y="${zero - r.inc * sc}" width="${bw}" height="${Math.max(1, r.inc * sc)}" fill="url(#hatch)" pointer-events="none"/><rect x="${x + bw + 2}" y="${zero}" width="${bw}" height="${Math.max(1, -r.out * sc)}" fill="url(#hatch)" pointer-events="none"/>` : ''}
        <text x="${padL + i * slot + slot / 2}" y="${h - 8}" text-anchor="middle">${monthShort(r.k)}</text></g>`; }).join('')}
  </svg><div class="legend small muted"><span><i class="sw in"></i>wpływy</span><span><i class="sw out"></i>wydatki</span><span><i class="sw hatch"></i>prognoza</span><span>mln zł</span></div></div>`;
}

// ---------- Strona ----------
const FIN_TABS = [['', 'Przegląd'], ['przeplywy', 'Przepływy'], ['budzet', 'Budżet'], ['sponsorzy', 'Sponsorzy'], ['liga', 'Liga i miasto'], ['finansowanie', 'Finansowanie'], ['kontrakty', 'Kontrakty'], ['transakcje', 'Transakcje']];
const TALK_STAGE = { lead: 'zainteresowana', meeting: 'spotkanie umówione', talk: 'rozmowy', pending: 'oferta u firmy', counter: 'kontroferta', signed: 'umowa', closed: 'zakończone', search: 'szukanie' };
PAGES.finanse = parts => {
  const sub = parts[0] || '';
  const c = myClub();
  finInit(c);
  const S = sportSeason();
  const fl = finFlows(c);
  const head = { title: 'Finanse', sub: `Saldo: <b class="${c.cash < 0 ? 'neg' : 'pos'}">${fmtMoney(c.cash)}</b> · prognoza na 31.10.${S}: <b class="${fl.end < 0 ? 'neg' : 'pos'}">${fmtMoney(fl.end, true)}</b> · planowane przychody sezonu ${fmtMoney(seasonRevenue(c, S).total, true)}`, tabs: tabs('finanse', FIN_TABS, sub) };
  const page = FIN_PAGES[sub] || FIN_PAGES[''];
  return { ...head, body: page(c, S, fl, parts[1]) };
};
const FIN_PAGES = {};
FIN_PAGES[''] = (c, S, fl) => {
  const seasonRows = fl.rows.filter(r => fyOf(r.k + '-15') === S);
  const inc = sum(seasonRows.map(r => r.inc)), out = -sum(seasonRows.map(r => r.out));
  const lic = c.fin.licence;
  const talks = Object.values(G.spTalks || {}).filter(t => t.clubId === c.id && ['lead', 'talk', 'counter'].includes(t.stage));
  const expiring = activeSponsors(c, S).filter(s => s.until === S && !s.renewed && !Object.values(G.sponsors).some(x => x.firm === s.firm && x.clubId === c.id && x.since > S));
  const alerts = [];
  if (lic && lic.status !== 'ok') alerts.push(`<div class="reply blocked"><b>Licencja ${esc(lic.status)}</b> – zaległości ${fmtMoney(lic.debt)}. Do spłaty liga nie zatwierdzi nowych kontraktów zawodowych.</div>`);
  if (fl.end < 0) alerts.push(`<div class="reply blocked">Prognoza na 31 października jest ujemna (${fmtMoney(fl.end, true)}). Zaległości w dniu kontroli licencyjnej oznaczają licencję nadzorowaną. <a href="#/finanse/finansowanie">Finansowanie →</a></div>`);
  else if (fl.low.v < 0) alerts.push(`<div class="reply counter">Saldo spadnie poniżej zera ok. ${fmtDate(fl.low.d)} (${fmtMoney(fl.low.v, true)}) – zanim wpłyną kolejne transze. Od ujemnego salda naliczane są odsetki 1% miesięcznie.</div>`);
  if (talks.length) alerts.push(`<div class="reply counter">${talks.length} ${plural(talks.length, 'firma czeka', 'firmy czekają', 'firm czeka')} na Twój ruch w negocjacjach sponsorskich. <a href="#/finanse/sponsorzy/negocjacje">Sponsorzy →</a></div>`);
  if (expiring.length && G.date >= `${S}-07-01`) alerts.push(`<div class="reply">Po sezonie wygasają umowy: ${expiring.map(s => esc(s.name)).join(', ')}.</div>`);
  const upcoming = fl.forecast.filter(x => x.date <= addDays(G.date, 60));
  const grp = sign => { const g = {}; for (const x of upcoming.filter(x => Math.sign(x.amount) === sign)) { const k = x.kind; g[k] = (g[k] || 0) + x.amount; } return Object.entries(g).sort(by(x => Math.abs(x[1]), -1)); };
  const list = (rows, cls) => rows.map(([k, v]) => `<tr><td>${kindLabel(k)}</td><td class="num ${cls}">${fmtMoney(Math.abs(v))}</td></tr>`).join('') || '<tr><td class="empty">Brak</td></tr>';
  return `<div class="stat-tiles" style="margin-bottom:16px">
      <div class="tile"><div class="k">Saldo dziś</div><div class="v ${c.cash < 0 ? 'neg' : ''}">${fmtMoney(c.cash, true)}</div>${freeCash(c) !== c.cash ? `<div class="s">dostępne ${fmtMoney(freeCash(c), true)} (bez dotacji celowych)</div>` : ''}</div>
      <div class="tile"><div class="k">Prognoza 31.10.${S}</div><div class="v ${fl.end < 0 ? 'neg' : 'pos'}">${fmtMoney(fl.end, true)}</div><div class="s">koniec sezonu</div></div>
      <div class="tile"><div class="k">Najniższe saldo</div><div class="v ${fl.low.v < 0 ? 'neg' : ''}">${fmtMoney(fl.low.v, true)}</div><div class="s">${fmtDateShort(fl.low.d)}</div></div>
      <div class="tile"><div class="k">Wpływy sezonu ${S}</div><div class="v pos">${fmtMoney(inc, true)}</div><div class="s">wykonanie + prognoza</div></div>
      <div class="tile"><div class="k">Wydatki sezonu ${S}</div><div class="v neg">${fmtMoney(out, true)}</div><div class="s">wykonanie + prognoza</div></div></div>
    ${alerts.length ? `<div class="stack" style="margin-bottom:16px">${alerts.join('')}</div>` : ''}
    <div class="panel" style="margin-bottom:16px"><h3>Saldo klubu – wykonanie i prognoza do 31 października ${S}</h3>${cashChart(fl)}</div>
    <div class="grid g2"><div class="panel flush"><div class="ph"><h3>Wpływy w najbliższych 60 dniach</h3></div><table class="t"><tbody>${list(grp(1), 'pos')}</tbody></table></div>
      <div class="panel flush"><div class="ph"><h3>Wydatki w najbliższych 60 dniach</h3></div><table class="t"><tbody>${list(grp(-1), 'neg')}</tbody></table></div></div>`;
};
FIN_PAGES.przeplywy = (c, S, fl) => {
  const kinds = Object.keys(FIN_KINDS).concat(Object.keys(Object.assign({}, ...fl.rows.map(r => r.all))).filter(k => !FIN_KINDS[k]));
  const used = kinds.filter(k => fl.rows.some(r => r.all[k]));
  const inK = used.filter(k => fl.rows.reduce((s, r) => s + (r.all[k] || 0), 0) > 0), outK = used.filter(k => !inK.includes(k));
  const cell = (r, k) => { const a = r.a[k] || 0, f = r.f[k] || 0, v = a + f; if (!v) return '<td class="num muted">·</td>'; return `<td class="num ${f && !a ? 'prog' : ''}" title="${a ? `wykonanie ${fmtMoney(a)}` : ''}${a && f ? ', ' : ''}${f ? `prognoza ${fmtMoney(f)}` : ''}">${fmtMoney(v / 1000).replace(/\s?zł/, '')}</td>`; };
  const total = (k) => sum(fl.rows.map(r => r.all[k] || 0));
  const hdr = `<tr><th>tys. zł</th>${fl.rows.map(r => `<th class="num ${!r.past && !r.now ? 'prog' : ''}">${monthShort(r.k)}${r.now ? '*' : ''}</th>`).join('')}<th class="num">Razem</th></tr>`;
  const sec = (title, ks) => `<tr class="sec"><td colspan="${fl.rows.length + 2}">${title}</td></tr>${ks.map(k => `<tr><td>${kindLabel(k)}</td>${fl.rows.map(r => cell(r, k)).join('')}<td class="num"><b>${fmtMoney(total(k) / 1000).replace(/\s?zł/, '')}</b></td></tr>`).join('')}`;
  const sumRow = (label, f, cls) => `<tr class="tot"><td>${label}</td>${fl.rows.map(r => { const v = f(r); return `<td class="num ${cls ? cls(v) : ''}">${fmtMoney(v / 1000).replace(/\s?zł/, '')}</td>`; }).join('')}<td class="num">${label.startsWith('Saldo na') ? '' : fmtMoney(sum(fl.rows.map(f)) / 1000).replace(/\s?zł/, '')}</td></tr>`;
  return `<div class="panel" style="margin-bottom:16px"><h3>Wpływy i wydatki miesięcznie</h3>${flowChart(fl)}</div>
    <div class="panel flush"><div class="ph"><h3>Przepływy pieniężne (tys. zł)</h3><span class="small muted">kursywą: prognoza · * bieżący miesiąc (wykonanie + prognoza) · saldo otwarcia ${fmtMoney(fl.open, true)}</span></div>
    <div class="scroll-x"><table class="t fin-table"><thead>${hdr}</thead><tbody>${sec('Wpływy', inK)}${sumRow('Wpływy razem', r => r.inc, () => 'pos')}${sec('Wydatki', outK)}${sumRow('Wydatki razem', r => r.out, () => 'neg')}
      ${sumRow('Wynik miesiąca', r => r.inc + r.out, v => v < 0 ? 'neg' : 'pos')}${sumRow('Saldo na koniec miesiąca', r => r.end, v => v < 0 ? 'neg' : '')}</tbody></table></div></div>
    <p class="small muted">Prognoza obejmuje podpisane umowy (sponsorzy wg harmonogramów płatności, kontrakty, sztab, kredyty), wsparcie miasta, wypłaty ligi, sprzedaż karnetów i lóż, mecze z terminarza (frekwencja jak średnia klubu) oraz nagrody wg obecnego miejsca w tabeli.</p>`;
};
FIN_PAGES.budzet = (c, S, fl) => {
  const seasonRows = fl.rows.filter(r => fyOf(r.k + '-15') === S);
  const agg = {};
  for (const r of seasonRows) { for (const [k, v] of Object.entries(r.a)) (agg[k] = agg[k] || [0, 0])[0] += v; for (const [k, v] of Object.entries(r.f)) (agg[k] = agg[k] || [0, 0])[1] += v; }
  const plan = finPlan(c, S, true);
  const rows = Object.entries(agg).filter(([, v]) => v[0] || v[1]);
  const inc = rows.filter(([, v]) => v[0] + v[1] > 0).sort(by(([, v]) => v[0] + v[1], -1)), out = rows.filter(([, v]) => v[0] + v[1] < 0).sort(by(([, v]) => v[0] + v[1]));
  const tot = list => [sum(list.map(x => x[1][0])), sum(list.map(x => x[1][1]))];
  const max = Math.max(1, ...rows.map(([, v]) => Math.abs(v[0] + v[1])));
  const table = (title, list, cls) => { const t = tot(list); return `<div class="panel flush"><div class="ph"><h3>${title}</h3><b class="${cls}">${fmtMoney(Math.abs(t[0] + t[1]), true)}</b></div><table class="t"><thead><tr><th>Kategoria</th><th class="num">Wykonanie</th><th class="num">Prognoza</th><th class="num">Sezon</th><th></th></tr></thead><tbody>
    ${list.map(([k, v]) => `<tr><td>${kindLabel(k)}</td><td class="num">${fmtMoney(Math.abs(v[0]), true)}</td><td class="num muted">${fmtMoney(Math.abs(v[1]), true)}</td><td class="num"><b>${fmtMoney(Math.abs(v[0] + v[1]), true)}</b></td><td style="width:24%">${bar(Math.abs(v[0] + v[1]), max, cls === 'pos' ? 'var(--pos)' : 'var(--neg)')}</td></tr>`).join('')}</tbody></table></div>`; };
  const ti = tot(inc), te = tot(out);
  const ci = typeof capInfo === 'function' ? capInfo(c, S) : { applies: false };
  return `<div class="grid g2">${table(`Przychody sezonu ${S}`, inc, 'pos')}${table(`Wydatki sezonu ${S}`, out, 'neg')}</div>
    <div class="panel" style="margin-top:16px"><div class="kv"><div>Wynik sezonu (wykonanie + prognoza)</div><div class="${ti[0] + ti[1] + te[0] + te[1] >= 0 ? 'pos' : 'neg'}">${fmtMoney(ti[0] + ti[1] + te[0] + te[1])}</div>
      <div>Planowane przychody sezonu (z właścicielem)</div><div>${fmtMoney(seasonRevenue(c, S).total)}</div><div>Deklarowana wpłata właściciela</div><div>${fmtMoney(plan.owner)}${c.fin.plan && c.fin.plan.S === S ? '' : ' <span class="muted small">(szacunek – plan zatwierdzany 1 grudnia)</span>'}</div>
      <div>Wsparcie miasta</div><div>${fmtMoney(cityAmount(c, S))}${c.fin.city.granted[S] == null ? ' <span class="muted small">(przed decyzją rady)</span>' : ''}</div><div>Fundusz rezerwowy ligi (zamrożone)</div><div>${fmtMoney(sum(c.fin.reserve.filter(r => !r.paid).map(r => r.amount)))}</div></div>
      <p class="small muted">Planowane przychody: sponsorzy z umów, liga, miasto, dzień meczowy i fundusze ligi oraz zadeklarowana wpłata właściciela (zatwierdzana 1 grudnia). Właściciel nie pokrywa automatycznie deficytu – wydatki ograniczają budżety płac i transferów (Finanse → Budżet).</p></div>
    ${ci.applies ? `<div class="panel" style="margin-top:16px"><h3>Limit wydatków na kontrakty – sezon ${S}</h3><div class="kv"><div>Limit (70% przychodów${ci.promoted ? ', beniaminek' : ''})</div><div>${fmtMoney(ci.limit)}</div><div>Wykorzystane</div><div class="${ci.free < 0 ? 'neg' : ''}">${fmtMoney(ci.used)}</div><div>Wolne</div><div class="${ci.free < 0 ? 'neg' : 'pos'}">${fmtMoney(ci.free)}</div></div>${bar(ci.used, ci.limit)}<p class="small muted">Wartość kontraktu = podpis + stawka za punkt × punkty z poprzedniego sezonu + premie. Ekstraliga Żużlowa nie potwierdzi umowy, która przekroczy limit.</p></div>` : ''}
    ${G.proJunior && G.proJunior[G.season - 1] && c.league === 'PGE' ? `<div class="panel" style="margin-top:16px"><h3>PRO Junior ${G.season - 1}</h3><p class="small">Stawka: <b>${fmtMoney(G.proJunior[G.season - 1].rate)}</b> za punkt wychowanka; nasz klub: ${G.proJunior[G.season - 1].pts[c.id] || 0} pkt.</p></div>` : ''}`;
};
FIN_PAGES.finansowanie = (c, S) => {
  const f = c.fin, city = f.city, lic = f.licence;
  const reqs = Object.values(G.finTalks || {}).sort(by(x => x.made, -1)).slice(0, 12);
  const lt = loanTerms(c, 1e9, 3);
  const nextS = fyOf(G.date) + (G.date >= fyDate(fyOf(G.date), 12, 1) ? 1 : 0);
  const loans = f.loans.map(l => { const left = l.schedule.filter(p => p.date >= G.date); return `<tr><td>${esc(l.name)}</td><td class="num">${fmtMoney(l.amount)}</td><td class="num">${(l.rate * 100).toFixed(1).replace('.', ',')}%</td><td class="num">${fmtMoney(left[0] ? left[0].amount : 0)}</td><td class="num">${fmtMoney(sum(left.map(p => p.principal)))}</td><td>${left.length ? fmtDateShort(left[left.length - 1].date) : '—'}</td></tr>`; }).join('');
  const form = (kind, label, def, note, extra = '') => `<div class="save-item"><div class="grow"><b>${FIN_REQ[kind]}</b><div class="small muted">${note}</div></div>${kind === 'fans' ? '' : `<input type="number" id="fr-${kind}" value="${def}" step="50000" min="0" style="width:120px">`}${extra}<button class="btn sm" onclick="ACT.finReq('${kind}')">${label}</button></div>`;
  return `<div class="grid g2"><div class="stack">
      <div class="panel"><h3>Licencja na sezon ${S + (G.seasonClosed === G.season ? 0 : 1)}</h3>${lic && lic.status !== 'ok' ? `<p class="neg"><b>Licencja ${esc(lic.status)}</b> – zaległości ${fmtMoney(lic.debt)}. Zakaz zatwierdzania nowych kontraktów zawodowych do czasu spłaty.</p>` : '<p class="pos">Bez zastrzeżeń.</p>'}
        <p class="small muted">Komisja licencyjna sprawdza zobowiązania na 31 października: wobec zawodników, pracowników i kontrahentów. Ujemne saldo w tym dniu = licencja nadzorowana i zakaz kontraktowania; zaległości ponad 20% budżetu = licencja warunkowa i przymusowa dopłata akcjonariuszy.</p></div>
      <div class="panel"><h3>Miasto ${esc(c.city)}</h3><div class="kv"><div>Wsparcie w sezonie ${fyOf(G.date)}</div><div>${fmtMoney(cityAmount(c, fyOf(G.date)))}${city.granted[fyOf(G.date)] == null ? ' <span class="small muted">(szacunek)</span>' : ''}</div>
        <div>Zamożność miasta</div><div>${stars(city.wealth)}</div><div>Przychylność władz</div><div>${bar(city.stance * 100)}</div><div>Miasto właścicielem klubu</div><div>${city.owner ? 'tak' : 'nie'}</div>
        <div>Poręczenia miasta</div><div>${fmtMoney(city.guarantee || 0)}</div><div>Wnioski w tym sezonie</div><div>${city.asks[fyOf(G.date)] || 0}</div></div>
        <label class="fld" style="margin-top:12px">Wniosek o dotację na sezon ${nextS} (rada decyduje 1 grudnia)<input type="number" step="50000" min="0" value="${Math.round(city.request || city.base)}" onchange="ACT.cityRequest(+this.value)"></label>
        <p class="small muted">Wniosek dotyczy środków ogólnych (dotacja na rozwój sportu, umowa promocyjna). Dotacje celowe – szkolenie młodzieży i organizacja imprez – miasto przyznaje osobno i rozlicza 31 października (<a href="#/finanse/liga">Liga i miasto</a>). Prośba ponad dotychczasową kwotę ma szansę zależną od przychylności władz i zamożności miasta. Każda pomoc nadzwyczajna obniża przychylność – wsparcie żużla bywa tematem politycznym (np. Gorzów 2025).</p></div>
      ${loans ? `<div class="panel flush"><div class="ph"><h3>Kredyty i pożyczki</h3></div><table class="t"><thead><tr><th>Rodzaj</th><th class="num">Kwota</th><th class="num">Oprocentowanie</th><th class="num">Rata</th><th class="num">Do spłaty</th><th>Koniec</th></tr></thead><tbody>${loans}</tbody></table></div>` : ''}
    </div><div class="stack">
      <div class="panel stack"><h3>Pozyskanie pieniędzy</h3>
        ${form('loan', 'Złóż wniosek', Math.min(1e6, lt.max) || 500000, `Zdolność kredytowa: do ${fmtMoney(lt.max, true)}, oprocentowanie ok. ${(lt.rate * 100).toFixed(1).replace('.', ',')}%. Decyzja banku w 7–10 dni.`, `<select id="fr-years">${[1, 2, 3, 4, 5].map(y => `<option value="${y}" ${y === 2 ? 'selected' : ''}>${y} ${plural(y, 'rok', 'lata', 'lat')}</option>`).join('')}</select>`)}
        ${form('guarantee', 'Wniosek do rady', 2000000, 'Poręczenie zwiększa zdolność kredytową i obniża oprocentowanie. Sesja rady za 2–5 tygodni.')}
        ${form('cityGrant', 'Wniosek do rady', 1000000, 'Przesunięcie środków w budżecie miasta na kontrakty i organizację meczów. Wypłata w dwóch ratach.')}
        ${form('cityShares', 'Wniosek do rady', 2000000, city.owner || city.stance >= 0.6 ? 'Miasto obejmuje nowe akcje klubu (dokapitalizowanie).' : 'Władze miasta nie są zainteresowane kupnem akcji.')}
        ${form('ownerEquity', 'Zapytaj', 1000000, `Emisja akcji dla obecnych akcjonariuszy – do ok. ${fmtMoney(c.budget * f.ownerCap, true)}. Obniża zaufanie zarządu.`)}
        ${form('ownerLoan', 'Zapytaj', 500000, 'Pożyczka 3% na 12 miesięcy od akcjonariusza.')}
        ${form('fans', 'Ogłoś zbiórkę', 0, f.fundraiser === fyOf(G.date) ? 'Zbiórka w tym sezonie już się odbyła.' : 'Akcja „cegiełek” wśród kibiców – raz w sezonie, wynik zależy od liczby kibiców i nastrojów.')}
        <div class="save-item"><div class="grow"><b>Sprzedaż zawodnika</b><div class="small muted">Odstępne za zawodnika z ważnym kontraktem – lista transferowa w profilu zawodnika.</div></div><a class="btn sm" href="#/druzyna/lista">Kadra</a></div>
        <div class="save-item"><div class="grow"><b>Przedpłata od sponsora</b><div class="small muted">Następna transza teraz, z rabatem 4% – przy umowach w zakładce Sponsorzy.</div></div><a class="btn sm" href="#/finanse/sponsorzy/partnerzy">Sponsorzy</a></div></div>
      <div class="panel flush"><div class="ph"><h3>Wnioski</h3></div><table class="t"><tbody>${reqs.map(x => `<tr><td>${fmtDateShort(x.made)}</td><td>${FIN_REQ[x.kind]}${x.amount ? ` · ${fmtMoney(x.amount, true)}` : ''}<div class="small muted">${esc(x.result || (x.status === 'pending' ? `decyzja do ${fmtDate(x.due)}` : ''))}</div></td><td class="nowrap">${x.status === 'offer' ? `<button class="btn sm primary" onclick="ACT.loanAccept('${x.id}')">Przyjmij ${fmtMoney(x.offer.amount, true)} (${(x.offer.rate * 100).toFixed(1).replace('.', ',')}%)</button>` : `<span class="pill ${x.status === 'ok' ? 'ok' : x.status === 'rejected' ? 'inj' : ''}">${{ pending: 'w toku', ok: 'zgoda', rejected: 'odmowa', offer: 'oferta' }[x.status]}</span>`}</td></tr>`).join('') || '<tr><td class="empty">Brak wniosków</td></tr>'}</tbody></table></div>
    </div></div>`;
};
FIN_PAGES.kontrakty = c => {
  const rs = clubRiders(c.id).sort(by(r => { const k = activeDeal(r); return k ? k.signing : 0; }, -1));
  const staff = clubStaff(c.id);
  const tot = sum(rs.map(r => { const k = activeDeal(r); return k ? k.signing : 0; }));
  return `<div class="panel flush" style="margin-bottom:16px"><div class="ph"><h3>Kontrakty zawodników</h3><span class="small muted">podpisy łącznie: <b>${fmtMoney(tot)}</b> / sezon</span></div><table class="t"><thead><tr><th>Zawodnik</th><th>Rodzaj</th><th class="num">Za podpis</th><th class="num">Za punkt</th><th class="num">Pkt w sezonie</th><th class="num">Koszt sezonu</th><th>Do</th><th>Źródło kwot</th></tr></thead><tbody>
    ${rs.map(r => { const k = activeDeal(r), s = r.stats[G.season]; const pts = s ? s.pts + s.bonus : 0; const am = k && k.kind === 'amatorski'; return `<tr class="click" onclick="go('#/zawodnik/${r.id}/kontrakt')"><td><b>${esc(r.name)}</b>${mkBadges(r)}</td><td>${k ? esc(contractLabel(k)) : '—'}</td><td class="num">${k ? (am ? '—' : fmtMoney(k.signing)) : '—'}</td><td class="num">${k ? (am ? '—' : fmtMoney(k.perPoint)) : '—'}</td><td class="num">${pts}</td><td class="num">${k ? fmtMoney(am ? k.stipend * 12 + EQUIP_VALUE[c.league] : k.signing + pts * k.perPoint) : '—'}</td><td>${k ? (k.until || k.season) : ''}</td><td class="small muted">${k ? esc(k.source || (k.kind === 'wypożyczenie' ? `z ${G.clubs[k.parentId].short}` : '')) : ''}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="panel flush"><div class="ph"><h3>Sztab</h3><span class="small muted">${fmtMoney(sum(staff.map(s => s.wage)))} / mies.</span></div><table class="t"><thead><tr><th>Osoba</th><th>Rola</th><th class="num">Pensja</th><th>Do</th></tr></thead><tbody>${staff.map(s => `<tr><td>${esc(s.name)}</td><td>${STAFF_ROLES[s.role].name}</td><td class="num">${fmtMoney(s.wage)}</td><td>${s.until}</td></tr>`).join('')}</tbody></table></div>`;
};
FIN_PAGES.transakcje = () => {
  const kind = UI.txKind || '';
  const list = Object.values(G.transactions).filter(t => !kind || t.kind === kind).sort((a, b) => b.date.localeCompare(a.date) || Number(b.id.slice(1)) - Number(a.id.slice(1))).slice(0, 400);
  const kinds = [...new Set(Object.values(G.transactions).map(t => t.kind))];
  return `<div class="filters"><label class="fld">Kategoria<select onchange="UI.txKind=this.value;render()"><option value="">wszystkie</option>${kinds.map(k => `<option value="${k}" ${kind === k ? 'selected' : ''}>${kindLabel(k)}</option>`).join('')}</select></label></div>
    <div class="panel flush"><table class="t"><thead><tr><th>Data</th><th>Kategoria</th><th>Opis</th><th class="num">Kwota</th></tr></thead><tbody>${list.map(t => `<tr><td>${fmtDateShort(t.date)}</td><td>${kindLabel(t.kind)}</td><td>${esc(t.desc)}</td><td class="num ${t.amount >= 0 ? 'pos' : 'neg'}">${t.amount >= 0 ? '+' : ''}${fmtMoney(t.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Brak transakcji</td></tr>'}</tbody></table></div>`;
};

// ---------- Akcje ----------
ACT.cityRequest = v => { myClub().fin.city.request = Math.max(0, round1k(v)); toast('Wniosek o dotację zapisany.', 'good'); dbQueueSave(); };
ACT.finReq = kind => {
  const el = $(`#fr-${kind}`), yrs = $('#fr-years');
  const r = finRequest(kind, el ? +el.value : 0, kind === 'loan' && yrs ? +yrs.value : 2);
  toast(r.text, r.ok ? 'good' : 'bad'); changed();
};
ACT.loanAccept = id => { const r = acceptLoan(id); toast(r.text, r.ok ? 'good' : 'bad'); changed(); };
