// V12 the weapon belt (the arsenal): everything Mori can drive a predator off with. Nothing here kills:
// this is a research expedition. Predators have nerve, not hit points (src/game/v11/predators-core.ts);
// every weapon costs them nerve, and some do more (a long tangle, a blinding flash, a net, a doze).
//
//   id        tool item (save.tools)  ammo (save.vars)        what it does (DeterKind)
//   sling     slingshot               v11:pebbles (15+)       Aroha's slingshot, the default ('pebble')
//   bolas     w_bolas                 v12:ammo:bolas (4)      thrown, wraps the legs: a long stun ('bolas', PredState.tangle)
//   flare     w_flare                 v12:ammo:flare (4)      one shot: a blinding flash ('flare'), then a burning flare on the
//                                                             ground, a real light, that keeps predators back while it burns ('fire')
//   bangers   w_bangers               v12:ammo:bangers (5)    a string of firecrackers, thrown: a run of bangs over an area ('banger')
//   net       w_netgun                v12:ammo:net (3)        a weighted net: holds a medium predator, slows a big one ('net',
//                                                             PredState.netted / slow)
//   tranq     w_tranq                 v12:ammo:tranq (10)     darts add drowse (PredState.drowse); past the predator's threshold it
//                                                             collapses asleep for a while ('dart', PredState.asleep; the Bearer
//                                                             needs 5, they wear off over time)
//   spray     w_spray                 v12:ammo:spray (6)      bear spray, a short cone of pepper: a strong blind up close ('spray')
//
// The API (for the story and the village boss fight):
//   WEAPONS / WEAPON_BY_ID / WEAPON_IDS        the list (sling first)
//   selectedWeapon()                           the weapon on the belt that G uses now (T cycles)
//   selectWeapon(id) / cycleWeapon(dir)        pick one (owned only)
//   ownsWeapon(id) / ownedWeapons() / ownsAnyWeapon()
//   giveWeapon(id, ammo?)                      dev / debug / rewards: the tool on the belt, ammo (default: full)
//   ammo(id) / setAmmo(id, n) / addAmmo(id, n) / ammoMax(id)
//   onBelt(fn)                                 the selection or the ammo changed (HUD)
//
// Hits are ordinary deterrence: every weapon's projectile hits ANY registered predator (registerPredator)
// and any addShootTarget target, and goes through deter() / deterArea(), so onPredator() hears it:
//   'hit'     { a, kind: 'bolas' | 'flare' | 'fire' | 'banger' | 'net' | 'dart' | 'spray', power, x }
//   'tangle'  { a, kind: 'bolas' }            the bolas wrapped its legs
//   'netted'  { a, kind: 'net', power }       a net landed on it (power 1 held, < 1 slowed)
//   'drowse'  { a, kind: 'dart', power }      a dart went in (power: drowse / threshold, 0..1)
//   'asleep'  { a, kind: 'dart' }             it went down, asleep (PredState.asleep seconds)
//   'wake'    { a }                           it woke up (it slinks off: 'break' follows)
//   'fired'   { who: 'mori', kind, x }        Mori used a weapon (the kind of the shot)
// The effects live in src/game/v12/arsenal-fx.ts (projectiles, clouds, flares, the state ticker), the
// controls in src/game/v12/arsenal-belt.ts (T cycles, G readies / draws / lets fly with the selected
// weapon, the mouse aims; touch: the weapon button and a cycle button), the sounds in arsenal-sfx.ts,
// Mori's poses and the weapons in his hands in src/art/v12/arms7.ts, the item art in
// src/art/v12/weapons.ts. Hank (src/game/v11/npcs/hank.ts) barters the weapons and their ammo.

import { game } from '../game';
import { ITEMS, defineItem } from '../items';
import { add } from '../inventory';
import { PX_ICONS } from '../../ui/pxicons';
import '../../art/v12/weapons';

