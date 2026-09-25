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

## Addendum — The Expansive Journey Principle: choose the forest because the drive is fun

**Creator's intent:** A destination is not merely a target to reach as fast as possible. The player can already fly directly to the city if efficient arrival is what they want. Taking the forest road is an **optional scenic, exhilarating journey** in its own right. Higher incoming flight speed must not automatically mean “arrive instantly” or “hit the first tree and crash.” It may instead yield a more extensive, more expressive and more enjoyable road-and-forest experience. The player takes the forest *not because it is the shortest route, but because it is the scenic and fun route*. This is a deliberate gameplay/aesthetic objective, not a demand to simulate physically conserved momentum across two different movement modes.

### A. Destination-directed, geometrically coherent forest representations

The road, tree-top proxies, multiple front-facing 2D forest layers, distant clearings and navigable routes must be derived from the **same expanded map and spatial rules**. Their distant positions reveal real upcoming obstacles and choices, giving the player time to decide how to steer. The farthest image layer corresponds to the far extent of its forest region rather than a decorative wall in front of the viewer. As the player approaches, imagery resolves into matching near representations/3D geometry and contact; clearings seen from afar remain the clearings they enter. Do not place billboards arbitrarily or make a tree disappear at the last moment as an emergency anti-crash trick.

The known city/destination is a meaningful directional constraint: forest-front silhouettes and path openings can expose the direction of longer roads and clearings leading toward it. Roadside bushes may be sparser at sightlines and turns; forest can remain dense to either side. Provide alternative viable branches, not a forced scripted steering route. The generator may design the expanding procedural corridor ahead of the player *before it becomes visible*, with enough advance generation to respect their vehicle dimensions, steering response, and speed. Authored Tiled destinations and creator-protected terrain/objects are never silently rewritten to manufacture these clearings.

### B. Fast driving should become a richer journey, not an instant arrival

The same small library of normal-sized source road patches, tree/canopy impressions, vegetation proxies, grass and terrain pattern rules can cover an enormously long route. **Repeat the road deliberately; vary the forest/countryside mathematically using deterministic coordinates, constrained density, scale/color/shading and seeded multi-scale variation** rather than duplicating one complete roadside rectangle. Only a bounded window of near geometry/contact and distant simplified layers needs to be active, though its actual rendering and streaming cost is not literally zero. Maintain the earlier 3↔4 distance-layer variation where useful and preserve consistent world identity on reverse travel.

Expose a creator-selectable *experienced route expansion factor* that can grow with incoming flight speed or be fixed/authored, with **50×–100× illustrative long-journey possibilities**, not hard-coded universal factors or a requirement to scale individual trees, textures and road width. Larger expansion means **more ordinary-sized repeated segments between the same named origin and destination**, not a giant stretched tree, flat-color ground or a different destination. Some players explicitly enjoy the drive; let a road become more scenic and take more experienced travel time as the player goes faster.

Make the distinction between destination identity and experienced travel geometry explicit. Avoid contradictory global coordinates: in a freely navigable 3D world, either author real expanded corridor geometry and consistent placement of destination links, or define a documented route-local distance mapping plus seamless, controllable entry/exit/side-departure transitions. A player who leaves the corridor to fly directly to the city must not find their world teleporting, map suddenly snapping, or their destination endlessly retreating. An active trip must have a stable arrival condition even if it uses a very long repeatable forest/road sequence.

### C. Translate incoming momentum into a controllable but badass ground experience

A tremendous orbital/flight speed (e.g., an illustrative engine speed value of 5000) does **not** automatically become the same numerical ground speed or physical velocity units. Introduce an explicit, tunable and optionally nonlinear/logarithmic arcade transfer mapping from incoming flight state to *effective ground navigation speed*; do not confuse this with literal physical momentum or claim exact energy conservation. The chosen mapping must allow safe streaming/collision preparation and meaningful steering/braking at supported speeds, without erasing the dramatic impression of the descent and impact.

