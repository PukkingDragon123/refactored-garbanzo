// The reels, cut like a nature documentary: establishing shots of the habitat, the reveal (small in
// its world, then close), behaviour sequences (a wide, then a close), and a closing wide pull-back.
// Each function is serialised into the page and runs there with L (page helpers, capture.cjs) and S
// (window.__S, the reel's own state):
//   jump        the dev point (?devjump=)
//   prep        [{ run(L), secs }]   before recording (stepped at 50 ms, the UI hidden)
//   setup(L)    once, right before recording; makes window.__S
//   tick(L, S, t, dt, i)   every frame (the creatures' story, on global time t)
//   shots       [{ name, type, main, secs, start(L, S, t), tick(L, S, u, j, t, dt) }]  one per camera
//               set-up, hard cuts between them; u runs 0..1 over the shot. A shot that sets no L.subj
//               is framed on the camera's centre.
//   crop        { scale, ease } for encode.py
// Zooms stay at 0.5 / 1 / 2 / 3 (1 / 2 / 4 / 6 device px per world px at 1280x720; x3 in the reel).
module.exports = {
  // ==================================================================== the Glasseye Whaler
  shark: {
    jump: 'dive:kelp',
    preRoll: 2,
    crop: { scale: 3, ease: 0.6 },
    setup: function (L) {
      const p = L.pl();
      // Mori unseen in the kelp (the seal pod plays about him), until he comes to the drop-off
      p.x = 470; p.y = 120; p.vx = 0; p.vy = 0; L.mori(false);
      const sh = L.near('glasseye', 3600);
      window.__S = { sh, P: null, last: null, dodge: 0 };
      L.camSet(560, 150, 1);
    },
    tick: function (L, S, t, dt, i) {
      const sh = S.sh, p = L.pl();
      if (S.P !== null) {
        if (sh.st !== S.last) {
          L.beat(sh.st); S.last = sh.st;
          if (sh.st === 'charge') {
            // Mori kicks up and back out of its line, and it shoots past under him (in slow motion)
            const dir = Math.sign(p.x - sh.x) || 1;
            sh.chargeTo = [p.x + dir * 170, p.y + 85];
            S.dodge = 0.9; S.slowAt = t;
          }
        }
        const T = t - S.P;
        // the tell comes on cue; the charge too if the turn holds it up
        // the circling holds until the cut to the hunch; the hunch holds until the cut to the charge
        if (sh.st === 'circle' && T < 10.1) sh.stT = Math.min(sh.stT, 1);
        if (sh.st === 'circle' && T >= 10.1) { sh.st = 'hunch'; sh.stT = 0; sh.setAnim('hunch'); }
        if (sh.st === 'hunch' && T < 14.3) sh.stT = Math.min(sh.stT, 1);
        if (sh.st === 'hunch' && T > 16) { sh.turnT = 0; sh.stT = 5; }
        if (S.slowAt !== undefined) {
          const k = t - S.slowAt;
          L.slow(k < 0.15 ? 1 - k / 0.15 * 0.68 : k < 2.6 ? 0.32 : k < 3.2 ? 0.32 + (k - 2.6) / 0.6 * 0.68 : 1);
        }
        if (sh.st === 'veer' && !S.gone && S.slowAt !== undefined && t - S.slowAt > 3.4) {
          // it has made its point: off into the blue
          S.gone = true; sh.giveUp(40); sh.wp = [p.x + 760, 420];
        }
        if (S.gone) sh.wp = [p.x + 760, 420];
      }
      if (S.dodge > 0) { S.dodge -= dt; L.keys(['KeyW', sh.x > p.x ? 'KeyA' : 'KeyD']); } else L.keys([]);
      return { st: sh.st, sx: Math.round(sh.x), px: Math.round(p.x), slow: window.game.slowmo };
    },
    shots: [
      { name: 'kelp canopy', type: 'establish', main: 'kelp', secs: 6,
        tick: function (L, S, u) { L.pan(520, 150, 700, 150, 1, u); } },
      { name: 'kelp fronds', type: 'close', main: 'kelp', secs: 4.5,
        tick: function (L, S, u) { L.pan(800, 72, 810, 66, 3, u); } },
      { name: 'the seal pod', type: 'establish', main: 'seals', secs: 5,
        start: function (L, S) { const s = L.sc().animals.filter(a => a.species === 'corvexseal'); S.seals = s; const cx = s.reduce((q, a) => q + a.x, 0) / s.length, cy = s.reduce((q, a) => q + a.y, 0) / s.length; L.camSet(cx, Math.max(150, cy + 40), 1); },
        tick: function (L, S, u, j, t, dt) { const s = S.seals; const cx = s.reduce((q, a) => q + a.x, 0) / s.length, cy = s.reduce((q, a) => q + a.y, 0) / s.length; L.camEase(cx, Math.max(150, cy + 40), 1, 0.7, dt); } },
      { name: 'the reef', type: 'establish', main: 'kingfish', secs: 5,
        tick: function (L, S, u) { L.pan(2060, 190, 2240, 190, 1, u); } },
      { name: 'the drop-off', type: 'reveal', main: 'patrol', secs: 5,
        start: function (L, S) { const sh = S.sh; sh.x = 3560; sh.y = 360; sh.vx = -30; sh.st = 'patrol'; sh.cool = 30; sh.wp = [3300, 380]; L.pl().x = 2400; L.camSet(3440, 420, 0.5); },
        tick: function (L, S, u) { L.pan(3440, 420, 3400, 416, 0.5, u); } },
      { name: 'the Glasseye', type: 'close', main: 'patrol', secs: 5,
        start: function (L, S) { L.camSet(S.sh.x, S.sh.y, 1); },
        tick: function (L, S, u, j, t, dt) { L.camEase(S.sh.x, S.sh.y + 10, 1, 1.4, dt); L.subj = { x: S.sh.x, y: S.sh.y }; } },
      { name: 'Mori at the ledge', type: 'behaviour:observe', main: 'mori', secs: 4,
        start: function (L, S) {
          const p = L.pl(); p.x = 3360; p.y = 352; p.vx = 0; p.vy = 0; p.facing = 1; L.mori(true);
          const sh = S.sh; sh.x = 3900; sh.y = 380; sh.st = 'patrol'; sh.cool = 30; sh.wp = [4100, 400];
          L.camSet(p.x + 20, p.y + 6, 1);
        },
        tick: function (L, S, u) { const p = L.pl(); L.pan(3380, 358, 3400, 362, 1, u); L.subj = { x: L.cam.x, y: p.y }; } },
      { name: 'it comes to look', type: 'behaviour:circle', main: 'circle', secs: 5,
        start: function (L, S, t) {
          const p = L.pl(), sh = S.sh;
          sh.x = p.x + 300; sh.y = p.y - 25; sh.vx = -50; sh.vy = 0; sh.facing = -1;
          sh.cool = 0; sh.interest = [p.x, p.y]; sh.st = 'investigate'; sh.stT = 0; sh.passes = 0;
          S.P = t; L.beat('provoke');
          L.camSet(p.x + 130, Math.max(p.y + 44, 408), 0.5);
        },
        tick: function (L, S, u, j, t, dt) { const sh = S.sh, p = L.pl(); const tx = sh.x * 0.58 + p.x * 0.42, ty = sh.y * 0.55 + p.y * 0.45; L.camEase(tx, Math.max(ty + 44, 408), 0.5, 1.2, dt); L.subj = { x: tx, y: ty }; } },
      { name: 'circling', type: 'close', main: 'circle', secs: 5,
        start: function (L, S) { const sh = S.sh, p = L.pl(); L.camSet(sh.x * 0.7 + p.x * 0.3, sh.y * 0.6 + p.y * 0.4, 1); },
        tick: function (L, S, u, j, t, dt) { const sh = S.sh, p = L.pl(); const tx = sh.x * 0.7 + p.x * 0.3, ty = sh.y * 0.6 + p.y * 0.4; L.camEase(tx, ty, 1, 1.5, dt); L.subj = { x: tx, y: ty }; } },
      { name: 'the hunch', type: 'behaviour:hunch', main: 'hunch', secs: 4.5,
        start: function (L, S) { const sh = S.sh, p = L.pl(); const side = Math.sign(sh.x - p.x) || 1; sh.x = p.x + side * 175; sh.y = p.y - 18; sh.vx = 0; sh.vy = 0; L.camSet(sh.x * 0.75 + p.x * 0.25, sh.y * 0.7 + p.y * 0.3, 1); },
        tick: function (L, S, u, j, t, dt) { const sh = S.sh, p = L.pl(); const tx = sh.x * 0.75 + p.x * 0.25, ty = sh.y * 0.7 + p.y * 0.3; L.camEase(tx, ty, 1, 1.5, dt); L.subj = { x: tx, y: ty }; } },
      { name: 'the charge', type: 'behaviour:charge', main: 'charge', secs: 6,
        start: function (L, S) { const sh = S.sh, p = L.pl(); if (Math.abs(sh.x - p.x) < 170) { const side = Math.sign(sh.x - p.x) || 1; sh.x = p.x + side * 175; } L.camSet(sh.x * 0.5 + p.x * 0.5, Math.max(sh.y * 0.5 + p.y * 0.5 + 44, 408), 0.5); },
        tick: function (L, S, u, j, t, dt) { const sh = S.sh, p = L.pl(); const tx = sh.x * 0.5 + p.x * 0.5, ty = sh.y * 0.5 + p.y * 0.5; L.camEase(tx, Math.max(ty + 44, 408), 0.5, 1.6, dt); L.subj = { x: tx, y: ty }; } },
      { name: 'into the blue', type: 'establish', main: 'veer', secs: 8,
        start: function (L, S) { const sh = S.sh; L.camSet(sh.x, Math.max(sh.y + 44, 420), 0.5); },
        tick: function (L, S, u, j, t, dt) { const sh = S.sh; L.camEase(sh.x, Math.max(sh.y + 44, 420), 0.5, 0.5, dt); L.subj = { x: L.cam.x * 0.4 + sh.x * 0.6, y: sh.y }; } },
    ],
  },

  // ==================================================================== Mokotūrama, the lantern gecko
  gecko: {
    jump: 'arc:ch3',
    preRoll: 2,
    crop: { scale: 3, ease: 0.8 },
    // make camp by the glowcap: the valley goes to night and the gecko comes out
    prep: [
      { secs: 14, run: function (L) { const it = L.sc().interact.find(i => /Make camp/.test(i.label)); if (it) return it.action(); console.log('[promo] no camp interact'); } },
    ],
    setup: function (L) {
      const s = L.sc(), p = L.pl(), g = L.near('mokoturama', 1700);
      // Mori back at the camp, unseen; the gecko out foraging on the open floor
      p.x = 360; p.vx = 0; L.mori(false);
      g.x = 1690; g.y = L.gy(1690); g.vx = 0; g.facing = 1; g.aw = 0;
      g.setAct('forage', 60); g.mem.tx = 1728;
      // the near-foreground reeds (layers in front of the gameplay plane) would cross a 20 px gecko
      for (const l of s.st.layers) if (!l.screen && l.p > 1.02) l.visible = false;
      window.__S = { g, last: null, lamp0: s.lampOn };
      if (s.lampOn) window.game.input.press('KeyL');
      L.camSet(1150, 170, 1);
    },
    tick: function (L, S, t, dt, i) {
      const g = S.g, inp = window.game.input;
      if (i === 1) inp.release('KeyL');
      if (g.act !== S.last) { L.beat(g.act); S.last = g.act; }
      if (S.slowAt !== undefined) { const k = t - S.slowAt; L.slow(k < 0.1 ? 1 - k / 0.1 * 0.7 : k < 1.9 ? 0.3 : k < 2.5 ? 0.3 + (k - 1.9) / 0.6 * 0.7 : 1); }
      // the gecko stays out on its patch of floor until the story moves it on
      if (!S.free && (g.x > 1765 || g.x < 1700) && g.act === 'forage') g.mem.tx = 1728;
      return { act: g.act, gx: Math.round(g.x), lamp: L.sc().lampOn, slow: window.game.slowmo };
    },
    shots: [
      { name: 'the glowing forest', type: 'establish', main: 'forest', secs: 7,
        tick: function (L, S, u) { L.pan(1130, 170, 1330, 160, 1, u); } },
      { name: 'the great glowcap', type: 'close', main: 'glowcap', secs: 5,
        tick: function (L, S, u) { L.pan(1875, 130, 1875, 232, 2, u); } },
      { name: 'the floor alight', type: 'close', main: 'fungi', secs: 4,
        tick: function (L, S, u) { L.pan(1758, L.gy(1762) - 14, 1766, L.gy(1762) - 14, 3, u); } },
      { name: 'a light that moves', type: 'reveal', main: 'forage', secs: 5,
        start: function (L, S) { const g = S.g; g.x = 1708; g.y = L.gy(1708); g.facing = 1; g.setAct('forage', 60); g.mem.tx = 1724; L.camSet(1660, 175, 1); },
        tick: function (L, S, u) { L.pan(1660, 175, 1680, 175, 1, u); L.subj = { x: L.cam.x, y: L.gy(1700) - 40 }; } },
      { name: 'the lantern gecko', type: 'close', main: 'forage', secs: 5,
        start: function (L, S) { const g = S.g; g.setAct('forage', 60); g.mem.tx = 1745; L.camSet(g.x - 6, L.gy(g.x) - 14, 3); },
        tick: function (L, S, u, j, t, dt) { const g = S.g, mx = g.x - 6 * g.facing; L.camEase(mx, L.gy(g.x) - 14, 3, 1.2, dt); L.subj = { x: mx, y: L.gy(g.x) - 10 }; } },
      { name: 'licking the dew', type: 'behaviour:feed', main: 'feed', secs: 4,
        start: function (L, S) { const g = S.g; g.vx = 0; g.setAct('feed', 60); L.camSet(g.x - 6, L.gy(g.x) - 24, 2); },
        tick: function (L, S, u) { const g = S.g; L.pan(S.g.x - 14, L.gy(g.x) - 24, S.g.x - 2, L.gy(g.x) - 24, 2, u); L.subj = { x: L.cam.x, y: L.gy(g.x) - 12 }; } },
      { name: 'the tongue', type: 'close', main: 'feed', secs: 5,
        start: function (L, S) { const g = S.g; L.camSet(g.x - 2 * g.facing, L.gy(g.x) - 13, 3); },
        tick: function (L, S, u) { const g = S.g; L.subj = { x: g.x - 2 * g.facing, y: L.gy(g.x) - 9 }; } },
      { name: 'the lantern', type: 'behaviour:lure', main: 'lure', secs: 5,
        start: function (L, S) { const g = S.g; g.setAct('lure', 60); L.camSet(g.x - 6, L.gy(g.x) - 30, 2); },
        tick: function (L, S, u) { const g = S.g; L.subj = { x: g.x - 6, y: L.gy(g.x) - 18 }; } },
      { name: 'moths to the light', type: 'close', main: 'lure', secs: 5,
        start: function (L, S) { const g = S.g; L.camSet(g.x - 8 * g.facing, L.gy(g.x) - 20, 3); },
        tick: function (L, S, u) { const g = S.g; L.pan(g.x - 8 * g.facing, L.gy(g.x) - 20, g.x - 8 * g.facing, L.gy(g.x) - 16, 3, u); L.subj = { x: L.cam.x, y: L.gy(g.x) - 12 }; } },
      { name: 'a lamp in the dark', type: 'behaviour:lights out', main: 'freeze', secs: 5,
        start: function (L, S) {
          const p = L.pl(), g = S.g;
          p.x = g.x - 96; p.y = L.gy(p.x); p.vx = 0; p.facing = 1; L.mori(true); p.poseOverride = 'cameraCrouch';
          L.camSet(g.x - 44, L.gy(g.x) - 26, 1);
        },
        tick: function (L, S, u, j, t) {
          const g = S.g, inp = window.game.input;
          L.keys(['KeyS']);
          if (j === 30) { inp.press('KeyL'); L.beat('lamp on'); }
          if (j === 31) inp.release('KeyL');
          if (j === 33) { g.setAct('freeze', 60); S.slowAt = t; }
          L.subj = { x: g.x - 44, y: L.gy(g.x) - 18 };
        } },
      { name: 'lights back on', type: 'behaviour:lights on', main: 'rest', secs: 6,
        start: function (L, S) {
          const g = S.g, inp = window.game.input; inp.press('KeyL'); S.relL = 1; L.beat('lamp off');
          g.setAct('rest', 60); L.camSet(g.x - 6 * g.facing, L.gy(g.x) - 14, 3);
        },
        tick: function (L, S, u, j) { const g = S.g; if (j === 1) window.game.input.release('KeyL'); L.subj = { x: g.x - 6 * g.facing, y: L.gy(g.x) - 10 }; } },
      { name: 'on through the night', type: 'establish', main: 'forage', secs: 8,
        start: function (L, S) { const g = S.g, p = L.pl(); S.free = true; g.setAct('forage', 60); g.mem.tx = 1840; p.poseOverride = null; L.keys([]); S.cx0 = g.x + 20; L.camSet(S.cx0, 180, 1); },
        tick: function (L, S, u) { L.pan(S.cx0, 180, S.cx0 + 90, 120, 1, u); } },
    ],
  },

  // ==================================================================== Ngaokeoke, the velvet worm
  worm: {
    jump: 'tu:boa',
    preRoll: 2,
    crop: { scale: 3, ease: 0.6 },
    setup: function (L) {
      const p = L.pl(), w = L.near('ngaokeoke', 9460);
      p.x = 9180; p.y = L.gy(9180) - 2; p.vx = 0; p.facing = 1; L.mori(false);
      window.__S = { w, last: null };
      L.camSet(9150, L.gy(9250) - 60, 1);
    },
    tick: function (L, S, t, dt, i) {
      const w = S.w, s = L.sc(), inp = window.game.input;
      if (w.act !== S.last) { L.beat(w.act); S.last = w.act; }
      // the heave: the QTE's in-world gauge silenced, mashed at a steady human pace
      if (S.heaving && !S.rolled) {
        for (const d of s.main.items) if (d.z === 64 && d.fn && !S.before.has(d) && !d.__muted) { d.fn = function () {}; d.__muted = true; }
        if (t - S.tHeave > 0.5) { if (i % 5 === 0) inp.press('Space'); else inp.release('Space'); }
        if (w.act === 'curl') { S.rolled = true; inp.release('Space'); w.mem.d = 99; w.z = 62; s.main.markDirty(); }
      }
      // out in the open it creeps along in front of the bed's ferns, not lost behind them
      if (S.rolled && w.z !== 62) { w.z = 62; s.main.markDirty(); }
      if (S.slowAt !== undefined) { const k = t - S.slowAt; L.slow(k < 0.1 ? 1 - k / 0.1 * 0.65 : k < 2.0 ? 0.35 : k < 2.6 ? 0.35 + (k - 2.0) / 0.6 * 0.65 : 1); }
      if (S.feedAt !== undefined && t > S.feedAt && w.act !== 'feed') { w.setAct('feed', 30); S.feedAt = undefined; }
      return { act: w.act, wx: Math.round(w.x), px: Math.round(L.pl().x), slow: window.game.slowmo };
    },
    shots: [
      { name: 'the feathered gully', type: 'establish', main: 'gully', secs: 7,
        tick: function (L, S, u) { L.pan(9120, L.gy(9250) - 60, 9320, L.gy(9250) - 60, 1, u); } },
      { name: 'ferns in the wind', type: 'close', main: 'ferns', secs: 5,
        tick: function (L, S, u) { L.pan(9500, L.gy(9500) - 18, 9506, L.gy(9500) - 20, 3, u); } },
      { name: 'the canopy', type: 'establish', main: 'canopy', secs: 4,
        tick: function (L, S, u) { L.pan(9400, L.gy(9400) - 70, 9410, L.gy(9400) - 200, 1, u); } },
      { name: 'Mori through the ferns', type: 'behaviour:observe', main: 'mori', secs: 5,
        start: function (L, S) { const p = L.pl(); p.x = 9330; p.y = L.gy(9330) - 2; L.mori(true); L.camSet(9370, L.gy(9380) - 22, 2); },
        tick: function (L, S, u) { const p = L.pl(); L.keys(p.x < 9408 ? ['KeyD'] : []); L.pan(9365, L.gy(9380) - 22, 9405, L.gy(9380) - 22, 2, u); L.subj = { x: L.cam.x, y: L.gy(9400) - 16 }; } },
      { name: 'something under the log', type: 'reveal', main: 'hide', secs: 4,
        start: function (L, S) { L.keys([]); L.camSet(S.w.x, L.gy(S.w.x) - 10, 3); },
        tick: function (L, S, u) { L.subj = { x: S.w.x, y: L.gy(S.w.x) - 6 }; } },
      { name: 'the heave', type: 'behaviour:roll', main: 'rolled', secs: 6,
        start: function (L, S, t) {
          const s = L.sc(), p = L.pl();
          p.x = Math.max(p.x, 9408); L.keys([]);
          const it = s.interact.find(q => Math.abs(q.x - 9450) < 4 && /Roll the rotten log/.test(q.label));
          S.before = new Set(s.main.items);
          if (it) { it.action(); S.heaving = true; S.tHeave = t; L.beat('heave'); } else console.log('[promo] no log interact');
          L.camSet(9432, L.gy(9450) - 22, 2);
        },
        tick: function (L, S, u) { L.subj = { x: 9432, y: L.gy(9450) - 16 }; } },
      { name: 'curled tight', type: 'close', main: 'curl', secs: 4,
        start: function (L, S) { L.camSet(S.w.x - 6, L.gy(S.w.x) - 12, 3); },
        tick: function (L, S, u, j) { const p = L.pl(); if (j > 40 && p.x < 9430) L.keys(['KeyD']); else L.keys([]); L.subj = { x: S.w.x - 6, y: L.gy(S.w.x) - 8 }; } },
      { name: 'the glue', type: 'behaviour:squirt', main: 'squirt', secs: 5,
        start: function (L, S, t) { const w = S.w; L.keys([]); w.mem.d = 0; S.squirtAt = t; L.camSet(w.x - 14, L.gy(w.x) - 14, 3); },
        tick: function (L, S, u, j, t) { const w = S.w; if (w.act === 'squirt' && S.slowAt === undefined) S.slowAt = t; L.subj = { x: w.x - 14, y: L.gy(w.x) - 10 }; } },
      { name: 'away to cover', type: 'behaviour:creep', main: 'creep', secs: 5,
        start: function (L, S) { const w = S.w; L.camSet(w.x + 10, L.gy(w.x) - 22, 2); },
        tick: function (L, S, u, j, t, dt) { const w = S.w; L.camEase(w.x + 10, L.gy(w.x) - 22, 2, 0.8, dt); L.subj = { x: L.cam.x, y: L.gy(w.x) - 14 }; } },
      { name: 'on many legs', type: 'close', main: 'creep', secs: 5,
        start: function (L, S) { const w = S.w; L.camSet(w.x, L.gy(w.x) - 10, 3); },
        tick: function (L, S, u, j, t, dt) { const w = S.w; L.camEase(w.x, L.gy(w.x) - 10, 3, 1.4, dt); L.subj = { x: w.x, y: L.gy(w.x) - 7 }; } },
      { name: 'a slater for supper', type: 'behaviour:feed', main: 'feed', secs: 6,
        start: function (L, S, t) { const w = S.w; w.vx = 0; w.face(w.x + 10); w.setAct('squirt', 30); w.mem.d = 1.4; S.feedAt = t + 1.5; L.beat('hunt'); L.camSet(w.x + 4, L.gy(w.x) - 10, 3); },
        tick: function (L, S, u) { const w = S.w; L.subj = { x: w.x + 4, y: L.gy(w.x) - 7 }; } },
      { name: 'the gully', type: 'establish', main: 'feed', secs: 8,
        start: function (L, S) { S.cx0 = S.w.x; L.camSet(S.cx0, L.gy(S.cx0) - 40, 1); },
        tick: function (L, S, u) { L.pan(S.cx0, L.gy(S.cx0) - 40, S.cx0 - 60, L.gy(S.cx0) - 150, 1, u); } },
    ],
  },

  // ==================================================================== the glass crab
  crab: {
    jump: 'isle:jenna',
    preRoll: 2,
    crop: { scale: 3, ease: 0.8 },
    setup: function (L) {
      const s = L.sc(), p = L.pl();
      const crabs = s.animals.filter(a => a.species === 'glasscrab' && a.x > 1450 && a.x < 1950).sort((a, b) => a.x - b.x);
      const c = crabs[1] || crabs[0], nb = crabs.find(a => a !== c);
      // a clear stretch of the tideline: west of the driftwood stakes and the wreck's name board
      c.range[0] = 1440;
      c.x = c.burrow = c.tx = 1485;
      if (nb) { nb.x = nb.burrow = nb.tx = 1519; nb.state = 'forage'; nb.hidden = 0; }
      c.state = 'feed'; c.timer = 30; c.hidden = 0; c.play('feed');
      // Mori unseen up the beach until he kneels to watch
      p.x = 1250; p.vx = 0; L.mori(false);
      window.__S = { c, nb, last: null, noDig: true, lock: null };
      // the surf comes at random: it only sends these two under when the story says so
      for (const k of [c, nb]) {
        if (!k) continue;
        const think = k.think;
        k.think = function (dt) {
          const S = window.__S, prev = this.state;
          think.call(this, dt);
          if (S.noDig && this.state === 'dig' && prev !== 'dig' && prev !== 'bolt') { this.state = prev; this.play(prev === 'wave' ? 'wave' : prev === 'feed' ? 'feed' : 'idle'); }
          if (this === S.c && S.lock === 'under' && this.state !== 'dig') { this.state = 'under'; this.hidden = 1; this.timer = 9; }
          if (this === S.c && S.lock === 'peek') { if (this.state !== 'peek') this.play('peek'); this.state = 'peek'; this.hidden = 0.55; this.timer = 9; }
          if (this === S.c && S.lock === 'feed' && this.state !== 'feed') { this.state = 'feed'; this.timer = 9; this.play('feed'); }
        };
      }
      L.camSet(1250, 175, 1);
    },
    tick: function (L, S, t, dt, i) {
      const c = S.c;
      if (S.kneel) L.keys(['KeyS']);
      if (c.state !== S.last) { L.beat(c.state); S.last = c.state; }
      if (S.slowAt !== undefined) { const k = t - S.slowAt; L.slow(k < 0.1 ? 1 - k / 0.1 * 0.65 : k < 2.2 ? 0.35 : k < 2.8 ? 0.35 + (k - 2.2) / 0.6 * 0.65 : 1); }
      return { st: c.state, cx: Math.round(c.x), slow: window.game.slowmo };
    },
    shots: [
      { name: 'the surf', type: 'establish', main: 'surf', secs: 7,
        tick: function (L, S, u) { L.pan(1230, 175, 1420, 175, 1, u); } },
      { name: 'the swash', type: 'close', main: 'surf', secs: 5,
        tick: function (L, S, u) { L.pan(1412, L.gy(1412) - 14, 1418, L.gy(1412) - 14, 3, u); } },
      { name: 'wind in the grass', type: 'close', main: 'grass', secs: 5,
        tick: function (L, S, u) { L.pan(1460, 298, 1476, 296, 2, u); } },
      { name: 'the tideline', type: 'reveal', main: 'feed', secs: 5,
        start: function (L, S) { const p = L.pl(); p.x = 1420; p.facing = 1; L.mori(true); p.poseOverride = 'cameraCrouch'; S.kneel = true; L.camSet(1470, 180, 1); },
        tick: function (L, S, u) { L.pan(1468, 182, 1478, 184, 1, u); L.subj = { x: L.cam.x + 6, y: S.c.y - 10 }; } },
      { name: 'a glass crab', type: 'close', main: 'feed', secs: 5,
        start: function (L, S) { S.lock = 'feed'; L.camSet(S.c.x + 9, S.c.y - 8, 3); },
        tick: function (L, S, u, j, t, dt) { L.camEase(S.c.x + 9, S.c.y - 8, 3, 1, dt); L.subj = { x: S.c.x + 9, y: S.c.y - 4 }; } },
      { name: 'neighbours', type: 'behaviour:feed', main: 'feed', secs: 6,
        start: function (L, S) { S.lock = null; S.c.timer = 3; if (S.nb) { S.nb.tx = S.nb.x - 12; } L.camSet(S.c.x + 18, S.c.y - 12, 2); },
        tick: function (L, S, u) { L.pan(S.c.x + 14, S.c.y - 12, S.c.x + 20, S.c.y - 12, 2, u); L.subj = { x: L.cam.x, y: S.c.y - 6 }; } },
      { name: 'the claw', type: 'behaviour:wave', main: 'wave', secs: 5,
        start: function (L, S) { const c = S.c; if (c.state !== 'dig' && c.state !== 'under') { c.state = 'wave'; c.timer = 4.6; } L.camSet(c.x + 9, c.y - 9, 3); },
        tick: function (L, S, u, j, t, dt) { L.camEase(S.c.x + 9, S.c.y - 9, 3, 1, dt); L.subj = { x: S.c.x + 9, y: S.c.y - 5 }; } },
      { name: 'into the sand', type: 'behaviour:burrow', main: 'dig', secs: 6,
        start: function (L, S) { L.camSet(S.c.x + 12, S.c.y - 12, 2); },
        tick: function (L, S, u, j, t) { const c = S.c; if (j === 36) { S.noDig = false; c.state = 'dig'; c.play('burrow', true); S.slowAt = t; } if (j === 80) S.lock = 'under'; L.subj = { x: S.c.x + 12, y: S.c.y - 6 }; } },
      { name: 'eyes up', type: 'behaviour:peek', main: 'peek', secs: 6,
        start: function (L, S) { S.lock = 'under'; L.camSet(S.c.x + 9, S.c.y - 8, 3); },
        tick: function (L, S, u, j) { if (j === 30) S.lock = 'peek'; L.subj = { x: S.c.x + 9, y: S.c.y - 4 }; } },
      { name: 'back out', type: 'close', main: 'emerge', secs: 4,
        start: function (L, S) { const c = S.c; S.lock = null; c.state = 'emerge'; c.hidden = 0; c.play('burrow', true, true); L.camSet(c.x + 9, c.y - 8, 3); },
        tick: function (L, S, u, j, t, dt) { L.camEase(S.c.x + 9, S.c.y - 8, 3, 1, dt); L.subj = { x: S.c.x + 9, y: S.c.y - 4 }; } },
      { name: 'along the tideline', type: 'establish', main: 'forage', secs: 8,
        start: function (L, S) { L.camSet(1500, 182, 1); },
        tick: function (L, S, u) { L.pan(1500, 182, 1640, 150, 1, u); } },
    ],
  },
};
