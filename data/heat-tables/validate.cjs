'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const pack=require('./heat-tables-2026.json'),api=require('./adapter.js');
const gates=['A','B','C','D'],colors=pack.helmetNames;
const table=id=>api.table(pack,id);
const report={date:'2026-10-01',tables:pack.tables.length,heats:0,staticSourceSequences:[],checks:[],warnings:[]};
assert.equal(new Set(pack.tables.map(t=>t.id)).size,pack.tables.length);
for(const t of pack.tables){
  assert.equal(t.heatCount,t.heats.length,t.id);
  const noSet=new Set(t.heats.map(h=>h.no));assert.equal(noSet.size,t.heatCount,t.id);
  for(const h of t.heats){
    report.heats++;
    assert.equal(h.entries.length,4,`${t.id}/${h.no}`);
    assert.equal(new Set(h.entries.map(e=>JSON.stringify(e.participant))).size,4,`${t.id}/${h.no}`);
    if(h.gatePolicy==='fixed'){
      assert.deepEqual(h.entries.map(e=>e.gate).sort(),gates);
      assert.deepEqual(h.entries.map(e=>e.helmet).sort(),colors.slice().sort());
    }
    for(const e of h.entries)if(e.participant.type==='result')assert(h.entries&&noSet.has(e.participant.heat)&&e.participant.heat<h.no);
  }
  for(const s of t.sources)assert(pack.sources.some(x=>x.id===s.id),s.id);
}
for(const m of Object.values(pack.competitionMappings)){
  for(const id of [m.tableId,m.final,...Object.values(m.byTeams||{}),...Object.values(m.qualifyingByTeams||{})].filter(Boolean))assert(table(id));
}
// Each pair of riders meets exactly once in the classic 16-rider schedule.
const seen=new Set(),starts=new Map();
for(const h of table('individual-16-20').heats){const ns=h.entries.map(e=>e.participant.number);for(const n of ns)starts.set(n,(starts.get(n)||0)+1);for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const key=[ns[i],ns[j]].sort((a,b)=>a-b).join('-');assert(!seen.has(key));seen.add(key);}}
assert.equal(seen.size,120);assert.deepEqual([...starts.values()],Array(16).fill(5));
for(const id of ['pairs-5-pzm','pairs-6-pzm','pairs-7-pzm','pairs-6-fime','pairs-7-fime','pairs-8-fime','son2-8-28']){
  const t=table(id),meetings=new Set();
  for(const h of t.heats){const teams=[...new Set(h.entries.map(e=>e.team))].sort();assert.equal(teams.length,2);const k=teams.join('/');assert(!meetings.has(k),id);meetings.add(k);}
  assert.equal(meetings.size,t.teams*(t.teams-1)/2,id);
}
report.checks.push('Unique riders/gates/helmets; references; 120 unique individual pairings; each pair-team meets every opponent once.');
// Real source text, extracted independently by pdftotext -raw.
function sourceRows(file){const text=fs.readFileSync(path.join(__dirname,'sources',file),'utf8');return text.split(/\r?\n/).flatMap(line=>{const m=line.match(/^(?:Heat\s+)?(?:[IVX]+|\d+)\s+(.+)$/);if(!m)return [];const ns=m[1].match(/\b\d+\b/g);if(!ns||ns.length!==4||/[\/:]/.test(m[1]))return [];return [ns.map(Number)];});}
function verify(id,file,limit=Infinity){const expected=table(id).heats.filter(h=>h.entries.every(e=>e.participant.type==='startNumber')).slice(0,limit).map(h=>h.entries.map(e=>e.participant.number));const actual=sourceRows(file);const ok=actual.some((_,i)=>expected.every((r,j)=>JSON.stringify(r)===JSON.stringify(actual[i+j])));assert(ok,`Source mismatch ${id} vs ${file}`);report.staticSourceSequences.push({table:id,source:file,rows:expected.length});}
verify('individual-16-20','pzm-rzmot-2026.raw.txt');
verify('individual-20-25','pzm-rzmot-2026.raw.txt');
verify('sgp-16-23','sgp-2026-table.txt');
for(const id of ['league-15-set-1','league-15-set-2'])for(const file of ['ekstraliga-2026.raw.txt','2ekstraliga-2026.raw.txt','klz-2026.raw.txt'])verify(id,file);
for(const n of [5,6,7])verify(`pairs-${n}-pzm`,'pzm-rzmot-2026.raw.txt');
for(const n of [6,7,8])verify(`pairs-${n}-fime`,'fime-2026.raw.txt');
verify('dmpj-4-20','pzm-rzmot-2026.raw.txt');
verify('u24e-4-18','u24-2026.raw.txt');
verify('mini-dmp-7-21','mini-2026.raw.txt');verify('mini-dmp-7-21','dpe500-2026.raw.txt');
verify('mini-dmp-6-18','mini-2026.raw.txt');
verify('dpe-pairs-7-21','dpe-mini-2026.raw.txt');verify('dpe-pairs-7-21','dp2e500-2026.raw.txt');
verify('youth-20-21','mini-2026.raw.txt');verify('youth-20-21','ipe-mini-2026.raw.txt');verify('youth-20-21','ipe500-2026.raw.txt');
// SWC source columns are TEAM, not GATE. Check the conversion independently.
const swcText=fs.readFileSync(path.join(__dirname,'sources/swc-2026.raw.txt'),'utf8');
for(const h of table('swc-4-20').heats){
  const line=swcText.split(/\r?\n/).find(l=>l.startsWith(h.no+' ')&&[...l.matchAll(/(\d+|Choice of TM)\s*\/\s*(\d)/g)].length===4);assert(line);
  const cells=[...line.matchAll(/(\d+|Choice of TM)\s*\/\s*(\d)/g)];assert.equal(cells.length,4);
  cells.forEach((c,i)=>{const e=h.entries.find(x=>x.team==='D'+(i+1));assert.equal(e.gate,gates[Number(c[2])-1]);if(h.no<=16)assert.equal(e.participant.slot,Number(c[1]));});
}
const sonText=fs.readFileSync(path.join(__dirname,'sources/son-2026.raw.txt'),'utf8').split('SoN2 RACE FORMAT')[1];
for(const h of table('son2-8-28').heats){const line=sonText.split(/\r?\n/).find(l=>new RegExp('^'+h.no+' 1[A-H]').test(l));assert(line);assert.deepEqual(line.split(/\s+/).slice(1),h.entries.map(e=>e.participant.slot+e.team));}
report.checks.push('SWC team-column to gate conversion and all 28 SON2 rows verified against PDF text.');
// Dynamic resolution: main rankings contain rider IDs, never starting numbers.
const ctx={startNumbers:Object.fromEntries(Array.from({length:32},(_,i)=>[i+1,100+i+1])),rankings:{main:Array.from({length:20},(_,i)=>201+i)},results:{21:[209,206,208,203],22:[204,205,207,210]},gateChoices:{23:[209,202,204,201]}};
assert.deepEqual(api.choiceOrder(pack,'sgp-16-23',23,ctx),[201,202,204,209]);
assert.deepEqual(api.toRunHeatEntries(pack,'sgp-16-23',23,ctx).map(e=>e.riderId),[209,202,204,201]);
assert.throws(()=>api.toRunHeatEntries(pack,'sgp-16-23',21,ctx),/gateChoices/);
const noms={nominatedSet:2,nominations:{'14:żółty':1,'14:biały':3,'14:czerwony':9,'14:niebieski':11}};
assert.deepEqual(api.toRunHeatEntries(pack,'league-15-set-1',14,noms).map(e=>e.riderId),[9,1,11,3]);
assert.throws(()=>api.toRunHeatEntries(pack,'league-15-set-1',14,{nominations:noms.nominations}),/nominatedSet/);
const normal=api.toRunHeatEntries(pack,'pairs-7-pzm',1,ctx),swapped=api.toRunHeatEntries(pack,'pairs-7-pzm',1,{...ctx,swapTeams:['D1']});
assert.equal(swapped.find(e=>e.riderId===101).gate,'C');assert.equal(swapped.find(e=>e.riderId===101).helmet,normal.find(e=>e.riderId===101).helmet);
assert.throws(()=>api.toRunHeatEntries(pack,'dpe-pairs-7-21',1,{...ctx,swapTeams:['D1']}),/forbidden/);
assert.equal(api.selectTable(pack,'MINI_MPPK').heatCount,15);assert.equal(api.selectTable(pack,'SON2').heatCount,28);
assert.throws(()=>api.selectTable(pack,'MMPPK'),/Explicit/);
assert.equal(api.selectTable(pack,'MMPPK',{stage:'qualifying',teamCount:5}).heatCount,10);
const browser={};vm.createContext(browser);vm.runInContext(fs.readFileSync(path.join(__dirname,'heat-tables-2026.js'),'utf8'),browser);vm.runInContext(fs.readFileSync(path.join(__dirname,'adapter.js'),'utf8'),browser);assert.equal(browser.SPEEDWAY_HEAT_TABLES.tables.length,pack.tables.length);assert.equal(browser.SpeedwayHeatAdapter.selectTable(browser.SPEEDWAY_HEAT_TABLES,'DMPJ').heatCount,20);
report.checks.push('SGP LCQ/final selection; independent league nominated gate set; partner gate swaps preserve helmets; missing choices rejected; Node/browser exports.');
report.warnings.push('SGP 2026: PDF available through web index, direct download 404; factual transcription retained. Linked SGP organiser PDF has 2025 cover and is supplementary only.');
report.status='passed';fs.writeFileSync(path.join(__dirname,'validation-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(`PASS: ${report.tables} tables, ${report.heats} heats, ${report.staticSourceSequences.length} source sequences; adapter/browser checks passed.`);
