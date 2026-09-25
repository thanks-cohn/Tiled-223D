# ÆXIS Dirt API — command reference and agent debugging recipes

**PROPOSED CONTRACT ONLY: none of the `dirt.*` operation names below is claimed to exist yet.** Codex must implement, test, and then replace these illustrative calls with **actual running commands**, including the exact executable location, `npm` invocation, input file/STDIN flags, expected outputs, browser-programmer usage, and permission setup. Read `README.md` here and `../../docs/CODEX_DIRT_LANDMASS_SYSTEM_REQUEST.md` before implementation.

## Adapter and invocation convention

The preferred transport-neutral operation format is a JSON request with `operation`, `schemaVersion`, `actorId`, `projectId`, `landmassId`, `expectedRevision` where relevant and a bounded `input`. Return a typed JSON result. A proposed local JS adapter may be `dirtProgrammer.execute(request)` / `dirtAgent.execute(request)`; these are proposed names **not current executable JS**. Codex should use the existing `scripts/world-api-cli.mjs` and `World API v1` command contracts or a compatible explicit `scripts/dirt-api-cli.mjs` rather than inventing an undocumented extra transport. Existing World API v1 permissions remain authoritative; no convenient browser global grants extra authority.

**Proposed request example — inspect before editing (NOT executable until implemented):**

```json
{
  "schemaVersion": "dirt-v1",
  "operation": "dirt.inspectLandmass",
  "actorId": "creator",
  "projectId": "demo-world",
  "landmassId": "dirt-landmass-01",
  "input": {
    "coordinateSpace": "canonical",
    "include": ["footprint", "source", "currentRules", "featureCounts", "effectiveExpansion"],
    "limit": 50
  }
}
```

All outputs must state `status`, `capabilityVersion`, source/projection revisions, stable IDs, provenance and actual support; list/trace responses must have enforced pagination or bounded windows.

## A. Discovery and read-only inspection

| Proposed operation | Required input | Expected bounded result / reason it exists |
|---|---|---|
| `dirt.capabilities` | actor, optional selected world | Actually implemented feature flags and scopes, adapters, version, grants, budgets, explicitly unsupported operations; no “available” claim for unfinished ramps/road/editor. |
| `dirt.inspectWorld` | world scale ID | Canonical Tiled map ID/revision, Current/Bigger/Massive dimensions, default world expansion profile, active terrain and expansion adapter, source island protection. |
| `dirt.listLandmasses` | `offset,limit`, optional kind/region | IDs, canonical bounds, measured footprint fraction, provenance, protected status, active experience mode. Do not page over millions of cells. |
| `dirt.inspectLandmass` | ID; bounded includes | Canonical source, stable boundary/mask, original island exclusions, dirt palette, physical baseline, ramp counts, profile state. |
| `dirt.inspectRules` | ID, world ID | **Stored** and **effective** values, default vs override origin, validated min/max, 5/3/10 candidate probabilities, true candidate counts and measured result. |
| `dirt.listProfiles` | `offset,limit` | All supported world/landmass expansion profiles, versions, distance rules and whether selected profiles can be replaced. |
| `dirt.inspectProvenance` | landmass/feature/interval/chunk ID | Exact source map ID, revision, generator version/seed, authored patch IDs, derivation/LOD state and source hash. |
| `dirt.listFeatures` / `dirt.inspectFeature` | source ID, type and page or stable feature ID | Saved ramp shape/physical size/rotation/protected footprint and positions in canonical/world/experience spaces; no automatic ramp rescaling. |
| `dirt.inspectIntervals` | route ID, page/window, scale | Boundary ramp/feature IDs, source gap length, effective expanded gap length, seed, continuity, ID and map/progress range. |
| `dirt.inspectChunk` | stable chunk address | Loaded/pending/evicted state, cache revision, generated sample count, build time, predicted cost, near/mid/far representation, source/effective profile. |
| `dirt.inspectPerformance` | bounded sample period/counters | Actual CPU build/upload times, JS heap where measurable, renderer chunk counts/GPU estimates marked estimates, frame work budget, eviction/prefetch misses. |

## B. Canonical generation, regeneration and preservation

`dirt.planCanonical`: read-only candidate plan based on the original saved 500 × 500 Tiled project. Accept desired measured coverage target (default about one third **of whole world**), permitted blank ocean cells, no-overlap/shore/feature clearances, brown-shading/elevation constraints, seed, and saved ramp probabilities `{large:0.05,medium:0.03,small:0.10}`. Return actual feasible capacity, draft canonical mask/contour, region ID, exact protected island cells, canonical sampled feature records, rejection reasons, measured coverage, estimated memory/cost and a plan hash. Never rewrite source when planning.

