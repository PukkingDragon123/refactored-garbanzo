import type { Stage } from '../../world/stage';
import type { SiteContent } from './types';
import type { ExpeditionScene } from '../scenes/expedition';
import { buildFernwood } from './fernwood';
export function buildCanopy(st: Stage, sc: ExpeditionScene): SiteContent {
  return buildFernwood(st, sc);
}
