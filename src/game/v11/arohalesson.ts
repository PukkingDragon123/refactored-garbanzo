// V11: Aroha's Lesson. The morning after she joins the camp (Day 2, after breakfast) Aroha catches Mori
// heading for the bush the way he does everything, loudly, and takes him in hand:
//
//  1. tracks     at the edge of camp she kneels over the sand and reads it for him: a pūkeko's
//                splayed toes, the drag of a skink, and four big round pads she doesn't know (the
//                predators module's tiger, foreshadowed)
//  2. quiet      he follows her into the grove without a sound: creep (hold S). Stomp or run and she
//                freezes, glares, and waits until he gets it right
//  3. fork       in the grove she shows him a mānuka with the perfect fork; he cuts it (pocket knife)
//  4. blueprint  after dinner, by the fire, she shapes the fork, sketches the whole slingshot on a strip
//                of flax paper with a stick of charcoal and hands it to him: the Slingshot blueprint
//                (grantBlueprint('slingshot', 'quest:aroha')), so Mori can craft one and stand up for
//                himself when something in the forest decides he looks like dinner
//
// It is an ordinary side quest (the HUD tracks it). The island story attaches it (attachArohaLesson);
// the steps are camp events (day.ts addCampEvent) and interactables on the island.

import { game } from '../game';
import { audio } from '../../core/audio';
import { Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import { hex, mix } from '../../art/color';
import { groundY } from '../../art/island4/layout';
import { QUESTS, QUEST_BY_ID, questStatus, startQuest } from '../quests';
import type { QuestDef } from '../quests';
import { addCampEvent, dayNumber, dayPhase, addBond } from '../v10/day';
import type { IsleStory } from '../v4/islestory';
import { wait } from '../v4/islestory';
import type { CampDay } from '../v10/campday';
import { C10 } from '../v10/campcrew';
import { grantBlueprint } from './blueprints';
import { cineTo, cineBars } from './cine';
import { el } from '../../ui/ui';

const F = (k: string) => !!game.save.flags[k];
const setF = (k: string) => { game.save.flags[k] = true; game.persist(); };
/** where the lesson happens: the tracks at the bush edge past the trail sign, the mānuka in the grove */
export const LESSON = { tracks: 2504, manuka: 2790 };

// ---------------------------------------------------------------- the quest
export const AROHA_LESSON: QuestDef = {
  id: 'arohaLesson', title: 'Aroha’s Lesson', giver: 'aroha', main: false,
  desc: 'Aroha: “You walk into the bush like a moa with a sore foot, and you’ve got nothing to keep a hungry thing off you. Come here. Lesson one.”',
  steps: [
    { text: 'Read the tracks with Aroha at the edge of the bush', done: () => F('aroha:tracks'), hint: 'Past the trail sign, at the east end of camp.' },
    { text: 'Follow her into the grove without a sound', done: () => F('aroha:quiet'), hint: 'Creep: hold S (or the crouch button) and keep close behind her. No running.' },
    { text: 'Cut a forked mānuka branch for a slingshot frame', done: () => F('aroha:fork'), hint: 'The mānuka with the white flowers in the grove. Your pocket knife will do it.' },
    { text: 'Bring the fork to the fire after dinner', done: () => F('aroha:blueprint'), hint: 'Aroha will be at the fire in the evening.' },
  ],
  reward: { rp: 40, text: 'Aroha’s sketch: the Slingshot blueprint. Craft one to keep the island’s hungrier residents at a distance.' },
};
let registered = false;
export function registerArohaLesson() {
  if (registered) return;
  registered = true;
  if (!QUEST_BY_ID[AROHA_LESSON.id]) { QUESTS.push(AROHA_LESSON); QUEST_BY_ID[AROHA_LESSON.id] = AROHA_LESSON; }
}
registerArohaLesson();

const active = () => questStatus('arohaLesson') === 'active';
const campOf = (ctx: { camp: unknown }) => ctx.camp as CampDay;

// ---------------------------------------------------------------- Day 2, after breakfast: she takes him in hand
addCampEvent({
  id: 'arohaLesson', slot: 'morning', prio: 9,
  when: () => dayNumber() >= 2 && !!game.save.flags['v4:arohaJoined'] && questStatus('arohaLesson') === 'hidden',
  run: async ctx => {
    const cd = campOf(ctx), st = cd.st, s = cd.s, p = cd.p, ar = s.aroha;
    await st.cut(async () => {
      cd.hold('aroha');
      st.place(ar, p.x + 60, -1, 'armsCrossed');
      p.facing = 1;
      await st.say([
        { who: 'aroha', text: 'Mori. Where are you going?', expr: 'serious' },
        { who: 'mori', text: 'Into the bush! There’s a whole island out there nobody’s ever—', expr: 'excited' },
        { who: 'aroha', text: 'You walk like a moa with a sore foot. Everything out there hears you coming a kilometre off.', expr: 'teasing' },
        { who: 'aroha', text: 'And if something hungry hears you, what have you got? A camera. You going to take its photo?', expr: 'smug' },
        { who: 'mori', text: '...Usually, yes?', expr: 'thinking' },
        { who: 'aroha', text: 'Come on. Lesson one. Edge of the bush, past the sign.', expr: 'neutral' },
      ]);
      startQuest('arohaLesson');
      ar.walkAnim = 'walk';
      void ar.walkTo(LESSON.tracks + 18, 60);
    });
    // she waits for him at the tracks (the brains leave her alone until the lesson is over)
  },
});

// ---------------------------------------------------------------- after dinner: the sketch
addCampEvent({
  id: 'arohaBlueprint', slot: 'dinner', prio: 9,
  when: () => F('aroha:fork') && !F('aroha:blueprint'),
  run: async ctx => {
    const cd = campOf(ctx), st = cd.st, s = cd.s, ar = s.aroha;
    await st.cut(async () => {
      cd.hold('aroha');
      ar.setAnim('sit');
      cd.frame(C10.fire + 10, groundY(C10.fire) - 34, 1.9);
      cineBars(true);
      await st.say([
        { who: 'aroha', text: 'Give me your fork.', expr: 'neutral' },
        { who: 'aroha', text: '(she strips the bark with three quick strokes of her knife, rolls the fork in her palms, sights down it at the fire) ...Good wood. You chose well.', expr: 'happy' },
        { who: 'mori', text: 'You chose it. I just cut it.', expr: 'happy' },
        { who: 'aroha', text: 'Then you cut well. Now watch.', expr: 'teasing' },
        { who: 'aroha', text: '(she flattens a strip of harakeke paper on her knee and sketches with a stick of charcoal from the fire: the fork, the band, the pouch, notes in the margin)', expr: 'thinking' },
        { who: 'aroha', text: 'The rubber off one of your wrecked life rings. Leather from the bottom of your boat bag. Lash it with flax, wet, so it shrinks tight.', expr: 'serious' },
        { who: 'aroha', text: 'Pull to here. Your jaw. Not your eye, unless you want a black one. Breathe out, and let go.', expr: 'serious' },
      ]);
      await showSketch();
      const got = grantBlueprint('slingshot', 'quest:aroha');
      setF('aroha:blueprint');
      addBond('aroha', 10);
      await st.say([
        { who: 'mori', text: 'Aroha... thank you. Really.', expr: 'happy' },
        { who: 'aroha', text: 'It’s for scaring things off. Not for hunting. And never at birds.', expr: 'serious' },
        { who: 'aroha', text: '(the smirk) And if you miss, run. You’re good at running. Loudly.', expr: 'smug' },
        { who: 'jenna', text: 'Ooh, can I have one?', expr: 'excited' },
        { who: 'aroha', text: 'No.', expr: 'teasing' },
        { who: 'joshu', text: 'Thank you, lord.', expr: 'laugh' },
      ]);
      if (got) game.ui.toast('New blueprint: <b>Slingshot</b>. Craft it to defend yourself from predators.', 'BLUEPRINT', 'teal', 5200);
      cineBars(false);
      cd.release('aroha');
    });
  },
});

/** the sketch on flax paper, held up to the camera for a moment */
async function showSketch() {
  const css = `.ar-sketch{position:absolute;inset:0;display:grid;place-items:center;z-index:40;pointer-events:auto;background:rgba(8,4,2,.35);animation:arSk .4s ease-out both}
.ar-sketch .pg{position:relative;rotate:-3deg;box-shadow:0 0 0 3px #3a2614,6px 8px 0 rgba(0,0,0,.4);animation:arPg .55s cubic-bezier(.2,1.5,.4,1) both}
.ar-sketch canvas{display:block;width:min(64vw,520px);image-rendering:pixelated}
.ar-sketch .cap{position:absolute;left:0;right:0;bottom:-2.4em;text-align:center;font-family:'Jersey 10','Silkscreen',monospace;letter-spacing:.12em;color:#f4e6c6;text-shadow:2px 2px 0 #000}
@keyframes arSk{from{opacity:0}} @keyframes arPg{from{translate:0 40px;scale:.6;opacity:0}}`;
  const root = el('div', 'ar-sketch', `<style>${css}</style><div class="pg"></div>`);
  const cv = sketchArt().toCanvas(1);
  (root.querySelector('.pg') as HTMLElement).append(cv, el('div', 'cap', 'BLUEPRINT: SLINGSHOT · AROHA’S DESIGN'));
  game.ui.root.appendChild(root);
  audio.play('pageTurn', { vol: 0.6 });
  await new Promise<void>(res => {
    const done = () => { window.removeEventListener('keydown', kd, true); root.remove(); res(); };
    const kd = (e: KeyboardEvent) => { if (['Space', 'Enter', 'KeyE', 'Escape'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); done(); } };
    setTimeout(() => { window.addEventListener('keydown', kd, true); root.addEventListener('pointerdown', e => { e.stopPropagation(); done(); }); }, 600);
    setTimeout(done, 9000);
  });
}

/** Aroha's charcoal sketch on a strip of harakeke paper: the fork, the band, the pouch, her notes */
export function sketchArt(): PixelBuffer {
  const W = 180, H = 118, b = new PixelBuffer(W, H);
  const paper = hex('#d8c08a'), fib = hex('#c4a870'), fibD = hex('#b0945c'), ink = hex('#2a201c'), soft = hex('#5a4a3c');
  const rnd = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // plaited flax fibres running along the strip, ragged edges
    const edge = (y < 2 + rnd(x >> 2, 1) * 3) || (y > H - 3 - rnd(x >> 2, 2) * 3) || x < 1 + rnd(1, y >> 2) * 2 || x > W - 2 - rnd(2, y >> 2) * 2;
    if (edge) continue;
    const f = Math.sin(y * 1.9 + Math.sin(x * 0.05) * 2) > 0.82;
    b.set(x, y, f ? (rnd(x, y) > 0.5 ? fib : fibD) : rnd(x, y) > 0.93 ? fib : paper);
  }
  const line = (x0: number, y0: number, x1: number, y1: number, c = ink, w = 1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5);
    for (let i = 0; i <= n; i++) { const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u; for (let k = 0; k < w; k++) if (rnd(Math.round(x), Math.round(y) + k) > 0.12) b.set(x, y + k, c); }
  };
  // the fork: handle, crotch, prongs (charcoal, a second pass for weight)
  const cx = 58;
  line(cx, 100, cx, 62, ink, 2); line(cx + 1, 100, cx + 1, 62, soft);
  line(cx, 62, cx - 18, 26, ink, 2); line(cx, 62, cx + 18, 26, ink, 2);
  line(cx - 18, 26, cx - 20, 18, ink, 2); line(cx + 18, 26, cx + 20, 18, ink, 2);
  // the flax lashing on the grip
  for (let y = 70; y < 82; y += 2) line(cx - 3, y, cx + 4, y + 1, soft);
  // the bands and the pouch, drawn back
  line(cx - 19, 22, cx + 2, 44, soft); line(cx + 19, 22, cx + 2, 44, soft);
  for (let y = -3; y <= 3; y++) for (let x = -5; x <= 5; x++) if ((x / 5.5) ** 2 + (y / 3.5) ** 2 < 1 && ((x / 5.5) ** 2 + (y / 3.5) ** 2 > 0.55 || (x + y) % 2 === 0)) b.set(cx + 2 + x, 44 + y, ink);
  // a dotted pull line from the pouch, an arrow
  for (let x = cx + 10; x < cx + 40; x += 3) b.set(x, 44, soft);
  line(cx + 38, 41, cx + 42, 44); line(cx + 38, 47, cx + 42, 44);
  // marginal notes: little marks for words (it's her handwriting; the camera's too far to read it)
  const scrib = (x: number, y: number, n: number) => { for (let i = 0; i < n; i++) { const w = 3 + Math.floor(rnd(x + i, y) * 6); line(x, y, x + w, y + (rnd(i, y) > 0.5 ? 1 : 0), soft); x += w + 3; } };
  scrib(100, 20, 6); scrib(100, 28, 5); scrib(100, 52, 7); scrib(100, 60, 4); scrib(100, 84, 6); scrib(100, 92, 5);
  // a koru in the corner, her mark
  for (let a = 0; a < 9; a += 0.08) { const r = 1 + a * 0.85; b.set(Math.round(160 + Math.cos(a) * r), Math.round(100 + Math.sin(a) * r), ink); }
  // smudges
  for (let i = 0; i < 40; i++) { const x = Math.floor(rnd(i, 9) * W), y = Math.floor(rnd(9, i) * H); if (b.get(x, y) >>> 24) b.set(x, y, mix(b.get(x, y), ink, 0.25)); }
  return b;
}

