// Title screen and the opening voyage cutscene.

import type { Renderer } from '../../gfx/renderer';
import type { Scene } from '../game';
import { game } from '../game';
import { buildSea, SeaStage, SeaMode } from './sea';
import { el } from '../../ui/ui';
import { audio } from '../../core/audio';
import { hasSave, newSave, clearSave } from '../save';
import { newLocalAtlas } from '../assets';
import { CampScene } from './camp';

const CSS = `
.title { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 7vh; pointer-events: none; }
.title .logo { font-family: var(--pix); font-weight: 700; font-size: clamp(34px, 6.4vw, 92px); letter-spacing: 0.04em; color: #fff4dc; text-shadow: 0 4px 0 #6a3a2a, 0 8px 0 rgba(0,0,0,0.35), 0 0 40px rgba(255, 190, 120, 0.45); line-height: 0.95; text-align: center; animation: logoIn 2.2s cubic-bezier(.2,.9,.3,1) both; }
.title .logo small { display: block; font-size: 0.32em; letter-spacing: 0.5em; color: var(--teal2); text-shadow: 0 2px 0 rgba(0,0,0,0.5); margin-bottom: 0.3em; }
.title .tag { font-family: var(--hand); font-size: clamp(16px, 1.8vw, 24px); color: #ffe6c0; text-shadow: 0 2px 3px rgba(0,0,0,0.6); margin-top: 0.6em; animation: logoIn 2.2s 0.4s both; text-align: center; padding: 0 16px; }
@keyframes logoIn { from { opacity: 0; transform: translateY(-16px); letter-spacing: 0.2em; } }
.title .menu { margin-top: auto; margin-bottom: 9vh; display: flex; flex-direction: column; gap: 10px; width: min(300px, 80vw); pointer-events: auto; animation: logoIn 1.6s 1s both; }
.title .menu .btn { font-size: 1.2em; padding: 0.7em 1em; }
.title .foot { position: absolute; bottom: 12px; left: 0; right: 0; text-align: center; font-size: 0.8em; opacity: 0.6; font-family: var(--pix); }
.settings { width: min(460px, 92vw); padding: 1.4em 1.6em; display: flex; flex-direction: column; gap: 1em; }
.settings label { display: grid; grid-template-columns: 8em 1fr 3em; gap: 0.8em; align-items: center; font-family: var(--pix); }
.settings input[type=range] { width: 100%; accent-color: var(--amber); }
.credits { width: min(560px, 92vw); padding: 1.4em 1.6em; line-height: 1.6; }
.confirm { width: min(420px, 92vw); padding: 1.4em 1.6em; display: flex; flex-direction: column; gap: 1em; }
.confirm .row { display: flex; gap: 10px; justify-content: flex-end; }
`;
let styled = false;

export class TitleScene implements Scene {
  sea!: SeaStage;
  t = 0;
  root!: HTMLElement;
  enter() {
    if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
    this.sea = buildSea('title');
    this.sea.st.cam.x = 560;
    this.sea.ship.x = 830;
    this.root = el('div', 'title');
    this.root.innerHTML = `<div class="logo"><small>PROJECT</small>ZEALANDIA</div><div class="tag">A wildlife photography expedition to a continent where serpents rule</div>`;
    const menu = this.root.appendChild(el('div', 'menu'));
    const cont = hasSave();
    if (cont) {
      const c = el('button', 'btn', 'Continue expedition');
      c.onclick = () => { audio.unlock(); audio.play('ui'); game.go(() => new CampScene()); };
      menu.appendChild(c);
    }
    const n = el('button', cont ? 'btn ghost' : 'btn', 'New expedition');
    n.onclick = () => {
      audio.unlock();
      audio.play('ui');
      if (cont) this.confirmNew();
      else this.startNew();
    };
    menu.appendChild(n);
    const s = el('button', 'btn ghost', 'Settings');
    s.onclick = () => { audio.unlock(); audio.play('uiOpen'); openSettings(); };
    menu.appendChild(s);
    const cr = el('button', 'btn ghost', 'Credits');
    cr.onclick = () => { audio.unlock(); audio.play('uiOpen'); openCredits(); };
    menu.appendChild(cr);
    this.root.appendChild(el('div', 'foot', 'Click anywhere for sound · Best with a mouse and keyboard'));
    game.ui.sceneLayer.appendChild(this.root);
    audio.setAmbience('ocean');
    audio.setMusic('title');
  }
  confirmNew() {
    const box = el('div', 'confirm panel', `<h2>Start over?</h2><p>This replaces your current expedition, photos and Field Guide progress.</p>`);
    const row = box.appendChild(el('div', 'row'));
    const no = el('button', 'btn ghost', 'Keep my save');
    const yes = el('button', 'btn', 'Start a new expedition');
    row.append(no, yes);
    const close = game.ui.modal(box);
    no.onclick = () => close();
    yes.onclick = () => { close(); clearSave(); this.startNew(); };
  }
  startNew() {
    game.save = newSave();
    game.go(() => new IntroScene());
  }
  update(dt: number) {
    this.t += dt;
    const st = this.sea.st;
    st.update(dt);
    st.cam.tx = 560 + Math.sin(this.t * 0.05) * 120;
    st.cam.ty = 135;
    st.cam.follow = 0.8;
    if (!this.sea.fin.active && this.t % 22 > 6 && this.t % 22 < 6.1) { this.sea.fin.active = true; this.sea.fin.t = 0; this.sea.fin.x = st.cam.x - 420; }
    if (!this.sea.glider.active && this.t % 15 > 3 && this.t % 15 < 3.1) { this.sea.glider.active = true; this.sea.glider.t = 0; }
    audio.update(dt);
  }
  render(r: Renderer, dt: number) {
    this.sea.st.updateCamera(dt, r);
    this.sea.st.render(r, dt);
  }
  exit() {
    this.root.remove();
    this.sea.st.clear();
  }
}

