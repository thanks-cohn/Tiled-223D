# Dirt API v1 schemas

The request envelope is machine-readable at `schemas/dirt-api-v1.schema.json` and precisely typed for JavaScript consumers at `src/dirt/api.d.ts`.

Every request uses `schemaVersion: "dirt-v1"`, an implemented `dirt.*` operation, `actorId`, and `projectId`. Landmass-scoped calls use `landmassId: "dirt-landmass-01"`. Writes additionally require `operationId` and `expectedRevision`. Operation parameters are held in `input` so future transports do not redefine semantics.

Success responses contain `status: "ok"`, `capabilityVersion`, `operation`, current `revision`, and a typed operation-specific `result`. Failures contain `status: "error"` and `error.code`/`error.message`, plus bounded relevant details where available. No failure mutates the revision.

Coordinate-bearing operations require an explicit space where ambiguity matters: `canonical`, `world`, `experience`, or `render-local`. The implemented route mapper accepts canonical and experience distances. General 2D mapping is not represented as supported.

Default grants are:

- `creator`: inspect, plan, commit, undo.
- `agent`: inspect and plan.
- `debugger`: inspect.

Applications may inject a different permission map into the core constructor. A browser global is a local demo adapter, not an authentication service.
