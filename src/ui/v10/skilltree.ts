// MoriOS: the Skill Tree (V10). Four branches (Data Analysis, Camera, Research, Field Skills) read
// from SKILL_TREE10 / BRANCHES10 (../../game/v10/skills10; an empty tree shows that the agency's
// programme is still being drawn up). Nodes sit in rows by tier and in their lanes (or ordered to keep
// the requirement lines from crossing); owned nodes glow gold, affordable ones pulse, locked ones
// wait behind their requirements. Buying (canBuy10 / buy10, paid in RP) plays the unlock: a burst on
// the node, the RP counter rolling down, the lines to the next skills lighting up and the expedition
// kit stats that changed flashing. On narrow screens the branches become tabs.

import { el } from '../ui';
import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { SKILL_TREE10, BRANCHES10, owned10, buy10, canBuy10, onSkill10, fx10 } from '../../game/v10/skills10';
import type { Skill10, Branch10 } from '../../game/v10/skills10';
import { skillIconURL } from '../../art/itemicons';
import type { OSCtx } from '../v4/moriResearch';
import { esc } from '../v4/moriResearch';
import { sfx, clamp } from '../v7/aeroFx';
import { mascot } from './icons10';
import type { AgencyApp } from './agency';

export interface SkillApp { open(id?: string): void; refresh(): void; buyable(): number }

/** the expedition kit: what the skills change, as gameplay reads it */
const KIT: { k: string; label: string; v: () => string }[] = [
  { k: 'hold', label: 'Capture hold', v: () => `${+fx10.captureHold().toFixed(1)} s` },
  { k: 'dev', label: 'Photo develops in', v: () => `${+fx10.developTime().toFixed(1)} s` },
  { k: 'film', label: 'Extra film per trip', v: () => `+${fx10.film()}` },
  { k: 'zoom', label: 'Zoom', v: () => `×${+fx10.zoomMax().toFixed(1)}` },
  { k: 'depth', label: 'Sheet sections / upload', v: () => (fx10.infoDepth() >= 5 ? 'whole sheet' : String(fx10.infoDepth())) },
  { k: 'web', label: 'Food-web links', v: () => (fx10.ecoLinks() ? 'mapped' : 'hidden') },
  { k: 'rp', label: 'Agency RP rate', v: () => `×${fx10.rpMult().toFixed(2)}` },
  { k: 'disc', label: 'Discovery RP', v: () => `×${fx10.discoveryMult().toFixed(2)}` },
  { k: 'id', label: 'Identification bonus', v: () => `+${Math.round(fx10.idBonus() * 100)}%` },
  { k: 'tag', label: 'Auto-tag uploads', v: () => (fx10.autoTag() ? 'on' : 'off') },
  { k: 'assay', label: 'Sample analysis time', v: () => `×${fx10.sampleTime().toFixed(2)}` },
  { k: 'energy', label: 'Energy use', v: () => `×${fx10.energyMult().toFixed(2)}` },
  { k: 'pack', label: 'Pack capacity', v: () => `+${+fx10.packBonus().toFixed(1)} kg · +${fx10.packSlots()} pockets` },
  { k: 'max', label: 'Max energy', v: () => `+${fx10.maxEnergyBonus()}` },
];
const BR = (b: Branch10) => BRANCHES10.find(x => x.id === b) ?? { id: b, name: b, color: '#7a8aa0', blurb: '', icon: 'chart' };

/** the open Skill Tree, refreshed when a skill is learned anywhere (one listener for the module) */
let current: (() => void) | null = null;
let hooked = false;
const kitNow = () => Object.fromEntries(KIT.map(x => { try { return [x.k, x.v()]; } catch { return [x.k, '?']; } }));

/** a skill's icon (its own, else picked from its words, else the branch icon) */
function skillIcon(s: Skill10): string {
  if (s.icon) return s.icon;
  const t = `${s.name} ${s.effect} ${s.desc}`.toLowerCase();
  const M: [RegExp, string][] = [
    [/video|film|record/, 'video'], [/night|dark|low.?light/, 'night'], [/zoom|lens|telephoto/, 'lens'], [/focus|sharp/, 'af'], [/steady|stabil|shake|hold/, 'stab'],
    [/develop|faster photo|quick|second|time/, 'clock'], [/shutter|freeze/, 'shutter'], [/identif|recogni|id\b/, 'photoid'], [/depth|section|sheet|analy|data|software/, 'chart'],
    [/dna|sequenc|genetic|barcode/, 'dna'], [/micro|lab|sample|specimen/, 'micro'], [/rp\b|research point|grant|fund|agency|budget/, 'grant'], [/pack|carry|weight|kg|load/, 'pack'],
    [/energy|stamina|endur|rest|sleep|food/, 'heart'], [/climb|swim|grip|hand/, 'hand'], [/sneak|quiet|stealth|step/, 'boot'], [/track|trail|map|scout/, 'track'], [/spot|eye|see|binocular/, 'eye'], [/lure|bait/, 'lure'],
  ];
  for (const [re, ic] of M) if (re.test(t)) return ic;
  return BR(s.branch).icon;
}

