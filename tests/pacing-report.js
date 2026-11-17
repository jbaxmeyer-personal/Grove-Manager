// tests/pacing-report.js — prints match pacing/balance stats over N simulated games: node tests/pacing-report.js 100
const { loadGame, rosterFor } = require('./sim-harness');
const api = loadGame(); const ids = api.TEAMS_DATA.map(t=>t.id);
const N=+process.argv[2]||60; const ends=[]; let roots=0,kills=0,blue=0,sh=0,wd=0,cs=0, lvl=0;
for (let i=0;i<N;i++){ const a=ids[i%8], b=ids[(i+3)%8]; const sw=i%2; const r=api.simulateMatch(rosterFor(api, sw?b:a), rosterFor(api, sw?a:b),'A','B');
  const t=r.events[r.events.length-1].tick; ends.push(t); roots+=r.blueRoots+r.redRoots; kills+=r.blueKills+r.redKills; blue+=r.winner==='blue'; sh+=r.blueShrines+r.redShrines; wd+=r.events.filter(e=>e.type==='baron').length;
  const ps=[...r.playerStats.blue,...r.playerStats.red].filter(p=>p.pos!=='support'&&p.pos!=='jungle'); cs+=ps.reduce((s,p)=>s+p.cs,0)/ps.length;
  const fin=r.events[r.events.length-1].agentStats; }
ends.sort((a,b)=>a-b);
const pct=q=>ends[Math.floor(q*(N-1))];
console.log(JSON.stringify({blue:+(blue/N).toFixed(2), ancientEnd:+(ends.filter(t=>t<api.MAX_TICKS).length/N).toFixed(2), medianEndMin: Math.round(pct(.5)*8/60), p25: Math.round(pct(.25)*8/60), kills:+(kills/N).toFixed(1), towers:+(roots/N).toFixed(1), shrines:+(sh/N).toFixed(1), wardens:+(wd/N).toFixed(1), laneCS:+(cs/N).toFixed(1)}));