export type WeaponId = 'sling' | 'bolas' | 'flare' | 'bangers' | 'net' | 'tranq' | 'spray';
export interface WeaponDef {
  id: WeaponId;
  /** the tool item on the belt (save.tools) */
  item: string;
  name: string;
  /** what it is called on the HUD button (one or two words) */
  short: string;
  /** save.vars key of the ammo */
  ammoVar: string;
  /** a full load */
  max: number;
  /** the ammo's name: one, many */
  unit: [string, string];
  /** the pixel icon (src/ui/pxicons.ts) of the weapon and of one round */
  icon: string;
  ammoIcon: string;
  /** how it is used: thrown (an arc, a wind-up), shot (a straight aim), sprayed (held) */
  use: 'throw' | 'shoot' | 'spray';
  /** seconds between shots */
  cool: number;
  desc: string;
}

export const WEAPONS: WeaponDef[] = [
  { id: 'sling', item: 'slingshot', name: 'Slingshot', short: 'Sling', ammoVar: 'v11:pebbles', max: 15, unit: ['pebble', 'pebbles'], icon: 'sling', ammoIcon: 'pebble', use: 'shoot', cool: 0.3,
    desc: 'Aroha’s slingshot. A sting on the brow sends most predators home.' },
  { id: 'bolas', item: 'w_bolas', name: 'Bolas', short: 'Bolas', ammoVar: 'v12:ammo:bolas', max: 4, unit: ['bolas', 'bolas'], icon: 'w_bolas', ammoIcon: 'w_bolas', use: 'throw', cool: 0.7,
    desc: 'Three weighted stones on braided cord. Whirl it overhead and let go: it wraps the legs and holds them a good long while.' },
  { id: 'flare', item: 'w_flare', name: 'Flare pistol', short: 'Flare', ammoVar: 'v12:ammo:flare', max: 4, unit: ['flare', 'flares'], icon: 'w_flare', ammoIcon: 'a_flare', use: 'shoot', cool: 1.2,
    desc: 'A blaze-orange marine flare gun. One shot: a blinding flash, then the flare burns on the ground, lighting the night and keeping anything with sense away from it.' },
  { id: 'bangers', item: 'w_bangers', name: 'Bear bangers', short: 'Bangers', ammoVar: 'v12:ammo:bangers', max: 5, unit: ['string', 'strings'], icon: 'w_bangers', ammoIcon: 'w_bangers', use: 'throw', cool: 0.9,
    desc: 'Strings of fat red firecrackers. Light one, throw it: a long run of bangs and smoke over the whole spot.' },
  { id: 'net', item: 'w_netgun', name: 'Net launcher', short: 'Net', ammoVar: 'v12:ammo:net', max: 3, unit: ['net', 'nets'], icon: 'w_net', ammoIcon: 'a_net', use: 'shoot', cool: 1.5,
    desc: 'A shoulder launcher that throws a weighted net. It holds a medium predator for a while and slows a big one. The net can be picked up again.' },
  { id: 'tranq', item: 'w_tranq', name: 'Tranquilliser rifle', short: 'Tranq', ammoVar: 'v12:ammo:tranq', max: 10, unit: ['dart', 'darts'], icon: 'w_tranq', ammoIcon: 'a_dart', use: 'shoot', cool: 0.9,
    desc: 'A bolt-action dart rifle with a little scope. Each dart makes a predator drowsier; enough of them and it lies down for a nap. Big ones need several, and they wear off.' },
  { id: 'spray', item: 'w_spray', name: 'Bear spray', short: 'Spray', ammoVar: 'v12:ammo:spray', max: 6, unit: ['burst', 'bursts'], icon: 'w_spray', ammoIcon: 'w_spray', use: 'spray', cool: 0.45,
    desc: 'Capsaicin in a can, with a safety clip. A short, fierce cone of pepper fog: blinding up close, useless at range. Mind the wind.' },
];
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w])) as Record<WeaponId, WeaponDef>;
export const WEAPON_IDS = WEAPONS.map(w => w.id);
/** the weapon a tool item is */
export const weaponOfItem = (item: string): WeaponDef | null => WEAPONS.find(w => w.item === item) ?? null;

// ---------------------------------------------------------------- the tools
for (const w of WEAPONS) {
  if (w.id === 'sling' || ITEMS[w.item]) continue;
  defineItem({ id: w.item, name: w.name, kind: 'tool', stack: 1, weight: w.id === 'tranq' || w.id === 'net' ? 1.6 : 0.5, desc: w.desc, where: 'Big Hank’s stall, Te Huarahi' });
}

