# Ocean Studio tuning guide — beauty pass V10

Ocean presentation is visual-only. Never change flight speed, canonical water, camera behavior, or pilot coordinates to tune it. The only defaults live in `src/ocean-visual-presets.js`; schema `1.1.0` validates the same controls used by Ocean Studio and the authorized API.

## Ocean Beauty Pass — where to change what

After a real click on **Authorize agent tools**, every example is reversible with `oceanRollback(result.id)`:

```js
// TOP less white (zero is the committed default)
const p = tiledSpatialDevelopment.oceanPreview({moods:{top:{whiteStrength:0}}}, "TOP no white")
// HIGH broader blue-on-blue
const p = tiledSpatialDevelopment.oceanPreview({families:{"broad-band":{width:13,color:"#2777a2",alpha:.18}}}, "HIGH broad blue")
// MIDDLE less cluttered
const p = tiledSpatialDevelopment.oceanPreview({moods:{middle:{weights:{"near-crest":.42,"middle-swell":.78,"broad-band":.4}}}}, "MIDDLE quiet")
// LOW more coherent (fewer deterministic gaps, shallower curvature)
const p = tiledSpatialDevelopment.oceanPreview({families:{"near-crest":{gapRhythm:.05,curvature:.04,length:48}}}, "LOW coherent")
// Softer/darker height cue
const p = tiledSpatialDevelopment.oceanPreview({shadow:{softness:.92,maxAlpha:.32,color:"#061f38"}}, "soft shadow")
```

`mode` is `crest` or `tonal`. `width` is ribbon half-width in world units; `softness`, `taper`, `gapRhythm`, and `glint` are normalized. `whiteStrength` gates crest brightness by mood, while `tonalStrength` gates broad water-body structure. `grid`, `length`, `density`, and mood weights control near/mid/far spacing and visibility. Quality and hard allocation limits remain under `quality` and `budget`.

## Inspection and safe A/B

1. Select Deep Debug, authorize tools, and stop horizontal travel.
2. Save `before = tiledSpatial.ocean.getPreset()` and request a synchronized capture.
3. Apply one bounded preview, capture the same replay frame, and inspect `getMoodState()`, `getSelectedCrest(id)`, and `getRenderBudget()`.
4. The selected group reports mode, geographic anchor, sampled points, world bounds, active style, projected center, and source controls. Its ID/anchor must not change during stationary ascent.
5. Compare with `oceanCompare(before, tiledSpatial.ocean.getPreset())`; undo with `oceanRollback(id)`.

## Visual and performance gate

Capture identical physical states at LOW cruise, MIDDLE cruise and boost, HIGH, TOP overview, and hover-ascent. Check shoreline, wrap, multiple headings, and the curved far hemisphere. V10 uses at most four reusable ribbon draws plus one shadow draw; inactive families do not draw. The typed-array capacity is reported separately from visible vertices. Node tests establish bounds, not beauty, WebGL correctness, GPU time, or 4 GB Windows suitability. Those remain owner-visible checks until measured.

## Diagnose a circle before tuning

Use [`Semantic-Bindings/shadow-deep-debug-v1.md`](../Semantic-Bindings/shadow-deep-debug-v1.md). Capture the completed frame, inspect candidate bounds and effective radius/alpha, then temporarily isolate only the shadow through the authorized reversible API. A blue disc may be the one base ocean/globe, pooled tonal ribbons, the shadow, or transparent overlap. Do not tune radius from screenshot color alone. Browser/GPU attribution and 4 GB Windows profiling remain manual gates.
