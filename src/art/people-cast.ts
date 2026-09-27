// V2 people: character definitions — builds, palettes and clothing materials for the crew.

import { C, hex, shade, mix } from './color';
import { Canvas, P2, Sample, tone, rampOf, light3, clampi, at } from './people-rig';
import { CharDef, CharId, Ctx, B, boot, sandal, torsoFrame, tl, profAt } from './people-parts';

// ------------------------------------------------------------------ shared palettes

export const PALS = {
  // skins (dark → light)
  skinRowan: rampOf('#3a1f1c', '#66392e', '#935c47', '#b97c5e', '#d49c78', '#e8bc96', '#f6d8b8'),
  skinCrowe: rampOf('#3a1a16', '#672e23', '#954632', '#bb6546', '#d58663', '#e8a984', '#f4c8a6'),
  skinAroha: rampOf('#24110d', '#431f15', '#663220', '#87482c', '#a6613b', '#c27e52', '#d99d6d'),
  skinLou: rampOf('#4a2a22', '#7a4a3a', '#a86e58', '#cc9278', '#e4b096', '#f0c4a4', '#fadcc4'),
  skinPip: rampOf('#4a2a24', '#7b4a3d', '#ad7059', '#d2957a', '#e9b99a', '#f6d8be', '#fff0dc'),
  // rowan
  hairRowan: rampOf('#1a0c06', '#2a140a', '#3e1e0e', '#542a14', '#6a3a1e', '#86502a', '#a06a3a'),
  parka: rampOf('#161c0e', '#222b16', '#303c1e', '#3e4c28', '#4d5c32', '#617040', '#7a8a54'),
  lining: rampOf('#5a3418', '#8a5528', '#b07a44', '#cf9e66'),
  tee: rampOf('#8a7e66', '#b0a488', '#d2c8ae', '#e8e0cc', '#f6f0e2'),
  cargo: rampOf('#3a2a16', '#553e22', '#72562f', '#8e6e3e', '#a8875a', '#c2a276', '#d8bc94'),
  bootGrey: rampOf('#0e0f12', '#191b20', '#262930', '#373b43', '#4d525b', '#6a7079'),
  soleTan: rampOf('#4a3a2a', '#77603f', '#a38a64', '#c2ab84'),
  packOlive: rampOf('#161b11', '#232c19', '#323f22', '#44552c', '#586c37', '#718545', '#8c9f59'),
  packTan: rampOf('#553612', '#80561c', '#aa7a29', '#cf9c3b', '#e8bf5e'),
  bedroll: rampOf('#5a3010', '#8a5018', '#b87022', '#d99232', '#eeb350', '#f7cf7a'),
  camera: rampOf('#0b0c0f', '#15171b', '#21242a', '#30343b', '#454a53', '#636973'),
  glass: rampOf('#0e1d2b', '#1c4561', '#3f86a8', '#9fd6ea'),
  satchel: rampOf('#2a170c', '#422612', '#5e391b', '#7a4d25', '#976231', '#b27a43'),
  metal: rampOf('#1c2126', '#3d464d', '#6d777c', '#a9b1b2', '#dde2dd'),
  jar: rampOf('#4f6e73', '#86b0b3', '#c2e2df', '#effcf8'),
  patchRed: rampOf('#5a200e', '#8a3416', '#b8502a', '#dc7440'),
  cream: rampOf('#3e3a34', '#615a50', '#857c6e', '#a89d8a', '#c4b9a4', '#dbd2be', '#ece6d6'),
  // crowe
  beanie: rampOf('#1e070a', '#380c12', '#561419', '#741d1f', '#912a26', '#aa3c30', '#c2553e'),
  navy: rampOf('#0a0e1a', '#12192b', '#1b253e', '#253453', '#314469', '#435a82', '#5b7399'),
  brass: rampOf('#4a3210', '#7a561a', '#a87c26', '#d2a638', '#ecc85a', '#fbe68c'),
  leather: rampOf('#21120b', '#372012', '#52321c', '#6f4626', '#8c5b31', '#a8743f', '#c28f55'),
  bootBrown: rampOf('#1c110b', '#2f1c12', '#472a1a', '#613b23', '#7b4e2e', '#96643b', '#b07e4c'),
  soleDark: rampOf('#141010', '#2a2220', '#453a33', '#5e5047'),
  kerchief: rampOf('#3a0c10', '#621519', '#8e2320', '#b53428', '#d44d34', '#ea7650'),
  beard: rampOf('#454a52', '#6b7078', '#92979b', '#b8bbba', '#d6d6d0', '#ecebe4', '#fbfaf3'),
  tattoo: hex('#34455a'),
  pipeWood: rampOf('#24120a', '#401f10', '#613119', '#844524', '#a65c31', '#c27844'),
  // aroha
  hairAroha: rampOf('#0a0706', '#140e0b', '#211712', '#2f2119', '#402d21', '#57402e'),
  flax: rampOf('#34260f', '#56401b', '#7b5d29', '#9e7b3b', '#bd9952', '#d7b56c', '#ead08e'),
  cloakRed: rampOf('#4a140f', '#7a2217', '#a53422', '#c64b2e', '#de6c42'),
  cloakCream: rampOf('#8a7c62', '#b5a584', '#d6c8a6', '#ebe0c4', '#f7f0dc'),
  cloakBrown: rampOf('#1f120b', '#332015', '#4a2f1f', '#62412b'),
  feather: rampOf('#6d6252', '#9c9180', '#c5bba8', '#e3dccd', '#f6f2e8', '#fffdf7'),
  featherTip: rampOf('#2e1d12', '#4c3020', '#6d4a31', '#8e6645'),
  creamTop: rampOf('#51473a', '#776b58', '#a09278', '#c4b698', '#ddd1b3', '#eee6cf', '#f9f5e7'),
  skirt: rampOf('#140c09', '#22150f', '#322016', '#452d1f', '#5a3c29', '#714e36'),
  shorts: rampOf('#100e14', '#1a1720', '#26222e', '#342f3d', '#454050'),
  pounamu: rampOf('#0b2e24', '#135039', '#1f7050', '#35946a', '#62b98c', '#a2dcb6'),
  taiaha: rampOf('#1f0f07', '#361b0d', '#512a14', '#6e3b1d', '#8c4e27', '#a96533', '#c27d44'),
  paua: rampOf('#1d5a66', '#3a9aa0', '#6fd0c0', '#c4f2e2'),
  sandal: rampOf('#2a170d', '#462916', '#643c20', '#83522c', '#a36b3b'),
  // lou
  scarf: rampOf('#06242a', '#0a363d', '#0f4a50', '#156166', '#1e7a7a', '#2f958e', '#4fb0a2'),
  scarfDot: rampOf('#8a5a0c', '#c98b16', '#f0bd36', '#fbe07e'),
  scarfCoral: rampOf('#7a2230', '#b23a44', '#e0605e', '#f58f80'),
  floral: rampOf('#2e2440', '#403458', '#544674', '#6a5a8e', '#8270a6', '#9a86b8', '#b4a2cc'),
  flowerW: rampOf('#8a7aa4', '#a494bc', '#bcaed0'),
  flowerY: rampOf('#8a7aa4', '#a494bc', '#bcaed0'),
  leafG: rampOf('#123a24', '#1f5a34', '#2f7a44'),
  apron: rampOf('#4c4943', '#736f66', '#9e988c', '#c6bfb1', '#e2dccf', '#f4f0e6', '#fdfbf5'),
  trouserLou: rampOf('#3a3228', '#544a3c', '#6e6250', '#8a7c66', '#a4967e', '#bcae96'),
  // pip
  hairPip: rampOf('#6a1e44', '#962c62', '#c24480', '#e064a0', '#f08cbc', '#ffb8d8'),
  hairTeal: rampOf('#0d3a3a', '#14605c', '#1f8a80', '#3cb5a4', '#7bdcc8'),
  orange: rampOf('#2e2244', '#463464', '#604a86', '#7a62a6', '#9680c4', '#b09ce0', '#cabaf0'),
  greyO: rampOf('#5a4a6a', '#6e5e80', '#847498', '#9a8ab0', '#b0a0c6', '#c6b8da', '#dccef0'),
  charcoal: rampOf('#9a8a98', '#b8a8b8', '#d4c8d4', '#e8dfe8', '#f6f0f6', '#fff8fc'),
  goggle: rampOf('#1e1409', '#3d2a10', '#6a4a1a', '#99702a', '#c69a40', '#e6c26a'),
  lensT: rampOf('#0c2a30', '#185058', '#2f8290', '#6cc4cc', '#c2f0ee'),
  grease: hex('#241c1a'),
  glowG: rampOf('#1e5a2c', '#3f9a4a', '#7ed07a'),
  yellow2: rampOf('#6a4a0c', '#a07418', '#d4a52a', '#f2cf52'),
  flowerPink: rampOf('#5a0f22', '#8e1a38', '#c02a4c', '#e84a64', '#f7808c', '#ffc2c4'),
};

