// MoriOS: Upload Everything (V10), the end of an expedition day at the camp laptop. One window
// takes the whole haul: (1) the camera roll goes up through the usual upload stage (scan, verdict
// boxes, new species), (2) the backpack's samples, artifacts and fossils go into the research crate,
// each with a short analysis on the lab bench (ItemDef.lab, or the laptop's best guess), (3) the
// map's new field notes are filed, and (4) the day report: what was documented, the RP the agency
// paid and the week's targets. The agency answers by mail (see ./agency).

import { el } from '../ui';
import { audio } from '../../core/audio';
import { ITEMS } from '../../game/items';
import { SPECIES_BY_ID, CLUE_BY_ID } from '../../game/species';
import { itemIconURL, ICON_IDS } from '../../art/itemicons';
import { location } from '../../game/v10/regions';
import type { Discovery } from '../../game/v10/regions';
import { fx10 } from '../../game/v10/skills10';
import {
  cameraRoll, pendingCount, handInPlan, handIn, pendingNotes, fileNote, atCamp, newSession, endSession, today, daySum, weekTargets, unreadMail, itemCat,
} from '../../game/v9/research9';
import type { HandIn, Session, LabOutcome } from '../../game/v9/research9';
import { game } from '../../game/game';
import type { OSCtx, ResearchApps } from '../v4/moriResearch';
import { esc, plural, wait } from '../v4/moriResearch';
import { sfx, clamp } from '../v7/aeroFx';
import { icon10URL, crateArt, mascot } from './icons10';
import { placeIcon, kindLabel } from './encyData';

export interface UploadApp { open(): void; refresh(): void }

const itemSrc = (id: string) => {
  if (ICON_IDS.items().includes(id)) return itemIconURL(id, 3);
  const c = itemCat(id);
  return icon10URL(c === 'flora' ? 'c_flora' : c === 'artifact' ? 'c_culture' : c === 'fossil' ? 'c_fossils' : 'c_samples');
};
const CAT_WORD: Record<string, string> = { flora: 'Plant', sample: 'Sample', artifact: 'Artifact', fossil: 'Fossil' };

