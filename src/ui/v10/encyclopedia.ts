// MoriOS: the Zealandia Encyclopedia (V10, replaces the Research Log). Six categories with their
// completion and the whole book's; a list of entries per category (unknown ones as "???"); one page
// per entry. Species pages grow with every upload: the first photo gives the name, the photo and a
// first section, later photos reveal fx10.infoDepth() sections each and new behaviours one more
// (Habitat, Diet, Behaviour, Anatomy, Ecosystem connections with a little food web, Mori's notes,
// a fun fact). Specimen pages show the lab results; artifacts get cultural notes (taonga are kept
// safe at camp, to be returned to their village); places show their field notes. Fauna also has the
// whole food web of the documented species.

import { el } from '../ui';
import { game } from '../../game/game';
import { SPECIES_BY_ID } from '../../game/species';
import type { Species } from '../../game/species';
import { ITEMS } from '../../game/items';
import { count } from '../../game/inventory';
import { itemIconURL, ICON_IDS } from '../../art/itemicons';
import { location, LOCATIONS, discoveries } from '../../game/v10/regions';
import type { Discovery, LocationDef } from '../../game/v10/regions';
import { fx10 } from '../../game/v10/skills10';
import { isRisky, foodInfo } from '../../game/v10/forage10';
import {
  entry, coverOf, photosOf, setCover, markSeen, upload, secOf, r10, crateCount, returnedDay, isTaonga, itemCat,
  markEncSeen, filedDay, analysedTimes,
} from '../../game/v9/research9';
import type { OSCtx, ResearchApps } from '../v4/moriResearch';
import { esc, when, cropBg, boxStyle, padBox, STATUS, plural } from '../v4/moriResearch';
import { sfx, clamp } from '../v7/aeroFx';
import { icon10URL } from './icons10';
import {
  CATS, entries, catStat, overall, speciesSections, speciesProgress, catOfKey, discByKey, locByKey, kindLabel, placeIcon, faunaPool,
} from './encyData';
import type { Cat, EncEntry, Thumb } from './encyData';
import { tiesOf, ROLE_NAME, linksAmong } from './foodweb';
import type { Role } from './foodweb';

export interface EncApp { open(key?: string): void; refresh(): void }

const ROLE_SIDE: Record<Role, 'top' | 'bottom' | 'left' | 'right'> = { predator: 'top', thief: 'top', prey: 'bottom', victim: 'bottom', parasite: 'right', host: 'right', partner: 'left', rival: 'left' };
const ROLE_COL: Record<Role, string> = { predator: '#e8583a', thief: '#e8a020', prey: '#f0ae22', victim: '#e8a020', parasite: '#a05ad0', host: '#a05ad0', partner: '#3aa02a', rival: '#7a8aa0' };

/** a species' photo crop as a CSS background (its cover around the animal) */
function photoBg(id: string, aspect = 1, padK = 2.4): string {
  const cov = coverOf(id);
  if (!cov) return '';
  const sub = cov.subjects.find(s => s.species === id);
  return cropBg(cov.img, sub?.bbox ?? [0.3, 0.3, 0.7, 0.7], aspect, padK);
}
const hasItemIcon = (id: string) => ICON_IDS.items().includes(id);
/** an item icon <img> (the category glyph for items without art) */
function itemImg(id: string, cls = ''): string {
  const c = itemCat(id);
  const src = hasItemIcon(id) ? itemIconURL(id, 3) : icon10URL(c === 'flora' ? 'c_flora' : c === 'artifact' ? 'c_culture' : c === 'fossil' ? 'c_fossils' : 'c_samples');
  return `<img class="${cls}" src="${src}" alt="" draggable="false">`;
}
function thumbHtml(t: Thumb): string {
  if (t.t === 'item') return `<div class="th it">${itemImg(t.id)}</div>`;
  if (t.t === 'icon') return `<div class="th ic"><img src="${icon10URL(t.name)}" alt="" draggable="false"></div>`;
  if (t.t === 'photo') return `<div class="th" style="${photoBg(t.species, 4 / 3)}"></div>`;
  return '<div class="th q">?</div>';
}
const pctTxt = (p: number) => `${Math.floor(p)}%`;

