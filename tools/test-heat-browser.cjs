const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),{server}=require('./server.js');
const root=path.resolve(__dirname,'..'),port=8811,debug=9243;
const chromePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,seq=0,gameId,chrome;const pending=new Map(),errors=[];
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
async function ev(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||JSON.stringify(r.exceptionDetails));return r.result.value;}
function check(ok,msg){if(!ok)throw Error(msg);console.log('PASS '+msg);}
(async()=>{
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${debug}`,`--user-data-dir=${path.join(__dirname,'.browser-heats')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
 let targets;for(let i=0;i<60&&!targets;i++){try{targets=await(await fetch(`http://127.0.0.1:${debug}/json`)).json();}catch{await sleep(200);}}
 if(!targets)throw Error('Browser did not start');
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 await call('Runtime.enable');await call('Page.enable');await call('Page.navigate',{url:`http://127.0.0.1:${port}`});
 for(let i=0;i<100;i++){if(await ev('typeof ACT!=="undefined"&&typeof DB!=="undefined"&&DB.on'))break;await sleep(100);}
 await ev("START.wiz=quickWizard(9,'Test tabel');ACT.startGame()");
 for(let i=0;i<100;i++){gameId=await ev('G&&G.gameId');if(gameId)break;await sleep(100);}
 check(!!gameId,'new SQLite game');
 const result=await ev(`(()=>{G.season=2026;G.date='2026-04-01';makeLeagueFixtures(2026);makeSgp(2026);makeCompEvents(2026);
 const e=Object.values(G.events).find(e=>e.kind==='sgp'),m=simulateGp(e);
 const f=Object.values(G.fixtures).find(f=>f.homeId===G.clubId||f.awayId===G.clubId),l=createMatch(f);for(let i=0;i<13;i++)playNextHeat(l);heatEntries(l,13);
 return {event:e.id,match:m.id,league:l.id,fixture:f.id};})()`);
 await ev(`go('#/gp/${result.event}')`);await sleep(200);
 check(await ev("document.querySelector('#main').innerText.includes('LCQ')||document.querySelector('#main').innerText.includes('SGP')"),'SGP result screen');
 const snapshot=await ev(`JSON.stringify([G.matches['${result.match}'],G.matches['${result.league}']])`);
 await ev('dbSaveNow()');await ev(`dbLoad('${gameId}')`);
 check(snapshot===await ev(`JSON.stringify([G.matches['${result.match}'],G.matches['${result.league}']])`),'SQLite preserves table IDs, heats, frozen ranking and nominations');
 await ev(`simulateMatch(G.matches['${result.league}']);go('#/zawody/${result.fixture}')`);await sleep(200);
 check(await ev(`G.matches['${result.league}'].heats.length===15&&G.matches['${result.league}'].done`),'resume league after load');
 check(await ev("!/Błąd|undefined|NaN/.test(document.querySelector('#main').innerText)"),'league result screen');
 check(!errors.length,'no browser JS errors: '+errors.join(' | '));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 try{if(ws)await call('Browser.close');}catch{}chrome?.kill();server.close();
 if(gameId)for(const suffix of ['','-wal','-shm']){const file=path.join(root,'saves',gameId+'.sqlite'+suffix);if(fs.existsSync(file))fs.unlinkSync(file);}
});
