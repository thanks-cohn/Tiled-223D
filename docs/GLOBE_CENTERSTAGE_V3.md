# Globe center stage — experimental V3

This branch starts from the user-approved Horizon-First V2. It preserves the clean sky/ocean separation, opaque land and shared sea/shoreline deformation. It adds **one continuous change of viewpoint**: as the ship climbs, the same curved ocean becomes a visually complete sphere, not just the top edge of a ball. The camera gradually looks toward the globe's center rather than continuing to stare horizontally; the ship remains free to move at any altitude. Click **Return to SUBSTRATE** to exit explicitly.

## Three synchronized altitude experiences

- Low flight: readable low-poly islands, fixed reachable clouds and extra faint, **world-anchored** wisps. They move past the ship at real relative speed. Translucent middle-altitude clouds move at a distinct parallax rate; distant sky decoration hardly moves. Strong Shift acceleration and a moderate FOV increase reinforce the sense of speed without using heavy particle or post-processing effects.
- Climb (roughly altitude 105–445): the V2 horizon curvature appears gradually; the camera pulls back and increasingly favors the ground beneath you. Travel speed rises continuously with altitude. The original terrain remains fully colored.
- Near space (roughly altitude 445+): the same **single opaque** sea and matching terrain are projected as a round visual globe, centered in the camera. A ship can continue moving and turning around its wraparound 500×500 map with the planet underfoot. There is no forced transition at 500. The original Wake button remains the exit.

## How the single-globe visual works

`src/horizon.js` contains one GPU vertex transformation for the ocean and real terrain. At low altitude it uses the V2 flat/local curved horizon. At high altitude, let `d` be a vertex's horizontal distance from the ship's map position and `R=235` the chosen *visual* planet radius. The mapped surface uses:

```text
arc = min(d/R, π)
horizontal_distance = R × sin(arc)
vertical_drop = R × (1 - cos(arc))
```

Both water and real land are displaced by the same smooth blend of the horizon drop and the spherical transform, so shorelines do not hover above a separate globe mesh. A single radial ocean mesh has a higher density of rings for a smoother curvature; there is **no translucent sphere added over the world**. Island material colors remain readable. The renderer disables outdated flat-space frustum culling for GPU-projected land.

**Important:** This is still a *local, player-centered visualization of a wrapped planar map*, not a physically global geographic projection. At very high altitude the apparent planet follows the observer and landmarks re-wrap as you cross their 500×500 map boundaries. A future true global globe must give every semantic object a stable latitude/longitude and tangent transform. Floating islands remain independent airborne 3D objects; they are not forcibly projected onto the ocean's surface.

## Speed and low-memory safeguards

Shift has an intentional 8× multiplier over normal horizontal speed before the shared altitude multiplier, with smoothed acceleration and graceful slowdown. At altitude safely above the globally highest terrain tile and structure, the engine skips redundant sub-step surface collision sampling, preventing ultra-fast empty-sky flight from generating dozens of unnecessary checks per frame. At lower altitude the collision checks remain active. A handful of very faint flyby cloud cards reuse the existing small cloud texture; no new volumetric clouds, huge texture files, render passes or expensive spherical scene overlay.

The rendering is an artistic prototype. Automated code tests validate continuity, shader uniform wiring, globe mathematics and speed ranges, but the actual sense of speed, globe framing, ocean seam and GPU performance **must be evaluated in the browser on the 4 GB machine** before merging.

## Try the ascent

Start `start-world.bat` from an extracted ZIP of this branch. Fly normally, hold Shift low over the water, then climb through 150, 280 and 445 units. Keep flying after altitude 500. The world should become round and remain near the center of the view. Descend and verify a smooth return to the ordinary clear horizon and normal flight. Press M for the existing overhead map; choose Return to SUBSTRATE when you actually wish to exit.
