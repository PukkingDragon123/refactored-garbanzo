// Hand-picked colour ramps (dark -> light) for Zealandia.
import { C, hex } from './color';

const r = (...h: string[]): C[] => h.map(x => hex(x));

export const PAL = {
  // foliage
  leafDeep: r('#0c1d1b', '#133029', '#1b4535', '#255c40', '#35784a', '#4f9650', '#7ab65a', '#b3d77a'),
  leafTeal: r('#0b1c22', '#11302f', '#18463f', '#1f5f4d', '#2f7c5c', '#4c9b6c', '#7cbf86', '#b9e0a8'),
  leafOlive: r('#1a2114', '#29361c', '#3b4d24', '#52672c', '#6d8435', '#8ea344', '#b4c35e', '#dde28a'),
  fern: r('#0d2019', '#153525', '#1f4d31', '#2c6a3b', '#3f8a44', '#5fa84d', '#8ec95e', '#c4e67f'),
  moss: r('#1d2a12', '#2e4217', '#435e1e', '#5c7c25', '#7a9b31', '#9dba45', '#c6d86a'),
  // wood & earth
  bark: r('#1a120e', '#2b1e17', '#3f2c21', '#56402f', '#6f5640', '#8b6f52', '#a88b69', '#c9ad86'),
  barkGrey: r('#17181a', '#26282a', '#383a3b', '#4c4f4e', '#636762', '#7d8279', '#9da294', '#c2c6b4'),
  soil: r('#140d0b', '#231612', '#35221a', '#4a3223', '#62452d', '#7c5a39', '#9a7549'),
  sand: r('#4a3b2a', '#6b5638', '#8f7649', '#b3985f', '#d2b77a', '#e8d29b', '#f6e8c0'),
  stone: r('#15171c', '#23262d', '#343840', '#474c55', '#5e646c', '#7a8087', '#9aa0a3', '#c3c6c2'),
  stoneWarm: r('#1c1614', '#2d2420', '#40342d', '#56473d', '#6e5d4f', '#8a7663', '#a9937b', '#cdb89d'),
  // water
  water: r('#07131f', '#0b1f33', '#123049', '#1a4561', '#245b78', '#347790', '#5096a8', '#80bec5', '#c3e6e0'),
  // camp fabrics
  canvas: r('#2d2a1c', '#48432b', '#655d3b', '#857b4e', '#a69a66', '#c6ba86', '#e2d9ab'),
  canvasOrange: r('#3b1a10', '#5e2915', '#86391a', '#ad4c1f', '#cf6427', '#e88838', '#f6b25c'),
  olive: r('#171a0f', '#262b16', '#383f1f', '#4b5428', '#606b32', '#7a853f', '#98a150'),
  red: r('#2a0b0e', '#4a1016', '#6f1a1d', '#942522', '#b73a2c', '#d65a3a', '#ee8453'),
  blue: r('#0c1226', '#152143', '#1f3461', '#2c4b80', '#3d659c', '#5485b6', '#79a9cf'),
  metal: r('#101316', '#1c2126', '#2b3238', '#3d464d', '#525c63', '#6d777c', '#8f989a', '#bcc2c0'),
  yellow: r('#3d2a07', '#62440b', '#8c6210', '#b58218', '#d9a42a', '#efc653', '#fbe48e'),
  skin1: r('#3b2219', '#5c3524', '#82503a', '#a86d4f', '#c98e68', '#e4b287', '#f5d3aa'),
  skin2: r('#24140f', '#3a2117', '#553222', '#724632', '#915d44', '#b0795a', '#cc9a78'),
  skin3: r('#2f1d16', '#4d3022', '#6f4631', '#946044', '#b87e5a', '#d6a078', '#ecc59f'),
  white: r('#2b2e36', '#4a4f5a', '#6d737e', '#9299a3', '#b8bec4', '#dadfe0', '#f4f5ef'),
  // accents
  flowerPink: r('#3d0f1f', '#6b1a35', '#9a2a4c', '#c73f62', '#e8627d', '#f591a0', '#fcc2c5'),
  flowerGold: r('#3a2106', '#65390a', '#945610', '#c4781a', '#e59e2b', '#f6c44e', '#fde48b'),
  flowerViolet: r('#1d1236', '#301d59', '#46297e', '#5f39a1', '#7c52c0', '#9e76d8', '#c9a6ec'),
  glowCyan: r('#0a2a30', '#0f4a50', '#137274', '#1aa39c', '#3fd1c1', '#8ff0e0', '#dafff5'),
  glowGreen: r('#10301a', '#185028', '#20763a', '#35a44f', '#62d06c', '#a3f09a', '#e2ffd6'),
};

export const OUTLINE = hex('#0b0f12');
export const OUTLINE_WARM = hex('#1b100c');
