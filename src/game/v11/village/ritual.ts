// V11 Te Kāinga rituals and the turning of the day:
//   storyByFire   after dark the village sits round the fire and Koro tells Hinerua's story; as he
//                 talks the embers rise and draw what he tells (a waka, the serpent, the river she
//                 carved, her sleep in Te Korokoro, the skin she sheds), in pixel sparks over the fire
//   offering      when the sun is low: at her pou by the landing, Koro kneels and gives the first of
//                 the kai and a corner of her gift back to the river; the water answers
//   blessing      at the waharoa Koro sprinkles water from a gourd over Mori and Aroha and gives his
//                 blessing for the old track to the pā (v10:koroBlessing), and into Hinerua's house
//   restUntil     sit by the fire until evening or dark (time passes, the scene comes back lit for it)

import { game } from '../../game';
import { audio } from '../../../core/audio';
import { rand } from '../../../core/math';
import { Custom } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { A } from '../../assets';
import { cineTo, cineRelease, cineBars, cineShake } from '../cine';
import { addAffinity } from '../social';
import { addBond } from '../../v10/day';
import { rumour, addNote, discover } from '../../v10/regions';
import { restore } from '../../v10/energy';
import { completeQuest, questStatus } from '../../quests';
import type { VCtx } from './ctx';
import { say, sleep, actorOf, line } from './ctx';
import { X } from './layout';
import { STORY, setVf, vf, startVillageQuest } from './lore';
import { holdV, stationsFor, VILLAGERS } from './people';

// ------------------------------------------------------------------ the embers draw the story
type Show = (typeof STORY)[number]['show'] | 'none' | 'dance';
export class EmberVision {
  show: Show = 'none';
  k = 0;
  t = 0;
  constructor(readonly x: number, readonly y: number) {}
  /** points of the current picture at time t (world), and how bright */
  points(t: number): [number, number, number][] {
    const out: [number, number, number][] = [];
    const cx = this.x, cy = this.y - 52;
    const serpent = (n: number, len: number, amp: number, freq: number, yo: number, sp: number) => {
      for (let i = 0; i < n; i++) { const u = i / (n - 1); out.push([cx - len / 2 + u * len, cy + yo + Math.sin(u * freq + t * sp) * amp * (0.4 + u * 0.6), 1 - u * 0.5]); }
      out.push([cx + len / 2 + 3, cy + yo + Math.sin(freq + t * sp) * amp - 2, 1.4]);
    };
    switch (this.show) {
      case 'waka': {
        for (let i = 0; i < 22; i++) { const u = i / 21; out.push([cx - 26 + u * 52, cy + 10 + Math.sin(u * Math.PI) * 6 + Math.sin(t * 2) * 1.5, 0.9]); }
        for (let i = 0; i < 8; i++) out.push([cx - 4 + Math.sin(t * 1.4) * 1, cy - 10 + i * 2.4, 0.6]);
        for (let i = 0; i < 6; i++) out.push([cx - 4 + i * 2.6, cy - 8 + i * 2.2, 0.5]);
        for (let i = 0; i < 18; i++) out.push([cx - 40 + ((i * 9 + t * 10) % 80), cy + 22 + Math.sin(i + t * 3) * 1.4, 0.35]);
        break;
      }
      case 'coil': serpent(34, 80, 9, 9, 0, 2.2); break;
      case 'river': {
        serpent(40, 96, 12, 6, 6, 0.8);
        for (let i = 0; i < 26; i++) { const u = (i / 26 + t * 0.12) % 1; out.push([cx - 48 + u * 96, cy + 18 + Math.sin(u * 6) * 12, 0.3]); }
        break;
      }
      case 'sleep': {
        for (let i = 0; i < 40; i++) { const u = i / 39, a = u * Math.PI * 4.4, r = 4 + u * 20; out.push([cx + Math.cos(a) * r, cy + 4 + Math.sin(a) * r * 0.55, 0.45 + 0.35 * Math.sin(t * 1.2)]); }
        // her breath: slow sparks rising
        for (let i = 0; i < 6; i++) { const ph = (t * 0.4 + i / 6) % 1; out.push([cx + Math.sin(i * 2 + t) * 6, cy - ph * 30, 1 - ph]); }
        break;
      }
      case 'skin': {
        serpent(30, 70, 7, 8, -4, 1.4);
        for (let i = 0; i < 24; i++) { const u = i / 23; out.push([cx - 30 + u * 64 + Math.sin(t + u * 4) * 2, cy + 14 + Math.sin(u * 7 + t * 0.6) * 5 + ((t * 6 + i) % 10), 0.25]); }
        break;
      }
      case 'dance': {
        // Hinerua rising out of the fire, swaying with the dancers
        for (let i = 0; i < 46; i++) { const u = i / 45; out.push([cx + Math.sin(u * 7 + t * 2.4) * (6 + u * 14), cy + 34 - u * 70, 1.2 - u * 0.6]); }
        out.push([cx + Math.sin(7 + t * 2.4) * 20 + 3, cy - 38, 1.6]);
        break;
      }
      case 'ask': {
        // a closed coil and, before it, two small figures
        for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; out.push([cx + 18 + Math.cos(a) * 12, cy + 4 + Math.sin(a) * 7, 0.5]); }
        for (const fx of [-22, -14]) for (let i = 0; i < 6; i++) out.push([cx + fx, cy + 14 - i * 2.4, 0.8]);
        break;
      }
      default: break;
    }
    return out;
  }
  mount(c: VCtx) {
    c.f.main.add(new Custom(56, rr => {
      if (this.k <= 0.01) return;
      const pts = this.points(this.t);
      for (const [x, y, b] of pts) {
        const fl = 0.75 + 0.25 * Math.sin(this.t * 9 + x * 0.7);
        rr.fxDraw(A.dot2, Math.round(x), Math.round(y), 1, 1, 0, packColor(1, 0.62 + b * 0.2, 0.3, 1), this.k * b * fl * 2.2);
      }
      rr.light(this.x, this.y - 50, 70, 1, 0.6, 0.3, this.k * 0.35, 0.1);
    }, dt => {
      this.t += dt;
      const want = this.show === 'none' ? 0 : 1;
      this.k += (want - this.k) * Math.min(1, dt * 1.8);
    }));
  }
}

