// 3D expedition map: a pixelated WebGL2 diorama of the island, rendered into a low-resolution
// offscreen framebuffer and upscaled with nearest filtering. HTML pins, labels, a side panel and
// Aroha's narrated travel animation sit on top. Self-contained: own canvas, own GL context, own CSS.

import type { TimeOfDay } from '../world/timeofday';
import { buildTerrain, paintTopDown, GRID, VN, TREE_STRIDE, SITE_POS } from './map3d-terrain';
import type { Terrain, P2, MapFeature } from './map3d-terrain';
import { pxIcon } from './pxicons';

export interface MapSite {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  pos: [number, number];
  fauna: { name: string; icon: string; known: boolean }[];
}
export interface MapTime { id: TimeOfDay; label: string; locked?: string }
export interface MapOpenOptions {
  sites: MapSite[];
  from: string;
  times: MapTime[];
  guidePortrait: string;
  guideLines: (from: string, to: string) => string[];
  onSfx?: (name: 'ui' | 'uiOpen' | 'uiBack' | 'whoosh' | 'step' | 'pageTurn') => void;
}
type MapResult = { site: string; tod: TimeOfDay } | null;

// ------------------------------------------------------------------ world constants

const WORLD = 10; // the map square spans -5..5 in x (east) and z (south)
/** Vertical exaggeration of the relief. 1 is the tuned diorama look; raise it for drama. */
const V_EXAG = 1.0;
const HS = 2.1 * V_EXAG; // world height of one terrain height unit
const Y_BASE = -0.34 * HS - 0.3;
const PLINTH_M = 0.22, PLINTH_H = 0.2;
const Y_TABLE = Y_BASE - PLINTH_H;
const SUN: [number, number, number] = (() => {
  const v = [-0.8, 0.6, 0.04];
  const m = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / m, v[1] / m, v[2] / m] as [number, number, number];
})();
const FOV = (30 * Math.PI) / 180;
/** Default orbit angle: from the south-south-west, so the volcano doesn't hide Thunder Falls. */
const YAW0 = -0.34;
const NEAR = 0.3, FAR = 160;
const wx = (u: number) => (u - 0.5) * WORLD;
const wz = (v: number) => (v - 0.5) * WORLD;
const wy = (h: number) => h * HS;
const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

interface TodLook {
  sun: [number, number, number]; sunK: number; amb: [number, number, number]; sky: [number, number, number];
  glint: [number, number, number]; night: number; mist: number; clouds: number; vignette: number;
}
const TOD: Record<TimeOfDay, TodLook> = {
  dawn: { sun: [1.0, 0.8, 0.7], sunK: 0.78, amb: [0.64, 0.6, 0.76], sky: [0.66, 0.56, 0.6], glint: [1, 0.88, 0.78], night: 0.12, mist: 0.8, clouds: 0.22, vignette: 1 },
  day: { sun: [1.0, 0.96, 0.86], sunK: 0.82, amb: [0.58, 0.63, 0.72], sky: [0.62, 0.6, 0.52], glint: [1, 1, 0.94], night: 0, mist: 0.3, clouds: 0.3, vignette: 0.85 },
  dusk: { sun: [1.0, 0.72, 0.46], sunK: 0.86, amb: [0.5, 0.5, 0.72], sky: [0.58, 0.46, 0.44], glint: [1, 0.84, 0.56], night: 0.3, mist: 0.5, clouds: 0.24, vignette: 1 },
  night: { sun: [0.46, 0.56, 0.86], sunK: 0.5, amb: [0.3, 0.34, 0.5], sky: [0.2, 0.23, 0.32], glint: [0.82, 0.92, 1], night: 1, mist: 0.6, clouds: 0.12, vignette: 1.2 },
};

// ------------------------------------------------------------------ tiny mat4 (column-major)

