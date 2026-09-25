# ÆXIS Expansive World: Road-Corridor Continuity, Level 2 Countryside, and Authored 3D Destinations

**Status:** Shared design proposal, not an assertion of implemented features.  
**Shared owners:** `thanks-cohn/Tiled-223D` (ÆXIS reference world/engine), `thanks-cohn/substrate` (creator workspace), `thanks-cohn/framechute` (optional browser-extension integration).  
**Related proposals:** `portable-visions/AEXIS_PORTABLE_INTERACTIVE_EXPERIENCE_STANDARD_PROPOSAL.md`, `portable-visions/AEXIS_CAMERA_COMPOSITION_AND_CREATOR_PRESETS_PROPOSAL.md`; preserve existing camera/LOD bugs and world API contracts.  
**Core premise:** ÆXIS is ultimately an independently editable 3D world in which Tiled maps are importable sources for authored *places*, not a mandatory infinite master tile map. An expansive road gives continuity in an active driving/low-flight corridor; the countryside outside that corridor is a light mathematical visual representation; detailed Tiled-derived locations resolve at their actual placed positions as the player approaches.

## 1. Creator intention: a believable huge world from a small starting point

Creators should be able to start with an ordinary Tiled map and its known terrain/roads/vegetation, apply the existing/proposed 2D-to-3D filter and make a 3D place. They should be free to import additional places by right-clicking in the 3D world, placing the resulting region, and using a directional arrow on its bottom placement plane to orient it. Source map and filter remain references, while additions created after conversion are independent editable world content, not restricted by the original map footprint. The optional world overview can display region footprints/squares, orientation and reference points; it need not itself be a fully authored master Tiled map.

Some regions can receive an **Expansive Ocean** treatment and some land/road corridors an **Expansive Road** treatment. The goal is *not* to construct a newly invented fully detailed continent every time a creator asks to increase apparent world size, and not to stretch a few pixels into giant featureless surfaces. Preserve the original authored spatial identity where it exists; represent the surrounding un-authored countryside with coherent, low-cost biome-aware color/shape/elevation patterns until a specific authored destination comes close.

The player should be able to fly and drive great distances, feel that the environment continues, and eventually discover detailed authored places; the engine should avoid obvious short repeating loops, visual pop-in, unexplained road jumps and excessive low-end memory/compute use.

## 2. Three distinct spatial/rendering systems — do not conflate them

### A. Road corridor: conditional Expansive Road

**Activation is spatial and physical, not “at altitude band 2 or 3.”** Expansive Road is active if the player is (i) driving on the selected road, or (ii) flying **directly above the road within approximately 50 feet of the local road surface**. Measure vertical clearance from the local road surface, not absolute world altitude or distance to the planet center. Require horizontal proximity to the actual road corridor/centerline or footprint, not just being low anywhere in the world. Make this 50-foot default an adjustable per-road parameter through intuitive UI and typed API. Use hysteresis and smooth presentation transitions to avoid rapid on/off at the exact boundary; preserve authoritative navigation/vehicle momentum when enabling/disabling the visual extension.

A creator selects a repeat-compatible original road patch/segment and an intended direction. For a simple straight road, extend it in front and behind along its tangent, keeping original width, texture, centerline, surface/road-edge alignment and local height continuity. Do not generate all sections in advance: maintain a bounded nearby render/contact window, an inexpensive distant representation, and deterministic logical segment indices so reversing direction reveals the same route. A road may terminate, branch, curve or connect to an authored destination where specifically declared; do not force all roads to be physically infinite or blindly tile mismatched bent patches. Validate start/end edges (width, elevation, direction, surface texture UV) and provide seam treatment. The right-click Tiled-region placement arrow establishes the relevant local direction; do not hardcode world north.

**Road repetition is intentional. Countryside repetition is not.** The road can use the same segment over and over as desired. Surrounding bushes/forest/desert/grassland must not simply repeat a rectangular road+landscape tile with the same bushes at the same offsets every few meters.

### B. Surrounding countryside: standardized Level 2 lightweight visual representation

