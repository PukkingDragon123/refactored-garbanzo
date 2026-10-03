// V11 predators: synthesized sounds for the slingshot, the grenades, the mud and the Cerebral Tiger.
// They play through the game's own audio graph (core/audio.ts: the world sfx bus and its reverb send),
// so the settings' volume, the underwater filter and setMuffle all apply. Never throws.

import { audio } from '../../core/audio';
import { game } from '../game';

interface Graph {
  ctx: AudioContext;
  sfxBus: GainNode;
  wSendS: AudioNode;
  wSendL: AudioNode;
  ambBase: GainNode;
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
}
const graph = (): Graph | null => {
  const g = (audio as unknown as { g: Graph | null }).g;
  return g && g.ctx.state === 'running' ? g : null;
};

export type Sfx11 =
  | 'bandStretch' | 'bandSnap' | 'whiz' | 'thwack' | 'tick' | 'fizz' | 'poof' | 'crack' | 'glorp' | 'mudBurst'
  | 'tigerRoar' | 'tigerGrowl' | 'chuff' | 'sneeze' | 'sting' | 'thud' | 'scoop' | 'pepper' | 'flashBang';

interface V { out: GainNode; nodes: AudioNode[]; g: Graph }
function voice(g: Graph, vol: number, pan: number, life: number, send = 0.15, long = false): V {
  const ctx = g.ctx;
  const out = ctx.createGain();
  out.gain.value = vol;
  const nodes: AudioNode[] = [out];
  if (pan && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(p); p.connect(g.sfxBus); nodes.push(p);
  } else out.connect(g.sfxBus);
  if (send > 0) {
    const s = ctx.createGain();
    s.gain.value = send;
    out.connect(s); s.connect(long ? g.wSendL : g.wSendS); nodes.push(s);
  }
  setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch { /* */ } } }, life * 1000 + 400);
  return { out, nodes, g };
}
function gainN(v: V, value: number) { const n = v.g.ctx.createGain(); n.gain.value = value; v.nodes.push(n); return n; }
function env(v: V, t: number, a: number, peak: number, d: number, hold = 0) {
  const n = gainN(v, 0);
  const p = n.gain, pk = Math.max(0.0002, peak);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + Math.max(0.001, a));
  if (hold > 0) p.setValueAtTime(pk, t + a + hold);
  p.exponentialRampToValueAtTime(0.0001, t + a + hold + Math.max(0.005, d));
  p.setValueAtTime(0, t + a + hold + d + 0.01);
  return n;
}
function osc(v: V, type: OscillatorType, f: number, t: number, end: number) {
  const o = v.g.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, f), t);
  o.start(t); o.stop(end);
  v.nodes.push(o);
  return o;
}
function noise(v: V, kind: 'white' | 'pink' | 'brown', t: number, end: number) {
  const s = v.g.ctx.createBufferSource();
  s.buffer = v.g[kind];
  s.loop = true;
  s.start(t, Math.random() * Math.max(0, s.buffer.duration - 0.5));
  s.stop(end);
  v.nodes.push(s);
  return s;
}
function filt(v: V, type: BiquadFilterType, f: number, Q = 0.7) {
  const n = v.g.ctx.createBiquadFilter();
  n.type = type; n.frequency.value = f; n.Q.value = Q;
  v.nodes.push(n);
  return n;
}
/** tone with an envelope and an optional glide */
function tone(v: V, type: OscillatorType, f: number, f2: number | null, t: number, a: number, d: number, vol: number, hold = 0, to: AudioNode = v.out) {
  const end = t + a + hold + d + 0.05;
  const o = osc(v, type, f, t, end);
  if (f2 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + a + hold + d);
  const e = env(v, t, a, vol, d, hold);
  o.connect(e); e.connect(to);
  return o;
}
/** filtered noise burst with an optional filter sweep */
function burst(v: V, kind: 'white' | 'pink' | 'brown', t: number, a: number, d: number, vol: number, ft: BiquadFilterType, f: number, f2: number | null = null, Q = 0.8, hold = 0, to: AudioNode = v.out) {
  const end = t + a + hold + d + 0.05;
  const s = noise(v, kind, t, end);
  const fl = filt(v, ft, f, Q);
  if (f2 !== null) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + a + hold + d);
  const e = env(v, t, a, vol, d, hold);
  s.connect(fl); fl.connect(e); e.connect(to);
  return fl;
}

