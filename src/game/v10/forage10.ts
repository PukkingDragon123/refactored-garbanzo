// V10 food and forage: what Mori can eat, how much energy it gives back, and the risky forage.
//
// Anything of kind 'food', with an ItemDef.eat / energy value, or listed here is edible. Forage marked
// risky (ItemDef.risky, or the island's berries, bulbs, leaves and mushrooms below) is unidentified:
// it may be fine or it may be poisonous, and eating it is a gamble (stomach ache = energy drains for a
// while, dizziness = wobbly view and controls, rarely a big drain all at once). Once it has been
// researched (a laptop sample analysis, a research log / fact entry, markFoodKnown(), or the Research
// skills Field Botany / Pocket Sequencer) the backpack says plainly whether it's safe or poisonous.

import { game } from '../game';
import { ITEMS } from '../items';
import { count, remove } from '../inventory';
import { bucket } from './store';
import { fx10 } from './skills10';
import { energy, maxEnergy, restore, spend, addAilment } from './energy';
import { audio } from '../../core/audio';
import { itemIconURL } from '../../art/itemicons';

export type Tox = 0 | 1 | 2;
export interface FoodDef {
  /** energy restored (before Field Skills) */
  energy?: number;
  /** 0 safe, 1 mildly poisonous, 2 poisonous */
  tox?: Tox;
  /** unidentified until researched */
  risky?: boolean;
}

/** the game's food and forage (other modules add theirs with defineFood or ItemDef.energy / risky) */
const FOOD: Record<string, FoodDef> = {
  ration: { energy: 22 }, stew: { energy: 35 }, tea: { energy: 8 }, mussel: { energy: 6 }, pipi: { energy: 5 },
  berry_dusk: { energy: 5, tox: 0, risky: true }, berry_gold: { energy: 4, tox: 0, risky: true }, berry_ember: { energy: 5, tox: 1, risky: true },
  moonfruit: { energy: 10, tox: 0, risky: true }, plant_dunelily: { energy: 9, tox: 1, risky: true }, kawakawa: { energy: 2, tox: 0, risky: true },
  plant_seaholly: { energy: 2, tox: 1, risky: true }, glowcap: { energy: 3, tox: 2, risky: true }, inkcap: { energy: 3, tox: 1, risky: true },
};
// published on the item defs too (ItemDef.energy / risky), for anything that reads them directly
for (const [id, f] of Object.entries(FOOD)) {
  const d = ITEMS[id];
  if (!d) continue;
  if (d.energy === undefined && f.energy !== undefined) d.energy = f.energy;
  if (d.risky === undefined && f.risky) d.risky = true;
}
/** energy by kind when nothing else says */
const KIND_ENERGY: Partial<Record<string, number>> = { food: 10, plant: 3, fungus: 3 };

/** register (or override) the food values of an item from another module */
export function defineFood(id: string, d: FoodDef) {
  FOOD[id] = { ...FOOD[id], ...d };
  const it = ITEMS[id];
  if (it && d.energy !== undefined) it.energy = d.energy;
  if (it && d.risky !== undefined) it.risky = d.risky;
}

// forage that had nothing for the laptop to analyse: now the analysis says whether it's safe
const LAB: Record<string, { rp: number; time: number; text: string }> = {
  berry_dusk: { rp: 5, time: 2, text: 'No alkaloids, no cyanogenic compounds: sugars, a little pine resin and a lot of purple pigment. Safe to eat.' },
  berry_gold: { rp: 5, time: 2, text: 'Citric acid and a heap of vitamin C, nothing harmful. Sour enough to fold your face, but safe to eat.' },
  plant_dunelily: { rp: 6, time: 3, text: 'The raw bulb is packed with needle crystals of calcium oxalate: eaten raw it burns and upsets the gut. Roasting breaks them down.' },
};
for (const [id, lab] of Object.entries(LAB)) if (ITEMS[id] && !ITEMS[id].lab) ITEMS[id].lab = lab;

interface ForageState {
  /** identified by research: 1 */
  known: Record<string, number>;
  /** times it made Mori ill */
  sick: Record<string, number>;
}
function F(): ForageState { return bucket<ForageState>('forage10', () => ({ known: {}, sick: {} })); }

/** a stable pseudo-random toxicity for risky items nobody gave one */
function hashTox(id: string): Tox {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const u = ((h >>> 0) % 1000) / 1000;
  return u < 0.55 ? 0 : u < 0.85 ? 1 : 2;
}

export function isRisky(id: string): boolean {
  const d = ITEMS[id];
  if (!d) return false;
  return d.risky ?? FOOD[id]?.risky ?? false;
}

