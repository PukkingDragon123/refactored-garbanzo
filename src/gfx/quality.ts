// Graphics preferences (Settings > Graphics): the quality preset and the grain / vignette / motion blur
// options.
// Kept per browser (not in the save game), so they survive a new expedition and a save reset.

import type { GfxLevel, Renderer } from './renderer';

export interface GfxPrefs {
  level: GfxLevel;
  grain: boolean;
  vignette: boolean;
  /** the camera's motion blur and the afterimages behind fast movers */
  motionBlur: boolean;
}

const KEY = 'zl-gfx';
const LEVELS: GfxLevel[] = ['low', 'medium', 'high'];

export const GFX_LABEL: Record<GfxLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };
export const GFX_HINT: Record<GfxLevel, string> = {
  low: 'Fastest: a lighter bloom, depth of field only in cutscenes, no motion blur, a lower render resolution.',
  medium: 'Balanced: everything on, with lighter depth of field and motion blur.',
  high: 'Full depth of field, bloom, motion blur and zoom blur.',
};

/** phones and small tablets start on Medium, everything else on High */
export function defaultGfxPrefs(): GfxPrefs {
  let touch = false;
  try {
    touch = (navigator.maxTouchPoints ?? 0) > 0 && Math.min(screen.width, screen.height) < 820;
  } catch { /* no navigator */ }
  return { level: touch ? 'medium' : 'high', grain: true, vignette: true, motionBlur: !prefersReducedMotion() };
}

/** the system's reduced-motion setting (motion blur starts off under it) */
export function prefersReducedMotion(): boolean {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

export function loadGfxPrefs(): GfxPrefs {
  const p = defaultGfxPrefs();
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<GfxPrefs> | null;
    if (d && LEVELS.includes(d.level as GfxLevel)) p.level = d.level as GfxLevel;
    if (d && typeof d.grain === 'boolean') p.grain = d.grain;
    if (d && typeof d.vignette === 'boolean') p.vignette = d.vignette;
    if (d && typeof d.motionBlur === 'boolean') p.motionBlur = d.motionBlur;
  } catch { /* storage blocked */ }
  return p;
}

export function saveGfxPrefs(p: GfxPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* storage blocked */ }
}

export function applyGfxPrefs(r: Renderer, p: GfxPrefs = loadGfxPrefs()) {
  r.setGfx(p.level, p.grain, p.vignette, p.motionBlur);
}
