# Codex implementation proposal: ÆXIS cinematic camera system

**Repository:** `thanks-cohn/Tiled-223D`  
**Intended branch:** `codex/diagnostics-v1-hardening`  
**Status:** Proposal / implementation handoff. Nothing in this document should be treated as already shipped.

## 0. Instructions and scope

Read `AGENTS.md`, `docs/CODEX_HANDOFF.md`, `docs/AGENT_WORLD_API_HANDOFF.md`, `docs/WORLD_API_V1.md`, and inspect the actual browser viewer, ship controls, camera code, GLB loading, world API, permissions, tests, and renderer before changing code. Follow repo conventions and identify what exists versus what is still proposed. The current browser viewer uses Three.js/plain JavaScript; do not silently assume Babylon.js, a completed native C++ renderer, generic GLB placement, a full avatar system, or a finished script runtime.

Implement a reusable, browser-first cinematic camera system, initially demonstrated on the current ship. Preserve existing ship flight, world rendering, default ship/GLB fallback, input mapping, Tiled and elevation semantics, source assets, world API invariants, actor permissions, and low-end rendering behavior. Do not rewrite the renderer or change unrelated systems. Work in small reviewable steps, with tests and truthful feature status. Do not merge without explicit creator approval.

**Creator intent:** The world should be exhilarating immediately and offer great breadth and depth: useful cinematic shot presets out of the box, easy in-world switching and preview, editable parameters through UI/programmer/agent APIs, and complete custom behavior for advanced creators. People, cars, ships, and imported objects may have distinct camera libraries while sharing the same foundation. These are camera capabilities, not a demand to implement missing vehicle/avatar mechanics in this task.

## 1. One shared camera model

A camera definition has a stable ID (independent of its label), semantic shot name, associated entity/rig, original preset, editable current configuration, active follow reference, active look-at target, projection/lens properties, smoothing/transition settings, operating mode, optional Liquid script reference, version, and derived modification status. Separate the authored/serialized camera definition from the renderer-specific instantiated Three.js camera and from the evaluated per-frame pose.

Use explicit coordinate/unit conventions: ship-relative `forward` positive toward nose, `right` positive toward starboard, `up` positive above; negative values reverse those directions. The viewer's world position may use X/Z horizontal and Y vertical; adapt at the boundary. Initial user-facing distances are feet, with an explicit conversion to engine world units—do not assume one foot equals one world unit. Orientation uses degrees in the UI and a documented conversion to internal units. Declare whether pitch/yaw/roll are absolute relative orientation or offsets from the computed look-at orientation. Track a stable ship aim-point, preferably configured anchor/center, without assuming the GLB origin is its visible center.

A camera can follow one object yet look at a different object. Neither the camera's follow rig nor its look target may be conflated with the currently controlled entity. Persist the definitions and restore them across project save/reload using a versioned, renderer-independent schema where the project's current persistence model supports this; document any unavailable persistence integration.

## 2. Six initial ship presets

All six start with **automatic Look at Ship = true** and remain individually configurable. Preset offsets are relative to the ship frame and the ship's configured aim point. Their labels initially have the exact suffix `(Customizable)`:

| Semantic shot name | Forward | Right | Up | Aim and visual intention |
| --- | ---: | ---: | ---: | --- |
| Rear Chase | -15 ft | 0 | 0 | Centered view from directly behind looking at ship; clean chase shot |
| Front Portrait | +15 ft | 0 | 0 | Directly ahead, centered, looking backward at ship; symmetrical frontal shot |
| Low Front Fisheye | +10 ft | 0 | -2 ft initial tunable suggestion | Ahead and slightly below, looking back and upward toward ship, with actual fisheye distortion or explicit fallback |
| High Front Left | +15 ft | -10 ft | +14 ft | Ahead, above and to ship's left, looking down at ship |
| High Front Right | +15 ft | +10 ft | +14 ft | Mirrored high-right angle looking down at ship |
| Overhead | 0 | 0 | +20 ft | Exactly above, centered, looking straight down at ship |

The creator specified “slightly below” but not a precise vertical distance for Low Front Fisheye; -2 ft is an **implementation starting suggestion**, not an immutable creator-approved measurement. All distances, orientation, projection and behavior values are editable.

