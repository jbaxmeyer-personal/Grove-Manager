// tests/finance.test.js — headless finance/sponsor tests. Run: node tests/finance.test.js
'use strict';
const assert = require('assert');
const { loadGame } = require('./sim-harness');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✅  ${name}`); }
  catch (e) { fail++; console.log(`  ❌  ${name}\n       ${e.stack.split('\n').slice(0, 2).join(' | ')}`); }
}
function fresh(teamId = 'vs') { const api = loadGame(); api.initGame(teamId); return api; }

console.log('\n── Finances & sponsors ─────────────────────────────────');
test('new career: every sponsor has a slot + contract length, income = sum of deals', () => {
  const api = fresh(); const t = api.G.teams.vs;
  assert.ok(t.sponsors.length > 0);
  for (const sp of t.sponsors) { assert.ok(api.SPONSOR_SLOTS.some(s => s.key === sp.slot)); assert.ok(sp.weeksLeft > 0); }
  assert.strictEqual(t.sponsorIncome, t.sponsors.reduce((s, x) => s + x.weeklyIncome, 0));
  assert.strictEqual(new Set(t.sponsors.map(s => s.slot)).size, t.sponsors.length, 'no duplicate slots');
});
test('open sponsor slots attract offers', () => {
  const api = fresh(); const G = api.G;
  for (let i = 0; i < 4; i++) api.advanceWeek();
  assert.ok(G.sponsorOffers.length > 0, 'expected at least one offer after a few weeks');
});
test('weekly ledger records the revenue/cost breakdown and the balance moves by net', () => {
  const api = fresh(); const G = api.G; const t = G.teams.vs;
  const b0 = t.budget; api.advanceWeek(); const e = G.financeLog[G.financeLog.length - 1];
  for (const k of ['sponsors', 'merch', 'streaming', 'wagesOnly', 'staff', 'facilities', 'net', 'balance']) assert.ok(Number.isFinite(e[k]), k);
  assert.strictEqual(e.balance, t.budget);
  assert.ok(Math.abs((t.budget - b0) - e.net) < 1, `balance delta ${t.budget - b0} vs net ${e.net}`);
  // a second week: delta must also equal net (one-offs included)
  const b1 = t.budget; api.advanceWeek(); const e2 = G.financeLog[G.financeLog.length - 1];
  assert.ok(Math.abs((t.budget - b1) - e2.net) < 1, `week2 delta ${t.budget - b1} vs net ${e2.net}`);
});
test('signing an offer pays the signing bonus, fills the slot and raises income', () => {
  const api = fresh(); const G = api.G; const t = G.teams.vs;
  for (let i = 0; i < 6 && !G.sponsorOffers.some(o => !t.sponsors.some(s => s.slot === o.slot)); i++) api.advanceWeek();
  const o = G.sponsorOffers.find(x => !t.sponsors.some(s => s.slot === x.slot)) || G.sponsorOffers[0];
  assert.ok(o, 'no offer to test with');
  const b = t.budget, inc = t.sponsorIncome, cur = t.sponsors.find(s => s.slot === o.slot);
  const r = api.acceptSponsorOffer(o.id); assert.ok(r.ok);
  const buyout = cur ? cur.weeklyIncome * 2 : 0;
  assert.strictEqual(t.budget, b + o.signingBonus - buyout);
  assert.ok(t.sponsors.some(s => s.name === o.name && s.slot === o.slot));
  assert.strictEqual(t.sponsorIncome, inc - (cur ? cur.weeklyIncome : 0) + o.weeklyIncome);
  assert.ok(!G.sponsorOffers.some(x => x.id === o.id));
});
test('declining removes the offer', () => {
  const api = fresh(); const G = api.G; for (let i = 0; i < 6 && !G.sponsorOffers.length; i++) api.advanceWeek();
  const o = G.sponsorOffers[0]; assert.ok(o); api.declineSponsorOffer(o.id); assert.ok(!G.sponsorOffers.some(x => x.id === o.id));
});
test('contracts run down: renewal offer at 3 weeks left, slot opens when it expires', () => {
  const api = fresh(); const G = api.G; const t = G.teams.vs; const sp = t.sponsors[0]; sp.weeksLeft = 4;
  api.advanceWeek(); assert.ok(G.sponsorOffers.some(o => o.renewal && o.name === sp.name), 'renewal offer');
  G.sponsorOffers = G.sponsorOffers.filter(o => !o.renewal);
  for (let i = 0; i < 3; i++) api.advanceWeek();
  assert.ok(!t.sponsors.some(s => s.name === sp.name && s.slot === sp.slot), 'expired deal removed');
});
test('league win bonus and playoff prize money are paid', () => {
  const api = fresh(); const G = api.G; const t = G.teams.vs; const b = t.budget;
  api.payWinBonus('vs'); assert.strictEqual(t.budget, b + api.WIN_BONUS);
  const ids = Object.keys(G.teams);
  const pm = [{ round: 'semi1', homeId: ids[0], awayId: ids[3], result: { winnerId: ids[0] } }, { round: 'semi2', homeId: ids[1], awayId: ids[2], result: { winnerId: ids[1] } },
              { round: 'final', homeId: ids[0], awayId: ids[1], result: { winnerId: ids[0] } }];
  const before = ids.map(id => G.teams[id].budget);
  api.payPlayoffPrizes(pm);
  assert.strictEqual(G.teams[ids[0]].budget - before[0], api.PRIZE_MONEY.champion);
  assert.strictEqual(G.teams[ids[1]].budget - before[1], api.PRIZE_MONEY.runnerUp);
  assert.strictEqual(G.teams[ids[3]].budget - before[3], api.PRIZE_MONEY.semifinal);
});
test('a full split of weeks keeps every club\'s money finite', () => {
  const api = fresh(); const G = api.G;
  for (let i = 0; i < 7; i++) api.advanceWeek();
  for (const t of Object.values(G.teams)) assert.ok(Number.isFinite(t.budget), t.id);
});

console.log(`\n  Results: ${pass}/${pass + fail} passed${fail ? `  |  ${fail} failed` : ''}\n`);
process.exit(fail ? 1 : 0);
