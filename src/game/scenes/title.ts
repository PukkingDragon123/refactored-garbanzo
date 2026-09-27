// Title screen and the opening voyage cutscene.

import type { Renderer } from '../../gfx/renderer';
import type { Scene } from '../game';
import { game } from '../game';
import { packColor } from '../../gfx/renderer';
import { Stage } from '../../world/stage';
import { Custom } from '../../world/props';
import { local } from '../assets';
import { Ocean, BAND_P, applySeaEnv, updater, Weather } from '../../world/ocean';
import { Sky } from '../../world/ocean-sky';
import { paintBirds } from '../../art/ocean-sky';
import { glowSprite, softBar } from '../../art/ocean';
import { paintBoatExterior, BOAT_LAYOUT } from '../../art/boat';
import { paintFarIsles, paintNearIsles } from '../../art/archipelago';
import { shrinkPixels } from '../../art/people-heads';
import { damp } from '../../core/math';

const SEA_Y = BOAT_LAYOUT.pivot[1];
import { el } from '../../ui/ui';
import { audio } from '../../core/audio';
import { hasSave, newSave, clearSave } from '../save';
import { goCamp, goPrologue } from './flow';

const CSS = `
.t3 { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.t3-bar { position: absolute; left: 0; right: 0; height: 13%; background: #050308; transition: height 2.4s cubic-bezier(.7,0,.2,1); z-index: 2; }
.t3-bar.top { top: 0; } .t3-bar.bot { bottom: 0; }
.t3.open .t3-bar { height: 4.2%; }
.t3-logo { position: absolute; left: 5vw; top: 9vh; opacity: 0; transform: translateY(-14px); transition: opacity 1.2s, transform 1.4s cubic-bezier(.2,.9,.3,1); z-index: 3; }
.t3.logo .t3-logo { opacity: 1; transform: none; }
.t3-logo small { display: block; font-family: 'Silkscreen', var(--pix); font-size: clamp(11px, 1.35vw, 19px); letter-spacing: 0.9em; color: #9ff0dc;
  text-shadow: 0 2px 0 #10302c, 2px 0 0 #10302c, -2px 0 0 #10302c, 0 -2px 0 #10302c; margin: 0 0 0.35em 0.25em; }
.t3-logo h1 { margin: 0; font-family: 'Pixelify Sans', var(--pix); font-weight: 700; font-size: clamp(40px, 7.6vw, 118px); line-height: 0.9; letter-spacing: 0.03em;
  color: #fff0cc; position: relative;
  text-shadow: 3px 0 0 #2a1424, -3px 0 0 #2a1424, 0 3px 0 #2a1424, 0 -3px 0 #2a1424, 0 6px 0 #c0643a, 0 9px 0 #7a2e2a, 3px 9px 0 #2a1424, -3px 9px 0 #2a1424, 0 12px 0 #2a1424, 0 16px 12px rgba(0,0,0,0.45); }
.t3-logo h1 i { font-style: normal; position: absolute; inset: 0; color: transparent; background: linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.85) 48%, transparent 56%) -200% 0 / 200% 100% no-repeat;
  -webkit-background-clip: text; background-clip: text; text-shadow: none; animation: t3shine 5.5s 2s steps(24) infinite; }
@keyframes t3shine { 0% { background-position: -120% 0; } 45%, 100% { background-position: 220% 0; } }
.t3-logo p { margin: 1.1em 0 0 0.2em; font-family: 'Silkscreen', var(--pix); font-size: clamp(10px, 1.05vw, 15px); color: #ffe4c8; letter-spacing: 0.08em; text-shadow: 0 2px 0 #2a1424; max-width: 34em; }
.t3-logo p b { color: #ffc86a; font-weight: 400; }
.t3-menu { position: absolute; left: 5vw; bottom: 9vh; width: clamp(240px, 30vw, 360px); padding: 1.1em 1.1em 1em; display: flex; flex-direction: column; gap: 0.55em;
  opacity: 0; transform: translateX(-30px); transition: opacity 0.8s, transform 0.9s cubic-bezier(.2,.9,.3,1); pointer-events: none; z-index: 3; }
.t3.menu .t3-menu { opacity: 1; transform: none; pointer-events: auto; }
.t3-menu .btn { width: 100%; font-size: 1.05em; white-space: nowrap; padding: 0.55em 0.8em; text-align: left; display: flex; align-items: center; gap: 0.6em; }
.t3-menu .btn .ic { width: 1.6em; height: 1.6em; image-rendering: pixelated; flex: none; background: var(--ic) center / contain no-repeat; }
.t3-menu .btn::after { content: '▶'; margin-left: auto; opacity: 0; transform: translateX(-6px); transition: opacity 0.15s, transform 0.15s; font-size: 0.8em; }
.t3-menu .btn:hover::after, .t3-menu .btn:focus-visible::after { opacity: 1; transform: none; }
.t3-menu .hd { font-family: 'Silkscreen', var(--pix); font-size: 0.78em; letter-spacing: 0.2em; color: #6a4a2a; text-align: center; margin-bottom: 0.2em; }
.t3-foot { position: absolute; right: 2.2vw; bottom: 5.4%; font-family: 'Silkscreen', var(--pix); font-size: 0.72em; color: #ffe4c8; opacity: 0; transition: opacity 1s 1s; text-shadow: 0 2px 0 #000; z-index: 3; }
.t3.menu .t3-foot { opacity: 0.75; }
.t3-skip { position: absolute; right: 2.2vw; bottom: 1.2%; font-family: 'Silkscreen', var(--pix); font-size: 0.7em; color: #fff; opacity: 0.55; z-index: 4; }
.t3.menu .t3-skip { display: none; }
.t3-cap { position: absolute; left: 0; right: 0; bottom: 18%; text-align: center; font-family: 'Silkscreen', var(--pix); font-size: clamp(11px, 1.3vw, 18px); color: #fff4e0; letter-spacing: 0.25em;
  text-shadow: 0 2px 0 #000; opacity: 0; transition: opacity 1.2s; z-index: 3; }
.t3-cap.on { opacity: 0.9; }
.settings { width: min(460px, 92vw); padding: 1.4em 1.6em; display: flex; flex-direction: column; gap: 1em; }
.settings label { display: grid; grid-template-columns: 8em 1fr 3em; gap: 0.8em; align-items: center; font-family: var(--pix); }
.settings input[type=range] { width: 100%; accent-color: #4f9a3a; }
.credits { width: min(560px, 92vw); padding: 1.4em 1.6em; line-height: 1.6; }
.confirm { width: min(420px, 92vw); padding: 1.4em 1.6em; display: flex; flex-direction: column; gap: 1em; }
.confirm .row { display: flex; gap: 10px; justify-content: flex-end; }
`;
let styled = false;

