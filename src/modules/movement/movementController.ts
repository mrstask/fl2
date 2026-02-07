import { findPath } from "./pathfinding";
import { gridToScreen, screenToGrid } from "./isometric";
import type {
  GridPos,
  MovementConfig,
  MovementState,
  ScreenPos,
  WalkabilityQuery,
} from "./types";

function distance(a: GridPos, b: GridPos): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class MovementController {
  private state: MovementState;
  private readonly config: MovementConfig;
  private readonly isWalkable: WalkabilityQuery;

  constructor(
    startTile: GridPos,
    config: MovementConfig,
    isWalkable: WalkabilityQuery,
  ) {
    this.config = config;
    this.isWalkable = isWalkable;
    this.state = {
      currentTile: startTile,
      screenPos: gridToScreen(startTile, config.tileWidth, config.tileHeight),
      isMoving: false,
      path: [],
      pathIndex: 0,
    };
  }

  public getState(): MovementState {
    return {
      currentTile: { ...this.state.currentTile },
      screenPos: { ...this.state.screenPos },
      isMoving: this.state.isMoving,
      path: this.state.path.map((p) => ({ ...p })),
      pathIndex: this.state.pathIndex,
    };
  }

  public setPosition(tile: GridPos): void {
    this.state.currentTile = { ...tile };
    this.state.screenPos = gridToScreen(
      tile,
      this.config.tileWidth,
      this.config.tileHeight,
    );
    this.state.path = [];
    this.state.pathIndex = 0;
    this.state.isMoving = false;
  }

  public moveToTile(targetTile: GridPos): boolean {
    const path = findPath(
      this.state.currentTile,
      targetTile,
      this.isWalkable,
      this.config.allowDiagonal,
    );
    if (path.length <= 1) {
      return false;
    }

    this.state.path = path;
    this.state.pathIndex = 1;
    this.state.isMoving = true;
    return true;
  }

  public moveToScreen(targetScreenPos: ScreenPos): boolean {
    const targetTile = screenToGrid(
      targetScreenPos,
      this.config.tileWidth,
      this.config.tileHeight,
    );
    return this.moveToTile(targetTile);
  }

  public update(deltaSeconds: number): void {
    if (!this.state.isMoving || this.state.pathIndex >= this.state.path.length) {
      this.state.isMoving = false;
      return;
    }

    const fromTile = this.state.currentTile;
    const toTile = this.state.path[this.state.pathIndex];
    const stepDistance = distance(fromTile, toTile);
    const stepDuration = stepDistance / this.config.moveSpeedTilesPerSecond;
    const fromScreen = gridToScreen(
      fromTile,
      this.config.tileWidth,
      this.config.tileHeight,
    );
    const toScreen = gridToScreen(
      toTile,
      this.config.tileWidth,
      this.config.tileHeight,
    );

    if (stepDuration <= 0) {
      this.finishStep(toTile, toScreen);
      return;
    }

    const advance = Math.min(1, deltaSeconds / stepDuration);
    this.state.screenPos = {
      x: lerp(fromScreen.x, toScreen.x, advance),
      y: lerp(fromScreen.y, toScreen.y, advance),
    };

    if (advance >= 1) {
      this.finishStep(toTile, toScreen);
    }
  }

  private finishStep(tile: GridPos, screen: ScreenPos): void {
    this.state.currentTile = { ...tile };
    this.state.screenPos = { ...screen };
    this.state.pathIndex += 1;

    if (this.state.pathIndex >= this.state.path.length) {
      this.state.path = [];
      this.state.pathIndex = 0;
      this.state.isMoving = false;
    }
  }
}
