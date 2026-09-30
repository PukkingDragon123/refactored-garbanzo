// V6: talking Aroha down, as a full-screen close-up instead of a panel with meters. She fills the
// frame with the slingshot drawn back at the camera; the fork is right in front of the lens. Her
// NERVES show in the shot: the hand trembles, the rubber creaks back tighter while you hesitate
// (that's the answer timer), sweat, a red pulse at the edges. TRUST lowers the slingshot a little
// with every honest answer until it drops out of frame. Answers are Mori's speech-bubble choices.
// Same rounds and rules as before: silence or a bad answer winds her up, 100 nerves = warning shot.

import { openCloseup, CW, CH, hx, mixc, put, blend, ramp, hash, rgb, R, G, B } from './closeup';
import { loop, wait } from '../v4/mini';
import { el } from '../ui';
import { audio } from '../../core/audio';
import { renderAnimePortraitHD } from '../../art/anime/portraits';
import type { NegRound, NegAnswer } from '../v4/negotiate';

export type { NegRound, NegAnswer };

const CSS = `
.cu-ans { position: absolute; left: 3%; bottom: 5%; display: flex; flex-direction: column; gap: 0.45em; align-items: flex-start; max-width: min(52vw, 560px); }
.cu-ans .nm { font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: clamp(10px, 1.3vw, 14px); letter-spacing: 0.08em; color: #fff; background: #0c0a0c; padding: 0.15em 0.6em; box-shadow: inset 0.35em 0 0 #4a7a3a; }
.cu-ans button { text-align: left; font-family: 'Jersey 15', 'Pixelify Sans', monospace; font-size: clamp(13px, 1.8vw, 19px); line-height: 1.25; color: #0c0a0c; background: #fff; border: 0; cursor: pointer;
  padding: 0.35em 0.7em; box-shadow: 0 0 0 3px #0c0a0c, 4px 5px 0 3px rgba(0,0,0,0.45); animation: cuSay 0.3s cubic-bezier(.2,1.7,.4,1) both; }
.cu-ans button:nth-child(3) { animation-delay: 0.06s; } .cu-ans button:nth-child(4) { animation-delay: 0.12s; }
.cu-ans button:hover, .cu-ans button.sel { background: #0c0a0c; color: #fff; transform: translateX(4px); }
.cu-ans button .key { margin-right: 0.5em; }
.cu-ans button:disabled { opacity: 0.4; }
.cu-pop { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%) rotate(-8deg); font-family: 'Jersey 10', 'Silkscreen', monospace; font-weight: 700; font-size: clamp(40px, 11vw, 130px);
  color: #fff7d8; text-shadow: 6px 6px 0 #c8341e, -3px -3px 0 #2a0a04, 3px -3px 0 #2a0a04, -3px 3px 0 #2a0a04; pointer-events: none; animation: cuRes 1.1s steps(10) both; }
`;
let styled = false;

const shuffle = <T>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const WOOD = ['#2a160c', '#4a2a16', '#6a4222', '#8a5a30', '#a8743e', '#c89458'].map(hx);
const SKIN = ['#2a1610', '#6a3e2c', '#7a4a32', '#9a6446', '#bc855e', '#d49c74'].map(hx);
const BAND = ['#3a1a14', '#6a2a1e', '#9a3a26', '#c85a3a'].map(hx);
const INK = hx('#1a1014');

/** the dusky beach and bush behind her, soft focus */
function paintBack(): Uint32Array {
  const b = new Uint32Array(CW * CH);
  const SKY = ['#3a2a4a', '#6a3a5a', '#b85a5a', '#e8905a', '#f8c070'].map(hx);
  const BUSH = ['#0e1a12', '#16281a', '#223a22', '#2e4e2a', '#3e6434'].map(hx);
  const SAND = ['#5a4030', '#7a5a40', '#9a7652', '#b89064', '#d4ac7a'].map(hx);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    let c = ramp(SKY, 1 - y / 90 + Math.sin(x * 0.02) * 0.05, x, y);
    const ridge = 70 + Math.sin(x * 0.045) * 8 + Math.sin(x * 0.13 + 1) * 4 + (hash(x >> 3, 1) - 0.5) * 6;
    if (y > ridge) c = ramp(BUSH, 0.25 + (hash(x >> 2, y >> 2) - 0.5) * 0.35 + (x < 60 ? -0.1 : 0.08) - (y - ridge) / 120, x, y);
    const shore = 138 + Math.sin(x * 0.03) * 3;
    if (y > shore) c = ramp(SAND, 0.55 - (y - shore) / 80 + (hash(x >> 1, y) - 0.5) * 0.15, x, y);
    b[y * CW + x] = c;
  }
  // the setting sun behind her shoulder, a warm rim of light
  for (let y = 20; y < 70; y++) for (let x = 200; x < 290; x++) {
    const d = Math.hypot(x - 246, (y - 52) * 1.2);
    if (d < 30) b[y * CW + x] = mixc(b[y * CW + x], hx('#ffe0a0'), Math.max(0, 1 - d / 30) * 0.7);
  }
  return b;
}

