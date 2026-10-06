'use strict';
// Ekran startowy: menu (zapisane gry, nowa gra), kreator postaci menedżera (dane, doświadczenie, atrybuty,
// przeszłość żużlowa, opcjonalnie profil trenera) i wybór klubu na końcu. Także strona profilu menedżera w grze.

let START = { saves: null, wiz: null, shownStep: null };
const STEP_NAMES = { dane: 'Dane osobowe', menedzer: 'Menedżer', kwalifikacje: 'Kwalifikacje trenerskie', trener: 'Profil trenera', klub: 'Wybór klubu' };
const WIZ = {};

async function renderStart() {
  document.body.classList.add('start');
  document.documentElement.style.setProperty('--club', '#3fa7ff');
  if (START.saves === null && DB.on) { try { START.saves = await dbList(); } catch (e) { START.saves = []; } }
  const prev = $('#app > .start'), scroll = prev ? prev.scrollTop : 0;
  const w = START.wiz;
  $('#app').innerHTML = w ? wizardHtml(w) : menuHtml();
  const cur = $('#app > .start');
  if (cur && w && START.shownStep === w.step) cur.scrollTop = scroll; // ten sam krok – bez skoku na górę
  START.shownStep = w ? w.step : null;
}
function heroHtml() {
  return `<div class="hero">${crest({ name: 'ŻM', short: 'ŻM', colors: ['#c8102e', '#f2c14e'] }, 'xl')}<div><h1>Żużlowy <span>Menedżer</span></h1>
    <p>Gra startuje 15 października ${START_SEASON}, po zakończeniu sezonu ${START_SEASON}. Kadry na sezon ${START_SEASON + 1}${DATA.rosters2026 ? ` według ${esc(DATA.rosters2026.source)}` : ''}, ligi i terminarze według GKSŻ, Grand Prix według kalendarza FIM. Baza: ${DATA.riders.length} zawodników, ${DATA.clubs.length} kluby polskich lig (${esc(DATA.source)}).</p></div></div>`;
}
const saveTime = s => new Date(s.updated).getTime() || 0;
function saveItem(s) {
  return `<div class="save-item">${crest({ id: s.clubId ?? (DATA.clubs.find(c => c.name === s.club) || {}).id, name: s.club, short: s.clubShort || '?', colors: s.colors || ['#445', '#ccd'] })}<div class="grow"><b>${esc(s.club)}</b><div class="small muted">${esc(s.manager || '')} · ${fmtDate(s.date)} · ${esc(s.league || '')}</div><div class="small muted">${(s.size / 1048576).toFixed(1)} MB · zapisano ${new Date(s.updated).toLocaleString('pl-PL')}</div></div>
    <button class="btn sm primary" onclick="ACT.loadGame('${s.id}')">Wczytaj</button><button class="btn sm danger" onclick="ACT.arm(this, 'deleteGame', '${s.id}')">✕</button></div>`;
}
function menuHtml() {
  const saves = (START.saves || []).slice().sort((a, b) => saveTime(b) - saveTime(a));
  const last = saves[0];
  return `<div class="start start-menu">${heroHtml()}
    <div class="wrapc">
      <div class="panel">
        <h3>Zapisane gry</h3>
        ${!DB.on ? '<p class="muted">Niedostępne bez serwera – uruchom grę przez start.bat.</p>' : !saves.length ? '<p class="muted">Brak zapisanych gier. Zacznij nową karierę.</p>' : saves.map(saveItem).join('')}
      </div>
      <div class="stack">
        <div class="panel stack">
          <h3>Nowa gra</h3>
          <p>Stwórz postać menedżera: dane osobowe, doświadczenie i atrybuty, przeszłość żużlowa i – jeśli jeździłeś na żużlu – rola trenera. Na końcu wybierzesz klub.</p>
          <button class="btn primary lg" onclick="ACT.newCareer()">Nowa kariera ▸</button>
          ${DB.on ? '<p class="small muted">Gra zapisuje się w pliku bazy SQLite (folder saves/) po każdym dniu i każdej zmianie.</p>' : '<p class="small warn">Serwer gry nie działa – uruchom grę przez start.bat, aby zapisywać postępy.</p>'}
        </div>
        ${last ? `<div class="panel stack"><h3>Kontynuuj</h3><div class="row">${crest({ id: last.clubId, name: last.club, short: last.clubShort || '?', colors: last.colors || ['#445', '#ccd'] })}<div><b>${esc(last.club)}</b><div class="small muted">${esc(last.manager || '')} · ${fmtDate(last.date)}</div></div></div>
          <button class="btn lg" onclick="ACT.loadGame('${last.id}')">Wczytaj ostatnią grę ▸</button></div>` : ''}
      </div>
    </div></div>`;
}

