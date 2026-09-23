# Semantic binding: scale-profiles-v1

**Agent handoff — read before changing this branch.** This document records what V7 implements and why. The canonical machine-readable schema is `Semantic-Bindings/scale-profiles-v1.json`. See [human design/test notes](../docs/SCALE_PROFILES_V7.md).

## User intent

Three deliberate world scales in one inexpensive browser renderer: **Current**, **Bigger**, and **Massive** (~1000× *surface area*). The user wants an enormous ocean and satisfying speed without repeating the same island every 500 units, while preserving local island dimensions, cloud beauty, visual globe curvature and 4 GB computer usability. At high altitude all visible cloud formations must lie PARALLEL to the planet's local curved ground, not point at the camera.

## Source-of-truth map

| Source | Authority / why |
| --- | --- |
| `src/scale-world.js` | Three logical world extents and radii; copies only semantic island references and world-relative offsets. The 500×500 source terrain is never enlarged. `groundAt` queries original grid only near destinations in Bigger/Massive; otherwise returns ocean. |
| `src/main.js` | Flight uses global JS coordinates in `pilot` but positions ALL rendered X/Z relative to the pilot; reset camera immediately when changing scales. The scale selector calls `makeScaleWorld`. |
| `src/horizon.js` | SINGLE opaque ocean mesh and shared terrain vertex deformation use variable planet radius. Fixed vertex count, near-range ring distribution to keep sea smooth. |
| `src/flight-model.js` | Altitude and globe-reveal transitions scale with the planet, so a massive world doesn't show its entire sphere as soon as the small world would. |
| `src/atmosphere-renderer.js` | All 27 small cloud formations retain shared texture. When ascending, camera-facing sprites crossfade to PLANE geometry; normals follow radial outward planet direction. Keep that ground-parallel requirement true for all visible high-altitude decks. |
| `src/world-map.js` | Sparse overview is ALWAYS a bounded 500×500 image. Never allocate a 16000×16000 canvas. |
| `src/ocean-speed-cues.js` | Original world-anchored glints use global ship coordinates but produce render positions with the same floating-origin subtraction. |
| `tests/scale-profiles.test.js` | Geometry budget, area ratios, island identity, ocean, globe altitude and global coordinates. |

## Preset meaning

- `current`: 500×500 logical world; 250k source tiles reused directly; radius235 and unchanged near-island flight rules.
- `bigger`: 2500×2500 logical ocean; 25× current surface area; radius1175; the SAME detailed source island geometry moved to sparse destinations.
- `massive`: 16000×16000 logical ocean; 1024× current surface area, NOT a thousand times the coordinate width; radius7520; same source meshes and cloud pool.

Keep local cluster size/footprints and landing/collision coordinates intact. Across the ocean, V5's momentum persists and speed can grow with time; high-altitude acceleration scales by world profile. The 16000 unit coordinate period means the ocean crossing is genuinely farther than before. This is **not** a physical lat/long world, an orbital integrator, or a map with 256 million tiles.

## Numeric and optical invariants

1. `pilot` is a JS global X/Z; the GPU sees the ship at render X/Z=(0,0). Camera, cloud cards, landmarks, ocean and horizon shader MUST share that origin. Keep global coordinates only in navigation/collision/semantic state.
2. Planet radius and altitude scale are profile parameters, not multipliers applied to local island sizes. The near-view island geometry and flight controls must remain familiar.
3. When globe reveal is high, the NORMAL of every visible cloud plane must point outward from the sphere at its location; it must NOT continuously face the camera. The crossfade between sprite and plane must remain smooth.
4. Maintain exactly one water mesh; avoid big transparent blue overlays or generating per-tile ocean geometry. Fixed ocean vertex budget.
5. Maintain one 128×64 alpha cloud texture and 27 logical cloud formations; extra cloud planes share one plane geometry and appear in place of billboards as altitude rises.
6. The sparse top-down map display always consumes <=500×500 pixels.
7. Do not change `extension/substrate-world.js`, an optional Tiled exporter previously involved in an antivirus report. Resolving the security warning is a separate task, not solved by scale rendering.
8. Validate unit tests/build and browser visuals/performance. CI success cannot establish target FPS, absence of jitter on the owner's GPU, or clean antivirus status.

## Future agent work

New planets can define scale/radius/cluster coordinates semantically. Bigger/sparser maps should stream full clusters only inside near distance, then reuse LOD silhouettes. Future sun/moon lighting and storms were discussed but are **not part of V7**. Never increase ground array dimension to achieve greater ocean distance, and never treat local shader appearance as proof of correct full spherical geography. If the user requests 1000× linear world dimensions, clarify that this is different from the present 1024× area preset before changing the schema.
