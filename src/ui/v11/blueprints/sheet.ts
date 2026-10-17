// V11 Blueprints: one sheet, painted as pixel art. The designer's paper (pxpaper.ts), the title in
// their hand or the draughtsman's capitals, the technical drawing (drawings.ts) with its dimensions,
// margin notes, the materials as little painted items with have / need counts, what it does, a
// title block or a signature, and the rubber stamps that say where it stands (MADE, PROPOSAL, IN R&D).
// Wide sheets put the drawing left and the notes right; narrow (phone) sheets stack them.

import { PixelBuffer } from '../../../art/pixel';
import { hex, mix } from '../../../art/color';
import type { C } from '../../../art/color';
import { BLUEPRINTS, timesMade } from '../../../game/v11/blueprints';
import type { BlueprintDef, BlueprintKind } from '../../../game/v11/blueprints';
import type { BpState } from '../../../game/v11/bpcraft';
import { count } from '../../../game/inventory';
import { ITEMS } from '../../../game/items';
import { itemArtBuffer } from '../../../art/v11/itemart';
import { itemIcon } from '../../../art/itemicons';
import { rotateNN } from '../../laptop-kit';
import { INKS, paintPaper } from './pxpaper';
import type { Ink } from './pxpaper';
import { SkPen, blit, dith, traceArt, rnd, hardAlpha } from './pxdraw';
import { drawText, drawPara, textW, drawBig, bigW, wrapText } from './pxfont';
import type { TextStyle } from './pxfont';
import { DRAWINGS } from './drawings';

const H = (s: string) => hex(s);
export const KIND_LABEL: Record<BlueprintKind, string> = { tool: 'TOOL', weapon: 'DEFENCE', equipment: 'GEAR', survival: 'SURVIVAL', research: 'RESEARCH', recipe: 'RECIPE', camp: 'CAMP' };

export interface SheetInfo {
  state: BpState;
  /** sheet number and how many there are, for the title block */
  no: number; of: number;
  /** research arrives on this day (state 'lab') */
  labDay?: number;
  /** the stamp is being pressed right now (no MADE stamp painted yet: the table animates it) */
  noStamp?: boolean;
}
export interface SheetHit { x: number; y: number; w: number; h: number; item: string }
export interface Sheet { buf: PixelBuffer; hits: SheetHit[]; stampAt: [number, number]; ink: Ink }

const tech = (I: Ink) => I.paper === 'blueprint' || I.paper === 'form';

// ---------------------------------------------------------------- stamps
/** a rubber stamp impression: double border, bold capitals, uneven ink, a slight turn */
export function paintStamp(text: string, c: C, o: { small?: string; ang?: number; seed?: number; big?: boolean } = {}): PixelBuffer {
  const n = o.big ? 2 : 1;
  const tw = bigW(text, n) + (o.big ? 0 : text.length);
  const sw = o.small ? textW(o.small, { font: 'tiny', color: c }) : 0;
  const w = Math.max(tw, sw) + 10, h = (o.big ? 18 : 11) + (o.small ? 7 : 0) + 6;
  const b = new PixelBuffer(w, h);
  const seed = o.seed ?? text.length * 7;
  const st: TextStyle = { font: 'caps', color: c, bold: !o.big, dropout: o.big ? 0.05 : 0.12, seed };
  for (let x = 0; x < w; x++) for (const y of [0, 1, h - 1, h - 2]) if (rnd(x, y, seed) > 0.06) b.set(x, y, c);
  for (let y = 0; y < h; y++) for (const x of [0, 1, w - 1, w - 2]) if (rnd(x, y, seed) > 0.06) b.set(x, y, c);
  for (let x = 3; x < w - 3; x++) { b.set(x, 3, c); b.set(x, h - 4, c); }
  for (let y = 3; y < h - 3; y++) { b.set(3, y, c); b.set(w - 4, y, c); }
  if (o.big) drawBig(b, text, Math.round((w - tw) / 2), 5, 2, st);
  else drawText(b, text, Math.round((w - tw) / 2), 5, st);
  if (o.small) drawText(b, o.small, Math.round((w - sw) / 2), h - 11, { font: 'tiny', color: c, dropout: 0.1, seed });
  // worn: knock out a few specks
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (b.get(x, y) && ((x * 7 + y * 13) % 17 === 0)) b.set(x, y, 0);
  return rotateNN(b, o.ang ?? -0.16);
}

