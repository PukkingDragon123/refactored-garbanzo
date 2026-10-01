// V9 open-ocean wildlife seen from the Kittiwake's deck, painted with the beasts sketch core and
// registered as beasts (so the field guide icons, renderAny and the wild bodies all know them).

import { registerBeast } from '../../beasts';
import { VANEBILL } from './vanebill';
import { SACKJAW } from './sackjaw';
import { SCYTHEWING } from './scythewing';
import { MOONFIN } from './moonfin';
import { KITEFISH } from './kitefish';
import { REEFBACK, REEFBACK_FAR } from './reefback';

export const SEA_BEASTS = { vanebill: VANEBILL, sackjaw: SACKJAW, scythewing: SCYTHEWING, moonfin: MOONFIN, kitefish: KITEFISH, reefback: REEFBACK, 'reefback-far': REEFBACK_FAR };
for (const [id, def] of Object.entries(SEA_BEASTS)) registerBeast(id, def);

export { VANEBILL_BANK, vanebillBankAngle } from './vanebill';