The wider countryside surrounding the road and between specific authored destinations uses an economical **Level 2** generic-but-biome-aware representation: color/altitude tiles, simplified shapes, coherent topographic variation, sparse silhouettes/canopy patches and shading as needed. It can visually suggest grassland, forest, desert, rocks, scrub and other authored environment categories without instantiating individual distant trunks, rocks and bushes or a full 3D Tiled world for every square meter. **The road's 50-foot criterion does not apply to this countryside**; it is a separate representation policy. The precise behavior of Level 1 and Level 3 and any fourth atmospheric band should be reconciled with the current project's existing altitude-band definitions in a later design slice; do not casually renumber or redefine working band boundaries. A player's altitude band, actual view distance/projected size and proximity to a specific authored location are different inputs.

Level 2 should preserve recognizable semantic character:
- Grassland: spatially coherent light/dark greens, grass-like clusters, occasional bushes, modest height/color variation.
- Forest: canopy-shaped masses or reusable top-of-tree proxies, plausible density and clearings, forest-type colors/shading. Nearby imported/custom assets are represented faithfully where source material is available; generic distant forest pattern need not know how to construct every full 3D tree.
- Desert: continuous sandy color families, muted dune/rock/scrub shapes and low-frequency height variation rather than one flat tan plane.
- Dirt roads/paths: authored course and width preserved where actually specified; the active Expansive Road itself remains a separate system.
- Other biomes: extensible semantic profiles/creator overrides; never infer that one categorical color can substitute for all shape/topography.

Derive the visual grammar from the original Tiled source and/or the creator's explicitly selected conversion/filter/biome profile: placement density, patch-size distributions, major boundaries, palette, elevation/slope rules, permitted variation, road clearings. An uploaded custom GLB tree/bush should not require an invented procedural mesh generator: capture optional overhead/angled camera views, derive a lightweight texture, silhouette or bounded shape/color/shading recipe once, cache it, and use a corresponding placement pattern. Preserve its authored appearance as far as the chosen visual budget allows, and report where a single overhead proxy cannot accurately reproduce a side view. The simplest captured image/impostor path is valid; mathematical extraction/vectorization is an optional optimization or aesthetic mode, **not** a mandatory costly vision/ML stage.

### C. Authored destinations: placed, detailed Tiled-derived regions

A specific Tiled map marks an authored geographic *destination* with a stable world identity, footprint and placement transform. As the player approaches that actual location, its 2D-derived 3D terrain, roads, vegetation, structures, source elevations and creator additions resolve underneath them, replacing the generic countryside **inside that region's footprint**. This is not randomly inventing a new Tiled map while flying; the destination already has a fixed reference location and source/converted content. Far away, show a low-detail proxy/footprint matching the destination's salient layout; as approach begins, stream/prepare its detailed geometry and collision *before* a fast-flying/landing player reaches it. Blend visual levels to avoid a sudden unrelated village popping into existence. Roads should meet compatible authored road junctions at the boundary; preserve height, texture and object positions during the transition.

The Level 2 countryside may continue outside the authored footprint, but the authored destination has priority inside its protected boundary. No procedural bushes/trees may spawn atop its existing roads, buildings, water or manually placed creator assets. Reimporting/reconverting the source Tiled map must not silently erase subsequent native 3D edits. Maintain correct wrapped/global coordinates and floating-origin visual transforms without moving the pilot or changing canonical map elevations.

## 3. Variability without nauseating, obvious repeats

Use *deterministic continuous world-coordinate functions* and multi-scale seeded pattern synthesis—not independent re-randomization on every frame or copying the same complete terrain square in lockstep with each road segment. Low-frequency fields determine broad grass/forest/desert shape and color variation, mid-frequency fields determine bushes/canopy clusters and local elevation shifts, and high-frequency fields add selectively rendered microtexture where its projected size warrants it. Sample the same absolute semantic coordinates and stable seed on return trips, across chunk boundaries and after save/reload. A small catalog of creator-uploaded asset proxy templates can be rotated, tinted, scaled within valid bounds and reused with parameter variation. Ensure repeatability of *places* for navigation while avoiding visually obvious small-loop pattern repetition; do not promise a literal mathematical guarantee that no pattern can ever recur in an infinite finite-content world.

Use the existing/proposed wave/cloud-inspired **three-to-four alternating distance-layer presentation** to manage density, silhouette, color and detail: e.g., near road verge, middle countryside, far countryside and optional horizon accent. Three/four visible layers may alternate as the player advances for a richer sense of changing scenery, but layer-count changes are presentation/LOD changes, **not random relocation of persistent bushes, road or authored objects**. Use stable spatial sample coordinates, crossfades or overlap, consistent height/normal/shading and bounded draw calls. Preserve local camera-visible ground alignment and altitude/world-curvature visuals. No per-frame asset recapture, unbounded texture allocation or second full simulation.

