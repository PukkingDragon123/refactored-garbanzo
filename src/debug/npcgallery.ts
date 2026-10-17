// ?gallery=npcs : the V11 NPCs (src/art/v11/npcs): each one's idle and walk frames, a few talking
// expressions on the sprite head, the dialogue portraits and the HD close-up busts.
// ?gallery=npcs&who=doug : just one of them, every frame.
import { showGallery, GalleryItem } from './gallery';
import { composite } from './arohagallery';
import * as P from '../art/v7';
import { renderAnimePortrait, renderAnimePortraitHD } from '../art/anime/portraits';
import { registerNpcArt, NPC_IDS } from '../art/v11/npcs/register';
import { PixelBuffer } from '../art/pixel';

/** the composite cropped to the figure (the sheet stays compact) */
function fig(id: string, anim: string, f: number, expr = 'neutral'): PixelBuffer {
  const c = composite(id, anim, f, expr);
  const out = new PixelBuffer(64, 100);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 64; x++) out.data[y * 64 + x] = c.data[(y + 2) * c.w + x + 34];
  return out;
}

export async function runNpcGallery() {
  registerNpcArt();
  const q = new URLSearchParams(location.search);
  const who = q.get('who');
  const part = q.get('part') ?? 'all';
  const items: GalleryItem[] = [];
  const ids = who ? who.split(',') : NPC_IDS, one = ids.length === 1;
  for (const id of ids) {
    if (part === 'all' || part === 'sprite') {
      items.push({ name: id + ' idle', buf: fig(id, 'idle', 0) });
      for (const a of ['idle', 'walk']) {
        const n = P.animFor(id, a)?.frames ?? 1;
        const step = one ? 1 : a === 'idle' ? Math.max(1, Math.floor(n / 4)) : 3;
        for (let f = 0; f < n; f += step) items.push({ name: `${id} ${a} ${f}`, buf: fig(id, a, f) });
      }
      if (one) for (const a of ['talk', 'wave', 'sit', 'laugh', 'point']) items.push({ name: `${id} ${a}`, buf: fig(id, a, 1, 'happy') });
    }
    if (part === 'all' || part === 'portrait') {
      for (const e of one ? ['neutral', 'happy', 'laugh', 'surprised', 'sad', 'angry', 'teasing', 'thinking'] : ['neutral', 'happy']) items.push({ name: `${id} ${e}`, buf: renderAnimePortrait(id, e) });
      for (const e of one ? ['neutral', 'happy', 'surprised'] : ['neutral']) items.push({ name: `${id} HD ${e}`, buf: renderAnimePortraitHD(id, e) });
    }
  }
  if (part === 'props') {
    const Pl = await import('../art/v11/npcs/places');
    for (const [n, sp] of [['station', Pl.station(false)], ['station fixed', Pl.station(true)], ['tree', Pl.tallTree()], ['radio', Pl.radio()], ['marge hut', Pl.margeHut()], ['helix camp', Pl.helixCamp()], ['hunters', Pl.hunterCamp()], ['log', Pl.canLog()], ['can', Pl.can()], ['stake', Pl.stake(false)], ['stake set', Pl.stake(true)], ['helix trap', Pl.helixTrap()], ['totara', Pl.fallenTotara(false)], ['totara cut', Pl.fallenTotara(true)], ['carving', Pl.carving()], ['weaving', Pl.weaving()]] as [string, { buf: import('../art/pixel').PixelBuffer }][]) items.push({ name: n, buf: sp.buf });
  }
  showGallery(items, Number(q.get('scale') ?? 2), '#6d7f86');
}
