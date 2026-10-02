// Zealandia Encyclopedia: ecosystem connections. An explicit table of who eats whom, parasites and
// their hosts, partners and rivals for the field guide's species (written from the research sheets
// and findings), plus the helpers the encyclopedia uses to draw a species' little food web.

export type Rel = 'eats' | 'parasite' | 'partner' | 'rival' | 'robs';
/** [a, relation, b, optional label]: a eats b, a is a parasite of b, a partners / rivals / robs b */
type Link = [string, Rel, string, string?];

export const WEB: Link[] = [
  // ---- the open ocean
  ['vanebill', 'eats', 'kitefish', 'snatches it mid-glide'],
  ['moonfin', 'eats', 'kitefish', 'chases it into the air'],
  ['sackjaw', 'eats', 'kitefish'],
  ['sackjaw', 'robs', 'vanebill', 'mobs it until it drops its catch'],
  ['sackjaw', 'eats', 'crownlouse', 'picks it off basking Reefbacks'],
  ['sackjaw', 'partner', 'reefback', 'picks its lice'],
  ['sackjaw', 'eats', 'scythewing', 'when the flock rafts'],
  ['scythewing', 'partner', 'moonfin', 'follows its pods for plankton'],
  ['scythewing', 'partner', 'reefback', 'follows it for stirred-up plankton'],
  ['crownlouse', 'parasite', 'reefback'],
  ['pennantleech', 'parasite', 'reefback'],
  ['moonfin', 'eats', 'glassmaomao'],
  ['spinnaker', 'eats', 'glassmaomao'],
  ['spinnaker', 'eats', 'mirrordory'],
  ['lanterncod', 'eats', 'spinnaker', 'lures in the young ones'],
  ['snoutlouse', 'parasite', 'snoutbass', 'lives in its trunk'],
  ['sixfinger', 'partner', 'snoutbass', 'they dig up each other’s dinner'],
  // ---- the rocky shore and the beach
  ['corvexseal', 'eats', 'snoutbass'],
  ['corvexseal', 'eats', 'lanterncod'],
  ['corvexseal', 'eats', 'sixfinger'],
  ['corvexseal', 'eats', 'mirrordory'],
  ['crownleech', 'parasite', 'corvexseal', 'rings its neck crease'],
  ['shellwrench', 'partner', 'corvexseal', 'picks over its shell middens'],
  ['twinfan', 'partner', 'corvexseal', 'eats the insects it stirs up'],
  ['swashrunner', 'eats', 'glasscrab'],
  ['swashrunner', 'eats', 'wrackhopper'],
  ['swashrunner', 'eats', 'periscopeeel', 'almost never fast enough'],
  ['shellwrench', 'eats', 'glasscrab'],
  ['shellwrench', 'eats', 'kelpskink'],
  ['shellwrench', 'eats', 'trycop', 'only the small ones'],
  ['shellwrench', 'eats', 'wrackhopper'],
  ['shellwrench', 'eats', 'skipgoby'],
  ['shellwrench', 'eats', 'periscopeeel'],
  ['kelpskink', 'eats', 'wrackhopper'],
  ['kelpskink', 'eats', 'glasscrab'],
  ['kelpskink', 'eats', 'ambersnail'],
  ['kelpskink', 'rival', 'swashrunner', 'both hunt the hoppers'],
  ['duskwaddler', 'partner', 'kelpskink', 'its burrows shelter skinks'],
  ['sackjaw', 'eats', 'duskwaddler', 'in daylight, which is why it waits for dusk'],
  ['periscope', 'eats', 'glasscrab', 'its favourite meal'],
  ['canhermit', 'eats', 'wrackhopper'],
  ['skipgoby', 'eats', 'wrackhopper'],
  ['skipgoby', 'rival', 'glasscrab', 'for the best mud'],
  ['rootbarnacle', 'parasite', 'trycop', 'roots through its whole body'],
  // ---- the bush
  ['hornetcap', 'parasite', 'jewelhornet', 'steers its dying host'],
  ['puppetfluke', 'parasite', 'ambersnail', 'turns its eye stalk into bait'],
  ['leafmantis', 'eats', 'lanternmoth'],
  ['leafmantis', 'eats', 'jewelbeetle'],
  ['leafmantis', 'eats', 'jewelhornet', 'the occasional young one'],
  ['twinfan', 'eats', 'lanternmoth'],
  ['galehawk', 'eats', 'swashrunner'],
  ['galehawk', 'eats', 'kelpskink'],
  ['galehawk', 'eats', 'duskwaddler'],
  // ---- the old forest, falls and mangrove sites
  ['sprinter', 'eats', 'delver', 'runs them down at dusk'],
  ['sprinter', 'eats', 'shieldback', 'young ones'],
  ['galehawk', 'eats', 'skyribbon', 'out of the air'],
  ['galehawk', 'eats', 'nutcracker'],
  ['lurevip', 'eats', 'sailglider', 'lures it with a glowing tail'],
  ['titan', 'eats', 'ironjaw', 'swallows it whole'],
  ['ironjaw', 'eats', 'snakestork'],
  ['ironjaw', 'eats', 'mudribbon'],
  ['snakestork', 'eats', 'mudribbon', 'spears it'],
  ['mudribbon', 'eats', 'skipgoby'],
  ['mudribbon', 'eats', 'pteramander', 'if it ever touches the water'],
  ['cragviper', 'eats', 'cragauk', 'eggs and chicks'],
  ['flicker', 'eats', 'strider'],
  ['flicker', 'eats', 'sprinter', 'and survives the venom'],
  ['hunterbat', 'eats', 'mossfrog'],
  ['monarch', 'partner', 'titan', 'cleans up its leftovers'],
  ['monarch', 'partner', 'ironjaw', 'cleans up its leftovers'],
];

/** how another species relates to the page's species */
export type Role = 'predator' | 'prey' | 'parasite' | 'host' | 'partner' | 'rival' | 'thief' | 'victim';
export interface Tie { other: string; role: Role; label?: string }

export const ROLE_NAME: Record<Role, string> = {
  predator: 'Eaten by', prey: 'Eats', parasite: 'Parasite', host: 'Host', partner: 'Partner', rival: 'Rival', thief: 'Robbed by', victim: 'Robs',
};

/** every connection of a species, from its own point of view */
export function tiesOf(id: string): Tie[] {
  const out: Tie[] = [];
  for (const [a, rel, b, label] of WEB) {
    if (a !== id && b !== id) continue;
    const self = a === id, other = self ? b : a;
    const role: Role = rel === 'eats' ? (self ? 'prey' : 'predator')
      : rel === 'parasite' ? (self ? 'host' : 'parasite')
      : rel === 'robs' ? (self ? 'victim' : 'thief')
      : rel;
    out.push({ other, role, label });
  }
  return out;
}

/** all the links between a set of species (for the big web) */
export function linksAmong(ids: Set<string>): Link[] {
  return WEB.filter(([a, , b]) => ids.has(a) && ids.has(b));
}
