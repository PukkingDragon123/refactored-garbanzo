// MoriOS research apps (V9), built on the desktop's window manager (see moriOS.ts):
// - Camera: the import window. The camera roll's real JPEGs as tiles (tap to toggle, all / none),
//   then Upload: each photo slides onto the stage, transfers, gets scanned, and the laptop's verdict
//   pops up as boxes over the animals (green with the name, red with the reason it can't be
//   identified). New species, behaviours and findings are celebrated as they land.
// - Research Log (replaces the old hardcoded Discoveries): one page per documented species, built
//   around the uploaded photo that documented it (subject highlighted; pick a better cover later),
//   the field-guide data, the research sheet, behaviours ticked off by photos, findings unlocked by
//   their evidence photos. Undiscovered species only appear as a "?" count.
// - Photos: the uploaded photos (plus a few of Mori's old ones) and a big viewer with the analysis.

import { game } from '../../game/game';
import { el } from '../ui';
import { audio } from '../../core/audio';
import type { RawPhoto } from '../../game/photos';
import type { Species } from '../../game/species';
import { SPECIES_BY_ID } from '../../game/species';
import type { UploadRecord, UploadSubject } from '../../game/save';
import {
  cameraRoll, pendingCount, uploadPhoto, UploadOutcome, documented, speciesTotal, entry, coverOf, photosOf, setCover, markSeen, upload,
} from '../../game/v9/research9';
import { Fx, sfx, icon, clamp } from '../v7/aeroFx';

export interface OSWin { el: HTMLElement; bd: HTMLElement; id: string; closing: boolean }
export interface OSProgress { el: HTMLElement; set: (f: number, label?: string, instant?: boolean) => void; edge: () => { x: number; y: number } }

