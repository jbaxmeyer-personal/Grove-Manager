// js/game/tournament.js — Schedule, standings, bracket, AI simulation

// ─── Schedule ─────────────────────────────────────────────────────────────────

// Standard round-robin rotation for N teams; returns array of rounds, each round is an array of [a,b] pairs
function generateHalfSchedule(n) {
  const schedule = [];
  const teams    = Array.from({ length: n }, (_, i) => i);

  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([teams[i], teams[n - 1 - i]]);
    schedule.push(pairs);
    // Rotate: fix teams[0], move last to index 1
    const last = teams.pop();
    teams.splice(1, 0, last);
  }
  return schedule;
}

// Double round-robin: play each team TWICE (14 rounds for 8 teams)
function generateSchedule(n) {
  const half = generateHalfSchedule(n);
  // Second half: same matchups, reversed home/away for variety
  const second = half.map(round => round.map(([a,b]) => [b, a]));
  return [...half, ...second];
}

// ─── Tournament Init ──────────────────────────────────────────────────────────

function initTournament(state) {
  state.aiTeams = AI_TEAM_CONFIGS.map(cfg => initAITeam(cfg));

  state.allTeams = [
    { id:'human', name: state.teamName, isHuman:true, wins:0, losses:0, kills:0, deaths:0, winStreak:0, loseStreak:0 },
    ...state.aiTeams,
  ];

  state.schedule = generateSchedule(CONFIG.TOTAL_TEAMS);
  state.round    = 1;
  state.bracket  = null;
}

// Human's opponent for the current round
function getHumanOpponent(state) {
  const roundPairs = state.schedule[state.round - 1];
  if (!roundPairs) return null;
  const pair = roundPairs.find(p => p.includes(0));
  if (!pair) return null;
  const oppIdx = pair[0] === 0 ? pair[1] : pair[0];
  return state.allTeams[oppIdx];
}

// ─── Round Simulation ─────────────────────────────────────────────────────────

// Run AI shop phases for all AI teams this round
function runAIShopPhases(state) {
  state.aiTeams.forEach(ai => {
    simulateAIShopRound(ai, state.round);
  });
}

// Simulate all non-human matches for the current round
function simulateAIRoundMatches(state) {
  const roundPairs = state.schedule[state.round - 1];
  if (!roundPairs) return;

  roundPairs.forEach(([ai, bi]) => {
    if (ai === 0 || bi === 0) return;
    const teamA = state.allTeams[ai];
    const teamB = state.allTeams[bi];

    const aRoster = (teamA.roster || []).filter(Boolean);
    const bRoster = (teamB.roster || []).filter(Boolean);

    const winner = quickSimulate(aRoster.length ? aRoster : teamA.strength || 0.5,
                                  bRoster.length ? bRoster : teamB.strength || 0.5);

    const win  = winner === 'blue' ? teamA : teamB;
    const lose = winner === 'blue' ? teamB : teamA;

    win.wins++;  lose.losses++;

    // Fake kill stats for standings display (realistic ranges)
    const totalKills = randInt(16, 26);
    win.kills   += Math.round(totalKills * 0.62);
    win.deaths  += Math.round(totalKills * 0.38);
    lose.kills  += Math.round(totalKills * 0.38);
    lose.deaths += Math.round(totalKills * 0.62);

    // Update streaks
    win.winStreak   = (win.winStreak  || 0) + 1; win.loseStreak  = 0;
    lose.loseStreak = (lose.loseStreak|| 0) + 1; lose.winStreak  = 0;
  });
}

function applyHumanResult(state, won, matchStats) {
  const human = state.allTeams[0];
  const opp   = getHumanOpponent(state);

  if (won) {
    human.wins++; if (opp) opp.losses++;
    state.winStreak++; state.loseStreak = 0;
    human.winStreak  = (human.winStreak  || 0) + 1;
    human.loseStreak = 0;
  } else {
    human.losses++; if (opp) opp.wins++;
    state.loseStreak++; state.winStreak = 0;
    human.loseStreak = (human.loseStreak || 0) + 1;
    human.winStreak  = 0;
  }

  if (matchStats) {
    human.kills  += matchStats.blue.kills;
    human.deaths += matchStats.red.kills; // deaths = opp kills
    if (opp) {
      opp.kills  += matchStats.red.kills;
      opp.deaths += matchStats.blue.kills;
    }
  }
}

