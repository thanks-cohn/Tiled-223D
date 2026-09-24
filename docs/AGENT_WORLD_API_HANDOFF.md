# ÆXIS agent world API: Codex implementation handoff

**Status:** Implementation brief, not shipped. **Repository:** Tiled-223D. **Product goal:** A hobbyist describes a world with a few pictures and sentences; their chosen agent plans, builds, inspects and revises Tiled-editable maps through a documented local API. The same operations serve the desktop UI, Codex, other agents and an engineer writing scripts. The user should be able to accept a good default, edit individual regions and keep working in one workspace.

Start by reading `AGENTS.md`, `docs/CODEX_HANDOFF.md`, `docs/LOW_GROUND_INSERTION.md`, `docs/WORKFLOW_SINGLE_IMAGE_TO_WORLD.md`, `Proposals/aexis-within-reason-single-image-world.md`, `Proposals/substrate-workspace-app-format-native-tabs.md` and `Desktop/App/README.md`. Reproduce the current browser flow before changing it.

## Concrete user story

> “Here are three overhead pictures. Make three islands inspired by them on my 500 × 500 Tiled-cell canvas. Fill the intervening space with smaller connected and separate places as I describe. I want 23 named, ready-to-edit regions overall. Show me the arrangement first; then build it and let me adjust any one region without rearranging the other 22.”

The three pictures are references, not truth about unseen sides or exact elevations. A “region” may be an island, neighborhood, terrain patch or smaller authored world. The request for 23 does **not** mean allocate 23 full 500 × 500 arrays; it means compose 23 distinct, identified regions within one 500 × 500 destination where constraints allow. If requested sizes, gaps or connectivity do not fit, return a conflict and proposed alternatives rather than quietly dropping places or shrinking protected ones.

## Current baseline to preserve

- `scripts/create-starter-map.mjs` produces an editable 500 × 500 ordinary Tiled JSON map and original elevation companion; `maps/low-town-50x50.json` is a first patch.
- `scripts/assemble-low-world.mjs` recognizes a single exported `Additions` overlay, makes low terrain and a numeric height grid, and writes a combined ordinary Tiled JSON file. It is not a multi-region planner or general seam solver; keep its current tests passing.
- `src/world-data.js` imports ordinary Tiled JSON and optional or embedded `substrateElevation`; it rejects raw unprocessed `Additions`.
- `extension/substrate-world.js` exports a distinct `.sworld.json` schema using the Tiled Qt scripting API. That schema is **not yet** accepted by the viewer.
- `Desktop/App` has an experimental Qt shell with a watched ordinary-JSON map and debug state. Its Map tab does **not** yet contain Tiled; do not claim the proposed agent API, native Tiled hosting or image recognition exists.

## Architecture: one core, several ways to call it

Create a framework-light JavaScript/TypeScript **world operations core** with versioned JSON request/response schemas and pure validation/composition functions. Expose the same core through a local CLI and a small programmatic library first. The desktop app may later invoke it through bounded local IPC; an MCP/tool adapter may later expose its methods to Codex and third-party agents. Transport must not determine map semantics. No remote service, login, LLM call or Qt installation is required for core tests or basic scripted generation.

Treat the editable project as canonical: source image references, base map/elevations, stable region/object IDs, hard and soft constraints, tile semantics, proposed versus authored values, style seed, asset attribution, revisions and operation log. The `.tmx`/ordinary Tiled JSON map, `.sworld.json` semantic export and 3D runtime map are **derived or synchronized projections** with explicit adapters. Do not create a second silent truth in the renderer or overwrite the user's original map. Preserve raw reference files by path and hash; export only when the user chooses to package them.

### Minimum operations, shared across CLI, UI and future agent bridge

