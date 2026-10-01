// The on-screen pug cursor. With a mouse it simply rides the real pointer (with a squash on click, a
// little lean when flung and a sparkle trail). On touch screens the default is direct touch: fingers
// hit what they touch (native taps, scrolling and text fields; the cursor hides), with a long press
// sent as a right-click. Optionally (direct = false) the whole laptop turns into a
// trackpad: drag anywhere to move the cursor (with pointer acceleration), tap to click at the
// cursor, hold (or two-finger tap) to right-click, two fingers to scroll whatever is under the
// cursor (with momentum), and tap-then-drag to press and drag (move windows). Clicks are
// synthesised as pointer/mouse events at the cursor so every app works unchanged.

import { Spring, clamp, pugCursor } from './aeroFx';

// gesture timings; each is stretched by the recent frame time so slow devices (late input) still read taps right
const TAP_MS = 320, TAP_DIST = 12, HOLD_MS = 520, DBL_MS = 420;

interface Finger { x: number; y: number; t: number }

export class VCursor {
  x: number;
  y: number;
  mode: 'mouse' | 'touch' = 'mouse';
  readonly el: HTMLElement;
  private hold: HTMLElement;
  private sq = new Spring(1, 520, 15);
  private tilt = new Spring(0, 180, 16);
  private vx = 0;
  private shown = false;
  private img = { idle: '', down: '', link: '' };
  private state: 'idle' | 'down' | 'link' = 'idle';
  private link = false;
  private down = false;
  hoverDirty = true;
  /** touch goes straight to what the finger hits (false: the laptop is a trackpad for the cursor) */
  direct = true;
  /** last direct long-press: the click that follows it is swallowed */
  private suppressT = -1e9;
  /** called whenever the cursor moves (client coords + delta) */
  onMove: ((x: number, y: number, dx: number, dy: number) => void) | null = null;
  onFirstTouch: (() => void) | null = null;
  // touch state
  private fingers = new Map<number, Finger>();
  private g: { t0: number; dist: number; two: boolean; twoT: number; twoMoved: number; long: boolean; dragCand: boolean; dragging: boolean; last: number } | null = null;
  private holdTimer = 0;
  private lastTap = -1e9;
  private lastTapPos = { x: 0, y: 0 };
  private scrollEl: HTMLElement | null = null;
  private inertia = { x: 0, y: 0 };
  private touchedOnce = false;
  private frameMs = 16;
  private get slack() { return Math.min(900, this.frameMs * 2.5); }
  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions | boolean][] = [];

  constructor(private root: HTMLElement, private area: () => DOMRect, private isDirect: (t: Element) => boolean) {
    this.img = { idle: pugCursor('idle'), down: pugCursor('down'), link: pugCursor('link') };
    this.el = document.createElement('div');
    this.el.className = 'mos-cur off';
    this.el.style.backgroundImage = `url(${this.img.idle})`;
    this.hold = document.createElement('div');
    this.hold.className = 'mos-hold';
    root.append(this.hold, this.el);
    const r = area();
    this.x = r.left + r.width * 0.5; this.y = r.top + r.height * 0.45;
    const on = (t: EventTarget, type: string, fn: (e: never) => void, o: AddEventListenerOptions | boolean = true) => {
      t.addEventListener(type, fn as EventListener, o);
      this.listeners.push([t, type, fn as EventListener, o]);
    };
    on(root, 'pointerdown', (e: PointerEvent) => this.pdown(e));
    on(root, 'pointermove', (e: PointerEvent) => this.pmove(e));
    on(root, 'pointerup', (e: PointerEvent) => this.pup(e));
    on(root, 'pointercancel', (e: PointerEvent) => this.pup(e, true));
    on(root, 'pointerleave', (e: PointerEvent) => { if (e.isTrusted && e.target === root && e.pointerType === 'mouse') { this.shown = false; this.el.classList.add('off'); } });
    const tblock = (e: TouchEvent) => { if (!this.direct && !(e.target instanceof Element && this.isDirect(e.target))) e.preventDefault(); };
    on(root, 'click', (e: MouseEvent) => { if (performance.now() - this.suppressT < 700) { e.stopImmediatePropagation(); e.preventDefault(); } });
    on(root, 'touchstart', tblock, { capture: true, passive: false });
    on(root, 'touchmove', tblock, { capture: true, passive: false });
    on(root, 'touchend', tblock, { capture: true, passive: false });
    on(root, 'contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      if (e.isTrusted && (this.mode === 'touch' || (e as PointerEvent).pointerType === 'touch')) e.stopImmediatePropagation();
    });
  }

  destroy() {
    for (const [t, type, fn, o] of this.listeners) t.removeEventListener(type, fn, o);
    clearTimeout(this.holdTimer);
  }

  get isTouch() { return this.mode === 'touch'; }

  /** move the cursor (client coords), e.g. from keyboard navigation */
  private rr = { left: 0, top: 0 };
  moveTo(x: number, y: number) {
    this.rr = this.root.getBoundingClientRect();
    const dx = x - this.x, dy = y - this.y;
    this.x = x; this.y = y;
    this.hoverDirty = true;
    this.onMove?.(x, y, dx, dy);
  }

  setLink(v: boolean) { this.link = v; }

  squash(k = 0.72) { this.sq.x = k; this.sq.v = 0; }

  // ---------------------------------------------------------------- synthetic input at the cursor
  target(): Element | null {
    // direct touch: nothing is hovered once the finger lifts
    if (this.direct && this.mode === 'touch' && this.fingers.size === 0) return null;
    return document.elementFromPoint(this.x, this.y);
  }
  /** switch between direct touch and trackpad */
  setDirect(v: boolean) {
    this.direct = v;
    this.fingers.clear();
    this.g = null;
    clearTimeout(this.holdTimer);
    this.hold.classList.remove('on');
    if (this.mode === 'touch') {
      if (v) { this.shown = false; this.el.classList.add('off'); }
      else { const r = this.area(); this.moveTo(r.left + r.width * 0.5, r.top + r.height * 0.45); this.show(); }
    }
    this.hoverDirty = true;
  }
  private fire(type: string, t: Element, extra: Partial<PointerEventInit> = {}) {
    const init: PointerEventInit = { bubbles: true, cancelable: true, composed: true, clientX: this.x, clientY: this.y, screenX: this.x, screenY: this.y, view: window,
      pointerId: 77, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0, ...extra };
    t.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
  }
  private focusFor(t: Element) {
    const f = t.closest('input, textarea, [contenteditable="true"]') as HTMLElement | null;
    if (f) f.focus();
    else (document.activeElement as HTMLElement | null)?.blur?.();
  }
  clickAt() {
    const t = this.target();
    if (!t) return;
    this.fire('pointerdown', t, { buttons: 1 });
    this.fire('mousedown', t, { buttons: 1 });
    this.squash();
    this.flashDown();
    const t2 = this.target() ?? t;
    this.fire('pointerup', t2);
    this.fire('mouseup', t2);
    if (t2 === t || t.contains(t2) || t2.contains(t)) this.fire('click', t);
    this.focusFor(t);
  }
  rightClickAt() {
    const t = this.target();
    if (!t) return;
    this.squash(0.8);
    this.fire('contextmenu', t, { button: 2, buttons: 2 });
  }
  private flashDown() { this.down = true; setTimeout(() => { if (!this.g?.dragging) this.down = false; }, 140); }

  // ---------------------------------------------------------------- pointer handlers
  private show() { if (!this.shown) { this.shown = true; this.el.classList.remove('off'); } }
  private pdown(e: PointerEvent) {
    if (!e.isTrusted) return;
    if (e.pointerType !== 'touch') {
      this.mode = 'mouse';
      this.moveTo(e.clientX, e.clientY);
      this.show();
      this.down = true;
      this.squash(e.button === 2 ? 0.82 : 0.74);
      return;
    }
    if (this.direct) { this.directDown(e); return; }
    if (e.target instanceof Element && this.isDirect(e.target)) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (this.mode !== 'touch') { this.mode = 'touch'; this.root.classList.add('touch'); }
    if (!this.touchedOnce) { this.touchedOnce = true; this.onFirstTouch?.(); }
    this.show();
    const now = performance.now();
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: now });
    this.inertia.x = this.inertia.y = 0;
    if (this.fingers.size === 1) {
      const dragCand = now - this.lastTap < DBL_MS + this.slack && Math.hypot(e.clientX - this.lastTapPos.x, e.clientY - this.lastTapPos.y) < 60;
      this.g = { t0: now, dist: 0, two: false, twoT: 0, twoMoved: 0, long: false, dragCand, dragging: false, last: now };
      clearTimeout(this.holdTimer);
      this.hold.classList.remove('on');
      this.holdTimer = window.setTimeout(() => {
        const g = this.g;
        if (!g || g.two || g.dragging || g.dist > TAP_DIST || this.fingers.size !== 1) return;
        g.long = true;
        this.hold.classList.remove('on');
        try { navigator.vibrate?.(12); } catch { /* ignore */ }
        this.rightClickAt();
      }, HOLD_MS + this.slack);
      setTimeout(() => { const g = this.g; if (g && !g.long && !g.two && g.dist < TAP_DIST && this.fingers.size === 1) this.hold.classList.add('on'); }, 150 + this.slack);
    } else if (this.g && this.fingers.size === 2) {
      clearTimeout(this.holdTimer);
      this.hold.classList.remove('on');
      if (this.g.dragging) this.endDrag();
      this.g.two = true; this.g.twoT = now; this.g.twoMoved = 0;
      this.scrollEl = this.scrollableAt();
    }
  }
  private pmove(e: PointerEvent) {
    if (!e.isTrusted) return;
    if (e.pointerType !== 'touch') {
      if (this.mode !== 'mouse') { this.mode = 'mouse'; this.root.classList.remove('touch'); }
      const now = performance.now();
      const dx = e.clientX - this.x;
      this.vx = this.vx * 0.5 + (dx / Math.max(4, now - (this.lastMove || now - 16))) * 1000 * 0.5;
      this.lastMove = now;
      this.moveTo(e.clientX, e.clientY);
      this.show();
      return;
    }
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    if (this.direct) {
      const d = Math.hypot(e.clientX - f.x, e.clientY - f.y);
      f.x = e.clientX; f.y = e.clientY; f.t = performance.now();
      if (this.g) { this.g.dist += d; if (this.g.dist > TAP_DIST) { clearTimeout(this.holdTimer); this.hold.classList.remove('on'); } }
      this.moveTo(e.clientX, e.clientY);
      return;
    }
    if (!(e.target instanceof Element && this.isDirect(e.target))) { e.stopImmediatePropagation(); e.preventDefault(); }
    const now = performance.now();
    const dx = e.clientX - f.x, dy = e.clientY - f.y, dt = Math.max(1, now - f.t);
    f.x = e.clientX; f.y = e.clientY; f.t = now;
    const g = this.g;
    if (!g) return;
    if (g.two) {
      // two-finger scroll: the average of both fingers, natural direction
      const k = 1 / this.fingers.size;
      g.twoMoved += Math.hypot(dx, dy) * k;
      this.scrollBy(-dx * k * 1.25, -dy * k * 1.25);
      this.inertia.x = this.inertia.x * 0.6 + (-dx * k * 1.25 / dt) * 0.4;
      this.inertia.y = this.inertia.y * 0.6 + (-dy * k * 1.25 / dt) * 0.4;
      return;
    }
    g.dist += Math.hypot(dx, dy);
    if (g.dist > TAP_DIST) { this.hold.classList.remove('on'); clearTimeout(this.holdTimer); }
    // pointer acceleration: slow drags are precise, flicks cross the screen
    const v = Math.hypot(dx, dy) / dt;
    const gain = 1.15 + clamp((v - 0.12) * 2.4, 0, 2.6);
    const r = this.area();
    const nx = clamp(this.x + dx * gain, r.left + 1, r.right - 2), ny = clamp(this.y + dy * gain, r.top + 1, r.bottom - 2);
    this.vx = this.vx * 0.5 + ((nx - this.x) / dt) * 1000 * 0.5;
    this.moveTo(nx, ny);
    if (g.dragCand && !g.dragging && g.dist > 6) {
      g.dragging = true;
      const t = this.target();
      if (t) { this.fire('pointerdown', t, { buttons: 1 }); this.fire('mousedown', t, { buttons: 1 }); }
      this.down = true;
      this.squash(0.8);
    } else if (g.dragging) {
      const t = this.target();
      if (t) this.fire('pointermove', t, { buttons: 1 });
    }
  }
  private lastMove = 0;
  private endDrag() {
    const g = this.g;
    if (!g?.dragging) return;
    g.dragging = false;
    this.down = false;
    const t = this.target();
    if (t) { this.fire('pointerup', t); this.fire('mouseup', t); }
  }
  private pup(e: PointerEvent, cancel = false) {
    if (!e.isTrusted) return;
    if (e.pointerType !== 'touch') { this.down = false; return; }
    if (!this.fingers.has(e.pointerId)) return;
    if (this.direct) {
      this.fingers.delete(e.pointerId);
      if (!this.fingers.size) { clearTimeout(this.holdTimer); this.hold.classList.remove('on'); this.g = null; this.hoverDirty = true; }
      return;
    }
    if (!(e.target instanceof Element && this.isDirect(e.target))) { e.stopImmediatePropagation(); e.preventDefault(); }
    this.fingers.delete(e.pointerId);
    const g = this.g;
    if (!g || this.fingers.size > 0) return;
    clearTimeout(this.holdTimer);
    this.hold.classList.remove('on');
    const now = performance.now();
    this.g = null;
    if (cancel) { if (g.dragging) { this.g = g; this.endDrag(); this.g = null; } return; }
    if (g.two) {
      if (now - g.twoT < 300 + this.slack && g.twoMoved < TAP_DIST) this.rightClickAt();
      return;
    }
    if (g.dragging) { this.g = g; this.endDrag(); this.g = null; return; }
    if (g.long) return;
    if (g.dist < TAP_DIST && now - g.t0 < TAP_MS + this.slack) {
      this.clickAt();
      this.lastTap = now;
      this.lastTapPos = { x: e.clientX, y: e.clientY };
    }
  }

  /** direct touch: the finger is the pointer; only a long press needs help (sent as a right-click) */
  private directDown(e: PointerEvent) {
    if (this.mode !== 'touch') { this.mode = 'touch'; this.root.classList.add('touch'); }
    this.shown = false; this.el.classList.add('off');
    if (!this.touchedOnce) { this.touchedOnce = true; this.onFirstTouch?.(); }
    const now = performance.now();
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: now });
    this.moveTo(e.clientX, e.clientY);
    clearTimeout(this.holdTimer);
    this.hold.classList.remove('on');
    if (this.fingers.size !== 1) { this.g = null; return; }
    this.g = { t0: now, dist: 0, two: false, twoT: 0, twoMoved: 0, long: false, dragCand: false, dragging: false, last: now };
    const t0 = e.target instanceof Element ? e.target : null;
    // no long-press menu inside text fields (the OS handles those)
    if (t0?.closest('input, textarea')) return;
    const g = this.g;
    setTimeout(() => { if (this.g === g && g.dist < TAP_DIST && this.fingers.size === 1) this.hold.classList.add('on'); }, 150 + this.slack);
    this.holdTimer = window.setTimeout(() => {
      if (this.g !== g || g.dist > TAP_DIST || this.fingers.size !== 1) return;
      g.long = true;
      this.hold.classList.remove('on');
      this.suppressT = performance.now() + this.slack;
      try { navigator.vibrate?.(12); } catch { /* ignore */ }
      this.rightClickAt();
    }, HOLD_MS + this.slack);
  }

  // ---------------------------------------------------------------- scrolling
  private scrollableAt(): HTMLElement | null {
    let n = this.target() as HTMLElement | null;
    while (n && n !== this.root) {
      if (n instanceof HTMLElement) {
        const cs = getComputedStyle(n);
        if ((/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) || (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1)) return n;
      }
      n = n.parentElement;
    }
    return null;
  }
  private scrollBy(dx: number, dy: number) {
    const s = this.scrollEl;
    if (!s) return;
    s.scrollTop += dy; s.scrollLeft += dx;
  }

  // ---------------------------------------------------------------- per frame
  update(dt: number) {
    this.frameMs = this.frameMs * 0.9 + Math.min(400, dt * 1000) * 0.1;
    if (!this.g && (Math.abs(this.inertia.x) > 0.02 || Math.abs(this.inertia.y) > 0.02)) {
      this.scrollBy(this.inertia.x * dt * 1000, this.inertia.y * dt * 1000);
      const k = Math.exp(-dt * 3.2);
      this.inertia.x *= k; this.inertia.y *= k;
    }
    this.vx *= Math.exp(-dt * 9);
    this.tilt.target = clamp(this.vx * 0.012, -14, 14);
    this.sq.step(dt); this.tilt.step(dt);
    const st = this.down ? 'down' : this.link ? 'link' : 'idle';
    if (st !== this.state) { this.state = st; this.el.style.backgroundImage = `url(${this.img[st]})`; }
    const x = this.x - this.rr.left, y = this.y - this.rr.top;
    const s = this.sq.x;
    this.el.style.transform = `translate(${x - 2}px,${y - 2}px) rotate(${this.tilt.x.toFixed(2)}deg) scale(${(1 + (1 - s) * 0.7).toFixed(3)},${s.toFixed(3)})`;
    this.hold.style.transform = `translate(${x - 26}px,${y - 26}px)`;
  }
}
