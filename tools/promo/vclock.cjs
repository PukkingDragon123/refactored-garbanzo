// A virtual clock injected before the game boots: performance.now, Date.now, setTimeout/setInterval
// and requestAnimationFrame all run on game-controlled time, so a slow software renderer can be
// stepped frame by frame (window.__vc.step(ms)) and every frame advances exactly that much time.
module.exports = `(() => {
  const RST = window.setTimeout.bind(window);
  const base = Date.now();
  let v = 0, nid = 1, rid = 1, seq = 0;
  const timers = new Map();
  let rafq = [];
  performance.now = () => v;
  Date.now = () => base + v;
  window.setTimeout = (fn, ms, ...a) => { const id = nid++; timers.set(id, { at: v + Math.max(0, +ms || 0), fn, a, iv: 0, seq: seq++ }); return id; };
  window.setInterval = (fn, ms, ...a) => { const id = nid++; const iv = Math.max(1, +ms || 0); timers.set(id, { at: v + iv, fn, a, iv, seq: seq++ }); return id; };
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  window.requestAnimationFrame = cb => { const id = rid++; rafq.push([id, cb]); return id; };
  window.cancelAnimationFrame = id => { rafq = rafq.filter(e => e[0] !== id); };
  const ticks = async n => { for (let i = 0; i < n; i++) await Promise.resolve(); };
  const macro = () => new Promise(r => RST(r, 0));
  async function advance(ms) {
    const end = v + ms;
    for (let g = 0; g < 20000; g++) {
      let bid = 0, bt = null;
      for (const [id, t] of timers) if (t.at <= end && (!bt || t.at < bt.at || (t.at === bt.at && t.seq < bt.seq))) { bid = id; bt = t; }
      if (!bt) break;
      v = Math.max(v, bt.at);
      if (bt.iv) { bt.at += bt.iv; bt.seq = seq++; } else timers.delete(bid);
      try { typeof bt.fn === 'function' ? bt.fn(...bt.a) : 0; } catch (e) { console.error(e); }
      await ticks(8);
    }
    v = end;
  }
  function frame() {
    const q = rafq; rafq = [];
    for (const [, cb] of q) { try { cb(v); } catch (e) { console.error(e); } }
  }
  window.__vc = {
    get now() { return v; },
    advance, frame,
    async step(ms) { await advance(ms); frame(); await ticks(8); await macro(); },
  };
})();`;