`dirt.previewCanonical`: safe preview for a specific plan and view (`canonical-map`, `current-ground`, `bigger-overview`, `massive-overview`). Render/serialize bounded samples only. The preview must match what an authorized commit would create at that revision.

`dirt.validateCanonical`: check geographic/semantic overlap, original-island invariance, road/no-build constraints, ramp physical fit, mathematical bounds, seed/version and budget. `dirt.commitCanonical`: atomically commit a validated plan to the creator-controlled non-destructive Tiled-associated canonical region using actor grants/expected revision; persist IDs, physical ramp records, math recipe and source provenance, and return affected IDs/undo token. Export/reimport must recover exactly the same canonical features.

`dirt.planRampRegeneration` and `dirt.diffRampRegeneration`: explicit **canonical-only**, read-only dry run of changing ramp probability/seed/spacing/author constraints. Return existing/new/removed/modified ramp IDs, physical-footprint and clearance conflicts, predicted experience-interval invalidations and whether manual links/edits would be affected. Commit requires explicit review/actor permission; switching world scale, changing camera, approaching a ramp, or reloading terrain **never** calls regeneration implicitly.

**Proposed bounded canonical plan payload:**

```json
{
  "schemaVersion": "dirt-v1",
  "operation": "dirt.planCanonical",
  "actorId": "creator",
  "projectId": "demo-world",
  "expectedRevision": 3,
  "input": {
    "sourceMap": "canonical:500x500",
    "targetWholeWorldCoverage": 0.3333333333,
    "preserveRegions": ["original-island-A", "original-island-B"],
    "surface": {
      "baseElevation": 8,
      "undulationAmplitude": 0.4,
      "browns": ["medium", "light", "dark"],
      "shadeDoesNotChangeHeight": true
    },
    "ramps": {
      "candidateProbability": {"large": 0.05, "medium": 0.03, "small": 0.10},
      "seed": 7319,
      "minimumSeparation": {"large": 55, "medium": 30, "small": 14}
    },
    "budget": {"maxSourceCells": 250000, "maxPreviewSamples": 4096}
  }
}
```

The sample clearances and base elevation are **illustrative, not approved tuning or actual current values**. The real engine should validate clearances against feature dimensions, driving speed and available canonical area rather than blindly trusting these numbers.

## C. Expansion control and coordinate mapping

`dirt.inspectExpansion`: `landmassId,worldId` → stored mode (`inherit-world` or `replace`), exact effective profile and source, canonical footprint, travel mapping, gap budgets, fixed-ramp invariants, version/cost.

`dirt.setExpansionPolicy` is a **staged operation**, not an unreviewed direct mutation. Validate union:
```json
{"mode":"inherit-world"}
```
or
```json
{"mode":"replace","profileId":"expansive-ocean","rules":{"experiencedGapFactor":12}}
```
The second example is a *proposed* replacement-policy object. If the chosen profile rejects an override field, return `INVALID_PROFILE`; never multiply the replacement factor by an inherited world factor. An ocean-like replacement on the 500 × 500 landmass is an explicit acceptance test.

`dirt.planExpansion`: use only saved canonical source and saved fixed feature records. Produce a bounded, deterministic, invertible interval mapping for the selected scale/profile; keep protected ramp profiles and physical sizes exactly equal across scales. Report the actual extra distance in *gaps*, incompatible junctions/clearances and any unsupported non-1D topology. Do not describe a road-only prototype as full arbitrary 2D expansion.

`dirt.mapCoordinates`: typed input `fromSpace,toSpace,worldId,routeId,landmassId,position` with bounds, inverse transform and ambiguity result if no unique mapping exists. `dirt.explainMapping`: for a specific source feature or route coordinate, return fixed feature vs expandable gap classification, original/expanded distance, selected profile, reference anchors, local/interpolated transformation and error bound. Never silently let a map-coordinate query change a player or modify source.

**Proposed expansion and debug request:**
```json
{
  "schemaVersion":"dirt-v1",
  "operation":"dirt.explainMapping",
  "actorId":"debugger",
  "projectId":"demo-world",
  "landmassId":"dirt-landmass-01",
  "input":{
    "worldId":"bigger",
    "routeId":"main-dirt-road",
    "position":{"space":"experience","distance":1200},
    "include":["canonicalPosition","nearestSavedFeature","gapAllocation","effectiveProfile"]
  }
}
```

## D. Terrain, ramp, LOD, collision and performance inspection