// ---------------------------------------------------------------- owning, ammo
const V = () => game.save.vars;
export const ownsWeapon = (id: WeaponId) => game.save.tools.includes(WEAPON_BY_ID[id]?.item ?? '');
export const ownedWeapons = (): WeaponDef[] => WEAPONS.filter(w => ownsWeapon(w.id));
/** more than the slingshot on the belt (the HUD's weapon button shows then) */
export const ownsAnyWeapon = () => WEAPONS.some(w => w.id !== 'sling' && ownsWeapon(w.id));
export function ammoMax(id: WeaponId): number {
  const w = WEAPON_BY_ID[id];
  if (!w) return 0;
  return id === 'sling' ? 15 + (V()['v11:pouchBonus'] ?? 0) : w.max;
}
/** rounds left (the slingshot's pouch starts full) */
export function ammo(id: WeaponId): number {
  const w = WEAPON_BY_ID[id];
  if (!w) return 0;
  const v = V()[w.ammoVar];
  return v === undefined ? (id === 'sling' ? ammoMax('sling') : 0) : v;
}
export function setAmmo(id: WeaponId, n: number) {
  const w = WEAPON_BY_ID[id];
  if (!w) return;
  V()[w.ammoVar] = Math.max(0, Math.min(ammoMax(id), Math.round(n)));
  changed();
}
export const addAmmo = (id: WeaponId, n: number) => setAmmo(id, ammo(id) + n);

/** the weapon G uses: the one picked with T (if still owned), else the first owned, else the slingshot */
export function selectedWeapon(): WeaponId {
  const k = V()['v12:arm'];
  const own = ownedWeapons();
  if (k !== undefined && WEAPONS[k] && ownsWeapon(WEAPONS[k].id)) return WEAPONS[k].id;
  return own[0]?.id ?? 'sling';
}
export function selectWeapon(id: WeaponId): boolean {
  if (!ownsWeapon(id)) return false;
  const i = WEAPONS.findIndex(w => w.id === id);
  if (V()['v12:arm'] === i) return true;
  V()['v12:arm'] = i;
  changed();
  return true;
}
/** the next (or previous) owned weapon; returns the one now selected */
export function cycleWeapon(dir: 1 | -1 = 1): WeaponId {
  const own = ownedWeapons();
  if (!own.length) return 'sling';
  const i = own.findIndex(w => w.id === selectedWeapon());
  const next = own[(i + dir + own.length) % own.length];
  selectWeapon(next.id);
  return next.id;
}

/** put a weapon on the belt (dev / debug / quest rewards) with ammo (default: a full load) */
export function giveWeapon(id: WeaponId, ammoN?: number): boolean {
  const w = WEAPON_BY_ID[id];
  if (!w || !ITEMS[w.item]) return false;
  add(w.item, 1);
  setAmmo(id, ammoN ?? ammoMax(id));
  game.persist();
  return true;
}

type BeltFn = () => void;
const fns: BeltFn[] = [];
/** the selection or the ammo changed (returns an unsubscribe) */
export function onBelt(fn: BeltFn): () => void {
  fns.push(fn);
  return () => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); };
}
function changed() { for (const f of fns.slice()) { try { f(); } catch (e) { console.error(e); } } }

/** Hank's promise after Lily's photograph: ammo from him costs nothing, ever */
export const freeAmmo = () => !!game.save.flags['v12:hankFree'];

