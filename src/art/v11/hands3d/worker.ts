// Builds hand meshes off the main thread (sculpt, polygonize, bake) and hands the typed arrays back.
import { buildAssetUncached } from './mesh';
import type { Look } from './looks';

interface Req { id: number; look: Look; side: 'left' | 'right' }
const ctx = self as unknown as { onmessage: ((e: MessageEvent<Req>) => void) | null; postMessage(m: unknown, t?: Transferable[]): void };
ctx.onmessage = (e: MessageEvent<Req>) => {
  const { id, look, side } = e.data;
  try {
    const m = buildAssetUncached(look, side).mesh;
    ctx.postMessage({ id, mesh: m }, [m.pos.buffer, m.nrm.buffer, m.bones.buffer, m.wts.buffer, m.det.buffer, m.bake.buffer, m.idx.buffer]);
  } catch (err) {
    ctx.postMessage({ id, error: String((err as Error)?.stack ?? err) });
  }
};