## 4. Roads that can be driven and flown above

The road surface/collision must be available ahead of an actively driving or low-flying player, at a suitable prediction/look-ahead distance for their measured velocity and possible descent; visuals cannot extend while collision ends invisibly. Flight directly within the 50-ft vertical corridor may trigger the extended road while retaining the actual ship flight controller (do not silently force driving). During glide/landing, load enough contact/suspension data before touchdown and carry forward momentum into ground mode when implemented. The road corridor should remain continuous when flying 30–50 ft up, driving, braking, reversing, turning around and crossing ordinary chunk boundaries.

High-altitude observers outside the corridor do not need repeated nearby detailed road meshes just for their current position, but a bounded visual road shape and landmark still may remain visible as part of the global low-detail representation. Switching off **active extension** must not erase existing authored roads or incorrectly reset the player. A player departing the road horizontally should leave the active corridor under the same clearly defined hysteresis/visibility rules.

## 5. Elevation, color tiles, scaling and semantic fidelity

Keep the original Tiled-derived elevations and protected authored structure intact. Generic countryside heights/colors can be lightweight altitude tiles or coarse meshes with biome-aware shading. They must connect to the authored region at the boundary: match boundary height/slope constraints or use an intentional authored cliff, coast, road cut, etc. Do not expand land by simply multiplying every original tree, road, path and terrain texture until visibly oversized. Preserve dimensions/density of recognizable objects, and use new *representation detail* inside permitted areas. Where a world-scale increase changes distances, distinguish mapping of exact authored landmarks from procedural countryside sampling. Creator-facing controls should clarify what “scale” does: extent of active road, world-space separation, displayed terrain pattern scale, or actual object dimensions.

The original forest crescent, road corridor, landmark and coastline are protected where mapped. The wider countryside only reproduces the source's visual vocabulary under controlled constraints; it does not claim to preserve precise positions of un-authored objects that never existed. Render land as recognizable patterned topography and color rather than substituting generic blue ocean fill for expansive non-ocean terrain.

## 6. Programmatic/agent interface and simple browser UX

Expose the same shared, typed/versioned data via intuitive editor controls and programmer/agent APIs:
- Right-click world `Import Tiled Map`; select conversion/filter; preview placeable 3D footprint; rotate its bottom-plane directional arrow; set position/elevation/scale and commit. Preserve original source and later 3D additions separately.
- Select road `Enable Expansive Road`, choose compatible source segment, extension forward/back/both, corridor lateral tolerance, road-relative clearance default 50 ft, segment seam/junction behavior and road/window detail budgets. Offer a visual corridor preview and exact numeric fields alongside sliders.
- Choose Level 2 countryside biome/filter profile, editable palette, topographic variation, density/clustering, three/four distance-layer presentation, stable seed, author-protected region boundaries, proxy source for custom GLBs and resource budget; give simple presets first and precise advanced edits.
- Place/import specific authored destinations, show their overview footprint/square, collision/rendering readiness, approach distances, representation transition, road/terrain seam and source Tiled reference. Support nearby asset/region inspection, plan/preview/validate, explicitly authorized commit, undo and revision protection when the World API supports them.
- Allow disabling/overriding any default and preserving the project's own saved baseline. Do not make the expensive full editor or Tiled itself necessary merely to consume the runtime representation.

Illustrative **proposed** host-agnostic manifest (not shipped API):

```json
{
  "expansiveWorldVersion": 1,
  "roads": [{
    "id": "road.main",
    "sourceSegment": "authored-road-patch-01",
    "extend": "both",
    "activation": {
      "drivingOnRoad": true,
      "directlyAboveWithinFeet": 50,
      "lateralCorridorFeet": 25,
      "hysteresisFeet": 5
    },
    "repeatPolicy": "seam-validated-deterministic"
  }],
  "countryside": {
    "representation": "level-2-semantic-altitude-color-tiles",
    "biome": "grassland",
    "seed": 13579,
    "distanceLayers": { "min": 3, "max": 4 },
    "sourcePattern": "imported-region-01",
    "protectAuthoredFootprints": true
  },
  "destinations": [{
    "id": "village-01",
    "source": "maps/village.tmj",
    "conversionFilter": "grassland-v1",
    "placement": "world:placed-region-01",
    "approachPolicy": "prepare-before-contact"
  }]
}
```