/** what the research apps need from the desktop */
export interface OSCtx {
  field: boolean;
  win(id: string, title: string, ic: string, w: number, h: number, body: HTMLElement): OSWin | null;
  find(id: string): OSWin | null;
  closeWin(id: string): void;
  fx: Fx;
  center(e: Element): { x: number; y: number };
  animate(f: (dt: number) => boolean): void;
  retrigger(e: Element, cls: string): void;
  floatText(x: number, y: number, t: string, color?: string): void;
  progress(cls?: string): OSProgress;
  closed(): boolean;
  /** windows open from this element (the springy zoom origin) */
  from(e: Element): void;
  /** update the desktop / tray badges */
  badges(): void;
  /** Mori's old pixel photos for the Photos app */
  oldPhotos: { key: string; cap: string; make: () => HTMLCanvasElement }[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TOD: Record<string, string> = { dawn: 'Dawn', day: 'Daytime', dusk: 'Dusk', night: 'Night' };
const SITE: Record<string, string> = { sea: 'Aboard the Kittiwake', coast: 'The island', camp: 'Camp' };
const when = (p: { day: number; time: string }) => `Day ${p.day} · ${TOD[p.time] ?? p.time}`;
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
const STATUS = ['', 'Common', 'Uncommon', 'Scarce', 'Rare', 'Legendary'];
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const behLabel = (sp: Species | null, b: string) => sp?.behaviors[b] ?? b;

/** CSS background crop of a photo around a box (normalised coords) for a thumb of the given aspect */
function cropBg(img: string, bbox: [number, number, number, number], aspect: number, pad = 2.2): string {
  const [x0, y0, x1, y1] = bbox;
  const A = 16 / 9;
  let rh = clamp(Math.max((y1 - y0) * pad, ((x1 - x0) * pad * A) / aspect), 0.3, 1);
  let rw = (rh * aspect) / A;
  if (rw > 1) { rw = 1; rh = A / aspect; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const l = clamp(cx - rw / 2, 0, 1 - rw), t = clamp(cy - rh / 2, 0, 1 - rh);
  const px = rw < 0.999 ? (l / (1 - rw)) * 100 : 50, py = rh < 0.999 ? (t / (1 - rh)) * 100 : 50;
  return `background-image:url(${img});background-size:${(100 / rw).toFixed(2)}% ${(100 / rh).toFixed(2)}%;background-position:${px.toFixed(2)}% ${py.toFixed(2)}%`;
}

const boxStyle = (b: [number, number, number, number]) => {
  const [x0, y0, x1, y1] = b;
  return `left:${(x0 * 100).toFixed(2)}%;top:${(y0 * 100).toFixed(2)}%;width:${((x1 - x0) * 100).toFixed(2)}%;height:${((y1 - y0) * 100).toFixed(2)}%`;
};

export function researchApps(os: OSCtx) {
  const where = os.field ? 'field' : 'ship';
  /** re-render hooks of the open research windows */
  const live: { cam?: () => void; disc?: (focus?: string) => void; photos?: () => void } = {};
  const refreshAll = () => { live.disc?.(); live.photos?.(); os.badges(); };

  /** a tween on the desktop's frame loop; resolves when done (or at once if the laptop closed) */
  const tween = (sec: number, f: (k: number) => void) => new Promise<void>(res => {
    if (os.closed()) { res(); return; }
    let t = 0;
    os.animate(dt => {
      t += dt;
      const k = Math.min(1, t / Math.max(0.01, sec));
      f(k);
      if (k >= 1 || os.closed()) { res(); return false; }
      return true;
    });
  });

  // ================================================================ Camera import
  let busy = false;
  const known = new Set<number>();
  const sel = new Set<number>();

  const cam = () => {
    if (os.find('cam')) { if (!busy) live.cam?.(); os.win('cam', '', 'cam', 0, 0, el('div')); return; }
    const b = el('div', 'imp');
    b.dataset.direct = '1';
    const W = os.win('cam', 'Camera · Import photos', 'cam', 660, 520, b);
    if (!W) return;
    const gone = () => os.closed() || W.closing || !b.isConnected;
    const render = () => {
      if (busy) return;
      const roll = cameraRoll();
      for (const p of roll) if (!known.has(p.id)) { known.add(p.id); sel.add(p.id); }
      for (const id of [...sel]) if (!roll.some(p => p.id === id)) sel.delete(id);
      b.classList.remove('up');
      if (!roll.length) {
        b.innerHTML = `<div class="imp-empty"><span class="dev"></span><b>The camera is empty.</b><span>Everything on it has been uploaded. Go take some photos: raise the camera with <span class="kk">Q</span>, shoot with a click.</span></div>`;
        (b.querySelector('.dev') as HTMLElement).appendChild(icon('cam', 2.5));
        return;
      }
      b.innerHTML = `<div class="imp-top"><span class="dev"></span><span class="tt"><b>ZX-7 field camera</b><span>${plural(roll.length, 'new photo')} on the card</span></span><div class="gel sm glass ctl all">Select all</div><div class="gel sm glass ctl none">None</div></div>
        <div class="imp-grid"></div><div class="imp-foot"><span class="n"></span><div class="gel green big ctl go"></div></div>`;
      (b.querySelector('.dev') as HTMLElement).appendChild(icon('cam', 1.6));
      const grid = b.querySelector('.imp-grid') as HTMLElement;
      const n = b.querySelector('.imp-foot .n') as HTMLElement, go = b.querySelector('.go') as HTMLElement;
      const upd = () => {
        n.textContent = `${sel.size} of ${roll.length} selected`;
        go.textContent = sel.size ? `Upload ${plural(sel.size, 'photo')} ▲` : 'Pick some photos';
        go.classList.toggle('dim', !sel.size);
        grid.querySelectorAll<HTMLElement>('.imp-t').forEach(t => t.classList.toggle('on', sel.has(+t.dataset.id!)));
      };
      roll.forEach((p, i) => {
        const t = el('div', 'imp-t ctl', `<img alt="" draggable="false"><i class="ck"></i><span class="cap">${when(p)}</span>${p.video ? '<span class="vid">▶ CLIP</span>' : ''}`);
        (t.querySelector('img') as HTMLImageElement).src = p.img;
        t.dataset.id = String(p.id);
        t.style.animationDelay = Math.min(i, 14) * 40 + 'ms';
        t.addEventListener('click', () => {
          if (sel.has(p.id)) { sel.delete(p.id); sfx.press(); } else { sel.add(p.id); sfx.pick(); const c = os.center(t); os.fx.sparkle(c.x, c.y, 6, 50); }
          os.retrigger(t, 'bop');
          upd();
        });
        grid.appendChild(t);
      });
      (b.querySelector('.all') as HTMLElement).addEventListener('click', () => { roll.forEach(p => sel.add(p.id)); sfx.pick(); upd(); grid.querySelectorAll('.imp-t').forEach((t, i) => setTimeout(() => os.retrigger(t, 'bop'), i * 25)); });
      (b.querySelector('.none') as HTMLElement).addEventListener('click', () => { sel.clear(); sfx.press(); upd(); });
      go.addEventListener('click', () => {
        const list = cameraRoll().filter(p => sel.has(p.id));
        if (!list.length) { sfx.bad(); os.retrigger(go, 'mos-shake'); return; }
        void run(list);
      });
      upd();
    };
    live.cam = render;
    render();

    const run = async (list: RawPhoto[]) => {
      busy = true;
      const N = list.length;
      const k = clamp(5 / N, 0.38, 1);
      b.classList.add('up');
      b.innerHTML = `<div class="imp-q"></div><div class="imp-main"><div class="imp-stage"><div class="ph"><img alt="" draggable="false"><div class="boxes"></div><div class="scan"></div><div class="stamp"></div></div></div>
        <div class="imp-side"><div class="imp-bar"></div><div class="imp-feed"></div></div></div>`;
      const q = b.querySelector('.imp-q') as HTMLElement, ph = b.querySelector('.ph') as HTMLElement, img = ph.querySelector('img') as HTMLImageElement;
      const boxes = ph.querySelector('.boxes') as HTMLElement, scan = ph.querySelector('.scan') as HTMLElement, stamp = ph.querySelector('.stamp') as HTMLElement;
      const feed = b.querySelector('.imp-feed') as HTMLElement;
      const bar = os.progress('aq');
      (b.querySelector('.imp-bar') as HTMLElement).appendChild(bar.el);
      bar.set(0, `Uploading 1 of ${N}`, true);
      const qs = list.map(p => { const e = el('div', 'qt', '<img alt="" draggable="false"><i></i>'); (e.querySelector('img') as HTMLImageElement).src = p.img; q.appendChild(e); return e; });
      const tot = { photos: 0, species: [] as string[], beh: 0, facts: 0, rp: 0, none: 0 };
      for (let i = 0; i < N; i++) {
        if (gone()) break;
        const p = list[i];
        qs[i].classList.add('on');
        qs[i].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        img.src = p.img;
        boxes.innerHTML = ''; stamp.className = 'stamp'; stamp.textContent = '';
        os.retrigger(ph, 'in');
        const job = uploadPhoto(p, where);
        let lastQ = -1;
        await tween(0.8 * k, f => {
          bar.set((i + f * 0.7) / N, `Uploading ${i + 1} of ${N} · ${Math.round(f * 100)}%`);
          const qq = Math.floor(f * 6);
          if (qq !== lastQ) { lastQ = qq; sfx.tick(qq); if (!gone()) { const e = bar.edge(); os.fx.sparkle(e.x, e.y, 2, 30); os.fx.bubbles(e.x, e.y, 1, 6); } }
        });
        const out = await job;
        tot.photos++;
        os.badges();
        if (gone()) break;
        // the scan
        bar.set((i + 0.85) / N, `Analysing photo ${i + 1}…`);
        scan.style.animationDuration = 700 * k + 'ms';
        os.retrigger(scan, 'go');
        sfx.beep();
        await wait(700 * k);
        if (gone()) break;
        // the verdicts
        let j = 0;
        for (const f of out.found) {
          const known2 = !!entry(f.species);
          const nm = f.ok || known2 ? f.sp?.name ?? 'Unknown animal' : 'Unidentified animal';
          const bx = el('div', 'bx ' + (f.ok ? 'ok' : 'no'), f.ok || known2 ? `<span>${f.ok ? '✓' : '✕'} ${esc(nm)}${f.n > 1 ? ' ×' + f.n : ''}</span>` : '<span>✕ ?</span>');
          bx.setAttribute('style', boxStyle(f.bbox));
          if (f.bbox[1] < 0.18) bx.classList.add('lo');
          boxes.appendChild(bx);
          if (f.ok) sfx.pop(j++); else sfx.press();
          await wait(260 * k);
        }
        if (!out.found.length) { stamp.className = 'stamp none'; stamp.textContent = p.af === 'foreground' ? 'Just leaves' : 'No animals'; tot.none++; }
        feedLines(feed, p, out);
        bar.set((i + 1) / N, `${i + 1} of ${N} uploaded`);
        // celebrate
        const c = os.center(ph);
        if (out.newSpecies.length) {
          stamp.className = 'stamp new';
          stamp.innerHTML = `New species!<small>${esc(out.newSpecies.map(s => SPECIES_BY_ID[s]?.name ?? s).join(', '))}</small>`;
          audio.play('discover', { vol: 0.6 });
          os.fx.confetti(c.x, c.y - ph.offsetHeight / 2, 60, ph.offsetWidth * 0.8);
          os.fx.sparkle(c.x, c.y, 16, 140);
          await wait(1100 * k);
        } else if (out.newFacts.length) {
          audio.play('fact', { vol: 0.55 });
          stamp.className = 'stamp fact'; stamp.innerHTML = `New finding!<small>${esc(out.newFacts[0][1].cat)}</small>`;
          os.fx.sparkle(c.x, c.y, 14, 120);
          await wait(800 * k);
        } else if (out.newBeh.length) {
          sfx.star();
          os.floatText(c.x, c.y - 20, '+ behaviour', '#c8ff9a');
          await wait(450 * k);
        } else await wait(250 * k);
        if (out.rp) { const cc = os.center(qs[i]); os.floatText(cc.x, cc.y, `+${out.rp} RP`, '#ffe27a'); }
        qs[i].classList.remove('on'); qs[i].classList.add('done', out.found.some(f => f.ok) ? 'hit' : 'miss');
        tot.species.push(...out.newSpecies); tot.beh += out.newBeh.length; tot.facts += out.newFacts.length; tot.rp += out.rp;
        refreshAll();
      }
      busy = false;
      refreshAll();
      if (gone()) return;
      // the summary
      const side = b.querySelector('.imp-side') as HTMLElement;
      const sum = el('div', 'imp-sum', `<b>Upload complete!</b>
        <div class="rw"><i>${tot.photos}</i>${tot.photos === 1 ? 'photo' : 'photos'} uploaded</div>
        <div class="rw"><i>${tot.species.length}</i>new species documented</div>
        <div class="rw"><i>${tot.beh}</i>${tot.beh === 1 ? 'behaviour' : 'behaviours'} recorded</div>
        ${tot.facts ? `<div class="rw"><i>${tot.facts}</i>new ${tot.facts === 1 ? 'finding' : 'findings'}</div>` : ''}
        ${tot.rp ? `<div class="rp">+${tot.rp} RP</div>` : ''}
        <div class="bt"><div class="gel sm green ctl log">Open Research Log</div><div class="gel sm glass ctl more">${pendingCount() ? 'Back to the camera' : 'Done'}</div></div>`);
      side.insertBefore(sum, side.firstChild);
      (sum.querySelector('.log') as HTMLElement).addEventListener('click', () => { os.from(sum); disc(tot.species[0]); });
      (sum.querySelector('.more') as HTMLElement).addEventListener('click', () => { if (pendingCount()) render(); else os.closeWin('cam'); });
      sfx.win();
      const c = os.center(b);
      os.fx.confetti(c.x, c.y - b.offsetHeight / 2, 50, b.offsetWidth * 0.6);
      os.fx.bubbles(c.x, c.y, 12, b.offsetWidth * 0.5);
      // new species: the research log opens on the first one
      if (tot.species.length) setTimeout(() => { if (!os.closed() && b.isConnected) { os.from(sum); disc(tot.species[0]); } }, 1500);
    };
  };

  /** the verdict lines for one uploaded photo */
  const feedLines = (feed: HTMLElement, p: RawPhoto, out: UploadOutcome) => {
    const g = el('div', 'grp');
    const mini = el('img', 'mini') as HTMLImageElement;
    mini.src = out.rec.img;
    mini.alt = '';
    g.appendChild(mini);
    const ls = el('div', 'ls');
    if (!out.found.length) ls.appendChild(el('div', 'ln none', p.af === 'foreground' ? 'Nothing but leaves: the focus grabbed the foliage' : 'No animals in this one'));
    for (const f of out.found) {
      if (f.ok) {
        const isNew = out.newSpecies.includes(f.species);
        const bh = f.beh.map(x => `${out.newBeh.some(([s, b]) => s === f.species && b === x) ? '<em>+</em>' : ''}${esc(behLabel(f.sp, x))}`).join(', ');
        ls.appendChild(el('div', 'ln ok', `<b>✓ ${esc(f.sp?.name ?? f.species)}</b>${f.n > 1 ? ` ×${f.n}` : ''}${isNew ? ' <span class="tag">NEW SPECIES</span>' : ''}<small>${bh ? bh + ' · ' : ''}<span class="st">${stars(f.stars)}</span></small>`));
      } else {
        const nm = entry(f.species) ? f.sp?.name ?? f.species : 'Unidentified animal';
        ls.appendChild(el('div', 'ln no', `<b>✕ ${esc(nm)}</b><small>${esc(f.why ?? 'Not identifiable')}</small>`));
      }
    }
    for (const [, f] of out.newFacts) ls.appendChild(el('div', 'ln fact', `<b>✦ New finding</b><small>${esc(f.text)}</small>`));
    g.appendChild(ls);
    feed.appendChild(g);
    feed.scrollTop = feed.scrollHeight;
  };

  // ================================================================ Research Log
  const shownCards = new Set<string>();
  const disc = (focus?: string) => {
    if (os.find('disc')) { live.disc?.(focus); os.win('disc', '', 'disc', 0, 0, el('div')); return; }
    const b = el('div', 'rl');
    let cur: string | null = focus ?? null;
    let picking = false;
    const render = (f?: string) => {
      if (f) { cur = f; picking = false; }
      const docs = documented();
      if (!cur || !entry(cur)) cur = docs.find(d => d.e.fresh)?.id ?? docs[docs.length - 1]?.id ?? null;
      const total = Math.max(speciesTotal(), docs.length);
      b.innerHTML = `<div class="rl-top"><b>Research Log</b><span class="ct">${docs.length} of ${total} species documented</span><div class="pw"></div></div><div class="rl-body"><div class="rl-list"></div><div class="rl-page"></div></div>`;
      const pr = os.progress();
      (b.querySelector('.pw') as HTMLElement).replaceWith(pr.el);
      pr.set(docs.length / Math.max(1, total), `${Math.round((docs.length / Math.max(1, total)) * 100)}%`, true);
      const list = b.querySelector('.rl-list') as HTMLElement, pg = b.querySelector('.rl-page') as HTMLElement;
      if (!docs.length) {
        b.classList.add('empty');
        pg.innerHTML = `<div class="rl-empty"><b>Nothing documented yet.</b><span>A species gets its page here once a photo of it is uploaded from the camera. It has to be a good photo: sharp, close enough, and more of the animal than a tail.</span></div>`;
        if (pendingCount()) { const go = el('div', 'gel green ctl', `Import ${plural(pendingCount(), 'photo')} from the camera`); go.addEventListener('click', () => { os.from(go); cam(); }); (pg.firstElementChild as HTMLElement).appendChild(go); }
        list.appendChild(el('div', 'rl-q', `<i>?</i><span>${total} species out there</span>`));
        return;
      }
      b.classList.remove('empty');
      let popI = 0;
      for (const d of docs) {
        const cov = coverOf(d.id);
        const sub = cov?.subjects.find(s => s.species === d.id);
        const nb = Object.keys(d.sp.behaviors).length;
        const card = el('div', 'rl-card ctl' + (d.id === cur ? ' on' : '') + (d.e.fresh ? ' fresh' : ''), `<div class="th"></div><div class="tx"><b>${esc(d.sp.name)}</b><i>${esc(d.sp.group)}</i><span>Behaviours ${d.e.beh.length}/${nb}</span></div>`);
        if (cov) (card.querySelector('.th') as HTMLElement).setAttribute('style', cropBg(cov.img, sub?.bbox ?? [0.3, 0.3, 0.7, 0.7], 4 / 3));
        if (!shownCards.has(d.id)) { card.classList.add('pop'); card.style.animationDelay = popI++ * 90 + 'ms'; shownCards.add(d.id); }
        card.addEventListener('click', () => { if (cur === d.id) return; cur = d.id; picking = false; sfx.pick(); render(); });
        list.appendChild(card);
      }
      const left = total - docs.length;
      if (left > 0) list.appendChild(el('div', 'rl-q', `<i>?</i><span>${left} more ${left === 1 ? 'species' : 'species'} out there</span>`));
      if (cur) page(pg, cur);
      list.querySelector('.on')?.scrollIntoView?.({ block: 'nearest' });
    };

    const page = (pg: HTMLElement, id: string) => {
      const sp = SPECIES_BY_ID[id], e = entry(id)!;
      const cov = coverOf(id);
      const sub = cov?.subjects.find(s => s.species === id);
      const R = sp.research;
      const fresh = !!e.fresh;
      const behs = Object.entries(sp.behaviors);
      const firstRec = upload(e.first);
      const status = R?.status ?? STATUS[clamp(sp.rarity, 1, 5)];
      pg.innerHTML = `<div class="rl-hero${fresh ? ' fresh' : ''}"><div class="ph">${cov ? '<img alt="" draggable="false"><div class="hl"></div>' : '<div class="gone">photo no longer stored</div>'}${fresh ? '<div class="nw">NEW!</div>' : ''}</div>
          <div class="cap"><span>${e.cover === e.first ? 'First documented' : 'Cover photo'} · ${cov ? when(cov) : when({ day: e.day, time: 'day' })}${firstRec && e.cover !== e.first ? ` <i>(first documented ${when(firstRec)})</i>` : ''}</span>${photosOf(id).length > 1 ? '<div class="gel sm glass ctl pick">Change cover</div>' : ''}</div><div class="picker"></div></div>
        <div class="rl-title"><h2>${esc(sp.name)}</h2><i>${esc(sp.sci)}</i><div class="chips"><span>${esc(sp.group)}</span><span>${esc(sp.size)}</span><span class="st">${esc(status)}</span>${sp.danger >= 2 ? '<span class="dg">Keep your distance</span>' : ''}</div></div>
        <p class="blurb">${esc(sp.blurb)}</p>
        <div class="rl-sec beh"><h4>Behaviours <b>${e.beh.filter(x => x in sp.behaviors).length}/${behs.length}</b></h4><ul>${behs.map(([k, v]) => e.beh.includes(k) ? `<li class="ok"><i>✓</i>${esc(v)}${e.vid.includes(k) ? ' <small>on video</small>' : ''}</li>` : `<li><i>○</i>${esc(v)} <small>not photographed yet</small></li>`).join('')}</ul></div>
        <div class="rl-sheet"></div>
        <div class="rl-sec facts"></div>
        <div class="rl-sec pics"><h4>Photos <b>${photosOf(id).length}</b></h4><div class="strip"></div></div>`;
      if (cov) {
        (pg.querySelector('.rl-hero img') as HTMLImageElement).src = cov.img;
        const hl = pg.querySelector('.rl-hero .hl') as HTMLElement;
        if (sub) hl.setAttribute('style', boxStyle(pad(sub.bbox))); else hl.remove();
      }
      // research sheet
      const sh = pg.querySelector('.rl-sheet') as HTMLElement;
      if (R) {
        const secs: [string, string, string][] = [['hab', 'Habitat', R.habitat], ['diet', 'Diet', R.diet], ['ana', 'Anatomy', R.anatomy], ['eco', 'Ecology', R.ecology], ['bhv', 'Behaviour', R.behaviour]];
        sh.innerHTML = secs.filter(([, , t]) => !!t).map(([c, h, t]) => `<div class="sec ${c}"><h5>${h}</h5><p>${esc(t)}</p></div>`).join('')
          + (R.notes?.length ? `<div class="sec notes"><h5>Mori’s field notes</h5><ul>${R.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : '');
      } else sh.innerHTML = `<div class="sec pending"><h5>Research sheet</h5><p>Not written up yet. Mori has the photo; the notes are still in the soggy field notebook.</p></div>`;
      // findings
      const fs = pg.querySelector('.rl-sec.facts') as HTMLElement;
      if (sp.facts.length) {
        fs.innerHTML = `<h4>Findings <b>${e.facts.length}/${sp.facts.length}</b></h4><ul>${sp.facts.map(f => e.facts.includes(f.id)
          ? `<li class="ok"><i>✦</i><span><b>${esc(f.cat)}</b> ${esc(f.text)}</span></li>`
          : `<li class="lock"><i>?</i><span><b>${esc(f.q)}</b><small>${esc(f.hint)}</small></span></li>`).join('')}</ul>`;
      } else fs.remove();
      // photos
      const strip = pg.querySelector('.pics .strip') as HTMLElement;
      for (const u of photosOf(id).slice().reverse()) {
        const s2 = u.subjects.find(x => x.species === id);
        const t = el('div', 'pt ctl' + (u.id === e.cover ? ' on' : ''));
        t.setAttribute('style', cropBg(u.img, s2?.bbox ?? [0.3, 0.3, 0.7, 0.7], 16 / 10, 3));
        t.title = when(u);
        t.addEventListener('click', () => { os.from(t); viewer(u.id); });
        strip.appendChild(t);
      }
      // cover picker
      const pk = pg.querySelector('.pick') as HTMLElement | null, picker = pg.querySelector('.picker') as HTMLElement;
      const fill = () => {
        picker.innerHTML = '<span>Pick a cover photo:</span>';
        for (const u of photosOf(id).slice().reverse()) {
          const s2 = u.subjects.find(x => x.species === id);
          const t = el('div', 'pt ctl' + (u.id === e.cover ? ' on' : ''), u.id === e.first ? '<i>1st</i>' : '');
          t.setAttribute('style', cropBg(u.img, s2?.bbox ?? [0.3, 0.3, 0.7, 0.7], 16 / 10, 3));
          t.addEventListener('click', () => {
            setCover(id, u.id);
            picking = false;
            sfx.pick();
            render();
            const h = b.querySelector('.rl-hero .ph');
            if (h) { os.retrigger(h, 'flip'); const c = os.center(h); os.fx.sparkle(c.x, c.y, 12, 110); }
            live.photos?.();
          });
          picker.appendChild(t);
        }
      };
      if (pk) pk.addEventListener('click', () => { picking = !picking; picker.classList.toggle('on', picking); if (picking) fill(); sfx.menu(); });
      if (picking) { picker.classList.add('on'); fill(); }
      // a fresh entry pops in
      if (fresh) {
        markSeen(id);
        os.badges();
        setTimeout(() => {
          if (!pg.isConnected) return;
          const h = pg.querySelector('.rl-hero') as HTMLElement;
          const c = os.center(h);
          os.fx.confetti(c.x, c.y - h.offsetHeight / 2, 46, h.offsetWidth * 0.8);
          os.fx.sparkle(c.x, c.y, 14, 120);
          sfx.win();
        }, 260);
      }
      pg.scrollTop = 0;
    };
    const W = os.win('disc', 'Research Log', 'disc', 800, 560, b);
    if (!W) return;
    live.disc = render;
    render();
  };
  const pad = (bb: [number, number, number, number]): [number, number, number, number] => {
    const w = bb[2] - bb[0], h = bb[3] - bb[1];
    return [clamp(bb[0] - w * 0.12 - 0.01, 0, 1), clamp(bb[1] - h * 0.12 - 0.015, 0, 1), clamp(bb[2] + w * 0.12 + 0.01, 0, 1), clamp(bb[3] + h * 0.12 + 0.015, 0, 1)];
  };

  // ================================================================ Photos
  const photos = () => {
    if (os.find('photos')) { live.photos?.(); os.win('photos', '', 'photo', 0, 0, el('div')); return; }
    const b = el('div', 'phs');
    const render = () => {
      const ups = game.save.uploads.slice().reverse();
      const n = pendingCount();
      b.innerHTML = (n ? `<div class="phs-cam"><span class="ic"></span><span><b>${plural(n, 'new photo')}</b> on the camera, not uploaded yet</span><div class="gel sm green ctl imp">Import</div></div>` : '')
        + `<h4>Uploaded from the camera <b>${ups.length}</b></h4><div class="gal up"></div><h4>Mori’s old photos</h4><div class="gal old"></div>`;
      if (n) {
        (b.querySelector('.phs-cam .ic') as HTMLElement).appendChild(icon('cam', 1));
        const im = b.querySelector('.imp') as HTMLElement;
        im.addEventListener('click', () => { os.from(im); cam(); });
      }
      const up = b.querySelector('.gal.up') as HTMLElement;
      if (!ups.length) up.outerHTML = '<p class="muted">Nothing uploaded yet. Plug in the camera (it’s the Camera icon on the desktop).</p>';
      for (const u of ups) {
        const f = el('figure', 'ctl');
        const img = el('img') as HTMLImageElement;
        img.src = u.img; img.draggable = false; img.alt = '';
        f.appendChild(img);
        f.appendChild(el('figcaption', '', esc(caption(u))));
        if (u.video) f.appendChild(el('span', 'vid', '▶ CLIP'));
        f.addEventListener('click', () => { os.from(f); viewer(u.id); });
        up.appendChild(f);
      }
      const old = b.querySelector('.gal.old') as HTMLElement;
      for (const o of os.oldPhotos) {
        const f = el('figure', 'ctl');
        f.appendChild(o.make());
        f.appendChild(el('figcaption', '', esc(o.cap)));
        f.addEventListener('click', () => {
          const big = el('div', 'big');
          big.appendChild(o.make());
          big.appendChild(el('p', '', esc(o.cap)));
          os.from(f);
          os.win('ph:' + o.key, o.key + '.png', 'photo', 460, 400, big);
        });
        old.appendChild(f);
      }
    };
    const W = os.win('photos', 'Photos', 'photo', 660, 500, b);
    if (!W) return;
    live.photos = render;
    render();
  };
  const caption = (u: UploadRecord) => {
    const ok = u.subjects.filter(s => s.ok).map(s => SPECIES_BY_ID[s.species]?.name ?? s.species);
    return ok.length ? ok.join(', ') : u.subjects.length ? 'Nothing identifiable' : 'No animals';
  };

  /** the big viewer: the photo with the laptop's analysis over it */
  const viewer = (id: number) => {
    const u = upload(id);
    if (!u) return;
    const b = el('div', 'pv');
    const draw = () => {
      b.innerHTML = `<div class="ph"><img alt="" draggable="false"><div class="boxes"></div></div><div class="pv-info"><div class="meta">${when(u)} · ${esc(SITE[u.site] ?? u.site)}${u.video ? ' · video clip' : ''}</div><div class="subs"></div><div class="gel sm glass ctl tg">Hide analysis</div></div>`;
      (b.querySelector('img') as HTMLImageElement).src = u.img;
      const bx = b.querySelector('.boxes') as HTMLElement, subs = b.querySelector('.subs') as HTMLElement;
      if (!u.subjects.length) subs.appendChild(el('div', 'ln none', 'No animals in this photo.'));
      u.subjects.forEach((s: UploadSubject) => {
        const sp = SPECIES_BY_ID[s.species] ?? null;
        const nm = s.ok || entry(s.species) ? sp?.name ?? s.species : 'Unidentified animal';
        const x = el('div', 'bx ' + (s.ok ? 'ok' : 'no'), s.ok || entry(s.species) ? `<span>${s.ok ? '✓' : '✕'} ${esc(nm)}</span>` : '<span>✕ ?</span>');
        x.setAttribute('style', boxStyle(s.bbox));
        if (s.bbox[1] < 0.18) x.classList.add('lo');
        bx.appendChild(x);
        const ln = el('div', 'ln ' + (s.ok ? 'ok' : 'no'), s.ok
          ? `<b>✓ ${esc(nm)}</b>${s.n > 1 ? ' ×' + s.n : ''}<small>${s.beh.map(k => esc(behLabel(sp, k))).join(', ')}${s.beh.length ? ' · ' : ''}<span class="st">${stars(s.stars)}</span></small>`
          : `<b>✕ ${esc(nm)}</b><small>${esc(s.why ?? '')}</small>`);
        const e = entry(s.species);
        if (s.ok && e) {
          const row = el('div', 'acts');
          const open = el('div', 'gel sm ctl', 'Research page');
          open.addEventListener('click', () => { os.from(open); disc(s.species); });
          row.appendChild(open);
          if (e.cover !== u.id) {
            const cv = el('div', 'gel sm green ctl', 'Use as cover');
            cv.addEventListener('click', () => {
              setCover(s.species, u.id);
              sfx.pick();
              const c = os.center(cv); os.fx.sparkle(c.x, c.y, 10, 80); os.floatText(c.x, c.y - 16, 'Cover set!');
              live.disc?.(); draw();
            });
            row.appendChild(cv);
          }
          ln.appendChild(row);
        }
        subs.appendChild(ln);
      });
      const tg = b.querySelector('.tg') as HTMLElement;
      tg.addEventListener('click', () => { const off = bx.classList.toggle('off'); tg.textContent = off ? 'Show analysis' : 'Hide analysis'; sfx.click(); });
    };
    draw();
    os.win('pv:' + id, `photo_${String(id).padStart(4, '0')}.jpg`, 'photo', 640, 520, b);
  };

  return { cam, disc, photos, viewer };
}
