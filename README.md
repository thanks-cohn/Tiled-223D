# Tiled-223D — A World That Opens as You Fly

**Start above a small island. Cruise through a dreamlike four-layer sky. Ascend until the horizon curves and the world becomes a planet. Keep flying.**

Tiled-223D is a standalone, browser-based **2D-to-3D spatial world and flight-engine prototype** built with Tiled map data, Three.js, and semantic object identities. Its distinctive experiment is to make the *experience* of an enormous world feel rich while keeping the *amount of work done by the renderer* deliberately small. The world can expand dramatically in navigable coordinate space without turning every coordinate into a separately rendered tile.

### What you can explore today

- **Three scales, one compact demonstration world:** Current (500 × 500), Bigger (2,500 × 2,500), and Massive (16,000 × 16,000). Detailed island geometry retains its local size; the larger presets spread destinations across sparse ocean rather than allocating a 256-million-cell terrain grid.
- **From island flight to a curved horizon and planetary overview:** a floating render origin and camera/terrain projection transition the same navigable setting from low-altitude cruising into a broad globe-like view. This is a visual curvature approximation over wrapped world coordinates, **not** a full spherical navigation/physics simulation.
- **Momentum you can earn and keep:** accelerate with W and Shift, coast, and collect an additive speed reward when flying past island clusters. Open-ocean journeys feel different from near-island traversal.
- **An atmospheric sense of scale:** four cloud layers reuse a fixed pool of 27 world-anchored formations, with altitude-dependent parallax, varied silhouettes, and bounded recycling. Near clouds pass while higher formations linger as references for distance.
- **Cinematic speed-perception experiment (V9 branch):** peripheral airflow strokes use actual distance traveled, not a fake velocity animation. A fixed 32-stroke, single-buffer effect gives fast ocean/planetary cruising more visible acceleration while leaving the horizon and planet's center unobstructed. The existing ocean glints and cloud parallax remain the primary spatial cues. V9 visuals still require an on-device aesthetic/FPS review.
- **An actual semantic starting point:** sample islands, named floating structures, a lightweight in-game map, Tiled JSON + numeric elevation import, and an optional GLB ship override. The 3D scenery is linked to meaningful locations rather than being only a skybox.

### Creator-first direction

The long-term goal is **make the places you care about; let the rest of the world connect them**. The [world and docking proposal](docs/PROPOSAL_DOCKING_AND_CINEMATICS.md) describes creator-authored islands and rooms, agent-generated broad geography, synchronized small/large maps, optional classic 2D and paper-like 2.5D RPG presentations, and object interactions that can open a linked room or world. The separate [paper-diorama proposal](docs/PROPOSAL_PAPER_DIORAMA.md) describes inexpensive cutout representations derived from real assets. **These authoring tools, RPG modes, portals, and agent terrain-generation workflows are proposals, not shipped features of this demo.**

### Run it

