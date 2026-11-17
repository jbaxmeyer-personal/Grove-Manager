// tests/sim-harness.js — load the browser game scripts into a Node VM so the
// simulation can be run headless (no DOM). Used by tests/sim.test.js.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['js/data/teams.js', 'js/data/champions.js', 'js/data/items.js', 'js/data/players.js',
                 'js/game/state.js', 'js/game/finance.js', 'js/game/simulation.js'];

function loadGame() {
  const store = {};
  const ctx = {
    console, Math, JSON, Date, setTimeout, clearTimeout,
    renderAll() {}, renderTopBar() {}, showMain() {},
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } },
    document: { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} } }) },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  // `const`/`let` at script top level live in the context's global lexical scope;
  // expose the ones tests need by evaluating a getter script at the end.
  let src = SCRIPTS.map(f => `// ---- ${f}\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
  src += `\n;globalThis.__api = { simulateMatch, draftChampions, TEAMS_DATA, PLAYER_DB, CHAMPIONS, OBJ_DEFS, JUNGLE_DEF,
    initAgent, spawnWave, tickMinions, resolveMinionDeaths, resolveDeaths, resolveObjectives, doCombat, grantXP,
    objCounterAttack, MINION_DEF, XP_KILL, XP_ASSIST, MAX_TICKS, CLOCK_SCALE, TICK_S,
    getTeamRoster: typeof getTeamRoster === 'function' ? getTeamRoster : null,
    initGame: typeof initGame === 'function' ? initGame : null,
    advanceWeek: typeof advanceWeek === 'function' ? advanceWeek : null,
    acceptSponsorOffer, declineSponsorOffer, ensureFinanceState, weeklyRevenue, payWinBonus, payPlayoffPrizes,
    SPONSOR_SLOTS, WIN_BONUS, PRIZE_MONEY,
    get G() { return typeof G !== 'undefined' ? G : null; } };`;
  vm.runInContext(src, ctx, { filename: 'game-bundle.js' });
  return ctx.__api;
}

function rosterFor(api, teamId) {
  const all = api.PLAYER_DB.filter(p => p.teamId === teamId);
  return ['top', 'jungle', 'mid', 'adc', 'support'].map(pos => all.find(p => p.position === pos) || all[0]);
}

module.exports = { loadGame, rosterFor };
