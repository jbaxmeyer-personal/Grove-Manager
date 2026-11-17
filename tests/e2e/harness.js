// tests/e2e/harness.js — shared browser harness for the real-browser playtests.
//  • serves the repo over http (ES modules don't load from file://)
//  • routes the Three.js CDN to node_modules/three so tests are offline + pinned
//  • launches Chromium with software WebGL (SwiftShader) so the 3D view really renders in CI
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
                '.png': 'image/png', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.md': 'text/plain' };

function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

async function launch({ mobile = false } = {}) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctxOpts = mobile ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1366, height: 850 } };
  delete ctxOpts.defaultBrowserType;
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon|fonts\.g|GL Driver|GPU stall/i.test(t)) return;
    errors.push(t);
  });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.route('**/*', async route => {
    const u = route.request().url();
    const m = u.match(/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/(.*)$/);
    if (m) {
      const f = path.join(THREE_DIR, m[1]);
      if (fs.existsSync(f)) return route.fulfill({ path: f, contentType: 'application/javascript' });
    }
    if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u)) return route.continue();
    return route.abort();   // no other network in tests
  });
  return { browser, context, page, errors };
}

module.exports = { startServer, launch, ROOT };
