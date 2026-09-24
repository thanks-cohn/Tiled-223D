# Tiled-223D — Fly the Two-Island World

**Experimental desktop workspace:** [Desktop/App](Desktop/App/README.md) contains a Qt shell with an on-demand browser world tab, a selected-map watcher and opt-in diagnostics. The actual Tiled native tab and `.sworld.json` round trip are still proposed work; the standalone browser path below remains the working entry point.

**Seven-stage world creation roadmap:** [ÆXIS → AERIS → TOPOS → SEKAI → ASTRA → ARCADIA → ANIMA](Stages/README.md).

## NEW: Insert a 50 × 50 low island into your 500 × 500 Tiled world

The first offline **Sketch-to-World / Low to the ground** test is documented in [the step-by-step guide](docs/LOW_GROUND_INSERTION.md). Use the [50 × 50 test town-site](maps/low-town-50x50.json), paste its Ground tiles onto a separate **Additions** layer in your editable 500 × 500 map, export ordinary Tiled JSON, then drag that JSON onto **generate-low-world.bat**. Keep/supply your original elevation JSON to preserve old heights. This produces a single **generated/low-world.json** containing the combined map and generated numeric heights. Launch **start-world.bat** and import that single JSON through **Import Tiled JSON → Load map**; no separate elevation file is needed for generated output.

If you do not already have the current 500 × 500 procedural demo in Tiled, run `node scripts/create-starter-map.mjs` to export its editable map and original elevations under `generated/`. The generator detects new painted regions, adds a low and irregular shoreline over empty ocean without overwriting old ground, and varies the result by a saved seed. This is a basic terrain/height prototype, **not** a built-in graphical GLB-town editor or a replacement for your original authored map.


**You do not need Codex.** This repository already has a standalone Three.js browser viewer. Run it locally with the included starter scripts.

**Windows:** In GitHub, choose **Code → Download ZIP**, extract the ZIP, then double-click `start-world.bat` inside the extracted folder. The first launch installs the small JavaScript dependencies; later launches reuse them. Node.js LTS must be installed on your computer ([nodejs.org](https://nodejs.org/)). A browser window should open to the flight demo. Keep the terminal window running while you play.

**Mac/Linux:** Extract the ZIP, open a terminal in the project folder, and run `sh start-world.sh`.

**Manual launch:** `npm install` followed by `npm run dev -- --open`. Do **not** double-click `index.html` directly: the project uses ES module imports that need the local Vite server.

**Flight controls:** W/S forward/back, A/D turn, Up/Down ascend/descend, Shift boost, R take off. Import your Tiled map JSON and its separate elevation JSON through the on-screen buttons. The ship defaults to a low-poly sphere; add `public/ship/ship.glb` to replace it.

The default demo procedurally generates a **500 × 500 mostly-ocean world with two sandy-coast islands**; the committed `maps/test-world.tmx` is a separate smaller editing example. This is an early flight/landscape demo, **not yet a fully verified browser experience on a 4 GB machine or a finished FrameChute integration**. The “You're awake” screen is a standalone canvas placeholder.

For ongoing engine tasks see [docs/CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md), but **you can launch and explore without Codex**.

---

## V8 camera and flight stability update

**Camera:** The `View` button (or `V`) immediately toggles the **actual** Forward/Overview view; use the separate `Auto camera` button (or Shift+V) to return to automatic low/middle Forward and high/planetary Overview. `Fly forward` controls movement only. The Massive (16,000) world now uses the same proportions for the camera's horizontal distance and vertical follow height as the smaller worlds, and both camera views aim toward the world as altitude rises rather than becoming stuck looking into empty sky. The overview continues to frame more of the planet centrally without adding another globe mesh. These changes need visual confirmation on the affected browser.

**Flight/navigation:** Pressing S overrides automatic forward cruise instead of canceling it out; a near-land collision advances only to the last safe sample, then lets you reverse. Deliberate world-scale changes preserve relative location and earned momentum rather than resetting spawn. The intermittent user-reported surprise reset and the exact high-altitude visual result still require affected-device confirmation. See [camera/navigation agent binding](Semantic-Bindings/camera-navigation-v1.md) and [Bugs/](Bugs/README.md).

## Altitude Parallax Cloud Choreography V8 (this experimental branch)

Four altitude moods now coordinate a **stable world-anchored pool of 27 reusable cloud formations**: peaceful California-highway cruising, active atmospheric flybys, expansive layers above and below, and distant ground-parallel planetary clouds. The renderer reuses four tiny different procedural cloud silhouette textures; size, spacing, opacity and angle vary with a deterministic seed. Low clouds pass and recycle ahead more often; upper clouds stay longer as visual references for speed. Altitude/speed-dependent timers only limit recycling work, never move a visible cloud to fake travel. This is an unmerged experimental child of V7; the original first-person camera, W/S blockage and reported position-reset problems are **tracked, not fixed** in this cloud change.

**Agent entry points:** [V8 cloud binding](Semantic-Bindings/cloud-parallax-v1.md), [machine-readable cloud schema](Semantic-Bindings/cloud-parallax-v1.json) and the new [Bugs/ registry](Bugs/README.md) distinguish implemented behavior from outstanding issues. These changes are intended to remain lightweight on a 4 GB computer, but appearance and FPS require actual in-browser validation before merging.

## Three Planet Scales V7 (previous experimental branch)

Choose **Current (500²)**, **Bigger (2,500² / 25× area)**, or **Massive (16,000² / 1,024× area)** from the flight HUD. The existing island geometry and 500² source map remain unchanged; bigger planets use sparse island coordinates and procedural ocean instead of constructing enormous tile grids. The planet radius and visible curvature respond to the selected profile. A floating render origin keeps the camera and scenery close to zero in GPU X/Z space to reduce high-altitude jitter. From altitude, cloud cards transition to planes **parallel to the curved planetary ground**, not perpetually facing the camera. A bounded 500² overview and fixed cloud/ocean geometry budgets preserve the low-compute design; this does **not** guarantee a particular FPS on a 4 GB computer. See [V7 implementation and limits](docs/SCALE_PROFILES_V7.md), [agent documentation](Semantic-Bindings/scale-profiles-v1.md) and [machine-readable binding](Semantic-Bindings/scale-profiles-v1.json). This is a separate unmerged branch; the earlier antivirus alert is not addressed by planet scaling.

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
