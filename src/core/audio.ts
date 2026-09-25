/**
 * Procedural audio for Project Zealandia.
 *
 * Everything is synthesized with the Web Audio API: no audio files, no deps.
 *
 * Graph:
 *   ambience layers ─┐
 *   ambient events ──┴─ ambBus ─┐
 *   world sfx ────────── sfxBus ─┴─ worldFilter (underwater lowpass) ─┐
 *   music sessions ──── musicBus ── musicFilter ───────────────────────┤
 *   ui sfx ───────────── uiBus ────────────────────────────────────────┤
 *   voice sends ─ revShort/revLong ─ lowpass ─ convolver ──────────────┴─ master ─ compressor ─ out
 */

export type Ambience = 'camp' | 'forest' | 'canopy' | 'falls' | 'mangrove' | 'coast' | 'underwater' | 'ocean' | 'storm' | 'none';
export type Sfx =
  | 'shutter' | 'focus' | 'zoom' | 'recStart' | 'recStop' | 'step' | 'stepSoft' | 'jump' | 'land'
  | 'ui' | 'uiBack' | 'uiOpen' | 'discover' | 'fact' | 'star' | 'coin' | 'place' | 'hiss' | 'roar'
  | 'splash' | 'rustle' | 'birdCall' | 'chirp' | 'engine' | 'thunder' | 'alert' | 'wrong' | 'pageTurn'
  | 'bubble' | 'wingFlap' | 'croc' | 'dialogBlip' | 'whoosh';
export type Music = 'title' | 'camp' | 'explore' | 'night' | 'tension' | 'wonder' | 'none';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const randi = (a: number, b: number): number => Math.floor(a + Math.random() * (b - a + 1));
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)] as T;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => (Number.isFinite(v) ? clamp(v, 0, 1) : 0);

type NoiseKind = 'white' | 'pink' | 'brown';
type Curve = WaveShaperNode['curve'];

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  worldFilter: BiquadFilterNode;
  musicFilter: BiquadFilterNode;
  revFilters: BiquadFilterNode[];
  musicBus: GainNode;
  sfxBus: GainNode;
  uiBus: GainNode;
  ambBus: GainNode;
  ambEvents: GainNode;
  revShort: GainNode;
  revLong: GainNode;
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
  curve: Curve;
}

/** A one-shot group of nodes that all get disconnected after `life` seconds. */
interface Voice {
  out: GainNode;
  nodes: AudioNode[];
}

/** A continuous bed (ambience layer, drone). */
interface Layer {
  out: GainNode;
  nodes: AudioNode[];
  srcs: AudioScheduledSourceNode[];
}

interface AmbEvent {
  fn: () => void;
  min: number;
  max: number;
  next: number;
}

interface ToneOpts {
  type?: OscillatorType;
  f: number;
  /** end frequency (exponential glide over `glide` or whole note) */
  f2?: number;
  glide?: number;
  /** multi-point pitch contour: [timeOffset, freq][] */
  pts?: [number, number][];
  t: number;
  a?: number;
  hold?: number;
  d: number;
  vol: number;
  to?: AudioNode;
  fm?: { ratio: number; index: number; decay?: number };
  detune?: number;
}

interface BurstOpts {
  noise?: NoiseKind;
  t: number;
  a?: number;
  hold?: number;
  d: number;
  vol: number;
  ft?: BiquadFilterType;
  f?: number;
  f2?: number;
  Q?: number;
  to?: AudioNode;
}

// ---------------------------------------------------------------------------
// Music definitions
// ---------------------------------------------------------------------------

type Inst = 'pluck' | 'harp' | 'flute' | 'bell';

interface Chord {
  root: number;
  notes: number[];
}

interface MusicDef {
  bpm: number;
  /** steps per beat */
  sub: number;
  /** steps per bar */
  bar: number;
  chordBars: number;
  swing: number;
  chords: Chord[];
  scale: number[];
  lead: Inst | null;
  leadVol: number;
  leadDensity: number;
  leadLen: [number, number];
  padVol: number;
  padCut: number;
  padAttack: number;
  bassVol: number;
  bassSteps: number[];
  arp: Inst | null;
  arpVol: number;
  arpEvery: number;
  arpProb: number;
  arpShift: number;
  arpMode: 'updown' | 'random';
  osti?: number[];
  ostiVol?: number;
  long: boolean;
  send: number;
  fadeIn: number;
}

interface MusicState {
  kind: Music;
  def: MusicDef;
  out: GainNode;
  step: number;
  next: number;
  deg: number;
  hold: number;
  rest: number;
  phrase: number;
  chord: Chord;
  arpI: number;
  arpDir: number;
}

const C = (root: number, notes: number[]): Chord => ({ root, notes });

const MUSIC: Record<Exclude<Music, 'none'>, MusicDef> = {
  // Warm kalimba melody in D major pentatonic over soft pads.
  camp: {
    bpm: 84, sub: 2, bar: 8, chordBars: 1, swing: 0.09,
    chords: [
      C(50, [57, 62, 66]), C(47, [54, 59, 62]), C(43, [55, 59, 62]), C(45, [57, 61, 64]),
      C(47, [54, 59, 62]), C(43, [55, 59, 62]), C(50, [57, 62, 66]), C(45, [57, 61, 64]),
    ],
    scale: [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86],
    lead: 'pluck', leadVol: 0.12, leadDensity: 0.6, leadLen: [1, 2],
    padVol: 0.03, padCut: 900, padAttack: 0.8,
    bassVol: 0.085, bassSteps: [0, 5],
    arp: 'pluck', arpVol: 0.045, arpEvery: 2, arpProb: 0.35, arpShift: 0, arpMode: 'random',
    long: false, send: 0.25, fadeIn: 2,
  },
  // Sparse airy flute over wide pads.
  explore: {
    bpm: 70, sub: 2, bar: 8, chordBars: 2, swing: 0,
    chords: [C(48, [55, 59, 62, 64]), C(45, [55, 59, 60, 64]), C(41, [57, 60, 64, 67]), C(43, [55, 59, 62, 64])],
    scale: [67, 69, 72, 74, 76, 79, 81, 84],
    lead: 'flute', leadVol: 0.08, leadDensity: 0.22, leadLen: [2, 6],
    padVol: 0.028, padCut: 1100, padAttack: 2,
    bassVol: 0.055, bassSteps: [0],
    arp: 'pluck', arpVol: 0.03, arpEvery: 4, arpProb: 0.25, arpShift: 12, arpMode: 'random',
    long: true, send: 0.35, fadeIn: 2.5,
  },
  // Slow dreamy A minor, bells in a long reverb.
  night: {
    bpm: 58, sub: 2, bar: 8, chordBars: 2, swing: 0,
    chords: [C(45, [57, 60, 64, 71]), C(41, [53, 57, 60, 64]), C(38, [53, 57, 60, 62]), C(40, [55, 59, 62, 64])],
    scale: [69, 72, 74, 76, 79, 81, 84],
    lead: 'bell', leadVol: 0.06, leadDensity: 0.2, leadLen: [2, 4],
    padVol: 0.028, padCut: 700, padAttack: 2.5,
    bassVol: 0.055, bassSteps: [0],
    arp: 'pluck', arpVol: 0.022, arpEvery: 4, arpProb: 0.3, arpShift: 0, arpMode: 'random',
    long: true, send: 0.55, fadeIn: 3,
  },
  // Low pulsing ostinato and a dark, dissonant pad.
  tension: {
    bpm: 92, sub: 4, bar: 16, chordBars: 2, swing: 0,
    chords: [C(38, [50, 51, 57]), C(38, [50, 53, 56]), C(37, [49, 50, 56]), C(38, [50, 51, 57])],
    scale: [74, 75, 79, 80, 81, 86],
    lead: 'bell', leadVol: 0.035, leadDensity: 0.06, leadLen: [4, 8],
    padVol: 0.032, padCut: 450, padAttack: 1.5,
    bassVol: 0, bassSteps: [],
    arp: null, arpVol: 0, arpEvery: 1, arpProb: 0, arpShift: 0, arpMode: 'random',
    osti: [1, 0, 0.35, 0, 0.6, 0, 0.35, 0, 1, 0, 0.35, 0.25, 0.6, 0, 0.45, 0], ostiVol: 0.13,
    long: false, send: 0.25, fadeIn: 1.2,
  },
  // Swelling major pad with a shimmering high arpeggio.
  wonder: {
    bpm: 72, sub: 4, bar: 16, chordBars: 1, swing: 0,
    chords: [C(41, [57, 60, 64, 67]), C(38, [53, 57, 60, 64]), C(46, [57, 60, 62, 65]), C(48, [55, 60, 62, 67])],
    scale: [72, 74, 77, 79, 81, 84, 86],
    lead: 'flute', leadVol: 0.055, leadDensity: 0.12, leadLen: [3, 6],
    padVol: 0.042, padCut: 1600, padAttack: 2.5,
    bassVol: 0.065, bassSteps: [0],
    arp: 'bell', arpVol: 0.03, arpEvery: 1, arpProb: 0.85, arpShift: 24, arpMode: 'updown',
    long: true, send: 0.45, fadeIn: 1.5,
  },
  // Majestic slow progression with harp arpeggios.
  title: {
    bpm: 66, sub: 2, bar: 8, chordBars: 1, swing: 0,
    chords: [
      C(50, [57, 62, 66]), C(49, [57, 61, 64]), C(47, [54, 59, 62]), C(42, [54, 57, 61]),
      C(43, [55, 59, 62]), C(42, [57, 62, 66]), C(40, [55, 59, 62, 64]), C(45, [57, 62, 64]),
    ],
    scale: [69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86],
    lead: 'flute', leadVol: 0.065, leadDensity: 0.3, leadLen: [2, 4],
    padVol: 0.036, padCut: 1200, padAttack: 1.2,
    bassVol: 0.085, bassSteps: [0],
    arp: 'harp', arpVol: 0.045, arpEvery: 1, arpProb: 1, arpShift: 12, arpMode: 'updown',
    long: true, send: 0.4, fadeIn: 2,
  },
};

