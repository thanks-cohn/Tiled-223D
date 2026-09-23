# Ocean Flight V1 — START HERE

**Shipped on 2026-09-23:** modular four-family ocean presentation, continuous four-mood orchestration, a soft vertical-under-ship height footprint, Ocean Studio, bounded diagnostics and authorized reversible preset previews. **Not established:** owner aesthetic acceptance, a 4 GB Windows performance result, or the complete disappearance of the screenshot artifact in every camera. Implementation commit: `08acc1bd3ae94b73f50ed982e1bec3d6f454ac59`.

## North star and invariants

Low flight is intimate and readable at rest; actual travel supplies parallax and speed. Middle flight is richest. High flight is broad and spacious. Top flight is quiet and monumental. Crests are shallow nested/broken bands, never heading-aligned hairs or a ship-centered patch. The light-blue sky, darker ocean, horizon, four cloud layers, camera policies and peripheral speed effect remain independent.

Canonical navigation stays flat: Tiled X → world X, elevation → world Y, Tiled Y → world Z. The visual pipeline subtracts the floating origin, then the shared horizon shader bends sea, terrain, wave vertices and shadow vertices. Wave anchors and the shadow center are authoritative world coordinates; viewport positions are observations. Ocean tuning must never write pilot coordinates, terrain IDs, collision, speed, camera mode, GLB assets, or world geography.

## Ordered reading path and ownership

1. `src/ocean-visual-presets.js`: sole defaults, validation, hard ranges, family/mood IDs and deterministic seed.
2. `src/ocean-mood-model.js`: pure continuous normalized-altitude weights, family style and shadow curve. Normalized altitude is `atmosphericAltitude / 445` for every world scale.
3. `src/ocean-wave-field.js`: stable IDs, low-frequency orientation, shallow nested groups and sampled world-space controls.
4. `src/ocean-wave-renderer.js`: four fixed reusable `LineSegments` buffers/caches, ocean-center masking, shared curvature and counters. It does not create another sea.
5. `src/ocean-shadow.js` and `src/ocean-shadow-renderer.js`: pure vertical-below footprint state and one 64² radial-alpha mesh. Center-on-land and back-horizon cases are rejected.
6. `src/ocean-visual-controller.js`: lifecycle, inspection, preview/import/export/rollback and developer map. `src/main.js` supplies physical state once per frame.
7. `src/spatial-development.js`: existing trusted-click, 15-minute capability boundary; ocean mutation requires `adjust`, compare requires `experiment`, and export requires `inspect`.
8. `docs/OCEAN_STUDIO_TUNING_GUIDE.md`, `ocean-flight-v1.schema.json`, and `ocean-flight-v1-handoff.json` for exact edits and current verification truth.

## Four families and moods

- `near-crest`: short, bright, three-related-band groups. Dominant LOW; visible at rest.
- `middle-swell`: medium, softer three-band rhythm. Dominant in MIDDLE and restrained in HIGH.
- `broad-band`: long two-band features. Supports MIDDLE and dominates HIGH.
- `planetary-contour`: very long, sparse two-band contours. Dominates TOP with a small broad secondary.

`oceanMoodWeights()` overlaps neighboring LOW/MIDDLE/HIGH/TOP centers through a quintic easing and normalizes their sum. Ascent and descent are reversible. Family grid/anchors do not depend on altitude or heading. Actual ship displacement and projection create the perceived near-fast/far-slow motion; default true-water drift is zero.

## Shadow policy and dataflow

The policy is explicitly stylized `vertical-below`, not a physical sun ray. `pilot {x,y,z}` → ocean intersection `{x,0,z}` → canonical ocean test → smooth altitude radius/alpha → floating-origin center → shared ocean curvature shader → camera projection. Radius runs 2.5–82 world units and alpha .015–.34 by default. One radial alpha texture supplies feathering; water remains visible. The renderer is one footprint mesh, not a second ocean or shadow map. Current masking checks the center rather than multi-sampling the whole shoreline; treat that as a known refinement.

## Runtime APIs

Read-only, always safe:

```js
window.tiledSpatial.ocean.getPreset()
window.tiledSpatial.ocean.getMoodState()
window.tiledSpatial.ocean.getFamilyState("broad-band")
window.tiledSpatial.ocean.getFootprintState()
window.tiledSpatial.ocean.getRenderBudget()
window.tiledSpatial.ocean.getSelectedCrest("near-crest")
```

After a real click on **Authorize agent tools**:

```js
const before = tiledSpatial.ocean.getPreset()
const p = tiledSpatialDevelopment.oceanPreview(
  {moods:{middle:{weights:{"middle-swell":.8}}}}, "reduce middle clutter")
tiledSpatialDevelopment.oceanCompare(before, tiledSpatial.ocean.getPreset())
tiledSpatialDevelopment.oceanRollback(p.id)
tiledSpatialDevelopment.oceanResetToDefaults()
tiledSpatialDevelopment.oceanExportPreset()
tiledSpatialDevelopment.oceanImportPreset(JSON.parse(localPresetText))
```

All patches pass the single runtime validator. Unknown root properties and out-of-range values fail. Preview state is memory-only; export is explicit and no local file is silently persisted or uploaded. The small accessible Ocean Studio uses the same authorized methods.

## Diagnostics and change causes

Performance mode evaluates numeric styles and updates fixed buffers but collects no trace/history and performs no per-frame JSON serialization. Debug exposes aggregate mood, footprint and render-budget state through getters. Deep Debug can select one representative family crest: semantic ID, seed, cell, source controls, authoritative anchor/control points, rendered curve points, projection, frame and declared change reason. Shadow state reports physical ship, intersection, world center/radius, alpha, policy and clipping. Existing synchronized captures bind physical/camera/render/projection data to the completed frame; explicit image capture still respects its byte limit.

Interpret changes as follows: unchanged crest ID/anchor plus moved viewport = camera projection or physical travel; unchanged ship X/Z plus altitude/mood change = vertical ascent/family crossfade; changed cell/ID after horizontal movement = bounded lattice recycling; shadow X/Z follows only physical ship X/Z. Shader-deformed occlusion and GPU truth remain observationally limited unless measured.

## Performance boundary

There is one authoritative ocean. V1 adds four possible line draw calls and one soft-shadow draw call, one 64² alpha texture, fixed typed arrays, and bounded deterministic caches. Default layout is 20 + 12 + 9 + 6 = 47 crest groups; inactive families do not draw. The preset advertises hard ceilings of 76 crests, 1,824 vertices, five draw calls and 256 cache entries. Low-end reductions should reduce secondary mood weights first, never erase a mood or change physics. Node tests prove bounds/determinism, not frame rate.

## Reproduction and non-regression checklist

Use the deterministic physical replay/capture procedure in `docs/OCEAN_STUDIO_TUNING_GUIDE.md`. Capture low coast, mid boost, high rapid flight, top overview, hover-ascent, shoreline and descent on Current/Bigger/Massive. Verify: no hard diamond; water structure at rest; fixed anchors during hover; reversible blends; ocean-only shadow; horizon preserved; no far-side bleed; no pilot/camera/world changes from preview; buffers/caches remain bounded. Real browser visual inspection and a 4 GB Windows profile remain required.

**Maintenance invariant:** a change to family definitions, mood thresholds, shadow placement or preset shape must update defaults, runtime validation, `ocean-flight-v1.schema.json`, tests and `ocean-flight-v1-handoff.json` in the same commit. Never describe aesthetic success without a capture and human review.
