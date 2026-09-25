# Dirt runtime performance diagnostics — actual browser measurements

**Implemented in the browser viewer on this development branch.** This is the observed runtime collector, not the existing modeled-budget `dirt.inspectPerformance` operation in the standalone CLI. There is no running browser attached to the GitHub connector: measurements must be captured on the machine exhibiting the stutter. The profiler does not change the terrain math, island data, materials, camera settings, or collision.

## Record the exact 1–2 second stop

1. Open the ÆXIS browser demo from this branch, open DevTools Console (F12).
2. Enter `window.tiledWorldDirtApi.startPerformanceCapture()` (enables capture and resets counters).
3. Fly or drive through the dirt for 15–30 seconds so the freezes occur several times. Keep the tab in the foreground; switching tabs can cause unrelated frame gaps.
4. Enter `copy(JSON.stringify(window.tiledWorldDirtApi.stopPerformanceCapture(),null,2))` in Chromium DevTools and paste the copied JSON into Codex or ChatGPT. If `copy` is not available, run `console.log(JSON.stringify(window.tiledWorldDirtApi.stopPerformanceCapture(),null,2))` and copy the console output.
5. Alternatively query `window.tiledWorldDirtApi.execute({schemaVersion:"dirt-v1",operation:"dirt.inspectRuntimePerformance",actorId:"debugger",projectId:"demo-world",landmassId:"dirt-landmass-01",input:{}})`. This operation is explicitly **browser-runtime-only**; the standalone CLI cannot observe a user's browser and must not pretend to.

Inspect `events` in timestamp order. A `frame-gap` is the time between browser animation callbacks (over 100 ms); a `long-frame` means the instrumented JS frame took over 50 ms. A `terrain-mesh-build` contains the actual near/far surface build duration, number of sampled terrain points, triangle count, and bounded origin coordinate. Match near builds to the immediately surrounding long frames or frame gaps. If a 1–2 second freeze coincides with a near mesh build, it supports the terrain rebuild hypothesis. If not, collect a browser Performance timeline covering one freeze to locate additional CPU/GPU or GC work; the collector cannot identify unrelated tasks or measure GPU completion.

Known current hot path at time of instrumentation: `src/expansive-dirt-renderer.js` constructs a 97×97 near mesh upon 32-unit movement and recreates its geometry; `src/scale-world.js` evaluates canonical terrain, a route-interval mapping and ramp candidates per sampled vertex. At high speed this can recur at approximately the reported cadence. This is a **hypothesis until the captured JSON confirms it**. The 113×113 far mesh is also rebuilt when scale/terrain settings change. Future optimization candidates: precomputed reusable three-color base/material, low-cost far representation, spatial ramp indexing, cheap cached height/shade sampling, fixed near chunk tiles or mesh reuse, and asynchronous/incremental geometry upload. Preserve actual ramp height/contact authority and restored original islands.

## Fields and limitations

`frame.averageLoopMs` / `maxLoopMs` are main-thread loop times excluding time when the callback wasn't running. `frame.averageRenderMs` / `maxRenderMs` measure wall time from the render-phase entry through CPU render submission, **not actual GPU completion**. `frameGapsOver100Ms` counts pauses between animation callbacks; browser throttling or switching tabs can affect it. `terrain.meshBuilds`, `totalBuildMs`, `maxBuildMs`, `terrainSamples`, `meshVertices`, `meshTriangles` and `events` are observed counters/timestamps. `events` keeps at most 96 entries and `history` at most 240 records; this intentionally avoids unbounded logging on a 4 GB machine. This collector does not measure GPU memory, system RAM, GC root causes, asynchronous input scheduling or true wheel/vehicle driving physics.

The same collector is designed to remain available to authorized future agent adapters, but it is currently a local viewer diagnostic API only. Codex should use actual captures to decide which part of the renderer/math to optimize; avoid introducing another expensive continuous profiler or full-world map allocation.
