// tests/e2e/playtest.js — a bot that plays Grove Manager through the real UI, in a real
// browser, the way a person would: picks a team, opens every screen, signs a sponsor, plays
// the draft, watches a match in the 3D view, skips the rest, and advances a full split.
//
// It fails on any JS error, on empty/broken screens, if the 3D view doesn't actually draw,
// or if the season can't be completed. Screenshots + a JSON report land in test-results/.
//
//   node tests/e2e/playtest.js                 # desktop + phone
//   PLAYTEST_DEVICES=mobile node tests/e2e/playtest.js
//   CHROME_PATH=/usr/bin/google-chrome node tests/e2e/playtest.js
'use strict';
const fs = require('fs');
const path = require('path');
const { startServer, launch, ROOT } = require('./harness');

const OUT = path.join(ROOT, 'test-results');
const DEVICES = (process.env.PLAYTEST_DEVICES || 'desktop,mobile,landscape').split(',');   // landscape = phone held sideways
// Desktop plays the whole split; the phone runs check navigation, scrolling and one full series (same game code)
const MAX_STEPS_FOR = d => +(process.env.PLAYTEST_STEPS || (d === 'desktop' ? 40 : 2));
const WATCH_MS = +(process.env.PLAYTEST_WATCH_MS || 20000);

const NAV = ['dashboard', 'teaminfo', 'squad', 'training', 'transfers', 'scouting', 'finances', 'staff', 'facilities',
             'fans', 'news', 'manager', 'champions', 'items', 'statistics', 'league', 'schedule'];

