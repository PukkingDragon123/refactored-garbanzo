// Collectible resource nodes: plants, fungi, insects, animal signs, beach finds and salvage.
// Each needs the right tool, plays a collecting animation for a short timer, and regrows after days.

import type { Renderer, Frame } from '../gfx/renderer';
import { packColor } from '../gfx/renderer';
import type { Drawable } from './stage';
import { A } from '../game/assets';
import { game } from '../game/game';
import { ITEMS } from '../game/items';
import { rand } from '../core/math';

export type CollectAnim = 'kneel' | 'dig' | 'net' | 'tweeze' | 'jar' | 'pick' | 'pull';

export interface NodeDef {
  /** items granted: [itemId, min, max] */
  gives: [string, number, number][];
  /** required tool(s) */
  tools?: string[];
  /** seconds (before skills) */
  time: number;
  anim: CollectAnim;
  verb: string;
  /** days until it regrows (0 = one-off) */
  regrow: number;
  /** only collectable at night */
  night?: boolean;
  sfx: string;
  fx: 'leaf' | 'dirt' | 'spark' | 'glow' | 'water' | 'wood' | 'dust';
  /** gives the Field Guide a clue as well */
  clue?: string;
}

export const NODES: Record<string, NodeDef> = {
  flax: { gives: [['flaxleaf', 1, 2]], tools: ['knife'], time: 1.6, anim: 'kneel', verb: 'Cut flax', regrow: 2, sfx: 'pluck', fx: 'leaf' },
  treefern: { gives: [['fernfrond', 1, 2]], tools: ['knife'], time: 1.4, anim: 'kneel', verb: 'Cut a fern frond', regrow: 2, sfx: 'pluck', fx: 'leaf' },
  kawakawa: { gives: [['kawakawa', 1, 3]], time: 1.2, anim: 'pick', verb: 'Pick kawakawa', regrow: 1, sfx: 'pluck', fx: 'leaf' },
  rata: { gives: [['ratabloom', 1, 2]], time: 1.2, anim: 'pick', verb: 'Pick rātā blossom', regrow: 2, sfx: 'pluck', fx: 'leaf' },
  pitcher: { gives: [['pitcher', 1, 1]], tools: ['knife'], time: 2, anim: 'kneel', verb: 'Cut a pitcher', regrow: 3, sfx: 'pluck', fx: 'water' },
  moonfruit: { gives: [['moonfruit', 1, 3]], time: 1.2, anim: 'pick', verb: 'Gather moonfruit', regrow: 1, sfx: 'pluck', fx: 'leaf' },
  mossrock: { gives: [['moss', 1, 2]], time: 1.2, anim: 'kneel', verb: 'Peel moss', regrow: 2, sfx: 'pluck', fx: 'leaf' },
  glowcap: { gives: [['glowcap', 1, 2], ['grub', 0, 1]], tools: ['trowel'], time: 2.2, anim: 'dig', verb: 'Dig up glowcaps', regrow: 2, sfx: 'dig', fx: 'glow' },
  bracket: { gives: [['bracket', 1, 1]], tools: ['knife'], time: 2, anim: 'pull', verb: 'Cut the bracket fungus', regrow: 3, sfx: 'pluck', fx: 'wood' },
  inkcap: { gives: [['inkcap', 1, 2]], tools: ['trowel'], time: 1.8, anim: 'dig', verb: 'Dig up inkcaps', regrow: 2, sfx: 'dig', fx: 'dirt' },
  grublog: { gives: [['grub', 2, 4]], tools: ['trowel'], time: 2.4, anim: 'dig', verb: 'Dig out grubs', regrow: 1, sfx: 'dig', fx: 'wood' },
  lanternbeetle: { gives: [['lanternbeetle', 1, 1]], tools: ['jar'], time: 2, anim: 'jar', verb: 'Catch a lantern beetle', regrow: 1, night: true, sfx: 'jarClink', fx: 'glow' },
  weta: { gives: [['weta', 1, 1]], tools: ['jar', 'gloves'], time: 2.6, anim: 'jar', verb: 'Catch the wētā', regrow: 2, night: true, sfx: 'jarClink', fx: 'dust' },
  skymoth: { gives: [['skymoth', 1, 1]], tools: ['net'], time: 1.8, anim: 'net', verb: 'Net the sky moth', regrow: 1, sfx: 'netSwish', fx: 'spark' },
  mantis: { gives: [['mantis', 1, 1]], tools: ['jar'], time: 2, anim: 'jar', verb: 'Catch the leaf mantis', regrow: 2, sfx: 'jarClink', fx: 'leaf' },
  dragonfly: { gives: [['dragonfly', 1, 1]], tools: ['net'], time: 1.8, anim: 'net', verb: 'Net a dragonfly', regrow: 1, sfx: 'netSwish', fx: 'water' },
  thornfur: { gives: [['furtuft', 1, 1]], tools: ['tweezers'], time: 2.2, anim: 'tweeze', verb: 'Take the fur sample', regrow: 3, sfx: 'pluck', fx: 'dust', clue: 'fur-tuft' },
  feather: { gives: [['feather', 1, 1]], tools: ['tweezers'], time: 1.6, anim: 'tweeze', verb: 'Collect the feather', regrow: 4, sfx: 'pluck', fx: 'dust' },
  shedskin: { gives: [['shedskin', 1, 1]], tools: ['tweezers'], time: 2.4, anim: 'tweeze', verb: 'Collect the shed skin', regrow: 5, sfx: 'pluck', fx: 'dust' },
  dropping: { gives: [['dropping', 1, 1]], tools: ['gloves'], time: 2.2, anim: 'kneel', verb: 'Bag the droppings', regrow: 3, sfx: 'dig', fx: 'dirt', clue: 'scat-scales' },
  quill: { gives: [['quill', 1, 2]], tools: ['tweezers'], time: 1.6, anim: 'tweeze', verb: 'Pick up the quills', regrow: 3, sfx: 'pluck', fx: 'dust' },
  bone: { gives: [['bone', 1, 1]], time: 2, anim: 'kneel', verb: 'Take the vertebra', regrow: 0, sfx: 'dig', fx: 'dust', clue: 'vertebrae' },
  eggshell: { gives: [['eggshell', 1, 2]], tools: ['tweezers'], time: 1.8, anim: 'tweeze', verb: 'Collect eggshell', regrow: 4, sfx: 'pluck', fx: 'dust', clue: 'eggshell' },
  plate: { gives: [['plate', 1, 1]], time: 1.6, anim: 'kneel', verb: 'Take the armour plate', regrow: 5, sfx: 'pluck', fx: 'dust', clue: 'scute' },
  driftwood: { gives: [['wood', 2, 3]], time: 1.6, anim: 'pick', verb: 'Gather driftwood', regrow: 1, sfx: 'rustle', fx: 'wood' },
  stones: { gives: [['stone', 2, 3]], time: 1.6, anim: 'kneel', verb: 'Gather stones', regrow: 1, sfx: 'dig', fx: 'dust' },
  shells: { gives: [['mussel', 2, 3]], time: 1.8, anim: 'kneel', verb: 'Pick mussels', regrow: 1, sfx: 'pluck', fx: 'water' },
  seaweed: { gives: [['flax', 1, 2]], time: 1.4, anim: 'kneel', verb: 'Pull kelp fibre', regrow: 1, sfx: 'pluck', fx: 'water' },
  crate: { gives: [], time: 2.2, anim: 'pull', verb: 'Search the crate', regrow: 0, sfx: 'woodCreak', fx: 'wood' },
  snare: { gives: [['furtuft', 1, 1], ['feather', 0, 1]], time: 2.4, anim: 'kneel', verb: 'Check the old snare', regrow: 0, sfx: 'rope', fx: 'dust' },
};