// ---------------------------------------------------------------- pixel icons (HUD words, the ammo count, Hank's prices)
const icons: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  // (the slingshot's own, as predators-sling.ts paints them, for screens that load before it)
  pebble: { rows: ['.ab.', 'abbc', 'bbcc', '.cd.'], pal: { a: '#e8e2d2', b: '#b4ad9c', c: '#857e70', d: '#5a554c' } },
  sling: { rows: ['a...a', 'ab.ab', '.bab.', '..b..', '..c..', '..c..', '..c..'], pal: { a: '#e8c890', b: '#b0804a', c: '#7a5432' } },
  // three leather-wrapped stones on braided cord, the knot in the middle
  w_bolas: { rows: [
    '.ab.....ab.',
    'abbc...abbc',
    '.bcc.d.bcc.',
    '..ce.d.ec..',
    '....edfe...',
    '.....f.....',
    '.....d.....',
    '....abc....',
    '...abbbc...',
    '....bcc....',
  ], pal: { a: '#f0e2c4', b: '#b89466', c: '#6e4e30', d: '#d8b878', e: '#a8844c', f: '#7a5a2a' } },
  // the blaze-orange flare gun, fat barrel, black trigger guard
  w_flare: { rows: [
    '.aaaaaaab.',
    'abbbbbbbcd',
    'bbbbbbbccd',
    '.cccee....',
    '..bbe.e...',
    '..bbbe....',
    '.bbbc.....',
    '.bccc.....',
  ], pal: { a: '#ffd090', b: '#f47a1e', c: '#b84a10', d: '#5a2008', e: '#2a2a30' } },
  // one flare cartridge: a red tube, a brass base
  a_flare: { rows: ['.aa.', 'abbc', 'abbc', 'abbc', 'abbc', 'deef', 'deef'], pal: { a: '#ff9a8a', b: '#e0302a', c: '#8a1410', d: '#fff0a0', e: '#d8a838', f: '#8a6018' } },
  // a string of fat red firecrackers on a fuse, a spark at the end
  w_bangers: { rows: [
    's.........',
    '.f........',
    '..f.......',
    '..abb.....',
    '..bbc.....',
    '...fabb...',
    '....bbcab.',
    '.....f.bbc',
    '.......bcc',
  ], pal: { s: '#fff6a0', f: '#c8a060', a: '#ff8a7a', b: '#e02a20', c: '#8a1210' } },
  // the net launcher: a stubby olive tube on a pistol grip
  w_net: { rows: [
    'abbbbbbbbc.',
    'bccccccccdd',
    'beeeeeeeedd',
    'bccccccccd.',
    '.dd.ffd....',
    '...ff.f....',
    '..fff......',
  ], pal: { a: '#b8c080', b: '#7a8a4a', c: '#4e5a2e', d: '#2a3016', e: '#c8c8a0', f: '#2a2a30' } },
  // a folded weighted net
  a_net: { rows: ['a.b.b.a', '.b.b.b.', 'b.b.b.b', '.b.b.b.', 'a.b.b.a'], pal: { a: '#9aa2aa', b: '#d8d0a0' } },
  // the dart rifle: a long barrel, the scope, a wooden stock
  w_tranq: { rows: [
    '.....aab.....',
    '....bcccd....',
    'eeeeeeeeeeeef',
    '.ggghhhhhd...',
    'ggggh.d......',
    'gggg.........',
  ], pal: { a: '#9ab8c8', b: '#2a3a48', c: '#4a5a68', d: '#1a1e24', e: '#6a7480', f: '#2a2e34', g: '#a06a3a', h: '#6a4420' } },
  // one dart: a steel needle, a yellow tuft
  a_dart: { rows: ['ab....', '.bc...', '..cc..', '...dd.', '...ded', '....ee'], pal: { a: '#ffffff', b: '#c8d0d8', c: '#7a8490', d: '#f0d040', e: '#c89810' } },
  // the bear-spray can: an orange cap, the safety clip, a black can
  w_spray: { rows: [
    '..ab..',
    '.abbc.',
    '..dd.e',
    '.ffff.',
    'fgggfh',
    'fghgfh',
    'fgggfh',
    'ffffhh',
    '.hhhh.',
  ], pal: { a: '#ffb070', b: '#f06a14', c: '#9a3a08', d: '#e8e8e0', e: '#e8e8e0', f: '#3a3a42', g: '#e8c020', h: '#16161c' } },
};
for (const [k, v] of Object.entries(icons)) if (!PX_ICONS[k]) PX_ICONS[k] = v;

// console / test helpers: zlArm.all() (every weapon, full ammo), zlArm.give('net'), zlArm.select('tranq')
try {
  (window as unknown as { zlArm?: unknown }).zlArm = {
    all: () => { for (const w of WEAPONS) giveWeapon(w.id); return ownedWeapons().map(w => `${w.id} ${ammo(w.id)}`); },
    give: (id: WeaponId, n?: number) => giveWeapon(id, n),
    select: (id: WeaponId) => selectWeapon(id),
    state: () => ({ sel: selectedWeapon(), owned: ownedWeapons().map(w => `${w.id}:${ammo(w.id)}`) }),
  };
} catch { /* */ }