// ---------------------------------------------------------------- on the island: the tracks, the creep, the mānuka

/** a mānuka bush: wiry grey-brown stems, tiny dark leaves, white flowers, one perfect fork */
function manukaSprite(cut: boolean) {
  const W = 40, H = 48, b = new PixelBuffer(W, H);
  const stem = hex('#5a4a3a'), stemL = hex('#7a6650'), leaf = [hex('#1e3a26'), hex('#2c5234'), hex('#3e6a42')], fl = hex('#f4f0e6'), flc = hex('#c84a52');
  const rnd = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const branch = (x0: number, y0: number, x1: number, y1: number) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.4); for (let i = 0; i <= n; i++) { const u = i / n; b.set(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, u < 0.5 ? stem : stemL); } };
  branch(20, 47, 19, 30); branch(19, 30, 11, 14); branch(19, 30, 27, 12); branch(20, 40, 31, 26); branch(20, 38, 8, 26);
  if (!cut) { branch(31, 26, 33, 20); branch(31, 26, 36, 19); }
  for (let i = 0; i < 260; i++) {
    const a = rnd(i, 3) * Math.PI * 2, r = Math.sqrt(rnd(3, i)) * 15;
    const x = Math.round(20 + Math.cos(a) * r * 1.1), y = Math.round(20 + Math.sin(a) * r * 0.9);
    if (y > 38 || x < 1 || x > W - 2) continue;
    b.set(x, y, leaf[Math.floor(rnd(i, 7) * 3)]);
    if (rnd(i, 11) > 0.9) { b.set(x, y, fl); if (rnd(i, 12) > 0.5) b.set(x + 1, y, flc); }
  }
  // the outline
  const src = b.data.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (src[y * W + x] >>> 24) continue;
    const n = (dx: number, dy: number) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < W && Y < H && (src[Y * W + X] >>> 24) > 0; };
    if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) b.set(x, y, hex('#141a12'));
  }
  return b;
}

