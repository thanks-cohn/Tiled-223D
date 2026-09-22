# Instructions for coding agents

Read `docs/CODEX_HANDOFF.md` before changing this repository. Follow the staged acceptance criteria in that file. Work on this standalone browser world first; do NOT modify FrameChute/SUBSTRATE repositories unless separately asked.

## Product contract
This is an agent-readable Tiled 2D terrain + numeric elevation -> low-cost 3D flight world. The viewer has a clear LIGHT-BLUE SKY, visibly DARKER DEEP-BLUE OCEAN, and an unambiguous horizon at all normal flight altitudes. The world should feel wide, calming and dreamlike; exiting upward fades to a "waking up" return-to-canvas placeholder. Ship model is a sphere by default; user-provided `public/ship/ship.glb` replaces it if valid. Keep any absence/failure nonfatal.

## Current project
- `src/world-data.js`: canonical world data, sample 500x500 two-island world, wrap and Tiled JSON import.
- `src/terrain.js`: batched low-poly ground, ocean and cheap cloud sprites.
- `src/main.js`: Three.js scene, flight, imports, atmospheric exit, ship asset fallback.
- `extension/substrate-world.js`: Tiled map exporter (Tiled's Qt JS API, NOT browser JS).
- `assets3d/`: 7 low-poly glTF prototypes mapped by semantic ID; `public/ship/` is the override slot.
- `maps/test-world.tmx` and `maps/test-world.json` are the small starter map. The current 500x500 world is PROCEDURALLY GENERATED in `src/world-data.js`, not a committed 500x500 TMX.
- `index.html`, `package.json`: standalone Vite app. `npm install`, `npm run dev`, `npm run build`, `npm test`.

## Invariants
1. Store authoritative terrain IDs, numeric heights, semantic object IDs, player/world coordinates and landing points independently of rendering. Map X -> world X; map Y -> world Z; numeric elevation -> world Y. Never derive physics from screen pixels or sky appearance.
2. No elevation ceiling implied by 0-4 presets. Validate finite, bounded-by-config numeric inputs before mesh generation; use sane preview scaling/LOD for huge heights. Water is non-walkable, even when visually blue.
3. Horizontal wrap uses `((v % size) + size) % size`. This is a repeating-map approximation; wrapping both axes is NOT a real spherical planet. Do not claim true spherical topology before implementing it.
4. Avoid 250k individually simulated or rendered tiles and 9 unnecessary full copies. Batch nearby visible terrain by chunks/material, instance repeated props, sleep distant simulation, reuse and dispose GPU resources when swapping maps.
5. Make Tiled's exported semantic format and the browser importer agree. Parse tileset firstgid + per-tile semantic properties; do not hardcode global GIDs for general imports. Unknown semantics must produce a clear error, never silently become grass.
6. Separate 2D map/layer order, optional paired 2D/3D asset render order, world transform, collision and canonical identity. Only render modes change, not the object's world identity.
7. Sky follows the camera; distant 2D cloud images or sprites should be replaceable, with no mandatory network call. Sky and ocean must remain distinct in color, horizon never disappears unexpectedly. No actual volumetric simulation required.
8. World-to-SUBSTRATE handoff: emit a documented exit event, then show a standalone canvas placeholder. Reentry keeps world state where possible. Do not pretend the placeholder is an existing FrameChute integration.
9. Accessibility: clear keyboard controls, non-flashing transitions, explicit escape/return, useful import errors; no auto-upload of local maps or assets.
10. Do not introduce native/C++/WASM requirements for this first version. Local browser CPU/GPU is the default. Third-party assets need verified reuse licenses; preserve their attribution.

## Agent workflow
Inspect current files and reproduce behavior first. Make small commits in task order; prefer tests for world math, importer, boundary handling, and exit state over unverified visual claims. Run `npm test` and `npm run build` and report actual results; if browser rendering cannot be exercised, say so. Never claim a feature is finished just because a placeholder/demonstration exists. Update README and `docs/CODEX_HANDOFF.md` when contracts change.
