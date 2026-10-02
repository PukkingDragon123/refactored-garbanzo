// GLSL sources for the render pipeline.
//
// Pipeline per frame:
//   scene pass  -> MRT {albedo, aux(fog, emissive, lightReceive, depth), mat(water, depth)}
//   light pass  -> half-res HDR light accumulation (point lights, light cookies)
//   composite   -> HDR = albedo * (ambient + light) (+ emissive), fog, water reflections
//   fx pass     -> additive / alpha FX into their own premultiplied target (glows, shafts, sparks
//                  stay crisp: they are laid over the scene after depth of field)
//   velocity    -> (only on fast camera moves / zoom punches) motion + radial zoom blur, per pixel
//                  from the camera's motion and each layer's parallax
//   dof         -> art-resolution prefilter (colour + signed circle of confusion from the layer's
//                  parallax), then a separable scatter-as-gather blur (horizontal, vertical)
//   bloom       -> dual filter down/up chain
//   final       -> dof blend, fx over, tonemap, grade, vignette, grain, chromatic aberration, fade

const AA_FN = /* glsl */ `
vec2 pixelAA(vec2 uv, vec2 texSize) {
  vec2 p = uv * texSize;
  vec2 fw = max(fwidth(p), vec2(1e-4));
  vec2 i = floor(p + 0.5);
  vec2 f = p - i;
  p = i + clamp(f / fw, -0.5, 0.5);
  return p / texSize;
}`;

export const SPRITE_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in vec4 a_color;
layout(location=3) in vec4 a_aux;
layout(location=4) in vec4 a_mat;
uniform vec2 u_view;
out vec2 v_uv;
out vec4 v_color;
out vec4 v_aux;
out vec4 v_mat;
void main() {
  vec2 c = a_pos / u_view;
  gl_Position = vec4(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);
  v_uv = a_uv;
  v_color = a_color;
  v_aux = a_aux;
  v_mat = a_mat;
}`;

export const SCENE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_texSize;
uniform float u_shadow;
in vec2 v_uv;
in vec4 v_color;
in vec4 v_aux;
in vec4 v_mat;
layout(location=0) out vec4 o_albedo;
layout(location=1) out vec4 o_aux;
layout(location=2) out vec4 o_mat;
${AA_FN}
void main() {
  vec4 t = texture(u_tex, pixelAA(v_uv, u_texSize));
  vec4 c = vec4(t.rgb * v_color.rgb * v_color.a, t.a * v_color.a);
  if (c.a < 0.004) discard;
  if (v_mat.a > 0.5) {
    // additive glow inside the scene pass (occluded by anything drawn later)
    o_albedo = vec4(c.rgb, 0.0);
    o_aux = vec4(0.0);
    o_mat = vec4(0.0);
    return;
  }
  if (u_shadow > 0.5) {
    o_albedo = vec4(0.0, 0.0, 0.0, c.a);
    o_aux = vec4(0.0);
    o_mat = vec4(0.0);
    return;
  }
  o_albedo = c;
  // alpha channels carry coverage so premultiplied blending works per attachment;
  // depth (for DOF) lives in mat.b
  o_aux = vec4(v_aux.rgb, 1.0) * c.a;
  o_mat = vec4(v_mat.rg, v_aux.a, 1.0) * c.a;
}`;

export const LIGHT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform float u_useTex;
in vec2 v_uv;
in vec4 v_color;
in vec4 v_aux;
out vec4 o;
void main() {
  vec3 col = v_color.rgb * v_aux.x * 16.0 * v_color.a;
  if (u_useTex > 0.5) {
    vec4 t = texture(u_tex, v_uv);
    o = vec4(col * t.rgb, 0.0);
    return;
  }
  float d2 = dot(v_uv, v_uv);
  float f = clamp(1.0 - d2, 0.0, 1.0);
  f = f * f;
  float core = exp(-d2 * 9.0) * v_aux.y * 3.0;
  o = vec4(col * (f + core), 0.0);
}`;

export const FX_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_texSize;
uniform float u_add;
in vec2 v_uv;
in vec4 v_color;
in vec4 v_aux;
out vec4 o;
${AA_FN}
void main() {
  vec4 t = texture(u_tex, pixelAA(v_uv, u_texSize));
  float k = v_color.a * (1.0 - v_aux.y);
  // premultiplied into the fx target: additive glows leave its coverage (alpha) alone
  o = vec4(t.rgb * v_color.rgb * (v_aux.x * 16.0) * k, u_add > 0.5 ? 0.0 : t.a * k);
}`;

