// V11 people UI, painted as pixel art (pixui.ts / pixfont.ts):
//
//   openPeople(id?)   the people book (K): a leather notebook, everyone Mori has met down the left
//                     page (their sprite face in a cameo, how close they are in hearts), the chosen
//                     person on the right: their portrait taped in, name, role and age, a stamp for how
//                     close they are, the romance (if there is one), where to find them, what Mori has
//                     learned about their tastes, and what they need help with
//   pickGift(id)      the gift tray: everything in the pack that can be given, in slots, with the
//                     reactions Mori already knows marked; resolves the chosen item id (or null)
//   questNote(qid)    a request note pinned up when someone asks for help: who, what, the steps
//
// The data comes from src/game/v11/social.ts relationships() (other UIs can show the same).

import { PixelBuffer } from '../../art/pixel';
import { mix } from '../../art/color';
import type { C } from '../../art/color';
import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { renderHead, renderPortrait } from '../../art/v7';
import { registerNpcArt } from '../../art/v11/npcs/register';
import { itemIcon } from '../../art/itemicons';
import { itemArtCanvas } from '../../art/v11/itemart';
import { ITEMS } from '../../game/items';
import { count } from '../../game/inventory';
import { QUEST_BY_ID, questStatus, currentStep } from '../../game/quests';
import { relationships, giftable, knownTastes, giftedToday, PEOPLE, GROUP_NAMES, partnerSince } from '../../game/v11/social';
import type { PersonView, GiftReaction } from '../../game/v11/social';
import { PixScreen, H, INK, leather, paper, tape, pin, stamp, hearts, button, slot, frame, blit, blitCanvas, icon, hash, dith, dropShadow } from './pixui';
import { drawPx, pxWidth, pxWrap } from './pixfont';

