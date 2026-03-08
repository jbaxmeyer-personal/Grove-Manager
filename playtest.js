#!/usr/bin/env node
// playtest.js — Headless simulation for balance testing
// Run: node playtest.js [iterations]
// Example: node playtest.js 500

'use strict';

// ─── Inline constants from config.js ─────────────────────────────────────────
const CONFIG = {
  ROSTER_MAX:5, BENCH_MAX:9, SHOP_SIZE:5, REROLL_COST:2, XP_COST:4,
  XP_PER_BUY:4, XP_PER_ROUND:2, STARTING_GOLD:10, BASE_GOLD:5, MAX_INTEREST:5,
  LEVEL_XP:[0,0,2,6,12,20], TIER_COST:[0,1,2,3,4,5], TIER_SELL:[0,0,1,2,3,4],
  TIER_POOL_SIZE:[0,18,15,13,10,9],
  WIN_STREAK_GOLD:{0:0,1:0,2:1,3:1,4:2,5:3},
  LOSE_STREAK_GOLD:{0:0,1:0,2:1,3:2,4:3,5:3},
  ROUND_ROBIN_ROUNDS:14, TOTAL_TEAMS:8, BRACKET_SIZE:4,
  STAR_MULTIPLIER:{1:1.0,2:1.22,3:1.55}, COPIES_TO_UPGRADE:3,
  POSITIONS:['top','jungle','mid','adc','support'],
  DRAGON_TYPES:['Infernal','Mountain','Ocean','Cloud','Hextech','Chemtech'],
  TIER_ODDS:{
    1:[0,100,0,0,0], 2:[0,72,24,4,0], 3:[0,45,35,17,3],
    4:[0,22,35,30,13], 5:[0,8,22,38,32]
  },
  TRAITS:{
    Carry:{thresholds:[2,4],bonuses:[{mechanics:8,laning:5},{mechanics:20,laning:12,teamfighting:8}]},
    Shotcaller:{thresholds:[1,2],bonuses:[{gameSense:8,communication:5},{gameSense:18,communication:15,teamfighting:6}]},
    Mechanical:{thresholds:[2,3],bonuses:[{mechanics:12,clutch:6},{mechanics:25,clutch:15,laning:8}]},
    Veteran:{thresholds:[2,3],bonuses:[{consistency:12,gameSense:5},{consistency:22,gameSense:12,communication:8}]},
    Fragger:{thresholds:[2,4],bonuses:[{clutch:8,mechanics:5},{clutch:18,mechanics:12,laning:10}]},
    Utility:{thresholds:[2,3],bonuses:[{communication:10,teamfighting:6},{communication:20,teamfighting:14,gameSense:8}]},
    Macro:{thresholds:[2,3],bonuses:[{gameSense:12,consistency:6},{gameSense:22,consistency:12,teamfighting:8}]},
    Playmaker:{thresholds:[2,3],bonuses:[{clutch:10,mechanics:6},{clutch:20,mechanics:14,teamfighting:8}]},
  },
  REGION_SYNERGY:{2:{bonusPct:6},3:{bonusPct:12},4:{bonusPct:18},5:{bonusPct:25}},
};