/** prints in the sand for the lesson (drawn while the lesson is on) */
function drawTracks(rr: Parameters<Custom['fn']>[0], x0: number) {
  const y = groundY(x0) + 5;
  const ink = packColor(0.07, 0.08, 0.05, 0.42);
  const dot = (x: number, yy: number, w = 1, h = 1) => rr.rect(x, yy, w, h, ink);
  // a pūkeko's splayed toes, walking left
  for (let i = 0; i < 4; i++) { const x = x0 - 30 + i * 9, yy = y + (i % 2) * 2; dot(x, yy, 1, 1); dot(x - 2, yy - 1); dot(x - 2, yy + 1); dot(x + 1, yy); }
  // a skink's tail drag
  for (let x = x0 - 6; x < x0 + 10; x++) dot(x, y + 3 + Math.round(Math.sin(x * 0.7)));
  // four big round pads, and the heel pad (something she doesn't know)
  const pad = (x: number, yy: number) => { rr.rect(x, yy, 3, 2, ink); for (const [dx, dy] of [[-1, -2], [1, -3], [3, -3], [4, -1]]) dot(x + dx, yy + dy); };
  pad(x0 + 16, y + 1); pad(x0 + 30, y + 3);
}

let attachedTo: IsleStory | null = null;
/** the island story calls this when the island loads */
export function attachArohaLesson(st: IsleStory) {
  attachedTo = st;
  const s = st.s;
  const sp = { buf: manukaSprite(false), ax: 20, ay: 47, shadow: { w: 26 } };
  st.prop('manuka', sp, LESSON.manuka, groundY(LESSON.manuka) + 2, () => !F('aroha:fork'), -2.6);
  st.prop('manukaCut', { buf: manukaSprite(true), ax: 20, ay: 47, shadow: { w: 26 } }, LESSON.manuka, groundY(LESSON.manuka) + 2, () => F('aroha:fork'), -2.6);
  s.main.add(new Custom(-9.4, rr => { if (active() && !F('aroha:quiet')) drawTracks(rr, LESSON.tracks); }));
  const free = () => !s.cutscene && !game.ui.blocking;
  st.it({ x: LESSON.tracks, y: groundY(LESSON.tracks), w: 22, label: 'Read the tracks with Aroha', standX: LESSON.tracks - 26, quest: () => true,
    enabled: () => active() && !F('aroha:tracks') && free(), action: () => readTracks(st) });
  st.it({ x: LESSON.tracks + 18, y: groundY(LESSON.tracks), w: 20, label: 'Follow Aroha into the grove (quietly)', standX: LESSON.tracks - 10, quest: () => true,
    enabled: () => active() && F('aroha:tracks') && !F('aroha:quiet') && !creeping && free(), action: () => creep(st) });
  st.it({ x: LESSON.manuka, y: groundY(LESSON.manuka), w: 22, get label() { return game.save.tools.includes('knife') ? 'Cut the forked mānuka branch' : 'Cut the forked mānuka branch <span style="opacity:0.75">(needs Pocket knife)</span>'; }, standX: LESSON.manuka - 22, quest: () => true,
    enabled: () => active() && F('aroha:quiet') && !F('aroha:fork') && free(), action: () => cutFork(st) } as never);
  // a reload mid-lesson: Aroha is where the lesson left her
  if (active() && !F('aroha:fork') && dayPhase() !== 'night') void (async () => {
    const { campReady } = await import('../v10/campday');
    const cd = await campReady(15000);
    if (!cd || attachedTo !== st) return;
    cd.hold('aroha');
    st.place(s.aroha, F('aroha:quiet') ? LESSON.manuka + 26 : LESSON.tracks + 18, -1, F('aroha:quiet') ? 'armsCrossed' : 'idle');
  })();
}

