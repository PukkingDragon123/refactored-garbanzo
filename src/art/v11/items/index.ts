// V11 illustrated item art: the one place every item picture is registered. Imported at startup
// (src/game/bindart.ts) so itemArtURL / itemArtCanvas (src/art/v11/itemart.ts) and the footprints
// (src/game/v11/footprints.ts) work from any scene. Registering only stores the painters and the
// footprints; each picture is painted the first time something asks for it, then cached.
//
// The art is organised by category, one file each (see kit.ts for the shared painting kit and the
// finishing pass). The gallery view is ?gallery=items11 (src/debug/items11.ts).

import './tools';
import './materials';

export { artList } from './kit';
export type { ArtEntry } from './kit';
