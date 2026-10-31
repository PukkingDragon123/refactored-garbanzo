// V12 Aunty Hana's guitar, synthesised on the game's own buses (src/core/audio.ts's graph, as the
// hue kiri does): an old steel-string acoustic.
//   note    a Karplus-Strong steel string: a noise burst shaped by where the pick hits (a comb), through
//           a tuned, slowly damped delay loop, rendered once per pitch and cached; then the guitar's
//           box: a low body resonance, a second air resonance, and a soft top
//   strum   a chord's strings one after another (down: low to high; up: the top four, high to low)
//   thunk   a palm-muted chuck; sour: a fluffed, out-of-tune chord; squeak: a finger sliding on a
//           wound string at a chord change
//   FireJam the guitar by the village fire at night: a strummed progression on a beat clock,
//           scheduled ahead on the audio clock (quiet when Mori is far away)

import { graph } from '../../v11/rhythm-audio';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** standard tuning, low E to high e (MIDI) */
export const OPEN = [40, 45, 50, 55, 59, 64];
/** open chord shapes: the note on each string (null: not played) */
export const CHORDS: Record<string, (number | null)[]> = {
  G: [43, 47, 50, 55, 59, 67],
  C: [null, 48, 52, 55, 60, 64],
  D: [null, null, 50, 57, 62, 66],
  Em: [40, 47, 52, 55, 59, 64],
  Am: [null, 45, 52, 57, 60, 64],
  E: [40, 47, 52, 56, 59, 64],
  A: [null, 45, 52, 57, 61, 64],
};
/** frets held for each chord (the chord hand's shape, for the close-up): [string, fret] */
export const SHAPES: Record<string, [number, number][]> = {
  G: [[0, 3], [1, 2], [5, 3]],
  C: [[1, 3], [2, 2], [4, 1]],
  D: [[3, 2], [4, 3], [5, 2]],
  Em: [[1, 2], [2, 2]],
  Am: [[2, 2], [3, 2], [4, 1]],
  E: [[1, 2], [2, 2], [3, 1]],
  A: [[2, 2], [3, 2], [4, 2]],
};

const cache = new Map<number, AudioBuffer>();
function steelBuf(c: AudioContext, midi: number): AudioBuffer {
  const hit = cache.get(midi);
  if (hit) return hit;
  const sr = c.sampleRate, f = mtof(midi), dur = 2.6;
  const n = Math.floor(sr * dur), N = Math.max(2, Math.round(sr / f));
  const buf = c.createBuffer(1, n, sr), d = buf.getChannelData(0);
  // the pick: a bright burst, combed at the plucking point (a fifth of the way along the string)
  const ex = new Float32Array(N), ring = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.6; ex[i] = lp; }
  const pick = Math.max(1, Math.round(N * 0.2));
  for (let i = 0; i < N; i++) ring[i] = ex[i] - 0.75 * ex[(i + pick) % N];
  let idx = 0, prev = 0;
  const decay = 0.9988 - Math.min(0.006, f / 80000);
  for (let i = 0; i < n; i++) {
    const cur = ring[idx];
    ring[idx] = decay * 0.5 * (cur + prev);
    prev = cur;
    idx = (idx + 1) % N;
    d[i] = cur * 0.9;
  }
  cache.set(midi, buf);
  return buf;
}

export interface Voice { stop(at?: number): void }
const NOVOICE: Voice = { stop() { /* silent */ } };

export class GuitarSynth {
  constructor(readonly bus: 'sfx' | 'music' = 'sfx') {}
  /** the audio clock (seconds) or null when sound is off */
  now(): number | null { const g = graph(); return g ? g.ctx.currentTime : null; }
  /** build the strings' buffers ahead (so the first strum doesn't hitch) */
  warm(midis: number[]) { const g = graph(); if (g) for (const m of midis) steelBuf(g.ctx, m); }

