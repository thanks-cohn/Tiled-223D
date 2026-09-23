# Ocean Studio tuning guide

Ocean Flight V1 is a presentation-only layer. Start at [`Semantic-Bindings/ocean-flight-v1-agent-contract.md`](../Semantic-Bindings/ocean-flight-v1-agent-contract.md). Do not tune flight speed, the canonical water map, or pilot coordinates to improve the picture.

## Fast lookup

- **Top shadow darkness:** preview `{"shadow":{"maxAlpha":0.30}}`; default lives at `DEFAULT_OCEAN_PRESET.shadow.maxAlpha` in `src/ocean-visual-presets.js`.
- **Middle composition density:** preview `{"moods":{"middle":{"weights":{"middle-swell":0.8,"broad-band":0.45}}}}`.
- **Wave morphology:** `families.<id>.length`, `curvature`, `groupSpacing`, and `fragments` describe one stable, nested geographic group.
- **Crest following the camera:** inspect `window.tiledSpatial.ocean.getSelectedCrest("near-crest")`. Its `anchor` must remain fixed while hovering/ascent; a changed ID indicates lattice recycling after real horizontal movement or a preset/world change.
- **Budget:** inspect `getRenderBudget()`. V1 is capped at four family draw calls plus one shadow draw call and one small shadow alpha texture.

## Safe A/B sequence

1. Select **Deep Debug**, click **Authorize agent tools**, and stop horizontal movement.
2. Record `const before = tiledSpatial.ocean.getPreset()` and request a synchronized image capture.
3. Run `const p = tiledSpatialDevelopment.oceanPreview({shadow:{maxAlpha:.30}}, "top-shadow-A")`.
4. Capture the same replay frame and inspect the footprint, family weights, world anchor, projected coordinates, draw calls, and vertices.
5. Compare with `oceanCompare(before, tiledSpatial.ocean.getPreset())`.
6. Undo with `oceanRollback(p.id)`. Exporting a preset does not persist it into source; a creator must deliberately commit the validated JSON/default change.

## Manual visual route

Current at low coast → hover → Shift cruise → climb through normalized 0.34 and 0.68 → top → toggle Forward/Overview/Auto → descend → repeat on Bigger and Massive. Look specifically for a hard local diamond, short hook-like hairs, wave movement during stationary ascent, land/far-side bleed, shadow popping, and loss of the sky/ocean horizon. Record actual FPS/draw calls; do not infer 4 GB performance from tests.
