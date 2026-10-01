// V9 island tools: the expedition kit matters on the walk. The headlamp switches itself on in the dark
// (the wreck's lower deck, the sea cave, after sundown) and the wreck is properly dark without it;
// binoculars at two lookouts (the stream mouth scans the beach ahead, the cove spots a red cap far up
// the bush track); the camera's card never fills up for good on the island (Mori deletes the blurry
// ones); every photo leaves flags for photo objectives (v9:shot:<species> and :<behaviour>); and Chunk
// tracks Joshu: he waits and barks toward the next clue, and grumbles if you wander off the wrong way.

import { game } from '../game';
import type { IsleStory } from '../v4/islestory';
import { wait } from '../v4/islestory';
import { audio } from '../../core/audio';
import { el } from '../../ui/ui';
import { SPOT, groundY } from '../../art/island4/layout';
import { rand } from '../../core/math';

const TRAIL: [number, string][] = [[3470, 'trg:tracks'], [4140, 'trg:seal1'], [4450, 'trg:seal2'], [5640, 'v4:shoes'], [5995, 'v9:scrap1'], [6130, 'v9:scrap2'], [SPOT.joshu, 'v4:joshuFound']];

export class IsleTools {
  private idleT = 0;
  private barkT = 8;
  private wrongT = 0;
  private lampWas = false;
  private shotNoteT = 0;

  constructor(readonly st: IsleStory) {}
  get s() { return this.st.s; }
  has(t: string) { return game.save.tools.includes(t); }

  setup() {
    const s = this.s, st = this.st, F = (k: string) => !!game.save.flags[k];
    // a darker wreck (and cave) unless the headlamp is on
    const base = s.st.envHook;
    s.st.envHook = (env, dt) => {
      base?.(env, dt);
      const lamp = s.lampOn ? 1 : 0;
      const dim = Math.max(s.inside * (lamp ? 0.3 : 0.62), s.caveK * (lamp ? 0.12 : 0.3));
      if (dim <= 0) return;
      const k = 1 - dim;
      env.ambientTop = [env.ambientTop[0] * k, env.ambientTop[1] * k, env.ambientTop[2] * (k + dim * 0.08)];
      env.ambientBottom = [env.ambientBottom[0] * k, env.ambientBottom[1] * k, env.ambientBottom[2] * (k + dim * 0.1)];
      env.vignette += dim * 0.3;
    };
    // every shot leaves a flag per species and behaviour (photo objectives read these)
    const prev = s.cam.onShot;
    s.cam.onShot = ph => {
      prev?.(ph);
      for (const x of ph.subjects) {
        if (x.inFrame < 0.3 || x.visible < 0.3) continue;
        game.save.flags['v9:shot:' + x.species] = true;
        if (x.behavior) game.save.flags[`v9:shot:${x.species}:${x.behavior}`] = true;
      }
      game.persist();
    };
    // lookouts
    st.it({ x: 3935, y: groundY(3935), w: 14, label: 'Scan the beach ahead with the binoculars', standX: 3925, quest: () => !F('v9:look1') && F('trg:tracks') && !F('v4:sealDone'),
      enabled: () => F('v4:split') && !F('v4:sealDone') && !F('v9:look1') && this.has('binoculars'), action: () => this.lookAhead() });
    st.it({ x: 5800, y: groundY(5800), w: 14, label: 'Look up the bush track with the binoculars', standX: 5790, quest: () => F('v4:shoes') && !F('v9:sawCap') && !F('v4:joshuFound'),
      enabled: () => F('v4:sealDone') && !F('v4:joshuFound') && !F('v9:sawCap') && this.has('binoculars'), action: () => this.spotCap() });
    // a marker over the next stretch of the trail (the boots, scraps and Joshu have their own)
    s.questPoints.push({ x: () => this.frontier() ?? 0, y: () => groundY(this.frontier() ?? 0) - 26, on: () => { const f = this.frontier(); return f !== null && f < 5000 && F('v4:split') && !F('v4:sealDone') && Math.abs(f - s.player.x) > 60; } });
  }

  /** x of the next clue on Joshu's trail (null once he's found) */
  frontier(): number | null {
    const F = game.save.flags;
    if (!F['v4:split'] || F['v4:joshuFound']) return null;
    for (const [x, f] of TRAIL) if (!F[f]) return x;
    return null;
  }

  // ---------------------------------------------------------------- binoculars
  private async binoculars<T>(fn: () => Promise<T>): Promise<T> {
    const ov = el('div', '', `<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%"><path fill="#040608" fill-rule="evenodd" d="M-300 -300H460V390H-300Z M52 45m-30 0a30 30 0 1 0 60 0a30 30 0 1 0 -60 0Z M108 45m-30 0a30 30 0 1 0 60 0a30 30 0 1 0 -60 0Z"/><circle cx="52" cy="45" r="30" fill="none" stroke="#1a2228" stroke-width="2"/><circle cx="108" cy="45" r="30" fill="none" stroke="#1a2228" stroke-width="2"/></svg>`);
    ov.className = 'binoc';
    ov.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;transition:opacity 0.35s';
    game.ui.sceneLayer.appendChild(ov);
    audio.play('zoom', { vol: 0.5, pitch: 0.8 });
    requestAnimationFrame(() => (ov.style.opacity = '1'));
    try { return await fn(); } finally {
      ov.style.opacity = '0';
      setTimeout(() => ov.remove(), 400);
    }
  }

