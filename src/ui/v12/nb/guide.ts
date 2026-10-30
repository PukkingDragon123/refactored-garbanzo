// V12 notebook: the FIELD GUIDE tab. Contents (how complete each category is, an index of the species
// with page numbers), then a page per animal: Mori's pencil-and-wash sketch of it taped in, his best
// photo of it, the vitals, how complete the page is, the behaviours he has photographed ticked off,
// the research write-up filling in section by section as research progresses (the rest scribbled out
// until then), the fun fact on a sticky note, the findings and a strip of photos. Then the animals
// still to find, and the specimens, taonga, fossils and places. The data is the encyclopedia's
// (src/ui/v10/encyData.ts, the research log).

import { game } from '../../../game/game';
import { SPECIES_BY_ID } from '../../../game/species';
import { ITEMS } from '../../../game/items';
import { location } from '../../../game/v10/regions';
import { entry, coverOf, photosOf, secOf, r10, analysedTimes, isTaonga, itemCat } from '../../../game/v9/research9';
import type { UploadRecord } from '../../../game/save';
import { CATS, entries, catStat, overall, speciesSections, speciesProgress, kindLabel, locByKey, discByKey } from '../../v10/encyData';
import type { EncEntry, Cat } from '../../v10/encyData';
import { Art } from '../../v11/paper/px';
import { sketchCanvas } from '../../v11/paper/sketch';
import { hashStr } from '../../v11/paper/rng';
import { Flow } from './flow';
import type { Page, Ctx } from './flow';
import {
  C, TEXT_X, TEXT_R, TEXT_W, LINE, lineY, hand, handW, wrap, photoAt, tapeAt, stickyAt, barAt, plot, wavyPx, doodleArt, loadImg, photoArt, fitArt, stampAt,
} from './art';

const STATUS = ['', 'Common', 'Uncommon', 'Scarce', 'Rare', 'Legendary'];
const CAT_DOODLE: Record<Cat, string> = { fauna: 'bird', flora: 'leaf', culture: 'compass', fossils: 'shell', samples: 'feather', places: 'mountain' };

// ---------------------------------------------------------------- pictures

const spriteOf = (id: string): Promise<string> => import('../../icons').then(m => { try { const u = m.speciesSprite(id); return u.length > 500 ? u : ''; } catch { return ''; } }).catch(() => '');
/** Mori's sketch of an animal (from its sprite), fitted under w x h */
async function sketchOfSpecies(id: string, w: number, h: number, seed: number): Promise<Art | null> {
  const src = await spriteOf(id);
  if (!src) return null;
  const im = await loadImg(src);
  if (!im) return null;
  return fitArt(Art.from(sketchCanvas(im, { seed, style: 'pencil', wash: 0.62 })), w, h, 2);
}
async function sketchOfIcon(src: string, w: number, h: number, seed: number): Promise<Art | null> {
  if (!src) return null;
  const im = await loadImg(src);
  if (!im) return null;
  return fitArt(Art.from(sketchCanvas(im, { seed, style: 'pencil', wash: 0.55 })), w, h, 2);
}
/** a photo cut round the animal in it */
async function photoOf(u: UploadRecord, species: string | null, w: number, h: number, pad = 2.4): Promise<Art | null> {
  const im = await loadImg(u.img);
  if (!im) return null;
  const sub = species ? u.subjects.find(s => s.species === species) : null;
  let crop: [number, number, number, number] = [0, 0, 1, 1];
  if (sub) {
    const [x0, y0, x1, y1] = sub.bbox, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    // a box round the subject at the target aspect, in image pixels
    let bw = Math.max((x1 - x0) * iw * pad, ((y1 - y0) * ih * pad * w) / h);
    bw = Math.min(iw, Math.max(bw, iw * 0.25));
    const bh = Math.min(ih, (bw * h) / w);
    const nx0 = Math.max(0, Math.min(iw - bw, cx * iw - bw / 2)), ny0 = Math.max(0, Math.min(ih - bh, cy * ih - bh / 2));
    crop = [nx0 / iw, ny0 / ih, (nx0 + bw) / iw, (ny0 + bh) / ih];
  }
  return photoArt(im, w, h, crop);
}
const itemIcon = (id: string): Promise<string> => import('../../../art/itemicons').then(m => { try { return m.ICON_IDS.items().includes(id) ? m.itemIconURL(id, 1) : ''; } catch { return ''; } }).catch(() => '');

