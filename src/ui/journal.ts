// The Zealandia Field Guide: species cards, detail pages, evidence and deduction puzzles.

import { game } from '../game/game';
import { SPECIES, SPECIES_BY_ID, CLUES, Species, Fact, Group, ALL_FACTS } from '../game/species';
import { factState, evidenceLabel, hasEvidence, solveFact, FACT_RP } from '../game/research';
import { SITE_NAMES } from '../game/story';
import { TIME_LABEL } from '../world/timeofday';
import { el } from './ui';
import { iconURL, speciesSprite } from './icons';
import { audio } from '../core/audio';

type Tab = 'all' | Group | 'album' | 'clues';

const CSS = `
.journal { width: min(1120px, 96vw); height: min(700px, 92vh); display: grid; grid-template-columns: 13em 1fr; background: var(--paper); color: var(--pencil); position: relative;
  box-shadow: 0 0 0 3px #5a4526, 0 0 0 6px #2b1f12, 0 20px 60px rgba(0,0,0,0.6); border-radius: 6px; overflow: hidden; font-family: var(--body); }
.journal::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, transparent 0 27px, rgba(80, 110, 140, 0.13) 27px 28px); }
.j-side { background: #2c2217; color: var(--paper); padding: 1.2em 0.9em; display: flex; flex-direction: column; gap: 0.35em; position: relative; z-index: 1; }
.j-side h1 { font-family: var(--pix); font-size: 1.35em; margin: 0 0 0.1em; color: var(--amber2); line-height: 1.1; text-wrap: balance; }
.j-side .sub { font-family: var(--hand); font-size: 0.95em; opacity: 0.8; margin-bottom: 0.8em; }
.j-tab { font-family: var(--pix); text-align: left; background: transparent; color: var(--paper); border: 0; padding: 0.45em 0.6em; cursor: pointer; font-size: 1em; display: flex; justify-content: space-between; border-radius: 3px; }
.j-tab:hover { background: rgba(255,255,255,0.07); }
.j-tab.on { background: var(--amber); color: var(--ink); }
.j-tab .c { opacity: 0.7; font-variant-numeric: tabular-nums; }
.j-prog { margin-top: auto; font-size: 0.85em; line-height: 1.6; }
.j-prog .bar { height: 7px; background: rgba(255,255,255,0.12); margin: 3px 0 8px; }
.j-prog .bar div { height: 100%; background: var(--teal); }
.j-main { overflow-y: auto; padding: 1.4em 1.6em 2em; position: relative; z-index: 1; }
.j-main h2 { font-family: var(--hand); font-weight: 700; font-size: 1.9em; color: #3a2a18; margin: 0 0 0.2em; }
.j-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5em, 1fr)); gap: 1em; }
.j-card { background: #fbf6e6; border: 1px solid #d4c49b; padding: 0.6em; cursor: pointer; transform: rotate(var(--rot)); transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 3px 6px rgba(60,40,10,0.18); display: flex; flex-direction: column; gap: 0.3em; position: relative; }
.j-card:hover { transform: rotate(0deg) translateY(-3px); box-shadow: 0 8px 16px rgba(60,40,10,0.25); }
.j-card .pic { height: 6.4em; display: flex; align-items: center; justify-content: center; background: #e9e0c6; overflow: hidden; }
.j-card .pic img { max-width: 100%; max-height: 100%; image-rendering: pixelated; }
.j-card .pic img.sil { filter: brightness(0) opacity(0.55); }
.j-card .pic img.photo { width: 100%; height: 100%; object-fit: cover; }
.j-card .nm { font-family: var(--pix); font-size: 0.95em; color: #2a2014; }
.j-card .meta { font-size: 0.78em; opacity: 0.75; display: flex; justify-content: space-between; }
.j-card .dots { display: flex; gap: 3px; }
.j-card .dots i { width: 8px; height: 8px; border-radius: 50%; background: #d8cba6; }
.j-card .dots i.s { background: var(--teal); }
.j-card .dots i.r { background: var(--amber); box-shadow: 0 0 0 2px rgba(244,180,60,0.35); animation: pulse 1.2s infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 0 4px rgba(244,180,60,0.1); } }
.j-card .ribbon { position: absolute; top: 6px; right: -4px; background: var(--amber); color: var(--ink); font-family: var(--pix); font-size: 0.7em; padding: 1px 6px; }
.j-detail { display: grid; grid-template-columns: minmax(15em, 22em) 1fr; gap: 1.6em; align-items: start; }
.polaroid { background: #fff; padding: 0.6em 0.6em 2.2em; box-shadow: 0 6px 14px rgba(0,0,0,0.25); transform: rotate(-2deg); position: relative; }
.polaroid img { width: 100%; display: block; image-rendering: pixelated; background: #cfc6ad; aspect-ratio: 16/9; object-fit: cover; }
.polaroid .cap { position: absolute; left: 0.8em; bottom: 0.4em; font-family: var(--hand); font-size: 1.1em; color: #333; }
.polaroid .stars { position: absolute; right: 0.8em; bottom: 0.5em; color: var(--amber); font-size: 1em; letter-spacing: 1px; }
.tape { position: absolute; top: -10px; left: 40%; width: 70px; height: 20px; background: rgba(240, 220, 150, 0.7); transform: rotate(4deg); }
.j-info h2 { margin: 0; }
.j-info .sci { font-family: var(--hand); font-size: 1.15em; color: #6a5436; margin-bottom: 0.6em; }
.j-info .blurb { font-size: 1em; line-height: 1.55; max-width: 60ch; margin-bottom: 0.9em; }
.stats { display: grid; grid-template-columns: max-content 1fr; gap: 0.25em 1em; font-size: 0.9em; margin-bottom: 1em; }
.stats dt { font-family: var(--pix); color: #7a6040; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.06em; }
.stats dd { margin: 0; }
.behs { display: flex; flex-wrap: wrap; gap: 6px; margin: 0.2em 0 1em; }
.behs span { font-size: 0.8em; padding: 2px 8px; border-radius: 10px; background: #e6dbbd; color: #7a6a4a; }
.behs span.ok { background: var(--teal); color: #07231e; }
.facts { display: flex; flex-direction: column; gap: 0.7em; }
.fact { border-left: 4px solid #d4c49b; padding: 0.4em 0.8em; background: rgba(255,255,255,0.45); }
.fact.solved { border-color: var(--teal); }
.fact.ready { border-color: var(--amber); background: rgba(244, 180, 60, 0.12); }
.fact .cat { font-family: var(--pix); font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.1em; color: #8a7050; }
.fact .txt { font-family: var(--hand); font-size: 1.15em; line-height: 1.35; color: #2a2014; }
.fact .ev { font-size: 0.8em; margin-top: 0.3em; display: flex; flex-direction: column; gap: 2px; color: #7a6a4a; }
.fact .ev .ok { color: #1f7a68; }
.j-back { font-family: var(--pix); background: none; border: 0; color: #7a5a30; cursor: pointer; font-size: 1em; margin-bottom: 0.6em; padding: 0; }
.deduce { width: min(640px, 94vw); padding: 1.4em 1.6em; background: var(--paper); color: var(--pencil); box-shadow: 0 0 0 3px #5a4526, 0 20px 50px rgba(0,0,0,0.6); border-radius: 6px; }
.deduce h3 { font-family: var(--pix); color: #8a5a20; margin: 0 0 0.2em; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; }
.deduce .q { font-family: var(--hand); font-size: 1.6em; line-height: 1.2; margin-bottom: 0.7em; color: #2a2014; text-wrap: balance; }
.deduce .cards { display: flex; gap: 0.8em; flex-wrap: wrap; margin-bottom: 1em; }
.deduce .ecard { background: #fff; padding: 0.4em; box-shadow: 0 3px 8px rgba(0,0,0,0.2); width: 11em; font-size: 0.8em; transform: rotate(var(--rot)); }
.deduce .ecard img { width: 100%; image-rendering: pixelated; display: block; background: #e9e0c6; aspect-ratio: 16/9; object-fit: contain; }
.deduce .opts { display: flex; flex-direction: column; gap: 0.5em; }
.deduce .opts button { text-align: left; font-family: var(--body); font-size: 1.05em; }
.deduce .fb { min-height: 1.5em; margin-top: 0.6em; font-family: var(--hand); font-size: 1.15em; }
.deduce.shake { animation: shake 0.35s; }
@keyframes shake { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
.album { display: grid; grid-template-columns: repeat(auto-fill, minmax(13em, 1fr)); gap: 1.2em; }
.album .polaroid { transform: rotate(var(--rot)); }
.album .polaroid .cap { font-size: 0.95em; }
.clue { display: flex; gap: 0.9em; align-items: flex-start; padding: 0.6em 0; border-bottom: 1px dashed #cdbd92; }
.clue img { width: 3em; image-rendering: pixelated; }
.clue b { font-family: var(--pix); font-weight: 500; }
.empty { font-family: var(--hand); font-size: 1.2em; opacity: 0.7; }
@media (max-width: 720px) { .journal { grid-template-columns: 1fr; } .j-side { flex-direction: row; flex-wrap: wrap; } .j-prog { display: none; } .j-detail { grid-template-columns: 1fr; } }
`;