// ------------------------------------------------------------------ faces
const headCache = new Map<string, PixelBuffer>();
/** a person's sprite head (the in-world face, at its native pixels) */
function head(id: string): { buf: PixelBuffer; ax: number; ay: number } | null {
  try { registerNpcArt(); return renderHead(id, { expr: 'neutral', mouth: 0, blink: false, look: 'fwd' }); } catch { return null; }
}
/** the head cropped into a w x h cameo window at (x, y), on a paper oval */
function cameo(b: PixelBuffer, id: string, x: number, y: number, w = 22, h = 22, bg: C = H('#d8c49a')) {
  const hd = head(id);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w - 0.5, v = (j + 0.5) / h - 0.5;
    const r = u * u * 4 + v * v * 4;
    if (r > 1) continue;
    b.set(x + i, y + j, r > 0.72 ? INK.soft : bg);
  }
  if (!hd) return;
  // the face sits a little up from the neck point; Chunk's head is a whole dog
  const ox = x + Math.floor(w / 2) - hd.ax - 1, oy = y + Math.floor(h / 2) - hd.ay + (id === 'chunk' ? 5 : 9);
  for (let j = 0; j < hd.buf.h; j++) for (let i = 0; i < hd.buf.w; i++) {
    const v = hd.buf.data[j * hd.buf.w + i];
    if (v >>> 24 < 128) continue;
    const X = ox + i, Y = oy + j;
    const u = (X - x + 0.5) / w - 0.5, vv = (Y - y + 0.5) / h - 0.5;
    if (u * u * 4 + vv * vv * 4 > 0.72) continue;
    b.set(X, Y, v);
  }
  void headCache;
}
/** the dialogue portrait, taped in like a photograph */
function photo(b: PixelBuffer, id: string, x: number, y: number) {
  dropShadow(b, x - 2, y - 2, 60, 64, 2);
  b.rect(x - 3, y - 3, 62, 66, INK.out);
  b.rect(x - 2, y - 2, 60, 64, H('#fbf4e2'));
  b.rect(x, y, 56, 60, H('#c8b890'));
  try { registerNpcArt(); blit(b, renderPortrait(id, 'neutral'), x, y); } catch { /* no portrait */ }
  tape(b, x - 6, y - 5, 14, 7);
  tape(b, x + 48, y - 5, 14, 7);
}
/** an item's picture at 24 px (the painted art when it's one cell, else its icon) */
function itemPic(b: PixelBuffer, id: string, x: number, y: number) {
  const art = itemArtCanvas(id);
  if (art && art.width === 24 && art.height === 24) { blitCanvas(b, art, x, y); return; }
  if (!art && !itemIconKnown(id)) { parcel(b, ITEMS[id]?.kind === 'food', x, y); return; }
  if (itemIconKnown(id) || !art) { blit(b, itemIcon(id), x, y); return; }
  // a bigger painting with no small icon: sampled down by whole pixels and centred in the cell
  const k = Math.max(1, Math.ceil(Math.max(art.width, art.height) / 24));
  blitCanvas(b, art, x + Math.floor((24 - art.width / k) / 2), y + Math.floor((24 - art.height / k) / 2), k);
}
/** a stand-in picture for things with no painting yet: a leaf parcel of food, or a tied cloth bundle */
function parcel(b: PixelBuffer, food: boolean, x: number, y: number) {
  const r = food ? ['#1a3a14', '#2a5a22', '#4a8a34', '#7ab854'].map(c => H(c)) : ['#4a3418', '#7a5a30', '#a8844e', '#d8b87a'].map(c => H(c));
  for (let j = 5; j < 21; j++) for (let i = 3; i < 21; i++) {
    const d = Math.abs(i - 12) / 9 + Math.abs(j - 13) / 8;
    if (d > 1) continue;
    const l = 0.9 - (i - 3) / 30 - (j - 5) / 24;
    b.set(x + i, y + j, d > 0.86 ? INK.out : l > 0.62 ? r[3] : l > 0.42 ? r[2] : r[1]);
  }
  for (let i = 6; i < 18; i++) b.set(x + i, y + 13, food ? H('#c8a040') : H('#5a3a1a'));
  b.set(x + 12, y + 6, H('#c8a040')); b.set(x + 12, y + 5, H('#c8a040')); b.set(x + 11, y + 4, INK.out); b.set(x + 13, y + 4, INK.out);
}
const iconKnown = new Map<string, boolean>();
/** the old icon set has a real picture (not the '?' glyph) */
function itemIconKnown(id: string): boolean {
  let k = iconKnown.get(id);
  if (k === undefined) {
    const a = itemIcon(id), q = itemIcon('__nope__');
    k = false;
    for (let i = 0; i < a.data.length; i++) if (a.data[i] !== q.data[i]) { k = true; break; }
    iconKnown.set(id, k);
  }
  return k;
}

const REACT_ICON: Record<GiftReaction, { rows: string[]; pal: Record<string, C> }> = {
  love: { rows: ['.k.k.', 'krkrk', 'krrrk', '.krk.', '..k..'], pal: { k: INK.out, r: H('#e8404a') } },
  like: { rows: ['..k..', '.kyk.', 'kyyyk', '.kyk.', '..k..'], pal: { k: INK.out, y: H('#ffd048') } },
  neutral: { rows: ['.....', '.kkk.', '.kgk.', '.kkk.', '.....'], pal: { k: INK.out, g: H('#c0b090') } },
  dislike: { rows: ['k...k', '.kbk.', '..k..', '.kbk.', 'k...k'], pal: { k: H('#5a5a6a'), b: H('#5a5a6a') } },
  hate: { rows: ['k...k', '.k.k.', '..k..', '.k.k.', 'k...k'], pal: { k: H('#a8382a') } },
};
const REACT_WORD: Record<GiftReaction, string> = { love: 'loves', like: 'likes', neutral: 'doesn’t mind', dislike: 'isn’t keen on', hate: 'can’t stand' };

