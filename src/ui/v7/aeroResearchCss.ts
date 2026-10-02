// MoriOS research apps (camera import, Research Log, Photos viewer): same glossy aero look as aeroCss.

export const RESEARCH_CSS = `
/* ---- desktop & tray bits */
.mos-ic.cnt::before { content: attr(data-n); position: absolute; top: 0; right: 10px; z-index: 2; min-width: 24px; height: 24px; padding: 0 5px; border-radius: 12px; font: 20px/24px 'Jersey 10', 'Pixelify Sans', monospace; color: #fff; text-shadow: 0 1px 0 #7a1010;
  background: linear-gradient(180deg, #ffd8d0 0 18%, #ff8a70 18% 50%, #e8382a 50% 82%, #ff7058 82%); box-shadow: 0 0 0 1px #7a1a10, 0 0 12px rgba(255,90,60,0.75); animation: mosBadge 1.1s cubic-bezier(.3,1.8,.5,1) infinite; }
.mos-ic.plug .pxi { filter: drop-shadow(0 3px 0 rgba(0,40,70,0.3)) drop-shadow(0 0 8px rgba(150,255,200,0.9)); }
.mos-tray .cm { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px 1px 3px; border-radius: 9px; background: linear-gradient(180deg, rgba(190,255,200,0.4) 0 50%, rgba(90,220,120,0.3) 50%); box-shadow: inset 0 0 0 1px rgba(220,255,230,0.6); }
.mos-tray .cm .pxi { width: 18px !important; height: 18px !important; }
.mos-tray .cm.hov { box-shadow: inset 0 0 0 1px #fff, 0 0 10px rgba(160,255,190,0.9); }
.mos-tray .cm.pop { animation: icSquash 0.55s cubic-bezier(.3,1.7,.5,1); }
.mos-tray .bt.lo { color: #ffb4a0; }
.mos-balloon.act { cursor: none; }
.mos-balloon.act.hov { box-shadow: 0 0 0 1px #3aa6e0, inset 0 0 0 1px #fff, 0 10px 24px rgba(0,30,60,0.35), 0 0 16px rgba(90,210,255,0.6); }
.mos-balloon.act span b { color: #2a8a18; }
.gel.dim { filter: saturate(0.25) brightness(1.05); opacity: 0.75; }

/* ---- shared: photo with analysis boxes */
.imp .ph, .pv .ph, .rl-hero .ph { position: relative; overflow: hidden; border-radius: 4px; background: #0b1a26; box-shadow: 0 0 0 1px #6a8aa6, 0 3px 8px rgba(0,30,60,0.2); aspect-ratio: 16 / 9; }
.imp .ph img, .pv .ph img, .rl-hero .ph img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; image-rendering: pixelated; object-fit: cover; }
.boxes { position: absolute; inset: 0; pointer-events: none; transition: opacity 0.2s; }
.boxes.off { opacity: 0; }
.bx { position: absolute; border-radius: 3px; animation: bxIn 0.42s cubic-bezier(.25,1.8,.45,1) both; }
.bx.ok { box-shadow: 0 0 0 2px #7dff8a, 0 0 0 3px rgba(10,60,20,0.7), 0 0 12px rgba(120,255,140,0.7); }
.bx.no { outline: 2px dashed #ff8a70; outline-offset: 0; box-shadow: 0 0 0 3px rgba(80,10,0,0.35); }
.bx span { position: absolute; left: -2px; bottom: 100%; margin-bottom: 4px; white-space: nowrap; max-width: 170px; overflow: hidden; text-overflow: ellipsis; padding: 2px 7px 3px; border-radius: 4px; font: 16px/15px 'Jersey 15', 'Pixelify Sans', monospace; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,0.6); }
.bx.lo span { bottom: auto; top: 100%; margin: 4px 0 0; }
.bx.ok span { background: linear-gradient(180deg, #8ae86a 0 45%, #3a9a22 45%); box-shadow: 0 0 0 1px #1c5e0e; }
.bx.no span { background: linear-gradient(180deg, #ff9a80 0 45%, #d8442c 45%); box-shadow: 0 0 0 1px #6e1406; }
.bx span small { display: block; font-size: 14px; opacity: 0.95; }
@keyframes bxIn { from { transform: scale(1.6); opacity: 0; } }
.ln { padding: 4px 8px 5px; margin: 0 0 4px; border-radius: 5px; font: 17px/16px 'Jersey 15', 'Pixelify Sans', monospace; background: #f4f9fd; box-shadow: inset 3px 0 0 #9ab8d0; animation: lnIn 0.4s cubic-bezier(.25,1.6,.45,1) both; }
.ln b { font: 19px/18px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: var(--ink); }
.ln small { display: block; color: var(--ink2); font-size: 16px; }
.ln.ok { background: #f0fbe8; box-shadow: inset 3px 0 0 #4cbc2a; } .ln.ok b { color: #1f6410; }
.ln.no { background: #fff3ef; box-shadow: inset 3px 0 0 #e8583a; } .ln.no b { color: #a8301c; }
.ln.none { color: #6a849a; font-style: italic; }
.ln.fact { background: linear-gradient(180deg, #fffbe2, #fff2b8); box-shadow: inset 3px 0 0 #f0ae22, 0 0 10px rgba(255,210,80,0.45); } .ln.fact b { color: #8a5a08; }
.ln .st { color: #e8a020; letter-spacing: 1px; }
.ln em { font-style: normal; color: #2a8a18; font-weight: 700; }
.ln .tag { display: inline-block; padding: 1px 6px 2px; margin-left: 4px; border-radius: 8px; font: 14px/14px 'Jersey 10', 'Pixelify Sans', monospace; color: #fff; background: linear-gradient(180deg, #ffd65a 0 45%, #f0a822 45%); box-shadow: 0 0 0 1px #8a5a08; text-shadow: 0 1px 0 #8a5a08; vertical-align: 2px; }
@keyframes lnIn { from { transform: translateY(8px) scale(0.96); opacity: 0; } }

/* ---- camera import */
.imp { display: flex; flex-direction: column; gap: 8px; height: calc(100% + 22px); margin: -10px -12px -12px; padding: 10px 12px 10px; container-type: inline-size; }
.imp-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.imp-top .tt { flex: 1; min-width: 150px; display: flex; flex-direction: column; }
.imp-top .tt b { font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.imp-top .tt span { color: var(--ink2); }
.imp-top .dev .pxi { display: block; animation: icHop 0.7s 0.2s cubic-bezier(.3,1.6,.5,1) both; }
.imp-grid { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-y; display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px; align-content: start; padding: 6px 4px; margin: 0 -4px; }
.imp-t { position: relative; padding: 4px 4px 3px; border-radius: 6px; background: #fff; box-shadow: 0 0 0 1px #b8cfe0, 0 3px 0 rgba(0,40,80,0.08); transition: transform 0.4s cubic-bezier(.25,1.9,.45,1), box-shadow 0.15s; animation: lnIn 0.45s cubic-bezier(.25,1.6,.45,1) both; }
.imp-t img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; border-radius: 3px; image-rendering: pixelated; filter: saturate(0.55) brightness(0.92); transition: filter 0.2s; }
.imp-t .cap { display: block; padding-top: 3px; font: 15px/14px 'Jersey 15', 'Pixelify Sans', monospace; color: var(--ink2); }
.imp-t .vid, .gal .vid { position: absolute; left: 8px; top: 8px; padding: 0 5px 1px; border-radius: 3px; font: 13px/15px 'Jersey 10', 'Pixelify Sans', monospace; color: #fff; background: rgba(200,40,30,0.85); }
.imp-t .ck { position: absolute; right: -6px; top: -7px; width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.85); box-shadow: 0 0 0 1px #7c9ab4; transition: transform 0.35s cubic-bezier(.25,1.9,.45,1); transform: scale(0.75); }
.imp-t.on { box-shadow: 0 0 0 3px #22c4e6, 0 0 14px rgba(40,200,255,0.65); }
.imp-t.on img { filter: none; }
.imp-t.on .ck { transform: scale(1); background: linear-gradient(180deg, #d8ffc0 0 20%, #7ada4a 20% 55%, #3a9a22 55%); box-shadow: 0 0 0 1px #1c5e0e; }
.imp-t.on .ck::after { content: ''; position: absolute; inset: 0; background: var(--ckw) 50% 55% / 16px 12px no-repeat; image-rendering: pixelated; }
.imp-t.hov { transform: translateY(-3px) rotate(-1deg); }
.imp-t.press { transform: scale(0.94, 0.88); transition-duration: 0.05s; }
.imp-t.bop { animation: mosBump 0.45s cubic-bezier(.25,1.9,.45,1); }
.imp-foot { display: flex; align-items: center; gap: 10px; justify-content: flex-end; flex-wrap: wrap; padding-top: 6px; border-top: 1px solid #d4e4f0; }
.imp-foot .n { flex: 1; color: var(--ink2); }
.imp-empty { margin: auto; max-width: 380px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; color: var(--ink2); }
.imp-empty b { font: 24px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.kk { display: inline-block; padding: 0 5px; border-radius: 3px; background: #fff; box-shadow: 0 0 0 1px #7c9ab4, 0 2px 0 #9ab8d0; color: var(--ink); }
/* uploading */
.imp-q { flex: none; display: flex; gap: 6px; overflow-x: auto; padding: 4px 2px 6px; }
.imp-q .qt { position: relative; flex: none; width: 64px; height: 36px; border-radius: 3px; overflow: hidden; box-shadow: 0 0 0 1px #9ab8d0; transition: transform 0.35s cubic-bezier(.25,1.9,.45,1), opacity 0.3s; opacity: 0.55; }
.imp-q .qt img { width: 100%; height: 100%; object-fit: cover; display: block; image-rendering: pixelated; }
.imp-q .qt.on { opacity: 1; transform: translateY(-3px) scale(1.08); box-shadow: 0 0 0 2px #22c4e6, 0 0 10px rgba(40,200,255,0.8); }
.imp-q .qt.done { opacity: 1; }
.imp-q .qt.done i { position: absolute; right: 2px; top: 2px; width: 16px; height: 16px; border-radius: 50%; animation: mosBump 0.5s cubic-bezier(.25,1.9,.45,1); }
.imp-q .qt.hit i { background: linear-gradient(180deg, #d8ffc0 0 20%, #7ada4a 20% 55%, #3a9a22 55%); box-shadow: 0 0 0 1px #1c5e0e; }
.imp-q .qt.miss i { background: linear-gradient(180deg, #e8eef4 0 50%, #a9b8c6 50%); box-shadow: 0 0 0 1px #5a7a96; }
.imp-main { flex: 1; min-height: 0; display: flex; gap: 12px; }
.imp-stage { flex: 1.35; min-width: 0; display: flex; align-items: flex-start; padding-top: 20px; }
.imp-stage .ph { width: 100%; }
.imp-stage .ph.in img { animation: phIn 0.5s cubic-bezier(.25,1.6,.45,1) both; }
@keyframes phIn { from { transform: translateY(-30%) scale(0.6) rotate(-4deg); opacity: 0; } }
.imp-stage .scan { position: absolute; top: 0; bottom: 0; left: -12%; width: 12%; pointer-events: none; opacity: 0; background: linear-gradient(90deg, transparent, rgba(120,255,230,0.55) 70%, #e8fffa 92%, transparent); mix-blend-mode: screen; }
.imp-stage .scan.go { animation: scanGo 0.7s linear both; }
@keyframes scanGo { 0% { left: -12%; opacity: 1; } 95% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
.stamp { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-8deg); pointer-events: none; display: none; padding: 6px 16px 8px; border-radius: 8px; text-align: center; white-space: nowrap;
  font: 32px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #fff; animation: stampIn 0.55s cubic-bezier(.25,1.8,.45,1) both; }
.stamp small { display: block; font: 18px/18px 'Jersey 15', 'Pixelify Sans', monospace; }
.stamp.new, .stamp.fact, .stamp.none { display: block; }
.stamp.new { background: linear-gradient(180deg, #fff3a0 0 30%, #ffc838 30% 70%, #f09a1a 70%); color: #6a3a00; text-shadow: 0 1px 0 #fff6c8; box-shadow: 0 0 0 2px #7a4a08, 0 0 0 4px #fff, 0 0 30px rgba(255,220,90,0.9); }
.stamp.fact { background: linear-gradient(180deg, #e8fdff 0 30%, #7ae6ff 30% 70%, #22b4e2 70%); color: #063e5e; box-shadow: 0 0 0 2px #0a5f8e, 0 0 0 4px #fff, 0 0 24px rgba(90,220,255,0.9); }
.stamp.none { background: rgba(20,40,60,0.7); font-size: 24px; transform: translate(-50%, -50%); box-shadow: 0 0 0 1px rgba(255,255,255,0.5); }
@keyframes stampIn { 0% { transform: translate(-50%, -50%) scale(2.6) rotate(-14deg); opacity: 0; } 60% { opacity: 1; } }
.imp-side { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.imp-bar { display: flex; flex: none; }
.imp-feed { flex: 1; min-height: 60px; overflow: auto; overscroll-behavior: contain; touch-action: pan-y; padding-right: 2px; }
.imp-feed .grp { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 6px; }
.imp-feed .mini { flex: none; width: 54px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 3px; box-shadow: 0 0 0 1px #9ab8d0; image-rendering: pixelated; margin-top: 2px; }
.imp-feed .ls { flex: 1; min-width: 0; }
.imp-sum { flex: none; padding: 10px 12px; border-radius: 8px; background: linear-gradient(180deg, #f4ffe8 0 50%, #e2f8cc 50%); box-shadow: 0 0 0 1px #6cc44a, inset 0 0 0 1px #fff; animation: mosBal 0.55s cubic-bezier(.25,1.7,.45,1) both; }
.imp-sum > b { display: block; font: 26px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #2a8a18; margin-bottom: 4px; }
.imp-sum .rw { color: #1c5e0e; } .imp-sum .rw i { font-style: normal; display: inline-block; min-width: 26px; font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #2a8a18; }
.imp-sum .rp { margin-top: 2px; font: 24px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #c88410; text-shadow: 0 1px 0 #fff; }
.imp-sum .bt { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
@container (max-width: 540px) {
  .imp-main { flex-direction: column; overflow: auto; }
  .imp-stage { padding-top: 22px; flex: none; }
  .imp-side { flex: none; }
  .imp-feed { overflow: visible; }
}

/* ---- research log */
.rl { display: flex; flex-direction: column; height: calc(100% + 22px); margin: -10px -12px -12px; container-type: inline-size; }
.rl-top { flex: none; display: flex; align-items: center; gap: 10px; padding: 7px 12px; color: #fff; text-shadow: 0 1px 0 #0a4a7a; background: linear-gradient(180deg, #8fdcff 0 46%, #2c9ee0 46% 88%, #6fd4ff 88%); box-shadow: inset 0 -1px 0 #0a5f8e; }
.rl-top b { font: 24px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; }
.rl-top .ct { white-space: nowrap; }
.rl-top .prog { max-width: 200px; margin-left: auto; }
.rl-body { flex: 1; min-height: 0; display: flex; }
.rl-list { flex: none; width: 210px; overflow: auto; overscroll-behavior: contain; padding: 8px; display: flex; flex-direction: column; gap: 6px; background: linear-gradient(180deg, #eef7fd, #e0eef8); box-shadow: inset -1px 0 0 #b8d0e2; }
.rl-card { position: relative; flex: none; display: flex; gap: 7px; align-items: center; padding: 4px; border-radius: 6px; background: #fff; box-shadow: 0 0 0 1px #b8cfe0, 0 2px 0 rgba(0,40,80,0.08); transition: transform 0.4s cubic-bezier(.25,1.9,.45,1); }
.rl-card .th { flex: none; width: 60px; height: 45px; border-radius: 4px; background-color: #0b1a26; background-repeat: no-repeat; image-rendering: pixelated; box-shadow: 0 0 0 1px #6a8aa6; }
.rl-card .tx { min-width: 0; display: flex; flex-direction: column; line-height: 15px; }
.rl-card .tx b { font: 18px/16px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rl-card .tx i { font-style: normal; color: #6a849a; font-size: 15px; }
.rl-card .tx span { color: #2a8a18; font-size: 15px; }
.rl-card.hov { transform: translateX(3px); box-shadow: 0 0 0 1px #5ab4e8, 0 4px 10px rgba(0,40,80,0.15); }
.rl-card.press { transform: scale(0.96, 0.9); transition-duration: 0.05s; }
.rl-card.on { box-shadow: 0 0 0 2px #22c4e6, 0 0 12px rgba(40,200,255,0.55); background: linear-gradient(180deg, #ffffff, #e8f8ff); }
.rl-card.fresh::after { content: 'NEW'; position: absolute; right: -4px; top: -6px; padding: 1px 5px 2px; border-radius: 7px; font: 13px/13px 'Jersey 10', 'Pixelify Sans', monospace; color: #6a3a00; background: linear-gradient(180deg, #fff3a0 0 40%, #ffc838 40%); box-shadow: 0 0 0 1px #7a4a08; animation: mosBadge 1.1s cubic-bezier(.3,1.8,.5,1) infinite; }
.rl-card.pop { animation: cardPop 0.6s cubic-bezier(.25,1.8,.45,1) both; }
@keyframes cardPop { 0% { transform: scale(0.3) rotate(-6deg); opacity: 0; } 60% { opacity: 1; } }
.rl-q { flex: none; display: flex; gap: 8px; align-items: center; padding: 6px; border-radius: 6px; color: #6a849a; border: 2px dashed #b8cfe0; }
.rl-q i { flex: none; width: 44px; height: 33px; display: grid; place-items: center; border-radius: 4px; font: 28px/1 'Jersey 10', 'Pixelify Sans', monospace; font-style: normal; color: #9ab0c4; background: #eef4f8; }
.rl-page { flex: 1; min-width: 0; overflow: auto; overscroll-behavior: contain; padding: 12px 14px 16px; }
.rl-empty { max-width: 380px; margin: 30px auto; display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; color: var(--ink2); }
.rl-empty b { font: 26px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.rl.empty .rl-list { width: 170px; }
.rl-hero { margin-bottom: 8px; }
.rl-hero .ph { max-width: 560px; }
.rl-hero .ph.flip { animation: flipIn 0.55s cubic-bezier(.25,1.6,.45,1); }
@keyframes flipIn { 0% { transform: perspective(600px) rotateY(80deg) scale(0.9); } }
.rl-hero.fresh .ph { animation: cardPop 0.7s cubic-bezier(.25,1.8,.45,1) both; }
.rl-hero .hl { position: absolute; border-radius: 6px; box-shadow: 0 0 0 2px rgba(255,255,255,0.85), 0 0 14px 2px rgba(150,240,255,0.85), 0 0 0 999px rgba(4,24,44,0.26); }
.rl-hero .nw { position: absolute; left: 8px; top: 8px; padding: 2px 10px 4px; border-radius: 9px; font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #6a3a00; background: linear-gradient(180deg, #fff3a0 0 40%, #ffc838 40%); box-shadow: 0 0 0 1px #7a4a08, 0 0 16px rgba(255,210,80,0.9); animation: stampIn2 0.6s 0.2s cubic-bezier(.25,1.8,.45,1) both; }
@keyframes stampIn2 { from { transform: scale(2.4) rotate(-12deg); opacity: 0; } }
.rl-hero .gone { position: absolute; inset: 0; display: grid; place-items: center; color: #9ab0c4; }
.rl-hero .cap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 5px; color: var(--ink2); font-size: 16px; }
.rl-hero .cap > span { flex: 1; min-width: 160px; } .rl-hero .cap i { color: #8aa0b4; }
.rl-hero .picker { display: none; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 6px; padding: 6px; border-radius: 6px; background: #eef7fd; box-shadow: inset 0 0 0 1px #b8d4e8; }
.rl-hero .picker.on { display: flex; animation: lnIn 0.35s cubic-bezier(.25,1.6,.45,1) both; }
.rl-hero .picker > span { width: 100%; color: var(--ink2); }
.pt { position: relative; flex: none; width: 88px; height: 55px; border-radius: 4px; background-color: #0b1a26; background-repeat: no-repeat; image-rendering: pixelated; box-shadow: 0 0 0 1px #6a8aa6; transition: transform 0.4s cubic-bezier(.25,1.9,.45,1); }
.pt.hov { transform: translateY(-3px) scale(1.04); box-shadow: 0 0 0 1px #5ab4e8, 0 0 10px rgba(120,220,255,0.7); }
.pt.press { transform: scale(0.94, 0.88); transition-duration: 0.05s; }
.pt.on { box-shadow: 0 0 0 3px #22c4e6, 0 0 12px rgba(40,200,255,0.7); }
.pt i { position: absolute; left: 3px; top: 2px; font: 13px/13px 'Jersey 10', 'Pixelify Sans', monospace; font-style: normal; color: #fff; padding: 0 3px; border-radius: 3px; background: rgba(10,60,100,0.75); }
.rl-title h2 { margin: 4px 0 0; font: 32px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; letter-spacing: 0.01em; }
.rl-title > i { color: #5a7690; font-size: 18px; }
.rl-title .chips { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px; }
.rl-title .chips span { padding: 1px 8px 2px; border-radius: 9px; font-size: 16px; background: linear-gradient(180deg, #ffffff 0 50%, #e6f2fa 50%); box-shadow: 0 0 0 1px #9ab8d0; color: #2a4a66; }
.rl-title .chips .st { background: linear-gradient(180deg, #f2ffe4 0 50%, #d6f5bc 50%); box-shadow: 0 0 0 1px #6cc44a; color: #1f6410; }
.rl-title .chips .dg { background: linear-gradient(180deg, #fff0e8 0 50%, #ffd4c4 50%); box-shadow: 0 0 0 1px #e8583a; color: #a8301c; }
.rl-page .blurb { margin: 8px 0 10px; font-size: 18px; line-height: 19px; }
.rl-sec { margin: 0 0 10px; }
.rl-sec h4, .phs h4 { margin: 0 0 5px; font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; display: flex; align-items: center; gap: 8px; }
.rl-sec h4 b, .phs h4 b { font-weight: 400; font-size: 17px; padding: 0 8px 1px; border-radius: 9px; color: #fff; background: linear-gradient(180deg, #8ae86a 0 45%, #3a9a22 45%); box-shadow: 0 0 0 1px #1c5e0e; text-shadow: 0 1px 0 #1c5e0e; }
.rl-sec ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.rl-sec li { display: flex; gap: 7px; align-items: flex-start; padding: 3px 7px; border-radius: 5px; background: #f4f8fb; color: #6a849a; }
.rl-sec li > i { flex: none; font-style: normal; width: 16px; text-align: center; }
.rl-sec li small { color: #9ab0c4; }
.rl-sec li.ok { background: #f0fbe8; color: #1c5e0e; } .rl-sec li.ok > i { color: #3a9a22; }
.rl-sec.facts li.ok { background: linear-gradient(180deg, #fffbe8, #fff4c8); color: #4a3a10; } .rl-sec.facts li.ok > i { color: #e8a020; }
.rl-sec.facts li b { color: inherit; font-weight: 400; font-family: 'Jersey 10', 'Pixelify Sans', monospace; font-size: 18px; margin-right: 4px; }
.rl-sec.facts li.lock small { display: block; }
.rl-sheet { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin: 0 0 10px; }
.rl-sheet .sec { padding: 7px 10px 8px; border-radius: 7px; background: linear-gradient(180deg, #ffffff, #f2f8fc); box-shadow: 0 0 0 1px #c4d8e6; }
.rl-sheet .sec h5 { margin: 0 0 3px; font: 19px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #1a7ac0; }
.rl-sheet .sec p { margin: 0; line-height: 18px; }
.rl-sheet .notes { grid-column: 1 / -1; background: repeating-linear-gradient(180deg, #fffdf2 0 17px, #e8e2c8 17px 18px); box-shadow: 0 0 0 1px #d8cfa8; }
.rl-sheet .notes h5 { color: #8a6a18; }
.rl-sheet .notes ul { margin: 0; padding-left: 18px; color: #4a3a20; line-height: 18px; }
.rl-sheet .pending { grid-column: 1 / -1; color: #6a849a; font-style: italic; }
.rl-sec.pics .strip { display: flex; gap: 8px; flex-wrap: wrap; }
@container (max-width: 600px) {
  .rl-body { flex-direction: column; }
  .rl-list { width: auto !important; flex-direction: row; overflow-x: auto; overflow-y: hidden; padding: 6px 8px; box-shadow: inset 0 -1px 0 #b8d0e2; }
  .rl-card { width: 190px; }
  .rl-q { width: 150px; }
  .rl-top .prog { display: none; }
}

/* ---- photos & viewer */
.phs h4 { margin: 10px 0 6px; } .phs h4:first-child { margin-top: 0; }
.phs .gal figure { position: relative; }
.phs .gal figure img { aspect-ratio: 16 / 9; object-fit: cover; }
.phs .muted { color: #6a849a; font-style: italic; }
.phs-cam { display: flex; align-items: center; gap: 8px; padding: 6px 10px; margin-bottom: 8px; border-radius: 7px; background: linear-gradient(180deg, #f4ffe8 0 50%, #e2f8cc 50%); box-shadow: 0 0 0 1px #6cc44a, inset 0 0 0 1px #fff; animation: mosBal 0.5s cubic-bezier(.25,1.7,.45,1) both; }
.phs-cam > span:nth-child(2) { flex: 1; }
.pv { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
.pv .ph { flex: 1.6 1 300px; min-width: 0; margin-top: 22px; }
.pv-info { flex: 1 1 190px; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.pv-info .meta { color: var(--ink2); }
.pv-info .acts { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.pv-info .tg { align-self: flex-start; }
`;