async function run(deviceName, baseUrl) {
  const mobile = deviceName !== 'desktop';
  const { browser, page, errors, swipe } = await launch({ mobile, landscape: deviceName === 'landscape' });
  const dir = path.join(OUT, deviceName); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const report = { device: deviceName, checks: [], failures: [], errors, screenshots: [], matches: [], weeks: 0 };
  let shotN = 0;
  const shot = async name => { const f = `${String(++shotN).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: path.join(dir, f) }); report.screenshots.push(f); };
  const check = (ok, what) => { report.checks.push({ ok: !!ok, what }); if (!ok) report.failures.push(what); return ok; };
  const visible = sel => page.isVisible(sel).catch(() => false);
  // software WebGL keeps the main thread busy during matches, so don't wait for 'stable' frames there
  const click = async (sel, opts = {}) => {
    if (process.env.PLAYTEST_DEBUG) console.log('    · tap', sel);
    const loc = page.locator(sel).first();
    if (mobile) {
      // a person has to scroll it into view with their finger first
      if (!(await thumbReach(sel))) { check(false, `can swipe to "${sel}"`); }
      return loc.tap({ timeout: 15000, force: /^#mv-|#pbp|onStartMatch|onSkipMatch/.test(sel), ...opts });
    }
    await loc.click({ timeout: 15000, force: /^#mv-|#pbp|onStartMatch|onSkipMatch/.test(sel), ...opts });
  };
  const inView = sel => page.evaluate(s => { const el = [...document.querySelectorAll(s)].find(e => e.offsetParent || getComputedStyle(e).position === 'fixed'); if (!el) return null;
    const r = el.getBoundingClientRect(); const bn = document.getElementById('bottom-nav'); const bnShown = bn && bn.getClientRects().length > 0 && bn.getBoundingClientRect().height > 0;
    const bottomLimit = bnShown && !el.closest('#bottom-nav, #more-sheet') ? bn.getBoundingClientRect().top : innerHeight;
    return r.top >= 0 && r.bottom <= bottomLimit + 1 && r.width > 0; }, sel);
  // swipe up/down (real touch) until the element is on screen; false if a thumb can't get it there
  const thumbReach = async sel => {
    for (let i = 0; i < 14; i++) {
      const v = await inView(sel); if (process.env.PLAYTEST_DEBUG) console.log('      inView', sel, v); if (v === null) return false; if (v) return true;
      const below = await page.evaluate(s => { const el = [...document.querySelectorAll(s)].find(e => e.offsetParent || getComputedStyle(e).position === 'fixed'); return el && el.getBoundingClientRect().top > innerHeight / 2; }, sel);
      await swipe(below ? 300 : -300);
    }
    return !!(await inView(sel));
  };
  const goto = async name => {
    if (!mobile) return click(`.sidebar [data-screen="${name}"]`);
    const tab = page.locator(`.bn-item[data-bn="${name}"]`);
    if (await tab.count()) return tab.tap();
    for (let attempt = 0; ; attempt++) {
      try {
        if (!(await page.isVisible('#more-sheet.open'))) await page.locator('.bn-item[data-bn="more"]').tap();
        await page.locator(`.more-item[data-more="${name}"]`).tap({ timeout: 5000 });
        return;
      } catch (e) { if (attempt >= 1) throw e; await page.waitForTimeout(500); }
    }
  };
  const errCount = () => errors.length;
  // A person can only reach a button that is on screen or inside something they can scroll.
  const unreachable = () => page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, bad = [];
    const scrollable = el => { for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (p.scrollHeight > p.clientHeight + 2 || p.scrollWidth > p.clientWidth + 2)) return true; }
      return document.scrollingElement.scrollHeight > vh + 2 && getComputedStyle(document.body).overflowY !== 'hidden' && getComputedStyle(document.documentElement).overflowY !== 'hidden'; };
    document.querySelectorAll('button, .btn-primary, .nav-item, [onclick]').forEach(el => {
      if (!el.offsetParent || el.closest('[style*="display: none"]')) return;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const off = r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw;
      if (off && !scrollable(el)) bad.push((el.id ? '#' + el.id : el.className || el.tagName) + ' ' + (el.textContent || '').trim().slice(0, 24));
    });
    return bad.slice(0, 6);
  });
  const reachCheck = async where => { if (mobile) return; const u = await unreachable(); check(!u.length, `${where}: every button reachable by scrolling${u.length ? ' — stuck: ' + u.join(', ') : ''}`); };

  try {
    // ── Boot ──────────────────────────────────────────────────────────────
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.Match3D === 'object', null, { timeout: 15000 }).catch(() => {});
    check(await page.evaluate(() => !!window.Match3D), '3D module loaded (import map + Three.js)');
    await shot('intro');
    await reachCheck('intro');
    await click('.team-select-card');
    await click('#btn-start');
    await page.waitForSelector('#screen-game.active', { timeout: 8000 });
    check(true, 'started a career');

    // ── Every screen ──────────────────────────────────────────────────────
    for (const name of NAV) {
      const before = errCount();
      try { await goto(name); } catch (e) { check(false, `can navigate to "${name}"${mobile ? ' with the tab bar / More sheet' : ''}`); continue; }
      await page.waitForTimeout(150);
      const panelOk = await page.evaluate(n => {
        const p = document.getElementById('panel-' + n) || document.querySelector('.panel.active');
        return !!p && p.offsetParent !== null && p.innerText.trim().length > 40;
      }, name);
      check(panelOk, `screen "${name}" renders content`);
      check(errCount() === before, `screen "${name}" has no JS errors`);
      await reachCheck(`screen "${name}"`);
      if (mobile) {   // finger-scroll to the bottom of the screen and back
        const before = await page.evaluate(() => scrollY);
        await swipe(500); await swipe(500);
        const after = await page.evaluate(() => scrollY);
        const tall = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 40);
        if (tall) check(after > before, `screen "${name}" scrolls with a finger swipe`);
        await swipe(-1200);
      }
      if (['dashboard', 'finances', 'squad', 'league'].includes(name)) await shot(`screen-${name}`);
    }

    // ── Finances: tabs + sign a sponsor ───────────────────────────────────
    await goto('finances');
    for (const tab of ['sponsors', 'history', 'overview']) {
      await click(`[data-fintab="${tab}"]`); await page.waitForTimeout(100);
      check(await page.evaluate(() => document.getElementById('finances-content').innerText.length > 40), `finances tab "${tab}" renders`);
    }
    await click('[data-fintab="sponsors"]');
    await shot('finances-sponsors');
    const sponsorSigned = await (async () => {
      if (!(await visible('.so-accept'))) return null;
      const before = await page.evaluate(() => ({ budget: G.teams[G.humanTeamId].budget, n: G.sponsorOffers.length }));
      await click('.so-accept');
      const after = await page.evaluate(() => ({ budget: G.teams[G.humanTeamId].budget, n: G.sponsorOffers.length }));
      return after.n === before.n - 1 || after.n < before.n;
    })();
    if (sponsorSigned !== null) check(sponsorSigned, 'signing a sponsor offer works from the UI');

    // ── Season loop ───────────────────────────────────────────────────────
    let watched = false;
    for (let w = 0; w < MAX_STEPS_FOR(deviceName); w++) {
      await goto('dashboard');
      const phase = await page.evaluate(() => G.season.phase);
      if (phase === 'offseason') break;
      if (await visible('#btn-play-match')) {
        await click('#btn-play-match');
        const res = await playSeries(page, { watch: !watched, shot, check, report, visible, click, reachCheck });
        watched = watched || res.watched;
        report.matches.push(res);
      } else {
        const wk = await page.evaluate(() => G.season.week);
        await click('#btn-advance');
        await page.waitForTimeout(250);
        const wk2 = await page.evaluate(() => G.season.week);
        const ph2 = await page.evaluate(() => G.season.phase);
        check(wk2 > wk || ph2 !== phase, `advance week (${wk} → ${wk2}, ${phase} → ${ph2})`);
        report.weeks++;
      }
    }
    const finalPhase = await page.evaluate(() => G.season.phase);
    if (MAX_STEPS_FOR(deviceName) >= 30) {
      check(finalPhase === 'offseason' || finalPhase === 'playoffs', `season progressed to playoffs/offseason (got ${finalPhase})`);
      check(report.matches.length >= 3, `played at least 3 series (${report.matches.length})`);
    } else check(report.matches.length >= 1, `played a full series (${report.matches.length})`);
    await goto('finances'); await click('[data-fintab="history"]');
    if (MAX_STEPS_FOR(deviceName) >= 30) check(await page.evaluate(() => (G.financeLog || []).length >= 3), 'finance ledger has weekly entries');
    check(await page.evaluate(() => document.getElementById('top-budget').textContent !== '—'), 'top bar shows the budget');
    await shot('finances-history');
    await goto('league'); await shot('league-end');

    // ── Save / continue ───────────────────────────────────────────────────
    await page.reload({ waitUntil: 'load' });
    if (await visible('#btn-continue')) {
      await click('#btn-continue');
      check(await visible('#screen-game.active'), 'Continue Career restores the save');
    } else check(false, 'Continue Career button shown after reload');
  } catch (e) {
    report.failures.push('CRASH: ' + e.message.split('\n')[0]);
    await shot('crash').catch(() => {});
  }
  if (errors.length) report.failures.push(`${errors.length} JS error(s): ${[...new Set(errors)].slice(0, 5).join(' | ')}`);
  await browser.close();
  return report;
}

// Plays one human series (Bo1/Bo3/Bo5) through the draft → lineup → tactics → match screens.
// wait on a timer (not requestAnimationFrame) — the 3D view keeps software-WebGL frames slow
const shown = (page => sel => page.waitForFunction(s => { const e = document.querySelector(s); return e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; }, sel, { timeout: 30000, polling: 300 }));
async function playSeries(page, { watch, shot, check, report, visible, click, reachCheck }) {
  const out = { games: 0, watched: false };
  const shownP = shown(page); const _shown = shownP;
  for (let g = 0; g < 5; g++) {
    if (await visible('#between-games-panel')) await click('button[onclick="onNextGame()"]');
    if (!(await visible('#screen-match.active'))) break;

    // Draft: click the first champion card on our turns until the CPU/human draft finishes.
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      if (await visible('#role-assignment-phase') || await visible('#tactics-phase') || await visible('#draft-actions')) break;
      if (await visible('#draft-champ-picker')) {
        // choose like a player: bans → the first card; picks → a champion for a role we haven't filled yet
        const want = await page.evaluate(() => {
          const ds = _draftState; const mine = (ds.humanSide === 'blue' ? ds.bluePicks : ds.redPicks) || [];
          const cards = [...document.querySelectorAll('#draft-champ-picker .dcc-name')].map(e => e.textContent.trim());
          const isBan = /BAN/.test(document.querySelector('#draft-champ-picker .draft-picker-label')?.textContent || '');
          if (isBan) return cards[0];
          const roleOf = c => (CHAMPIONS[c]?.roles || []);
          const need = ['top', 'jungle', 'mid', 'adc', 'support'].filter(r => !mine.some(c => roleOf(c)[0] === r));
          return cards.find(c => need.includes(roleOf(c)[0])) || cards.find(c => roleOf(c).some(r => need.includes(r))) || cards[0];
        });
        const card = page.locator('#draft-champ-picker .draft-champ-card', { hasText: want }).first();
        if (await card.count()) await card.click({ timeout: 3000 }).catch(() => {});
      }
      await page.waitForTimeout(120);
    }
    if (!report._draftShot) { await shot('draft'); report._draftShot = true; }
    if (!report._draftReach) { await reachCheck('draft'); report._draftReach = true; }
    if (await visible('#role-assignment-phase')) {
      // assign each pick to a role slot by clicking card → slot (the Confirm button appears when all 5 are set)
      const plan = await page.evaluate(() => {
        const ds = _draftState; const picks = (ds.humanSide === 'blue' ? ds.bluePicks : ds.redPicks).slice();
        const roles = ['top', 'jungle', 'mid', 'adc', 'support']; const out = {}; const free = roles.slice();
        picks.slice().sort((a, b) => (CHAMPIONS[a]?.roles?.length || 9) - (CHAMPIONS[b]?.roles?.length || 9)).forEach(c => {
          const r = (CHAMPIONS[c]?.roles || []).find(x => free.includes(x)) || free[0];
          out[r] = c; free.splice(free.indexOf(r), 1);
        });
        return roles.map(r => [r, out[r]]);
      });
      for (const [role, champ] of plan) {
        await page.locator('#role-assignment-phase .ra-champ-card', { hasText: champ }).first().click({ timeout: 4000 });
        await page.locator(`#role-assignment-phase .ra-slot[onclick*="'${role}'"]`).first().click({ timeout: 4000 });
      }
      if (!report._lineupShot) { await shot('lineup'); report._lineupShot = true; }
      await click('#ra-actions .btn-primary');
    }
    if (await visible('#tactics-phase')) { await click('#tactics-phase .btn-primary'); }
    if (!check(await visible('#draft-actions'), 'draft completes and shows Watch/Skip')) break;

    if (watch && !out.watched) {
      await click('button[onclick="onStartMatch()"]');
      await _shown('#pbp-container');
      await click('#mv-btn-5x');
      await page.waitForTimeout(WATCH_MS);
      const s = await page.evaluate(() => {
        const m = window.__m3d; const c = document.querySelector('#mv-3d canvas.mv3d-canvas');
        return { champs: m ? Object.keys(m.champs).length : 0, minions: document.querySelectorAll('#mv-3d').length && window.__m3dMinions ? window.__m3dMinions() : -1,
                 canvas: !!c && c.width > 100 && c.height > 100, tick: (document.getElementById('match-game-timer') || {}).textContent };
      });
      check(s.canvas, '3D canvas is on screen');
      check(s.champs === 10, `3D view has 10 champions (${s.champs})`);
      check(s.minions > 0, `3D view shows sim minions (${s.minions})`);
      // the canvas really drew something: sample the screenshot for colour variety
      const box = await page.locator('#mv-3d').boundingBox();
      const png = await page.screenshot({ clip: box });
      check(colourVariety(png) > 40, '3D view renders a varied image (not blank)');
      await shot('match-3d');
      await click('#mv-btn-skip');
      await _shown('#pbp-results');
      out.watched = true;
    } else {
      await click('button[onclick="onSkipMatch()"]');
      await _shown('#pbp-results');
    }
    const txt = await page.locator('#pbp-results').innerText();
    check(/VICTORY/.test(txt), 'result screen shows the winner');
    if (g === 0 && out.games === 0 && !report._resShot) { await shot('result'); report._resShot = true; await reachCheck('match result'); }
    await click('#pbp-results button[onclick="returnFromMatch()"]');
    out.games++;
    await page.waitForTimeout(200);
    if (await visible('#screen-game.active')) break;
  }
  return out;
}

