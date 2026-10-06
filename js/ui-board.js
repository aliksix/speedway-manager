'use strict';
// Zarząd: akcje próśb, ekran po zwolnieniu menedżera i oferty pracy (logika: js/board.js)
ACT.boardReq = kind => { const r = boardRequest(kind); toast(r.text, r.ok ? 'good' : 'bad'); changed(); };

// ---------- Ekran po zwolnieniu ----------
PAGES.zwolniony = () => {
  if (!jobless()) return { title: 'Menedżer', body: '<div class="panel empty">Masz pracę.</div>' };
  const old = G.clubs[G.sacked.clubId];
  const offers = G.sacked.offers.filter(o => o.until >= G.date && G.clubs[o.clubId].vacancy);
  const vac = Object.values(G.clubs).filter(c => c.vacancy && c.id !== old.id).sort(by(c => LEAGUE_ORDER.indexOf(c.league)));
  const appTxt = a => !a ? '' : !a.done ? `odpowiedź do ${fmtDateShort(a.due)}` : a.result === 'oferta' ? '<span class="pos">oferta</span>' : a.result === 'odmowa' ? '<span class="neg">odmowa</span>' : 'obsadzone';
  return { title: 'Bez pracy', sub: `zwolniony z ${esc(old.name)} · ${fmtDate(G.sacked.date)}`,
    body: `<div class="panel"><p>${esc(G.sacked.reason)}</p></div>
      ${offers.length ? `<div class="panel flush" style="margin-top:14px"><table class="t"><thead><tr><th>Oferty pracy</th><th>Liga</th><th>Cel zarządu</th><th>Ważna do</th><th></th></tr></thead><tbody>${offers.map(o => { const x = G.clubs[o.clubId]; return `<tr><td>${clubLink(x.id)}</td><td>${LEAGUES[x.league].name}</td><td>${esc(x.objective ? x.objective.text : '')}</td><td>${fmtDateShort(o.until)}</td><td style="text-align:right"><button class="btn primary" onclick="ACT.acceptJob(${x.id})">Przyjmij</button></td></tr>`; }).join('')}</tbody></table></div>` : ''}
      <div class="panel flush" style="margin-top:14px">${vac.length ? `<table class="t"><thead><tr><th>Wolne stanowiska</th><th>Liga</th><th>Od</th><th>Cel zarządu</th><th></th></tr></thead><tbody>${vac.map(x => { const a = G.sacked.apps[x.id]; return `<tr><td>${clubLink(x.id)}</td><td>${LEAGUES[x.league].name}</td><td>${fmtDateShort(x.vacancy.since)}</td><td>${esc(x.objective ? x.objective.text : '')}</td><td style="text-align:right">${a ? appTxt(a) : `<button class="btn" onclick="ACT.applyJob(${x.id})">Aplikuj</button>`}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">Żaden klub nie szuka teraz menedżera.</div>'}</div>` };
};
ACT.applyJob = id => { const r = applyJob(id); toast(r.text, r.ok ? 'good' : 'bad'); changed(); };
ACT.acceptJob = id => { const r = acceptJob(id); toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) go('#/klub'); else changed(); };
ACT.setDuty = (key, val) => { setDuty(key, val); changed(); };
