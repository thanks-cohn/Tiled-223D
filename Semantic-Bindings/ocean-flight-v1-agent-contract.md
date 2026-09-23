# Ocean Flight V1.1 — START HERE

V10 implements a low-cost beauty pass on the V9 ocean architecture. It replaces isolated one-pixel curls with stable, tapered geographic ribbons: restrained connected crests at LOW; coordinated crest, medium swell, and broad band scales at MIDDLE; broad blue-on-blue bands plus counter-rhythm at HIGH; and sparse planetary tonal contours at TOP. This is implemented art direction, not a claim of human aesthetic acceptance or a 4 GB Windows performance result.

## Truth and ownership

Canonical Tiled X/Z, elevation Y, collision, flight, camera, clouds, ship, and world wrap are unchanged. Ocean visuals subtract the floating origin and use the same horizon/globe deformation as the sole ocean and terrain. No visual value writes physics or world data. `src/ocean-visual-presets.js` is the single aesthetic configuration; its runtime validator, JSON schema, Studio, tests, and this contract move together.

Pipeline: `ocean-mood-model.js` continuously blends LOW/MIDDLE/HIGH/TOP → `ocean-wave-field.js` samples deterministic low-frequency groups → `ocean-wave-renderer.js` fills four fixed reusable ribbon buffers. The legacy `ocean-shadow.js` model and reusable mesh remain accessible to Deep Debug, but the creator-facing height shadow is **disabled by default** in every world scale and altitude mood. The controller exposes bounded inspection and previews. Altitude and heading never seed or slide geography. Actual motion and perspective provide parallax.

## Controls

Each family exposes `mode` (`crest`/`tonal`), `grid`, `length`, `curvature`, `groupSpacing`, `fragments`, `density`, `alpha`, `color`, ribbon `width`, edge `softness`, end `taper`, deterministic `gapRhythm`, `glint`, and `depthFalloff`. Each mood exposes family weights plus `whiteStrength` and `tonalStrength`. TOP white strength is zero by default and smooth overlap remains negligible. Shadow radius, alpha, softness, elongation, shade, shore fade, horizon fade, and quality/budgets remain validated.

`softness` is an art-direction control recorded in geometry inspection and available for future material refinement; the current low-end renderer achieves soft appearance with low alpha, wide companion bands, taper, and nested spacing rather than blur or extra passes. It must not be described as a GPU edge-feather shader.

## APIs and diagnostics

Read-only `window.tiledSpatial.ocean` provides preset, mood/family state, footprint, budget, and selected group. Selection includes stable ID, seed/cell, mode, geographic anchor, sampled bands/tapers, source controls, world bounds, active style, projected center, frame, and cause. `getRenderBudget()` reports visible vertices/draws, cache, and fixed capacity.

Trusted-click authorized `window.tiledSpatialDevelopment` provides `oceanPreview`, rollback/reset, import/export, and comparison. Unknown controls and unsupported ranges are rejected. Preview/import never persist or upload and cannot mutate pilot, terrain, speed, camera, or collision. Use examples and the matching-state capture protocol in `docs/OCEAN_STUDIO_TUNING_GUIDE.md`.

## Performance and acceptance

There is one ocean. The beauty layer has four pooled meshes (only active families draw), one retained 64² legacy shadow alpha texture, bounded caches, and no per-world grid/texture. The height-shadow mesh is hidden in normal/default flight and adds no shadow draw call. Broad tonal structures are ribbons, not another sea or fullscreen pass. Shadow uses nine bounded ocean samples so shore proximity reduces its alpha rather than stamping across land. Required manual acceptance: matching LOW/MIDDLE/HIGH/TOP and hover frames, cruise versus boost, multiple headings, shore/wrap/far-side safety, no hard patch boundary, and measured 4 GB Windows FPS/draw/GPU behavior. Automated tests/build cannot establish those results.

## Shadow/circular-artifact diagnostics v1

Deep Debug now captures the shadow's authoritative source, nine water-mask samples, effective reusable mesh/material/resource state, shared-horizon boundary projection, camera/viewport chain, and separate base-ocean/ribbon/atmosphere candidates. Use `shadow-deep-debug-v1.md`; candidate overlap is not GPU pixel attribution. Performance remains capture-free. Deep Debug originally made no changes to ocean beauty defaults. In the subsequent creator-approved removal pass the height shadow's default was changed to `enabled:false`, its Ocean Studio checkbox was removed, and all other visual and physical defaults were preserved. The diagnostics module remains available for controlled inspection.

## No visible height shadow — V10 creator decision

Default user flight intentionally displays **no under-ship height-shadow disk** at LOW/MIDDLE/HIGH/TOP or during Current/Bigger/Massive switches. The original height-shadow model/mesh and `tiledSpatial.shadow` diagnostics are retained only for deliberate authorized experiments. The legacy `shadow.enabled` field remains schema-compatible for programmatic opt-in; the standard Ocean Studio UI cannot re-enable it. This change does not remove the actual ocean planet, any blue-on-blue wave family, island geometry, or a generated SEKAI structure's future supporting stone platform.
