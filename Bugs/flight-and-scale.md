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

## CAMERA-005 — Massive viewport points at sky and view button appears stuck

- Status: **code fix implemented; current CI tests/build pass; visual behavior on user's 16,000 world still requires direct confirmation**.
- User reproduction: In the 16,000 × 16,000 preset, climb with Up while in the low/middle camera and see mostly empty sky. The previous View control appeared to cycle without changing the scene, then could remain in an unwanted view.
- Code findings: Previously `src/main.js` multiplied Overview camera **vertical** follow offset by `altitudeScale` (32) but left horizontal distance unscaled, producing a different, nearly top-down perspective from Current/Bigger. The previous button cycled `Auto → Forward → Overview → Auto`: from low-altitude Auto, the first press selected an identical Forward scene, making it look ineffective. Forward focused almost exactly horizontally independent of ascent, making the ground fall out of its sightline.
- V8 changes: `overviewCameraScale()` now scales **both** horizontal and vertical follow offsets together according to normalized altitude. Forward look pitch gently inclines *toward the world* with ascent, never upwards. The overview camera now reaches a matched 32× horizontal AND vertical offset by the third altitude level; its focus also progressively lowers toward the globe BEFORE full globe reveal, rather than aiming straight ahead from several thousand units over the ocean. The View button instantly toggles the **actual** Forward/Overview mode and resets stale follow-camera pose. A separate Auto camera button (or Shift+V) restores the original low/middle Forward, high/top Overview rules. View (V) no longer cycles through a visually identical Auto step.
- Verification: On Massive start low, press Up while looking ahead, switch View at low/mid/high/top, repeatedly toggle Forward/Overview, release/repress Up and descend. Confirm camera is never stuck in sky or an intermediate viewpoint, and manual choice remains selected until Auto is deliberately restored. Compare matching normalized altitudes on Current/Bigger/Massive and inspect ship, planet center and horizon. Preserve ship position, heading and momentum. Device FPS and the visual fix have NOT yet been verified on the owner's computer.

## CAMERA-006 — Massive Overview ship becomes a blip or leaves viewport

- Status: **V9 targeted implementation and unit tests; actual visual appearance on user's machine unverified**.
- User report: In 16,000 × 16,000 Massive mode, ascending in non-forward Overview makes the ship a minuscule blip and eventually projects it above the viewport. Current/Bigger views already behave acceptably and MUST NOT be altered.
- Root cause in source: `src/main.js` scales the high-altitude external camera by world size, aims primarily at the planet center and positions the ship at authoritative pilot Y. The planet-to-ship angular separation grows while the physical mesh occupies fewer screen pixels, so merely scaling the whole ship or shifting planet focus can spoil planet framing.
- V9 approach: `src/massive-ship-presentation.js` activates ONLY for Massive, high normalized altitude and nearly-full Overview. It re-parents the **same ship visual mesh** to the camera (lower center, fixed angular size), so the globe stays centered and the piloted craft stays visible. Switching to Forward, the smaller world scales, or lower altitude restores the ordinary world-relative ship transform and visibility. The actual pilot's position, speed, yaw, collision and island/globe geometry are never changed.
- Verification: Massive low/middle/expansive/orbital altitudes; repeatedly switch Forward/Overview/Auto and switch world scale to Bigger and Current. Ship must remain reasonably sized and in frame only in Massive Overview, not hover at the world-camera anchor in other modes. GLB override should retain a recognizable size after loading at altitude. Check for an abrupt cut at the low→high presentation handoff and refine only if needed. Browser visual result and real-device FPS remain unverified.

## VISUAL-001 — Ocean travel marks are too faint and vanish when ascending

- Status: **V9 bright world-anchored style and shared curvature implemented; on-device visual validation pending**.
- User report: In each world-scale/mode, fast open-ocean movement should be easy to perceive via graphic strokes that contrast with the ocean color. Previous cyan marks capped at alpha .29 and faded to ZERO above low altitude.
- V9 approach: A single pool of 72 mint-white ocean-surface line segments (one draw call and no textures) uses speed-responsive opacity up to .91 and altitude/planet-scale-dependent spacing/length. It never fades merely because of altitude. Its LineBasicMaterial shares the **same shader-based horizon/planetary curvature** as the one sea mesh and stays anchored to actual ocean coordinates, not scrolling according to a timer. Zero movement hides lines. Land cells still receive no glints. Periphery-only atmospheric speed graphics remain a separate V9 effect.
- Verification: Forward/Overview at low/mid/high/top in Current, Bigger and Massive. Confirm visible lines on dark blue water at meaningful speed, not on terrain or through the back of the planet, and no visual Z-fighting with the curved sea; test calm hover and slow cruise, Shift boost and returning to island shore. Keep one draw call and bounded 72 lines; if lines are too faint from orbit, tune contrast/sampling, not add a new ocean mesh.

## V9 cinematic continuity and ocean refinement — current status

