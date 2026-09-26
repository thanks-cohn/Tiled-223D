# Compiled terrain v1

The shipped demo reads `public/dirt/compiled-v1/manifest.json`, a shared saved canonical production, and the selected Current/Bigger/Massive asset. Files are checked against SHA-256 and measured byte lengths. Missing, corrupt or incompatible assets produce a visible preparation error; gameplay never silently regenerates the continent.

`npm run dirt:compile` reproducibly rebuilds these derived assets from the existing saved canonical production. The initial production preserves the actual baseline viewer's 37 ramps. It differs from the older API default recipe; changing that recipe is a separate explicit creator edit. Build observations are printed to stdout and are excluded from reproducible files. The manifest contains paths, sizes and checksums; source/profile/algorithm versions, intervals, spatial bins, exact feature records and sample density are in the referenced JSON. Total shipped data is approximately 2.93 MB, including all three profiles; only the selected profile is fetched by the viewer. One 501×501 Float32 base-height array and a 500×500 mask/tone array are shared. No expanded dense grid exists.

## Runtime

- Static far surface: 65×65 prepared vertices and a nearest-filtered three-tone atlas, unlit, without contours, gradients or procedural color noise. Canonical overview and near experience geography are distinct charts. The coarse far surface is not collision ready.
- Near surface: permanent 16-unit chunk addresses. Plain ground uses 2-unit vertices; chunks intersecting indexed ramp neighborhoods use 0.25-unit vertices. Maximum 96 cached chunks; up to 81 visible. The row scheduler targets 2 ms of CPU work, with one bounded geometry publication per frame. A single row, allocation, GC or driver call can overshoot that soft budget. Buffers are reused while cached, disposed on eviction/world change, and reconstructed deterministically after eviction.
- Sampling: binary route lookup, bilinear cached base height, spatially indexed saved ramps, then the same triangle interpolation used by contact and visible geometry. No whole-feature scans or procedural noise in the gameplay sampler. MeshBasicMaterial needs no normal-generation pass. Physics can derive slopes from contact heights; no separate wheel system is claimed.
- Prepared chunks suppress the far surface through a tiny coverage mask. Neighboring near chunks use the same analytic edge samples. Transitions between 2-unit and quarter-unit edges can retain a small undulation seam; full LOD morphing is not implemented. A conservative coastal triangle is omitted unless all its vertices are dirt, so near shore coverage may retreat by up to a base cell (2 world units).
- Analytic ramp records and dimensions remain unchanged. The adaptive triangulation introduces a measured contact approximation below 0.20 world units on the checked default ramp grids; the emitted triangle and collision heights agree within 0.000002 world units in regression fixtures. This is a sampled tolerance, not a universal guarantee for arbitrary creator height settings.
- Velocity/reversal corridor prefetch prepares upcoming chunks. If detailed dirt is not ready near contact, movement/descent waits for readiness instead of colliding with invisible detail. This may be noticeable on slow devices or extreme travel; readiness events identify it. Collision data itself is resident from profile load.

## Callable operations

Use the existing `dirt-v1` envelope and actor grants. Compiled payloads have their own `compiled-terrain-v1` schema. `schemas/compiled-terrain-v1.schema.json` and `src/dirt/api.d.ts` describe actual envelopes/results. Unknown compilation inputs fail rather than silently changing budgets.

| Operation | Input | Grant | Result / boundary |
|---|---|---|---|
| `dirt.inspectCompilation`, `dirt.listCompiledProfiles` | `{}` | inspect | Source key and missing/valid/stale profiles in this core; file metadata where loaded |
| `dirt.inspectCompiledAsset` | `{worldId}` | inspect | Source/profile provenance, fixed ramps, gaps, typed-array byte counts and known paths |
| `dirt.planCompilation`, `dirt.previewCompilation`, `dirt.validateCompilation` | `{worldId, policy?}` or `{plan}` | plan | Read-only bounded plan, estimated bytes, invalidation and viewer compatibility |
| `dirt.compileProfile` | `{plan}` plus `expectedRevision`, `operationId` | commit | Explicit synchronous preparation; atomic cache publication after success; source unchanged |
| `dirt.inspectPhysicalAt`, `dirt.inspectVisualAt` | `{worldId, coordinateSpace:"experience", position:{x,z}}` | inspect | Contact, analytic height difference, near-model height, color, nearest ramp, source/profile keys |
| `dirt.diffCompiledProfiles` | `{}` | inspect | Compare at least two loaded/prepared profiles and their actual source/feature records |
| `dirt.validateCompiledTerrain` | `{worldId}` | plan | Saved ramp-center contact/mask checks and machine-readable errors; not a full WebGL validation |
| `dirt.inspectRuntimePerformance` | `{}` | inspect | Browser only: existing snapshot fields plus renderer/cache/asset observations |
| `dirt.explainStutter` | `{atMs}` | inspect | Browser only: bounded retained event window; no guessed GPU/GC cause |

