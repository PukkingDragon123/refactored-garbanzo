// V12 close-ups: the hands-on pixel-art scenes that replace the small in-world QTEs for the moments
// worth zooming in on (cooking, digging out a find, pulling a plant, catching a critter, developing
// photos). The old QTEs stay behind the 'v12:oldqte' save flag. Debug: zl.closeup('cook' | 'dig' |
// 'pull' | 'catch' | 'dark'), or ?closeup=<kind> in the URL.

import { game } from '../../../game/game';

/** the close-ups are on (the save flag 'v12:oldqte' brings back the old QTEs) */
export const closeupsOn = () => !game.save?.flags?.['v12:oldqte'];

export type CloseupKind = 'cook' | 'dig' | 'fossil' | 'root' | 'pull' | 'flax' | 'catch' | 'frog' | 'crab' | 'dark';

/** what a QTE call site asks for when the moment is worth a close-up */
export interface CloseupSpec {
  scene: 'dig' | 'pull' | 'catch';
  /** dig: what's buried */
  buried?: 'fossil' | 'ammonite' | 'root' | 'find';
  /** the item it's for (its art, its name on the tag) */
  item?: string;
  /** the item's kind (catch: insect / animal / shell picks the critter) */
  itemKind?: string;
  /** pull: a flax bush (else the plant's own art) */
  flax?: boolean;
  difficulty?: number;
}
/** run a close-up in a QTE's place; the same contract as the QTE: ok, score 0..1, perfect */
export async function closeupQte(s: CloseupSpec, world?: [number, number]): Promise<{ ok: boolean; score: number; perfect: boolean }> {
  let r: { ok: boolean; score: number; perfect: boolean };
  if (s.scene === 'dig') r = await (await import('./dig')).runDig({ buried: s.buried ?? 'find', item: s.item, difficulty: s.difficulty, world });
  else if (s.scene === 'pull') r = await (await import('./pull')).runPull({ item: s.item, flax: s.flax ?? !s.item, difficulty: s.difficulty, world });
  else {
    const m = await import('./catch');
    r = await m.runCatch({ critter: m.critterFor(s.item, s.itemKind), item: s.item, difficulty: s.difficulty, world });
  }
  return { ok: r.ok, score: r.score, perfect: r.perfect };
}

/** testing: four close-ups painted side by side at their true density (one screenshot) */
async function contactSheet() {
  const [{ Closeup }, { DigSet }, { PullSet }, { CatchSet }, { DarkSet }] = await Promise.all([import('./stage'), import('./dig'), import('./pull'), import('./catch'), import('./darkroom')]);
  const tiles: { scene: import('./stage').SetScene; prep: (c: import('./stage').Closeup) => void }[] = [
    { scene: new DigSet({ buried: 'fossil', item: 'fos_vertebra' }), prep: c => {
      const s = c.scene as InstanceType<typeof DigSet>;
      // terraces: topsoil off on the right, clay, then silt, then bare bone on the left
      for (let y = 0; y < s.FH; y++) for (let x = 0; x < s.FW; x++) { const k = x / s.FW; const i = y * s.FW + x; s.D[i] = Math.max(0, s.D[i] - (k < 0.42 ? 3.3 : k < 0.58 ? 2.2 : k < 0.72 ? 1.1 : 0)); }
      c.ptr.x = s.sx + s.sw * 0.5; c.ptr.y = s.sy + s.sh * 0.5;
    } },
    { scene: new PullSet({ flax: true }), prep: c => { const s = c.scene as InstanceType<typeof PullSet>; s.grip = true; s.T = 0.78; s.P = 0.35; s.loose = 0.4; s.heave = 0.7; s.gy0 = c.ptr.y = 80; c.ptr.down = true; c.ptr.x = s.bx; c.ptr.y = 52; } },
    { scene: new CatchSet({ critter: 'frog' }), prep: c => { const s = c.scene as InstanceType<typeof CatchSet>; c.ptr.x = s.cx - 30; c.ptr.y = s.cy + 10; } },
    { scene: new DarkSet({}), prep: c => { const s = c.scene as InstanceType<typeof DarkSet>; s.stage = 'dev'; s.L = 0.66; s.uneven = 0.25; c.ptr.x = 200; c.ptr.y = 100; } },
  ];
  const W = Math.floor(window.innerWidth / 2), H = Math.floor(window.innerHeight / 2);
  const cv = document.createElement('canvas');
  cv.width = W * 2; cv.height = H * 2;
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:1000;image-rendering:pixelated;';
  const g = cv.getContext('2d')!;
  const z = Math.max(2, Math.round(H / 180));
  tiles.forEach((tl, i) => {
    const c = new Closeup(tl.scene);
    const px = c.debugSnap(Math.floor(W / z), Math.floor(H / z), z, tl.prep, 1.2);
    g.putImageData(new ImageData(new Uint8ClampedArray(px.bytes.buffer as ArrayBuffer, px.bytes.byteOffset, px.bytes.byteLength), px.w, px.h), (i % 2) * W, Math.floor(i / 2) * H);
  });
  document.body.appendChild(cv);
}

/** open a close-up for testing */
export async function debugCloseup(kind: CloseupKind = 'cook'): Promise<unknown> {
  if ((kind as string) === 'sheet') return contactSheet();
  if (kind === 'cook') return (await import('./cook')).runCookCloseup({ where: 'camp', coach: 'joshu', title: 'Dinner for four', debug: true });
  if (kind === 'dig' || kind === 'fossil') return closeupQte({ scene: 'dig', buried: 'fossil', item: 'fos_vertebra' });
  if (kind === 'root') return closeupQte({ scene: 'dig', buried: 'root', item: 'vil_kumara' });
  if (kind === 'pull' || kind === 'flax') return closeupQte({ scene: 'pull', flax: true });
  if (kind === 'catch') return closeupQte({ scene: 'catch', itemKind: 'insect' });
  if (kind === 'frog') return closeupQte({ scene: 'catch', itemKind: 'animal' });
  if (kind === 'crab') return closeupQte({ scene: 'catch', itemKind: 'shell' });
  if (kind === 'dark') return (await import('./darkroom')).runDarkroom({ img: (game.save.raw as { img: string }[] | undefined)?.[0]?.img });
  return null;
}

function hookZl() {
  const w = window as unknown as { zl?: Record<string, unknown> };
  if (!w.zl) { setTimeout(hookZl, 500); return; }
  w.zl.closeup = (k: CloseupKind) => debugCloseup(k);
}
hookZl();
