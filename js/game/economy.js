// js/game/economy.js — Gold, XP, and leveling logic

function calcGoldIncome(state) {
  const base = CONFIG.BASE_GOLD;

  // Interest: 1g per 10g banked, max 5
  const interest = Math.min(Math.floor(state.gold / 10), CONFIG.MAX_INTEREST);

  // Streak bonus
  let streakBonus = 0;
  if (state.winStreak >= 2) {
    const streakMap = CONFIG.WIN_STREAK_GOLD;
    const key = Math.min(state.winStreak, 5);
    streakBonus = streakMap[key] || 0;
  } else if (state.loseStreak >= 2) {
    const streakMap = CONFIG.LOSE_STREAK_GOLD;
    const key = Math.min(state.loseStreak, 5);
    streakBonus = streakMap[key] || 0;
  }

  return { base, interest, streakBonus, total: base + interest + streakBonus };
}

function applyGoldIncome(state) {
  const income = calcGoldIncome(state);
  state.gold += income.total;
  return income;
}

function xpToNextLevel(level) {
  if (level >= 5) return 0;
  return CONFIG.LEVEL_XP[level + 1] - CONFIG.LEVEL_XP[level];
}

function addXP(state, amount) {
  if (state.level >= 5) return;
  state.xp += amount;
  while (state.level < 5 && state.xp >= CONFIG.LEVEL_XP[state.level + 1]) {
    state.level++;
  }
}

function buyXP(state) {
  if (state.gold < CONFIG.XP_COST) return false;
  if (state.level >= 5) return false;
  state.gold -= CONFIG.XP_COST;
  addXP(state, CONFIG.XP_PER_BUY);
  return true;
}

function maxRosterSize(state) {
  return CONFIG.LEVEL_ROSTER_SIZE[state.level];
}

function canBuyPlayer(state, player) {
  const cost = CONFIG.TIER_COST[player.tier];
  if (state.gold < cost) return false;
  const totalSlots = state.roster.filter(Boolean).length + state.bench.length;
  if (totalSlots >= CONFIG.ROSTER_MAX + CONFIG.BENCH_MAX) return false;
  return true;
}

function buyPlayer(state, player) {
  if (!canBuyPlayer(state, player)) return false;
  state.gold -= CONFIG.TIER_COST[player.tier];
  const instance = createPlayerInstance(player);

  // Try to find an empty active slot (if we have room in roster)
  const activeCount = state.roster.filter(Boolean).length;
  if (activeCount < maxRosterSize(state)) {
    // Find first empty slot in roster
    const idx = state.roster.indexOf(null);
    if (idx !== -1) {
      state.roster[idx] = instance;
    } else {
      state.roster.push(instance);
    }
  } else {
    state.bench.push(instance);
  }

  checkStarUpgrades(state);
  return true;
}

function sellPlayer(state, instanceId) {
  // Search roster and bench for the player
  let player = null;
  const ri = state.roster.findIndex(p => p && p.instanceId === instanceId);
  if (ri !== -1) {
    player = state.roster[ri];
    state.roster[ri] = null;
  } else {
    const bi = state.bench.findIndex(p => p && p.instanceId === instanceId);
    if (bi !== -1) {
      player = state.bench[bi];
      state.bench.splice(bi, 1);
    }
  }
  if (!player) return false;

  const sellValue = CONFIG.TIER_SELL[player.tier];
  state.gold += sellValue;

  // Return to pool
  const template = getPlayerTemplate(player.id);
  if (template) state.playerPool.push({ ...template });

  return true;
}

function checkStarUpgrades(state) {
  const allPlayers = [...state.roster.filter(Boolean), ...state.bench];
  const countById = {};

  allPlayers.forEach(p => {
    if (!countById[p.id]) countById[p.id] = { stars1: [], stars2: [] };
    if (p.stars === 1) countById[p.id].stars1.push(p.instanceId);
    if (p.stars === 2) countById[p.id].stars2.push(p.instanceId);
  });

  let upgraded = false;

  for (const [id, counts] of Object.entries(countById)) {
    // Upgrade 3x 1-star → 1x 2-star
    if (counts.stars1.length >= 3) {
      // Remove 3 copies
      let removed = 0;
      [state.roster, state.bench].forEach(arr => {
        for (let i = 0; i < arr.length && removed < 3; i++) {
          if (arr[i] && arr[i].id === id && arr[i].stars === 1) {
            if (Array.isArray(arr)) arr[i] = null;
            removed++;
          }
        }
      });
      state.bench = state.bench.filter(Boolean);

      // Add one 2-star
      const template = getPlayerTemplate(id);
      const upgraded2 = createPlayerInstance(template);
      upgraded2.stars = 2;
      state.bench.push(upgraded2);
      upgraded = true;
    }

    // Upgrade 3x 2-star → 1x 3-star
    if (counts.stars2.length >= 3) {
      let removed = 0;
      [state.roster, state.bench].forEach(arr => {
        for (let i = 0; i < arr.length && removed < 3; i++) {
          if (arr[i] && arr[i].id === id && arr[i].stars === 2) {
            if (Array.isArray(arr)) arr[i] = null;
            removed++;
          }
        }
      });
      state.bench = state.bench.filter(Boolean);

      const template = getPlayerTemplate(id);
      const upgraded3 = createPlayerInstance(template);
      upgraded3.stars = 3;
      state.bench.push(upgraded3);
      upgraded = true;
    }
  }

  if (upgraded) checkStarUpgrades(state); // recurse in case chain
}
