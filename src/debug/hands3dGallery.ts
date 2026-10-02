// ?gallery=hands3d: the 3D hands on a studio backdrop. Pick the character, outfit, side, pose, lights,
// view and pixelation; drag to move the hand (IK follows), wheel to change depth. URL parameters set the
// starting state so screenshots are repeatable:
//   who=mori|jenna|joshu|aroha|all  side=right|left|both  pose=<name>  view=back|palm|side|grip|down
//   lights=<preset>  pixel=0|2|3|4  outline=0|1  outfit=casual|winter|storm  bg=%23rrggbb  t=<seconds to run first>
//   demo=1 (cycle through the poses)  scale=<px per cm>

import { mountHands3d, HandsController, Hand, LIGHTS, PoseName, Who } from '../art/v11/hands3d';

const POSES: PoseName[] = ['relaxed', 'open', 'spread', 'fist', 'grip', 'pinch', 'point', 'press', 'cup', 'pullCord', 'crank', 'knot', 'tap', 'wave', 'hook', 'hold', 'thumbsUp'];
const WHO: Who[] = ['mori', 'jenna', 'joshu', 'aroha'];

export async function hands3dGallery() {
  const q = new URLSearchParams(location.search);
  document.body.innerHTML = '';
  const bg = q.get('bg') ?? '#d9d9d9';
  document.body.style.cssText = `margin:0;background:radial-gradient(ellipse at 50% 40%, ${bg} 0%, #b8b8b8 100%);overflow:hidden;font:12px monospace;color:#222;`;
  const stage = document.createElement('div');
  stage.style.cssText = 'position:fixed;inset:0;';
  document.body.appendChild(stage);
  const W = window.innerWidth, H = window.innerHeight;
  const whoQ = q.get('who') ?? 'mori';
  const sideQ = (q.get('side') ?? 'right') as 'right' | 'left' | 'both';
  const view = q.get('view') ?? 'back';
  const pixel = +(q.get('pixel') ?? 0);
  const scale = +(q.get('scale') ?? H / 26);
  let ctl: HandsController;
  const all = whoQ === 'all';
  ctl = mountHands3d(stage, {
    who: all ? 'mori' : (whoQ as Who), side: all ? 'right' : sideQ, grid: [W, H], scale: all ? H / 40 : scale, pixel,
    lights: q.get('lights') ?? 'studio', outline: +(q.get('outline') ?? 0), outfit: q.get('outfit') ?? undefined,
  });
  if (all) for (const w of WHO.slice(1)) await ctl.add({ who: w, side: 'right', outfit: q.get('outfit') ?? undefined });
  await ctl.ready;
  await Promise.all(ctl.hands.map(h => new Promise<void>(r => { const chk = () => (h.asset ? r() : setTimeout(chk, 50)); chk(); })));
  const hands = ctl.hands;
  ctl.plane(-90, 0.28, 0.25, '#202020');
  const place = (h: Hand, i: number, n: number, x = 0, y = 0, z = 0) => {
    const cx = n > 1 ? W * (0.16 + 0.68 * (i / (n - 1))) : h.side === 'left' && sideQ === 'both' ? W * 0.3 : sideQ === 'both' ? W * 0.7 : W * 0.5;
    const cy = H * 0.42;
    h.shoulderAt(cx + (h.side === 'left' ? -W * 0.04 : W * 0.04), H * 1.9, 30);
    const dirs: Record<string, [number[], number[]]> = {
      back: [[0, -1, 0], [0, 0.05, -1]],
      palm: [[0, -1, 0], [0, 0.05, 1]],
      side: [[0, -1, 0], [h.side === 'left' ? 1 : -1, 0, 0.15]],
      grip: [[h.side === 'left' ? 1 : -1, -0.25, 0.2], [0, 1, 0.1]],
      down: [[h.side === 'left' ? 0.3 : -0.3, 0.1, -1], [0, 1, 0]],
    };
    const [f, p] = dirs[view] ?? dirs.back;
    h.reachTo(cx + x, cy + y, 40 + z, { with: 'palm', fingers: f as [number, number, number], palm: p as [number, number, number] });
  };
  hands.forEach((h, i) => { place(h, i, hands.length); h.setPose((q.get('pose') ?? 'relaxed') as PoseName); h.snap(); });
  // ---- controls
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:8px;top:8px;display:flex;flex-wrap:wrap;gap:4px;max-width:96vw;z-index:5';
  document.body.appendChild(bar);
  const btn = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'font:11px monospace;padding:2px 6px;background:#f4f4f4;border:1px solid #888;cursor:pointer'; b.onclick = fn; bar.appendChild(b); return b; };
  for (const p of POSES) btn(p, () => hands.forEach(h => h.setPose(p)));
  for (const l of Object.keys(LIGHTS)) btn('☀' + l, () => ctl.setLights(l));
  btn('reload as …', () => { const w = prompt('who (mori jenna joshu aroha all)', whoQ); if (w) { q.set('who', w); location.search = q.toString(); } });
  const info = document.createElement('div');
  info.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:5;background:rgba(255,255,255,0.7);padding:3px 6px';
  document.body.appendChild(info);
  info.textContent = hands.map(h => `${h.who} ${h.side}: ${h.asset?.mesh.nv} verts, ${(h.asset?.mesh.ni ?? 0) / 3 | 0} tris, built in ${h.asset?.mesh.ms.toFixed(0)} ms`).join(' · ');
  // drag to move, wheel for depth
  let drag = false, ox = 0, oy = 0, oz = 0;
  stage.style.pointerEvents = 'auto';
  stage.onpointerdown = e => { drag = true; stage.setPointerCapture(e.pointerId); };
  stage.onpointerup = () => { drag = false; };
  stage.onpointermove = e => { if (!drag) return; ox += e.movementX; oy += e.movementY; hands.forEach((h, i) => place(h, i, hands.length, ox, oy, oz)); };
  stage.onwheel = e => { oz -= e.deltaY * 0.2; hands.forEach((h, i) => place(h, i, hands.length, ox, oy, oz)); };
  // ---- run
  const demo = q.get('demo') === '1';
  let pi = 0, demoT = 0;
  const pre = +(q.get('t') ?? 0.8);
  for (let t = 0; t < pre; t += 1 / 60) ctl.update(1 / 60);
  if (q.get('still') === '1') {
    // one frame only (headless screenshots under a software GPU)
    const t0 = performance.now();
    ctl.frame(1 / 60);
    ctl.renderer?.gl.finish();
    const ms = performance.now() - t0;
    info.textContent += ` · frame ${ms.toFixed(0)} ms`;
    (window as unknown as { __hands: unknown }).__hands = { ctl, hands, place, ms };
    document.title = 'ready';
    return;
  }
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (demo) { demoT += dt; if (demoT > 1.6) { demoT = 0; pi = (pi + 1) % POSES.length; hands.forEach(h => h.setPose(POSES[pi])); } }
    ctl.frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  (window as unknown as { __hands: unknown }).__hands = { ctl, hands, place };
}
