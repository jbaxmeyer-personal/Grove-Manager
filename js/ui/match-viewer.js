// js/ui/match-viewer.js — Match viewer: matchup panel, minimap canvas, commentary
// Layout: Left=matchup panels+comms, Center=minimap, Right=live commentary
'use strict';

(function () {

  // ── Constants ──────────────────────────────────────────────────────────────
  const TICK_S    = 2;       // in-game seconds per tick (must match simulation.js)
  const MAP_SIZE  = 300;
  const POSITIONS = ['top', 'jungle', 'mid', 'adc', 'support'];
  const ROLE_LBL  = { top:'TOP', jungle:'JGL', mid:'MID', adc:'ADC', support:'SUP' };

  const COL = {
    bg:        '#111a11',
    lane:      '#5a3a1a',
    baseBlue:  '#0a1830',
    baseRed:   '#2a0a0a',
    jungle:    '#162616',
    blue:      '#4fc3f7',
    red:       '#ff7b7b',
    neutral:   '#c89b3c',
    baron:     '#9b59b6',
    tower_b:   '#4fc3f7',
    tower_r:   '#ff7b7b',
  };

  const EV_META = {
    kill:       { cls: 'ev-kill',      icon: '⚔️',  label: 'KILL'   },
    teamfight:  { cls: 'ev-fight',     icon: '💥',  label: 'FIGHT'  },
    objective:  { cls: 'ev-obj',       icon: '🏛️', label: 'OBJ'    },
    dragon:     { cls: 'ev-dragon',    icon: '🐉',  label: 'DRAGON' },
    baron:      { cls: 'ev-baron',     icon: '👁',  label: 'BARON'  },
    herald:     { cls: 'ev-herald',    icon: '🌀',  label: 'HERALD' },
    tower:      { cls: 'ev-tower',     icon: '🗼',  label: 'TOWER'  },
    inhibitor:  { cls: 'ev-inhibitor', icon: '💎',  label: 'INHIB'  },
    commentary: { cls: 'ev-commentary',icon: '',    label: ''       },
    comms:      { cls: 'ev-comms',     icon: '',    label: ''       },
    result:     { cls: 'ev-result',    icon: '🏆',  label: 'RESULT' },
  };

  const TOWERS = [
    { id:'b_bot1', x:185, y:265, side:'blue' }, { id:'b_bot2', x:115, y:265, side:'blue' },
    { id:'b_mid1', x:110, y:190, side:'blue' }, { id:'b_mid2', x: 80, y:220, side:'blue' },
    { id:'b_top1', x: 35, y:185, side:'blue' }, { id:'b_top2', x: 35, y:115, side:'blue' },
    { id:'r_top1', x:115, y: 35, side:'red'  }, { id:'r_top2', x:185, y: 35, side:'red'  },
    { id:'r_mid1', x:190, y:110, side:'red'  }, { id:'r_mid2', x:220, y: 80, side:'red'  },
    { id:'r_bot1', x:265, y:115, side:'red'  }, { id:'r_bot2', x:265, y:185, side:'red'  },
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  let _events      = [];
  let _tickGroups  = {};
  let _maxTick     = 0;
  let _curTick     = 0;
  let _speed       = 1;
  let _paused      = false;
  let _timer       = null;
  let _onEnd       = null;

  let _blueName    = 'Blue';
  let _redName     = 'Red';
  let _champNames  = { blue: {}, red: {} };
  let _playerNames = { blue: {}, red: {} };
  let _humanSide   = 'blue';

  let _positions   = { blue: {}, red: {} };
  let _agentStats  = { blue: {}, red: {} };
  let _objStates   = {};
  let _score = { blueKills:0, redKills:0, blueRoots:0, redRoots:0,
                 blueShrines:0, redShrines:0, blueWarden:0, redWarden:0 };

  // rAF interpolation
  let _prevPos     = { blue:{}, red:{} };
  let _nextPos     = { blue:{}, red:{} };
  let _tickStartMs = 0;
  let _tickMs      = TICK_S * 1000;
  let _rafHandle   = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  window.initMatchViewer = function (events, blueName, redName, champNames, playerNames, humanSide, onEnd) {
    _events      = events || [];
    _blueName    = blueName  || 'Blue';
    _redName     = redName   || 'Red';
    _champNames  = champNames  || { blue:{}, red:{} };
    _playerNames = playerNames || { blue:{}, red:{} };
    _humanSide   = humanSide || 'blue';
    _onEnd       = onEnd || null;

    // Group events by tick
    _tickGroups = {};
    _maxTick    = 0;
    _events.forEach(ev => {
      const t = ev.tick || 0;
      if (!_tickGroups[t]) _tickGroups[t] = [];
      _tickGroups[t].push(ev);
      if (t > _maxTick) _maxTick = t;
    });

    _curTick     = 0;
    _speed       = 1;
    _paused      = false;
    _positions   = { blue:{}, red:{} };
    _agentStats  = { blue:{}, red:{} };
    _objStates   = {};
    _score       = { blueKills:0, redKills:0, blueRoots:0, redRoots:0,
                     blueShrines:0, redShrines:0, blueWarden:0, redWarden:0 };
    _prevPos     = { blue:{}, red:{} };
    _nextPos     = { blue:{}, red:{} };
    _tickStartMs = performance.now();
    _tickMs      = TICK_S * 1000;

    _buildMatchupPanel();
    _clearFeeds();
    _updateSpeedBtns(1);
    _stopRaf();
    _startRaf();
    _startTimer();
  };

  window.mvSetSpeed = function (s) {
    _speed  = s;
    _tickMs = Math.max(50, Math.round(TICK_S * 1000 / s));
    _paused = false;
    _updateSpeedBtns(s);
    const btn = document.getElementById('mv-btn-pause');
    if (btn) btn.textContent = '⏸';
    if (_timer) clearInterval(_timer);
    _startTimer();
  };

  window.mvPause = function () {
    _paused = !_paused;
    const btn = document.getElementById('mv-btn-pause');
    if (btn) btn.textContent = _paused ? '▶' : '⏸';
    if (_paused) {
      if (_timer) clearInterval(_timer);
      _timer = null;
    } else {
      _tickStartMs = performance.now(); // reset lerp start on resume
      _startTimer();
    }
  };

  // ── Timer ──────────────────────────────────────────────────────────────────

  function _startTimer () {
    if (_timer) clearInterval(_timer);
    _tickMs = Math.max(50, Math.round(TICK_S * 1000 / _speed));
    _timer = setInterval(_advanceTick, _tickMs);
  }

  function _advanceTick () {
    if (_paused) return;
    // Snapshot positions before this tick's events
    _prevPos = _deepCopyPos(_positions);

    const evs = _tickGroups[_curTick] || [];
    evs.forEach(_applyEvent);

    // Snapshot positions after this tick's events
    _nextPos = _deepCopyPos(_positions);
    _tickStartMs = performance.now();

    _curTick++;
    if (_curTick > _maxTick) {
      clearInterval(_timer);
      _timer = null;
      // Keep rAF running briefly so final positions render, then stop
      setTimeout(_stopRaf, 2000);
    }
  }

  // ── rAF Interpolation ──────────────────────────────────────────────────────

  function _startRaf () {
    if (_rafHandle) cancelAnimationFrame(_rafHandle);
    function loop (now) {
      const elapsed = now - _tickStartMs;
      const t = Math.min(1, elapsed / (_tickMs || (TICK_S * 1000)));
      _drawMinimapLerped(t);
      _rafHandle = requestAnimationFrame(loop);
    }
    _rafHandle = requestAnimationFrame(loop);
  }

  function _stopRaf () {
    if (_rafHandle) { cancelAnimationFrame(_rafHandle); _rafHandle = null; }
  }

  function _deepCopyPos (pos) {
    const out = { blue:{}, red:{} };
    ['blue','red'].forEach(side => {
      POSITIONS.forEach(role => {
        const d = pos[side]?.[role];
        if (d) out[side][role] = { x:d.x, y:d.y, hp:d.hp, maxHp:d.maxHp, alive:d.alive };
      });
    });
    return out;
  }

  function _drawMinimapLerped (t) {
    // Build interpolated position map
    const lerped = { blue:{}, red:{} };
    ['blue','red'].forEach(side => {
      POSITIONS.forEach(role => {
        const p = _prevPos[side]?.[role];
        const n = _nextPos[side]?.[role];
        if (n) {
          lerped[side][role] = {
            x:     p ? p.x + (n.x - p.x) * t : n.x,
            y:     p ? p.y + (n.y - p.y) * t : n.y,
            hp:    n.hp,
            maxHp: n.maxHp,
            alive: n.alive,
          };
        }
      });
    });
    _drawMinimapWithPos(lerped);
  }

  // ── Event application ──────────────────────────────────────────────────────

  function _applyEvent (ev) {
    if (!ev) return;

    if (ev.positions)  { _positions  = ev.positions; }
    if (ev.agentStats) { _agentStats = ev.agentStats; _updateMatchupPanel(); }
    if (ev.objectives) { _updateObjStates(ev.objectives); }

    if (ev.blueKills   !== undefined) _score.blueKills   = ev.blueKills;
    if (ev.redKills    !== undefined) _score.redKills    = ev.redKills;
    if (ev.blueRoots   !== undefined) _score.blueRoots   = ev.blueRoots;
    if (ev.redRoots    !== undefined) _score.redRoots    = ev.redRoots;
    if (ev.blueShrines !== undefined) _score.blueShrines = ev.blueShrines;
    if (ev.redShrines  !== undefined) _score.redShrines  = ev.redShrines;
    if (ev.blueWarden  !== undefined) _score.blueWarden  = ev.blueWarden;
    if (ev.redWarden   !== undefined) _score.redWarden   = ev.redWarden;

    if (ev.time) { const el = document.getElementById('match-game-timer'); if (el) el.textContent = ev.time; }
    if (ev.advAfter !== undefined) _updateAdvBar(ev.advAfter);
    _updateScoreHeader();

    if (ev.type && ev.type !== 'move') _addToFeed(ev);

    if (ev.type === 'result' && _onEnd) setTimeout(_onEnd, 1500);
  }

  // ── Score Header ───────────────────────────────────────────────────────────

  function _updateScoreHeader () {
    _setText('score-blue-kills',   _score.blueKills);
    _setText('score-red-kills',    _score.redKills);
    _setText('score-blue-roots',   _score.blueRoots);
    _setText('score-red-roots',    _score.redRoots);
    _setText('score-blue-shrines', _score.blueShrines);
    _setText('score-red-shrines',  _score.redShrines);

    let bg = 0, rg = 0;
    POSITIONS.forEach(p => {
      bg += _agentStats.blue?.[p]?.gold || 0;
      rg += _agentStats.red?.[p]?.gold  || 0;
    });
    const fmt = g => g >= 1000 ? (g/1000).toFixed(1) + 'K' : String(g);
    _setText('mh-blue-gold', fmt(bg));
    _setText('mh-red-gold',  fmt(rg));
  }

  function _updateAdvBar (adv) {
    const fill = document.getElementById('advantage-fill');
    if (fill) fill.style.width = (adv ?? 50) + '%';
  }

  // ── Objective states ───────────────────────────────────────────────────────

  function _updateObjStates (objectives) {
    objectives.forEach(o => { _objStates[o.id] = o; });
    // No direct draw call — rAF loop handles rendering
  }

  // ── Matchup Panel ──────────────────────────────────────────────────────────

  function _buildMatchupPanel () {
    const container = document.getElementById('mv-matchup-rows');
    if (!container) return;

    _setText('mv-blue-team-name', _blueName);
    _setText('mv-red-team-name',  _redName);

    container.innerHTML = POSITIONS.map(pos => {
      const bl = _playerNames.blue?.[pos] || '—';
      const rl = _playerNames.red?.[pos]  || '—';
      const bc = (_champNames.blue?.[pos] || pos).slice(0, 3).toUpperCase();
      const rc = (_champNames.red?.[pos]  || pos).slice(0, 3).toUpperCase();
      return `
<div class="mv-role-row" id="mv-row-${pos}">
  <!-- BLUE SIDE -->
  <div class="mv-player mv-side-blue">
    <div class="mv-champ-bubble mv-bubble-blue" id="mv-bc-${pos}">${bc}</div>
    <div class="mv-pinfo">
      <div class="mv-pinfo-top">
        <span class="mv-pname" id="mv-bname-${pos}">${_esc(bl)}</span>
        <span class="mv-lvl-badge" id="mv-blvl-${pos}">1</span>
        <span class="mv-ult-badge" id="mv-bult-${pos}" title="Ultimate ready">R</span>
      </div>
      <div class="mv-hp-bar-wrap">
        <div class="mv-hp-fill mv-hp-blue" id="mv-bhp-${pos}" style="width:100%"></div>
      </div>
      <div class="mv-pinfo-bot">
        <span class="mv-kda-val" id="mv-bkda-${pos}">0/0/0</span>
        <span class="mv-cs-val" id="mv-bcs-${pos}">0 CS</span>
      </div>
      <div class="mv-items-row" id="mv-bitems-${pos}">${_emptyItems()}</div>
    </div>
  </div>

  <!-- GOLD DIFF -->
  <div class="mv-gold-diff-col">
    <div class="mv-role-lbl">${ROLE_LBL[pos]}</div>
    <div class="mv-gdiff" id="mv-gdiff-${pos}">—</div>
  </div>

  <!-- RED SIDE -->
  <div class="mv-player mv-side-red">
    <div class="mv-pinfo mv-pinfo-right">
      <div class="mv-pinfo-top mv-pinfo-top-r">
        <span class="mv-ult-badge" id="mv-rult-${pos}" title="Ultimate ready">R</span>
        <span class="mv-lvl-badge" id="mv-rlvl-${pos}">1</span>
        <span class="mv-pname" id="mv-rname-${pos}">${_esc(rl)}</span>
      </div>
      <div class="mv-hp-bar-wrap">
        <div class="mv-hp-fill mv-hp-red" id="mv-rhp-${pos}" style="width:100%"></div>
      </div>
      <div class="mv-pinfo-bot mv-pinfo-bot-r">
        <span class="mv-cs-val" id="mv-rcs-${pos}">0 CS</span>
        <span class="mv-kda-val" id="mv-rkda-${pos}">0/0/0</span>
      </div>
      <div class="mv-items-row mv-items-right" id="mv-ritems-${pos}">${_emptyItems()}</div>
    </div>
    <div class="mv-champ-bubble mv-bubble-red" id="mv-rc-${pos}">${rc}</div>
  </div>
</div>`;
    }).join('');
  }

  function _emptyItems () {
    return '<div class="mv-item-slot"></div>'.repeat(3);
  }

  function _updateMatchupPanel () {
    POSITIONS.forEach(pos => {
      const bs = _agentStats.blue?.[pos];
      const rs = _agentStats.red?.[pos];
      if (!bs || !rs) return;

      _setWidth(`mv-bhp-${pos}`, bs.isDead ? 0 : (bs.hp / bs.maxHp) * 100);
      _setWidth(`mv-rhp-${pos}`, rs.isDead ? 0 : (rs.hp / rs.maxHp) * 100);

      _setText(`mv-bkda-${pos}`, `${bs.kills}/${bs.deaths}/${bs.assists}`);
      _setText(`mv-rkda-${pos}`, `${rs.kills}/${rs.deaths}/${rs.assists}`);

      _setText(`mv-bcs-${pos}`, `${bs.cs} CS`);
      _setText(`mv-rcs-${pos}`, `${rs.cs} CS`);

      _setText(`mv-blvl-${pos}`, bs.level);
      _setText(`mv-rlvl-${pos}`, rs.level);

      const diff = (bs.gold || 0) - (rs.gold || 0);
      const gdEl = document.getElementById(`mv-gdiff-${pos}`);
      if (gdEl) {
        const k = Math.abs(diff / 1000).toFixed(1);
        gdEl.textContent = diff > 100 ? `+${k}k` : diff < -100 ? `-${k}k` : '~';
        gdEl.className   = 'mv-gdiff ' +
          (diff > 500 ? 'gdiff-blue' : diff < -500 ? 'gdiff-red' : 'gdiff-even');
      }

      _toggleClass(`mv-bult-${pos}`, 'ult-ready', !!bs.ultReady);
      _toggleClass(`mv-rult-${pos}`, 'ult-ready', !!rs.ultReady);

      _renderItems(`mv-bitems-${pos}`, bs.items || []);
      _renderItems(`mv-ritems-${pos}`, rs.items || []);

      _toggleClass(`mv-row-${pos}`, 'row-dead-blue', !!bs.isDead);
      _toggleClass(`mv-row-${pos}`, 'row-dead-red',  !!rs.isDead);
    });
  }

  function _renderItems (id, items) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const slot = document.createElement('div');
      slot.className = 'mv-item-slot';
      if (items[i]) {
        const name   = (typeof ITEM_MAP !== 'undefined' && ITEM_MAP[items[i]]?.name) || items[i];
        const abbr   = name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
        slot.textContent = abbr;
        slot.title       = name;
        slot.classList.add('mv-item-filled');
      }
      el.appendChild(slot);
    }
  }

  // ── Minimap Canvas ─────────────────────────────────────────────────────────

  function _drawMinimapWithPos (drawPos) {
    const canvas = document.getElementById('mv-minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;
    const sx  = W / MAP_SIZE;
    const sy  = H / MAP_SIZE;

    // Background
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, W, H);

    // Base zones
    ctx.fillStyle = COL.baseBlue;
    ctx.fillRect(0, H * 0.70, W * 0.23, H * 0.30);
    ctx.fillStyle = COL.baseRed;
    ctx.fillRect(W * 0.77, 0, W * 0.23, H * 0.30);

    // Lanes
    ctx.strokeStyle = COL.lane;
    ctx.lineWidth   = Math.max(3, W * 0.05);
    ctx.lineCap     = 'round';
    _line(ctx, 0.07*W, 0.88*H, 0.93*W, 0.88*H);
    _line(ctx, 0.07*W, 0.12*H, 0.93*W, 0.12*H);
    _line(ctx, 0.12*W, 0.07*H, 0.12*W, 0.93*H);
    _line(ctx, 0.88*W, 0.07*H, 0.88*W, 0.93*H);
    _line(ctx, 0.12*W, 0.88*H, 0.88*W, 0.12*H);

    // River accent
    ctx.strokeStyle = 'rgba(100,160,200,0.18)';
    ctx.lineWidth   = W * 0.10;
    _line(ctx, 0*W, 0.5*H, 0.5*W, 0*H);
    _line(ctx, 0.5*W, 1.0*H, 1.0*W, 0.5*H);

    // Dragon pit
    _drawPit(ctx, 0.22*W, 0.78*H, W*0.055, 'rgba(200,155,60,0.3)', COL.neutral, '🐉', W);
    // Baron pit
    _drawPit(ctx, 0.78*W, 0.22*H, W*0.055, 'rgba(155,89,182,0.3)', COL.baron,   '👁', W);

    // Towers
    TOWERS.forEach(t => {
      const state = _objStates[t.id];
      if (state && (state.destroyed || state.tempDown)) return;
      const tx = t.x * sx, ty = t.y * sy;
      const s  = W * 0.025;
      ctx.fillStyle   = t.side === 'blue' ? COL.tower_b : COL.tower_r;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth   = 0.5;
      ctx.fillRect(tx - s, ty - s, s*2, s*2);
      ctx.strokeRect(tx - s, ty - s, s*2, s*2);
    });

    // Bases (nexus)
    _drawBase(ctx, 0.055*W, 0.88*H, W*0.035, COL.blue);
    _drawBase(ctx, 0.945*W, 0.12*H, W*0.035, COL.red);

    // Champion dots (use interpolated drawPos)
    ['blue','red'].forEach(side => {
      POSITIONS.forEach(pos => {
        const d = drawPos[side]?.[pos];
        if (!d) return;
        const dx    = d.x * sx;
        const dy    = d.y * sy;
        const alive = d.alive !== false;
        const r     = W * 0.032;

        if (alive && d.maxHp > 0) {
          const pct = Math.max(0, Math.min(1, d.hp / d.maxHp));
          const hc  = pct > 0.6 ? '#4caf50' : pct > 0.3 ? '#ffeb3b' : '#f44336';
          ctx.strokeStyle = '#222';
          ctx.lineWidth   = 2.5;
          ctx.beginPath(); ctx.arc(dx, dy, r+1.5, 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle = hc;
          ctx.lineWidth   = 2.5;
          ctx.beginPath();
          ctx.arc(dx, dy, r+1.5, -Math.PI/2, -Math.PI/2 + pct * Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = alive ? 1.0 : 0.35;
        ctx.fillStyle   = alive ? (side === 'blue' ? COL.blue : COL.red) : '#555';
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle    = '#fff';
        ctx.globalAlpha  = alive ? 0.95 : 0.5;
        ctx.font         = `bold ${Math.max(7, Math.floor(r * 0.95))}px sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pos[0].toUpperCase(), dx, dy);
        ctx.globalAlpha  = 1;
        ctx.textBaseline = 'alphabetic';
      });
    });
  }

  function _line (ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function _drawPit (ctx, cx, cy, r, fill, stroke, emoji, W) {
    ctx.fillStyle   = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    ctx.font         = `${Math.max(10, Math.floor(W * 0.08))}px serif`;
    ctx.fillStyle    = stroke;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy);
    ctx.textBaseline = 'alphabetic';
  }

  function _drawBase (ctx, cx, cy, r, color) {
    ctx.fillStyle   = color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  }

  // ── Commentary / Comms ─────────────────────────────────────────────────────

  function _clearFeeds () {
    const cf = document.getElementById('mv-commentary-feed');
    const sf = document.getElementById('mv-comms-feed');
    if (cf) cf.innerHTML = '';
    if (sf) sf.innerHTML = '';
  }

  function _addToFeed (ev) {
    const isComms = ev.type === 'comms';

    // Filter comms: only show messages from the human's team
    if (isComms && ev.side !== _humanSide) return;

    const feed = document.getElementById(isComms ? 'mv-comms-feed' : 'mv-commentary-feed');
    if (!feed) return;

    const meta = EV_META[ev.type] || EV_META.commentary;
    const row  = document.createElement('div');
    row.className = 'mv-ev-row ' + meta.cls;

    const sideTag = ev.side === 'blue' ? ' ev-blue' : ev.side === 'red' ? ' ev-red' : '';

    if (isComms) {
      row.innerHTML =
        `<span class="ev-role ev-role-${ev.side||''}">${(ev.role||'').toUpperCase()}</span>` +
        `<span class="ev-comms-text">${_esc(ev.text||'')}</span>`;
    } else {
      row.innerHTML =
        `<span class="ev-time">${ev.time||''}</span>` +
        (meta.icon  ? `<span class="ev-icon">${meta.icon}</span>` : '') +
        (meta.label ? `<span class="ev-label${sideTag}">${meta.label}</span>` : '') +
        `<span class="ev-text${sideTag}">${_esc(ev.text||'')}</span>`;
    }

    feed.insertBefore(row, feed.firstChild);
    while (feed.children.length > 80) feed.removeChild(feed.lastChild);

    row.classList.add('ev-new');
    setTimeout(() => row.classList.remove('ev-new'), 600);
  }

  // ── Speed buttons ──────────────────────────────────────────────────────────

  function _updateSpeedBtns (s) {
    [1, 2, 5].forEach(n => {
      const btn = document.getElementById(`mv-btn-${n}x`);
      if (btn) btn.classList.toggle('speed-active', n === s);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _setText (id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _setWidth (id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + '%';
  }

  function _toggleClass (id, cls, on) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle(cls, on);
  }

  function _esc (s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

})();
