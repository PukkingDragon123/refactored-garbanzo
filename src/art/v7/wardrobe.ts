// Wardrobe: what each cast member is wearing right now. The sprites (through the Actor), the dialogue
// portraits and the HD close-up busts all dress from here, so one call changes a character everywhere.
// Session state (not saved): scripts dress the cast when a scene calls for it.

const ALIAS: Record<string, string> = { rowan: 'mori', pip: 'jenna', crowe: 'joshu', lou: 'joshu' };
const worn: Record<string, string> = {};
let ver = 0;

/** the outfit a character is wearing ('casual' unless dressed) */
export function outfitOf(id: string): string {
  return worn[ALIAS[id] ?? id] ?? 'casual';
}
/** dress a character ('casual' undresses); returns the outfit now worn */
export function setOutfit(id: string, outfit: string): string {
  const k = ALIAS[id] ?? id;
  const o = outfit || 'casual';
  if ((worn[k] ?? 'casual') !== o) ver++;
  if (o === 'casual') delete worn[k]; else worn[k] = o;
  return o;
}
/** bumps whenever anyone changes clothes (cheap cache invalidation for UIs) */
export const wardrobeVersion = () => ver;
/** 'mori@winter' → ['mori', 'winter']; a bare id → [id, null] */
export function splitOutfit(id: string): [string, string | null] {
  const i = id.indexOf('@');
  return i < 0 ? [id, null] : [id.slice(0, i), id.slice(i + 1)];
}
