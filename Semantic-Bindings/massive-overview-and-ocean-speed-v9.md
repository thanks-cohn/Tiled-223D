# V9 addendum — Massive ship visibility and readable ocean-speed marks

**Status:** implemented on experimental `feature/cinematic-speed-perception-v9`, not merged into `main`. Automated tests and build are required; the owner must verify the aesthetic result and FPS in the browser. Read [Bugs CAMERA-006 and VISUAL-001](../Bugs/flight-and-scale.md).

## Scope: Do NOT rewrite the other view modes

The user specifically reports that Current and Bigger modes work as desired. **Only the Massive (16,000 × 16,000) high-altitude Overview** loses the ship by making it tiny or projecting it off the top of the viewport. Keep low/middle forward defaults, manual camera choices, and Current/Bigger camera behavior exactly as before.

## Why the ship presentation is separated from navigation

The physical pilot stays in authoritative global X/Y/Z and continues controlling direction, collisions, world anchoring and velocity. The Massive external camera, however, points at the distant planet center, so a world-positioned ship can be too small or offscreen. `src/massive-ship-presentation.js` gives just that specific view a camera-local **visual transform**: the existing ship mesh is re-parented to the existing camera at a lower-center position and fixed relative angular size. No duplicate model or extra ship geometry is allocated; the same object is returned to the ordinary scene when leaving Massive Overview. The presentation must not be used for collision or docking truth.

The branch uses a normal world-relative ship in every other world/mode, including Massive Forward and low/mid camera transitions. GLB dimensions must be computed BEFORE parenting to the ship (otherwise inherited high-altitude scale corrupts the angular-size estimate).

## Ocean surface cues at every altitude

Old V5 ocean streaks faded to zero above y~150, were faint and remained flat even while the ocean curved. V9 keeps **one fixed buffer** of 72 bright mint-white surface line segments, with speed-responsive opacity, spacing and length. They use real global ocean coordinates and semantic `isOcean()`/ground checks; no marks are placed deliberately on land. The cue material uses `curveMaterial` with the SAME live `horizonState` uniforms as the existing ocean mesh, so both surfaces project together when the world becomes curved. Do not create a second globe or animate the marks independently of actual ship travel.

The style model is `src/ocean-speed-style.js`; rendering is `src/ocean-speed-cues.js`. Existing `src/speed-perception-renderer.js` supplies a separate restrained 32-stroke peripheral airflow effect; these are NOT a replacement for actual ocean and cloud parallax.

## Acceptance / limitations

Test Current, Bigger and Massive at low, middle, third and top altitudes in both Forward and Overview. On Massive Overview the ship must remain large enough to recognize and stay on screen even with the globe center-stage; switching view or scale must restore the normal ship world transform immediately. In every scale, ocean markings must contrast clearly against the dark blue surface when moving quickly and disappear while motionless. At high-altitude globe view ensure marks do not show through the back of the sphere, flicker with surface depth, cover authored islands or create new planet meshes.

Pure math/geometry unit tests establish activation and resource budgets, not whether the result is cinematic or legible on a 4 GB Windows device. Browser visual validation is mandatory before merging.