export async function runNegotiation(rounds: NegRound[], extra: NegRound[]): Promise<void> {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const cu = openCloseup();
  const back = paintBack();
  const buf = cu.buf;
  let trust = 0, nerves = 55;
  let expr = 'angry', talk = 0, talkT = 0, blinkT = 2;
  let draw = 0; // 0..1 how far she's drawing back while you hesitate
  let lower = 0, lowerT = 0, shake = 0, shot = 0, flash = 0;
  let ended = false;
  cu.hint('Answer fast: <span class="key">1</span><span class="key">2</span><span class="key">3</span> or tap. Stay calm, be honest, no sudden moves.', 5000);

  const stop = loop((dt, t) => {
    if (cu.closed || ended) return false;
    talkT -= dt; blinkT -= dt;
    if (blinkT < -0.12) blinkT = 2 + Math.random() * 2.5;
    shake = Math.max(0, shake - dt * 2);
    flash = Math.max(0, flash - dt * 2.5);
    shot = Math.max(0, shot - dt);
    lower += (lowerT - lower) * Math.min(1, dt * 3);
    const nv = Math.max(0, Math.min(1, nerves / 100));
    const tremble = (0.4 + nv * 2.4 + draw * 1.5) * (1 - lower * 0.8);
    const jx = Math.round((Math.sin(t * 37) + Math.sin(t * 23.3)) * tremble * 0.5 + (Math.random() - 0.5) * shake * 8);
    const jy = Math.round((Math.cos(t * 31) * tremble * 0.4) + (Math.random() - 0.5) * shake * 6);
    buf.set(back);
    // Aroha: the HD bust scaled up to fill the frame, leaning into the aim
    const mouth: 0 | 1 | 2 = talkT > 0 ? ((Math.floor(t * 11) % 3) as 0 | 1 | 2) : 0;
    const p = renderAnimePortraitHD('aroha', expr, mouth, blinkT < 0);
    const sc = 1.5, pw = p.w * sc, ph = p.h * sc;
    const px0 = Math.round(CW / 2 - pw / 2 - 34 + jx * 0.4), py0 = Math.round(CH - ph + 8 + jy * 0.4 + lower * 6);
    for (let y = 0; y < ph; y++) {
      const Y = py0 + y;
      if (Y < 0 || Y >= CH) continue;
      const sy = Math.floor(y / sc);
      for (let x = 0; x < pw; x++) {
        const v = p.data[sy * p.w + Math.floor(x / sc)];
        if (v >>> 24) put(buf, px0 + x, Y, v);
      }
    }
    // sweat on her temple as her nerves climb
    if (nv > 0.6) for (let k = 0; k < 4; k++) put(buf, px0 + pw * 0.74, py0 + 44 + k + ((t * 20) % 8), hx(k < 1 ? '#e8f8ff' : '#8ac8ec'));
    // the slingshot: her fist round the fork right in front of the lens, bands back to the pouch at her cheek
    const fx = 238 + jx, fy = 160 + jy + lower * 110;
    const pull = 0.4 + draw * 0.6 - lower * 0.4;
    const pouch: [number, number] = [px0 + pw * 0.8 + (1 - pull) * 14, py0 + 100 + (1 - pull) * 10 + lower * 30];
    const tips: [number, number][] = [[fx - 30, fy - 70], [fx + 30, fy - 70]];
    // bands (thinner and paler the harder she pulls)
    const bw = 3.2 - pull * 1.6;
    for (const tp of tips) {
      const n = 60;
      for (let s = 0; s <= n; s++) {
        const f = s / n, x = tp[0] + (pouch[0] - tp[0]) * f, y = tp[1] + (pouch[1] - tp[1]) * f + Math.sin(f * Math.PI) * (1 - pull) * 8;
        const w = bw * (1 - f * 0.5);
        for (let q = -w; q <= w; q += 0.5) put(buf, x, y + q, q < -w + 0.8 ? BAND[3] : q > w - 0.8 ? BAND[0] : mixc(BAND[2], hx('#e8a080'), pull * 0.35));
      }
    }
    // pouch with the stone
    for (let y = -5; y <= 5; y++) for (let x = -7; x <= 7; x++) {
      const d = (x / 7) ** 2 + (y / 5) ** 2;
      if (d > 1) continue;
      const stone = (x / 4) ** 2 + ((y + 1) / 3.4) ** 2 < 1;
      put(buf, pouch[0] + x, pouch[1] + y, stone ? ramp(['#3a3a42', '#5a5a64', '#8a8a94', '#b8b8c0'].map(hx), 0.6 - x / 10 - y / 8, x, y) : d > 0.7 ? INK : ramp(['#3a2418', '#5a3a24', '#7a5232'].map(hx), 0.5 - y / 10, x, y));
    }
    // the fork: thick forked branch, big and close to camera, with bark and a lashing of flax
    const fork = (x: number, y: number) => {
      const lx = x - fx, ly = y - fy;
      // handle
      if (Math.abs(lx) < 9 + ly * 0.03 && ly > -26 && ly < 60) return 1;
      // two prongs curving out
      for (const s of [-1, 1]) {
        const t2 = (-ly - 22) / 50;
        if (t2 < 0 || t2 > 1) continue;
        const cx2 = s * (7 + 23 * Math.sin(t2 * Math.PI / 2));
        if (Math.abs(lx - cx2) < 6.5 - t2 * 2.5) return 2 + (s > 0 ? 1 : 0);
      }
      return 0;
    };
    for (let y = Math.max(0, Math.floor(fy - 80)); y < CH; y++) for (let x = Math.floor(fx - 44); x < fx + 44; x++) {
      const k = fork(x, y);
      if (!k) continue;
      const edge = !fork(x - 1, y) || !fork(x + 1, y) || !fork(x, y - 1);
      const grain = Math.sin(y * 0.6 + hash(x >> 2, 3) * 6) * 0.08;
      let c = edge ? INK : ramp(WOOD, 0.55 - (x - fx) / 40 + grain + (k === 3 ? -0.15 : 0), x, y);
      if (k === 1 && y > fy - 24 && y < fy - 16 && !edge) c = ramp(['#8a7040', '#b09058', '#d0b070'].map(hx), 0.5 + Math.sin(x * 0.9) * 0.3, x, y);
      put(buf, x, y, c);
    }
    // her fist round the handle: four wrapped fingers with knuckles, the thumb over the top
    for (let f = 0; f < 4; f++) {
      const y0 = fy - 8 + f * 8, w0 = 15 - Math.abs(f - 1.2) * 1.2;
      for (let y = 0; y < 8; y++) for (let x = -w0; x <= w0; x++) {
        const d = (x / w0) ** 2 + ((y - 3.5) / 4.2) ** 2;
        if (d > 1) continue;
        const X = fx + x, Y = y0 + y;
        put(buf, X, Y, d > 0.82 || y === 7 ? INK : ramp(SKIN, 0.66 - x / 36 - y / 16 + (x < -w0 + 5 && y < 3 ? 0.2 : 0), X, Y));
      }
    }
    for (let y = -4; y < 5; y++) for (let x = -16; x <= 6; x++) {
      const d = ((x + 5) / 11) ** 2 + (y / 4.4) ** 2;
      if (d > 1) continue;
      put(buf, fx + x, fy - 12 + y, d > 0.8 ? INK : ramp(SKIN, 0.7 - (x + 5) / 30 - y / 12, fx + x, fy - 12 + y));
    }
    // wristband with the taniko pattern
    for (let y = fy + 24; y < fy + 32; y++) for (let x = fx - 14; x <= fx + 14; x++) put(buf, x, y, (Math.floor((x - fx + 40) / 3) + Math.floor(y / 2)) % 2 ? hx('#a8342c') : hx('#1e1418'));
    // a warning shot: the stone whips past the camera, sand explodes
    if (shot > 0) {
      const k = 1 - shot;
      for (let i = 0; i < 40; i++) {
        const a = hash(i, 5) * Math.PI * 2, r = k * (40 + hash(i, 7) * 90);
        blend(buf, 160 + Math.cos(a) * r, 150 + Math.sin(a) * r * 0.4 - k * 30, hx('#e8c890'), 1 - k);
      }
    }
    // nerves: a red pulse creeping in from the edges, in time with her heartbeat
    const beat = Math.max(0, Math.sin(t * (4 + nv * 6))) ** 6 * nv;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const d = ((x - CW / 2) / (CW * 0.6)) ** 2 + ((y - CH / 2) / (CH * 0.62)) ** 2;
      if (d < 0.5) continue;
      const i = y * CW + x, v = buf[i], k = Math.min(0.6, (d - 0.5) * 0.9);
      let c = rgb(R(v) * (1 - k), G(v) * (1 - k * 1.1), B(v) * (1 - k * 1.1));
      if (nv > 0.4) c = mixc(c, hx('#a8141e'), Math.min(0.5, (d - 0.5) * (nv - 0.3) * 1.2 + beat * 0.25));
      buf[i] = c;
    }
    if (flash > 0) for (let i = 0; i < buf.length; i++) buf[i] = mixc(buf[i], 0xffffffff, flash * 0.8);
    cu.present();
    return true;
  });

  const say = async (text: string, e: string, ms = 0) => {
    expr = e;
    talkT = Math.min(1.8, text.length * 0.04);
    audio.play('dialogBlip' as never, { vol: 0.16, pitch: 1.35 });
    cu.say('Aroha', text, { color: '#8a4a24', ms: 60000, shout: e === 'angry' && nerves > 80 });
    await wait(ms || 500 + text.length * 22);
  };
  const reply = (text: string) => cu.say('Mori', text, { color: '#4a7a3a', right: true, ms: 60000 });

  const all = [...rounds];
  let i = 0, won = false;
  while (!won && !cu.closed) {
    const r = i < all.length ? all[i] : extra[(i - all.length) % extra.length];
    i++;
    await say(r.say, r.expr);
    const opts = shuffle(r.answers);
    const box = el('div', 'cu-ans', `<span class="nm">MORI</span>`);
    cu.wrap.appendChild(box);
    const picked = await new Promise<NegAnswer | null>(res => {
      let done = false;
      const finish = (a: NegAnswer | null) => { if (done) return; done = true; stopT(); window.removeEventListener('keydown', kd, true); res(a); };
      opts.forEach((a, k) => {
        const b = el('button', '', `<span class="key">${k + 1}</span>${a.t}`);
        b.addEventListener('click', () => finish(a));
        box.appendChild(b);
      });
      const kd = (e: KeyboardEvent) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= opts.length) { e.preventDefault(); e.stopPropagation(); finish(opts[n - 1]); } };
      window.addEventListener('keydown', kd, true);
      // hesitation: she draws the band back further; the rubber creaks
      let cr = 0;
      const stopT = loop((dt, t) => {
        draw = Math.min(1, t / r.time);
        cr -= dt;
        if (cr <= 0 && draw > 0.3) { cr = 0.5 - draw * 0.35; audio.play('woodCreak', { vol: 0.1 + draw * 0.25, pitch: 1.6 + draw * 0.6 }); }
        if (t >= r.time) { finish(null); return false; }
      });
    });
    box.remove();
    draw = 0;
    if (!picked) {
      nerves += 20;
      audio.play('wrong', { vol: 0.4 });
      shake = 0.4;
      await say('Say something! Why aren’t you saying anything?!', 'angry');
    } else {
      reply(picked.t);
      await wait(700);
      trust += picked.trust;
      nerves += picked.nerves;
      audio.play(picked.trust >= 15 ? 'fact' as never : picked.nerves > 15 ? 'wrong' : 'ui', { vol: 0.4 });
      if (picked.nerves > 15) shake = 0.5;
      lowerT = Math.max(0, Math.min(1, trust / 100)) * 0.55;
      await say(picked.reply, picked.rexpr);
    }
    if (nerves >= 100) {
      // warning shot: POP!
      audio.play('shipCrash' as never, { vol: 0.25, pitch: 2.2 });
      audio.play('thunderClose' as never, { vol: 0.2, pitch: 2.5 });
      shot = 1; flash = 1; shake = 1;
      const pop = el('div', 'cu-pop', 'POP!');
      cu.wrap.appendChild(pop);
      setTimeout(() => pop.remove(), 1100);
      await say('That was a WARNING. The next one isn’t going in the sand.', 'angry', 2400);
      cu.hint('She’s rattled. Start again, and keep calm.', 2600);
      trust = 0; nerves = 55; i = 0; lowerT = 0;
      continue;
    }
    if (trust >= 100) won = true;
  }
  // she lowers the slingshot all the way
  lowerT = 1.4;
  await say('...', 'neutral', 1400);
  ended = true;
  stop();
  await cu.close();
}
