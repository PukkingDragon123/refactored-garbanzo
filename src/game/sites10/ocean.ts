// V10 boat destinations: the places the Kitten can reach once she floats (flag 'v10:boat'). Each is a
// Region Map location (regions.ts) whose scene is a boat trip: a sail out across open water (the
// trip scene, ../v10/boattrip.ts) and a stop at the far end:
//   fishgrounds  The Shelf          open-water fishing grounds: fish off the stern, photograph sea life
//   glassreef    Glass Reef         a shallow reef: snorkel over coral and reef fish (oceanreef.ts)
//   motuahi      Motu Ahi           a smoking volcanic islet with a seabird colony (oceanisle.ts)
//   farcoast     The Far Coast      sea cliffs, a kelp forest and a river mouth, only reachable by sea (oceancoast.ts)
// Plus 'maiden', the short maiden voyage on Launch Day (not on the map).
//
// API
//   registerOceanLocations()          idempotent (runs on import)
//   TRIPS: Record<string, TripPlan>, tripPlan(id)
//   goBoatTrip(id, o?)                 the trip scene for a destination (what the locations' scene.go runs)
//   openBoatTrips(yard?)               the destination picker at the boatyard; leaves through goExpedition()
//   sailHome(from?)                    end any trip: returnToCamp('boat') (with a fallback while the
//                                      expedition module is still a contract stub)

import { game } from '../game';
import { addLocation, findLocation, location as locDef } from '../v10/regions';
import type { LocationDef } from '../v10/regions';
import { BOAT_FLAG, boatReady, boatSave, setBoatAway } from '../v10/boat';
import { el } from '../../ui/ui';
import { audio } from '../../core/audio';

export type TripStop = 'fish' | 'reef' | 'land' | 'maiden';
export type Horizon = 'islet' | 'coast' | 'reef' | 'open' | 'home';
export interface TripPlan {
  id: string;
  name: string;
  sub: string;
  /** seconds of sailing at cruise speed */
  dur: number;
  stop: TripStop;
  /** what rises out of the sea ahead */
  ahead: Horizon;
  /** the landing site for 'land' stops */
  site?: 'motuahi' | 'farcoast';
  /** scripted sea-life moments at fractions of the leg */
  events: { at: number; kind: TripEventKind }[];
  /** what the crew says as they set off and as they arrive */
  depart: [string, string, string][];
  arrive: [string, string, string][];
}
export type TripEventKind = 'pod' | 'kites' | 'reefback' | 'flock' | 'gulls' | 'vanebill';

export const TRIPS: Record<string, TripPlan> = {
  fishgrounds: {
    id: 'fishgrounds', name: 'The Shelf', sub: 'Fishing grounds off the reef edge', dur: 46, stop: 'fish', ahead: 'open',
    events: [{ at: 0.1, kind: 'gulls' }, { at: 0.25, kind: 'pod' }, { at: 0.5, kind: 'kites' }, { at: 0.72, kind: 'flock' }],
    depart: [['joshu', 'The shelf drops off past the reef, lad. Cold water comes up the slope and the big fish follow it.', 'neutral'], ['aroha', 'My koro fished there. He said: take only what you need, and always give the first one back.', 'serious']],
    arrive: [['joshu', 'Here. See the colour change? That’s the drop-off. Motor off, rods out.', 'happy']],
  },
  glassreef: {
    id: 'glassreef', name: 'Glass Reef', sub: 'Shallow coral gardens inside the barrier', dur: 52, stop: 'reef', ahead: 'reef',
    events: [{ at: 0.15, kind: 'pod' }, { at: 0.38, kind: 'vanebill' }, { at: 0.55, kind: 'reefback' }, { at: 0.8, kind: 'kites' }],
    depart: [['aroha', 'The water over the reef is so clear the waka seem to fly. We called it Te Karaihe, the glass.', 'happy'], ['mori', 'Snorkel, mask, camera in its bag. I am SO ready.', 'excited']],
    arrive: [['aroha', 'Drop the stone here, on the sand, not on the coral. Then in you go.', 'serious']],
  },
  motuahi: {
    id: 'motuahi', name: 'Motu Ahi', sub: 'The smoking islet', dur: 70, stop: 'land', ahead: 'islet', site: 'motuahi',
    events: [{ at: 0.1, kind: 'gulls' }, { at: 0.22, kind: 'pod' }, { at: 0.4, kind: 'kites' }, { at: 0.55, kind: 'reefback' }, { at: 0.78, kind: 'flock' }, { at: 0.86, kind: 'vanebill' }],
    depart: [['aroha', 'Motu Ahi. Fire island. My nan said it breathes. Some years it breathes harder.', 'serious'], ['joshu', 'Then we land on the lee side and keep the boat ready. Nobody goes up the cone.', 'determined']],
    arrive: [['mori', 'Look at the cliffs. They’re MOVING. That’s... that’s all birds!', 'excited'], ['aroha', 'The black sand beach, there. Bring her in gently.', 'happy']],
  },
  farcoast: {
    id: 'farcoast', name: 'The Far Coast', sub: 'Sea cliffs and a kelp forest, only reachable by sea', dur: 62, stop: 'land', ahead: 'coast', site: 'farcoast',
    events: [{ at: 0.12, kind: 'flock' }, { at: 0.3, kind: 'pod' }, { at: 0.5, kind: 'vanebill' }, { at: 0.66, kind: 'kites' }, { at: 0.82, kind: 'reefback' }],
    depart: [['joshu', 'The far side of our own island. Cliffs a hundred metres high. Nobody walks there.', 'thinking'], ['aroha', 'There is a river that comes down to the sea through a gorge. The kelp at its mouth is as tall as trees.', 'serious']],
    arrive: [['mori', 'A waterfall straight into the sea! And the kelp... it’s a forest. An underwater forest.', 'excited']],
  },
  maiden: {
    id: 'maiden', name: 'Maiden Voyage', sub: 'Once round the bay', dur: 34, stop: 'maiden', ahead: 'home',
    events: [{ at: 0.18, kind: 'gulls' }, { at: 0.3, kind: 'pod' }, { at: 0.62, kind: 'kites' }],
    depart: [['jenna', 'She’s FLOATING. She’s MOVING. I’m crying. I’m not crying. Spray. It’s spray.', 'excited'], ['joshu', 'Once round the bay, to see how she handles.', 'happy']],
    arrive: [['joshu', 'She handles like a dream. A small, patched, slightly fishy dream.', 'happy']],
  },
};
export const tripPlan = (id: string) => TRIPS[id] ?? null;

