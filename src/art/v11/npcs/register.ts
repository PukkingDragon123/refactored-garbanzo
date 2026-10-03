// V11 NPCs: put the new people into the cast tables at runtime (idempotent), the way the village's
// villagers register (src/art/v10/villagers.ts): bodies (CAST7), heads (HEADS7), names, colours,
// voices and clip lists for the Actor and the speech bubbles, their dialogue portraits and HD busts
// (src/art/anime/portraits.ts registerPortraitDesign), and the dialogue box's portrait well tint.

import type { Char7 } from '../../v7/body';
import type { HeadDef7 } from '../../v7/head';
import { CAST7, INFO7 } from '../../v7/cast';
import { HEADS7 } from '../../v7/head';
import { CHAR_INFO, CHAR_ANIMS } from '../../v7';
import { CHAR_NAMES, CHAR_COLORS, CHAR_VOICE } from '../../../world/actor';
import { registerPortraitDesign } from '../../anime/portraits';
import { registerPortraitTint } from '../../../ui/dialogbox';
import { registerCloseupColors } from '../../../ui/closeup';
import { HINE7, DOUG7, ROSIE7, RANGER_HEADS } from './rangers';
import { CELESTE7, TEO7, HELIX_HEADS } from './helix';
import { RUA7, SUNNY7, HUNTER_HEADS } from './hunters';
import { TIPENE7, NGAIO7, CRAFT_HEADS } from './crafts';
import { MARGE7, MARGE_HEAD } from './naturalist';
import { NPC_PORTRAITS } from './portraits';

export interface NpcArt {
  id: string;
  name: string;
  body: Char7;
  head: HeadDef7;
  /** sprite height (px, for bubbles), voice pitch, name colour */
  height: number;
  voice: number;
  color: string;
  /** dialogue box well: light, mid, dark; close-up panel: light, mid, dark, accent */
  tint: [string, string, string];
  panel: [string, string, string, string];
}

export const NPC_ART: NpcArt[] = [
  { id: 'hine', name: 'Hine', body: HINE7, head: RANGER_HEADS.hine, height: 60, voice: 0.95, color: '#4a6a2a', tint: ['#e8ecd0', '#8a9a5a', '#44582a'], panel: ['#9ab86a', '#4a6a2a', '#12200a', '#e8f6c0'] },
  { id: 'doug', name: 'Doug', body: DOUG7, head: RANGER_HEADS.doug, height: 76, voice: 0.8, color: '#8a5a2a', tint: ['#f2e6d0', '#c09a6a', '#7a5428'], panel: ['#d0a070', '#8a5a2a', '#24140a', '#fff0d0'] },
  { id: 'rosie', name: 'Rosie', body: ROSIE7, head: RANGER_HEADS.rosie, height: 42, voice: 1.75, color: '#c8501e', tint: ['#fff2c8', '#f0c050', '#c8501e'], panel: ['#f4c850', '#d0602a', '#3a1406', '#fff6d0'] },
  { id: 'celeste', name: 'Dr Varga', body: CELESTE7, head: HELIX_HEADS.celeste, height: 64, voice: 1.15, color: '#b08c14', tint: ['#f6f2e0', '#d8c060', '#3a3a44'], panel: ['#e8d060', '#4a4a56', '#0c0c12', '#fffbe0'] },
  { id: 'teo', name: 'Teo', body: TEO7, head: HELIX_HEADS.teo, height: 70, voice: 0.78, color: '#a08010', tint: ['#eef2f6', '#b0b8c0', '#c8a010'], panel: ['#a8b4c0', '#d0a818', '#1a1e24', '#fff4c0'] },
  { id: 'rua', name: 'Rua', body: RUA7, head: HUNTER_HEADS.rua, height: 60, voice: 0.66, color: '#22466e', tint: ['#e0e6ee', '#6a82a0', '#22466e'], panel: ['#6a8ab0', '#22466e', '#08101c', '#dce8ff'] },
  { id: 'sunny', name: 'Sunny', body: SUNNY7, head: HUNTER_HEADS.sunny, height: 64, voice: 1.05, color: '#b82c22', tint: ['#f8e4dc', '#e08060', '#a8341e'], panel: ['#f09070', '#b8342a', '#2a0a06', '#ffe4d8'] },
  { id: 'tipene', name: 'Tīpene', body: TIPENE7, head: CRAFT_HEADS.tipene, height: 54, voice: 0.72, color: '#7e5530', tint: ['#f2e8d8', '#b89068', '#5e3c20'], panel: ['#c49a6c', '#7e5530', '#1c1008', '#fff0d8'] },
  { id: 'ngaio', name: 'Ngaio', body: NGAIO7, head: CRAFT_HEADS.ngaio, height: 66, voice: 1.2, color: '#226282', tint: ['#e4f0f2', '#6aa2b0', '#226282'], panel: ['#7ac0c8', '#226282', '#06141c', '#e0fbff'] },
  { id: 'marge', name: 'Marge', body: MARGE7, head: MARGE_HEAD, height: 52, voice: 1.3, color: '#7a6a2a', tint: ['#f4f0dc', '#c8b878', '#6a5a24'], panel: ['#d8c880', '#7a6a2a', '#1c1808', '#fffbe4'] },
];
export const NPC_ART_BY_ID: Record<string, NpcArt> = Object.fromEntries(NPC_ART.map(n => [n.id, n]));
export const NPC_IDS = NPC_ART.map(n => n.id);

let done = false;
/** add the new people to the cast tables (idempotent) */
export function registerNpcArt() {
  if (done) return;
  done = true;
  for (const n of NPC_ART) {
    CAST7[n.id] = n.body;
    HEADS7[n.id] = n.head;
    INFO7[n.id] = { name: n.name, short: n.name, voice: n.voice, height: n.height };
    CHAR_INFO[n.id] = INFO7[n.id];
    CHAR_ANIMS[n.id] = CHAR_ANIMS.mori;
    CHAR_NAMES[n.id] = n.name;
    CHAR_COLORS[n.id] = n.color;
    CHAR_VOICE[n.id] = n.voice;
    const d = NPC_PORTRAITS[n.id];
    if (d) registerPortraitDesign(n.id, d);
    registerPortraitTint(n.id, n.tint);
    registerCloseupColors(n.id, n.panel);
  }
}
