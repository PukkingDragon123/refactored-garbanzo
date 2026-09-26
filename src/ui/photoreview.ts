// Photo review: go through the raw camera roll, tag every animal you can find in each shot (they
// can be tiny, half hidden or blurred), then file or delete it. Identified animals give sightings,
// behaviour evidence and RP; the verdict explains why a shot failed (leaf in the way, motion blur...).
// Used inside the laptop's Photos app and standalone on the camera (the prologue tutorial).

import { game } from '../game/game';
import { rawPhotos, reviewPhoto, RawPhoto, ReviewResult, deleteRawPhoto } from '../game/photos';
import { SPECIES_BY_ID } from '../game/species';
import { el } from './ui';
import { sfx, css, esc, starsHTML, rpIcon, pushKeys, AppCtx } from './laptop-kit';

css('photo-roll', `
.phr { position: absolute; inset: 0; display: flex; flex-direction: column; color: var(--paper); font-size: 0.95em; }
.phr-strip { flex: none; display: flex; gap: 0.3em; padding: 0.35em; overflow-x: auto; background: rgba(0,0,0,0.35); }
.phr-strip button { flex: none; width: 5.2em; height: 3.2em; padding: 0; border: 0; background: #000; cursor: pointer; position: relative; box-shadow: 0 0 0 0.12em #0b0f12; }
.phr-strip button img { width: 100%; height: 100%; object-fit: cover; opacity: 0.7; }
.phr-strip button.on { box-shadow: 0 0 0 0.18em #f4b43c; }
.phr-strip button.on img, .phr-strip button:hover img { opacity: 1; }
.phr-strip button i { position: absolute; left: 0.2em; bottom: 0.1em; font-family: var(--pix); font-style: normal; font-size: 0.65em; color: #fff; text-shadow: 0 0.1em 0 #000; }
.phr-body { flex: 1; min-height: 0; display: flex; gap: 0.7em; padding: 0.6em; }
.phr-view { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; position: relative; }
.phr-photo { position: relative; max-width: 100%; max-height: 100%; aspect-ratio: 16 / 9; width: 100%; cursor: crosshair; background: #000; box-shadow: 0 0 0 0.2em #0b0f12, 0 0 0 0.35em #3a4a46; overflow: hidden; }
.phr-photo img { width: 100%; height: 100%; display: block; object-fit: cover; user-select: none; -webkit-user-drag: none; }
.phr-tag { position: absolute; width: 1.8em; height: 1.8em; transform: translate(-50%, -50%); border: 0.2em solid #f4b43c; border-radius: 50%; box-shadow: 0 0 0 0.12em #000, inset 0 0 0 0.12em #000; pointer-events: none; animation: prTag 0.3s cubic-bezier(.2,1.8,.4,1); }
.phr-tag::after { content: ''; position: absolute; left: 50%; top: 50%; width: 0.3em; height: 0.3em; transform: translate(-50%, -50%); background: #f4b43c; }
@keyframes prTag { from { transform: translate(-50%, -50%) scale(2); opacity: 0; } }
.phr-box { position: absolute; border: 0.15em dashed; pointer-events: none; animation: prBox 0.4s ease-out; }
.phr-box.ok { border-color: #7dffb0; }
.phr-box.bad { border-color: #ff8a70; }
.phr-box.miss { border-color: #f4b43c; border-style: dotted; }
.phr-box span { position: absolute; left: -0.15em; top: -1.5em; white-space: nowrap; font-family: var(--pix); font-size: 0.75em; padding: 0.1em 0.4em; background: rgba(0,0,0,0.75); }
@keyframes prBox { from { transform: scale(1.3); opacity: 0; } }
.phr-loupe { position: absolute; width: 9em; height: 9em; border-radius: 50%; pointer-events: none; box-shadow: 0 0 0 0.25em #0b0f12, 0 0 0 0.45em #c8c0a8, 0 0.5em 1em rgba(0,0,0,0.6); background-repeat: no-repeat; display: none; z-index: 5; image-rendering: pixelated; }
.phr-side { width: 15em; flex: none; display: flex; flex-direction: column; gap: 0.5em; overflow-y: auto; }
.phr-side .phr-hint { font-size: 0.85em; opacity: 0.8; line-height: 1.3; }
.phr-side .meta { font-family: var(--pix); font-size: 0.75em; opacity: 0.7; }
.phr-side .note { font-size: 0.8em; padding: 0.3em 0.5em; background: rgba(232,97,74,0.18); }
.phr-btns { display: flex; flex-direction: column; gap: 0.35em; margin-top: auto; }
.phr-btns button { font-family: var(--pix); font-size: 0.95em; padding: 0.5em 0.8em; border: 0; cursor: pointer; box-shadow: inset 0 -0.2em 0 rgba(0,0,0,0.25); }
.phr-btns .keep { background: #3fbca6; color: #06241e; }
.phr-btns .del { background: #3a2a2a; color: #ffc2b4; }
.phr-btns .next { background: #f4b43c; color: #2a1a06; }
.phr-btns button:hover { filter: brightness(1.1); }
.phr-res { font-size: 0.85em; animation: prIn 0.35s cubic-bezier(.2,1.3,.4,1); }
@keyframes prIn { from { transform: translateY(0.6em); opacity: 0; } }
.phr-hit { padding: 0.4em 0.5em; margin-bottom: 0.35em; background: rgba(255,255,255,0.06); border-left: 0.25em solid #7dffb0; }
.phr-hit.bad { border-color: #ff8a70; }
.phr-hit b { font-family: var(--pix); font-weight: 500; }
.phr-hit .why { opacity: 0.8; font-style: italic; }
.phr-hit .ev { color: var(--teal2); font-size: 0.9em; }
.phr-rp { font-family: var(--pix); font-size: 1.5em; color: var(--amber2); display: flex; align-items: center; gap: 0.3em; }
.phr-empty { flex: 1; display: grid; place-items: center; text-align: center; opacity: 0.7; padding: 2em; font-style: italic; }
.phr-cam { width: min(72em, 94vw); height: min(40em, 86vh); position: relative; background: linear-gradient(180deg, #2a2d30, #1a1c1e); box-shadow: 0 0 0 0.3em #0b0c0d, inset 0 0.2em 0 rgba(255,255,255,0.12), 0 1em 3em rgba(0,0,0,0.7); padding: 2.2em 1.2em 1em; border-radius: 1.2em; }
.phr-cam::before { content: 'ZX-7 · PLAYBACK'; position: absolute; left: 1.4em; top: 0.6em; font-family: var(--pix); font-size: 0.85em; letter-spacing: 0.2em; color: #c8c0a8; opacity: 0.8; }
.phr-cam .x { position: absolute; right: 1em; top: 0.5em; font-family: var(--pix); border: 0; background: #e8614a; color: #fff; padding: 0.2em 0.7em; cursor: pointer; }
.phr-cam .inner { position: relative; width: 100%; height: 100%; background: #0f1714; box-shadow: inset 0 0 0 0.25em #050606; }
`);

