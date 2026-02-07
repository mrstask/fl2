import { screenToWorld, viewportToWorld } from "./isometric";
import type {
  CameraState,
  PickOptions,
  PickResult,
  RenderEntity,
  RenderTile,
  Vec2,
} from "./types";

export function pickTile(
  pointerViewport: Vec2,
  camera: CameraState,
  tiles: RenderTile[],
  tileWidth: number,
  tileHeight: number,
): PickResult {
  const worldScreen = viewportToWorld(pointerViewport, camera);
  const grid = screenToWorld(worldScreen, tileWidth, tileHeight);
  const tile = tiles.find((t) => t.grid.x === grid.x && t.grid.y === grid.y);
  if (!tile) {
    return { type: "none" };
  }
  return { type: "tile", tileId: tile.id, grid: tile.grid };
}

export function pickEntityAtTile(
  tilePick: PickResult,
  entities: RenderEntity[],
): PickResult {
  if (tilePick.type !== "tile") {
    return tilePick;
  }
  const entity = entities
    .filter(
      (e) =>
        e.selectable &&
        e.grid.x === tilePick.grid.x &&
        e.grid.y === tilePick.grid.y,
    )
    .sort((a, b) => {
      const kindScore = (kind: RenderEntity["kind"]): number => {
        if (kind === "actor") {
          return 3;
        }
        if (kind === "prop") {
          return 2;
        }
        return 1;
      };
      const layerScore = (layer: RenderEntity["layer"]): number => {
        if (layer === "actors") {
          return 3;
        }
        if (layer === "props") {
          return 2;
        }
        return 1;
      };

      const scoreA = kindScore(a.kind) * 10 + layerScore(a.layer);
      const scoreB = kindScore(b.kind) * 10 + layerScore(b.layer);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      if (a.height !== b.height) {
        return b.height - a.height;
      }
      return a.id.localeCompare(b.id);
    })[0];

  if (!entity) {
    return tilePick;
  }
  return {
    type: "entity",
    entityId: entity.id,
    layer: entity.layer,
    grid: entity.grid,
  };
}

export function pickAtPointer(
  pointerViewport: Vec2,
  camera: CameraState,
  tiles: RenderTile[],
  entities: RenderEntity[],
  tileWidth: number,
  tileHeight: number,
  options?: PickOptions,
): PickResult {
  if (options?.uiBlocked) {
    return { type: "none" };
  }

  const tilePick = pickTile(pointerViewport, camera, tiles, tileWidth, tileHeight);
  return pickEntityAtTile(tilePick, entities);
}
