'use strict';
// Narzędzia wspólne: losowość, daty, formatowanie, flagi, awatary.

// ---------- Losowość ----------
// Deterministyczny hash tekstu (np. do dnia/miesiąca urodzenia) i generator mulberry32
function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let RNG = Math.random;
function seedRng(seed) { RNG = mulberry(seed); }
const rnd = () => RNG();
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const chance = p => rnd() < p;
function gauss(sd = 1) { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const round1 = x => Math.round(x * 10) / 10;
const round2 = x => Math.round(x * 100) / 100;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const sum = a => a.reduce((s, x) => s + x, 0);
const by = (f, dir = 1) => (a, b) => { const x = f(a), y = f(b); return x < y ? -dir : x > y ? dir : 0; };

// ---------- Daty (ISO YYYY-MM-DD, bez stref czasowych) ----------
// Daty ISO; sam rocznik (np. adepci z rejestru PZM) traktowany jako połowa roku
const D = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, (m || 7) - 1, d || 1)); };
const iso = dt => dt.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const dayDiff = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const dow = s => (D(s).getUTCDay() + 6) % 7; // 0 = poniedziałek
const yearOf = s => Number(s.slice(0, 4));
const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const DAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const DAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const fmtDate = s => { if (!s) return '—'; if (/^\d{4}$/.test(s)) return `rocznik ${s}`; const d = D(s); return `${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const fmtDateShort = s => { if (!s) return '—'; if (/^\d{4}$/.test(s)) return `rocznik ${s}`; const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };
const fmtDay = s => `${DAYS[dow(s)]}, ${fmtDate(s)}`;
function ageAt(born, date) {
  if (!born) return null;
  const b = D(born), d = D(date);
  let a = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

// ---------- Formatowanie ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('pl-PL');
const fmtNum = n => nf.format(Math.round(n || 0));
function fmtMoney(n, short) {
  n = Math.round(n || 0);
  if (short) {
    const a = Math.abs(n);
    if (a >= 1e6) return `${(n / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} mln zł`;
    if (a >= 1e4) return `${Math.round(n / 1e3).toLocaleString('pl-PL')} tys. zł`;
  }
  return `${nf.format(n)} zł`;
}
const plural = (n, one, few, many) => { const a = Math.abs(n), t = a % 10, h = a % 100; return a === 1 ? one : t >= 2 && t <= 4 && !(h >= 12 && h <= 14) ? few : many; };
const initials = name => name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const starsPlain = (v, max = 5) => stars(v, max).replace(/ title="[^"]*"/, ''); // bez podpowiedzi z liczbą gwiazdek
const stars = (v, max = 5) => { const full = Math.floor(v), half = v - full >= .5; return `<span class="stars" title="${round1(v)} / ${max}">${'★'.repeat(full)}${half ? '<span class="half">★</span>' : ''}<span class="off">${'★'.repeat(max - full - (half ? 1 : 0))}</span></span>`; };

// ---------- Kraje i flagi (SVG, działają bez internetu) ----------
const COUNTRY = {
  POL: 'Polska', GBR: 'Wielka Brytania', SWE: 'Szwecja', DEN: 'Dania', AUS: 'Australia', ARG: 'Argentyna', FIN: 'Finlandia',
  GER: 'Niemcy', LAT: 'Łotwa', CZE: 'Czechy', SLO: 'Słowenia', ITA: 'Włochy', NZL: 'Nowa Zelandia', RUS: 'Rosja', USA: 'USA',
  NOR: 'Norwegia', FRA: 'Francja', UKR: 'Ukraina', NED: 'Holandia', AUT: 'Austria', SVK: 'Słowacja', HUN: 'Węgry', EST: 'Estonia', ROU: 'Rumunia', UNK: 'Nieznany',
};
const hStripes = cols => cols.map((c, i) => `<rect y="${(i * 20) / cols.length}" width="30" height="${20 / cols.length + .1}" fill="${c}"/>`).join('');
const vStripes = cols => cols.map((c, i) => `<rect x="${(i * 30) / cols.length}" width="${30 / cols.length + .1}" height="20" fill="${c}"/>`).join('');
const nordic = (bg, c1, c2) => `<rect width="30" height="20" fill="${bg}"/><rect x="8" width="${c2 ? 6 : 4}" height="20" fill="${c1}"/><rect y="${c2 ? 7 : 8}" width="30" height="${c2 ? 6 : 4}" fill="${c1}"/>` +
  (c2 ? `<rect x="9.5" width="3" height="20" fill="${c2}"/><rect y="8.5" width="30" height="3" fill="${c2}"/>` : '');
const unionJack = (w = 30, h = 20) => `<svg x="0" y="0" width="${w}" height="${h}" viewBox="0 0 60 40" preserveAspectRatio="none"><rect width="60" height="40" fill="#012169"/><path d="M0,0 60,40M60,0 0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 60,40M60,0 0,40" stroke="#C8102E" stroke-width="3"/><path d="M30,0v40M0,20h60" stroke="#fff" stroke-width="12"/><path d="M30,0v40M0,20h60" stroke="#C8102E" stroke-width="7"/></svg>`;
const southStars = `<g fill="#fff"><circle cx="22" cy="5" r="1.1"/><circle cx="25.5" cy="9" r="1.1"/><circle cx="19" cy="10" r="1.1"/><circle cx="22" cy="15" r="1.3"/></g>`;
const FLAG_SVG = {
  POL: hStripes(['#fff', '#dc143c']), GER: hStripes(['#000', '#dd0000', '#ffce00']), RUS: hStripes(['#fff', '#0039a6', '#d52b1e']),
  NED: hStripes(['#ae1c28', '#fff', '#21468b']), AUT: hStripes(['#ed2939', '#fff', '#ed2939']), HUN: hStripes(['#ce2939', '#fff', '#477050']),
  EST: hStripes(['#0072ce', '#000', '#fff']), ROU: vStripes(['#002b7f', '#fcd116', '#ce1126']), UKR: hStripes(['#0057b7', '#ffd700']), LAT: `<rect width="30" height="20" fill="#9e3039"/><rect y="8" width="30" height="4" fill="#fff"/>`,
  ITA: vStripes(['#009246', '#fff', '#ce2b37']), FRA: vStripes(['#0055a4', '#fff', '#ef4135']),
  SLO: hStripes(['#fff', '#0000ff', '#ff0000']) + `<path d="M7,4h6v5c0,3-3,4-3,4s-3-1-3-4z" fill="#0000ff" stroke="#ff0000" stroke-width=".6"/>`,
  SVK: hStripes(['#fff', '#0b4ea2', '#ee1c25']) + `<path d="M6,4h8v7c0,3-4,5-4,5s-4-2-4-5z" fill="#ee1c25" stroke="#fff" stroke-width=".7"/>`,
  ARG: hStripes(['#74acdf', '#fff', '#74acdf']) + `<circle cx="15" cy="10" r="2" fill="#f6b40e"/>`,
  CZE: `<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d7141a"/><path d="M0,0 15,10 0,20z" fill="#11457e"/>`,
  SWE: nordic('#006aa7', '#fecc00'), DEN: nordic('#c8102e', '#fff'), FIN: nordic('#fff', '#002f6c'), NOR: nordic('#ba0c2f', '#fff', '#00205b'),
  GBR: unionJack(), AUS: `<rect width="30" height="20" fill="#012169"/>${unionJack(15, 10)}${southStars}<circle cx="7.5" cy="15" r="1.6" fill="#fff"/>`,
  NZL: `<rect width="30" height="20" fill="#012169"/>${unionJack(15, 10)}<g fill="#cc142b" stroke="#fff" stroke-width=".4"><circle cx="22" cy="5" r="1.1"/><circle cx="25.5" cy="9" r="1.1"/><circle cx="19" cy="10" r="1.1"/><circle cx="22" cy="15" r="1.3"/></g>`,
  USA: `${hStripes(['#b22234', '#fff', '#b22234', '#fff', '#b22234', '#fff', '#b22234'])}<rect width="13" height="11" fill="#3c3b6e"/>`,
  UNK: `<rect width="30" height="20" fill="#555"/>`,
};
const flag = (code, cls = '') => `<svg class="flag ${cls}" viewBox="0 0 30 20" preserveAspectRatio="none" role="img" aria-label="${esc(COUNTRY[code] || code)}"><title>${esc(COUNTRY[code] || code)}</title>${FLAG_SVG[code] || FLAG_SVG.UNK}</svg>`;
const flagCode = code => `<a class="fc" href="#/kraj/${esc(code)}" onclick="event.stopPropagation()">${flag(code)}<span>${esc(COUNTRY[code] || code)}</span></a>`;
// Dopełniacz nazw krajów: „menedżer reprezentacji Danii”
const COUNTRY_GEN = { POL: 'Polski', DEN: 'Danii', AUS: 'Australii', GBR: 'Wielkiej Brytanii', SWE: 'Szwecji', CZE: 'Czech', GER: 'Niemiec', LAT: 'Łotwy', UKR: 'Ukrainy',
  SVK: 'Słowacji', FRA: 'Francji', NOR: 'Norwegii', FIN: 'Finlandii', USA: 'USA', SLO: 'Słowenii', HUN: 'Węgier', ITA: 'Włoch', NED: 'Holandii', ARG: 'Argentyny', RUS: 'Rosji',
  CRO: 'Chorwacji', AUT: 'Austrii', NZL: 'Nowej Zelandii', EST: 'Estonii', BUL: 'Bułgarii', ROU: 'Rumunii', CAN: 'Kanady', SUI: 'Szwajcarii', BEL: 'Belgii', ESP: 'Hiszpanii', SRB: 'Serbii', LTU: 'Litwy', BLR: 'Białorusi' };
const nationTeam = cc => `reprezentacji ${COUNTRY_GEN[cc] || (COUNTRY[cc] || cc)}`;
// Flaga i nazwa kraju jako link do strony kraju
const countryLink = (code, withName = true) => `<a class="fc country-link" href="#/kraj/${esc(code)}" onclick="event.stopPropagation()">${flag(code)}${withName ? ` ${esc(COUNTRY[code] || code)}` : ''}</a>`;

// ---------- Awatary (bez zdjęcia: sylwetka z img/placeholders/sil-1..4.png w stonowanym kolorze klubu). Prawdziwe zdjęcie: img/riders/<id>.jpg ----------
// kolor klubu przygaszony (nasycenie ×0,5, jasność 38–58%), żeby biały, granat czy jaskrawa żółć nie gryzły się z ciemnym tłem
function mutedTone(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#5d6675';
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  const h = !d ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return `hsl(${Math.round(h * 60)} ${Math.round(s * 50)}% ${Math.round(Math.min(.58, Math.max(.38, l)) * 100)}%)`;
}
// sylwetka zastępcza: kształt (1 z 4) wg imienia, kolor wg klubu
function silhouette(seed, color) {
  const url = `url(img/placeholders/sil-${hashStr(seed) % 4 + 1}.png)`;
  return `<span class="sil"><i style="background:${mutedTone(color)};-webkit-mask-image:${url};mask-image:${url}"></i></span>`;
}
// Zdjęcia zawodników i herby z img/assets-map.json (wczytane do DATA.assets przez tools/import_xlsx.py)
const ASSETS = (typeof DATA !== 'undefined' && DATA.assets) || { riders: {}, clubs: {}, leagues: {} };
const nameSlug = n => String(n).replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/ø/g, 'o').replace(/Ø/g, 'O').replace(/æ/g, 'ae').replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const riderPhoto = (id, name) => ASSETS.riders[id] || (name && ASSETS.bySlug && ASSETS.bySlug[nameSlug(name)]) || null;
function avatar(p, club, cls = '') {
  const c = club ? club.colors : ['#56627a', '#c9d2e0'];
  const photo = riderPhoto(p.id, p.name);
  if (!photo && p.mgrChild) return kidPic(p, silhouette(p.name, c[0]), cls); // dziecko menedżera: zdjęcie z img/riders lub img/staff
  if (!photo && /^A\d/.test(String(p.id))) return folderPic(p.name, silhouette(p.name, c[0]), cls, '', ['riders']); // adept: img/riders/<imię-nazwisko> bez ponownego importu
  if (photo) return `<div class="avatar photo ${cls}"><img src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentNode.classList.remove('photo');this.parentNode.innerHTML=silhouette(${JSON.stringify(p.name).replace(/"/g, '&quot;')}, '${c[0]}')"></div>`;
  return `<div class="avatar ${cls}">${silhouette(p.name, c[0])}</div>`;
}
const leagueLogo = (lg, cls = '') => ASSETS.leagues[lg] ? `<img class="league-logo ${cls}" src="${esc(ASSETS.leagues[lg])}" alt="">` : '';
// Awatar bez zdjęcia: grafika zastępcza
function picOr(x, fallback, cls = '', style = '') { return `<div class="avatar ${cls}" style="${style}">${fallback}</div>`; }
// Zdjęcie osoby po imieniu i nazwisku: img/<folder>/<imię-nazwisko>.png|jpg|webp|jpeg (bez importu) – foldery w podanej kolejności
// (sztab, menedżer: staff → riders; dzieci menedżera: riders → staff), a gdy pliku nie ma – grafika zastępcza
const STAFF_PIC_EXT = ['png', 'jpg', 'webp', 'jpeg'];
function folderPic(name, fallback, cls = '', style = '', dirs = ['staff', 'riders']) {
  if (!String(name || '').trim()) return picOr(null, fallback, cls, style);
  const sl = nameSlug(name), known = ASSETS.bySlug && ASSETS.bySlug[sl];
  const alts = dirs.flatMap(d => d === 'riders' && known ? [known] : STAFF_PIC_EXT.map(e => `img/${d}/${sl}.${e}`));
  if (!alts.length) return picOr(null, fallback, cls, style);
  // grafika zastępcza widoczna od razu; zdjęcie przykrywa ją dopiero po wczytaniu
  return `<div class="avatar ${cls}" style="${style}">${fallback}<img src="${alts[0]}" data-alts="${alts.slice(1).join('|')}" alt="" style="opacity:0" onload="this.style.opacity=1;this.parentNode.classList.add('photo')" onerror="staffPicErr(this)"></div>`;
}
const staffPic = (s, fallback, cls = '', style = '') => folderPic(s && s.name, fallback, cls, style);
const kidPic = (k, fallback, cls = '', style = '') => k && k.mgrChild ? folderPic(k.name, fallback, cls, style, ['riders', 'staff']) : picOr(k, fallback, cls, style);
function staffPicErr(img) {
  const a = (img.dataset.alts || '').split('|').filter(Boolean);
  if (a.length) { img.dataset.alts = a.slice(1).join('|'); img.src = a[0]; return; }
  img.remove(); // brak zdjęcia – zostaje grafika zastępcza
}
function crest(club, cls = '') {
  if (!club) return '';
  const logo = club.id != null && ASSETS.clubs[club.id];
  if (logo) return `<span class="crest logo ${cls}" title="${esc(club.name)}"><img src="${esc(logo)}" alt="${esc(club.short || '')}" loading="lazy"></span>`;
  const [c1, c2] = club.colors;
  return `<span class="crest ${cls}" title="${esc(club.name)}"><svg viewBox="0 0 40 46"><path d="M20,1 39,7v17c0,11-8,18-19,21C9,42,1,35,1,24V7z" fill="${c1}" stroke="${c2}" stroke-width="2"/><path d="M4,26h32" stroke="${c2}" stroke-width="3" opacity=".7"/><text x="20" y="21" text-anchor="middle" fill="${c2}" font-size="11" font-weight="800" font-family="Barlow Condensed, Arial Narrow, sans-serif">${esc(club.short)}</text></svg></span>`;
}

