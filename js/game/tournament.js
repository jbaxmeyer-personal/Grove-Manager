// js/game/tournament.js — Schedule, standings, and bracket management

const AI_TEAM_CONFIGS = [
  { name: 'Team Nexus',      strength: 0.72 },
  { name: 'Dragon Guard',    strength: 0.85 },
  { name: 'Iron Vanguard',   strength: 0.88 },
  { name: 'Shadow Protocol', strength: 0.40 },
  { name: 'Phoenix Rising',  strength: 0.65 },
  { name: 'Storm Raiders',   strength: 0.60 },
  { name: 'Void Walkers',    strength: 0.35 },
];

// Round-robin schedule for 8 teams (indices 0-7, 0 = human player)
// Standard round-robin rotation: fix team 0, rotate others
function generateSchedule(teamCount) {
  const schedule = [];
  const teams = Array.from({ length: teamCount }, (_, i) => i);

  for (let round = 0; round < teamCount - 1; round++) {
    const roundPairs = [];
    for (let i = 0; i < teamCount / 2; i++) {
      roundPairs.push([teams[i], teams[teamCount - 1 - i]]);
    }
    schedule.push(roundPairs);

    // Rotate all but first: move last to index 1
    const last = teams.pop();
    teams.splice(1, 0, last);
  }

  return schedule;
}

function initTournament(state) {
  // Generate AI teams
  state.aiTeams = AI_TEAM_CONFIGS.map((cfg, i) => ({
    id: `ai${i + 1}`,
    name: cfg.name,
    strength: cfg.strength,
    roster: generateAIRoster(cfg.strength),
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
  }));

  // All participants: human (index 0) + 7 AI
  state.allTeams = [
    { id: 'human', name: state.teamName, isHuman: true, wins: 0, losses: 0, kills: 0, deaths: 0 },
    ...state.aiTeams.map(t => ({ ...t, isHuman: false })),
  ];

  // Generate 7-round round-robin schedule
  state.schedule = generateSchedule(CONFIG.TOTAL_TEAMS);
  state.round    = 1;
  state.bracket  = null;
}

// Returns the human player's opponent for the current round
function getHumanOpponent(state) {
  const roundPairs = state.schedule[state.round - 1];
  const pair = roundPairs.find(p => p.includes(0));
  if (!pair) return null;
  const opponentIdx = pair[0] === 0 ? pair[1] : pair[0];
  return state.allTeams[opponentIdx];
}

// Simulate all non-human matches for the current round and update standings
function simulateAIRoundMatches(state) {
  const roundPairs = state.schedule[state.round - 1];
  roundPairs.forEach(pair => {
    const [ai, bi] = pair;
    if (ai === 0 || bi === 0) return; // Skip human match

    const teamA = state.allTeams[ai];
    const teamB = state.allTeams[bi];
    const aStr  = teamA.strength || 0.5;
    const bStr  = teamB.strength || 0.5;
    const winner = quickSimulate(aStr, bStr);

    const winnerTeam = winner === 'blue' ? teamA : teamB;
    const loserTeam  = winner === 'blue' ? teamB : teamA;

    winnerTeam.wins++;
    loserTeam.losses++;

    // Give some fake kills for standings display
    winnerTeam.kills  += randInt(8, 18);
    winnerTeam.deaths += randInt(2, 8);
    loserTeam.kills   += randInt(2, 8);
    loserTeam.deaths  += randInt(8, 18);
  });
}

// Apply human match result to standings
function applyHumanResult(state, won, matchStats) {
  const human = state.allTeams[0];
  const opponent = getHumanOpponent(state);

  if (won) {
    human.wins++;
    if (opponent) opponent.losses++;
    state.winStreak++;
    state.loseStreak = 0;
  } else {
    human.losses++;
    if (opponent) opponent.wins++;
    state.loseStreak++;
    state.winStreak = 0;
  }

  // Record kills/deaths from the match
  if (matchStats) {
    human.kills  += matchStats.blue.kills;
    human.deaths += matchStats.blue.deaths;
    if (opponent) {
      opponent.kills  += matchStats.red.kills;
      opponent.deaths += matchStats.red.deaths;
    }
  }
}

function getStandings(state) {
  return [...state.allTeams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    // Tiebreaker: kill differential
    const aDiff = a.kills - a.deaths;
    const bDiff = b.kills - b.deaths;
    return bDiff - aDiff;
  });
}

// ─── Bracket ──────────────────────────────────────────────────────────────────

function initBracket(state) {
  const standings = getStandings(state);
  const top4 = standings.slice(0, 4);

  state.bracket = {
    semis: [
      { teamA: top4[0], teamB: top4[3], winner: null, seed: '1v4' },
      { teamA: top4[1], teamB: top4[2], winner: null, seed: '2v3' },
    ],
    final: { teamA: null, teamB: null, winner: null },
    champion: null,
    bracketRound: 'semis', // 'semis' | 'finals' | 'done'
  };

  return state.bracket;
}

// Get the human player's current bracket match
function getHumanBracketMatch(state) {
  if (!state.bracket) return null;
  const { bracket } = state;

  if (bracket.bracketRound === 'semis') {
    const match = bracket.semis.find(m => m.teamA?.isHuman || m.teamB?.isHuman);
    return match || null;
  }
  if (bracket.bracketRound === 'finals') {
    if (bracket.final.teamA?.isHuman || bracket.final.teamB?.isHuman) {
      return bracket.final;
    }
  }
  return null;
}

function humanInBracket(state) {
  return !!getHumanBracketMatch(state);
}

// Simulate semi-final matches and advance winners
function resolveSemis(state) {
  const { semis, final } = state.bracket;

  semis.forEach(match => {
    if (match.winner) return; // already resolved

    const aIsHuman = match.teamA?.isHuman;
    const bIsHuman = match.teamB?.isHuman;

    if (!aIsHuman && !bIsHuman) {
      // AI vs AI
      const aStr = match.teamA?.strength || 0.5;
      const bStr = match.teamB?.strength || 0.5;
      match.winner = quickSimulate(aStr, bStr) === 'blue' ? match.teamA : match.teamB;
    }
    // Human match is resolved externally
  });

  // Set finalists
  const winners = semis.map(m => m.winner).filter(Boolean);
  if (winners.length === 2) {
    final.teamA = winners[0];
    final.teamB = winners[1];
    state.bracket.bracketRound = 'finals';
  }
}

function resolveFinals(state) {
  const { final } = state.bracket;
  if (!final.winner) {
    const aStr = final.teamA?.strength || 0.5;
    const bStr = final.teamB?.strength || 0.5;
    final.winner = quickSimulate(aStr, bStr) === 'blue' ? final.teamA : final.teamB;
  }
  state.bracket.champion = final.winner;
  state.bracket.bracketRound = 'done';
}

function applyBracketResult(state, won, matchResult) {
  const human = state.allTeams[0];
  const { bracket } = state;

  if (bracket.bracketRound === 'semis') {
    const match = bracket.semis.find(m => m.teamA?.isHuman || m.teamB?.isHuman);
    if (match) {
      match.winner = won ? human : (match.teamA?.isHuman ? match.teamB : match.teamA);
      if (!won) {
        bracket.bracketRound = 'eliminated';
        bracket.champion = null;
      } else {
        // Simulate the other semi if not done
        resolveSemis(state);
      }
    }
  } else if (bracket.bracketRound === 'finals') {
    const final = bracket.final;
    final.winner = won ? human : (final.teamA?.isHuman ? final.teamB : final.teamA);
    bracket.champion = final.winner;
    bracket.bracketRound = 'done';
  }
}
