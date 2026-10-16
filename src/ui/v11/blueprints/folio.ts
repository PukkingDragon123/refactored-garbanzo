// V11 Blueprints: the drafting table. A full-screen pixel-art scene (one canvas, drawn at a low
// resolution and enlarged by whole device pixels): the leather folio of blueprint sheets on the left,
// sorted into file tabs (TOOLS, GEAR, SURVIVAL, LAB, RECIPES); the chosen sheet pinned to the table,
// unrolling as it comes out; the CRAFT rubber stamp and the R&D request slip beside it.
//
//   openFolio({ at: 'bench' })   Jenna's bench at camp: craft from the sheets, send research off
//   openFolio({ at: 'laptop' })  the laptop's Blueprints app: browse, send research off
//   openFolio({ at: 'field' })   the pause menu: browse only
//
// Crafting stamps the sheet MADE, then the craft moment plays on a cutting mat: the materials fly in,
// the hammer taps them together and the made thing pops out. Keys: arrows / WASD browse, 1-5 tabs,
// Enter / E / Space craft or research, Esc closes. Mouse wheel or a drag scrolls the list.

import { game } from '../../../game/game';
import { hex, mix } from '../../../art/color';
import type { C } from '../../../art/color';
import { PixelBuffer } from '../../../art/pixel';
import { guardInput } from '../../../core/input';
import { pushKeys, sfx, rotateNN } from '../../laptop-kit';
import { paperSfx } from '../paper/sound';
import { BLUEPRINTS, hasBlueprint, isFreshBlueprint, markBlueprintSeen, onBlueprint } from '../../../game/v11/blueprints';
import type { BlueprintDef, BlueprintKind } from '../../../game/v11/blueprints';
import { bpState, canCraft, craft, craftBlockers, missingMaterials, researchBlockers, startResearch, labStatus, finishResearch, researchNights } from '../../../game/v11/bpcraft';
import type { BpState } from '../../../game/v11/bpcraft';
import { ITEMS } from '../../../game/items';
import { itemArtCanvas } from '../../../art/v11/itemart';
import { paintSheet, matIcon, paintStamp } from './sheet';
import type { Sheet } from './sheet';
import { blit, bufOf, dith, rnd } from './pxdraw';
import { drawText, textW, wrapText } from './pxfont';
import { paintTable, paintFolio, paintTab, paintCard, KIND_ICON, MARK, paintTape, paintStampTool, paintSlip, paintTag, paintNote, paintMat, paintHammer, spr } from './folioart';

export type FolioAt = 'bench' | 'laptop' | 'field';
export interface FolioOpts { at?: FolioAt; focus?: string }
export interface FolioResult { crafted: string[]; researched: string | null }

const H = (s: string) => hex(s);
const GROUPS: { id: string; label: string; kinds: BlueprintKind[]; col: string }[] = [
  { id: 'tools', label: 'TOOLS', kinds: ['weapon', 'tool'], col: '#e8d8a8' },
  { id: 'gear', label: 'GEAR', kinds: ['equipment'], col: '#a8c8e8' },
  { id: 'survival', label: 'CAMP', kinds: ['survival', 'camp'], col: '#c8e0a0' },
  { id: 'lab', label: 'LAB', kinds: ['research'], col: '#e0b8d8' },
  { id: 'recipes', label: 'LURES', kinds: ['recipe'], col: '#f0c8a0' },
];
const ORDER: Record<BpState, number> = { craft: 0, done: 1, lab: 2, research: 3, locked: 4 };
const groupOf = (d: BlueprintDef) => Math.max(0, GROUPS.findIndex(g => g.kinds.includes(d.kind)));

let openNow = false;
export const folioOpen = () => openNow;

interface Hit { x: number; y: number; w: number; h: number; act?: () => void; tip?: string[]; id?: string }
interface Craft { id: string; t0: number; done: boolean; pieces: { item: string; x: number; y: number }[]; from: [number, number][] }