**Windows:** Download and extract the GitHub ZIP, then double-click `start-world.bat` inside the extracted folder. Install [Node.js LTS](https://nodejs.org/) first. The first launch installs JavaScript dependencies; subsequent launches reuse them. Keep the terminal window open while playing.

**macOS / Linux:** Extract the ZIP and run `sh start-world.sh` in the project directory.

**Manual launch:** `npm install` then `npm run dev -- --open`. Do not open `index.html` directly; ES module imports need the local Vite server.

**Flight:** W/S forward/reverse · A/D steer · Up/Down ascend/descend · Shift boost · R take off · V switch Forward/Overview · Shift+V restore Auto camera · M inspect the map. Fly forward is a separate autopilot-like movement toggle, not a camera control. Add `public/ship/ship.glb` to override the low-poly default ship, or import your own Tiled JSON/elevation map through the HUD.

**Current status:** This is experimental software, not an independently benchmarked production game engine. The larger-world camera and intermittent navigation issues are still being validated in real browsers; frame rate and memory on a 4 GB Windows computer have **not** been established by automated tests. See the [bug registry](Bugs/README.md), [semantic agent contracts](Semantic-Bindings/README.md), and [development handoff](docs/CODEX_HANDOFF.md). The Return to SUBSTRATE action currently opens a standalone placeholder, not an integrated desktop.

---

## Spatial diagnostics

**Authorized development workflow:** after selecting Deep Debug, click **Authorize agent tools** to grant a local, expiring 15-minute capability. `window.tiledSpatialDevelopment` can then record/replay bounded deterministic controls, request next-render synchronized captures, preview only whitelisted camera/presentation values, compare baseline and candidate measurements, and roll changes back. Synthetic clicks cannot authorize access, no trace is uploaded, and ordinary Performance flight does not construct capture snapshots. See the [agent interface and reproduction procedure](Semantic-Bindings/spatial-development-v1.md).

The HUD diagnostics selector defaults to **Performance**, which records no trace history. Debug adds a low-rate coordinate overlay; Deep Debug enables bounded snapshots and local JSONL export. The read-only `window.tiledSpatial` API distinguishes authoritative pilot coordinates from the physical projection and actual displayed ship projection. Its coordinate contract, limits, event schema and incident workflow are documented in [Spatial Truth v1](Semantic-Bindings/spatial-truth-v1.md). No trace is uploaded.

Ocean Flight V1 now uses four deterministic, world-anchored wave families and four smoothly overlapping altitude moods, plus a soft ocean-only height footprint that grows and darkens during ascent. Ocean Studio and the authorized development API provide validated, reversible visual previews without changing pilot/world truth. The renderer retains one sea surface and bounded buffers (up to four family draw calls plus one shadow footprint); browser aesthetic acceptance and 4 GB device performance still require owner verification. See the [Ocean Flight V1 agent contract](Semantic-Bindings/ocean-flight-v1-agent-contract.md).

## V9 · Cinematic speed, clear ocean travel and Massive ship framing

**New for Massive Overview:** The ship now uses a consistent presentation parent for the entire Massive-world visit; it emerges or recedes smoothly when switching between the cockpit and Overview rather than abruptly jumping between scene and camera coordinates. Its lower-center anchor and apparent size remain stable during ascent. The Massive camera also interpolates its orientation from the current frame toward the desired world composition instead of snapping on a view toggle. Actual ship coordinates, momentum, collisions, the planet and the smaller-world camera policies are unchanged. On-device aesthetic review remains essential.

**Cinematic sea across altitude and speed:** A tiny near-field pool of curved wave crests flows naturally past the ship as it travels. Its distant counterpart slowly emerges during ascent, providing expansive arcs that stay attached to the same planetary geography. The patterns never rotate to match the camera or relocate merely because of altitude. Their speed-responsive contrast and the clouds' genuine parallax supply the sensation of motion without another ocean mesh, a large terrain grid or runtime AI. The fixed 88-crest budget uses up to two draw calls and no textures.

[Agent implementation contract](Semantic-Bindings/massive-overview-and-ocean-speed-v9.md) · [reported bugs and validation checklist](Bugs/flight-and-scale.md)

### Cinematic Speed Perception V9 — experimental branch

The hardest thing about a vast ocean is that **actual motion can look slow when there is nothing nearby to compare it against**. V9 retains true ship momentum and world-anchored clouds/ocean glints, and introduces a restrained, altitude-aware peripheral airflow graphic that responds only to **measured ship displacement**. The effect is subtle for the California-highway low cruise, clearest during active atmospheric acceleration, and less intrusive in the high planetary overview. It never accelerates the ship, moves islands, replaces actual cloud parallax or draws over the center of the world.

The implementation reuses **one fixed set of 32 line segments** with no new texture, shader pass, emitted particle or full-world allocation. It is intentionally an inexpensive artistic cue, not a promise that the effect can be seen or enjoyed at every altitude and device without tuning. [Pure speed/altitude model](src/speed-perception.js) · [reusable renderer](src/speed-perception-renderer.js) · [tests](tests/speed-perception-v9.test.js).

## V8 camera and flight stability update

**Camera:** The `View` button (or `V`) immediately toggles the **actual** Forward/Overview view; use the separate `Auto camera` button (or Shift+V) to return to automatic low/middle Forward and high/planetary Overview. `Fly forward` controls movement only. The Massive (16,000) world now uses the same proportions for the camera's horizontal distance and vertical follow height as the smaller worlds, and both camera views aim toward the world as altitude rises rather than becoming stuck looking into empty sky. The overview continues to frame more of the planet centrally without adding another globe mesh. These changes need visual confirmation on the affected browser.

**Flight/navigation:** Pressing S overrides automatic forward cruise instead of canceling it out; a near-land collision advances only to the last safe sample, then lets you reverse. Deliberate world-scale changes preserve relative location and earned momentum rather than resetting spawn. The intermittent user-reported surprise reset and the exact high-altitude visual result still require affected-device confirmation. See [camera/navigation agent binding](Semantic-Bindings/camera-navigation-v1.md) and [Bugs/](Bugs/README.md).

## Altitude Parallax Cloud Choreography V8 (merged into main; V9 builds on it)

Four altitude moods now coordinate a **stable world-anchored pool of 27 reusable cloud formations**: peaceful California-highway cruising, active atmospheric flybys, expansive layers above and below, and distant ground-parallel planetary clouds. The renderer reuses four tiny different procedural cloud silhouette textures; size, spacing, opacity and angle vary with a deterministic seed. Low clouds pass and recycle ahead more often; upper clouds stay longer as visual references for speed. Altitude/speed-dependent timers only limit recycling work, never move a visible cloud to fake travel. V8 was merged into main before the V9 speed-effects experiment. Camera/collision changes are implemented on V8; some reported behaviors still need affected-browser confirmation.

**Agent entry points:** [V8 cloud binding](Semantic-Bindings/cloud-parallax-v1.md), [machine-readable cloud schema](Semantic-Bindings/cloud-parallax-v1.json) and the new [Bugs/ registry](Bugs/README.md) distinguish implemented behavior from outstanding issues. These changes are intended to remain lightweight on a 4 GB computer, but appearance and FPS require actual in-browser validation before merging.

## Three Planet Scales V7 (previous experimental branch)

Choose **Current (500²)**, **Bigger (2,500² / 25× area)**, or **Massive (16,000² / 1,024× area)** from the flight HUD. The existing island geometry and 500² source map remain unchanged; bigger planets use sparse island coordinates and procedural ocean instead of constructing enormous tile grids. The planet radius and visible curvature respond to the selected profile. A floating render origin keeps the camera and scenery close to zero in GPU X/Z space to reduce high-altitude jitter. From altitude, cloud cards transition to planes **parallel to the curved planetary ground**, not perpetually facing the camera. A bounded 500² overview and fixed cloud/ocean geometry budgets preserve the low-compute design; this does **not** guarantee a particular FPS on a 4 GB computer. See [V7 implementation and limits](docs/SCALE_PROFILES_V7.md), [agent documentation](Semantic-Bindings/scale-profiles-v1.md) and [machine-readable binding](Semantic-Bindings/scale-profiles-v1.json). The scale-profile work was merged into main via V8; the earlier antivirus alert is not addressed by planet scaling.

## Four-Layer Atmosphere V6 (previous branch)

This branch adds **four deliberately different cloud decks and four smoothly blending altitude moods**: low reachable clouds that sweep past during fast low-altitude travel, middle clouds that establish depth, majestic slow high clouds visible even near sea level, and sparse cloud cards projected over the globe from above. The lowest flight remains calm and cinematic, active ascent emphasizes parallax, higher flight emphasizes scale, and the planetary view shifts to broad cloud formations. The 27-sprite pool shares one tiny generated alpha texture, uses no volumetric simulation, and does not change V5 flight momentum, island geometry, the opaque globe, collision, or the 500 × 500 map.

**Agent/LLM handoff:** [Semantic-Bindings/README.md](Semantic-Bindings/README.md) explains *what changed, why, invariants and source files*. [Semantic-Bindings/atmosphere-v1.json](Semantic-Bindings/atmosphere-v1.json) is a machine-readable manifest for follow-on work. Performance and appearance still require a visual check on the 4 GB Windows test computer before merging.

## Ocean Momentum V5 (previous branch)

**Your existing island speed is preserved as earned momentum when you leave.** Open ocean requires roughly twice the previous acceleration effort at low altitude, but no longer snaps the ship down to an ocean target speed. Flying near/away from a protected island region can earn an **additive island slipstream** that persists into your next journey. Acceleration gradually diminishes at higher speeds while holding W/Shift continues increasing momentum; releasing thrust lets the ship coast. A collision-escape fix allows forward/back movement when already touching or embedded in a surface. Light world-anchored glints on the ocean convey actual low-altitude speed without a heavy particle system. **The world and islands remain their original physical sizes.** [V5 mechanics, tuning, test instructions and limits](docs/OCEAN_MOMENTUM_V5.md).

## Expansive Ocean V4 (previous branch)

The existing small island/sky-archipelago cluster is now the **minimum protected diameter for the familiar V3 movement feel**, not a resized asset or map. Within each island's semantic circular region, movement and Shift work as before. Farther out over open ocean, low-altitude crossing requires a longer journey through a smooth, ocean-only travel-speed profile; Shift remains extremely fast, and ascending progressively restores V3's high-altitude travel speeds. The existing 500 × 500 map, terrain geometry, island size, map wrap and collision rules are unchanged. V4 also attempts to keep the ship prominent at high altitude and point floating islands' bottoms toward the globe without shrinking them. See [V4 design, settings and limitations](docs/EXPANSIVE_OCEAN_V4.md). This new branch remains experimental and is not merged into `main` or V3.

## Globe Center Stage V3 (previous branch)

This branch builds on the clear, single-ocean Horizon-First V2. Fly upward and the curved horizon now **opens into a round planet centered in the camera**, using the same GPU projection for the ocean and *actual ground islands*. You can continue moving above altitude 500; use Return to SUBSTRATE to leave intentionally. Shift gives a strong 8× travel boost, and low-altitude flyby wisps and three cloud layers create richer natural parallax. No translucent blue globe cover, independent floating land discs, heavy volumetric renderer or extra 3D scene is added. [Read V3 design and limitations](docs/GLOBE_CENTERSTAGE_V3.md). Experimental branch: visually test performance and shoreline continuity before merging.

## Horizon-first V2 (previous branch)

This new branch keeps the previous version's smooth flight, banking, altitude-scaled speed and cloud parallax, but **removes the translucent blue globe overlay and detached land-proxy discs**. The single opaque dark-blue ocean gently curves downward near the horizon as you climb. Ordinary islands use the exact same visual curvature and stay fully colored and attached to the ocean, rather than fading or hovering above the globe. Camera gaze follows the horizon during ascent. This is a lightweight **horizon-first** approximation over the unchanged 500 × 500 Tiled map, not a complete spherical physics engine or an orbital planet. See [Horizon-first V2 implementation and limitations](docs/HORIZON_FIRST_V2.md). Your previous experimental branch and `main` are preserved. Please visually test this branch on the 4 GB computer before merging.

## Floating-island demo (new)

The default world now places **one main floating island and two smaller nearby islands** ahead of your starting flight path. These are independent, named 3D objects above the original ocean and 2D terrain, not accidentally detached ground. The main island has stone, clay, dirt and grass layers and a real vertical opening. You can fly over or beneath islands and test the opening; the lightweight collision is intentionally approximate.

Edit **`src/worlds/floating-islands.json`** to change an island's `at: [x,y,z]` position and move all its material parts/openings together. Definitions, ownership rules, the geometry algorithm and **future 2D RPG-character occlusion beneath an island** are explained in [docs/SPATIAL_GEOMETRY.md](docs/SPATIAL_GEOMETRY.md). The current demo does not yet implement the RPG view or character hiding.

If a world is already running, stop its server (Ctrl+C), download the updated ZIP, then run `start-world.bat` from the new extracted folder. Existing local source files do not update automatically from GitHub.

**Design proposal:** [Surface docking, local RPG worlds, and optional cinematics](docs/PROPOSAL_DOCKING_AND_CINEMATICS.md). This describes future features; the present browser demo does not yet implement docking or the RPG transition.

**In-game map:** Click **Map (M)** in the flight HUD, or press **M**, to see the current world as a lightweight top-down 2D map without opening Tiled. A yellow arrow marks your ship and heading; pale rings mark floating islands. Flight pauses while the map is open. Click **Back to flight** or press **M / Esc** to close it. Imported Tiled JSON maps appear here too. The map is a viewing tool, not a separate world or a teleporter.

**Overworld repetition and clouds:** The renderer now builds one visual mesh per connected ground island and moves each to its nearest wrapped position. Only two ground islands exist in the demo, rather than nine visible copies of the whole map; no changes were made to the authoritative terrain, wrapping mathematics, or three floating-island objects. The sky uses ten very distant decorative cloud sprites, while only four soft translucent cloud formations have fixed, reachable world coordinates. Fly into those clouds for a brief haze effect; they have no solid collision. The far clouds remain intentionally decorative. All clouds use one tiny generated texture, not volumetric simulation. This is a prototype: the change reduces duplicate draw calls, but actual performance on your 4 GB computer has not been measured. Note: very large or seam-crossing imported landmasses need more advanced topology/LOD handling.

**Island visibility fix:** Floating islands now crossfade from their real 3D geometry into a lightweight, geometry-derived painterly card, then a darker distant silhouette. Cards always face the camera and preserve each island's semantic position. The 500 × 500 demonstration also uses a longer 3D viewing range so the ordinary terrain islands are not clipped at the old 350-unit limit. Cards are stylized approximations created once from the island's material-layer dimensions, not yet offscreen snapshots or the advanced multi-angle paper renderer. The physics model remains the real geometry. These changes are in the standalone viewer; they have not been visually benchmarked on a 4 GB machine.

**Future rendering proposal:** [Geometry-faithful paper diorama impostors and optional learned stylization](docs/PROPOSAL_PAPER_DIORAMA.md). The full multi-angle/ML system remains a proposal.

## Editing semantic tiles in Tiled

## What is here

- `maps/test-world.tmx`: editable 30 × 20 map with grass, dirt path, sand shore, three blue water types, and a separate tree overlay layer.
- `maps/test-world.json`: matching ordinary Tiled JSON export representation (do not edit both independently).
- `tilesets/terrain-atlas.svg`: original 7-tile 32px pixel-art palette (trees have transparency).
- `assets3d/*.gltf`: original, low-poly, lightweight 3D counterparts for every semantic tile, including an actual 3D tree. These are *visual prototypes* and not a physics engine or inferred 3D reconstruction.
- `assets3d/catalog.json`: stable semantic-to-3D mapping. The tile's `asset3d` property and this catalog point to the same assets.
- `extension/substrate-world.js`: Tiled JavaScript export plugin for `.sworld.json`, with per-cell semantic descriptions.
- `docs/SCHEMA.md`: coordinate system, layer rules and how agents and future renderers should use the data.

## Open and paint

Clone/download the repository **with its folders intact**, then open `maps/test-world.tmx` in Tiled. Select `Ground` to paint grass/dirt/sand/ocean/river/lake. Select `Structures` to paint trees over a ground tile. Keep `Spawns/LandingPoint` on walkable ground. The three water tiles have distinct colors and distinct `waterBody` semantics: ocean != river != lake even though their physical material is water.

## Install exporter in Tiled

Copy `extension/substrate-world.js` into Tiled's user extensions folder (open it from Tiled's Preferences > Plugins), then reopen/reload Tiled if needed. Open your TMX map and choose **File > Export As... > SUBSTRATE semantic world**, saving as `.sworld.json`. The exported format is an agent-readable manifest; the browser import adapter for this format is still pending. Tiled also exports ordinary JSON directly without this extension.

## 2D/3D switch contract

A tile has stable semantic identity `grass` etc., plus a stable `asset3d` path. In 2D, draw the tile from the atlas. In 3D, batch ground tiles into a textured plane/mesh (or instantiate the corresponding prototype GLB) and place trees from their separate overlay GLB. Keep stable cell IDs, collision/material state and the landing point across rendering modes. The browser viewer is an initial renderer prototype, but a complete 2D/3D switch, terrain streaming and physics are future work.

For large maps do not instantiate a GLB per ground tile; merge/instance repeated terrain meshes and use collision proxies. Default to low poly for 4 GB systems.

Generated starter art and GLB geometry in this repository are dedicated to the public domain under CC0-1.0. No external marketplace assets were copied.
