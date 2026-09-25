// The expedition camera: viewfinder, zoom, autofocus + depth of field, photo grading, video, traps.

import { game } from './game';
import type { Creature } from './wildlife/creature';
import type { Stage } from '../world/stage';
import type { Player } from '../world/player';
import { SPECIES_BY_ID, SiteId } from './species';
import type { TimeOfDay } from '../world/timeofday';
import { audio } from '../core/audio';
import { clamp, damp } from '../core/math';
import { el } from '../ui/ui';
import { PixelBuffer } from '../art/pixel';
import { speciesSprite } from '../ui/icons';

export interface Shot {
  species: string | null;
  behavior: string | null;
  others: string[];
  score: number;
  stars: number;
  notes: string[];
  thumb: string;
  video: boolean;
  frames?: string[];
  videoBehaviors?: string[];
  trap?: boolean;
}

const FRAME = { x0: 0.06, y0: 0.07, x1: 0.94, y1: 0.93 };

export function starsFor(score: number) {
  return score >= 82 ? 5 : score >= 62 ? 4 : score >= 42 ? 3 : score >= 22 ? 2 : 1;
}

export class CameraSystem {
  active = false;
  toggled = false;
  mode: 'photo' | 'video' = 'photo';
  zoom = 1.6;
  aimX = 0;
  aimY = 0;
  focus = 0.5;
  focusTarget: Creature | null = null;
  focusState: 'none' | 'hunting' | 'locked' = 'none';
  huntT = 0;
  film = 16;
  recording = false;
  recT = 0;
  recFrames: string[] = [];
  recSample = 0;
  recStats = new Map<Creature, { t: number; beh: Map<string, number> }>();
  shots: Shot[] = [];
  sway = 0;
  private vf: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  cooldown = 0;
  mx = 0.5;
  my = 0.5;

  constructor(readonly site: SiteId, readonly tod: TimeOfDay) {
    const s = game.save;
    this.film = 16 + (s.upgrades.film - 1) * 8 + (s.flags['meal:stew'] ? 4 : 0);
    this.vf = game.ui.vf;
    this.vf.innerHTML = `<div class="frame"><div class="grid"></div><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div></div>
      <div class="focus"></div><div class="subject"></div>
      <div class="top"><span class="mode">PHOTO</span><span><span class="rec">● REC <span class="rt">0.0</span>s</span></span><span class="shots"></span></div>
      <div class="info"><span class="zoom"></span><span class="af">AF</span><span class="hint2"><span class="key">V</span> mode &nbsp;<span class="key">RMB</span> lower</span></div>`;
    for (const k of ['focus', 'subject', 'mode', 'shots', 'zoom', 'af', 'rt']) this.els[k] = this.vf.querySelector('.' + k) as HTMLElement;
  }

  get zoomMax() {
    return [2.2, 3.2, 4.4][game.save.upgrades.lens - 1] ?? 2.2;
  }
  get afTime() {
    return [0.55, 0.32, 0.16][game.save.upgrades.af - 1] ?? 0.55;
  }