Separately map incoming speed/impact intensity to the *experienced speed*: hydraulic response, road noise, wind, lens/framing/FOV, camera lag, scenery parallax, tree silhouettes sweeping past and the length/character of the available journey. These are coordinated effects of the same state, not arbitrary scenery moving through the player's actual collision space. Preserve the signature ship-to-road landing event and the player's control. A high-speed player should be offered longer straightaways, wider passages, longer sightlines, gentler visible turns and multiple understandable paths; slower travel can make smaller winding forest routes worth exploring. Navigable space should be created or selected before it is encountered, not dynamically remove an already visible tree on impact. Forgiving arcade mechanics are a designed option; actual collisions and more demanding game modes remain possible.

### D. The forest and city are two different travel choices

**Direct flight:** the player can continue toward the city's authored location without taking the forest-road expansion, following the ordinary flight/world representation. This is the efficient option when arrival matters more than the route.

**Expansive forest drive:** the player voluntarily enters the road's on-road / directly-above-within-50-ft activation corridor and experiences the longer, destination-directed forest. The active road continues while the surrounding biome-aware Level 2 countryside remains inexpensive, with speed-responsive Level 1 near-road forest fronts and navigable detail when implemented. The exact Level 1/2 definitions must be reconciled with existing altitude bands before changing code. Keep a realistic-looking landscape with consistent landmarks even though road length, presentation and navigation are deliberately game-designed.

**Central design statement:** *The destination gives the journey a direction; the road and forest give the journey its value.* More speed can produce more room, more scenery, more fluid choices, and potentially a longer experience, not merely a shorter arrival time. ÆXIS should provide this enjoyable starting configuration while letting creators and programmers disable, replace or retune it through browser controls and an independently usable typed SDK/API.

### E. Implementation and validation notes

Do not couple this addendum to the current camera PR's urgent framing/orbital/LOD bugfixes. Once basic Expansive Road/Level 2 is working, make a small test forest and fixed authored city, demonstrate a direct-flight route versus an explicitly selected expanded road, then test low/high/extreme incoming speeds, route expansion factors, forward obstacle visibility and reaction time, repeat continuity on reversal, correct tree/clearing correspondence between 2D and nearby 3D, steering/collision at speed, leaving the corridor sideways, taking off to fly directly, stable city identity/arrival and low-memory performance. Report what is actual gameplay versus visual prototype and do not call the entire experience implemented based on a decorative long road.

## Addendum — Scenic event layers, interior performances, and the optional Crash Out promo

**Status:** Future creative and technical proposal, not an implemented feature or completed trailer. This addendum supersedes any earlier mistaken account of the ending: the driver **gets back inside** and accelerates away. His line is **“That's funny, thought I hit something.”** Do not use the earlier discarded insult/dialogue or depict the car driving away without him.

### Layered scenery with actual positions and parallax

The proposed three-to-four alternating distance layers can contain much more than tree silhouettes. A third or fourth layer may show a house, barn, sign, windmill, fence, stylized animal or fictional character off to the side or ahead. Its apparent size, shading, occlusion and parallax should reflect its depth and stable position within the expanded route's map. The farthest forest image layer corresponds to the far forest boundary; nearer layers progressively reveal its actual roads, clearings and obstacles. Switching between three and four presentation layers is an LOD/display decision, **not** permission to randomly relocate a visible authored landmark. Forest and road repetition creates travel length; persistent houses, characters and special encounters keep stable identities and positions.

Distinguish **scenery-only proxies**, **approach-resolving landmarks**, and **event-capable entities**. An animal shown far ahead must resolve into the corresponding nearby entity, not appear unexpectedly as an unrelated last-second obstacle. Prepare collision and animation early enough for a player moving quickly to notice, choose a direction, steer, or intentionally trigger an interaction. Any special encounter must be consistent with the route's deterministic seed/placement and the creator's authored settings. Speed can intensify visual parallax and increase the rate of encountered scenery while expanding the route, but imagery with collision must remain coherent with the navigable world. Give creators explicit control of permitted event types, density, trigger conditions, safety rules and whether a layer item is merely decorative.