async function readTracks(st: IsleStory) {
  const s = st.s, p = s.player, ar = s.aroha;
  await st.cut(async () => {
    ar.stopWalk();
    st.place(ar, LESSON.tracks + 16, -1, 'kneel');
    p.facing = 1;
    st.pose('crouch');
    await cineTo(s.st, { x: LESSON.tracks, y: groundY(LESSON.tracks) - 18, zoom: 2.3, secs: 0.9 });
    await st.say([
      { who: 'aroha', text: 'Look. Don’t look at the bush. Look at the sand.', expr: 'serious' },
      { who: 'aroha', text: 'Three toes splayed wide, a little hop between: pūkeko. Or its cousin. Came down to drink at dawn.', expr: 'neutral' },
      { who: 'aroha', text: 'That wiggle? A skink’s tail. It was in a hurry.', expr: 'teasing' },
      { who: 'mori', text: 'And these? Big round pads. Four toes.', expr: 'thinking' },
      { who: 'aroha', text: '(she’s quiet a long moment) ...I don’t know those. And I know everything on this beach.', expr: 'worried' },
      { who: 'aroha', text: 'That’s why you learn to move quietly. Stay close. Low. Heel last, like you’re sneaking up on breakfast.', expr: 'serious' },
    ]);
    setF('aroha:tracks');
    st.pose(null);
    ar.setAnim('idle');
    game.ui.toast('Creep: hold <span class="key">S</span> while you walk. Stay close behind her.', 'LESSON', 'teal', 4200);
  });
  void creep(st);
}

