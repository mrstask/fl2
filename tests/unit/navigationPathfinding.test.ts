import { describe, expect, it } from "vitest";
import { NavigationGrid } from "../../src/modules/navigation/navigationGrid";
import { findNavigationPath } from "../../src/modules/navigation/pathfinding";

function createGrid(size = 7): NavigationGrid {
  const grid = new NavigationGrid();
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
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

describe("Navigation pathfinding Step 2", () => {
  it("NAV-U01/NAV-U05: avoids walls and occupied body tiles", () => {
    const grid = createGrid();
    grid.setObstacle({ id: "w1", type: "wall", pos: { x: 3, y: 3 }, blocksLos: true });
    grid.setOccupied({ x: 2, y: 2 }, "npc_1");

    const result = findNavigationPath({ x: 1, y: 1 }, { x: 5, y: 5 }, grid, {
      allowDiagonal: true,
    });

    expect(result.path.length).toBeGreaterThan(0);
    expect(result.path.some((p) => p.x === 3 && p.y === 3)).toBe(false);
    expect(result.path.some((p) => p.x === 2 && p.y === 2)).toBe(false);
  });

  it("NAV-U02/NAV-U03: closed door blocks and open door allows", () => {
    const grid = createGrid();
    grid.setObstacle({
      id: "door_mid",
      type: "door",
      pos: { x: 3, y: 3 },
      state: "closed",
      blocksLosWhenClosed: true,
    });
    // Force corridor through center door.
    for (let y = 0; y < 7; y += 1) {
      if (y === 3) {
        continue;
      }
      grid.setObstacle({ id: `wall_l_${y}`, type: "wall", pos: { x: 2, y }, blocksLos: true });
      grid.setObstacle({ id: `wall_r_${y}`, type: "wall", pos: { x: 4, y }, blocksLos: true });
    }

    const closed = findNavigationPath({ x: 3, y: 0 }, { x: 3, y: 6 }, grid, {
      allowDiagonal: false,
    });
    expect(closed.path.length).toBe(0);

    grid.setDoorState("door_mid", "open");
    const opened = findNavigationPath({ x: 3, y: 0 }, { x: 3, y: 6 }, grid, {
      allowDiagonal: false,
    });
    expect(opened.path.length).toBeGreaterThan(0);
    expect(opened.path.some((p) => p.x === 3 && p.y === 3)).toBe(true);
  });

  it("NAV-U06: prevents diagonal corner clipping", () => {
    const grid = createGrid(4);
    grid.setObstacle({ id: "w_a", type: "wall", pos: { x: 2, y: 1 }, blocksLos: true });
    grid.setObstacle({ id: "w_b", type: "wall", pos: { x: 1, y: 2 }, blocksLos: true });

    const result = findNavigationPath({ x: 1, y: 1 }, { x: 2, y: 2 }, grid, {
      allowDiagonal: true,
      preventCornerCutting: true,
    });

    expect(result.path.length).toBeGreaterThan(0);
    expect(result.path.some((p, idx, arr) => {
      if (idx === 0) {
        return false;
      }
      const prev = arr[idx - 1];
      return prev.x === 1 && prev.y === 1 && p.x === 2 && p.y === 2;
    })).toBe(false);
  });

  it("routes around high-cost terrain when cheaper detour exists", () => {
    const grid = createGrid(6);
    // Expensive straight route.
    grid.setTile({ pos: { x: 2, y: 1 }, walkable: true, blocksLos: false, terrainCost: 30 });
    grid.setTile({ pos: { x: 3, y: 1 }, walkable: true, blocksLos: false, terrainCost: 30 });

    const result = findNavigationPath({ x: 1, y: 1 }, { x: 4, y: 1 }, grid, {
      allowDiagonal: false,
    });

    expect(result.path.length).toBeGreaterThan(0);
    expect(result.path.some((p) => p.x === 2 && p.y === 1)).toBe(false);
    expect(result.path.some((p) => p.x === 3 && p.y === 1)).toBe(false);
  });

  it("NAV-U07: returns nearest reachable fallback when target blocked", () => {
    const grid = createGrid(7);
    grid.setObstacle({ id: "goal_wall", type: "wall", pos: { x: 5, y: 5 }, blocksLos: true });

    const result = findNavigationPath({ x: 1, y: 1 }, { x: 5, y: 5 }, grid, {
      allowDiagonal: true,
      allowTargetFallback: true,
      maxFallbackRadius: 3,
    });

    expect(result.path.length).toBeGreaterThan(0);
    expect(result.usedFallback).toBe(true);
    expect(result.resolvedGoal).not.toBeNull();
    expect(result.resolvedGoal?.x === 5 && result.resolvedGoal?.y === 5).toBe(false);
  });
});
