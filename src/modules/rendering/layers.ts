import { LAYER_ORDER, type LayerName, type RenderEntity } from "./types";

export type LayerBuckets = Record<LayerName, RenderEntity[]>;

export function emptyBuckets(): LayerBuckets {
  return {
    ground: [],
    props: [],
    actors: [],
    overlays: [],
    vfx: [],
    ui_overlay: [],
  };
}

export function zSortKey(entity: RenderEntity): number {
  const z = entity.grid.z ?? 0;
  return entity.grid.x + entity.grid.y + entity.height * 0.001 - z * 0.0001;
}

export function bucketAndSortEntities(entities: RenderEntity[]): LayerBuckets {
  const buckets = emptyBuckets();
  for (const entity of entities) {
    buckets[entity.layer].push(entity);
  }
  for (const layerName of LAYER_ORDER) {
    buckets[layerName].sort((a, b) => {
      const diff = zSortKey(a) - zSortKey(b);
      if (diff !== 0) {
        return diff;
      }
      return a.id.localeCompare(b.id);
    });
  }
  return buckets;
}

