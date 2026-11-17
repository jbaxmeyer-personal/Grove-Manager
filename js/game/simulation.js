// js/game/simulation.js — Real tick-based agent simulation engine
// Phase 6: Every champion is a live agent with position, HP, state machine, target.
// Events and kills EMERGE from simulation — nothing is scripted or predetermined.

'use strict';

// ─── Engine constants ─────────────────────────────────────────────────────────

const TICK_S         = 2;     // in-game seconds per engine tick
const MAX_TICKS      = 180;   // 24:00 game-clock cap (6 min at 1×) — most games end on an Ancient kill well before
const MOVE_SCALE     = 40;    // moveSpeed unit → px/tick = moveSpeed * TICK_S / MOVE_SCALE (fast: mobile-length games)
const STR_DMG_REDUCE = 2.0;   // multiplier on champion damage vs structures
const MAX_ITEMS      = 3;     // short games → 3-item builds
const CLOCK_SCALE    = 4;     // displayed game clock: 1 tick = 8s (median game ≈ 18 min on the clock, ≈ 4.5 min to watch at 1×)

// ─── Minions ──────────────────────────────────────────────────────────────────
// Real lane minions: they walk the lanes, fight each other, tank tower shots and
// are the main source of farm (CS gold + shared XP) for laners.
const MINION_LANES = {
  top: [[35, 250], [35, 35], [250, 35]],
  mid: [[50, 250], [250, 50]],
  bot: [[50, 265], [265, 265], [265, 50]],
};
const PHASE_1 = 20, PHASE_2 = 40;   // laning → mid game → grouped late game (ticks)
const WAVE_FIRST_TICK = 2;
const WAVE_INTERVAL   = 8;
const MINION_DEF = {
  melee:  { hp: 150, dmg: 10, range: 8,  aggro: 26, gold: 21, xp: 30, speed: 13 },
  caster: { hp: 95,  dmg: 13, range: 24, aggro: 30, gold: 15, xp: 26, speed: 13 },
  siege:  { hp: 300, dmg: 26, range: 30, aggro: 34, gold: 48, xp: 60, speed: 12 },
};
const MINION_XP_RANGE = 60;

// Attack / aggro ranges in map pixels (map is 300×300)
const CLASS_RANGES = {
  tank:     { atk:  8, aggro: 28 },
  fighter:  { atk: 10, aggro: 30 },
  assassin: { atk: 12, aggro: 32 },
  mage:     { atk: 52, aggro: 58 },
  marksman: { atk: 58, aggro: 64 },
  sentinel: { atk: 46, aggro: 52 },
};

// XP thresholds (cumulative) for levels 1→10
const XP_THRESH  = [0, 150, 400, 750, 1200, 1750, 2400, 2650, 2950, 3300];
const XP_CS      = 32;
const XP_JG_SM   = 65;
const XP_JG_LG   = 125;
const XP_KILL    = 300;
const XP_ASSIST  = 150;
const XP_OBJ     = 120;
const XP_WARDEN  = 200;

// ─── Map layout (300×300 pixel space) ────────────────────────────────────────
// Blue = bottom-left corner, Red = top-right corner.

const SPAWN = {
  blue: { x: 22,  y: 278 },
  red:  { x: 278, y: 22  },
};

// Where each role walks during the laning phase
// Laning positions per phase.
// Blue base = bottom-left (22,278), Red base = top-right (278,22)
// Top lane = left edge (x≈35) → top edge (y≈35)
// Bot lane = bottom edge (y≈265) → right edge (x≈265)
// Mid lane = diagonal
const LANE_POS = {
  blue: {
    top:     { x: 35,  y: 195 },   // top lane — left edge, walk up
    jungle:  { x: 88,  y: 115 },   // blue jungle
    mid:     { x: 115, y: 200 },   // mid lane blue side
    adc:     { x: 175, y: 265 },   // bot lane — bottom edge
    support: { x: 148, y: 265 },   // bot lane support
  },
  red: {
    top:     { x: 105, y: 35  },   // top lane — top edge, walk right
    jungle:  { x: 212, y: 185 },   // red jungle
    mid:     { x: 185, y: 100 },   // mid lane red side
    adc:     { x: 265, y: 195 },   // bot lane — right edge, walk down
    support: { x: 265, y: 152 },   // bot lane support
  },
};

// Phase 1 advance positions (push toward enemy side)
const LANE_POS_P1 = {
  blue: {
    top:     { x: 35,  y: 130 },   // further up left edge toward enemy top
    jungle:  { x: 150, y: 150 },   // contest center
    mid:     { x: 135, y: 165 },   // toward center
    adc:     { x: 220, y: 265 },   // push right toward enemy bot
    support: { x: 195, y: 265 },
  },
  red: {
    top:     { x: 170, y: 35  },   // further right along top edge
    jungle:  { x: 150, y: 150 },   // contest center
    mid:     { x: 165, y: 135 },   // toward center
    adc:     { x: 265, y: 130 },   // push down right edge toward enemy bot
    support: { x: 265, y: 105 },
  },
};

// Keep lane positions exactly mirror-symmetric across the river (x = y): red = blue with x/y swapped.
['top', 'jungle', 'mid', 'adc', 'support'].forEach(r => {
  LANE_POS.red[r]    = { x: LANE_POS.blue[r].y,    y: LANE_POS.blue[r].x };
  LANE_POS_P1.red[r] = { x: LANE_POS_P1.blue[r].y, y: LANE_POS_P1.blue[r].x };
});

// Objectives — 2 towers per lane per side, perfectly point-symmetric (each pair sums to 300,300)
//
// Blue defends: bot lane (bottom edge), mid lane (diagonal), top lane (left edge)
// Red defends:  top lane (top edge),    mid lane (diagonal), bot lane (right edge)
//
// T1 = outer (enemies hit first), T2 = inner (closer to base)
const OBJ_DEFS = [
  // ── Blue bot lane (bottom edge, enemies come from right) ────────────────────
  { id:'b_bot1',   side:'blue',    type:'root',    x:185, y:265, maxHp: 500, atkDmg: 8, atkRange:32 },
  { id:'b_bot2',   side:'blue',    type:'root',    x:115, y:265, maxHp: 600, atkDmg:12, atkRange:32 },
  // ── Blue mid lane (diagonal, enemies from top-right) ────────────────────────
  // ON the diagonal: x + y = 300. b_mid1 outer (hit first by red), b_mid2 inner (closer to blue base)
  { id:'b_mid1',   side:'blue',    type:'root',    x:110, y:190, maxHp: 500, atkDmg: 8, atkRange:32 },
  { id:'b_mid2',   side:'blue',    type:'root',    x: 80, y:220, maxHp: 600, atkDmg:12, atkRange:32 },
  // ── Blue top lane (left edge, enemies come from above) ──────────────────────
  //    T1 (outer) is the one further from base (y=115); T2 (inner) guards the base (y=185)
  { id:'b_top1',   side:'blue',    type:'root',    x: 35, y:115, maxHp: 500, atkDmg: 8, atkRange:32 },
  { id:'b_top2',   side:'blue',    type:'root',    x: 35, y:185, maxHp: 600, atkDmg:12, atkRange:32 },
  // ── Blue base ───────────────────────────────────────────────────────────────
  { id:'b_heart',  side:'blue',    type:'root',    x: 55, y:240, maxHp: 600, atkDmg:10, atkRange:32 },
  { id:'b_ancient',side:'blue',    type:'ancient', x: 22, y:278, maxHp: 800, atkDmg: 6, atkRange:36 },
  // ── Red top lane (top edge, enemies come from left) — mirror of blue bot ────
  { id:'r_top1',   side:'red',     type:'root',    x:115, y: 35, maxHp: 500, atkDmg: 8, atkRange:32 },
  { id:'r_top2',   side:'red',     type:'root',    x:185, y: 35, maxHp: 600, atkDmg:12, atkRange:32 },
  // ── Red mid lane (diagonal, enemies from bottom-left) — mirror of blue mid ─
  // ON the diagonal: x + y = 300. r_mid1 outer (hit first by blue), r_mid2 inner (closer to red base)
  { id:'r_mid1',   side:'red',     type:'root',    x:190, y:110, maxHp: 500, atkDmg: 8, atkRange:32 },
  { id:'r_mid2',   side:'red',     type:'root',    x:220, y: 80, maxHp: 600, atkDmg:12, atkRange:32 },
  // ── Red bot lane (right edge, enemies come from below) — mirror of blue top ─
  { id:'r_bot1',   side:'red',     type:'root',    x:265, y:185, maxHp: 500, atkDmg: 8, atkRange:32 },
  { id:'r_bot2',   side:'red',     type:'root',    x:265, y:115, maxHp: 600, atkDmg:12, atkRange:32 },
  // ── Red base ────────────────────────────────────────────────────────────────
  { id:'r_heart',  side:'red',     type:'root',    x:240, y: 55, maxHp: 600, atkDmg:10, atkRange:32 },
  { id:'r_ancient',side:'red',     type:'ancient', x:278, y: 22, maxHp: 800, atkDmg: 6, atkRange:36 },
  // ── Neutral objectives ──────────────────────────────────────────────────────
  // Neutral objectives: Shrine (Dragon-side, bot lane river) and Warden (Baron-side, top lane river)
  { id:'shrine',   side:'neutral', type:'shrine',  x: 65, y: 65, maxHp: 1500, atkDmg: 0, atkRange: 0 },
  { id:'warden',   side:'neutral', type:'warden',  x:235, y:235, maxHp: 3600, atkDmg: 6, atkRange:28 },
];

// Jungle camps
const JUNGLE_DEF = [
  // The map is mirror-symmetric across the river (the x = y diagonal): red camp = blue camp with x/y swapped.
  { id:'bjc1', side:'blue', large:false, x: 75, y:140, maxHp:400, xp:XP_JG_SM, gold:30, respawn:12 },
  { id:'bjc2', side:'blue', large:false, x:140, y:225, maxHp:400, xp:XP_JG_SM, gold:30, respawn:12 },
  { id:'bjcL', side:'blue', large:true,  x: 95, y:150, maxHp:700, xp:XP_JG_LG, gold:60, respawn:18 },
  { id:'rjc1', side:'red',  large:false, x:140, y: 75, maxHp:400, xp:XP_JG_SM, gold:30, respawn:12 },
  { id:'rjc2', side:'red',  large:false, x:225, y:140, maxHp:400, xp:XP_JG_SM, gold:30, respawn:12 },
  { id:'rjcL', side:'red',  large:true,  x:150, y: 95, maxHp:700, xp:XP_JG_LG, gold:60, respawn:18 },
];

