// Short driving cutscene between camp and an expedition site (also used to return).

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import type { Scene } from '../game';
import { game } from '../game';
import { Stage } from '../../world/stage';
import { Custom, Prop } from '../../world/props';
import { addSky, addClouds, addFarImage, addGroundStrip, layerSpan } from '../../world/scenery';
import { local, props, propAnims, chars, A } from '../assets';
import * as L from '../../art/landscape';
import * as F from '../../art/flora';
import { hex } from '../../art/color';
import { PAL } from '../../art/palettes';
import { Rng, rand } from '../../core/math';
import { audio } from '../../core/audio';
import type { SiteId } from '../species';
import type { TimeOfDay } from '../../world/timeofday';
import { SITE_NAMES } from '../story';
import { TIME_LABEL } from '../../world/timeofday';

export function startTrip(site: SiteId, tod: TimeOfDay) {
  game.go(() => new TravelScene(site, tod, false));
}
export function returnToCamp(site: SiteId, tod: TimeOfDay) {
  game.go(() => new TravelScene(site, tod, true));
}

export class TravelScene implements Scene {
  st!: Stage;
  t = 0;
  jx = 200;
  done = false;
  constructor(readonly site: SiteId, readonly tod: TimeOfDay, readonly returning: boolean) {}

  enter() {
    const r = game.r;
    const st = (this.st = new Stage(this.tod, { shade: 0.2, haze: [0.6, 0.78, 0.7], hazeK: 0.25 }));
    st.minX = 0;
    st.maxX = 2600;
    const rng = new Rng(this.site.length * 13 + 5);
    addSky(st, r);
    addClouds(st, r, 0.04, 20, 100, 6, 31);
    addFarImage(st, r, 'mtn', 0.08, 0.5, w => L.paintRidge(w, 130, { seed: 9, base: 128, amp: 70, freq: 0.011, body: hex('#56688a'), lit: hex('#7888aa'), shadow: hex('#425070'), snow: hex('#e6ecf4'), snowLine: 40, fogTo: hex('#94a6c0'), fogStart: 70 }), 70);
    addFarImage(st, r, 'tl1', 0.25, 0.3, w => L.paintTreeline(w, 150, { seed: 3, base: 120, amp: 26, ramp: ['#1c3634', '#244640', '#2e5a4b', '#3c6e56'].map(h => hex(h)), rMin: 8, rMax: 16, fern: 0.7, emergent: 0.4 }), 96);
    addFarImage(st, r, 'tl2', 0.45, 0.16, w => L.paintTreeline(w, 150, { seed: 4, base: 130, amp: 20, ramp: ['#142a26', '#1c3a32', '#264c3e', '#325e48'].map(h => hex(h)), rMin: 10, rMax: 20, fern: 0.9, emergent: 0.5 }), 104);
    const mid = st.addLayer('mid', 0.7, 0.06, 0.5);
    const span = layerSpan(st, 0.7);
    for (let x = span.x0; x < span.x0 + span.w; x += rng.range(30, 70)) {
      const o = rng.chance(0.6) ? F.paintTreeFern(rng.int(1, 999), { height: rng.range(60, 110), silver: rng.chance(0.3) }) : F.paintBush(rng.int(1, 999), 50, 28);
      mid.add(new Prop(local.add('tv' + x, o.buf, o.ax, o.ay), x, 222, rng.next(), { sway: 1 }));
    }
    const main = st.addLayer('main', 1, 0, 1);
    const road = (x: number) => 230 + Math.sin(x * 0.01) * 2 + Math.sin(x * 0.037) * 1;
    addGroundStrip(main, r, 0, 2600, 214, 60, road, { top: PAL.moss, soil: PAL.soil, stones: PAL.stone.slice(2) }, 0, 4);
    // tyre ruts
    main.add(new Custom(0.5, rr => {
      for (let x = rr.visibleX0(10); x < rr.visibleX1(10); x += 2) rr.rect(Math.floor(x / 2) * 2, road(x) + 3, 2, 1, packColor(0.25, 0.17, 0.11, 1));
    }));
    main.add(new Custom(5, (rr, s) => {
      const x = this.jx;
      const y = road(x) + Math.abs(Math.sin(s.time * 11)) * -1.2;
      const tilt = (road(x + 30) - road(x - 30)) / 60;
      rr.beginShadows();
      rr.draw(A.shadow, x, road(x) + 1, 3.4, 1.2, 0, packColor(0, 0, 0, 0.5));
      rr.endShadows();
      const flip = this.returning ? -1 : 1;
      // crew heads in the windows
      const bolt = chars.bolt.idle[0], otis = chars.otis.idle[0];
      rr.drawSub(bolt, 0, 0, bolt.w, 20, x + flip * 18 - (bolt.w / 2), y - 58, 1, 1);
      rr.drawSub(otis, 0, 0, otis.w, 20, x - flip * 6 - (otis.w / 2), y - 56, 1, 1);
      rr.draw(props.jeep, x, y - 5, flip, 1, tilt);
      const wf = propAnims.wheel;
      const fr = wf[Math.floor(s.time * 20) % wf.length];
      rr.draw(fr, x - 56 * flip + 24 * flip - 12 * 0, y - 11 + 0.5, flip, 1);
      rr.draw(fr, x - 56 * flip + 88 * flip, y - 11, flip, 1);
      if (s.tod === 'night' || s.tod === 'dusk') {
        const hx = x + flip * 52;
        rr.lightTex(A.cone, hx, y - 22, flip * 1.4, 0.8, 0, packColor(1, 0.95, 0.8, 1), 1.6);
        rr.fxDraw(A.glow, hx - flip * 4, y - 21, 0.4, 0.4, 0, packColor(1, 0.95, 0.8, 1), 2.5);
      }
    }, (dt, s) => {
      const lp = main.particles;
      const flip = this.returning ? -1 : 1;
      if (rand.chance(dt * 30)) lp.spawn({ frame: A.soft, x: this.jx - flip * 50, y: road(this.jx) - 4, vx: -flip * rand.range(20, 60), vy: rand.range(-18, -4), life: 1.2, size: 0.25, size1: 0.9, color: [0.55, 0.45, 0.35], alpha: 0.5, alpha1: 0, drag: 1.5 });
      void s;
    }));
    const fg = st.addLayer('fg', 1.5, 0, 0.8);
    const fspan = layerSpan(st, 1.5, 200);
    for (let x = fspan.x0; x < fspan.x0 + fspan.w; x += rng.range(40, 110)) {
      const o = rng.chance(0.5) ? F.paintBigLeaf(rng.int(1, 999), rng.range(50, 80)) : F.paintGrassTuft(rng.int(1, 99), 24, PAL.leafDeep, 12);
      fg.add(new Prop(local.add('tf' + x, o.buf, o.ax, o.ay), x, 300, 0, { sway: 2 }));
    }
    if (this.returning) this.jx = 2300;
    st.cam.x = st.cam.tx = this.jx;
    audio.setAmbience('forest', this.tod === 'night');
    audio.setMusic('explore');
    audio.setEngine(1);
    game.ui.letterbox(true);
    const dest = this.returning ? 'Returning to Base Camp' : `${SITE_NAMES[this.site]} — ${TIME_LABEL[this.tod]}`;
    game.ui.showCaption(dest, 3000);
    game.ui.sceneLayer.appendChild(Object.assign(document.createElement('div'), { className: 'skip', innerHTML: '<span class="key">Space</span> skip' }));
  }

