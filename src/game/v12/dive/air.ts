// V12 the dive's air tank (stub: the gear batch fills this in).
import type { FieldScene } from '../../scenes/field';

/** start the tank for a dive (called by the scene on enter) */
export function startAir(_f: FieldScene): void {}
/** the tank's fill 0..1 (1 when not diving) */
export function airLeft(): number { return 1; }
/** stop on leave */
export function stopAir(): void {}
