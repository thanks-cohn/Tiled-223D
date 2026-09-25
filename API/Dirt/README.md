# ÆXIS Dirt API — programmer and agent contract

**STATUS: PROPOSED API SPECIFICATION / CODEX WORK ITEM, NOT IMPLEMENTED COMMANDS.** This directory is the designated home for the new canonical dirt-landmass API, command reference, machine-readable schemas, examples and agent debugging playbooks. The full implementation brief is [docs/CODEX_DIRT_LANDMASS_SYSTEM_REQUEST.md](../../docs/CODEX_DIRT_LANDMASS_SYSTEM_REQUEST.md); the governing design is [the canonical dirt landmass proposal](../../portable-visions/AEXIS_CANONICAL_DIRT_LANDMASS_FIXED_FEATURES_EXPANDABLE_SPACING_PROPOSAL.md). Read both before coding.

## Important current state

The repository already has [World API v1](../../docs/WORLD_API_V1.md), `ProgrammerWorldApi`, `AgentWorldApi`, JSON schemas and a `scripts/world-api-cli.mjs` CLI. Those do **not** automatically implement dirt commands described here. A preexisting experimental `window.tiledWorldDirtApi` or independently sampled elliptical continent on PR #30 is **not** the completed canonical/agent-native API. Codex must inspect current reality and ensure that capabilities only advertise genuinely supported methods. The restored original islands on the target branch are immutable inputs to this work.

## Architecture: one core, two first-class surfaces

- **Common core:** versioned canonical Tiled-relative dirt landmass, saved fixed features, experience-space expansion mappings, deterministic terrain/chunk sampler, collision, provenance, policy, validation, actor/grants, expected revision and atomic transaction/undo log. No renderer API is allowed to be the sole authority for positions, heights or ramp identities.
- **Programmer surface:** exact JSON/typed operations to inspect source masks/coordinates, list/edit presets and constraints, select expansion policy, retrieve feature IDs/geometries, query mapping/inversion and terrain/collision samples, request stable chunk records, stage canonical edits and inspect profiling information.
- **Agent surface:** independently designed high-level intent planning, bounded map/sample/diff/why diagnostics, dry-run seed/spacing regeneration, cost/performance forecasts, preview, validated plan→commit with permissions, undo, and a reproducible bounded debugging bundle. Agent actions compile to the common validated transaction core; no unrestricted hidden code execution, privileged bypass or mandatory LLM call.
- **Adapters:** local importable JS module and JSON/CLI adapter must be real and tested first. A browser editor can call the same core. A future desktop IPC/MCP adapter can be added without redefining operations. Never document a nonexistent function as an available capability.

## Names, semantics, and invariants

Canonical map space always references one saved original 500 × 500 Tiled-relative landmass. World overview spaces are the Current/Bigger/Massive interpretations. Travel/experience-local coordinates describe the extra distance driven **between** saved, unscaled ramps. Each operation must identify which space it reads or changes: `canonical`, `world`, `experience`, or `render-local`. Do not silently mix these; provenance must show exact transforms and source/profile versions.

World expansion and landmass experience expansion are separate controls. `inherit-world` resolves the current world's default; `replace` selects a **single** alternative profile. No implicit profile multiplication. Dirt ground/contact/material behavior is orthogonal to expansion choice. All ramp IDs and physical footprints remain unchanged across scales; new ramps only arise from an explicitly reviewed canonical regen. Original islands and already authored locations cannot be overwritten by a direct or an agent-planned operation.

Recommended canonical default: new dirt region is approximately one third of the 500 × 500 world including protected original-island exclusions; mostly flat brown/light-brown/dark-brown shading, subtle outlines and low hills. Ramp candidate selection defaults to large 5%, medium 3%, small 10%, with minimum clearance around each ramp. Probability per eligible candidate zone is **not** literal surface-area coverage; return measured region coverage and candidate counts separately.

## Command index (see [COMMANDS.md](COMMANDS.md))

**Discovery:** `dirt.capabilities`, `dirt.inspectWorld`, `dirt.listLandmasses`, `dirt.inspectLandmass`, `dirt.inspectRules`, `dirt.listProfiles`, `dirt.inspectProvenance`.

**Canonical production:** `dirt.planCanonical`, `dirt.previewCanonical`, `dirt.validateCanonical`, `dirt.commitCanonical`, `dirt.listFeatures`, `dirt.inspectFeature`, `dirt.planRampRegeneration`, `dirt.diffRampRegeneration`.

**Expansion:** `dirt.inspectExpansion`, `dirt.setExpansionPolicy` (staged), `dirt.inspectIntervals`, `dirt.mapCoordinates`, `dirt.explainMapping`, `dirt.planExpansion`.

**Physical/visual:** `dirt.sampleTerrain`, `dirt.inspectChunk`, `dirt.inspectLOD`, `dirt.inspectCollision`, `dirt.inspectPerformance`, `dirt.planAppearance`, `dirt.planGroundTuning`.

**Agent/debug:** `dirt.explainAt`, `dirt.traceDecision`, `dirt.diffWorldScales`, `dirt.validatePlan`, `dirt.previewPlan`, `dirt.commitPlan`, `dirt.undo`, `dirt.diagnosticBundle`.

These are **proposed stable operation identifiers**. Codex may refine naming to integrate with existing World API v1, but it must preserve documented one-to-one capabilities, version/adapters and tests, explain any renaming in this file, and update the exact invocations in `COMMANDS.md`. Avoid duplicating operations without a meaningful difference.

## Required operation envelope / response

Every write must carry `schemaVersion`, `operationId`, `actorId`, `projectId`, `landmassId`, `expectedRevision`, exact `coordinateSpace`, mode (`plan` versus `commit`) and a typed operation payload. Commit-time validation is authoritative even for hand-crafted payloads. A successful mutation returns the resulting revision, affected interval/chunk IDs, preserved/changed canonical feature IDs, undo token/operation ID and bounded repro/debug metadata. A failed mutation returns a typed code, conflicting source/region/feature ID, offending coordinates, range/clearance/cost budget, how to correct the request, and NO change to source/revision. Queries must support `offset/limit` or bounded geometry window, enforce caps, and never leak private files by default.

Minimum errors: `NOT_IMPLEMENTED`, `UNAUTHORIZED`, `STALE_REVISION`, `PROTECTED_ISLAND`, `SOURCE_PROTECTED`, `REGION_OVERLAP`, `INSUFFICIENT_CANONICAL_AREA`, `INVALID_COORDINATE_SPACE`, `INVALID_PROFILE`, `INVALID_RAMP_PROBABILITY`, `RAMP_SPACING_CONFLICT`, `FIXED_FEATURE_WOULD_RESCALE`, `NONINVERTIBLE_EXPANSION`, `UNPREPARED_COLLISION_CHUNK`, `LOD_COLLISION_MISMATCH`, `QUERY_LIMIT_EXCEEDED`, `PERFORMANCE_BUDGET_EXCEEDED`. Do not silently fall back to ocean or a randomly regenerated ramp to conceal an error.

## Future file organization for Codex

Codex should create and maintain `API/Dirt/COMMANDS.md` (exact call examples), `API/Dirt/SCHEMAS.md` (versioned JSON/TS shapes and validation rules), `API/Dirt/DEBUGGING.md` (agent cookbook for reproducing geometry, collision, and LOD issues), plus executable schema files under the existing `schemas/` conventions and genuine tests under `tests/`. Update examples and capability status as methods ship; retain a changelog/migration note when an operation contract changes. This directory is a user-facing API reference, not the location of all executable source code.
