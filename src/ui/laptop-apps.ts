// The FieldOS apps: Microscope (analyse samples for RP, clues and species hints), Skills (the
// research tree), the Zealandia Field Guide (species, fact deduction, clues) and Notes (quests).

import { game } from '../game/game';
import { ITEMS } from '../game/items';
import { labSamples, analysisTime, analysisRp, analyze } from '../game/lab';
import { BRANCHES, SKILLS, SKILL_BY_ID, skillState, canUnlock, unlockSkill } from '../game/skills';
import { SPECIES, SPECIES_BY_ID, CLUES, Fact } from '../game/species';
import { factState, solveFact, evidenceLabel, hasEvidence, FACT_RP } from '../game/research';
import { QUESTS, activeQuests, currentStepIndex, questStatus } from '../game/quests';
import { itemIconURL, skillIconURL, uiIconURL } from '../art/itemicons';
import { speciesSprite, iconURL } from './icons';
import { el } from './ui';
import { sfx, css, esc, wait, starsHTML, rpIcon, AppMount } from './laptop-kit';

css('lt-apps', `
.la { position: absolute; inset: 0; display: flex; font-size: 0.92em; color: var(--paper); }
.la-side { width: 12.5em; flex: none; overflow-y: auto; background: rgba(0,0,0,0.25); padding: 0.4em; display: flex; flex-direction: column; gap: 0.25em; }
.la-main { flex: 1; min-width: 0; overflow-y: auto; padding: 0.8em 1em; position: relative; }
.la-it { display: flex; align-items: center; gap: 0.5em; padding: 0.3em 0.45em; background: rgba(255,255,255,0.05); border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.la-it:hover { background: rgba(143,240,220,0.14); }
.la-it.on { background: rgba(143,240,220,0.26); box-shadow: inset 0.2em 0 0 var(--teal); }
.la-it img { width: 2.2em; height: 2.2em; object-fit: contain; image-rendering: pixelated; flex: none; }
.la-it .nm { flex: 1; min-width: 0; font-family: var(--pix); font-size: 0.85em; line-height: 1.15; }
.la-it .nm small { display: block; opacity: 0.65; font-size: 0.85em; }
.la-it .ct { font-family: var(--pix); font-size: 0.8em; color: var(--amber2); }
.la h3 { margin: 0 0 0.3em; font-family: var(--pix); font-weight: 500; font-size: 1.35em; color: #f1e8d0; }
.la .sub { opacity: 0.7; font-size: 0.85em; margin-bottom: 0.7em; font-style: italic; }
.la p { margin: 0.35em 0; line-height: 1.35; }
.la .btn2 { font-family: var(--pix); font-size: 0.95em; padding: 0.45em 1em; border: 0; background: #3fbca6; color: #06241e; cursor: pointer; box-shadow: inset 0 -0.2em 0 rgba(0,0,0,0.25); }
.la .btn2:hover { filter: brightness(1.1); }
.la .btn2:disabled { background: #3a4a46; color: #8a9a96; cursor: default; }
.la .btn2.amber { background: #f4b43c; color: #2a1a06; }
.la .pill { display: inline-flex; align-items: center; gap: 0.3em; font-family: var(--pix); font-size: 0.8em; padding: 0.1em 0.5em; background: rgba(255,255,255,0.08); margin: 0 0.3em 0.3em 0; }
.la .pill.ok { background: rgba(63,188,166,0.3); color: #bff4e8; }
.la .pill.no { background: rgba(232,97,74,0.22); color: #ffc2b4; }
.la .empty { opacity: 0.6; font-style: italic; padding: 2em 1em; text-align: center; }
.la .card { background: rgba(255,255,255,0.05); padding: 0.6em 0.8em; margin: 0.5em 0; box-shadow: inset 0 0 0 0.1em rgba(143,240,220,0.12); }
/* microscope */
.mc-scope { width: 12em; height: 12em; border-radius: 50%; margin: 0.4em auto 0.6em; position: relative; overflow: hidden; background: radial-gradient(circle, #d8f0c8 0%, #9fc890 55%, #3a5a3a 80%, #0b1208 100%); box-shadow: 0 0 0 0.5em #1a2420, 0 0 0 0.7em #3a4a44, inset 0 0 2em rgba(0,0,0,0.6); }
.mc-scope canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
.mc-bar { height: 0.8em; background: #1f3a34; margin: 0.6em 0; box-shadow: inset 0 0 0 0.12em #0b1512; }
.mc-bar div { height: 100%; width: 0; background: repeating-linear-gradient(90deg, #9b7ce0 0 0.6em, #c8b0ff 0.6em 0.8em); }
.mc-res { animation: laIn 0.35s cubic-bezier(.2,1.3,.4,1); }
@keyframes laIn { from { transform: translateY(0.6em) scale(0.97); opacity: 0; } }
.mc-rp { font-family: var(--pix); font-size: 1.6em; color: var(--amber2); display: inline-flex; align-items: center; gap: 0.3em; }
/* skills */
.sk { position: absolute; inset: 0; display: flex; flex-direction: column; }
.sk-top { display: flex; align-items: center; gap: 0.8em; padding: 0.5em 0.8em; background: rgba(0,0,0,0.25); font-family: var(--pix); }
.sk-top .rp { color: var(--amber2); font-size: 1.2em; display: flex; align-items: center; gap: 0.3em; }
.sk-cols { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4em; padding: 0.5em; overflow-y: auto; }
.sk-col { position: relative; background: rgba(255,255,255,0.03); min-height: 26em; }
.sk-col h4 { margin: 0; padding: 0.35em; text-align: center; font-family: var(--pix); font-weight: 500; font-size: 0.95em; color: #06241e; }
.sk-col svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
.sk-n { position: absolute; width: 3.4em; height: 3.4em; transform: translate(-50%, 0); border: 0; padding: 0; background: #16241f; cursor: pointer; box-shadow: 0 0 0 0.15em #0b0f12, 0 0 0 0.3em #3a4a46; display: grid; place-items: center; }
.sk-n img { width: 2.6em; height: 2.6em; image-rendering: pixelated; }
.sk-n.owned { box-shadow: 0 0 0 0.15em #0b0f12, 0 0 0 0.3em var(--bc); background: color-mix(in srgb, var(--bc) 35%, #16241f); }
.sk-n.available { box-shadow: 0 0 0 0.15em #0b0f12, 0 0 0 0.3em #f1e8d0; animation: skPulse 1.6s ease-in-out infinite; }
.sk-n.locked img { filter: grayscale(1) brightness(0.5); }
.sk-n.sel { outline: 0.2em solid #fff; outline-offset: 0.35em; }
@keyframes skPulse { 50% { box-shadow: 0 0 0 0.15em #0b0f12, 0 0 0 0.3em #f4b43c, 0 0 1em rgba(244,180,60,0.6); } }
.sk-n .c { position: absolute; bottom: -1.1em; left: 50%; transform: translateX(-50%); font-family: var(--pix); font-size: 0.7em; white-space: nowrap; color: var(--amber2); }
.sk-d { flex: none; padding: 0.6em 0.9em; background: rgba(0,0,0,0.35); display: flex; gap: 0.8em; align-items: center; min-height: 4.2em; }
.sk-d img { width: 3em; image-rendering: pixelated; }
.sk-d .t { flex: 1; }
.sk-d b { font-family: var(--pix); font-weight: 500; font-size: 1.05em; }
.sk-d .e { color: var(--teal2); font-family: var(--pix); font-size: 0.85em; }
.sk-pop { animation: skPop 0.6s cubic-bezier(.2,1.8,.4,1); }
@keyframes skPop { 30% { transform: translate(-50%, 0) scale(1.35) rotate(-6deg); } }
/* guide */
.gd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(5.4em, 1fr)); gap: 0.35em; }
.gd-sp { display: flex; flex-direction: column; align-items: center; gap: 0.2em; padding: 0.35em 0.2em; border: 0; background: rgba(255,255,255,0.05); color: inherit; font: inherit; cursor: pointer; position: relative; }
.gd-sp img { width: 4.4em; height: 3.2em; object-fit: contain; image-rendering: pixelated; }
.gd-sp.unseen img { filter: brightness(0) opacity(0.45); }
.gd-sp span { font-family: var(--pix); font-size: 0.68em; text-align: center; line-height: 1.1; }
.gd-sp .dot { position: absolute; right: 0.3em; top: 0.3em; width: 0.7em; height: 0.7em; background: #f4b43c; box-shadow: 0 0 0.4em #f4b43c; }
.gd-tabs { display: flex; gap: 0.3em; margin-bottom: 0.6em; }
.gd-tabs button { font-family: var(--pix); border: 0; padding: 0.3em 0.8em; background: rgba(255,255,255,0.07); color: inherit; cursor: pointer; }
.gd-tabs button.on { background: #8db34a; color: #10200a; }
.gd-hero { display: flex; gap: 1em; align-items: flex-start; }
.gd-hero img.pic { width: 14em; max-height: 10em; object-fit: contain; image-rendering: pixelated; background: rgba(0,0,0,0.3); }
.gd-fact { border-left: 0.25em solid #3a4a46; }
.gd-fact.ready { border-color: #f4b43c; }
.gd-fact.solved { border-color: #3fbca6; }
.gd-fact .q { font-family: var(--pix); font-size: 0.95em; margin-bottom: 0.3em; }
.gd-opts { display: flex; flex-wrap: wrap; gap: 0.35em; margin-top: 0.4em; }
.gd-opts button { font: inherit; font-size: 0.85em; border: 0; padding: 0.35em 0.7em; background: rgba(255,255,255,0.1); color: inherit; cursor: pointer; }
.gd-opts button:hover { background: rgba(244,180,60,0.3); }
.gd-opts button.bad { background: rgba(232,97,74,0.45); animation: gdShake 0.35s; }
@keyframes gdShake { 25% { transform: translateX(-0.3em); } 75% { transform: translateX(0.3em); } }
.gd-clue { display: flex; gap: 0.7em; align-items: center; }
.gd-clue img { width: 2.6em; image-rendering: pixelated; }
/* notes */
.nt-q { background: #fbe99a; color: #3b3226; padding: 0.6em 0.9em 0.7em; margin: 0 0 0.7em; box-shadow: 0 0.3em 0 rgba(0,0,0,0.3); font-family: var(--hand); position: relative; }
.nt-q:nth-child(2n) { transform: rotate(-0.6deg); }
.nt-q:nth-child(2n+1) { transform: rotate(0.5deg); }
.nt-q h4 { margin: 0 0 0.2em; font-family: var(--pix); font-weight: 500; font-size: 1em; }
.nt-q h4 small { font-size: 0.7em; color: #a86a18; letter-spacing: 0.08em; margin-left: 0.5em; }
.nt-q .d { font-size: 0.95em; opacity: 0.85; margin-bottom: 0.3em; }
.nt-q ul { margin: 0; padding-left: 1.2em; }
.nt-q li { margin: 0.1em 0; }
.nt-q li.done { text-decoration: line-through; opacity: 0.55; }
.nt-q li.cur { font-weight: 700; }
.nt-q .trk { position: absolute; right: 0.6em; top: 0.5em; font-family: var(--pix); font-size: 0.75em; border: 0; background: #3b3226; color: #fbe99a; padding: 0.2em 0.6em; cursor: pointer; }
.nt-q .trk.on { background: #3fbca6; color: #06241e; }
`);