// small pixel icons for the menu buttons
const MICONS: Record<string, string[]> = {
  play: ['.#......', '.##.....', '.###....', '.####...', '.####...', '.###....', '.##.....', '.#......'],
  compass: ['..####..', '.#....#.', '#..#...#', '#..##..#', '#..##..#', '#...#..#', '.#....#.', '..####..'],
  gear: ['...##...', '.#.##.#.', '..####..', '###..###', '###..###', '..####..', '.#.##.#.', '...##...'],
  scroll: ['.######.', '#......#', '.#.##.#.', '.#....#.', '.#.##.#.', '.#....#.', '#......#', '.######.'],
};
function micon(name: string) {
  const c = document.createElement('canvas');
  c.width = 10; c.height = 10;
  const x = c.getContext('2d')!;
  for (const [o, f] of [[1, 'rgba(0,0,0,0.5)'], [0, '#fff8e0']] as const) {
    x.fillStyle = f;
    MICONS[name].forEach((row, j) => { for (let i = 0; i < 8; i++) if (row[i] === '#') x.fillRect(i + o, j + o, 1, 1); });
  }
  return `url(${c.toDataURL()})`;
}

interface Puff { x: number; y: number; vx: number; vy: number; r: number; a: number; t: number; life: number }
interface Streak { x: number; y: number; len: number; sp: number; a: number; ph: number }
interface Gull { x: number; y: number; vx: number; ph: number; s: number }

/**
 * V3 title: a cinematic of the Kittiwake punching through a wind-whipped dusk sea toward a
 * mysterious volcanic archipelago; a carved guardian watches from the headland.
 */
export class TitleScene implements Scene {
  st!: Stage;
  weather = new Weather();
  ocean!: Ocean;
  sky!: Sky;
  t = 0;
  root!: HTMLElement;
  private boatX = 330;
  private boatRot = 0;
  private stage = 0;
  private puffs: Puff[] = [];
  private streaks: Streak[] = [];
  private gulls: Gull[] = [];
  private nextFlash = 5;
  private nextSplash = 1;
  private skipped = false;
  private onKey = () => this.skip();

