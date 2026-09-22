# Flight, position and large-world issues

Reports refer to experimental V7 `feature/scale-profiles-floating-origin-v7`, carried into V8 `feature/altitude-parallax-cloud-choreography-v8`. User reports are firsthand observations, not automatically proven causes.

## FLIGHT-001 — Descending from orbital/overview view does not restore forward-facing close flight

- Status: **confirmed in code, user-reported symptom; not verified fixed**.
- Actual: On Bigger/Massive, descending to the lowest altitude may retain an external overview instead of the familiar first-person-like/forward-close view. User also wants an OPTIONAL overview at low altitude.
- Evidence: `src/main.js` uses one behind-and-above ship camera path (`desired` / `camera.lookAt`). `src/flight-model.js` produces altitude-based view offsets; it has no explicit camera-mode setting or automatic low-altitude first-person restoration.
- Expected: Default low flight restores original forward-facing view; a user-selected low-altitude Overview is a separate option. Orbital overview blends as altitude increases, without moving the authoritative pilot, replacing heading, or interrupting momentum.
- Reproduce: Massive > ascend until planet is visible > descend to sea level; observe whether the ship remains in the foreground, horizon stays navigable, and close flight reappears.
- Verification: Test each scale, switching low-altitude Overview on/off, sustained Shift boost and return to low flight. No involuntary position or camera jump.

## FLIGHT-002 — W/S controls sometimes appear locked near island terrain

- Status: **confirmed blocking/zero-momentum code path; root cause of every reported lock remains unverified**.
- Actual: User reports inability to move forward OR backward while ascent/descent may remain responsive; can sometimes recover by ascending first.
- Evidence: `src/main.js` tests terrain/object entry in substeps and executes `forwardVelocity=0` when blocked. `src/flight-collision.js` has existing escape-if-inside rules; interactions among collision clearance, map scale and the initial hit must be tested, not assumed.
- Expected: Never trap a pilot in place after a collision. Allow reversing, moving away from an obstruction and upward escape, without flying through solid authored terrain. Open-ocean flight must not pay for repeated near-land tests.
- Reproduce: Fly low and fast toward ground slopes and floating-island undersides/edges on each world scale; test forward, reverse, R/Up, then reattempt. Record HUD coordinates and exact displayed collision notice.
- Verification: Automated collision regression scenarios AND physical low-flight test. Preserve inherited island slipstream and momentum outside collisions.

## FLIGHT-003 — Unexpected return to spawn while game remains open

- Status: **reported / unverified root cause; DO NOT label as solved**.
- Actual: User says ship suddenly returns to original starting location near land without the page visibly reloading.
- Evidence: `resetSpawn()` explicitly repositions `pilot` and zeroes velocity. In inspected source it is invoked on startup, world scale changes and Tiled import, not in the ordinary near-land frame loop. V7 uses authoritative `pilot` world coordinates, a floating render origin, nearest-wrapped island visuals and a camera follow. An unexpected render jump is a separate possible mechanism. Current source inspection alone does not identify the cause.
- Expected: Flying, colliding, descending or crossing wrapped map boundaries NEVER alters global pilot position except by controlled navigation and explicit user actions. Scale changes should request confirmation or preserve/remap location instead of silently respawning.
- Reproduce: On Massive, note HUD X/Z before and after incident. Record whether exact coordinates reset, world-size selector changed, and whether the ship/camera or landmass jumped. Instrument `resetSpawn(reason)` and track global pilot before/after update without storing sensitive data.
- Verification: Reproduce on affected browser and demonstrate no involuntary pilot reset or camera jump after sustained near-land traversal. Retain explicit Reset/Import functionality.

## SCALE-001 — High-altitude jitter, incorrect planet framing and distant visual snapping

- Status: **V7 stabilization implemented, actual device outcome unverified**.
- Actual: User previously observed visual jitter at high altitude, world showing only a tip or land detaching/appearing in wrong direction, and floating islands clipping or vanishing.
- Existing V7 attempt: floating-origin render space, radius-dependent curvature, bounded ocean geometry and camera near/far adaptation. It is not proof that the reported device symptoms are resolved.
- Expected: Smooth attractive changing curvature; land lies on sphere; floating islands face radially away from the planet without changing physical size. All cloud planes follow ground tangent at high altitude.
- Reproduce/verify: Current/Bigger/Massive altitude sweep with high speed, turns, descent and view transitions on 4 GB Windows machine; verify world center/ship framing and resource use. Do not add a second translucent planet to hide the problem.

## SCALE-002 — Repeated islands and misleading density on little world

- Status: **historic V5/V7 mitigation, current browser status to be checked**.
- Actual: User saw ~40 islands despite authoring two ground landmasses and three floating islands; repeated copies returned after a short voyage.
- Existing: `landmasses.js` and wrapped coordinates keep one visual instance per semantic island; Bigger/Massive put destinations farther apart. World wrap must not expose multiple nearby replicas or unexpected position discontinuities.
- Verify: Cross map seams on all three presets; keep island IDs and exact geometry, preserve visual scale at high altitude.

## PERF-001 — 4 GB Windows computer must remain responsive

- Status: **design invariant; measured performance not verified**.
- Symptoms: Past reports of lag during visual-globe rendering, especially at high altitude. Changing world size must not allocate world-width × world-height tile arrays.
- Budget: One local 500×500 terrain grid, bounded sea mesh, bounded cloud pool and 500×500 sparse overview. Profile and avoid creating materials, cloud meshes or terrain chunks on each frame.
- Verification: Record frame timing/memory during low cruise, Shift super speed, region crossing and orbit; distinguish CPU collision loops, GPU transparency/overdraw and memory allocations from logical world size.
