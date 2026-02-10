# Obstacle and Navigation Feature Plan

## Goal
Implement robust movement around dynamic and static blockers:
- NPC/player bodies (dynamic blockers)
- Walls (static blockers)
- Doors (stateful blockers: open/closed/locked)

## Step 1: Navigation Data Model
Implement:
1. Tile flags: `walkable`, `blocks_los`, `terrain_cost`.
2. Obstacle entities: `wall`, `door`, `body`.
3. Door state model: `open`, `closed`, `locked`.
4. Occupancy map for dynamic blockers (player/NPC bodies).

Definition of done:
1. All obstacle types have runtime representation.
2. Door state changes can update passability at runtime.
3. Navigation layer can answer: `isWalkable(tile)` and `movementCost(tile)`.

## Step 2: Pathfinding with Obstacles
Implement:
1. Pathfinding reads static + dynamic blockers.
2. Diagonal corner-cut prevention (cannot pass between two blocked orthogonal neighbors).
3. Cost-aware routing (prefer normal tiles over high-cost tiles).
4. Optional target fallback (nearest reachable tile if destination blocked).

Definition of done:
1. Paths never cross blocked walls/closed doors/bodies.
2. Corner clipping is prevented.
3. Fallback finds nearest valid tile when target is blocked.

## Step 3: Dynamic Re-Path and Movement Resolution
Implement:
1. Movement command reservation (avoid two actors claiming same next tile).
2. Re-path when next step becomes blocked.
3. Fail-safe cancel when no route exists.
4. Movement events for blockers (`blocked`, `repath_started`, `repath_failed`).

Definition of done:
1. Moving actors do not overlap bodies.
2. Actor can recover from temporary block by rerouting.
3. Movement stops cleanly with user feedback when impossible.

## Step 4: Walls and Doors Runtime Behavior
Implement:
1. Walls as permanent non-walkable blockers.
2. Doors as interactive objects with open/close state.
3. Door interactions:
- open if unlocked
- fail if locked without key/skill
4. Door state updates pathfinding cache and overlays immediately.

Definition of done:
1. Closed doors block movement and LOS (if configured).
2. Open doors allow movement through doorway tiles.
3. Lock state is respected by interaction and movement systems.

## Step 5: UI/Feedback Layer
Implement:
1. Hover styling for blocked tiles vs walkable tiles.
2. Path preview colors:
- valid path
- blocked/invalid
- fallback destination
3. Door visual state indicator (open/closed/locked).
4. On-blocked message in HUD/debug panel.

Definition of done:
1. Player can visually understand why movement failed.
2. Door state is visible without opening debug tools.
3. Path preview always matches actual movement result.

## Step 6: Content and Scenario Setup
Implement:
1. Demo map section with:
- narrow corridors
- wall corners
- single and double doors
- body-blocked chokepoints
2. Scripted NPC patrol crossing player routes.
3. Locked door scenario with alternate route.

Definition of done:
1. At least 5 navigation edge cases are reproducible.
2. Scenario can be used by automated UI tests.

## Step 7: Door Interaction UX
Implement:
1. Explicit door interaction outcomes in HUD (`opened`, `closed`, `locked`).
2. Prevent movement command execution when door interaction is consumed.
3. Clear status reset behavior after movement/interaction transitions.
4. Closed unlocked door click triggers move-to-door interaction:
- actor paths to a valid adjacent tile first
- door opens only when actor reaches interaction range
5. Door interaction input model matches Fallout-style flow:
- hover door sets hand cursor
- click door opens action menu (`open`, `close`, `key`, `lockpick`)
- selected action executes, including approach-first behavior when out of range

Definition of done:
1. Door clicks never silently fail.
2. Door interaction feedback is unambiguous to player.
3. Clicking door does not enqueue unintended move command.
4. Closed door does not open from range; it opens only after approach completes.
5. Door action menu remains usable when moving pointer from door to menu.

## Step 8: Obstacle E2E Coverage
Implement:
1. Playwright scenarios for locked doors, open-door pass-through, and dynamic body re-path.
2. Deterministic debug hooks for non-flaky test execution.
3. Artifact screenshots for each obstacle scenario.

Definition of done:
1. Obstacle E2E suite passes in Chromium.
2. Scenarios are deterministic across repeated runs.
3. Failures provide actionable assertion output.

## Step 9: Movement Command Polish
Implement:
1. Right-click movement cancel.
2. Optional command queue while currently moving.
3. Destination marker and command acknowledgement.

Definition of done:
1. Player can cancel or replace movement predictably.
2. Queue behavior is deterministic and documented.
3. Marker matches active destination.

## Step 10: Persistence for Obstacles
Implement:
1. Save/load of door states.
2. Save/load of actor positions and patrol cursor.
3. Save/load of active movement command state.

Definition of done:
1. Reload restores obstacle state exactly.
2. Patrol resumes from persisted index.
3. No invalid paths generated after load.

## Step 11: Camera Mode Polish
Implement:
1. Follow camera mode targeting the player actor.
2. Runtime toggle between `free` and `follow` modes from HUD/debug controls.
3. Keep existing free-camera controls (`WASD`, edge scroll, middle-drag, wheel zoom) intact in free mode.

Definition of done:
1. In follow mode camera smoothly tracks player movement without jitter.
2. Mode switching is visible in HUD and scriptable from debug API.
3. Existing movement/interaction flows remain stable under both modes.
