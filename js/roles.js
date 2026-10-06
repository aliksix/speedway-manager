'use strict';
// Role zawodników w drużynie (jak status w kadrze w FM): obietnica startów zapisana w kontrakcie. Rola wpływa na:
// – negocjacje: zawodnik oczekuje roli wynikającej z jego poziomu i składu klubu; niższa rola = wyższe żądania albo odmowa;
// – morale: co miesiąc w sezonie liczone są starty względem obietnicy; złamana obietnica obniża morale (słabsza forma, prośba o transfer,
//   trudniejsze przedłużenie), dotrzymana – podnosi; rolę można zmienić jednostronnie (degradacja boli);
// – klub macierzysty: lidera i ważnych zawodników nie oddaje, jeśli nie ma ich kim zastąpić (zawodnik na rynku lub uzgodniony kontrakt);
//   wykup bywa nieopłacalny – kluby budują skład głównie z zawodników po zakończeniu kontraktu; najpierw przedłuża umowy najważniejszych.
// share: oczekiwany udział w meczach ligowych drużyny (talent / junior DMPJ: łącznie z zawodami młodzieżowymi)
const TEAM_ROLES = {
  lider: { name: 'Lider', lvl: 7, share: 0.92, sell: 2.5, desc: 'drużyna budowana wokół niego – każdy mecz, pełny program i biegi nominowane' },
  wazny: { name: 'Ważny zawodnik', lvl: 6, share: 0.85, sell: 1.6, desc: 'ścisła czołówka składu, jeździ prawie zawsze' },
  podst: { name: 'Zawodnik podstawowy', lvl: 5, share: 0.7, sell: 1, desc: 'pewne miejsce w składzie 1–5' },
  doparowy: { name: 'Doparowy', lvl: 5, share: 0.7, sell: 1, desc: 'senior jeżdżący w parze z liderem – liczy się współpraca' },
  u24: { name: 'Senior U24', lvl: 5, share: 0.7, sell: 1.1, desc: 'pozycja U24 w składzie i starty w Ekstralidze U24' },
  junior: { name: 'Junior podstawowy', lvl: 5, share: 0.8, sell: 1.1, desc: 'numery juniorskie w składzie meczowym' },
  talent: { name: 'Talent', lvl: 4, share: 0.35, sell: 1.25, youth: true, desc: 'rozwój: zawody młodzieżowe, trening, wypożyczenie do niższej ligi' },
  dmpj: { name: 'Junior DMPJ', lvl: 3, share: 0.2, sell: 0.9, youth: true, desc: 'DMPJ, U24 Ekstraliga i zawody młodzieżowe, w lidze okazjonalnie' },
  rezerwa: { name: 'Rezerwowy', lvl: 3, share: 0.3, sell: 0.8, desc: 'zmiennik spoza składu 1–5' },
  awaryjny: { name: 'Awaryjny', lvl: 1, share: 0, sell: 0.7, desc: 'uzupełnienie kadry, bez obietnicy startów' },
  zbedny: { name: 'Niepotrzebny', lvl: 0, share: 0, sell: 0.55, desc: 'do sprzedaży lub wypożyczenia' },
};
const roleName = k => (TEAM_ROLES[k] || {}).name || '—';
const roleLvl = k => (TEAM_ROLES[k] || { lvl: 3 }).lvl;
// Rola, której zawodnik oczekuje w danym klubie (pozycja w kadrze po dołączeniu, junior / U24, potencjał)
function expectedRole(r, clubId, season = sportSeason()) {
  const others = Object.values(G.riders).filter(x => x.id !== r.id && !x.retired && x.contract && x.contract.clubId === clubId && x.contract.until >= season && x.contract.kind !== 'warszawski');
  const all = others.concat([r]).sort(by(x => x.skill, -1));
  const overall = all.indexOf(r);
  const young = ageIn(r, season) <= 23, gap = (r.pa ?? r.potential * 1) - (r.ca ?? r.skill * 5);
  // talent: wysoki potencjał i duża rezerwa rozwoju – najwyżej dwóch w klubie (najwyższy potencjał)
  const talentOk = x => ageIn(x, season) <= 23 && (x.pa ?? x.potential) >= 58 && (x.pa ?? x.potential) - (x.ca ?? x.skill * 5) >= 12;
  const jrAll = all.filter(x => isJunior(x, season)), snAll = all.filter(x => !isJunior(x, season));
  const core = x => isJunior(x, season) ? jrAll.indexOf(x) <= 1 : snAll.indexOf(x) <= 4; // skład meczowy – nie „talent”, tylko pełna rola
  const isTalent = talentOk(r) && all.filter(x => talentOk(x) && !core(x)).sort(by(x => x.pa ?? x.potential, -1)).indexOf(r) < 2;
  if (isJunior(r, season)) {
    if (overall <= 1) return 'wazny';
    // DMPJ – tylko krajowi juniorzy; na numerach juniorskich w lidze zagraniczny junior tylko w PGE (w niższych ligach – krajowi)
    const dom = typeof isDomestic === 'function' ? isDomestic(r, clubId) : hasNat(r, 'POL');
    const lg = (G.clubs[clubId] || {}).league;
    const jr = all.filter(x => isJunior(x, season) && (lg === 'PGE' || (typeof isDomestic === 'function' ? isDomestic(x, clubId) : hasNat(x, 'POL'))));
    const j = jr.indexOf(r);
    if (j >= 0 && j <= 1) return 'junior';
    if (isTalent) return 'talent';
    return dom && j <= 4 ? 'dmpj' : 'rezerwa';
  }
  const sen = all.filter(x => !isJunior(x, season)), p = sen.indexOf(r);
  if (p === 0) return 'lider';
  if (p === 1) return r.skill >= sen[0].skill - 0.8 ? 'lider' : 'wazny';
  if (p === 2) return 'wazny';
  if (p <= 4) {
    const u24 = sen.filter(x => ageIn(x, season) <= 24);
    if (ageIn(r, season) <= 24 && u24[0] === r) return 'u24';
    return p === 3 ? 'doparowy' : 'podst';
  }
  if (isTalent) return 'talent';
  return p <= 6 ? 'rezerwa' : 'awaryjny';
}
// Rola z kontraktu (albo wyliczona, gdy kontrakt jej nie ma)
function roleOf(r) {
  const k = r.loan && r.loan.toClubId === r.clubId ? r.loan : r.contract;
  if (k && k.role && !(['junior', 'dmpj'].includes(k.role) && !isJunior(r)) && !(k.role === 'dmpj' && !hasNat(r, 'POL') && r.clubId && typeof isDomestic === 'function' && !isDomestic(r, r.clubId))) return k.role; // rola juniorska wygasa, gdy zawodnik przestaje być juniorem
  return r.clubId ? expectedRole(r, r.clubId) : null;
}
// Dopasowanie oferowanej roli do oczekiwań (mnożnik użyteczności oferty dla zawodnika)
function roleFit(r, clubId, role, season) {
  if (!role) return 1;
  const d = roleLvl(role) - roleLvl(expectedRole(r, clubId, season));
  return d < 0 ? Math.max(0.4, 1 + 0.12 * d) : 1 + 0.03 * Math.min(d, 2);
}
// Morale przy rozmowach z własnym klubem (przedłużenie): niezadowolony zawodnik trudniej się zgadza
const moraleFit = (r, clubId) => r.clubId === clubId ? clamp(0.75 + (r.morale ?? 70) / 300, 0.78, 1.02) : 1;
// Role kadry klubu AI (start gry, nowy sezon): według pozycji w składzie; zawodnicy na liście – niepotrzebni
function rolesAssign(c, season = sportSeason(), force = false) {
  for (const r of Object.values(G.riders)) {
    const k = r.contract;
    if (!k || k.clubId !== c.id || r.retired || k.until < season) continue;
    if (k.role && !force) continue;
    k.role = k.kind === 'warszawski' ? 'awaryjny' : (r.listed || r.sitOut) && c.id !== G.clubId ? 'zbedny' : expectedRole(r, c.id, season);
  }
}
function rolesMigrate() {
  if (G.rolesModel === 1) return false;
  for (const c of Object.values(G.clubs)) rolesAssign(c, sportSeason(), false);
  for (const r of Object.values(G.riders)) if (r.morale == null) r.morale = 70;
  G.rolesModel = 1;
  return true;
}
// Czy klub ma kim zastąpić zawodnika: uzgodniony kontrakt z kimś podobnym albo podobny zawodnik dostępny na rynku
// (Polaka zastąpi tylko Polak – dobrych polskich zawodników jest mało)
function replacementFor(r, holderId, season) {
  const pol = hasNat(r, 'POL'), min = r.skill - 0.6;
  const ok = x => x.id !== r.id && !x.retired && x.active && x.skill >= min && (!pol || hasNat(x, 'POL')) && isJunior(x, season) === isJunior(r, season);
  const incoming = Object.values(G.riders).find(x => ok(x) && ((x.nextContract && x.nextContract.clubId === holderId) || (x.agreed && G.negs[x.agreed] && G.negs[x.agreed].clubId === holderId)));
  if (incoming) return { kind: 'deal', r: incoming };
  const free = Object.values(G.riders).find(x => ok(x) && !x.nextContract && !x.agreed && (!x.contract || x.contract.until < season || isWarsaw(x)) && !x.schoolRights);
  return free ? { kind: 'market', r: free } : null;
}
// Polityka klubu macierzystego wobec oferty za zawodnika (wykup lub wypożyczenie)
function holderPolicy(r, holderId, kind, season) {
  const role = roleOf(r) || 'podst', R = TEAM_ROLES[role] || TEAM_ROLES.podst;
  const key = ['lider', 'wazny'].includes(role), core = R.lvl >= 5;
  const repl = core ? replacementFor(r, holderId, season) : null;
  if (kind === 'loan') {
    if (core && !repl) return { refuse: true, text: `${roleName(role)} – klub nie wypożycza zawodnika ze składu, nie ma go kim zastąpić.` };
    return { refuse: false, mult: core ? 1.5 : 1, role, repl };
  }
  if (key && !repl) return { refuse: true, text: `${roleName(role).toLowerCase()} drużyny – nie na sprzedaż, klub nie ma nikogo na jego miejsce.` };
  let mult = 1; // wycena roli – feeAsk (TEAM_ROLES.sell)
  if (core && !repl) mult *= 1.35; // podstawowy bez zastępcy: tylko za wysoką kwotę
  if (r.wantsOut) mult *= 0.85;
  return { refuse: false, mult, role, repl };
}
// Dlaczego zawodnik nie mógł pojechać w meczu danego dnia (null – był do dyspozycji): kontuzja w okresie urazu,
// zawody FIM / Grand Prix tego dnia, zakaz startów w Polsce (zawieszenie federacji), licencja przed 16. urodzinami, zawieszenie
function roleUnavailable(r, date, fx = null) {
  if (Object.values(G.injuries || {}).some(i => i.riderId === r.id && i.start <= date && date < i.until)) return 'kontuzja';
  if (typeof fimBusy === 'function' && fimBusy(r, date)) return 'zawody FIM / Grand Prix';
  if (typeof plBanned === 'function' && plBanned(r, date)) return 'zakaz startów w Polsce';
  // licencja przed 16. urodzinami: liga od urodzin; skład podaje się 3 dni wcześniej – mecz zaraz po urodzinach też się nie liczy
  if (r.born && typeof leagueFrom === 'function' && (date < leagueFrom(r) || (typeof notifyDate === 'function' && fx && notifyDate(fx) < leagueFrom(r)))) return 'przed 16. urodzinami';
  if (r.suspendedUntil && r.suspendedUntil > date) return 'zawieszenie';
  return null;
}
// Starty zawodnika względem obietnicy w sezonie: mecze ligowe drużyny, w których jeździł (talent / DMPJ: także zawody młodzieżowe).
// Mecze, w których nie mógł pojechać (roleUnavailable), nie liczą się do obietnicy – excused: { powód: liczba meczów }
function promiseCheck(r, season = G.season) {
  const role = roleOf(r), R = TEAM_ROLES[role];
  if (!R || !r.clubId) return null;
  const since = r.contract && r.contract.signed && r.contract.signed > `${season}-01-01` ? r.contract.signed : `${season}-01-01`;
  const fx = seasonFixtures(G.clubs[r.clubId].league, season).filter(f => f.played && (f.homeId === r.clubId || f.awayId === r.clubId) && f.date >= since);
  const id = String(r.id), excused = {};
  let rode = 0, n = 0;
  for (const f of fx) {
    const m = G.matches[f.matchId];
    if (m && m.riders && m.riders[id] && m.riders[id].heats) { rode++; n++; continue; }
    const why = roleUnavailable(r, f.date, f);
    if (why) excused[why] = (excused[why] || 0) + 1; else n++;
  }
  if (R.youth) rode += Object.values(G.matches).filter(m => m.kind !== 'league' && m.date >= since && m.date.slice(0, 4) === String(season) && m.riders && m.riders[id] && m.riders[id].heats).length * 0.5;
  return { role, n, rode, share: n ? Math.min(1, rode / n) : 1, want: R.share, excused, missed: fx.length - n };
}
const excusedText = p => Object.entries(p.excused || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
// 1. dnia miesiąca (maj–październik): morale zawodników naszego klubu względem obietnicy roli
function moraleMonthly() {
  const m = Number(G.date.slice(5, 7));
  if (m < 5 || m > 10) return;
  for (const r of clubRiders(G.clubId)) {
    if (r.morale == null) r.morale = 70;
    const p = promiseCheck(r);
    if (!p || p.n < 4 || r.injury) continue;
    const deficit = p.want - p.share;
    if (deficit > 0.15) {
      r.morale = clamp(r.morale - 4 - deficit * 12, 0, 100);
      if (r.promiseWarn !== G.season) {
        r.promiseWarn = G.season;
        addMsg({ category: 'transfer', from: r.name, title: `${r.name}: za mało startów`, body: `<p>Kontrakt obiecuje rolę <b>${roleName(p.role)}</b> (${esc(TEAM_ROLES[p.role].desc)}), a pojechałem w ${Math.round(p.rode)} z ${p.n} meczów, w których mogłem jechać${p.missed ? ` (pomijam ${p.missed}, gdy byłem niedostępny – ${esc(excusedText(p))})` : ''}. Oczekuję więcej startów albo rozmowy o mojej przyszłości.</p>`, link: `#/zawodnik/${r.id}` });
      }
    } else r.morale = clamp(r.morale + (r.morale < 75 ? 3 : 1), 0, 100);
    if (r.morale < 45) r.form = clamp(r.form - 0.15, -2, 2); // niezadowolenie odbija się na jeździe
    if (r.morale < 30 && !r.wantsOut) {
      r.wantsOut = G.season;
      addMsg({ category: 'transfer', from: r.name, stop: true, title: `${r.name} prosi o transfer`, body: `<p>Nie widzę dla siebie miejsca w drużynie. Proszę o wpisanie na listę transferową albo wypożyczenie.</p>`, link: `#/zawodnik/${r.id}/kontrakt` });
    }
  }
}
// Zmiana roli przez klub (jednostronna): degradacja obniża morale, awans – podnosi
function setRole(rid, role) {
  const r = G.riders[rid], k = r && r.contract;
  if (!k || k.clubId !== G.clubId || !TEAM_ROLES[role]) return { ok: false, text: 'Nie można zmienić roli.' };
  if (['dmpj'].includes(role) && !(typeof isDomestic === 'function' ? isDomestic(r, G.clubId) : hasNat(r, 'POL'))) return { ok: false, text: 'W DMPJ startują tylko krajowi juniorzy – zagraniczny zawodnik nie może mieć roli „Junior DMPJ”.' };
  if (k.kind === 'warszawski' && role !== 'awaryjny') return { ok: false, text: 'Kontrakt warszawski: zawodnik może mieć tylko rolę „Awaryjny” (bez wynagrodzenia i gwarancji startów).' };
  const old = k.role || expectedRole(r, G.clubId), d = roleLvl(role) - roleLvl(old);
  delete k.rolePending;
  if (role === old) return { ok: true, text: 'Bez zmian.' };
  k.role = role;
  r.morale = clamp((r.morale ?? 70) + (d < 0 ? 8 * d : 4), 0, 100);
  if (d < 0) addMsg({ category: 'transfer', from: r.name, title: `${r.name}: zmiana roli`, body: `<p>Klub zmienił moją rolę z <b>${roleName(old)}</b> na <b>${roleName(role)}</b>. Nie jestem z tego zadowolony.</p>`, link: `#/zawodnik/${r.id}` });
  return { ok: true, text: `${r.name}: ${roleName(role)}${d < 0 ? ' – zawodnik niezadowolony' : ''}.` };
}
// Świeża licencja w klubie gracza: menedżer przypisuje rolę do kontraktu amatorskiego (obietnica startów).
// Pierwszy wybór, nie zmiana – bez kary za „degradację”; rola niższa od oczekiwanej lekko studzi entuzjazm, wyższa go podnosi.
const pendingRoles = () => Object.values(G.riders).filter(r => !r.retired && r.contract && r.contract.rolePending && r.contract.clubId === G.clubId);
function chooseFirstRole(rid, role) {
  const r = G.riders[rid], k = r && r.contract;
  if (!k || !k.rolePending || k.clubId !== G.clubId || !TEAM_ROLES[role]) return { ok: false, text: 'Nie można przypisać roli.' };
  const d = roleLvl(role) - roleLvl(expectedRole(r, G.clubId));
  k.role = role; delete k.rolePending;
  r.morale = clamp((r.morale ?? 70) + (d < 0 ? 3 * d : d > 0 ? 3 : 0), 0, 100);
  return { ok: true, text: `${r.name}: ${roleName(role)}${d < 0 ? ' – liczył na więcej' : d > 0 ? ' – zawodnik zadowolony' : ''}.` };
}
const moraleLabel = v => v >= 80 ? 'bardzo dobre' : v >= 65 ? 'dobre' : v >= 45 ? 'przeciętne' : v >= 30 ? 'słabe' : 'bardzo słabe';