// ================================================================== MICROSCOPE
export const mountSamples: AppMount = (host, ctx) => {
  const root = el('div', 'la');
  host.appendChild(root);
  const side = root.appendChild(el('div', 'la-side'));
  const main = root.appendChild(el('div', 'la-main'));
  let sel: string | null = null;
  let busy = false;
  let raf = 0;
  const list = () => {
    side.innerHTML = '';
    const ls = labSamples();
    if (!ls.length) side.appendChild(el('div', 'empty', 'No samples. Collect plants, fungi and insects in the field.'));
    for (const s of ls) {
      const b = el('button', 'la-it' + (s.id === sel ? ' on' : ''), `<img src="${itemIconURL(s.id, 2)}" alt=""><span class="nm">${esc(ITEMS[s.id].name)}<small>${s.times ? `analysed ×${s.times}` : 'NEW'}</small></span><span class="ct">×${s.n}</span>`);
      b.onclick = () => { if (busy) return; sel = s.id; sfx('ui', { vol: 0.4 }); list(); show(); };
      side.appendChild(b);
    }
    if (!sel && ls.length) { sel = ls[0].id; list(); show(); }
  };
  const scope = (running: boolean) => {
    const w = el('div', 'mc-scope');
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    w.appendChild(cv);
    const g = cv.getContext('2d')!;
    const cells = Array.from({ length: 16 }, (_, i) => ({ x: Math.random() * 64, y: Math.random() * 64, r: 2 + Math.random() * 5, h: 80 + (i % 5) * 20, vx: Math.random() - 0.5, vy: Math.random() - 0.5 }));
    const tick = () => {
      g.clearRect(0, 0, 64, 64);
      for (const c of cells) {
        c.x = (c.x + c.vx * (running ? 0.6 : 0.15) + 64) % 64; c.y = (c.y + c.vy * (running ? 0.6 : 0.15) + 64) % 64;
        g.fillStyle = `hsla(${c.h},45%,35%,0.55)`; g.beginPath(); g.arc(c.x, c.y, c.r, 0, 7); g.fill();
        g.fillStyle = `hsla(${c.h},55%,22%,0.9)`; g.fillRect(Math.round(c.x), Math.round(c.y), 1, 1);
      }
      if (w.isConnected) raf = requestAnimationFrame(tick);
    };
    tick();
    return w;
  };
  const show = () => {
    cancelAnimationFrame(raf);
    main.innerHTML = '';
    if (!sel || !ITEMS[sel]) { main.appendChild(el('div', 'empty', 'Pick a sample on the left.')); return; }
    const def = ITEMS[sel];
    const rp = analysisRp(sel);
    main.appendChild(el('h3', '', esc(def.name)));
    main.appendChild(el('div', 'sub', esc(def.desc ?? '')));
    main.appendChild(scope(false));
    const info = main.appendChild(el('div', 'card', `<span class="pill">${analysisTime(sel).toFixed(1)} s</span><span class="pill ${rp ? 'ok' : 'no'}">${rpIcon()} +${rp} RP</span>${game.save.analyzed[sel] ? '' : '<span class="pill ok">First analysis bonus</span>'}`));
    void info;
    const go = main.appendChild(el('button', 'btn2', 'Analyse sample')) as HTMLButtonElement;
    go.onclick = async () => {
      if (busy || !sel) return;
      busy = true;
      go.disabled = true;
      sfx('scanBeep', { vol: 0.5 });
      main.querySelector('.mc-scope')?.replaceWith(scope(true));
      const bar = main.appendChild(el('div', 'mc-bar', '<div></div>')).firstElementChild as HTMLElement;
      const T = analysisTime(sel) * 1000, t0 = performance.now();
      while (performance.now() - t0 < T) {
        bar.style.width = ((performance.now() - t0) / T) * 100 + '%';
        if (Math.random() < 0.08) sfx('typing', { vol: 0.25 });
        await wait(60);
        if (!main.isConnected) return;
      }
      bar.style.width = '100%';
      const r = analyze(sel);
      busy = false;
      if (!r) { show(); return; }
      sfx('discover');
      const res = main.appendChild(el('div', 'card mc-res', `
        <div class="mc-rp">${rpIcon()} +${r.rp}</div>
        <p>${esc(r.text)}</p>
        ${r.clueName ? `<p><span class="pill ${r.clueNew ? 'ok' : ''}">${r.clueNew ? 'New clue' : 'Clue'}: ${esc(r.clueName)}</span></p>` : ''}
        ${r.speciesName ? `<p><span class="pill">Points to: ${game.save.seen[r.species!] ? esc(r.speciesName) : 'an unidentified species'}</span></p>` : ''}`));
      ctx.rpFly(res, r.rp);
      ctx.refresh();
      const again = main.appendChild(el('button', 'btn2 amber', 'Next sample'));
      again.onclick = () => { if (!labSamples().some(s => s.id === sel)) sel = null; list(); show(); };
      list();
    };
  };
  list();
  if (!sel) show();
  return () => cancelAnimationFrame(raf);
};

