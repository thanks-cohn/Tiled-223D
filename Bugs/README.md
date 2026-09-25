# Bugs — Tiled-223D flight / world engine

This folder is the **active agent-facing bug registry** for Tiled-223D. Read alongside `Semantic-Bindings/` before making changes. A report is NOT a confirmed root cause; document reproductions, exact branch, evidence and whether a fix has been tested. Do not silently mark a report as fixed because a unit test passes. `main` remains unchanged by experimental V7/V8 fixes.

See [flight and scale bugs](flight-and-scale.md) and [atmosphere and release bugs](atmosphere-and-release.md).


## Active 2026-09-25 pre-merge camera and 2D island reports

Read [camera framing, settings and curvature-aware island impostor bugs](camera-and-curvature-impostor-2026-09-25.md) before merging cinematic-camera PR #28. It records the user's actual browser screenshots, observed main/preview framing failures, high-altitude 2D island-base orientation mismatch, confirmed source behavior versus unverified root causes, focused fixes and acceptance checks. The programmable 2D representation/altitude-band/Liquid proposals are future feature work, not falsely marked as implemented. Do not mark these issues verified fixed without an affected-browser check.

## Triage conventions

- `reported / unverified`: the user observed it, but we cannot consistently reproduce it or confirm the cause from code.
- `confirmed in code`: the relevant code path demonstrably has the stated behavior; device symptoms still require validation.
- `work in progress`: proposed or in-development changes exist but user confirmation / browser tests are missing.
- `verified fixed`: only after source changes, automated regression tests and an actual affected-use-case browser check.
- Preserve the user's global ship position on any graphics, LOD, collision or camera issue. A diagnostic must record the cause of `resetSpawn()`, not invoke it.

Keep a dated reproduction record, the branch/commit containing each attempted fix, expected/actual behavior and a reproducible verification checklist. Never turn unrelated antivirus or browser download concerns into advice to bypass security.
