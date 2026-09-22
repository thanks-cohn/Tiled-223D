# V7 — Three planet scale profiles (experimental)

This branch leaves `main` and V6 unchanged. Choose the scale from **World size** in the flight HUD. The same two local island maps and three floating objects are reused in all demo profiles.

| Profile | Logical extent | Area vs current | Visual planet radius | Globe reveal altitude |
| --- | ---: | ---: | ---: | ---: |
| Current | 500 × 500 | 1× | 235 | ~445 |
| Bigger | 2,500 × 2,500 | 25× | 1,175 | ~2,225 |
| Massive | 16,000 × 16,000 | 1,024× | 7,520 | ~14,240 |

**1000× refers to surface area, not to 1000× the width on each axis.** Planets remain artistic projections of a periodic X/Z map. `radius` controls perceived curvature and orbital framing, not rigorous lat/long geography.

## Why a low-memory computer can render the massive choice

`src/scale-world.js` leaves `sourceWorld.ground` and `sourceWorld.heights` at 500². For Bigger/Massive, the *navigation world's* width and height become 2,500² or 16,000², but there is NO 16,000² tile array. Two islands are remapped as sparse semantic destinations with their original terrain meshes, footprint dimensions, height fields, and colliders. Everywhere else defaults to ocean. A single shared ocean mesh (6,481 vertices) is rebuilt ONLY when switching planet profile, with denser rings near the surface for smooth local curvature and sparse rings toward the globe. The 2D map overview uses a fixed 500² pixel canvas in the sparse profiles.

The four cloud decks keep their shared tiny texture and original fixed formations. In high-altitude globe view, sprites crossfade to shared-geometry cloud planes whose normals follow the LOCAL OUTWARD PLANET NORMAL, so the clouds lie parallel to the ground even as the world curves. No 3D volumetric cloud simulation, planet-sized height grid, second translucent blue globe, procedural island tiling, or cloud cards repeated for each grid cell is introduced.

## Camera jitter and stable coordinates

The authoritative ship travels using global double-precision JS X/Z coordinates (`pilot`). Per-frame render space subtracts the pilot's global X/Z; the ship and ocean are rendered at local 0,0 while real islands, floating islands, ocean glints, and cloud sprites/planes receive the SAME relative origin. Terrain/ocean shader curvature center is also (0,0). This is a **floating origin**, preventing 16,000-unit global positions from being passed repeatedly as GPU-relative camera/mesh coordinates.

The camera stays in local X/Z space and follows the ship with damping and an immediate reset on world changes. At high altitude it gradually raises the near clip plane to reduce z-buffer shimmer while keeping far clipping wide enough to see the planet at the highest supported flight altitude. The globe bends progressively; the camera looks toward its center at the top layer. This is a visual stabilization pass; actual hardware-specific jitter and frame rates still require interactive testing.

## What remains the same

- The **Current** demo keeps the original whole 500² terrain grid, island dimensions, and original local travel/flight behavior.
- Imported Tiled maps retain their exact dimensions in Current mode; scale selection is disabled after import until sparse-import support exists.
- Island slipstream rewards, conserved momentum, W/S collision escape, cloud texture budget, manual SUBSTRATE exit, ship import at `public/ship/ship.glb` and the optional Tiled exporter are preserved.
- The floating island geometry and semantics remain unchanged, but at altitude their visuals use the same radius as the chosen globe.
- The sparse world is still TWO original terrain clusters relocated farther apart. It is not a generated biome, an infinite landscape, or a truly globe-native world.

## Testing the visual result

Run `npm install && npm test && npm run build && npm run dev -- --open` on your computer. Switch between all three profiles, try Shift at low altitude, pass a floating island to earn the momentum bonus, and ascend until the globe is visible. Check that the planet remains center stage, the ship stays framed, the island geometry remains legible, the horizon doesn't shimmer, and cloud planes lie tangent to the world rather than standing upright. Run the 4 GB Windows browser with Low quality first, and compare responsiveness with Current. CI tests cannot certify actual device FPS or appearance.

**Known limitations:** The world still uses a stylized player-centered globe projection and wraparound map; there is no permanent global spherical lat/long mesh. Small local terrain meshes are not continuously subdivided on demand. A spectacularly fast ship can traverse even 16,000 units eventually, and occlusion/LOD at extreme speeds may need additional tuning. A proper celestial sun/moon cycle was discussed conceptually but is not implemented in this branch. The previous antivirus detection of the optional exporter is also separate from world-scale rendering.
