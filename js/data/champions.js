// js/data/champions.js — Champion data with comp types

// compType determines team composition synergies
// ENGAGE: bonus teamfighting | POKE: bonus laning | ASSASSIN: bonus early kills
// PROTECT: bonus ADC effectiveness | SPLITPUSH: bonus towers | SCALING: bonus late game

const CHAMPIONS = {
  // MID LANERS
  'Azir':          { compType: 'SCALING',   role: 'mid' },
  'Orianna':       { compType: 'ENGAGE',    role: 'mid' },
  'Viktor':        { compType: 'POKE',      role: 'mid' },
  'Syndra':        { compType: 'POKE',      role: 'mid' },
  'Cassiopeia':    { compType: 'SCALING',   role: 'mid' },
  'Zoe':           { compType: 'POKE',      role: 'mid' },
  'LeBlanc':       { compType: 'ASSASSIN',  role: 'mid' },
  'Akali':         { compType: 'ASSASSIN',  role: 'mid' },
  'Zed':           { compType: 'ASSASSIN',  role: 'mid' },
  'Yasuo':         { compType: 'ENGAGE',    role: 'mid' },
  'Corki':         { compType: 'POKE',      role: 'mid' },
  'Twisted Fate':  { compType: 'POKE',      role: 'mid' },
  'Ryze':          { compType: 'SCALING',   role: 'mid' },
  'Lux':           { compType: 'POKE',      role: 'mid' },
  'Vex':           { compType: 'POKE',      role: 'mid' },
  'Annie':         { compType: 'ENGAGE',    role: 'mid' },

  // TOP LANERS
  'Renekton':      { compType: 'ENGAGE',    role: 'top' },
  'Camille':       { compType: 'SPLITPUSH', role: 'top' },
  'Gnar':          { compType: 'ENGAGE',    role: 'top' },
  'Jayce':         { compType: 'POKE',      role: 'top' },
  'Fiora':         { compType: 'SPLITPUSH', role: 'top' },
  'Irelia':        { compType: 'SPLITPUSH', role: 'top' },
  'Riven':         { compType: 'SPLITPUSH', role: 'top' },
  'Darius':        { compType: 'ENGAGE',    role: 'top' },
  'Malphite':      { compType: 'ENGAGE',    role: 'top' },
  'Ornn':          { compType: 'ENGAGE',    role: 'top' },
  'Garen':         { compType: 'ENGAGE',    role: 'top' },
  'Wukong':        { compType: 'ENGAGE',    role: 'top' },
  'Mordekaiser':   { compType: 'SCALING',   role: 'top' },
  'Nasus':         { compType: 'SCALING',   role: 'top' },
  'Pantheon':      { compType: 'ENGAGE',    role: 'top' },
  'Quinn':         { compType: 'SPLITPUSH', role: 'top' },

  // JUNGLERS
  'Lee Sin':       { compType: 'ASSASSIN',  role: 'jungle' },
  "Rek'Sai":       { compType: 'ENGAGE',    role: 'jungle' },
  'Nidalee':       { compType: 'POKE',      role: 'jungle' },
  'Elise':         { compType: 'ASSASSIN',  role: 'jungle' },
  'Evelynn':       { compType: 'ASSASSIN',  role: 'jungle' },
  'Hecarim':       { compType: 'ENGAGE',    role: 'jungle' },
  'Jarvan IV':     { compType: 'ENGAGE',    role: 'jungle' },
  'Vi':            { compType: 'ENGAGE',    role: 'jungle' },
  'Xin Zhao':      { compType: 'ENGAGE',    role: 'jungle' },
  'Olaf':          { compType: 'ENGAGE',    role: 'jungle' },
  "Kha'Zix":       { compType: 'ASSASSIN',  role: 'jungle' },
  'Rengar':        { compType: 'ASSASSIN',  role: 'jungle' },
  'Amumu':         { compType: 'ENGAGE',    role: 'jungle' },
  'Sejuani':       { compType: 'ENGAGE',    role: 'jungle' },
  'Zac':           { compType: 'ENGAGE',    role: 'jungle' },
  'Graves':        { compType: 'POKE',      role: 'jungle' },

  // ADC
  'Jinx':          { compType: 'SCALING',   role: 'adc' },
  'Jhin':          { compType: 'POKE',      role: 'adc' },
  'Caitlyn':       { compType: 'POKE',      role: 'adc' },
  'Aphelios':      { compType: 'SCALING',   role: 'adc' },
  'Kalista':       { compType: 'ENGAGE',    role: 'adc' },
  "Kai'Sa":        { compType: 'SCALING',   role: 'adc' },
  'Miss Fortune':  { compType: 'ENGAGE',    role: 'adc' },
  'Tristana':      { compType: 'SPLITPUSH', role: 'adc' },
  'Ezreal':        { compType: 'POKE',      role: 'adc' },
  'Draven':        { compType: 'ENGAGE',    role: 'adc' },
  'Lucian':        { compType: 'POKE',      role: 'adc' },
  'Xayah':         { compType: 'PROTECT',   role: 'adc' },
  'Sivir':         { compType: 'ENGAGE',    role: 'adc' },
  'Ashe':          { compType: 'POKE',      role: 'adc' },

  // SUPPORT
  'Thresh':        { compType: 'ENGAGE',    role: 'support' },
  'Nautilus':      { compType: 'ENGAGE',    role: 'support' },
  'Blitzcrank':    { compType: 'ENGAGE',    role: 'support' },
  'Lulu':          { compType: 'PROTECT',   role: 'support' },
  'Soraka':        { compType: 'PROTECT',   role: 'support' },
  'Janna':         { compType: 'PROTECT',   role: 'support' },
  'Nami':          { compType: 'POKE',      role: 'support' },
  'Karma':         { compType: 'POKE',      role: 'support' },
  'Yuumi':         { compType: 'PROTECT',   role: 'support' },
  'Pyke':          { compType: 'ASSASSIN',  role: 'support' },
  'Leona':         { compType: 'ENGAGE',    role: 'support' },
  'Braum':         { compType: 'PROTECT',   role: 'support' },
};

// Comp synergy bonuses applied when 3+ champions on a team share a compType
const COMP_SYNERGIES = {
  ENGAGE:    { name: 'Engage Comp',     bonus: { teamfighting: 15, clutch: 5 },  desc: '+15% Teamfighting' },
  POKE:      { name: 'Poke Comp',       bonus: { laning: 12, gameSense: 5 },     desc: '+12% Laning' },
  ASSASSIN:  { name: 'Pick Comp',       bonus: { mechanics: 10, clutch: 10 },    desc: '+10% Mechanics & Clutch' },
  PROTECT:   { name: 'Protect the ADC', bonus: { teamfighting: 10, consistency: 10 }, desc: '+10% TF & Consistency' },
  SPLITPUSH: { name: 'Splitpush Comp',  bonus: { laning: 8, mechanics: 8 },      desc: '+8% Laning & Mechanics' },
  SCALING:   { name: 'Scaling Comp',    bonus: { gameSense: 8, teamfighting: 8 }, desc: '+8% GS & Teamfighting' },
};

function getCompType(team) {
  // Count comp types across all champions on a team
  const counts = {};
  team.forEach(player => {
    if (!player || !player.champion) return;
    const champ = CHAMPIONS[player.champion];
    if (!champ) return;
    counts[champ.compType] = (counts[champ.compType] || 0) + 1;
  });
  // Find dominant comp type (3+ threshold)
  for (const [type, count] of Object.entries(counts)) {
    if (count >= 3) return type;
  }
  return null;
}
