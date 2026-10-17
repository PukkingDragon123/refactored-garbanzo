// V11 Te Pō o Hinerua, the festival night at Te Kāinga. Lantern strings over the marae, torches all
// round, the bonfire, the hāngī lifted for everyone. Koro welcomes the night; the dancers perform the
// serpent dance, a line of them winding back and forth across the marae with red and green flax
// streamers, the ember serpent rising out of the fire over them; Mori can play the festival song
// with the band if he has learned it; and then his partner pulls him onto the marae for the dance
// (the call-and-response dance game: src/ui/v11/dance.ts). The village is very kind about it.
//
// Hook for the relationships module: festivalPartnerChoice() is who dances with Mori (the partner
// he has chosen if they could be here, else Aroha, else Hana), and onFestivalDance(fn) lets it play
// its own moment with that partner right after the dance (fn gets the partner id and the result).

import { game } from '../../game';
import { audio } from '../../../core/audio';
import { rand } from '../../../core/math';
import { Custom, Prop, LightSource, AnimProp } from '../../../world/props';
import { A, propAnims } from '../../assets';
import { sprite } from '../../sites2/common';
import { peopleArt } from '../../../world/actor';
import type { Actor } from '../../../world/actor';
import * as social from '../social';
import { partner, addAffinity, meet } from '../social';
import { addBond } from '../../v10/day';
import { give, count } from '../../inventory';
import { grantBlueprint, BLUEPRINTS } from '../blueprints';
import { completeQuest, questStatus } from '../../quests';
import { cineTo, cineRelease, cineBars } from '../cine';
import { KiriSynth } from '../../../ui/v11/rhythm-audio';
import { SONG_BY_ID, bestStars } from '../../../ui/v11/rhythm-songs';
import type { DanceResult, Dir, Judge } from '../../../ui/v11/dance';
import { showCard } from '../../../ui/v11/pxcard';
import * as P from '../../../art/v11/village/props';
import type { VCtx } from './ctx';
import { say, bark, sleep, actorOf } from './ctx';
import { X } from './layout';
import { vf, setVf, FESTIVAL } from './lore';
import { holdV, VILLAGERS, villagerName } from './people';
import { EmberVision } from './ritual';

// ------------------------------------------------------------------ the romance hook
type DanceHook = (partnerId: string, r: DanceResult) => void | Promise<void>;
const hooks: DanceHook[] = [];
/** the relationships module can play its own moment with the partner right after the festival dance */
export function onFestivalDance(fn: DanceHook): () => void { hooks.push(fn); return () => { const i = hooks.indexOf(fn); if (i >= 0) hooks.splice(i, 1); }; }
const ADULT_VILLAGERS = new Set(VILLAGERS.filter(v => v.adult).map(v => v.id));
/** who dances with Mori at the festival: his chosen partner if they can be here, else Aroha, else Hana */
export function festivalPartnerChoice(): string {
  const known = (id: string) => !!peopleArt()?.CHAR_INFO?.[id];
  const ok = (id: string | null | undefined): id is string => !!id && id !== 'mori' && id !== 'chunk' && (ADULT_VILLAGERS.has(id) || id === 'aroha' || known(id));
  // the relationships module's choice (the partner, else whoever Mori is closest to), when it has one
  const dp = (social as unknown as { dancePartner?: () => string | null }).dancePartner?.();
  const p = partner();
  if (ok(p)) return p;
  if (ok(dp)) return dp;
  return game.save.flags['aroha:met'] || game.save.flags['v4:arohaJoined'] ? 'aroha' : 'hana';
}
const nameOf = (id: string) => (id === 'aroha' ? 'Aroha' : villagerName(id) !== id ? villagerName(id) : peopleArt()?.CHAR_INFO?.[id]?.name ?? id);

