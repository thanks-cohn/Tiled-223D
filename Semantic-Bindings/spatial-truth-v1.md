# Spatial Truth and Deep Diagnostics v1

## Coordinate contract

The authoritative simulation is right-handed: map column is global **+X (east)**, numeric elevation is **+Y (up)** and map row is **+Z (south)**, in world units. Wrapping is semantic map sampling, not a physical globe. Rendering subtracts the pilot X/Z floating origin. The horizon shader then applies a visual-only curved surface; `curveSurfacePoint()` is its CPU equivalent, while the back half of the globe and shader-deformed mesh bounds are not uniquely invertible.

Three.js matrices are column-major and act on column vectors: `clip = projection * view * model * point`. After dividing by a positive clip W, normalized viewport coordinates are `u=(ndcX+1)/2`, `v=(1-ndcY)/2`: top-left `(0,0)`, center `(.5,.5)`. NDC X/Y alone do not prove visibility. The query reports behind-camera and near/far clipping separately; depth occlusion is always `unknown` unless a future explicit depth measurement supplies it. CSS pixels include the canvas boundary; drawing-buffer pixels multiply local canvas coordinates by renderer pixel ratio.

`window.tiledSpatial` exposes read-only `getObjectSpatialState`, `getViewportPosition`, `getCameraState`, `getSpatialSnapshot`, `getSpatialRelationship`, `getCoordinateTransform`, `explainPositionChange`, `exportJSONL`, and `incidentReport`. Unsupported conversions return typed errors rather than guesses. Pilot and displayed ship projections are independent.

## Modes and limits

Performance is the default: events are discarded, snapshots are disabled, and the overlay polling path returns immediately. Debug enables a 4 Hz ship summary and bounded events. Deep Debug permits explicit snapshots and export. History defaults to 256 records / 256 KiB and evicts oldest records. Export is local JSONL and never uploads data. Occlusion, GPU shader output, and reverse projection to the far globe are declared blind spots.

## Massive continuity finding

The old path set `cameraInitialized=false` on every view request, snapping the camera directly to a new target. Separately, `massiveShipPresentation()` changed ship parent at an overview threshold and assigned a fixed camera-local pose. Those are projection and render-parent changes, not pilot movement. V1 no longer forces a camera snap on view buttons, has no altitude activation threshold, and uses a time-based composition state that retargets from its current interpolated value. Current/Bigger rendering and Forward target formulas are unchanged. The same semantic ship remains the collision identity.

An actual trace can answer the incident question without invented evidence:

```js
const before = tiledSpatial.getObjectSpatialState("ship-visible");
// reproduce and note frame IDs from exported camera-transition-start events
const explanation = tiledSpatial.explainPositionChange("ship-visible", frameA, frameB);
```

Compare `authoritative.position`, `projection.physical.viewport`, and `projection.visible.viewport`. A render-parent event with unchanged authoritative coordinates proves presentation relocation; absent a recorded cause, the answer is `unknown`.

## Ocean crests

Each crest has a stable wrapped ID and deterministic world-space controls. Six segments preserve curvature through the same ocean shader instead of drawing an endpoint chord. Orientation is low-frequency geography-derived and does not accept camera heading. Altitude continuously expands grid/LOD; speed changes visibility/contrast but never moves the source crest. The fixed 72-crest buffer is one draw call and 432 segments. Far-side depth rejection remains the ocean depth buffer's job and is an observational blind spot in CPU diagnostics.