export const FULL_VS = /* glsl */ `#version 300 es
out vec2 v_uv;
out vec2 v_scr;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  v_scr = vec2(p.x, 1.0 - p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_albedo;
uniform sampler2D u_aux;
uniform sampler2D u_mat;
uniform sampler2D u_light;
uniform vec3 u_ambTop;
uniform vec3 u_ambBot;
uniform vec3 u_fogTop;
uniform vec3 u_fogBot;
uniform vec3 u_waterTint;
uniform float u_waterAxis;
uniform float u_hasWater;
uniform float u_time;
uniform vec2 u_viewArt;
in vec2 v_uv;
in vec2 v_scr;
out vec4 o;

vec3 shadeAt(vec2 uv, float sy) {
  vec4 al = texture(u_albedo, uv);
  vec4 ax = texture(u_aux, uv);
  vec3 lm = texture(u_light, uv).rgb;
  vec3 amb = mix(u_ambTop, u_ambBot, sy);
  float e = ax.g;
  float unlit = clamp(e * 2.0, 0.0, 1.0);
  float gain = 1.0 + max(e * 2.0 - 1.0, 0.0) * 3.0;
  vec3 lit = al.rgb * (amb + lm * ax.b);
  vec3 c = mix(lit, al.rgb * gain, unlit);
  vec3 fog = mix(u_fogTop, u_fogBot, sy);
  return mix(c, fog, clamp(ax.r, 0.0, 1.0));
}

void main() {
  vec3 c = shadeAt(v_uv, v_scr.y);
  if (u_hasWater > 0.5) {
    vec4 m = texture(u_mat, v_uv);
    float d = v_scr.y - u_waterAxis;
    if (m.r > 0.004 && d > 0.0) {
      float artY = d * u_viewArt.y;
      float row = floor(v_scr.y * u_viewArt.y);
      float wave = sin(row * 0.85 - u_time * 2.4) * 0.65 + sin(row * 0.31 + v_scr.x * u_viewArt.x * 0.045 + u_time * 1.2) * 0.45;
      float dx = wave * m.g * (0.6 + artY * 0.06) / u_viewArt.x;
      float ry = u_waterAxis - d;
      ry = (floor(ry * u_viewArt.y) + 0.5) / u_viewArt.y;
      if (ry > 0.0) {
        vec2 ruv = vec2(v_uv.x + dx, 1.0 - ry);
        vec3 refl = shadeAt(ruv, ry) * u_waterTint;
        float fade = smoothstep(0.0, 0.08, ry) * (1.0 - smoothstep(0.0, 0.9, d) * 0.35);
        c = mix(c, refl, m.r * fade);
      }
      // glints along the surface
      float g = sin(row * 1.7 + floor(v_scr.x * u_viewArt.x / 3.0) * 2.3 + u_time * 3.1);
      c += u_waterTint * smoothstep(0.985, 1.0, g) * m.r * 0.6 * exp(-artY * 0.05);
    }
  }
  o = vec4(max(c, 0.0), 1.0);
}`;

// The circle of confusion is signed (> 0 behind the focus plane, < 0 in front of it) and stored in
// alpha as 0.5 + coc / COC_RANGE, in DOF texels, so it survives an RGBA8 fallback target too.
const COC_FN = /* glsl */ `
const float COC_RANGE = 128.0;
float cocDec(float a) { return (a - 0.5) * COC_RANGE; }
float cocEnc(float c) { return clamp(c / COC_RANGE + 0.5, 0.0, 1.0); }`;

