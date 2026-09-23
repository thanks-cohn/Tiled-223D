# Codex implementation brief: ÆRIS Ocean Beauty Pass

**Status:** Implementation request, not a completed feature or visual acceptance.  
**Repository:** `thanks-cohn/Tiled-223D`  
**Continue existing PR #12 head branch:** `codex/implement-cinematic-ocean-feature-enhancements` (target: `feature/cinematic-speed-perception-v9`). Work on the existing PR; do not create another branch or merge into V9/`main` without the creator's explicit approval.

## Creator's intent

The clouds and the feeling of speed are already delightful; the ocean currently breaks the fantasy. It reads as crude, isolated bright curls/“hairs” or obvious line effects rather than a vast, beautiful world worth flying over. **Fewer, better-composed marks** should evoke water, speed, altitude and awe. Flying over empty ocean should be pleasurable in its own right, even when cruising slowly. Preserve the low-compute ambition for a 4 GB Windows machine: artistic intelligence, not brute line density, extra ocean meshes or heavy fluid simulation.

The upper two altitude moods may have **no white wave lines at all**. Broad, subtly shifting dark/light blue structures, shallow coherent arcs and tonal surface variation should communicate a vast sea without looking like a scratched diagram. Do not merely repaint the existing hair-like lines blue and declare success: change their morphology, grouping, spatial composition and rendering where needed.

## Read these actual existing contracts and source first

1. `Semantic-Bindings/ocean-flight-v1-agent-contract.md`, `Semantic-Bindings/ocean-flight-v1-handoff.json`, `Semantic-Bindings/ocean-flight-v1.schema.json`, `docs/OCEAN_STUDIO_TUNING_GUIDE.md`, `docs/CODEX_CINEMATIC_OCEAN_V1_IMPLEMENTATION.md`, `docs/PROPOSAL_CINEMATIC_OCEAN_ALTITUDE_SHADOW.md`.
2. `src/ocean-visual-presets.js`, `src/ocean-mood-model.js`, `src/ocean-wave-field.js`, `src/ocean-wave-renderer.js`, `src/ocean-shadow.js`, `src/ocean-shadow-renderer.js`, `src/ocean-visual-controller.js`, `src/horizon.js`, `src/main.js`, `src/spatial-development.js`, existing tests, Bugs and the present PR diff.
3. Inspect the current real renderer, avoid stale descriptions and verify PR #12's state/target before coding. The four-family system, Ocean Studio and in-browser inspection are *architecture*, not proof of beauty or of successful runtime capture. Keep current flight physics, camera modes, ship GLB behavior, cloud parallax, successful peripheral speed cues and mathematical spatial truth unchanged.

## 1. Diagnose the actual visual failure

Where possible, run the app in a real browser and capture **matching physical positions and viewport/camera states** at low cruise, middle/fast, high, planetary overview and hover-while-ascending. Identify why existing fragments look hairy: very short isolated crests, excessive curvature/fragmentation, uniform brightness/line width, screen-space spacing, sparse disconnected geometry, unconvincing perspective, or multiple factors. Observe any hard diamond boundary independently of the proposed soft height-shadow footprint. Differentiate confirmed screenshots from source-level hypotheses. If no live browser available, don't claim visual verification.

Inspect nearby wave groups, not just one selected curve. A surface may satisfy mathematically continuous splines and still visually look like scattered glyphs. Test the projected shape from the ship's real camera pitch and FOV.

## 2. Art direction: four *distinct* visual compositions

| Altitude mood | Composition | Explicit line/color policy |
| --- | --- | --- |
| **LOW — intimate cruise** | One main family of recognizable **shallow, connected, nested or loosely broken crest bands**. A tiny amount of far structure is optional. Close details naturally pass by quickly with forward travel. Beautiful even at rest. | Restrained foam/soft highlights permitted. Never carpets of white hair; color hierarchy should resemble actual shallow crests. |
| **MIDDLE — exhilarating flight** | Three coordinated distance scales: near fast-looking, medium paced, broad slow-looking. Rhythm and recognizable water, **not three similarly bright random curl layers**. Preserve satisfying acceleration. | Most nuanced contrast; whites only where they help convey foam/glints, with softer blue families behind. |
| **HIGH — expansive beauty** | Two deliberately different families: generous coherent broad water bands plus quieter medium counter-rhythm. This must have its own gorgeous composition rather than being a dim top-level copy. | Mainly water-tonal blues and sparse low-contrast crest accents; **no dependency on white lines**. |
| **TOP — planetary grace** | A few long-lived broad, spatially coherent, distant structures and a very sparse secondary hint of change. Keep the huge planet clean and legible. | Prefer broad **subtle tonal fields and curved blue-on-blue forms**; white strokes can be entirely off by default. No tiny near-water crests at continent-like scale. |

The four moods overlap smoothly; do not make hard switches or regrow geography on altitude thresholds. Keep wave identity and sampled world anchor stable across climb, heading changes, replays and crossfade. The near/middle/far visual-speed difference comes primarily from real motion and perspective, not camera-following slides or a timer that regenerates strokes.

## 3. Give the waves coherent morphology, not just more vertices