  enter() {
    if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
    const r = game.r;
    const st = this.st = new Stage('day', { shade: 0 });
    st.minX = -4000; st.maxX = 8000; st.minY = -2000; st.maxY = 2000;
    const w = this.weather;
    w.storm = 0.24; w.wind = -1; w.sunX = 0.8; w.sunY = 0.34; w.cruise = 34;
    st.envHook = env => {
      applySeaEnv(env, w);
      // golden-hour grade with violet shadows
      env.gain = [env.gain[0] * 1.1, env.gain[1] * 0.93, env.gain[2] * 0.88];
      env.lift = [env.lift[0] + 0.035, env.lift[1] + 0.008, env.lift[2] + 0.06];
      env.saturation *= 1.06;
      env.contrast *= 1.05;
      env.vignette = Math.max(env.vignette, 0.55);
      env.bloom = Math.max(env.bloom, 0.75);
    };
    this.ocean = new Ocean({ y: SEA_Y, horizon: SEA_Y - 96, seed: 9, weather: w });
    this.sky = new Sky({ weather: w, horizon: this.ocean.horizon, horizonP: BAND_P.horizon, seed: 12 });
    this.sky.birds = true;
    this.sky.auto = false;
    this.sky.onStrike = big => audio.play('thunder', { vol: big ? 0.35 : 0.18 });
    st.addScreenLayer('sky').add(this.sky);

    // far islands + volcano smoke
    const far = paintFarIsles(), near = paintNearIsles();
    const fFar = local.add('t3:far', far.buf, 0, far.buf.h), fFarG = local.add('t3:farg', far.glow, 0, far.glow.h);
    const fNear = local.add('t3:near', near.buf, 0, near.buf.h), fNearG = local.add('t3:nearg', near.glow, 0, near.glow.h);
    const puffF = local.add('t3:puff', glowSprite(32, 1.6), 16, 16);
    const barF = local.add('t3:bar', softBar(64, 10), 32, 5);
    const horizonScreen = (rr: Renderer) => rr.projectY(this.ocean.horizon, BAND_P.horizon);
    const PF = 0.035, PN = 0.14;
    const FX = 330 * PF - 460, NX = 330 * PN - 380;
    st.addLayer('isles-far', PF, 0, 0.35, 0).add(new Custom(0, rr => {
      const by = rr.wy(horizonScreen(rr) + 2);
      rr.draw(fFar, FX, by);
      rr.emissive(1);
      const fl = 0.75 + 0.25 * Math.sin(this.t * 2.3) * Math.sin(this.t * 0.9);
      rr.draw(fFarG, FX, by, 1, 1, 0, packColor(1, 1, 1, fl));
      rr.emissive();
      const [cx, cy] = far.crater!;
      rr.light(FX + cx, by - far.buf.h + cy, 60, 1, 0.45, 0.2, 0.8 * fl);
      for (const p of this.puffs) {
        const k = p.t / p.life;
        const a = p.a * Math.sin(Math.PI * Math.min(1, k * 1.2));
        rr.draw(puffF, FX + cx + p.x, by - far.buf.h + cy + p.y, p.r * 1.7, p.r * 1.4, 0, packColor(0.7 + k * 0.15, 0.58 + k * 0.18, 0.66 + k * 0.14, a * 0.85));
      }
      // haze band hugging the far waterline
      rr.draw(barF, FX + 480, by - 4, 18, 1.2, 0, packColor(0.86, 0.66, 0.74, 0.35));
    }, dt => {
      if (Math.random() < dt * 5) this.puffs.push({ x: (Math.random() - 0.5) * 8, y: 0, vx: -7 - Math.random() * 4, vy: -2.2 - Math.random() * 1.5, r: 0.55, a: 0.55 + Math.random() * 0.3, t: 0, life: 9 + Math.random() * 5 });
      for (const p of this.puffs) { p.t += dt; p.x += p.vx * dt * (1 + p.t * 0.25); p.y += p.vy * dt; p.vy *= 1 - dt * 0.15; p.r += dt * 0.22; }
      this.puffs = this.puffs.filter(p => p.t < p.life);
    }));
    for (const b of ['horizon'] as const) st.addLayer('sea-' + b, BAND_P[b], 0, 0.6, 0).add(this.ocean.band(b));
    st.addLayer('isles-near', PN, 0, 0.45, 0).add(new Custom(0, rr => {
      const by = rr.wy(horizonScreen(rr) + 3);
      rr.draw(fNear, NX, by);
      rr.emissive(1);
      const eyes = 0.55 + 0.45 * Math.max(0, Math.sin(this.t * 0.7));
      rr.draw(fNearG, NX, by, 1, 1, 0, packColor(1, 1, 1, eyes));
      rr.emissive();
      for (const [ex, ey] of near.eyes!) rr.light(NX + ex, by - near.buf.h + ey, 10, 0.5, 1, 0.9, 0.9 * eyes);
      // drifting sea mist across the headland foot
      for (let i = 0; i < 3; i++) {
        const mx = NX + ((this.t * (6 + i * 3) + i * 300) % 1100) - 80;
        rr.draw(barF, mx, by - 6 - i * 5, 5 + i, 1.6, 0, packColor(0.9, 0.74, 0.8, 0.22));
      }
      // surf line where the islands meet the sea
      for (let i = 0; i < 8; i++) {
        rr.draw(barF, NX + i * 130 + Math.sin(this.t * 0.8 + i) * 6, by - 1, 2.6, 0.6, 0, packColor(0.95, 0.85, 0.85, 0.55));
      }
    }));
    for (const b of ['far', 'mid'] as const) st.addLayer('sea-' + b, BAND_P[b], 0, 0.6, 0).add(this.ocean.band(b));

    // the Kittiwake, shrunk with the same feature-preserving filter the people use
    const ext = paintBoatExterior({});
    const K = 0.3;
    const sb = shrinkPixels(ext.buf, ext.ax, ext.ay, K);
    const fBoat = local.add('t3:boat', sb.buf, sb.ax, sb.ay);
    const sg = ext.glow ? shrinkPixels(ext.glow, ext.ax, ext.ay, K) : null;
    const fBoatG = sg ? local.add('t3:boatg', sg.buf, sg.ax, sg.ay) : null;
    const main = st.addLayer('main', 1, 0, 1, 0);
    main.add(new Custom(0, rr => {
      const y = this.ocean.heightAt(this.boatX) + 3;
      rr.draw(fBoat, this.boatX, y, 1, 1, this.boatRot);
      if (fBoatG) { rr.emissive(1); rr.draw(fBoatG, this.boatX, y, 1, 1, this.boatRot, packColor(1, 1, 1, 0.8)); rr.emissive(); }
      // mast and wheelhouse lamps
      rr.light(this.boatX + 20, y - 70, 40, 1, 0.8, 0.5, 0.7);
    }));
    st.addLayer('sea-near', BAND_P.near, 0, 0.6, 0).add(this.ocean.band('near'));
    st.addLayer('sea-front', BAND_P.front, 0, 0.5, 0).add(this.ocean.band('front'));
    st.layer('sea-horizon').add(updater(dt => { w.update(dt); this.ocean.update(dt); }));

    // wind: streaks, spray motes and a gull flock on a screen layer in front of everything
    const gullFr = paintBirds().map((b, i) => local.add('t3:gull' + i, b, 3, 1));
    for (let i = 0; i < 70; i++) this.streaks.push({ x: Math.random() * 900, y: Math.random() * 360, len: 8 + Math.random() * 46, sp: 160 + Math.random() * 260, a: 0.12 + Math.random() * 0.28, ph: Math.random() * 6 });
    const wind = st.addScreenLayer('wind', 1);
    wind.add(new Custom(0, rr => {
      const g = 0.6 + w.gust * 0.8;
      for (const s of this.streaks) {
        const yy = s.y + Math.sin(this.t * 1.7 + s.ph) * 3;
        rr.rect(s.x, yy, s.len, 1, packColor(1, 0.94, 0.9, s.a * g));
        rr.rect(s.x + s.len * 0.2, yy - 1, s.len * 0.4, 1, packColor(1, 0.94, 0.9, s.a * 0.35 * g));
      }
      for (const b of this.gulls) {
        const fr = gullFr[Math.floor(this.t * 7 + b.ph) % 3];
        rr.draw(fr, b.x, b.y + Math.sin(this.t * 2 + b.ph) * 2, b.s, b.s, 0, packColor(0.16, 0.12, 0.2, 0.9));
      }
    }, dt => {
      const g = 0.7 + w.gust * 0.6;
      for (const s of this.streaks) {
        s.x -= s.sp * g * dt;
        if (s.x + s.len < 0) { s.x = game.r.VW + Math.random() * 80; s.y = Math.random() * game.r.VH; }
      }
      for (const b of this.gulls) b.x += b.vx * dt;
      this.gulls = this.gulls.filter(b => b.x > -40 && b.x < game.r.VW + 60);
      if (this.gulls.length === 0 && Math.random() < dt * 0.12) {
        const y0 = 40 + Math.random() * 70, n = 4 + Math.floor(Math.random() * 4), dir = Math.random() < 0.5 ? -1 : 1;
        for (let i = 0; i < n; i++) this.gulls.push({ x: (dir < 0 ? game.r.VW + 20 : -20) + i * 9 * -dir, y: y0 + Math.abs(i - n / 2) * 4, vx: dir * (26 + Math.random() * 4), ph: i * 1.3, s: 1 + (i % 2) * 0.2 });
      }
    }));

    // camera: start tight on the boat in darkness, then pull back to reveal the islands
    st.cam.x = st.cam.tx = this.boatX - 20;
    st.cam.y = st.cam.ty = 150;
    st.cam.zoom = st.cam.tzoom = 2.3;
    st.cam.follow = 0.6; st.cam.zoomLerp = 0.45;

    // DOM
    this.root = el('div', 't3');
    this.root.innerHTML = `<div class="t3-bar top"></div><div class="t3-bar bot"></div>
      <div class="t3-logo"><small>PROJECT</small><h1>ZEALANDIA<i>ZEALANDIA</i></h1><p>Shipwrecked on a lost continent where <b>serpents</b> rule. Bring back the photographs.</p></div>
      <div class="t3-cap"></div>
      <div class="t3-foot">Click for sound &middot; V3</div><div class="t3-skip">Click to skip</div>`;
    const menu = this.root.appendChild(el('div', 't3-menu panel'));
    menu.appendChild(el('div', 'hd', 'EXPEDITION LOG'));
    const btn = (label: string, icon: string, cls: string, fn: () => void) => {
      const b = el('button', 'btn ' + cls, `<span class="ic"></span><span>${label}</span>`);
      (b.querySelector('.ic') as HTMLElement).style.setProperty('--ic', micon(icon));
      b.onclick = e => { e.stopPropagation(); audio.unlock(); fn(); };
      b.onmouseenter = () => audio.play('ui', { vol: 0.25, pitch: 1.3 });
      menu.appendChild(b);
      return b;
    };
    const cont = hasSave();
    if (cont) btn('Continue', 'play', '', () => { audio.play('ui'); if (game.save.flags['prologue']) goCamp(); else goPrologue(); });
    btn('New expedition', 'compass', cont ? 'ghost' : '', () => { audio.play('ui'); if (cont) this.confirmNew(); else this.startNew(); });
    btn('Settings', 'gear', 'ghost', () => { audio.play('uiOpen'); openSettings(); });
    btn('Credits', 'scroll', 'ghost', () => { audio.play('uiOpen'); openCredits(); });
    this.root.addEventListener('pointerdown', () => { audio.unlock(); this.skip(); });
    this.root.style.pointerEvents = 'auto';
    window.addEventListener('keydown', this.onKey);
    game.ui.sceneLayer.appendChild(this.root);
    audio.setAmbience('ocean');
    audio.setMusic('title');
  }

