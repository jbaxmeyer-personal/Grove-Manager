// js/game/finance.js — Club finances: revenue streams, sponsor contracts & offers, prize money
//
// Weekly money flow (all teams, see processWeeklyFinances):
//   + sponsors (contracted slots)   + merchandise (fans)   + streaming/content (fans × engagement)
//   − player wages   − staff wages (human)   − facility upkeep (human)
// One-off items (transfer fees, sponsor signing bonuses/bonus payouts, prize money, facility
// builds, events…) are recorded with finNote() and rolled into that week's ledger entry.
'use strict';

const SPONSOR_SLOTS = [
  { key: 'jersey',      label: 'Jersey (main partner)', icon: '👕', weight: 1.00 },
  { key: 'peripherals', label: 'Peripherals',           icon: '🖱️', weight: 0.55 },
  { key: 'energy',      label: 'Energy drink',          icon: '⚡', weight: 0.45 },
  { key: 'apparel',     label: 'Apparel',               icon: '🧢', weight: 0.40 },
  { key: 'broadcast',   label: 'Streaming platform',    icon: '📺', weight: 0.35 },
];

const SPONSOR_BRANDS = {
  jersey:      ['GroveTech Gaming', 'Canopy Bank', 'Verdant Mobile', 'Rootline Telecom', 'Mossbyte Cloud', 'Elderwood Motors'],
  peripherals: ['Thornkey Peripherals', 'Barkclick', 'Sapling Audio', 'Leafline Mice', 'Ironwood Gear'],
  energy:      ['Sylvane Energy', 'Sapburst', 'Glowcap Soda', 'Thunderroot Drinks', 'Dewfall Hydration'],
  apparel:     ['Fernweave', 'Bramble & Co', 'Oakthread', 'Lichen Labs Apparel'],
  broadcast:   ['GroveStream', 'Hollowcast', 'Brookline TV', 'Spritewave Live'],
};

const BONUS_TEMPLATES = [
  { condition: 'wins_3',    label: 'Win 3 matches',    mult: 1.2 },
  { condition: 'wins_5',    label: 'Win 5 matches',    mult: 2.0 },
  { condition: 'playoffs',  label: 'Reach playoffs',   mult: 2.5 },
  { condition: 'champion',  label: 'Win the split',    mult: 4.0 },
  { condition: 'fans_500k', label: 'Reach 500K fans',  mult: 1.6 },
  { condition: 'fans_1m',   label: 'Reach 1M fans',    mult: 2.4 },
];

const WIN_BONUS     = 30000;   // league pays per series win
const PRIZE_MONEY   = { champion: 600000, runnerUp: 300000, semifinal: 150000 };
const MERCH_PER_FAN = 0.015;   // $/fan/week
const STREAM_PER_FAN = 0.008;  // $/fan/week at engagement 5/10

// ─── State / migration ───────────────────────────────────────────────────────

function ensureFinanceState() {
  if (!G) return;
  if (!G.financeLog) G.financeLog = [];
  if (!G.sponsorOffers) G.sponsorOffers = [];
  if (!G.finPending) G.finPending = {};
  if (G._sponsorSeq === undefined) G._sponsorSeq = 1000;
  Object.values(G.teams).forEach(t => {
    if (!t.sponsors) t.sponsors = [];
    const used = new Set(t.sponsors.map(s => s.slot).filter(Boolean));
    t.sponsors.forEach(sp => {
      if (!sp.slot) { sp.slot = SPONSOR_SLOTS.find(s => !used.has(s.key))?.key || 'broadcast'; used.add(sp.slot); }
      if (sp.weeksLeft === undefined) sp.weeksLeft = 10 + Math.floor(Math.random() * 18);
      if (sp.weeksTotal === undefined) sp.weeksTotal = sp.weeksLeft;
      if (!sp.bonuses) sp.bonuses = [];
    });
    recomputeSponsorIncome(t);
  });
}