export function encyclopediaApp(os: OSCtx, ra: ResearchApps): EncApp {
  let b: HTMLElement | null = null;
  let cat: Cat = 'fauna';
  let key: string | null = null;
  let web = false;
  let picking = false;
  const shown = new Set<string>();
  const live = () => !!b && b.isConnected && !os.closed();

  const open = (k?: string) => {
    if (k) { key = k; cat = catOfKey(k); web = false; picking = false; }
    if (os.find('enc') && live()) { render(); os.win('enc', '', 'enc', 0, 0, el('div')); return; }
    b = el('div', 'enc');
    b.dataset.direct = '1';
    const W = os.win('enc', 'Zealandia Encyclopedia', 'enc', 900, 590, b);
    if (!W) return;
    render();
  };

  // ---------------------------------------------------------------- frame: top bar, categories, list
  const render = () => {
    if (!b) return;
    const ov = overall();
    const list = entries(cat);
    if (!key || catOfKey(key) !== cat || !list.some(e => e.key === key)) key = (list.find(e => e.fresh) ?? list.find(e => e.known))?.key ?? null;
    b.innerHTML = `<div class="enc-top"><span class="bk"></span><b>Zealandia Encyclopedia</b><span class="ov"><i class="ring" style="--p:${ov.pct.toFixed(1)}%"></i><em>${pctTxt(ov.pct)}</em> complete</span></div>
      <div class="enc-body"><div class="enc-cats"></div><div class="enc-list"></div><div class="enc-page"></div></div>`;
    (b.querySelector('.bk') as HTMLElement).appendChild(os.icon('enc', 1.2));
    const cats = b.querySelector('.enc-cats') as HTMLElement;
    for (const c of CATS) {
      const st = ov.stats.find(s => s.cat === c.id)!;
      const t = el('div', 'enc-cat ctl' + (c.id === cat ? ' on' : ''), `<img src="${icon10URL(c.icon)}" alt=""><span class="nm">${esc(c.name)}</span><span class="pc">${pctTxt(st.pct)}</span><i class="bar"><u style="width:${st.pct.toFixed(1)}%"></u></i>${st.fresh ? `<span class="nw">${st.fresh}</span>` : ''}`);
      t.addEventListener('click', () => { if (cat === c.id && !web) return; cat = c.id; key = null; web = false; picking = false; sfx.pick(); render(); });
      cats.appendChild(t);
    }
    renderList(list);
    renderPage();
  };

  const renderList = (list: EncEntry[]) => {
    const L = b!.querySelector('.enc-list') as HTMLElement;
    const st = catStat(cat);
    const c = CATS.find(x => x.id === cat)!;
    L.innerHTML = `<div class="hd"><b>${esc(c.name)}</b><span>${st.known} of ${st.total}</span></div>`;
    if (cat === 'fauna') {
      const wb = el('div', 'gel sm glass ctl wbtn' + (web ? ' on' : ''), web ? '◀ Back to pages' : 'Food web ✦');
      wb.addEventListener('click', () => { web = !web; sfx.menu(); renderListHead(); renderPage(); });
      L.appendChild(wb);
    }
    if (!list.length) { L.appendChild(el('div', 'enc-none', esc(c.empty))); return; }
    let popI = 0;
    for (const e of list) {
      const card = el('div', 'enc-card ctl' + (e.key === key && !web ? ' on' : '') + (e.fresh ? ' fresh' : '') + (e.known ? '' : ' unk'),
        `${thumbHtml(e.thumb)}<div class="tx"><b>${esc(e.name)}</b><i>${esc(e.state ?? e.sub)}</i><span class="pb"><u style="width:${(e.progress * 100).toFixed(0)}%"></u></span></div>`);
      if (e.known && !shown.has(e.key)) { card.classList.add('pop'); card.style.animationDelay = Math.min(popI++, 12) * 60 + 'ms'; shown.add(e.key); }
      card.addEventListener('click', () => {
        if (key === e.key && !web) return;
        key = e.key; web = false; picking = false;
        sfx.pick();
        L.querySelectorAll('.enc-card.on').forEach(x => x.classList.remove('on'));
        card.classList.add('on');
        renderListHead();
        renderPage();
      });
      L.appendChild(card);
    }
    L.querySelector('.enc-card.on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
  const renderListHead = () => {
    const wb = b?.querySelector('.wbtn') as HTMLElement | null;
    if (wb) { wb.classList.toggle('on', web); wb.textContent = web ? '◀ Back to pages' : 'Food web ✦'; }
    if (web) b?.querySelectorAll('.enc-card.on').forEach(x => x.classList.remove('on'));
  };

  // ---------------------------------------------------------------- pages
  const renderPage = () => {
    const pg = b!.querySelector('.enc-page') as HTMLElement;
    pg.scrollTop = 0;
    if (cat === 'fauna' && web) { bigWeb(pg); return; }
    if (!key) { emptyPage(pg); return; }
    const e = entries(cat).find(x => x.key === key);
    if (!e || !e.known) { lockedPage(pg, e ?? null); return; }
    if (key.startsWith('sp:')) speciesPage(pg, key.slice(3));
    else if (key.startsWith('it:')) itemPage(pg, key.slice(3), e);
    else if (key.startsWith('loc:')) { const l = locByKey(key); if (l) locPage(pg, l); }
    else { const d = discByKey(key); if (d) discPage(pg, d); }
    if (e.fresh && !key.startsWith('sp:')) {
      markEncSeen(key);
      celebrate(pg);
      os.badges();
      const card = b!.querySelector('.enc-card.on');
      card?.classList.remove('fresh');
      refreshCats();
    }
  };
  const refreshCats = () => {
    if (!b) return;
    const ov = overall();
    b.querySelectorAll<HTMLElement>('.enc-cat').forEach((t, i) => {
      const st = ov.stats[i];
      const nw = t.querySelector('.nw');
      if (!st.fresh) nw?.remove(); else if (nw) nw.textContent = String(st.fresh);
    });
  };
  const celebrate = (pg: HTMLElement) => setTimeout(() => {
    if (!pg.isConnected) return;
    const h = (pg.querySelector('.rl-hero, .enc-hero') as HTMLElement | null) ?? pg;
    const c = os.center(h);
    os.fx.confetti(c.x, c.y - h.offsetHeight / 2, 40, h.offsetWidth * 0.7);
    os.fx.sparkle(c.x, c.y, 12, 110);
    sfx.win();
  }, 240);
  const goto = (k: string) => { key = k; cat = catOfKey(k); web = false; picking = false; sfx.pick(); render(); };
  /** a link to another entry (a button if it is documented, plain text if not) */
  const link = (k: string, label: string) => {
    const known = entries(catOfKey(k)).some(e => e.key === k && e.known && e.progress > 0.1);
    return known ? `<span class="enc-ln ctl" data-k="${esc(k)}">${esc(label)} ›</span>` : `<span class="enc-ln off">${esc(label)}</span>`;
  };
  const wireLinks = (pg: HTMLElement) => pg.querySelectorAll<HTMLElement>('.enc-ln.ctl').forEach(a => a.addEventListener('click', () => { os.from(a); goto(a.dataset.k!); }));

  const emptyPage = (pg: HTMLElement) => {
    const c = CATS.find(x => x.id === cat)!;
    pg.innerHTML = `<div class="rl-empty"><img class="big" src="${icon10URL(c.icon)}" alt=""><b>${esc(c.name)}: nothing here yet</b><span>${esc(c.empty)}</span></div>`;
  };
  const lockedPage = (pg: HTMLElement, e: EncEntry | null) => {
    const c = CATS.find(x => x.id === cat)!;
    const hint = cat === 'fauna' ? `Somewhere out there is ${e?.sub ? (/^[AEIOU]/.test(e.sub) ? 'an ' : 'a ') + e.sub.toLowerCase() : 'an animal'} nobody has photographed yet.`
      : cat === 'places' ? `${e?.sub ?? 'Somewhere on the map'}: not found yet.` : c.empty;
    pg.innerHTML = `<div class="rl-empty locked"><div class="qq">?</div><b>Not discovered yet</b><span>${esc(hint)}</span></div>`;
  };

  // ---- species
  const speciesPage = (pg: HTMLElement, id: string) => {
    const sp = SPECIES_BY_ID[id], e = entry(id);
    if (!sp) return;
    if (!e) {
      // sighted / hinted, no photo yet
      const hint = !!game.save.hints[id];
      pg.innerHTML = `<div class="enc-hero sil"><div class="qq">?</div></div><div class="rl-title"><h2>${esc(sp.name)}</h2><i>${esc(sp.sci)}</i><div class="chips"><span>${esc(sp.group)}</span></div></div>
        <p class="blurb">${hint ? 'A sample handed in at camp points to this animal, but nobody has photographed one yet. Find it, and get a sharp, close shot.' : 'Sighted in the field, but not photographed yet. Upload a good photo to start its page.'}</p>`;
      return;
    }
    const cov = coverOf(id);
    const sub = cov?.subjects.find(s => s.species === id);
    const fresh = !!e.fresh;
    const behs = Object.entries(sp.behaviors);
    const firstRec = upload(e.first);
    const status = sp.research?.status ?? STATUS[clamp(sp.rarity, 1, 5)];
    const prog = speciesProgress(id);
    const pics = photosOf(id);
    pg.innerHTML = `<div class="rl-hero${fresh ? ' fresh' : ''}"><div class="ph">${cov ? '<img alt="" draggable="false"><div class="hl"></div>' : '<div class="gone">photo no longer stored</div>'}${fresh ? '<div class="nw">NEW!</div>' : ''}</div>
        <div class="cap"><span>${e.cover === e.first ? 'First documented' : 'Cover photo'} · ${cov ? when(cov) : when({ day: e.day, time: 'day' })}${firstRec && e.cover !== e.first ? ` <i>(first documented ${when(firstRec)})</i>` : ''}</span>${pics.length > 1 ? '<div class="gel sm glass ctl pick">Change cover</div>' : ''}</div><div class="picker"></div></div>
      <div class="rl-title"><h2>${esc(sp.name)}</h2><i>${esc(sp.sci)}</i><div class="chips"><span>${esc(sp.group)}</span><span>${esc(sp.size)}</span><span class="st">${esc(status)}</span>${sp.danger >= 2 ? '<span class="dg">Keep your distance</span>' : ''}</div></div>
      <div class="enc-prog"><span>Page complete</span><i><u style="width:${(prog * 100).toFixed(0)}%"></u></i><b>${Math.round(prog * 100)}%</b></div>
      <p class="blurb">${esc(sp.blurb)}</p>
      <div class="rl-sec beh"><h4>Behaviours <b>${e.beh.filter(x => x in sp.behaviors).length}/${behs.length}</b></h4><ul>${behs.map(([k, v]) => e.beh.includes(k) ? `<li class="ok"><i>✓</i>${esc(v)}${e.vid.includes(k) ? ' <small>on video</small>' : ''}</li>` : `<li><i>○</i>${esc(v)} <small>not photographed yet</small></li>`).join('')}</ul></div>
      <div class="rl-sheet"></div>
      <div class="rl-sec facts"></div>
      <div class="rl-sec pics"><h4>Photos <b>${pics.length}</b></h4><div class="strip"></div></div>`;
    if (cov) {
      (pg.querySelector('.rl-hero img') as HTMLImageElement).src = cov.img;
      const hl = pg.querySelector('.rl-hero .hl') as HTMLElement;
      if (sub) hl.setAttribute('style', boxStyle(padBox(sub.bbox))); else hl.remove();
    }
    sheet(pg.querySelector('.rl-sheet') as HTMLElement, sp);
    // findings
    const fs = pg.querySelector('.rl-sec.facts') as HTMLElement;
    if (sp.facts.length) {
      fs.innerHTML = `<h4>Findings <b>${e.facts.length}/${sp.facts.length}</b></h4><ul>${sp.facts.map(f => e.facts.includes(f.id)
        ? `<li class="ok"><i>✦</i><span><b>${esc(f.cat)}</b> ${esc(f.text)}</span></li>`
        : `<li class="lock"><i>?</i><span><b>${esc(f.q)}</b><small>${esc(f.hint)}</small></span></li>`).join('')}</ul>`;
    } else fs.remove();
    // photos
    const strip = pg.querySelector('.pics .strip') as HTMLElement;
    for (const u of pics.slice().reverse()) {
      const s2 = u.subjects.find(x => x.species === id);
      const t = el('div', 'pt ctl' + (u.id === e.cover ? ' on' : ''));
      t.setAttribute('style', cropBg(u.img, s2?.bbox ?? [0.3, 0.3, 0.7, 0.7], 16 / 10, 3));
      t.title = when(u);
      t.addEventListener('click', () => { os.from(t); ra.viewer(u.id); });
      strip.appendChild(t);
    }
    // cover picker
    const pk = pg.querySelector('.pick') as HTMLElement | null, picker = pg.querySelector('.picker') as HTMLElement;
    const fill = () => {
      picker.innerHTML = '<span>Pick a cover photo:</span>';
      for (const u of pics.slice().reverse()) {
        const s2 = u.subjects.find(x => x.species === id);
        const t = el('div', 'pt ctl' + (u.id === e.cover ? ' on' : ''), u.id === e.first ? '<i>1st</i>' : '');
        t.setAttribute('style', cropBg(u.img, s2?.bbox ?? [0.3, 0.3, 0.7, 0.7], 16 / 10, 3));
        t.addEventListener('click', () => {
          setCover(id, u.id);
          picking = false;
          sfx.pick();
          render();
          const h = b?.querySelector('.rl-hero .ph');
          if (h) { os.retrigger(h, 'flip'); const c = os.center(h); os.fx.sparkle(c.x, c.y, 12, 110); }
          os.refresh();
        });
        picker.appendChild(t);
      }
    };
    if (pk) pk.addEventListener('click', () => { picking = !picking; picker.classList.toggle('on', picking); if (picking) fill(); sfx.menu(); });
    if (picking) { picker.classList.add('on'); fill(); }
    wireLinks(pg);
    if (fresh) {
      markSeen(id);
      markEncSeen('sp:' + id);
      os.badges();
      b?.querySelector('.enc-card.on')?.classList.remove('fresh');
      refreshCats();
      celebrate(pg);
    }
  };

  /** the research sheet: revealed sections, then the locked ones as blurred placeholders */
  const sheet = (sh: HTMLElement, sp: Species) => {
    const secs = speciesSections(sp);
    const n = Math.min(secs.length, secOf(sp.id));
    const depth = Math.max(1, Math.round(fx10.infoDepth()));
    const parts: string[] = [];
    secs.forEach((s, i) => {
      if (i >= n) {
        const lines = 2 + ((sp.id.length + i) % 3);
        parts.push(`<div class="sec locked ${s.key}"><h5>🔒 ${esc(s.title)}</h5><div class="blur">${Array.from({ length: lines }, (_, j) => `<i style="width:${92 - ((j * 23 + i * 11) % 40)}%"></i>`).join('')}</div></div>`);
        return;
      }
      const body = s.list ? `<ul>${s.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : s.text ? `<p>${esc(s.text)}</p>` : '';
      parts.push(`<div class="sec ${s.key}${s.key === 'notes' ? ' notes' : ''}${s.fun ? ' fun' : ''}${s.web ? ' webs' : ''}"><h5>${s.fun ? '✦ ' : ''}${esc(s.title)}</h5>${body}${s.web ? '<div class="fweb"></div>' : ''}</div>`);
    });
    if (n < secs.length) parts.push(`<div class="sec nudge"><p>${secs.length - n} more ${secs.length - n === 1 ? 'section' : 'sections'} to reveal. Every new photo of the ${esc(sp.name)} uploads ${depth} more (Data Analysis depth ${depth}); every new behaviour, one more.</p></div>`);
    sh.innerHTML = parts.join('');
    const w = sh.querySelector('.fweb') as HTMLElement | null;
    if (w) { if (fx10.ecoLinks()) miniWeb(w, sp.id); else webTeaser(w, tiesOf(sp.id).length); }
  };

  /** without the Food-Web Mapping skill the links stay undrawn */
  const webTeaser = (w: HTMLElement, n: number) => {
    w.classList.add('locked');
    w.innerHTML = `<div class="tz"><b>🔒 ${plural(n, 'connection')} to map</b><span>Learn <em>Food-Web Mapping</em> (Data Analysis) and your uploads draw who eats whom, who lives on whom and who tags along.</span><div class="gel sm ctl skl">Open the Skill Tree</div></div>`;
    const k = w.querySelector('.skl') as HTMLElement;
    k.addEventListener('click', () => { os.from(k); os.open('skills', 'data_web'); });
  };

  /** a species and its ties in a little ring: predators above, prey below, parasites right, partners left */
  const miniWeb = (w: HTMLElement, id: string) => {
    const ties = tiesOf(id);
    const by: Record<'top' | 'bottom' | 'left' | 'right', typeof ties> = { top: [], bottom: [], left: [], right: [] };
    for (const t of ties) by[ROLE_SIDE[t.role]].push(t);
    const span: Record<string, [number, number]> = { top: [-150, -30], bottom: [30, 150], right: [-25, 25], left: [155, 205] };
    const nodes: { t: (typeof ties)[number]; x: number; y: number }[] = [];
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const l = by[side];
      let [a0, a1] = span[side];
      if (l.length > 3 && (side === 'left' || side === 'right')) { a0 -= 18; a1 += 18; }
      l.forEach((t, i) => {
        const a = ((l.length === 1 ? (a0 + a1) / 2 : a0 + ((a1 - a0) * i) / (l.length - 1)) * Math.PI) / 180;
        nodes.push({ t, x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 36 });
      });
    }
    const svg = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${nodes.map(n => `<line x1="50" y1="50" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}" stroke="${ROLE_COL[n.t.role]}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-dasharray="${entry(n.t.other) ? '' : '4 3'}"/>`).join('')}</svg>`;
    w.innerHTML = svg + `<div class="wn c" style="left:50%;top:50%;${photoBg(id)}"></div>`;
    for (const n of nodes) {
      const sp = SPECIES_BY_ID[n.t.other];
      const known = !!entry(n.t.other);
      const d = el('div', 'wn ctl' + (known ? '' : ' unk'), `${known ? '' : '?'}<span><b>${known ? esc(sp?.name ?? n.t.other) : '???'}</b><em style="color:${ROLE_COL[n.t.role]}">${esc(ROLE_NAME[n.t.role])}</em></span>`);
      d.style.cssText = `left:${n.x.toFixed(1)}%;top:${n.y.toFixed(1)}%;${known ? photoBg(n.t.other) : ''}`;
      if (n.t.label && known) d.title = n.t.label;
      d.addEventListener('click', () => {
        if (known) { os.from(d); goto('sp:' + n.t.other); return; }
        os.retrigger(d, 'mos-wiggle'); sfx.press();
        const c = os.center(d); os.floatText(c.x, c.y - 18, 'not documented yet', '#d8e8f8');
      });
      w.appendChild(d);
    }
    const known = ties.filter(t => entry(t.other)).length;
    w.insertAdjacentHTML('beforeend', `<div class="wcount">${known} of ${plural(ties.length, 'connection')} documented</div>`);
  };

  /** every documented species and the links between them, laid out like a spring model */
  const bigWeb = (pg: HTMLElement) => {
    const ids = faunaPool().map(s => s.id).filter(id => !!entry(id));
    if (!fx10.ecoLinks()) {
      const n = linksAmong(new Set(ids)).length;
      pg.innerHTML = `<div class="enc-webhd"><h2>Food web</h2><p>Every documented species and the links between them: predators, prey, parasites and partners.</p></div><div class="enc-bigweb fweb locked"></div>`;
      webTeaser(pg.querySelector('.enc-bigweb') as HTMLElement, n);
      return;
    }
    pg.innerHTML = `<div class="enc-webhd"><h2>Food web</h2><p>Who eats whom, who lives on whom, and who just tags along: every documented species and the links between them. Undocumented partners stay hidden until you photograph them.</p><div class="lg">${(['predator', 'parasite', 'partner', 'rival'] as Role[]).map(r => `<span><i style="background:${ROLE_COL[r]}"></i>${r === 'predator' ? 'eats' : r === 'parasite' ? 'parasite of' : r === 'partner' ? 'partners' : 'rivals'}</span>`).join('')}</div></div><div class="enc-bigweb"></div>`;
    const box = pg.querySelector('.enc-bigweb') as HTMLElement;
    if (ids.length < 2) { box.innerHTML = `<div class="rl-empty"><b>Not enough species yet.</b><span>Document a few animals that eat, host or follow each other and the web starts to draw itself.</span></div>`; return; }
    const set = new Set(ids);
    const links = linksAmong(set);
    // spring-electrical layout in a unit square (deterministic start)
    const P = ids.map((id, i) => { const a = (i / ids.length) * Math.PI * 2; return { id, x: 0.5 + Math.cos(a) * 0.35, y: 0.5 + Math.sin(a) * 0.35, vx: 0, vy: 0 }; });
    const idx = new Map(ids.map((id, i) => [id, i]));
    const k = Math.sqrt(1 / ids.length) * 0.7;
    for (let it = 0; it < 260; it++) {
      const t = 0.06 * (1 - it / 260) + 0.004;
      for (const p of P) { p.vx = 0; p.vy = 0; }
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i], c = P[j];
        let dx = a.x - c.x, dy = a.y - c.y;
        const d = Math.max(0.01, Math.hypot(dx, dy));
        const f = (k * k) / d;
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f; c.vx -= dx * f; c.vy -= dy * f;
      }
      for (const [a0, , b0] of links) {
        const a = P[idx.get(a0)!], c = P[idx.get(b0)!];
        const dx = a.x - c.x, dy = a.y - c.y, d = Math.max(0.01, Math.hypot(dx, dy));
        const f = (d * d) / k;
        a.vx -= (dx / d) * f; a.vy -= (dy / d) * f; c.vx += (dx / d) * f; c.vy += (dy / d) * f;
      }
      for (const p of P) {
        p.vx += (0.5 - p.x) * 0.6; p.vy += (0.5 - p.y) * 0.6;
        const v = Math.hypot(p.vx, p.vy) || 1;
        p.x = clamp(p.x + (p.vx / v) * Math.min(v, t), 0.06, 0.94);
        p.y = clamp(p.y + (p.vy / v) * Math.min(v, t), 0.08, 0.92);
      }
    }
    const pos = new Map(P.map(p => [p.id, p]));
    const relCol = (r: string) => (r === 'eats' ? ROLE_COL.predator : r === 'parasite' ? ROLE_COL.parasite : r === 'partner' ? ROLE_COL.partner : r === 'robs' ? ROLE_COL.thief : ROLE_COL.rival);
    box.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${links.map(([a, r, c]) => { const p = pos.get(a)!, q = pos.get(c)!; return `<line x1="${(p.x * 100).toFixed(1)}" y1="${(p.y * 100).toFixed(1)}" x2="${(q.x * 100).toFixed(1)}" y2="${(q.y * 100).toFixed(1)}" stroke="${relCol(r)}" stroke-width="2" vector-effect="non-scaling-stroke"/>`; }).join('')}</svg>`;
    P.forEach((p, i) => {
      const sp = SPECIES_BY_ID[p.id];
      const d = el('div', 'wn sm ctl', `<span><b>${esc(sp.name)}</b></span>`);
      d.style.cssText = `left:${(p.x * 100).toFixed(1)}%;top:${(p.y * 100).toFixed(1)}%;${photoBg(p.id)};animation-delay:${Math.min(i, 30) * 25}ms`;
      d.addEventListener('click', () => { os.from(d); goto('sp:' + p.id); });
      box.appendChild(d);
    });
    if (!links.length) box.insertAdjacentHTML('beforeend', '<div class="wcount">No links between these species yet: document their predators, prey and partners.</div>');
  };

  // ---- specimens
  const itemPage = (pg: HTMLElement, id: string, e: EncEntry) => {
    const d = ITEMS[id];
    if (!d) return;
    const rec = r10().lab[id];
    const c = itemCat(id);
    const taonga = isTaonga(id);
    const inCrate = crateCount(id), inPack = count(id), back = returnedDay(id);
    const times = analysedTimes(id);
    const disc = discoveries().find(x => x.id === id) ?? null;
    const where = disc ? location(disc.loc)?.name ?? null : null;
    const chips = [e.sub, taonga ? 'Taonga' : '', c === 'artifact' && !taonga ? 'Heritage' : ''].filter(Boolean);
    const status = back ? `Returned to its people (day ${back})` : inCrate ? `In the research crate at camp${inCrate > 1 ? ` ×${inCrate}` : ''}` : inPack ? `In your backpack ×${inPack}` : '';
    pg.innerHTML = `<div class="enc-hero spec${taonga ? ' taonga' : ''}"><div class="plinth">${itemImg(id, 'big')}</div><div class="tag"><b>${esc(rec?.lines[0] ?? 'Not catalogued yet')}</b>${(rec?.lines.slice(1) ?? []).map(l => `<span>${esc(l)}</span>`).join('')}${rec ? `<span>First analysed day ${rec.day}</span>` : ''}</div></div>
      <div class="rl-title"><h2>${esc(d.name)}</h2>${status ? `<i>${esc(status)}</i>` : ''}<div class="chips">${chips.map(x => `<span${x === 'Taonga' ? ' class="tg"' : ''}>${esc(x)}</span>`).join('')}${times > 1 ? `<span class="st">${times} specimens studied</span>` : ''}</div></div>
      <p class="blurb">${esc(d.desc)}</p>
      <div class="rl-sheet"></div>`;
    const sh = pg.querySelector('.rl-sheet') as HTMLElement;
    const parts: string[] = [];
    if (rec) {
      parts.push(`<div class="sec res"><h5>${taonga ? 'Documentation' : 'Analysis results'}${rec.generic ? ' <small>(best guess)</small>' : ''}</h5><p>${esc(rec.text)}</p></div>`);
      const lab = d.lab;
      if (lab?.species) {
        const sp = SPECIES_BY_ID[lab.species];
        if (sp) parts.push(`<div class="sec lnk"><h5>Points to</h5><p>${entry(sp.id) ? link('sp:' + sp.id, sp.name) : `An animal not documented yet${game.save.hints[sp.id] ? ` (the lab's guess: the ${esc(sp.name)})` : ''}. Photograph it to start its page.`}</p></div>`);
      }
      if (lab?.fact && !Object.values(SPECIES_BY_ID).some(s => s.facts.some(f => f.id === lab.fact))) parts.push(`<div class="sec fun"><h5>✦ Fun fact</h5><p>${esc(lab.fact)}</p></div>`);
    } else if (inPack) {
      parts.push(`<div class="sec nudge"><p>Hand it in at the camp laptop (Upload Everything) and the lab will analyse it.</p></div>`);
    } else if (disc) {
      parts.push(`<div class="sec res"><h5>Field note</h5><p>${esc(disc.note ?? 'Noted in the field.')}</p></div>`);
    }
    if (isRisky(id)) {
      // risky forage: what the research says about eating it (see v10/forage10)
      const fi = foodInfo(id);
      const txt = !fi.known ? 'Not identified yet: eating it is a gamble. Hand one in at camp and the lab will tell you.'
        : fi.tox === 0 ? `Safe to eat${fi.energy ? `: about ${fi.energy} energy` : ''}.` : fi.tox === 1 ? 'Mildly poisonous: a stomach ache at best. Better left alone.' : 'Poisonous. Do not eat it, whatever Chunk thinks.';
      parts.push(`<div class="sec ${!fi.known ? 'nudge' : fi.tox ? 'poison' : 'edible'}"><h5>${!fi.known ? 'Edible?' : fi.tox ? '✕ Not safe to eat' : '✓ Safe to eat'}</h5><p>${esc(txt)}</p></div>`);
    }
    if (c === 'artifact') parts.push(cultureNote(d.name, taonga, !!back));
    if (d.where || where) parts.push(`<div class="sec hab"><h5>Where it was found</h5><p>${esc(where ?? d.where ?? '')}${where && d.where ? ` · ${esc(d.where)}` : ''}</p></div>`);
    sh.innerHTML = parts.join('');
    wireLinks(pg);
  };

  /** the cultural note on an artifact page (taonga: respect, care and the way home) */
  const cultureNote = (name: string, taonga: boolean, back: boolean) => taonga
    ? `<div class="sec culture"><h5>Care &amp; respect</h5><p>This is a taonga: a treasure that belongs to the people whose ancestors made it, not a specimen. ${back ? 'It has gone home to its village.' : `The ${esc(name)} is kept wrapped and safe at camp, to be returned to the village.`} It was documented by photographs and measurements only: not cleaned, not sampled, not altered.</p><p>Its name, its maker and its story are for its people to tell. Aroha says the right thing to do is ask, and to listen.</p></div>`
    : `<div class="sec culture"><h5>Heritage</h5><p>Made and used by people, so it carries their history as well as its own. Recorded where it was found, handled as little as possible, and kept with the rest of the expedition's finds until the right people can be asked about it.</p></div>`;

  // ---- field notes and places
  const discPage = (pg: HTMLElement, d: Discovery) => {
    const loc = location(d.loc);
    const c = catOfKey('dc:' + d.id);
    const ic = c === 'places' ? placeIcon(d.kind) : c === 'fossils' ? 'c_fossils' : c === 'culture' ? 'c_culture' : c === 'flora' ? 'c_flora' : 'c_samples';
    pg.innerHTML = `<div class="enc-hero place"><img class="big" src="${icon10URL(ic)}" alt=""><div class="tag"><b>${esc(kindLabel(d.kind))}</b>${loc ? `<span>${esc(loc.name)}</span>` : ''}<span>Found day ${d.day} · filed day ${filedDay(d.id) || d.day}</span></div></div>
      <div class="rl-title"><h2>${esc(d.name)}</h2><div class="chips"><span>${esc(kindLabel(d.kind))}</span>${loc ? `<span>${esc(regionName(loc.region))}</span>` : ''}</div></div>
      <div class="rl-sheet">${d.note ? `<div class="sec notes"><h5>Mori’s field note</h5><ul><li>${esc(d.note)}</li></ul></div>` : ''}
      ${d.kind === 'artifact' ? cultureNote(d.name, /\b(taonga|village|marae|pounamu)\b/i.test(`${d.name} ${d.note ?? ''}`) || LOCATIONS.find(l => l.id === d.loc)?.kind === 'village', false).replace('is kept wrapped and safe at camp, to be returned to the village', 'stays exactly where it was found') : ''}
      ${d.kind === 'fossil' ? '<div class="sec res"><h5>Documented in place</h5><p>Photographed and measured where it lies: some things are worth more left in the rock they were found in.</p></div>' : ''}
      ${loc ? `<div class="sec hab"><h5>Location</h5><p>${link('loc:' + loc.id, loc.name)}</p></div>` : ''}</div>`;
    wireLinks(pg);
  };
  const regionName = (r: string) => ({ home: 'Home island', interior: 'The interior', south: 'The south', east: 'The east coast', ocean: 'Open ocean', isle2: 'The second island' } as Record<string, string>)[r] ?? r;
  const locPage = (pg: HTMLElement, l: LocationDef) => {
    const notes = discoveries().filter(d => d.loc === l.id && filedDay(d.id));
    const ups = game.save.uploads.filter(u => u.site === l.id);
    pg.innerHTML = `<div class="enc-hero place"><img class="big" src="${icon10URL(placeIcon(l.kind))}" alt=""><div class="tag"><b>${esc(kindLabel(l.kind))}</b><span>${esc(regionName(l.region))}</span><span>Route: ${'◆'.repeat(clamp(l.difficulty, 1, 5))}${'◇'.repeat(5 - clamp(l.difficulty, 1, 5))}</span></div></div>
      <div class="rl-title"><h2>${esc(l.name)}</h2><div class="chips"><span>${esc(kindLabel(l.kind))}</span><span>${esc(regionName(l.region))}</span></div></div>
      <p class="blurb">${esc(l.desc)}</p>
      <div class="rl-sheet">${notes.length ? `<div class="sec notes"><h5>Field notes here</h5><ul>${notes.map(d => `<li>${link('dc:' + d.id, d.name)} <small>(${esc(kindLabel(d.kind))})</small></li>`).join('')}</ul></div>` : '<div class="sec nudge"><p>No field notes filed here yet: explore it, and upload what you find.</p></div>'}</div>
      ${ups.length ? `<div class="rl-sec pics"><h4>Photos taken here <b>${ups.length}</b></h4><div class="strip"></div></div>` : ''}`;
    const strip = pg.querySelector('.pics .strip') as HTMLElement | null;
    if (strip) for (const u of ups.slice(-8).reverse()) {
      const t = el('div', 'pt ctl');
      t.setAttribute('style', `background-image:url(${u.img});background-size:cover;background-position:center`);
      t.title = when(u);
      t.addEventListener('click', () => { os.from(t); ra.viewer(u.id); });
      strip.appendChild(t);
    }
    wireLinks(pg);
  };

  return {
    open,
    refresh: () => { if (live()) render(); },
  };
}