Preserve or provide a sensible initial main camera and next-camera preview selection. Do not reinterpret “rear” as an absolute-world rear direction; all six are ship-relative. Consider follow smoothing and obstacle avoidance without sacrificing the requested compositions; collision handling must not silently disable targeting.

## 3. Exact semantic naming contract

Display `<Semantic Shot Name> (Customizable)` while all relevant current values match the original preset. Once **any** preset parameter or operating mode differs, display `<Semantic Shot Name> (Modified)`. **Replace**, never append, the suffix: do not show `(Customizable) (Modified)`, and do not rename the semantic shot itself on an ordinary edit. If all original values and the original operating mode are restored, return to `(Customizable)`. Keep the ID stable through renames/edits; derive modified state by normalized comparison rather than tracking whether an edit happened historically. Floating-point comparisons should be robust to unit conversions and harmless serialization round trips. A creator may explicitly rename a shot, independently of its ID and status suffix. Apply naming consistently in selectors, preview captions, API inspection and after reload.

## 4. Standard mode: UI and precise API

Expose UI controls and equivalent typed programmer/agent operations for:
- Set absolute or adjust relative offsets: forward/back, left/right, raise/lower. Use clear units and coordinate space.
- Toggle automatic look-at; select look target; set target point/anchor; set pitch, yaw, roll or relative angular offsets numerically.
- Lens/projection type, FOV, fisheye strength where available, near/far clipping, and documented defaults/limits.
- Follow/rotation smoothing, optional spring/lag and per-shot transitions; frame-rate-independent update and controllable damping.
- Inspect, list, create, clone, delete or reset cameras, when authorized, without making IDs depend on labels.
- Configure main camera and secondary preview camera, read and persist each setting, and restore entire original preset or one property.

Use the existing World API's shared IDs, version/revision, permissions, validation, diagnostic and undo conventions where applicable, rather than creating a permissive second mutation system. An agent must be able to inspect and propose explicit camera changes with preview/validation before commit where the existing API supports this. Expose a straightforward typed programmer surface and an intention-oriented agent surface without making either a thin imitation of the other.

Illustrative calls (adapt names to repo conventions; these are not assertions of current implementation):

```ts
const cam = world.cameras.get("ship.camera.overhead");
cam.setPosition({ forward: 0, right: 0, up: 25, unit: "ft" });
cam.move({ up: 5, right: -2, unit: "ft" });
cam.setLookAt({ enabled: true, target: { kind: "controlled-ship" } });
cam.setAngleOffset({ pitch: 10, yaw: 0, roll: 0, unit: "deg" });
cam.restoreDefaults();
```

Use an explicit semantic distinction between setting a coordinate to 5 and adding 5 to its current value. Avoid unexpected mutations of unrelated properties.

## 5. Universal look-at and target selection

**Default for all initial ship cameras:** Look at Ship = true. In either operating mode allow targeting to be disabled and allow independent follow and look-at references.

Provide accessible dropdown/selectable options including:
- Look at Ship: true/false (the controlled ship by default).
- Look at Avatar: true/false where that entity exists.
- Look at Earth: true/false **only when a corresponding Earth/world reference object actually exists**, otherwise clearly unavailable; do not invent a physically spherical Earth in the current repeated-map prototype.
- Look at World Object: true/false, with searchable selection of a real placed instance.
- Look at GLB Object: true/false, selecting an existing imported/instantiated model by stable world object ID; optionally select an existing GLB node, bone or authored attachment point.
- Look at Fixed Point or Custom Target: true/false, with world-space coordinates or programmable resolution.
- Manual orientation / no look-at.

A camera has **one active look-at policy** by default. Choosing “Look at Earth” while “Look at Ship” was active switches the active target; it must not silently aim at two incompatible targets. Preserve useful previous choices for user convenience, but never present multiple mutually exclusive toggles as simultaneously active. More advanced target blending requires an explicit custom policy. Display Yes/No or true/false in the UI as requested, backed by a typed discriminated target configuration rather than ambiguous competing booleans.

Target choices should be inspectable through a dropdown and typed API. Lookups must use existing scene IDs, world-object registration and access grants; only offer real objects, not imaginary finished GLB-placement capabilities. Allow programmatic registration of custom named target resolvers (e.g. nearest enemy, waypoint, active projectile, moving point between objects) with stable ID, label, resolver/requirements and validated bounded execution. Only advertise custom choices whose implementation is registered.

