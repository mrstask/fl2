# Ashfall: Wastes of Orion - Technical Description (Frontend App)

## 1. Technical Goals
- Build a deterministic, data-driven, isometric turn-based RPG that runs in a web browser.
- Keep gameplay logic framework-agnostic and separate from rendering/UI.
- Support high quest branching and world reactivity via external content data.
- Enable fast iteration with strong tooling, validation, and hot reload.

## 2. Proposed Tech Stack
- App framework: React 18 + TypeScript
- Renderer: PixiJS 8 (isometric map, sprites, combat overlays)
- Build tool: Vite
- State management: Zustand (UI/session state) + pure domain store for game simulation
- Data format: JSON for content, JSON Schema for validation
- Persistence: IndexedDB (primary saves) + localStorage (settings)
- Testing: Vitest (unit), Playwright (E2E)
- Version control: Git + Git LFS (art/audio)
- Build targets: modern desktop browsers first (Chrome/Edge/Firefox), then mobile/tablet adaptation

## 3. High-Level Architecture
1. App Shell Layer
- React routing, screen composition, menu flow, settings, error boundaries
- Bootstraps content packs and save profiles

2. Game Domain Layer (pure TS)
- Deterministic simulation: stats, quests, combat, reputation, RNG
- No direct DOM or renderer dependencies
- Emits typed game events for UI and renderer

3. Rendering Layer
- Pixi scene graph for world tiles, actors, VFX, LOS overlays, interaction markers
- Camera controls, map chunk loading, combat visualization

4. Content Layer
- JSON definitions for locations, quests, NPCs, items, dialogue
- Validation pipeline and ID/reference integrity checks

5. Infrastructure Layer
- Save/load service (IndexedDB), audio manager, input mapper, telemetry hooks

## 4. Core Modules
## 4.1 Entity and Character Model
- Stable entity IDs (UUID or content-stable IDs).
- Components:
  - `StatsComponent`
  - `SkillsComponent`
  - `InventoryComponent`
  - `StatusEffectComponent`
  - `FactionComponent`
  - `AIComponent` (NPC only)

Derived stats:
- Max HP, AP, carry weight, crit chance, resistances, initiative

## 4.2 Combat Module
- Tile-based isometric grid with occupancy and LOS maps.
- Turn order:
  1. Roll initiative at encounter start.
  2. Process queue; reset AP at actor turn start.
  3. Execute action (move, attack, item, ability, defend).
  4. Apply reactive effects and triggered events.
  5. Rebuild/adjust queue on deaths, stuns, summons.

Hit model:
- `HitChance = BaseWeaponSkill + situational modifiers - target defense modifiers`
- Damage pipeline:
  - base weapon damage roll
  - armor threshold reduction
  - armor resistance scaling
  - critical roll/effect
  - limb/status application

Combat log:
- Structured event records for replay/debug (`combat_event_type`, `source_id`, `target_id`, `rolls`, `result`)

## 4.3 Dialogue and Checks
- Dialogue nodes are external JSON with:
  - conditions (`skill >= X`, reputation gates, quest flags)
  - effects (set flags, modify rep, grant/remove items, start combat, transition location)
- Skill checks support visible and hidden checks with deterministic outcomes based on seeded RNG.

## 4.4 Quest System
- Quest definition model:
  - `quest_id`, stages, entry conditions, fail conditions, completion conditions, rewards
- Stage transitions are event-driven via domain event bus.
- Consequence registry maps quest outcomes to world-state updates.

## 4.5 World State and Reactivity
- Global state store with scoped partitions:
  - `global_flags`
  - `location_flags`
  - `npc_state`
  - `faction_rep`
- Rule evaluator applies state changes on:
  - location load
  - in-game day rollover
  - quest stage transition

## 4.6 AI Module
- Utility-based tactical AI:
  - evaluates cover, threat, hit chance, AP efficiency
  - chooses action package (flank, focus fire, retreat, heal, suppress)
- Behavior profiles per archetype (raider, sniper, brute, medic, robot)

## 5. Data Contracts (Initial)
## 5.1 Item Schema
- `item_id`, `type`, `stackable`, `value`, `weight`, `tags`
- For weapons: `damage`, `range`, `ap_cost`, `ammo_type`, `burst`, `crit_mod`
- For armor: `armor_threshold`, `armor_resistance`, `slot`

## 5.2 NPC Schema
- `npc_id`, `name`, `faction`, `base_stats`, `skills`, `inventory`, `dialogue_root`, `ai_profile`

## 5.3 Quest Schema
- `quest_id`, `title`, `giver_id`, `stages[]`, `outcomes[]`, `reputation_effects[]`

## 6. Save/Load Design (Web)
- Save format: versioned JSON snapshots of domain state.
- Storage:
  - IndexedDB for save slots and metadata
  - localStorage for user settings and lightweight flags
- Save slots contain:
  - player/companion state
  - quest states
  - world flags and faction values
  - current location + entity snapshots
- Migration strategy:
  - each save includes `save_version`
  - migration functions upgrade older saves at load time

## 7. Tooling and Pipelines
- Content validation scripts:
  - JSON Schema validation
  - reference integrity checks (IDs, dialogue links, quest transitions)
  - duplicate ID detection
- Dev tools:
  - debug overlay (turn order, AP, chance to hit)
  - quest/flag inspector panel
  - deterministic seed controls for repro
- CI checks:
  - typecheck, lint, unit tests
  - content validation
  - E2E smoke test (boot, new game, save, load)

## 8. Performance and Constraints
- Targets:
  - 60 FPS on mid-range desktop in exploration
  - 30+ FPS in heavy combat scenes
- Vertical slice budgets:
  - max active combatants: 20
  - max pathfinding grid: 256x256
  - max dialogue nodes per conversation: 500
- Optimization focus:
  - texture atlas usage and sprite batching
  - cached pathfinding regions
  - pooled VFX/projectiles
  - throttled UI recompute for large combat logs

## 9. Testing Strategy
- Unit tests (Vitest):
  - hit chance and damage formulas
  - AP legality and turn progression
  - quest stage transitions
- Integration tests:
  - scripted encounter completion
  - dialogue branch consequence application
  - save/load determinism checks
- E2E tests (Playwright):
  - new game flow
  - hub interaction + quest completion
  - save, reload, and state consistency

## 10. Security and Reliability
- Validate all content JSON before runtime load.
- Strict schema checks and numeric bounds for gameplay fields.
- Crash-safe save write sequence in IndexedDB transaction.
- Fallback recovery on corrupt save (quarantine slot + user notification).

## 11. Vertical Slice Technical Milestones
1. Foundation
- Vite + React + Pixi bootstrap, app shell, content loader, validation pipeline

2. RPG Core
- character stats/skills/perks, inventory, item usage, derived stat pipeline

3. Combat Slice
- grid movement, AP turns, ranged/melee attacks, basic enemy AI

4. Narrative Slice
- dialogue system, skill checks, journal, 3-5 branching quests

5. World Reactivity
- faction/reputation system, quest consequence propagation in hub state

6. Polish and Hardening
- UI pass, balance pass, regression coverage, performance optimization

## 12. Definition of Done (Vertical Slice)
- Browser-playable flow: character creation -> hub -> conflict location -> quest resolution.
- At least two non-combat quest resolutions verified.
- Save/load stable across at least one `save_version` migration.
- No blocker bugs in combat, quest progression, dialogue routing, or save integrity.
