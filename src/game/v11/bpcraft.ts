// V11 Blueprints: crafting, research and the bits of play around the sheets (see ./blueprints.ts).
//
//   bpState(id)          'locked' (not owned, quest / find only) | 'research' (can be researched) |
//                        'lab' (being researched) | 'craft' (owned, waiting to be made) | 'done'
//   craftBlockers(id)    why it can't be made right now ([] = go); missing materials are listed apart
//   craft(id)            use up the materials, make the thing (tool to the belt, the rest to the pack)
//   startResearch(id)    pay the RP; the agency's R&D office works on it overnight (one at a time)
//   labStatus()          what is in research and when it arrives
//
// Also here: Aroha hands back the shaped mānuka fork with her slingshot sheet, research results arrive
// in the morning, smoke balls can be thrown from the pack, and the slingshot pouch / fishing line read
// what has been crafted.

import { game } from '../game';
import { ITEMS } from '../items';
import { count, remove, give, add } from '../inventory';
import { BLUEPRINTS, bpSave, hasBlueprint, isActive, isBuilt, grantBlueprint, markMade, onBlueprint, onMade, timesMade } from './blueprints';
import type { BlueprintDef } from './blueprints';
import './bpdata';
import { dayNumber, onNewDay } from '../v10/day';

export type BpState = 'locked' | 'research' | 'lab' | 'craft' | 'done';
const B = (id: string): BlueprintDef | undefined => BLUEPRINTS[id];
const nameOf = (id: string) => B(id)?.name ?? id;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** nights a research takes */
export const researchNights = (d: BlueprintDef) => Math.max(1, Math.ceil((d.hours ?? 8) / 24));

export function bpState(id: string): BpState {
  const d = B(id);
  if (!d) return 'locked';
  if (bpSave().lab?.id === id && !hasBlueprint(id)) return 'lab';
  if (!hasBlueprint(id)) return d.rp ? 'research' : 'locked';
  if (!d.needs?.length) return 'done';
  if (d.repeat) return 'craft';
  return isBuilt(id) ? 'done' : 'craft';
}

/** req blueprints still missing (owned for research, built for crafting) */
export function reqMissing(id: string, built: boolean): string[] {
  return (B(id)?.req ?? []).filter(r => (built ? !isActive(r) : !hasBlueprint(r)));
}

/** why it can't be researched now (empty = it can) */
export function researchBlockers(id: string): string[] {
  const d = B(id);
  if (!d || !d.rp) return ['Can’t be researched'];
  if (hasBlueprint(id)) return ['Already yours'];
  const out: string[] = [];
  const lab = bpSave().lab;
  if (lab && lab.id !== id) out.push(`The lab is busy with ${nameOf(lab.id)}`);
  if (lab?.id === id) out.push('In research');
  const m = reqMissing(id, false);
  if (m.length) out.push(`First: ${m.map(nameOf).join(' & ')}`);
  const g = d.gate?.();
  if (g) out.push(g);
  if ((game.save.rp ?? 0) < d.rp) out.push(`Needs ${d.rp} RP`);
  return out;
}

/** materials still short: [item, have, need] */
export function missingMaterials(id: string): [string, number, number][] {
  return (B(id)?.needs ?? []).map(([it, n]) => [it, count(it), n] as [string, number, number]).filter(([, h, n]) => h < n);
}

/** why it can't be crafted now, apart from materials (empty = only materials matter) */
export function craftBlockers(id: string): string[] {
  const d = B(id);
  if (!d) return ['Unknown'];
  if (!hasBlueprint(id)) return ['You don’t have this blueprint'];
  if (!d.needs?.length) return ['Nothing to make: it works already'];
  if (!d.repeat && isBuilt(id)) return ['Already made'];
  const out: string[] = [];
  const m = reqMissing(id, true);
  if (m.length) out.push(`Make ${m.map(nameOf).join(' & ')} first`);
  const g = d.gate?.();
  if (g) out.push(g);
  const o = d.out;
  if (o && ITEMS[o[0]]?.kind === 'tool' && game.save.tools.includes(o[0]) && !d.repeat) out.push('You already have one');
  return out;
}
export const canCraft = (id: string) => !craftBlockers(id).length && !missingMaterials(id).length;

type CraftFn = (id: string) => void;
const craftFns: CraftFn[] = [];
/** called after the crafting moment (the bench scene, HUD refreshes) */
export function onCrafted(fn: CraftFn) { craftFns.push(fn); }

/** use up the materials and make it; false if it can't be made */
export function craft(id: string): boolean {
  if (!canCraft(id)) return false;
  const d = B(id)!;
  for (const [it, n] of d.needs ?? []) remove(it, n);
  if (d.out) {
    const [it, n] = d.out;
    if (ITEMS[it]?.kind === 'tool') add(it, 1); else give(it, n);
  }
  if (d.chain?.[0] === 'translator') game.save.vars['v10:translator'] = Math.max(game.save.vars['v10:translator'] ?? 0, d.chain[1] + 1);
  if (d.chain) game.save.flags[`v10:gear:${d.chain[0]}:${d.chain[1]}`] = true;
  if (id === 'slingshot' && game.save.vars['v11:pebbles'] === undefined) game.save.vars['v11:pebbles'] = 15;
  game.save.vars['crafted'] = (game.save.vars['crafted'] ?? 0) + 1;
  markMade(id);
  syncVars();
  for (const f of craftFns.slice()) { try { f(id); } catch (e) { console.error(e); } }
  return true;
}

