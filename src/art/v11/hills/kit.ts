// V11 Ngā Puke Kōhatu, the Rocky Hills art kit: the palette above the bush line (granite tors with a
// warm feldspar blush, blue-grey greywacke scree, golden and red tussock, blue-green spaniard, glossy
// hebe, silver mountain daisies, orange crust lichen, peat) and small shared helpers.

import type { C } from '../../color';
import { hex, mix } from '../../color';
import { clamp, hash2 } from '../../../core/math';

const r = (...h: string[]): C[] => h.map(x => hex(x));

/** hills ramps, dark -> light */
export const HP = {
  granite: r('#1e1c20', '#2b292c', '#3a3739', '#4a4646', '#5c5755', '#706965', '#857c75', '#9b9187', '#b2a799', '#c9beae', '#ded5c6', '#efe8dc'),
  greywacke: r('#15191e', '#1e242a', '#283037', '#333c44', '#3f4952', '#4d5861', '#5d6871', '#6f7a82', '#838d94', '#99a2a7', '#b0b7ba'),
  scree: r('#1a1c1f', '#25282c', '#31353a', '#3e4348', '#4c5257', '#5c6266', '#6e7377', '#82868a', '#979a9c', '#aeb0b0'),
  tussock: r('#2a1c0e', '#3e2a12', '#573b18', '#70501f', '#8a6528', '#a47b33', '#bc9240', '#d0a952', '#e0bf6c', '#ecd38e', '#f5e6b4'),
  tussockRed: r('#2a100a', '#42190e', '#5c2513', '#773418', '#91461f', '#a95a29', '#bf7036', '#d18a4a'),
  tussockDry: r('#3a3326', '#544a37', '#6e634a', '#887c5e', '#a29673', '#bbb08b', '#d3c9a6', '#e8e0c4'),
  spaniard: r('#13201a', '#1c2f25', '#273f31', '#33523d', '#41664a', '#517a57', '#648f66', '#7aa375', '#93b788', '#b0cb9f'),
  hebe: r('#0b1610', '#112117', '#182e1e', '#203d26', '#2a4d2e', '#355e36', '#43703f', '#548349', '#699655'),
  silver: r('#2c3530', '#3e4a43', '#546158', '#6b7a6f', '#849487', '#9fad9f', '#bac7b8', '#d4ddd0', '#ebf0e8'),
  beech: r('#0a140d', '#101e12', '#172a17', '#1f381c', '#284722', '#335828', '#406a2f', '#4f7c36', '#62903f'),
  bark: r('#151110', '#211b18', '#2e2621', '#3c322b', '#4b3f36', '#5b4e42', '#6d5e50', '#807060', '#958472'),
  peat: r('#120c08', '#1b130d', '#261a12', '#322318', '#3f2c1e', '#4d3725', '#5c432d', '#6c5036'),
  lichenOrange: r('#6a2e10', '#9a4416', '#c8621e', '#e0842c', '#f0a646'),
  lichenPale: r('#5a6656', '#7a8874', '#9cab94', '#bccab2', '#d8e2cc'),
  daisy: r('#7a8288', '#a8b0b4', '#cdd3d4', '#e8ecea', '#fbfcf8'),
  gold: r('#6a4808', '#9a6a10', '#c8921c', '#e8b830', '#f8d860'),
  snow: r('#7a8aa0', '#9aaabe', '#bcc8d8', '#dbe3ec', '#f2f6fa'),
  ash: r('#1a1816', '#2a2724', '#3c3834', '#524c46', '#6c655d', '#8a8279'),
  wood: r('#1c140e', '#2c2016', '#3e2e20', '#52402c', '#68533a', '#7e6849', '#967e5c'),
  flaxDry: r('#2e2414', '#463822', '#604e30', '#7a6640', '#958052', '#ae9a68', '#c6b482'),
};

export const pick = (ramp: C[], v: number) => ramp[clamp(Math.round(v), 0, ramp.length - 1)];
export const hazeRamp = (rp: C[], fog: C, k: number) => rp.map(c => mix(c, fog, k));
/** a stable 0..1 hash for integer pixel coords */
export const hp = (x: number, y: number, s: number) => hash2(Math.floor(x), Math.floor(y), s);