// ================================================================== the people book
const BW = 360, BH = 216;
let bookOpen = false;
let nbPeople = false;
export const peopleOpen = () => bookOpen || nbPeople;

/** V12: K opens the PEOPLE tab of Mori's notebook (the old people book is openPeopleBook) */
export async function openPeople(sel?: string): Promise<void> {
  nbPeople = true;
  try { const { openNotebook } = await import('../v12/notebook'); await openNotebook({ page: 'people', person: sel }); } finally { nbPeople = false; }
}

/** the people book; resolves when closed */
export async function openPeopleBook(sel?: string): Promise<void> {
  if (bookOpen) return;
  bookOpen = true;
  audio.play('uiOpen');
  const s = peopleScreen(sel);
  try { await s.open(); } finally { bookOpen = false; }
}
/** the people book's screen (painted, not shown: openPeople shows it; galleries preview it) */
export function peopleScreen(sel?: string): PixScreen {
  registerNpcArt();
  const people = relationships();
  // rows: group headers and people, in pages
  type Row = { kind: 'head'; text: string } | { kind: 'p'; v: PersonView };
  const rows: Row[] = [];
  let lastG = '';
  for (const v of people) { if (v.group !== lastG) { rows.push({ kind: 'head', text: (GROUP_NAMES[v.group] ?? v.group).toUpperCase() }); lastG = v.group; } rows.push({ kind: 'p', v }); }
  const PAGE_H = 148;
  const pages: Row[][] = [[]];
  let used = 0;
  for (const r of rows) {
    const h = r.kind === 'head' ? 11 : 23;
    if (used + h > PAGE_H || (r.kind === 'head' && used + 11 + 23 > PAGE_H)) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(r);
    used += h;
  }
  const order = people.map(p => p.id);
  let cur = Math.max(0, order.indexOf(sel ?? '')), page = 0;
  const pageOf = (id: string) => pages.findIndex(pg => pg.some(r => r.kind === 'p' && r.v.id === id));
  page = Math.max(0, pageOf(order[cur] ?? ''));
  const s = new PixScreen(BW, BH, sc => paintBook(sc, pages, page, order[cur] ?? null, id => { cur = order.indexOf(id); sc.redraw(); }, d => { page = Math.max(0, Math.min(pages.length - 1, page + d)); const first = pages[page].find(r => r.kind === 'p'); if (first && first.kind === 'p') cur = order.indexOf(first.v.id); audio.play('pageTurn', { vol: 0.4 }); sc.redraw(); }, () => sc.close()));
  s.onKey = code => {
    if (code === 'ArrowDown' || code === 'KeyS' || code === 'ArrowUp' || code === 'KeyW') {
      cur = Math.max(0, Math.min(order.length - 1, cur + (code === 'ArrowDown' || code === 'KeyS' ? 1 : -1)));
      page = Math.max(0, pageOf(order[cur]));
      audio.play('ui', { vol: 0.25 });
      s.redraw(); return true;
    }
    if (code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowLeft' || code === 'KeyA') {
      const np = Math.max(0, Math.min(pages.length - 1, page + (code === 'ArrowRight' || code === 'KeyD' ? 1 : -1)));
      if (np !== page) { page = np; const first = pages[page].find(r => r.kind === 'p'); if (first && first.kind === 'p') cur = order.indexOf(first.v.id); audio.play('pageTurn', { vol: 0.4 }); s.redraw(); }
      return true;
    }
    if (code === 'KeyK') { s.close(); return true; }
    return false;
  };
  return s;
}