export function openSettings() {
  const s = game.save.settings;
  const box = el('div', 'settings panel', '<h2>Settings</h2>');
  const row = (label: string, v: number, on: (v: number) => void) => {
    const l = el('label', '', `<span>${label}</span><input type="range" min="0" max="100" value="${Math.round(v * 100)}"><span>${Math.round(v * 100)}</span>`);
    const inp = l.querySelector('input') as HTMLInputElement, out = l.querySelectorAll('span')[1] as HTMLElement;
    inp.id = 'set-' + label.toLowerCase();
    inp.oninput = () => { out.textContent = inp.value; on(+inp.value / 100); };
    box.appendChild(l);
  };
  row('Music', s.music, v => { s.music = v; audio.musicVolume = v; });
  row('Sound', s.sfx, v => { s.sfx = v; audio.sfxVolume = v; audio.play('ui', { vol: 0.6 }); });
  row('Quality', s.quality, v => { s.quality = Math.max(0.35, v); game.r.quality = s.quality; window.dispatchEvent(new Event('resize')); });
  const done = el('button', 'btn', 'Done');
  box.appendChild(done);
  const close = game.ui.modal(box, () => game.persist());
  done.onclick = () => close();
}

function openCredits() {
  const box = el('div', 'credits panel', `<h2>Project Zealandia</h2>
    <p>A pixel-art wildlife photography and ecosystem research game. Every sprite, landscape, creature and sound is generated in code at load time: procedural pixel art, a WebGL2 lighting renderer and synthesized WebAudio.</p>
    <p>Inspired by the cosy exploration of <i>Dave the Diver</i> and the real sunken continent of Zealandia. The animals are fictional: an evolutionary thought experiment in a world where serpents, not birds, became the dominant animals.</p>
    <p style="opacity:0.7;font-size:0.9em">Controls: A/D move, Shift run, S crouch/hide, Space jump, W climb, E interact, right mouse or Q camera, click shoot, wheel zoom, V video, 1-5 and F gadgets, J Field Guide, Esc pause.</p>`);
  const done = el('button', 'btn', 'Close');
  box.appendChild(done);
  const close = game.ui.modal(box);
  done.onclick = () => close();
}

// ------------------------------------------------------------------ opening cutscene