// ---------------------------------------------------------------- research

export function labStatus(): { id: string; ready: number; nights: number; due: boolean } | null {
  const lab = bpSave().lab;
  if (!lab || !B(lab.id)) return null;
  const left = lab.ready - dayNumber();
  return { id: lab.id, ready: lab.ready, nights: Math.max(0, left), due: left <= 0 };
}

/** pay the RP and send the request to the agency's R&D office */
export function startResearch(id: string): boolean {
  if (researchBlockers(id).length) return false;
  const d = B(id)!;
  game.save.rp -= d.rp!;
  bpSave().lab = { id, day: dayNumber(), ready: dayNumber() + researchNights(d) };
  game.persist();
  return true;
}

/** the research arrives once its morning has come (force: now, for testing). Returns the id. */
export function finishResearch(force = false): string | null {
  const st = labStatus();
  if (!st || (!st.due && !force)) return null;
  bpSave().lab = null;
  grantBlueprint(st.id, 'research');
  return st.id;
}

// ---------------------------------------------------------------- things that read what was made

/** save vars other modules read without importing this one */
export function syncVars() {
  const v = game.save.vars;
  const pouch = isActive('pebble_pouch') ? 10 : 0;
  if ((v['v11:pouchBonus'] ?? 0) !== pouch) v['v11:pouchBonus'] = pouch;
}
/** how many times each repeatable recipe has been made (for the sheet) */
export const madeCount = timesMade;

let inited = false;
export function initBlueprints() {
  if (inited) return;
  inited = true;
  syncVars();
  onMade(() => syncVars());
  onBlueprint((id, from) => {
    syncVars();
    // Aroha hands the shaped fork back with her sketch
    if (id === 'slingshot' && from.startsWith('quest') && !count('manuka_fork') && !isBuilt('slingshot')) give('manuka_fork', 1);
  });
  // an old save that got the sheet before the fork was an item
  setTimeout(() => {
    try {
      if (hasBlueprint('slingshot') && !isBuilt('slingshot') && !count('manuka_fork') && !game.save.tools.includes('slingshot') && game.save.flags['aroha:fork']) add('manuka_fork', 1);
    } catch { /* no save yet */ }
  }, 0);
  // research arrives in the morning
  onNewDay(() => {
    const id = finishResearch();
    if (id) setTimeout(() => game.ui.toast(`The agency’s R&D office faxed a new blueprint overnight: <b>${esc(nameOf(id))}</b>. Craft it at Jenna’s bench.`, 'BLUEPRINT', 'teal', 6500), 1500);
  });
  // the fishing line holds better with a braided line and the Kittiwake reel
  void import('../../ui/v6/fishfight').then(m => { m.fightTune.lineK = () => (isActive('fishing_reel') ? 2 : isActive('braided_line') ? 1.5 : 1); }).catch(() => {});
  // smoke balls: thrown from the pack (in the field) at whatever is coming
  void import('../../ui/v11/backpack').then(m => m.registerItemUse('smoke_bomb', 'Throw', () => throwSmoke())).catch(() => {});
}

/** throw a smoke ball ahead of Mori: the predators module bursts it into a cloud */
async function throwSmoke() {
  const s = game.scene as unknown as { player?: { x: number; y: number; facing: number }; site?: unknown } | null;
  const p = s?.player;
  if (!p || !s?.site) { game.ui.toast('Save it for the bush. Smoke balls are for things that bite.', 'SMOKE', 'coral', 3200); return; }
  const ps = await import('./predators-scene');
  const ctl = ps.predatorsOf(s as never) as unknown as { fx?: { throwGrenade(x: number, y: number, vx: number, vy: number, kind: string, owner?: string): void } } | null;
  if (!ctl?.fx) { game.ui.toast('Nothing to throw it at here.', 'SMOKE', 'coral', 2600); return; }
  if (!remove('smoke_bomb', 1)) return;
  ctl.fx.throwGrenade(p.x + p.facing * 6, p.y - 22, p.facing * 170, -150, 'smoke', 'mori');
  game.ui.toast('Smoke ball away! Back off while it can’t see.', 'SMOKE', 'teal', 2600);
}

/** dev / tests: own and build everything, or the given ids */
export function devAllBlueprints(ids: string[] = Object.keys(BLUEPRINTS), build = true) {
  const b = bpSave();
  for (const id of ids) {
    if (!B(id)) continue;
    if (!b.owned[id]) b.owned[id] = { from: 'dev', t: Date.now() };
    if (build && B(id)!.needs?.length && !b.made[id]) b.made[id] = 1;
  }
  syncVars();
  game.persist();
}
/** dev / tests: every material the sheets use, n of each */
export function devMaterials(n = 6) {
  const all = new Set<string>();
  for (const d of Object.values(BLUEPRINTS)) for (const [it] of d.needs ?? []) all.add(it);
  for (const it of all) add(it, n);
}