function getStandings(state) {
  return [...state.allTeams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aDiff = (a.kills||0) - (a.deaths||0);
    const bDiff = (b.kills||0) - (b.deaths||0);
    return bDiff - aDiff;
  });
}

// ─── Bracket ──────────────────────────────────────────────────────────────────

function initBracket(state) {
  const top4 = getStandings(state).slice(0, 4);

  state.bracket = {
    semis: [
      { teamA: top4[0], teamB: top4[3], winner: null, label: 'Semi-Final 1 (1st vs 4th)' },
      { teamA: top4[1], teamB: top4[2], winner: null, label: 'Semi-Final 2 (2nd vs 3rd)' },
    ],
    final:       { teamA: null, teamB: null, winner: null },
    champion:    null,
    bracketRound: 'semis', // 'semis' | 'finals' | 'eliminated' | 'done'
  };

  return state.bracket;
}

function humanInBracket(state) {
  if (!state.bracket) return false;
  const { bracket } = state;

  if (bracket.bracketRound === 'semis') {
    return bracket.semis.some(m => m.teamA?.isHuman || m.teamB?.isHuman);
  }
  if (bracket.bracketRound === 'finals') {
    return bracket.final.teamA?.isHuman || bracket.final.teamB?.isHuman;
  }
  return false;
}

function getHumanBracketMatch(state) {
  if (!state.bracket) return null;
  const { bracket } = state;

  if (bracket.bracketRound === 'semis') {
    return bracket.semis.find(m => m.teamA?.isHuman || m.teamB?.isHuman) || null;
  }
  if (bracket.bracketRound === 'finals') {
    const f = bracket.final;
    return (f.teamA?.isHuman || f.teamB?.isHuman) ? f : null;
  }
  return null;
}

// Simulate AI-only semi-final matches, advance winners to final
function resolveAISemis(state) {
  state.bracket.semis.forEach(match => {
    if (match.winner) return;
    if (match.teamA?.isHuman || match.teamB?.isHuman) return; // skip human matches

    const aRoster = match.teamA?.roster?.filter(Boolean) || [];
    const bRoster = match.teamB?.roster?.filter(Boolean) || [];
    const result  = quickSimulate(aRoster.length ? aRoster : 0.5, bRoster.length ? bRoster : 0.5);
    match.winner  = result === 'blue' ? match.teamA : match.teamB;
  });

  // Set finalists if both semis resolved
  const winners = state.bracket.semis.map(m => m.winner).filter(Boolean);
  if (winners.length === 2) {
    state.bracket.final.teamA = winners[0];
    state.bracket.final.teamB = winners[1];
    if (state.bracket.bracketRound === 'semis') state.bracket.bracketRound = 'finals';
  }
}

function applyBracketResult(state, won) {
  const human   = state.allTeams[0];
  const { bracket } = state;

  if (bracket.bracketRound === 'semis') {
    const match = bracket.semis.find(m => m.teamA?.isHuman || m.teamB?.isHuman);
    if (!match) return;

    const opponent = match.teamA?.isHuman ? match.teamB : match.teamA;
    match.winner   = won ? human : opponent;

    if (!won) {
      bracket.bracketRound = 'eliminated';
      return;
    }

    // Resolve the other semi
    resolveAISemis(state);

    // Advance to finals
    const allWinners = bracket.semis.map(m => m.winner).filter(Boolean);
    if (allWinners.length === 2) {
      bracket.final.teamA = allWinners[0];
      bracket.final.teamB = allWinners[1];
      bracket.bracketRound = 'finals';
    }
  } else if (bracket.bracketRound === 'finals') {
    const opponent = bracket.final.teamA?.isHuman ? bracket.final.teamB : bracket.final.teamA;
    bracket.final.winner = won ? human : opponent;
    bracket.champion     = bracket.final.winner;
    bracket.bracketRound = 'done';
  }
}