Replace the appearance of independent tight hooks with plausible **grouped, shallow crest contours** that share an underlying low-frequency geographic direction/phase field. A small band can have a dominant shallow crest and one/two related fainter/broader companions, staggered gaps and natural tapered ends. Use gently varying spacing and scale with bounded deterministic seeds. Do not force all crests to follow flight heading, straighten into vertical strips, use identical tiled glyphs, or add random jitter that destroys the group rhythm. Test multiple view angles, local cells, shore edges, wrapping and the curved planetary projection.

Distinguish actual crest/foam from tonal swell/ambient ocean-body structure. The latter is not a one-pixel `LineSegments` stroke with an altered color: if a lightweight pooled ribbon or **small shader treatment on the already-existing ocean surface** is required to produce tasteful broad soft blue bands, implement and measure it. Do not add a second sea, huge textures, high-overdraw fullscreen blur, per-cell objects or simulation. Keep depth/shore/far-side clipping correct and avoid hard geometric window/diamond boundaries. Let existing separate cloud and peripheral effects carry some of the speed sensation so water itself can remain elegant.

## 4. Height shadow: support beauty, never conceal a rendering defect

Maintain the chosen stylized altitude cue: nearly absent close to water; a **light, diffuse footprint** on ascent; noticeably broader and deeper but soft at HIGH; a darker, tasteful, world-anchored reference at TOP. It must not become a rigid disk or a square/diamond masking a local-detail seam. Determine the true root of any patch boundary and resolve it independently. Footprint stays on the sea, respects shore/far-hemisphere/depth, tracks physical ship X/Z instead of the camera, and neither writes to elevation JSON nor creates physics. Provide a cheap low-end fallback.

## 5. Build the *future-agent tuning surface* as part of implementation

The creator must be able to ask a later AI turn “make the third level more beautiful / less white / slower-looking” and have it immediately know **which real parameter and renderer operation to adjust**. Extend the *existing* `DEFAULT_OCEAN_PRESET`, validator/schema, mood model, controller, Ocean Studio and authorized `window.tiledSpatialDevelopment` APIs as needed; avoid a second contradictory aesthetic configuration.

Expose discoverable, validated, reversible controls for: per-mood family mix and visibility; crest-vs-tonal mode and white/glint strength; tonal band width, shape, softness, color/contrast and spatial scale; crest shallow curvature/group continuity/taper/gap rhythm; distance falloff; near/mid/far spacing/density; shadow shade/softness/radius by altitude; performance/quality level. Name units and ranges, document dependencies and reject unsupported changes. Any added color/tonal rendering technique must be controllable through these APIs with meaningful before/after state.

An agent should be able to inspect a selected family/group, geographic anchor, actual sampled geometry, projected center/bounds, active mood weights, stroke/tonal style, shadow, draw calls, visible-geometry budget and why a given cue appears at a certain frame. Respect the existing user-authorized development session and truthful capture limitations; a source-code inspection or numeric test alone is not a screenshot.

## 6. Performance and verification gate

Stay within a **measured** low-end budget relative to the current PR #12 renderer. Prefer reused geometry/materials, stable small control fields, shader uniforms, sparse families and amortized updates; inactive families should not consume draw calls. Never construct a massive grid/texture proportional to world dimensions or regenerate all crests per frame merely to make them look busy. If a new tonal method costs more than the existing line approach, report the exact draw-call/vertex/CPU/GPU/overdraw tradeoff and provide a low-end fallback that retains the mood identities.

Add tests for default top-level white intensity being zero/negligible, distinct mood-family mixes, deterministic geographic anchoring, stable ascent with zero horizontal velocity, projection/shore mask safety, reversible artistic previews, renderer buffer capacity across authorized preset changes, shadow continuity, low-memory bounds and no physics/camera mutations. Run `npm test`, `npm run build` and actual browser screenshots/replay checks if tools permit. Compare before/after at the *same camera and ship state* for LOW, MIDDLE, HIGH and TOP. Test real cruising and boost separately from hovering. Report honestly whether the owner still needs to assess aesthetics and 4 GB Windows FPS.

## 7. Mandatory durable handoff

Update in the **same implementation change**: `Semantic-Bindings/ocean-flight-v1-agent-contract.md`, `Semantic-Bindings/ocean-flight-v1.schema.json`, `Semantic-Bindings/ocean-flight-v1-handoff.json`, `docs/OCEAN_STUDIO_TUNING_GUIDE.md`, affected Bugs/README and relevant tests. Add a short **“Ocean Beauty Pass — where to change what”** map: example real API calls to make TOP less white, HIGH more broad blue-on-blue, MIDDLE less cluttered, LOW more coherent, and shadow softer/darker. Document which visual changes are implemented and which remain speculative. Link this brief from the agent handoff. Preserve a truthful commit/test/capture/4 GB status; do not mark visual success from a test count.

**Deliverable:** working ocean art-direction refinements and a future-agent-friendly way to tune them, not only this document or an extra family-count flag. Keep edits on the current PR #12 head branch; leave `main` and the V9 base branch unchanged until the owner approves integration.
