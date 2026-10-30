// V12 QTE kit: short, physical moments drawn right in the world as pixel art (no panels), for
// gathering and tricky moments: dig a root, pull flax, catch a crab, climb a ledge, steady a shot.
//
//   ring   a ring closes on a target ring around the spot: press as they meet (count = rings in a row)
//   mash   a gauge fills with every press and drains on its own: fill it before time runs out
//   hold   hold the key: the gauge climbs; let go inside the green band (too long and it snaps)
//   seq    a row of arrow keys: press them in order (touch: tap in time)
//
// The time limit is a brass pocket watch beside the prompt (src/ui/v12/watch.ts) that ticks, shakes
// and goes red as it runs out. Keys: E / Space / click / tap (seq: the arrows or WASD). qte() runs one as a little cutscene and
// resolves { ok, score 0..1, perfect }. CamRing is the ring on its own for the camera (fast animals):
// the viewfinder's shutter press goes to it instead of firing straight away.

import { game } from '../game';
import type { FieldScene } from '../scenes/field';
import { Custom } from '../../world/props';
import { local } from '../assets';
import { packColor } from '../../gfx/renderer';
import type { Frame, Renderer } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { drawPx, pxWidth } from '../../ui/v11/pixfont';
import { audio } from '../../core/audio';
import { floatText } from '../../ui/v12/float';
import { showWatch } from '../../ui/v12/watch';
import type { CloseupSpec } from '../../ui/v12/closeup/index';

export type QteKind = 'ring' | 'mash' | 'hold' | 'seq';
export interface QteOpts {
  kind: QteKind;
  /** the scene (default: the current one) */
  f?: FieldScene;
  /** world anchor (default: over Mori's head) */
  x?: number;
  y?: number;
  /** a word that pops as it starts: 'DIG!', 'PULL!' */
  label?: string;
  /** 0 easy .. 1 hard */
  difficulty?: number;
  /** ring: rings in a row; mash: presses; seq: keys */
  count?: number;
  /** seconds before it fails on its own (mash / seq / hold) */
  time?: number;
  /** Mori's pose meanwhile ('kneel', 'climb'...) */
  pose?: string;
  /** V12: run this hands-on close-up instead (src/ui/v12/closeup; the save flag 'v12:oldqte' keeps the QTE) */
  closeup?: CloseupSpec;
}
export interface QteResult { ok: boolean; score: number; perfect: boolean }

const CREAM = packColor(0.95, 0.89, 0.71, 1), INK = packColor(0.12, 0.06, 0.03, 1), OCHRE = packColor(0.78, 0.35, 0.18, 1);
const GREEN = packColor(0.35, 0.64, 0.28, 1), RED = packColor(0.78, 0.25, 0.18, 1), GOLD = packColor(1, 0.82, 0.35, 1), SHADE = packColor(0.12, 0.06, 0.03, 0.55);

// ---------------------------------------------------------------- tiny painted glyphs (per scene atlas)
type GlyphKey = 'E' | 'tap' | 'left' | 'right' | 'up' | 'down';
let gOwner: unknown = null;
const glyphs = new Map<GlyphKey, Frame>();
function glyph(k: GlyphKey): Frame {
  if (gOwner !== local) { gOwner = local; glyphs.clear(); }
  let fr = glyphs.get(k);
  if (fr) return fr;
  const b = new PixelBuffer(11, 12);
  // a key cap: cream face, a darker lip at the bottom, ink outline, rounded corners
  for (let y = 0; y < 12; y++) for (let x = 0; x < 11; x++) {
    if ((x === 0 || x === 10) && (y === 0 || y === 11)) continue;
    const edge = x === 0 || y === 0 || x === 10 || y === 11;
    b.set(x, y, edge ? hex('#1e1008') : y >= 9 ? hex('#a89470') : hex('#f2e2b4'));
  }
  const ink = hex('#1e1008'), red = hex('#c8582e');
  if (k === 'E') drawPx(b, 'E', 3, -1, ink);
  else if (k === 'tap') { for (const [x, y] of [[5, 3], [4, 4], [5, 4], [6, 4], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [4, 6], [5, 6], [6, 6], [5, 7]]) b.set(x, y, red); }
  else {
    const pts: [number, number][] = [];
    for (let k2 = 0; k2 < 3; k2++) for (let w = -k2; w <= k2; w++) pts.push([k2, w]);
    for (const [a, w] of pts) {
      const [x, y] = k === 'up' ? [5 + w, 3 + a] : k === 'down' ? [5 + w, 7 - a] : k === 'left' ? [3 + a, 5 + w] : [7 - a, 5 + w];
      b.set(x, y, red);
    }
  }
  fr = local.add('v12qte:' + k, b, 5, 6);
  glyphs.set(k, fr);
  return fr;
}
const pressGlyph = (): GlyphKey => (game.input.lastDevice === 'touch' ? 'tap' : 'E');

