# Dirt API — agent debugging and safe-change playbook

**STATUS: requested workflow; the `dirt.*` operations are proposed, not yet shipped.** Codex should turn this into a tested guide when the API is implemented. Never fabricate successful command output or claim to have visually verified a viewport using an API-only unit test.

## Before any edit: invariant snapshot

Read `../../docs/CODEX_DIRT_LANDMASS_SYSTEM_REQUEST.md` and the root `AGENTS.md`. Retrieve current branch, base and PR merge status, canonical source map ID/revision and existing original island IDs, terrain masks, elevations, materials and existing camera/preview behavior. Confirm the restored original islands are intact **on the actual target branch**; the older experimental PR #30 branch may be behind the restoration. Save a reproducible, bounded baseline fixture and current tests before attempting any import, regeneration or mapping change. Explicitly record whether a command has inspection permission and whether any write requires separate creator authorization.

## Symptom-to-diagnostic recipes

**Original islands unexpectedly appear as brown dirt:** `dirt.inspectWorld` → `dirt.listLandmasses` → `dirt.explainAt` for original island sample positions with `space:"canonical"` → `dirt.inspectProvenance` and `dirt.inspectLOD`. Compare source semantic ground against displayed material and effective renderer. Determine whether source was overwritten, optional dirt overlay masks island cells, island mesh material batches changed, a new landmass is rendering above an island, or only a low-detail proxy is wrong. The correct fix preserves island source and its renderer; do not delete unrelated camera or proposal work. Include a regression fixture and verify in three scale modes.

**Same ramp becomes huge or moves in Massive:** inspect its **canonical ID and physical geometry** in `dirt.inspectFeature` at all scales; compare `dirt.diffWorldScales` and `dirt.explainMapping`. Distinguish canonical/world-overview coordinates from experience-route distances. Trace the feature's transform and the adjacent interval lengths; no world scale or gap multiplier may be applied to ramp width, height, contact mesh, count or orientation. A generated Massive-only ramp is a source-identity violation.

**Visible ramp has no collision / sudden terrain pop:** `dirt.explainAt` → `dirt.inspectCollision` with a bounded actual approach/sweep → `dirt.inspectLOD` for main AND preview → `dirt.inspectChunk` and `dirt.traceDecision`. Compare physical sample height, near-mesh vertex height, material-only color pattern, far card, chunk state and actual contact normal. Distinguish missing collider, wrong transform, late prefetch, LOD overlap, invalid interpolation or near-plane/camera framing. Do not “fix” by inventing an unrelated solid box that doesn't match visible terrain.

**Three scales show different landmass outlines:** `dirt.inspectLandmass` → `dirt.inspectWorld` → `dirt.diffWorldScales` comparing normalized footprint/mask and provenance. All overviews derive from the saved canonical 500 × 500 mask, not independently sampled ellipses; only the ground-level inter-feature experience space expands.

**Player flies very fast into unprepared terrain:** inspect actual speed, forward prefetch horizon, queued and ready chunk range, input/steering envelope, build/upload time and chunk collision authority; compare to distance-to-next-saved-ramp. Report how many seconds of preparation remain. Fallback must be explicit, conservative and safe; do not silently create random substitute ground or an invisible collider.

**Edited settings do not take effect, or a return visit changes geography:** compare stored config, effective profile/inheritance resolution, source/profile/algorithm revision, interval/chunk address, cache generation key, deterministic seed and authored patch overlay. Report stale cache or mismatched revision as a concrete error. Never silently reroll canonical ramps when changing profile.

## Required bounded reproduction bundle

When a creator reports a bug, the agent should be able to request a local, explicitly authorized diagnostic bundle with `projectId`, `landmassId`, selected `worldId`, `sourceRevision`, `effectiveProfileVersion`, explicit coordinate space/point or bounded route segment, relevant saved ramp/interval/chunk IDs, visual/collision samples, actual/estimated performance metrics distinctly labeled, seed and short traces. No full 16k world allocation, unrestricted logs, raw personal file paths or automatic uploads. A bundle must identify which operations are unsupported or inaccessible, and any trace truncation.

## Plan → preview → validate → commit → verify → undo

A debugging agent starts with read-only inspect/explain, identifies a specific source-backed cause, proposes a *scoped* typed change, produces a bounded before/after preview and impact/cost estimate, and requests creator review when required. Validate again atomically at commit with actor grants, operation ID and expected revision. Verify the original island fixtures, canonical fixed ramp list, selected world-scale relationships and user-reported coordinate. If regression occurs, offer authorization-checked undo of the agent's own operation rather than overwriting source or resetting the entire project.

**Minimum Codex test cases:** unauthorized change; direct-envelope attempt to overwrite original island; stale revision; collision/visual mismatch; deterministic ramp replay after eviction; unexpanded canonical map versus stretched internal journey; LOD seam; near vs main preview camera; high-speed prefetch under bounded memory; failed regeneration preserving prior source; diff across all three world scales.
