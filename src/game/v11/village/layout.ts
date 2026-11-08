// V11 Te Kāinga layout: where everything stands (world x on the gameplay plane), west to east:
// the river and the landing, Hinerua's pou in the reeds, the eel traps and the smoking rack, the
// kūmara gardens, the pig pen, the weaving shelter, the wharenui and the marae in front of it (the
// dance ground, the night fire), the hāngī and the cooking fire, the woodpile, the carving shed with
// the waka on its trestles, the family houses with the laundry and the kids' things, Hana's bench,
// the pātaka, the hens' house, the goats, then Te Huarahi (the market lane: the families who came from
// across the sea and stayed, their houses, stalls and gardens, the dealer's lean-to at the far end and
// the crossroads to the backcountry), and the palisade with the carved gateway to the old track.

export const W = 4000;
export const G = 284;
export const RIVER = 230;

export const X = {
  jetty: [128, 232] as [number, number],
  waka: 166,
  pou: 244,
  reeds: [186, 270] as [number, number],
  skin: 214,
  hinaki: 288,
  nets: 316,
  smokeRack: 364,
  gourds: 396,
  garden: [420, 690] as [number, number],
  kumaraKete: 640,
  pen: [700, 790] as [number, number],
  shelter: 826,
  flax: 868,
  wharenui: 970,
  koroSeat: 1046,
  marae: [1110, 1260] as [number, number],
  fire: 1190,
  hangi: 1300,
  cookFire: 1344,
  woodpile: 1390,
  foodBench: 1438,
  shed: 1530,
  wakaBuild: 1530,
  whare1: 1690,
  laundry: 1786,
  whare2: 1890,
  whare3: 2066,
  hanaBench: 1984,
  pataka: 2176,
  coop: 2246,
  goats: [2286, 2340] as [number, number],
  /** Te Huarahi, the market lane (src/art/v11/village/quarter.ts paints it, scene.ts lays it out) */
  lane: [2380, 3740] as [number, number],
  /** the lane's households, west to east (quarter.ts): the Tongan family's fale, the Lees' store, the
   *  first of the three stalls, the trading store, the old gum-digger's hut */
  fale: 2470,
  leeStore: 2846,
  stalls: 2976,
  tradeStore: 3256,
  gumHut: 3450,
  /** the dealer's tarp lean-to at the end of the lane (kept clear by the lane's clutter) */
  dealer: [3540, 3680] as [number, number],
  /** the signposted crossroads up to the backcountry, Te Tuawhenua */
  backcountry: 3712,
  palisade: [3766, 4000] as [number, number],
  gate: 3862,
  trackExit: 3920,
};