  update(dt: number, st: Stage, player: Player, creatures: Creature[]) {
    const inp = game.input;
    this.cooldown -= dt;
    const want = !game.ui.blocking && player.state !== 'climb' && (inp.held(2) || this.toggled);
    if (inp.hit('camera') && !game.ui.blocking) this.toggled = !this.toggled;
    if (!game.ui.blocking && inp.mousePressed[2]) this.toggled = false;
    if (want !== this.active) {
      this.active = want;
      audio.play(want ? 'zoom' : 'uiBack', { vol: 0.5 });
      if (want) { this.aimX = player.x; this.aimY = player.eyeY; }
      else if (this.recording) this.stopRecording(st, creatures);
    }
    player.camera = this.active;
    this.vf.classList.toggle('on', this.active);
    game.ui.hud.classList.toggle('hidden', this.active);
    const r = game.r;
    if (!this.active) {
      r.post.dof = false;
      r.post.ca = 0;
      st.cam.tzoom = 1;
      st.cam.zoomLerp = 4;
      st.cam.follow = 4;
      return;
    }
    if (inp.hit('mode') && game.save.upgrades.video) {
      if (this.recording) this.stopRecording(st, creatures);
      this.mode = this.mode === 'photo' ? 'video' : 'photo';
      audio.play('ui');
    } else if (inp.hit('mode')) game.ui.toast('Video needs the <b>Video module</b> from Pip.', 'CAMERA', 'coral');
    // zoom
    if (inp.wheel) { this.zoom = clamp(this.zoom - inp.wheel * 0.18, 1.1, this.zoomMax); audio.play('zoom', { vol: 0.3, pitch: 1 + this.zoom * 0.1 }); }
    if (inp.down('zoomIn')) this.zoom = clamp(this.zoom + dt * 1.2, 1.1, this.zoomMax);
    if (inp.down('zoomOut')) this.zoom = clamp(this.zoom - dt * 1.2, 1.1, this.zoomMax);
    // aim: the mouse position steers the view around the player like a joystick
    this.mx = damp(this.mx, clamp(inp.mx / r.VW), 10, dt);
    this.my = damp(this.my, clamp(inp.my / r.VH), 10, dt);
    const reachX = 230, reachY = 120;
    const steady = (game.save.flags['meal:tea'] ? 0.4 : 1) * (player.crouch || player.state === 'hide' ? 0.5 : 1);
    this.sway += dt;
    const swx = (Math.sin(this.sway * 1.3) + Math.sin(this.sway * 2.9) * 0.5) * 1.6 * steady * this.zoom * 0.4;
    const swy = (Math.cos(this.sway * 1.1) + Math.sin(this.sway * 3.7) * 0.4) * 1.1 * steady * this.zoom * 0.4;
    this.aimX = player.x + (this.mx - 0.5) * 2 * reachX + swx;
    this.aimY = player.eyeY + (this.my - 0.5) * 2 * reachY + swy;
    st.cam.tx = this.aimX;
    st.cam.ty = this.aimY;
    st.cam.tzoom = this.zoom;
    st.cam.follow = 7;
    st.cam.zoomLerp = 6;

    // autofocus on the creature nearest the frame centre
    const cx = st.cam.x, cy = st.cam.y;
    const boxW = 60 / st.cam.zoom, boxH = 45 / st.cam.zoom;
    let best: Creature | null = null, bd = Infinity;
    for (const c of creatures) {
      if (c.dead || c.hiddenFromCamera) continue;
      const b = c.bounds();
      if (b.x1 < cx - boxW || b.x0 > cx + boxW || b.y1 < cy - boxH || b.y0 > cy + boxH) continue;
      const d = Math.hypot((b.x0 + b.x1) / 2 - cx, (b.y0 + b.y1) / 2 - cy);
      if (d < bd) { bd = d; best = c; }
    }
    if (best !== this.focusTarget) {
      this.focusTarget = best;
      this.focusState = best ? 'hunting' : 'none';
      this.huntT = 0;
    }
    if (this.focusState === 'hunting') {
      this.huntT += dt;
      if (this.huntT >= this.afTime) { this.focusState = 'locked'; audio.play('focus', { vol: 0.5 }); }
    }
    const targetDepth = best ? best.depth : 0.5;
    this.focus = damp(this.focus, this.focusState === 'hunting' ? targetDepth + Math.sin(this.huntT * 30) * 0.05 : targetDepth, 10, dt);
    r.post.dof = true;
    r.post.focus = this.focus;
    r.post.dofStrength = 2.2 + this.zoom * 1.4;
    r.post.ca = 0.0025;

    // shutter / record
    if (inp.click(0) && this.cooldown <= 0) {
      if (this.mode === 'photo') this.shoot(st, creatures, player);
      else if (this.recording) this.stopRecording(st, creatures);
      else this.startRecording();
    }
    if (this.recording) this.updateRecording(dt, st, creatures);
    this.updateUI(st);
  }