/** a sketch plate across the column: the drawing taped in at its corners */
function plate(f: Flow, key: string, load: () => Promise<Art | null>, h: number, fallback: string, seed: number) {
  f.block(h, (c, x, y, w) => {
    const art = c.pic(key, load);
    if (!art) { c.a.blit(doodleArt(fallback, Math.min(h, 40), C.pencilLt, { pencil: true, seed }), x + Math.round(w / 2 - 20), y); return; }
    const ax = x + Math.round((w - art.w) / 2), ay = y + Math.round((h - art.h) / 2);
    c.a.blit(art, ax, ay);
    tapeAt(c.a, ax + 2, ay + 1, 16, 6, -35, seed);
    tapeAt(c.a, ax + art.w - 2, ay + 1, 16, 6, 32, seed + 1);
  });
}

/** a sticky note with handwriting, across the column */
function stickyNote(f: Flow, title: string, text: string, color = '#f8e886') {
  const w = TEXT_W - 8;
  const ls = wrap(text, w - 10);
  const h = 8 + (ls.length + 1) * LINE;
  f.block(h + 2, (c, x, y) => {
    stickyAt(c.a, x + 2, y, w, h, color);
    hand(c.a, title, x + 7, y + 11, C.ink, { bold: true });
    ls.forEach((l, i) => hand(c.a, l, x + 7, y + 11 + (i + 1) * LINE, C.ink));
  });
}

/** a scribbled-out line (a research section still to come) */
function scribbled(f: Flow, title: string, seed: number) {
  f.text(title.toLowerCase() + ' (more photos)', { color: C.pencilLt, pencil: true });
  f.block(8, (c, x, y, w) => {
    const p = wavyPx(x, y + 3, x + w - 10, seed, 1.6);
    plot(c.a, p, C.pencilLt, Infinity, { pencil: true });
    plot(c.a, wavyPx(x + 6, y + 5, x + w - 30, seed + 1, 1.2), C.pencilLt, Infinity, { pencil: true });
  });
}

// ---------------------------------------------------------------- an animal's page

function speciesPage(f: Flow, e0: EncEntry) {
  const id = e0.key.slice(3);
  const sp = SPECIES_BY_ID[id];
  if (!sp) return;
  const e = entry(id);
  const seed = hashStr(id);
  f.fresh('g:' + e0.key, { head: 'field guide · fauna' });
  f.anchor(e0.key);
  f.text(`${sp.group}${e ? ` · first noted day ${e.day}` : ''}`, { color: C.pencil, pencil: true });
  f.text(sp.name, { bold: true, scale: 2 });
  f.text(sp.sci, { color: C.pencil, pencil: true });
  plate(f, 'sk:' + id, () => sketchOfSpecies(id, TEXT_W - 8, 62, seed), 64, 'magnifier', seed);
  if (e?.fresh) f.op(c => stampAt(c.a, 'New entry', TEXT_R - 62, lineY(2) - 6, { color: '#a8321e', deg: 8, size: 'sm', seed: 5 }));
  if (!e) {
    const hint = !!game.save.hints[id];
    f.text(hint ? 'A sample handed in at camp points to this animal, but nobody has photographed one yet. Find it, and get a sharp, close shot.' : 'Sighted in the field, but not photographed yet. A good photo, developed at camp, starts its page.', { color: C.ink });
    f.stamp(hint ? 'Lead' : 'Sighted', { color: '#26408a', deg: -5 });
    return;
  }
  // the best photo, taped in, with the vitals beside it
  const cov = coverOf(id);
  if (cov) f.float(62, 54, (c, x, y) => {
    const ph = c.pic('ph:' + cov.id + ':' + id, () => photoOf(cov, id, 54, 40));
    photoAt(c.a, ph, x + 2, y + 2, 54, 40, { cap: cov.day ? `day ${cov.day}` : '', tape: true, seed });
  });
  const prog = speciesProgress(id);
  const status = sp.research?.status ?? STATUS[Math.max(1, Math.min(5, sp.rarity))];
  f.text(`size: ${sp.size}`, { color: C.ink });
  f.text(`status: ${status}`, { color: C.ink });
  f.text(`page ${Math.round(prog * 100)}% filled in`, { color: C.pencil, pencil: true });
  f.block(8, (c, x, y, w) => barAt(c.a, x, y + 1, Math.min(w - 6, 90), 6, prog, seed));
  f.clearFloat();
  if (sp.danger >= 2) f.stamp(sp.danger >= 3 ? 'Dangerous: stay hidden' : 'Keep your distance', { color: '#a8321e', deg: -3, size: 'sm', lines: 2 });
  f.text(sp.blurb, { color: C.ink, after: 1 });
  // behaviours ticked off as they get photographed
  const behs = Object.entries(sp.behaviors);
  if (behs.length) {
    f.heading('behaviours', `${e.beh.filter(x => x in sp.behaviors).length}/${behs.length}`);
    behs.forEach(([k, v], i) => f.check(e.beh.includes(k) ? v : `${v}?`, e.beh.includes(k) ? 'done' : 'next', { seed: seed + i }));
    f.gap(1);
  }
  // the research write-up, section by section as it comes in
  const secs = speciesSections(sp);
  const n = Math.min(secs.length, secOf(sp.id));
  secs.forEach((s, i) => {
    if (i >= n) { scribbled(f, s.title, seed + i * 7); return; }
    if (s.fun) { stickyNote(f, 'Fun fact!', s.text ?? ''); return; }
    f.heading(s.title);
    if (s.text) f.text(s.text, { color: C.ink });
    if (s.list) for (const x of s.list) f.text('- ' + x, { color: C.blue });
    f.gap(1);
  });
  if (sp.facts.length) {
    f.heading('findings', `${e.facts.length}/${sp.facts.length}`);
    sp.facts.forEach((fa, i) => f.check(e.facts.includes(fa.id) ? `${fa.cat}: ${fa.text}` : fa.q, e.facts.includes(fa.id) ? 'done' : 'next', { seed: seed + 40 + i }));
    f.gap(1);
  }
  const pics = photosOf(id).slice().reverse().slice(0, 3);
  if (pics.length > 1) {
    f.heading('photos', String(photosOf(id).length));
    f.block(42, (c: Ctx, x, y) => {
      pics.forEach((u, i) => {
        const ph = c.pic('ph:' + u.id + ':' + id + ':s', () => photoOf(u, id, 40, 30, 3));
        photoAt(c.a, ph, x + i * 52, y + 2 + (i % 2) * 2, 40, 30, { border: 2 });
      });
    });
  }
}

