# Dreamlike altitude flight — experimental branch

Branch: `feature/dreamlike-altitude-flight`. This is an experimental stand-alone rendering/flight implementation, NOT a fully spherical planet, not merged to `main`, and not integrated with FrameChute.

## Experience

The same 500 × 500 semantic Tiled world is used at every altitude. Near sea level the flight speed is controllable, distant islands stay visible through the existing impostor system, the ocean is dark blue, and the sky is distinctly lighter blue. W/S accelerates and decelerates smoothly; A/D banks the ship and the camera responds with restrained lag. Releasing movement eases out of speed rather than abruptly halting.

Ascending gradually changes the experience rather than switching between hard scenes:

- **Overworld (below about 110 units):** normal flat landing/world geometry, visible horizon, world-anchored fly-through clouds, and far atmospheric sprites.
- **Atmospheric climb (roughly 110–285):** continuous acceleration multiplier, widening view, increased camera distance/height, gentle downward gaze, and a curved ocean representation blending over the flat ocean. The original ground island meshes dissolve into two tiny map-derived spherical-surface proxies. This is a visual transition, not an authoritative topology or collision change.
- **Near space (above roughly 285):** a spherical ocean occupies the lower view and the sky darkens progressively. The two land-proxy discs orient along the **local outward sphere normal**. The ship continues to move on the original wrapped X/Z map. At altitude 350 the existing warning appears; at 500 the existing wake/exit placeholder triggers.

W and Shift increase horizontal travel distance at higher altitudes. On descent speed returns smoothly to ordinary flight: the experience of approaching a location should feel slower and more detailed than crossing the overworld from above. Distant sky wisps, middle-atmosphere clouds and anchored fly-through clouds use distinct, inexpensive motion rates; no volumetric simulation or ML needed.

## Implementation contracts

`src/flight-model.js`: pure continuous altitude functions for speed, camera, sky/cloud fade and curvature. Speed is **game design**, not real orbital physics. Smoothing uses exponential damping for approximate frame-rate independence. Edit altitude thresholds and multipliers there.

`src/planet-visuals.js`: lightweight visual-only sphere (radius 420 units) whose top stays at sea level beneath the ship. It fades in as the flat plane fades out. High-altitude land discs are generated only from existing map-connected landmasses and placed on the spherical surface; they are not extra islands. The island geometry remains untouched for navigation and collision; the upper-level view is an intentionally simplified presentation. On import, the visual discs are regenerated once from the imported map.

`src/main.js`: movement, turn banking, camera chase, FOV, planet and clouds all consume the same profile. Existing ship/terrain physics and floating-island semantic identities remain authoritative. The current standalone app still has an optional imported ship GLB and basic upward exit to a canvas placeholder.

`src/terrain.js`: three sky depth bands share one small cloud texture and physical clouds remain traversable. No network image dependency is required.

## Known limitations

This is an **apparent local globe**, not a globally consistent spherical coordinate system. The sphere tracks the camera's tangent point and the authoritative 500 × 500 world still wraps as a planar repeated map. The tiny high-altitude island discs are approximate and do not yet conform arbitrary terrain height/shape to a sphere. High-altitude floating structures are faded out with the local meshes rather than separately projected along their surface normals; a future semantic placement adapter should transform arbitrary nested clusters and collision surfaces when true planetary coordinates are implemented. No orbital mechanics, horizon-accurate atmosphere scattering, true planet-scale LOD streaming, or seamless FrameChute integration is claimed.

Increasing speed does not magically increase apparent motion of ground at fixed world speed; the implementation explicitly increases actual X/Z velocity at altitude while camera/parallax and the changing world scale reinforce the journey. The 4 GB PC performance needs in-browser verification, especially the ocean/planet crossfade and transparency sorting near the atmospheric transition.

## Test path

`npm install && npm test && npm run build && npm run dev -- --open` from the ZIP of this branch. W to fly, A/D to bank, ↑ to ascend, Shift to boost, ↓ to descend, M for the map. Test low altitude near an island, climb beyond 200 to see curvature, beyond 300 for planet view, and return below 100 to verify the same location and gentle speed. Inspect visual blending on a 4 GB Windows PC; automated JS tests cannot prove visual quality.
