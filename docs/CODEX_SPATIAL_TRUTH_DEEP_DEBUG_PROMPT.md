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

## Addendum — World-anchored curved ocean patterns and altitude-aware speed

**Owner's intent:** The sea should read as a coherent, beautiful moving ocean, not a set of straight vertical lines that track the player/camera or appear to rise with the ship. Sea marks should describe **curved wave-crest arcs** that belong to the ocean surface. Speed should be conveyed when the ship passes over and leaves those forms behind. Low scenic cruising, middle-altitude fast flight, higher expansive flight and planetary overview must have visually distinct, mathematically consistent representations of the **same geography**. This applies to Current, Bigger and Massive; do not exempt the expansive world. Keep the effect enjoyable, obvious at speed, and inexpensive on the owner's 4 GB computer.

### A. Investigate the actual current implementation before replacing it

Audit `src/ocean-speed-cues.js`, `src/ocean-speed-style.js`, `src/horizon.js`, `src/terrain.js`, `src/flight-model.js`, `src/scale-world.js`, and their callers. The existing bright marks are finite straight segments, seeded by world cells, aligned to heading and displayed from a moving sampling patch. They may be world-coordinate-seeded but still **look** like lines that follow the camera because every mark is rebuilt relative to ship heading/position and only its straight projected shape is shown. Determine empirically which aspects cause the reported unnatural effect. Do not simply increase the existing line count, opacity or length.

### B. Establish a coherent mathematical surface representation

Build a minimal, documented ocean-mark field `C(s,t)` in **authoritative 2D ocean coordinates**, with a stable world-space anchor and deterministic seed. Represent each visible mark as a short, gently curving crest/contour using a quadratic or cubic Bézier, a short sampled sinusoidal arc, or an equally cheap parametrization **chosen after measuring visual quality and GPU/CPU cost**. A Bézier is an option, not a requirement. The important invariant is a locally coherent crest shape and direction field: neighboring arcs should suggest connected wave bands or plausible irregular families of ripples rather than independent random scribbles. Use low-frequency, world-anchored phase/orientation variation and deterministic bounded jitter; avoid identical repeated arcs and abrupt changes at procedural cell boundaries.

Specify how `C(s,t)` maps into the terrain/ocean's *actual visible projected surface* `P(C(s,t))`: do not bend only the arc endpoints and connect them with a single screen-space chord across a curved world. Tessellate sparingly at a world-scale- and screen-error-aware rate (or use an equivalent cheap GPU approach), then apply the **identical curvature/globe transform and floating-origin contract** as the real ocean. Add a small documented water-surface clearance to avoid z-fighting, without letting arcs float above the sea. Surface marks must be hidden behind the planet, masked/excluded where authoritative land occupies the surface, and bounded at seams and horizons. Explicitly distinguish physical water motion (if any) from the ship's movement; never move the water pattern with camera ascent or rotate all wave marks when the player changes heading.

Use stable semantic/wrapped world coordinates so patterns persist while crossing local cells and world seams, including Massive. If a planet projection is not injective at the far side, discard hidden/unprojectable marks; do not let a crest jump from the front of the globe to the rear. Clarify any approximation necessitated by the current visual-only, flat-authoritative-to-curved-render world model.

### C. Get speed from optical flow, not fake line motion

The apparent velocity of a crest must follow from its anchored world location, the ship/camera's **actual** translational and rotational movement, projection, and perspective. At a fixed camera and ship coordinate, a crest should remain in the same rendered place (apart from explicitly modeled subtle water motion). Ascending while hovering must not create streaks marching toward the player or vertically stretching to imply forward travel. As the ship flies forward, near crests should expand/pass through the foreground and recede **behind** the viewpoint naturally; far crests should shift more slowly. Turning should change the viewed direction, not spin the entire sea field as if it were a HUD decoration.

Small speed-adaptive embellishments are acceptable (e.g., short secondary directional wakes/elongation, luminance and density contrast) **only when measured forward travel actually occurs**, tied to already-sampled world crests rather than independent camera-aligned screen lines. Maintain the distinction between a water surface wave crest, a separate ship wake if implemented, and existing peripheral airflow effects. If a crest's projected direction becomes nearly vertical from the current camera angle, that should be a consequence of projection, not an intrinsic fixed vertical stripe.

### D. Four altitude bands with continuous, meaningful differences

Define a **continuous profile**, not four hard visual swaps, expressed in normalized atmospheric altitude, actual displacement speed, camera mode, FOV and world-scale parameters. Provide distinct artistic goals and explicit measurable constraints:

