import type { AppCtx } from './laptop-kit';
export function openPhotoReview(_o: { standalone?: boolean } = {}): Promise<void> { return Promise.resolve(); }
export function mountPhotoReview(container: HTMLElement, onDone?: () => void, _ctx?: AppCtx): () => void { container.innerHTML = '<div style="padding:2em">Photos</div>'; void onDone; return () => {}; }