function paintBook(s: PixScreen, pages: ({ kind: 'head'; text: string } | { kind: 'p'; v: PersonView })[][], page: number, sel: string | null, choose: (id: string) => void, turn: (d: number) => void, close: () => void) {
  const b = s.b;
  leather(b, 0, 0, BW, BH, { col: ['#1e1410', '#3a2418', '#54341e', '#6e4628'] });
  // the pages, the gutter between them
  paper(b, 10, 8, 168, 200, { spine: 'r', ruled: 12 });
  paper(b, 182, 8, 168, 200, { spine: 'l' });
  for (let y = 8; y < 208; y++) { b.set(178, y, H('#5a4024')); b.set(179, y, H('#3a2414')); b.set(180, y, H('#3a2414')); b.set(181, y, H('#5a4024')); }
  // a red ribbon marker hanging out of the bottom of the book
  for (let y = 4; y < BH; y++) for (let x = 168; x < 173; x++) if (y < 10 || y > 205) b.set(x, y, x === 168 ? H('#5a0e0a') : x === 172 ? H('#6a1410') : y > BH - 4 && (x + y) % 2 ? 0 : H('#a8281e'));
  // ---- left page: everyone
  drawPx(b, 'PEOPLE', 20, 12, INK.ink, { scale: 2, bold: true });
  const met = pages.flat().filter(r => r.kind === 'p').length;
  drawPx(b, `Day ${game.save.day || 1} · ${met} known`, 20, 36, INK.soft);
  let y = 50;
  for (const r of pages[page] ?? []) {
    if (r.kind === 'head') { drawPx(b, r.text, 20, y - 1, INK.red); for (let x = 20 + pxWidth(r.text) + 4; x < 166; x += 2) b.set(x, y + 6, INK.faint); y += 11; continue; }
    const v = r.v, on = v.id === sel, hot = s.isHot('row:' + v.id);
    if (on || hot) for (let j = 0; j < 22; j++) for (let i = 16; i < 168; i++) if (dith(i, j) < (on ? 0.5 : 0.25)) b.set(i, y + j, mix(b.get(i, y + j), H(on ? '#f6e08a' : '#e8d8a8'), 0.6));
    cameo(b, v.id, 18, y, 22, 22);
    drawPx(b, v.name, 44, y, on ? INK.ink : INK.ink, { bold: on });
    drawPx(b, v.partner ? 'Partner' : v.tierName, 44, y + 10, v.partner ? INK.red : INK.soft);
    hearts(b, 120, y + 12, v.hearts);
    if (v.partner) icon(b, REACT_ICON.love.rows, 160, y + 2, REACT_ICON.love.pal);
    if (on) pin(b, 13, y + 2);
    s.hit('row:' + v.id, 16, y, 152, 22, () => choose(v.id));
    y += 23;
  }
  // page turns
  if (pages.length > 1) {
    const ly = 192;
    const tx = `${page + 1} / ${pages.length}`;
    drawPx(b, tx, 94 - Math.floor(pxWidth(tx) / 2), ly, INK.soft);
    if (page > 0) { arrow(b, 60, ly + 4, -1, s.isHot('prev')); s.hit('prev', 54, ly, 14, 14, () => turn(-1)); }
    if (page < pages.length - 1) { arrow(b, 124, ly + 4, 1, s.isHot('next')); s.hit('next', 120, ly, 14, 14, () => turn(1)); }
  }
  // ---- right page: the chosen one
  const v = sel ? pages.flat().find(r => r.kind === 'p' && r.v.id === sel) : null;
  if (v && v.kind === 'p') paintPerson(b, v.v);
  else drawPx(b, 'Nobody chosen.', 196, 30, INK.soft);
  // the close box and the keys
  const ch = s.isHot('close');
  b.rect(334, 12, 11, 11, INK.out); b.rect(335, 13, 9, 9, ch ? H('#d8543e') : H('#a8382a'));
  for (let i = 0; i < 5; i++) { b.set(337 + i, 15 + i, INK.white); b.set(341 - i, 15 + i, INK.white); }
  s.hit('close', 332, 10, 15, 15, close);
}
function arrow(b: PixelBuffer, x: number, y: number, dir: 1 | -1, hot: boolean) {
  const c = hot ? INK.red : INK.ink;
  for (let i = 0; i < 5; i++) for (let j = -i; j <= i; j++) b.set(x + (dir > 0 ? 4 - i : i), y + j, c);
}