- **Massive camera / ship:** The CAMERA-006/007 paragraphs below describe the original problem and initial PR #11 implementation. That initial implementation still re-parented the ship during view changes. The current V9 refinement keeps the same visual ship camera-parented for the whole Massive visit, interpolates its apparent size to/from zero during Forward/Overview transitions, and interpolates the Massive camera's current orientation toward the target quaternion. The physical pilot pose is unaffected; Current/Bigger views retain their prior mathematics. Deep Debug records actual render-parent changes and visible-ship size/anchor. Check the real device for the intended lower-center composition, overly conspicuous growth/shrink, fast repeated toggles, and correct orientation while banking. **Automated checks pass; browser appearance remains unverified.**
- **Sea arc stability:** VISUAL-001/002 below describe the prior single-pool implementation. V9 now uses a near 56-crest and far 32-crest field, each attached to a fixed geographic lattice per world size. Continuous altitude crossfade alters opacity, not source world coordinates: ascending while hovering must NOT make crests crawl up the viewport or regenerate new shapes because of altitude alone. Real forward motion produces the flow. Budget is at most 88 cached crests, 528 segments, two line draw calls, zero crest textures and no extra sea mesh. Check all four altitude bands and all three world scales for pop, overly dense white strokes, visible through far hemisphere, shoreline overflow, depth shimmer and smooth travel on the owner's 4 GB Windows PC. **Automated checks pass; visual/FPS validation remains pending.**

## CAMERA-007 — Massive ascent and view changes discontinuously relocate displayed ship

- Status: **root cause corrected in math/state paths and regression tested; browser cinematic quality and 4 GB device validation pending**.
- Root cause audit: `toggleCamera()` and `enableAutoCamera()` set `cameraInitialized=false`, so the next frame copied a new camera endpoint rather than continuing from the rendered pose. `massiveShipPresentation()` separately activated by a view threshold, reparented the mesh, and wrote a fixed camera-local transform. The pilot never teleported; the camera and displayed representation changed discontinuously.
- Change: mode requests retain the current camera pose, Massive composition owns explicit current/start/target state, retargeting begins at the current interpolated state, and no altitude gate changes representation. Physical and displayed projections are separately queryable. Current/Bigger and Forward target math are unchanged.
- Remaining: real browser replay (ascent, repeated Forward/Overview/Auto, descent), custom GLB bounds, unusual aspect ratios, and subjective composition remain unverified.

## VISUAL-002 — Straight heading-aligned ocean lines resemble a camera conveyor

- Status: **bounded curved world-field implemented and deterministic tests pass; visual/FPS validation pending**.
- Root cause audit: the former 72 two-point segments were regenerated around a ship-centered patch and their axes came directly from ship heading. Even with world-seeded centers, turns rotated every line and two endpoints reduced curvature to a chord.
- Change: stable wrapped crest identities generate low-frequency geographic orientation, bent sampled controls and six segments per crest. A fixed 72-crest buffer remains one draw call. Hover has no speed emphasis; heading is not an input to geometry.
- Remaining: shore-edge aesthetics, far-hemisphere depth behavior, aliasing, and measured GPU cost on the owner's device require browser inspection.

## DIAGNOSTICS-001 — Agents could inspect but could not reproduce or safely test a correction

- Status: **bounded development interface and regression coverage implemented; browser automation and target-device replay pending**.
- Previous limitation: Spatial Truth exposed read-only current state and JSONL events, but had no authorization boundary, deterministic control replay, synchronized before/after frame capture, safe adjustment whitelist, experiment comparison, or rollback. An agent still had to infer the Massive discontinuity from unrelated samples.
- Change: a trusted user click grants expiring scoped access. The built-in 888-frame Massive scenario covers a Forward/Auto/Overview matrix across all four altitude targets, ascent through the former threshold, interrupted toggles and descent. Captures bind physical/camera/render/projection state to one completed frame. Presentation-only candidates are bounded and reversible; physical state can only be restored by an explicit replay checkpoint.
- Budget: 1,800 frames / 1 MiB replay, 48 captures / 512 KiB metadata, optional individually capped images, FIFO eviction, and no frame-state construction in ordinary Performance flight.
- Remaining: run the built-in scenario in a real browser at multiple aspect ratios with the custom GLB, compare baseline/candidate captures, and profile the owner’s 4 GB Windows computer. Automated state tests do not establish cinematic quality.


## OCEAN-003 — Cinematic Ocean V1 requires owner visual acceptance

- Status: **modular implementation and 87 automated tests pass; browser capture and 4 GB Windows profile unverified**.
- Root-cause change: the old ship-local two-lattice rectangle was replaced by four fixed geographic family buffers with shallow nested groups. Altitude changes continuous family weights rather than line coordinates. A separate soft radial footprint is centered vertically below the authoritative ship and hidden when its center is not ocean.
- Remaining risk: this environment supplied no browser automation/capture tool. Confirm that the reported hard diamond is absent, the one-pixel WebGL lines read as waves rather than hairs, shoreline clipping is graceful, and the shadow does not show through the far hemisphere. Center-only shoreline rejection may need multi-sample feathering.
- Reproduce: follow `docs/OCEAN_STUDIO_TUNING_GUIDE.md` at low/middle/high/top, stationary ascent, boost, camera toggles, shore and descent on every scale. Export paired synchronized captures and numeric state; record actual FPS/draw calls and memory on the target computer.

### OCEAN-003 source audit evidence

The retired renderer selected an `8 × 7` near and `8 × 4` far rectangular lattice around `floor(ship/grid)`, disabled every line outside those pools, and changed opacity across altitude. Under the pitched camera, that finite ship-local rectangular boundary projects as the reported diamond; independent one-curve-per-cell sampling produced the hair-like morphology. The active V1 path no longer imports that renderer: it uses differently sized family neighborhoods, nested sibling bands, density thinning, stable family IDs and a separately feathered circular footprint. This is source-level evidence, not proof of final pixels; the manual capture route remains required.
