/**
 * Procedural audio for Project Zealandia.
 *
 * Everything is synthesized with the Web Audio API: no audio files, no deps.
 *
 * Graph:
 *   ambience layers ─┐
 *   ambient events ──┴─ ambBase (storm duck) ─┐
 *   storm layer ─ stormLp (tent muffle) ───────┴─ ambBus ─┐
 *   world sfx ──────────────────────────────────── sfxBus ─┴─ worldFilter (underwater) ─ muffle (setMuffle) ─┐
 *   music sessions ──── musicBus ── musicFilter ──────────────────────────────────────────────────────────────┤
 *   ui sfx ───────────── uiBus ───────────────────────────────────────────────────────────────────────────────┤
 *   world voice sends ─ wSend lowpass (muffle) ─┐                                                             │
 *   ui/music sends ─────────────────────────────┴─ revShort/revLong ─ lowpass ─ convolver ────────────────────┴─ master ─ compressor ─ out
 */

export type Ambience =
  | 'camp' | 'forest' | 'canopy' | 'falls' | 'mangrove' | 'coast' | 'underwater' | 'ocean' | 'storm'
  | 'boatCalm' | 'boatStorm' | 'beach' | 'tent' | 'jungle' | 'none';
export type Sfx =
  | 'shutter' | 'focus' | 'zoom' | 'recStart' | 'recStop' | 'step' | 'stepSoft' | 'jump' | 'land'
  | 'ui' | 'uiBack' | 'uiOpen' | 'discover' | 'fact' | 'star' | 'coin' | 'place' | 'hiss' | 'roar'
  | 'splash' | 'rustle' | 'birdCall' | 'chirp' | 'engine' | 'thunder' | 'alert' | 'wrong' | 'pageTurn'
  | 'bubble' | 'wingFlap' | 'croc' | 'dialogBlip' | 'whoosh'
  // camp life, crafting & research
  | 'hammer' | 'saw' | 'rope' | 'zipper' | 'pluck' | 'dig' | 'netSwish' | 'jarClink' | 'collectPop'
  | 'munch' | 'gulp' | 'craft' | 'skillUnlock' | 'typing' | 'scanBeep' | 'lanternOn' | 'fireLight'
  // speech bubbles & emotes
  | 'bubblePop' | 'emoteSurprise' | 'emoteQuestion' | 'emoteLaugh' | 'emoteAngry' | 'emoteHeart' | 'emoteSweat'
  // world
  | 'jumpscare' | 'rustleBush' | 'waveCrash' | 'woodCreak' | 'thunderClose' | 'gust' | 'splashBig'
  | 'stepSand' | 'stepWood' | 'stepLeaves' | 'shipCrash'
  // fishing: the reel's ratchet, line tearing off the drag, the catch fanfare
  | 'reelClick' | 'reelDrag' | 'catchJingle'
  // water on the island: wading steps, cave drips, the babble of running water
  | 'stepWater' | 'drip' | 'trickle'
  // animal vocalizations: the pitch param sets the caller's size/voice (<1 bigger & slower, >1 smaller & quicker)
  | 'callChirp' | 'callTrill' | 'callHoot' | 'callScreech' | 'callHiss' | 'callRattle' | 'callGrunt'
  | 'callBark' | 'callSqueak' | 'callGrowl' | 'callHonk' | 'callCroak' | 'callClick' | 'callWhale' | 'callPurr';
export type Music =
  | 'title' | 'camp' | 'explore' | 'night' | 'tension' | 'wonder'
  | 'voyage' | 'storm' | 'castaway' | 'build' | 'spooky' | 'aroha' | 'lab' | 'none';
/** The animal vocalization subset of {@link Sfx}. */
export type AnimalCall = Extract<Sfx, `call${string}`>;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const randi = (a: number, b: number): number => Math.floor(a + Math.random() * (b - a + 1));
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)] as T;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => (Number.isFinite(v) ? clamp(v, 0, 1) : 0);
/** Smoothstep: 0 at `a`, 1 at `b`. */
const sstep = (x: number, a: number, b: number): number => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

/** 'drops' is a sparse field of tiny impacts: rain, grit, sand, crunch. */
type NoiseKind = 'white' | 'pink' | 'brown' | 'drops';
type Curve = WaveShaperNode['curve'];

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  worldFilter: BiquadFilterNode;
  /** setMuffle low-pass on the whole world (ambience + world sfx). */
  muffle: BiquadFilterNode;
  musicFilter: BiquadFilterNode;
  revFilters: BiquadFilterNode[];
  musicBus: GainNode;
  sfxBus: GainNode;
  uiBus: GainNode;
  ambBus: GainNode;
  /** Ambience layers + their events; ducked while a storm is raging. */
  ambBase: GainNode;
  ambEvents: GainNode;
  revShort: GainNode;
  revLong: GainNode;
  /** World reverb sends, muffled together with the world. */
  wSendS: BiquadFilterNode;
  wSendL: BiquadFilterNode;
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
  drops: AudioBuffer;
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
  /** destination override (e.g. the muffled world outside the tent) */
  bus?: AudioNode;
  /** reverb send multiplier */
  send?: number;
}

/** Crossfadable storm beds. */
interface StormBeds {
  rainLight: GainNode;
  rainHeavy: GainNode;
  windLow: GainNode;
  windHigh: GainNode;
  wavesLow: GainNode;
  wavesHigh: GainNode;
  canvas: GainNode | null;
}

const STORM_KEYS = ['rainLight', 'rainHeavy', 'windLow', 'windHigh', 'wavesLow', 'wavesHigh', 'canvas'] as const;

/** Bed gains for storm intensity `lv` (0..1) and sea exposure `ww`. */
const stormMix = (lv: number, ww: number): Record<keyof StormBeds, number> => ({
  rainLight: 0.09 * sstep(lv, 0.02, 0.35) * (1 - 0.4 * sstep(lv, 0.6, 1)),
  rainHeavy: 0.2 * sstep(lv, 0.3, 0.95),
  windLow: 0.06 * sstep(lv, 0, 0.35),
  windHigh: 0.15 * sstep(lv, 0.35, 1),
  wavesLow: 0.08 * sstep(lv, 0.05, 0.45) * ww,
  wavesHigh: 0.24 * sstep(lv, 0.4, 1) * ww,
  canvas: 0.14 * sstep(lv, 0.03, 0.7),
});

type StormTimer = 'thunder' | 'surge' | 'gust' | 'flap';

/** The global setStorm() layer. */
interface StormState {
  L: Layer;
  beds: StormBeds;
  /** event input (thunder, surges) */
  input: GainNode;
  /** outside level + low-pass (muffled while in the tent) */
  ext: GainNode;
  lp: BiquadFilterNode;
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

type Inst = 'pluck' | 'harp' | 'flute' | 'bell' | 'reed' | 'guitar' | 'epiano' | 'marimba' | 'strings';
type Perc = 'kick' | 'tom' | 'tomHi' | 'snare' | 'hat' | 'shaker' | 'clap' | 'wood' | 'heart' | 'crackle' | 'boom';
type PadType = 'soft' | 'strings' | 'reed' | 'drone';

interface PercPart {
  k: Perc;
  /** velocity per step, indexed by the running step so a pattern may span several bars */
  pat: number[];
  vol: number;
  prob?: number;
  /** probability and velocity grow through the track's tension cycle (see MusicDef.rise) */
  rise?: boolean;
}

/** Chord comping: strums/stabs of the current chord. */
interface CompPart {
  inst: Inst;
  pat: number[];
  vol: number;
  /** semitone shift of the voicing */
  shift?: number;
  /** seconds between strummed notes (offbeats strum upwards) */
  strum?: number;
  /** note length in steps */
  len?: number;
}

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
  /** semitone offset from the chord root for each entry of bassSteps (default: root) */
  bassNotes?: number[];
  padType?: PadType;
  comp?: CompPart;
  perc?: PercPart[];
  /** bars per tension cycle: rise-parts build up and a riser swells into the next downbeat */
  rise?: number;
  /** overall session level (default 1) */
  gain?: number;
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
  // Breezy 6/8 sea-shanty chill in G: concertina tune, oom-pa-pa bass & guitar, soft shaker.
  voyage: {
    bpm: 72, sub: 3, bar: 6, chordBars: 2, swing: 0,
    chords: [
      C(43, [55, 59, 62]), C(48, [55, 60, 64]), C(43, [55, 59, 62]), C(50, [54, 57, 62]),
      C(40, [55, 59, 64]), C(48, [55, 60, 64]), C(50, [54, 57, 62]), C(43, [55, 59, 62]),
    ],
    scale: [62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79],
    lead: 'reed', leadVol: 0.06, leadDensity: 0.55, leadLen: [1, 3],
    padVol: 0.012, padCut: 1500, padAttack: 0.5, padType: 'reed',
    bassVol: 0.08, bassSteps: [0, 3], bassNotes: [0, 7],
    arp: null, arpVol: 0, arpEvery: 1, arpProb: 0, arpShift: 0, arpMode: 'random',
    comp: { inst: 'guitar', pat: [0, 0.8, 0.55, 0, 0.75, 0.5], vol: 0.03, strum: 0.012, len: 1 },
    perc: [
      { k: 'shaker', pat: [0.7, 0.3, 0.45, 0.6, 0.3, 0.45], vol: 0.03 },
      { k: 'kick', pat: [1, 0, 0, 0.5, 0, 0], vol: 0.08 },
    ],
    long: false, send: 0.22, fadeIn: 2, gain: 1.85,
  },
  // Driving D minor storm: pounding toms, tremolo strings, rising into a riser every 8 bars.
  storm: {
    bpm: 124, sub: 2, bar: 8, chordBars: 1, swing: 0,
    chords: [
      C(38, [50, 53, 57]), C(38, [50, 53, 57]), C(46, [50, 53, 58]), C(48, [52, 55, 60]),
      C(43, [50, 55, 58]), C(46, [53, 58, 62]), C(45, [52, 57, 61]), C(45, [55, 57, 61]),
    ],
    scale: [62, 64, 65, 67, 69, 70, 73, 74, 76, 77],
    lead: 'strings', leadVol: 0.04, leadDensity: 0.3, leadLen: [2, 4],
    padVol: 0.022, padCut: 1300, padAttack: 0.3, padType: 'strings',
    bassVol: 0, bassSteps: [],
    arp: null, arpVol: 0, arpEvery: 1, arpProb: 0, arpShift: 0, arpMode: 'random',
    osti: [1, 0.35, 0.6, 0.35, 0.9, 0.35, 0.6, 0.45], ostiVol: 0.1,
    perc: [
      { k: 'tom', pat: [1, 0, 0, 0.75, 0, 0, 0.85, 0], vol: 0.2 },
      { k: 'tomHi', pat: [0, 0, 0, 0, 0, 0.6, 0, 0.7, 0, 0, 0.5, 0, 0, 0.6, 0.75, 0.85], vol: 0.12, rise: true },
      { k: 'snare', pat: [0, 0, 0.6, 0, 0, 0, 0.6, 0.3], vol: 0.04, rise: true },
      { k: 'shaker', pat: [0.6, 0.3, 0.5, 0.3], vol: 0.018 },
    ],
    rise: 8,
    long: false, send: 0.22, fadeIn: 1, gain: 2.2,
  },
  // The morning after the wreck: sparse guitar, soft pad, lydian curiosity, a hopeful glow.
  castaway: {
    bpm: 72, sub: 2, bar: 8, chordBars: 2, swing: 0.05,
    chords: [C(48, [55, 60, 62, 67]), C(50, [54, 57, 62, 66]), C(45, [55, 60, 64, 67]), C(41, [57, 60, 64, 67])],
    scale: [67, 69, 71, 72, 74, 76, 79, 81],
    lead: 'guitar', leadVol: 0.075, leadDensity: 0.3, leadLen: [1, 4],
    padVol: 0.022, padCut: 900, padAttack: 2.5,
    bassVol: 0.05, bassSteps: [0],
    arp: 'bell', arpVol: 0.016, arpEvery: 2, arpProb: 0.18, arpShift: 12, arpMode: 'random',
    long: true, send: 0.42, fadeIn: 3, gain: 1.1,
  },
  // Light, bouncy camp-building in F: marimba hooks, clap backbeat, bubbly bass.
  build: {
    bpm: 112, sub: 2, bar: 8, chordBars: 1, swing: 0.12,
    chords: [
      C(41, [57, 60, 65]), C(48, [55, 60, 64]), C(50, [57, 62, 65]), C(46, [58, 62, 65]),
      C(41, [57, 60, 65]), C(48, [55, 60, 64]), C(46, [58, 62, 65]), C(48, [55, 58, 64]),
    ],
    scale: [65, 67, 69, 72, 74, 77, 79, 81, 84],
    lead: 'marimba', leadVol: 0.1, leadDensity: 0.55, leadLen: [1, 2],
    padVol: 0.014, padCut: 1400, padAttack: 0.3,
    bassVol: 0.075, bassSteps: [0, 3, 4, 6], bassNotes: [0, 7, 12, 7],
    arp: 'pluck', arpVol: 0.028, arpEvery: 2, arpProb: 0.4, arpShift: 12, arpMode: 'updown',
    comp: { inst: 'pluck', pat: [0, 0, 0.8, 0, 0, 0, 0.8, 0.5], vol: 0.02, strum: 0.004, len: 1 },
    perc: [
      { k: 'kick', pat: [1, 0, 0, 0, 0.85, 0, 0, 0], vol: 0.1 },
      { k: 'clap', pat: [0, 0, 1, 0, 0, 0, 1, 0], vol: 0.05 },
      { k: 'shaker', pat: [0.6, 0.35, 0.5, 0.35, 0.6, 0.35, 0.5, 0.4], vol: 0.022 },
      { k: 'wood', pat: [0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0.5, 0, 0], vol: 0.035, prob: 0.7 },
    ],
    long: false, send: 0.2, fadeIn: 1.5, gain: 1.7,
  },
  // Night investigation: low drone, sparse eerie harp, a music-box glint, the odd heartbeat.
  spooky: {
    bpm: 60, sub: 2, bar: 8, chordBars: 2, swing: 0,
    chords: [C(33, [45, 52, 57]), C(34, [46, 53, 58]), C(33, [45, 51, 57]), C(32, [44, 51, 56])],
    scale: [69, 70, 72, 75, 76, 77, 81, 82],
    lead: 'harp', leadVol: 0.05, leadDensity: 0.14, leadLen: [2, 5],
    padVol: 0.036, padCut: 520, padAttack: 3, padType: 'drone',
    bassVol: 0, bassSteps: [],
    arp: 'bell', arpVol: 0.013, arpEvery: 4, arpProb: 0.12, arpShift: 24, arpMode: 'random',
    perc: [{ k: 'heart', pat: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], vol: 0.3, prob: 0.4 }],
    long: true, send: 0.5, fadeIn: 3, gain: 0.9,
  },
  // Warm, confident theme for the guide in A: strummed + fingerpicked guitar, gentle groove.
  aroha: {
    bpm: 86, sub: 2, bar: 8, chordBars: 1, swing: 0.1,
    chords: [
      C(45, [57, 61, 64]), C(49, [56, 61, 64]), C(50, [57, 62, 66]), C(52, [56, 59, 64]),
      C(45, [57, 61, 64]), C(42, [57, 61, 66]), C(50, [57, 62, 66]), C(52, [56, 59, 62, 64]),
    ],
    scale: [64, 66, 68, 69, 71, 73, 76, 78, 80, 81],
    lead: 'guitar', leadVol: 0.085, leadDensity: 0.45, leadLen: [1, 3],
    padVol: 0.012, padCut: 1000, padAttack: 1,
    bassVol: 0.075, bassSteps: [0, 3, 4], bassNotes: [0, 0, 7],
    arp: null, arpVol: 0, arpEvery: 1, arpProb: 0, arpShift: 0, arpMode: 'random',
    comp: { inst: 'guitar', pat: [0.9, 0, 0.55, 0.4, 0, 0.45, 0.6, 0.35], vol: 0.022, strum: 0.016, len: 2 },
    perc: [
      { k: 'kick', pat: [1, 0, 0, 0, 0.7, 0, 0, 0], vol: 0.075 },
      { k: 'shaker', pat: [0.5, 0.25, 0.4, 0.25], vol: 0.02 },
      { k: 'wood', pat: [0, 0, 1, 0, 0, 0, 1, 0], vol: 0.022 },
    ],
    long: false, send: 0.28, fadeIn: 2, gain: 1.8,
  },
  // Lo-fi laptop research loop: dusty keys, lazy swing, soft boom-bap, vinyl crackle.
  lab: {
    bpm: 76, sub: 2, bar: 8, chordBars: 1, swing: 0.16,
    chords: [C(41, [52, 57, 60, 64]), C(40, [50, 55, 59, 62]), C(38, [53, 57, 60, 64]), C(43, [53, 57, 59, 64])],
    scale: [64, 65, 67, 69, 72, 74, 76, 79],
    lead: 'epiano', leadVol: 0.05, leadDensity: 0.22, leadLen: [1, 3],
    padVol: 0.01, padCut: 800, padAttack: 0.8,
    bassVol: 0.07, bassSteps: [0, 5],
    arp: null, arpVol: 0, arpEvery: 1, arpProb: 0, arpShift: 0, arpMode: 'random',
    comp: { inst: 'epiano', pat: [0.9, 0, 0, 0.5, 0, 0, 0.6, 0], vol: 0.028, strum: 0.008, len: 3 },
    perc: [
      { k: 'kick', pat: [1, 0, 0, 0, 0, 0.7, 0, 0, 1, 0, 0, 0.45, 0, 0, 0.6, 0], vol: 0.1 },
      { k: 'snare', pat: [0, 0, 1, 0, 0, 0, 1, 0], vol: 0.05 },
      { k: 'hat', pat: [0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.5], vol: 0.02 },
      { k: 'crackle', pat: [1], vol: 0.012, prob: 0.3 },
    ],
    long: false, send: 0.2, fadeIn: 2, gain: 1.9,
  },
};

