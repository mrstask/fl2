import type {
  ActorAttachment,
  ActorRenderState,
  ActorVisualState,
  Direction,
  GridPos,
  RenderEntity,
  RenderEvent,
} from "./types";

const DIRECTION_BUCKETS: Array<{ dir: Direction; dx: number; dy: number }> = [
  { dir: "N", dx: 0, dy: -1 },
  { dir: "NE", dx: 1, dy: -1 },
  { dir: "E", dx: 1, dy: 0 },
  { dir: "SE", dx: 1, dy: 1 },
  { dir: "S", dx: 0, dy: 1 },
  { dir: "SW", dx: -1, dy: 1 },
  { dir: "W", dx: -1, dy: 0 },
  { dir: "NW", dx: -1, dy: -1 },
];

const TRANSIENT_STATE_DURATION_MS: Record<Exclude<ActorVisualState, "death" | "downed">, number> = {
  idle: 0,
  walk: 120,
  attack: 240,
  hit: 180,
};

type ActorStateInternal = ActorRenderState & {
  transientUntilMs: number;
};

function normalizeDelta(value: number): number {
  if (value === 0) {
    return 0;
  }
  return value > 0 ? 1 : -1;
}

export function resolveDirection(from: GridPos, to: GridPos): Direction {
  const dx = normalizeDelta(to.x - from.x);
  const dy = normalizeDelta(to.y - from.y);
  const found = DIRECTION_BUCKETS.find((item) => item.dx === dx && item.dy === dy);
  return found?.dir ?? "S";
}

function defaultAttachments(): ActorAttachment[] {
  return [
    { key: "shadow", offset: { x: 0, y: 16 } },
    { key: "selection_ring", offset: { x: 0, y: 20 } },
    { key: "weapon", offset: { x: 10, y: -8 } },
    { key: "hit_marker", offset: { x: 0, y: -20 } },
  ];
}

function createInitialState(entity: RenderEntity): ActorStateInternal {
  return {
    entityId: entity.id,
    facing: entity.facing ?? "S",
    visualState: "idle",
    attachments: defaultAttachments(),
    lastEventFrame: 0,
    transientUntilMs: 0,
  };
}

function applyTransientState(
  state: ActorStateInternal,
  visualState: Exclude<ActorVisualState, "death" | "downed">,
  eventTimeMs: number,
): void {
  state.visualState = visualState;
  state.transientUntilMs = eventTimeMs + TRANSIENT_STATE_DURATION_MS[visualState];
}

function handleEvent(state: ActorStateInternal, event: RenderEvent): void {
  if (event.type === "entity_died") {
    state.visualState = "death";
    state.transientUntilMs = Number.POSITIVE_INFINITY;
    state.lastEventFrame = event.frame;
    return;
  }

  if (state.visualState === "death" || state.visualState === "downed") {
    return;
  }

  switch (event.type) {
    case "move_started":
    case "step_reached":
      applyTransientState(state, "walk", event.timeMs);
      break;
    case "attack_fired":
      applyTransientState(state, "attack", event.timeMs);
      break;
    case "hit_resolved":
      applyTransientState(state, "hit", event.timeMs);
      break;
    default:
      break;
  }

  if (event.payload && typeof event.payload === "object") {
    const target = event.payload as { fromGrid?: GridPos; toGrid?: GridPos };
    if (target.fromGrid && target.toGrid) {
      state.facing = resolveDirection(target.fromGrid, target.toGrid);
    }
  }

  state.lastEventFrame = event.frame;
}

function refreshTransientStates(states: Map<string, ActorStateInternal>, nowMs: number): void {
  for (const state of states.values()) {
    if (state.visualState === "death" || state.visualState === "downed") {
      continue;
    }
    if (state.transientUntilMs > 0 && nowMs >= state.transientUntilMs) {
      state.visualState = "idle";
      state.transientUntilMs = 0;
    }
  }
}

export class ActorRuntime {
  private readonly states = new Map<string, ActorStateInternal>();

  public syncEntities(entities: RenderEntity[]): void {
    const actorIds = new Set<string>();

    for (const entity of entities) {
      if (entity.kind !== "actor") {
        continue;
      }
      actorIds.add(entity.id);
      const existing = this.states.get(entity.id);
      if (!existing) {
        this.states.set(entity.id, createInitialState(entity));
        continue;
      }
      if (entity.facing) {
        existing.facing = entity.facing;
      }
    }

    for (const id of this.states.keys()) {
      if (!actorIds.has(id)) {
        this.states.delete(id);
      }
    }
  }

  public consumeEvents(events: RenderEvent[]): void {
    for (const event of events) {
      const state = this.states.get(event.sourceId);
      if (!state) {
        continue;
      }
      handleEvent(state, event);
    }
  }

  public tick(nowMs: number): void {
    refreshTransientStates(this.states, nowMs);
  }

  public getState(entityId: string): ActorRenderState | null {
    const state = this.states.get(entityId);
    if (!state) {
      return null;
    }
    return {
      entityId: state.entityId,
      facing: state.facing,
      visualState: state.visualState,
      attachments: state.attachments.map((a) => ({ key: a.key, offset: { ...a.offset } })),
      lastEventFrame: state.lastEventFrame,
    };
  }

  public snapshot(): ActorRenderState[] {
    return [...this.states.values()].map((state) => ({
      entityId: state.entityId,
      facing: state.facing,
      visualState: state.visualState,
      attachments: state.attachments.map((a) => ({ key: a.key, offset: { ...a.offset } })),
      lastEventFrame: state.lastEventFrame,
    }));
  }

  public reset(): void {
    this.states.clear();
  }
}