// ─── Player templates (abbreviated) ──────────────────────────────────────────
const PLAYER_TEMPLATES = [
  {id:'p01',name:'IronKing',   position:'top',tier:5,region:'Korea', traits:['Carry','Mechanical'],    stats:{mechanics:88,laning:96,gameSense:82,teamfighting:80,communication:75,clutch:88,consistency:92,draftIQ:82}},
  {id:'p02',name:'Fortress',   position:'top',tier:4,region:'EU',    traits:['Macro','Veteran'],        stats:{mechanics:78,laning:80,gameSense:86,teamfighting:74,communication:80,clutch:72,consistency:84,draftIQ:90}},
  {id:'p03',name:'Summit',     position:'top',tier:4,region:'NA',    traits:['Mechanical','Playmaker'], stats:{mechanics:92,laning:84,gameSense:66,teamfighting:68,communication:60,clutch:94,consistency:64,draftIQ:68}},
  {id:'p04',name:'DragonFist', position:'top',tier:4,region:'China', traits:['Fragger','Carry'],        stats:{mechanics:75,laning:80,gameSense:75,teamfighting:90,communication:80,clutch:72,consistency:78,draftIQ:72}},
  {id:'p05',name:'Colossus',   position:'top',tier:2,region:'SEA',   traits:['Utility','Veteran'],      stats:{mechanics:44,laning:48,gameSense:56,teamfighting:58,communication:66,clutch:44,consistency:60,draftIQ:52}},
  {id:'p06',name:'Vanguard',   position:'top',tier:2,region:'SA',    traits:['Veteran','Utility'],      stats:{mechanics:40,laning:50,gameSense:52,teamfighting:55,communication:56,clutch:42,consistency:64,draftIQ:48}},
  {id:'p07',name:'PhantomStep',position:'jungle',tier:5,region:'Korea',traits:['Mechanical','Playmaker'],stats:{mechanics:96,laning:84,gameSense:94,teamfighting:86,communication:82,clutch:92,consistency:86,draftIQ:90}},
  {id:'p08',name:'WildCard',   position:'jungle',tier:4,region:'EU',  traits:['Playmaker','Fragger'],   stats:{mechanics:84,laning:70,gameSense:80,teamfighting:78,communication:68,clutch:86,consistency:64,draftIQ:76}},
  {id:'p09',name:'Cyclone',    position:'jungle',tier:4,region:'China',traits:['Fragger','Utility'],    stats:{mechanics:74,laning:68,gameSense:80,teamfighting:92,communication:84,clutch:72,consistency:78,draftIQ:74}},
  {id:'p10',name:'Volt',       position:'jungle',tier:3,region:'NA',  traits:['Fragger','Playmaker'],   stats:{mechanics:65,laning:60,gameSense:68,teamfighting:72,communication:62,clutch:80,consistency:58,draftIQ:60}},
  {id:'p11',name:'Raptor',     position:'jungle',tier:3,region:'SEA', traits:['Mechanical','Fragger'],  stats:{mechanics:76,laning:60,gameSense:58,teamfighting:62,communication:52,clutch:74,consistency:48,draftIQ:56}},
  {id:'p12',name:'AncientOne', position:'jungle',tier:2,region:'SA',  traits:['Utility','Macro'],       stats:{mechanics:40,laning:38,gameSense:56,teamfighting:60,communication:64,clutch:40,consistency:58,draftIQ:50}},
  {id:'p13',name:'Phantom',    position:'mid',tier:5,region:'Korea',  traits:['Carry','Shotcaller'],    stats:{mechanics:98,laning:96,gameSense:99,teamfighting:96,communication:90,clutch:98,consistency:97,draftIQ:96}},
  {id:'p14',name:'Apex',       position:'mid',tier:5,region:'EU',     traits:['Carry','Macro'],         stats:{mechanics:88,laning:85,gameSense:94,teamfighting:88,communication:86,clutch:82,consistency:90,draftIQ:94}},
  {id:'p15',name:'Viper',      position:'mid',tier:4,region:'China',  traits:['Mechanical','Carry'],    stats:{mechanics:93,laning:82,gameSense:72,teamfighting:70,communication:62,clutch:88,consistency:66,draftIQ:72}},
  {id:'p16',name:'Nova',       position:'mid',tier:3,region:'NA',     traits:['Macro','Carry'],         stats:{mechanics:68,laning:65,gameSense:74,teamfighting:68,communication:65,clutch:62,consistency:72,draftIQ:74}},
  {id:'p17',name:'Specter',    position:'mid',tier:3,region:'Korea',  traits:['Mechanical','Fragger'],  stats:{mechanics:84,laning:74,gameSense:58,teamfighting:62,communication:50,clutch:82,consistency:48,draftIQ:56}},
  {id:'p18',name:'Blitz',      position:'mid',tier:2,region:'SA',     traits:['Carry','Utility'],       stats:{mechanics:48,laning:52,gameSense:50,teamfighting:48,communication:50,clutch:44,consistency:56,draftIQ:48}},
  {id:'p19',name:'Blaze',      position:'adc',tier:5,region:'Korea',  traits:['Carry','Mechanical'],    stats:{mechanics:96,laning:88,gameSense:86,teamfighting:95,communication:80,clutch:92,consistency:95,draftIQ:86}},
  {id:'p20',name:'Dragon',     position:'adc',tier:5,region:'China',  traits:['Carry','Fragger'],       stats:{mechanics:95,laning:92,gameSense:82,teamfighting:92,communication:74,clutch:88,consistency:90,draftIQ:82}},
  {id:'p21',name:'Valor',      position:'adc',tier:4,region:'EU',     traits:['Carry','Veteran'],       stats:{mechanics:80,laning:86,gameSense:78,teamfighting:78,communication:76,clutch:78,consistency:86,draftIQ:80}},
  {id:'p22',name:'Legend',     position:'adc',tier:4,region:'NA',     traits:['Carry','Playmaker'],     stats:{mechanics:78,laning:80,gameSense:76,teamfighting:74,communication:78,clutch:90,consistency:80,draftIQ:76}},
  {id:'p23',name:'Crest',      position:'adc',tier:3,region:'SA',     traits:['Fragger','Carry'],       stats:{mechanics:76,laning:82,gameSense:60,teamfighting:62,communication:54,clutch:74,consistency:54,draftIQ:58}},
  {id:'p24',name:'Flash',      position:'adc',tier:2,region:'SEA',    traits:['Carry','Utility'],       stats:{mechanics:48,laning:56,gameSense:52,teamfighting:50,communication:56,clutch:44,consistency:62,draftIQ:50}},
  {id:'p25',name:'Anchor',     position:'support',tier:4,region:'Korea',traits:['Utility','Playmaker'], stats:{mechanics:82,laning:74,gameSense:84,teamfighting:86,communication:92,clutch:82,consistency:84,draftIQ:84}},
  {id:'p26',name:'Oracle',     position:'support',tier:4,region:'EU',  traits:['Macro','Utility'],      stats:{mechanics:72,laning:78,gameSense:92,teamfighting:80,communication:88,clutch:70,consistency:86,draftIQ:90}},
  {id:'p27',name:'Monk',       position:'support',tier:4,region:'China',traits:['Utility','Macro'],     stats:{mechanics:70,laning:76,gameSense:82,teamfighting:84,communication:92,clutch:68,consistency:86,draftIQ:84}},
  {id:'p28',name:'Sage',       position:'support',tier:3,region:'NA',  traits:['Playmaker','Fragger'],  stats:{mechanics:70,laning:64,gameSense:68,teamfighting:70,communication:72,clutch:78,consistency:58,draftIQ:64}},
  {id:'p29',name:'Guardian',   position:'support',tier:2,region:'SEA', traits:['Utility','Veteran'],    stats:{mechanics:40,laning:48,gameSense:56,teamfighting:52,communication:66,clutch:40,consistency:62,draftIQ:52}},
  {id:'p30',name:'Shield',     position:'support',tier:2,region:'SA',  traits:['Utility','Veteran'],    stats:{mechanics:36,laning:44,gameSense:50,teamfighting:50,communication:62,clutch:38,consistency:60,draftIQ:48}},
];