  /** jump straight to the finished reveal */
  skip() {
    if (this.skipped) return;
    this.skipped = true;
    this.t = Math.max(this.t, 9);
    this.st.cam.tzoom = 1; this.st.cam.zoomLerp = 2.5;
    game.fadeTo(0, 3);
    this.root.classList.add('open', 'logo', 'menu');
    this.cap('');
  }

  private cap(text: string) {
    const c = this.root.querySelector('.t3-cap') as HTMLElement;
    if (!text) { c.classList.remove('on'); return; }
    c.textContent = text;
    c.classList.add('on');
  }

  confirmNew() {
    const box = el('div', 'confirm panel', `<h2>Start over?</h2><p>This replaces your current expedition, photos and Field Guide progress.</p>`);
    const row = box.appendChild(el('div', 'row'));
    const no = el('button', 'btn ghost', 'Keep my save');
    const yes = el('button', 'btn', 'Start a new expedition');
    row.append(no, yes);
    const close = game.ui.modal(box);
    no.onclick = () => close();
    yes.onclick = () => { close(); clearSave(); this.startNew(); };
  }
  startNew() {
    game.save = newSave();
    goPrologue();
  }

  update(dt: number) {
    // slow cinematic fade-in (game.go starts a quick one after enter)
    if (this.t === 0 && !this.skipped) { game.r.post.fade = 1; game.fadeTo(0, 0.35); }
    this.t += dt;
    const st = this.st;
    // the boat ploughs forward slowly; bow pitches with the swell
    this.boatX += 5 * dt;
    const hA = this.ocean.heightAt(this.boatX - 70), hB = this.ocean.heightAt(this.boatX + 70);
    this.boatRot = damp(this.boatRot, Math.atan2(hB - hA, 140) * 0.8, 4, dt);
    this.nextSplash -= dt;
    void this.nextSplash;
    // distant lightning inside the clouds over the islands
    this.nextFlash -= dt;
    if (this.nextFlash <= 0) { this.nextFlash = 6 + Math.random() * 9; this.sky.flash({ x: 0.55 + Math.random() * 0.35, big: false }); }
    // cinematic beats
    const T = this.t;
    if (!this.skipped) {
      if (this.stage === 0 && T > 1.2) { this.stage = 1; this.cap('Day 21 · somewhere south of the charts'); }
      if (this.stage === 1 && T > 3.2) { this.stage = 2; st.cam.tzoom = 1; this.cap(''); this.root.classList.add('open'); }
      if (this.stage === 2 && T > 5.4) { this.stage = 3; this.root.classList.add('logo'); audio.play('uiOpen', { vol: 0.5 }); }
      if (this.stage === 3 && T > 7.4) { this.stage = 4; this.root.classList.add('menu'); this.skipped = true; }
    }
    st.cam.tx = this.boatX - 120 + Math.sin(T * 0.07) * 30;
    st.cam.ty = 150 + Math.sin(T * 0.11) * 4;
    st.update(dt);
    audio.update(dt);
  }
  render(r: Renderer, dt: number) {
    this.st.updateCamera(dt, r);
    this.st.render(r, dt);
  }
  exit() {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
    this.st.clear();
  }
}