### Interior Vehicle Performance System

Offer optional interior camera presets: behind driver facing the road, passenger view toward driver, dash/windshield, hand/gearshift insert, driver face closeup, passenger reaction, two-person rear-interior framing, and mirror/vanity closeup. Build them using the same portable camera-rig definitions and event-relative cinematic sequence format as exterior shots. Bind customized driver/passenger GLB avatars to declared seats, hand targets, steering wheel, shifter, mirrors and optional controls. If a vehicle lacks a declared anchor, provide an editable fallback rather than guessing a precise joint.

Animation and expression tracks respond to authored or measured movement: vehicle speed, acceleration/braking, gear shift, turning, flight-to-driving impact, jump airtime, and artificial speed-mod parameters. Layer gestures over the base driving animation—for example a driver theatrically fixing his hair before a hard turn, a hand moving the stick shift, intense eyes, a worried passenger reaction, an exaggerated loose-limbed passenger bounce, and recovery. Preserve controllability and avoid a closeup suddenly hijacking steering unless the creator explicitly authors that policy. Expose all tracks and sound slots for browser visual editing and typed programmer/agent access.

### Optional Crash Out: fictional non-graphic cartoon collision and recovery

A possible optional paid creator mod or showcase can attach exaggerated slapstick physics and short cinematic reactions to selected **fictional** event characters or stylized animals. A distant visual cue can transition to a nearby event instance; on collision it may tumble/bounce in an unmistakably cartoon style, recover, stand and run away without gore or lasting injury. This is an optional authored experience, not a requirement of ordinary road gameplay. Stable event IDs, actual contact timing, collision outcomes, ragdoll/recovery states, camera cuts and audio slots should all share the portable sequence/event semantics. An interaction may also end as a dodge or near-miss. Do not duplicate the same unique character on every repeated road segment or reset a character's recovery state while it remains observable.

### Creator's cinematic promo — corrected shot progression

This is a **proposed**, editable cinematic demo of ÆXIS's actual systems, not a prerecorded mandatory event or proof they are already implemented. The visual tone is playful, stylized and exaggerated, with no graphic injury.

1. **Hill and airtime:** The vehicle races along the expansive forest road, hops a small hill, and the rear exterior camera shows its suspension extend as it briefly catches air. The countryside's multiple parallax layers suggest immense distance.
2. **Interior performance:** Cut to a closeup of the driver's hand working the gearshift. Show his hungry, predatory, delighted eyes; the passenger reacts with an understated “Oh dear.” The driver might comically preen or fix his hair before an outrageous turn.
3. **Accelerate:** He floors it. Exterior views emphasize the road stretching ahead, extended clearings, trees sweeping by, responsive suspension and the feeling of extraordinary speed. The passenger can perform an optional floppy, exaggerated cartoon bounce.
4. **Distant cue and cartoon incident:** An event-capable stylized deer/character is visible ahead as a coherent object in the road's distant layers, early enough to provide a choice to steer or react. In the authored promo's collision branch, it tumbles in a non-graphic slapstick manner.
5. **Driver stops and steps outside:** He looks around, bemused, and says **“That's funny, thought I hit something.”** He may smoke and casually fix his hair or look at himself in the car mirror, conveying comic vanity; the event character can recover and run off in the background. This line replaces the earlier discarded dialogue.
6. **Correct final shot:** **He gets back into the car.** Cut to a low viewpoint beside/near the fallen cartoon character in the foreground, looking toward the driver and his car in the distance. The engine revs and the car accelerates off at full speed **with him inside**, receding down the forest road. Do **not** depict an empty car abandoning the driver.

