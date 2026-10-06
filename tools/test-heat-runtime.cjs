const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const ctx={console,Intl,Math,Date,JSON,Set,Map,setTimeout:()=>0,clearTimeout(){},window:{addEventListener(){}},document:{addEventListener(){}},location:{protocol:'file:'}};
vm.createContext(ctx);
for(const [,f] of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+\.js)"/g)) {
  if(f==='js/ui-start.js')continue;
  let code=fs.readFileSync(path.join(root,f),'utf8');
  if(f==='js/ui-core.js')code=code.replace(/\(async function boot\(\) \{[\s\S]*$/,'');
  vm.runInContext(code,ctx,{filename:f});
}
ctx.assert=assert;
vm.runInContext(`
newGame({clubId:9,manager:'Heat tables'});
G.season=2026;G.date='2026-04-01';makeLeagueFixtures(2026);makeSgp(2026);makeCompEvents(2026);
const actualRunHeat=runHeat;
const ids=Object.keys(G.riders).slice(0,80).map(Number);
// Controlled finishes isolate program resolution and scoring from racing/injury randomness.
runHeat=(entries,c)=>({res:entries.filter(e=>e.riderId!=null).map((e,i)=>({riderId:e.riderId,team:e.team,pos:i+1,pts:(c.points||[3,2,1,0])[i],bonus:0,status:''})),time:60,log:[],injuries:[]});
for(const t of SPEEDWAY_HEAT_TABLES.tables.filter(t=>!t.id.startsWith('league-'))) {
  const n=t.teams, size=n?heatRegularSlots(t)+1:0;
  const units=n?Array.from({length:n},(_,i)=>({key:'T'+i,name:'Team '+i,riders:ids.slice(i*size,(i+1)*size)})):null;
  const ev={id:t.id,kind:'comp',comp:'TEST',season:2026,date:G.date,name:t.name,venue:'Test'};
  const m=tableMeeting(ev,t,ids.slice(0,t.riders||4),units);
  assert.equal(m.heats.length,t.heatCount,t.id);
  for(const h of m.heats){assert.equal(new Set(h.entries.map(e=>e.gate)).size,4,t.id+' gates');assert.equal(new Set(h.res.map(e=>String(e.riderId))).size,h.res.length,t.id+' duplicate');assert.equal(h.res.reduce((s,x)=>s+x.pts,0),t.points.reduce((s,x)=>s+x,0),t.id+' points');}
  assert.equal(m.classification.length,n||t.riders||4,t.id+' classification');
  if(!units) {
    const expected=t.heats.filter(h=>h.phase==='main').length*4;
    assert.equal(m.heats.filter(h=>h.phase==='main').reduce((s,h)=>s+h.res.length,0),expected);
    if(t.id==='sgp-16-23') {
      assert.deepEqual(m.heats[20].entries.map(e=>String(e.riderId)),[2,5,7,8].map(i=>m.rankings.main[i]));
      assert.deepEqual(m.heats[21].entries.map(e=>String(e.riderId)),[3,4,6,9].map(i=>m.rankings.main[i]));
      assert.equal(m.classification[0].gp,20);assert.equal(m.classification[15].gp,1);
      const final=m.heats[22].res.map(x=>String(x.riderId));assert.deepEqual(m.classification.slice(0,4).map(x=>String(x.riderId)),final);
    }
    if(t.id==='sgp-sprint')assert.deepEqual(m.classification.map(x=>String(x.riderId)),m.heats[0].res.map(x=>String(x.riderId)));
    if(t.seriesScoring)for(const c of m.classification){const pts=m.heats.filter(h=>!t.seriesScoring.excludedHeats.includes(h.no)).reduce((s,h)=>s+(h.res.find(x=>String(x.riderId)===String(c.riderId))?.pts||0),0);assert.equal(c.gp,pts,t.id+' series');}
  }
  assert.equal(JSON.parse(JSON.stringify(m)).heatTableId,t.id);
}
// Missing numbers must remain empty instead of moving every following rider up one slot.
const sparse=ids.slice(0,16);sparse[1]=null;
const empty=tableMeeting({id:'empty',kind:'comp',date:G.date},SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES,'individual-16-20'),sparse,null);
assert.equal(empty.heats[0].entries[1].riderId,null);assert.equal(empty.heats[0].entries[2].riderId,ids[2]);assert.equal(empty.heats.length,20);
const fx=Object.values(G.fixtures)[0],lm=createMatch(fx);
for(const set of [1,2]){lm.heatTableId='league-15-set-'+set;const ht=SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES,lm.heatTableId);for(let i=0;i<13;i++){assert.deepEqual(heatEntries(lm,i).map(e=>e.slot),ht.heats[i].entries.map(e=>e.participant.number));}}
const e14=heatEntries(lm,13);assert.equal(new Set(e14.map(e=>e.gate)).size,4);
const frozen=JSON.stringify(lm.nominationRanking);Object.values(lm.riders).forEach(s=>s.pts+=20);heatEntries(lm,14);assert.equal(JSON.stringify(lm.nominationRanking),frozen);
const persisted=JSON.parse(JSON.stringify(lm));assert.deepEqual(heatEntries(persisted,14),heatEntries(lm,14));
delete persisted.heatTableId;persisted.heats=[{}];heatEntries(persisted,1);assert.equal(persisted.heatTableId,undefined);
assert.equal(eventFieldSize({comp:'MINI_IPP_A'}),20);assert.equal(eventHeatTable({comp:'SON2'}).teams,8);assert.equal(eventHeatTable({comp:'MINI_MPPK'}).teams,6);
assert.equal(eventHeatTable({comp:'MPPK',stage:'eliminacje'},5).id,'pairs-5-pzm');assert.equal(eventHeatTable({comp:'MINI_DMP_A'},6).heatCount,18);
G.events.testWin1={id:'testWin1',comp:'SWC',season:2026,date:'2026-01-01',played:true,winner:'T0'};
G.events.testWin2={id:'testWin2',comp:'SWC',season:2026,date:'2026-01-02',played:true,winner:'T0'};
const nations=Array.from({length:8},(_,i)=>({key:'T'+i,str:8-i,riders:[]}));
const selected=pickUnits({id:'testFinal',comp:'SWC',season:2026,date:'2026-10-01',stage:'finał'},nations,4);
assert.equal(selected.length,4);assert.equal(new Set(selected.map(u=>u.key)).size,4);
delete G.events.testWin1;delete G.events.testWin2;
runHeat=actualRunHeat;
const single=runHeat(ids.slice(0,4).map((id,i)=>({riderId:id,team:null,gate:GATES[i]})),{weather:{},points:[4,3,2,0]});
assert(single.res.every(x=>x.bonus===0));assert(single.res.filter(x=>x.pos).every(x=>x.pts===[4,3,2,0][x.pos-1]));
// Real public entry points: no synthetic table override.
for(const key of ['SGP','IMP','SEC','MIMP','DMPJ','U24E','SON2','SWC','ETC','MINI_DMP_A','MINI_IPP_A','MINI_IPE','MINI_MPPK']) {
  const ev=Object.values(G.events).find(e=>key==='SGP'?e.kind==='sgp':e.comp===key);assert(ev,key+' calendar');
  const m=key==='SGP'?simulateGp(ev):simulateComp(ev);assert(m,key+' simulation');
  assert(m.heatTableId,key+' mapped');assert.equal(m.heats.length,SpeedwayHeatAdapter.table(SPEEDWAY_HEAT_TABLES,m.heatTableId).heatCount);
  const page=PAGES.gp([ev.id]);assert(!/NaN|undefined/.test(page.body),key+' UI');
}
`,ctx);
console.log('PASS: all 27 table programs, fields/gates, SGP LCQ/final, series scoring, SON2 points, empty slots, nominations, save roundtrip, legacy match, real competition entry points and result UI');