export function openSettings() {
  const s = game.save.settings;
  const box = el('div', 'settings panel', '<h2>Settings</h2>');
  const row = (label: string, v: number, on: (v: number) => void) => {
    const l = el('label', '', `<span>${label}</span><input type="range" min="0" max="100" value="${Math.round(v * 100)}"><span>${Math.round(v * 100)}</span>`);
    const inp = l.querySelector('input') as HTMLInputElement, out = l.querySelectorAll('span')[1] as HTMLElement;
    inp.id = 'set-' + label.toLowerCase();
    inp.oninput = () => { out.textContent = inp.value; on(+inp.value / 100); };
    box.appendChild(l);
  };
  row('Music', s.music, v => { s.music = v; audio.musicVolume = v; });
  row('Sound', s.sfx, v => { s.sfx = v; audio.sfxVolume = v; audio.play('ui', { vol: 0.6 }); });
  row('Quality', s.quality, v => { s.quality = Math.max(0.35, v); game.r.quality = s.quality; window.dispatchEvent(new Event('resize')); });
  const done = el('button', 'btn', 'Done');
  box.appendChild(done);
  const close = game.ui.modal(box, () => game.persist());
  done.onclick = () => close();
}

function openCredits() {
  const box = el('div', 'credits panel', `<h2>Project Zealandia</h2>
    <p>A pixel-art wildlife photography and ecosystem research game. Every sprite, landscape, creature and sound is generated in code at load time: procedural pixel art, a WebGL2 lighting renderer and synthesized WebAudio.</p>
    <p>Inspired by the cosy exploration of <i>Dave the Diver</i> and the real sunken continent of Zealandia. The animals are fictional: an evolutionary thought experiment in a world where serpents, not birds, became the dominant animals.</p>
    <p style="opacity:0.7;font-size:0.9em">Controls: A/D move, Shift run, S crouch/hide, Space jump, W climb, E interact, right mouse or Q camera, click shoot, wheel zoom, V video, 1-5 and F gadgets, J Field Guide, Esc pause.</p>`);
  const done = el('button', 'btn', 'Close');
  box.appendChild(done);
  const close = game.ui.modal(box);
  done.onclick = () => close();
}