export interface NodeArt {
  normal: Frame;
  depleted: Frame | null;
  glow?: Frame | null;
}

export class ResourceNode implements Drawable {
  z = 20;
  hover = false;
  /** crates: fixed contents instead of NODES gives */
  contents: [string, number][] | null = null;
  private t = rand.next() * 10;
  /** collecting progress 0..1 (drawn as a ring), -1 = idle */
  progress = -1;
  /** draw order plane (1 = gameplay) */
  p = 1;
  sx = 1;

  constructor(readonly key: string, readonly kind: string, public x: number, public y: number, public art: NodeArt | null) {}

  get def() {
    return NODES[this.kind];
  }
  get depleted() {
    const d = game.save.nodes[this.key];
    return d !== undefined && (d === -1 || game.save.day < d);
  }
  deplete() {
    const r = this.def?.regrow ?? 0;
    game.save.nodes[this.key] = r > 0 ? game.save.day + r : -1;
  }
  available(night: boolean) {
    if (this.depleted) return false;
    if (this.def?.night && !night) return false;
    return true;
  }
  missingTools(): string[] {
    return (this.def?.tools ?? []).filter(t => !game.save.tools.includes(t));
  }
  label(): string {
    const miss = this.missingTools();
    if (miss.length) return `${this.def.verb} <span style="opacity:0.75">(needs ${miss.map(m => ITEMS[m]?.name ?? m).join(' + ')})</span>`;
    return this.def.verb;
  }

  update(dt: number) {
    this.t += dt;
  }

  draw(r: Renderer) {
    const a = this.art;
    const dep = this.depleted;
    if (!a) {
      r.rect(this.x - 4, this.y - 8, 8, 8, dep ? packColor(0.3, 0.3, 0.3, 1) : packColor(0.4, 0.8, 0.4, 1));
      return;
    }
    const fr = dep ? a.depleted : a.normal;
    if (fr) r.draw(fr, this.x, this.y, this.sx, 1);
    if (!dep && a.glow) {
      r.emissive(1);
      r.draw(a.glow, this.x, this.y, this.sx, 1, 0, packColor(1, 1, 1, 0.75 + 0.25 * Math.sin(this.t * 2)));
      r.emissive();
    }
    // collectible glint
    if (!dep && (this.hover || Math.sin(this.t * 1.7) > 0.93)) {
      const k = this.hover ? 1 : (Math.sin(this.t * 1.7) - 0.93) / 0.07;
      const top = fr ? this.y - fr.ay + 3 : this.y - 8;
      r.fxDraw(A.spark, this.x + Math.sin(this.t) * 4, top, 0.8, 0.8, this.t, packColor(1, 0.95, 0.7, 1), 1.6 * k);
    }
    // collecting progress ring
    if (this.progress >= 0) {
      const n = 14;
      const cy = (fr ? this.y - fr.ay : this.y - 10) - 10;
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const on = i / n < this.progress;
        r.fxDraw(A.dot2, this.x + Math.cos(ang) * 9, cy + Math.sin(ang) * 9, 1, 1, 0, on ? packColor(1, 0.85, 0.35, 1) : packColor(0.2, 0.2, 0.2, 0.6), on ? 1.4 : 0.6, !on);
      }
    }
  }
}
