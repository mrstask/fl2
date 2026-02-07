import type { RenderEntity, RenderEvent, VfxRenderState, VfxType } from "./types";

type EffectTemplate = {
  type: VfxType;
  lifeMs: number;
  color: number;
  size: number;
  alpha: number;
};

const EVENT_TO_EFFECTS: Record<RenderEvent["type"], EffectTemplate[]> = {
  move_started: [],
  step_reached: [],
  blocked: [],
  repath_started: [],
  repath_failed: [],
  attack_fired: [
    { type: "muzzle_flash", lifeMs: 140, color: 0xffd27f, size: 16, alpha: 0.95 },
    { type: "projectile_trail", lifeMs: 220, color: 0xfff0cc, size: 8, alpha: 0.85 },
  ],
  hit_resolved: [
    { type: "hit_spark", lifeMs: 180, color: 0xff7272, size: 14, alpha: 0.9 },
    { type: "damage_popup", lifeMs: 420, color: 0xffd6d6, size: 18, alpha: 0.95 },
  ],
  entity_died: [{ type: "death_burst", lifeMs: 620, color: 0xff8f66, size: 28, alpha: 0.9 }],
};

type PooledEffect = VfxRenderState & { active: boolean };

function entityGrid(entities: RenderEntity[], id: string | undefined) {
  if (!id) {
    return null;
  }
  const entity = entities.find((e) => e.id === id);
  return entity ? entity.grid : null;
}

export class VfxRuntime {
  private pool: PooledEffect[] = [];
  private activeIds = new Set<string>();
  private counter = 0;

  constructor(private readonly maxPoolSize = 256) {}

  public consumeEvents(events: RenderEvent[], entities: RenderEntity[]): void {
    for (const event of events) {
      const templates = EVENT_TO_EFFECTS[event.type];
      for (const tmpl of templates) {
        const effect = this.allocate();
        if (!effect) {
          continue;
        }

        const src = entityGrid(entities, event.sourceId);
        const target = entityGrid(entities, event.targetId);
        effect.id = `vfx_${this.counter++}`;
        effect.type = tmpl.type;
        effect.sourceId = event.sourceId;
        effect.targetId = event.targetId;
        effect.grid = target ?? src ?? { x: 0, y: 0 };
        effect.color = tmpl.color;
        effect.size = tmpl.size;
        effect.alpha = tmpl.alpha;
        effect.startedAtMs = event.timeMs;
        effect.expiresAtMs = event.timeMs + tmpl.lifeMs;
        effect.active = true;
        this.activeIds.add(effect.id);
      }
    }
  }

  public tick(nowMs: number): void {
    for (const effect of this.pool) {
      if (!effect.active) {
        continue;
      }
      if (nowMs >= effect.expiresAtMs) {
        effect.active = false;
        this.activeIds.delete(effect.id);
      }
    }
  }

  public snapshot(): VfxRenderState[] {
    return this.pool
      .filter((e) => e.active)
      .map((e) => ({
        id: e.id,
        type: e.type,
        sourceId: e.sourceId,
        targetId: e.targetId,
        grid: { ...e.grid },
        color: e.color,
        size: e.size,
        alpha: e.alpha,
        startedAtMs: e.startedAtMs,
        expiresAtMs: e.expiresAtMs,
      }));
  }

  public activeCount(): number {
    return this.activeIds.size;
  }

  public reset(): void {
    this.pool = [];
    this.activeIds.clear();
    this.counter = 0;
  }

  private allocate(): PooledEffect | null {
    for (const effect of this.pool) {
      if (!effect.active) {
        return effect;
      }
    }
    if (this.pool.length >= this.maxPoolSize) {
      return null;
    }
    const created: PooledEffect = {
      id: "vfx_new",
      type: "hit_spark",
      sourceId: "none",
      targetId: undefined,
      grid: { x: 0, y: 0 },
      color: 0xffffff,
      size: 1,
      alpha: 0,
      startedAtMs: 0,
      expiresAtMs: 0,
      active: false,
    };
    this.pool.push(created);
    return created;
  }
}
