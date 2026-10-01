// V10 expedition body: energy, backpack weight and the blackout. (Contract stub: the systems
// module fills this in; other modules only call these functions.)

/** current energy 0..maxEnergy() */
export function energy(): number { return 100; }
export function maxEnergy(): number { return 100; }
/** spend energy (walking, sprinting, climbing, swimming, poison...); reaching 0 fires the blackout */
export function spend(n: number, why = ''): void { void n; void why; }
export function restore(n: number): void { void n; }
/** refill at the start of each day (sleep) */
export function refill(): void {}
/** carried weight in kg, the pack's comfortable capacity, and 0..1+ encumbrance */
export function packWeight(): number { return 0; }
export function packCapacity(): number { return 12; }
export function encumbrance(): number { return 0; }
type BlackoutFn = () => void;
const blackoutFns: BlackoutFn[] = [];
/** called once when energy hits 0 during an expedition (the camp module plays the carry-home) */
export function onBlackout(fn: BlackoutFn) { blackoutFns.push(fn); }
export function fireBlackout() { for (const f of blackoutFns) f(); }