const LOOKAHEAD = 0.3;
const MUSIC_SCALE = 0.6;
const WALK = [-3, -2, -1, -1, -1, 0, 1, 1, 1, 2, 3];

const UI_SFX: ReadonlySet<Sfx> = new Set<Sfx>([
  'shutter', 'focus', 'zoom', 'recStart', 'recStop', 'ui', 'uiBack', 'uiOpen', 'discover', 'fact',
  'star', 'coin', 'place', 'alert', 'wrong', 'pageTurn', 'dialogBlip',
  // v2: overlays, feedback and the player's own devices stay clear of setMuffle / underwater
  'bubblePop', 'emoteSurprise', 'emoteQuestion', 'emoteLaugh', 'emoteAngry', 'emoteHeart', 'emoteSweat',
  'collectPop', 'skillUnlock', 'craft', 'typing', 'scanBeep', 'jumpscare',
  'reelClick', 'reelDrag', 'catchJingle',
]);

/** Minimum seconds between repeats of the same sfx (per pitch bucket for animal calls). */
const THROTTLE: Partial<Record<Sfx, number>> = {
  stepSand: 0.07, stepWood: 0.07, stepLeaves: 0.07, stepWater: 0.08, drip: 0.05, trickle: 0.12, typing: 0.2, bubblePop: 0.045, collectPop: 0.035,
  scanBeep: 0.12, hammer: 0.07, saw: 0.18, rope: 0.15, zipper: 0.25, pluck: 0.06, dig: 0.08,
  netSwish: 0.08, jarClink: 0.08, munch: 0.08, gulp: 0.12, craft: 0.15, skillUnlock: 0.2,
  lanternOn: 0.2, fireLight: 0.3, emoteSurprise: 0.08, emoteQuestion: 0.08, emoteLaugh: 0.1,
  emoteAngry: 0.1, emoteHeart: 0.1, emoteSweat: 0.08, jumpscare: 0.8, rustleBush: 0.08,
  waveCrash: 0.15, woodCreak: 0.12, thunderClose: 0.3, gust: 0.15, splashBig: 0.1, shipCrash: 1,
  reelClick: 0.018, reelDrag: 0.06, catchJingle: 1,
};
const CALL_THROTTLE = 0.05;
/** Loud one-shots never get pushed past these per-play volumes (keeps them out of clipping). */
const VOL_CAP: Partial<Record<Sfx, number>> = {
  jumpscare: 1.2, shipCrash: 1.3, thunderClose: 1.3, waveCrash: 1.5, splashBig: 2, gust: 2,
  woodCreak: 2, callWhale: 1.5, callGrowl: 2, fireLight: 2, skillUnlock: 2,
};

interface CallDef {
  vol: number;
  /** voice lifetime at pitch 1 (scaled by the call's tempo factor) */
  life: number;
  send: number;
  long?: boolean;
}

const CALLS: Record<AnimalCall, CallDef> = {
  callChirp: { vol: 0.25, life: 0.9, send: 0.25, long: true },
  callTrill: { vol: 0.2, life: 1.2, send: 0.25, long: true },
  callHoot: { vol: 0.35, life: 1.8, send: 0.4, long: true },
  callScreech: { vol: 0.3, life: 1.6, send: 0.35, long: true },
  callHiss: { vol: 0.3, life: 0.9, send: 0.15 },
  callRattle: { vol: 0.28, life: 1.3, send: 0.15 },
  callGrunt: { vol: 0.4, life: 1.1, send: 0.2 },
  callBark: { vol: 0.35, life: 1.1, send: 0.3, long: true },
  callSqueak: { vol: 0.2, life: 0.6, send: 0.2 },
  callGrowl: { vol: 0.45, life: 2.2, send: 0.3 },
  callHonk: { vol: 0.35, life: 1.7, send: 0.3, long: true },
  callCroak: { vol: 0.35, life: 1.3, send: 0.3 },
  callClick: { vol: 0.25, life: 1.4, send: 0.2 },
  callWhale: { vol: 0.5, life: 6.5, send: 0.6, long: true },
  callPurr: { vol: 0.4, life: 2.8, send: 0.1 },
};
const isCall = (s: Sfx): s is AnimalCall => s.startsWith('call');
/** Tempo factor for animal calls: bigger (lower) voices call slower. */
const callK = (p: number): number => clamp(1 / Math.sqrt(p), 0.6, 1.7);

/** Outdoor ambiences that can be heard (muffled) from inside the tent. */
const TENT_EXT: ReadonlySet<Ambience> = new Set<Ambience>([
  'camp', 'forest', 'canopy', 'falls', 'mangrove', 'coast', 'storm', 'beach', 'jungle',
]);
/** How much open sea the storm's wave layers get per ambience (default 1). */
const WAVE_W: Partial<Record<Ambience, number>> = {
  forest: 0.25, canopy: 0.25, falls: 0.25, jungle: 0.25, mangrove: 0.55, underwater: 0.6,
};
const MUFFLE_MIN = 320;
const OPEN = 18000;

