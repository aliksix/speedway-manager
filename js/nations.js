'use strict';
// Kraje: federacje, ligi, powołania do kadr narodowych (seniorzy i juniorzy U21) na sezon.
// Powołania ustala sztab kadry 1 listopada (i przy pierwszym użyciu w sezonie) – według poziomu zawodników.
// Turnieje Zaplecza Kadry Juniorów: polscy juniorzy spoza listy powołanych do kadry juniorów.

const NATION_INFO = {
  POL: { fed: 'Polski Związek Motorowy (PZM)', body: 'Główna Komisja Sportu Żużlowego (GKSŻ), Ekstraliga Żużlowa', founded: 1950 },
  DEN: { fed: 'Danmarks Motor Union (DMU)', body: 'DMU Speedway' },
  SWE: { fed: 'Svenska Motorcykel- och Snöskoterförbundet (Svemo)', body: 'Svemo Speedway, Elitserien' },
  GBR: { fed: 'Auto-Cycle Union (ACU)', body: "British Speedway Promoters' Association (BSPA)" },
  AUS: { fed: 'Motorcycling Australia (MA)' },
  GER: { fed: 'Deutscher Motor Sport Bund (DMSB)' },
  LAT: { fed: 'Latvijas Motosporta federācija (LaMSF)' },
  FIN: { fed: 'Suomen Moottoriliitto (SML)' },
  CZE: { fed: 'Autoklub České republiky (AČR)' },
  SLO: { fed: 'Avto-moto zveza Slovenije (AMZS)' },
  ITA: { fed: 'Federazione Motociclistica Italiana (FMI)' },
  UKR: { fed: 'Federacja Motocyklowa Ukrainy (FMU)' },
  RUS: { fed: 'Motocyklowa Federacja Rosji (MFR)', note: 'zawieszona przez FIM – rosyjscy zawodnicy startują pod inną flagą lub bez reprezentacji' },
  FRA: { fed: 'Fédération Française de Motocyclisme (FFM)' },
  USA: { fed: 'American Motorcyclist Association (AMA)' },
  NZL: { fed: 'Motorcycling New Zealand (MNZ)' },
  NOR: { fed: 'Norges Motorsportforbund (NMF)' },
  NED: { fed: 'Koninklijke Nederlandse Motorrijders Vereniging (KNMV)' },
  AUT: { fed: 'Austrian Motorsport Federation (AMF)' },
  SVK: { fed: 'Slovenský motocyklový zväz (SMZ)' },
  HUN: { fed: 'Magyar Motorsport Szövetség (MAMS)' },
  EST: { fed: 'Eesti Mootorrattaspordi Föderatsioon (EMF)' },
  ARG: { fed: 'Federación Argentina de Motociclismo' },
};
// Liczebność kadr (seniorzy / juniorzy U21)
const SQUAD_SIZE = { POL: [10, 8] };
const squadSize = cc => SQUAD_SIZE[cc] || [8, 6];
// do kadry: aktywni zawodnicy kraju, którzy w sezonie jeżdżą – w polskim klubie albo w lidze zagranicznej
const nationEligible = (r, cc) => r && r.active && !r.retired && r.country === cc && (r.clubId || (r.fl && r.fl.list && r.fl.list.length)) &&
  (cc !== 'POL' || typeof polEligible !== 'function' || polEligible(r));