/** layer depth (premultiplied by coverage in mat.b / mat.a); nothing drawn = the far distance */
const DEPTH_FN = /* glsl */ `
float depthAt(sampler2D m, vec2 uv) { vec4 t = texture(m, uv); return t.a > 0.004 ? t.b / t.a : 1.0; }
float parallaxOf(float d) { return 1.0 / max(d, 0.02) - 1.0; }`;

/** full-res HDR + depth -> DOF-res colour and signed circle of confusion */
export const DOF_PRE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform sampler2D u_mat;
uniform vec2 u_px;      // one DOF texel in uv
uniform vec4 u_lens;    // focus parallax, dead zone in front, dead zone behind, art px of blur per unit parallax in front
uniform vec4 u_lens2;   // art px of blur per unit parallax behind, max coc (art px), overall defocus (art px), legacy on
uniform vec3 u_legacy;  // legacy (photo viewfinder) focus depth, strength per unit depth, max (art px)
uniform float u_toTex;  // DOF texels per art px
in vec2 v_uv;
out vec4 o;
${COC_FN}
${DEPTH_FN}
float cocAt(float d) {
  float c;
  if (u_lens2.w > 0.5) {
    c = clamp((d - u_legacy.x) * u_legacy.y, -1.0, 1.0) * u_legacy.z;
  } else {
    float dp = u_lens.x - parallaxOf(d);
    float a = dp > 0.0 ? max(dp - u_lens.z, 0.0) * u_lens2.x : max(-dp - u_lens.y, 0.0) * u_lens.w;
    c = (dp > 0.0 ? 1.0 : -1.0) * min(a, u_lens2.y);
  }
  if (u_lens2.z > 0.0) c = (c < 0.0 ? -1.0 : 1.0) * max(abs(c), u_lens2.z);
  return c;
}
void main() {
  vec2 q = u_px * 0.25;
  vec2 a = v_uv + vec2(-q.x, -q.y), b = v_uv + vec2(q.x, -q.y), c = v_uv + vec2(-q.x, q.y), d = v_uv + vec2(q.x, q.y);
  vec3 col = (texture(u_src, a).rgb + texture(u_src, b).rgb + texture(u_src, c).rgb + texture(u_src, d).rgb) * 0.25;
  float coc = (cocAt(depthAt(u_mat, a)) + cocAt(depthAt(u_mat, b)) + cocAt(depthAt(u_mat, c)) + cocAt(depthAt(u_mat, d))) * 0.25;
  o = vec4(col, cocEnc(coc * u_toTex));
}`;

/**
 * One separable pass of a scatter-as-gather blur: every sample spreads its colour over its own
 * circle of confusion (a normalised gaussian, so a wide blur gives each pixel less), and a sample
 * behind the pixel may not spread over it further than the pixel's own blur. Blurred foreground
 * therefore bleeds softly over the sharp playfield, while the sharp playfield never haloes into the
 * blurred background. Alpha carries the weighted circle of confusion on to the next pass.
 */
export const DOF_BLUR_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_step;   // one DOF texel along the blur direction (uv)
uniform float u_R;     // reach in texels
in vec2 v_uv;
out vec4 o;
${COC_FN}
const int MAXR = 16;
void main() {
  vec4 c0 = texture(u_src, v_uv);
  float cc = cocDec(c0.a);
  float sc = max(abs(cc), 0.35);
  float g0 = sc * 0.5;
  float w0 = 1.0 / g0;
  vec3 acc = c0.rgb * w0;
  float ws = w0, cs = cc * w0;
  for (int i = 1; i <= MAXR; i++) {
    float fi = float(i);
    if (fi > u_R) break;
    vec4 ta = texture(u_src, v_uv + u_step * fi);
    vec4 tb = texture(u_src, v_uv - u_step * fi);
    float ca = cocDec(ta.a), cb = cocDec(tb.a);
    float sa = max(abs(ca), 0.35), sb = max(abs(cb), 0.35);
    if (ca > cc) sa = min(sa, sc);
    if (cb > cc) sb = min(sb, sc);
    float ga = sa * 0.5, gb = sb * 0.5;
    float wa = exp(-fi * fi / (2.0 * ga * ga)) / ga;
    float wb = exp(-fi * fi / (2.0 * gb * gb)) / gb;
    acc += ta.rgb * wa + tb.rgb * wb;
    ws += wa + wb;
    cs += ca * wa + cb * wb;
  }
  o = vec4(acc / ws, cocEnc(cs / ws));
}`;

