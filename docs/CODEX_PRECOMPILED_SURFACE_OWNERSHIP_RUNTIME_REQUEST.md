# Codex request — ÆXIS precompiled surface ownership and zero-generation terrain runtime

## Status and intent

This is the next requested implementation task for **The World's ÆXIS**.

Work from:

`codex/dirt-runtime-occupancy-fix`

This request supersedes any temptation to keep extending the current near-terrain runtime generator. The goal is to finish the architectural move from “precompiled terrain data with runtime geometry generation” to **prepared terrain runtime assets with exclusive surface ownership**.

Do not merge without creator approval.

Read first:

- `AGENTS.md`
- `docs/CODEX_HANDOFF.md`
- `docs/SINGLE_PLANE_EXPRESSION_MULTIPLE_PLANE_COLLISION_AVOIDANCE.md`
- existing dirt API and performance docs
- current recovered PR #32 terrain implementation

Do not add a parallel debugging stack. Reuse the existing dirt diagnostics and programmer/agent API. Add only the minimum new inspection handles needed to make ownership and runtime behavior explicit.

---

# 1. Product principle

The World's ÆXIS should specialize in **compiling worlds ahead of runtime**, not regenerating terrain continuously while the player travels.

The canonical authoring source remains the 500×500 world.

From that canonical world, ÆXIS prepares multiple runtime worlds:

- Current
- Bigger
- Massive

Each prepared world should already know:

- where land exists
- where ocean exists
- authoritative surface ownership
- elevation
- color/tone
- fixed ramps/features
- expansion relationships
- chunk occupancy
- any prepared near-surface topology needed for rendering

At runtime, ordinary traversal should primarily be:

```text
load prepared asset
→ position / stream prepared chunk if needed
→ draw
```

not:

```text
move player
→ resample terrain
→ triangulate
→ allocate buffers
→ build BufferGeometry
→ upload
→ evict
→ regenerate later
```

Streaming already-prepared chunks is allowed.

Generating terrain topology while the player moves is not the target architecture.

---

# 2. Why this request exists

The current recovered precompiled dirt system successfully prepares important world information ahead of time, but it still constructs near geometry at runtime from sampled heights.

That means “precompiled” is currently incomplete.

The renderer still has a path roughly equivalent to:

```text
precompiled world information
        ↓
runtime height samples
        ↓
runtime vertex/index buffers
        ↓
runtime BufferGeometry
        ↓
GPU publication
```

This can still produce work under strain, including in situations where the player is over ocean.

The current branch already began a narrow occupancy improvement so ocean-only chunks can be skipped before near geometry is built. Preserve that work.

This request takes the next step: **compile enough of the final runtime terrain representation that normal travel does not generate terrain geometry.**

---

# 3. Single Plane Expression rule

Follow:

`docs/SINGLE_PLANE_EXPRESSION_MULTIPLE_PLANE_COLLISION_AVOIDANCE.md`

For surface authority, there must be one canonical semantic result:

```text
world.surfaceAt(x,z)
```

with one authoritative answer:

```text
LAND
```

or:

```text
OCEAN
```

Never both.

The following systems must consume the same surface ownership definition:

- terrain renderer
- ocean renderer
- collision
- physical elevation
- land/ocean gameplay classification
- prefetch/streaming decisions
- programmer/agent inspection

Do not allow separate visual and physical systems to independently disagree about whether a coordinate is land or ocean.

---

# 4. Exclusive land/ocean ownership

The creator explicitly requires:

> If a place belongs to land, it must not be able to hold ocean underneath it.

Do not solve ocean bleed primarily with:
- tiny Y offsets
- polygon offset tricks
- “land should probably draw first”
- depth-test luck
- larger vertical separation

Those may be harmless secondary safeguards, but they must not be the authority.

The actual rule is:

```text
surface ownership = LAND
→ land may render
→ ocean must not render there
```

and:

```text
surface ownership = OCEAN
→ ocean may render
→ land must not render there
```

