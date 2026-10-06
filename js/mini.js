'use strict';
// School entities are separate from league clubs; they are saved in the game state.
// Szkółka klubu (leagueCode) albo stowarzyszenie realizujące szkolenie dla klubu (trainsFor) – adepci trafiają do akademii tego klubu
function syncMiniSchools(){
 if(typeof MINI_DATA==='undefined')return false;
 G.miniSchools=G.miniSchools||{};let ch=false;
 for(const s of MINI_DATA.schools){
  const club=clubByCode(s.leagueCode||s.trainsFor),old=G.miniSchools[s.id];
  if(!old||old.clubId!==(club?.id||null)||old.trainsFor!==s.trainsFor)ch=true;
  // szkółka odpięta od klubu (np. Akademia JK – szkółka niezależna): jej adepci wracają do szkółki
  if(old?.clubId&&!club)for(const k of Object.values(G.academy||{}))if(k.schoolId===s.id&&k.clubId===old.clubId){k.clubId=null;ch=true;}
  G.miniSchools[s.id]={...(old||{}),...s,clubId:club?.id||null}; // zachowane: kasa i rozliczenia szkółki
 }
 for(const k of Object.values(G.academy||{})){const sc=k.schoolId&&G.miniSchools[k.schoolId];if(sc?.clubId&&!k.clubId){k.clubId=sc.clubId;ch=true;}}
 if(typeof migrateSchoolRights==='function')migrateSchoolRights();
 // adepci z naboru gry i dzieci menedżera: szkółka, w której klub faktycznie szkoli (clubSchoolId – js/intake.js)
 if(typeof clubSchoolId==='function')for(const k of Object.values(G.academy||{})){
  if(!k.clubId||!(k.gen||k.mgrChild||!k.schoolId))continue;
  const want=clubSchoolId(k.clubId),cur=k.schoolId&&G.miniSchools[k.schoolId];
  if(want&&k.schoolId!==want&&(!cur||cur.clubId===k.clubId)){k.schoolId=want;ch=true;}
 }
 if(typeof clubSchoolId==='function')for(const r of Object.values(G.riders||{})){ // wychowankowie z naboru gry, którzy już zdali egzamin
  const home=r.homeClubId||r.trainedBy;
  if(!r.academyGraduate||r.academyCatalogId||!home)continue;
  const want=clubSchoolId(home),cur=r.schoolId&&G.miniSchools[r.schoolId];
  if(want&&r.schoolId!==want&&(!cur||cur.clubId===home)){r.schoolId=want;ch=true;}
 }
 return ch;
}
function applyMiniData() {
 if(typeof MINI_DATA==='undefined')return false;
 const synced=syncMiniSchools();
 if(G.miniVersion===MINI_DATA.version)return synced;
 G.miniPeople=G.miniPeople||{};
 for(const p of MINI_DATA.records){
  const school=G.miniSchools[p.schoolId],clubId=school?.clubId||null;
  const names=[p.name,...p.aliases].map(normName);
  // dopasowanie odporne na pisownię (np. Dmitrijs / Dmitrij Reuka): inicjał, nazwisko, rocznik
  let rider=Object.values(G.riders).find(r=>names.includes(normName(r.name)))||(typeof matchRider==='function'?matchRider(p.name,p.birthDate||(p.birthYear?`${p.birthYear}-07-01`:null)):null);
  let kid=Object.values(G.academy).find(k=>names.includes(normName(k.name)));
  // Egzamin 500cc w sezonie 2026 (po starcie gry): do dnia egzaminu adept szkółki klubu, nie zawodnik z kadry –
  // w nowej grze zawodnik z kadry 2026 wraca do szkółki i zdaje egzamin w terminie z rejestru PZM (js/competitions.js: realExam)
  const exam500=(p.licenseEvents||[]).find(e=>e.class==='500cc'&&e.date),examDay=exam500?(exam500.date.length===7?exam500.date+'-01':exam500.date):null;
  const preLicence=!!examDay&&G.date<examDay;
  if(preLicence&&rider&&G.date<=addDays(GAME_START,14)&&!Object.keys(rider.stats||{}).length){
   if(!kid){kid={id:`A${G.seq.academy++}`,joined:G.date,progress:[],parentsSupport:3,meets:0};G.academy[kid.id]=kid;}
   const ca=rider.ca??(rider.skill!=null?rider.skill*5:null);
   if(ca!=null){kid.ca=ca;kid.pa=Math.max(rider.pa??rider.potential??60,ca);kid.paRange=rider.paRange||[Math.max(ca,kid.pa-15),Math.min(100,kid.pa+15)];}
   kid.country=rider.country||kid.country||'POL';
   const clubId0=rider.clubId||clubId;
   delete G.riders[rider.id];rider=null;
   kid.clubId=clubId0;
  }
  // A registry 500cc rider is not downgraded into a school pupil.
  if(!rider&&!preLicence&&p.registryClasses.includes('500cc')){
   rider=riderFromRoster({name:p.name,born:p.birthDate||null,country:p.pzmRecords[0]?.federacja||'POL'},G.date);
   if(p.birthDate||p.birthYear){rider.born=p.birthDate||birthFromYear(p.birthYear,p.name);rider.bornEst=!p.birthDate;}
   if(clubId)assignRider(rider,G.clubs[clubId],MINI_DATA.season,'PZM 25.09.2026');
  }
  if(rider){
   rider.academyCatalogId=p.id;rider.schoolId=p.schoolId;
   if(p.birthDate){rider.born=p.birthDate;rider.bornEst=false;}
   if(kid){delete G.academy[kid.id];kid=null;}
  }else{
   const cat=p.registryClasses.includes('500R')||p.passedSmallClassIn2026||p.passed500In2026?'c500':p.miniEvidence?'c85':'unknown';
   if(!kid){kid=genKid(clubId,G.date,ACADEMY_CATS.findIndex(c=>c.id===(cat==='c500'?'c500':'c85')));G.academy[kid.id]=kid;}
   Object.assign(kid,{name:p.name,real:true,academyCatalogId:p.id,schoolId:p.schoolId,clubId:kid.clubId&&preLicence?kid.clubId:clubId,cat:preLicence?'c500':cat,
    born:p.birthDate||(p.birthYear?String(p.birthYear):null),birthYear:p.birthYear,birthDatePrecision:p.birthDatePrecision,
    catalogOnly:p.historicalOnly||cat==='unknown',source:p.schoolAssignment?.sourceUrl||'',licenseEvents:p.licenseEvents,examRegistered:false});
  }
  G.miniPeople[p.id]={...p,riderId:rider?.id||null,kidId:kid?.id||null};
 }
 G.miniVersion=MINI_DATA.version;
 makeMiniEvents(Math.max(G.season,MINI_DATA.season));
 return true;
}
// Adepci dopisani z protokołów miniżużla (kalibracja) – widoczni w katalogu miniżużla obok rejestru PZM
function addCalibMiniPeople(){
 G.miniPeople=G.miniPeople||{};
 const linked=new Set(Object.values(G.miniPeople).map(p=>p.kidId).filter(Boolean));
 for(const k of Object.values(G.academy)){
  if(!k.calibOnly||linked.has(k.id))continue;
  const id='CAL-'+k.id;
  G.miniPeople[id]={id,name:k.name,aliases:[],calib:true,birthDate:String(k.born||'').length===10?k.born:null,birthYear:k.birthYear||null,birthDatePrecision:String(k.born||'').length===10?'day':'year',
   schoolId:k.schoolId||null,group:['c250','c500'].includes(k.cat)?'500R_250cc':'mini_85_140',pzmRecords:[],registryClasses:[],schoolAssignment:null,licenseEvents:[],birthDateEvidence:[],
   observations:[{date:null,class:k.cat,sourceId:'protokoły zawodów (kalibracja)',sourceUrl:'#/minizuzel/zawodnicy',club:k.schoolId&&G.miniSchools[k.schoolId]?G.miniSchools[k.schoolId].short:''}],
   warnings:[`Dopisany z protokołów zawodów miniżużla${k.source?` (${k.source})`:''}; brak wpisu w rejestrze PZM.`],historicalOnly:false,riderId:null,kidId:k.id};
 }
}
function miniPersonEntity(p){return (p.riderId&&G.riders[p.riderId])||(p.kidId&&G.academy[p.kidId])||Object.values(G.riders).find(r=>r.academyCatalogId===p.id)||null;}
function miniSchoolOf(p){const entity=miniPersonEntity(p);return G.miniSchools[entity?.schoolId||p.schoolId];}
// zawody 85–140 cm³: adepci z ważnym certyfikatem (js/kid-licence.js)
// (także adept przeniesiony na trening do 250 cm³, który ma jeszcze ważny certyfikat i nie zdał licencji 250 cm³/500R)
function miniField(){return Object.values(G.academy).filter(k=>!k.catalogOnly&&!k.retired&&(k.cat==='c85'||(k.cat==='c250'&&typeof kidLicNow==='function'&&kidLicNow(k)==='mini'))&&(typeof kidMiniOk!=='function'||kidMiniOk(k)));}
// Drużyny miniżużlowe: kluby (adepci klubu i stowarzyszeń szkolących dla klubu + wypożyczeni ze szkółek niezależnych),
// a szkółki niezależne wystawiają własny zespół z adeptów, których nie wypożyczyły (js/schools.js)
function miniUnits(size,season=G.season,filter=null){
 const field=miniField().filter(k=>!filter||filter(k)),pick=list=>list.sort(by(k=>k.ca??k.ability,-1)).slice(0,size);
 const team=k=>typeof miniTeamOf==='function'?miniTeamOf(k,season):k.clubId||null;
 const clubs=Object.values(G.clubs).map(c=>{const list=pick(field.filter(k=>team(k)===c.id));return {key:c.short,name:c.name,clubId:c.id,riders:list.map(k=>k.id),str:sum(list.map(k=>k.ca??k.ability))};});
 const schools=Object.values(G.miniSchools||{}).filter(s=>!s.clubId).map(s=>{const list=pick(field.filter(k=>k.schoolId===s.id&&!team(k)));return {key:'school-'+s.id,name:s.short,clubId:null,schoolId:s.id,riders:list.map(k=>k.id),str:sum(list.map(k=>k.ca??k.ability))};});
 return [...clubs,...schools].filter(u=>u.riders.length>=2);}
function makeMiniEvents(season){
 if(typeof MINI_CALENDAR==='undefined'||season<MINI_CALENDAR.season)return false;
 let changed=false;
 for(const e of MINI_CALENDAR.events){
  const id=`MINI${season}-${e.id}`;if(G.events[id])continue;
  const shift=(season-MINI_CALENDAR.season)*364,date=addDays(e.date,shift);
  const info=e.informational||date<G.date;
  G.events[id]={...e,id,date,season,kind:info?'mini-info':'comp',comp:e.comp,mini:true,calKey:e.id,
   name:e.name||`${COMPS[e.comp].name}${e.round?' — runda '+e.round:''}`,played:false,
   endDate:e.endDate?addDays(e.endDate,shift):null,alternativeDate:e.alternativeDate?addDays(e.alternativeDate,shift):null,
   calendarVersion:MINI_CALENDAR.version,projected:season!==MINI_CALENDAR.season,archiveOnly:date<G.date};
  changed=true;
 }
 return changed;
}
