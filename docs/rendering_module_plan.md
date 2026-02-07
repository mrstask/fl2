# Rendering Module Expansion Plan (No Coding)

## 1. Module Scope
`rendering` should only draw and visualize state.  
It must not own gameplay logic (combat rules, quests, movement decisions).

## 2. Public Responsibilities
1. Render isometric terrain, actors, props, FX, and UI overlays.
2. Convert world/grid coordinates to screen coordinates.
3. Manage camera (pan, zoom, bounds, follow target).
4. Visualize selection, hover, paths, AP costs, LOS/cover overlays.
5. Animate actor movement/combat events from domain event stream.
6. Keep stable frame time through culling/batching/atlases.

## 3. External Interfaces
1. Input from domain:
- world snapshot (tiles, entities, states)
- event stream (move started, step reached, attack resolved, hit/miss, death)
- render hints (highlight tiles, path preview, fog/visibility)

2. Output from rendering:
- picked tile/entity under cursor
- camera state updates
- frame diagnostics (FPS, draw calls)

## 4. Step-by-Step Implementation Plan

### Step 1: Rendering Contracts
Items to implement:
1. Define typed render data contracts (`RenderWorld`, `RenderEntity`, `RenderEvent`).
2. Define render-layer order contract (ground -> props -> actors -> overlays -> VFX -> UI overlays).
3. Define sprite asset naming and atlas conventions.

Definition of done:
1. Contract document approved.
2. All fields required by movement/combat/UI are explicitly listed.
3. No gameplay logic fields leak into renderer-owned state.

### Step 2: Scene and Layer System
Items to implement:
1. Create scene root and fixed named layers.
2. Add deterministic z-sorting strategy for isometric depth.
3. Add render loop lifecycle (init, tick, dispose).

Definition of done:
1. Layer order is stable and documented.
2. Objects at different depths never flicker/swap incorrectly.
3. Scene can mount/unmount cleanly without memory leaks.

### Step 3: Camera System
Items to implement:
1. Camera pan/zoom with bounds clamping.
2. Follow mode for selected actor with smoothing.
3. Screen-to-world and world-to-screen helpers tied to camera transform.

Definition of done:
1. Camera never exposes outside-map invalid space.
2. Coordinate conversions are reversible within tile tolerance.
3. Follow mode can be toggled without jitter.

### Step 4: Tilemap Rendering
Items to implement:
1. Chunked map renderer for base terrain and static props.
2. Texture atlas usage for tile batching.
3. Culling for off-screen chunks.

Definition of done:
1. Large maps render without full-scene redraw spikes.
2. Draw-call budget target is met for vertical slice.
3. Chunk load/unload is visually seamless.

### Step 5: Actor Rendering
Items to implement:
1. Actor sprite pipeline with direction/facing states.
2. Runtime animation state switching (idle, walk, attack, hit, death).
3. Shadow and selection ring rendering.

Definition of done:
1. Actor facing and animation transitions match movement/combat events.
2. Selection ring is always correctly anchored to tile.
3. No actor pop-in during normal camera movement.

### Step 6: Overlay Rendering
Items to implement:
1. Hover tile highlight and selected tile highlight.
2. Path preview overlay with step markers and AP cost hint.
3. LOS/cover and interaction range overlays.

Definition of done:
1. Overlays respond within one frame to input/domain updates.
2. Overlay colors/styles are consistent and readable.
3. Overlays can be toggled independently for debug and gameplay.

### Step 7: Event-Driven VFX
Items to implement:
1. Event-to-VFX mapper (muzzle flash, projectile trail, hit spark, damage text).
2. Timed effect lifecycle and pooling.
3. Layered VFX priority rules.

Definition of done:
1. VFX are synchronized with combat log events.
2. No unbounded effect object growth over long sessions.
3. Effect cleanup is deterministic after event completion.

### Step 8: Picking and Hit Testing
Items to implement:
1. Tile picking from cursor in isometric projection.
2. Entity picking with priority (UI > actor > prop > tile).
3. Hover/selection dispatch contract to input module.

Definition of done:
1. Clicked tile/entity matches visual target in dense scenes.
2. Picking remains accurate under zoom/pan.
3. Priority rules are deterministic and documented.

### Step 9: Performance and Diagnostics
Items to implement:
1. Frame timing instrumentation (CPU/GPU timings where possible).
2. Draw-call and texture memory diagnostics.
3. Performance guardrails and fallback quality settings.

Definition of done:
1. Renderer meets FPS targets in vertical slice scenarios.
2. Diagnostics panel shows live metrics for debugging.
3. Quality fallback can be switched at runtime.

### Step 10: Integration Hardening
Items to implement:
1. Integration test checklist for movement/combat/dialogue transitions.
2. Recovery behavior for missing assets or malformed render data.
3. Cleanup and lifecycle stress checks (scene reload, save/load re-entry).

Definition of done:
1. No blocker visual regressions in core loop.
2. Missing assets fail gracefully with placeholders.
3. Re-entering scenes does not duplicate render objects.

## 5. Rendering Module Final Definition of Done
1. Fully event-driven renderer with zero gameplay rule ownership.
2. Stable isometric depth ordering and accurate picking.
3. Path/selection/combat overlays are production-usable.
4. Meets agreed FPS and draw-call budgets on target hardware.
5. Clean lifecycle and no critical leaks across long play sessions.
