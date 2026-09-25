// Time-of-day lighting presets: ambient light, fog, sky gradient and colour grading.

import type { Env, RGB } from '../gfx/renderer';
import { defaultEnv } from '../gfx/renderer';
import { hex } from '../art/color';
import type { Stop } from '../art/landscape';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export const TIMES: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
export const TIME_LABEL: Record<TimeOfDay, string> = { dawn: 'Dawn', day: 'Midday', dusk: 'Golden hour', night: 'Night' };

export interface Mood {
  /** how enclosed / shaded the site is: 0 open sky, 1 deep forest floor */
  shade: number;
  /** tint pushed into fog (e.g. green forest haze, blue sea haze) */
  haze?: RGB;
  hazeK?: number;
}

export interface TimePreset {
  env: Env;
  sky: Stop[];
  sunColor: RGB;
  /** screen-space position (0..1) of the sun / moon in the sky layer */
  sunPos: [number, number];
  moon: boolean;
  stars: number;
  cloudRamp: string[];
  glowColor: string;
  lightK: number; // multiplier for artificial lights
  insectsNight: boolean;
}

const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulRGB = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

export function timePreset(t: TimeOfDay, mood: Mood = { shade: 0 }): TimePreset {
  const e = defaultEnv();
  let p: TimePreset;
  switch (t) {
    case 'dawn':
      e.ambientTop = [0.86, 0.78, 0.9];
      e.ambientBottom = [0.62, 0.58, 0.74];
      e.fogTop = [0.72, 0.6, 0.74];
      e.fogBottom = [0.96, 0.76, 0.7];
      e.lift = [0.02, 0.0, 0.05];
      e.gain = [1.02, 0.98, 1.0];
      e.saturation = 1.05;
      e.bloom = 0.5;
      e.bloomThreshold = 0.95;
      e.waterTint = [0.85, 0.78, 0.92];
      p = {
        env: e,
        sky: [{ t: 0, c: hex('#34467e') }, { t: 0.45, c: hex('#9a7aa6') }, { t: 0.75, c: hex('#f1ad9a') }, { t: 1, c: hex('#ffe0b5') }],
        sunColor: [1, 0.78, 0.62], sunPos: [0.78, 0.78], moon: false, stars: 12,
        cloudRamp: ['#6f5f8c', '#a9809f', '#e7a3a0', '#ffd2b8'], glowColor: '#ffd9b0', lightK: 0.45, insectsNight: false,
      };
      break;
    case 'day':
      e.ambientTop = [1.06, 1.03, 0.96];
      e.ambientBottom = [0.9, 0.94, 0.9];
      e.fogTop = [0.62, 0.8, 0.9];
      e.fogBottom = [0.78, 0.9, 0.9];
      e.lift = [0.0, 0.01, 0.02];
      e.gain = [1.02, 1.0, 0.97];
      e.saturation = 1.08;
      e.contrast = 1.04;
      e.bloom = 0.32;
      e.bloomThreshold = 0.92;
      e.waterTint = [0.8, 0.92, 1.0];
      p = {
        env: e,
        sky: [{ t: 0, c: hex('#3f8ccc') }, { t: 0.5, c: hex('#7fbfe4') }, { t: 0.85, c: hex('#bfe4ee') }, { t: 1, c: hex('#e6f5ee') }],
        sunColor: [1, 0.96, 0.85], sunPos: [0.25, 0.12], moon: false, stars: 0,
        cloudRamp: ['#9fb5cf', '#c6d6e6', '#e8f0f5', '#ffffff'], glowColor: '#fffbe8', lightK: 0.18, insectsNight: false,
      };
      break;
    case 'dusk':
      e.ambientTop = [1.08, 0.8, 0.58];
      e.ambientBottom = [0.72, 0.52, 0.55];
      e.fogTop = [0.62, 0.44, 0.56];
      e.fogBottom = [1.0, 0.68, 0.46];
      e.lift = [0.03, 0.0, 0.04];
      e.gain = [1.04, 0.98, 0.94];
      e.saturation = 1.12;
      e.bloom = 0.55;
      e.bloomThreshold = 0.95;
      e.waterTint = [1.0, 0.8, 0.72];
      p = {
        env: e,
        sky: [{ t: 0, c: hex('#26305f') }, { t: 0.38, c: hex('#77507e') }, { t: 0.68, c: hex('#e0835b') }, { t: 1, c: hex('#ffd38a') }],
        sunColor: [1, 0.66, 0.35], sunPos: [0.72, 0.72], moon: false, stars: 6,
        cloudRamp: ['#5f4a78', '#a0628a', '#e88a78', '#ffc98f'], glowColor: '#ffd08a', lightK: 0.5, insectsNight: true,
      };
      break;
    default:
      e.ambientTop = [0.3, 0.38, 0.62];
      e.ambientBottom = [0.17, 0.21, 0.38];
      e.fogTop = [0.05, 0.08, 0.17];
      e.fogBottom = [0.11, 0.16, 0.28];
      e.lift = [0.01, 0.015, 0.045];
      e.gain = [0.98, 1.0, 1.06];
      e.saturation = 0.95;
      e.exposure = 1.08;
      e.bloom = 0.95;
      e.bloomThreshold = 0.62;
      e.vignette = 0.5;
      e.waterTint = [0.55, 0.7, 1.0];
      p = {
        env: e,
        sky: [{ t: 0, c: hex('#03060f') }, { t: 0.5, c: hex('#0a1430') }, { t: 1, c: hex('#1b2d55') }],
        sunColor: [0.75, 0.85, 1], sunPos: [0.7, 0.16], moon: true, stars: 160,
        cloudRamp: ['#0f1730', '#1b2848', '#2d3f66', '#4f6690'], glowColor: '#bcd4ff', lightK: 1.05, insectsNight: true,
      };
  }
  // forest shade: darken ambient near the ground and push haze colour into fog
  if (mood.shade > 0) {
    const k = mood.shade;
    e.ambientBottom = mulRGB(e.ambientBottom, 1 - k * 0.38);
    e.ambientTop = mulRGB(e.ambientTop, 1 - k * 0.2);
    p.lightK *= 1 + k * 0.3;
  }
  if (mood.haze) {
    const k = mood.hazeK ?? 0.3;
    e.fogTop = mixRGB(e.fogTop, t === 'night' ? mulRGB(mood.haze, 0.25) : mood.haze, k);
    e.fogBottom = mixRGB(e.fogBottom, t === 'night' ? mulRGB(mood.haze, 0.3) : mood.haze, k);
  }
  return p;
}