function recomputeSponsorIncome(team) {
  team.sponsorIncome = (team.sponsors || []).reduce((s, sp) => s + (sp.weeklyIncome || 0), 0);
  return team.sponsorIncome;
}

// Record a one-off money movement for the human team's weekly ledger.
function finNote(teamId, category, amount) {
  if (!G || teamId !== G.humanTeamId || !amount) return;
  if (!G.finPending) G.finPending = {};
  G.finPending[category] = (G.finPending[category] || 0) + amount;
}

// ─── Revenue model ───────────────────────────────────────────────────────────

function weeklyRevenue(team) {
  const fans = team.fans || 0;
  const fes  = team.fes !== undefined ? team.fes : 5;
  return {
    sponsors:  recomputeSponsorIncome(team),
    merch:     Math.round(fans * MERCH_PER_FAN),
    streaming: Math.round(fans * STREAM_PER_FAN * (0.4 + fes / 5 * 0.6)),
  };
}

function weeklyExpenses(team) {
  const human = team.id === G.humanTeamId;
  return {
    wages:      team.weeklyWages || 0,
    staff:      human && typeof getStaffWages === 'function' ? getStaffWages() : 0,
    facilities: human && typeof getFacilityMaintenanceCost === 'function' ? getFacilityMaintenanceCost(team.id) : 0,
  };
}

// Called once per week from advanceWeek() for every team.
function processWeeklyFinances(week) {
  ensureFinanceState();
  Object.values(G.teams).forEach(t => {
    t.weeklyWages = calcWagesBill(t.id);
    processSponsorContracts(t, week);
    const rev = weeklyRevenue(t), exp = weeklyExpenses(t);
    const income  = rev.sponsors + rev.merch + rev.streaming;
    const outgoing = exp.wages + exp.staff + exp.facilities;
    t.budget = (t.budget || 0) + income - outgoing;
    if (t.id === G.humanTeamId) {
      G._ledgerDraft = {
        week, season: `${G.season.split || ''} ${G.season.year || ''}`.trim(),
        sponsors: rev.sponsors, merch: rev.merch, streaming: rev.streaming,
        wagesOnly: exp.wages, staff: exp.staff, facilities: exp.facilities,
      };
    }
  });
  generateSponsorOffers(week);
}

// Called at the end of advanceWeek() (after fan engagement, scouting, events… have spent money)
// so the ledger balance is the true end-of-week balance. mergeIntoLast folds late one-offs
// (e.g. playoff prize money paid after the week closed) into the previous entry.
function closeFinanceWeek(mergeIntoLast = false) {
  const t = G.teams[G.humanTeamId];
  const extra = G.finPending || {};
  const extraIn  = Object.values(extra).filter(v => v > 0).reduce((a, b) => a + b, 0);
  const extraOut = -Object.values(extra).filter(v => v < 0).reduce((a, b) => a + b, 0);
  if (mergeIntoLast && G.financeLog.length && !G._ledgerDraft) {
    const e = G.financeLog[G.financeLog.length - 1];
    e.other = e.other || {};
    for (const [k, v] of Object.entries(extra)) e.other[k] = (e.other[k] || 0) + v;
    e.income += extraIn; e.wages += extraOut; e.net += extraIn - extraOut; e.balance = t.budget;
    G.finPending = {};
    return e;
  }
  const d = G._ledgerDraft; if (!d) return null;
  const income = d.sponsors + d.merch + d.streaming, outgoing = d.wagesOnly + d.staff + d.facilities;
  const e = { ...d, other: { ...extra },
    // legacy fields (kept for older views/saves)
    income: income + extraIn, wages: outgoing + extraOut, net: income + extraIn - outgoing - extraOut, balance: t.budget };
  G.financeLog.push(e);
  if (G.financeLog.length > 120) G.financeLog.shift();
  G.finPending = {}; G._ledgerDraft = null;
  if (t.budget < 0) addNews(`Financial warning: budget is ${fmtMoneySafe(t.budget)}. Consider releasing high earners or signing sponsors.`, 'alert');
  return e;
}