The promo should be authorable in the proposed in-browser event-relative sequence director using editable camera presets, shot timings, interior/avatar bindings, gearshift/face/gesture animation, sound slots, hillside suspension, event collision/recovery and the same road/forest expansion system exposed to creators. Make user-adjustable variants and portable exports available through the shared SDK once implemented. Keep this promo optional and separate from the urgent current PR #28 camera and island-framing bug fixes.

**The broader principle:** A route that could have been skipped by direct flight can instead become the chosen destination-directed experience: the faster the player travels, the more exhilarating, visually varied, navigable and potentially *longer* the forest drive becomes. The world should give the player advance information and meaningful decisions, not punish speed with an unavoidable wall or secretly relocate obstacles.

## Addendum — Ship Phaser Shield: iridescent visual identity and optional collision phasing

**Status:** Future vehicle ability and aesthetic asset proposal. Not implemented. Preserve the existing Expansive Forest, road, authored destinations and their collision/geometry independently of the shield.

### Two independent reasons to activate the bubble

The proposed **Phaser Shield** is first and foremost a *beautiful*, stylized visual experience: a luminous, transparent, iridescent rainbow bubble surrounding the ship, with controllable color dispersion, opacity, rim glow, surface ripples, refraction/distortion, audio and camera responses. **Creators and players may want to use the Phaser just because the bubble looks cool. That use must be fully supported, not treated as a lesser or accidental use of a collision cheat.** The same visible shield can also optionally grant a collision-phasing ability, but the *visual bubble and physical collision policy are separate controls*.

Offer, at minimum:
- **Visual-only / Cosmetic Bubble:** the gorgeous animated rainbow bubble appears around the ship, but all ordinary collisions, ground support, road traction and gameplay rules remain unchanged. A creator can use it continuously for a character's aesthetic, in a promo, during a jump, as a speed-responsive effect or as part of a customized ship's identity. It should be usable without selecting any obstacle categories to phase through.
- **Phasing Shield:** the same bubble appearance (or an independently customized variant) plus explicitly configured permission to pass through selected compatible obstacles. The ship keeps its intended motion through those obstacles; objects and forest layout do not move out of the way. The shader/visual effect alone never implicitly changes collision state.
- **Creator-defined combinations:** visible effect on/off, cosmetic strength, duration, triggers, audio, camera shot, reactive ripples and optional phasing can be mixed through UI, safe structured programmer SDK, agent API and the portable ÆXIS experience timeline. A creator may want a rainbow bubble without any phasing, or a subtle/hidden gameplay phase ability without a bright visual bubble; make the choice deliberate and clearly shown.

### Ownership and road/forest boundary

The ability belongs to a **ship or compatible vehicle instance**, not to the forest or an entire biome. It must not delete, relocate, thin, or repopulate authored trees, road obstacles, animals, buildings or other world geometry just to simulate passing through them. Use narrow, explicit collision-filtering categories/permissions for the active ship entity, keeping unrelated actors and world contacts intact. Cosmetic-only mode never changes physics. By default **terrain, road surface, landing contact and wheel/suspension support remain solid**, so activating the effect does not cause a car/ship to fall through the pavement.

**Road-compatible phasing is undecided** and should remain a separately scoped experimental policy, not silently enabled or presented as agreed default behavior. If later added, distinguish phasing through roadside obstacles from phasing through the support surface; ensure a vehicle can still steer, drive and land without destroying the route's collision model. In multiplayer or creator-authored games, authoritative simulation and permitted interaction rules must be explicit.

### Rendering and behavior contract

Fit the bubble to a creator-adjustable vehicle visual/collision envelope rather than assuming every imported GLB has the same shape or pivot. Include a configurable clearance from the hull, scale-responsive behavior for tiny cars and enormous ships, and a physically separate effect anchor that follows the actual vehicle pose and altitude visual transform. The shader should create recognizable rainbow interference/iridescence and view-dependent rim highlights with optional distortion and impact ripples, while keeping the ship and road legible. Offer economical low-end fallback materials, adjustable transparency/effect complexity and preview-render quality for the project's approximately 4 GB target. The bubble must not accidentally refract the HUD or change other cameras when drawn in main versus bottom-right preview.

