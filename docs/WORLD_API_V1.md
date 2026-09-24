# Local world API v1

The first vertical slice has one versioned project core and two independent JavaScript surfaces. `ProgrammerWorldApi` provides bounded cell inspection, exact numeric `patchCells`, rectangular `placeRegion`, atomic transactions and undo. `AgentWorldApi` provides capability inspection, seeded intent planning, explicit proposed operations, non-mutating SVG preview and commit.

Both use schema version 1, terrain-v1 IDs, map X → world X / map Y → world Z, finite numeric elevations, stable region IDs, optimistic revisions, actor grants, operation IDs, locks and the same transaction/undo log. Commit-time validation enforces locks even for operations constructed without the convenience APIs. Undo accepts the same operation envelope as commit and checks its actor's `commit` grant and expected revision before changing state. An agent plan is reviewable data, not a hidden prompt. No model, upload, Tiled GUI automation, Qt or network call is involved.

## Project and CLI walkthrough

The initializer never overwrites its inputs:

```sh
node scripts/create-starter-map.mjs
mkdir -p generated/api-demo
cp generated/starter-500.json generated/starter-elevation.json generated/api-demo/
npm run world-api -- init --project generated/api-demo --map starter-500.json --elevation starter-elevation.json --id demo
npm run world-api -- inspect --project generated/api-demo
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
