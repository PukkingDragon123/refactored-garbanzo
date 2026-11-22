#!/usr/bin/env node
// Promo capture: frame-stepped, UI-free gameplay footage of one creature per reel.
//
//   node tools/promo/capture.cjs <id> [--out DIR] [--frames N] [--every K] [--probe]
//     id        shark | gecko | worm | crab (see tools/promo/shots.cjs)
//     --frames  frames to record (default: the shot's own length)
//     --every   screenshot only every K-th frame (quick previews; the timing stays real)
//     --probe   preview: --every 30, frames kept as PNGs, no video
//   env PROMO_WORK (default /tmp/promo-work): where frames go; PROMO_SHOTS: another shots file
//
// Then: python3 tools/promo/encode.py <id> --out <promo>/raw --stills t1,t2,t3   (the reel, the wide
// clip, the stills and manifest.json) and tools/promo/sheet.sh <reel.mp4> <sheet.png> to check it.
// A full 18 s capture takes about 5-10 minutes here; ids can run in parallel.
//
// How it stays smooth on a 2-3 fps software renderer: a virtual clock (./vclock.cjs) replaces
// performance.now, Date.now, timers and requestAnimationFrame before the game boots. Each recorded
// frame advances the clock by exactly 1/30 s and runs one game frame (window.__dtCap = 1/30), then the
// page is screenshotted. Everything the game does on timers (cine waits, scripted beats) therefore
// runs on game time too. Output: frames as PNG + track.json (subject screen positions per frame,
// behaviour beats), which ./encode.py turns into the 9:16 reel, the wide clip and the stills.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const VC = require('./vclock.cjs');
const SHOTS = require(process.env.PROMO_SHOTS ? path.resolve(process.env.PROMO_SHOTS) : './shots.cjs');

const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const id = args[0];
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const flag = k => args.includes('--' + k);
const shot = SHOTS[id];
if (!shot) { console.error('unknown id', id, 'known:', Object.keys(SHOTS).join(', ')); process.exit(1); }
const PROBE = flag('probe');
const FPS = 30;
const frames = +(opt('frames') ?? Math.round(shot.secs * FPS));
const every = +(opt('every') ?? (PROBE ? 30 : 1));
const OUT = opt('out') ?? path.join(process.env.PROMO_WORK ?? '/tmp/promo-work', id + (PROBE ? '-probe' : ''));

