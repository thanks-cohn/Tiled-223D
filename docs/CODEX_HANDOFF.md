# Codex handoff: standalone Toon World / Tiled-223D

## Next Codex task: agent-native diagnostics

The current implementation request is [the unified agent-native world API diagnostics task](CODEX_AGENT_NATIVE_DEBUG_CONTRACT_V1.md). It calls for one versioned diagnostic event/API contract with bounded regular and deep debug views for programmers and agents, plus actor-scoped inspection, precise machine-readable types, and semantic cell explanations. Work on the linked task from branch `codex/agent-native-debug-contract-v1`; its document is a specification, not a claim that the features already exist.

## Agent-created worlds: next implementation track

Read [the ÆXIS agent world API handoff](AGENT_WORLD_API_HANDOFF.md) for the longer plan. The first local vertical slice is implemented in [WORLD_API_V1.md](WORLD_API_V1.md): independent programmer and agent surfaces share a schema-v1 core, permissions, revisions, locks, protected authored base cells, precise sparse-patch masks, atomic commit/undo and Tiled JSON export. A shared inspection extension adds a truthful runtime manifest, bounded region/operation queries and a computed placement-surface fixture with lock/protection diagnostics; the fixture does not place entities or GLBs. Plans with diagnostics or no valid operations are non-committable. It handles a deterministic two-or-three-region workflow, not the three-picture/23-region workflow; image understanding, general seam/connectivity solving and scale-stage capacity planning remain unimplemented.

## Experimental desktop shell (2026-09-24)

`Desktop/App` now contains an isolated Qt 6/C++ shell skeleton for the proposed single-workspace workflow. It does not change the browser-first project contract: the existing viewer is loaded lazily through Qt WebEngine, and a selected ordinary Tiled JSON file is read by the native shell, watched with a debounce and passed to `fromTiled()` through an opt-in Qt WebChannel bridge. A debug-only dock records expected versus actual capabilities and import events. The Map tab is a clearly labeled placeholder; the native Tiled editor, `.sworld.json` adapter, packaged installer and 4 GB Windows validation do not exist yet. See `Desktop/App/README.md` for the run/debug sequence. This shell must remain optional; `npm test` and `npm run build` must work without Qt.

## Goal

Build a **working lightweight browser world** from a top-down Tiled map and an independent numeric elevation grid. Fly a low-poly ship over two small islands in a mostly-ocean 500 × 500 repeating world, see a clear blue sky/darker ocean and persistent horizon, navigate over actual elevated ridges, ascend past an atmosphere threshold, fade to a quiet “You're awake” canvas placeholder, and return. It must later embed in FrameChute with a small enter/exit API, but do not integrate it there yet.

The user prioritizes *maximum emotional richness per unit of computation* on a roughly 4 GB computer. Keep 2D map data as truth and construct only enough 3D geometry for nearby terrain and authored 2D/3D paired obstacles. Full planet physics, photorealism, active ocean simulation, animated crowds, LLM calls per frame, and C++/WASM are NOT MVP requirements.

## Real repository status (inspect and re-verify; do not assume complete)

A Vite/Three.js browser prototype currently exists: `index.html`, `package.json`, `src/main.js`, `src/terrain.js`, `src/world-data.js`. It generates a **500 × 500 map in JavaScript**, draws batch meshes for low-poly land, an ocean disk and simple procedural cloud sprites, offers flight and exit/reenter UI, and loads optional `/ship/ship.glb` with sphere fallback. The existing Tiled extension exports a distinct `.sworld.json` representation; the viewer currently imports ordinary Tiled JSON, **not that exported semantic format**. There is no verified real 2D/3D paired-object placement UI, no genuine FrameChute canvas return, and no real planet/sphere coordinate system. The repo's example TMX is smaller than the procedural sample. Inspect for performance, resource and correctness problems before expanding features.

## Canonical world contract

Use a **finite semantic map** independent of renderer objects:
- Default logical map 500 columns × 500 rows; ocean is implicit/default; two islands approximately 50 × 50 cells, separated by water and surrounded by low sand coastline; interior grass with ridges and valleys, plus explicit safe landing cells.
- `terrainId(x,z)` is one of grass, dirt, sand, ocean, river, lake. Trees/paired objects live in a separate structures layer. Ocean/river/lake are distinct semantic types and may share a water material. Do not infer object meaning from color.
- `height(x,z)`: finite, unrestricted-by-small-enum numeric elevation in world units; allow large positive/negative values within explicit safe serialization/renderer bounds. Renderer may use configurable vertical scale and elevation-specific LOD; do not silently clamp user-authored heights to 0–4.
- `position`: world X and Z correspond to Tiled column and row; Y is altitude. `worldId`, stable object/cell IDs, landing location(s), appearance, collision and layer/sort order are separate fields.
- `wrap(x,size)=((x%size)+size)%size`; wrap X (and prototype Z if configured) when sampling terrain and preserving player world position. Both-axis wrap is a **toroidal/repeated-map approximation**, not spherical poles. Preserve an eventual spherical adapter boundary.
- For paired obstacles: one stable object with `asset2d`, `asset3d` (optional), `anchor {x,z,yOffset}`, footprint, layer/sort rule, transform and collision proxy. Missing 3D asset falls back to a proxy rather than silently losing its semantic position.

## Flight / visual specification