  note(midi: number, at = 0, vol = 0.5, o: { bright?: number; ring?: number } = {}): Voice {
    const g = graph();
    if (!g) return NOVOICE;
    const c = g.ctx, t = Math.max(c.currentTime, at || c.currentTime), ring = o.ring ?? 2.4;
    const src = c.createBufferSource();
    src.buffer = steelBuf(c, midi);
    const body = c.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 110; body.Q.value = 1.1; body.gain.value = 5;
    const air = c.createBiquadFilter(); air.type = 'peaking'; air.frequency.value = 240; air.Q.value = 1.4; air.gain.value = 3;
    const top = c.createBiquadFilter(); top.type = 'lowpass'; top.frequency.value = 2200 + (o.bright ?? 0.6) * 3200;
    const env = c.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.0008, t + ring);
    src.connect(body).connect(air).connect(top).connect(env).connect(this.bus === 'music' ? g.musicBus : g.sfxBus);
    if (g.revShort) { const s = c.createGain(); s.gain.value = 0.22; env.connect(s).connect(g.revShort); }
    src.start(t);
    src.stop(t + ring + 0.05);
    return {
      stop(at2?: number) {
        try {
          const s2 = Math.max(c.currentTime, at2 ?? c.currentTime);
          env.gain.cancelScheduledValues(s2);
          env.gain.setValueAtTime(Math.max(0.0008, env.gain.value), s2);
          env.gain.exponentialRampToValueAtTime(0.0005, s2 + 0.07);
          src.stop(s2 + 0.1);
        } catch { /* already gone */ }
      },
    };
  }

  /** strum a chord: down (low to high) or up (the top strings, high to low) */
  strum(chord: string, at = 0, vol = 0.45, dir: 'down' | 'up' = 'down', o: { spread?: number; ring?: number; bright?: number } = {}): Voice[] {
    const sh = CHORDS[chord] ?? CHORDS.G;
    const g = graph();
    if (!g) return [];
    const t = Math.max(g.ctx.currentTime, at || g.ctx.currentTime), sp = o.spread ?? 0.014;
    const order = dir === 'down' ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2];
    const out: Voice[] = [];
    order.forEach((s, i) => {
      const m = sh[s];
      if (m === null) return;
      out.push(this.note(m, t + i * sp * (0.85 + Math.random() * 0.3), vol * (dir === 'up' ? 0.7 : 1) * (0.85 + Math.random() * 0.2), { ring: o.ring, bright: (o.bright ?? 0.6) + (dir === 'up' ? 0.2 : 0) }));
    });
    return out;
  }

  private noise(t: number, vol: number, len: number, f: number, type: BiquadFilterType) {
    const g = graph();
    if (!g) return;
    const c = g.ctx;
    const s = c.createBufferSource(); s.buffer = g.white;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = 1.4;
    const e = c.createGain(); e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(fl).connect(e).connect(this.bus === 'music' ? g.musicBus : g.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }
  /** a palm-muted chuck */
  thunk(at = 0, vol = 0.3) {
    const g = graph();
    if (!g) return;
    const t = Math.max(g.ctx.currentTime, at || g.ctx.currentTime);
    this.noise(t, vol, 0.05, 900, 'bandpass');
    const o = g.ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.06);
    const e = g.ctx.createGain(); e.gain.setValueAtTime(vol * 0.6, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(e).connect(g.sfxBus); o.start(t); o.stop(t + 0.1);
  }
  /** a fluffed chord: strings a little out, a buzz */
  sour(at = 0, vol = 0.35) {
    const g = graph();
    if (!g) return;
    const t = Math.max(g.ctx.currentTime, at || g.ctx.currentTime);
    for (const [m, i] of [[47, 0], [52, 1], [56, 2], [61, 3]] as [number, number][]) this.note(m + (i % 2 ? 1 : 0), t + i * 0.016, vol * 0.7, { ring: 0.5, bright: 0.2 });
    this.noise(t, vol * 0.5, 0.12, 2400, 'bandpass');
  }
  /** a finger sliding along a wound string */
  squeak(at = 0, vol = 0.08) {
    const g = graph();
    if (!g) return;
    const t = Math.max(g.ctx.currentTime, at || g.ctx.currentTime);
    this.noise(t, vol, 0.09, 3600, 'bandpass');
  }
}

/** the guitar by the fire: a strummed progression, scheduled a little ahead on the audio clock */
export class FireJam {
  private s = new GuitarSynth('sfx');
  private next = 0;
  private i = 0;
  bpm = 84;
  prog = ['G', 'C', 'D', 'G', 'Em', 'C', 'D', 'D'];
  pattern = 'D.DU.UDU';
  /** the chord being played now (for the singers) */
  chord = 'G';
  /** schedule what falls in the next moment (vol 0 keeps time silently) */
  tick(vol: number) {
    const now = this.s.now();
    if (now === null) return;
    if (!this.next || this.next < now - 0.4) this.next = now + 0.08;
    const e = 60 / this.bpm / 2;
    while (this.next < now + 0.25) {
      const bar = Math.floor(this.i / 8) % this.prog.length, ch = this.pattern[this.i % 8];
      this.chord = this.prog[bar];
      if (vol > 0.01 && ch !== '.') this.s.strum(this.chord, this.next, vol * (ch === 'D' ? 0.5 : 0.3), ch === 'D' ? 'down' : 'up', { ring: 1.6, bright: 0.45 });
      this.next += e;
      this.i++;
    }
  }
  /** beat position (0..1 through the bar) */
  get bar01() { return (this.i % 8) / 8; }
}
