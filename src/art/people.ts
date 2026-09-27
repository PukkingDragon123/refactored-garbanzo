// V2 people: public API. Bodies (per anim/frame), heads (any expression / mouth / blink / look)
// and portraits for the five castaways. See people-*.ts for the rig, parts, cast and heads.

import { PixelBuffer } from './pixel';
import { paintBody, BodyFrame } from './people-body';
import { ANIMS, COMMON, CHAR_SPECIALS, poseFor, AnimInfo } from './people-anims';
import { CHARS } from './people-cast';
import { drawHeadInto, renderHeadRaw, Expr, Look, HeadOpts } from './people-heads';
import type { CharId } from './people-parts';
import { renderBust, DESIGNS, BustId } from './portrait/cast';
import type { PExpr } from './portrait/face';

export type { CharId, Expr, Look, HeadOpts, BodyFrame, AnimInfo };
export { ANIMS };

export const CHAR_ANIMS: Record<CharId, string[]> = {
  rowan: [...COMMON, ...CHAR_SPECIALS.rowan],
  crowe: [...COMMON, ...CHAR_SPECIALS.crowe],
  aroha: [...COMMON, ...CHAR_SPECIALS.aroha],
  lou: [...COMMON, ...CHAR_SPECIALS.lou],
  pip: [...COMMON, ...CHAR_SPECIALS.pip],
};

export const CHAR_INFO: Record<CharId, { name: string; short: string; voice: number; height: number }> = {
  rowan: { name: 'Rowan Ellis', short: 'Rowan', voice: 1, height: 82 },
  crowe: { name: 'Captain Barnaby Crowe', short: 'Crowe', voice: 0.66, height: 80 },
  aroha: { name: 'Aroha', short: 'Aroha', voice: 1.08, height: 88 },
  lou: { name: 'Lou Tupou', short: 'Lou', voice: 0.9, height: 72 },
  pip: { name: 'Pip Nakamura', short: 'Pip', voice: 1.45, height: 74 },
};

export function renderBody(id: CharId, anim: string, frame: number): BodyFrame {
  const ch = CHARS[id] ?? CHARS.rowan;
  const a = ANIMS[anim] ? anim : 'idle';
  const info = ANIMS[a];
  const pose = poseFor(id, a, ch.build, frame % Math.max(1, info.frames));
  return paintBody(ch, pose, a, info.frames > 1 ? frame / info.frames : 0);
}

export function renderHead(id: CharId, o: HeadOpts): { buf: PixelBuffer; ax: number; ay: number } {
  return renderHeadRaw(id, o);
}

/** Portrait head for the HUD and UI, drawn with the Dave-the-Diver-style portrait kit. */
export function renderPortrait(id: CharId, expr: Expr, o: { mouth?: 0 | 1 | 2; blink?: boolean } = {}): PixelBuffer {
  if (!(id in DESIGNS)) {
    const r = drawHeadInto(id, { expr, mouth: o.mouth ?? 0, blink: !!o.blink, look: 'fwd' }, 2);
    return r.buf.trim(1).buf;
  }
  return renderBust(id as BustId, expr as PExpr, { scale: 0.36, headOnly: true, talk: o.mouth ?? 0, blink: !!o.blink }).trim(1).buf;
}
