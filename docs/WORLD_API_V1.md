# Local world API v1

The first vertical slice has one versioned project core and two independent JavaScript surfaces. `ProgrammerWorldApi` provides bounded cell inspection, exact numeric `patchCells`, rectangular `placeRegion`, atomic transactions and undo. `AgentWorldApi` provides capability inspection, seeded intent planning, explicit proposed operations, non-mutating SVG preview and commit.

Both use schema version 1, terrain-v1 IDs, map X → world X / map Y → world Z, finite numeric elevations, stable region IDs, optimistic revisions, actor grants, operation IDs, locks and the same transaction/undo log. Commit-time validation enforces locks even for operations constructed without the convenience APIs. Undo accepts the same operation envelope as commit and checks its actor's `commit` grant and expected revision before changing state. An agent plan is reviewable data, not a hidden prompt. No model, upload, Tiled GUI automation, Qt or network call is involved.

## Runtime inspection extension

`AgentWorldApi` and `ProgrammerWorldApi` delegate their new queries to the same read-only inspection core. `inspectCapabilities(actor)` reports only callable v1 operations, terrain-v1, finite-canvas topology, the map-X/map-Y to world-X/world-Z convention, the requesting actor's grants, adapters, budgets and explicit limits. It does not advertise entity or GLB placement. Every new query requires the actor's `inspect` grant:

- `inspectRegions(actor, {offset, limit})` and `inspectRegion(actor, id)` expose stable identity, bounds, provenance, revision, lock state and protected-base-cell count without returning unbounded terrain arrays.
- `inspectOperations(actor, {offset, limit})` pages the transaction log. Page size is limited to 100.
- `inspectPlacementSurface(actor, "region:<region-id>:surface")` computes a **diagnostic fixture** over an existing region. It reports bounds, numeric height range/sample, a terrain-derived normal, lock/protection facts and `supportsObject` reasons. It is not persistent entity state, a reservation, collision geometry, a placement mutation or general GLB support.

The response shapes are described by [`schemas/world-api-inspection-v1.schema.json`](../schemas/world-api-inspection-v1.schema.json). Inspection never increments revision or appends to the operation log. Existing mutation validation remains authoritative at commit time.

### V1 edit policy

The base map and elevation companion are immutable inputs. World API v1 treats only a base cell whose terrain is `ocean` **and** whose numeric elevation is exactly `0` as blank canvas. A new planned region or exact patch may write those blank cells; it may not replace any other base terrain or elevation. An unlocked API-authored region can be revised by using the same stable region ID, while a locked region cannot be revised. Different region IDs cannot write the same cell.

`patchCells` records a `writeMask`, so only the explicitly listed cells are owned and changed. Cells merely enclosed by the sparse patch's bounding rectangle are neither overwritten nor treated as overlap. When a masked patch uses an existing unlocked region ID, commit merges its written cells into that region: all previously owned cells, terrain, elevations, identity and metadata survive. Rectangular `placeRegion` and planned regions omit that mask and therefore intentionally write every cell in their bounds. These rules are validated by both convenience methods and again atomically at commit, so hand-built operations cannot bypass them. Conflicts return `PROTECTED_CELL`, `OVERLAP`, or `OVERLAP_LOCKED` diagnostics and leave the revision and project state unchanged.

A plan containing any diagnostic is not a committable partial plan (`PLAN_HAS_DIAGNOSTICS`). A plan or transaction with no valid operations is also rejected (`NO_VALID_OPERATIONS`). Neither case increments the revision or appends to the operation log; callers must resolve diagnostics and create/review a new plan.

## Project and CLI walkthrough

The initializer never overwrites its inputs:

```sh
node scripts/create-starter-map.mjs
mkdir -p generated/api-demo
cp generated/starter-500.json generated/starter-elevation.json generated/api-demo/
npm run world-api -- init --project generated/api-demo --map starter-500.json --elevation starter-elevation.json --id demo
npm run world-api -- inspect --project generated/api-demo
npm run world-api -- capabilities --project generated/api-demo --actor owner
npm run world-api -- inspect-regions --project generated/api-demo --actor owner --limit 25
npm run world-api -- inspect-operations --project generated/api-demo --actor owner --limit 25
# After committing a region, use the placementSurfaceId returned by inspect-regions:
npm run world-api -- inspect-surface --project generated/api-demo --actor owner --id region:north-garden:surface
```

Create `generated/api-demo/plan-request.json`. Every request carries the common envelope; `owner` is the initial local actor:

