# ÆXIS Dirt API v1

**Status:** The local JavaScript core, JSON CLI adapter, browser developer surface, canonical production, fixed-feature route interpreter, bounded inspection/diagnostics, and compact editor described here are implemented. This is an intentionally honest browser-first slice; the limitations below remain.

## Architecture

`src/dirt/canonical.js` builds one deterministic 500 × 500 canonical production. Its exact measured default mask is 83,333 cells (33.3332% of the whole world), and it excludes every authored island cell plus a ten-cell water clearance. It stores stable fixed-ramp records generated at 5% large, 3% medium, and 10% small **per eligible candidate zone**. Shade selection and physical elevation are separate outputs.

`src/dirt/expansion.js` implements a monotone, invertible main-route interpreter. Feature intervals retain exact physical length; only gaps receive the selected profile factor. `inherit-world` resolves Current/Bigger/Massive to 1×/5×/32×. `replace` selects exactly one profile, including `expansive-ocean` at 12×; it never multiplies that value by the world profile. This is a one-dimensional route implementation, **not** arbitrary 2D terrain warping.

`src/dirt/api.js` is the common transport-neutral core. `ProgrammerDirtApi` and `AgentDirtApi` expose the same validated operations and actor grants. `scripts/dirt-api-cli.mjs` persists only compact rules, policy, revision, and undo history; the mask and features are deterministically reconstructed. `window.tiledWorldDirtApi.execute(request)` is also available during the browser viewer lifecycle. That local global has an in-memory creator actor for this standalone demo; it is not remote authentication, does not write a project file, and must not be exposed as a trusted network boundary.

The viewer samples the same canonical mask and fixed ramps for navigation, collision, and near geometry. Gameplay X is interpreted as experience-route distance and inverted through the active expansion plan before canonical sampling. Current/Bigger/Massive solve their permitted gap factor to reach exactly 500/2,500/16,000 traversal units while ramp intervals remain physical. A scale transition made on dirt maps through canonical route progress, so it returns to the same saved ramp rather than using a percentage approximation. Z remains a normalized cross-route mapping because general 2D warp is not implemented.

The browser editor commits its canonical rules and expansion policy as one `canonical-and-expansion` transaction. The core validates and constructs both replacement values before assigning either; a bad profile or terrain rule leaves the revision, rules, production, and policy unchanged.

## Implemented operations

All operation IDs listed below are callable. `dirt.capabilities` is authoritative and includes grants, caps, adapters, coordinate spaces, and unsupported features.

- Discovery: `dirt.capabilities`, `dirt.inspectWorld`, `dirt.listLandmasses`, `dirt.inspectLandmass`, `dirt.inspectRules`, `dirt.listProfiles`, `dirt.inspectProvenance`.
- Canonical: `dirt.planCanonical`, `dirt.previewCanonical`, `dirt.validateCanonical`, `dirt.listFeatures`, `dirt.inspectFeature`, `dirt.planRampRegeneration`, `dirt.diffRampRegeneration`.
- Expansion: `dirt.inspectExpansion`, `dirt.inspectIntervals`, `dirt.mapCoordinates`, `dirt.explainMapping`, `dirt.planExpansion`.
- Physical/visual: `dirt.sampleTerrain`, `dirt.inspectCollision`, `dirt.inspectLOD`, `dirt.inspectChunk`, `dirt.inspectPerformance`, `dirt.planAppearance`, `dirt.planGroundTuning`.
- Agent/debug: `dirt.explainAt`, `dirt.traceDecision`, `dirt.diffWorldScales`, `dirt.validatePlan`, `dirt.previewPlan`, `dirt.commitPlan`, `dirt.undo`, `dirt.diagnosticBundle`.

See [COMMANDS.md](COMMANDS.md) for tested calls, [SCHEMAS.md](SCHEMAS.md) for envelopes, and [DEBUGGING.md](DEBUGGING.md) for bounded investigation recipes.

## Current limits / remaining work

- Canonical state is deterministic versioned project data, but an ordinary Tiled JSON overlay exporter/re-import adapter for this irregular mask is not yet implemented. The source `sampleWorld()` arrays remain untouched.
- The expansion interpreter covers one main route. General graph junction solving and continuous safe arbitrary-2D warp are explicitly unsupported.
- Near/far rendering remains the existing fixed-budget 96²/112² geometry path. It has deterministic rebuilds and disposal, but not a measured eviction queue, velocity prefetch telemetry, or seam morphing.
- `inspectLOD`, `inspectChunk`, and `inspectPerformance` truthfully return model budgets and unavailable live telemetry; they do not pretend to measure a GPU or 4 GB Windows host.
- The editor supports expansion policy, ramp probabilities, and flatness with plan/preview/commit. Full outline painting, clearance controls, palette/high-point controls, three simultaneous graphical previews, and persistent browser project storage remain future work.
- MCP, desktop IPC, native/Tiled embedded UI, automatic uploads, and arbitrary full-world snapshots are not implemented.
