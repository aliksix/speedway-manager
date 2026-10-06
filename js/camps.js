'use strict';
// Obozy przygotowawcze (wzorzec 2024–2026): kondycyjne w kraju (COS OPO Szczyrk, Zakopane, Spała, Cetniewo, Świnoujście –
// Falubaz), motocross i kondycja w Hiszpanii w lutym (Lloret de Mar – Unia, GKM, Apator; Calpe – Sparta, Włókniarz;
// Majorka – Motor) i pierwsze jazdy na torach za granicą w marcu (Goričan – Motor, Wybrzeże, Unia, PSŻ; Krško, Žarnovica,
// Lonigo, Terenzano, Debreczyn; przyjazd zgłasza się kilka tygodni wcześniej).
// Koszt liczony na osobę: pobyt, przejazd, tor / wynajem crossów, transport motocykli busami (1 bus na 3 motocykle),
// mechanicy zawodnika, materiały (opony, metanol) za każdy dzień torowy. Klub płaci pobyt, przejazdy, tor i transport;
// senior – swoich mechaników i materiały (budżet sprzętowy), juniorów klub finansuje w całości.
// Każdy dzień torowy to standardowy trening na torze (js/equipment.js trackSession: zużycie i docieranie silników, upadki).
// Rozwój (js/training.js applyDevelopment): dni obozu wzmacniają okno grupy atrybutów (campBoost), a dni torowe za granicą
// zastępują polską pogodę w ocenie tygodnia torowego.

const CAMP_TYPES = {
  A: { name: 'Kondycyjny w kraju', short: 'kondycja', from: '11-15', to: '03-31', min: 3, max: 10, lead: 7, desc: 'Siłownia, wydolność, koordynacja, gry zespołowe. Tanio, bez sprzętu żużlowego.' },
  B: { name: 'Motocross i kondycja (Hiszpania)', short: 'motocross', from: '01-07', to: '03-10', min: 4, max: 8, lead: 10, desc: 'Jazda na crossach (balans, panowanie nad motocyklem, wytrzymałość), rower, siłownia. Ryzyko urazu na MX.' },
  C: { name: 'Tor żużlowy za granicą', short: 'tor', from: '02-25', to: '04-08', min: 2, max: 6, lead: 21, desc: 'Pierwsze jazdy przed sezonem w cieplejszym klimacie: technika, dopasowanie sprzętu. Drogo – trzeba zabrać motocykle.' },
};
// geo: [szer., dł., kraj]; stay – pobyt (nocleg + wyżywienie) zł/os./dzień; dt – o ile cieplej niż w Polsce; cap – kluby na torze dziennie
const CAMP_VENUES = {
  szczyrk: { type: 'A', name: 'COS OPO Szczyrk', geo: [49.72, 19.03, 'POL'], stay: 380, q: 1.05 },
  zakopane: { type: 'A', name: 'COS OPO Zakopane', geo: [49.3, 19.95, 'POL'], stay: 400, q: 1.05 },
  spala: { type: 'A', name: 'COS OPO Spała', geo: [51.54, 20.13, 'POL'], stay: 360, q: 1 },
  cetniewo: { type: 'A', name: 'COS OPO Cetniewo (Władysławowo)', geo: [54.79, 18.42, 'POL'], stay: 360, q: 1 },
  swinoujscie: { type: 'A', name: 'Świnoujście – hotel z zapleczem', geo: [53.91, 14.25, 'POL'], stay: 420, q: 0.9 },
  lloret: { type: 'B', name: 'Lloret de Mar (Katalonia)', geo: [41.7, 2.85, 'ESP'], stay: 480, mx: 950, flight: 1400, dt: 9, q: 1.05 },
  calpe: { type: 'B', name: 'Calpe (Alicante)', geo: [38.64, 0.04, 'ESP'], stay: 450, mx: 900, flight: 1500, dt: 11, q: 1 },
  mallorca: { type: 'B', name: 'Majorka (Palma)', geo: [39.57, 2.65, 'ESP'], stay: 520, mx: 1000, flight: 1300, dt: 10, q: 1 },
  gorican: { type: 'C', name: 'Goričan (Chorwacja)', geo: [46.38, 16.68, 'CRO'], stay: 380, track: 850, dt: 3, cap: 2, open: '03-01', q: 1 },
  krsko: { type: 'C', name: 'Krško (Słowenia)', geo: [45.96, 15.49, 'SLO'], stay: 420, track: 900, dt: 3, cap: 2, open: '03-05', q: 1 },
  zarnovica: { type: 'C', name: 'Žarnovica (Słowacja)', geo: [48.48, 18.72, 'SVK'], stay: 320, track: 700, dt: 1.5, cap: 2, open: '03-08', q: 0.9 },
  lonigo: { type: 'C', name: 'Lonigo (Włochy)', geo: [45.39, 11.39, 'ITA'], stay: 450, track: 950, dt: 5, cap: 2, open: '02-25', q: 1.05 },
  terenzano: { type: 'C', name: 'Terenzano (Włochy)', geo: [46.03, 13.22, 'ITA'], stay: 430, track: 900, dt: 4.5, cap: 2, open: '02-25', q: 1 },
  debrecen: { type: 'C', name: 'Debreczyn (Węgry)', geo: [47.53, 21.63, 'HUN'], stay: 330, track: 750, dt: 3, cap: 2, open: '03-05', q: 0.95 },
};
const CAMP_MAT = 650, CAMP_VAN_KM = 2.2, CAMP_VAN_FIX = 450, CAMP_BIKES_PER_VAN = 3;
const CAMP_ST = { booked: 'zarezerwowany', active: 'trwa', done: 'zakończony', cancelled: 'odwołany' };
const CAMP_DAY = { fit: 'kondycja', mx: 'motocross', track: 'tor', rain: 'deszcz – bez jazdy', travel: 'podróż', out: '—' };
const CAMP_STAFF_ROLES = ['coach', 'assistant', 'fitness', 'physio', 'mechanic', 'doctor', 'psych', 'juniorCoach', 'teamManager'];