// ------------------------------------------------------------------ the band
class Band {
  private synth = new KiriSynth();
  private timer = 0;
  private step = -1;
  private t0 = 0;
  constructor(readonly songId: string, readonly melodyOn = true) {}
  start() {
    const s = SONG_BY_ID[this.songId];
    const now = this.synth.now();
    if (now === null) return;
    this.t0 = now + 0.2;
    this.synth.droneOn(s.root);
    const e8 = 60 / s.bpm / 2, mel = s.bars.join('');
    this.timer = window.setInterval(() => {
      const t = this.synth.now();
      if (t === null) return;
      const upto = Math.floor((t - this.t0 + 0.15) / e8);
      for (let k = this.step + 1; k <= upto; k++) {
        const at = this.t0 + k * e8;
        const g = s.groove[k % 8];
        if (g) this.synth.pahu(at, g === 2 ? 1 : 0.6);
        if (k % 2 === 1) this.synth.tokere(at, 0.07);
        this.synth.shaker(at, k % 2 ? 0.03 : 0.05);
        const ch = mel[k % mel.length];
        if (this.melodyOn && ch >= '1' && ch <= '9') this.synth.pluck(s.root + s.scale[+ch - 1], at, 0.28, 0.7, true);
        this.step = k;
      }
    }, 50);
  }
  stop() { window.clearInterval(this.timer); this.synth.stop(); }
}

// ------------------------------------------------------------------ the decorations
export async function stageFestival(c: VCtx) {
  const f = c.f, g = c.ground;
  // two strings of flax lanterns over the marae, hung from tall poles, each lantern a little light
  const poles = [X.marae[0] - 16, X.fire, X.marae[1] + 16];
  for (const x of poles) {
    const cc = sprite('vil11:fpole', () => { const s = P.torch(); return { ...s, buf: s.buf }; });
    if (cc) f.main.add(new Prop(cc.f, x, g(x) + 2, -4.5, { sy: 1.9 }));
  }
  for (let i = 0; i < 2; i++) {
    const x0 = poles[i], x1 = poles[i + 1], w = Math.round(x1 - x0);
    const cc = sprite(`vil11:lanterns:${i}`, () => P.lanternString(w, 30 + i));
    if (!cc) continue;
    const y0 = g(x0) - 74;
    f.main.add(new Prop(cc.f, x0, y0, 20));
    for (let x = 6; x < w - 4; x += 12) {
      const ly = y0 + 5 + Math.round(Math.sin(x / w * Math.PI) * 10);
      f.main.add(new LightSource(x0 + x, ly, 46, [1, 0.66, 0.3], 0.35, 21, A.glow, 0.12, 0.25, 0.04));
    }
  }
  // the bonfire, bigger tonight, and the streamer poles
  f.main.add(new AnimProp(propAnims.flame, X.fire, g(X.fire) - 4, -0.7, 13, { emissive: 0.6, sx: 1.2, sy: 1.5 }));
  f.lights.push({ x: X.fire, y: g(X.fire) - 20, r: 220, k: 0.9 });
  // the partner arrives for the night if they are not one of the village (the crew come up the river)
  const pid = festivalPartnerChoice();
  if (!actorOf(c, pid) && pid !== 'mori') {
    const a = f.addActor(pid, X.marae[1] + 40, g(X.marae[1] + 40), -1);
    a.z = 44;
    a.idleAnim = 'cheer';
    a.setAnim('cheer');
  }
}

