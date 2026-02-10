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
  onInteractionIntent?: (intent: "none" | "move" | "move+open" | "open" | "close" | "locked" | "blocked" | "select") => void;
  onDoorContextMenu?: (menu: DoorContextMenuPayload | null) => void;
};

export type RendererRuntimeState = {
  npcPatrolIndex: number;
  queuedTarget: GridPos | null;
  activeDestination: GridPos | null;
  playerTarget: GridPos | null;
  moving: boolean;
  pendingDoorId: string | null;
};

type InteractionIntent =
  | "none"
  | "move"
  | "move+open"
  | "open"
  | "close"
  | "locked"
  | "blocked"
  | "select";

export type DoorMenuAction = "open" | "close" | "key" | "lockpick";
export type DoorContextMenuPayload = {
  doorId: string;
  doorState: "open" | "closed" | "locked";
  position: { x: number; y: number };
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
  private pendingDoorInteraction: { doorId: string; action: DoorMenuAction } | null = null;
  private canvasListenersBound = false;
  private lastInteractionIntent: InteractionIntent = "none";
  private isMiddleDragging = false;
  private dragLastViewport: { x: number; y: number } | null = null;
  private pointerViewport: { x: number; y: number } | null = null;
  private pointerInCanvas = false;
  private readonly onMouseMove = (event: MouseEvent): void => this.onPointerMove(event);
  private readonly onClick = (event: MouseEvent): void => this.onPointerClick(event);
  private readonly onMouseDown = (event: MouseEvent): void => this.onMouseDownEvent(event);
  private readonly onMouseUp = (event: MouseEvent): void => this.onMouseUpEvent(event);
  private readonly onMouseLeave = (): void => this.onMouseLeaveEvent();
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
    app.canvas.addEventListener("mousedown", this.onMouseDown);
    app.canvas.addEventListener("mouseup", this.onMouseUp);
    app.canvas.addEventListener("mouseleave", this.onMouseLeave);
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
    this.applyEdgeScroll();
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
      this.app.canvas.removeEventListener("mousedown", this.onMouseDown);
      this.app.canvas.removeEventListener("mouseup", this.onMouseUp);
      this.app.canvas.removeEventListener("mouseleave", this.onMouseLeave);
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
    const entity = snapshot.entities.find((e) => e.id === entityId);
    if (!entity || entity.obstacleType !== "door") {
      return false;
    }
    const fallbackAction: DoorMenuAction = entity.doorState === "open" ? "close" : "open";
    return this.performDoorAction(entityId, fallbackAction);
  }

  public performDoorAction(entityId: string, action: DoorMenuAction): boolean {
    const snapshot = this.scene.getFrameSnapshot();
    if (!snapshot) {
      return false;
    }
    return this.tryPerformDoorAction(entityId, action, snapshot);
  }

  public debugExportRuntimeState(): RendererRuntimeState {
    return {
      npcPatrolIndex: this.npcPatrolIndex,
      queuedTarget: this.queuedTarget ? { ...this.queuedTarget } : null,
      activeDestination: this.activeDestination ? { ...this.activeDestination } : null,
      playerTarget: this.playerTarget ? { ...this.playerTarget } : null,
      moving: this.isPlayerMoving(),
      pendingDoorId: this.pendingDoorInteraction?.doorId ?? null,
    };
  }

  public debugImportRuntimeState(state: Partial<RendererRuntimeState>): void {
    if (typeof state.npcPatrolIndex === "number") {
      const max = Math.max(1, this.npcPatrolPath.length);
      this.npcPatrolIndex = ((Math.floor(state.npcPatrolIndex) % max) + max) % max;
    }
    this.queuedTarget = state.queuedTarget ? { ...state.queuedTarget } : null;
    this.activeDestination = state.activeDestination ? { ...state.activeDestination } : null;
    this.playerTarget = state.playerTarget ? { ...state.playerTarget } : null;
    this.pendingDoorInteraction =
      typeof state.pendingDoorId === "string" && state.pendingDoorId.length > 0
        ? { doorId: state.pendingDoorId, action: "open" }
        : null;
  }

  private onPointerMove(event: MouseEvent): void {
    const snapshot = this.scene.getFrameSnapshot();
    if (!snapshot || !this.app) {
      return;
    }
    const rect = this.app.canvas.getBoundingClientRect();
    const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.pointerViewport = pointer;
    this.pointerInCanvas = true;

    if (this.isMiddleDragging && this.dragLastViewport) {
      const dx = pointer.x - this.dragLastViewport.x;
      const dy = pointer.y - this.dragLastViewport.y;
      const zoom = this.scene.getCamera().getState().zoom;
      this.scene.getCamera().panBy({ x: -dx / zoom, y: -dy / zoom });
      this.dragLastViewport = pointer;
      if (this.app) {
        this.app.canvas.style.cursor = "grabbing";
      }
      return;
    }

    if (this.app) {
      this.app.canvas.style.cursor = "default";
    }

    const result = pickAtPointer(
      pointer,
      this.scene.getCamera().getState(),
      snapshot.visibleTiles,
      snapshot.entities as RenderEntity[],
      snapshot.tileWidth,
      snapshot.tileHeight,
    );
    this.updateCursorForPick(result, snapshot);
    this.emitInteractionIntent(this.predictInteractionIntent(result, snapshot));

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

  private onMouseDownEvent(event: MouseEvent): void {
    if (!this.app) {
      return;
    }
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    this.dragLastViewport = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.isMiddleDragging = true;
    this.app.canvas.style.cursor = "grabbing";
  }

  private onMouseUpEvent(event: MouseEvent): void {
    if (!this.app) {
      return;
    }
    if (event.button !== 1) {
      return;
    }
    this.isMiddleDragging = false;
    this.dragLastViewport = null;
    this.app.canvas.style.cursor = "default";
  }

  private onMouseLeaveEvent(): void {
    this.pointerInCanvas = false;
    this.pointerViewport = null;
    this.isMiddleDragging = false;
    this.dragLastViewport = null;
    if (this.app) {
      this.app.canvas.style.cursor = "default";
    }
    this.emitInteractionIntent("none");
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
    this.emitInteractionIntent(this.predictInteractionIntent(result, snapshot));

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

      if (result.type === "entity") {
        const entity = snapshot.entities.find((e) => e.id === result.entityId);
        if (entity?.obstacleType === "door") {
          this.options.onDoorContextMenu?.({
            doorId: entity.id,
            doorState: entity.doorState ?? "closed",
            position: pointer,
          });
          return;
        }
        this.options.onDoorContextMenu?.(null);
      }

      if (tilePick.type === "tile") {
        this.options.onDoorContextMenu?.(null);
        if (this.isPlayerMoving()) {
          this.queuedTarget = { ...tilePick.grid };
          this.options.onCommandState?.("queued");
          this.options.onMovementStatus?.("queued");
          return;
        }
        this.tryPlanPlayerMovement(tilePick.grid, snapshot);
      }
    } else {
      this.options.onDoorContextMenu?.(null);
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
    this.emitInteractionIntent("none");
    this.options.onDoorContextMenu?.(null);
  }

  private applyEdgeScroll(): void {
    const snapshot = this.scene.getFrameSnapshot();
    if (!snapshot || !this.app || !this.pointerInCanvas || !this.pointerViewport || this.isMiddleDragging) {
      return;
    }
    const margin = 24;
    const speedPxPerSec = 520;
    const dt = snapshot.diagnostics.frameMs / 1000;
    const zoom = this.scene.getCamera().getState().zoom;
    const worldStep = (speedPxPerSec * dt) / zoom;
    let panX = 0;
    let panY = 0;

    const viewWidth = this.app.canvas.clientWidth || this.options.width;
    const viewHeight = this.app.canvas.clientHeight || this.options.height;

    if (this.pointerViewport.x <= margin) {
      panX -= worldStep;
    } else if (this.pointerViewport.x >= viewWidth - margin) {
      panX += worldStep;
    }

    if (this.pointerViewport.y <= margin) {
      panY -= worldStep;
    } else if (this.pointerViewport.y >= viewHeight - margin) {
      panY += worldStep;
    }

    if (panX !== 0 || panY !== 0) {
      this.scene.getCamera().panBy({ x: panX, y: panY });
    }
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

  private tryPlanPlayerMovement(
    targetTile: GridPos,
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
    options?: { allowTargetFallback?: boolean; movementStatus?: string },
  ): boolean {
    const player = snapshot.entities.find((e) => e.id === "actor_player");
    if (!player) {
      return false;
    }

    const allowTargetFallback = options?.allowTargetFallback ?? true;
    const navGrid = this.buildNavigationGrid(snapshot, "actor_player");
    const navResult = findNavigationPath(player.grid, targetTile, navGrid, {
      allowDiagonal: true,
      preventCornerCutting: true,
      allowTargetFallback,
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
      return false;
    }

    this.playerPath = path;
    this.playerPathIndex = 1;
    this.playerTarget = { ...path[path.length - 1] };
    this.activeDestination = { ...path[path.length - 1] };
    this.moveAccumulatorMs = 0;
    this.repathAttempts = 0;
    this.scene.setPathPreview(path);
    this.options.onPathPreviewState?.(navResult.usedFallback ? "fallback" : "valid");
    this.options.onMovementStatus?.(
      options?.movementStatus ?? (navResult.usedFallback ? "fallback-path" : "moving"),
    );
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
    return true;
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

        if (this.pendingDoorInteraction) {
          const latest = this.scene.getFrameSnapshot();
          if (latest) {
            this.finishPendingDoorInteraction(latest);
          }
        }

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

  private predictInteractionIntent(
    pick: PickResult,
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
  ): InteractionIntent {
    if (pick.type === "none") {
      return "none";
    }

    const player = snapshot.entities.find((e) => e.id === "actor_player");
    if (!player) {
      return "none";
    }

    if (pick.type === "entity") {
      const entity = snapshot.entities.find((e) => e.id === pick.entityId);
      if (!entity) {
        return "none";
      }
      if (entity.obstacleType === "door") {
        if (entity.doorState === "locked") {
          return "locked";
        }
        if (entity.doorState === "open") {
          return "close";
        }
        if (this.isAdjacent(player.grid, entity.grid)) {
          return "open";
        }
        const approachTile = this.findDoorApproachTile(snapshot, player.grid, entity.grid);
        return approachTile ? "move+open" : "blocked";
      }
      if (entity.kind === "actor") {
        return "select";
      }
      if (entity.obstacleType === "wall") {
        return "blocked";
      }
      return "select";
    }

    const navGrid = this.buildNavigationGrid(snapshot, "actor_player");
    const navResult = findNavigationPath(player.grid, pick.grid, navGrid, {
      allowDiagonal: true,
      preventCornerCutting: true,
      allowTargetFallback: true,
      maxFallbackRadius: 8,
      maxIterations: 6000,
    });
    return navResult.path.length > 1 ? "move" : "blocked";
  }

  private emitInteractionIntent(intent: InteractionIntent): void {
    if (this.lastInteractionIntent === intent) {
      return;
    }
    this.lastInteractionIntent = intent;
    this.options.onInteractionIntent?.(intent);
  }

  private updateCursorForPick(
    pick: PickResult,
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
  ): void {
    if (!this.app) {
      return;
    }
    if (pick.type === "entity") {
      const entity = snapshot.entities.find((e) => e.id === pick.entityId);
      if (entity?.obstacleType === "door") {
        this.app.canvas.style.cursor = "pointer";
        return;
      }
    }
    this.app.canvas.style.cursor = "default";
  }

  private tryPerformDoorAction(
    entityId: string,
    action: DoorMenuAction,
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
  ): boolean {
    const entity = snapshot.entities.find((e) => e.id === entityId);
    if (!entity || entity.obstacleType !== "door") {
      this.options.onDoorState?.("n/a");
      return false;
    }

    if (action === "key" || action === "lockpick") {
      if (entity.doorState !== "locked") {
        this.options.onMovementStatus?.("door-not-locked");
        this.options.onDoorState?.(entity.doorState ?? "n/a");
        return true;
      }
      return this.tryExecuteDoorActionWithApproach(entity, action, snapshot);
    }

    if (action === "open") {
      if (entity.doorState === "locked") {
        this.options.onMovementStatus?.("door-locked");
        this.options.onDoorState?.("locked");
        return true;
      }
      if (entity.doorState === "open") {
        this.options.onMovementStatus?.("door-already-open");
        this.options.onDoorState?.("open");
        return true;
      }
      return this.tryExecuteDoorActionWithApproach(entity, "open", snapshot);
    }

    if (action === "close") {
      if (entity.doorState === "locked") {
        this.options.onMovementStatus?.("door-locked");
        this.options.onDoorState?.("locked");
        return true;
      }
      if (entity.doorState === "closed") {
        this.options.onMovementStatus?.("door-already-closed");
        this.options.onDoorState?.("closed");
        return true;
      }
      return this.tryExecuteDoorActionWithApproach(entity, "close", snapshot);
    }

    return false;
  }

  private tryExecuteDoorActionWithApproach(
    door: RenderEntity,
    action: DoorMenuAction,
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
  ): boolean {
    const player = snapshot.entities.find((e) => e.id === "actor_player");
    if (!player) {
      return true;
    }

    if (this.isAdjacent(player.grid, door.grid)) {
      this.pendingDoorInteraction = null;
      this.executeDoorActionAtRange(door, action, snapshot);
      return true;
    }

    const approachTile = this.findDoorApproachTile(snapshot, player.grid, door.grid);
    if (!approachTile) {
      this.pendingDoorInteraction = null;
      this.options.onMovementStatus?.("door-unreachable");
      this.options.onDoorState?.(door.doorState ?? "n/a");
      return true;
    }

    this.pendingDoorInteraction = { doorId: door.id, action };
    this.queuedTarget = null;
    const planned = this.tryPlanPlayerMovement(approachTile, snapshot, {
      allowTargetFallback: false,
      movementStatus: "moving-to-door",
    });
    if (!planned) {
      this.pendingDoorInteraction = null;
      this.options.onMovementStatus?.("door-unreachable");
      this.options.onDoorState?.(door.doorState ?? "n/a");
    }
    return true;
  }

  private finishPendingDoorInteraction(
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
  ): void {
    const pending = this.pendingDoorInteraction;
    if (!pending) {
      return;
    }

    const door = snapshot.entities.find((e) => e.id === pending.doorId);
    const player = snapshot.entities.find((e) => e.id === "actor_player");
    this.pendingDoorInteraction = null;
    if (!door || !player || door.obstacleType !== "door") {
      return;
    }
    if (!this.isAdjacent(player.grid, door.grid)) {
      this.options.onMovementStatus?.("door-unreachable");
      this.options.onDoorState?.(door.doorState ?? "n/a");
      return;
    }
    this.executeDoorActionAtRange(door, pending.action, snapshot);
  }

  private executeDoorActionAtRange(
    door: RenderEntity,
    action: DoorMenuAction,
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
  ): void {
    if (action === "open") {
      if (door.doorState === "locked") {
        this.options.onMovementStatus?.("door-locked");
        this.options.onDoorState?.("locked");
        return;
      }
      this.applyDoorState(door.id, "open", snapshot);
      return;
    }
    if (action === "close") {
      if (door.doorState === "locked") {
        this.options.onMovementStatus?.("door-locked");
        this.options.onDoorState?.("locked");
        return;
      }
      this.applyDoorState(door.id, "closed", snapshot);
      return;
    }
    if (door.doorState !== "locked") {
      this.options.onMovementStatus?.("door-not-locked");
      this.options.onDoorState?.(door.doorState ?? "n/a");
      return;
    }
    const changed = this.scene.setEntityDoorState(door.id, "closed");
    if (!changed) {
      return;
    }
    this.options.onMovementStatus?.(action === "key" ? "door-unlocked-key" : "door-unlocked-lockpick");
    this.options.onDoorState?.("closed");
    this.scene.dispatch({
      id: `evt_door_unlock_${door.id}_${snapshot.diagnostics.frame}`,
      type: "blocked",
      sourceId: door.id,
      frame: snapshot.diagnostics.frame,
      timeMs: this.scene.getElapsedMs(),
      payload: { unlockedBy: action },
    });
  }

  private applyDoorState(
    doorId: string,
    nextState: "open" | "closed",
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
  ): void {
    const changed = this.scene.setEntityDoorState(doorId, nextState);
    if (!changed) {
      return;
    }
    this.options.onMovementStatus?.(nextState === "open" ? "door-opened" : "door-closed");
    this.options.onDoorState?.(nextState);
    this.scene.dispatch({
      id: `evt_door_${doorId}_${snapshot.diagnostics.frame}`,
      type: "blocked",
      sourceId: doorId,
      frame: snapshot.diagnostics.frame,
      timeMs: this.scene.getElapsedMs(),
      payload: { doorState: nextState },
    });
  }

  private findDoorApproachTile(
    snapshot: NonNullable<ReturnType<RenderingScene["getFrameSnapshot"]>>,
    playerGrid: GridPos,
    doorGrid: GridPos,
  ): GridPos | null {
    const navGrid = this.buildNavigationGrid(snapshot, "actor_player");
    const candidates: GridPos[] = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const pos = { x: doorGrid.x + dx, y: doorGrid.y + dy };
        if (!navGrid.isWalkable(pos, { ignoreBodyId: "actor_player" })) {
          continue;
        }
        candidates.push(pos);
      }
    }
    if (candidates.length === 0) {
      return null;
    }

    let best: { tile: GridPos; pathLen: number } | null = null;
    for (const tile of candidates) {
      const result = findNavigationPath(playerGrid, tile, navGrid, {
        allowDiagonal: true,
        preventCornerCutting: true,
        allowTargetFallback: false,
        maxFallbackRadius: 0,
        maxIterations: 6000,
      });
      if (result.path.length <= 0) {
        continue;
      }
      const pathLen = result.path.length;
      if (!best || pathLen < best.pathLen) {
        best = { tile, pathLen };
      }
    }
    return best?.tile ?? null;
  }

  private isAdjacent(a: GridPos, b: GridPos): boolean {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0);
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