type State = 'owned' | 'ready' | 'poor' | 'locked';
const stateOf = (s: Skill10): State => owned10(s.id) ? 'owned' : !s.req.every(owned10) ? 'locked' : canBuy10(s.id).ok ? 'ready' : 'poor';

export function skillTreeApp(os: OSCtx, agency: AgencyApp): SkillApp {
  let w: HTMLElement | null = null;
  let sel: string | null = null;
  let tab: Branch10 = 'data';
  let fresh = new Set<string>();
  let flash = new Set<string>();
  let shownRp = game.save.rp;
  const live = () => !!w && w.isConnected && !os.closed();
  if (!hooked) { hooked = true; onSkill10(() => current?.()); }

  const open = (id?: string) => {
    if (id) { sel = id; const s = SKILL_TREE10.find(x => x.id === id); if (s) tab = s.branch; }
    if (os.find('skills') && live()) { render(); os.win('skills', '', 'skills', 0, 0, el('div')); return; }
    w = el('div', 'sk');
    w.dataset.direct = '1';
    const W = os.win('skills', 'Skill Tree', 'skills', 980, 600, w);
    if (!W) return;
    shownRp = game.save.rp;
    current = () => { if (live()) { shownRp = game.save.rp; render(); os.badges(); } };
    render();
  };

  const render = () => {
    if (!w) return;
    const tree = SKILL_TREE10;
    w.innerHTML = `<div class="skt-top"><span class="ic"></span><b>Skill Tree</b><span class="tip">Research Points come from the agency for every upload</span><span class="rp"><em>${shownRp}</em> RP</span></div>
      <div class="skt-tabs">${BRANCHES10.map(b => `<span class="ctl${b.id === tab ? ' on' : ''}" data-b="${b.id}" style="--bc:${b.color}"><img src="${skillIconURL(b.icon, 1)}" alt="">${esc(b.name)}</span>`).join('')}</div>
      <div class="skt-body"><div class="skt-tree"></div><div class="skt-info"></div></div>`;
    (w.querySelector('.skt-top .ic') as HTMLElement).appendChild(os.icon('skills', 1.2));
    w.querySelectorAll<HTMLElement>('.skt-tabs span').forEach(t => t.addEventListener('click', () => { tab = t.dataset.b as Branch10; sfx.pick(); render(); }));
    const T = w.querySelector('.skt-tree') as HTMLElement;
    w.classList.toggle('empty', !tree.length);
    if (!tree.length) { emptyTree(T); info(); return; }
    for (const br of BRANCHES10) {
      const skills = tree.filter(s => s.branch === br.id);
      const col = el('div', 'skt-col' + (br.id === tab ? ' on' : ''));
      col.style.setProperty('--bc', br.color);
      const own = skills.filter(s => owned10(s.id)).length;
      col.innerHTML = `<div class="hd"><img src="${skillIconURL(br.icon, 1)}" alt=""><b>${esc(br.name)}</b><span>${own}/${skills.length}</span></div><div class="nodes"></div>`;
      layout(col.querySelector('.nodes') as HTMLElement, skills);
      T.appendChild(col);
    }
    info();
  };

  /** rows by tier; in each row, nodes ordered by where their requirements sit (fewer crossings) */
  const layout = (box: HTMLElement, skills: Skill10[]) => {
    if (!skills.length) { box.innerHTML = '<div class="skt-none">No skills in this branch yet.</div>'; return; }
    const tiers = [...new Set(skills.map(s => s.tier))].sort((a, b) => a - b);
    const lane = new Map<string, number>();
    const rows: Skill10[][] = [];
    for (const t of tiers) {
      const row = skills.filter(s => s.tier === t);
      if (row.every(s => typeof s.lane === 'number')) {
        // the skill's own lane (-1, 0, 1)
        row.forEach(s => lane.set(s.id, clamp(0.5 + (s.lane ?? 0) * 0.3, 0.12, 0.88)));
      } else {
        // ordered by where the requirements sit (fewer crossings)
        const bary = (s: Skill10) => { const r = s.req.map(id => lane.get(id)).filter((v): v is number => v !== undefined); return r.length ? r.reduce((a, v) => a + v, 0) / r.length : 0.5; };
        row.sort((a, b) => bary(a) - bary(b) || a.id.localeCompare(b.id));
        row.forEach((s, i) => lane.set(s.id, (i + 1) / (row.length + 1)));
      }
      rows.push(row);
    }
    const RH = 104;
    box.style.height = rows.length * RH + 'px';
    const pos = new Map<string, { x: number; y: number }>();
    rows.forEach((row, ri) => row.forEach(s => pos.set(s.id, { x: lane.get(s.id)! * 100, y: ri * RH + 34 })));
    // requirement lines (inside the branch; cross-branch ones show as chips)
    const H = rows.length * RH;
    let svg = `<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" style="height:${H}px">`;
    for (const s of skills) for (const r of s.req) {
      const a = pos.get(r), z = pos.get(s.id);
      if (!a || !z) continue;
      const on = owned10(r), done = owned10(s.id);
      const cls = done ? 'own' : on ? 'open' : 'off';
      svg += `<path class="${cls}${fresh.has(s.id) ? ' lit' : ''}" d="M${a.x.toFixed(1)} ${a.y + 22} C ${a.x.toFixed(1)} ${(a.y + z.y) / 2 + 10}, ${z.x.toFixed(1)} ${(a.y + z.y) / 2 - 10}, ${z.x.toFixed(1)} ${z.y - 24}" vector-effect="non-scaling-stroke"/>`;
    }
    box.innerHTML = svg + '</svg>';
    for (const s of skills) {
      const p = pos.get(s.id)!;
      const st = stateOf(s);
      const ext = s.req.filter(r => !skills.some(x => x.id === r));
      const n = el('div', `skt-n ctl ${st}${sel === s.id ? ' on' : ''}${fresh.has(s.id) ? ' newly' : ''}`, `<span class="o"><img src="${skillIconURL(skillIcon(s), 2)}" alt="" draggable="false">${st === 'owned' ? '<i class="ck">✓</i>' : st === 'locked' ? '<i class="lk"></i>' : ''}</span><b>${esc(s.name)}</b><em>${st === 'owned' ? 'owned' : `${s.cost} RP`}</em>${ext.length ? `<small>needs ${ext.map(r => esc(SKILL_TREE10.find(x => x.id === r)?.name ?? r)).join(', ')}</small>` : ''}`);
      n.style.left = p.x + '%';
      n.style.top = p.y - 26 + 'px';
      n.dataset.id = s.id;
      n.addEventListener('click', () => { sel = s.id; sfx.pick(); w?.querySelectorAll('.skt-n.on').forEach(x => x.classList.remove('on')); n.classList.add('on'); info(); });
      n.addEventListener('dblclick', () => { sel = s.id; buy(); });
      box.appendChild(n);
    }
  };

  const emptyTree = (T: HTMLElement) => {
    T.innerHTML = `<div class="skt-empty"><span class="ms"></span><div><b>The skill programme is still being drawn up.</b><p>The agency’s training department is finalising the four branches. Your Research Points are safe in the meantime: you have <b>${game.save.rp} RP</b> to spend when it opens.</p></div></div><div class="skt-brs">${BRANCHES10.map(b => `<div class="skt-br" style="--bc:${b.color}"><img src="${skillIconURL(b.icon, 2)}" alt=""><b>${esc(b.name)}</b><p>${esc(b.blurb)}</p></div>`).join('')}</div>`;
    (T.querySelector('.ms') as HTMLElement).appendChild(mascot('wink', 1.6));
  };

  /** the selected skill's card and the expedition kit */
  const info = () => {
    if (!w) return;
    const I = w.querySelector('.skt-info') as HTMLElement;
    const s = SKILL_TREE10.find(x => x.id === sel) ?? null;
    const kit = kitNow();
    const kitHtml = `<div class="skt-kit"><h5>Expedition kit</h5>${KIT.map(x => `<div class="kv${flash.has(x.k) ? ' flash' : ''}"><span>${esc(x.label)}</span><b>${esc(kit[x.k])}</b></div>`).join('')}</div>`;
    if (!s) {
      I.innerHTML = `<div class="skt-card none"><b>${SKILL_TREE10.length ? 'Pick a skill' : 'Skills'}</b><p>${SKILL_TREE10.length ? 'Tap a skill to see what it does. Gold ones are yours; glowing ones you can afford now.' : 'Spend Research Points on better analysis, a better camera, better lab work and tougher field skills.'}</p></div>` + kitHtml;
      flash = new Set();
      return;
    }
    const br = BR(s.branch);
    const st = stateOf(s);
    const why = canBuy10(s.id).reason ?? '';
    I.innerHTML = `<div class="skt-card ${st}" style="--bc:${br.color}"><div class="h"><img src="${skillIconURL(skillIcon(s), 2)}" alt=""><div><b>${esc(s.name)}</b><span>${esc(br.name)} · tier ${s.tier}</span></div></div>
      <p class="efx">${esc(s.effect)}</p><p>${esc(s.desc)}</p>
      ${s.req.length ? `<div class="rq">${s.req.map(r => `<span class="${owned10(r) ? 'ok' : ''}">${owned10(r) ? '✓' : '✕'} ${esc(SKILL_TREE10.find(x => x.id === r)?.name ?? r)}</span>`).join('')}</div>` : ''}
      <div class="buy">${st === 'owned' ? '<div class="own">✓ Unlocked</div>' : `<div class="gel ${st === 'ready' ? 'green' : 'glass'} big ctl go">${st === 'locked' ? 'Locked' : `Unlock · ${s.cost} RP`}</div>`}<div class="why">${st === 'poor' ? (game.save.rp < s.cost ? `You need ${s.cost - game.save.rp} more RP. Upload some research!` : esc(why)) : st === 'locked' ? `${esc(why)} first.` : ''}</div></div></div>` + kitHtml;
    flash = new Set();
    (I.querySelector('.go') as HTMLElement | null)?.addEventListener('click', buy);
  };

  const buy = () => {
    const s = SKILL_TREE10.find(x => x.id === sel);
    if (!s || !w) return;
    const node = w.querySelector<HTMLElement>(`.skt-n[data-id="${CSS.escape(s.id)}"]`);
    const go = w.querySelector('.skt-info .go') as HTMLElement | null;
    const st = stateOf(s);
    const nope = (msg: string) => { sfx.bad(); if (go) os.retrigger(go, 'mos-shake'); if (node) os.retrigger(node, 'mos-shake'); const c = os.center(go ?? node ?? w!); os.floatText(c.x, c.y - 24, msg, '#ffd0c8'); };
    if (st === 'owned') return;
    if (st === 'locked') { nope('requirements first'); return; }
    if (st === 'poor') { nope(game.save.rp < s.cost ? `${s.cost - game.save.rp} RP short` : canBuy10(s.id).reason ?? 'not yet'); return; }
    const before = kitNow(), rp0 = game.save.rp;
    // (the unlock animation re-renders by itself: the learned-a-skill refresh waits)
    const cur0 = current;
    current = null;
    const ok = buy10(s.id);
    current = cur0;
    if (!ok) { nope(canBuy10(s.id).reason ?? 'the agency said no'); return; }
    game.persist();
    const after = kitNow();
    flash = new Set(KIT.map(x => x.k).filter(k => before[k] !== after[k]));
    fresh = new Set(SKILL_TREE10.filter(x => x.req.includes(s.id)).map(x => x.id));
    const n = SKILL_TREE10.filter(x => owned10(x.id)).length;
    // the unlock
    audio.play('skillUnlock', { vol: 0.55 });
    setTimeout(() => sfx.unlock(), 300);
    if (node) {
      node.classList.add('burst');
      const c = os.center(node);
      os.fx.ring(c.x, c.y, 'rgba(255,230,140,0.95)', 90);
      setTimeout(() => os.fx.ring(c.x, c.y, 'rgba(160,255,200,0.9)', 140), 120);
      os.fx.sparkle(c.x, c.y, 24, 170);
      os.fx.confetti(c.x, c.y - 20, 70, 200);
      os.floatText(c.x, c.y - 44, s.effect.length > 34 ? s.effect.slice(0, 32) + '…' : s.effect, '#fff3a0');
    }
    // the RP counter rolls down
    const rp1 = game.save.rp;
    let t = 0;
    os.animate(dt => {
      t += dt;
      const f = Math.min(1, t / 0.8);
      shownRp = Math.round(rp0 + (rp1 - rp0) * (1 - Math.pow(1 - f, 3)));
      const e = w?.querySelector('.skt-top .rp em');
      if (e) e.textContent = String(shownRp);
      return f < 1 && live();
    });
    const m = agency.onSkill(s, n);
    setTimeout(() => {
      if (!live()) return;
      shownRp = game.save.rp;
      render();
      const nn = w!.querySelector<HTMLElement>(`.skt-n[data-id="${CSS.escape(s.id)}"]`);
      if (nn) os.retrigger(nn, 'got');
      setTimeout(() => { fresh = new Set(); }, 50);
      os.badges();
      if (m) os.balloon('New mail from ZEA', esc(m.subj), 6000, { icon: 'mail', onClick: () => os.open('mail', m.id) });
    }, 650);
  };

  return {
    open,
    refresh: () => { if (live()) { shownRp = game.save.rp; render(); } },
    buyable: () => SKILL_TREE10.filter(s => stateOf(s) === 'ready').length,
  };
}

