// Physical UI kit: a sampler book (dev only: zl.paper() in the console). Shows every piece of the
// kit on a few pages, so the modules that build on it can see what they get.

import { openBook } from './book';
import type { BookSection } from './book';
import { stamp, polaroid, sticky, scrap, checkbox, struck, marked, tallyMarks, tape, pin, clip, luggageTag } from './decor';
import { doodle, doodleNames, sketchImg } from './sketch';
import { svgInk, roughArrow, INK_RED } from './ink';
import { paperTex } from './textures';
import { speciesSprite } from '../../icons';

const DEMO_CSS = '.demo-p { font-size: 1.3em; line-height: 1.15; margin: 0 0 0.4em; } .demo-p.cont { margin-top: 0; }';
let styled = false;

export function paperDemo() {
  if (!styled) { styled = true; const st = document.createElement('style'); st.textContent = DEMO_CSS; document.head.appendChild(st); }
  const text = 'Every species tells a story about the others. The glass crab hides in plain sight; the seal snores like a foghorn in a cathedral; Chunk eats whatever the island offers. Notes go in pencil first, ink once we are sure. Some pages will get wet. That is fine: field notes that never got wet were never in the field.';
  const sections: BookSection[] = [
    { id: 'intro', head: { l: 'Kit sampler', r: 'Paper' }, blocks: () => [
      { html: '<h2 class="pp-head" style="font-size:1.8em;margin:0 0 0.2em">The paper kit</h2>', keep: true },
      { html: text, cls: 'pp-hand demo-p', split: true },
      { html: `<div style="display:flex;gap:0.6em;flex-wrap:wrap;margin-top:0.8em">${['journal', 'parchment', 'kraft', 'card', 'telex', 'flax', 'graph', 'blueprint', 'cork', 'endpaper'].map(k => `<div style="width:3.4em;height:3.4em;background:${paperTex(k as 'journal')} 0 0/256px;box-shadow:0 1px 3px rgba(0,0,0,.4)" title="${k}"></div>`).join('')}</div>` },
      { html: `<p class="pp-hand" style="font-size:1.25em">${checkbox('done', 1)} Wake Jenna<br>${checkbox('now', 2)} ${marked('Find Chunk', { mode: 'under' })}<br>${checkbox('todo', 3)} ${struck('Panic', 4)}<br>${tallyMarks(7, 10)}</p>` },
      { html: `<div style="position:relative;height:7em">${stamp('Documented', { color: 'red' })} ${stamp('Day 3', { color: 'blue', shape: 'round', small: 'camp' })}</div>` },
      { html: `<div style="position:relative;height:9em;margin-top:1em">${polaroid(speciesSprite('glasscrab'), 'glass crab', { w: '8em', tape: true })} ${sticky('Remember: <b>H</b> to eat a snack', { w: '7em', style: 'margin-left:1em' })}</div>` },
      { html: `<div style="position:relative;height:6em">${scrap('<span class="pp-hand" style="font-size:1.2em">a torn scrap of flax paper</span>', { kind: 'flax', w: '12em' })}${pin({ style: 'left:5.5em;top:-0.3em' })}</div>` },
      { html: `<div style="display:flex;flex-wrap:wrap;gap:0.4em">${doodleNames().map(n => doodle(n, { size: '2.6em', pencil: n.length % 2 === 0 })).join('')}</div>` },
      { html: `<div style="display:flex;gap:0.5em;align-items:flex-end;flex-wrap:wrap">${['corvexseal', 'glasscrab', 'duskwaddler', 'shellwrench', 'trycop', 'jewelhornet'].map((id, i) => sketchImg(speciesSprite(id), { size: 240, style: i === 1 ? 'ink' : 'pencil', box: ['7.5em', '5em'] })).join('')}</div>` },
      { html: `<div style="background:${paperTex('blueprint')} 0 0/256px;padding:0.6em;display:flex;gap:0.6em">${sketchImg(speciesSprite('trycop'), { size: 220, style: 'blueprint', box: ['9em', '5em'] })}<span class="pp-pix" style="color:#e8f2ff">BLUEPRINT STYLE</span></div>` },
      { html: `${text} ${text}`, cls: 'pp-hand demo-p', split: true },
      { html: `<div style="position:relative;height:5em">${luggageTag('<span class="pp-hand" style="font-size:1.2em">E: look closer</span>')} ${clip({ style: 'left:12em;top:0' })}${tape({ style: 'left:16em;top:1em' })}${svgInk(100, 40, roughArrow(5, 30, 90, 10, 0.2).map(d => ({ d, c: INK_RED, w: 2.4 })), { w: '6em', h: '2.4em' })}</div>` },
    ] },
    { id: 'more', head: { l: 'Kit sampler', r: 'More pages' }, blocks: () => Array.from({ length: 8 }, (_, i) => ({ html: `${i + 1}. ${text}`, cls: 'pp-hand demo-p', split: true })) },
  ];
  return openBook({
    id: 'demo', key: 'KeyK',
    look: { title: 'Paper Kit', sub: 'Sampler', color: '#3a5a3a', material: 'cloth', foil: '#e8d090', corners: true, label: 'property of the art dept.' },
    sections,
    tabs: [{ id: 'a', label: 'Intro', color: '#e8b84a', section: 'intro' }, { id: 'b', label: 'More', color: '#8ac0e0', section: 'more' }],
    ribbons: [{ section: 'more', color: '#a8321e', label: 'More' }],
  });
}
