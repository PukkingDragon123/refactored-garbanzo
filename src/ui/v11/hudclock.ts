// V11 HUD clock: where the sun is. hudHour() reads the expedition clock while Mori is out, the
// island / forest day clock at camp, or the scene's time of day; paintDial() draws the brass sun and
// moon dial (a half-disc of sky that follows the hour, the sun or moon riding its arc, hour ticks,
// the time and the day underneath).

import { game } from '../../game/game';
import type * as ExpMod from '../../game/v10/expedition';
import { Art, col, dith, shadeC } from './paper/px';
import { outlined, tw, skyAt } from './hudpx';

let exp: typeof ExpMod | null = null;
void import('../../game/v10/expedition').then(m => { exp = m; });

/** DayClock keys (0 morning, 1 midday, 2 golden hour, 3 dusk, 4 night) to hours */
const KEY_H = [7, 12, 16.5, 19, 22];
export function dayClockHour(t: number): number {
  const c = Math.max(0, Math.min(4, t));
  const i = Math.min(3, Math.floor(c));
  return KEY_H[i] + (KEY_H[i + 1] - KEY_H[i]) * (c - i);
}

/** the hour of day the HUD should show (null: no sky here) */
export function hudHour(): number | null {
  try {
    if (exp?.currentExpedition()) return exp.expeditionHour();
  } catch { /* not loaded */ }
  const sc = game.scene as unknown as { clock?: { t?: number }; tod?: string; st?: unknown } | null;
  if (!sc) return null;
  if (sc.clock && typeof sc.clock.t === 'number') return dayClockHour(sc.clock.t);
  if (sc.tod) return ({ dawn: 6.8, day: 12, dusk: 18.6, night: 22.5 } as Record<string, number>)[sc.tod] ?? null;
  return null;
}

export function clockLabel(h: number): string {
  const t = ((h % 24) + 24) % 24, hh = Math.floor(t), mm = Math.floor(((t - hh) * 60) / 10) * 10;
  return `${hh}:${String(mm).padStart(2, '0')}`;
}

const OUT = col('#140c06'), CREAM = col('#fff1cc'), BRASS = col('#c8962e'), BRASS_L = col('#f4d27a'), BRASS_D = col('#7a5414');

/** the sun-and-moon dial, 64 x 44 art px */
export function paintDial(a: Art, hour: number, day: number, t: number) {
  const cx = 32, cy = 30, R = 25;
  // a hard shadow, the brass half-ring, the sky inside
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    const inDial = dy <= 0 ? d <= R + 2 : x >= cx - R - 2 && x < cx + R + 2 && y < cy + 13;
    const sx = x - 2, sy = y - 2, sdx = sx + 0.5 - cx, sdy = sy + 0.5 - cy;
    const inS = sdy <= 0 ? Math.hypot(sdx, sdy) <= R + 2 : sx >= cx - R - 2 && sx < cx + R + 2 && sy < cy + 13;
    if (!inDial) { if (inS && dith(x, y, 0.6)) a.px(x, y, col('#000000', 0.42)); continue; }
    a.put(x, y, OUT);
  }
  const [top, bot] = skyAt(hour);
  const night = hour < 5.5 || hour > 20.5 || (hour % 24) < 5.5;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (dy <= 0 && d <= R + 1 && d > R - 2) { a.put(x, y, dx + dy < -14 ? BRASS_L : dx - dy > 22 ? BRASS_D : BRASS); continue; }
    if (dy <= 0 && d <= R - 2) {
      const k = 1 - (cy - y) / (R - 2);
      let c = dith(x, y, k * 0.95) ? bot : top;
      if (night && (x * 31 + y * 17) % 53 === 0) c = col('#fff6d0');
      a.put(x, y, c);
    }
  }
  // hour ticks round the rim (every two hours from 6 to 20)
  for (let hh = 6; hh <= 20; hh += 2) {
    const ang = Math.PI * (1 - (hh - 6) / 14);
    const x = Math.round(cx + Math.cos(ang) * (R - 3.5)), y = Math.round(cy - Math.sin(ang) * (R - 3.5));
    a.put(x, y, hh === 12 ? BRASS_L : shadeC(BRASS_L, -0.2));
  }
  // the land on the horizon
  for (let x = cx - R + 1; x < cx + R; x++) {
    const hgt = 2 + Math.round((Math.sin(x * 0.35) + Math.sin(x * 0.13 + 1)) * 1.2);
    for (let y = cy - hgt; y <= cy; y++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= R - 2) a.put(x, y, y === cy - hgt ? col('#5a9a3a') : col('#2e5a24'));
  }
  // the sun by day, the moon by night, riding the arc
  const t24 = ((hour % 24) + 24) % 24;
  const isDay = t24 >= 5.5 && t24 <= 20.5;
  const p = isDay ? (t24 - 6) / 14 : ((t24 >= 20.5 ? t24 - 20.5 : t24 + 3.5) / 9);
  const ang = Math.PI * (1 - Math.max(0, Math.min(1, p)));
  const bx = Math.round(cx + Math.cos(ang) * (R - 9)), by = Math.round(cy - Math.sin(ang) * (R - 9));
  if (isDay) {
    const pulse = Math.floor(t * 2) % 2;
    for (let i = 0; i < 8; i++) {
      const ra = (i / 8) * Math.PI * 2 + (pulse ? 0.2 : 0);
      a.put(Math.round(bx + Math.cos(ra) * 6), Math.round(by + Math.sin(ra) * 6), col('#ffe070'));
    }
    a.ellipse(bx + 0.5, by + 0.5, 4.5, 4.5, OUT);
    a.ellipse(bx + 0.5, by + 0.5, 3.6, 3.6, (x, y) => (x - bx + y - by < -1 ? col('#fff8c0') : col('#ffc838')));
  } else {
    a.ellipse(bx + 0.5, by + 0.5, 4.5, 4.5, OUT);
    a.ellipse(bx + 0.5, by + 0.5, 3.6, 3.6, col('#f0ecd0'));
    a.ellipse(bx + 2.5, by - 0.5, 3, 3, (x, y) => (Math.hypot(x + 0.5 - bx - 2.5, y + 0.5 - by + 0.5) < 3 ? top : 0));
  }
  // the plate underneath: the time and the day
  const ty = cy + 1;
  for (let y = ty; y < ty + 11; y++) for (let x = cx - R; x < cx + R; x++) a.put(x, y, y === ty ? BRASS_D : y === ty + 1 ? col('#4a3018') : col('#3e2814'));
  const time = clockLabel(hour);
  outlined(a, time, cx - R + 4, ty + 9, CREAM, OUT, { face: 'block', spacing: 1 });
  const ds = `DAY ${day}`;
  outlined(a, ds, cx + R - 3 - tw(ds, { face: 'block', bold: false, spacing: 1 }), ty + 9, col('#f4d27a'), OUT, { face: 'block', bold: false, spacing: 1 });
}