// ─── Agent initialisation ─────────────────────────────────────────────────────

function initAgent(side, posIdx, player, champName) {
  const pos    = POSITIONS[posIdx];
  const cd     = CHAMPIONS[champName] || {};
  const cls    = (cd.class || 'Mage').toLowerCase();
  const ranges = CLASS_RANGES[cls] || CLASS_RANGES.mage;
  const sp     = SPAWN[side];
  const off    = [-12, -6, 0, 6, 12];
  const ox     = off[posIdx] * (side === 'blue' ?  0.5 : -0.5);
  const oy     = off[posIdx] * (side === 'blue' ? -0.5 :  0.5);

  return {
    id: `${side[0]}${posIdx}`,
    side, pos,
    champName,
    champData:  cd,
    playerRef:  player,
    cls,

    x: sp.x + ox,
    y: sp.y + oy,

    level: 1, xp: 0,
    gold: 500,

    maxHp: cd.baseHp || 420,
    hp:    cd.baseHp || 420,

    physDmg:      cd.baseDmg    || 30,
    abilityPower: 0,
    physResist:   cd.physResist || 30,
    magicResist:  cd.magicResist|| 35,
    moveSpeed:    cd.moveSpeed  || 300,
    atkRange:     ranges.atk,
    aggroRange:   ranges.aggro,
    vamp: 0, spellVamp: 0, magicPen: 0, physPen: 0, cdr: 0,

    items: [],

    isDead:      false,
    respawnAt:   0,
    recallStart: -1,

    cdAA: 0, cdQ: 0, cdE: 0, cdUlt: 0,

    state:  'laning',
    target: null,

    kills: 0, deaths: 0, assists: 0, cs: 0, damageDealt: 0,
    recentDmgFrom: [],
  };
}

// ─── Level-up ─────────────────────────────────────────────────────────────────

const XP_MULT = 1.7;   // short games: level up faster
function grantXP(agent, amount) {
  amount = Math.round(amount * XP_MULT);
  agent.xp += amount;
  while (agent.level < 10 && agent.xp >= XP_THRESH[agent.level]) {
    agent.level++;
    const L  = agent.level;
    const cd = agent.champData;
    const newMax = Math.round((cd.baseHp || 420) * (1 + (L - 1) * 0.07));
    agent.hp      = Math.min(newMax, agent.hp + (newMax - agent.maxHp));
    agent.maxHp   = newMax;
    agent.physDmg    = (cd.baseDmg    || 30) + (L-1)*3;
    agent.physResist = (cd.physResist || 30) + (L-1)*3;
    agent.magicResist= (cd.magicResist|| 35) + (L-1)*2;
    // Re-add item bonuses
    agent.items.forEach(id => {
      const s = ITEM_MAP[id]?.stats;
      if (!s) return;
      if (s.physDmg)    agent.physDmg     += s.physDmg;
      if (s.physResist) agent.physResist  += s.physResist;
      if (s.magicResist)agent.magicResist += s.magicResist;
    });
  }
}

// ─── Items ────────────────────────────────────────────────────────────────────

function buyItems(agent) {
  const role = (agent.champData?.class || 'mage').toLowerCase();
  const eligible = getItemsForRole(role)
    .filter(it => !agent.items.includes(it.id))
    .sort((a,b) => b.cost - a.cost);

  while (agent.items.length < MAX_ITEMS) {
    const best = eligible.find(it => it.cost <= agent.gold);
    if (!best) break;
    agent.items.push(best.id);
    agent.gold -= best.cost;
    eligible.splice(eligible.indexOf(best), 1);
    const s = best.stats;
    if (s.maxHp)           { agent.maxHp += s.maxHp; agent.hp = Math.min(agent.maxHp, agent.hp + s.maxHp); }
    if (s.physResist)       agent.physResist    += s.physResist;
    if (s.magicResist)      agent.magicResist   += s.magicResist;
    if (s.abilityPower)     agent.abilityPower  += s.abilityPower;
    if (s.physDmg)          agent.physDmg       += s.physDmg;
    if (s.vamp)             agent.vamp          += s.vamp;
    if (s.spellVamp)        agent.spellVamp     += s.spellVamp;
    if (s.moveSpeed)        agent.moveSpeed     += s.moveSpeed;
    if (s.magicPen)         agent.magicPen      += s.magicPen;
    if (s.physPen)          agent.physPen       += s.physPen;
    if (s.cooldownReduction)agent.cdr           += s.cooldownReduction;
  }
}

// ─── Damage ───────────────────────────────────────────────────────────────────

function dealDamage(attacker, target, rawDmg, dmgType, tick) {
  const mechFactor = 0.85 + (attacker.playerRef?.stats?.mechanics || 10) / 20 * 0.30;
  const resist = dmgType === 'magic'
    ? Math.max(0, target.magicResist - attacker.magicPen)
    : Math.max(0, target.physResist  - attacker.physPen);
  const dmg = Math.max(1, Math.round(rawDmg * (100 / (100 + resist)) * mechFactor));

  target.hp          -= dmg;
  attacker.damageDealt += dmg;

  const vampRate = dmgType === 'magic' ? attacker.spellVamp : attacker.vamp;
  if (vampRate > 0)
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.round(dmg * vampRate));

  target.recentDmgFrom = target.recentDmgFrom.filter(e => tick - e.tick <= 20);
  if (!target.recentDmgFrom.find(e => e.id === attacker.id))
    target.recentDmgFrom.push({ id: attacker.id, tick });

  return dmg;
}

function dealObjDamage(attacker, obj, rawDmg) {
  const buff = attacker._baronBuffed > 0 ? 1.6 : 1;   // Hand of the Warden: siege power
  const dmg = Math.max(1, Math.round(rawDmg * STR_DMG_REDUCE * buff));
  obj.hp = Math.max(0, obj.hp - dmg);
  attacker.damageDealt += dmg;
  return dmg;
}

// ─── AI ───────────────────────────────────────────────────────────────────────

