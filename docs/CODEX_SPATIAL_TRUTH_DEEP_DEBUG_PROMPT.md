# Codex implementation brief: SUBSTRATE Spatial Truth & Deep Diagnostics

**Status:** Engineering task specification, NOT an implemented feature.  
**Repository:** `thanks-cohn/Tiled-223D`  
**Work branch:** `feature/cinematic-speed-perception-v9` — remain on this branch. **Do not merge, rebase onto, push to, or otherwise modify `main`.** Do not create a new branch unless the owner explicitly requests it.

## Mission

Build first-class, mathematically rigorous and agent-readable spatial observability for a lightweight browser world engine, and use it to correct the reported 16,000 × 16,000 Massive Overview camera/ship discontinuity. A future engineer or agent must be able to establish **where an object actually is, where its rendered representation is, where each projects into the viewport, and the recorded operation that caused a change**, without guessing from a screenshot.

The user's screenshots show a specific failure: during ascent, the ship drifts forward and upward out of view, then abruptly appears in front of the camera; changing Forward/Overview/Auto can also abruptly reposition its visual representation. The prior workaround switches the ship visual between a world-positioned scene parent and camera-local presentation at an altitude/view threshold. Merely removing one threshold does NOT make the switch continuous. Preserve physical navigation, orientation, controls, ship identity and planetary composition. Current and Bigger camera modes are reported satisfactory: do not change their visual behavior.

**Prioritize mathematical correctness, explicit coordinate contracts, deterministic repros, small bounded runtime cost and honest verification over a quick visual patch.** Inspect current source and tests; some prior assistant-authored code or comments may be inaccurate. Reconcile it against real transforms.

## 1. Establish the baseline and root cause

Read `src/main.js`, `src/massive-ship-presentation.js`, `src/camera-modes.js`, `src/visual-anchors.js`, `src/horizon.js`, `src/scale-world.js`, `src/flight-model.js`, `src/ocean-speed-cues.js`, tests, `Bugs/`, and `Semantic-Bindings/`. Inspect render parentage, ship GLB bounds and origin, perspective projection, aspect ratio, FOV, near/far clipping, camera targets, camera smoothing/reinitialization, altitude normalization, floating origin, world-to-globe deformation and scale-mode remapping. Establish which behavior is a **physical relocation**, **camera movement**, **reparenting/visual transform change**, **projection change**, or **intentional presentation adjustment**. Keep a concise written finding with exact code paths and reproductions before modifying logic.

## 2. Canonical coordinate-space contract

Introduce a documented and testable spatial-math module with explicit named units and conversions for:

- Physical/authoritative global world coordinates (X/Y/Z), map-local coordinates, named parent/object coordinates, wrap coordinates and world IDs.
- Floating-origin/render coordinates and actual rendered world matrices, including nested/animated GLB transforms.
- CPU-side surface projection into visual globe/curved terrain space, clearly distinguished from physical flat gameplay coordinates; specify where shader deformation is not invertible or cannot be inferred from a mesh's CPU bounding box.
- View/camera coordinates, homogeneous clip coordinates (including clip W), normalized device coordinates, and normalized viewport coordinates **u=(ndcX+1)/2; v=(1-ndcY)/2**, top-left (0,0), center (.5,.5), bottom-right (1,1).
- CSS viewport pixels versus WebGL drawing-buffer pixels; account for canvas boundaries, device-pixel ratio, resizing and aspect ratio.
- Orientation, velocity, dimensions, bounding volumes, collision shapes, LOD and semantic object identity.

Document handedness, axis direction, matrix multiplication order, inverse projection/ray casting and limits of unprojection onto curved surfaces. Check clip W and clip/near/far/frustum status: an X/Y within the viewport is not proof of visibility. Separate frustum visibility from depth occlusion; only claim occlusion with an actual measurement, otherwise return `unknown`. Provide object-center and representative projected-bounds queries; mark approximations. Handle numerical precision, near-plane crossing, large scales, globe poles/seams and behind-camera points robustly.

**Three distinct truths must never be conflated:** (1) authoritative physical ship coordinates; (2) where those physical coordinates project through the current camera; (3) the visible ship representation's actual projected coordinates and size. If (2) and (3) differ, record the presentation policy and transform producing the difference.