// ================================================================== SKILLS
export const mountSkills: AppMount = (host, ctx) => {
  const root = el('div', 'la sk');
  host.appendChild(root);
  let sel: string | null = null;
  const draw = () => {
    root.innerHTML = '';
    const top = root.appendChild(el('div', 'sk-top', `<span class="rp">${rpIcon()} ${game.save.rp} RP</span><span style="opacity:.7;font-size:.8em">Earn RP by reviewing photos, analysing samples and solving facts.</span>`));
    void top;
    const cols = root.appendChild(el('div', 'sk-cols'));
    const ROW = 6.3, TOP = 2.8;
    for (const B of BRANCHES) {
      const col = cols.appendChild(el('div', 'sk-col'));
      col.style.setProperty('--bc', B.color);
      const h = col.appendChild(el('h4', '', B.name));
      h.style.background = B.color;
      const skills = SKILLS.filter(s => s.branch === B.id);
      const pos = (id: string) => { const s = SKILL_BY_ID[id]; return { x: 50 + s.lane * 30, y: TOP + s.tier * ROW }; };
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      col.appendChild(svg);
      const maxT = Math.max(...skills.map(s => s.tier));
      col.style.minHeight = TOP + (maxT + 1) * ROW + 1.5 + 'em';
      requestAnimationFrame(() => {
        const H = col.clientHeight, em = parseFloat(getComputedStyle(col).fontSize);
        svg.innerHTML = '';
        for (const s of skills) for (const r of s.req) {
          if (SKILL_BY_ID[r]?.branch !== B.id) continue;
          const a = pos(r), b = pos(s.id);
          const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          ln.setAttribute('x1', String(a.x)); ln.setAttribute('x2', String(b.x));
          ln.setAttribute('y1', String(((a.y + 1.7) * em / H) * 100)); ln.setAttribute('y2', String(((b.y + 1.7) * em / H) * 100));
          ln.setAttribute('stroke', skillState(r) === 'owned' ? B.color : '#3a4a46');
          ln.setAttribute('stroke-width', '3'); ln.setAttribute('vector-effect', 'non-scaling-stroke');
          svg.appendChild(ln);
        }
      });
      for (const s of skills) {
        const st = skillState(s.id);
        const p = pos(s.id);
        const n = el('button', `sk-n ${st}${s.id === sel ? ' sel' : ''}`, `<img src="${skillIconURL(s.icon, 2)}" alt=""><span class="c">${st === 'owned' ? '✓' : s.cost + ' RP'}</span>`);
        n.style.left = p.x + '%';
        n.style.top = p.y + 'em';
        n.title = s.name;
        n.dataset.sk = s.id;
        n.onclick = () => { sel = s.id; sfx('ui', { vol: 0.4 }); draw(); };
        col.appendChild(n);
      }
    }
    const d = root.appendChild(el('div', 'sk-d'));
    if (!sel) { d.innerHTML = '<div class="t" style="opacity:.7">Select a skill to see what it does.</div>'; return; }
    const s = SKILL_BY_ID[sel];
    const st = skillState(sel), cu = canUnlock(sel);
    d.innerHTML = `<img src="${skillIconURL(s.icon, 3)}" alt=""><div class="t"><b>${esc(s.name)}</b> <span class="e">${esc(s.effect)}</span><p style="margin:.2em 0 0;opacity:.85">${esc(s.desc)}</p></div>`;
    const b = d.appendChild(el('button', 'btn2 amber', st === 'owned' ? 'Learned' : cu.ok ? `Learn · ${s.cost} RP` : esc(cu.reason ?? 'Locked'))) as HTMLButtonElement;
    b.disabled = !cu.ok;
    b.onclick = () => {
      if (!unlockSkill(sel!)) return;
      sfx('skillUnlock', { vol: 0.8 });
      ctx.refresh();
      draw();
      root.querySelector(`.sk-n[data-sk="${sel}"]`)?.classList.add('sk-pop');
    };
  };
  draw();
};