`dirt.sampleTerrain`: requires **explicit** coordinate space, bounded count/sampling box, world ID, expansion plan/profile revision. Returns semantic ground, **authoritative** physical height, base/noise/ramp contributions, shade (without fake elevation), surface normal/error bounds, ramp/feature ID, closest safe approach, source region, collision validity and any explicit authored override.

`dirt.inspectCollision`: coordinate or bounded sweep `from,to,radius,worldId,experienceId`, returns loaded/authoritative samples, contact height/time/normal, ramp geometry ID, skipped/inexact samples and potential tunneling reason. A collision query must not trust a far sprite or a visual-only elevation mesh.

`dirt.inspectLOD`: view ID/main-vs-preview, world/experience location and bounded range; reports what near/mid/far proxy actually renders, why, coordinates, coarse/near overlap/occlusion, camera altitude and the source feature identity. `dirt.planAppearance` and `dirt.planGroundTuning` permit read-only draft adjustments for brown palette, broad-patch scale, outlines, tiny undulations, high-point limits and performance. Shading changes should not inadvertently modify physics.

`dirt.inspectChunk` and `dirt.inspectPerformance` must make 4 GB optimization measurable: allocated buffers, active/prefetched/evicted chunks, build/upload timing and constraints. Don't report estimated GPU memory as measured fact.

## E. Agent-native why/debug/reproduce operations

`dirt.explainAt`: one diagnostic query that gathers bounded source/feature/interval/material/elevation/physics/render/LOD facts at a selected location and answers **why** a point is brown, raised, hidden, collidable, ocean, part of a particular ramp or different in another scale. It should expose machine-readable evidence, not free-form speculation.

`dirt.traceDecision`: bounded trace (limit ≤ configured cap) for one deterministic placement, clearance rejection, expansion gap assignment, chunk build/eviction, LOD transition, coastline overlap or collision decision. Include input IDs, revision, branch condition, relevant scalar values, decision and downstream effect. Mark omitted steps honestly with `truncated:true`.

`dirt.diffWorldScales`: choose a saved landmass and up to N ramp/interval IDs; compare Current/Bigger/Massive canonical footprints/normalized coordinates, feature sizes/shapes/IDs, interval lengths, visual/collision source and effective profiles. Report discrepancies with tolerances and context. Should identify an incorrectly regenerated per-scale ramp or independently generated ellipse immediately.

`dirt.validatePlan`, `dirt.previewPlan`, `dirt.commitPlan`, `dirt.undo`: use one authorization and transaction core. A plan with ANY error is noncommittable, and stale revisions, protected islands, duplicate IDs, impossible space allocation, disallowed source overwrites and unbounded costs must fail atomically. Undo requires rights, revision and dependency checks and cannot delete other actors' later independent work.

`dirt.diagnosticBundle`: optional bounded reproducible report containing source/profile/algorithm versions, relevant deterministic seeds, stable feature/interval/chunk addresses, minified canonical region snippet **only if actor may inspect it**, limited traces, sampled normal/height/material and actual counters. Redact absolute user paths, identifying files and private map contents by default; never upload automatically. Report capability unavailable when snapshot or GPU telemetry cannot be collected.

**Proposed agent investigation workflow (NOT yet executable):**
```text
dirt.capabilities
  -> dirt.inspectWorld
  -> dirt.inspectLandmass
  -> dirt.explainAt (bad location, correct coordinate space)
  -> dirt.inspectFeature / dirt.explainMapping
  -> dirt.inspectCollision + dirt.inspectLOD
  -> dirt.diffWorldScales (same stable ramp ID across 3 scales)
  -> dirt.traceDecision (bounded source/provenance)
  -> dirt.planExpansion OR dirt.planAppearance
  -> dirt.validatePlan + dirt.previewPlan
  -> creator reviews -> dirt.commitPlan(expectedRevision,actorId)
  -> tests + dirt.explainAt -> dirt.undo if authorized and needed
```

## F. Implementation deliverables and truth checks

Codex must implement and test **real invocation syntax** for each shipped operation and update this document accordingly. Add concrete runnable examples for a seed-stable canonical create, scan of protected original islands, saved ramp list, per-scale gap comparison, small-world `replace/expansive-ocean` and rollback after invalid plan. Provide at least one agent-debug recipe where a ramp visually appears but collision is missing, one where original islands accidentally show brown, one where a coastline mesh covers authored land, and one where high-speed prefetch falls behind. For unfinished operations, leave a visible `NOT_IMPLEMENTED` row and a dependency path; never represent proposed operation names as currently callable functions.

**Contract invariant:** Every user/agent command must be able to say *which canonical landmass, which saved ramp, which expansion interpretation, which coordinate space and which exact geometric/visual/collision representation it used*. Without that inspectability, an expansive world is difficult to modify or debug safely.
