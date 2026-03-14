// js/data/champions.js — The Ancient Grove champion data
//
// compType drives team composition synergies (same keys used in sim engine):
//   ENGAGE    → bonus teamfighting  | POKE      → bonus laning
//   ASSASSIN  → bonus early picks   | PROTECT   → bonus carry effectiveness
//   SPLITPUSH → bonus Root pressure | SCALING   → bonus late game
//
// class: Fighter | Tank | Assassin | Mage | Marksman | Sentinel
// role:  primary position (vanguard | ranger | arcanist | hunter | warden)
// ult:   ultimate ability description (flavor, used in PBP/UI)

const CHAMPIONS = {

  // ─── FIGHTERS (6) — primary: vanguard ───────────────────────────────────────

  'Thornback': {
    class:'Fighter', compType:'ENGAGE', role:'vanguard',
    abilities:['Shield Slam','Spine Throw'],
    ult:'Wild Rampage — charges forward, stunning all enemies in path',
  },
  'Sylvara': {
    class:'Fighter', compType:'SPLITPUSH', role:'vanguard',
    abilities:['Blade Dance','Swift Parry'],
    ult:'Thousand Cuts — unleashes a flurry of strikes on a single target',
  },
  'Grovekeeper': {
    class:'Fighter', compType:'ENGAGE', role:'vanguard',
    abilities:['Stone Fist','Earthen Stomp'],
    ult:"Guardian's Wrath — petrifies the first enemy struck for 2 seconds",
  },
  'Briarvex': {
    class:'Fighter', compType:'ENGAGE', role:'vanguard',
    abilities:['Briar Lash','Spine Burst'],
    ult:'Frenzy — enters berserker state, ignoring crowd control for 4 seconds',
  },
  'Stonehide': {
    class:'Fighter', compType:'SCALING', role:'vanguard',
    abilities:['Rock Hurl','Fortify'],
    ult:'Avalanche Crush — summons a boulder that rolls through the lane',
  },
  'Wanderclaw': {
    class:'Fighter', compType:'SPLITPUSH', role:'ranger',
    abilities:['Pounce','Rend'],
    ult:"Predator's Mark — marks prey; next attack deals massive execute damage",
  },

  // ─── TANKS (4) — primary: vanguard ──────────────────────────────────────────

  'Deeproot': {
    class:'Tank', compType:'ENGAGE', role:'vanguard',
    abilities:['Root Snare','Bark Shield'],
    ult:'Ancient Uprising — erupts roots from the ground, launching nearby enemies',
  },
  'Ironbark': {
    class:'Tank', compType:'ENGAGE', role:'vanguard',
    abilities:['Ironwood Strike','Petrify'],
    ult:'Ironwall Fortress — becomes immovable and reflects 40% of damage taken',
  },
  'Bogmaw': {
    class:'Tank', compType:'ENGAGE', role:'vanguard',
    abilities:['Mud Fling','Sinkhole'],
    ult:'Swamp Surge — pulls all nearby enemies toward center with a vortex',
  },
  'Ashenveil': {
    class:'Tank', compType:'SCALING', role:'vanguard',
    abilities:['Cursed Blade','Veil of Ash'],
    ult:'Death Warrant — marks a target; absorbs damage until mark expires, then returns it',
  },

  // ─── ASSASSINS (5) — primary: arcanist / ranger ─────────────────────────────

  'Shade': {
    class:'Assassin', compType:'ASSASSIN', role:'arcanist',
    abilities:['Shadow Step','Umbral Strike'],
    ult:'Void Execution — blinks behind target, dealing burst damage and silencing',
  },
  'Hexwing': {
    class:'Assassin', compType:'ASSASSIN', role:'ranger',
    abilities:['Dive Bomb','Wing Slash'],
    ult:'Murder of Crows — summons a flock that tears through the target',
  },
  'Mirethyst': {
    class:'Assassin', compType:'POKE', role:'arcanist',
    abilities:['Crystal Shard','Refraction'],
    ult:'Prismatic Burst — shatters into shards that bounce between enemies',
  },
  'Fangwhisper': {
    class:'Assassin', compType:'ASSASSIN', role:'ranger',
    abilities:['Venom Strike','Death Mark'],
    ult:'Lethal Dose — applies stacking poison; at max stacks, target is stunned',
  },
  'Driftblade': {
    class:'Assassin', compType:'SPLITPUSH', role:'arcanist',
    abilities:['Wind Dash','Blade Gust'],
    ult:'Tempest Flurry — rapid multi-directional slashes in an area',
  },

  // ─── MAGES (6) — primary: arcanist ──────────────────────────────────────────

  'Grovefire': {
    class:'Mage', compType:'POKE', role:'arcanist',
    abilities:['Ember Shot','Blazing Trail'],
    ult:'Wildfire Storm — rains fire over a large area for 3 seconds',
  },
  'Rootweave': {
    class:'Mage', compType:'SCALING', role:'arcanist',
    abilities:['Vine Grasp','Growth Surge'],
    ult:"Forest's Wrath — massive roots erupt along a lane, trapping all enemies",
  },
  'Stormcaller': {
    class:'Mage', compType:'ENGAGE', role:'arcanist',
    abilities:['Chain Lightning','Thunderstrike'],
    ult:'Tempest — calls down a lightning storm; each bolt chains to nearby enemies',
  },
  'Voidthorn': {
    class:'Mage', compType:'POKE', role:'arcanist',
    abilities:['Thorn Volley','Dark Pulse'],
    ult:'Void Bloom — detonates dark energy around a target, dealing AoE damage',
  },
  'Crystalmind': {
    class:'Mage', compType:'SCALING', role:'arcanist',
    abilities:['Arcane Bolt','Mind Fracture'],
    ult:'Crystal Resonance — creates a crystal that amplifies all ability damage by 30%',
  },
  'Emberveil': {
    class:'Mage', compType:'POKE', role:'arcanist',
    abilities:['Phantom Bolt','Mirror Image'],
    ult:'Grand Illusion — creates 3 decoys that fire real damage bolts',
  },

  // ─── MARKSMEN (5) — primary: hunter ─────────────────────────────────────────

  'Swiftarrow': {
    class:'Marksman', compType:'POKE', role:'hunter',
    abilities:['Swift Shot','Tumble'],
    ult:'Rain of Arrows — fires a volley that blankets an area in projectiles',
  },
  'Starshot': {
    class:'Marksman', compType:'SCALING', role:'hunter',
    abilities:['Star Bolt','Stellar Drift'],
    ult:'Supernova — channels briefly then releases a screen-wide beam of light',
  },
  'Ironpetal': {
    class:'Marksman', compType:'POKE', role:'hunter',
    abilities:['Petal Shot','Iron Trap'],
    ult:'Petal Storm — fires bouncing petals that hit all enemies in a path',
  },
  'Duskwarden': {
    class:'Marksman', compType:'SCALING', role:'hunter',
    abilities:['Shadow Arrow','Dusk Shroud'],
    ult:'Twilight Barrage — phases in and out of shadow, firing with increased range',
  },
  'Embervane': {
    class:'Marksman', compType:'ENGAGE', role:'hunter',
    abilities:['Ember Arrow','Ignite'],
    ult:'Flame Rush — dashes forward in a burst of fire, burning a path through enemies',
  },

  // ─── SENTINELS (4) — primary: warden ────────────────────────────────────────

  'Bloomweave': {
    class:'Sentinel', compType:'PROTECT', role:'warden',
    abilities:['Bloom Heal','Petal Shield'],
    ult:"Grove's Blessing — heals all allies and cleanses one debuff from each",
  },
  'Thornshield': {
    class:'Sentinel', compType:'ENGAGE', role:'warden',
    abilities:['Thorn Hook','Shield Slam'],
    ult:'Bramble Wall — launches a wall of thorns that blocks a lane for 3 seconds',
  },
  'Moonsong': {
    class:'Sentinel', compType:'PROTECT', role:'warden',
    abilities:['Moonlight Buff','Silver Ward'],
    ult:'Lunar Blessing — bathes the team in moonlight, granting shields to all allies',
  },
  'Ashroot': {
    class:'Sentinel', compType:'PROTECT', role:'warden',
    abilities:['Ash Barrier','Root Bind'],
    ult:'Ancient Protection — channels and creates a sanctuary; enemies cannot target allies inside',
  },
};

