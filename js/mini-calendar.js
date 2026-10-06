'use strict';
// PZM, Kalendarz miniżużla v2 (04.05.2026). Host and track retained verbatim.
const MINI_CALENDAR = (() => {
 const sourceUrl='https://pzm.pl/pliki/zg/zuzel/2026/kalendarz-mini-2026v2.pdf';
 const events=[];
 const add=(date,venue,comp,round,extra={})=>events.push({id:'mini-'+(events.length+1),date:'2026-'+date,venue,comp,round,sourceUrl,...extra});
 const groups=[['05-01','Rybnik','B',1],['05-02','Gdańsk','A',1],['05-16','Gorzów','A',2],['05-16','Bydgoszcz','B',2],['05-30','Toruń','A',3],['05-30','Leszno (Rybnik)','B',3],['06-13','Lipno (Wawrów)','A',4],['06-13','Wrocław (Rybnik)','B',4],['07-11','Zielona Góra (Wawrów)','A',5],['07-11','Częstochowa','B',5],['08-01','Gorzów','A',6],['08-29','Rędziny','B',6]];
 for(const [d,v,g,r]of groups)for(const type of ['DMP','IPP'])add(d,v,'MINI_'+type+'_'+g,r,{stage:'grupa '+g});
 const cups=[['05-09','05-10','Zielona Góra (Wawrów)'],['05-23','05-24','Lublin'],['06-06','06-07','Częstochowa'],['06-20','06-21','Leszno (Rybnik)'],['07-04','07-05','Toruń'],['07-18','07-19','Grudziądz (Bydgoszcz)'],['08-15','08-16','Wrocław (Rybnik)'],['08-22','08-23','Gorzów']];
 cups.forEach(([d,i,v],n)=>{add(d,v,'MINI_DPE',2*n+1);add(d,v,'MINI_DPE',2*n+2);add(i,v,'MINI_IPE',n+1);});
 add('09-05','Gorzów','MINI_IMPQ',1,{stage:'półfinał A',name:'IMP 85–140cc — półfinał A'});
 for(const [n,d,v]of [[1,'09-06','Gorzów'],[2,'09-12','Rędziny'],[3,'09-13','Bydgoszcz']])add(d,v,'MINI_IMP',n,{stage:'finał'});
 add('09-19','Gdańsk','MINI_MPPKQ',1,{stage:'półfinał A',name:'MPPK 85–140cc — półfinał A'});add('09-20','Gdańsk','MINI_MPPK',1,{stage:'finał'});
 add('10-03','Rybnik','MINI_DMP',1,{stage:'finał'});add('10-03','Rybnik','MINI_IPP',1,{stage:'finał'});
 for(const [d,v,name]of [['05-02','Rybnik','Memoriał Skulskiego'],['06-27','Gdańsk','Golden Boy'],['07-12','Częstochowa','Turniej Prezydenta Częstochowy'],['08-08','Rybnik','Gala 25-lecia'],['08-08','Workington','Gold Trophy 125cc'],['08-09','Workington','Puchar Europy 125cc'],['10-04','Rybnik','Turniej 25-lecia klubu']])add(d,v,'MINI_OPEN',null,{name,informational:true});
 add('06-22','Gdańsk','MINI_INFO',null,{name:'CAMP',endDate:'2026-06-24',informational:true});
 add('04-18','Gdańsk','MINI_INFO',null,{name:'Egzamin — termin alternatywny 18 lub 25 kwietnia',alternativeDate:'2026-04-25',informational:true});
 // drugie półfinały IMP i MPPK (art. 924 ust. 1, art. 937 ust. 1) – ten sam dzień i tor; dopisane na końcu, by nie zmieniać identyfikatorów
 add('09-05','Gorzów','MINI_IMPQ',2,{stage:'półfinał B',name:'IMP 85–140cc — półfinał B'});add('09-19','Gdańsk','MINI_MPPKQ',2,{stage:'półfinał B',name:'MPPK 85–140cc — półfinał B'});
 return {season:2026,version:'PZM v2, 04.05.2026',sourceUrl,events:events.sort((a,b)=>a.date.localeCompare(b.date))};
})();
