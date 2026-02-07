# Obstacle Navigation Test Plan (TDD)

## 1. Unit Tests

### `NAV-U01` Static wall blocking
- Given a wall tile, pathfinding must not include it.
- Assert: returned path excludes blocked tile.

### `NAV-U02` Closed door blocking
- Given a closed door tile, pathfinding treats it as blocked.
- Assert: no direct path through closed door.

### `NAV-U03` Open door passability
- Given same door set to open, pathfinding can route through it.
- Assert: path includes door tile when shortest.

### `NAV-U04` Locked door interaction gate
- Attempt open on locked door without key/skill.
- Assert: door state remains locked/closed; movement blocked.

### `NAV-U05` Dynamic body occupancy
- Occupied tile by NPC body.
- Assert: pathfinding excludes occupied tile.

### `NAV-U06` Diagonal corner-cut prevention
- Two adjacent orthogonal blockers forming a corner.
- Assert: diagonal step through corner is disallowed.

### `NAV-U07` Fallback reachable target
- Destination blocked.
- Assert: nearest reachable fallback tile is returned.

### `NAV-U08` Re-path on dynamic blocker
- Path becomes blocked mid-move by NPC entering next tile.
- Assert: re-path event emitted and new valid route generated or fail event emitted.

## 2. Integration Tests

### `NAV-I01` Player routes around wall maze
- Load test map with walls.
- Command long move.
- Assert: reaches target without crossing blocked tiles.

### `NAV-I02` Door state transition updates navigation
- Closed door blocks path; open door enables shorter route.
- Assert: route length decreases after opening door.

### `NAV-I03` Two actors crossing chokepoint
- Player and NPC attempt corridor crossing simultaneously.
- Assert: no overlap; one waits or reroutes.

### `NAV-I04` Locked door alternate route
- Locked door blocks shortest path.
- Assert: actor selects alternate valid route.

### `NAV-I05` No route failure handling
- Target sealed by walls/locked doors.
- Assert: movement cancels with `repath_failed`/blocked feedback.

## 3. UI/E2E Tests (Playwright)

### `NAV-E01` Blocked tile feedback
- Hover/click blocked wall tile.
- Assert: blocked indicator appears; player does not move.

### `NAV-E02` Door toggle affects movement
- Click closed door (open action), then click behind door.
- Assert: actor passes through doorway only after open state.

### `NAV-E03` Locked door feedback
- Click locked door.
- Assert: UI shows locked message; no pass-through path.

### `NAV-E04` NPC body avoidance
- Wait until patrol NPC occupies corridor tile.
- Click destination behind NPC.
- Assert: path reroutes or waits; never overlaps NPC tile.

### `NAV-E05` Corner clipping prevention visual
- Click destination requiring illegal diagonal corner clip.
- Assert: path preview avoids clipped diagonal.

### `NAV-E06` Movement failure UX
- Click unreachable tile.
- Assert: invalid path style + blocked message + no movement.

### `NAV-E07` Deterministic debug-command pathing
- Execute movement command through debug API to closed door route.
- Assert: blocked/invalid state before door open.

### `NAV-E08` Door open then pass-through via debug command
- Open closed door via interaction/debug command.
- Re-issue movement command behind door.
- Assert: player reaches destination and status resolves to arrived.

### `NAV-E09` Locked door rejects transition
- Attempt interaction with locked door.
- Assert: state remains locked and movement remains blocked.

### `NAV-E10` Patrol-induced re-path
- Start movement along corridor while patrol NPC crosses.
- Assert: `repathing` or fallback status appears before arrival.

## 4. Test Data Requirements
1. Test map fixture with deterministic coordinates for:
- walls
- doors (open/closed/locked)
- chokepoints
- alternative routes
2. Deterministic NPC patrol script for repeatable body blocking.
3. Stable `data-testid` hooks:
- `blocked-indicator`
- `door-state-label`
- `movement-status`
- `path-preview-state`

## 5. Exit Criteria
1. All unit tests `NAV-U01..U08` pass.
2. All integration tests `NAV-I01..I05` pass.
3. All UI tests `NAV-E01..E06` pass in Chromium CI.
4. No actor overlap or illegal tile crossing observed in recorded runs.