| Operation | Input → result | Required behavior |
| --- | --- | --- |
| `project.open` / `project.inspect` | Local project directory → version, map bounds, semantic layers, elevation source, occupied/locked regions, assets, capabilities | Read-only, bounded, inspectable; never scan arbitrary folders. |
| `reference.add` | Project-local picture and optional direction/scale/region hint → reference ID and metadata | Keep provenance and user-provided scale separate from model guesses. No hidden upload. |
| `world.plan` | Goal, named regions, references, relations, requested seed → draft plan, diagnostics and alternatives | Dry run only. Estimate occupancy, collisions, connectivity and uncertainty without modifying project files. |
| `region.inspect` / `map.inspect` | ID or bounded rectangle/layer → semantic cells, bounds, heights, neighbors, provenance and image/reference links | Inspect the portion an agent intends to edit; support pagination/bounded response size. |
| `region.place` / `map.patch` | Draft revision, stable IDs and tile/object/height changes → validated change set or conflict | Coordinate-precise edits to the Tiled design, with no simulated mouse clicks. Respect locks and map X→world X, map Y→world Z. |
| `world.preview` | Draft revision, viewport/detail budget → cheap image or viewer-ready artifact plus diagnostics | No commit; report rough heights, seams and cost. A headless plan preview may run without GPU. |
| `world.commit` / `world.undo` | Expected revision, chosen operations → atomic new revision and undo token | Optimistic concurrency; unrelated authored regions unchanged, failed operations leave the prior version intact. |
| `world.export` | Revision and target (`tiled-json`, later `tmx`, semantic, runtime) → paths, checksums and warnings | Validate all outputs and report unsupported formats; a Tiled map opens for manual editing and reimports by stable ID. |

Include `operationId`, `schemaVersion`, `projectId`, `expectedRevision`, `actor` and seed where relevant. Responses use machine-readable codes such as `OUT_OF_BOUNDS`, `OVERLAP_LOCKED`, `UNKNOWN_TILE_SEMANTIC`, `UNSUPPORTED_TILESET`, `HEIGHT_CONFLICT`, `CAPACITY_EXCEEDED` and `REVISION_CONFLICT`, with human-readable repair choices. A repeated `operationId` must not apply the same patch twice. Keep one compact event/diagnostic format for both the `Desktop/App --debug` panel and CLI `--debug`; log only project-scoped paths, redact external secrets and let the user export diagnostics deliberately.

## Request example: three references and 23 regions

This illustrates intent and versioning, **not a frozen production schema**:

```json
{
  "schemaVersion": 1,
  "operationId": "plan-three-anchors-v1",
  "projectId": "my-500-world",
  "expectedRevision": 4,
  "seed": 27183,
  "canvas": { "width": 500, "height": 500, "unit": "tiled-cell" },
  "references": [
    { "id": "north-photo", "path": "references/north.png", "role": "overhead", "regionId": "north-island" },
    { "id": "west-photo", "path": "references/west.png", "role": "overhead", "regionId": "west-island" },
    { "id": "east-photo", "path": "references/east.png", "role": "overhead", "regionId": "east-island" }
  ],
  "regions": [
    { "id": "north-island", "kind": "island", "anchor": { "area": "north" }, "referenceId": "north-photo", "lockedAfterAccept": true },
    { "id": "west-island", "kind": "island", "anchor": { "area": "west" }, "referenceId": "west-photo", "lockedAfterAccept": true },
    { "id": "east-island", "kind": "island", "anchor": { "area": "east" }, "referenceId": "east-photo", "lockedAfterAccept": true }
  ],
  "additionalRegions": { "count": 20, "kinds": ["small-island", "shore", "settlement"], "instruction": "Varied places between the three anchors; keep navigable water and two connecting routes." },
  "constraints": [
    { "kind": "separate", "regions": ["north-island", "west-island"] },
    { "kind": "route", "from": "west-island", "to": "east-island", "mode": "traversable" }
  ],
  "mode": "dry-run"
}
```