When look-at is enabled, compute a direction toward the resolved target **after** the camera's scripted or configured position is evaluated, then apply documented pitch/yaw/roll offsets. When disabled, the camera uses explicit orientation or code-driven orientation. Switching targeting should have a documented continuous transition or preserve current orientation until an intentional transition; no unnecessary snap. If a target is missing, deleted, unloaded or unauthorized, retain the last valid viewing orientation by default, report a target-unavailable diagnostic and never silently choose an unrelated target. Restore targeting when appropriate and authorized.

Example creator instructions that should be representable:
- “Follow my ship, but look toward Earth.”
- “Follow the ship and point at that imported GLB spacecraft.”
- “Look toward this dragon model's head node.”
- “Turn off look-at and point the front camera 15 degrees toward the horizon.”
- “Add a new target option called Current Destination.”

## 6. Live secondary preview and `C` swap

Render a live secondary camera view **at the bottom-right of the main viewport**, showing the currently chosen next/secondary perspective of the same evolving world. It is not a static screenshot and not a separate simulation. Provide an accessible selector to choose which camera appears in the preview, including the semantic suffix. Allow main and preview cameras to be different and avoid self-preview when possible.

Pressing `C` performs a true two-way swap: the existing preview becomes main and the former main becomes preview. Pressing `C` again swaps them back. **Do not silently rotate the preview to a third camera on each C press.** Camera selection/navigation is a separate action. Preserve other keybindings and handle focus appropriately (e.g. do not intercept typing `c` inside code editors). Swapping should not reset camera settings or Liquid state and should not run a camera script twice merely because it is rendered in two viewport roles.

Use one authoritative scene update and separately rendered camera view(s), with lowered preview resolution, configurable update cadence/effects and disable option for low-end devices. Measure frame time/memory overhead instead of promising dual renders are free. The normal main camera must function with preview disabled.

## 7. Liquid Mode: code owns the camera behavior

Every camera can operate in:
- **Standard Mode:** ordinary UI-editable offsets, orientation, lens, smoothing and targeting.
- **Liquid Mode:** custom programmable camera behavior, responsive to ship/controlled-object actions and state.

On entering Liquid Mode, **hide/blank all normal camera controls in its primary UI** except automatic targeting controls: a simple Look at Ship true/false initially, generalized to the target dropdown, its true/false enable, optional object/GLB/node selection, and custom target additions described above. The remainder of the editing surface is an appropriate code editor/programmatic interface. Do not delete standard-mode data when hiding controls; switching back restores previous standard settings. Entering Liquid Mode is itself a modification, so the label becomes `(Modified)`. Retain the Liquid source/configuration when switching away. Code may modify all permissible camera position/orientation/lens/effect values via a scoped API; UI hiding must not remove those API capabilities.

Liquid can read bounded, typed, read-only snapshots of relevant live entity state when implemented: position, rotation, velocity, acceleration, forward speed, turn input, angular velocity, banking/roll, pitch/yaw, climb/descent, boost/brake/landing, other registered action events and simulation delta time. Distinguish action/input values from measured physical acceleration. Missing action signals must be reported rather than fabricated. Allow mapping/combining actions into camera offset, angle, orbit, smoothing, FOV/fisheye response and visual effects; clamp/validate values and support damping and reset/fallback. Support event-triggered transitions and continuous update.

Conceptual examples, adapted to actual input units and runtime:

```ts
// A controlled camera script receives a bounded camera context.
const s = context.entityState;
camera.setRelativeOffset({
  forward: clamp(10 + s.forwardAcceleration * 2, 4, 24),
  right: clamp(s.turnInput * 6, -8, 8),
  up: -2 + clamp(s.climbRate * 0.1, -4, 4),
});
camera.setFisheyeStrength(clamp(s.speed * 0.002, 0, 0.7));
```

With auto look-at enabled the evaluated camera continues looking toward its selected target unless code applies a deliberate offset. With auto look-at disabled, the code supplies orientation. Clearly define whether custom targeting runs before/after animation and avoid inconsistent multiple writers to the same pose.