let creeping = false;
/** follow her into the grove: she only moves on while he creeps close behind, quietly */
async function creep(st: IsleStory) {
  if (creeping) return;
  creeping = true;
  const s = st.s, p = s.player, ar = s.aroha;
  ar.walkAnim = 'sneak';
  let scold = 0, x = Math.max(ar.x, LESSON.tracks + 16);
  try {
    while (x < LESSON.manuka + 26 && attachedTo === st && game.scene === s) {
      await wait(120);
      if (s.cutscene) continue;
      const near = Math.abs(p.x - (ar.x - 30)) < 46;
      const loud = p.running || (!p.crouch && Math.abs(p.vx) > 8);
      scold -= 0.12;
      if (loud && Math.abs(p.x - ar.x) < 120) {
        if (scold <= 0) {
          scold = 3.5;
          ar.stopWalk();
          ar.faceTo(p.x);
          ar.react('nod');
          audio.play('emoteQuestion', { vol: 0.3 });
          s.bark('aroha', ['Shh! Low. Heel last.', 'You sound like a herd of cattle.', 'Crouch. Slowly. Like I showed you.', 'Every bird in the grove just heard that.'][Math.floor(Math.random() * 4)], { expr: 'grumpy' });
        }
        continue;
      }
      if (near && scold < 2.5) {
        x = Math.min(LESSON.manuka + 26, ar.x + 16);
        void ar.walkTo(x, 22, 'sneak');
      } else if (!ar.walking) ar.faceTo(p.x);
    }
    if (game.scene !== s) return;
    await st.cut(async () => {
      ar.stopWalk();
      ar.x = LESSON.manuka + 26;
      ar.faceTo(p.x);
      ar.setAnim('armsCrossed');
      setF('aroha:quiet');
      await st.say([
        { who: 'aroha', text: '...See? The fantail didn’t even move. You can do it when you try.', expr: 'happy' },
        { who: 'aroha', text: 'Now. That mānuka. See the fork, the one like a bird’s wishbone? Cut it. Low, clean. Thank the tree.', expr: 'neutral' },
      ]);
    });
  } finally { creeping = false; }
}

async function cutFork(st: IsleStory) {
  const s = st.s, p = s.player;
  if (!game.save.tools.includes('knife')) { s.bark('aroha', 'You need a blade. Your pocket knife.', { expr: 'neutral' }); return; }
  await st.cut(async () => {
    p.facing = 1;
    const ok = await p.doWork('kneel', 1.6);
    if (!ok) return;
    audio.play('pluck', { vol: 0.6 });
    setF('aroha:fork');
    await st.say([
      { who: 'mori', text: '(Mori cuts the fork, low and clean) ...Thank you, tree.', expr: 'happy' },
      { who: 'aroha', text: 'Ka pai. Keep it. Tonight, by the fire, I’ll show you what it wants to be.', expr: 'happy' },
    ]);
    const cd = (await import('../v10/campday')).activeCamp();
    cd?.release('aroha');
  });
}