// ─── Comp synergy bonuses (3+ champions of same compType = synergy active) ───

const COMP_SYNERGIES = {
  ENGAGE:    { name: 'Engage Comp',       bonus: { teamfighting: 15, clutch: 5 },       desc: '+15% Teamfighting' },
  POKE:      { name: 'Poke Comp',         bonus: { laning: 12, gameSense: 5 },           desc: '+12% Root Pressure' },
  ASSASSIN:  { name: 'Pick Comp',         bonus: { mechanics: 10, clutch: 10 },          desc: '+10% Mechanics & Clutch' },
  PROTECT:   { name: 'Protect the Carry', bonus: { teamfighting: 10, consistency: 10 }, desc: '+10% TF & Consistency' },
  SPLITPUSH: { name: 'Splitpush Comp',    bonus: { laning: 8, mechanics: 8 },            desc: '+8% Lane & Root Pressure' },
  SCALING:   { name: 'Scaling Comp',      bonus: { gameSense: 8, teamfighting: 8 },      desc: '+8% GS & Teamfighting' },
};

function getCompType(team) {
  const counts = {};
  team.forEach(player => {
    if (!player || !player.champion) return;
    const champ = CHAMPIONS[player.champion];
    if (!champ) return;
    counts[champ.compType] = (counts[champ.compType] || 0) + 1;
  });
  for (const [type, count] of Object.entries(counts)) {
    if (count >= 3) return type;
  }
  return null;
}