const LOOKAHEAD = 0.3;
const MUSIC_SCALE = 0.6;
const WALK = [-3, -2, -1, -1, -1, 0, 1, 1, 1, 2, 3];

const UI_SFX: ReadonlySet<Sfx> = new Set<Sfx>([
  'shutter', 'focus', 'zoom', 'recStart', 'recStop', 'ui', 'uiBack', 'uiOpen', 'discover', 'fact',
  'star', 'coin', 'place', 'alert', 'wrong', 'pageTurn', 'dialogBlip',
]);

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class AudioEngine {
  private g: Graph | null = null;
  private failed = false;

  private _master = 0.8;
  private _music = 0.5;
  private _sfx = 0.8;

  private wantAmb: Ambience = 'none';
  private wantNight = false;
  private curAmb: Ambience = 'none';
  private curNight = false;
  private ambLayer: Layer | null = null;
  private ambEvents: AmbEvent[] = [];

  private wantMusic: Music = 'none';
  private mus: MusicState | null = null;

  private engineLevel = 0;
  private engine: { L: Layer; oscs: OscillatorNode[]; filt: BiquadFilterNode; putt: OscillatorNode } | null = null;

  private danger = 0;
  private dangerLayer: Layer | null = null;
  private nextBeat = 0;

  private lastBlip = 0;

  // ---- public API ---------------------------------------------------------

  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.g) {
        if (typeof window === 'undefined') return;
        const AC: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) {
          this.failed = true;
          return;
        }
        const ctx = new AC();
        this.g = this.build(ctx);
        // Apply anything requested before unlock.
        const a = this.wantAmb;
        const m = this.wantMusic;
        this.setAmbience(a, this.wantNight);
        this.setMusic(m);
        if (this.engineLevel > 0) this.setEngine(this.engineLevel);
        if (this.danger > 0) this.setDanger(this.danger);
      }
      const ctx = this.g.ctx;
      if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => undefined);
      }
    } catch {
      this.g = null;
      this.failed = true;
    }
  }

  get ready(): boolean {
    return !!this.g && this.g.ctx.state === 'running';
  }

  get masterVolume(): number {
    return this._master;
  }
  set masterVolume(v: number) {
    this._master = clamp01(v);
    this.ramp(this.g?.master.gain, this._master);
  }

  get musicVolume(): number {
    return this._music;
  }
  set musicVolume(v: number) {
    this._music = clamp01(v);
    this.ramp(this.g?.musicBus.gain, this._music * MUSIC_SCALE);
  }

  get sfxVolume(): number {
    return this._sfx;
  }
  set sfxVolume(v: number) {
    this._sfx = clamp01(v);
    const g = this.g;
    if (!g) return;
    this.ramp(g.sfxBus.gain, this._sfx);
    this.ramp(g.uiBus.gain, this._sfx);
    this.ramp(g.ambBus.gain, this._sfx);
  }

  setAmbience(a: Ambience, night = false): void {
    this.wantAmb = a;
    this.wantNight = !!night;
    const g = this.g;
    if (!g) return;
    try {
      if (a === this.curAmb && this.wantNight === this.curNight && (this.ambLayer || a === 'none')) return;
      this.curAmb = a;
      this.curNight = this.wantNight;
      const now = g.ctx.currentTime;
      if (this.ambLayer) this.killLayer(this.ambLayer, 2);
      this.ambLayer = null;
      this.ambEvents = [];
      if (a !== 'none') {
        const L = this.newLayer(g.ambBus);
        this.ambEvents = this.buildAmbience(L, a, this.wantNight);
        L.out.gain.setValueAtTime(0, now);
        L.out.gain.linearRampToValueAtTime(1, now + 2);
        this.ambLayer = L;
      }
      // Underwater: muffle the world, soften music and reverbs.
      const uw = a === 'underwater';
      g.worldFilter.frequency.setTargetAtTime(uw ? 650 : 18000, now, uw ? 0.3 : 0.5);
      g.musicFilter.frequency.setTargetAtTime(uw ? 1500 : 18000, now, 0.5);
      for (const f of g.revFilters) f.frequency.setTargetAtTime(uw ? 1100 : 6500, now, 0.5);
    } catch {
      /* never throw from audio */
    }
  }

  setMusic(m: Music): void {
    this.wantMusic = m;
    const g = this.g;
    if (!g) return;
    try {
      if (this.mus && this.mus.kind === m) return;
      if (!this.mus && m === 'none') return;
      const now = g.ctx.currentTime;
      if (this.mus) {
        const old = this.mus.out;
        old.gain.cancelScheduledValues(now);
        old.gain.setValueAtTime(old.gain.value, now);
        old.gain.linearRampToValueAtTime(0, now + 2.5);
        setTimeout(() => this.safeDisconnect(old), 6000);
        this.mus = null;
      }
      if (m === 'none') return;
      const def = MUSIC[m];
      const out = g.ctx.createGain();
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(1, now + def.fadeIn);
      out.connect(g.musicBus);
      this.mus = {
        kind: m, def, out, step: 0, next: now + 0.1,
        deg: Math.floor(def.scale.length / 2), hold: 0, rest: randi(2, 6), phrase: randi(4, 8),
        chord: def.chords[0] as Chord, arpI: 0, arpDir: 1,
      };
    } catch {
      /* ignore */
    }
  }

  play(s: Sfx, opts?: { vol?: number; pitch?: number; pan?: number }): void {
    if (!this.ready) return;
    try {
      const vol = clamp(opts?.vol ?? 1, 0, 4);
      if (vol <= 0) return;
      const p = clamp(opts?.pitch ?? 1, 0.1, 8);
      const pan = clamp(opts?.pan ?? 0, -1, 1);
      this.sfx(s, vol, Number.isFinite(p) ? p : 1, Number.isFinite(pan) ? pan : 0);
    } catch {
      /* ignore */
    }
  }

  setEngine(level: number): void {
    this.engineLevel = clamp01(level);
    const g = this.g;
    if (!g) return;
    try {
      const lv = this.engineLevel;
      const now = g.ctx.currentTime;
      if (lv <= 0) {
        if (this.engine) {
          const e = this.engine;
          this.engine = null;
          this.killLayer(e.L, 0.6);
        }
        return;
      }
      if (!this.engine) this.engine = this.buildEngine();
      const e = this.engine;
      e.L.out.gain.setTargetAtTime(0.1 + 0.12 * lv, now, 0.15);
      const f = 38 + 45 * lv;
      e.oscs.forEach((o, i) => o.frequency.setTargetAtTime(f * (i === 0 ? 1 : i === 1 ? 1.012 : 0.5), now, 0.25));
      e.filt.frequency.setTargetAtTime(220 + 900 * lv, now, 0.25);
      e.putt.frequency.setTargetAtTime(9 + 16 * lv, now, 0.25);
    } catch {
      /* ignore */
    }
  }

  setDanger(level: number): void {
    const prev = this.danger;
    this.danger = clamp01(level);
    const g = this.g;
    if (!g) return;
    try {
      const now = g.ctx.currentTime;
      if (this.danger > 0 && !this.dangerLayer) {
        this.dangerLayer = this.buildDanger();
        this.nextBeat = now + 0.1;
      }
      const L = this.dangerLayer;
      if (!L) return;
      L.out.gain.setTargetAtTime(this.danger * 0.3, now, 0.5);
      if (this.danger === 0 && prev > 0) {
        setTimeout(() => {
          if (this.danger === 0 && this.dangerLayer === L) {
            this.dangerLayer = null;
            this.killLayer(L, 0.3);
          }
        }, 3000);
      }
    } catch {
      /* ignore */
    }
  }

  update(dt: number): void {
    const g = this.g;
    if (!g || g.ctx.state !== 'running') return;
    try {
      const d = Number.isFinite(dt) ? clamp(dt, 0, 0.25) : 0;
      const now = g.ctx.currentTime;

      // Music scheduler (lookahead on the audio clock).
      const st = this.mus;
      if (st) {
        const sd = 60 / st.def.bpm / st.def.sub;
        if (st.next < now - 0.2) st.next = now + 0.05;
        let guard = 0;
        while (st.next < now + LOOKAHEAD && guard++ < 32) {
          this.musicStep(st, st.next, sd);
          st.next += sd;
        }
      }

      // Random ambient events.
      for (const ev of this.ambEvents) {
        ev.next -= d;
        if (ev.next <= 0) {
          ev.next = rand(ev.min, ev.max);
          ev.fn();
        }
      }

      // Heartbeat.
      if (this.danger > 0.02 && this.dangerLayer) {
        if (this.nextBeat < now - 0.5) this.nextBeat = now + 0.05;
        if (this.nextBeat < now + LOOKAHEAD) {
          this.heartbeat(this.nextBeat, this.danger);
          this.nextBeat += 1.15 - 0.6 * this.danger;
        }
      }
    } catch {
      /* ignore */
    }
  }

  // ---- graph construction -------------------------------------------------

  private build(ctx: AudioContext): Graph {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    comp.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = this._master;
    master.connect(comp);

    const lp = (f: number): BiquadFilterNode => {
      const n = ctx.createBiquadFilter();
      n.type = 'lowpass';
      n.frequency.value = f;
      n.Q.value = 0.5;
      return n;
    };

    const worldFilter = lp(18000);
    worldFilter.connect(master);
    const musicFilter = lp(18000);
    musicFilter.connect(master);

    const musicBus = ctx.createGain();
    musicBus.gain.value = this._music * MUSIC_SCALE;
    musicBus.connect(musicFilter);

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = this._sfx;
    sfxBus.connect(worldFilter);

    const ambBus = ctx.createGain();
    ambBus.gain.value = this._sfx;
    ambBus.connect(worldFilter);

    const ambEvents = ctx.createGain();
    ambEvents.gain.value = 1;
    ambEvents.connect(ambBus);

    const uiBus = ctx.createGain();
    uiBus.gain.value = this._sfx;
    uiBus.connect(master);

    const reverb = (dur: number, decay: number, bright: number, ret: number): { input: GainNode; filt: BiquadFilterNode } => {
      const input = ctx.createGain();
      const filt = lp(6500);
      const conv = ctx.createConvolver();
      conv.buffer = this.makeIR(ctx, dur, decay, bright);
      const out = ctx.createGain();
      out.gain.value = ret;
      input.connect(filt);
      filt.connect(conv);
      conv.connect(out);
      out.connect(master);
      return { input, filt };
    };
    const rs = reverb(1.6, 3, 0.55, 0.7);
    const rl = reverb(4.5, 2.2, 0.3, 0.8);

    const noise = (kind: NoiseKind, secs: number): AudioBuffer => {
      const len = Math.floor(ctx.sampleRate * secs);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') {
          d[i] = w * 0.5;
        } else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }
      return buf;
    };

    const n = 1024;
    const curve = new Float32Array(n);
    const k = 6;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }

    return {
      ctx, master, worldFilter, musicFilter, revFilters: [rs.filt, rl.filt],
      musicBus, sfxBus, uiBus, ambBus, ambEvents,
      revShort: rs.input, revLong: rl.input,
      white: noise('white', 3), pink: noise('pink', 4), brown: noise('brown', 4),
      curve,
    };
  }

  private makeIR(ctx: AudioContext, dur: number, decay: number, bright: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * dur));
    const buf = ctx.createBuffer(2, len, rate);
    const pre = Math.floor(rate * 0.012);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lpv = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        lpv += (w - lpv) * bright;
        d[i] = i < pre ? 0 : lpv * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // ---- primitive helpers ----------------------------------------------------

  private ramp(p: AudioParam | undefined, v: number): void {
    if (!p || !this.g) return;
    try {
      p.setTargetAtTime(v, this.g.ctx.currentTime, 0.05);
    } catch {
      /* ignore */
    }
  }

  private safeDisconnect(n: AudioNode): void {
    try {
      n.disconnect();
    } catch {
      /* ignore */
    }
  }

  private get G(): Graph {
    return this.g as Graph;
  }

  private mkVoice(bus: AudioNode, vol: number, pan: number, life: number, t: number, send = 0.15, long = false): Voice {
    const g = this.G;
    const ctx = g.ctx;
    const out = ctx.createGain();
    out.gain.value = vol;
    const nodes: AudioNode[] = [out];
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      out.connect(p);
      p.connect(bus);
      nodes.push(p);
    } else {
      out.connect(bus);
    }
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      out.connect(s);
      s.connect(long ? g.revLong : g.revShort);
      nodes.push(s);
    }
    const v: Voice = { out, nodes };
    const ms = Math.max(0, t - ctx.currentTime + life) * 1000 + 300;
    setTimeout(() => {
      for (const n of v.nodes) this.safeDisconnect(n);
      v.nodes.length = 0;
    }, ms);
    return v;
  }

  private osc(v: Voice, type: OscillatorType, f: number, t: number, end: number): OscillatorNode {
    const o = this.G.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(end);
    v.nodes.push(o);
    return o;
  }

  private noiseSrc(v: Voice, kind: NoiseKind, t: number, end: number): AudioBufferSourceNode {
    const g = this.G;
    const buf = g[kind];
    const s = g.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start(t, Math.random() * Math.max(0, buf.duration - 0.5));
    s.stop(end);
    v.nodes.push(s);
    return s;
  }

  private gain(v: Voice, value: number): GainNode {
    const n = this.G.ctx.createGain();
    n.gain.value = value;
    v.nodes.push(n);
    return n;
  }

  private filt(v: Voice, type: BiquadFilterType, f: number, Q = 0.7): BiquadFilterNode {
    const n = this.G.ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = Q;
    v.nodes.push(n);
    return n;
  }

  private shaper(v: Voice): WaveShaperNode {
    const n = this.G.ctx.createWaveShaper();
    n.curve = this.G.curve;
    n.oversample = '2x';
    v.nodes.push(n);
    return n;
  }

  /** Gain node with an attack / hold / exponential-decay envelope. */
  private env(v: Voice, t: number, a: number, peak: number, d: number, hold = 0): GainNode {
    const n = this.gain(v, 0);
    const p = n.gain;
    const pk = Math.max(0.0002, peak);
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(pk, t + Math.max(0.001, a));
    if (hold > 0) p.setValueAtTime(pk, t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + a + hold + Math.max(0.005, d));
    p.setValueAtTime(0, t + a + hold + d + 0.01);
    return n;
  }

  /** Low-frequency oscillator modulating `param` by +/- depth. */
  private lfo(v: Voice, t: number, end: number, rate: number, depth: number, param: AudioParam, type: OscillatorType = 'sine'): OscillatorNode {
    const o = this.osc(v, type, rate, t, end);
    const dg = this.gain(v, depth);
    o.connect(dg);
    dg.connect(param);
    return o;
  }

  private tone(v: Voice, o: ToneOpts): OscillatorNode {
    const a = o.a ?? 0.005;
    const hold = o.hold ?? 0;
    const total = a + hold + o.d;
    const end = o.t + total + 0.05;
    const f = Math.max(1, o.f);
    const osc = this.osc(v, o.type ?? 'sine', f, o.t, end);
    if (o.detune) osc.detune.value = o.detune;
    const contour = (param: AudioParam, mul: number): void => {
      if (o.pts) {
        for (const [dt, fr] of o.pts) param.exponentialRampToValueAtTime(Math.max(1, fr * mul), o.t + dt);
      } else if (o.f2 !== undefined) {
        param.exponentialRampToValueAtTime(Math.max(1, o.f2 * mul), o.t + (o.glide ?? total));
      }
    };
    contour(osc.frequency, 1);
    if (o.fm && o.fm.index > 0) {
      const m = this.osc(v, 'sine', f * o.fm.ratio, o.t, end);
      contour(m.frequency, o.fm.ratio);
      const mg = this.gain(v, 0);
      const dev = f * o.fm.index;
      mg.gain.setValueAtTime(dev, o.t);
      mg.gain.exponentialRampToValueAtTime(Math.max(0.01, dev * 0.01), o.t + (o.fm.decay ?? total));
      m.connect(mg);
      mg.connect(osc.frequency);
    }
    const e = this.env(v, o.t, a, o.vol, o.d, hold);
    osc.connect(e);
    e.connect(o.to ?? v.out);
    return osc;
  }

  private burst(v: Voice, o: BurstOpts): BiquadFilterNode {
    const a = o.a ?? 0.003;
    const hold = o.hold ?? 0;
    const total = a + hold + o.d;
    const src = this.noiseSrc(v, o.noise ?? 'white', o.t, o.t + total + 0.05);
    const fl = this.filt(v, o.ft ?? 'bandpass', o.f ?? 1000, o.Q ?? 0.8);
    if (o.f2 !== undefined) {
      fl.frequency.setValueAtTime(o.f ?? 1000, o.t);
      fl.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), o.t + total);
    }
    const e = this.env(v, o.t, a, o.vol, o.d, hold);
    src.connect(fl);
    fl.connect(e);
    e.connect(o.to ?? v.out);
    return fl;
  }

  // ---- layers (continuous beds) --------------------------------------------

  private newLayer(dest: AudioNode): Layer {
    const out = this.G.ctx.createGain();
    out.gain.value = 0;
    out.connect(dest);
    return { out, nodes: [out], srcs: [] };
  }

  private killLayer(L: Layer, fade: number): void {
    const ctx = this.G.ctx;
    const now = ctx.currentTime;
    try {
      L.out.gain.cancelScheduledValues(now);
      L.out.gain.setValueAtTime(L.out.gain.value, now);
      L.out.gain.linearRampToValueAtTime(0, now + fade);
    } catch {
      /* ignore */
    }
    for (const s of L.srcs) {
      try {
        s.stop(now + fade + 0.1);
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => {
      for (const n of L.nodes) this.safeDisconnect(n);
      L.nodes.length = 0;
      L.srcs.length = 0;
    }, (fade + 0.4) * 1000);
  }

  private lOsc(L: Layer, type: OscillatorType, f: number): OscillatorNode {
    const ctx = this.G.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.start(ctx.currentTime);
    L.nodes.push(o);
    L.srcs.push(o);
    return o;
  }

  private lNode<T extends AudioNode>(L: Layer, n: T): T {
    L.nodes.push(n);
    return n;
  }

  private lGain(L: Layer, v: number): GainNode {
    const n = this.lNode(L, this.G.ctx.createGain());
    n.gain.value = v;
    return n;
  }

  private lFilt(L: Layer, type: BiquadFilterType, f: number, Q = 0.7): BiquadFilterNode {
    const n = this.lNode(L, this.G.ctx.createBiquadFilter());
    n.type = type;
    n.frequency.value = f;
    n.Q.value = Q;
    return n;
  }

  private lLfo(L: Layer, rate: number, depth: number, param: AudioParam, type: OscillatorType = 'sine'): OscillatorNode {
    const o = this.lOsc(L, type, rate);
    const d = this.lGain(L, depth);
    o.connect(d);
    d.connect(param);
    return o;
  }

  private lPan(L: Layer, pan: number, dest: AudioNode): AudioNode {
    const ctx = this.G.ctx;
    if (pan === 0 || typeof ctx.createStereoPanner !== 'function') return dest;
    const p = this.lNode(L, ctx.createStereoPanner());
    p.pan.value = pan;
    p.connect(dest);
    return p;
  }

  /** Looping filtered noise with optional synced amplitude/filter LFO swells and AM. */
  private bed(L: Layer, o: {
    kind: NoiseKind; ft: BiquadFilterType; f: number; Q?: number; lvl: number;
    rate?: number; depth?: number; fdepth?: number; am?: number; pan?: number;
  }): void {
    const g = this.G;
    const ctx = g.ctx;
    const buf = g[o.kind];
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start(ctx.currentTime, Math.random() * Math.max(0, buf.duration - 0.5));
    L.nodes.push(s);
    L.srcs.push(s);
    const f = this.lFilt(L, o.ft, o.f, o.Q ?? 0.7);
    const gn = this.lGain(L, o.lvl);
    s.connect(f);
    f.connect(gn);
    let tail: AudioNode = gn;
    if (o.am) {
      const amg = this.lGain(L, 0.5);
      this.lLfo(L, o.am, 0.5, amg.gain);
      gn.connect(amg);
      tail = amg;
    }
    tail.connect(this.lPan(L, o.pan ?? 0, L.out));
    if (o.rate) {
      const l = this.lOsc(L, 'sine', o.rate);
      if (o.depth) {
        const dg = this.lGain(L, o.depth * o.lvl);
        l.connect(dg);
        dg.connect(gn.gain);
      }
      if (o.fdepth) {
        const fg = this.lGain(L, o.fdepth);
        l.connect(fg);
        fg.connect(f.frequency);
      }
    }
  }

  /** Stereo pair of decorrelated beds. */
  private bed2(L: Layer, o: Parameters<AudioEngine['bed']>[1]): void {
    for (const pan of [-0.65, 0.65]) {
      this.bed(L, { ...o, lvl: o.lvl * 0.6, pan, rate: o.rate ? o.rate * rand(0.75, 1.25) : undefined });
    }
  }

  /** Night insect chorus: pulsed high sines. */
  private chorus(L: Layer, lvl: number): void {
    for (const [f, am, pan] of [[4300, 23, -0.5], [5150, 31, 0.5], [3700, 17, 0]] as const) {
      const o = this.lOsc(L, 'sine', f * rand(0.97, 1.03));
      const amg = this.lGain(L, 0.5);
      this.lLfo(L, am * rand(0.9, 1.1), 0.5, amg.gain, 'square');
      const sw = this.lGain(L, lvl);
      this.lLfo(L, rand(0.08, 0.25), lvl * 0.8, sw.gain);
      o.connect(amg);
      amg.connect(sw);
      sw.connect(this.lPan(L, pan, L.out));
    }
  }

  private buildAmbience(L: Layer, a: Ambience, night: boolean): AmbEvent[] {
    const ev: AmbEvent[] = [];
    const E = (fn: () => void, min: number, max: number): void => {
      ev.push({ fn, min, max, next: rand(min * 0.3, max) });
    };
    const wind = (lvl: number, f: number): void =>
      this.bed2(L, { kind: 'pink', ft: 'lowpass', f, Q: 0.6, lvl, rate: 0.07, depth: 0.6, fdepth: f * 0.4 });
    const leaves = (lvl: number): void =>
      this.bed2(L, { kind: 'white', ft: 'bandpass', f: 3200, Q: 0.6, lvl, rate: 0.12, depth: 0.7, fdepth: 800 });
    const waves = (lvl: number, f: number, rate: number): void => {
      this.bed2(L, { kind: 'brown', ft: 'lowpass', f, Q: 0.5, lvl, rate, depth: 0.8, fdepth: f * 0.6 });
      this.bed2(L, { kind: 'white', ft: 'highpass', f: 1800, Q: 0.5, lvl: lvl * 0.12, rate, depth: 0.9 });
    };
    const cicada = (lvl: number): void =>
      this.bed(L, { kind: 'white', ft: 'bandpass', f: rand(5800, 7000), Q: 6, lvl, rate: 0.045, depth: 0.9, am: 42 });
    const rumble = (lvl: number, f: number): void =>
      this.bed(L, { kind: 'brown', ft: 'lowpass', f, Q: 0.5, lvl, rate: 0.05, depth: 0.5 });

    const bird = (): void => this.evBird();
    const insect = (): void => this.evInsect();
    const cricket = (): void => this.evCricket();
    const frog = (): void => this.evFrog();
    const drip = (): void => this.evDrip();
    const hoot = (): void => this.evHoot();

    switch (a) {
      case 'camp':
        wind(night ? 0.02 : 0.03, 600);
        waves(0.045, 350, 0.09);
        this.bed(L, { kind: 'brown', ft: 'lowpass', f: 260, lvl: 0.035, rate: 0.7, depth: 0.3 });
        E(() => this.evCrackle(), 0.06, 0.45);
        E(() => this.evPop(), 1.5, 6);
        if (night) {
          this.chorus(L, 0.008);
          E(cricket, 1, 3);
          E(frog, 3, 8);
          E(hoot, 12, 25);
        } else {
          E(bird, 3, 9);
          E(insect, 6, 14);
        }
        break;
      case 'forest':
        wind(0.025, 500);
        leaves(night ? 0.008 : 0.014);
        E(drip, 1.2, 4.5);
        E(() => this.evRustle(), 8, 20);
        if (night) {
          this.chorus(L, 0.01);
          E(cricket, 0.6, 2);
          E(frog, 1.5, 5);
          E(hoot, 10, 24);
        } else {
          cicada(0.006);
          E(bird, 1.8, 5.5);
          E(insect, 5, 12);
        }
        break;
      case 'canopy':
        wind(0.05, 900);
        leaves(0.028);
        E(() => this.evWing(), 8, 18);
        if (night) {
          this.chorus(L, 0.008);
          E(cricket, 1, 3);
          E(frog, 2, 5);
          E(hoot, 9, 20);
        } else {
          E(bird, 1, 3.5);
          E(insect, 8, 16);
        }
        break;
      case 'falls':
        this.bed2(L, { kind: 'pink', ft: 'bandpass', f: 700, Q: 0.4, lvl: 0.22, rate: 0.1, depth: 0.08 });
        this.bed2(L, { kind: 'white', ft: 'highpass', f: 2500, Q: 0.5, lvl: 0.05, rate: 0.13, depth: 0.1 });
        rumble(0.12, 150);
        E(() => this.evPlop(), 2, 6);
        if (night) {
          E(cricket, 2, 5);
          E(frog, 4, 9);
        } else {
          E(bird, 5, 12);
        }
        break;
      case 'mangrove':
        waves(0.03, 300, 0.2);
        E(drip, 2, 5);
        E(() => this.evPlop(), 5, 12);
        E(() => this.evCroc(), 25, 55);
        if (night) {
          this.chorus(L, 0.01);
          E(frog, 0.7, 2.2);
          E(cricket, 1, 3);
        } else {
          cicada(0.01);
          E(frog, 3, 8);
          E(insect, 3, 8);
          E(bird, 4, 10);
        }
        break;
      case 'coast':
        waves(0.14, 500, 0.08);
        wind(0.045, 800);
        E(() => this.evWaveCrash(), 7, 14);
        if (night) {
          E(cricket, 2, 5);
        } else {
          E(() => this.evGull(), 4, 10);
        }
        break;
      case 'ocean':
        waves(0.12, 450, 0.07);
        wind(0.07, 900);
        rumble(0.04, 180);
        E(() => this.evWaveCrash(), 6, 12);
        E(() => this.evMoan(), 15, 35);
        if (!night) E(() => this.evGull(), 8, 20);
        break;
      case 'underwater':
        rumble(0.12, 260);
        this.bed(L, { kind: 'pink', ft: 'bandpass', f: 500, Q: 0.6, lvl: 0.04, rate: 0.06, depth: 0.5 });
        E(() => this.evBubbles(), 1.2, 4.5);
        E(() => this.evMoan(), 12, 30);
        break;
      case 'storm':
        this.bed2(L, { kind: 'white', ft: 'highpass', f: 900, Q: 0.4, lvl: 0.1, rate: 0.2, depth: 0.2 });
        this.bed(L, { kind: 'pink', ft: 'lowpass', f: 400, lvl: 0.05 });
        wind(0.09, 1000);
        E(() => this.evThunder(), 6, 15);
        E(drip, 0.4, 1.5);
        break;
      case 'none':
        break;
    }
    return ev;
  }

  // ---- ambient events ---------------------------------------------------------

  private ev(vol: number, life: number, send = 0.3, long = false, spread = 0.9): { v: Voice; t: number } {
    const g = this.G;
    const t = g.ctx.currentTime + 0.03;
    const v = this.mkVoice(g.ambEvents, vol * rand(0.45, 1), rand(-spread, spread), life, t, send, long);
    return { v, t };
  }

  private evBird(): void {
    const { v, t } = this.ev(0.12, 3, 0.35, true);
    this.synBird(v, t, rand(0.85, 1.2));
  }
  private evInsect(): void {
    const dur = rand(1, 3.5);
    const { v, t } = this.ev(0.04, dur + 1.5, 0.2);
    this.synInsect(v, t, dur);
  }
  private evCricket(): void {
    const { v, t } = this.ev(0.05, 2.5, 0.25);
    this.synCricket(v, t, rand(0.95, 1.08));
  }
  private evFrog(): void {
    const { v, t } = this.ev(0.1, 2, 0.3);
    this.synFrog(v, t, rand(0.8, 1.25));
  }
  private evHoot(): void {
    const { v, t } = this.ev(0.08, 2.5, 0.5, true);
    this.synHoot(v, t, rand(0.9, 1.1));
  }
  private evCrackle(): void {
    const { v, t } = this.ev(0.1, 0.5, 0.1, false, 0.25);
    this.synCrackle(v, t);
  }
  private evPop(): void {
    const { v, t } = this.ev(0.15, 0.5, 0.15, false, 0.25);
    this.burst(v, { noise: 'white', t, d: 0.02, vol: 1, ft: 'highpass', f: 1200 });
    this.burst(v, { noise: 'brown', t, d: 0.08, vol: 0.9, ft: 'lowpass', f: 500 });
    this.tone(v, { f: rand(140, 200), f2: 70, t, d: 0.06, vol: 0.4 });
  }
  private evDrip(): void {
    const { v, t } = this.ev(0.09, 1.5, 0.6, true);
    this.synDrip(v, t, rand(0.8, 1.4));
    if (Math.random() < 0.25) this.synDrip(v, t + rand(0.15, 0.4), rand(0.8, 1.4));
  }
  private evThunder(): void {
    const { v, t } = this.ev(0.45, 7, 0.4, true, 0.6);
    this.synThunder(v, t, false);
  }
  private evMoan(): void {
    const { v, t } = this.ev(0.22, 7, 0.7, true, 0.7);
    this.synMoan(v, t, rand(0.8, 1.2));
  }
  private evBubbles(): void {
    const { v, t } = this.ev(0.12, 1.5, 0.4);
    this.synBubbles(v, t, rand(0.8, 1.3), randi(2, 7));
  }
  private evWaveCrash(): void {
    const { v, t } = this.ev(0.12, 5, 0.2, false, 0.7);
    this.burst(v, { noise: 'pink', t, a: 1.1, hold: 0.3, d: 2.6, vol: 1, ft: 'lowpass', f: 400, f2: 1600, Q: 0.4 });
    this.burst(v, { noise: 'white', t: t + 1.1, a: 0.1, d: 2, vol: 0.2, ft: 'highpass', f: 3000, Q: 0.5 });
  }
  private evPlop(): void {
    const { v, t } = this.ev(0.08, 1, 0.5, true);
    this.synPlop(v, t, rand(0.8, 1.3));
  }
  private evRustle(): void {
    const { v, t } = this.ev(0.08, 1, 0.15);
    this.synRustle(v, t, rand(0.8, 1.2));
  }
  private evWing(): void {
    const { v, t } = this.ev(0.1, 1, 0.2);
    this.synWing(v, t, rand(0.9, 1.2));
  }
  private evGull(): void {
    const { v, t } = this.ev(0.07, 2.5, 0.35, true);
    this.synGull(v, t, rand(0.9, 1.15));
  }
  private evCroc(): void {
    const { v, t } = this.ev(0.12, 2, 0.4, true, 0.8);
    this.synCroc(v, t, rand(0.8, 1));
  }

  // ---- shared synth recipes -------------------------------------------------------

  private synBird(v: Voice, t: number, p: number): void {
    const kind = randi(0, 5);
    switch (kind) {
      case 0: {
        // two-tone whistle "wee-oo"
        const base = rand(1800, 3000) * p;
        const n = randi(1, 3);
        for (let i = 0; i < n; i++) {
          const s = t + i * rand(0.3, 0.42);
          const up = Math.random() < 0.6;
          this.tone(v, {
            f: base, t: s, a: 0.02, hold: 0.12, d: 0.12, vol: 0.6,
            pts: up ? [[0.08, base * 1.45], [0.26, base * 0.85]] : [[0.1, base * 0.8], [0.26, base * 1.2]],
          });
        }
        break;
      }
      case 1: {
        // fast FM trill
        const f = rand(3000, 4500) * p;
        const n = randi(6, 12);
        const gap = rand(0.045, 0.07);
        for (let i = 0; i < n; i++) {
          const ff = f * (1 - i * 0.012);
          this.tone(v, { f: ff, f2: ff * 1.25, t: t + i * gap, a: 0.004, d: 0.035, vol: 0.45, fm: { ratio: 2, index: 0.3 } });
        }
        break;
      }
      case 2: {
        // dove-like coo
        const f = rand(480, 720) * p;
        const n = randi(2, 3);
        for (let i = 0; i < n; i++) {
          const s = t + i * 0.42;
          const last = i === n - 1;
          this.tone(v, {
            f, t: s, a: 0.05, hold: last ? 0.22 : 0.1, d: 0.15, vol: 0.9,
            pts: [[0.06, f * 1.08], [last ? 0.4 : 0.25, f * 0.9]], fm: { ratio: 1, index: 0.15 },
          });
        }
        break;
      }
      case 3: {
        // chattering tui-like phrase
        const base = rand(1400, 2400) * p;
        const ratios = [1, 1.125, 1.25, 1.5, 2, 0.75];
        let s = t;
        const n = randi(3, 6);
        for (let i = 0; i < n; i++) {
          const f = base * pick(ratios);
          const d = rand(0.04, 0.11);
          this.tone(v, { f, f2: f * rand(0.8, 1.35), t: s, a: 0.006, d, vol: 0.5, fm: { ratio: 1.5, index: rand(0.2, 0.7), decay: d } });
          s += d + rand(0.03, 0.14);
        }
        break;
      }
      case 4: {
        // bellbird: pure bell tones, descending
        const f = rand(1100, 1700) * p;
        const steps = [1, 0.84, 0.75, 1.12, 0.67];
        const n = randi(3, 4);
        for (let i = 0; i < n; i++) {
          this.tone(v, { f: f * (steps[i] ?? 1), t: t + i * 0.22, a: 0.003, d: 0.45, vol: 0.5, fm: { ratio: 2.4, index: 0.25, decay: 0.08 } });
        }
        break;
      }
      default: {
        // single rising chirps
        const n = randi(2, 4);
        for (let i = 0; i < n; i++) {
          const f = rand(2500, 3800) * p;
          this.tone(v, { f, f2: f * 1.6, glide: 0.07, t: t + i * rand(0.12, 0.2), a: 0.004, d: 0.07, vol: 0.5, fm: { ratio: 2, index: 0.25 } });
        }
      }
    }
  }

  private synInsect(v: Voice, t: number, dur: number): void {
    const end = t + dur + 0.8;
    const f = rand(3500, 7000);
    const o = this.osc(v, 'sine', f, t, end);
    const am = this.gain(v, 0.5);
    this.lfo(v, t, end, rand(18, 55), 0.5, am.gain);
    const e = this.env(v, t, 0.35, 1, 0.4, dur);
    o.connect(am);
    am.connect(e);
    e.connect(v.out);
  }

  private synCricket(v: Voice, t: number, p: number): void {
    const f = rand(4200, 5000) * p;
    const groups = randi(2, 4);
    const pulses = randi(3, 4);
    for (let gI = 0; gI < groups; gI++) {
      for (let i = 0; i < pulses; i++) {
        this.tone(v, { f, t: t + gI * 0.38 + i * 0.035, a: 0.003, d: 0.018, vol: 0.6 });
      }
    }
  }

  private synFrog(v: Voice, t: number, p: number): void {
    const kind = randi(0, 2);
    if (kind === 2) {
      // peep
      const f = rand(2300, 2900) * p;
      const n = randi(1, 3);
      for (let i = 0; i < n; i++) this.tone(v, { f, f2: f * 1.18, t: t + i * 0.3, a: 0.01, d: 0.1, vol: 0.35 });
      return;
    }
    const low = kind === 0;
    const f = (low ? rand(110, 170) : rand(260, 480)) * p;
    const n = randi(1, 3);
    for (let i = 0; i < n; i++) {
      const s = t + i * rand(0.22, 0.32);
      const dur = low ? 0.28 : 0.13;
      const end = s + dur + 0.2;
      const o = this.osc(v, low ? 'sawtooth' : 'triangle', f, s, end);
      o.frequency.exponentialRampToValueAtTime(f * 1.12, s + dur);
      const lp = this.filt(v, 'lowpass', low ? 600 : 1500, 2);
      const am = this.gain(v, 0.5);
      this.lfo(v, s, end, low ? rand(25, 35) : rand(40, 60), 0.5, am.gain, 'square');
      const e = this.env(v, s, 0.02, low ? 0.9 : 0.7, 0.08, dur);
      o.connect(lp);
      lp.connect(am);
      am.connect(e);
      e.connect(v.out);
    }
  }

  private synHoot(v: Voice, t: number, p: number): void {
    // "more-pork" two-note owl
    const f = 440 * p;
    this.tone(v, { f, f2: f * 0.96, t, a: 0.05, hold: 0.12, d: 0.2, vol: 0.8, fm: { ratio: 1, index: 0.1 } });
    this.tone(v, { f: f * 0.8, f2: f * 0.74, t: t + 0.45, a: 0.05, hold: 0.15, d: 0.25, vol: 0.8, fm: { ratio: 1, index: 0.1 } });
  }

  private synCrackle(v: Voice, t: number): void {
    const n = randi(1, 5);
    for (let i = 0; i < n; i++) {
      this.burst(v, { noise: 'white', t: t + rand(0, 0.15), a: 0.001, d: rand(0.004, 0.02), vol: rand(0.3, 1), ft: 'highpass', f: rand(1500, 4500) });
    }
  }

  private synDrip(v: Voice, t: number, p: number): void {
    const f = rand(900, 1700) * p;
    this.tone(v, { f, f2: f * 1.9, glide: 0.035, t, a: 0.002, d: 0.08, vol: 0.8 });
  }

  private synThunder(v: Voice, t: number, near: boolean): void {
    if (near) {
      this.burst(v, { noise: 'white', t, a: 0.004, d: 0.5, vol: 0.9, ft: 'lowpass', f: 4000, f2: 300, Q: 0.4 });
      this.burst(v, { noise: 'brown', t: t + 0.02, a: 0.05, hold: 0.4, d: 3.5, vol: 1, ft: 'lowpass', f: 400, f2: 90, Q: 0.4 });
      this.burst(v, { noise: 'pink', t: t + 0.6, a: 0.3, d: 2, vol: 0.4, ft: 'lowpass', f: 300, Q: 0.5 });
    } else {
      this.burst(v, { noise: 'brown', t, a: rand(0.3, 0.7), hold: 0.4, d: rand(2.5, 4.5), vol: 1, ft: 'lowpass', f: rand(160, 280), f2: 80, Q: 0.5 });
      this.burst(v, { noise: 'pink', t: t + rand(0.3, 0.8), a: 0.2, d: 1.5, vol: 0.35, ft: 'lowpass', f: 350, Q: 0.5 });
    }
  }

  private synMoan(v: Voice, t: number, p: number): void {
    const f = rand(55, 95) * p;
    const dur = rand(3, 4.5);
    const end = t + dur + 2.5;
    const lp = this.filt(v, 'lowpass', 500, 0.8);
    const e = this.env(v, t, 1.2, 1, 2, dur - 1.2);
    lp.connect(e);
    e.connect(v.out);
    for (const [mul, type, lvl] of [[1, 'triangle', 1], [1.5, 'sine', 0.35], [2.02, 'sine', 0.15]] as const) {
      const o = this.osc(v, type, f * mul, t, end);
      o.frequency.exponentialRampToValueAtTime(f * mul * 1.3, t + dur * 0.4);
      o.frequency.exponentialRampToValueAtTime(f * mul * 0.88, t + dur + 1.5);
      this.lfo(v, t, end, rand(3.5, 5), f * mul * 0.012, o.frequency);
      const gn = this.gain(v, lvl);
      o.connect(gn);
      gn.connect(lp);
    }
  }

  private synBubbles(v: Voice, t: number, p: number, n: number): void {
    let s = t;
    for (let i = 0; i < n; i++) {
      const f = rand(300, 900) * p;
      this.tone(v, { f, f2: f * rand(1.6, 2.4), glide: 0.05, t: s, a: 0.002, d: 0.06, vol: 0.7 });
      s += rand(0.03, 0.16);
    }
  }

  private synPlop(v: Voice, t: number, p: number): void {
    this.tone(v, { f: 700 * p, f2: 220 * p, glide: 0.06, t, a: 0.002, d: 0.08, vol: 0.8 });
    this.burst(v, { t, d: 0.09, vol: 0.3, ft: 'bandpass', f: 1500, Q: 1 });
  }

  private synRustle(v: Voice, t: number, p: number): void {
    const n = randi(4, 8);
    for (let i = 0; i < n; i++) {
      this.burst(v, { t: t + rand(0, 0.35), a: 0.005, d: rand(0.02, 0.07), vol: rand(0.3, 0.8), ft: 'bandpass', f: rand(2200, 5000) * p, Q: 1.5 });
    }
  }

  private synWing(v: Voice, t: number, p: number): void {
    const n = randi(3, 5);
    const gap = rand(0.08, 0.11) / p;
    for (let i = 0; i < n; i++) {
      this.burst(v, { noise: 'pink', t: t + i * gap, a: 0.02, d: 0.07, vol: 0.9 - i * 0.12, ft: 'lowpass', f: 1100 * p, f2: 300, Q: 0.8 });
    }
  }

  private synGull(v: Voice, t: number, p: number): void {
    const n = randi(2, 4);
    for (let i = 0; i < n; i++) {
      const f = rand(1000, 1250) * p;
      const s = t + i * rand(0.3, 0.42);
      this.tone(v, { type: 'triangle', f, t: s, a: 0.02, hold: 0.08, d: 0.18, vol: 0.6, pts: [[0.06, f * 1.3], [0.3, f * 0.72]], fm: { ratio: 0.5, index: 0.25 } });
    }
  }

  private synCroc(v: Voice, t: number, p: number): void {
    const f = rand(45, 60) * p;
    const dur = 0.5;
    const end = t + dur + 0.8;
    const o = this.osc(v, 'sawtooth', f, t, end);
    o.frequency.exponentialRampToValueAtTime(f * 0.8, t + dur + 0.4);
    const lp = this.filt(v, 'lowpass', 320, 1.5);
    const am = this.gain(v, 0.6);
    this.lfo(v, t, end, 17, 0.4, am.gain);
    const e = this.env(v, t, 0.08, 1, 0.4, dur);
    o.connect(lp);
    lp.connect(am);
    am.connect(e);
    e.connect(v.out);
    this.burst(v, { noise: 'brown', t, a: 0.08, hold: dur * 0.7, d: 0.4, vol: 0.6, ft: 'lowpass', f: 220 });
  }

  // ---- sfx --------------------------------------------------------------------

  private sfx(s: Sfx, vol: number, p: number, pan: number): void {
    const g = this.G;
    const now = g.ctx.currentTime;
    const t = now + 0.005;
    const bus = UI_SFX.has(s) ? g.uiBus : g.sfxBus;
    const V = (level: number, life: number, send = 0.15, long = false): Voice => this.mkVoice(bus, level * vol, pan, life, t, send, long);

    switch (s) {
      case 'shutter': {
        const v = V(0.55, 0.4, 0.12);
        this.burst(v, { t, a: 0.001, d: 0.018, vol: 0.9, ft: 'highpass', f: 2500 * p, Q: 0.7 });
        this.tone(v, { type: 'triangle', f: 1800 * p, t, a: 0.001, d: 0.01, vol: 0.2 });
        this.tone(v, { f: 150 * p, f2: 65, t, a: 0.002, d: 0.05, vol: 0.45 });
        const t1 = t + 0.075;
        this.burst(v, { t: t1, a: 0.001, d: 0.026, vol: 0.65, ft: 'bandpass', f: 3500 * p, Q: 0.8 });
        this.tone(v, { f: 115 * p, f2: 55, t: t1, a: 0.002, d: 0.04, vol: 0.25 });
        break;
      }
      case 'focus': {
        const v = V(0.18, 0.4, 0.05);
        this.tone(v, { f: 2400 * p, t, a: 0.002, hold: 0.03, d: 0.03, vol: 1 });
        this.tone(v, { f: 2400 * p, t: t + 0.09, a: 0.002, hold: 0.03, d: 0.04, vol: 1 });
        break;
      }
      case 'zoom': {
        const v = V(0.12, 0.5, 0.05);
        const o = this.osc(v, 'sawtooth', 220 * p, t, t + 0.4);
        o.frequency.exponentialRampToValueAtTime(330 * p, t + 0.28);
        const lp = this.filt(v, 'lowpass', 1000, 1);
        const e = this.env(v, t, 0.03, 1, 0.08, 0.2);
        o.connect(lp);
        lp.connect(e);
        e.connect(v.out);
        this.tone(v, { type: 'triangle', f: 1200 * p, f2: 1500 * p, t, a: 0.03, hold: 0.2, d: 0.08, vol: 0.15 });
        break;
      }
      case 'recStart':
      case 'recStop': {
        const v = V(0.2, 0.5, 0.1);
        const [a, b] = s === 'recStart' ? [880, 1320] : [1320, 880];
        this.tone(v, { f: a * p, t, a: 0.003, hold: 0.05, d: 0.06, vol: 1 });
        this.tone(v, { f: b * p, t: t + 0.12, a: 0.003, hold: 0.06, d: 0.1, vol: 1 });
        break;
      }
      case 'step': {
        const pp = p * rand(0.9, 1.1);
        const v = V(0.35, 0.3, 0.03);
        this.burst(v, { noise: 'pink', t, a: 0.003, d: rand(0.05, 0.08), vol: 0.8, ft: 'lowpass', f: rand(500, 900) * pp });
        this.tone(v, { f: 90 * pp, f2: 50, t, a: 0.003, d: 0.05, vol: 0.35 });
        this.burst(v, { t: t + 0.01, a: 0.002, d: 0.02, vol: 0.1, ft: 'bandpass', f: 3000 * pp, Q: 1.2 });
        break;
      }
      case 'stepSoft': {
        const v = V(0.2, 0.3, 0.02);
        this.burst(v, { noise: 'pink', t, a: 0.004, d: 0.05, vol: 0.7, ft: 'lowpass', f: rand(380, 520) * p });
        this.burst(v, { t, a: 0.003, d: 0.03, vol: 0.08, ft: 'bandpass', f: 2500 * p, Q: 1 });
        break;
      }
      case 'jump': {
        const v = V(0.25, 0.4, 0.05);
        this.burst(v, { noise: 'pink', t, a: 0.02, d: 0.12, vol: 0.6, ft: 'bandpass', f: 600 * p, f2: 1600 * p, Q: 1 });
        this.tone(v, { f: 180 * p, f2: 320 * p, t, a: 0.005, d: 0.1, vol: 0.3 });
        break;
      }
      case 'land': {
        const v = V(0.45, 0.5, 0.05);
        this.tone(v, { f: 110 * p, f2: 45, t, a: 0.003, d: 0.14, vol: 0.8 });
        this.burst(v, { noise: 'pink', t, a: 0.003, d: 0.1, vol: 0.7, ft: 'lowpass', f: 500 * p });
        this.synRustle(v, t, p * 0.9);
        break;
      }
      case 'ui': {
        const v = V(0.22, 0.3, 0.05);
        this.tone(v, { f: 1100 * p, t, a: 0.002, d: 0.05, vol: 1 });
        this.tone(v, { type: 'triangle', f: 2200 * p, t, a: 0.001, d: 0.02, vol: 0.12 });
        break;
      }
      case 'uiBack': {
        const v = V(0.22, 0.3, 0.05);
        this.tone(v, { f: 880 * p, f2: 587 * p, glide: 0.08, t, a: 0.003, d: 0.1, vol: 1 });
        break;
      }
      case 'uiOpen': {
        const v = V(0.2, 0.5, 0.12);
        this.tone(v, { f: 660 * p, t, a: 0.003, d: 0.1, vol: 1 });
        this.tone(v, { f: 990 * p, t: t + 0.06, a: 0.003, d: 0.16, vol: 0.9 });
        break;
      }
      case 'discover': {
        const v = V(0.3, 3, 0.35, true);
        const notes = [74, 78, 81, 86, 90];
        notes.forEach((m, i) => this.bellNote(v, mtof(m) * p, t + i * 0.08, 0.7, 0.9));
        const t2 = t + notes.length * 0.08 + 0.05;
        for (const m of [86, 90, 93, 98]) this.bellNote(v, mtof(m) * p, t2, 0.35, 1.8);
        this.tone(v, { f: mtof(62) * p, t: t2, a: 0.01, d: 1.2, vol: 0.5, fm: { ratio: 1, index: 0.8, decay: 0.2 } });
        break;
      }
      case 'fact': {
        const v = V(0.25, 2, 0.3, true);
        this.bellNote(v, mtof(81) * p, t, 0.8, 0.9);
        this.bellNote(v, mtof(88) * p, t + 0.13, 0.8, 1.2);
        break;
      }
      case 'star': {
        const v = V(0.25, 1.2, 0.3, true);
        const f = 1760 * p;
        this.tone(v, { f, t, a: 0.002, d: 0.6, vol: 1, fm: { ratio: 2, index: 0.5, decay: 0.1 } });
        this.tone(v, { f: f * 4, t, a: 0.001, d: 0.12, vol: 0.15 });
        this.tone(v, { f: f * 1.5, f2: f * 2, glide: 0.1, t: t + 0.03, a: 0.002, d: 0.12, vol: 0.18 });
        break;
      }
      case 'coin': {
        const v = V(0.2, 0.8, 0.15);
        this.tone(v, { type: 'triangle', f: 988 * p, t, a: 0.002, hold: 0.04, d: 0.03, vol: 1 });
        this.tone(v, { type: 'triangle', f: 1319 * p, t: t + 0.07, a: 0.002, hold: 0.03, d: 0.35, vol: 1 });
        this.tone(v, { f: 2638 * p, t: t + 0.07, a: 0.002, d: 0.2, vol: 0.25 });
        break;
      }
      case 'place': {
        const v = V(0.35, 0.4, 0.1);
        this.tone(v, { f: 320 * p, f2: 180 * p, t, a: 0.002, d: 0.1, vol: 0.9 });
        this.tone(v, { type: 'triangle', f: 640 * p, t, a: 0.001, d: 0.05, vol: 0.15 });
        this.burst(v, { t, a: 0.001, d: 0.03, vol: 0.4, ft: 'bandpass', f: 1800 * p, Q: 1.2 });
        break;
      }
      case 'hiss': {
        const sc = 1 / p;
        const v = V(0.35, 2.5 * sc, 0.2);
        const trem = this.gain(v, 0.85);
        this.lfo(v, t, t + 2.5 * sc, rand(7, 11), 0.15, trem.gain);
        trem.connect(v.out);
        this.burst(v, { t, a: 0.3 * sc, hold: 0.5 * sc, d: 0.5 * sc, vol: 1, ft: 'bandpass', f: 5500 * p, f2: 4500 * p, Q: 1.2, to: trem });
        this.burst(v, { t, a: 0.35 * sc, hold: 0.4 * sc, d: 0.4 * sc, vol: 0.3, ft: 'highpass', f: 7000, Q: 0.5, to: trem });
        break;
      }
      case 'roar': {
        const v = V(0.5, 3, 0.35);
        const f = 85 * p;
        const end = t + 2.2;
        const sh = this.shaper(v);
        const lp = this.filt(v, 'lowpass', 750, 1.2);
        lp.frequency.setValueAtTime(750, t);
        lp.frequency.exponentialRampToValueAtTime(250, t + 1.6);
        const am = this.gain(v, 0.7);
        this.lfo(v, t, end, 27, 0.3, am.gain);
        const e = this.env(v, t, 0.12, 1, 0.8, 0.6);
        sh.connect(lp);
        lp.connect(am);
        am.connect(e);
        e.connect(v.out);
        for (const [mul, type, lvl] of [[1, 'sawtooth', 0.6], [1.013, 'sawtooth', 0.6], [0.5, 'sine', 1]] as const) {
          const o = this.osc(v, type, f * mul, t, end);
          o.frequency.exponentialRampToValueAtTime(f * mul * 1.12, t + 0.15);
          o.frequency.exponentialRampToValueAtTime(f * mul * 0.5, t + 1.5);
          const gn = this.gain(v, lvl);
          o.connect(gn);
          gn.connect(sh);
        }
        this.burst(v, { noise: 'brown', t, a: 0.1, hold: 0.5, d: 0.8, vol: 0.7, ft: 'bandpass', f: 260 * p, Q: 0.8, to: am });
        break;
      }
      case 'splash': {
        const v = V(0.45, 1.2, 0.25);
        this.burst(v, { t, a: 0.005, hold: 0.05, d: 0.6, vol: 0.8, ft: 'lowpass', f: 4000 * p, f2: 500, Q: 0.6 });
        this.burst(v, { noise: 'brown', t, a: 0.005, d: 0.3, vol: 0.7, ft: 'lowpass', f: 400 * p });
        const n = randi(4, 7);
        for (let i = 0; i < n; i++) {
          const f = rand(800, 2000) * p;
          this.tone(v, { f, f2: f * 1.6, glide: 0.03, t: t + rand(0.05, 0.5), a: 0.002, d: 0.05, vol: 0.12 });
        }
        break;
      }
      case 'rustle': {
        const v = V(0.35, 0.8, 0.1);
        this.synRustle(v, t, p);
        break;
      }
      case 'birdCall': {
        const v = V(0.3, 3, 0.35, true);
        this.synBird(v, t, p);
        break;
      }
      case 'chirp': {
        const v = V(0.25, 0.5, 0.25);
        const f = 2800 * p;
        this.tone(v, { f, f2: f * 1.5, glide: 0.06, t, a: 0.004, d: 0.08, vol: 1, fm: { ratio: 2, index: 0.3 } });
        break;
      }
      case 'engine': {
        const v = V(0.3, 1.6, 0.05);
        const sh = this.shaper(v);
        const lp = this.filt(v, 'lowpass', 600, 1);
        const e = this.env(v, t, 0.05, 1, 0.5, 0.5);
        sh.connect(lp);
        lp.connect(e);
        e.connect(v.out);
        for (const mul of [1, 1.01]) {
          const o = this.osc(v, 'sawtooth', 50 * p * mul, t, t + 1.2);
          o.frequency.exponentialRampToValueAtTime(120 * p * mul, t + 0.4);
          o.frequency.exponentialRampToValueAtTime(70 * p * mul, t + 1);
          const gn = this.gain(v, 0.5);
          o.connect(gn);
          gn.connect(sh);
        }
        break;
      }
      case 'thunder': {
        const v = V(0.7, 5, 0.45, true);
        this.synThunder(v, t, true);
        break;
      }
      case 'alert': {
        const v = V(0.25, 0.8, 0.2);
        this.tone(v, { type: 'triangle', f: 740 * p, t, a: 0.004, hold: 0.04, d: 0.18, vol: 1 });
        this.tone(v, { type: 'triangle', f: 988 * p, t: t + 0.1, a: 0.004, hold: 0.05, d: 0.3, vol: 1 });
        this.tone(v, { f: 1976 * p, t: t + 0.1, a: 0.004, d: 0.2, vol: 0.2 });
        break;
      }
      case 'wrong': {
        const v = V(0.22, 0.7, 0.1);
        this.tone(v, { type: 'triangle', f: 311 * p, t, a: 0.004, hold: 0.06, d: 0.1, vol: 1 });
        this.tone(v, { type: 'triangle', f: 233 * p, t: t + 0.13, a: 0.004, hold: 0.08, d: 0.22, vol: 1 });
        break;
      }
      case 'pageTurn': {
        const v = V(0.3, 0.6, 0.08);
        this.burst(v, { t, a: 0.05, hold: 0.05, d: 0.15, vol: 0.7, ft: 'bandpass', f: 1200 * p, f2: 4000 * p, Q: 0.8 });
        this.burst(v, { t: t + 0.2, a: 0.001, d: 0.03, vol: 0.4, ft: 'highpass', f: 3000 * p, Q: 0.6 });
        break;
      }
      case 'bubble': {
        const v = V(0.3, 0.8, 0.3);
        this.synBubbles(v, t, p, randi(1, 3));
        break;
      }
      case 'wingFlap': {
        const v = V(0.35, 0.8, 0.1);
        this.synWing(v, t, p);
        break;
      }
      case 'croc': {
        const v = V(0.5, 2, 0.25);
        this.synCroc(v, t, p);
        break;
      }
      case 'dialogBlip': {
        if (now - this.lastBlip < 0.03) return;
        this.lastBlip = now;
        const v = V(0.07, 0.15, 0);
        this.tone(v, { f: 600 * p, t, a: 0.002, d: 0.035, vol: 1 });
        break;
      }
      case 'whoosh': {
        const v = V(0.35, 0.7, 0.1);
        const fl = this.burst(v, { noise: 'pink', t, a: 0.15, d: 0.3, vol: 1, ft: 'bandpass', f: 400 * p, Q: 1.2 });
        fl.frequency.setValueAtTime(400 * p, t);
        fl.frequency.exponentialRampToValueAtTime(1800 * p, t + 0.18);
        fl.frequency.exponentialRampToValueAtTime(600 * p, t + 0.45);
        break;
      }
    }
  }

  private bellNote(v: Voice, f: number, t: number, vol: number, decay: number): void {
    this.tone(v, { f, t, a: 0.002, d: decay, vol, fm: { ratio: 3.5, index: 0.6, decay: 0.25 } });
    this.tone(v, { f: f * 2, t, a: 0.002, d: decay * 0.4, vol: vol * 0.2 });
  }

  // ---- continuous engine & danger -------------------------------------------------

  private buildEngine(): { L: Layer; oscs: OscillatorNode[]; filt: BiquadFilterNode; putt: OscillatorNode } {
    const g = this.G;
    const L = this.newLayer(g.sfxBus);
    const sh = this.lNode(L, g.ctx.createWaveShaper());
    sh.curve = g.curve;
    const filt = this.lFilt(L, 'lowpass', 300, 1.2);
    const am = this.lGain(L, 0.75);
    const putt = this.lLfo(L, 10, 0.25, am.gain);
    const oscs: OscillatorNode[] = [];
    for (const [type, lvl] of [['sawtooth', 0.5], ['sawtooth', 0.5], ['triangle', 0.8]] as const) {
      const o = this.lOsc(L, type, 40);
      const gn = this.lGain(L, lvl);
      o.connect(gn);
      gn.connect(sh);
      oscs.push(o);
    }
    sh.connect(filt);
    filt.connect(am);
    am.connect(L.out);
    // road rumble
    this.bed(L, { kind: 'brown', ft: 'lowpass', f: 180, lvl: 0.6, rate: 0.3, depth: 0.3 });
    return { L, oscs, filt, putt };
  }

  private buildDanger(): Layer {
    const g = this.G;
    const L = this.newLayer(g.sfxBus);
    const lp = this.lFilt(L, 'lowpass', 380, 0.9);
    this.lLfo(L, 0.11, 150, lp.frequency);
    const swell = this.lGain(L, 0.8);
    this.lLfo(L, 0.23, 0.2, swell.gain);
    lp.connect(swell);
    swell.connect(L.out);
    for (const [type, f, lvl] of [['sine', 55, 0.8], ['sine', 55.9, 0.8], ['triangle', 110, 0.3], ['triangle', 116.5, 0.22], ['sawtooth', 82.4, 0.08]] as const) {
      const o = this.lOsc(L, type, f);
      const gn = this.lGain(L, lvl);
      o.connect(gn);
      gn.connect(lp);
    }
    return L;
  }

  private heartbeat(t: number, level: number): void {
    const g = this.G;
    const v = this.mkVoice(g.sfxBus, 0.35 + 0.35 * level, 0, 0.6, t, 0.05);
    this.tone(v, { f: 72, f2: 40, glide: 0.1, t, a: 0.004, d: 0.13, vol: 1 });
    this.tone(v, { f: 64, f2: 38, glide: 0.1, t: t + 0.19, a: 0.004, d: 0.12, vol: 0.6 });
  }

  // ---- music ----------------------------------------------------------------------

  private musicStep(st: MusicState, t0: number, sd: number): void {
    const d = st.def;
    const pos = st.step % d.bar;
    const bar = Math.floor(st.step / d.bar);
    const t = t0 + (pos % 2 === 1 ? sd * d.swing : 0);

    if (pos === 0 && bar % d.chordBars === 0) {
      st.chord = d.chords[Math.floor(bar / d.chordBars) % d.chords.length] as Chord;
      if (d.padVol > 0) this.pad(st, st.chord.notes, t, d.chordBars * d.bar * sd);
    }
    if (d.bassVol > 0 && d.bassSteps.includes(pos)) {
      const len = pos === 0 ? (d.bassSteps.length > 1 ? (d.bassSteps[1] as number) : d.bar) : d.bar - pos;
      this.bassNote(st, st.chord.root, t, len * sd, d.bassVol * (pos === 0 ? 1 : 0.7));
    }
    if (d.osti && d.ostiVol) {
      const vel = d.osti[pos % d.osti.length] ?? 0;
      if (vel > 0) this.ostiNote(st, st.chord.root + 12, t, d.ostiVol * vel);
    }
    if (d.arp && pos % d.arpEvery === 0 && Math.random() < d.arpProb) {
      const base = st.chord.notes.map((n) => n + d.arpShift);
      const pool = [...base, ...base.map((n) => n + 12)].sort((a, b) => a - b);
      let note: number;
      if (d.arpMode === 'updown') {
        if (st.arpI >= pool.length - 1) st.arpDir = -1;
        else if (st.arpI <= 0) st.arpDir = 1;
        st.arpI = clamp(st.arpI + st.arpDir, 0, pool.length - 1);
        note = pool[st.arpI] as number;
      } else {
        note = pick(pool);
      }
      const accent = pos === 0 ? 1.2 : 1;
      this.inst(st, d.arp, note, t, d.arpEvery * sd * 2, d.arpVol * accent * rand(0.75, 1));
    }
    if (d.lead) this.leadStep(st, d.lead, t, sd, pos);
    st.step++;
  }

  private leadStep(st: MusicState, lead: Inst, t: number, sd: number, pos: number): void {
    const d = st.def;
    if (st.hold > 0) {
      st.hold--;
      return;
    }
    if (st.rest > 0) {
      st.rest--;
      return;
    }
    const strong = pos % d.sub === 0;
    if (Math.random() >= d.leadDensity * (strong ? 1 : 0.45)) return;
    const n = d.scale.length;
    let move = pick(WALK);
    // Gentle gravity towards the middle of the range.
    if (st.deg > n * 0.7 && move > 0 && Math.random() < 0.5) move = -move;
    if (st.deg < n * 0.3 && move < 0 && Math.random() < 0.5) move = -move;
    let deg = st.deg + move;
    if (deg < 0) deg = -deg;
    if (deg >= n) deg = 2 * (n - 1) - deg;
    deg = clamp(deg, 0, n - 1);
    if (strong || st.phrase <= 1) deg = this.snapToChord(d.scale, deg, st.chord.notes);
    st.deg = deg;
    const len = randi(d.leadLen[0], d.leadLen[1]);
    st.hold = len - 1;
    this.inst(st, lead, d.scale[deg] as number, t, len * sd, d.leadVol * rand(0.8, 1));
    st.phrase--;
    if (st.phrase <= 0) {
      st.phrase = randi(4, 9);
      st.rest = randi(Math.floor(d.bar / 2), Math.floor(d.bar * 1.5));
    }
  }

  private snapToChord(scale: number[], deg: number, chord: number[]): number {
    const pcs = new Set(chord.map((n) => ((n % 12) + 12) % 12));
    for (const off of [0, -1, 1, -2, 2]) {
      const i = deg + off;
      const m = scale[i];
      if (m !== undefined && pcs.has(m % 12)) return i;
    }
    return deg;
  }

  private musicVoice(st: MusicState, vol: number, life: number, t: number, pan = rand(-0.35, 0.35)): Voice {
    return this.mkVoice(st.out, vol, pan, life, t, st.def.send, st.def.long);
  }

  private inst(st: MusicState, inst: Inst, midi: number, t: number, dur: number, vol: number): void {
    const f = mtof(midi);
    switch (inst) {
      case 'pluck': {
        // kalimba / marimba: sine + short FM + tine partial
        const v = this.musicVoice(st, vol, 1.8, t);
        this.tone(v, { f, t, a: 0.003, d: 1.3, vol: 1, fm: { ratio: 1, index: 1.1, decay: 0.12 } });
        if (f * 5.4 < 12000) this.tone(v, { f: f * 5.4, t, a: 0.001, d: 0.05, vol: 0.12 });
        this.tone(v, { f: f * 2, t, a: 0.002, d: 0.3, vol: 0.12 });
        break;
      }
      case 'harp': {
        const v = this.musicVoice(st, vol, 2.4, t);
        this.tone(v, { type: 'triangle', f, t, a: 0.004, d: 2, vol: 0.8, fm: { ratio: 1, index: 0.5, decay: 0.08 } });
        this.tone(v, { f: f * 2, t, a: 0.003, d: 0.8, vol: 0.2 });
        break;
      }
      case 'bell': {
        const decay = st.def.arp === 'bell' && st.def.arpEvery <= 1 ? 1.2 : 2.4;
        const v = this.musicVoice(st, vol, decay + 0.3, t, rand(-0.6, 0.6));
        this.bellNote(v, f, t, 1, decay);
        break;
      }
      case 'flute': {
        const hold = Math.max(0.05, dur - 0.1);
        const v = this.musicVoice(st, vol, hold + 0.8, t);
        const end = t + 0.1 + hold + 0.5;
        const o = this.osc(v, 'sine', f, t, end);
        const o2 = this.osc(v, 'sine', f * 2, t, end);
        const vib = this.osc(v, 'sine', rand(4.6, 5.4), t, end);
        const vd = this.gain(v, 0);
        vd.gain.setValueAtTime(0, t);
        vd.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.5, hold));
        vib.connect(vd);
        vd.connect(o.frequency);
        const h2 = this.gain(v, 0.12);
        o2.connect(h2);
        const e = this.env(v, t, 0.1, 1, 0.38, hold);
        o.connect(e);
        h2.connect(e);
        e.connect(v.out);
        this.burst(v, { noise: 'white', t, a: 0.03, d: 0.14, vol: 0.1, ft: 'bandpass', f: Math.min(9000, f * 2), Q: 3 });
        break;
      }
    }
  }

  private pad(st: MusicState, notes: number[], t: number, len: number): void {
    const d = st.def;
    const attack = Math.min(d.padAttack, len * 0.5);
    const release = 1.8;
    const v = this.musicVoice(st, d.padVol, len + release + 0.2, t, 0);
    const end = t + len + release + 0.1;
    const lp = this.filt(v, 'lowpass', d.padCut, 0.3);
    lp.frequency.setValueAtTime(d.padCut * 0.5, t);
    lp.frequency.linearRampToValueAtTime(d.padCut, t + attack);
    const e = this.env(v, t, attack, 1, release, Math.max(0, len - attack));
    lp.connect(e);
    e.connect(v.out);
    for (const n of notes) {
      const f = mtof(n);
      const a = this.osc(v, 'sawtooth', f, t, end);
      a.detune.value = 7;
      const b = this.osc(v, 'triangle', f, t, end);
      b.detune.value = -7;
      const ga = this.gain(v, 0.5);
      a.connect(ga);
      ga.connect(lp);
      b.connect(lp);
    }
  }

  private bassNote(st: MusicState, midi: number, t: number, dur: number, vol: number): void {
    const v = this.musicVoice(st, vol, dur + 0.8, t, 0);
    const f = mtof(midi);
    const hold = Math.max(0, dur * 0.4);
    this.tone(v, { f, t, a: 0.02, hold, d: dur * 0.7 + 0.2, vol: 1 });
    this.tone(v, { type: 'triangle', f: f * 2, t, a: 0.02, hold: hold * 0.5, d: dur * 0.4, vol: 0.12 });
  }

  private ostiNote(st: MusicState, midi: number, t: number, vol: number): void {
    const v = this.musicVoice(st, vol, 0.5, t, 0);
    const f = mtof(midi);
    const lp = this.filt(v, 'lowpass', 700, 2);
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.2);
    const e = this.env(v, t, 0.005, 1, 0.24);
    lp.connect(e);
    e.connect(v.out);
    const a = this.osc(v, 'triangle', f, t, t + 0.35);
    const b = this.osc(v, 'sawtooth', f * 1.003, t, t + 0.35);
    const gb = this.gain(v, 0.35);
    a.connect(lp);
    b.connect(gb);
    gb.connect(lp);
    this.tone(v, { f: f / 2, t, a: 0.005, d: 0.2, vol: 0.6 });
  }
}

export const audio: AudioEngine = new AudioEngine();