// ---------------------------------------------------------------- specimens and places

function itemEntry(f: Flow, e: EncEntry) {
  const id = e.key.slice(3);
  const d = ITEMS[id];
  if (!d) return;
  const seed = hashStr(id);
  if (f.room() < 9) f.page();
  f.anchor(e.key);
  f.float(40, 38, (c, x, y) => {
    const art = c.pic('ic:' + id, () => itemIcon(id).then(u => sketchOfIcon(u, 38, 36, seed)));
    if (art) c.a.blit(art, x + Math.round((40 - art.w) / 2), y + Math.round((38 - art.h) / 2));
    else c.a.blit(doodleArt(CAT_DOODLE[e.cat], 32, C.pencil, { pencil: true, seed }), x + 4, y + 2);
  });
  f.text(d.name, { bold: true });
  f.text(`${e.sub}${analysedTimes(id) > 1 ? ` · ${analysedTimes(id)} studied` : ''}`, { color: C.pencil, pencil: true });
  if (e.state) f.text(e.state, { color: C.blue });
  const rec = r10().lab[id];
  f.text(d.desc, { color: C.ink });
  f.clearFloat();
  if (rec) { f.text(rec.text, { color: C.blue }); }
  if (isTaonga(id)) f.stamp('Taonga', { color: '#a8321e', round: true, small: 'treasure', deg: -8, lines: 4 });
  void itemCat;
  f.block(6, (c, x, y, w) => plot(c.a, wavyPx(x + 20, y + 3, x + w - 20, seed, 0.6), C.pencilLt, Infinity, { pencil: true }));
}

function placeEntry(f: Flow, e: EncEntry) {
  const seed = hashStr(e.key);
  if (f.room() < 7) f.page();
  f.anchor(e.key);
  const l = locByKey(e.key), dc = discByKey(e.key);
  const name = l?.name ?? dc?.name ?? e.name;
  f.text(name, { bold: true });
  f.text(`${kindLabel(l?.kind ?? dc?.kind ?? 'location')}${l?.sub ? ' · ' + l.sub : ''}`, { color: C.pencil, pencil: true });
  const ups = l ? game.save.uploads.filter(u => u.site === l.id) : [];
  if (ups.length) {
    const u = ups[ups.length - 1];
    f.float(58, 46, (c, x, y) => photoAt(c.a, c.pic('ph:' + u.id + ':place', () => photoOf(u, null, 50, 36)), x + 2, y + 2, 50, 36, { tape: true, seed }));
  }
  const desc = l?.desc ?? dc?.note ?? '';
  if (desc) f.text(desc, { color: C.ink });
  f.clearFloat();
  void location;
  f.block(6, (c, x, y, w) => plot(c.a, wavyPx(x + 20, y + 3, x + w - 20, seed, 0.6), C.pencilLt, Infinity, { pencil: true }));
}

