# Shadow & circular-artifact Deep Debug v1

## Five-minute start

This API answers **“which rendered objects could make that circle?”**, not “which GPU object owns this pixel.” Select **Deep Debug**, click **Authorize agent tools**, reproduce, then run:

```js
const dev = tiledSpatialDevelopment
const request = dev.shadowCapture({reason: "ALT 374 current-world climb"})
// wait for one completed rendered frame
tiledSpatial.shadow.inspect()
tiledSpatial.shadow.getContributors({viewportPoint:{u:.5,v:.65}})
dev.shadowExplain({frameId: tiledSpatial.shadow.inspect().frameId, region:{minU:.1,maxU:.9,minV:.2,maxV:1}})
const hidden = dev.shadowIsolatePreview({entityId:"ship-ocean-shadow", visible:false})
// visually compare, then always restore
dev.shadowRestorePreview(hidden.id)
```

For the reported expansive→Current case, capture immediately before and after completed frames and call `shadowTransitionReport({beforeFrameId,afterFrameId})`. Compare `declaredScaleMapping.relativeBefore/After`; absolute coordinates and radii may legitimately change. `createShadowArtifactReproduction()` supplies Current ascent through displayed ALT ~374, Current camera toggles, Current→Bigger→Massive→Bigger→Current, horizontal flight and multiple headings. Put its checkpoint near shore to exercise masking. Export text through the existing `exportReproBundle()`/JSONL route. Do not commit screenshots.

## Ownership and derivation

Ordered chain: `pilot (authoritative X/Y/Z)` → `altitudeProfile + ocean-mood-model` → `oceanShadowState` (vertical intersection with canonical flat Y=0 ocean, nine explicit water samples) → `ocean-shadow-renderer` (one reusable unit circle, elongation, alpha texture/material) → floating-origin subtraction → shared horizon/globe deformation → camera view/projection → clip/NDC/viewport/CSS and drawing-buffer pixels.

Other candidates follow separate paths: canonical water → `horizon.js` single ocean mesh; mood/preset → `ocean-wave-field` → four pooled ribbon families; atmosphere/cloud/sky → background. Every capture lists these separately with stable semantic IDs. Candidate overlap and draw order are broad-phase evidence. `pixelAttribution` remains `unverified`, depth occlusion is `unknown`, and CPU horizon samples are explicitly identified; no GPU readback is claimed.

## APIs, modes and permissions

Read-only `tiledSpatial.getShadowDiagnostics()` / `shadow.inspect()` returns `DIAGNOSTICS_DISABLED` in Performance, compact status in Debug, and the latest bounded record in Deep Debug. `shadow.getContributors({frameId?,viewportPoint?,region?})` filters captured candidates.

Authorized calls are `shadowCapture`, `shadowHistory({limit})`, `shadowTransitionReport`, `shadowExplain`, `shadowIsolatePreview`, and `shadowRestorePreview`. Capture uses the next completed render frame. Isolation accepts only `ship-ocean-shadow`, changes visibility only, is reversible, and is restored on authorization revocation. It cannot change physics, maps, terrain, assets, presets or other worlds. Existing capture/inspect/adjust scopes and 15-minute trusted-click grant apply.

Performance creates no trace records, projection boundary arrays, scene scans or serialization. Deep capture is explicit, retains at most 24 frames / 256 KiB, samples 16 true ellipse boundary points, and inspects known objects rather than traversing the full scene. `stats().captures` remains zero in Performance. Debug does not produce full records.

## Trace contract

`schemaVersion` is `1.0.0`. Each successful trace includes exact `runId`, numeric `frameId`, timestamp, world/scale/preset identity, named spaces/units, physical ship and scale-relative position, physical vs normalized altitude, flat-ocean policy, all nine shore samples, pre/post-clamp radius, mood sources, alpha/gates, render mesh/material/resource identities and versions, world matrix, effective radii, floating origin, camera matrices/lens, viewport/DPR, center and 16 boundary projections, candidate contributors, provenance and observational limits. See the matching JSON Schema.

Detectors report `CONFIRMED` only for directly observed numeric mismatch, duplicate known shadow meshes or wrong parenting. Projection fill, overlap and unavailable compositing are `WARNING`. Transition causes distinguish physical motion, scale mapping, camera/FOV, mood, resources and viewport. Missing or disabled evidence returns typed error codes rather than guessed truth.

## Decide shadow vs globe vs tonal vs unknown

1. Capture a completed frame and inspect contributor viewport bounds.
2. Compare `shadow.postClampRadius × elongation` with `presentation.mesh.effectiveRadius*`, material alpha, resource IDs, and projected boundary.
3. Hide only the shadow using the authorized preview. If the formation remains, the shadow is not sufficient; inspect `base-ocean-globe` and `ocean-ribbon-family:*` candidates.
4. Restore immediately. Capture before/after scale or camera transitions and review declared causes.
5. If transparent overlap or depth is decisive, report **unknown** pending a real browser image/depth investigation. Never shrink the preset merely from a screenshot.

Current automated tests validate contracts and induced anomalies. Browser review, owner aesthetic acceptance, GPU pixel attribution, and the target 4 GB Windows performance profile remain unverified.