function decideAction(agent, allies, enemies, objs, jungles, tick, phase) {
  if (agent.isDead || agent.state === 'dead') return;
  if (agent.state === 'recalling') return;

  const composure = agent.playerRef?.stats?.composure || 10;
  const gameSense = agent.playerRef?.stats?.gameSense  || 10;
  // Tactic: aggression modifier adjusts flee threshold (lower = more aggressive, higher = more cautious)
  const aggMod = agent._tacticAggression || 1.0;
  const fleeHP = (0.12 + (1 - composure / 20) * 0.18) / aggMod;

  // 1. Critical HP → recall
  if (agent.hp / agent.maxHp < 0.08) {
    agent.state = 'recalling';
    agent.recallStart = tick;
    agent.target = { type:'position', x: SPAWN[agent.side].x, y: SPAWN[agent.side].y };
    return;
  }

  // 2. Low HP → retreat
  if (agent.hp / agent.maxHp < fleeHP && agent.state !== 'retreating') {
    agent.state  = 'retreating';
    agent.target = { type:'position', x: SPAWN[agent.side].x, y: SPAWN[agent.side].y };
    return;
  }

  // 3. Retreating but recovered
  if (agent.state === 'retreating' && agent.hp / agent.maxHp > 0.60) {
    agent.state  = 'laning';
    agent.target = null;
  }

  // 4. Enemy in aggro range → fight
  const nearEnemy = findNearest(agent, enemies.filter(e => !e.isDead), agent.aggroRange);
  // Laning phase: laners farm by default and only commit to a fight when it favours them
  // (enemy low / clearly behind on HP) or take a quick harass trade now and then.
  let commit = !!nearEnemy;
  if (nearEnemy && phase === 0 && agent.pos !== 'jungle' && agent.state !== 'fighting') {
    const myPct = agent.hp / agent.maxHp, thPct = nearEnemy.hp / nearEnemy.maxHp;
    const mech  = agent.playerRef?.stats?.mechanics || 10;
    const tradeChance = 0.10 + mech / 20 * 0.12 + ((agent._tacticAggression || 1) - 1) * 0.3;
    commit = thPct < 0.38 || myPct - thPct > 0.22 || Math.random() < tradeChance;
    if (!commit) agent._skipFight = true;
  }
  if (agent.state === 'fighting' && phase === 0 && agent.pos !== 'jungle' && nearEnemy &&
      agent.hp / agent.maxHp < nearEnemy.hp / nearEnemy.maxHp - 0.1 && Math.random() < 0.5) {
    commit = false;                                   // disengage a losing lane trade
  }
  // Sieging: champions already hitting a structure stay on it unless an enemy is right on top of them
  const sieging = agent.state === 'contesting' && agent.target?.type === 'objective' && agent.target.ref
    && agent.target.ref.type !== 'shrine' && dist(agent, agent.target.ref) <= agent.atkRange + 20;
  if (nearEnemy && commit && sieging && dist(agent, nearEnemy) > agent.atkRange + 6 && nearEnemy.hp / nearEnemy.maxHp > 0.3) commit = false;
  if (nearEnemy && commit) {
    agent.state  = 'fighting';
    agent.target = { type:'champion', ref: nearEnemy };
    return;
  }

  // Clear stale fight target
  if (agent.state === 'fighting' && (!agent.target?.ref || agent.target.ref.isDead)) {
    agent.state  = 'laning';
    agent.target = null;
  }

  const enemySide = agent.side === 'blue' ? 'red' : 'blue';

  // 4b. Numbers advantage (2+ more alive) after laning → group up and siege
  if (phase >= 1) {
    const upBy = (allies.filter(a => !a.isDead).length + 1) - enemies.filter(e => !e.isDead).length;
    if (upBy >= 2 || (phase === 2 && upBy >= 1)) {
      const tgt = nextSiegeTarget(enemySide, objs);
      if (tgt && !tgt.destroyed) { agent.state = 'contesting'; agent.target = { type: 'objective', ref: tgt }; return; }
    }
  }

  // 5. Jungle: jungle or gank (modified by tactic flags)
  if (agent.pos === 'jungle') {
    const gankHP  = agent._tacticObjWeight ? 0.70 : 0.55;
    const gankGS  = agent._tacticObjWeight ? 9 : 12;
    const gankDst = agent._tacticEnemyJgWeight ? 130 : 100;
    if (gameSense > gankGS) {
      const gankTarget = enemies.find(e => !e.isDead && e.hp/e.maxHp < gankHP && dist(agent,e) < gankDst);
      if (gankTarget) {
        agent.state  = 'fighting';
        agent.target = { type:'champion', ref: gankTarget };
        return;
      }
    }
    // Phase 1+: prioritize neutral objectives over camp farming
    if (phase >= 1 && gameSense > 5) {
      const shrine = objs.find(o => o.type === 'shrine' && !o.tempDown);
      if (shrine) {
        agent.state  = 'contesting';
        agent.target = { type:'objective', ref: shrine };
        return;
      }
      if (agent.hp / agent.maxHp > 0.35) {
        const warden = objs.find(o => o.type === 'warden' && !o.tempDown);
        if (warden) {
          agent.state  = 'contesting';
          agent.target = { type:'warden', ref: warden };
          return;
        }
      }
    }
    // Counter-jungling: also target enemy camps
    const campSide = agent._tacticEnemyJgWeight ? (agent.side === 'blue' ? 'red' : 'blue') : agent.side;
    const camp = jungles.filter(j => j.alive && j.side === campSide)
                        .sort((a,b) => dist(agent,a) - dist(agent,b))[0];
    if (camp) {
      agent.state  = 'jungling';
      agent.target = { type:'jungle', ref: camp };
      return;
    }
  }

  // 6. Support: also prioritize neutral objectives
  if (phase >= 1 && agent.pos === 'support' && gameSense > 5) {
    const shrine = objs.find(o => o.type === 'shrine' && !o.tempDown);
    if (shrine) {
      agent.state  = 'contesting';
      agent.target = { type:'objective', ref: shrine };
      return;
    }
    if (agent.hp / agent.maxHp > 0.35) {
      const warden = objs.find(o => o.type === 'warden' && !o.tempDown);
      if (warden) {
        agent.state  = 'contesting';
        agent.target = { type:'warden', ref: warden };
        return;
      }
    }
  }

  // 6b. Laners keep farming the wave in front of them before walking off to siege
  if (phase <= 1 && agent.pos !== 'support' && agent.pos !== 'jungle' && agent._minions) {
    const wave = agent._minions.filter(m => !m.dead && m.side !== agent.side && dist(agent, m) <= agent.aggroRange + 10);
    if (wave.length) {
      wave.sort((a, b) => a.hp - b.hp);
      agent.state = 'laning'; agent.target = { type: 'minion', ref: wave[0] }; return;
    }
  }

  // 7. Push toward enemy objectives (phase 1+ = tick 50+)
  //    Mid game: laners push their own lane first; late game (phase 2) the team groups.
  if (phase >= 1 && gameSense > 5) {
    const seq = enemySide === 'red'
      ? ['r_top1','r_top2','r_mid1','r_mid2','r_bot1','r_bot2','r_heart','r_ancient']
      : ['b_bot1','b_bot2','b_mid1','b_mid2','b_top1','b_top2','b_heart','b_ancient'];
    // lane names match on both sides: top = left/top edge, bot = bottom/right edge
    const laneKey = { top: 'top', mid: 'mid', adc: 'bot', support: 'bot' }[agent.pos];
    const ownLane = (phase === 1 && laneKey)
      ? objs.find(o => o.id.startsWith(enemySide[0] + '_' + laneKey) && !o.destroyed)
      : null;
    const nextObj = ownLane || nextSiegeTarget(enemySide, objs);
    if (nextObj) {
      agent.state  = 'contesting';
      agent.target = { type:'objective', ref: nextObj };
      return;
    }
  }

  // 8. Shrine contestation for other roles (mid-game, nearby only)
  if (phase >= 1 && gameSense > 5) {
    const shrine = objs.find(o => o.type === 'shrine' && !o.tempDown && dist(agent, o) < 120);
    if (shrine) {
      agent.state  = 'contesting';
      agent.target = { type:'objective', ref: shrine };
      return;
    }
  }

  // 9. Farm: last-hit enemy minions nearby (supports leave the farm to their carry)
  if (agent.pos !== 'support' && agent._minions) {
    const farmR = agent.aggroRange + 18;
    const csAcc = agent.playerRef?.stats?.csAccuracy || 10;
    const wave  = agent._minions.filter(m => !m.dead && m.side !== agent.side && dist(agent, m) <= farmR);
    if (wave.length) {
      // better farmers wait for the last hit; weaker ones just hit the nearest
      wave.sort(csAcc >= 12 ? (a, b) => a.hp - b.hp : (a, b) => dist(agent, a) - dist(agent, b));
      agent.state  = 'laning';
      agent.target = { type: 'minion', ref: wave[0] };
      return;
    }
  }

  // 10. Laners shadow their own minion wave (stand just behind the front minion)
  if (phase === 0 && agent.pos !== 'jungle' && agent._minions) {
    const lane = agent.pos === 'top' ? 'top' : agent.pos === 'mid' ? 'mid' : 'bot';
    const eb = SPAWN[enemySide];
    const own = agent._minions.filter(m => !m.dead && m.side === agent.side && m.lane === lane);
    if (own.length) {
      const front = own.reduce((a, b) => (dist(a, eb) < dist(b, eb) ? a : b));
      const back  = SPAWN[agent.side];
      const k = 10 / (dist(front, back) || 1);
      agent.state  = 'laning';
      agent.target = { type: 'position', x: front.x + (back.x - front.x) * k, y: front.y + (back.y - front.y) * k };
      return;
    }
  }

  // 11. Default: walk toward assigned position (shifts in late-game toward enemy)
  const lt = laneTarget(agent.side, agent.pos, phase, enemySide, objs, tick);
  agent.state  = 'laning';
  agent.target = { type:'position', x: lt.x, y: lt.y };
}

function laneTarget(side, pos, phase, enemySide, objs, tick) {
  if (phase >= 1) {
    const seq = enemySide === 'red'
      ? ['r_top1','r_top2','r_mid1','r_mid2','r_bot1','r_bot2','r_heart','r_ancient']
      : ['b_bot1','b_bot2','b_mid1','b_mid2','b_top1','b_top2','b_heart','b_ancient'];
    const next = nextSiegeTarget(enemySide, objs);
    if (next && !next.destroyed) return { x: next.x, y: next.y };
  }
  // Gradually advance lane position during laning phase (0→50 ticks)
  const start = LANE_POS[side][pos];
  const end   = (LANE_POS_P1[side]?.[pos]) || start;
  const t     = phase === 0 ? Math.min(1, (tick || 0) / 50) : 1;
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
}

// ─── Movement ─────────────────────────────────────────────────────────────────

function moveAgent(agent) {
  if (agent.isDead || !agent.target) return;
  const t = agent.target;
  let tx, ty;
  if (t.ref) {
    if (t.type === 'champion' && t.ref.isDead) { agent.target = null; return; }
    if (t.type === 'minion' && t.ref.dead)     { agent.target = null; return; }
    tx = t.ref.x; ty = t.ref.y;
  } else { tx = t.x || 150; ty = t.y || 150; }

  const dx = tx - agent.x, dy = ty - agent.y;
  const d  = Math.sqrt(dx*dx + dy*dy);
  if (d < 2) return;
  // ranged champions hold position at attack range instead of walking into their target
  if ((t.type === 'champion' || t.type === 'minion') && d <= agent.atkRange * 0.92) return;

  const speed = agent.moveSpeed * TICK_S / MOVE_SCALE;
  const step  = Math.min(d, speed);
  agent.x += (dx/d) * step;
  agent.y += (dy/d) * step;
}

// ─── Combat ───────────────────────────────────────────────────────────────────