function paintPerson(b: PixelBuffer, v: PersonView) {
  const X = 192, W = 150;
  photo(b, v.id, X, 18);
  // name, role and age beside the photo
  const nx = X + 64, nw = 344 - nx;
  const big = pxWidth(v.name, { scale: 2, bold: true }) <= nw;
  let y = 16;
  drawPx(b, v.name, nx, y, INK.ink, big ? { scale: 2, bold: true } : { bold: true });
  y += big ? 24 : 13;
  y += drawPx(b, v.role, nx, y, INK.soft, { maxW: nw, lh: 10 });
  if (v.age !== null) { drawPx(b, `Age ${v.age}`, nx, y, INK.soft); y += 11; }
  hearts(b, nx, Math.min(72, y + 2), v.hearts);
  // how close: a stamp; the romance, when there is one
  let sy = 86;
  const st = (v.partner ? 'TOGETHER' : v.tierName.toUpperCase());
  const sw = stamp(b, st, X - 2, sy, v.partner ? INK.red : v.tier >= 2 ? INK.green : INK.blue);
  let rh = 0;
  if (v.romance > 0 && !v.partner) rh = drawPx(b, v.romanceLabel, X + sw + 4, sy + 1, INK.red, { maxW: 344 - X - sw - 4, lh: 9 });
  else if (v.partner) drawPx(b, `since day ${partnerSince() || game.save.day}`, X + sw + 4, sy + 2, INK.red);
  else if (v.friendsOnly) drawPx(b, 'good friends', X + sw + 4, sy + 2, INK.soft);
  sy += Math.max(18, rh + 2);
  // a line about them
  if (v.blurb) { const bl = pxWrap(v.blurb, W); const two = bl.slice(0, 2); if (bl.length > 2) two[1] = two[1].replace(/[ ,.]*\S*$/, '…'); for (const l of two) { drawPx(b, l, X, sy, INK.ink); sy += 10; } sy += 2; }
  if (v.where) { drawPx(b, 'Find:', X, sy, INK.red); sy += drawPx(b, v.where, X + 28, sy, INK.ink, { maxW: W - 28, lh: 10 }); }
  // what Mori knows of their tastes
  sy += 2;
  const t = knownTastes(v.id);
  const loves = Object.keys(t).filter(k => t[k] === 'love' || t[k] === 'like').map(k => (ITEMS[k]?.name ?? k).toLowerCase());
  const nots = Object.keys(t).filter(k => t[k] === 'dislike' || t[k] === 'hate').map(k => (ITEMS[k]?.name ?? k).toLowerCase());
  if (v.id !== 'chunk') {
    if (loves.length) { icon(b, REACT_ICON.love.rows, X, sy + 3, REACT_ICON.love.pal); sy += drawPx(b, loves.slice(0, 4).join(', '), X + 8, sy, INK.ink, { maxW: W - 8, lh: 10 }); }
    if (nots.length) { icon(b, REACT_ICON.hate.rows, X, sy + 3, REACT_ICON.hate.pal); sy += drawPx(b, nots.slice(0, 3).join(', '), X + 8, sy, INK.ink, { maxW: W - 8, lh: 10 }); }
    if (!loves.length && !nots.length) sy += drawPx(b, 'Give a gift to find out what they like.', X, sy, INK.faint, { maxW: W, lh: 10 });
    drawPx(b, v.giftedToday ? 'Gift given today.' : '', X, sy, INK.green);
    if (v.giftedToday) sy += 10;
  }
  // what they need a hand with
  const q = Object.values(QUEST_BY_ID).find(qq => questStatus(qq.id) === 'active' && qq.giver === v.id);
  if (q && sy < 186) {
    const stp = currentStep(q.id);
    const qy = Math.min(sy + 1, 176);
    drawPx(b, q.title, X, qy, INK.red, { bold: true });
    if (stp) drawPx(b, pxWrap(stp.text, W - 6)[0] + (pxWrap(stp.text, W - 6).length > 1 ? '…' : ''), X, qy + 11, INK.ink);
  }
}

