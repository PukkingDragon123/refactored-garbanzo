// V11: the Zealandia Encyclopedia as a real book. The agency's field edition: a teal cloth hardcover
// with a thumb index for the six categories (Fauna, Flora, Artifacts & Culture, Fossils, Samples,
// Places). Each documented species gets a plate: Mori's pencil-and-watercolour sketch of the animal
// taped in, its photo as a polaroid, the vitals, then his notes (behaviours ticked off in ink,
// research sections revealed upload by upload, the little food web drawn in coloured inks, the fun
// fact on a sticky note, findings, the photo strip). Specimens get a sketch and a typed lab tag,
// taonga their care-and-respect note on flax paper, places their field notes and photos. The Fauna
// chapter opens on the whole food web. The data is the V10 encyclopedia's (../v10/encyData.ts).
//
// openEncyclopedia({ key }) opens the book (at an entry); the laptop's Encyclopedia app and the G key
// both come here.

import { game } from '../../game/game';
import { SPECIES_BY_ID } from '../../game/species';
import { ITEMS } from '../../game/items';
import { count } from '../../game/inventory';
import { itemIconURL, ICON_IDS } from '../../art/itemicons';
import { location, LOCATIONS, discoveries } from '../../game/v10/regions';
import type { Discovery, LocationDef } from '../../game/v10/regions';
import { fx10 } from '../../game/v10/skills10';
import { isRisky, foodInfo } from '../../game/v10/forage10';
import {
  entry, coverOf, photosOf, setCover, markSeen, upload, secOf, r10, crateCount, returnedDay, isTaonga, itemCat, markEncSeen, filedDay, analysedTimes,
} from '../../game/v9/research9';
import type { UploadRecord } from '../../game/save';
import { cropBg, when, STATUS } from '../v4/moriResearch';
import { icon10URL } from '../v10/icons10';
import { CATS, entries, catStat, overall, speciesSections, speciesProgress, catOfKey, discByKey, locByKey, kindLabel, placeIcon, faunaPool } from '../v10/encyData';
import type { Cat, EncEntry } from '../v10/encyData';
import { tiesOf, ROLE_NAME, linksAmong } from '../v10/foodweb';
import type { Role } from '../v10/foodweb';
import { speciesSprite } from '../icons';
import { pxIcon } from '../pxicons';
import {
  openBook, sketchImg, doodle, svgInk, roughArrow, roughRect, roughLine, scribble, underline, stamp, polaroid, sticky, scrap, tape,
  checkbox, paperSfx, escHtml as esc, tilt, INK_BLUE, INK_GREEN, PENCIL, hashStr,
} from './paper';
import type { BookSection, BookBlock, BookHandle, BookTab } from './paper';

// ---------------------------------------------------------------- look

const CAT_LOOK: Record<Cat, { color: string; doodle: string }> = {
  fauna: { color: '#7fb069', doodle: 'bird' },
  flora: { color: '#c3d36a', doodle: 'leaf' },
  culture: { color: '#d88a5a', doodle: 'compass' },
  fossils: { color: '#b8ad98', doodle: 'shell' },
  samples: { color: '#8cb8d8', doodle: 'feather' },
  places: { color: '#e2b44c', doodle: 'mountain' },
};
const ROLE_COL: Record<Role, string> = { predator: '#b8321e', thief: '#c07a14', prey: '#c07a14', victim: '#c07a14', parasite: '#7a3aa8', host: '#7a3aa8', partner: '#2f7a3a', rival: '#5a6a80' };
const ROLE_SIDE: Record<Role, 'top' | 'bottom' | 'left' | 'right'> = { predator: 'top', thief: 'top', prey: 'bottom', victim: 'bottom', parasite: 'right', host: 'right', partner: 'left', rival: 'left' };

