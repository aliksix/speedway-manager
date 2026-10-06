'use strict';
// Szkółki niezależne (np. Akademia Żużlowa Janusza Kołodzieja, AS Akademia Lipno) szkolą poza klubami ligowymi:
// - adept po egzaminie 500 cm³ zostaje zawodnikiem z kartą w szkółce (r.schoolRights) – nie jest wolnym zawodnikiem.
//   Klub pozyskuje go na stałe, płacąc szkółce cenę karty (sprzedaż), albo wypożycza na sezon (r.schoolLoan: kontrakt z klubem
//   do 31.10, karta zostaje w szkółce). Karta wygasa po sezonie 21. urodzin – zawodnik staje się wolny;
// - miniżużlowców (85–140 cm³) szkółka wypożycza klubom na sezon do rozgrywek drużynowych (k.miniLoan).
const indepSchool = id => { const s = id && G.miniSchools && G.miniSchools[id]; return s && !s.clubId ? s : null; };
const rightsSchool = r => (r && r.schoolRights && G.miniSchools && G.miniSchools[r.schoolRights]) || null;
const schoolOnLoan = (r, S = sportSeason()) => !!(r.schoolLoan && r.schoolLoan.season >= S && r.contract && r.contract.clubId === r.schoolLoan.clubId);
const MINI_TEAM = 4; // tylu miniżużlowców klub chce mieć w drużynie
const MINI_LOAN_FEE = 4000; // opłata szkółce za sezon miniżużlowca w drużynie klubu (sprzęt, wyjazdy)
function schoolBook(s, amount, text) {
  s.cash = (s.cash || 0) + amount;
  (s.ledger = s.ledger || []).push({ d: G.date, a: Math.round(amount), t: text });
  if (s.ledger.length > 60) s.ledger.shift();
}
// Cena karty: potencjał (szkółka zna swojego wychowanka) i liga kupującego
function schoolFee(r, clubId) {
  const lgF = { PGE: 1.25, '2E': 1, KLZ: 0.8 }[leagueOf(clubId)] || 0.8;
  return round5k((20000 + Math.max(0, (r.pa ?? r.potential ?? 50) - 40) ** 2 * 120) * lgF);
}
const schoolLoanFee = (r, clubId) => Math.max(5000, round5k(schoolFee(r, clubId) * 0.15));