function doCombat(agent, enemies, objs, jungles, tick) {
  if (agent.isDead || agent.state === 'retreating' || agent.state === 'recalling') return;

  // ── vs Champion ────────────────────────────────────────────────────────
  if (agent.state === 'fighting' && agent.target?.type === 'champion') {
    const enemy = agent.target.ref;
    if (!enemy || enemy.isDead) { agent.state='laning'; agent.target=null; return; }
    if (dist(agent, enemy) > agent.atkRange) return;

    const aa = agent.champData?.abilities?.aa;
    if (agent.cdAA <= 0) {
      const dmg = aa ? aa.dmg : agent.physDmg;
      const tp  = aa?.dmgType || 'physical';
      dealDamage(agent, enemy, dmg, tp, tick);
      agent.cdAA = Math.ceil((aa?.cd || 2.0) * (1 - agent.cdr) / TICK_S);
    }
    if (agent.cdQ <= 0 && agent.level >= 1) {
      const q = agent.champData?.abilities?.q;
      if (q && dist(agent, enemy) <= (q.range/18 || agent.atkRange + 10)) {
        dealDamage(agent, enemy, q.dmg + (q.apRatio||0)*agent.abilityPower, q.dmgType||'magic', tick);
        agent.cdQ = Math.ceil(q.cd * (1-agent.cdr) / TICK_S);
      }
    }
    if (agent.cdE <= 0 && agent.level >= 3) {
      const e = agent.champData?.abilities?.e;
      if (e && dist(agent, enemy) <= (e.range/18 || agent.atkRange + 8)) {
        dealDamage(agent, enemy, e.dmg + (e.apRatio||0)*agent.abilityPower, e.dmgType||'magic', tick);
        agent.cdE = Math.ceil(e.cd * (1-agent.cdr) / TICK_S);
      }
    }
    if (agent.cdUlt <= 0 && agent.level >= 6) {
      const ult = agent.champData?.abilities?.ult;
      if (ult) {
        dealDamage(agent, enemy, ult.dmg + (ult.apRatio||0)*agent.abilityPower, ult.dmgType||'magic', tick);
        agent.cdUlt = Math.ceil(ult.cd * (1-agent.cdr) / TICK_S);
      }
    }
    return;
  }

  // ── vs Minion (last-hitting) ───────────────────────────────────────────
  if (agent.target?.type === 'minion') {
    const m = agent.target.ref;
    if (!m || m.dead || m.hp <= 0) { agent.target = null; return; }
    if (dist(agent, m) > agent.atkRange + 2) return;
    if (agent.cdAA <= 0) {
      const aa = agent.champData?.abilities?.aa;
      m.hp -= ((aa ? aa.dmg : agent.physDmg) + agent.level * 3) * 1.6;
      if (m.hp <= 0) m.lastHitBy = agent;
      agent.cdAA = Math.ceil((aa?.cd || 2.0) * (1 - agent.cdr) / TICK_S);
    }
    return;
  }

  // ── vs Objective / Warden ──────────────────────────────────────────────
  if (agent.state === 'contesting' && agent.target?.type === 'objective') {
    const obj = agent.target.ref;
    if (!obj || obj.destroyed || obj.tempDown) { agent.target=null; agent.state='laning'; return; }
    // clear enemy minions in reach first (wave clear → farm), then hit the structure
    const wm = dist(agent, obj) > agent.atkRange + 6 && (agent._minions || []).find(m => !m.dead && m.side !== agent.side && dist(agent, m) <= agent.atkRange + 4);
    if (wm && agent.cdAA <= 0) {
      const aa = agent.champData?.abilities?.aa;
      wm.hp -= ((aa ? aa.dmg : agent.physDmg) + agent.level * 3) * 1.6;
      if (wm.hp <= 0) wm.lastHitBy = agent;
      agent.cdAA = Math.ceil((aa?.cd || 2.0) * (1 - agent.cdr) / TICK_S);
      return;
    }
    if (!_structureTargetable(obj, agent._objs || [obj]) && obj.type === 'ancient') return;
    if (dist(agent, obj) > agent.atkRange + 6) return;
    if (agent.cdAA <= 0) {
      const aa  = agent.champData?.abilities?.aa;
      // structure damage scales with level/items (physDmg) and AP, not just the base AA value
      dealObjDamage(agent, obj, Math.max(aa ? aa.dmg : 0, agent.physDmg) + agent.abilityPower * 0.3 + 15 + agent.level * 5);
      agent.cdAA = Math.ceil((aa?.cd||2.0)*(1-agent.cdr)/TICK_S);
    }
    if (agent.cdQ <= 0 && agent.level >= 1) {
      const q = agent.champData?.abilities?.q;
      if (q) {
        dealObjDamage(agent, obj, (q.dmg + (q.apRatio||0)*agent.abilityPower) * 0.5);
        agent.cdQ = Math.ceil(q.cd*(1-agent.cdr)/TICK_S);
      }
    }
    return;
  }

  if (agent.state === 'contesting' && agent.target?.type === 'warden') {
    const obj = agent.target.ref;
    if (!obj || obj.tempDown) { agent.target=null; agent.state='laning'; return; }
    if (dist(agent, obj) > agent.atkRange + 6) return;
    if (agent.cdAA <= 0) {
      dealObjDamage(agent, obj, agent.physDmg + agent.abilityPower * 0.5);
      agent.cdAA = Math.ceil(((agent.champData?.abilities?.aa?.cd)||2.0)*(1-agent.cdr)/TICK_S);
    }
    return;
  }

  // ── Jungling ───────────────────────────────────────────────────────────
  if (agent.state === 'jungling' && agent.target?.type === 'jungle') {
    const camp = agent.target.ref;
    if (!camp || !camp.alive) { agent.target=null; agent.state='laning'; return; }
    if (dist(agent, camp) > 22) return;
    if (agent.cdAA <= 0) {
      camp.hp -= (agent.physDmg + agent.abilityPower * 0.3);
      agent.cdAA = Math.ceil(((agent.champData?.abilities?.aa?.cd)||2.0)*(1-agent.cdr)/TICK_S);
      if (camp.hp <= 0) {
        camp.alive    = false;
        camp.respawnAt = tick + camp.respawn;
        camp.hp       = camp.maxHp;
        agent.cs++;
        agent.gold   += camp.gold;
        grantXP(agent, camp.xp);
      }
    }
  }
}

// ─── Minion waves ─────────────────────────────────────────────────────────────

let _minionSeq = 0;
function spawnWave(minions, tick, waveNo, objs = []) {
  const scale = 1 + waveNo * 0.035;               // waves get slightly tougher
  ['blue', 'red'].forEach(side => {
    // once the enemy Heart is down this side spawns empowered "super" waves
    const enemyHeart = objs.find(o => o.id === (side === 'blue' ? 'r' : 'b') + '_heart');
    const superWave  = !!(enemyHeart && enemyHeart.destroyed);
    Object.keys(MINION_LANES).forEach(lane => {
      const path = side === 'blue' ? MINION_LANES[lane] : MINION_LANES[lane].slice().reverse();
      const types = ['melee', 'melee', 'melee', 'caster', 'caster'];
      if (waveNo > 0 && waveNo % 3 === 0) types.push('siege');
      if (superWave) types.push('siege', 'siege');
      types.forEach((type, i) => {
        const d = MINION_DEF[type];
        const sc = superWave ? scale * 1.6 : scale;
        const [sx, sy] = path[0];
        const [nx, ny] = path[1];
        const len = Math.hypot(nx - sx, ny - sy) || 1;
        const back = i * 3.5;                         // stagger the wave along the lane
        minions.push({
          id: ++_minionSeq, side, lane, type, path, seg: 1,
          x: sx - (nx - sx) / len * back, y: sy - (ny - sy) / len * back,
          hp: Math.round(d.hp * sc), maxHp: Math.round(d.hp * sc),
          dmg: d.dmg * sc, range: d.range, aggro: d.aggro, speed: d.speed,
          gold: d.gold, xp: d.xp, dead: false, lastHitBy: null,
        });
      });
    });
  });
}


// Next structure to siege on `enemySide`: finish the most-damaged lane first; once any
// lane is open (T1+T2 down) go for the Heart, then the Ancient.
function nextSiegeTarget(enemySide, objs) {
  const e = enemySide[0];
  const byId = id => objs.find(o => o.id === id);
  const lanes = ['top', 'mid', 'bot'].map(l => [byId(`${e}_${l}1`), byId(`${e}_${l}2`)]);
  const open = lanes.some(([a, b]) => a.destroyed && b.destroyed);
  const heart = byId(`${e}_heart`), ancient = byId(`${e}_ancient`);
  if (open) return !heart.destroyed ? heart : ancient;
  const rem = ([a, b]) => (a.destroyed ? 0 : a.hp) + (b.destroyed ? 0 : b.hp);
  // ties: mid first, then top, then bot — identical for both sides so neither team is favoured
  const pref = [1, 0, 2];
  const lane = pref.map(i => lanes[i]).sort((x, y) => rem(x) - rem(y))[0];
  return lane[0].destroyed ? lane[1] : lane[0];
}

function _structureTargetable(obj, objs) {
  if (obj.destroyed || obj.tempDown || obj.side === 'neutral') return false;
  // the Ancient is shielded until that side's Heart has fallen
  if (obj.type === 'ancient') {
    const heart = objs.find(o => o.id === obj.side[0] + '_heart');
    return !heart || heart.destroyed;
  }
  return true;
}

function tickMinions(minions, agents, objs, tick) {
  const live = minions.filter(m => !m.dead);
  live.forEach(m => {
    // 1. enemy minion in aggro range
    let tgt = null, best = m.aggro;
    live.forEach(e => { if (e.side !== m.side && !e.dead) { const d = dist(m, e); if (d < best) { best = d; tgt = e; } } });
    if (tgt) {
      if (best <= m.range) { tgt.hp -= m.dmg; }
      else _stepToward(m, tgt.x, tgt.y, m.speed);
      return;
    }
    // 2. enemy structure in range (minions siege towers once the wave is clear)
    const obj = objs.find(o => o.side !== m.side && _structureTargetable(o, objs) && dist(m, o) <= m.range + 14);
    if (obj) { obj.hp = Math.max(0, obj.hp - m.dmg * 1.5); return; }
    // 3. enemy champion standing in the wave
    const champ = agents.find(a => !a.isDead && a.side !== m.side && dist(m, a) <= Math.max(14, m.range));
    if (champ) { champ.hp -= m.dmg * 0.5; return; }
    // 4. otherwise walk the lane
    const wp = m.path[Math.min(m.seg, m.path.length - 1)];
    if (dist(m, { x: wp[0], y: wp[1] }) < 3 && m.seg < m.path.length - 1) m.seg++;
    _stepToward(m, wp[0], wp[1], m.speed);
  });
}

function _stepToward(o, tx, ty, speed) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d < 0.5) return;
  const st = Math.min(d, speed);
  o.x += dx / d * st; o.y += dy / d * st;
}

// Remove dead minions; pay last-hit gold and share XP with nearby enemy champions.
function resolveMinionDeaths(minions, agents) {
  for (let i = minions.length - 1; i >= 0; i--) {
    const m = minions[i];
    if (m.hp > 0) continue;
    m.dead = true;
    const enemySide = m.side === 'blue' ? 'red' : 'blue';
    if (!m.lastHitBy) {
      // A laner farming nearby times the last hit (chance scales with CS accuracy)
      const farmer = agents.filter(a => a.side === enemySide && !a.isDead && a.pos !== 'support'
                                     && a.target?.type === 'minion' && dist(a, m) <= a.atkRange + 14)
                           .sort((a, b) => dist(a, m) - dist(b, m))[0];
      if (farmer && Math.random() < 0.45 + (farmer.playerRef?.stats?.csAccuracy || 10) / 20 * 0.5) m.lastHitBy = farmer;
    }
    if (m.lastHitBy && !m.lastHitBy.isDead) {
      m.lastHitBy.cs++;
      m.lastHitBy.gold += m.gold;
    }
    const near = agents.filter(a => a.side === enemySide && !a.isDead && dist(a, m) <= MINION_XP_RANGE);
    const share = near.length > 1 ? 0.62 : 1;
    near.forEach(a => grantXP(a, Math.round(m.xp * share)));
    minions.splice(i, 1);
  }
}