Do **not** use arbitrary unsandboxed third-party JS with browser/OS access for purchased or imported camera behaviors. Integrate an existing safe scripting/capability model if present; otherwise implement the smallest validated declarative behavior graph or tightly scoped script prototype first, and explicitly mark full arbitrary-code Liquid scripting as future work. Bound execution time, memory, recursion, output rates and effects; enforce authorization/permissions; fail safely with preserved previous valid pose and useful diagnostics. Do not misrepresent the present platform as having an already portable cross-runtime scripting engine.

## 8. Creator/agent and future renderer portability

Use the shared world IDs, authorized inspect/plan/preview/commit and versioned schema infrastructure for camera definitions as appropriate. An agent should be able to inspect available cameras and targetable entities, explain current settings, propose changes with validation and execute explicitly authorized commits. Camera target dropdown contents should be built from the same registry that API discovery uses; offer extension points for custom target providers.

Keep the persisted camera configuration and behavior contracts free of Three.js object references or hidden browser-specific state. Adapt them into the existing browser/Three.js renderer. A future C/C++ rendering system should be able to load equivalent camera data and evaluate matching documented behavior, but **do not implement or promise a complete native renderer in this task**. Portable camera data does not imply portable arbitrary JS scripts; specify a future-compatible behavior contract and mark unsupported adapters honestly.

## 9. Implementation sequence and performance

Proceed with small, separately verifiable increments:
1. Audit existing renderer, ship, input, performance toggles, world API and docs. Document actual capability gaps and choose the minimal integration seam.
2. Define/test pure camera schema, six presets, coordinate conversion, targeting config, stable IDs, default/modified label logic and serialization.
3. Integrate one main-camera pose evaluator and minimal standard UI/API for absolute/relative position, automatic look-at and orientation, without breaking current flight.
4. Add the live bottom-right secondary render and explicit C swap plus independent preview camera selection, including low-end preview quality/disable.
5. Extend target registry and object/GLB instance selectors only as far as actual scene-object support allows, with truthful missing-feature UI.
6. Introduce Standard/Liquid switching, code/behavior evaluation using a bounded supported mechanism, action-linked example(s), error fallback and persistence.
7. Extend agent/programmer discoverability/validation/permissions; document the portability boundary and any deferred features.

Avoid making a broad engine rewrite a prerequisite to useful ship camera functionality. The initial vertical slice should work before implementing the ambitious extension system.

## 10. Tests, acceptance and reporting

Add focused tests for:
- Exact six names, offsets and automatic look-at defaults; front low fisheye positioned ahead and slightly below; left/right mirroring; overhead centered 20 ft up.
- Ship-local offsets through translation, yaw, pitch, roll and switching controlled entity; correct world-unit conversion.
- Absolute vs relative setting, raise/lower, angle settings, look-at enable/disable and different follow/look targets.
- Named target selection with exclusive active target; real object/GLB-node resolution; invalid/unavailable target diagnostics and stable fallback.
- `(Customizable)` changing to `(Modified)` on any changed value or Liquid selection, never both suffixes; restoring all defaults resets it; save/reload retains state.
- Live preview of same world without double world simulation, camera selection independent of swapping, C swaps both ways; input editor focus respected.
- Standard/Liquid mode switching preserves independent configurations; code-linked acceleration/turn behavior is bounded and repeatable for controlled inputs; script failure safe.
- Permissions, revision conflicts and agent/programmer consistency where integrated; no regression of existing world API contracts.
- `npm test`, `npm run build`, applicable browser smoke test and an honest preview-on/off performance check. If true fisheye or GLB targeting is not implemented, document the fallback/blocker and do not mark its test as passing.

Report changed files, implemented vs deferred capabilities, exact tests/results, user-visible steps to try each camera, metrics/limits on low-end performance, risks and next narrow follow-up. Do not automatically merge.

## 11. User-facing success experience

The creator launches the existing browser world, flies the current ship, sees one of the cinematic views in the main viewport and another live shot in the bottom-right. They choose a different preview angle, press C to swap views, adjust a camera's height or tilt in a straightforward interface or typed API, and watch its label change from `Overhead (Customizable)` to `Overhead (Modified)`. They can restore defaults, choose a real different look-at target, or enter Liquid Mode and connect ship movement/actions to camera behavior without losing the original preset. The same portable camera-definition architecture can later support independently curated camera families for people, cars, ships and creator GLB assets.