// ---------- Rynek: status zawodnika z kartą w szkółce (nakładka na marketStatus) ----------
function schoolStatus(r, clubId, st) {
  const s = rightsSchool(r);
  if (!s || !st.ok) return st;
  if (st.mode === 'transfer') return { ok: false, text: `${r.name} jest wypożyczony ze szkółki ${s.short} do klubu ${G.clubs[r.contract.clubId].name} do końca sezonu ${r.contract.until}. Kartę ma szkółka – można ją odkupić po sezonie (od 15 czerwca prekontraktem).` };
  let extra = {};
  if (st.mode === 'renewal') { // klub, który wypożyczył zawodnika, odkupuje kartę na kolejny sezon
    if (!schoolOnLoan(r)) return st;
    extra = { mode: 'precontract', completes: `${G.season}-11-01` };
  }
  return { ...st, ...extra, fee: schoolFee(r, clubId), comp: null, school: s.id };
}
// Sprzedaż karty: klub płaci szkółce, prawa klubu szkolącego (ekwiwalent) przechodzą na kupującego
function schoolSold(r, clubId, fee) {
  const s = rightsSchool(r), c = G.clubs[clubId];
  if (!s) return;
  if (fee) { addTx(clubId, 'transfer', -fee, `Karta zawodnika: ${r.name} (${s.short})`); schoolBook(s, fee, `Sprzedaż karty: ${r.name} → ${c.short}`); }
  delete r.schoolRights; delete r.schoolLoan;
  r.trainedBy = clubId; r.trainedSince = sportSeason(); r.homeClubId = r.homeClubId || clubId; delete r.trainedHop;
}
function schoolLoanStatus(r, clubId = G.clubId) {
  const s = rightsSchool(r), S = sportSeason(), c = G.clubs[clubId];
  if (!s) return { ok: false, text: 'Zawodnik nie ma karty w szkółce.' };
  if (r.retired || !r.active) return { ok: false, text: `${r.name} nie ma aktywnej licencji.` };
  if (r.contract && r.contract.until >= S) return { ok: false, text: r.schoolLoan ? `${r.name} jest już wypożyczony do klubu ${G.clubs[r.contract.clubId].name} na sezon ${r.contract.until}.` : `${r.name} ma ważny kontrakt.` };
  if (r.nextContract || r.agreed) return { ok: false, text: `${r.name} ma uzgodnione przejście do klubu.` };
  if (!c || !clubActive(c, S)) return { ok: false, text: 'Klub nie startuje w rozgrywkach ligowych w tym sezonie.' };
  const last = lastRegularRound(leagueOf(clubId), S);
  if (last && G.date > last) return { ok: false, text: `Termin wypożyczeń minął (ostatnia runda sezonu zasadniczego: ${fmtDateShort(last)}).` };
  return { ok: true, season: S, fee: schoolLoanFee(r, clubId), school: s.id };
}
// Wypożyczenie ze szkółki: od razu (bez okienka), kontrakt z klubem na jeden sezon, karta zostaje w szkółce
function doSchoolLoan(r, clubId) {
  const st = schoolLoanStatus(r, clubId);
  if (!st.ok) return st;
  const c = G.clubs[clubId], s = rightsSchool(r);
  if (clubId === G.clubId && c.cash < st.fee) return { ok: false, text: `Klub nie ma środków na opłatę za wypożyczenie (${fmtMoney(st.fee, true)}).` };
  for (const n of openNegs(r.id)) closeNeg(n, 'rejected', `${r.name} został wypożyczony ze szkółki do klubu ${c.name}.`, n.clubId === G.clubId);
  addTx(clubId, 'transfer', -st.fee, `Wypożyczenie ze szkółki: ${r.name} (${s.short})`);
  schoolBook(s, st.fee, `Wypożyczenie: ${r.name} → ${c.short} (sezon ${st.season})`);
  const terms = canAmateur(r, st.season) ? { kind: 'amatorski', stipend: STIPEND_MAX, years: 1 } : { kind: 'zawodowy', signing: 0, perPoint: round100(riderAsk(r, clubId).perPoint * 0.8), years: 1 };
  r.contract = makeContract(clubId, terms, st.season, `wypożyczenie ze szkółki ${s.short}`);
  r.schoolLoan = { schoolId: s.id, clubId, season: st.season, fee: st.fee, from: G.date };
  r.clubId = clubId; r.listed = false; r.loanListed = false;
  logTransfer(r, null, clubId, st.fee, 'wypożyczenie ze szkółki');
  dropFromLineups(r.id);
  if (clubId !== G.clubId && r.schoolOffer === sportSeason()) addMsg({ category: 'transfer', from: s.name, title: `${r.name} wypożyczony do ${c.short}`, body: `<p>Szkółka ${esc(s.name)} wypożyczyła zawodnika <b>${esc(r.name)}</b> do klubu ${esc(c.name)} na sezon ${st.season}.</p>`, link: `#/zawodnik/${r.id}` });
  return { ok: true, text: `${r.name} wypożyczony ze szkółki ${s.short} do końca sezonu ${st.season} (opłata ${fmtMoney(st.fee, true)}).` };
}
// Adept szkółki niezależnej po egzaminie 500 cm³: karta w szkółce
function schoolGraduate(r, k) {
  const s = !k.clubId && indepSchool(k.schoolId);
  if (!s) return;
  r.schoolRights = s.id; r.schoolRightsInit = true;
  if (r.licence) r.licence.team = s.short;
}
// 1 listopada: koniec wypożyczeń ze szkółek (kontrakt wygasa w newSeason), karta wygasa po sezonie 21. urodzin
function schoolRollover() {
  for (const r of Object.values(G.riders)) {
    if (r.schoolLoan && r.schoolLoan.season < G.season) delete r.schoolLoan;
    if (r.schoolRights && (r.retired || !isJunior(r, G.season))) {
      const s = rightsSchool(r);
      delete r.schoolRights;
      if (s && !r.clubId && interestedClubs(r).length + (G.shortlist.includes(r.id) ? 1 : 0)) addMsg({ category: 'transfer', from: 'Sekretariat', title: `${r.name} bez karty w szkółce`, body: `<p>Wygasła karta zawodnika ${esc(r.name)} w szkółce ${esc(s.name)} (koniec wieku juniora). Zawodnik jest wolny.</p>`, link: `#/zawodnik/${r.id}` });
    }
  }
}

