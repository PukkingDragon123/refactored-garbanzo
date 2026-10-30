// V12 hard-won sightings: the rare animals come to the patient. Each has a spot, a time of day and a
// way of waiting (crouched, or hidden in cover, and still). Wait long enough at the right time and you
// hear it first (a rustle, a whisper), then it walks in. The wrong time of day: nothing comes, and
// Aroha (or Mori's notes) say when to come back. The loop's daily goal points at the next one.

import { game } from '../game';
import type { FieldScene } from '../scenes/field';
import type { TimeOfDay } from '../../world/timeofday';
import { Custom } from '../../world/props';
import { audio } from '../../core/audio';
import { SPECIES_BY_ID } from '../species';
import { sceneTag } from '../v10/expedition';
import { floatText } from '../../ui/v12/float';

export interface RareSpot {
  loc: string;
  species: string;
  /** world x of the spot (the animal comes in from one side of it) */
  x: number;
  times: TimeOfDay[];
  /** seconds of stillness it takes */
  still: number;
  /** what you have to do, for the daily goal ("at dusk, crouch in the fern grove and wait") */
  goal: string;
  /** what Aroha whispers (or Mori remembers) when you reach the spot */
  hint: string;
}

export const RARE: RareSpot[] = [
  { loc: 'fernwood', species: 'boneface', x: 2760, times: ['dawn', 'day', 'dusk'], still: 14, goal: 'hide in the black tree ferns and keep very still', hint: 'Something big pushes through the thorn scrub here. Hide, and let the forest forget you.' },
  { loc: 'fernwood', species: 'sprinter', x: 1500, times: ['dusk', 'night'], still: 12, goal: 'at dusk in the fern grove, crouch and wait', hint: 'Sprint vipers hunt this grove at dusk. Get low. Don’t move. They hunt what moves.' },
  { loc: 'canopy', species: 'lurevip', x: 2200, times: ['dusk', 'night'], still: 15, goal: 'after dusk on the high branches, wait in the dark', hint: 'After dark a little light dangles up here. Don’t chase it. Wait for it.' },
  { loc: 'falls', species: 'cragviper', x: 2480, times: ['day', 'dusk'], still: 12, goal: 'below the nesting cliff, crouch out of sight', hint: 'The crag vipers steal eggs from the auks up there. Keep low and still, they come down.' },
  { loc: 'falls', species: 'torrentdipper', x: 1300, times: ['dawn', 'day'], still: 10, goal: 'early, by the plunge pool, sit very still', hint: 'A dipper walks under the water here, early. Be a rock.' },
  { loc: 'mangrove', species: 'titan', x: 1800, times: ['dawn', 'day', 'dusk', 'night'], still: 18, goal: 'deep in the channels, hidden in cover, for a long time', hint: 'Something enormous moves under this water. If you want to see it, you hide. For a long time.' },
];

const locOf = (f: FieldScene) => sceneTag(f) ?? sceneTag(f.site) ?? (f.site as unknown as { loc?: string }).loc ?? f.site.id;

/** watch this scene's rare spots */
export function installRare(f: FieldScene) {
  const loc = locOf(f);
  const spots = RARE.filter(r => r.loc === loc);
  if (!spots.length) return;
  const st = spots.map(r => ({ r, t: 0, hinted: false, heard: false, came: false }));
  f.main.add(new Custom(0, () => {}, dt => {
    if (game.scene !== f || f.cutscene || game.ui.blocking || !(dt > 0)) return;
    const p = f.player;
    for (const s of st) {
      if (s.came) continue;
      const d = Math.abs(p.x - s.r.x);
      const right = s.r.times.includes(f.tod);
      // the hint, once, as Mori reaches the spot
      if (!s.hinted && d < 260) {
        s.hinted = true;
        const g = f.guide?.a;
        const text = right ? s.r.hint : `${SPECIES_BY_ID[s.r.species]?.name ?? 'It'}? Not at this time of day. Come back ${s.r.times.includes('dusk') ? 'at dusk' : s.r.times.includes('dawn') ? 'early, at dawn' : 'in daylight'}.`;
        void floatText(g ? { actor: g, text, style: 'whisper', ms: 3600 } : { text, style: 'think', ms: 3400 });
      }
      if (!right || d > 140) { s.t = Math.max(0, s.t - dt * 2); continue; }
      const still = (p.crouch || p.state === 'hide') && Math.abs(p.vx) < 5 && !f.cam.active;
      if (!still) { s.t = Math.max(0, s.t - dt * 3); continue; }
      s.t += dt * (p.state === 'hide' ? 1.3 : 1);
      if (!s.heard && s.t > s.r.still * 0.55) {
        s.heard = true;
        f.sfx('rustleBush', s.r.x + 160, 0.6, 0.8);
        void floatText({ text: '...something’s coming. Don’t. Move.', style: 'whisper', ms: 2600 });
      }
      if (s.t >= s.r.still) {
        s.came = true;
        const side = p.facing >= 0 ? 1 : -1;
        const sx = Math.max(60, Math.min(f.site.width - 60, s.r.x + side * 210));
        f.spawnRule({ species: s.r.species, n: [1, 1], x: [sx - 10, sx + 10], chance: 1 }, false);
        audio.play('discover', { vol: 0.3, pitch: 0.8 });
        game.save.flags['v12:rare:' + s.r.species] = true;
        game.persist();
      }
    }
  }));
}