// ================================================================== the gift tray
const GW = 300, GH = 172, COLS = 9, ROWS = 3, CELL = 28;
/** choose a gift for someone from the pack; resolves the item id, or null for "never mind" */
export async function pickGift(id: string): Promise<string | null> {
  let chosen: string | null = null;
  const s = giftScreen(id, it => { chosen = it; });
  await s.open();
  return chosen;
}
export function giftScreen(id: string, onGive: (item: string) => void): PixScreen {
  registerNpcArt();
  const items = giftable();
  const known = knownTastes(id);
  let sel = 0, page = 0;
  const per = COLS * ROWS, pagesN = Math.max(1, Math.ceil(items.length / per));
  const name = PEOPLE[id]?.name ?? id;
  const s = new PixScreen(GW, GH, sc => {
    const b = sc.b;
    leather(b, 0, 0, GW, GH, { col: ['#24160c', '#42281a', '#5e3a22', '#7a4e2c'] });
    paper(b, 8, 8, GW - 16, GH - 16, { edge: 6 });
    cameo(b, id, 14, 12, 24, 24);
    drawPx(b, `A gift for ${name}`, 44, 12, INK.ink, { bold: true });
    drawPx(b, giftedToday(id) ? 'You already gave them something today.' : 'One gift a day. Choose something they’ll like.', 44, 24, INK.soft, { maxW: 240 });
    // the slots
    const start = page * per;
    for (let k = 0; k < per; k++) {
      const i = start + k, cx = 18 + (k % COLS) * CELL, cy = 40 + Math.floor(k / COLS) * CELL;
      const it = items[i];
      slot(b, cx, cy, 26, { sel: i === sel && !!it, hot: !!it && sc.isHot('it:' + i) });
      if (!it) continue;
      itemPic(b, it, cx + 1, cy + 1);
      const n = count(it);
      if (n > 1) { const t = String(n); drawPx(b, t, cx + 24 - pxWidth(t), cy + 14, INK.white, { shadow: INK.out }); }
      const r = known[it];
      if (r) icon(b, REACT_ICON[r].rows, cx + 2, cy + 2, REACT_ICON[r].pal);
      sc.hit('it:' + i, cx, cy, 26, 26, () => { if (sel === i) give(); else { sel = i; sc.redraw(); } });
    }
    if (!items.length) drawPx(b, 'Your pack has nothing to give.', 40, 72, INK.soft);
    // pages
    if (pagesN > 1) {
      drawPx(b, `${page + 1}/${pagesN}`, 270, 64, INK.soft);
      if (page > 0) { arrow(b, 272, 80, -1, sc.isHot('gp')); sc.hit('gp', 268, 74, 12, 14, () => { page--; sel = page * per; sc.redraw(); }); }
      if (page < pagesN - 1) { arrow(b, 284, 80, 1, sc.isHot('gn')); sc.hit('gn', 282, 74, 12, 14, () => { page++; sel = page * per; sc.redraw(); }); }
    }
    // the chosen thing
    const it = items[sel];
    if (it) {
      drawPx(b, ITEMS[it]?.name ?? it, 18, 128, INK.ink, { bold: true });
      const r = known[it];
      drawPx(b, r ? `${name} ${REACT_WORD[r]} this.` : (ITEMS[it]?.desc ?? '').split('. ')[0] + '.', 18, 139, r === 'love' || r === 'like' ? INK.green : r ? INK.red : INK.soft, { maxW: 176, lh: 10 });
    }
    const can = !!it && !giftedToday(id);
    const g = button(b, 200, 128, 84, 'Give', { tone: 'green', hot: sc.isHot('give'), disabled: !can });
    if (can) sc.hit('give', g.x, g.y, g.w, g.h, give);
    const nb = button(b, 200, 146, 84, 'Never mind', { tone: 'wood', hot: sc.isHot('no') });
    sc.hit('no', nb.x, nb.y, nb.w, nb.h, () => sc.close());
  });
  const give = () => { const it = items[sel]; if (!it || giftedToday(id)) return; onGive(it); audio.play('collectPop' as never, { vol: 0.5 }); s.close(); };
  s.onKey = code => {
    const mv = (d: number) => { sel = Math.max(0, Math.min(items.length - 1, sel + d)); page = Math.floor(sel / per); s.redraw(); return true; };
    if (code === 'ArrowRight' || code === 'KeyD') return mv(1);
    if (code === 'ArrowLeft' || code === 'KeyA') return mv(-1);
    if (code === 'ArrowDown' || code === 'KeyS') return mv(COLS);
    if (code === 'ArrowUp' || code === 'KeyW') return mv(-COLS);
    if (code === 'Enter' || code === 'Space' || code === 'KeyE') { give(); return true; }
    return false;
  };
  return s;
}