// ---------- Szkółki jako uczestnik rynku (co tydzień, w niedzielę) ----------
const userNeedsJunior = S => squadFor(myClub(), S).filter(x => isJunior(x, S)).length < 3;
function juniorFits(r, c, S) {
  const juns = squadFor(c, S).filter(x => isJunior(x, S)).map(x => perceive(x, c.id).caMid).sort((a, b) => b - a);
  return juns.length < 3 || perceive(r, c.id).caMid > (juns[2] ?? 0);
}
function schoolOfferMsg(r, s, S) {
  addMsg({ category: 'transfer', from: s.name, title: `${s.short} proponuje zawodnika: ${r.name}`,
    body: `<p>Szkółka <b>${esc(s.name)}</b> szuka klubu dla swojego wychowanka <b>${esc(r.name)}</b> (${riderAge(r)} lat, licencja 500 cm³). Karta zawodnika jest w szkółce.</p>
      <p>Sprzedaż karty: <b>${fmtMoney(schoolFee(r, G.clubId))}</b> (potem kontrakt z zawodnikiem). Wypożyczenie na sezon ${S}: <b>${fmtMoney(schoolLoanFee(r, G.clubId))}</b>.</p>`,
    link: `#/zawodnik/${r.id}/kontrakt` });
}
function schoolMarketWeek() {
  const S = sportSeason(), md = G.date.slice(5);
  if (md > '09-15' && md < '11-01') return; // po sezonie szkółki czekają na okienka
  const loanTime = md >= '01-15' && md <= '08-31';
  const pool = Object.values(G.riders).filter(r => r.schoolRights && r.active && !r.retired && !r.injury && !(r.contract && r.contract.until >= S) && !r.nextContract && !r.agreed && !openNegs(r.id).length);
  for (const r of shuffle(pool)) {
    const s = rightsSchool(r);
    if (!s) continue;
    const fits = shuffle(Object.values(G.clubs).filter(c => c.id !== G.clubId && clubActive(c, S) && juniorFits(r, c, S)));
    // sprzedaż: najchętniej bogatsze kluby (Ekstraliga); kontrakt negocjuje zawodnik, szkółka dostaje cenę karty
    const buyer = fits.find(c => c.cash > schoolFee(r, c.id) * 1.5 && chance(c.league === 'PGE' ? 0.35 : 0.2));
    if (buyer && marketStatus(r, buyer.id).ok) { noteInterest(r, buyer.id); if (makeOffer(buyer.id, r.id, { ...aiOfferTerms(r, buyer, 'contract'), fee: schoolFee(r, buyer.id) }).ok) continue; }
    // wypożyczenie: od połowy stycznia, gdy nikt nie kupił – do klubu z brakami juniorów
    if (loanTime && chance(0.5)) { const c = fits.find(c => schoolLoanStatus(r, c.id).ok && c.cash > schoolLoanFee(r, c.id) * 2); if (c && doSchoolLoan(r, c.id).ok) continue; }
    // propozycja dla klubu gracza (raz w sezonie)
    if (r.schoolOffer !== S && userNeedsJunior(S) && chance(0.4)) { r.schoolOffer = S; schoolOfferMsg(r, s, S); }
  }
  if (md >= '03-01' && md <= '09-15' && G.miniLoansSeason !== S) assignMiniLoans(S);
}

