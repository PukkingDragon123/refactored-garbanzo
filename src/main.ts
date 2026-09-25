import { runGallery } from './debug/galleries';
const gq = new URLSearchParams(location.search).get('gallery');
if (gq) { runGallery(gq); throw new Error('gallery mode'); }
import { Renderer, packColor } from './gfx/renderer';
import { Atlas, bigFrame } from './gfx/atlas';
import { PixelBuffer } from './art/pixel';
import { hex, mix, ramp } from './art/color';
import { bayer } from './core/math';

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const r = new Renderer(canvas);
const fit = () => {
  const w = window.innerWidth, h = window.innerHeight;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  r.resize(w, h, window.devicePixelRatio || 1);
};
fit();
window.addEventListener('resize', fit);

const atlas = new Atlas(r);
// sky
const sky = new PixelBuffer(64, 270);
const top = hex('#2b3a67'), mid = hex('#e0875a'), bot = hex('#ffd89a');
for (let y = 0; y < 270; y++) for (let x = 0; x < 64; x++) {
  const t = y / 269;
  const u = t < 0.6 ? t / 0.6 : (t - 0.6) / 0.4;
  const a = t < 0.6 ? top : mid, b = t < 0.6 ? mid : bot;
  const steps = 8;
  const q = Math.floor(u * steps + bayer(x, y)) / steps;
  sky.set(x, y, mix(a, b, Math.min(1, q)));
}
const skyF = bigFrame(r, sky);
const ball = new PixelBuffer(24, 24);
ball.shadedEllipse(12, 12, 11, 11, ramp(hex('#3fa66b'), 5));
ball.outline(hex('#16301f'));
const ballF = atlas.add('ball', ball, 12, 24);
const glow = new PixelBuffer(32, 32);
glow.discFn(16, 16, 16, (_x, _y, nx, ny) => { const d = Math.hypot(nx, ny); const a = Math.max(0, 1 - d); return packColor(1, 1, 1, a * a) as number; });
const glowF = atlas.add('glow', glow, 16, 16);
atlas.upload();

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  r.env.ambientTop = [0.35, 0.4, 0.65];
  r.env.ambientBottom = [0.25, 0.25, 0.45];
  r.env.fogTop = [0.55, 0.45, 0.6];
  r.env.fogBottom = [0.95, 0.7, 0.55];
  r.env.waterAxis = 200;
  r.env.waterTint = [0.7, 0.8, 0.95];
  r.begin(dt);
  r.view.x = Math.sin(r.time * 0.3) * 60;
  r.view.y = 135;
  r.view.zoom = 1 + Math.max(0, Math.sin(r.time * 0.5)) * 0.6;
  r.layer(0, 0, 0, 0.5);
  r.draw(skyF, 0, 0, r.VW / 64, 1, 0);
  r.layer(0.3, 0.6, 0);
  for (let i = -6; i < 6; i++) r.draw(ballF, i * 60, 190, 3, 2.5);
  r.layer(1, 0, 1);
  r.rect(-1000, 200, 3000, 100, packColor(0.2, 0.3, 0.5, 1));
  r.water(0.8, 1, 1);
  r.rect(-1000, 200, 3000, 100, packColor(0.15, 0.25, 0.45, 1));
  r.water(0);
  r.rect(-400, 185, 380, 15, packColor(0.35, 0.3, 0.2, 1));
  for (let i = -3; i < 3; i++) r.draw(ballF, i * 50, 185, 1, 1);
  const fl = 1 + Math.sin(r.time * 13) * 0.08 + Math.sin(r.time * 7.3) * 0.06;
  r.light(-100, 175, 120, 1, 0.55, 0.25, 2.2 * fl, 0.4);
  r.fxDraw(glowF, -100, 175, 1.2, 1.2, 0, packColor(1, 0.6, 0.3, 1), 2.5 * fl);
  r.end();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