## 3. Continuous Massive camera/ship composition

Fix the root mathematical cause of the jumps; do not solve by teleporting the mesh to a new fixed camera-space pose when its old projected location differs. In Massive Overview, keep the ship recognizable near the lower central viewport while preserving enough visible planet and a sense of actual piloting. On transition start, capture the **currently displayed ship's** projected center and size, the camera state, physical pilot state and render transform. Preserve the displayed center/size at the first transition frame; move smoothly toward a defined target using continuous, time-based animation with measurable screen-space displacement bounds. Subsequent mode changes must transition from the **current interpolated** state (not restart from old endpoints). Ascending and descending across altitude thresholds must not switch representations abruptly.

Separate **target** camera pose/FOV/ship composition from the **current** interpolated pose. Audit and avoid using `cameraInitialized=false` to force a mode-change snap. Do not change pilot position, yaw, speed, collision, destination map or authored geometry for visual purposes. If a camera-local representation is required, develop a continuity-preserving handoff based on the previous world matrix and measured projected pose; avoid duplicating physical/collision ship identity. Define an explicit transition state machine and stable angular-size policy for different aspect ratios and custom GLB meshes. Account for camera bank and real model orientation. Explain and test how camera-relative visuals reflect turns and how the presentation remains anchored to the real pilot's world motion.

**Scope:** Keep Current/Bigger visuals and existing Forward view unchanged. Massive-specific adjustments must be guarded accordingly. Manual Forward/Overview/Auto switches and ascent/descent on Massive must have continuous visible ship positioning. Do not make a physical world-scale change merely by toggling a view.

## 4. Agent-facing spatial truth registry

Create a versioned, read-only query surface keyed by persistent semantic ID. Initially support pilot/visible ship, camera, curved ocean/planet, terrain/islands and named floating structures; allow opt-in adapters for clouds, future 2D/2.5D sprites, rooms, portals and desktop objects. Return world ID, coordinate-space labels and units, authoritative transform (where meaningful), render transform, parent IDs, bounds/collision information (where meaningful), camera/view and viewport projection (physical and visible independently), clip/visibility status, LOD and latest recorded source of change. Distinguish entities with no authoritative world-space pose (e.g. camera-relative HUD cues) rather than inventing one.

Provide stable documented equivalents of `getObjectSpatialState(id)`, `getViewportPosition(id)`, `getCameraState()`, `getSpatialSnapshot({ids,detail})`, `getSpatialRelationship(a,b)`, `getCoordinateTransform(from,to)`, and `explainPositionChange(id,frameA,frameB)`. Implement only valid conversions; return typed errors or explicit unknowns, not guessed values. A position-change explanation must link to actual recorded events, distinguishing camera, object, world-scale, parent/LOD and projection changes. Keep registry and query costs bounded; don't serialize or matrix-update the entire scene every frame for the registry.

## 5. Three explicit runtime diagnostics modes

**Performance (default/shipping):** tracing OFF; no diagnostic polling, console spam, history, scene traversal, JSON serialization or GPU readbacks. Only the minimal normal rendering mathematics remains. Mode checks should be cheap and preferably removed from hot paths where feasible.

**Debug:** low-rate and bounded. Show authoritative X/Y/Z, heading/momentum, scale, altitude band, view choice, camera distance and ship viewport u/v. Record meaningful events (camera choice/transition, map scale, explicit spawn, render-parent change, unexpected screen discontinuity/clipping) into a bounded ring buffer; no per-frame console logging or full-scene snapshots. Suitable for the owner's 4 GB Windows device.

**Deep Debug:** explicit opt-in with per-object and on-demand whole-scene captures. Include global/map/render/view/clip/NDC/viewport positions, actual world/camera/projection matrices, bounds, camera target/FOV/near/far, floating origin, globe curvature uniforms and inputs, LOD, semantic IDs, renderer representation, transition state, velocities, and recorded causes. Allow controlled capture windows, rate limits, byte/record caps, retention expiration, and export. The machine must understand positions **relative to both physical coordinates and the viewport**, for relevant objects—not just the ship. No unbounded per-frame capture, mandatory GPU readback, or runaway memory consumption. Mark observational blind spots.