// Compact per-tick minion list for the viewers: [id, side(0 blue/1 red), x, y, hp%, type]
function minionMap(minions) {
  return minions.filter(m => !m.dead).map(m => [m.id, m.side === 'blue' ? 0 : 1, Math.round(m.x), Math.round(m.y),
    Math.round(Math.max(0, m.hp) / m.maxHp * 100), m.type[0]]);
}

// ─── Objective counter-attack ─────────────────────────────────────────────────

function objCounterAttack(objs, agents, minions = []) {
  objs.forEach(obj => {
    if (obj.destroyed || obj.tempDown || obj.atkDmg <= 0 || obj.side === 'neutral') return;
    // Structures shoot enemy minions first (classic MOBA tower aggro) …
    const m = minions.filter(x => !x.dead && x.side !== obj.side && dist(x, obj) <= obj.atkRange)
                     .sort((a, b) => dist(a, obj) - dist(b, obj))[0];
    if (m) { m.hp -= obj.atkDmg * 7; return; }
    // … and only hit champions when no enemy minions are tanking.
    agents.forEach(ag => {
      if (ag.isDead || ag.side === obj.side) return;
      if (dist(ag, obj) <= obj.atkRange) ag.hp -= obj.atkDmg;
    });
  });
}

// ─── Respawn & recall ─────────────────────────────────────────────────────────

function processRespawns(agents, tick) {
  agents.forEach(ag => {
    if (!ag.isDead) return;
    if (tick >= ag.respawnAt) {
      ag.isDead = false;
      ag.hp     = Math.round(ag.maxHp * 0.65);
      ag.x      = SPAWN[ag.side].x + (Math.random()-0.5)*8;
      ag.y      = SPAWN[ag.side].y + (Math.random()-0.5)*8;
      ag.state  = 'laning';
      ag.target = null;
      buyItems(ag);
    }
  });
}

function processRecalls(agents, tick) {
  agents.forEach(ag => {
    if (ag.state !== 'recalling') return;
    if (tick - ag.recallStart >= 5) {
      ag.hp          = ag.maxHp;
      ag.x           = SPAWN[ag.side].x + (Math.random()-0.5)*6;
      ag.y           = SPAWN[ag.side].y + (Math.random()-0.5)*6;
      ag.state       = 'laning';
      ag.target      = null;
      ag.recallStart = -1;
      buyItems(ag);
    }
  });
}

// ─── Kill resolution ──────────────────────────────────────────────────────────

function resolveDeaths(agents, events, score, tick) {
  agents.forEach(ag => {
    if (ag.isDead || ag.hp > 0) return;
    ag.isDead    = true;
    ag.hp        = 0;
    ag.diedAt    = tick;
    ag.deaths++;
    ag.respawnAt = tick + Math.min(20, 5 + Math.floor(ag.level * 1.6)); // death timers grow with level → decisive late pushes
    ag.state     = 'dead';
    ag.target    = null;

    // Killer = last enemy champion to deal damage (credit stands even if they died since).
    // No champion damage in the window → executed by minions/structures (no kill gold).
    let killer = null;
    if (ag.recentDmgFrom.length > 0) {
      const lastHit = ag.recentDmgFrom[ag.recentDmgFrom.length - 1];
      killer = agents.find(a => a.id === lastHit.id) || null;
    }

    if (killer) {
      killer.kills++;
      killer.gold += 300;
      grantXP(killer, XP_KILL);
    }

    const assisters = agents.filter(a =>
      a.side !== ag.side && a !== killer && !a.isDead &&
      ag.recentDmgFrom.some(e => e.id === a.id)
    );
    assisters.forEach(a => { a.assists++; a.gold += 150; grantXP(a, XP_ASSIST); });
    ag.recentDmgFrom = [];

    const killSide = ag.side === 'blue' ? 'red' : 'blue';
    if (killSide === 'blue') score.blueKills++;
    else                     score.redKills++;

    events.push({
      tick, side: killSide, time: fmtTime(tick), type: 'kill',
      text: killer ? `${killer.champName} eliminated ${ag.champName}!` : `${ag.champName} was executed!`,
      blueKills: score.blueKills, redKills: score.redKills,
      blueShrines: score.blueShrines, redShrines: score.redShrines,
      blueRoots: score.blueRoots, redRoots: score.redRoots,
      advAfter: advScore(score, agents),
      positions: posMap(agents),
      killBlue: killSide === 'blue',
      victimSide: ag.side, victimRole: ag.pos,
      killerSide: killer?.side || null, killerRole: killer?.pos || null,
      agentStats: agentStatsMap(agents),
    });
  });
}

// ─── Objective resolution ─────────────────────────────────────────────────────

function resolveObjectives(objs, agents, events, score, tick) {
  objs.forEach(obj => {
    if (obj.destroyed || obj.tempDown || obj.hp > 0) return;
    obj.hp = 0;

    const capSide = obj.side === 'blue' ? 'red' : obj.side === 'red' ? 'blue'
      : (agents.filter(a => !a.isDead && dist(a,obj) < 80).sort((a,b) => dist(a,obj)-dist(b,obj))[0]?.side || 'blue');

    const near = agents.filter(a => a.side === capSide && !a.isDead && dist(a,obj) < 80);
    const xpR  = obj.type === 'warden' ? XP_WARDEN : XP_OBJ;
    const gdR  = obj.type === 'shrine' ? 150 : obj.type === 'warden' ? 300 : 200;
    near.forEach(a => { grantXP(a, xpR); a.gold += gdR; });
    // structures and epic monsters also pay the whole team (incl. when minions finish a tower)
    const teamGold = obj.type === 'warden' ? 250 : obj.type === 'shrine' ? 60 : obj.type === 'root' ? 75 : 0;
    if (teamGold) agents.filter(a => a.side === capSide).forEach(a => { a.gold += teamGold; if (!near.includes(a)) grantXP(a, Math.round(xpR * 0.4)); });

    const baseEv = {
      tick, side: capSide, time: fmtTime(tick), type: 'objective', objId: obj.id,
      blueKills: score.blueKills, redKills: score.redKills,
      blueShrines: score.blueShrines, redShrines: score.redShrines,
      blueRoots: score.blueRoots, redRoots: score.redRoots,
      positions: posMap(agents),
    };

    if (obj.type === 'shrine') {
      if (capSide === 'blue') score.blueShrines++; else score.redShrines++;
      obj.hp = obj.maxHp; obj.tempDown = true; obj.respawnAt = tick + 45;
      const drakeKey = capSide === 'blue' ? 'blueDrakes' : 'redDrakes';
      score[drakeKey] = Math.min(4, (score[drakeKey] || 0) + 1);
      const stacks = score[drakeKey];
      // Dragon soul at 4 stacks
      if (stacks >= 4) {
        const soulText = capSide === 'blue' ? 'Blue' : 'Red';
        events.push({ ...baseEv, type: 'dragon',
          text: `${soulText} claims the Grove Dragon Soul — their champions are empowered!`,
          advAfter: advScore(score, agents) });
      }
      events.push({ ...baseEv,
        text: `${capSide === 'blue' ? 'BLUE' : 'RED'} seized a Ley Shrine!`,
        advAfter: advScore(score, agents),
        blueShrines: score.blueShrines, redShrines: score.redShrines,
        shrineBlue: capSide==='blue', shrineRed: capSide==='red' });
    } else if (obj.type === 'warden') {
      score[capSide==='blue' ? 'blueWarden' : 'redWarden']++;
      obj.hp = obj.maxHp; obj.tempDown = true; obj.respawnAt = tick + 60;
      score.baronBuff[capSide] = 90; // 90 ticks = 3 min of baron buff
      // Empower all surviving champions on winning side
      near.forEach(a => { a._baronBuffed = 90; });
      events.push({ ...baseEv, type: 'baron',
        text: `${capSide === 'blue' ? 'BLUE' : 'RED'} slew the Grove Warden — Hand of the Warden buff granted!`,
        advAfter: advScore(score, agents),
        wardenBlue: capSide==='blue', wardenRed: capSide==='red' });
    } else if (obj.type === 'root') {
      obj.destroyed = true;
      if (capSide === 'blue') score.blueRoots++; else score.redRoots++;
      events.push({ ...baseEv,
        text: `${capSide === 'blue' ? 'BLUE' : 'RED'} destroyed ${obj.side === 'blue' ? 'Blue' : 'Red'}'s Root tower!`,
        advAfter: advScore(score, agents),
        blueRoots: score.blueRoots, redRoots: score.redRoots,
        towerBlue: capSide==='blue' });
    } else if (obj.type === 'ancient') {
      obj.destroyed  = true;
      score.winner   = capSide;
    }
  });
}

// ─── Per-tick systems ─────────────────────────────────────────────────────────

function tickCDs(agents) {
  agents.forEach(ag => {
    if (ag._baronBuffed > 0) ag._baronBuffed--;
    if (ag.cdAA  > 0) ag.cdAA--;
    if (ag.cdQ   > 0) ag.cdQ--;
    if (ag.cdE   > 0) ag.cdE--;
    if (ag.cdUlt > 0) ag.cdUlt--;
  });
}

function tickJungles(jungles, tick) {
  jungles.forEach(c => {
    if (!c.alive && tick >= (c.respawnAt || 0)) { c.alive = true; c.hp = c.maxHp; }
  });
}

function tickObjRespawns(objs, tick) {
  objs.forEach(o => { if (o.tempDown && tick >= o.respawnAt) o.tempDown = false; });
}

function tickPassiveGold(agents) {
  // Passive income only — CS now comes from last-hitting real minions.
  agents.forEach(ag => {
    if (ag.isDead) return;
    ag.gold += ag.pos === 'jungle' ? 34 : 30;
  });
}

function tickRegen(agents) {
  agents.forEach(ag => {
    if (ag.isDead || ag.state === 'fighting') return;
    const r = ag.items.reduce((s,id) => s + (ITEM_MAP[id]?.stats?.hpRegen||0), 0.5);
    if (r > 0) ag.hp = Math.min(ag.maxHp, ag.hp + r);
  });
}

// ─── Snapshot & helpers ───────────────────────────────────────────────────────

