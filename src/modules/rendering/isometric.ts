import type { CameraState, GridPos, Vec2 } from "./types";

export function worldToScreen(grid: GridPos, tileWidth: number, tileHeight: number): Vec2 {
  const z = grid.z ?? 0;
  return {
    x: (grid.x - grid.y) * (tileWidth / 2),
    y: (grid.x + grid.y) * (tileHeight / 2) - z,
  };
}

export function screenToWorld(screen: Vec2, tileWidth: number, tileHeight: number): GridPos {
  const gx = screen.x / (tileWidth / 2);
  const gy = screen.y / (tileHeight / 2);
  return {
    x: Math.round((gy + gx) / 2),
    y: Math.round((gy - gx) / 2),
  };
}

export function worldToViewport(screenPos: Vec2, camera: CameraState): Vec2 {
  return {
    x: (screenPos.x - camera.position.x) * camera.zoom + camera.viewport.x / 2,
    y: (screenPos.y - camera.position.y) * camera.zoom + camera.viewport.y / 2,
  };
}

export function viewportToWorld(viewPos: Vec2, camera: CameraState): Vec2 {
  return {
    x: (viewPos.x - camera.viewport.x / 2) / camera.zoom + camera.position.x,
    y: (viewPos.y - camera.viewport.y / 2) / camera.zoom + camera.position.y,
  };
}