type M4 = Float32Array;
function perspective(fovy: number, aspect: number, n: number, f: number): M4 {
  const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
  m[0] = t / aspect; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f);
  return m;
}
function lookAt(e: number[], c: number[], up: number[]): M4 {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
  let l = Math.hypot(zx, zy, zz) || 1;
  zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1;
  xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx; m[1] = yx; m[2] = zx;
  m[4] = xy; m[5] = yy; m[6] = zy;
  m[8] = xz; m[9] = yz; m[10] = zz;
  m[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
  m[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
  m[14] = -(zx * e[0] + zy * e[1] + zz * e[2]);
  m[15] = 1;
  return m;
}
function mul(a: M4, b: M4): M4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

// ------------------------------------------------------------------ shaders

const HEAD = `#version 300 es
precision highp float;
precision highp int;
layout(std140) uniform Frame {
  mat4 uVP;
  vec4 uCam;    // eye xyz, time
  vec4 uRight;  // camera right, pixels per world unit at distance 1
  vec4 uUp;     // camera up, height scale
  vec4 uSun;    // direction to the sun, intensity
  vec4 uSunCol; // sun colour, night amount
  vec4 uAmb;    // ambient colour, valley mist amount
  vec4 uSky;    // table tint, vignette
  vec4 uMisc;   // cloud shadow, low-res width, low-res height, -
  vec4 uWater;  // glint colour, -
};
`;
const LIB = `
float bayer(vec2 fc) {
  ivec2 p = ivec2(fc) & 3;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[p.x + p.y * 4]) + 0.5) / 16.0;
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float clouds(vec2 xz) {
  vec2 p = xz * 0.16 + uCam.w * vec2(0.05, 0.021);
  float n = vnoise(p) * 0.55 + vnoise(p * 2.13 + 3.7) * 0.3 + vnoise(p * 4.37 + 9.1) * 0.15;
  return smoothstep(0.5, 0.63, n) * uMisc.x;
}
vec3 shade(vec3 base, vec3 n, float vis, vec2 xz, float d, float levels) {
  float ndl = max(dot(n, uSun.xyz), 0.0);
  float direct = ndl * vis * (1.0 - clouds(xz));
  float q = floor(direct * levels + d) / levels;
  float sky = 0.66 + 0.34 * clamp(n.y, 0.0, 1.0);
  return base * (uAmb.rgb * sky + uSunCol.rgb * q * uSun.w);
}
`;

const TERRAIN_VS = HEAD + `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNrm;
layout(location = 2) in vec4 aCol;
layout(location = 3) in vec4 aExt;
out vec3 vW; out vec3 vN; out vec3 vC; out vec4 vE;
void main() {
  vW = aPos; vN = aNrm; vC = aCol.rgb; vE = aExt;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;
const TERRAIN_FS = HEAD + LIB + `
in vec3 vW; in vec3 vN; in vec3 vC; in vec4 vE;
out vec4 o;
void main() {
  float d = bayer(gl_FragCoord.xy);
  vec3 n = normalize(vN);
  vec3 col = shade(vC, n, vE.x, vW.xz, d, 4.0);
  // contour lines and hypsometric bands
  float c = vW.y / uUp.w / 0.05;
  float fw = fwidth(c);
  float keep = vE.y * (1.0 - smoothstep(0.42, 0.8, fw));
  float line = step(fract(c), fw) * keep;
  float major = step(mod(floor(c), 4.0), 0.5);
  col *= 1.0 - line * mix(0.24, 0.4, major);
  col *= 1.0 + (mod(floor(c), 2.0) - 0.5) * 0.045 * keep;
  // lava and hot mud
  if (vE.w > 0.0) {
    float fl = 0.7 + 0.3 * sin(uCam.w * 2.1 + vW.x * 9.0 + vW.z * 7.0);
    vec3 lc = mix(vec3(0.78, 0.2, 0.08), vec3(1.0, 0.8, 0.32), vE.w * fl);
    col = mix(col, lc, smoothstep(0.08, 0.45, vE.w) * (0.75 + 0.25 * uSunCol.w));
  }
  o = vec4(col, 1.0);
}`;

const SIDES_VS = HEAD + `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNrm;
layout(location = 2) in float aKind;
out vec3 vW; out vec3 vN; flat out float vK;
void main() { vW = aPos; vN = aNrm; vK = aKind; gl_Position = uVP * vec4(aPos, 1.0); }`;
const SIDES_FS = HEAD + LIB + `
in vec3 vW; in vec3 vN; flat in float vK;
out vec4 o;
void main() {
  float d = bayer(gl_FragCoord.xy);
  vec3 n = normalize(vN);
  float s = vW.x + vW.z;
  vec3 col;
  if (vK < 0.5) {
    float y = vW.y + (vnoise(vec2(s * 1.7, 0.5)) - 0.5) * 0.12;
    float band = floor(-y * 7.0 + (d - 0.5) * 0.6);
    float bi = mod(band, 5.0);
    col = bi < 1.0 ? vec3(0.52, 0.38, 0.25) : bi < 2.0 ? vec3(0.43, 0.3, 0.21) : bi < 3.0 ? vec3(0.6, 0.46, 0.3) : bi < 4.0 ? vec3(0.37, 0.28, 0.21) : vec3(0.48, 0.41, 0.32);
    if (hash12(floor(vec2(s, vW.y) * 26.0)) > 0.94) col *= 0.78;
    if (vW.y > -0.035) col = vec3(0.64, 0.57, 0.38);
  } else if (vK < 1.5) {
    float depth = -vW.y;
    float k = depth * 3.4 + (d - 0.5) * 0.8 + (vnoise(vec2(s * 3.0, depth * 9.0 - uCam.w * 0.3)) - 0.5) * 0.45;
    col = k < 0.3 ? vec3(0.38, 0.82, 0.76) : k < 0.95 ? vec3(0.22, 0.63, 0.68) : k < 1.7 ? vec3(0.14, 0.45, 0.57) : vec3(0.09, 0.31, 0.45);
    if (depth < 0.028) col = vec3(0.88, 0.97, 0.94);
  } else {
    float g = vnoise(vec2(s * 2.4, vW.y * 34.0));
    col = mix(vec3(0.3, 0.19, 0.13), vec3(0.4, 0.26, 0.17), step(0.55, g));
    if (n.y > 0.5) col = mix(vec3(0.27, 0.17, 0.12), vec3(0.33, 0.21, 0.14), step(0.5, vnoise(vW.xz * vec2(6.0, 0.8))));
    else if (vW.y > ${Y_BASE.toFixed(4)} - 0.03) col = vec3(0.8, 0.63, 0.3);
  }
  o = vec4(shade(col, n, 1.0, vW.xz, d, 3.0), 1.0);
}`;

const TABLE_VS = HEAD + `
layout(location = 0) in vec3 aPos;
out vec3 vW;
void main() { vW = aPos; gl_Position = uVP * vec4(aPos, 1.0); }`;
const TABLE_FS = HEAD + LIB + `
in vec3 vW; out vec4 o;
float sdBox(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
void main() {
  float d = bayer(gl_FragCoord.xy);
  vec2 p = vW.xz;
  float r = length(p);
  float st = vnoise(p * 0.3) * 0.6 + vnoise(p * 1.1 + 4.0) * 0.4;
  vec3 col = vec3(0.88, 0.81, 0.65) * (0.9 + st * 0.14);
  // chart grid, a compass ring and rhumb lines
  vec2 g = abs(fract(p / 2.5 + 0.5) - 0.5) * 2.5;
  float fw = max(fwidth(p.x), fwidth(p.y));
  float grid = step(min(g.x, g.y), fw * 0.9);
  float seg = 6.2831853 / 16.0;
  float a = atan(p.y, p.x);
  float ad = abs(fract(a / seg + 0.5) - 0.5) * seg * r;
  float rh = step(ad, fw * 0.9) * step(7.3, r);
  float ring = step(abs(r - 7.7), fw * 0.9) + step(abs(r - 7.95), fw * 0.9);
  col = mix(col, vec3(0.52, 0.41, 0.28), clamp(max(grid * 0.28, max(rh * 0.24, ring * 0.45)), 0.0, 1.0));
  // soft shadow of the diorama, pushed away from the sun
  vec2 off = -uSun.xz / max(uSun.y, 0.2) * 0.4;
  float bx = sdBox(p - off, vec2(${(WORLD / 2 + PLINTH_M).toFixed(3)}));
  float sh = 1.0 - smoothstep(-0.2, 1.4, bx);
  col *= 1.0 - floor(sh * 3.0 + d) / 3.0 * 0.3;
  col *= uAmb.rgb * 0.62 + uSunCol.rgb * 0.46 * uSun.w;
  col = mix(col, uSky.rgb, smoothstep(11.0, 30.0, r));
  o = vec4(col, 1.0);
}`;

const WATER_VS = HEAD + `
layout(location = 0) in vec2 aUV;
out vec2 vUV; out vec3 vW;
void main() {
  vUV = aUV;
  vW = vec3((aUV.x - 0.5) * ${WORLD.toFixed(1)}, 0.0, (aUV.y - 0.5) * ${WORLD.toFixed(1)});
  gl_Position = uVP * vec4(vW, 1.0);
}`;
const WATER_FS = HEAD + LIB + `
uniform sampler2D uSea;
uniform vec4 uSerp; // sea serpent: centre uv, radius, phase
in vec2 vUV; in vec3 vW; out vec4 o;
vec4 sea(vec2 uv) { return texture(uSea, (uv * ${GRID}.0 + 0.5) / ${VN}.0); }
void main() {
  float t = uCam.w;
  float d = bayer(gl_FragCoord.xy);
  vec2 uv = vUV;
  vec2 wob = vec2(vnoise(uv * 44.0 + vec2(t * 0.45, 0.0)), vnoise(uv * 44.0 + vec2(3.1, t * 0.4))) - 0.5;
  vec4 s = sea(uv + wob * 0.0035);
  float depth = s.r, reef = s.g, shore = s.b, vis = s.a;
  float k = depth * 5.5 + (d - 0.5) * 0.5;
  vec3 col = k < 0.3 ? vec3(0.5, 0.88, 0.78) : k < 1.0 ? vec3(0.33, 0.77, 0.73) : k < 1.9 ? vec3(0.2, 0.62, 0.66) : k < 2.9 ? vec3(0.14, 0.47, 0.58) : k < 4.1 ? vec3(0.11, 0.35, 0.49) : vec3(0.08, 0.26, 0.41);
  if (reef > 0.2) {
    col = mix(col, vec3(0.52, 0.88, 0.8), smoothstep(0.3, 0.7, reef) * 0.7);
    float cn = vnoise(uv * 310.0);
    if (cn > 0.54) col = mix(col, cn > 0.7 ? vec3(0.96, 0.56, 0.46) : vec3(0.93, 0.76, 0.52), 0.6 * smoothstep(0.2, 0.5, reef));
    float surf = step(0.55, sin(t * 1.9 + uv.y * 90.0 + vnoise(uv * 36.0) * 5.0));
    if (reef > 0.62 && surf > d * 0.8) col = vec3(0.92, 0.98, 0.95);
  }
  // the leviathan: a long dark shape gliding under the surface off the east coast
  vec2 sp = uv - uSerp.xy;
  float ang = atan(sp.y, sp.x);
  float body = fract((ang - uSerp.w) / 6.2831853);
  float rr = length(sp) - uSerp.z - sin(body * 40.0 + t * 2.0) * 0.004;
  if (body < 0.2 && abs(rr) < 0.0045 * (1.0 - body * 3.5) + 0.0012 && depth > 0.12) col = mix(col, vec3(0.05, 0.18, 0.25), 0.55);
  // swell lines in open water, like the hatching on an old chart
  if (depth > 0.18) {
    float sw = sin(dot(uv, vec2(0.83, 0.56)) * 210.0 + vnoise(uv * 9.0) * 7.0 - t * 0.9);
    float dash = step(0.45, vnoise(uv * vec2(70.0, 40.0) + vec2(t * 0.2, 0.0)));
    if (sw > 0.93 && dash > 0.5) col = mix(col, vec3(0.36, 0.7, 0.76), 0.45);
  }
  float band = 1.0 - smoothstep(0.02, 0.32, shore);
  float ph = shore * 46.0 - t * 1.4 + vnoise(uv * 12.0) * 3.0;
  if (step(0.9, sin(ph)) * band > d) col = mix(col, vec3(0.88, 0.96, 0.92), 0.55);
  float fl = 0.02 + 0.012 * sin(t * 1.3 + (uv.x + uv.y) * 60.0);
  if (shore < fl) col = vec3(0.92, 0.97, 0.93);
  float cs = 1.0 - clouds(vW.xz);
  float lk = vis * cs;
  col *= mix(uAmb.rgb * 1.25, uSunCol.rgb * 1.02, 0.35 + 0.55 * floor(lk * 2.0 + d) / 2.0);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))), uSunCol.w * 0.35);
  vec2 gp = floor(uv * vec2(uMisc.z * 0.9, uMisc.z * 1.8));
  float patchK = smoothstep(0.55, 0.8, vnoise(uv * 7.0 + vec2(t * 0.05, -t * 0.03)));
  float gl = hash12(gp + floor(t * 1.6 + hash12(gp) * 3.0) * 17.13);
  if (gl > 1.0 - 0.02 * patchK && depth > 0.05 && lk > 0.6) col = mix(col, uWater.rgb, 0.85);
  o = vec4(col, 1.0);
}`;

const RIVER_VS = HEAD + `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aRU;
out vec3 vW; out vec2 vR;
void main() { vW = aPos; vR = aRU; gl_Position = uVP * vec4(aPos, 1.0); }`;
const RIVER_FS = HEAD + LIB + `
in vec3 vW; in vec2 vR; out vec4 o;
void main() {
  float t = uCam.w;
  float d = bayer(gl_FragCoord.xy);
  float ax = abs(vR.x);
  vec3 col = mix(vec3(0.22, 0.5, 0.62), vec3(0.3, 0.63, 0.73), step(ax, 0.55));
  float n = vnoise(vec2(vR.x * 1.5 + 4.0, vR.y * 9.0 - t * 2.2));
  if (n > 0.7 + d * 0.2) col = vec3(0.64, 0.87, 0.9);
  if (ax > 0.8) col = mix(col, vec3(0.55, 0.78, 0.76), 0.6);
  float cs = 1.0 - clouds(vW.xz);
  col *= mix(uAmb.rgb * 1.2, uSunCol.rgb, 0.3 + 0.6 * cs);
  float g = hash12(floor(vW.xz * 40.0) + floor(t * 3.0) * 7.7);
  if (g > 0.985 && cs > 0.5) col = uWater.rgb;
  o = vec4(col, 1.0);
}`;
const FALLS_FS = HEAD + LIB + `
in vec3 vW; in vec2 vR; out vec4 o;
void main() {
  float t = uCam.w;
  float d = bayer(gl_FragCoord.xy);
  float ax = abs(vR.x);
  if (ax > 0.72 && hash12(floor(gl_FragCoord.xy) + floor(t * 8.0)) > 0.5) discard;
  float n = vnoise(vec2(vR.x * 4.0 + 2.0, vR.y * 7.0 - t * 6.5));
  vec3 col = mix(vec3(0.58, 0.8, 0.9), vec3(0.95, 0.99, 1.0), step(0.5 + d * 0.15, n));
  col = mix(col, vec3(1.0), smoothstep(0.8, 1.0, vR.y));
  col *= mix(uAmb.rgb * 1.35, uSunCol.rgb * 1.05, 0.55);
  o = vec4(col, 1.0);
}`;

const TREE_VS = HEAD + `
layout(location = 0) in vec2 aQ;
layout(location = 1) in vec4 aI0;
layout(location = 2) in vec4 aI1;
out vec2 vQ; flat out vec4 vA; out vec3 vW;
void main() {
  float s = aI0.w;
  float ty = aI1.x;
  float lift = ty == 1.0 ? 1.15 : ty == 2.0 ? 1.25 : ty == 3.0 ? 0.62 : ty == 4.0 ? 0.9 : 0.98;
  vec3 c = aI0.xyz + vec3(0.0, s * lift, 0.0);
  float sway = sin(uCam.w * 1.3 + aI1.y * 30.0) * 0.05 * max(aQ.y, 0.0);
  vec3 p = c + uRight.xyz * (aQ.x + sway) * s * 1.15 + uUp.xyz * aQ.y * s * 1.15;
  vW = c; vQ = aQ; vA = aI1;
  gl_Position = uVP * vec4(p, 1.0);
}`;
const TREE_FS = HEAD + LIB + `
in vec2 vQ; flat in vec4 vA; in vec3 vW; out vec4 o;
vec3 pal(int type, int i) {
  if (type == 1) return i == 0 ? vec3(0.2, 0.4, 0.3) : i == 1 ? vec3(0.23, 0.45, 0.33) : i == 2 ? vec3(0.18, 0.36, 0.28) : vec3(0.26, 0.47, 0.32);
  if (type == 2) return i < 2 ? vec3(0.44, 0.64, 0.26) : vec3(0.37, 0.57, 0.22);
  if (type == 3) return i < 2 ? vec3(0.35, 0.42, 0.2) : vec3(0.3, 0.37, 0.18);
  if (type == 4) return i < 2 ? vec3(0.25, 0.52, 0.27) : vec3(0.31, 0.58, 0.26);
  if (type == 5) return i < 2 ? vec3(0.43, 0.61, 0.29) : vec3(0.48, 0.65, 0.31);
  return i == 0 ? vec3(0.24, 0.47, 0.2) : i == 1 ? vec3(0.29, 0.54, 0.23) : i == 2 ? vec3(0.2, 0.42, 0.2) : i == 3 ? vec3(0.35, 0.58, 0.25) : vec3(0.26, 0.42, 0.2);
}
void main() {
  int type = int(vA.x + 0.5);
  float seed = vA.y;
  vec2 q = vQ;
  float d = bayer(gl_FragCoord.xy);
  vec3 nv = vec3(0.0, 0.0, 1.0);
  bool trunk = false;
  if (type == 1) {
    float y = (q.y + 0.72) / 1.72;
    if (y < 0.0) { if (abs(q.x) < 0.13 && q.y > -1.0) trunk = true; else discard; }
    else {
      float tier = fract(y * 2.4);
      float w = (1.0 - y) * (0.52 + 0.3 * (1.0 - tier));
      if (abs(q.x) > w) discard;
      nv = normalize(vec3(q.x / max(w, 0.05) * 0.9, 0.55 - tier * 0.45, 0.6));
    }
  } else if (type == 2 || type == 4) {
    vec2 c = q - vec2(type == 2 ? 0.18 : 0.0, type == 2 ? 0.35 : 0.1);
    float a = atan(c.y, c.x);
    float lobes = type == 2 ? 3.0 : 3.5;
    float r = (type == 2 ? 0.74 : 0.8) * (0.35 + 0.65 * pow(abs(cos(a * lobes + seed * 6.0)), 0.6));
    if (c.y < 0.0) r *= type == 2 ? 0.75 : 0.9;
    if (length(c) > r) {
      float tx = type == 2 ? q.x - 0.18 * (q.y + 1.0) / 1.35 : q.x;
      if (abs(tx) < 0.11 && q.y < 0.3 && q.y > -1.0) trunk = true; else discard;
    } else nv = normalize(vec3(c / 0.8, 0.6));
  } else {
    vec2 c = q - vec2(0.0, type == 3 ? -0.15 : 0.12);
    if (type == 3) c.y *= 1.45;
    float a = atan(c.y, c.x);
    float r = 0.84 * (1.0 + 0.07 * sin(a * 5.0 + seed * 40.0) + 0.05 * sin(a * 9.0 + seed * 17.0));
    if (length(c) > r) {
      if (type != 3 && abs(q.x) < 0.13 && q.y < -0.3 && q.y > -1.0) trunk = true;
      else if (type == 3 && q.y < -0.55 && q.y > -1.0 && abs(fract(q.x * 2.5 + 0.5) - 0.5) < 0.2 && abs(q.x) < 0.7) trunk = true;
      else discard;
    } else {
      vec2 cc = c / r;
      nv = vec3(cc, sqrt(max(0.0, 1.0 - dot(cc, cc))));
    }
  }
  vec3 base = trunk ? vec3(0.33, 0.24, 0.16) : pal(type, int(vA.w + 0.5));
  if (!trunk && vA.w > 3.5 && nv.y > -0.2 && hash12(floor((q + seed * 7.0) * 3.2)) > 0.5) base = vec3(0.74, 0.19, 0.16);
  vec3 fwd = cross(uRight.xyz, uUp.xyz);
  vec3 nw = normalize(uRight.xyz * nv.x + uUp.xyz * nv.y + fwd * nv.z);
  float ndl = trunk ? 0.3 : max(dot(nw, uSun.xyz), 0.0);
  float direct = ndl * vA.z * (1.0 - clouds(vW.xz));
  float lv = floor(direct * 3.0 + d) / 3.0;
  vec3 col = base * (uAmb.rgb * (0.74 + 0.26 * nv.y) + uSunCol.rgb * lv * uSun.w * 1.05);
  o = vec4(col, 1.0);
}`;

const PTS_VS = HEAD + `
layout(location = 0) in vec4 aP;
uniform vec4 uR; // reveal, size, mode, bias
out float vT;
void main() {
  vec3 p = aP.xyz + normalize(uCam.xyz - aP.xyz) * uR.w;
  gl_Position = uVP * vec4(p, 1.0);
  gl_PointSize = uR.y;
  vT = aP.w;
}`;
const PTS_FS = HEAD + LIB + `
uniform vec4 uR;
uniform vec4 uC;
uniform float uHead;
in float vT; out vec4 o;
void main() {
  if (vT > uR.x) discard;
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float d = bayer(gl_FragCoord.xy);
  float mode = uR.z;
  if (mode < 0.5) { o = vec4(uC.rgb * (uAmb.rgb * 0.7 + uSunCol.rgb * 0.45), 1.0); return; }
  if (mode < 1.5) {
    float pulse = fract(vT * 18.0 - uCam.w * 1.4);
    vec3 col = mix(uC.rgb, vec3(1.0, 0.96, 0.78), step(0.72, pulse) * uC.a);
    if (vT < uHead) col = mix(col, vec3(1.0, 0.98, 0.9), 0.3);
    o = vec4(col, 1.0);
    return;
  }
  if (r2 > 1.0) discard;
  if (mode < 2.5) {
    float a = 1.0 - r2;
    a = floor(a * a * 3.0 + d) / 3.0 * uC.a;
    o = vec4(uC.rgb * a, 1.0);
    return;
  }
  float pulse = 0.5 + 0.5 * sin(uCam.w * 4.0 - vT * 6.2831);
  o = vec4(mix(uC.rgb, vec3(1.0, 0.97, 0.85), step(0.6, pulse)), 1.0);
}`;

const FX_VS = HEAD + `
layout(location = 0) in vec4 aE;
layout(location = 1) in vec4 aK;
out float vA; flat out float vKind; out float vAge;
void main() {
  float t = uCam.w;
  float kind = aK.x;
  float age = fract(t / aK.y + aE.w);
  float s1 = fract(aE.w * 7.13), s2 = fract(aE.w * 3.71 + 0.3);
  vec3 p = aE.xyz;
  float size = aK.z, a = 1.0;
  if (kind < 0.5) {
    p += vec3(age * age * 1.6 + (s1 - 0.5) * 0.3 * age, age * 2.1 * aK.w, (s2 - 0.5) * 0.4 * age - age * age * 0.4);
    size *= 0.4 + age * 2.2;
    a = smoothstep(0.0, 0.18, age) * (1.0 - age) * 1.25;
  } else if (kind < 1.5) {
    float ang = s1 * 6.2831;
    float rr = sqrt(age) * 0.22;
    p += vec3(cos(ang) * rr, age * 0.24 + sin(age * 3.14) * 0.08, abs(sin(ang)) * rr * 0.8);
    size *= 0.6 + age * 1.1;
    a = (1.0 - age) * 0.95;
  } else if (kind < 2.5) {
    p += vec3(sin(t * 0.045 + s1 * 6.28) * 0.5, 0.0, cos(t * 0.035 + s2 * 6.28) * 0.35);
    a = uAmb.w * (0.55 + 0.45 * sin(t * 0.17 + s1 * 6.28));
    age = 0.5;
  } else if (kind < 3.5) {
    p += vec3(age * 0.12 + sin(age * 6.0 + s1 * 6.0) * 0.02, age * 0.5, -age * 0.04);
    size *= 0.5 + age * 1.4;
    a = (1.0 - age) * 0.8;
  } else if (kind < 4.5) {
    p += vec3((s1 - 0.5) * 0.1, age * 0.32, (s2 - 0.5) * 0.1);
    size *= 0.5 + age;
    a = (1.0 - age) * 0.75;
  } else {
    // a bird circling on a thermal
    float ang = t * aK.w + aE.w * 6.2831;
    float rr = 0.35 + s1 * 0.45;
    p += vec3(cos(ang) * rr, sin(t * 0.7 + s2 * 6.0) * 0.08, sin(ang) * rr * 0.8);
    a = 1.0;
    age = fract(t * 2.2 + s1);
  }
  vec4 cp = uVP * vec4(p, 1.0);
  gl_Position = cp;
  gl_PointSize = clamp(size * uRight.w / cp.w, 1.0, 96.0);
  vA = a; vKind = kind; vAge = age;
}`;
const FX_FS = HEAD + LIB + `
in float vA; flat in float vKind; in float vAge; out vec4 o;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  if (vKind > 4.5) {
    // tiny "v" silhouette, wings flapping
    float flap = vAge < 0.5 ? 0.45 : -0.1;
    float wing = abs(c.x) * 0.9 - flap;
    if (abs(c.y - wing * 0.7) > 0.28 || abs(c.x) > 0.95) discard;
    o = vec4(vec3(0.16, 0.14, 0.13) * (0.8 + uSunCol.rgb * 0.3), 1.0);
    return;
  }
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float d = bayer(gl_FragCoord.xy);
  float a = vA * (1.0 - r2 * 0.8);
  a = floor(a * 3.0 + d * 0.9) / 3.0;
  if (a <= 0.0) discard;
  vec3 col = vKind < 0.5 ? mix(vec3(0.36, 0.33, 0.32), vec3(0.84, 0.82, 0.8), smoothstep(0.0, 0.45, vAge))
           : vKind < 1.5 ? vec3(0.93, 0.97, 1.0)
           : vKind < 2.5 ? vec3(0.9, 0.93, 0.95)
           : vKind < 3.5 ? vec3(0.62, 0.6, 0.58) : vec3(0.92, 0.92, 0.9);
  float l = 0.88 + 0.22 * (-c.y * 0.6 - c.x * 0.4);
  col *= mix(uAmb.rgb * 1.3, uSunCol.rgb * 1.1, 0.55) * l;
  o = vec4(col, a * (vKind > 1.5 && vKind < 2.5 ? 0.4 : 0.85));
}`;

const GLOW_VS = HEAD + `
layout(location = 0) in vec4 aE;
layout(location = 1) in vec4 aK;
out vec3 vCol; out float vI;
void main() {
  vec4 cp = uVP * vec4(aE.xyz, 1.0);
  gl_Position = cp;
  float fl = 0.8 + 0.2 * sin(uCam.w * (6.0 + aE.w * 4.0) + aE.w * 30.0) * sin(uCam.w * 2.3 + aE.w * 11.0);
  float night = uSunCol.w;
  float I = aK.z * fl;
  if (aK.x < 0.5) { vCol = vec3(1.0, 0.6, 0.24); I *= 0.3 + night * 0.95; }
  else if (aK.x < 1.5) { vCol = vec3(1.0, 0.4, 0.13); I *= 0.25 + night * 0.9; }
  else { vCol = vec3(0.3, 0.95, 0.85); I *= night * 1.1 + 0.04; }
  vI = I;
  gl_PointSize = clamp(aK.y * (1.0 + night * 0.8) * uRight.w / cp.w, 2.0, 160.0);
}`;
const GLOW_FS = HEAD + LIB + `
in vec3 vCol; in float vI; out vec4 o;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float a = 1.0 - r2;
  a *= a;
  float d = bayer(gl_FragCoord.xy);
  a = floor(a * vI * 4.0 + d) / 4.0;
  o = vec4(vCol * a, 1.0);
}`;

const POST_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const POST_FS = HEAD + LIB + `
uniform sampler2D uColT;
uniform sampler2D uDepT;
out vec4 o;
float lin(float z) {
  float n = ${NEAR.toFixed(3)}, f = ${FAR.toFixed(1)};
  return 2.0 * n * f / (f + n - (z * 2.0 - 1.0) * (f - n));
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 mx = textureSize(uColT, 0) - 1;
  vec3 c = texelFetch(uColT, p, 0).rgb;
  float z0 = lin(texelFetch(uDepT, p, 0).r);
  float e = 0.0;
  e = max(e, lin(texelFetch(uDepT, min(p + ivec2(1, 0), mx), 0).r) - z0);
  e = max(e, lin(texelFetch(uDepT, max(p - ivec2(1, 0), ivec2(0)), 0).r) - z0);
  e = max(e, lin(texelFetch(uDepT, min(p + ivec2(0, 1), mx), 0).r) - z0);
  e = max(e, lin(texelFetch(uDepT, max(p - ivec2(0, 1), ivec2(0)), 0).r) - z0);
  float edge = smoothstep(0.012, 0.03, e / z0);
  c *= 1.0 - edge * 0.36;
  vec2 res = vec2(mx + 1);
  vec2 q = (gl_FragCoord.xy / res - 0.5) * vec2(res.x / res.y, 1.0);
  float v = smoothstep(0.45, 1.05, length(q)) * uSky.w;
  float d = bayer(gl_FragCoord.xy);
  c *= 1.0 - floor(v * 4.0 + d) / 4.0 * 0.4;
  o = vec4(c, 1.0);
}`;

// ------------------------------------------------------------------ GL renderer

type GL = WebGL2RenderingContext;
interface Prog { p: WebGLProgram; u: (name: string) => WebGLUniformLocation | null }
interface Draw { vao: WebGLVertexArrayObject; count: number; indexed: boolean; instances?: number; mode?: number }

interface RenderState {
  vp: M4;
  eye: number[];
  right: number[];
  up: number[];
  time: number;
  look: TodLook;
  routeReveal: number;
  routeHead: number;
  routeVisible: number; // 0 none, 1 preview, 2 travel
  ringVisible: boolean;
  serp: [number, number, number, number];
}

class Gfx {
  readonly gl: GL;
  private bufs: WebGLBuffer[] = [];
  private vaos: WebGLVertexArrayObject[] = [];
  private texs: WebGLTexture[] = [];
  private progs: WebGLProgram[] = [];
  private fbos: WebGLFramebuffer[] = [];
  private ubo: WebGLBuffer;
  private ud = new Float32Array(52);
  private P: Record<string, Prog> = {};
  private D: Record<string, Draw> = {};
  private seaTex: WebGLTexture;
  private sceneFbo: WebGLFramebuffer | null = null;
  private postFbo: WebGLFramebuffer | null = null;
  private colTex: WebGLTexture | null = null;
  private depTex: WebGLTexture | null = null;
  private postTex: WebGLTexture | null = null;
  private routeBuf: WebGLBuffer;
  private ringBuf: WebGLBuffer;
  lowW = 0;
  lowH = 0;
  outW = 0;
  outH = 0;
  lost = false;

  constructor(readonly canvas: HTMLCanvasElement, readonly t: Terrain) {
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false,
      preserveDrawingBuffer: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    const mk = (name: string, vs: string, fs: string) => (this.P[name] = this.program(vs, fs));
    mk('terrain', TERRAIN_VS, TERRAIN_FS);
    mk('sides', SIDES_VS, SIDES_FS);
    mk('table', TABLE_VS, TABLE_FS);
    mk('water', WATER_VS, WATER_FS);
    mk('river', RIVER_VS, RIVER_FS);
    mk('falls', RIVER_VS, FALLS_FS);
    mk('tree', TREE_VS, TREE_FS);
    mk('pts', PTS_VS, PTS_FS);
    mk('fx', FX_VS, FX_FS);
    mk('glow', GLOW_VS, GLOW_FS);
    mk('post', POST_VS, POST_FS);

    this.ubo = this.buffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, this.ud.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo);

    // sea info texture
    this.seaTex = this.texture();
    gl.bindTexture(gl.TEXTURE_2D, this.seaTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, VN, VN, 0, gl.RGBA, gl.UNSIGNED_BYTE, t.sea);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.buildTerrain();
    this.buildSides();
    this.buildTable();
    this.buildWater();
    this.buildRivers();
    this.buildTrees();
    this.buildProps();
    this.buildTrails();
    this.buildFx();
    this.routeBuf = this.buffer();
    this.D.route = this.pointsVao(this.routeBuf, 0);
    this.ringBuf = this.buffer();
    this.D.ring = this.pointsVao(this.ringBuf, 0);
    this.D.post = { vao: this.vao(), count: 3, indexed: false };
  }

  // ---- resource helpers
  private buffer() {
    const b = this.gl.createBuffer();
    if (!b) throw new Error('buffer');
    this.bufs.push(b);
    return b;
  }
  private vao() {
    const v = this.gl.createVertexArray();
    if (!v) throw new Error('vao');
    this.vaos.push(v);
    return v;
  }
  private texture() {
    const t = this.gl.createTexture();
    if (!t) throw new Error('texture');
    this.texs.push(t);
    return t;
  }
  private program(vs: string, fs: string): Prog {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) throw new Error('shader');
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error('map3d shader: ' + log);
      }
      return s;
    };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram();
    if (!p) throw new Error('program');
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('map3d link: ' + gl.getProgramInfoLog(p));
    this.progs.push(p);
    const bi = gl.getUniformBlockIndex(p, 'Frame');
    if (bi !== gl.INVALID_INDEX) gl.uniformBlockBinding(p, bi, 0);
    const cache = new Map<string, WebGLUniformLocation | null>();
    return {
      p,
      u: (name: string) => {
        let l = cache.get(name);
        if (l === undefined) {
          l = gl.getUniformLocation(p, name);
          cache.set(name, l);
        }
        return l;
      },
    };
  }
  private attrib(loc: number, size: number, type: number, norm: boolean, stride: number, off: number, divisor = 0) {
    const gl = this.gl;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, type, norm, stride, off);
    if (divisor) gl.vertexAttribDivisor(loc, divisor);
  }
  private indices(data: Uint16Array | Uint32Array) {
    const gl = this.gl;
    const b = this.buffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }
  private pointsVao(buf: WebGLBuffer, count: number): Draw {
    const gl = this.gl;
    const vao = this.vao();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    this.attrib(0, 4, gl.FLOAT, false, 16, 0);
    gl.bindVertexArray(null);
    return { vao, count, indexed: false, mode: gl.POINTS };
  }

  /** Interleaved terrain-format mesh: pos3, nrm3 (floats), col rgba8, ext rgba8 = 32 bytes. */
  private litMesh(pos: number[], nrm: number[], col: number[], ext: number[], idx: number[]): Draw {
    const gl = this.gl;
    const n = pos.length / 3;
    const ab = new ArrayBuffer(n * 32);
    const f = new Float32Array(ab), b = new Uint8Array(ab);
    for (let i = 0; i < n; i++) {
      f.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]], i * 8);
      b.set([col[i * 4], col[i * 4 + 1], col[i * 4 + 2], col[i * 4 + 3], ext[i * 4], ext[i * 4 + 1], ext[i * 4 + 2], ext[i * 4 + 3]], i * 32 + 24);
    }
    return this.litMeshRaw(ab, n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx));
  }
  private litMeshRaw(ab: ArrayBuffer, idx: Uint16Array | Uint32Array): Draw {
    const gl = this.gl;
    const vao = this.vao();
    gl.bindVertexArray(vao);
    const vb = this.buffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, ab, gl.STATIC_DRAW);
    this.attrib(0, 3, gl.FLOAT, false, 32, 0);
    this.attrib(1, 3, gl.FLOAT, false, 32, 12);
    this.attrib(2, 4, gl.UNSIGNED_BYTE, true, 32, 24);
    this.attrib(3, 4, gl.UNSIGNED_BYTE, true, 32, 28);
    this.indices(idx);
    gl.bindVertexArray(null);
    return { vao, count: idx.length, indexed: true, mode: idx instanceof Uint32Array ? 1 : 0 };
  }

  // ---- geometry
  private buildTerrain() {
    const t = this.t, n = VN;
    const ab = new ArrayBuffer(n * n * 32);
    const f = new Float32Array(ab), b = new Uint8Array(ab);
    const cw = WORLD / GRID;
    const H = (i: number, j: number) => t.h[Math.max(0, Math.min(GRID, j)) * n + Math.max(0, Math.min(GRID, i))];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const hx = ((H(i + 1, j) - H(i - 1, j)) * HS) / (2 * cw);
        const hz = ((H(i, j + 1) - H(i, j - 1)) * HS) / (2 * cw);
        const l = Math.hypot(hx, 1, hz);
        f.set([wx(i / GRID), wy(t.h[k]), wz(j / GRID), -hx / l, 1 / l, -hz / l], k * 8);
        b.set([t.color[k * 3], t.color[k * 3 + 1], t.color[k * 3 + 2], 255, Math.round(t.sun[k] * 255), t.contour[k], 0, t.lava[k]], k * 32 + 24);
      }
    const idx: number[] = [];
    for (let j = 0; j < GRID; j++)
      for (let i = 0; i < GRID; i++) {
        const a = j * n + i, bb = a + 1, c = a + n, d = c + 1;
        if (t.h[a] < -0.04 && t.h[bb] < -0.04 && t.h[c] < -0.04 && t.h[d] < -0.04) continue;
        if (Math.abs(t.h[a] - t.h[d]) < Math.abs(t.h[bb] - t.h[c])) idx.push(a, c, d, a, d, bb);
        else idx.push(a, c, bb, bb, c, d);
      }
    this.D.terrain = this.litMeshRaw(ab, new Uint32Array(idx));
  }

  private buildSides() {
    const gl = this.gl, t = this.t;
    const v: number[] = [], idx: number[] = [];
    const quad = (p: number[][], nr: number[], kind: number) => {
      const base = v.length / 7;
      for (const q of p) v.push(q[0], q[1], q[2], nr[0], nr[1], nr[2], kind);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const edge = (get: (s: number) => [number, number], nr: number[]) => {
      for (let s = 0; s < GRID; s++) {
        const [u0, v0] = get(s), [u1, v1] = get(s + 1);
        const h0 = Math.min(0, t.heightAt(u0, v0)), h1 = Math.min(0, t.heightAt(u1, v1));
        const a = [wx(u0), wz(v0)], b = [wx(u1), wz(v1)];
        quad([[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], wy(h1), b[1]], [a[0], wy(h0), a[1]]], nr, 1);
        quad([[a[0], wy(h0), a[1]], [b[0], wy(h1), b[1]], [b[0], Y_BASE, b[1]], [a[0], Y_BASE, a[1]]], nr, 0);
      }
    };
    edge(s => [s / GRID, 0], [0, 0, -1]);
    edge(s => [s / GRID, 1], [0, 0, 1]);
    edge(s => [0, s / GRID], [-1, 0, 0]);
    edge(s => [1, s / GRID], [1, 0, 0]);
    // wooden plinth
    const A = WORLD / 2, B = A + PLINTH_M, y0 = Y_BASE, y1 = Y_BASE - PLINTH_H;
    quad([[-B, y0, -B], [B, y0, -B], [B, y0, -A], [-B, y0, -A]], [0, 1, 0], 2);
    quad([[-B, y0, A], [B, y0, A], [B, y0, B], [-B, y0, B]], [0, 1, 0], 2);
    quad([[-B, y0, -A], [-A, y0, -A], [-A, y0, A], [-B, y0, A]], [0, 1, 0], 2);
    quad([[A, y0, -A], [B, y0, -A], [B, y0, A], [A, y0, A]], [0, 1, 0], 2);
    quad([[-B, y0, B], [B, y0, B], [B, y1, B], [-B, y1, B]], [0, 0, 1], 2);
    quad([[-B, y0, -B], [B, y0, -B], [B, y1, -B], [-B, y1, -B]], [0, 0, -1], 2);
    quad([[-B, y0, -B], [-B, y0, B], [-B, y1, B], [-B, y1, -B]], [-1, 0, 0], 2);
    quad([[B, y0, -B], [B, y0, B], [B, y1, B], [B, y1, -B]], [1, 0, 0], 2);
    const vao = this.vao();
    gl.bindVertexArray(vao);
    const vb = this.buffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    this.attrib(0, 3, gl.FLOAT, false, 28, 0);
    this.attrib(1, 3, gl.FLOAT, false, 28, 12);
    this.attrib(2, 1, gl.FLOAT, false, 28, 24);
    this.indices(new Uint16Array(idx));
    gl.bindVertexArray(null);
    this.D.sides = { vao, count: idx.length, indexed: true };
  }

  private buildTable() {
    const gl = this.gl;
    const S = 70, y = Y_TABLE;
    const vao = this.vao();
    gl.bindVertexArray(vao);
    const vb = this.buffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-S, y, -S, S, y, -S, S, y, S, -S, y, S]), gl.STATIC_DRAW);
    this.attrib(0, 3, gl.FLOAT, false, 12, 0);
    this.indices(new Uint16Array([0, 1, 2, 0, 2, 3]));
    gl.bindVertexArray(null);
    this.D.table = { vao, count: 6, indexed: true };
  }

  private buildWater() {
    const gl = this.gl;
    const N = 16, v: number[] = [], idx: number[] = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) v.push(i / N, j / N);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i;
        idx.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2);
      }
    const vao = this.vao();
    gl.bindVertexArray(vao);
    const vb = this.buffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    this.attrib(0, 2, gl.FLOAT, false, 8, 0);
    this.indices(new Uint16Array(idx));
    gl.bindVertexArray(null);
    this.D.water = { vao, count: idx.length, indexed: true };
  }

  private ribbon(v: number[], idx: number[], pts: number[][], widthAt: (i: number) => number, yAt: (i: number) => number, alongScale: number) {
    const base = v.length / 5;
    let along = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const tx = b[0] - a[0], tz = b[1] - a[1];
      const L = Math.hypot(tx, tz) || 1;
      const nx = -tz / L, nz = tx / L;
      if (i > 0) along += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * WORLD;
      const w = widthAt(i), y = yAt(i);
      v.push(wx(pts[i][0] + nx * w), y, wz(pts[i][1] + nz * w), -1, along * alongScale);
      v.push(wx(pts[i][0] - nx * w), y, wz(pts[i][1] - nz * w), 1, along * alongScale);
      if (i > 0) {
        const q = base + (i - 1) * 2;
        idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
      }
    }
  }

  private buildRivers() {
    const gl = this.gl, t = this.t;
    const v: number[] = [], idx: number[] = [];
    for (const r of t.rivers) {
      const pts: number[][] = [];
      for (let i = 0; i < r.count; i++) pts.push([r.pts[i * 5], r.pts[i * 5 + 1], r.pts[i * 5 + 2], r.pts[i * 5 + 3]]);
      this.ribbon(v, idx, pts, i => pts[i][3], i => wy(Math.max(pts[i][2], -0.004) + 0.003), 1);
    }
    const mk = (vv: number[], ii: number[]): Draw => {
      const vao = this.vao();
      gl.bindVertexArray(vao);
      const vb = this.buffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vv), gl.STATIC_DRAW);
      this.attrib(0, 3, gl.FLOAT, false, 20, 0);
      this.attrib(1, 2, gl.FLOAT, false, 20, 12);
      this.indices(new Uint16Array(ii));
      gl.bindVertexArray(null);
      return { vao, count: ii.length, indexed: true };
    };
    this.D.river = mk(v, idx);
    // waterfall curtain: drapes over the cliff from the lip to the pool, a little proud of the rock
    const { lip, pool, half } = t.falls;
    const fv: number[] = [], fi: number[] = [];
    const N = 18;
    const pts: number[][] = [];
    for (let s = 0; s <= N; s++) {
      const k = s / N;
      const u = mix(lip[0], pool[0], k), vv = mix(lip[1] - 0.002, pool[1] + 0.002, k);
      pts.push([u, vv]);
    }
    const ys = pts.map((p, s) => {
      const k = s / N;
      const hTerrain = t.heightAt(p[0], p[1]);
      return wy(Math.max(hTerrain, mix(lip[2], pool[2], k * k)) + 0.012);
    });
    const base = fv.length / 5;
    for (let s = 0; s <= N; s++) {
      const w = half * (1 + (s / N) * 0.5);
      const push = 0.004 * Math.sin((s / N) * Math.PI);
      fv.push(wx(pts[s][0] - w), ys[s], wz(pts[s][1] + push), -1, s / N);
      fv.push(wx(pts[s][0] + w), ys[s], wz(pts[s][1] + push), 1, s / N);
      if (s > 0) {
        const q = base + (s - 1) * 2;
        fi.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
      }
    }
    this.D.falls = mk(fv, fi);
  }

  private buildTrees() {
    const gl = this.gl, t = this.t;
    const data = new Float32Array(t.treeCount * 8);
    for (let q = 0; q < t.treeCount; q++) {
      const s = q * TREE_STRIDE;
      data.set([wx(t.trees[s]), wy(t.trees[s + 2]), wz(t.trees[s + 1]), t.trees[s + 3] * WORLD, t.trees[s + 4], t.trees[s + 5], t.trees[s + 6], t.trees[s + 7]], q * 8);
    }
    const vao = this.vao();
    gl.bindVertexArray(vao);
    const qb = this.buffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    this.attrib(0, 2, gl.FLOAT, false, 8, 0);
    const ib = this.buffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.attrib(1, 4, gl.FLOAT, false, 32, 0, 1);
    this.attrib(2, 4, gl.FLOAT, false, 32, 16, 1);
    this.indices(new Uint16Array([0, 1, 2, 0, 2, 3]));
    gl.bindVertexArray(null);
    this.D.trees = { vao, count: 6, indexed: true, instances: t.treeCount };
  }

  private buildProps() {
    const t = this.t;
    const pos: number[] = [], nrm: number[] = [], col: number[] = [], ext: number[] = [], idx: number[] = [];
    const hexc = (s: string) => {
      const v = parseInt(s.slice(1), 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
    };
    type V3 = [number, number, number];
    const face = (p: V3[], c: number[]) => {
      const [a, b, cc] = p;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      const base = pos.length / 3;
      for (const q of p) {
        pos.push(q[0], q[1], q[2]);
        nrm.push(nx, ny, nz);
        col.push(c[0], c[1], c[2], 255);
        ext.push(255, 0, 0, 0);
      }
      for (let i = 1; i < p.length - 1; i++) idx.push(base, base + i, base + i + 1);
    };
    // rotation (yaw, then pitch about x, then roll about z) + translation
    const xf = (o: V3, yaw: number, pitch: number, roll: number) => (p: V3): V3 => {
      let [x, y, z] = p;
      let c = Math.cos(roll), s = Math.sin(roll);
      [x, y] = [x * c - y * s, x * s + y * c];
      c = Math.cos(pitch); s = Math.sin(pitch);
      [y, z] = [y * c - z * s, y * s + z * c];
      c = Math.cos(yaw); s = Math.sin(yaw);
      [x, z] = [x * c + z * s, -x * s + z * c];
      return [o[0] + x, o[1] + y, o[2] + z];
    };
    const box = (T: (p: V3) => V3, c: V3, hs: V3, colr: number[], top?: number[]) => {
      const [cx, cy, cz] = c, [hx, hy, hz] = hs;
      const P = (x: number, y: number, z: number) => T([cx + x * hx, cy + y * hy, cz + z * hz]);
      face([P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1)], top ?? colr);
      face([P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)], colr);
      face([P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1)], colr);
      face([P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1)], colr);
      face([P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)], colr);
    };
    // the wreck of the Southern Wren, listing on the rocks
    const [wu, wv, wyaw] = t.camp.wreck;
    const o: V3 = [wx(wu), wy(Math.max(0, t.heightAt(wu, wv))) + 0.05, wz(wv)];
    const T0 = xf(o, wyaw, -0.1, 0.62);
    const T = (p: V3): V3 => T0([p[0] * 1.45, p[1] * 1.45, p[2] * 1.45]);
    const red = hexc('#c2452f'), white = hexc('#f0eadb'), dark = hexc('#3e2a1e'), deck = hexc('#7a5a3c');
    box(T, [0, 0, 0], [0.19, 0.05, 0.062], red, deck);
    face([T([0.19, 0.05, 0.062]), T([0.19, -0.05, 0.062]), T([0.29, 0.06, 0]), T([0.29, 0.07, 0])], red);
    face([T([0.19, -0.05, -0.062]), T([0.19, 0.05, -0.062]), T([0.29, 0.07, 0]), T([0.29, 0.06, 0])], red);
    face([T([0.19, 0.05, -0.062]), T([0.19, 0.05, 0.062]), T([0.29, 0.07, 0])], deck);
    box(T, [-0.06, 0.09, 0], [0.065, 0.04, 0.045], white, hexc('#c9c2b0'));
    box(T, [-0.1, 0.15, 0], [0.012, 0.03, 0.012], hexc('#e05a3a'));
    box(T, [0.06, 0.16, 0], [0.009, 0.12, 0.009], dark);
    box(xf(T([0.06, 0.24, 0]), wyaw, 0.2, -0.9), [0, 0, 0], [0.009, 0.11, 0.009], dark);
    const rockC = [hexc('#8e8576'), hexc('#6f675b'), hexc('#a39a88')];
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4 + 0.3, r = 0.1 + (i % 3) * 0.06;
      const bu = wu + (Math.cos(a) * r) / WORLD, bv = wv + (Math.sin(a) * r * 0.8) / WORLD;
      const sz = 0.035 + (i % 4) * 0.012;
      box(xf([wx(bu), wy(Math.max(0, t.heightAt(bu, bv))) - sz * 0.3, wz(bv)], a, 0.3, 0.2), [0, 0, 0], [sz, sz * 0.8, sz * 0.9], rockC[i % 3], rockC[(i + 2) % 3]);
    }
    // tents and the fire pit
    const tent = (u: number, v: number, yaw: number, c: number[]) => {
      const h0 = wy(Math.max(0.01, t.heightAt(u, v)));
      const Tt = xf([wx(u), h0, wz(v)], yaw, 0, 0);
      const w = 0.07, L = 0.09, H = 0.1;
      const a: V3 = Tt([-L, 0, -w]), b: V3 = Tt([L, 0, -w]), cc: V3 = Tt([L, 0, w]), d: V3 = Tt([-L, 0, w]);
      const r0: V3 = Tt([-L, H, 0]), r1: V3 = Tt([L, H, 0]);
      const shadeC = c.map((x, i) => (i < 3 ? x * 0.78 : x));
      face([a, b, r1, r0], c);
      face([cc, d, r0, r1], shadeC);
      face([b, cc, r1], shadeC);
      face([d, a, r0], c);
    };
    const tc = [hexc('#e9dcb6'), hexc('#e27c3e'), hexc('#7f8c4c')];
    for (const [u, v, yaw, ci] of t.camp.tents) tent(u, v, yaw, tc[ci]);
    const [fu, fv] = t.camp.fire;
    const fh = wy(t.heightAt(fu, fv));
    box(xf([wx(fu), fh, wz(fv)], 0.4, 0, 0), [0, 0.008, 0], [0.018, 0.008, 0.018], hexc('#4a4038'), hexc('#2a2220'));
    // a flag on the beach so the camp reads from afar
    const flagU = t.camp.fire[0] - 0.012, flagV = t.camp.fire[1] + 0.012;
    const flh = wy(t.heightAt(flagU, flagV));
    box(xf([wx(flagU), flh, wz(flagV)], 0, 0, 0), [0, 0.1, 0], [0.006, 0.1, 0.006], dark);
    box(xf([wx(flagU), flh, wz(flagV)], 0, 0, 0), [0.035, 0.175, 0], [0.03, 0.022, 0.003], hexc('#3fbca6'));
    this.D.props = this.litMesh(pos, nrm, col, ext, idx);
  }

  private buildTrails() {
    const t = this.t;
    const pts: number[] = [];
    for (const line of t.trails) {
      let acc = 0;
      for (let i = 1; i < line.length; i++) {
        acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
        if (acc >= 0.0085) {
          acc = 0;
          const [u, v] = line[i];
          pts.push(wx(u), wy(Math.max(0.005, t.heightAt(u, v))) + 0.02, wz(v), 0);
        }
      }
    }
    const gl = this.gl;
    const b = this.buffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    this.D.trails = this.pointsVao(b, pts.length / 4);
  }

  private buildFx() {
    const gl = this.gl, t = this.t;
    const fx: number[] = [], glow: number[] = [];
    let seed = 1;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const [vu, vv] = t.volcano;
    const vy = wy(t.heightAt(vu, vv)) + 0.2;
    for (let i = 0; i < 56; i++) fx.push(wx(vu) + (rnd() - 0.5) * 0.08, vy, wz(vv) + (rnd() - 0.5) * 0.08, i / 56 + rnd() * 0.01, 0, 9 + rnd() * 2, 0.34, 1.0 + rnd() * 0.35);
    const { pool } = t.falls;
    const py = wy(pool[2]) + 0.03;
    for (let i = 0; i < 34; i++) fx.push(wx(pool[0]) + (rnd() - 0.5) * 0.06, py, wz(pool[1]) + 0.02, i / 34, 1, 1.8 + rnd() * 0.8, 0.13, 1);
    // valley and delta mist banks
    const mist: [number, number][] = [[0.555, 0.32], [0.535, 0.45], [0.54, 0.6], [0.555, 0.74], [0.52, 0.85], [0.6, 0.86], [0.3, 0.5], [0.24, 0.56], [0.4, 0.62]];
    for (const [u, v] of mist) {
      const y = wy(Math.max(0.02, t.heightAt(u, v))) + 0.12;
      fx.push(wx(u), y, wz(v), rnd(), 2, 1, 1.3 + rnd() * 0.6, 1);
    }
    const [cu, cv] = t.camp.fire;
    const cy = wy(t.heightAt(cu, cv)) + 0.03;
    for (let i = 0; i < 12; i++) fx.push(wx(cu), cy, wz(cv), i / 12, 3, 3.2, 0.05, 1);
    // birds: cliff swifts over the falls, seabirds along the east coast
    const { lip } = t.falls;
    for (let i = 0; i < 5; i++) fx.push(wx(lip[0]) + (rnd() - 0.5) * 0.6, wy(lip[2]) + 0.35 + rnd() * 0.3, wz(lip[1]) + 0.2, rnd(), 5, 1, 0.1, 0.5 + rnd() * 0.5);
    for (let i = 0; i < 4; i++) fx.push(wx(0.9) + (rnd() - 0.5) * 0.4, 0.55 + rnd() * 0.3, wz(0.55) + (rnd() - 0.5) * 1.2, rnd(), 5, 1, 0.12, -(0.3 + rnd() * 0.3));
    const [mu, mv] = t.mudPools;
    const my = wy(t.heightAt(mu, mv)) + 0.02;
    for (let i = 0; i < 10; i++) fx.push(wx(mu) + (rnd() - 0.5) * 0.12, my, wz(mv) + (rnd() - 0.5) * 0.1, i / 10, 4, 2.4 + rnd(), 0.08, 1);
    // glows: campfire, lava, glowworms
    glow.push(wx(cu), cy + 0.03, wz(cv), 0.3, 0, 0.7, 1.0, 0);
    glow.push(wx(vu), vy - 0.24, wz(vv), 0.7, 1, 0.42, 0.8, 0);
    for (let i = 0; i < 3; i++) glow.push(wx(vu) + (rnd() - 0.5) * 0.12, vy - 0.24, wz(vv) + (rnd() - 0.5) * 0.12, rnd(), 1, 0.16, 0.8, 0);
    const gw = t.features.find(f => f.id === 'glowworm');
    if (gw) {
      const gy = wy(t.heightAt(gw.u, gw.v));
      for (let i = 0; i < 7; i++) glow.push(wx(gw.u) + (rnd() - 0.5) * 0.18, gy + 0.03 + rnd() * 0.12, wz(gw.v) + (rnd() - 0.2) * 0.1, rnd(), 2, 0.12 + rnd() * 0.08, 1, 0);
    }
    const mk = (arr: number[]): Draw => {
      const vao = this.vao();
      gl.bindVertexArray(vao);
      const b = this.buffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      this.attrib(0, 4, gl.FLOAT, false, 32, 0);
      this.attrib(1, 4, gl.FLOAT, false, 32, 16);
      gl.bindVertexArray(null);
      return { vao, count: arr.length / 8, indexed: false, mode: gl.POINTS };
    };
    this.D.fx = mk(fx);
    this.D.glow = mk(glow);
  }

  setRoute(pts: Float32Array) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.routeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pts, gl.DYNAMIC_DRAW);
    this.D.route.count = pts.length / 4;
  }
  setRing(pts: Float32Array) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ringBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pts, gl.DYNAMIC_DRAW);
    this.D.ring.count = pts.length / 4;
  }

  resize(lowW: number, lowH: number, outW: number, outH: number) {
    const gl = this.gl;
    this.canvas.width = outW;
    this.canvas.height = outH;
    this.outW = outW;
    this.outH = outH;
    if (lowW === this.lowW && lowH === this.lowH && this.sceneFbo) return;
    this.lowW = lowW;
    this.lowH = lowH;
    for (const f of this.fbos) gl.deleteFramebuffer(f);
    this.fbos = [];
    for (const tx of [this.colTex, this.depTex, this.postTex]) if (tx) gl.deleteTexture(tx);
    const tex = (internal: number, format: number, type: number) => {
      const tx = gl.createTexture();
      if (!tx) throw new Error('texture');
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, lowW, lowH, 0, format, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tx;
    };
    this.colTex = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    this.depTex = tex(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
    this.postTex = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const fb = (color: WebGLTexture, depth: WebGLTexture | null) => {
      const f = gl.createFramebuffer();
      if (!f) throw new Error('fbo');
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
      if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('map3d framebuffer incomplete');
      this.fbos.push(f);
      return f;
    };
    this.sceneFbo = fb(this.colTex, this.depTex);
    this.postFbo = fb(this.postTex, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private draw(d: Draw) {
    const gl = this.gl;
    gl.bindVertexArray(d.vao);
    const mode = d.mode === gl.POINTS ? gl.POINTS : gl.TRIANGLES;
    if (d.instances !== undefined) gl.drawElementsInstanced(gl.TRIANGLES, d.count, gl.UNSIGNED_SHORT, 0, d.instances);
    else if (d.indexed) gl.drawElements(gl.TRIANGLES, d.count, d.mode === 1 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
    else if (d.count > 0) gl.drawArrays(mode, 0, d.count);
  }

  render(s: RenderState) {
    const gl = this.gl;
    if (this.lost || gl.isContextLost() || !this.sceneFbo || !this.postFbo) return;
    const L = s.look;
    const u = this.ud;
    u.set(s.vp, 0);
    u.set([s.eye[0], s.eye[1], s.eye[2], s.time % 3600], 16);
    u.set([s.right[0], s.right[1], s.right[2], this.lowH / (2 * Math.tan(FOV / 2))], 20);
    u.set([s.up[0], s.up[1], s.up[2], HS], 24);
    u.set([SUN[0], SUN[1], SUN[2], L.sunK], 28);
    u.set([L.sun[0], L.sun[1], L.sun[2], L.night], 32);
    u.set([L.amb[0], L.amb[1], L.amb[2], L.mist], 36);
    u.set([L.sky[0], L.sky[1], L.sky[2], L.vignette], 40);
    u.set([L.clouds, this.lowW, this.lowH, 0], 44);
    u.set([L.glint[0], L.glint[1], L.glint[2], 0], 48);
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, u);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
    gl.viewport(0, 0, this.lowW, this.lowH);
    gl.clearColor(L.sky[0], L.sky[1], L.sky[2], 1);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    const use = (name: string) => {
      const p = this.P[name];
      gl.useProgram(p.p);
      return p;
    };
    use('table');
    this.draw(this.D.table);
    use('sides');
    this.draw(this.D.sides);
    use('terrain');
    this.draw(this.D.terrain);
    this.draw(this.D.props);
    use('tree');
    this.draw(this.D.trees);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-1, -4);
    use('river');
    this.draw(this.D.river);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    const w = use('water');
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.seaTex);
    gl.uniform1i(w.u('uSea'), 0);
    gl.uniform4f(w.u('uSerp'), s.serp[0], s.serp[1], s.serp[2], s.serp[3]);
    this.draw(this.D.water);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-2, -8);
    use('falls');
    this.draw(this.D.falls);
    gl.disable(gl.POLYGON_OFFSET_FILL);

    const pts = use('pts');
    const pxK = Math.max(1, Math.round(this.lowH / 240));
    gl.uniform4f(pts.u('uR'), 2, pxK * 1.0, 0, 0.22);
    gl.uniform4f(pts.u('uC'), 0.42, 0.24, 0.13, 1);
    gl.uniform1f(pts.u('uHead'), 0);
    this.draw(this.D.trails);
    if (s.ringVisible && this.D.ring.count) {
      gl.uniform4f(pts.u('uR'), 2, pxK * 2, 3, 0.25);
      gl.uniform4f(pts.u('uC'), 0.96, 0.7, 0.24, 1);
      this.draw(this.D.ring);
    }
    if (s.routeVisible && this.D.route.count) {
      const travel = s.routeVisible === 2;
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform4f(pts.u('uR'), s.routeReveal, pxK * (travel ? 8 : 5), 2, 0.45);
      gl.uniform4f(pts.u('uC'), 0.95, 0.6, 0.2, travel ? 0.55 : 0.28);
      this.draw(this.D.route);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.uniform4f(pts.u('uR'), s.routeReveal, pxK * 2, 1, 0.45);
      gl.uniform4f(pts.u('uC'), travel ? 0.97 : 0.9, travel ? 0.72 : 0.62, travel ? 0.26 : 0.26, travel ? 1 : 0);
      gl.uniform1f(pts.u('uHead'), s.routeHead);
      this.draw(this.D.route);
    }

    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    use('fx');
    this.draw(this.D.fx);
    gl.blendFunc(gl.ONE, gl.ONE);
    use('glow');
    this.draw(this.D.glow);
    gl.disable(gl.BLEND);
    gl.depthMask(true);

    // post: outlines + vignette into a second low-res target, then a nearest blit to the canvas
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.postFbo);
    gl.viewport(0, 0, this.lowW, this.lowH);
    const p = use('post');
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.colTex);
    gl.uniform1i(p.u('uColT'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.depTex);
    gl.uniform1i(p.u('uDepT'), 1);
    this.draw(this.D.post);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.postFbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, this.lowW, this.lowH, 0, 0, this.outW, this.outH, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    if (!gl.isContextLost()) {
      for (const b of this.bufs) gl.deleteBuffer(b);
      for (const v of this.vaos) gl.deleteVertexArray(v);
      for (const t of this.texs) gl.deleteTexture(t);
      for (const t of [this.colTex, this.depTex, this.postTex]) if (t) gl.deleteTexture(t);
      for (const f of this.fbos) gl.deleteFramebuffer(f);
      for (const p of this.progs) gl.deleteProgram(p);
    }
    this.bufs = [];
    this.vaos = [];
    this.texs = [];
    this.fbos = [];
    this.progs = [];
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

// ------------------------------------------------------------------ pixel sprites

const spriteCache = new Map<string, string>();
function sprite(key: string, rows: string[], pal: Record<string, string>): string {
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return '';
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const col = pal[rows[y][x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  const url = c.toDataURL();
  spriteCache.set(key, url);
  return url;
}
const PIN_ROWS = [
  '..kkkkk..',
  '.kaaaaak.',
  'kaawaaaak',
  'kawoooask',
  'kaaoooask',
  'kaaoooask',
  'kaaaaaask',
  '.kaaaaak.',
  '.kkaaskk.',
  '..kaask..',
  '...kak...',
  '...kak...',
  '....k....',
];
const PIN_PAL: Record<string, Record<string, string>> = {
  open: { k: '#2a1d12', a: '#e8614a', s: '#b3402f', w: '#ffb8a0', o: '#fff4dc' },
  sel: { k: '#2a1d12', a: '#f4b43c', s: '#c4862a', w: '#ffe9ac', o: '#fff8e4' },
  here: { k: '#12251f', a: '#3fbca6', s: '#2a8a79', w: '#aaf6e7', o: '#f1fff9' },
  locked: { k: '#2a2419', a: '#8f8775', s: '#6c6556', w: '#b8b09e', o: '#5a5447' },
};
const pinSprite = (kind: string) => sprite('pin-' + kind, PIN_ROWS, PIN_PAL[kind]);
const caveSprite = () =>
  sprite('cave', ['...kkk...', '..kRRRk..', '.kRRrrrk.', 'kRrkdkrrk', 'krkdddkrk', 'krkdddkrk', 'kkkdddkkk'], { k: '#231a12', R: '#b9ad99', r: '#857a68', d: '#0c0907' });
const hazardSprite = () =>
  sprite('hazard', ['....k....', '...kyk...', '...kyk...', '..kyKyk..', '..kyKyk..', '.kyyyyyk.', '.kyyKyyk.', 'kkkkkkkkk'], { k: '#231a12', y: '#f4b43c', K: '#231a12' });
const snareSprite = () =>
  sprite('snare', ['....k....', '...kck...', '...kck...', '..kcwck..', '..kwcwk..', '.kcwcwck.', '.kccwcck.', 'kkkkkkkkk'], { k: '#231a12', c: '#e8614a', w: '#fff1d6' });
const HIKER_A = [
  '..KK.....hh..',
  '.KKKK...hhhs.',
  '..ss....hss..',
  '.booc...httsw',
  '.boos....tt.w',
  '.boo.....tt.w',
  '..pp.....pp.w',
  '.p..p...p..pw',
  '.k..k...k..kw',
];
const HIKER_B = HIKER_A.slice(0, 7).concat(['..pp.....pp.w', '..kk.....kk.w']);
const hikerSprite = () =>
  sprite('hiker', HIKER_A.map((r, i) => r + HIKER_B[i]), {
    K: '#d4b466', h: '#221612', s: '#c68a5e', o: '#6f8a3e', b: '#8a5a34', c: '#1c1c1c', t: '#2f8a78', p: '#3b3f52', k: '#1a1410', w: '#9a7440',
  });
const trailSprite = () => sprite('trail', ['k.k.k.k'], { k: '#6b3d22' });

/** Draws a small pixel compass rose rotated so its needle points to map north on screen. */
function drawCompass(g: CanvasRenderingContext2D, S: number, ang: number) {
  const img = g.createImageData(S, S);
  const c = (S - 1) / 2;
  const put = (x: number, y: number, col: number[]) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const o = (y * S + x) * 4;
    img.data[o] = col[0];
    img.data[o + 1] = col[1];
    img.data[o + 2] = col[2];
    img.data[o + 3] = 255;
  };
  const ink = [43, 32, 22], paper = [244, 234, 208], paper2 = [226, 212, 176], coral = [214, 84, 60], coral2 = [150, 50, 36], pale = [200, 186, 150];
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x - c, dy = y - c;
      const r = Math.hypot(dx, dy);
      if (r > c + 0.3) continue;
      if (r > c - 1.1) { put(x, y, ink); continue; }
      // rotate screen offset into compass space (north = -ly)
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
      let col = r > c - 2.4 ? paper2 : paper;
      if (Math.abs(r - (c - 4.2)) < 0.5) col = pale;
      const arm = (ax: number, ay: number, len: number, wid: number) => {
        const along = lx * ax + ly * ay, across = -lx * ay + ly * ax;
        if (along < 0 || along > len) return 0;
        const w = wid * (1 - along / len);
        if (Math.abs(across) > w) return 0;
        return across < 0 ? 1 : 2;
      };
      const L = c - 1.6, Ls = c * 0.55;
      let hit = 0, north = false;
      for (const [ax, ay, len, wid] of [[0, -1, L, 2.4], [0, 1, L, 2.4], [1, 0, L, 2.4], [-1, 0, L, 2.4], [0.707, 0.707, Ls, 1.6], [-0.707, 0.707, Ls, 1.6], [0.707, -0.707, Ls, 1.6], [-0.707, -0.707, Ls, 1.6]]) {
        const hh = arm(ax, ay, len, wid);
        if (hh) {
          hit = hh;
          north = ay === -1 && ax === 0;
          break;
        }
      }
      if (hit) col = north ? (hit === 1 ? coral : coral2) : hit === 1 ? ink : [120, 100, 76];
      put(x, y, col);
    }
  g.putImageData(img, 0, 0);
}

// ------------------------------------------------------------------ CSS

const CSS = `
.m3d{position:absolute;inset:0;z-index:60;pointer-events:auto;display:flex;flex-direction:column;color:var(--paper,#f1e8d0);font-family:var(--body,system-ui);
  background:radial-gradient(120% 95% at 50% 42%,#1c332e 0%,#0f1c19 60%,#070d0c 100%);opacity:0;transition:opacity .28s ease;-webkit-user-select:none;user-select:none}
.m3d.on{opacity:1}
.m3d.bye{opacity:0;transition-duration:.3s}
.m3d *{box-sizing:border-box}
.m3d .m3d-fade{position:absolute;inset:0;background:#05080a;opacity:0;pointer-events:none;transition:opacity .35s ease-in;z-index:9}
.m3d .m3d-fade.on{opacity:1}
.m3d-stage{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 21.5em;gap:18px;padding:18px}
.m3d-frame{position:relative;min-width:0;min-height:0;padding:12px;
  background:radial-gradient(90% 70% at 22% 16%,rgba(255,252,238,.55),transparent 70%),radial-gradient(80% 80% at 88% 96%,rgba(122,86,44,.3),transparent 60%),
  repeating-linear-gradient(0deg,rgba(90,70,40,.04) 0 2px,transparent 2px 5px),linear-gradient(180deg,#eee0bb,#dcc899);
  box-shadow:0 0 0 2px #2c241a,0 0 0 5px #c2ad7c,0 0 0 7px #2c241a,0 18px 44px rgba(0,0,0,.6)}
.m3d-frame::before,.m3d-frame::after{content:'';position:absolute;width:30px;height:30px;pointer-events:none;z-index:2;
  background:linear-gradient(#3b3226,#3b3226) 0 0/100% 3px no-repeat,linear-gradient(#3b3226,#3b3226) 0 0/3px 100% no-repeat,linear-gradient(#b5552e,#b5552e) 6px 6px/6px 6px no-repeat}
.m3d-frame::before{left:3px;top:3px}
.m3d-frame::after{right:3px;bottom:3px;transform:rotate(180deg)}
.m3d-view{position:absolute;inset:12px;overflow:hidden;background:#d8c79c;box-shadow:inset 0 0 0 2px #3b3226;cursor:grab;touch-action:none;outline:none}
.m3d-view.drag{cursor:grabbing}
.m3d-view:focus-visible{box-shadow:inset 0 0 0 2px #3b3226,inset 0 0 0 5px var(--teal2,#8ff0dc)}
.m3d-view>canvas.m3d-gl{position:absolute;left:0;top:0;display:block;image-rendering:pixelated}
.m3d-layer{position:absolute;inset:0;pointer-events:none}
.m3d-inner{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 2px #3b3226,inset 0 0 40px rgba(40,24,8,.28)}
.m3d-pin{position:absolute;left:0;top:0;z-index:2;display:flex;flex-direction:column;align-items:center;pointer-events:auto;background:none;border:0;padding:0;margin:0;cursor:pointer;
  will-change:transform;font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}
.m3d-pin .ic{width:27px;height:39px;image-rendering:pixelated;display:block;filter:drop-shadow(0 3px 0 rgba(20,12,4,.38));transition:transform .12s steps(2)}
.m3d-pin .lb{margin-bottom:4px;font-family:var(--pix,monospace);font-size:.8em;line-height:1;padding:3px 6px 4px;color:#2a1f14;background:#f4ead0;white-space:nowrap;
  box-shadow:0 0 0 2px #2c241a,0 3px 0 2px rgba(20,12,4,.3)}
.m3d-pin .yh{display:block;font-size:.72em;color:#1e5c50;margin-top:2px;letter-spacing:.04em}
.m3d-pin:hover .ic,.m3d-pin:focus-visible .ic{transform:translateY(-3px)}
.m3d-pin:focus-visible{outline:none}
.m3d-pin:focus-visible .lb{box-shadow:0 0 0 2px #2c241a,0 0 0 5px var(--teal2,#8ff0dc)}
.m3d.small .m3d-pin .ic{width:18px;height:26px}
.m3d.small .m3d-pin .lb{font-size:.72em;padding:2px 4px 3px}
.m3d.small .m3d-mark img{width:18px}
.m3d.small .m3d-mark span{font-size:.75em}
.m3d.small .m3d-hiker{width:26px;height:18px;background-size:52px 18px}
@keyframes m3dWalkS{0%{background-position:0 0}50%{background-position:-26px 0}}
.m3d.small .m3d-hiker{animation-name:m3dWalkS}
.m3d-pin.sel{z-index:3}
.m3d-pin.sel .lb{background:var(--amber,#f4b43c)}
.m3d-pin.sel .ic{animation:m3dBob .9s steps(3) infinite}
.m3d-pin.here .lb{background:#c9f2e8}
.m3d-pin.locked{cursor:not-allowed}
.m3d-pin.locked .lb{background:#c4baa0;color:#5a5144}
.m3d-pin.occ{opacity:.45}
.m3d-pin.off,.m3d-mark.off,.m3d-land.off{visibility:hidden}
@keyframes m3dBob{50%{transform:translateY(-4px)}}
.m3d-mark{position:absolute;left:0;top:0;z-index:1;display:flex;align-items:center;gap:2px;pointer-events:auto;cursor:help;will-change:transform}
.m3d-mark img{width:27px;height:auto;image-rendering:pixelated;filter:drop-shadow(0 2px 0 rgba(20,12,4,.45));flex:none}
.m3d-mark span{font-family:var(--hand,cursive);font-weight:700;font-size:.86em;line-height:1;color:#2b1d10;white-space:nowrap;
  text-shadow:1px 0 0 #f4ead0,-1px 0 0 #f4ead0,0 1px 0 #f4ead0,0 -1px 0 #f4ead0,1px 1px 0 #f4ead0,-1px -1px 0 #f4ead0,1px -1px 0 #f4ead0,-1px 1px 0 #f4ead0}
.m3d-mark.trap span{display:none}
.m3d-mark.trap:hover span,.m3d-mark.trap:focus-visible span{display:inline}
.m3d-mark.occ{opacity:.5}
.m3d-mark.cave.nolab span{display:none}
.m3d-mark.cave.nolab:hover span{display:inline}
.m3d-land.hide{visibility:hidden}
.m3d-land{position:absolute;left:0;top:0;font-family:var(--hand,cursive);font-weight:700;font-style:italic;color:#3b2716;white-space:nowrap;will-change:transform;pointer-events:none;
  letter-spacing:.02em;text-shadow:1px 0 0 rgba(244,234,208,.85),-1px 0 0 rgba(244,234,208,.85),0 1px 0 rgba(244,234,208,.85),0 -1px 0 rgba(244,234,208,.85)}
.m3d-land.sea{color:#0e3a44;text-shadow:1px 0 0 rgba(210,245,236,.8),-1px 0 0 rgba(210,245,236,.8),0 1px 0 rgba(210,245,236,.8),0 -1px 0 rgba(210,245,236,.8)}
.m3d-land.occ{opacity:.35}
.m3d-tip{position:absolute;left:0;top:0;max-width:17em;padding:7px 10px 8px;background:#f7eed6;color:#2a1f14;font-size:.84em;line-height:1.35;pointer-events:none;
  box-shadow:0 0 0 2px #2c241a,0 4px 0 2px rgba(0,0,0,.28);opacity:0;transition:opacity .12s;z-index:5}
.m3d-tip.on{opacity:1}
.m3d-tip b{display:block;font-family:var(--pix,monospace);font-weight:600;font-size:1.02em;margin-bottom:2px;color:#8a3c1e}
.m3d-hiker{position:absolute;left:0;top:0;z-index:4;width:39px;height:27px;background-size:78px 27px;background-repeat:no-repeat;image-rendering:pixelated;pointer-events:none;
  will-change:transform;filter:drop-shadow(0 2px 0 rgba(0,0,0,.45));display:none;animation:m3dWalk .44s steps(1) infinite}
.m3d-hiker.on{display:block}
.m3d-hiker.flip{scale:-1 1}
@keyframes m3dWalk{0%{background-position:0 0}50%{background-position:-39px 0}}
.m3d-title{position:absolute;left:12px;top:12px;padding:6px 12px 7px;background:#f4ead0;color:#2a1f14;box-shadow:0 0 0 2px #2c241a,0 4px 0 2px rgba(0,0,0,.25);pointer-events:none;z-index:3}
.m3d-title b{display:block;font-family:var(--pix,monospace);font-size:1.2em;letter-spacing:.14em;line-height:1.1}
.m3d-title span{font-family:var(--hand,cursive);font-size:.9em;color:#7a4a26}
.m3d-x{position:absolute;right:12px;top:12px;z-index:4;width:2.5em;height:2.5em;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;border:0;
  background:#1b2d27;color:#f4ead0;font-family:var(--pix,monospace);font-size:1em;box-shadow:0 0 0 2px #f4ead0,0 0 0 4px #2c241a,0 4px 0 3px rgba(0,0,0,.3)}
.m3d-x:hover{background:#b5552e}
.m3d-x:focus-visible{outline:3px solid var(--teal2,#8ff0dc);outline-offset:4px}
.m3d-compass{position:absolute;right:14px;bottom:14px;width:75px;height:75px;image-rendering:pixelated;pointer-events:none;z-index:3;filter:drop-shadow(0 3px 0 rgba(0,0,0,.28))}
.m3d-loading{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family:var(--hand,cursive);font-size:1.2em;color:#5a3c22}
.m3d-compass-n{position:absolute;right:51px;bottom:51px;width:14px;margin:0 -7px -7px 0;text-align:center;line-height:14px;font-family:var(--pix,monospace);font-size:.8em;color:#2a1f14;pointer-events:none;z-index:3;
  text-shadow:1px 0 0 #f4ead0,-1px 0 0 #f4ead0,0 1px 0 #f4ead0,0 -1px 0 #f4ead0}
.m3d-view.travel .m3d-legend,.m3d-view.travel .m3d-mark.trap,.m3d-view.travel .m3d-note{opacity:0;transition:opacity .3s}
.m3d-legend{position:absolute;left:12px;bottom:12px;padding:6px 9px 7px;background:rgba(244,234,208,.94);color:#2a1f14;font-size:.74em;line-height:1.1;pointer-events:none;z-index:3;
  box-shadow:0 0 0 2px #2c241a,0 4px 0 2px rgba(0,0,0,.22);display:grid;grid-template-columns:auto auto;gap:3px 7px;align-items:center}
.m3d-legend img{width:18px;image-rendering:pixelated;justify-self:center}
.m3d-legend .t{font-family:var(--pix,monospace);grid-column:1/-1;font-size:1.05em;letter-spacing:.1em;color:#7a4a26;margin-bottom:1px}
.m3d-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);padding:5px 10px;background:rgba(16,32,28,.82);color:#f4ead0;font-family:var(--pix,monospace);font-size:.78em;
  white-space:nowrap;pointer-events:none;transition:opacity .4s;z-index:3}
.m3d-hint.gone{opacity:0}
.m3d-skip{position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:5px 10px;background:rgba(16,32,28,.82);color:#f4ead0;font-family:var(--pix,monospace);font-size:.78em;
  white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .3s;z-index:6}
.m3d-skip.on{opacity:1}
.m3d-say{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:min(92%,620px);display:flex;align-items:flex-end;gap:14px;pointer-events:none;opacity:0;transition:opacity .2s;z-index:7}
.m3d-say.on{opacity:1}
.m3d-say .pt{width:76px;height:76px;flex:none;overflow:hidden;background:radial-gradient(circle at 50% 38%,#3b6357,#182d27);box-shadow:0 0 0 2px #f4ead0,0 0 0 4px #2c241a,0 5px 0 3px rgba(0,0,0,.3)}
.m3d-say .pt img{width:100%;height:100%;object-fit:cover;object-position:50% 20%;image-rendering:pixelated;display:block}
.m3d-say .bb{position:relative;flex:1;min-width:0;background:#f7eed6;color:#2a1f14;padding:9px 14px 11px;font-size:1.02em;line-height:1.38;margin-bottom:8px;text-wrap:pretty;
  box-shadow:0 0 0 2px #2c241a,0 5px 0 2px rgba(0,0,0,.28)}
.m3d-say .bb::before{content:'';position:absolute;left:-12px;bottom:12px;width:12px;height:12px;background:#f7eed6;clip-path:polygon(100% 0,0 60%,100% 100%)}
.m3d-say .bb::after{content:'';position:absolute;left:-16px;bottom:10px;width:14px;height:16px;background:#2c241a;clip-path:polygon(100% 0,0 58%,100% 100%);z-index:-1}
.m3d-say .nm{display:block;font-family:var(--pix,monospace);color:#a8492a;font-size:.84em;letter-spacing:.06em;margin-bottom:2px}
.m3d-say .bb.pop{animation:m3dPop .24s steps(4)}
@keyframes m3dPop{from{transform:translateY(5px);opacity:.75}}
.m3d-side{position:relative;min-height:0;overflow:auto;padding:1.15em 1.2em 1.05em;display:flex;flex-direction:column;transition:opacity .25s}
.m3d-side.busy{opacity:.55;pointer-events:none}
.m3d-side .eb{font-family:var(--pix,monospace);color:var(--teal2,#8ff0dc);font-size:.76em;letter-spacing:.12em;text-transform:uppercase;margin-top:.9em}
.m3d-side .eb:first-child{margin-top:0}
.m3d-side h2{font-family:var(--pix,monospace);font-weight:600;color:var(--amber2,#ffd57a);font-size:1.55em;margin:.1em 0 .15em;line-height:1.1;text-wrap:balance}
.m3d-side .ds{font-size:.94em;line-height:1.5;opacity:.9;margin:.15em 0 .1em;text-wrap:pretty}
.m3d-side .here{display:inline-block;font-family:var(--pix,monospace);font-size:.74em;color:var(--ink,#10201c);background:var(--teal,#3fbca6);padding:2px 6px;margin-top:.35em;letter-spacing:.06em}
.m3d-fauna{display:flex;flex-wrap:wrap;gap:6px;margin:.4em 0 .1em}
.m3d-fauna .fa{height:2.7em;min-width:2.7em;padding:4px;background:rgba(241,232,208,.07);box-shadow:inset 0 0 0 1px rgba(241,232,208,.16);display:flex;align-items:center;justify-content:center}
.m3d-fauna img{height:100%;max-width:5.5em;object-fit:contain;image-rendering:pixelated;display:block}
.m3d-fauna .fa.unk img{filter:brightness(0);opacity:.8}
.m3d-fauna .none{font-size:.85em;opacity:.6;font-style:italic}
.m3d-times{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:.45em 0 .1em}
.m3d-times .btn{font-size:.9em;padding:.5em .5em .55em;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;min-height:2.6em}
.m3d-times .btn.on{background:var(--teal,#3fbca6);color:var(--ink,#10201c);box-shadow:inset 0 -4px 0 rgba(0,0,0,.22),0 3px 0 rgba(0,0,0,.4)}
.m3d-times .btn small{font-family:var(--body,system-ui);font-size:.72em;opacity:.85;margin-top:3px;white-space:normal;text-align:center}
.m3d-route{font-size:.86em;line-height:1.45;opacity:.9;margin:.8em 0 0;padding:.5em .65em;background:rgba(241,232,208,.06);box-shadow:inset 0 0 0 1px rgba(241,232,208,.12)}
.m3d-route b{color:var(--amber2,#ffd57a);font-weight:500}
.m3d-route .hz{color:#ffb39f}
.m3d-grow{flex:1;min-height:.6em}
.m3d-go{width:100%;margin-top:.8em;font-size:1.12em}
.m3d-stay{width:100%;margin-top:7px}
.m3d-list{display:flex;flex-wrap:wrap;gap:6px;margin:.4em 0 .2em}
.m3d-list .btn{font-size:.85em;padding:.4em .7em}
.m3d-list .btn.on{background:var(--amber,#f4b43c);color:var(--ink,#10201c)}
.m3d-note{position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:5px 10px;background:rgba(244,234,208,.94);color:#2a1f14;font-size:.8em;box-shadow:0 0 0 2px #2c241a;z-index:3;white-space:nowrap}
.m3d-flat{position:absolute;image-rendering:pixelated;box-shadow:0 0 0 2px #3b3226,0 8px 18px rgba(40,24,8,.35)}
@media (max-width:760px){
  .m3d{overflow-y:auto;overflow-x:hidden;display:block}
  .m3d-stage{display:flex;flex-direction:column;padding:12px;gap:16px;min-height:100%}
  .m3d-frame{height:min(62vh,540px);flex:none}
  .m3d-side{overflow:visible;flex:none}
  .m3d-legend,.m3d-land,.m3d-compass-n{display:none}
  .m3d-compass{width:54px;height:54px}
  .m3d-say .pt{width:58px;height:58px}
  .m3d-say .bb{font-size:.95em}
  .m3d-title b{font-size:1em}
  .m3d-title span{display:none}
  .m3d-hint{display:none}
}
@media (prefers-reduced-motion:reduce){
  .m3d,.m3d-say,.m3d-tip,.m3d-side{transition:none}
  .m3d-pin.sel .ic,.m3d-hiker,.m3d-say .bb.pop{animation:none}
}
`;
let styled = false;
function injectStyle() {
  if (styled) return;
  const s = document.createElement('style');
  s.id = 'map3d-style';
  s.textContent = CSS;
  document.head.appendChild(s);
  styled = true;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// ------------------------------------------------------------------ the map view

interface SiteView { site: MapSite; u: number; v: number; el: HTMLButtonElement; x: number; y: number; occ: boolean; off: boolean }
interface MarkView { f: MapFeature; el: HTMLElement; x: number; y: number; occ: boolean; off: boolean }
interface LabelView { text: string; u: number; v: number; lift: number; el: HTMLElement; x: number; y: number; occ: boolean; off: boolean; sea: boolean }
interface Cam { yaw: number; pitch: number; dist: number; tx: number; ty: number; tz: number }
interface Travel {
  t: number;
  T: number;
  to: string;
  tod: TimeOfDay;
  pts: P2[];
  world: number[][];
  cum: number[];
  lines: string[];
  line: number;
  camFrom: Cam;
  camTo: Cam;
  stepAt: number;
  done: boolean;
}

const BUILTIN = new Set(Object.keys(SITE_POS));

class MapView {
  readonly root: HTMLElement;
  private view: HTMLElement;
  private canvas: HTMLCanvasElement;
  private layer: HTMLElement;
  private side: HTMLElement;
  private tip: HTMLElement;
  private hiker: HTMLElement;
  private say: HTMLElement;
  private sayText: HTMLElement;
  private skipEl: HTMLElement;
  private hint: HTMLElement;
  private fade: HTMLElement;
  private compass: HTMLCanvasElement;
  private compassAng = 999;
  private gfx: Gfx | null = null;
  private t!: Terrain;
  private ready = false;
  private loadingEl: HTMLElement;
  private compassN: HTMLElement;
  /** Smoothed JS time per frame in ms (dev diagnostics). */
  jsMs = 0;
  private sites: SiteView[] = [];
  private marks: MarkView[] = [];
  private labels: LabelView[] = [];
  private sel: string;
  private tod: TimeOfDay;
  private look: TodLook;
  cam: Cam = { yaw: YAW0, pitch: 0.86, dist: 20, tx: 0, ty: 0, tz: 0.1 };
  goal: Cam = { yaw: YAW0, pitch: 0.86, dist: 20, tx: 0, ty: 0, tz: 0.1 };
  fitD = 20;
  private lens: [number, number] = [0, 0];
  private vp: M4 = new Float32Array(16);
  private eye = [0, 0, 0];
  private right = [1, 0, 0];
  private up = [0, 1, 0];
  private viewW = 1;
  private viewH = 1;
  private cssPx = 3;
  private canvasCssW = 1;
  private canvasCssH = 1;
  private raf = 0;
  private last = 0;
  private time = 0;
  interacted = false;
  private reduced: boolean;
  private closed = false;
  private travel: Travel | null = null;
  private routeShowKey = '';
  private occTick = 0;
  private flat: { img: HTMLCanvasElement; ov: HTMLCanvasElement; x: number; y: number; s: number } | null = null;
  private ro: ResizeObserver | null = null;
  private drag: { id: number; x: number; y: number; moved: boolean } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { d: number; dist: number } | null = null;
  private suppressClick = false;
  private tipFor: HTMLElement | null = null;
  private serpPhase = 0;
  /** Debug/testing: orbit around this map point instead of the selected site. */
  focus: P2 | null = null;

  constructor(private opts: MapOpenOptions, private done: (r: MapResult) => void) {
    injectStyle();
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const firstOpen = opts.times.find(x => !x.locked);
    this.tod = (opts.times.find(x => x.id === 'day' && !x.locked) ?? firstOpen ?? opts.times[0] ?? { id: 'day' }).id;
    this.look = { ...TOD[this.tod] };
    const candidates = opts.sites.filter(s => s.unlocked && s.id !== opts.from);
    this.sel = (candidates[candidates.length - 1] ?? opts.sites.find(s => s.id === opts.from) ?? opts.sites[0])?.id ?? opts.from;

    // ---- DOM
    const root = (this.root = h('div', 'm3d'));
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Expedition map');
    const stage = root.appendChild(h('div', 'm3d-stage'));
    const frame = stage.appendChild(h('div', 'm3d-frame'));
    const view = (this.view = frame.appendChild(h('div', 'm3d-view')));
    view.tabIndex = 0;
    view.setAttribute('aria-label', 'Map of Zealandia. Drag or use the arrow keys to turn it, scroll or plus and minus to zoom.');
    this.canvas = view.appendChild(h('canvas', 'm3d-gl'));
    this.canvas.setAttribute('aria-hidden', 'true');
    view.appendChild(h('div', 'm3d-inner'));
    this.layer = view.appendChild(h('div', 'm3d-layer'));
    view.appendChild(h('div', 'm3d-title', `<b>ZEALANDIA</b><span>Expedition chart · guided by Aroha</span>`));
    const x = view.appendChild(h('button', 'm3d-x', pxIcon('cross', { scale: 3 })));
    x.setAttribute('aria-label', 'Close map');
    x.title = 'Close (Esc)';
    x.addEventListener('click', () => this.cancel());
    this.compass = view.appendChild(h('canvas', 'm3d-compass'));
    this.compass.width = 25;
    this.compass.height = 25;
    this.compassN = view.appendChild(h('div', 'm3d-compass-n', 'N'));
    const leg = view.appendChild(h('div', 'm3d-legend'));
    leg.innerHTML = `<div class="t">LEGEND</div><img src="${pinSprite('open')}" alt=""><span>Expedition site</span><img src="${caveSprite()}" alt=""><span>Cave</span>` +
      `<img src="${snareSprite()}" alt=""><span>Snare line</span><img src="${hazardSprite()}" alt=""><span>Natural hazard</span><img src="${trailSprite()}" alt="" style="width:21px"><span>Trail</span>`;
    this.hint = view.appendChild(h('div', 'm3d-hint', 'Drag to turn · Scroll to zoom · Pick a pin'));
    this.skipEl = view.appendChild(h('div', 'm3d-skip', 'Click or press Space to skip'));
    this.hiker = view.appendChild(h('div', 'm3d-hiker'));
    this.hiker.style.backgroundImage = `url(${hikerSprite()})`;
    this.say = view.appendChild(h('div', 'm3d-say'));
    this.say.setAttribute('aria-live', 'polite');
    const pt = this.say.appendChild(h('div', 'pt'));
    const img = pt.appendChild(h('img'));
    img.src = opts.guidePortrait;
    img.alt = 'Aroha';
    const bb = this.say.appendChild(h('div', 'bb'));
    bb.appendChild(h('span', 'nm', 'AROHA'));
    this.sayText = bb.appendChild(h('span', 'tx'));
    this.tip = view.appendChild(h('div', 'm3d-tip'));
    this.fade = root.appendChild(h('div', 'm3d-fade'));
    this.side = stage.appendChild(h('aside', 'm3d-side panel'));
    this.loadingEl = view.appendChild(h('div', 'm3d-loading', 'Unrolling Aroha’s chart…'));

    const host = document.getElementById('ui') ?? document.body;
    host.appendChild(root);
    window.addEventListener('keydown', this.onKey, true);
    root.addEventListener('pointerdown', () => {
      if (this.travel) this.skipTravel();
    });
    requestAnimationFrame(() => root.classList.add('on'));
    this.opts.onSfx?.('uiOpen');
    // build the terrain and GL scene after the overlay has had a chance to paint
    requestAnimationFrame(() => setTimeout(() => this.init(), 0));
  }

  private init() {
    if (this.closed) return;
    const opts = this.opts, view = this.view;
    this.t = buildTerrain({ hRel: HS / WORLD, sun: SUN });
    this.loadingEl.remove();

    // ---- sites, marks and labels
    for (const s of opts.sites) {
      const p = BUILTIN.has(s.id) ? SITE_POS[s.id] : ([clamp(s.pos[0], 0.02, 0.98), clamp(s.pos[1], 0.02, 0.98)] as P2);
      const el = h('button', 'm3d-pin');
      el.type = 'button';
      this.layer.appendChild(el);
      const sv: SiteView = { site: s, u: p[0], v: p[1], el, x: -1e4, y: -1e4, occ: false, off: false };
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (this.suppressClick) return;
        this.pick(s.id);
      });
      el.addEventListener('pointerenter', () => this.showTip(el, s.unlocked ? s.name : 'Unexplored', s.unlocked ? (s.id === opts.from ? 'You are here.' : 'Click to plan a trip.') : 'Aroha hasn’t taken you here yet.'));
      el.addEventListener('pointerleave', () => this.hideTip(el));
      this.sites.push(sv);
    }
    for (const f of this.t.features) {
      const el = h('div', 'm3d-mark ' + (f.kind === 'cave' ? 'cave' : 'trap'));
      el.innerHTML = `<img src="${f.kind === 'cave' ? caveSprite() : f.kind === 'snare' ? snareSprite() : hazardSprite()}" alt=""><span>${esc(f.name)}</span>`;
      el.setAttribute('aria-label', f.name + '. ' + f.note);
      el.addEventListener('pointerenter', () => this.showTip(el, f.name, f.note));
      el.addEventListener('pointerleave', () => this.hideTip(el));
      this.layer.appendChild(el);
      this.marks.push({ f, el, x: -1e4, y: -1e4, occ: false, off: false });
    }
    for (const l of this.t.labels) {
      const sea = l.text.includes('Reef') || l.text.includes('Cove');
      const el = h('div', 'm3d-land' + (sea ? ' sea' : ''), esc(l.text));
      el.style.fontSize = l.size + 'em';
      this.layer.insertBefore(el, this.layer.firstChild);
      this.labels.push({ text: l.text, u: l.u, v: l.v, lift: l.lift, el, x: -1e4, y: -1e4, occ: false, off: false, sea });
    }

    // ---- graphics
    try {
      this.gfx = new Gfx(this.canvas, this.t);
      this.canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        if (this.gfx) this.gfx.lost = true;
        this.enterFlat();
      });
    } catch (err) {
      console.warn('[map3d] falling back to the 2D chart:', err);
      this.gfx?.dispose();
      this.gfx = null;
      try {
        this.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        /* ignore */
      }
      this.enterFlat();
    }

    if (import.meta.env?.DEV && /[?&]map3ddebug/.test(location.search)) (window as unknown as { __map3d?: unknown }).__map3d = this;
    this.bindInput();
    this.renderSide();
    this.updatePins();
    this.layout();
    this.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.layout()) : null;
    this.ro?.observe(view);
    window.addEventListener('resize', this.onResize);
    this.cam = { ...this.goal };
    this.ready = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    setTimeout(() => {
      if (!this.closed) (this.side.querySelector('.m3d-go') as HTMLElement | null)?.focus({ preventScroll: true });
    }, 60);
  }

  // ---------------------------------------------------------------- layout & fallback

  private onResize = () => this.layout();

  private layout() {
    if (this.closed) return;
    const r = this.view.getBoundingClientRect();
    this.viewW = Math.max(1, r.width);
    this.viewH = Math.max(1, r.height);
    const small = this.viewW < 560;
    if (this.root.classList.contains('small') !== small) {
      this.root.classList.toggle('small', small);
      this.sizes.clear();
    }
    if (this.gfx && !this.gfx.lost) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cssPx = this.viewW < 520 ? 2 : 3;
      const S = Math.max(1, Math.round(this.cssPx * dpr));
      const eff = S / dpr; // CSS px per low-res pixel
      const lowW = Math.max(16, Math.ceil(this.viewW / eff));
      const lowH = Math.max(16, Math.ceil(this.viewH / eff));
      this.cssPx = eff;
      this.canvasCssW = lowW * eff;
      this.canvasCssH = lowH * eff;
      this.canvas.style.width = this.canvasCssW + 'px';
      this.canvas.style.height = this.canvasCssH + 'px';
      this.gfx.resize(lowW, lowH, lowW * S, lowH * S);
      this.fitCamera();
    } else if (this.flat) this.layoutFlat();
  }

  private fitCamera() {
    const aspect = this.canvasCssW / this.canvasCssH;
    const P = perspective(FOV, aspect, NEAR, FAR);
    // frame the whole diorama block, centred with a lens shift
    const A = WORLD / 2, B = WORLD / 2 + PLINTH_M;
    const corners: number[][] = [];
    for (const x of [-A, A]) for (const z of [-A, A]) corners.push([x, 0, z]);
    for (const x of [-B, B]) for (const z of [-B, B]) corners.push([x, Y_TABLE, z]);
    corners.push([wx(0.62), wy(1), wz(0.4)], [wx(0.35), wy(0.8), wz(0.14)], [wx(0.7), wy(0.8), wz(0.13)]);
    const pitch0 = aspect < 1 ? 1.02 : 0.86;
    if (!this.interacted) this.goal.pitch = this.cam.pitch = pitch0;
    const bounds = (d: number) => {
      const c = this.camAt({ ...this.goal, yaw: YAW0, pitch: pitch0, dist: d, tx: 0, ty: 0, tz: 0.1 });
      const M = mul(P, lookAt(c.eye, [0, 0, 0.1], [0, 1, 0]));
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of corners) {
        const cx = M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12];
        const cy = M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13];
        const cw = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15];
        if (cw <= 0) return null;
        x0 = Math.min(x0, cx / cw); x1 = Math.max(x1, cx / cw);
        y0 = Math.min(y0, cy / cw); y1 = Math.max(y1, cy / cw);
      }
      return [x0, x1, y0, y1];
    };
    const fits = (d: number) => {
      const b = bounds(d);
      return !!b && (b[1] - b[0]) / 2 <= 0.965 && (b[3] - b[2]) / 2 <= 0.93;
    };
    let lo = 5, hi = 90;
    for (let i = 0; i < 22; i++) {
      const m = (lo + hi) / 2;
      if (fits(m)) hi = m;
      else lo = m;
    }
    const bb = bounds(hi);
    // lens shift so the whole block sits centred in the frame
    if (bb) this.lens = [(bb[0] + bb[1]) / 2, (bb[2] + bb[3]) / 2];
    const prev = this.fitD;
    this.fitD = hi;
    if (!this.interacted || Math.abs(prev - this.fitD) > 0.01) {
      const k = this.goal.dist / prev;
      this.goal.dist = this.interacted ? clamp(this.fitD * k, this.fitD * 0.32, this.fitD * 1.3) : this.fitD;
      if (!this.interacted) this.cam.dist = this.goal.dist;
    }
  }

  private camAt(c: Cam) {
    const cp = Math.cos(c.pitch);
    const eye = [c.tx + c.dist * cp * Math.sin(c.yaw), c.ty + c.dist * Math.sin(c.pitch), c.tz + c.dist * cp * Math.cos(c.yaw)];
    return { eye };
  }

  private enterFlat() {
    if (this.flat || this.closed) return;
    this.canvas.style.display = 'none';
    const S = 256;
    const img = h('canvas', 'm3d-flat');
    img.width = S;
    img.height = S;
    const g = img.getContext('2d');
    if (g) g.putImageData(new ImageData(paintTopDown(this.t, S), S, S), 0, 0);
    const ov = h('canvas', 'm3d-flat');
    ov.width = S;
    ov.height = S;
    ov.style.boxShadow = 'none';
    this.view.insertBefore(ov, this.layer);
    this.view.insertBefore(img, ov);
    this.flat = { img, ov, x: 0, y: 0, s: 1 };
    this.view.appendChild(h('div', 'm3d-note', '3D view unavailable, showing Aroha’s paper chart'));
    this.hint.classList.add('gone');
    this.compass.style.display = 'none';
    (this.view.querySelector('.m3d-compass-n') as HTMLElement | null)?.style.setProperty('display', 'none');
    for (const l of this.labels) l.el.style.display = 'none';
    this.renderSide();
    this.layoutFlat();
    this.routeShowKey = '';
    this.showRoute();
  }

  private layoutFlat() {
    if (!this.flat) return;
    const r = this.view.getBoundingClientRect();
    this.viewW = Math.max(1, r.width);
    this.viewH = Math.max(1, r.height);
    const s = Math.floor(Math.min(this.viewW, this.viewH) * 0.94);
    const x = Math.round((this.viewW - s) / 2), y = Math.round((this.viewH - s) / 2);
    for (const c of [this.flat.img, this.flat.ov]) {
      c.style.left = x + 'px';
      c.style.top = y + 'px';
      c.style.width = s + 'px';
      c.style.height = s + 'px';
    }
    this.flat.x = x;
    this.flat.y = y;
    this.flat.s = s;
  }

  // ---------------------------------------------------------------- projection

  /** Screen position (CSS px in the view) of a map point; z < 0 when behind the camera. */
  private project(u: number, v: number, lift: number): [number, number, boolean] {
    if (this.flat) return [this.flat.x + u * this.flat.s, this.flat.y + v * this.flat.s, true];
    const X = wx(u), Y = wy(Math.max(0, this.t.heightAt(u, v))) + lift, Z = wz(v);
    const m = this.vp;
    const cx = m[0] * X + m[4] * Y + m[8] * Z + m[12];
    const cy = m[1] * X + m[5] * Y + m[9] * Z + m[13];
    const cw = m[3] * X + m[7] * Y + m[11] * Z + m[15];
    if (cw <= 0.01) return [-1e4, -1e4, false];
    const sx = (cx / cw * 0.5 + 0.5) * this.canvasCssW;
    const sy = (1 - (cy / cw * 0.5 + 0.5)) * this.canvasCssH;
    const px = this.cssPx;
    return [Math.round(sx / px) * px, Math.round(sy / px) * px, true];
  }

  /** Is the straight line from a map point to the eye blocked by terrain? */
  private occluded(u: number, v: number, lift: number) {
    if (this.flat) return false;
    const X = wx(u), Y = wy(Math.max(0, this.t.heightAt(u, v))) + lift, Z = wz(v);
    const [ex, ey, ez] = this.eye;
    for (let i = 1; i <= 30; i++) {
      const k = i / 30;
      const x = mix(X, ex, k * 0.5), y = mix(Y, ey, k * 0.5), z = mix(Z, ez, k * 0.5);
      if (Math.abs(x) > WORLD / 2 || Math.abs(z) > WORLD / 2) break;
      if (wy(this.t.heightAt(x / WORLD + 0.5, z / WORLD + 0.5)) > y + 0.03) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- input

  private bindInput() {
    const v = this.view;
    v.addEventListener('pointerdown', e => {
      if (this.travel) {
        e.preventDefault();
        this.skipTravel();
        return;
      }
      if ((e.target as HTMLElement).closest('.m3d-x')) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.goal.dist };
        this.drag = null;
      }
      window.addEventListener('pointermove', this.onMove);
      window.addEventListener('pointerup', this.onUp);
      window.addEventListener('pointercancel', this.onUp);
    });
    v.addEventListener('wheel', e => {
      e.preventDefault();
      if (this.travel || this.flat) return;
      this.touch();
      const k = Math.exp(clamp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015), -0.5, 0.5));
      this.goal.dist = clamp(this.goal.dist * k, this.fitD * 0.32, this.fitD * 1.3);
    }, { passive: false });
    v.addEventListener('keydown', e => {
      if (this.travel || this.flat) return;
      let used = true;
      switch (e.key) {
        case 'ArrowLeft': this.goal.yaw -= 0.12; break;
        case 'ArrowRight': this.goal.yaw += 0.12; break;
        case 'ArrowUp': this.goal.pitch = clamp(this.goal.pitch + 0.08, 0.5, 1.42); break;
        case 'ArrowDown': this.goal.pitch = clamp(this.goal.pitch - 0.08, 0.5, 1.42); break;
        case '+': case '=': this.goal.dist = clamp(this.goal.dist * 0.88, this.fitD * 0.32, this.fitD * 1.3); break;
        case '-': case '_': this.goal.dist = clamp(this.goal.dist / 0.88, this.fitD * 0.32, this.fitD * 1.3); break;
        default: used = false;
      }
      if (used) {
        e.preventDefault();
        this.touch();
      }
    });
  }

  private touch() {
    if (!this.interacted) {
      this.interacted = true;
      this.hint.classList.add('gone');
    }
  }

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.goal.dist = clamp(this.pinch.dist * (this.pinch.d / Math.max(20, d)), this.fitD * 0.32, this.fitD * 1.3);
      this.touch();
      return;
    }
    const dr = this.drag;
    if (!dr || dr.id !== e.pointerId || this.flat) return;
    const dx = e.clientX - dr.x, dy = e.clientY - dr.y;
    if (!dr.moved && Math.hypot(dx, dy) < 5) return;
    if (!dr.moved) {
      dr.moved = true;
      this.view.classList.add('drag');
      this.hideTip(null);
    }
    dr.x = e.clientX;
    dr.y = e.clientY;
    this.goal.yaw -= dx * 0.0075;
    this.goal.pitch = clamp(this.goal.pitch + dy * 0.005, 0.5, 1.42);
    this.touch();
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.drag && this.drag.id === e.pointerId) {
      if (this.drag.moved) {
        this.suppressClick = true;
        setTimeout(() => (this.suppressClick = false), 0);
      }
      this.drag = null;
      this.view.classList.remove('drag');
    }
    if (!this.pointers.size) {
      window.removeEventListener('pointermove', this.onMove);
      window.removeEventListener('pointerup', this.onUp);
      window.removeEventListener('pointercancel', this.onUp);
    }
  };

  private onKey = (e: KeyboardEvent) => {
    if (this.closed) return;
    // the map owns the keyboard while it is open
    e.stopPropagation();
    if (this.travel) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        this.skipTravel();
      }
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      this.cancel();
    }
  };

  private showTip(anchor: HTMLElement, title: string, text: string) {
    if (this.drag?.moved || this.travel) return;
    this.tipFor = anchor;
    this.tip.innerHTML = `<b>${esc(title)}</b>${esc(text)}`;
    const vr = this.view.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    this.tip.classList.add('on');
    const tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
    let x = ar.left - vr.left + ar.width / 2 - tw / 2;
    let y = ar.top - vr.top - th - 8;
    if (y < 8) y = ar.bottom - vr.top + 8;
    x = clamp(x, 8, this.viewW - tw - 8);
    this.tip.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  }
  private hideTip(anchor: HTMLElement | null) {
    if (anchor && this.tipFor !== anchor) return;
    this.tipFor = null;
    this.tip.classList.remove('on');
  }

  // ---------------------------------------------------------------- selection & panel

  private siteById(id: string) {
    return this.sites.find(s => s.site.id === id);
  }
  private posOf(id: string): P2 {
    const s = this.siteById(id);
    if (s) return [s.u, s.v];
    return SITE_POS[id] ?? SITE_POS.camp;
  }

  private pick(id: string) {
    const s = this.siteById(id);
    if (!s || !s.site.unlocked || this.travel) return;
    if (id !== this.sel) this.opts.onSfx?.('ui');
    this.sel = id;
    this.touch();
    this.updatePins();
    this.renderSide();
  }

  private updatePins() {
    for (const s of this.sites) {
      const here = s.site.id === this.opts.from;
      const kind = !s.site.unlocked ? 'locked' : s.site.id === this.sel ? 'sel' : here ? 'here' : 'open';
      s.el.className = 'm3d-pin ' + kind + (here ? ' here' : '') + (s.occ ? ' occ' : '') + (s.off ? ' off' : '');
      const name = s.site.unlocked ? esc(s.site.name) : '???';
      s.el.innerHTML = `<span class="lb">${name}${here ? '<span class="yh">YOU ARE HERE</span>' : ''}</span><img class="ic" src="${pinSprite(kind)}" alt="">`;
      s.el.setAttribute('aria-label', s.site.unlocked ? s.site.name + (here ? ' (you are here)' : '') : 'Unexplored site');
      if (!s.site.unlocked) s.el.setAttribute('aria-disabled', 'true');
      else s.el.removeAttribute('aria-disabled');
      s.el.setAttribute('aria-pressed', String(s.site.id === this.sel));
    }
    // ground ring under the selected site
    if (this.gfx) {
      const [u, v] = this.posOf(this.sel);
      const pts: number[] = [];
      const N = 22;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const pu = u + Math.cos(a) * 0.02, pv = v + Math.sin(a) * 0.02;
        pts.push(wx(pu), wy(Math.max(0.004, this.t.heightAt(pu, pv))) + 0.02, wz(pv), i / N);
      }
      this.gfx.setRing(new Float32Array(pts));
    }
    this.showRoute();
  }

  private routeFor(from: string, to: string) {
    return this.t.route(this.posOf(from), this.posOf(to));
  }

  private showRoute() {
    const key = this.opts.from + '>' + this.sel;
    if (key === this.routeShowKey) return;
    this.routeShowKey = key;
    if (this.sel === this.opts.from) {
      this.gfx?.setRoute(new Float32Array(0));
      this.drawFlatRoute(null, 0, 0);
      return;
    }
    const line = this.routeFor(this.opts.from, this.sel);
    if (this.gfx) this.gfx.setRoute(this.routeDots(line));
    else this.drawFlatLine(line, 1, 0, 0.55);
  }

  private routeDots(line: P2[]): Float32Array {
    const cum = [0];
    for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const total = cum[cum.length - 1] || 1;
    const out: number[] = [];
    const step = 0.0075;
    for (let d = 0, i = 1; d <= total; d += step) {
      while (i < line.length - 1 && cum[i] < d) i++;
      const k = clamp((d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]));
      const u = mix(line[i - 1][0], line[i][0], k), v = mix(line[i - 1][1], line[i][1], k);
      out.push(wx(u), wy(Math.max(0.004, this.t.heightAt(u, v))) + 0.035, wz(v), d / total);
    }
    return new Float32Array(out);
  }

  private renderSide() {
    const o = this.opts;
    const site = this.siteById(this.sel)?.site;
    const side = this.side;
    side.innerHTML = '';
    if (this.flat) {
      side.appendChild(h('div', 'eb', 'Sites'));
      const list = side.appendChild(h('div', 'm3d-list'));
      for (const s of this.sites) {
        const b = list.appendChild(h('button', 'btn ghost' + (s.site.id === this.sel ? ' on' : ''), s.site.unlocked ? esc(s.site.name) : '???'));
        b.type = 'button';
        b.disabled = !s.site.unlocked;
        b.addEventListener('click', () => this.pick(s.site.id));
      }
    }
    side.appendChild(h('div', 'eb', site && site.id === o.from ? 'Current location' : 'Destination'));
    side.appendChild(h('h2', '', site ? esc(site.name) : 'Choose a site'));
    if (site && site.id === o.from) side.appendChild(h('span', 'here', 'YOU ARE HERE'));
    side.appendChild(h('p', 'ds', site ? esc(site.desc) : 'Pick a pin on the map.'));
    side.appendChild(h('div', 'eb', 'Known fauna'));
    const fa = side.appendChild(h('div', 'm3d-fauna'));
    if (site && site.fauna.length) {
      for (const f of site.fauna) {
        const box = fa.appendChild(h('div', 'fa' + (f.known ? '' : ' unk')));
        const im = box.appendChild(h('img'));
        im.src = f.icon;
        im.alt = f.known ? f.name : 'Unknown species';
        box.title = f.known ? f.name : 'Unknown species';
      }
    } else fa.appendChild(h('span', 'none', 'Nothing recorded yet.'));
    side.appendChild(h('div', 'eb', 'Time of day'));
    const times = side.appendChild(h('div', 'm3d-times'));
    for (const tm of o.times) {
      const b = times.appendChild(h('button', 'btn ghost' + (tm.id === this.tod ? ' on' : ''), esc(tm.label) + (tm.locked ? `<small>${esc(tm.locked)}</small>` : '')));
      b.type = 'button';
      b.disabled = !!tm.locked;
      if (tm.locked) b.title = tm.locked;
      b.setAttribute('aria-pressed', String(tm.id === this.tod));
      b.addEventListener('click', () => {
        if (this.tod !== tm.id) o.onSfx?.('ui');
        this.tod = tm.id;
        this.renderSide();
      });
    }
    if (site && site.id !== o.from) {
      const line = this.routeFor(o.from, site.id);
      let len = 0;
      for (let i = 1; i < line.length; i++) len += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      const km = Math.max(1, Math.round(len * 38));
      const hz = this.t.hazardsNear(line);
      const r = side.appendChild(h('div', 'm3d-route'));
      r.innerHTML = `Route with Aroha: <b>about ${km} km</b> on foot` +
        (hz.length ? `<br><span class="hz">Watch for: ${hz.map(x => esc(x.name)).join(', ')}</span>` : '<br>No known hazards on the way.');
    }
    side.appendChild(h('div', 'm3d-grow'));
    const timeOk = !o.times.find(x => x.id === this.tod)?.locked && o.times.some(x => x.id === this.tod);
    const canGo = !!site && site.unlocked && site.id !== o.from && timeOk;
    const go = side.appendChild(h('button', 'btn m3d-go', site && site.id === o.from ? 'You are here' : `Travel ${pxIcon('play')}`));
    go.type = 'button';
    go.disabled = !canGo;
    go.addEventListener('click', () => this.startTravel());
    const stay = side.appendChild(h('button', 'btn ghost m3d-stay', o.from === 'camp' ? 'Stay in camp' : 'Stay here'));
    stay.type = 'button';
    stay.addEventListener('click', () => this.cancel());
  }

  // ---------------------------------------------------------------- travel

  private startTravel() {
    if (this.travel || this.closed) return;
    const to = this.sel;
    const site = this.siteById(to)?.site;
    if (!site || !site.unlocked || to === this.opts.from) return;
    this.hideTip(null);
    const pts = this.routeFor(this.opts.from, to);
    const world = pts.map(([u, v]) => [wx(u), wy(Math.max(0.004, this.t.heightAt(u, v))) + 0.035, wz(v)]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    let lines: string[] = [];
    try {
      lines = (this.opts.guideLines(this.opts.from, to) ?? []).filter(x => typeof x === 'string' && x.trim());
    } catch (err) {
      console.warn('[map3d] guideLines failed', err);
    }
    const T = this.reduced ? clamp(1.2 + lines.length * 0.8, 2, 3.5) : clamp(1.7 + lines.length * 1.5, 4, 7);
    // frame the route
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, sy = 0;
    for (const p of world) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
      sy += p[1];
    }
    const span = Math.max(maxX - minX, (maxZ - minZ) * 1.25, 2.4);
    const camTo: Cam = {
      yaw: this.cam.yaw,
      pitch: clamp(Math.max(this.cam.pitch, 0.95), 0.9, 1.2),
      dist: clamp((span * 0.62) / Math.tan(FOV / 2) * (this.canvasCssW < this.canvasCssH ? 1.5 : 1), this.fitD * 0.4, this.fitD * 1.05),
      tx: (minX + maxX) / 2,
      ty: sy / Math.max(1, world.length),
      tz: (minZ + maxZ) / 2 + 0.25,
    };
    this.travel = { t: 0, T, to, tod: this.tod, pts, world, cum, lines, line: -1, camFrom: { ...this.cam }, camTo, stepAt: 0, done: false };
    this.gfx?.setRoute(this.routeDots(pts));
    this.routeShowKey = '';
    this.side.classList.add('busy');
    this.view.classList.add('travel');
    this.skipEl.classList.add('on');
    this.hint.classList.add('gone');
    this.hiker.classList.add('on');
    this.touch();
    this.opts.onSfx?.('whoosh');
  }

  private skipTravel() {
    const tr = this.travel;
    if (!tr || tr.done) return;
    this.finishTravel(true);
  }

  private finishTravel(skipped: boolean) {
    const tr = this.travel;
    if (!tr || tr.done) return;
    tr.done = true;
    this.fade.classList.add('on');
    const result: MapResult = { site: tr.to, tod: tr.tod };
    setTimeout(() => {
      this.finish(result, false);
    }, skipped ? 180 : 380);
  }

  private updateTravel(dt: number) {
    const tr = this.travel;
    if (!tr || tr.done) return;
    tr.t += dt;
    const t = tr.t;
    const camK = this.reduced ? 1 : easeIO(clamp(t / 1.0));
    const walk0 = this.reduced ? 0.2 : 0.9, walk1 = tr.T - (this.reduced ? 0.3 : 0.6);
    const wk = easeSine(clamp((t - walk0) / Math.max(0.1, walk1 - walk0)));
    // hiker position along the route (by arc length)
    const total = tr.cum[tr.cum.length - 1] || 1;
    const target = wk * total;
    let i = 1;
    while (i < tr.cum.length - 1 && tr.cum[i] < target) i++;
    const k = clamp((target - tr.cum[i - 1]) / Math.max(1e-6, tr.cum[i] - tr.cum[i - 1]));
    const u = mix(tr.pts[i - 1][0], tr.pts[Math.min(i, tr.pts.length - 1)][0], k);
    const v = mix(tr.pts[i - 1][1], tr.pts[Math.min(i, tr.pts.length - 1)][1], k);
    // camera: ease to the route frame, then drift gently after the walkers
    const c = this.cam, a = tr.camFrom, b = tr.camTo;
    const follow = this.reduced ? 0 : 0.35 * clamp((t - walk0) / 1.5);
    c.yaw = mix(a.yaw, b.yaw, camK);
    c.pitch = mix(a.pitch, b.pitch, camK);
    c.dist = mix(a.dist, b.dist, camK);
    c.tx = mix(mix(a.tx, b.tx, camK), wx(u), follow);
    c.ty = mix(a.ty, b.ty, camK);
    c.tz = mix(mix(a.tz, b.tz, camK), wz(v) + 0.2, follow);
    this.goal = { ...c };
    // hiker marker
    const [sx, sy2, ok] = this.project(u, v, 0.02);
    const [nx] = this.project(tr.pts[Math.min(tr.pts.length - 1, i + 2)][0], tr.pts[Math.min(tr.pts.length - 1, i + 2)][1], 0.02);
    const hw = this.hiker.offsetWidth || 39, hh = this.hiker.offsetHeight || 27;
    this.hiker.style.transform = `translate(${sx - hw / 2}px,${sy2 - hh}px)`;
    this.hiker.style.visibility = ok ? 'visible' : 'hidden';
    this.hiker.classList.toggle('flip', nx < sx - 0.5);
    if (wk > 0 && wk < 1 && t >= tr.stepAt) {
      tr.stepAt = t + 0.42;
      this.opts.onSfx?.('step');
    }
    // narration: one line per stretch of the route
    const n = tr.lines.length;
    if (n) {
      const idx = t < (this.reduced ? 0.1 : 0.45) ? -1 : Math.min(n - 1, Math.floor(wk * n));
      if (idx !== tr.line && idx >= 0) {
        tr.line = idx;
        this.sayText.textContent = tr.lines[idx];
        this.say.classList.add('on');
        const bb = this.say.querySelector('.bb') as HTMLElement;
        bb.classList.remove('pop');
        void bb.offsetWidth;
        bb.classList.add('pop');
        this.opts.onSfx?.('pageTurn');
      }
    }
    this.drawFlatRoute(tr, clamp((t - 0.25) / 1.1), wk);
    if (t >= tr.T) this.finishTravel(false);
  }

  private drawFlatRoute(tr: Travel | null, reveal: number, head: number) {
    if (!this.flat) return;
    if (!tr) {
      this.flat.ov.getContext('2d')?.clearRect(0, 0, this.flat.ov.width, this.flat.ov.height);
      return;
    }
    this.drawFlatLine(tr.pts, reveal, head, 1);
  }
  private drawFlatLine(pts: P2[], reveal: number, head: number, alpha: number) {
    if (!this.flat) return;
    const g = this.flat.ov.getContext('2d');
    if (!g) return;
    const S = this.flat.ov.width;
    g.clearRect(0, 0, S, S);
    g.globalAlpha = alpha;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1] || 1;
    for (let d = 0, i = 1; d <= total * reveal; d += 0.009) {
      while (i < cum.length - 1 && cum[i] < d) i++;
      const p = pts[i];
      g.fillStyle = '#2a1d12';
      g.fillRect(Math.floor(p[0] * S) - 1, Math.floor(p[1] * S) - 1, 3, 3);
      g.fillStyle = d / total < head ? '#fff1c2' : '#f4b43c';
      g.fillRect(Math.floor(p[0] * S) - 1, Math.floor(p[1] * S) - 1, 2, 2);
    }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- per frame

  private frame = (now: number) => {
    if (this.closed) return;
    this.raf = requestAnimationFrame(this.frame);
    const js0 = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    // time-of-day look eases towards the picked time
    const L = TOD[this.tod], k = 1 - Math.exp(-dt * 4);
    const lk = this.look;
    for (const key of ['sun', 'amb', 'sky', 'glint'] as const) for (let i = 0; i < 3; i++) lk[key][i] += (L[key][i] - lk[key][i]) * k;
    lk.sunK += (L.sunK - lk.sunK) * k;
    lk.night += (L.night - lk.night) * k;
    lk.mist += (L.mist - lk.mist) * k;
    lk.clouds += (L.clouds - lk.clouds) * k;
    lk.vignette += (L.vignette - lk.vignette) * k;

    if (this.travel) this.updateTravel(dt);
    else this.updateCamera(dt);

    if (this.gfx && !this.gfx.lost && !this.flat) {
      const c = this.cam;
      const { eye } = this.camAt(c);
      const V = lookAt(eye, [c.tx, c.ty, c.tz], [0, 1, 0]);
      const P = perspective(FOV, this.canvasCssW / this.canvasCssH, NEAR, FAR);
      const lk2 = clamp((c.dist - this.fitD * 0.35) / (this.fitD * 0.65));
      P[8] = this.lens[0] * lk2;
      P[9] = this.lens[1] * lk2;
      this.vp = mul(P, V);
      this.eye = eye;
      this.right = [V[0], V[4], V[8]];
      this.up = [V[1], V[5], V[9]];
      const tr = this.travel;
      this.serpPhase += dt * 0.35;
      this.gfx.render({
        vp: this.vp, eye, right: this.right, up: this.up, time: this.time, look: lk,
        routeReveal: tr ? clamp((tr.t - 0.25) / (this.reduced ? 0.2 : 1.1)) * 1.001 : 2,
        routeHead: tr ? easeSine(clamp((tr.t - (this.reduced ? 0.2 : 0.9)) / Math.max(0.1, tr.T - (this.reduced ? 0.5 : 1.5)))) : 0,
        routeVisible: tr ? 2 : this.sel !== this.opts.from ? 1 : 0,
        ringVisible: !tr,
        serp: [0.955, 0.66, 0.035, this.serpPhase],
      });
      this.drawCompassIfNeeded(c.yaw);
    }
    this.placeOverlays();
    this.jsMs = this.jsMs * 0.95 + (performance.now() - js0) * 0.05;
    if (!this.root.dataset.ready) this.root.dataset.ready = '1';
  };

  private updateCamera(dt: number) {
    const g = this.goal, c = this.cam;
    if (!this.interacted && !this.reduced && !this.flat) g.yaw = YAW0 + Math.sin(this.time * 0.12) * 0.16;
    // when zoomed in, drift the orbit centre towards the selected site
    const [su, sv] = this.focus ?? this.posOf(this.sel);
    const zk = clamp((this.fitD * 0.92 - g.dist) / (this.fitD * 0.6)) * 0.9;
    g.tx = mix(0, wx(su), zk);
    g.tz = mix(0.1, wz(sv) + 0.15, zk);
    g.ty = mix(0, wy(Math.max(0, this.t.heightAt(su, sv))), zk);
    c.yaw = damp(c.yaw, g.yaw, 9, dt);
    c.pitch = damp(c.pitch, g.pitch, 9, dt);
    c.dist = damp(c.dist, g.dist, 8, dt);
    c.tx = damp(c.tx, g.tx, 5, dt);
    c.ty = damp(c.ty, g.ty, 5, dt);
    c.tz = damp(c.tz, g.tz, 5, dt);
  }

  private drawCompassIfNeeded(yaw: number) {
    const a = Math.round((yaw * 180) / Math.PI / 3) * 3;
    if (a === this.compassAng) return;
    this.compassAng = a;
    const g = this.compass.getContext('2d');
    const r = (a * Math.PI) / 180;
    if (g) drawCompass(g, 25, r);
    const R = this.compass.offsetWidth * 0.62;
    this.compassN.style.transform = `translate(${Math.round(Math.sin(r) * R)}px,${Math.round(-Math.cos(r) * R)}px)`;
  }

  private sizes = new Map<HTMLElement, [number, number]>();
  private measure(el: HTMLElement) {
    let s = this.sizes.get(el);
    if (!s) {
      s = [el.offsetWidth, el.offsetHeight];
      if (s[0] > 0) this.sizes.set(el, s);
    }
    return s;
  }

  /** Hide lower-priority labels that would overlap higher-priority ones (sites first). */
  private declutter() {
    const placed: number[][] = [];
    const hit = (r: number[]) => placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
    const order = [...this.sites].sort((a, b) => this.pinRank(a) - this.pinRank(b));
    for (const s of order) {
      if (s.off) continue;
      const [w, hgt] = this.measure(s.el);
      placed.push([s.x - w / 2 - 2, s.y - hgt - 2, s.x + w / 2 + 2, s.y + 2]);
    }
    for (const kind of ['cave', 'trap']) {
      for (const m of this.marks) {
        if (m.off || (kind === 'cave') !== (m.f.kind === 'cave')) continue;
        const icon = [m.x - 13.5, m.y - 12, m.x + 13.5, m.y + 10];
        const span = m.el.querySelector('span') as HTMLElement;
        const [sw, sh] = this.measure(span);
        const lab = [m.x + 14, m.y - sh / 2 - 1, m.x + 16 + sw, m.y + sh / 2 + 1];
        const hide = kind === 'cave' ? hit(lab) || hit(icon) : false;
        if (m.el.classList.contains('nolab') !== hide) m.el.classList.toggle('nolab', hide);
        placed.push(icon);
        if (!hide && kind === 'cave') placed.push(lab);
      }
    }
    for (const l of this.labels) {
      if (l.off) continue;
      const [w, hgt] = this.measure(l.el);
      const r = [l.x - w / 2, l.y - hgt / 2, l.x + w / 2, l.y + hgt / 2];
      const hide = hit(r);
      if (l.el.classList.contains('hide') !== hide) l.el.classList.toggle('hide', hide);
      if (!hide) placed.push(r);
    }
  }
  private pinRank(s: SiteView) {
    if (s.site.id === this.sel) return 0;
    if (s.site.id === this.opts.from) return 1;
    return s.site.unlocked ? 2 : 3;
  }

  private placeOverlays() {
    const recheck = this.occTick++ % 6 === 0;
    const vw = this.viewW, vh = this.viewH;
    const within = (x: number, y: number, m = 20) => x > -m && y > -m && x < vw + m && y < vh + m;
    for (const s of this.sites) {
      const [x, y, ok] = this.project(s.u, s.v, 0.03);
      const off = !ok || !within(x, y, 40);
      if (x !== s.x || y !== s.y) {
        s.x = x;
        s.y = y;
        s.el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%)`;
      }
      const occ = recheck ? this.occluded(s.u, s.v, 0.05) : s.occ;
      if (occ !== s.occ || off !== s.off) {
        s.occ = occ;
        s.off = off;
        s.el.classList.toggle('occ', occ);
        s.el.classList.toggle('off', off);
      }
    }
    for (const m of this.marks) {
      const [x, y, ok] = this.project(m.f.u, m.f.v, 0.02);
      const off = !ok || !within(x, y);
      if (x !== m.x || y !== m.y) {
        m.x = x;
        m.y = y;
        const iw = this.root.classList.contains('small') ? 9 : 13.5;
        m.el.style.transform = `translate3d(${x - iw}px,${y - iw * 0.9}px,0)`;
      }
      const occ = recheck ? this.occluded(m.f.u, m.f.v, 0.04) : m.occ;
      if (occ !== m.occ || off !== m.off) {
        m.occ = occ;
        m.off = off;
        m.el.classList.toggle('occ', occ);
        m.el.classList.toggle('off', off);
      }
    }
    for (const l of this.labels) {
      const [x, y, ok] = this.project(l.u, l.v, l.lift * HS);
      const off = !ok || !within(x, y, 0);
      if (x !== l.x || y !== l.y) {
        l.x = x;
        l.y = y;
        l.el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      }
      const occ = recheck ? this.occluded(l.u, l.v, l.lift * HS + 0.05) : l.occ;
      if (occ !== l.occ || off !== l.off) {
        l.occ = occ;
        l.off = off;
        l.el.classList.toggle('occ', occ);
        l.el.classList.toggle('off', off);
      }
    }
    this.declutter();
  }

  // ---------------------------------------------------------------- closing

  cancel() {
    if (this.closed || this.travel) return;
    this.opts.onSfx?.('uiBack');
    this.finish(null, true);
  }

  finish(result: MapResult, quick: boolean) {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.ro?.disconnect();
    this.gfx?.dispose();
    this.gfx = null;
    if (active === this) active = null;
    const root = this.root;
    if (quick) {
      root.classList.add('bye');
      setTimeout(() => root.remove(), 320);
    } else {
      // stay dark a moment so the game's own scene fade can take over underneath
      setTimeout(() => root.remove(), 480);
    }
    this.done(result);
  }

  destroyNow() {
    if (!this.closed) this.finish(null, true);
    this.root.remove();
  }
}

let active: MapView | null = null;

/** Open the 3D expedition map. Resolves with the chosen site and time, or null if the player closes it. */
export function openMap3D(opts: MapOpenOptions): Promise<{ site: string; tod: TimeOfDay } | null> {
  active?.destroyNow();
  return new Promise(resolve => {
    active = new MapView(opts, resolve);
  });
}

/** Close the map if it is open (resolving null) and free its GL resources. */
export function disposeMap3D(): void {
  active?.destroyNow();
  active = null;
}