const CSS = `
.eb .ppb-ct { color: var(--pp-ink); }
.eb-p { font-size: 1.22em; line-height: 1.1; margin: 0 0 0.45em; }
.eb-p.cont { margin-top: 0; }
.eb-h { display: flex; align-items: baseline; gap: 0.5em; margin: 0.55em 0 0.2em; font-size: 0.86em; letter-spacing: 0.12em; text-transform: uppercase; color: #5a4a34; }
.eb-h b { font-weight: 400; } .eb-h small { margin-left: auto; letter-spacing: 0.06em; color: #8a7652; }
.eb-h .ul { flex: 1; height: 0.4em; align-self: center; }
.eb-plate { position: relative; text-align: center; margin: 0.2em 0 0.3em; }
.eb-plate .sk { position: relative; display: block; margin: 0 auto; }
.eb-plate .pp-tape { top: -0.35em; }
.eb-name { font-size: 2.05em; line-height: 0.95; color: #2a2440; margin-top: 0.25em; }
.eb-sci { font-size: 1.15em; color: var(--pp-pencil); margin-top: 0.05em; }
.eb-row { display: flex; gap: 0.8em; align-items: flex-start; margin: 0.4em 0 0.2em; }
.eb-row .pp-polaroid { flex: none; }
.eb-vit { flex: 1; min-width: 0; font-size: 1.12em; line-height: 1.05; }
.eb-vit div { margin: 0.1em 0 0.2em; }
.eb-vit i { font-style: normal; font-size: 0.7em; letter-spacing: 0.1em; color: #8a7652; display: block; }
.eb-bar { position: relative; height: 0.9em; margin: 0.2em 0; }
.eb-bar svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.eb-new { position: absolute; right: -0.4em; top: 0.4em; z-index: 4; font-size: 0.9em; }
.eb-list { list-style: none; margin: 0.1em 0 0.3em; padding: 0; font-size: 1.15em; line-height: 1.08; }
.eb-list li { display: flex; gap: 0.4em; align-items: flex-start; margin: 0.18em 0; }
.eb-list li.no { color: #7a7060; }
.eb-list small { font-size: 0.8em; color: var(--pp-pencil); }
.eb-list b { font-weight: 700; }
.eb-locked { position: relative; margin: 0.35em 0 0.1em; color: #8a8070; }
.eb-locked .h { font-size: 0.8em; letter-spacing: 0.12em; text-transform: uppercase; display: flex; align-items: center; gap: 0.4em; }
.eb-locked svg { display: block; width: 100%; height: 1.9em; opacity: 0.5; }
.eb-nudge { font-size: 1.05em; color: var(--pp-pencil); margin: 0.35em 0; transform: rotate(-0.6deg); }
.eb-fun { margin: 0.6em 0.2em 0.4em; }
.eb-fun .pp-sticky { width: 100%; }
.eb-notes { margin: 0.5em 0 0.3em; }
.eb-notes .pp-scrap { width: 100%; }
.eb-notes ul { margin: 0; padding-left: 1em; font-size: 1.08em; line-height: 1.1; }
.eb-strip { display: flex; flex-wrap: wrap; gap: 0.5em 0.35em; margin: 0.4em 0 0.5em; }
.eb-strip .pp-polaroid { cursor: pointer; }
.eb-strip .pp-polaroid.on { box-shadow: 0 0 0 0.16em #c8321e, 0 0.12em 0.3em rgba(40, 28, 10, 0.38); }
.eb-web { position: relative; width: 100%; aspect-ratio: 10 / 8; margin: 0.2em 0 0.4em; }
.eb-web svg.ln { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.eb-node { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; width: 6.5em; text-align: center; }
.eb-node i { width: 2.7em; height: 2.7em; border-radius: 50%; background: #e8dcc0 center / cover no-repeat; box-shadow: 0 0 0 0.12em #fbf8f0, 0 0.1em 0.25em rgba(40, 28, 10, 0.45); display: grid; place-items: center; font-style: normal; color: var(--pp-pencil); font-size: 1.3em; }
.eb-node.c i { width: 3.4em; height: 3.4em; box-shadow: 0 0 0 0.16em #fbf8f0, 0 0 0 0.3em var(--pp-ink), 0 0.15em 0.3em rgba(40, 28, 10, 0.45); }
.eb-node.sm i { width: 2em; height: 2em; font-size: 1em; }
.eb-node span { font-size: 0.95em; line-height: 0.95; margin-top: 0.2em; }
.eb-node em { font-style: normal; font-size: 0.8em; display: block; }
.eb-node[data-act] { cursor: pointer; }
.eb-legend { display: flex; flex-wrap: wrap; gap: 0.25em 0.9em; font-size: 1em; margin: 0.2em 0; }
.eb-legend span { display: inline-flex; align-items: center; gap: 0.3em; }
.eb-legend i { width: 1.4em; height: 0.25em; border-radius: 0.2em; }
.eb-chap { text-align: center; padding-top: 8%; }
.eb-chap .t { font-size: 3em; line-height: 1; color: #2a2440; }
.eb-chap .s { font-size: 1.35em; color: var(--pp-pencil); margin-top: 0.2em; }
.eb-idx { list-style: none; padding: 0; margin: 0.2em 0; font-size: 1.15em; line-height: 1.05; }
.eb-idx li { display: flex; align-items: baseline; gap: 0.3em; margin: 0.12em 0; }
.eb-idx li .d { flex: 1; border-bottom: 0.12em dotted rgba(90, 74, 52, 0.45); transform: translateY(-0.2em); }
.eb-idx li[data-act] { cursor: pointer; }
.eb-idx li[data-act]:hover b { color: #a8321e; }
.eb-idx li.unk { color: #9a9080; }
.eb-idx li b { font-weight: 700; }
.eb-unk { display: grid; grid-template-columns: repeat(auto-fill, minmax(4.6em, 1fr)); gap: 0.5em; margin: 0.4em 0; }
.eb-unk div { position: relative; aspect-ratio: 1; display: grid; place-items: center; color: #9a9080; font-size: 0.95em; text-align: center; line-height: 0.95; }
.eb-unk div svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.eb-unk div b { font-size: 1.8em; font-weight: 700; display: block; color: #8a8070; }
.eb-tag { display: inline-block; padding: 0.5em 0.7em; margin: 0.3em 0; font-size: 0.82em; line-height: 1.25; color: #2a2620; box-shadow: 0 0.1em 0.2em rgba(40, 28, 10, 0.3); max-width: 100%; }
.eb-tag b { display: block; font-weight: 400; letter-spacing: 0.06em; }
.eb-front { text-align: center; }
.eb-front .plate { margin: 9% 6% 0; padding: 1.2em 1em 1.4em; border: 0.14em solid rgba(42, 36, 64, 0.5); outline: 0.08em solid rgba(42, 36, 64, 0.35); outline-offset: 0.25em; }
.eb-front .plate .t { font-size: 1.9em; line-height: 1; color: #2a2440; }
.eb-front .plate .s { font-size: 1.25em; color: var(--pp-pencil); margin-top: 0.4em; }
.eb-front .pct { font-size: 4.2em; color: #2a2440; margin-top: 0.3em; line-height: 1; }
.eb-cont { list-style: none; padding: 0; margin: 0.4em 0; }
.eb-cont li { display: flex; align-items: center; gap: 0.5em; margin: 0.45em 0; cursor: pointer; font-size: 1.25em; }
.eb-cont li img { width: 1.5em; height: 1.5em; image-rendering: pixelated; }
.eb-cont li b { font-weight: 700; flex: none; }
.eb-cont li .bar { flex: 1; height: 0.8em; position: relative; }
.eb-cont li em { font-style: normal; font-size: 0.85em; color: var(--pp-pencil); min-width: 2.6em; text-align: right; }
.eb-cont li:hover b { color: #a8321e; }
.eb-ln { color: #26408a; cursor: pointer; text-decoration: underline; text-decoration-style: wavy; text-decoration-thickness: 0.06em; text-underline-offset: 0.18em; }
.eb-ln.off { color: inherit; text-decoration: none; cursor: default; }
.eb-zoom { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(10, 6, 2, 0.55); animation: ebZ 0.25s ease-out both; }
@keyframes ebZ { from { opacity: 0; } }
.eb-zoom .pp-polaroid { width: min(78vw, 34em); animation: ebZp 0.35s cubic-bezier(.2, 1.3, .4, 1) both; }
@keyframes ebZp { from { transform: translateY(30%) rotate(-8deg) scale(0.7); opacity: 0; } }
.eb-zoom .pp-polaroid .ph { aspect-ratio: 16 / 9; }
.eb-zoom .acts { position: absolute; bottom: 4%; left: 0; right: 0; display: flex; justify-content: center; gap: 1.2em; }
.eb-zoom .acts span { cursor: pointer; font-size: 1.4em; color: #fbf3dc; padding: 0.2em 0.6em; }
.eb-zoom .acts span:hover { color: #ffd890; }
.eb-teaser { margin: 0.3em 0; }
`;
let styled = false;

// ---------------------------------------------------------------- small helpers

