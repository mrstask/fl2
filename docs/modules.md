# Ashfall Frontend Modules

## 1. `app-shell`
- Responsibility: app bootstrap, routing, settings, save-slot selection, top-level error boundaries.
- Inputs: user session, config, content pack metadata.
- Outputs: active game session context.

## 2. `rendering`
- Responsibility: isometric map and actor rendering, camera, selection highlights, VFX.
- Tech: PixiJS scene and layers.
- Depends on: `movement`, `combat`, `world-state`.

## 3. `input`
- Responsibility: mouse/keyboard mapping to gameplay intents (move, interact, attack, open UI).
- Depends on: `movement`, `interaction`, `combat`.

## 4. `movement` (Phase 1)
- Responsibility: Fallout-like click-to-move on isometric grid, pathfinding, movement stepping.
- Depends on: `navigation-grid`.
- First implementation target.

## 5. `navigation-grid`
- Responsibility: walkability, occupied tiles, LOS helpers, path-cost queries.
- Shared by: `movement`, `combat`, `ai`.

## 6. `interaction`
- Responsibility: object/NPC interaction resolution (distance checks, interaction queues).
- Depends on: `movement`, `dialogue`, `loot`.

## 7. `character-core`
- Responsibility: stats, skills, derived attributes, traits/perks.
- Shared by: `combat`, `dialogue-checks`, `inventory`.

## 8. `inventory-itemization`
- Responsibility: inventory containers, equipment slots, item usage, stack rules.

## 9. `combat`
- Responsibility: AP turn loop, hit/damage formulas, status effects, combat event stream.
- Depends on: `character-core`, `navigation-grid`.

## 10. `dialogue-checks`
- Responsibility: dialogue graph runtime, condition evaluation, skill checks.
- Depends on: `character-core`, `quest`.

## 11. `quest`
- Responsibility: quest stage machine, objective tracking, consequence triggers.
- Depends on: `world-state`.

## 12. `faction-reputation`
- Responsibility: faction values, hostility thresholds, settlement relationship effects.
- Depends on: `world-state`.

## 13. `ai`
- Responsibility: utility-based NPC decisions for exploration and combat.
- Depends on: `navigation-grid`, `combat`, `character-core`.

## 14. `world-state`
- Responsibility: global/location flags, NPC state snapshots, day-cycle updates.
- Depends on: `save-load`.

## 15. `save-load`
- Responsibility: IndexedDB saves, versioned migrations, data integrity checks.

## 16. `content-runtime`
- Responsibility: content file loading and JSON schema validation.
- Used by all runtime gameplay modules.

## 17. `ui`
- Responsibility: React UI (HUD, inventory, journal, character screen, dialogue UI).
- Depends on domain modules via typed interfaces/events only.

## 18. `audio`
- Responsibility: SFX/music playback, mixer groups, area-based transitions.

## Recommended Build Order
1. `content-runtime`
2. `navigation-grid`
3. `movement`
4. `rendering` + `input` (minimal playable loop)
5. `interaction`
6. `character-core` + `inventory-itemization`
7. `combat`
8. `dialogue-checks` + `quest`
9. `faction-reputation` + `world-state`
10. `save-load`, `ui`, `audio`, `ai` hardening