Expose a simple in-app mode selector and a lightweight optional overlay: viewport coordinate grid, physical-ship projected marker, displayed-ship marker, intended target anchor, projected bounds, clipping/behind-camera indicators and current camera-transition progress. Label all coordinate spaces; overlay must not influence geometry, camera physics or navigation. Disable all debug UI/trace work in Performance.

## 6. Machine-readable event and incident protocol

Define a versioned, unit-labeled JSONL schema for deterministic structured events: `schemaVersion`, `runId`, `frameId`, monotonic timestamp, `eventType`, semantic `objectId`, world ID, view mode, coordinate space, before/after/delta, recorded triggering operation/cause ID and relevant matrix/projection metadata. Support camera mode requested/transition start/complete, scale changes, render parent changes, spawn/teleport requests, LOD changes, clipping/viewport entry/exit, and detected discontinuities. Distinguish **physical teleport**, **intentional world-scale coordinate remapping**, and **unexpected visual jump**. Unknown or insufficiently observed causes must be `unknown`, not narrative speculation.

Provide user-triggered local JSONL export, compact reproducibility bundle and a human-readable incident report. Avoid exporting secrets or personal files; keep traces local until the user expressly shares them. Expose a small, stable, permission-appropriate read-only API for agents; do not let a world asset gain unrestricted browser, filesystem, network or desktop access merely by requesting a trace.

## 7. Tests, acceptance and performance

Add unit/integration tests for projection/inverse/ray math, homogeneous clipping, viewport aspect/resize/DPR, actual-vs-displayed poses, curvature projection, world-wrap and precision, ship bounds/GLB loading, mode/altitude transitions, rapid repeated view toggles, manual vs Auto camera, and all three world sizes. Assert that camera mode changes preserve authoritative ship coordinates/velocity and that Massive ship's **displayed** u/v and apparent size are continuous across every handoff within documented tolerances. Include regression tests based on the user's observed sequence: ascend, drift toward top, cross former threshold, switch modes repeatedly, descend and return. Log bounded machine-readable before/after traces when a test fails. Test diagnostics OFF has no history or deep inspection overhead; verify ring-buffer caps and export schema.

Run repository tests/build, inspect GitHub Actions and if supported run real browser screenshot/replay checks. Automated math tests are not proof of perceived cinematic quality. Clearly distinguish tests run, actual browser visual verification, and outstanding validation on the 4 GB computer. Preserve low-memory constraints: no second globe, giant terrain arrays, recurring scene-wide traversal in ordinary flight, unbounded diagnostics or extra full-screen effects.

## 8. Implementation quality and handoff

Work in reviewable increments with focused modules, type-checked schemas where appropriate, explicit error handling, deterministic fixtures, tests and concise comments explaining mathematical invariants. Avoid magic altitude thresholds and undocumented unit conversions. Update `Bugs/`, `Semantic-Bindings/` (human-readable explanation AND machine-readable schema), and the README's diagnostics instructions. Include an agent-facing example answering: “Ship physical coordinates unchanged, visual screen position jumped from (u0,v0) to (u1,v1) because recorded render-parent/transition event X occurred in frame Y”—but use **actual** recorded measurements, not invented examples presented as evidence.

**Do not merge anything into `main`. Commit implementation to the existing V9 branch only.** Before reporting completion, verify the branch/ref and CI results and explicitly list remaining unverified visual/device behavior.

### Delivery checklist

- [ ] Root-cause audit with reproduction and mathematically explicit findings.
- [ ] Coordinate contract, projection math and registry implemented and tested.
- [ ] Massive-only ship/camera continuity fix with no hard altitude/mode visual teleport.
- [ ] Performance / Debug / Deep Debug instrumentation, limits, controls and exports.
- [ ] Structured JSONL schema, trace queries, incident report and agent documentation.
- [ ] Unit/integration/browser checks where available; update Bugs and Semantic-Bindings.
- [ ] Work committed on V9 only; `main` untouched.