// ─── Core simulation helpers ──────────────────────────────────────────────────
function rand(min,max){return Math.random()*(max-min)+min;}
function randInt(min,max){return Math.floor(rand(min,max+1));}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function chance(pct){return Math.random()*100<pct;}
function shuffleArray(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function statTotal(p){return Object.values(p.stats||{}).reduce((a,b)=>a+b,0);}

function getEffectiveStats(p){
  const mult=CONFIG.STAR_MULTIPLIER[p.stars]||1;
  const s={};
  for(const[k,v]of Object.entries(p.stats||{}))s[k]=Math.min(99,Math.round(v*mult));
  return s;
}

function calcTraitBonuses(roster){
  const counts={};
  roster.filter(Boolean).forEach(p=>(p.traits||[]).forEach(t=>{counts[t]=(counts[t]||0)+1;}));
  const bonuses={};
  for(const[trait,count]of Object.entries(counts)){
    const def=CONFIG.TRAITS[trait];
    if(!def)continue;
    let tier=-1;
    for(let i=def.thresholds.length-1;i>=0;i--){if(count>=def.thresholds[i]){tier=i;break;}}
    if(tier>=0)for(const[s,v]of Object.entries(def.bonuses[tier]))bonuses[s]=(bonuses[s]||0)+v;
  }
  return bonuses;
}

function calcRegionPct(roster){
  const counts={};
  roster.filter(Boolean).forEach(p=>{counts[p.region]=(counts[p.region]||0)+1;});
  const max=Math.max(0,...Object.values(counts));
  return max>=2?(CONFIG.REGION_SYNERGY[Math.min(max,5)]||{}).bonusPct||0:0;
}

const FILLER={mechanics:42,laning:42,gameSense:42,teamfighting:42,communication:42,clutch:42,consistency:42,draftIQ:42};

function calcTeamRatings(roster){
  const traitB=calcTraitBonuses(roster);
  const regPct=calcRegionPct(roster);
  const mult=1+regPct/100;
  const boosted=roster.map(p=>{
    const base=p?getEffectiveStats(p):{...FILLER};
    const s={};
    for(const[k,v]of Object.entries(base))s[k]=Math.min(99,Math.round((v+(traitB[k]||0))*mult));
    return s;
  });
  const avg=stat=>boosted.reduce((a,s)=>a+s[stat],0)/boosted.length;
  const jStats=boosted[1]||FILLER; // jungle index 1
  return{
    earlyRating: avg('laning')*0.45+avg('mechanics')*0.35+avg('gameSense')*0.20,
    jungleRating: jStats.gameSense*0.40+jStats.mechanics*0.40+jStats.laning*0.20,
    tfRating:    avg('teamfighting')*0.45+avg('mechanics')*0.30+avg('communication')*0.25,
    lateRating:  avg('gameSense')*0.40+avg('clutch')*0.35+avg('teamfighting')*0.25,
    consistency: avg('consistency'), clutch: avg('clutch'),
  };
}

function blueWinsEvent(bS,rS,bC,rC){
  const raw=clamp(50+(bS-rS)*0.5,15,85);
  const avgC=((bC||60)+(rC||60))/2/100;
  return chance(clamp(50+(raw-50)*(1.2-avgC*0.4),12,88));
}

function deriveStats(blueWins,adv){
  const winAdv=blueWins?adv:100-adv;
  const dom=clamp((winAdv-50)/50,0,1);
  const total=randInt(16,28)-Math.round(dom*4);
  const wShare=0.54+dom*0.24;
  const wKills=Math.round(total*wShare),lKills=total-wKills;
  const wTow=clamp(randInt(6,9)+Math.round(dom*2),5,11),lTow=clamp(randInt(0,3)-Math.round(dom*1.5),0,4);
  const wDrag=clamp(randInt(1,3)+Math.round(dom*1.5),1,4),lDrag=clamp(randInt(0,2)-Math.round(dom*0.8),0,2);
  const baron=dom>0.75?(chance(35)?0:1):dom<0.15?(chance(30)?2:1):1;
  const wBar=baron===0?0:Math.ceil(baron*0.75),lBar=baron-wBar;
  return blueWins
    ?{blue:{kills:wKills,towers:wTow,dragons:wDrag,barons:wBar},red:{kills:lKills,towers:lTow,dragons:lDrag,barons:lBar}}
    :{blue:{kills:lKills,towers:lTow,dragons:lDrag,barons:lBar},red:{kills:wKills,towers:wTow,dragons:wDrag,barons:wBar}};
}

function simMatch(blueRoster, redRoster){
  const padded=pos=>CONFIG.POSITIONS.map(p=>pos.find(x=>x&&x.position===p)||null);
  const blue=padded(blueRoster), red=padded(redRoster);
  const bR=calcTeamRatings(blue), rR=calcTeamRatings(red);
  let adv=50;

  // Laning
  adv=clamp(adv+(blueWinsEvent(bR.earlyRating,rR.earlyRating,bR.consistency,rR.consistency)?5:-5),5,95);
  adv=clamp(adv+(blueWinsEvent(bR.jungleRating,rR.jungleRating,bR.consistency,rR.consistency)?4:-4),5,95);
  adv=clamp(adv+(blueWinsEvent(bR.earlyRating,rR.earlyRating,bR.consistency,rR.consistency)?6:-6),5,95);
  if(adv>=85||adv<=15)return{winner:adv>=50?'blue':'red',stats:deriveStats(adv>=50,adv)};

  // Mid
  adv=clamp(adv+(blueWinsEvent(bR.tfRating,rR.tfRating,bR.consistency,rR.consistency)?4:-4),5,95);
  adv=clamp(adv+(blueWinsEvent(bR.jungleRating,rR.jungleRating,bR.consistency,rR.consistency)?3:-3),5,95);
  adv=clamp(adv+(blueWinsEvent(bR.tfRating,rR.tfRating,bR.consistency,rR.consistency)?6:-6),5,95);
  adv=clamp(adv+(blueWinsEvent(bR.lateRating,rR.lateRating,bR.consistency,rR.consistency)?5:-5),5,95);

  // Late
  adv=clamp(adv+(blueWinsEvent(bR.lateRating,rR.lateRating,bR.consistency,rR.consistency)?5:-5),5,95);
  adv=clamp(adv+(blueWinsEvent(bR.tfRating,rR.tfRating,bR.consistency,rR.consistency)?10:-10),5,95);
  // Clutch comeback
  const losingBlue=adv<50;
  const clutchCheck=losingBlue?bR.clutch:rR.clutch;
  if(chance(clamp((clutchCheck-60)*0.8,5,35)))adv=clamp(adv+(losingBlue?15:-15),5,95);
  adv=clamp(adv+(blueWinsEvent(bR.lateRating,rR.lateRating,bR.consistency,rR.consistency)?6:-6),5,95);

  const blueWins=adv>=50;
  return{winner:blueWins?'blue':'red',stats:deriveStats(blueWins,adv)};
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
function generateSchedule(n){
  function halfSchedule(n){
    const schedule=[],teams=Array.from({length:n},(_,i)=>i);
    for(let r=0;r<n-1;r++){
      const pairs=[];
      for(let i=0;i<n/2;i++)pairs.push([teams[i],teams[n-1-i]]);
      schedule.push(pairs);
      const last=teams.pop();teams.splice(1,0,last);
    }
    return schedule;
  }
  const half=halfSchedule(n);
  return[...half,...half.map(r=>r.map(([a,b])=>[b,a]))];
}

// ─── Simple AI team builder ───────────────────────────────────────────────────
const AI_STRATEGIES=['economy','synergy','aggressor','reroller','leveler'];
const AI_NAMES=['Team Nexus','Dragon Guard','Iron Vanguard','Shadow Protocol','Phoenix Rising','Storm Raiders','Void Walkers'];

function buildAITeam(name,strategy,round){
  // Build a roster scaled to the round (simulates buying over the season)
  const targetLevel=Math.min(5,1+Math.floor(round/3));
  const oddsForLevel=CONFIG.TIER_ODDS[targetLevel];

  const roster=CONFIG.POSITIONS.map(pos=>{
    const candidates=PLAYER_TEMPLATES.filter(p=>p.position===pos);
    // Pick tier based on odds weighted by strategy
    const stratBias={'aggressor':0.8,'leveler':0.7,'economy':0.5,'synergy':0.6,'reroller':0.4}[strategy]||0.6;
    const minTier=round<=3?2:round<=7?2:round<=10?3:4;
    const eligible=candidates.filter(p=>p.tier>=minTier).sort((a,b)=>b.tier-a.tier);
    const idx=chance(stratBias*100)?0:Math.min(eligible.length-1,randInt(0,Math.floor(eligible.length/2)));
    const template=eligible[idx]||candidates[0];
    return{...template,stats:{...template.stats},traits:[...template.traits],stars:1,instanceId:Math.random().toString(36).substr(2,6)};
  });

  return{name,strategy,roster,wins:0,losses:0,kills:0,deaths:0,winStreak:0,loseStreak:0};
}

// ─── Simulate a full season ───────────────────────────────────────────────────
function simulateSeason(){
  const schedule=generateSchedule(CONFIG.TOTAL_TEAMS);

  const allTeams=[
    {name:'Human',isHuman:true,strategy:'balanced',wins:0,losses:0,kills:0,deaths:0,winStreak:0,loseStreak:0},
    ...AI_NAMES.map((n,i)=>({name:n,strategy:AI_STRATEGIES[i%AI_STRATEGIES.length],isHuman:false,wins:0,losses:0,kills:0,deaths:0,winStreak:0,loseStreak:0}))
  ];

  // Human builds a simple "good" roster: 1 T5 per position where available, else T4
  function buildHumanRosterForRound(round){
    const level=Math.min(5,1+Math.floor(round/3));
    return CONFIG.POSITIONS.map(pos=>{
      const cands=PLAYER_TEMPLATES.filter(p=>p.position===pos).sort((a,b)=>b.tier-a.tier);
      const pick=cands.find(p=>p.tier>=Math.max(2,level-1))||cands[0];
      return{...pick,stats:{...pick.stats},traits:[...pick.traits],stars:1,instanceId:Math.random().toString(36).substr(2,6)};
    });
  }

  const seasonStats={kills:[],towers:[],dragons:[],barons:[],gameLengths:[]};
  const humanMatchResults=[];

  for(let round=1;round<=CONFIG.ROUND_ROBIN_ROUNDS;round++){
    const pairs=schedule[round-1]||[];
    pairs.forEach(([ai,bi])=>{
      const teamA=allTeams[ai], teamB=allTeams[bi];
      const isHumanMatch=ai===0||bi===0;

      let result;
      if(isHumanMatch){
        const humanRoster=buildHumanRosterForRound(round);
        const oppIdx=ai===0?bi:ai;
        const oppTeam=buildAITeam(allTeams[oppIdx].name,allTeams[oppIdx].strategy,round);
        const blueIsHuman=ai===0;
        result=simMatch(blueIsHuman?humanRoster:oppTeam.roster, blueIsHuman?oppTeam.roster:humanRoster);
        const humanWon=(result.winner==='blue')===blueIsHuman;
        humanMatchResults.push({round,humanWon,stats:result.stats});
      }else{
        const aRoster=buildAITeam(teamA.name,teamA.strategy,round).roster;
        const bRoster=buildAITeam(teamB.name,teamB.strategy,round).roster;
        result=simMatch(aRoster,bRoster);
      }

      const win=result.winner==='blue'?teamA:teamB;
      const lose=result.winner==='blue'?teamB:teamA;
      win.wins++;lose.losses++;
      win.kills+=result.stats.blue.kills;lose.kills+=result.stats.red.kills;
      win.deaths+=result.stats.red.kills;lose.deaths+=result.stats.blue.kills;
      win.winStreak=(win.winStreak||0)+1;win.loseStreak=0;
      lose.loseStreak=(lose.loseStreak||0)+1;lose.winStreak=0;

      // Collect stats
      const s=result.stats;
      seasonStats.kills.push(s.blue.kills+s.red.kills);
      seasonStats.towers.push(s.blue.towers+s.red.towers);
      seasonStats.dragons.push(s.blue.dragons+s.red.dragons);
      seasonStats.barons.push(s.blue.barons+s.red.barons);
    });
  }

  // Standings
  const standings=[...allTeams].sort((a,b)=>b.wins!==a.wins?b.wins-a.wins:(b.kills-b.deaths)-(a.kills-a.deaths));
  const humanPlace=standings.findIndex(t=>t.isHuman)+1;
  const humanInPlayoffs=humanPlace<=CONFIG.BRACKET_SIZE;
  const humanWins=allTeams[0].wins;
  const humanLosses=allTeams[0].losses;

  // Bracket sim (simplified)
  let humanResult='missed_playoffs';
  if(humanInPlayoffs){
    const top4=standings.slice(0,4);
    const humanSeed=top4.findIndex(t=>t.isHuman)+1;
    // Semi: 1v4, 2v3
    const semifinal=humanSeed===1||humanSeed===4?[top4[0],top4[3]]:[top4[1],top4[2]];
    const semiOpp=semifinal.find(t=>!t.isHuman);
    const semiRes=simMatch(buildHumanRosterForRound(14),buildAITeam(semiOpp.name,semiOpp.strategy,14).roster);
    const semiWon=semiRes.winner==='blue';
    if(!semiWon){humanResult='semifinalist';}
    else{
      // Final
      const otherSemi=humanSeed<=2?[top4[0],top4[3]]:[top4[1],top4[2]];
      const finalOppTeam=buildAITeam('Finalist','aggressor',14);
      const finalRes=simMatch(buildHumanRosterForRound(14),finalOppTeam.roster);
      humanResult=finalRes.winner==='blue'?'champion':'runner_up';
    }
  }

  return{humanWins,humanLosses,humanPlace,humanInPlayoffs,humanResult,seasonStats,humanMatchResults};
}

// ─── Run playtests ────────────────────────────────────────────────────────────
const ITERATIONS=parseInt(process.argv[2])||200;
console.log(`\n🎮 Rift Manager Playtest — ${ITERATIONS} season simulations\n${'─'.repeat(60)}`);

const results={outcomes:{champion:0,runner_up:0,semifinalist:0,missed_playoffs:0},placeTotals:0,winTotals:0,allKills:[],allTowers:[],allDragons:[],allBarons:[],humanWins:[]};

for(let i=0;i<ITERATIONS;i++){
  const r=simulateSeason();
  results.outcomes[r.humanResult]=(results.outcomes[r.humanResult]||0)+1;
  results.placeTotals+=r.humanPlace;
  results.winTotals+=r.humanWins;
  results.humanWins.push(r.humanWins);
  r.seasonStats.kills.forEach(k=>results.allKills.push(k));
  r.seasonStats.towers.forEach(t=>results.allTowers.push(t));
  r.seasonStats.dragons.forEach(d=>results.allDragons.push(d));
  r.seasonStats.barons.forEach(b=>results.allBarons.push(b));
}

const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
const minVal=arr=>arr.length?Math.min(...arr):0;
const maxVal=arr=>arr.length?Math.max(...arr):0;
const pct=(n,tot)=>`${((n/tot)*100).toFixed(1)}%`;

console.log('\n📊 PLAYER OUTCOMES (as human player):');
console.log(`  🏆 Champion:       ${pct(results.outcomes.champion||0,ITERATIONS)} (${results.outcomes.champion||0})`);
console.log(`  🥈 Runner-Up:      ${pct(results.outcomes.runner_up||0,ITERATIONS)} (${results.outcomes.runner_up||0})`);
console.log(`  🥉 Semifinalist:   ${pct(results.outcomes.semifinalist||0,ITERATIONS)} (${results.outcomes.semifinalist||0})`);
console.log(`  💀 Missed Playoffs:${pct(results.outcomes.missed_playoffs||0,ITERATIONS)} (${results.outcomes.missed_playoffs||0})`);
console.log(`  Playoffs rate:     ${pct((results.outcomes.champion||0)+(results.outcomes.runner_up||0)+(results.outcomes.semifinalist||0),ITERATIONS)}`);

console.log('\n📈 SEASON PERFORMANCE:');
console.log(`  Avg wins (14 rounds): ${avg(results.humanWins).toFixed(1)}`);
console.log(`  Win range:            ${minVal(results.humanWins)} – ${maxVal(results.humanWins)}`);
console.log(`  Avg final place:      ${(results.placeTotals/ITERATIONS).toFixed(1)} / 8`);

console.log('\n⚔️  MATCH STATS (per game, all teams):');
console.log(`  Total kills:  avg ${avg(results.allKills).toFixed(1)} (${minVal(results.allKills)}-${maxVal(results.allKills)})`);
console.log(`  Total towers: avg ${avg(results.allTowers).toFixed(1)} (${minVal(results.allTowers)}-${maxVal(results.allTowers)})`);
console.log(`  Total drakes: avg ${avg(results.allDragons).toFixed(1)} (${minVal(results.allDragons)}-${maxVal(results.allDragons)})`);
console.log(`  Total barons: avg ${avg(results.allBarons).toFixed(1)} (${minVal(results.allBarons)}-${maxVal(results.allBarons)})`);

// Kill distribution buckets
const killBuckets={low:0,normal:0,high:0};
results.allKills.forEach(k=>{if(k<14)killBuckets.low++;else if(k<=26)killBuckets.normal++;else killBuckets.high++;});
console.log(`  Kill dist:    low(<14): ${pct(killBuckets.low,results.allKills.length)} | normal(14-26): ${pct(killBuckets.normal,results.allKills.length)} | high(>26): ${pct(killBuckets.high,results.allKills.length)}`);

console.log('\n' + '─'.repeat(60));
console.log('Balance notes:');
if(avg(results.humanWins)<5)console.log('  ⚠️  Human win rate feels LOW — consider adjusting AI difficulty');
if(avg(results.humanWins)>9)console.log('  ⚠️  Human win rate feels HIGH — AI might be too weak');
if(avg(results.allKills)<14)console.log('  ⚠️  Kill counts too LOW — check simulation event weights');
if(avg(results.allKills)>28)console.log('  ⚠️  Kill counts too HIGH — reduce event kill generation');
if(avg(results.allBarons)>1.8)console.log('  ⚠️  Baron count HIGH — games running too long');
const playoffRate=((results.outcomes.champion||0)+(results.outcomes.runner_up||0)+(results.outcomes.semifinalist||0))/ITERATIONS;
if(playoffRate<0.35)console.log('  ⚠️  Playoff rate LOW — human may feel underpowered');
if(playoffRate>0.75)console.log('  ⚠️  Playoff rate HIGH — human may feel overpowered');
console.log('  ✅ Done\n');