/** has this forage been researched (or is it covered by the Research skills)? */
export function isFoodKnown(id: string): boolean {
  const s = game.save, d = ITEMS[id];
  if (!d) return false;
  if (F().known[id] || s.analyzed?.[id] || s.research?.[id] || s.facts?.[id] || s.facts?.['food:' + id] || s.flags['v10:known:' + id]) return true;
  if (d.kind === 'fungus') return fx10.mycology();
  return fx10.botany() || fx10.mycology();
}

/** the research module calls this when a plant / mushroom / berry is identified */
export function markFoodKnown(id: string) {
  F().known[id] = 1;
  game.persist();
}

export const timesSick = (id: string) => F().sick[id] ?? 0;

export interface FoodInfo {
  edible: boolean;
  /** energy restored (with Field Skills) */
  energy: number;
  risky: boolean;
  known: boolean;
  tox: Tox;
  /** what Mori knows: 'safe' (plain food or researched safe), 'unknown' (a gamble), 'poison' (researched poisonous) */
  verdict: 'safe' | 'unknown' | 'poison';
  /** the old expedition buff it also gives ('steady' | 'quiet') */
  buff: string | null;
}

export function foodInfo(id: string): FoodInfo {
  const d = ITEMS[id];
  const no: FoodInfo = { edible: false, energy: 0, risky: false, known: true, tox: 0, verdict: 'safe', buff: null };
  if (!d) return no;
  const f = FOOD[id];
  const risky = isRisky(id);
  const edible = d.kind === 'food' || !!d.eat || d.energy !== undefined || !!f || (risky && (d.kind === 'plant' || d.kind === 'fungus'));
  if (!edible) return no;
  const tox: Tox = f?.tox ?? (risky ? hashTox(id) : 0);
  const known = !risky || isFoodKnown(id);
  const base = d.energy ?? f?.energy ?? KIND_ENERGY[d.kind] ?? 0;
  return {
    edible, energy: Math.round(base * fx10.foodMult()), risky, known, tox,
    verdict: !known ? 'unknown' : risky && tox > 0 ? 'poison' : 'safe',
    buff: d.eat === 'steady' || d.eat === 'quiet' ? d.eat : null,
  };
}

/** can it be eaten right now? (reason: a short line for a toast) */
export function canEat(id: string): { ok: boolean; reason?: string } {
  const fi = foodInfo(id);
  if (!fi.edible) return { ok: false, reason: 'You can’t eat that.' };
  if (count(id) < 1) return { ok: false, reason: 'None left.' };
  if (!fi.buff && energy() >= maxEnergy() - 0.5) return { ok: false, reason: 'You’re full. Save it for later.' };
  return { ok: true };
}

export type PoisonFx = 'none' | 'stomach' | 'dizzy' | 'big';

type EatenFn = (id: string, fx: PoisonFx) => void;
const eatenFns: EatenFn[] = [];
/** V11: something was eaten through eatFood (the cooking module gives dishes their extra buffs) */
export function onEaten(fn: EatenFn): () => void { eatenFns.push(fn); return () => { const i = eatenFns.indexOf(fn); if (i >= 0) eatenFns.splice(i, 1); }; }
export interface EatResult { ok: boolean; id: string; energy: number; fx: PoisonFx; reason?: string }

function roll(fi: FoodInfo): PoisonFx {
  if (!fi.risky || fi.tox === 0) return 'none';
  const res = fx10.poisonResist();
  if (Math.random() >= (fi.tox === 2 ? 0.92 : 0.6) * (1 - res)) return 'none';
  const r = Math.random();
  const big = (fi.tox === 2 ? 0.16 : 0.04) * (1 - res);
  if (r < big) return 'big';
  if (r < big + (fi.tox === 2 ? 0.42 : 0.35)) return 'dizzy';
  return 'stomach';
}

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
const GAMBLE_OK = ['Mm. Tastes fine. I think. Fingers crossed.', 'Not bad! Hopefully those aren’t famous last words.', '...No tingling, no burning. That’s good, right?'];
const FX_LINES: Record<Exclude<PoisonFx, 'none'>, string[]> = {
  stomach: ['Ooh. My stomach is NOT happy about that.', 'Urgh. That was a mistake. A big, gurgly mistake.'],
  dizzy: ['Whoa... why is the ground tilting?', 'Huh. The beach is... swimming. Is it supposed to swim?'],
  big: ['Oh no. Oh no no no—', 'That was... a very bad idea. Oh no.'],
};

function who(): { id: string; body?: { setExpr(e: string, d?: number): void; showEmote(k: string, d?: number): void; react(k: string): void } } {
  const p = (game.scene as unknown as { player?: { id: string; body: { setExpr(e: string, d?: number): void; showEmote(k: string, d?: number): void; react(k: string): void } } } | null)?.player;
  return p ? { id: p.id, body: p.body } : { id: 'mori' };
}

/**
 * Eat one of an item from the backpack: restore energy, the old stew / tea buffs, and the gamble
 * on unidentified forage. Removes the item. (The backpack's Eat button and the quick-eat key call this;
 * quiet: no toast, the caller shows its own.)
 */
