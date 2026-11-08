// V12 the raid's handle on Matikuku Nui: a small adapter over the creature (src/game/v12/feud: spawnBearer,
// bearerScript) so the fight in ./fight.ts can script it: walk it, play an act and wait for it to end,
// read its nerve and whether it sleeps. The scripted Bearer doesn't react to hits by itself, so this
// listens to the predator events: a hard hit makes it flinch (interrupting a wind-up), the bolas and the
// net hold or slow it, the darts put it to sleep (src/game/v12/arsenal.ts).

import type { FieldScene } from '../../scenes/field';
import type { Animal } from '../../wild/animal';

export type BearerAct = 'idle' | 'walk' | 'threat' | 'swipe' | 'smash' | 'roar' | 'charge' | 'flinch' | 'stunned' | 'sleep' | 'retreat' | 'pin';

export interface BearerCtl {
  readonly x: number;
  readonly y: number;
  readonly facing: 1 | -1;
  readonly a: Animal;
  faceTo(x: number): void;
  /** its nerve left, 0..1 */
  nerve(): number;
  /** tranquillised to sleep */
  asleep(): boolean;
  /** flinching, stunned, tangled or netted: not acting on its own will */
  stunned(): boolean;
  /** play an act for about `secs` (or its natural length); resolves when it ends */
  act(name: BearerAct, secs?: number): Promise<void>;
  /** walk or run toward x at `speed` px/s; resolves true on arrival, false if interrupted */
  moveTo(x: number, speed: number): Promise<boolean>;
  remove(): void;
}

/** the fight's acts as the Bearer's animations (the tells: windup before a swipe, nose low before a charge) */
const ANIM: Record<BearerAct, string> = {
  idle: 'idle', walk: 'walk', threat: 'windup', swipe: 'swipe', smash: 'smash', roar: 'roar', charge: 'sniff',
  flinch: 'flinch', stunned: 'stunned', sleep: 'sleep', retreat: 'retreat', pin: 'pin',
};

/** spawn the Bearer at x, under the raid's control (null if the creature module is missing) */
export async function makeBearer(f: FieldScene, x: number): Promise<BearerCtl | null> {
  try {
    const D = await import('../feud/director');
    const P = await import('../../v11/predators-core');
    const a = D.spawnBearer(f, x, { facing: -1 });
    const sc = D.bearerScript(a);
    sc.facing = -1;
    const st = P.predState(a);
    const max = P.PREDATORS[a.species]?.nerve ?? 10;
    st.nerve = max;
    let flinchUntil = 0;
    const now = () => performance.now() / 1000;
    // a hard hit: it flinches (a wind-up it was in is cut short); the darts' sleep is the fight's ending
    const off = P.onPredator((ev, info) => {
      if (info?.a !== a || st.asleep > 0) return;
      if (ev === 'hit' && (info.power ?? 0) >= 0.8 && now() > flinchUntil) {
        flinchUntil = now() + 0.55;
        void sc.act('flinch');
      }
      if (ev === 'tangle' || (ev === 'netted' && (info.power ?? 0) >= 1)) { flinchUntil = now() + 1.6; void sc.act('stunned', { secs: 1.6 }); }
    });
    let gone = false;
    const ctl: BearerCtl = {
      a,
      get x() { return a.x; },
      get y() { return a.y; },
      get facing() { return sc.facing; },
      faceTo(tx: number) { sc.facing = tx < a.x ? -1 : 1; },
      nerve: () => Math.max(0, Math.min(1, st.nerve / max)),
      asleep: () => st.asleep > 0,
      stunned: () => now() < flinchUntil || st.stun > 0 || st.tangle > 0 || st.asleep > 0,
      async act(name, secs) {
        if (gone) return;
        await sc.act(ANIM[name] as never, secs !== undefined ? { secs } : {});
      },
      async moveTo(tx, speed) {
        if (gone) return false;
        // the net slows it right down; tangled it doesn't go anywhere
        const k = st.slow > 0 ? 0.45 : 1;
        if (st.tangle > 0) return false;
        await sc.walkTo(tx, { run: speed > 90, speed: speed * k });
        return Math.abs(a.x - tx) < 6;
      },
      remove() {
        if (gone) return;
        gone = true;
        off();
        sc.release();
        a.gone = true;
      },
    };
    return ctl;
  } catch (e) {
    console.warn('[raid] no Bearer', e);
    return null;
  }
}