// ---------------------------------------------------------------- the whole tab

export interface GuideBuild { pages: Page[]; anchors: Record<string, string> }

export function guidePages(): GuideBuild {
  const f = new Flow('guide', 'g:index', { head: 'field guide' });
  const all = overall();
  const fauna = entries('fauna');
  const knownFauna = fauna.filter(e => e.known);
  // ---- contents
  f.page('g:index');
  f.title('Field guide', { sub: `${Math.round(all.pct)}% of the island written up` });
  f.gap(1);
  for (const c of CATS) {
    const st = catStat(c.id);
    const first = entries(c.id).find(e => e.known);
    const name = c.id === 'culture' ? 'Taonga & culture' : c.name;
    f.text(name, { bold: true, hit: first ? { act: 'goto', arg: 'cat:' + c.id } : undefined });
    const y = lineY(f.line - 1);
    const seed = hashStr(c.id);
    const cnt = `${st.known}/${st.total}`;
    const bx = Math.max(TEXT_X + handW(name, { bold: true }) + 6, TEXT_R - 76);
    f.op(cx => { barAt(cx.a, bx, y - 7, TEXT_R - 30 - bx, 6, st.pct / 100, seed, C.green); hand(cx.a, cnt, TEXT_R - handW(cnt), y, C.pencil, { pencil: true }); });
  }
  f.gap(1);
  if (knownFauna.length) {
    f.heading('animals', String(knownFauna.length));
    for (const e of knownFauna) {
      f.text(e.name, { color: C.ink, hit: { act: 'goto', arg: e.key } });
      const y = lineY(f.line - 1), w = handW(e.name);
      f.op(c => {
        const n = c.pageNo(e.key);
        const ns = n ? String(n) : '';
        const nx = TEXT_R - handW(ns);
        for (let x = TEXT_X + w + 3; x < nx - 3; x += 3) c.a.px(x, y - 1, C.pencilLt);
        if (ns) hand(c.a, ns, nx, y, C.pencil, { pencil: true });
      });
    }
  } else {
    f.text('No animals yet. A sharp, close photo of one, developed at camp, gives it a page here.', { color: C.pencil, pencil: true });
  }
  // ---- the animals
  for (const e of knownFauna) speciesPage(f, e);
  const unknown = fauna.filter(e => !e.known).length;
  if (unknown) {
    f.fresh('g:wanted', { head: 'field guide · still to find' });
    f.title('Still to find', { sub: `${unknown} more out there` });
    f.gap(1);
    const n = Math.min(unknown, 15);
    const rows = Math.ceil(n / 3);
    f.block(rows * 44, (c, x, y) => {
      for (let i = 0; i < n; i++) {
        const bx = x + (i % 3) * 52, by = y + Math.floor(i / 3) * 44;
        plot(c.a, wavyPx(bx, by, bx + 40, i + 3, 0.5), C.pencilLt, Infinity, { pencil: true });
        plot(c.a, wavyPx(bx, by + 36, bx + 40, i + 7, 0.5), C.pencilLt, Infinity, { pencil: true });
        for (let j = 0; j < 36; j++) { if (j % 4) { c.a.px(bx, by + j, C.pencilLt); c.a.px(bx + 40, by + j, C.pencilLt); } }
        hand(c.a, '?', bx + 15, by + 26, C.pencil, { scale: 2, bold: true, pencil: true });
      }
    });
  }
  // ---- everything else
  for (const cat of CATS) {
    if (cat.id === 'fauna') continue;
    const list = entries(cat.id).filter(e => e.known);
    f.fresh('g:cat:' + cat.id, { head: 'field guide · ' + cat.name.toLowerCase() });
    f.anchor('cat:' + cat.id);
    f.title(cat.name);
    if (!list.length) {
      f.text(cat.empty, { color: C.pencil, pencil: true });
      f.doodle(CAT_DOODLE[cat.id], 40, { x: TEXT_R - 44, dy: 20 });
      continue;
    }
    f.gap(1);
    for (const e of list) cat.id === 'places' ? placeEntry(f, e) : itemEntry(f, e);
  }
  if (knownFauna.length) f.anchors['cat:fauna'] = 'g:' + knownFauna[0].key;
  return { pages: f.pages, anchors: { ...f.anchors, guide: 'g:index' } };
}
