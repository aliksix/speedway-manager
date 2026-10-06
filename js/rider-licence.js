'use strict';
// Licencja żużlowa zawodnika (Regulamin Szkolenia w Sporcie Żużlowym 2026, cz. V; tekst: data/minizuzel-regulaminy): ważna do 31 grudnia;
// przedłuża się na następny rok, jeśli zawodnik przejechał w sezonie co najmniej 5 biegów w zawodach o mistrzostwo Polski (liga, DMPJ, MIMP,
// U24 i inne), o nagrody PZM albo towarzyskich – sparingi (pkt 25); gra liczy też starty za granicą.
// Nowo wydana licencja jest przedłużona automatycznie na rok następny (pkt 27) – bez wymogu 5 biegów w roku wydania.
// Bez 5 biegów licencja wygasa i powrót wymaga zdania egzaminu na licencję „Ż” (sesje egzaminacyjne z kalendarza PZM).
// Stany zawodnika: licencja ważna (active), licencja wygasła (!active, licExpired = pierwszy sezon bez licencji) – trwa, dopóki zawodnik nie zda egzaminu
// albo nie ogłosi końca kariery (retired – decyzja ostateczna, bez powrotów).
// Zasada dotyczy licencji PZM (zawodnicy polscy); zagraniczni mają licencje swoich federacji.
const LIC_MIN_HEATS = 5;
const licValid = r => !!r && !!r.active && !r.retired;
// Licencja PZM: Polacy (także z podwójnym obywatelstwem); obcokrajowcy jeżdżą na licencjach swoich federacji – bez reguły 5 biegów i egzaminu „Ż”
const polLicence = r => typeof hasNat === 'function' ? hasNat(r, 'POL') : r.country === 'POL';
const licState = r => r.retired ? 'retired' : r.active ? 'ok' : 'expired';
function licText(r) {
  if (r.retired) return `zakończył karierę${r.retiredOn ? ` (${r.retiredOn})` : ''}`;
  if (!polLicence(r)) return `licencja federacji krajowej${r.lastSeason && r.lastSeason < G.season - 1 ? ` · ostatni sezon w polskiej lidze: ${r.lastSeason}` : ''}`;
  if (!r.active) return `licencja wygasła${r.licExpired ? ` (od sezonu ${r.licExpired})` : ''}${r.lastSeason ? ` · ostatni sezon ligowy: ${r.lastSeason}` : ''}`;
  return 'licencja ważna';
}
// Biegi zawodnika w roku Y: wszystkie mecze i zawody z historii startów (G.matches) oraz ligi zagraniczne (r.fstats); bez sparingów treningowych
function licHeatsIndex(Y) {
  const idx = new Map(), y = String(Y);
  for (const m of Object.values(G.matches)) {
    if (!m.done || !m.riders || !m.date || m.date.slice(0, 4) !== y) continue;
    for (const [rid, s] of Object.entries(m.riders)) if (s && s.heats) idx.set(String(rid), (idx.get(String(rid)) || 0) + s.heats);
  }
  return idx;
}
function licHeats(r, Y, idx = licHeatsIndex(Y)) {
  const foreign = sum(Object.values((r.fstats || {})[Y] || {}).map(s => s.h || 0));
  return (idx.get(String(r.id)) || 0) + foreign + ((r.lfh || {})[Y] || 0) + licPreGameHeats(r, Y);
}
// Biegi w zawodach towarzyskich (sparingi) – roczny licznik do przedłużenia licencji (pkt 25)
function licFriendly(r, date, heats) {
  if (!r || !heats) return;
  const y = Number(date.slice(0, 4));
  r.lfh = r.lfh || {};
  r.lfh[y] = (r.lfh[y] || 0) + heats;
  for (const k of Object.keys(r.lfh)) if (Number(k) < y - 1) delete r.lfh[k];
}
// Data wydania licencji „Ż” (ISO): egzamin w grze, najnowsza licencja z historii PSD (dd.mm.rrrr), wychowanek z pierwszym kontraktem
function licIssueDate(r) {
  if (r.licence && /^\d{4}-/.test(r.licence.date || '')) return r.licence.date;
  const h = typeof RIDER_HIST !== 'undefined' && RIDER_HIST.riders ? RIDER_HIST.riders[r.psdSlug] || RIDER_HIST.riders[nameSlug(r.name)] : null;
  const iso = d => { const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  const ds = h && h.licenses ? h.licenses.map(l => iso(l.date)).filter(Boolean).sort() : [];
  if (ds.length) return ds[ds.length - 1];
  if (r.academyGraduate && r.contract && /^wychowanek/.test(r.contract.source || '') && r.contract.signed) return r.contract.signed;
  if (r.academyGraduate && /świeża licencja/.test(r.profile || '') && r.hist && r.hist[0] && r.hist[0].d) return r.hist[0].d; // wychowanek utworzony w grze
  return null;
}
// Rok startu gry: biegi ligowe sprzed 15 października z historii (Polish Speedway Database); bez danych – starty w sezonie wg bazy
function licPreGameHeats(r, Y) {
  if (Y > Number(GAME_START.slice(0, 4))) return 0;
  const h = typeof RIDER_HIST !== 'undefined' ? (RIDER_HIST.riders[r.psdSlug] || RIDER_HIST.riders[nameSlug(r.name)]) : null;
  const n = h ? sum(h.seasons.filter(s => s.season === Y).map(s => s.heats || 0)) : 0;
  return n || ((r.lastSeason || 0) >= Y ? LIC_MIN_HEATS : 0);
}
// 31 grudnia: przegląd licencji (wywoływane z newDay)
function licYearEnd(Y = Number(G.date.slice(0, 4))) {
  const idx = licHeatsIndex(Y), startY = Number(GAME_START.slice(0, 4));
  const mine = [];
  for (const r of Object.values(G.riders)) {
    if (!licValid(r) || !polLicence(r)) continue;
    if ((licIssueDate(r) || '').slice(0, 4) === String(Y)) continue; // nowo wydana licencja – przedłużona automatycznie na rok następny (pkt 27)
    const n = licHeats(r, Y, idx); // w roku startu gry z biegami sprzed początku gry (licPreGameHeats)
    if (n >= LIC_MIN_HEATS) continue;
    r.active = false; r.licExpired = Y + 1; r.examRegistered = r.clubId && r.clubId !== G.clubId; // kluby AI zgłaszają swoich zawodników od razu
    if (r.clubId === G.clubId) mine.push(`${esc(r.name)} – ${n} ${plural(n, 'bieg', 'biegi', 'biegów')}`);
  }
  if (mine.length) addMsg({ category: 'transfer', from: 'Polski Związek Motorowy', stop: true, title: `Wygasłe licencje: ${mine.length}`,
    body: `<p>Licencja żużlowa przedłuża się na kolejny rok tylko po co najmniej ${LIC_MIN_HEATS} biegach w sezonie. Licencje wygasły:</p><ul>${mine.map(x => `<li>${x}</li>`).join('')}</ul>
      <p>Do czasu zdania egzaminu na licencję „Ż” ci zawodnicy nie mogą startować. Zgłoś ich na najbliższą sesję egzaminacyjną w profilu zawodnika.</p>`, link: '#/druzyna/lista' });
}
// Najbliższa sesja egzaminacyjna
function nextExamEvent(from = G.date) { return Object.values(G.events).filter(e => e.comp === 'EXAM' && e.date >= from && !e.played).sort(by(e => e.date))[0] || null; }
// Kandydaci powracający na egzamin: wygasła licencja, kontrakt z klubem, zgłoszenie (klub gracza) lub automatycznie (kluby AI); ponowne podejście po ok. 2 miesiącach
function licExamCandidates(date) {
  return Object.values(G.riders).filter(r => licState(r) === 'expired' && r.clubId && G.clubs[r.clubId] && (r.clubId === G.clubId ? r.examRegistered : true)
    && !r.injury && !(r.examLast && dayDiff(r.examLast, date) < 50));
}
// Szansa zdania egzaminu przez byłego zawodnika (część praktyczna i teoretyczna) – zależy od obecnych umiejętności
const licExamChance = r => clamp(0.62 + ((r.ca ?? r.skill * 5) - 25) / 70, 0.55, 0.97);
function licExamRun(ev, m) {
  for (const r of licExamCandidates(ev.date)) {
    r.examLast = ev.date;
    const ok = mulberry(hashStr(r.id + ev.id))() < licExamChance(r);
    m.exam.push({ name: r.name, clubId: r.clubId, schoolId: null, kidId: null, ca: round1(r.ca ?? r.skill * 5), pa: round1(r.pa ?? r.potential), ok, riderId: r.id, returning: true });
    if (ok) licRestore(r, ev);
    else if (r.clubId === G.clubId) r.examRegistered = false;
  }
}
// Zdany egzamin: licencja ważna; rdza po przerwie (spadek umiejętności zależny od liczby straconych sezonów, szybki powrót w treningu)
function licRestore(r, ev) {
  // pełne sezony bez jazdy: od ostatniego sezonu ze startami (baza, starty w grze, ligi zagraniczne) do poprzedniego sezonu
  const rode = [r.lastSeason || 0, ...Object.keys(r.stats || {}).filter(y => (r.stats[y].heats || 0) > 0).map(Number), ...Object.keys(r.fstats || {}).map(Number)];
  const off = Math.max(0, G.season - 1 - Math.max(...rode));
  r.active = true; r.examRegistered = false;
  r.licence = { ...(r.licence || {}), date: G.date, place: ev ? ev.venue || '' : '', renewed: true };
  delete r.licExpired;
  if (off >= 1 && r.ca != null && r.attrs) {
    const drop = Math.min(16, 4.5 * off);
    const before = r.ca;
    rustShift(r, -drop);
    r.ca = caOfAttrs(r.attrs); syncSkill(r);
    const dv = r.dev || (r.dev = { maturity: 0, aging: 0, pa0: r.pa, seasonCa: r.ca });
    dv.rust = round1((before - r.ca) * 0.7); // część formy wraca szybko („pamięć mięśniowa”)
  }
}
// Zmiana atrybutów CA o dca (przerwa / powrót formy): najmocniej technika jazdy i fizyczne, najsłabiej mentalne
function rustShift(x, dca) {
  const g = { tech: 1.15, physical: 1.2, mental: 0.6, workshop: 0.8 };
  for (const k in ATTR_W) x.attrs[k] = clamp(x.attrs[k] + dca / 5 * (g[ATTR_GROUP[k]] || 1) * (0.8 + rnd() * 0.4), 1, 20);
}
// Zawodnik bez licencji i bez klubu co sezon może ogłosić koniec kariery (decyzja ostateczna); młodzi rzadko – mogą wrócić nawet po długiej przerwie
function licQuitChance(r) {
  const age = riderAge(r), off = Math.max(0, G.season - (r.licExpired || G.season));
  return age < 24 ? 0.03 : clamp(0.04 + 0.035 * (age - 24) + 0.03 * off, 0.03, 0.85);
}
// Podpisanie kontraktu z zawodnikiem bez licencji (wywoływane z executeDeal)
function licOnSign(r, clubId) {
  if (licValid(r)) return;
  r.examRegistered = clubId !== G.clubId;
  if (clubId === G.clubId) {
    const ev = nextExamEvent();
    addMsg({ category: 'transfer', from: 'Sekretariat', stop: true, title: `${r.name} potrzebuje licencji`, body: `<p>${esc(r.name)} nie ma ważnej licencji żużlowej. Do startów musi zdać egzamin na licencję „Ż”${ev ? ` – najbliższa sesja: <b>${fmtDate(ev.date)}</b>${ev.venue ? ` (${esc(ev.venue)})` : ''}` : ''}.</p><p>Zgłoś go na egzamin w profilu zawodnika. Szansa zdania wg trenera: ok. ${Math.round(licExamChance(r) * 100)}%.</p>`, link: `#/zawodnik/${r.id}` });
  }
}
// Migracja zapisu: dawny status „kariera zawieszona” (suspended) → licencja wygasła
function licMigrate() {
  let ch = false;
  // licencje wydane w roku Y, które gra błędnie unieważniła 31 grudnia Y (przed wprowadzeniem pkt 27) – przywrócone
  if (!G.licFix27) {
    const back = [];
    for (const r of Object.values(G.riders)) {
      if (r.retired || r.active || !r.licExpired || !polLicence(r)) continue;
      const d = licIssueDate(r);
      if (!d || Number(d.slice(0, 4)) !== r.licExpired - 1) continue;
      r.active = true; delete r.licExpired; r.examRegistered = false; ch = true;
      if (r.clubId === G.clubId) back.push(r);
    }
    G.licFix27 = true; ch = true;
    if (back.length && typeof addMsg === 'function') addMsg({ category: 'transfer', from: 'Polski Związek Motorowy', title: `Przywrócone licencje: ${back.length}`,
      body: `<p>Nowo wydana licencja jest przedłużana automatycznie na następny rok (Regulamin szkolenia, cz. V pkt 27). Licencje są ważne:</p><ul>${back.map(r => `<li><a href="#/zawodnik/${r.id}">${esc(r.name)}</a></li>`).join('')}</ul>` });
  }
  for (const r of Object.values(G.riders)) {
    // obcokrajowiec: licencja jego federacji – brak startów w Polsce nie oznacza wygasłej licencji
    if (!polLicence(r) && !r.retired && (!r.active || r.licExpired)) { r.active = true; delete r.licExpired; delete r.suspended; r.examRegistered = false; ch = true; continue; }
    if (r.suspended !== undefined) { if (r.suspended && !r.retired) { r.active = false; r.licExpired = r.licExpired || (r.lastSeason ? r.lastSeason + 1 : G.season); } delete r.suspended; ch = true; }
    else if (!r.active && !r.retired && !r.licExpired) { r.licExpired = r.lastSeason ? r.lastSeason + 1 : G.season; ch = true; }
  }
  return ch;
}