// ---------- Kreator ----------
function wizardHtml(w) {
  const steps = wizSteps(w), i = steps.indexOf(w.step);
  return `<div class="start wiz">
    <div class="wiz-top">${crest({ name: 'ŻM', short: 'ŻM', colors: ['#c8102e', '#f2c14e'] }, '')}<div class="grow"><h1>Nowa kariera</h1>
      <div class="wiz-steps">${steps.map((s, k) => `<span class="${k < i ? 'done' : k === i ? 'on' : ''}" ${k < i ? `onclick="ACT.wizGo('${s}')"` : ''}><b>${k + 1}</b>${STEP_NAMES[s]}</span>`).join('')}</div></div></div>
    <div class="wiz-body">${WIZ[w.step](w)}</div>
    <div class="wiz-foot"><button class="btn ghost" onclick="ACT.wizCancel()">Anuluj</button><span class="grow"></span>${w.err ? `<span class="neg">${esc(w.err)}</span>` : ''}
      ${i > 0 ? '<button class="btn lg" onclick="ACT.wizBack()">◂ Wstecz</button>' : ''}
      ${w.step === 'klub' ? `<button class="btn primary lg" onclick="ACT.startGame()" ${w.club ? '' : 'disabled'}>Rozpocznij karierę ▸</button>` : '<button class="btn primary lg" onclick="ACT.wizNext()">Dalej ▸</button>'}</div>
  </div>`;
}
const validBorn = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(new Date(d).getTime());
function optCard(x, on, onclick, meta = '') {
  return `<div class="opt ${on ? 'on' : ''}" onclick="${onclick}"><div class="n">${esc(x.name)}</div><div class="s">${esc(x.desc)}</div>${meta ? `<div class="s meta">${meta}</div>` : ''}</div>`;
}
// Podsumowanie postaci (prawa kolumna kreatora)
function summaryCard(w) {
  const p = w.person, name = `${p.first} ${p.last}`.trim(), age = validBorn(p.born) ? ageAt(p.born, GAME_START) : null;
  const me = findById(MGR_EXP, w.mgrExp), sp = findById(SPW_EXP, w.spwExp), ce = findById(COACH_EXP, w.coachExp);
  const top = (defs, vals) => defs.slice().sort((a, b) => vals[b[0]] - vals[a[0]]).slice(0, 3).map(([k, n]) => `${esc(n)} <b class="${attrClass(vals[k])}">${vals[k]}</b>`).join(' · ');
  const reached = k => wizSteps(w).indexOf(k) < wizSteps(w).indexOf(w.step);
  return `<div class="row" style="margin-bottom:12px">${staffPic({ name }, silhouette(name || 'menedżer', '#3fa7ff'), '', 'width:72px;height:72px;border-radius:8px;overflow:hidden;flex:none')}
      <div><div style="font:700 22px var(--cond)">${esc(name) || '<span class="muted">Imię i nazwisko</span>'}</div><div class="small muted">${flagCode(p.country)} ${esc(COUNTRY[p.country] || '')}</div></div></div>
    <div class="kv"><div>Urodzony</div><div>${validBorn(p.born) ? `${fmtDate(p.born)}${p.place.trim() ? `, ${esc(p.place.trim())}` : ''}` : '—'}</div>
      <div>Wiek na starcie</div><div>${age != null ? `${age} lat` : '—'}</div>
      ${w.kids.length ? `<div>Dzieci</div><div>${w.kids.map(c => `${esc(c.first.trim() || '?')}${c.rides ? ' <span class="pill jun">miniżużel</span>' : ''}`).join(', ')}</div>` : ''}
      ${reached('menedzer') || w.step === 'menedzer' ? `<div>Doświadczenie</div><div>${esc(me.name)}</div><div>Najmocniejsze</div><div class="small">${top(MGR_ATTRS, w.mgr)}</div><div>Zaufanie zarządu</div><div>${me.conf}%</div>` : ''}
      ${reached('kwalifikacje') || w.step === 'kwalifikacje' ? `<div>Żużel</div><div>${esc(sp.name)}</div><div>Kompetencje</div><div>${esc(ce.name)}${ce.lic && w.licYear ? ` (${esc(String(w.licYear))})` : ''}</div>` : ''}
      ${reached('trener') || w.step === 'trener' ? `<div>Rola</div><div>menedżer drużyny (główny trener)</div><div>Specjalizacja</div><div>${esc(TRAIN_PROFILES[w.profile].name)}${w.side ? ` + ${esc(TRAIN_PROFILES[w.side].name.toLowerCase())}` : ''}</div><div>Najmocniejsze</div><div class="small">${top(COACH_ATTRS, w.coachAttrs)}</div>` : ''}
    </div>`;
}
function wizPreview() { const el = $('#wizPreview'); if (el) el.innerHTML = summaryCard(START.wiz); }
function allocHtml(kind, defs, vals, pool, cap, title, note) {
  const left = pool - pointsSpent(vals);
  return `<div class="panel"><div class="row wrap" style="margin-bottom:6px"><h3 class="grow" style="margin:0">${title}</h3>
      <span class="pts ${left < 0 ? 'neg' : left === 0 ? 'pos' : 'warn'}">Do rozdzielenia: <b>${left}</b> z ${pool} pkt</span>
      <button class="btn sm" onclick="ACT.wizEven('${kind}')">Rozdziel równo</button><button class="btn sm" onclick="ACT.wizReset('${kind}')">Wyzeruj</button></div>
    <p class="small muted">${note} Każdy atrybut w skali ${ATTR_MIN}–${cap} (maksimum zależy od doświadczenia). Shift + klik zmienia o 5.</p>
    <div class="alloc">${defs.map(([k, n, d]) => `<div class="arow"><div class="grow"><b>${esc(n)}</b><div class="small muted">${esc(d)}</div></div>
      <button class="btn sm" onclick="ACT.wizAttr('${kind}','${k}',event.shiftKey?-5:-1)" ${vals[k] <= ATTR_MIN ? 'disabled' : ''}>−</button>
      <span class="v ${attrClass(vals[k])}">${vals[k]}</span>
      <button class="btn sm" onclick="ACT.wizAttr('${kind}','${k}',event.shiftKey?5:1)" ${vals[k] >= cap || left <= 0 ? 'disabled' : ''}>+</button></div>`).join('')}</div></div>`;
}

