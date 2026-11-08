// V12 the weapon belt's sounds, synthesized in the same style as the predators' (predators-sfx.ts) and
// played through the game's own audio graph (the world sfx bus and its reverb send), so the settings'
// volume, the underwater filter and setMuffle all apply. Never throws.
//
//   whirl      the bolas whirling overhead (one turn; the belt repeats it)
//   wrap       the bolas wrapping round legs: cords slapping, stones knocking
//   flareShot  the flare pistol: a hollow pop, a fizzing rush
//   flareBurn  a burning flare on the ground: a sputtering hiss (short; the flare repeats it)
//   bangerPop  one bear banger: a sharp crack with a papery tail
//   netShot    the net launcher: a CO2 thump and the net whipping open
//   netSnap    the net landing: cords and weights slapping down
//   tranqShot  the dart rifle: a dry pfft and the bolt's clack
//   dartHit    a dart going in: a little thock
//   bolt       working the bolt (reloading)
//   spray      a burst of bear spray: a hard hiss
//   snore      a predator asleep (deep, slow)
//   click      empty: the dry click of nothing

import { audio } from '../../core/audio';
import { game } from '../game';

interface Graph { ctx: AudioContext; sfxBus: GainNode; wSendS: AudioNode; wSendL: AudioNode; white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer }
const graph = (): Graph | null => {
  const g = (audio as unknown as { g: Graph | null }).g;
  return g && g.ctx.state === 'running' ? g : null;
};

export type SfxArm = 'whirl' | 'wrap' | 'flareShot' | 'flareBurn' | 'bangerPop' | 'netShot' | 'netSnap' | 'tranqShot' | 'dartHit' | 'bolt' | 'spray' | 'snore' | 'click';

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
function tone(v: V, type: OscillatorType, f: number, f2: number | null, t: number, a: number, d: number, vol: number, hold = 0, to: AudioNode = v.out) {
  const end = t + a + hold + d + 0.05;
  const o = osc(v, type, f, t, end);
  if (f2 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + a + hold + d);
  const e = env(v, t, a, vol, d, hold);
  o.connect(e); e.connect(to);
  return o;
}
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
const THROTTLE: Partial<Record<SfxArm, number>> = { bangerPop: 0.03, flareBurn: 0.2, snore: 1.2, whirl: 0.12 };

