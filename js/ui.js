// js/ui.js — All rendering functions

// ─── Screen / Tab Management ─────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function showTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.classList.add('active');
  document.getElementById(`tab-${tabName}`)?.classList.add('active');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tierColor(tier)  { return ['','#95a5a6','#2ecc71','#3498db','#9b59b6','#d4af37'][tier]||'#aaa'; }
function tierLabel(tier)  { return ['','Iron','Silver','Gold','Platinum','Diamond'][tier]||''; }
function posIcon(pos)     { return { top:'⚔️', jungle:'🌿', mid:'🔮', adc:'🏹', support:'🛡️' }[pos]||'👤'; }
function starBadge(stars) { return stars === 3 ? '<span class="star-badge s3">★★★</span>' : stars === 2 ? '<span class="star-badge s2">★★</span>' : ''; }

function statAbbr(key) {
  return { mechanics:'MEC', laning:'LAN', gameSense:'GS', teamfighting:'TF', communication:'COM', clutch:'CLU', consistency:'CON', draftIQ:'DIQ' }[key] || key.slice(0,3).toUpperCase();
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ─── Header ──────────────────────────────────────────────────────────────────

function renderHeader(state) {
  setText('header-team-name', state.teamName);
  setText('header-record',    `${(state.allTeams[0]||{}).wins||0}W – ${(state.allTeams[0]||{}).losses||0}L`);
  setText('header-gold',      state.gold);
  setText('header-level',     state.level);
}

// ─── XP Bar ──────────────────────────────────────────────────────────────────

function renderXPBar(state) {
  const curXP    = CONFIG.LEVEL_XP[state.level]     || 0;
  const nextXP   = CONFIG.LEVEL_XP[state.level + 1] || curXP;
  const inLevel  = state.xp - curXP;
  const needed   = nextXP - curXP;
  const pct      = state.level >= 5 ? 100 : (inLevel / needed) * 100;

  const fill  = document.getElementById('xp-fill');
  const label = document.getElementById('xp-label');
  if (fill)  fill.style.width = `${pct}%`;
  if (label) label.textContent = state.level >= 5 ? 'MAX LEVEL' : `${inLevel}/${needed} XP · Lv${state.level}`;
}

// ─── Player Card ─────────────────────────────────────────────────────────────

function playerCardHTML(player, ctx, extra = {}) {
  if (!player) {
    const label = extra.locked ? `🔒 Slot ${extra.slotNum}` : 'Empty';
    return `<div class="player-card empty${extra.locked?' locked':''}"><span class="empty-label">${label}</span></div>`;
  }

  const color    = tierColor(player.tier);
  const eStats   = getEffectiveStats(player);
  const top3     = Object.entries(eStats).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const isSelected = extra.selectedId && extra.selectedId === player.instanceId;

  const traitBadges = (player.traits || []).map(t => {
    const def = CONFIG.TRAITS[t];
    return def ? `<span class="trait-chip" style="border-color:${def.color};color:${def.color}">${def.icon} ${t}</span>` : '';
  }).join('');

  const champList = (player.champions || []).join(' · ');

  let actionRow = '';
  if (ctx === 'shop') {
    const cost = CONFIG.TIER_COST[player.tier];
    actionRow = `<button class="btn-buy" onclick="onBuyPlayer(${extra.shopIndex})">Buy <b>${cost}g</b></button>`;
  } else if (ctx === 'roster') {
    const sell = CONFIG.TIER_SELL[player.tier];
    actionRow = `
      <div class="card-btn-row">
        <button class="btn-to-bench" onclick="onMoveToBench('${player.instanceId}')">▼ Bench</button>
        <button class="btn-sell" onclick="onSellPlayer('${player.instanceId}')">Sell ${sell}g</button>
      </div>`;
  } else if (ctx === 'bench') {
    const sell = CONFIG.TIER_SELL[player.tier];
    actionRow = `
      <div class="card-btn-row">
        <button class="btn-to-roster" onclick="onMoveToRoster('${player.instanceId}')">▲ Start</button>
        <button class="btn-sell" onclick="onSellPlayer('${player.instanceId}')">Sell ${sell}g</button>
      </div>`;
  }

  return `
    <div class="player-card tier-${player.tier}${isSelected?' selected':''}" style="border-color:${color}">
      <div class="card-top" style="background:${color}18">
        <span class="card-pos">${posIcon(player.position)}</span>
        <span class="card-name">${player.name}${starBadge(player.stars)}</span>
        <span class="card-tier" style="color:${color}">${tierLabel(player.tier)}</span>
      </div>
      <div class="card-region">${player.region}</div>
      <div class="card-traits">${traitBadges}</div>
      <div class="card-champs" title="Champion Pool">🎮 ${champList}</div>
      <div class="card-stats">
        ${top3.map(([k,v]) => `<span class="stat-pip">${statAbbr(k)}<b>${v}</b></span>`).join('')}
      </div>
      ${actionRow ? `<div class="card-actions">${actionRow}</div>` : ''}
    </div>`;
}

// ─── Shop Rendering ───────────────────────────────────────────────────────────

function renderShop(state) {
  // Shop slots
  const shopEl = document.getElementById('shop-slots');
  if (shopEl) {
    shopEl.innerHTML = state.shopSlots.map((p, i) =>
      p ? playerCardHTML(p, 'shop', { shopIndex: i })
        : `<div class="player-card empty"><span class="empty-label">—</span></div>`
    ).join('');
  }

  // Active roster (always 5 slots)
  const rosterEl = document.getElementById('active-roster');
  if (rosterEl) {
    rosterEl.innerHTML = Array.from({ length: CONFIG.ROSTER_MAX }, (_, i) => {
      const p = state.roster[i] || null;
      return p ? playerCardHTML(p, 'roster', { selectedId: state.selectedUnit?.instanceId })
               : `<div class="player-card empty"><span class="empty-label">Empty Slot</span></div>`;
    }).join('');
  }

  // Bench
  const benchEl = document.getElementById('bench-slots');
  if (benchEl) {
    benchEl.innerHTML = state.bench.map(p =>
      playerCardHTML(p, 'bench', { selectedId: state.selectedUnit?.instanceId })
    ).join('') || '<div class="bench-empty">No bench players</div>';
    setText('bench-count', `${state.bench.length}/${CONFIG.BENCH_MAX}`);
  }

  renderXPBar(state);
  renderSynergies(state);
  renderHeader(state);

  // Lock button text
  const lockBtn = document.getElementById('btn-lock-shop');
  if (lockBtn) lockBtn.textContent = state.shopLocked ? '🔓 Unlock Shop' : '🔒 Lock Shop';
}

// ─── Synergy Panel ───────────────────────────────────────────────────────────

function renderSynergies(state) {
  const el = document.getElementById('synergy-panel');
  if (!el) return;

  const roster = state.roster.filter(Boolean);
  if (!roster.length) { el.innerHTML = '<p class="syn-empty">Add players to see synergies</p>'; return; }

  const traitResult  = calcTraitSynergies(roster);
  const regionResult = calcRegionSynergy(roster);

  // Trait rows
  const traitRows = traitResult.active.map(s => {
    const def       = CONFIG.TRAITS[s.trait];
    const isActive  = s.activeTier >= 0;
    const nextNote  = s.nextAt ? ` (${s.nextAt - s.count} more for tier ${s.activeTier+2})` : '';
    const bonusText = isActive ? def.desc[s.activeTier] : def.thresholds[0] - s.count > 0
      ? `need ${def.thresholds[0] - s.count} more` : '';
    return `
      <div class="syn-row${isActive?' syn-active':''}">
        <span class="syn-icon" style="color:${def.color}">${def.icon}</span>
        <span class="syn-name">${s.trait}</span>
        <span class="syn-count${isActive?' count-active':''}">${s.count}</span>
        <span class="syn-bonus">${bonusText}${nextNote}</span>
      </div>`;
  }).join('');

  // Region row
  let regionRow = '';
  if (regionResult.maxCount >= 2) {
    const color = CONFIG.REGION_COLORS[regionResult.maxRegion] || '#aaa';
    regionRow = `
      <div class="syn-row syn-active syn-region">
        <span class="syn-icon" style="color:${color}">🌍</span>
        <span class="syn-name">${regionResult.maxRegion}</span>
        <span class="syn-count count-active">${regionResult.maxCount}</span>
        <span class="syn-bonus">${regionResult.desc}</span>
      </div>`;
  }

  el.innerHTML = `
    <div class="syn-title">Team Synergies</div>
    ${traitRows || '<p class="syn-empty">No trait synergies yet</p>'}
    ${regionRow}`;
}

// ─── Standings ────────────────────────────────────────────────────────────────

function renderStandings(state) {
  const el = document.getElementById('standings-table');
  if (!el) return;

  const standings = getStandings(state);
  const roundDone = Math.max(0, state.round - 1);

  el.innerHTML = `
    <h3 style="color:var(--gold);margin-bottom:12px">
      Season Standings — Round ${roundDone}/${CONFIG.ROUND_ROBIN_ROUNDS}
    </h3>
    <table class="standings">
      <thead><tr><th>#</th><th>Team</th><th>Strategy</th><th>W</th><th>L</th><th>K/D</th></tr></thead>
      <tbody>
        ${standings.map((t, i) => {
          const inBracket = i < CONFIG.BRACKET_SIZE;
          const diff = (t.kills||0) - (t.deaths||0);
          return `<tr class="${t.isHuman?'row-human':''} ${inBracket?'row-bracket':''}">
            <td>${i+1}${inBracket?' 🏆':''}</td>
            <td>${t.isHuman?'⭐ ':''}${t.name}</td>
            <td><span class="strat-badge">${t.isHuman?'You':t.strategy||'—'}</span></td>
            <td><b>${t.wins||0}</b></td>
            <td>${t.losses||0}</td>
            <td>${t.kills||0}/${t.deaths||0} <span style="color:${diff>=0?'var(--win)':'var(--loss)'}">(${diff>=0?'+':''}${diff})</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <p class="bracket-note">🏆 Top ${CONFIG.BRACKET_SIZE} advance to Playoffs</p>`;
}

// ─── Opponent Preview ─────────────────────────────────────────────────────────

function renderOpponentPreview(state) {
  const el = document.getElementById('opponent-info');
  if (!el) return;

  const opp = state._bracketOpponent || getHumanOpponent(state);
  if (!opp) { el.innerHTML = '<p style="color:var(--text-dim)">No opponent found.</p>'; return; }

  const roster = (opp.roster || []).filter(Boolean);

  el.innerHTML = `
    <div class="opp-header">
      <span class="opp-team-name">${opp.name}</span>
      <span class="opp-record">${opp.wins||0}W–${opp.losses||0}L</span>
    </div>
    <div class="opp-strategy">Strategy: <b>${opp.strategy||'Unknown'}</b></div>
    <div class="opp-roster">
      ${roster.length ? roster.map(p => `
        <div class="opp-player">
          <span>${posIcon(p.position)}</span>
          <span class="opp-name">${p.name}${p.stars>1?` ★${p.stars}`:''}</span>
          <span style="color:${tierColor(p.tier)};font-size:11px">${tierLabel(p.tier)}</span>
        </div>`).join('')
      : '<p style="color:var(--text-dim);font-size:12px">Roster building...</p>'}
    </div>`;
}

// ─── Match — Draft ────────────────────────────────────────────────────────────

function renderDraft(matchResult, blueTeamName, redTeamName) {
  setText('match-blue-name', blueTeamName);
  setText('match-red-name',  redTeamName);

  const renderPicks = (picks) => picks.filter(Boolean).map(pick => `
    <div class="draft-pick">
      <span class="pick-pos">${posIcon(pick.position)}</span>
      <span class="pick-player">${pick.player}</span>
      <span class="pick-champ">→ ${pick.champion}</span>
    </div>`).join('');

  document.getElementById('draft-blue').innerHTML = renderPicks(matchResult.draft.blue.filter(Boolean));
  document.getElementById('draft-red').innerHTML  = renderPicks(matchResult.draft.red.filter(Boolean));

  const synEl = document.getElementById('comp-synergies');
  if (synEl) {
    const bSyn = matchResult.draft.blueComp ? COMP_SYNERGIES[matchResult.draft.blueComp] : null;
    const rSyn = matchResult.draft.redComp  ? COMP_SYNERGIES[matchResult.draft.redComp]  : null;
    const parts = [];
    if (bSyn) parts.push(`<span class="synergy blue-syn">🔵 ${bSyn.name}: ${bSyn.desc}</span>`);
    if (rSyn) parts.push(`<span class="synergy red-syn">🔴 ${rSyn.name}: ${rSyn.desc}</span>`);
    synEl.innerHTML = parts.join('');
  }

  // Show rating comparison
  const ratingEl = document.getElementById('rating-compare');
  if (ratingEl && matchResult.ratings) {
    const bR = matchResult.ratings.blue;
    const rR = matchResult.ratings.red;
    ratingEl.innerHTML = `
      <div class="rating-bar-group">
        ${ratingBar('Early Game', bR.earlyRating, rR.earlyRating)}
        ${ratingBar('Teamfighting', bR.tfRating, rR.tfRating)}
        ${ratingBar('Late Game', bR.lateRating, rR.lateRating)}
        ${ratingBar('Draft', bR.draftRating, rR.draftRating)}
      </div>`;
  }
}

function ratingBar(label, bVal, rVal) {
  const total = bVal + rVal || 1;
  const bPct  = Math.round((bVal / total) * 100);
  return `
    <div class="r-bar-row">
      <span class="r-label">${label}</span>
      <div class="r-bar-wrap">
        <div class="r-bar-blue" style="width:${bPct}%"></div>
        <div class="r-bar-red"  style="width:${100-bPct}%"></div>
      </div>
      <span class="r-vals">${Math.round(bVal)} | ${Math.round(rVal)}</span>
    </div>`;
}

// ─── Match — Play-by-Play ─────────────────────────────────────────────────────

function renderMatchPhase(matchResult, phase) {
  const el = document.getElementById('play-by-play');
  if (!el) return;

  const events = matchResult.events[phase] || [];
  el.innerHTML = events.map((e, i) => `
    <div class="event-entry event-${e.type}" style="animation-delay:${i*0.05}s">
      <span class="event-time">${e.time}</span>
      <span class="event-text">${e.text}</span>
    </div>`).join('');

  el.querySelectorAll('.event-entry').forEach(el => el.classList.add('fade-in'));
  updateScoreBar(matchResult);
}

function updateScoreBar(mr) {
  const s = mr.stats;
  setText('score-blue-kills',   `${s.blue.kills}K`);
  setText('score-blue-dragons', `🐉${s.blue.dragons}`);
  setText('score-blue-towers',  `🏰${s.blue.towers}`);
  setText('score-red-kills',    `${s.red.kills}K`);
  setText('score-red-dragons',  `🐉${s.red.dragons}`);
  setText('score-red-towers',   `🏰${s.red.towers}`);

  const fill = document.getElementById('advantage-fill');
  if (fill) {
    fill.style.width = `${mr.advantage}%`;
    fill.style.background = mr.advantage >= 50
      ? `linear-gradient(90deg, #0d2a5a ${100-mr.advantage}%, #4fc3f7 100%)`
      : `linear-gradient(90deg, #ff7b7b 0%, #5a0d0d ${mr.advantage}%)`;
  }
}

// ─── Results ──────────────────────────────────────────────────────────────────

function renderResults(state, matchResult, won, income) {
  const bannerEl = document.getElementById('results-banner');
  const goldEl   = document.getElementById('results-gold');
  const statsEl  = document.getElementById('results-stats');
  if (!bannerEl) return;

  bannerEl.className = `results-banner ${won ? 'win' : 'loss'}`;
  bannerEl.innerHTML = won
    ? `<span class="result-icon">🏆</span><span class="result-text">VICTORY</span>`
    : `<span class="result-icon">💀</span><span class="result-text">DEFEAT</span>`;

  goldEl.innerHTML = `
    <h3>Gold Earned</h3>
    <div class="gold-breakdown">
      <span>Base <b>${income.base}g</b></span>
      <span>Interest <b>${income.interest}g</b></span>
      <span>Streak <b>${income.streakBonus}g</b></span>
      <span class="gold-total">Total <b>${income.total}g</b></span>
    </div>`;

  const s = matchResult.stats;
  statsEl.innerHTML = `
    <h3>Match Stats</h3>
    <table class="match-stats-table">
      <thead><tr><th>${state.teamName}</th><th></th><th>Opponent</th></tr></thead>
      <tbody>
        <tr><td class="blue-val">${s.blue.kills}</td><td>Kills</td><td class="red-val">${s.red.kills}</td></tr>
        <tr><td class="blue-val">${s.blue.dragons}</td><td>Dragons</td><td class="red-val">${s.red.dragons}</td></tr>
        <tr><td class="blue-val">${s.blue.towers}</td><td>Towers</td><td class="red-val">${s.red.towers}</td></tr>
        <tr><td class="blue-val">${s.blue.barons}</td><td>Barons</td><td class="red-val">${s.red.barons}</td></tr>
      </tbody>
    </table>`;
}

// ─── Bracket ──────────────────────────────────────────────────────────────────

function renderBracket(state) {
  const el = document.getElementById('bracket-view');
  if (!el || !state.bracket) return;

  const { semis, final, champion } = state.bracket;

  const matchCard = (match, label) => {
    const aW = match.winner?.id === match.teamA?.id;
    const bW = match.winner?.id === match.teamB?.id;
    return `
      <div class="bracket-match">
        <div class="bracket-label">${label}</div>
        <div class="bracket-team ${aW?'winner':''} ${match.teamA?.isHuman?'human-team':''}">
          ${match.teamA?.isHuman?'⭐ ':''}${match.teamA?.name||'TBD'}${aW?' 🏆':''}
        </div>
        <div class="vs-label">vs</div>
        <div class="bracket-team ${bW?'winner':''} ${match.teamB?.isHuman?'human-team':''}">
          ${match.teamB?.isHuman?'⭐ ':''}${match.teamB?.name||'TBD'}${bW?' 🏆':''}
        </div>
      </div>`;
  };

  el.innerHTML = `
    <div class="bracket-grid">
      <div class="bracket-col">
        <h3>Semi-Finals</h3>
        ${semis.map((m,i) => matchCard(m, m.label||`Match ${i+1}`)).join('')}
      </div>
      <div class="bracket-arrow">→</div>
      <div class="bracket-col">
        <h3>Grand Final</h3>
        ${matchCard(final, 'Final')}
        ${champion ? `<div class="champion-banner">🏆 Champion: ${champion.name}</div>` : ''}
      </div>
    </div>`;
}

// ─── Game Over ────────────────────────────────────────────────────────────────

function renderGameOver(state, isChampion) {
  const el = document.getElementById('gameover-content');
  if (!el) return;

  const human    = state.allTeams[0];
  const standings = getStandings(state);
  const place    = standings.findIndex(t => t.isHuman) + 1;

  const placeText = { 1:'🥇 Champions!', 2:'🥈 Runner-Up', 3:'🥉 3rd Place', 4:'4th Place' }[place] || `${place}th`;

  el.innerHTML = isChampion ? `
    <div class="gameover-win">
      <div class="trophy-big">🏆</div>
      <h1>WORLD CHAMPIONS!</h1>
      <p>${state.teamName} defeats all challengers!</p>
      <p class="final-record">${human.wins}W – ${human.losses}L · ${human.kills}K</p>
    </div>` : `
    <div class="gameover-loss">
      <div class="trophy-big">${place <= 2 ? '🥈' : '💀'}</div>
      <h2>${placeText}</h2>
      <p>${state.teamName} ends the season with ${human.wins}W – ${human.losses}L</p>
      ${place > 4 ? '<p>Didn\'t make playoffs — rebuild for next season.</p>' : '<p>So close! Better luck next time.</p>'}
    </div>`;
}
