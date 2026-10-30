// V12 notebook: the PEOPLE tab. Everyone Mori has met, grouped (the crew, Te Kāinga, the rangers...):
// an index with their faces in little pencil cameos and hearts, then a page each: their portrait
// taped in like a photo, name, role and age, how close they are in hearts drawn in pencil (filled in
// red pencil), a stamp for the tier, the romance if there is one, where to find them and what Mori
// has learned they like and can't stand. The data is src/game/v11/social.ts relationships().

import { relationships, GROUP_NAMES } from '../../../game/v11/social';
import type { PersonView, GiftReaction } from '../../../game/v11/social';
import { hashStr } from '../../v11/paper/rng';
import { Flow } from './flow';
import type { Page } from './flow';
import { C, TEXT_X, TEXT_R, lineY, photoAt, tapeAt, heartAt, artOfData, plot, loopPx, wavyPx } from './art';
import { portraitArt } from './quests';
import { Art } from '../../v11/paper/px';

const WORD: Record<GiftReaction, string> = { love: 'loves', like: 'likes', neutral: 'doesn’t mind', dislike: 'isn’t keen on', hate: 'can’t stand' };

/** the sprite head cropped into a small round cameo */
async function cameoArt(id: string, d: number): Promise<Art | null> {
  try {
    const [{ registerNpcArt }, { renderHead }] = await Promise.all([import('../../../art/v11/npcs/register'), import('../../../art/v7')]);
    registerNpcArt();
    const hd = renderHead(id, { expr: 'neutral', mouth: 0, blink: false, look: 'fwd' } as never);
    const src = artOfData(hd.buf.w, hd.buf.h, hd.buf.data);
    const a = new Art(d, d);
    // (the cast's heads are painted at a higher density, k: the face sits further up in their pixels)
    const ox = Math.floor(d / 2) - hd.ax - 1, oy = Math.floor(d / 2) - hd.ay + (id === 'chunk' ? 5 : Math.round(9 * (hd.k ? hd.k * 0.8 : 1)));
    for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
      const u = (x + 0.5) / d - 0.5, v = (y + 0.5) / d - 0.5;
      if (u * u * 4 + v * v * 4 > 1) continue;
      const c = src.get(x - ox, y - oy);
      if (c >>> 24 >= 128 && u * u * 4 + v * v * 4 <= 0.8) a.put(x, y, c);
    }
    return a;
  } catch { return null; }
}

function hearts(f: Flow, p: PersonView) {
  const n = Math.max(0, Math.min(10, p.affinity / 10));
  f.block(9, (c, x, y) => {
    for (let i = 0; i < 10; i++) heartAt(c.a, x + i * 9, y + 1, i < Math.floor(n) || (i < n && n - i >= 0.5), i < n && n - i < 1 && n - i >= 0.5);
  });
}

function personPage(f: Flow, p: PersonView) {
  const seed = hashStr(p.id);
  if (f.room() < 14) f.fresh('p:' + p.id, { head: 'people · ' + (GROUP_NAMES[p.group] ?? p.group).toLowerCase() });
  else f.block(6, (c, x, y, w) => plot(c.a, wavyPx(x + 30, y + 3, x + w - 30, seed, 0.5), C.pencilLt, Infinity, { pencil: true }));
  f.anchor('p:' + p.id);
  f.float(56, 62, (c, x, y) => {
    const pic = c.pic('portrait:' + p.id, () => portraitArt(p.id));
    photoAt(c.a, pic ? cropTo(pic, 48, 50) : null, x + 2, y + 2, 48, 50, { border: 3 });
    tapeAt(c.a, x + 27, y + 2, 20, 6, -6 + (seed % 10), seed);
  });
  f.text(p.name, { bold: true, scale: 2 });
  f.text([p.role, p.age ? `${p.age}` : ''].filter(Boolean).join(', '), { color: C.pencil, pencil: true });
  hearts(f, p);
  f.text(p.tierName.toLowerCase(), { color: C.red, pencil: true });
  if (p.partner) f.text('my partner', { color: C.red, bold: true });
  else if (p.romance) f.text(p.romanceLabel.toLowerCase(), { color: C.red, pencil: true });
  f.clearFloat();
  if (p.blurb) f.text(p.blurb, { color: C.ink });
  if (p.where) f.text(`find them: ${p.where}`, { color: C.blue });
  if (p.tastes.length) {
    f.heading('what I know they like');
    for (const t of p.tastes) {
      f.text(`${WORD[t.reaction]} ${t.name.toLowerCase()}`, { color: t.reaction === 'love' || t.reaction === 'like' ? C.green : t.reaction === 'neutral' ? C.pencil : C.red, pencil: t.reaction === 'neutral' });
      if (t.reaction === 'love') { const y = lineY(f.line - 1); f.op(c => heartAt(c.a, TEXT_R - 9, y - 7, true)); }
    }
  } else f.text('No idea yet what they like. A gift would tell me.', { color: C.pencil, pencil: true });
  if (p.giftedToday) f.text('(gave them something today)', { color: C.pencil, pencil: true });
}
/** the middle w x h of a buffer */
function cropTo(a: Art, w: number, h: number): Art {
  const o = new Art(w, h), ox = Math.floor((a.w - w) / 2), oy = Math.max(0, Math.floor((a.h - h) / 2) - 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.put(x, y, a.get(x + ox, y + oy));
  return o;
}

export interface PeopleBuild { pages: Page[]; anchors: Record<string, string> }

export function peoplePages(): PeopleBuild {
  const people = relationships();
  const f = new Flow('people', 'p:index', { head: 'people' });
  f.page('p:index');
  f.title('People', { sub: `${people.length} I know here` });
  let group = '';
  for (const p of people) {
    if (p.group !== group) { group = p.group; f.gap(0); f.heading(GROUP_NAMES[group] ?? group); }
    f.need(2);
    const y = f.top();
    f.op(c => {
      const cam = c.pic('cameo:' + p.id, () => cameoArt(p.id, 18));
      if (cam) c.a.blit(cam, TEXT_X - 22, y - 2);
      plot(c.a, loopPx(TEXT_X - 13, y + 7, 10, 10, hashStr(p.id)), C.pencilLt, Infinity, { pencil: true });
    });
    f.text(p.name, { bold: true, color: C.ink, hit: { act: 'goto', arg: 'p:' + p.id } });
    const ny = lineY(f.line - 1);
    const n = Math.round(p.affinity / 10);
    f.op(c => { for (let i = 0; i < Math.min(5, Math.ceil(n / 2)); i++) heartAt(c.a, TEXT_R - 48 + i * 9, ny - 7, i < Math.floor(n / 2)); });
    f.text(p.role || (GROUP_NAMES[p.group] ?? ''), { color: C.pencil, pencil: true });
  }
  for (const p of people) personPage(f, p);
  return { pages: f.pages, anchors: { ...f.anchors, people: 'p:index' } };
}