// ---------------------------------------------------------------- page-side helpers (window.__L)
const LIB = `(() => {
  const L = window.__L = {};
  L.sc = () => window.game.scene;
  L.st = () => L.sc() && L.sc().st;
  L.pl = () => L.sc() && L.sc().player;
  const CSS = 'body.trailer #ui > *:not(.letterbox) { visibility: hidden !important; }' +
    ' body.trailer .v12-float, body.trailer .h2, body.trailer .dv-panel { display: none !important; }' +
    ' body.trailer, body.trailer canvas { cursor: none !important; }' +
    ' body.trailer > *:not(canvas):not(#ui):not(#game):not(#app) { visibility: hidden !important; }';
  L.hide = () => {
    if (!document.getElementById('promo-css')) { const s = document.createElement('style'); s.id = 'promo-css'; s.textContent = CSS; document.head.appendChild(s); }
    document.body.classList.add('trailer');
    const g = window.game, s = L.sc();
    try { s && s.hud && s.hud.show(false); } catch (e) {}
    try { g.ui.bubbles.clear(); } catch (e) {}
    try { if (g.ui.dialogueOpen) { g.ui.dialogueOpen = false; g.ui.dlg.classList.remove('on'); } } catch (e) {}
    try { g.ui.letterbox(false); } catch (e) {}
    for (const a of (s && s.animals) || []) { if (a.emote) a.emote = null; }
    const p = L.pl(); if (p && p.emote) p.emote = null;
  };
  /** the camera, driven by hand: lock it and ease it toward (x, y, zoom) */
  L.cam = { x: 0, y: 0, z: 1, on: false };
  L.camSet = (x, y, z) => { const c = L.st().cam; c.locked = true; c.x = L.cam.x = x; c.y = L.cam.y = y; c.zoom = L.cam.z = z; c.tx = x; c.ty = y; c.tzoom = z; L.cam.on = true; };
  L.camEase = (x, y, z, k, dt) => {
    const c = L.st().cam, a = 1 - Math.exp(-k * dt);
    L.cam.x += (x - L.cam.x) * a; L.cam.y += (y - L.cam.y) * a; L.cam.z += (z - L.cam.z) * a;
    c.locked = true; c.x = L.cam.x; c.y = L.cam.y; c.zoom = L.cam.z; c.tx = c.x; c.ty = c.y; c.tzoom = c.zoom;
  };
  /** device px on screen of a world point on parallax p */
  L.proj = (x, y, p = 1) => { const r = window.game.r, k = r.W / r.VW; return [r.projectX(x, p) * k, r.projectY(y, p) * k]; };
  L.key = (k, on) => { const i = window.game.input; on ? i.press(k) : i.release(k); };
  L.keys = (ks) => { for (const k of ['KeyA','KeyD','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft']) L.key(k, ks.includes(k)); };
  L.near = (sp, x) => { const s = L.sc(); const px = x ?? (L.pl() ? L.pl().x : 0); return ((s && s.animals) || []).filter(a => a.species === sp && !a.gone && !a.dead).sort((a, b) => Math.abs(a.x - px) - Math.abs(b.x - px))[0] || null; };
  L.beats = [];
  L.beat = (name) => { L.beats.push(name); };
})();`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/^f\d+\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /\[promo\]/.test(t)) && !/favicon/.test(t)) console.log('[page]', m.type(), t.slice(0, 300)); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.addInitScript(VC);
  const url = `file://${ROOT}/dist-single/index.html?devjump=${encodeURIComponent(shot.jump)}&nomusic=1${shot.query ?? ''}`;
  console.log('load', url);
  await page.goto(url);
  await page.evaluate(LIB);
  const step = (ms) => page.evaluate(ms => window.__vc.step(ms), ms);
  // wait for the scene
  for (let i = 0; i < 600; i++) {
    await step(50);
    const ok = await page.evaluate(() => !!(window.game && window.game.scene && window.game.scene.st && window.game.scene.player && !window.game.busy));
    if (ok && i > 10) break;
  }
  await page.evaluate(() => window.__L.hide());
  // settle (the scene's opening beats, its fade in) on the default step cap
  const pre = Math.round((shot.preRoll ?? 3) * 20);
  for (let i = 0; i < pre; i++) { await step(50); if (i % 5 === 0) await page.evaluate(() => window.__L.hide()); }
  for (const st of shot.prep ?? []) {
    await page.evaluate(`void Promise.resolve((${st.run})(window.__L)).catch(e => console.error('[promo] prep', e && e.stack))`);
    for (let i = 0; i < Math.round(st.secs * 20); i++) { await step(50); if (i % 3 === 0) await page.evaluate(() => window.__L.hide()); }
  }
  await page.evaluate(`window.__dtCap = 1/${FPS}; (${shot.setup})(window.__L)`);
  for (let i = 0; i < (shot.setupFrames ?? 0); i++) await step(1000 / FPS);
  await page.evaluate(`window.__P = { tick: ${shot.tick} }`);
  const cdp = await page.context().newCDPSession(page);
  const track = { id, fps: FPS, frames, every, w: 1280, h: 720, pos: [], beats: [] };
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const info = await page.evaluate(([i, fps]) => {
      const L = window.__L; L.beats = [];
      let r = null;
      try { r = window.__P.tick(L, i / fps, 1 / fps, i); } catch (e) { console.error('[promo] tick', e && e.stack); }
      L.hide();
      return { r, beats: L.beats };
    }, [i, FPS]);
    await step(1000 / FPS);
    // where the subject is on screen this frame (projected after the frame's camera update)
    const sp = await page.evaluate(() => { const L = window.__L; const s = L.subj; if (!s) return null; const [x, y] = L.proj(s.x, s.y, s.p ?? 1); return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]; });
    track.pos.push(sp);
    for (const b of info.beats) { track.beats.push({ name: b, frame: i, t: +(i / FPS).toFixed(2) }); console.log(`  beat ${b} @ ${(i / FPS).toFixed(2)}s`); }
    if (i % every === (shot.shotPhase ?? 0)) {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.png`), Buffer.from(r.data, 'base64'));
    }
    if (i % 30 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${id} frame ${i}/${frames}  ${el.toFixed(0)}s  eta ${((el / (i + 1)) * (frames - i - 1)).toFixed(0)}s  subj ${JSON.stringify(sp)} ${info.r ? JSON.stringify(info.r) : ''}`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'track.json'), JSON.stringify(track));
  console.log('done', OUT, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
