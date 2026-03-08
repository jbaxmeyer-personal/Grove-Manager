// js/data/players.js — 30 fake pro players

// Stats: mechanics, laning, gameSense, teamfighting, communication, clutch, consistency, draftIQ
// All stats roughly 35-99. Tier determines overall quality.
// Regions: Korea, China, EU, NA, SEA, SA

const PLAYER_TEMPLATES = [

  // ─── TOP LANERS ───────────────────────────────────────────────────────────
  {
    id: 'p01', name: 'IronKing', position: 'top', tier: 5, region: 'Korea',
    champions: ['Renekton', 'Camille', 'Gnar'],
    bio: 'Dominant lane bully known for his oppressive early game.',
    stats: { mechanics:88, laning:96, gameSense:82, teamfighting:80, communication:75, clutch:88, consistency:92, draftIQ:82 }
  },
  {
    id: 'p02', name: 'Fortress', position: 'top', tier: 4, region: 'EU',
    champions: ['Jayce', 'Gnar', 'Fiora'],
    bio: 'Smart, versatile top laner with elite game sense.',
    stats: { mechanics:78, laning:80, gameSense:85, teamfighting:75, communication:80, clutch:74, consistency:82, draftIQ:88 }
  },
  {
    id: 'p03', name: 'Summit', position: 'top', tier: 4, region: 'NA',
    champions: ['Irelia', 'Riven', 'Fiora'],
    bio: 'Mechanical god with incredible individual outplay potential.',
    stats: { mechanics:90, laning:84, gameSense:68, teamfighting:70, communication:62, clutch:92, consistency:68, draftIQ:70 }
  },
  {
    id: 'p04', name: 'DragonFist', position: 'top', tier: 4, region: 'China',
    champions: ['Renekton', 'Wukong', 'Darius'],
    bio: 'Aggressive teamfighter who loves to initiate.',
    stats: { mechanics:75, laning:78, gameSense:76, teamfighting:88, communication:80, clutch:72, consistency:80, draftIQ:72 }
  },
  {
    id: 'p05', name: 'Colossus', position: 'top', tier: 2, region: 'SEA',
    champions: ['Malphite', 'Ornn', 'Garen'],
    bio: 'Reliable tank specialist, great for engage.',
    stats: { mechanics:44, laning:48, gameSense:56, teamfighting:58, communication:65, clutch:44, consistency:60, draftIQ:52 }
  },
  {
    id: 'p06', name: 'Vanguard', position: 'top', tier: 2, region: 'SA',
    champions: ['Garen', 'Nasus', 'Mordekaiser'],
    bio: 'Simple but consistent player with improving game sense.',
    stats: { mechanics:40, laning:50, gameSense:52, teamfighting:55, communication:55, clutch:42, consistency:62, draftIQ:48 }
  },

  // ─── JUNGLERS ─────────────────────────────────────────────────────────────
  {
    id: 'p07', name: 'PhantomStep', position: 'jungle', tier: 5, region: 'Korea',
    champions: ['Lee Sin', "Rek'Sai", 'Nidalee'],
    bio: 'The most mechanically gifted jungler in the world.',
    stats: { mechanics:96, laning:84, gameSense:94, teamfighting:86, communication:82, clutch:92, consistency:86, draftIQ:90 }
  },
  {
    id: 'p08', name: 'WildCard', position: 'jungle', tier: 4, region: 'EU',
    champions: ['Elise', 'Evelynn', 'Hecarim'],
    bio: 'Unpredictable, high-impact carry jungler.',
    stats: { mechanics:84, laning:70, gameSense:80, teamfighting:78, communication:70, clutch:84, consistency:66, draftIQ:76 }
  },
  {
    id: 'p09', name: 'Cyclone', position: 'jungle', tier: 4, region: 'China',
    champions: ['Jarvan IV', 'Vi', 'Xin Zhao'],
    bio: 'Teamfight-focused jungler who excels at five-man engages.',
    stats: { mechanics:74, laning:68, gameSense:80, teamfighting:90, communication:82, clutch:72, consistency:78, draftIQ:74 }
  },
  {
    id: 'p10', name: 'Volt', position: 'jungle', tier: 3, region: 'NA',
    champions: ['Olaf', 'Vi', 'Jarvan IV'],
    bio: 'Aggressive win-condition jungler with high clutch.',
    stats: { mechanics:65, laning:60, gameSense:68, teamfighting:72, communication:62, clutch:78, consistency:60, draftIQ:60 }
  },
  {
    id: 'p11', name: 'Raptor', position: 'jungle', tier: 3, region: 'SEA',
    champions: ['Lee Sin', "Kha'Zix", 'Rengar'],
    bio: 'High-mechanical assassin jungler, feast or famine.',
    stats: { mechanics:74, laning:60, gameSense:60, teamfighting:64, communication:54, clutch:72, consistency:52, draftIQ:58 }
  },
  {
    id: 'p12', name: 'AncientOne', position: 'jungle', tier: 2, region: 'SA',
    champions: ['Amumu', 'Sejuani', 'Zac'],
    bio: 'Reliable engage jungler, brings the team together.',
    stats: { mechanics:40, laning:38, gameSense:56, teamfighting:60, communication:62, clutch:40, consistency:58, draftIQ:50 }
  },

  // ─── MID LANERS ───────────────────────────────────────────────────────────
  {
    id: 'p13', name: 'Phantom', position: 'mid', tier: 5, region: 'Korea',
    champions: ['Azir', 'Orianna', 'Viktor'],
    bio: 'Widely considered the greatest LoL player of all time.',
    stats: { mechanics:98, laning:96, gameSense:99, teamfighting:96, communication:90, clutch:98, consistency:97, draftIQ:96 }
  },
  {
    id: 'p14', name: 'Apex', position: 'mid', tier: 5, region: 'EU',
    champions: ['Syndra', 'Azir', 'Cassiopeia'],
    bio: 'World-class mid laner with unrivaled game sense.',
    stats: { mechanics:88, laning:85, gameSense:94, teamfighting:88, communication:86, clutch:82, consistency:90, draftIQ:94 }
  },
  {
    id: 'p15', name: 'Viper', position: 'mid', tier: 4, region: 'China',
    champions: ['Zoe', 'LeBlanc', 'Akali'],
    bio: 'Flashy mechanical outplay machine from China.',
    stats: { mechanics:92, laning:82, gameSense:74, teamfighting:70, communication:65, clutch:87, consistency:68, draftIQ:74 }
  },
  {
    id: 'p16', name: 'Nova', position: 'mid', tier: 3, region: 'NA',
    champions: ['Viktor', 'Orianna', 'Syndra'],
    bio: 'Solid mid laner with good fundamentals.',
    stats: { mechanics:68, laning:65, gameSense:72, teamfighting:68, communication:65, clutch:62, consistency:70, draftIQ:72 }
  },
  {
    id: 'p17', name: 'Specter', position: 'mid', tier: 3, region: 'Korea',
    champions: ['Zed', 'Yasuo', 'Akali'],
    bio: 'Mechanical assassin with inconsistent performances.',
    stats: { mechanics:82, laning:74, gameSense:60, teamfighting:64, communication:52, clutch:80, consistency:50, draftIQ:58 }
  },
  {
    id: 'p18', name: 'Blitz', position: 'mid', tier: 2, region: 'SA',
    champions: ['Lux', 'Vex', 'Annie'],
    bio: 'Up-and-coming talent with room to grow.',
    stats: { mechanics:48, laning:52, gameSense:50, teamfighting:48, communication:50, clutch:44, consistency:55, draftIQ:48 }
  },

  // ─── ADC ──────────────────────────────────────────────────────────────────
  {
    id: 'p19', name: 'Blaze', position: 'adc', tier: 5, region: 'Korea',
    champions: ['Jinx', 'Jhin', 'Aphelios'],
    bio: 'Perfect mechanics and positioning — a god-tier ADC.',
    stats: { mechanics:96, laning:88, gameSense:86, teamfighting:95, communication:80, clutch:92, consistency:95, draftIQ:86 }
  },
  {
    id: 'p20', name: 'Dragon', position: 'adc', tier: 5, region: 'China',
    champions: ['Jinx', 'Kalista', 'Aphelios'],
    bio: 'The most mechanically gifted ADC in China.',
    stats: { mechanics:95, laning:92, gameSense:82, teamfighting:92, communication:74, clutch:88, consistency:90, draftIQ:82 }
  },
  {
    id: 'p21', name: 'Valor', position: 'adc', tier: 4, region: 'EU',
    champions: ['Jhin', 'Miss Fortune', "Kai'Sa"],
    bio: 'Stylish ADC with great laning and game sense.',
    stats: { mechanics:80, laning:86, gameSense:78, teamfighting:78, communication:76, clutch:78, consistency:84, draftIQ:80 }
  },
  {
    id: 'p22', name: 'Legend', position: 'adc', tier: 4, region: 'NA',
    champions: ['Tristana', 'Ezreal', 'Xayah'],
    bio: 'Veteran ADC with incredible clutch factor.',
    stats: { mechanics:78, laning:80, gameSense:76, teamfighting:74, communication:78, clutch:88, consistency:80, draftIQ:76 }
  },
  {
    id: 'p23', name: 'Crest', position: 'adc', tier: 3, region: 'SA',
    champions: ['Draven', 'Lucian', 'Jinx'],
    bio: 'Aggressive lane bully who dominates early game.',
    stats: { mechanics:76, laning:80, gameSense:60, teamfighting:64, communication:56, clutch:72, consistency:56, draftIQ:58 }
  },
  {
    id: 'p24', name: 'Flash', position: 'adc', tier: 2, region: 'SEA',
    champions: ['Caitlyn', 'Sivir', 'Ashe'],
    bio: 'Safe, scaling ADC who relies on his support.',
    stats: { mechanics:48, laning:56, gameSense:52, teamfighting:50, communication:56, clutch:44, consistency:60, draftIQ:50 }
  },

  // ─── SUPPORT ──────────────────────────────────────────────────────────────
  {
    id: 'p25', name: 'Anchor', position: 'support', tier: 4, region: 'Korea',
    champions: ['Thresh', 'Nautilus', 'Blitzcrank'],
    bio: 'World-class playmaker with incredible hook accuracy.',
    stats: { mechanics:82, laning:74, gameSense:84, teamfighting:86, communication:92, clutch:82, consistency:84, draftIQ:84 }
  },
  {
    id: 'p26', name: 'Oracle', position: 'support', tier: 4, region: 'EU',
    champions: ['Thresh', 'Soraka', 'Lulu'],
    bio: 'Vision control master with elite game sense.',
    stats: { mechanics:72, laning:78, gameSense:92, teamfighting:80, communication:88, clutch:70, consistency:86, draftIQ:90 }
  },
  {
    id: 'p27', name: 'Monk', position: 'support', tier: 4, region: 'China',
    champions: ['Karma', 'Lulu', 'Yuumi'],
    bio: 'Enchanter specialist who amplifies his ADC to godhood.',
    stats: { mechanics:70, laning:76, gameSense:82, teamfighting:84, communication:90, clutch:68, consistency:86, draftIQ:84 }
  },
  {
    id: 'p28', name: 'Sage', position: 'support', tier: 3, region: 'NA',
    champions: ['Thresh', 'Blitzcrank', 'Pyke'],
    bio: 'Hook-reliant support who lives and dies by flashy plays.',
    stats: { mechanics:70, laning:64, gameSense:68, teamfighting:70, communication:72, clutch:76, consistency:60, draftIQ:64 }
  },
  {
    id: 'p29', name: 'Guardian', position: 'support', tier: 2, region: 'SEA',
    champions: ['Soraka', 'Janna', 'Nami'],
    bio: 'Passive healer who keeps his team alive.',
    stats: { mechanics:40, laning:48, gameSense:56, teamfighting:52, communication:64, clutch:40, consistency:62, draftIQ:52 }
  },
  {
    id: 'p30', name: 'Shield', position: 'support', tier: 2, region: 'SA',
    champions: ['Lulu', 'Soraka', 'Braum'],
    bio: 'Developing enchanter with potential to grow.',
    stats: { mechanics:36, laning:44, gameSense:50, teamfighting:50, communication:60, clutch:38, consistency:58, draftIQ:48 }
  },
];

// Build the player pool: each player repeated by tier pool size
function buildPlayerPool() {
  const pool = [];
  PLAYER_TEMPLATES.forEach(p => {
    const copies = CONFIG.TIER_POOL_SIZE[p.tier];
    for (let i = 0; i < copies; i++) {
      pool.push({ ...p });
    }
  });
  return pool;
}

function getPlayerTemplate(id) {
  return PLAYER_TEMPLATES.find(p => p.id === id);
}

// Create a fresh player instance (for buying)
function createPlayerInstance(template) {
  return {
    ...template,
    stats: { ...template.stats },
    champions: [...template.champions],
    stars: 1,
    instanceId: Math.random().toString(36).substr(2, 9),
    champion: null, // set during draft
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
