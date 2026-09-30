// V4: talking Aroha down. A fast, timed dialogue: she says something, you have a few seconds to
// answer. Calm, honest answers build TRUST; shouting, grabbing or joking at the wrong moment (or just
// standing there silent) wind up her NERVES. If her nerves snap she fires a warning shot and you
// start over. Fill trust and she lowers the slingshot.

import { openMini, portraitCanvas, loop, wait } from './mini';
import { el } from '../ui';
import { audio } from '../../core/audio';
import { renderPortrait } from '../../art/v5';

export interface NegAnswer { t: string; trust: number; nerves: number; reply: string; rexpr: string }
export interface NegRound { say: string; expr: string; time: number; answers: NegAnswer[] }

const CSS = `
.mg.neg { width: min(640px, 94vw); }
.neg .top { display: flex; gap: 0.7em; align-items: stretch; }
.neg .pt { width: 112px; height: 120px; flex: none; image-rendering: pixelated; background: #f4e0b0; box-shadow: 0 0 0 3px #3a2614; position: relative; overflow: hidden; }
.neg .pt canvas { width: 112px; height: 120px; image-rendering: pixelated; display: block; }
.neg .pt.shake { animation: negShake 0.35s linear; }
@keyframes negShake { 20% { transform: translateX(-3px); } 40% { transform: translateX(3px); } 60% { transform: translateX(-2px); } 80% { transform: translateX(2px); } }
.neg .txt { flex: 1; display: flex; flex-direction: column; gap: 0.4em; min-width: 0; }
.neg .nm { font-family: 'Jersey 10', 'Silkscreen', monospace; color: #8a4b2a; font-size: 0.9em; letter-spacing: 0.08em; }
.neg .line { font-size: clamp(14px, 1.9vw, 18px); line-height: 1.32; min-height: 3.2em; color: #2a1a10; }
.neg .line.reply { color: #5a4024; font-style: italic; }
.neg .meters { display: grid; grid-template-columns: auto 1fr; gap: 0.25em 0.5em; align-items: center; font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: 0.72em; }
.neg .bar { height: 10px; background: #c8b48a; box-shadow: 0 0 0 2px #3a2614; position: relative; }
.neg .bar i { position: absolute; left: 0; top: 0; bottom: 0; transition: width 0.35s; }
.neg .bar.trust i { background: linear-gradient(#7ad07a, #3a9a4a); }
.neg .bar.nerves i { background: linear-gradient(#f08a6a, #c8402e); }
.neg .timer { height: 6px; background: #3a2614; margin: 0.55em 0 0.35em; }
.neg .timer i { display: block; height: 100%; background: #e8b840; }
.neg .timer.low i { background: #e8543a; }
.neg .ans { display: flex; flex-direction: column; gap: 0.35em; }
.neg .ans button { text-align: left; font-family: 'Jersey 15', 'Pixelify Sans', monospace; font-size: clamp(13px, 1.7vw, 16px); padding: 0.45em 0.7em; background: #fff4d8; color: #2a1a10; border: 0; box-shadow: 0 0 0 2px #3a2614, 0 3px 0 #3a2614; cursor: pointer; }
.neg .ans button:hover, .neg .ans button.sel { background: #ffe39a; }
.neg .ans button .key { margin-right: 0.5em; }
.neg .ans button:disabled { opacity: 0.55; cursor: default; }
.neg .pop { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: clamp(28px, 6vw, 56px); color: #ffe45a;
  text-shadow: 0 0 20px #ff7a2a, 0 3px 0 #3a1a10; pointer-events: none; animation: negPop 0.9s ease-out both; }
@keyframes negPop { from { transform: scale(0.3); opacity: 1; } 70% { opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
`;
let styled = false;

