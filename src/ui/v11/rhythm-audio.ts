// V11 the hue kiri's voice and its backing band, synthesised on the game's own buses (the music
// volume for the band, the sound volume for the notes Mori plays):
//   pluck      a Karplus-Strong string (a noise burst through a tuned, damped delay loop), rendered
//              once per pitch and cached, played through a body resonance, plus the serpent-skin
//              membrane: a soft low thump that drops in pitch, so it sounds half banjo, half drum
//   dud        a fluffed note: a dead, buzzing pluck and a slap on the skin
//   pahu       the wooden slit drum on the beat; tokere the bone clappers; a shaker of seeds
//   drone      a hummed root under everything (two detuned voices through a dark filter)

import { audio } from '../../core/audio';

interface G { ctx: AudioContext; sfxBus: GainNode; musicBus: GainNode; white: AudioBuffer; revShort?: GainNode }
export const graph = (): G | null => { const g = (audio as unknown as { g?: G | null }).g; return g && g.ctx.state === 'running' ? g : null; };
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const cache = new Map<number, AudioBuffer>();
function stringBuf(c: AudioContext, midi: number): AudioBuffer {
  const hit = cache.get(midi);
  if (hit) return hit;
  const sr = c.sampleRate, f = mtof(midi), dur = 1.6;
  const n = Math.floor(sr * dur), N = Math.max(2, Math.round(sr / f));
  const buf = c.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const ring = new Float32Array(N);
  // a bright pick near the bridge: noise, a little lowpassed
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.7; ring[i] = lp; }
  let idx = 0, prev = 0;
  const decay = 0.996 - Math.min(0.01, f / 60000);
  for (let i = 0; i < n; i++) {
    const cur = ring[idx];
    const nv = decay * 0.5 * (cur + prev);
    prev = cur;
    ring[idx] = nv;
    idx = (idx + 1) % N;
    d[i] = cur;
  }
  cache.set(midi, buf);
  return buf;
}

export class KiriSynth {
  private nodes: AudioNode[] = [];
  private drone: { g: GainNode; o: OscillatorNode[] } | null = null;
  /** the audio clock (seconds) or null when sound is off */
  now(): number | null { const g = graph(); return g ? g.ctx.currentTime : null; }

  pluck(midi: number, at = 0, vol = 0.5, bright = 1, music = false) {
    const g = graph();
    if (!g) return;
    const c = g.ctx, t = Math.max(c.currentTime, at || c.currentTime);
    const src = c.createBufferSource();
    src.buffer = stringBuf(c, midi);
    const body = c.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 260; body.Q.value = 1.4; body.gain.value = 6;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400 + bright * 2600;
    const env = c.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    src.connect(body).connect(hp).connect(tone).connect(env).connect(music ? g.musicBus : g.sfxBus);
    if (g.revShort) { const s = c.createGain(); s.gain.value = 0.25; env.connect(s).connect(g.revShort); }
    src.start(t);
    src.stop(t + 1.6);
    // the skin: a little drum under every note
    if (!music) this.thump(t, vol * 0.45, 110);
  }
  thump(t: number, vol: number, f0 = 120) {
    const g = graph();
    if (!g) return;
    const c = g.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.12);
    const e = c.createGain(); e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(e).connect(g.sfxBus);
    o.start(t); o.stop(t + 0.18);
  }
  /** a fluffed note: dead string buzz and a slap */
  dud(midi = 50) {
    const g = graph();
    if (!g) return;
    const c = g.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = stringBuf(c, midi);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const e = c.createGain(); e.gain.setValueAtTime(0.35, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(lp).connect(e).connect(g.sfxBus);
    src.start(t); src.stop(t + 0.2);
    this.noise(t, 0.12, 0.05, 1800, 'bandpass', g.sfxBus);
    this.thump(t, 0.2, 80);
  }
  private noise(t: number, vol: number, len: number, f: number, type: BiquadFilterType, bus: AudioNode) {
    const g = graph();
    if (!g) return;
    const c = g.ctx;
    const s = c.createBufferSource(); s.buffer = g.white;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = 1.2;
    const e = c.createGain(); e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(fl).connect(e).connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }
  /** the band: a slit drum, bone clappers, a shaker (on the music bus) */
  pahu(t: number, accent = 1) {
    const g = graph();
    if (!g) return;
    const c = g.ctx;
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(accent > 0.8 ? 150 : 190, t); o.frequency.exponentialRampToValueAtTime(95, t + 0.1);
    const e = c.createGain(); e.gain.setValueAtTime(0.32 * accent, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(e).connect(g.musicBus);
    o.start(t); o.stop(t + 0.25);
    this.noise(t, 0.08 * accent, 0.03, 1200, 'bandpass', g.musicBus);
  }
  tokere(t: number, vol = 0.12) { const g = graph(); if (g) this.noise(t, vol, 0.035, 3200, 'highpass', g.musicBus); }
  shaker(t: number, vol = 0.05) { const g = graph(); if (g) this.noise(t, vol, 0.06, 6000, 'highpass', g.musicBus); }
  /** a click for the count-in */
  count(t: number, hi: boolean) { const g = graph(); if (g) this.noise(t, hi ? 0.18 : 0.12, 0.03, hi ? 2600 : 1800, 'bandpass', g.musicBus); }

  droneOn(root: number) {
    const g = graph();
    if (!g || this.drone) return;
    const c = g.ctx;
    const gain = c.createGain(); gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.05, c.currentTime, 0.8);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const os: OscillatorNode[] = [];
    for (const [m, det] of [[root - 12, -6], [root - 12, 5], [root - 5, 0]] as [number, number][]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      const og = c.createGain(); og.gain.value = m === root - 5 ? 0.35 : 0.6;
      o.connect(og).connect(lp); o.start(); os.push(o);
    }
    lp.connect(gain).connect(g.musicBus);
    this.drone = { g: gain, o: os };
    this.nodes.push(lp, gain);
  }
  droneOff() {
    const g = graph(), d = this.drone;
    this.drone = null;
    if (!d) return;
    const t = g ? g.ctx.currentTime : 0;
    try { d.g.gain.setTargetAtTime(0, t, 0.3); } catch { /* gone */ }
    setTimeout(() => { for (const o of d.o) { try { o.stop(); } catch { /* stopped */ } } d.g.disconnect(); }, 1500);
  }
  stop() { this.droneOff(); }
}