const hasItemIcon = (id: string) => ICON_IDS.items().includes(id);
const spriteOf = (id: string) => { try { const u = speciesSprite(id); return u.length > 500 ? u : ''; } catch { return ''; } };
const coverBg = (id: string, aspect = 4 / 3, pad = 2.2) => {
  const c = coverOf(id);
  if (!c) return '';
  const sub = c.subjects.find(s => s.species === id);
  return cropBg(c.img, sub?.bbox ?? [0.3, 0.3, 0.7, 0.7], aspect, pad);
};
/** a hand-drawn progress bar (0..1) */
function bar(k: number, seed: number, col = INK_BLUE): string {
  const w = 100, h = 12, fill = Math.max(0, Math.min(1, k)) * (w - 4);
  return svgInk(w, h, [
    { d: roughRect(1, 1, w - 2, h - 2, { seed, double: false, rough: 0.6 }), c: PENCIL, w: 1.1 },
    ...(fill > 1 ? [{ d: scribble(fill, h - 5, seed + 3, Math.max(3, Math.round(fill / 3))), c: col, w: 1.6, opacity: 0.85 }] : []),
  ], { stretch: true });
}
const heading = (t: string, right = '', seed = 1) => `<div class="eb-h pp-pix"><b>${esc(t)}</b><span class="ul">${svgInk(100, 6, [{ d: underline(100, { seed }), c: PENCIL, w: 1, opacity: 0.6 }], { stretch: true, w: '100%', h: '100%' })}</span>${right ? `<small>${right}</small>` : ''}</div>`;
const H = (t: string, right = '', seed = 1): BookBlock => ({ html: heading(t, right, seed), keep: true });
const P = (t: string, cls = ''): BookBlock => ({ html: esc(t), cls: `pp-hand eb-p ${cls}`, split: true });

/** a link to another entry (an ink link if it is in the book, plain text if not) */
function link(k: string, label: string): string {
  const known = entries(catOfKey(k)).some(e => e.key === k && e.known && e.progress > 0.1);
  return known ? `<span class="eb-ln" data-act="goto" data-k="${esc(k)}">${esc(label)}</span>` : `<span class="eb-ln off">${esc(label)}</span>`;
}

// ---------------------------------------------------------------- species

