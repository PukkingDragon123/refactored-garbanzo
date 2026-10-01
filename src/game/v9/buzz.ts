// V9 hornet buzz: a continuous synthesized drone for a single scout or a whole swarm, played on the
// world sfx bus. A few detuned sawtooth "wingbeats" with their own wobbling vibrato, a rough
// amplitude flutter, and a band-pass that opens as the swarm grows; level, pan and pitch are set
// every frame by the hornets (doppler-ish pitch rise as they rush the camera). Silent until the
// audio engine is unlocked.

import { audio } from '../../core/audio';

interface G { ctx: AudioContext; sfxBus: GainNode }
/** the engine keeps its graph private; this module only borrows the context and the sfx bus */
const graph = (): G | null => (audio as unknown as { g: G | null }).g ?? null;

export class Buzz {
  private out: GainNode | null = null;
  private pan: StereoPannerNode | null = null;
  private filt: BiquadFilterNode | null = null;
  private oscs: OscillatorNode[] = [];
  private lfos: OscillatorNode[] = [];
  private level = 0;

  constructor(readonly base = 210, readonly voices = 4) {}

  private build(): boolean {
    if (this.out) return true;
    const g = graph();
    if (!g || g.ctx.state !== 'running') return false;
    const c = g.ctx;
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.pan = c.createStereoPanner();
    this.filt = c.createBiquadFilter();
    this.filt.type = 'bandpass';
    this.filt.frequency.value = 700;
    this.filt.Q.value = 0.7;
    const am = c.createGain();
    am.gain.value = 0.8;
    // rough flutter: the swarm never quite settles on one wingbeat
    const flut = c.createOscillator();
    flut.frequency.value = 17;
    const fg = c.createGain();
    fg.gain.value = 0.22;
    flut.connect(fg);
    fg.connect(am.gain);
    flut.start();
    this.lfos.push(flut);
    for (let i = 0; i < this.voices; i++) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = this.base * (0.9 + i * 0.065);
      const vib = c.createOscillator();
      vib.frequency.value = 3 + i * 1.7;
      const vg = c.createGain();
      vg.gain.value = 6 + i * 2;
      vib.connect(vg);
      vg.connect(o.frequency);
      vib.start();
      const og = c.createGain();
      og.gain.value = 0.22 / Math.sqrt(this.voices);
      o.connect(og);
      og.connect(am);
      o.start();
      this.oscs.push(o);
      this.lfos.push(vib);
    }
    am.connect(this.filt);
    this.filt.connect(this.pan);
    this.pan.connect(this.out);
    this.out.connect(g.sfxBus);
    return true;
  }

  /** level 0..1, pan -1..1, pitch multiplier, brightness 0..1 */
  set(level: number, pan = 0, pitch = 1, bright = 0.5) {
    if (level < 0.005 && !this.out) return;
    if (!this.build()) return;
    const c = graph()!.ctx, t = c.currentTime;
    this.level = level;
    this.out!.gain.setTargetAtTime(Math.min(1, level) * 0.55, t, 0.08);
    this.pan!.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.1);
    this.filt!.frequency.setTargetAtTime(500 + bright * 1300, t, 0.15);
    this.oscs.forEach((o, i) => o.frequency.setTargetAtTime(this.base * (0.9 + i * 0.065) * pitch, t, 0.12));
  }

  get on() { return this.level > 0.005; }

  stop() {
    const g = graph();
    if (!this.out || !g) return;
    const t = g.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.15);
    const nodes = [...this.oscs, ...this.lfos];
    setTimeout(() => { for (const n of nodes) { try { n.stop(); n.disconnect(); } catch { /* gone */ } } this.out?.disconnect(); this.out = null; }, 900);
    this.oscs = [];
    this.lfos = [];
    this.level = 0;
  }
}