// ---------- Imiona i nazwiska (sztab, szkółka) ----------
const NAMES = {
  POL: {
    first: ['Jakub', 'Kacper', 'Szymon', 'Filip', 'Mateusz', 'Bartosz', 'Dawid', 'Oskar', 'Wiktor', 'Adrian', 'Kamil', 'Patryk', 'Michał', 'Tomasz', 'Krzysztof', 'Piotr', 'Paweł', 'Marek', 'Grzegorz', 'Łukasz', 'Damian', 'Sebastian', 'Norbert', 'Maciej', 'Igor', 'Antoni', 'Franciszek', 'Nikodem', 'Tymon', 'Hubert', 'Olaf', 'Aleksander', 'Jan', 'Marcel', 'Borys', 'Bruno', 'Leon', 'Miłosz', 'Stanisław', 'Wojciech', 'Rafał', 'Robert', 'Jarosław', 'Zbigniew', 'Andrzej', 'Ryszard'],
    last: ['Nowak', 'Kowalczyk', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski', 'Mazur', 'Kwiatkowski', 'Krawczyk', 'Piotrowski', 'Grabowski', 'Nowakowski', 'Pawłowski', 'Michalski', 'Adamczyk', 'Dudek', 'Zając', 'Wieczorek', 'Jabłoński', 'Król', 'Majewski', 'Olszewski', 'Jaworski', 'Wróbel', 'Malinowski', 'Pawlak', 'Witkowski', 'Walczak', 'Stępień', 'Górski', 'Rutkowski', 'Michalak', 'Sikora', 'Ostrowski', 'Baran', 'Duda', 'Szewczyk', 'Tomaszewski', 'Pietrzak', 'Marciniak', 'Wróblewski', 'Zalewski', 'Jakubowski', 'Jasiński', 'Zawadzki', 'Sadowski', 'Bąk', 'Chmielewski', 'Włodarczyk', 'Borkowski', 'Czarnecki', 'Sawicki', 'Sokołowski', 'Urbański', 'Kubiak', 'Maciejewski', 'Szczepański', 'Kucharski', 'Wilk', 'Kalinowski', 'Lis', 'Mazurek', 'Wysocki', 'Adamski', 'Kaźmierczak', 'Wasilewski', 'Sobczak', 'Czerwiński', 'Andrzejewski', 'Cieślak', 'Głowacki', 'Zakrzewski', 'Kołodziej', 'Sikorski', 'Krajewski', 'Gajewski', 'Szulc', 'Szymczak', 'Baranowski', 'Laskowski', 'Brzeziński', 'Makowski', 'Ziółkowski', 'Przybylski'],
  },
  GER: { first: ['Lukas', 'Jonas', 'Max', 'Tim', 'Leon', 'Erik', 'Kai', 'Norick', 'Ben'], last: ['Müller', 'Schmidt', 'Huber', 'Bauer', 'Wagner', 'Becker', 'Hoffmann', 'Wolf'] },
  LAT: { first: ['Jānis', 'Mārtiņš', 'Kārlis', 'Artūrs', 'Edgars', 'Roberts'], last: ['Bērziņš', 'Kalniņš', 'Ozoliņš', 'Liepiņš', 'Krūmiņš', 'Zariņš'] },
};
// prawdziwe rozkłady imion i nazwisk (js/names-data.js, js/intake.js: realName); bez bazy – krótka lista zapasowa
function genName(country = 'POL', opts) {
  const real = typeof realName === 'function' && typeof G !== 'undefined' && G ? realName(country, opts || {}) : null;
  if (real) return real;
  const n = NAMES[country] || NAMES.POL;
  return `${pick(n.first)} ${pick(n.last)}`;
}

// ---------- DOM ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