const P = PALS;

// ------------------------------------------------------------------ small drawing helpers

/** rounded-rect test in local coords */
export const rr = (x: number, y: number, x0: number, y0: number, x1: number, y1: number, r = 1) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
};

/** quantised form light across a local box (for flat accessories) */
export const boxL = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => {
  const nx = ((x - x0) / Math.max(0.5, x1 - x0)) * 2 - 1;
  const ny = ((y - y0) / Math.max(0.5, y1 - y0)) * 2 - 1;
  return light3(nx * 0.8, -ny * 0.8, 0.55);
};

const near = (s: boolean, a: number, b: number) => (s ? a : b);

// ------------------------------------------------------------------ ROWAN

function rowanPack(x: Ctx) {
  const { c, P: pose } = x;
  const sw = pose.sway ?? 0, bo = pose.bounce ?? 0;
  const ox = -sw * 0.8, oy = bo;
  torsoFrame(x, [-23 + ox, -6 + ox, -3 + oy, 22 + oy], (lx0, ly0) => {
    const lx = lx0 - ox, ly = ly0 - oy;
    const main = rr(lx, ly, -19, -0.5, -7.6, 16.4, 3);
    const lid = rr(lx, ly, -18.4, 14, -8.4, 19.4, 2.4);
    const pocket = rr(lx, ly, -21, 1.5, -17.2, 10.5, 1.5);
    if (!main && !lid && !pocket) return -1;
    const l = boxL(lx, ly, -19, -0.5, -7.6, 19.4);
    if (pocket && !main) {
      const l2 = boxL(lx, ly, -21, 1.5, -17.2, 10.5);
      if (ly > 9.2) return tone(P.leafG, l2 + 0.5, 0.1);
      if (Math.abs(ly - 6) < 0.5) return at(P.packOlive, 1);
      return tone(P.packOlive, l2 - 0.1, -0.05);
    }
    if (lid && (ly > 15.2 || !main)) {
      if (Math.abs(ly - 15.4) < 0.55) return at(P.packOlive, 1);
      if (Math.abs(lx + 13.5) < 0.6 && ly < 17.5) return at(P.metal, 3);
      return tone(P.packOlive, l + 0.15, 0.05, 1.1);
    }
    // mustard front panel with stitched border
    if (rr(lx, ly, -16.8, 2.4, -10, 12.4, 1.4)) {
      const edge = lx < -16.2 || lx > -10.6 || ly < 3 || ly > 11.8;
      if (Math.abs(ly - 9.4) < 0.5 && !edge) return at(P.packTan, 1);
      if (Math.abs(lx + 13.4) < 0.55 && ly > 9.4 && ly < 11.8) return at(P.brass, 4);
      return tone(P.packTan, l + (edge ? -0.4 : 0), 0.05);
    }
    // compression straps with buckles
    if (Math.abs(ly - 13.6) < 0.6 || Math.abs(ly - 1.2) < 0.6) {
      if (lx > -12.6 && lx < -11.2) return at(P.metal, 3);
      return at(P.packOlive, 1);
    }
    return tone(P.packOlive, l, 0.05, 1.15);
  });
  c.merge({ line: 0.38, ao: 0.3 });
  // bedroll on top: rolled end with a spiral
  const bc = tl(x, -13.2 + ox, 21.2 + oy);
  c.blob(bc[0], bc[1], 6.2, 3.9, s => {
    const r = Math.hypot(s.u, s.v);
    const ang = Math.atan2(s.v, s.u);
    const sp = (r * 1.6 - ang / (Math.PI * 2) + 10) % 1;
    let col = tone(P.bedroll, s.l, 0.15, 1.1);
    if (r < 0.92 && r > 0.18 && sp < 0.24) col = at(P.bedroll, 1);
    if (Math.abs(s.u - 0.42) < 0.1) col = at(P.leather, 2);
    return col;
  });
  c.merge({ line: 0.38, ao: 0.22 });
  // enamel mug on a carabiner under the pack
  const mg = tl(x, -14 + ox * 1.4, -2.2 + oy);
  c.limb([mg[0], mg[1]], [mg[0], mg[1] + 2.4], 1.7, 1.7, s => tone(P.metal, s.l + 0.2, 0), true, false);
  c.merge({ line: 0.25, ao: 0.1 });
  c.px(mg[0] + 2, mg[1] + 0.5, at(P.metal, 2));
  c.px(mg[0] + 2, mg[1] + 1.5, at(P.metal, 2));
  c.merge({ line: 0, ao: 0 });
}

function rowanChest(x: Ctx) {
  const { c } = x;
  const T = x.b.torso;
  // collar: stands up behind the neck, front flap folded open with the orange lining
  torsoFrame(x, [-8, 8, T - 5, T + 6], (lx, ly) => {
    const back = lx > -6.4 && lx < -0.4 && ly > T - 3 && ly < T + 3.8 - Math.max(0, lx + 3.4) * 0.35;
    const front = lx > 1.6 && lx < 6.4 && ly > T - 4.2 && ly < T + 1.2 - (lx - 1.6) * 0.45;
    if (!back && !front) return -1;
    if (front) {
      if (lx < 2.8) return at(P.lining, 2);
      return tone(P.parka, 0.35 - (lx - 2) * 0.12, 0.1);
    }
    if (ly > T + 2.6 - Math.max(0, lx + 3.4) * 0.35) return at(P.lining, 3);
    return tone(P.parka, 0.4 + (lx + 3) * 0.06, 0.05);
  });
  c.merge({ line: 0.3, ao: 0.22 });
  // straps: pack strap over the near shoulder, camera strap, satchel strap across the chest
  torsoFrame(x, [-10, 11, -6, 19], (lx, ly) => {
    const sx = -3.2 + (T - ly) * 0.14;
    if (ly > 5 && ly < T + 0.8 && Math.abs(lx - sx) < 1.3) {
      if (Math.abs(ly - 10.5) < 0.7) return at(P.metal, 3);
      return tone(P.packOlive, 0.15 - (lx - sx) * 0.35, -0.05);
    }
    const cx = 1.6 + (T - 0.5 - ly) * 0.55;
    if (ly > 8 && ly < T - 0.5 && Math.abs(lx - cx) < 0.6) return at(P.camera, 2);
    const d = (lx - 8.4) + (T - 1.4 - ly) * 0.95;
    if (ly < T - 1.2 && ly > -1.2 && Math.abs(d) < 0.75 && lx < 8.8) return tone(P.satchel, 0.1, -0.2);
    return -1;
  });
  c.merge({ line: 0.2, lineLit: 0.08, ao: 0.16 });
}