// ================================================================== FIELD GUIDE
export const mountGuide: AppMount = (host, ctx, arg) => {
  const root = el('div', 'la');
  host.appendChild(root);
  const main = root.appendChild(el('div', 'la-main'));
  let tab: 'species' | 'clues' = arg === 'clues' ? 'clues' : 'species';
  let sp: string | null = arg && SPECIES_BY_ID[arg] ? arg : null;
  const s = game.save;
  const draw = () => {
    main.innerHTML = '';
    const tabs = main.appendChild(el('div', 'gd-tabs'));
    const seenN = SPECIES.filter(x => s.seen[x.id]).length;
    for (const [id, label] of [['species', `Species ${seenN}/${SPECIES.length}`], ['clues', `Clues ${Object.keys(s.clues).length}/${CLUES.length}`]] as const) {
      const b = tabs.appendChild(el('button', tab === id && !sp ? 'on' : '', label));
      b.onclick = () => { tab = id; sp = null; sfx('pageTurn', { vol: 0.4 }); draw(); };
    }
    if (sp) return species(sp);
    if (tab === 'clues') return clues();
    const grid = main.appendChild(el('div', 'gd-grid'));
    for (const x of SPECIES) {
      const seen = !!s.seen[x.id];
      const ready = x.facts.some(f => factState(f) === 'ready');
      const b = grid.appendChild(el('button', 'gd-sp' + (seen ? '' : ' unseen'), `<img src="${speciesSprite(x.id)}" alt=""><span>${seen ? esc(x.name) : s.hints[x.id] ? 'Unconfirmed' : '???'}</span>${ready ? '<i class="dot"></i>' : ''}`));
      b.onclick = () => { sp = x.id; sfx('pageTurn', { vol: 0.4 }); draw(); };
    }
  };
  const species = (id: string) => {
    const x = SPECIES_BY_ID[id];
    const seen = !!s.seen[id];
    const best = s.best[id];
    const back = main.appendChild(el('button', 'btn2', '← All species'));
    back.onclick = () => { sp = null; draw(); };
    const hero = main.appendChild(el('div', 'gd-hero'));
    hero.style.marginTop = '0.6em';
    hero.innerHTML = `<img class="pic" src="${best ? best.thumb : speciesSprite(id)}" style="${seen ? '' : 'filter:brightness(0) opacity(.45)'}" alt="">
      <div><h3>${seen ? esc(x.name) : '???'}</h3><div class="sub">${seen ? esc(x.sci) + ' · ' + esc(x.size) : 'Not yet identified: tag it in a photo.'}</div>
      ${best ? starsHTML(best.stars) : ''}<p>${seen ? esc(x.blurb) : 'Something lives here that you haven’t photographed yet.'}</p>
      <p>${x.sites.map(t => `<span class="pill">${t}</span>`).join('')}${x.times.map(t => `<span class="pill">${t}</span>`).join('')}</p></div>`;
    main.appendChild(el('h3', '', 'Facts')).style.marginTop = '0.8em';
    for (const f of x.facts) fact(f);
  };
  const fact = (f: Fact) => {
    const st = factState(f);
    const c = main.appendChild(el('div', `card gd-fact ${st}`));
    c.appendChild(el('div', 'q', st === 'solved' ? `✓ ${esc(f.q)}` : esc(f.q)));
    if (st === 'solved') { c.appendChild(el('p', '', esc(f.text))); return; }
    const ev = c.appendChild(el('div', ''));
    for (const e of f.evidence) ev.appendChild(el('span', `pill ${hasEvidence(e) ? 'ok' : 'no'}`, esc(evidenceLabel(e)).replace(/&lt;b&gt;|&lt;\/b&gt;/g, '')));
    if (st === 'locked') { c.appendChild(el('p', '', `<i style="opacity:.75">Hint: ${esc(f.hint)}</i>`)); return; }
    c.appendChild(el('p', '', 'You have all the evidence. What does it tell you?'));
    const opts = c.appendChild(el('div', 'gd-opts'));
    f.options.forEach((o, i) => {
      const b = opts.appendChild(el('button', '', esc(o)));
      b.onclick = () => {
        if (i === f.answer) {
          solveFact(f);
          ctx.rpFly(b, FACT_RP);
          ctx.refresh();
          sfx('fact');
          draw();
        } else {
          b.classList.add('bad');
          sfx('wrong', { vol: 0.5 });
        }
      };
    });
  };
  const clues = () => {
    for (const c of CLUES) {
      const got = !!s.clues[c.id];
      main.appendChild(el('div', 'card gd-clue', `<img src="${iconURL(c.icon)}" style="${got ? '' : 'filter:brightness(0) opacity(.4)'}" alt=""><div><b style="font-family:var(--pix)">${got ? esc(c.name) : '???'}</b><p style="margin:.1em 0 0;opacity:.85">${got ? esc(c.desc) : `Somewhere in the ${c.site}.`}</p></div>`));
    }
  };
  draw();
};

