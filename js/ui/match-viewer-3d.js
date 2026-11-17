// js/ui/match-viewer-3d.js — 3D broadcast view of a simulated match (Three.js)
//
// View layer only. The simulation engine (js/game/simulation.js) is untouched in
// behaviour; this module reads the same per-tick events the 2D viewer consumes:
//   window.Match3D.mount(container, meta)   — called by initMatchViewer
//   window.Match3D.frame(lerpedPos, t, tick) — called every rAF by match-viewer.js
//   window.Match3D.event(ev)                — called for every applied event
//
// Map space: sim uses a 300×300 px square, blue base bottom-left, red top-right.
// World space: x = simX - 150, z = simY - 150, y = up. 1 sim px = 1 world unit.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support'];
const ROLE_LBL = { top: 'TOP', jungle: 'JGL', mid: 'MID', adc: 'ADC', support: 'SUP' };
const TEAM_COL = { blue: 0x2f86e8, red: 0xe0443a, neutral: 0xc89b3c };
const TEAM_CSS = { blue: '#4fc3f7', red: '#ff7b7b' };
const CLASS_ACC = { Tank: 0xb7c2cf, Fighter: 0xff8a2a, Assassin: 0xa25bff, Mage: 0x38e1ff, Marksman: 0xffd23a, Sentinel: 0x6dff8a };
const CLASS_SCALE = { Tank: 5.4, Fighter: 4.9, Assassin: 4.5, Mage: 4.5, Marksman: 4.5, Sentinel: 4.6 };
const CLASS_RANGE = { tank: 8, fighter: 10, assassin: 12, mage: 52, marksman: 58, sentinel: 46 };
const CLASS_ATK_INT = { Tank: 1.4, Fighter: 1.1, Assassin: 0.9, Mage: 1.7, Marksman: 1.0, Sentinel: 1.6 };
const TICK_S = 2;

const W = (x, y, out = new THREE.Vector3()) => out.set(x - 150, 0, y - 150);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

// Map data (fall back to copies if simulation.js globals aren't reachable)
const G_OBJ = (typeof OBJ_DEFS !== 'undefined') ? OBJ_DEFS : [];
const G_JG  = (typeof JUNGLE_DEF !== 'undefined') ? JUNGLE_DEF : [];
const G_SPAWN = (typeof SPAWN !== 'undefined') ? SPAWN : { blue: { x: 22, y: 278 }, red: { x: 278, y: 22 } };

const LANES = {
  top: [[35, 250], [35, 35], [250, 35]],
  mid: [[50, 250], [250, 50]],
  bot: [[50, 265], [265, 265], [265, 50]],
};
const RIVER = [[18, 18], [282, 282]];

function champClass(name) {
  const c = (typeof CHAMPIONS !== 'undefined' && CHAMPIONS[name]) ? CHAMPIONS[name].class : null;
  return c || 'Fighter';
}

// ─────────────────────────────────────────────────────────────────────────────
// Core state
// ─────────────────────────────────────────────────────────────────────────────
let renderer = null, scene, camera, sun;
let container = null, overlay = null, bannerEl = null, camBtns = {};
let gltf = null, gltfPromise = null;
let staticBuilt = false;
let champs = {};            // key side_role → Champ
let objViews = {};          // obj id → view
let fx = [], projectiles = [];
let meta = { champNames: { blue: {}, red: {} }, playerNames: { blue: {}, red: {} }, humanSide: 'blue', blueName: 'Blue', redName: 'Red' };
let latest = { blue: {}, red: {} };   // most recent full position records (state/target/champ)
let lerped = null;
let simTick = 0, simT = 0, gameTime = 0, lastGameTime = 0;
let objStates = {};
let rafId = null, clock = new THREE.Clock();
let camMode = 'auto', followKey = null, manualUntil = 0;
const camTarget = new THREE.Vector3(-60, 0, 60), camTargetGoal = new THREE.Vector3(-60, 0, 60);
let camDist = 120, camDistGoal = 120;
let focus = { key: null, until: 0 };
let eventFocus = null;
let ended = false;

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────
function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'mv3d-canvas';

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b130d);
  scene.fog = new THREE.Fog(0x0b130d, 260, 520);

  camera = new THREE.PerspectiveCamera(40, 1, 1, 1200);

  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x2b3a1c, 1.15));
  sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
  sun.position.set(-120, 220, 140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -190; sc.right = 190; sc.top = 190; sc.bottom = -190; sc.near = 20; sc.far = 600;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.4;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x7fb6ff, 0.5); rim.position.set(160, 80, -160); scene.add(rim);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function distToPath(px, py, path) { let m = 1e9; for (let i = 0; i < path.length - 1; i++) m = Math.min(m, distToSeg(px, py, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1])); return m; }

