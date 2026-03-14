// js/data/teams.js — Verdant League team data
// The Verdant League (VL) is the premier professional circuit for The Ancient Grove.
// One region, 8 teams, 7-week round-robin Spring/Summer splits.

const TEAMS_DATA = [
  {
    id:'vs',  name:'Verdant Spire',   shortName:'VS',  color:'#2e7d32',
    rival:'ic', region:'VL', homeArena:'The Crown Canopy',
    budget:4200000, fans:1050000, prestige:10,
    playstyle:'engage',
  },
  {
    id:'ic',  name:'Iron Canopy',     shortName:'IC',  color:'#546e7a',
    rival:'vs', region:'VL', homeArena:'The Ironwood Arena',
    budget:3800000, fans:940000, prestige:9,
    playstyle:'poke',
  },
  {
    id:'pa',  name:'Pale Ascent',     shortName:'PA',  color:'#6a1b9a',
    rival:'tw', region:'VL', homeArena:'The Pale Summit',
    budget:2800000, fans:720000, prestige:7,
    playstyle:'scaling',
  },
  {
    id:'tw',  name:'Thornwall',       shortName:'TW',  color:'#e65100',
    rival:'pa', region:'VL', homeArena:'The Thornwall Coliseum',
    budget:2400000, fans:610000, prestige:6,
    playstyle:'splitpush',
  },
  {
    id:'dp',  name:'Dusk Protocol',   shortName:'DP',  color:'#00695c',
    rival:'ge', region:'VL', homeArena:'The Dusk Pavilion',
    budget:2100000, fans:530000, prestige:6,
    playstyle:'pick',
  },
  {
    id:'ge',  name:'Grove Enders',    shortName:'GE',  color:'#b71c1c',
    rival:'dp', region:'VL', homeArena:'The Grove Pit',
    budget:1700000, fans:420000, prestige:4,
    playstyle:'engage',
  },
  {
    id:'af',  name:'Ashfall',         shortName:'AF',  color:'#37474f',
    rival:'hc', region:'VL', homeArena:'The Ashfall Den',
    budget:1400000, fans:340000, prestige:3,
    playstyle:'poke',
  },
  {
    id:'hc',  name:'Hollow Crown',    shortName:'HC',  color:'#f57f17',
    rival:'af', region:'VL', homeArena:'The Hollow Arena',
    budget:1100000, fans:270000, prestige:2,
    playstyle:'engage',
  },
];
