// Connects the V2 art modules to the systems that draw them. The systems only know small
// interfaces (so they compile and run without the art); this is the one place that wires them up.

import * as people from '../art/people';
import * as emotes from '../art/emotes';
import * as beasts from '../art/beasts';
import * as insects from '../art/beasts-insects';
import * as castaway from '../art/castaway';
import * as jungle from '../art/jungle';
import { paintWreck } from '../art/boat';
import { bindActorArt, PeopleArt, EmoteArt } from '../world/actor';
import { bindBeastArt, BeastArt } from './wild/bodies';
import { bindInsectArt, InsectArt } from './wild/insects';
import { bindCampArt } from './scenes/camp2';
import { bindSiteArt } from './sites2/common';
import { bindTentArt } from './scenes/tent';
import { setSpeciesIcon } from './travel2';
import { speciesSprite } from '../ui/icons';

export function bindAllArt() {
  bindActorArt(people as unknown as PeopleArt, emotes as unknown as EmoteArt);
  bindBeastArt(beasts as unknown as BeastArt);
  bindInsectArt(insects as unknown as InsectArt);
  bindCampArt(castaway as unknown as Record<string, unknown>, jungle as unknown as Record<string, unknown>, paintWreck);
  bindSiteArt(jungle as unknown as Record<string, unknown>);
  bindTentArt(castaway.tentInterior);
  setSpeciesIcon(speciesSprite);
}