/**
 * Camera motion blur and radial zoom blur in one pass. Each pixel's screen velocity comes from the
 * camera's move (scaled by its layer's parallax, so the far hills hardly smear and the foreground
 * streaks), the zoom's dolly (radial, from the view centre) and an explicit zoom-blur punch (radial,
 * from its own centre: whatever sits there stays sharp).
 */
export const VELBLUR_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform sampler2D u_mat;
uniform vec2 u_viewArt;
uniform vec2 u_cam;      // camera move over the shutter on the gameplay plane, screen art px
uniform float u_zoom;
uniform float u_dolly;   // relative zoom change over the shutter
uniform vec3 u_radial;   // zoom blur centre (screen art px) and strength (fraction of the distance)
uniform float u_maxLen;  // art px
uniform float u_taps;
in vec2 v_uv;
in vec2 v_scr;
out vec4 o;
${DEPTH_FN}
void main() {
  float p = parallaxOf(depthAt(u_mat, v_uv));
  vec2 s = v_scr * u_viewArt;
  vec2 v = u_cam * (p * pow(u_zoom, p - 1.0)) + (s - u_viewArt * 0.5) * (p * u_dolly) + (s - u_radial.xy) * u_radial.z;
  float len = length(v);
  if (len > u_maxLen) v *= u_maxLen / len;
  vec2 duv = vec2(v.x, -v.y) / u_viewArt;
  // interleaved gradient noise jitters the taps so short blurs never band
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (float(i) >= u_taps) break;
    acc += texture(u_src, v_uv + duv * ((float(i) + j) / u_taps - 0.5)).rgb;
  }
  o = vec4(acc / u_taps, 1.0);
}`;

export const BLOOM_PRE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform sampler2D u_fx;
uniform float u_fxOn;
uniform vec2 u_px;
uniform float u_threshold;
uniform float u_knee;
in vec2 v_uv;
out vec4 o;
vec3 tap(vec2 uv) {
  vec3 c = texture(u_src, uv).rgb;
  if (u_fxOn > 0.5) { vec4 f = texture(u_fx, uv); c = c * (1.0 - f.a) + f.rgb; }
  return c;
}
void main() {
  vec3 c = tap(v_uv + vec2(-0.5, -0.5) * u_px) + tap(v_uv + vec2(0.5, -0.5) * u_px)
         + tap(v_uv + vec2(-0.5, 0.5) * u_px) + tap(v_uv + vec2(0.5, 0.5) * u_px);
  c *= 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - u_threshold + u_knee, 0.0, 2.0 * u_knee);
  soft = soft * soft / (4.0 * u_knee + 1e-5);
  float contrib = max(soft, br - u_threshold) / max(br, 1e-5);
  o = vec4(c * contrib, 1.0);
}`;