/** a pixel ring (midpoint circle), `th` px thick, unlit */
function ring(rr: Renderer, cx: number, cy: number, r: number, c: number, th = 1) {
  for (let t = 0; t < th; t++) {
    const R = Math.max(0, Math.round(r) - t);
    let x = R, y = 0, e = 1 - R;
    while (x >= y) {
      for (const [dx, dy] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) rr.fxRect(Math.round(cx) + dx, Math.round(cy) + dy, 1, 1, c);
      y++;
      if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; }
    }
  }
}
function bar(rr: Renderer, x: number, y: number, w: number, h: number, k: number, fill: number, band?: [number, number]) {
  rr.fxRect(x - 1, y - 1, w + 2, h + 2, INK);
  rr.fxRect(x, y, w, h, SHADE);
  if (band) rr.fxRect(x + Math.round(band[0] * w), y, Math.max(1, Math.round((band[1] - band[0]) * w)), h, GREEN);
  rr.fxRect(x, y, Math.round(Math.max(0, Math.min(1, k)) * w), h, fill);
  rr.fxRect(x, y, Math.round(Math.max(0, Math.min(1, k)) * w), 1, CREAM);
}

const pressed = () => { const i = game.input; return i.hit('interact') || i.keyHit('Space') || i.keyHit('Enter') || i.click(0); };
const holding = () => { const i = game.input; return i.down('interact') || i.keyDown('Space') || i.held(0); };

// ---------------------------------------------------------------- the QTE as a little cutscene
let running = false;
/** is a QTE up right now? */
export const qteRunning = () => running;