WIZ.dane = w => {
  const p = w.person;
  const cities = [...new Set([...DATA.clubs.map(c => c.city), 'Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk', 'Łódź'].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));
  return `<div class="grid wiz-2"><div class="stack"><div class="panel stack"><h3>Dane osobowe menedżera</h3>
      <div class="grid g2"><label class="fld">Imię<input id="wizFirst" maxlength="20" value="${esc(p.first)}" placeholder="np. Jan" oninput="START.wiz.person.first=this.value;wizPreview()"></label>
        <label class="fld">Nazwisko<input maxlength="28" value="${esc(p.last)}" placeholder="np. Kowalski" oninput="START.wiz.person.last=this.value;wizPreview()"></label></div>
      <div class="grid g2"><label class="fld">Data urodzenia<input type="date" min="1945-01-01" max="2007-10-15" value="${esc(p.born)}" onchange="START.wiz.person.born=this.value;wizPreview()"></label>
        <label class="fld">Obywatelstwo<select onchange="START.wiz.person.country=this.value;wizPreview()">${Object.entries(COUNTRY).filter(([k]) => k !== 'UNK').map(([k, n]) => `<option value="${k}" ${k === p.country ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>
      <label class="fld">Miejsce urodzenia<input list="wizCities" maxlength="32" value="${esc(p.place)}" placeholder="np. Leszno" oninput="START.wiz.person.place=this.value;wizPreview()"><datalist id="wizCities">${cities.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
      <p class="small muted">Wiek wpływa na odbiór w środowisku: młody menedżer ma nowocześniejsze metody, starszy – więcej autorytetu u weteranów.</p>
    </div>${kidsPanel(w)}</div><div class="panel" id="wizPreview">${summaryCard(w)}</div></div>`;
};
// Dzieci menedżera (do 15 lat rocznikowo w 2026); jeżdżące dołączają do szkółki miniżużla wybranego klubu
function kidsPanel(w) {
  const last = w.person.last.trim();
  return `<div class="panel"><div class="row" style="margin-bottom:6px"><h3 class="grow" style="margin:0">Dzieci</h3>
      ${w.kids.length < MAX_CHILDREN ? '<button class="btn sm" onclick="ACT.wizKid()">+ Dodaj dziecko</button>' : ''}</div>
    <p class="small muted">Opcjonalnie. Można podać dzieci do ${CHILD_MAX_AGE} lat (rocznik ${CHILD_SEASON - CHILD_MAX_AGE} i młodsze). Dziecko, które jeździ na żużlu, zostanie dopisane do bazy jako adept szkółki miniżużla klubu, który wybierzesz – z klasą pojemności zależną od wieku; dziecko młodsze niż ${CHILD_JOIN_AGE} lat dołączy w dniu ${CHILD_JOIN_AGE}. urodzin. Jego talent poznasz dopiero z czasem.</p>
    ${w.kids.length ? `<div class="kids">${w.kids.map((c, i) => `<div class="kid">
      <label class="fld">Imię<input maxlength="20" value="${esc(c.first)}" placeholder="imię" oninput="START.wiz.kids[${i}].first=this.value"></label>
      <div class="fld small muted">Nazwisko<div class="kid-last">${esc(last) || '—'}</div></div>
      <label class="fld">Data urodzenia<input type="date" min="${CHILD_SEASON - CHILD_MAX_AGE}-01-01" max="${GAME_START}" value="${esc(c.born)}" onchange="START.wiz.kids[${i}].born=this.value;renderStart()"></label>
      <label class="check"><input type="checkbox" ${c.rides ? 'checked' : ''} onchange="START.wiz.kids[${i}].rides=this.checked;renderStart()">jeździ na żużlu</label>
      <button class="btn sm danger" onclick="ACT.wizKid(${i})" title="Usuń">✕</button>
      ${c.rides && /^\d{4}-\d{2}-\d{2}$/.test(c.born) && childJoinDate(c.born) > GAME_START ? `<div class="kid-note small muted">Ma mniej niż ${CHILD_JOIN_AGE} lat – dołączy do szkółki miniżużla w dniu ${CHILD_JOIN_AGE}. urodzin (${fmtDate(childJoinDate(c.born))}).</div>` : ''}</div>`).join('')}</div>` : ''}
  </div>`;
}
ACT.wizKid = i => { const w = START.wiz; if (i == null) w.kids.push({ first: '', born: `${CHILD_SEASON - 9}-05-01`, rides: true }); else w.kids.splice(i, 1); w.err = ''; renderStart(); };
WIZ.menedzer = w => {
  const e = findById(MGR_EXP, w.mgrExp);
  return `<div class="grid wiz-2"><div class="stack">
      <div class="panel"><h3>Doświadczenie w zarządzaniu sportem</h3><div class="wiz-opts">${MGR_EXP.map(x => optCard(x, x.id === w.mgrExp, `ACT.wizSet('mgrExp','${x.id}')`, `${x.pool} pkt · maks. ${x.cap} · zaufanie zarządu ${x.conf}%`)).join('')}</div></div>
      ${allocHtml('mgr', MGR_ATTRS, w.mgr, e.pool, e.cap, 'Atrybuty menedżera', 'Rozdziel punkty między umiejętności menedżerskie.')}
    </div><div class="panel" id="wizPreview">${summaryCard(w)}</div></div>`;
};
WIZ.kwalifikacje = w => {
  const sp = findById(SPW_EXP, w.spwExp), ce = findById(COACH_EXP, w.coachExp);
  return `<div class="grid wiz-2"><div class="stack">
      <div class="panel"><h3>Doświadczenie żużlowe</h3><p class="small muted">Jesteś debiutantem – bez startów w lidze i bez prowadzonych klubów.</p><div class="wiz-opts">${SPW_EXP.map(x => optCard(x, x.id === w.spwExp, `ACT.wizSet('spwExp','${x.id}')`, x.coachBonus ? `+${x.coachBonus} pkt trenerskich · autorytet +${x.auth}` : 'bez premii')).join('')}</div></div>
      <div class="panel"><h3>Kompetencje trenerskie</h3><div class="wiz-opts">${COACH_EXP.map(x => optCard(x, x.id === w.coachExp, `ACT.wizSet('coachExp','${x.id}')`, `${x.pool + sp.coachBonus} pkt · maks. ${x.cap}${x.lic ? ` · licencja: ${x.lic}` : ''}`)).join('')}</div>
        ${ce.lic ? `<label class="fld" style="margin-top:12px;max-width:260px">Rok uzyskania uprawnień (${ce.lic})<input type="number" min="${validBorn(w.person.born) ? Number(w.person.born.slice(0, 4)) + 18 : 1960}" max="${START_SEASON}" value="${esc(String(w.licYear || ''))}" placeholder="np. 2022" oninput="START.wiz.licYear=this.value;wizPreview()"></label>` : ''}</div>
      <div class="panel"><p class="small muted">Jako menedżer drużyny jesteś też jej głównym trenerem: prowadzisz trening, a jego jakość i to, które cechy rosną szybciej, zależą od Twoich atrybutów trenerskich i specjalizacji. Dotychczasowy menedżer klubu odchodzi i trafia na listę trenerów bez kontraktu.</p></div>
    </div><div class="panel" id="wizPreview">${summaryCard(w)}</div></div>`;
};
WIZ.trener = w => {
  const ce = findById(COACH_EXP, w.coachExp), sp = findById(SPW_EXP, w.spwExp);
  return `<div class="grid wiz-2"><div class="stack">
      ${allocHtml('coach', COACH_ATTRS, w.coachAttrs, coachPool(w), ce.cap, 'Atrybuty trenera', `Pula: ${ce.pool} pkt za kompetencje (${esc(ce.name.toLowerCase())}) + ${sp.coachBonus} pkt za doświadczenie żużlowe (${esc(sp.name.toLowerCase())}).`)}
      <div class="panel"><h3>Specjalizacja trenera</h3><p class="small muted">Cechy zawodników, które pod Twoim okiem rosną szybciej – najszybciej u zawodników z naturalnymi predyspozycjami do nich.</p>
        <div class="wiz-opts">${Object.entries(TRAIN_PROFILES).map(([k, p]) => optCard(p, k === w.profile, `ACT.wizSet('profile','${k}')`)).join('')}</div>
        <label class="fld" style="margin-top:12px;max-width:340px">Profil poboczny (słabszy efekt, opcjonalnie)<select onchange="START.wiz.side=this.value;wizPreview()"><option value="">brak</option>${Object.entries(TRAIN_PROFILES).filter(([k]) => k !== w.profile).map(([k, p]) => `<option value="${k}" ${k === w.side ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
    </div><div class="panel" id="wizPreview">${summaryCard(w)}</div></div>`;
};
WIZ.klub = w => {
  // kluby według lig sezonu z oficjalnych terminarzy; kluby spoza terminarzy nie startują
  const lgOf = c => (CAL ? (Object.entries(CAL.leagues).find(([, L]) => L.teams.includes(c.short)) || [null])[0] : c.league);
  const byLg = LEAGUE_ORDER.map(lg => [lg, DATA.clubs.filter(c => lgOf(c) === lg)]);
  const out = DATA.clubs.filter(c => !lgOf(c));
  return `<div class="grid wiz-2"><div class="panel">
      <h3>Wybierz klub</h3>
      ${byLg.map(([lg, cs]) => `<div class="group-title">${leagueLogo(lg)}${esc(LEAGUES[lg].name)} <span class="n">sezon ${CAL ? CAL.season : START_SEASON} · ${cs.length} klubów</span></div>
        <div class="club-pick">${cs.map(c => `<div class="opt ${w.club === c.id ? 'on' : ''}" onclick="ACT.wizSet('club',${c.id})">${crest(c)}<div><div class="n">${esc(c.name)}</div><div class="s">przychody ok. ${fmtMoney(startRevenueEst(c, lgOf(c) || c.league), true)} · ${squad2026(c)} zawodników na ${CAL ? CAL.season : START_SEASON}</div></div></div>`).join('')}</div>`).join('')}
      ${out.length ? `<div class="group-title">Nie startują w sezonie ${CAL.season}</div><div class="club-pick">${out.map(c => `<div class="opt" style="opacity:.45;cursor:not-allowed" title="Klub nie występuje w terminarzach ${CAL.season}">${crest(c)}<div><div class="n">${esc(c.name)}</div><div class="s">brak w terminarzach GKSŻ ${CAL.season}</div></div></div>`).join('')}</div>` : ''}
    </div><div class="stack"><div class="panel" id="wizPreview">${summaryCard(w)}</div>
      ${w.club ? `<div class="panel"><h3>Klub</h3><div class="row">${crest(DATA.clubs.find(c => c.id === w.club))}<b>${esc(DATA.clubs.find(c => c.id === w.club).name)}</b></div>
        <label class="fld" style="margin-top:12px">Długość kontraktu menedżera<select onchange="START.wiz.years=Number(this.value);wizPreview()">${CONTRACT_YEARS.map(y => `<option value="${y}" ${Number(w.years) === y ? 'selected' : ''}>do końca sezonu ${START_SEASON + y} (${y} ${plural(y, 'sezon', 'sezony', 'sezonów')})</option>`).join('')}</select></label>
        <p class="small muted">Pensja według ligi klubu i Twojej renomy. Dotychczasowy menedżer odchodzi z klubu.</p></div>` : '<div class="panel"><p class="muted">Wybierz klub z listy.</p></div>'}</div></div>`;
};
function squad2026(c) {
  const R = DATA.rosters2026;
  if (!R) return DATA.riders.filter(r => r.club === c.name).length;
  return R.ignoredClubs.includes(c.short) ? 0 : [...R.riders, ...R.newRiders].filter(e => e.club === c.short).length;
}

// Przeskalowanie rozdanych punktów po zmianie puli (zachowuje proporcje, mieści się w limicie)
function refitAlloc(vals, pool, cap) {
  const keys = Object.keys(vals), was = pointsSpent(vals) || 1;
  for (const k of keys) vals[k] = clamp(Math.round(vals[k] * pool / was), ATTR_MIN, cap);
  for (let guard = 0, diff = pool - pointsSpent(vals); diff !== 0 && guard < 500; guard++, diff = pool - pointsSpent(vals)) {
    const cand = keys.filter(k => (diff > 0 ? vals[k] < cap : vals[k] > ATTR_MIN)).sort((a, b) => (diff > 0 ? vals[b] - vals[a] : vals[a] - vals[b]));
    if (!cand.length) break;
    vals[cand[guard % cand.length]] += Math.sign(diff);
  }
}
function wizAlloc(w, kind) {
  if (kind === 'mgr') { const e = findById(MGR_EXP, w.mgrExp); return { vals: w.mgr, defs: MGR_ATTRS, pool: e.pool, cap: e.cap }; }
  return { vals: w.coachAttrs, defs: COACH_ATTRS, pool: coachPool(w), cap: findById(COACH_EXP, w.coachExp).cap };
}
function wizError(w, step) {
  const p = w.person;
  if (step === 'dane') {
    if (!p.first.trim() || !p.last.trim()) return 'Podaj imię i nazwisko.';
    if (!validBorn(p.born)) return 'Podaj poprawną datę urodzenia.';
    const age = ageAt(p.born, GAME_START);
    if (age < 18 || age > 80) return 'Menedżer musi mieć od 18 do 80 lat.';
    if (!p.place.trim()) return 'Podaj miejsce urodzenia.';
    for (const c of w.kids) { const e = childError(c, p); if (e) return e; }
  }
  if (step === 'menedzer' || step === 'trener') {
    const a = wizAlloc(w, step === 'menedzer' ? 'mgr' : 'coach'), left = a.pool - pointsSpent(a.vals);
    if (left > 0) return `Rozdziel wszystkie punkty (zostało ${left}).`;
    if (left < 0) return `Przekroczono pulę o ${-left} pkt.`;
  }
  if (step === 'kwalifikacje') {
    const ce = findById(COACH_EXP, w.coachExp), y = Number(w.licYear), min = validBorn(p.born) ? Number(p.born.slice(0, 4)) + 18 : 1960;
    if (ce.lic && !(y >= min && y <= START_SEASON)) return `Podaj rok uzyskania uprawnień (${ce.lic}): ${min}–${START_SEASON}.`;
  }
  if (step === 'klub' && !w.club) return 'Wybierz klub.';
  return '';
}
// Kompletny kreator z domyślnymi wyborami (testy i narzędzia)
function quickWizard(clubId, name = 'Test Menedżer') {
  const w = newWizard(), [first, ...rest] = name.split(' ');
  Object.assign(w.person, { first, last: rest.join(' ') || 'Menedżer', place: 'Leszno' });
  w.club = clubId; w.step = 'klub';
  return w;
}
ACT.newCareer = () => { START.wiz = newWizard(); renderStart().then(() => { const el = $('#wizFirst'); if (el) el.focus(); }); };
ACT.wizCancel = () => { START.wiz = null; renderStart(); };
ACT.wizSet = (k, v) => {
  const w = START.wiz;
  w[k] = v; w.err = '';
  if (k === 'mgrExp') { const a = wizAlloc(w, 'mgr'); refitAlloc(a.vals, a.pool, a.cap); }
  if (k === 'spwExp' || k === 'coachExp') { const a = wizAlloc(w, 'coach'); refitAlloc(a.vals, a.pool, a.cap); }
  if (k === 'profile' && w.side === v) w.side = '';
  renderStart();
};
ACT.wizAttr = (kind, k, d) => {
  const w = START.wiz, a = wizAlloc(w, kind), left = a.pool - pointsSpent(a.vals);
  d = d > 0 ? Math.min(d, left, a.cap - a.vals[k]) : Math.max(d, ATTR_MIN - a.vals[k]);
  if (!d) return;
  a.vals[k] += d; w.err = '';
  renderStart();
};
ACT.wizEven = kind => { const w = START.wiz, a = wizAlloc(w, kind); Object.assign(a.vals, evenSpread(a.defs, a.pool, a.cap)); w.err = ''; renderStart(); };
ACT.wizReset = kind => { const a = wizAlloc(START.wiz, kind); for (const k of Object.keys(a.vals)) a.vals[k] = ATTR_MIN; renderStart(); };
ACT.wizNext = () => {
  const w = START.wiz, steps = wizSteps(w);
  w.err = wizError(w, w.step);
  if (!w.err) w.step = steps[steps.indexOf(w.step) + 1] || w.step;
  renderStart();
};
ACT.wizBack = () => { const w = START.wiz, steps = wizSteps(w); w.err = ''; w.step = steps[Math.max(0, steps.indexOf(w.step) - 1)]; renderStart(); };
ACT.wizGo = step => { const w = START.wiz, steps = wizSteps(w); if (steps.indexOf(step) < steps.indexOf(w.step)) { w.err = ''; w.step = step; renderStart(); } };

ACT.startGame = async () => {
  const w = START.wiz;
  if (!w) return;
  for (const s of wizSteps(w)) { const e = wizError(w, s); if (e) { w.err = e; w.step = s; return renderStart(); } }
  $('#app').innerHTML = '<div class="loading">Tworzenie świata gry…</div>';
  await new Promise(r => setTimeout(r, 30));
  newGame({ clubId: w.club, manager: `${w.person.first.trim()} ${w.person.last.trim()}` });
  applyManagerProfile(w);
  if (DB.on) { try { await dbCreate(); } catch (e) { toast('Nie udało się utworzyć bazy gry: ' + esc(e.message), 'bad'); } }
  START.saves = null; START.wiz = null;
  buildLayout();
  location.hash = '#/skrzynka';
  render();
};
ACT.loadGame = async id => {
  $('#app').innerHTML = '<div class="loading">Wczytywanie bazy gry…</div>';
  try { await dbLoad(id); } catch (e) { toast('Błąd wczytywania: ' + esc(e.message), 'bad'); START.saves = null; return renderStart(); }
  buildLayout();
  if (!location.hash || location.hash === '#') location.hash = '#/skrzynka';
  render();
};
ACT.deleteGame = async id => { await dbDelete(id); START.saves = null; renderStart(); };

// ---------- Profil menedżera (w grze) ----------
NAV_PARENT.menedzer = 'sztab';
PAGES.menedzer = () => {
  if (G.manager.coachId && G.staff[G.manager.coachId]) { setTimeout(() => go(`#/osoba/${G.manager.coachId}`), 0); return { title: '', body: '' }; } // profil jak u innych trenerów
  const m = G.manager, coach = m.coachId && G.staff[m.coachId];
  const exp = m.exp && findById(MGR_EXP, m.exp), sp = m.spwExp && findById(SPW_EXP, m.spwExp), ce = m.coachExp && findById(COACH_EXP, m.coachExp);
  const rows = (defs, vals) => defs.map(([k, n, d]) => `<div class="attr" title="${esc(d)}"><span>${esc(n)}</span><span class="v ${attrClass(vals[k])}">${vals[k]}</span></div>`).join('');
  return { title: esc(m.name), sub: `${mgrRole()} · ${clubLink(G.clubId)}`,
    body: `<div class="grid g-side"><div class="stack">
        <div class="panel"><h3>Atrybuty menedżera</h3>${m.attrs ? `<div class="grid g2">${rows(MGR_ATTRS, m.attrs)}</div>` : '<p class="muted">Kariera rozpoczęta przed wprowadzeniem kreatora postaci – atrybuty menedżera nie zostały określone (gra przyjmuje wartości przeciętne).</p>'}</div>
        ${coach ? `<div class="panel"><h3>Atrybuty trenera</h3><div class="grid g2">${rows(COACH_ATTRS, coach.attrs)}</div>
          <h3 style="margin-top:14px">Specjalizacja</h3><p><b>${esc(TRAIN_PROFILES[coach.profile.main].name)}</b> <span class="muted small">– ${esc(TRAIN_PROFILES[coach.profile.main].desc)}</span></p>
          ${coach.profile.side ? `<p class="small">Profil poboczny: <b>${esc(TRAIN_PROFILES[coach.profile.side].name)}</b></p>` : ''}</div>` : ''}
      </div>
      <div class="panel"><div class="row" style="margin-bottom:12px">${staffPic(m, silhouette(m.name, myClub().colors[0]), '', 'width:72px;height:72px;border-radius:8px;overflow:hidden;flex:none')}<div><b style="font:700 20px var(--cond)">${esc(m.name)}</b><div class="small muted">${m.country ? `${flagCode(m.country)} ${esc(COUNTRY[m.country] || '')}` : ''}</div></div></div>
        <div class="kv">${m.born ? `<div>Urodzony</div><div>${fmtDate(m.born)}${m.place ? `, ${esc(m.place)}` : ''}</div><div>Wiek</div><div>${ageAt(m.born, G.date)} lat</div>` : ''}
          <div>Rola</div><div>${esc(mgrRole())}</div><div>W klubie od</div><div>${fmtDate(m.since)}</div>
          ${exp ? `<div>Doświadczenie</div><div>${esc(exp.name)}</div>` : ''}${sp ? `<div>Przeszłość żużlowa</div><div>${esc(sp.name)}</div>` : ''}${ce && coach ? `<div>Doświadczenie trenerskie</div><div>${esc(ce.name)}</div>` : ''}
          <div>Zaufanie zarządu</div><div>${Math.round(G.board.confidence)}%</div>
          ${(m.children || []).length ? `<div>Dzieci</div><div>${m.children.map(c => `<div>${c.riderId && G.riders[c.riderId] ? `<a href="#/zawodnik/${c.riderId}">${esc(c.name)}</a>` : c.kidId && G.academy[c.kidId] ? `<a href="#/adept/${c.kidId}">${esc(c.name)}</a>` : esc(c.name)} <span class="small muted">(${ageAt(c.born, G.date)} lat${c.riderId ? ', zawodnik' : c.kidId ? ', szkółka' : c.joinOn ? `, szkółka od ${fmtDateShort(c.joinOn)}` : ''})</span></div>`).join('')}</div>` : ''}</div></div>
    </div>` };
};

// ---------- Start aplikacji ----------
(async function boot() {
  await dbCheck();
  renderStart();
})();
