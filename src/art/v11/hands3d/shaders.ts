// GLSL for the hand renderer: dual-quaternion skinning, the skin and cloth shading (wrapped diffuse
// with a subsurface tint, two specular lobes, rim, transmission through thin parts, baked and
// capsule ambient occlusion, a soft key-light shadow map), procedural detail (nails, knuckle
// wrinkles, palm and joint creases, veins, hair, freckles, grease, the anchor tattoo, knit, canvas,
// the watch dial, the taniko weave), the contact-shadow plane and the composite with an optional ink
// outline for sitting the hands in a pixel-art scene.

export const NB_GL = 20;
/** capsules for ambient occlusion: 15 digit bones, the palm, the forearm, and up to 7 held objects */
export const NCAP = 24;

const SKIN_VS_HEAD = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in uvec4 aBones;
layout(location=3) in vec4 aWts;
layout(location=4) in vec4 aDet;
layout(location=5) in vec4 aBake;
uniform vec4 uDQ[${NB_GL * 2}];
uniform mat4 uModel;
uniform mat4 uVP;
vec3 dqRot(vec4 r, vec3 v) { return v + 2.0 * cross(r.xyz, cross(r.xyz, v) + r.w * v); }
void skin(out vec3 P, out vec3 N, out vec4 R) {
  vec4 r0 = uDQ[aBones.x * 2u], d0 = uDQ[aBones.x * 2u + 1u];
  vec4 r = r0 * aWts.x, d = d0 * aWts.x;
  vec4 ri = uDQ[aBones.y * 2u]; float sg = dot(r0, ri) < 0.0 ? -1.0 : 1.0; r += ri * aWts.y * sg; d += uDQ[aBones.y * 2u + 1u] * aWts.y * sg;
  ri = uDQ[aBones.z * 2u]; sg = dot(r0, ri) < 0.0 ? -1.0 : 1.0; r += ri * aWts.z * sg; d += uDQ[aBones.z * 2u + 1u] * aWts.z * sg;
  ri = uDQ[aBones.w * 2u]; sg = dot(r0, ri) < 0.0 ? -1.0 : 1.0; r += ri * aWts.w * sg; d += uDQ[aBones.w * 2u + 1u] * aWts.w * sg;
  float l = length(r); r /= l; d /= l;
  P = dqRot(r, aPos) + 2.0 * (r.w * d.xyz - d.w * r.xyz + cross(r.xyz, d.xyz));
  N = dqRot(r, aNrm);
  R = r;
}
`;

export const SKIN_VS = SKIN_VS_HEAD + `
uniform mat4 uLightVP;
out vec3 vW; out vec3 vN; out vec3 vB; out vec3 vBN; out vec4 vDet; out vec4 vBake; out vec4 vSh;
void main() {
  vec3 P, N; vec4 R;
  skin(P, N, R);
  vec4 w = uModel * vec4(P, 1.0);
  mat3 m = mat3(uModel);
  vW = w.xyz; vN = m * N;
  vB = aPos; vBN = aNrm; vDet = aDet; vBake = aBake;
  vSh = uLightVP * vec4(w.xyz + normalize(vN) * 0.12, 1.0);
  gl_Position = uVP * w;
}`;

export const DEPTH_VS = SKIN_VS_HEAD + `
void main() {
  vec3 P, N; vec4 R;
  skin(P, N, R);
  gl_Position = uVP * (uModel * vec4(P, 1.0));
}`;

export const DEPTH_FS = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(1.0); }`;