let styled = false;
const rot = () => `${(Math.random() * 3 - 1.5).toFixed(2)}deg`;
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function openJournal(start: Tab | string = 'all') {
  if (!styled) {
    document.head.appendChild(el('style', '', CSS));
    styled = true;
  }
  audio.play('uiOpen');
  const root = el('div', 'journal');
  const side = el('div', 'j-side');
  const main = el('div', 'j-main');
  root.append(side, main);
  let tab: Tab = SPECIES_BY_ID[start] ? 'all' : (start as Tab);
  const close = game.ui.modal(root, () => game.persist());

  const renderSide = () => {
    const s = game.save;
    const seen = Object.keys(s.seen).length, facts = Object.keys(s.facts).length;
    side.innerHTML = `<h1>Zealandia Field Guide</h1><div class="sub">O. Finch — day ${s.day}</div>`;
    const tabs: [Tab, string, number][] = [
      ['all', 'All species', SPECIES.length], ['Serpent', 'Serpents', SPECIES.filter(x => x.group === 'Serpent').length],
      ['Bird', 'Birds', SPECIES.filter(x => x.group === 'Bird').length], ['Mammal', 'Mammals', SPECIES.filter(x => x.group === 'Mammal').length],
      ['Reptile', 'Reptiles', 1], ['album', 'Photo album', s.album.length], ['clues', 'Field clues', Object.keys(s.clues).length],
    ];
    for (const [t, label, n] of tabs) {
      const b = el('button', 'j-tab' + (tab === t ? ' on' : ''), `<span>${label}</span><span class="c">${n}</span>`);
      b.onclick = () => { tab = t; audio.play('pageTurn'); renderSide(); renderMain(); };
      side.appendChild(b);
    }
    const prog = el('div', 'j-prog', `Species documented ${seen}/${SPECIES.length}<div class="bar"><div style="width:${(seen / SPECIES.length) * 100}%"></div></div>Facts deduced ${facts}/${ALL_FACTS.length}<div class="bar"><div style="width:${(facts / ALL_FACTS.length) * 100}%"></div></div><span class="key">Esc</span> close`);
    side.appendChild(prog);
    const x = el('button', 'btn ghost', 'Close');
    x.style.marginTop = '0.6em';
    x.onclick = () => { audio.play('uiBack'); close(); };
    side.appendChild(x);
  };

  const card = (sp: Species) => {
    const s = game.save;
    const seen = !!s.seen[sp.id];
    const c = el('div', 'j-card');
    c.style.setProperty('--rot', rot());
    const best = s.best[sp.id];
    const pic = best ? `<img class="photo" src="${best.thumb}" alt="">` : `<img class="${seen ? '' : 'sil'}" src="${speciesSprite(sp.id)}" alt="">`;
    const dots = sp.facts.map(f => `<i class="${factState(f) === 'solved' ? 's' : factState(f) === 'ready' ? 'r' : ''}"></i>`).join('');
    const ready = sp.facts.some(f => factState(f) === 'ready');
    c.innerHTML = `<div class="pic">${pic}</div><div class="nm">${seen ? sp.name : '???'}</div><div class="meta"><span>${sp.group}</span><span class="dots">${dots}</span></div>${ready ? '<div class="ribbon">DEDUCE!</div>' : ''}`;
    c.onclick = () => { audio.play('pageTurn'); detail(sp); };
    return c;
  };

  const renderMain = () => {
    main.innerHTML = '';
    main.scrollTop = 0;
    const s = game.save;
    if (tab === 'album') {
      main.appendChild(el('h2', '', 'Photo album'));
      if (!s.album.length) main.appendChild(el('div', 'empty', 'No photos yet. Grab the camera and head out with Bolt!'));
      const g = main.appendChild(el('div', 'album'));
      for (const p of [...s.album].reverse()) {
        const d = el('div', 'polaroid', `<div class="tape"></div><img src="${p.thumb}" alt=""><div class="cap">${p.species ? (s.seen[p.species] ? SPECIES_BY_ID[p.species].name : '???') : 'Scenery'}${p.video ? ' (video)' : ''}</div><div class="stars">${stars(p.stars)}</div>`);
        d.style.setProperty('--rot', rot());
        g.appendChild(d);
      }
      return;
    }
    if (tab === 'clues') {
      main.appendChild(el('h2', '', 'Field clues'));
      const found = CLUES.filter(c => s.clues[c.id]);
      if (!found.length) main.appendChild(el('div', 'empty', 'Look for sparkling things on expeditions: tracks, skins, shells. Press E to collect them.'));
      for (const c of found) main.appendChild(el('div', 'clue', `<img src="${iconURL(c.icon)}" alt=""><div><b>${c.name}</b><br><span style="font-size:0.9em">${c.desc}</span><br><i style="font-size:0.8em;opacity:0.7">Found at ${SITE_NAMES[c.site]}</i></div>`));
      return;
    }
    main.appendChild(el('h2', '', tab === 'all' ? 'Species of Zealandia' : tab + 's'));
    const g = main.appendChild(el('div', 'j-grid'));
    for (const sp of SPECIES) if (tab === 'all' || sp.group === tab) g.appendChild(card(sp));
  };

  const detail = (sp: Species) => {
    const s = game.save;
    const seen = !!s.seen[sp.id];
    main.innerHTML = '';
    main.scrollTop = 0;
    const back = el('button', 'j-back', '◀ Back to the guide');
    back.onclick = () => { audio.play('pageTurn'); renderMain(); };
    main.appendChild(back);
    const d = main.appendChild(el('div', 'j-detail'));
    const best = s.best[sp.id];
    const pol = el('div', 'polaroid', `<div class="tape"></div><img src="${best ? best.thumb : speciesSprite(sp.id)}" alt="" style="${best ? '' : 'object-fit:contain;padding:1em;' + (seen ? '' : 'filter:brightness(0) opacity(0.5)')}"><div class="cap">${seen ? sp.name : 'Not yet photographed'}</div>${best ? `<div class="stars">${stars(best.stars)}</div>` : ''}`);
    d.appendChild(pol);
    const info = d.appendChild(el('div', 'j-info'));
    const sites = sp.sites.map(x => (s.sites.includes(x) ? SITE_NAMES[x] : '???')).join(', ');
    info.innerHTML = `<h2>${seen ? sp.name : '???'}</h2><div class="sci">${seen ? sp.sci : 'Unidentified'}</div>
      <div class="blurb">${seen ? sp.blurb : 'Photograph this animal to identify it.'}</div>
      <dl class="stats"><dt>Group</dt><dd>${sp.group}</dd><dt>Size</dt><dd>${seen ? sp.size : '?'}</dd><dt>Found at</dt><dd>${sites}</dd>
      <dt>Active</dt><dd>${seen ? sp.times.map(t => TIME_LABEL[t]).join(', ') : '?'}</dd><dt>Rarity</dt><dd style="color:#c08a20">${stars(sp.rarity)}</dd>
      <dt>Danger</dt><dd>${['Harmless', 'Keep your distance', 'Dangerous', 'Deadly — stay hidden'][sp.danger]}</dd></dl>
      <div class="cat pix" style="font-size:0.8em;letter-spacing:0.1em;color:#8a7050;text-transform:uppercase">Behaviours observed</div>`;
    const behs = info.appendChild(el('div', 'behs'));
    for (const [k, v] of Object.entries(sp.behaviors)) {
      const ok = s.evPhoto[`${sp.id}:${k}`] || s.evVideo[`${sp.id}:${k}`];
      behs.appendChild(el('span', ok ? 'ok' : '', ok ? '✓ ' + v : seen ? v : '???'));
    }
    const facts = info.appendChild(el('div', 'facts'));
    for (const f of sp.facts) facts.appendChild(factRow(sp, f));
  };

  const factRow = (sp: Species, f: Fact) => {
    const st = factState(f);
    const row = el('div', 'fact ' + st);
    const evHtml = f.evidence.map(e => `<span class="${hasEvidence(e) ? 'ok' : ''}">${hasEvidence(e) ? '✓' : '○'} ${evidenceLabel(e)}</span>`).join('');
    if (st === 'solved') row.innerHTML = `<div class="cat">${f.cat}</div><div class="txt">${f.text}</div>`;
    else if (st === 'ready') {
      row.innerHTML = `<div class="cat">${f.cat} — evidence complete</div><div class="txt">${f.q}</div><div class="ev">${evHtml}</div>`;
      const b = el('button', 'btn', 'Deduce!');
      b.style.marginTop = '0.5em';
      b.onclick = () => deduce(sp, f);
      row.appendChild(b);
    } else row.innerHTML = `<div class="cat">${f.cat} — unknown</div><div class="txt" style="opacity:0.55">${f.q}</div><div class="ev">${evHtml}<span style="font-style:italic">Hint: ${f.hint}</span></div>`;
    return row;
  };

  const deduce = (sp: Species, f: Fact) => {
    audio.play('uiOpen');
    const box = el('div', 'deduce');
    const s = game.save;
    box.innerHTML = `<h3>Deduction — ${sp.name}</h3><div class="q">${f.q}</div>`;
    const cards = box.appendChild(el('div', 'cards'));
    for (const e of f.evidence) {
      let img = '';
      if (e.kind === 'clue') img = iconURL(CLUES.find(c => c.id === e.clue)?.icon ?? 'camera');
      else {
        const p = [...s.album].reverse().find(p => p.species === e.species && p.behavior === e.behavior) ?? [...s.album].reverse().find(p => p.species === e.species);
        img = p ? p.thumb : speciesSprite(e.species);
      }
      const c = el('div', 'ecard', `<img src="${img}" alt=""><div style="padding:0.3em 0.1em 0">${evidenceLabel(e)}</div>`);
      c.style.setProperty('--rot', rot());
      cards.appendChild(c);
    }
    const opts = box.appendChild(el('div', 'opts'));
    const fb = box.appendChild(el('div', 'fb'));
    const closeD = game.ui.modal(box);
    f.options.forEach((o, i) => {
      const b = el('button', 'btn ghost', o);
      b.style.color = 'var(--pencil)';
      b.style.boxShadow = 'inset 0 0 0 2px #cdbd92';
      b.onclick = () => {
        if (i === f.answer) {
          solveFact(f);
          fb.innerHTML = `<b style="color:#1f7a68">Correct!</b> ${f.text} <b>+${FACT_RP} RP</b>`;
          opts.querySelectorAll('button').forEach(x => ((x as HTMLButtonElement).disabled = true));
          b.style.background = 'var(--teal)';
          setTimeout(() => { closeD(); detail(sp); renderSide(); }, 1900);
        } else {
          audio.play('wrong');
          fb.innerHTML = 'Hmm. That doesn’t fit the evidence. Look again.';
          box.classList.remove('shake');
          void box.offsetWidth;
          box.classList.add('shake');
          b.disabled = true;
        }
      };
      opts.appendChild(b);
    });
  };

  renderSide();
  if (SPECIES_BY_ID[start]) detail(SPECIES_BY_ID[start]);
  else renderMain();
}
