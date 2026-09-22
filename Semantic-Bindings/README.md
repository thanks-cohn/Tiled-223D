# Semantic-Bindings — agent navigation and source of truth

This directory is an **agent-readable design contract**, not a runtime plugin. Read this file before editing the Tiled-223D world or adding new cloud/weather features.

## Purpose

The user wants a dreamlike world with four distinct cloud layers and four altitude-dependent aesthetic moods. At low altitude the sea-level sky must be beautiful and high clouds remain visible overhead. During active ascent, actual movement through nearer cloud formations should make acceleration feel substantial. Higher still, clouds should emphasize depth and scale without losing beauty. Near space, a sparse cloud layer should follow the globe while the ship can still move. Preserve a clear sky/ocean horizon, legible island geometry, low memory overhead and the existing island flyby momentum system.

V6 is deliberately implemented on `feature/four-layer-atmosphere-v6` based on `feature/ocean-momentum-v5`. Nothing in this branch changes the 500 × 500 world size, the requested future 50,000 × 50,000 plan, collision, the spherical terrain shader, flight speed, or the optional `extension/substrate-world.js` exporter. **Do not imply that a 50,000-unit sparse-world system or real weather simulation was built in this change.**

## Code and authority

- `src/atmosphere-model.js` — **authoritative parameters** for four decks, four blended altitude moods, visibility and expected apparent-motion profiles. Keep this module pure so agent changes can be tested without WebGL.
- `src/atmosphere-renderer.js` — reads that model and creates a fixed sprite pool from one small procedural alpha texture. It exposes `createAtmosphere(scene)` with `update(ship, world, time, profile, speed)`, `getSummary()`, and `dispose()`.
- `src/terrain.js` — re-exports `createAtmosphere` as `clouds`. This retains the existing import contract used by `src/main.js`. **Do not reintroduce the old three-deck cloud implementation there.**
- `src/main.js` — already passes ship location, world dimensions, simulation time, altitude profile and actual momentum to the cloud system once per frame. Keep that signature; the renderer owns all cloud graphics and does not mutate ship motion.
- `src/flight-model.js` — authoritative flight-speed and globe-reveal profiles, which clouds may read but **must not override**.
- `src/horizon.js` — globe projection source of truth. Planetary cloud cards use `globeSurface` to float just above the ONE opaque globe ocean. Do not create a second translucent blue globe or apply opacity to island geometry.
- `tests/atmosphere-model.test.js` — checks IDs, budgets, altitude blending and motion hierarchy; expand when changing the contract.

## Why the implementation uses four decks

| Semantic deck | Approx. visual height (local units) | Why it exists |
| --- | ---: | --- |
| `low` | 72 | Real, world-anchored reachable cloud centers. Nearby movement, low-altitude speed, and fly-through experience. |
| `middle` | 153 | Greater optical depth and a slower-feeling second cloud layer, notably around active and high ascent. |
| `high` | 282 | Large cinematic sky formations that remain visible from near the ocean. Slow relative apparent travel, especially compared with the low deck. |
| `planetary` | Surface + 12, globe projection | Sparse high-altitude clouds that sit above the spherical ocean; dormant until the globe reveal begins. |

These values describe **presentation layers, not world terrain elevations or collisions**. Near and middle clouds are at separate world-relative heights and positions: near clouds move past a fast ship more rapidly in the image because they are spatially closer. The high deck is a sparse, deliberately distant camera-relative decorative sky ring; its slow angular movement keeps majestic cloud cards visible just above the horizon from low altitude without making them reachable. Planetary cards follow the globe's visual surface. Independent low/mid/high/planet wind parameters (0.36 / 0.15 / 0.045 / 0.018) govern gentle layer-specific drift rather than ship acceleration. The model's `relativeMotion` numbers are semantic diagnostics, not arbitrary speed multipliers applied to the actual ship or collision world.

## Four altitude moods, smooth transitions

The pure `altitudeCloudProfile(altitude,globeReveal)` function returns `moods`, `layers`, and `dominant`:

1. `cinematic-hover` around altitude 0–65: near ocean the lower deck stays reachable, middle clouds create depth, and majestic high clouds stay visible overhead. The planet-only layer stays hidden.
2. `active-flight` by approximately altitude 110–160: low and middle decks are emphasized for a highway-like speed sensation; high clouds remain slower and artistic.
3. `expansive-ascent` by approximately altitude 225–300: low clouds are increasingly below, middle and high decks give depth, and the planetary deck gradually becomes eligible when `globeReveal>0`.
4. `planetary` after about altitude 390: low clouds retire from prominence, the high atmosphere becomes a quiet background, and limited cloud cards appear above the curved globe surface. The original flight/camera system remains in control.

The transition gates are `smoothBand(65,110,h)`, `smoothBand(160,225,h)`, and `smoothBand(300,390,h)`. The gates DO NOT make the sky abruptly switch when the ship enters a new elevation band. Cloud material opacity follows continuous weights.

## Performance budget and hard invariants

The fixed pool has 9 low + 6 middle + 6 high + 6 planetary = **27 small sprites**, all backed by **one 128 × 64 alpha texture**. There are **no volumetric passes** and no per-frame sprite/texture creation. The renderer hides inactive cloud decks and distance-fades others; it does not load a new sky texture for every elevation band. The actual number of draw calls is renderer-dependent; this is not a guaranteed FPS on the user's 4 GB Windows PC.

Do not replace these with hundreds of transparent full-screen quads, video textures, extra planets, or all-draw-all layered meshes. Preserve world-anchored low cloud centers and do not let cloud math alter terrain height, docking logic, ship speed, island visual positions, or world wrapping. Preserve manual exit to SUBSTRATE and the prior light-blue sky versus deeper-blue ocean separation.

## Adding new features safely

- Tune weights/heights/counts in `atmosphere-model.js`; keep layer IDs stable for external agents.
- For a storm, define a **new optional semantic weather region** with a world coordinate and bounded effect. Do not replace the high sky with permanent darkness, and do not make all clouds follow the camera at the same speed.
- For a larger sparse world, move local sky anchors to a world manifest and stream a small fixed pool using global coordinates. Do not allocate width × height cloud arrays.
- For future custom image clouds, reuse the same pool and permit a validated, explicitly imported replacement texture; never execute arbitrary downloaded script or untrusted map metadata.
- For any user report of antivirus detection, investigate the exact file and detection, preserve the legitimate exporter unless directed otherwise, and do not ask users to disable antivirus.

## Acceptance path

Run `npm install && npm test && npm run build`. In a browser, fly at heights 35, 130, 260, and 445, then descend; confirm that high clouds are visible from sea level, cloud groups have different optical movement, no layers pop at transitions, planetary clouds appear near the globe without obscuring the islands, and the low-altitude ocean remains legible. FPS and appearance on 4 GB hardware require direct measurement.
