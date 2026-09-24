# Codex task: unified agent-native world API diagnostics

**Repository:** `thanks-cohn/Tiled-223D`  
**Working branch:** `codex/agent-native-debug-contract-v1` (based on current `main`)  
**Scope:** one reviewable world API and debugging contract PR; do not merge it.

Read `AGENTS.md`, `docs/CODEX_HANDOFF.md`, `docs/AGENT_WORLD_API_HANDOFF.md`, `docs/WORLD_API_V1.md`, `Desktop/App/README.md`, and the implemented world API and CLI before changing code. Reproduce the existing CLI behavior. Preserve the browser-first, optional-desktop, roughly 4 GB target. Keep this task limited to capabilities, inspection, diagnostics, types, CLI integration, documentation, and tests.

## Why this slice exists

ÆXIS should be legible to programmers and agents from the ground up. An authorized agent should discover what the engine actually supports, inspect the semantic facts behind a world edit, and understand exactly why a proposed edit failed. A programmer should see the same facts through a practical regular debug view. Deep debug should provide a bounded account of authoritative decisions when the shorter explanation is insufficient.

World API v1 already has shared terrain semantics, revisions, grants, protected cells, region ownership, sparse write masks, atomic commit/undo, Tiled JSON export, and newer paged inspection methods. Those are the starting point, not proof of a complete agent integration. The legacy `AgentWorldApi.inspect()` and `ProgrammerWorldApi.inspectMap()` must be audited for actor/grant enforcement and response budgets. Several inspection declarations use `object` rather than precise types. The computed placement-surface fixture remains diagnostic-only. The desktop `--debug` dock has its own JSON-lines events and is optional; inspect its format before choosing an adapter. Do not claim a unified runtime trace already exists.

## One contract, several views

Create **one versioned diagnostic event/API contract** in the shared world core. Regular debug and opt-in deep debug are *views of the same authoritative decisions*, not separately maintained validators. The agent JS API, programmer JS API, and world API CLI must produce/consume that contract. Define stable structured output that a later browser developer panel, desktop debug dock, local tool adapter, or MCP tool can consume. Treat those integrations as adapters: do not rewrite unrelated renderer debugging or make Qt a dependency of Node tests. Existing desktop events may be mapped to this envelope if practical and low-risk; otherwise document the exact adapter boundary and avoid claiming desktop integration was completed.

A normal failure response remains compact and actionable. Regular debug adds its relevant code, human explanation, affected region/cell and revision, and a repair hint when possible. Deep debug adds an ordered, bounded trace of decisions actually taken by the validation path. Ensure stable codes and order where possible; avoid tracing unrelated cells or generating full-map dumps. Prefer a per-request diagnostic setting, for example `off | regular | deep`, carried through the same explicit envelope or options on JS and CLI. Decide whether an additional debug grant is needed for detailed traces; if so, make it discoverable, enforce it at the boundary, and test it. Merely setting a CLI flag must never elevate an actor's permissions. Redact unrelated local paths and secrets. Neither debug level may change edit outcomes, revisions, files, or the operation log; normal execution must not pay for deep trace capture.

Specify the record's `schemaVersion`, `code`, `severity`, message, phase, operation ID, project/revision context, affected stable IDs and coordinates if available, suggested repair, and optional trace steps. Keep valid responses small with fixed budgets for trace steps, text, and records; expose truncation explicitly. Reuse current `ERROR_CODES` and response shapes where possible; document and test any compatibility change.

Trace, where relevant, the actual grant decision, revision check, bounds, protected authored base, other-region ownership, region lock, sparse write mask, and transaction failure. A protected or different-owner cell merely inside the bounding rectangle of a sparse patch must not be reported as a write. A same-ID sparse patch must continue to preserve all earlier owned cells and metadata. Failed operations must still leave project, revision, files, and log untouched. Successful commit/undo should have compact, structured outcomes where useful, without turning every tile into an event.

## Inspection and discoverability

1. Audit **every** existing read path, including legacy `AgentWorldApi.inspect()`, `ProgrammerWorldApi.inspectMap()`, CLI `inspect`, and new shared inspection methods. Require an explicit actor and inspect grant for project-scoped data. Choose a clear migration for existing callers; update them and tests. Limit map reads with a fixed implementation cap (currently 4,096 cells) independent of a caller-provided `limit`. Bound list/page sizes before expensive cloning; reject or page oversized requests. Inspection and preview must not mutate authoritative state.

2. Publish precise TypeScript request/response types and versioned machine-readable JSON schemas for implemented inspection calls, diagnostic records, operation envelopes, and capability data where missing. Validate externally supplied CLI requests and return stable coded errors. The capability manifest must describe only implemented callable operations, required grants, input/output schema IDs, response budgets, and limitations. Clearly mark the placement surface as a computed inspection fixture, not a persistent support surface or `entity.place`.

3. Add one bounded read-only cell/region explanation query (or a comparably small inspection surface): numeric terrain ID and semantic name, numeric elevation, base protection, current owning region and lock, relevant provenance, and whether this actor could *propose* a write there. Distinguish authored base facts from projected values. Make the reason for denial machine-readable. State that this is a snapshot: commit remains the authority after revision and concurrent-state checks. Share the query between programmer and agent APIs and expose it to the CLI.

4. Document how an external agent can discover capabilities, call read-only queries, draft/preview, commit, inspect outcomes, and recover from conflicts without automating UI clicks. The CLI and library are the supported local transports for this slice. Do not claim that a ChatGPT-native, MCP, desktop IPC, or general asset/GLB bridge has shipped.

## Acceptance and proof

- Actor without inspect permission cannot read via any old or new inspection path, including CLI. Allowed actors can inspect bounded semantic data. An oversized `inspectMap` request is refused even if it supplies a larger limit. Inputs outside the map are rejected with stable codes.
- One protected-cell failure, one locked-region failure, one other-region-ownership failure, and one revision conflict yield matching core codes and relevant facts through the programmer API, agent API where applicable, and CLI. Regular and deep views agree on the decision; the deep view explains *the same* decision and is ordered, bounded, and opt-in.
- A sparse patch spanning a protected or separately owned middle cell leaves it untouched; a same-ID patch preserves all previously owned untouched cells, heights, provenance and ID, including after export/reload/undo. The trace does not claim to write masked-out cells.
- Read-only calls and both debug views preserve state. Failed multi-operation transactions leave project, revision, file outputs, and operation log unchanged; no partial commit.
- Include at least one runnable JS example and matching CLI commands with sample regular/deep diagnostic JSON. Test schema/type contracts where meaningful; avoid tests that merely mirror implementation.
- Run `npm test`, `npm run build`, and the documented 500 × 500 CLI smoke flow; report actual commands/results. If desktop integration is not changed, say so. Update `docs/WORLD_API_V1.md`, `docs/CODEX_HANDOFF.md`, and any affected CLI help/readme.

Push work to `codex/agent-native-debug-contract-v1` and open **one PR targeting `main`**. Do not merge it. In the PR description list exactly what programmer and agent access is available, how regular and deep debug relate to the common event schema, the limits on inspection/trace output, any migration to actor-scoped reads, and what remains future work.