const campAll = () => Object.values(G.camps || {});
const campEnd = c => c.end || (c.end = addDays(c.start, c.days - 1));
const campVenue = c => CAMP_VENUES[c.venue];
const campLive = c => c.status === 'booked' || c.status === 'active';
const campSeason = () => sparSeason();
const campOn = (c, d) => d >= c.start && d <= campEnd(c);
function campWindow(type, S = campSeason()) { const T = CAMP_TYPES[type]; return [T.from >= '07' ? `${S - 1}-${T.from}` : `${S}-${T.from}`, `${S}-${T.to}`]; }
const campOfClub = (clubId, S = campSeason()) => campAll().filter(c => c.clubId === clubId && c.season === S).sort(by(c => c.start));
// Obóz zawodnika w danym dniu (uczestnik, obóz zarezerwowany lub trwający); indeks dnia: id zawodnika → obóz
let CAMP_IDX = { key: null, map: new Map() }, CAMP_VER = 0; // CAMP_VER: zmiana rezerwacji / statusu obozu
function campOf(r, d = G.date) {
  const key = d + '|' + CAMP_VER + '|' + G.seed;
  if (CAMP_IDX.key !== key || CAMP_IDX.obj !== G.camps) {
    CAMP_IDX = { key, obj: G.camps, map: new Map() };
    for (const c of campAll()) if (campLive(c) && campOn(c, d)) for (const id of (c.att || c.riders)) if (!(c.declined || []).includes(id)) CAMP_IDX.map.set(id, c);
  }
  return CAMP_IDX.map.get(r.id) || null;
}
const onCamp = (r, d = G.date) => !!(G.camps && campOf(r, d));
function campDayKind(c, i) {
  if (c.type === 'A') return 'fit';
  if (c.type === 'B') return i === 0 || i === c.days - 1 ? 'travel' : i % 3 === 0 ? 'fit' : 'mx';
  return i === 0 ? 'travel' : 'track';
}
function campWeather(v, d) {
  const w = dayWeather(d, (G.seed || 1) + v.geo[2]), temp = round1(w.temp + (v.dt || 0));
  const wet = w.wet && hrand(G.seed + v.geo[2] + 'cw' + d) < (v.type === 'C' ? 0.55 : 0.3);
  return { temp, wet, ok: v.type === 'A' || (!wet && (v.type === 'B' || temp >= 3)) };
}
// Dni zajęte przez obóz klubu (połowa kadry lub więcej) – kolizje ze sparingami i innymi obozami
function campBusy(clubId, d) { return campAll().some(c => c.clubId === clubId && campLive(c) && campOn(c, d)); }
// Kluby na torze danego dnia (limit rezerwacji)
const campTrackLoad = (venue, d, skip) => campAll().filter(c => c !== skip && c.venue === venue && campLive(c) && campOn(c, d)).map(c => c.clubId);

