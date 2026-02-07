# Rendering Module Technical Task Breakdown

This backlog splits each rendering step into smaller technical tasks that can be implemented separately.

## Conventions
- Task ID format: `RND-XX-YY` where `XX` is the step and `YY` is the task index.
- Each task includes dependencies and its own definition of done.
- Scope rule: rendering tasks must not implement gameplay rules.

## Step 1: Rendering Contracts

### `RND-01-01` Define render domain DTOs
- Goal: define typed payloads for render world snapshots, entities, tiles, overlays, and events.
- Deliverable: contract spec for `RenderWorld`, `RenderTile`, `RenderEntity`, `RenderOverlay`, `RenderEvent`.
- Dependencies: none.
- Definition of done:
1. Every renderable element has a typed shape and required fields.
2. Optional fields are explicitly documented with defaults.
3. No combat/quest decision logic appears in contracts.

### `RND-01-02` Define event taxonomy for renderer
- Goal: define renderer-consumable event types and payload schemas.
- Deliverable: event list (`move_started`, `step_reached`, `attack_fired`, `hit_resolved`, `entity_died`, etc.).
- Dependencies: `RND-01-01`.
- Definition of done:
1. Event payloads are stable and versioned.
2. Every event has a source and timestamp/frame index field.
3. Unsupported/unknown events have documented fallback behavior.

### `RND-01-03` Define layer and draw-order contract
- Goal: lock layer stack and z-order rules.
- Deliverable: layer contract (`ground`, `props`, `actors`, `overlays`, `vfx`, `ui_overlay`) + sorting formula.
- Dependencies: `RND-01-01`.
- Definition of done:
1. Layer order is immutable at runtime unless explicitly configured.
2. Actor depth ordering rule is deterministic.
3. Tie-break rule is documented for equal-depth objects.

### `RND-01-04` Define asset and atlas conventions
- Goal: normalize sprite naming, directional variants, and atlas packing expectations.
- Deliverable: asset key naming spec and atlas metadata format.
- Dependencies: `RND-01-03`.
- Definition of done:
1. Naming pattern covers terrain, actors, props, FX, and overlays.
2. Missing asset fallback key is defined.
3. Atlas metadata schema is validated by content pipeline.

## Step 2: Scene and Layer System

### `RND-02-01` Create scene lifecycle spec
- Goal: define `init`, `mount`, `tick`, `resize`, `dispose` lifecycle for renderer scene.
- Deliverable: scene lifecycle sequence diagram/spec.
- Dependencies: `RND-01-03`.
- Definition of done:
1. Lifecycle order is explicit and testable.
2. Re-mount behavior is defined.
3. Disposal ownership for textures/containers/listeners is explicit.

### `RND-02-02` Define layer container ownership
- Goal: map each logical layer to a dedicated render container with ownership rules.
- Deliverable: layer/container ownership table.
- Dependencies: `RND-02-01`.
- Definition of done:
1. Each layer has a single owner system.
2. Mutation rules are documented (who can add/remove children).
3. Cross-layer writes are disallowed by contract.

### `RND-02-03` Specify isometric z-sort algorithm
- Goal: define stable depth sort based on grid coordinates and actor height.
- Deliverable: sort formula, tie-break fields, update trigger rules.
- Dependencies: `RND-01-03`.
- Definition of done:
1. Algorithm handles tall props and overlapping footprints.
2. Sort update triggers are bounded (no per-frame full re-sort by default).
3. Worst-case complexity is documented.

## Step 3: Camera System

### `RND-03-01` Define camera state model
- Goal: define camera state and constraints (`x`, `y`, `zoom`, bounds, mode).
- Deliverable: camera state schema and transition rules.
- Dependencies: `RND-01-01`.
- Definition of done:
1. All camera modes are enumerated (`free`, `follow`, `locked_transition`).
2. Numeric ranges and defaults are documented.
3. Invalid state correction strategy is defined.

### `RND-03-02` Define camera behavior specs
- Goal: define pan/zoom/clamp/follow smoothing behavior.
- Deliverable: behavior spec with formulas for smoothing and clamp logic.
- Dependencies: `RND-03-01`.
- Definition of done:
1. Pan/zoom input mapping is deterministic.
2. Follow smoothing parameters are configurable.
3. Jitter prevention rule is included.