  update(dt: number) {
    this.t += dt;
    this.st.update(dt);
    const dir = this.returning ? -1 : 1;
    this.jx += dir * 190 * dt;
    this.st.cam.tx = this.jx + dir * 30;
    this.st.cam.ty = 135;
    this.st.cam.follow = 6;
    audio.update(dt);
    if (!this.done && (this.t > 5.2 || (this.t > 0.6 && (game.input.hitRaw('confirm') || game.input.click(0))))) {
      this.done = true;
      audio.setEngine(0);
      if (this.returning) {
        import('./camp').then(m => {
          const tod = this.tod;
          game.save.campTime = tod === 'dawn' ? 'day' : tod === 'day' ? 'dusk' : tod === 'dusk' ? 'night' : 'dawn';
          if (game.save.campTime === 'dawn') game.save.day++;
          game.save.flags['ate'] = false;
          game.persist();
          game.go(() => new m.CampScene(undefined, 1200));
        });
      } else import('./expedition').then(m => game.go(() => m.createExpedition(this.site, this.tod)));
    }
  }

  render(r: Renderer, dt: number) {
    this.st.updateCamera(dt, r);
    this.st.render(r, dt);
  }

  exit() {
    game.ui.letterbox(false);
    audio.setEngine(0);
    this.st.clear();
  }
}