// ================================================================== a request note
/** pin a quest note up (who asked, what, the steps); resolves when dismissed */
export async function questNote(qid: string): Promise<void> {
  const s = noteScreen(qid);
  if (!s) return;
  audio.play('pageTurn', { vol: 0.5 });
  await s.open();
}
export function noteScreen(qid: string): PixScreen | null {
  const q = QUEST_BY_ID[qid];
  if (!q) return null;
  registerNpcArt();
  const NW = 232;
  // measure first: description and steps decide the height
  const desc = pxWrap(q.desc, NW - 32);
  const steps = q.steps.map(st => pxWrap(st.text, NW - 44));
  const NH = Math.min(260, 84 + desc.length * 10 + steps.reduce((a, l) => a + l.length * 10 + 2, 0) + 24);
  const s = new PixScreen(NW, NH, sc => {
    const b = sc.b;
    dropShadow(b, 4, 6, NW - 10, NH - 10, 3);
    paper(b, 4, 6, NW - 10, NH - 10, { tone: ['#c8b48a', '#e0d0a8', '#f0e4c4', '#fcf6e4'], edge: 6, ruled: 10 });
    pin(b, Math.floor(NW / 2) - 2, 2);
    const who = q.giver;
    cameo(b, who, 14, 16, 24, 24);
    stamp(b, 'REQUEST', NW - 76, 14, INK.red);
    drawPx(b, `from ${PEOPLE[who]?.name ?? who}`, 44, 18, INK.soft);
    const big = pxWidth(q.title, { scale: 2, bold: true }) <= NW - 30;
    let y = 44;
    y += drawPx(b, q.title, 16, y, INK.ink, big ? { scale: 2, bold: true } : { bold: true, maxW: NW - 30 }) + 2;
    for (const l of desc) { drawPx(b, l, 16, y, INK.ink); y += 10; }
    y += 4;
    q.steps.forEach((st, i) => {
      const ok = st.done();
      frame(b, 16, y + 3, 7, 7, INK.ink);
      if (ok) for (const [dx, dy] of [[1, 3], [2, 4], [3, 3], [4, 2], [5, 1]]) b.set(16 + dx, y + 3 + dy, INK.green);
      for (const l of steps[i]) { drawPx(b, l, 28, y, ok ? INK.faint : INK.ink); y += 10; }
      y += 2;
    });
    drawPx(b, 'Added to your quests. Click to put it away.', 16, NH - 20, INK.faint);
    for (let i = 0; i < 6; i++) b.set(NW - 20 + i, NH - 14 + (hash(i, 1) > 0.5 ? 1 : 0), INK.soft);
    sc.hit('any', 0, 0, NW, NH, () => sc.close());
  });
  s.onKey = code => { if (code === 'Enter' || code === 'Space' || code === 'KeyE') { s.close(); return true; } return false; };
  return s;
}