The planner should return 23 IDs and candidate footprints only if they fit. It must mark whether an image informed a coastline, terrain color, object classes or just style; it must not pretend an overhead photo revealed exact building heights or fronts. The user approves the draft, then `world.commit` materializes the selected plan. Further edits to region 17 should preserve regions 1–16 and 18–23 unless a previewed seam explicitly changes them.

## Planner and generator contracts

1. Parse natural-language descriptions into **explicit, reviewable constraints**. The offline baseline uses structured choices and a small phrase grammar; an optional agent/model can draft the same schema. Unrecognized prose remains visible instead of becoming silent instructions.
2. Give each requested region stable identity, bounds, intent (hard edge versus soft envelope), provenance and a seed. Hard coastline, keep-out, existing authored terrain/elevation and locked reference maps outrank style preferences. Detect contradictory constraints before writing.
3. Solve placement with occupancy and gap/connectivity rules on a coarse grid, then refine cells. Do not instantiate 23 full-world maps or regenerate all 250,000 cells on every edit. Show an overhead plan with named footprints, routes, water gaps, overlaps and uncertainty.
4. Derive terrain, numeric heights and connected seams. Use the current low-ground assembler only where its supported inputs fit; general coast/mountain/river or elevated joins require new rules and acceptance tests. “Within Reason” applies bounded proportions, relationships and variation while keeping outputs editable.
5. Later recognition from uploaded overheads can propose roads, buildings, cars, trees and colors, with object-level confidence, editable heights and license-tracked optional assets. Keep the first structured placement API useful **without** a vision model. If model inference is too expensive on 4 GB, retain the manual/agent-provided outlines and generated preview.
6. Keep Tiled's editable map honest: semantic tile IDs and layer roles are explicit; use tileset `firstgid` and per-tile metadata instead of assuming fixed GIDs for all imports. Preserve object identities through export/reimport. Do not force `.sworld.json` through an importer that expects ordinary JSON.

## Permissions and accessibility

The creator chooses a project folder and grants an agent scope such as **inspect**, **draft**, **edit selected regions**, or **commit/export**. That project grant can cover repeated ordinary actions without a prompt for each tile. An agent cannot read unrelated folders, upload references, launch arbitrary programs or publish output because it has map-edit permission. The UI shows author versus agent changes, allows review/undo and can disable the integration. A hobbyist should be able to use a simple “three pictures + describe + preview + accept” route; engineers and agents get the same operations with precise coordinates and diagnostics.

## Implement in reviewable slices

1. **First vertical slice:** factor a small project schema and pure `plan/inspect/place/preview/commit/export` core out of the current scripts, with a CLI. Compose two or three existing terrain-v1 regions into a 500 × 500 starter without modifying the input, preserve supplied elevations, and produce an ordinary Tiled JSON plus a cheap plan preview. Add meaningful tests for collisions, locks, revision conflicts, determinism and reimport. Document every unsupported feature.
2. **Scale the planner:** test 23 distinctly named variable-size regions and three fixed anchors with gaps/connectivity, bounded time/memory and targeted regeneration. Return a truthful capacity conflict if they cannot fit. Do not claim image-driven geometry at this stage.
3. **Align Tiled interchange:** reconcile the existing extension's semantic export with the importer, implement stable object/region IDs and round-trip/conflict reporting, and connect the desktop watcher/agent bridge to a versioned revision rather than a naked file change.
4. **Add vision and richer generation:** overhead recognition, Within Reason height/façade proposals, optional multi-view references and licensed assets, then native Tiled-in-tab after the separate Qt/Windows host proof. Measure actual 4 GB Windows memory, startup, plan and preview time for each slice.

The browser flight demo must continue to start without Qt or a model. Run `npm test` and `npm run build` for changes to its JS path. Qt compilation/GUI behavior and target-device benchmarks must be reported as unverified until performed. Update this brief and `docs/CODEX_HANDOFF.md` when the API contract becomes concrete; keep examples executable and avoid claiming later stages shipped.