/** shared lighting helpers */
const LIGHT = `
uniform vec3 uKeyDir, uKeyCol, uFillDir, uFillCol, uRimDir, uRimCol, uSky, uGround;
uniform vec3 uCamPos;
uniform mediump sampler2DShadow uShadow;
uniform float uShadowTexel, uShadowSoft;
uniform vec4 uCapA[${NCAP}];
uniform vec4 uCapB[${NCAP}];
uniform int uNCap;
float shadowAt(vec4 sh) {
  vec3 p = sh.xyz / sh.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float s = 0.0;
  const vec2 K[12] = vec2[12](vec2(-0.326,-0.406), vec2(-0.840,-0.074), vec2(-0.696,0.457), vec2(-0.203,0.621), vec2(0.962,-0.195), vec2(0.473,-0.480),
    vec2(0.519,0.767), vec2(0.185,-0.893), vec2(0.507,0.064), vec2(0.896,0.412), vec2(-0.322,-0.933), vec2(-0.792,-0.598));
  float r = uShadowTexel * uShadowSoft;
  for (int i = 0; i < 12; i++) s += texture(uShadow, vec3(p.xy + K[i] * r, p.z - 0.0015));
  return s / 12.0;
}
/** soft occlusion from the capsules (fingers, palm, held things) not part of this region */
float capsAO(vec3 p, vec3 n, int skipA, int skipB) {
  float occ = 0.0;
  for (int i = 0; i < ${NCAP}; i++) {
    if (i >= uNCap) break;
    int tag = int(uCapB[i].w + 0.5);
    if (tag == skipA || tag == skipB) continue;
    vec3 a = uCapA[i].xyz, ab = uCapB[i].xyz - a;
    float t = clamp(dot(p - a, ab) / max(1e-5, dot(ab, ab)), 0.0, 1.0);
    vec3 d = a + ab * t - p;
    float l = length(d), r = uCapA[i].w;
    if (l < r * 0.6) continue;
    float c = max(0.0, dot(n, d / l));
    occ += (r * r) / (l * l) * c * c;
  }
  return 1.0 - clamp(occ * 0.85, 0.0, 0.85);
}
float D_ggx(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (3.14159 * d * d); }
float V_smith(float nv, float nl, float a) { float k = a * 0.5; return 0.25 / ((nv * (1.0 - k) + k) * (nl * (1.0 - k) + k)); }
vec3 spec(vec3 n, vec3 v, vec3 l, float rough, float f0) {
  vec3 h = normalize(v + l);
  float nl = max(dot(n, l), 0.0), nv = max(dot(n, v), 1e-3), nh = max(dot(n, h), 0.0), vh = max(dot(v, h), 0.0);
  float a = max(0.03, rough * rough);
  float F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
  return vec3(D_ggx(nh, a) * V_smith(nv, nl, a) * F * nl);
}
vec3 tonemap(vec3 c) {
  c = max(c, 0.0);
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
`;

export const SKIN_FS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vW; in vec3 vN; in vec3 vB; in vec3 vBN; in vec4 vDet; in vec4 vBake; in vec4 vSh;
out vec4 outC;
${LIGHT}
uniform float uMirror, uExposure, uTime, uSize;
// the look
uniform vec3 uSkin, uPalm, uFlush, uSss, uNail, uVein, uHair, uCloth0, uCloth1, uCloth2, uCuff, uGlove0, uGlove1, uGlove2, uGCuff;
uniform float uRough, uHairK, uWeather, uGrease, uFreckle, uTattoo, uBony;
uniform int uSleeve, uGloveKind;
uniform vec4 uTint; // rgb multiplier, a = saturation
// digit lengths (proximal, middle, distal, tip radius) thumb..little, and their flexion (mcp/cmc, pip, dip)
uniform vec4 uLen[5];
uniform vec4 uFlex[5];
uniform float uForeLen;

float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { return vn3(p) * 0.55 + vn3(p * 2.03 + 7.1) * 0.3 + vn3(p * 4.1 + 3.3) * 0.15; }
/** a thin groove: 1 on the line, 0 a width away */
float groove(float d, float w) { return exp(-(d * d) / (w * w)); }

