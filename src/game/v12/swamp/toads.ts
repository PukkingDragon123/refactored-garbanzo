// V12 Te Repo Raupō, the toads in the scene (their minds and the field guide: ./species.ts; art:
// src/art/v12/swamp/toads.ts):
//
//   the Giant Bellowtoad   sits on its mud island in the dark pool at dusk and at night, lies sunk
//                          beside it by day. It booms only in rain, and only when nothing has moved near
//                          it for a while: get down in the raupō at the pool's edge, crouch or hide, keep
//                          still. Every boom shakes rings across the water. Come at it through the water
//                          and it rears up and growls (the tell), then its tongue lashes out to where you
//                          stood: still there, and you're knocked flat (and maybe drop something). Jump,
//                          back off, or get into cover.
//   the Ember Toads        on the moss hummocks. Pick one up bare-handed and you're poisoned (dizzy, a
//                          burning hunger, knocked on your back); walk into a puffed one and it weeps
//                          toxin on you. With grip gloves on it can be caught (the catch close-up) and
//                          its toxin taken for the lab, then let go.

import type { FieldScene } from '../../scenes/field';
import type { Renderer } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import type { Interactable } from '../../../world/npc';
import type { Animal } from '../../wild/animal';
import { BeastBody, BODY_MAKERS } from '../../wild/bodies';
import { game } from '../../game';
import { A } from '../../assets';
import { audio } from '../../../core/audio';
import { rand } from '../../../core/math';
import { floatText, floatNotice } from '../../../ui/v12/float';
import { add, fits } from '../../inventory';
import { addAilment } from '../../v10/energy';
import { addHunger } from '../hunger';
import { gateOk } from '../gear';
import { hitMori, moriHidden } from '../wilds';
import { SWAMP_CTX, TOAD_ID, EMBER_ID } from './species';
import { POOL, swBase, swDepth, swGround } from './layout';
import { swampRuntime } from './site';

// ---------------------------------------------------------------- the giant toad's body: its tongue
/** the toad's frames, and the tongue drawn out from its mouth to where it strikes (crisp pixels: a
 *  dark underside, a wet pink top with a shine, the sticky bulb at the tip) */
class ToadBody extends BeastBody {
  constructor(readonly a: Animal) { super(TOAD_ID); }
  draw(r: Renderer, a: Animal) {
    super.draw(r, a);
    const ext = a.act === 'lash' ? a.mem.ext ?? 0 : 0;
    if (ext <= 0.02) return;
    const mx = a.x + a.facing * 38, my = a.y - 22;
    const tx = a.mem.tx ?? mx + a.facing * 120, ty = a.mem.ty ?? my;
    let dx = tx - mx, dy = ty - my;
    const L0 = Math.hypot(dx, dy) || 1;
    if (Math.sign(dx) !== a.facing) { dx = a.facing * L0; dy = 0; }
    const L = Math.min(132, L0) * ext;
    const ux = dx / L0, uy = Math.max(-0.45, Math.min(0.45, dy / L0));
    const dark = packColor(0.42, 0.12, 0.14, 1), mid = packColor(0.84, 0.4, 0.44, 1), top = packColor(0.96, 0.66, 0.68, 1);
    for (let s = 0; s < L; s += 1) {
      const x = Math.round(mx + ux * s), y = Math.round(my + uy * s + Math.sin(s * 0.12) * (1 - ext) * 3);
      r.rect(x, y - 1, 1, 1, top);
      r.rect(x, y, 1, 1, mid);
      r.rect(x, y + 1, 1, 1, dark);
      if ((s & 7) === 3) r.rect(x, y - 1, 1, 1, packColor(1, 0.9, 0.9, 1));
    }
    const ex = Math.round(mx + ux * L), ey = Math.round(my + uy * L);
    r.rect(ex - 2, ey - 2, 5, 5, mid);
    r.rect(ex - 1, ey - 3, 3, 1, mid);
    r.rect(ex - 1, ey + 3, 3, 1, dark);
    r.rect(ex + 3, ey - 1, 1, 3, dark);
    r.rect(ex - 1, ey - 2, 2, 1, top);
    r.rect(ex - 1, ey - 1, 1, 1, packColor(1, 1, 1, 1));
  }
}
/** (called by the swamp's build, before its animals are spawned) */
export function installToadBody() { BODY_MAKERS[TOAD_ID] = a => new ToadBody(a); }

