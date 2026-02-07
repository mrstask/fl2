# Rendering UI Test Matrix (TDD Gate)

This document defines executable UI validation targets for the rendering module.
It is used by automated tests as a readiness contract before Playwright scenarios are added.

## Required Test Selectors
- `[data-testid="render-canvas"]`
- `[data-testid="fps-counter"]`
- `[data-testid="camera-zoom-value"]`
- `[data-testid="overlay-toggle-path"]`
- `[data-testid="overlay-toggle-los"]`
- `[data-testid="debug-picked-tile"]`
- `[data-testid="debug-picked-entity"]`

## Required UI Scenarios
1. `UI-RND-01` Scene bootstrap and stable layer mount.
2. `UI-RND-02` Camera pan and zoom with map bounds clamping.
3. `UI-RND-03` Click tile and validate pick accuracy.
4. `UI-RND-04` Hover + selection overlay responsiveness.
5. `UI-RND-05` Path preview rendering after target selection.
6. `UI-RND-06` Actor motion event updates sprite position without jitter.
7. `UI-RND-07` Combat event triggers VFX in correct layer.
8. `UI-RND-08` Performance panel reports FPS and draw calls.
9. `UI-RND-09` Scene dispose/remount does not duplicate render objects.
10. `UI-RND-10` Missing asset fallback renders placeholder and logs warning.

## Validation Rules
- Every scenario must include:
  - setup preconditions
  - test actions
  - expected visual outcomes
  - measurable assertion (selector, metric, or event count)
- Expected result must be deterministic and automation-safe.