/** play one; x (world) pans and fades it with distance from the camera, pitch < 1 is bigger */
export function sfxArm(name: SfxArm, o: { x?: number; vol?: number; pitch?: number; delay?: number } = {}): void {
  const g = graph();
  if (!g) return;
  try {
    let vol = o.vol ?? 1, pan = 0;
    if (o.x !== undefined) {
      const st = (game.scene as unknown as { st?: { cam: { x: number } } } | null)?.st;
      if (st) {
        const d = o.x - st.cam.x;
        vol *= Math.max(0, 1 - Math.abs(d) / 640);
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
    play(g, name, vol, pan, t, o.pitch ?? 1);
  } catch { /* never throw from audio */ }
}

function play(g: Graph, name: SfxArm, vol: number, pan: number, t: number, p: number) {
  switch (name) {
    case 'whirl': {
      // whup: cords cutting the air, a doppler swell
      const v = voice(g, 0.22 * vol, pan, 0.4, 0.05);
      burst(v, 'white', t, 0.06, 0.12, 1, 'bandpass', 700 * p, 1900 * p, 2.2);
      tone(v, 'sine', 120 * p, 180 * p, t, 0.05, 0.1, 0.25);
      break;
    }
    case 'wrap': {
      // cords slapping round, then the stones knocking together
      const v = voice(g, 0.6 * vol, pan, 0.8, 0.12);
      for (let i = 0; i < 3; i++) burst(v, 'white', t + i * 0.05, 0.002, 0.05, 0.7, 'bandpass', (1800 - i * 300) * p, 900, 1.6);
      for (let i = 0; i < 3; i++) tone(v, 'triangle', (900 + Math.random() * 400) * p, 700 * p, t + 0.16 + i * 0.07, 0.001, 0.05, 0.5);
      tone(v, 'sine', 140 * p, 70, t + 0.12, 0.003, 0.12, 0.6);
      break;
    }
    case 'flareShot': {
      // a hollow pop (a fat cartridge, not a gunshot), then the flare fizzing away
      const v = voice(g, 0.75 * vol, pan, 1.6, 0.3, true);
      burst(v, 'pink', t, 0.001, 0.1, 1, 'lowpass', 2200 * p, 400, 0.9);
      tone(v, 'sine', 180 * p, 60, t, 0.002, 0.12, 0.9);
      burst(v, 'white', t + 0.04, 0.05, 0.9, 0.5, 'bandpass', 3800 * p, 1800 * p, 1.1);
      for (let i = 0; i < 8; i++) tone(v, 'square', 2600 + Math.random() * 2600, null, t + 0.05 + Math.random() * 0.8, 0.001, 0.008, 0.12);
      break;
    }
    case 'flareBurn': {
      const v = voice(g, 0.16 * vol, pan, 0.8, 0.08);
      burst(v, 'white', t, 0.03, 0.35, 0.8, 'bandpass', 3000 * p, 2400 * p, 0.8, 0.2);
      for (let i = 0; i < 4; i++) tone(v, 'square', 1800 + Math.random() * 3000, null, t + Math.random() * 0.5, 0.001, 0.006, 0.12);
      break;
    }
    case 'bangerPop': {
      // a fat firecracker: a crack, the paper ripping, a short boom under it
      const v = voice(g, 0.7 * vol, pan, 0.6, 0.3, true);
      burst(v, 'white', t, 0.0005, 0.025, 1, 'highpass', 1200 * p);
      tone(v, 'sine', 260 * p, 70, t, 0.001, 0.08, 0.9);
      burst(v, 'pink', t + 0.004, 0.001, 0.18, 0.35, 'lowpass', 3000 * p, 500);
      break;
    }
    case 'netShot': {
      // the CO2 charge: a deep thump and a gassy whoosh, then the net cracking open
      const v = voice(g, 0.7 * vol, pan, 1, 0.2);
      tone(v, 'sine', 110 * p, 45, t, 0.002, 0.14, 1);
      burst(v, 'white', t, 0.002, 0.3, 0.7, 'lowpass', 5000 * p, 900, 0.7);
      for (let i = 0; i < 4; i++) burst(v, 'white', t + 0.12 + i * 0.03, 0.001, 0.03, 0.4, 'bandpass', 2400 * p, null, 2);
      break;
    }
    case 'netSnap': {
      const v = voice(g, 0.5 * vol, pan, 0.6, 0.1);
      for (let i = 0; i < 5; i++) burst(v, 'pink', t + i * 0.025, 0.001, 0.04, 0.6, 'bandpass', (1200 + i * 200) * p, null, 1.2);
      for (let i = 0; i < 4; i++) tone(v, 'sine', 160 * p, 70, t + 0.05 + i * 0.04, 0.002, 0.07, 0.5);
      break;
    }
    case 'tranqShot': {
      // pfft: a dry puff of gas, a tiny ring of the barrel
      const v = voice(g, 0.6 * vol, pan, 0.6, 0.12);
      burst(v, 'white', t, 0.001, 0.09, 1, 'bandpass', 1500 * p, 600 * p, 0.9);
      tone(v, 'triangle', 1900 * p, 1700 * p, t, 0.001, 0.12, 0.12);
      tone(v, 'sine', 90 * p, 50, t, 0.001, 0.05, 0.5);
      break;
    }
    case 'dartHit': {
      const v = voice(g, 0.45 * vol, pan, 0.4, 0.08);
      tone(v, 'sine', 420 * p, 180 * p, t, 0.001, 0.05, 0.8);
      burst(v, 'white', t, 0.0005, 0.015, 0.4, 'highpass', 3000);
      break;
    }
    case 'bolt': {
      // clack-clack: the bolt back and home
      const v = voice(g, 0.4 * vol, pan, 0.5, 0.05);
      for (const [dt, f] of [[0, 2600], [0.13, 2100]] as [number, number][]) {
        burst(v, 'white', t + dt, 0.0005, 0.02, 0.9, 'bandpass', f * p, null, 3);
        tone(v, 'triangle', f * 0.6 * p, null, t + dt, 0.0005, 0.02, 0.3);
      }
      break;
    }
    case 'spray': {
      // a hard aerosol hiss with a little sputter at the end
      const v = voice(g, 0.5 * vol, pan, 1.1, 0.1);
      burst(v, 'white', t, 0.01, 0.2, 1, 'highpass', 3500 * p, 2600 * p, 0.7, 0.5);
      burst(v, 'pink', t, 0.01, 0.2, 0.3, 'bandpass', 1400 * p, null, 1, 0.45);
      for (let i = 0; i < 3; i++) burst(v, 'white', t + 0.62 + i * 0.05, 0.002, 0.03, 0.5, 'highpass', 3000);
      break;
    }
    case 'snore': {
      // a big slow snore: a rumble in, a whistle out
      const v = voice(g, 0.35 * vol, pan, 2.4, 0.1);
      const o = osc(v, 'sawtooth', 48 * p, t, t + 1.2);
      const lp = filt(v, 'lowpass', 300 * p, 1.4);
      const e = env(v, t, 0.5, 1, 0.5, 0.2);
      o.connect(lp); lp.connect(e); e.connect(v.out);
      burst(v, 'pink', t, 0.5, 0.4, 0.4, 'bandpass', 380 * p, 260 * p, 1.6, 0.2);
      tone(v, 'sine', 900 * p, 700 * p, t + 1.3, 0.2, 0.5, 0.08);
      break;
    }
    case 'click': {
      const v = voice(g, 0.3 * vol, pan, 0.2, 0);
      burst(v, 'white', t, 0.0005, 0.012, 0.8, 'bandpass', 3200 * p, null, 4);
      break;
    }
  }
}