// ---------------------------------------------------------------- material icons
const iconCache = new Map<string, PixelBuffer>();
/** a material's little picture, at most 24 x 24 (painted art, else the 24 px icon) */
export function matIcon(id: string): PixelBuffer {
  const hit = iconCache.get(id);
  if (hit) return hit;
  let b: PixelBuffer | null = null;
  const a = itemArtBuffer(id);
  if (a) {
    if (a.w <= 24 && a.h <= 24) b = a;
    else {
      // too big for a cell: halve it (nearest), centred in 24 x 24
      const k = Math.ceil(Math.max(a.w, a.h) / 24);
      b = new PixelBuffer(24, 24);
      const w = Math.floor(a.w / k), h = Math.floor(a.h / k), ox = (24 - w) >> 1, oy = (24 - h) >> 1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set(ox + x, oy + y, a.get(x * k, y * k));
    }
  }
  b = hardAlpha(b ?? itemIcon(id));
  iconCache.set(id, b);
  return b;
}

// ---------------------------------------------------------------- the drawing
function drawInto(b: PixelBuffer, d: BlueprintDef, I: Ink, x: number, y: number, w: number, h: number, seed: number) {
  const k = Math.min(w / 120, h / 80);
  const ox = Math.round(x + (w - 120 * k) / 2), oy = Math.round(y + (h - 80 * k) / 2);
  const p = new SkPen(b, I.c, I.soft, I.style, ox, oy, k, seed);
  const fn = DRAWINGS[d.id];
  if (fn) { fn(p, I); return; }
  // no drawing: trace the painted item art, enlarged by whole pixels, with its overall dimensions
  const art = d.out ? itemArtBuffer(d.out[0]) : null;
  if (art) {
    const s = Math.max(1, Math.floor(Math.min((w - 20) / art.w, (h - 16) / art.h)));
    const t = traceArt(art, s, I.c, I.soft, { tone: 0.3 });
    const tx = Math.round(x + (w - t.w) / 2), ty = Math.round(y + (h - t.h) / 2);
    blit(b, t, tx, ty);
    const q = new SkPen(b, I.c, I.soft, I.style, 0, 0, 1, seed);
    q.dimH(tx, tx + t.w, ty + t.h + 4, `${art.w}`);
    return;
  }
  p.rect(30, 14, 60, 52, { dash: [3, 2], c: I.soft });
}

/** the drawing faded back to a pencilled-in outline (a proposal, a sheet still in R&D) */
function ghost(b: PixelBuffer, I: Ink, x: number, y: number, w: number, h: number, paperAt: (x: number, y: number) => C) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
    const c = b.get(i, j);
    if (!c || c === paperAt(i, j)) continue;
    if (c === I.c || c === I.soft || c === I.accent) b.set(i, j, dith(i, j, 0.5) ? I.soft : paperAt(i, j));
  }
}

const SOURCE_HINT = (d: BlueprintDef): string => {
  if (d.hint) return d.hint;
  const s = d.source ?? '';
  if (s.startsWith('quest:')) { const who = s.slice(6); return who === 'village' ? 'Someone in the village might teach you' : `${who[0].toUpperCase()}${who.slice(1)} might show you how`; }
  if (s.startsWith('found:')) return 'A lost sheet. Somewhere on the island...';
  return 'Not drawn up yet';
};

