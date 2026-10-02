// ?gallery=items11: every item's V11 illustrated artwork on its Backpack footprint grid, grouped like
// the art files (src/art/v11/items/*), with the old 24 px icon beside it and a list of any item that
// still has no picture. Options: &s=<scale> (default 3), &only=<id,id>, &group=<name>, &bg=<hex>,
// &grid=0 (art only), &pack=1 (everything packed into one big backpack-like grid).

export async function items11Gallery(params: URLSearchParams) {
  // every module that defines items, so the coverage check sees them all
  await Promise.all([import('../game/v10/finds'), import('../game/v10/boat'), import('../game/v10/forage10')]);
  const [{ ITEMS }, { artList }, { itemArtCanvas, hasItemArt, ITEM_CELL }, { footprint, cells }, { itemIconURL }] = await Promise.all([
    import('../game/items'), import('../art/v11/items'), import('../art/v11/itemart'), import('../game/v11/footprints'), import('../art/itemicons'),
  ]);
  const S = Math.max(1, +(params.get('s') ?? 3));
  const only = params.get('only')?.split(',').filter(Boolean);
  const grp = params.get('group');
  const bg = '#' + (params.get('bg') ?? '2b1d14');
  const showGrid = params.get('grid') !== '0';
  document.documentElement.style.cssText = 'height:auto;overflow:auto';
  document.body.innerHTML = '';
  document.body.style.cssText = `margin:0;height:auto;overflow:auto;background:${bg};font:12px monospace;color:#f2e4bc;padding:14px;user-select:text`;

  const list = artList().filter(e => (!only || only.includes(e.id)) && (!grp || e.group === grp));
  const missing = Object.keys(ITEMS).filter(id => !hasItemArt(id));
  const head = document.createElement('div');
  head.style.cssText = 'margin-bottom:12px;line-height:1.6';
  const t0 = performance.now();
  for (const e of list) itemArtCanvas(e.id);
  const ms = performance.now() - t0;
  head.innerHTML = `<b>V11 item art</b> · ${Object.keys(ITEMS).length} items · ${artList().length} pictures · painted ${list.length} in ${ms.toFixed(0)} ms` +
    (missing.length ? `<br><span style="color:#ff7a6a">no art: ${missing.join(', ')}</span>` : '<br><span style="color:#8ae6a0">every item has a picture</span>');
  document.body.appendChild(head);

  /** the art on its footprint grid at scale s */
  const card = (id: string, s: number) => {
    const f = footprint(id);
    const W = f.w * ITEM_CELL * s, Hh = f.h * ITEM_CELL * s;
    const c = document.createElement('canvas');
    c.width = W; c.height = Hh;
    c.style.cssText = `width:${W}px;height:${Hh}px;image-rendering:pixelated;display:block`;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    if (showGrid) {
      const filled = new Set(cells(f).map(([x, y]) => x + ',' + y));
      for (let y = 0; y < f.h; y++)
        for (let x = 0; x < f.w; x++) {
          const X = x * ITEM_CELL * s, Y = y * ITEM_CELL * s, Z = ITEM_CELL * s;
          if (filled.has(x + ',' + y)) {
            g.fillStyle = '#4a3424'; g.fillRect(X, Y, Z, Z);
            g.fillStyle = '#56402c'; g.fillRect(X + s, Y + s, Z - 2 * s, Z - 2 * s);
          } else {
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X, Y, Z, Z);
            g.strokeStyle = 'rgba(255,255,255,0.06)';
            for (let k = -Z; k < Z; k += 6 * s) { g.beginPath(); g.moveTo(X + k, Y + Z); g.lineTo(X + k + Z, Y); g.stroke(); }
          }
        }
    }
    const a = itemArtCanvas(id);
    if (a) g.drawImage(a, 0, 0, a.width * s, a.height * s);
    return c;
  };

  if (params.get('pack') === '1') {
    // a mock backpack: greedy-pack everything into a 16-wide grid, to judge the set together
    const COLS = +(params.get('cols') ?? 16);
    const occ: boolean[][] = [];
    const free = (x: number, y: number) => !(occ[y]?.[x]);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative';
    let rows = 0;
    const s = Math.max(1, Math.min(S, 3));
    for (const e of [...list].sort((a, b) => b.fp.w * b.fp.h - a.fp.w * a.fp.h)) {
      const f = footprint(e.id), cs = cells(f);
      search: for (let y = 0; y < 400; y++)
        for (let x = 0; x + f.w <= COLS; x++) {
          if (!cs.every(([cx, cy]) => free(x + cx, y + cy))) continue;
          for (const [cx, cy] of cs) { (occ[y + cy] ??= [])[x + cx] = true; }
          const el = card(e.id, s);
          el.style.position = 'absolute';
          el.style.left = x * ITEM_CELL * s + 'px';
          el.style.top = y * ITEM_CELL * s + 'px';
          el.title = e.id;
          wrap.appendChild(el);
          rows = Math.max(rows, y + f.h);
          break search;
        }
    }
    wrap.style.width = COLS * ITEM_CELL * s + 'px';
    wrap.style.height = rows * ITEM_CELL * s + 'px';
    wrap.style.background = '#3a281a';
    document.body.appendChild(wrap);
    document.body.dataset.ready = '1';
    return;
  }

  let group = '';
  let row: HTMLDivElement | null = null;
  for (const e of list) {
    if (e.group !== group) {
      group = e.group;
      const h = document.createElement('div');
      h.textContent = group;
      h.style.cssText = 'font-size:15px;font-weight:bold;margin:16px 0 8px;color:#ffd890;border-bottom:1px solid #6a4a30';
      document.body.appendChild(h);
      row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end';
      document.body.appendChild(row);
    }
    const f = footprint(e.id);
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;gap:4px';
    box.appendChild(card(e.id, S));
    const info = document.createElement('div');
    info.style.cssText = 'display:flex;gap:6px;align-items:center';
    const one = card(e.id, 1);
    const old = document.createElement('img');
    old.src = itemIconURL(e.id, 3);
    old.style.cssText = 'width:24px;height:24px;image-rendering:pixelated;opacity:0.8';
    old.title = 'old icon';
    const l = document.createElement('div');
    l.innerHTML = `${e.id} <span style="opacity:0.6">${f.w}×${f.h}${f.mask ? ' ' + f.mask.join('/') : ''}</span><br><span style="opacity:0.75">${ITEMS[e.id]?.name ?? '(not an item)'}</span>`;
    info.append(one, old, l);
    box.appendChild(info);
    row!.appendChild(box);
  }
  document.body.dataset.ready = '1';
}