/** run a QTE in the world; resolves when it's done */
export function qte(o: QteOpts): Promise<QteResult> {
  const f = o.f ?? (game.scene as unknown as FieldScene);
  if (!f?.main || !f.player || running) return Promise.resolve({ ok: false, score: 0, perfect: false });
  // V12: the moments worth zooming in on are close-ups now (the QTE below stays for the rest)
  if (o.closeup && !game.save.flags['v12:oldqte']) {
    running = true;
    const p = f.player, pose = p.poseOverride;
    if (o.pose) p.poseOverride = o.pose;
    const at: [number, number] = [o.x ?? p.x, (o.y ?? p.y - p.height) + 20];
    return import('../../ui/v12/closeup/index').then(m => m.closeupQte({ difficulty: o.difficulty, ...o.closeup! }, at)).catch(e => { console.error(e); return { ok: false, score: 0, perfect: false }; }).finally(() => { p.poseOverride = pose; running = false; });
  }
  running = true;
  const p = f.player;
  const d = Math.max(0, Math.min(1, o.difficulty ?? 0.4));
  const ax = () => o.x ?? p.x, ay = () => o.y ?? p.y - p.height - 26;
  const wasCut = f.cutscene;
  f.cutscene = true;
  f.cam?.raise(false);
  const pose = p.poseOverride;
  if (o.pose) p.poseOverride = o.pose;
  if (o.label) void floatText({ text: o.label, style: 'shout', ms: 900, x: ax(), y: ay() - 22 });
  return new Promise(res => {
    let t = 0, done = false, flash = 0, shake = 0;
    // per-kind state
    const rings = Math.max(1, o.count ?? 1);
    let ri = 0, rt = 0, hits = 0, perfects = 0;
    const rDur = 1.25 - d * 0.55, R0 = 9, R1 = 30;
    let mash = 0;
    const need = Math.max(4, o.count ?? Math.round(9 + d * 9));
    let hold = 0, holdOn = false;
    const band: [number, number] = [0.62 + d * 0.08, 0.82 - d * 0.04];
    const seqKeys: ('left' | 'right' | 'up' | 'down')[] = [];
    for (let i = 0; i < Math.max(2, o.count ?? 3 + Math.round(d * 2)); i++) seqKeys.push((['left', 'up', 'right', 'down'] as const)[Math.floor(Math.random() * 4)]);
    let si = 0, mistakes = 0;
    const limit = o.time ?? (o.kind === 'mash' ? 4.2 - d * 1.2 : o.kind === 'seq' ? 2.4 + seqKeys.length * (0.9 - d * 0.35) : o.kind === 'hold' ? 4 : rings * rDur + 1);
    // the time limit is a pocket watch beside the prompt (V12: every timer is a watch)
    const watch = showWatch({ manual: true, secs: limit, size: 26, anchor: () => f.css(ax() + 40, ay() + 4) });
    const finish = (ok: boolean, score: number, perfect: boolean) => {
      watch.close();
      if (done) return;
      done = true;
      audio.play(ok ? 'qteHit' as never : 'qteMiss' as never, { vol: 0.5, pitch: perfect ? 1.25 : 1 });
      const word = !ok ? 'Missed!' : perfect ? 'PERFECT!' : score > 0.7 ? 'Nice!' : 'Got it!';
      void floatText({ text: word, style: ok ? (perfect ? 'shout' : 'happy') : 'sad', ms: 1100, x: ax(), y: ay() - 8 });
      setTimeout(() => {
        f.main.remove(view);
        p.poseOverride = pose;
        if (game.scene === f) f.cutscene = wasCut;
        running = false;
        res({ ok, score, perfect });
      }, 380);
    };
    const view = new Custom(64, rr => {
      if (done && flash <= 0) return;
      const x = Math.round(ax() + (shake > 0 ? Math.sin(t * 60) * 2 : 0)), y = Math.round(ay());
      if (o.kind === 'ring') {
        const k = Math.min(1, rt / rDur);
        const r = R1 - (R1 - R0 + 4) * k;
        ring(rr, x, y, R0 + 1, INK, 1);
        ring(rr, x, y, R0, flash > 0 ? GOLD : CREAM, 2);
        ring(rr, x, y, r, Math.abs(r - R0) < 2.6 ? GOLD : OCHRE, 2);
        rr.fxDraw(glyph(pressGlyph()), x, y, 1, 1, 0, packColor(1, 1, 1, 1), 1, false);
        for (let i = 0; i < rings; i++) rr.fxRect(x - rings * 3 + i * 6, y + R1 + 4, 4, 2, i < hits ? GREEN : i < ri ? RED : SHADE);
      } else if (o.kind === 'mash') {
        bar(rr, x - 18, y + 8, 36, 5, mash, GOLD);
        const bob = flash > 0 ? 2 : 0;
        rr.fxDraw(glyph(pressGlyph()), x, y - 2 + bob, 1, 1, 0, packColor(1, 1, 1, 1), 1, false);
      } else if (o.kind === 'hold') {
        bar(rr, x - 18, y + 8, 36, 5, hold, holdOn ? GOLD : CREAM, band);
        rr.fxDraw(glyph(pressGlyph()), x, y - 2 + (holdOn ? 1 : 0), 1, 1, 0, packColor(1, 1, 1, 1), 1, false);
      } else {
        const w = seqKeys.length * 13;
        seqKeys.forEach((k, i) => {
          const gx = x - w / 2 + 6 + i * 13, gy = y + (i === si && !done ? Math.round(Math.sin(t * 9)) : 0);
          rr.fxDraw(glyph(game.input.lastDevice === 'touch' ? 'tap' : k), gx, gy, 1, 1, 0, i < si ? packColor(0.55, 1, 0.5, 1) : packColor(1, 1, 1, i === si ? 1 : 0.6), 1, false);
          if (i < si) rr.fxRect(gx - 4, gy + 7, 9, 1, GREEN);
        });
      }
    }, dt => {
      t += dt;
      watch.set(1 - t / limit);
      flash -= dt;
      shake -= dt;
      if (done) return;
      if (game.scene !== f) { finish(false, 0, false); return; }
      const inp = game.input;
      if (o.kind === 'ring') {
        rt += dt;
        const k = rt / rDur, r = R1 - (R1 - R0 + 4) * k;
        if (pressed()) {
          const off = Math.abs(r - R0);
          if (off < 2.6) { hits++; if (off < 1.2) perfects++; flash = 0.25; audio.play('qteTick' as never, { vol: 0.4, pitch: 1 + hits * 0.15 }); }
          else { shake = 0.3; audio.play('qteMiss' as never, { vol: 0.25, pitch: 1.4 }); }
          ri++; rt = 0;
        } else if (k >= 1) { ri++; rt = 0; shake = 0.3; }
        if (ri >= rings) finish(hits >= Math.ceil(rings * 0.6), hits / rings, perfects === rings);
      } else if (o.kind === 'mash') {
        mash = Math.max(0, mash - dt * (0.12 + d * 0.16));
        if (pressed()) { mash += 1 / need; flash = 0.08; audio.play('qteTick' as never, { vol: 0.25, pitch: 0.8 + mash * 0.6 }); }
        if (mash >= 1) finish(true, Math.max(0.5, 1 - t / limit), t < limit * 0.5);
        else if (t >= limit) finish(false, mash, false);
      } else if (o.kind === 'hold') {
        const on = holding();
        if (on) { holdOn = true; hold += dt * (0.42 + d * 0.3); if (hold >= 1) { shake = 0.4; finish(false, 0.2, false); } }
        else if (holdOn) {
          const inBand = hold >= band[0] && hold <= band[1];
          const mid = (band[0] + band[1]) / 2;
          finish(inBand, inBand ? 1 - Math.abs(hold - mid) / ((band[1] - band[0]) / 2) * 0.4 : hold, inBand && Math.abs(hold - mid) < (band[1] - band[0]) * 0.18);
        }
        if (!done && !holdOn && t >= limit) finish(false, 0, false);
      } else {
        const want = seqKeys[si];
        const touch = inp.lastDevice === 'touch';
        const got = touch ? (inp.click(0) ? want : null) : (['left', 'right', 'up', 'down'] as const).find(k => inp.hit(k)) ?? null;
        if (got) {
          if (got === want) { si++; flash = 0.12; audio.play('qteTick' as never, { vol: 0.35, pitch: 0.9 + si * 0.12 }); }
          else { mistakes++; shake = 0.3; audio.play('qteMiss' as never, { vol: 0.25, pitch: 1.3 }); if (mistakes >= 2) { finish(false, si / seqKeys.length, false); return; } }
        }
        if (si >= seqKeys.length) finish(true, 1 - mistakes * 0.3, mistakes === 0 && t < limit * 0.6);
        else if (t >= limit) finish(false, si / seqKeys.length, false);
      }
    });
    f.main.add(view);
  });
}