// ---------------------------------------------------------------- the sheet
export function paintSheet(id: string, w: number, h: number, info: SheetInfo): Sheet {
  const d = BLUEPRINTS[id];
  const I = INKS[d?.by ?? 'agency'];
  const seed = [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const { buf: b, inside } = paintPaper(I.paper, w, h, { seed });
  const hits: SheetHit[] = [];
  const paper = b.clone();
  const paperAt = (x: number, y: number) => paper.get(x, y);
  const T = tech(I);
  const hand: TextStyle = { ...I.hand, color: I.c, seed };
  const tiny: TextStyle = { font: 'tiny', color: I.c };
  const softTiny: TextStyle = { font: 'tiny', color: I.soft };
  const pad = 8;
  const known = info.state === 'craft' || info.state === 'done';
  const locked = info.state === 'locked';
  const kindL = KIND_LABEL[d.kind];

  // ---- frame and header
  let top = 6;
  if (I.paper === 'blueprint') {
    const pen = new SkPen(b, I.c, I.soft, 'tech');
    pen.rect(4, 4, w - 9, h - 9, { c: I.soft });
    pen.rect(5, 5, w - 11, h - 11, { c: I.c });
    top = 9;
  } else if (I.paper === 'form') {
    // the printed header band of the rangers' form
    const band = H('#3d6b46');
    for (let y = 3; y < 15; y++) for (let x = 3; x < w - 3; x++) if (inside(x, y)) b.set(x, y, band);
    drawText(b, 'ISLAND RANGER SERVICE', 7, 6, { font: 'tiny', color: H('#e6efe2') });
    const fr = 'FIELD DESIGN FORM 7B';
    drawText(b, fr, w - 7 - textW(fr, tiny), 6, { font: 'tiny', color: H('#b8d0b4') });
    top = 18;
    drawText(b, 'ITEM:', pad, top + 1, { font: 'tiny', color: I.soft });
  } else if (I.paper === 'village') top = 12;
  else if (I.paper === 'graph') top = 7;
  const titleX = I.paper === 'form' ? pad + 22 : pad;
  const titleSt: TextStyle = T ? { font: 'caps', color: I.c, bold: true, spacing: 0 } : { ...hand, bold: true };
  let title = d.name;
  const maxTW = w - titleX - pad - 26;
  if (textW(title, titleSt) > maxTW) title = d.name.toUpperCase();
  const tw = textW(title, titleSt) <= maxTW ? drawText(b, title, titleX, top, titleSt) : drawText(b, title, titleX, top + 2, { font: 'tiny', color: I.c });
  // number / kind at the right of the header
  const noTxt = `No.${String(info.no).padStart(2, '0')}`;
  drawText(b, noTxt, w - pad - textW(noTxt, tiny), top + 1, softTiny);
  drawText(b, kindL, w - pad - textW(kindL, tiny), top + 8, { font: 'tiny', color: I.accent });
  // the rule under the title
  const ry = top + 11;
  const pen = new SkPen(b, I.c, I.soft, I.style, 0, 0, 1, seed);
  if (T) { pen.line(pad, ry, w - pad, ry, { c: I.soft, wobble: 0 }); if (I.paper === 'blueprint') pen.line(pad, ry + 1, w - pad, ry + 1, { c: I.soft, wobble: 0, dash: [1, 1] }); }
  else pen.line(titleX, ry, titleX + tw + 4, ry + 1, { c: I.style === 'biro' ? I.accent : I.soft });

  // ---- layout: the drawing across the top; below it the notes (left) and the materials and what it
  // does (right), or all stacked on a narrow sheet
  const wide = w >= 200;
  const blockH = T ? 13 : 10;
  const bodyY = ry + 4, bodyB = h - blockH - 7;
  const dx = pad, dy = bodyY, dw = w - pad * 2;
  const dh = Math.max(56, Math.min(Math.round(dw * 0.62), Math.floor((bodyB - bodyY) * (wide ? 0.5 : 0.4))));
  const cy = dy + dh + 3;
  // notes column (nx, nw) and the materials / effect column (cx, cw)
  const nx = pad, nw = wide ? Math.floor((w - pad * 2) * 0.42) : w - pad * 2;
  const cx = wide ? nx + nw + 6 : pad, cw = wide ? w - pad - cx : w - pad * 2;
  if (I.paper === 'form') {
    const fp = new SkPen(b, I.soft, I.soft, 'tech');
    fp.rect(dx - 2, dy - 1, dw + 3, dh + 2, { c: H('#9ab89e') });
    drawText(b, 'DRAWING', dx, dy + 1, { font: 'tiny', color: H('#7e9a82') });
  }

  // ---- the drawing
  if (locked) {
    const lp = new SkPen(b, I.c, I.soft, I.style, 0, 0, 1, seed);
    lp.rect(dx + 6, dy + 4, dw - 12, dh - 8, { dash: [3, 3], c: I.soft });
    const q = '?', n = Math.max(2, Math.min(5, Math.floor(dh / 14)));
    drawBig(b, q, Math.round(dx + (dw - bigW(q, n)) / 2), Math.round(dy + (dh - 7 * n) / 2), n, { font: 'caps', color: I.soft, dropout: 0.12 });
  } else {
    drawInto(b, d, I, dx, dy + (I.paper === 'form' ? 6 : 0), dw, dh - (I.paper === 'form' ? 6 : 0), seed);
    if (!known) ghost(b, I, dx, dy, dw, dh, paperAt);
  }

  // ---- notes (left column, or first when stacked)
  let y = cy;
  const colSt: TextStyle = T ? { ...hand, color: I.c } : hand;
  const noteRoom = Math.max(1, Math.floor((bodyB - cy) / 10));
  if (known && d.notes?.length) {
    for (const n of d.notes.slice(0, 3)) {
      if (y > bodyB - 10 - (wide ? 0 : 50)) break;
      y += drawPara(b, (T ? '- ' : '') + n, nx, y, nw, colSt, { maxLines: 2 });
    }
    y += 2;
  } else if (locked) {
    y += drawPara(b, SOURCE_HINT(d), nx, y, nw, { ...colSt, color: I.soft }, { maxLines: Math.min(4, noteRoom) }) + 2;
  } else if (!known && d.rp) {
    y += drawPara(b, info.state === 'lab' ? 'With the agency’s R&D office. The sheet comes back by morning.' : 'A proposal. The R&D office can draw it up overnight.', nx, y, nw, { ...colSt, color: I.soft }, { maxLines: Math.min(4, noteRoom) }) + 2;
  }
  if (wide) y = cy;
  // ---- materials
  const needs = d.needs ?? [];
  if (needs.length) {
    const lab = T ? 'MATERIALS' : 'YOU’LL NEED';
    if (T) drawText(b, lab, cx, y, softTiny); else drawText(b, lab.toLowerCase(), cx, y - 1, { ...hand, color: I.soft });
    y += T ? 7 : 9;
    const cell = 26, per = Math.max(1, Math.floor((cw + 3) / cell));
    needs.forEach(([it, n], i) => {
      const col = i % per, row = Math.floor(i / per);
      const x = cx + col * cell, yy = y + row * 34;
      // a parts-list box on the technical papers, a pencilled ring elsewhere
      const box = new SkPen(b, I.soft, I.soft, T ? 'tech' : I.style, 0, 0, 1, seed + i);
      if (T) box.rect(x, yy, 25, 25, { c: I.soft }); else box.ellipse(x + 12.5, yy + 12.5, 12.5, 12, { c: I.soft });
      if (!locked) blit(b, matIcon(it), x + 1, yy + 1);
      else drawText(b, '?', x + 10, yy + 9, { font: 'caps', color: I.soft });
      const have = count(it), ok = have >= n;
      const label = known ? `${Math.min(have, 99)}/${n}` : `×${n}`;
      const lc = known ? (ok ? (T ? I.c : H('#2f6b3a')) : I.accent) : I.soft;
      drawText(b, label, x + 13 - Math.floor(textW(label, tiny) / 2), yy + 27, { font: 'tiny', color: lc });
      hits.push({ x, y: yy, w: 25, h: 32, item: it });
      if (known && ok) { const tp = new SkPen(b, lc, lc, 'tech'); tp.line(x + 19, yy + 3, x + 21, yy + 5, { c: lc }); tp.line(x + 21, yy + 5, x + 25, yy, { c: lc }); }
    });
    y += Math.ceil(needs.length / per) * 34 + 1;
  } else if (known || d.rp) {
    drawPara(b, T ? 'NO MATERIALS: KNOW-HOW' : 'nothing to make: you just know it now', cx, y, cw, T ? softTiny : { ...hand, color: I.soft }, { maxLines: 2 });
    y += 10;
  }
  // what it does
  if (d.effect && y < bodyB - 6) {
    const eff = d.effect;
    if (T) { drawText(b, 'EFFECT', cx, y, { font: 'tiny', color: I.accent }); y += 7; y += drawPara(b, eff.toUpperCase(), cx, y, cw, tiny, { lh: 6, maxLines: Math.max(1, Math.floor((bodyB - y) / 6)) }); }
    else { y += drawPara(b, '→ ' + eff, cx, y, cw, { ...hand, color: I.accent }, { maxLines: Math.max(1, Math.floor((bodyB - y) / 10)) }); }
  }
  // a repeatable recipe: how many made so far
  const made = timesMade(id);
  if (d.repeat && made > 0) drawText(b, `MADE ×${made}`, cx, Math.min(y + 2, bodyB - 2), { font: 'tiny', color: I.soft });

  // ---- title block / signature
  const by = h - blockH - 5;
  if (T) {
    const bp = new SkPen(b, I.soft, I.soft, 'tech');
    bp.rect(pad - 2, by, w - pad * 2 + 3, blockH, { c: I.soft });
    const cells = [`DRAWN ${I.sig.toUpperCase()}`, `KIND ${kindL}`, `SHEET ${String(info.no).padStart(2, '0')}/${info.of}`, `SCALE 1:${d.kind === 'research' ? 1 : 4}`];
    let x = pad + 1;
    const cwid = Math.floor((w - pad * 2) / cells.length);
    cells.forEach((t, i) => {
      if (i) bp.line(x - 2, by, x - 2, by + blockH, { c: I.soft });
      let s = t; while (textW(s, tiny) > cwid - 4 && s.length > 3) s = s.slice(0, -1);
      drawText(b, s, x, by + 4, { font: 'tiny', color: i === 0 ? I.c : I.soft });
      x += cwid;
    });
  } else {
    const sig = I.sig === 'unsigned' ? '' : '- ' + I.sig;
    if (sig) drawText(b, sig, w - pad - textW(sig, hand) - 2, by + 1, { ...hand, color: I.c });
    drawText(b, noTxt, pad, by + 3, softTiny);
    // a doodle beside the signature: a koru for Aroha and the village, a smiley for Jenna
    const dp = new SkPen(b, I.soft, I.soft, I.style, 0, 0, 1, seed);
    const sx = w - pad - textW(sig, hand) - 14;
    if (d.by === 'aroha' || d.by === 'village') { dp.circle(sx, by + 5, 3, { a0: 0, a1: Math.PI * 1.7 }); dp.curve([[sx + 3, by + 5], [sx + 5, by + 9], [sx + 9, by + 9]]); }
    else if (d.by === 'jenna') { dp.circle(sx, by + 5, 4, { c: I.accent }); dp.px(sx - 1, by + 4, I.accent); dp.px(sx + 2, by + 4, I.accent); dp.line(sx - 1, by + 7, sx + 2, by + 7, { c: I.accent }); }
  }

  // ---- stamps
  const stampAt: [number, number] = [Math.round(dx + dw * 0.62), Math.round(dy + dh * 0.62)];
  const red = I.paper === 'blueprint' ? H('#ff8a6a') : H('#b8322a'), blue = I.paper === 'blueprint' ? H('#d8f0ff') : H('#2a4a9a');
  let st: PixelBuffer | null = null;
  if (info.state === 'done' && !info.noStamp) st = paintStamp(d.repeat ? 'MADE' : 'MADE', red, { big: true, small: d.chain ? 'FITTED' : d.out && ITEMS[d.out[0]]?.kind === 'tool' ? 'ON YOUR BELT' : 'WORKS', seed });
  else if (info.state === 'lab') st = paintStamp('IN R&D', blue, { small: info.labDay ? `BACK BY DAY ${info.labDay}` : 'BACK BY MORNING', seed, ang: 0.1 });
  else if (info.state === 'research') st = paintStamp('PROPOSAL', blue, { small: `${d.rp} RP`, seed, ang: -0.08 });
  if (st) blit(b, st, Math.min(w - st.w - 6, stampAt[0] - (st.w >> 1)), Math.min(h - st.h - 6, stampAt[1] - (st.h >> 1)));
  // keep everything on the paper
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!inside(i, j)) b.set(i, j, 0);
  void mix; void wrapText;
  return { buf: b, hits, stampAt, ink: I };
}
