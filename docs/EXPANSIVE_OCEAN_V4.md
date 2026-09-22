# V4 — Expansive Ocean, Preserved Cluster Scale

This branch extends V3 and **does not resize the 500 × 500 world, island geometry, or cluster assets**. It implements the requested *perceived travel requirements*: small islands, their nearby floating structures, and their protected circular regions retain V3's familiar flight speed. The open ocean between them takes significantly more travel time when flying near the water, without faking movement or stretching visual geometry. At altitude, the normal V3 travel speed returns; Shift still provides substantial acceleration across ocean.

## Current implementation

- Each small connected landmass receives a semantic circular protected region with a **minimum diameter of 100 units**, based on the current demonstration's small island-plus-structures scale. Its protected diameter can grow only enough to contain its existing associated assets, up to 158 units in this first demo. This is a *minimum local normal-speed diameter*, not a new visible island diameter.
- Named floating-island clusters are grouped by parent identity, including the `sky_archipelago`. When a sky cluster overlaps ground land, both share one protected local travel region. No duplicate island is introduced. The same world-wrap logic applies on both sides of the map.
- **Inside protected regions:** normal V3 movement, collision checks, position, geometry, and Shift behavior are unchanged.
- **Open ocean outside protected regions:** smoothly transition to 0.11× ordinary low-altitude horizontal travel speed, or 0.22× of the already powerful Shift turbo. This is a gameplay choice: near the surface, crossing the empty sea is a longer journey, but accelerating remains meaningful.
- **Ascending:** the perceptual ocean restriction eases out smoothly between altitudes 95 and 260; at high altitude the familiar V3 accelerated planetary traversal returns. Descending restores the longer ocean journey. Shoreline and local-region boundaries blend over 20 units.
- **Only ocean is enabled now.** Future sand, desert, and huge land expanses can get their own region-distance rules without scaling an entire continent or erasing small protected local scenes.

The map, geometric island radius, collision position, world wrapping, existing curved horizon, and spherical visual projection remain separate from the semantic **travel-speed profile**. There is no additional ocean geometry or memory-expensive expanded Tiled grid.

## Ancillary V3 visual fixes

The preceding globe-view screenshot showed the ship disappearing and floating islands/card sprites visually remaining in planar positions while the ocean was mapped into a sphere. V4 scales only the ship's **visual** representation at altitude and raises/tightens the chase camera, without changing collision dimensions. The same globe projection now positions floating-island visuals and turns their tops outward, so the bottom of each airborne island faces the globe while its full size is retained. Their collision truth is still the original semantic flat-coordinate model; true spherical navigation and globe-accurate spatial interaction are future work.

## Tuning

Use `src/travel-regions.js` for `localMinimumDiameter`, `maxProtectedDiameter`, `boundaryBlend`, `oceanCruiseFactor`, `oceanTurboFactor`, and `altitudeRecoveryStart/End`. The renderer and ship speed logic consume its semantic region classification. The `mode` label in the in-game HUD indicates when an expansive-ocean rule is active. Future generalized regions should preserve every source object's stable IDs and collision data.

## Test / remaining limits

Run `npm install && npm test && npm run build`, then `npm run dev -- --open`. Fly around the first island and its nearby floating archipelago, cross open ocean at ordinary speed and Shift turbo, then ascend and descend to feel the different traversal requirements. On the globe view, inspect ship visibility and floating-island orientation. At present, positions wrap around the existing 500 × 500 world. This adds travel-time spaciousness, **not physical geographic enlargement**: extreme turbo will still traverse the 500-unit circumference quickly. A later genuine large-world topology would be a separate feature. Browser visuals and frame rate on a 4 GB device remain to be checked before merging.