/** Mount the reviewer in a container. onDone fires after every reviewed photo (for badges). */
export function mountPhotoRoll(container: HTMLElement, onDone?: () => void, ctx?: AppCtx): () => void {
  const root = el('div', 'phr');
  container.appendChild(root);
  let cur: RawPhoto | null = null;
  let tags: [number, number][] = [];
  let result: ReviewResult | null = null;
  const strip = root.appendChild(el('div', 'phr-strip'));
  const body = root.appendChild(el('div', 'phr-body'));

  const drawStrip = () => {
    strip.innerHTML = '';
    const ls = rawPhotos();
    strip.style.display = ls.length ? '' : 'none';
    ls.forEach((p, i) => {
      const b = strip.appendChild(el('button', p === cur ? 'on' : '', `<img src="${p.img}" alt=""><i>${p.video ? '▶ ' : ''}${i + 1}</i>`));
      b.onclick = () => { if (result) return; pick(p); };
    });
  };

  const pick = (p: RawPhoto | null) => {
    cur = p;
    tags = [];
    result = null;
    drawStrip();
    draw();
  };

  const draw = () => {
    body.innerHTML = '';
    if (!cur) {
      body.appendChild(el('div', 'phr-empty', 'No photos waiting for review.<br>Head out with the camera (Q) and shoot some wildlife.'));
      return;
    }
    const p = cur;
    const view = body.appendChild(el('div', 'phr-view'));
    const ph = view.appendChild(el('div', 'phr-photo'));
    ph.innerHTML = `<img src="${p.img}" alt="Photo" draggable="false">`;
    const loupe = view.appendChild(el('div', 'phr-loupe'));
    loupe.style.backgroundImage = `url(${p.img})`;
    const side = body.appendChild(el('div', 'phr-side'));
    const norm = (e: MouseEvent): [number, number] => {
      const r = ph.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    };
    const placeTags = () => {
      ph.querySelectorAll('.phr-tag').forEach(t => t.remove());
      for (const [x, y] of tags) {
        const t = ph.appendChild(el('div', 'phr-tag'));
        t.style.left = x * 100 + '%';
        t.style.top = y * 100 + '%';
      }
      const c = side.querySelector('.tagc');
      if (c) c.textContent = tags.length ? `${tags.length} tag${tags.length > 1 ? 's' : ''}` : 'No tags yet';
    };
    if (!result) {
      // magnifying loupe to find small or hidden animals
      ph.onmousemove = e => {
        const [x, y] = norm(e);
        const vr = view.getBoundingClientRect(), r = ph.getBoundingClientRect();
        loupe.style.display = 'block';
        loupe.style.left = e.clientX - vr.left - loupe.offsetWidth / 2 + 'px';
        loupe.style.top = e.clientY - vr.top - loupe.offsetHeight - 12 + 'px';
        loupe.style.backgroundSize = `${r.width * 3}px ${r.height * 3}px`;
        loupe.style.backgroundPosition = `${-x * r.width * 3 + loupe.offsetWidth / 2}px ${-y * r.height * 3 + loupe.offsetHeight / 2}px`;
      };
      ph.onmouseleave = () => { loupe.style.display = 'none'; };
      ph.onclick = e => {
        const [x, y] = norm(e);
        const near = tags.findIndex(([tx, ty]) => Math.hypot(tx - x, (ty - y) * 0.56) < 0.03);
        if (near >= 0) { tags.splice(near, 1); sfx('uiBack', { vol: 0.3 }); }
        else { tags.push([x, y]); sfx('focus', { vol: 0.5 }); }
        placeTags();
      };
      side.innerHTML = `<div class="phr-hint"><b style="font-family:var(--pix)">Tag every animal</b><br>Click each animal you can see (click a tag again to remove it). Animals can be tiny, far away or half hidden in the leaves. Hover to magnify.</div>
        <div class="meta">${p.video ? 'VIDEO CLIP' : 'PHOTO'} · ${esc(String(p.site))} · ${p.time} · day ${p.day}</div>
        ${p.af === 'foreground' ? '<div class="note">The autofocus locked onto something in front.</div>' : ''}
        ${p.light < 0.3 ? '<div class="note">Very dark exposure.</div>' : ''}
        ${p.notes.map(n => `<div class="meta">${esc(n)}</div>`).join('')}
        <div class="meta tagc">No tags yet</div>`;
      const bt = side.appendChild(el('div', 'phr-btns'));
      const keep = bt.appendChild(el('button', 'keep', 'Identify & file'));
      const del = bt.appendChild(el('button', 'del', 'Identify & delete'));
      keep.onclick = () => finish(true);
      del.onclick = () => finish(false);
      placeTags();
      return;
    }
    // results: show every box (what you hit, what failed, what you missed)
    const R = result;
    const box = (s: RawPhoto['subjects'][number], cls: string, label: string) => {
      const [x0, y0, x1, y1] = s.bbox;
      const b = ph.appendChild(el('div', 'phr-box ' + cls, `<span>${label}</span>`));
      b.style.left = x0 * 100 + '%'; b.style.top = y0 * 100 + '%';
      b.style.width = (x1 - x0) * 100 + '%'; b.style.height = (y1 - y0) * 100 + '%';
    };
    const hitSubs = new Set(R.hits.map(h => h.subject));
    for (const h of R.hits) box(h.subject, h.judge.identified ? 'ok' : 'bad', h.judge.identified ? esc(h.name) : '?');
    for (const s of p.subjects) if (!hitSubs.has(s)) box(s, 'miss', 'missed!');
    for (const [x, y] of tags) { const t = ph.appendChild(el('div', 'phr-tag')); t.style.left = x * 100 + '%'; t.style.top = y * 100 + '%'; t.style.opacity = '0.5'; }
    const res = side.appendChild(el('div', 'phr-res'));
    res.innerHTML = `<div class="phr-rp">${rpIcon()} +${R.rp}</div>${R.stars ? starsHTML(R.stars) : ''}`;
    for (const h of R.hits) {
      const sp = SPECIES_BY_ID[h.subject.species];
      const beh = h.subject.behavior && sp ? sp.behaviors[h.subject.behavior] ?? h.subject.behavior : null;
      res.appendChild(el('div', 'phr-hit' + (h.judge.identified ? '' : ' bad'), h.judge.identified
        ? `<b>${esc(h.name)}</b>${h.newSpecies ? ' <span style="color:#7dffb0">NEW!</span>' : ''} ${starsHTML(h.judge.stars)}${beh ? `<div class="ev">${esc(beh)}</div>` : ''}${h.evidence.map(e => `<div class="ev">${e}</div>`).join('')}`
        : `<b>Can’t identify</b><div class="why">${esc(h.judge.reason ?? 'Unclear')}</div>`));
    }
    if (R.misses) res.appendChild(el('div', 'phr-hit bad', `<b>${R.misses} tag${R.misses > 1 ? 's' : ''} on nothing</b><div class="why">Just leaves and shadows.</div>`));
    if (R.missed) res.appendChild(el('div', 'phr-hit bad', `<b>You missed ${R.missed} animal${R.missed > 1 ? 's' : ''}!</b><div class="why">Look closer next time.</div>`));
    if (!R.hits.length && !p.subjects.length) res.appendChild(el('div', 'phr-hit bad', '<b>No animals in this shot.</b>'));
    const bt = side.appendChild(el('div', 'phr-btns'));
    const nx = bt.appendChild(el('button', 'next', rawPhotos().length ? 'Next photo' : 'Done'));
    nx.onclick = () => pick(rawPhotos()[0] ?? null);
  };

  const finish = (keep: boolean) => {
    if (!cur || result) return;
    const id = cur.id;
    const r = reviewPhoto(id, tags, keep);
    if (!r) { deleteRawPhoto(id); pick(rawPhotos()[0] ?? null); return; }
    result = r;
    game.save.flags['reviewed:first'] = true;
    game.persist();
    sfx(r.rp > 0 ? 'discover' : 'wrong', { vol: 0.6 });
    if (r.hits.some(h => h.newSpecies)) sfx('star', { vol: 0.7 });
    drawStrip();
    draw();
    const rpEl = body.querySelector('.phr-rp') as HTMLElement | null;
    if (r.rp && ctx) ctx.rpFly(rpEl, r.rp);
    onDone?.();
  };

  pick(rawPhotos()[0] ?? null);
  return () => root.remove();
}

/** Review photos on the camera itself (a modal), e.g. during the prologue. Resolves on close. */
export function openPhotoRoll(o: { standalone?: boolean } = {}): Promise<void> {
  void o;
  return new Promise(res => {
    const cam = el('div', 'phr-cam');
    const x = cam.appendChild(el('button', 'x', 'Close ✕'));
    const inner = cam.appendChild(el('div', 'inner'));
    const dispose = mountPhotoRoll(inner);
    sfx('uiOpen', { vol: 0.5 });
    let closed = false;
    const close = game.ui.modal(cam, () => {
      if (closed) return;
      closed = true;
      dispose();
      popKeys();
      res();
    });
    const popKeys = pushKeys(e => { if (e.key === 'Escape') { close(); return true; } return false; });
    x.onclick = () => close();
  });
}