  private updateUI(st: Stage) {
    const f = this.els.focus;
    f.className = 'focus ' + (this.focusState === 'locked' ? 'locked' : this.focusState === 'hunting' ? 'hunting' : '');
    f.style.left = '50%';
    f.style.top = '50%';
    this.els.mode.textContent = this.mode === 'photo' ? 'PHOTO' : 'VIDEO';
    this.els.shots.textContent = `▣ ${this.film}`;
    const steps = Math.round(((this.zoom - 1.1) / (this.zoomMax - 1.1)) * 8);
    this.els.zoom.innerHTML = `${this.zoom.toFixed(1)}x ` + Array.from({ length: 8 }, (_, i) => `<b class="${i < steps ? 'on' : ''}"></b>`).join('');
    this.els.af.textContent = this.focusState === 'locked' ? 'AF ● LOCK' : this.focusState === 'hunting' ? 'AF ○ ...' : 'AF';
    const subj = this.els.subject;
    const t = this.focusTarget;
    if (t) {
      const known = game.save.seen[t.id];
      const beh = t.behavior ? SPECIES_BY_ID[t.id].behaviors[t.behavior] : null;
      subj.innerHTML = `${known ? SPECIES_BY_ID[t.id].name : 'Unknown species'}${beh ? ` — <em>${beh}</em>` : ''}${t.aware > 0.6 ? ' <span style="color:#ff8a6a">(wary)</span>' : ''}`;
      subj.classList.add('on');
    } else subj.classList.remove('on');
    this.vf.classList.toggle('recording', this.recording);
    if (this.recording) this.els.rt.textContent = this.recT.toFixed(1);
    void st;
  }

  /** Frame rectangle in world coords of the p=1 plane. */
  frameWorld(st: Stage) {
    const r = game.r, c = st.cam;
    const x0 = (FRAME.x0 * r.VW - r.VW / 2) / c.zoom + c.x, x1 = (FRAME.x1 * r.VW - r.VW / 2) / c.zoom + c.x;
    const y0 = (FRAME.y0 * r.VH - r.VH / 2) / c.zoom + c.y, y1 = (FRAME.y1 * r.VH - r.VH / 2) / c.zoom + c.y;
    return { x0, y0, x1, y1 };
  }

  analyze(st: Stage, creatures: Creature[]) {
    const F = this.frameWorld(st);
    const fw = F.x1 - F.x0, fh = F.y1 - F.y0;
    const cands: { c: Creature; score: number; notes: string[]; vis: number }[] = [];
    for (const c of creatures) {
      if (c.dead || c.hiddenFromCamera) continue;
      const b = c.bounds();
      const ix0 = Math.max(b.x0, F.x0), iy0 = Math.max(b.y0, F.y0), ix1 = Math.min(b.x1, F.x1), iy1 = Math.min(b.y1, F.y1);
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      const area = (b.x1 - b.x0) * (b.y1 - b.y0);
      const inter = (ix1 - ix0) * (iy1 - iy0);
      const vis = inter / Math.max(1, area);
      if (vis < 0.2) continue;
      const notes: string[] = [];
      let score = 0;
      const sizeR = inter / (fw * fh);
      const sizeScore = sizeR < 0.012 ? 2 : sizeR < 0.04 ? 10 : sizeR < 0.09 ? 20 : sizeR < 0.45 ? 28 : 18;
      score += sizeScore;
      notes.push(sizeScore >= 28 ? 'Great subject size +28' : sizeScore >= 18 ? `Good size +${sizeScore}` : `Subject is small +${sizeScore}`);
      // composition: closeness to centre or a rule-of-thirds point
      const scx = ((ix0 + ix1) / 2 - F.x0) / fw, scy = ((iy0 + iy1) / 2 - F.y0) / fh;
      const pts = [[0.5, 0.5], [1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]];
      const dmin = Math.min(...pts.map(([px, py]) => Math.hypot(scx - px, scy - py)));
      const comp = Math.round(clamp(1 - dmin / 0.3) * 14);
      score += comp;
      if (comp > 9) notes.push(`Strong composition +${comp}`);
      else if (comp > 0) notes.push(`Composition +${comp}`);
      if (vis < 0.7) { score -= 8; notes.push('Partly out of frame -8'); }
      const [hx, hy] = c.head();
      if (hx < F.x0 || hx > F.x1 || hy < F.y0 || hy > F.y1) { score -= 8; notes.push('Head cut off -8'); }
      if (c === this.focusTarget && this.focusState === 'locked') { score += 18; notes.push('Sharp focus +18'); }
      else if (c === this.focusTarget) { score += 6; notes.push('Focus still hunting +6'); }
      else notes.push('Out of focus +0');
      if (c.behavior) {
        const beh = SPECIES_BY_ID[c.id].behaviors[c.behavior];
        const fresh = !game.save.evPhoto[`${c.id}:${c.behavior}`];
        const bs = fresh ? 26 : 16;
        score += bs;
        notes.push(`Behaviour: ${beh} +${bs}`);
      }
      if (c.aware < 0.3) { score += 8; notes.push('Natural, unaware +8'); }
      const rar = SPECIES_BY_ID[c.id].rarity * 3;
      score += rar;
      notes.push(`Rarity +${rar}`);
      if (c.inLight) { score += 5; notes.push('Beautiful light +5'); }
      cands.push({ c, score, notes, vis });
    }
    cands.sort((a, b) => b.score - a.score);
    const main = cands[0];
    if (!main) return { species: null, behavior: null, others: [] as string[], score: 5, notes: ['No animal in frame'] };
    const others = cands.slice(1).map(x => x.c.id).filter(id => id !== main.c.id);
    let score = main.score;
    if (others.length) {
      const interact = cands.slice(1).some(x => x.c.behavior && main.c.behavior);
      const b = interact ? 14 : 6;
      score += b;
      main.notes.push(interact ? `Two species interacting +${b}` : `Bonus species in frame +${b}`);
    }
    return { species: main.c.id, behavior: main.c.behavior, others, score: clamp(Math.round(score), 1, 100), notes: main.notes };
  }