function toCanvas(b: PixelBuffer): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = b.w; c.height = b.h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), b.w, b.h), 0, 0);
  return c;
}
const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export function openFolio(o: FolioOpts = {}): Promise<FolioResult> {
  const at: FolioAt = o.at ?? 'field';
  const result: FolioResult = { crafted: [], researched: null };
  finishResearch();
  openNow = true;

  // ---- DOM: one canvas over everything
  const wrap = document.createElement('div');
  wrap.className = 'bpf';
  wrap.style.cssText = 'position:absolute;inset:0;z-index:45;background:#1a100a;display:grid;place-items:center;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none';
  const cv = document.createElement('canvas');
  cv.style.cssText = 'image-rendering:pixelated;image-rendering:crisp-edges;display:block;cursor:default';
  wrap.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  game.ui.modalLayer.appendChild(wrap);
  game.ui.modalOpen++;
  game.covered++;

  // ---- state
  const all = () => Object.values(BLUEPRINTS);
  const focus = o.focus && BLUEPRINTS[o.focus] ? o.focus : null;
  let tab = focus ? groupOf(BLUEPRINTS[focus]) : 0;
  const list = () => all().filter(d => GROUPS[tab].kinds.includes(d.kind)).map((d, i) => ({ d, i })).sort((a, b) => (ORDER[bpState(a.d.id)] - ORDER[bpState(b.d.id)]) || a.i - b.i).map(x => x.d);
  let items = list();
  let sel = focus ? Math.max(0, items.findIndex(d => d.id === focus)) : 0;
  let scroll = 0;
  let hover: Hit | null = null;
  let mouse: [number, number] = [-1, -1];
  let msg: { lines: string[]; until: number } | null = null;
  let unroll = 0;                      // time the current sheet started unrolling
  let stampAnim: { t0: number; id: string; from: [number, number]; to: [number, number] } | null = null;
  let crafting: Craft | null = null;
  let shake = 0;
  let closed = false;
  let dirty = true;
  const sparks: { x: number; y: number; vx: number; vy: number; life: number; c: C }[] = [];

  // ---- layout
  let VW = 480, VH = 270, S = 1;
  const L = { lx: 0, ly: 0, lw: 0, lh: 0, sx: 0, sy: 0, sw: 0, sh: 0, ax: 0, ay: 0, side: true, portrait: false, rows: 0 };
  let table: HTMLCanvasElement | null = null;
  let folio: HTMLCanvasElement | null = null;
  const sheets = new Map<string, { s: Sheet; cv: HTMLCanvasElement; shadow: HTMLCanvasElement }>();
  const layout = () => {
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(200, window.innerWidth), Hh = Math.max(200, window.innerHeight);
    const portrait = W < Hh * 0.9;
    const minW = portrait ? 190 : 400, minH = portrait ? 330 : 190;
    S = Math.max(1, Math.floor(Math.min((W * dpr) / minW, (Hh * dpr) / minH)));
    VW = Math.floor((W * dpr) / S); VH = Math.floor((Hh * dpr) / S);
    cv.width = VW; cv.height = VH;
    cv.style.width = `${(VW * S) / dpr}px`; cv.style.height = `${(VH * S) / dpr}px`;
    ctx.imageSmoothingEnabled = false;
    L.portrait = portrait;
    const m = 5, top = 20;
    if (!portrait) {
      L.lw = Math.max(118, Math.min(156, Math.round(VW * 0.3)));
      L.lx = m; L.ly = top + 12; L.lh = VH - L.ly - m;
      const aw = VW - L.lw - m * 4;
      L.side = aw - 52 >= 216;
      L.sw = Math.min(L.side ? aw - 52 : aw, 340);
      L.sh = Math.min(VH - top - m - (L.side ? 0 : 40), 236);
      L.sx = L.lx + L.lw + m * 2 + Math.max(0, Math.floor((aw - L.sw - (L.side ? 52 : 0)) / 2));
      L.sy = top + Math.max(0, Math.floor((VH - top - m - L.sh - (L.side ? 0 : 40)) / 2));
      L.ax = L.side ? L.sx + L.sw + 8 : L.sx + L.sw - 120; L.ay = L.side ? L.sy + 18 : L.sy + L.sh + 4;
    } else {
      L.sw = VW - m * 2; L.sh = Math.min(260, Math.round((VH - top) * 0.58));
      L.sx = m; L.sy = top;
      L.side = false; L.ax = L.sx + L.sw - 120; L.ay = L.sy + L.sh + 3;
      L.lx = m; L.ly = L.ay + 38 + 11; L.lw = VW - m * 2; L.lh = VH - L.ly - m;
    }
    L.rows = Math.max(1, Math.floor((L.lh - 10) / 16));
    table = toCanvas(paintTable(VW, VH));
    folio = toCanvas(paintFolio(L.lw, L.lh));
    sheets.clear();
    dirty = true;
  };

  // ---- sheets
  const cur = (): BlueprintDef | undefined => items[sel];
  const sheetKey = (id: string, noStamp = false) => {
    const d = BLUEPRINTS[id];
    const mats = (d.needs ?? []).map(([it]) => game.save.inv.filter(s => s.id === it).reduce((a, s) => a + s.n, 0)).join(',');
    return `${id}|${bpState(id)}|${L.sw}x${L.sh}|${mats}|${noStamp ? 1 : 0}`;
  };
  const getSheet = (id: string, noStamp = false) => {
    const k = sheetKey(id, noStamp);
    let e = sheets.get(k);
    if (!e) {
      const ids = all().map(d => d.id);
      const lab = labStatus();
      const s = paintSheet(id, L.sw, L.sh, { state: bpState(id), no: ids.indexOf(id) + 1, of: ids.length, labDay: lab?.id === id ? lab.ready : undefined, noStamp });
      const sh = new PixelBuffer(s.buf.w + 3, s.buf.h + 4);
      for (let y = 0; y < s.buf.h; y++) for (let x = 0; x < s.buf.w; x++) if (s.buf.data[y * s.buf.w + x] >>> 24) { sh.set(x + 3, y + 4, H('#140a06')); }
      e = { s, cv: toCanvas(s.buf), shadow: toCanvas(sh) };
      sheets.set(k, e);
    }
    return e;
  };
  const choose = (i: number, sound = true) => {
    if (!items.length) return;
    const n = Math.max(0, Math.min(items.length - 1, i));
    if (n === sel && unroll) return;
    sel = n;
    if (sel < scroll) scroll = sel;
    if (sel >= scroll + L.rows) scroll = sel - L.rows + 1;
    unroll = performance.now();
    if (sound) paperSfx('slide', 0.7);
    const d = cur();
    if (d && hasBlueprint(d.id)) markBlueprintSeen(d.id);
    dirty = true;
  };
  const setTab = (t: number) => {
    tab = (t + GROUPS.length) % GROUPS.length;
    items = list(); scroll = 0;
    paperSfx('flip', 0.7);
    choose(0, false);
  };
  const say = (lines: string | string[], ms = 3200) => { msg = { lines: Array.isArray(lines) ? lines : wrapText(lines, Math.min(VW - 40, 240), { font: 'hand', color: 0, slant: 0.15 }), until: performance.now() + ms }; dirty = true; };

  // ---- actions
  const doCraft = () => {
    const d = cur();
    if (!d || crafting || stampAnim) return;
    const st = bpState(d.id);
    if (st === 'locked' || st === 'research' || st === 'lab') { sfx('wrong'); say('You don’t have this blueprint yet.'); return; }
    if (!d.needs?.length) { say('Nothing to make: it works already.'); return; }
    if (st === 'done') { say('Already made.'); return; }
    if (at !== 'bench') { sfx('wrong'); say(['Craft it at the camp workbench,', 'Jenna’s bench.']); return; }
    const bl = craftBlockers(d.id);
    if (bl.length) { sfx('wrong'); say(bl[0]); return; }
    const miss = missingMaterials(d.id);
    if (miss.length) {
      sfx('wrong');
      const [it, have, need] = miss[0];
      const nm = ITEMS[it]?.name ?? it, wh = ITEMS[it]?.where;
      say([`Need ${need - have} more ${nm}${miss.length > 1 ? ` (and ${miss.length - 1} more)` : ''}.`, ...(wh ? [wh] : [])], 4200);
      return;
    }
    // press the stamp onto the sheet, then make it
    const sh = getSheet(d.id);
    const from: [number, number] = stampRest();
    stampAnim = { t0: performance.now(), id: d.id, from, to: [L.sx + sh.s.stampAt[0] - 17, L.sy + sh.s.stampAt[1] - 30] };
    dirty = true;
  };
  const stampRest = (): [number, number] => [L.ax + 2, L.ay];
  const finishStamp = () => {
    const a = stampAnim!;
    stampAnim = null;
    const d = BLUEPRINTS[a.id];
    const sh = getSheet(a.id);
    const pieces = (d.needs ?? []).flatMap(([it, n]) => Array.from({ length: Math.min(n, 3) }, () => it));
    const from = sh.s.hits.map(h => [L.sx + h.x, L.sy + h.y] as [number, number]);
    if (!craft(a.id)) { say('Something’s missing after all.'); return; }
    result.crafted.push(a.id);
    sheets.clear();
    crafting = { id: a.id, t0: performance.now(), done: false, pieces: pieces.map(item => ({ item, x: 0, y: 0 })), from };
  };
  const doResearch = () => {
    const d = cur();
    if (!d || crafting) return;
    if (at === 'field') { sfx('wrong'); say(['Send research off from the laptop', 'or Jenna’s bench at camp.']); return; }
    const bl = researchBlockers(d.id);
    if (bl.length) { sfx('wrong'); say(bl[0]); return; }
    if (!startResearch(d.id)) { sfx('wrong'); return; }
    result.researched = d.id;
    paperSfx('stamp'); shake = performance.now();
    sheets.clear();
    const n = researchNights(d);
    say([`Sent to the agency’s R&D office.`, n > 1 ? `The sheet comes back in ${n} nights.` : 'The sheet comes back by morning.'], 4200);
  };
  const act = () => {
    const d = cur();
    if (!d) return;
    const st = bpState(d.id);
    if (st === 'research') doResearch(); else if (st === 'craft') doCraft();
    else if (st === 'lab') say('Still in R&D. Patience, nature boy.');
    else if (st === 'locked') say(hintOf(d));
  };
  const hintOf = (d: BlueprintDef) => d.hint ? `Not yours yet. ${d.hint}.` : d.source?.startsWith('quest:') ? 'Not yours yet. Someone on the island knows this one.' : 'Not yours yet.';

  // ---- drawing helpers
  const put = (b: PixelBuffer | HTMLCanvasElement, x: number, y: number) => {
    const c = b instanceof PixelBuffer ? toCanvas(b) : b;
    ctx.drawImage(c, Math.round(x), Math.round(y));
  };
  const memo = new Map<string, HTMLCanvasElement>();
  const once = (k: string, f: () => PixelBuffer) => { let c = memo.get(k); if (!c) { c = toCanvas(f()); memo.set(k, c); } return c; };
  const textCanvas = (k: string, t: string, col: C, font: 'tiny' | 'caps' | 'hand' = 'tiny', shadow?: C) => once(`t:${k}:${t}:${col}:${font}`, () => {
    const st = { font, color: col, shadow, slant: font === 'hand' ? 0.15 : 0 } as const;
    const b = new PixelBuffer(textW(t, st) + 3, font === 'tiny' ? 7 : 11);
    drawText(b, t, 0, font === 'hand' ? 0 : 0, st);
    return b;
  });

  // ---- render
  let hits: Hit[] = [];
  const render = (now: number) => {
    hits = [];
    const sk = shake && now - shake < 140 ? (Math.floor((now - shake) / 35) % 2 ? 1 : -1) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    ctx.translate(sk, 0);
    if (table) ctx.drawImage(table, 0, 0);

    // header: the brass plate, the place, the RP tag and the close tag
    const where = at === 'bench' ? 'JENNA’S BENCH' : at === 'laptop' ? 'R&D · LAPTOP' : 'FIELD FOLIO';
    const plate = once('plate:' + where, () => {
      const w = 76 + textW(where, { font: 'tiny', color: 0 }), b = new PixelBuffer(w, 15);
      for (let y = 0; y < 15; y++) for (let x = 0; x < w; x++) {
        if ((x < 1 || x > w - 2) && (y < 1 || y > 13)) continue;
        let c = dith(x, y, 0.3) ? H('#a8843c') : H('#c8a048');
        if (y === 0) c = H('#f0d888'); else if (y === 14 || x === w - 1) c = H('#6a5020');
        b.set(x, y, c);
      }
      for (const [x, y] of [[3, 7], [w - 4, 7]] as [number, number][]) { b.set(x, y, H('#6a5020')); b.set(x, y - 1, H('#f0d888')); }
      drawText(b, 'BLUEPRINTS', 8, 4, { font: 'caps', color: H('#3a2a10'), bold: true, shadow: H('#e8c870') });
      drawText(b, where, 70, 5, { font: 'tiny', color: H('#5a4018') });
      return b;
    });
    put(plate, 5, 3);
    const rpT = once('rp:' + game.save.rp, () => paintTag(`${game.save.rp ?? 0} RP`, '#cfe0f0'));
    const closeT = once('close', () => paintTag('CLOSE', '#f0d8c8'));
    const cx = VW - closeT.width - 5;
    put(closeT, cx, 4);
    hits.push({ x: cx, y: 4, w: closeT.width, h: closeT.height, act: () => void close(), tip: ['CLOSE (ESC)'] });
    put(rpT, cx - rpT.width - 4, 4);
    hits.push({ x: cx - rpT.width - 4, y: 4, w: rpT.width, h: rpT.height, tip: ['RESEARCH POINTS', 'THE AGENCY PAYS THEM FOR UPLOADS'] });
    const lab = labStatus();
    if (lab && !L.portrait) {
      const t = `IN R&D: ${BLUEPRINTS[lab.id]?.name.toUpperCase() ?? ''} · ${lab.due ? 'DUE NOW' : lab.nights > 1 ? lab.nights + ' NIGHTS' : 'BY MORNING'}`;
      const lc = textCanvas('lab', t, H('#cfe0f0'), 'tiny', H('#140a06'));
      const lx = 5 + plate.width + 8;
      if (lx + lc.width < cx - rpT.width - 8) put(lc, lx, 9);
    }

    // the folio: tabs, cards, the scroll thumb
    // file tabs: they overlap like real ones when the folio is narrow; the open one sits on top
    const tabs = GROUPS.map((g, i) => {
      const n = all().filter(d => g.kinds.includes(d.kind) && bpState(d.id) === 'craft' && canCraft(d.id) && at === 'bench').length;
      return { i, g, cv: once(`tab:${g.id}:${i === tab}:${n}`, () => paintTab(g.label, H(g.col), i === tab, n)) };
    });
    const totalW = tabs.reduce((a, t) => a + t.cv.width - 1, 0), room = L.lw - 8;
    const squeeze = totalW > room ? (totalW - room) / (tabs.length - 1) : 0;
    let tx0 = L.lx + 4;
    const pos = tabs.map(t => { const x = Math.round(tx0); tx0 += t.cv.width - 1 - squeeze; return x; });
    const order = tabs.filter(t => t.i !== tab).concat(tabs.filter(t => t.i === tab));
    for (const t of order) {
      const tx = pos[t.i], ty = L.ly - t.cv.height + 1;
      put(t.cv, tx, ty);
      hits.push({ x: tx, y: ty, w: t.cv.width - Math.ceil(squeeze), h: t.cv.height, act: () => setTab(t.i), tip: [t.g.label] });
    }
    if (folio) put(folio, L.lx, L.ly);
    const cw = L.lw - 12;
    for (let r = 0; r < L.rows; r++) {
      const i = scroll + r, d = items[i];
      if (!d) break;
      const st = bpState(d.id), y = L.ly + 6 + r * 16, x = L.lx + 6;
      const isHover = hover?.id === 'row:' + i;
      const card = once(`card:${cw}:${i === sel}:${st === 'locked'}:${isHover}`, () => {
        const c = paintCard(cw, 15, i === sel, st === 'locked');
        if (isHover && i !== sel) for (let yy = 1; yy < 14; yy++) c.set(cw - 3, yy, H('#ffcf5a'));
        return c;
      });
      put(card, x + (i === sel ? 3 : 0), y);
      const ox = x + (i === sel ? 3 : 0);
      put(once('ki:' + d.kind + (st === 'locked' ? ':d' : ''), () => { const b = KIND_ICON[d.kind].clone(); if (st === 'locked') for (let k = 0; k < b.data.length; k++) if (b.data[k]) b.data[k] = H('#8a8070'); return b; }), ox + 3, y + 3);
      const mark = st === 'craft' ? (canCraft(d.id) ? MARK.ready : null) : st === 'done' ? MARK.tick : st === 'lab' ? MARK.lab : st === 'locked' ? MARK.lock : MARK.rp;
      let name = st === 'locked' && !d.hint && !d.source?.startsWith('quest') ? '? ? ?' : d.name.toUpperCase();
      const maxW = cw - 30;
      while (textW(name, { font: 'tiny', color: 0 }) > maxW && name.length > 3) name = name.slice(0, -2) + '…';
      put(textCanvas('n', name, st === 'locked' ? H('#6a6050') : H('#2a1e18')), ox + 15, y + 5);
      if (mark) put(once('m:' + st + ':' + (mark === MARK.ready), () => mark), ox + cw - 10, y + 4);
      if (isFreshBlueprint(d.id)) put(once('fresh', () => MARK.pin), ox + cw - 18, y + 2);
      hits.push({ x: L.lx + 4, y, w: cw + 4, h: 15, id: 'row:' + i, act: () => choose(i) });
    }
    if (items.length > L.rows) {
      const th = Math.max(8, Math.round(((L.lh - 12) * L.rows) / items.length)), tyy = L.ly + 6 + Math.round(((L.lh - 12 - th) * scroll) / Math.max(1, items.length - L.rows));
      ctx.fillStyle = '#2a140c'; ctx.fillRect(L.lx + L.lw - 5, L.ly + 6, 2, L.lh - 12);
      ctx.fillStyle = '#c8a070'; ctx.fillRect(L.lx + L.lw - 5, tyy, 2, th);
    }
    if (!items.length) put(textCanvas('empty', 'NO SHEETS HERE YET', H('#c8a070')), L.lx + 10, L.ly + 12);

    // the sheet: unrolling from the top, pinned at the corners
    const d = cur();
    if (d) {
      const e = getSheet(d.id, !!stampAnim || (!!crafting && !crafting.done && now - crafting.t0 < 200));
      const ut = unroll ? Math.min(1, (now - unroll) / 300) : 1;
      const showH = Math.max(1, Math.round(e.s.buf.h * ease(ut)));
      ctx.drawImage(e.shadow, 0, 0, e.shadow.width, Math.min(e.shadow.height, showH + 4), L.sx, L.sy, e.shadow.width, Math.min(e.shadow.height, showH + 4));
      ctx.drawImage(e.cv, 0, 0, e.cv.width, showH, L.sx, L.sy, e.cv.width, showH);
      if (ut < 1) {
        // the roll at the unrolling edge: a little cylinder of the paper's colour
        const rc = e.s.ink.bg;
        for (let j = 0; j < 5; j++) {
          ctx.fillStyle = cssOf(j === 0 || j === 4 ? mix(rc, H('#000000'), 0.4) : j === 1 ? mix(rc, H('#ffffff'), 0.25) : rc);
          ctx.fillRect(L.sx + 2, L.sy + showH + j - 2, e.cv.width - 4, 1);
        }
        dirty = true;
      } else {
        const pinT = unroll ? Math.min(1, (now - unroll - 300) / 160) : 1;
        if (pinT < 1) dirty = true;
        const pd = pinT < 1 ? -3 + Math.round(pinT * 3) : 0;
        const pinC = d.by === 'agency' ? '#d8402c' : d.by === 'jenna' ? '#3a8ad8' : d.by === 'aroha' || d.by === 'village' ? '#e8c048' : '#40a050';
        if (d.by === 'jenna' || d.by === 'ranger') {
          const tp = once('tape', () => paintTape(18));
          put(tp, L.sx - 4, L.sy + 2 + pd); put(tp, L.sx + L.sw - 14, L.sy + 2 + pd);
        } else {
          const pn = once('pin:' + pinC, () => pinBuf(pinC));
          put(pn, L.sx + 3, L.sy + 2 + pd); put(pn, L.sx + L.sw - 11, L.sy + 2 + pd);
        }
        if (unroll && pinT >= 1 && now - unroll < 520) { unroll = 0; paperSfx('pin', 0.6); }
      }
      // material hover areas
      for (const h of e.s.hits) {
        const it = ITEMS[h.item];
        hits.push({ x: L.sx + h.x, y: L.sy + h.y, w: h.w, h: h.h, tip: [(it?.name ?? h.item).toUpperCase(), ...(it?.where ? [it.where.toUpperCase()] : [])] });
      }
      drawActions(d, now);
    }

    // the stamp being pressed
    if (stampAnim) {
      const t = (now - stampAnim.t0) / 420;
      const tool = once('stamp:on', () => paintStampTool(true));
      const k = ease(Math.min(1, t / 0.55));
      const x = stampAnim.from[0] + (stampAnim.to[0] - stampAnim.from[0]) * k, y0 = stampAnim.from[1] + (stampAnim.to[1] - stampAnim.from[1]) * k;
      const down = t > 0.62 && t < 0.86 ? 4 : 0;
      put(tool, x, y0 - (t < 0.55 ? 6 : 0) + down);
      if (t >= 0.62 && !(stampAnim as { hit?: boolean }).hit) { (stampAnim as { hit?: boolean }).hit = true; paperSfx('stamp'); shake = now; }
      if (t >= 1) finishStamp();
      dirty = true;
    }

    // a note on the table
    if (msg) {
      if (now > msg.until) { msg = null; dirty = true; }
      else {
        const nb = once('msg:' + msg.lines.join('|'), () => paintNote(msg!.lines));
        put(nb, Math.round((L.portrait ? VW : L.sx * 2 + L.sw) / 2 - nb.width / 2), VH - nb.height - 6);
      }
    }

    // the tooltip
    if (hover?.tip && !crafting) {
      const tc = once('tip:' + hover.tip.join('|'), () => {
        const w = Math.max(...hover!.tip!.map(t => textW(t, { font: 'tiny', color: 0 }))) + 8, b = new PixelBuffer(w, hover!.tip!.length * 7 + 5);
        for (let y = 0; y < b.h; y++) for (let x = 0; x < w; x++) b.set(x, y, x === 0 || y === 0 || x === w - 1 || y === b.h - 1 ? H('#2a1e18') : H('#f4e8c0'));
        hover!.tip!.forEach((t, i) => drawText(b, t, 4, 3 + i * 7, { font: 'tiny', color: i ? H('#6a5a44') : H('#2a1e18') }));
        return b;
      });
      put(tc, Math.min(VW - tc.width - 2, mouse[0] + 6), Math.min(VH - tc.height - 2, mouse[1] + 8));
    }

    // the craft moment
    if (crafting) drawCraft(now);

    // sparks
    if (sparks.length) {
      for (const s of sparks) { ctx.fillStyle = cssOf(s.c); ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
      dirty = true;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const cssOf = (c: C) => `rgb(${c & 255},${(c >>> 8) & 255},${(c >>> 16) & 255})`;
  const pinBuf = (col: string) => {
    const c = H(col), dk = mix(c, H('#000000'), 0.45), hi = mix(c, H('#ffffff'), 0.5);
    const rows = ['..aaa..', '.ahaaa.', 'ahhaaab', 'aaaaaab', '.aabbb.', '..bbb..', '...e...', '...f...'];
    const b = new PixelBuffer(7, rows.length);
    rows.forEach((r, y) => [...r].forEach((ch, x) => { const v = ch === 'a' ? c : ch === 'h' ? hi : ch === 'b' ? dk : ch === 'e' ? H('#a8b0b8') : ch === 'f' ? H('#5a6066') : 0; if (v) b.set(x, y, v); }));
    return b;
  };

  // the CRAFT stamp or the R&D slip, beside or under the sheet
  const drawActions = (d: BlueprintDef, now: number) => {
    const st = bpState(d.id);
    const x = L.ax, y = L.ay;
    if (st === 'craft' && !stampAnim) {
      const on = at === 'bench' && canCraft(d.id);
      const tool = once('stamp:' + on, () => paintStampTool(on));
      const lift = hover?.id === 'craft' && on ? -2 : 0;
      put(tool, x + 2, y + lift);
      hits.push({ x: x + 2, y, w: tool.width, h: tool.height, id: 'craft', act: doCraft, tip: on ? ['CRAFT IT (ENTER)'] : at === 'bench' ? ['MISSING MATERIALS'] : ['CRAFT AT JENNA’S BENCH'] });
      const sub = on ? 'PRESS IT' : at === 'bench' ? 'NEED MORE' : 'AT THE BENCH';
      const t = textCanvas('sub', sub, H('#e8d8b8'), 'tiny', H('#140a06'));
      put(t, Math.min(VW - t.width - 2, x + 2 + Math.round((tool.width - t.width) / 2)), y + tool.height + 2);
    } else if (st === 'research' || st === 'lab') {
      const lab = st === 'lab';
      const bl = lab ? ['in'] : researchBlockers(d.id);
      const on = !lab && !bl.length && at !== 'field';
      const n = researchNights(d);
      const lines = lab ? ['IN R&D', 'BACK', 'BY MORNING'] : ['SEND TO', 'R&D', `${d.rp} RP`, n > 1 ? `${n} NIGHTS` : 'OVERNIGHT'];
      const slip = once(`slip:${lines.join('|')}:${on}`, () => paintSlip(lines, on));
      const lift = hover?.id === 'res' && on ? -2 : 0;
      put(slip, Math.min(VW - slip.width - 2, x), y + 8 + lift);
      hits.push({ x: Math.min(VW - slip.width - 2, x), y: y + 8, w: slip.width, h: slip.height, id: 'res', act: doResearch, tip: on ? ['SEND IT (ENTER)'] : [(bl[0] ?? (at === 'field' ? 'FROM THE LAPTOP OR THE BENCH' : '')).toUpperCase()] });
    } else if (st === 'done' && d.needs?.length && !crafting) {
      put(textCanvas('done', 'MADE', H('#e8d8b8'), 'caps', H('#140a06')), x + 6, y + 10);
    }
    void now;
  };

  // the cutting mat: pieces fly in, the hammer taps, the thing pops out
  const drawCraft = (now: number) => {
    const c = crafting!;
    const t = (now - c.t0) / 1000;
    // dim the table (a 50% checker, no blending)
    ctx.fillStyle = '#0c0604';
    for (let y = 0; y < VH; y += 2) ctx.fillRect(0, y, VW, 1);
    const mw = Math.min(VW - 20, 240), mh = Math.min(VH - 30, 150), mx = Math.round((VW - mw) / 2), my = Math.round((VH - mh) / 2);
    put(once(`mat:${mw}x${mh}`, () => paintMat(mw, mh)), mx, my);
    const ccx = mx + mw / 2, ccy = my + mh / 2 - 6;
    const n = c.pieces.length || 1;
    const phase1 = 0.55, taps = [0.75, 1.05, 1.35], pop = 1.6;
    if (t < pop) {
      c.pieces.forEach((p, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2, ring = t < taps[0] ? 40 : t < taps[1] ? 28 : t < taps[2] ? 16 : 8;
        const tx = ccx + Math.cos(a) * ring - 12, ty = ccy + Math.sin(a) * ring * 0.7 - 12;
        const f = c.from[i % Math.max(1, c.from.length)] ?? [ccx, ccy];
        const k = ease(Math.min(1, t / phase1 - i * 0.08));
        const hop = t > taps[0] ? taps.reduce((acc, tp) => acc + (t > tp && t < tp + 0.1 ? -3 : 0), 0) : Math.round(Math.sin(k * Math.PI) * -12);
        put(once('mi:' + p.item, () => matIcon(p.item)), f[0] + (tx - f[0]) * k, f[1] + (ty - f[1]) * k + hop);
      });
      // the hammer: raised, then down on each tap
      if (t > phase1) {
        const hammer = once('hammer', () => paintHammer());
        const down = taps.some(tp => t > tp - 0.06 && t < tp + 0.05);
        const hb = once('hammer:' + down, () => rotateNN(bufOf(hammer), down ? 0.2 : -0.9));
        put(hb, ccx + (down ? -2 : 6), ccy - (down ? 18 : 26));
        for (const tp of taps) if (t > tp && !(c as unknown as Record<string, boolean>)['tap' + tp]) {
          (c as unknown as Record<string, boolean>)['tap' + tp] = true;
          sfx('hammer', { vol: 0.5, pitch: 0.9 + taps.indexOf(tp) * 0.12 });
          shake = now;
          for (let k = 0; k < 10; k++) sparks.push({ x: ccx, y: ccy, vx: (rnd(k, tp * 10, 3) - 0.5) * 120, vy: -40 - rnd(k, tp * 10, 4) * 70, life: 0.5, c: k % 3 ? H('#ffd27a') : H('#fff4d0') });
        }
      }
    } else {
      if (!(c as unknown as Record<string, boolean>).popped) { (c as unknown as Record<string, boolean>).popped = true; sfx('skillUnlock'); paperSfx('stamp', 0.6); shake = now; }
      // a burst ring
      const rt = Math.min(1, (t - pop) / 0.3);
      if (rt < 1) {
        const r = 8 + rt * 40;
        ctx.fillStyle = '#fff4d0';
        for (let a = 0; a < 48; a++) { const an = (a / 48) * Math.PI * 2; ctx.fillRect(Math.round(ccx + Math.cos(an) * r), Math.round(ccy + Math.sin(an) * r * 0.75), 1, 1); }
      }
      const d = BLUEPRINTS[c.id];
      const art = d.out ? itemArtCanvas(d.out[0]) : null;
      const big = once('made:' + c.id, () => {
        if (art) { const a = bufOf(art), k = Math.max(1, Math.min(3, Math.floor(Math.min(90 / a.w, 70 / a.h)))); const b = new PixelBuffer(a.w * k, a.h * k); for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) b.set(x, y, a.get(Math.floor(x / k), Math.floor(y / k))); return b; }
        const s = getSheet(c.id).s.buf, w = Math.min(120, s.w), h = Math.min(80, s.h), b = new PixelBuffer(w, h);
        const ox = Math.max(0, Math.round(L.sw * 0.27 - w / 2)), oy = Math.max(0, Math.round(L.sh * 0.42 - h / 2));
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set(x, y, s.get(ox + x, oy + y));
        return b;
      });
      const bounce = rt < 1 ? Math.round(Math.sin(rt * Math.PI) * -6) : 0;
      put(big, ccx - big.width / 2, ccy - big.height / 2 + bounce);
      const title = textCanvas('mt', d.name.toUpperCase(), H('#fff4d0'), 'caps', H('#0c1a10'));
      put(title, ccx - title.width / 2, my + mh - 30);
      const where = d.out && ITEMS[d.out[0]]?.kind === 'tool' ? 'ON YOUR TOOL BELT' : d.out ? 'IN YOUR BACKPACK' : d.chain ? 'FITTED TO YOUR GEAR' : 'BUILT AT CAMP';
      const sub = textCanvas('ms', `${where} · ${(d.effect ?? '').toUpperCase()}`.slice(0, Math.floor((mw - 10) / 4)), H('#bfe8c8'));
      put(sub, ccx - sub.width / 2, my + mh - 18);
      if (t > pop + 0.25) {
        const stp = once('madestamp', () => paintStamp('MADE!', H('#e85a48'), { big: true, ang: -0.2 }));
        put(stp, mx + mw - stp.width - 8, my + 8);
      }
      if (t > pop + 0.6) {
        c.done = true;
        put(textCanvas('cont', 'CLICK TO CONTINUE', H('#8ac0a0')), ccx - 34, my + mh - 9);
      }
    }
    dirty = true;
  };

  // ---- loop
  let last = performance.now();
  const frame = (now: number) => {
    if (closed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 260 * dt; s.life -= dt; }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
    if (shake && now - shake < 160) dirty = true;
    if (msg) dirty = true;
    if (dirty) { dirty = false; render(now); }
    requestAnimationFrame(frame);
  };

  // ---- input
  const toV = (e: PointerEvent | WheelEvent): [number, number] => {
    const r = cv.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * VW), Math.floor(((e.clientY - r.top) / r.height) * VH)];
  };
  const hitAt = (x: number, y: number) => { for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) return h; } return null; };
  let drag: { y: number; s: number; moved: boolean } | null = null;
  const inList = (x: number, y: number) => x >= L.lx && x < L.lx + L.lw && y >= L.ly && y < L.ly + L.lh;
  cv.addEventListener('pointermove', e => {
    mouse = toV(e);
    if (drag) {
      const dy = mouse[1] - drag.y;
      if (Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) { const ns = Math.max(0, Math.min(Math.max(0, items.length - L.rows), drag.s - Math.round(dy / 16))); if (ns !== scroll) { scroll = ns; dirty = true; } }
    }
    const h = hitAt(mouse[0], mouse[1]);
    if (h !== hover) { hover = h; cv.style.cursor = h?.act ? 'pointer' : 'default'; dirty = true; }
    else if (h?.tip) dirty = true;
  });
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    mouse = toV(e);
    if (crafting) { if (crafting.done) { crafting = null; dirty = true; } else crafting.t0 -= 2000; return; }
    if (inList(mouse[0], mouse[1])) { drag = { y: mouse[1], s: scroll, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch { /* */ } return; }
    hitAt(mouse[0], mouse[1])?.act?.();
  });
  cv.addEventListener('pointerup', e => {
    const d = drag; drag = null;
    if (d && !d.moved) { const p = toV(e); hitAt(p[0], p[1])?.act?.(); }
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const p = toV(e);
    if (inList(p[0], p[1])) { scroll = Math.max(0, Math.min(Math.max(0, items.length - L.rows), scroll + Math.sign(e.deltaY))); dirty = true; }
    else choose(sel + Math.sign(e.deltaY));
  }, { passive: false });
  const popKeys = pushKeys(e => {
    if (closed) return true;
    const c = e.code;
    if (crafting) { if (crafting.done && ['Enter', 'Space', 'KeyE', 'Escape'].includes(c)) { crafting = null; dirty = true; } else if (!crafting.done) crafting.t0 -= 2000; return true; }
    if (c === 'Escape' || c === 'KeyB') { void close(); return true; }
    if (c === 'ArrowDown' || c === 'KeyS') { choose(sel + 1); return true; }
    if (c === 'ArrowUp' || c === 'KeyW') { choose(sel - 1); return true; }
    if (c === 'ArrowRight' || c === 'KeyD' || c === 'Tab') { setTab(tab + 1); return true; }
    if (c === 'ArrowLeft' || c === 'KeyA') { setTab(tab - 1); return true; }
    if (c === 'Enter' || c === 'Space' || c === 'KeyE') { act(); return true; }
    const dg = /^Digit([1-5])$/.exec(c);
    if (dg) { setTab(+dg[1] - 1); return true; }
    return true;
  });
  const offBp = onBlueprint(() => { sheets.clear(); items = list(); dirty = true; });
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  let res: (r: FolioResult) => void = () => {};
  const done = new Promise<FolioResult>(r => (res = r));
  async function close() {
    if (closed) return;
    closed = true;
    openNow = false;
    paperSfx('close', 0.7);
    popKeys();
    offBp();
    window.removeEventListener('resize', onResize);
    wrap.remove();
    game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
    game.covered = Math.max(0, game.covered - 1);
    guardInput(300);
    res(result);
  }

  layout();
  paperSfx('open', 0.7);
  choose(sel, false);
  requestAnimationFrame(frame);
  // first visit at the bench: a note from Jenna
  if (at === 'bench' && !game.save.flags['v11:folioTip']) { game.save.flags['v11:folioTip'] = true; say(['Pick a sheet, then press the CRAFT stamp.', 'Missing bits? Hover them to see where they are. - J'], 6000); }
  void spr; void bufOf;
  return done;
}
