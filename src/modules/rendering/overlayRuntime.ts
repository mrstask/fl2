import type {
  GridPos,
  OverlayRenderState,
  OverlayStyle,
  OverlayToggles,
  OverlayType,
  RenderOverlay,
} from "./types";

const DEFAULT_TOGGLES: OverlayToggles = {
  hover: true,
  selection: true,
  path: true,
  range: true,
  los: true,
};

const DEFAULT_STYLES: Record<OverlayType, OverlayStyle> = {
  hover: {
    stroke: "#7ff0cf",
    fill: "#2f8f7a",
    opacity: 0.55,
    zBias: 0.1,
  },
  selection: {
    stroke: "#ffd266",
    fill: "#8f6c2b",
    opacity: 0.6,
    zBias: 0.12,
  },
  path: {
    stroke: "#ffe39a",
    fill: "#8d6d34",
    opacity: 0.5,
    zBias: 0.09,
  },
  range: {
    stroke: "#9ad6ff",
    fill: "#325d7b",
    opacity: 0.45,
    zBias: 0.08,
  },
  los: {
    stroke: "#ff8e8e",
    fill: "#7a3535",
    opacity: 0.38,
    zBias: 0.07,
  },
};

function cloneTiles(tiles: GridPos[]): GridPos[] {
  return tiles.map((t) => ({ ...t }));
}

function toState(overlay: RenderOverlay, frame: number): OverlayRenderState {
  return {
    id: overlay.id,
    type: overlay.type,
    tiles: cloneTiles(overlay.tiles),
    visible: true,
    style: { ...DEFAULT_STYLES[overlay.type] },
    updatedAtFrame: frame,
  };
}

export class OverlayRuntime {
  private readonly overlays = new Map<string, OverlayRenderState>();
  private toggles: OverlayToggles = { ...DEFAULT_TOGGLES };
  private frame = 0;

  public beginFrame(frame: number): void {
    this.frame = frame;
  }

  public syncBaseOverlays(items: RenderOverlay[]): void {
    const nextIds = new Set(items.map((o) => o.id));
    for (const item of items) {
      const existing = this.overlays.get(item.id);
      if (!existing) {
        this.overlays.set(item.id, toState(item, this.frame));
        continue;
      }
      existing.type = item.type;
      existing.tiles = cloneTiles(item.tiles);
      existing.style = { ...DEFAULT_STYLES[item.type] };
      existing.updatedAtFrame = this.frame;
    }
    for (const id of this.overlays.keys()) {
      if (!nextIds.has(id) && !id.startsWith("__dynamic_")) {
        this.overlays.delete(id);
      }
    }
    this.refreshVisibility();
  }

  public setToggle(type: OverlayType, enabled: boolean): void {
    this.toggles[type] = enabled;
    this.refreshVisibility();
  }

  public getToggles(): OverlayToggles {
    return { ...this.toggles };
  }

  public setHoverTile(tile: GridPos | null): void {
    this.setDynamicTileOverlay("__dynamic_hover", "hover", tile ? [tile] : []);
  }

  public setSelectedTile(tile: GridPos | null): void {
    this.setDynamicTileOverlay("__dynamic_selection", "selection", tile ? [tile] : []);
  }

  public setPathPreview(pathTiles: GridPos[]): void {
    this.setDynamicTileOverlay("__dynamic_path", "path", pathTiles);
  }

  public setRangeOverlay(rangeTiles: GridPos[]): void {
    this.setDynamicTileOverlay("__dynamic_range", "range", rangeTiles);
  }

  public setLosOverlay(losTiles: GridPos[]): void {
    this.setDynamicTileOverlay("__dynamic_los", "los", losTiles);
  }

  public snapshotVisible(): OverlayRenderState[] {
    return [...this.overlays.values()]
      .filter((o) => o.visible && o.tiles.length > 0)
      .sort((a, b) => {
        if (a.type === b.type) {
          return a.id.localeCompare(b.id);
        }
        return a.style.zBias - b.style.zBias;
      })
      .map((o) => ({
        id: o.id,
        type: o.type,
        tiles: cloneTiles(o.tiles),
        visible: o.visible,
        style: { ...o.style },
        updatedAtFrame: o.updatedAtFrame,
      }));
  }

  public reset(): void {
    this.overlays.clear();
    this.toggles = { ...DEFAULT_TOGGLES };
    this.frame = 0;
  }

  private setDynamicTileOverlay(id: string, type: OverlayType, tiles: GridPos[]): void {
    const existing = this.overlays.get(id);
    if (!existing) {
      this.overlays.set(id, {
        id,
        type,
        tiles: cloneTiles(tiles),
        visible: this.toggles[type],
        style: { ...DEFAULT_STYLES[type] },
        updatedAtFrame: this.frame,
      });
      return;
    }
    existing.type = type;
    existing.tiles = cloneTiles(tiles);
    existing.style = { ...DEFAULT_STYLES[type] };
    existing.updatedAtFrame = this.frame;
    existing.visible = this.toggles[type];
  }

  private refreshVisibility(): void {
    for (const overlay of this.overlays.values()) {
      overlay.visible = this.toggles[overlay.type];
    }
  }
}