// ---------------------------------------------------------------- skin height detail (bind space, cm)
// returns height (cm-ish, small) and writes albedo modifiers through globals
float gNail, gLunula, gFree, gCrease, gWrinkle, gKnuckle, gPad, gPalmar, gDirt, gGloss;
float skinHeight(vec3 b, vec4 det, float fw) {
  int region = int(det.w + 0.5);
  float regionOk = 1.0 - smoothstep(0.18, 0.32, abs(det.w - float(region)));
  float h = 0.0;
  float s = det.x, dors = det.y, lat = det.z;
  // pores and fine crosshatch, faded out when smaller than a pixel
  float fine = clamp(1.0 - fw * 7.0, 0.0, 1.0);
  if (fine > 0.0) {
    vec3 q = b * 9.0;
    float cross1 = abs(fract(dot(b.xy, vec2(0.7, 0.7)) * 7.0) - 0.5), cross2 = abs(fract(dot(b.xy, vec2(-0.7, 0.7)) * 7.0) - 0.5);
    h += (vn3(q) - 0.5) * 0.006 * fine + (min(cross1, cross2) - 0.25) * 0.004 * fine;
  }
  if (region <= 4 && regionOk > 0.0) {
    vec4 L = uLen[region];
    vec4 F = uFlex[region];
    float sP = region == 0 ? L.x : L.x;          // proximal joint (thumb MCP / finger PIP)
    float sD = L.x + L.y;                         // distal joint (thumb IP / finger DIP)
    float tipEnd = L.x + L.y + L.z;
    float rt = L.w;
    // nail: a rounded plate on the back of the last segment
    float n0 = sD + L.z * 0.24 + lat * lat * 0.16, n1 = tipEnd - rt * 0.12;
    float nw = 0.62 - smoothstep(n1 - rt * 0.6, n1, s) * 0.08;
    float inNail = smoothstep(n0 - 0.03, n0 + 0.03, s) * (1.0 - smoothstep(nw - 0.06, nw + 0.02, abs(lat))) * smoothstep(0.05, 0.3, dors) * (1.0 - smoothstep(n1 + 0.05, n1 + 0.2, s));
    gNail = inNail * regionOk;
    // the cuticle fold and the side walls are little grooves
    h -= groove(s - n0 + 0.02, 0.035) * smoothstep(0.1, 0.4, dors) * (1.0 - smoothstep(0.55, 0.7, abs(lat))) * 0.035 * regionOk;
    h -= groove(abs(lat) - nw, 0.035) * smoothstep(n0, n0 + 0.2, s) * smoothstep(0.0, 0.3, dors) * 0.025 * regionOk;
    gLunula = gNail * (1.0 - smoothstep(0.0, 1.0, (s - n0) / (L.z * 0.2) + lat * lat * 2.5));
    gFree = gNail * smoothstep(n1 - rt * 0.42, n1 - rt * 0.18, s);
    // knuckle wrinkles on the back of the middle and end joints: loose when straight, stretched when bent
    for (int j = 0; j < 2; j++) {
      float sj = j == 0 ? sP : sD;
      float flex = j == 0 ? F.y : F.z;
      float loose = clamp(1.0 - flex * 0.9, 0.15, 1.0);
      float u = (s - sj) / (rt * (j == 0 ? 0.9 : 0.7)), v = lat * 1.3;
      float e = u * u + v * v;
      if (e < 1.6 && dors > 0.0) {
        float rings = sin(sqrt(e) * (j == 0 ? 15.0 : 12.0)) * 0.5 + 0.5;
        float lines = sin(s * (j == 0 ? 52.0 : 44.0) + lat * lat * 4.0);
        float m = (1.0 - smoothstep(0.4, 1.6, e)) * smoothstep(0.1, 0.5, dors) * loose * clamp(1.0 - fw * 18.0, 0.0, 1.0);
        h -= (rings * 0.35 + max(0.0, lines) * 0.65) * 0.018 * m * regionOk;
        gWrinkle = max(gWrinkle, m * regionOk);
      }
      // palm-side creases at the joints, deeper when the joint is bent
      float cr = groove(s - sj - (j == 0 ? -0.05 : 0.02), 0.045) + (j == 0 ? groove(s - sj + 0.16, 0.035) * 0.7 : 0.0);
      float pm = smoothstep(-0.15, -0.55, dors) * (1.0 - smoothstep(0.85, 1.0, abs(lat)));
      h -= cr * pm * (0.022 + flex * 0.03) * regionOk;
      gCrease = max(gCrease, cr * pm * (0.5 + flex * 0.6) * regionOk);
    }
    // the crease where the finger meets the palm
    if (region > 0) {
      float cb = groove(s - L.w * 2.5 - 0.35, 0.06);
      float pm = smoothstep(-0.2, -0.6, dors);
      h -= cb * pm * 0.03 * regionOk;
      gCrease = max(gCrease, cb * pm * 0.6 * regionOk);
    }
    // knuckle tops (where the skin is thin) and the pads
    gKnuckle = max(gKnuckle, (groove(s - sP, rt * 0.9) + groove(s - sD, rt * 0.7) * 0.7) * smoothstep(0.2, 0.8, dors) * regionOk);
    gPad = smoothstep(-0.1, -0.7, dors) * regionOk;
    gPalmar = smoothstep(0.15, -0.45, dors) * regionOk;
    // fingertip pulp a touch redder
    gPad *= 0.6 + 0.4 * smoothstep(sD, tipEnd, s);
    // grease and muck in the creases and at the tips
    gDirt = uGrease * (smoothstep(tipEnd - 1.4 * rt, tipEnd, s) * (0.4 + 0.6 * fbm3(b * 3.1)) + gCrease * 0.6 + (1.0 - smoothstep(0.0, 0.08, abs(abs(lat) - nw))) * gNail * 0.0 + smoothstep(0.66, 0.8, fbm3(b * 1.7 + 4.0)) * 0.7);
    gDirt += uGrease * groove(abs(lat) - nw, 0.06) * smoothstep(n0, n1, s) * step(0.0, dors) * 0.9;
  } else if (region == 5) {
    // the palm: life, head and heart lines, and the small creases between
    float pal = smoothstep(-0.25, -0.65, vBN.z);
    gPalmar = smoothstep(0.1, -0.5, vBN.z);
    float S = uSize;
    vec2 p = b.xy / S;
    float heart = abs(p.y - (7.25 + 0.12 * (3.7 - p.x) - 0.032 * (3.7 - p.x) * (3.7 - p.x))) * step(-1.6, p.x) * step(p.x, 3.9) + (1.0 - step(-1.6, p.x) * step(p.x, 3.9)) * 9.0;
    float head = abs(p.y - (6.55 - 0.26 * (p.x + 3.3))) + (step(2.5, p.x) + step(p.x, -3.5)) * 9.0;
    vec2 lc = p - vec2(-2.55, 3.1);
    float life = abs(length(lc * vec2(1.0, 0.82)) - 2.35) + step(lc.x, -0.2) * 9.0 + step(6.9, p.y) * 9.0 + step(p.y, 1.2) * 9.0;
    float lines = max(max(groove(heart, 0.06), groove(head, 0.055)), groove(life, 0.06));
    float minor = smoothstep(0.62, 0.7, fbm3(vec3(p * 3.3, 1.0))) * 0.4;
    h -= (lines * 0.04 + minor * 0.012) * pal;
    gCrease = max(gCrease, (lines + minor * 0.5) * pal);
    // back of the hand: the skin over the knuckles
    gDirt = uGrease * smoothstep(0.62, 0.78, fbm3(b * 1.3 + 2.0)) * 0.8;
  } else {
    // wrist creases on the inside, forearm
    gPalmar = smoothstep(0.1, -0.5, vBN.z) * 0.7;
    float wr = groove(b.y - 0.35, 0.05) + groove(b.y + 0.35, 0.05) * 0.8;
    h -= wr * smoothstep(-0.3, -0.7, vBN.z) * 0.03;
    gCrease = max(gCrease, wr * smoothstep(-0.3, -0.7, vBN.z) * 0.5);
  }
  return h;
}

