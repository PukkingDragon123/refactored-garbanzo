// V2 people: body frame renderer (pose → back/front buffers with anchors).

import { PixelBuffer } from './pixel';
import { Canvas, Pose, solve, finish, trimPair, PropP } from './people-rig';
import { CharDef, CharId, Ctx, drawArm, drawLeg, drawNeck, drawTorso, B } from './people-parts';
import { drawProp } from './people-props';

export interface BodyFrame {
  back: PixelBuffer;
  front: PixelBuffer | null;
  ax: number;
  ay: number;
  hx: number;
  hy: number;
  look?: 'fwd' | 'up' | 'down';
  hand?: [number, number];
  headBehind?: boolean;
}

const CW = 160, CH = 150, OX = 80, OY = 116;

export function paintBody(ch: CharDef, pose: Pose, anim: string, t: number): BodyFrame {
  const c = new Canvas(CW, CH, OX, OY);
  const J = solve(ch.build, pose);
  const x: Ctx = { c, J, P: pose, b: ch.build, ch, anim, t };
  const front = new Set(pose.front ?? []);
  const props = pose.props ?? [];
  const drawProps = (z: PropP['z']) => {
    for (const p of props) {
      if ((p.z ?? 'hand') !== z) continue;
      c.useFront(!!p.front);
      drawProp(x, p);
      c.useFront(false);
    }
  };
  const arm = (nearArm: boolean) => {
    c.useFront(front.has(nearArm ? 'armF' : 'armB'));
    drawArm(x, nearArm);
    c.useFront(false);
  };

  ch.behind?.(x);
  drawProps('back');
  if (!pose.armBFwd) arm(false);
  if (!pose.legBFwd) drawLeg(x, false);
  if (!pose.legFwd) drawLeg(x, true);
  ch.afterLegs?.(x);
  drawNeck(x);
  drawTorso(x);
  ch.afterTorso?.(x);
  if (pose.legBFwd) drawLeg(x, false);
  if (pose.legFwd) drawLeg(x, true);
  drawProps('mid');
  if (pose.armBFwd) arm(false);
  ch.beforeArmF?.(x);
  arm(true);
  ch.afterArmF?.(x);
  drawProps('hand');
  drawProps('top');

  finish(c.back);
  let fr: PixelBuffer | null = c.front;
  if (fr) {
    let any = false;
    for (let i = 0; i < fr.data.length; i++) if (fr.data[i] >>> 24) { any = true; break; }
    if (any) finish(fr);
    else fr = null;
  }
  const tr = trimPair(c.back, fr, 1);
  const nt = B(c, J.neckTop);
  const hw = B(c, J.wrF);
  return {
    back: tr.a,
    front: tr.b,
    ax: OX - tr.ox,
    ay: OY - tr.oy,
    hx: Math.round(nt[0]) - tr.ox,
    hy: Math.round(nt[1]) - tr.oy,
    look: pose.look,
    hand: [Math.round(hw[0]) - tr.ox, Math.round(hw[1]) - tr.oy],
    headBehind: pose.headBehind || undefined,
  };
}

export type { CharId };