function buildSnapshot(tick, agents, objs, score) {
  return {
    tick,
    positions: posMap(agents),
    objectives: objs.map(o => ({
      id: o.id, hp: Math.max(0, o.hp), maxHp: o.maxHp,
      destroyed: !!o.destroyed, tempDown: !!o.tempDown,
    })),
    score: { ...score },
  };
}

function posMap(agents) {
  const m = { blue:{}, red:{} };
  agents.forEach(ag => {
    m[ag.side][ag.pos] = {
      x: Math.round(ag.x), y: Math.round(ag.y),
      alive: !ag.isDead,
      isDead: !!ag.isDead,
      hp: Math.round(ag.hp), maxHp: ag.maxHp,
      champName: ag.champName,
      // view-layer hints (3D viewer): current state + what the agent is targeting
      state: ag.state, level: ag.level || 1,
      tid: ag.target?.ref?.id || null,
      tx: ag.target ? Math.round(ag.target.ref ? ag.target.ref.x : ag.target.x) : undefined,
      ty: ag.target ? Math.round(ag.target.ref ? ag.target.ref.y : ag.target.y) : undefined,
    };
  });
  return m;
}

function dist(a, b) {
  const dx = a.x-b.x, dy = a.y-b.y;
  return Math.sqrt(dx*dx+dy*dy);
}

function findNearest(agent, pool, range) {
  let best = null, bestD = range;
  pool.forEach(p => { const d = dist(agent,p); if (d < bestD) { bestD=d; best=p; } });
  return best;
}