Expose **independent numerical controls with synchronized slider and exact input** for bubble radius/fit margin, opacity, hue/rainbow spread, shimmer/ripple speed, distortion, duration, activation/deactivation fades and optional state-linked intensity. The visual effect can respond to vehicle acceleration, incoming flight speed, turns, gear shifts, touchdown, forest near-miss and actual phase contact, with suitable limits and stable default behavior. Provide original polished ÆXIS look immediately; allow creator customization, saved presets and portable per-vehicle reuse. Support bounded, permission-scoped Liquid-like customization eventually, not unrestricted code embedded in imported packages.

For gameplay phasing, explicitly define obstacle classes allowed to phase, activation window/cooldown if desired, continuity of velocity, detection of entry/exit and visual/audio callbacks. **On deactivation while overlapping an obstacle**, keep the affected pair non-solid until safely separated or apply a deterministic validated ejection/deferral rule; never abruptly solidify inside an object or teleport the ship into the ground. The player should understand when gameplay phasing is active versus when only the visual effect is running.

### Showcase and acceptance

The expansive-road/forest promo can use the rainbow bubble **only for its gorgeous look** while retaining ordinary vehicle handling; a separate optional sequence can show it rippling as the ship phases through a designated tree/obstacle. It should never imply that the forest has been made intangible or that a collision with road/terrain is automatically safe.

Validate: cosmetic-only retains identical collision/contact behavior to a ship with the effect off; obstacle phasing passes only declared classes and preserves the road support; high-altitude and ground cameras (including separate main and preview) draw the bubble consistently and without ship cutoff or a falsely shared postprocess; correct rendering on arbitrary compatible GLBs and bounded low-end GPU cost; re-enabling and disabling near objects is safe. Road-related phasing remains documented as an open future decision. Keep this addendum separate from the current urgent cinematic-camera/curved-island bugfix work.

**Creative principle:** The Phaser is allowed to exist simply because a beautiful rainbow bubble around a speeding spaceship is worth experiencing. The collision ability is optional; the aesthetic joy is a first-class feature.

## Addendum — Forest-only authored destinations by default; optional cross-world access

**Creator's explicit default:** The Expansive Forest is an **experience-space and a world-building canvas**, not merely a stretched road within the exterior flight world's continuously reachable geometry. A creator can drive to a chosen point in this experience (for example, halfway through the journey), right-click the terrain and import a Tiled-derived 3D place. That place belongs to the forest experience **by default**. The player reaches it by entering and progressing through the forest drive; they **cannot simply fly directly to it from the exterior ship world**. This is an intentional part of the default design: the journey is worth taking and its discoveries cannot all be skipped by flying straight to an apparent exterior coordinate.

**Do not confuse two destination types:** A city or landmark exposed in the ordinary exterior world can still be reached by direct flight when its own rules allow. By contrast, a village, clearing, shop, event or other Tiled place created *within* the forest's experience-space is **forest-only by default**, including when it appears beside a road at 50% or 75% of a speed-expanded trip. Its being known to the overall world index/rendering system does *not* automatically make it physically instantiated, visible or accessible from the exterior flight map. This refines earlier statements in this proposal that all authored places must have a single immediately reachable exterior world coordinate: **forest-bound authored places instead have stable experience-local locations with explicitly controlled cross-world connections**.

### Persistent progress and simple right-click creation