  private async lookAhead() {
    const st = this.st, s = this.s, p = s.player;
    await st.cut(async () => {
      p.facing = 1;
      st.pose('camera');
      await this.binoculars(async () => {
        await st.pan(SPOT.sealRock - 60, groundY(SPOT.sealRock) - 30, 2.3, 1.6);
        await st.say([
          { who: 'mori', text: 'Boot prints, all the way along the wet sand... left foot dragging...', expr: 'thinking' },
          { who: 'mori', text: '...and they go straight past that big black rock on the beach.', expr: 'thinking' },
          { who: 'mori', text: 'Hang on. Rocks don’t breathe.', expr: 'surprised', emote: 'exclaim' },
        ]);
        await st.pan(5600, groundY(5600) - 60, 1.8, 1.4);
        await st.say([{ who: 'mori', text: 'Past the rocks, the cliffs, a cave... the prints head for the cove. That’s where I’m going.', expr: 'determined' }]);
      });
      st.pose(null);
      st.set('v9:look1');
      await st.pan(null, null);
    });
  }

  private async spotCap() {
    const st = this.st, s = this.s, p = s.player, jo = s.joshu;
    await st.cut(async () => {
      p.facing = 1;
      st.pose('camera');
      await this.binoculars(async () => {
        await st.pan(6100, groundY(6100) - 50, 1.7, 1.2);
        await wait(500);
        await st.pan(jo.x, jo.y - 14, 2.6, 1.8);
        await st.say([
          { who: 'mori', text: 'Ferns... more ferns... a fantail... something RED.', expr: 'thinking' },
          { who: 'mori', text: 'A red cap. A big red cap on a big Joshu. By the creek, right up the track!', expr: 'shocked', style: 'shout', react: 'jump' },
          { who: 'chunk', text: 'BOOF!', expr: 'excited' },
        ]);
      });
      st.pose(null);
      st.set('v9:sawCap');
      await st.pan(null, null);
    });
    s.bark('mori', 'Up the bank, follow the bare footprints. Hang on, Joshu!', { expr: 'determined' });
  }

  // ---------------------------------------------------------------- frame
  update(dt: number) {
    const s = this.s, p = s.player, F = game.save.flags;
    // headlamp: on by itself in the dark (never in the sleeping bag)
    const dark = s.inside > 0.4 || s.caveK > 0.3 || s.clock.night > 0.55;
    s.lampOn = this.has('headlamp') && dark && !this.st.camp.inBag;
    if (s.lampOn !== this.lampWas) {
      this.lampWas = s.lampOn;
      audio.play('lanternOn', { vol: 0.25, pitch: s.lampOn ? 1.4 : 0.9 });
      if (s.lampOn && !F['v9:lampTip']) { F['v9:lampTip'] = true; game.ui.toast('Your <b>headlamp</b> switches on by itself in the dark.', 'TIP', 'teal', 3600); }
    }
    // the card never fills up for good: Mori deletes the blurry ones
    if (s.cam.shots < 3 && !s.cam.active) {
      s.cam.shots = 16;
      if (this.shotNoteT <= 0) { this.shotNoteT = 60; game.ui.toast('Deleted the blurry shots: the memory card has room again.', 'CAMERA', 'teal', 3000); }
      s.hud?.refresh();
    }
    this.shotNoteT -= dt;
    // Chunk the tracker
    const fr = this.frontier();
    const free = !s.cutscene && !game.ui.blocking && s.buddy.mode === 'follow';
    if (fr === null || !free) { this.idleT = 0; return; }
    const far = Math.max(game.save.vars['v9:farX'] ?? 0, p.x);
    game.save.vars['v9:farX'] = far;
    this.idleT = Math.abs(p.vx) < 5 ? this.idleT + dt : 0;
    this.barkT -= dt;
    this.wrongT -= dt;
    const c = s.chunk;
    if (this.idleT > 6 && this.barkT <= 0 && fr > p.x + 80 && !game.ui.bubbles.active && !c.walking) {
      this.barkT = 16;
      c.facing = 1;
      c.play('bark', 'idle').catch(() => {});
      audio.play('callBark', { vol: 0.4, pitch: 0.8 });
      s.bark('chunk', rand.pick(['BOOF! *nose pointing east*', '*sniff sniff* ...BOOF! *tugs east*', 'Hnnf! *sits facing east, very pointedly*']), { expr: 'serious' });
    }
    if (p.x < far - 520 && p.x < fr - 600 && this.wrongT <= 0 && !game.ui.bubbles.active) {
      this.wrongT = 22;
      s.bark('mori', rand.pick(['Chunk keeps whining and looking east. The prints went the other way.', 'Wrong way. Joshu’s trail heads east along the shore.']), { expr: 'thinking' });
      c.play('bark', 'idle').catch(() => {});
    }
  }
}
