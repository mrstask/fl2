import type {
  DoorObstacle,
  DoorOpenContext,
  DoorState,
  NavObstacle,
  NavPos,
  NavTile,
} from "./types";

function posKey(pos: NavPos): string {
  return `${pos.x},${pos.y}`;
}

function clampTerrainCost(cost: number): number {
  if (!Number.isFinite(cost) || cost <= 0) {
    return 1;
  }
  return cost;
}

export class NavigationGrid {
  private readonly tiles = new Map<string, NavTile>();
  private readonly obstacles = new Map<string, NavObstacle>();
  private readonly obstacleByPos = new Map<string, string>();
  private readonly occupiedByPos = new Map<string, string>();

  public setTile(tile: NavTile): void {
    const key = posKey(tile.pos);
    this.tiles.set(key, {
      ...tile,
      terrainCost: clampTerrainCost(tile.terrainCost),
    });
  }

  public setObstacle(obstacle: NavObstacle): void {
    this.obstacles.set(obstacle.id, { ...obstacle });
    this.obstacleByPos.set(posKey(obstacle.pos), obstacle.id);
  }

  public removeObstacle(obstacleId: string): void {
    const obstacle = this.obstacles.get(obstacleId);
    if (!obstacle) {
      return;
    }
    this.obstacles.delete(obstacleId);
    this.obstacleByPos.delete(posKey(obstacle.pos));
  }

  public setDoorState(doorId: string, state: DoorState): boolean {
    const obstacle = this.obstacles.get(doorId);
    if (!obstacle || obstacle.type !== "door") {
      return false;
    }
    obstacle.state = state;
    return true;
  }

  public getDoorState(doorId: string): DoorState | null {
    const obstacle = this.obstacles.get(doorId);
    if (!obstacle || obstacle.type !== "door") {
      return null;
    }
    return obstacle.state;
  }

  public tryOpenDoor(doorId: string, context?: DoorOpenContext): boolean {
    const obstacle = this.obstacles.get(doorId);
    if (!obstacle || obstacle.type !== "door") {
      return false;
    }
    if (obstacle.state === "open") {
      return true;
    }
    if (obstacle.state === "locked") {
      const hasKey = Boolean(context?.hasKey);
      const canPick = (context?.lockpickSkill ?? 0) >= 60;
      if (!hasKey && !canPick) {
        return false;
      }
    }
    obstacle.state = "open";
    return true;
  }

  public setOccupied(pos: NavPos, bodyId: string): void {
    this.occupiedByPos.set(posKey(pos), bodyId);
  }

  public clearOccupied(pos: NavPos): void {
    this.occupiedByPos.delete(posKey(pos));
  }

  public isOccupied(pos: NavPos): boolean {
    return this.occupiedByPos.has(posKey(pos));
  }

  public isWalkable(pos: NavPos, options?: { ignoreBodyId?: string }): boolean {
    const tile = this.tiles.get(posKey(pos));
    if (!tile || !tile.walkable) {
      return false;
    }

    const obstacleId = this.obstacleByPos.get(posKey(pos));
    if (obstacleId) {
      const obstacle = this.obstacles.get(obstacleId);
      if (obstacle?.type === "wall") {
        return false;
      }
      if (obstacle?.type === "door") {
        if (obstacle.state !== "open") {
          return false;
        }
      }
      if (obstacle?.type === "body") {
        if (!options?.ignoreBodyId || options.ignoreBodyId !== obstacle.id) {
          return false;
        }
      }
    }

    const occupied = this.occupiedByPos.get(posKey(pos));
    if (occupied && (!options?.ignoreBodyId || options.ignoreBodyId !== occupied)) {
      return false;
    }

    return true;
  }

  public movementCost(pos: NavPos): number {
    const tile = this.tiles.get(posKey(pos));
    if (!tile) {
      return Number.POSITIVE_INFINITY;
    }
    if (!this.isWalkable(pos)) {
      return Number.POSITIVE_INFINITY;
    }
    return clampTerrainCost(tile.terrainCost);
  }

  public blocksLos(pos: NavPos): boolean {
    const tile = this.tiles.get(posKey(pos));
    if (!tile) {
      return true;
    }
    if (tile.blocksLos) {
      return true;
    }

    const obstacleId = this.obstacleByPos.get(posKey(pos));
    if (!obstacleId) {
      return false;
    }
    const obstacle = this.obstacles.get(obstacleId);
    if (!obstacle) {
      return false;
    }

    if (obstacle.type === "wall") {
      return obstacle.blocksLos;
    }
    if (obstacle.type === "door") {
      return obstacle.blocksLosWhenClosed && obstacle.state !== "open";
    }
    return false;
  }

  public getDoorAt(pos: NavPos): DoorObstacle | null {
    const obstacleId = this.obstacleByPos.get(posKey(pos));
    if (!obstacleId) {
      return null;
    }
    const obstacle = this.obstacles.get(obstacleId);
    if (!obstacle || obstacle.type !== "door") {
      return null;
    }
    return { ...obstacle };
  }
}

