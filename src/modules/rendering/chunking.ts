import { worldToScreen } from "./isometric";
import type { CameraState, RenderTile, TileChunk, WorldRect } from "./types";

function chunkId(cx: number, cy: number): string {
  return `${cx}:${cy}`;
}

function rectIntersects(a: WorldRect, b: WorldRect): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

function worldViewRect(camera: CameraState, marginPx: number): WorldRect {
  const halfW = camera.viewport.x / camera.zoom / 2;
  const halfH = camera.viewport.y / camera.zoom / 2;
  return {
    minX: camera.position.x - halfW - marginPx,
    minY: camera.position.y - halfH - marginPx,
    maxX: camera.position.x + halfW + marginPx,
    maxY: camera.position.y + halfH + marginPx,
  };
}

function tileWorldRect(tile: RenderTile, tileWidth: number, tileHeight: number): WorldRect {
  const center = worldToScreen(tile.grid, tileWidth, tileHeight);
  return {
    minX: center.x - tileWidth / 2,
    minY: center.y,
    maxX: center.x + tileWidth / 2,
    maxY: center.y + tileHeight,
  };
}

export function buildTileChunks(
  tiles: RenderTile[],
  chunkSize: number,
  tileWidth: number,
  tileHeight: number,
): Map<string, TileChunk> {
  const byId = new Map<string, TileChunk>();

  for (const tile of tiles) {
    const cx = Math.floor(tile.grid.x / chunkSize);
    const cy = Math.floor(tile.grid.y / chunkSize);
    const id = chunkId(cx, cy);

    const existing = byId.get(id);
    if (!existing) {
      const bounds = tileWorldRect(tile, tileWidth, tileHeight);
      byId.set(id, {
        id,
        coord: { cx, cy },
        tiles: [tile],
        worldBounds: bounds,
      });
      continue;
    }

    existing.tiles.push(tile);
    const bounds = tileWorldRect(tile, tileWidth, tileHeight);
    existing.worldBounds.minX = Math.min(existing.worldBounds.minX, bounds.minX);
    existing.worldBounds.minY = Math.min(existing.worldBounds.minY, bounds.minY);
    existing.worldBounds.maxX = Math.max(existing.worldBounds.maxX, bounds.maxX);
    existing.worldBounds.maxY = Math.max(existing.worldBounds.maxY, bounds.maxY);
  }

  return byId;
}

export function visibleChunkIds(
  chunks: Map<string, TileChunk>,
  camera: CameraState,
  marginPx: number,
): string[] {
  const viewportRect = worldViewRect(camera, marginPx);
  const visible: string[] = [];
  for (const [id, chunk] of chunks) {
    if (rectIntersects(chunk.worldBounds, viewportRect)) {
      visible.push(id);
    }
  }
  return visible;
}

export function collectVisibleTiles(
  chunks: Map<string, TileChunk>,
  chunkIds: string[],
): RenderTile[] {
  const tiles: RenderTile[] = [];
  for (const id of chunkIds) {
    const chunk = chunks.get(id);
    if (!chunk) {
      continue;
    }
    tiles.push(...chunk.tiles);
  }
  return tiles;
}