const shuffle = <T>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export async function runNegotiation(rounds: NegRound[], extra: NegRound[]): Promise<void> {
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const m = openMini('neg', `<h3>Talk her down</h3>
    <div class="top"><div class="pt"></div><div class="txt"><div class="nm">AROHA</div><div class="line"></div>
    <div class="meters"><span>TRUST</span><div class="bar trust"><i></i></div><span>NERVES</span><div class="bar nerves"><i></i></div></div></div></div>
    <div class="timer"><i></i></div><div class="ans"></div>
    <div class="hint">Answer fast: press <span class="key">1</span><span class="key">2</span><span class="key">3</span> or click. Stay calm, be honest, don’t make sudden moves.</div>`);
  const box = m.box;
  const pt = box.querySelector('.pt') as HTMLElement, line = box.querySelector('.line') as HTMLElement;
  const trustI = box.querySelector('.bar.trust i') as HTMLElement, nervesI = box.querySelector('.bar.nerves i') as HTMLElement;
  const timer = box.querySelector('.timer') as HTMLElement, timerI = timer.querySelector('i') as HTMLElement, ans = box.querySelector('.ans') as HTMLElement;
  let trust = 0, nerves = 55;
  const meters = () => { trustI.style.width = Math.max(0, Math.min(100, trust)) + '%'; nervesI.style.width = Math.max(0, Math.min(100, nerves)) + '%'; };
  let talkStop: (() => void) | null = null;
  const face = (expr: string, talk = false) => {
    talkStop?.();
    talkStop = null;
    const draw = (mouth: 0 | 1 | 2) => { pt.innerHTML = ''; pt.appendChild(portraitCanvas(renderPortrait('aroha', expr, { mouth }) as never)); };
    draw(0);
    if (talk) {
      let k = 0, t = 0;
      talkStop = loop(dt => { t += dt; if (t > 0.09) { t = 0; k = (k + 1) % 3; draw(k === 1 ? 1 : k === 2 ? 2 : 0); } });
      setTimeout(() => { talkStop?.(); talkStop = null; draw(0); }, 1400);
    }
  };
  const type = async (text: string, reply = false) => {
    line.classList.toggle('reply', reply);
    line.textContent = '';
    for (let i = 0; i < text.length; i++) { line.textContent = text.slice(0, i + 1); if (i % 3 === 0) audio.play('dialogBlip' as never, { vol: 0.12, pitch: 1.35 }); await wait(14); }
  };
  meters();
  const all = [...rounds];
  let i = 0;
  let won = false;
  while (!won && !m.closed) {
    const r = i < all.length ? all[i] : extra[(i - all.length) % extra.length];
    i++;
    face(r.expr, true);
    await type(r.say);
    // answers + countdown
    const opts = shuffle(r.answers);
    ans.innerHTML = '';
    const picked = await new Promise<NegAnswer | null>(res => {
      let done = false;
      const finish = (a: NegAnswer | null) => { if (done) return; done = true; stop(); window.removeEventListener('keydown', kd, true); res(a); };
      opts.forEach((a, k) => {
        const b = el('button', '', `<span class="key">${k + 1}</span>${a.t}`);
        b.addEventListener('click', () => finish(a));
        ans.appendChild(b);
      });
      const kd = (e: KeyboardEvent) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= opts.length) { e.preventDefault(); e.stopPropagation(); finish(opts[n - 1]); } };
      window.addEventListener('keydown', kd, true);
      const stop = loop((dt, t) => {
        const k = Math.max(0, 1 - t / r.time);
        timerI.style.width = k * 100 + '%';
        timer.classList.toggle('low', k < 0.3);
        if (k <= 0) { finish(null); return false; }
      });
    });
    ans.querySelectorAll('button').forEach(b => ((b as HTMLButtonElement).disabled = true));
    if (!picked) {
      nerves += 20;
      face('angry', true);
      audio.play('wrong', { vol: 0.4 });
      await type('Say something! Why aren’t you saying anything?!', true);
    } else {
      trust += picked.trust;
      nerves += picked.nerves;
      audio.play(picked.trust >= 15 ? 'fact' as never : picked.nerves > 15 ? 'wrong' : 'ui', { vol: 0.4 });
      face(picked.rexpr, true);
      if (picked.nerves > 15) { pt.classList.remove('shake'); void pt.offsetWidth; pt.classList.add('shake'); }
      await type(picked.reply, true);
    }
    meters();
    await wait(1100);
    if (nerves >= 100) {
      // warning shot: POP!
      audio.play('shipCrash' as never, { vol: 0.25, pitch: 2.2 });
      audio.play('thunderClose' as never, { vol: 0.2, pitch: 2.5 });
      const pop = el('div', 'pop', 'POP!');
      box.appendChild(pop);
      setTimeout(() => pop.remove(), 900);
      face('angry');
      await type('That was a WARNING. The next one isn’t going in the sand.', false);
      await wait(1400);
      await type('(She’s rattled. Start again, and keep calm.)', true);
      await wait(1300);
      trust = 0; nerves = 55; i = 0;
      meters();
      continue;
    }
    if (trust >= 100) won = true;
  }
  (talkStop as (() => void) | null)?.();
  face('neutral');
  await type('...', false);
  await wait(700);
  m.close();
}
