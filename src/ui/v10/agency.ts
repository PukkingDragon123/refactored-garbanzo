// MoriOS: ZEA Mail (V10). The Zealandia Expedition Agency sent the expedition and pays Research
// Points for every upload. Its mail reaches the laptop as plain text over the SatLink beacon in the
// field camera: a welcome from Tua (the agency mascot, a tuatara in a pith helmet), a reply to every
// upload session (praise, or snark when the photos are mostly leaves), firsts and milestones (with
// bonus RP), the weekly targets and their bonus, and congratulations on new skills. Mail about
// taonga comes from the agency's cultural liaison and is written with care. The app: the week's
// targets, the inbox, and the message with Tua.

import { el } from '../ui';
import { game } from '../../game/game';
import { SPECIES_BY_ID } from '../../game/species';
import { fx10 } from '../../game/v10/skills10';
import type { Skill10 } from '../../game/v10/skills10';
import {
  mails, unreadMail, addMail, markMailRead, weekTargets, weekNo, today, markFirst, hadFirst, awardRp, pickBy, daySum,
} from '../../game/v9/research9';
import type { Mail, Session } from '../../game/v9/research9';
import type { OSCtx } from '../v4/moriResearch';
import { esc, plural } from '../v4/moriResearch';
import { sfx } from '../v7/aeroFx';
import { mascot } from './icons10';
import { overall, CATS } from './encyData';

export interface AgencyApp {
  open(id?: string): void;
  refresh(): void;
  /** answer an upload session; returns the new mail */
  react(s: Session): Mail[];
  /** the welcome mail (once) */
  welcome(): Mail | null;
  /** a skill was bought */
  onSkill(s: Skill10, n: number): Mail | null;
}

/** who writes */
const FROM: Record<string, { name: string; sig: string; mood: 'happy' | 'wow' | 'meh' | 'wink' }> = {
  tua: { name: 'Tua (ZEA)', sig: 'Tua · Agency Mascot & Chief Morale Officer · 200 million years of experience', mood: 'happy' },
  pratt: { name: 'Dr Imogen Pratt', sig: 'Dr Imogen Pratt · Expedition Coordinator, Zealandia Expedition Agency', mood: 'happy' },
  clive: { name: 'Clive · Accounts', sig: 'Clive · Accounts (Research Points Division)', mood: 'meh' },
  liaison: { name: 'ZEA Cultural Liaison', sig: 'Cultural Liaison Office · Zealandia Expedition Agency', mood: 'happy' },
};
export const fromName = (k: string) => FROM[k]?.name ?? k;

const p = (s: string) => `<p>${s}</p>`;
const b = (s: string) => `<b>${esc(s)}</b>`;
const list = (names: string[], max = 4) => names.length <= max ? names.map(b).join(', ').replace(/, ([^,]*)$/, ' and $1') : names.slice(0, max).map(b).join(', ') + ` and ${names.length - max} more`;