  capture(w = 320, h = 180, q = 0.82): string {
    const cv = game.r.canvas;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    const sx = cv.width * FRAME.x0, sy = cv.height * FRAME.y0, sw = cv.width * (FRAME.x1 - FRAME.x0), sh = cv.height * (FRAME.y1 - FRAME.y0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cv, sx, sy, sw, sh, 0, 0, w, h);
    return c.toDataURL('image/jpeg', q);
  }

  shoot(st: Stage, creatures: Creature[], player: Player) {
    if (this.film <= 0) { audio.play('wrong'); game.ui.toast('Out of film! Head back to the jeep.', 'CAMERA', 'coral'); this.cooldown = 0.5; return; }
    this.film--;
    this.cooldown = 0.35;
    const a = this.analyze(st, creatures);
    audio.play('shutter');
    // capture right after this frame renders (before the flash is applied)
    game.afterRender = () => {
      const thumb = this.capture();
      const shot: Shot = { ...a, stars: starsFor(a.score), thumb, video: false };
      this.shots.push(shot);
      game.r.post.flash = 0.55;
      this.flashCard(shot);
    };
    // startle skittish animals nearby a little
    for (const c of creatures) if (Math.abs(c.x - player.x) < 90) c.aware = Math.min(1, c.aware + 0.25);
  }

  private flashCard(s: Shot) {
    const d = el('div', 'panel', `<img src="${s.thumb}" style="width:100%;display:block" alt=""><div style="display:flex;justify-content:space-between;padding:4px 2px 0;font-family:var(--pix);font-size:0.85em"><span>${s.species ? (game.save.seen[s.species] ? SPECIES_BY_ID[s.species].name : 'Unknown!') : 'Scenery'}</span><span style="color:var(--amber2)">${'★'.repeat(s.stars)}</span></div>`);
    d.style.cssText = 'position:absolute;left:18px;bottom:90px;width:190px;padding:6px;transform:rotate(-3deg);animation:toastIn 0.3s ease-out;pointer-events:none';
    game.ui.sceneLayer.appendChild(d);
    setTimeout(() => { d.style.transition = 'opacity 0.5s, transform 0.5s'; d.style.opacity = '0'; d.style.transform = 'rotate(-3deg) translateY(20px)'; }, 1600);
    setTimeout(() => d.remove(), 2200);
    if (s.stars >= 4) audio.play('star', { pitch: 1 + s.stars * 0.1 });
  }

  startRecording() {
    if (this.film < 2) { audio.play('wrong'); game.ui.toast('Not enough film for a video clip (needs 2).', 'CAMERA', 'coral'); return; }
    this.recording = true;
    this.recT = 0;
    this.recFrames = [];
    this.recSample = 0;
    this.recStats.clear();
    audio.play('recStart');
  }

