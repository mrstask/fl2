import { ActorRuntime } from "./actorRuntime";
import { CameraController } from "./camera";
import { buildTileChunks, collectVisibleTiles, visibleChunkIds } from "./chunking";
import { sanitizeWorldInput, validateEventInput } from "./hardening";
import { bucketAndSortEntities } from "./layers";
import { OverlayRuntime } from "./overlayRuntime";
import { PerformanceRuntime } from "./performanceRuntime";
import { VfxRuntime } from "./vfxRuntime";
import type {
  ActorRenderState,
  CameraState,
  GridPos,
  OverlayRenderState,
  OverlayType,
  RenderDiagnostics,
  RenderEvent,
  RenderFrameSnapshot,
  RenderTile,
  RenderWarning,
  TileChunk,
  VfxRenderState,
  RenderWorld,
} from "./types";

export type RendererLifecycleState = "idle" | "mounted" | "disposed";

export class RenderingScene {
  private lifecycle: RendererLifecycleState = "idle";
  private world: RenderWorld | null = null;
  private tileChunks = new Map<string, TileChunk>();
  private events: RenderEvent[] = [];
  private frame = 0;
  private elapsedMs = 0;
  private readonly camera: CameraController;
  private readonly actorRuntime = new ActorRuntime();
  private readonly overlayRuntime = new OverlayRuntime();
  private readonly vfxRuntime = new VfxRuntime();
  private readonly performanceRuntime = new PerformanceRuntime();
  private readonly chunkSize: number;
  private readonly chunkMarginPx: number;
  private lastVisibleChunkIds: string[] = [];
  private lastVisibleTiles: RenderTile[] = [];
  private warnings: RenderWarning[] = [];
  private diagnostics: RenderDiagnostics = {
    frame: 0,
    fps: 0,
    avgFps: 0,
    frameMs: 0,
    avgFrameMs: 0,
    drawCalls: 0,
    activeEntities: 0,
    activeOverlays: 0,
    activeVfx: 0,
    visibleChunks: 0,
    visibleTiles: 0,
    qualityTier: "high",
    budgetState: "within_budget",
  };

  constructor(initialCamera: CameraState, options?: { chunkSize?: number; chunkMarginPx?: number }) {
    this.camera = new CameraController(initialCamera);
    this.chunkSize = options?.chunkSize ?? 16;
    this.chunkMarginPx = options?.chunkMarginPx ?? 128;
  }

  public init(): void {
    if (this.lifecycle !== "idle") {
      return;
    }
    this.lifecycle = "mounted";
  }

  public setWorld(world: RenderWorld): void {
    const sanitized = sanitizeWorldInput(world, this.frame);
    this.pushWarnings(sanitized.warnings);
    this.world = sanitized.world;
    this.tileChunks = buildTileChunks(
      this.world.tiles,
      this.chunkSize,
      this.world.tileWidth,
      this.world.tileHeight,
    );
    this.actorRuntime.syncEntities(this.world.entities);
    this.overlayRuntime.beginFrame(this.frame);
    this.overlayRuntime.syncBaseOverlays(this.world.overlays);
  }

  public dispatch(event: RenderEvent): void {
    const warning = validateEventInput(event, this.frame);
    if (warning) {
      this.pushWarnings([warning]);
      return;
    }
    this.events.push(event);
  }

  public tick(deltaMs: number): void {
    if (this.lifecycle !== "mounted" || !this.world) {
      return;
    }

    try {
      this.frame += 1;
      this.elapsedMs += Math.max(deltaMs, 0);
      const frameMs = Math.max(deltaMs, 0.0001);
      const fps = 1000 / frameMs;

      this.actorRuntime.syncEntities(this.world.entities);
      this.actorRuntime.consumeEvents(this.events);
      this.actorRuntime.tick(this.elapsedMs);
      this.vfxRuntime.consumeEvents(this.events, this.world.entities);
      this.vfxRuntime.tick(this.elapsedMs);
      this.overlayRuntime.beginFrame(this.frame);
      this.overlayRuntime.syncBaseOverlays(this.world.overlays);
      const cameraState = this.camera.getState();
      if (cameraState.mode === "follow" && cameraState.followTargetId) {
        const followTarget = this.world.entities.find((e) => e.id === cameraState.followTargetId);
        if (followTarget) {
          this.camera.updateFollow(
            followTarget.grid,
            this.world.tileWidth,
            this.world.tileHeight,
            frameMs / 1000,
          );
        }
      }

      const qualityTier = this.performanceRuntime.getQualityTier();
      if (qualityTier === "low") {
        this.overlayRuntime.setToggle("los", false);
        this.overlayRuntime.setToggle("range", false);
      }

      const layerBuckets = bucketAndSortEntities(this.world.entities);
      const visibleChunkList = visibleChunkIds(
        this.tileChunks,
        this.camera.getState(),
        this.chunkMarginPx,
      );
      const visibleTiles = collectVisibleTiles(this.tileChunks, visibleChunkList);
      this.lastVisibleChunkIds = visibleChunkList;
      this.lastVisibleTiles = visibleTiles;

      const drawCallsEstimate =
        visibleTiles.length +
        layerBuckets.ground.length +
        layerBuckets.props.length +
        layerBuckets.actors.length +
        layerBuckets.overlays.length +
        layerBuckets.vfx.length +
        layerBuckets.ui_overlay.length;

      this.performanceRuntime.recordFrame({
        fps,
        frameMs,
        drawCalls: drawCallsEstimate,
        activeVfx: this.vfxRuntime.activeCount(),
      });

      this.diagnostics = this.performanceRuntime.createDiagnostics({
        frame: this.frame,
        fps,
        frameMs,
        drawCalls: drawCallsEstimate,
        activeEntities: this.world.entities.length,
        activeOverlays: this.overlayRuntime.snapshotVisible().length,
        activeVfx: this.vfxRuntime.activeCount(),
        visibleChunks: visibleChunkList.length,
        visibleTiles: visibleTiles.length,
      });
    } catch {
      this.pushWarnings([
        {
          code: "SCENE_TICK_FAILED",
          message: "Rendering tick failed; frame was skipped safely.",
          level: "error",
          atFrame: this.frame,
        },
      ]);
    } finally {
      this.events = [];
    }
  }

