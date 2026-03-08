// js/data/config.js — Game constants

const CONFIG = {
  ROSTER_MAX: 5,
  BENCH_MAX: 9,
  SHOP_SIZE: 5,
  REROLL_COST: 2,
  XP_COST: 4,
  XP_PER_BUY: 4,
  XP_PER_ROUND: 2,

  // Cumulative XP needed to reach each level (index = level)
  LEVEL_XP: [0, 0, 2, 6, 12, 20],
  // Max active roster slots at each level
  LEVEL_ROSTER_SIZE: [0, 1, 2, 3, 4, 5],

  // Cost to buy, and gold returned on sell, indexed by tier
  TIER_COST: [0, 1, 2, 3, 4, 5],
  TIER_SELL: [0, 0, 1, 2, 3, 4],

  // How many copies of each player exist in the pool, indexed by tier
  TIER_POOL_SIZE: [0, 18, 15, 13, 10, 9],

  BASE_GOLD: 5,
  MAX_INTEREST: 5,

  // Bonus gold per win/lose streak count
  WIN_STREAK_GOLD:  { 0:0, 1:0, 2:1, 3:1, 4:2, 5:3 },
  LOSE_STREAK_GOLD: { 0:0, 1:0, 2:1, 3:2, 4:3, 5:3 },

  ROUND_ROBIN_ROUNDS: 7,
  TOTAL_TEAMS: 8,
  BRACKET_SIZE: 4,

  // Shop tier odds by player level [T1%, T2%, T3%, T4%, T5%]
  TIER_ODDS: {
    1: [100,  0,  0,  0,  0],
    2: [ 70, 25,  5,  0,  0],
    3: [ 45, 35, 15,  5,  0],
    4: [ 25, 35, 25, 12,  3],
    5: [ 10, 20, 35, 25, 10],
  },

  // Star upgrade multipliers
  STAR_MULTIPLIER: { 1: 1.0, 2: 1.2, 3: 1.5 },
  COPIES_TO_UPGRADE: 3,

  POSITIONS: ['top', 'jungle', 'mid', 'adc', 'support'],

  // Dragon types for flavor
  DRAGON_TYPES: ['Infernal', 'Mountain', 'Ocean', 'Cloud', 'Hextech', 'Chemtech'],
};
