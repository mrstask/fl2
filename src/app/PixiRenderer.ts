import { Application, Container, Graphics } from "pixi.js";
import { NavigationGrid, findNavigationPath } from "../modules/navigation";
import {
  pickAtPointer,
  RenderingScene,
  worldToScreen,
  worldToViewport,
  type GridPos,
  type PickResult,
  type RenderEntity,
  type RenderTile,
} from "../modules/rendering";

type PickEventType = "hover" | "click";
type PickEventPayload = {
  eventType: PickEventType;
  pick: PickResult;
};

type AdapterOptions = {
  width: number;
  height: number;
  onHoverTile?: (tile: GridPos | null) => void;
  onSelected?: (tile: GridPos | null, entityId: string | null) => void;
  onPickEvent?: (payload: PickEventPayload) => void;
  onMovementStatus?: (status: string) => void;
  onPathPreviewState?: (state: "idle" | "valid" | "invalid" | "fallback") => void;
  onDoorState?: (state: "open" | "closed" | "locked" | "n/a") => void;
  onCommandState?: (state: "none" | "queued" | "active" | "cancelled") => void;
};

const GROUND_COLOR = 0x2f3d4c;
const HOUSE_FLOOR_COLOR = 0x3c4856;
const BLOCKED_COLOR = 0x25313f;
const TILE_STROKE = 0x536880;
const PLAYER_COLOR = 0xee8b58;
const NPC_COLOR = 0xb676da;
const PROP_COLOR = 0x80939e;
const WALL_COLOR = 0x6f7c88;
const DOOR_OPEN_COLOR = 0x6eb07f;
const DOOR_CLOSED_COLOR = 0xb08d4d;
const DOOR_LOCKED_COLOR = 0xd36363;

function isoDiamond(tileWidth: number, tileHeight: number): [number, number][] {
  return [
    [0, 0],
    [tileWidth / 2, tileHeight / 2],
    [0, tileHeight],
    [-tileWidth / 2, tileHeight / 2],
  ];
}

function drawTile(graphics: Graphics, x: number, y: number, color: number, tileWidth: number, tileHeight: number): void {
  const points = isoDiamond(tileWidth, tileHeight);
  graphics.moveTo(x + points[0][0], y + points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    graphics.lineTo(x + points[i][0], y + points[i][1]);
  }
  graphics.closePath();
  graphics.fill(color);
  graphics.stroke({ color: TILE_STROKE, width: 1 });
}

function drawActor(graphics: Graphics, x: number, y: number, color: number): void {
  graphics.ellipse(x, y + 24, 12, 6);
  graphics.fill({ color: 0x000000, alpha: 0.45 });
  graphics.rect(x - 10, y - 10, 20, 28);
  graphics.fill(color);
}

