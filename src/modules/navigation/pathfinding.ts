import type { NavPos } from "./types";
import { NavigationGrid } from "./navigationGrid";

type NavNode = NavPos & {
  g: number;
  h: number;
  f: number;
  parentKey: string | null;
};

export type NavigationPathOptions = {
  allowDiagonal?: boolean;
  preventCornerCutting?: boolean;
  allowTargetFallback?: boolean;
  maxFallbackRadius?: number;
  maxIterations?: number;
};

export type NavigationPathResult = {
  path: NavPos[];
  resolvedGoal: NavPos | null;
  usedFallback: boolean;
};

function keyOf(pos: NavPos): string {
  return `${pos.x},${pos.y}`;
}

function heuristic(a: NavPos, b: NavPos, allowDiagonal: boolean): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return allowDiagonal ? Math.max(dx, dy) : dx + dy;
}

function neighbors(pos: NavPos, allowDiagonal: boolean): NavPos[] {
  const base = [
    { x: pos.x + 1, y: pos.y },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x, y: pos.y - 1 },
  ];
  if (!allowDiagonal) {
    return base;
  }
  return [
    ...base,
    { x: pos.x + 1, y: pos.y + 1 },
    { x: pos.x + 1, y: pos.y - 1 },
    { x: pos.x - 1, y: pos.y + 1 },
    { x: pos.x - 1, y: pos.y - 1 },
  ];
}

function reconstructPath(closed: Map<string, NavNode>, endNode: NavNode): NavPos[] {
  const path: NavPos[] = [];
  let current: NavNode | undefined = endNode;
  while (current) {
    path.push({ x: current.x, y: current.y });
    if (!current.parentKey) {
      break;
    }
    current = closed.get(current.parentKey);
  }
  return path.reverse();
}

function stepDistance(from: NavPos, to: NavPos): number {
  const diagonal = from.x !== to.x && from.y !== to.y;
  return diagonal ? 1.41421356237 : 1;
}

function canTraverseDiagonal(
  from: NavPos,
  to: NavPos,
  grid: NavigationGrid,
  preventCornerCutting: boolean,
): boolean {
  if (!preventCornerCutting) {
    return true;
  }
  const diagonal = from.x !== to.x && from.y !== to.y;
  if (!diagonal) {
    return true;
  }

  const orthA = { x: to.x, y: from.y };
  const orthB = { x: from.x, y: to.y };
  return grid.isWalkable(orthA) && grid.isWalkable(orthB);
}

function nearestReachableGoal(
  blockedGoal: NavPos,
  grid: NavigationGrid,
  maxRadius: number,
): NavPos | null {
  for (let r = 1; r <= maxRadius; r += 1) {
    const minX = blockedGoal.x - r;
    const maxX = blockedGoal.x + r;
    const minY = blockedGoal.y - r;
    const maxY = blockedGoal.y + r;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const onEdge = x === minX || x === maxX || y === minY || y === maxY;
        if (!onEdge) {
          continue;
        }
        const candidate = { x, y };
        if (grid.isWalkable(candidate)) {
          return candidate;
        }
      }
    }
  }
  return null;
}

export function findNavigationPath(
  start: NavPos,
  goal: NavPos,
  grid: NavigationGrid,
  options?: NavigationPathOptions,
): NavigationPathResult {
  const allowDiagonal = options?.allowDiagonal ?? true;
  const preventCornerCutting = options?.preventCornerCutting ?? true;
  const allowTargetFallback = options?.allowTargetFallback ?? false;
  const maxIterations = options?.maxIterations ?? 5000;
  const maxFallbackRadius = options?.maxFallbackRadius ?? 12;

  if (!grid.isWalkable(start)) {
    return { path: [], resolvedGoal: null, usedFallback: false };
  }

  let resolvedGoal: NavPos | null = { ...goal };
  let usedFallback = false;
  if (!grid.isWalkable(goal)) {
    if (!allowTargetFallback) {
      return { path: [], resolvedGoal: null, usedFallback: false };
    }
    resolvedGoal = nearestReachableGoal(goal, grid, maxFallbackRadius);
    if (!resolvedGoal) {
      return { path: [], resolvedGoal: null, usedFallback: false };
    }
    usedFallback = true;
  }

  if (start.x === resolvedGoal.x && start.y === resolvedGoal.y) {
    return { path: [{ ...start }], resolvedGoal, usedFallback };
  }

  const open = new Map<string, NavNode>();
  const closed = new Map<string, NavNode>();

  const startNode: NavNode = {
    ...start,
    g: 0,
    h: heuristic(start, resolvedGoal, allowDiagonal),
    f: heuristic(start, resolvedGoal, allowDiagonal),
    parentKey: null,
  };
  open.set(keyOf(start), startNode);

  let iterations = 0;
  while (open.size > 0 && iterations < maxIterations) {
    iterations += 1;

    let current: NavNode | null = null;
    for (const node of open.values()) {
      if (!current || node.f < current.f) {
        current = node;
      }
    }
    if (!current) {
      break;
    }

    const currentKey = keyOf(current);
    open.delete(currentKey);
    closed.set(currentKey, current);

    if (current.x === resolvedGoal.x && current.y === resolvedGoal.y) {
      return {
        path: reconstructPath(closed, current),
        resolvedGoal,
        usedFallback,
      };
    }

    for (const next of neighbors(current, allowDiagonal)) {
      if (!grid.isWalkable(next)) {
        continue;
      }
      if (!canTraverseDiagonal(current, next, grid, preventCornerCutting)) {
        continue;
      }

      const nextKey = keyOf(next);
      if (closed.has(nextKey)) {
        continue;
      }

      const cost = grid.movementCost(next);
      if (!Number.isFinite(cost)) {
        continue;
      }
      const tentativeG = current.g + stepDistance(current, next) * cost;
      const existing = open.get(nextKey);
      if (existing && tentativeG >= existing.g) {
        continue;
      }

      const h = heuristic(next, resolvedGoal, allowDiagonal);
      open.set(nextKey, {
        ...next,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parentKey: currentKey,
      });
    }
  }

  return { path: [], resolvedGoal: null, usedFallback };
}

