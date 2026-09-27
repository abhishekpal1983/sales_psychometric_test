// Scoring lives on the server. The candidate page never receives scale names, reverse flags or answer keys.
export const KEY = {
p1:["PA",0],p2:["PA",0],p3:["PA",1],p4:["PA",0],p5:["PA",0],p6:["PA",1],p7:["PA",0],p8:["PA",0],
a1:["AS",0],a2:["AS",0],a3:["AS",1],a4:["AS",0],a5:["AS",0],a6:["AS",0],a7:["AS",0],a8:["AS",1],
c1:["HC",0],c2:["HC",0],c3:["HC",0],c4:["HC",1],c5:["HC",0],c6:["HC",0],c7:["HC",1],c8:["HC",0],
y1:["HY",0],y2:["HY",0],y3:["HY",0],y4:["HY",0],y5:["HY",0],y6:["HY",0],
g1:["GR",0],g2:["GR",1],g3:["GR",0],g4:["GR",1],g5:["GR",0],g6:["GR",0],g7:["GR",0],g8:["GR",1],
l1:["LS",0],l2:["LS",1],l3:["LS",0],l4:["LS",1],l5:["LS",0],
o1:["LG",0],o2:["LG",1],o3:["LG",0],o4:["LG",0],o5:["LG",1],
s1:["SD",0],s2:["SD",0],s3:["SD",0],s4:["SD",0],s5:["SD",0],s6:["SD",0],s7:["SD",0],s8:["SD",0],
m1:["CO",0],m2:["CO",0],m3:["CO",1],m4:["CO",0],m5:["SA",0],m6:["SA",1],m7:["SA",0],m8:["SA",1],
m9:["HO",0],m10:["HO",0],m11:["HO",1],m12:["HO",0],m13:["TS",0],m14:["TS",0],m15:["TS",1],m16:["TS",0]};
export const ATKEY = {x1:4,x2:1};
export const CONS = [["p1","p3"],["a1","a3"],["l1","l2"],["g1","g8"],["o1","o2"]];
export const FC_N = 8;
export const SJKEY = [[2,0,1,0],[2,0,0,1],[2,0,1,0],[2,0,1,0]];
export const SCALES = {PA:"Proactive drive",AS:"Achievement striving",HC:"Healthy competitiveness",HY:"Hypercompetitiveness",GR:"Grit and resilience",LS:"Owns the outcome",LG:"Learns from losses",CO:"Coaching orientation",SA:"Standards and accountability",HO:"Hands on ownership",TS:"Team over self"};
export const PLAIN = {PA:"acts without being told, creates opportunities",AS:"sets hard targets and chases them",HC:"enjoys competing and wants to win",HY:"must win at any cost, resents others winning",GR:"keeps effort steady through rejection",LS:"credits results to own effort, not leads or luck",LG:"seeks feedback and adapts",CO:"would rather make a rep better than close it themselves",SA:"holds the line on standards",HO:"stays in the action, knows every pipeline",TS:"team total matters more than own rank"};
export const PROBES = {PA:"Tell me about something you changed at your last job that nobody asked you to change. What happened after?",AS:"What is the hardest target you ever hit, and what did you do differently in the last two weeks to get there?",HC:"Where did you rank on your last team, and how do you know?",GR:"Describe your worst month in sales. Walk me through what your activity looked like the week after.",LS:"Last quarter, what percentage of the result was you and what percentage was the leads or the market?",LG:"What is the last piece of critical feedback you got on a call, and what changed because of it?",CO:"Name a rep you made better. What exactly did you do, and what did their numbers do?",SA:"Tell me about the last underperformer you managed out or turned around. How long did it take you to act?",HO:"When was the last time you personally took a call for your team, and why?",TS:"Tell me about a time you shared a technique that then helped someone outscore you.",HY:"Tell me about a time a colleague beat you to a deal. What did you do next?"};

const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;

