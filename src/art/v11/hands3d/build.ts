// Getting meshes without stalling the game: a background worker builds them (Vite inlines it, so it
// works from the single-file build too); if a worker can't start, the build runs on the main thread
// after a tick. Results are cached for the session, one per character, outfit and side.

import BuildWorker from './worker?worker&inline';
import { HandAsset, MeshData, adoptAsset, cachedAsset, handAsset } from './mesh';
import { Look, lookKey } from './looks';
import { makeRig } from './rig';

let worker: Worker | null = null;
let broken = false;
let serial = 0;
const pending = new Map<number, { look: Look; side: 'left' | 'right'; res: (a: HandAsset) => void; rej: (e: unknown) => void }>();
const inflight = new Map<string, Promise<HandAsset>>();

function getWorker(): Worker | null {
  if (worker || broken) return worker;
  try {
    worker = new BuildWorker();
    worker.onmessage = (e: MessageEvent<{ id: number; mesh?: MeshData; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.mesh) p.res(adoptAsset(p.look, p.side, makeRig(p.look.build), e.data.mesh));
      else { console.warn('[hands3d] worker build failed, building here', e.data.error); p.res(handAsset(p.look, p.side)); }
    };
    worker.onerror = ev => {
      console.warn('[hands3d] build worker unavailable, building on the main thread', ev.message);
      broken = true;
      worker?.terminate();
      worker = null;
      for (const [id, p] of pending) { pending.delete(id); setTimeout(() => p.res(handAsset(p.look, p.side)), 0); }
    };
  } catch (err) {
    console.warn('[hands3d] no worker:', err);
    broken = true;
    worker = null;
  }
  return worker;
}

/** the mesh for a look and side: cached, in flight, or started now */
export function requestAsset(look: Look, side: 'left' | 'right'): Promise<HandAsset> {
  const hit = cachedAsset(look, side);
  if (hit) return Promise.resolve(hit);
  const key = lookKey(look, side);
  const fl = inflight.get(key);
  if (fl) return fl;
  const pr = new Promise<HandAsset>((res, rej) => {
    const w = getWorker();
    if (!w) { setTimeout(() => { try { res(handAsset(look, side)); } catch (e) { rej(e); } }, 0); return; }
    const id = ++serial;
    pending.set(id, { look, side, res, rej });
    w.postMessage({ id, look, side });
  });
  inflight.set(key, pr);
  void pr.finally(() => inflight.delete(key));
  return pr;
}