Use one compiled ownership representation derived from the same canonical/expanded world source.

The ocean renderer should consume that ownership data and explicitly exclude land-covered coordinates.

The land renderer should consume the same ownership data.

The physical sampler should agree with the same ownership result.

---

# 5. Compiled surface ownership asset

Add a compact prepared representation for each world profile.

At minimum the runtime must be able to cheaply determine:

- ocean-only chunk
- land-only chunk
- mixed shoreline chunk
- detail/ramp chunk where higher-resolution prepared geometry is needed

A compact enum or bitset is appropriate.

Conceptual example:

```text
0 = ocean only
1 = land only
2 = mixed shoreline
3 = detail/ramp
```

Do not treat those exact numeric values as mandatory.

This occupancy/ownership data must be generated during compile time and persisted with the Current/Bigger/Massive prepared assets.

Runtime should not scan canonical tone arrays to rediscover chunk occupancy every time.

The current branch's runtime `chunkHasLand` work may be used as a temporary bridge or validation oracle, but the final runtime path should consume persisted prepared occupancy metadata.

---

# 6. Prepared near terrain

Move the remaining near-terrain topology work out of the ordinary movement loop.

The preferred outcome is:

```text
compile time:
  determine occupancy
  determine near topology
  determine prepared vertex/index data or reusable topology representation
  persist compact runtime asset

runtime:
  identify prepared chunk
  load/reuse prepared data
  publish/reuse GPU resource
```

The exact persisted representation is an implementation decision.

Possible valid approaches include:

- prebuilt per-chunk vertex/index buffers
- reusable fixed topology plus precompiled per-chunk height buffers
- compact packed near-surface chunks
- another deterministic prepared representation that avoids runtime triangulation and terrain sampling

The key requirement is not a specific file format.

The requirement is:

> ordinary travel must not require terrain topology generation.

Do not explode asset size unnecessarily.

Preserve the project's ~4 GB Windows target.

---

# 7. Prepared chunks versus one giant mesh

Do not solve this by building one huge monolithic mesh that harms memory, upload time, or GPU culling.

Prepared chunks are allowed and likely preferred.

But distinguish:

## Allowed

```text
need prepared chunk
→ retrieve prepared bytes
→ reuse/upload
→ draw
```

## Not target behavior

```text
need chunk
→ sample terrain
→ derive topology
→ allocate geometry from scratch
→ triangulate
→ draw
```

The runtime may still:
- load chunks lazily
- cache them
- evict them
- reuse them
- stream them based on position

It should not regenerate their geography.

---

# 8. Ocean should be cheaper than or comparable to land runtime

The expansive dirt visual is intentionally simple:

- elevation
- three brown tones
- fixed ramps
- no waves
- no reflection
- no refraction
- no foam
- no transparency animation

Therefore its steady-state runtime should be extremely cheap.

Do not create a complicated material system to solve a geometry-preparation problem.

The target is that once prepared assets are loaded/cached, dirt traversal should be comparable to or cheaper than the ocean path from the CPU's perspective.

Do not make unsupported GPU-performance claims without measurement.

---

# 9. Remove renderer readiness as movement authority

The current viewer can block movement near the ground when the dirt renderer reports that a visual chunk is not ready.

That violates the desired ownership model.

The authoritative physical terrain already exists in prepared/compiled form.

Therefore:

- movement/collision must use authoritative physical terrain data
- renderer readiness must not normally freeze actor world movement
- renderer readiness may remain an observer/prefetch signal
- rendering should follow simulation, not own simulation permission

Target ownership:

```text
physical terrain data
    ↓
movement / collision

visual terrain readiness
    ↓
rendering / prefetch only
```

If a visual chunk is temporarily unavailable, the actor should continue following authoritative physical terrain unless another explicit safety/collision rule blocks movement.

Do not remove genuine collision blocking.

Remove only visual-readiness blocking.

---

# 10. Ocean-only runtime behavior

