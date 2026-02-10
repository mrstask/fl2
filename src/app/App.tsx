import { useEffect, useMemo, useRef, useState } from "react";
import {
  PixiRenderer,
  type DoorContextMenuPayload,
  type DoorMenuAction,
  type RendererRuntimeState,
} from "./PixiRenderer";
import { createDemoWorld } from "./createDemoWorld";
import { RenderingScene, worldToScreen, worldToViewport, type CameraState } from "../modules/rendering";

function createInitialCamera(width: number, height: number): CameraState {
  return {
    position: { x: 0, y: 0 },
    zoom: 1,
    minZoom: 0.45,
    maxZoom: 2,
    viewport: { x: width, y: height },
    worldBounds: { minX: -1200, minY: -900, maxX: 1200, maxY: 1000 },
    mode: "free",
    smoothing: 10,
  };
}

function fitCameraToWorld(scene: RenderingScene): void {
  const snapshot = scene.getFrameSnapshot();
  if (!snapshot || snapshot.allTiles.length === 0) {
    return;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const tile of snapshot.allTiles) {
    const p = worldToScreen(tile.grid, snapshot.tileWidth, snapshot.tileHeight);
    minX = Math.min(minX, p.x - snapshot.tileWidth / 2);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + snapshot.tileWidth / 2);
    maxY = Math.max(maxY, p.y + snapshot.tileHeight);
  }

  const margin = 120;
  const bounds = {
    minX: minX - margin,
    minY: minY - margin,
    maxX: maxX + margin,
    maxY: maxY + margin,
  };
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };

  const camera = scene.getCamera();
  camera.setWorldBounds(bounds);
  camera.setPosition(center);
}

const SAVE_KEY_PREFIX = "ashfall_demo_state_v1_slot_";

type PersistedEntityState = {
  id: string;
  x: number;
  y: number;
  doorState?: "open" | "closed" | "locked";
};

type PersistedState = {
  version: 1;
  savedAt: number;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  entities: PersistedEntityState[];
  runtime: RendererRuntimeState;
  movementStatus: string;
  commandState: "none" | "queued" | "active" | "cancelled";
};

type DoorVisual = {
  id: string;
  x: number;
  y: number;
  state: "open" | "closed" | "locked";
  orientation: "ne" | "nw";
};