function rowanGear(x: Ctx) {
  const { c } = x;
  const flags = x.P.flags ?? {};
  if (!flags.noCamera) {
    torsoFrame(x, [3, 15, 2, 12], (lx, ly) => {
      const body = rr(lx, ly, 4.6, 3.8, 10.2, 8.8, 1.1);
      const hump = rr(lx, ly, 6.4, 8, 9, 10, 0.7);
      const lens = rr(lx, ly, 9.8, 4.4, 13.2, 8.2, 1.2);
      if (!body && !hump && !lens) return -1;
      if (lens && !body) {
        if (lx > 12.3) return ly > 6.8 ? at(P.glass, 2) : at(P.glass, 1);
        if (Math.abs(lx - 11.2) < 0.5) return at(P.camera, 4);
        return tone(P.camera, boxL(lx, ly, 9.8, 4.4, 13.2, 8.2), 0.15);
      }
      if (hump && !body) return tone(P.camera, boxL(lx, ly, 6.4, 8, 9, 10) + 0.3, 0.1);
      if (ly > 7.8 && lx > 8.2 && lx < 9.2) return at(P.metal, 3);
      if (lx < 6 && ly < 8) return at(P.camera, 1);
      return tone(P.camera, boxL(lx, ly, 4.6, 3.8, 10.2, 8.8), 0.2);
    });
    c.merge({ line: 0.4, ao: 0.3 });
  }
  // satchel at the near hip
  torsoFrame(x, [-11, 0, -10, 1], (lx, ly) => {
    if (!rr(lx, ly, -9.4, -8.6, -2.6, -1.2, 1.4)) return -1;
    const l = boxL(lx, ly, -9.4, -8.6, -2.6, -1.2);
    if (ly > -4) {
      if (Math.abs(lx + 6) < 0.7 && ly < -3) return at(P.brass, 4);
      return tone(P.satchel, l + 0.15, 0.05);
    }
    if (Math.abs(ly + 4.3) < 0.5) return at(P.satchel, 1);
    return tone(P.satchel, l - 0.1, 0);
  });
  c.merge({ line: 0.38, ao: 0.28 });
  // sample jar clipped at the front hip
  torsoFrame(x, [3, 11, -11, -1], (lx, ly) => {
    const jar = rr(lx, ly, 5, -9.4, 9, -3.8, 1.1);
    const lid = lx > 4.8 && lx < 9.2 && ly >= -3.8 && ly < -2.4;
    if (lid) return tone(P.metal, boxL(lx, ly, 4.8, -3.8, 9.2, -2.4) + 0.2, 0);
    if (!jar) return -1;
    if (lx < 6 && ly > -8.6) return at(P.jar, 3);
    if (ly < -7.2 && lx > 6) return at(P.glowG, 1);
    if (rr(lx, ly, 6.2, -6.8, 8.4, -5, 0.4)) return lx < 7.3 ? at(P.patchRed, 3) : at(P.cream, 6);
    return tone(P.jar, boxL(lx, ly, 5, -9.4, 9, -3.8), 0);
  });
  c.merge({ line: 0.35, ao: 0.22 });
}

export const ROWAN: CharDef = {
  id: 'rowan',
  build: { hipH: 21.2, thigh: 9.4, shin: 9.6, ankleH: 3.4, torso: 16.4, neck: 3.2, shY: 3.2, shF: -2.4, shB: 4.2, upArm: 8.2, foreArm: 7.2, legF: -2.6, legB: 3 },
  skin: P.skinRowan,
  neckR: 3,
  face: { eye: [3, 10], mouth: [7, 4], chin: [6, 1], top: 23 },
  leg: {
    rThigh: 4.4, rKnee: 3.8, rAnkle: 3.9, cuff: 1.2,
    mat(s, nr) {
      const bias = nr ? 0 : -0.35;
      let col = tone(P.cargo, s.l, bias + 0.05, 1.05);
      const u = s.u, v = s.v;
      // cargo pocket on the outer thigh
      if (u > 0.2 && u < 0.43 && v > -0.55 && v < 0.75) {
        if (u < 0.255) return at(P.cargo, nr ? 1 : 0);
        if (u < 0.28 && Math.abs(v - 0.1) < 0.2) return at(P.cargo, nr ? 5 : 3);
        col = tone(P.cargo, s.l + 0.25, bias + 0.05, 1.05);
        if (u > 0.41 || v < -0.45 || v > 0.65) col = tone(P.cargo, s.l - 0.2, bias, 1);
      }
      // knee crease and bunched cuffs
      if (Math.abs(u - 0.52 + v * 0.05) < 0.022 && v > -0.4 && v < 0.6) col = tone(P.cargo, s.l - 0.45, bias, 1);
      if (u > 0.82 && (Math.abs(u - 0.87 - v * 0.02) < 0.018 || Math.abs(u - 0.94 + v * 0.03) < 0.018)) col = tone(P.cargo, s.l - 0.5, bias, 1);
      if (Math.abs(v - 0.85) < 0.1 && u < 0.85 && u > 0.05) col = tone(P.cargo, s.l - 0.25, bias, 1);
      return col;
    },
    foot(x, an, pitch, nr) {
      boot(x, an, pitch, nr, {
        ramp: P.bootGrey, sole: P.soleTan, lace: hex('#c2ae84'), ah: 3.4, soleH: 1.5, cuff: P.bootGrey.slice(3), cuffH: 1.2, toeCap: P.bootGrey.slice(1, 5),
        shape: [-4.2, 0, 7.8, 0, 8.6, 1, 8.6, 2.4, 7.6, 3.6, 5.2, 4.3, 3, 5, 2.2, 6.4, 2.2, 7.6, -3.4, 7.8, -4.3, 6, -4.6, 1.4],
        lacePts: [[2.8, 5.4], [4.2, 4.7], [1.8, 6.6]],
      });
    },
  },
  arm: {
    rSh: 3.8, rEl: 3.3, rWr: 2.1,
    foreR: u => (u < 0.5 ? 3.3 - u * 0.3 : u < 0.62 ? 3.4 : 2.3 - (u - 0.62) * 0.5),
    upper(s, nr) {
      const bias = nr ? 0.08 : -0.35;
      let col = tone(P.parka, s.l + (s.v < -0.55 ? 0.25 : 0), bias, 1.25);
      if (nr && s.u > 0.2 && s.u < 0.56) {
        const dx = (s.u - 0.38) * 8, dy = s.v * 2.3;
        const d = dx * dx + dy * dy;
        if (d < 2.1) col = d < 0.6 ? at(P.cream, 6) : at(P.patchRed, 2);
      }
      if (Math.abs(s.u - 0.74) < 0.05) col = tone(P.parka, s.l - 0.35, bias, 1);
      return col;
    },
    fore(s, nr) {
      const bias = nr ? 0.08 : -0.35;
      if (s.u < 0.5) return tone(P.parka, s.l + (s.u > 0.4 ? 0.2 : 0) + (s.v < -0.55 ? 0.25 : 0), bias, 1.25);
      if (s.u < 0.62) return tone(P.parka, s.l - 0.25 + (s.u > 0.56 ? 0.3 : 0), bias, 1);
      if (nr && s.u > 0.8 && s.u < 0.93) return s.v > 0.1 && s.u > 0.83 && s.u < 0.9 ? at(P.cream, 6) : at(P.metal, 1);
      return tone(P.skinRowan, s.l, bias + 0.05, 1);
    },
    hand: P.skinRowan,
  },
  torso: {
    prof: [[-4.8, -8.6, 8.4], [0, -9.2, 9], [7, -9.6, 9.8], [11.8, -9.3, 9.4], [14.6, -8, 8], [16.6, -5, 5.2]],
    mat(s, x) {
      const T = x.b.torso;
      const lx = s.lx, ly = s.ly;
      let col = tone(P.parka, s.l - (lx > 1 ? 0.25 : 0), 0.0, 1.2);
      // tee in the open front (V opening)
      const open = ly - 8;
      if (open > 0 && lx > 3.4 - open * 0.15 && lx < 3.4 + open * 0.55) return tone(P.tee, s.l + 0.25, 0.1, 0.9);
      if (ly <= 8 && Math.abs(lx - 3.6) < 0.5) return ly > 7 ? at(P.metal, 3) : at(P.parka, 1);
      // quilting baffles
      if (Math.abs(ly - 3.8) < 0.5 || Math.abs(ly - 10.2) < 0.5) col = tone(P.parka, s.l - 0.32, 0, 1);
      // hem band
      if (ly < -2.4) col = tone(P.parka, s.l - 0.12, -0.05, 1);
      if (Math.abs(ly + 2.4) < 0.45) col = tone(P.parka, s.l - 0.45, 0, 1);
      // chest patch (red with a white mark) on the far chest
      if (lx > 5.4 && lx < 8 && ly > 11 && ly < 13.6) col = lx < 6.6 && ly > 12.2 ? at(P.cream, 6) : at(P.patchRed, 2);
      // hand-warmer pocket
      if (lx > 4.6 && lx < 8.4 && Math.abs(ly - 1.4) < 0.45) col = tone(P.parka, s.l - 0.45, 0, 1);
      void T;
      return col;
    },
  },
  afterTorso(x) {
    rowanChest(x);
    rowanGear(x);
    rowanPack(x);
  },
};