// ------------------------------------------------------------------ gather everyone at the fire
function gatherAtFire(c: VCtx) {
  for (const v of VILLAGERS) {
    const rt = c.vill[v.id];
    if (!rt) continue;
    const st = v.night[0];
    holdV(c, v.id, true);
    const a = rt.a;
    void a.walkTo(st.x, 46).then(() => { if (st.face) a.facing = st.face; a.idleAnim = st.anim; a.setAnim(st.anim); });
  }
}
function release(c: VCtx) {
  for (const v of VILLAGERS) { const rt = c.vill[v.id]; if (!rt) continue; rt.stations = stationsFor(v, c); holdV(c, v.id, false); }
}

/** Koro tells the story of Hinerua by the fire */
export async function storyByFire(c: VCtx) {
  const f = c.f;
  c.hold = true;
  f.cutscene = true;
  const prevGuide = f.guide;
  try {
    gatherAtFire(c);
    const koro = actorOf(c, 'koro');
    const p = f.player;
    await p.walkTo(X.fire - 18, 60);
    p.facing = 1;
    p.poseOverride = 'sitGround';
    const aroha = actorOf(c, 'aroha');
    if (aroha) { f.guide = null; void aroha.walkTo(X.fire - 6, 60).then(() => { aroha.facing = 1; aroha.setAnim('sitGround'); }); }
    cineBars(true);
    await cineTo(f.st, { x: X.fire, y: c.ground(X.fire) - 40, zoom: 1.7, secs: 1.8 });
    await sleep(700);
    koro?.setAnim('storyTell');
    const vis = new EmberVision(X.fire, c.ground(X.fire));
    vis.mount(c);
    audio.play('fireLight', { vol: 0.4 });
    for (const [i, b] of STORY.entries()) {
      vis.show = b.show;
      if (b.show === 'coil' && i === 1) { audio.play('callHiss', { vol: 0.25, pitch: 0.4 }); for (const id of ['pipi', 'ani', 'mikaere']) actorOf(c, id)?.setExpr('surprised', 2.4); }
      if (b.show === 'sleep') audio.play('gust', { vol: 0.25 });
      await say(f, [{ who: 'koro', text: b.text, expr: i >= STORY.length - 1 ? 'serious' : i % 3 === 2 ? 'happy' : 'neutral', close: false }], true);
    }
    vis.show = 'none';
    await sleep(500);
    await say(f, [
      { who: 'pipi', text: 'Koro, is she awake now?', expr: 'worried' },
      { who: 'koro', text: 'Not while we sing to her, mokopuna. That is what the festival is for.', expr: 'happy' },
      { who: 'mori', text: '...Thank you, Koro. For telling it to me.', expr: 'neutral' },
      { who: 'aroha', text: 'Now you know why we ask before we go anywhere near the Throat.', expr: 'serious' },
    ], true);
    setVf('story');
    addAffinity('koro', 6, 'listened to the story');
    addBond('aroha', 4);
    startVillageQuest('v11_festival', false);
    game.ui.toast('Learned the story of <b>Hinerua</b>, the guardian of the river.', 'LORE', 'teal', 4200);
  } finally {
    f.player.poseOverride = null;
    await cineRelease(f.st, 1);
    cineBars(false);
    f.guide = prevGuide;
    c.hold = false;
    release(c);
  }
}

