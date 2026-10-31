// V12 The Thunderbird: the signs it leaves across the island, for step two of the hunt. Each one is a
// hand-painted prop set into an existing place with something to look at (E): Mori kneels, thinks out
// loud in floating text, and Aroha (when she is with him) reads it for him.
//
//   fernwood   a shed primary lying in the litter, longer than Mori's arm (he keeps it)
//   falls      four talon gouges raked into a granite boulder by the plunge pool track
//   hills      the kill site in the tussock basin: a torhopper picked clean, two feathers in the turf

import type { FieldScene } from '../../scenes/field';
import type { Renderer, Frame } from '../../../gfx/renderer';
import type { Drawable } from '../../../world/stage';
import type { Interactable } from '../../../world/npc';
import { game } from '../../game';
import { local } from '../../assets';
import { audio } from '../../../core/audio';
import { floatText } from '../../../ui/v12/float';
import { paintGiantFeather, paintKillSite, gougeRock } from '../../../art/v12/thunderbird';
import type { TBArt } from '../../../art/v12/thunderbird';
import { paintBoulder } from '../../../art/v11/hills/rocks';
import { tbStep, tbActive, signsFound } from './quest';
import { partsOf } from '../region';

interface SignDef {
  loc: string;
  flag: string;
  /** world x as a fraction of the scene's width (or an absolute x) */
  at: number;
  label: string;
  art: () => TBArt;
  /** Mori's thought, then Aroha's reading */
  think: string;
  aroha: string;
  /** the prop goes once it's found (the feather goes in the pack) */
  take?: boolean;
}
const SIGNS: SignDef[] = [
  {
    loc: 'fernwood', flag: 'tb:sign:feather', at: 0.42, label: 'Look at the giant feather', art: paintGiantFeather, take: true,
    think: 'That’s... a feather. It’s longer than my arm. With a white streak through it, like a lightning bolt.',
    aroha: 'A flight feather. Shed, not torn. It moulted on the wing, right over our heads.',
  },
  {
    loc: 'falls', flag: 'tb:sign:talons', at: 0.58, label: 'Look at the gouges in the boulder', art: () => { const a = paintBoulder(4127, 58, 40); gougeRock(a.buf, 77); return { buf: a.buf, ax: a.ax, ay: a.ay }; },
    think: 'Four grooves in solid granite. Each one as deep as my finger. Something landed here. Hard.',
    aroha: 'Talons. It took off from this rock with something heavy. Look how the gouges drag downhill.',
  },
  {
    loc: 'hills', flag: 'tb:sign:kill', at: 760, label: 'Look at the bones in the tussock', art: paintKillSite,
    think: 'A torhopper. All of it. Picked clean in one sitting... the skull’s been opened like an egg.',
    aroha: 'Its table. It eats up here, in the open, where nothing can sneak up on it. Except us.',
  },
];

const frames = new Map<string, Frame>();
let owner: unknown = null;
function frameOf(key: string, make: () => TBArt): Frame {
  if (owner !== local) { owner = local; frames.clear(); }
  let f = frames.get(key);
  if (!f) { const a = make(); f = local.add('v12:tbsign:' + key, a.buf, a.ax, a.ay); frames.set(key, f); }
  return f;
}

/** place this scene's sign (the quest is past the legend, and it hasn't been taken) */
export function placeSigns(f: FieldScene, loc: string | null) {
  if (!loc || !tbActive()) return;
  // (a region scene places all its places' signs, each along its own stretch: ../region.ts)
  for (const part of partsOf(loc, f.site.width)) for (const d of SIGNS) {
    if (d.loc !== part.loc) continue;
    const found = !!game.save.flags[d.flag];
    if (found && d.take) continue;
    const x = part.x0 + (d.at <= 1 ? Math.round(part.w * d.at) : d.at);
    const y = f.st.terrain.groundY(x);
    const fr = frameOf(d.flag, d.art);
    const prop: Drawable & { dead?: boolean } = { z: 18, draw: (r: Renderer) => { if (!prop.dead) r.draw(fr, x, y + 2); } };
    f.main.add(prop);
    if (found) continue;
    const it: Interactable = {
      x, y: y - 8, w: 30, h: 24, label: d.label, standX: x - 26,
      enabled: () => !game.save.flags[d.flag] && tbStep() >= 1,
      quest: () => tbStep() === 1,
      action: async () => {
        if (game.save.flags[d.flag]) return;
        const p = f.player;
        p.vx = 0;
        p.facing = x >= p.x ? 1 : -1;
        p.body.play('kneel', 'idle').catch(() => {});
        audio.play('discover', { vol: 0.35, pitch: 0.8 });
        game.save.flags[d.flag] = true;
        game.persist();
        if (d.take) prop.dead = true;
        await floatText({ text: d.think, style: 'think', ms: 3600 });
        const g = f.guide?.a;
        if (g) await floatText({ actor: g, text: d.aroha, style: 'whisper', ms: 3600 });
        const n = signsFound();
        void floatText({ text: n >= 3 ? 'That’s all three. Time to get ready.' : `${n} of 3 signs.`, style: 'notice', ms: 2400 });
        const i = f.interact.indexOf(it);
        if (i >= 0) f.interact.splice(i, 1);
      },
    };
    f.interact.push(it);
  }
}