// crude PNG colour-variety probe: count distinct coarse colours in the raw (zlib) data's
// decoded pixels via a tiny decoder for 8-bit RGBA PNGs written by Chromium.
function colourVariety(png) {
  const zlib = require('zlib');
  let pos = 8, w = 0, h = 0; const idat = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos), type = png.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') { w = png.readUInt32BE(pos + 8); h = png.readUInt32BE(pos + 12); }
    if (type === 'IDAT') idat.push(png.slice(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = Math.round((raw.length / h - 1) / w);   // 3 (RGB) or 4 (RGBA)
  const stride = w * bpp + 1, cur = Buffer.alloc(w * bpp), prev = Buffer.alloc(w * bpp);
  const seen = new Set();
  for (let y = 0; y < h; y++) {
    const f = raw[y * stride];
    for (let i = 0; i < w * bpp; i++) {
      const x = raw[y * stride + 1 + i], a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = x;
      if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1);
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    if (y % 4 === 0) for (let x = 0; x < w; x += 4) { const i = x * bpp; seen.add(((cur[i] >> 4) << 8) | ((cur[i + 1] >> 4) << 4) | (cur[i + 2] >> 4)); }
    cur.copy(prev);
  }
  return seen.size;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { srv, url } = await startServer();
  const reports = [];
  for (const d of DEVICES) {
    const t0 = Date.now();
    console.log(`\n▶ Playtest on ${d} …`);
    const r = await run(d, url); r.seconds = Math.round((Date.now() - t0) / 1000);
    reports.push(r);
    for (const c of r.checks) console.log(`  ${c.ok ? '✅' : '❌'}  ${c.what}`);
    if (r.errors.length) console.log(`  ❌  JS errors:\n     ${[...new Set(r.errors)].slice(0, 8).join('\n     ')}`);
    console.log(`  ${r.failures.length ? '❌' : '✅'}  ${d}: ${r.checks.filter(c => c.ok).length}/${r.checks.length} checks, ${r.matches.length} series, ${r.weeks} weeks advanced, ${r.seconds}s`);
  }
  srv.close();
  fs.writeFileSync(path.join(OUT, 'playtest-report.json'), JSON.stringify(reports, null, 2));
  const failed = reports.some(r => r.failures.length);
  console.log(`\n${failed ? '❌ PLAYTEST FAILED' : '✅ PLAYTEST PASSED'} — screenshots in test-results/`);
  process.exit(failed ? 1 : 0);
})();