// ---------- Miniżużel: wypożyczenia do rozgrywek drużynowych ----------
// Drużyna miniżużlowa klubu: adepci klubu (także ze stowarzyszeń szkolących dla klubu) i wypożyczeni na sezon ze szkółek niezależnych
const miniTeamOf = (k, S) => (k.miniLoan && k.miniLoan.season === S ? k.miniLoan.clubId : k.clubId || null);
const clubMiniCount = (clubId, S) => miniField().filter(k => miniTeamOf(k, S) === clubId).length;
function miniLoanStatus(k, clubId, S = G.season) {
  const s = indepSchool(k.schoolId);
  if (!s || k.clubId) return { ok: false, text: 'Adept nie należy do szkółki niezależnej.' };
  if (k.catalogOnly || k.cat !== 'c85') return { ok: false, text: 'Wypożyczenia do drużyn dotyczą miniżużla (85–140 cm³).' };
  if (k.miniLoan && k.miniLoan.season === S) return { ok: false, text: `${k.name} jeździ w sezonie ${S} w drużynie ${G.clubs[k.miniLoan.clubId].name}.` };
  if (clubId && clubMiniCount(clubId, S) >= MINI_TEAM + 2) return { ok: false, text: 'Drużyna miniżużlowa klubu jest już pełna.' };
  return { ok: true, fee: MINI_LOAN_FEE, school: s.id, season: S };
}
function doMiniLoan(k, clubId, S = G.season) {
  const st = miniLoanStatus(k, clubId, S);
  if (!st.ok) return st;
  const s = G.miniSchools[st.school], c = G.clubs[clubId];
  if (clubId === G.clubId && c.cash < st.fee) return { ok: false, text: `Klub nie ma środków na opłatę (${fmtMoney(st.fee, true)}).` };
  addTx(clubId, 'szkółka', -st.fee, `Wypożyczenie miniżużlowca: ${k.name} (${s.short})`);
  schoolBook(s, st.fee, `Miniżużel: ${k.name} → ${c.short} (sezon ${S})`);
  k.miniLoan = { clubId, season: S, fee: st.fee, schoolId: s.id };
  return { ok: true, text: `${k.name} pojedzie w sezonie ${S} w drużynie miniżużlowej klubu ${c.name}.` };
}
// Przed sezonem (od 1 marca) szkółki niezależne rozdzielają miniżużlowców do klubów z brakami w drużynie
function assignMiniLoans(S) {
  G.miniLoansSeason = S;
  // pożyczają kluby, których drużyny jadą w DMP (grupy) lub DPE (Ekstraliga) – js/mini-rules.js
  const groups = typeof miniGroups === 'function' ? miniGroups(S) : null;
  const clubs = Object.values(G.clubs).filter(c => clubActive(c, S) && (!groups || groups[c.short] || c.league === 'PGE'));
  const offers = [];
  for (const s of Object.values(G.miniSchools || {}).filter(s => !s.clubId)) {
    const kids = miniField().filter(k => k.schoolId === s.id && miniLoanStatus(k, 0, S).ok).sort(by(k => k.ca ?? k.ability ?? 0, -1));
    if (groups && groups[`school-${s.id}`]) kids.splice(0, MINI_TEAM); // szkółka z własną drużyną w DMP zatrzymuje skład (3 + rezerwowy)
    for (const k of kids) {
      const c = clubs.map(c => ({ c, n: clubMiniCount(c.id, S) })).filter(x => x.n < MINI_TEAM && !offers.some(o => o.k === k))
        .sort(by(x => x.n + hrand(k.id + ':' + x.c.id) * 2))[0]?.c;
      if (!c) break;
      if (c.id === G.clubId) { offers.push({ k, s }); continue; }
      doMiniLoan(k, c.id, S);
    }
  }
  if (offers.length) addMsg({ category: 'szkółka', from: 'Trener szkółki', title: `Szkółki proponują miniżużlowców do drużyny (${offers.length})`,
    body: `<p>Nasza drużyna miniżużlowa ma ${clubMiniCount(G.clubId, S)} adeptów (potrzeba ${MINI_TEAM}). Szkółki niezależne proponują wypożyczenie na sezon ${S} (${fmtMoney(MINI_LOAN_FEE)} za adepta):</p>
      <ul>${offers.map(o => `<li><a href="#/adept/${o.k.id}">${esc(o.k.name)}</a> (${esc(o.s.short)}, ${ageAt(o.k.born, G.date)} lat) – <button class="btn sm" onclick="ACT.miniLoan('${o.k.id}')">Wypożycz</button></li>`).join('')}</ul>`,
    link: '#/szkolka' });
}
function migrateSchoolRights() {
  // zawodnicy 500 cm³ ze szkółek niezależnych bez klubu (np. z rejestru PZM) – karta w szkółce, dopóki są juniorami
  for (const r of Object.values(G.riders)) {
    if (r.schoolRightsInit || !r.schoolId) continue;
    r.schoolRightsInit = true;
    if (indepSchool(r.schoolId) && !r.clubId && !r.contract && !r.retired && isJunior(r, sportSeason())) r.schoolRights = r.schoolId;
  }
}
