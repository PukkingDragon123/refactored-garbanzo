// Paints the Region Map off the main thread (regionmap-art.ts starts it): the parchment first, posted
// as soon as it is ready so the sheet can unroll, then the diorama; the typed arrays are handed back.
import { buildPaper, buildArt, T } from './paint';
import { setNoYield } from './kit';

const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown, t?: Transferable[]): void };
ctx.onmessage = async () => {
  try {
    setNoYield(true);
    const paper = await buildPaper();
    ctx.postMessage({ type: 'paper', paper: paper.slice() });
    const { art, lift } = await buildArt(paper);
    ctx.postMessage({ type: 'art', art, lift, T }, [art.paper.buffer, art.color.buffer, art.ink.buffer, art.land.buffer, art.coast.buffer, art.water.buffer, art.flow.buffer, art.tag.buffer, art.kind.buffer, lift.buffer]);
  } catch (err) {
    ctx.postMessage({ type: 'error', error: String((err as Error)?.stack ?? err) });
  }
};