export function eatFood(id: string, o: { quiet?: boolean } = {}): EatResult {
  const d = ITEMS[id];
  const fi = foodInfo(id);
  const can = canEat(id);
  if (!d || !can.ok) return { ok: false, id, energy: 0, fx: 'none', reason: can.reason };
  remove(id, 1);
  if (fi.buff) game.save.buff = fi.buff;
  const fx = roll(fi);
  const res = fx10.poisonResist();
  const gain = fx === 'big' ? 0 : fi.energy;
  restore(gain);
  const m = who();
  audio.play('munch', { vol: 0.6 });
  setTimeout(() => audio.play('gulp', { vol: 0.4 }), 380);
  const icon = `<img src="${itemIconURL(id, 2)}" style="width:1.5em;height:1.5em;vertical-align:-0.35em;image-rendering:pixelated">`;
  const plus = gain > 0 ? ` · <b>+${gain}</b> energy` : '';
  if (fx === 'none') {
    m.body?.setExpr('happy', 1.4);
    m.body?.react('bounce');
    const buff = fi.buff === 'steady' ? ' · steady hands next trip' : fi.buff === 'quiet' ? ' · light feet next trip' : '';
    if (!o.quiet) game.ui.toast(`Ate ${icon} <b>${d.name}</b>${plus}${buff}`, 'FOOD', 'teal', 2600);
    if (fi.verdict === 'unknown') setTimeout(() => game.ui.bubbles.bark(m.id, pick(GAMBLE_OK), { expr: 'thinking' } as never), 500);
  } else {
    const sev = 1 - res * 0.5;
    F().sick[id] = (F().sick[id] ?? 0) + 1;
    if (fx === 'stomach') addAilment('stomach', (40 + Math.random() * 20) * sev, (fi.tox === 2 ? 26 : 16) * sev, id);
    else if (fx === 'dizzy') addAilment('dizzy', (34 + Math.random() * 16) * sev, (0.75 + Math.random() * 0.25) * sev, id);
    else {
      spend(maxEnergy() * (0.35 + Math.random() * 0.1) * sev, 'poison');
      addAilment('stomach', 25 * sev, 8 * sev, id);
      m.body?.react('shake');
      const sc = game.scene as unknown as { st?: { shake(a: number, t: number): void } } | null;
      sc?.st?.shake(2, 0.5);
      audio.play('tummy', { vol: 0.8, pitch: 0.8 });
      setTimeout(() => game.ui.bubbles.bark(m.id, '...that was everything I’d eaten today. Ugh.', { expr: 'sad' } as never), 3200);
    }
    m.body?.setExpr(fx === 'dizzy' ? 'surprised' : 'sad', 2.2);
    m.body?.showEmote(fx === 'dizzy' ? 'question' : 'sweat', 1.8);
    const what = fx === 'stomach' ? 'stomach ache' : fx === 'dizzy' ? 'dizzy' : 'violently sick';
    if (!o.quiet) game.ui.toast(`Ate ${icon} <b>${d.name}</b>${plus} · <b>${what}!</b>${fi.verdict === 'unknown' ? ' Analyse forage before you eat it.' : ''}`, 'POISON', 'coral', 4200);
    setTimeout(() => game.ui.bubbles.bark(m.id, pick(FX_LINES[fx]), { expr: fx === 'dizzy' ? 'surprised' : 'sad', emote: 'sweat' } as never), 400);
  }
  for (const f of eatenFns.slice()) { try { f(id, fx); } catch (e) { console.error(e); } }
  game.persist();
  return { ok: true, id, energy: gain, fx };
}

/** the quick-eat key: the known-safe food that best fills the gap without waste */
export function quickEat(): EatResult | null {
  const need = maxEnergy() - energy();
  const ids = [...new Set(game.save.inv.map(s => s.id))];
  const safe = ids.map(id => ({ id, fi: foodInfo(id) })).filter(x => x.fi.edible && x.fi.verdict === 'safe' && x.fi.energy > 0);
  if (need < 1) { game.ui.toast('You’re not hungry.', 'FOOD', '', 1600); return null; }
  if (!safe.length) {
    const risky = ids.some(id => foodInfo(id).verdict === 'unknown');
    audio.play('wrong', { vol: 0.4 });
    game.ui.toast(risky ? 'Nothing <b>safe</b> to eat: only unidentified forage. Open the pack (<span class="key">Tab</span>) to risk it.' : 'Nothing to eat in your pack.', 'FOOD', 'coral', 3000);
    return null;
  }
  const score = (e: number) => Math.max(0, e - need) * 1.5 + Math.max(0, need - e);
  safe.sort((a, b) => score(a.fi.energy) - score(b.fi.energy));
  return eatFood(safe[0].id);
}
