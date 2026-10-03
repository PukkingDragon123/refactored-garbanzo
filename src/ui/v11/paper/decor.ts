// Physical UI kit: the things you stick on paper. Tape, push pins, paper clips, rubber stamps,
// polaroids, sticky notes, ink checkboxes, hand-drawn underlines and circles around words, tally
// marks, luggage tags. Each helper returns an HTML string (the book lays pages out as HTML); the
// styles live in css.ts and are installed by installPaper().

import { rng, hashStr } from './rng';
import { svgInk, roughRect, roughEllipse, underline, tick, cross, strike, tally, INK, INK_RED, INK_BLUE, PENCIL } from './ink';
import { paperTex, edgeClip } from './textures';
import type { PaperKind } from './textures';

export const escHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** a small deterministic tilt for a seed: '-1.4deg' */
export function tilt(seed: number | string, max = 2.5): string {
  const R = rng(typeof seed === 'string' ? hashStr(seed) : seed * 7 + 3);
  return `${((R() - 0.5) * 2 * max).toFixed(2)}deg`;
}

/** a strip of masking tape (place it with style: left/top/rotation) */
export function tape(o: { w?: string; rot?: string; style?: string; color?: 'cream' | 'blue' | 'green' | 'pink'; seed?: number } = {}): string {
  const clip = edgeClip(o.seed ?? 3, { left: 'perforated', right: 'perforated', amp: 1.8 });
  return `<i class="pp-tape ${o.color ?? 'cream'}" style="width:${o.w ?? '4.2em'};transform:rotate(${o.rot ?? tilt(o.seed ?? 3, 8)});clip-path:${clip};${o.style ?? ''}"></i>`;
}

/** a push pin; colour name or css colour */
export function pin(o: { color?: 'red' | 'blue' | 'green' | 'yellow' | 'white'; style?: string } = {}): string {
  return `<i class="pp-pin ${o.color ?? 'red'}" style="${o.style ?? ''}"></i>`;
}

/** a paper clip clipped over an edge */
export function clip(o: { style?: string; rot?: string; color?: string } = {}): string {
  const c = o.color ?? '#8a9096';
  const d = 'M7 30 L7 8 Q7 2 12 2 Q17 2 17 8 L17 34 Q17 41 11 41 Q4 41 4 34 L4 12';
  return `<i class="pp-clip" style="transform:rotate(${o.rot ?? '4deg'});${o.style ?? ''}"><svg viewBox="0 0 21 44" aria-hidden="true"><path d="${d}" fill="none" stroke="#3a3e44" stroke-width="2.6" stroke-linecap="round" opacity="0.35" transform="translate(1.2 1.2)"/><path d="${d}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#e8eef2" stroke-width="0.7" stroke-linecap="round" opacity="0.8" transform="translate(-0.5 -0.4)"/></svg></i>`;
}

/**
 * A rubber stamp: text in the pixel font inside a rough border, in red / blue / green ink, inked
 * unevenly. `fresh` plays the stamp-down animation when it appears.
 */
export function stamp(text: string, o: { color?: 'red' | 'blue' | 'green' | 'black'; rot?: string; shape?: 'box' | 'round'; small?: string; fresh?: boolean; style?: string; seed?: number } = {}): string {
  const col = o.color === 'blue' ? INK_BLUE : o.color === 'green' ? '#2f6b3a' : o.color === 'black' ? '#2a2630' : INK_RED;
  const seed = o.seed ?? hashStr(text);
  const round = o.shape === 'round';
  const border = round
    ? svgInk(100, 100, [{ d: roughEllipse(50, 50, 46, 46, { seed, double: false }), c: col, w: 4 }, { d: roughEllipse(50, 50, 39, 39, { seed: seed + 1, double: false }), c: col, w: 2 }], { cls: 'pp-stamp-b', stretch: true })
    : svgInk(100, 40, [{ d: roughRect(3, 3, 94, 34, { seed, double: false, rough: 0.8 }), c: col, w: 3.2 }, { d: roughRect(7, 7, 86, 26, { seed: seed + 1, double: false, rough: 0.6 }), c: col, w: 1.4 }], { cls: 'pp-stamp-b', stretch: true });
  return `<span class="pp-stamp${round ? ' round' : ''}${o.fresh ? ' fresh' : ''}" style="--c:${col};transform:rotate(${o.rot ?? tilt(seed, 9)});${o.style ?? ''}">${border}<b>${escHtml(text)}</b>${o.small ? `<small>${escHtml(o.small)}</small>` : ''}</span>`;
}

/** a polaroid: a photo (or any image URL) in a white frame with a handwritten caption */
export function polaroid(img: string, cap = '', o: { rot?: string; w?: string; style?: string; tape?: boolean; pin?: string; cls?: string; bg?: string; attrs?: string } = {}): string {
  const pic = o.bg ? `<span class="ph" style="${o.bg}"></span>` : img ? `<img class="ph" src="${img}" alt="" draggable="false">` : '<span class="ph none"></span>';
  return `<span class="pp-polaroid ${o.cls ?? ''}" style="width:${o.w ?? '10em'};transform:rotate(${o.rot ?? tilt(cap || img.length, 4)});${o.style ?? ''}"${o.attrs ? ' ' + o.attrs : ''}>${o.tape ? tape({ w: '3.6em', style: 'position:absolute;left:50%;top:-0.7em;margin-left:-1.8em' }) : ''}${o.pin ? pin({ color: o.pin as 'red', style: 'position:absolute;left:50%;top:-0.35em;margin-left:-0.45em' }) : ''}${pic}${cap ? `<span class="cap pp-hand">${escHtml(cap)}</span>` : ''}</span>`;
}

