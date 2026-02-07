import { useEffect, useMemo, useRef, useState } from "react";
import { PixiRenderer } from "./PixiRenderer";
import { createDemoWorld } from "./createDemoWorld";
import { RenderingScene, worldToScreen, type CameraState } from "../modules/rendering";

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

export function App(): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<RenderingScene | null>(null);
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
    });
    (window as unknown as { __ashfallDebug?: Record<string, unknown> }).__ashfallDebug = {
      moveToTile: (x: number, y: number) => renderer.debugMoveToTile({ x, y }),
      interactEntity: (id: string) => renderer.debugInteractEntity(id),
      getEntity: (id: string) => scene.getEntityById(id),
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
        const snapshot = scene.getFrameSnapshot();
        if (snapshot) {
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
          <span data-testid="debug-player-tile">PlayerTile: {playerTile}</span>
          <span data-testid="debug-door-closed-state">DoorClosed: {doorClosedState}</span>
          <span data-testid="debug-door-locked-state">DoorLocked: {doorLockedState}</span>
          <span>Controls: WASD + Mouse Wheel + Hover/Click + RightClick(cancel) + C(center)</span>
        </div>
      </header>
      <main className="viewport-wrap">
        <div className="viewport" ref={hostRef} />
      </main>
    </div>
  );
}