- **Low / scenic cruise:** recognizable short, varied curved crests and shore-adjacent water texture; restrained motion, bright enough against blue to read during forward cruising; near-field parallax should dominate.
- **Middle / active acceleration:** stronger near-versus-far movement, slightly longer or more legible curved crests, varied spacing and contrast so flybys visibly reward acceleration without turning the sea into a vertically striped conveyor belt.
- **High / expansive:** wider-spacing, larger geographic crest families and less fine detail; coherent perspective and movement beneath/around the pilot, retaining scale and smooth speed perception while the camera tilts and the planet begins to curve.
- **Top / planetary:** simplify into broader, sparse world-anchored curved bands, arc fragments and tonal structure that adhere to globe projection. Do not show tiny close-up streaks the size of continents; keep the planet readable, avoid lines bleeding through the far hemisphere, and respond naturally to orbital camera movement.

Crossfade/resample by **projected pixel footprint and stable world identity** with hysteresis or other anti-popping measures. A low/high LOD representation should describe the same underlying sea field rather than regenerating a different random pattern on every altitude boundary. Changes in elevation alone may alter apparent shape/scale as a normal projection effect; any additional band-specific change should have a documented reason and must not teleport marks.

### E. Low-resource implementation requirements

Use a fixed, modest budget of reusable curve/control-point data and a **bounded, pooled** render representation. Prefer a single/few draw calls with shared material/uniforms and small geometric or shader cost. Never allocate a 16,000 × 16,000 ocean texture/grid, create/remove meshes per crest each frame, introduce a second globe or copy high-resolution ocean geometry. Avoid generating new random seeds and doing many full CPU tessellation/projection passes on every frame. Cache stable crest controls and update the visible window/chunks only when crossing an appropriate world-space boundary or changing required LOD; all interpolation and shader updates must stay cheap. Use screen-space-error-bounded tessellation so curves remain curves on the globe without an excessive vertex count.

WebGL implementations do not reliably honor large `LineBasicMaterial.linewidth`; if width/contrast is necessary, evaluate a tiny fixed-width ribbon or shader approach against a genuinely profiled cost. Preserve sea/land depth testing and avoid shimmering, far-side visibility, heavy transparency, aliasing and clutter. Measure draw calls, vertex count, per-frame allocations, CPU update cost, GPU frame time where practical and actual browser FPS/memory on a 4 GB device. Set and document acceptance thresholds relative to the current V9 baseline rather than asserting the new solution is free.

### F. Make the patterns fully observable to agents and Deep Debug

Integrate into the **Spatial Truth & Deep Diagnostics** contract above. Each sampled crest/arc family should have a stable ID; expose its seed, authoritative ocean-world anchor, control points, source coordinate space, LOD, world-scale profile, model/world/render transforms (as applicable), final curved-surface points, and camera/viewport-projected center and bounds. Record the current visible-cell/chunk ID, physical wave-motion phase if one exists, camera pose/FOV, altitude mood, real ship velocity, style parameters and physical-versus-displayed positions.

In **Performance** mode, do not perform diagnostic readbacks or per-crest trace serialization. In **Debug**, sample only aggregate sea-effect state and anomalies at low rate. In **Deep Debug**, permit a selected crest and a bounded region to be traced across ascent, forward travel, heading changes and world seams, with structured JSONL reason codes for creation/recycling, LOD changes, clipping, near/far-side rejection and nonphysical discontinuities. An agent should be able to answer: “Did this crest actually move, was it resampled/recycled, did the camera projection change, or did the ship fly past it?” using recorded transforms and events, not conjecture.

### G. Regression and visual acceptance

Add deterministic tests for curve control-point continuity, world anchoring across cell/seam boundaries, same-source-crest behavior across LODs, no camera-heading-dependent sea rotation, zero-forward-travel hovering/ascending, physical forward and reverse displacement, and curved projection alignment with the existing ocean on Current/Bigger/Massive. Include near/far clipping, far-hemisphere rejection, shore masking, low-to-top altitude and both Forward/Overview cameras. Test no frame-by-frame random replacement, bounded buffers and near-zero diagnostics work in Performance mode.

Inspect real browser captures/replays from a **low scenic cruise → fast middle-altitude flight → climb while hovering → high-speed expansive journey → planetary overview → descent**. At every stage the viewer should see coherent curved surface marks; on ascent they should recede/foreshorten, **not climb with the camera**; at speed they should naturally pass under/behind the ship. Review both visual realism and the subjective feeling of speed. Numerical tests alone cannot prove either. Mark browser/4 GB device validation honestly as pending if not performed.

**Scope and integration:** Implement this as part of the existing V9 Codex task while retaining the ship/camera continuity and deep-debug goals above. Preserve the prior functioning small-world flight behavior, semantic terrain, and physics. Commit only to `feature/cinematic-speed-perception-v9`; do not modify or merge into `main`.
