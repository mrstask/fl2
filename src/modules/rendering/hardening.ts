import type { RenderEvent, RenderWarning, RenderWorld } from "./types";

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function sanitizeWorldInput(
  input: RenderWorld,
  atFrame: number,
): { world: RenderWorld; warnings: RenderWarning[] } {
  const warnings: RenderWarning[] = [];

  const tileWidth = Math.max(16, finiteOr(input.tileWidth, 64));
  const tileHeight = Math.max(8, finiteOr(input.tileHeight, 32));
  if (tileWidth !== input.tileWidth || tileHeight !== input.tileHeight) {
    warnings.push({
      code: "WORLD_DIM_SANITIZED",
      message: "Tile dimensions were invalid and have been clamped.",
      level: "warn",
      atFrame,
    });
  }

  const mapWidth = Math.max(1, Math.floor(finiteOr(input.mapSize.width, 1)));
  const mapHeight = Math.max(1, Math.floor(finiteOr(input.mapSize.height, 1)));

  const tiles = input.tiles
    .filter((tile) => Number.isFinite(tile.grid.x) && Number.isFinite(tile.grid.y))
    .map((tile) => ({
      ...tile,
      grid: {
        x: Math.max(0, Math.min(mapWidth - 1, Math.floor(tile.grid.x))),
        y: Math.max(0, Math.min(mapHeight - 1, Math.floor(tile.grid.y))),
        z: tile.grid.z,
      },
      spriteKey: tile.spriteKey || "__placeholder_tile__",
    }));

  if (tiles.length !== input.tiles.length) {
    warnings.push({
      code: "WORLD_TILE_FILTERED",
      message: "Some tiles had invalid coordinates and were dropped.",
      level: "warn",
      atFrame,
    });
  }

  const entities = input.entities
    .filter((entity) => Number.isFinite(entity.grid.x) && Number.isFinite(entity.grid.y))
    .map((entity) => ({
      ...entity,
      grid: {
        x: Math.max(0, Math.min(mapWidth - 1, Math.floor(entity.grid.x))),
        y: Math.max(0, Math.min(mapHeight - 1, Math.floor(entity.grid.y))),
        z: entity.grid.z,
      },
      spriteKey: entity.spriteKey || "__placeholder_entity__",
      height: Math.max(1, finiteOr(entity.height, 32)),
    }));

  if (entities.length !== input.entities.length) {
    warnings.push({
      code: "WORLD_ENTITY_FILTERED",
      message: "Some entities had invalid coordinates and were dropped.",
      level: "warn",
      atFrame,
    });
  }

  return {
    world: {
      ...input,
      mapSize: { width: mapWidth, height: mapHeight },
      tileWidth,
      tileHeight,
      tiles,
      entities,
      overlays: input.overlays ?? [],
    },
    warnings,
  };
}

export function validateEventInput(
  event: RenderEvent,
  atFrame: number,
): RenderWarning | null {
  if (!event.id || !event.sourceId || !Number.isFinite(event.timeMs)) {
    return {
      code: "EVENT_INVALID",
      message: "Event was rejected because required fields are invalid.",
      level: "warn",
      atFrame,
    };
  }
  return null;
}

