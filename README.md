# Tiled-223D — Fly the Two-Island World

**You do not need Codex.** This repository already has a standalone Three.js browser viewer. Run it locally with the included starter scripts.

**Windows:** In GitHub, choose **Code → Download ZIP**, extract the ZIP, then double-click `start-world.bat` inside the extracted folder. The first launch installs the small JavaScript dependencies; later launches reuse them. Node.js LTS must be installed on your computer ([nodejs.org](https://nodejs.org/)). A browser window should open to the flight demo. Keep the terminal window running while you play.

**Mac/Linux:** Extract the ZIP, open a terminal in the project folder, and run `sh start-world.sh`.

**Manual launch:** `npm install` followed by `npm run dev -- --open`. Do **not** double-click `index.html` directly: the project uses ES module imports that need the local Vite server.

**Flight controls:** W/S forward/back, A/D turn, Up/Down ascend/descend, Shift boost, R take off. Import your Tiled map JSON and its separate elevation JSON through the on-screen buttons. The ship defaults to a low-poly sphere; add `public/ship/ship.glb` to replace it.

The default demo procedurally generates a **500 × 500 mostly-ocean world with two sandy-coast islands**; the committed `maps/test-world.tmx` is a separate smaller editing example. This is an early flight/landscape demo, **not yet a fully verified browser experience on a 4 GB machine or a finished FrameChute integration**. The “You're awake” screen is a standalone canvas placeholder.

For ongoing engine tasks see [docs/CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md), but **you can launch and explore without Codex**.

---

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
