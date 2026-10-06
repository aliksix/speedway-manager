'use strict';
UI.mini={q:'',school:'',category:'',outside:false,month:'',series:'',schoolQ:'',independent:false};
const MINI_LABELS={mini_85_140:'Miniżużel 85–140cc','500R_250cc':'250cc / 500R', '500cc_exam_2026':'Egzamin 500cc w 2026',young_500cc_or_former_trainee:'500cc / wychowanek',trainee_or_historical:'Adept / wpis historyczny'};
const miniBorn=p=>p.birthDate?fmtDateShort(p.birthDate):p.birthYear?`rocznik ${p.birthYear}`:'brak daty';
const schoolLink=id=>G.miniSchools?.[id]?`<a href="#/minizuzel/szkolki/${encodeURIComponent(id)}">${esc(G.miniSchools[id].short)}</a>`:'nieustalona';
const miniHref=p=>{const e=miniPersonEntity(p);return e&&G.riders[e.id]?`#/zawodnik/${e.id}`:e&&G.academy[e.id]?`#/adept/${e.id}`:'#/minizuzel/zawodnicy';};
const miniLink=p=>`<a href="${miniHref(p)}">${esc(p.name)}</a>`;
function miniStateLabel(p){const entity=miniPersonEntity(p);return entity&&G.riders[entity.id]?'Zawodnik 500cc':p.historicalOnly?'Wpis historyczny':entity?.catalogOnly?'Adept — klasa niepotwierdzona':'Szkółka / małe pojemności';}
function miniPeopleTable(list){return `<div class="panel flush" style="overflow:auto"><table class="t"><thead><tr><th>Zawodnik / adept</th><th>Urodzenie</th><th>Szkółka / klub</th><th>Kategoria</th><th>Status</th></tr></thead><tbody>${list.map(p=>`<tr><td>${miniLink(p)}</td><td class="nowrap">${miniBorn(p)}</td><td>${schoolLink(p.schoolId)}</td><td>${esc(MINI_LABELS[p.group]||p.group)}</td><td>${esc(miniStateLabel(p))}${!p.pzmRecords.length?' · poza rejestrem PZM':''}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Brak osób spełniających filtry.</td></tr>'}</tbody></table></div>`;}
// Kalendarz miniżużla w formie miesiąca (jak kalendarz seniorski); wyróżnione zawody z udziałem adeptów lub drużyny klubu
const MINI_CAL_SHORT={MINI_IMPQ:'IMP',MINI_MPPKQ:'MPPK'};
function miniEvLabel(e){
 if(e.kind==='mini-info')return e.name;
 const base=(MINI_CAL_SHORT[e.comp]||(COMPS[e.comp]||{}).short||e.comp).replace(/_([AB])$/,' $1');
 if(/półfinał [AB]/.test(e.stage||''))return `${base} – ${e.stage}`;
 if(/^MINI_(DMP|IPP|MPPK)$/.test(e.comp))return `${base} – finał`;
 if(e.comp==='MINI_IMP')return `IMP – finał ${e.round||''}`.trim();
 return `${base}${e.round?` · r. ${e.round}`:''}`;
}
function miniEvMine(e){
 if((e.units||[]).some(u=>u.clubId===G.clubId))return true;
 return (e.startList||[]).some(x=>{const k=G.academy[x.id],r=G.riders[x.id];return k?miniTeamOf(k,e.season)===G.clubId:r&&r.clubId===G.clubId;});
}
function miniCalendarGrid(events){
 const ym=UI.mcal,days=monthGrid(ym),by={};
 for(const e of events){
  if(!days.includes(e.date))continue;
  const mine=e.kind==='comp'&&miniEvMine(e);
  if(UI.mini.mineOnly&&!mine)continue;
  const ind=(COMPS[e.comp]||{}).format==='ind',fin=/finał/.test(e.stage||'')&&!/półfinał/.test(e.stage||'');
  const sub=e.kind==='mini-info'?esc(e.venue||''):e.played?(e.cancelled?'odwołane':winnerLabel(e).replace(/<a [^>]*>|<\/a>/g,'')):esc(e.venue||'');
  (by[e.date]=by[e.date]||[]).push(`<div class="ev ${e.kind==='mini-info'?'info':ind?'mini-ind':'mini'} ${mine?'mine':''} ${fin?'major':''}" onclick="go('#/gp/${e.id}')" title="${esc(e.name)}${e.venue?' – '+esc(e.venue):''}">${esc(miniEvLabel(e))}<div class="small muted">${sub}</div></div>`);
 }
 return `<div class="cal">${DAYS_SHORT.map(d=>`<div class="dh">${d}</div>`).join('')}${days.map(d=>`<div class="day ${d.slice(0,7)!==ym?'out':''} ${d===G.date?'today':''} ${d<G.date?'past':''}"><div class="n"><span>${Number(d.slice(8))}</span>${d===G.date?'<span>dziś</span>':''}</div>${(by[d]||[]).join('')}</div>`).join('')}</div>`;
}
function miniCalendarTable(events){return `<div class="panel flush" style="overflow:auto"><table class="t"><thead><tr><th>Data</th><th>Zawody</th><th>Tor / gospodarz</th><th>Wynik</th></tr></thead><tbody>${events.map(e=>`<tr><td class="nowrap">${fmtDateShort(e.date)}${e.endDate?' – '+fmtDateShort(e.endDate):''}${e.alternativeDate?' lub '+fmtDateShort(e.alternativeDate):''}</td><td><a href="#/gp/${e.id}">${esc(e.name)}</a>${e.projected?' <span class="pill">termin modelowy</span>':''}</td><td>${esc(e.venue)}</td><td>${e.kind==='mini-info'?(e.archiveOnly?'Wpis archiwalny':'Informacja'):winnerLabel(e)||'Zaplanowane'}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Brak wydarzeń w wybranym okresie.</td></tr>'}</tbody></table></div>`;}
PAGES.minizuzel=parts=>{
 const sub=parts[0]||'kalendarz',all=Object.values(G.miniPeople||{}),schools=Object.values(G.miniSchools||{}).sort((a,b)=>a.short.localeCompare(b.short,'pl'));
 const tab=sub==='zawodnik'?'zawodnicy':sub;
 const head={title:'Miniżużel',sub:'Kalendarz, szkółki i adepci',tabs:tabs('minizuzel',[['kalendarz','Kalendarz'],['szkolki','Szkółki'],['zawodnicy','Adepci']],tab)};
 if(sub==='zawodnik'){ // dawny profil z katalogu: przekierowanie do profilu zawodnika / adepta
  const p=G.miniPeople?.[parts[1]],e=p&&miniPersonEntity(p);
  if(e&&G.riders[e.id])return PAGES.zawodnik([e.id]);
  if(e&&G.academy[e.id])return PAGES.adept([e.id,'szkolka']);
  return {...head,body:'<div class="panel empty">Nie znaleziono adepta.</div>'};
 }
 if(sub==='szkolki'){
  if(parts[1]){
   const school=G.miniSchools?.[parts[1]];if(!school)return {...head,body:'<div class="panel empty">Nie znaleziono szkółki.</div>'};
   const list=all.filter(p=>p.schoolId===school.id);
   return {...head,title:esc(school.short),body:`<div class="panel"><h2>${esc(school.name)}</h2><p>${school.clubId?school.trainsFor?`Realizuje szkolenie dla klubu: ${clubLink(school.clubId)}`:`Szkółka klubu ligowego: ${clubLink(school.clubId)}`:'Szkółka niezależna – szkoli poza klubami ligowymi. Zawodników po licencji 500 cm³ sprzedaje lub wypożycza klubom, a miniżużlowców wypożycza do rozgrywek drużynowych.'}</p><p>${list.length} osób · <a href="${esc(school.sourceUrl)}" target="_blank" rel="noopener">Źródło</a></p></div>${school.clubId?'':indepSchoolHtml(school)}${adeptTable(Object.values(G.academy).filter(k=>k.schoolId===school.id).sort(by(k=>k.ca??0,-1)))}<p><a href="#/minizuzel/szkolki">Wszystkie szkółki</a></p>`};
  }
  const list=schools.filter(s=>(!UI.mini.independent||!s.clubId)&&normName(s.name).includes(normName(UI.mini.schoolQ)));
  return {...head,body:`<div class="filters"><label class="fld">Szukaj szkółki<input value="${esc(UI.mini.schoolQ)}" onchange="UI.mini.schoolQ=this.value;render()"></label><label><input type="checkbox" ${UI.mini.independent?'checked':''} onchange="UI.mini.independent=this.checked;render()"> Tylko poza klubami ligowymi</label></div><div class="comp-grid">${list.map(s=>`<div class="panel"><h3>${schoolLink(s.id)}</h3><p>${esc(s.name)}</p><p>${s.clubId?s.trainsFor?`Szkoli dla: ${esc(G.clubs[s.clubId]?.name||'')}`:'Przy klubie ligowym':'Samodzielna szkółka / stowarzyszenie'} · ${all.filter(p=>p.schoolId===s.id).length} osób</p></div>`).join('')||'<div class="panel empty">Brak szkółek spełniających filtry.</div>'}</div>`};
 }
 if(sub==='zawodnicy')return {...head,body:adeptsPage(schools)};
 const season=Number(UI.mini.season)||Math.max(2026,G.season);
 const evs=Object.values(G.events).filter(e=>e.mini&&e.season===season).sort(by(e=>e.date));
 const series=[...new Set(evs.filter(e=>e.kind==='comp').map(e=>e.comp))];
 const seasons=[...new Set(Object.values(G.events).filter(e=>e.mini).map(e=>e.season))].sort();
 if(!UI.mcal||Number(UI.mcal.slice(0,4))!==season)UI.mcal=season===G.season?G.date.slice(0,7):`${season}-05`;
 const list=evs.filter(e=>!UI.mini.series||e.comp===UI.mini.series);
 return {...head,body:`<div class="filters"><label class="fld">Sezon<select onchange="UI.mini.season=+this.value;UI.mcal=null;render()">${seasons.map(s=>`<option ${s===season?'selected':''}>${s}</option>`).join('')}</select></label><label class="fld">Rozgrywki<select onchange="UI.mini.series=this.value;render()"><option value="">Wszystkie</option>${series.map(k=>`<option value="${k}" ${UI.mini.series===k?'selected':''}>${esc(COMPS[k].name)}</option>`).join('')}</select></label><label class="row small"><input type="checkbox" ${UI.mini.mineOnly?'checked':''} onchange="UI.mini.mineOnly=this.checked;render()"> tylko z udziałem naszych</label></div>
  <div class="panel">${calHead('mcal')}${miniCalendarGrid(list)}
  <div class="row small muted wrap" style="margin-top:8px;gap:14px"><span><span class="ev-dot mini"></span>zawody drużynowe i parowe</span><span><span class="ev-dot mini-ind"></span>zawody indywidualne</span><span><span class="ev-dot mine"></span>z udziałem naszych adeptów</span><span><span class="ev-dot"></span>wpis informacyjny</span></div></div>
  <p class="small muted"><a href="${MINI_CALENDAR.sourceUrl}" target="_blank" rel="noopener">Kalendarz PZM ${esc(MINI_CALENDAR.version)}</a>${season!==2026?' · Terminy kolejnego sezonu są modelowe.':''} · Obsady według regulaminów PZM i Ekstraligi 2026: grupy DMP i IPP, DPE dla klubów Ekstraligi, finały z awansów.</p>`};
};
// Information-only calendar entries have no invented race results or start lists.
const miniOriginalGp=PAGES.gp;
PAGES.gp=parts=>{const e=G.events[parts[0]];if(e?.kind!=='mini-info')return miniOriginalGp(parts);if(e.foreign)return {title:`${flag(e.cc)} ${esc(e.name)}`,sub:`${fmtDay(e.date)} · ${esc(e.venue||'')}`,body:`<div class="panel"><div class="kv"><div>Kraj</div><div>${flag(e.cc)} ${esc(COUNTRY[e.cc]||e.cc)}</div><div>Termin</div><div>${fmtDay(e.date)}</div><div>Miejsce</div><div>${esc(e.venue||'—')}</div>${e.cls?`<div>Klasa</div><div>${esc(e.cls)} cm³</div>`:''}<div>Źródło</div><div class="small">${esc(e.src||'')}</div></div><p class="small muted" style="margin-top:10px">Zawody w kalendarzu bez symulacji: gra nie ma zawodników tej klasy albo składów drużyn tego kraju.</p></div>`};return {title:esc(e.name),body:`<div class="panel"><p>${fmtDateShort(e.date)}${e.endDate?' – '+fmtDateShort(e.endDate):''}${e.alternativeDate?' lub '+fmtDateShort(e.alternativeDate):''} · ${esc(e.venue)}</p><p>${e.archiveOnly?'Wydarzenie sprzed importu do tego zapisu. Wyników nie odtwarzano.':'Wpis informacyjny kalendarza.'}</p><a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">Źródło PZM</a></div><a href="#/minizuzel">Kalendarz miniżużla</a>`};};

// Szkółka niezależna: zawodnicy z kartą w szkółce, wypożyczenia miniżużlowców, rozliczenia (js/schools.js)
function indepSchoolHtml(s){
 const riders=Object.values(G.riders).filter(r=>r.schoolRights===s.id).sort(by(r=>r.ca??0,-1));
 const mini=Object.values(G.academy).filter(k=>k.miniLoan&&k.miniLoan.schoolId===s.id&&k.miniLoan.season===G.season);
 const led=(s.ledger||[]).slice(-12).reverse();
 return `<div class="grid g2" style="margin-top:16px"><div class="panel flush"><div class="ph"><h3>Zawodnicy z kartą w szkółce (${riders.length})</h3></div><table class="t"><thead><tr><th>Zawodnik</th><th>Wiek</th><th>Status</th><th class="num">Cena karty</th></tr></thead><tbody>${riders.map(r=>`<tr><td><a href="#/zawodnik/${r.id}">${esc(r.name)}</a></td><td>${riderAge(r)}</td><td>${schoolOnLoan(r)?`wypożyczony: ${clubLink(r.schoolLoan.clubId)}`:r.agreed||r.nextContract?'uzgodnione przejście':'szuka klubu'}</td><td class="num">${fmtMoney(schoolFee(r,G.clubId),true)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Brak zawodników z licencją 500 cm³</td></tr>'}</tbody></table>
  <div class="ph"><h3>Miniżużel – wypożyczeni do drużyn (sezon ${G.season})</h3></div><table class="t"><tbody>${mini.map(k=>`<tr><td><a href="#/adept/${k.id}">${esc(k.name)}</a></td><td>${clubLink(k.miniLoan.clubId)}</td><td class="num">${fmtMoney(k.miniLoan.fee,true)}</td></tr>`).join('')||'<tr><td class="empty">Brak wypożyczeń w tym sezonie</td></tr>'}</tbody></table></div>
  <div class="panel"><h3>Rozliczenia szkółki</h3><div class="kv"><div>Przychody (w grze)</div><div><b>${fmtMoney(s.cash||0)}</b></div></div>${led.map(e=>`<div class="row small"><span class="muted" style="width:80px">${fmtDateShort(e.d)}</span><span class="pos" style="width:90px">+${fmtMoney(e.a,true)}</span><span>${esc(e.t)}</span></div>`).join('')||'<p class="muted">Brak transakcji.</p>'}</div></div>`;
}

// ---------- Adepci: wyszukiwarka jak w transferach ----------
const AF_DEFAULT={q:'',school:'',cat:'',ageMin:4,ageMax:21,team:'',outside:false};
const AF_COLS=[['name','Adept'],['country','Kraj'],['age','Wiek'],['cat','Klasa'],['school','Szkółka'],['club','Klub / drużyna'],['skill','Umiej.'],['potential','Potencjał']];
const kidTeam=k=>typeof miniTeamOf==='function'?miniTeamOf(k,G.season):k.clubId||null;
function adeptRows(){
 const f=UI.af||(UI.af={...AF_DEFAULT}),q=normName(f.q);
 const rows=Object.values(G.academy).filter(k=>{
  if(q&&!normName(k.name).includes(q))return false;
  if(f.school&&k.schoolId!==f.school)return false;
  if(f.cat&&k.cat!==f.cat)return false;
  const a=ageAt(k.born,G.date);if(a<f.ageMin||a>f.ageMax)return false;
  const t=kidTeam(k);
  if(f.team==='mine'&&t!==G.clubId)return false;
  if(f.team==='club'&&!k.clubId)return false;
  if(f.team==='indep'&&(k.clubId||!k.schoolId))return false;
  if(f.team==='loan'&&!(k.miniLoan&&k.miniLoan.season===G.season))return false;
  if(f.outside){const m=kidMini(k);if(m&&m.pzmRecords&&m.pzmRecords.length)return false;}
  return true;});
 const s=UI.sort.af||{k:'skill',d:-1};
 const key={name:k=>k.name,country:k=>k.country||'',age:k=>ageAt(k.born,G.date),cat:k=>ACADEMY_CATS.findIndex(c=>c.id===k.cat),school:k=>(G.miniSchools[k.schoolId]||{}).short||'ż',club:k=>(G.clubs[kidTeam(k)]||{}).name||'ż',skill:k=>perceive(k).caMid,potential:k=>perceive(k).paMid}[s.k];
 return rows.sort(by(key,s.d));
}
ACT.afSort=k=>{const s=UI.sort.af||{k:'skill',d:-1};UI.sort.af={k,d:s.k===k?-s.d:['name','country','school','club','cat'].includes(k)?1:-1};UI.afPage=0;render();};
ACT.afSet=(k,v)=>{UI.af[k]=v;UI.afPage=0;render();};
function adeptTable(rows,sortable){
 const s=UI.sort.af||{k:'skill',d:-1};
 return `<div class="panel flush"><table class="t"><thead><tr>${AF_COLS.map(([k,l])=>sortable?`<th class="sort ${s.k===k?'sorted':''} ${k==='age'?'num':''}" onclick="ACT.afSort('${k}')">${l}${s.k===k?(s.d>0?' ▲':' ▼'):''}</th>`:`<th>${l}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(k=>{const cat=ACADEMY_CATS.find(c=>c.id===k.cat),t=kidTeam(k),sch=G.miniSchools[k.schoolId];
   return `<tr class="click ${t===G.clubId?'me':''}" onclick="go('#/adept/${k.id}')"><td><b>${esc(k.name)}</b>${typeof adeptBadge === 'function' ? adeptBadge(k) : ''}</td><td>${flagCode(k.country||'POL')}</td><td class="num">${ageAt(k.born,G.date)}</td>
    <td>${cat?`<span class="pill jun">${esc(cat.cc)}</span>`:'<span class="muted">—</span>'}</td><td>${sch?`<a href="#/minizuzel/szkolki/${encodeURIComponent(sch.id)}" onclick="event.stopPropagation()">${esc(sch.short)}</a>`:'<span class="muted">—</span>'}</td>
    <td>${t&&G.clubs[t]?`${clubLink(t)}${t!==k.clubId?' <span class="small muted">wyp.</span>':''}`:`<span class="muted">${sch?'szkółka niezależna':'bez klubu'}</span>`}</td><td>${caStars(k)}</td><td>${paStars(k)}</td></tr>`;}).join('')||'<tr><td colspan="8" class="empty">Brak adeptów spełniających kryteria</td></tr>'}</tbody></table></div>`;
}
function adeptsPage(schools){
 const f=UI.af||(UI.af={...AF_DEFAULT}),rows=adeptRows();
 UI.kidCtx={ids:rows.map(k=>k.id),label:'Adepci – wyszukiwarka'};
 const per=50,pages=Math.max(1,Math.ceil(rows.length/per));UI.afPage=clamp(UI.afPage||0,0,pages-1);
 return `<div class="filters panel">
  <label class="fld">Nazwisko<input value="${esc(f.q)}" onchange="ACT.afSet('q',this.value)" placeholder="szukaj…"></label>
  <label class="fld">Szkółka<select onchange="ACT.afSet('school',this.value)"><option value="">wszystkie</option>${schools.map(s=>`<option value="${s.id}" ${s.id===f.school?'selected':''}>${esc(s.short)}</option>`).join('')}</select></label>
  <label class="fld">Klasa<select onchange="ACT.afSet('cat',this.value)"><option value="">wszystkie</option>${ACADEMY_CATS.map(c=>`<option value="${c.id}" ${c.id===f.cat?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
  <label class="fld">Wiek od<input type="number" min="4" max="25" value="${f.ageMin}" style="width:70px" onchange="ACT.afSet('ageMin',+this.value)"></label>
  <label class="fld">do<input type="number" min="4" max="25" value="${f.ageMax}" style="width:70px" onchange="ACT.afSet('ageMax',+this.value)"></label>
  <label class="fld">Przynależność<select onchange="ACT.afSet('team',this.value)">${[['','wszyscy'],['mine','nasza drużyna'],['club','szkółki klubów'],['indep','szkółki niezależne'],['loan','wypożyczeni do drużyn']].map(([k,l])=>`<option value="${k}" ${f.team===k?'selected':''}>${l}</option>`).join('')}</select></label>
  <label class="row small muted"><input type="checkbox" ${f.outside?'checked':''} onchange="ACT.afSet('outside',this.checked)"> tylko spoza rejestru PZM</label>
  <button class="btn ghost" onclick="UI.af=null;render()">Wyczyść</button></div>
  ${adeptTable(rows.slice(UI.afPage*per,UI.afPage*per+per),true)}
  <div class="pager"><span class="small muted">${rows.length} adeptów</span><button class="btn sm" ${UI.afPage?'':'disabled'} onclick="UI.afPage--;render()">‹</button><span class="small">${UI.afPage+1} / ${pages}</span><button class="btn sm" ${UI.afPage<pages-1?'':'disabled'} onclick="UI.afPage++;render()">›</button></div>`;
}
