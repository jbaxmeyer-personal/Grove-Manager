// js/main.js — Game state and event loop

// ─── Global Game State ────────────────────────────────────────────────────────

const G = {
  phase: 'setup',
  teamName: '',
  gold: 0,
  xp: 0,
  level: 1,
  round: 1,
  winStreak: 0,
  loseStreak: 0,
  roster: [null, null, null, null, null],  // 5 active slots
  bench: [],
  shopSlots: [],
  shopLocked: false,
  playerPool: [],
  allTeams: [],
  aiTeams: [],
  schedule: [],
  bracket: null,
  lastMatchResult: null,
  lastIncome: null,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

function startGame() {
  const nameInput = document.getElementById('team-name-input');
  const name = nameInput ? nameInput.value.trim() : '';
  G.teamName = name || 'My Team';

  G.gold      = 0;
  G.xp        = 0;
  G.level     = 1;
  G.winStreak = 0;
  G.loseStreak= 0;
  G.roster    = [null, null, null, null, null];
  G.bench     = [];
  G.shopLocked= false;

  initPool(G);
  initTournament(G);
  enterShopPhase();
}

// ─── Phase Transitions ────────────────────────────────────────────────────────

function enterShopPhase() {
  G.phase = 'shop';

  // Give base gold + XP at start of round
  if (G.round > 1) {
    G.lastIncome = applyGoldIncome(G);
    addXP(G, CONFIG.XP_PER_ROUND);
  } else {
    G.gold       = CONFIG.BASE_GOLD + 2; // starting gold bonus
    G.lastIncome = { base: CONFIG.BASE_GOLD + 2, interest: 0, streakBonus: 0, total: CONFIG.BASE_GOLD + 2 };
  }

  drawShop(G);
  showScreen('screen-game');
  showTab('shop');
  renderShop(G);
  renderOpponentPreview(G);
  renderHeader(G);

  // Simulate AI matches for this round (not human's match)
  if (G.round > 1) simulateAIRoundMatches(G);
}

function enterMatchPhase() {
  G.phase = 'match';

  const opp = G.phase === 'bracket_match' ? G._bracketOpponent : getHumanOpponent(G);
  if (!opp) { alert('No opponent found!'); return; }

  const blueTeam = G.roster.filter(Boolean);
  const redTeam  = (opp.roster || []).filter(Boolean);

  if (blueTeam.length === 0) {
    alert('You need at least 1 active player! Buy someone from the shop first.');
    G.phase = 'shop';
    return;
  }

  G.lastMatchResult = simulateMatch(blueTeam, redTeam, G.teamName, opp.name);
  G.lastMatchResult._opponent = opp;

  showScreen('screen-match');
  renderDraft(G.lastMatchResult, G.teamName, opp.name);

  document.getElementById('draft-phase').style.display    = 'block';
  document.getElementById('match-phases').style.display   = 'none';
}

function startMatchSimulation() {
  const phases = document.querySelectorAll('.phase-tab');
  phases.forEach(p => p.classList.remove('active'));

  document.getElementById('draft-phase').style.display  = 'none';
  document.getElementById('match-phases').style.display = 'block';

  // Default to laning phase
  activatePhaseTab('laning');
  renderMatchPhase(G.lastMatchResult, 'laning');

  // Update score bar with final stats
  updateScoreBar(G.lastMatchResult);
}

function activatePhaseTab(phase) {
  document.querySelectorAll('.phase-tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`.phase-tab[data-phase="${phase}"]`);
  if (tab) tab.classList.add('active');
  renderMatchPhase(G.lastMatchResult, phase);
}

function enterResultsPhase() {
  const result   = G.lastMatchResult;
  const blueWins = result.winner === 'blue';

  // Apply result to standings
  applyHumanResult(G, blueWins, result.stats);

  // Earn gold
  G.lastIncome = calcGoldIncome(G);

  // Show results screen
  showScreen('screen-results');
  renderResults(G, result, blueWins, G.lastIncome);
}

function continueAfterResults() {
  // Actually apply the income now
  G.gold += G.lastIncome.total;

  if (G.phase === 'bracket_match' || G.phase === 'bracket_results') {
    handleBracketContinue();
    return;
  }

  G.round++;

  if (G.round > CONFIG.ROUND_ROBIN_ROUNDS) {
    // Round robin done — start bracket
    startBracket();
  } else {
    enterShopPhase();
  }
}

// ─── Bracket ─────────────────────────────────────────────────────────────────

function startBracket() {
  initBracket(G);
  G.phase = 'bracket';

  const inBracket = humanInBracket(G);
  if (!inBracket) {
    // Human didn't make playoffs
    showScreen('screen-bracket');
    renderBracket(G);
    renderGameOver(G, false);
    showScreen('screen-gameover');
    return;
  }

  showScreen('screen-bracket');
  renderBracket(G);

  // Show bracket then transition to shop for playoff match prep
  setTimeout(() => enterBracketShop(), 1500);
}

function enterBracketShop() {
  G.phase = 'bracket_shop';

  G.gold += CONFIG.BASE_GOLD; // flat gold for bracket round
  drawShop(G);

  showScreen('screen-game');
  showTab('shop');
  renderShop(G);
  renderHeader(G);

  const match = getHumanBracketMatch(G);
  const opp   = match?.teamA?.isHuman ? match.teamB : match.teamA;

  const oppInfo = document.getElementById('opponent-info');
  if (oppInfo && opp) {
    const roster = opp.roster || [];
    oppInfo.innerHTML = `
      <div class="opp-header"><span class="opp-team-name">${opp.name}</span></div>
      <div class="opp-roster">${roster.map(p =>
        `<div class="opp-player"><span>${posIcon(p.position)}</span><span class="opp-name">${p.name}</span></div>`
      ).join('')}</div>`;
  }

  document.getElementById('header-phase').textContent = G.bracket.bracketRound === 'semis' ? 'Semi-Finals' : 'Grand Final';
}

function enterBracketMatch() {
  G.phase = 'bracket_match';

  const match = getHumanBracketMatch(G);
  if (!match) { handleBracketContinue(); return; }

  G._bracketOpponent = match.teamA?.isHuman ? match.teamB : match.teamA;
  enterMatchPhase();
}

function handleBracketContinue() {
  const result = G.lastMatchResult;
  const blueWins = result.winner === 'blue';

  applyBracketResult(G, blueWins, result.stats);

  const { bracket } = G;

  if (bracket.bracketRound === 'eliminated') {
    renderBracket(G);
    renderGameOver(G, false);
    showScreen('screen-gameover');
    return;
  }

  if (bracket.bracketRound === 'finals' && humanInBracket(G)) {
    showScreen('screen-bracket');
    renderBracket(G);
    setTimeout(() => enterBracketShop(), 1200);
    return;
  }

  if (bracket.bracketRound === 'done') {
    renderBracket(G);
    const isChamp = bracket.champion?.isHuman;
    renderGameOver(G, isChamp);
    showScreen('screen-gameover');
    return;
  }

  // If human won semis but finals opponent is TBD, simulate other semi first
  resolveSemis(G);
  showScreen('screen-bracket');
  renderBracket(G);
  setTimeout(() => enterBracketShop(), 1200);
}

// ─── Shop Event Handlers ──────────────────────────────────────────────────────

function onBuyPlayer(shopIndex) {
  const result = buyShopPlayer(G, shopIndex);
  if (!result) {
    showToast('Not enough gold or no roster space!');
    return;
  }
  renderShop(G);
  renderHeader(G);
}

function onSellPlayer(instanceId) {
  sellPlayer(G, instanceId);
  renderShop(G);
  renderHeader(G);
}

function onReroll() {
  if (!rerollShop(G)) {
    showToast('Not enough gold to reroll! (costs 2g)');
    return;
  }
  renderShop(G);
  renderHeader(G);
}

function onLockShop() {
  const locked = toggleLockShop(G);
  renderShop(G);
}

function onBuyXP() {
  if (!buyXP(G)) {
    showToast(G.level >= 5 ? 'Already max level!' : 'Not enough gold! (costs 4g)');
    return;
  }
  renderShop(G);
  renderHeader(G);
}

function onReady() {
  const blueTeam = G.roster.filter(Boolean);
  if (blueTeam.length === 0) {
    showToast('Buy at least 1 player before going to battle!');
    return;
  }

  if (G.phase === 'bracket_shop') {
    enterBracketMatch();
  } else {
    enterMatchPhase();
  }
}

// ─── Match Event Handlers ─────────────────────────────────────────────────────

function onStartMatch() {
  startMatchSimulation();
}

function onPhaseTab(phase) {
  activatePhaseTab(phase);
}

function onViewResults() {
  enterResultsPhase();
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function playAgain() {
  // Reset state
  Object.assign(G, {
    phase: 'setup', teamName: '', gold: 0, xp: 0, level: 1,
    round: 1, winStreak: 0, loseStreak: 0,
    roster: [null,null,null,null,null], bench: [],
    shopSlots: [], shopLocked: false,
    playerPool: [], allTeams: [], aiTeams: [],
    schedule: [], bracket: null,
    lastMatchResult: null, lastIncome: null,
  });
  showScreen('screen-setup');
}

// ─── DOM Ready ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Setup screen
  document.getElementById('btn-start-game')?.addEventListener('click', startGame);
  document.getElementById('team-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') startGame();
  });

  // Shop controls
  document.getElementById('btn-reroll')?.addEventListener('click', onReroll);
  document.getElementById('btn-lock-shop')?.addEventListener('click', onLockShop);
  document.getElementById('btn-buy-xp')?.addEventListener('click', onBuyXP);
  document.getElementById('btn-ready')?.addEventListener('click', onReady);

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      showTab(tab);
      if (tab === 'standings') renderStandings(G);
      if (tab === 'roster')    { renderRosterInShop(G); renderBench(G); }
    });
  });

  // Match screen
  document.getElementById('btn-start-match')?.addEventListener('click', onStartMatch);

  document.querySelectorAll('.phase-tab').forEach(btn => {
    btn.addEventListener('click', () => onPhaseTab(btn.dataset.phase));
  });

  document.getElementById('btn-view-results')?.addEventListener('click', onViewResults);

  // Results screen
  document.getElementById('btn-continue')?.addEventListener('click', continueAfterResults);

  // Game over
  document.getElementById('btn-play-again')?.addEventListener('click', playAgain);
});
