# Dirt API v1 — tested commands

All examples below run from the repository root. The CLI consumes one JSON request and prints one typed JSON response. Read-only calls do not create the state file. Successful `dirt.commitPlan` and `dirt.undo` atomically replace the compact state file.

## Observed browser stutter and terrain build timings (runtime only)

This is **not** a CLI operation: the CLI cannot inspect a separate live browser. In the ÆXIS viewer's DevTools console:

```js
window.tiledWorldDirtApi.startPerformanceCapture();
// Play through several freezes, then:
copy(JSON.stringify(window.tiledWorldDirtApi.stopPerformanceCapture(), null, 2));
```

The equivalent read-only browser-only operation is:

```js
window.tiledWorldDirtApi.execute({
  schemaVersion: "dirt-v1",
  operation: "dirt.inspectRuntimePerformance",
  actorId: "debugger",
  projectId: "demo-world",
  landmassId: "dirt-landmass-01",
  input: {}
});
```

The snapshot reports actual frame gaps, measured CPU loop/render-submission time, and the sampled/triangulated vertices, duration and location of each near/far dirt mesh build. It does **not** claim GPU timings, VRAM/OS RAM or GC cause. Logs are bounded and contain no automatic upload. Read [PERFORMANCE.md](PERFORMANCE.md) for steps, field descriptions, diagnosis and limitations.

## Discovery and inspection

```sh
npm run dirt-api -- --request API/Dirt/examples/capabilities.json
npm run dirt-api -- --request API/Dirt/examples/inspect-landmass.json
npm run dirt-api -- --request API/Dirt/examples/list-features.json
npm run dirt-api -- --request API/Dirt/examples/diff-scales.json
```

The first response advertises only callable operations and explicitly lists `arbitrary-2d-warp`, GPU telemetry, MCP, desktop IPC, and uploads as unsupported. Feature pages are capped at 100 and terrain samples at 256.

## Browser and local JavaScript

```js
import { createDirtState, ProgrammerDirtApi, AgentDirtApi } from "./src/dirt/api.js";

const state = createDirtState({ projectId: "demo-world" });
const programmer = new ProgrammerDirtApi(state);
const agent = new AgentDirtApi(state);
const response = agent.execute({
  schemaVersion: "dirt-v1",
  operation: "dirt.inspectLandmass",
  actorId: "agent",
  projectId: "demo-world",
  landmassId: "dirt-landmass-01",
  input: {}
});
```

In the running standalone viewer, the equivalent lifecycle-bound call is:

```js
window.tiledWorldDirtApi.execute({
  schemaVersion: "dirt-v1",
  operation: "dirt.explainAt",
  actorId: "debugger",
  projectId: "demo-world",
  landmassId: "dirt-landmass-01",
  input: { worldId: "current", coordinateSpace: "canonical", position: { x: 250, z: 250 } }
});
```

The browser global is in-memory, local, and has no file or network transport.

## Plan, validate, preview, commit, undo

Planning is read-only:

```sh
npm run dirt-api -- --request API/Dirt/examples/plan-ocean-replacement.json
```

The returned `result` is the reviewed plan. Put that object in `input.plan`, add a unique `operationId` and exact `expectedRevision`, then commit:

```sh
npm run dirt-api -- --request /tmp/dirt-commit.json --state generated/dirt-api-state.json
```

Example commit envelope:

```json
{
  "schemaVersion":"dirt-v1",
  "operation":"dirt.commitPlan",
  "operationId":"choose-ocean-journey-1",
  "actorId":"creator",
  "projectId":"demo-world",
  "landmassId":"dirt-landmass-01",
  "expectedRevision":0,
  "input":{"plan":{"kind":"expansion-policy","baseRevision":0,"policy":{"mode":"replace","profileId":"expansive-ocean"},"committable":true}}
}
```

Use the returned undo token with the new revision:

```json
{
  "schemaVersion":"dirt-v1",
  "operation":"dirt.undo",
  "operationId":"undo-ocean-journey-1",
  "actorId":"creator",
  "projectId":"demo-world",
  "landmassId":"dirt-landmass-01",
  "expectedRevision":1,
  "input":{"undoToken":"dirt-undo-choose-ocean-journey-1"}
}
```

A stale revision, unauthorized actor, malformed probability, or hand-built invalid regeneration plan returns a machine-readable error and does not write state. Commit revalidates rules; planning is never authority.

## More bounded calls

Change `operation` and `input` in a request file:

- `dirt.sampleTerrain`: `{"worldId":"current","coordinateSpace":"canonical","points":[{"x":250,"z":250}]}`
- `dirt.inspectFeature`: `{"worldId":"massive","featureId":"ramp-large-001"}` (use a real ID from `listFeatures`).
- `dirt.mapCoordinates`: `{"worldId":"massive","fromSpace":"canonical","value":125}`.
- `dirt.inspectIntervals`: `{"worldId":"current","policy":{"mode":"replace","profileId":"expansive-ocean"},"offset":0,"limit":25}`.
- `dirt.diagnosticBundle`: `{"worldId":"current","limit":10}`. This never uploads and excludes private paths.

## Commands actually exercised for this implementation

```sh
npm install
npm test
npm run build
npm run dirt-api -- --request API/Dirt/examples/capabilities.json
npm run dirt-api -- --request API/Dirt/examples/inspect-landmass.json
npm run dirt-api -- --request API/Dirt/examples/list-features.json
npm run dirt-api -- --request API/Dirt/examples/diff-scales.json
npm run dirt-api -- --request API/Dirt/examples/plan-ocean-replacement.json
```
