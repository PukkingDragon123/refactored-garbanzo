// The Stardew-style portrait dialogue box is retired in V12: every line floats in the world by its
// speaker (src/ui/v12/float.ts, driven by src/ui/bubbles.ts). The class and helpers stay as no-ops
// so older callers compile; the portrait tints are still kept for whoever reads them.

/** portrait well colours per character */
const TINT: Record<string, [string, string, string]> = {
  mori: ['#e8f0c8', '#8aa86a', '#4a6a2a'],
  jenna: ['#fbe0f0', '#d890c0', '#b04a8a'],
  joshu: ['#dfe8f4', '#7a90b0', '#2c3a5a'],
  aroha: ['#f4e4c4', '#c8945a', '#8a4a24'],
  chunk: ['#fde8c8', '#e8a868', '#c8402e'],
};
const ALIAS: Record<string, string> = { rowan: 'mori', pip: 'jenna', crowe: 'joshu', lou: 'joshu' };

export const hasPortrait = (id: string) => (ALIAS[id] ?? id) in TINT;
/** give a character a portrait tint (light, mid, dark) */
export function registerPortraitTint(id: string, t: [string, string, string]) { TINT[id] = t; }
/** a character's portrait tint, if it has one */
export const portraitTint = (id: string) => TINT[ALIAS[id] ?? id];

export class PortraitBox {
  readonly root: HTMLElement;
  readonly box: HTMLElement;
  /** where line content would be mounted (nothing is: lines float) */
  readonly area: HTMLElement;
  talking: () => boolean = () => false;
  active = false;

  constructor(_parent: HTMLElement) {
    // never mounted: no box on screen
    this.root = document.createElement('div');
    this.box = this.root;
    this.area = this.root;
  }
  show(_who: string, _name: string, _expr: string | undefined, _style: string | undefined) { /* lines float now */ }
  setDone(_done: boolean) { /* */ }
  hide() { this.active = false; }
  update(_dt: number) { /* */ }
}
