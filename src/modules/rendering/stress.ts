import { RenderingScene } from "./scene";
import type { CameraState, RenderWorld } from "./types";

export type StressResult = {
  cycles: number;
  failures: number;
};

export function runSceneLifecycleStress(
  world: RenderWorld,
  initialCamera: CameraState,
  cycles = 20,
): StressResult {
  let failures = 0;
  for (let i = 0; i < cycles; i += 1) {
    try {
      const scene = new RenderingScene(initialCamera);
      scene.init();
      scene.setWorld(world);
      scene.tick(16.67);
      scene.tick(16.67);
      scene.dispose();
      if (scene.getLifecycleState() !== "disposed") {
        failures += 1;
      }
    } catch {
      failures += 1;
    }
  }
  return { cycles, failures };
}