const last = new Map<string, number>();
const THROTTLE: Partial<Record<Sfx11, number>> = { tick: 0.04, glorp: 0.05, thwack: 0.03, crack: 0.02, chuff: 0.2 };

/**
 * Play a predator sound. x (world) pans it and fades it with distance from the camera like the field
 * scenes' sfx; pitch < 1 is bigger / slower.
 */
export function sfx11(name: Sfx11, o: { x?: number; vol?: number; pitch?: number; delay?: number } = {}): void {
  const g = graph();
  if (!g) return;
  try {
    let vol = o.vol ?? 1, pan = 0;
    if (o.x !== undefined) {
      const st = (game.scene as unknown as { st?: { cam: { x: number } } } | null)?.st;
      if (st) {
        const d = o.x - st.cam.x;
        vol *= Math.max(0, 1 - Math.abs(d) / 600);
        pan = Math.max(-1, Math.min(1, d / 320));
      }
    }
    if (vol <= 0.01) return;
    const now = g.ctx.currentTime, t = now + 0.005 + (o.delay ?? 0);
    const th = THROTTLE[name];
    if (th !== undefined) {
      const l = last.get(name) ?? -1;
      if (now - l < th) return;
      last.set(name, now);
    }
    const p = o.pitch ?? 1;
    play(g, name, vol, pan, t, p);
  } catch { /* never throw from audio */ }
}