// ------------------------------------------------------------------ the offering at her pou
export async function offering(c: VCtx) {
  const f = c.f;
  c.hold = true;
  f.cutscene = true;
  const prevGuide = f.guide;
  try {
    const koro = actorOf(c, 'koro');
    holdV(c, 'koro', true);
    await say(f, [{ who: 'koro', text: 'Come. Bring her gift.', expr: 'neutral' }], true);
    const kx = X.pou + 22;
    if (koro) void koro.walkTo(kx, 44);
    await f.player.walkTo(kx + 18, 60);
    const aroha = actorOf(c, 'aroha');
    if (aroha) { f.guide = null; void aroha.walkTo(kx + 34, 60).then(() => { aroha.facing = -1; aroha.setAnim('idle'); }); }
    while (koro?.walking) await sleep(100);
    if (koro) { koro.facing = -1; koro.setAnim('offer'); }
    f.player.facing = -1;
    f.player.poseOverride = 'kneel';
    cineBars(true);
    await cineTo(f.st, { x: X.pou + 8, y: c.ground(X.pou) - 44, zoom: 1.8, secs: 1.6 });
    await say(f, [
      { who: 'koro', text: 'Hinerua. Here is the first of the kai from the gardens, and a little of your gift back to you.', expr: 'serious', close: false },
      { who: 'koro', text: 'Thank you for the river. Thank you for the fish. Sleep well.', expr: 'serious', close: false },
    ], true);
    // the little flax float goes out on the current, and the water answers
    const y0 = c.ground(X.pou) + 8;
    let fx = X.pou - 20, alive = true, ripple = 0;
    f.main.add(new Custom(-1, rr => {
      if (!alive) return;
      rr.rect(Math.round(fx) - 3, y0 - 1, 7, 2, packColor(0.55, 0.62, 0.3, 1));
      rr.rect(Math.round(fx) - 1, y0 - 3, 2, 2, packColor(0.75, 0.4, 0.5, 1));
      rr.rect(Math.round(fx) + 1, y0 - 2, 1, 1, packColor(0.9, 0.86, 0.72, 1));
      if (ripple > 0) for (let i = 0; i < 28; i++) {
        const u = i / 27, x = 30 + u * 180 - (1 - ripple) * 40, y = y0 + 4 + Math.sin(u * 9 + ripple * 6) * 3;
        rr.fxDraw(A.dot2, Math.round(x), Math.round(y), 1, 1, 0, packColor(0.7, 1, 0.9, 1), Math.sin(ripple * Math.PI) * 1.6 * (0.5 + 0.5 * Math.sin(u * 14)));
      }
    }, dt => { fx -= dt * 9; if (ripple > 0) ripple = Math.max(0, ripple - dt * 0.25); }));
    audio.play('splash', { vol: 0.25, pitch: 1.3 });
    await sleep(2400);
    ripple = 1;
    audio.play('callHiss', { vol: 0.18, pitch: 0.3 });
    f.st.wind = 1.4;
    await sleep(2200);
    await say(f, [
      { who: 'mori', text: 'Did... did the river just move against the current?', expr: 'surprised' },
      { who: 'aroha', text: 'She heard.', expr: 'happy' },
      { who: 'koro', text: 'Or it was an eel. Both can be true, e tama.', expr: 'teasing' },
    ], true);
    f.st.wind = 0.6;
    alive = false;
    setVf('offering');
    addAffinity('koro', 6, 'the offering');
    addBond('aroha', 3);
  } finally {
    f.player.poseOverride = null;
    await cineRelease(f.st, 1);
    cineBars(false);
    f.guide = prevGuide;
    c.hold = false;
    holdV(c, 'koro', false);
  }
  if (!game.save.flags['v10:koroBlessing']) {
    await sleep(400);
    await say(f, [{ who: 'koro', text: 'Now you have met her, I think. Talk to me again when you want to go up the old track. I will walk you to the gate.', expr: 'neutral' }], true);
  }
}