/** a sticky note (yellow, pink, blue, green) with handwriting */
export function sticky(html: string, o: { color?: 'yellow' | 'pink' | 'blue' | 'green'; rot?: string; w?: string; style?: string; cls?: string } = {}): string {
  return `<span class="pp-sticky ${o.color ?? 'yellow'} ${o.cls ?? ''}" style="width:${o.w ?? '9em'};transform:rotate(${o.rot ?? tilt(html.length, 3)});${o.style ?? ''}"><span class="pp-hand">${html}</span></span>`;
}

/** a scrap of paper with ragged edges (any paper kind) holding html */
export function scrap(html: string, o: { kind?: PaperKind; rot?: string; w?: string; style?: string; cls?: string; seed?: number; edges?: Parameters<typeof edgeClip>[1] } = {}): string {
  const seed = o.seed ?? html.length;
  const cl = edgeClip(seed, o.edges ?? { top: 'torn', right: 'deckle', bottom: 'torn', left: 'deckle' });
  return `<span class="pp-scrap ${o.cls ?? ''}" style="width:${o.w ?? 'auto'};transform:rotate(${o.rot ?? tilt(seed, 2)});${o.style ?? ''}"><span class="pp-scrap-in" style="clip-path:${cl};background-image:${paperTex(o.kind ?? 'journal')}">${html}</span></span>`;
}

export type CheckState = 'todo' | 'done' | 'now' | 'fail';
/**
 * An ink checkbox: a hand-drawn box, ticked (done), with an arrow nudging at it (now), crossed
 * (fail) or empty. `fresh` draws the tick on.
 */
export function checkbox(state: CheckState, seed = 1, fresh = false): string {
  const strokes = [{ d: roughRect(3, 4, 16, 16, { seed, double: false, rough: 0.9 }), c: state === 'todo' ? PENCIL : INK, w: 1.6 }];
  if (state === 'done') strokes.push({ d: tick(24, seed), c: INK_BLUE, w: 2.6, draw: fresh ? 0.45 : 0 } as never);
  if (state === 'fail') strokes.push({ d: cross(22, seed), c: INK_RED, w: 2.2, draw: fresh ? 0.35 : 0 } as never);
  return svgInk(24, 24, strokes, { cls: `pp-check ${state}`, w: '1.25em', h: '1.25em' });
}

/** a line of text struck through with a pen stroke (done steps) */
export function struck(html: string, seed = 1, fresh = false, col = INK): string {
  return `<span class="pp-struck">${html}${svgInk(100, 6, [{ d: strike(100, seed), c: col, w: 1.6, draw: fresh ? 0.4 : 0 }], { cls: 'pp-strike', stretch: true })}</span>`;
}

/** text with a hand-drawn underline (or a loose circle round it) */
export function marked(html: string, o: { mode?: 'under' | 'circle' | 'box'; color?: string; seed?: number; draw?: number } = {}): string {
  const seed = o.seed ?? html.length;
  const c = o.color ?? INK_RED;
  const svg = o.mode === 'circle'
    ? svgInk(100, 40, [{ d: roughEllipse(50, 20, 49, 18, { seed }), c, w: 1.6, draw: o.draw }], { cls: 'pp-circ', stretch: true })
    : o.mode === 'box'
      ? svgInk(100, 40, [{ d: roughRect(1, 2, 98, 36, { seed }), c, w: 1.5, draw: o.draw }], { cls: 'pp-circ', stretch: true })
      : svgInk(100, 6, [{ d: underline(100, { seed }), c, w: 1.7, draw: o.draw }], { cls: 'pp-under', stretch: true });
  return `<span class="pp-marked ${o.mode ?? 'under'}">${html}${svg}</span>`;
}

/** tally marks for a count ("|||| ||" for 7), optionally "of n" as faint pencil marks */
export function tallyMarks(n: number, of = 0, seed = 1): string {
  const t = tally(n, 16, seed);
  let html = n > 0 ? svgInk(t.w, 16, [{ d: t.d, c: INK_BLUE, w: 1.6 }], { cls: 'pp-tally', h: '1em', w: `${(t.w / 16).toFixed(2)}em` }) : '';
  if (of > n) {
    const r = tally(of - n, 16, seed + 9);
    html += svgInk(r.w, 16, [{ d: r.d, c: PENCIL, w: 1.1, opacity: 0.45 }], { cls: 'pp-tally ghost', h: '1em', w: `${(r.w / 16).toFixed(2)}em` });
  }
  return `<span class="pp-tallies">${html}</span>`;
}

/** a manila luggage tag on a string (labels, prices, the interaction prompt) */
export function luggageTag(html: string, o: { rot?: string; style?: string; cls?: string } = {}): string {
  return `<span class="pp-tag ${o.cls ?? ''}" style="transform:rotate(${o.rot ?? '-3deg'});${o.style ?? ''}"><i class="hole"></i>${html}</span>`;
}

export { INK, INK_RED, INK_BLUE, PENCIL };
