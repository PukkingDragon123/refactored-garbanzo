// V12 the Te Wao Nui region (src/game/v12/region.ts): the forest scene runs on east past its ridge into
// Fernwood Floor (world x 6000..10400) and Thunder Falls (10400..13700), one continuous walk with no
// fades. The forest's own build (./build.ts) paints the far forest, the near-back hedge and the
// foreground framing along the whole region; the two stretches lay their gameplay planes at their
// offsets (../woods/kit.ts buildWoods with a WoodsSeg), and this module adds what makes it one map:
//
//   tiers   the swing bridge over Te Kōawa (Day 2 on) and the one over the frog gully: the main path
//           crosses on the deck, the creek beds below are the low routes; the high limb between two
//           kauri in Te Kauri Nui and the auk ledges up the cliff are the high routes
//   posts   signposted crossroads at every branch (trails.ts registerPosts): up / down a tier, and
//           which way along the path the next places are
//   seams   the walk line, the canopy, the water and the place names past the forest's own end
//           (layout.ts setForestExt), the stretches' animals and insects at their offsets

import { Prop } from '../../../world/props';
import { local } from '../../assets';
import { audio } from '../../../core/audio';
import { rand, smoothstep } from '../../../core/math';
import { bigFrame } from '../../../gfx/atlas';
import { game } from '../../game';
import type { FieldSite, SpawnV2 } from '../../scenes/field';
import type { FieldScene } from '../../scenes/field';
import { FOREST, GULLY, setForestExt, fgroundY } from './layout';
import { FOREST_REGION, partAt } from '../../v12/region';
import { FW, FW_GULLY, FW_STREAM, fwBase, fwGround, fwZone, fwCanopy, buildFernwood, FERNWOOD_V11 } from '../woods/fernwood';
import { FA, POOL, LEDGES, faBase, faGround, faZone, faCanopy, buildFalls, FALLS_V11 } from '../woods/falls';
import { paintSwingBridge } from '../../../art/v12/bridge';
import { paintBranchRoad } from '../../../art/v11/woods/limb';
import { climbSpot } from '../../sites10/kit';
import { registerPosts } from '../../v12/trails';
import type { RegionPost } from '../../v12/trails';
import type { ForestScene } from './scene';

const [, FWP, FAP] = FOREST_REGION.parts;
/** where Fernwood and the falls start in the region's world x */
export const FW0 = FWP.x0, FA0 = FAP.x0;
export const REGION_W = FOREST_REGION.W;
if (FWP.w !== FW.W || FAP.w !== FA.W || FW0 !== FOREST.W) console.warn('[region] the forest region is out of step with its places');

/** the swing bridges: Te Kōawa in Te Wao Nui (world x) and the frog gully in Fernwood (local x) */
export const KOAWA = { x0: 3236, x1: 3704, sag: 9 };
export const FROG = { x0: 1790, x1: 2210, sag: 7 };
/** the high limb between the two kauri of Te Kauri Nui (Fernwood local x) and its vines */
export const LIMB = { x0: 3630, x1: 3934, up: 3668, down: 3886, rise: 112 };
const limbTop = (x: number) => {
  const t = (x - LIMB.x0) / (LIMB.x1 - LIMB.x0);
  return fwGround(LIMB.x0) - LIMB.rise + (fwGround(LIMB.x1) - fwGround(LIMB.x0)) * t - 10 * t + Math.sin(t * Math.PI) * 4 + Math.sin(x * 0.05) * 0.8;
};
/** world y of the high limb's walk at Fernwood local x */
export const limbY = (x: number) => limbTop(Math.max(LIMB.x0, Math.min(LIMB.x1, x)));

// ---------------------------------------------------------------- the seams
const near = (l: number, cx: number, w: number) => { const s = Math.abs(l - cx); return s < w + 8 ? 1 - smoothstep(w - 3, w + 8, s) : 0; };
setForestExt({
  base: x => (x < FA0 ? fwBase(x - FW0) : faBase(x - FA0)),
  ground: x => (x < FA0 ? fwGround(x - FW0) : faGround(x - FA0)),
  canopy: x => (x < FA0 ? fwCanopy(x - FW0) : faCanopy(x - FA0)),
  wet: x => {
    if (x < FA0) { const l = x - FW0; return Math.max(near(l, FW_GULLY.x, FW_GULLY.w), near(l, FW_STREAM.x, FW_STREAM.w)); }
    const l = x - FA0;
    return l > POOL.x0 + 10 && l < POOL.x1 - 10 ? 1 : 0;
  },
  zone: x => (x < FA0 ? fwZone(x - FW0) : faZone(x - FA0)),
});