### `RND-03-03` Define coordinate conversion contract
- Goal: define camera-aware `worldToScreen` and `screenToWorld` accuracy requirements.
- Deliverable: conversion spec and precision tolerance.
- Dependencies: `RND-03-01`.
- Definition of done:
1. Round-trip tolerance threshold is documented.
2. Conversion behavior under zoom extremes is defined.
3. Conversion API is independent of UI framework.

## Step 4: Tilemap Rendering

### `RND-04-01` Define chunking strategy
- Goal: partition map into chunks and define load/unload policy.
- Deliverable: chunk size, neighborhood policy, prefetch radius.
- Dependencies: `RND-02-01`.
- Definition of done:
1. Chunk dimensions and boundaries are fixed.
2. Unload safety rule prevents visible tile gaps.
3. Streaming thresholds are measurable.

### `RND-04-02` Define tile batching model
- Goal: specify atlas-based tile rendering and batch grouping rules.
- Deliverable: batch grouping rules by texture/material/layer.
- Dependencies: `RND-01-04`.
- Definition of done:
1. Batch key schema is documented.
2. Dynamic and static tile handling is separated.
3. Draw-call budget target per scene is declared.

### `RND-04-03` Define culling policy
- Goal: define view-frustum and margin culling for chunks/sprites.
- Deliverable: culling boundaries and update cadence.
- Dependencies: `RND-04-01`.
- Definition of done:
1. Offscreen content culling margins are documented.
2. No visible pop-in during standard camera movement.
3. Culling checks stay within target CPU budget.

## Step 5: Actor Rendering

### `RND-05-01` Define actor visual state machine
- Goal: define renderer-facing actor states (idle, walk, attack, hit, death, downed).
- Deliverable: actor animation state transition table.
- Dependencies: `RND-01-02`.
- Definition of done:
1. Transition triggers map to event types.
2. Interrupt and priority rules are explicit.
3. Fallback state exists for missing animations.

### `RND-05-02` Define directional sprite policy
- Goal: define facing direction quantization and sprite selection.
- Deliverable: direction buckets (4/8 dirs), naming map, mirroring rules.
- Dependencies: `RND-01-04`.
- Definition of done:
1. Direction-to-asset mapping is deterministic.
2. Mirroring constraints are documented per asset type.
3. Facing update cadence avoids rapid flicker.

### `RND-05-03` Define actor attachment points
- Goal: define anchor points for shadows, selection rings, held weapons, hit markers.
- Deliverable: attachment specification per actor archetype.
- Dependencies: `RND-05-01`.
- Definition of done:
1. Anchors are tile-aligned across zoom levels.
2. Shadow and ring offsets are data-driven.
3. Missing anchor fallback behavior is defined.

## Step 6: Overlay Rendering

### `RND-06-01` Define highlight overlay model
- Goal: specify hover/selection tile overlays and styling tokens.
- Deliverable: overlay data schema and visual style table.
- Dependencies: `RND-01-01`.
- Definition of done:
1. Hover and selected states are visually distinct.
2. Color/style values meet readability constraints.
3. Overlay update latency target is defined.

### `RND-06-02` Define path preview overlay
- Goal: specify path line/step markers/AP annotations from movement previews.
- Deliverable: path overlay contract and render rules.
- Dependencies: `RND-06-01`, `RND-01-02`.
- Definition of done:
1. Path nodes map 1:1 to preview tiles.
2. AP cost display rule is deterministic.
3. Invalid path state rendering is defined.

### `RND-06-03` Define tactical overlays
- Goal: specify LOS, cover, range, and interaction radius overlays.
- Deliverable: tactical overlay taxonomy and priority rules.
- Dependencies: `RND-06-01`.
- Definition of done:
1. Overlay stacking priority is documented.
2. Toggle flags are defined for each overlay category.
3. Mutual conflicts (visual clutter) have resolution rules.

## Step 7: Event-Driven VFX

### `RND-07-01` Define event-to-VFX mapping table
- Goal: map render events to effect templates and parameters.
- Deliverable: mapping table with default timing and layer.
- Dependencies: `RND-01-02`, `RND-01-04`.
- Definition of done:
1. Every combat event has either an effect or explicit no-effect rule.
2. Effects include spawn position source and lifetime.
3. Unknown event handling is defined.

### `RND-07-02` Define VFX lifecycle and pooling strategy
- Goal: define allocation/pooling/reuse for transient effects.
- Deliverable: pooled effect lifecycle spec.
- Dependencies: `RND-07-01`.
- Definition of done:
1. Pool warm-up and max pool size are defined.
2. Recycle conditions are deterministic.
3. Leak detection counters are specified.

