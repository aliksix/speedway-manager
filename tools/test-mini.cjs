const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),ctx={console,Intl,Math,Date,JSON,Set,Map,setTimeout:()=>0,clearTimeout:()=>{},window:{addEventListener(){}},document:{addEventListener(){},documentElement:{style:{setProperty(){}}}},location:{protocol:'file:'}};vm.createContext(ctx);
const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+\.js)"/g)].map(m=>m[1]).filter(f=>!/ui-start/.test(f)); // ekran startowy uruchamia się sam (boot) – w teście bez przeglądarki pomijany
for(const f of files){let code=fs.readFileSync(path.join(root,f),'utf8');if(f==='js/ui-core.js')code=code.replace(/\(async function boot\(\) \{[\s\S]*$/,'');vm.runInContext(code,ctx,{filename:f});}
const run=s=>vm.runInContext(s,ctx);
run("newGame({clubId:9,manager:'Mini test'})");
assert.equal(run('Object.values(G.miniPeople).filter(p=>!p.calib).length'),214); // + adepci dopisani z protokołów (kalibracja)
assert.equal(run('Object.values(G.miniPeople).filter(p=>!p.calib&&!p.pzmRecords.length&&p.schoolId).length'),36);
assert.equal(run('Object.values(G.miniPeople).filter(p=>p.isSwietochlowice).length'),7);
assert.equal(run('G.miniSchools.REDZ.clubId'),null);
assert.equal(run('G.miniSchools.LIPN.clubId'),null);
// stowarzyszenia szkolące dla klubu: adepci w akademii klubu
assert.equal(run('G.miniSchools.SWIE.clubId'),24);assert.equal(run('G.miniSchools.SWIE.trainsFor'),'ŚWI');
assert.equal(run('G.miniSchools.RYBN.clubId'),5);
assert(run('Object.values(G.academy).filter(k=>k.schoolId==="SWIE").length')>0);
assert(run('Object.values(G.academy).filter(k=>k.schoolId==="SWIE").every(k=>k.clubId===24)'));
assert.equal(run('Object.values(G.events).filter(e=>e.comp==="MINI_DPE").length'),16);
assert.equal(run('Object.values(G.events).filter(e=>e.comp==="MINI_IPE").length'),8);
const counts=run('JSON.stringify([Object.keys(G.academy).length,Object.keys(G.riders).length,Object.keys(G.events).length])');
assert.equal(run('applyMiniData()'),false);run('makeMiniEvents(2026)');
assert.equal(run('JSON.stringify([Object.keys(G.academy).length,Object.keys(G.riders).length,Object.keys(G.events).length])'),counts);
run(`for(const part of [['kalendarz'],['szkolki'],['zawodnicy'],['szkolki','REDZ'],['szkolki','SWIE']]){const p=PAGES.minizuzel(part);if(!p.body||/undefined|NaN/.test(p.body))throw Error('Invalid page '+part);}
for(const p of Object.values(G.miniPeople)){if(!miniPersonEntity(p))throw Error('Unlinked '+p.name);const page=PAGES.minizuzel(['zawodnik',p.id]);if(/NaN/.test(page.body))throw Error(p.name);}
for(const e of Object.values(G.events).filter(e=>e.mini))PAGES.gp([e.id]);
G.date='2026-05-01';G.season=2026;
for(const comp of ['MINI_DMP_A','MINI_IPP_A','MINI_IPE','MINI_MPPK']){const e=Object.values(G.events).find(e=>e.comp===comp);buildStartList(e);simulateComp(e);if(!e.played)throw Error('Not played '+comp);PAGES.gp([e.id]);}
`);
// Run actual date advancement, covering training at independent schools and migration-safe saves.
run(`let guard=0;while(G.date<'2026-06-02'&&guard++<400){const x=advance(7);if(x.stop==='match'){const m=G.matches[x.fixture.matchId]||createMatch(x.fixture);simulateMatch(m);afterFixture(x.fixture);}}`);
assert(run("G.date>='2026-06-02'"));
run('G=JSON.parse(JSON.stringify(G))');assert.equal(run('applyMiniData()'),false);
assert(run('Object.values(G.academy).every(k=>Number.isFinite(k.ability))'));
console.log('PASS: catalog, source assignments, independent schools, idempotency, UI profiles, calendar rounds, individual/team/pairs simulation, training and JSON save roundtrip');