- Three.js and plain JS are already present; remain framework-light. Render local terrain as bounded chunks, grouped by material. Reuse textures/meshes, instance trees, and sleep/don't render distant interactive entities. Ocean may be a cheap camera-following visual mesh; *navigation* still samples canonical logical terrain.
- A cheap camera-following sky/gradient dome (or other visually equivalent far background) with replaceable transparent 2D cloud images/sprites. Clear **visible horizon** at ordinary flight altitudes; day sky must be lighter and visually distinct from darker ocean. Avoid a screen-filling, textureless uniform blue.
- Simple third-person Star Fox-inspired ship flight; sphere placeholder by default. When `public/ship/ship.glb` is present, load it **once** via `/ship/ship.glb`; bad/missing asset leaves sphere intact. Future ship asset transforms and collision defined separately.
- Terrain must physically affect approach/landing. Evaluate collision against actual height at the relevant footprint, not against viewport pixels. Water is not automatically a solid runway. Disallow tunneling through high ridges with bounded/time-stepped checks or swept sampling where appropriate.
- Near warning altitude emit a one-shot world-atmosphere warning; above exit altitude emit `substrate:world-exit` with world ID and wrapped position, fade to a plain “You're awake” placeholder; `substrate:world-enter` on reentry. Store/restore world state; keep exit cutscene replaceable. Do not put the scene into a stale input/rendering state after exiting.

## Codex implementation order (small commits with tests)## Low-ground insertion test (2026-09-23)

The first limited world assembly path now includes `maps/low-town-50x50.json` (a Tiled terrain-site asset), `scripts/create-starter-map.mjs` (exports the procedural 500 × 500 demo and its elevation companion), `scripts/assemble-low-world.mjs` and `generate-low-world.bat` (recognize nonempty `Additions` tiles in a Tiled JSON map, generate a low connected beach skirt and numeric elevations, preserve supplied old heights, and output `generated/low-world.json`). The viewer's `fromTiled()` now reads that file's embedded `substrateElevation` when no explicit elevation file was provided and refuses a raw map with still-unprocessed `Additions`. The initial terrain-v1 IDs and ordinary uncompressed orthogonal tile-layer arrays remain an explicit limitation. See [the user workflow](LOW_GROUND_INSERTION.md) and [regression tests](../tests/assemble-low-world.test.js).

The generator is seeded and offline; a new run gets a new variation, whereas saving the chosen output or using `--seed` preserves repeatability. User-authored maps must never be overwritten, and the missing-original-elevations warning is meaningful: 2D terrain imagery cannot recover prior authored numeric altitude. This first test does **not** implement the proposed arbitrary GLB town/plane, floating disk, mountain joining, or general graphical world editor. Follow these incremental contracts before expanding the feature.



1. **Audit and run**: inspect current files; run `npm install`, `npm test`, `npm run build`, and a browser smoke test if available. Write down real failures. Verify low-end quality setting and correct horizon on screenshots if browser access exists.
2. **World math + tests**: expose pure helpers for wrapping, height sampling, finite-height validation, land/water and landing validation; write Node tests for negatives, boundary crossing, high ridges, ocean landing rejection, and 500 × 500 bounds. Do not let rendering consume the only authoritative copy of data.
3. **Importer alignment**: make the Tiled `.sworld.json` exporter and browser loader speak the same versioned schema OR implement a documented adapter; support ordinary Tiled JSON plus optional elevation companion; derive semantic mapping from tile metadata/firstgid rather than assuming GIDs 1–7. Fail clearly on unknown/unmapped tiles.
4. **Performance + geometry**: profile initial load and world switching. Render chunks near camera instead of building every map cell into nine entire-world copies. Make water and sky cheap and reusable; dispose discarded GPU resources. Measure frame time on a low-end device if available.
5. **Descent, horizon and atmosphere**: verify clear ocean/sky separation, cheap customizable clouds, altitude and collision safety, wake fade, ship fallback and exit/enter callbacks. Keep visuals independent of map simulation.
6. **Paired objects (next phase)**: add a single example obstacle with linked 2D marker / 3D model, placement anchor, selected visual layer and solid 3D footprint, then extend to generic imported pairs. Do not turn this into an asset marketplace or image-to-3D AI project yet.
7. **Handoff**: document `mountWorld(host, options)`, `enterWorld(destination)`, `exitWorld(reason)` or equivalently small lifecycle hooks without assuming FrameChute DOM. Allow standalone use until integration requested.

## Acceptance checks

- New clone can run `npm install && npm run dev`; `npm test` and `npm run build` pass. Report actual test output.
- Two islands render as coherent elevated land with sand-only immediate coast; most of the 500 × 500 terrain is ocean. A ridge blocks an unsafe landing, and a safe inland spawn exists.
- East/west travel past the logical map boundary returns to corresponding wrapped cells with no visible square/ocean edge; wrapping is not misrepresented as a globe physically.
- Sea remains a clearly darker/different blue than daytime sky; horizon is consistently readable from normal flyover altitudes; clouds can be changed without touching world data.
- No need to instantiate or simulate 250,000 separate tile meshes. Viewer's memory and resource lifecycle are bounded and documented.
- A map imported from Tiled and its numeric elevation produce the same location/elevation semantics that an agent can query; missing/invalid inputs produce readable errors.
- Default sphere is playable; valid ship GLB can replace it without world or control rewrite.
- Ascending and exiting yields a fade to “You're awake” and a documented event; returning does not require a full page refresh. Do not claim FrameChute integration exists.

## Safe changes / non-goals

Do not overwrite source maps to regenerate examples; keep user maps and assets distinct from generated previews. Do not upload private content or require cloud services for this prototype. A sky dome is a camera-relative VISUAL, not a real atmospheric collider. No fake promise that 500 × 500 textures/physics can all be rendered free: profile chunk size, GPU memory, JS heap, and 4 GB device headroom. For the first implementation, correctness and recognizable atmosphere matter more than effects counts.