const LOCS: LocationDef[] = [
  { id: 'fishgrounds', name: 'The Shelf', region: 'ocean', kind: 'ocean', pos: [0.78, 0.5], difficulty: 1, needs: [BOAT_FLAG],
    desc: 'Fishing grounds where the sea floor drops off past the reef. Fish from the boat; vanebills, gulls and porpoises follow the boats.', scene: { type: 'custom', go: () => goBoatTrip('fishgrounds') } },
  { id: 'glassreef', name: 'Glass Reef', region: 'ocean', kind: 'ecosystem', pos: [0.6, 0.66], difficulty: 2, needs: [BOAT_FLAG],
    desc: 'Shallow coral gardens inside the barrier reef, clear as glass. Snorkel with the camera among the reef fish.', scene: { type: 'custom', go: () => goBoatTrip('glassreef') } },
  { id: 'motuahi', name: 'Motu Ahi', region: 'isle2', kind: 'island', pos: [0.86, 0.2], difficulty: 3, needs: [BOAT_FLAG],
    desc: 'A smoking volcanic islet with black sand beaches, steaming vents and a vast seabird colony on its cliffs.', scene: { type: 'custom', go: () => goBoatTrip('motuahi') } },
  { id: 'farcoast', name: 'The Far Coast', region: 'south', kind: 'site', pos: [0.32, 0.9], difficulty: 3, needs: [BOAT_FLAG],
    desc: 'The island’s far side: sea cliffs too steep to walk, a waterfall into the sea and a kelp forest at the river mouth.', scene: { type: 'custom', go: () => goBoatTrip('farcoast') } },
];
export const BOAT_LOCATIONS = LOCS.map(l => l.id);

let registered = false;
export function registerOceanLocations() {
  if (registered) return;
  registered = true;
  for (const l of LOCS) addLocation(l);
}
registerOceanLocations();

// ------------------------------------------------------------------ the trip state (carried across scenes)
export interface TripState {
  /** location being visited */
  id: string;
  /** island time of day when the Kitten left (DayClock units), carried to the far end */
  clockT: number;
  /** a reload or a scene change mid-trip comes back here */
  phase: 'out' | 'stop' | 'home';
}
let trip: TripState | null = null;
export const currentTrip = () => trip;

/** open the trip scene for a destination */
export async function goBoatTrip(id: string, o: { phase?: TripState['phase'] } = {}) {
  const plan = tripPlan(id);
  if (!plan) return;
  const sc = game.scene as unknown as { clock?: { t: number } } | null;
  const clockT = trip?.clockT ?? sc?.clock?.t ?? 0.6;
  trip = { id, clockT, phase: o.phase ?? 'out' };
  setBoatAway(true);
  if (plan.stop === 'land' || plan.stop === 'reef' || plan.stop === 'fish') findLocation(id);
  const { BoatTripScene } = await import('../v10/boattrip');
  game.go(() => new BoatTripScene(plan, trip!), [0.02, 0.04, 0.06], 1.2);
}

/** land at the far end of a trip (the FieldSite for Motu Ahi / the far coast, the reef dive) */
export async function goStop(id: string) {
  const plan = tripPlan(id);
  if (!plan || !trip) return;
  trip.phase = 'stop';
  if (plan.site === 'motuahi') { const m = await import('./oceanisle'); return m.goMotuAhi(trip.clockT); }
  if (plan.site === 'farcoast') { const m = await import('./oceancoast'); return m.goFarCoast(trip.clockT); }
  if (plan.stop === 'reef') { const m = await import('./oceanreef'); return m.goReefDive(trip.clockT); }
}

