import type { CameraState, GridPos, Vec2 } from "./types";
import { worldToScreen } from "./isometric";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class CameraController {
  private state: CameraState;

  constructor(initial: CameraState) {
    this.state = { ...initial, position: { ...initial.position }, viewport: { ...initial.viewport } };
    this.clampPosition();
  }

  public getState(): CameraState {
    return {
      ...this.state,
      position: { ...this.state.position },
      viewport: { ...this.state.viewport },
      worldBounds: { ...this.state.worldBounds },
    };
  }

  public resizeViewport(viewport: Vec2): void {
    this.state.viewport = { ...viewport };
    this.clampPosition();
  }

  public setMode(mode: CameraState["mode"], followTargetId?: string): void {
    this.state.mode = mode;
    this.state.followTargetId = followTargetId;
  }

  public panBy(delta: Vec2): void {
    if (this.state.mode !== "free") {
      return;
    }
    this.state.position.x += delta.x;
    this.state.position.y += delta.y;
    this.clampPosition();
  }

  public setPosition(position: Vec2): void {
    this.state.position = { ...position };
    this.clampPosition();
  }

  public setZoom(nextZoom: number): void {
    this.state.zoom = clamp(nextZoom, this.state.minZoom, this.state.maxZoom);
    this.clampPosition();
  }

  public setWorldBounds(bounds: CameraState["worldBounds"]): void {
    this.state.worldBounds = { ...bounds };
    this.clampPosition();
  }

  public updateFollow(targetGrid: GridPos, tileWidth: number, tileHeight: number, deltaSec: number): void {
    if (this.state.mode !== "follow") {
      return;
    }
    const target = worldToScreen(targetGrid, tileWidth, tileHeight);
    const alpha = clamp(deltaSec * this.state.smoothing, 0, 1);
    this.state.position.x += (target.x - this.state.position.x) * alpha;
    this.state.position.y += (target.y - this.state.position.y) * alpha;
    this.clampPosition();
  }

  private clampPosition(): void {
    this.state.position.x = clamp(
      this.state.position.x,
      this.state.worldBounds.minX,
      this.state.worldBounds.maxX,
    );
    this.state.position.y = clamp(
      this.state.position.y,
      this.state.worldBounds.minY,
      this.state.worldBounds.maxY,
    );
  }
}