// ---------- Uczestnicy i koszty ----------
function campDeclineChance(r, type) {
  if (isJunior(r)) return 0;
  const gp = G.sgp && G.sgp.riders && G.sgp.riders.includes(r.id);
  let p = gp ? 0.6 : r.skill >= 13 ? 0.35 : r.skill >= 11 ? 0.15 : 0.05;
  if (!hasNat(r, 'POL')) p += type === 'A' ? 0.25 : 0.1; // obcokrajowcy zimą w domu
  return clamp(p - (((r.hidden && r.hidden.professionalism) ?? 10) - 10) * 0.01, 0, 0.9);
}
const campDeclines = (r, c) => hrand(G.seed + 'cd' + c.id + r.id) < campDeclineChance(r, c.type);
const campBikes = r => clamp(framesOK(r), 2, 3);
// Wycena obozu: wiersze na zawodnika i osobę sztabu, podział na klub i zawodników
function campQuote(clubId, venueId, days, riderIds, staffIds) {
  const v = CAMP_VENUES[venueId], home = G.clubs[clubId];
  const km = Math.round(kmBetween(geoOf(home.city) || COUNTRY_GEO.POL, v.geo));
  const trackDays = v.type === 'C' ? days - 1 : 0, mxDays = v.type === 'B' ? Array.from({ length: days }, (_, i) => i).filter(i => campDayKind({ type: 'B', days }, i) === 'mx').length : 0;
  const rows = riderIds.map(id => G.riders[id]).filter(Boolean).map(r => {
    const jr = isJunior(r), x = { id: r.id, name: r.name, junior: jr, stay: days * v.stay, travel: 0, track: 0, mx: 0, transport: 0, mech: 0, mat: 0, bikes: 0, vans: 0, mechN: 0 };
    if (v.type === 'A') x.travel = km > 15 ? Math.round(80 + km * 0.35) : 0;
    if (v.type === 'B') { x.travel = v.flight; x.mx = mxDays * v.mx; }
    if (v.type === 'C') {
      x.track = trackDays * v.track;
      x.bikes = campBikes(r);
      x.vans = jr ? 0.5 : Math.ceil(x.bikes / CAMP_BIKES_PER_VAN); // juniorzy jadą busem klubowym po dwóch
      x.transport = Math.round(x.vans * (km * 2 * CAMP_VAN_KM + CAMP_VAN_FIX));
      x.mechN = jr ? 0.5 : clamp(r.equip.mechanics || 1, 1, 3);
      x.mech = Math.round(x.mechN * days * v.stay * 0.85);
      x.mat = trackDays * CAMP_MAT;
    }
    x.club = x.stay + x.travel + x.track + x.mx + x.transport + (jr ? x.mech + x.mat : 0);
    x.rider = jr ? 0 : x.mech + x.mat;
    x.total = x.club + x.rider;
    return x;
  });
  const staff = staffIds.map(id => G.staff[id]).filter(Boolean).map(s => {
    const travel = v.type === 'B' ? v.flight : v.type === 'C' ? 250 : km > 15 ? Math.round(80 + km * 0.35) : 0;
    return { id: s.id, name: s.name, role: s.role, stay: days * v.stay, travel, total: days * v.stay + travel };
  });
  const club = sum(rows.map(x => x.club)) + sum(staff.map(x => x.total)), riders = sum(rows.map(x => x.rider));
  return { km, days, trackDays, mxDays, rows, staff, club: Math.round(club), riders: Math.round(riders), total: Math.round(club + riders), perRider: rows.length ? Math.round(sum(rows.map(x => x.total)) / rows.length) : 0 };
}
// Jakość obozu według zabranego sztabu: motoryk (fizyczne), trener (technika), mechanik (warsztat), fizjoterapeuta (regeneracja)
function campStaffQ(staffIds) {
  const roles = new Set(staffIds.map(id => G.staff[id]).filter(Boolean).flatMap(s => staffRoles(s)));
  return { physical: roles.has('fitness') ? 1 : 0.6, tech: roles.has('coach') || roles.has('assistant') || roles.has('juniorCoach') ? 1 : 0.6, workshop: roles.has('mechanic') ? 1 : 0.7, physio: roles.has('physio') || roles.has('doctor') };
}
const campDefaultRiders = clubId => clubRiders(clubId).filter(r => r.active !== false && !r.retired && !u16(r)).map(r => r.id);
const campDefaultStaff = (clubId, type) => clubStaff(clubId).filter(s => ['coach', 'assistant', 'fitness', 'physio', ...(type === 'C' ? ['mechanic'] : [])].includes(s.role)).map(s => s.id);