function gameSeconds(tick) { return tick * TICK_S * CLOCK_SCALE; }
function fmtTime(tick) {
  const s = gameSeconds(tick);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function advScore(score, agents) {
  const bA = agents.filter(a=>a.side==='blue'&&!a.isDead).length;
  const rA = agents.filter(a=>a.side==='red' &&!a.isDead).length;
  const bs = score.blueKills*3 + score.blueShrines*4 + score.blueRoots*7 + bA;
  const rs = score.redKills *3 + score.redShrines *4 + score.redRoots *7 + rA;
  return Math.round(Math.min(84, Math.max(16, bs/(bs+rs||1)*100)));
}

function totalGold(agents, side) {
  return agents.filter(a=>a.side===side).reduce((s,a)=>s+a.gold,0);
}

// Commentary — contextual, driven by live game state
function _pickCommentary(all, score, tick) {
  const gameMin = Math.floor(gameSeconds(tick) / 60);
  const bGold   = totalGold(all, 'blue');
  const rGold   = totalGold(all, 'red');
  const diff    = bGold - rGold;
  const bAlive  = all.filter(a => a.side === 'blue' && !a.isDead).length;
  const rAlive  = all.filter(a => a.side === 'red'  && !a.isDead).length;
  const totalK  = score.blueKills + score.redKills;

  const pool = [
    `${totalK} kills across the map — this one is intense.`,
    tick < PHASE_1 ? 'Both teams farming carefully in the laning phase.' :
    tick < PHASE_2 ? 'The map is opening up as teams begin to rotate.' :
                   'Late-game teamfight battles are deciding this match.',
    Math.abs(diff) > 4000
      ? `${diff > 0 ? 'Blue' : 'Red'} is sitting on a ${Math.abs(Math.round(diff/1000))}K gold lead — snowball incoming.`
      : 'The gold is remarkably even — anyone can take this.',
    bAlive < rAlive ? 'Red has the numbers advantage right now.' :
    rAlive < bAlive ? 'Blue has the numbers advantage — a fight could break out any moment.' :
                      'Both teams at full strength — the next fight is critical.',
    'Vision control is the invisible war being fought across the Grove.',
    score.blueRoots > score.redRoots
      ? `Blue has taken ${score.blueRoots - score.redRoots} more towers — structural lead.`
      : score.redRoots > score.blueRoots
      ? `Red leads in tower gold — map control advantage.`
      : 'Tower damage is even — no structural advantage yet.',
    'The jungler\'s pathing has been a key differentiator this game.',
    'Mid lane priority is dictating where resources go.',
    'Support roaming is opening up plays around the map.',
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Fight rotation: after a decisive teamfight, winning side rotates to objectives
function _checkFightRotation(all, events, score, objs, tick) {
  const WINDOW = 10; // ticks
  // Count recently dead per side
  const bDead = all.filter(a => a.side === 'blue' && a.isDead && tick - (a.diedAt ?? -99) < WINDOW).length;
  const rDead = all.filter(a => a.side === 'red'  && a.isDead && tick - (a.diedAt ?? -99) < WINDOW).length;
  const diff = rDead - bDead; // positive = blue won fight
  if (Math.abs(diff) < 2) return;
  if (score._lastRotation !== undefined && tick - score._lastRotation < 15) return; // one call per fight

  const winningSide = diff > 0 ? 'blue' : 'red';
  const winners = all.filter(a => a.side === winningSide && !a.isDead);
  if (winners.length < 2) return;

  const gameMin = gameSeconds(tick) / 60;
  const shrine  = objs.find(o => o.type === 'shrine' && !o.tempDown);
  const warden  = objs.find(o => o.type === 'warden' && !o.tempDown);
  const enemy   = winningSide === 'blue' ? 'red' : 'blue';
  const towerSeq = enemy === 'red'
    ? ['r_top1','r_top2','r_mid1','r_mid2','r_bot1','r_bot2','r_heart','r_ancient']
    : ['b_bot1','b_bot2','b_mid1','b_mid2','b_top1','b_top2','b_heart','b_ancient'];
  const nextTower = nextSiegeTarget(enemy, objs);
  const W = winningSide === 'blue' ? 'Blue' : 'Red';

  let rotTarget = null, rotType = 'objective', rotText = '';
  const roll = Math.random();
  if (tick >= PHASE_2 && warden && roll < 0.35) {
    rotTarget = warden; rotType = 'warden';
    rotText = `${W} wins the teamfight ${diff > 0 ? rDead : bDead}-for-${diff > 0 ? bDead : rDead} — rotating to Grove Warden!`;
  } else if (shrine && roll < 0.55) {
    rotTarget = shrine; rotType = 'objective';
    rotText = `${W} wins the fight — taking Ley Shrine!`;
  } else if (nextTower) {
    rotTarget = nextTower; rotType = 'objective';
    rotText = `${W} capitalizes — pushing ${enemy} towers!`;
  }

  if (rotTarget) {
    winners.forEach(ag => { ag.state = 'contesting'; ag.target = { type: rotType, ref: rotTarget }; });
    score._lastRotation = tick;
    // announcement only — the capture itself is reported by resolveObjectives
    events.push({ tick, type: 'commentary', rotation: true,
      time: fmtTime(tick), side: winningSide, text: rotText,
      blueKills: score.blueKills, redKills: score.redKills,
      blueShrines: score.blueShrines, redShrines: score.redShrines,
      blueRoots: score.blueRoots, redRoots: score.redRoots,
      advAfter: advScore(score, all), positions: posMap(all) });
  }
}

// ─── Main simulation entry point ──────────────────────────────────────────────

function _applyTacticsModifiers(agents, side) {
  // Read human team tactics from global G state (G loaded in state.js before sim)
  if (typeof G === 'undefined' || !G) return;
  const humanId = G.humanTeamId;
  const humanTeam = G.teams[humanId];
  if (!humanTeam) return;
  const t = humanTeam.tactics;
  if (!t) return;

  // Determine which side is human
  const isHumanSide = humanTeam.isHuman;
  // agents are all blue or all red here, check by side
  const humanSide = agents[0]?.side;

  agents.forEach(ag => {
    // Combat strategy modifiers (affects all agents on the human side)
    if (t.combatStrategy === 'poke') {
      ag.statBonus = (ag.statBonus || 1);
      ag._tacticAggression = 0.75; // agents more cautious
    } else if (t.combatStrategy === 'engage') {
      ag._tacticAggression = 1.2;  // agents engage sooner
    } else if (t.combatStrategy === 'bait') {
      ag._tacticAggression = 0.9;
      ag._tacticMobility   = 1.1;
    }

    // Jungle style
    if (ag.pos === 'jungle') {
      if (t.jungleStyle === 'shrines') ag._tacticObjWeight = 1.4;
      else if (t.jungleStyle === 'counter') ag._tacticEnemyJgWeight = 1.3;
      else ag._tacticFarmWeight = 1.2;
    }

    // Objective setup
    if (t.objectiveSetup === 'group')     ag._tacticGrouping = 1.3;
    else if (t.objectiveSetup === 'split') ag._tacticSplit    = 1.3;

    // Ancient siege style
    if (t.ancientSiege === 'dive') ag._tacticAncientDive = true;

    // Top laner warden join
    if (ag.pos === 'top') {
      if (t.topJoinWarden === 'always') ag._tacticWardenJoin  = 1.5;
      else if (t.topJoinWarden === 'never') ag._tacticWardenJoin = 0.3;
    }

    // Lane focus → ADC/jungler get slight boost
    if (t.laneFocus === 'mid_bot' && (ag.pos === 'adc' || ag.pos === 'support')) {
      ag._tacticLanePriority = 1.15;
    } else if (t.laneFocus === 'top_mid' && (ag.pos === 'top' || ag.pos === 'jungle')) {
      ag._tacticLanePriority = 1.15;
    }
  });
}

function simulateMatch(blueTeamArr, redTeamArr, blueName, redName, preDraft) {
  const draft = preDraft || draftChampions(blueTeamArr, redTeamArr);

  // Init agents
  const blueAgents = blueTeamArr.map((p, i) =>
    initAgent('blue', i, p, (draft.blue[i]?.champion || draft.blue[i]) || 'Wraithfern'));
  const redAgents  = redTeamArr.map((p, i) =>
    initAgent('red',  i, p, (draft.red[i]?.champion  || draft.red[i])  || 'Bombspore'));
  const all = [...blueAgents, ...redAgents];

  // Apply tactics modifiers for human team
  if (typeof G !== 'undefined' && G) {
    const humanTeam = G.teams[G.humanTeamId];
    const humanSide = (humanTeam && blueName === humanTeam.name) ? 'blue' : 'red';
    const humanAgents = humanSide === 'blue' ? blueAgents : redAgents;
    _applyTacticsModifiers(humanAgents, humanSide);
  }

  all.forEach(ag => buyItems(ag));

  // Init objectives and jungles
  const objs    = OBJ_DEFS.map(d => ({ ...d, hp: d.maxHp, destroyed: false, tempDown: false, respawnAt: 0 }));
  const jungles = JUNGLE_DEF.map(d => ({ ...d, hp: d.maxHp, alive: true, respawnAt: 0 }));

  const score = {
    blueKills:0, redKills:0,
    blueShrines:0, redShrines:0,
    blueRoots:0, redRoots:0,
    blueWarden:0, redWarden:0,
    blueDrakes: 0, redDrakes: 0, baronBuff: { blue: 0, red: 0 },
    winner: null,
  };

  const events = [], snapshots = [], goldSnapshots = [];
  const minions = [];
  let waveNo = 0;
  all.forEach(ag => { ag._minions = minions; ag._objs = objs; });

  // ── Main game loop ────────────────────────────────────────────────────────
  for (let tick = 0; tick <= MAX_TICKS && !score.winner; tick++) {
    const phase = tick < PHASE_1 ? 0 : tick < PHASE_2 ? 1 : 2;

    tickCDs(all);
    processRespawns(all, tick);
    processRecalls(all, tick);
    tickJungles(jungles, tick);
    tickObjRespawns(objs, tick);
    tickPassiveGold(all);
    tickRegen(all);
    if (tick >= WAVE_FIRST_TICK && (tick - WAVE_FIRST_TICK) % WAVE_INTERVAL === 0) spawnWave(minions, tick, waveNo++, objs);

    // Act in a random order each tick so neither side always moves/strikes first
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }

    // AI decisions
    all.forEach(ag => {
      if (ag.isDead) return;
      decideAction(ag,
        all.filter(a => a.side === ag.side && a !== ag),
        all.filter(a => a.side !== ag.side),
        objs, jungles, tick, phase);
    });

    // Movement
    all.forEach(ag => { if (!ag.isDead) moveAgent(ag); });

    // Combat
    all.forEach(ag => {
      if (ag.isDead) return;
      doCombat(ag, all.filter(a => a.side !== ag.side), objs, jungles, tick);
    });

    // Minions fight, push and siege
    tickMinions(minions, all, objs, tick);

    // An Ancient whose Heart has fallen withers (4% max HP per tick) — keeps endgames short
    ['b', 'r'].forEach(sd => {
      const heart = objs.find(o => o.id === sd + '_heart'), anc = objs.find(o => o.id === sd + '_ancient');
      if (heart?.destroyed && anc && !anc.destroyed) anc.hp = Math.max(0, anc.hp - anc.maxHp * 0.04);
    });

    // Objective counter-attacks (towers prefer minions)
    objCounterAttack(objs, all, minions);
    resolveMinionDeaths(minions, all);

    // Resolve deaths and captures
    resolveDeaths(all, events, score, tick);
    if (!score.winner) _checkFightRotation(all, events, score, objs, tick);
    if (!score.winner) resolveObjectives(objs, all, events, score, tick);

    // Snapshots every 4 ticks
    if (tick % 4 === 0)
      snapshots.push(buildSnapshot(tick, all, objs, score));

    // Gold chart
    goldSnapshots.push({ lead: totalGold(all,'blue') - totalGold(all,'red'), time: tick });

    // Move event every tick (lightweight, no text)
    events.push({
      tick, type: 'move',
      time: fmtTime(tick),
      positions: posMap(all),
      minions: minionMap(minions),
      objectives: objs.map(o => ({
        id: o.id, hp: Math.max(0, o.hp), maxHp: o.maxHp,
        destroyed: !!o.destroyed, tempDown: !!o.tempDown,
      })),
      blueKills: score.blueKills, redKills: score.redKills,
      blueShrines: score.blueShrines, redShrines: score.redShrines,
      blueRoots: score.blueRoots, redRoots: score.redRoots,
      advAfter: advScore(score, all),
      agentStats: agentStatsMap(all),
    });

    // Commentary every 18 ticks
    if (tick > 0 && tick % 18 === 0 && !score.winner) {
      events.push({
        tick, side: null, time: fmtTime(tick), type: 'commentary',
        text: _pickCommentary(all, score, tick),
        blueKills:score.blueKills, redKills:score.redKills,
        blueShrines:score.blueShrines, redShrines:score.redShrines,
        blueRoots:score.blueRoots, redRoots:score.redRoots,
        advAfter: advScore(score, all),
        positions: posMap(all),
      });
    }

    // Team comms every ~20 ticks
    if (tick > 0 && tick % 20 === 11 && !score.winner) {
      const roles  = ['top','jungle','mid','adc','support'];
      const role   = roles[tick % roles.length];
      const side   = tick % 3 === 0 ? 'blue' : 'red';
      const commsPool = {
        top:     ['I need gank pressure — they have flash though.', 'Splitting side lane, keep them occupied.', 'I can flank if you engage first.', 'Wave frozen — don\'t overextend.'],
        jungle:  ['Dragon in 40 — get vision now.', 'Pathing through mid after this camp.', 'Counter-jungling if they step up.', 'Tracking their jungler — be careful.'],
        mid:     ['Roaming top after I shove this wave.', 'Need peel — I\'m squishy in this matchup.', 'Lane is pushed — let\'s contest Shrine.', 'They have ult — play safe for 30s.'],
        adc:     ['Peeling for me matters more than engage.', 'I outrange them — let\'s poke before objectives.', 'Support, follow up if I engage.', 'Need one more item then I\'m online.'],
        support: ['Setting vision around Ley Shrine.', 'Their support is aggressive — trade carefully.', 'I\'ll peel — you clean up the fight.', 'Roaming mid — ADC just recall.'],
      };
      const lines = commsPool[role] || commsPool.mid;
      events.push({
        tick, type: 'comms', time: fmtTime(tick), side, role,
        text: lines[Math.floor(Math.random() * lines.length)],
        positions: posMap(all),
      });
    }

    // Force end at MAX_TICKS (40:00 on the game clock) if no Ancient has fallen
    if (!score.winner && tick >= MAX_TICKS) {
      const bs = score.blueKills*3 + score.blueShrines*5 + score.blueRoots*8;
      const rs = score.redKills *3 + score.redShrines *5 + score.redRoots *8;
      if (bs !== rs) { score.winner = bs > rs ? 'blue' : 'red'; }
      else {
        const ba = all.filter(a=>a.side==='blue'&&!a.isDead).length;
        const ra = all.filter(a=>a.side==='red' &&!a.isDead).length;
        score.winner = ba >= ra ? 'blue' : 'red';
      }
    }
  }

  if (!score.winner) {
    const bs = score.blueKills + score.blueShrines + score.blueRoots;
    const rs = score.redKills  + score.redShrines  + score.redRoots;
    score.winner = bs >= rs ? 'blue' : 'red';
  }

  const endTick = goldSnapshots.length;
  events.push({
    tick: endTick, side: score.winner, time: fmtTime(endTick), type: 'result',
    text: `${score.winner === 'blue' ? blueName : redName} wins!`,
    blueKills:score.blueKills, redKills:score.redKills,
    blueShrines:score.blueShrines, redShrines:score.redShrines,
    blueRoots:score.blueRoots, redRoots:score.redRoots,
    advAfter: score.winner === 'blue' ? 80 : 20,
    positions: posMap(all),
    agentStats: agentStatsMap(all),
  });

  // Build KDA table data
  const playerStats = {
    blue: blueAgents.map((ag, i) => ({
      name:    blueTeamArr[i]?.name || ag.champName,
      pos:     ag.pos,
      champion:ag.champName,
      kills:   ag.kills, deaths: ag.deaths, assists: ag.assists, cs: ag.cs,
      gold:    Math.round(ag.gold || 0),
      items:   (ag.items || []).map(id => ITEM_MAP[id]?.name || id),
    })),
    red: redAgents.map((ag, i) => ({
      name:    redTeamArr[i]?.name || ag.champName,
      pos:     ag.pos,
      champion:ag.champName,
      kills:   ag.kills, deaths: ag.deaths, assists: ag.assists, cs: ag.cs,
      gold:    Math.round(ag.gold || 0),
      items:   (ag.items || []).map(id => ITEM_MAP[id]?.name || id),
    })),
  };

  // Persist career stats to G if available
  if (typeof G !== 'undefined' && G?.players) {
    _persistCareer(blueAgents, blueTeamArr, score.winner === 'blue');
    _persistCareer(redAgents,  redTeamArr,  score.winner === 'red');
    if (G.stats) G.stats.totalMatches = (G.stats.totalMatches||0) + 1;
  }

  return {
    winner: score.winner,
    blueKills: score.blueKills, redKills: score.redKills,
    blueShrines: score.blueShrines, redShrines: score.redShrines,
    blueRoots: score.blueRoots, redRoots: score.redRoots,
    duration: Math.round(gameSeconds(endTick) / 60),
    goldSnapshots,
    playerStats,
    events,
    snapshots,
    draft,
  };
}

function _persistCareer(agents, players, won) {
  agents.forEach((ag, i) => {
    const p  = players[i];
    const cp = p?.id ? G.players[p.id] : null;
    if (!cp?.career) return;
    cp.career.gamesPlayed++;
    if (won) cp.career.wins++; else cp.career.losses++;
    cp.career.kills       += ag.kills;
    cp.career.deaths      += ag.deaths;
    cp.career.assists     += ag.assists;
    cp.career.cs          += ag.cs;
    cp.career.damageDealt += ag.damageDealt;
    const cs = cp.career.championStats;
    if (!cs[ag.champName])
      cs[ag.champName] = { games:0, kills:0, deaths:0, assists:0 };
    cs[ag.champName].games++;
    cs[ag.champName].kills   += ag.kills;
    cs[ag.champName].deaths  += ag.deaths;
    cs[ag.champName].assists += ag.assists;
  });
}

// ─── Quick sim (AI vs AI, no PBP) ────────────────────────────────────────────

function quickSimulateMatch(homePlayers, awayPlayers) {
  const homeScore = homePlayers.reduce((s,p) => s + (p ? calcOverall(p) : 50), 0);
  const awayScore = awayPlayers.reduce((s,p) => s + (p ? calcOverall(p) : 50), 0);
  const diff      = homeScore - awayScore;
  return Math.random() * 100 < Math.min(85, Math.max(15, 50 + diff * 0.5)) ? 'blue' : 'red';
}

// ─── Agent stats snapshot helper ─────────────────────────────────────────────

function agentStatsMap(agents) {
  const m = { blue: {}, red: {} };
  agents.forEach(ag => {
    m[ag.side][ag.pos] = {
      kills:   ag.kills   || 0,
      deaths:  ag.deaths  || 0,
      assists: ag.assists || 0,
      cs:      ag.cs      || 0,
      gold:    Math.round(ag.gold || 0),
      hp:      ag.isDead ? 0 : Math.round(ag.hp || 0),
      maxHp:   Math.round(ag.maxHp || 1),
      isDead:  !!ag.isDead,
      level:   ag.level   || 1,
      items:   [...(ag.items || [])],
      ultReady: ag.cdUlt <= 0 && ag.level >= 6,
    };
  });
  return m;
}

// ─── Draft system ─────────────────────────────────────────────────────────────

const SYNERGY_CLASSES = {
  ENGAGE:  ['tank','fighter'],
  POKE:    ['mage','marksman'],
  PICK:    ['assassin','sentinel'],
  PROTECT: ['sentinel','marksman'],
  SCALING: ['mage','marksman'],
};

const COMP_COUNTERS = {
  ENGAGE:  ['POKE','SCALING'],
  POKE:    ['ENGAGE','PICK'],
  PICK:    ['PROTECT','SCALING'],
  PROTECT: ['ENGAGE','POKE'],
  SCALING: ['PICK','ENGAGE'],
};

const COUNTERED_BY = {
  tank:     ['assassin','mage'],
  fighter:  ['mage','marksman'],
  assassin: ['sentinel','tank'],
  mage:     ['assassin','marksman'],
  marksman: ['assassin','fighter'],
  sentinel: ['mage','fighter'],
};

function getDominantCompType(picks) {
  const counts = {};
  picks.forEach(c => { const ct = CHAMPIONS[c]?.compType||'ENGAGE'; counts[ct]=(counts[ct]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'ENGAGE';
}

function champBanValue(champName, player) {
  const cd = CHAMPIONS[champName];
  if (!cd) return 0;
  const roleClass = { top:'tank', jungle:'assassin', mid:'mage', adc:'marksman', support:'sentinel' }[player.position] || 'mage';
  const classFit  = cd.class.toLowerCase() === roleClass ? 1.2 : 0.85;
  return ((player.stats?.mechanics||10)/20*15 + (player.stats?.csAccuracy||10)/2) * classFit;
}

function generateBans(targetPlayers, numBans) {
  const banned = [];
  targetPlayers.forEach(p => {
    if (!p) return;
    const top = [...(p.champions||[])].sort((a,b)=>champBanValue(b,p)-champBanValue(a,p))[0];
    if (top && !banned.includes(top)) banned.push(top);
  });
  return banned.slice(0, numBans);
}

function getCounterScore(bluePicks, redPicks) {
  let score = 0;
  bluePicks.forEach(bc => {
    const bClass = CHAMPIONS[bc]?.class?.toLowerCase()||'mage';
    redPicks.forEach(rc => {
      const rClass = CHAMPIONS[rc]?.class?.toLowerCase()||'mage';
      if (COUNTERED_BY[rClass]?.includes(bClass)) score += 1;
      if (COUNTERED_BY[bClass]?.includes(rClass)) score -= 1;
    });
  });
  return Math.round(score * 0.25 * 10) / 10;
}

function pickChampion(player, pos, banned, allPicked, enemyPicks) {
  if (!player) {
    const fb = Object.keys(CHAMPIONS).find(c => !banned.includes(c) && !allPicked.includes(c));
    return fb || 'Wraithfern';
  }
  const pool    = (player.champions||[]).filter(c => !banned.includes(c) && !allPicked.includes(c));
  const counter = pool.find(c => {
    const cl = CHAMPIONS[c]?.class?.toLowerCase();
    return enemyPicks.some(ec => COUNTERED_BY[CHAMPIONS[ec]?.class?.toLowerCase()]?.includes(cl));
  });
  return counter || pool[0]
    || Object.keys(CHAMPIONS).find(c => !banned.includes(c) && !allPicked.includes(c))
    || 'Wraithfern';
}

function draftChampions(blueTeamArr, redTeamArr) {
  const blueBans = generateBans(redTeamArr,  5);
  const redBans  = generateBans(blueTeamArr, 5);
  const allBans  = [...blueBans, ...redBans];
  const picked   = [];
  const bluePicks = new Array(5), redPicks = new Array(5);

  // Snake pick order (B1 R1 R2 B2 B3 R3 R4 B4 B5 R5) so neither side sees the other's full comp
  // before picking (previously blue locked all 5 and red counter-picked every role).
  const ORDER = [['blue',0],['red',0],['red',1],['blue',1],['blue',2],['red',2],['red',3],['blue',3],['blue',4],['red',4]];
  ORDER.forEach(([side, i]) => {
    const team  = side === 'blue' ? blueTeamArr : redTeamArr;
    const mine  = side === 'blue' ? bluePicks : redPicks;
    const enemy = (side === 'blue' ? redPicks : bluePicks).filter(Boolean);
    const c = pickChampion(team[i], POSITIONS[i], allBans, picked, enemy);
    mine[i] = c; picked.push(c);
  });

  return {
    blue: bluePicks, red: redPicks,
    bans: { blue: blueBans, red: redBans },
    blueSynergies: SYNERGY_CLASSES[getDominantCompType(bluePicks)] || [],
    redSynergies:  SYNERGY_CLASSES[getDominantCompType(redPicks)]  || [],
    counterScore:  getCounterScore(bluePicks, redPicks),
  };
}

// ─── Godot match data export ───────────────────────────────────────────────────
// Call this after simulateMatch() to get JSON suitable for the Godot viewer.
// Pass in the result object returned by simulateMatch(), plus team name strings.

window.exportMatchDataForGodot = function(simResult, blueName, redName) {
  if (!simResult || !simResult.events) return null;

  // Convert simulation events (which include 'move' events with positions)
  // into the tick format Godot expects.
  const godotTicks = [];

  simResult.events.forEach(ev => {
    // Only emit ticks for move/kill/objective/commentary/result events
    if (!ev.positions) return;

    const tick = {
      time: ev.time || '0:00',
      blueKills:   ev.blueKills   || 0,
      redKills:    ev.redKills    || 0,
      blueShrines: ev.blueShrines || 0,
      redShrines:  ev.redShrines  || 0,
      blueRoots:   ev.blueRoots   || 0,
      redRoots:    ev.redRoots    || 0,
      positions:   { blue: {}, red: {} },
      events:      [],
      text:        '',
    };

    // Convert position map — include champName and hp data
    ['blue','red'].forEach(side => {
      const sidePos = ev.positions[side] || {};
      Object.keys(sidePos).forEach(role => {
        const p = sidePos[role];
        tick.positions[side][role] = {
          champName: p.champName || role,
          x:      p.x || 150,
          y:      p.y || 150,
          hp:     p.alive === false ? 0 : (p.hp || 0),
          maxHp:  p.maxHp || 420,
          isDead: p.isDead !== undefined ? p.isDead : !p.alive,
        };
      });
    });

    // Add the event itself as a sub-event
    if (ev.type !== 'move') {
      tick.events.push({ type: ev.type, text: ev.text || '' });
      if (ev.text) tick.text = ev.text;
    }

    godotTicks.push(tick);
  });

  const output = {
    teams: {
      blue: { name: blueName || 'Blue Team' },
      red:  { name: redName  || 'Red Team'  },
    },
    ticks: godotTicks,
    winner: simResult.winner,
    playerStats: simResult.playerStats || {},
  };

  return JSON.stringify(output, null, 2);
};

// ─── Save match data for Godot (browser/Electron) ─────────────────────────────
// If running in Electron (Node.js available), writes match_data.json to disk.
// Otherwise, saves to localStorage for potential browser-based use.

window.saveMatchDataForGodot = function(simResult, blueName, redName) {
  const json = window.exportMatchDataForGodot(simResult, blueName, redName);
  if (!json) return false;

  // Electron / Node.js environment
  if (typeof require !== 'undefined') {
    try {
      const fs   = require('fs');
      const path = require('path');
      // Write next to index.html (project root)
      const outPath = path.join(process.cwd(), 'match_data.json');
      fs.writeFileSync(outPath, json, 'utf8');
      console.log('[Godot export] Wrote match_data.json to', outPath);
      return outPath;
    } catch(e) {
      console.warn('[Godot export] Could not write file:', e.message);
    }
  }

  // Browser fallback — localStorage
  try {
    localStorage.setItem('godot_match_data', json);
    console.log('[Godot export] Saved match data to localStorage (godot_match_data)');
  } catch(e) {
    console.warn('[Godot export] localStorage save failed:', e.message);
  }
  return true;
};

// ─── Launch Godot viewer (Electron only) ──────────────────────────────────────
// Saves match data then spawns the Godot executable with --match-data flag.

window.launchGodotViewer = function(simResult, blueName, redName) {
  const savedPath = window.saveMatchDataForGodot(simResult, blueName, redName);
  if (!savedPath || typeof require === 'undefined') {
    console.warn('[Godot launch] Not in Electron or save failed. Cannot launch Godot.');
    return false;
  }
  try {
    const { spawn } = require('child_process');
    const path = require('path');
    // Resolve paths relative to working directory
    const godotExe = path.join(process.cwd(),
      'Godot_v4.6.1-stable_win64.exe', 'Godot_v4.6.1-stable_win64.exe');
    const projectPath = path.join(process.cwd(), 'godot');
    const proc = spawn(godotExe, [
      '--path', projectPath,
      '--match-data', savedPath,
    ], { detached: true, stdio: 'ignore' });
    proc.unref();
    console.log('[Godot launch] Launched Godot viewer, PID', proc.pid);
    return true;
  } catch(e) {
    console.warn('[Godot launch] Failed to spawn Godot:', e.message);
    return false;
  }
};
