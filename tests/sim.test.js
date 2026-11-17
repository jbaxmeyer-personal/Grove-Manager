// tests/sim.test.js — headless simulation tests (no browser). Run: node tests/sim.test.js
'use strict';
const assert = require('assert');
const { loadGame, rosterFor } = require('./sim-harness');

const api = loadGame();
const ids = api.TEAMS_DATA.map(t => t.id);
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✅  ${name}`); }
  catch (e) { fail++; console.log(`  ❌  ${name}\n       ${e.message}`); }
}
const agent = (side, pos, champ) => {
  const i = ['top', 'jungle', 'mid', 'adc', 'support'].indexOf(pos);
  const p = rosterFor(api, side === 'blue' ? ids[0] : ids[1])[i];
  return api.initAgent(side, i, p, champ || p.champions?.[0] || Object.keys(api.CHAMPIONS)[0]);
};

console.log('\n── Economy: minions ─────────────────────────────────────');
test('spawnWave creates 5 minions per lane per side (+siege every 3rd wave)', () => {
  const m = []; api.spawnWave(m, 4, 0, []);
  assert.strictEqual(m.length, 30);
  const m2 = []; api.spawnWave(m2, 40, 3, []);
  assert.strictEqual(m2.length, 36);
  assert.ok(m2.some(x => x.type === 'siege'));
});
test('last-hitting a minion pays CS + gold and the killer gets XP', () => {
  const a = agent('blue', 'mid'); const m = []; api.spawnWave(m, 4, 0, []);
  const red = m.find(x => x.side === 'red'); red.x = a.x + 5; red.y = a.y; red.hp = 0; red.lastHitBy = a;
  const g0 = a.gold, xp0 = a.xp;
  api.resolveMinionDeaths(m, [a]);
  assert.strictEqual(a.cs, 1); assert.strictEqual(a.gold - g0, red.gold); assert.ok(a.xp > xp0);
  assert.ok(!m.includes(red), 'dead minion removed');
});
test('minion XP is shared with nearby enemy champions (not the minion\'s own team)', () => {
  const a = agent('blue', 'adc'), s = agent('blue', 'support'), e = agent('red', 'adc');
  const m = []; api.spawnWave(m, 4, 0, []);
  const red = m.find(x => x.side === 'red'); red.x = a.x; red.y = a.y; s.x = a.x + 3; s.y = a.y; e.x = a.x + 5; e.y = a.y; red.hp = 0;
  api.resolveMinionDeaths(m, [a, s, e]);
  assert.ok(a.xp > 0 && s.xp > 0, 'both blue champions gain XP'); assert.strictEqual(e.xp, 0, 'red gains nothing from its own minion');
  assert.strictEqual(a.xp, s.xp);
});
test('towers shoot minions before champions', () => {
  const objs = api.OBJ_DEFS.map(d => ({ ...d, hp: d.maxHp, destroyed: false, tempDown: false }));
  const t = objs.find(o => o.id === 'r_top1');
  const champ = agent('blue', 'top'); champ.x = t.x; champ.y = t.y + 5; const hp0 = champ.hp;
  const m = []; api.spawnWave(m, 4, 0, []); const bm = m.find(x => x.side === 'blue'); bm.x = t.x; bm.y = t.y + 4; const mhp = bm.hp;
  api.objCounterAttack(objs, [champ], m);
  assert.ok(bm.hp < mhp, 'minion took tower damage'); assert.strictEqual(champ.hp, hp0, 'champion untouched while minion tanks');
});

console.log('\n── Economy: kills, assists, objectives, jungle ──────────');
test('kill pays the killer 300g + XP and assisters 150g + XP', () => {
  const k = agent('blue', 'mid'), as = agent('blue', 'jungle'), v = agent('red', 'mid');
  v.hp = 0; v.recentDmgFrom = [{ id: as.id, tick: 9 }, { id: k.id, tick: 10 }];
  const kg = k.gold, ag = as.gold, events = [], score = { blueKills: 0, redKills: 0, blueShrines: 0, redShrines: 0, blueRoots: 0, redRoots: 0 };
  api.resolveDeaths([k, as, v], events, score, 10);
  assert.strictEqual(k.gold - kg, 300); assert.strictEqual(as.gold - ag, 150);
  assert.ok(k.xp >= api.XP_KILL || k.level > 1); assert.ok(as.xp >= api.XP_ASSIST || as.level > 1);
  assert.strictEqual(k.kills, 1); assert.strictEqual(as.assists, 1); assert.strictEqual(score.blueKills, 1);
  assert.strictEqual(events[0].victimSide, 'red'); assert.strictEqual(events[0].killerRole, 'mid');
});
test('execution by minions/towers gives no champion kill gold', () => {
  const b = agent('blue', 'top'), v = agent('red', 'top'); v.hp = 0; v.recentDmgFrom = [];
  const g = b.gold; api.resolveDeaths([b, v], [], { blueKills: 0, redKills: 0 }, 5);
  assert.strictEqual(b.gold, g); assert.strictEqual(b.kills, 0);
});
test('destroying a tower pays nearby champions and the whole team', () => {
  const objs = api.OBJ_DEFS.map(d => ({ ...d, hp: d.maxHp, destroyed: false, tempDown: false }));
  const t = objs.find(o => o.id === 'r_mid1'); t.hp = 0;
  const near = agent('blue', 'mid'); near.x = t.x; near.y = t.y; const far = agent('blue', 'top');
  const g1 = near.gold, g2 = far.gold, x2 = far.xp;
  api.resolveObjectives(objs, [near, far], [], { blueKills: 0, redKills: 0, blueRoots: 0, redRoots: 0, blueShrines: 0, redShrines: 0, baronBuff: { blue: 0, red: 0 } }, 50);
  assert.ok(t.destroyed); assert.strictEqual(near.gold - g1, 275); assert.strictEqual(far.gold - g2, 75); assert.ok(far.xp > x2);
});
test('Shrine and Warden pay gold + XP', () => {
  for (const id of ['shrine', 'warden']) {
    const objs = api.OBJ_DEFS.map(d => ({ ...d, hp: d.maxHp, destroyed: false, tempDown: false }));
    const o = objs.find(x => x.id === id); o.hp = 0;
    const a = agent('red', 'jungle'); a.x = o.x; a.y = o.y; const g = a.gold;
    api.resolveObjectives(objs, [a], [], { blueKills: 0, redKills: 0, blueRoots: 0, redRoots: 0, blueShrines: 0, redShrines: 0, baronBuff: { blue: 0, red: 0 } }, 80);
    assert.ok(a.gold > g && a.xp > 0, id); assert.ok(o.tempDown, id + ' respawns later');
  }
});
test('jungle camp kill pays gold, XP and CS', () => {
  const j = agent('blue', 'jungle'); const camp = { ...api.JUNGLE_DEF[0], hp: 1, alive: true };
  j.x = camp.x; j.y = camp.y; j.state = 'jungling'; j.target = { type: 'jungle', ref: camp }; j.cdAA = 0;
  const g = j.gold; api.doCombat(j, [], [], [camp], 10);
  assert.ok(!camp.alive); assert.strictEqual(j.gold - g, camp.gold); assert.strictEqual(j.cs, 1); assert.ok(j.xp > 0);
});

console.log('\n── Full matches ─────────────────────────────────────────');
const N = +(process.env.SIM_GAMES || 120);
const results = [];
for (let i = 0; i < N; i++) {
  const a = ids[i % ids.length], b = ids[(i + 3) % ids.length], sw = i % 2;
  results.push(api.simulateMatch(rosterFor(api, sw ? b : a), rosterFor(api, sw ? a : b), 'A', 'B'));
}
test(`${N} matches finish with a winner and sane numbers`, () => {
  for (const r of results) {
    assert.ok(r.winner === 'blue' || r.winner === 'red');
    for (const p of [...r.playerStats.blue, ...r.playerStats.red]) {
      assert.ok(Number.isFinite(p.gold) && p.gold >= 0, 'gold'); assert.ok(p.items.length <= 6, 'items');
    }
    const last = r.events.filter(e => e.type === 'move').pop();
    for (const s of ['blue', 'red']) for (const p of Object.values(last.positions[s])) {
      assert.ok(p.x >= -5 && p.x <= 305 && p.y >= -5 && p.y <= 305, 'champion off map');
    }
  }
});
test('minions are simulated (present in move events) and laners farm them', () => {
  const r = results[0];
  assert.ok(r.events.filter(e => e.type === 'move').some(e => e.minions && e.minions.length > 20));
  const laneCS = results.map(r => [...r.playerStats.blue, ...r.playerStats.red].filter(p => ['top', 'mid', 'adc'].includes(p.pos)).reduce((s, p) => s + p.cs, 0) / 6);
  const avg = laneCS.reduce((a, b) => a + b, 0) / laneCS.length;
  assert.ok(avg >= 6, `avg laner CS ${avg.toFixed(1)} too low`);
});
test('most games end on an Ancient kill (not the time limit)', () => {
  const natural = results.filter(r => r.events[r.events.length - 1].tick < api.MAX_TICKS).length / N;
  assert.ok(natural >= 0.5, `only ${(natural * 100).toFixed(0)}% ended naturally`);
});
test('towers, shrines and kills happen at sensible rates', () => {
  const avg = f => results.reduce((s, r) => s + f(r), 0) / N;
  const towers = avg(r => r.blueRoots + r.redRoots), kills = avg(r => r.blueKills + r.redKills), shrines = avg(r => r.blueShrines + r.redShrines);
  console.log(`       per game: ${towers.toFixed(1)} towers, ${kills.toFixed(1)} kills, ${shrines.toFixed(1)} shrines, ${avg(r => r.duration).toFixed(0)} min`);
  assert.ok(towers >= 5, 'towers'); assert.ok(kills >= 12 && kills <= 50, 'kills'); assert.ok(shrines >= 1, 'shrines');
});
test('no big side bias (blue win rate within 35–65%)', () => {
  const blue = results.filter(r => r.winner === 'blue').length / N;
  assert.ok(blue >= 0.35 && blue <= 0.65, `blue win rate ${(blue * 100).toFixed(0)}%`);
});

console.log(`\n  Results: ${pass}/${pass + fail} passed${fail ? `  |  ${fail} failed` : ''}\n`);
process.exit(fail ? 1 : 0);