Every field above is provisional. Units, coordinate frame, map/GLB IDs, road-footprint tests and renderer-supported scopes need a formal validated contract; don't fake support for absent source maps or collision primitives.

## 7. Performance: apparent endlessness under bounded resources

Target the same ~4 GB low-end Windows/browser machine when feasible. A large logical world should not allocate a world-width × world-height array, countless road meshes or all individual custom GLBs. Keep a bounded road segment/contact window and near player detail; batch/instance repeated road parts and vegetation proxies; reuse cached textures/materials; use shader/procedural coarse ground where practical; stream authored destinations only as needed, with prefetch based on actual velocity/direction and conservative landing safety. Avoid huge CPU sampling every frame; profile draw calls, GPU alpha overdraw, texture memory, terrain seam operations, collision readiness and actual frame time. Correct distant curvature/tangent alignment of proxies using the *existing* world visual transform, without inventing a second planet or compromising physical world coordinates.

The project should never advertise “infinite fully simulated terrain”; the aspiration is large apparent continuity backed by finite authored islands, repeatable road rules and bounded procedural visual fields.

## 8. Scope, stages, tests and user-visible acceptance

**Stage 0 — Existing-code audit:** Read AGENTS and handoffs; inspect Tiled conversion, world bounds/wrapping, height tiles, current altitude bands, road representation, cloud/wave layer techniques, GLB impostor availability and actual viewer/collision performance. Distinguish current code from this proposal. Resolve the term “Level 2” against actual current band names before implementation. Preserve active camera/curvature fixes in progress.

**Stage 1 — Small vertical slice:** In the existing browser sample world, implement one compatible straight source road repeated in both directions **only** when driving on it or flying directly over it within the 50-ft road-relative corridor. Retain the road surface/visual continuity for approach, reverse and contact. Adjacent terrain uses **one** standardized lightweight biome-aware Level 2 color/elevation proxy, not the source roadside patch cloned again and again.

**Stage 2 — Pattern and LOD quality:** Add seeded continuous multiscale grass/forest/desert profiles, the three-to-four alternating *visual* layers, coherent chunk boundary/turnaround behavior, believable palette/height changes and cheap cached custom-asset top/angled proxy support. Ensure current visual island-impostor curvature fixes do not regress.

**Stage 3 — Authored destination reveal:** Place one distinct Tiled-derived location at a fixed world coordinate; show its correct far proxy/footprint, prefetch its actual converted geometry/collision and reveal that **same** detailed location below the arriving player, with road/height/texture continuity. Show returning to it preserves tree/road/landmark layout and native 3D edits.

**Stage 4 — Full authoring and portability:** Right-click import/placement, directional arrow, per-region Expansive Ocean/road treatment, artist-facing sliders+exact values, programmer/agent inspection/preview/commit, reusable biome/proxy/road profiles and portable data contracts aligned with the wider ÆXIS experience format. Support custom entity types and extension policies without requiring all features in the first PR.

**Acceptance tests:** on-road vs off-road, flight at 30/49/51 ft **above local road** (not global ALT), lateral departure/return, driving reverse, high-speed glide and collision-preload, road seam and tangent rotation, all existing world scales, seed reproducibility, no short visible pattern cycling, coherent 3↔4 layer fade, forest/desert/grassland profile distinctions, user-supplied proxy asset, near/far authored destination footprint matching, no spawn reset or Tiled source corruption, actual affected-browser/performance verification. If driving mechanics are not yet implemented, test the same corridor condition with simulated ground-contact and document that limitation; do not claim gameplay exists based on visuals alone.

## 9. Relationship to the long-term goal

ÆXIS should let a newcomer turn an ordinary Tiled map into a recognizable 3D place, position it freely in a broader world, apply expansive road/ocean/world treatments, and *drive or fly* through a seemingly vast landscape whose countryside has convincing but inexpensive biome-specific appearance. Detailed authored places become accessible as the player approaches. Other creators can change the math/palette/asset views and export the corresponding portable configuration. Developers can build upon the same structured core with a precise independent SDK rather than repeating the world-building and camera groundwork.

**We are not promising literally infinite bespoke geometry, a full landscape inferred perfectly from any image, or a world that regenerates arbitrarily on each trip.** We want low-friction, attractive defaults and mathematically coherent continuity—an accessible browser-first way to achieve breadth and depth, with the extensibility to become a dependable shared tool for third-party game developers.
