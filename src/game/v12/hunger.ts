// V12 contract: hunger replaces stamina. Mori's stomach growls (sound + a little animation) as he
// gets hungry; when he's too hungry he refuses to take photos until he eats. The loop/systems module
// owns the real implementation; this stub never gets hungry.
export function hunger(): number { return 0; }              // 0 = full .. 1 = starving
export function tooHungryForPhotos(): boolean { return false; }
export function feed(_amount: number): void { /* replaced by the systems module */ }
type GrowlFn = (level: number) => void;
const fns: GrowlFn[] = [];
export function onGrowl(fn: GrowlFn): () => void { fns.push(fn); return () => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); }; }
