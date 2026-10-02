// V11 Te Wao Nui, the story in the forest (placeholder while the scene is being built).

import type { ForestScene } from './scene';

export function attachForestStory(f: ForestScene) {
  f.onWalkOut = async () => {
    if (f.day1) { const { backToBeach } = await import('./index'); await backToBeach(); return; }
    const { returnToCamp } = await import('../../v10/expedition');
    await returnToCamp('walk');
  };
}
