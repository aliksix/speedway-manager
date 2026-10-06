'use strict';
// Ekrany: Finanse → Sponsorzy (przegląd, cennik i miejsca, partnerzy, negocjacje, rynek firm), oferta sponsorska (umowa wieloletnia z premiami
// i klauzulami) oraz Finanse → Liga i miasto (rozpisane wypłaty ligi, składniki wsparcia miasta, rozliczenie dotacji celowych).

const SP_TABS = [['', 'Przegląd'], ['cennik', 'Cennik i miejsca'], ['partnerzy', 'Partnerzy'], ['negocjacje', 'Negocjacje'], ['rynek', 'Rynek firm']];
const pct = p => `${Math.round(p * 100)}%`;
const spSeasons = () => { const S = sportSeason(); return [S, S + 1, S + 2]; };
function spTabsBar(sub) {
  const c = myClub();
  const waiting = Object.values(G.spTalks || {}).filter(t => t.clubId === c.id && ['lead', 'talk', 'counter'].includes(t.stage)).length;
  return `<div class="row" style="margin-bottom:14px"><div class="seg">${SP_TABS.map(([k, l]) => `<button class="btn sm ${sub === k ? 'primary' : ''}" onclick="go('#/finanse/sponsorzy${k ? '/' + k : ''}')">${l}${k === 'negocjacje' && waiting ? ` (${waiting})` : ''}</button>`).join('')}</div></div>`;
}
FIN_PAGES.sponsorzy = (c, S, fl, sub = '') => {
  spInit(c);
  const page = SP_PAGES[sub] || SP_PAGES[''];
  return spTabsBar(sub || '') + page(c, S);
};
FIN_PAGES.reklama = (c, S, fl) => FIN_PAGES.sponsorzy(c, S, fl, 'cennik');
const SP_PAGES = {};

// ---------- Przegląd ----------
SP_PAGES[''] = (c, S) => {
  const mi = marketIndex(c), seasons = spSeasons();
  const sums = seasons.map(s => ({ s, ...sponsorSummary(c, s) }));
  const sold = s => { const tot = sum(AD_SLOTS.map(a => listPrice(c, a.id, s) * a.cap)), use = slotUse(c, s); return tot ? sum(AD_SLOTS.map(a => listPrice(c, a.id, s) * Math.min(a.cap, use[a.id] || 0))) / tot : 0; };
  const odds = leagueOdds(c, S + 1), i0 = LEAGUE_ORDER.indexOf(c.league);
  const pUp = i0 > 0 ? odds[LEAGUE_ORDER[i0 - 1]] || 0 : 0, pDown = i0 < 2 ? odds[LEAGUE_ORDER[i0 + 1]] || 0 : 0;
  const tgt = c.fin.spTarget[S];
  const inbound = Object.values(G.spTalks || {}).filter(t => t.clubId === c.id && t.stage === 'counter');
  const renew = activeSponsors(c, S).filter(s => s.until === S && !s.renewed && !s.released);
  return `<div class="stat-tiles" style="margin-bottom:16px">
      <div class="tile"><div class="k">Wartość marketingowa</div><div class="v">${mi.v.toFixed(2).replace('.', ',')}</div><div class="s">1,00 = przeciętny klub ligi</div></div>
      ${sums.map(x => `<div class="tile"><div class="k">Sponsorzy ${x.s}</div><div class="v">${fmtMoney(x.guaranteed, true)}</div><div class="s">gwarantowane · ${x.n} ${plural(x.n, 'umowa', 'umowy', 'umów')}${x.bonus ? ` · premie ~${fmtMoney(x.bonus, true)}` : ''}</div></div>`).join('')}
      <div class="tile"><div class="k">Cel zarządu ${S}</div><div class="v ${tgt && sums[0].guaranteed < tgt * 0.9 ? 'neg' : ''}">${tgt ? fmtMoney(tgt, true) : '—'}</div><div class="s">${tgt ? `realizacja ${pct(sums[0].guaranteed / tgt)}` : 'ustalany przed sezonem'}</div></div></div>
    ${inbound.length ? `<div class="reply counter" style="margin-bottom:12px">${inbound.length} ${plural(inbound.length, 'propozycja czeka', 'propozycje czekają', 'propozycji czeka')} na odpowiedź: ${inbound.map(t => esc(t.name)).join(', ')}. <a href="#/finanse/sponsorzy/negocjacje">Negocjacje →</a></div>` : ''}
    ${renew.length && G.date >= `${S}-06-01` ? `<div class="reply" style="margin-bottom:12px">Po sezonie wygasają: ${renew.map(s => esc(s.name)).join(', ')}. Przedłuż albo zrezygnuj, żeby sprzedać ich miejsca na sezon ${S + 1}. <a href="#/finanse/sponsorzy/partnerzy">Partnerzy →</a></div>` : ''}
    <div class="grid g2"><div class="panel"><h3>Wartość marketingowa klubu</h3><div class="kv">${mi.parts.map(([n, v]) => `<div>${n}</div><div>${bar(v * 50, 100, v >= 1 ? 'var(--pos)' : 'var(--warn)')}<span class="small muted">×${v.toFixed(2).replace('.', ',')}</span></div>`).join('')}</div>
        <p class="small muted">Wycena rynkowa miejsc = cennik ligi × wartość marketingowa; na przyszłe sezony dział marketingu waży ją szansą awansu i spadku. Ceny ustalasz sam w zakładce Cennik – drożej niż rynek oznacza mniej zapytań, taniej – szybszą sprzedaż.</p></div>
      <div class="panel"><h3>Szanse wg działu marketingu</h3><div class="kv">
        <div>Mistrzostwo</div><div>${pct(posChance(c, 1))}</div><div>Medal</div><div>${pct(posChance(c, 3))}</div><div>Miejsca 1–4</div><div>${pct(posChance(c, 4))}</div>
        ${i0 > 0 ? `<div>Awans po sezonie ${S}</div><div>${pct(pUp)}</div>` : ''}${i0 < 2 ? `<div>Spadek po sezonie ${S}</div><div>${pct(pDown)}</div>` : ''}</div>
        <p class="small muted">Firmy wyceniają premie za wynik według tych szans – premia za mało prawdopodobny sukces „kosztuje” je niewiele, więc chętnie ją dopiszą.</p></div></div>
    <div class="panel" style="margin-top:16px"><h3>Sprzedaż miejsc reklamowych (wartość wg cennika)</h3><div class="kv">${seasons.map(s => `<div>Sezon ${s}</div><div>${bar(sold(s) * 100)}<span class="small muted">${pct(sold(s))}</span></div>`).join('')}</div>
      <p class="small muted">Miejsca na kolejne sezony możesz sprzedawać już teraz – niezależnie od tego, czy obecny sponsor przedłuży umowę. Obecny partner ma pierwszeństwo do swoich miejsc do 31 sierpnia ostatniego sezonu umowy, chyba że zrezygnujesz z przedłużenia.</p></div>`;
};

