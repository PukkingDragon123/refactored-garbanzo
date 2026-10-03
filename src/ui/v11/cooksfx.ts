// V11 cooking sounds, synthesised on the game's own sfx bus (so the volume settings apply): the
// fire's roar and crackle, the sizzle of a hot pan, the pot's bubbling, the knife on the board, a log
// thumping onto the fire. Continuous layers are driven every frame by the close-up (setHeat etc.).

import { audio } from '../../core/audio';

interface G { ctx: AudioContext; sfxBus: GainNode; white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer }
const graph = (): G | null => { const g = (audio as unknown as { g?: G | null }).g; return g && g.ctx.state === 'running' ? g : null; };

export class CookSound {
  private nodes: AudioNode[] = [];
  private fireG: GainNode | null = null;
  private sizzleG: GainNode | null = null;
  private sizzleF: BiquadFilterNode | null = null;
  private boilG: GainNode | null = null;
  private crackT = 0;
  private bubbleT = 0;
  private boil = 0;

  start() {
    const g = graph();
    if (!g) return;
    const c = g.ctx;
    const loop = (buf: AudioBuffer) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); this.nodes.push(s); return s; };
    // the fire: brown noise, low-passed
    const f = loop(g.brown), ff = c.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 500;
    this.fireG = c.createGain(); this.fireG.gain.value = 0;
    f.connect(ff).connect(this.fireG).connect(g.sfxBus);
    // the sizzle: white noise, band-passed high, wobbling
    const z = loop(g.white), zf = c.createBiquadFilter(); zf.type = 'bandpass'; zf.frequency.value = 5200; zf.Q.value = 0.6;
    this.sizzleF = zf;
    this.sizzleG = c.createGain(); this.sizzleG.gain.value = 0;
    z.connect(zf).connect(this.sizzleG).connect(g.sfxBus);
    // the simmer: pink noise rumble under the bubbles
    const b = loop(g.pink), bf = c.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 900;
    this.boilG = c.createGain(); this.boilG.gain.value = 0;
    b.connect(bf).connect(this.boilG).connect(g.sfxBus);
    this.nodes.push(ff, zf, bf, this.fireG, this.sizzleG, this.boilG);
  }

  /** per frame: fire 0..1, sizzle 0..1 (pan / skewer heat on food), boil 0..1 (pot) */
  update(dt: number, fire: number, sizzle: number, boil: number) {
    const g = graph();
    if (!g || !this.fireG || !this.sizzleG || !this.boilG) return;
    const t = g.ctx.currentTime;
    this.fireG.gain.setTargetAtTime(0.05 + fire * 0.22, t, 0.2);
    const wob = 0.75 + Math.random() * 0.5;
    this.sizzleG.gain.setTargetAtTime(sizzle * 0.32 * wob, t, 0.05);
    this.sizzleF?.frequency.setTargetAtTime(3800 + sizzle * 2600 + Math.random() * 800, t, 0.05);
    this.boil = boil;
    this.boilG.gain.setTargetAtTime(boil * 0.08, t, 0.3);
    // crackles from the fire, bubbles from the pot
    this.crackT -= dt;
    if (this.crackT <= 0) { this.crackT = 0.08 + Math.random() * (0.6 - fire * 0.45); this.crack(0.15 + fire * 0.35); }
    this.bubbleT -= dt;
    if (boil > 0.05 && this.bubbleT <= 0) { this.bubbleT = 0.05 + Math.random() * (0.5 - boil * 0.4); this.bubble(boil); }
  }

  private crack(v: number) {
    const g = graph();
    if (!g) return;
    const c = g.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = g.white;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500 + Math.random() * 3000;
    const e = c.createGain(); e.gain.setValueAtTime(v * (0.2 + Math.random() * 0.5), t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.03 + Math.random() * 0.04);
    s.connect(f).connect(e).connect(g.sfxBus);
    s.start(t, Math.random() * 1.5, 0.1); s.stop(t + 0.12);
  }

  private bubble(v: number) {
    const g = graph();
    if (!g) return;
    const c = g.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    const f0 = 180 + Math.random() * 380;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (2 + Math.random()), t + 0.06);
    const e = c.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.06 + v * 0.1, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(e).connect(g.sfxBus);
    o.start(t); o.stop(t + 0.1);
  }

  /** the knife through something on the board */
  chop() {
    const g = graph();
    if (!g) return;
    const c = g.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = g.white;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 1.2;
    const e = c.createGain(); e.gain.setValueAtTime(0.35, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(e).connect(g.sfxBus); s.start(t, Math.random(), 0.08); s.stop(t + 0.08);
    const o = c.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.06);
    const oe = c.createGain(); oe.gain.setValueAtTime(0.4, t); oe.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(oe).connect(g.sfxBus); o.start(t); o.stop(t + 0.09);
  }

  /** something dropped into hot fat / water */
  splash(hot: boolean) {
    if (hot) { audio.play('hiss', { vol: 0.35, pitch: 1.6 }); return; }
    audio.play('splash', { vol: 0.25, pitch: 1.8 });
  }

  stop() {
    for (const n of this.nodes) { try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* */ } try { n.disconnect(); } catch { /* */ } }
    this.nodes = [];
    this.fireG = this.sizzleG = this.boilG = null;
  }
}
