# Ocean Flight V1 — START HERE for future agents

**Status as of initial brief, 2026-09-23:** the target four-mood wave-family architecture, altitude-shadow and ocean-specific reversible tuning API are **not yet implemented**. This document is a handoff for Codex to complete and update. Do not infer success just because a proposal, prompt or existing two-pool renderer is present. **Branch:** `feature/cinematic-speed-perception-v9`; do not merge to `main` without the owner's explicit later request.

## The human intent in one paragraph

The creator wants a light browser flight experience that is intrinsically beautiful and exhilarating over open ocean on a 4 GB computer. The current speed feeling is appreciated, but the wave strokes appear as random curled hairs and a localized diamond-shaped rendering region is visible on ascent. Make water read as coherent, appealing crests rather than unrelated squiggles. A light under-ship ocean shadow gradually grows/darkens during ascent and becomes a dark, tasteful height reference at top altitude; remove the original sharp patch artifact at its cause, do not just hide it. Four scenic modes must be visually distinct and smoothly related. Once flight V1 is stable, the creator wants to work on authoring GLB worlds placed into Tiled maps; do **not** conflate that separate future task with this one.

## Read in this order

1. `docs/CODEX_CINEMATIC_OCEAN_V1_IMPLEMENTATION.md` — definitive implementation assignment and required deliverables, including future agent tools and this file's completion requirements.
2. `docs/PROPOSAL_CINEMATIC_OCEAN_ALTITUDE_SHADOW.md` — owner-approved artistic intention and four-altitude compositions.
3. `Semantic-Bindings/spatial-truth-v1.md` and `docs/CODEX_SPATIAL_TRUTH_DEEP_DEBUG_PROMPT.md` — physical vs rendered vs viewport coordinates, diagnostic states, permissioned preview.
4. Current `src/main.js`, `src/ocean-crest-field.js`, `src/ocean-speed-cues.js`, `src/ocean-speed-style.js`, `src/horizon.js`, `src/flight-model.js`, `src/atmosphere-model.js`, `src/spatial-development.js`; confirm APIs in live source, not this historical snapshot.
5. `Bugs/flight-and-scale.md`, current tests and CI history — distinguish actual regression, known issue and unverified screenshot aesthetics.

## Current starting architecture (before Codex implements this assignment)

- `src/flight-model.js`: authoritative numeric world-scale-normalized `atmosphericAltitude` used for visual bands; flight physics is separate.
- `src/horizon.js`: single curved ocean and terrain visual shader, with the same deformation uniform contract, separate from flat canonical collision/navigation coordinates.
- `src/ocean-crest-field.js`: deterministic sampled short curved crests and two fixed geographically anchored near/far lattices; this **does not yet constitute** the four specified wave-family divisions.
- `src/ocean-speed-cues.js`: two bounded pools of 56 near + 32 far crests (at most two draw calls) with altitude crossfade. This is a *baseline to examine*, not evidence of actual visual success; the owner reports hairy strokes and a visible diamond.
- `src/speed-perception-renderer.js`, `src/atmosphere-model.js`: existing approved-feeling speed cue and four cloud-depth layers; preserve them.
- `src/spatial-diagnostics.js` / `src/spatial-development.js`: existing bounded read-only spatial diagnostics, user-authorized development/capture/preview functions. **Ocean-specific family/shadow tuning is NOT present yet.** In-browser global APIs do not give an external agent access to a user's running tab without an explicitly authorized bridge.

## Target visual contract, in compact form

LOW: one close detailed coherent wave family, optional faint distant family; shadow almost absent. MIDDLE: near + intermediate + broad families (richest parallax); light soft footprint. THIRD: broad long beautiful bands + restrained medium secondary, noticeably different from top; larger moderately dark footprint. TOP: predominantly very broad slow-looking wave contours + tiny sparse second subset; darkest tasteful soft footprint as altitude reference. Family placement stays world-anchored; perceived speed follows actual motion and projection. Shadow is a deliberate stylized height indicator, not realistic sunlight. All bands transition continuously in both directions; no abrupt geometry/preset switch. The same pattern must not slide with heading, climb or camera.

## Future machine-readable truth (to be supplied by implementing Codex)

After implementation, Codex MUST REPLACE/EXPAND this document with **real API names and stable parameter IDs**, and create `ocean-flight-v1.schema.json` and `ocean-flight-v1-handoff.json` in this directory. The handoff must explicitly say what is shipped, which tests and browser captures ran, the implementation commit, known limitations and the exact owner-approved preset. Keep links and source/code maps updated with every visual change. A new ChatGPT/Codex turn should start from this document then use the preset and runtime spatial APIs to locate a selected offending crest, preview one bounded artistic change, A/B compare the same frame, and rollback or commit explicitly.

**Never claim that an agent can “see the engine” from source code alone.** Real rendered feedback requires an authorized live browser capture/replay or a user-provided screenshot and corresponding numeric trace. Do not silently invent measurements or claim 4 GB performance from Node tests.