The CLI loads shipped profiles and any derived generations in `--compiled-dir` (default `generated/dirt-compiled`). Successful compilation writes a content-addressed generation with a manifest and atomically updates its catalog. It never overwrites Tiled files. Browser compilation is explicitly in memory; no promise of repository writes or automatic download. Compile does not change the source revision or create a source undo entry. Failure retains the old derived cache. Preparation is synchronous and cannot be interrupted mid-call; this is documented safe rollback rather than an advertised cancel button. Large explicit source regeneration remains a possible editor pause, outside the ordinary flight loop.

Color-only preparation reuses physical height buffers and source coherence. Appearance contributes separately to the asset key. Compiling one profile leaves other profile objects unchanged; source edits mark their old keys stale. State mutations and undo remain the existing revisioned core operations. In the browser, source API edits require explicit compile and activation; the editor performs its commit/compile/activation together and rolls back core state on preparation failure.

Custom replacement syntax: `{mode:"replace", profile:{id:"custom:wide",version:1,gapFactor:7}}`; factor must be 1..100. It replaces, never multiplies, inherited expansion. Arbitrary 2D warp is unsupported. A profile whose journey length differs from the exterior world can be compiled, persisted and inspected, but **viewer activation returns `UNSUPPORTED_EXPERIENCE_CHART`** until a separate journey adapter exists. It is never silently clamped or wrapped into an unrelated cell. This is a remaining request limitation.

## Runnable examples

```sh
npm run dirt:compile
npm run dirt-api -- --request API/Dirt/examples/inspect-compilation.json
npm run dirt-api -- --request API/Dirt/examples/plan-compilation.json
npm run dirt-api -- --request API/Dirt/examples/validate-compiled.json
node scripts/benchmark-dirt.mjs
```

Local programmer/agent compilation (same core and grants):

```js
import {ProgrammerDirtApi, createDirtState} from './src/dirt/api.js';
const api = new ProgrammerDirtApi(createDirtState());
const request = (operation, input) => ({schemaVersion:'dirt-v1', actorId:'creator', operation, input});
const plan = api.execute(request('dirt.planCompilation', {worldId:'massive'})).result;
const result = api.execute({...request('dirt.compileProfile', {plan}),
  expectedRevision:api.state.revision, operationId:'compile-massive-1'});
```

To persist via CLI, save that reviewed result plan into a `dirt.compileProfile` request with the exact state revision and run it against the same `--state` file. `tests/dirt-compiled.test.js` exercises this full file-backed CLI round trip, not a mock adapter. The CLI's default source is the saved viewer production; a freshly constructed `createDirtState()` uses its documented API defaults. Plans cannot be mixed across those sources.

Browser activation after a successful compile:

```js
const api = window.tiledWorldDirtApi;
const base = {schemaVersion:'dirt-v1',actorId:'creator',projectId:'demo-world'};
const planned = api.execute({...base,operation:'dirt.planCompilation',input:{worldId:'current'}});
const compiled = api.execute({...base,operation:'dirt.compileProfile',expectedRevision:planned.revision,
  operationId:'viewer-compile-1',input:{plan:planned.result}});
if (compiled.status === 'ok') api.activateCompiled({...base,expectedRevision:planned.revision,input:{worldId:'current'}});
```

The local creator actor is a standalone convenience, not remote authentication. Embedders must supply an authenticated actor/permission boundary. An imported Tiled map does not activate demo compiled dirt.