function play(g: Graph, name: Sfx11, vol: number, pan: number, t: number, p: number) {
  switch (name) {
    case 'bandStretch': {
      // a rubbery creak rising as the band comes back
      const v = voice(g, 0.16 * vol, pan, 0.6, 0.05);
      const o = osc(v, 'sawtooth', 85 * p, t, t + 0.45);
      o.frequency.linearRampToValueAtTime(120 * p, t + 0.4);
      const bp = filt(v, 'bandpass', 700 * p, 7);
      bp.frequency.exponentialRampToValueAtTime(1500 * p, t + 0.4);
      const am = gainN(v, 0.6);
      const lfo = osc(v, 'square', 32, t, t + 0.45);
      const lg = gainN(v, 0.4);
      lfo.connect(lg); lg.connect(am.gain);
      const e = env(v, t, 0.06, 1, 0.12, 0.22);
      o.connect(bp); bp.connect(am); am.connect(e); e.connect(v.out);
      break;
    }
    case 'bandSnap': {
      // thwip: the band slapping forward, a little twang, a soft thump
      const v = voice(g, 0.5 * vol, pan, 0.5, 0.1);
      burst(v, 'white', t, 0.001, 0.045, 0.9, 'bandpass', 2600 * p, 1400 * p, 1.4);
      const tw = tone(v, 'triangle', 340 * p, 300 * p, t, 0.002, 0.16, 0.35);
      const vib = osc(v, 'sine', 38, t, t + 0.2);
      const vg = gainN(v, 22);
      vib.connect(vg); vg.connect(tw.frequency);
      tone(v, 'sine', 150 * p, 60, t, 0.002, 0.06, 0.5);
      break;
    }
    case 'whiz': {
      const v = voice(g, 0.12 * vol, pan, 0.4, 0.04);
      burst(v, 'white', t, 0.02, 0.22, 1, 'bandpass', 3400 * p, 1300 * p, 3);
      break;
    }
    case 'thwack': {
      // a pebble smacking into a hide: dull thud and a crisp click
      const v = voice(g, 0.7 * vol, pan, 0.4, 0.12);
      tone(v, 'sine', 190 * p, 70 * p, t, 0.002, 0.1, 1);
      burst(v, 'pink', t, 0.001, 0.06, 0.8, 'lowpass', 1100 * p);
      burst(v, 'white', t, 0.0005, 0.012, 0.5, 'highpass', 3500);
      break;
    }
    case 'tick': {
      const v = voice(g, 0.22 * vol, pan, 0.3, 0.08);
      tone(v, 'triangle', 2100 * p, 1600 * p, t, 0.001, 0.025, 0.5);
      burst(v, 'white', t, 0.0005, 0.02, 0.6, 'highpass', 2500 * p);
      break;
    }
    case 'scoop': {
      // a handful of pebbles: a little rattle
      const v = voice(g, 0.3 * vol, pan, 0.6, 0.05);
      for (let i = 0; i < 6; i++) {
        const ti = t + i * 0.035 + Math.random() * 0.02;
        tone(v, 'triangle', (1600 + Math.random() * 900) * p, null, ti, 0.001, 0.02, 0.25);
      }
      burst(v, 'pink', t, 0.01, 0.12, 0.3, 'bandpass', 1800 * p, null, 1);
      break;
    }
    case 'fizz': {
      // the fuse: crackling hiss
      const v = voice(g, 0.18 * vol, pan, 1.1, 0.05);
      const f = burst(v, 'white', t, 0.02, 0.4, 1, 'highpass', 4200, null, 0.7, 0.4);
      void f;
      for (let i = 0; i < 9; i++) tone(v, 'square', 2500 + Math.random() * 3000, null, t + Math.random() * 0.8, 0.001, 0.008, 0.15);
      break;
    }
    case 'poof': {
      // a smoke bomb: a fat, soft fwump
      const v = voice(g, 0.6 * vol, pan, 1, 0.3, true);
      burst(v, 'pink', t, 0.005, 0.5, 1, 'lowpass', 1400 * p, 180, 0.9);
      tone(v, 'sine', 85 * p, 38, t, 0.004, 0.32, 0.9);
      burst(v, 'white', t + 0.02, 0.05, 0.4, 0.25, 'bandpass', 900 * p, 400, 0.8);
      break;
    }
    case 'pepper': {
      // dust hissing out
      const v = voice(g, 0.3 * vol, pan, 1.2, 0.2);
      burst(v, 'white', t, 0.04, 0.7, 0.8, 'bandpass', 5200 * p, 2400 * p, 1.2);
      break;
    }
    case 'crack': {
      // a firecracker: one sharp bang
      const v = voice(g, 0.55 * vol, pan, 0.5, 0.25);
      burst(v, 'white', t, 0.0005, 0.03, 1, 'highpass', 900 * p);
      tone(v, 'sine', 320 * p, 90, t, 0.001, 0.05, 0.7);
      burst(v, 'pink', t + 0.005, 0.001, 0.12, 0.3, 'lowpass', 2500, 600);
      break;
    }
    case 'flashBang': {
      // a string of crackers
      for (let i = 0; i < 7; i++) play(g, 'crack', vol * (0.6 + Math.random() * 0.4), pan + (Math.random() - 0.5) * 0.4, t + i * (0.05 + Math.random() * 0.09), p * (0.85 + Math.random() * 0.3));
      break;
    }
    case 'glorp': {
      // a mud bubble
      const v = voice(g, 0.28 * vol, pan, 0.3, 0.1);
      const lp = filt(v, 'lowpass', 1200 * p, 2);
      tone(v, 'sine', 170 * p, 560 * p, t, 0.003, 0.07, 1, 0, lp);
      lp.connect(v.out);
      break;
    }
    case 'mudBurst': {
      // the wallow exploding
      const v = voice(g, 1 * vol, pan, 1.8, 0.35, true);
      burst(v, 'brown', t, 0.01, 0.9, 1, 'lowpass', 2400 * p, 260, 0.8);
      burst(v, 'pink', t, 0.005, 0.5, 0.6, 'bandpass', 1300 * p, 500, 0.7);
      tone(v, 'sine', 62 * p, 30, t, 0.005, 0.7, 1);
      for (let i = 0; i < 10; i++) {
        const ti = t + 0.15 + Math.random() * 0.8;
        const lp = filt(v, 'lowpass', 900, 1.5);
        tone(v, 'sine', (150 + Math.random() * 120) * p, (300 + Math.random() * 300) * p, ti, 0.003, 0.06, 0.35, 0, lp);
        lp.connect(v.out);
      }
      break;
    }
    case 'tigerRoar': {
      // the engine's roar, much lower, with the dome's sub-bass you feel in your feet and a rasp on top
      audio.play('roar', { vol: Math.min(4, 1.1 * vol), pitch: 0.62 * p, pan });
      const v = voice(g, 0.75 * vol, pan, 2.6, 0.3, true);
      tone(v, 'sine', 44 * p, 34 * p, t, 0.25, 0.9, 1, 0.7);
      const rasp = osc(v, 'sawtooth', 72 * p, t, t + 2);
      rasp.frequency.exponentialRampToValueAtTime(52 * p, t + 1.8);
      const bp = filt(v, 'bandpass', 620 * p, 2.2);
      bp.frequency.exponentialRampToValueAtTime(380 * p, t + 1.8);
      const am = gainN(v, 0.6);
      const l = osc(v, 'sine', 23, t, t + 2);
      const lg = gainN(v, 0.4);
      l.connect(lg); lg.connect(am.gain);
      const e = env(v, t, 0.15, 0.55, 0.8, 0.8);
      rasp.connect(bp); bp.connect(am); am.connect(e); e.connect(v.out);
      break;
    }
    case 'tigerGrowl': {
      const v = voice(g, 0.45 * vol, pan, 1.6, 0.2);
      const o = osc(v, 'sawtooth', 50 * p, t, t + 1.3);
      const lp = filt(v, 'lowpass', 340 * p, 1.5);
      const am = gainN(v, 0.6);
      const l = osc(v, 'sine', 17, t, t + 1.3);
      const lg = gainN(v, 0.4);
      l.connect(lg); lg.connect(am.gain);
      const e = env(v, t, 0.2, 1, 0.5, 0.5);
      o.connect(lp); lp.connect(am); am.connect(e); e.connect(v.out);
      burst(v, 'brown', t, 0.2, 0.6, 0.4, 'lowpass', 500 * p, null, 1, 0.3);
      break;
    }
    case 'chuff': {
      const v = voice(g, 0.32 * vol, pan, 0.6, 0.1);
      burst(v, 'pink', t, 0.01, 0.12, 1, 'bandpass', 650 * p, 400 * p, 1.4);
      burst(v, 'pink', t + 0.16, 0.01, 0.1, 0.7, 'bandpass', 600 * p, 380 * p, 1.4);
      break;
    }
    case 'sneeze': {
      // haa... CHOO (a peppered tiger)
      const v = voice(g, 0.55 * vol, pan, 1.1, 0.2);
      burst(v, 'pink', t, 0.25, 0.05, 0.4, 'bandpass', 900 * p, 1400 * p, 1.2);
      burst(v, 'white', t + 0.32, 0.003, 0.18, 1, 'bandpass', 1800 * p, 700 * p, 0.9);
      tone(v, 'sawtooth', 160 * p, 70 * p, t + 0.32, 0.003, 0.15, 0.3);
      break;
    }
    case 'sting': {
      // the name card's stab: a swell, a low boom and a dark, brassy chord
      const v = voice(g, 0.6 * vol, pan, 2.6, 0.4, true);
      burst(v, 'white', t, 0.3, 0.03, 0.35, 'highpass', 2500, 7000, 0.7);
      const t1 = t + 0.32;
      tone(v, 'sine', 52, 30, t1, 0.004, 1.4, 1);
      const lp = filt(v, 'lowpass', 1600, 0.9);
      lp.frequency.setValueAtTime(1600, t1);
      lp.frequency.exponentialRampToValueAtTime(380, t1 + 1.4);
      for (const f of [110, 116.5, 164.8, 220]) tone(v, 'sawtooth', f * p, null, t1, 0.01, 1.3, 0.22, 0.1, lp);
      lp.connect(v.out);
      burst(v, 'pink', t1, 0.002, 0.6, 0.4, 'lowpass', 900, 200);
      break;
    }
    case 'thud': {
      const v = voice(g, 0.6 * vol, pan, 0.6, 0.1);
      tone(v, 'sine', 95 * p, 42, t, 0.003, 0.16, 1);
      burst(v, 'pink', t, 0.003, 0.14, 0.7, 'lowpass', 450 * p);
      break;
    }
  }
}

// ------------------------------------------------------------------ the hush: the forest goes quiet

let hushPrev: number | null = null;
/** duck the ambience (birds and insects go quiet) or bring it back */
export function hush(on: boolean, secs = 1.4): void {
  const g = graph();
  if (!g) return;
  try {
    const p = g.ambBase.gain, now = g.ctx.currentTime;
    if (on) {
      if (hushPrev === null) hushPrev = p.value || 1;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(0.06, now + secs);
    } else {
      const to = hushPrev ?? 1;
      hushPrev = null;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(to, now + secs);
    }
  } catch { /* */ }
}