// ─── Sponsor contracts ───────────────────────────────────────────────────────

function _teamWinPct(t) { const g = (t.wins || 0) + (t.losses || 0); return g ? t.wins / g : 0.5; }

function sponsorValue(team, slotKey) {
  const slot = SPONSOR_SLOTS.find(s => s.key === slotKey) || SPONSOR_SLOTS[0];
  const fans = Math.max(50000, team.fans || 0);
  const prestige = team.prestige || 5;
  const perf = 0.85 + _teamWinPct(team) * 0.4;                // 0.85 – 1.25
  const base = 70000 * slot.weight * Math.pow(fans / 1000000, 0.55) * (0.75 + prestige / 25) * perf;
  return Math.round(base / 1000) * 1000;
}

function _makeOffer(team, slotKey, week, opts = {}) {
  const brandPool = SPONSOR_BRANDS[slotKey] || SPONSOR_BRANDS.jersey;
  const taken = new Set([...(team.sponsors || []).map(s => s.name), ...(G.sponsorOffers || []).map(o => o.name)]);
  const name = opts.name || brandPool.find(b => !taken.has(b)) || brandPool[Math.floor(Math.random() * brandPool.length)];
  const val  = Math.round(sponsorValue(team, slotKey) * (opts.mult || (0.85 + Math.random() * 0.35)) / 1000) * 1000;
  const weeks = [12, 16, 20, 26][Math.floor(Math.random() * 4)];
  const picks = BONUS_TEMPLATES.slice().sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
  return {
    id: `so${++G._sponsorSeq}`, name, slot: slotKey, weeklyIncome: Math.max(5000, val), weeks,
    signingBonus: Math.round(val * (1 + Math.random() * 2) / 1000) * 1000,
    bonuses: picks.map((b, i) => ({ id: `b${G._sponsorSeq}_${i}`, condition: b.condition, label: b.label, reward: Math.round(val * b.mult / 1000) * 1000, paid: false })),
    expiresWeek: week + 3, renewal: !!opts.renewal,
  };
}

function processSponsorContracts(team, week) {
  const human = team.id === G.humanTeamId;
  team.sponsors = (team.sponsors || []).filter(sp => {
    sp.weeksLeft = (sp.weeksLeft ?? 20) - 1;
    if (human && sp.weeksLeft === 3 && !G.sponsorOffers.some(o => o.renewal && o.name === sp.name)) {
      const o = _makeOffer(team, sp.slot, week, { name: sp.name, renewal: true, mult: 0.95 + Math.random() * 0.25 });
      o.expiresWeek = week + 3; G.sponsorOffers.push(o);
      addNews(`${sp.name} want to extend their ${slotLabel(sp.slot)} deal — review it in Finances › Sponsors.`, 'info');
    }
    if (sp.weeksLeft > 0) return true;
    if (!human) {           // CPU clubs simply re-sign at market value
      sp.weeklyIncome = sponsorValue(team, sp.slot); sp.weeksLeft = sp.weeksTotal = 16 + Math.floor(Math.random() * 10);
      return true;
    }
    addNews(`Sponsorship expired: ${sp.name} (${slotLabel(sp.slot)}). The slot is now open.`, 'alert');
    return false;
  });
  recomputeSponsorIncome(team);
}

function slotLabel(key) { return (SPONSOR_SLOTS.find(s => s.key === key) || {}).label || key; }

