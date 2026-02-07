import type { GridPos, ScreenPos } from "./types";

export function gridToScreen(
  pos: GridPos,
  tileWidth: number,
  tileHeight: number,
): ScreenPos {
  return {
    x: (pos.x - pos.y) * (tileWidth / 2),
    y: (pos.x + pos.y) * (tileHeight / 2),
  };
}

export function screenToGrid(
  pos: ScreenPos,
  tileWidth: number,
  tileHeight: number,
): GridPos {
  const gx = pos.x / (tileWidth / 2);
  const gy = pos.y / (tileHeight / 2);

  return {
    x: Math.round((gy + gx) / 2),
    y: Math.round((gy - gx) / 2),
  };
}
