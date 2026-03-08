// js/game/simulation.js — Match simulation engine

const DRAKE_TYPES = CONFIG.DRAGON_TYPES;

// ─── Utility ─────────────────────────────────────────────────────────────────

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function weightedChance(successChance) {
  return Math.random() * 100 < successChance;
}

function padTime(min, sec) {
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// Get player name for a team at a given position
function playerAt(team, position) {
  const p = team.find(p => p && p.position === position);
  return p ? p.name : posTitle(position);
}

function posTitle(pos) {
  const t = { top:'the top laner', jungle:'the jungler', mid:'the mid laner', adc:'the ADC', support:'the support' };
  return t[pos] || 'a player';
}

// Pick a random player from a team
function randPlayer(team) {
  const valid = team.filter(Boolean);
  if (!valid.length) return 'a player';
  return valid[randInt(0, valid.length - 1)].name;
}

// ─── Team Rating Calculation ──────────────────────────────────────────────────

// Filler stats for missing positions
const FILLER_STATS = {
  mechanics:45, laning:45, gameSense:45, teamfighting:45,
  communication:45, clutch:45, consistency:45, draftIQ:45
};

function getStats(player) {
  return player ? getEffectiveStats(player) : { ...FILLER_STATS };
}

function avgStat(team, statName) {
  const vals = team.map(p => getStats(p)[statName]);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function calcTeamRatings(team, compType) {
  const jungler = team.find(p => p && p.position === 'jungle');
  const adc     = team.find(p => p && p.position === 'adc');

  const jStats = getStats(jungler);
  const adcStats = getStats(adc);

  let earlyRating  = (avgStat(team,'laning') * 0.45 + avgStat(team,'mechanics') * 0.35 + avgStat(team,'gameSense') * 0.20);
  let jungleRating = (jStats.gameSense * 0.40 + jStats.mechanics * 0.40 + jStats.laning * 0.20);
  let tfRating     = (avgStat(team,'teamfighting') * 0.40 + avgStat(team,'mechanics') * 0.30 + avgStat(team,'communication') * 0.30);
  let lateRating   = (avgStat(team,'gameSense') * 0.40 + avgStat(team,'clutch') * 0.30 + avgStat(team,'teamfighting') * 0.30);
  let adcRating    = (adcStats.mechanics * 0.50 + adcStats.teamfighting * 0.30 + adcStats.consistency * 0.20);
  let consistency  = avgStat(team,'consistency');

  // Region synergy bonus
  const regions = team.filter(Boolean).map(p => p.region);
  const regionCounts = {};
  regions.forEach(r => regionCounts[r] = (regionCounts[r] || 0) + 1);
  const maxRegion = Math.max(...Object.values(regionCounts));
  const regionBonus = maxRegion >= 5 ? 0.20 : maxRegion >= 4 ? 0.15 : maxRegion >= 3 ? 0.10 : maxRegion >= 2 ? 0.05 : 0;

  // Comp synergy bonus
  let compBonus = {};
  if (compType && COMP_SYNERGIES[compType]) {
    compBonus = COMP_SYNERGIES[compType].bonus;
  }

  const applyBonus = (base, bonusPct) => base * (1 + bonusPct / 100) * (1 + regionBonus);

  earlyRating  = applyBonus(earlyRating  + (compBonus.laning     || 0), 0);
  tfRating     = applyBonus(tfRating     + (compBonus.teamfighting|| 0), 0);
  lateRating   = applyBonus(lateRating   + (compBonus.gameSense   || 0), 0);
  jungleRating = applyBonus(jungleRating, 0);
  adcRating    = applyBonus(adcRating    + (compBonus.consistency || 0), 0);
  earlyRating  += (compBonus.mechanics || 0);

  return { earlyRating, jungleRating, tfRating, lateRating, adcRating, consistency, regionBonus };
}

// ─── Champion Draft ───────────────────────────────────────────────────────────

function draftChampions(blueTeam, redTeam) {
  const picks = { blue: [], red: [] };

  [blueTeam, redTeam].forEach((team, ti) => {
    const side = ti === 0 ? 'blue' : 'red';
    team.forEach(player => {
      if (!player) { picks[side].push(null); return; }

      const stats = getStats(player);
      const pool  = player.champions || [];
      if (!pool.length) { picks[side].push({ player: player.name, champion: 'Unknown', position: player.position }); return; }

      // Higher draft IQ = pick first (best) champion more often
      const draftRoll = Math.random() * 100;
      let champIndex = 0;
      if (draftRoll > stats.draftIQ) {
        champIndex = randInt(0, pool.length - 1);
      }

      const champion = pool[champIndex];
      player.champion = champion;
      picks[side].push({ player: player.name, champion, position: player.position });
    });
  });

  const blueComp = getCompType(blueTeam.map((p, i) => p ? { ...p, champion: picks.blue[i]?.champion } : null));
  const redComp  = getCompType(redTeam.map((p, i)  => p ? { ...p, champion: picks.red[i]?.champion  } : null));

  return { blue: picks.blue, red: picks.red, blueComp, redComp };
}

// ─── Match Phases ─────────────────────────────────────────────────────────────

function simulateLaning(blue, red, bR, rR, adv, stats) {
  const events = [];
  let a = adv;

  // First Blood (3-8 min)
  const fbChance = 50 + (bR.earlyRating - rR.earlyRating) * 0.4;
  const blueFB   = weightedChance(clamp(fbChance, 20, 80));
  const fbMin    = randInt(3, 8);
  const fbSec    = randInt(0, 59);

  if (blueFB) {
    const killer = randPlayer(blue);
    const victim = randPlayer(red);
    stats.blue.kills++; stats.red.deaths++;
    a = clamp(a + 4, 5, 95);
    events.push({ time: padTime(fbMin, fbSec), text: `⚔️ FIRST BLOOD! ${killer} eliminates ${victim}!`, type: 'kill', phase: 'laning' });
  } else {
    const killer = randPlayer(red);
    const victim = randPlayer(blue);
    stats.red.kills++; stats.blue.deaths++;
    a = clamp(a - 4, 5, 95);
    events.push({ time: padTime(fbMin, fbSec), text: `⚔️ FIRST BLOOD! ${killer} eliminates ${victim}!`, type: 'kill', phase: 'laning' });
  }

  // CS lead event (5-9 min)
  const csLead = bR.earlyRating - rR.earlyRating;
  const csMin  = randInt(5, 9);
  if (Math.abs(csLead) > 5) {
    const leader = csLead > 0 ? 'Blue side' : 'Red side';
    const lanerName = csLead > 0 ? playerAt(blue,'mid') : playerAt(red,'mid');
    const lead = Math.abs(Math.round(csLead * 0.8));
    events.push({ time: padTime(csMin, randInt(0,59)), text: `📊 ${lanerName} has a +${lead} CS lead in mid lane.`, type: 'commentary', phase: 'laning' });
    a = clamp(a + (csLead > 0 ? 2 : -2), 5, 95);
  }

  // Jungler gank event (6-11 min)
  const gankChance = 50 + (bR.jungleRating - rR.jungleRating) * 0.5;
  const blueGank   = weightedChance(clamp(gankChance, 25, 75));
  const gankMin    = randInt(6, 11);
  const gankLanes  = ['top', 'mid', 'bot'];
  const gankLane   = gankLanes[randInt(0, 2)];
  const jgName     = blueGank ? playerAt(blue,'jungle') : playerAt(red,'jungle');
  const laneName   = blueGank ? playerAt(blue, gankLane === 'bot' ? 'adc' : gankLane) : playerAt(red, gankLane === 'bot' ? 'adc' : gankLane);

  if (blueGank) {
    if (weightedChance(60)) {
      stats.blue.kills++; stats.red.deaths++;
      a = clamp(a + 3, 5, 95);
      events.push({ time: padTime(gankMin, randInt(0,59)), text: `🗺️ ${jgName} ganks ${gankLane} — ${laneName} picks up the kill!`, type: 'kill', phase: 'laning' });
    } else {
      events.push({ time: padTime(gankMin, randInt(0,59)), text: `🗺️ ${jgName} attempts a gank on ${gankLane} but the enemy burns Flash and escapes.`, type: 'commentary', phase: 'laning' });
    }
  } else {
    if (weightedChance(60)) {
      stats.red.kills++; stats.blue.deaths++;
      a = clamp(a - 3, 5, 95);
      events.push({ time: padTime(gankMin, randInt(0,59)), text: `🗺️ ${jgName} ganks ${gankLane} — kills secured for the red side!`, type: 'kill', phase: 'laning' });
    } else {
      events.push({ time: padTime(gankMin, randInt(0,59)), text: `🗺️ Enemy ${jgName} tries a gank on ${gankLane} — ${laneName} dodges and survives!`, type: 'commentary', phase: 'laning' });
    }
  }

  // First Tower (11-14 min)
  const towerChance = 55 + (bR.earlyRating - rR.earlyRating) * 0.3;
  const blueTower   = weightedChance(clamp(towerChance, 20, 80));
  const towerMin    = randInt(11, 14);
  const towerLanes  = ['top', 'mid', 'bot'];
  const towerLane   = towerLanes[randInt(0, 2)];

  if (blueTower) {
    stats.blue.towers++;
    a = clamp(a + 5, 5, 95);
    events.push({ time: padTime(towerMin, randInt(0,59)), text: `🏰 Blue side destroys the First Tower in ${towerLane} lane! (+320g bonus!)`, type: 'objective', phase: 'laning' });
  } else {
    stats.red.towers++;
    a = clamp(a - 5, 5, 95);
    events.push({ time: padTime(towerMin, randInt(0,59)), text: `🏰 Red side destroys the First Tower in ${towerLane} lane! (+320g bonus!)`, type: 'objective', phase: 'laning' });
  }

  return { events, advantage: a };
}

function simulateMidGame(blue, red, bR, rR, adv, stats) {
  const events = [];
  let a = adv;
  const drakes = shuffleArray([...DRAKE_TYPES]);
  let drakeIndex = 0;

  // Dragon 1 (14-18 min)
  const d1Chance = 50 + (bR.tfRating + bR.jungleRating*0.5 - rR.tfRating - rR.jungleRating*0.5) * 0.35;
  const blueD1   = weightedChance(clamp(d1Chance, 20, 80));
  const d1Type   = drakes[drakeIndex++];
  const d1Min    = randInt(14, 18);
  const jgBlue   = playerAt(blue,'jungle');
  const jgRed    = playerAt(red,'jungle');

  if (blueD1) {
    stats.blue.dragons++;
    a = clamp(a + 4, 5, 95);
    if (weightedChance(40)) {
      stats.blue.kills++; stats.red.deaths++;
      events.push({ time: padTime(d1Min, randInt(0,59)), text: `🐉 ${d1Type} Dragon secured by blue side after a skirmish — ${randPlayer(blue)} picks up a kill!`, type: 'objective', phase: 'midgame' });
    } else {
      events.push({ time: padTime(d1Min, randInt(0,59)), text: `🐉 ${jgBlue} secures the ${d1Type} Dragon uncontested. Blue side takes early dragon control.`, type: 'objective', phase: 'midgame' });
    }
  } else {
    stats.red.dragons++;
    a = clamp(a - 4, 5, 95);
    if (weightedChance(40)) {
      stats.red.kills++; stats.blue.deaths++;
      events.push({ time: padTime(d1Min, randInt(0,59)), text: `🐉 ${d1Type} Dragon to red side! ${randPlayer(red)} secures a kill in the river fight!`, type: 'objective', phase: 'midgame' });
    } else {
      events.push({ time: padTime(d1Min, randInt(0,59)), text: `🐉 Red side takes the ${d1Type} Dragon. ${jgRed} had superior vision control.`, type: 'objective', phase: 'midgame' });
    }
  }

  // Rift Herald (15-19 min)
  const rhChance = 50 + (bR.jungleRating - rR.jungleRating) * 0.4;
  const blueRH   = weightedChance(clamp(rhChance, 25, 75));
  const rhMin    = randInt(15, 19);

  if (blueRH) {
    stats.blue.towers++;
    a = clamp(a + 3, 5, 95);
    events.push({ time: padTime(rhMin, randInt(0,59)), text: `🔮 Rift Herald seized by blue side! ${jgBlue} uses it to smash the ${['top','mid'][randInt(0,1)]} lane tower!`, type: 'objective', phase: 'midgame' });
  } else {
    stats.red.towers++;
    a = clamp(a - 3, 5, 95);
    events.push({ time: padTime(rhMin, randInt(0,59)), text: `🔮 Red side takes Rift Herald and crashes it into the ${['top','mid'][randInt(0,1)]} lane tower!`, type: 'objective', phase: 'midgame' });
  }

  // Mid-game teamfight (19-23 min)
  const tfChance = 50 + (bR.tfRating - rR.tfRating) * 0.45;
  const blueTF   = weightedChance(clamp(tfChance, 20, 80));
  const tfMin    = randInt(19, 23);
  const kills    = randInt(2, 5);

  if (blueTF) {
    stats.blue.kills += kills; stats.red.deaths += kills;
    a = clamp(a + 6, 5, 95);
    events.push({ time: padTime(tfMin, randInt(0,59)), text: `💥 Mid-game teamfight breaks out near Dragon pit — Blue side wins a ${kills}-for-${randInt(0,kills-1)} trade!`, type: 'teamfight', phase: 'midgame' });
  } else {
    stats.red.kills += kills; stats.blue.deaths += kills;
    a = clamp(a - 6, 5, 95);
    events.push({ time: padTime(tfMin, randInt(0,59)), text: `💥 Teamfight erupts near mid — Red side comes out ahead ${kills}-for-${randInt(0,kills-1)}!`, type: 'teamfight', phase: 'midgame' });
  }

  // Dragon 2 (22-26 min)
  const d2Chance = 50 + (a - 50) * 0.3 + (bR.tfRating - rR.tfRating) * 0.2;
  const blueD2   = weightedChance(clamp(d2Chance, 20, 80));
  const d2Type   = drakes[drakeIndex++] || drakes[0];
  const d2Min    = randInt(22, 26);

  if (blueD2) {
    stats.blue.dragons++;
    a = clamp(a + 4, 5, 95);
    events.push({ time: padTime(d2Min, randInt(0,59)), text: `🐉 Blue side claims the ${d2Type} Dragon! They now hold ${stats.blue.dragons} drakes.`, type: 'objective', phase: 'midgame' });
  } else {
    stats.red.dragons++;
    a = clamp(a - 4, 5, 95);
    events.push({ time: padTime(d2Min, randInt(0,59)), text: `🐉 Red side claims the ${d2Type} Dragon! They now hold ${stats.red.dragons} drakes.`, type: 'objective', phase: 'midgame' });
  }

  return { events, advantage: a, drakeIndex, drakes };
}

function simulateLateGame(blue, red, bR, rR, adv, stats, drakes, drakeIndex) {
  const events = [];
  let a = adv;
  let blueWin = null;

  // Dragon 3 / Soul point (26-30 min)
  const d3Chance = 50 + (a - 50) * 0.3 + (bR.lateRating - rR.lateRating) * 0.3;
  const blueD3   = weightedChance(clamp(d3Chance, 20, 80));
  const d3Type   = drakes[drakeIndex] || drakes[0];
  const d3Min    = randInt(26, 30);

  if (blueD3) {
    stats.blue.dragons++;
    a = clamp(a + 5, 5, 95);
    const soulText = stats.blue.dragons >= 3 ? ` Blue side now has **Dragon Soul** — massive power spike!` : '';
    events.push({ time: padTime(d3Min, randInt(0,59)), text: `🐉 Blue side secures the ${d3Type} Dragon.${soulText}`, type: 'objective', phase: 'lategame' });
    if (stats.blue.dragons >= 3) a = clamp(a + 6, 5, 95);
  } else {
    stats.red.dragons++;
    a = clamp(a - 5, 5, 95);
    const soulText = stats.red.dragons >= 3 ? ` Red side now has **Dragon Soul** — massive power spike!` : '';
    events.push({ time: padTime(d3Min, randInt(0,59)), text: `🐉 Red side secures the ${d3Type} Dragon.${soulText}`, type: 'objective', phase: 'lategame' });
    if (stats.red.dragons >= 3) a = clamp(a - 6, 5, 95);
  }

  // Baron Nashor (28-33 min)
  const baronChance = 50 + (bR.lateRating + bR.tfRating*0.5 - rR.lateRating - rR.tfRating*0.5) * 0.35;
  const blueB   = weightedChance(clamp(baronChance, 20, 80));
  const baronMin = randInt(28, 33);
  const stolenChance = 15; // 15% chance of a steal

  if (weightedChance(stolenChance)) {
    // Baron steal!
    const stealer = blueB ? playerAt(blue,'jungle') : playerAt(red,'jungle');
    const stealerSide = blueB ? 'Blue' : 'Red';
    const stolenFrom  = blueB ? 'Red' : 'Blue';
    if (blueB) { stats.blue.barons = (stats.blue.barons||0) + 1; a = clamp(a + 10, 5, 95); }
    else        { stats.red.barons  = (stats.red.barons||0)  + 1; a = clamp(a - 10, 5, 95); }
    events.push({ time: padTime(baronMin, randInt(0,59)), text: `🟣 BARON STEAL!! ${stealer} smites Baron away from ${stolenFrom} side! Crowd goes insane!`, type: 'objective', phase: 'lategame' });
  } else if (blueB) {
    stats.blue.barons = (stats.blue.barons||0) + 1;
    a = clamp(a + 10, 5, 95);
    events.push({ time: padTime(baronMin, randInt(0,59)), text: `🟣 BARON NASHOR claimed by blue side after a decisive teamfight! ${randPlayer(blue)} lands the Smite!`, type: 'objective', phase: 'lategame' });
  } else {
    stats.red.barons = (stats.red.barons||0) + 1;
    a = clamp(a - 10, 5, 95);
    events.push({ time: padTime(baronMin, randInt(0,59)), text: `🟣 BARON NASHOR goes to red side! ${randPlayer(red)} secures the Smite with perfect timing!`, type: 'objective', phase: 'lategame' });
  }

  // Baron push / teamfight aftermath (32-38 min)
  const pushMin    = randInt(32, 38);
  const pushChance = 50 + (a - 50) * 0.4;
  const bluePush   = weightedChance(clamp(pushChance, 20, 80));
  const pushKills  = randInt(2, 5);

  if (bluePush) {
    stats.blue.kills += pushKills; stats.red.deaths += pushKills;
    stats.blue.towers++;
    a = clamp(a + 8, 5, 95);
    events.push({ time: padTime(pushMin, randInt(0,59)), text: `💥 Blue side wins a ${pushKills}-for-${randInt(0,2)} teamfight under Baron buff and destroys an inhibitor!`, type: 'teamfight', phase: 'lategame' });
  } else {
    stats.red.kills += pushKills; stats.blue.deaths += pushKills;
    stats.red.towers++;
    a = clamp(a - 8, 5, 95);
    events.push({ time: padTime(pushMin, randInt(0,59)), text: `💥 Red side wins a ${pushKills}-for-${randInt(0,2)} teamfight under Baron buff and destroys an inhibitor!`, type: 'teamfight', phase: 'lategame' });
  }

  // Final teamfight / Nexus race (38-45 min)
  const finalMin    = randInt(38, 45);
  const finalChance = 50 + (a - 50) * 0.5;
  const blueFinal   = weightedChance(clamp(finalChance, 15, 85));

  // Apply clutch to potentially flip the result
  const clutchBlue = avgStat(blue,'clutch');
  const clutchRed  = avgStat(red,'clutch');
  const blueComeback = !blueFinal && weightedChance(clutchBlue * 0.3);
  const redComeback  = blueFinal  && weightedChance(clutchRed  * 0.3);

  if (blueComeback) {
    stats.blue.kills += randInt(3,5); stats.red.deaths += randInt(3,5);
    a = clamp(a + 12, 5, 95);
    events.push({ time: padTime(finalMin, randInt(0,59)), text: `🔥 CLUTCH TEAMFIGHT! ${playerAt(blue,'mid')} makes an insane play — Blue side turns it around! ACE!`, type: 'teamfight', phase: 'lategame' });
    blueWin = true;
  } else if (redComeback) {
    stats.red.kills += randInt(3,5); stats.blue.deaths += randInt(3,5);
    a = clamp(a - 12, 5, 95);
    events.push({ time: padTime(finalMin, randInt(0,59)), text: `🔥 CLUTCH TEAMFIGHT! ${playerAt(red,'mid')} makes a stunning play — Red side turns it around! ACE!`, type: 'teamfight', phase: 'lategame' });
    blueWin = false;
  } else {
    blueWin = blueFinal;
    if (blueFinal) {
      stats.blue.kills += randInt(2,4); stats.red.deaths += randInt(2,4);
      events.push({ time: padTime(finalMin, randInt(0,59)), text: `💥 Final teamfight goes to Blue side! ${randPlayer(blue)} is carrying hard — Red side's base is open!`, type: 'teamfight', phase: 'lategame' });
    } else {
      stats.red.kills += randInt(2,4); stats.blue.deaths += randInt(2,4);
      events.push({ time: padTime(finalMin, randInt(0,59)), text: `💥 Final teamfight goes to Red side! ${randPlayer(red)} is carrying hard — Blue side's base is open!`, type: 'teamfight', phase: 'lategame' });
    }
  }

  // Nexus
  const nexusMin = finalMin + randInt(2, 5);
  if (blueWin) {
    events.push({ time: padTime(nexusMin, randInt(0,59)), text: `🏆 NEXUS DESTROYED! Blue side wins the match!`, type: 'result', phase: 'lategame' });
  } else {
    events.push({ time: padTime(nexusMin, randInt(0,59)), text: `🏆 NEXUS DESTROYED! Red side wins the match!`, type: 'result', phase: 'lategame' });
  }

  return { events, advantage: a, blueWin };
}

// ─── Main Match Simulator ─────────────────────────────────────────────────────

function simulateMatch(blueTeam, redTeam, blueTeamName, redTeamName) {
  // Ensure we have exactly 5 slots (fill empty with null)
  const blue = padTeam(blueTeam);
  const red  = padTeam(redTeam);

  // Champion draft
  const draft = draftChampions(blue, red);

  // Calculate ratings
  const bR = calcTeamRatings(blue, draft.blueComp);
  const rR = calcTeamRatings(red,  draft.redComp);

  // Stats tracker
  const stats = {
    blue: { kills:0, deaths:0, dragons:0, towers:0, barons:0 },
    red:  { kills:0, deaths:0, dragons:0, towers:0, barons:0 },
  };

  let advantage = 50;

  // Run phases
  const laningResult = simulateLaning(blue, red, bR, rR, advantage, stats);
  advantage = laningResult.advantage;

  // Early stomp check
  if (advantage >= 82 || advantage <= 18) {
    const earlyWin = advantage >= 50;
    const finalMin = randInt(18, 22);
    laningResult.events.push({
      time: padTime(finalMin, randInt(0,59)),
      text: `🏆 EARLY NEXUS! ${earlyWin ? blueTeamName : redTeamName} completely dominates and ends the game!`,
      type: 'result', phase: 'lategame'
    });
    return buildResult(earlyWin, laningResult.events, [], [], stats, draft, advantage, bR, rR);
  }

  const midResult = simulateMidGame(blue, red, bR, rR, advantage, stats);
  advantage = midResult.advantage;

  const lateResult = simulateLateGame(blue, red, bR, rR, advantage, stats, midResult.drakes, midResult.drakeIndex);
  advantage = lateResult.advantage;

  const blueWins = lateResult.blueWin;

  return buildResult(blueWins, laningResult.events, midResult.events, lateResult.events, stats, draft, advantage, bR, rR);
}

function padTeam(team) {
  const result = [...team];
  while (result.length < 5) result.push(null);
  return result.slice(0, 5);
}

function buildResult(blueWins, laningEvents, midEvents, lateEvents, stats, draft, advantage, bR, rR) {
  return {
    winner: blueWins ? 'blue' : 'red',
    events: { laning: laningEvents, midgame: midEvents, lategame: lateEvents },
    allEvents: [...laningEvents, ...midEvents, ...lateEvents],
    stats,
    draft,
    advantage,
    ratings: { blue: bR, red: rR },
  };
}

// ─── Quick AI vs AI Simulation ────────────────────────────────────────────────
// Used for simulating non-human matches in the standings

function quickSimulate(blueStrength, redStrength) {
  const diff = (blueStrength - redStrength) * 30;
  const blueChance = clamp(50 + diff, 15, 85);
  return weightedChance(blueChance) ? 'blue' : 'red';
}
