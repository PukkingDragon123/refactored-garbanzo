// MoriOS: the Blueprints app (it replaced the V10 Skill Tree; the app id stays 'skills' so old saves
// keep it installed). Launching it lifts the blueprint folio out over the laptop at the laptop's
// research desk (src/ui/v11/blueprints/folio.ts): every sheet to browse, research to send off to the
// agency's R&D office with Research Points. Crafting happens at Jenna's bench at camp.
//
// The desktop icon's NEW badge (buyable) counts what is waiting: sheets that can be researched right
// now with the RP in hand, and sheets that arrived but haven't been looked at yet.

import { BLUEPRINTS, isFreshBlueprint } from '../../game/v11/blueprints';
import { researchBlockers } from '../../game/v11/bpcraft';
import type { OSCtx } from '../v4/moriResearch';
import type { AgencyApp } from './agency';

export interface SkillApp { open(id?: string): void; refresh(): void; buyable(): number }

export function skillTreeApp(os: OSCtx, agency: AgencyApp): SkillApp {
  void agency;
  let busy = false;
  return {
    open: (id?: string) => {
      if (busy) return;
      busy = true;
      void import('../v11/blueprints/folio').then(m => m.openFolio({ at: 'laptop', focus: id })).then(() => {
        busy = false;
        if (!os.closed()) os.badges();
      }, () => { busy = false; });
    },
    // the folio paints itself fresh every time it opens
    refresh: () => {},
    buyable: () => Object.values(BLUEPRINTS).filter(d => isFreshBlueprint(d.id) || (d.rp && !researchBlockers(d.id).length)).length,
  };
}