When the player is over an area whose prepared ownership is ocean-only:

The dirt runtime should do essentially nothing.

Expected state:

```text
dirt occupancy = ocean-only
→ no near dirt build
→ no dirt topology generation
→ no dirt geometry publication
→ no terrain-readiness movement block
```

Existing far/global dirt presentation should also obey ownership and must not paint land where ownership says ocean.

Keep any necessary lightweight world-scale overview representation, but it must not trigger near-terrain generation.

---

# 11. Shoreline correctness

Mixed shoreline chunks require special care.

Requirements:

- land/ocean ownership must agree at the same coordinate
- near geometry and ocean exclusion must not leave holes
- ocean must not bleed through land
- land must not extend into authoritative ocean
- collision/sample result must agree with the visible ownership boundary within the designed resolution contract

Do not hide mismatches with visual offsets.

If the ownership resolution differs from geometry resolution, document the exact rule.

---

# 12. Current / Bigger / Massive

All three standard prepared worlds must follow the same architecture.

Do not implement a special fast path only for Current.

Each world should persist its own:

- compiled ownership
- occupancy/chunk class data
- prepared near representation
- existing profile expansion data
- fixed feature/ramp data

The two larger worlds must remain derived from the same canonical 500×500 source and existing expansion model.

Do not alter the creator's gap-only expansion rules.

Do not alter the 37 saved ramp identities/dimensions unless an existing correctness bug requires it and is documented.

---

# 13. Existing dirt APIs

Preserve the existing dirt-v1 API.

Where practical, extend existing inspection responses rather than creating new API families.

Useful runtime inspection should be able to report, through existing API conventions:

- active compiled world/profile
- surface ownership at a coordinate
- prepared chunk class
- whether a chunk is loaded
- whether a chunk was loaded from prepared data or generated
- number of runtime terrain-generation operations
- current cache state
- whether visual readiness can block movement

The expected post-change answer for normal production runtime should be:

```text
runtime terrain topology generation: 0
movement blocked by visual terrain readiness: false
```

Do not add verbose per-frame logging by default.

---

# 14. Diagnostics

Reuse:

- existing dirt performance diagnostics
- existing programmer API
- existing runtime observer

Do not add a second profiler.

Add only the minimum counters needed to prove the architectural change.

Suggested useful counters:

- preparedChunkLoads
- preparedChunkCacheHits
- preparedChunkEvictions
- oceanOnlySkips
- runtimeTopologyBuilds
- terrainReadinessMovementBlocks

The important acceptance target is:

```text
runtimeTopologyBuilds == 0
terrainReadinessMovementBlocks == 0
```

during normal traversal of prepared production worlds.

If compatibility/editor fallback paths can still generate terrain, they must be clearly labeled non-production or editor-only.

---

# 15. Runtime ownership manifest

Under the Single Plane standard, document at least these targets:

```text
world.surfaceAt
terrain:dirt.nearGeometry
terrain:dirt.chunkLifecycle
terrain:dirt.visualReadiness
scene:ocean.surfaceVisibility
actor:player.horizontalMovementPermission
```

For each, identify:

- owner
- contributors
- observers
- lifecycle owner where relevant
- legacy/replaced writer if one exists

Do not implement a large generic registry if a compact static manifest + existing API exposure is sufficient for this slice.

---

# 16. Legacy authority removal

The old runtime geometry-generation path must explicitly lose production authority.

Do not merely stop calling it “most of the time.”

Tests should prove that prepared production worlds do not fall back to runtime near topology generation.

If a fallback must exist for:
- editor preview
- imported unsupported maps
- development-only workflows

then it must be:
- explicitly named
- explicitly non-production
- visible in capabilities/inspection
- impossible to activate silently during ordinary Current/Bigger/Massive traversal

---

# 17. Movement-speed scope

Do **not** implement the full new composable speed/acceleration/gravity profile architecture in this request.

That is a separate queued task.