export function score(d){
  const a=d.a||{}, lat=d.l||{}; const sc={}, raw={};
  for(const id of Object.keys(KEY)){ if(!(id in a)) continue; const [s,rev]=KEY[id]; let v=+a[id]; if(!(v>=1&&v<=5)) continue; raw[id]=v; if(rev) v=6-v; (sc[s]=sc[s]||[]).push(v); }
  const scales={}; for(const k of Object.keys(sc)) if(k!=="SD") scales[k]=+mean(sc[k]).toFixed(2);
  const sdTotal=(sc.SD||[]).length;
  const sd=(sc.SD||[]).filter(v=>v===5).length;
  const isMgr=d.r==="manager";
  const compKeys=(isMgr?["PA","AS","GR","LS","LG","CO","SA","HO","TS"]:["PA","AS","HC","GR","LS","LG"]).filter(k=>k in scales);
  const comp=+mean(compKeys.map(k=>scales[k])).toFixed(2);
  let fc=0, fcMissing=0; for(let i=0;i<FC_N;i++){ if(a["f"+i]==="a") fc++; else if(!(("f"+i) in a)) fcMissing++; }
  const sj=SJKEY.reduce((t,k,i)=>t+((("j"+i) in a)?(k[+a["j"+i]]||0):0),0);
  const atTotal=Object.keys(ATKEY).filter(k=>k in a).length;
  const at=Object.keys(ATKEY).filter(k=>k in a&&+a[k]!==ATKEY[k]).length;
  const cons=CONS.filter(([x,y])=>raw[x]>=4&&raw[y]>=4).length;
  const seqL=(d.o||[]).filter(id=>id in raw).map(id=>raw[id]);
  let run=1,maxrun=1; for(let i=1;i<seqL.length;i++){ run=seqL[i]===seqL[i-1]?run+1:1; maxrun=Math.max(maxrun,run); }
  const mu=mean(seqL), sdev=Math.sqrt(mean(seqL.map(v=>(v-mu)**2)));
  const lats=Object.values(lat).map(Number).filter(n=>n>0).sort((x,y)=>x-y); const med=lats[Math.floor(lats.length/2)]||0;
  const compN=(comp-1)/4, fcN=fc/FC_N, gap=+(compN-fcN).toFixed(2);
  const flags=[];
  if(at>0) flags.push([at>=2?"bad":"warn",`Missed ${at} of ${atTotal} attention checks (statements that said which answer to pick).`]);
  if(cons>=2) flags.push(["bad",`Gave contradictory answers on ${cons} pairs of opposite statements. Suggests random or careless responding.`]); else if(cons===1) flags.push(["warn","One contradictory answer pair."]);
  if(sdTotal&&sd/sdTotal>=0.75) flags.push(["bad",`Claimed to be perfect on ${sd} of ${sdTotal} statements almost nobody is perfect on (never late, never irritated, and so on). The trait scores are inflated.`]); else if(sdTotal&&sd/sdTotal>=0.5) flags.push(["warn",`Claimed perfection on ${sd} of ${sdTotal} near impossible statements. Some inflation likely.`]);
  if(gap>=0.3) flags.push(["bad","Rated themselves far higher on the statements than their forced choices show. Classic sign of answering to the ideal."]); else if(gap>=0.18) flags.push(["warn","Self ratings run ahead of forced choices. Mild inflation."]);
  if(fcMissing>=2) flags.push(["warn",`Let ${fcMissing} timed choices expire without answering.`]);
  if(med&&med<1500) flags.push(["warn",`Answered in ${(med/1000).toFixed(1)} seconds on average, faster than the statements can be read properly.`]);
  if(maxrun>=10||sdev<0.6) flags.push(["warn",`Picked the same answer ${maxrun} times in a row. Pattern responding.`]);
  if((d.b||0)>=3) flags.push(["warn",`Left the page ${d.b} times during the test.`]);
  if(isMgr&&scales.HY>=3.5) flags.push(["bad",`Hypercompetitive (${scales.HY} of 5). For a manager this is a decline: predicts lead hoarding, favouritism and turnover.`]);
  else if(scales.HY>=3.5) flags.push(["warn",`Hypercompetitive (${scales.HY} of 5). Wins at any cost. Check quality audits and teamwork in interview.`]);
  const bads=flags.filter(f=>f[0]==="bad").length, warns=flags.filter(f=>f[0]==="warn").length;
  const validity=bads>=1?"Invalid":warns>=2?"Caution":"Valid";
  const hy=scales.HY||1;
  const effComp=validity==="Valid"?comp:+(comp-(gap>0?gap*4*0.5:0)).toFixed(2);
  let band,bandCls,meaning;
  if(validity==="Invalid"){band="No decision";bandCls="bad";meaning="The answers cannot be trusted. Do not read the trait bars as facts. Re administer once with a warning, or decide on the role play and interview alone.";}
  else if(isMgr&&hy>=3.5){band="Decline for manager role";bandCls="bad";meaning="Individual drive is fine but the win at any cost pattern damages teams. Consider for an agent role only.";}
  else if(effComp>=4.2&&hy<2.5&&sj>=SJKEY.length*2*0.7){band="Strong fit";bandCls="ok";meaning="Profile matches the champion pattern on the self report, the forced choices and the situational judgement. Advance. Use the interview to check the story behind the scores.";}
  else if(effComp>=3.7&&hy<3.0&&sj>=SJKEY.length*2*0.5){band="Probable fit";bandCls="ok";meaning="Most of the profile is there. Advance and probe the weakest trait in the interview.";}
  else if(effComp>=3.2){band="Uncertain";bandCls="warn";meaning="The questionnaire does not separate this candidate either way. Let the role play and interview decide.";}
  else{band="Unlikely fit";bandCls="bad";meaning="Profile sits well below the champion pattern. Decline unless the role play is unusually strong.";}
  return {scales,comp,effComp,sd,sdTotal,atTotal,fc,sj,at,cons,maxrun,sdev:+sdev.toFixed(2),med,gap,flags,validity,band,bandCls,meaning,isMgr,compKeys};
}
