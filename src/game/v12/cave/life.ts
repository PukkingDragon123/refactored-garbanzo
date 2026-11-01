// V12 Te Rua Pōuri, the animals in the scene (their minds and the field guide: ./species.ts):
//
//   the lantern     bright, it reaches the animals: salamanders flee under their ledges, wētā scatter,
//                   the big wētā crouches and jumps at it, harvestmen bob, the centipede rears. Shut
//                   (crouch still, or L) it reaches nobody; keep still and the cave comes back to life.
//   the Ghost       light and footsteps at the shore draw it (or the lantern on the caver's pole, or
//   Gulper          bait tossed in the shallows). Its tell: a low rumble, rings closing in on the spot
//                   it will strike, then bubbles boiling up. Then it rises, gapes and lunges a long
//                   step up the shingle. Still there and it catches Mori: knocked flat, something
//                   dropped, and a fright that empties his stomach. Back off when the rings come, or
//                   watch from behind the rock while it gapes at the pole.
//   a salamander    with the lantern shut, kneel at the pool and ease a hand in (the catch close-up):
//                   a skin swab for the lab, and it goes back in the pool.

import type { FieldScene } from '../../scenes/field';
import type { Interactable } from '../../../world/npc';
import type { Animal } from '../../wild/animal';
import { Custom } from '../../../world/props';
import { packColor, WHITE } from '../../../gfx/renderer';
import { game } from '../../game';
import { A } from '../../assets';
import { audio } from '../../../core/audio';
import { rand, clamp } from '../../../core/math';
import { floatText, floatNotice } from '../../../ui/v12/float';
import { add, fits, count, remove } from '../../inventory';
import { addHunger } from '../hunger';
import { hitMori, moriHidden } from '../wilds';
import { CAVE_CTX, SAL_ID, GULPER_ID, caveKeep } from './species';
import { LAKE, SPOT, POOLS, floorOf, poolTop } from './layout';
import { LAMP, lanternFrames, drawLanternGlow } from './dark';
import type { CaveRuntime } from './site';

const BAITS = ['fishbait', 'grublure', 'scentlure'];