// ---------------------------------------------------------------- the camera's ring (fast animals)
/**
 * A ring closing on a moving animal while the camera is up: the shutter press lands on it. press()
 * says how well it was timed; it loops until pressed or destroyed. Drawn in the world, so it shows
 * through the viewfinder around the animal itself.
 */
export class CamRing {
  private t = 0;
  private view: Custom;
  private flash = 0;
  private gone = false;
  readonly period: number;
  constructor(readonly f: FieldScene, readonly at: () => [number, number], difficulty = 0.5) {
    this.period = 1.15 - Math.max(0, Math.min(1, difficulty)) * 0.45;
    this.view = new Custom(64, rr => {
      if (this.gone) return;
      const [x, y] = this.at();
      const R0 = 12, R1 = 34;
      const k = (this.t % this.period) / this.period, r = R1 - (R1 - R0 + 4) * k;
      ring(rr, x, y, R0, this.flash > 0 ? GOLD : CREAM, 1);
      ring(rr, x, y, r, Math.abs(r - R0) < 2.8 ? GOLD : OCHRE, 1);
    }, dt => { this.t += dt; this.flash -= dt; });
    f.main.add(this.view);
  }
  /** the shutter went: 'perfect' / 'good' land the shot, 'miss' blurs it */
  press(): 'perfect' | 'good' | 'miss' {
    const R0 = 12, R1 = 34;
    const k = (this.t % this.period) / this.period, r = R1 - (R1 - R0 + 4) * k;
    const off = Math.abs(r - R0);
    this.flash = 0.2;
    if (off < 1.4) return 'perfect';
    if (off < 3.2) return 'good';
    return 'miss';
  }
  destroy() { if (this.gone) return; this.gone = true; this.f.main.remove(this.view); }
}

