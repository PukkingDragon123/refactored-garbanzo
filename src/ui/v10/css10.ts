// MoriOS V10 apps (Upload Everything, Zealandia Encyclopedia, ZEA Mail, Skill Tree): the same glossy
// aero look as ../v7/aeroCss and ../v7/aeroResearchCss.

export const CSS10 = `
/* ---- desktop bits */
.mos-tray .rpc { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px 2px; border-radius: 9px; color: #fff3a0; background: linear-gradient(180deg, rgba(255,240,170,0.35) 0 50%, rgba(240,170,40,0.3) 50%); box-shadow: inset 0 0 0 1px rgba(255,236,170,0.6); }
.mos-tray .rpc.hov { box-shadow: inset 0 0 0 1px #fff, 0 0 10px rgba(255,220,120,0.9); }
.mos-tray .rpc.pop { animation: icSquash 0.55s cubic-bezier(.3,1.7,.5,1); }
.mos-tray .ml { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px 1px 3px; border-radius: 9px; background: linear-gradient(180deg, rgba(255,210,200,0.45) 0 50%, rgba(240,90,60,0.35) 50%); box-shadow: inset 0 0 0 1px rgba(255,220,210,0.7); }
.mos-tray .ml .pxi { width: 18px !important; height: 18px !important; }
.mos-tray .ml.hov { box-shadow: inset 0 0 0 1px #fff, 0 0 10px rgba(255,160,130,0.9); }
.mos-ic.big0 .pxi { filter: drop-shadow(0 3px 0 rgba(0,40,70,0.3)) drop-shadow(0 0 7px rgba(255,230,140,0.85)); }
.mos-win .bd .enc, .mos-win .bd .up, .mos-win .bd .zm, .mos-win .bd .sk { height: calc(100% + 22px); margin: -10px -12px -12px; container-type: inline-size; display: flex; flex-direction: column; }
.enc-list, .enc-page, .enc-cats, .up-cards, .up-stage, .lab-r .feed, .lab-q, .zm-list, .zm-read, .sk-tree, .sk-info, .up-rep, .notes10 .pile { touch-action: pan-x pan-y; overscroll-behavior: contain; }
.v10-head { flex: none; display: flex; align-items: center; gap: 10px; padding: 6px 12px; color: #fff; text-shadow: 0 1px 0 #0a4a7a; background: linear-gradient(180deg, #8fdcff 0 46%, #2c9ee0 46% 88%, #6fd4ff 88%); box-shadow: inset 0 -1px 0 #0a5f8e; }

/* ---- encyclopedia */
.enc-top { flex: none; display: flex; align-items: center; gap: 9px; padding: 6px 12px; color: #fff; text-shadow: 0 1px 0 #145a24; background: linear-gradient(180deg, #a6f08a 0 46%, #3aa04a 46% 88%, #86e070 88%); box-shadow: inset 0 -1px 0 #1d6a2c; }
.enc-top > b { font: 25px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; letter-spacing: 0.02em; }
.enc-top .bk .pxi { display: block; animation: icHop 0.7s 0.15s cubic-bezier(.3,1.6,.5,1) both; }
.enc-top .ov { margin-left: auto; display: flex; align-items: center; gap: 7px; white-space: nowrap; }
.enc-top .ov em { font: 24px/1 'Jersey 10', 'Pixelify Sans', monospace; font-style: normal; color: #fff6b0; }
.enc-top .ring { width: 26px; height: 26px; border-radius: 50%; background: conic-gradient(#ffe27a var(--p), rgba(255,255,255,0.3) 0); -webkit-mask: radial-gradient(closest-side, transparent 0 55%, #000 58%); mask: radial-gradient(closest-side, transparent 0 55%, #000 58%); box-shadow: 0 0 8px rgba(255,240,150,0.6); }
.enc-body { flex: 1; min-height: 0; display: flex; }
.enc-cats { flex: none; width: 166px; overflow: auto; padding: 8px 6px; display: flex; flex-direction: column; gap: 5px; background: linear-gradient(180deg, #f2fbec, #e2f2d8); box-shadow: inset -1px 0 0 #b8d8a8; }
.enc-cat { position: relative; display: grid; grid-template-columns: 28px 1fr auto; grid-template-rows: auto 6px; column-gap: 6px; row-gap: 3px; align-items: center; padding: 5px 7px 6px; border-radius: 7px; background: #fff; box-shadow: 0 0 0 1px #c4dcb8, 0 2px 0 rgba(30,80,20,0.08); transition: transform 0.4s cubic-bezier(.25,1.9,.45,1); }
.enc-cat img { grid-row: 1 / 3; width: 28px; height: 28px; image-rendering: pixelated; }
.enc-cat .nm { font: 17px/16px 'Jersey 10', 'Pixelify Sans', monospace; color: #1f5a1a; overflow: hidden; }
.enc-cat .pc { font: 16px/1 'Jersey 15', 'Pixelify Sans', monospace; color: #2a8a18; }
.enc-cat .bar { grid-column: 2 / 4; height: 6px; border-radius: 3px; background: #e2ecdc; box-shadow: inset 0 1px 1px rgba(0,40,0,0.18); overflow: hidden; }
.enc-cat .bar u, .enc-card .pb u, .enc-prog i u, .trow i u { display: block; height: 100%; border-radius: inherit; background: linear-gradient(180deg, #c2f59a 0 45%, #4cb42c 45%); }
.enc-cat .nw { position: absolute; right: -4px; top: -6px; min-width: 18px; padding: 0 4px; border-radius: 9px; font: 14px/17px 'Jersey 10', 'Pixelify Sans', monospace; text-align: center; color: #6a3a00; background: linear-gradient(180deg, #fff3a0 0 40%, #ffc838 40%); box-shadow: 0 0 0 1px #7a4a08; animation: mosBadge 1.1s cubic-bezier(.3,1.8,.5,1) infinite; }
.enc-cat.hov { transform: translateX(3px); box-shadow: 0 0 0 1px #6cc44a, 0 4px 10px rgba(30,80,20,0.15); }
.enc-cat.press { transform: scale(0.96, 0.9); transition-duration: 0.05s; }
.enc-cat.on { box-shadow: 0 0 0 2px #4cb42c, 0 0 12px rgba(90,220,60,0.5); background: linear-gradient(180deg, #ffffff, #f0fbe6); }
.enc-list { flex: none; width: 214px; overflow: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; background: linear-gradient(180deg, #eef7fd, #e0eef8); box-shadow: inset -1px 0 0 #b8d0e2; }
.enc-list .hd { display: flex; align-items: baseline; gap: 8px; padding: 0 2px; }
.enc-list .hd b { font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.enc-list .hd span { color: #5a7690; margin-left: auto; }
.enc-list .wbtn { align-self: stretch; }
.enc-list .wbtn.on { --g1:#f2ffe4; --g2:#c2f592; --g3:#5cc43c; --g4:#389c22; --g5:#9df06a; --gk:#1c5e0e; color: #fff; text-shadow: 0 1px 0 #1c5e0e, 1px 0 0 #1c5e0e, -1px 0 0 #1c5e0e, 0 -1px 0 #1c5e0e; }
.enc-none { padding: 10px 6px; color: #5a7690; font-style: italic; }
.enc-card { position: relative; flex: none; display: flex; gap: 7px; align-items: center; padding: 4px; border-radius: 6px; background: #fff; box-shadow: 0 0 0 1px #b8cfe0, 0 2px 0 rgba(0,40,80,0.08); transition: transform 0.4s cubic-bezier(.25,1.9,.45,1); }
.enc-card .th { flex: none; width: 58px; height: 44px; border-radius: 4px; background-color: #0b1a26; background-repeat: no-repeat; image-rendering: pixelated; box-shadow: 0 0 0 1px #6a8aa6; display: grid; place-items: center; }
.enc-card .th.it, .enc-card .th.ic { background: radial-gradient(circle at 50% 40%, #ffffff, #dff0fb); }
.enc-card .th img { width: 40px; height: 40px; image-rendering: pixelated; }
.enc-card .th.q { background: repeating-linear-gradient(135deg, #eef4f8 0 6px, #e4ecf2 6px 12px); color: #9ab0c4; font: 28px/1 'Jersey 10', 'Pixelify Sans', monospace; }
.enc-card .tx { min-width: 0; flex: 1; display: flex; flex-direction: column; line-height: 15px; }
.enc-card .tx b { font: 17px/16px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.enc-card .tx i { font-style: normal; color: #6a849a; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.enc-card .pb { display: block; height: 5px; margin-top: 3px; border-radius: 3px; background: #e6eef4; overflow: hidden; }
.enc-card.unk .tx b { color: #9ab0c4; letter-spacing: 0.1em; }
.enc-card.hov { transform: translateX(3px); box-shadow: 0 0 0 1px #5ab4e8, 0 4px 10px rgba(0,40,80,0.15); }
.enc-card.press { transform: scale(0.96, 0.9); transition-duration: 0.05s; }
.enc-card.on { box-shadow: 0 0 0 2px #22c4e6, 0 0 12px rgba(40,200,255,0.55); background: linear-gradient(180deg, #ffffff, #e8f8ff); }
.enc-card.fresh::after { content: 'NEW'; position: absolute; right: -4px; top: -6px; padding: 1px 5px 2px; border-radius: 7px; font: 13px/13px 'Jersey 10', 'Pixelify Sans', monospace; color: #6a3a00; background: linear-gradient(180deg, #fff3a0 0 40%, #ffc838 40%); box-shadow: 0 0 0 1px #7a4a08; animation: mosBadge 1.1s cubic-bezier(.3,1.8,.5,1) infinite; }
.enc-card.pop { animation: cardPop 0.6s cubic-bezier(.25,1.8,.45,1) both; }
.enc-page { flex: 1; min-width: 0; overflow: auto; padding: 12px 14px 16px; }
.enc-page .rl-empty img.big { width: 72px; height: 72px; image-rendering: pixelated; }
.enc-page .rl-empty.locked .qq, .enc-hero.sil .qq { width: 96px; height: 96px; display: grid; place-items: center; border-radius: 50%; font: 64px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #9ab0c4; background: repeating-linear-gradient(135deg, #eef4f8 0 8px, #e2eaf0 8px 16px); box-shadow: 0 0 0 2px #c4d6e4, inset 0 2px 6px rgba(0,30,60,0.12); }
.enc-hero { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; padding: 10px 12px; border-radius: 8px; background: linear-gradient(180deg, #ffffff, #eef6fb); box-shadow: 0 0 0 1px #c4d8e6, inset 0 0 0 1px #fff; animation: cardPop 0.55s cubic-bezier(.25,1.8,.45,1) both; }
.enc-hero.sil { justify-content: center; padding: 18px; }
.enc-hero .plinth { flex: none; width: 112px; height: 112px; display: grid; place-items: center; border-radius: 10px; background: radial-gradient(circle at 50% 38%, #ffffff 0 30%, #e4f2fb 70%, #cfe4f2); box-shadow: 0 0 0 1px #9ab8d0, inset 0 -6px 0 rgba(10,60,100,0.08), 0 4px 10px rgba(0,30,60,0.15); }
.enc-hero .plinth img.big { width: 96px; height: 96px; image-rendering: pixelated; animation: plinthIn 0.8s cubic-bezier(.25,1.8,.45,1) both; }
@keyframes plinthIn { 0% { transform: translateY(-20px) scale(0.4) rotate(-12deg); opacity: 0; } 60% { opacity: 1; } }
.enc-hero.place > img.big { width: 84px; height: 84px; image-rendering: pixelated; flex: none; }
.enc-hero .tag { position: relative; display: flex; flex-direction: column; gap: 2px; padding: 8px 12px 8px 20px; border-radius: 4px 9px 9px 4px; color: #4a3a20; background: repeating-linear-gradient(180deg, #fffdf2 0 17px, #ece4c8 17px 18px); box-shadow: 0 0 0 1px #d8cfa8, 2px 3px 0 rgba(80,60,20,0.12); transform: rotate(-1.5deg); min-width: 0; }
.enc-hero .tag::before { content: ''; position: absolute; left: 6px; top: 50%; width: 7px; height: 7px; margin-top: -4px; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 1px #b8a878; }
.enc-hero .tag b { font: 19px/18px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #8a5a10; }
.enc-hero .tag span { font-size: 16px; line-height: 17px; }
.enc-hero.taonga { background: linear-gradient(180deg, #fffdf6, #f6efdf); box-shadow: 0 0 0 1px #d8c8a0, inset 0 0 0 1px #fff, 0 0 18px rgba(255,236,190,0.6); }
.enc-prog { display: flex; align-items: center; gap: 8px; margin: 6px 0 2px; color: #3a5a78; }
.enc-prog i { flex: 1; max-width: 260px; height: 9px; border-radius: 5px; background: #e2ecf2; box-shadow: inset 0 1px 2px rgba(0,30,60,0.2); overflow: hidden; }
.enc-prog b { font: 19px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #2a8a18; }
.rl-title .chips .tg { background: linear-gradient(180deg, #fffaf0 0 50%, #f4e6c4 50%); box-shadow: 0 0 0 1px #c8a868; color: #7a5a18; }
.rl-sheet .sec.locked { background: linear-gradient(180deg, #f6f9fb, #eef3f7); box-shadow: 0 0 0 1px #d4e0ea; }
.rl-sheet .sec.locked h5 { color: #9ab0c4; }
.rl-sheet .sec.locked .blur { display: flex; flex-direction: column; gap: 6px; padding: 4px 0 2px; }
.rl-sheet .sec.locked .blur i { display: block; height: 9px; border-radius: 5px; background: linear-gradient(90deg, #dfe8ef, #e9eff4 40%, #dfe8ef); background-size: 200% 100%; animation: blurShine 2.4s linear infinite; filter: blur(0.6px); }
@keyframes blurShine { to { background-position: -200% 0; } }
.rl-sheet .sec.nudge { grid-column: 1 / -1; color: #5a7690; font-style: italic; background: linear-gradient(180deg, #f4fbff, #e8f4fc); box-shadow: 0 0 0 1px #b8d8ec; }
.rl-sheet .sec.fun { grid-column: 1 / -1; background: linear-gradient(180deg, #fffbe2, #fff2b8); box-shadow: 0 0 0 1px #f0ce6a, 0 0 12px rgba(255,210,80,0.35); }
.rl-sheet .sec.fun h5 { color: #a86a08; }
.rl-sheet .sec.webs { grid-column: 1 / -1; }
.rl-sheet .sec.res { grid-column: 1 / -1; background: linear-gradient(180deg, #f6fff0, #e8f8dc); box-shadow: 0 0 0 1px #9ad480; }
.rl-sheet .sec.res h5 { color: #2a7a18; } .rl-sheet .sec.res h5 small { color: #6a8a5a; font-size: 15px; }
.rl-sheet .sec.culture { grid-column: 1 / -1; background: linear-gradient(180deg, #fffdf6, #f8f0de); box-shadow: 0 0 0 1px #d8c8a0; color: #4a3a20; }
.rl-sheet .sec.culture h5 { color: #8a5a18; } .rl-sheet .sec.culture p + p { margin-top: 6px; }
.rl-sheet .sec small { color: #6a849a; }
.rl-sheet .sec.edible { background: linear-gradient(180deg, #f4ffe8, #e2f8cc); box-shadow: 0 0 0 1px #6cc44a; } .rl-sheet .sec.edible h5 { color: #2a8a18; }
.rl-sheet .sec.poison { background: linear-gradient(180deg, #fff3ef, #ffe0d6); box-shadow: 0 0 0 1px #e8583a; } .rl-sheet .sec.poison h5 { color: #a8301c; }
.enc-ln { display: inline-block; padding: 0 6px; border-radius: 9px; }
.enc-ln.ctl { color: #0a6db0; background: #e4f4fe; box-shadow: 0 0 0 1px #9ad0f0; transition: transform 0.35s cubic-bezier(.25,1.9,.45,1); }
.enc-ln.ctl.hov { transform: translateY(-1px); box-shadow: 0 0 0 1px #3aa6e0, 0 0 8px rgba(80,200,255,0.6); }
.enc-ln.off { color: #6a849a; }
/* the little food web */
.fweb { position: relative; height: 230px; margin-top: 8px; border-radius: 8px; background: radial-gradient(ellipse at 50% 50%, #ffffff 0 30%, #eef6fb 75%); box-shadow: inset 0 0 0 1px #d4e4ee; }
.fweb.locked { display: grid; place-items: center; height: auto; min-height: 120px; padding: 14px; background: repeating-linear-gradient(135deg, #f4f8fb 0 10px, #edf3f7 10px 20px); }
.enc-bigweb.fweb.locked { min-height: 300px; height: auto; }
.fweb .tz { max-width: 380px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; color: #3a5a78; }
.fweb .tz b { font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.fweb .tz em { font-style: normal; color: #6a3ab0; }
.fweb svg, .enc-bigweb svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.fweb svg line { stroke-linecap: round; opacity: 0.8; }
.wn { position: absolute; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; background-color: #0b1a26; background-repeat: no-repeat; image-rendering: pixelated; box-shadow: 0 0 0 2px #fff, 0 0 0 3px #6a8aa6, 0 3px 6px rgba(0,30,60,0.25); transition: transform 0.4s cubic-bezier(.25,1.9,.45,1); animation: wnIn 0.5s cubic-bezier(.25,1.8,.45,1) both; display: grid; place-items: center; font: 26px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #9ab0c4; }
@keyframes wnIn { from { transform: scale(0.2); opacity: 0; } }
.wn.c { width: 66px; height: 66px; margin: -33px 0 0 -33px; box-shadow: 0 0 0 3px #fff, 0 0 0 5px #22c4e6, 0 0 16px rgba(40,200,255,0.6); z-index: 2; }
.wn.unk { background: repeating-linear-gradient(135deg, #eef4f8 0 5px, #e2eaf0 5px 10px); box-shadow: 0 0 0 2px #fff, 0 0 0 3px #b8cad8; }
.wn span { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 4px; display: flex; flex-direction: column; align-items: center; white-space: nowrap; pointer-events: none; }
.wn span b { font: 15px/14px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; padding: 0 5px; border-radius: 6px; background: rgba(255,255,255,0.9); }
.wn span em { font: 13px/13px 'Jersey 15', 'Pixelify Sans', monospace; font-style: normal; padding: 0 4px; border-radius: 5px; background: rgba(255,255,255,0.85); }
.wn.hov { transform: scale(1.12); z-index: 3; }
.wn.press { transform: scale(0.94); }
.fweb .wcount, .enc-bigweb .wcount { position: absolute; right: 8px; bottom: 6px; font-size: 14px; color: #6a849a; }
.enc-webhd h2 { margin: 0; font: 30px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.enc-webhd p { margin: 4px 0 6px; color: #3a5a78; }
.enc-webhd .lg { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; font-size: 15px; color: #3a5a78; }
.enc-webhd .lg i { display: inline-block; width: 16px; height: 3px; margin-right: 5px; vertical-align: 4px; border-radius: 2px; }
.enc-bigweb { position: relative; height: max(380px, calc(100% - 110px)); min-height: 360px; border-radius: 8px; background: radial-gradient(ellipse at 50% 50%, #ffffff 0 25%, #eaf4fa 80%); box-shadow: inset 0 0 0 1px #d4e4ee; }
.enc-bigweb svg line { opacity: 0.55; }
.wn.sm { width: 34px; height: 34px; margin: -17px 0 0 -17px; }
.wn.sm span b { font-size: 13px; opacity: 0; transition: opacity 0.15s; }
.wn.sm.hov span b { opacity: 1; }
@container (max-width: 700px) {
  .enc-body { flex-direction: column; overflow: auto; }
  .enc-cats { width: auto; flex-direction: row; overflow-x: auto; overflow-y: hidden; padding: 6px 8px; box-shadow: inset 0 -1px 0 #b8d8a8; }
  .enc-cat { flex: none; width: 150px; }
  .enc-list { width: auto; flex-direction: row; overflow-x: auto; overflow-y: hidden; padding: 6px 8px; box-shadow: inset 0 -1px 0 #b8d0e2; }
  .enc-list .hd { flex-direction: column; align-items: flex-start; justify-content: center; flex: none; }
  .enc-list .wbtn { align-self: center; flex: none; }
  .enc-card { width: 190px; }
  .enc-page { overflow: visible; }
  .enc-top .ov span { display: none; }
}

/* ---- upload everything */
.up-top { flex: none; display: flex; align-items: center; gap: 10px; padding: 6px 12px; color: #fff; text-shadow: 0 1px 0 #6a3a00; background: linear-gradient(180deg, #ffe7a0 0 46%, #e8a030 46% 88%, #ffd070 88%); box-shadow: inset 0 -1px 0 #9a6010; }
.up-top .crt .pxi { display: block; height: 40px !important; width: auto !important; animation: icHop 0.7s 0.15s cubic-bezier(.3,1.6,.5,1) both; }
.up-top .tt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.up-top .tt b { font: 25px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; }
.up-top .tt span { font-size: 16px; }
.up-top .rpb { display: flex; align-items: center; gap: 4px; font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #fff8c8; white-space: nowrap; }
.up-top .rpb img { width: 24px; height: 24px; image-rendering: pixelated; }
.up-cards { flex: 1; min-height: 0; overflow: auto; padding: 10px 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; align-content: start; }
.up-card { padding: 8px 10px 10px; border-radius: 9px; background: linear-gradient(180deg, #ffffff, #f2f8fc); box-shadow: 0 0 0 1px #b8cfe0, inset 0 0 0 1px #fff, 0 3px 0 rgba(0,40,80,0.07); animation: lnIn 0.45s cubic-bezier(.25,1.6,.45,1) both; }
.up-card:nth-child(2) { animation-delay: 80ms; } .up-card:nth-child(3) { animation-delay: 160ms; }
.up-card h4 { margin: 0 0 6px; display: flex; align-items: center; gap: 6px; font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.up-card h4 img, .up-card h4 .pxi { width: 26px !important; height: 26px !important; image-rendering: pixelated; }
.up-card h4 b { font-weight: 400; font-size: 17px; padding: 0 8px 1px; border-radius: 9px; color: #fff; background: linear-gradient(180deg, #8ae86a 0 45%, #3a9a22 45%); box-shadow: 0 0 0 1px #1c5e0e; text-shadow: 0 1px 0 #1c5e0e; }
.up-card p { margin: 6px 0 0; color: #5a7690; font-size: 16px; }
.up-card.cam, .up-card.pack { grid-column: 1 / -1; }
.up-card.cam .strip { display: flex; gap: 5px; overflow: hidden; }
.up-card.cam .strip img { flex: none; width: 88px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 3px; image-rendering: pixelated; box-shadow: 0 0 0 1px #9ab8d0; animation: lnIn 0.4s cubic-bezier(.25,1.6,.45,1) both; }
.up-card.pack .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 7px; }
.up-t { position: relative; display: flex; flex-direction: column; align-items: center; padding: 6px 4px 5px; border-radius: 7px; text-align: center; background: #fff; box-shadow: 0 0 0 1px #b8cfe0, 0 2px 0 rgba(0,40,80,0.08); transition: transform 0.4s cubic-bezier(.25,1.9,.45,1), box-shadow 0.15s, opacity 0.2s; }
.up-t img { width: 44px; height: 44px; image-rendering: pixelated; }
.up-t .n { position: absolute; right: 4px; top: 3px; font: 16px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #3a5a78; }
.up-t b { font: 15px/14px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.up-t em { font: 13px/13px 'Jersey 15', 'Pixelify Sans', monospace; font-style: normal; margin-top: 2px; padding: 1px 6px; border-radius: 7px; color: #fff; background: linear-gradient(180deg, #8ae86a 0 45%, #3a9a22 45%); box-shadow: 0 0 0 1px #1c5e0e; }
.up-t.all, .up-t.in { box-shadow: 0 0 0 2px #4cb42c, 0 0 10px rgba(90,220,60,0.45); }
.up-t.one { box-shadow: 0 0 0 2px #22c4e6, 0 0 10px rgba(40,200,255,0.45); }
.up-t.one em { background: linear-gradient(180deg, #9aeeff 0 45%, #1492cc 45%); box-shadow: 0 0 0 1px #0a5f8e; }
.up-t.keep { opacity: 0.6; } .up-t.keep img { filter: saturate(0.3); }
.up-t.keep em { color: #3a5a78; background: #e6eef4; box-shadow: 0 0 0 1px #9ab8d0; }
.up-t.rare.all, .up-t.rare.in { box-shadow: 0 0 0 2px #f0ae22, 0 0 12px rgba(255,200,80,0.55); }
.up-t.rare em { background: linear-gradient(180deg, #ffe68a 0 45%, #d08c14 45%); box-shadow: 0 0 0 1px #7a4a08; }
.up-t.hov { transform: translateY(-3px); }
.up-t.press { transform: scale(0.93, 0.86); transition-duration: 0.05s; }
.up-t.bop { animation: mosBump 0.45s cubic-bezier(.25,1.9,.45,1); }
.up-card.off .tiles { opacity: 0.55; }
.up-card .lg { font-size: 15px; }
.up-card.notes ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.up-card.notes li { display: flex; gap: 7px; align-items: center; padding: 3px 6px; border-radius: 6px; background: repeating-linear-gradient(180deg, #fffdf2 0 15px, #ece4c8 15px 16px); box-shadow: 0 0 0 1px #d8cfa8; }
.up-card.notes li img { width: 28px; height: 28px; image-rendering: pixelated; flex: none; }
.up-card.notes li span { display: flex; flex-direction: column; min-width: 0; }
.up-card.notes li b { font: 17px/16px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #6a4a10; }
.up-card.notes li i { font-style: normal; font-size: 14px; color: #8a7a5a; }
.up-card.notes li.more { color: #8a7a5a; font-style: italic; background: none; box-shadow: none; }
.up-empty { grid-column: 1 / -1; max-width: 420px; margin: 30px auto; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; color: #3a5a78; }
.up-empty b { font: 26px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.up-foot { flex: none; display: flex; align-items: center; gap: 10px; justify-content: flex-end; flex-wrap: wrap; padding: 8px 12px 10px; border-top: 1px solid #d4e4f0; background: linear-gradient(180deg, #f8fcff, #eef6fb); }
.up-foot .sum { flex: 1; color: #3a5a78; }
.up-steps { flex: none; display: flex; align-items: center; gap: 4px; padding: 7px 12px; background: linear-gradient(180deg, #f6fbff, #e2eff8); box-shadow: inset 0 -1px 0 #b8d0e2; overflow-x: auto; }
.up-steps span { flex: none; display: flex; align-items: center; gap: 5px; padding: 2px 10px 3px 4px; border-radius: 12px; color: #6a849a; transition: transform 0.4s cubic-bezier(.25,1.9,.45,1); }
.up-steps span i { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font: 15px/1 'Jersey 10', 'Pixelify Sans', monospace; font-style: normal; color: #fff; background: #9ab0c4; }
.up-steps span.on { color: #0b4a7a; background: #fff; box-shadow: 0 0 0 1px #5ab4e8, 0 0 10px rgba(90,200,255,0.5); transform: scale(1.06); }
.up-steps span.on i { background: linear-gradient(180deg, #9aeeff 0 45%, #1492cc 45%); }
.up-steps span.done { color: #2a8a18; } .up-steps span.done i { background: linear-gradient(180deg, #c2f59a 0 45%, #3a9a22 45%); }
.up-steps span.nop { opacity: 0.45; text-decoration: line-through; }
.up-steps u { flex: none; width: 14px; height: 2px; background: #b8cfe0; }
.up-steps .ff { margin-left: auto; flex: none; }
.up-stage { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.up .imp.up-ph { flex: 1; min-height: 0; height: auto; margin: 0; padding: 8px 12px 10px; }
/* the lab bench */
.bench { flex: 1; min-height: 0; display: flex; gap: 12px; padding: 10px 12px; }
.lab-q { flex: none; width: 70px; overflow: auto; display: flex; flex-direction: column; gap: 6px; padding: 2px; }
.lab-q .qt { position: relative; flex: none; height: 58px; display: grid; place-items: center; border-radius: 7px; background: #fff; box-shadow: 0 0 0 1px #b8cfe0; opacity: 0.6; transition: transform 0.35s cubic-bezier(.25,1.9,.45,1), opacity 0.3s; }
.lab-q .qt img { width: 40px; height: 40px; image-rendering: pixelated; }
.lab-q .qt span { position: absolute; right: 3px; bottom: 1px; font: 14px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #3a5a78; }
.lab-q .qt.on { opacity: 1; transform: scale(1.08); box-shadow: 0 0 0 2px #22c4e6, 0 0 10px rgba(40,200,255,0.8); }
.lab-q .qt.done { opacity: 0.45; transform: scale(0.9); }
.lab-q .qt.done.hit { opacity: 0.85; box-shadow: 0 0 0 2px #4cb42c; }
.lab-c { flex: 1.1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.scope { position: relative; width: min(230px, 100%); aspect-ratio: 1; margin-top: 6px; }
.scope .ring { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, rgba(90,220,255,0) 0deg, rgba(90,220,255,0.9) 50deg, rgba(90,220,255,0) 100deg, rgba(160,255,200,0) 180deg, rgba(160,255,200,0.85) 230deg, rgba(160,255,200,0) 280deg); -webkit-mask: radial-gradient(closest-side, transparent 0 80%, #000 82% 93%, transparent 95%); mask: radial-gradient(closest-side, transparent 0 80%, #000 82% 93%, transparent 95%); animation: scopeSpin 1.4s linear infinite; }
@keyframes scopeSpin { to { transform: rotate(360deg); } }
.scope .dish { position: absolute; inset: 12%; display: grid; place-items: center; border-radius: 50%; background: radial-gradient(circle at 40% 32%, #ffffff 0 18%, #e4f6ff 45%, #b8e2f6 80%, #8ccbe8); box-shadow: 0 0 0 3px #fff, 0 0 0 5px #5aaed6, inset 0 -8px 18px rgba(10,80,130,0.25), 0 8px 18px rgba(0,30,60,0.25); overflow: hidden; }
.scope .dish img { width: 62%; height: 62%; image-rendering: pixelated; }
.scope.in .dish img { animation: dishIn 0.55s cubic-bezier(.25,1.8,.45,1) both; }
@keyframes dishIn { from { transform: translateY(-60%) scale(0.3) rotate(-20deg); opacity: 0; } }
.scope .beam { position: absolute; inset: 12%; border-radius: 50%; pointer-events: none; background: linear-gradient(180deg, transparent 0 40%, rgba(140,255,230,0.55) 48%, rgba(230,255,250,0.9) 50%, rgba(140,255,230,0.55) 52%, transparent 60%); background-size: 100% 240%; animation: beamGo 1.1s ease-in-out infinite alternate; mix-blend-mode: screen; }
@keyframes beamGo { from { background-position: 0 0; } to { background-position: 0 100%; } }
.scope.care .ring { filter: hue-rotate(160deg) saturate(0.6); animation-duration: 2.6s; }
.scope.care .beam { opacity: 0.4; }
.scope .stamp { left: 50%; top: 50%; }
.stamp.rep { display: block; background: linear-gradient(180deg, #e8fdff 0 30%, #7ae6ff 30% 70%, #22b4e2 70%); color: #063e5e; box-shadow: 0 0 0 2px #0a5f8e, 0 0 0 4px #fff; font-size: 26px; }
.stamp.filed { display: block; background: rgba(20,40,60,0.7); font-size: 22px; transform: translate(-50%, -50%); box-shadow: 0 0 0 1px rgba(255,255,255,0.5); }
.stamp.care { display: block; transform: translate(-50%, -50%); font-size: 26px; color: #5a3a10; background: linear-gradient(180deg, #fffdf2 0 40%, #f4e4c0 40%); box-shadow: 0 0 0 2px #a88a48, 0 0 0 4px #fff, 0 0 24px rgba(255,236,190,0.9); animation-duration: 0.9s; }
.lab-c .bars { display: flex; align-items: flex-end; gap: 3px; width: min(230px, 100%); height: 46px; padding: 3px; border-radius: 5px; background: #0b1a26; box-shadow: 0 0 0 1px #6a8aa6, inset 0 0 8px rgba(0,0,0,0.6); }
.lab-c .bars i { flex: 1; height: 10%; border-radius: 2px 2px 0 0; background: linear-gradient(180deg, #c8ffea, #3ad8b0 40%, #1a8a9a); transition: height 0.08s linear; }
.lab-c .prog { width: min(260px, 100%); flex: none; }
.lab-c .cap { text-align: center; color: #3a5a78; min-height: 20px; }
.lab-r { flex: 1.3; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.lab-r .crate { position: relative; flex: none; align-self: center; display: flex; align-items: flex-end; gap: 6px; }
.lab-r .crate .n { position: absolute; right: -6px; top: -4px; min-width: 26px; height: 26px; padding: 0 5px; border-radius: 13px; text-align: center; font: 20px/26px 'Jersey 10', 'Pixelify Sans', monospace; color: #fff; text-shadow: 0 1px 0 #7a4a08; background: linear-gradient(180deg, #fff3a0 0 30%, #ffc838 30% 70%, #f09a1a 70%); box-shadow: 0 0 0 1px #7a4a08; }
.lab-r .crate.bump { animation: mosBump 0.5s cubic-bezier(.25,1.9,.45,1); }
.lab-r .feed { flex: 1; min-height: 0; overflow: auto; padding-right: 2px; }
.ln.lab { display: flex; gap: 8px; align-items: flex-start; }
.ln.lab > img { flex: none; width: 34px; height: 34px; image-rendering: pixelated; margin-top: 2px; }
.ln.lab > div { min-width: 0; flex: 1; }
.ln.lab .rp { float: right; font: 18px/18px 'Jersey 10', 'Pixelify Sans', monospace; font-style: normal; color: #c88410; }
.ln.lab small.ms { color: #7a8aa0; font-size: 14px; }
.ln.lab small.x { color: #1f6410; }
.ln.lab.rep { background: #f0f8fd; box-shadow: inset 3px 0 0 #5ab4e8; }
.ln.lab.care { background: linear-gradient(180deg, #fffdf6, #f8f0de); box-shadow: inset 3px 0 0 #c8a868; } .ln.lab.care b { color: #7a5a18; }
.up-fly { position: absolute; z-index: 80; pointer-events: none; image-rendering: pixelated; transition: transform 0.45s cubic-bezier(.5,-0.3,.6,1), opacity 0.45s ease-in; }
.notes10 { flex: 1; min-height: 0; display: flex; justify-content: center; padding: 12px; }
.notes10 .nb { width: min(520px, 100%); display: flex; flex-direction: column; min-height: 0; }
.notes10 h4 { margin: 0 0 8px; font: 24px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #6a4a10; }
.notes10 .pile { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 7px; padding: 4px; }
.note-card { position: relative; flex: none; display: flex; gap: 9px; align-items: center; padding: 7px 12px; border-radius: 4px; background: repeating-linear-gradient(180deg, #fffdf2 0 17px, #ece4c8 17px 18px); box-shadow: 0 0 0 1px #d8cfa8, 2px 3px 0 rgba(80,60,20,0.12); animation: noteIn 0.45s cubic-bezier(.25,1.6,.45,1) both; }
.note-card:nth-child(odd) { transform: rotate(-0.8deg); } .note-card:nth-child(even) { transform: rotate(0.6deg); }
@keyframes noteIn { from { translate: 40px -10px; rotate: 8deg; opacity: 0; } }
.note-card > img { width: 40px; height: 40px; image-rendering: pixelated; flex: none; }
.note-card > div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.note-card b { font: 19px/18px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #6a4a10; }
.note-card i { font-style: normal; font-size: 15px; color: #8a7a5a; }
.note-card small { font-size: 15px; color: #4a3a20; }
.note-card .st { position: absolute; right: 10px; top: 50%; padding: 2px 10px 4px; border: 2px solid #c8442c; border-radius: 6px; font: 20px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #c8442c; transform: translateY(-50%) rotate(-10deg) scale(2.2); opacity: 0; }
.note-card.done .st { animation: noteStamp 0.35s cubic-bezier(.25,1.8,.45,1) forwards; }
@keyframes noteStamp { to { transform: translateY(-50%) rotate(-10deg) scale(1); opacity: 0.85; } }
/* the day report */
.up-rep { flex: 1; min-height: 0; overflow: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.up-rep .hd { display: flex; align-items: center; gap: 12px; }
.up-rep .hd .ms .pxi { display: block; animation: icHop 0.8s 0.2s cubic-bezier(.3,1.6,.5,1) both; }
.up-rep .hd b { display: block; font: 30px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.up-rep .hd span { color: #5a7690; }
.up-rep .rows { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px; }
.up-rep .rw { display: flex; gap: 8px; align-items: center; padding: 6px 10px; border-radius: 7px; background: linear-gradient(180deg, #f4ffe8 0 50%, #e8f8d8 50%); box-shadow: 0 0 0 1px #9ad480; animation: lnIn 0.4s cubic-bezier(.25,1.6,.45,1) both; }
.up-rep .rw:nth-child(2) { animation-delay: 60ms; } .up-rep .rw:nth-child(3) { animation-delay: 120ms; } .up-rep .rw:nth-child(4) { animation-delay: 180ms; } .up-rep .rw:nth-child(5) { animation-delay: 240ms; } .up-rep .rw:nth-child(n+6) { animation-delay: 300ms; }
.up-rep .rw i { flex: none; min-width: 34px; text-align: center; font: 30px/1 'Jersey 10', 'Pixelify Sans', monospace; font-style: normal; color: #2a8a18; }
.up-rep .rw span { display: flex; flex-direction: column; min-width: 0; }
.up-rep .rw b { font: 18px/17px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #1f5a1a; }
.up-rep .rw small { font-size: 14px; color: #4a6a3a; overflow: hidden; text-overflow: ellipsis; }
.up-rep .rw.none { grid-column: 1 / -1; color: #5a7690; background: #f4f8fb; box-shadow: 0 0 0 1px #c4d8e6; font-style: italic; }
.up-rep .tot { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; padding: 8px 12px; border-radius: 9px; background: linear-gradient(180deg, #fffbe2, #fff0b0); box-shadow: 0 0 0 1px #f0ce6a, 0 0 14px rgba(255,210,80,0.4); }
.up-rep .tot span { color: #7a5a10; }
.up-rep .tot .rp { font: 34px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #c88410; text-shadow: 0 1px 0 #fff; }
.up-rep .tot .rp.bump { animation: mosBump 0.5s cubic-bezier(.25,1.9,.45,1); }
.up-rep .tot small { color: #8a6a20; } .up-rep .tot small.wb { color: #2a8a18; }
.wk h5, .zm-week h5 { margin: 0 0 5px; font: 19px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #0b4a7a; }
.wk h5 em, .zm-week h5 em { font-style: normal; color: #2a8a18; }
.trow { display: grid; grid-template-columns: minmax(0, 1fr) 90px 44px; gap: 6px; align-items: center; margin-bottom: 3px; font-size: 15px; color: #3a5a78; }
.trow i { height: 8px; border-radius: 4px; background: #e2ecf2; box-shadow: inset 0 1px 2px rgba(0,30,60,0.2); overflow: hidden; }
.trow b { font: 16px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; text-align: right; }
.trow.ok { color: #2a8a18; }
.wk small, .zm-week small { color: #6a849a; font-size: 14px; }
.up-rep .wk { padding: 8px 12px; border-radius: 9px; background: #f6fbff; box-shadow: 0 0 0 1px #c4d8e6; }
.up-rep .bt { display: flex; gap: 8px; flex-wrap: wrap; }
@container (max-width: 600px) {
  .bench { flex-wrap: wrap; overflow: auto; }
  .lab-q { width: 100%; flex-direction: row; overflow-x: auto; overflow-y: hidden; }
  .lab-q .qt { width: 58px; }
  .lab-c, .lab-r { flex: 1 1 100%; }
  .lab-r .feed { max-height: 220px; }
  .up-top .tt span { display: none; }
}

/* ---- ZEA mail */
.zm-top { flex: none; display: flex; align-items: center; gap: 9px; padding: 4px 12px; color: #fff; text-shadow: 0 1px 0 #7a1a10; background: linear-gradient(180deg, #ffc8b8 0 46%, #e05a3a 46% 88%, #ff9a7a 88%); box-shadow: inset 0 -1px 0 #8a2a14; }
.zm-top .lg .pxi { display: block; }
.zm-top > b { font: 25px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; }
.zm-top .sl { font-size: 15px; opacity: 0.9; }
.zm-top .rp { margin-left: auto; font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #fff6c0; white-space: nowrap; }
.zm-body { flex: 1; min-height: 0; display: flex; }
.zm-side { flex: none; width: 270px; display: flex; flex-direction: column; background: linear-gradient(180deg, #fff7f4, #f8eae4); box-shadow: inset -1px 0 0 #e4c8bc; }
.zm-week { flex: none; margin: 8px; padding: 8px 10px; border-radius: 8px; background: #fff; box-shadow: 0 0 0 1px #e4c8bc; }
.zm-week .trow { grid-template-columns: minmax(0, 1fr) 54px 36px; }
.zm-list { flex: 1; min-height: 0; overflow: auto; padding: 0 8px 8px; display: flex; flex-direction: column; gap: 4px; }
.zm-row { position: relative; display: flex; gap: 6px; align-items: center; padding: 5px 7px 5px 6px; border-radius: 6px; background: #fff; box-shadow: 0 0 0 1px #ecd8d0; transition: transform 0.35s cubic-bezier(.25,1.9,.45,1); }
.zm-row > i { flex: none; width: 9px; height: 9px; border-radius: 50%; background: transparent; }
.zm-row.un > i { background: radial-gradient(circle at 35% 30%, #ffd0c8, #e8382a); box-shadow: 0 0 6px rgba(255,90,60,0.7); }
.zm-row span { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 15px; }
.zm-row span b { font: 16px/15px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #7a3a2a; }
.zm-row span em { font-style: normal; font-size: 15px; color: #4a3a3a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zm-row.un span em { color: #1a1a2a; font-weight: 700; }
.zm-row small { flex: none; color: #9a8a84; font-size: 13px; }
.zm-row.mile span b, .zm-row.first span b { color: #b8780a; }
.zm-row.taonga span b { color: #7a5a18; }
.zm-row.hov { transform: translateX(3px); box-shadow: 0 0 0 1px #e8907a, 0 3px 8px rgba(120,40,20,0.12); }
.zm-row.press { transform: scale(0.97, 0.9); transition-duration: 0.05s; }
.zm-row.on { box-shadow: 0 0 0 2px #ec6a4a, 0 0 10px rgba(255,120,90,0.45); background: linear-gradient(180deg, #ffffff, #fff1ec); }
.zm-read { flex: 1; min-width: 0; overflow: auto; padding: 12px 16px 16px; }
.zm-hd { display: flex; gap: 12px; align-items: center; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #ecd8d0; animation: lnIn 0.4s cubic-bezier(.25,1.6,.45,1) both; }
.zm-hd .av .pxi { display: block; animation: icHop 0.7s 0.1s cubic-bezier(.3,1.6,.5,1) both; }
.zm-hd b { display: block; font: 24px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #7a2a14; }
.zm-hd span { color: #8a7a74; } .zm-hd em { font-style: normal; color: #4a3a3a; }
.zm-txt { font-size: 18px; line-height: 20px; color: #2a2a3a; animation: lnIn 0.45s 0.05s cubic-bezier(.25,1.6,.45,1) both; }
.zm-txt p { margin: 0 0 9px; } .zm-txt ul { margin: 0 0 9px; padding-left: 20px; } .zm-txt li { margin-bottom: 3px; }
.zm-txt b { color: #7a2a14; font-weight: 400; font-family: 'Jersey 10', 'Pixelify Sans', monospace; font-size: 19px; }
.zm-txt .sig { margin-top: 12px; padding-top: 6px; border-top: 1px dashed #e4c8bc; color: #8a7a74; font-size: 15px; font-style: italic; }
.zm-tg { display: flex; flex-wrap: wrap; gap: 5px; margin: 4px 0 8px; }
.zm-tg span { padding: 1px 8px 2px; border-radius: 9px; font-size: 15px; color: #3a5a78; background: #eef4f8; box-shadow: 0 0 0 1px #c4d8e6; }
.zm-tg span.ok { color: #1f6410; background: #eafbdc; box-shadow: 0 0 0 1px #8ad06a; }
.zm-none { padding: 10px; color: #8a7a74; font-style: italic; }
.zm-none.big { margin: 40px auto; text-align: center; font-size: 20px; }
@container (max-width: 640px) {
  .zm-body { flex-direction: column; overflow: auto; }
  .zm-side { width: auto; box-shadow: inset 0 -1px 0 #e4c8bc; }
  .zm-list { max-height: 190px; }
  .zm-read { overflow: visible; }
  .zm-top .sl { display: none; }
}

/* ---- skill tree */
.sk-top { flex: none; display: flex; align-items: center; gap: 9px; padding: 5px 12px; color: #fff; text-shadow: 0 1px 0 #3a1a6a; background: linear-gradient(180deg, #e0d0ff 0 46%, #7a5ad0 46% 88%, #b49aff 88%); box-shadow: inset 0 -1px 0 #4a2a90; }
.sk-top .ic .pxi { display: block; }
.sk-top > b { font: 25px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; }
.sk-top .tip { font-size: 15px; opacity: 0.9; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-top .rp { font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #fff6c0; white-space: nowrap; }
.sk-top .rp em { font-style: normal; font-size: 28px; }
.sk-tabs { flex: none; display: none; gap: 5px; padding: 6px 8px; overflow-x: auto; background: #f4f0fc; box-shadow: inset 0 -1px 0 #d4c8ec; }
.sk-tabs span { flex: none; display: flex; align-items: center; gap: 5px; padding: 3px 10px 4px 5px; border-radius: 12px; background: #fff; box-shadow: 0 0 0 1px #d4c8ec; color: #4a3a6a; }
.sk-tabs span img { width: 22px; height: 22px; image-rendering: pixelated; }
.sk-tabs span.on { box-shadow: 0 0 0 2px var(--bc), 0 0 10px color-mix(in srgb, var(--bc) 50%, transparent); }
.sk-body { flex: 1; min-height: 0; display: flex; }
.sk-tree { flex: 1; min-width: 0; overflow: auto; display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 8px; padding: 8px; align-content: start; background: radial-gradient(ellipse at 50% 0%, #ffffff 0 30%, #f0ecfa 80%); }
.sk-col { min-width: 0; border-radius: 10px; background: linear-gradient(180deg, color-mix(in srgb, var(--bc) 12%, #fff), #fbfaff 140px); box-shadow: 0 0 0 1px color-mix(in srgb, var(--bc) 40%, #d4d0e4); padding-bottom: 8px; }
.sk-col .hd { display: flex; align-items: center; gap: 5px; padding: 6px 8px; border-radius: 10px 10px 0 0; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,0.35); background: linear-gradient(180deg, color-mix(in srgb, var(--bc) 55%, #fff) 0 46%, var(--bc) 46%); }
.sk-col .hd img { width: 24px; height: 24px; image-rendering: pixelated; }
.sk-col .hd b { flex: 1; font: 19px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; }
.sk-col .nodes { position: relative; margin: 6px 4px 0; }
.sk-col .nodes svg { position: absolute; left: 0; top: 0; width: 100%; pointer-events: none; overflow: visible; }
.sk-col .nodes path { fill: none; stroke-width: 3; stroke-linecap: round; }
.sk-col .nodes path.off { stroke: #cfd4e0; stroke-dasharray: 4 5; }
.sk-col .nodes path.open { stroke: var(--bc); stroke-dasharray: 7 6; animation: skFlow 0.9s linear infinite; }
.sk-col .nodes path.own { stroke: #f0ae22; }
.sk-col .nodes path.lit { stroke: #ffd048; stroke-width: 5; filter: drop-shadow(0 0 4px #ffe27a); }
@keyframes skFlow { to { stroke-dashoffset: -13; } }
.sk-n { position: absolute; width: 112px; margin-left: -56px; display: flex; flex-direction: column; align-items: center; text-align: center; transition: transform 0.4s cubic-bezier(.25,1.9,.45,1); z-index: 1; }
.sk-n .o { position: relative; width: 52px; height: 52px; display: grid; place-items: center; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #ffffff, #e6e2f2 70%, #cfc8e4); box-shadow: 0 0 0 2px #fff, 0 0 0 4px #b8b0d0, 0 3px 6px rgba(30,20,60,0.25); }
.sk-n .o img { width: 36px; height: 36px; image-rendering: pixelated; }
.sk-n b { margin-top: 5px; font: 15px/14px 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #2a2a4a; max-width: 112px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-n em { font: 14px/13px 'Jersey 15', 'Pixelify Sans', monospace; font-style: normal; color: #6a6a8a; }
.sk-n small { font-size: 12px; line-height: 12px; color: #9a7a4a; }
.sk-n .ck { position: absolute; right: -4px; top: -4px; width: 20px; height: 20px; border-radius: 50%; font: 15px/20px 'Jersey 10', 'Pixelify Sans', monospace; font-style: normal; color: #fff; text-align: center; background: linear-gradient(180deg, #fff3a0 0 25%, #ffc838 25% 60%, #e8941a 60%); box-shadow: 0 0 0 1px #7a4a08; }
.sk-n .lk { position: absolute; right: -3px; bottom: -3px; width: 16px; height: 16px; border-radius: 4px; background: linear-gradient(180deg, #e8eef4 0 50%, #a9b8c6 50%); box-shadow: 0 0 0 1px #5a7a96; }
.sk-n .lk::before { content: ''; position: absolute; left: 4px; top: -5px; width: 6px; height: 6px; border: 2px solid #8494a6; border-bottom: 0; border-radius: 4px 4px 0 0; }
.sk-n.owned .o { background: radial-gradient(circle at 40% 30%, #fffbe0, #ffe27a 60%, #f0ae22); box-shadow: 0 0 0 2px #fff, 0 0 0 4px #e8a020, 0 0 14px rgba(255,200,60,0.7); }
.sk-n.owned em { color: #b8780a; }
.sk-n.ready .o { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #4cb42c, 0 0 12px rgba(90,220,60,0.7); animation: skReady 1.6s ease-in-out infinite; }
.sk-n.ready em { color: #2a8a18; }
@keyframes skReady { 50% { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #82dc52, 0 0 22px rgba(130,240,90,0.9); } }
.sk-n.poor em { color: #c8442c; }
.sk-n.locked .o { filter: grayscale(0.85) brightness(1.05); opacity: 0.7; }
.sk-n.locked b, .sk-n.locked em { color: #9a9ab0; }
.sk-n.on .o { box-shadow: 0 0 0 2px #fff, 0 0 0 5px #22c4e6, 0 0 16px rgba(40,200,255,0.8); }
.sk-n.hov { transform: translateY(-3px) scale(1.05); z-index: 2; }
.sk-n.press { transform: scale(0.94, 0.88); transition-duration: 0.05s; }
.sk-n.newly .o { animation: skNew 0.9s cubic-bezier(.25,1.8,.45,1) 2; }
@keyframes skNew { 30% { transform: scale(1.25); box-shadow: 0 0 0 2px #fff, 0 0 0 5px #ffd048, 0 0 26px rgba(255,220,90,1); } }
.sk-n.burst .o { animation: skBurst 0.65s cubic-bezier(.25,1.8,.45,1) both; }
@keyframes skBurst { 0% { transform: scale(1); } 25% { transform: scale(1.5) rotate(-12deg); filter: brightness(1.6); } 60% { transform: scale(0.9) rotate(6deg); } 100% { transform: scale(1.1); } }
.sk-n.got .o { animation: skGot 0.6s cubic-bezier(.25,1.9,.45,1); }
@keyframes skGot { 0% { transform: scale(1.4); } }
.sk-none { padding: 10px; text-align: center; color: #8a8aa0; font-style: italic; }
.sk-info { flex: none; width: 270px; overflow: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px; background: linear-gradient(180deg, #faf8ff, #f0ecfa); box-shadow: inset 1px 0 0 #d4c8ec; }
.sk-card { padding: 10px 12px; border-radius: 9px; background: #fff; box-shadow: 0 0 0 1px #d4c8ec, 0 3px 0 rgba(40,20,80,0.06); animation: lnIn 0.35s cubic-bezier(.25,1.6,.45,1) both; }
.sk-card .h { display: flex; gap: 8px; align-items: center; }
.sk-card .h img { width: 48px; height: 48px; image-rendering: pixelated; flex: none; }
.sk-card .h b { display: block; font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #2a1a5a; }
.sk-card .h span { color: #7a6a9a; font-size: 15px; }
.sk-card p { margin: 6px 0 0; color: #3a3a5a; }
.sk-card p.efx { color: #1f6410; font: 18px/18px 'Jersey 10', 'Pixelify Sans', monospace; }
.sk-card .rq { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.sk-card .rq span { padding: 0 7px 1px; border-radius: 8px; font-size: 14px; color: #a8301c; background: #fff0ea; box-shadow: 0 0 0 1px #f0b0a0; }
.sk-card .rq span.ok { color: #1f6410; background: #eafbdc; box-shadow: 0 0 0 1px #9ad480; }
.sk-card .buy { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; align-items: stretch; }
.sk-card .buy .own { text-align: center; font: 22px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #b8780a; padding: 6px; border-radius: 8px; background: linear-gradient(180deg, #fffbe2, #fff0b0); box-shadow: 0 0 0 1px #f0ce6a; }
.sk-card .why { color: #a8301c; font-size: 15px; text-align: center; }
.sk-card.none b { font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; color: #2a1a5a; font-weight: 400; }
.sk-kit { padding: 8px 10px; border-radius: 9px; background: #fff; box-shadow: 0 0 0 1px #d4c8ec; }
.sk-kit h5 { margin: 0 0 4px; font: 18px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #4a2a90; }
.sk-kit .kv { display: flex; justify-content: space-between; gap: 6px; padding: 2px 4px; border-radius: 4px; font-size: 15px; color: #4a4a6a; }
.sk-kit .kv b { font-weight: 400; color: #2a1a5a; font-family: 'Jersey 10', 'Pixelify Sans', monospace; font-size: 16px; }
.sk-kit .kv.flash { animation: kvFlash 1.6s ease-out; }
@keyframes kvFlash { 0%, 30% { background: #fff3a0; box-shadow: 0 0 0 1px #f0ae22, 0 0 10px rgba(255,210,80,0.8); } }
.sk-empty { grid-column: 1 / -1; display: flex; gap: 14px; align-items: center; padding: 12px 14px; border-radius: 10px; background: #fff; box-shadow: 0 0 0 1px #d4c8ec; }
.sk-empty b { font: 23px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: #2a1a5a; }
.sk-empty p { margin: 5px 0 0; color: #4a4a6a; }
.sk-brs { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
.sk-br { padding: 10px 12px; border-radius: 10px; background: linear-gradient(180deg, color-mix(in srgb, var(--bc) 14%, #fff), #fff); box-shadow: 0 0 0 1px color-mix(in srgb, var(--bc) 45%, #d4d0e4); }
.sk-br img { width: 48px; height: 48px; image-rendering: pixelated; }
.sk-br b { display: block; font: 21px/1 'Jersey 10', 'Pixelify Sans', monospace; font-weight: 400; color: var(--bc); filter: brightness(0.8); }
.sk-br p { margin: 4px 0 0; color: #4a4a6a; font-size: 16px; }
@container (max-width: 760px) {
  .sk-tabs { display: flex; }
  .sk.empty .sk-tabs { display: none; }
  .sk-body { flex-direction: column; overflow: auto; }
  .sk-tree { grid-template-columns: 1fr; overflow: visible; }
  .sk-col { display: none; } .sk-col.on { display: block; }
  .sk-info { width: auto; overflow: visible; box-shadow: inset 0 1px 0 #d4c8ec; }
  .sk-top .tip { display: none; }
}
`;