function speciesBlocks(id: string, e0: EncEntry): BookBlock[] {
  const sp = SPECIES_BY_ID[id];
  if (!sp) return [];
  const e = entry(id);
  const seed = hashStr(id);
  const spr = spriteOf(id);
  const cov = coverOf(id);
  const sub = cov?.subjects.find(s => s.species === id);
  // the plate: Mori's sketch of the animal (from the sprite, or traced off his photo)
  const box: [string, string] = ['92%', '8.4em'];
  const sk = spr ? sketchImg(spr, { size: 340, seed, box }, 'sk')
    : cov ? sketchImg(cov.img, { photo: true, crop: padCrop(sub?.bbox ?? [0.3, 0.3, 0.7, 0.7], 0.35), size: 320, seed, box }, 'sk') : '';
  const fresh = !!e?.fresh;
  const out: BookBlock[] = [];
  out.push({ html: `<div class="eb-plate">${sk ? `<div class="sk" style="transform:rotate(${tilt(seed, 2.5)})">${sk}${tape({ seed, style: 'left:42%' })}</div>` : doodle('magnifier', { size: '6em', pencil: true })}${fresh ? `<span class="eb-new" data-new="1">${stamp('New entry', { color: 'red', fresh: false, rot: '8deg' })}</span>` : ''}<div class="eb-name pp-head">${esc(sp.name)}</div><div class="eb-sci pp-hand">${esc(sp.sci)}</div></div>` });
  if (!e) {
    const hint = !!game.save.hints[id];
    out.push(P(hint ? 'A sample handed in at camp points to this animal, but nobody has photographed one yet. Find it, and get a sharp, close shot.' : 'Sighted in the field, but not photographed yet. A good photo, uploaded at camp, starts its page.'));
    out.push({ html: `<div style="text-align:center;margin-top:0.6em">${stamp(hint ? 'Lead' : 'Sighted', { color: 'blue', rot: '-5deg' })}</div>` });
    return out;
  }
  const status = sp.research?.status ?? STATUS[Math.max(1, Math.min(5, sp.rarity))];
  const prog = speciesProgress(id);
  const pics = photosOf(id);
  const pol = cov ? polaroid('', `${cov.day ? 'day ' + cov.day : ''}`, { w: '7.6em', bg: coverBg(id), rot: tilt(seed + 1, 3), pin: 'red', attrs: `data-act="photo" data-id="${cov.id}"` }) : '';
  out.push({ html: `<div class="eb-row">${pol}<div class="eb-vit pp-hand"><div><i class="pp-pix">group</i>${esc(sp.group)}</div><div><i class="pp-pix">size</i>${esc(sp.size)}</div><div><i class="pp-pix">status</i>${esc(status)}</div><div><i class="pp-pix">page ${Math.round(prog * 100)}% complete</i><div class="eb-bar">${bar(prog, seed)}</div></div></div></div>` });
  if (sp.danger >= 2) out.push({ html: `<div style="text-align:center;margin:0.1em 0 0.3em">${stamp(sp.danger >= 3 ? 'Dangerous: stay hidden' : 'Keep your distance', { color: 'red', rot: '-3deg' })}</div>` });
  out.push(P(sp.blurb));
  // behaviours, ticked off in ink
  const behs = Object.entries(sp.behaviors);
  if (behs.length) {
    out.push(H('Behaviours', `${e.beh.filter(x => x in sp.behaviors).length}/${behs.length}`, seed + 2));
    out.push({ html: `<ul class="eb-list pp-hand">${behs.map(([k, v], i) => e.beh.includes(k)
      ? `<li>${checkbox('done', seed + i)}<span>${esc(v)}${e.vid.includes(k) ? ' <small>(on video)</small>' : ''}</span></li>`
      : `<li class="no">${checkbox('todo', seed + i)}<span>${esc(v)} <small>not photographed yet</small></span></li>`).join('')}</ul>` });
  }
  // the research sheet: revealed sections, then the locked ones as scribbled-out lines
  const secs = speciesSections(sp);
  const n = Math.min(secs.length, secOf(sp.id));
  secs.forEach((s, i) => {
    if (i >= n) {
      out.push({ html: `<div class="eb-locked"><div class="h pp-pix">${pxIcon('lock')} ${esc(s.title)}</div>${svgInk(100, 14, [{ d: scribble(96, 10, seed + i * 7, 14), c: PENCIL, w: 0.9 }], { stretch: true })}</div>` });
      return;
    }
    if (s.fun) { out.push({ html: `<div class="eb-fun">${sticky(`<b>Fun fact!</b> ${esc(s.text ?? '')}`, { color: 'yellow', rot: tilt(seed + 9, 2), w: '100%' })}</div>` }); return; }
    if (s.key === 'notes' && s.list) { out.push({ html: `<div class="eb-notes">${scrap(`<div class="pp-pix" style="font-size:0.75em;letter-spacing:0.12em;color:#6a5a40">MORI'S FIELD NOTES</div><ul class="pp-hand">${s.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, { kind: 'graph', w: '100%', seed: seed + 4, rot: tilt(seed + 4, 1.5) })}</div>` }); return; }
    out.push(H(s.title, '', seed + 10 + i));
    if (s.text) out.push(P(s.text));
    if (s.list) out.push({ html: `<ul class="eb-list pp-hand">${s.list.map(x => `<li>- ${esc(x)}</li>`).join('')}</ul>` });
    if (s.web) out.push({ html: fx10.ecoLinks() ? miniWeb(sp.id) : webTeaser(tiesOf(sp.id).length) });
  });
  if (n < secs.length) {
    const depth = Math.max(1, Math.round(fx10.infoDepth()));
    out.push({ html: `<div class="eb-nudge pp-hand">${secs.length - n} more ${secs.length - n === 1 ? 'section' : 'sections'} to fill in. Every new photo of the ${esc(sp.name)} adds ${depth}; every new behaviour, one more.</div>` });
  }
  // findings
  if (sp.facts.length) {
    out.push(H('Findings', `${e.facts.length}/${sp.facts.length}`, seed + 30));
    out.push({ html: `<ul class="eb-list pp-hand">${sp.facts.map((f, i) => e.facts.includes(f.id)
      ? `<li>${checkbox('done', seed + 40 + i)}<span><b>${esc(f.cat)}:</b> ${esc(f.text)}</span></li>`
      : `<li class="no">${checkbox('todo', seed + 40 + i)}<span>${esc(f.q)} <small>${esc(f.hint)}</small></span></li>`).join('')}</ul>` });
  }
  // the photo strip
  if (pics.length) {
    out.push(H('Photos', String(pics.length), seed + 50));
    out.push({ html: `<div class="eb-strip">${pics.slice().reverse().slice(0, 8).map((u, i) => { const s2 = u.subjects.find(x => x.species === id); return polaroid('', '', { w: '4.6em', bg: cropBg(u.img, s2?.bbox ?? [0.3, 0.3, 0.7, 0.7], 4 / 3, 3), rot: tilt(u.id + i, 4), cls: u.id === e.cover ? 'on' : '', attrs: `data-act="photo" data-id="${u.id}" title="${esc(when(u))}"` }); }).join('')}</div>` });
  }
  void e0;
  return out;
}
const padCrop = (b: [number, number, number, number], k: number): [number, number, number, number] => {
  const w = b[2] - b[0], h = b[3] - b[1];
  return [Math.max(0, b[0] - w * k), Math.max(0, b[1] - h * k), Math.min(1, b[2] + w * k), Math.min(1, b[3] + h * k)];
};

/** the "food web mapping" skill isn't learned yet */
function webTeaser(n: number): string {
  return `<div class="eb-teaser">${sticky(`${pxIcon('lock')} <b>${n} connection${n === 1 ? '' : 's'} to map.</b> Learn Food-Web Mapping and every upload draws who eats whom, who lives on whom and who tags along.`, { color: 'blue', w: '100%', rot: '-1deg' })}</div>`;
}

/** a node of a food web: the animal's photo in a little circle, or a pencilled question mark */
function node(id: string, x: number, y: number, cls = '', label = '', role?: Role): string {
  const known = !!entry(id);
  const sp = SPECIES_BY_ID[id];
  const bg = known ? coverBg(id, 1, 2.6) : '';
  return `<div class="eb-node ${cls}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"${known && cls !== 'c' ? ` data-act="goto" data-k="sp:${esc(id)}"` : ''}><i style="${bg}">${known ? '' : '?'}</i><span class="pp-hand">${known ? esc(sp?.name ?? id) : '???'}${role ? `<em style="color:${ROLE_COL[role]}">${esc(label || ROLE_NAME[role])}</em>` : ''}</span></div>`;
}

/** a species and its ties in a ring: predators above, prey below, parasites right, partners left */
function miniWeb(id: string): string {
  const ties = tiesOf(id);
  const by: Record<'top' | 'bottom' | 'left' | 'right', typeof ties> = { top: [], bottom: [], left: [], right: [] };
  for (const t of ties) by[ROLE_SIDE[t.role]].push(t);
  const span: Record<string, [number, number]> = { top: [-150, -30], bottom: [30, 150], right: [-25, 25], left: [155, 205] };
  const nodes: { t: (typeof ties)[number]; x: number; y: number }[] = [];
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    const l = by[side];
    let [a0, a1] = span[side];
    if (l.length > 3 && (side === 'left' || side === 'right')) { a0 -= 18; a1 += 18; }
    l.forEach((t, i) => {
      const a = ((l.length === 1 ? (a0 + a1) / 2 : a0 + ((a1 - a0) * i) / (l.length - 1)) * Math.PI) / 180;
      nodes.push({ t, x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 37 });
    });
  }
  // arrows point at what gets eaten (or robbed, or lived on); partners and rivals get plain lines
  const strokes = nodes.flatMap((n, i) => {
    const c = ROLE_COL[n.t.role];
    const dash = entry(n.t.other) ? 1 : 0.55;
    const ox = n.x, oy = n.y * 0.8, cx = 50, cy = 40;
    const toCenter = n.t.role === 'predator' || n.t.role === 'thief' || n.t.role === 'parasite';
    const fromCenter = n.t.role === 'prey' || n.t.role === 'victim' || n.t.role === 'host';
    const [x1, y1, x2, y2] = toCenter ? [ox, oy, cx, cy] : [cx, cy, ox, oy];
    // stop short of the circles
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const a = [x1 + (dx / L) * 7, y1 + (dy / L) * 7, x2 - (dx / L) * 8, y2 - (dy / L) * 8];
    if (toCenter || fromCenter) {
      const [s, h] = roughArrow(a[0], a[1], a[2], a[3], 0.08, { seed: i + 3 });
      return [{ d: s, c, w: 1.4, opacity: dash }, { d: h, c, w: 1.4, opacity: dash }];
    }
    return [{ d: roughLine(a[0], a[1], a[2], a[3], { seed: i + 3 }), c, w: 1.3, opacity: dash }];
  });
  const known = ties.filter(t => entry(t.other)).length;
  return `<div class="eb-web">${svgInk(100, 80, strokes, { cls: 'ln', stretch: true })}${node(id, 50, 50, 'c')}${nodes.map(n => node(n.t.other, n.x, n.y, 'sm', n.t.label && entry(n.t.other) ? ROLE_NAME[n.t.role] : '', n.t.role)).join('')}</div><div class="pp-hand" style="font-size:1em;color:var(--pp-pencil);text-align:right">${known} of ${ties.length} connection${ties.length === 1 ? '' : 's'} documented</div>`;
}

/** every documented species and the links between them (spring layout), on a page of its own */
function bigWebPage(): string {
  const ids = faunaPool().map(s => s.id).filter(id => !!entry(id));
  const intro = `<div class="eb-chap" style="padding-top:0"><div class="t pp-head" style="font-size:2.2em">Food web</div><div class="s pp-hand">Who eats whom, who lives on whom, who tags along.</div></div>`;
  if (!fx10.ecoLinks()) return intro + webTeaser(linksAmong(new Set(ids)).length);
  if (ids.length < 2) return intro + `<p class="pp-hand eb-p" style="margin-top:1em">Not enough species yet. Document a few animals that eat, host or follow each other and the web starts to draw itself.</p>`;
  const set = new Set(ids);
  const links = linksAmong(set);
  const Pp = ids.map((id, i) => { const a = (i / ids.length) * Math.PI * 2; return { id, x: 0.5 + Math.cos(a) * 0.35, y: 0.5 + Math.sin(a) * 0.35, vx: 0, vy: 0 }; });
  const idx = new Map(ids.map((id, i) => [id, i]));
  const k = Math.sqrt(1 / ids.length) * 0.7;
  for (let it = 0; it < 260; it++) {
    const t = 0.06 * (1 - it / 260) + 0.004;
    for (const p of Pp) { p.vx = 0; p.vy = 0; }
    for (let i = 0; i < Pp.length; i++) for (let j = i + 1; j < Pp.length; j++) {
      const a = Pp[i], c = Pp[j];
      let dx = a.x - c.x, dy = a.y - c.y;
      const d = Math.max(0.01, Math.hypot(dx, dy)), f = (k * k) / d;
      dx /= d; dy /= d;
      a.vx += dx * f; a.vy += dy * f; c.vx -= dx * f; c.vy -= dy * f;
    }
    for (const [a0, , b0] of links) {
      const a = Pp[idx.get(a0)!], c = Pp[idx.get(b0)!];
      const dx = a.x - c.x, dy = a.y - c.y, d = Math.max(0.01, Math.hypot(dx, dy)), f = (d * d) / k;
      a.vx -= (dx / d) * f; a.vy -= (dy / d) * f; c.vx += (dx / d) * f; c.vy += (dy / d) * f;
    }
    for (const p of Pp) {
      p.vx += (0.5 - p.x) * 0.6; p.vy += (0.5 - p.y) * 0.6;
      const v = Math.hypot(p.vx, p.vy) || 1;
      p.x = Math.max(0.08, Math.min(0.92, p.x + (p.vx / v) * Math.min(v, t)));
      p.y = Math.max(0.08, Math.min(0.92, p.y + (p.vy / v) * Math.min(v, t)));
    }
  }
  const pos = new Map(Pp.map(p => [p.id, p]));
  const relCol = (r: string) => (r === 'eats' ? ROLE_COL.predator : r === 'parasite' ? ROLE_COL.parasite : r === 'partner' ? ROLE_COL.partner : r === 'robs' ? ROLE_COL.thief : ROLE_COL.rival);
  const strokes = links.flatMap(([a, r, c], i) => {
    const p = pos.get(a)!, q = pos.get(c)!;
    const x1 = p.x * 100, y1 = p.y * 125, x2 = q.x * 100, y2 = q.y * 125;
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const s = [x1 + (dx / L) * 5, y1 + (dy / L) * 5, x2 - (dx / L) * 6, y2 - (dy / L) * 6];
    if (r === 'eats' || r === 'parasite' || r === 'robs') { const [sh, hd] = roughArrow(s[0], s[1], s[2], s[3], 0.1, { seed: i }); return [{ d: sh, c: relCol(r), w: 1.1 }, { d: hd, c: relCol(r), w: 1.1 }]; }
    return [{ d: roughLine(s[0], s[1], s[2], s[3], { seed: i }), c: relCol(r), w: 1 }];
  });
  const legend = `<div class="eb-legend pp-hand">${(['predator', 'parasite', 'partner', 'rival'] as Role[]).map(r => `<span><i style="background:${ROLE_COL[r]}"></i>${r === 'predator' ? 'eats' : r === 'parasite' ? 'lives on' : r === 'partner' ? 'partners' : 'rivals'}</span>`).join('')}</div>`;
  return intro + legend + `<div class="eb-web" style="aspect-ratio:100/125">${svgInk(100, 125, strokes, { cls: 'ln', stretch: true })}${Pp.map(p => node(p.id, p.x * 100, p.y * 100, 'sm')).join('')}</div>`;
}

// ---------------------------------------------------------------- specimens

function itemBlocks(id: string, e: EncEntry): BookBlock[] {
  const d = ITEMS[id];
  if (!d) return [];
  const seed = hashStr(id);
  const rec = r10().lab[id];
  const c = itemCat(id);
  const taonga = isTaonga(id);
  const inCrate = crateCount(id), inPack = count(id), back = returnedDay(id);
  const times = analysedTimes(id);
  const disc = discoveries().find(x => x.id === id) ?? null;
  const where = disc ? location(disc.loc)?.name ?? null : null;
  const icon = hasItemIcon(id) ? itemIconURL(id, 3) : '';
  const sk = icon ? sketchImg(icon, { size: 300, seed, box: ['60%', '6.5em'] }, 'sk') : doodle(c === 'flora' ? 'leaf' : c === 'artifact' ? 'compass' : c === 'fossil' ? 'shell' : 'feather', { size: '6em', pencil: true });
  const out: BookBlock[] = [];
  const fresh = e.fresh;
  out.push({ html: `<div class="eb-plate"><div class="sk" style="transform:rotate(${tilt(seed, 3)})">${sk}${icon ? tape({ seed, style: 'left:36%' }) : ''}</div>${fresh ? `<span class="eb-new" data-new="1">${stamp('New entry', { color: 'red', rot: '8deg' })}</span>` : ''}<div class="eb-name pp-head">${esc(d.name)}</div><div class="eb-sci pp-hand">${esc(e.sub)}${times > 1 ? ` · ${times} studied` : ''}</div></div>` });
  // the lab's tag, typed on a slip and tied on
  if (rec) out.push({ html: `<div style="text-align:center">${scrap(`<div class="eb-tag pp-type" style="box-shadow:none;margin:0;padding:0"><b>${esc(rec.lines[0] ?? 'CATALOGUED')}</b>${rec.lines.slice(1).map(l => esc(l)).join('<br>')}<br>FIRST ANALYSED DAY ${rec.day}${rec.generic ? '<br>(BEST GUESS)' : ''}</div>`, { kind: 'telex', w: '86%', seed, rot: tilt(seed + 2, 2), edges: { top: 'perforated', bottom: 'perforated' } })}</div>` });
  const status = back ? `Gone home to its people (day ${back}).` : inCrate ? `In the research crate at camp${inCrate > 1 ? ` (${inCrate})` : ''}.` : inPack ? `In my backpack${inPack > 1 ? ` (${inPack})` : ''}.` : '';
  if (taonga || status) out.push({ html: `<div style="display:flex;gap:0.6em;align-items:center;justify-content:center;margin:0.3em 0">${taonga ? stamp('Taonga', { color: 'red', shape: 'round', small: 'treasure', rot: '-8deg' }) : ''}${status ? `<span class="pp-hand" style="font-size:1.15em">${esc(status)}</span>` : ''}</div>` });
  out.push(P(d.desc));
  if (rec) {
    out.push(H(taonga ? 'Documentation' : 'Analysis results', '', seed + 3));
    out.push(P(rec.text));
    const lab = d.lab;
    if (lab?.species) {
      const sp = SPECIES_BY_ID[lab.species];
      if (sp) out.push({ html: `<p class="pp-hand eb-p">Points to: ${entry(sp.id) ? link('sp:' + sp.id, sp.name) : `an animal nobody has documented yet${game.save.hints[sp.id] ? ` (the lab's guess: the ${esc(sp.name)})` : ''}. Photograph it to start its page.`}</p>` });
    }
    if (lab?.fact && !Object.values(SPECIES_BY_ID).some(s => s.facts.some(f => f.id === lab.fact))) out.push({ html: `<div class="eb-fun">${sticky(`<b>Fun fact!</b> ${esc(lab.fact)}`, { w: '100%' })}</div>` });
  } else if (inPack) {
    out.push({ html: `<div class="eb-nudge pp-hand">Hand it in at the camp laptop (Upload Everything) and the lab will analyse it.</div>` });
  } else if (disc) {
    out.push(H('Field note', '', seed + 4));
    out.push(P(disc.note ?? 'Noted in the field.'));
  }
  if (isRisky(id)) {
    const fi = foodInfo(id);
    const txt = !fi.known ? 'Not identified yet: eating it is a gamble. Hand one in at camp and the lab will tell you.'
      : fi.tox === 0 ? `Safe to eat${fi.energy ? `: about ${fi.energy} energy` : ''}.` : fi.tox === 1 ? 'Mildly poisonous: a stomach ache at best. Better left alone.' : 'Poisonous. Do not eat it, whatever Chunk thinks.';
    out.push({ html: `<div style="display:flex;gap:0.6em;align-items:center;margin:0.4em 0">${stamp(!fi.known ? 'Edible?' : fi.tox ? 'Not safe to eat' : 'Safe to eat', { color: !fi.known ? 'black' : fi.tox ? 'red' : 'green', rot: '-4deg' })}<span class="pp-hand" style="font-size:1.1em;flex:1">${esc(txt)}</span></div>` });
  }
  if (c === 'artifact') out.push(cultureNote(d.name, taonga, !!back, seed));
  if (d.where || where) { out.push(H('Where it was found', '', seed + 6)); out.push(P(`${where ?? d.where ?? ''}${where && d.where ? ` · ${d.where}` : ''}`)); }
  return out;
}

/** the cultural note on an artifact page, on flax paper (taonga: respect, care and the way home) */
function cultureNote(name: string, taonga: boolean, back: boolean, seed: number, inPlace = false): BookBlock {
  const body = taonga
    ? `<b>Care &amp; respect.</b> This is a taonga: a treasure that belongs to the people whose ancestors made it, not a specimen. ${back ? 'It has gone home to its village.' : inPlace ? `The ${esc(name)} stays exactly where it was found.` : `The ${esc(name)} is kept wrapped and safe at camp, to be returned to the village.`} It was documented by photographs and measurements only: not cleaned, not sampled, not altered. Its name, its maker and its story are for its people to tell. Aroha says the right thing to do is ask, and to listen.`
    : `<b>Heritage.</b> Made and used by people, so it carries their history as well as its own. Recorded where it was found, handled as little as possible, and kept with the rest of the expedition's finds until the right people can be asked about it.`;
  return { html: `<div style="margin:0.5em 0">${scrap(`<div class="pp-hand" style="font-size:1.08em;line-height:1.1">${body}</div>`, { kind: 'flax', w: '100%', seed: seed + 8, rot: tilt(seed + 8, 1.2) })}</div>` };
}

// ---------------------------------------------------------------- places and field notes

function placeIconURL(kind: string): string { try { return icon10URL(placeIcon(kind)); } catch { return ''; } }

function locBlocks(l: LocationDef, e: EncEntry): BookBlock[] {
  const seed = hashStr(l.id);
  const notes = discoveries().filter(d => d.loc === l.id && filedDay(d.id));
  const ups = game.save.uploads.filter(u => u.site === l.id);
  const ic = placeIconURL(l.kind);
  const hills = Math.max(1, Math.min(5, l.difficulty));
  const out: BookBlock[] = [];
  out.push({ html: `<div class="eb-plate"><div class="sk">${ic ? sketchImg(ic, { size: 240, seed, box: ['40%', '5.5em'] }) : doodle('pin', { size: '5em', pencil: true })}</div>${e.fresh ? `<span class="eb-new" data-new="1">${stamp('New place', { color: 'red', rot: '8deg' })}</span>` : ''}<div class="eb-name pp-head">${esc(l.name)}</div><div class="eb-sci pp-hand">${esc(kindLabel(l.kind))} · ${esc(regionName(l.region))}</div></div>` });
  out.push({ html: `<div class="pp-hand" style="display:flex;align-items:center;justify-content:center;gap:0.4em;font-size:1.1em;margin:0.2em 0">route: ${Array.from({ length: hills }, (_, i) => doodle('mountain', { size: '1.6em', seed: seed + i })).join('')}</div>` });
  if (l.desc) out.push(P(l.desc));
  if (ups.length) {
    out.push(H('Photos taken here', String(ups.length), seed + 2));
    out.push({ html: `<div class="eb-strip">${ups.slice(-8).reverse().map((u, i) => polaroid('', '', { w: '5.2em', bg: `background-image:url(${u.img});background-size:cover;background-position:center`, rot: tilt(u.id + i, 4), attrs: `data-act="photo" data-id="${u.id}" title="${esc(when(u))}"` })).join('')}</div>` });
  }
  out.push(H('Field notes here', notes.length ? String(notes.length) : '', seed + 3));
  out.push(notes.length
    ? { html: `<ul class="eb-list pp-hand">${notes.map((d, i) => `<li>${checkbox('done', seed + i)}<span>${link('dc:' + d.id, d.name)} <small>(${esc(kindLabel(d.kind))})</small></span></li>`).join('')}</ul>` }
    : { html: `<div class="eb-nudge pp-hand">Nothing filed from here yet: explore it, and upload what you find.</div>` });
  return out;
}

function discBlocks(d: Discovery, e: EncEntry): BookBlock[] {
  const loc = location(d.loc);
  const c = catOfKey('dc:' + d.id);
  const seed = hashStr(d.id);
  const ic = c === 'places' ? placeIconURL(d.kind) : icon10URL(c === 'fossils' ? 'c_fossils' : c === 'culture' ? 'c_culture' : c === 'flora' ? 'c_flora' : 'c_samples');
  const out: BookBlock[] = [];
  out.push({ html: `<div class="eb-plate"><div class="sk">${ic ? sketchImg(ic, { size: 240, seed, box: ['40%', '5.5em'] }) : ''}</div>${e.fresh ? `<span class="eb-new" data-new="1">${stamp('New entry', { color: 'red', rot: '8deg' })}</span>` : ''}<div class="eb-name pp-head">${esc(d.name)}</div><div class="eb-sci pp-hand">${esc(kindLabel(d.kind))}${loc ? ` · ${esc(loc.name)}` : ''} · found day ${d.day}</div></div>` });
  if (d.note) out.push({ html: `<div class="eb-notes">${scrap(`<div class="pp-pix" style="font-size:0.75em;letter-spacing:0.12em;color:#6a5a40">MORI'S FIELD NOTE</div><div class="pp-hand" style="font-size:1.15em;line-height:1.1">${esc(d.note)}</div>`, { kind: 'graph', w: '100%', seed, rot: tilt(seed, 1.5) })}</div>` });
  if (d.kind === 'artifact') {
    const taonga = /\b(taonga|village|marae|pounamu)\b/i.test(`${d.name} ${d.note ?? ''}`) || LOCATIONS.find(l => l.id === d.loc)?.kind === 'village';
    out.push(cultureNote(d.name, taonga, false, seed, true));
  }
  if (d.kind === 'fossil') out.push(P('Photographed and measured where it lies: some things are worth more left in the rock they were found in.'));
  if (loc) out.push({ html: `<p class="pp-hand eb-p">Location: ${link('loc:' + loc.id, loc.name)}</p>` });
  void filedDay;
  return out;
}
const regionName = (r: string) => ({ home: 'Home island', interior: 'The interior', south: 'The south', east: 'The east coast', ocean: 'Open ocean', isle2: 'The second island' } as Record<string, string>)[r] ?? r;

// ---------------------------------------------------------------- chapters, front matter, the unknown

function chapterBlocks(cat: Cat): BookBlock[] {
  const c = CATS.find(x => x.id === cat)!;
  const st = catStat(cat);
  const list = entries(cat);
  const look = CAT_LOOK[cat];
  const out: BookBlock[] = [{ html: `<div class="eb-chap"><div>${doodle(look.doodle, { size: '5.5em', pencil: true })}</div><div class="t pp-head">${esc(c.name)}</div><div class="s pp-hand">${st.known} of ${st.total} documented · ${Math.floor(st.pct)}%</div><div class="eb-bar" style="width:60%;margin:0.4em auto 0.8em">${bar(st.pct / 100, cat.length * 7, look.color === '#c3d36a' ? INK_GREEN : INK_BLUE)}</div></div>` }];
  const known = list.filter(e => e.known);
  if (!known.length) { out.push(P(c.empty)); return out; }
  out.push({ html: `<ul class="eb-idx pp-hand">${list.map(e => e.known
    ? `<li data-act="goto" data-k="${esc(e.key)}"><b>${esc(e.name)}</b>${e.fresh ? ` ${stamp('new', { color: 'red', rot: '-6deg', style: 'font-size:0.55em' })}` : ''}<span class="d"></span><small>${e.progress >= 0.999 ? 'complete' : `${Math.round(e.progress * 100)}%`}</small></li>`
    : `<li class="unk"><span>???</span><span class="d"></span><small>${esc(e.sub)}</small></li>`).join('')}</ul>` });
  return out;
}

function unknownBlocks(cat: Cat): BookBlock[] {
  const list = entries(cat).filter(e => !e.known);
  if (!list.length) return [];
  const c = CATS.find(x => x.id === cat)!;
  return [
    { html: `<div class="eb-chap" style="padding-top:2%"><div class="t pp-head" style="font-size:2em">Still to find</div><div class="s pp-hand">${list.length} ${c.name.toLowerCase()} entr${list.length === 1 ? 'y' : 'ies'} nobody has filled in</div></div>` },
    { html: `<div class="eb-unk pp-hand">${list.map((e, i) => `<div>${svgInk(40, 40, [{ d: roughRect(2, 2, 36, 36, { seed: i + 3, double: false }), c: PENCIL, w: 1, opacity: 0.6 }], { stretch: true })}<span><b>?</b>${esc(e.sub)}</span></div>`).join('')}</div>` },
  ];
}

function frontPages(): string[] {
  const ov = overall();
  const left = `<div class="eb-front"><div class="plate"><div class="pp-pix" style="font-size:0.8em;letter-spacing:0.3em;color:#6a5a40">EX LIBRIS</div><div class="t pp-head">Zealandia Encyclopedia</div><div class="s pp-hand">field edition, issued to</div><div class="pp-hand" style="font-size:2em;margin-top:0.2em">Dr. Mori</div><div style="margin-top:0.8em">${stamp('Halcyon', { color: 'blue', shape: 'round', small: 'field office', rot: '-12deg' })}</div></div><div class="pct pp-head">${Math.floor(ov.pct)}%</div><div class="pp-hand" style="font-size:1.2em;color:var(--pp-pencil)">of the encyclopedia filled in</div></div>`;
  const right = `<div class="eb-h pp-pix" style="font-size:1em"><b>Contents</b></div><ul class="eb-cont pp-hand">${CATS.map((c, i) => {
    const st = ov.stats.find(s => s.cat === c.id)!;
    return `<li data-act="goto" data-k="cat:${c.id}"><img src="${icon10URL(c.icon)}" alt=""><b>${esc(c.name)}</b><span class="bar">${bar(st.pct / 100, i + 11)}</span><em>${Math.floor(st.pct)}%</em>${st.fresh ? stamp(`${st.fresh} new`, { color: 'red', rot: '-5deg', style: 'font-size:0.55em' }) : ''}</li>`;
  }).join('')}</ul><div class="pp-hand" style="font-size:1.05em;color:var(--pp-pencil);margin-top:1em;transform:rotate(-1deg)">Every photo, sample and field note uploaded at camp is filed in here. Tabs on the edge jump to a chapter; drag a corner to turn.</div>${doodle('compass', { size: '4em', pencil: true, style: 'position:absolute;right:6%;bottom:4%;opacity:0.5' })}`;
  return [left, right];
}

// ---------------------------------------------------------------- the book

let current: BookHandle | null = null;

export interface EncyOpts {
  /** an entry key ('sp:glasscrab', 'it:flaxleaf', 'loc:camp', 'dc:...') or a chapter ('cat:fauna') */
  key?: string;
  /** called whenever the book marks entries as seen (the laptop refreshes its badges) */
  onChange?: () => void;
}

function buildSections(onChange?: () => void): { sections: BookSection[]; tabs: BookTab[] } {
  const sections: BookSection[] = [{ id: 'front', pages: frontPages, head: { l: '', r: '' } }];
  const tabs: BookTab[] = [];
  for (const c of CATS) {
    const list = entries(c.id);
    sections.push({ id: 'cat:' + c.id, tab: c.id, head: { l: c.name, r: 'Index' }, blocks: () => chapterBlocks(c.id) });
    tabs.push({ id: c.id, label: c.name === 'Artifacts & Culture' ? 'Culture' : c.name, color: CAT_LOOK[c.id].color, icon: icon10URL(c.icon), section: 'cat:' + c.id });
    if (c.id === 'fauna') sections.push({ id: 'web:fauna', tab: 'fauna', head: { l: 'Fauna', r: 'Food web' }, pages: () => [bigWebPage()], startLeft: false });
    for (const e of list.filter(x => x.known)) {
      sections.push({
        id: e.key, tab: c.id, head: { l: c.name, r: e.name },
        blocks: () => (e.key.startsWith('sp:') ? speciesBlocks(e.key.slice(3), e) : e.key.startsWith('it:') ? itemBlocks(e.key.slice(3), e) : e.key.startsWith('loc:') ? (locByKey(e.key) ? locBlocks(locByKey(e.key)!, e) : []) : (discByKey(e.key) ? discBlocks(discByKey(e.key)!, e) : [])),
        shown: (pg, i) => {
          if (i !== 0 || !e.fresh) return;
          // a fresh page: stamp it NEW and file it as seen
          const st = pg.querySelector('[data-new] .pp-stamp') as HTMLElement | null;
          if (st) { st.classList.add('fresh'); setTimeout(() => paperSfx('stamp'), 120); }
          if (e.key.startsWith('sp:')) markSeen(e.key.slice(3));
          markEncSeen(e.key);
          e.fresh = false;
          onChange?.();
        },
      });
    }
    if (list.some(x => !x.known)) sections.push({ id: 'unk:' + c.id, tab: c.id, head: { l: c.name, r: 'Still to find' }, blocks: () => unknownBlocks(c.id) });
  }
  return { sections, tabs };
}

/** open the Zealandia Encyclopedia; resolves when it's closed */
export async function openEncyclopedia(o: EncyOpts = {}): Promise<void> {
  if (current?.isOpen()) { if (o.key) void current.goto(o.key); return current.closed; }
  if (!styled) { styled = true; const s = document.createElement('style'); s.dataset.ui = 'encybook'; s.textContent = CSS; document.head.appendChild(s); }
  const { sections, tabs } = buildSections(o.onChange);
  let start = o.key && sections.some(s => s.id === o.key) ? o.key : undefined;
  if (!start) {
    // open on the first fresh page, else the front
    const fr = CATS.flatMap(c => entries(c.id)).find(e => e.fresh && e.known);
    start = fr?.key ?? 'front';
  }
  const book = openBook({
    id: 'ency', key: 'KeyG', cls: 'eb',
    look: { title: 'Zealandia Encyclopedia', sub: 'field edition', color: '#1f4a48', material: 'cloth', foil: '#e2c472', corners: true, paper: 'journal', inside: 'endpaper', emblem: doodle('compass', { size: '4.5em', color: '#e2c472' }) },
    sections, tabs,
    start,
    onAct: (act, el, b) => {
      if (act === 'photo') { zoomPhoto(b, +(el.dataset.id ?? 0), el); return true; }
      return false;
    },
    onKey: e => {
      const z = document.querySelector('.eb-zoom');
      if (z) { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') z.remove(); return true; }
      return false;
    },
  });
  current = book;
  await book.closed;
  if (current === book) current = null;
}

/** a photo lifted off the page: big polaroid, and "use this one on the page" for species */
function zoomPhoto(b: BookHandle, id: number, from: HTMLElement) {
  const u = upload(id) as UploadRecord | null;
  if (!u) return;
  const pageSec = b.current().section;
  const sp = pageSec.startsWith('sp:') ? pageSec.slice(3) : '';
  const e = sp ? entry(sp) : null;
  const canCover = !!e && e.cover !== u.id && u.subjects.some(s => s.species === sp);
  const z = document.createElement('div');
  z.className = 'eb-zoom';
  z.innerHTML = `${polaroid(u.img, when(u), { rot: tilt(id, 3), tape: true })}<div class="acts pp-hand">${canCover ? '<span data-z="cover">pin this one on the page</span>' : ''}<span data-z="close">put it back</span></div>`;
  z.addEventListener('click', ev => {
    const t = (ev.target as HTMLElement).closest('[data-z]') as HTMLElement | null;
    if (t?.dataset.z === 'cover' && sp) {
      setCover(sp, u.id);
      paperSfx('pin');
      b.refresh(pageSec);
    } else paperSfx('slide', 0.6);
    z.remove();
  });
  paperSfx('slide');
  b.root.appendChild(z);
  void from;
}

/** every key the book has a page for (dev tools) */
export const encyEntryKeys = () => CATS.flatMap(c => entries(c.id)).filter(e => e.known).map(e => e.key);