const NIGHT_CHORUS = [[4300, 23, -0.5], [5150, 31, 0.5], [3700, 17, 0]] as const;
/** Daytime jungle insects: buzzier, faster pulses. */
const DAY_CHORUS = [[6300, 47, -0.6], [3350, 13, 0.45], [7600, 71, 0.1]] as const;

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
  private lastPlay = new Map<string, number>();

  /** tent exterior: explicit request, last outdoor ambience, and what is currently built */
  private wantExt: Ambience | undefined = undefined;
  private lastOutdoor: Ambience = 'beach';
  private curExt: Ambience = 'none';
  /** destination/send override while an ambient event fires */
  private evBus: AudioNode | null = null;
  private evSend = 1;

  private storm = 0;
  private stormApplied = 0;
  private stormL: StormState | null = null;
  private stormNext: Record<StormTimer, number> = { thunder: 0, surge: 0, gust: 0, flap: 0 };

  private muffleAmt = 0;
  private muffleApplied = 0;

  private heart = 0;

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
        this.setAmbience(a, this.wantNight, this.wantExt);
        this.setMusic(m);
        if (this.engineLevel > 0) this.setEngine(this.engineLevel);
        if (this.danger > 0) this.setDanger(this.danger);
        if (this.storm > 0) this.setStorm(this.storm);
        if (this.muffleAmt > 0) this.setMuffle(this.muffleAmt);
        // setHeartbeat needs no graph: update() picks this.heart up.
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

  /**
   * Switch the ambient bed (2 s crossfade). Safe to call every frame.
   * For 'tent', `outside` picks the muffled exterior heard through the canvas; it defaults to the
   * last outdoor ambience that was set (or 'beach').
   */
  setAmbience(a: Ambience, night = false, outside?: Ambience): void {
    this.wantAmb = a;
    this.wantNight = !!night;
    this.wantExt = outside;
    if (TENT_EXT.has(a)) this.lastOutdoor = a;
    const g = this.g;
    if (!g) return;
    try {
      const ext: Ambience = a === 'tent' ? (outside !== undefined && TENT_EXT.has(outside) ? outside : this.lastOutdoor) : 'none';
      if (a === this.curAmb && this.wantNight === this.curNight && ext === this.curExt && (this.ambLayer || a === 'none')) return;
      this.curAmb = a;
      this.curNight = this.wantNight;
      this.curExt = ext;
      const now = g.ctx.currentTime;
      if (this.ambLayer) this.killLayer(this.ambLayer, 2);
      this.ambLayer = null;
      this.ambEvents = [];
      if (a !== 'none') {
        const L = this.newLayer(g.ambBase);
        this.ambEvents = this.buildAmbience(L, a, this.wantNight, ext);
        L.out.gain.setValueAtTime(0, now);
        L.out.gain.linearRampToValueAtTime(1, now + 2);
        this.ambLayer = L;
      }
      // Underwater: muffle the world, soften music and reverbs.
      const uw = a === 'underwater';
      g.worldFilter.frequency.setTargetAtTime(uw ? 650 : 18000, now, uw ? 0.3 : 0.5);
      g.musicFilter.frequency.setTargetAtTime(uw ? 1500 : 18000, now, 0.5);
      for (const f of g.revFilters) f.frequency.setTargetAtTime(uw ? 1100 : 6500, now, 0.5);
      // The storm layer adapts to where we are (tent muffling, sea exposure).
      this.applyStorm();
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
      out.gain.linearRampToValueAtTime(def.gain ?? 1, now + def.fadeIn);
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
      if (!(vol > 0)) return;
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

  /**
   * Storm intensity 0..1, crossfaded over whatever ambience is active: rain, wind and sea layers,
   * with random thunder, surges and gusts from ~0.3 up. 1 = a violent ocean storm.
   * Safe to call every frame.
   */
  setStorm(level: number): void {
    const lv = clamp01(level);
    this.storm = lv;
    const g = this.g;
    if (!g) return;
    try {
      const d = Math.abs(lv - this.stormApplied);
      if (d < 1e-4 || (d < 0.01 && lv > 0 && lv < 1)) return;
      const prev = this.stormApplied;
      this.stormApplied = lv;
      if (lv > 0 && !this.stormL) this.stormL = this.buildStorm();
      this.applyStorm();
      if (lv === 0 && prev > 0) {
        const S = this.stormL;
        setTimeout(() => {
          if (this.storm === 0 && S && this.stormL === S) {
            this.stormL = null;
            this.killLayer(S.L, 1);
          }
        }, 4000);
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Global low-pass on the ambience + world sfx (and their reverb), 0 = open, 1 = heavily muffled.
   * UI sounds and music stay clear. Safe to call every frame.
   */
  setMuffle(amount: number): void {
    const a = clamp01(amount);
    this.muffleAmt = a;
    const g = this.g;
    if (!g) return;
    try {
      const d = Math.abs(a - this.muffleApplied);
      if (d < 1e-4 || (d < 0.005 && a > 0 && a < 1)) return;
      this.muffleApplied = a;
      const f = OPEN * Math.pow(MUFFLE_MIN / OPEN, a);
      const now = g.ctx.currentTime;
      for (const n of [g.muffle, g.wSendS, g.wSendL]) n.frequency.setTargetAtTime(f, now, 0.06);
    } catch {
      /* ignore */
    }
  }

  /** Heartbeat pulse only (no drone), 0..1: louder and faster as it rises. Safe to call every frame. */
  setHeartbeat(level: number): void {
    this.heart = clamp01(level);
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
          this.fireEv(ev.fn, ev.bus ?? null, ev.send ?? 1);
        }
      }

      // Storm: thunder, surges, gusts.
      if (this.stormL && this.storm > 0.02) this.stormEvents(this.stormL, now);

      // Heartbeat (danger drone and/or setHeartbeat).
      const dl = this.danger > 0.02 && this.dangerLayer ? this.danger : 0;
      const hl = this.heart > 0.02 ? this.heart : 0;
      if (dl > 0 || hl > 0) {
        if (this.nextBeat < now - 0.5) this.nextBeat = now + 0.05;
        if (this.nextBeat < now + LOOKAHEAD) {
          const lv = Math.max(dl, hl);
          const vol = Math.max(dl > 0 ? 0.35 + 0.35 * dl : 0, hl > 0 ? 0.12 + 0.5 * hl : 0);
          this.heartbeat(this.nextBeat, vol, hl > 0 ? 1 : 0);
          this.nextBeat += 1.15 - 0.6 * lv;
        }
      }
    } catch {
      /* ignore */
    }
  }

  /** Fire an ambient event, optionally into a different bus (muffled exterior, storm layer). */
  private fireEv(fn: () => void, bus: AudioNode | null, send: number): void {
    this.evBus = bus;
    this.evSend = send;
    try {
      fn();
    } finally {
      this.evBus = null;
      this.evSend = 1;
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
    // Safety soft-clip after the compressor: transparent below ~-1 dBFS, never exceeds full scale.
    const pre = ctx.createGain();
    pre.gain.value = 0.5;
    const safe = ctx.createWaveShaper();
    safe.curve = this.softClip();
    // no oversampling: its anti-alias filter would ring past full scale on clipped material
    safe.oversample = 'none';
    comp.connect(pre);
    pre.connect(safe);
    safe.connect(ctx.destination);

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
    const muffle = lp(OPEN);
    muffle.Q.value = 0;
    worldFilter.connect(muffle);
    muffle.connect(master);
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

    const ambBase = ctx.createGain();
    ambBase.gain.value = 1;
    ambBase.connect(ambBus);

    const ambEvents = ctx.createGain();
    ambEvents.gain.value = 1;
    ambEvents.connect(ambBase);

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
    const wSend = (dest: GainNode): BiquadFilterNode => {
      const f = lp(OPEN);
      f.Q.value = 0;
      f.connect(dest);
      return f;
    };
    const wSendS = wSend(rs.input);
    const wSendL = wSend(rl.input);

    const noise = (kind: NoiseKind, secs: number): AudioBuffer => {
      const len = Math.floor(ctx.sampleRate * secs);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      if (kind === 'drops') {
        // ~120 tiny decaying impacts per second, mostly soft with the odd fat one.
        const count = Math.floor(secs * 120);
        for (let k = 0; k < count; k++) {
          const pos = Math.floor(Math.random() * len);
          const amp = 0.12 + 0.88 * Math.pow(Math.random(), 2.5);
          const tau = ctx.sampleRate * rand(0.0006, 0.0035);
          const m = Math.min(len - pos, Math.floor(tau * 5));
          for (let j = 0; j < m; j++) d[pos + j] += amp * (Math.random() * 2 - 1) * Math.exp(-j / tau);
        }
        return buf;
      }
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
      ctx, master, worldFilter, muffle, musicFilter, revFilters: [rs.filt, rl.filt],
      musicBus, sfxBus, uiBus, ambBus, ambBase, ambEvents,
      revShort: rs.input, revLong: rl.input, wSendS, wSendL,
      white: noise('white', 3), pink: noise('pink', 4), brown: noise('brown', 4), drops: noise('drops', 5),
      curve,
    };
  }

  /** Curve over input x in [-2, 2] (the shaper is fed at half gain): linear to 0.89, then a tanh knee to 0.98. */
  private softClip(): NonNullable<Curve> {
    const n = 4096;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = ((i / (n - 1)) * 2 - 1) * 2;
      const a = Math.abs(x);
      c[i] = a <= 0.89 ? x : Math.sign(x) * (0.89 + 0.09 * Math.tanh((a - 0.89) / 0.09));
    }
    return c;
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

  /**
   * One-shot voice. `world` voices (default: anything on the sfx/ambience-event buses) send their
   * reverb through the world send filters so setMuffle muffles the tail too.
   */
  private mkVoice(bus: AudioNode, vol: number, pan: number, life: number, t: number, send = 0.15, long = false, world?: boolean): Voice {
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
      const w = world ?? (bus === g.sfxBus || bus === g.ambEvents);
      s.connect(w ? (long ? g.wSendL : g.wSendS) : long ? g.revLong : g.revShort);
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

  /** Night insect chorus: pulsed high sines ([freq, pulse rate, pan] per voice). */
  private chorus(L: Layer, lvl: number, set: readonly (readonly [number, number, number])[] = NIGHT_CHORUS): void {
    for (const [f, am, pan] of set) {
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

  private buildAmbience(L: Layer, a: Ambience, night: boolean, ext: Ambience = 'beach'): AmbEvent[] {
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
      case 'boatCalm':
        // Open-sea swell against a wooden hull, a steady diesel below decks.
        waves(0.07, 380, 0.08);
        wind(night ? 0.03 : 0.04, 700);
        this.diesel(L, 0.055);
        E(() => this.evLap(), 1.2, 3.2);
        E(() => this.evCreak(false), 3, 9);
        E(() => this.evRope(false), 2.5, 7);
        if (night) {
          E(() => this.evMoan(), 35, 70);
        } else {
          E(() => this.evSeabird(), 7, 16);
        }
        break;
      case 'boatStorm': {
        // A fixed, violent storm at sea (setStorm adds on top only lightly).
        const b = this.stormBeds(L, L.out, false);
        const mix = stormMix(0.95, 1);
        for (const key of STORM_KEYS) {
          const n = b[key];
          if (n) n.gain.value = mix[key];
        }
        E(() => this.evCreak(true), 2, 5);
        E(() => this.evHullCrash(rand(0.6, 1)), 4, 9);
        E(() => this.evGust(), 3, 7);
        E(() => this.evRope(true), 1.5, 4);
        E(() => this.evThunder(), 7, 16);
        E(() => this.evThunderClose(), 16, 36);
        break;
      }
      case 'beach':
        // Surf rolling in and drawing back over sand; palms in the trade wind.
        this.bed2(L, { kind: 'brown', ft: 'lowpass', f: 320, Q: 0.5, lvl: 0.07, rate: 0.09, depth: 0.5 });
        wind(night ? 0.024 : 0.035, 700);
        this.bed2(L, { kind: 'white', ft: 'bandpass', f: 2600, Q: 0.9, lvl: night ? 0.008 : 0.016, rate: 0.09, depth: 0.85, fdepth: 700 });
        E(() => this.evSurf(), 5, 9);
        E(() => this.evPalm(), 5, 13);
        if (night) {
          this.chorus(L, 0.009);
          E(cricket, 0.8, 2.5);
          E(frog, 2, 6);
        } else {
          E(() => this.evSeabird(), 10, 24);
          E(() => this.evGull(), 16, 34);
        }
        break;
      case 'tent': {
        // The world outside, heard through canvas (its events are muffled and dry too).
        const og = this.lGain(L, 0.55);
        const lp = this.lFilt(L, 'lowpass', 700, 0);
        og.connect(lp);
        lp.connect(L.out);
        const outside: Layer = { out: og, nodes: L.nodes, srcs: L.srcs };
        for (const e of this.buildAmbience(outside, ext === 'tent' ? 'beach' : ext, night)) {
          e.bus = og;
          e.send = 0;
          ev.push(e);
        }
        // Cosy room tone and a faint lantern hiss.
        this.bed(L, { kind: 'brown', ft: 'lowpass', f: 150, lvl: 0.035, rate: 0.05, depth: 0.2 });
        this.bed(L, { kind: 'pink', ft: 'bandpass', f: 380, Q: 0.4, lvl: 0.008 });
        this.bed(L, { kind: 'white', ft: 'bandpass', f: 5200, Q: 0.6, lvl: 0.006, rate: 0.35, depth: 0.2 });
        E(() => this.evCanvas(), 7, 18);
        E(() => this.evLanternTick(), 9, 24);
        break;
      }
      case 'jungle':
        // Dense, humid and alive, with many species talking over each other.
        wind(0.018, 420);
        leaves(night ? 0.01 : 0.018);
        E(drip, 0.8, 2.6);
        E(() => this.evRustle(), 5, 12);
        if (night) {
          this.chorus(L, 0.012);
          E(cricket, 0.4, 1.4);
          E(frog, 0.6, 2);
          E(() => this.evCall('callCroak', 0.1), 1.5, 4);
          E(hoot, 8, 18);
          E(() => this.evCall('callHoot', 0.1), 10, 24);
          E(() => this.evStrange(), 8, 18);
          E(() => this.evCall('callClick', 0.07), 5, 12);
          E(() => this.evCall('callTrill', 0.05, 0.6, 0.9), 4, 9);
          E(() => this.evCall('callGrowl', 0.06, 0.8, 1), 45, 90);
        } else {
          cicada(0.008);
          this.bed(L, { kind: 'white', ft: 'bandpass', f: rand(4400, 5200), Q: 5, lvl: 0.006, rate: 0.06, depth: 0.9, am: 63 });
          this.chorus(L, 0.004, DAY_CHORUS);
          E(bird, 0.8, 2.6);
          E(insect, 2, 6);
          E(() => this.evCicada(), 6, 14);
          E(() => this.evCall('callChirp', 0.09), 2, 5);
          E(() => this.evCall('callTrill', 0.07), 3, 7);
          E(() => this.evCall('callSqueak', 0.06), 10, 25);
          E(() => this.evCall('callClick', 0.06), 8, 18);
          E(() => this.evCall('callCroak', 0.08), 5, 12);
          E(() => this.evCall('callBark', 0.07), 15, 35);
          E(() => this.evCall('callGrunt', 0.08), 18, 40);
          E(() => this.evCall('callHonk', 0.07), 18, 40);
          E(() => this.evCall('callScreech', 0.06, 0.85, 1.1), 20, 45);
          E(frog, 4, 10);
          E(() => this.evWing(), 12, 25);
        }
        break;
      case 'none':
        break;
    }
    return ev;
  }

  /** Low marine diesel below decks: firing pulses through a closed low-pass, a faint mechanical rattle. */
  private diesel(L: Layer, lvl: number): void {
    const lp = this.lFilt(L, 'lowpass', 190, 0.8);
    const gn = this.lGain(L, lvl);
    this.lLfo(L, 0.13, lvl * 0.15, gn.gain);
    lp.connect(gn);
    gn.connect(L.out);
    const f = rand(29, 33);
    for (const [type, mul, v] of [['sawtooth', 1, 0.5], ['square', 0.5, 0.35], ['triangle', 2, 0.25]] as const) {
      const o = this.lOsc(L, type, f * mul);
      o.detune.value = rand(-6, 6);
      const og = this.lGain(L, v);
      o.connect(og);
      og.connect(lp);
    }
    this.bed(L, { kind: 'brown', ft: 'bandpass', f: 115, Q: 1.2, lvl: lvl * 0.9, am: f * 0.5 });
  }

  // ---- storm ------------------------------------------------------------------------

  /** Rain / wind / sea beds, each on its own gain (all start silent). */
  private stormBeds(L: Layer, dest: AudioNode, canvas: boolean, canvasDest: AudioNode = dest): StormBeds {
    const sub = (to: AudioNode): { gn: GainNode; into: Layer } => {
      const gn = this.lGain(L, 0);
      gn.connect(to);
      return { gn, into: { out: gn, nodes: L.nodes, srcs: L.srcs } };
    };
    // light rain: scattered drops and a fine hiss
    const rl = sub(dest);
    this.bed(rl.into, { kind: 'drops', ft: 'bandpass', f: 3200, Q: 0.7, lvl: 1, rate: 0.13, depth: 0.25 });
    this.bed(rl.into, { kind: 'white', ft: 'highpass', f: 4500, Q: 0.4, lvl: 0.3, rate: 0.17, depth: 0.2 });
    // heavy, driving rain: dense hiss, splatter and a mid roar on hard surfaces
    const rh = sub(dest);
    this.bed2(rh.into, { kind: 'white', ft: 'highpass', f: 1800, Q: 0.4, lvl: 0.6, rate: 0.23, depth: 0.25 });
    this.bed(rh.into, { kind: 'drops', ft: 'bandpass', f: 2200, Q: 0.6, lvl: 1.2, rate: 0.31, depth: 0.3 });
    this.bed(rh.into, { kind: 'pink', ft: 'bandpass', f: 900, Q: 0.5, lvl: 0.9, rate: 0.11, depth: 0.2 });
    // wind: a moving breeze, then a roaring gale that howls
    const wl = sub(dest);
    this.bed2(wl.into, { kind: 'pink', ft: 'lowpass', f: 700, Q: 0.6, lvl: 1, rate: 0.07, depth: 0.6, fdepth: 280 });
    const wh = sub(dest);
    this.bed2(wh.into, { kind: 'pink', ft: 'lowpass', f: 1500, Q: 0.7, lvl: 1, rate: 0.13, depth: 0.7, fdepth: 700 });
    this.bed(wh.into, { kind: 'pink', ft: 'bandpass', f: 780, Q: 7, lvl: 1.4, rate: 0.09, depth: 0.8, fdepth: 260 });
    this.bed(wh.into, { kind: 'white', ft: 'bandpass', f: 2400, Q: 4, lvl: 0.25, rate: 0.17, depth: 0.9, fdepth: 800, pan: 0.4 });
    // sea: rolling swell, then huge breaking waves with whitecaps
    const vl = sub(dest);
    this.bed2(vl.into, { kind: 'brown', ft: 'lowpass', f: 420, Q: 0.5, lvl: 1, rate: 0.085, depth: 0.8, fdepth: 250 });
    const vh = sub(dest);
    this.bed2(vh.into, { kind: 'brown', ft: 'lowpass', f: 650, Q: 0.5, lvl: 1, rate: 0.06, depth: 0.85, fdepth: 400 });
    this.bed2(vh.into, { kind: 'white', ft: 'bandpass', f: 1400, Q: 0.4, lvl: 0.18, rate: 0.06, depth: 0.95 });
    let cv: GainNode | null = null;
    if (canvas) {
      // rain drumming on the tent: fat drops on a taut membrane
      const c = sub(canvasDest);
      this.bed(c.into, { kind: 'drops', ft: 'bandpass', f: 1100, Q: 1.1, lvl: 1.6, rate: 0.19, depth: 0.25 });
      this.bed(c.into, { kind: 'pink', ft: 'bandpass', f: 1500, Q: 0.7, lvl: 0.5, rate: 0.23, depth: 0.2 });
      this.bed(c.into, { kind: 'brown', ft: 'lowpass', f: 220, lvl: 0.5, rate: 0.15, depth: 0.3 });
      cv = c.gn;
    }
    return { rainLight: rl.gn, rainHeavy: rh.gn, windLow: wl.gn, windHigh: wh.gn, wavesLow: vl.gn, wavesHigh: vh.gn, canvas: cv };
  }

  private buildStorm(): StormState {
    const g = this.G;
    const L = this.newLayer(g.ambBus);
    const ext = this.lGain(L, 1);
    const lp = this.lFilt(L, 'lowpass', OPEN, 0);
    ext.connect(lp);
    lp.connect(L.out);
    const input = this.lGain(L, 1);
    input.connect(ext);
    const beds = this.stormBeds(L, ext, true, L.out);
    this.stormNext = { thunder: 0, surge: 0, gust: 0, flap: 0 };
    return { L, beds, input, ext, lp };
  }

  /** Push the storm level (and ambience-dependent routing) to the storm layer and the ambience duck. */
  private applyStorm(): void {
    const g = this.g;
    if (!g) return;
    const lv = this.stormApplied;
    const now = g.ctx.currentTime;
    g.ambBase.gain.setTargetAtTime(1 - 0.5 * sstep(lv, 0.15, 1), now, 0.5);
    const S = this.stormL;
    if (!S) return;
    const amb = this.curAmb;
    const tent = amb === 'tent';
    const self = amb === 'boatStorm' || amb === 'storm';
    const mix = stormMix(lv, WAVE_W[tent ? this.curExt : amb] ?? 1);
    const b = S.beds;
    for (const key of STORM_KEYS) {
      const n = b[key];
      if (n) n.gain.setTargetAtTime(key === 'canvas' && !tent ? 0 : mix[key], now, 0.4);
    }
    S.lp.frequency.setTargetAtTime(tent ? 700 : OPEN, now, 0.25);
    S.ext.gain.setTargetAtTime(tent ? 0.75 : 1, now, 0.25);
    S.L.out.gain.setTargetAtTime(self ? 0.55 : 1, now, 0.6);
  }

  /** Random storm events, timed on the audio clock. */
  private stormEvents(S: StormState, now: number): void {
    const lv = this.storm;
    const amb = this.curAmb;
    const tent = amb === 'tent';
    // Storm ambiences bring their own thunder, surges and gusts.
    const own = amb === 'boatStorm' || amb === 'storm';
    const ww = WAVE_W[tent ? this.curExt : amb] ?? 1;
    const boat = amb === 'boatCalm' || amb === 'boatStorm';
    const T = this.stormNext;
    const tick = (key: StormTimer, on: boolean, first: number, gap: () => number, fn: () => void, bus: AudioNode = S.input): void => {
      if (!on) {
        T[key] = 0;
        return;
      }
      if (T[key] === 0) {
        T[key] = now + rand(first * 0.3, first);
        return;
      }
      if (now < T[key]) return;
      T[key] = now + gap();
      this.fireEv(fn, bus, tent ? 0.2 : 1);
    };
    tick('thunder', !own && lv > 0.45, 8, () => rand(7, 20) * (1.9 - lv), () => {
      if (Math.random() < 0.15 + 0.5 * sstep(lv, 0.5, 1)) this.evThunderClose();
      else this.evThunder();
    });
    tick('surge', !own && lv > 0.35 && ww >= 0.5, 4, () => rand(3, 9) * (1.7 - lv), () => {
      if (boat) this.evHullCrash(0.4 + 0.5 * lv);
      else this.evBigWave(lv);
    });
    tick('gust', !own && lv > 0.25, 6, () => rand(4, 10) * (1.6 - lv), () => this.evGust());
    // the canvas itself flapping: right here, so not muffled
    tick('flap', tent && lv > 0.3, 5, () => rand(2.5, 7) * (1.5 - lv), () => this.evCanvas(1.6), S.L.out);
  }

  // ---- ambient events ---------------------------------------------------------

  private ev(vol: number, life: number, send = 0.3, long = false, spread = 0.9): { v: Voice; t: number } {
    const g = this.G;
    const t = g.ctx.currentTime + 0.03;
    const bus = this.evBus ?? g.ambEvents;
    const v = this.mkVoice(bus, vol * rand(0.45, 1), rand(-spread, spread), life, t, send * this.evSend, long, true);
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

  /** Water slopping against the planks of a wooden hull. */
  private evLap(): void {
    const { v, t } = this.ev(0.12, 1.5, 0.12, false, 0.6);
    const p = rand(0.8, 1.25);
    this.burst(v, { noise: 'pink', t, a: rand(0.06, 0.16), d: rand(0.3, 0.55), vol: 0.9, ft: 'bandpass', f: 380 * p, f2: 900 * p, Q: 0.9 });
    // the hull's hollow "clop"
    this.tone(v, { f: rand(95, 140) * p, f2: 60, t: t + rand(0.03, 0.09), a: 0.004, d: 0.16, vol: 0.4 });
    this.burst(v, { noise: 'brown', t, a: 0.01, d: 0.18, vol: 0.5, ft: 'lowpass', f: 350 });
    if (Math.random() < 0.5) this.burst(v, { noise: 'drops', t: t + 0.08, a: 0.02, d: 0.25, vol: 0.4, ft: 'bandpass', f: 2200 * p, Q: 0.8 });
  }
  private evCreak(big: boolean): void {
    const dur = big ? rand(0.9, 2) : rand(0.4, 0.9);
    const { v, t } = this.ev(big ? 0.2 : 0.07, dur + 1, big ? 0.3 : 0.2, false, 0.7);
    this.synCreak(v, t, rand(0.85, 1.15), dur, big, 1);
  }
  /** Halyard tapping the mast (whipping in a storm). */
  private evRope(storm: boolean): void {
    const { v, t } = this.ev(storm ? 0.08 : 0.05, 1.4, 0.2, false, 0.5);
    const n = storm ? randi(2, 5) : randi(1, 3);
    const f = rand(650, 1000);
    let s = t;
    for (let i = 0; i < n; i++) {
      this.burst(v, { t: s, a: 0.0008, d: 0.018, vol: 0.7, ft: 'bandpass', f: f * 2.3, Q: 2.5 });
      this.tone(v, { f: f * rand(0.97, 1.03), t: s, a: 0.001, d: 0.14, vol: 0.4, fm: { ratio: 2.76, index: 0.5, decay: 0.03 } });
      s += storm ? rand(0.08, 0.2) : rand(0.18, 0.4);
    }
  }
  private evSeabird(): void {
    const { v, t } = this.ev(0.07, 3.5, 0.4, true, 0.8);
    this.synSeabird(v, t, rand(0.88, 1.12));
  }
  /** One wave: rolls in, breaks, and draws back fizzing over the sand. */
  private evSurf(): void {
    const k = rand(0.85, 1.25);
    const { v, t } = this.ev(0.34, 8 * k + 1, 0.1, false, 0.5);
    this.burst(v, { noise: 'pink', t, a: 1.5 * k, hold: 0.3, d: 1.6 * k, vol: 0.8, ft: 'lowpass', f: 280, f2: 1300, Q: 0.4 });
    this.burst(v, { noise: 'white', t: t + 1.35 * k, a: 0.3, d: 1.8 * k, vol: 0.3, ft: 'bandpass', f: 2000, f2: 700, Q: 0.5 });
    this.burst(v, { noise: 'white', t: t + 2.4 * k, a: 0.7, hold: 0.4 * k, d: 2.6 * k, vol: 0.16, ft: 'highpass', f: 2600, f2: 6000, Q: 0.5 });
    this.burst(v, { noise: 'drops', t: t + 2.6 * k, a: 0.6, hold: 0.5 * k, d: 2.2 * k, vol: 0.3, ft: 'bandpass', f: 3800, Q: 0.8 });
  }
  /** Palm fronds clattering in a gust. */
  private evPalm(): void {
    const { v, t } = this.ev(0.07, 1.8, 0.12);
    const n = randi(6, 12);
    for (let i = 0; i < n; i++) {
      this.burst(v, { t: t + rand(0, 1), a: 0.01, d: rand(0.03, 0.1), vol: rand(0.3, 0.9), ft: 'bandpass', f: rand(1400, 3200), Q: 2 });
    }
    this.burst(v, { noise: 'pink', t, a: 0.35, d: 0.8, vol: 0.4, ft: 'bandpass', f: 1800, Q: 0.7 });
  }
  /** The tent canvas shifting (or flapping hard in a storm when scale > 1). */
  private evCanvas(scale = 1): void {
    const { v, t } = this.ev(0.06 * scale, 1.5, 0.05, false, 0.6);
    this.burst(v, { noise: 'pink', t, a: 0.12 / scale, d: 0.4, vol: 0.9, ft: 'lowpass', f: 600 * scale, f2: 300, Q: 0.7 });
    this.synRustle(v, t + 0.05, 0.6);
  }
  private evLanternTick(): void {
    const { v, t } = this.ev(0.03, 0.6, 0.1, false, 0.3);
    this.tone(v, { f: rand(2600, 3400), t, a: 0.001, d: 0.05, vol: 0.6, fm: { ratio: 1.41, index: 0.5, decay: 0.02 } });
  }
  /** A cicada winding up and down: buzzy pulsed band of noise with a tonal core. */
  private evCicada(): void {
    const dur = rand(2.5, 5);
    const { v, t } = this.ev(0.05, dur + 2, 0.15, false, 0.9);
    const end = t + dur + 1.2;
    const f = rand(4800, 6800);
    const am = this.gain(v, 0.5);
    this.lfo(v, t, end, rand(90, 160), 0.5, am.gain, 'square');
    const e = this.env(v, t, dur * 0.45, 1, dur * 0.35 + 0.6, dur * 0.2);
    am.connect(e);
    e.connect(v.out);
    const src = this.noiseSrc(v, 'white', t, end);
    const bp = this.filt(v, 'bandpass', f, 3);
    bp.frequency.setValueAtTime(f * 0.94, t);
    bp.frequency.linearRampToValueAtTime(f * 1.04, t + dur * 0.6);
    src.connect(bp);
    bp.connect(am);
    const o = this.osc(v, 'sine', f, t, end);
    o.frequency.linearRampToValueAtTime(f * 1.04, t + dur * 0.6);
    const og = this.gain(v, 0.25);
    o.connect(og);
    og.connect(am);
  }
  /** A species calling from somewhere nearby, at a random voice pitch. */
  private evCall(kind: AnimalCall, vol: number, pmin = 0.85, pmax = 1.18): void {
    const p = rand(pmin, pmax);
    const c = CALLS[kind];
    const { v, t } = this.ev(vol, c.life * callK(p) + 0.3, c.send + 0.15, true);
    this.synCall(kind, v, t, p);
  }
  private evStrange(): void {
    const { v, t } = this.ev(0.07, 3.5, 0.5, true);
    this.synStrange(v, t, rand(0.85, 1.15));
  }
  private evHullCrash(scale: number): void {
    const { v, t } = this.ev(0.3 * scale, 3.5, 0.3, false, 0.6);
    this.synHullCrash(v, t, rand(0.85, 1.1));
  }
  private evThunderClose(): void {
    const { v, t } = this.ev(0.5, 6.5, 0.45, true, 0.5);
    this.synThunderClose(v, t, rand(0.9, 1.1));
  }
  private evGust(): void {
    const dur = rand(1.3, 2.4);
    const { v, t } = this.ev(0.14, dur * 1.3 + 1, 0.15, false, 0.8);
    this.synGust(v, t, rand(0.85, 1.2), dur);
  }
  private evBigWave(lv: number): void {
    const { v, t } = this.ev(0.14 + 0.1 * lv, 6, 0.2, false, 0.7);
    this.synBigWave(v, t, rand(0.85, 1.15));
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

  /** Stick-slip friction: a low-rate pulse train ringing a resonant timber body. `big` = groaning beams. */
  private synCreak(v: Voice, t: number, p: number, dur: number, big: boolean, vol: number): void {
    const end = t + dur + 0.3;
    const rate = (big ? rand(11, 22) : rand(24, 48)) * p;
    const o = this.osc(v, 'sawtooth', rate, t, end);
    o.frequency.linearRampToValueAtTime(rate * rand(0.55, 1.6), t + dur * rand(0.3, 0.7));
    o.frequency.linearRampToValueAtTime(rate * rand(0.5, 1.2), t + dur);
    this.lfo(v, t, end, rand(5, 9), rate * 0.18, o.frequency);
    const f1 = (big ? rand(240, 420) : rand(650, 1300)) * p;
    // narrow resonances pass only a few harmonics: make up the level
    const mk = clamp((f1 / rate) * 0.075, 0.5, 3.5);
    const bp = this.filt(v, 'bandpass', f1, big ? 3.5 : 5);
    const bp2 = this.filt(v, 'bandpass', f1 * rand(2.1, 2.9), big ? 4 : 6);
    const g2 = this.gain(v, 0.45);
    const e = this.env(v, t, dur * 0.25, vol * mk, dur * 0.35, dur * 0.4);
    o.connect(bp);
    o.connect(bp2);
    bp2.connect(g2);
    bp.connect(e);
    g2.connect(e);
    e.connect(v.out);
  }

  /** Raucous cries of big ocean fliers, sometimes with heavy wingbeats overhead. */
  private synSeabird(v: Voice, t: number, p: number): void {
    const n = randi(2, 4);
    const base = rand(560, 760) * p;
    const bp = this.filt(v, 'bandpass', base * 2.2, 1.2);
    const lp = this.filt(v, 'lowpass', 2800, 0.5);
    bp.connect(lp);
    lp.connect(v.out);
    let s = t;
    for (let i = 0; i < n; i++) {
      const f = base * rand(0.93, 1.07);
      const d = rand(0.22, 0.38);
      this.tone(v, {
        type: 'sawtooth', f, t: s, a: 0.02, hold: d * 0.4, d: d * 0.6, vol: 0.9,
        pts: [[d * 0.25, f * 1.3], [d, f * 0.78]], fm: { ratio: 0.5, index: 0.4 }, to: bp,
      });
      s += d + rand(0.06, 0.18);
    }
    if (Math.random() < 0.3) {
      for (let i = 0; i < 3; i++) {
        this.burst(v, { noise: 'pink', t: s + 0.1 + i * 0.32, a: 0.05, d: 0.18, vol: 0.5, ft: 'lowpass', f: 600, f2: 200, Q: 0.7 });
      }
    }
  }

  /** Lightning right overhead: a tearing crack, the boom, then a lumpy rolling rumble. */
  private synThunderClose(v: Voice, t: number, p: number): void {
    this.burst(v, { noise: 'white', t, a: 0.004, d: 0.4, vol: 0.9, ft: 'highpass', f: 1400 * p, f2: 350, Q: 0.5 });
    const n = randi(6, 10);
    for (let i = 0; i < n; i++) {
      this.burst(v, { t: t + 0.3 * Math.pow(Math.random(), 1.5), a: 0.001, d: rand(0.01, 0.04), vol: rand(0.35, 0.8), ft: 'bandpass', f: rand(1500, 5000) * p, Q: 0.8 });
    }
    this.burst(v, { noise: 'brown', t: t + 0.02, a: 0.02, hold: 0.25, d: 2.8, vol: 1, ft: 'lowpass', f: 900 * p, f2: 110, Q: 0.5 });
    this.tone(v, { f: 68 * p, f2: 30, t: t + 0.02, a: 0.012, d: 1.2, vol: 0.45 });
    const am = this.gain(v, 0.6);
    this.lfo(v, t + 0.6, t + 5.4, rand(2.5, 4.5), 0.4, am.gain);
    am.connect(v.out);
    this.burst(v, { noise: 'brown', t: t + 0.6, a: 0.5, hold: 0.8, d: 3.2, vol: 0.9, ft: 'lowpass', f: 260 * p, Q: 0.5, to: am });
  }

  /** A big wave slamming into the hull: boom, a sheet of spray, water raining back, timbers shuddering. */
  private synHullCrash(v: Voice, t: number, p: number): void {
    this.tone(v, { f: 62 * p, f2: 34, t, a: 0.006, d: 0.7, vol: 0.9 });
    this.burst(v, { noise: 'brown', t, a: 0.01, d: 0.8, vol: 1, ft: 'lowpass', f: 420 * p, f2: 120, Q: 0.6 });
    this.burst(v, { noise: 'pink', t: t + 0.03, a: 0.08, hold: 0.25, d: 1.8, vol: 0.8, ft: 'lowpass', f: 5200 * p, f2: 700, Q: 0.4 });
    this.burst(v, { noise: 'white', t: t + 0.12, a: 0.25, d: 1.8, vol: 0.28, ft: 'highpass', f: 2200, Q: 0.5 });
    this.burst(v, { noise: 'drops', t: t + 0.4, a: 0.3, hold: 0.4, d: 1.4, vol: 0.5, ft: 'bandpass', f: 2600, Q: 0.7 });
    this.synCreak(v, t + 0.1, 0.8 * p, rand(0.6, 1), true, 0.6);
  }

  /** A gust: swelling, whistling air. */
  private synGust(v: Voice, t: number, p: number, dur: number): void {
    const fl = this.burst(v, { noise: 'pink', t, a: dur * 0.4, hold: dur * 0.2, d: dur * 0.6, vol: 1, ft: 'bandpass', f: 380 * p, Q: 0.8 });
    fl.frequency.setValueAtTime(380 * p, t);
    fl.frequency.exponentialRampToValueAtTime(1100 * p, t + dur * 0.45);
    fl.frequency.exponentialRampToValueAtTime(500 * p, t + dur * 1.2);
    const wh = this.burst(v, { noise: 'white', t, a: dur * 0.45, hold: dur * 0.1, d: dur * 0.5, vol: 0.5, ft: 'bandpass', f: 850 * p, Q: 9 });
    wh.frequency.setValueAtTime(800 * p, t);
    wh.frequency.linearRampToValueAtTime(1150 * p, t + dur * 0.5);
    wh.frequency.linearRampToValueAtTime(850 * p, t + dur * 1.1);
    this.burst(v, { noise: 'brown', t, a: dur * 0.4, d: dur * 0.7, vol: 0.5, ft: 'lowpass', f: 250 });
  }

  /** A storm breaker rearing up and crashing down. */
  private synBigWave(v: Voice, t: number, p: number): void {
    this.burst(v, { noise: 'pink', t, a: 0.8, hold: 0.2, d: 2.8, vol: 1, ft: 'lowpass', f: 300 * p, f2: 2000 * p, Q: 0.4 });
    this.burst(v, { noise: 'brown', t: t + 0.8, a: 0.05, d: 1.6, vol: 0.9, ft: 'lowpass', f: 380 * p });
    this.tone(v, { f: 55 * p, f2: 32, t: t + 0.8, a: 0.02, d: 0.9, vol: 0.4 });
    this.burst(v, { noise: 'white', t: t + 0.85, a: 0.08, d: 2.4, vol: 0.28, ft: 'highpass', f: 2200, Q: 0.5 });
  }

  /** Unidentified night voices of the lost continent. */
  private synStrange(v: Voice, t: number, p: number): void {
    switch (randi(0, 3)) {
      case 0: {
        // eerie rising "whoo-oop" whistle
        const f = rand(500, 800) * p;
        const o = this.tone(v, { f, pts: [[0.35, f * 1.5], [0.6, f * 1.35], [0.9, f * 2]], t, a: 0.15, hold: 0.45, d: 0.35, vol: 0.7 });
        this.lfo(v, t, t + 1.1, 6, f * 0.02, o.frequency);
        break;
      }
      case 1: {
        // mournful descending wail
        const f = rand(700, 950) * p;
        const n = randi(3, 5);
        for (let i = 0; i < n; i++) {
          const fi = f * Math.pow(0.86, i);
          this.tone(v, { f: fi, f2: fi * 0.93, t: t + i * 0.55, a: 0.08, hold: 0.2, d: 0.3, vol: 0.6 - i * 0.08, fm: { ratio: 1, index: 0.12 } });
        }
        break;
      }
      case 2: {
        // chuckling "ko-ko-ko" that speeds up
        const f = rand(300, 420) * p;
        let s = t;
        let gap = 0.24;
        const n = randi(6, 10);
        for (let i = 0; i < n; i++) {
          this.tone(v, { type: 'triangle', f: f * (1 + i * 0.02), f2: f * 0.8, t: s, a: 0.01, d: 0.09, vol: 0.55, fm: { ratio: 1.5, index: 0.4 } });
          s += gap;
          gap *= 0.88;
        }
        break;
      }
      default: {
        // a wooden ratchet "krrrrk" from something unseen
        const dur = rand(0.4, 0.8);
        const end = t + dur + 0.3;
        const src = this.noiseSrc(v, 'pink', t, end);
        const bp = this.filt(v, 'bandpass', rand(700, 1100) * p, 3);
        const am = this.gain(v, 0.5);
        this.lfo(v, t, end, rand(24, 34), -0.5, am.gain, 'sawtooth');
        const e = this.env(v, t, 0.03, 2.5, 0.15, dur);
        src.connect(bp);
        bp.connect(am);
        am.connect(e);
        e.connect(v.out);
      }
    }
  }

  /** Deep, song-like moan (the sea serpent): harmonic stack, moving formant, slow vibrato. */
  private synWhale(v: Voice, t: number, p: number, k: number): void {
    const f = rand(62, 80) * p;
    const dur = rand(2.6, 3.8) * k;
    const end = t + dur + 2.2;
    const lp = this.filt(v, 'lowpass', 1100, 0.5);
    const pk = this.filt(v, 'peaking', 260 * p, 1.4);
    pk.gain.value = 9;
    pk.frequency.setValueAtTime(260 * p, t);
    pk.frequency.linearRampToValueAtTime(620 * p, t + dur * 0.45);
    pk.frequency.linearRampToValueAtTime(240 * p, t + dur + 1);
    const e = this.env(v, t, 0.9 * k, 0.5, 1.8, Math.max(0.2, dur - 0.9 * k));
    pk.connect(lp);
    lp.connect(e);
    e.connect(v.out);
    const vib = this.osc(v, 'sine', rand(3.2, 4.5), t, end);
    const vd = this.gain(v, 18);
    vib.connect(vd);
    for (const [mul, type, lvl] of [[1, 'triangle', 0.8], [2, 'sine', 0.35], [3.01, 'sine', 0.18], [4.02, 'sine', 0.08]] as const) {
      const o = this.osc(v, type, f * mul, t, end);
      o.frequency.exponentialRampToValueAtTime(f * mul * 1.55, t + dur * 0.4);
      o.frequency.exponentialRampToValueAtTime(f * mul * 1.2, t + dur * 0.75);
      o.frequency.exponentialRampToValueAtTime(f * mul * 0.82, t + dur + 1.2);
      vd.connect(o.detune);
      const gn = this.gain(v, lvl);
      o.connect(gn);
      gn.connect(pk);
    }
    if (Math.random() < 0.5) {
      this.tone(v, { f: f * 6, pts: [[dur * 0.3, f * 8], [dur * 0.7, f * 5.5]], t: t + dur * 0.2, a: 0.4, hold: dur * 0.3, d: 0.8, vol: 0.03 });
    }
    this.burst(v, { noise: 'brown', t, a: 1, hold: dur * 0.5, d: 1.5, vol: 0.125, ft: 'lowpass', f: 160 });
  }

  /** Animal vocalizations. `p` is the voice pitch; bigger (lower) animals also call slower. */
  private synCall(kind: AnimalCall, v: Voice, t: number, p: number): void {
    const k = callK(p);
    switch (kind) {
      case 'callChirp': {
        // small bird: quick "chip-chip" phrase
        const n = randi(2, 4);
        let s = t;
        for (let i = 0; i < n; i++) {
          const f = 3300 * p * rand(0.95, 1.06);
          const down = i === n - 1 && Math.random() < 0.5;
          this.tone(v, { f, f2: down ? f * 0.72 : f * 1.45, glide: 0.05 * k, t: s, a: 0.003, d: 0.06 * k, vol: 0.8, fm: { ratio: 2, index: 0.18 } });
          s += rand(0.08, 0.14) * k;
        }
        break;
      }
      case 'callTrill': {
        // insect or bird trill: a fast pulsed whistle
        const dur = rand(0.4, 0.8) * k;
        const end = t + dur + 0.2;
        const f = 4000 * p * rand(0.94, 1.06);
        const o = this.osc(v, 'sine', f, t, end);
        o.frequency.linearRampToValueAtTime(f * rand(0.9, 1.08), t + dur);
        const am = this.gain(v, 0.5);
        this.lfo(v, t, end, rand(24, 34) / k, 0.5, am.gain, 'triangle');
        const e = this.env(v, t, 0.03, 0.25, 0.08, dur);
        o.connect(am);
        am.connect(e);
        e.connect(v.out);
        if (Math.random() < 0.5) {
          const o2 = this.osc(v, 'sine', f * 2.02, t, end);
          const g2 = this.gain(v, 0.12);
          o2.connect(g2);
          g2.connect(am);
        }
        break;
      }
      case 'callHoot': {
        // owl: "hoo... hoo-hoo"
        const f = 380 * p * rand(0.96, 1.04);
        const n = randi(2, 3);
        const at = [0, 0.55, 0.85];
        for (let i = 0; i < n; i++) {
          const s = t + (at[i] ?? 0) * k;
          const hold = (i === 0 ? 0.16 : 0.1) * k;
          this.tone(v, { f, pts: [[0.05 * k, f * 1.05], [0.3 * k, f * 0.93]], t: s, a: 0.05 * k, hold, d: 0.2 * k, vol: 0.26, fm: { ratio: 1, index: 0.06 } });
          this.burst(v, { noise: 'pink', t: s, a: 0.05 * k, hold, d: 0.15 * k, vol: 0.02, ft: 'bandpass', f: f * 2, Q: 2 });
        }
        break;
      }
      case 'callScreech': {
        // raptor: a rasping descending "kee-eeer"
        const n = randi(1, 2);
        for (let i = 0; i < n; i++) {
          const s = t + i * 0.62 * k;
          const f = 2000 * p * rand(0.95, 1.05) * (i ? 0.94 : 1);
          const dur = (i ? 0.4 : 0.55) * k;
          const bp = this.filt(v, 'bandpass', f * 1.2, 1.4);
          bp.connect(v.out);
          this.tone(v, { type: 'sawtooth', f, pts: [[0.05 * k, f * 1.12], [dur, f * 0.7]], t: s, a: 0.015, hold: dur * 0.45, d: dur * 0.55, vol: 0.45, fm: { ratio: 0.5, index: 0.25 }, to: bp });
          this.tone(v, { f: f * 2, pts: [[0.05 * k, f * 2.2], [dur, f * 1.4]], t: s, a: 0.02, hold: dur * 0.3, d: dur * 0.5, vol: 0.065 });
        }
        break;
      }
      case 'callHiss': {
        // snake: a short sharp hiss
        const dur = rand(0.3, 0.5) * k;
        const trem = this.gain(v, 0.85);
        this.lfo(v, t, t + dur + 0.4, rand(9, 14), 0.15, trem.gain);
        trem.connect(v.out);
        this.burst(v, { t, a: 0.03, hold: dur * 0.5, d: dur * 0.5, vol: 1, ft: 'bandpass', f: 5200 * p, f2: 4400 * p, Q: 1.1, to: trem });
        this.burst(v, { t, a: 0.02, hold: dur * 0.4, d: dur * 0.4, vol: 0.35, ft: 'highpass', f: Math.min(7500 * p, 15000), Q: 0.5, to: trem });
        break;
      }
      case 'callRattle': {
        // tail or quill rattle: gated broadband buzz that slows as it fades
        const dur = rand(0.5, 0.9) * k;
        const end = t + dur + 0.4;
        const src = this.noiseSrc(v, 'white', t, end);
        const hp = this.filt(v, 'highpass', 2600 * p, 0.7);
        const am = this.gain(v, 0.5);
        const l = this.lfo(v, t, end, 50 / k, 0.5, am.gain, 'square');
        l.frequency.linearRampToValueAtTime(42 / k, t + dur);
        const e = this.env(v, t, 0.04, 0.5, 0.25, dur);
        src.connect(hp);
        hp.connect(am);
        am.connect(e);
        e.connect(v.out);
        break;
      }
      case 'callGrunt': {
        // pig/tapir-like herbivore: rough nasal grunts
        const n = randi(2, 3);
        for (let i = 0; i < n; i++) {
          const s = t + i * rand(0.2, 0.28) * k;
          const f = 100 * p * rand(0.9, 1.1);
          const dur = rand(0.1, 0.16) * k;
          const end = s + dur + 0.2;
          const o = this.osc(v, 'sawtooth', f, s, end);
          o.frequency.exponentialRampToValueAtTime(f * 0.72, s + dur + 0.1);
          const lp = this.filt(v, 'lowpass', 700 * p, 2.5);
          const am = this.gain(v, 0.6);
          this.lfo(v, s, end, 30, 0.4, am.gain, 'square');
          const e = this.env(v, s, 0.012, 0.5, 0.1, dur);
          o.connect(lp);
          lp.connect(am);
          am.connect(e);
          e.connect(v.out);
          this.burst(v, { noise: 'brown', t: s, a: 0.01, d: dur + 0.05, vol: 0.25, ft: 'lowpass', f: 500 * p });
        }
        break;
      }
      case 'callBark': {
        // small mammal alarm: sharp "yip!"s
        const n = randi(1, 3);
        for (let i = 0; i < n; i++) {
          const s = t + i * rand(0.26, 0.34) * k;
          const f = 620 * p * rand(0.95, 1.05);
          const bp = this.filt(v, 'bandpass', 1300 * p, 1.2);
          bp.connect(v.out);
          this.tone(v, { type: 'sawtooth', f, pts: [[0.02 * k, f * 1.35], [0.11 * k, f * 0.75]], t: s, a: 0.004, hold: 0.02 * k, d: 0.09 * k, vol: 1.25, to: bp });
          this.burst(v, { t: s, a: 0.003, d: 0.07 * k, vol: 0.35, ft: 'bandpass', f: 1900 * p, Q: 1 });
        }
        break;
      }
      case 'callSqueak': {
        // rodent: tiny high squeaks
        const n = randi(1, 3);
        for (let i = 0; i < n; i++) {
          const f = 4300 * p * rand(0.94, 1.08);
          this.tone(v, { f, pts: [[0.02 * k, f * 1.22], [0.07 * k, f * 0.92]], t: t + i * rand(0.09, 0.14) * k, a: 0.003, hold: 0.015 * k, d: 0.055 * k, vol: 0.56, fm: { ratio: 1.5, index: 0.08 } });
        }
        break;
      }
      case 'callGrowl': {
        // low threat: a gritty, swelling growl
        const f = 72 * p * rand(0.94, 1.06);
        const dur = rand(0.9, 1.3) * k;
        const end = t + dur + 0.8;
        const sh = this.shaper(v);
        const lp = this.filt(v, 'lowpass', 520 * p, 1.2);
        lp.frequency.setValueAtTime(380 * p, t);
        lp.frequency.linearRampToValueAtTime(620 * p, t + dur * 0.5);
        lp.frequency.linearRampToValueAtTime(320 * p, t + dur + 0.4);
        const am = this.gain(v, 0.65);
        this.lfo(v, t, end, rand(18, 24), 0.35, am.gain);
        const e = this.env(v, t, 0.25 * k, 0.56, 0.45, dur - 0.25 * k);
        sh.connect(lp);
        lp.connect(am);
        am.connect(e);
        e.connect(v.out);
        for (const [mul, type, lvl] of [[1, 'sawtooth', 0.35], [1.02, 'sawtooth', 0.35], [0.5, 'sine', 0.6]] as const) {
          const o = this.osc(v, type, f * mul, t, end);
          o.frequency.linearRampToValueAtTime(f * mul * 1.08, t + dur * 0.5);
          o.frequency.linearRampToValueAtTime(f * mul * 0.9, t + dur + 0.4);
          const gn = this.gain(v, lvl);
          o.connect(gn);
          gn.connect(sh);
        }
        this.burst(v, { noise: 'brown', t, a: 0.2, hold: dur * 0.6, d: 0.4, vol: 0.5, ft: 'bandpass', f: 240 * p, Q: 0.9, to: am });
        break;
      }
      case 'callHonk': {
        // stork: rapid wooden bill-clatter (accelerating), sometimes a nasal honk after
        const dur = rand(0.6, 1) * k;
        const end = t + dur + 0.3;
        const src = this.noiseSrc(v, 'white', t, end);
        const bp = this.filt(v, 'bandpass', 1500 * p, 6);
        const am = this.gain(v, 0.5);
        const l = this.lfo(v, t, end, 11 / k, -0.5, am.gain, 'sawtooth');
        l.frequency.linearRampToValueAtTime(17 / k, t + dur);
        const e = this.env(v, t, 0.02, 3, 0.15, dur);
        src.connect(bp);
        bp.connect(am);
        am.connect(e);
        e.connect(v.out);
        if (Math.random() < 0.55) {
          const s = t + dur + 0.08;
          const f = 290 * p * rand(0.95, 1.05);
          const fb = this.filt(v, 'bandpass', 950 * p, 1.6);
          fb.connect(v.out);
          this.tone(v, { type: 'sawtooth', f, pts: [[0.05 * k, f * 1.1], [0.3 * k, f * 0.86]], t: s, a: 0.02, hold: 0.12 * k, d: 0.16 * k, vol: 0.8, to: fb });
        }
        break;
      }
      case 'callCroak': {
        // frog: a pulsed, throaty "rrrk"
        const n = randi(1, 2);
        for (let i = 0; i < n; i++) {
          const s = t + i * rand(0.38, 0.5) * k;
          const f = 145 * p * rand(0.93, 1.07);
          const dur = rand(0.18, 0.3) * k;
          const end = s + dur + 0.2;
          const o = this.osc(v, 'sawtooth', f, s, end);
          o.frequency.linearRampToValueAtTime(f * 1.15, s + dur);
          const bp = this.filt(v, 'bandpass', 520 * p, 2.5);
          const am = this.gain(v, 0.5);
          this.lfo(v, s, end, 42 * Math.sqrt(p), 0.5, am.gain, 'square');
          const e = this.env(v, s, 0.02, 1.35, 0.07, dur);
          o.connect(bp);
          bp.connect(am);
          am.connect(e);
          e.connect(v.out);
        }
        break;
      }
      case 'callClick': {
        // dry clicks, speeding up or slowing down
        const n = randi(4, 9);
        let s = t;
        let gap = rand(0.05, 0.09) * k;
        const accel = Math.random() < 0.5 ? 0.86 : 1.12;
        for (let i = 0; i < n; i++) {
          this.burst(v, { t: s, a: 0.0008, d: rand(0.005, 0.01), vol: rand(2.6, 4.5), ft: 'bandpass', f: 3000 * p * rand(0.9, 1.1), Q: 3 });
          s += gap;
          gap = clamp(gap * accel, 0.025, 0.2);
        }
        break;
      }
      case 'callWhale': {
        this.synWhale(v, t, p, k);
        break;
      }
      case 'callPurr': {
        // content mammal: buzzing purr on breath cycles (out louder, in softer)
        const cycles = randi(2, 3);
        const cyc = 0.85 * k;
        const end = t + cycles * cyc + 0.4;
        const rate = 26 * Math.sqrt(p);
        const o = this.osc(v, 'sawtooth', rate, t, end);
        const bp = this.filt(v, 'bandpass', 260 * p, 1.4);
        const src = this.noiseSrc(v, 'brown', t, end);
        const nb = this.filt(v, 'bandpass', 320 * p, 1);
        const am = this.gain(v, 0.5);
        this.lfo(v, t, end, rate, 0.45, am.gain);
        const br = this.gain(v, 0);
        for (let c = 0; c < cycles; c++) {
          const s = t + c * cyc;
          br.gain.setValueAtTime(0, s);
          br.gain.linearRampToValueAtTime(1, s + 0.08 * k);
          br.gain.linearRampToValueAtTime(0.8, s + 0.45 * k);
          br.gain.linearRampToValueAtTime(0.25, s + 0.52 * k);
          br.gain.linearRampToValueAtTime(0.45, s + 0.75 * k);
          br.gain.linearRampToValueAtTime(0.05, s + 0.84 * k);
        }
        br.gain.linearRampToValueAtTime(0, t + cycles * cyc + 0.05);
        o.connect(bp);
        bp.connect(am);
        src.connect(nb);
        nb.connect(am);
        am.connect(br);
        br.connect(v.out);
        break;
      }
    }
  }

  // ---- sfx --------------------------------------------------------------------

  private sfx(s: Sfx, vol0: number, p: number, pan: number): void {
    const g = this.G;
    const vol = Math.min(vol0, VOL_CAP[s] ?? 4);
    const now = g.ctx.currentTime;
    const t = now + 0.005;
    const bus = UI_SFX.has(s) ? g.uiBus : g.sfxBus;
    const V = (level: number, life: number, send = 0.15, long = false): Voice => this.mkVoice(bus, level * vol, pan, life, t, send, long);

    // Throttle rapid repeats (animal calls per species/pitch bucket, so a chorus still overlaps).
    const th = isCall(s) ? CALL_THROTTLE : THROTTLE[s];
    if (th !== undefined) {
      const key = isCall(s) ? `${s}:${Math.round(Math.log2(p) * 12)}` : s;
      const last = this.lastPlay.get(key);
      if (last !== undefined && now - last < th) return;
      this.lastPlay.set(key, now);
    }
    if (isCall(s)) {
      const c = CALLS[s];
      this.synCall(s, V(c.vol, c.life * callK(p) + 0.3, c.send, c.long ?? false), t, p);
      return;
    }

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
      case 'reelClick': {
        // one pawl click of the reel's ratchet: a hard metallic tick with a tiny ring
        const v = V(0.22, 0.12, 0.03);
        this.burst(v, { t, a: 0.0004, d: 0.016, vol: 0.9, ft: 'bandpass', f: 3400 * p, Q: 5 });
        this.tone(v, { type: 'triangle', f: 2100 * p, f2: 1500 * p, t, a: 0.0005, d: 0.022, vol: 0.2 });
        break;
      }
      case 'reelDrag': {
        // line tearing off the drag: a fast buzzing ratchet
        const v = V(0.2, 0.22, 0.04);
        const end = t + 0.14;
        const src = this.noiseSrc(v, 'white', t, end);
        const bp = this.filt(v, 'bandpass', 2800 * p, 3);
        const teeth = this.gain(v, 0.5);
        this.lfo(v, t, end, 62 * p, 0.5, teeth.gain, 'square');
        const e = this.env(v, t, 0.004, 1, 0.12);
        src.connect(bp);
        bp.connect(teeth);
        teeth.connect(e);
        e.connect(v.out);
        this.tone(v, { type: 'sawtooth', f: 180 * p, t, a: 0.004, d: 0.1, vol: 0.05 });
        break;
      }
      case 'catchJingle': {
        // the catch fanfare: a bright little arpeggio up, a leap to the top and a held chord that sparkles
        const v = V(0.3, 3.4, 0.3, true);
        const lead: [number, number, number][] = [[79, 0, 0.06], [84, 0.11, 0.06], [88, 0.22, 0.06], [91, 0.33, 0.12], [88, 0.52, 0.05], [91, 0.62, 0.05], [96, 0.74, 0.55]];
        for (const [m, dt, hold] of lead) {
          this.tone(v, { type: 'square', f: mtof(m) * p, t: t + dt, a: 0.004, hold, d: hold > 0.3 ? 0.7 : 0.07, vol: 0.13 });
          this.bellNote(v, mtof(m) * p, t + dt, 0.42, hold > 0.3 ? 1.4 : 0.45);
        }
        for (const m of [72, 76, 79, 84]) this.tone(v, { type: 'triangle', f: mtof(m) * p, t: t + 0.74, a: 0.01, hold: 0.45, d: 0.9, vol: 0.16 });
        this.tone(v, { f: mtof(48) * p, t: t + 0.74, a: 0.01, hold: 0.3, d: 0.8, vol: 0.28 });
        for (let i = 0; i < 7; i++) this.bellNote(v, mtof(98 + [0, 4, 7][i % 3] + (i > 3 ? 12 : 0)) * p, t + 1.0 + i * 0.055, 0.13, 0.5);
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

      // ---- v2: camp life, crafting & research ----
      case 'hammer': {
        const pp = p * rand(0.94, 1.06);
        const v = V(0.7, 0.6, 0.1);
        this.tone(v, { f: 210 * pp, f2: 95 * pp, glide: 0.06, t, a: 0.001, d: 0.1, vol: 0.9 });
        this.burst(v, { noise: 'pink', t, a: 0.001, d: 0.07, vol: 0.9, ft: 'bandpass', f: 850 * pp, Q: 2.5 });
        this.burst(v, { t, a: 0.0005, d: 0.012, vol: 0.5, ft: 'highpass', f: 2800 * pp, Q: 0.7 });
        this.tone(v, { f: 3150 * pp, t, a: 0.001, d: 0.09, vol: 0.05, fm: { ratio: 1.47, index: 0.4, decay: 0.03 } });
        break;
      }
      case 'saw': {
        // push and pull strokes: teeth rasping through timber
        const v = V(0.3, 1.1, 0.06);
        for (const [s0, dur, up, lvl] of [[0, 0.32, true, 1], [0.38, 0.3, false, 0.75]] as const) {
          const s1 = t + s0;
          const end = s1 + dur + 0.1;
          const src = this.noiseSrc(v, 'white', s1, end);
          const bp = this.filt(v, 'bandpass', 2200 * p, 2.2);
          bp.frequency.setValueAtTime((up ? 1800 : 3000) * p, s1);
          bp.frequency.linearRampToValueAtTime((up ? 3000 : 1900) * p, s1 + dur);
          const teeth = this.gain(v, 0.55);
          this.lfo(v, s1, end, (up ? 80 : 65) * rand(0.9, 1.1), 0.45, teeth.gain, 'sawtooth');
          const e = this.env(v, s1, dur * 0.3, lvl, dur * 0.35, dur * 0.35);
          src.connect(bp);
          bp.connect(teeth);
          teeth.connect(e);
          e.connect(v.out);
        }
        this.burst(v, { noise: 'pink', t, a: 0.05, hold: 0.5, d: 0.2, vol: 0.25, ft: 'bandpass', f: 500 * p, Q: 1.5 });
        break;
      }
      case 'rope': {
        // fibres stretching, rope sliding through the knot, a snug tug
        const v = V(0.35, 1, 0.08);
        this.synCreak(v, t, 1.5 * p, 0.32, false, 0.7);
        this.burst(v, { t: t + 0.3, a: 0.04, d: 0.12, vol: 0.35, ft: 'bandpass', f: 1800 * p, f2: 2600 * p, Q: 1.5 });
        this.tone(v, { f: 160 * p, f2: 95 * p, t: t + 0.46, a: 0.003, d: 0.06, vol: 0.45 });
        this.burst(v, { noise: 'pink', t: t + 0.46, a: 0.002, d: 0.05, vol: 0.5, ft: 'bandpass', f: 600 * p, Q: 1.5 });
        break;
      }
      case 'zipper': {
        // tent zip: teeth clicking past the slider, speeding up
        const v = V(0.19, 0.9, 0.05);
        const dur = rand(0.45, 0.6);
        const end = t + dur + 0.15;
        const src = this.noiseSrc(v, 'white', t, end);
        const bp = this.filt(v, 'bandpass', 2600 * p, 1.6);
        bp.frequency.setValueAtTime(2300 * p, t);
        bp.frequency.linearRampToValueAtTime(3800 * p, t + dur);
        const teeth = this.gain(v, 0.5);
        const l = this.lfo(v, t, end, 70, -0.5, teeth.gain, 'sawtooth');
        l.frequency.linearRampToValueAtTime(150, t + dur * 0.8);
        const e = this.env(v, t, 0.03, 1, 0.06, dur);
        src.connect(bp);
        bp.connect(teeth);
        teeth.connect(e);
        e.connect(v.out);
        this.burst(v, { t: t + dur + 0.02, a: 0.0006, d: 0.015, vol: 0.4, ft: 'bandpass', f: 3000 * p, Q: 1.5 });
        break;
      }
      case 'pluck': {
        // picking a plant: leafy rustle, stem snap, roots letting go
        const v = V(0.32, 0.6, 0.06);
        this.synRustle(v, t, 0.85 * p);
        this.burst(v, { t: t + 0.12, a: 0.0005, d: 0.012, vol: 0.9, ft: 'highpass', f: 2200 * p, Q: 0.8 });
        this.tone(v, { type: 'triangle', f: 1300 * p, f2: 700 * p, t: t + 0.12, a: 0.001, d: 0.025, vol: 0.3 });
        this.tone(v, { f: 420 * p, f2: 220 * p, t: t + 0.14, a: 0.003, d: 0.06, vol: 0.35 });
        this.burst(v, { noise: 'brown', t: t + 0.13, a: 0.003, d: 0.07, vol: 0.4, ft: 'lowpass', f: 600 });
        break;
      }
      case 'dig': {
        // trowel biting into soil, then a scatter of earth
        const pp = p * rand(0.92, 1.08);
        const v = V(0.65, 0.6, 0.04);
        this.burst(v, { noise: 'pink', t, a: 0.01, hold: 0.03, d: 0.12, vol: 0.9, ft: 'bandpass', f: 750 * pp, Q: 1.1 });
        this.burst(v, { noise: 'drops', t, a: 0.01, d: 0.14, vol: 0.9, ft: 'bandpass', f: 2600 * pp, Q: 0.8 });
        this.tone(v, { f: 130 * pp, f2: 75, t, a: 0.003, d: 0.07, vol: 0.4 });
        this.burst(v, { noise: 'drops', t: t + 0.12, a: 0.02, d: 0.18, vol: 0.4, ft: 'bandpass', f: 1800 * pp, Q: 0.8 });
        break;
      }
      case 'netSwish': {
        const v = V(0.35, 0.7, 0.08);
        const fl = this.burst(v, { noise: 'pink', t, a: 0.08, hold: 0.05, d: 0.22, vol: 1, ft: 'bandpass', f: 500 * p, Q: 1.4 });
        fl.frequency.setValueAtTime(500 * p, t);
        fl.frequency.exponentialRampToValueAtTime(2400 * p, t + 0.12);
        fl.frequency.exponentialRampToValueAtTime(800 * p, t + 0.35);
        // the mesh fluttering through the air
        const am = this.gain(v, 0.5);
        this.lfo(v, t, t + 0.45, 38, 0.5, am.gain, 'triangle');
        am.connect(v.out);
        this.burst(v, { t: t + 0.02, a: 0.07, d: 0.2, vol: 0.18, ft: 'highpass', f: 3500 * p, Q: 0.6, to: am });
        break;
      }
      case 'jarClink': {
        // glass clink (inharmonic partials), then the metal lid twisted snug
        const v = V(0.25, 1.2, 0.2);
        for (const [mul, lvl, d] of [[1, 0.6, 0.35], [2.32, 0.35, 0.25], [4.1, 0.2, 0.12], [5.9, 0.1, 0.08]] as const) {
          const f = 2150 * p * mul;
          if (f < 15000) this.tone(v, { f, t, a: 0.0008, d, vol: lvl });
        }
        this.burst(v, { t, a: 0.0005, d: 0.006, vol: 0.4, ft: 'highpass', f: 5000, Q: 0.7 });
        this.burst(v, { t: t + 0.14, a: 0.03, d: 0.12, vol: 0.2, ft: 'bandpass', f: 3800 * p, Q: 2.5 });
        this.tone(v, { type: 'triangle', f: 1500 * p, t: t + 0.3, a: 0.001, d: 0.03, vol: 0.3 });
        this.burst(v, { t: t + 0.3, a: 0.0005, d: 0.01, vol: 0.35, ft: 'bandpass', f: 2600 * p, Q: 1.5 });
        break;
      }
      case 'collectPop': {
        // round "bloop" and a sparkle up a fifth
        const v = V(0.24, 0.9, 0.22);
        this.tone(v, { f: 520 * p, f2: 1040 * p, glide: 0.05, t, a: 0.002, d: 0.09, vol: 0.9 });
        this.bellNote(v, mtof(88) * p, t + 0.05, 0.4, 0.35);
        this.bellNote(v, mtof(95) * p, t + 0.1, 0.3, 0.5);
        break;
      }
      case 'munch': {
        const v = V(0.4, 0.8, 0.03);
        const n = randi(2, 3);
        for (let i = 0; i < n; i++) {
          const s1 = t + i * rand(0.13, 0.18);
          this.burst(v, { noise: 'drops', t: s1, a: 0.004, d: rand(0.05, 0.08), vol: 1, ft: 'bandpass', f: rand(1300, 2200) * p, Q: 0.9 });
          this.burst(v, { t: s1, a: 0.003, d: 0.04, vol: 0.2, ft: 'bandpass', f: 3000 * p, Q: 1 });
          this.tone(v, { f: 140 * p, f2: 90 * p, t: s1, a: 0.004, d: 0.05, vol: 0.3 });
        }
        break;
      }
      case 'gulp': {
        const v = V(0.32, 0.6, 0.04);
        this.tone(v, { f: 260 * p, f2: 120 * p, glide: 0.07, t, a: 0.006, d: 0.09, vol: 0.8 });
        this.burst(v, { noise: 'pink', t, a: 0.006, d: 0.08, vol: 0.5, ft: 'bandpass', f: 420 * p, Q: 2.5 });
        this.tone(v, { f: 180 * p, f2: 300 * p, glide: 0.05, t: t + 0.13, a: 0.004, d: 0.06, vol: 0.35 });
        break;
      }
      case 'craft': {
        // three quick assembly clacks, then a little ascending sparkle
        const v = V(0.3, 1.6, 0.2);
        for (let i = 0; i < 3; i++) {
          const s1 = t + i * rand(0.08, 0.1);
          const f = rand(300, 420) * p;
          this.tone(v, { f, f2: f * 0.6, t: s1, a: 0.001, d: 0.06, vol: 0.7 });
          this.burst(v, { t: s1, a: 0.0006, d: 0.025, vol: 0.5, ft: 'bandpass', f: rand(1400, 2200) * p, Q: 2 });
        }
        [88, 91, 95, 100].forEach((m, i) => this.tone(v, { f: mtof(m) * p, t: t + 0.34 + i * 0.05, a: 0.002, d: 0.3, vol: 0.28, fm: { ratio: 3.5, index: 0.4, decay: 0.08 } }));
        break;
      }
      case 'skillUnlock': {
        // latch clicks open, a rising arpeggio blooms into a bright chord over a warm root
        const v = V(0.28, 3.2, 0.35, true);
        this.burst(v, { t, a: 0.0005, d: 0.012, vol: 0.6, ft: 'highpass', f: 2600, Q: 0.8 });
        this.tone(v, { type: 'triangle', f: 1400 * p, f2: 900 * p, t, a: 0.001, d: 0.04, vol: 0.3 });
        [79, 84, 88, 91].forEach((m, i) => this.bellNote(v, mtof(m) * p, t + 0.07 + i * 0.07, 0.6, 0.6));
        const t2 = t + 0.37;
        for (const m of [84, 88, 91, 96]) this.bellNote(v, mtof(m) * p, t2, 0.3, 1.8);
        this.tone(v, { f: mtof(60) * p, t: t2, a: 0.02, d: 1.4, vol: 0.45, fm: { ratio: 2, index: 0.6, decay: 0.3 } });
        this.tone(v, { f: mtof(48) * p, t: t2, a: 0.03, d: 1.2, vol: 0.35 });
        this.burst(v, { t: t2, a: 0.2, d: 1.2, vol: 0.06, ft: 'highpass', f: 6500, Q: 0.5 });
        break;
      }
      case 'typing': {
        // a short burst of laptop keys (sometimes ending on the space bar)
        const v = V(0.28, 0.9, 0.03);
        const n = randi(3, 6);
        let s1 = t;
        for (let i = 0; i < n; i++) {
          const space = i === n - 1 && Math.random() < 0.3;
          this.burst(v, { t: s1, a: 0.0006, d: space ? 0.03 : rand(0.008, 0.016), vol: rand(0.5, 1), ft: 'bandpass', f: (space ? 1500 : rand(2600, 4200)) * p, Q: 1.3 });
          this.tone(v, { type: 'triangle', f: (space ? 150 : rand(220, 330)) * p, t: s1, a: 0.001, d: space ? 0.035 : 0.018, vol: 0.3 });
          s1 += rand(0.055, 0.13);
        }
        break;
      }
      case 'scanBeep': {
        // sample scanner: two short beeps and a higher confirm over a faint sweep
        const v = V(0.056, 0.7, 0.12);
        for (const [dt, f, hold] of [[0, 1760, 0.045], [0.1, 1760, 0.045], [0.22, 2637, 0.1]] as const) {
          this.tone(v, { f: f * p, t: t + dt, a: 0.003, hold, d: 0.04, vol: 0.9 });
          this.tone(v, { type: 'triangle', f: f * p * 2, t: t + dt, a: 0.003, hold: hold * 0.5, d: 0.03, vol: 0.07 });
        }
        this.tone(v, { type: 'triangle', f: 600 * p, f2: 1400 * p, t, a: 0.05, hold: 0.2, d: 0.08, vol: 0.12 });
        break;
      }
      case 'lanternOn': {
        // valve click, soft ignition, mantle hiss settling, a warm glow note
        const v = V(0.3, 1.4, 0.12);
        this.burst(v, { t, a: 0.0005, d: 0.012, vol: 0.7, ft: 'highpass', f: 3000 * p, Q: 0.8 });
        this.tone(v, { f: 2300 * p, t, a: 0.001, d: 0.04, vol: 0.2, fm: { ratio: 1.41, index: 0.5, decay: 0.02 } });
        this.burst(v, { noise: 'pink', t: t + 0.08, a: 0.05, d: 0.35, vol: 0.8, ft: 'bandpass', f: 380 * p, f2: 1400 * p, Q: 0.8 });
        this.burst(v, { t: t + 0.12, a: 0.25, hold: 0.3, d: 0.6, vol: 0.12, ft: 'highpass', f: 4200, Q: 0.5 });
        this.tone(v, { f: mtof(72) * p, t: t + 0.12, a: 0.08, d: 0.8, vol: 0.12, fm: { ratio: 2, index: 0.3, decay: 0.2 } });
        break;
      }
      case 'fireLight': {
        // strike, whoosh as the kindling catches, a low whump, first crackles
        const v = V(0.36, 2.2, 0.2);
        this.burst(v, { t, a: 0.005, d: 0.08, vol: 0.4, ft: 'bandpass', f: 3200 * p, Q: 1 });
        const fl = this.burst(v, { noise: 'pink', t: t + 0.06, a: 0.18, hold: 0.15, d: 0.8, vol: 1, ft: 'lowpass', f: 250 * p, Q: 0.7 });
        fl.frequency.setValueAtTime(250 * p, t + 0.06);
        fl.frequency.exponentialRampToValueAtTime(2600 * p, t + 0.3);
        fl.frequency.exponentialRampToValueAtTime(700 * p, t + 1.2);
        this.tone(v, { f: 95 * p, f2: 50, t: t + 0.08, a: 0.04, d: 0.4, vol: 0.4 });
        const n = randi(6, 10);
        for (let i = 0; i < n; i++) {
          this.burst(v, { t: t + rand(0.25, 1.6), a: 0.001, d: rand(0.004, 0.02), vol: rand(0.25, 0.8), ft: 'highpass', f: rand(1500, 4500) });
        }
        break;
      }

      // ---- v2: speech bubbles & emotes ----
      case 'bubblePop': {
        const v = V(0.25, 0.3, 0.06);
        const f = 480 * p;
        this.tone(v, { f, f2: f * 2.1, glide: 0.04, t, a: 0.002, d: 0.06, vol: 1 });
        this.tone(v, { type: 'triangle', f: f * 0.5, f2: f, glide: 0.03, t, a: 0.002, d: 0.035, vol: 0.25 });
        this.burst(v, { t, a: 0.0005, d: 0.006, vol: 0.12, ft: 'highpass', f: 3500, Q: 0.7 });
        break;
      }
      case 'emoteSurprise': {
        // cartoon "boing!": a spring glide with decaying wobble
        const v = V(0.25, 0.9, 0.12);
        const f = 300 * p;
        const end = t + 0.65;
        const o = this.osc(v, 'triangle', f, t, end);
        o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.07);
        o.frequency.exponentialRampToValueAtTime(f * 1.7, t + 0.6);
        const vib = this.osc(v, 'sine', 15, t, end);
        const vd = this.gain(v, 0);
        vd.gain.setValueAtTime(f * 0.35, t + 0.05);
        vd.gain.exponentialRampToValueAtTime(f * 0.01, t + 0.6);
        vib.connect(vd);
        vd.connect(o.frequency);
        const e = this.env(v, t, 0.004, 1, 0.55, 0.02);
        o.connect(e);
        e.connect(v.out);
        this.tone(v, { f: f * 3.8, t, a: 0.002, d: 0.06, vol: 0.12 });
        break;
      }
      case 'emoteQuestion': {
        // "hm?": a short hum, then a rising blip
        const v = V(0.12, 0.8, 0.1);
        const f = 320 * p;
        const lp = this.filt(v, 'lowpass', 1400 * p, 1);
        lp.connect(v.out);
        this.tone(v, { type: 'triangle', f, f2: f * 0.97, t, a: 0.015, hold: 0.07, d: 0.06, vol: 0.8, to: lp });
        this.tone(v, { type: 'triangle', f: f * 0.97, pts: [[0.06, f * 1.05], [0.2, f * 1.6]], t: t + 0.17, a: 0.012, hold: 0.1, d: 0.1, vol: 0.9, to: lp });
        this.tone(v, { f: f * 3.2, f2: f * 4.8, t: t + 0.2, a: 0.01, hold: 0.06, d: 0.08, vol: 0.12 });
        break;
      }
      case 'emoteLaugh': {
        // little "heh-heh-heh" chuckle blips
        const v = V(0.14, 0.9, 0.1);
        const bp = this.filt(v, 'bandpass', 1100 * p, 0.9);
        bp.connect(v.out);
        const n = randi(3, 5);
        for (let i = 0; i < n; i++) {
          const s1 = t + i * 0.105;
          const f = 520 * p * (1 - i * 0.05);
          this.tone(v, { type: 'triangle', f: f * 1.08, f2: f * 0.86, t: s1, a: 0.005, hold: 0.025, d: 0.05, vol: 1, to: bp });
          this.tone(v, { f: f * 1.08, f2: f * 0.86, t: s1, a: 0.005, hold: 0.02, d: 0.05, vol: 0.35 });
          this.burst(v, { t: s1, a: 0.004, d: 0.04, vol: 0.12, ft: 'bandpass', f: 1600 * p, Q: 1 });
        }
        break;
      }
      case 'emoteAngry': {
        // a grumbling "grrm-mm... hmph!"
        const v = V(0.12, 0.9, 0.08);
        const f = 135 * p;
        const end = t + 0.6;
        const o = this.osc(v, 'sawtooth', f, t, end);
        o.frequency.linearRampToValueAtTime(f * 1.12, t + 0.1);
        o.frequency.linearRampToValueAtTime(f * 0.95, t + 0.22);
        o.frequency.linearRampToValueAtTime(f * 1.08, t + 0.32);
        o.frequency.linearRampToValueAtTime(f * 0.85, t + 0.45);
        const lp = this.filt(v, 'lowpass', 850 * p, 3);
        const am = this.gain(v, 0.7);
        this.lfo(v, t, end, 26, 0.3, am.gain, 'square');
        const e = this.env(v, t, 0.03, 1, 0.1, 0.34);
        o.connect(lp);
        lp.connect(am);
        am.connect(e);
        e.connect(v.out);
        this.burst(v, { noise: 'pink', t: t + 0.5, a: 0.005, d: 0.08, vol: 0.5, ft: 'bandpass', f: 700 * p, Q: 1.2 });
        this.tone(v, { type: 'triangle', f: f * 1.3, f2: f * 0.9, t: t + 0.5, a: 0.005, d: 0.08, vol: 0.4 });
        break;
      }
      case 'emoteHeart': {
        // sparkly rising chime
        const v = V(0.126, 1.8, 0.35, true);
        [84, 88, 91, 96].forEach((m, i) => this.bellNote(v, mtof(m) * p, t + i * 0.065, 0.6, 0.8));
        for (let i = 0; i < 5; i++) {
          this.tone(v, { f: Math.min(14000, rand(3200, 6000) * p), t: t + 0.15 + rand(0, 0.5), a: 0.002, d: rand(0.08, 0.2), vol: 0.12 });
        }
        break;
      }
      case 'emoteSweat': {
        // nervous wobbling descent and a single drip
        const v = V(0.16, 0.8, 0.1);
        const f = 1050 * p;
        const o = this.tone(v, { f, f2: f * 0.5, glide: 0.32, t, a: 0.005, hold: 0.1, d: 0.24, vol: 0.8 });
        this.lfo(v, t, t + 0.45, 10, f * 0.035, o.frequency);
        this.tone(v, { f: 1500 * p, f2: 2500 * p, glide: 0.035, t: t + 0.36, a: 0.002, d: 0.05, vol: 0.4 });
        break;
      }

      // ---- v2: world ----
      case 'jumpscare': {
        // horror sting: dissonant stab + screech + noise slam + sub hit, then heartbeat thumps.
        // Loud, but its volume is capped (VOL_CAP) so it never drives the output into clipping.
        const v = V(0.62, 3.6, 0.3, true);
        const lp = this.filt(v, 'lowpass', 7000, 1);
        lp.frequency.setValueAtTime(7000, t);
        lp.frequency.exponentialRampToValueAtTime(700, t + 1.4);
        const se = this.env(v, t, 0.008, 1, 1.6, 0.3);
        lp.connect(se);
        se.connect(v.out);
        for (const m of [38, 44, 51, 57, 62, 63, 68, 75]) {
          const o = this.osc(v, 'sawtooth', mtof(m) * p, t, t + 2.1);
          o.detune.value = rand(-12, 12);
          const gn = this.gain(v, 0.13);
          o.connect(gn);
          gn.connect(lp);
        }
        const hs = this.filt(v, 'bandpass', 2400 * p, 1.5);
        hs.connect(v.out);
        for (const m of [91, 92]) {
          const f = mtof(m) * p;
          const o = this.tone(v, { type: 'sawtooth', f, t, a: 0.01, hold: 0.4, d: 0.8, vol: 0.17, to: hs });
          this.lfo(v, t, t + 1.3, 13, f * 0.012, o.frequency);
        }
        this.burst(v, { noise: 'white', t, a: 0.006, hold: 0.08, d: 0.6, vol: 0.65, ft: 'bandpass', f: 3200, f2: 500, Q: 0.6 });
        this.tone(v, { f: 95, f2: 30, t, a: 0.006, d: 0.9, vol: 0.55 });
        for (const [dt, lv] of [[0.55, 0.8], [1.3, 0.6]] as const) {
          this.tone(v, { f: 70, f2: 40, glide: 0.1, t: t + dt, a: 0.004, d: 0.14, vol: lv });
          this.tone(v, { f: 62, f2: 36, glide: 0.1, t: t + dt + 0.2, a: 0.004, d: 0.13, vol: lv * 0.6 });
          this.burst(v, { noise: 'brown', t: t + dt, a: 0.004, d: 0.12, vol: lv * 0.5, ft: 'lowpass', f: 180 });
        }
        break;
      }
      case 'rustleBush': {
        // a shrub shaken hard: swaying body, crisp leaves, a twig or two
        const v = V(0.22, 1.1, 0.1);
        const dur = rand(0.45, 0.7);
        const end = t + dur + 0.3;
        const src = this.noiseSrc(v, 'white', t, end);
        const bp = this.filt(v, 'bandpass', 2800 * p, 0.8);
        const am = this.gain(v, 0.55);
        this.lfo(v, t, end, rand(7, 10), 0.45, am.gain);
        const e = this.env(v, t, 0.03, 1, dur * 0.6, dur * 0.4);
        src.connect(bp);
        bp.connect(am);
        am.connect(e);
        e.connect(v.out);
        const n = randi(6, 9);
        for (let i = 0; i < n; i++) {
          this.burst(v, { t: t + dur * Math.pow(Math.random(), 1.4), a: 0.004, d: rand(0.02, 0.07), vol: rand(0.3, 0.9), ft: 'bandpass', f: rand(1500, 4600) * p, Q: 1.4 });
        }
        this.burst(v, { noise: 'pink', t, a: 0.05, hold: dur * 0.5, d: dur * 0.6, vol: 0.5, ft: 'bandpass', f: 900 * p, Q: 0.6 });
        const snaps = randi(1, 2);
        for (let i = 0; i < snaps; i++) {
          this.burst(v, { t: t + rand(0.05, dur), a: 0.0005, d: 0.01, vol: 0.5, ft: 'highpass', f: 2500 * p, Q: 0.7 });
        }
        break;
      }
      case 'waveCrash': {
        const v = V(0.6, 3.5, 0.3);
        this.synHullCrash(v, t, p);
        break;
      }
      case 'woodCreak': {
        const dur = rand(0.6, 1.1);
        const v = V(0.4, dur + 1, 0.18);
        this.synCreak(v, t, p, dur, p < 0.75, 1);
        break;
      }
      case 'thunderClose': {
        const v = V(0.75, 6, 0.45, true);
        this.synThunderClose(v, t, p);
        break;
      }
      case 'gust': {
        const dur = rand(1.4, 2.2);
        const v = V(0.4, dur * 1.3 + 1, 0.15);
        this.synGust(v, t, p, dur);
        break;
      }
      case 'splashBig': {
        // plunge, a white sheet of spray, droplets raining back, a cavity bloop
        const v = V(0.55, 2.2, 0.3);
        this.tone(v, { f: 130 * p, f2: 48, t, a: 0.004, d: 0.35, vol: 0.7 });
        this.burst(v, { noise: 'brown', t, a: 0.006, d: 0.5, vol: 0.9, ft: 'lowpass', f: 600 * p });
        this.burst(v, { t, a: 0.01, hold: 0.12, d: 1.1, vol: 0.85, ft: 'lowpass', f: 6000 * p, f2: 600, Q: 0.5 });
        this.burst(v, { noise: 'drops', t: t + 0.25, a: 0.15, hold: 0.3, d: 0.9, vol: 0.7, ft: 'bandpass', f: 2400 * p, Q: 0.7 });
        const n = randi(6, 10);
        for (let i = 0; i < n; i++) {
          const f = rand(700, 1900) * p;
          this.tone(v, { f, f2: f * 1.7, glide: 0.03, t: t + rand(0.1, 1), a: 0.002, d: 0.05, vol: 0.1 });
        }
        this.tone(v, { f: 380 * p, f2: 760 * p, glide: 0.12, t: t + 0.08, a: 0.01, d: 0.18, vol: 0.2 });
        break;
      }
      case 'stepSand': {
        const pp = p * rand(0.9, 1.1);
        const v = V(0.32, 0.35, 0.02);
        this.burst(v, { t, a: 0.012, d: rand(0.07, 0.1), vol: 0.5, ft: 'bandpass', f: rand(1300, 1900) * pp, Q: 0.9 });
        this.burst(v, { noise: 'drops', t: t + 0.005, a: 0.01, d: 0.08, vol: 0.9, ft: 'bandpass', f: 2600 * pp, Q: 0.8 });
        this.burst(v, { noise: 'pink', t, a: 0.006, d: 0.07, vol: 0.5, ft: 'lowpass', f: 420 * pp });
        break;
      }
      case 'stepWood': {
        const pp = p * rand(0.92, 1.08);
        const v = V(0.2, 0.5, 0.05);
        this.tone(v, { f: 165 * pp, f2: 105 * pp, glide: 0.05, t, a: 0.002, d: 0.09, vol: 0.7 });
        this.burst(v, { noise: 'pink', t, a: 0.002, d: 0.06, vol: 0.8, ft: 'bandpass', f: 620 * pp, Q: 2.2 });
        this.burst(v, { t, a: 0.001, d: 0.015, vol: 0.18, ft: 'highpass', f: 2500 * pp, Q: 0.7 });
        if (Math.random() < 0.18) this.synCreak(v, t + 0.03, pp * 1.3, rand(0.12, 0.2), false, 0.3);
        break;
      }
      case 'stepWater': {
        // a wading step: the slosh of a foot pushing through water, a low plop and a few droplets
        const pp = p * rand(0.9, 1.1);
        const v = V(0.36, 0.6, 0.06);
        this.burst(v, { t, a: 0.01, hold: 0.02, d: rand(0.12, 0.18), vol: 0.6, ft: 'bandpass', f: rand(900, 1300) * pp, f2: 420 * pp, Q: 1.1 });
        this.burst(v, { noise: 'brown', t, a: 0.008, d: 0.1, vol: 0.55, ft: 'lowpass', f: 380 * pp });
        this.tone(v, { f: 210 * pp, f2: 120 * pp, glide: 0.06, t: t + 0.01, a: 0.004, d: 0.08, vol: 0.18 });
        const n = randi(2, 4);
        for (let i = 0; i < n; i++) {
          const f = rand(900, 1900) * pp;
          this.tone(v, { f, f2: f * 1.5, glide: 0.025, t: t + rand(0.06, 0.26), a: 0.002, d: 0.04, vol: 0.07 });
        }
        break;
      }
      case 'drip': {
        // a single drop falling into a still pool: the rising "plink" with a long cave tail
        const v = V(0.3, 1.4, 0.55, true);
        const f = rand(700, 1100) * p;
        this.tone(v, { f, f2: f * 2.1, glide: 0.035, t, a: 0.001, d: 0.09, vol: 0.5 });
        this.tone(v, { f: f * 0.5, f2: f * 0.9, glide: 0.05, t: t + 0.004, a: 0.002, d: 0.06, vol: 0.12 });
        break;
      }
      case 'trickle': {
        // a moment of running water: bubbly droplet tones over a soft wash of noise
        const v = V(0.22, 0.9, 0.2);
        this.burst(v, { noise: 'pink', t, a: 0.08, hold: 0.15, d: 0.35, vol: 0.35, ft: 'bandpass', f: rand(1400, 2400) * p, Q: 0.6 });
        const n = randi(3, 7);
        for (let i = 0; i < n; i++) {
          const f = rand(500, 1400) * p;
          this.tone(v, { f, f2: f * rand(1.3, 2), glide: 0.03, t: t + rand(0, 0.45), a: 0.002, d: rand(0.03, 0.06), vol: rand(0.06, 0.14) });
        }
        break;
      }
      case 'stepLeaves': {
        const pp = p * rand(0.9, 1.1);
        const v = V(0.32, 0.4, 0.03);
        const n = randi(4, 7);
        for (let i = 0; i < n; i++) {
          this.burst(v, { t: t + rand(0, 0.07), a: 0.002, d: rand(0.012, 0.035), vol: rand(0.35, 0.8), ft: 'bandpass', f: rand(2400, 5200) * pp, Q: 1.3 });
        }
        this.burst(v, { noise: 'pink', t, a: 0.004, d: 0.06, vol: 0.6, ft: 'lowpass', f: 500 * pp });
        break;
      }
      case 'shipCrash': {
        // the hull slams onto rock: boom, grinding crunch, splintering planks, groaning timbers,
        // debris knocking about and the sea surging over the wreck.
        const v = V(0.7, 5.5, 0.35, true);
        this.tone(v, { f: 58 * p, f2: 26, t, a: 0.006, d: 1.6, vol: 0.8 });
        this.burst(v, { noise: 'brown', t, a: 0.008, hold: 0.2, d: 1.8, vol: 1, ft: 'lowpass', f: 700 * p, f2: 120, Q: 0.6 });
        const grit = this.gain(v, 3);
        const sh = this.shaper(v);
        const cb = this.filt(v, 'bandpass', 900 * p, 0.9);
        const ce = this.env(v, t + 0.02, 0.01, 0.35, 0.7, 0.35);
        const src = this.noiseSrc(v, 'pink', t, t + 1.3);
        src.connect(grit);
        grit.connect(sh);
        sh.connect(cb);
        cb.connect(ce);
        ce.connect(v.out);
        const n = randi(16, 24);
        for (let i = 0; i < n; i++) {
          this.burst(v, { t: t + 0.03 + 1.6 * Math.pow(Math.random(), 1.8), a: 0.0006, d: rand(0.006, 0.03), vol: rand(0.25, 0.7), ft: 'bandpass', f: rand(1400, 5200) * p, Q: rand(0.8, 2) });
        }
        this.synCreak(v, t + 0.15, 0.7 * p, 1.2, true, 0.8);
        this.synCreak(v, t + 0.5, 0.9 * p, 0.9, true, 0.6);
        for (let i = 0; i < 7; i++) {
          const f = rand(220, 700) * p;
          this.tone(v, { f, f2: f * 0.6, t: t + rand(0.3, 2.2), a: 0.002, d: rand(0.05, 0.12), vol: rand(0.12, 0.3) });
        }
        this.burst(v, { noise: 'pink', t: t + 0.25, a: 0.5, hold: 0.6, d: 2.4, vol: 0.55, ft: 'lowpass', f: 1800 * p, f2: 400, Q: 0.4 });
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

  /** Lub-dub. `body` adds a soft chesty thud so the beat also reads on small speakers. */
  private heartbeat(t: number, vol: number, body = 0): void {
    const g = this.G;
    const v = this.mkVoice(g.sfxBus, vol, 0, 0.6, t, 0.05);
    this.tone(v, { f: 72, f2: 40, glide: 0.1, t, a: 0.004, d: 0.13, vol: 1 });
    this.tone(v, { f: 64, f2: 38, glide: 0.1, t: t + 0.19, a: 0.004, d: 0.12, vol: 0.6 });
    if (body > 0) {
      this.burst(v, { noise: 'brown', t, a: 0.004, d: 0.1, vol: 0.9 * body, ft: 'lowpass', f: 220 });
      this.burst(v, { noise: 'brown', t: t + 0.19, a: 0.004, d: 0.09, vol: 0.55 * body, ft: 'lowpass', f: 200 });
      this.tone(v, { type: 'triangle', f: 110, f2: 60, glide: 0.08, t, a: 0.003, d: 0.08, vol: 0.25 * body });
    }
  }

  // ---- music ----------------------------------------------------------------------

  private musicStep(st: MusicState, t0: number, sd: number): void {
    const d = st.def;
    const pos = st.step % d.bar;
    const bar = Math.floor(st.step / d.bar);
    const t = t0 + (pos % 2 === 1 ? sd * d.swing : 0);
    // Position in the tension cycle, 0..1 (always 1 for tracks without one).
    const inten = d.rise ? ((bar % d.rise) * d.bar + pos) / (d.rise * d.bar) : 1;

    if (pos === 0 && bar % d.chordBars === 0) {
      st.chord = d.chords[Math.floor(bar / d.chordBars) % d.chords.length] as Chord;
      if (d.padVol > 0) this.pad(st, st.chord.notes, t, d.chordBars * d.bar * sd, inten);
    }
    if (d.rise && pos === 0) {
      const cyc = bar % d.rise;
      if (cyc === d.rise - 1) this.riser(st, t, d.bar * sd);
      if (cyc === 0) this.drum(st, 'boom', t, 0.2);
    }
    // Bass: each entry of bassSteps rings until the next one (or the bar line).
    const bi = d.bassVol > 0 ? d.bassSteps.indexOf(pos) : -1;
    if (bi >= 0) {
      const len = (d.bassSteps[bi + 1] ?? d.bar) - pos;
      this.bassNote(st, st.chord.root + (d.bassNotes?.[bi] ?? 0), t, len * sd, d.bassVol * (pos === 0 ? 1 : 0.7));
    }
    if (d.osti && d.ostiVol) {
      const vel = d.osti[pos % d.osti.length] ?? 0;
      if (vel > 0) this.ostiNote(st, st.chord.root + 12, t, d.ostiVol * vel * (d.rise ? 0.7 + 0.3 * inten : 1));
    }
    if (d.perc) {
      for (const P of d.perc) {
        let vel = P.pat[st.step % P.pat.length] ?? 0;
        if (vel <= 0) continue;
        let prob = P.prob ?? 1;
        if (P.rise) {
          prob *= 0.2 + 0.8 * inten;
          vel *= 0.6 + 0.4 * inten;
        }
        if (Math.random() < prob) this.drum(st, P.k, t, P.vol * vel);
      }
    }
    if (d.comp) {
      const vel = d.comp.pat[st.step % d.comp.pat.length] ?? 0;
      // offbeats strum back up (high to low) a little softer
      if (vel > 0) this.strum(st, d.comp, t, sd, vel, pos % 2 === 1);
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
      case 'reed': {
        // concertina: two reeds a few cents apart (musette beating) plus a square reed
        const hold = Math.max(0.06, dur - 0.06);
        const v = this.musicVoice(st, vol, hold + 0.6, t);
        const end = t + 0.05 + hold + 0.3;
        const lp = this.filt(v, 'lowpass', clamp(f * 5, 900, 4200), 0.8);
        const e = this.env(v, t, 0.05, 1, 0.16, hold);
        lp.connect(e);
        e.connect(v.out);
        for (const [type, det, lvl] of [['sawtooth', 9, 0.42], ['sawtooth', -9, 0.42], ['square', 0, 0.16]] as const) {
          const o = this.osc(v, type, f, t, end);
          o.detune.value = det;
          const gn = this.gain(v, lvl);
          o.connect(gn);
          gn.connect(lp);
        }
        break;
      }
      case 'guitar': {
        const v = this.musicVoice(st, vol, 2.5, t);
        this.guitarNote(v, f, t, 1, true, dur + 1);
        break;
      }
      case 'epiano': {
        const v = this.musicVoice(st, vol, 2.7, t);
        const lp = this.filt(v, 'lowpass', 2600, 0.5);
        lp.connect(v.out);
        this.epNote(v, lp, f, t, 1);
        break;
      }
      case 'marimba': {
        // wooden bar: fundamental + the 4:1 overtone, a mallet knock
        const v = this.musicVoice(st, vol, 0.9, t);
        this.tone(v, { f, t, a: 0.002, d: 0.55, vol: 1 });
        if (f * 3.99 < 12000) this.tone(v, { f: f * 3.99, t, a: 0.001, d: 0.09, vol: 0.18 });
        this.tone(v, { type: 'triangle', f: f * 2, t, a: 0.001, d: 0.04, vol: 0.08 });
        break;
      }
      case 'strings': {
        // tremolo string section: detuned saws, bowed swell, ~10 Hz tremolo
        const hold = Math.max(0.1, dur - 0.1);
        const v = this.musicVoice(st, vol, hold + 0.9, t);
        const end = t + 0.12 + hold + 0.7;
        const lp = this.filt(v, 'lowpass', Math.min(f * 4, 4500), 0.6);
        const trem = this.gain(v, 0.6);
        this.lfo(v, t, end, rand(9, 11), 0.4, trem.gain);
        const e = this.env(v, t, 0.12, 1, 0.5, hold);
        lp.connect(trem);
        trem.connect(e);
        e.connect(v.out);
        for (const det of [-8, 8]) {
          const o = this.osc(v, 'sawtooth', f, t, end);
          o.detune.value = det;
          const gn = this.gain(v, 0.5);
          o.connect(gn);
          gn.connect(lp);
        }
        break;
      }
    }
  }

  /** One comp hit: the chord strummed (or stabbed); guitar and keys share a single voice. */
  private strum(st: MusicState, c: CompPart, t: number, sd: number, vel: number, up: boolean): void {
    const notes = st.chord.notes.map((n) => n + (c.shift ?? 0));
    if (up) notes.reverse();
    const gap = c.strum ?? 0.012;
    const len = (c.len ?? 2) * sd;
    const vol = c.vol * vel * (up ? 0.85 : 1);
    if (c.inst === 'guitar' || c.inst === 'epiano') {
      const v = this.musicVoice(st, vol, 2.7 + notes.length * gap, t);
      let dest: AudioNode = v.out;
      if (c.inst === 'epiano') {
        const lp = this.filt(v, 'lowpass', 2600, 0.5);
        lp.connect(v.out);
        dest = lp;
      }
      notes.forEach((n, i) => {
        const f = mtof(n);
        const s = t + i * gap;
        const nv = rand(0.85, 1);
        // strummed strings are damped by the next stroke; one pick noise per stroke
        if (c.inst === 'guitar') this.guitarNote(v, f, s, nv, i === 0, len + 0.8);
        else this.epNote(v, dest, f, s, nv);
      });
      return;
    }
    notes.forEach((n, i) => this.inst(st, c.inst, n, t + i * gap, len, vol * rand(0.85, 1)));
  }

  /** Lo-fi electric piano note: FM tine with a soft bell attack, a little detuned. */
  private epNote(v: Voice, dest: AudioNode, f: number, t: number, vol: number): void {
    const decay = clamp(2.6 - f / 600, 1, 2.4);
    this.tone(v, { f, t, a: 0.004, d: decay, vol, fm: { ratio: 1, index: 1.4, decay: 0.35 }, detune: rand(-7, 7), to: dest });
    if (f * 4 < 12000) this.tone(v, { f: f * 4, t, a: 0.001, d: 0.12, vol: 0.06 * vol, to: dest });
  }

  /** Plucked string: bright sawtooth through a closing low-pass, a tiny pick noise. */
  private guitarNote(v: Voice, f: number, t: number, vol: number, pick: boolean, maxDecay = 9): void {
    const decay = Math.min(clamp(2.4 - f / 700, 0.8, 2.2), Math.max(0.3, maxDecay));
    const end = t + decay + 0.1;
    const o = this.osc(v, 'sawtooth', f, t, end);
    const c0 = Math.min(f * 7, 6000);
    const lp = this.filt(v, 'lowpass', c0, 0.9);
    lp.frequency.setValueAtTime(c0, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 180), t + decay * 0.5);
    const e = this.env(v, t, 0.002, vol, decay);
    o.connect(lp);
    lp.connect(e);
    e.connect(v.out);
    if (pick) this.burst(v, { noise: 'white', t, a: 0.001, d: 0.012, vol: 0.12 * vol, ft: 'bandpass', f: Math.min(f * 4, 5000), Q: 1.2 });
  }

  /** Percussion for the music sessions. */
  private drum(st: MusicState, k: Perc, t: number, vol: number): void {
    const pan = k === 'hat' || k === 'shaker' ? rand(-0.25, 0.25) : 0;
    const V = (life: number, send: number): Voice => this.mkVoice(st.out, vol, pan, life, t, st.def.send * send, st.def.long);
    switch (k) {
      case 'kick': {
        const v = V(0.5, 0.15);
        this.tone(v, { f: 130, f2: 48, glide: 0.09, t, a: 0.002, d: 0.3, vol: 1 });
        this.tone(v, { type: 'triangle', f: 260, f2: 90, glide: 0.03, t, a: 0.001, d: 0.03, vol: 0.25 });
        break;
      }
      case 'tom':
      case 'tomHi': {
        // big taiko-like toms
        const hi = k === 'tomHi';
        const f = hi ? 150 : 92;
        const v = V(1.2, 0.6);
        this.tone(v, { f, f2: f * 0.6, glide: hi ? 0.18 : 0.25, t, a: 0.002, d: hi ? 0.4 : 0.6, vol: 1 });
        this.tone(v, { type: 'triangle', f: f * 2, f2: f * 1.2, glide: 0.1, t, a: 0.002, d: 0.15, vol: 0.3 });
        this.burst(v, { noise: 'brown', t, a: 0.002, d: hi ? 0.18 : 0.25, vol: 0.6, ft: 'lowpass', f: hi ? 700 : 500 });
        this.burst(v, { t, a: 0.001, d: 0.02, vol: 0.12, ft: 'bandpass', f: 1500, Q: 1 });
        break;
      }
      case 'snare': {
        // soft, dusty snare
        const v = V(0.5, 0.5);
        const lp = this.filt(v, 'lowpass', 5000, 0.5);
        lp.connect(v.out);
        this.burst(v, { t, a: 0.001, d: 0.14, vol: 0.8, ft: 'bandpass', f: 2200, Q: 0.7, to: lp });
        this.tone(v, { type: 'triangle', f: 210, f2: 150, t, a: 0.001, d: 0.07, vol: 0.5, to: lp });
        break;
      }
      case 'hat': {
        const v = V(0.2, 0.2);
        this.burst(v, { t, a: 0.001, d: 0.035, vol: 1, ft: 'highpass', f: 7000, Q: 0.7 });
        break;
      }
      case 'shaker': {
        const v = V(0.2, 0.2);
        this.burst(v, { t, a: 0.012, d: 0.05, vol: 1, ft: 'bandpass', f: 5500, Q: 1.2 });
        break;
      }
      case 'clap': {
        const v = V(0.5, 0.6);
        for (let i = 0; i < 3; i++) this.burst(v, { t: t + i * 0.011, a: 0.001, d: 0.012, vol: 0.7, ft: 'bandpass', f: 1400, Q: 1.1 });
        this.burst(v, { t: t + 0.033, a: 0.001, d: 0.12, vol: 0.5, ft: 'bandpass', f: 1300, Q: 0.9 });
        break;
      }
      case 'wood': {
        // woodblock / rim click
        const v = V(0.3, 0.4);
        this.tone(v, { f: 1250, t, a: 0.001, d: 0.045, vol: 1, fm: { ratio: 2.4, index: 0.3, decay: 0.02 } });
        this.tone(v, { f: 2600, t, a: 0.001, d: 0.015, vol: 0.2 });
        break;
      }
      case 'heart': {
        // a short run of heartbeats
        const v = V(2.8, 0.2);
        for (let i = 0; i < 3; i++) {
          const s = t + i * 0.85;
          const lv = 1 - i * 0.2;
          this.tone(v, { f: 70, f2: 40, glide: 0.1, t: s, a: 0.004, d: 0.14, vol: lv });
          this.tone(v, { f: 62, f2: 37, glide: 0.1, t: s + 0.2, a: 0.004, d: 0.12, vol: lv * 0.6 });
          this.burst(v, { noise: 'brown', t: s, a: 0.004, d: 0.1, vol: lv * 0.6, ft: 'lowpass', f: 200 });
        }
        break;
      }
      case 'crackle': {
        // vinyl dust
        const v = V(0.3, 0);
        const n = randi(1, 2);
        for (let i = 0; i < n; i++) {
          this.burst(v, { t: t + rand(0, 0.2), a: 0.0005, d: rand(0.002, 0.008), vol: rand(0.4, 1), ft: 'highpass', f: rand(2000, 5000), Q: 0.7 });
        }
        break;
      }
      case 'boom': {
        // downbeat impact at the top of a tension cycle
        const v = V(2, 0.8);
        this.tone(v, { f: 72, f2: 32, glide: 0.5, t, a: 0.003, d: 1.2, vol: 1 });
        this.burst(v, { noise: 'brown', t, a: 0.003, d: 0.8, vol: 0.8, ft: 'lowpass', f: 320 });
        this.burst(v, { t, a: 0.004, d: 1.4, vol: 0.12, ft: 'highpass', f: 3500, Q: 0.5 });
        break;
      }
    }
  }

  /** Noise swell over `len` seconds into the next downbeat. */
  private riser(st: MusicState, t: number, len: number): void {
    const v = this.mkVoice(st.out, 0.05, 0, len + 0.5, t, st.def.send, true);
    this.burst(v, { noise: 'pink', t, a: len, d: 0.08, vol: 1, ft: 'bandpass', f: 250, f2: 3200, Q: 1.2 });
    this.burst(v, { noise: 'white', t: t + len * 0.4, a: len * 0.6, d: 0.06, vol: 0.35, ft: 'highpass', f: 3000, f2: 8000, Q: 0.5 });
  }

  private pad(st: MusicState, notes: number[], t: number, len: number, inten = 1): void {
    const d = st.def;
    const attack = Math.min(d.padAttack, len * 0.5);
    const release = 1.8;
    const v = this.musicVoice(st, d.padVol, len + release + 0.2, t, 0);
    const end = t + len + release + 0.1;
    // Tension tracks open the pad up as the cycle builds.
    const cut = d.rise ? d.padCut * (0.6 + 0.8 * inten) : d.padCut;
    const lp = this.filt(v, 'lowpass', cut, 0.3);
    lp.frequency.setValueAtTime(cut * 0.5, t);
    lp.frequency.linearRampToValueAtTime(cut, t + attack);
    const e = this.env(v, t, attack, 1, release, Math.max(0, len - attack));
    lp.connect(e);
    e.connect(v.out);
    const type = d.padType ?? 'soft';
    let dest: AudioNode = lp;
    if (type === 'strings') {
      const trem = this.gain(v, 0.62);
      this.lfo(v, t, end, rand(9, 11), 0.38, trem.gain);
      trem.connect(lp);
      dest = trem;
    } else if (type === 'drone') {
      // slow filter breathing and a sub an octave under the chord
      this.lfo(v, t, end, 0.07, cut * 0.25, lp.frequency);
      const sub = this.osc(v, 'sine', mtof((notes[0] ?? 45) - 12), t, end);
      const sg = this.gain(v, 0.7);
      sub.connect(sg);
      sg.connect(lp);
    }
    for (const n of notes) {
      const f = mtof(n);
      switch (type) {
        case 'soft': {
          const a = this.osc(v, 'sawtooth', f, t, end);
          a.detune.value = 7;
          const b = this.osc(v, 'triangle', f, t, end);
          b.detune.value = -7;
          const ga = this.gain(v, 0.5);
          a.connect(ga);
          ga.connect(dest);
          b.connect(dest);
          break;
        }
        case 'strings': {
          for (const det of [-9, 9]) {
            const o = this.osc(v, 'sawtooth', f, t, end);
            o.detune.value = det;
            const gn = this.gain(v, 0.4);
            o.connect(gn);
            gn.connect(dest);
          }
          break;
        }
        case 'reed': {
          const a = this.osc(v, 'sawtooth', f, t, end);
          a.detune.value = 6;
          const b = this.osc(v, 'square', f, t, end);
          b.detune.value = -6;
          const ga = this.gain(v, 0.35);
          const gb = this.gain(v, 0.18);
          a.connect(ga);
          b.connect(gb);
          ga.connect(dest);
          gb.connect(dest);
          break;
        }
        case 'drone': {
          const a = this.osc(v, 'sine', f, t, end);
          const b = this.osc(v, 'triangle', f, t, end);
          b.detune.value = 5;
          const ga = this.gain(v, 0.8);
          const gb = this.gain(v, 0.35);
          a.connect(ga);
          b.connect(gb);
          ga.connect(dest);
          gb.connect(dest);
          break;
        }
      }
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
