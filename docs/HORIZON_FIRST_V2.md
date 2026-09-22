# Horizon-first V2 — single ocean, clear islands, gradual ascent

**Status:** Experimental branch `feature/horizon-first-v2`. Its parent branch is `feature/dreamlike-altitude-flight`; neither experimental version has been merged into `main`.

## What changed and why

The first ascent prototype combined a giant translucent blue sphere with a flat ocean and faded the real terrain into separate island-proxy discs. That made real structures look washed blue, made the proxy land appear detached from the ocean, and added overlapping transparent geometry/material updates.

V2 removes that visual globe path from the running viewer. Its ONE ocean is an opaque, low-detail radial mesh with a smoothly bent outer region. The ocean stays dark blue and the sky remains a separate, lighter color. The curvature strength changes continuously with altitude; there is no second blue sea drawn over objects. Normal landmasses remain fully opaque and readable at every altitude; they are **not swapped for spherical placeholder discs**.

## One shared mathematical surface

`src/horizon.js` defines one displacement function used by *both* the ocean and ground meshes through shared shader uniforms:

```text
distance = length(worldXZ - shipXZ)
beyond = max(0, distance - flatRadius)
verticalDrop = altitudeCurve * beyond² / (2 × visualRadius)
displayY = canonicalY - verticalDrop
```

The first 105 units around the ship remain visually flat, preserving the local flying/docking context. Outward terrain and ocean curve down together, so sandy shorelines cannot become detached just because the horizon begins to bend. An imported map is handled using the same material shader. This is a **visual approximation**, not a full spherical planet model or spherical collision physics; in-world semantic X/Z and terrain/collision heights remain canonical.

The ocean is one opaque GPU-rendered radial mesh (about 4,000 vertices) rather than a semi-transparent globe on top of a second water plane. The game updates a few uniform values per frame instead of repeatedly walking land meshes to change their transparency and depth-write state.

## Motion and atmosphere

The preceding experimental branch's altitude-based speed, smooth acceleration/deceleration, ship banking, camera follow and multilayer cloud parallax remain in place. The camera now looks outward toward the horizon during ascent instead of steeply down into a huge apparent blue ball. Floating islands remain **intentionally** airborne and retain their normal geometry and painterly billboard LOD; the surface attachment rule applies to ordinary ground islands.

## Known limitations / acceptance check

- This is a local tangent/horizon illusion. At higher altitude it shows a bending sea, **not a complete planet**. A proper globally spherical map projection and outward-oriented buildings/landmasses are separate future work.
- The horizon shader is smooth in height but the low-poly ocean silhouette, camera angle, map boundaries and shader compilation need to be checked visually on the user's 4 GB Windows PC. Automated unit/build tests do not establish visual quality or FPS.
- Land vertices and the matching sea deform for display only. The 2D map, collision, existing procedural island geometry, and movement coordinates do **not** become spherical.
- Future upgrades can add a carefully projected, seam-free planet surface after this horizon-first presentation is approved, without ever bringing back a semitransparent blue overlay on top of structures.

**Review:** start the branch in a fresh extracted directory via `start-world.bat`. At low altitude confirm the islands touch the ocean and retain color. Climb through ~120–300: the horizon should bend gradually while ordinary island shorelines remain affixed and floating islands remain separately airborne. Descend again: horizon returns to its low-altitude appearance and travel returns to normal speed. Check CPU/GPU load and screenshot any visual glitches before merging.