// ------------------------------------------------------------------ the night
export async function runFestival(c: VCtx) {
  const f = c.f, g = c.ground;
  c.hold = true;
  f.cutscene = true;
  const prevGuide = f.guide;
  f.guide = null;
  const band = new Band('po');
  const vis = new EmberVision(X.fire, g(X.fire));
  vis.mount(c);
  let dancing = false;
  try {
    audio.setMusic('none');
    for (const v of VILLAGERS) holdV(c, v.id, true);
    const p = f.player;
    p.x = X.marae[1] + 30; p.y = g(p.x); p.facing = -1;
    f.snapCamera();
    const aroha = actorOf(c, 'aroha');
    if (aroha) { aroha.x = X.marae[1] + 52; aroha.y = g(aroha.x); aroha.facing = -1; aroha.setAnim('cheer'); }
    cineBars(true);
    await cineTo(f.st, { x: X.fire, y: g(X.fire) - 50, zoom: 1.25, secs: 0.1 });
    await showCard({ title: FESTIVAL.toUpperCase(), sub: 'Hinerua’s night', lines: [{ text: 'Te Kāinga · the moulting moon', col: '#d8c49a' }], ms: 3000, at: 'top' });
    band.start();
    // Koro welcomes the night
    const koro = actorOf(c, 'koro');
    koro?.setAnim('bless');
    await say(f, [
      { who: 'koro', text: 'Tonight the serpents leave their old skins behind, and so does Hinerua. We sing for her so she sleeps well, and we eat so we sleep well.', expr: 'happy', close: false },
      { who: 'koro', text: 'Our visitors are welcome at this fire. Eat first. Then dance. Then eat again.', expr: 'teasing', close: false },
    ], true);
    koro?.setAnim('sit');
    // the hāngī comes up
    const huia = actorOf(c, 'huia');
    huia?.setAnim('kneelWork');
    bark('huia', 'KAI’S UP! Plates out!', { expr: 'happy' });
    audio.play('rustle', { vol: 0.5 });
    await sleep(1600);
    huia?.setAnim('stir');
    give('vil_hangi', 1);
    p.poseOverride = 'eatStand';
    await say(f, [
      { who: 'mori', text: 'Mmf. This is... this has been in the ground all day? It falls apart. It tastes like smoke and gardens.', expr: 'happy' },
      { who: 'huia', text: 'There is a second parcel in your bag. Don’t argue with me.', expr: 'teasing' },
    ]);
    p.poseOverride = null;
    // the serpent dance: a line of dancers winding across the marae with streamers
    const dancers = ['hana', 'mere', 'manu', 'ani', 'pipi'].map(id => actorOf(c, id)).filter((a): a is Actor => !!a);
    const hist: number[] = [];
    let lead = 0, dir = 1;
    dancing = true;
    vis.show = 'dance';
    const tick = new Custom(0, () => {}, dt => {
      if (!dancing || !dancers.length) return;
      const L = dancers[0];
      lead += dt;
      if (!L.walking) { dir = -dir; void L.walkTo(dir > 0 ? X.marae[1] - 10 : X.marae[0] + 10, 22, 'snakeDance'); }
      hist.push(L.x);
      if (hist.length > 400) hist.shift();
      dancers.slice(1).forEach((a, i) => {
        const k = hist.length - 1 - Math.round((i + 1) * 22);
        if (k < 0) return;
        const tx = hist[k];
        if (Math.abs(tx - a.x) > 2) void a.walkTo(tx, 26, 'snakeDance'); else a.setAnim('snakeDance');
      });
    });
    f.main.add(tick);
    for (const a of dancers) a.setAnim('snakeDance');
    await cineTo(f.st, { x: X.fire, y: g(X.fire) - 46, zoom: 1.55, secs: 2.4 });
    await sleep(2200);
    await say(f, [{ who: 'aroha', text: 'Watch Aunty Hana. She’s Hinerua’s head. Everyone else is the body. The body follows the head, all the way across the land.', expr: 'happy', close: false }]);
    await sleep(5000);
    bark('ani', 'Look! Over the fire! It’s her!', { expr: 'excited' });
    await sleep(3200);
    // Mori with the band, if he can play the festival song
    if (count('vil_huekiri') > 0 && SONG_BY_ID.po.unlocked()) {
      const k = await say(f, [
        { who: 'hana', text: 'Mori! You’ve got your hue kiri. Play Te Pō with us!', expr: 'excited' },
        { who: 'mori', text: '(Play the festival song with the band?)', style: 'think', choices: ['Play with the band', 'Just watch'] },
      ]);
      if (k === 0) {
        band.stop();
        dancing = false;
        const { runHueKiri } = await import('../../../ui/v11/rhythm');
        const r = await runHueKiri({ song: 'po', diff: bestStars('po', 'normal') >= 1 ? 'normal' : 'easy', once: true });
        if (r) { addAffinity('hana', 4 + r.stars * 3, 'played at the festival'); for (const v of VILLAGERS) addAffinity(v.id, r.stars, 'festival song'); }
        bark('koro', r && r.stars >= 2 ? 'Ka pai! Hinerua will sleep for a hundred years after that.' : 'Ha! She is awake now, for sure.', { expr: 'laugh' });
        band.start();
        dancing = true;
      }
    }
    // the dance with the partner
    dancing = false;
    vis.show = 'none';
    const pid = festivalPartnerChoice();
    const pa = actorOf(c, pid) ?? (pid === 'mori' ? null : f.actors.get(pid) ?? null);
    for (const a of dancers) { a.stopWalk(); a.setAnim('cheer'); }
    for (const v of VILLAGERS) { const a = actorOf(c, v.id); if (a && !dancers.includes(a)) a.setAnim('cheer'); }
    const spotM = X.fire + 30, spotP = X.fire + 64;
    if (pa) {
      holdV(c, pid, true);
      void pa.walkTo(spotP, 50);
    }
    await p.walkTo(spotM, 50);
    p.facing = 1;
    if (pa) { while (pa.walking) await sleep(80); pa.facing = -1; }
    await cineTo(f.st, { x: (spotM + spotP) / 2, y: g(spotM) - 40, zoom: 1.9, secs: 1.4 });
    meet(pid);
    await say(f, [
      { who: pid, text: pid === 'aroha' ? 'Come on, scientist. You can’t watch the whole night through a lens.' : pid === 'hana' ? 'Up! Nobody sits out the serpent dance. I’ll call, you answer.' : 'Dance with me? Everyone’s watching anyway.', expr: 'happy' },
      { who: 'mori', text: 'I... don’t really dance. My feet are mostly for walking. And falling.', expr: 'worried' },
      { who: pid, text: 'Watch my steps, then do the same. Four of mine, four of yours. Like the river and the bank.', expr: 'teasing' },
    ]);
    band.stop();
    p.poseOverride = 'snakeDance';
    pa?.setAnim('snakeDance');
    const poseFor = (a: Actor | null, d: Dir, isPlayer: boolean) => {
      const anim = d === 1 ? 'crouch' : d === 2 ? 'cheer' : 'snakeDance';
      if (isPlayer) { if (d === 0) p.facing = -1; if (d === 3) p.facing = 1; p.poseOverride = anim; setTimeout(() => { if (p.poseOverride === anim) { p.poseOverride = 'snakeDance'; p.facing = 1; } }, 380); }
      else if (a) { if (d === 0) a.facing = -1; if (d === 3) a.facing = 1; a.setAnim(anim); setTimeout(() => { a.setAnim('snakeDance'); a.facing = -1; }, 380); }
    };
    const crowd = () => VILLAGERS.map(v => actorOf(c, v.id)).filter((a): a is Actor => !!a && a !== pa);
    const { runDance } = await import('../../../ui/v11/dance');
    const res = await runDance({
      mode: 'festival', partner: pid, partnerName: nameOf(pid),
      hooks: {
        call: d => poseFor(pa, d, false),
        step: (d: Dir, j: Judge, combo: number) => {
          if (j === 'perfect' || j === 'good') { poseFor(null, d, true); if (combo > 0 && combo % 8 === 0) { const a = rand.pick(crowd()); if (a) { a.play('celebrate', 'cheer').catch(() => {}); bark(a.id, rand.pick(['Ka pai, Mori!', 'Look at him go!', 'Hinerua, look!', 'Chee-hoo!']), { expr: 'excited' }); } } return; }
          // a stumble: the wrong way, a trip, his partner's toes
          p.poseOverride = rand.next() < 0.5 ? 'slip' : 'fallBack';
          f.player.body.setExpr('surprised', 0.8);
          setTimeout(() => { if (p.poseOverride === 'slip' || p.poseOverride === 'fallBack') p.poseOverride = 'snakeDance'; }, 520);
          if (j === 'stray') {
            pa?.setExpr('surprised', 0.8);
            if (rand.next() < 0.5) bark(pid, rand.pick(['Ow! My toes!', 'Other left!', 'That was MY foot, Mori!', 'Ha! Again!']), { expr: 'laugh' });
            for (const a of crowd()) if (rand.next() < 0.35) a.play('laugh', 'cheer').catch(() => {});
          }
        },
        beat: n => { if (n % 2 === 0) for (const a of crowd()) if (rand.next() < 0.15) a.react('bounce'); },
        phrase: (i, combo) => (i === 0 ? 'Watch my feet...' : i === 3 ? (combo > 4 ? 'Yes! You’ve got it!' : 'Breathe! Follow me!') : i === 6 ? 'Faster now!' : null),
      },
    });
    p.poseOverride = null;
    pa?.setAnim('cheer');
    // the result: kindness either way
    const best = res.rating === 'graceful', mid = res.rating === 'spirited';
    for (const a of crowd()) a.play(best ? 'celebrate' : 'laugh', 'cheer').catch(() => {});
    await say(f, [
      { who: pid, text: best ? 'Mori! Where did that come from? You danced like the river!' : mid ? 'Not bad! You only trod on me a little.' : 'You were terrible. Wonderful, and terrible. Everyone will talk about it for years.', expr: best ? 'excited' : 'laugh' },
      { who: 'koro', text: best ? 'Ka pai! Hinerua is smiling in her sleep.' : mid ? 'Ka pai! She is laughing in her sleep.' : 'Ha! Even the taniwha is laughing. That is a good night.', expr: 'laugh' },
    ]);
    for (const fn of hooks.slice()) { try { await fn(pid, res); } catch (e) { console.error(e); } }
    // what the night gives
    game.save.vars['v11v:festivalPartner'] = 0;
    game.save.flags['v11v:festivalPartner:' + pid] = true;
    game.save.vars['v11v:festivalScore'] = res.score;
    setVf('festival');
    for (const v of VILLAGERS) addAffinity(v.id, best ? 8 : mid ? 6 : 5, 'festival');
    addAffinity(pid, best ? 14 : mid ? 10 : 8, 'danced at the festival');
    addBond('aroha', 6);
    const gotBp = BLUEPRINTS.hangi_oven ? grantBlueprint('hangi_oven', 'quest:huia') : false;
    give('vil_hangi', 1);
    if (questStatus('v11_festival') === 'active') completeQuest('v11_festival');
    await showCard({
      title: 'TE PŌ O HINERUA', sub: best ? 'You danced like the river' : mid ? 'You danced with spirit' : 'You danced. Bravely.', wait: true,
      lines: [
        { text: `Tino pai ${res.perfect} · Pai ${res.good} · Auē ${res.miss}`, col: '#f0e2c0', gap: 2 },
        { text: `Toes trodden on: ${res.stumbles}`, col: '#d8c49a' },
        { text: `Everyone at Te Kāinga thinks a little more of you.`, col: '#7ad870', gap: 4 },
        ...(gotBp ? [{ text: 'Blueprint: Hāngī pit (from Nanny Huia)', col: '#f8d060' }] : []),
        { text: 'Hāngī parcels for the road', col: '#f8d060' },
        { text: 'Enter', col: '#b49c70', gap: 6 },
      ],
    });
    await say(f, [{ who: 'hemi', text: 'Come and see me tomorrow, boy. I have something for you.', expr: 'neutral' }]);
  } finally {
    dancing = false;
    vis.show = 'none';
    band.stop();
    f.player.poseOverride = null;
    await cineRelease(f.st, 1);
    cineBars(false);
    f.guide = prevGuide;
    c.hold = false;
    c.festival = false;
    for (const v of VILLAGERS) holdV(c, v.id, false);
    f.cutscene = false;
    audio.setMusic('aroha');
  }
}
void Custom;