  public getActorRenderStates(): ActorRenderState[] {
    return this.actorRuntime.snapshot();
  }

  public getOverlayRenderStates(): OverlayRenderState[] {
    return this.overlayRuntime.snapshotVisible();
  }

  public getVfxRenderStates(): VfxRenderState[] {
    const qualityTier = this.performanceRuntime.getQualityTier();
    const all = this.vfxRuntime.snapshot();
    if (qualityTier === "high") {
      return all;
    }
    if (qualityTier === "medium") {
      return all.filter((fx) => fx.type !== "damage_popup");
    }
    return all.filter((fx) => fx.type === "hit_spark" || fx.type === "muzzle_flash");
  }

  public setOverlayToggle(type: OverlayType, enabled: boolean): void {
    this.overlayRuntime.setToggle(type, enabled);
  }

  public setHoverTile(tile: GridPos | null): void {
    this.overlayRuntime.setHoverTile(tile);
  }

  public setSelectedTile(tile: GridPos | null): void {
    this.overlayRuntime.setSelectedTile(tile);
  }

  public setPathPreview(pathTiles: GridPos[]): void {
    this.overlayRuntime.setPathPreview(pathTiles);
  }

  public setRangeOverlay(rangeTiles: GridPos[]): void {
    this.overlayRuntime.setRangeOverlay(rangeTiles);
  }

  public setLosOverlay(losTiles: GridPos[]): void {
    this.overlayRuntime.setLosOverlay(losTiles);
  }

  public getCamera(): CameraController {
    return this.camera;
  }

  public getDiagnostics(): RenderDiagnostics {
    return { ...this.diagnostics };
  }

  public getElapsedMs(): number {
    return this.elapsedMs;
  }

  public updateEntityGrid(entityId: string, tile: GridPos): boolean {
    if (!this.world) {
      return false;
    }
    const entity = this.world.entities.find((e) => e.id === entityId);
    if (!entity) {
      return false;
    }

    const nextX = Math.max(0, Math.min(this.world.mapSize.width - 1, Math.floor(tile.x)));
    const nextY = Math.max(0, Math.min(this.world.mapSize.height - 1, Math.floor(tile.y)));
    entity.grid = { ...entity.grid, x: nextX, y: nextY, z: tile.z };
    return true;
  }

  public setEntityDoorState(
    entityId: string,
    state: "open" | "closed" | "locked",
  ): boolean {
    if (!this.world) {
      return false;
    }
    const entity = this.world.entities.find((e) => e.id === entityId);
    if (!entity || entity.obstacleType !== "door") {
      return false;
    }
    entity.doorState = state;
    return true;
  }

  public getEntityById(entityId: string): RenderWorld["entities"][number] | null {
    if (!this.world) {
      return null;
    }
    const entity = this.world.entities.find((e) => e.id === entityId);
    if (!entity) {
      return null;
    }
    return { ...entity, grid: { ...entity.grid } };
  }

  public getFrameSnapshot(): RenderFrameSnapshot | null {
    if (!this.world) {
      return null;
    }
    return {
      mapId: this.world.mapId,
      tileWidth: this.world.tileWidth,
      tileHeight: this.world.tileHeight,
      allTiles: this.world.tiles.map((t) => ({ ...t, grid: { ...t.grid } })),
      visibleChunkIds: [...this.lastVisibleChunkIds],
      visibleTiles: this.lastVisibleTiles.map((t) => ({ ...t, grid: { ...t.grid } })),
      entities: this.world.entities.map((e) => ({ ...e, grid: { ...e.grid } })),
      actorStates: this.getActorRenderStates(),
      overlays: this.getOverlayRenderStates(),
      vfx: this.getVfxRenderStates(),
      diagnostics: this.getDiagnostics(),
    };
  }

  public getLifecycleState(): RendererLifecycleState {
    return this.lifecycle;
  }

  public getWarnings(): RenderWarning[] {
    return this.warnings.map((w) => ({ ...w }));
  }

  public dispose(): void {
    this.events = [];
    this.world = null;
    this.tileChunks.clear();
    this.actorRuntime.reset();
    this.overlayRuntime.reset();
    this.vfxRuntime.reset();
    this.performanceRuntime.reset();
    this.lastVisibleChunkIds = [];
    this.lastVisibleTiles = [];
    this.warnings = [];
    this.lifecycle = "disposed";
  }

  private pushWarnings(next: RenderWarning[]): void {
    if (next.length === 0) {
      return;
    }
    this.warnings.push(...next);
    if (this.warnings.length > 50) {
      this.warnings = this.warnings.slice(this.warnings.length - 50);
    }
  }
}