/** debug: zl.qte('ring' | 'mash' | 'hold' | 'seq') */
export const QTE_ZL = (kind: QteKind = 'ring', difficulty = 0.4) => qte({ kind, difficulty, label: kind === 'mash' ? 'PULL!' : kind === 'hold' ? 'EASE IT OUT...' : kind === 'seq' ? 'CLIMB!' : 'NOW!' });
void pxWidth;

// ---------------------------------------------------------------- what kind of moment a gather is
/** a resource node's QTE (by its kind / animation); null: a quick pick, no QTE */
export function gatherQte(kind: string, anim: string, item?: string): (QteOpts & { fail: string }) | null {
  if (anim === 'dig') return { kind: 'hold', label: 'EASE IT OUT...', difficulty: 0.45, closeup: { scene: 'dig', buried: 'root', item }, fail: pickOne(['It snapped off. The rest is still down there.', 'Too hard! Mush. Gently next time.']) };
  if (kind === 'flax' || anim === 'pull') return { kind: 'mash', label: 'PULL!', difficulty: 0.4, fail: pickOne(['Ugh. It won’t budge.', 'Flax: one. Mori: nil.']) };
  if (anim === 'jar' || anim === 'net') return { kind: 'ring', label: 'CATCH!', difficulty: 0.5, count: 1, fail: pickOne(['It got away!', 'Missed! It’s laughing at me. Insects can’t laugh. It’s laughing.']) };
  return null;
}
/** a find you collect (sites10 points): its QTE by what it is */
export function findQte(kind: string, itemKind: string, item?: string): (QteOpts & { fail: string }) | null {
  if (kind === 'fossil' || kind === 'artifact') {
    const buried = kind === 'artifact' ? 'find' : item === 'fos_ammonite' ? 'ammonite' : item === 'fos_vertebra' || item === 'fos_tooth' || !item ? 'fossil' : 'find';
    return { kind: 'seq', label: 'BRUSH IT FREE', difficulty: 0.5, closeup: { scene: 'dig', buried, item }, fail: 'Careful... I nearly cracked it. Slowly.' };
  }
  if (itemKind === 'insect' || itemKind === 'animal' || itemKind === 'shell') return { kind: 'ring', label: 'CATCH!', difficulty: 0.45, fail: 'It got away!' };
  if (itemKind === 'plant' || itemKind === 'fungus' || kind === 'plant' || kind === 'sample') return { kind: 'hold', label: 'EASE IT OUT...', difficulty: 0.4, fail: 'Torn. I’ll find a better one.' };
  if (itemKind === 'material') return { kind: 'mash', label: 'PULL!', difficulty: 0.35, fail: 'Stuck fast.' };
  return null;
}
function pickOne(a: string[]) { return a[Math.floor(Math.random() * a.length)]; }
