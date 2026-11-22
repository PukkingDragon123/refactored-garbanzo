// One config per reel. Each function below is serialised into the page and runs there with L, the
// page-side helpers from capture.cjs (L.sc(), L.pl(), L.camSet/camEase, L.keys, L.near, L.beat ...).
//   jump      the dev point (?devjump=)
//   secs      length of the recording
//   zoom      camera zoom; 0.5 / 1 / 1.5 keep world pixels at 1 / 2 / 3 device px at 1280x720
//   prep      [{ run(L), secs }] steps run before recording (stepped at 50 ms, the UI hidden)
//   setup(L)  once, right before recording (window.__S is the shot's own state)
//   tick(L, t, dt, i)  before every recorded frame: drive Mori, the creature and the camera; set
//             L.subj = { x, y } (world) for the crop to follow; L.beat(name) marks a behaviour beat
// Crop/encode settings for ./encode.py live under `crop`.
module.exports = {
  // ------------------------------------------------------------------ the Glasseye Whaler
  shark: {
    jump: 'dive:kelp',
    secs: 19,
    preRoll: 2,
    crop: { scale: 3, ease: 0.6 },
    setup: function (L) {
      const p = L.pl();
      p.x = 420; p.y = 118; p.vx = 0; p.vy = 0;
      window.__S = { seg: 0, last: null, sh: null, dodge: 0 };
      L.camSet(p.x + 60, p.y - 6, 1);
    },
    tick: function (L, t, dt, i) {
      const S = window.__S, p = L.pl();
      const CUT = 4.8;
      if (t < CUT) {
        // the kelp shallows: Mori swims right through the giant kelp (it parts), the seal pod about him
        if (i === 0) L.beat('kelp');
        L.keys(t > 0.15 ? ['KeyD'] : []);
        L.camEase(p.x + 40, p.y - 8, 1, 2.2, dt);
        L.subj = { x: p.x + 25, y: p.y - 6 };
        return { px: Math.round(p.x), py: Math.round(p.y) };
      }
      if (S.seg === 0) {
        // cut: the drop-off. Mori hangs out over the blue; the shark comes up to look at him
        S.seg = 1;
        L.keys([]);
        p.x = 3360; p.y = 352; p.vx = 0; p.vy = 0; p.facing = 1;
        const sh = S.sh = L.near('glasseye', 3500);
        sh.x = p.x + 270; sh.y = p.y - 25; sh.vx = -50; sh.vy = 0; sh.facing = -1;
        sh.cool = 0; sh.interest = [p.x, p.y]; sh.st = 'investigate'; sh.stT = 0; sh.passes = 0;
        L.camSet(p.x + 120, Math.max(p.y + 34, 408), 0.5);
        L.beat('dropoff');
      }
      const sh = S.sh;
      if (sh.st !== S.last) {
        L.beat(sh.st); S.last = sh.st;
        // a shorter first lap before the tell
        if (sh.st === 'circle' && !S.lapped) { S.lapped = true; sh.stT = 1.8; }
        // the charge: Mori kicks up and back out of its line, and it shoots past under him
        if (sh.st === 'charge') {
          const dir = Math.sign(p.x - sh.x) || 1;
          sh.chargeTo = [p.x + dir * 150, p.y + 55];
          S.dodge = 0.85;
        }
      }
      if (S.dodge > 0) { S.dodge -= dt; L.keys(['KeyW', sh.x > p.x ? 'KeyA' : 'KeyD']); }
      else L.keys([]);
      const tx = sh.x * 0.58 + p.x * 0.42, ty = sh.y * 0.55 + p.y * 0.45;
      // (the camera sits low (its view's top 48+ px under the surface): the underside of the surface is painted for the dive's own zoom
      // and ends short of the frame's edge at 0.5, so it is kept just out of view)
      L.camEase(tx, Math.max(ty + 44, 408), 0.5, 2.0, dt);
      L.subj = { x: tx, y: ty };
      return { st: sh.st, sx: Math.round(sh.x), sy: Math.round(sh.y), px: Math.round(p.x), py: Math.round(p.y) };
    },
  },

  // ------------------------------------------------------------------ Mokotūrama, the lantern gecko
  gecko: {
    jump: 'arc:ch3',
    secs: 18,
    preRoll: 2,
    crop: { scale: 3, ease: 0.8 },
    // make camp by the glowcap: the valley goes to night and the gecko comes out
    prep: [
      { secs: 14, run: function (L) { const it = L.sc().interact.find(i => /Make camp/.test(i.label)); if (it) return it.action(); console.log('[promo] no camp interact'); } },
    ],
    setup: function (L) {
      const s = L.sc(), p = L.pl(), g = L.near('mokoturama', 1700);
      const gy = x => s.st.terrain.groundY(x);
      // Mori crouched in the dark by the glowing log, lamp off; the gecko out on the open floor
      p.x = 1598; p.y = gy(1598); p.vx = 0; p.facing = 1;
      g.x = 1702; g.y = gy(1702); g.vx = 0; g.facing = 1; g.aw = 0;
      g.setAct('forage', 30); g.mem.tx = 1728;
      window.__S = { g, last: null, lamp0: s.lampOn };
      console.log('[promo] lamp', s.lampOn, 'tod', s.tod);
      // the near-foreground reeds (layers in front of the gameplay plane) would cross a 20 px gecko: hide them
      for (const l of s.st.layers) if (!l.screen && l.p > 1.02) { console.log('[promo] hide layer', l.name, l.p); l.visible = false; }
      L.camSet(g.x - 6, gy(1715) - 14, 3);
    },
    tick: function (L, t, dt, i) {
      const S = window.__S, g = S.g, p = L.pl(), s = L.sc(), inp = window.game.input;
      const at = (sec) => i === Math.round(sec * 30);
      if (i === 0 && S.lamp0) inp.press('KeyL'); else if (i === 1) inp.release('KeyL');
      // the night out: creep, lick the glowcap dew, swing the lantern for the moths, then Mori's lamp
      if (at(3.6)) { g.setAct('feed', 30); g.vx = 0; }
      if (at(7.4)) { g.setAct('lure', 30); }
      if (at(12.6)) { inp.press('KeyL'); L.beat('lamp'); }
      if (at(12.7)) { inp.release('KeyL'); }
      if (at(12.75) && g.act !== 'freeze') { g.setAct('freeze', 30); }
      if (at(15.2)) { inp.press('KeyL'); }
      if (at(15.3)) { inp.release('KeyL'); }
      if (at(15.6)) { g.setAct('rest', 30); }
      if (g.act !== S.last) { L.beat(g.act); S.last = g.act; }
      L.keys(['KeyS']);
      const gy = s.st.terrain.groundY(g.x);
      // (its x is at the head end: frame the middle of the body)
      const mx = g.x - 6 * g.facing;
      L.camEase(mx, gy - 14, 3, 1.2, dt);
      L.subj = { x: mx, y: gy - 10 };
      return { act: g.act, gx: Math.round(g.x), aw: +(g.aw || 0).toFixed(2), lamp: s.lampOn };
    },
  },

  // ------------------------------------------------------------------ Ngaokeoke, the velvet worm
  worm: {
    jump: 'tu:boa',
    secs: 18,
    preRoll: 2,
    crop: { scale: 3, ease: 0.6 },
    setup: function (L) {
      const s = L.sc(), p = L.pl();
      p.x = 9330; p.y = s.st.terrain.groundY(9330) - 2; p.vx = 0; p.facing = 1;
      const w = L.near('ngaokeoke', 9460);
      window.__S = { w, last: null, rolled: false };
      L.camSet(9425, s.st.terrain.groundY(9450) - 22, 2);
    },
    tick: function (L, t, dt, i) {
      const S = window.__S, w = S.w, p = L.pl(), s = L.sc(), inp = window.game.input;
      if (w && w.act !== S.last) { L.beat(w.act); S.last = w.act; }
      // Mori walks up to the big rotten log
      if (!S.started) L.keys(p.x < 9408 ? ['KeyD'] : []);
      if (!S.started && p.x >= 9408 && Math.abs(p.vx) < 2 && t > 1) {
        S.started = true;
        const it = s.interact.find(q => Math.abs(q.x - 9450) < 4 && /Roll the rotten log/.test(q.label));
        console.log('[promo] log interact', !!it, Math.round(p.x));
        S.before = new Set(s.main.items);
        if (it) { S.act = it.action(); L.beat('heave'); S.tHeave = t; }
      }
      // the heave: hide the QTE's in-world gauge, mash it (a steady, human pace)
      if (S.started && !S.rolled) {
        for (const d of s.main.items) if (d.z === 64 && d.fn && !S.before.has(d) && !d.__muted) { d.fn = function () {}; d.__muted = true; }
        if (t - S.tHeave > 0.5) { if (i % 5 === 0) inp.press('Space'); else inp.release('Space'); }
        if (w && w.act === 'curl') { S.rolled = true; L.beat('rolled'); S.tRoll = t; inp.release('Space'); w.z = 62; s.main.markDirty(); }
      }
      // lean in for a closer look: in range of its glue
      if (S.rolled && !S.leaned && t - S.tRoll > 0.8) { L.keys(p.x < 9430 ? ['KeyD'] : []); if (p.x >= 9430) { S.leaned = true; L.keys([]); } }
      else if (S.rolled) L.keys([]);
      const gy = s.st.terrain.groundY(9450);
      // a hard cut in close once it is out in the light: the worm and Mori's boots
      if (S.rolled && !S.close && t - S.tRoll > 0.7) { S.close = true; L.beat('closeup'); L.camSet(w.x - 10, s.st.terrain.groundY(w.x) - 12, 3); }
      if (S.close) {
        // (out in the open it creeps along in front of the bed's ferns, not lost behind them)
        if (w.z !== 62) { w.z = 62; s.main.markDirty(); }
        const cx = w.x * 0.85 + p.x * 0.15, wy = s.st.terrain.groundY(w.x);
        L.camEase(cx, wy - 12, 3, 1.4, dt);
        L.subj = { x: cx, y: wy - 8 };
      } else {
        L.camEase(9425, gy - 22, 2, 1.5, dt);
        L.subj = { x: 9425, y: gy - 16 };
      }
      return { act: w && w.act, wx: w && Math.round(w.x), px: Math.round(p.x), pst: p.state };
    },
  },

  // ------------------------------------------------------------------ the glass crab
  crab: {
    jump: 'isle:jenna',
    secs: 18,
    preRoll: 8.2,
    crop: { scale: 3, ease: 0.8 },
    setup: function (L) {
      const s = L.sc(), p = L.pl();
      const crabs = s.animals.filter(a => a.species === 'glasscrab' && a.x > 1450 && a.x < 1950).sort((a, b) => a.x - b.x);
      const c = crabs[1] || crabs[0];
      // its neighbour close by (it waves its big claw at it)
      const nb = crabs.find(a => a !== c);
      // a clear stretch of the tideline (no driftwood stakes in front of them), the pair 34 px apart
      // (west of the stakes and the wreck's name board, between the palm and the open surf)
      c.range[0] = 1440;
      c.x = c.burrow = c.tx = 1485;
      if (nb) { nb.x = nb.burrow = nb.tx = c.x + 34; nb.state = 'forage'; nb.hidden = 0; }
      c.state = 'feed'; c.timer = 2.6; c.hidden = 0; c.play('feed');
      window.__S = { c, nb, last: null, dug: false, noDig: true };
      // until the cut-in, a wash of surf does not send this crab under (the swash comes at random)
      for (const k of [c, nb]) {
        if (!k) continue;
        const think = k.think;
        k.think = function (dt) {
          const prev = this.state; think.call(this, dt);
          const S = window.__S;
          if (S.noDig && this.state === 'dig' && prev !== 'dig' && prev !== 'bolt') { this.state = prev; this.play(prev === 'wave' ? 'wave' : prev === 'feed' ? 'feed' : 'idle'); }
          // the scripted spell under the sand (the surf would keep it down for as long as it likes)
          if (this === S.c && S.lock === 'under' && this.state !== 'dig') { this.state = 'under'; this.hidden = 1; this.timer = 9; }
          if (this === S.c && S.lock === 'peek') { if (this.state !== 'peek') this.play('peek'); this.state = 'peek'; this.hidden = 0.55; this.timer = 9; }
        };
      }
      p.x = c.x - 62; p.vx = 0; p.facing = 1;
      console.log('[promo] crabs', JSON.stringify(crabs.map(a => [Math.round(a.x), Math.round(a.y), a.state])));
      L.camSet(c.x + 6, c.y - 10, 2);
    },
    tick: function (L, t, dt, i) {
      const S = window.__S, c = S.c, p = L.pl();
      if (c.state !== S.last) {
        L.beat(c.state); S.last = c.state;
        if (c.state === 'dig') S.dug = true;
        // (shorter waits underground: it peeks soon, and comes back out)
      }
      // the wave: it squares up to its neighbour and waves the big claw
      if (i === 78 && !S.dug && c.state !== 'dig' && c.state !== 'under') { c.state = 'wave'; c.timer = 2.8; }
      if (t > 9.6 && !S.dug) { c.state = 'dig'; c.play('burrow', true); S.dug = true; }
      if (i === 300) S.lock = 'under';
      if (i === 345) S.lock = 'peek';
      if (i === 435) { S.lock = null; c.state = 'emerge'; c.hidden = 0; c.play('burrow', true, true); }
      L.keys(['KeyS']);
      // a hard cut in, closer, just before it digs in
      if (i === 285) { L.camSet(c.x + 9, c.y - 8, 3); L.beat('closeup'); S.noDig = false; }
      if (i < 285) L.camEase(c.x + 6, c.y - 12, 2, 1.0, dt); else L.camEase(c.x + 9, c.y - 8, 3, 1.0, dt);
      L.subj = i < 285 ? { x: c.x + 6, y: c.y - 6 } : { x: c.x + 9, y: c.y - 4 };
      return { st: c.state, cx: Math.round(c.x), hid: c.hidden };
    },
  },
};
