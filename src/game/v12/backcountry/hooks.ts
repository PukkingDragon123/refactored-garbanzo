// V12 Te Tuawhenua's attachment points: modules that live in the backcountry (the Bearer, the giant
// feathered boa) push their builders and per-frame updates here, and the site (./site.ts) calls them at
// the end of its build and on every update, so they attach without editing the site. This module is
// tiny and free of the scene's art, so importing it never pulls the whole backcountry in.
//
//   import { tuaHooks } from '../backcountry/hooks';   // (also re-exported by ./site.ts)
//   tuaHooks.build.push(f => { ...add the den's resident... });
//   tuaHooks.update.push((f, dt) => { ... });

import type { FieldScene } from '../../scenes/field';

export const tuaHooks: { build: ((f: FieldScene) => void)[]; update: ((f: FieldScene, dt: number) => void)[] } = { build: [], update: [] };