// ---------------------------------------------------------------- per scene
export function attachToads(f: FieldScene) {
  const p = f.player;
  const ripples = () => swampRuntime()?.ripples;
  const toad = () => f.animals.find(a => a.species === TOAD_ID && !a.gone && !a.dead) ?? null;
  const gloves = () => gateOk('gloves');
  let seen = false, hinted = false, flashed = false, touchT = 0;

  // ---- what the giant toad hears and feels
  SWAMP_CTX.rain = () => swampRuntime()?.rain.k ?? 0;
  SWAMP_CTX.hidden = () => moriHidden(f);
  SWAMP_CTX.quietT = 0;
  SWAMP_CTX.boom = a => {
    f.sfx('callCroak', a.x, 1, 0.26);
    setTimeout(() => { if (game.scene === f) f.sfx('callGrowl', a.x, 0.5, 0.3); }, 120);
    const wy = swBase(a.x) + 2;
    for (let i = 0; i < 3; i++) setTimeout(() => ripples()?.add(a.x + a.facing * 10, wy + i, 16 + i * 10, 1.4 + i * 0.3, 0.6), i * 180);
    if (Math.abs(p.x - a.x) < 340) f.st.shake(1.2, 0.35);
    void floatText({ text: rand.pick(['BWOOOOMM...', 'BRROOOOOM...', 'HWOOOMMM...']), x: a.x + a.facing * 18, y: a.y - 64, style: 'shout', ms: 1100 });
    a.call('song');
  };
  SWAMP_CTX.growl = a => {
    f.sfx('callGrowl', a.x, 0.8, 0.28);
    void floatText({ text: 'HRRRRMMMM...', x: a.x, y: a.y - 60, style: 'shout', ms: 1000 });
    ripples()?.add(a.x, swBase(a.x) + 2, 12, 0.8, 0.5);
  };
  SWAMP_CTX.thump = a => {
    const d = swDepth(a.x);
    if (d > 1) f.splash(a.x, swBase(a.x), 1.8);
    else { f.sfx('land', a.x, 0.8, 0.5); for (let i = 0; i < 6; i++) f.main.particles.spawn({ frame: A.dot2, x: a.x + rand.range(-20, 20), y: a.y - 1, vx: rand.range(-40, 40), vy: rand.range(-60, -20), ay: 260, life: 0.6, color: [0.2, 0.15, 0.1], alpha: 1, alpha1: 0.4, floorY: a.y + 1 }); }
    ripples()?.add(a.x, swBase(a.x) + 2, 22, 1.2, 0.55);
    if (Math.abs(p.x - a.x) < 300) f.st.shake(2.2, 0.25);
  };
  SWAMP_CTX.lash = a => {
    f.sfx('whoosh', a.x, 0.7, 1.5);
    const dx = p.x - a.x;
    const jumped = p.y < swGround(p.x) - 14;
    if (Math.sign(dx) === a.facing && Math.abs(dx) < 136 && Math.abs(p.y - a.y) < 42 && !jumped && !moriHidden(f)) {
      void floatText({ text: 'THWAP!', x: p.x, y: p.y - 44, style: 'shout', ms: 800 });
      hitMori(f, a.x, { sev: 2, drop: rand.chance(0.35) });
      if (f.guide) setTimeout(() => game.ui.bubbles.bark('aroha', 'When it rears up, MOVE! Back off, or get into the raupō!', { style: 'shout', expr: 'worried' } as never), 900);
    } else void floatText({ text: 'Whoa! MISSED me. Missed me...', style: 'scared', ms: 1600 });
  };
  SWAMP_CTX.flash = a => {
    for (let i = 0; i < 10; i++) f.main.particles.spawn({ frame: A.dot2, x: a.x + rand.range(-3, 3), y: a.y - 4, vx: rand.range(-50, 50), vy: rand.range(-60, -10), ay: 120, life: 0.45, color: i % 2 ? [1, 0.4, 0.1] : [1, 0.15, 0.12], alpha: 1, alpha1: 0, size: 0.6, size1: 0.3 } as never);
    if (!flashed && Math.abs(p.x - a.x) < 80) { flashed = true; void floatText({ text: 'Whoa. Okay. Bright orange means NO. Got it.', style: 'scared', ms: 2200 }); }
  };

  // ---- catching an ember toad: bare hands (poisoned) or gloves (the catch close-up, a toxin sample)
  const nearestEmber = (): Animal | null => {
    let best: Animal | null = null, bd = 22;
    for (const a of f.animals) {
      if (a.species !== EMBER_ID || a.gone || a.dead) continue;
      const d = Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 0.5;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  };
  let busy = false;
  const catchEmber = async () => {
    const a = nearestEmber();
    if (!a || busy) return;
    busy = true;
    try {
      p.facing = a.x >= p.x ? 1 : -1;
      if (!gloves()) {
        // bare-handed: the skin weeps its toxin into his palms
        a.setAct('puff', 2.5);
        await p.doWork('kneel', 0.45, () => {});
        audio.play('hiss', { vol: 0.4, pitch: 1.6 });
        addAilment('dizzy', 28, 0.72, 'ember toad');
        addHunger(0.04, 'poison');
        hitMori(f, a.x, { sev: 1 });
        game.save.flags['sw:stung'] = true;
        game.persist();
        setTimeout(() => void floatText({ text: 'It BURNS... my hands are burning... why is the ground... tilting...', style: 'scared', ms: 3200 }), 600);
        if (f.guide) setTimeout(() => game.ui.bubbles.bark('aroha', 'Bare hands?! Those are POISON, Doc! Gloves, or leave them be!', { style: 'shout', expr: 'angry' } as never), 1800);
        return;
      }
      if (!fits('smp_embertoxin', 1)) { void floatText({ text: 'No room in the pack for a sample. Something has to go.', style: 'think', ms: 2200 }); return; }
      a.setAct('sit', 10);
      const Q = await import('../qte');
      const res = await Q.qte({ kind: 'ring', label: 'CATCH!', difficulty: 0.55, count: 1, closeup: { scene: 'catch', item: 'smp_embertoxin', itemKind: 'animal' }, f, x: a.x, y: a.y - 30, pose: 'kneel' });
      if (!res.ok) { a.setAct('hop', 2); a.mem.away = 1; floatNotice('It got away! Toads: one. Mori: nil.', 2200); return; }
      const got = add('smp_embertoxin', 1);
      if (got > 0) {
        const [cx, cy] = f.css(a.x, a.y - 16);
        f.hud?.flyItem('smp_embertoxin', got, 'Ember toad toxin', cx, cy);
        audio.play('collectPop' as never, { vol: 0.6 });
        floatNotice('Collected: Ember toad toxin', 2600);
        game.save.flags['sw:embercaught'] = true;
        game.persist();
        f.hud?.refresh();
        void floatText({ text: 'A few drops, into the vial... and off you go. Thank you, tiny furious toad.', style: 'happy', ms: 2600 });
      }
      a.setAct('hop', 2); a.mem.away = 1;
    } finally { busy = false; }
  };
  (f.interact as Interactable[]).push({
    get x() { return nearestEmber()?.x ?? -9999; },
    get y() { return nearestEmber()?.y ?? -9999; },
    w: 16, h: 12,
    get label() { return gloves() ? 'Catch the ember toad <span style="opacity:.75">· gloves on</span>' : 'Pick up the ember toad'; },
    enabled: () => !busy && !!nearestEmber() && p.state !== 'climb',
    action: () => { void catchEmber(); },
  } as Interactable);

  // ---- every frame: the quiet the giant toad needs, finding its pool, brushing past ember toads
  f.main.add(new (class { z = 0; draw() {} update(dt: number) {
    if (game.scene !== f || !(dt > 0)) return;
    const t = toad();
    if (t) {
      const dx = Math.abs(p.x - t.x), dy = Math.abs(p.y - t.y);
      const still = Math.abs(p.vx) < 5 && (p.crouch || p.state === 'hide' || f.cam.active || moriHidden(f));
      const quiet = dx > 330 || still || (dy > 50 && Math.abs(p.vx) < 5);
      SWAMP_CTX.quietT = quiet ? SWAMP_CTX.quietT + dt : 0;
      // finding the pool
      const inHollow = p.x > POOL.x0 + 60 && p.x < POOL.x1 - 60 && p.y > swBase(POOL.x0) + 20;
      if (!seen && dx < 260 && (inHollow || p.y < swBase(p.x))) {
        seen = true;
        if (!game.save.flags['sw:pool']) {
          game.save.flags['sw:pool'] = true;
          game.persist();
          audio.play('discover', { vol: 0.35, pitch: 0.7 });
          void floatText({ text: '...that\'s not a rock. That is NOT a rock. That rock has EYES.', style: 'whisper', ms: 3000 });
        }
      }
      if (!hinted && inHollow) {
        hinted = true;
        const right = f.tod === 'dusk' || f.tod === 'night';
        const rain = SWAMP_CTX.rain() > 0.4;
        const text = right && rain ? 'Get down in the raupō. Don\'t move. Don\'t even breathe loud. Let it forget you\'re here.'
          : right ? 'Koro says it only sings when the sky is crying. No rain tonight... come back on a wet one.'
            : 'It\'s lying low in the water. It sings at night, in the rain. Come back then, and come quietly.';
        const g = f.guide?.a;
        setTimeout(() => void floatText(g ? { actor: g, text, style: 'whisper', ms: 3600 } : { text, style: 'think', ms: 3400 }), 1400);
      }
    }
    // brushing past a puffed-up ember toad: it weeps toxin on his ankle
    touchT -= dt;
    if (touchT <= 0 && p.onGround) for (const a of f.animals) {
      if (a.species !== EMBER_ID || a.act !== 'puff' || a.gone) continue;
      if (Math.abs(a.x - p.x) < 6 && Math.abs(a.y - p.y) < 8) {
        touchT = 25;
        addAilment('dizzy', 12, 0.4, 'ember toad');
        hitMori(f, a.x, { sev: 1 });
        setTimeout(() => void floatText({ text: 'Ow! It got me... my ankle\'s gone all tingly. And the trees are swaying. The trees should NOT be swaying.', style: 'scared', ms: 3000 }), 500);
        break;
      }
    }
  } })());
}