export const BLOOM_DOWN_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_px;
in vec2 v_uv;
out vec4 o;
void main() {
  vec3 c = texture(u_src, v_uv).rgb * 4.0;
  c += texture(u_src, v_uv + vec2(-1.0, -1.0) * u_px).rgb;
  c += texture(u_src, v_uv + vec2(1.0, -1.0) * u_px).rgb;
  c += texture(u_src, v_uv + vec2(-1.0, 1.0) * u_px).rgb;
  c += texture(u_src, v_uv + vec2(1.0, 1.0) * u_px).rgb;
  o = vec4(c / 8.0, 1.0);
}`;

export const BLOOM_UP_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_px;
uniform float u_weight;
in vec2 v_uv;
out vec4 o;
void main() {
  vec3 c = texture(u_src, v_uv + vec2(-1.0, 0.0) * u_px * 2.0).rgb;
  c += texture(u_src, v_uv + vec2(-1.0, 1.0) * u_px).rgb * 2.0;
  c += texture(u_src, v_uv + vec2(0.0, 1.0) * u_px * 2.0).rgb;
  c += texture(u_src, v_uv + vec2(1.0, 1.0) * u_px).rgb * 2.0;
  c += texture(u_src, v_uv + vec2(1.0, 0.0) * u_px * 2.0).rgb;
  c += texture(u_src, v_uv + vec2(1.0, -1.0) * u_px).rgb * 2.0;
  c += texture(u_src, v_uv + vec2(0.0, -1.0) * u_px * 2.0).rgb;
  c += texture(u_src, v_uv + vec2(-1.0, -1.0) * u_px).rgb * 2.0;
  o = vec4(c / 12.0 * u_weight, 1.0);
}`;

export const FINAL_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_hdr;
uniform sampler2D u_bloom;
uniform sampler2D u_dof;
uniform sampler2D u_fx;
uniform float u_bloomStr;
uniform float u_exposure;
uniform float u_sat;
uniform float u_contrast;
uniform float u_vignette;
uniform float u_grain;
uniform float u_time;
uniform float u_ca;
uniform float u_fade;
uniform float u_flash;
uniform float u_dofOn;
uniform float u_dofArt;   // art px per DOF texel
uniform float u_fxOn;
uniform vec3 u_lift;
uniform vec3 u_gamma;
uniform vec3 u_gain;
uniform vec3 u_fadeColor;
uniform vec2 u_viewArt;
uniform vec2 u_res;
in vec2 v_uv;
in vec2 v_scr;
out vec4 o;
${COC_FN}

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[y * 4 + x]) + 0.5) / 16.0;
}
vec3 shoulder(vec3 x) {
  const float k = 0.78;
  vec3 over = max(x - k, 0.0);
  return min(x, vec3(k)) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
/** the scene at uv: sharp HDR, blended toward its depth-of-field blur by the blur's size, fx over */
vec3 sceneAt(vec2 uv) {
  vec3 c = texture(u_hdr, uv).rgb;
  if (u_dofOn > 0.5) {
    vec4 dv = texture(u_dof, uv);
    c = mix(c, dv.rgb, smoothstep(0.3, 1.0, abs(cocDec(dv.a)) * u_dofArt));
  }
  if (u_fxOn > 0.5) { vec4 f = texture(u_fx, uv); c = c * (1.0 - f.a) + f.rgb; }
  return c;
}
void main() {
  vec2 uv = v_uv;
  vec3 c;
  if (u_ca > 0.0) {
    vec2 d = (uv - 0.5) * u_ca;
    c = vec3(sceneAt(uv + d).r, sceneAt(uv).g, sceneAt(uv - d).b);
  } else {
    c = sceneAt(uv);
  }
  c += texture(u_bloom, uv).rgb * u_bloomStr;
  c *= u_exposure;
  c = shoulder(c);
  c = c * u_gain + u_lift * (1.0 - c);
  c = pow(max(c, 0.0), 1.0 / u_gamma);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, u_sat);
  c = (c - 0.5) * u_contrast + 0.5;
  vec2 q = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  c *= clamp(1.0 - dot(q, q) * u_vignette, 0.0, 1.0);
  // film grain: monochrome, strongest in the mid-tones like real stock
  float gl = clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  c += (hash(gl_FragCoord.xy + fract(u_time * 7.13) * 91.7) - 0.5) * u_grain * (0.45 + 2.2 * gl * (1.0 - gl));
  vec2 ap = floor(v_scr * u_viewArt);
  float th = bayer4(ap);
  float f = clamp((u_fade - th * 0.4) / 0.6, 0.0, 1.0);
  c = mix(c, u_fadeColor, f);
  c = mix(c, vec3(1.0), u_flash);
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export const BLIT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_src;
in vec2 v_uv;
out vec4 o;
void main() { o = texture(u_src, v_uv); }`;