export function agencyApp(os: OSCtx): AgencyApp {
  let w: HTMLElement | null = null;
  let cur: string | null = null;
  const live = () => !!w && w.isConnected && !os.closed();

  // ---------------------------------------------------------------- writing mail
  const send = (id: string, from: string, subj: string, html: string, tag?: string): Mail | null => addMail({ id, from, subj, html, tag });

  const welcome = () => send('welcome', 'tua', 'Welcome to the Zealandia Expedition Agency!',
    p('Kia ora, Mori!')
    + p('Tua here: official mascot of the <b>Zealandia Expedition Agency</b> (ZEA), the people who sent your expedition, and a tuatara, which means my family has been doing fieldwork for about 200 million years. You are in good claws.')
    + p('How this works:')
    + `<ul><li><b>Photograph</b> everything. Sharp, close, and the whole animal please, not just the bottom end.</li><li><b>Collect</b> samples: feathers, leaves, shells, droppings (gloves!).</li><li><b>Upload everything</b> at the camp laptop: photos, specimens for the research crate and your field notes, in one go.</li><li>We pay <b>Research Points</b> for every new species, behaviour, finding, sample and place. Spend them in the <b>Skill Tree</b>.</li><li>Your work fills the <b>Zealandia Encyclopedia</b>. Nobody has ever written most of its pages.</li></ul>`
    + p('Each week we set three targets, with a bonus when you hit all three. No pressure. (Some pressure.)')
    + p('This message reached you through the SatLink beacon in your field camera. It does text only, very slowly, so please don’t reply with photos: upload them.')
    + p('Please do not feed the mascot.'), 'welcome');

  /** the reply to an upload session */
  const react = (s: Session): Mail[] => {
    const out: Mail[] = [];
    const push = (m: Mail | null) => { if (m) out.push(m); };
    /** an agency bonus (counted in the session, so the day report shows it) */
    const bonus = (base: number, id: string) => { const rp = awardRp(base, 'bonus', id); s.rp += rp; return rp; };
    const day = s.day, wk = weekNo(day);
    const n = daySum(day).sessions;
    const seed = `${day}:${n}:${s.photos}:${s.items.length}`;
    const spNames = s.species.map(id => SPECIES_BY_ID[id]?.name ?? id);
    const smp = s.items.filter(o => o.cat === 'sample' || o.cat === 'flora');
    const arts = s.items.filter(o => o.cat === 'artifact');
    const fos = s.items.filter(o => o.cat === 'fossil');
    const places = s.notes.filter(x => ['location', 'landmark', 'village', 'ruin', 'cave', 'ecosystem'].includes(x.d.kind));
    // the week's targets go out first, once a week (with a look back at last week)
    if (markFirst('mail:week:' + wk)) {
      const t = weekTargets(wk);
      const prev = wk > 1 ? weekTargets(wk - 1) : null;
      const look = prev ? (prev.paid ? p(`Last week: every target met. The board applauded. Clive from Accounts clapped once, which for Clive is a standing ovation.`) : p(`Last week: ${prev.targets.filter(x => x.have >= x.need).length} of ${prev.targets.length} targets. The board said “hmm”. Clive said “HMM”. Fresh week, fresh start.`)) : '';
      push(send('week:' + wk, 'pratt', `Week ${wk} targets`, p('Dear Mori,') + look + p(`Here are your targets for week ${wk} (days ${t.days[0]}–${t.days[1]}):`) + `<ul>${t.targets.map(x => `<li>${esc(x.label)}: <b>${x.need}</b></li>`).join('')}</ul>` + p(`Meet all three and the agency pays a bonus of <b>${t.bonus} RP</b>. Progress is on the ZEA Mail sidebar.`) + p('Good luck out there, and do keep the pug away from the cliffs.'), 'week'));
    }
    // the upload reply
    const got = [s.photos ? plural(s.photos, 'photo') : '', s.items.length ? plural(s.items.reduce((a, o) => a + o.n, 0), 'specimen') : '', s.notes.length ? plural(s.notes.length, 'field note') : ''].filter(Boolean).join(', ');
    const body: string[] = [p(pickBy(seed + 'hi', ['Dear Mori,', 'Hi Mori!', 'Mori!', 'Kia ora Mori,']))];
    body.push(p(`Your upload from day ${day} arrived safely: ${got}.`));
    if (s.species.length >= 3) body.push(p(`${list(spNames)}: ${s.species.length} new species in one upload! The board stood up. Clive sat back down because of his knee.`));
    else if (s.species.length) body.push(p(pickBy(seed + 'sp', [`A new species: ${list(spNames)}! We printed the photo and stuck it on the office fridge.`, `${list(spNames)}, documented for the first time ever. Our biologists made a noise only dogs can hear.`, `New species: ${list(spNames)}. Tua did a little dance. Tuatara are not built for dancing.`])));
    if (s.beh.length) body.push(p(s.species.length ? `Plus ${plural(s.beh.length, 'behaviour')} on record.` : `No new species today, but ${plural(s.beh.length, 'new behaviour')}. Behaviour is where the real science lives. (Tua insists. Tua has been watching behaviour since the Triassic.)`));
    if (s.facts.length) body.push(p(`${plural(s.facts.length, 'new finding')} confirmed by your photos. Peer review is going to love this. Peer review loves nothing.`));
    if (smp.length) body.push(p(pickBy(seed + 'smp', [`The lab enjoyed your ${plural(smp.length, 'sample')}, especially the ${b(smp[0].name)}. Please keep labelling them; “brown thing, maybe poo” was last week’s low point.`, `${plural(smp.length, 'sample')} analysed, the ${b(smp[0].name)} among them. The microscope has asked for a holiday.`, `Sample results are in for the ${list(smp.map(o => o.name), 3)}. Gloves on for the droppings, please. Our insurance asks.`])));
    if (fos.length) body.push(p(`And ${fos.length === 1 ? 'a fossil' : plural(fos.length, 'fossil')}: ${list(fos.map(o => o.name))}! Our palaeontologist replied to the scan with seven exclamation marks and no words.`));
    if (arts.length) body.push(p(`Thank you for documenting ${list(arts.map(o => o.name))} so carefully. ${arts.some(o => o.taonga) ? 'Taonga belong to their people: please keep them wrapped and safe at camp until they can go home to the village. Our cultural liaison will write separately.' : 'Please keep them safe at camp until we know who they belong to.'}`));
    if (places.length) body.push(p(`${plural(places.length, 'new place')} on the map: ${list(places.map(x => x.d.name))}. The cartography team has run out of pins and is now using noodles.`));
    if (s.photos && !s.ok && !s.items.length) body.push(p(pickBy(seed + 'blur', [`Our analysts describe today’s photos as “mostly leaves, one thumb”. Hold the camera steady for the full ${fx10.captureHold()} seconds; it’s in the manual, next to the drawing of a thumb.`, `We received ${plural(s.photos, 'photo')} of what appears to be the general idea of an animal. Closer, sharper, and the whole animal next time?`, `Lovely photos of the island. Nothing in them we can identify, but lovely.`])));
    if (s.rp) body.push(p(`<b>${s.rp} RP</b> credited to your account.${s.bonus ? ` That includes the week ${wk} bonus of ${s.bonus} RP: all targets met!` : ''} ${pickBy(seed + 'rp', ['Please do not spend it all on noodles.', 'Clive asks us to remind you that RP cannot be exchanged for noodles. He has been asked a lot.', 'Spend it in the Skill Tree, not on the pug.', 'Treat yourself to a skill. You have earned it.'])}`));
    const t = weekTargets(wk);
    body.push(`<div class="zm-tg">${t.targets.map(x => `<span class="${x.have >= x.need ? 'ok' : ''}">${esc(x.label)} <b>${x.have}/${x.need}</b></span>`).join('')}</div>`);
    const who = s.species.length || arts.length || fos.length ? 'tua' : s.photos && !s.ok && !s.items.length ? 'clive' : 'pratt';
    const subj = s.species.length ? `Re: day ${day}: ${s.species.length === 1 ? 'a new species!' : `${s.species.length} new species!`}` : arts.length ? `Re: day ${day}: artifacts documented` : fos.length ? `Re: day ${day}: a fossil!` : s.photos && !s.ok && !s.items.length ? `Re: day ${day}: about these photos…` : `Re: day ${day} upload`;
    push(send(`up:${day}:${n}`, who, subj, body.join(''), 'upload'));
    // firsts
    const docs = Object.keys(game.save.research).length;
    if (s.species.length && markFirst('mail:first:species')) push(send('first:species', 'tua', 'FIRST SPECIES!', p(`Mori! The ${b(spNames[0])}! The first page of the Zealandia Encyclopedia is written.`) + p('I did a little dance. It was mostly tail. Here is a bonus for the first of many.') + p(`<b>+${bonus(15, 'first:species')} RP</b>`), 'first'));
    const para = s.species.find(id => SPECIES_BY_ID[id]?.group === 'Parasite');
    if (para && markFirst('mail:first:parasite')) push(send('first:parasite', 'pratt', 'A parasite! (Our parasitologist is thrilled)', p(`The ${b(SPECIES_BY_ID[para].name)}! Our parasitologist has framed your photo. She has never been happier, and it is a little worrying.`) + p('Parasites are half the food web and nobody photographs them. Thank you.') + p(`<b>+${bonus(15, 'first:parasite')} RP</b>`), 'first'));
    for (const a of arts.filter(o => o.taonga)) {
      if (!markFirst('mail:taonga:' + a.id)) continue;
      push(send('taonga:' + a.id, 'liaison', `About the ${a.name}`, p('Kia ora Mori,')
        + p(`Thank you for the care you took documenting the ${b(a.name)}. We would like to say a few words about it.`)
        + p('This is a taonga: a treasure that belongs to the people whose ancestors made it. It is not a specimen and it is not the agency’s. Please keep it wrapped, dry and safe at camp, untouched beyond the photographs you have already taken, until it can be returned to the village.')
        + p('When you meet the people it belongs to, the right thing is to ask, and to listen. Its name and its story are theirs to share, or not. No number of Research Points is worth more than that.')
        + p('Ngā mihi,'), 'taonga'));
    }
    if (fos.length && markFirst('mail:first:fossil')) push(send('first:fossil', 'pratt', 'Your first fossil', p(`A fossil! The ${b(fos[0].name)} is older than the island’s name, and very possibly older than the island.`) + p('Our palaeontologist has requested “all of it, immediately”. We have told her it stays safe at camp with the rest of the finds.'), 'first'));
    if (places.length && markFirst('mail:first:place')) push(send('first:place', 'tua', 'A place on the map!', p(`${b(places[0].d.name)} is officially on the Zealandia map. Our cartographers are naming a coffee mug after it.`) + p(`<b>+${bonus(10, 'first:place')} RP</b>`), 'first'));
    // milestones: documented species and the encyclopedia
    for (const [m, rp] of [[5, 20], [10, 35], [25, 60], [50, 100]] as const) {
      if (docs >= m && markFirst('mail:species:' + m)) push(send('species:' + m, 'tua', `${m} species documented!`, p(`${m} species in the encyclopedia! The office has a chart. The chart is going up. Clive has never seen a chart go up before.`) + p(`Milestone bonus: <b>+${bonus(rp, 'mile:species:' + m)} RP</b>`), 'mile'));
    }
    const ov = overall();
    for (const [m, rp] of [[10, 25], [25, 50], [50, 100], [75, 150], [100, 300]] as const) {
      if (ov.pct >= m && markFirst('mail:enc:' + m)) push(send('enc:' + m, m === 100 ? 'tua' : 'pratt', m === 100 ? 'The Zealandia Encyclopedia is COMPLETE' : `The encyclopedia is ${m}% complete`, (m === 100 ? p('Every page. Every species, plant, place and find. Mori, you absolute legend. Tua is crying. Tuatara cannot cry. Tua is crying anyway.') : p(`The Zealandia Encyclopedia has reached <b>${m}%</b>. Best so far: ${esc(CATS.find(c => c.id === [...ov.stats].sort((a, x) => x.pct - a.pct)[0].cat)?.name ?? '')}.`)) + p(`Milestone bonus: <b>+${bonus(rp, 'mile:enc:' + m)} RP</b>`), 'mile'));
    }
    if (s.bonus) push(send('met:' + wk, 'tua', `Week ${wk}: ALL TARGETS MET!`, p(`Every target for week ${wk}, done. The agency has wired your bonus: <b>${s.bonus} RP</b>.`) + p('Tua is very proud. Tua is wearing the good helmet today.'), 'mile'));
    return out;
  };

  const onSkill = (s: Skill10, n: number) => {
    if (n !== 1 && s.tier < 3) return null;
    return send('skill:' + s.id, n === 1 ? 'tua' : 'pratt', n === 1 ? 'Your first skill!' : `Certified: ${s.name}`, n === 1
      ? p(`You spent your first Research Points on ${b(s.name)}. Excellent choice. (I say that about all of them. This one especially.)`) + p(esc(s.effect))
      : p(`Congratulations on ${b(s.name)}. Our training department says nobody has ever finished that course in the field, on an island, with a pug.`) + p(esc(s.effect)), 'skill');
  };

  // ---------------------------------------------------------------- the app
  const open = (id?: string) => {
    if (id) cur = id;
    if (os.find('mail') && live()) { render(); os.win('mail', '', 'mail', 0, 0, el('div')); return; }
    w = el('div', 'zm');
    w.dataset.direct = '1';
    const W = os.win('mail', 'ZEA Mail', 'mail', 820, 560, w);
    if (!W) return;
    welcome();
    render();
  };
  const render = () => {
    if (!w) return;
    const all = mails().slice().reverse();
    if (!cur || !all.some(m => m.id === cur)) cur = all.find(m => !m.read)?.id ?? all[0]?.id ?? null;
    const t = weekTargets();
    w.innerHTML = `<div class="zm-top"><span class="lg"></span><b>ZEA Mail</b><span class="sl">SatLink · text only · 0.3 kB/s</span><span class="rp">${game.save.rp} RP</span></div>
      <div class="zm-body"><div class="zm-side"><div class="zm-week"><h5>Week ${t.week} targets${t.paid ? ' <em>met!</em>' : ''}</h5>${t.targets.map(x => `<div class="trow${x.have >= x.need ? ' ok' : ''}"><span>${esc(x.label)}</span><i><u style="width:${(Math.min(1, x.have / x.need) * 100).toFixed(0)}%"></u></i><b>${x.have}/${x.need}</b></div>`).join('')}<small>Days ${t.days[0]}–${t.days[1]} · bonus ${t.bonus} RP${fx10.rpMult() !== 1 ? ` ×${fx10.rpMult().toFixed(2)}` : ''}</small></div><div class="zm-list"></div></div><div class="zm-read"></div></div>`;
    (w.querySelector('.zm-top .lg') as HTMLElement).appendChild(mascot('happy', 0.8));
    const L = w.querySelector('.zm-list') as HTMLElement;
    if (!all.length) L.appendChild(el('div', 'zm-none', 'No mail yet. Upload something and the agency will be in touch.'));
    for (const m of all) {
      const r = el('div', 'zm-row ctl' + (m.read ? '' : ' un') + (m.id === cur ? ' on' : '') + (m.tag ? ' ' + m.tag : ''), `<i></i><span><b>${esc(fromName(m.from))}</b><em>${esc(m.subj)}</em></span><small>Day ${m.day}</small>`);
      r.addEventListener('click', () => { if (cur === m.id) return; cur = m.id; sfx.pick(); render(); });
      L.appendChild(r);
    }
    const R = w.querySelector('.zm-read') as HTMLElement;
    const m = all.find(x => x.id === cur);
    if (!m) { R.innerHTML = `<div class="zm-none big">Inbox zero. Tua approves.</div>`; return; }
    const f = FROM[m.from] ?? FROM.pratt;
    R.innerHTML = `<div class="zm-hd"><span class="av"></span><div><b>${esc(m.subj)}</b><span>From <em>${esc(f.name)}</em> · day ${m.day}</span></div></div><div class="zm-txt">${m.html}<p class="sig">${esc(f.sig)}</p></div>`;
    const mood = m.tag === 'mile' || m.tag === 'first' ? 'wow' : m.from === 'clive' ? 'meh' : m.tag === 'skill' ? 'wink' : f.mood;
    (R.querySelector('.av') as HTMLElement).appendChild(m.from === 'tua' || m.from === 'pratt' || m.from === 'clive' ? mascot(m.from === 'tua' ? mood : m.from === 'clive' ? 'meh' : 'happy', 1.1) : os.icon('mail', 1.6));
    if (!m.read) {
      markMailRead(m.id);
      os.badges();
      const row = L.querySelector('.zm-row.on');
      row?.classList.remove('un');
      if (m.tag === 'mile' || m.tag === 'first') { const c = os.center(R); setTimeout(() => { if (R.isConnected) { os.fx.confetti(c.x, c.y - R.offsetHeight / 2, 40, R.offsetWidth * 0.6); sfx.star(); } }, 200); }
    }
    R.scrollTop = 0;
  };

  return { open, refresh: () => { if (live()) render(); }, react, welcome, onSkill };
}

export const unreadCount = () => unreadMail();
export const mailToday = () => mails().filter(m => m.day === today()).length;
export const hadWelcome = () => hadFirst('mail:welcome') || mails().some(m => m.id === 'welcome');
