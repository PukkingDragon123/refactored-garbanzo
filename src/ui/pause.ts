// Pause menu (Esc): a parchment board in the V3 pixel skin with icon buttons.

import { game } from '../game/game';
import { el } from './ui';
import { audio } from '../core/audio';
import { openJournal } from './journal';
import { openSettings } from '../game/scenes/title';

const CSS = `
.pz-pause { width: min(360px, 90vw); padding: 1.2em 1.2em 1.1em; display: flex; flex-direction: column; gap: 0.55em; }
.pz-pause h2 { text-align: center; margin: 0 0 0.1em !important; letter-spacing: 0.12em; }
.pz-pause .where { text-align: center; font-family: 'Silkscreen', var(--pix); font-size: 0.78em; color: #6a4a2a; margin-bottom: 0.4em; }
.pz-pause .btn { width: 100%; text-align: left; display: flex; align-items: center; gap: 0.6em; font-size: 1.02em; padding: 0.5em 0.8em; white-space: nowrap; }
.pz-pause .btn .ic { width: 1.5em; height: 1.5em; flex: none; image-rendering: pixelated; background: var(--ic) center / contain no-repeat; }
.pz-pause .btn::after { content: '▶'; margin-left: auto; opacity: 0; font-size: 0.8em; transition: opacity 0.15s; }
.pz-pause .btn:hover::after, .pz-pause .btn:focus-visible::after { opacity: 1; }
.pz-pause .sep { height: 2px; background: repeating-linear-gradient(90deg, #b89a6a 0 4px, transparent 4px 8px); margin: 0.2em 0; }
`;
let styled = false;

const ICONS: Record<string, string[]> = {
  play: ['.#......', '.##.....', '.###....', '.####...', '.####...', '.###....', '.##.....', '.#......'],
  book: ['.##..##.', '#..##..#', '#..##..#', '#..##..#', '#..##..#', '#..##..#', '.##..##.', '...##...'],
  gear: ['...##...', '.#.##.#.', '..####..', '###..###', '###..###', '..####..', '.#.##.#.', '...##...'],
  flag: ['#.......', '######..', '#######.', '######..', '#.......', '#.......', '#.......', '#.......'],
  door: ['.######.', '.#....#.', '.#....#.', '.#...##.', '.#....#.', '.#....#.', '.#....#.', '########'],
};
function icon(name: string) {
  const c = document.createElement('canvas');
  c.width = 10; c.height = 10;
  const x = c.getContext('2d')!;
  for (const [o, f] of [[1, 'rgba(0,0,0,0.5)'], [0, '#fff8e0']] as const) {
    x.fillStyle = f;
    ICONS[name].forEach((row, j) => { for (let i = 0; i < 8; i++) if (row[i] === '#') x.fillRect(i + o, j + o, 1, 1); });
  }
  return `url(${c.toDataURL()})`;
}

export function openPause(opts: { onReturn?: () => void } = {}) {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  audio.play('uiOpen');
  game.paused = true;
  const sc = game.scene as unknown as { site?: { name?: string } } | null;
  const where = sc?.site?.name ? `${sc.site.name} · Day ${game.save.day ?? 1}` : `Day ${game.save.day ?? 1}`;
  const box = el('div', 'panel pz-pause', `<h2>PAUSED</h2><div class="where">${where}</div>`);
  const close = game.ui.modal(box, () => { game.paused = false; });
  const add = (label: string, ic: string, fn: () => void, cls = 'btn ghost') => {
    const b = el('button', cls, `<span class="ic"></span><span>${label}</span>`);
    (b.querySelector('.ic') as HTMLElement).style.setProperty('--ic', icon(ic));
    b.onclick = () => { audio.play('ui'); fn(); };
    box.appendChild(b);
    return b;
  };
  add('Resume', 'play', () => close(), 'btn');
  add('Field Guide', 'book', () => { close(); openJournal(); });
  add('Settings', 'gear', () => openSettings());
  box.appendChild(el('div', 'sep'));
  if (opts.onReturn) add('End expedition', 'flag', () => { close(); opts.onReturn!(); }, 'btn amber');
  add('Save &amp; quit', 'door', () => {
    close();
    game.persist();
    import('../game/scenes/title').then(m => game.go(() => new m.TitleScene()));
  }, 'btn red');
}
