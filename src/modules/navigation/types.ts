export type NavPos = {
  x: number;
  y: number;
};

export type DoorState = "open" | "closed" | "locked";

export type NavTile = {
  pos: NavPos;
  walkable: boolean;
  blocksLos: boolean;
  terrainCost: number;
};

export type WallObstacle = {
  id: string;
  type: "wall";
  pos: NavPos;
  blocksLos: boolean;
};

export type DoorObstacle = {
  id: string;
  type: "door";
  pos: NavPos;
  state: DoorState;
  blocksLosWhenClosed: boolean;
};

export type BodyObstacle = {
  id: string;
  type: "body";
  pos: NavPos;
};

export type NavObstacle = WallObstacle | DoorObstacle | BodyObstacle;

export type DoorOpenContext = {
  hasKey?: boolean;
  lockpickSkill?: number;
};