// ---------- Rezerwacja ----------
function campProblem(clubId, venueId, start, days, skip = null) {
  const v = CAMP_VENUES[venueId];
  if (!v) return 'wybierz ośrodek';
  const T = CAMP_TYPES[v.type];
  if (!/^\d{4}-\d\d-\d\d$/.test(start || '')) return 'podaj datę';
  if (days < T.min || days > T.max) return `długość obozu: ${T.min}–${T.max} dni`;
  const [a, b] = campWindow(v.type), end = addDays(start, days - 1);
  if (start < a || end > b) return `termin dla tego typu: ${fmtDateShort(a)} – ${fmtDateShort(b)}`;
  if (v.open && start.slice(5) < v.open) return `tor otwarty od ${v.open.split('-').reverse().join('.')}`;
  if (clubId === G.clubId && start < addDays(G.date, T.lead)) return `rezerwacja min. ${T.lead} dni wcześniej`;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (Object.values(G.fixtures).some(f => f.date === d && (f.homeId === clubId || f.awayId === clubId))) return `${fmtDateShort(d)}: mecz ligowy`;
    if (campAll().some(c => c !== skip && c.clubId === clubId && campLive(c) && campOn(c, d))) return `${fmtDateShort(d)}: inny obóz`;
    if (typeof sparAll === 'function' && sparAll().some(s => s.date === d && ['agreed', 'pending'].includes(s.status) && (s.homeId === clubId || s.awayId === clubId))) return `${fmtDateShort(d)}: sparing`;
    if (v.cap && campTrackLoad(venueId, d, skip).length >= v.cap) return `${fmtDateShort(d)}: tor zajęty (${campTrackLoad(venueId, d, skip).map(id => G.clubs[id].short).join(', ')})`;
  }
  return null;
}
function campBook({ clubId = G.clubId, venue, start, days, riders, staff }) {
  days = Number(days);
  const p = campProblem(clubId, venue, start, days);
  if (p) return { ok: false, text: p };
  if (!riders || !riders.length) return { ok: false, text: 'Wybierz zawodników.' };
  G.camps = G.camps || {};
  G.seq.camp = G.seq.camp || 1;
  const v = CAMP_VENUES[venue], id = `C${G.seq.camp++}`;
  CAMP_VER++;
  const c = G.camps[id] = { id, clubId, season: campSeason(), venue, type: v.type, start, days, riders: riders.slice(), staff: (staff || []).slice(), status: 'booked', created: G.date, log: {} };
  c.declined = c.riders.filter(rid => G.riders[rid] && campDeclines(G.riders[rid], c));
  c.quote = campQuote(clubId, venue, days, c.riders.filter(x => !c.declined.includes(x)), c.staff);
  if (clubId === G.clubId && c.declined.length) addMsg({ category: 'drużyna', from: 'Kierownik drużyny', title: `Obóz ${v.name}: nie wszyscy jadą`,
    body: `<p>Na obóz (${fmtDateShort(start)}, ${days} dni) nie pojadą: ${c.declined.map(x => `<b>${esc(G.riders[x].name)}</b>`).join(', ')} – mają własny program przygotowań (prywatny sztab, starty za granicą).</p>`, link: `#/kalendarz/oboz/${id}` });
  return { ok: true, text: `Zarezerwowano: ${v.name}, ${fmtDateShort(start)} – ${fmtDateShort(campEnd(c))}. Koszt klubu ok. ${fmtMoney(c.quote.club)}.`, id };
}
function campCancel(id) {
  const c = G.camps && G.camps[id];
  if (!c || c.status !== 'booked') return { ok: false, text: 'Tego obozu nie można już odwołać.' };
  const late = dayDiff(G.date, c.start) < 14, fee = late ? Math.round(0.5 * (sum(c.quote.rows.map(x => x.stay + x.track)) + sum(c.quote.staff.map(x => x.stay)))) : 0;
  if (fee) addTx(c.clubId, 'obozy', -fee, `Odwołanie obozu ${campVenue(c).name} (50% rezerwacji)`);
  CAMP_VER++;
  c.status = 'cancelled'; c.fee = fee;
  return { ok: true, text: fee ? `Obóz odwołany – opłata za późną rezygnację ${fmtMoney(fee)}.` : 'Obóz odwołany bez kosztów (ponad 14 dni przed terminem).' };
}

