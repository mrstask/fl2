export type GridPos = {
  x: number;
  y: number;
};

export type ScreenPos = {
  x: number;
  y: number;
};

export type WalkabilityQuery = (pos: GridPos) => boolean;

export type MovementConfig = {
  tileWidth: number;
  tileHeight: number;
  moveSpeedTilesPerSecond: number;
  allowDiagonal: boolean;
};

export type MovementState = {
  currentTile: GridPos;
  screenPos: ScreenPos;
  isMoving: boolean;
  path: GridPos[];
  pathIndex: number;
};
