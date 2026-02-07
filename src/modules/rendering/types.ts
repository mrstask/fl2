export type LayerName =
  | "ground"
  | "props"
  | "actors"
  | "overlays"
  | "vfx"
  | "ui_overlay";

export const LAYER_ORDER: LayerName[] = [
  "ground",
  "props",
  "actors",
  "overlays",
  "vfx",
  "ui_overlay",
];

export type Vec2 = {
  x: number;
  y: number;
};

export type GridPos = {
  x: number;
  y: number;
  z?: number;
};

export type RenderTile = {
  id: string;
  grid: GridPos;
  spriteKey: string;
  walkable: boolean;
};

export type RenderEntityKind = "actor" | "prop" | "vfx_anchor";

export type RenderEntity = {
  id: string;
  kind: RenderEntityKind;
  layer: LayerName;
  grid: GridPos;
  spriteKey: string;
  height: number;
  selectable: boolean;
  facing?: Direction;
  obstacleType?: "wall" | "door";
  doorState?: "open" | "closed" | "locked";
  blocksLosWhenClosed?: boolean;
};

export type RenderOverlay = {
  id: string;
  type: "hover" | "selection" | "path" | "range" | "los";
  tiles: GridPos[];
};

export type OverlayType = RenderOverlay["type"];

export type OverlayStyle = {
  stroke: string;
  fill: string;
  opacity: number;
  zBias: number;
};

export type OverlayRenderState = {
  id: string;
  type: OverlayType;
  tiles: GridPos[];
  visible: boolean;
  style: OverlayStyle;
  updatedAtFrame: number;
};

export type OverlayToggles = Record<OverlayType, boolean>;

export type RenderWorld = {
  mapId: string;
  tileWidth: number;
  tileHeight: number;
  mapSize: { width: number; height: number };
  tiles: RenderTile[];
  entities: RenderEntity[];
  overlays: RenderOverlay[];
};

export type RenderEventType =
  | "move_started"
  | "step_reached"
  | "blocked"
  | "repath_started"
  | "repath_failed"
  | "attack_fired"
  | "hit_resolved"
  | "entity_died";

export type RenderEvent = {
  id: string;
  type: RenderEventType;
  sourceId: string;
  targetId?: string;
  frame: number;
  timeMs: number;
  payload?: Record<string, unknown>;
};

export type Direction = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export type ActorVisualState =
  | "idle"
  | "walk"
  | "attack"
  | "hit"
  | "death"
  | "downed";

export type ActorAttachment = {
  key: "shadow" | "selection_ring" | "weapon" | "hit_marker";
  offset: Vec2;
};

export type ActorRenderState = {
  entityId: string;
  facing: Direction;
  visualState: ActorVisualState;
  attachments: ActorAttachment[];
  lastEventFrame: number;
};

export type CameraMode = "free" | "follow" | "locked_transition";

export type CameraState = {
  position: Vec2;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  viewport: Vec2;
  worldBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  mode: CameraMode;
  followTargetId?: string;
  smoothing: number;
};

export type PickResult =
  | { type: "none" }
  | { type: "tile"; tileId: string; grid: GridPos }
  | { type: "entity"; entityId: string; layer: LayerName; grid: GridPos };

export type PickOptions = {
  uiBlocked?: boolean;
};

export type RenderDiagnostics = {
  frame: number;
  fps: number;
  avgFps: number;
  frameMs: number;
  avgFrameMs: number;
  drawCalls: number;
  activeEntities: number;
  activeOverlays: number;
  activeVfx: number;
  visibleChunks: number;
  visibleTiles: number;
  qualityTier: RenderQualityTier;
  budgetState: "within_budget" | "degraded";
};

export type ChunkCoord = {
  cx: number;
  cy: number;
};

export type WorldRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type TileChunk = {
  id: string;
  coord: ChunkCoord;
  tiles: RenderTile[];
  worldBounds: WorldRect;
};

export type RenderFrameSnapshot = {
  mapId: string;
  tileWidth: number;
  tileHeight: number;
  allTiles: RenderTile[];
  visibleChunkIds: string[];
  visibleTiles: RenderTile[];
  entities: RenderEntity[];
  actorStates: ActorRenderState[];
  overlays: OverlayRenderState[];
  vfx: VfxRenderState[];
  diagnostics: RenderDiagnostics;
};

export type RenderWarningLevel = "info" | "warn" | "error";

export type RenderWarning = {
  code: string;
  message: string;
  level: RenderWarningLevel;
  atFrame: number;
};

export type RenderQualityTier = "high" | "medium" | "low";

export type PerformanceBudgets = {
  minFps: number;
  maxFrameMs: number;
  maxDrawCalls: number;
  maxActiveVfx: number;
};

export type VfxType =
  | "muzzle_flash"
  | "projectile_trail"
  | "hit_spark"
  | "damage_popup"
  | "death_burst";

export type VfxRenderState = {
  id: string;
  type: VfxType;
  sourceId: string;
  targetId?: string;
  grid: GridPos;
  color: number;
  size: number;
  alpha: number;
  startedAtMs: number;
  expiresAtMs: number;
};