// ---------- Przebieg obozu ----------
function campStart(c, date) {
  const v = campVenue(c);
  CAMP_VER++;
  c.status = 'active';
  c.att = c.riders.filter(id => { const r = G.riders[id]; return r && !c.declined.includes(id) && !r.injury && !r.retired && r.clubId === c.clubId; });
  c.q = campStaffQ(c.staff);
  c.quote = campQuote(c.clubId, c.venue, c.days, c.att, c.staff);
  addTx(c.clubId, 'obozy', -c.quote.club, `Obóz ${v.name} (${c.att.length} zawodników, ${c.staff.length} osób sztabu, ${c.days} dni)`);
  c.paid = {}; // wydatki zawodników (budżet sprzętowy): mechanicy na wyjeździe, materiały
  for (const x of c.quote.rows) if (!x.junior && x.mech) campRiderPay(c, G.riders[x.id], x.mech);
  c.inj = [];
  if (c.clubId === G.clubId) addMsg({ category: 'drużyna', from: 'Kierownik drużyny', title: `Wyjazd na obóz: ${v.name}`,
    body: `<p>Jedzie ${c.att.length} zawodników i ${c.staff.length} osób sztabu. ${CAMP_TYPES[c.type].desc}</p>${c.riders.length - c.att.length - c.declined.length > 0 ? '<p class="small">Część zawodników nie pojechała (kontuzja, zmiana klubu).</p>' : ''}`, link: `#/kalendarz/oboz/${c.id}` });
}
function campRiderPay(c, r, amt) { r.equip.budget = (r.equip.budget || 0) - amt; c.paid[r.id] = (c.paid[r.id] || 0) + amt; }
function campDay(date) {
  if (!G.camps) G.camps = {};
  const S = campSeason(), md = date.slice(5);
  if (md >= '12-10' && md <= '12-31' || md >= '01-01' && md <= '02-20') if (!(G.campPlanned && G.campPlanned[S])) aiPlanCamps(S);
  for (const c of campAll()) {
    if (!campLive(c) || !campOn(c, date)) continue;
    if (c.status === 'booked') campStart(c, date);
    const v = campVenue(c), i = dayDiff(c.start, date), kind = campDayKind(c, i), w = campWeather(v, date);
    let done = kind;
    if ((kind === 'track' || kind === 'mx') && !w.ok) done = kind === 'track' ? 'rain' : 'fit';
    c.log[date] = { k: done, t: w.temp };
    let junMat = 0;
    for (const id of c.att) {
      const r = G.riders[id];
      if (!r || r.injury || r.clubId !== c.clubId) continue;
      travelTo(r, v.geo, date);
      const tired = c.q && c.q.physio ? 0.8 : 1;
      if (done === 'fit') r.cond = clamp(r.cond - 2 * tired, 40, 100);
      if (done === 'mx') {
        r.cond = clamp(r.cond - 4 * tired, 40, 100);
        const p = 0.004 * (1.3 - (r.attrs.balance || 10) / 40) * (1.25 - (r.attrs.resilience ?? 10) / 40);
        if (chance(p)) { injureRider(r, date, `motocross na obozie (${v.name})`); c.inj.push(id); }
      }
      if (done === 'track') {
        // standardowy trening na torze: silniki zawodnika, docieranie, ryzyko upadku (js/equipment.js)
        r.cond = clamp(r.cond - 3 * tired, 40, 100);
        const inj0 = r.injury;
        if (typeof trackSession === 'function') trackSession(r);
        if (r.injury && r.injury !== inj0) c.inj.push(id);
        if (!isJunior(r)) campRiderPay(c, r, CAMP_MAT); else junMat++;
      }
      if (r.morale != null && i === c.days - 1) r.morale = clamp(r.morale + 2, 0, 100); // wspólny wyjazd – atmosfera w drużynie
    }
    if (junMat) addTx(c.clubId, 'obozy', -junMat * CAMP_MAT, `Materiały na tor juniorów (${junMat} × opony, metanol) – ${v.name}`);
    if (date === campEnd(c)) campFinish(c);
  }
}
function campFinish(c) {
  CAMP_VER++;
  c.status = 'done';
  if (c.clubId !== G.clubId) return;
  const v = campVenue(c), L = Object.values(c.log), n = k => L.filter(x => x.k === k).length;
  addMsg({ category: 'drużyna', from: 'Trener', title: `Koniec obozu: ${v.name}`,
    body: `<p>${[n('track') && `dni na torze: <b>${n('track')}</b>`, n('rain') && `bez jazdy z powodu pogody: <b>${n('rain')}</b>`, n('mx') && `motocross: <b>${n('mx')}</b>`, n('fit') && `kondycja: <b>${n('fit')}</b>`].filter(Boolean).join(', ')}.</p>
      ${c.inj.length ? `<p class="neg">Kontuzje: ${c.inj.map(id => esc(G.riders[id].name)).join(', ')}.</p>` : '<p>Bez kontuzji.</p>'}
      <p class="small muted">Koszt klubu: ${fmtMoney(c.quote.club)}; zawodnicy (mechanicy, materiały): ${fmtMoney(c.quote.riders)}.</p>`, link: `#/kalendarz/oboz/${c.id}` });
}

