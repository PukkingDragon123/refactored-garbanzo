// Breakfast minigame: pour boiling water into an instant noodle cup up to the fill line.
// Hold to pour (the kettle tips further the longer you hold), let go on the line. Chunk watches.

import { openMini, pixelCanvas, Hold, loop, wait, px } from './mini';
import { audio } from '../../core/audio';
import { peopleArt } from '../../world/actor';

export async function runNoodleGame(): Promise<'perfect' | 'over' | 'under'> {
  const m = openMini('noodles', `<h3>Instant Noodles</h3><div class="stage"></div><div class="res"></div><div class="hint">Hold <span class="key">Space</span> or press and hold to pour. Stop on the fill line.</div>`);
  const W = 128, H = 96;
  const { g } = pixelCanvas(m.box.querySelector('.stage') as HTMLElement, W, H, 5);
  const res = m.box.querySelector('.res') as HTMLElement;
  const hold = new Hold(m.box);
  // Chunk's head peeking in from the corner
  let chunkImg: HTMLCanvasElement | null = null;
  const art = peopleArt();
  if (art) {
    const h = art.renderHead('chunk', { expr: 'excited', mouth: 0, blink: false, look: 'up' });
    chunkImg = document.createElement('canvas');
    chunkImg.width = h.buf.w; chunkImg.height = h.buf.h;
    chunkImg.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(h.buf.bytes.buffer, h.buf.bytes.byteOffset, h.buf.bytes.byteLength).slice(), h.buf.w, h.buf.h), 0, 0);
  }
  const CUP = { x0: 46, x1: 82, top: 44, bot: 86 };
  const LINE0 = 0.7, LINE1 = 0.8;
  let level = 0.08, rate = 0, pouring = false, released = -1, tilt = 0, spill = 0, outcome: 'perfect' | 'over' | 'under' | null = null;
  const steam: { x: number; y: number; t: number }[] = [];
  const drops: { x: number; y: number; vy: number }[] = [];
  let pourSfx = 0;
  const finish = (o: 'perfect' | 'over' | 'under') => {
    outcome = o;
    res.textContent = o === 'perfect' ? 'Perfect!' : o === 'over' ? 'Overflow!' : 'A bit low...';
    res.classList.toggle('bad', o !== 'perfect');
    audio.play(o === 'perfect' ? 'star' : 'wrong', { vol: 0.5 });
  };
  const levelY = (k: number) => CUP.bot - k * (CUP.bot - CUP.top);
  const halfW = (y: number) => { const t = (y - CUP.top) / (CUP.bot - CUP.top); return 18 - t * 3; };
  await new Promise<void>(done => {
    loop((dt, t) => {
      if (m.closed) { done(); return false; }
      // input
      if (!outcome) {
        if (hold.down) {
          if (!pouring) { pouring = true; released = -1; }
          rate = Math.min(0.34, rate + dt * 0.28);
          tilt = Math.min(1, tilt + dt * 3);
        } else if (pouring) {
          pouring = false;
          released = t;
        }
        if (!pouring) { rate = Math.max(0, rate - dt * 1.2); tilt = Math.max(0, tilt - dt * 3); }
        level += rate * dt * (pouring ? 1 : 0.25);
        pourSfx -= dt;
        if (pouring && pourSfx <= 0) { pourSfx = 0.16; audio.play('bubble', { vol: 0.25, pitch: 0.7 + level * 0.8 }); }
        if (level >= 1) { spill = 1; finish('over'); }
        else if (released >= 0 && t - released > 0.7 && level > 0.15) finish(level < LINE0 ? 'under' : level > LINE1 ? 'over' : 'perfect');
      } else spill = Math.max(0, spill - dt * 0.5);
      // steam and spill drops
      if (Math.random() < dt * (4 + level * 10)) steam.push({ x: CUP.x0 + 6 + Math.random() * 24, y: levelY(Math.min(level, 1)) - 2, t: 0 });
      for (const s of steam) { s.t += dt; s.y -= dt * 14; s.x += Math.sin(s.t * 4 + s.y) * dt * 6; }
      while (steam.length && steam[0].t > 1.6) steam.shift();
      if (spill > 0 && Math.random() < dt * 20) drops.push({ x: Math.random() < 0.5 ? CUP.x0 - 1 : CUP.x1, y: CUP.top + 1, vy: 10 });
      for (const d of drops) { d.vy += dt * 120; d.y += d.vy * dt; }
      while (drops.length && drops[0].y > H) drops.shift();
      // ---- draw
      // tiled backsplash
      for (let y = 0; y < 70; y++) for (let x = 0; x < W; x++) {
        const tx = x % 12, ty = y % 12;
        px.dot(g, x, y, tx === 0 || ty === 0 ? '#1e2a44' : (tx + ty) % 11 === 0 ? '#3c4e74' : '#2e3c5c');
      }
      // window light patch on the wall
      g.globalAlpha = 0.15; px.rect(g, 90, 6, 30, 26, '#bfe0ff'); g.globalAlpha = 1;
      // counter top
      px.rect(g, 0, 70, W, 26, '#6e4c32');
      px.rect(g, 0, 70, W, 2, '#8a6444');
      for (let x = 0; x < W; x += 16) px.rect(g, x, 72, 1, 24, '#56392a');
      px.rect(g, 0, 86, W, 1, '#4a3222');
      // cup shadow
      g.globalAlpha = 0.35; px.ell(g, 64, 87, 20, 2.5, '#000'); g.globalAlpha = 1;
      // cup (cutaway: translucent paper wall so you can see the water)
      for (let y = CUP.top; y <= CUP.bot; y++) {
        const hw = halfW(y);
        for (let x = Math.round(64 - hw); x <= Math.round(64 + hw); x++) {
          const edge = x <= Math.round(64 - hw) + 1 || x >= Math.round(64 + hw) - 1;
          const band = y > CUP.top + 26 && y < CUP.top + 33;
          let c = edge ? '#d8d0c4' : band ? '#e8b0a8' : '#f4eee4';
          if (!edge && y >= levelY(Math.min(level, 1))) c = y === Math.round(levelY(Math.min(level, 1))) ? '#bfe6ff' : band ? '#b890a8' : '#9ac8e0';
          if (x === Math.round(64 + hw) || x === Math.round(64 - hw)) c = '#3a2614';
          px.dot(g, x, y, c);
        }
      }
      px.rect(g, 64 - 18, CUP.top - 1, 37, 2, '#3a2614');
      px.rect(g, 64 - 16, CUP.bot, 33, 1, '#3a2614');
      // the noodle block, floating up as the water rises
      const nb = Math.min(levelY(Math.min(level, 1)) - 3, CUP.bot - 8);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 22; x++) {
        const wv = Math.sin(x * 1.3 + y * 2.1 + t * (level > 0.3 ? 3 : 0));
        if (wv > -0.2) px.dot(g, 53 + x, Math.round(nb) + y, wv > 0.5 ? '#f4d070' : '#d8a840');
      }
      // veggie flecks
      for (const [x, y, c] of [[58, 2, '#6ac04a'], [66, 4, '#e8603a'], [72, 1, '#6ac04a'], [62, 6, '#f4e0a0']] as [number, number, string][]) px.dot(g, x, Math.round(nb) + y, c);
      // fill line (glows when you're on it)
      const onLine = level >= LINE0 && level <= LINE1;
      const ly0 = Math.round(levelY(LINE1)), ly1 = Math.round(levelY(LINE0));
      for (let x = 49; x <= 79; x += 2) { px.dot(g, x, ly0, onLine ? '#7aff9a' : '#c83a3a'); px.dot(g, x, ly1, onLine ? '#7aff9a' : '#c83a3a'); }
      px.text(g, 'FILL', 86, ly0 - 1, onLine ? '#7aff9a' : '#f4e0c0', 7);
      // label on the cup
      px.text(g, 'CHKN', 55, CUP.top + 26, '#a8302a', 7);
      // kettle, tipping as you hold
      const kx = 30, ky = 18 - tilt * 2;
      g.save();
      g.translate(kx, ky);
      g.rotate(0.15 + tilt * 0.55);
      px.ell(g, 0, 0, 12, 9, (nx, ny) => (nx + ny < -0.6 ? '#c8d4dc' : ny > 0.55 ? '#5a6a74' : '#8a9aa4'));
      px.rect(g, -4, -12, 8, 3, '#2a2630');
      px.rect(g, -14, -4, 3, 8, '#2a2630');
      for (let i = 0; i < 9; i++) px.dot(g, 11 + i, -1 - i * 0.4, '#8a9aa4');
      g.restore();
      // water stream
      if (rate > 0.01) {
        const sx = 44 + tilt * 3, sy = 22 + tilt * 2;
        const ey = levelY(Math.min(level, 1));
        const thick = rate > 0.2 ? 2 : 1;
        for (let y = sy; y < ey; y++) {
          const wob = Math.sin(y * 0.8 + t * 30) * 0.4;
          px.rect(g, sx + (y - sy) * 0.18 + wob, y, thick, 1, (Math.floor(y + t * 40) % 5) ? '#bfe6ff' : '#ffffff');
        }
        // splash
        for (let i = 0; i < 3; i++) px.dot(g, sx + 7 + (Math.random() - 0.5) * 8, ey - Math.random() * 3, '#ffffff');
      }
      // steam
      for (const s of steam) { g.globalAlpha = Math.max(0, 0.55 - s.t * 0.35); px.dot(g, s.x, s.y, '#ffffff'); px.dot(g, s.x + 1, s.y - 1, '#e8f0f8'); }
      g.globalAlpha = 1;
      for (const d of drops) px.dot(g, d.x, d.y, '#9ac8e0');
      // Chunk peeking in (eyes follow the stream)
      if (chunkImg) {
        const bob = Math.sin(t * 5) > 0.7 ? -1 : 0;
        g.save();
        g.translate(W - 4, H - 14 + bob);
        g.scale(-1, 1);
        g.drawImage(chunkImg, 0, 0);
        g.restore();
      }
      return true;
    });
    const chk = () => { if (outcome) setTimeout(done, 900); else if (!m.closed) requestAnimationFrame(chk); };
    chk();
  });
  hold.dispose();
  await wait(100);
  m.close();
  return outcome ?? 'perfect';
}