export class IntroScene implements Scene {
  sea!: SeaStage;
  mode: SeaMode = 'antarctic';
  skip = false;
  skipEl!: HTMLElement;
  enter() {
    this.sea = buildSea('antarctic');
    this.sea.ship.x = 700;
    this.skipEl = el('div', 'skip', '<span class="key">Esc</span> skip intro');
    game.ui.sceneLayer.appendChild(this.skipEl);
    game.ui.letterbox(true);
    audio.setAmbience('ocean', true);
    audio.setMusic('night');
    this.run();
  }
  async swap(mode: SeaMode) {
    await game.fadeTo(1, 1.6);
    this.sea.st.clear();
    newLocalAtlas(game.r);
    this.mode = mode;
    this.sea = buildSea(mode);
    await new Promise(r => setTimeout(r, 300));
    await game.fadeTo(0, 1.2);
  }
  wait(ms: number) {
    return new Promise<void>(r => setTimeout(r, this.skip ? 0 : ms));
  }
  async run() {
    const ui = game.ui;
    await this.wait(600);
    if (this.skip) return;
    await ui.showCaption('Ross Sea, Antarctica<br><span style="font-size:0.8em;opacity:0.8">Research vessel <i>Southern Wren</i> — day 41</span>', 3600);
    if (this.skip) return;
    await ui.say([
      { who: 'captain', text: 'Another iceberg, Finch. Another penguin. You’ve photographed eleven thousand penguins.' },
      { who: 'otis', text: 'Eleven thousand and *four*, Captain. Each one a unique individual.', expr: 'happy' },
      { who: 'captain', text: 'Aye. Well, get below. Barometer’s dropping like a stone. Something nasty’s coming out of the north.' },
    ]);
    if (this.skip) return;
    await this.swap('storm');
    audio.setAmbience('storm', true);
    audio.setMusic('tension');
    for (let i = 0; i < 3 && !this.skip; i++) {
      await this.wait(900);
      this.sea.lightning = 1;
      this.sea.st.shake(4, 0.6);
      audio.play('thunder');
    }
    if (this.skip) return;
    await ui.say([
      { who: 'captain', text: 'Hold on to something! She’s taking them over the bow!' },
      { who: 'otis', text: 'Captain, the compass is spinning! Which way is south?!', expr: 'wow' },
      { who: 'captain', text: 'Doesn’t matter, son. We go where the storm puts us.' },
    ]);
    this.sea.lightning = 1;
    audio.play('thunder');
    this.sea.st.shake(6, 1);
    await this.wait(1200);
    if (this.skip) return;
    await game.fadeTo(1, 0.8);
    await ui.showCaption('The next morning...', 2400);
    if (this.skip) return;
    this.sea.st.clear();
    newLocalAtlas(game.r);
    this.sea = buildSea('dawn');
    this.sea.ship.x = 520;
    audio.setAmbience('ocean');
    audio.setMusic('wonder');
    await game.fadeTo(0, 0.5);
    this.sea.st.cam.locked = false;
    this.sea.st.cam.tx = 760;
    this.sea.st.cam.follow = 0.25;
    await this.wait(2500);
    if (this.skip) return;
    await ui.say([
      { who: 'otis', text: 'Captain... that coastline isn’t on any chart.', expr: 'wow' },
      { who: 'captain', text: 'Four hundred kilometres north of where we should be. And it’s *warm*. Look at those trees.' },
    ]);
    this.sea.glider.active = true;
    this.sea.glider.t = 0;
    await this.wait(1800);
    if (this.skip) return;
    await ui.say([{ who: 'otis', text: 'Was that... a snake? Flying?', expr: 'wow' }]);
    this.sea.fin.active = true;
    this.sea.fin.t = 0;
    this.sea.fin.x = this.sea.st.cam.x - 500;
    await this.wait(3500);
    if (this.skip) return;
    await ui.say([
      { who: 'captain', text: 'And *that* was no whale.' },
      { who: 'imogen', text: 'Gentlemen. Get the launches ready. We’re going ashore.', expr: 'happy' },
    ]);
    if (this.skip) return;
    await ui.titleCard('A continent where serpents rule', 'PROJECT ZEALANDIA', 'Three days later — Base Camp', 4200);
    this.finish();
  }
  finish() {
    if (this.done) return;
    this.done = true;
    game.save.chapter = 0;
    game.save.campTime = 'dusk';
    game.persist();
    game.go(() => new CampScene('dusk', 640));
  }
  done = false;
  update(dt: number) {
    const st = this.sea.st;
    st.update(dt);
    if (!st.cam.locked) {
      if (this.mode !== 'dawn' && !st.cam.tx) st.cam.tx = 700;
      st.cam.ty = 135;
    }
    if (game.input.hitRaw('skip') && !this.skip) {
      this.skip = true;
      this.finish();
    }
    audio.update(dt);
  }
  render(r: Renderer, dt: number) {
    this.sea.st.updateCamera(dt, r);
    this.sea.st.render(r, dt);
  }
  exit() {
    game.ui.letterbox(false);
    this.skipEl.remove();
    this.sea.st.clear();
  }
}