The forest has a stable journey ID, selected entry, route/progression space and ordered stages. It remembers progress—halfway, three-quarters, or a specific stage and road location—even if the system adjusts the experience's effective length, repeat count, artificial scenery speed or 3↔4 layered presentation. A creator can stop at a position, open the right-click context menu, choose **Import Tiled World**, select an appropriate source map and 2D-to-3D conversion filter, rotate/place it using the proposed bottom-plane direction control, and save the result as a first-class forest location. The region retains source provenance, identity, authored geometry, environment/collision and subsequent native edits. It is not duplicated for every repeated road module.

The simplest default placement anchors to **journey-relative progress** and its selected road/stage reference (e.g. halfway through the forest), plus road-relative side/height and local placement transform. Store the exact anchor and a stable ID, and define how a later expansion change moves or retains this destination; expose optional fixed route-distance and other placement policies rather than secretly assuming all are equivalent. Level 2 countryside and distance proxies should know that the location exists and reveal it when appropriate along the forest journey. Prefetch detailed terrain and collision before an approaching fast vehicle reaches it. Any distinct exterior placement is a **separately authorized link**, not an automatic consequence of the forest's renderer knowing the region.

### Explicit creator/programmer access policy

The shared browser editor must show an intelligible default such as **Access: Forest journey only**. The programmer/agent API can explicitly opt into alternatives: exterior-flight reachable, accessible from another road or experience, portal/transition linked, or other creator-defined access rules. Providing an exterior link requires valid placement coordinates, route/portal entry and exit semantics, visibility/LOD/physics compatibility, and a consistent mapping for entering and leaving the experience—do not merely toggle a flag and pretend a stretched 100× corridor automatically shares one-to-one geometry with the exterior world. Do not allow untrusted imported content to modify access or world connections without permission.

Proposed conceptual data contract (not a shipped schema):

```json
{
  "id": "forest-village-halfway",
  "experienceId": "expansive-forest",
  "placement": {
    "space": "experience-local",
    "routeId": "forest-main-road",
    "anchor": { "kind": "journey-progress", "fraction": 0.5 },
    "offsetFromRoadFeet": 180,
    "sourceMap": "maps/village.tmj"
  },
  "access": {
    "default": "forest-journey-only",
    "exteriorFlightEntry": null,
    "optionalCreatorLinks": []
  }
}
```

This is why creators can make a new place by driving through the forest, yet the same place does not accidentally appear to exterior pilots as a shortcut. The experience has its own coherent geography, and the overall system indexes and renders that geography **in the correct context**. Programmers are free to create a seamless exterior-connected version, but ÆXIS's carefully authored default expresses the opposite creative intent: **discover this place by taking the forest road, because the drive itself is part of the reward.**

**Acceptance:** Create a Tiled village halfway along a forest journey; verify its persistence and reveal on repeated drives and under changed expansion/speed profiles. Verify an exterior ship cannot see, fly directly into or bypass the forest to access the village by default. Verify explicit programmer-enabled exterior links work only with validated coordinates, transitions, and permissions, without duplicating the village or teleporting the player unexpectedly. Keep the original exterior city accessible by direct flight when its own policy permits. This is a design addendum, not implemented gameplay or a reason to delay the active camera bug fixes.


## Addendum — Multiplayer Expansive Forest: shared road, synchronized but distinct experiences

**New creative requirement / future proposal:** Two or more players can inhabit the **same authoritative world and the same logical road** while experiencing different forest scenery, stages or stylized presentations around it. This can feel playful and game-like, including a shared-drive or bumper-car-style mode with cartoon contact and vehicle reactions. The forest experience need not be an identical camera-facing picture for every participant, but players must agree on the **shared things they can interact with**. Distinguish variation of presentation from divergence of authoritative geometry and gameplay.