// a classic sailor's anchor, in (around, along) cm on the forearm
float anchor(vec2 q) {
  float d = 1.0;
  d = min(d, abs(q.x) - 0.09 + step(1.15, abs(q.y - 0.05)) * 9.0);          // shank
  d = min(d, abs(q.y - 0.95) - 0.08 + step(0.7, abs(q.x)) * 9.0);           // stock
  d = min(d, abs(length(q - vec2(0.0, 1.38)) - 0.22) - 0.06);               // ring
  vec2 a = q - vec2(0.0, 0.25);
  float arc = abs(length(a) - 1.0) - 0.08;
  d = min(d, arc + step(-0.35, a.y) * 9.0);                                  // arms
  vec2 f = vec2(abs(q.x) - 0.94, q.y + 0.38);
  d = min(d, length(f * vec2(1.0, 1.6)) - 0.17);                            // flukes
  return d;
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  int mat = int(vBake.w + 0.5);
  float fw = length(fwidth(vB));
  gNail = 0.0; gLunula = 0.0; gFree = 0.0; gCrease = 0.0; gWrinkle = 0.0; gKnuckle = 0.0; gPad = 0.0; gPalmar = 0.0; gDirt = 0.0; gGloss = 0.0;
  vec3 alb; float rough = uRough, f0 = 0.028, sss = 0.0, metal = 0.0, sheen = 0.0;
  float ao = vBake.x;
  int region = int(vDet.w + 0.5);
  vec3 emit = vec3(0.0);

  // procedural relief (one evaluation; the normal is tilted by its screen-space surface gradient)
  bool skinLike = mat == 0 || mat == 8;
  float h0 = skinLike ? skinHeight(vB, vDet, fw) : 0.0;
  {
    vec3 dpdx = dFdx(vW), dpdy = dFdy(vW);
    float dhx = dFdx(h0), dhy = dFdy(h0);
    vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
    float det = dot(dpdx, r1);
    vec3 sg = sign(det) * (dhx * r1 + dhy * r2);
    float bumpK = mat == 8 ? 0.35 : 1.0;
    if (abs(det) > 1e-12) N = normalize(abs(det) * N - sg * bumpK);
  }
  if (skinLike) {
    // ---------------------------------------------------------- skin (and gloves, which share the hand's shape)
    if (mat == 0) {
      alb = mix(uSkin, uPalm, gPalmar);
      alb = mix(alb, uFlush, clamp(gKnuckle * 0.3 + gPad * 0.18 + gCrease * 0.22, 0.0, 0.5));
      // weathering: sun spots and a rougher, redder back of the hand
      float spots = smoothstep(0.7, 0.78, vn3(vB * 2.6 + 11.0)) * (1.0 - gPalmar);
      alb = mix(alb, alb * vec3(0.78, 0.66, 0.6), spots * (uFreckle * 0.7 + uWeather * 0.4));
      float frk = smoothstep(0.78, 0.86, vn3(vB * 7.0 + 3.0)) * (1.0 - gPalmar) * uFreckle;
      alb = mix(alb, alb * vec3(0.72, 0.58, 0.5), frk);
      alb *= 1.0 - uWeather * 0.12 * fbm3(vB * 1.1);
      // veins: blue-green under the skin
      alb = mix(alb, uVein, vBake.y * 0.32 * (1.0 - gPalmar * 0.6));
      // forearm and back-of-hand hair: fine dark strands along the arm, averaging to a tint far away
      float hairMask = uHairK * (1.0 - gPalmar) * smoothstep(5.0, -1.0, vB.y) * (region >= 5 ? 1.0 : 0.25);
      if (hairMask > 0.0) {
        float strand = smoothstep(0.62, 0.9, vn3(vec3(vB.x * 14.0, vB.y * 2.2, vB.z * 14.0)));
        float far = clamp(fw * 5.0, 0.0, 1.0);
        alb = mix(alb, uHair, hairMask * mix(strand * 0.75, 0.22, far));
      }
      // the tattoo, faded blue-green on the forearm
      if (uTattoo > 0.5 && region == 6) {
        vec2 q = vec2(atan(vB.z, -vB.x) * 3.0 - 2.1, vB.y + uForeLen * 0.55) / 1.6;
        float d = anchor(q);
        float ink = 1.0 - smoothstep(-0.02, 0.06 + fw, d);
        alb = mix(alb, vec3(0.06, 0.13, 0.2), ink * 0.6 * (0.8 + 0.2 * vn3(vB * 9.0)));
      }
      // nails: pink bed under a glossy plate, a pale moon, the white free edge
      vec3 nail = mix(uNail, vec3(0.95, 0.88, 0.84), gLunula * 0.5);
      nail = mix(nail, vec3(0.94, 0.9, 0.84), gFree);
      alb = mix(alb, nail, gNail);
      rough = mix(rough, 0.24, gNail);
      rough = mix(rough, rough * 0.8, gKnuckle * 0.4);
      rough = mix(rough, min(1.0, rough + 0.12), gPalmar * 0.6);
      // grease: dark, a bit shiny
      float gr = clamp(gDirt, 0.0, 1.0);
      alb = mix(alb, vec3(0.05, 0.04, 0.035), gr * 0.82);
      rough = mix(rough, 0.32, gr * 0.7);
      alb = mix(alb, alb * 0.7, gCrease * (0.35 + uWeather * 0.4));
      f0 = mix(0.028, 0.04, gNail);
      sss = 1.0 - gNail * 0.6;
    } else {
      // gloves: knit (purl bumps), leather (seams down the fingers) or rubber
      vec3 c1 = uGlove1;
      float k = 0.0;
      if (uGloveKind == 0) {
        vec2 q = vec2(vB.x * 9.0 + vB.z * 9.0, vB.y * 7.0);
        k = abs(sin(q.x)) * abs(sin(q.y + sin(q.x) * 0.5));
        alb = mix(uGlove0, uGlove2, smoothstep(0.2, 0.9, k) * 0.6 + 0.15);
        rough = 0.92; sheen = 0.35;
      } else if (uGloveKind == 1) {
        float seam = region >= 1 && region <= 4 ? groove(abs(vDet.z) - 0.98, 0.05) : 0.0;
        alb = mix(c1, uGlove0, seam * 0.7 + gCrease * 0.5);
        alb = mix(alb, uGlove2, smoothstep(0.55, 0.8, fbm3(vB * 2.2)) * 0.25);
        rough = 0.5 - gKnuckle * 0.15; f0 = 0.04;
      } else {
        alb = c1; rough = 0.22; f0 = 0.05;
      }
      ao *= 1.0 - gCrease * 0.3;
    }
  } else if (mat == 1 || mat == 3) {
    // ---------------------------------------------------------- sleeve fabric (1) and the rolled band (3)
    float ang = vDet.y, y = vDet.x;
    vec3 c0 = uCloth0, c1 = uCloth1, c2 = uCloth2;
    float n = fbm3(vB * 0.7);
    if (uSleeve == 2) {
      // knit: cable ropes and stitches
      float st = abs(sin(ang * 26.0)) * abs(sin(y * 7.0 + sin(ang * 26.0) * 0.6));
      float cable = smoothstep(0.85, 1.0, abs(sin(ang * 4.0 + sin(y * 1.6) * 0.6)));
      alb = mix(c0, c2, st * 0.35 + 0.25 - cable * 0.2);
      rough = 0.95; sheen = 0.45;
    } else if (uSleeve == 3) {
      // parka: quilted nylon with stitched seams
      float seam = groove(fract(y / 4.6 + 0.5) - 0.5, 0.03);
      alb = mix(c1, c0, seam * 0.6 + n * 0.15);
      rough = 0.48; f0 = 0.04; sheen = 0.2;
    } else if (uSleeve == 4) {
      // oilskin: glossy, creased
      alb = mix(c1, c0, n * 0.35);
      rough = 0.26; f0 = 0.05;
    } else if (uSleeve == 1) {
      // hoodie fleece: soft, a little pilled
      alb = mix(c1, c0, n * 0.3);
      alb = mix(alb, c2, smoothstep(0.7, 0.9, vn3(vB * 6.0)) * 0.12);
      rough = 0.93; sheen = 0.5;
    } else {
      // canvas twill: fine diagonal weave, worn lighter on the folds
      float tw = sin((y + ang * 2.6) * 26.0) * 0.5 + 0.5;
      alb = mix(c1, c0, n * 0.45 + tw * 0.08 * clamp(1.0 - fw * 10.0, 0.0, 1.0));
      rough = 0.82; sheen = 0.25;
      if (mat == 3) alb = mix(alb, uCuff, 0.35);
    }
    ao = mix(ao, ao * ao, 0.5);
  } else if (mat == 2) {
    // ---------------------------------------------------------- rib-knit cuff
    float rib = sin(vDet.y * 34.0) * 0.5 + 0.5;
    alb = mix(uCuff * 0.75, uCuff * 1.15, rib);
    rough = 0.95; sheen = 0.5;
  } else if (mat == 4) {
    // ---------------------------------------------------------- watch strap: worn brown leather, stitched edges
    float edge = groove(abs(vB.y + 2.1 * uSize) - 0.82 * uSize, 0.04);
    alb = mix(vec3(0.16, 0.08, 0.04), vec3(0.32, 0.18, 0.09), fbm3(vB * 4.0));
    alb = mix(alb, vec3(0.6, 0.5, 0.36), edge * step(0.5, fract(vDet.y * 12.0)));
    rough = 0.55; f0 = 0.035;
  } else if (mat == 5) {
    // ---------------------------------------------------------- brushed steel
    alb = vec3(0.62, 0.62, 0.6);
    metal = 1.0; rough = 0.3;
  } else if (mat == 6) {
    // ---------------------------------------------------------- the dial under glass: hour marks and two hands
    vec2 c = vec2(vB.x, vB.y + 2.1 * uSize) / uSize;
    float r = length(c), a = atan(c.x, c.y);
    alb = vec3(0.03, 0.035, 0.04);
    float ticks = step(1.0, r * 1.0) * 0.0;
    float mk = (1.0 - smoothstep(0.03, 0.06, abs(fract(a / 6.2831 * 12.0 + 0.5) - 0.5) * r * 6.0)) * step(0.95, r) * step(r, 1.22);
    alb = mix(alb, vec3(0.9, 0.86, 0.7), mk);
    float t = uTime * 0.02 + 2.2;
    for (int i = 0; i < 2; i++) {
      float ha = i == 0 ? t : t * 12.0;
      vec2 dir = vec2(sin(ha), cos(ha));
      float along = dot(c, dir), across = abs(dot(c, vec2(dir.y, -dir.x)));
      float hand = (1.0 - smoothstep(0.035, 0.07, across)) * step(-0.1, along) * step(along, i == 0 ? 0.62 : 0.98);
      alb = mix(alb, vec3(0.92, 0.9, 0.82), hand);
    }
    emit = alb * 0.05;
    rough = 0.05; f0 = 0.06; ticks += 0.0;
  } else if (mat == 7) {
    // ---------------------------------------------------------- taniko: woven black, white and red niho (teeth)
    float S = uSize;
    float u = vDet.y * 5.0 / 3.14159, v = (vB.y - (uMirror < 0.0 ? -1.9 : -2.4) * S) / (1.05 * S);
    vec3 red = vec3(0.45, 0.07, 0.04), blk = vec3(0.03, 0.02, 0.025), wht = vec3(0.86, 0.8, 0.68);
    if (abs(v) > 0.72) alb = red;
    else {
      float tri = abs(fract(u) * 2.0 - 1.0);
      alb = tri > (v + 0.72) / 1.44 ? blk : wht;
    }
    // the weave
    float wv = sin(vDet.y * 90.0) * sin(vB.y * 40.0);
    alb *= 0.9 + 0.1 * wv;
    rough = 0.9; sheen = 0.3;
  } else {
    // ---------------------------------------------------------- glove cuff
    float rib = uGloveKind == 0 ? sin(vDet.y * 30.0) * 0.5 + 0.5 : 0.5;
    alb = mix(uGCuff * 0.8, uGCuff * 1.1, rib);
    rough = uGloveKind == 1 ? 0.5 : 0.92;
  }

  alb *= uTint.rgb;
  float lum = dot(alb, vec3(0.3, 0.59, 0.11));
  alb = mix(vec3(lum), alb, uTint.a);

  // ---------------------------------------------------------- lighting
  float sh = shadowAt(vSh);
  // fingers are shaded by the other digits (not the palm they grow from), the palm by the digits
  int skipA = region <= 4 ? region : (region == 5 ? 5 : 6);
  int skipB = region == 0 ? 6 : region <= 4 ? 5 : (region == 5 ? 6 : 5);
  float cao = skinLike ? capsAO(vW, N, skipA, skipB) : capsAO(vW, N, 6, 5);
  float occ = ao * cao;
  vec3 col = vec3(0.0);
  // key: wrapped diffuse per channel (light bleeds red into the shadow side), soft shadow
  float nlK = dot(N, uKeyDir);
  vec3 wrap = vec3(0.5, 0.22, 0.14) * sss;
  vec3 dK = clamp((vec3(nlK) + wrap) / (1.0 + wrap), 0.0, 1.0);
  vec3 shC = mix(vec3(sh), vec3(sqrt(sh), sh, sh), sss * 0.5);
  vec3 diffK = dK * shC;
  // subsurface: the terminator and the shadow edge pick up the blood colour
  vec3 sssTint = mix(vec3(1.0), uSss * 1.8, sss * 0.35 * (1.0 - abs(nlK)) * smoothstep(-0.3, 0.3, nlK + 0.2));
  col += alb * diffK * sssTint * uKeyCol;
  // fill: soft, unshadowed
  float nlF = dot(N, uFillDir);
  col += alb * clamp((nlF + 0.35) / 1.35, 0.0, 1.0) * uFillCol * (0.6 + 0.4 * occ);
  // rim from behind: a bright edge where the surface turns away
  float nlR = dot(N, uRimDir);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  col += uRimCol * fres * clamp(nlR + 0.45, 0.0, 1.0) * mix(alb * 1.6 + 0.08, vec3(0.22), 0.5) * occ;
  // thin parts glow red when lit from behind (fingers against the light)
  float th = vBake.z;
  float back = max(0.0, dot(-N, uKeyDir)) * 0.6 + max(0.0, dot(V, -uRimDir)) * 0.0 + max(0.0, dot(-N, uRimDir)) * 0.8;
  col += uSss * exp(-th * 2.2) * back * (uKeyCol * 0.3 + uRimCol * 0.6) * sss * 0.6;
  // sky / ground ambient
  vec3 amb = mix(uGround, uSky, N.y * 0.5 + 0.5);
  col += alb * amb * occ;
  // specular: a tight lobe and a broad one for skin's oily sheen
  vec3 sp = spec(N, V, uKeyDir, rough, f0) * uKeyCol * sh + spec(N, V, uRimDir, rough, f0) * uRimCol * 0.6 + spec(N, V, uFillDir, rough, f0) * uFillCol * 0.4;
  vec3 sp2 = mat == 0 ? spec(N, V, uKeyDir, min(1.0, rough + 0.28), f0) * uKeyCol * sh * 0.5 : vec3(0.0);
  vec3 specCol = mix(vec3(1.0), alb * 1.4, metal);
  col = mix(col, col * 0.15, metal) + (sp + sp2) * specCol * mix(1.0, 3.0, metal) * (0.4 + 0.6 * occ);
  // cloth sheen: a soft brightening at grazing angles
  col += sheen * fres * alb * (uKeyCol * max(0.0, nlK) * sh + amb) * 0.6;
  col += emit;
  outC = vec4(tonemap(col * uExposure), 1.0);
}`;

// ------------------------------------------------------------------ occluders (held objects, depth only) and the shadow plane
export const CAP_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
uniform vec3 uA, uB;
uniform float uR;
void main() {
  // unit capsule mesh: y in [0,1] along the axis, xz the radius, caps beyond
  vec3 ab = uB - uA; float L = length(ab);
  vec3 Y = ab / max(L, 1e-5);
  vec3 X = normalize(abs(Y.y) < 0.9 ? cross(Y, vec3(0, 1, 0)) : cross(Y, vec3(1, 0, 0)));
  vec3 Z = cross(X, Y);
  float t = aPos.y < 0.0 ? 0.0 : aPos.y > 1.0 ? 1.0 : aPos.y;
  vec3 local = vec3(aPos.x, aPos.y < 0.0 ? aPos.y : aPos.y > 1.0 ? aPos.y - 1.0 : 0.0, aPos.z) * uR;
  vec3 p = uA + Y * (t * L) + X * local.x + Y * local.y + Z * local.z;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const PLANE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aXY;
uniform mat4 uVP, uLightVP;
uniform vec4 uRect; // x0, y0, x1, y1 in world cm at depth uZ
uniform float uZ;
out vec3 vW; out vec4 vSh;
void main() {
  vec3 p = vec3(mix(uRect.x, uRect.z, aXY.x), mix(uRect.y, uRect.w, aXY.y), uZ);
  vW = p;
  vSh = uLightVP * vec4(p, 1.0);
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const PLANE_FS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vW; in vec4 vSh;
out vec4 outC;
${LIGHT}
uniform float uOpacity, uAOK;
uniform vec3 uShadeCol;
void main() {
  float sh = shadowAt(vSh);
  float ao = capsAO(vW, vec3(0.0, 0.0, 1.0), -1, -1);
  float dark = clamp((1.0 - sh) * uOpacity + (1.0 - ao) * uAOK, 0.0, 0.85);
  outC = vec4(uShadeCol * dark, dark);
}`;

// ------------------------------------------------------------------ composite: premultiplied hands with an optional ink outline
export const POST_VS = `#version 300 es
precision highp float;
out vec2 vUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
export const POST_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outC;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uOutline;
uniform vec3 uInk;
uniform float uQuant;
float bayer(vec2 p) { ivec2 q = ivec2(mod(p, 4.0)); int i = q.y * 4 + q.x;
  const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0); return (B[i] + 0.5) / 16.0; }
void main() {
  vec4 c = texture(uTex, vUV);
  if (uOutline > 0.0) {
    float a = 0.0;
    for (int i = 0; i < 8; i++) {
      float an = float(i) * 0.785398;
      a = max(a, texture(uTex, vUV + vec2(cos(an), sin(an)) * uTexel * uOutline).a);
    }
    float edge = clamp(a - c.a, 0.0, 1.0);
    c.rgb = c.rgb + uInk * edge * (1.0 - c.a);
    c.a = max(c.a, edge);
  }
  if (uQuant > 0.0) {
    vec3 q = c.rgb / max(c.a, 1e-3);
    q = floor(q * uQuant + bayer(gl_FragCoord.xy)) / uQuant;
    c.rgb = q * c.a;
  }
  outC = c;
}`;