function buildStatic() {
  // ── terrain ──
  const S = 2048, k = S / 340, o = 20; // texture covers sim -20..320
  const tex = canvasTex(S, S, (x) => {
    const P = (v) => (v + o) * k;
    // grass base
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75);
    g.addColorStop(0, '#2f5a2a'); g.addColorStop(1, '#1f3d1f');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    // jungle mottling
    for (let i = 0; i < 2600; i++) {
      const cx = Math.random() * S, cy = Math.random() * S, r = rnd(6, 34);
      x.fillStyle = `rgba(${10 + Math.random() * 30},${40 + Math.random() * 50},${15 + Math.random() * 20},${rnd(0.08, 0.22)})`;
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    }
    // bases
    for (const [bx, by, col] of [[22, 278, '58,90,140'], [278, 22, '140,60,55']]) {
      const gr = x.createRadialGradient(P(bx), P(by), 0, P(bx), P(by), 70 * k);
      gr.addColorStop(0, `rgba(${col},.55)`); gr.addColorStop(0.65, 'rgba(120,115,100,.55)'); gr.addColorStop(1, 'rgba(120,115,100,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(P(bx), P(by), 70 * k, 0, 7); x.fill();
    }
    // lanes (dirt)
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const pass of [[30, 'rgba(70,52,30,.55)'], [22, '#7a5d3a'], [14, 'rgba(150,120,80,.35)']]) {
      x.strokeStyle = pass[1]; x.lineWidth = pass[0] * k;
      for (const L of Object.values(LANES)) { x.beginPath(); x.moveTo(P(L[0][0]), P(L[0][1])); for (const p of L.slice(1)) x.lineTo(P(p[0]), P(p[1])); x.stroke(); }
    }
    // dirt speckle on lanes
    for (let i = 0; i < 9000; i++) {
      const L = LANES[['top', 'mid', 'bot'][i % 3]]; const seg = (Math.random() * (L.length - 1)) | 0; const t = Math.random();
      const px = lerp(L[seg][0], L[seg + 1][0], t) + rnd(-10, 10), py = lerp(L[seg][1], L[seg + 1][1], t) + rnd(-10, 10);
      x.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},${40 + Math.random() * 30},.35)`; x.fillRect(P(px), P(py), 3, 3);
    }
    // river bed
    x.strokeStyle = '#1d3b45'; x.lineWidth = 34 * k; x.beginPath(); x.moveTo(P(RIVER[0][0]), P(RIVER[0][1])); x.lineTo(P(RIVER[1][0]), P(RIVER[1][1])); x.stroke();
    x.strokeStyle = '#25505e'; x.lineWidth = 24 * k; x.stroke();
    // objective pits
    for (const [px, py, c] of [[65, 65, '#5a4a2a'], [235, 235, '#3a2a4a']]) { x.fillStyle = c; x.beginPath(); x.arc(P(px), P(py), 20 * k, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 6; x.stroke(); }
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); ground.receiveShadow = true; scene.add(ground);

  // outer cliffs
  const cliffM = new THREE.MeshStandardMaterial({ color: 0x2a2f28, roughness: 1, flatShading: true });
  for (let i = 0; i < 56; i++) {
    const side = i % 4, t = (i >> 2) / 14 - 0.5;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(10, 18), 0), cliffM);
    const e = 172 + rnd(-4, 6);
    const p = side === 0 ? [t * 344, -e] : side === 1 ? [t * 344, e] : side === 2 ? [-e, t * 344] : [e, t * 344];
    r.position.set(p[0], rnd(2, 8), p[1]); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); r.scale.y = rnd(0.8, 1.6); r.castShadow = true; r.receiveShadow = true; scene.add(r);
  }

  // river water
  const len = Math.hypot(RIVER[1][0] - RIVER[0][0], RIVER[1][1] - RIVER[0][1]);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(len, 22), new THREE.MeshStandardMaterial({ color: 0x3f9fc8, transparent: true, opacity: 0.55, roughness: 0.12, metalness: 0.3 }));
  water.rotation.x = -Math.PI / 2; water.rotation.z = -Math.PI / 4; water.position.set(0, 0.25, 0); scene.add(water);
  water.userData.anim = (t) => { water.material.opacity = 0.5 + Math.sin(t * 1.3) * 0.05; };
  staticAnims.push(water.userData.anim);

  // trees
  const pts = [];
  const blockers = [];
  for (const o of G_OBJ) blockers.push([o.x, o.y, o.type === 'ancient' ? 42 : o.type === 'shrine' || o.type === 'warden' ? 28 : 14]);
  for (const j of G_JG) blockers.push([j.x, j.y, 17]);
  let tries = 0;
  while (pts.length < 950 && tries < 40000) {
    tries++;
    const px = rnd(-8, 308), py = rnd(-8, 308);
    let ok = true;
    for (const L of Object.values(LANES)) if (distToPath(px, py, L) < 19) { ok = false; break; }
    if (!ok) continue;
    if (distToPath(px, py, RIVER) < 19) continue;
    if (Math.hypot(px - 22, py - 278) < 62 || Math.hypot(px - 278, py - 22) < 62) continue;
    if (blockers.some(b => Math.hypot(px - b[0], py - b[1]) < b[2])) continue;
    if (pts.some(p => Math.hypot(px - p[0], py - p[1]) < 4.6)) continue;
    pts.push([px, py]);
  }
  const trunkG = new THREE.CylinderGeometry(0.7, 1.1, 6, 6); trunkG.translate(0, 3, 0);
  const leafG = new THREE.IcosahedronGeometry(4.2, 0); leafG.translate(0, 8.5, 0);
  const leaf2G = new THREE.IcosahedronGeometry(3.0, 0); leaf2G.translate(0.6, 11.6, -0.3);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1, flatShading: true }), pts.length);
  const leaves = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), pts.length);
  const leaves2 = new THREE.InstancedMesh(leaf2G, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const pal = [0x2e6b34, 0x3a7d3a, 0x2a5e45, 0x46803a, 0x1f5a4a, 0x3c6e2c, 0x5a7f2e];
  pts.forEach((pt, i) => {
    const sc = rnd(0.42, 0.7);
    W(pt[0], pt[1], p); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(0, 6.28)); s.set(sc, sc * rnd(0.9, 1.2), sc);
    m.compose(p, q, s); trunks.setMatrixAt(i, m); leaves.setMatrixAt(i, m); leaves2.setMatrixAt(i, m);
    leaves.setColorAt(i, c.setHex(pal[(Math.random() * pal.length) | 0]).offsetHSL(0, 0, rnd(-0.04, 0.04)));
    leaves2.setColorAt(i, c.offsetHSL(0.01, 0, 0.05));
  });
  for (const im of [trunks, leaves, leaves2]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }

  // glowing grove mushrooms (ambient flavour)
  const mushG = new THREE.SphereGeometry(0.9, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const mushM = new THREE.MeshStandardMaterial({ color: 0x7dfcff, emissive: 0x2fd0e0, emissiveIntensity: 1.2 });
  const mush = new THREE.InstancedMesh(mushG, mushM, 90); let mi = 0;
  for (const pt of pts) { if (mi >= 90) break; if (Math.random() < 0.25) { m.compose(W(pt[0] + rnd(-3, 3), pt[1] + rnd(-3, 3), p), q.identity(), s.setScalar(rnd(0.6, 1.3))); mush.setMatrixAt(mi++, m); } }
  mush.count = mi; scene.add(mush);

  // base platforms
  for (const side of ['blue', 'red']) {
    const sp = G_SPAWN[side];
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(26, 28, 1.2, 40), new THREE.MeshStandardMaterial({ color: 0x8a8577, roughness: 0.8 }));
    plat.position.copy(W(sp.x, sp.y)); plat.position.y = 0.4; plat.receiveShadow = true; scene.add(plat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(26, 0.6, 6, 60), new THREE.MeshStandardMaterial({ color: TEAM_COL[side], emissive: TEAM_COL[side], emissiveIntensity: 0.8 }));
    ring.rotation.x = Math.PI / 2; ring.position.copy(plat.position); ring.position.y = 1.05; scene.add(ring);
  }

  // jungle camps (decorative creatures)
  buildObjectives();
  staticBuilt = true;
}
const staticAnims = [];

// HP bar sprite
function makeBar(w = 10, h = 1.1) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(w, h, 1); sp.renderOrder = 10;
  sp.userData = { c, t, last: -1 };
  return sp;
}
function drawBar(sp, pct, color) {
  const u = sp.userData; const key = Math.round(pct * 100) + color; if (u.last === key) return; u.last = key;
  const x = u.c.getContext('2d'); x.clearRect(0, 0, 128, 16);
  x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(0, 0, 128, 16);
  x.fillStyle = color; x.fillRect(2, 2, 124 * clamp(pct, 0, 1), 12);
  x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < 10; i++) x.fillRect(2 + i * 12.4, 2, 1, 12);
  u.t.needsUpdate = true;
}

function buildObjectives() {
  for (const o of G_OBJ) {
    const g = new THREE.Group(); g.position.copy(W(o.x, o.y));
    const view = { def: o, g, parts: {}, destroyed: false, down: false };
    const teamC = TEAM_COL[o.side] || 0xc89b3c;
    if (o.type === 'root') {
      const big = /heart/.test(o.id);
      const stone = new THREE.MeshStandardMaterial({ color: 0x6f6a5e, roughness: 0.9, flatShading: true });
      const wood = new THREE.MeshStandardMaterial({ color: 0x4d3a28, roughness: 0.95, flatShading: true });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(big ? 6 : 4.6, big ? 7 : 5.4, 2, 8), stone); base.position.y = 1; g.add(base);
      const trunk = new THREE.Group(); g.add(trunk);
      for (let i = 0; i < 4; i++) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.5, big ? 15 : 12, 5), wood);
        const a = i / 4 * Math.PI * 2; r.position.set(Math.cos(a) * 1.4, (big ? 15 : 12) / 2 + 1.5, Math.sin(a) * 1.4); r.rotation.set(Math.sin(a) * 0.18, a, Math.cos(a) * 0.18); trunk.add(r);
      }
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(big ? 4 : 2.8, 0), new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 1.6, roughness: 0.2 }));
      crystal.position.y = big ? 20 : 16; g.add(crystal);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(big ? 5 : 3.6, 0.25, 6, 30), new THREE.MeshBasicMaterial({ color: teamC }));
      halo.position.y = crystal.position.y; halo.rotation.x = Math.PI / 2; g.add(halo);
      g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      view.parts = { crystal, halo, trunk, base };
      const bar = makeBar(big ? 14 : 11, 1.2); bar.position.y = crystal.position.y + 6; g.add(bar); view.bar = bar;
    } else if (o.type === 'ancient') {
      const wood = new THREE.MeshStandardMaterial({ color: 0x5a412b, roughness: 0.95, flatShading: true });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 7, 20, 7), wood); trunk.position.y = 10; g.add(trunk);
      const canopy = new THREE.Group(); g.add(canopy);
      const leafM = new THREE.MeshStandardMaterial({ color: o.side === 'blue' ? 0x2f7f8a : 0x8a4a3a, roughness: 0.85, flatShading: true, emissive: teamC, emissiveIntensity: 0.12 });
      for (const [x, y, z, r] of [[0, 24, 0, 11], [-7, 21, 3, 7], [7, 22, -2, 8], [2, 29, 4, 7], [-3, 27, -6, 7]]) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafM); l.position.set(x, y, z); canopy.add(l); }
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 1), new THREE.MeshStandardMaterial({ color: teamC, emissive: teamC, emissiveIntensity: 2.2 }));
      core.position.y = 12; core.position.z = 3.2; g.add(core);
      g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      view.parts = { core, canopy, trunk };
      const bar = makeBar(18, 1.5); bar.position.y = 38; g.add(bar); view.bar = bar;
    } else if (o.type === 'shrine') {
      const stone = new THREE.MeshStandardMaterial({ color: 0x8c8370, roughness: 0.9, flatShading: true });
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, rnd(5, 8), 2.2), stone); s.position.set(Math.cos(a) * 15, 3, Math.sin(a) * 15); s.rotation.y = -a; s.castShadow = true; g.add(s); }
      const spirit = new THREE.Group(); g.add(spirit);
      const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0xffa000, emissiveIntensity: 1.3, roughness: 0.3 });
      for (let i = 0; i < 9; i++) { const seg = new THREE.Mesh(new THREE.SphereGeometry(2.2 - i * 0.17, 10, 8), gold); seg.userData.i = i; spirit.add(seg); }
      const head = spirit.children[0]; head.scale.set(1.3, 1, 1.6);
      spirit.position.y = 7; view.parts = { spirit };
      spirit.userData.anim = (t) => { spirit.children.forEach(s => { const i = s.userData.i; const a = t * 1.2 - i * 0.45; s.position.set(Math.cos(a) * 6, Math.sin(t * 2 - i * 0.6) * 1.4, Math.sin(a) * 6); }); };
      const bar = makeBar(12, 1.2); bar.position.y = 16; g.add(bar); view.bar = bar;
    } else if (o.type === 'warden') {
      const stone = new THREE.MeshStandardMaterial({ color: 0x5c5470, roughness: 0.9, flatShading: true });
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; const s = new THREE.Mesh(new THREE.ConeGeometry(2.4, rnd(7, 11), 5), stone); s.position.set(Math.cos(a) * 17, 4, Math.sin(a) * 17); s.castShadow = true; g.add(s); }
      view.parts = {};
      const bar = makeBar(16, 1.4); bar.position.y = 24; g.add(bar); view.bar = bar;
    }
    scene.add(g); objViews[o.id] = view;
  }
}

function attachCreatures() {
  // warden: giant purple golem; jungle camps: small creatures
  const w = objViews.warden;
  if (w && !w.parts.body) {
    const body = makeRig({ body: 0x3b2e5a, joint: 0xb06bff, emissive: 0x6a2fb0 });
    body.g.scale.setScalar(5.6); w.g.add(body.g); body.g.rotation.y = Math.PI * 0.75;
    body.play('idle'); w.parts.body = body;
  }
  for (const j of G_JG) {
    const r = makeRig({ body: j.large ? 0x5d4a2c : 0x4f5d2c, joint: 0x2a2a1a });
    r.g.scale.setScalar(j.large ? 3.6 : 2.8); r.g.position.copy(W(j.x, j.y)); r.g.rotation.y = rnd(0, 6.28);
    scene.add(r.g); r.play(Math.random() < 0.5 ? 'idle' : 'sneak_pose'); r.mixer.update(rnd(0, 3)); jungleRigs.push(r);
  }
}
const jungleRigs = [];

// ─────────────────────────────────────────────────────────────────────────────
// Character rig (Xbot clone)
// ─────────────────────────────────────────────────────────────────────────────
function boneMap(root) { const m = {}; root.traverse(o => { if (o.isBone) m[o.name.replace(/^mixamorig[:_]?/, '')] = o; }); return m; }
function makeRig(colors) {
  const root = SkeletonUtils.clone(gltf.scene);
  const g = new THREE.Group(); g.add(root);
  const mats = [];
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.frustumCulled = false;
      const isJ = /Joints/.test(o.name);
      o.material = new THREE.MeshStandardMaterial({ color: isJ ? colors.joint : colors.body, roughness: isJ ? 0.45 : 0.6, metalness: isJ ? 0.3 : 0.05, emissive: colors.emissive || 0x000000, emissiveIntensity: colors.emissive ? 0.25 : 0, transparent: true });
      mats.push(o.material);
    }
  });
  const mixer = new THREE.AnimationMixer(root);
  const actions = {}; for (const c of gltf.animations) actions[c.name] = mixer.clipAction(c);
  const rig = {
    g, root, mats, mixer, actions, b: boneMap(root), cur: null, curName: null,
    play(name, fade = 0.2, ts = 1) {
      const a = actions[name]; if (!a) return;
      a.timeScale = ts;
      if (rig.cur === a) return;
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play();
      if (rig.cur && fade > 0) rig.cur.crossFadeTo(a, fade, false); else if (rig.cur) rig.cur.stop();
      rig.cur = a; rig.curName = name;
    },
    setOpacity(v) { for (const m of mats) { m.opacity = v; m.depthWrite = v > 0.95; } },
  };
  return rig;
}

function makeWeapon(cls, teamC) {
  const acc = CLASS_ACC[cls] || 0xffffff;
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 0.8, roughness: 0.3 });
  const glow = new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: 1.6 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 0.8 });
  const r = new THREE.Group(), l = new THREE.Group();
  // weapons are built in "hand space": +y along the forearm direction is unknown, so we
  // orient them each frame from character facing instead (see updateWeapons)
  if (cls === 'Fighter') { const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.05), metal); blade.position.y = 0.75; r.add(blade); const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.08), glow); hilt.position.y = 0.1; r.add(hilt); }
  if (cls === 'Tank') { const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 6), new THREE.MeshStandardMaterial({ color: teamC, metalness: 0.5, roughness: 0.4 })); shield.rotation.x = Math.PI / 2; l.add(shield); const boss = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glow); boss.position.z = 0.08; l.add(boss); const mace = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), wood); mace.position.y = 0.45; r.add(mace); const hd = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), metal); hd.position.y = 0.95; r.add(hd); }
  if (cls === 'Assassin') { for (const h of [r, l]) { const d = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.75, 4), glow); d.position.y = 0.45; h.add(d); } }
  if (cls === 'Mage') { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.9, 6), wood); st.position.y = 0.55; r.add(st); const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), glow); orb.position.y = 1.55; r.add(orb); }
  if (cls === 'Marksman') { const bow = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 5, 18, Math.PI * 0.9), new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: 0.6 })); bow.rotation.z = Math.PI / 2 + Math.PI * 0.05; l.add(bow); }
  if (cls === 'Sentinel') { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), wood); st.position.y = 0.4; r.add(st); const lan = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glow); lan.position.y = 1.3; r.add(lan); }
  r.traverse(m => { if (m.isMesh) m.castShadow = true; }); l.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { r, l };
}

function makePlate(side) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(18, 5.1, 1); sp.renderOrder = 11;
  sp.userData = { c, t, key: '' };
  return sp;
}
function drawPlate(ch) {
  const sp = ch.plate, u = sp.userData;
  const pct = ch.maxHp ? clamp(ch.hp / ch.maxHp, 0, 1) : 1;
  const tpct = ch.maxHp ? clamp((ch.hpTrail ?? ch.hp) / ch.maxHp, 0, 1) : pct;
  const key = `${Math.round(pct * 100)}|${Math.round(tpct * 50)}|${ch.level}|${ch.alive}|${ch.state}`;
  if (u.key === key) return; u.key = key;
  const x = u.c.getContext('2d'); x.clearRect(0, 0, 256, 72);
  const human = ch.side === meta.humanSide;
  x.font = '700 22px "Segoe UI",Arial,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(0,0,0,.6)'; x.fillText(ch.name, 129, 17); x.fillStyle = human ? '#fff' : '#ffe3e0'; x.fillText(ch.name, 128, 16);
  // bar
  x.fillStyle = 'rgba(8,10,14,.85)'; x.fillRect(30, 34, 210, 22);
  if (tpct > pct) { x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(33, 37, 204 * tpct, 16); }
  x.fillStyle = ch.side === 'blue' ? '#3fa2ff' : '#ff4f43'; if (!ch.alive) x.fillStyle = '#555';
  x.fillRect(33, 37, 204 * pct, 16);
  x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < 8; i++) x.fillRect(33 + i * 25.5, 37, 2, 16);
  // level box
  x.fillStyle = '#10141a'; x.fillRect(4, 31, 28, 28); x.strokeStyle = ch.side === 'blue' ? '#4fc3f7' : '#ff7b7b'; x.lineWidth = 2; x.strokeRect(5, 32, 26, 26);
  x.fillStyle = '#fff'; x.font = '800 17px Arial'; x.fillText(String(ch.level || 1), 18, 46);
  u.t.needsUpdate = true;
}

class Champ {
  constructor(side, role, name) {
    this.side = side; this.role = role; this.name = name; this.cls = champClass(name);
    const teamC = TEAM_COL[side];
    this.rig = makeRig({ body: teamC, joint: CLASS_ACC[this.cls] });
    this.scale = CLASS_SCALE[this.cls] || 3.2;
    this.rig.g.scale.setScalar(this.scale);
    this.g = new THREE.Group(); this.g.add(this.rig.g); scene.add(this.g);
    // team ring
    const human = side === meta.humanSide;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.0, 32), new THREE.MeshBasicMaterial({ color: human ? 0x7dff7d : teamC, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.3; this.g.add(this.ring);
    this.plate = makePlate(side); this.plate.position.y = this.scale * 1.8 + 3.5; this.g.add(this.plate);
    const wp = makeWeapon(this.cls, teamC); this.wR = wp.r; this.wL = wp.l; scene.add(this.wR, this.wL);
    this.wR.scale.setScalar(this.scale * 0.95); this.wL.scale.setScalar(this.scale * 0.95);
    this.pos = new THREE.Vector3(); this.prev = new THREE.Vector3(); this.vel = 0; this.heading = 0; this.headingGoal = 0;
    this.hp = 1; this.maxHp = 1; this.level = 1; this.alive = true; this.state = 'laning';
    this.deadT = 0; this.atkT = rnd(0, 1); this.lunge = 0; this.respawnFlash = 0;
    this.rig.play('idle', 0); this.rig.mixer.update(rnd(0, 2));
    this.recallFx = null; this.first = true; this.seed = Math.random() * 10;
  }
  dispose() { scene.remove(this.g, this.wR, this.wL); if (this.recallFx) scene.remove(this.recallFx); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Effects
// ─────────────────────────────────────────────────────────────────────────────
const fxGeo = { box: new THREE.BoxGeometry(0.7, 0.7, 0.7), sph: new THREE.SphereGeometry(0.75, 10, 8), slash: new THREE.RingGeometry(2.2, 3.4, 20, 1, -0.9, 1.8) };
function burst(pos, color, n = 22, speed = 22, life = 0.9, size = 1) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(fxGeo.box, mat); m.position.copy(pos); m.position.y += 3;
    const v = new THREE.Vector3(rnd(-1, 1), rnd(0.3, 1.4), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.4, 1) * speed);
    m.scale.setScalar(size * rnd(0.6, 1.4)); scene.add(m);
    fx.push({ m, v, life, t: 0, kind: 'p' });
  }
}
function pillar(pos, color, life = 1.6, r = 4) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.2, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(pos); m.position.y = 30; scene.add(m); fx.push({ m, life, t: 0, kind: 'pillar' });
}
function slash(ch, color) {
  const m = new THREE.Mesh(fxGeo.slash, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(ch.g.position); m.position.y = ch.scale * 0.9;
  m.rotation.set(-Math.PI / 2 + 0.3, 0, -ch.heading + Math.PI / 2);
  m.scale.setScalar(ch.scale / 3.0); scene.add(m); fx.push({ m, life: 0.28, t: 0, kind: 'slash' });
}
function shoot(from, to, color, big = false) {
  const m = new THREE.Mesh(fxGeo.sph, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.scale.setScalar(big ? 1.4 : 0.9); m.position.copy(from); scene.add(m);
  const trailM = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.6, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(trailM);
  projectiles.push({ m, trail: trailM, a: from.clone(), b: to.clone(), t: 0, dur: clamp(from.distanceTo(to) / 90, 0.12, 0.6), color });
}
function floatText(pos, text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = '900 40px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.8)'; x.strokeText(text, 128, 32); x.fillStyle = color; x.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(20, 5, 1); sp.renderOrder = 12;
  sp.position.copy(pos); sp.position.y += 14; scene.add(sp); fx.push({ m: sp, life: 1.6, t: 0, kind: 'text' });
}
function dmgNumber(pos, n) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48; const x = c.getContext('2d');
  x.font = '800 30px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 5; x.strokeStyle = 'rgba(0,0,0,.8)';
  x.strokeText('-' + n, 64, 24); x.fillStyle = '#ffd0c8'; x.fillText('-' + n, 64, 24);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(8, 3, 1); sp.renderOrder = 12;
  sp.position.copy(pos); sp.position.x += rnd(-2, 2); sp.position.y += 9; scene.add(sp); fx.push({ m: sp, life: 0.9, t: 0, kind: 'text' });
}

function banner(html, side) {
  if (!bannerEl) return;
  bannerEl.innerHTML = html; bannerEl.className = 'mv3d-banner show ' + (side || '');
  clearTimeout(banner._t); banner._t = setTimeout(() => { bannerEl.className = 'mv3d-banner'; }, 2600);
}

function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt; const k = f.t / f.life;
    if (f.kind === 'p') { f.v.y -= 30 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += dt * 6; f.m.material.opacity = 1 - k; if (f.m.position.y < 0.3) { f.m.position.y = 0.3; f.v.multiplyScalar(0.5); } }
    else if (f.kind === 'pillar') { f.m.material.opacity = 0.6 * (1 - k); f.m.scale.x = f.m.scale.z = 1 + k * 0.6; }
    else if (f.kind === 'slash') { f.m.material.opacity = 0.9 * (1 - k); f.m.scale.multiplyScalar(1 + dt * 2); }
    else if (f.kind === 'text') { f.m.position.y += dt * 6; f.m.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; }
    if (k >= 1) { scene.remove(f.m); if (f.kind !== 'p') { f.m.material.dispose(); if (f.m.material.map) f.m.material.map.dispose(); } fx.splice(i, 1); }
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.t += dt; const k = clamp(p.t / p.dur, 0, 1);
    p.m.position.lerpVectors(p.a, p.b, k); p.m.position.y += Math.sin(k * Math.PI) * 2;
    const back = p.a.clone().lerp(p.b, Math.max(0, k - 0.25)); back.y = p.m.position.y;
    const mid = back.clone().add(p.m.position).multiplyScalar(0.5); const len = back.distanceTo(p.m.position);
    p.trail.position.copy(mid); p.trail.scale.set(1, Math.max(0.01, len), 1);
    p.trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.m.position.clone().sub(back).normalize());
    if (k >= 1) { scene.remove(p.m, p.trail); p.m.material.dispose(); p.trail.material.dispose(); projectiles.splice(i, 1); burst(p.b, p.color, 5, 8, 0.35, 0.6); }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Minions — rendered from the simulation (move events carry [id, side, x, y, hp%, type])
// ─────────────────────────────────────────────────────────────────────────────
const minionGeo = (() => { const g = new THREE.CapsuleGeometry(1.0, 1.5, 3, 8); g.translate(0, 1.75, 0); return g; })();
const siegeGeo  = (() => { const g = new THREE.BoxGeometry(3.2, 2.6, 3.8); g.translate(0, 1.6, 0); return g; })();
const minionMats = { blue: null, red: null };
let minionPrev = new Map(), minionCur = new Map();   // id → [side, x, y, hp, type]
const minionMeshes = new Map();                     // id → mesh

function setMinions(list) {
  minionPrev = minionCur; minionCur = new Map();
  for (const m of list) minionCur.set(m[0], m);
  // deaths: present before, gone now
  for (const [id, m] of minionPrev) if (!minionCur.has(id)) {
    const mesh = minionMeshes.get(id);
    if (mesh) { burst(mesh.position, m[1] ? 0xff8f7f : 0x7fc8ff, 6, 9, 0.5, 0.55); scene.remove(mesh); minionMeshes.delete(id); }
  }
}
function updateMinions() {
  const t = clamp(simT, 0, 1);
  for (const [id, m] of minionCur) {
    let mesh = minionMeshes.get(id);
    const side = m[1] ? 'red' : 'blue';
    if (!mesh) {
      mesh = new THREE.Mesh(m[5] === 's' ? siegeGeo : minionGeo, minionMats[side]);
      mesh.castShadow = true; mesh.scale.setScalar(m[5] === 'c' ? 0.85 : 1.05);
      scene.add(mesh); minionMeshes.set(id, mesh);
    }
    const p = minionPrev.get(id) || m;
    const x = lerp(p[2], m[2], t), y = lerp(p[3], m[3], t);
    const dx = m[2] - p[2], dy = m[3] - p[3];
    mesh.position.set(x - 150, Math.abs(Math.sin(gameTime * 7 + id)) * (Math.hypot(dx, dy) > 0.5 ? 0.45 : 0.15), y - 150);
    if (Math.hypot(dx, dy) > 0.3) mesh.rotation.y = Math.atan2(dx, dy);
  }
}
// cosmetic shots: casters fire at nearby enemy minions, towers fire at minions in range
function minionShots(gdt) {
  if (gdt <= 0) return;
  const list = [...minionMeshes.entries()].map(([id, mesh]) => ({ id, mesh, m: minionCur.get(id) })).filter(o => o.m);
  for (const o of list) {
    if (o.m[5] === 'm' || Math.random() > gdt * 0.7) continue;
    let best = null, bd = 30;
    for (const e of list) if (e.m[1] !== o.m[1]) { const d = Math.hypot(e.m[2] - o.m[2], e.m[3] - o.m[3]); if (d < bd) { bd = d; best = e; } }
    if (best) shoot(o.mesh.position.clone().setY(2.6), best.mesh.position.clone().setY(1.8), o.m[1] ? 0xff8f7f : 0x7fc8ff);
  }
  for (const id in objViews) {
    const v = objViews[id], d = v.def; if (v.destroyed || d.side === 'neutral' || !d.atkDmg) continue;
    if (Math.random() > gdt * 0.55) continue;
    const tgt = list.find(e => (e.m[1] ? 'red' : 'blue') !== d.side && Math.hypot(e.m[2] - d.x, e.m[3] - d.y) <= d.atkRange);
    if (tgt) shoot(v.g.position.clone().setY(d.type === 'ancient' ? 14 : 16), tgt.mesh.position.clone().setY(1.8), TEAM_COL[d.side], true);
  }
}
function clearMinions() { for (const mesh of minionMeshes.values()) scene.remove(mesh); minionMeshes.clear(); minionPrev = new Map(); minionCur = new Map(); }

// ─────────────────────────────────────────────────────────────────────────────
// Per-frame champion update
// ─────────────────────────────────────────────────────────────────────────────
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion();
function targetWorld(rec) {
  if (!rec || !rec.tid) return null;
  const m = /^([br])(\d)$/.exec(rec.tid);
  if (m) { const side = m[1] === 'b' ? 'blue' : 'red'; const role = ROLES[+m[2]]; const c = champs[side + '_' + role]; return c && c.alive ? c.g.position : null; }
  if (objViews[rec.tid]) return objViews[rec.tid].g.position;
  if (rec.tx !== undefined) return W(rec.tx, rec.ty, new THREE.Vector3());
  return null;
}

function updateChamps(dt, gdt) {
  if (!lerped) return;
  for (const key in champs) {
    const ch = champs[key];
    const L = lerped[ch.side]?.[ch.role]; const rec = latest[ch.side]?.[ch.role];
    if (!L) { ch.g.visible = false; ch.wR.visible = ch.wL.visible = false; continue; }
    ch.g.visible = true;
    W(L.x, L.y, _v1);
    if (ch.first) { ch.g.position.copy(_v1); ch.first = false; }
    const prev = _v2.copy(ch.g.position);
    if (L.blink && L.alive !== false && prev.distanceTo(_v1) > 25) {
      // recall / teleport: blink out here, blink in there — never glide across the map
      pillar(prev, TEAM_COL[ch.side], 0.6, 2.5); ch.g.position.copy(_v1); pillar(_v1, TEAM_COL[ch.side], 0.8, 3);
      prev.copy(_v1);
    }
    // smooth toward lerped position (the 2D viewer already interpolates per tick)
    ch.g.position.lerp(_v1, 1 - Math.pow(0.0005, dt));
    const moved = prev.distanceTo(ch.g.position);
    const spd = dt > 0 ? moved / dt : 0;
    ch.vel = lerp(ch.vel, spd, 0.2);
    if (ch.alive && L.hp < ch.hp - 0.5) {
      ch.lastDropT = gameTime; ch.dmgAcc = (ch.dmgAcc || 0) + (ch.hp - L.hp);
      if (ch.dmgAcc > (L.maxHp || 600) * 0.06) { dmgNumber(ch.g.position, Math.round(ch.dmgAcc)); ch.dmgAcc = 0; }
    }
    ch.hp = L.hp; ch.maxHp = L.maxHp || 1;
    ch.hpTrail = Math.max(ch.hp, (ch.hpTrail ?? ch.hp) - ch.maxHp * 0.35 * dt);   // white "recent damage" chip
    if (rec) { ch.level = rec.level || ch.level; ch.state = rec.state || ch.state; }
    const wasAlive = ch.alive; ch.alive = L.alive !== false;

    // death / respawn
    if (wasAlive && !ch.alive) { ch.deadT = 0; ch.rig.play('idle', 0.1); burst(ch.g.position, ch.side === 'blue' ? 0x4fc3f7 : 0xff6b5b, 26, 26, 1.0, 1.1); }
    if (!wasAlive && ch.alive) { ch.respawnFlash = 1; ch.g.position.copy(_v1); pillar(ch.g.position, TEAM_COL[ch.side], 1.2, 3); }
    if (!ch.alive) {
      ch.deadT += dt;
      const k = clamp(ch.deadT / 0.45, 0, 1);
      ch.rig.g.rotation.x = -k * Math.PI / 2; ch.rig.g.position.y = k * 0.6;
      ch.rig.setOpacity(1 - clamp((ch.deadT - 1.2) / 0.8, 0, 1));
      ch.ring.visible = false; ch.plate.visible = false; ch.wR.visible = ch.wL.visible = ch.deadT < 1.6;
    } else {
      ch.rig.g.rotation.x = 0; ch.rig.g.position.y = 0;
      ch.respawnFlash = Math.max(0, ch.respawnFlash - dt);
      ch.rig.setOpacity(1); ch.ring.visible = true; ch.plate.visible = true; ch.wR.visible = ch.wL.visible = true;
    }

    // heading: movement, or toward target when attacking
    const tw = rec ? targetWorld(rec) : null;
    const range = (CLASS_RANGE[ch.cls.toLowerCase()] || 12) + 4;
    const engaging = ch.alive && tw && (ch.state === 'fighting' || ch.state === 'contesting' || ch.state === 'jungling') && Math.hypot(tw.x - ch.g.position.x, tw.z - ch.g.position.z) <= range * 1.25 + 3;
    if (engaging) ch.headingGoal = Math.atan2(tw.x - ch.g.position.x, tw.z - ch.g.position.z);
    else if (moved > 0.02) ch.headingGoal = Math.atan2(ch.g.position.x - prev.x, ch.g.position.z - prev.z);
    let dh = ch.headingGoal - ch.heading; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    ch.heading += dh * (1 - Math.pow(0.0001, dt));
    ch.rig.g.rotation.y = ch.heading;

    // animation
    if (ch.alive) {
      if (ch.state === 'recalling') ch.rig.play('idle', 0.25);
      else if (ch.vel > 9) ch.rig.play('run', 0.2, clamp(ch.vel / 22, 0.6, 1.6));
      else if (ch.vel > 1.5) ch.rig.play('walk', 0.2, clamp(ch.vel / 6, 0.6, 1.6));
      else ch.rig.play('idle', 0.25);
    }
    ch.rig.mixer.update(dt);

    // attacks (game-time based so they scale with match speed)
    const tgtChamp = rec && /^[br]\d$/.test(rec.tid || '') ? champs[(rec.tid[0] === 'b' ? 'blue' : 'red') + '_' + ROLES[+rec.tid[1]]] : null;
    const landing = !tgtChamp || (tgtChamp.lastDropT ?? -9) > gameTime - 2.5;
    if (engaging && gdt > 0 && landing) {
      ch.atkT -= gdt;
      if (ch.atkT <= 0) {
        ch.atkT = (CLASS_ATK_INT[ch.cls] || 1.3) * rnd(0.85, 1.15);
        const acc = CLASS_ACC[ch.cls];
        if (['Mage', 'Marksman', 'Sentinel'].includes(ch.cls)) {
          const from = ch.g.position.clone(); from.y = ch.scale * 1.15;
          from.x += Math.sin(ch.heading) * 2; from.z += Math.cos(ch.heading) * 2;
          const to = tw.clone(); to.y = 3; shoot(from, to, acc, ch.cls === 'Mage');
        } else { slash(ch, acc); ch.lunge = 1; }
      }
    }
    ch.lunge = Math.max(0, ch.lunge - dt * 5);
    // fights: ranged champions kite side to side, melee shuffle — no more statues trading hits
    const ranged = ['Mage', 'Marksman', 'Sentinel'].includes(ch.cls);
    const strafeGoal = engaging ? Math.sin(gameTime * (ranged ? 1.7 : 2.6) + ch.seed) * (ranged ? 5 : 2.2) : 0;
    ch.strafe = lerp(ch.strafe || 0, strafeGoal, 1 - Math.pow(0.02, dt));
    const sx = Math.cos(ch.heading) * ch.strafe, sz = -Math.sin(ch.heading) * ch.strafe;
    ch.rig.g.position.x = Math.sin(ch.heading) * ch.lunge * 2 + sx + (ch.sepX || 0);
    ch.rig.g.position.z = Math.cos(ch.heading) * ch.lunge * 2 + sz + (ch.sepZ || 0);
    if (engaging && Math.abs(strafeGoal - (ch._lastStrafe || 0)) > 0.02 && ch.vel < 1.5) ch.rig.play('walk', 0.2, 0.8);
    ch._lastStrafe = strafeGoal;

    // recall swirl
    if (ch.alive && ch.state === 'recalling') {
      if (!ch.recallFx) { ch.recallFx = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.25, 6, 30), new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })); ch.recallFx.rotation.x = Math.PI / 2; scene.add(ch.recallFx); }
      ch.recallFx.visible = true; ch.recallFx.position.copy(ch.g.position); ch.recallFx.position.y = 1 + (gameTime * 4 % 8); ch.recallFx.material.opacity = 0.8 - (gameTime * 4 % 8) / 10;
    } else if (ch.recallFx) ch.recallFx.visible = false;

    // ring pulse while fighting
    ch.ring.material.opacity = engaging ? 0.6 + Math.sin(gameTime * 10) * 0.3 : 0.75;
    drawPlate(ch);
  }
  // keep champions from standing inside each other
  const list = Object.values(champs).filter(c => c.alive && c.g.visible);
  for (const a of list) { a._sx = 0; a._sz = 0; }
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; const dx = b.g.position.x - a.g.position.x, dz = b.g.position.z - a.g.position.z; const d = Math.hypot(dx, dz);
    if (d < 5 && d > 0.001) { const push = (5 - d) / 2; a._sx -= dx / d * push; a._sz -= dz / d * push; b._sx += dx / d * push; b._sz += dz / d * push; }
  }
  for (const a of list) { a.sepX = lerp(a.sepX || 0, a._sx, 1 - Math.pow(0.05, dt)); a.sepZ = lerp(a.sepZ || 0, a._sz, 1 - Math.pow(0.05, dt)); }

  // weapons follow hands (after all mixers updated)
  for (const key in champs) {
    const ch = champs[key]; if (!ch.g.visible) continue;
    ch.g.updateMatrixWorld(true);
    const fwd = _v1.set(Math.sin(ch.heading), 0, Math.cos(ch.heading));
    for (const [w, bone, tilt] of [[ch.wR, ch.rig.b.RightHand, 0.5], [ch.wL, ch.rig.b.LeftHand, 0.3]]) {
      if (!bone) continue; bone.getWorldPosition(w.position);
      // point weapon up-forward from the hand
      _q1.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v2.set(fwd.x * tilt, 1, fwd.z * tilt).normalize());
      w.quaternion.copy(_q1); w.rotateY(ch.heading);
      if (ch.lunge > 0 && w === ch.wR) w.rotateX(ch.lunge * 1.6);
    }
  }
}

function updateObjectives(dt) {
  for (const id in objViews) {
    const v = objViews[id]; const st = objStates[id]; const o = v.def;
    const pct = st ? clamp(st.hp / (st.maxHp || 1), 0, 1) : 1;
    const destroyed = !!(st && st.destroyed), down = !!(st && st.tempDown);
    if (destroyed && !v.destroyed) {
      v.destroyed = true;
      burst(v.g.position, TEAM_COL[o.side] || 0xffffff, 40, 34, 1.3, 1.6); burst(v.g.position, 0x8a7a66, 30, 24, 1.4, 1.4);
      if (o.type !== 'ancient') floatText(v.g.position, 'DESTROYED', '#ffd54a');
    }
    if (!destroyed && v.destroyed) v.destroyed = false;
    v.down = down;
    if (o.type === 'root') {
      v.parts.crystal.visible = !v.destroyed; v.parts.halo.visible = !v.destroyed;
      v.parts.trunk.scale.y = v.destroyed ? 0.35 : 1;
      v.parts.crystal.rotation.y += dt * 1.2; v.parts.crystal.position.y = (/heart/.test(id) ? 20 : 16) + Math.sin(gameTime * 2 + o.x) * 0.5;
      v.parts.halo.scale.setScalar(1 + Math.sin(gameTime * 3) * 0.05);
    } else if (o.type === 'ancient') {
      v.parts.core.material.emissiveIntensity = 1.6 + Math.sin(gameTime * 3) * 0.6;
      if (v.destroyed) { v.parts.canopy.visible = false; v.parts.trunk.scale.y = 0.4; v.parts.core.visible = false; }
      else { v.parts.canopy.visible = true; v.parts.trunk.scale.y = 1; v.parts.core.visible = true; }
    } else if (o.type === 'shrine') {
      v.parts.spirit.visible = !down; if (!down) v.parts.spirit.userData.anim(gameTime);
    } else if (o.type === 'warden') {
      if (v.parts.body) { v.parts.body.g.visible = !down; v.parts.body.mixer.update(dt); }
    }
    if (v.bar) {
      const show = !v.destroyed && !down && pct < 0.999;
      v.bar.visible = show; if (show) drawBar(v.bar, pct, o.side === 'blue' ? '#3fa2ff' : o.side === 'red' ? '#ff4f43' : '#ffc94a');
    }
  }
  for (const r of jungleRigs) r.mixer.update(dt);
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera director
// ─────────────────────────────────────────────────────────────────────────────
function directorGoal(now) {
  const list = Object.values(champs).filter(c => c.alive && c.g.visible);
  if (camMode === 'follow' && followKey && champs[followKey]) {
    const c = champs[followKey]; camTargetGoal.copy(c.g.position); camDistGoal = 85; return;
  }
  if (camMode === 'overview') { camTargetGoal.set(0, 0, 0); camDistGoal = 330; return; }
  if (camMode !== 'auto') return;
  if (eventFocus && eventFocus.until > gameTime) { camTargetGoal.copy(eventFocus.pos); camDistGoal = eventFocus.dist || 100; return; }
  // densest cluster, weighted toward actual fights
  let best = null, bestScore = -1; const scoreOf = {};
  for (const c of list) {
    let n = 0, b = 0, r = 0, cx = 0, cz = 0;
    for (const o of list) { if (Math.hypot(o.g.position.x - c.g.position.x, o.g.position.z - c.g.position.z) < 42) { n++; cx += o.g.position.x; cz += o.g.position.z; if (o.side === 'blue') b++; else r++; } }
    const engaged = list.some(o => o.side !== c.side && Math.hypot(o.g.position.x - c.g.position.x, o.g.position.z - c.g.position.z) < 50);
    // lane action counts too: champions standing in a minion clash beat a jungler walking alone
    let mn = 0; for (const m of minionCur.values()) if (Math.hypot(m[2] - 150 - c.g.position.x, m[3] - 150 - c.g.position.z) < 40) mn++;
    const score = n + Math.min(b, r) * 2.5 + (engaged ? 2 : 0) + Math.min(mn, 12) * 0.25 + (c.side === meta.humanSide ? 0.3 : 0) + (c.key === focus.key ? 1.2 : 0);
    scoreOf[c.key] = { score, x: cx / n, z: cz / n, n };
    if (score > bestScore) { bestScore = score; best = { c, x: cx / n, z: cz / n, n }; }
  }
  if (!best) return;
  // hold the current shot for a few seconds unless something clearly better is happening now
  const cur = scoreOf[focus.key];
  if (focus.key !== best.c.key && focus.until > gameTime && cur && bestScore < cur.score + 2) {
    best = { c: champs[focus.key], x: cur.x, z: cur.z, n: cur.n };
  } else if (focus.key !== best.c.key) { focus = { key: best.c.key, until: gameTime + 8 }; }
  camTargetGoal.set(best.x, 0, best.z);
  camDistGoal = best.n >= 6 ? 112 : best.n >= 3 ? 96 : 86;
}

function updateCamera(dt) {
  const now = performance.now();
  if (camMode === 'free' && now > manualUntil && !pointer.down) setCamMode('auto');
  directorGoal(now);
  const k = 1 - Math.pow(camMode === 'free' ? 0.000001 : 0.12, dt);
  camTarget.lerp(camTargetGoal, k);
  camDist = lerp(camDist, camDistGoal, 1 - Math.pow(0.2, dt));
  // clamp target inside map
  camTarget.x = clamp(camTarget.x, -150, 150); camTarget.z = clamp(camTarget.z, -150, 150);
  const pitch = 0.95; // ~54° down, MOBA-style
  camera.position.set(camTarget.x, Math.sin(pitch) * camDist, camTarget.z + Math.cos(pitch) * camDist);
  camera.lookAt(camTarget.x, 0, camTarget.z);
}

// pointer controls: drag = pan, wheel / pinch = zoom
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const pointer = { down: false, id: null, x: 0, y: 0, pts: new Map(), pinch0: 0, dist0: 0 };
const _ray = new THREE.Raycaster(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundAt(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  _ray.setFromCamera(ndc, camera); const p = new THREE.Vector3(); return _ray.ray.intersectPlane(_plane, p) ? p : null;
}
function bindControls(el) {
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId); pointer.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pointer.down = true; pointer.x = e.clientX; pointer.y = e.clientY;
    if (pointer.pts.size === 2) { const [a, b] = [...pointer.pts.values()]; pointer.pinch0 = Math.hypot(a.x - b.x, a.y - b.y); pointer.dist0 = camDistGoal; }
  });
  el.addEventListener('pointermove', e => {
    if (!pointer.pts.has(e.pointerId)) return;
    pointer.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointer.pts.size === 2) { const [a, b] = [...pointer.pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); camDistGoal = clamp(pointer.dist0 * pointer.pinch0 / Math.max(10, d), 45, 360); setCamMode('free'); return; }
    if (COARSE && e.pointerType === 'touch') return;   // phones: one finger scrolls the page; two fingers zoom
    const p0 = groundAt(pointer.x, pointer.y), p1 = groundAt(e.clientX, e.clientY);
    if (p0 && p1 && (Math.abs(e.clientX - pointer.x) + Math.abs(e.clientY - pointer.y) > 1)) {
      setCamMode('free'); camTargetGoal.add(p0.sub(p1)); camTarget.copy(camTargetGoal);
    }
    pointer.x = e.clientX; pointer.y = e.clientY;
  });
  const up = e => { pointer.pts.delete(e.pointerId); if (pointer.pts.size === 0) pointer.down = false; manualUntil = performance.now() + 7000; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); camDistGoal = clamp(camDistGoal * (1 + Math.sign(e.deltaY) * 0.12), 45, 360); if (camMode === 'auto') { setCamMode('free'); camTargetGoal.copy(camTarget); } manualUntil = performance.now() + 7000; }, { passive: false });
  // phones: let a one-finger swipe scroll the page (pinch still reaches us for zoom)
  el.style.touchAction = COARSE ? 'pan-y' : 'none';
}
function setCamMode(m, key) {
  camMode = m; if (key !== undefined) followKey = key;
  if (m === 'free') manualUntil = performance.now() + 7000;
  for (const k in camBtns) camBtns[k].classList.toggle('on', k === (m === 'follow' ? 'f_' + followKey : m));
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay UI
// ─────────────────────────────────────────────────────────────────────────────
function buildOverlay() {
  overlay = document.createElement('div'); overlay.className = 'mv3d-overlay';
  overlay.innerHTML = `
    <div class="mv3d-cams">
      <button data-m="auto" class="on">🎥 Auto</button>
      <button data-m="overview">🗺 Map</button>
      <span class="mv3d-follow"></span>
    </div>
    <div class="mv3d-banner"></div>
    <div class="mv3d-hint">${COARSE ? 'Pinch to zoom' : 'Drag to pan · scroll to zoom'}</div>`;
  bannerEl = overlay.querySelector('.mv3d-banner');
  overlay.querySelectorAll('[data-m]').forEach(b => { camBtns[b.dataset.m] = b; b.addEventListener('click', () => setCamMode(b.dataset.m)); });
  return overlay;
}
function buildFollowButtons() {
  const wrap = overlay.querySelector('.mv3d-follow'); wrap.innerHTML = '';
  for (const k in camBtns) if (k.startsWith('f_')) delete camBtns[k];
  for (const role of ROLES) {
    const key = meta.humanSide + '_' + role; const b = document.createElement('button');
    b.textContent = ROLE_LBL[role]; b.title = 'Follow ' + (meta.champNames[meta.humanSide]?.[role] || role);
    b.addEventListener('click', () => setCamMode('follow', key)); camBtns['f_' + key] = b; wrap.appendChild(b);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loop
// ─────────────────────────────────────────────────────────────────────────────
function resize() {
  if (!container || !renderer) return;
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  const c = renderer.domElement;
  if (c.width !== Math.floor(w * renderer.getPixelRatio()) || c.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
}
function loop() {
  rafId = requestAnimationFrame(loop);
  if (!container || !container.isConnected || container.offsetParent === null) return; // hidden: skip work
  // once the match is decided (or the result card is up) idle at ~4 fps — saves battery on phones
  const results = document.getElementById('pbp-results');
  const idle = (ended && gameTime - (window.Match3D._endT ?? gameTime) > 0) || (results && results.offsetParent !== null);
  if (idle) { const now = performance.now(); if (now - (loop._last || 0) < 250) return; loop._last = now; }
  const dt = Math.min(clock.getDelta(), 0.05);
  resize();
  // game time follows the 2D viewer's tick clock
  gameTime = (Math.max(0, simTick - 1) + simT) * TICK_S;
  let gdt = gameTime - lastGameTime; if (gdt < 0 || gdt > 6) gdt = 0; lastGameTime = gameTime;
  if (gltf) {
    updateChamps(dt, gdt);
    updateMinions(); minionShots(gdt);
  }
  updateObjectives(dt);
  for (const a of staticAnims) a(gameTime);
  updateFx(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

function ensureChamps() {
  if (!gltf) return;
  for (const side of ['blue', 'red']) for (const role of ROLES) {
    const key = side + '_' + role;
    const name = meta.champNames?.[side]?.[role] || latest[side]?.[role]?.champName || '?';
    if (champs[key] && champs[key].name === name) continue;
    if (champs[key]) champs[key].dispose();
    const c = new Champ(side, role, name); c.key = key; champs[key] = c;
  }
}

function resetMatch() {
  for (const k in champs) champs[k].dispose(); champs = {};
  clearMinions();
  for (const f of fx) scene.remove(f.m); fx = [];
  for (const p of projectiles) scene.remove(p.m, p.trail); projectiles = [];
  latest = { blue: {}, red: {} }; lerped = null; objStates = {};
  simTick = 0; simT = 0; gameTime = 0; lastGameTime = 0; ended = false;
  for (const id in objViews) { objViews[id].destroyed = false; objViews[id].down = false; }
  eventFocus = null; focus = { key: null, until: 0 };
  const hs = meta.humanSide === 'red' ? G_SPAWN.red : G_SPAWN.blue;
  camTarget.copy(W(hs.x, hs.y)).multiplyScalar(0.6); camTargetGoal.copy(camTarget); camDist = camDistGoal = 150;
  setCamMode('auto');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
window.Match3D = {
  available: true,
  mount(el, m) {
    try {
      if (!renderer) { initRenderer(); buildStatic(); minionMats.blue = new THREE.MeshStandardMaterial({ color: 0x5aa8ff, roughness: 0.6 }); minionMats.red = new THREE.MeshStandardMaterial({ color: 0xff6a5a, roughness: 0.6 }); bindControls(renderer.domElement); }
    } catch (e) { console.warn('[Match3D] WebGL unavailable', e); window.Match3D.available = false; el.classList.add('mv3d-failed'); return false; }
    container = el;
    meta = Object.assign({ champNames: { blue: {}, red: {} }, playerNames: { blue: {}, red: {} }, humanSide: 'blue' }, m || {});
    if (renderer.domElement.parentNode !== el) el.prepend(renderer.domElement);
    if (!overlay) buildOverlay();
    if (overlay.parentNode !== el) el.appendChild(overlay);
    buildFollowButtons();
    resetMatch();
    if (!gltfPromise) {
      gltfPromise = new Promise((res, rej) => new GLTFLoader().load('assets/models/xbot.glb', res, undefined, rej))
        .then(g => { gltf = g; attachCreatures(); ensureChamps(); })
        .catch(e => console.warn('[Match3D] model load failed', e));
    } else if (gltf) ensureChamps();
    if (!rafId) { clock.getDelta(); loop(); }
    return true;
  },
  frame(lerpedPos, t, tick) { lerped = lerpedPos; simT = t; if (tick !== undefined) simTick = tick; },
  event(ev) {
    if (!ev) return;
    if (ev.positions) { latest = ev.positions; if (gltf && !Object.keys(champs).length) ensureChamps(); }
    if (ev.objectives) for (const o of ev.objectives) objStates[o.id] = o;
    if (ev.minions) setMinions(ev.minions);
    if (ev.tick !== undefined) simTick = Math.max(simTick, ev.tick);
    const sideCss = ev.side === 'blue' ? 'blue' : ev.side === 'red' ? 'red' : '';
    const teamName = ev.side === 'blue' ? meta.blueName : meta.redName;
    if (ev.type === 'kill') {
      const vp = ev.victimSide && ev.positions?.[ev.victimSide]?.[ev.victimRole];
      const vk = ev.victimSide && ev.victimRole ? champs[ev.victimSide + '_' + ev.victimRole] : null;
      const at = vp ? W(vp.x, vp.y) : vk ? vk.g.position.clone() : null;
      if (at) { floatText(at, 'SLAIN', ev.side === 'blue' ? '#7fd0ff' : '#ff9a8a'); eventFocus = { pos: at, until: gameTime + 4, dist: 90 }; }
      banner(`<b>${ev.text || 'Kill!'}</b>`, sideCss);
    } else if (ev.type === 'objective' || ev.type === 'dragon' || ev.type === 'baron') {
      const o = ev.objId && objViews[ev.objId];
      if (o) { const col = TEAM_COL[ev.side] || 0xffd54a; pillar(o.g.position, col, 1.8, ev.type === 'objective' ? 5 : 9); eventFocus = { pos: o.g.position.clone(), until: gameTime + 5, dist: ev.type === 'objective' ? 95 : 105 }; }
      banner(`<span class="mv3d-tag">${ev.type === 'baron' ? 'WARDEN' : ev.type === 'dragon' ? 'SOUL' : 'OBJECTIVE'}</span> ${ev.text || ''}`, sideCss);
    } else if (ev.type === 'result') {
      ended = true; window.Match3D._endT = gameTime + 4;
      const loser = ev.side === 'blue' ? 'r_ancient' : 'b_ancient'; const v = objViews[loser];
      if (v) { for (let i = 0; i < 3; i++) setTimeout(() => burst(v.g.position, 0xffffff, 50, 40, 1.6, 2), i * 250); eventFocus = { pos: v.g.position.clone(), until: gameTime + 999, dist: 120 }; }
      banner(`<span class="mv3d-tag">VICTORY</span> ${teamName || ''}`, sideCss);
    }
  },
  setCamera(m) { setCamMode(m); },
  // snap champions + camera to the current positions (after a seek / skip)
  snap() { for (const k in champs) champs[k].first = true; camTarget.copy(camTargetGoal); camDist = camDistGoal; },
};
window.__m3dMinions = () => minionMeshes.size;
window.__m3d = { get champs(){return champs;}, get camTarget(){return camTarget;}, get camDist(){return camDist;}, get lerped(){return lerped;}, get gltf(){return gltf;}, get camera(){return camera;} };
window.dispatchEvent(new Event('match3d-ready'));