export function App(): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<RenderingScene | null>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const [fps, setFps] = useState("0.0");
  const [zoom, setZoom] = useState("1.00");
  const [drawCalls, setDrawCalls] = useState("0");
  const [activeVfx, setActiveVfx] = useState("0");
  const [avgFps, setAvgFps] = useState("0.0");
  const [qualityTier, setQualityTier] = useState("high");
  const [budgetState, setBudgetState] = useState("within_budget");
  const [warningCount, setWarningCount] = useState("0");
  const [pathOverlayEnabled, setPathOverlayEnabled] = useState(true);
  const [losOverlayEnabled, setLosOverlayEnabled] = useState(true);
  const [pickedTile, setPickedTile] = useState("-");
  const [pickedEntity, setPickedEntity] = useState("-");
  const [lastPickEvent, setLastPickEvent] = useState("-");
  const [movementStatus, setMovementStatus] = useState("idle");
  const [pathPreviewState, setPathPreviewState] = useState("idle");
  const [doorState, setDoorState] = useState<"open" | "closed" | "locked" | "n/a">("n/a");
  const [playerTile, setPlayerTile] = useState("-");
  const [doorClosedState, setDoorClosedState] = useState("unknown");
  const [doorLockedState, setDoorLockedState] = useState("unknown");
  const [commandState, setCommandState] = useState<"none" | "queued" | "active" | "cancelled">("none");
  const [saveStateStatus, setSaveStateStatus] = useState("idle");
  const [saveSlot, setSaveSlot] = useState<1 | 2 | 3>(1);
  const [cameraMode, setCameraMode] = useState<CameraState["mode"]>("free");
  const [interactionIntent, setInteractionIntent] = useState("none");
  const [doorMenu, setDoorMenu] = useState<DoorContextMenuPayload | null>(null);
  const [doorVisuals, setDoorVisuals] = useState<DoorVisual[]>([]);
  const movementStatusRef = useRef(movementStatus);
  const pathPreviewStateRef = useRef(pathPreviewState);

  const world = useMemo(() => createDemoWorld(), []);

  useEffect(() => {
    movementStatusRef.current = movementStatus;
  }, [movementStatus]);

  useEffect(() => {
    pathPreviewStateRef.current = pathPreviewState;
  }, [pathPreviewState]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const width = host.clientWidth || 1280;
    const height = host.clientHeight || 720;
    const scene = new RenderingScene(createInitialCamera(width, height), {
      chunkSize: 12,
      chunkMarginPx: 180,
    });
    sceneRef.current = scene;
    scene.init();
    scene.setWorld(world);
    fitCameraToWorld(scene);

    const renderer = new PixiRenderer(scene, host, {
      width,
      height,
      onHoverTile: (tile) => {
        setPickedTile(tile ? `${tile.x},${tile.y}` : "-");
      },
      onSelected: (_tile, entityId) => {
        setPickedEntity(entityId ?? "-");
      },
      onPickEvent: (payload) => {
        if (payload.pick.type === "entity") {
          setLastPickEvent(`${payload.eventType}:entity:${payload.pick.entityId}`);
          return;
        }
        if (payload.pick.type === "tile") {
          setLastPickEvent(
            `${payload.eventType}:tile:${payload.pick.grid.x},${payload.pick.grid.y}`,
          );
          return;
        }
        setLastPickEvent(`${payload.eventType}:none`);
      },
      onMovementStatus: (status) => {
        setMovementStatus(status);
      },
      onPathPreviewState: (state) => {
        setPathPreviewState(state);
      },
      onDoorState: (state) => {
        setDoorState(state);
      },
      onCommandState: (state) => {
        setCommandState(state);
      },
      onInteractionIntent: (intent) => {
        setInteractionIntent(intent);
      },
      onDoorContextMenu: (menu) => {
        setDoorMenu(menu);
      },
    });
    rendererRef.current = renderer;
    (window as unknown as { __ashfallDebug?: Record<string, unknown> }).__ashfallDebug = {
      moveToTile: (x: number, y: number) => renderer.debugMoveToTile({ x, y }),
      interactEntity: (id: string) => renderer.debugInteractEntity(id),
      getEntity: (id: string) => scene.getEntityById(id),
      getCamera: () => scene.getCamera().getState(),
      setCameraMode: (mode: CameraState["mode"]) => scene.getCamera().setMode(mode, mode === "follow" ? "actor_player" : undefined),
      doorAction: (id: string, action: DoorMenuAction) => renderer.performDoorAction(id, action),
      getStatus: () => ({
        movementStatus: movementStatusRef.current,
        pathPreviewState: pathPreviewStateRef.current,
      }),
    };
    let mounted = true;
    let rafId = 0;
    let lastTime = performance.now();
    let attackTimerMs = 0;
    let simTimeMs = 0;

    void renderer.init().then(() => {
      if (!mounted) {
        renderer.destroy();
        return;
      }
      const frame = (now: number): void => {
        const delta = now - lastTime;
        lastTime = now;
        attackTimerMs += delta;
        simTimeMs += delta;

        if (attackTimerMs >= 900) {
          attackTimerMs = 0;
          const frame = scene.getDiagnostics().frame;
          const nowMs = simTimeMs;
          scene.dispatch({
            id: `evt_attack_${frame}`,
            type: "attack_fired",
            sourceId: "actor_player",
            targetId: "actor_raider_01",
            frame,
            timeMs: nowMs,
          });
          scene.dispatch({
            id: `evt_hit_${frame}`,
            type: "hit_resolved",
            sourceId: "actor_player",
            targetId: "actor_raider_01",
            frame,
            timeMs: nowMs + 120,
          });
          if (frame % 12 === 0) {
            scene.dispatch({
              id: `evt_death_${frame}`,
              type: "entity_died",
              sourceId: "actor_raider_01",
              targetId: "actor_raider_01",
              frame,
              timeMs: nowMs + 180,
            });
          }
        }

        scene.tick(delta);
        renderer.render();

        const diagnostics = scene.getDiagnostics();
        setFps(diagnostics.fps.toFixed(1));
        setAvgFps(diagnostics.avgFps.toFixed(1));
        setZoom(scene.getCamera().getState().zoom.toFixed(2));
        setDrawCalls(String(diagnostics.drawCalls));
        setActiveVfx(String(diagnostics.activeVfx));
        setQualityTier(diagnostics.qualityTier);
        setBudgetState(diagnostics.budgetState);
        setWarningCount(String(scene.getWarnings().length));
        setCameraMode(scene.getCamera().getState().mode);
        const snapshot = scene.getFrameSnapshot();
        if (snapshot) {
          const camera = scene.getCamera().getState();
          const wallPos = new Set(
            snapshot.entities
              .filter((e) => e.kind === "prop" && e.obstacleType === "wall")
              .map((e) => `${e.grid.x},${e.grid.y}`),
          );
          const doors = snapshot.entities
            .filter((e) => e.kind === "prop" && e.obstacleType === "door")
            .map((door) => {
              const world = worldToScreen(door.grid, snapshot.tileWidth, snapshot.tileHeight);
              const view = worldToViewport(world, camera);
              const left = wallPos.has(`${door.grid.x - 1},${door.grid.y}`);
              const right = wallPos.has(`${door.grid.x + 1},${door.grid.y}`);
              const up = wallPos.has(`${door.grid.x},${door.grid.y - 1}`);
              const down = wallPos.has(`${door.grid.x},${door.grid.y + 1}`);
              const xAxisWeight = Number(left) + Number(right);
              const yAxisWeight = Number(up) + Number(down);
              const orientation: DoorVisual["orientation"] = xAxisWeight >= yAxisWeight ? "ne" : "nw";
              return {
                id: door.id,
                x: view.x,
                y: view.y + snapshot.tileHeight,
                state: door.doorState === "open" ? "open" : door.doorState === "locked" ? "locked" : "closed",
                orientation,
              } satisfies DoorVisual;
            });
          setDoorVisuals(doors);

          const player = snapshot.entities.find((e) => e.id === "actor_player");
          if (player) {
            setPlayerTile(`${player.grid.x},${player.grid.y}`);
          }
          const doorClosed = snapshot.entities.find((e) => e.id === "door_demo_closed");
          const doorLocked = snapshot.entities.find((e) => e.id === "door_demo_locked");
          setDoorClosedState(doorClosed?.doorState ?? "unknown");
          setDoorLockedState(doorLocked?.doorState ?? "unknown");
        }

        rafId = requestAnimationFrame(frame);
      };
      rafId = requestAnimationFrame(frame);
    });

    const onResize = (): void => {
      if (!hostRef.current) {
        return;
      }
      renderer.resize(hostRef.current.clientWidth, hostRef.current.clientHeight);
      fitCameraToWorld(scene);
    };
    window.addEventListener("resize", onResize);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      renderer.destroy();
      scene.dispose();
      sceneRef.current = null;
      rendererRef.current = null;
      delete (window as unknown as { __ashfallDebug?: Record<string, unknown> }).__ashfallDebug;
    };
  }, [world]);

  const togglePathOverlay = (): void => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    const next = !pathOverlayEnabled;
    setPathOverlayEnabled(next);
    scene.setOverlayToggle("path", next);
  };

  const toggleLosOverlay = (): void => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    const next = !losOverlayEnabled;
    setLosOverlayEnabled(next);
    scene.setOverlayToggle("los", next);
  };

  const toggleCameraMode = (): void => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    const camera = scene.getCamera();
    const current = camera.getState().mode;
    if (current === "follow") {
      camera.setMode("free");
      return;
    }
    camera.setMode("follow", "actor_player");
  };

  const runDoorAction = (action: DoorMenuAction): void => {
    const renderer = rendererRef.current;
    if (!renderer || !doorMenu) {
      return;
    }
    renderer.performDoorAction(doorMenu.doorId, action);
    setDoorMenu(null);
  };

  const saveState = (): void => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) {
      setSaveStateStatus("save-failed");
      return;
    }
    const snapshot = scene.getFrameSnapshot();
    if (!snapshot) {
      setSaveStateStatus("save-failed");
      return;
    }
    const camera = scene.getCamera().getState();
    const payload: PersistedState = {
      version: 1,
      savedAt: Date.now(),
      camera: {
        x: camera.position.x,
        y: camera.position.y,
        zoom: camera.zoom,
      },
      entities: snapshot.entities.map((e) => ({
        id: e.id,
        x: e.grid.x,
        y: e.grid.y,
        doorState: e.doorState,
      })),
      runtime: renderer.debugExportRuntimeState(),
      movementStatus,
      commandState,
    };
    localStorage.setItem(`${SAVE_KEY_PREFIX}${saveSlot}`, JSON.stringify(payload));
    setSaveStateStatus("saved");
  };

  const loadState = (): void => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) {
      setSaveStateStatus("load-failed");
      return;
    }
    const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${saveSlot}`);
    if (!raw) {
      setSaveStateStatus("load-empty");
      return;
    }

    try {
      const data = JSON.parse(raw) as PersistedState;
      if (data.version !== 1) {
        setSaveStateStatus("load-version-mismatch");
        return;
      }

      for (const entity of data.entities) {
        scene.updateEntityGrid(entity.id, { x: entity.x, y: entity.y });
        if (entity.doorState) {
          scene.setEntityDoorState(entity.id, entity.doorState);
        }
      }
      const camera = scene.getCamera();
      camera.setZoom(data.camera.zoom);
      camera.setPosition({ x: data.camera.x, y: data.camera.y });
      renderer.debugImportRuntimeState(data.runtime);
      setMovementStatus(data.movementStatus);
      setCommandState(data.commandState);
      setSaveStateStatus("loaded");
    } catch {
      setSaveStateStatus("load-failed");
    }
  };

  const resetScenario = (): void => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) {
      setSaveStateStatus("reset-failed");
      return;
    }
    const fresh = createDemoWorld();
    scene.setWorld(fresh);
    fitCameraToWorld(scene);
    renderer.debugImportRuntimeState({
      npcPatrolIndex: 0,
      queuedTarget: null,
      activeDestination: null,
      playerTarget: null,
      moving: false,
    });
    setMovementStatus("idle");
    setCommandState("none");
    setPathPreviewState("idle");
    setDoorState("n/a");
    setDoorMenu(null);
    setDoorVisuals([]);
    setSaveStateStatus("reset");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="title">Ashfall Rendering Demo</div>
        <div className="hud">
          <span data-testid="fps-counter">FPS: {fps}</span>
          <span>AvgFPS: {avgFps}</span>
          <span data-testid="camera-zoom-value">Zoom: {zoom}</span>
          <span>DrawCalls: {drawCalls}</span>
          <span>ActiveVfx: {activeVfx}</span>
          <span>Quality: {qualityTier}</span>
          <span>Budget: {budgetState}</span>
          <span>Warnings: {warningCount}</span>
          <button data-testid="overlay-toggle-path" onClick={togglePathOverlay}>
            Path: {pathOverlayEnabled ? "on" : "off"}
          </button>
          <button data-testid="overlay-toggle-los" onClick={toggleLosOverlay}>
            LOS: {losOverlayEnabled ? "on" : "off"}
          </button>
          <button data-testid="camera-mode-toggle" onClick={toggleCameraMode}>
            CameraMode: {cameraMode === "follow" ? "follow" : "free"}
          </button>
          <label htmlFor="save-slot">Slot:</label>
          <select
            id="save-slot"
            data-testid="save-slot"
            value={saveSlot}
            onChange={(e) => setSaveSlot(Number(e.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <button data-testid="save-state" onClick={saveState}>Save State</button>
          <button data-testid="load-state" onClick={loadState}>Load State</button>
          <button data-testid="reset-scenario" onClick={resetScenario}>Start New Scenario</button>
          <span data-testid="debug-picked-tile">HoverTile: {pickedTile}</span>
          <span data-testid="debug-picked-entity">SelectedEntity: {pickedEntity}</span>
          <span data-testid="debug-last-pick">PickEvent: {lastPickEvent}</span>
          <span data-testid="movement-status">Movement: {movementStatus}</span>
          <span data-testid="command-state">Command: {commandState}</span>
          <span data-testid="door-state-label">Door: {doorState}</span>
          <span data-testid="blocked-indicator">
            Blocked: {movementStatus === "blocked" || movementStatus === "repath-failed" || pathPreviewState === "invalid" ? "yes" : "no"}
          </span>
          <span data-testid="path-preview-state">
            PathPreview: {pathPreviewState}
          </span>
          <span data-testid="interaction-intent">Intent: {interactionIntent}</span>
          <span data-testid="debug-player-tile">PlayerTile: {playerTile}</span>
          <span data-testid="debug-door-closed-state">DoorClosed: {doorClosedState}</span>
          <span data-testid="debug-door-locked-state">DoorLocked: {doorLockedState}</span>
          <span data-testid="save-state-status">StateIO: {saveStateStatus}</span>
          <span>Controls: WASD + MiddleDrag + EdgeScroll + MouseWheel + Hover/Click + RightClick(cancel) + C(center) + CameraMode(toggle)</span>
        </div>
      </header>
      <main className="viewport-wrap">
        <div className="viewport" ref={hostRef}>
          <div className="door-sprite-layer" aria-hidden="true">
            {doorVisuals.map((door) => (
              <div
                key={door.id}
                data-testid={`door-sprite-${door.id}`}
                data-state={door.state}
                className={`door-sprite state-${door.state} orient-${door.orientation}`}
                style={{ left: `${door.x}px`, top: `${door.y}px` }}
              >
                <span className="door-frame" />
                <span className="door-leaf" />
                <span className="door-hinge hinge-top" />
                <span className="door-hinge hinge-bottom" />
                <span className="door-wheel">
                  <span className="door-wheel-core">76</span>
                  <span className="door-wheel-spoke spoke-1" />
                  <span className="door-wheel-spoke spoke-2" />
                  <span className="door-wheel-spoke spoke-3" />
                  <span className="door-wheel-spoke spoke-4" />
                </span>
              </div>
            ))}
          </div>
          {doorMenu ? (
            <div
              className="door-context-menu"
              data-testid="door-context-menu"
              style={{ left: `${doorMenu.position.x + 8}px`, top: `${doorMenu.position.y + 8}px` }}
            >
              <div className="door-context-title">Door: {doorMenu.doorState}</div>
              <button data-testid="door-menu-open" onClick={() => runDoorAction("open")}>
                Open
              </button>
              <button data-testid="door-menu-close" onClick={() => runDoorAction("close")}>
                Close
              </button>
              <button data-testid="door-menu-key" onClick={() => runDoorAction("key")}>
                Key
              </button>
              <button data-testid="door-menu-lockpick" onClick={() => runDoorAction("lockpick")}>
                Lockpick
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