// ================================================================== NOTES (quests)
export const mountQuests: AppMount = (host, ctx) => {
  const root = el('div', 'la');
  host.appendChild(root);
  const main = root.appendChild(el('div', 'la-main'));
  const draw = () => {
    main.innerHTML = '';
    const act = activeQuests();
    main.appendChild(el('h3', '', 'To do'));
    if (!act.length) main.appendChild(el('div', 'empty', 'Nothing pressing. Talk to the crew.'));
    for (const q of act) {
      const cur = currentStepIndex(q);
      const n = main.appendChild(el('div', 'nt-q', `<h4>${esc(q.title)}<small>${q.main ? 'STORY' : 'SIDE'}</small></h4><div class="d">${esc(q.desc)}</div>`));
      const ul = n.appendChild(el('ul'));
      q.steps.forEach((st, i) => {
        if (i > cur) return;
        const pr = st.progress?.();
        ul.appendChild(el('li', i < cur ? 'done' : 'cur', esc(st.text) + (pr && i === cur ? ` (${pr[0]}/${pr[1]})` : '') + (st.hint && i === cur ? `<br><small style="opacity:.75">${esc(st.hint)}</small>` : '')));
      });
      const on = game.save.tracked === q.id;
      const t = n.appendChild(el('button', 'trk' + (on ? ' on' : ''), on ? 'Tracking' : 'Track'));
      t.onclick = () => { game.save.tracked = q.id; game.persist(); sfx('ui', { vol: 0.4 }); ctx.refresh(); draw(); };
    }
    const done = QUESTS.filter(q => questStatus(q.id) === 'done');
    if (done.length) {
      main.appendChild(el('h3', '', 'Done')).style.marginTop = '0.8em';
      main.appendChild(el('p', '', done.map(q => `<span class="pill ok">✓ ${esc(q.title)}</span>`).join('')));
    }
  };
  draw();
};

void uiIconURL;
