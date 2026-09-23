# Flight, position and large-world issues

Reports refer to experimental V7 `feature/scale-profiles-floating-origin-v7`, carried into V8 `feature/altitude-parallax-cloud-choreography-v8`. User reports are firsthand observations, not automatically proven causes.

## FLIGHT-001 — Descending from orbital/overview view does not restore forward-facing close flight

- Status: **V8 camera-mode fix implemented and automated regression tested; affected browser still needs visual confirmation**.
- Actual: On Bigger/Massive, descending to the lowest altitude may retain an external overview instead of the familiar first-person-like/forward-close view. User also wants an OPTIONAL overview at low altitude.
- Prior cause: V7/V8 had only one behind-and-above ship camera; the `Fly forward` button actually toggled auto-thrust, not the camera. V8 now uses `src/camera-modes.js`, an independent `View` button and V shortcut. Auto chooses Forward in low/mid and preserves the existing Overview at high/top. Manual Forward or Overview is available at any altitude. Navigation and velocity are unchanged by camera choice.
- Expected: Default low flight restores original forward-facing view; a user-selected low-altitude Overview is a separate option. Orbital overview blends as altitude increases, without moving the authoritative pilot, replacing heading, or interrupting momentum.
- Reproduce: Massive > ascend until planet is visible > descend to sea level; observe whether the ship remains in the foreground, horizon stays navigable, and close flight reappears.
- Verification: Test each scale, switching low-altitude Overview on/off, sustained Shift boost and return to low flight. No involuntary position or camera jump.

## FLIGHT-002 — W/S controls sometimes appear locked near island terrain

- Status: **V8 reverse-thrust and last-safe-position fixes implemented and regression tested; original intermittent browser lock not yet confirmed resolved**.
- Actual: User reports inability to move forward OR backward while ascent/descent may remain responsive; can sometimes recover by ascending first.
- Evidence: The old formula calculated Forward as `(W || autoCruise) - S`, so with Fly forward enabled, holding S gave ZERO input rather than reverse. V8 makes manual S override cruise. A bounded `src/horizontal-flight.js` sweep now advances only to the last safe position near collision rather than rejecting the entire frame. If blocked, horizontal speed is reset but the ship can back out. Other collision/terrain interactions still require an actual browser reproduction.
- Expected: Never trap a pilot in place after a collision. Allow reversing, moving away from an obstruction and upward escape, without flying through solid authored terrain. Open-ocean flight must not pay for repeated near-land tests.
- Reproduce: Fly low and fast toward ground slopes and floating-island undersides/edges on each world scale; test forward, reverse, R/Up, then reattempt. Record HUD coordinates and exact displayed collision notice.
- Verification: Automated collision regression scenarios AND physical low-flight test. Preserve inherited island slipstream and momentum outside collisions.

## FLIGHT-003 — Unexpected return to spawn while game remains open

- Status: **V8 explicit scale-change preservation and spawn diagnostics implemented; user's in-flight unexpected reset remains unverified on device**.
- Actual: User says ship suddenly returns to original starting location near land without the page visibly reloading.
- Evidence: `resetSpawn(reason)` is now used only for initialization and explicit map import and logs its reason; changing `worldScale` instead translates the pilot's local island offset (or open-ocean relative coordinates) into the new world, retaining altitude and heading/momentum. Previous source had NO reset call merely from approaching land. The original report may be a camera/wrapped-visual jump or unintended scale selection, but its precise cause is NOT established without user-coordinate logging during a reproduction.
- Expected: Flying, colliding, descending or crossing wrapped map boundaries NEVER alters global pilot position except by controlled navigation and explicit user actions. Scale changes should request confirmation or preserve/remap location instead of silently respawning.
- Reproduce: On Massive, note HUD X/Z before and after incident. Record whether exact coordinates reset, world-size selector changed, and whether the ship/camera or landmass jumped. Instrument `resetSpawn(reason)` and track global pilot before/after update without storing sensitive data.
- Verification: Reproduce on affected browser and demonstrate no involuntary pilot reset or camera jump after sustained near-land traversal. Retain explicit Reset/Import functionality.

## SCALE-001 — High-altitude jitter, incorrect planet framing and distant visual snapping

- Status: **V7 stability plus V8 planet-framing lens adjustment implemented; actual device outcome unverified**.
- Actual: User previously observed visual jitter at high altitude, world showing only a tip or land detaching/appearing in wrong direction, and floating islands clipping or vanishing.
- Existing V7 attempt: floating-origin render space, radius-dependent curvature, bounded ocean geometry and camera near/far adaptation. V8 lowers the overview field of view toward 46° as the globe appears and aims at the sphere center, so more of the planet should be visible centrally without another mesh. This remains an UNVERIFIED visual adjustment rather than a measured fix to all high-altitude jitter.
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

## SCALE-003 — High-altitude overview shows only the top/tip of the planet

- Status: **V8 planet-framing change implemented, browser result unverified**.
- User report: On the expansive planet the camera shows too little of the world's body; the player wants substantially more sphere visible and centered at higher altitudes.
- V8 code: `src/camera-modes.js` transitions the external-view lens toward 46 degrees at full globe reveal; `src/main.js` continues to aim the external camera at the planet's center. Both changes preserve the existing single opaque globe, semantic coordinates, island geometry and flight controls. Manual Forward view remains available at any altitude.
- Verify: Massive at ALT roughly 14,240 and Bigger at ALT roughly 2,225. The globe should fill much more of the central viewport than V7, the ship should remain usable, the camera must not clip into the world, and rotating/descending must not introduce abrupt jumps. The user's specific 4 GB browser has not yet been tested.

## SCALE-004 — World-size selector used to respawn the ship

- Status: **confirmed previous code behavior; V8 transfer implemented and automated tested, user confirmation pending**.
- Old behavior: The `worldScale` change listener invoked `makeTerrain();resetSpawn()`, discarding the pilot's current X/Z, altitude, yaw and all earned momentum.
- V8 behavior: `transferScalePosition` maps local destination offsets exactly or scales relative open-ocean coordinates. It preserves ship orientation/momentum, and the explicit scale-change control is blurred before returning to flight. Initialization and explicit map import still intentionally spawn at a starting point.
- Verify: Switch Current→Bigger→Massive→Current next to both islands and in open ocean; location should remain semantically consistent. Ensure no UI control unexpectedly changes the selected scale while flying.