// ---------------------------------------------------------------- animals and insects at their offsets
const day1 = () => !game.save.flags['v4:day1'];
const shiftSpawn = (s: SpawnV2, o: number): SpawnV2 => ({ ...s, x: [s.x[0] + o, s.x[1] + o], when: () => !day1() && (s.when?.() ?? true) });
export const REGION_SPAWNS: SpawnV2[] = [...FERNWOOD_V11.spawns.map(s => shiftSpawn(s, FW0)), ...FALLS_V11.spawns.map(s => shiftSpawn(s, FA0))];
type Ins = NonNullable<FieldSite['insects']>[number];
const shiftIns = (b: Ins, o: number): Ins => ({ ...b, x: [b.x[0] + o, b.x[1] + o] });
export const REGION_INSECTS: Ins[] = [...(FERNWOOD_V11.insects ?? []).map(b => shiftIns(b, FW0)), ...(FALLS_V11.insects ?? []).map(b => shiftIns(b, FA0))];
/** where the forest's foreground keeps clear (the stretches' story spots, crossroads, climbs), world x */
export const REGION_KEEP = [FW0 + 60, FW0 + 1180, FW0 + 1220, FW0 + FW_GULLY.x, FW0 + FROG.x0 - 20, FW0 + 2700, FW0 + LIMB.up, FW0 + 4060, FW0 + 4360, FA0 + 560, FA0 + 620, FA0 + 640, FA0 + 1390, FA0 + 1460, FA0 + 1800, FA0 + 2660];
/** where nothing hangs into the top of the frame (the camera climbs the cliff ledges), world x */
export const REGION_HANG_SKIP: [number, number][] = [[FW0 + 3560, FW0 + 3980], [FA0 + 1700, FA0 + 3400]];

// ---------------------------------------------------------------- building the stretches
/** the terrain cuts the forest's own floor needs (the Te Kōawa bridge's ends, from Day 2) */
export const forestCuts = (f: ForestScene) => (f.day1 ? [] : [KOAWA.x0, KOAWA.x1]);

export function buildRegion(f: ForestScene) {
  const st = f.st;
  const fw = buildFernwood(f, { ox: FW0, clock: f.clock, main: f.main, cuts: [FROG.x0, FROG.x1] });
  const fa = buildFalls(f, { ox: FA0, clock: f.clock, main: f.main });
  f.hidesPending.push(...fw.hides, ...fa.hides);
  // ---- the swing bridges: the main path crosses on the deck, the gully below is the low route
  const bridge = (key: string, x0: number, x1: number, sag: number, G: (x: number) => number, seed: number) => {
    const len = x1 - x0;
    const sb = paintSwingBridge(len, sag, seed);
    const y0 = G(x0) - 1, y1 = G(x1) - 1;
    const fr = local.add('v12br:' + key, sb.buf, sb.ax, sb.ay);
    f.main.add(new Prop(fr, x0, y0, -1.2));
    const pts: [number, number][] = [];
    for (let x = 0; x <= len; x += 6) pts.push([x0 + x, y0 + (y1 - y0) * (x / len) + sb.deck(x)]);
    if (pts[pts.length - 1][0] < x1) pts.push([x1, y1]);
    st.terrain.addPlatform(pts, 'bridge');
    f.pois.push({ kind: 'perch', x: x0 + len * 0.3, y: y0 - 18 }, { kind: 'perch', x: x0 + len * 0.7, y: y1 - 18 });
  };
  if (!f.day1) bridge('koawa', KOAWA.x0, KOAWA.x1, KOAWA.sag, fgroundY, 4411);
  bridge('frog', FW0 + FROG.x0, FW0 + FROG.x1, FROG.sag, x => fwGround(x - FW0), 4421);
  // ---- the high limb: a road of branch between the two kauri, up a vine and down another
  {
    const ch = paintBranchRoad(LIMB.x0 - 14, LIMB.x1 - LIMB.x0 + 28, limbY, x => 21 + 12 * Math.max(0, 1 - Math.min(x - LIMB.x0, LIMB.x1 - x) / 80) + Math.sin(x * 0.09) * 1.5, 4431);
    const fr = bigFrame(game.r, ch.buf);
    f.main.add(new Prop({ ...fr, ax: 0, ay: 0 }, FW0 + ch.x0, ch.y0, -6.6));
    const pts: [number, number][] = [];
    for (let x = LIMB.x0; x <= LIMB.x1; x += 6) pts.push([FW0 + x, limbY(x)]);
    st.terrain.addPlatform(pts, 'branch');
    climbSpot(f, FW0 + LIMB.up, limbY(LIMB.up), fwGround(LIMB.up), 'vine', 'Climb the vine up to the high limb', 'Climb down the vine to the forest floor');
    climbSpot(f, FW0 + LIMB.down, limbY(LIMB.down), fwGround(LIMB.down), 'vine', 'Climb the vine up to the high limb', 'Climb down the vine to the forest floor');
    for (const x of [3700, 3800]) f.pois.push({ kind: 'perch', x: FW0 + x, y: limbY(x) - 2 }, { kind: 'branch', x: FW0 + x + 30, y: limbY(x + 30) });
  }
  // ---- the crossroads
  registerPosts(f, posts(f));
}

// ---------------------------------------------------------------- the crossroads' planks
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/** up a climb from the floor at x (a vine, a rope) */
async function climbUp(f: FieldScene, x: number, yTop: number, yBot: number) {
  const p = f.player;
  await Promise.race([p.walkTo(x, 60), sleep(4000)]);
  if (Math.abs(p.x - x) > 10 || Math.abs(p.y - yBot) > 14) return;
  await f.climbLadder({ x, y0: yTop, y1: yBot }, -1);
}
/** off the path and down into a gully: past the bridge's end the deck is let go of and Mori scrambles
 *  down the bank instead */