```json
{"schemaVersion":1,"operationId":"plan-1","projectId":"demo","expectedRevision":0,"actor":"owner","seed":27183,"regions":[{"id":"north-garden","kind":"island","width":30,"height":24,"anchor":{"area":"north"},"lockedAfterAccept":true},{"id":"west-town","kind":"settlement","width":24,"height":20,"anchor":{"area":"west"}},{"id":"east-shore","kind":"shore","width":28,"height":18,"anchor":{"area":"east"}}]}
```

```sh
npm run world-api -- plan --project generated/api-demo --request generated/api-demo/plan-request.json --out generated/api-demo/plan.json
npm run world-api -- preview --project generated/api-demo --plan generated/api-demo/plan.json --out generated/api-demo/preview.svg
# commit-request.json repeats the envelope with a new operationId and revision 0
npm run world-api -- commit --project generated/api-demo --plan generated/api-demo/plan.json --request generated/api-demo/commit-request.json
# export-request.json targets the newly reported revision
npm run world-api -- export --project generated/api-demo --request generated/api-demo/export-request.json --out generated/api-demo/world.json
```

The export is ordinary Tiled JSON. `Ground`, embedded `substrateElevation`, a visible `Substrate Regions` object layer, and `substrateRegions` metadata keep terrain, heights and stable IDs editable/reimportable. Source map and elevation files are only read. Metadata uses temp-file + rename; a failed multi-operation transaction leaves it untouched.

## Limits before the three-picture / 23-region workflow

This slice supports two or three rectangular, generated terrain-v1 regions. It does **not** yet provide image analysis, reference hashing/cataloguing, arbitrary asset-map ingestion through the CLI, irregular coast outlines, seam/connectivity solving, routes, paginated object inspection, selected-region grants, TMX or `.sworld.json` export, 23-region capacity optimization, or targeted seam regeneration. Anchor words select deterministic canvas areas; unrecognized natural language is not interpreted. Preview is a cheap labeled footprint SVG, not a final 3D preview. Imported Tiled edits inside a known region are recovered from the exported rectangle, but external edits to region metadata still need conflict reconciliation.

## Unified diagnostics and actor-scoped reads

All project reads now require an explicit actor with `inspect`: this includes the legacy `AgentWorldApi.inspect(actor)`, `ProgrammerWorldApi.inspectMap(actor, bounds)`, paged queries, placement fixtures, and `explainCell(actor, {x,y})`. Map inspection has an implementation-owned 4,096-cell cap; callers cannot raise it. Pages contain at most 100 records and are sliced before cloning.

Requests may select `debug: "off" | "regular" | "deep"` (CLI: `--debug`). This changes only the view of the core decision. A diagnostic-v1 record always carries stable code/severity/message, phase, operation/project/revision context, affected IDs or coordinates, and a repair hint. Deep mode adds the ordered trace actually captured by validation, capped at 32 steps; regular does not build that trace. Records are capped at 8 per response and text at 512 characters. Debug selection grants no permissions and never changes mutation results, project files, revision, or operation log.

`explainCell` reports authored base terrain/elevation/protection separately from projected terrain/elevation, current owner/lock/provenance, and coded reasons why the actor could not propose a write. It is a read-only snapshot; commit-time revision and concurrent-state validation remains authoritative. Sparse masks are honored: enclosed masked-out cells are neither diagnosed nor written.

Machine contracts are in `schemas/world-api-diagnostics-v1.schema.json`, `schemas/world-api-inspection-v1.schema.json`, `schemas/world-api-types-v1.schema.json`, and the precise declarations in `src/world-api/*.d.ts`. Capability entries name required grants and input/output schema IDs. The placement surface remains a computed diagnostic fixture, never persistent entity or GLB support.

Run the library example and equivalent CLI reads:

```sh
node examples/world-api-diagnostics.mjs
npm run world-api -- capabilities --project generated/api-demo --actor owner
npm run world-api -- inspect-map --project generated/api-demo --actor owner --x 0 --y 0 --width 32 --height 32
npm run world-api -- explain-cell --project generated/api-demo --actor owner --x 250 --y 250
npm run world-api -- commit --project generated/api-demo --plan generated/api-demo/plan.json --request generated/api-demo/commit-request.json --debug regular
npm run world-api -- commit --project generated/api-demo --plan generated/api-demo/plan.json --request generated/api-demo/commit-request.json --debug deep
```

CLI/library transport is implemented. ChatGPT-native tools, MCP, desktop IPC, a browser developer panel, and general asset/GLB placement remain future adapters. The Qt debug dock still emits its existing shell JSON-lines format; adapting it to diagnostic-v1 is an explicit future boundary, and Qt is not required by this core.