**Shared synchronization:** A server or designated authoritative session core owns world/session ID, route ID, shared road geometry and lane/collision boundaries, player positions, velocities and inputs, persistent landmarks and forest-only Tiled destinations, interactive obstacles/NPCs and collision outcomes, progress/event anchors, stage transitions whenever stages change shared geometry, and deterministic seeds for shared road/forest features. A tree or obstacle that can be hit by both players must occupy a compatible collision location for both; a visible shared house/village cannot arbitrarily be halfway for one player and three-quarters for another without an explicit route-space mapping or separate session instance. Players turning around, meeting, overtaking and bumping into each other must remain coherent. Preserve the creator's default forest-only accessibility from the exterior flight world.

**Personalized but compatible representations:** Each player can select a different cosmetic tree collection (including their three uploaded GLBs), palette, canopy proxy style, fog/mist, time-of-day *visual override*, shading, soundtrack, camera rig, screen effects, speed sensation and optional decorative far/mid parallax variants while consuming the same shared route and meaningful location IDs. The 3↔4 distance layers are view-dependent render profiles, not independent random sources of collidable geography. A distant decorative barn may differ between players if it is explicitly tagged non-interactive; any persistent visitable building, roadway fork, deer/NPC encounter, nearby solid tree or event must derive from shared authoritative placement or a declared instanced experience. A player must not see a clear road where another player collides with an invisible tree.

**Separate instanced journeys when a designer actually wants different physical forests:** Support optional independently instanced forest routes under one exterior world. Players may share the same underlying source road/forest template yet have different expansion factors, stage timing, procedural corridor geometry, destinations or events. In this case they are **not physically occupying the same collision space** until a declared synchronized merge/join location or portal. Show the difference clearly in editor/API and multiplayer HUD; do not fake direct player-to-player collisions across incompatible instances. Cross-instance spectators and ghost representations can be a separate later feature.

**Speed expansion and synchronization:** Because a player can boost artificial scenery passing rate and extend the road 50×–100×, keep an authoritative distinction between logical route progress, each player's navigational speed, their local visual speed, and the shared encounter/destination timeline. A cosmetic boost can change parallax, engine audio, camera response and local presentation without changing shared position. Changing *actual* route length or driving speed requires synchronized rules and advance loading, or an explicit switch into an instanced journey; otherwise two players on the “same road” would disagree about where they and the next city are. No player's personal speed mod silently drags another player or changes a shared village's placement.

**Bumper-car-like play, if enabled:** Offer optional non-graphic arcade ship/car impacts, exaggerated suspension, bounce, spin, sliding, protected recovery and synchronized camera/sound/effect events. Avoid automatic disruptive PvP; creator-set permissions and lobby/game-mode rules determine whether vehicles collide with one another, phase through, or remain ghosted. The cosmetic rainbow Phaser can be used independently of collision filtering. A personal camera cut never changes another player's movement or view unless explicitly authorized as a shared scripted sequence.

**Accessible authoring / SDK:** Provide a simple multiplayer forest choice: “Same shared forest + personalized visuals” (default when players can encounter each other) versus “Separate journey instances + optional meet points.” Expose session/route/stage IDs, authoritative vs cosmetic object flags, shared seed and role-specific style overrides, player-specific presentation profiles, common event anchors, explicit encounter and joining policies through the same versioned programmer/agent API. Easy toggles and sliders with exact numeric inputs should remain usable without requiring the creator to understand network replication internals.

**Acceptance demonstration:** Two clients start on one road, see each other, drive, turn around and interact with the same shared obstacle or landmark while using different tree visuals, fog and camera presets. Their road collision and persistent forest-only village agree even if far decorative parallax differs. Trigger a bumper-car-style contact and verify both clients receive compatible authoritative outcomes but can display distinct cosmetic effects. Then test independent 50×/100× personalized journey lengths in **explicit separate instances**, with no phantom collisions, and a validated transition if the experiences rejoin. This work is deferred; do not let it delay current camera/LOD bug fixes or present it as implemented.

**Principle:** A shared world can host individually beautiful forest experiences. Personal aesthetic variation is welcome; gameplay-relevant geography, encounters, and direct interactions must either synchronize or be explicitly separated into different experience instances.