async function downInto(f: FieldScene, edge: number, to: number) {
  const p = f.player;
  await Promise.race([p.walkTo(edge - 5, 60), sleep(4000)]);
  p.dropT = 0.9;
  void floatTextSoon('Down the bank. Carefully...');
  await Promise.race([p.walkTo(to, 46), sleep(6000)]);
}
function floatTextSoon(text: string) { return import('../../../ui/v12/float').then(m => m.floatText({ text, style: 'think', ms: 2000 })); }

function posts(f: ForestScene): RegionPost[] {
  const out: RegionPost[] = [];
  // Te Kōawa: the bridge over the gully (on Day 1 the walk goes down into it, where Joshu is)
  if (!f.day1) out.push({ x: KOAWA.x0 - 36, arms: [
    { info: 'THE STREAM', go: 1000, dir: 'left' },
    { tier: 'TE KŌAWA CREEK', mark: 'down', dir: 'right', label: 'Down into the gully, along Te Kōawa creek <span style="opacity:.75">· the low way</span>', go: fs => downInto(fs, KOAWA.x0, GULLY.x - 40) },
    { info: 'TE URU RĀTĀ', go: KOAWA.x1 + 120, dir: 'right' },
  ] });
  // the ridge: Te Wao Nui behind, Fernwood ahead (the trails up to the hills and down to the bush
  // track join this post: trails.ts)
  out.push({ x: FW0, arms: [{ info: 'TE WAO NUI', go: FW0 - 400, dir: 'left' }, { info: 'FERNWOOD', go: FW0 + 420, dir: 'right' }] });
  // the frog gully
  out.push({ x: FW0 + FROG.x0 - 34, arms: [
    { info: 'TE PAE', go: FW0 + 900, dir: 'left' },
    { tier: 'THE FROG POOL', mark: 'down', dir: 'right', label: 'Down the bank to the frog pool <span style="opacity:.75">· the low way</span>', go: fs => downInto(fs, FW0 + FROG.x0, FW0 + FW_GULLY.x + 40) },
    { info: 'NGĀ MAMAKU', go: FW0 + FROG.x1 + 160, dir: 'right' },
  ] });
  // the high limb
  out.push({ x: FW0 + LIMB.x0 - 34, arms: [
    { tier: 'THE HIGH LIMB', mark: 'up', dir: 'right', label: 'Climb the vine to the high limb <span style="opacity:.75">· the high way</span>', go: fs => climbUp(fs, FW0 + LIMB.up, limbY(LIMB.up), fwGround(LIMB.up)) },
    { info: 'TE PAE', go: FW0 + 2900, dir: 'left' },
  ] });
  // the giant kauri: the canopy climb (trails.ts) and the way on to the falls
  out.push({ x: FW0 + 4110, arms: [{ info: 'THE FALLS', go: FA0 + 260, dir: 'right' }] });
  // the goat track up to the tops (trails.ts) and the falls
  out.push({ x: FA0 + 620, arms: [{ info: 'FERNWOOD', go: FA0 - 300, dir: 'left' }, { info: 'THE FALLS', go: FA0 + 1100, dir: 'right' }] });
  // the cliff: the ropes up the auk ledges
  out.push({ x: FA0 + 1800, arms: [
    { tier: 'THE AUK LEDGES', mark: 'up', dir: 'right', label: 'Climb the rope up the cliff to the auk ledges <span style="opacity:.75">· the high way</span>', go: fs => climbUp(fs, FA0 + 1850, LEDGES[0][2], faGround(1850)) },
    { info: 'THE POOL', go: FA0 + 1450, dir: 'left' },
  ] });
  return out;
}

// ---------------------------------------------------------------- every frame
const state = new WeakMap<ForestScene, { part: string; wadeT: number }>();
/** the region's own per-frame bits: the falls' roar as you come to them, splashing across the pool,
 *  and on Day 1 the walk ends at the ridge */
export function regionTick(f: ForestScene, dt: number) {
  const p = f.player;
  if (!p) return;
  let s = state.get(f);
  if (!s) { s = { part: '', wadeT: 0 }; state.set(f, s); }
  const part = partAt(FOREST_REGION, p.x).loc;
  if (part !== s.part) {
    s.part = part;
    audio.setAmbience(part === 'falls' ? 'falls' : 'forest', f.night);
  }
  // wading the rock bar across the plunge pool
  const l = p.x - FA0;
  if (l > POOL.x0 + 10 && l < POOL.x1 - 10 && p.onGround && Math.abs(p.y - faGround(l)) < 4) {
    s.wadeT -= dt * Math.abs(p.vx) / 40;
    if (s.wadeT <= 0 && Math.abs(p.vx) > 8) { s.wadeT = 0.5; f.splash(p.x, faGround(l) - 1, 0.4); }
  }
  void rand;
}