// ------------------------------------------------------------------ the blessing at the waharoa
export async function blessing(c: VCtx) {
  const f = c.f;
  c.hold = true;
  f.cutscene = true;
  const prevGuide = f.guide;
  try {
    const koro = actorOf(c, 'koro');
    holdV(c, 'koro', true);
    await say(f, [{ who: 'koro', text: 'So. You want to go up to the pā, and maybe further. Walk with me.', expr: 'serious' }], true);
    const gx = X.gate;
    if (koro) void koro.walkTo(gx - 4, 40);
    const aroha = actorOf(c, 'aroha');
    if (aroha) { f.guide = null; void aroha.walkTo(gx - 40, 50); }
    await f.player.walkTo(gx - 26, 50);
    while (koro?.walking || aroha?.walking) await sleep(100);
    if (koro) { koro.facing = -1; koro.setAnim('bless'); }
    f.player.facing = 1;
    if (aroha) { aroha.facing = 1; aroha.setAnim('idle'); }
    cineBars(true);
    await cineTo(f.st, { x: gx - 18, y: c.ground(gx) - 50, zoom: 1.75, secs: 2 });
    // water from the gourd, flicked over the two of them
    const lp = f.main.particles;
    const flick = () => { for (let i = 0; i < 12; i++) lp.spawn({ frame: A.dot2, x: gx - 8, y: c.ground(gx) - 46, vx: rand.range(-90, -30), vy: rand.range(-60, -10), ay: 220, life: 0.9, color: [0.75, 0.9, 1], alpha: 0.9, alpha1: 0.1, floorY: c.ground(gx - 30) }); audio.play('splash', { vol: 0.12, pitch: 1.8 }); };
    await say(f, [line({ who: 'koro', text: 'Hinerua, kaitiaki. These two go up the old track to the pā of our tūpuna, and maybe further, into your house.', expr: 'serious', close: false, onShow: flick }, true)], true);
    await say(f, [line({ who: 'koro', text: 'They go with my blessing. They will look, and take nothing, and come home.', expr: 'serious', close: false, onShow: flick }, true)], true);
    await sleep(500);
    cineShake(1.2, 0.4);
    audio.play('gust', { vol: 0.3 });
    await say(f, [
      { who: 'koro', text: 'Go carefully. What you carry out of there, you bring back here. Haere rā.', expr: 'neutral' },
      { who: 'aroha', text: 'Ngā mihi, Koro.', expr: 'happy' },
    ], true);
    game.save.flags['v10:koroBlessing'] = true;
    game.save.flags['v10:koroTalked'] = true;
    game.persist();
    rumour('ruins');
    rumour('unknown');
    addNote({ id: 'note:koro', loc: 'village', x: gx, text: 'Koro’s blessing: the old track from the gateway climbs to the old pā.' });
    discover({ id: 'vil:blessing', kind: 'village', name: 'Koro’s blessing', loc: 'village', x: gx, note: 'Blessed at the waharoa for the old track, and for Hinerua’s house.' }, true);
    addAffinity('koro', 10, 'the blessing');
    addBond('aroha', 5);
    if (questStatus('v11_hinerua') === 'active' && vf('story') && vf('offering') && vf('skinFound') && vf('askPou')) completeQuest('v11_hinerua');
    game.ui.toast('Koro’s blessing: the <b>old track to the pā</b> is open.', 'VILLAGE', 'teal', 4200);
  } finally {
    await cineRelease(f.st, 1);
    cineBars(false);
    f.guide = prevGuide;
    c.hold = false;
    holdV(c, 'koro', false);
  }
}

// ------------------------------------------------------------------ let the day go by
/** sit by the fire until evening (dusk) or dark (night): time passes, the village comes back lit for it */
export async function restUntil(c: VCtx, when: 'dusk' | 'night') {
  const f = c.f;
  const ex = await import('../../v10/expedition');
  const h = ((ex.expeditionHour() % 24) + 24) % 24;
  const target = when === 'dusk' ? 17.75 : 20.25;
  if (ex.currentExpedition() && h < target) ex.passTime(target - h);
  restore(14);
  f.player.poseOverride = 'sitGround';
  await sleep(300);
  const { FieldScene } = await import('../../scenes/field');
  const { VILLAGE } = await import('../../sites10/village');
  const site = { ...VILLAGE, spawnX: X.fire - 30 };
  await game.go(() => { const s = new FieldScene(site as never, when); ex.tagScene(s, 'village'); return s; }, [0.02, 0.02, 0.03], 1.4);
}
