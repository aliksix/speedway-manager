'use strict';
// Browser: SpeedwayHeatAdapter. Node: require('./adapter.js'). No game globals.
(function(root){
  const gates=['A','B','C','D'];
  const helmets=['czerwony','niebieski','biały','żółty'];
  function table(pack,id){const t=pack.tables.find(x=>x.id===id);if(!t)throw Error('Unknown heat table: '+id);return t;}
  function selectTable(pack,comp,{stage,teamCount}={}){
    const m=pack.competitionMappings[comp];
    if(!m)throw Error('Unknown competition: '+comp);
    if(m.tableId)return table(pack,m.tableId);
    if(m.byTeams){if(!m.byTeams[teamCount])throw Error('Unsupported team count: '+comp);return table(pack,m.byTeams[teamCount]);}
    if(m.final&&stage==='final')return table(pack,m.final);
    if(m.qualifyingByTeams&&stage==='qualifying'&&m.qualifyingByTeams[teamCount])return table(pack,m.qualifyingByTeams[teamCount]);
    throw Error('Explicit stage / team count / supplementary regulations required: '+comp);
  }
  function resolve(p,ctx){
    let id;
    switch(p.type){
      case 'startNumber':id=ctx.startNumbers?.[p.number];break;
      case 'teamSlot':id=ctx.teamRiders?.[p.team]?.[p.slot-1];break;
      case 'rank':id=ctx.rankings?.[p.ranking]?.[p.place-1];break;
      case 'result':id=ctx.results?.[p.heat]?.[p.place-1];break;
      case 'nomination':id=ctx.nominations?.[p.key];break;
      default:throw Error('Unsupported selector: '+p.type);
    }
    if(id===undefined||id===null)throw Error('Unresolved participant: '+JSON.stringify(p));
    return id;
  }
  function toRunHeatEntries(pack,tableId,heatNo,ctx={}){
    const t=table(pack,tableId),h=t.heats.find(x=>x.no===heatNo);
    if(!h)throw Error('Unknown heat: '+heatNo);
    let entries=h.entries.map(e=>({...e,riderId:resolve(e.participant,ctx)}));
    if(new Set(entries.map(e=>String(e.riderId))).size!==4)throw Error('Duplicate rider in heat');
    if(h.gatePolicy==='league-nominated-set'){
      const colors=h.gateSets[ctx.nominatedSet];
      if(!colors)throw Error('nominatedSet (1 or 2) is required independently of main set');
      entries=entries.map(e=>({...e,gate:gates[colors.indexOf(e.helmet)]}));
    } else if(h.gatePolicy==='rider-choice'||h.gatePolicy==='ballot'){
      const choices=ctx.gateChoices?.[heatNo];
      if(!Array.isArray(choices)||choices.length!==4||new Set(choices.map(String)).size!==4||entries.some(e=>!choices.some(id=>String(id)===String(e.riderId))))throw Error('gateChoices must list the four qualified riders in gate order');
      entries=entries.map(e=>{const i=choices.findIndex(id=>String(id)===String(e.riderId));return {...e,gate:gates[i],helmet:e.team?e.helmet:helmets[i]};});
    }
    // An optional partner swap changes gates only, preserving helmet identity.
    for(const team of ctx.swapTeams||[]){
      if(!t.gateSwapWithinTeam)throw Error('Partner gate swap is forbidden');
      const pair=entries.filter(e=>e.team===team);
      if(pair.length!==2)throw Error('Partner swap requires exactly two teammates');
      [pair[0].gate,pair[1].gate]=[pair[1].gate,pair[0].gate];
    }
    if(new Set(entries.map(e=>e.gate)).size!==4||entries.some(e=>!gates.includes(e.gate)))throw Error('Invalid gates');
    return entries.sort((a,b)=>gates.indexOf(a.gate)-gates.indexOf(b.gate)).map(e=>({riderId:e.riderId,team:e.team,gate:e.gate,helmet:e.helmet,slot:e.participant.type==='startNumber'?e.participant.number:e.participant.type==='teamSlot'?e.participant.slot:null}));
  }
  function choiceOrder(pack,tableId,heatNo,ctx){
    const h=table(pack,tableId).heats.find(x=>x.no===heatNo);
    if(!h||h.gatePolicy!=='rider-choice')throw Error('Heat has no rider choice');
    const ids=h.entries.map(e=>resolve(e.participant,ctx));
    if(h.choiceOrder==='main-top-two-then-lcq-winners-by-main-ranking'){
      const rank=ctx.rankings?.main;
      if(!rank||ids.some(id=>!rank.includes(id)))throw Error('Complete main ranking required');
      return [...ids.slice(0,2),...ids.slice(2).sort((a,b)=>rank.indexOf(a)-rank.indexOf(b))];
    }
    return ids;
  }
  const api={table,selectTable,toRunHeatEntries,choiceOrder};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SpeedwayHeatAdapter=api;
})(globalThis);
