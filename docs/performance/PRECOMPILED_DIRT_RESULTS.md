# Precompiled dirt verification (2026-09-25)

Base: `fafecb4`, latest fetched `codex/expansive-dirt-continent-v2` at task start. Ancestors include PR #31 (`cfabb64`), island fix `9b76e68` and camera fix `6068966`.

Baseline: 111/111 tests passed; Vite production build passed (existing >500 kB bundle warning). On this Linux container, the original Massive viewer's 9,409-point near sampling pass took 443.75, 440.92 and 446.10 ms. This measures CPU sampling only, not mesh allocation, normals, browser frames or GPU work.

Creator's separate Windows capture remains the target-device baseline: 141,736 ms, 1,122 frames, 42 gaps >100 ms, 40 terrain rebuilds totaling 68,603 ms, worst rebuild 7,473 ms, average CPU render submission 2.04 ms. The separate 15.1-second gap has no established terrain cause.

The live baseline uses 37 ramps from the legacy viewer's probabilities (10%/9%/30%) and 1.3 height variation, whereas the API's default recipe uses 5%/3%/10% and 1.25. This change saves and preserves the actual viewer production; it does not reroll ramps to repair that pre-existing discrepancy. Browser API state now starts from that saved production. A creator can explicitly preview and commit different probabilities.

Browser validation: Chromium is not installed. Playwright installation failed repeatedly with a truncated/invalid archive from the browser download host. No WebGL screenshots, GPU timings or 4 GB Windows results are claimed. Acceptance on target hardware remains pending.