// ---------- Wpływ na rozwój (js/training.js) ----------
// Dni obozu w ostatnim tygodniu: mnożniki okna grup atrybutów, dodatek techniki (tor, MX) i dni torowe (pogoda za granicą)
let CB = { date: null, map: new Map() };
function campBoost(x) {
  if (!G.camps || !x || !G.riders[x.id]) return null;
  if (CB.date !== G.date) {
    CB = { date: G.date, map: new Map() };
    const from = addDays(G.date, -7);
    for (const c of campAll()) {
      if (!c.att || c.start > G.date || campEnd(c) <= from) continue;
      const v = campVenue(c), q = c.q || { physical: 1, tech: 1, workshop: 1 };
      for (const [d, l] of Object.entries(c.log)) {
        if (d <= from || d > G.date) continue;
        for (const id of c.att) {
          const b = CB.map.get(id) || { fit: 0, mx: 0, track: 0, days: 0, q, vq: v.q || 1 };
          b.days++; if (b[l.k] != null) b[l.k]++;
          CB.map.set(id, b);
        }
      }
    }
  }
  const b = CB.map.get(x.id);
  if (!b) return null;
  return {
    mul: { physical: 1 + (0.12 * b.fit + 0.1 * b.mx) * b.q.physical * b.vq, mental: 1 + 0.03 * b.days, workshop: 1 + 0.06 * b.track * b.q.workshop, tech: 1 },
    add: { tech: (0.05 * b.mx + 0.1 * b.track * b.q.tech) * b.vq },
    track: b.track,
  };
}

