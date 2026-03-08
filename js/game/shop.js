// js/game/shop.js — Shop logic: pool management, rerolling, tier odds

function initPool(state) {
  state.playerPool = buildPlayerPool();
  shuffleArray(state.playerPool);
}

function drawShop(state) {
  if (state.shopLocked) return; // Keep current shop

  // Return current shop items to pool (un-bought ones)
  state.shopSlots.forEach(slot => {
    if (slot) state.playerPool.push({ ...slot });
  });

  state.shopSlots = [];

  for (let i = 0; i < CONFIG.SHOP_SIZE; i++) {
    const player = drawFromPool(state);
    state.shopSlots.push(player); // null if pool empty
  }
}

function drawFromPool(state) {
  if (state.playerPool.length === 0) return null;

  const odds = CONFIG.TIER_ODDS[state.level] || CONFIG.TIER_ODDS[1];
  const roll = Math.random() * 100;
  let cumulative = 0;
  let targetTier = 1;

  for (let t = 1; t <= 5; t++) {
    cumulative += odds[t - 1];
    if (roll < cumulative) {
      targetTier = t;
      break;
    }
  }

  // Find a player of the target tier in the pool
  let idx = state.playerPool.findIndex(p => p.tier === targetTier);

  // If none of that tier, fallback to any available
  if (idx === -1) {
    idx = 0;
  }

  if (idx === -1 || state.playerPool.length === 0) return null;

  const [player] = state.playerPool.splice(idx, 1);
  return player;
}

function rerollShop(state) {
  if (state.gold < CONFIG.REROLL_COST) return false;
  state.gold -= CONFIG.REROLL_COST;
  state.shopLocked = false;
  drawShop(state);
  return true;
}

function toggleLockShop(state) {
  state.shopLocked = !state.shopLocked;
  return state.shopLocked;
}

function buyShopPlayer(state, shopIndex) {
  const player = state.shopSlots[shopIndex];
  if (!player) return false;

  if (!buyPlayer(state, player)) return false;

  state.shopSlots[shopIndex] = null;
  return true;
}

// Swap a player between roster and bench (or between two roster slots)
function swapRosterBench(state, fromType, fromIndex, toType, toIndex) {
  const getRoster = () => state.roster;
  const getBench  = () => state.bench;

  const fromArr = fromType === 'roster' ? getRoster() : getBench();
  const toArr   = toType   === 'roster' ? getRoster() : getBench();

  // Check roster size constraint
  if (toType === 'roster' && toIndex >= maxRosterSize(state)) return false;

  const fromPlayer = fromArr[fromIndex];
  const toPlayer   = toArr[toIndex];

  if (fromType === 'roster') fromArr[fromIndex] = toPlayer || null;
  else { fromArr.splice(fromIndex, 1); if (toPlayer) fromArr.push(toPlayer); }

  if (toType === 'roster') toArr[toIndex] = fromPlayer;
  else { if (fromPlayer) toArr.push(fromPlayer); }

  return true;
}

// Generate a random roster for an AI team of given strength (0-1)
function generateAIRoster(strengthBias) {
  // strength 0.8-1.0 = strong (T4-T5 preferred)
  // strength 0.5-0.7 = medium (T3-T4 preferred)
  // strength 0.2-0.4 = weak (T2-T3 preferred)
  const positions = ['top', 'jungle', 'mid', 'adc', 'support'];
  const roster = [];

  positions.forEach(pos => {
    // Filter templates by position
    const candidates = PLAYER_TEMPLATES.filter(p => p.position === pos);

    // Sort by tier
    candidates.sort((a, b) => b.tier - a.tier);

    // Pick based on strength bias
    let picked;
    const roll = Math.random();
    if (strengthBias >= 0.8) {
      // Strong: prefer T4-T5
      picked = roll < 0.6
        ? candidates.find(p => p.tier >= 4) || candidates[0]
        : candidates.find(p => p.tier >= 3) || candidates[0];
    } else if (strengthBias >= 0.5) {
      // Medium: prefer T3-T4
      picked = roll < 0.6
        ? candidates.find(p => p.tier >= 3 && p.tier <= 4) || candidates[Math.floor(candidates.length / 2)]
        : candidates.find(p => p.tier >= 2) || candidates[0];
    } else {
      // Weak: prefer T2-T3
      picked = roll < 0.6
        ? candidates.find(p => p.tier <= 3) || candidates[candidates.length - 1]
        : candidates[candidates.length - 1];
    }

    if (picked) {
      const instance = createPlayerInstance(picked);
      roster.push(instance);
    }
  });

  return roster;
}

// Utility: shuffle array in place
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