However, preserve current momentum behavior while removing visual terrain readiness as a movement authority.

Do not “fix” slow travel by tuning unrelated terrain code.

Any existing ocean/land acceleration tuning should remain clearly identified as a motion-system concern.

This request is about:
- prepared terrain
- exclusive surface ownership
- no runtime terrain generation
- no visual-readiness movement blocking

---

# 18. Performance acceptance

On the project's low-end target, the implementation should aim for:

- no recurring terrain topology generation during ordinary traversal
- no dirt topology work over ocean-only areas
- bounded prepared-chunk memory
- no second-long synchronous terrain operations
- no movement pauses caused solely by renderer readiness
- prepared asset load/publish work kept bounded

Run existing performance tooling where possible.

Do not claim browser/GPU success if browser-capable validation is unavailable.

---

# 19. Tests

Add focused tests covering at least:

1. persisted occupancy exists for Current/Bigger/Massive
2. ocean-only prepared chunk causes zero near terrain generation
3. land-only chunk resolves LAND for both physical and render ownership
4. ocean-only chunk resolves OCEAN for both physical and render ownership
5. mixed shoreline ownership agrees between land and ocean consumers
6. ocean renderer excludes authoritative land
7. land renderer excludes authoritative ocean
8. normal prepared traversal reports zero runtime topology builds
9. visual dirt readiness no longer blocks actor movement
10. genuine collision still blocks movement
11. Current/Bigger/Massive preserve the same canonical source identity
12. fixed ramps remain stable
13. prepared chunk cache remains bounded
14. old legacy runtime-build path cannot activate silently in production
15. runtime inspector exposes active ownership/profile/chunk source
16. cleanup/dispose releases prepared GPU resources correctly
17. scale switch selects the correct prepared ownership/chunk asset
18. no surface coordinate can be simultaneously authoritative land and ocean

---

# 20. Implementation order

1. Inspect current branch and existing occupancy patch.
2. Record current prepared asset format and runtime chunk-generation path.
3. Define persisted ownership/occupancy representation.
4. Extend compilation to emit it for Current/Bigger/Massive.
5. Extend storage/manifest/schema/loaders.
6. Add prepared near-surface representation.
7. Change runtime scheduler from generator to prepared-chunk loader/cache.
8. Make ocean consume the same ownership source.
9. Remove visual-readiness movement blocking.
10. Add/extend existing inspection counters.
11. Add tests.
12. Run `npm test`.
13. Run `npm run build`.
14. Report any browser validation limitations honestly.
15. Open a draft PR for review.
16. Do not merge.

---

# 21. Non-goals

Do not:

- redesign the motion-profile system
- redesign cameras
- redesign islands
- add forests, weather, gradients, black outlines, or decorative biomes
- implement full driving/suspension
- rewrite the dirt API
- introduce another debugger
- add native/C++/WASM requirements
- build one giant always-resident world mesh
- change the creator's canonical 500×500 source model
- silently change ramp geometry
- merge without approval

---

# 22. Acceptance statement

This task is complete when the prepared production worlds behave like compiled world assets rather than live terrain generators.

The desired runtime model is:

```text
500×500 canonical world
        ↓
ÆXIS compiler
        ↓
Current / Bigger / Massive prepared assets
        ↓
surface ownership + elevation + tones + ramps + prepared chunks
        ↓
runtime loads / caches / draws
```

and not:

```text
player movement
        ↓
terrain sampling
        ↓
terrain triangulation
        ↓
terrain generation
```

The surface rule must be absolute:

> **Where ÆXIS says LAND, ocean is not permitted to exist.**

> **Where ÆXIS says OCEAN, land is not permitted to exist.**

And the runtime rule must be equally clear:

> **Simulation uses authoritative prepared world data. Rendering may follow it, but rendering readiness does not own movement permission.**

This is the next step toward the intended identity of The World's ÆXIS:

> **ÆXIS compiles worlds; the runtime experiences them.**