// ---------- Kluby AI ----------
function aiPlanCamps(S) {
  G.camps = G.camps || {};
  for (const c of campAll()) if (c.season < S - 1) delete G.camps[c.id];
  const clubs = shuffle(sparClubs(S).filter(c => c.id !== G.clubId));
  const P = { PGE: { B: 0.85, A: 0.15, C: 0.8 }, '2E': { B: 0.4, A: 0.5, C: 0.6 }, KLZ: { B: 0.05, A: 0.6, C: 0.35 } };
  const tryBook = (club, type, from, to, days) => {
    const vs = Object.entries(CAMP_VENUES).filter(([, v]) => v.type === type).map(([k, v]) => ({ k, w: kmBetween(geoOf(club.city) || COUNTRY_GEO.POL, v.geo) / 400 + rnd() * 1.5 })).sort(by(x => x.w));
    for (let t = 0; t < 8; t++) {
      const start = addDays(from, rint(0, Math.max(0, dayDiff(from, to))));
      for (const { k } of vs.slice(0, 3)) {
        const riders = campDefaultRiders(club.id);
        if (campProblem(club.id, k, start, days)) continue;
        return campBook({ clubId: club.id, venue: k, start, days, riders, staff: campDefaultStaff(club.id, type) });
      }
    }
    return null;
  };
  for (const c of clubs) {
    const p = P[c.league] || P.KLZ;
    if (chance(p.B)) tryBook(c, 'B', `${S}-02-03`, `${S}-02-22`, rint(5, 7));
    else if (chance(p.A / (1 - p.B))) tryBook(c, 'A', `${S}-01-12`, `${S}-02-20`, rint(4, 6));
    if (chance(p.C)) tryBook(c, 'C', `${S}-03-02`, `${S}-03-18`, rint(3, 4));
  }
  (G.campPlanned = G.campPlanned || {})[S] = G.date;
}

// ---------- Terminarz zawodnika (js/schedule.js) ----------
function campPlannedFor(r, from, to) {
  if (!G.camps || !r.clubId) return [];
  const out = [];
  for (const c of campAll()) {
    if (!campLive(c) && c.status !== 'done' || c.clubId !== r.clubId || !(c.att || c.riders).includes(r.id) || (c.declined || []).includes(r.id)) continue;
    const v = campVenue(c);
    for (let d = c.start > from ? c.start : from; d <= campEnd(c) && d <= to; d = addDays(d, 1)) out.push({ d, k: 'oboz', lbl: `obóz: ${v.name}`, g: v.geo, link: `#/kalendarz/oboz/${c.id}`, done: c.status === 'done' });
  }
  return out;
}
