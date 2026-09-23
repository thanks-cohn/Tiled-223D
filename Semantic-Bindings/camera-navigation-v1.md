# V8 agent binding — flight camera, scale transitions, safe movement

**Status:** implemented on experimental `feature/altitude-parallax-cloud-choreography-v8`; automated tests pass on branch commits, browser/on-device visual verification still required. This is an extension of [cloud parallax](cloud-parallax-v1.md) and [world scale](scale-profiles-v1.md). Read [Bugs/flight-and-scale.md](../Bugs/flight-and-scale.md) before calling any reported symptom fixed. `main` is unchanged.

## User's exact camera intent

- Low and middle atmospheric altitude: default **Forward**, a close look ahead from the ship that makes low cruising and parallax compelling.
- Third expansive and fourth planetary altitude: **preserve the previously existing external/planetary composition**, except for a deliberate lens/framing adjustment so MORE of the planet appears CENTERED.
- User can select either Forward or Overview at **ANY altitude**. The HUD now has a separate `View` control and `V` key; `Fly forward` remains a movement/autocruise switch and must never control the camera.
- `Auto` chooses Forward below the third layer and transitions to Overview from normalized altitude 175–225, with Overview fully selected by 225. On descent, Auto returns to Forward. `Forward` and `Overview` manual overrides last until changed (sequence Auto → Forward → Overview → Auto).
- Manual camera changes must NEVER update global X/Z/Y, yaw, momentum, world scale, collision state, map import, or cloud world anchors.

## Implementation source of truth

| Module | Why / non-negotiable contract |
| --- | --- |
| `src/camera-modes.js` | Pure view-choice and altitude blending model. `planetOverviewFov()` narrows the overview FOV toward 46° at full globe reveal. Forward FOV and manual Forward remain intact. |
| `src/main.js` | Renders cockpit close to pilot and looks along actual yaw in Forward. Interpolates to existing overview camera and globe-center target in external mode, without translating pilot. Hides ONLY ship visuals for full Forward. UI controls and `V` key are separate from autocruise. |
| `src/scale-world.js` | `transferScalePosition()` preserves local semantic destination offset or open-ocean relative position when switching Current/Bigger/Massive. `nearestLandInstance()` returns the terrain's ONE relocation offset plus integer world-wrap period: `nearest()` already returns ONLY period displacement, so never subtract destination center again. |
| `src/horizontal-flight.js` | Bounded near-land collision sweep moves to last safe position on obstruction. Returns obstruction reason, does not trigger spawn or overwrite coordinates elsewhere. Preserve altitude/object collision checks and permit immediate manual reverse. |
| `tests/flight-regressions-v8.test.js` | Tests altitude mode choice, manual override, 46° lens, accurate island center, scale transfer, near-land collision and backing away. |

## Bug fixes vs unresolved reports

- Camera was previously a single third-person orbit/cinematic path; the existing `Fly forward` button only triggered cruise. This branch has a genuine independent view switch. Device verification still required.
- Previously `S` plus Auto Fly forward (cruise) yielded zero signed input. Now manual S has priority and provides reverse thrust. A blocked near-land move retains progress up to last safe sample. Remaining intermittent terrain/collision traps may exist and need affected browser testing.
- Previously selecting a different planet scale called `resetSpawn()` and zeroed position/momentum. V8 transfers position without calling spawn, blurs the selector and clears stale input. Intentional initial game load and Tiled map import still spawn at a defined position and log a reason.
- User also reported apparent spontaneous position resets near land WITHOUT touching the scale selector. No ordinary near-land frame code calls `resetSpawn()`; whether this was a visual snap, unexpected scale-input event or a different cause remains unproven. Do not declare the original incident completely fixed.
- The reported planet showing only its top/tip receives a **framing** change only: center-targeted camera and gradual zoom to a 46° field of view. It does not add more ocean vertices, another globe, extra clouds or a larger texture. Whether it achieves the desired visual composition on the user's machine must be checked.

## Low-memory performance invariants

One local 500×500 terrain map, one ocean mesh, 27 pooled cloud formations, and a bounded overview map. View switching changes camera transform/FOV, not scene complexity. `sweepHorizontal` only runs under the existing near-land/low-altitude broad phase; caps samples at 5,000 rather than freezing on pathological extreme-speed near-ground frames. The high planet framing uses no extra mesh/postprocessing. Keep camera floating-origin X/Z and same-radius globe projection.

## Browser acceptance checklist

1. Start Current/Bigger/Massive. Sea-level and mid-level view must default Forward; click `View` or press `V` to toggle and maintain manual selection. At altitude above normalized 225 Auto should show the prior overview; manual Forward must remain available. Descend and confirm Auto returns Forward.
2. Boost low over open ocean with Fly forward On, then press S. Ship must actually reverse; W should resume forward. Inspect heading, altitude and stored global coordinates across all view changes.
3. Approach both island coastlines and floating-island faces at speed. Collision may stop thrust but should not reset ship to spawn or trap reverse/Up. Verify the HUD stays in the correct geographical area.
4. Change planet scale deliberately near one island and at open ocean; location should transfer proportionally/local-to-destination, not teleport to the initial spawn. Imported Tiled maps still deliberately set their own spawn.
5. At high altitude in Bigger/Massive, assess how much sphere is visible, whether planet is center stage, and whether the ship remains framed. This FOV adjustment is not guaranteed to solve every prior camera/jitter artifact.
6. Check FPS, memory, and visual smoothness on the actual 4 GB Windows device. GitHub tests/build are not substitutes.