function generateSponsorOffers(week) {
  const team = G.teams[G.humanTeamId];
  G.sponsorOffers = (G.sponsorOffers || []).filter(o => o.expiresWeek >= week);
  const open = SPONSOR_SLOTS.filter(s => !team.sponsors.some(sp => sp.slot === s.key));
  // open slots attract an offer within a week or two
  open.forEach(s => {
    if (!G.sponsorOffers.some(o => o.slot === s.key) && Math.random() < 0.7) G.sponsorOffers.push(_makeOffer(team, s.key, week));
  });
  // occasionally a rival brand tries to poach a filled slot with a bigger deal
  if (week % 3 === 0 && G.sponsorOffers.length < 4) {
    const filled = team.sponsors[Math.floor(Math.random() * team.sponsors.length)];
    if (filled && !G.sponsorOffers.some(o => o.slot === filled.slot)) G.sponsorOffers.push(_makeOffer(team, filled.slot, week, { mult: 1.05 + Math.random() * 0.25 }));
  }
}

function acceptSponsorOffer(offerId) {
  ensureFinanceState();
  const team = G.teams[G.humanTeamId];
  const o = G.sponsorOffers.find(x => x.id === offerId);
  if (!o) return { ok: false, msg: 'Offer no longer available' };
  const current = team.sponsors.find(sp => sp.slot === o.slot);
  let buyout = 0;
  if (current && current.name !== o.name) {
    buyout = Math.round(current.weeklyIncome * 2);            // early-termination fee
    team.budget -= buyout; finNote(team.id, 'sponsorBuyout', -buyout);
    addNews(`Ended the ${current.name} deal early (${fmtMoneySafe(buyout)} termination fee).`, 'info');
  }
  team.sponsors = team.sponsors.filter(sp => sp.slot !== o.slot);
  team.sponsors.push({ id: o.id, name: o.name, slot: o.slot, weeklyIncome: o.weeklyIncome, weeksLeft: o.weeks, weeksTotal: o.weeks,
                       bonuses: o.bonuses.map(b => ({ ...b })) });
  team.budget += o.signingBonus; finNote(team.id, 'signingBonus', o.signingBonus);
  G.sponsorOffers = G.sponsorOffers.filter(x => x.id !== offerId && !(x.slot === o.slot && x.renewal && x.name !== o.name));
  recomputeSponsorIncome(team);
  addNews(`Signed ${o.name} as ${slotLabel(o.slot)} partner: ${fmtMoneySafe(o.weeklyIncome)}/wk for ${o.weeks} weeks (+${fmtMoneySafe(o.signingBonus)} signing bonus).`, 'info');
  if (typeof saveGame === 'function') saveGame();
  return { ok: true, buyout };
}

function declineSponsorOffer(offerId) {
  ensureFinanceState();
  G.sponsorOffers = G.sponsorOffers.filter(x => x.id !== offerId);
  if (typeof saveGame === 'function') saveGame();
  return { ok: true };
}

// ─── Prize money ─────────────────────────────────────────────────────────────

function payWinBonus(teamId) {
  const t = G.teams[teamId]; if (!t) return;
  t.budget += WIN_BONUS; finNote(teamId, 'prizeMoney', WIN_BONUS);
}

function payPlayoffPrizes(pm) {
  const pay = (id, amt, label) => {
    const t = G.teams[id]; if (!t) return;
    t.budget += amt; finNote(id, 'prizeMoney', amt);
    if (id === G.humanTeamId) addNews(`Prize money: ${label} — ${fmtMoneySafe(amt)}.`, 'info');
  };
  const gf = pm.find(m => m.round === 'final');
  pm.filter(m => m.round !== 'final' && m.result).forEach(sf => {
    const loser = sf.result.winnerId === sf.homeId ? sf.awayId : sf.homeId;
    pay(loser, PRIZE_MONEY.semifinal, 'semi-finalist');
  });
  if (gf && gf.result) {
    const loser = gf.result.winnerId === gf.homeId ? gf.awayId : gf.homeId;
    pay(gf.result.winnerId, PRIZE_MONEY.champion, 'split champions');
    pay(loser, PRIZE_MONEY.runnerUp, 'grand finalist');
  }
}