function drawProp(graphics: Graphics, x: number, y: number, color: number): void {
  graphics.rect(x - 12, y - 10, 24, 24);
  graphics.fill(color);
}

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.floor(((color >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.floor(((color >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.floor((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

function drawPrism(
  graphics: Graphics,
  x: number,
  y: number,
  tileWidth: number,
  tileHeight: number,
  heightPx: number,
  topColor: number,
): void {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  const h = Math.max(8, heightPx);

  const top = [
    [x, y - h],
    [x + halfW, y + halfH - h],
    [x, y + tileHeight - h],
    [x - halfW, y + halfH - h],
  ];
  const left = [
    [x - halfW, y + halfH - h],
    [x, y + tileHeight - h],
    [x, y + tileHeight],
    [x - halfW, y + halfH],
  ];
  const right = [
    [x + halfW, y + halfH - h],
    [x, y + tileHeight - h],
    [x, y + tileHeight],
    [x + halfW, y + halfH],
  ];
  const base = [
    [x, y],
    [x + halfW, y + halfH],
    [x, y + tileHeight],
    [x - halfW, y + halfH],
  ];

  const flat = (points: number[][]): number[] => points.flatMap((p) => [p[0], p[1]]);

  // Base outline helps visually anchor the prism to the tile.
  graphics.poly(flat(base));
  graphics.stroke({ color: shade(topColor, 0.48), width: 1 });

  graphics.poly(flat(left));
  graphics.fill(shade(topColor, 0.72));
  graphics.stroke({ color: shade(topColor, 0.58), width: 1 });

  graphics.poly(flat(right));
  graphics.fill(shade(topColor, 0.86));
  graphics.stroke({ color: shade(topColor, 0.64), width: 1 });

  graphics.poly(flat(top));
  graphics.fill(topColor);
  graphics.stroke({ color: shade(topColor, 0.78), width: 1 });
}

function tileByGrid(tiles: RenderTile[], pos: GridPos): RenderTile | undefined {
  return tiles.find((t) => t.grid.x === pos.x && t.grid.y === pos.y);
}

export class PixiRenderer {
  private app: Application | null = null;
  private readonly root = new Container();
  private readonly layers = {
    ground: new Graphics(),
    actors: new Graphics(),
    overlays: new Graphics(),
    vfx: new Graphics(),
  };
  private selectedTile: GridPos | null = null;
  private hoverTile: GridPos | null = null;
  private playerPath: GridPos[] = [];
  private playerPathIndex = 0;
  private playerTarget: GridPos | null = null;
  private queuedTarget: GridPos | null = null;
  private activeDestination: GridPos | null = null;
  private moveAccumulatorMs = 0;
  private readonly moveStepMs = 120;
  private repathAttempts = 0;
  private readonly maxRepathAttempts = 3;
  private readonly reservedTiles = new Map<string, string>();
  private readonly npcPatrolPath: GridPos[] = [
    { x: 10, y: 10 },
    { x: 11, y: 10 },
    { x: 12, y: 10 },
    { x: 11, y: 10 },
  ];
  private npcPatrolIndex = 0;
  private npcMoveAccumulatorMs = 0;
  private readonly npcMoveStepMs = 260;
  private canvasListenersBound = false;
  private readonly onMouseMove = (event: MouseEvent): void => this.onPointerMove(event);
  private readonly onClick = (event: MouseEvent): void => this.onPointerClick(event);
  private readonly onContextMenu = (event: MouseEvent): void => this.onRightClick(event);
  private readonly onWheelEvent = (event: WheelEvent): void => this.onWheel(event);
  private readonly onKeyDownEvent = (event: KeyboardEvent): void => this.onKeyDown(event);

  constructor(
    private readonly scene: RenderingScene,
    private readonly container: HTMLElement,
    private readonly options: AdapterOptions,
  ) {}

  public async init(): Promise<void> {
    const app = new Application();
    await app.init({
      width: this.options.width,
      height: this.options.height,
      background: "#171d24",
      antialias: true,
    });
    app.canvas.setAttribute("data-testid", "render-canvas");
    this.container.appendChild(app.canvas);
    this.app = app;

    this.root.addChild(this.layers.ground, this.layers.actors, this.layers.overlays, this.layers.vfx);
    app.stage.addChild(this.root);

    app.canvas.addEventListener("mousemove", this.onMouseMove);
    app.canvas.addEventListener("click", this.onClick);
    app.canvas.addEventListener("contextmenu", this.onContextMenu);
    app.canvas.addEventListener("wheel", this.onWheelEvent);
    window.addEventListener("keydown", this.onKeyDownEvent);
    this.canvasListenersBound = true;
  }

  public resize(width: number, height: number): void {
    if (!this.app) {
      return;
    }
    this.app.renderer.resize(width, height);
    this.scene.getCamera().resizeViewport({ x: width, y: height });
  }

  public render(): void {
    this.advanceNpcPatrol();
    this.advancePlayerMovement();
    try {
      const snapshot = this.scene.getFrameSnapshot();
      if (!snapshot) {
        return;
      }
      this.layers.ground.clear();
      this.layers.actors.clear();
      this.layers.overlays.clear();
      this.layers.vfx.clear();

      const camera = this.scene.getCamera().getState();
      for (const tile of snapshot.visibleTiles) {
        const worldPos = worldToScreen(tile.grid, snapshot.tileWidth, snapshot.tileHeight);
        const viewPos = worldToViewport(worldPos, camera);
        const tileColor =
          tile.spriteKey === "terrain.house_floor"
            ? HOUSE_FLOOR_COLOR
            : tile.walkable
              ? GROUND_COLOR
              : BLOCKED_COLOR;
        drawTile(
          this.layers.ground,
          viewPos.x,
          viewPos.y,
          tileColor,
          snapshot.tileWidth,
          snapshot.tileHeight,
        );
      }

      for (const entity of snapshot.entities) {
        const worldPos = worldToScreen(entity.grid, snapshot.tileWidth, snapshot.tileHeight);
        const viewPos = worldToViewport(worldPos, camera);
        if (entity.kind === "actor") {
          const color = entity.id === "actor_player" ? PLAYER_COLOR : NPC_COLOR;
          drawActor(this.layers.actors, viewPos.x, viewPos.y, color);
          continue;
        }
        if (entity.kind === "prop") {
          let color = PROP_COLOR;
          if (entity.obstacleType === "wall") {
            color = WALL_COLOR;
          } else if (entity.obstacleType === "door") {
            color =
              entity.doorState === "open"
                ? DOOR_OPEN_COLOR
                : entity.doorState === "locked"
                  ? DOOR_LOCKED_COLOR
                  : DOOR_CLOSED_COLOR;
          }
          if (entity.obstacleType === "wall" || entity.obstacleType === "door") {
            drawPrism(
              this.layers.actors,
              viewPos.x,
              viewPos.y,
              snapshot.tileWidth,
              snapshot.tileHeight,
              entity.height,
              color,
            );
          } else {
            drawProp(this.layers.actors, viewPos.x, viewPos.y, color);
          }
        }
      }

      for (const overlay of snapshot.overlays) {
        for (const tile of overlay.tiles) {
          const worldPos = worldToScreen(tile, snapshot.tileWidth, snapshot.tileHeight);
          const viewPos = worldToViewport(worldPos, camera);
          const color =
            overlay.type === "path" ? 0xc79e4d : overlay.type === "hover" ? 0x3f9682 : 0x947538;
          drawTile(this.layers.overlays, viewPos.x, viewPos.y, color, snapshot.tileWidth, snapshot.tileHeight);
        }
      }

      if (this.activeDestination) {
        const worldPos = worldToScreen(this.activeDestination, snapshot.tileWidth, snapshot.tileHeight);
        const viewPos = worldToViewport(worldPos, camera);
        drawTile(this.layers.overlays, viewPos.x, viewPos.y, 0x6fd6ff, snapshot.tileWidth, snapshot.tileHeight);
      }
      if (this.queuedTarget) {
        const worldPos = worldToScreen(this.queuedTarget, snapshot.tileWidth, snapshot.tileHeight);
        const viewPos = worldToViewport(worldPos, camera);
        drawTile(this.layers.overlays, viewPos.x, viewPos.y, 0xce84ff, snapshot.tileWidth, snapshot.tileHeight);
      }

      for (const fx of snapshot.vfx) {
        const worldPos = worldToScreen(fx.grid, snapshot.tileWidth, snapshot.tileHeight);
        const viewPos = worldToViewport(worldPos, camera);
        this.layers.vfx.circle(viewPos.x, viewPos.y + 8, fx.size / 2);
        this.layers.vfx.fill({ color: fx.color, alpha: fx.alpha });
        if (fx.type === "projectile_trail") {
          this.layers.vfx.rect(viewPos.x - fx.size, viewPos.y + 4, fx.size * 2, 2);
          this.layers.vfx.fill({ color: fx.color, alpha: fx.alpha * 0.8 });
        }
      }
    } catch {
      // Keep loop alive: clear layers and continue next frame.
      this.layers.ground.clear();
      this.layers.actors.clear();
      this.layers.overlays.clear();
      this.layers.vfx.clear();
    }
  }

  public destroy(): void {
    if (this.app && this.canvasListenersBound) {
      this.app.canvas.removeEventListener("mousemove", this.onMouseMove);
      this.app.canvas.removeEventListener("click", this.onClick);
      this.app.canvas.removeEventListener("contextmenu", this.onContextMenu);
      this.app.canvas.removeEventListener("wheel", this.onWheelEvent);
      window.removeEventListener("keydown", this.onKeyDownEvent);
      this.canvasListenersBound = false;
    }
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
  }

  public debugMoveToTile(tile: GridPos): boolean {
    const snapshot = this.scene.getFrameSnapshot();
    if (!snapshot) {
      return false;
    }
    this.tryPlanPlayerMovement(tile, snapshot);
    return true;
  }

  public debugInteractEntity(entityId: string): boolean {
    const snapshot = this.scene.getFrameSnapshot();
    if (!snapshot) {
      return false;
    }
    return this.tryHandleDoorClick(entityId, snapshot);
  }

  private onPointerMove(event: MouseEvent): void {
    const snapshot = this.scene.getFrameSnapshot();
    if (!snapshot || !this.app) {
      return;
    }
    const rect = this.app.canvas.getBoundingClientRect();
    const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const result = pickAtPointer(
      pointer,
      this.scene.getCamera().getState(),
      snapshot.visibleTiles,
      snapshot.entities as RenderEntity[],
      snapshot.tileWidth,
      snapshot.tileHeight,
    );

    this.options.onPickEvent?.({ eventType: "hover", pick: result });

    const tilePick =
      result.type === "entity"
        ? { type: "tile" as const, tileId: "__entity_tile__", grid: result.grid }
        : result;

    if (tilePick.type === "tile") {
      this.hoverTile = tilePick.grid;
      this.scene.setHoverTile(tilePick.grid);
      this.options.onHoverTile?.(tilePick.grid);
      if (this.selectedTile) {
        const navGrid = this.buildNavigationGrid(snapshot, "actor_player");
        const nav = findNavigationPath(this.selectedTile, tilePick.grid, navGrid, {
          allowDiagonal: true,
          preventCornerCutting: true,
          allowTargetFallback: true,
          maxFallbackRadius: 8,
          maxIterations: 6000,
        });
        this.scene.setPathPreview(nav.path);
        if (nav.path.length <= 1) {
          this.options.onPathPreviewState?.("invalid");
        } else if (nav.usedFallback) {
          this.options.onPathPreviewState?.("fallback");
        } else {
          this.options.onPathPreviewState?.("valid");
        }
      }
    } else {
      this.hoverTile = null;
      this.scene.setHoverTile(null);
      this.scene.setPathPreview([]);
      this.options.onPathPreviewState?.("idle");
      this.options.onHoverTile?.(null);
    }
  }

  private onPointerClick(event: MouseEvent): void {
    const snapshot = this.scene.getFrameSnapshot();
    if (!snapshot || !this.app) {
      return;
    }
    const rect = this.app.canvas.getBoundingClientRect();
    const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const result = pickAtPointer(
      pointer,
      this.scene.getCamera().getState(),
      snapshot.visibleTiles,
      snapshot.entities as RenderEntity[],
      snapshot.tileWidth,
      snapshot.tileHeight,
    );

    this.options.onPickEvent?.({ eventType: "click", pick: result });

    const tilePick =
      result.type === "entity"
        ? { type: "tile" as const, tileId: "__entity_tile__", grid: result.grid }
        : result;

    if (result.type === "entity" || result.type === "tile") {
      this.selectedTile = result.type === "entity" ? result.grid : result.grid;
      this.scene.setSelectedTile(this.selectedTile);
      this.options.onSelected?.(
        this.selectedTile,
        result.type === "entity" ? result.entityId : null,
      );

      if (result.type === "entity" && this.tryHandleDoorClick(result.entityId, snapshot)) {
        return;
      }

      if (tilePick.type === "tile") {
        if (this.isPlayerMoving()) {
          this.queuedTarget = { ...tilePick.grid };
          this.options.onCommandState?.("queued");
          this.options.onMovementStatus?.("queued");
          return;
        }
        this.tryPlanPlayerMovement(tilePick.grid, snapshot);
      }
    } else {
      this.selectedTile = null;
      this.scene.setSelectedTile(null);
      this.scene.setPathPreview([]);
      this.options.onSelected?.(null, null);
    }
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const camera = this.scene.getCamera();
    const state = camera.getState();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    camera.setZoom(state.zoom + delta);
  }

  private onRightClick(event: MouseEvent): void {
    event.preventDefault();
    this.cancelMovement("cancelled");
  }

  private onKeyDown(event: KeyboardEvent): void {
    const camera = this.scene.getCamera();
    const step = 24 / camera.getState().zoom;
    switch (event.key.toLowerCase()) {
      case "a":
        camera.panBy({ x: -step, y: 0 });
        break;
      case "d":
        camera.panBy({ x: step, y: 0 });
        break;
      case "w":
        camera.panBy({ x: 0, y: -step });
        break;
      case "s":
        camera.panBy({ x: 0, y: step });
        break;
      case "c":
        this.centerOnPlayer();
        break;
      default:
        break;
    }
  }

  private tryPlanPlayerMovement(targetTile: GridPos, snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>): void {
    const player = snapshot.entities.find((e) => e.id === "actor_player");
    if (!player) {
      return;
    }

    const navGrid = this.buildNavigationGrid(snapshot, "actor_player");
    const navResult = findNavigationPath(player.grid, targetTile, navGrid, {
      allowDiagonal: true,
      preventCornerCutting: true,
      allowTargetFallback: true,
      maxFallbackRadius: 8,
      maxIterations: 6000,
    });
    const path = navResult.path;

    if (path.length <= 1) {
      this.options.onMovementStatus?.("blocked");
      this.options.onPathPreviewState?.("invalid");
      this.scene.dispatch({
        id: `evt_blocked_${snapshot.diagnostics.frame}`,
        type: "blocked",
        sourceId: "actor_player",
        frame: snapshot.diagnostics.frame,
        timeMs: this.scene.getElapsedMs(),
        payload: {
          target: targetTile,
          reason: "unreachable",
        },
      });
      return;
    }

    this.playerPath = path;
    this.playerPathIndex = 1;
    this.playerTarget = { ...path[path.length - 1] };
    this.activeDestination = { ...path[path.length - 1] };
    this.moveAccumulatorMs = 0;
    this.repathAttempts = 0;
    this.scene.setPathPreview(path);
    this.options.onPathPreviewState?.(navResult.usedFallback ? "fallback" : "valid");
    this.options.onMovementStatus?.(navResult.usedFallback ? "fallback-path" : "moving");
    this.options.onCommandState?.("active");
    this.scene.dispatch({
      id: `evt_move_started_${snapshot.diagnostics.frame}`,
      type: "move_started",
      sourceId: "actor_player",
      frame: snapshot.diagnostics.frame,
      timeMs: this.scene.getElapsedMs(),
      payload: {
        fromGrid: { ...path[0] },
        toGrid: { ...path[path.length - 1] },
      },
    });
  }

  private advancePlayerMovement(): void {
    const snapshot = this.scene.getFrameSnapshot();
    if (!snapshot || this.playerPath.length <= 1 || this.playerPathIndex >= this.playerPath.length) {
      return;
    }

    this.moveAccumulatorMs += snapshot.diagnostics.frameMs;
    while (this.moveAccumulatorMs >= this.moveStepMs && this.playerPathIndex < this.playerPath.length) {
      this.moveAccumulatorMs -= this.moveStepMs;
      const nextTile = this.playerPath[this.playerPathIndex];
      const navGrid = this.buildNavigationGrid(snapshot, "actor_player");
      const reservedBy = this.reservedTiles.get(this.posKey(nextTile));
      const reservedBlocked = Boolean(reservedBy && reservedBy !== "actor_player");
      const nextWalkable = navGrid.isWalkable(nextTile, { ignoreBodyId: "actor_player" });

      if (!nextWalkable || reservedBlocked) {
        this.scene.dispatch({
          id: `evt_blocked_step_${snapshot.diagnostics.frame}_${this.playerPathIndex}`,
          type: "blocked",
          sourceId: "actor_player",
          frame: snapshot.diagnostics.frame,
          timeMs: this.scene.getElapsedMs(),
          payload: {
            blockedTile: { ...nextTile },
            reason: reservedBlocked ? "reserved" : "occupied_or_closed",
          },
        });

        if (!this.tryRepath(snapshot, navGrid)) {
          this.options.onMovementStatus?.("repath-failed");
          this.scene.dispatch({
            id: `evt_repath_failed_${snapshot.diagnostics.frame}`,
            type: "repath_failed",
            sourceId: "actor_player",
            frame: snapshot.diagnostics.frame,
            timeMs: this.scene.getElapsedMs(),
          });
          this.playerPath = [];
          this.playerPathIndex = 0;
          this.playerTarget = null;
          this.activeDestination = null;
          this.scene.setPathPreview([]);
          this.options.onPathPreviewState?.("invalid");
          this.options.onCommandState?.("none");
          return;
        }
        continue;
      }

      this.reservedTiles.set(this.posKey(nextTile), "actor_player");
      const moved = this.scene.updateEntityGrid("actor_player", nextTile);
      if (!moved) {
        this.playerPath = [];
        this.playerPathIndex = 0;
        this.playerTarget = null;
        this.activeDestination = null;
        this.scene.setPathPreview([]);
        this.options.onPathPreviewState?.("idle");
        this.options.onMovementStatus?.("blocked");
        this.options.onCommandState?.("none");
        this.reservedTiles.delete(this.posKey(nextTile));
        return;
      }

      this.scene.dispatch({
        id: `evt_step_reached_${snapshot.diagnostics.frame}_${this.playerPathIndex}`,
        type: "step_reached",
        sourceId: "actor_player",
        frame: snapshot.diagnostics.frame,
        timeMs: this.scene.getElapsedMs(),
      });
      this.reservedTiles.delete(this.posKey(nextTile));

      this.playerPathIndex += 1;
      if (this.playerPathIndex >= this.playerPath.length) {
        this.playerPath = [];
        this.playerPathIndex = 0;
        this.playerTarget = null;
        this.scene.setPathPreview([]);
        this.options.onPathPreviewState?.("idle");
        this.options.onMovementStatus?.("arrived");
        this.options.onCommandState?.("none");

        if (this.queuedTarget) {
          const queued = { ...this.queuedTarget };
          this.queuedTarget = null;
          const latest = this.scene.getFrameSnapshot();
          if (latest) {
            this.tryPlanPlayerMovement(queued, latest);
          }
        } else {
          this.activeDestination = null;
        }
      }
    }
  }

  private tryRepath(
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
    navGrid: NavigationGrid,
  ): boolean {
    if (!this.playerTarget || this.repathAttempts >= this.maxRepathAttempts) {
      return false;
    }
    const player = snapshot.entities.find((e) => e.id === "actor_player");
    if (!player) {
      return false;
    }

    this.repathAttempts += 1;
    const result = findNavigationPath(player.grid, this.playerTarget, navGrid, {
      allowDiagonal: true,
      preventCornerCutting: true,
      allowTargetFallback: true,
      maxFallbackRadius: 8,
      maxIterations: 6000,
    });
    if (result.path.length <= 1) {
      return false;
    }

    this.playerPath = result.path;
    this.playerPathIndex = 1;
    this.scene.setPathPreview(result.path);
    this.options.onMovementStatus?.("repathing");
    this.scene.dispatch({
      id: `evt_repath_started_${snapshot.diagnostics.frame}_${this.repathAttempts}`,
      type: "repath_started",
      sourceId: "actor_player",
      frame: snapshot.diagnostics.frame,
      timeMs: this.scene.getElapsedMs(),
      payload: {
        attempts: this.repathAttempts,
        toGrid: { ...result.path[result.path.length - 1] },
      },
    });
    return true;
  }

  private buildNavigationGrid(
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
    movingBodyId: string,
  ): NavigationGrid {
    const grid = new NavigationGrid();
    for (const tile of snapshot.allTiles) {
      grid.setTile({
        pos: { x: tile.grid.x, y: tile.grid.y },
        walkable: tile.walkable,
        blocksLos: false,
        terrainCost: 1,
      });
    }
    for (const entity of snapshot.entities) {
      if (entity.kind === "prop") {
        if (entity.obstacleType === "door") {
          grid.setObstacle({
            id: `prop_door_${entity.id}`,
            type: "door",
            pos: { x: entity.grid.x, y: entity.grid.y },
            state: entity.doorState === "open" ? "open" : entity.doorState === "locked" ? "locked" : "closed",
            blocksLosWhenClosed: entity.blocksLosWhenClosed ?? true,
          });
        } else if (entity.obstacleType === "wall") {
          grid.setObstacle({
            id: `prop_wall_${entity.id}`,
            type: "wall",
            pos: { x: entity.grid.x, y: entity.grid.y },
            blocksLos: true,
          });
        }
        continue;
      }
      if (entity.kind === "actor" && entity.id !== movingBodyId) {
        grid.setOccupied({ x: entity.grid.x, y: entity.grid.y }, entity.id);
      }
    }
    for (const [pos, owner] of this.reservedTiles.entries()) {
      if (owner === movingBodyId) {
        continue;
      }
      const [x, y] = pos.split(",").map((v) => Number(v));
      grid.setOccupied({ x, y }, owner);
    }
    return grid;
  }

  private posKey(pos: GridPos): string {
    return `${pos.x},${pos.y}`;
  }

  private isPlayerMoving(): boolean {
    return this.playerPath.length > 1 && this.playerPathIndex < this.playerPath.length;
  }

  private cancelMovement(status: "cancelled"): void {
    this.playerPath = [];
    this.playerPathIndex = 0;
    this.playerTarget = null;
    this.queuedTarget = null;
    this.activeDestination = null;
    this.scene.setPathPreview([]);
    this.options.onPathPreviewState?.("idle");
    this.options.onMovementStatus?.(status);
    this.options.onCommandState?.("cancelled");
  }

  private centerOnPlayer(): void {
    const snapshot = this.scene.getFrameSnapshot();
    if (!snapshot) {
      return;
    }
    const player = snapshot.entities.find((e) => e.id === "actor_player");
    if (!player) {
      return;
    }
    const world = worldToScreen(player.grid, snapshot.tileWidth, snapshot.tileHeight);
    this.scene.getCamera().setPosition(world);
  }

  private tryHandleDoorClick(
    entityId: string,
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
  ): boolean {
    const entity = snapshot.entities.find((e) => e.id === entityId);
    if (!entity || entity.obstacleType !== "door") {
      this.options.onDoorState?.("n/a");
      return false;
    }

    if (entity.doorState === "locked") {
      this.options.onMovementStatus?.("door-locked");
      this.options.onDoorState?.("locked");
      return true;
    }

    const nextState = entity.doorState === "open" ? "closed" : "open";
    const changed = this.scene.setEntityDoorState(entity.id, nextState);
    if (changed) {
      this.options.onMovementStatus?.(nextState === "open" ? "door-opened" : "door-closed");
      this.options.onDoorState?.(nextState);
      this.scene.dispatch({
        id: `evt_door_${entity.id}_${snapshot.diagnostics.frame}`,
        type: "blocked",
        sourceId: entity.id,
        frame: snapshot.diagnostics.frame,
        timeMs: this.scene.getElapsedMs(),
        payload: { doorState: nextState },
      });
    }
    return true;
  }

  private advanceNpcPatrol(): void {
    const snapshot = this.scene.getFrameSnapshot();
    if (!snapshot || this.npcPatrolPath.length < 2) {
      return;
    }
    const npc = snapshot.entities.find((e) => e.id === "actor_raider_01");
    if (!npc) {
      return;
    }

    this.npcMoveAccumulatorMs += snapshot.diagnostics.frameMs;
    if (this.npcMoveAccumulatorMs < this.npcMoveStepMs) {
      return;
    }
    this.npcMoveAccumulatorMs = 0;

    this.npcPatrolIndex = (this.npcPatrolIndex + 1) % this.npcPatrolPath.length;
    const next = this.npcPatrolPath[this.npcPatrolIndex];
    const navGrid = this.buildNavigationGrid(snapshot, "actor_raider_01");
    if (!navGrid.isWalkable(next, { ignoreBodyId: "actor_raider_01" })) {
      return;
    }
    const moved = this.scene.updateEntityGrid("actor_raider_01", next);
    if (!moved) {
      return;
    }
    this.scene.dispatch({
      id: `evt_npc_step_${snapshot.diagnostics.frame}_${this.npcPatrolIndex}`,
      type: "step_reached",
      sourceId: "actor_raider_01",
      frame: snapshot.diagnostics.frame,
      timeMs: this.scene.getElapsedMs(),
    });
  }
}