/** the trip is over: back to camp by boat (the camp module plays the landing) */
export async function sailHome() {
  const t = trip;
  trip = null;
  const s = boatSave();
  if (t && t.id !== 'maiden') s.trips++;
  game.persist();
  const before = game.scene;
  try {
    const { returnToCamp } = await import('../v10/expedition');
    await returnToCamp('boat');
  } catch (e) { console.error(e); }
  // (the expedition module is a contract stub until the map module lands: go home ourselves)
  await new Promise(r => setTimeout(r, 60));
  if (game.scene === before) {
    setBoatAway(false);
    const { goIsland } = await import('../v4/islandflow');
    await goIsland();
  }
}

// ------------------------------------------------------------------ the picker at the boatyard
const CSS = `
.bt-pick { width: min(92vw, 560px); padding: 0.9em 1.1em 1em; font-family: 'Jersey 15', 'Pixelify Sans', monospace; color: #3a2614; }
.bt-pick h3 { margin: 0 0 0.15em; font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: clamp(18px, 2.4vw, 24px); letter-spacing: 0.05em; color: #2f5a6a; }
.bt-pick .sub { font-size: clamp(12px, 1.5vw, 15px); opacity: 0.75; margin-bottom: 0.6em; }
.bt-pick .dest { display: flex; gap: 0.7em; align-items: center; width: 100%; text-align: left; margin: 0.35em 0; padding: 0.5em 0.7em; cursor: pointer;
  background: rgba(255, 248, 230, 0.6); border: 2px solid #8a6a3a; border-radius: 4px; font: inherit; color: inherit; }
.bt-pick .dest:hover, .bt-pick .dest:focus { background: #fff4d6; border-color: #3a7a8a; outline: none; }
.bt-pick .dest b { display: block; font-size: clamp(15px, 2vw, 19px); color: #2a4a5a; }
.bt-pick .dest span { display: block; font-size: clamp(11px, 1.4vw, 14px); line-height: 1.25; opacity: 0.85; }
.bt-pick .dest i { font-style: normal; flex: none; font-family: 'Jersey 10', 'Silkscreen', monospace; font-size: 12px; letter-spacing: 0.08em; padding: 0.2em 0.4em; color: #fff; background: #3a7a8a; border-radius: 3px; }
.bt-pick .dif { color: #b0603a; letter-spacing: 0.1em; }
.bt-pick .row { display: flex; justify-content: flex-end; margin-top: 0.6em; }
`;
let styled = false;
const TAG: Record<string, string> = { fishgrounds: 'FISH', glassreef: 'DIVE', motuahi: 'LAND', farcoast: 'LAND' };

/** the destination picker at the Kitten (a stand-in for the Region Map's boat routes) */
export async function openBoatTrips(yard?: { launchOut(): Promise<void> } | null) {
  if (!boatReady()) return;
  if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
  const box = el('div', 'bt-pick panel', `<h3>Take the Kitten out</h3><div class="sub">Where to? (A trip takes most of the day.)</div>`);
  let close: () => void = () => {};
  const choice = await new Promise<string | null>(res => {
    for (const id of BOAT_LOCATIONS) {
      const l = locDef(id);
      if (!l) continue;
      const b = el('button', 'dest', `<i>${TAG[id] ?? 'SEA'}</i><div><b>${l.name} <span class="dif" style="display:inline">${'●'.repeat(l.difficulty)}${'○'.repeat(5 - l.difficulty)}</span></b><span>${l.desc}</span></div>`);
      b.addEventListener('click', () => { audio.play('ui', { vol: 0.5 }); res(id); });
      box.appendChild(b);
    }
    const row = el('div', 'row', `<button class="btn">Not today</button>`);
    row.querySelector('button')!.addEventListener('click', () => res(null));
    box.appendChild(row);
    close = game.ui.modal(box, () => res(null));
  });
  close();
  if (!choice) return;
  await yard?.launchOut();
  await leaveFor(choice);
}

/** leave camp for a boat location through the expedition module (or straight there while it is a stub) */
export async function leaveFor(id: string) {
  const before = game.scene;
  try {
    const ex = await import('../v10/expedition');
    await ex.goExpedition(id);
    await new Promise(r => setTimeout(r, 60));
    if (ex.currentExpedition() === id || game.scene !== before) return;
  } catch (e) { console.error(e); }
  if (game.scene !== before) return;
  const l = locDef(id);
  if (l && l.scene.type === 'custom') await l.scene.go();
}

/** debug (console / tests): start a trip from anywhere: zl-style helper */
export const debugTrip = (id = 'motuahi') => { game.save.flags[BOAT_FLAG] = true; return goBoatTrip(id); };
