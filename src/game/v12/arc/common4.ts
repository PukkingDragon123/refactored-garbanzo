// V12 Te Ara Matatū, chapters 4-7: what the chapters share (flags, lines, hints, props, photo hooks).

import type { FieldScene } from '../../scenes/field';
import type { RawPhoto, PhotoSubject } from '../../photos';
import { judgeSubject } from '../../photos';
import { game } from '../../game';
import { floatText } from '../../../ui/v12/float';
import type { FloatStyle } from '../../../ui/v12/float';
import { Prop } from '../../../world/props';
import { sprite } from '../../sites2/common';
import type { Sprite } from '../../../art/jungle-core';

export const F = (k: string) => !!game.save.flags[k];
export const setF = (k: string) => { if (!game.save.flags[k]) { game.save.flags[k] = true; game.persist(); } };
export const clearF = (k: string) => { if (game.save.flags[k]) { delete game.save.flags[k]; game.persist(); } };
export const V = (k: string) => game.save.vars[k] ?? 0;
export const setV = (k: string, v: number) => { game.save.vars[k] = v; game.persist(); };
/** a quest's status, read straight off the save (no import of the quest list: it imports us) */
export const qs = (id: string): 'hidden' | 'active' | 'done' => (game.save.quests[id] as never) ?? 'hidden';
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/** is this scene still the one being played */
export const live = (f: FieldScene) => game.scene === (f as never);

/** a floating line by Mori */
export const say = (text: string, style: FloatStyle = 'say', ms = 2800) => floatText({ text, style, ms });
/** a floating line by someone in the scene (an actor, or Aroha the guide) */
export function line(f: FieldScene, who: string, text: string, style: FloatStyle = 'say', ms = 3000): Promise<void> {
  const a = who === 'aroha' && f.guide ? (f.guide as unknown as { a: unknown }).a : f.actors?.get(who);
  if (!a) return who === 'mori' ? say(text, style, ms) : Promise.resolve();
  return floatText({ text, style, ms, actor: a });
}
/** a conversation in floating lines (the bubbles queue them by their speakers) */
export function talk(f: FieldScene, lines: { who: string; text: string; expr?: string; style?: string }[]): Promise<void> {
  return Promise.resolve(f.say(lines.map(l => ({ ...l, expr: l.expr ?? 'neutral' })) as never)).then(() => {});
}

/** first-visit hint lines: a thought the first time Mori comes within 150 px of x */
export function hints(f: FieldScene, list: [string, number, string][]) {
  const said = new Set<string>();
  return () => {
    const p = f.player;
    if (!p || f.cutscene) return;
    for (const [id, x, text] of list) {
      if (said.has(id) || F('arc:hint:' + id)) continue;
      if (Math.abs(p.x - x) < 150) { said.add(id); game.save.flags['arc:hint:' + id] = true; void say(text, 'think', 3000); break; }
    }
  };
}

/** a hand-painted prop in the main layer */
export function addProp(f: FieldScene, key: string, gen: () => Sprite | null, x: number, y: number, z: number): Prop | null {
  const s = sprite(key, gen);
  if (!s) return null;
  const p = new Prop(s.f, x, y, z, { foliage: false });
  f.main.add(p);
  return p;
}

/** listen to the camera: every identified subject of the given species, judged */
export function onPhoto(f: FieldScene, species: string[], fn: (s: PhotoSubject, stars: number, ph: RawPhoto) => void) {
  const hook = () => {
    if (!live(f)) return;
    if (!f.cam) { setTimeout(hook, 300); return; }
    const prev = f.cam.onShot;
    f.cam.onShot = (ph: RawPhoto) => {
      prev?.(ph);
      for (const s of ph.subjects) {
        if (!species.includes(s.species)) continue;
        const j = judgeSubject(s, ph);
        if (j.identified) fn(s, j.stars, ph);
      }
    };
  };
  hook();
}

/** any species in frame at all (the flash, identified or not) */
export function onAnyShot(f: FieldScene, fn: (ph: RawPhoto) => void) {
  const hook = () => {
    if (!live(f)) return;
    if (!f.cam) { setTimeout(hook, 300); return; }
    const prev = f.cam.onShot;
    f.cam.onShot = (ph: RawPhoto) => { prev?.(ph); fn(ph); };
  };
  hook();
}

/** how many of the watchers' eyes Mori holds (the two from the first chapters, and these chapters' three) */
export function eyesHeld(): number {
  let n = 0;
  for (const id of ['arc_ch1', 'arc_ch2', 'arc_ch3']) if (qs(id) === 'done') n++;
  n = Math.min(2, n);
  for (const k of ['arc:ch4:eye', 'arc:ch5:eye', 'arc:ch6:eye']) if (F(k)) n++;
  return n;
}
