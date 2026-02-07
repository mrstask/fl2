import type { RenderEntity, RenderTile, RenderWorld } from "../modules/rendering";

function createTiles(width: number, height: number): RenderTile[] {
  const tiles: RenderTile[] = [];
  const house = {
    minX: 8,
    maxX: 18,
    minY: 6,
    maxY: 14,
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inHouse =
        x >= house.minX && x <= house.maxX && y >= house.minY && y <= house.maxY;
      tiles.push({
        id: `tile_${x}_${y}`,
        grid: { x, y },
        spriteKey: inHouse ? "terrain.house_floor" : "terrain.sand",
        walkable: true,
      });
    }
  }
  return tiles;
}

function createEntities(): RenderEntity[] {
  const wallPos = new Set<string>();
  const addWall = (x: number, y: number): void => {
    wallPos.add(`${x},${y}`);
  };

  // House perimeter.
  for (let x = 8; x <= 18; x += 1) {
    addWall(x, 6);
    addWall(x, 14);
  }
  for (let y = 6; y <= 14; y += 1) {
    addWall(8, y);
    addWall(18, y);
  }

  // Entrance and interior door openings.
  wallPos.delete("8,10");
  wallPos.delete("13,10");

  // Interior divider wall that creates two rooms.
  for (let y = 7; y <= 13; y += 1) {
    if (y === 10) {
      continue;
    }
    addWall(13, y);
  }

  // Small room partition.
  for (let x = 14; x <= 17; x += 1) {
    if (x === 16) {
      continue;
    }
    addWall(x, 11);
  }

  const walls: RenderEntity[] = [...wallPos].map((key, idx) => {
    const [x, y] = key.split(",").map((v) => Number(v));
    return {
      id: `wall_house_${idx}`,
      kind: "prop",
      layer: "props",
      grid: { x, y },
      spriteKey: "prop.wall",
      height: 48,
      selectable: false,
      obstacleType: "wall" as const,
    };
  });

  return [
    {
      id: "actor_player",
      kind: "actor",
      layer: "actors",
      grid: { x: 5, y: 10 },
      spriteKey: "actor.player",
      height: 48,
      selectable: true,
      facing: "E",
    },
    {
      id: "actor_raider_01",
      kind: "actor",
      layer: "actors",
      grid: { x: 11, y: 10 },
      spriteKey: "actor.raider",
      height: 48,
      selectable: true,
      facing: "W",
    },
    {
      id: "prop_car",
      kind: "prop",
      layer: "props",
      grid: { x: 16, y: 8 },
      spriteKey: "prop.car",
      height: 32,
      selectable: false,
      obstacleType: "wall",
    },
    {
      id: "door_demo_closed",
      kind: "prop",
      layer: "props",
      grid: { x: 8, y: 10 },
      spriteKey: "prop.door",
      height: 46,
      selectable: true,
      obstacleType: "door",
      doorState: "closed",
      blocksLosWhenClosed: true,
    },
    {
      id: "door_demo_locked",
      kind: "prop",
      layer: "props",
      grid: { x: 13, y: 10 },
      spriteKey: "prop.door",
      height: 46,
      selectable: true,
      obstacleType: "door",
      doorState: "locked",
      blocksLosWhenClosed: true,
    },
    ...walls,
  ];
}

export function createDemoWorld(): RenderWorld {
  const mapWidth = 30;
  const mapHeight = 24;
  return {
    mapId: "demo-hub",
    tileWidth: 64,
    tileHeight: 32,
    mapSize: { width: mapWidth, height: mapHeight },
    tiles: createTiles(mapWidth, mapHeight),
    entities: createEntities(),
    overlays: [],
  };
}
