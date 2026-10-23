// V12 contract: inspecting Mori (click/tap him or press Tab): the camera eases in, and his camera,
// backpack and note paper can be picked. The inspect module owns the real implementation; this stub
// opens the backpack.
export async function inspectMori(): Promise<void> {
  const { openBackpack } = await import('../backpack');
  await openBackpack();
}
