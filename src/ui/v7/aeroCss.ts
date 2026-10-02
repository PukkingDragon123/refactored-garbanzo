// MoriOS "aero" look: glossy glass, aqua and grass gel, sky palette, rendered with hard pixel bands.

export const AERO_CSS = `
.mos-wrap { --ink:#12304a; --ink2:#3a5a78; --aq:#22c4e6; --aqd:#0a6d98; --gr:#5cc43c; --grd:#1f6410; --bar:42px; --tb:32px;
  position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; pointer-events: auto; touch-action: none;
  -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; cursor: none;
  background: radial-gradient(120% 90% at 50% 38%, rgba(26,86,120,0.55), rgba(2,12,22,0.86)); animation: mosIn 0.3s ease-out both;
  font-family: 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); -webkit-font-smoothing: none; font-smooth: never; }
.mos-wrap * { cursor: none !important; box-sizing: border-box; }
.mos-wrap.bye { transition: opacity 0.25s; opacity: 0; }
@keyframes mosIn { from { opacity: 0; } }
.mos-lap { position: relative; width: min(96vw, 1100px); height: min(86vh, 650px); padding: 14px 14px 24px; border-radius: 18px;
  background: linear-gradient(180deg, #fbfdff 0 2%, #e4eef5 2% 40%, #d2e0ea 40% 94%, #b3c4d2 94%);
  box-shadow: 0 0 0 1px #4d6478, inset 0 1px 0 #fff, inset 0 -3px 0 #93a7b8, 0 22px 50px rgba(0,0,0,0.5), 0 0 80px rgba(90,210,255,0.22);
  animation: mosLap 0.62s cubic-bezier(.2,1.5,.35,1) both; }
@keyframes mosLap { 0% { transform: translateY(40px) scale(0.86, 0.8); opacity: 0; } 55% { opacity: 1; } }
.mos-lap::before { content: ''; position: absolute; top: 5px; left: 50%; width: 5px; height: 5px; margin-left: -2px; border-radius: 50%; background: #1a2a36; box-shadow: 0 0 0 1px #9ab0c2, 1px 1px 0 1px rgba(255,255,255,0.6); }
.mos-brand { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); font: 17px/18px 'Jersey 10', 'Pixelify Sans', monospace; color: #6d8397; letter-spacing: 0.18em; text-shadow: 0 1px 0 #fff; display: flex; gap: 8px; align-items: center; pointer-events: none; }
.mos-brand i { width: 6px; height: 6px; border-radius: 50%; background: #5ff0ff; box-shadow: 0 0 6px 2px rgba(95,240,255,0.8); animation: mosLed 3s ease-in-out infinite; }
@keyframes mosLed { 50% { opacity: 0.45; } }
.mos-scr { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 5px; background: #62b6f0; box-shadow: 0 0 0 2px #22364a, 0 0 0 3px #f4f9fc; isolation: isolate; }
@media (max-height: 540px), (max-width: 640px) {
  .mos-wrap { --bar: 36px; --tb: 30px; }
  .mos-lap { width: 100%; height: 100%; padding: 3px; border-radius: 0; animation-name: mosLapS; }
  .mos-lap::before, .mos-brand { display: none; }
  .mos-scr { border-radius: 2px; }
}
@keyframes mosLapS { 0% { transform: scale(0.94); opacity: 0; } }

/* ---- wallpaper, clouds, sun, rays, flares */
.mos-bg { position: absolute; left: 0; top: 0; z-index: 0; will-change: transform; }
.mos-bg img { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; display: block; }
.mos-cloud { position: absolute; left: 0; top: 0; image-rendering: pixelated; will-change: transform; transform-origin: 0 0; }
.mos-sun { position: absolute; left: -170px; top: -190px; width: 360px; height: 340px; z-index: 1; pointer-events: none; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255,255,240,0.9) 0 14%, rgba(255,252,210,0.45) 14% 26%, rgba(255,250,210,0.16) 26% 46%, transparent 72%); }
.mos-rays { position: absolute; left: -40%; top: -60%; width: 150%; height: 190%; z-index: 1; pointer-events: none; transform-origin: 10% 12%; will-change: transform;
  background: repeating-conic-gradient(from 88deg at 10% 12%, rgba(255,255,250,0.2) 0deg 3deg, transparent 3deg 8deg, rgba(255,255,250,0.11) 8deg 9.5deg, transparent 9.5deg 15deg);
  -webkit-mask: radial-gradient(circle at 10% 12%, #000 0 22%, rgba(0,0,0,0.5) 38%, transparent 62%); mask: radial-gradient(circle at 10% 12%, #000 0 22%, rgba(0,0,0,0.5) 38%, transparent 62%);
  animation: mosRays 14s ease-in-out infinite alternate; }
@keyframes mosRays { from { transform: rotate(-2.5deg); } to { transform: rotate(3deg); } }
.mos-flare { position: absolute; left: 0; top: 0; z-index: 1; pointer-events: none; border-radius: 50%; will-change: transform, opacity; }
.mos-flare.f0 { width: 70px; height: 70px; background: radial-gradient(closest-side, transparent 0 60%, rgba(180,255,230,0.35) 61% 74%, transparent 75%); }
.mos-flare.f1 { width: 26px; height: 26px; background: radial-gradient(closest-side, rgba(255,250,200,0.45) 0 70%, transparent 71%); }
.mos-flare.f2 { width: 110px; height: 110px; background: radial-gradient(closest-side, rgba(150,220,255,0.12) 0 76%, rgba(200,240,255,0.3) 77% 84%, transparent 85%); }
.mos-flare.f3 { width: 14px; height: 14px; background: radial-gradient(closest-side, rgba(255,255,255,0.7) 0 50%, transparent 52%); }
.mos-fxb, .mos-fxf { position: absolute; left: 0; top: 0; pointer-events: none; image-rendering: pixelated; }
.mos-fxb { z-index: 2; } .mos-fxf { z-index: 70; }

/* ---- desktop icons */
.mos-icons { position: absolute; left: 8px; top: 8px; bottom: calc(var(--bar) + 6px); z-index: 3; display: grid; grid-auto-flow: column; grid-template-rows: repeat(auto-fill, 84px); grid-auto-columns: 84px; gap: 2px 4px; }
.mos-ic { position: relative; width: 84px; height: 84px; display: flex; flex-direction: column; align-items: center; padding-top: 6px; border-radius: 7px; color: #fff; text-align: center;
  font: 18px/15px 'Jersey 15', 'Pixelify Sans', monospace; text-shadow: 0 1px 0 #0b2f4c, 1px 0 0 #0b2f4c, -1px 0 0 #0b2f4c, 0 -1px 0 #0b2f4c, 1px 2px 0 rgba(8,40,64,0.6); }
.mos-ic .pxi { margin-bottom: 4px; transform-origin: 50% 100%; filter: drop-shadow(0 3px 0 rgba(0,40,70,0.3)); }
.mos-ic.hov, .mos-ic.sel { background: linear-gradient(180deg, rgba(210,242,255,0.42) 0 50%, rgba(140,214,255,0.28) 50%); box-shadow: inset 0 0 0 1px rgba(230,250,255,0.85), 0 0 0 1px rgba(30,110,180,0.45), 0 0 14px rgba(120,220,255,0.45); }
.mos-ic.hov .pxi { animation: icHop 0.6s cubic-bezier(.3,1.6,.5,1); }
.mos-ic.pop .pxi { animation: icSquash 0.55s cubic-bezier(.3,1.7,.5,1); }
@keyframes icHop { 0% { transform: none; } 28% { transform: translateY(-9px) scale(0.94, 1.08); } 55% { transform: translateY(0) scale(1.12, 0.88); } 76% { transform: translateY(-2px) scale(0.97, 1.03); } 100% { transform: none; } }
@keyframes icSquash { 0% { transform: scale(1.3, 0.66); } 35% { transform: translateY(-8px) scale(0.86, 1.18); } 65% { transform: scale(1.06, 0.95); } 100% { transform: none; } }
.mos-ic.new::after { content: '!'; position: absolute; top: 2px; right: 14px; width: 20px; height: 20px; border-radius: 50%; font: 18px/20px 'Jersey 10', 'Pixelify Sans', monospace; color: #fff; text-shadow: 0 1px 0 #7a1010;
  background: linear-gradient(180deg, #ffd8d0 0 18%, #ff8a70 18% 50%, #e8382a 50% 82%, #ff7058 82%); box-shadow: 0 0 0 1px #7a1a10, 0 0 10px rgba(255,90,60,0.7); animation: mosBadge 1.1s cubic-bezier(.3,1.8,.5,1) infinite; }
@keyframes mosBadge { 0%, 60%, 100% { transform: scale(1); } 20% { transform: scale(1.3, 0.8); } 40% { transform: scale(0.9, 1.15) translateY(-4px); } }

/* ---- gadgets */
.mos-gad { position: absolute; right: 10px; top: 10px; z-index: 3; display: flex; flex-direction: column; gap: 10px; width: 150px; }
.mos-gad > div { position: relative; border-radius: 10px; padding: 8px 10px; color: #fff; text-shadow: 0 1px 0 rgba(6,40,70,0.9);
  background: linear-gradient(180deg, rgba(170,220,248,0.72) 0 44%, rgba(50,140,210,0.66) 44%);
  box-shadow: 0 0 0 1px rgba(10,50,90,0.55), inset 0 0 0 1px rgba(255,255,255,0.6), 0 6px 14px rgba(0,40,70,0.25); }
.mos-gad .clockc { display: block; margin: 0 auto; width: 96px; height: 96px; image-rendering: pixelated; }
.mos-gad h4 { margin: 0; font: 20px/18px 'Jersey 10', 'Pixelify Sans', monospace; letter-spacing: 0.04em; }
.mos-gad p { margin: 2px 0 0; font: 17px/15px 'Jersey 15', 'Pixelify Sans', monospace; }
.mos-gad .dn { color: #ffe27a; }
.mos-drop { position: absolute; width: 7px; height: 9px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; pointer-events: none;
  background: radial-gradient(circle at 35% 30%, #fff 0 22%, rgba(210,245,255,0.5) 24% 60%, rgba(40,120,170,0.55) 62%); box-shadow: 0 1px 0 rgba(255,255,255,0.7); }
@media (max-width: 860px), (max-height: 460px) { .mos-gad { display: none; } }

/* ---- taskbar */
.mos-bar { position: absolute; left: 0; right: 0; bottom: 0; height: var(--bar); z-index: 50; display: flex; align-items: center; gap: 5px; padding-left: 60px;
  background: linear-gradient(180deg, rgba(200,236,255,0.9) 0, rgba(140,206,246,0.86) 46%, rgba(26,96,156,0.92) 47%, rgba(14,70,124,0.95) 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.95), inset 0 2px 0 rgba(255,255,255,0.35), 0 -1px 0 rgba(6,36,64,0.6); }
.mos-orb { position: absolute; left: 6px; top: 50%; width: 46px; height: 46px; margin-top: -24px; border-radius: 50%; z-index: 2; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, #eafcff 0 12%, #9ae8ff 12% 46%, #20a8dc 46% 70%, #0c78b4 70% 86%, #5ee0ff 86%);
  box-shadow: 0 0 0 1px #083e66, inset 0 0 0 2px rgba(255,255,255,0.5), 0 0 12px rgba(120,230,255,0.55); transition: transform 0.5s cubic-bezier(.25,1.9,.45,1), box-shadow 0.2s; }
.mos-orb::after { content: ''; position: absolute; left: 7px; right: 7px; top: 3px; height: 17px; border-radius: 50%; background: rgba(255,255,255,0.5); pointer-events: none; }
.mos-orb .pxi { position: relative; z-index: 1; }
.mos-orb.hov, .mos-orb.on { box-shadow: 0 0 0 1px #083e66, inset 0 0 0 2px rgba(255,255,255,0.7), 0 0 20px 4px rgba(140,255,200,0.75); transform: scale(1.08) rotate(-6deg); }
.mos-orb.press { transform: scale(1.12, 0.84); transition-duration: 0.06s; }
.mos-tabs { display: flex; gap: 5px; flex: 1; min-width: 0; overflow: hidden; height: 100%; align-items: center; }
.mos-tab { position: relative; flex: 0 1 172px; min-width: 42px; height: calc(var(--bar) - 8px); display: flex; align-items: center; gap: 6px; padding: 0 10px 0 5px; border-radius: 5px;
  color: #fff; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace; text-shadow: 0 1px 0 #052a4a, 1px 0 0 rgba(5,42,74,0.6); white-space: nowrap; overflow: hidden;
  background: linear-gradient(180deg, rgba(255,255,255,0.32) 0 48%, rgba(255,255,255,0.08) 48%); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.45), 0 0 0 1px rgba(6,36,64,0.55);
  transition: transform 0.4s cubic-bezier(.25,1.9,.45,1); animation: mosTabIn 0.45s cubic-bezier(.25,1.8,.45,1) both; }
@keyframes mosTabIn { from { transform: translateY(24px) scale(0.6); } }
.mos-tab .tt { overflow: hidden; text-overflow: ellipsis; }
.mos-tab .pxi { flex: none; }
.mos-tab.on { background: linear-gradient(180deg, rgba(255,255,255,0.5) 0 48%, rgba(120,220,255,0.3) 48%); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.8), 0 0 0 1px rgba(6,36,64,0.7), inset 0 -6px 10px rgba(120,255,240,0.45); }
.mos-tab.min { opacity: 0.72; }
.mos-tab.hov { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.9), 0 0 0 1px rgba(6,36,64,0.7), 0 0 12px rgba(140,230,255,0.7); }
.mos-tab.press { transform: scale(0.94, 0.86); transition-duration: 0.06s; }
.mos-tray { display: flex; gap: 10px; align-items: center; height: calc(var(--bar) - 10px); padding: 0 10px; margin-left: 4px; border-radius: 4px; color: #fff; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace;
  text-shadow: 0 1px 0 #052a4a; box-shadow: inset 0 1px 2px rgba(0,20,40,0.35), inset 0 0 0 1px rgba(255,255,255,0.18); white-space: nowrap; }
.mos-tray .wf { color: #ffb4a0; }
.mos-peek { width: 14px; align-self: stretch; margin-left: 4px; background: linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.28)); box-shadow: inset 1px 0 0 rgba(255,255,255,0.5), -1px 0 0 rgba(6,36,64,0.5); }
.mos-peek.hov { background: linear-gradient(90deg, rgba(255,255,255,0.3), rgba(200,250,255,0.6)); }
@media (max-width: 760px) { .mos-tab .tt { display: none; } .mos-tab { flex: 0 0 auto; padding: 0 6px; } .mos-tray .bt { display: none; } }

/* ---- gel buttons */
.gel { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 30px; padding: 0 16px 1px; border: 0; border-radius: 15px; margin: 0;
  font: 20px/1 'Jersey 10', 'Pixelify Sans', monospace; letter-spacing: 0.03em; color: #fff; white-space: nowrap; vertical-align: middle;
  --g1:#e4fcff; --g2:#9aeeff; --g3:#27bde8; --g4:#0f8fc8; --g5:#6fe6ff; --gk:#0a5f8e; --gl: rgba(120,230,255,0.75);
  background: linear-gradient(180deg, var(--g1) 0 12%, var(--g2) 12% 48%, var(--g3) 48% 72%, var(--g4) 72% 86%, var(--g5) 86%);
  box-shadow: 0 0 0 1px var(--gk), inset 0 0 0 1px rgba(255,255,255,0.5), 0 3px 0 rgba(10,50,80,0.22);
  text-shadow: 0 1px 0 var(--gk), 1px 0 0 var(--gk), -1px 0 0 var(--gk), 0 -1px 0 var(--gk);
  transition: transform 0.5s cubic-bezier(.25,2,.45,1), filter 0.15s, box-shadow 0.15s; }
.gel::before { content: ''; position: absolute; left: 7px; right: 7px; top: 2px; height: 38%; border-radius: 12px 12px 5px 5px; background: rgba(255,255,255,0.5); pointer-events: none; }
.gel::after { content: ''; position: absolute; left: 10px; top: 4px; width: 4px; height: 2px; background: #fff; box-shadow: 6px 0 0 rgba(255,255,255,0.65); pointer-events: none; }
.gel.hov { filter: brightness(1.08) saturate(1.1); transform: translateY(-1px) scale(1.03); box-shadow: 0 0 0 1px var(--gk), inset 0 0 0 1px rgba(255,255,255,0.7), 0 4px 0 rgba(10,50,80,0.2), 0 0 14px var(--gl); }
.gel.press { transform: translateY(2px) scale(1.07, 0.84); transition-duration: 0.05s; filter: brightness(0.94); }
.gel.green { --g1:#f2ffe4; --g2:#c2f592; --g3:#5cc43c; --g4:#389c22; --g5:#9df06a; --gk:#1c5e0e; --gl: rgba(170,255,120,0.8); }
.gel.pink { --g1:#fff0f8; --g2:#ffc0e2; --g3:#f070b4; --g4:#cc4494; --g5:#ff9ad2; --gk:#80205a; --gl: rgba(255,150,210,0.8); }
.gel.red { --g1:#ffe8e0; --g2:#ffb09a; --g3:#ec4a30; --g4:#c42e18; --g5:#ff8a66; --gk:#6e1406; --gl: rgba(255,120,90,0.8); }
.gel.glass { --g1:#ffffff; --g2:#f0f7fc; --g3:#d4e4f0; --g4:#bcd2e2; --g5:#e8f4fc; --gk:#5a7a96; --gl: rgba(150,220,255,0.7); color: var(--ink); text-shadow: 0 1px 0 #fff; }
.gel.sm { min-height: 24px; padding: 0 10px 1px; font-size: 18px; border-radius: 12px; }
.gel.big { min-height: 38px; padding: 0 24px 2px; font-size: 24px; border-radius: 19px; }
.gel .k { font: 15px/1 'Jersey 15', 'Pixelify Sans', monospace; opacity: 0.85; }

/* ---- windows */
.mos-wins { position: absolute; inset: 0 0 var(--bar) 0; z-index: 10; pointer-events: none; }
.mos-win { position: absolute; display: flex; flex-direction: column; padding: 0 6px 6px; border-radius: 9px 9px 6px 6px; pointer-events: auto;
  background: linear-gradient(180deg, rgba(190,230,255,0.95) 0, rgba(146,206,248,0.93) var(--tb), rgba(118,188,240,0.92) 100%);
  box-shadow: 0 0 0 1px rgba(6,32,60,0.82), inset 0 0 0 1px rgba(255,255,255,0.72), 0 14px 30px rgba(0,30,60,0.36); }
.mos-win::before { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(102deg, transparent 0 12%, rgba(255,255,255,0.3) 12% 20%, transparent 20% 56%, rgba(255,255,255,0.2) 56% 59%, transparent 59% 66%, rgba(255,255,255,0.12) 66% 67%, transparent 67%); }
.mos-win::after { content: ''; position: absolute; left: 1px; right: 1px; top: 1px; height: 13px; border-radius: 8px 8px 0 0; pointer-events: none; background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.28)); }
.mos-win.act { box-shadow: 0 0 0 1px rgba(6,32,60,0.9), inset 0 0 0 1px rgba(255,255,255,0.85), 0 16px 34px rgba(0,30,60,0.42), 0 0 22px rgba(90,210,255,0.4); }
.mos-win:not(.act) { background: linear-gradient(180deg, rgba(218,236,250,0.95), rgba(192,218,240,0.93)); }
.mos-win:not(.act) .tb { color: #5a7690; }
.mos-win.max { border-radius: 0; padding: 0 3px 3px; }
.mos-win .tb { position: relative; z-index: 1; display: flex; align-items: center; gap: 7px; height: var(--tb); flex: none; padding-left: 2px;
  font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; letter-spacing: 0.03em; color: #0b2a46; text-shadow: 0 1px 0 rgba(255,255,255,0.9), 0 -1px 0 rgba(255,255,255,0.5); white-space: nowrap; }
.mos-win .tb .tt { flex: 1; overflow: hidden; text-overflow: ellipsis; padding-top: 1px; }
.mos-win .ctrls { position: relative; z-index: 2; display: flex; align-self: flex-start; flex: none; border-radius: 0 0 6px 6px; box-shadow: 0 0 0 1px rgba(6,32,60,0.75), 0 2px 4px rgba(0,30,60,0.2); overflow: hidden; }
.mos-win .ctrls b { width: 30px; height: 21px; display: block; background: var(--gl) center/18px 18px no-repeat, linear-gradient(180deg, #f2faff 0 46%, #c4dcef 46% 86%, #e0f0fb 86%);
  image-rendering: pixelated; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.75); transition: filter 0.15s; }
.mos-win .ctrls b + b { border-left: 1px solid rgba(6,32,60,0.55); }
.mos-win .ctrls b.x { width: 48px; background: var(--gl) center/18px 18px no-repeat, linear-gradient(180deg, #ffd6c8 0 46%, #e4482c 46% 82%, #ff8a5c 82%); }
.mos-win .ctrls b.hov { filter: brightness(1.12) saturate(1.2); box-shadow: inset 0 0 0 1px #fff, inset 0 0 8px rgba(120,230,255,0.9); }
.mos-win .ctrls b.x.hov { box-shadow: inset 0 0 0 1px #fff, inset 0 0 10px rgba(255,190,90,0.95); }
.mos-win .ctrls b.press { filter: brightness(0.9); }
.mos-win .bd { position: relative; z-index: 1; flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 10px 12px 12px; border-radius: 3px;
  background: linear-gradient(180deg, #ffffff, #f6fbff); box-shadow: 0 0 0 1px rgba(20,60,100,0.62), inset 0 1px 0 #fff; font: 18px/19px 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); }
.mos-win.dark .bd { background: linear-gradient(180deg, rgba(4,20,16,0.94), rgba(2,12,10,0.96)); color: #8dffc8; }
.mos-win.dark { background: linear-gradient(180deg, rgba(90,110,130,0.78), rgba(30,44,58,0.78)); }
.mos-win.dark .tb { color: #eaffff; text-shadow: 0 1px 0 #000; }
.mos-win .bd::-webkit-scrollbar { width: 14px; height: 14px; }
.mos-win .bd::-webkit-scrollbar-track { background: linear-gradient(90deg, #e6eef4, #f6fafc); }
.mos-win .bd::-webkit-scrollbar-thumb { border-radius: 7px; border: 2px solid transparent; background-clip: padding-box; background-color: #8fd0f0; box-shadow: inset 0 0 0 1px rgba(10,80,130,0.5), inset 3px 0 0 rgba(255,255,255,0.55); }
.mos-win .bd { scrollbar-color: #8fd0f0 #eef4f8; }
.mos-wiggle { animation: mosWig 0.45s cubic-bezier(.3,1.6,.5,1); }
@keyframes mosWig { 20% { translate: -7px 0; } 40% { translate: 6px 0; } 60% { translate: -4px 0; } 80% { translate: 2px 0; } }
.mos-shake { animation: mosShake 0.4s; }
@keyframes mosShake { 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }

/* ---- menus, start menu, popovers */
.mos-menus { position: absolute; inset: 0; z-index: 60; pointer-events: none; }
.mos-pop { position: absolute; pointer-events: auto; animation: mosPop 0.34s cubic-bezier(.25,1.7,.45,1) both; }
@keyframes mosPop { from { transform: scale(0.72, 0.5); opacity: 0; } 60% { opacity: 1; } }
.mos-pop.bye { animation: mosPopOut 0.14s ease-in both; }
@keyframes mosPopOut { to { transform: scale(0.9, 0.8); opacity: 0; } }
.mos-menu { min-width: 170px; padding: 4px; border-radius: 6px; background: linear-gradient(180deg, rgba(250,253,255,0.96), rgba(236,246,252,0.95));
  box-shadow: 0 0 0 1px rgba(20,60,100,0.7), inset 0 0 0 1px #fff, 0 10px 24px rgba(0,30,60,0.35); }
.mos-menu .mi { display: flex; align-items: center; gap: 8px; min-height: 28px; padding: 2px 12px 2px 6px; border-radius: 4px; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); white-space: nowrap; transition: transform 0.35s cubic-bezier(.25,1.9,.45,1); }
.mos-menu .mi .pxi { width: 24px; height: 24px; }
.mos-menu .mi.hov { background: linear-gradient(180deg, #eaf8ff 0 50%, #cdeeff 50%); box-shadow: inset 0 0 0 1px #7ccaf0; }
.mos-menu .mi.press { transform: scale(0.97, 0.9); transition-duration: 0.05s; }
.mos-menu .mi.dim { color: #8aa0b4; }
.mos-menu hr { border: 0; height: 1px; margin: 4px 6px; background: #c8dce8; box-shadow: 0 1px 0 #fff; }
.mos-start { display: flex; gap: 6px; width: min(470px, calc(100% - 12px)); height: min(430px, calc(100% - var(--bar) - 12px)); border-radius: 9px 9px 6px 6px; padding: 6px; transform-origin: 20px 100%;
  background: linear-gradient(180deg, rgba(110,184,238,0.97) 0, rgba(28,98,168,0.97) 40%, rgba(10,56,110,0.98) 100%);
  box-shadow: 0 0 0 1px rgba(6,32,60,0.85), inset 0 0 0 1px rgba(255,255,255,0.6), 0 14px 34px rgba(0,30,60,0.45), 0 0 24px rgba(90,210,255,0.35); }
.mos-start .l { flex: 1.25; min-width: 0; overflow: auto; background: linear-gradient(180deg, #ffffff, #f0f8fd); border-radius: 4px; padding: 4px; box-shadow: 0 0 0 1px rgba(20,60,100,0.6); }
.mos-start .l .mi { display: flex; align-items: center; gap: 8px; padding: 3px 6px; border-radius: 4px; font: 19px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); transition: transform 0.35s cubic-bezier(.25,1.9,.45,1); }
.mos-start .l .mi.hov { background: linear-gradient(180deg, #eaf8ff 0 50%, #cdeeff 50%); box-shadow: inset 0 0 0 1px #7ccaf0; }
.mos-start .l .mi.press { transform: scale(0.97, 0.9); transition-duration: 0.05s; }
.mos-start .r { flex: 0.9; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 4px 2px 2px 4px; color: #fff; overflow: hidden; }
.mos-start .r .av { flex: none; align-self: center; width: 64px; height: 64px; margin: 2px 0 4px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, #eafcff 0 45%, #9ad8f4 45%); box-shadow: 0 0 0 1px #083e66, inset 0 0 0 2px #fff, 0 4px 10px rgba(0,30,60,0.4); }
.mos-start .r .nm { text-align: center; font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; text-shadow: 0 1px 0 #052a4a; margin-bottom: 4px; }
.mos-start .r .mi { white-space: nowrap; padding: 4px 8px; border-radius: 4px; font: 19px/1 'Jersey 15', 'Pixelify Sans', monospace; text-shadow: 0 1px 0 #052a4a; transition: transform 0.35s cubic-bezier(.25,1.9,.45,1); }
.mos-start .r .mi.hov { background: linear-gradient(180deg, rgba(255,255,255,0.4) 0 50%, rgba(255,255,255,0.18) 50%); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.6); }
.mos-start .r .mi.press { transform: scale(0.95, 0.88); transition-duration: 0.05s; }
.mos-start .r .sp { flex: 1; }
.mos-start .r .gel { align-self: flex-end; }
@media (max-height: 540px) { .mos-start .r .av { width: 48px; height: 48px; margin-top: 0; } .mos-start .r .av .pxi { width: 36px !important; height: 36px !important; } }
.mos-balloon { position: absolute; right: 8px; bottom: calc(var(--bar) + 10px); z-index: 65; width: min(300px, calc(100% - 16px)); padding: 9px 12px 10px 12px; border-radius: 8px; pointer-events: auto;
  background: linear-gradient(180deg, #ffffff, #eef8ff); box-shadow: 0 0 0 1px rgba(20,60,100,0.7), inset 0 0 0 1px #fff, 0 10px 24px rgba(0,30,60,0.35); animation: mosBal 0.55s cubic-bezier(.25,1.7,.45,1) both; transform-origin: 90% 100%; }
.mos-balloon::after { content: ''; position: absolute; right: 36px; bottom: -8px; width: 14px; height: 14px; background: #eef8ff; transform: rotate(45deg); box-shadow: 1px 1px 0 rgba(20,60,100,0.7); }
.mos-balloon b { display: flex; gap: 6px; align-items: center; font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #0b4a7a; margin-bottom: 3px; }
.mos-balloon span { font: 18px/17px 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink2); }
.mos-balloon.bye { transition: opacity 0.3s, transform 0.3s; opacity: 0; transform: translateY(10px) scale(0.9); }
@keyframes mosBal { from { transform: translateY(30px) scale(0.5); opacity: 0; } }

/* ---- lid button, touch hint, focus ring, cursor */
.mos-lid { position: absolute; left: 50%; top: -34px; z-index: 5; transform: translateX(-50%); animation: mosLid 0.7s 0.25s cubic-bezier(.25,1.8,.45,1) both; }
.mos-lid.hov { transform: translateX(-50%) translateY(-1px) scale(1.05); }
.mos-lid.press { transform: translateX(-50%) translateY(2px) scale(1.08, 0.84); }
@keyframes mosLid { from { opacity: 0; translate: 0 18px; } }
@media (max-height: 540px), (max-width: 640px) { .mos-lid { top: auto; bottom: 8px; left: auto; right: 7px; transform: none; min-height: 26px; animation-name: mosLidS; } .mos-lid.hov { transform: scale(1.05); } .mos-lid.press { transform: scale(1.08, 0.84); } .mos-bar { padding-right: 116px; } .mos-peek, .mos-tray .bt { display: none; } .mos-lid { max-width: 106px; overflow: hidden; } }
@keyframes mosLidS { from { opacity: 0; translate: 0 30px; } }
.mos-hint { position: absolute; left: 50%; top: 42%; z-index: 90; width: min(420px, calc(100% - 32px)); transform: translate(-50%, -50%); padding: 12px 16px; border-radius: 10px; pointer-events: none; text-align: center; color: #fff;
  background: linear-gradient(180deg, rgba(40,140,210,0.92) 0 48%, rgba(14,80,140,0.94) 48%); box-shadow: 0 0 0 1px #052a4a, inset 0 0 0 1px rgba(255,255,255,0.6), 0 12px 30px rgba(0,20,40,0.5);
  font: 18px/19px 'Jersey 15', 'Pixelify Sans', monospace; text-shadow: 0 1px 0 #052a4a; animation: mosBal 0.5s cubic-bezier(.25,1.7,.45,1) both; }
.mos-hint b { display: block; font: 24px/1 'Jersey 10', 'Pixelify Sans', monospace; margin-bottom: 4px; }
.mos-hint.bye { transition: opacity 0.4s; opacity: 0; }
.mos-focus { position: absolute; left: 0; top: 0; z-index: 75; pointer-events: none; border-radius: 7px; opacity: 0; transition: opacity 0.15s;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #22c4e6, 0 0 16px 4px rgba(90,230,255,0.75); }
.mos-focus.on { opacity: 1; }
.mos-cur { position: absolute; left: 0; top: 0; width: 36px; height: 36px; z-index: 300; pointer-events: none; background: 0 0 / 100% 100% no-repeat; image-rendering: pixelated; transform-origin: 2px 2px; will-change: transform;
  filter: drop-shadow(1px 2px 0 rgba(0,20,40,0.35)); }
.mos-cur.off { visibility: hidden; }
.mos-hold { position: absolute; left: 0; top: 0; z-index: 299; width: 52px; height: 52px; border-radius: 50%; pointer-events: none; opacity: 0;
  background: conic-gradient(rgba(140,240,255,0.95) var(--p, 0%), rgba(255,255,255,0.2) 0); -webkit-mask: radial-gradient(closest-side, transparent 0 68%, #000 70%); mask: radial-gradient(closest-side, transparent 0 68%, #000 70%); }
.mos-hold.on { opacity: 1; animation: mosHold 0.37s linear both; }
@property --p { syntax: '<percentage>'; inherits: false; initial-value: 0%; }
@keyframes mosHold { from { --p: 0%; } to { --p: 100%; } }
.mos-float { position: absolute; z-index: 72; pointer-events: none; font: 26px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #fff; text-shadow: 0 2px 0 #0a5f8e, 1px 0 0 #0a5f8e, -1px 0 0 #0a5f8e, 0 -1px 0 #0a5f8e; animation: mosFloat 0.9s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes mosFloat { 0% { transform: translate(-50%, 0) scale(0.4); opacity: 0; } 25% { transform: translate(-50%, -18px) scale(1.2); opacity: 1; } 100% { transform: translate(-50%, -48px) scale(1); opacity: 0; } }

/* ---- app content */
.mos-win h3 { margin: 0 0 6px; font: 24px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #0b4a7a; letter-spacing: 0.02em; }
.mos-win p { margin: 6px 0; }
.ribbon { display: flex; gap: 2px; margin: -10px -12px 8px; padding: 4px 8px 0; background: linear-gradient(180deg, #eef7fd, #d6e8f5); box-shadow: inset 0 -1px 0 #9ab8d0; font: 17px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink2); }
.ribbon span { padding: 3px 10px 4px; border-radius: 4px 4px 0 0; }
.ribbon span.on { background: #fff; color: var(--ink); box-shadow: 0 0 0 1px #9ab8d0; }
.xl { border-collapse: separate; border-spacing: 0; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace; }
.xl td, .xl th { border-right: 1px solid #c4d6e4; border-bottom: 1px solid #c4d6e4; padding: 4px 9px 3px; text-align: right; min-width: 58px; height: 26px; }
.xl th { background: linear-gradient(180deg, #f6fbff 0 50%, #dcebf6 50%); text-align: center; font-weight: 400; color: #2a4a66; }
.xl td.hov { background: #eaf7ff; }
.xl td.sel { background: #c8ecff; box-shadow: inset 0 0 0 2px #22a4e0; }
.xl tr.sum td { background: linear-gradient(180deg, #fbfff2 0 50%, #eaf8d4 50%); color: #1f6410; }
.xl tr.sum td.hov { background: #d8f6c0; }
.xl tr.sum td.bump { animation: mosBump 0.5s cubic-bezier(.25,1.9,.45,1); }
@keyframes mosBump { 0% { transform: scale(1.5, 0.7); } 50% { transform: scale(0.9, 1.15); } 100% { transform: none; } }
.fx { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace; }
.fx b { font-weight: 400; min-width: 40px; text-align: center; padding: 4px 6px 3px; border-radius: 3px; background: linear-gradient(180deg, #fff 0 50%, #e4eff8 50%); box-shadow: 0 0 0 1px #9ab8d0; }
.fx i { font-style: normal; color: #2a8ad0; padding: 0 2px; }
.fx span { flex: 1; min-height: 25px; padding: 4px 8px 3px; border-radius: 3px; background: #fff; box-shadow: 0 0 0 1px #9ab8d0, inset 0 1px 2px rgba(0,40,80,0.15); }
.chart { width: 440px; max-width: 100%; image-rendering: pixelated; margin-top: 6px; border-radius: 4px; box-shadow: 0 0 0 1px #9ab8d0; display: block; }
.cap { margin-top: 10px; font: 18px/1 'Jersey 15', 'Pixelify Sans', monospace; }
.rp .head { display: flex; align-items: center; gap: 10px; margin: -10px -12px 10px; padding: 8px 12px; color: #fff; text-shadow: 0 1px 0 #0a4a7a;
  background: linear-gradient(180deg, #8fdcff 0 46%, #2c9ee0 46% 88%, #6fd4ff 88%); box-shadow: inset 0 -1px 0 #0a5f8e; }
.rp .head b { font: 23px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; flex: 1; }
.rp .q { margin: 0 0 9px; }
.rp label { display: block; margin: 0 0 4px; color: #0b4a7a; font: 20px/1 'Jersey 10', 'Pixelify Sans', monospace; letter-spacing: 0.02em; }
.rp .tip { color: #c83a2a; font: 17px/16px 'Jersey 15', 'Pixelify Sans', monospace; min-height: 0; margin-top: 3px; }
.rp .tip:empty { display: none; }
.rp .thumbs { display: inline-flex; gap: 10px; flex-wrap: wrap; padding: 4px; margin: -4px; border-radius: 6px; }
.rp .thumbs .th { position: relative; padding: 3px; border-radius: 4px; background: #fff; box-shadow: 0 0 0 1px #9ab8d0, 0 2px 0 rgba(0,40,80,0.12); transition: transform 0.45s cubic-bezier(.25,1.9,.45,1), box-shadow 0.15s; }
.rp .thumbs canvas { width: 96px; height: 64px; image-rendering: pixelated; display: block; }
.rp .thumbs .th.hov { transform: translateY(-3px) rotate(-1.5deg); box-shadow: 0 0 0 1px #5ab4e8, 0 6px 10px rgba(0,40,80,0.2); }
.rp .thumbs .th.press { transform: scale(0.94, 0.88); transition-duration: 0.05s; }
.rp .thumbs .th.on { box-shadow: 0 0 0 3px #22c4e6, 0 0 14px rgba(40,200,255,0.8); transform: translateY(-2px); }
.rp .thumbs .th.on::after { content: '✓'; position: absolute; right: -7px; top: -8px; width: 22px; height: 22px; border-radius: 50%; color: #fff; text-align: center; font: 20px/22px 'Jersey 10', 'Pixelify Sans', monospace;
  background: linear-gradient(180deg, #d8ffc0 0 20%, #7ada4a 20% 55%, #3a9a22 55%); box-shadow: 0 0 0 1px #1c5e0e; animation: mosBump 0.5s cubic-bezier(.25,1.9,.45,1); }
.rp .ok { box-shadow: 0 0 0 2px #4cc42c, 0 0 10px rgba(90,220,60,0.6) !important; }
.rp .bad { box-shadow: 0 0 0 2px #e8483a, 0 0 10px rgba(255,80,60,0.55) !important; }
.rp .act { display: flex; align-items: center; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
.done-stamp { margin-top: 10px; padding: 10px 12px; border-radius: 6px; color: #1c5e0e; font: 18px/18px 'Jersey 15', 'Pixelify Sans', monospace;
  background: linear-gradient(180deg, #f4ffe8 0 50%, #e2f8cc 50%); box-shadow: 0 0 0 1px #6cc44a, inset 0 0 0 1px #fff; animation: mosBal 0.55s cubic-bezier(.25,1.7,.45,1) both; }
.done-stamp b { display: block; font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; margin-bottom: 3px; color: #2a8a18; }
.prog { position: relative; height: 18px; flex: 1; min-width: 90px; border-radius: 9px; overflow: hidden; background: linear-gradient(180deg, #c8d8e4 0 50%, #e4eef4 50%); box-shadow: 0 0 0 1px #5a7a96, inset 0 2px 3px rgba(0,30,60,0.3); }
.prog i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 9px; overflow: hidden;
  background: linear-gradient(180deg, #eaffd8 0 16%, #aef27a 16% 48%, #4cbc2a 48% 80%, #86e858 80%); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5), 1px 0 0 #2a7a14; }
.prog i::after { content: ''; position: absolute; top: 0; bottom: 0; width: 40px; left: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent); animation: mosShine 1.4s linear infinite; will-change: transform; }
@keyframes mosShine { from { transform: translateX(-40px); } to { transform: translateX(var(--shw, 600px)); } }
.prog.aq i { background: linear-gradient(180deg, #e8fdff 0 16%, #9aeeff 16% 48%, #22b4e2 48% 80%, #6fe6ff 80%); }
.prog.warn i { background: linear-gradient(180deg, #fff8d0 0 16%, #ffe07a 16% 48%, #f0a822 48% 80%, #ffd65a 80%); }
.prog.hot i { background: linear-gradient(180deg, #ffe8e0 0 16%, #ffae98 16% 48%, #e8442c 48% 80%, #ff8a66 80%); }
.prog span { position: absolute; inset: 0; text-align: center; font: 16px/18px 'Jersey 15', 'Pixelify Sans', monospace; color: #0b2a46; text-shadow: 0 1px 0 rgba(255,255,255,0.8); }
.dd { position: relative; display: inline-flex; align-items: center; min-width: 170px; height: 30px; padding: 0 40px 0 10px; border-radius: 5px; font: 19px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink);
  background: linear-gradient(180deg, #ffffff 0 50%, #eef5fa 50%); box-shadow: 0 0 0 1px #7c9ab4, inset 0 0 0 1px #fff; transition: transform 0.45s cubic-bezier(.25,1.9,.45,1), box-shadow 0.15s; }
.dd::after { content: ''; position: absolute; right: 3px; top: 3px; bottom: 3px; width: 28px; border-radius: 3px; background: var(--arr) 6px 7px/20px 20px no-repeat, linear-gradient(180deg, #e8fdff 0 45%, #5fd0f4 45% 85%, #9ae8ff 85%); box-shadow: 0 0 0 1px #0a6d98; image-rendering: pixelated; }
.dd.ph { color: #8aa0b4; }
.dd.hov { box-shadow: 0 0 0 1px #3aa6e0, inset 0 0 0 1px #fff, 0 0 10px rgba(80,200,255,0.55); }
.dd.press { transform: scale(0.97, 0.9); transition-duration: 0.05s; }
.numf { display: inline-flex; align-items: center; gap: 6px; }
.numf .v { min-width: 84px; height: 30px; padding: 0 10px; display: inline-flex; align-items: center; justify-content: flex-end; border-radius: 5px; font: 21px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink);
  background: #fff; box-shadow: 0 0 0 1px #7c9ab4, inset 0 1px 3px rgba(0,40,80,0.2); transition: transform 0.45s cubic-bezier(.25,1.9,.45,1); }
.numf .v.ph { color: #9ab0c4; }
.numf .v.hov, .numf .v.on { box-shadow: 0 0 0 1px #3aa6e0, inset 0 1px 3px rgba(0,40,80,0.2), 0 0 10px rgba(80,200,255,0.55); }
.numf .v.on::after { content: ''; width: 2px; height: 18px; margin-left: 2px; background: #22a4e0; animation: mosBlink 1s steps(1) infinite; }
@keyframes mosBlink { 50% { opacity: 0; } }
.numf .v.press { transform: scale(0.96, 0.9); transition-duration: 0.05s; }
.kp { display: grid; grid-template-columns: repeat(3, 44px); gap: 5px; padding: 6px; }
.kp .gel { min-height: 34px; padding: 0; font-size: 22px; border-radius: 9px; }
.gal { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
.gal figure { margin: 0; padding: 5px 5px 4px; border-radius: 5px; background: #fff; box-shadow: 0 0 0 1px #b8cfe0, 0 3px 0 rgba(0,40,80,0.08); transition: transform 0.45s cubic-bezier(.25,1.9,.45,1), box-shadow 0.15s; }
.gal figure.hov { transform: translateY(-4px) rotate(-1deg); box-shadow: 0 0 0 1px #5ab4e8, 0 8px 12px rgba(0,40,80,0.18), 0 0 12px rgba(120,220,255,0.5); }
.gal figure.press { transform: scale(0.95, 0.9); transition-duration: 0.05s; }
.gal canvas, .gal img { width: 100%; image-rendering: pixelated; display: block; border-radius: 2px; }
.gal figcaption { font: 16px/15px 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink2); padding-top: 4px; }
.big canvas, .big img { width: 100%; image-rendering: pixelated; display: block; border-radius: 3px; box-shadow: 0 0 0 1px #b8cfe0; }
.disc { display: flex; gap: 10px; align-items: flex-start; padding: 8px; margin-bottom: 6px; border-radius: 6px; background: linear-gradient(180deg, #ffffff, #f0f8fd); box-shadow: 0 0 0 1px #c4d8e6; }
.disc canvas { width: 48px; height: 48px; image-rendering: pixelated; flex: none; border-radius: 50%; background: radial-gradient(circle at 50% 30%, #eafcff, #9ad8f4); box-shadow: 0 0 0 1px #6aaed4, inset 0 0 0 2px #fff; }
.disc b { font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #2a7a18; }
.disc i { color: #6a849a; font-style: normal; }
.disc.lock { opacity: 0.6; } .disc.lock canvas { filter: brightness(0) opacity(0.35); }
.addr { display: flex; align-items: center; gap: 6px; margin: -10px -12px 8px; padding: 6px 8px; background: linear-gradient(180deg, #f6fbff, #dfeef8); box-shadow: inset 0 -1px 0 #9ab8d0; }
.addr span { flex: 1; padding: 4px 8px 3px; border-radius: 3px; background: #fff; box-shadow: 0 0 0 1px #9ab8d0; color: var(--ink2); font: 17px/1 'Jersey 15', 'Pixelify Sans', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fl { display: flex; flex-direction: column; gap: 2px; }
.fl .row { display: flex; gap: 8px; align-items: center; min-height: 30px; padding: 2px 8px; border-radius: 4px; transition: transform 0.4s cubic-bezier(.25,1.9,.45,1); }
.fl .row .pxi { width: 24px; height: 24px; flex: none; }
.fl .row.dir { font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #0b4a7a; margin-top: 4px; }
.fl .row.f { padding-left: 34px; }
.fl .row.f.hov { background: linear-gradient(180deg, #eaf8ff 0 50%, #cdeeff 50%); box-shadow: inset 0 0 0 1px #7ccaf0; }
.fl .row.f.press { transform: scale(0.98, 0.9); transition-duration: 0.05s; }
.fl .pwrow { padding: 4px 8px 6px 34px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.mos-in { height: 30px; padding: 0 8px; border: 0; border-radius: 5px; font: 19px/1 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); background: #fff; box-shadow: 0 0 0 1px #7c9ab4, inset 0 1px 3px rgba(0,40,80,0.2); outline: none; user-select: text; -webkit-user-select: text; }
.mos-in:focus { box-shadow: 0 0 0 1px #3aa6e0, inset 0 1px 3px rgba(0,40,80,0.2), 0 0 10px rgba(80,200,255,0.6); }
.np { white-space: pre-wrap; font: 19px/20px 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink); min-height: 100%; }
.term { white-space: pre-wrap; font: 18px/18px 'Jersey 15', 'Pixelify Sans', monospace; }
.term .ln { display: flex; gap: 6px; align-items: center; }
.term input { flex: 1; min-width: 0; background: transparent; border: 0; color: #d8ffea; font: inherit; outline: none; caret-color: #8dffc8; user-select: text; -webkit-user-select: text; }
.term .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.pk .top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.pk .top b { font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.pk .sc { font: 20px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #1c5e0e; white-space: nowrap; }
.pk .cvw { position: relative; }
.pk canvas.spec { width: 100%; max-width: 360px; margin: 0 auto; image-rendering: pixelated; display: block; border-radius: 6px; box-shadow: 0 0 0 1px #6aaed4; }
.pk .bins { display: flex; gap: 8px; margin-top: 10px; justify-content: center; flex-wrap: wrap; }
.pk .bins .gel { flex: 1; max-width: 140px; }
.pk .res { text-align: center; margin-top: 8px; }
.bp canvas { width: 100%; image-rendering: pixelated; display: block; border-radius: 6px; box-shadow: 0 0 0 1px #6aaed4; }
/* ---- touch: scrollable panes pan under the finger, hit targets grow, the trackpad toggle */
.mos-win .bd, .mos-start .l, .mos-menu, .rl-list, .rl-page, .imp-main, .imp-q { touch-action: pan-x pan-y; }
.mos-win .tb, .bp canvas, .pk canvas { touch-action: none; }
.mos-menu { overflow-y: auto; overscroll-behavior: contain; }
.mos-tray .tp { display: none; align-items: center; padding: 2px 8px 3px; border-radius: 9px; background: linear-gradient(180deg, rgba(255,255,255,0.32) 0 50%, rgba(255,255,255,0.1) 50%); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5); }
.mos-tray .tp.pop { animation: icSquash 0.55s cubic-bezier(.3,1.7,.5,1); }
.mos-wrap.big .mos-tray .tp, .mos-wrap.touch .mos-tray .tp { display: inline-flex; }
.fx .zm { display: flex; align-items: center; gap: 4px; flex: none; }
.fx .zm em { font-style: normal; min-width: 44px; text-align: center; color: var(--ink2); }
.fx .zm .gel { min-width: 30px; padding: 0 6px 1px; }
.mos-wrap.big { --tb: 36px; }
.mos-wrap.big .mos-win .ctrls b { width: 40px; height: 30px; background-size: 20px 20px, auto; }
.mos-wrap.big .mos-win .ctrls b.x { width: 54px; }
.mos-wrap.big .gel { min-height: 36px; }
.mos-wrap.big .gel.sm { min-height: 32px; padding: 0 12px 1px; }
.mos-wrap.big .mos-menu .mi { min-height: 42px; padding: 4px 16px 4px 10px; font-size: 21px; }
.mos-wrap.big .mos-menu hr { margin: 6px; }
.mos-wrap.big .mos-start .l .mi, .mos-wrap.big .mos-start .r .mi { padding: 8px 8px; }
.mos-wrap.big .dd { height: 40px; min-width: 190px; font-size: 21px; }
.mos-wrap.big .dd::after { width: 32px; background-position: 6px 10px, 0 0; }
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
`;