### `RND-07-03` Define layered VFX order and blending
- Goal: specify where each effect category renders and with which blend mode.
- Deliverable: VFX layering matrix and blend policy.
- Dependencies: `RND-01-03`.
- Definition of done:
1. Effects cannot render above forbidden layers by mistake.
2. Blend mode defaults and overrides are documented.
3. Stacked effect readability is validated.

## Step 8: Picking and Hit Testing

### `RND-08-01` Define tile picking algorithm contract
- Goal: define cursor-to-isometric-tile picking rules and tolerance.
- Deliverable: picking algorithm spec including edge-tile behavior.
- Dependencies: `RND-03-03`.
- Definition of done:
1. Picking rule for tile boundaries is deterministic.
2. Zoom-aware tolerance is documented.
3. Out-of-map picking behavior is defined.

### `RND-08-02` Define entity hit-test priority contract
- Goal: define priority chain for UI, actors, props, and ground picks.
- Deliverable: hit-test priority rules and masks.
- Dependencies: `RND-08-01`.
- Definition of done:
1. Priority order is fixed and testable.
2. Occlusion and hidden entity rules are explicit.
3. Tie-break behavior is deterministic.

### `RND-08-03` Define dispatch contract to input module
- Goal: define rendering output events for hover/select/click and payload shape.
- Deliverable: renderer-to-input dispatch API spec.
- Dependencies: `RND-08-02`.
- Definition of done:
1. Event payload includes target type and stable ID.
2. Debounce/throttle rules are documented.
3. Event ordering guarantees are defined.

## Step 9: Performance and Diagnostics

### `RND-09-01` Define performance budget sheet
- Goal: set measurable budgets for FPS, frame time, draw calls, texture memory.
- Deliverable: rendering budget baseline by scenario.
- Dependencies: none.
- Definition of done:
1. Budgets exist for idle hub, movement, and combat-heavy scenes.
2. Measurement method/tool is specified.
3. Pass/fail threshold for CI or QA is documented.

### `RND-09-02` Define runtime diagnostics contract
- Goal: define metrics and debug panel fields.
- Deliverable: diagnostics schema (`fps`, `frame_ms`, `draw_calls`, `texture_mb`, `active_fx`, etc.).
- Dependencies: `RND-09-01`.
- Definition of done:
1. Metrics refresh cadence is defined.
2. Sampling window rules are documented.
3. Diagnostic export format is specified.

### `RND-09-03` Define adaptive quality policy
- Goal: define quality degradation rules when budgets are exceeded.
- Deliverable: policy table for effects, shadows, overlay detail, update rates.
- Dependencies: `RND-09-01`, `RND-09-02`.
- Definition of done:
1. Trigger thresholds and hysteresis are defined.
2. Quality tiers have deterministic settings.
3. Recovery policy prevents oscillation.

## Step 10: Integration Hardening

### `RND-10-01` Define integration scenarios matrix
- Goal: enumerate critical rendering flows across movement/combat/dialogue/save-load.
- Deliverable: scenario matrix with expected visual results.
- Dependencies: steps 1-9 task specs.
- Definition of done:
1. Critical path scenarios are fully listed.
2. Each scenario has pass/fail visual checkpoints.
3. Ownership for validation is assigned.

### `RND-10-02` Define error and fallback handling
- Goal: define behavior for missing assets, malformed payloads, stale references.
- Deliverable: fallback policy and user/dev-facing error surfaces.
- Dependencies: `RND-01-04`.
- Definition of done:
1. Placeholder rendering path is documented.
2. Error severity levels and logging contract are defined.
3. Recovery action is specified per error class.

### `RND-10-03` Define lifecycle stress-test protocol
- Goal: define repeated mount/unmount, scene transitions, and save/load re-entry checks.
- Deliverable: stress protocol with leak and duplication checks.
- Dependencies: `RND-02-01`, `RND-09-02`.
- Definition of done:
1. Repetition counts and duration are specified.
2. Leak indicators and acceptable thresholds are documented.
3. Failure triage checklist is included.

## Final Exit Criteria for Rendering Module
1. All tasks `RND-01-*` through `RND-10-*` are marked complete.
2. No unresolved high-severity issues in layering, picking, or lifecycle stability.
3. Renderer remains event-driven and isolated from gameplay decision logic.
4. Performance budgets are met in all baseline scenarios.