// ------------------------------------------------------------------ CROWE

function croweOverlays(x: Ctx) {
  const { c } = x;
  const T = x.b.torso;
  // shirt collar + red neckerchief knot and drape (mostly under the beard)
  torsoFrame(x, [-8, 11, T - 8, T + 3], (lx, ly) => {
    const knot = rr(lx, ly, 2.6, T - 2.6, 7, T + 0.8, 1.2);
    const drape = ly > T - 8 && ly < T - 1.8 && lx > 2.4 + (T - 1.8 - ly) * 0.35 && lx < 8.6 - (T - 1.8 - ly) * 0.55;
    const band = ly > T - 1.8 && ly < T + 1.4 && lx > -6.4 && lx < 3;
    const collar = ly > T - 3.2 && ly < T - 0.4 && ((lx > -8 && lx < -5.4) || (lx > 7 && lx < 9.8));
    if (collar) return tone(P.cream, 0.4 - (lx > 0 ? 0.3 : 0), 0.1);
    if (!knot && !drape && !band) return -1;
    if (drape && (Math.floor(lx - ly * 0.5) & 3) === 0) return at(P.kerchief, 2);
    return tone(P.kerchief, knot ? 0.35 : 0.05 - (lx - 3) * 0.05, 0.05, 1.1);
  });
  c.merge({ line: 0.35, ao: 0.25 });
  // belt hardware: anchor charm, keys, carabiner (hang from the belt)
  const sw = (x.P.sway ?? 0) * 0.5;
  torsoFrame(x, [-6, 14, -12, 1], (lx0, ly) => {
    const lx = lx0 + sw * (ly < -1 ? (-1 - ly) * 0.25 : 0);
    // anchor: shank, ring, stock, arms
    const ax = 1.2;
    const shank = Math.abs(lx - ax) < 0.6 && ly < -0.4 && ly > -8.2;
    const ring = Math.abs(Math.hypot(lx - ax, ly + 0.2) - 1.1) < 0.45 && ly > -0.6;
    const stock = Math.abs(ly + 2.2) < 0.5 && Math.abs(lx - ax) < 1.8;
    const armsD = Math.hypot(lx - ax, ly + 5.4);
    const arms = Math.abs(armsD - 2.8) < 0.55 && ly < -5.4 && ly > -8.6;
    const tips = (Math.abs(lx - ax - 2.8) < 0.7 || Math.abs(lx - ax + 2.8) < 0.7) && Math.abs(ly + 5.2) < 0.7;
    if (shank || ring || stock || arms || tips) return tone(P.metal, (lx < ax ? 0.5 : 0.05) + (ring ? 0.2 : 0), 0.15, 1);
    // carabiner (brass loop)
    const cb = Math.hypot((lx - 4.4) / 1.3, (ly + 3) / 2.3);
    if (Math.abs(cb - 1) < 0.32) return at(P.brass, lx < 4.4 ? 4 : 2);
    // keys on a ring
    if (Math.abs(Math.hypot(lx - 9.6, ly + 1.8) - 1) < 0.4) return at(P.metal, 3);
    if (lx > 9 && lx < 10.4 && ly < -2.4 && ly > -5.6) return at(P.metal, ly < -4.8 ? 2 : 4);
    if (lx > 10.4 && lx < 11.6 && ly < -2.6 && ly > -4.6) return at(P.brass, 3);
    return -1;
  });
  c.merge({ line: 0.35, ao: 0.28 });
}

export const CROWE: CharDef = {
  id: 'crowe',
  build: { hipH: 20, thigh: 8.6, shin: 8.4, ankleH: 3.6, torso: 18.4, neck: 3, shY: 3.6, shF: -3.2, shB: 5.2, upArm: 8.6, foreArm: 7.8, legF: -3.8, legB: 4.2 },
  skin: P.skinCrowe,
  neckR: 3.6,
  face: { eye: [3.4, 10], mouth: [8, 3], chin: [7, -3], top: 24.4, pipe: [16.5, 4] },
  leg: {
    rThigh: 5, rKnee: 4.4, rAnkle: 4.3, cuff: 1.4,
    mat(s, nr) {
      const bias = nr ? 0.05 : -0.3;
      let col = tone(P.navy, s.l, bias, 1.15);
      const u = s.u, v = s.v;
      // stitched patch on the near knee
      if (nr && u > 0.42 && u < 0.62 && v > -0.5 && v < 0.55) {
        const edge = u < 0.445 || u > 0.595 || v < -0.4 || v > 0.45;
        col = edge ? ((Math.floor(u * 60) & 1) ? at(P.cream, 3) : tone(P.navy, s.l + 0.5, 0.2)) : tone(P.navy, s.l + 0.55, 0.15);
      }
      // turn-up cuffs
      if (u > 0.86) col = tone(P.navy, s.l + (u > 0.9 ? 0.4 : -0.3), bias + 0.1, 1);
      // grease spots
      if (!nr && Math.abs(u - 0.3) < 0.03 && Math.abs(v - 0.2) < 0.2) col = at(P.navy, 1);
      if (Math.abs(v - 0.9) < 0.1 && u < 0.86) col = tone(P.navy, s.l - 0.3, bias, 1);
      return col;
    },
    foot(x, an, pitch, nr) {
      boot(x, an, pitch, nr, {
        ramp: P.bootBrown, sole: P.soleDark, lace: at(P.bootBrown, 5), ah: 3.6, soleH: 1.6, cuff: P.bootBrown.slice(3), cuffH: 1.3, toeCap: P.bootBrown.slice(2),
        shape: [-4.6, 0, 8.4, 0, 9.4, 1.2, 9.4, 2.8, 8.2, 4, 5.6, 4.6, 3.4, 5.4, 2.6, 7, 2.6, 8.2, -3.8, 8.4, -4.8, 6.4, -5, 1.4],
        lacePts: [[3.2, 5.8], [4.6, 5], [2.2, 7.1]], scuff: at(P.bootBrown, 5),
      });
    },
  },
  arm: {
    rSh: 4.4, rEl: 3.9, rWr: 2.8,
    foreR: u => (u < 0.3 ? 4.3 - u : u < 0.36 ? 3.8 : 3.2 - (u - 0.36) * 0.9),
    upper(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      let col = tone(P.cream, s.l + (s.v < -0.55 ? 0.2 : 0), bias, 1.15);
      if (Math.abs(s.u - 0.45 - s.v * 0.08) < 0.035) col = tone(P.cream, s.l - 0.4, bias, 1);
      if (s.u > 0.72 && Math.abs(s.u - 0.8 + s.v * 0.05) < 0.03) col = tone(P.cream, s.l - 0.35, bias, 1);
      return col;
    },
    fore(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      // rolled sleeve at the elbow
      if (s.u < 0.34) return tone(P.cream, s.l + (Math.abs(s.u - 0.17) < 0.05 ? -0.45 : 0.1), bias, 1.1);
      // anchor tattoo on the near forearm
      if (nr) {
        const tu = (s.u - 0.64) * 9, tv = s.v * 2.6;
        const shank = Math.abs(tv) < 0.35 && tu > -1.6 && tu < 1.6;
        const stock = Math.abs(tu + 1) < 0.35 && Math.abs(tv) < 1;
        const crown = Math.abs(Math.hypot(tu - 0.4, tv) - 1.2) < 0.35 && tu > 0.6;
        if (shank || stock || crown) return mix(tone(P.skinCrowe, s.l, bias, 1), P.tattoo, 0.75);
      }
      // leather wristband on the far arm
      if (!nr && s.u > 0.84 && s.u < 0.96) return tone(P.leather, s.l, 0);
      return tone(P.skinCrowe, s.l, bias, 1.05);
    },
    hand: P.skinCrowe,
  },
  torso: {
    prof: [[-4, -10.4, 10.6], [0, -11, 11.6], [5, -11.6, 12.8], [10, -11.8, 13], [14.5, -11, 11.6], [17, -9, 8.6], [18.8, -5.6, 5.4]],
    mat(s, x) {
      const T = x.b.torso;
      const lx = s.lx, ly = s.ly;
      // dungaree bib and straps
      const bibTop = 12.6;
      const inBib = ly < bibTop && lx > -1.6 && lx < 11.6;
      const nearStrap = ly >= bibTop - 0.5 && Math.abs(lx - (-1.6 - (ly - bibTop) * 0.42)) < 1.6;
      const farStrap = ly >= bibTop - 0.5 && Math.abs(lx - (10 + (ly - bibTop) * 0.05)) < 1.4;
      const lower = ly < 2.4;
      if (Math.abs(ly - 1.4) < 1.1) {
        // belt with a brass buckle
        if (lx > 4.4 && lx < 7.8) return Math.abs(lx - 6.1) < 0.9 && Math.abs(ly - 1.4) < 0.4 ? at(P.leather, 2) : at(P.brass, ly > 1.6 ? 4 : 3);
        if (Math.abs(ly - 2.2) < 0.35) return tone(P.leather, s.l + 0.4, 0.1);
        return tone(P.leather, s.l, 0.05);
      }
      if (inBib || lower || nearStrap || farStrap) {
        if ((nearStrap || farStrap) && Math.abs(ly - bibTop) < 0.9 && !inBib) {
          const bx = nearStrap ? -1.6 : 10;
          if (Math.abs(lx - bx) < 1.1) return at(P.brass, lx < bx ? 5 : 3);
        }
        let col = tone(P.navy, s.l - (lx > 6 ? 0.15 : 0), 0.05, 1.2);
        // bib pocket with stitching
        if (lx > 2.6 && lx < 8.2 && ly > 6.4 && ly < 10.6) {
          if (Math.abs(ly - 10.2) < 0.4 || lx < 3 || lx > 7.8) col = tone(P.navy, s.l + 0.5, 0.1);
          else if (Math.abs(ly - 9) < 0.4 && (Math.floor(lx * 1.5) & 1)) col = at(P.cream, 2);
        }
        if (inBib && Math.abs(lx + 1.3) < 0.4 && ly < bibTop) col = tone(P.navy, s.l - 0.4, 0, 1);
        // oil stains
        if ((Math.abs(lx - 0.5) < 0.7 && Math.abs(ly - 4.6) < 0.6) || (Math.abs(lx - 9) < 0.6 && Math.abs(ly + 2.2) < 0.6)) col = at(P.navy, 1);
        return col;
      }
      // cream shirt: folds and a darker side
      let col = tone(P.cream, s.l, 0.08, 1.15);
      if (Math.abs(lx + 6 + (ly - 10) * 0.3) < 0.45 && ly > 5 && ly < T - 3) col = tone(P.cream, s.l - 0.4, 0, 1);
      return col;
    },
  },
  afterTorso(x) {
    croweOverlays(x);
  },
};

