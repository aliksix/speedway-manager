const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),{server}=require('./server.js');
const PORT=8809,DEBUG=9241,root=path.resolve(__dirname,'..');
const chromePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,seq=0,gameId,chrome;const pending=new Map(),errors=[];
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
async function ev(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||JSON.stringify(r.exceptionDetails));return r.result.value;}
const check=(ok,msg)=>{if(!ok)throw Error(msg);console.log('PASS '+msg);};
(async()=>{
 await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
 chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${DEBUG}`,`--user-data-dir=${path.join(__dirname,'.browser-mini')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
 let targets;for(let i=0;i<60&&!targets;i++){try{targets=await(await fetch(`http://127.0.0.1:${DEBUG}/json`)).json();}catch{await sleep(200);}}
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:`http://127.0.0.1:${PORT}`});
 for(let i=0;i<100;i++){if(await ev('typeof ACT!=="undefined"&&typeof DB!=="undefined"&&DB.on'))break;await sleep(100);}
 await ev("START.wiz=quickWizard(9,'Test Mini');ACT.startGame()");
 for(let i=0;i<100;i++){gameId=await ev('G&&G.gameId');if(gameId)break;await sleep(100);}
 check(!!gameId,'new SQLite game');
 for(const route of ['minizuzel','minizuzel/szkolki','minizuzel/szkolki/REDZ','minizuzel/szkolki/SWIE','minizuzel/zawodnicy','kalendarz/imprezy','rozgrywki']){
  await ev(`go('#/${route}')`);await sleep(150);
  const text=await ev("document.querySelector('#main').innerText");check(!/Błąd|undefined|NaN/.test(text),'page '+route);
 }
 await ev("go('#/minizuzel/zawodnicy');UI.af={...AF_DEFAULT,outside:true};render()");await sleep(150);
 const outside=await ev("document.querySelectorAll('#main tbody tr').length");check(outside>0,'outside-registry pupils filter ('+outside+' on page)');
 await ev("UI.af=null;go('#/minizuzel/szkolki');UI.mini.independent=true;render()");await sleep(150);
 check(await ev("document.querySelector('#main').innerText.includes('Speedway Rędziny')"),'independent school filter');
 const person=await ev("Object.values(G.miniPeople).find(p=>p.name==='Daniel Szatan').id");await ev(`go('#/minizuzel/zawodnik/${person}')`);await sleep(150);
 check(await ev("document.querySelector('#main').innerText.includes('27.07.2017')"),'full birth date in rider profile');
 {const kid=await ev("Object.keys(G.academy)[0]");for(const sub of ['','/starty']){await ev(`go('#/adept/${kid}${sub}')`);await sleep(150);const t=await ev("document.querySelector('#main').innerText");check(!/Błąd|undefined|NaN/.test(t)&&(sub?/Sukcesy/i.test(t):/Ostatnie starty/i.test(t)),'adept profile'+(sub||' overview')+' :: '+(t.match(/.{0,60}(Błąd|undefined|NaN).{0,60}/)||[''])[0]);}}
 await ev("go('#/minizuzel');UI.mcal='2026-05';render()");await sleep(150);
 check(await ev("document.querySelectorAll('#main .cal .day').length>=35&&document.querySelectorAll('#main .cal .ev.mini, #main .cal .ev.mini-ind').length>=10"),'mini calendar as month grid with events');
 const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'screenshots','mini-calendar.png'),Buffer.from(shot.data,'base64'));
 const snap=await ev('JSON.stringify({p:G.miniPeople,s:G.miniSchools,a:G.academy,e:Object.values(G.events).filter(e=>e.mini)})');
 await ev('dbSaveNow()');await ev(`dbLoad('${gameId}')`);
 check(snap===await ev('JSON.stringify({p:G.miniPeople,s:G.miniSchools,a:G.academy,e:Object.values(G.events).filter(e=>e.mini)})'),'SQLite save/load preserves catalog, schools, pupils and calendar');
 const counts=await ev('JSON.stringify([Object.keys(G.academy).length,Object.keys(G.riders).length])');
 await ev('(async()=>{delete G.miniVersion;delete G.miniPeople;delete G.miniSchools;await dbSaveNow()})()');await ev(`dbLoad('${gameId}')`);
 check(await ev('Object.keys(G.miniPeople).length===214'),'legacy save imports catalog on load');
 {const after=await ev('JSON.stringify([Object.keys(G.academy).length,Object.keys(G.riders).length])');check(counts===after,'migration does not duplicate riders '+counts+' vs '+after);}
 await ev('dbSaveNow()');await ev(`dbLoad('${gameId}')`);
 check(await ev('Object.keys(G.miniPeople).length===214'),'migration survives second load');
 check(!errors.length,'no browser JS errors: '+errors.join(' | '));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 try{if(ws)await call('Browser.close');}catch{}chrome?.kill();server.close();
 if(gameId){for(const suffix of ['', '-wal','-shm']){const file=path.join(root,'saves',gameId+'.sqlite'+suffix);if(fs.existsSync(file))fs.unlinkSync(file);}}
});
