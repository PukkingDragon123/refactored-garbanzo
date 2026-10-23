// MoriOS look, as pixel art: the sky-blue "aero" chrome kept, but drawn in hard pixels. The laptop shell,
// window frames, gel buttons, panels, dithered glass, the start orb and the badges are painted 9-slices
// and sprites (./osSkin, put on .mos-wrap as CSS variables, 2 screen px per art px); fills are hard
// bands, corners are steps, shadows are offset copies, and nothing is blurred.

export const AERO_CSS = `
.mos-wrap { --ink:#12304a; --ink2:#3a5a78; --aq:#22c4e6; --aqd:#0a6d98; --gr:#5cc43c; --grd:#1f6410; --bar:42px; --tb:32px;
  position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; pointer-events: auto; touch-action: none;
  -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; cursor: none;
  background: rgba(2,12,22,0.86); animation: mosIn 0.3s steps(4) both;
  font-family: 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); -webkit-font-smoothing: none; font-smooth: never; }
.mos-wrap * { cursor: none !important; box-sizing: border-box; }
.mos-wrap img, .mos-wrap canvas { image-rendering: pixelated; }
.mos-wrap.bye { transition: opacity 0.25s steps(3); opacity: 0; }
@keyframes mosIn { from { opacity: 0; } }
.mos-lap { position: relative; width: min(96vw, 1100px); height: min(86vh, 650px); padding: 0;
  border-style: solid; border-width: 16px 16px 24px 16px; border-image: var(--os-lap) 8 8 12 8 / 16px 16px 24px 16px; image-rendering: pixelated;
  filter: drop-shadow(0 8px 0 rgba(0,0,0,0.35)); animation: mosLap 0.5s steps(6) both; }
@keyframes mosLap { 0% { transform: translateY(40px); opacity: 0; } 55% { opacity: 1; } }
.mos-lap::before { content: ''; position: absolute; top: -10px; left: 50%; width: 4px; height: 4px; margin-left: -2px; background: #1a2a36; box-shadow: 0 0 0 2px #8a9cac; }
.mos-brand { position: absolute; bottom: -21px; left: 50%; transform: translateX(-50%); font: 17px/18px 'Jersey 10', 'Pixelify Sans', monospace; color: #6d8397; letter-spacing: 0.18em; text-shadow: 0 1px 0 #fff; display: flex; gap: 8px; align-items: center; pointer-events: none; }
.mos-brand i { width: 6px; height: 4px; background: #5ff0ff; box-shadow: 0 0 0 1px #1a6a80; animation: mosLed 3s steps(2) infinite; }
@keyframes mosLed { 50% { background: #2a9ab8; } }
.mos-scr { position: relative; width: 100%; height: 100%; overflow: hidden; background: #62b6f0; isolation: isolate; }
@media (max-height: 540px), (max-width: 640px) {
  .mos-wrap { --bar: 36px; --tb: 30px; }
  .mos-lap { width: 100%; height: 100%; border-width: 4px; border-image: none; border-color: #1e2a36; filter: none; animation-name: mosLapS; }
  .mos-lap::before, .mos-brand { display: none; }
}
@keyframes mosLapS { 0% { opacity: 0; } }

/* ---- wallpaper, clouds, the pixel sun (no rays or soft flares) */
.mos-bg { position: absolute; left: 0; top: 0; z-index: 0; will-change: transform; }
.mos-bg img { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; display: block; }
.mos-cloud { position: absolute; left: 0; top: 0; image-rendering: pixelated; will-change: transform; transform-origin: 0 0; }
.mos-sun { position: absolute; left: -80px; top: -80px; width: 162px; height: 162px; z-index: 1; pointer-events: none; background: var(--os-sun) 0 0 / 100% 100% no-repeat; image-rendering: pixelated; animation: mosSun 3s steps(2) infinite; }
@keyframes mosSun { 50% { filter: brightness(1.04); } }
.mos-rays { display: none; }
.mos-flare { position: absolute; left: 0; top: 0; z-index: 1; pointer-events: none; will-change: transform, opacity; }
.mos-flare.f0, .mos-flare.f2 { display: none; }
.mos-flare.f1 { width: 6px; height: 6px; background: rgba(255,250,200,0.55); box-shadow: 6px 6px 0 -2px rgba(255,250,200,0.4); }
.mos-flare.f3 { width: 4px; height: 4px; background: rgba(255,255,255,0.8); }
.mos-fxb, .mos-fxf { position: absolute; left: 0; top: 0; pointer-events: none; image-rendering: pixelated; }
.mos-fxb { z-index: 2; } .mos-fxf { z-index: 70; }

/* ---- desktop icons */
.mos-icons { position: absolute; left: 8px; top: 8px; bottom: calc(var(--bar) + 6px); z-index: 3; display: grid; grid-auto-flow: column; grid-template-rows: repeat(auto-fill, 84px); grid-auto-columns: 84px; gap: 2px 4px; }
.mos-ic { position: relative; width: 84px; height: 84px; display: flex; flex-direction: column; align-items: center; padding-top: 0; color: #fff; text-align: center;
  border: 6px solid transparent; image-rendering: pixelated;
  font: 18px/15px 'Jersey 15', 'Pixelify Sans', monospace; text-shadow: 0 1px 0 #0b2f4c, 1px 0 0 #0b2f4c, -1px 0 0 #0b2f4c, 0 -1px 0 #0b2f4c, 1px 2px 0 rgba(8,40,64,0.6); }
.mos-ic .pxi { margin-bottom: 4px; transform-origin: 50% 100%; filter: drop-shadow(0 2px 0 rgba(0,40,70,0.35)); }
.mos-ic.hov, .mos-ic.sel { border-image: var(--os-glass) 3 fill / 6px; }
.mos-ic.hov .pxi { animation: icHop 0.5s steps(5); }
.mos-ic.pop .pxi { animation: icSquash 0.5s steps(5); }
@keyframes icHop { 0% { transform: none; } 30% { transform: translateY(-8px); } 60% { transform: translateY(0); } 80% { transform: translateY(-2px); } 100% { transform: none; } }
@keyframes icSquash { 0% { transform: scale(1.25, 0.75); } 35% { transform: translateY(-8px); } 70% { transform: translateY(-2px); } 100% { transform: none; } }
.mos-ic.new::after { content: ''; position: absolute; top: -4px; right: 8px; width: 20px; height: 20px; background: var(--os-badge) 0 0 / 100% 100% no-repeat; image-rendering: pixelated; animation: mosBadge 1.1s steps(2) infinite; }
@keyframes mosBadge { 0%, 60%, 100% { transform: none; } 30% { transform: translateY(-3px); } }

/* ---- gadgets: dithered glass */
.mos-gad { position: absolute; right: 10px; top: 10px; z-index: 3; display: flex; flex-direction: column; gap: 10px; width: 150px; }
.mos-gad > div { position: relative; padding: 4px 6px; color: #fff; text-shadow: 1px 1px 0 #0b3a66;
  border: 6px solid transparent; border-image: var(--os-glass) 3 fill / 6px; image-rendering: pixelated; }
.mos-gad .clockc { display: block; margin: 0 auto; width: 96px; height: 96px; image-rendering: pixelated; }
.mos-gad h4 { margin: 0; font: 20px/18px 'Jersey 10', 'Pixelify Sans', monospace; letter-spacing: 0.04em; }
.mos-gad p { margin: 2px 0 0; font: 17px/15px 'Jersey 15', 'Pixelify Sans', monospace; }
.mos-gad .dn { color: #ffe27a; }
.mos-drop { position: absolute; width: 10px; height: 10px; pointer-events: none; background: var(--os-drop) 0 0 / 100% 100% no-repeat; image-rendering: pixelated; }
@media (max-width: 860px), (max-height: 460px) { .mos-gad { display: none; } }

/* ---- taskbar */
.mos-bar { position: absolute; left: 0; right: 0; bottom: 0; height: var(--bar); z-index: 50; display: flex; align-items: center; gap: 5px; padding-left: 60px;
  background: linear-gradient(180deg, #0b2a4a 0 2px, #a8dcff 2px 4px, #5aa8f0 4px 10px, #3a8ae0 10px 50%, #2a74c4 50% calc(100% - 4px), #1c5ca8 calc(100% - 4px)); }
.mos-orb { position: absolute; left: 6px; top: 50%; width: 46px; height: 48px; margin-top: -25px; z-index: 2; display: flex; align-items: center; justify-content: center;
  background: var(--os-orb) 0 0 / 100% 100% no-repeat; image-rendering: pixelated; transition: transform 0.2s steps(2); }
.mos-orb .pxi { position: relative; z-index: 1; margin-top: -2px; }
.mos-orb.hov, .mos-orb.on { transform: translateY(-2px); filter: brightness(1.1); }
.mos-orb.press { transform: translateY(2px); transition-duration: 0.05s; }
.mos-tabs { display: flex; gap: 5px; flex: 1; min-width: 0; overflow: hidden; height: 100%; align-items: center; }
.mos-tab { position: relative; flex: 0 1 172px; min-width: 42px; height: calc(var(--bar) - 8px); display: flex; align-items: center; gap: 6px; padding: 0 6px 0 2px;
  border: 4px solid transparent; border-image: var(--os-tab) 2 fill / 4px; image-rendering: pixelated;
  color: #fff; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace; text-shadow: 1px 1px 0 #052a4a; white-space: nowrap; overflow: hidden;
  animation: mosTabIn 0.35s steps(4) both; }
@keyframes mosTabIn { from { transform: translateY(24px); } }
.mos-tab .tt { overflow: hidden; text-overflow: ellipsis; }
.mos-tab .pxi { flex: none; }
.mos-tab.on { border-image-source: var(--os-tab-on); }
.mos-tab.min { opacity: 0.75; }
.mos-tab.hov { filter: brightness(1.12); }
.mos-tab.press { transform: translateY(1px); }
.mos-tray { display: flex; gap: 10px; align-items: center; height: calc(var(--bar) - 10px); padding: 0 10px; margin-left: 4px; color: #fff; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace;
  text-shadow: 1px 1px 0 #052a4a; background: #1c5ca8; box-shadow: inset 2px 2px 0 #0b2a4a, inset -2px -2px 0 #3a8ae0; white-space: nowrap; }
.mos-tray .wf { color: #ffb4a0; }
.mos-peek { width: 12px; align-self: stretch; margin-left: 4px; background: linear-gradient(90deg, #0b2a4a 0 2px, #6ab4f4 2px 4px, #3a8ae0 4px); }
.mos-peek.hov { background: linear-gradient(90deg, #0b2a4a 0 2px, #c8ecff 2px 4px, #8acef8 4px); }
@media (max-width: 760px) { .mos-tab .tt { display: none; } .mos-tab { flex: 0 0 auto; padding: 0 4px; } .mos-tray .bt { display: none; } }

/* ---- gel buttons: painted 9-slices, hard bands, stepped ends */
.gel { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 30px; padding: 0 10px 1px; margin: 0;
  border: 6px solid transparent; border-width: 4px 6px 6px; border-image: var(--gs, var(--os-gel-blue)) 4 3 fill / 8px 6px; image-rendering: pixelated;
  font: 20px/1 'Jersey 10', 'Pixelify Sans', monospace; letter-spacing: 0.03em; color: #fff; white-space: nowrap; vertical-align: middle; --gk: #0a5f8e;
  text-shadow: 0 1px 0 var(--gk), 1px 0 0 var(--gk), -1px 0 0 var(--gk), 0 -1px 0 var(--gk), 1px 1px 0 var(--gk);
  transition: transform 0.15s steps(2), filter 0.1s; }
.gel.hov { filter: brightness(1.1); transform: translateY(-1px); }
.gel.press { border-image-source: var(--gp, var(--os-gel-blue-p)); transform: translateY(2px); transition-duration: 0.05s; }
.gel.green { --gs: var(--os-gel-green); --gp: var(--os-gel-green-p); --gk: #1c5e0e; }
.gel.pink { --gs: var(--os-gel-pink); --gp: var(--os-gel-pink-p); --gk: #80205a; }
.gel.red { --gs: var(--os-gel-red); --gp: var(--os-gel-red-p); --gk: #6e1406; }
.gel.amber { --gs: var(--os-gel-amber); --gp: var(--os-gel-amber-p); --gk: #6a3a00; }
.gel.glass { --gs: var(--os-gel-glass); --gp: var(--os-gel-glass-p); --gk: #5a7a96; color: var(--ink); text-shadow: 0 1px 0 #fff; }
.gel.sm { min-height: 24px; padding: 0 6px 1px; font-size: 18px; }
.gel.big { min-height: 38px; padding: 0 18px 2px; font-size: 24px; }
.gel .k { font: 15px/1 'Jersey 15', 'Pixelify Sans', monospace; opacity: 0.85; }
.gel[disabled], .gel.off { filter: saturate(0.3) brightness(0.95); }

/* ---- windows: painted chrome, a banded title bar */
.mos-wins { position: absolute; inset: 0 0 var(--bar) 0; z-index: 10; pointer-events: none; }
.mos-win { position: absolute; display: flex; flex-direction: column; padding: 0; pointer-events: auto;
  border: 6px solid transparent; border-image: var(--os-win-i) 3 fill / 6px; image-rendering: pixelated;
  filter: drop-shadow(4px 4px 0 rgba(0,24,48,0.32)); }
.mos-win.act { border-image-source: var(--os-win); }
.mos-win.max { filter: none; }
.mos-win .tb { position: relative; z-index: 1; display: flex; align-items: center; gap: 7px; height: var(--tb); flex: none; margin: -4px -4px 4px; padding-left: 6px;
  font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; letter-spacing: 0.03em; white-space: nowrap;
  color: #eef4fa; text-shadow: 1px 1px 0 #4a5e74;
  background: linear-gradient(180deg, #dce6ee 0 2px, #bccbd8 2px 8px, #a8bccc 8px 60%, #9aaec2 60%); }
.mos-win.act .tb { color: #fff; text-shadow: 1px 1px 0 #0b2340, 2px 2px 0 rgba(11,35,64,0.45);
  background: linear-gradient(180deg, #a8dcff 0 2px, #5ab4f8 2px 8px, #2a86d8 8px 60%, #1c6cc0 60%); }
.mos-win .tb .tt { flex: 1; overflow: hidden; text-overflow: ellipsis; padding-top: 1px; }
.mos-win .ctrls { position: relative; z-index: 2; display: flex; gap: 2px; align-self: center; flex: none; margin-right: 2px; }
.mos-win .ctrls b { width: 30px; height: 22px; display: block; border: 4px solid transparent; border-image: var(--os-ctl) 3 fill / 4px; image-rendering: pixelated;
  background: var(--gl) center/18px 18px no-repeat; }
.mos-win .ctrls b.x { width: 44px; border-image-source: var(--os-ctlx); }
.mos-win .ctrls b.hov { filter: brightness(1.12); }
.mos-win .ctrls b.press { transform: translateY(1px); filter: brightness(0.92); }
.mos-win .bd { position: relative; z-index: 1; flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 10px 12px 12px;
  background: #fbfdff; box-shadow: 0 0 0 2px #0b2340; font: 18px/19px 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); }
.mos-win.dark .bd { background: #06140f; color: #8dffc8; }
.mos-win.dark .tb { color: #eaffff; }
.mos-win .bd::-webkit-scrollbar { width: 14px; height: 14px; }
.mos-win .bd::-webkit-scrollbar-track { background: #dce6ee; box-shadow: inset 2px 0 0 #b8c8d6; }
.mos-win .bd::-webkit-scrollbar-thumb { border: 2px solid #0b3a66; background: linear-gradient(90deg, #a8dcff 0 2px, #5aa8f0 2px); }
.mos-win .bd { scrollbar-color: #5aa8f0 #dce6ee; }
.mos-wiggle { animation: mosWig 0.45s steps(5); }
@keyframes mosWig { 20% { translate: -6px 0; } 40% { translate: 6px 0; } 60% { translate: -4px 0; } 80% { translate: 2px 0; } }
.mos-shake { animation: mosShake 0.4s steps(5); }
@keyframes mosShake { 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-2px); } 80% { transform: translateX(2px); } }

/* ---- menus, start menu, popovers */
.mos-menus { position: absolute; inset: 0; z-index: 60; pointer-events: none; }
.mos-pop { position: absolute; pointer-events: auto; animation: mosPop 0.24s steps(3) both; filter: drop-shadow(4px 4px 0 rgba(0,24,48,0.3)); }
@keyframes mosPop { from { transform: translateY(8px); opacity: 0; } 60% { opacity: 1; } }
.mos-pop.bye { animation: mosPopOut 0.14s steps(2) both; }
@keyframes mosPopOut { to { transform: translateY(4px); opacity: 0; } }
.mos-menu { min-width: 170px; padding: 0; border: 6px solid transparent; border-image: var(--os-panel) 3 fill / 6px; image-rendering: pixelated; }
.mos-menu .mi { display: flex; align-items: center; gap: 8px; min-height: 28px; padding: 2px 12px 2px 6px; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); white-space: nowrap; }
.mos-menu .mi .pxi { width: 24px; height: 24px; }
.mos-menu .mi.hov { background: linear-gradient(180deg, #4aa8f0 0 2px, #2a86d8 2px); color: #fff; text-shadow: 1px 1px 0 #0b2340; }
.mos-menu .mi.press { transform: translateY(1px); }
.mos-menu .mi.dim { color: #8aa0b4; }
.mos-menu hr { border: 0; height: 2px; margin: 4px 6px; background: linear-gradient(180deg, #c8dce8 0 1px, #fff 1px); }
.mos-start { display: flex; gap: 6px; width: min(470px, calc(100% - 12px)); height: min(430px, calc(100% - var(--bar) - 12px)); padding: 2px; transform-origin: 20px 100%;
  border: 6px solid transparent; border-image: var(--os-glass2) 3 fill / 6px; image-rendering: pixelated; }
.mos-start .l { flex: 1.25; min-width: 0; overflow: auto; padding: 0; border: 6px solid transparent; border-image: var(--os-panel) 3 fill / 6px; }
.mos-start .l .mi { display: flex; align-items: center; gap: 8px; padding: 3px 6px; font: 19px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); }
.mos-start .l .mi.hov { background: linear-gradient(180deg, #4aa8f0 0 2px, #2a86d8 2px); color: #fff; text-shadow: 1px 1px 0 #0b2340; }
.mos-start .l .mi.press { transform: translateY(1px); }
.mos-start .r { flex: 0.9; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 4px 2px 2px 4px; color: #fff; overflow: hidden; }
.mos-start .r .av { flex: none; align-self: center; width: 64px; height: 64px; margin: 2px 0 4px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, #eafcff 0 50%, #9ad8f4 50%); box-shadow: 0 0 0 2px #fff, 0 0 0 4px #083e66, 4px 4px 0 4px rgba(0,24,48,0.35); }
.mos-start .r .nm { text-align: center; font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; text-shadow: 1px 1px 0 #052a4a; margin-bottom: 4px; }
.mos-start .r .mi { white-space: nowrap; padding: 4px 8px; font: 19px/1 'Jersey 15', 'Pixelify Sans', monospace; text-shadow: 1px 1px 0 #052a4a; }
.mos-start .r .mi.hov { background: rgba(255,255,255,0.22); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.55); }
.mos-start .r .mi.press { transform: translateY(1px); }
.mos-start .r .sp { flex: 1; }
.mos-start .r .gel { align-self: flex-end; }
@media (max-height: 540px) { .mos-start .r .av { width: 48px; height: 48px; margin-top: 0; } .mos-start .r .av .pxi { width: 36px !important; height: 36px !important; } }
.mos-balloon { position: absolute; right: 8px; bottom: calc(var(--bar) + 14px); z-index: 65; width: min(300px, calc(100% - 16px)); padding: 3px 6px 4px; pointer-events: auto;
  border: 6px solid transparent; border-image: var(--os-panel) 3 fill / 6px; image-rendering: pixelated;
  filter: drop-shadow(4px 4px 0 rgba(0,24,48,0.3)); animation: mosBal 0.4s steps(4) both; transform-origin: 90% 100%; }
.mos-balloon::after { content: ''; position: absolute; right: 30px; bottom: -16px; width: 18px; height: 12px; background: var(--os-tail) 0 0 / 100% 100% no-repeat; image-rendering: pixelated; }
.mos-balloon b { display: flex; gap: 6px; align-items: center; font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #0b4a7a; margin-bottom: 3px; }
.mos-balloon span { font: 18px/17px 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink2); }
.mos-balloon.bye { transition: opacity 0.3s steps(3), transform 0.3s steps(3); opacity: 0; transform: translateY(10px); }
@keyframes mosBal { from { transform: translateY(24px); opacity: 0; } }

/* ---- lid button, touch hint, focus ring, cursor */
.mos-lid { position: absolute; left: 50%; top: -48px; z-index: 5; transform: translateX(-50%); animation: mosLid 0.5s 0.25s steps(5) both; }
.mos-lid.hov { transform: translateX(-50%) translateY(-1px); }
.mos-lid.press { transform: translateX(-50%) translateY(2px); }
@keyframes mosLid { from { opacity: 0; translate: 0 18px; } }
@media (max-height: 540px), (max-width: 640px) { .mos-lid { top: auto; bottom: 6px; left: auto; right: 7px; transform: none; min-height: 26px; animation-name: mosLidS; } .mos-lid.hov { transform: none; } .mos-lid.press { transform: translateY(1px); } .mos-bar { padding-right: 116px; } .mos-peek, .mos-tray .bt { display: none; } .mos-lid { max-width: 106px; overflow: hidden; } }
@keyframes mosLidS { from { opacity: 0; translate: 0 30px; } }
.mos-hint { position: absolute; left: 50%; top: 42%; z-index: 90; width: min(420px, calc(100% - 32px)); transform: translate(-50%, -50%); padding: 6px 10px; pointer-events: none; text-align: center; color: #fff;
  border: 6px solid transparent; border-image: var(--os-glass2) 3 fill / 6px; image-rendering: pixelated; filter: drop-shadow(4px 4px 0 rgba(0,16,32,0.45));
  font: 18px/19px 'Jersey 15', 'Pixelify Sans', monospace; text-shadow: 1px 1px 0 #052a4a; animation: mosBal 0.4s steps(4) both; }
.mos-hint b { display: block; font: 24px/1 'Jersey 10', 'Pixelify Sans', monospace; margin-bottom: 4px; }
.mos-hint.bye { transition: opacity 0.4s steps(4); opacity: 0; }
.mos-focus { position: absolute; left: 0; top: 0; z-index: 75; pointer-events: none; opacity: 0; transition: opacity 0.15s steps(2);
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #22c4e6, 0 0 0 6px #0b3a66; }
.mos-focus.on { opacity: 1; animation: mosFoc 1s steps(2) infinite; }
@keyframes mosFoc { 50% { box-shadow: 0 0 0 2px #22c4e6, 0 0 0 4px #fff, 0 0 0 6px #0b3a66; } }
.mos-cur { position: absolute; left: 0; top: 0; width: 36px; height: 36px; z-index: 300; pointer-events: none; background: 0 0 / 100% 100% no-repeat; image-rendering: pixelated; transform-origin: 2px 2px; will-change: transform;
  filter: drop-shadow(2px 2px 0 rgba(0,20,40,0.35)); }
.mos-cur.off { visibility: hidden; }
.mos-hold { position: absolute; left: 0; top: 0; z-index: 299; width: 52px; height: 10px; margin-top: 30px; pointer-events: none; opacity: 0;
  background: linear-gradient(90deg, #8ff0dc var(--p, 0%), #1c4466 0); box-shadow: 0 0 0 2px #0b2a46, 0 0 0 4px #fff; }
.mos-hold.on { opacity: 1; animation: mosHold 0.37s steps(6) both; }
@property --p { syntax: '<percentage>'; inherits: false; initial-value: 0%; }
@keyframes mosHold { from { --p: 0%; } to { --p: 100%; } }
.mos-float { position: absolute; z-index: 72; pointer-events: none; font: 26px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #fff; text-shadow: 0 2px 0 #0a5f8e, 1px 0 0 #0a5f8e, -1px 0 0 #0a5f8e, 0 -1px 0 #0a5f8e, 2px 2px 0 #0a5f8e; animation: mosFloat 0.9s steps(9) both; }
@keyframes mosFloat { 0% { transform: translate(-50%, 0); opacity: 0; } 25% { transform: translate(-50%, -18px); opacity: 1; } 100% { transform: translate(-50%, -48px); opacity: 0; } }

/* ---- app content */
.mos-win h3 { margin: 0 0 6px; font: 24px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #0b4a7a; letter-spacing: 0.02em; }
.mos-win p { margin: 6px 0; }
.ribbon { display: flex; gap: 2px; margin: -10px -12px 8px; padding: 4px 8px 0; background: linear-gradient(180deg, #eef7fd 0 50%, #d6e8f5 50%); box-shadow: inset 0 -2px 0 #9ab8d0; font: 17px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink2); }
.ribbon span { padding: 3px 10px 4px; }
.ribbon span.on { background: #fff; color: var(--ink); box-shadow: 2px 0 0 #9ab8d0, -2px 0 0 #9ab8d0, 0 -2px 0 #9ab8d0; }
.xl { border-collapse: separate; border-spacing: 0; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace; }
.xl td, .xl th { border-right: 1px solid #c4d6e4; border-bottom: 1px solid #c4d6e4; padding: 4px 9px 3px; text-align: right; min-width: 58px; height: 26px; }
.xl th { background: linear-gradient(180deg, #f6fbff 0 50%, #dcebf6 50%); text-align: center; font-weight: 400; color: #2a4a66; }
.xl td.hov { background: #eaf7ff; }
.xl td.sel { background: #c8ecff; box-shadow: inset 0 0 0 2px #22a4e0; }
.xl tr.sum td { background: linear-gradient(180deg, #fbfff2 0 50%, #eaf8d4 50%); color: #1f6410; }
.xl tr.sum td.hov { background: #d8f6c0; }
.xl tr.sum td.bump { animation: mosBump 0.4s steps(4); }
@keyframes mosBump { 0% { transform: translateY(-4px); } 50% { transform: translateY(2px); } 100% { transform: none; } }
.fx { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace; }
.fx b { font-weight: 400; min-width: 40px; text-align: center; padding: 4px 6px 3px; background: linear-gradient(180deg, #fff 0 50%, #e4eff8 50%); box-shadow: 0 0 0 2px #9ab8d0; }
.fx i { font-style: normal; color: #2a8ad0; padding: 0 2px; }
.fx span { flex: 1; min-height: 25px; padding: 4px 8px 3px; background: #fff; box-shadow: 0 0 0 2px #9ab8d0, inset 0 2px 0 #e0eaf2; }
.chart { width: 440px; max-width: 100%; image-rendering: pixelated; margin-top: 6px; box-shadow: 0 0 0 2px #9ab8d0; display: block; }
.cap { margin-top: 10px; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace; }
.rp .head { display: flex; align-items: center; gap: 10px; margin: -10px -12px 10px; padding: 8px 12px; color: #fff; text-shadow: 1px 1px 0 #0a4a7a;
  background: linear-gradient(180deg, #8fdcff 0 4px, #4ab4f0 4px 46%, #2c9ee0 46% calc(100% - 4px), #0a5f8e calc(100% - 4px)); }
.rp .head b { font: 23px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; flex: 1; }
.rp .q { margin: 0 0 9px; }
.rp label { display: block; margin: 0 0 4px; color: #0b4a7a; font: 20px/1 'Jersey 10', 'Pixelify Sans', monospace; letter-spacing: 0.02em; }
.rp .tip { color: #c83a2a; font: 17px/16px 'Jersey 15', 'Pixelify Sans', monospace; min-height: 0; margin-top: 3px; }
.rp .tip:empty { display: none; }
.rp .thumbs { display: inline-flex; gap: 10px; flex-wrap: wrap; padding: 4px; margin: -4px; }
.rp .thumbs .th { position: relative; padding: 3px; background: #fff; box-shadow: 0 0 0 2px #9ab8d0, 2px 4px 0 rgba(0,40,80,0.15); transition: transform 0.2s steps(2); }
.rp .thumbs canvas { width: 96px; height: 64px; image-rendering: pixelated; display: block; }
.rp .thumbs .th.hov { transform: translateY(-3px); box-shadow: 0 0 0 2px #5ab4e8, 2px 6px 0 rgba(0,40,80,0.2); }
.rp .thumbs .th.press { transform: translateY(1px); }
.rp .thumbs .th.on { box-shadow: 0 0 0 3px #22c4e6, 0 0 0 5px #0b3a66; transform: translateY(-2px); }
.rp .thumbs .th.on::after { content: ''; position: absolute; right: -8px; top: -9px; width: 22px; height: 22px; image-rendering: pixelated;
  background: var(--ckw) 50% 55% / 16px 12px no-repeat, linear-gradient(180deg, #d8ffc0 0 4px, #7ada4a 4px 12px, #3a9a22 12px); box-shadow: 0 0 0 2px #1c5e0e; animation: mosBump 0.4s steps(4); }
.rp .ok { box-shadow: 0 0 0 3px #4cc42c, 0 0 0 5px #1c5e0e !important; }
.rp .bad { box-shadow: 0 0 0 3px #e8483a, 0 0 0 5px #6e1406 !important; }
.rp .act { display: flex; align-items: center; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
.done-stamp { margin-top: 10px; padding: 10px 12px; color: #1c5e0e; font: 18px/18px 'Jersey 15', 'Pixelify Sans', monospace;
  background: linear-gradient(180deg, #f4ffe8 0 50%, #e2f8cc 50%); box-shadow: 0 0 0 2px #6cc44a, inset 0 0 0 2px #fff, 4px 4px 0 2px rgba(28,94,14,0.18); animation: mosBal 0.4s steps(4) both; }
.done-stamp b { display: block; font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; margin-bottom: 3px; color: #2a8a18; }
.prog { position: relative; height: 18px; flex: 1; min-width: 90px; overflow: hidden; border: 4px solid transparent; border-image: var(--os-trough) 2 fill / 4px; image-rendering: pixelated; }
.prog i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; overflow: hidden;
  background: linear-gradient(180deg, #eaffd8 0 2px, #aef27a 2px 5px, #4cbc2a 5px 8px, #86e858 8px); }
.prog i::after { content: ''; position: absolute; top: 0; bottom: 0; width: 6px; left: 0; background: rgba(255,255,255,0.6); box-shadow: 10px 0 0 -1px rgba(255,255,255,0.35); animation: mosShine 1.4s steps(24) infinite; will-change: transform; }
@keyframes mosShine { from { transform: translateX(-20px); } to { transform: translateX(var(--shw, 600px)); } }
.prog.aq i { background: linear-gradient(180deg, #e8fdff 0 2px, #9aeeff 2px 5px, #22b4e2 5px 8px, #6fe6ff 8px); }
.prog.warn i { background: linear-gradient(180deg, #fff8d0 0 2px, #ffe07a 2px 5px, #f0a822 5px 8px, #ffd65a 8px); }
.prog.hot i { background: linear-gradient(180deg, #ffe8e0 0 2px, #ffae98 2px 5px, #e8442c 5px 8px, #ff8a66 8px); }
.prog span { position: absolute; inset: 0; text-align: center; font: 16px/10px 'Jersey 15', 'Pixelify Sans', monospace; color: #fff; text-shadow: 1px 1px 0 #0b2a46; }
.dd { position: relative; display: inline-flex; align-items: center; min-width: 170px; height: 30px; padding: 0 40px 0 6px; font: 19px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink);
  border: 4px solid transparent; border-image: var(--os-field) 2 fill / 4px; image-rendering: pixelated; transition: transform 0.15s steps(2); }
.dd::after { content: ''; position: absolute; right: -1px; top: -1px; bottom: -1px; width: 28px; border: 4px solid transparent; border-image: var(--os-gel-blue) 4 3 fill / 6px 4px; background: var(--arr) center / 20px 20px no-repeat; background-origin: border-box; image-rendering: pixelated; }
.dd.ph { color: #8aa0b4; }
.dd.hov { filter: brightness(1.04); box-shadow: 0 0 0 2px #3aa6e0; }
.dd.press { transform: translateY(1px); }
.numf { display: inline-flex; align-items: center; gap: 6px; }
.numf .v { min-width: 84px; height: 30px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: flex-end; font: 21px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink);
  border: 4px solid transparent; border-image: var(--os-field) 2 fill / 4px; image-rendering: pixelated; }
.numf .v.ph { color: #9ab0c4; }
.numf .v.hov, .numf .v.on { box-shadow: 0 0 0 2px #3aa6e0; }
.numf .v.on::after { content: ''; width: 2px; height: 18px; margin-left: 2px; background: #22a4e0; animation: mosBlink 1s steps(1) infinite; }
@keyframes mosBlink { 50% { opacity: 0; } }
.numf .v.press { transform: translateY(1px); }
.kp { display: grid; grid-template-columns: repeat(3, 44px); gap: 5px; padding: 6px; }
.kp .gel { min-height: 34px; padding: 0; font-size: 22px; }
.gal { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
.gal figure { margin: 0; padding: 5px 5px 4px; background: #fff; box-shadow: 0 0 0 2px #b8cfe0, 2px 4px 0 rgba(0,40,80,0.1); transition: transform 0.2s steps(2); }
.gal figure.hov { transform: translateY(-4px); box-shadow: 0 0 0 2px #5ab4e8, 2px 6px 0 rgba(0,40,80,0.18); }
.gal figure.press { transform: translateY(1px); }
.gal canvas, .gal img { width: 100%; image-rendering: pixelated; display: block; }
.gal figcaption { font: 16px/15px 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink2); padding-top: 4px; }
.big canvas, .big img { width: 100%; image-rendering: pixelated; display: block; box-shadow: 0 0 0 2px #b8cfe0; }
.disc { display: flex; gap: 10px; align-items: flex-start; padding: 8px; margin-bottom: 6px; background: linear-gradient(180deg, #ffffff 0 50%, #f0f8fd 50%); box-shadow: 0 0 0 2px #c4d8e6; }
.disc canvas { width: 48px; height: 48px; image-rendering: pixelated; flex: none; background: linear-gradient(180deg, #eafcff 0 50%, #9ad8f4 50%); box-shadow: 0 0 0 2px #fff, 0 0 0 4px #6aaed4; }
.disc b { font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #2a7a18; }
.disc i { color: #6a849a; font-style: normal; }
.disc.lock { opacity: 0.6; } .disc.lock canvas { filter: brightness(0) opacity(0.35); }
.addr { display: flex; align-items: center; gap: 6px; margin: -10px -12px 8px; padding: 6px 8px; background: linear-gradient(180deg, #f6fbff 0 50%, #dfeef8 50%); box-shadow: inset 0 -2px 0 #9ab8d0; }
.addr span { flex: 1; padding: 4px 8px 3px; background: #fff; box-shadow: 0 0 0 2px #9ab8d0; color: var(--ink2); font: 17px/1 'Jersey 15', 'Pixelify Sans', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fl { display: flex; flex-direction: column; gap: 2px; }
.fl .row { display: flex; gap: 8px; align-items: center; min-height: 30px; padding: 2px 8px; }
.fl .row .pxi { width: 24px; height: 24px; flex: none; }
.fl .row.dir { font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #0b4a7a; margin-top: 4px; }
.fl .row.f { padding-left: 34px; }
.fl .row.f.hov { background: linear-gradient(180deg, #4aa8f0 0 2px, #2a86d8 2px); color: #fff; text-shadow: 1px 1px 0 #0b2340; }
.fl .row.f.press { transform: translateY(1px); }
.fl .pwrow { padding: 4px 8px 6px 34px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.mos-in { height: 30px; padding: 0 8px; border: 4px solid transparent; border-image: var(--os-field) 2 fill / 4px; image-rendering: pixelated; font: 19px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); background: transparent; outline: none; user-select: text; -webkit-user-select: text; }
.mos-in:focus { box-shadow: 0 0 0 2px #3aa6e0; }
.np { white-space: pre-wrap; font: 19px/20px 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); min-height: 100%; }
.term { white-space: pre-wrap; font: 18px/18px 'Jersey 15', 'Pixelify Sans', monospace; }
.term .ln { display: flex; gap: 6px; align-items: center; }
.term input { flex: 1; min-width: 0; background: transparent; border: 0; color: #d8ffea; font: inherit; outline: none; caret-color: #8dffc8; user-select: text; -webkit-user-select: text; }
.term .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.pk .top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.pk .top b { font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.pk .sc { font: 20px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #1c5e0e; white-space: nowrap; }
.pk .cvw { position: relative; }
.pk canvas.spec { width: 100%; max-width: 360px; margin: 0 auto; image-rendering: pixelated; display: block; box-shadow: 0 0 0 2px #6aaed4; }
.pk .bins { display: flex; gap: 8px; margin-top: 10px; justify-content: center; flex-wrap: wrap; }
.pk .bins .gel { flex: 1; max-width: 140px; }
.pk .res { text-align: center; margin-top: 8px; }
.bp canvas { width: 100%; image-rendering: pixelated; display: block; box-shadow: 0 0 0 2px #6aaed4; }
/* ---- touch: scrollable panes pan under the finger, hit targets grow, the trackpad toggle */
.mos-win .bd, .mos-start .l, .mos-menu, .rl-list, .rl-page, .imp-main, .imp-q { touch-action: pan-x pan-y; }
.mos-win .tb, .bp canvas, .pk canvas { touch-action: none; }
.mos-menu { overflow-y: auto; overscroll-behavior: contain; }
.mos-tray .tp { display: none; align-items: center; padding: 2px 8px 3px; background: #2a74c4; box-shadow: 0 0 0 2px #0b2a4a, inset 0 2px 0 #6ab4f4; }
.mos-tray .tp.pop { animation: icSquash 0.5s steps(5); }
.mos-wrap.big .mos-tray .tp, .mos-wrap.touch .mos-tray .tp { display: inline-flex; }
.fx .zm { display: flex; align-items: center; gap: 4px; flex: none; }
.fx .zm em { font-style: normal; min-width: 44px; text-align: center; color: var(--ink2); }
.fx .zm .gel { min-width: 30px; padding: 0 4px 1px; }
.mos-wrap.big { --tb: 36px; }
.mos-wrap.big .mos-win .ctrls b { width: 40px; height: 30px; background-size: 20px 20px; }
.mos-wrap.big .mos-win .ctrls b.x { width: 54px; }
.mos-wrap.big .gel { min-height: 36px; }
.mos-wrap.big .gel.sm { min-height: 32px; padding: 0 8px 1px; }
.mos-wrap.big .mos-menu .mi { min-height: 42px; padding: 4px 16px 4px 10px; font-size: 21px; }
.mos-wrap.big .mos-menu hr { margin: 6px; }
.mos-wrap.big .mos-start .l .mi, .mos-wrap.big .mos-start .r .mi { padding: 8px 8px; }
.mos-wrap.big .dd { height: 40px; min-width: 190px; font-size: 21px; }
.mos-wrap.big .dd::after { width: 32px; }
.mos-wrap.big .numf .v { height: 40px; min-width: 100px; font-size: 24px; }
.mos-wrap.big .kp { grid-template-columns: repeat(3, 58px); gap: 6px; }
.mos-wrap.big .kp .gel { min-height: 44px; font-size: 26px; }
.mos-wrap.big .mos-in { height: 40px; font-size: 21px; }
.mos-wrap.big .fl .row { min-height: 42px; }
.mos-wrap.big .xl td, .mos-wrap.big .xl th { height: 34px; }
.mos-wrap.big .term .ln { min-height: 40px; }
.mos-wrap.big .term input { height: 36px; font-size: 20px; }
.mos-wrap.big .mos-tab { min-width: 48px; }
.mos-wrap.big .mos-lid { min-height: 32px; }
.mos-wrap.big .rp .head .gel { flex: none; }
@media (max-width: 480px) { .mos-tray .wf { display: none; } .mos-tray { gap: 6px; padding: 0 6px; } .rp .head { flex-wrap: wrap; } }
/* ---- tray glyphs */
.mos-tray > span { display: inline-flex; align-items: center; gap: 4px; }
.mos-tray .bt img.pg { vertical-align: middle; }
.mos-gad .dn img.pg { vertical-align: 0; }
/* ---- the wallpaper rests under a maximised window */
.mos-scr.wallq .mos-bg, .mos-scr.wallq .mos-rays, .mos-scr.wallq .mos-sun, .mos-scr.wallq .mos-flare, .mos-scr.wallq .mos-fxb { visibility: hidden; }
/* ---- app downloads: the installer toast and the NEW badge */
.mos-dl { position: absolute; right: 8px; bottom: calc(var(--bar) + 10px); z-index: 66; width: min(310px, calc(100% - 16px)); padding: 2px 4px 0; pointer-events: none;
  border: 6px solid transparent; border-image: var(--os-panel) 3 fill / 6px; image-rendering: pixelated; filter: drop-shadow(4px 4px 0 rgba(0,24,48,0.3)); animation: mosBal 0.4s steps(4) both; transform-origin: 90% 100%; }
.mos-dl.bye { transition: opacity 0.3s steps(3), transform 0.3s steps(3); opacity: 0; transform: translateY(10px); }
.mos-dl .hd { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #0b4a7a; }
.mos-dl .hd b { font-weight: 400; }
.mos-dl .hd span { margin-left: auto; white-space: nowrap; font: 16px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink2); }
.mos-dl .row { display: grid; grid-template-columns: 26px 1fr auto; gap: 3px 8px; align-items: center; padding: 5px 0 4px; border-top: 2px solid #d4e4f0; animation: lnIn 0.3s steps(3) both; }
.mos-dl .row .ic { grid-row: 1 / 3; display: flex; }
.mos-dl .row .ic .pxi { width: 24px; height: 24px; }
.mos-dl .row .t { min-width: 0; }
.mos-dl .row .t b { display: block; font: 19px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: var(--ink); }
.mos-dl .row .t small { display: block; font: 15px/14px 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mos-dl .row em { font: 16px/1 'Jersey 15', 'Pixelify Sans', monospace; font-style: normal; color: #2a6a9a; text-align: right; }
.mos-dl .row.done em { color: #2a8a18; }
.mos-dl .row .bar { grid-column: 2 / 4; display: block; height: 10px; padding: 2px; background: #123050; box-shadow: 0 0 0 2px #5a7a96; }
.mos-dl .row .bar i { display: block; height: 100%; width: 0; background: repeating-linear-gradient(90deg, #7ae64a 0 5px, #4cb42c 5px 6px, transparent 6px 8px); }
.mos-dl .row.done .bar i { background: repeating-linear-gradient(90deg, #b4f68a 0 5px, #6cd04a 5px 6px, transparent 6px 8px); }
.mos-ic .nw, .mos-start .mi .nw { position: absolute; left: 4px; top: 2px; z-index: 2; padding: 0 3px; border: 2px solid transparent; border-image: var(--os-new) 2 fill / 2px; image-rendering: pixelated;
  font: 8px/8px 'Silkscreen', monospace; font-style: normal; color: #6a3a00; text-shadow: none; animation: mosBadge 1.1s steps(2) infinite; pointer-events: none; }
.mos-start .mi { position: relative; }
.mos-start .mi .nw { position: static; margin-left: auto; animation: none; }
`;
