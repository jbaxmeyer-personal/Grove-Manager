// js/data/players.js — 30 fake pro players with traits

// Stats: mechanics, laning, gameSense, teamfighting, communication, clutch, consistency, draftIQ
// Traits: 2 per player from CONFIG.TRAITS keys
// Regions: Korea, China, EU, NA, SEA, SA

const PLAYER_TEMPLATES = [

  // ─── TOP LANERS ───────────────────────────────────────────────
  {
    id: 'p01', name: 'IronKing', position: 'top', tier: 5, region: 'Korea',
    champions: ['Renekton', 'Camille', 'Gnar'],
    traits: ['Carry', 'Mechanical'],
    bio: 'Dominant lane bully, world-class mechanics and laning.',
    stats: { mechanics:88, laning:96, gameSense:82, teamfighting:80, communication:75, clutch:88, consistency:92, draftIQ:82 }
  },
  {
    id: 'p02', name: 'Fortress', position: 'top', tier: 4, region: 'EU',
    champions: ['Jayce', 'Gnar', 'Fiora'],
    traits: ['Macro', 'Veteran'],
    bio: 'Smart, versatile top laner with elite game sense.',
    stats: { mechanics:78, laning:80, gameSense:86, teamfighting:74, communication:80, clutch:72, consistency:84, draftIQ:90 }
  },
  {
    id: 'p03', name: 'Summit', position: 'top', tier: 4, region: 'NA',
    champions: ['Irelia', 'Riven', 'Fiora'],
    traits: ['Mechanical', 'Playmaker'],
    bio: 'Mechanical god with incredible individual outplay potential.',
    stats: { mechanics:92, laning:84, gameSense:66, teamfighting:68, communication:60, clutch:94, consistency:64, draftIQ:68 }
  },
  {
    id: 'p04', name: 'DragonFist', position: 'top', tier: 4, region: 'China',
    champions: ['Renekton', 'Wukong', 'Darius'],
    traits: ['Fragger', 'Carry'],
    bio: 'Aggressive teamfighter who loves to initiate.',
    stats: { mechanics:75, laning:80, gameSense:75, teamfighting:90, communication:80, clutch:72, consistency:78, draftIQ:72 }
  },
  {
    id: 'p05', name: 'Colossus', position: 'top', tier: 2, region: 'SEA',
    champions: ['Malphite', 'Ornn', 'Garen'],
    traits: ['Utility', 'Veteran'],
    bio: 'Reliable tank specialist, great for engage comps.',
    stats: { mechanics:44, laning:48, gameSense:56, teamfighting:58, communication:66, clutch:44, consistency:60, draftIQ:52 }
  },
  {
    id: 'p06', name: 'Vanguard', position: 'top', tier: 2, region: 'SA',
    champions: ['Garen', 'Nasus', 'Mordekaiser'],
    traits: ['Veteran', 'Utility'],
    bio: 'Consistent player with improving game sense.',
    stats: { mechanics:40, laning:50, gameSense:52, teamfighting:55, communication:56, clutch:42, consistency:64, draftIQ:48 }
  },

  // ─── JUNGLERS ─────────────────────────────────────────────────
  {
    id: 'p07', name: 'PhantomStep', position: 'jungle', tier: 5, region: 'Korea',
    champions: ['Lee Sin', "Rek'Sai", 'Nidalee'],
    traits: ['Mechanical', 'Playmaker'],
    bio: 'The most mechanically gifted jungler in the world.',
    stats: { mechanics:96, laning:84, gameSense:94, teamfighting:86, communication:82, clutch:92, consistency:86, draftIQ:90 }
  },
  {
    id: 'p08', name: 'WildCard', position: 'jungle', tier: 4, region: 'EU',
    champions: ['Elise', 'Evelynn', 'Hecarim'],
    traits: ['Playmaker', 'Fragger'],
    bio: 'Unpredictable, high-impact carry jungler.',
    stats: { mechanics:84, laning:70, gameSense:80, teamfighting:78, communication:68, clutch:86, consistency:64, draftIQ:76 }
  },
  {
    id: 'p09', name: 'Cyclone', position: 'jungle', tier: 4, region: 'China',
    champions: ['Jarvan IV', 'Vi', 'Xin Zhao'],
    traits: ['Fragger', 'Utility'],
    bio: 'Teamfight-focused jungler who excels at five-man engages.',
    stats: { mechanics:74, laning:68, gameSense:80, teamfighting:92, communication:84, clutch:72, consistency:78, draftIQ:74 }
  },
  {
    id: 'p10', name: 'Volt', position: 'jungle', tier: 3, region: 'NA',
    champions: ['Olaf', 'Vi', 'Jarvan IV'],
    traits: ['Fragger', 'Playmaker'],
    bio: 'Aggressive win-condition jungler with high clutch.',
    stats: { mechanics:65, laning:60, gameSense:68, teamfighting:72, communication:62, clutch:80, consistency:58, draftIQ:60 }
  },
  {
    id: 'p11', name: 'Raptor', position: 'jungle', tier: 3, region: 'SEA',
    champions: ['Lee Sin', "Kha'Zix", 'Rengar'],
    traits: ['Mechanical', 'Fragger'],
    bio: 'High-mechanical assassin jungler, feast or famine.',
    stats: { mechanics:76, laning:60, gameSense:58, teamfighting:62, communication:52, clutch:74, consistency:48, draftIQ:56 }
  },
  {
    id: 'p12', name: 'AncientOne', position: 'jungle', tier: 2, region: 'SA',
    champions: ['Amumu', 'Sejuani', 'Zac'],
    traits: ['Utility', 'Macro'],
    bio: 'Reliable engage jungler, brings the team together.',
    stats: { mechanics:40, laning:38, gameSense:56, teamfighting:60, communication:64, clutch:40, consistency:58, draftIQ:50 }
  },

  // ─── MID LANERS ───────────────────────────────────────────────
  {
    id: 'p13', name: 'Phantom', position: 'mid', tier: 5, region: 'Korea',
    champions: ['Azir', 'Orianna', 'Viktor'],
    traits: ['Carry', 'Shotcaller'],
    bio: 'Widely considered the greatest LoL player of all time.',
    stats: { mechanics:98, laning:96, gameSense:99, teamfighting:96, communication:90, clutch:98, consistency:97, draftIQ:96 }
  },
  {
    id: 'p14', name: 'Apex', position: 'mid', tier: 5, region: 'EU',
    champions: ['Syndra', 'Azir', 'Cassiopeia'],
    traits: ['Carry', 'Macro'],
    bio: 'World-class mid laner with unrivaled game sense.',
    stats: { mechanics:88, laning:85, gameSense:94, teamfighting:88, communication:86, clutch:82, consistency:90, draftIQ:94 }
  },
  {
    id: 'p15', name: 'Viper', position: 'mid', tier: 4, region: 'China',
    champions: ['Zoe', 'LeBlanc', 'Akali'],
    traits: ['Mechanical', 'Carry'],
    bio: 'Flashy mechanical outplay machine.',
    stats: { mechanics:93, laning:82, gameSense:72, teamfighting:70, communication:62, clutch:88, consistency:66, draftIQ:72 }
  },
  {
    id: 'p16', name: 'Nova', position: 'mid', tier: 3, region: 'NA',
    champions: ['Viktor', 'Orianna', 'Syndra'],
    traits: ['Macro', 'Carry'],
    bio: 'Solid mid laner with good fundamentals.',
    stats: { mechanics:68, laning:65, gameSense:74, teamfighting:68, communication:65, clutch:62, consistency:72, draftIQ:74 }
  },
  {
    id: 'p17', name: 'Specter', position: 'mid', tier: 3, region: 'Korea',
    champions: ['Zed', 'Yasuo', 'Akali'],
    traits: ['Mechanical', 'Fragger'],
    bio: 'Mechanical assassin with inconsistent performances.',
    stats: { mechanics:84, laning:74, gameSense:58, teamfighting:62, communication:50, clutch:82, consistency:48, draftIQ:56 }
  },
  {
    id: 'p18', name: 'Blitz', position: 'mid', tier: 2, region: 'SA',
    champions: ['Lux', 'Vex', 'Annie'],
    traits: ['Carry', 'Utility'],
    bio: 'Up-and-coming talent with room to grow.',
    stats: { mechanics:48, laning:52, gameSense:50, teamfighting:48, communication:50, clutch:44, consistency:56, draftIQ:48 }
  },

  // ─── ADC ──────────────────────────────────────────────────────
  {
    id: 'p19', name: 'Blaze', position: 'adc', tier: 5, region: 'Korea',
    champions: ['Jinx', 'Jhin', 'Aphelios'],
    traits: ['Carry', 'Mechanical'],
    bio: 'Perfect mechanics and positioning — a god-tier ADC.',
    stats: { mechanics:96, laning:88, gameSense:86, teamfighting:95, communication:80, clutch:92, consistency:95, draftIQ:86 }
  },
  {
    id: 'p20', name: 'Dragon', position: 'adc', tier: 5, region: 'China',
    champions: ['Jinx', 'Kalista', 'Aphelios'],
    traits: ['Carry', 'Fragger'],
    bio: 'The most mechanically gifted ADC in China.',
    stats: { mechanics:95, laning:92, gameSense:82, teamfighting:92, communication:74, clutch:88, consistency:90, draftIQ:82 }
  },
  {
    id: 'p21', name: 'Valor', position: 'adc', tier: 4, region: 'EU',
    champions: ['Jhin', 'Miss Fortune', "Kai'Sa"],
    traits: ['Carry', 'Veteran'],
    bio: 'Stylish ADC with great laning and experience.',
    stats: { mechanics:80, laning:86, gameSense:78, teamfighting:78, communication:76, clutch:78, consistency:86, draftIQ:80 }
  },
  {
    id: 'p22', name: 'Legend', position: 'adc', tier: 4, region: 'NA',
    champions: ['Tristana', 'Ezreal', 'Xayah'],
    traits: ['Carry', 'Playmaker'],
    bio: 'Veteran ADC with incredible clutch factor.',
    stats: { mechanics:78, laning:80, gameSense:76, teamfighting:74, communication:78, clutch:90, consistency:80, draftIQ:76 }
  },
  {
    id: 'p23', name: 'Crest', position: 'adc', tier: 3, region: 'SA',
    champions: ['Draven', 'Lucian', 'Jinx'],
    traits: ['Fragger', 'Carry'],
    bio: 'Aggressive lane bully who dominates early game.',
    stats: { mechanics:76, laning:82, gameSense:60, teamfighting:62, communication:54, clutch:74, consistency:54, draftIQ:58 }
  },
  {
    id: 'p24', name: 'Flash', position: 'adc', tier: 2, region: 'SEA',
    champions: ['Caitlyn', 'Sivir', 'Ashe'],
    traits: ['Carry', 'Utility'],
    bio: 'Safe, scaling ADC who relies on his support.',
    stats: { mechanics:48, laning:56, gameSense:52, teamfighting:50, communication:56, clutch:44, consistency:62, draftIQ:50 }
  },

  // ─── SUPPORT ──────────────────────────────────────────────────
  {
    id: 'p25', name: 'Anchor', position: 'support', tier: 4, region: 'Korea',
    champions: ['Thresh', 'Nautilus', 'Blitzcrank'],
    traits: ['Utility', 'Playmaker'],
    bio: 'World-class playmaker with incredible hook accuracy.',
    stats: { mechanics:82, laning:74, gameSense:84, teamfighting:86, communication:92, clutch:82, consistency:84, draftIQ:84 }
  },
  {
    id: 'p26', name: 'Oracle', position: 'support', tier: 4, region: 'EU',
    champions: ['Thresh', 'Soraka', 'Lulu'],
    traits: ['Macro', 'Utility'],
    bio: 'Vision control master with elite game sense.',
    stats: { mechanics:72, laning:78, gameSense:92, teamfighting:80, communication:88, clutch:70, consistency:86, draftIQ:90 }
  },
  {
    id: 'p27', name: 'Monk', position: 'support', tier: 4, region: 'China',
    champions: ['Karma', 'Lulu', 'Yuumi'],
    traits: ['Utility', 'Macro'],
    bio: 'Enchanter specialist who amplifies his ADC.',
    stats: { mechanics:70, laning:76, gameSense:82, teamfighting:84, communication:92, clutch:68, consistency:86, draftIQ:84 }
  },
  {
    id: 'p28', name: 'Sage', position: 'support', tier: 3, region: 'NA',
    champions: ['Thresh', 'Blitzcrank', 'Pyke'],
    traits: ['Playmaker', 'Fragger'],
    bio: 'Hook-reliant support who lives for flashy plays.',
    stats: { mechanics:70, laning:64, gameSense:68, teamfighting:70, communication:72, clutch:78, consistency:58, draftIQ:64 }
  },
  {
    id: 'p29', name: 'Guardian', position: 'support', tier: 2, region: 'SEA',
    champions: ['Soraka', 'Janna', 'Nami'],
    traits: ['Utility', 'Veteran'],
    bio: 'Passive healer who keeps his team alive.',
    stats: { mechanics:40, laning:48, gameSense:56, teamfighting:52, communication:66, clutch:40, consistency:62, draftIQ:52 }
  },
  {
    id: 'p30', name: 'Shield', position: 'support', tier: 2, region: 'SA',
    champions: ['Lulu', 'Soraka', 'Braum'],
    traits: ['Utility', 'Veteran'],
    bio: 'Developing enchanter with potential to grow.',
    stats: { mechanics:36, laning:44, gameSense:50, teamfighting:50, communication:62, clutch:38, consistency:60, draftIQ:48 }
  },
];

// Build the player pool: each player repeated by tier pool size
function buildPlayerPool() {
  const pool = [];
  PLAYER_TEMPLATES.forEach(p => {
    const copies = CONFIG.TIER_POOL_SIZE[p.tier];
    for (let i = 0; i < copies; i++) {
      pool.push({ ...p, stats: { ...p.stats }, champions: [...p.champions], traits: [...p.traits] });
    }
  });
  return pool;
}

function getPlayerTemplate(id) {
  return PLAYER_TEMPLATES.find(p => p.id === id);
}

function createPlayerInstance(template) {
  return {
    ...template,
    stats:    { ...template.stats },
    champions: [...template.champions],
    traits:   [...(template.traits || [])],
    stars:    1,
    instanceId: Math.random().toString(36).substr(2, 9),
    champion: null,
  };
}

// Get effective stats accounting for star level
function getEffectiveStats(player) {
  const mult = CONFIG.STAR_MULTIPLIER[player.stars] || 1;
  const s = {};
  for (const [k, v] of Object.entries(player.stats)) {
    s[k] = Math.min(99, Math.round(v * mult));
  }
  return s;
}

function statTotal(player) {
  return Object.values(player.stats || {}).reduce((a, b) => a + b, 0);
}
