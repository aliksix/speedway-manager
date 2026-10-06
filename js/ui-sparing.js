'use strict';
// Ekrany sparingów: Kalendarz → Sparingi (lista, zaproszenie rywala, asystent) i strona sparingu (skład, protokół).

UI.spar = UI.spar || { opp: '', date1: '', date2: '', pair: true, home: true, tickets: 0 };

function sparRow(s) {
  const me = s.homeId === G.clubId ? 'H' : 'A', op = me === 'H' ? 'A' : 'H';
  const res = s.score ? `<span class="${s.score[me] > s.score[op] ? 'pos' : s.score[me] < s.score[op] ? 'neg' : ''}">${s.score.H}:${s.score.A}</span>` : '';
  const act = s.status === 'invite' ? `<button class="btn primary sm" onclick="event.stopPropagation();ACT.sparInvite('${s.id}',1)">Przyjmij</button> <button class="btn sm" onclick="event.stopPropagation();ACT.sparInvite('${s.id}',0)">Odrzuć</button>`
    : ['pending', 'agreed'].includes(s.status) && s.date > G.date ? `<button class="btn ghost sm" onclick="event.stopPropagation();ACT.sparCancel('${s.id}')">Odwołaj</button>` : '';
  const cls = { agreed: '', played: '', pending: 'muted', invite: 'warn', cancelled: 'muted', rejected: 'muted' }[s.status];
  return `<tr class="click" onclick="go('#/kalendarz/sparing/${s.id}')"><td>${fmtDateShort(s.date)} <span class="small muted">${DAYS_SHORT[dow(s.date)]}</span></td>
    <td>${crest(G.clubs[s.homeId], 'sm')} <b>${esc(sparName(s))}</b>${s.homeId === G.clubId ? ' <span class="small muted">(u siebie)</span>' : ''}</td><td class="small">${sparLegLabel(s)}</td>
    <td class="small ${cls}">${SPAR_ST[s.status]}${s.note ? ` – ${esc(s.note)}` : ''}${s.via === 'asystent' ? ' · asystent' : ''}</td><td class="small">${SPAR_TICKETS[s.tickets] || ''}</td><td class="num">${res}</td><td class="num">${act}</td></tr>`;
}
function sparingsPage(T) {
  const S = sparSeason(), [w0, w1] = sparWindow(S), list = sparOf(G.clubId, S), first = sparFirstMatch(G.clubId, S);
  const active = list.filter(s => ['agreed', 'played'].includes(s.status)).length;
  const open = G.date <= addDays(w1, -3);
  const U = UI.spar;
  if (!U.date1 || U.date1 < addDays(G.date, 3) || U.date1 > w1) U.date1 = [addDays(G.date, 3), `${S}-03-20`].sort()[1];
  if (!U.date2 || U.date2 === U.date1) U.date2 = addDays(U.date1, 1);
  const clubs = sparClubs(S).filter(c => c.id !== G.clubId).sort(by(c => (4 - (SPAR_LVL[c.league] || 1)) * 10000 + sparKm(c.id, G.clubId)));
  const opp = U.opp && G.clubs[U.opp];
  let hint = '';
  if (opp) {
    const p = sparChance(sparInterest(opp.id, G.clubId, { pair: U.pair, oppHome: !U.home })), [l, c] = sparChanceLabel(p);
    const busy = sparOf(opp.id, S).filter(s => ['agreed', 'pending', 'played'].includes(s.status)).map(s => fmtDateShort(s.date).slice(0, 5));
    const lg = clubFixtures(opp.id, S).filter(f => f.date <= w1).map(f => fmtDateShort(f.date).slice(0, 5));
    hint = `<div class="small" style="margin-top:8px">Asystent: szanse na zgodę <b class="${c}">${l}</b> · ${sparKm(opp.id, G.clubId)} km · ${esc(LEAGUES[opp.league].short)}<br>
      <span class="muted">Zajęte terminy rywala w oknie: ${[...busy.map(d => d + ' sparing'), ...lg.map(d => d + ' liga')].join(', ') || 'brak'}</span></div>`;
  }
  const form = open ? `<div class="panel"><div class="ph"><h3>Zaproponuj sparing</h3><button class="btn" onclick="ACT.sparAssistant()">Zleć asystentowi</button></div>
    <div class="row wrap" style="gap:10px;align-items:flex-end">
      <label>Rywal<br><select onchange="UI.spar.opp=+this.value||'';render()"><option value="">— wybierz klub —</option>${LEAGUE_ORDER.map(lg => `<optgroup label="${esc(LEAGUES[lg].name)}">${clubs.filter(c => c.league === lg).map(c => `<option value="${c.id}" ${Number(U.opp) === c.id ? 'selected' : ''}>${esc(c.name)} (${sparKm(c.id, G.clubId)} km)</option>`).join('')}</optgroup>`).join('')}</select></label>
      <label>Forma<br><select onchange="UI.spar.pair=this.value==='1';render()"><option value="1" ${U.pair ? 'selected' : ''}>dwumecz (mecz i rewanż)</option><option value="0" ${!U.pair ? 'selected' : ''}>jeden mecz</option></select></label>
      <label>${U.pair ? '1. mecz' : 'Gospodarz'}<br><select onchange="UI.spar.home=this.value==='1';render()"><option value="1" ${U.home ? 'selected' : ''}>u nas</option><option value="0" ${!U.home ? 'selected' : ''}>u rywala</option></select></label>
      <label>${U.pair ? 'Data 1. meczu' : 'Data'}<br><input type="date" value="${U.date1}" min="${addDays(G.date, 3) > w0 ? addDays(G.date, 3) : w0}" max="${w1}" onchange="UI.spar.date1=this.value;UI.spar.date2=addDays(this.value,1);render()"></label>
      ${U.pair ? `<label>Data rewanżu<br><input type="date" value="${U.date2}" min="${w0}" max="${w1}" onchange="UI.spar.date2=this.value;render()"></label>` : ''}
      <label>Bilety (u nas)<br><select onchange="UI.spar.tickets=+this.value">${Object.entries(SPAR_TICKETS).map(([k, l]) => `<option value="${k}" ${Number(U.tickets) === Number(k) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn primary" onclick="ACT.sparPropose()" ${opp ? '' : 'disabled'}>Wyślij zaproszenie</button></div>${hint}</div>`
    : `<div class="panel muted">Okno sparingowe sezonu ${S} jest zamknięte.</div>`;
  return { title: 'Kalendarz', sub: `Sezon ${S} · sparingi przed sezonem`, tabs: T, body: `
    <div class="panel"><div class="kv"><div>Okno sparingowe</div><div>${fmtDate(w0)} – ${fmtDate(w1)} (pierwszy mecz ligowy: ${fmtDay(first)})</div>
      <div>Umówione / rozegrane</div><div><b>${active}</b> <span class="small muted">– kluby jeżdżą zwykle 4–6 sparingów, najczęściej dwumecze dzień po dniu (np. Sparta 2026: Włókniarz 24/25.03, Unia 1/2.04, Ostrów 8 i 23.04)</span></div>
      <div>Co dają sparingi</div><div class="small">rytm startowy i technikę jazdy (trening), formę przed ligą, test sprzętu na torze, obserwację rywali. Wynik nie liczy się do statystyk ani licencji. Jest ryzyko kontuzji. Organizacja kosztuje, a bilety (jeśli są płatne) dają niewielki przychód.</div>
      <div>Kluby AI</div><div class="small">${G.sparPlanned && G.sparPlanned[S] ? `ustaliły swoje sparingi ${fmtDateShort(G.sparPlanned[S])} – wolnych terminów jest mniej` : `układają swoje sparingi ${fmtDateShort(`${S}-${SPAR_AI_PLAN}`)}. Wcześniej łatwiej o rywala i termin`}</div></div></div>
    ${form}
    <div class="panel flush"><div class="ph"><h3>Nasze sparingi</h3></div>${list.length ? `<table class="t"><thead><tr><th>Data</th><th>Mecz</th><th>Forma</th><th>Status</th><th>Bilety</th><th class="num">Wynik</th><th></th></tr></thead><tbody>${list.map(sparRow).join('')}</tbody></table>` : '<div class="empty">Brak sparingów – zaproś rywala albo zleć to asystentowi.</div>'}</div>` };
}
function sparingPage(id, sub = '') {
  const s = G.sparings && G.sparings[id];
  if (!s) return { title: 'Nie znaleziono sparingu', body: '<a href="#/kalendarz/sparingi">Sparingi</a>' };
  const h = G.clubs[s.homeId], a = G.clubs[s.awayId], m = s.match, mine = s.homeId === G.clubId || s.awayId === G.clubId;
  const w = m ? m.weather : weatherFor(s.date, G.seed);
  const head = `<div class="page-head"><div class="small muted"><a href="#/kalendarz/sparingi">Sparingi</a> · ${sparLegLabel(s)} · ${fmtDay(s.date)} · ${SPAR_ST[s.status]}${s.note ? ` (${esc(s.note)})` : ''}</div>
    <div class="scoreboard"><div class="team"><a href="${clubHref(h.id)}">${crest(h, 'lg')}</a><span>${esc(h.name)}<div class="small muted" style="text-transform:none">gospodarz · ${esc(h.stadium.name)}</div></span></div>
      <div class="score">${m ? `${m.score.H} : ${m.score.A}` : s.score ? `${s.score.H} : ${s.score.A}` : 'vs'}<small>sparing${m && !m.done ? ` · po ${m.heats.length} z 15 biegów` : ''}${s.att ? ` · ${fmtNum(s.att)} widzów` : ''}</small></div>
      <div class="team away"><a href="${clubHref(a.id)}">${crest(a, 'lg')}</a><span>${esc(a.name)}<div class="small muted" style="text-transform:none">goście</div></span></div></div>
    ${s.status !== 'played' ? `<div class="weather"><span>prognoza: 🌡 ${w.temp}°C</span><span>${esc(w.sky)}</span><span>${SPAR_TICKETS[s.tickets] || ''}</span></div>` : ''}
    ${m ? tabs(`kalendarz/sparing/${s.id}`, [['', 'Przebieg'], ['protokol', 'Protokół'], ['program', 'Program']], sub) : '<div style="height:14px"></div>'}</div>`;
  // przebieg na żywo jak w meczu ligowym: rezerwy zwykłe i taktyczne, nominacje do biegów 14–15, wybór silnika na bieg
  if (m) return { head, body: sub === 'protokol' ? protocol(m) : sub === 'program' ? programView(m) : matchLive(m, null) };
  if (s.status === 'played') return { head, body: `<div class="panel"><b>Najskuteczniejsi:</b> ${(s.top || []).map(t => `${riderLink(t.id)} ${t.pts}${t.bonus ? '+' + t.bonus : ''}`).join(', ')}</div>` };
  if (!mine || !['agreed', 'invite', 'pending'].includes(s.status)) return { head, body: '' };
  // skład sparingowy gracza: wybór na numery 1–8 (puste = automatycznie najlepsi dostępni), wszyscy zawodnicy klubu
  const line = s.lineup || Array(8).fill(null), auto = sparLineup(G.clubId, s.date, s.lineup); // skład, który pojedzie (z uzupełnieniem automatu)
  const rs = clubRiders(G.clubId).filter(r => !r.retired).sort(by(r => r.skill, -1));
  const base = s.homeId === G.clubId ? 9 : 1;
  const lg = G.clubs[G.clubId].league, okFor = (r, i) => sparAvail(r, s.date) && slotOk(r, i, lg, s.date);
  const today = s.status === 'agreed' && s.date === G.date;
  const start = today ? `<div class="panel next-heat" style="margin-bottom:16px"><div class="row wrap"><div class="grow"><b>Dzień sparingu!</b> Ustaw skład i rozpocznij – sparing jedzie się jak mecz ligowy, bieg po biegu (rezerwy, nominacje, silniki). „Dalej” bez rozpoczęcia – symulacja całości.</div>
      <button class="btn primary lg" onclick="ACT.sparStart('${s.id}')">Rozpocznij sparing</button><button class="btn" onclick="ACT.sparQuick('${s.id}')">Symuluj cały sparing</button></div></div>` : '';
  return { head, body: `${start}${trackPrepPanel('S' + s.id, s.homeId, s.awayId, auto)}<div class="panel flush"><div class="ph"><h3>Skład na sparing</h3><span class="small muted">Zasady jak w lidze: juniorzy na 6–7, U24 na 8 i wśród 1–5, co najmniej 4 zawodników krajowych. Puste pole = zawodnik z Taktyki (braki uzupełnia asystent).</span></div>
    <table class="t"><tbody>${line.map((rid, i) => `<tr><td style="width:40px"><b>${base + i}</b></td><td class="small muted" style="width:90px">${SLOT_LABEL(i + 1)}</td><td><select onchange="ACT.sparLine('${s.id}',${i},+this.value||null)"><option value="">auto${auto[i] && G.riders[auto[i]] ? `: ${esc(G.riders[auto[i]].name)}` : ''}</option>
      ${rs.map(r => `<option value="${r.id}" ${rid === r.id ? 'selected' : ''} ${okFor(r, i) ? '' : 'disabled'}>${esc(r.name)}${isJunior(r) ? ' (U21)' : isU24(r) ? ' (U24)' : ''}${!sparAvail(r, s.date) ? ' – niedostępny' : !slotOk(r, i, lg, s.date) ? ' – nie na ten numer' : ''}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` };
}
// Wpisy sparingów w widoku miesiąca kalendarza
function sparCalEntries(days) {
  const out = [];
  for (const s of sparAll()) {
    if (!days.includes(s.date) || !['agreed', 'played', 'invite', 'pending'].includes(s.status)) continue;
    const mine = s.homeId === G.clubId || s.awayId === G.clubId;
    if (!mine && !UI.calAll) continue;
    out.push([s.date, `<div class="ev k-spar ${mine ? 'mine' : ''}" onclick="go('#/kalendarz/sparing/${s.id}')" title="Sparing ${esc(G.clubs[s.homeId].name)} – ${esc(G.clubs[s.awayId].name)}">${esc(sparName(s))}${s.score ? ` <span class="res">${s.score.H}:${s.score.A}</span>` : ''}<div class="small muted">sparing${s.status === 'invite' ? ' · zaproszenie' : s.status === 'pending' ? ' · czeka' : ''}</div></div>`]);
  }
  return out;
}
ACT.sparPropose = () => {
  const U = UI.spar;
  const r = sparPropose({ oppId: U.opp, date1: U.date1, date2: U.pair ? U.date2 : null, home: U.home, tickets: U.tickets });
  toast(r.text, r.ok ? 'good' : 'bad');
  if (r.ok) { U.opp = ''; changed(); }
};
ACT.sparAssistant = () => { const r = sparAssistant(); toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) changed(); };
ACT.sparInvite = (id, yes) => { const r = sparInviteAnswer(id, !!yes); toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) changed(); };
ACT.sparCancel = id => { const r = sparCancel(id); toast(r.text, r.ok ? 'good' : 'bad'); if (r.ok) changed(); };
ACT.sparStart = id => {
  const s = G.sparings[id];
  if (!s || s.date !== G.date || s.status !== 'agreed') return;
  if (!sparWeather(s, G.date)) { changed(); return toast('Sparing przełożony albo odwołany z powodu pogody.', 'bad'); }
  if (!sparBegin(s)) { changed(); return toast('Sparing odwołany – brak zawodników.', 'bad'); }
  changed();
};
ACT.sparQuick = id => { ACT.sparStart(id); const s = G.sparings[id]; if (s && s.match && !s.match.done) { simulateMatch(s.match); changed(); toast(`Koniec sparingu: ${s.match.score.H}:${s.match.score.A}`, 'good'); } };
ACT.sparLine = (id, i, rid) => {
  const s = G.sparings[id];
  if (!s) return;
  const line = s.lineup || Array(8).fill(null);
  if (rid) for (let k = 0; k < 8; k++) if (line[k] === rid) line[k] = null;
  line[i] = rid;
  s.lineup = line.some(Boolean) ? line : null;
  changed();
};