// ------------------------------------------------------------------ AROHA

/** taiaha: carved head (upoko) with tongue (arero) + tuft (awe) at one end, flat blade (rau) at the other */
export function drawTaiaha(x: Ctx, top: P2, bot: P2, near: boolean) {
  const { c } = x;
  const W = P.taiaha;
  const dx = bot[0] - top[0], dy = bot[1] - top[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const bias = near ? 0 : -0.3;
  // shaft
  c.limb([top[0] + ux * 6, top[1] + uy * 6], [bot[0] - ux * 9, bot[1] - uy * 9], 1.25, 1.35, s => tone(W, s.l + (Math.abs(s.v + 0.35) < 0.25 ? 0.35 : 0), bias + 0.05, 1.1));
  // blade (rau): flat, widening paddle with a rounded end
  c.limb([bot[0] - ux * 9.5, bot[1] - uy * 9.5], [bot[0] - ux * 1.8, bot[1] - uy * 1.8], 1.4, 2.4, s => tone(W, s.l + (s.u > 0.3 && Math.abs(s.v) < 0.2 ? 0.3 : 0), bias + 0.1, 1.1));
  c.merge({ line: 0.3, ao: 0.2 });
  // carved head (upoko) and tongue (arero) tip
  c.limb([top[0] + ux * 7, top[1] + uy * 7], [top[0] + ux * 2.2, top[1] + uy * 2.2], 1.5, 1.7, s => {
    const band = Math.abs(s.u - 0.3) < 0.08 || Math.abs(s.u - 0.62) < 0.08;
    return band ? at(W, 1) : tone(W, s.l, bias + 0.15, 1.1);
  });
  c.limb([top[0] + ux * 2.4, top[1] + uy * 2.4], [top[0], top[1]], 1.3, 0.5, s => tone(W, s.l, bias + 0.2, 1));
  c.merge({ line: 0.3, ao: 0.15 });
  // paua eye
  c.px(top[0] + ux * 4.4 + uy * 0.9, top[1] + uy * 4.4 - ux * 0.9, at(P.paua, 2));
  c.merge({ line: 0, ao: 0 });
  // awe: small tuft of white and red just below the head
  const ax = top[0] + ux * 8.2, ay = top[1] + uy * 8.2;
  c.blob(ax - uy * 0.6, ay + ux * 0.6, 2, 1.5, s => (s.u > 0.35 ? at(P.cloakRed, 2) : tone(P.feather, s.l, 0.2)), Math.atan2(uy, ux));
  c.merge({ line: 0.3, ao: 0.15 });
}

function arohaHairBack(x: Ctx) {
  const { c, J } = x;
  const sw = x.P.sway ?? 0;
  const nt = B(c, J.neckTop);
  const H = P.hairAroha;
  // thick locks hanging down her back; tips trail with motion
  for (let i = 0; i < 4; i++) {
    const ox = -3.2 - i * 1.7, len = 17 - i * 1.2;
    const top: P2 = [nt[0] + ox, nt[1] - 7 + i * 0.5];
    const bot: P2 = [top[0] - 2.2 - sw * (1.2 + i * 0.4), top[1] + len];
    c.limb(top, bot, 1.8, 1.3, s => tone(H, s.l + (Math.abs(s.v + 0.3) < 0.2 ? 0.3 : 0) + (i & 1 ? -0.15 : 0), -0.2, 1.1));
    c.merge({ line: 0.3, ao: 0.12 });
  }
}

function arohaSkirt(x: Ctx) {
  const { c } = x;
  const sw = x.P.sway ?? 0;
  // woven skirt over shorts: hangs from the belt, open at the front, flax fringe hem
  torsoFrame(x, [-14, 8, -14, 3], (lx0, ly) => {
    const hang = Math.max(0, -ly) / 12;
    const lx = lx0 + sw * hang * 2.2;
    const back = -9.6 - hang * 2.2, front = 3.2 - hang * 1.2;
    if (ly > 2.2 || lx < back || lx > front) return -1;
    // fringed hem: strands of varied length
    const strand = Math.floor(lx * 1.1 + 40);
    const hem = -10.4 - ((strand * 7) % 5) * 0.55;
    if (ly < hem) return -1;
    const l = boxL(lx, ly, back, hem, front, 2.2) - (lx > 0 ? 0.25 : 0);
    let col = tone(P.skirt, l, 0.1, 1.1);
    if (((strand & 1) === 0 && ly < -2)) col = tone(P.skirt, l - 0.3, 0.05, 1);
    if (Math.abs(ly + 3.2) < 0.45 || Math.abs(ly + 6.6) < 0.45) col = tone(P.flax, l - 0.2, -0.1);
    return col;
  });
  c.merge({ line: 0.35, ao: 0.28 });
}

function arohaCloak(x: Ctx, cap: boolean) {
  const { c } = x;
  const T = x.b.torso;
  const sw = x.P.sway ?? 0, bo = x.P.bounce ?? 0;
  torsoFrame(x, [-20, 16, -4, T + 5], (lx0, ly0) => {
    const ly = ly0 - bo * 0.4;
    const drop = Math.max(0, T + 2 - ly) / (T + 2);
    const lx = lx0 + sw * drop * 2.4;
    // silhouette: rounded over the shoulders, flares down the back, open at the front
    const top = T + 2.6 - Math.max(0, lx - 3) * 0.3 - Math.max(0, -lx - 5) * 0.45;
    if (ly > top) return -1;
    const backX = -11.8 - drop * 5.4;
    const frontX = ly > T - 7 ? 11.2 - Math.max(0, T - 4 - ly) * 0.4 : 4.6;
    if (lx < backX || lx > frontX) return -1;
    // open front: the far-shoulder flap only covers the shoulder
    if (lx > 4.2 && lx < 7.4 && ly < T + 0.4) return -1;
    if (lx >= 7.4 && ly < T - 7.6) return -1;
    if (cap && (lx < -7.6 || lx > 1.6 || ly < T - 9.6)) return -1;
    // hem: higher at the front, lower at the back; two rows of pointed feathers
    const hem = (lx > -3 ? T - 10.4 + (lx + 3) * 0.2 : T - 10.4 + (lx + 3) * 0.62);
    const fw = 1.9;
    const fi = Math.floor((lx + 40) / fw), fx = ((lx + 40) / fw) % 1;
    const tipLen = 3.2 + ((fi * 7) % 3) * 0.5;
    const tip = hem - tipLen * (1 - Math.abs(fx - 0.5) * 2) * 0.9 - 0.6;
    if (ly < Math.min(tip, hem)) return -1;
    const l = boxL(lx, ly, backX, hem - 3, 11, T + 2) + 0.1 - (lx > 7 ? 0.2 : 0);
    if (ly < hem + 1.8) {
      // feather fringe: cream feathers, brown tips, quill line
      if (ly < tip + 1.3) return at(P.featherTip, lx < -5 ? 1 : 2);
      if (Math.abs(fx - 0.5) < 0.18) return at(P.feather, 2);
      return tone(P.feather, l + (fx < 0.5 ? 0.25 : -0.05), 0.1, 1);
    }
    // second fringe row, offset by half a feather
    const f2 = ((lx + 40 + fw / 2) / fw) % 1;
    if (ly < hem + 4.2 && ly > hem + 1.8 && ly < hem + 1.8 + 2.6 * (1 - Math.abs(f2 - 0.5) * 2)) return tone(P.feather, l - 0.1 + (f2 < 0.5 ? 0.2 : 0), 0, 1);
    // taniko band (red/cream/brown triangles) around the shoulders
    const bTop = top - 1.2, bBot = top - 5.4;
    if (ly < bTop && ly > bBot) {
      const k = (ly - bBot) / (bTop - bBot);
      if (k < 0.18 || k > 0.82) return at(P.cloakBrown, 2);
      const zz = Math.abs((((lx + 40) * 0.5) % 2) - 1);
      if (Math.abs(k - 0.5) < zz * 0.32) return tone(P.cloakRed, l, 0.1);
      return tone(P.cloakCream, l, 0.05);
    }
    if (ly >= bTop) return tone(P.flax, l + 0.25, 0.05);
    // woven flax body
    let col = tone(P.flax, l, 0, 1.1);
    if (((Math.floor((lx + 40) / 2)) & 1) === 0) col = tone(P.flax, l - 0.2, 0, 1);
    return col;
  });
  c.merge({ line: 0.4, ao: 0.3 });
}

function arohaFront(x: Ctx) {
  const { c } = x;
  const T = x.b.torso;
  // pounamu pendant on a cord
  torsoFrame(x, [0, 10, T - 10, T + 1], (lx, ly) => {
    const cord = (Math.abs(lx - (4.6 - (T - ly) * 0.12)) < 0.4 && ly > T - 7.2 && ly < T - 0.2);
    const stone = ((lx - 4.2) / 1.3) ** 2 + ((ly - (T - 8.8)) / 1.9) ** 2 <= 1;
    if (stone) return tone(P.pounamu, boxL(lx, ly, 2.9, T - 10.7, 5.5, T - 6.9) + 0.2, 0.1, 1.1);
    if (cord) return at(P.cloakBrown, 1);
    return -1;
  });
  c.merge({ line: 0.3, ao: 0.2 });
  // flax pouch at the front hip
  torsoFrame(x, [2, 12, -9, 2], (lx, ly) => {
    if (!rr(lx, ly, 4, -7.4, 9.4, -0.4, 1.4)) return -1;
    const l = boxL(lx, ly, 4, -7.4, 9.4, -0.4);
    if (ly > -3) return tone(P.flax, l + 0.2 - ((Math.floor(lx * 2) & 1) ? 0.15 : 0), 0.1);
    if (Math.abs(ly + 3.2) < 0.45) return at(P.flax, 1);
    return tone(P.flax, l - 0.15 + ((Math.floor(ly * 2 + lx) & 1) ? 0.12 : 0), 0);
  });
  c.merge({ line: 0.36, ao: 0.26 });
}

export const AROHA: CharDef = {
  id: 'aroha',
  build: { hipH: 23.4, thigh: 10.4, shin: 10.8, ankleH: 2.6, torso: 18, neck: 3.2, shY: 3.6, shF: -3, shB: 4.8, upArm: 9.4, foreArm: 8.4, legF: -3, legB: 3.4 },
  skin: P.skinAroha,
  neckR: 2.9,
  face: { eye: [3.2, 10], mouth: [7.4, 3.8], chin: [6.5, 1], top: 27 },
  leg: {
    rThigh: 4.4, rKnee: 3.5, rAnkle: 2.7,
    mat(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      const u = s.u;
      if (u < 0.2) return tone(P.shorts, s.l + (u > 0.17 ? 0.3 : 0), bias + 0.05, 1.1);
      // leather ankle wraps criss-crossing the lower shin
      if (u > 0.8) {
        const k = (u - 0.8) * 30;
        const wrap = Math.abs(((k + s.v * 1.2) % 2 + 2) % 2 - 1) < 0.34 || Math.abs(((k - s.v * 1.2) % 2 + 2) % 2 - 1) < 0.34;
        if (wrap) return tone(P.sandal, s.l + 0.2, bias + 0.1);
      }
      return tone(P.skinAroha, s.l, bias + 0.05, 1.05);
    },
    foot(x, an, pitch, nr) {
      sandal(x, an, pitch, nr, P.skinAroha, P.sandal, 6.2, 2.8, 2.6);
    },
    footOver: false,
  },
  arm: {
    rSh: 3.6, rEl: 3.1, rWr: 2.3,
    upper(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      return tone(P.skinAroha, s.l + (s.v < -0.6 ? 0.15 : 0), bias, 1.1);
    },
    fore(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      // woven flax wristband
      if (s.u > 0.8 && s.u < 0.93) return tone(P.flax, s.l + ((Math.floor(s.u * 50) & 1) ? 0.2 : -0.1), 0.05);
      return tone(P.skinAroha, s.l + (s.v < -0.6 ? 0.15 : 0), bias, 1.1);
    },
    hand: P.skinAroha,
  },
  torso: {
    prof: [[-3.6, -9, 9.4], [0, -9.6, 9.8], [5, -8.8, 8.8], [9, -9.4, 9.8], [13.5, -10.2, 10.4], [16.2, -9, 8.8], [18, -5.4, 5.2]],
    mat(s) {
      const lx = s.lx, ly = s.ly;
      if (ly < 1.2) return tone(P.shorts, s.l, 0.05, 1.1);
      if (ly < 3.4) {
        // woven belt
        const wv = (Math.floor(lx * 1.3 + ly * 2) & 1) === 0;
        if (lx > 5 && lx < 7.6) return at(P.brass, ly > 2.4 ? 4 : 3);
        return tone(P.leather, s.l + (wv ? 0.25 : -0.1), 0.05);
      }
      if (ly < 5.4) return tone(P.skinAroha, s.l, 0.05, 1.05);
      let col = tone(P.creamTop, s.l - (lx > 2 ? 0.2 : 0), 0.05, 1.15);
      if (Math.abs(ly - 5.8) < 0.45) col = tone(P.creamTop, s.l - 0.4, 0, 1);
      return col;
    },
  },
  behind(x) {
    const flags = x.P.flags ?? {};
    if (!flags.staffHand) {
      const T = x.b.torso;
      const top = tl(x, -1.2, T + 19), bot = tl(x, -13, -22);
      drawTaiaha(x, top, bot, false);
    }
    arohaHairBack(x);
  },
  afterTorso(x) {
    arohaSkirt(x);
    arohaCloak(x, false);
    arohaFront(x);
  },
  afterArmF(x) {
    // cloak stays over the near shoulder
    arohaCloak(x, true);
  },
};

// ------------------------------------------------------------------ LOU

/** floral print: small five-dot flowers + leaves on a jittered grid (clean 1-px clusters) */
function floral(lx: number, ly: number, l: number, base: C[]): C {
  const gx = Math.floor((lx + 40) / 5.6), gy = Math.floor((ly + 40) / 5.2);
  const cx = gx * 5.6 - 40 + 2.8 + ((gy & 1) ? 2.2 : -0.6), cy = gy * 5.2 - 40 + 2.6;
  const dx = lx - cx, dy = ly - cy;
  const d2 = dx * dx + dy * dy;
  const kind = (gx * 3 + gy * 5) % 3;
  if (d2 < 0.4) return kind === 1 ? at(P.flowerY, 1) : at(P.flowerY, 2);
  if (d2 < 2.1 && Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.9) return kind === 1 ? at(P.flowerY, 2) : l > 0.1 ? at(P.flowerW, 2) : at(P.flowerW, 1);
  if (d2 < 3.4 && dx > 0.6 && dy < -0.6) return at(P.leafG, l > 0 ? 2 : 1);
  return tone(base, l, 0.05, 1.15);
}

function louApron(x: Ctx) {
  const { c } = x;
  const T = x.b.torso;
  const sw = x.P.sway ?? 0;
  // apron: bib over the chest, skirt to the knees, neck strap, pocket, a stain
  torsoFrame(x, [-12, 16, -14, T + 3], (lx0, ly) => {
    const hang = Math.max(0, -ly) / 12;
    const lx = lx0 + sw * hang * 1.4;
    const bib = ly >= 4 && ly < T - 3.4 && lx > 1.6 + (ly - 4) * 0.06 && lx < 12.6 - Math.max(0, ly - 10) * 0.45;
    const skirt = ly < 4 && ly > -11 && lx > -0.6 - hang * 1.2 && lx < 14.2 - hang * 0.6;
    const strap = ly >= T - 3.4 && ly < T + 1.6 && Math.abs(lx - (2.6 + (ly - T) * 0.2)) < 1;
    if (!bib && !skirt && !strap) return -1;
    const l = boxL(lx, ly, 0, -11, 14, T) - (lx > 8 ? 0.2 : 0);
    let col = tone(P.apron, l, 0.1, 1.1);
    if (skirt) {
      // soft vertical folds on the skirt
      if (Math.abs(((lx + 40) % 4.4) - 2.2) < 0.4 && ly < 1) col = tone(P.apron, l - 0.3, 0.05, 1);
      // hem band
      if (ly < -9.8) col = tone(P.apron, l - 0.15, 0, 1);
      // pocket
      if (lx > 3.4 && lx < 8.4 && ly > -5.6 && ly < -1.2) {
        if (Math.abs(ly + 1.6) < 0.45) col = tone(P.apron, l - 0.35, 0, 1);
        else if (lx < 3.9 || lx > 7.9 || ly < -5.1) col = tone(P.apron, l - 0.25, 0, 1);
      }
    }
    // waist band
    if (Math.abs(ly - 4) < 0.7) col = tone(P.apron, l + 0.25, 0.1, 1);
    // stains (curry and tomato)
    if ((lx - 9.4) ** 2 + (ly - 8.4) ** 2 < 0.8) col = mix(col, hex('#c9923a'), 0.55);
    if ((lx - 5.4) ** 2 + (ly + 7.6) ** 2 < 0.6) col = mix(col, hex('#b84a3a'), 0.45);
    return col;
  });
  c.merge({ line: 0.34, ao: 0.28 });
  // waist ties: bow at the back
  torsoFrame(x, [-18, -6, -4, 9], (lx0, ly) => {
    const lx = lx0 + sw * 0.8;
    const loop1 = Math.abs(Math.hypot((lx + 12.6) / 1.8, (ly - 5.4) / 1.3) - 1) < 0.34;
    const loop2 = Math.abs(Math.hypot((lx + 12.4) / 1.6, (ly - 2.8) / 1.2) - 1) < 0.36;
    const knot = Math.hypot(lx + 11, ly - 4.2) < 0.9;
    const tail = Math.abs(lx - (-12.2 - (4 - ly) * 0.25)) < 0.6 && ly < 3.4 && ly > -2.4;
    if (!loop1 && !loop2 && !knot && !tail) return -1;
    return tone(P.apron, knot ? 0.4 : 0.1, 0.05);
  });
  c.merge({ line: 0.3, ao: 0.18 });
  // ladle tucked into the apron tie (hangs at the side, bowl down)
  if (!(x.P.flags ?? {}).ladleHand) {
    torsoFrame(x, [-14, -4, -12, 8], (lx0, ly) => {
      const lx = lx0 + sw * 0.6;
      if (Math.abs(lx - (-9 - (6 - ly) * 0.08)) < 0.65 && ly > -6 && ly < 7) return tone(P.metal, lx < -9 ? 0.5 : 0, 0.1);
      const bowl = ((lx + 9.8) / 2) ** 2 + ((ly + 7.4) / 1.6) ** 2 <= 1;
      if (bowl) return tone(P.metal, boxL(lx, ly, -11.8, -9, -7.8, -5.8) + 0.2, 0.05);
      return -1;
    });
    c.merge({ line: 0.3, ao: 0.2 });
  }
}

export const LOU: CharDef = {
  id: 'lou',
  build: { hipH: 17.2, thigh: 7.6, shin: 7.4, ankleH: 2.6, torso: 15.4, neck: 2.2, shY: 3.2, shF: -3.4, shB: 5.4, upArm: 7.8, foreArm: 7, legF: -3.4, legB: 3.8 },
  skin: P.skinLou,
  neckR: 3.4,
  face: { eye: [3.4, 10], mouth: [7.6, 3.8], chin: [7, 1], top: 25.6 },
  leg: {
    rThigh: 5, rKnee: 4.2, rAnkle: 3.5, cuff: 1.8,
    mat(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      let col = tone(P.trouserLou, s.l, bias, 1.15);
      if (s.u > 0.9) col = tone(P.trouserLou, s.l + 0.35, bias, 1);
      if (Math.abs(s.v - 0.88) < 0.1 && s.u < 0.9) col = tone(P.trouserLou, s.l - 0.3, bias, 1);
      return col;
    },
    foot(x, an, pitch, nr) {
      boot(x, an, pitch, nr, {
        ramp: P.leather, sole: P.soleDark, ah: 2.6, soleH: 1.2,
        shape: [-3.6, 0, 7, 0, 7.8, 1, 7.4, 2.4, 5, 3, 2.2, 3.6, 1.6, 4.6, -2.8, 4.6, -3.8, 3],
      });
    },
  },
  arm: {
    rSh: 4.3, rEl: 3.6, rWr: 2.8,
    upper(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      if (s.u > 0.5) {
        // rolled short sleeve cuff, then skin
        if (s.u < 0.64) return tone(P.floral, s.l + (s.u > 0.57 ? 0.3 : -0.2), bias + 0.1, 1);
        return tone(P.skinLou, s.l, bias, 1.05);
      }
      return floral(s.u * 20, s.v * 4, s.l + bias, P.floral);
    },
    fore(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      if (nr && s.u > 0.84 && s.u < 0.94) return tone(P.brass, s.l + 0.3, 0.1);
      return tone(P.skinLou, s.l + (s.v < -0.6 ? 0.15 : 0), bias, 1.05);
    },
    hand: P.skinLou,
  },
  torso: {
    prof: [[-4, -10.4, 11.4], [0, -11.4, 13], [4, -12, 14.2], [8, -12, 14], [12, -11.2, 12], [14.4, -9, 9], [16, -5.6, 5.4]],
    mat(s) {
      const l = s.l - (s.lx > 6 ? 0.2 : 0);
      if (s.ly < 0.6) return tone(P.trouserLou, l, 0.05, 1.1);
      return floral(s.lx, s.ly, l, P.floral);
    },
  },
  afterTorso(x) {
    louApron(x);
  },
};

// ------------------------------------------------------------------ PIP

function pipGear(x: Ctx) {
  const { c } = x;
  const sw = x.P.sway ?? 0;
  // the near suspender strap
  torsoFrame(x, [-10, 4, -12, 12], (lx, ly) => {
    const sx = -1.2 - (ly - 2) * 0.12;
    if (ly < 12 && ly > 2 && Math.abs(lx - sx) < 0.9) return tone(P.orange, 0.2 - (lx - sx) * 0.3, 0.05);
    return -1;
  });
  c.merge({ line: 0.35, ao: 0.25 });
  // flared pleated mini skirt
  torsoFrame(x, [-14, 14, -10, 4], (lx0, ly) => {
    if (ly > 2.6 || ly < -8.4) return -1;
    const lx = lx0 + sw * (2.6 - ly) * 0.12;
    const k = (2.6 - ly) * 0.42;
    if (lx < -5.6 - k || lx > 5.8 + k) return -1;
    const pleat = ((lx + 40) % 2.6) < 1.3;
    let l = pleat ? 0.2 : -0.25;
    if (ly < -7.4) l -= 0.3;
    if (ly > 1.8) return at(P.orange, 5);
    return tone(P.orange, l, 0.05, 1.1);
  });
  c.merge({ line: 0.35, ao: 0.3 });
}

export const PIP: CharDef = {
  id: 'pip',
  build: { hipH: 18, thigh: 7.6, shin: 7.8, ankleH: 3, torso: 13.8, neck: 2.6, shY: 2.8, shF: -2, shB: 3.6, upArm: 7, foreArm: 6.4, legF: -2.2, legB: 2.6 },
  skin: P.skinPip,
  neckR: 2.5,
  face: { eye: [3.2, 9.6], mouth: [7.2, 3.6], chin: [6, 1], top: 23.6 },
  leg: {
    rThigh: 3, rKnee: 2.4, rAnkle: 2.2, cuff: 1,
    mat(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      // bare thigh under the skirt, then white thigh-high socks with a pink band
      if (s.u < 0.5) return tone(P.skinPip, s.l, bias, 1.05);
      if (s.u < 0.56) return tone(P.flowerPink, s.l + 0.2, bias, 1);
      return tone(P.apron, s.l + 0.1, bias, 1.05);
    },
    foot(x, an, pitch, nr) {
      boot(x, an, pitch, nr, {
        ramp: P.flowerPink, sole: P.apron, lace: at(P.apron, 6), ah: 2.6, soleH: 1.4, cuff: P.apron.slice(3), cuffH: 0.8, toeCap: P.apron.slice(3),
        shape: [-3.4, 0, 6, 0, 6.8, 1, 6.8, 2.2, 5.8, 3.2, 3.8, 3.6, 2.2, 4.2, 1.6, 5.4, 1.6, 6.2, -2.8, 6.4, -3.4, 4.8, -3.7, 1.2],
        lacePts: [[2.2, 4.4], [3.2, 3.8]],
      });
    },
  },
  arm: {
    rSh: 2.4, rEl: 1.9, rWr: 1.5,
    upper(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      // puffy short tee sleeve
      if (s.u < 0.46) return tone(P.charcoal, s.l + (s.u > 0.38 ? 0.3 : 0.1), bias + 0.1, 1.1);
      return tone(P.skinPip, s.l, bias, 1.05);
    },
    fore(s, nr) {
      const bias = nr ? 0.05 : -0.35;
      // pink scrunchie on the wrist
      if (nr && s.u > 0.82 && s.u < 0.92) return tone(P.flowerPink, s.l + 0.2, 0.1);
      return tone(P.skinPip, s.l + (s.v < -0.6 ? 0.15 : 0), bias, 1.05);
    },
    hand: P.skinPip,
  },
  torso: {
    prof: [[-4, -6.6, 6.8], [0, -6.4, 6.6], [5, -5.4, 5.8], [9, -6, 6.6], [11.8, -5.6, 6], [13.8, -3.8, 3.6]],
    mat(s, x) {
      const lx = s.lx, ly = s.ly;
      void x;
      // suspender strap over the far shoulder
      const farStrap = ly >= 2 && Math.abs(lx - (5.2 + (ly - 9.6) * 0.1)) < 0.9;
      if (ly < 2.2) return tone(P.orange, s.l, 0.05, 1.2);
      if (farStrap) return tone(P.orange, s.l + 0.1, 0.05, 1.1);
      // white kawaii tee with a little pink heart
      if ((lx - 2.4) ** 2 + (ly - 7.2) ** 2 < 2.2) return at(P.flowerPink, 4);
      return tone(P.charcoal, s.l, 0.15, 1.2);
    },
  },
  afterTorso(x) {
    pipGear(x);
  },
};

/**
 * V3 proportions: everyone is taller (longer legs, torso and arms; heads stay big and cute) and each
 * castaway has a distinct silhouette: lanky Rowan, broad barrel-chested Crowe, tall athletic Aroha,
 * short round Lou and small wiry Pip.
 */
function reshape(d: CharDef, o: { leg: number; torso: number; arm: number; width?: number }) {
  const b = d.build, w = o.width ?? 1;
  const slack = b.thigh + b.shin + b.ankleH - b.hipH;
  b.thigh *= o.leg; b.shin *= o.leg;
  b.hipH = b.thigh + b.shin + b.ankleH - slack * o.leg;
  b.torso *= o.torso; b.shY *= o.torso;
  // the smaller realistic head covers less of the neck
  b.neck *= 0.55;
  b.upArm *= o.arm; b.foreArm *= o.arm;
  b.shF *= w; b.shB *= w; b.legF *= w; b.legB *= w;
  d.torso.prof = d.torso.prof.map(([y, bk, f]) => [y > 0 ? y * o.torso : y, bk * w, f * w] as [number, number, number]);
  d.leg.rThigh *= Math.sqrt(w); d.leg.rKnee *= Math.sqrt(w);
  d.arm.rSh *= Math.sqrt(w); d.arm.rEl *= Math.sqrt(w);
}
// realistic adult proportions (~7 heads): long legs (crotch near half height), long torso, arms to mid-thigh
reshape(ROWAN, { leg: 2.08, torso: 1.32, arm: 1.5, width: 0.9 });
reshape(CROWE, { leg: 1.9, torso: 1.3, arm: 1.46, width: 1.1 });
reshape(AROHA, { leg: 2.02, torso: 1.3, arm: 1.46, width: 0.86 });
reshape(LOU, { leg: 1.95, torso: 1.25, arm: 1.44, width: 1.02 });
reshape(PIP, { leg: 2.12, torso: 1.22, arm: 1.48, width: 0.72 });

export const CHARS: Record<CharId, CharDef> = { rowan: ROWAN, crowe: CROWE, aroha: AROHA, lou: LOU, pip: PIP };

export { B, boot, sandal, tl, profAt, clampi, shade, mix };
export type { Canvas, P2, Sample, C };
