import { describe, expect, it } from "vitest";
import { NavigationGrid } from "../../src/modules/navigation/navigationGrid";

function createGrid(): NavigationGrid {
  const grid = new NavigationGrid();
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      grid.setTile({
        pos: { x, y },
        walkable: true,
        blocksLos: false,
        terrainCost: 1,
      });
    }
  }
  return grid;
}

describe("NavigationGrid Step 1", () => {
  it("blocks walls as non-walkable", () => {
    const grid = createGrid();
    grid.setObstacle({
      id: "wall_1",
      type: "wall",
      pos: { x: 2, y: 2 },
      blocksLos: true,
    });

    expect(grid.isWalkable({ x: 2, y: 2 })).toBe(false);
    expect(grid.blocksLos({ x: 2, y: 2 })).toBe(true);
  });

  it("applies door state to passability", () => {
    const grid = createGrid();
    grid.setObstacle({
      id: "door_1",
      type: "door",
      pos: { x: 1, y: 1 },
      state: "closed",
      blocksLosWhenClosed: true,
    });

    expect(grid.isWalkable({ x: 1, y: 1 })).toBe(false);
    expect(grid.blocksLos({ x: 1, y: 1 })).toBe(true);

    const changed = grid.setDoorState("door_1", "open");
    expect(changed).toBe(true);
    expect(grid.isWalkable({ x: 1, y: 1 })).toBe(true);
    expect(grid.blocksLos({ x: 1, y: 1 })).toBe(false);
  });

  it("keeps locked door blocked without key/skill", () => {
    const grid = createGrid();
    grid.setObstacle({
      id: "door_locked",
      type: "door",
      pos: { x: 3, y: 1 },
      state: "locked",
      blocksLosWhenClosed: true,
    });

    const opened = grid.tryOpenDoor("door_locked", { hasKey: false, lockpickSkill: 20 });
    expect(opened).toBe(false);
    expect(grid.getDoorState("door_locked")).toBe("locked");
    expect(grid.isWalkable({ x: 3, y: 1 })).toBe(false);
  });

  it("opens locked door with key or lockpick skill", () => {
    const grid = createGrid();
    grid.setObstacle({
      id: "door_locked",
      type: "door",
      pos: { x: 3, y: 2 },
      state: "locked",
      blocksLosWhenClosed: true,
    });

    expect(grid.tryOpenDoor("door_locked", { hasKey: true })).toBe(true);
    expect(grid.getDoorState("door_locked")).toBe("open");
    expect(grid.isWalkable({ x: 3, y: 2 })).toBe(true);
  });

  it("supports dynamic body occupancy map", () => {
    const grid = createGrid();
    grid.setOccupied({ x: 4, y: 4 }, "npc_1");

    expect(grid.isOccupied({ x: 4, y: 4 })).toBe(true);
    expect(grid.isWalkable({ x: 4, y: 4 })).toBe(false);
    expect(grid.isWalkable({ x: 4, y: 4 }, { ignoreBodyId: "npc_1" })).toBe(true);

    grid.clearOccupied({ x: 4, y: 4 });
    expect(grid.isOccupied({ x: 4, y: 4 })).toBe(false);
    expect(grid.isWalkable({ x: 4, y: 4 })).toBe(true);
  });

  it("returns movement cost and infinity for blocked tile", () => {
    const grid = createGrid();
    grid.setTile({
      pos: { x: 0, y: 1 },
      walkable: true,
      blocksLos: false,
      terrainCost: 3,
    });
    grid.setObstacle({
      id: "wall_block",
      type: "wall",
      pos: { x: 0, y: 2 },
      blocksLos: true,
    });

    expect(grid.movementCost({ x: 0, y: 1 })).toBe(3);
    expect(grid.movementCost({ x: 0, y: 2 })).toBe(Number.POSITIVE_INFINITY);
  });
});

