// V12 Te Tuawhenua is the feud's home ground (the creatures and the director: src/game/v12/feud). On
// every visit the director runs here with the region's own spots (the den and the cache in the claw
// gorge, the arena in the feathered gully, the kill sites), and the signs the generator laid along the
// way are things Mori can look at: claw-scored trunks, plumes in the grass, the bone piles at the kills.
// Each first look counts for "The Claw and the Plume" (markSign).

import type { FieldScene } from '../../scenes/field';
import { floatText } from '../../../ui/v12/float';
import { tuaHooks } from './hooks';
import { TUA, TUA_SPOT, tuaGround } from './gen';
import { markSign, FEUD_SIGNS, feudActive } from '../feud/quest';
import type { SignId } from '../feud/quest';
import { game } from '../../game';
import { attachFeud } from '../feud/director';

const LINES: Record<SignId, string[]> = {
  trunk: ['Four gouges, deeper than my hand... and higher than my head. Whatever did this was standing up.', 'Fresh sap still running. It sharpened its claw here. Today.'],
  plume: ['A feather... no. A scale that turned into a feather. Iridescent, as long as my forearm.', 'Another plume. The boa’s been through here, shedding as it goes.'],
  bones: ['Picked clean. And the ribs are cut, not bitten. One stroke.', 'Bones, half buried. Something dragged this here and came back for it later.'],
};

function sign(f: FieldScene, x: number, id: SignId, label: string, i: number) {
  f.interact.push({
    x, y: tuaGround(x) - 16, w: 22, h: 34, label, standX: x - 22,
    quest: () => feudActive() && !game.save.flags[FEUD_SIGNS[id]],
    action: () => {
      const isNew = markSign(id);
      void floatText({ text: LINES[id][isNew ? 0 : 1 + (i % (LINES[id].length - 1))] ?? LINES[id][0], style: isNew ? 'say' : 'think', ms: 3200 });
    },
  });
}

tuaHooks.build.push(f => {
  TUA.scored.forEach((x, i) => sign(f, x, 'trunk', 'Look at the claw marks', i));
  TUA.feathers.forEach((x, i) => sign(f, x, 'plume', 'Pick up the plume', i));
  TUA.kills.forEach((x, i) => sign(f, x, 'bones', 'Look at the bones', i));
});

// the feud starts with the scene's first frame (once the scene is the one being played)
const attached = new WeakSet<FieldScene>();
tuaHooks.update.push(f => {
  if (attached.has(f)) return;
  attached.add(f);
  try { attachFeud(f, { den: TUA_SPOT.den, cache: TUA_SPOT.cache, arena: TUA_SPOT.arena, kills: TUA_SPOT.kills, ground: tuaGround }); } catch (e) { console.warn('[backcountry] feud', e); }
});
