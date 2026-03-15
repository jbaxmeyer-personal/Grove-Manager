// js/data/teams.js — Verdant League team data
// The Verdant League (VL) is the premier professional circuit for The Ancient Grove.
// One region, 8 teams, 7-week round-robin Spring/Summer splits.

const TEAMS_DATA = [
  {
    id:'vs',  name:'Verdant Spire',   shortName:'VS',  color:'#2e7d32',
    rival:'ic', region:'VL', homeArena:'The Crown Canopy',
    budget:4200000, fans:1050000, prestige:10,
    playstyle:'engage',
    sponsors: [
      { id:'s1', name:'GroveTech Gaming', weeklyIncome:120000, bonuses:[
        { id:'b1', condition:'wins_5',   label:'Win 5 matches', reward:200000, paid:false },
        { id:'b2', condition:'playoffs', label:'Reach playoffs', reward:350000, paid:false },
        { id:'b3', condition:'champion', label:'Win championship', reward:600000, paid:false },
      ]},
      { id:'s2', name:'Sylvane Energy', weeklyIncome:80000, bonuses:[
        { id:'b4', condition:'fans_500k', label:'500K fans', reward:250000, paid:false },
        { id:'b5', condition:'fans_1m',   label:'1M fans',   reward:400000, paid:false },
      ]},
    ],
  },
  {
    id:'ic',  name:'Iron Canopy',     shortName:'IC',  color:'#546e7a',
    rival:'vs', region:'VL', homeArena:'The Ironwood Arena',
    budget:3800000, fans:940000, prestige:9,
    playstyle:'poke',
    sponsors: [
      { id:'s1', name:'Ironwood Peripherals', weeklyIncome:100000, bonuses:[
        { id:'b1', condition:'wins_5',   label:'Win 5 matches', reward:180000, paid:false },
        { id:'b2', condition:'playoffs', label:'Reach playoffs', reward:300000, paid:false },
        { id:'b3', condition:'champion', label:'Win championship', reward:500000, paid:false },
      ]},
      { id:'s2', name:'StoneStream Media', weeklyIncome:65000, bonuses:[
        { id:'b4', condition:'fans_500k', label:'500K fans', reward:200000, paid:false },
      ]},
    ],
  },
  {
    id:'pa',  name:'Pale Ascent',     shortName:'PA',  color:'#6a1b9a',
    rival:'tw', region:'VL', homeArena:'The Pale Summit',
    budget:2800000, fans:720000, prestige:7,
    playstyle:'scaling',
    sponsors: [
      { id:'s1', name:'Pale Root Nutrition', weeklyIncome:70000, bonuses:[
        { id:'b1', condition:'wins_3',   label:'Win 3 matches', reward:120000, paid:false },
        { id:'b2', condition:'playoffs', label:'Reach playoffs', reward:220000, paid:false },
      ]},
    ],
  },
  {
    id:'tw',  name:'Thornwall',       shortName:'TW',  color:'#e65100',
    rival:'pa', region:'VL', homeArena:'The Thornwall Coliseum',
    budget:2400000, fans:610000, prestige:6,
    playstyle:'splitpush',
    sponsors: [
      { id:'s1', name:'Thornwall Hardware', weeklyIncome:55000, bonuses:[
        { id:'b1', condition:'wins_3',   label:'Win 3 matches', reward:100000, paid:false },
        { id:'b2', condition:'playoffs', label:'Reach playoffs', reward:180000, paid:false },
      ]},
    ],
  },
  {
    id:'dp',  name:'Dusk Protocol',   shortName:'DP',  color:'#00695c',
    rival:'ge', region:'VL', homeArena:'The Dusk Pavilion',
    budget:2100000, fans:530000, prestige:6,
    playstyle:'pick',
    sponsors: [
      { id:'s1', name:'Dusk Fiber', weeklyIncome:55000, bonuses:[
        { id:'b1', condition:'wins_3',   label:'Win 3 matches', reward:90000, paid:false },
      ]},
    ],
  },
  {
    id:'ge',  name:'Grove Enders',    shortName:'GE',  color:'#b71c1c',
    rival:'dp', region:'VL', homeArena:'The Grove Pit',
    budget:1700000, fans:420000, prestige:4,
    playstyle:'engage',
    sponsors: [
      { id:'s1', name:'Grove Snacks Co.', weeklyIncome:35000, bonuses:[
        { id:'b1', condition:'wins_3', label:'Win 3 matches', reward:70000, paid:false },
      ]},
    ],
  },
  {
    id:'af',  name:'Ashfall',         shortName:'AF',  color:'#37474f',
    rival:'hc', region:'VL', homeArena:'The Ashfall Den',
    budget:1400000, fans:340000, prestige:3,
    playstyle:'poke',
    sponsors: [
      { id:'s1', name:'Ashfall Apparel', weeklyIncome:25000, bonuses:[
        { id:'b1', condition:'wins_3', label:'Win 3 matches', reward:50000, paid:false },
      ]},
    ],
  },
  {
    id:'hc',  name:'Hollow Crown',    shortName:'HC',  color:'#f57f17',
    rival:'af', region:'VL', homeArena:'The Hollow Arena',
    budget:1100000, fans:270000, prestige:2,
    playstyle:'engage',
    sponsors: [
      { id:'s1', name:'Hollow Crown Fan Club', weeklyIncome:15000, bonuses:[
        { id:'b1', condition:'wins_3', label:'Win 3 matches', reward:30000, paid:false },
      ]},
    ],
  },
];