export function uploadAllApp(os: OSCtx, ra: ResearchApps): UploadApp {
  let b: HTMLElement | null = null;
  let busy = false;
  /** the run's speed (the Faster button) */
  let fastK = 1;
  /** the player's choice per backpack item (how many go to the crate) */
  const take = new Map<string, number>();

  const open = () => {
    if (os.find('upall') && b?.isConnected) { if (!busy) render(); os.win('upall', '', 'upall', 0, 0, el('div')); return; }
    b = el('div', 'up');
    b.dataset.direct = '1';
    const W = os.win('upall', 'Upload Everything', 'upall', 820, 580, b);
    if (!W) return;
    render();
  };
  const gone = () => !b || !b.isConnected || os.closed();

  // ---------------------------------------------------------------- the haul (before uploading)
  const plan = (): HandIn[] => {
    const p = handInPlan();
    for (const h of p) { const t = take.get(h.id); if (t !== undefined) h.take = clamp(t, 0, h.n); }
    return p;
  };
  const render = () => {
    if (!b || busy) return;
    const roll = cameraRoll();
    const camp = atCamp();
    const items = plan();
    const notes = pendingNotes();
    const nothing = !roll.length && !items.length && !notes.length;
    b.innerHTML = `<div class="up-top"><span class="crt"></span><span class="tt"><b>${camp ? 'Back at camp' : 'Field upload'} · Day ${today()}</b><span>${nothing ? 'All caught up.' : 'Photos, specimens and field notes, in one go.'}</span></span><span class="rpb"><img src="${icon10URL('upall')}" alt="">${game.save.rp} RP</span></div>
      <div class="up-cards"></div>
      <div class="up-foot"><span class="sum"></span><div class="gel green big ctl go"></div></div>`;
    (b.querySelector('.crt') as HTMLElement).appendChild(crateArt(1));
    const cards = b.querySelector('.up-cards') as HTMLElement;
    if (nothing) {
      cards.innerHTML = `<div class="up-empty"><b>Nothing to upload.</b><span>The camera is empty, the pack has no specimens and the notebook is up to date. Go and explore: everything you photograph, collect and find comes back here.</span></div>`;
      const enc = el('div', 'gel sm ctl', 'Open the Encyclopedia');
      enc.addEventListener('click', () => { os.from(enc); os.open('enc'); });
      (cards.firstElementChild as HTMLElement).appendChild(enc);
    }
    // the camera
    if (roll.length) {
      const c = el('div', 'up-card cam', `<h4><img src="" alt="">Camera <b>${roll.length}</b></h4><div class="strip"></div><p>${plural(roll.length, 'photo')} to upload and identify.</p>`);
      (c.querySelector('h4 img') as HTMLElement).replaceWith(os.icon('cam', 1));
      const strip = c.querySelector('.strip') as HTMLElement;
      for (const p of roll.slice(-12).reverse()) { const i = el('img') as HTMLImageElement; i.src = p.img; i.alt = ''; i.draggable = false; strip.appendChild(i); }
      cards.appendChild(c);
    }
    // the backpack
    if (items.length) {
      const c = el('div', 'up-card pack' + (camp ? '' : ' off'), `<h4><img src="${icon10URL('c_samples')}" alt="">Backpack <b>${items.reduce((a, h) => a + h.n, 0)}</b></h4><div class="tiles"></div><p class="lg">${camp ? 'Tap an item to choose how many go to the research crate: all · one · keep.' : 'The research crate is back at camp: bring these home to hand them in.'}</p>`);
      const tiles = c.querySelector('.tiles') as HTMLElement;
      for (const h of items) {
        const t = el('div', 'up-t' + (camp ? ' ctl' : ''));
        const paint = () => {
          const state = h.take >= h.n ? (h.n > 1 ? 'all' : 'in') : h.take > 0 ? 'one' : 'keep';
          t.className = 'up-t' + (camp ? ' ctl' : '') + ' ' + state + (h.cat === 'artifact' || h.cat === 'fossil' ? ' rare' : '');
          t.innerHTML = `<img src="${itemSrc(h.id)}" alt="" draggable="false"><span class="n">×${h.n}</span><b>${esc(ITEMS[h.id]?.name ?? h.id)}</b><em>${state === 'keep' ? (h.keep === 'food' ? 'keep (food)' : h.keep === 'crafting' ? 'keep (crafting)' : 'keep') : state === 'one' ? `1 to the lab${h.keep ? `, ${h.n - 1} kept` : ''}` : h.cat === 'artifact' ? 'to the crate' : h.analysed ? 'to the crate' : 'analyse'}</em>`;
          t.title = h.keep === 'food' ? 'Edible: one sample is enough for the lab' : h.keep === 'crafting' ? 'Used for crafting: one sample is enough for the lab' : '';
        };
        paint();
        if (camp) t.addEventListener('click', () => {
          const cyc = h.n > 1 ? [h.n, 1, 0] : [1, 0];
          const i = cyc.indexOf(h.take);
          h.take = cyc[(i + 1) % cyc.length];
          take.set(h.id, h.take);
          if (h.take) sfx.pick(); else sfx.press();
          paint();
          os.retrigger(t, 'bop');
          foot();
        });
        tiles.appendChild(t);
      }
      cards.appendChild(c);
    }
    // the field notes
    if (notes.length) {
      const c = el('div', 'up-card notes', `<h4><img src="${icon10URL('c_places')}" alt="">Field notes <b>${notes.length}</b></h4><ul>${notes.slice(0, 8).map(d => `<li><img src="${icon10URL(placeIcon(d.kind))}" alt=""><span><b>${esc(d.name)}</b><i>${esc(kindLabel(d.kind))}${location(d.loc) ? ' · ' + esc(location(d.loc)!.name) : ''}</i></span></li>`).join('')}${notes.length > 8 ? `<li class="more">and ${notes.length - 8} more</li>` : ''}</ul>`);
      cards.appendChild(c);
    }
    const go = b.querySelector('.go') as HTMLElement;
    const foot = () => {
      const n = camp ? items.reduce((a, h) => a + h.take, 0) : 0;
      const parts = [roll.length ? plural(roll.length, 'photo') : '', n ? plural(n, 'specimen') : '', notes.length ? plural(notes.length, 'field note') : ''].filter(Boolean);
      (b!.querySelector('.sum') as HTMLElement).textContent = parts.length ? parts.join(' · ') : 'Nothing selected';
      go.textContent = parts.length ? 'Upload everything ▲' : 'Nothing to upload';
      go.classList.toggle('dim', !parts.length);
    };
    foot();
    go.addEventListener('click', () => {
      const its = atCamp() ? plan().filter(h => h.take > 0) : [];
      if (!cameraRoll().length && !its.length && !pendingNotes().length) { sfx.bad(); os.retrigger(go, 'mos-shake'); return; }
      void run(its);
    });
  };

  // ---------------------------------------------------------------- the run
  const run = async (items: HandIn[]) => {
    if (!b) return;
    busy = true;
    const ses = newSession();
    const photos = cameraRoll().slice();
    const notes = pendingNotes();
    const steps = [['Photos', photos.length], ['Lab bench', items.length], ['Field notes', notes.length], ['Day report', 1]] as const;
    fastK = 1;
    b.innerHTML = `<div class="up-steps">${steps.map(([n, c], i) => `<span class="${c ? '' : 'nop'}" data-i="${i}"><i>${i + 1}</i>${n}</span>`).join('<u></u>')}<div class="gel sm glass ctl ff">⏩ Faster</div></div><div class="up-stage"></div>`;
    const ff = b.querySelector('.ff') as HTMLElement;
    ff.addEventListener('click', () => { fastK = fastK < 1 ? 1 : 0.35; ff.classList.toggle('green', fastK < 1); ff.classList.toggle('glass', fastK >= 1); ff.textContent = fastK < 1 ? '⏩ Fast!' : '⏩ Faster'; sfx.click(); });
    const stage = b.querySelector('.up-stage') as HTMLElement;
    const step = (i: number) => b?.querySelectorAll('.up-steps span').forEach((s, j) => { s.classList.toggle('on', j === i); s.classList.toggle('done', j < i); });
    try {
      if (photos.length && !gone()) {
        step(0);
        const host = el('div', 'imp up-ph');
        stage.appendChild(host);
        const tot = await ra.photoStage(host, photos, gone, () => 0.75 * fastK);
        const s2 = tot.ses;
        ses.photos += s2.photos; ses.ok += s2.ok; ses.species.push(...s2.species); ses.beh.push(...s2.beh); ses.facts.push(...s2.facts); ses.rp += s2.rp;
        if (!gone()) await wait(500);
      }
      if (items.length && !gone()) { step(1); await lab(stage, items, ses); }
      if (notes.length && !gone()) { step(2); await filing(stage, notes, ses); }
    } finally {
      busy = false;
      endSession(ses);
      if (ses.photos || ses.items.length || ses.notes.length) os.sessionDone(ses);
      os.refresh();
    }
    if (gone()) return;
    step(3);
    report(stage, ses);
  };

  // ---- (2) the lab bench
  const lab = async (stage: HTMLElement, items: HandIn[], ses: Session) => {
    stage.innerHTML = `<div class="bench"><div class="lab-q"></div><div class="lab-c"><div class="scope"><div class="ring"></div><div class="dish"><img alt="" draggable="false"></div><div class="beam"></div><div class="stamp"></div></div><div class="bars">${'<i></i>'.repeat(14)}</div><div class="pw"></div><div class="cap"></div></div><div class="lab-r"><div class="crate"><span class="n">0</span></div><div class="feed"></div></div></div>`;
    const q = stage.querySelector('.lab-q') as HTMLElement, scope = stage.querySelector('.scope') as HTMLElement;
    const dish = stage.querySelector('.dish img') as HTMLImageElement, stamp = stage.querySelector('.scope .stamp') as HTMLElement;
    const bars = [...stage.querySelectorAll<HTMLElement>('.bars i')], cap = stage.querySelector('.lab-c .cap') as HTMLElement;
    const feed = stage.querySelector('.lab-r .feed') as HTMLElement, crate = stage.querySelector('.crate') as HTMLElement, crateN = crate.querySelector('.n') as HTMLElement;
    crate.insertBefore(crateArt(1.5), crateN);
    const bar = os.progress('');
    (stage.querySelector('.lab-c .pw') as HTMLElement).replaceWith(bar.el);
    const qs = items.map(h => { const t = el('div', 'qt', `<img src="${itemSrc(h.id)}" alt=""><span>×${h.take}</span>`); q.appendChild(t); return t; });
    let inCrate = 0;
    const N = items.length;
    const k0 = clamp(6 / N, 0.45, 1);
    for (let i = 0; i < N; i++) {
      if (gone()) return;
      const k = k0 * fastK;
      const h = items[i];
      const nm = ITEMS[h.id]?.name ?? h.id;
      qs[i].classList.add('on');
      qs[i].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      dish.src = itemSrc(h.id);
      stamp.className = 'stamp'; stamp.textContent = '';
      scope.className = 'scope in' + (h.cat === 'artifact' ? ' care' : '');
      os.retrigger(scope, 'in');
      audio.play(h.cat === 'artifact' || h.cat === 'fossil' ? 'pageTurn' : 'jarClink', { vol: 0.45 });
      cap.textContent = h.cat === 'artifact' ? `Documenting the ${nm}: photographs and measurements only` : h.cat === 'fossil' ? `Scanning the ${nm}` : `Analysing ${nm}${h.take > 1 ? ` ×${h.take}` : ''}`;
      // the analysis: spinning ring, a dancing spectrum, a filling bar
      let lastQ = -1;
      const T = (h.cat === 'artifact' ? 1.5 : 1.15) * k * (h.cat === 'sample' || h.cat === 'flora' ? clamp(fx10.sampleTime(), 0.3, 1) : 1);
      await new Promise<void>(res => {
        let t = 0;
        os.animate(dt => {
          t += dt;
          const f = Math.min(1, t / T);
          bar.set((i + f) / N, `${i + 1} of ${N} · ${Math.round(f * 100)}%`);
          bars.forEach((x, j) => { x.style.height = (12 + Math.abs(Math.sin(t * (5 + j * 0.7) + j * 1.3)) * 70 * (1 - f * 0.5)) + '%'; });
          const qq = Math.floor(f * 7);
          if (qq !== lastQ) { lastQ = qq; sfx.tick(qq); if (!gone()) { const c = os.center(scope); os.fx.sparkle(c.x + (Math.random() - 0.5) * 60, c.y + (Math.random() - 0.5) * 50, 2, 30); } }
          if (f >= 1 || gone()) { res(); return false; }
          return true;
        });
      });
      if (gone()) return;
      const out = handIn(h.id, h.take);
      qs[i].classList.remove('on');
      if (!out) { qs[i].classList.add('done', 'miss'); continue; }
      ses.items.push(out);
      ses.rp += out.rp;
      sfx.beep();
      bars.forEach(x => { x.style.height = '8%'; });
      // the verdict
      const c = os.center(scope);
      if (out.taonga) {
        stamp.className = 'stamp care'; stamp.innerHTML = `Taonga<small>kept safe at camp</small>`;
        audio.play('fact', { vol: 0.4 });
        os.fx.sparkle(c.x, c.y, 10, 70);
      } else if (out.first) {
        stamp.className = 'stamp new'; stamp.innerHTML = `New ${CAT_WORD[out.cat] ?? 'find'}!<small>${out.edible ? (out.edible === 'safe' ? 'safe to eat ✓' : out.edible === 'mild' ? 'mildly poisonous ✕' : 'POISONOUS ✕') : esc(nm)}</small>`;
        audio.play('discover', { vol: 0.5 });
        if (out.firstOfCat) os.fx.confetti(c.x, c.y - scope.offsetHeight / 2, 50, scope.offsetWidth);
        os.fx.sparkle(c.x, c.y, 14, 110);
      } else if (out.reps) {
        stamp.className = 'stamp rep'; stamp.innerHTML = `Replicate${out.reps > 1 ? 's' : ''} ×${out.reps}`;
        sfx.star();
      } else { stamp.className = 'stamp filed'; stamp.textContent = 'Filed'; sfx.press(); }
      if (out.rp) os.floatText(c.x, c.y - 40, `+${out.rp} RP`, '#ffe27a');
      resultCard(feed, out);
      await wait((out.first ? 850 : 480) * k);
      if (gone()) return;
      // into the crate
      flyTo(dish, crate);
      await wait(380 * k);
      inCrate += out.n;
      crateN.textContent = String(inCrate);
      os.retrigger(crate, 'bump');
      audio.play('collectPop', { vol: 0.35, pitch: 0.9 });
      qs[i].classList.add('done', out.first ? 'hit' : 'miss');
      os.refresh();
      os.badges();
    }
    bar.set(1, `${plural(N, 'item')} analysed`);
    cap.textContent = `${plural(inCrate, 'specimen')} in the research crate`;
    await wait(500);
  };
  /** a little copy of the dish image flies into the crate */
  const flyTo = (src: HTMLImageElement, dst: HTMLElement) => {
    if (!b) return;
    const a = src.getBoundingClientRect(), z = dst.getBoundingClientRect(), r = b.getBoundingClientRect();
    if (!a.width || !z.width) return;
    const f = el('img', 'up-fly') as HTMLImageElement;
    f.src = src.src;
    const k = b.offsetWidth / (r.width || 1);
    f.style.cssText = `left:${(a.left - r.left) * k}px;top:${(a.top - r.top) * k}px;width:${a.width * k}px;height:${a.height * k}px`;
    b.appendChild(f);
    requestAnimationFrame(() => {
      f.style.transform = `translate(${(z.left + z.width / 2 - a.left - a.width / 2) * k}px,${(z.top + z.height * 0.35 - a.top - a.height / 2) * k}px) scale(0.35) rotate(${Math.random() < 0.5 ? -40 : 40}deg)`;
      f.style.opacity = '0.2';
    });
    setTimeout(() => f.remove(), 520);
  };
  const resultCard = (feed: HTMLElement, o: LabOutcome) => {
    const extra: string[] = [];
    if (o.species) extra.push(o.species.documented ? `Matches the <b>${esc(o.species.name)}</b>` : 'Points to an animal nobody has photographed yet');
    if (o.clue) extra.push(`${o.clue.isNew ? 'New clue' : 'Clue'}: <b>${esc(CLUE_BY_ID[o.clue.id]?.name ?? o.clue.name)}</b>`);
    if (o.fact) extra.push(`✦ ${esc(o.fact)}`);
    if (o.edible && !o.first) extra.push(o.edible === 'safe' ? 'Safe to eat ✓' : 'Not safe to eat ✕');
    const card = el('div', 'ln lab ' + (o.taonga ? 'care' : o.first ? 'ok' : 'rep'),
      `<img src="${itemSrc(o.id)}" alt=""><div><b>${esc(o.name)}${o.n > 1 ? ` ×${o.n}` : ''}</b>${o.first && !o.taonga ? ' <span class="tag">NEW</span>' : ''}${o.rp ? `<em class="rp">+${o.rp} RP</em>` : ''}<small>${esc(o.text)}</small>${o.lines.length ? `<small class="ms">${o.lines.map(esc).join(' · ')}</small>` : ''}${extra.map(x => `<small class="x">${x}</small>`).join('')}</div>`);
    feed.appendChild(card);
    feed.scrollTop = feed.scrollHeight;
  };

  // ---- (3) field notes
  const filing = async (stage: HTMLElement, notes: Discovery[], ses: Session) => {
    stage.innerHTML = `<div class="notes10"><div class="nb"><h4>Filing field notes</h4><div class="pile"></div></div></div>`;
    const pile = stage.querySelector('.pile') as HTMLElement;
    const k0 = clamp(6 / notes.length, 0.4, 1);
    for (const d of notes) {
      if (gone()) return;
      const k = k0 * fastK;
      const loc = location(d.loc);
      const card = el('div', 'note-card', `<img src="${icon10URL(placeIcon(d.kind))}" alt=""><div><b>${esc(d.name)}</b><i>${esc(kindLabel(d.kind))}${loc ? ' · ' + esc(loc.name) : ''} · day ${d.day}</i>${d.note ? `<small>${esc(d.note)}</small>` : ''}</div><span class="st">Filed</span>`);
      pile.appendChild(card);
      card.scrollIntoView?.({ block: 'nearest' });
      audio.play('pageTurn', { vol: 0.4 });
      await wait(380 * k);
      const rp = fileNote(d);
      ses.notes.push({ d, rp });
      ses.rp += rp;
      card.classList.add('done');
      sfx.pop(ses.notes.length);
      const c = os.center(card);
      if (rp) os.floatText(c.x + card.offsetWidth * 0.3, c.y - 10, `+${rp} RP`, '#ffe27a');
      os.fx.sparkle(c.x + card.offsetWidth * 0.36, c.y, 6, 50);
      await wait(320 * k);
    }
    os.refresh();
    await wait(400);
  };

  // ---- (4) the day report
  const report = (stage: HTMLElement, ses: Session) => {
    const paid = ses.bonus;
    const arts = ses.items.filter(o => o.cat === 'artifact'), fos = ses.items.filter(o => o.cat === 'fossil'), smp = ses.items.filter(o => o.cat === 'sample' || o.cat === 'flora');
    const places = ses.notes.filter(n => ['location', 'landmark', 'village', 'ruin', 'cave', 'ecosystem'].includes(n.d.kind));
    const names = (l: string[], max = 4) => l.slice(0, max).map(esc).join(', ') + (l.length > max ? ` +${l.length - max}` : '');
    const rows: [string, number, string][] = [
      ['Photos uploaded', ses.photos, ses.ok ? `${ses.ok} with something identified` : ses.photos ? 'nothing identifiable, sadly' : ''],
      ['New species', ses.species.length, names(ses.species.map(s => SPECIES_BY_ID[s]?.name ?? s))],
      ['Behaviours recorded', ses.beh.length, names([...new Set(ses.beh.map(([s, k]) => SPECIES_BY_ID[s]?.behaviors[k] ?? k))])],
      ['Findings', ses.facts.length, names(ses.facts.map(([, f]) => f.cat))],
      ['Samples analysed', smp.length, names(smp.map(o => o.name))],
      ['Artifacts documented', arts.length, names(arts.map(o => o.name))],
      ['Fossils catalogued', fos.length, names(fos.map(o => o.name))],
      ['Places filed', places.length, names(places.map(n => n.d.name))],
      ['Other field notes', ses.notes.length - places.length, names(ses.notes.filter(n => !places.includes(n)).map(n => n.d.name))],
    ];
    const day = daySum();
    const wk = weekTargets();
    stage.innerHTML = `<div class="up-rep"><div class="hd"><span class="ms"></span><div><b>Day ${ses.day} report</b><span>Sent to the Zealandia Expedition Agency${day.sessions > 1 ? ` · today so far: ${day.rp} RP over ${day.sessions} uploads` : ''}</span></div></div>
      <div class="rows">${rows.filter(r => r[1] > 0).map(([l, n, x]) => `<div class="rw"><i data-n="${n}">0</i><span><b>${l}</b>${x ? `<small>${x}</small>` : ''}</span></div>`).join('') || '<div class="rw none">Nothing new today. Tomorrow is another day.</div>'}</div>
      <div class="tot"><span>Research Points from the agency</span><b class="rp">+0 RP</b>${fx10.rpMult() !== 1 ? `<small>×${fx10.rpMult().toFixed(2)} agency rate</small>` : ''}${paid ? `<small class="wb">includes the week ${wk.week} bonus: +${paid} RP</small>` : ''}</div>
      <div class="wk"><h5>Week ${wk.week} targets${wk.met ? ' <em>met!</em>' : ''}</h5>${wk.targets.map(t => `<div class="trow${t.have >= t.need ? ' ok' : ''}"><span>${esc(t.label)}</span><i><u style="width:${(Math.min(1, t.have / t.need) * 100).toFixed(0)}%"></u></i><b>${t.have}/${t.need}</b></div>`).join('')}<small>${wk.paid ? `Bonus paid: +${wk.bonus} RP base` : `Bonus when all are met: ${wk.bonus} RP`}</small></div>
      <div class="bt"><div class="gel green ctl enc">Open Encyclopedia</div><div class="gel ctl mail">ZEA Mail${unreadMail() ? ` (${unreadMail()} new)` : ''}</div><div class="gel glass ctl done">Done</div></div></div>`;
    (stage.querySelector('.hd .ms') as HTMLElement).appendChild(mascot(ses.species.length || arts.length || ses.rp > 40 ? 'wow' : ses.rp ? 'happy' : 'meh', 1.5));
    (stage.querySelector('.enc') as HTMLElement).addEventListener('click', e => { os.from(e.currentTarget as Element); os.open('enc', ses.species[0] ? 'sp:' + ses.species[0] : arts[0] ? 'it:' + arts[0].id : undefined); });
    (stage.querySelector('.mail') as HTMLElement).addEventListener('click', e => { os.from(e.currentTarget as Element); os.open('mail'); });
    (stage.querySelector('.done') as HTMLElement).addEventListener('click', () => { if (cameraRoll().length || pendingCount() || pendingNotes().length) render(); else os.closeWin('upall'); });
    // count up the rows, then the RP
    const rp = stage.querySelector('.tot .rp') as HTMLElement;
    const cnt = [...stage.querySelectorAll<HTMLElement>('.rows i[data-n]')];
    let t = 0, lastQ = -1;
    os.animate(dt => {
      t += dt;
      const f = Math.min(1, t / 1.3), e2 = 1 - Math.pow(1 - f, 3);
      cnt.forEach(x => { x.textContent = String(Math.round(+x.dataset.n! * e2)); });
      rp.textContent = `+${Math.round(ses.rp * e2)} RP`;
      const qq = Math.floor(e2 * 10);
      if (qq !== lastQ) { lastQ = qq; sfx.tick(qq); }
      if (f < 1) return stage.isConnected;
      os.retrigger(rp, 'bump');
      if (ses.rp) { sfx.win(); const c = os.center(rp); os.fx.confetti(c.x, c.y - 30, 60, 260); os.fx.sparkle(c.x, c.y, 16, 120); } else sfx.star();
      return false;
    });
  };

  return { open, refresh: () => { if (!busy && b?.isConnected && os.find('upall')) render(); } };
}