// ---------- Cennik i miejsca ----------
SP_PAGES.cennik = (c, S) => {
  const seasons = spSeasons();
  const uses = seasons.map(s => slotUse(c, s));
  const who = (id, s) => Object.values(G.sponsors).filter(x => x.clubId === c.id && x.assets[id] && ((x.since <= s && x.until >= s) || rofrHolds(x, s))).map(x => `${esc(x.name)}${x.until < s ? ' (pierwszeństwo)' : ''}`).join(', ');
  const cell = (a, s, i) => {
    const used = uses[i][a.id] || 0, free = a.cap - used, mk = adPrice(c, a.id, s), lp = listPrice(c, a.id, s);
    const r = lp / mk, cls = r > 1.15 ? 'neg' : r < 0.9 ? 'pos' : '';
    return `<td class="num"><input type="number" step="1000" min="0" value="${lp}" style="width:92px" class="${cls}" onchange="ACT.spPrice(${s},'${a.id}',+this.value)">
      <div class="small muted" title="${esc(who(a.id, s) || 'wolne')}">rynek ${fmtMoney(mk, true)} · <span class="${free ? 'pos' : ''}">${free}/${a.cap}</span></div></td>`;
  };
  return `<div class="panel" style="margin-bottom:12px"><div class="row" style="gap:16px;flex-wrap:wrap">${seasons.map(s => `<div><b>Sezon ${s}</b> <button class="btn sm" onclick="ACT.spPriceAll(${s},'market')">Wg rynku</button> <button class="btn sm ghost" onclick="ACT.spPriceAll(${s},1.1)">+10%</button> <button class="btn sm ghost" onclick="ACT.spPriceAll(${s},0.9)">−10%</button></div>`).join('')}</div>
      <p class="small muted">Cena za sezon za jedno miejsce. Na czerwono – drożej niż wycena rynkowa o ponad 15% (mniej zapytań, firmy proponują część kwoty jako premię za wynik), na zielono – taniej (szybka sprzedaż, ale zostawiasz pieniądze na stole). Pod ceną: wycena rynkowa i wolne miejsca (najedź, by zobaczyć sponsorów).</p></div>
    ${Object.entries(AD_GROUPS).map(([g, gname]) => `<div class="panel flush" style="margin-bottom:16px"><div class="ph"><h3>${gname}</h3></div><div class="scroll-x"><table class="t"><thead><tr><th>Miejsce</th>${seasons.map(s => `<th class="num">Sezon ${s}</th>`).join('')}<th>Sponsor ${S}</th></tr></thead><tbody>
      ${AD_SLOTS.filter(a => a.group === g).map(a => `<tr><td>${esc(a.name)}</td>${seasons.map((s, i) => cell(a, s, i)).join('')}<td class="small">${who(a.id, S) || '<span class="muted">wolne</span>'}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}`;
};
ACT.spPrice = (S, id, v) => { const f = spInit(myClub()); (f.prices[S] = f.prices[S] || {})[id] = Math.max(0, round1k(v)); changed(); };
ACT.spPriceAll = (S, m) => {
  const c = myClub(), f = spInit(c);
  if (m === 'market') delete f.prices[S];
  else { const p = f.prices[S] = f.prices[S] || {}; for (const a of AD_SLOTS) p[a.id] = round1k(listPrice(c, a.id, S) * m); }
  changed();
};

// ---------- Partnerzy ----------
SP_PAGES.partnerzy = (c, S) => {
  const sps = Object.values(G.sponsors).filter(s => s.clubId === c.id && s.until >= S - 1).sort(by(s => (s.until < S ? 1e12 : 0) - spAmount(s, Math.max(S, s.since))));
  const renewTalk = s => Object.values(G.spTalks || {}).find(t => t.renewal === s.id && TALK_OPEN.includes(t.stage));
  const row = s => {
    const st = s.since > S ? `<span class="pill ok">od ${s.since}</span>` : s.until < S ? '<span class="pill inj">wygasła</span>' : s.until === S ? `<span class="pill u24">${s.released ? 'nie przedłużamy' : 'wygasa'}</span>` : '';
    const canRenew = s.until <= S && !s.renewed && !s.released && !renewTalk(s);
    const paid = s.paid[fyOf(G.date)] || 0;
    const am = [];
    for (let x = Math.max(s.since, S - 1); x <= s.until; x++) am.push(`${x}: ${fmtMoney(spAmount(s, x), true)}`);
    return `<tr class="${s.until < S ? 'dim' : ''}"><td><b>${esc(s.name)}</b> ${st}<div class="small muted">${esc(s.kind)} · ${esc((firmByKey(s.firm, c) || {}).industry || '')}</div></td><td class="small">${esc(assetsText(s.assets)) || '—'}</td>
      <td class="small nowrap">${am.join('<br>')}</td><td class="small">${spBonuses(s).map(b => esc(bonusText(b))).join('<br>') || '—'}${clausesText(s.clauses) ? `<div class="muted">${esc(clausesText(s.clauses))}</div>` : ''}</td>
      <td class="small">${esc((PAY_PLANS[s.plan] || {}).name || '')}<div class="muted">wpłacono: ${fmtMoney(paid, true)}</div></td><td>${s.since}–${s.until}</td>
      <td class="nowrap">${canRenew ? `<button class="btn sm" onclick="ACT.spRenew('${s.id}')">Przedłuż</button>` : renewTalk(s) ? `<a class="small" href="#/finanse/sponsorzy/negocjacje">w rozmowach</a>` : ''}
        ${s.until === S && !s.renewed && !s.released ? ` <button class="btn sm ghost" title="Zwolnij miejsca na sezon ${S + 1}" onclick="ACT.spRelease('${s.id}')">Nie przedłużaj</button>` : ''}
        ${s.since <= S && s.until >= S && fyOf(G.date) === S ? ` <button class="btn sm ghost" title="Następna transza teraz, z rabatem 4%" onclick="ACT.spAdvance('${s.id}')">Przedpłata</button>` : ''}</td></tr>`;
  };
  return `<div class="panel flush"><div class="ph"><h3>Umowy sponsorskie</h3><span class="small muted">sezon ${S}: <b>${fmtMoney(sponsorSummary(c, S).guaranteed, true)}</b> gwarantowane</span></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Sponsor</th><th>Świadczenia</th><th>Kwoty</th><th>Premie i klauzule</th><th>Płatności</th><th>Okres</th><th></th></tr></thead><tbody>${sps.map(row).join('') || '<tr><td colspan="7" class="empty">Brak umów</td></tr>'}</tbody></table></div></div>`;
};

// ---------- Negocjacje ----------
SP_PAGES.negocjacje = c => {
  const talks = Object.values(G.spTalks || {}).filter(t => t.clubId === c.id && (TALK_OPEN.includes(t.stage) || (t.log && t.log.length && t.log[t.log.length - 1].d >= addDays(G.date, -30)))).sort(by(t => TALK_OPEN.includes(t.stage) ? 0 : 1));
  const searching = talks.some(t => t.stage === 'search');
  const talkCard = t => {
    const o = t.counter;
    const act = { lead: `<button class="btn sm primary" onclick="ACT.spMeet('${t.id}')">Umów spotkanie</button>`, talk: `<button class="btn sm primary" onclick="ACT.spOffer('${t.id}')">Złóż ofertę</button>`,
      counter: `<button class="btn sm primary" onclick="ACT.spAccept('${t.id}')">Przyjmij</button> <button class="btn sm" onclick="ACT.spOffer('${t.id}')">Negocjuj</button>` }[t.stage] || '';
    return `<div class="save-item talk ${t.stage}"><div class="grow"><b>${esc(t.name)}</b> <span class="pill">${t.inbound && t.stage === 'counter' ? 'propozycja firmy' : TALK_STAGE[t.stage]}</span>${t.renewal ? ' <span class="pill">przedłużenie</span>' : ''}
      <div class="small muted">${esc(t.industry || '')}${t.interest ? ` · zainteresowanie: ${t.interest}` : ''}${t.hint ? ` · budżet: ${fmtMoney(t.hint[0], true)}–${fmtMoney(t.hint[1], true)} / sezon` : ''}${t.wants && t.hint ? ` · chce: ${t.wants.map(g => AD_GROUPS[g]).join(', ')}` : ''}${t.due && ['meeting', 'pending'].includes(t.stage) ? ` · odpowiedź ${fmtDateShort(t.due)}` : ''}${t.expires && ['counter', 'talk', 'lead'].includes(t.stage) ? ` · ważne do ${fmtDateShort(t.expires)}` : ''}</div>
      ${t.stage === 'counter' && o ? `<div class="small"><b>${esc(offerText(o))}</b></div>` : t.log && t.log.length ? `<div class="small">${esc(t.log[t.log.length - 1].t)}</div>` : ''}</div><div class="row">${act}${TALK_OPEN.includes(t.stage) && t.stage !== 'search' ? `<button class="btn sm ghost" title="Zakończ rozmowy" onclick="ACT.spDrop('${t.id}')">×</button>` : ''}</div></div>`;
  };
  return `<div class="panel stack"><div class="row"><h3 class="grow">Negocjacje</h3><button class="btn primary" ${searching ? 'disabled' : ''} onclick="ACT.findSponsors()">${searching ? 'Dział marketingu szuka partnerów…' : 'Roześlij oferty'}</button> <a class="btn" href="#/finanse/sponsorzy/rynek">Rynek firm</a></div>
    <p class="small muted">Firmy zgłaszają się same (zwłaszcza gdy cennik jest atrakcyjny) albo odpowiadają na zaproszenia. Po spotkaniu podają widełki budżetu. Ofertę składasz jako umowę na 1–3 sezony: kwota gwarantowana na każdy sezon, premie za wynik i klauzule na awans / spadek.</p>
    ${talks.filter(t => t.stage !== 'search').map(talkCard).join('') || '<p class="small muted">Brak rozmów.</p>'}</div>`;
};

// ---------- Rynek firm ----------
const SCALE_NAME = { k: 'krajowa', r: 'regionalna', l: 'lokalna', m: 'zagraniczna' };
SP_PAGES.rynek = c => {
  const pool = firmPool(c).map(f => ({ f, max: firmMax(f, c) })).sort(by(x => (x.f.clubs.includes(c.id) ? 2 : 1) * x.max, -1)).slice(0, 80);
  const band = v => v >= 1e6 ? 'ponad 1 mln' : v >= 400000 ? '400 tys.–1 mln' : v >= 150000 ? '150–400 tys.' : v >= 50000 ? '50–150 tys.' : 'do 50 tys.';
  const used = (c.fin.invites || {})[G.date.slice(0, 7)] || 0;
  return `<div class="panel flush"><div class="ph"><h3>Firmy, z którymi można rozmawiać</h3><span class="small muted">zaproszenia w tym miesiącu: ${used}/4</span></div><div class="scroll-x"><table class="t"><thead><tr><th>Firma</th><th>Branża</th><th>Skala</th><th>Związek z klubem</th><th>Budżet na klub (szac.)</th><th></th></tr></thead><tbody>
    ${pool.map(({ f, max }) => `<tr><td><b>${esc(f.name)}</b>${f.title ? ' <span class="pill" title="Może zostać sponsorem tytularnym">tytularny</span>' : ''}<div class="small muted">${esc(f.note || '')}</div></td><td>${esc(f.industry)}</td><td>${SCALE_NAME[f.scale] || ''}</td>
      <td class="small">${f.clubs.includes(c.id) ? 'region / historia współpracy' : f.status === 'byly' ? 'dawny sponsor żużla' : f.status === 'potencjalny' ? 'potencjalny' : '—'}</td><td>${band(max)}</td>
      <td><button class="btn sm" ${used >= 4 ? 'disabled' : ''} onclick="ACT.spInvite('${f.key}')">Zaproś</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Brak firm</td></tr>'}</tbody></table></div></div>
    <p class="small muted">Lista nie obejmuje obecnych sponsorów, firm w trakcie rozmów i branż objętych wyłącznością u naszego sponsora. Budżet to orientacyjna wycena działu marketingu.</p>`;
};

// ---------- Akcje ----------
ACT.findSponsors = () => { const r = sponsorSearch(); toast(r.text, r.ok ? 'good' : 'bad'); changed(); };
ACT.spMeet = id => { const r = talkMeeting(id); toast(r.text, r.ok ? 'good' : 'bad'); changed(); };
ACT.spDrop = id => { if (!confirm('Zakończyć rozmowy z tą firmą?')) return; talkClose(id, 'Klub zakończył rozmowy.'); changed(); };
ACT.spAccept = id => { const r = talkAcceptCounter(id); toast(r.text, r.ok ? 'good' : 'bad'); changed(); };
ACT.spRenew = id => { const t = openRenewalTalk(G.sponsors[id]); ACT.spOffer(t.id); };
ACT.spRelease = id => { if (!confirm('Nie przedłużać tej umowy? Miejsca reklamowe trafią do sprzedaży na kolejny sezon.')) return; const r = spRelease(id); toast(r.text, r.ok ? 'good' : 'bad'); changed(); };
ACT.spAdvance = id => { const r = sponsorAdvance(id); toast(r.text, r.ok ? 'good' : 'bad'); changed(); };
ACT.spInvite = key => { const r = inviteFirm(key); toast(r.text, r.ok ? 'good' : 'bad'); changed(); };

// ---------- Oferta sponsorska ----------
const newOffer = (t, S) => ({ assets: {}, years: 1, plan: 'two', price: 0, amounts: [], bonuses: [], clauses: {}, from: S });
const copyOffer = o => ({ ...o, assets: { ...o.assets }, amounts: [...(o.amounts || [])], bonuses: (o.bonuses || []).map(b => ({ ...b })), clauses: { ...(o.clauses || {}) } });
ACT.spOffer = id => {
  const t = G.spTalks[id], S = sportSeason();
  const base = t.counter || t.offer;
  UI.spo = { id, o: base ? copyOffer(base) : newOffer(t, salesSeason()), auto: !base };
  if (!UI.spo.o.from) UI.spo.o.from = S;
  go(`#/finanse/oferta/${id}`);
};
const drawSpOffer = () => render();
FIN_PAGES.oferta = (c, S, fl, id) => {
  const t = G.spTalks[id];
  if (!t || !['talk', 'counter'].includes(t.stage)) return '<div class="panel"><p class="muted">Ta oferta jest nieaktualna.</p><a class="btn" href="#/finanse/sponsorzy/negocjacje">← Negocjacje</a></div>';
  if (!UI.spo || UI.spo.id !== id) { const base = t.counter || t.offer; UI.spo = { id, o: base ? copyOffer(base) : newOffer(t, salesSeason()), auto: !base }; }
  const { o } = UI.spo;
  o.bonuses = o.bonuses || []; o.clauses = o.clauses || {}; o.amounts = o.amounts || [];
  const seasons = Array.from({ length: o.years }, (_, i) => o.from + i);
  const use = {};
  for (const s of seasons) for (const [k, n] of Object.entries(slotUse(c, s, t.renewal))) use[k] = Math.max(use[k] || 0, n);
  if (UI.spo.auto) { o.price = packageValue(c, o.assets, o.from); o.amounts = seasons.map(s => packageValue(c, o.assets, s)); }
  const am = offerAmounts(o);
  const expBonus = sum(o.bonuses.map(b => sum(seasons.filter(s => !b.S || b.S === s).map(s => b.amt * bonusChance(c, b, s)))));
  const slotRow = a => { const free = a.cap - (use[a.id] || 0), n = o.assets[a.id] || 0;
    return `<tr class="${free <= 0 && !n ? 'dim' : ''}"><td>${esc(a.name.replace(/^(Kevlar|Motocykl) – /, ''))}</td><td class="num">${fmtMoney(listPrice(c, a.id, o.from), true)}</td><td class="num small muted">${free}/${a.cap}</td>
      <td class="num">${a.cap > 1 ? `<input type="number" min="0" max="${Math.max(0, free)}" value="${n}" style="width:56px" onchange="ACT.spSlot('${a.id}', +this.value)">` : `<input type="checkbox" ${n ? 'checked' : ''} ${free <= 0 && !n ? 'disabled' : ''} onchange="ACT.spSlot('${a.id}', this.checked ? 1 : 0)">`}</td></tr>`; };
  const opt = (list, v) => list.map(([k, l]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${l}</option>`).join('');
  const bonusRow = (b, i) => `<tr><td><select onchange="ACT.spBonus(${i},'t',this.value)">${opt(Object.entries(SP_BONUS).map(([k, d]) => [k, d[0]]), b.t)}</select>${b.t === 'crowd' ? ` <input type="number" step="500" min="0" value="${b.n || 0}" style="width:80px" title="próg frekwencji" onchange="ACT.spBonus(${i},'n',+this.value)">` : ''}</td>
    <td><select onchange="ACT.spBonus(${i},'S',+this.value||null)">${opt([[0, 'każdy sezon'], ...seasons.map(s => [s, `sezon ${s}`])], b.S || 0)}</select></td>
    <td class="num"><input type="number" step="10000" min="0" value="${b.amt}" style="width:100px" onchange="ACT.spBonus(${i},'amt',+this.value)"></td>
    <td class="small muted nowrap">szansa ~${pct(bonusChance(c, b, b.S || o.from))}</td><td><button class="btn sm ghost" onclick="ACT.spBonusDel(${i})">×</button></td></tr>`;
  const maxFrom = t.renewal ? [o.from] : spSeasons();
  return `<div class="panel"><div class="row" style="margin-bottom:8px"><h2 class="grow">Oferta sponsorska: ${esc(t.name)}</h2><a class="btn ghost" href="#/finanse/sponsorzy/negocjacje">← Negocjacje</a></div>
    <p class="small muted">${esc(t.industry || '')}${t.hint ? ` · deklarowany budżet: <b>${fmtMoney(t.hint[0], true)}–${fmtMoney(t.hint[1], true)}</b> na sezon` : ''}${t.wants ? ` · interesuje ją: ${t.wants.map(g => AD_GROUPS[g]).join(', ')}` : ''}</p>
    ${t.counter ? `<div class="reply counter">${t.inbound ? 'Propozycja firmy' : 'Kontroferta firmy'}: ${esc(offerText(t.counter))}</div>` : ''}
    <div class="offer-grid" style="margin-top:12px">
      <label class="fld">Od sezonu<select onchange="UI.spo.o.from=+this.value;drawSpOffer()">${maxFrom.map(s => `<option value="${s}" ${o.from === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="fld">Długość<select onchange="UI.spo.o.years=+this.value;drawSpOffer()">${[1, 2, 3].map(y => `<option value="${y}" ${o.years === y ? 'selected' : ''}>${y} ${plural(y, 'sezon', 'sezony', 'sezonów')}</option>`).join('')}</select></label>
      <label class="fld">Płatności<select onchange="UI.spo.o.plan=this.value;drawSpOffer()">${Object.entries(PAY_PLANS).map(([k, p]) => `<option value="${k}" ${o.plan === k ? 'selected' : ''}>${p.name}</option>`).join('')}</select></label>
      ${seasons.map((s, i) => `<label class="fld">Kwota gwarantowana ${s} [zł]<input type="number" step="5000" min="0" value="${am[i]}" onchange="ACT.spAmount(${i}, +this.value)"><span class="small muted">cennik: ${fmtMoney(packageValue(c, o.assets, s), true)}</span></label>`).join('')}
    </div>
    <div class="grid g2" style="margin-top:8px">${Object.entries(AD_GROUPS).map(([g, gn]) => `<div><h3 style="margin:8px 0 4px">${gn}</h3><table class="t compact"><tbody>${AD_SLOTS.filter(a => a.group === g).map(slotRow).join('')}</tbody></table></div>`).join('')}</div>
    <div class="grid g2" style="margin-top:12px"><div><h3 style="margin:8px 0 4px">Premie za wynik</h3><table class="t compact"><tbody>${o.bonuses.map(bonusRow).join('') || '<tr><td class="empty">Bez premii</td></tr>'}</tbody></table>
        <button class="btn sm" style="margin-top:6px" onclick="ACT.spBonusAdd()">+ Dodaj premię</button></div>
      <div><h3 style="margin:8px 0 4px">Klauzule</h3><div class="stack">
        ${c.league !== 'PGE' ? `<label class="fld">Po awansie kwoty w kolejnych sezonach<select onchange="UI.spo.o.clauses.up=+this.value;drawSpOffer()">${opt(UP_OPTS, o.clauses.up || 0)}</select></label>` : ''}
        ${c.league !== 'KLZ' ? `<label class="fld">Po spadku<select onchange="UI.spo.o.clauses.down=+this.value;drawSpOffer()">${opt(DOWN_OPTS, o.clauses.down || 0)}</select></label>` : ''}
        <label class="row small"><input type="checkbox" ${o.clauses.excl ? 'checked' : ''} onchange="UI.spo.o.clauses.excl=this.checked;drawSpOffer()"> Wyłączność branżowa (żadna firma z branży „${esc(t.industry || '')}” u nas w czasie umowy)</label></div></div></div>
    ${UI.spo.auto ? '' : '<button class="btn sm ghost" style="margin-top:8px" onclick="UI.spo.auto=true;drawSpOffer()">Kwoty wg cennika</button>'}
    <div class="kv" style="margin-top:12px"><div>Gwarantowane łącznie</div><div><b>${fmtMoney(sum(am))}</b></div><div>Oczekiwane premie (wg szans)</div><div>${fmtMoney(expBonus)}</div><div>Wartość cennikowa pakietu</div><div>${fmtMoney(sum(seasons.map(s => packageValue(c, o.assets, s))))}</div></div>
    <p class="small muted">Firma porównuje oczekiwany koszt umowy (kwoty + premie × szansa) z wartością miejsc dla niej. Klauzula obniżki po spadku zmniejsza jej ryzyko, podwyżka po awansie – zwiększa. Wyłączność branżowa jest warta ok. 12% więcej. Firmy wolą raty niż jedną wpłatę z góry.</p>
    ${UI.spo.err ? `<div class="reply blocked">${esc(UI.spo.err)}</div>` : ''}
    <div class="row" style="justify-content:flex-end;margin-top:14px"><a class="btn ghost" href="#/finanse/sponsorzy/negocjacje">Anuluj</a><button class="btn primary" onclick="ACT.spSend()">Wyślij ofertę</button></div></div>`;
};
ACT.spSlot = (k, n) => { const o = UI.spo.o; if (n > 0) o.assets[k] = n; else delete o.assets[k]; if (k === 'name' && n && !o.assets.chest && slotFree(myClub(), o.from, 'chest') > 0) o.assets.chest = 1; /* podpowiedź – można odznaczyć */ UI.spo.err = null; drawSpOffer(); };
ACT.spAmount = (i, v) => { const o = UI.spo.o; UI.spo.auto = false; o.amounts = offerAmounts(o); o.amounts[i] = round1k(v); if (i === 0) o.price = o.amounts[0]; drawSpOffer(); };
ACT.spBonusAdd = () => { const c = myClub(); UI.spo.o.bonuses.push({ t: c.league === 'PGE' ? 'medal' : 'promo', amt: round1k(Math.max(20000, (UI.spo.o.price || 100000) * 0.2)), S: null }); drawSpOffer(); };
ACT.spBonus = (i, k, v) => { UI.spo.o.bonuses[i][k] = v; drawSpOffer(); };
ACT.spBonusDel = i => { UI.spo.o.bonuses.splice(i, 1); drawSpOffer(); };
ACT.spSend = () => {
  const o = UI.spo.o;
  if (UI.spo.auto === false && o.amounts && o.amounts.length && o.price !== o.amounts[0]) o.amounts[0] = o.price; // kwota ustawiona bezpośrednio (np. test)
  const r = talkOffer(UI.spo.id, o);
  if (!r.ok) { UI.spo.err = r.text; return drawSpOffer(); }
  UI.spo = null; toast(r.text, 'good'); dbQueueSave(); go('#/finanse/sponsorzy/negocjacje');
};

// ---------- Liga i miasto ----------
FIN_PAGES.liga = (c, S) => {
  const lg = FL(c), lp = LEAGUE_PAY[c.league] || {}, f = c.fin;
  const n = Object.values(G.clubs).filter(x => x.league === c.league && clubActive(x)).length || 8;
  const passes = (f.passes || {})[S] || 0;
  const reserveBack = sum(f.reserve.filter(r => r.season + 3 === S).map(r => r.amount));
  const pj = typeof PRO_JUNIOR_POOL !== 'undefined' && c.league === 'PGE';
  const rows = [
    [lp.tv || 'Prawa TV', lg.tv, 'równy podział między kluby ligi; raty marzec, maj, lipiec, wrzesień'],
    lg.reserve ? [lp.reserve, -lg.reserve, 'część wypłaty TV zamrożona przez ligę na 3 sezony – zabezpieczenie zobowiązań klubów'] : null,
    lg.title ? [lp.title, lg.title, 'udział klubu w umowie sponsora rozgrywek; kwiecień i wrzesień'] : null,
    reserveBack ? ['Zwrot z funduszu rezerwowego', reserveBack, `środki zamrożone ${S - 3} r. – listopad`] : null,
    lg.attract ? ['Fundusz Atrakcyjności', null, `${fmtMoney(lg.attract, true)} dla ligi wg mijanek w meczach domowych; nasze mijanki w ${S}: ${passes}`] : null,
    pj ? ['Ekstraliga Pro Junior System', null, `${fmtMoney(PRO_JUNIOR_POOL, true)} dla ligi za punkty wychowanków-juniorów`] : null,
    ['Nagrody za medale', null, `${lg.prizes.map(x => fmtMoney(x, true)).join(' / ')} za miejsca 1–3`],
  ].filter(Boolean);
  const fixed = sum(rows.map(r => r[1] || 0));
  const g = cityGrants(c, S), city = f.city;
  const cRows = [
    ['Dotacja na rozwój sportu', g.sport, 'środki ogólne', 'udział w rozgrywkach, kontrakty, organizacja meczów; raty marzec–wrzesień'],
    ['Umowa promocyjna', g.promo, 'środki ogólne', 'usługa promocyjna dla miasta / regionu (logo, akcje); kwiecień, lipiec'],
    ['Dokapitalizowanie spółki', g.equity, 'środki ogólne', 'miasto – właściciel klubu obejmuje nowe akcje'],
    ['Szkolenie dzieci i młodzieży', g.youth, 'dotacja celowa', 'tylko koszty szkółki; niewydane środki wracają do miasta'],
    ...g.own.map(([nm, a]) => [nm, a, 'dotacja celowa', 'tylko organizacja tego turnieju']),
  ].filter(r => r[1]);
  const evG = Object.entries(f.evGrants || {}).filter(([id, a]) => a && G.events[id] && fyOf(G.events[id].date) === S).map(([id, a]) => [G.events[id].name, a]);
  const e = (f.earmark || {})[S] || { youth: { granted: 0, spent: 0 }, events: { granted: 0, spent: 0 } };
  const left = earmarkLeft(c, S);
  // prognoza szkółki do 31.10 vs dotacja celowa
  const monthsLeft = FY_MONTHS.indexOf(Number(G.date.slice(5, 7))) >= 0 ? 12 - FY_MONTHS.indexOf(Number(G.date.slice(5, 7))) - (Number(G.date.slice(8, 10)) > 1 ? 1 : 0) : 0;
  const youthPlan = g.youth, youthSpendTot = e.youth.spent + (c.academyBudget || 0) / 12 * Math.max(0, monthsLeft);
  return `<div class="grid g2"><div class="panel flush"><div class="ph"><h3>Wypłaty ${esc(LEAGUES[c.league].name)} – sezon ${S}</h3><b>${fmtMoney(fixed, true)}</b></div>
      <table class="t"><thead><tr><th>Pozycja</th><th class="num">Kwota</th><th>Za co / kiedy</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="num ${r[1] < 0 ? 'neg' : ''}">${r[1] == null ? '<span class="muted">wg wyniku</span>' : fmtMoney(r[1], true)}</td><td class="small muted">${esc(r[2])}</td></tr>`).join('')}</tbody></table>
      <p class="small muted" style="padding:0 12px 10px">Kwoty z umów ligi (Canal+, PGE, Metalkas) podzielone równo między ${n} klubów. ${c.league === 'KLZ' ? 'Krajowa Liga Żużlowa nie ma umowy telewizyjnej – kluby transmitują mecze same.' : ''}</p></div>
    <div class="panel flush"><div class="ph"><h3>Miasto ${esc(c.city)} – sezon ${S}</h3><b>${fmtMoney(cityAmount(c, S) + sum(evG.map(x => x[1])), true)}</b></div>
      <table class="t"><thead><tr><th>Składnik</th><th class="num">Kwota</th><th>Rodzaj</th><th>Przeznaczenie</th></tr></thead><tbody>
      ${cRows.map(r => `<tr><td>${esc(r[0])}</td><td class="num">${fmtMoney(r[1], true)}</td><td>${r[2] === 'dotacja celowa' ? '<span class="pill u24">celowa</span>' : '<span class="small muted">ogólne</span>'}</td><td class="small muted">${esc(r[3])}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Miasto nie wspiera klubu</td></tr>'}
      ${evG.map(([nm, a]) => `<tr><td>${esc(nm)}</td><td class="num">${fmtMoney(a, true)}</td><td><span class="pill u24">celowa</span></td><td class="small muted">organizacja zawodów na naszym stadionie</td></tr>`).join('')}</tbody></table>
      <p class="small muted" style="padding:0 12px 10px">${city.granted[S] == null ? 'Szacunek – rada miasta decyduje 1 grudnia. ' : ''}Imprezy z kalendarza (Grand Prix, finał IMP, Złoty Kask, memoriały) dostają osobną dotację celową tylko wtedy, gdy odbywają się na naszym stadionie (np. Grand Prix: Gorzów 2,5 mln, Toruń 2,05 mln, Wrocław 1,75 mln zł). Wniosek o środki ogólne: Finanse → Finansowanie.</p></div></div>
    <div class="panel" style="margin-top:16px"><h3>Dotacje celowe – rozliczenie roku ${S} (do 31 października)</h3>
      <table class="t"><thead><tr><th>Cel</th><th class="num">Wpłynęło</th><th class="num">Wydano na cel</th><th class="num">Do wydania</th><th></th></tr></thead><tbody>
        <tr><td>Szkolenie dzieci i młodzieży</td><td class="num">${fmtMoney(e.youth.granted, true)}</td><td class="num">${fmtMoney(Math.min(e.youth.spent, e.youth.granted || e.youth.spent), true)}</td><td class="num ${left.youth ? 'pos' : ''}">${fmtMoney(left.youth, true)}</td>
          <td class="small ${youthSpendTot < youthPlan ? 'neg' : 'muted'}">${youthPlan ? (youthSpendTot < youthPlan ? `przy obecnym budżecie szkółki zabraknie wydatków ok. ${fmtMoney(youthPlan - youthSpendTot, true)} – ta kwota wróci do miasta` : 'budżet szkółki pokrywa dotację') : '—'}</td></tr>
        <tr><td>Organizacja imprez</td><td class="num">${fmtMoney(e.events.granted, true)}</td><td class="num">${fmtMoney(Math.min(e.events.spent, e.events.granted || e.events.spent), true)}</td><td class="num ${left.events ? 'pos' : ''}">${fmtMoney(left.events, true)}</td><td class="small muted">koszty organizacji turniejów i Grand Prix</td></tr></tbody></table>
      <div class="kv" style="margin-top:10px"><div>Saldo klubu</div><div>${fmtMoney(c.cash)}</div><div>w tym środki celowe (nie na kontrakty)</div><div>${fmtMoney(left.youth + left.events)}</div><div>Saldo dostępne</div><div class="${freeCash(c) < 0 ? 'neg' : ''}"><b>${fmtMoney(freeCash(c))}</b></div></div>
      <p class="small muted">Dotacja celowa może być wydana wyłącznie na cel z umowy z miastem. 31 października klub rozlicza dotacje – niewykorzystaną część zwraca do budżetu miasta (por. Stal Gorzów, 2025).</p></div>`;
};
