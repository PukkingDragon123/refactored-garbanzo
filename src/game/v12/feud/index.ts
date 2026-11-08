// V12 The Claw and the Plume: boot. bootFeud() (called once from src/main.ts) registers the species,
// the quest "The Claw and the Plume" and its camp and village scenes (./quest), and puts the console
// helpers on window.zlFeud:
//
//   zlFeud.gallery({ anim, frame, scale, big, boa })   the art sheet
//   zlFeud.here(o?)                                     run the feud in the current field scene round Mori
//   zlFeud.state()                                      what the feud and both animals are doing

let booted = false;
export async function bootFeud() {
  if (booted) return;
  booted = true;
  const Q = await import('./quest');
  Q.registerFeud();
  // the bodies, minds and predator entries register themselves (a site's spawn list can name them)
  await import('./bearer');
  await import('./plumeboa');
  (window as unknown as { zlFeud?: unknown }).zlFeud = {
    gallery: async (o?: import('./gallery').FeudGalleryOpts) => (await import('./gallery')).feudGallery(o),
    here: async (o?: { prey?: string }) => (await import('./director')).feudHere(o),
    state: async () => (await import('./director')).feudState(),
    markSign: (id: string) => Q.markSign(id as never),
  };
}
