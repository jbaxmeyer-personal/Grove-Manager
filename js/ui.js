// js/ui.js — All rendering functions

// ─── Screen Management ────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function showTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const content = document.getElementById(`tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');
}

// ─── Header ───────────────────────────────────────────────────────────────────

function renderHeader(state) {
  document.getElementById('header-team-name').textContent = state.teamName;
  document.getElementById('header-record').textContent = `${state.allTeams[0].wins}W - ${state.allTeams[0].losses}L`;
  document.getElementById('header-gold').textContent = state.gold;
  document.getElementById('header-level').textContent = state.level;

  const phaseLabels = {
    shop: `Round ${state.round} of ${CONFIG.ROUND_ROBIN_ROUNDS} — Shop`,
    bracket_shop: 'Playoffs — Shop',
  };
  const phaseLabelEl = document.getElementById('header-phase');
  if (phaseLabelEl) phaseLabelEl.textContent = phaseLabels[state.phase] || '';
}

// ─── XP Bar ───────────────────────────────────────────────────────────────────

function renderXPBar(state) {
  const currentLevelXP = CONFIG.LEVEL_XP[state.level] || 0;
  const nextLevelXP    = CONFIG.LEVEL_XP[state.level + 1] || currentLevelXP;
  const xpInLevel      = state.xp - currentLevelXP;
  const xpNeeded       = nextLevelXP - currentLevelXP;
  const pct            = state.level >= 5 ? 100 : (xpInLevel / xpNeeded) * 100;

  const fill  = document.getElementById('xp-fill');
  const label = document.getElementById('xp-label');
  if (fill)  fill.style.width = `${pct}%`;
  if (label) label.textContent = state.level >= 5
    ? 'MAX LEVEL'
    : `${xpInLevel}/${xpNeeded} XP · Level ${state.level}`;

  const countEl = document.getElementById('roster-count');
  if (countEl) countEl.textContent = `${state.roster.filter(Boolean).length}/${maxRosterSize(state)}`;
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

function tierColor(tier) {
  const colors = { 1:'#95a5a6', 2:'#2ecc71', 3:'#3498db', 4:'#9b59b6', 5:'#d4af37' };
  return colors[tier] || '#aaa';
}

function tierLabel(tier) {
  return ['', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'][tier] || 'Unknown';
}

function starDisplay(stars) {
  return stars === 3 ? '★★★' : stars === 2 ? '★★' : '';
}

function posIcon(pos) {
  const icons = { top:'⚔️', jungle:'🌿', mid:'🔮', adc:'🏹', support:'🛡️' };
  return icons[pos] || '👤';
}

// ─── Player Card ──────────────────────────────────────────────────────────────

function playerCardHTML(player, context = 'shop', shopIndex = null) {
  if (!player) {
    return `<div class="player-card empty"><span class="empty-label">${context === 'roster' ? 'Empty Slot' : 'Empty'}</span></div>`;
  }

  const cost   = CONFIG.TIER_COST[player.tier];
  const sell   = CONFIG.TIER_SELL[player.tier];
  const color  = tierColor(player.tier);
  const stars  = starDisplay(player.stars);
  const stats  = context === 'shop' ? player.stats : getEffectiveStats(player);

  let actionBtn = '';
  if (context === 'shop') {
    actionBtn = `<button class="btn-buy" data-shop-index="${shopIndex}" onclick="onBuyPlayer(${shopIndex})">Buy · ${cost}g</button>`;
  } else if (context === 'roster' || context === 'bench') {
    actionBtn = `<button class="btn-sell" onclick="onSellPlayer('${player.instanceId}')">Sell · ${sell}g</button>`;
  }

  const champList = (player.champions || []).join(', ');
  const topStat   = getTopStats(player.stats);

  return `
    <div class="player-card tier-${player.tier}" style="border-color:${color}" data-instance="${player.instanceId || ''}">
      <div class="card-header" style="background:${color}22">
        <span class="card-pos">${posIcon(player.position)}</span>
        <span class="card-name">${player.name}${stars ? ` <span class="stars">${stars}</span>` : ''}</span>
        <span class="card-tier" style="color:${color}">${tierLabel(player.tier)}</span>
      </div>
      <div class="card-region">${player.region}</div>
      <div class="card-champs" title="Champion Pool">🎮 ${champList}</div>
      <div class="card-stats-mini">${topStat}</div>
      <div class="card-actions">${actionBtn}</div>
    </div>`;
}

function getTopStats(stats) {
  const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return sorted.map(([k, v]) => `<span class="stat-pill">${statAbbr(k)}<b>${v}</b></span>`).join('');
}

function statAbbr(key) {
  const map = { mechanics:'MEC', laning:'LAN', gameSense:'GS', teamfighting:'TF', communication:'COM', clutch:'CLU', consistency:'CON', draftIQ:'DIQ' };
  return map[key] || key.toUpperCase().slice(0,3);
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

function renderShop(state) {
  const container = document.getElementById('shop-slots');
  if (!container) return;

  container.innerHTML = state.shopSlots.map((p, i) =>
    p ? playerCardHTML(p, 'shop', i) : `<div class="player-card empty"><span class="empty-label">Sold Out</span></div>`
  ).join('');

  renderRosterInShop(state);
  renderBench(state);
  renderXPBar(state);
  renderHeader(state);

  const lockBtn = document.getElementById('btn-lock-shop');
  if (lockBtn) lockBtn.textContent = state.shopLocked ? '🔓 Unlock Shop' : '🔒 Lock Shop';
}

function renderRosterInShop(state) {
  const container = document.getElementById('active-roster');
  if (!container) return;

  const maxSlots = maxRosterSize(state);
  const slots    = Array.from({ length: CONFIG.ROSTER_MAX }, (_, i) => state.roster[i] || null);

  container.innerHTML = slots.map((p, i) => {
    if (i >= maxSlots) {
      return `<div class="player-card locked"><span class="empty-label">🔒 Lv${i+1}</span></div>`;
    }
    return playerCardHTML(p, 'roster', i);
  }).join('');
}

function renderBench(state) {
  const container = document.getElementById('bench-slots');
  const countEl   = document.getElementById('bench-count');
  if (!container) return;

  const maxBench = CONFIG.BENCH_MAX;
  const slots    = Array.from({ length: maxBench }, (_, i) => state.bench[i] || null);

  container.innerHTML = slots.map((p) =>
    p ? playerCardHTML(p, 'bench') : `<div class="player-card empty small"></div>`
  ).join('');

  if (countEl) countEl.textContent = `${state.bench.length}/${maxBench}`;
}

// ─── Standings ────────────────────────────────────────────────────────────────

function renderStandings(state) {
  const container = document.getElementById('standings-table');
  if (!container) return;

  const standings = getStandings(state);

  container.innerHTML = `
    <h3>Season Standings — Round ${state.round - 1} of ${CONFIG.ROUND_ROBIN_ROUNDS}</h3>
    <table class="standings">
      <thead>
        <tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>K/D</th></tr>
      </thead>
      <tbody>
        ${standings.map((team, i) => {
          const isHuman  = team.isHuman;
          const inBracket = i < CONFIG.BRACKET_SIZE;
          const rowClass  = isHuman ? 'row-human' : (inBracket ? 'row-bracket' : '');
          const diff      = team.kills - team.deaths;
          return `<tr class="${rowClass}">
            <td>${i + 1}${inBracket ? ' 🏆' : ''}</td>
            <td>${isHuman ? '⭐ ' : ''}${team.name}</td>
            <td>${team.wins}</td>
            <td>${team.losses}</td>
            <td>${team.kills}/${team.deaths} (${diff >= 0 ? '+' : ''}${diff})</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <p class="bracket-note">Top 4 teams advance to playoffs.</p>`;
}

// ─── Opponent Preview ─────────────────────────────────────────────────────────

function renderOpponentPreview(state) {
  const container = document.getElementById('opponent-info');
  if (!container) return;

  const opp = getHumanOpponent(state);
  if (!opp) { container.innerHTML = '<p>No opponent found.</p>'; return; }

  const roster = opp.roster || [];
  const rosterHTML = roster.map(p =>
    `<div class="opp-player"><span>${posIcon(p.position)}</span><span class="opp-name">${p.name}</span><span class="opp-region">${p.region}</span><span class="opp-tier" style="color:${tierColor(p.tier)}">${tierLabel(p.tier)}</span></div>`
  ).join('');

  container.innerHTML = `
    <div class="opp-header">
      <span class="opp-team-name">${opp.name}</span>
      <span class="opp-record">${opp.wins}W - ${opp.losses}L</span>
    </div>
    <div class="opp-roster">${rosterHTML || '<p>Unknown roster</p>'}</div>`;
}

// ─── Match Screen ─────────────────────────────────────────────────────────────

function renderDraft(matchResult, blueTeamName, redTeamName) {
  document.getElementById('match-blue-name').textContent = blueTeamName;
  document.getElementById('match-red-name').textContent  = redTeamName;

  const blueEl = document.getElementById('draft-blue');
  const redEl  = document.getElementById('draft-red');
  if (!blueEl || !redEl) return;

  const renderDraftTeam = (picks) => picks.filter(Boolean).map(pick =>
    `<div class="draft-pick">
      <span class="pick-pos">${posIcon(pick.position)}</span>
      <span class="pick-player">${pick.player}</span>
      <span class="pick-champ">on ${pick.champion}</span>
    </div>`
  ).join('');

  blueEl.innerHTML = renderDraftTeam(matchResult.draft.blue.filter(Boolean));
  redEl.innerHTML  = renderDraftTeam(matchResult.draft.red.filter(Boolean));

  // Comp synergies
  const synergyEl = document.getElementById('comp-synergies');
  if (synergyEl) {
    const blueSyn = matchResult.draft.blueComp ? COMP_SYNERGIES[matchResult.draft.blueComp] : null;
    const redSyn  = matchResult.draft.redComp  ? COMP_SYNERGIES[matchResult.draft.redComp]  : null;
    const parts   = [];
    if (blueSyn) parts.push(`<span class="synergy blue-syn">🔵 ${blueSyn.name}: ${blueSyn.desc}</span>`);
    if (redSyn)  parts.push(`<span class="synergy red-syn">🔴 ${redSyn.name}: ${redSyn.desc}</span>`);
    synergyEl.innerHTML = parts.join('');
  }
}

function renderMatchPhase(matchResult, phase) {
  const container = document.getElementById('play-by-play');
  if (!container) return;

  const events = matchResult.events[phase] || [];
  container.innerHTML = events.map(e => eventHTML(e)).join('');

  // Animate entries
  container.querySelectorAll('.event-entry').forEach((el, i) => {
    el.style.animationDelay = `${i * 0.06}s`;
    el.classList.add('fade-in');
  });

  updateScoreBar(matchResult);
}

function eventHTML(e) {
  const typeClass = {
    kill:'event-kill', objective:'event-objective', teamfight:'event-teamfight',
    commentary:'event-commentary', result:'event-result'
  }[e.type] || '';
  return `<div class="event-entry ${typeClass}">
    <span class="event-time">${e.time}</span>
    <span class="event-text">${e.text}</span>
  </div>`;
}

function updateScoreBar(matchResult) {
  const { stats, advantage } = matchResult;

  setText('score-blue-kills',   stats.blue.kills);
  setText('score-blue-dragons', `🐉${stats.blue.dragons}`);
  setText('score-blue-towers',  `🏰${stats.blue.towers}`);
  setText('score-red-kills',    stats.red.kills);
  setText('score-red-dragons',  `🐉${stats.red.dragons}`);
  setText('score-red-towers',   `🏰${stats.red.towers}`);

  const fill = document.getElementById('advantage-fill');
  if (fill) {
    fill.style.width    = `${advantage}%`;
    fill.style.background = advantage >= 50
      ? `linear-gradient(90deg, #1a4a8c ${100 - advantage}%, #4fc3f7 100%)`
      : `linear-gradient(90deg, #ff7b7b 0%, #8c1a1a ${advantage}%)`;
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function renderResults(state, matchResult, won, income) {
  const banner  = document.getElementById('results-banner');
  const goldDiv = document.getElementById('results-gold');
  const statsDiv= document.getElementById('results-stats');
  if (!banner) return;

  banner.className  = `results-banner ${won ? 'win' : 'loss'}`;
  banner.innerHTML  = won
    ? `<span class="result-icon">🏆</span><span class="result-text">VICTORY</span>`
    : `<span class="result-icon">💀</span><span class="result-text">DEFEAT</span>`;

  goldDiv.innerHTML = `
    <h3>Gold Earned</h3>
    <div class="gold-breakdown">
      <span>Base: <b>${income.base}g</b></span>
      <span>Interest: <b>${income.interest}g</b></span>
      <span>Streak: <b>${income.streakBonus}g</b></span>
      <span class="gold-total">Total: <b>${income.total}g</b></span>
    </div>`;

  const s = matchResult.stats;
  statsDiv.innerHTML = `
    <h3>Match Stats</h3>
    <table class="match-stats-table">
      <thead><tr><th>${state.teamName}</th><th>Stat</th><th>Opponent</th></tr></thead>
      <tbody>
        <tr><td>${s.blue.kills}</td><td>Kills</td><td>${s.red.kills}</td></tr>
        <tr><td>${s.blue.deaths}</td><td>Deaths</td><td>${s.red.deaths}</td></tr>
        <tr><td>${s.blue.dragons}</td><td>Dragons</td><td>${s.red.dragons}</td></tr>
        <tr><td>${s.blue.towers}</td><td>Towers</td><td>${s.red.towers}</td></tr>
        <tr><td>${s.blue.barons||0}</td><td>Barons</td><td>${s.red.barons||0}</td></tr>
      </tbody>
    </table>`;
}

// ─── Bracket Screen ───────────────────────────────────────────────────────────

function renderBracket(state) {
  const container = document.getElementById('bracket-view');
  if (!container || !state.bracket) return;

  const { semis, final, champion } = state.bracket;

  const matchHTML = (match, label) => {
    const aWon = match.winner && match.winner.id === match.teamA?.id;
    const bWon = match.winner && match.winner.id === match.teamB?.id;
    return `
      <div class="bracket-match">
        <div class="bracket-label">${label}</div>
        <div class="bracket-team ${aWon ? 'winner' : ''} ${match.teamA?.isHuman ? 'human-team' : ''}">
          ${match.teamA?.isHuman ? '⭐ ' : ''}${match.teamA?.name || 'TBD'}
          ${aWon ? ' 🏆' : ''}
        </div>
        <div class="vs-label">VS</div>
        <div class="bracket-team ${bWon ? 'winner' : ''} ${match.teamB?.isHuman ? 'human-team' : ''}">
          ${match.teamB?.isHuman ? '⭐ ' : ''}${match.teamB?.name || 'TBD'}
          ${bWon ? ' 🏆' : ''}
        </div>
      </div>`;
  };

  container.innerHTML = `
    <div class="bracket-grid">
      <div class="bracket-col">
        <h3>Semi-Finals</h3>
        ${semis.map((m, i) => matchHTML(m, `Match ${i+1}`)).join('')}
      </div>
      <div class="bracket-col">
        <h3>Grand Final</h3>
        ${matchHTML(final, 'Final')}
        ${champion ? `<div class="champion-banner">🏆 Champion: ${champion.name}</div>` : ''}
      </div>
    </div>`;
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────

function renderGameOver(state, isChampion) {
  const el = document.getElementById('gameover-content');
  if (!el) return;

  const human = state.allTeams[0];
  const standings = getStandings(state);
  const finalPlace = standings.findIndex(t => t.isHuman) + 1;

  if (isChampion) {
    el.innerHTML = `
      <div class="gameover-win">
        <div class="trophy-big">🏆</div>
        <h1>WORLD CHAMPIONS!</h1>
        <p>${state.teamName} has conquered the season!</p>
        <p class="final-record">${human.wins}W - ${human.losses}L · ${human.kills}K / ${human.deaths}D</p>
      </div>`;
  } else {
    const messages = {
      2: 'Runner-up — so close!',
      3: 'Semifinalist — respectable!',
      4: 'Semifinalist — came up short.',
    };
    el.innerHTML = `
      <div class="gameover-loss">
        <div class="trophy-big">💀</div>
        <h2>Season Over</h2>
        <p>${messages[finalPlace] || `Finished ${finalPlace}th in the regular season.`}</p>
        <p>${state.teamName} ended with a record of ${human.wins}W - ${human.losses}L</p>
      </div>`;
  }
}
