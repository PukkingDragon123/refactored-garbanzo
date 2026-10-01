// V9: register the island wildlife painters as beasts, so the field guide (speciesSprite) and any
// sheet tool can render them by species id. Imported for its side effect by the field guide file.

import { registerBeast } from '../../beasts';
import { TRYCOP_DEF } from './trycop';
import { JEWELHORNET_DEF, ZOMBIECAP_DEF } from './hornet';
import { CRITTER_DEFS } from './critters';

registerBeast('trycop', TRYCOP_DEF);
registerBeast('jewelhornet', JEWELHORNET_DEF);
registerBeast('hornetcap', ZOMBIECAP_DEF);
for (const [id, def] of Object.entries(CRITTER_DEFS)) registerBeast(id, def);