export function attachLife(f: FieldScene, run: CaveRuntime) {
  const p = f.player;
  const shoreY = () => floorOf('t4', SPOT.pole);
  const onShore = () => p.y > 1700 && p.x > 100 && p.x < 800;
  const gulper = () => f.animals.find(a => a.species === GULPER_ID && !a.gone && !a.dead) ?? null;
  let bait: { x: number; life: number } | null = null;
  let told = { tell: false, gape: false, weta: false, sal: false, seen: false, lake: false, hit: false };

  // ---- what the animals feel
  CAVE_CTX.lit = (x, y) => {
    if (LAMP.mode !== 'bright') return 0;
    const L = run.lantern();
    if (!L) return 0;
    return clamp(1 - Math.hypot(x - L[0], y - L[1]) / (LAMP.R * 0.95));
  };
  CAVE_CTX.stir = (x, y) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d > 140) return 0;
    const move = clamp((Math.abs(p.vx) - 8) / 50) + (!p.onGround && p.vy > 60 ? 0.6 : 0);
    return clamp(move * (1 - d / 140) * 1.6);
  };
  CAVE_CTX.hidden = () => moriHidden(f) || p.state === 'hide';
  CAVE_CTX.calmT = 0;
  CAVE_CTX.lure = () => {
    if (bait) return { x: bait.x, k: 0.42, kind: 'bait' };
    if (LAMP.mode === 'pole') return { x: LAKE.x0 + 2, k: 0.34, kind: 'pole' };
    if (onShore() && p.x > 716 && p.state !== 'climb') {
      const k = (LAMP.mode === 'bright' ? 0.2 : 0.04) + (Math.abs(p.vx) > 10 ? 0.18 : 0) + (!p.onGround ? 0.2 : 0);
      return { x: LAKE.x0 + 2, k, kind: 'mori' };
    }
    return null;
  };
  CAVE_CTX.ring = (x, r, inward) => run.water.ring(x, LAKE.top, r, inward ? 0.9 : 1.6, inward ? 1 : 0.55, inward);
  CAVE_CTX.bubbles = (x, n, big) => { for (let i = 0; i < n; i++) run.water.bubble(x + rand.range(-8, 8), LAKE.top + rand.range(14, 40), LAKE.top, big ? rand.range(1.2, 2) : rand.range(0.6, 1.1)); };
  CAVE_CTX.rumble = a => {
    f.sfx('callWhale', a.x, 0.7, 0.32);
    f.sfx('callGrowl', a.x, 0.4, 0.22);
    if (Math.abs(p.x - a.x) < 500 && p.y > 1500) {
      f.st.shake(0.8, 1.2);
      void floatText({ text: told.tell ? rand.pick(['Rings. RINGS. Back off!', 'The water\'s moving again...']) : '...the water\'s moving. Rings, closing in on one spot. Pike wrote about this. BACK. OFF.', style: 'scared', ms: 2600 });
      told.tell = true;
    }
  };
  CAVE_CTX.surface = a => {
    f.splash(LAKE.x0 + 30, LAKE.top, 2.2);
    f.sfx('splashBig', a.x, 0.9, 0.6);
    if (!told.seen) {
      told.seen = true;
      game.save.flags['dc:gulperSeen'] = true;
      game.persist();
      audio.play('discover', { vol: 0.45, pitch: 0.6 });
    }
  };
  CAVE_CTX.gape = a => {
    f.sfx('roar', a.x, 0.7, 0.45);
    void floatText({ text: 'HHHAAAAAAAAHHHH...', x: a.x - a.facing * 96, y: LAKE.top - 70, style: 'shout', ms: 1300 });
    if (!told.gape) {
      told.gape = true;
      setTimeout(() => void floatText({ text: CAVE_CTX.hidden() ? 'Oh. Oh WOW. Its mouth. Don\'t breathe. Camera. CAMERA.' : 'That MOUTH. I could walk in there standing UP.', style: 'whisper', ms: 3000 }), 600);
    }
  };
  CAVE_CTX.gulp = (a, x, kind) => {
    f.sfx('gulp', a.x, 1, 0.35);
    f.splash(x + 10, LAKE.top, 2.6);
    f.st.shake(3.5, 0.5);
    game.r.post.flash = Math.max(game.r.post.flash, 0.12);
    // the lunge reaches a long step up the shingle
    const caught = onShore() && p.x > x - 48 && p.state !== 'climb' && !(p.state === 'hide');
    if (caught) {
      hitMori(f, x + 40, { sev: 2, drop: true });
      addHunger(0.06, 'fright');
      game.save.flags['dc:gulped'] = true;
      game.persist();
      setTimeout(() => void floatText({ text: told.hit ? 'AGAIN?! Rings, then bubbles, then RUN, Mori!' : 'It... it nearly HAD me. Rings, then bubbles, then THAT. Rings and bubbles: run. Got it. My stomach just fell out of my body.', style: 'scared', ms: 3200 }), 1400);
      told.hit = true;
    } else if (kind === 'mori' && onShore()) void floatText({ text: 'Whoa! MISSED. Missed me. Missed me...', style: 'scared', ms: 1800 });
    if (kind === 'bait' && bait) { bait = null; setTimeout(() => void floatText({ text: 'GULP. Bait: gone. Fish: gone. Half the shallows: gone.', style: 'think', ms: 2400 }), 900); }
  };
  CAVE_CTX.wetaWind = a => {
    for (let i = 0; i < 3; i++) setTimeout(() => { if (game.scene === f) f.sfx('callClick', a.x, 0.5, 1.8); }, i * 160);
    void floatText({ text: 'tk-tk-tk', x: a.x, y: a.y - 14, style: 'whisper', ms: 900 });
    if (!told.weta) { told.weta = true; void floatText({ text: 'That big one is looking at my lantern. Why is it crouching. WHY IS IT CROUCHING.', style: 'scared', ms: 2400 }); }
  };
  CAVE_CTX.wetaHit = a => {
    const L = run.lantern();
    if (!L || LAMP.mode !== 'bright' || Math.hypot(a.x - L[0], a.y - L[1]) > 26) { void floatText({ text: 'Missed me! Ha! ...please don\'t come back.', style: 'scared', ms: 1600 }); return false; }
    void floatText({ text: 'THWACK!', x: p.x, y: p.y - 50, style: 'shout', ms: 800 });
    hitMori(f, a.x, { sev: 1 });
    setTimeout(() => void floatText({ text: 'GET IT OFF! Get it off get it off... it\'s off. Shutter the lantern near the big ones. Noted.', style: 'scared', ms: 2600 }), 700);
    return true;
  };
  CAVE_CTX.rear = a => { f.sfx('callHiss', a.x, 0.5, 1.8); void floatText({ text: 'hssss', x: a.x, y: a.y - 14, style: 'whisper', ms: 800 }); };
  CAVE_CTX.bite = a => {
    if (Math.abs(p.x - a.x) < 26 && Math.abs(p.y - a.y) < 20) {
      hitMori(f, a.x, { sev: 1 });
      setTimeout(() => void floatText({ text: 'OW! It BIT me. It bit me with its LEGS. Its legs have FANGS.', style: 'scared', ms: 2400 }), 500);
    }
  };

  // ---- dev points: the Gulper already drawn to the shore, the lantern already on the pole
  if (game.save.flags['dev:gulperNow']) { delete game.save.flags['dev:gulperNow']; setTimeout(() => { const g = gulper(); if (g) { caveKeep(g).interest = 1.2; g.x = 1100; } }, 400); }
  if (game.save.flags['dev:gulperPole']) { delete game.save.flags['dev:gulperPole']; LAMP.mode = 'pole'; setTimeout(() => { const g = gulper(); if (g) { caveKeep(g).interest = 1.2; g.x = 1000; } p.crouch = true; }, 400); }
  if (game.save.flags['dev:caveDim']) { delete game.save.flags['dev:caveDim']; LAMP.mode = 'dim'; LAMP.auto = false; }

  // ---- the caver's pole: hang the lantern on it, or take it down
  const poleTop = () => shoreY() - 46;
  run.extra.push(() => (LAMP.mode === 'pole' ? { x: SPOT.pole + 3, y: poleTop() + 8, r: 118, k: 1, flick: 1 } : null));
  f.main.add(new Custom(52, (rr, st) => {
    if (LAMP.mode !== 'pole') return;
    const fr = lanternFrames();
    const sw = Math.round(Math.sin(st.time * 1.3) * 0.6);
    rr.draw(fr.open, SPOT.pole + 3 + sw, poleTop() + 2, 1, 1, 0, WHITE);
    drawLanternGlow(rr, SPOT.pole + 3 + sw, poleTop() + 2, 'pole', st.time);
  }));
  (f.interact as Interactable[]).push({
    x: SPOT.pole, y: shoreY(), w: 12, h: 20, standX: SPOT.pole - 10,
    get label() { return LAMP.mode === 'pole' ? 'Take the lantern down off the pole' : 'Hang the lantern on the caver\'s pole <span style="opacity:.75">· a light for the lake</span>'; },
    enabled: () => p.state !== 'climb',
    action: () => {
      if (LAMP.mode === 'pole') {
        LAMP.mode = 'bright'; LAMP.auto = false;
        audio.play('lanternOn', { vol: 0.4 });
        void floatText({ text: 'Lantern back. Light back. Heart rate... working on it.', style: 'think', ms: 2000 });
      } else {
        LAMP.mode = 'pole';
        audio.play('lanternOn', { vol: 0.4, pitch: 0.9 });
        p.body.react('jump');
        void floatText({ text: 'Light on the pole, like Pike said. Now get behind that rock. Quietly. And WAIT.', style: 'whisper', ms: 2800 });
        if (!game.save.flags['dc:poleTip']) { game.save.flags['dc:poleTip'] = true; floatNotice('Hide behind the rock (crouch) and keep still. Watch the water.', 3200, { tag: 'LURE' }); }
      }
    },
  } as Interactable);
  // ---- bait in the shallows
  (f.interact as Interactable[]).push({
    x: LAKE.x0 - 8, y: floorOf('t4', LAKE.x0 - 8), w: 10, h: 18, standX: LAKE.x0 - 16,
    get label() { const b = BAITS.find(id => count(id) > 0); return b ? `Toss bait into the shallows <span style="opacity:.75">· then back off</span>` : 'Bait for the lake <span style="opacity:.75">(no bait in the pack)</span>'; },
    enabled: () => p.state !== 'climb' && !bait,
    action: () => {
      const id = BAITS.find(i => count(i) > 0);
      if (!id) { audio.play('wrong', { vol: 0.4 }); void floatText({ text: 'Nothing to throw. Fish bait from the workbench would do it.', style: 'think', ms: 2200 }); return; }
      remove(id, 1);
      bait = { x: LAKE.x0 + 26, life: 70 };
      f.splash(bait.x, LAKE.top, 0.8);
      p.body.react('jump');
      void floatText({ text: 'Plop. Now: back. Back back back. Behind the rock.', style: 'whisper', ms: 2200 });
    },
  } as Interactable);
  f.main.add(new Custom(-2.5, (rr, st) => {
    if (!bait) return;
    const y = LAKE.top - 1 + Math.round(Math.sin(st.time * 2) * 0.6);
    rr.rect(bait.x - 2, y, 4, 1, packColor(0.7, 0.55, 0.4, 1));
    rr.rect(bait.x - 1, y - 1, 2, 1, packColor(0.85, 0.7, 0.55, 1));
  }));

  // ---- catching a blind salamander
  const nearestSal = (): Animal | null => {
    let best: Animal | null = null, bd = 30;
    for (const a of f.animals) {
      if (a.species !== SAL_ID || a.gone || a.dead || a.hidden > 0.5) continue;
      const d = Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 0.5;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  };
  let busy = false;
  const catchSal = async () => {
    const a = nearestSal();
    if (!a || busy) return;
    busy = true;
    try {
      p.facing = a.x >= p.x ? 1 : -1;
      if (LAMP.mode === 'bright') {
        a.setAct('flee', 4);
        f.sfx('splash', a.x, 0.2, 2);
        void floatText({ text: 'Too much light! It felt the lantern and it\'s gone under the ledge. Shutter it first.', style: 'think', ms: 2600 });
        return;
      }
      if (!fits('smp_salswab', 1)) { void floatText({ text: 'No room in the pack for a swab. Something has to go.', style: 'think', ms: 2200 }); return; }
      a.setAct('rest', 10);
      const Q = await import('../qte');
      const res = await Q.qte({ kind: 'ring', label: 'GENTLY...', difficulty: 0.5, count: 1, closeup: { scene: 'catch', item: 'smp_salswab', itemKind: 'animal' }, f, x: a.x, y: a.y - 20, pose: 'kneel' });
      if (!res.ok) { a.setAct('flee', 4); floatNotice('It slipped through my fingers like wet soap.', 2200); return; }
      const got = add('smp_salswab', 1);
      if (got > 0) {
        const [cx, cy] = f.css(a.x, a.y - 10);
        f.hud?.flyItem('smp_salswab', got, 'Blind salamander swab', cx, cy);
        audio.play('collectPop' as never, { vol: 0.6 });
        floatNotice('Collected: Blind salamander swab', 2600);
        game.save.flags['dc:salcaught'] = true;
        game.persist();
        f.hud?.refresh();
        void floatText({ text: 'Cold. Soft. Like holding a little ghost. A quick swab... and back you go. Thank you.', style: 'happy', ms: 2800 });
      }
      a.setAct('flee', 3);
    } finally { busy = false; }
  };
  (f.interact as Interactable[]).push({
    get x() { return nearestSal()?.x ?? -9999; },
    get y() { const a = nearestSal(); return a ? floorOf(POOLS.find(q => a.x > q.x0 - 4 && a.x < q.x1 + 4)?.tier ?? 't3', a.x) : -9999; },
    w: 18, h: 16,
    get label() { return LAMP.mode === 'bright' ? 'Catch the salamander <span style="opacity:.75">(shutter the lantern first)</span>' : 'Ease a hand into the pool <span style="opacity:.75">· a skin swab</span>'; },
    enabled: () => !busy && !!nearestSal() && p.state !== 'climb',
    action: () => { void catchSal(); },
  } as Interactable);

  // ---- every frame: the calm the salamanders need, the bait, the lake, the pools underfoot
  let waded = false, splashT = 0;
  f.main.add(new Custom(0, () => {}, dt => {
    if (game.scene !== f || !(dt > 0)) return;
    const calm = LAMP.mode !== 'bright' && Math.abs(p.vx) < 5 && (p.crouch || p.state === 'hide' || LAMP.mode === 'pole' || !p.onGround === false);
    CAVE_CTX.calmT = calm ? CAVE_CTX.calmT + dt : Math.max(0, CAVE_CTX.calmT - dt * 3);
    if (bait) { bait.life -= dt; if (bait.life <= 0) bait = null; }
    // the lake
    if (onShore() && p.onGround && !told.lake) {
      told.lake = true;
      if (!game.save.flags['dc:lake']) {
        game.save.flags['dc:lake'] = true;
        game.persist();
        audio.play('discover', { vol: 0.4, pitch: 0.7 });
        setTimeout(() => void floatText({ text: 'Te Waha o te Pō. The mouth of the night. A whole sky of glowworms... over black water. It\'s beautiful. Why is it so QUIET.', style: 'whisper', ms: 3600 }), 1200);
      }
    }
    // first sight of a salamander
    if (!told.sal) for (const a of f.animals) if (a.species === SAL_ID && Math.abs(a.x - p.x) < 90 && Math.abs(a.y - p.y) < 40 && a.hidden < 0.3) {
      told.sal = true;
      setTimeout(() => void floatText({ text: LAMP.mode === 'bright' ? 'Something pale in the pool... gone. It went the moment the light touched it. Shutter the lantern, Mori. Sit. Wait.' : 'There. Pale, pink, no eyes, little red feathers for gills. A blind salamander. Don\'t. Move.', style: 'whisper', ms: 3200 }), 400);
      break;
    }
    // wading through a pool
    let wading = false;
    for (const q of POOLS) if (p.onGround && p.x > q.x0 + 3 && p.x < q.x1 - 3 && p.y > poolTop(q) + 2 && Math.abs(p.y - floorOf(q.tier, p.x)) < 3) wading = true;
    if (wading) {
      p.wadeK = 0.74; waded = true;
      splashT -= dt * Math.abs(p.vx) / 40;
      if (Math.abs(p.vx) > 6 && splashT <= 0) { splashT = 0.5; audio.play('stepWater', { vol: 0.3, pitch: rand.range(0.6, 0.8) }); run.water.ring(p.x, p.y - Math.max(0, p.y - floorOf('t3', p.x)), 6, 0.8, 0.6); }
    } else if (waded) { waded = false; if (p.wadeK === 0.74) p.wadeK = 1; }
    // the Gulper's own faint glow and the lake under it
    void A;
  }));
  // the Gulper glows faintly, ghost-pale, when it comes up
  run.extra.push(() => {
    const g = gulper();
    if (!g || g.y > LAKE.top + 80) return null;
    return { x: g.x - g.facing * 100, y: LAKE.top - 16, r: 76, k: 0.56 };
  });
}