// Powołania na sezon: { season, squads: { CC: { sen: [ids], jun: [ids] } } }
function nationalSquads(season = sportSeason()) {
  if (G.natSquads && G.natSquads.season === season) return G.natSquads.squads;
  const byCc = {};
  for (const r of Object.values(G.riders)) if (r.active && !r.retired && r.country && r.country !== 'UNK') (byCc[r.country] = byCc[r.country] || []).push(r);
  const squads = {};
  for (const [cc, rs] of Object.entries(byCc)) {
    const el = rs.filter(r => nationEligible(r, cc)).sort(by_skill);
    const [ns, nj] = squadSize(cc);
    const age = r => (typeof ageIn === 'function' ? ageIn(r, season) : riderAge(r));
    squads[cc] = { sen: el.filter(r => age(r) >= 16).slice(0, ns).map(r => r.id), jun: el.filter(r => age(r) <= 21 && age(r) >= 16).slice(0, nj).map(r => r.id) };
  }
  G.natSquads = { season, date: G.date, squads };
  return squads;
}
function by_skill(a, b) { return (b.skill || 0) - (a.skill || 0); }
const squadOf = (cc, season) => ((!fimSuspended(cc, `${season}-06-01`) && nationalSquads(season)[cc]) || { sen: [], jun: [] }); // zawieszenie FIM (js/nationality.js)
// Nowy sezon: nowe powołania (wiadomość o kadrze Polski, gdy powołano zawodnika gracza)
function nationsNewSeason() {
  G.natSquads = null;
  const sq = squadOf('POL');
  const mine = [...new Set([...sq.sen, ...sq.jun])].map(id => G.riders[id]).filter(r => r && r.clubId === G.clubId);
  if (mine.length) addMsg({ category: 'drużyna', from: 'Sztab kadry', title: `Powołania do kadry Polski (${mine.length})`,
    body: `<p>Do kadry na sezon ${sportSeason()} powołano: ${mine.map(r => `<a href="#/zawodnik/${r.id}">${esc(r.name)}</a>${sq.jun.includes(r.id) && !sq.sen.includes(r.id) ? ' (juniorzy)' : ''}`).join(', ')}.</p>`, link: '#/kraj/POL/kadra' });
}
// Ligi kraju: polskie z gry, zagraniczne z modelu terminarza (js/schedule.js)
function nationLeagues(cc) {
  if (cc === 'POL') return LEAGUE_ORDER.map(l => ({ name: LEAGUES[l].name, level: 3 - LEAGUES[l].level + 1, link: '#/liga' }));
  if (typeof FOREIGN_LEAGUES === 'undefined') return [];
  return Object.values(FOREIGN_LEAGUES).filter(l => l.country === cc && !l.cup).sort(by(l => l.prestige, -1)).map(l => ({ name: l.name, level: clamp(Math.round(l.prestige * 0.6), 1, 3) }));
}
// Najmocniejsze kluby: kluby gry z danego kraju (siła składu) i drużyny lig zagranicznych (z przydziału zawodników)
function nationClubs(cc) {
  const out = [];
  for (const c of Object.values(G.clubs)) {
    const g = typeof geoOf === 'function' ? geoOf(c.city) : null;
    if ((g ? g[2] : 'POL') !== cc || (typeof clubActive === 'function' && !clubActive(c))) continue;
    const rs = clubRiders(c.id).sort(by_skill).slice(0, 7);
    out.push({ name: c.name, club: c, league: LEAGUES[c.league].short, str: sum(rs.map(r => r.skill)) / 7 });
  }
  if (typeof FOREIGN_LEAGUES !== 'undefined') {
    const teams = {};
    for (const r of Object.values(G.riders)) for (const x of (r.fl && r.fl.season === G.season ? r.fl.list : [])) {
      const L = FOREIGN_LEAGUES[x.id];
      if (!L || L.country !== cc || !x.team) continue;
      (teams[x.team + '|' + x.id] = teams[x.team + '|' + x.id] || { name: x.team, league: L.name, rs: [], prestige: L.prestige }).rs.push(r);
    }
    for (const t of Object.values(teams)) out.push({ name: t.name, league: t.league, str: sum(t.rs.sort(by_skill).slice(0, 7).map(r => r.skill)) / 7 + t.prestige * 0.4 });
  }
  return out.sort(by(x => x.str, -1));
}
const nationCoach = cc => Object.values(G.staff).find(s => s.national === cc) || null;
const nationRiders = cc => Object.values(G.riders).filter(r => r.active && !r.retired && r.country === cc).sort(by_skill);
// Turnieje Zaplecza Kadry Juniorów: polscy juniorzy spoza kadry juniorów
function tzkjExcluded(season) { return new Set(squadOf('POL', season).jun.map(String)); }
