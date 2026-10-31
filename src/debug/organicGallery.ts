// ?gallery=organic: the shared painters that used to be primitive shapes (round bushes, cylinder logs,
// ellipse mushrooms, blob leaves, box crates and barrels), side by side, at 2x.

import { showGallery, GalleryItem } from './gallery';
import * as F from '../art/flora';
import * as K from '../art/camp';
import { PAL } from '../art/palettes';
import { plant, fungus, deadwood } from '../art/jungle-plants';
import { foreground } from '../art/jungle-fg';

export function organicGallery() {
  const items: GalleryItem[] = [];
  items.push({ name: 'bush', buf: F.paintBush(12, 50, 30).buf });
  items.push({ name: 'bush-fl', buf: F.paintBush(13, 40, 26, PAL.leafTeal, PAL.flowerPink).buf });
  items.push({ name: 'bush-big', buf: F.paintBush(31, 56, 36, PAL.leafOlive).buf });
  items.push({ name: 'shrub', buf: plant('shrub', 700, 44).buf });
  items.push({ name: 'shrub2', buf: plant('shrub', 705, 36).buf });
  items.push({ name: 'log', buf: F.paintLog(19, 70, 7).buf });
  items.push({ name: 'log-big', buf: F.paintLog(7, 110, 9).buf });
  items.push({ name: 'mush', buf: F.paintMushrooms(16).buf });
  items.push({ name: 'mush-glow', buf: F.paintMushrooms(17, true).buf });
  items.push({ name: 'inkcap', buf: fungus('inkcap', 400, 18).buf });
  items.push({ name: 'dwlog', buf: deadwood('log', 500, 44).buf });
  items.push({ name: 'crate', buf: K.paintCrate(18, 14, true, 4).buf });
  items.push({ name: 'crate-big', buf: K.paintCrate(24, 18, true, 9).buf });
  items.push({ name: 'barrel', buf: K.paintBarrel(PAL.blue).buf });
  items.push({ name: 'barrelR', buf: K.paintBarrel(PAL.red).buf });
  items.push({ name: 'crown', buf: F.paintCrown(23, 90, 50) });
  items.push({ name: 'mangrove', buf: F.paintMangrove(21, 80, 90).buf });
  items.push({ name: 'fg-leaves', buf: foreground('leaves', 600, 100).buf });
  items.push({ name: 'fg-monstera', buf: foreground('monstera', 619, 100).buf });
  showGallery(items, 2, '#7d8d84');
}
