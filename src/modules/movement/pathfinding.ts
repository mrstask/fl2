import type { GridPos, WalkabilityQuery } from "./types";

type Node = GridPos & {
  g: number;
  h: number;
  f: number;
  parentKey: string | null;
};

function keyOf(pos: GridPos): string {
  return `${pos.x},${pos.y}`;
}

function heuristic(a: GridPos, b: GridPos, allowDiagonal: boolean): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (!allowDiagonal) {
    return dx + dy;
  }
  return Math.max(dx, dy);
}

function neighbors(pos: GridPos, allowDiagonal: boolean): GridPos[] {
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

function reconstructPath(closed: Map<string, Node>, endNode: Node): GridPos[] {
  const path: GridPos[] = [];
  let current: Node | undefined = endNode;

  while (current) {
    path.push({ x: current.x, y: current.y });
    if (!current.parentKey) {
      break;
    }
    current = closed.get(current.parentKey);
  }

  return path.reverse();
}

export function findPath(
  start: GridPos,
  goal: GridPos,
  isWalkable: WalkabilityQuery,
  allowDiagonal: boolean,
  maxIterations = 5000,
): GridPos[] {
  if (!isWalkable(start) || !isWalkable(goal)) {
    return [];
  }

  if (start.x === goal.x && start.y === goal.y) {
    return [start];
  }

  const open = new Map<string, Node>();
  const closed = new Map<string, Node>();

  const startNode: Node = {
    ...start,
    g: 0,
    h: heuristic(start, goal, allowDiagonal),
    f: heuristic(start, goal, allowDiagonal),
    parentKey: null,
  };

  open.set(keyOf(start), startNode);
  let iterations = 0;

  while (open.size > 0 && iterations < maxIterations) {
    iterations += 1;

    let current: Node | null = null;
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

    if (current.x === goal.x && current.y === goal.y) {
      return reconstructPath(closed, current);
    }

    for (const next of neighbors(current, allowDiagonal)) {
      if (!isWalkable(next)) {
        continue;
      }

      const nextKey = keyOf(next);
      if (closed.has(nextKey)) {
        continue;
      }

      const moveCost =
        allowDiagonal && next.x !== current.x && next.y !== current.y
          ? 1.41421356237
          : 1;

      const tentativeG = current.g + moveCost;
      const existing = open.get(nextKey);
      if (existing && tentativeG >= existing.g) {
        continue;
      }

      const h = heuristic(next, goal, allowDiagonal);
      open.set(nextKey, {
        ...next,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parentKey: currentKey,
      });
    }
  }

  return [];
}