  updateRecording(dt: number, st: Stage, creatures: Creature[]) {
    this.recT += dt;
    this.recSample -= dt;
    const F = this.frameWorld(st);
    for (const c of creatures) {
      if (c.dead || c.hiddenFromCamera) continue;
      const b = c.bounds();
      const inFrame = b.x1 > F.x0 && b.x0 < F.x1 && b.y1 > F.y0 && b.y0 < F.y1;
      if (!inFrame) continue;
      let s = this.recStats.get(c);
      if (!s) { s = { t: 0, beh: new Map() }; this.recStats.set(c, s); }
      s.t += dt;
      if (c.behavior) s.beh.set(c.behavior, (s.beh.get(c.behavior) ?? 0) + dt);
    }
    if (this.recSample <= 0 && this.recFrames.length < 32) {
      this.recSample = 0.25;
      game.afterRender = () => this.recFrames.push(this.capture(192, 108, 0.7));
    }
    if (this.recT >= 8) this.stopRecording(st, creatures);
  }

  stopRecording(_st: Stage, _creatures: Creature[]) {
    if (!this.recording) return;
    this.recording = false;
    audio.play('recStop');
    this.film -= 2;
    let best: [Creature, { t: number; beh: Map<string, number> }] | null = null;
    for (const e of this.recStats) if (!best || e[1].t > best[1].t) best = e;
    const frames = this.recFrames.slice();
    const thumb = frames[Math.floor(frames.length / 2)] ?? this.capture();
    if (!best || best[1].t < 0.8) {
      this.shots.push({ species: null, behavior: null, others: [], score: 5, stars: 1, notes: ['No animal recorded long enough'], thumb, video: true, frames });
      return;
    }
    const [c, s] = best;
    const behs = [...s.beh.entries()].filter(([, t]) => t >= 1).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const notes = [`Recorded for ${s.t.toFixed(1)}s +${Math.round(Math.min(30, s.t * 5))}`];
    let score = Math.min(30, s.t * 5) + SPECIES_BY_ID[c.id].rarity * 3 + 15;
    for (const b of behs) { score += 18; notes.push(`Behaviour on film: ${SPECIES_BY_ID[c.id].behaviors[b]} +18`); }
    notes.push(`Rarity +${SPECIES_BY_ID[c.id].rarity * 3}`);
    this.shots.push({ species: c.id, behavior: behs[0] ?? null, others: [], score: clamp(Math.round(score), 1, 100), stars: starsFor(score), notes, thumb, video: true, frames, videoBehaviors: behs });
  }

  /** Stylised infrared camera-trap still. */
  trapShot(c: Creature): Shot {
    const w = 160, h = 90;
    const b = new PixelBuffer(w, h);
    const cv = b.toCanvas(2);
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#10261c';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const img = new Image();
    img.src = speciesSprite(c.id);
    const shot: Shot = { species: c.id, behavior: c.behavior, others: [], score: 34, stars: 2, notes: ['Camera trap photo', c.behavior ? `Behaviour: ${SPECIES_BY_ID[c.id].behaviors[c.behavior]}` : 'Passing by'], thumb: cv.toDataURL('image/jpeg', 0.8), video: false, trap: true };
    img.onload = () => {
      const k = Math.min((cv.width * 0.7) / img.width, (cv.height * 0.7) / img.height);
      ctx.imageSmoothingEnabled = false;
      ctx.filter = 'grayscale(1) sepia(1) hue-rotate(60deg) saturate(2) brightness(1.1)';
      ctx.drawImage(img, (cv.width - img.width * k) / 2, (cv.height - img.height * k) / 2 + 10, img.width * k, img.height * k);
      ctx.filter = 'none';
      for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(160,255,190,${Math.random() * 0.15})`; ctx.fillRect(Math.random() * cv.width, Math.random() * cv.height, 2, 2); }
      ctx.fillStyle = '#b8ffcf';
      ctx.font = '14px monospace';
      ctx.fillText('TRAP-01  ' + new Date().toISOString().slice(11, 19), 8, cv.height - 8);
      shot.thumb = cv.toDataURL('image/jpeg', 0.8);
    };
    return shot;
  }

  destroy() {
    game.r.post.dof = false;
    game.r.post.ca = 0;
    this.vf.classList.remove('on');
  }
}
