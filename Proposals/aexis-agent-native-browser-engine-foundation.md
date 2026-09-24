# ÆXIS: the agent-native browser game engine foundation

**Status:** Architecture and Codex implementation proposal; the general engine is not shipped. **Initial home:** Tiled-223D standalone browser world. Related: [current API](../docs/WORLD_API_V1.md), [handoff](../docs/CODEX_HANDOFF.md), [agent-world brief](../docs/AGENT_WORLD_API_HANDOFF.md), [Tiled/Blender/Godot bridge](aexis-tiled-blender-godot-agent-bridge.md), [expansive-world vision](aexis-agentic-book-to-expansive-world.md). This is a proposed browser engine, with Godot as a future interchange target, not a claim that Godot is already integrated.

## Product promise

ÆXIS should make worlds and games understandable and editable to the person making them, an exacting programmer and an authorized agent. A creator might begin with a Tiled map, Blender asset, drawing, picture, paragraph or, eventually, a hundred-page book and ask for a world that resembles their vision closely. An agent can propose geography, places, people, asset placement and eventually voices, dialogue, behaviors and mannerisms while the creator corrects what matters. Its success is measured by what survives those corrections, what can be inspected and reused, and how readily a game can be built on top of it. Book interpretation, generated people, speech and behavior are long-term research and integration work, not present capabilities.

The design aim is an elegant, efficient browser game engine that lets creators play and ship in the browser and allows many styles of game and new media to share world truth. Do not claim literal support for every future game. Keep the core small and stable, with versioned extensions and adapters so new forms can grow without rewriting the meaning of position, identity, action or authorship. Respect creator ownership, local-first operation, the 4 GB Windows target and optional computation for costly generation.

## Present footing and real gaps

Today the browser viewer flies over a Tiled-derived 2D terrain plus numeric elevation, with visual curvature separated from flat wrapped navigation and an optional ship GLB. The low-ground insertion path uses a Tiled `Additions` layer and preserves existing supplied heights. The world API v1 has one versioned region core, independent programmer and agent surfaces, bounded inspection, deterministic plans for one to three rectangular regions, an SVG footprint preview, atomic commit, sparse same-ID patches, locks, permissions, undo and ordinary Tiled JSON export. The desktop Qt host is an experimental selected-map watcher; native Tiled embedding is a placeholder. The Tiled `.sworld.json` exporter still lacks a verified full importer/round trip. The API does not yet model arbitrary entities, time, actions, asset surfaces, behaviors, Godot output, image or book understanding. Preserve v1 behavior while evolving it; no silent file-format rewrite.

## One truth, specialized surfaces

Make a versioned project record with stable `worldId`, object and component IDs, revision and provenance. Its smallest dependable concepts are **spaces** (with topology, units, transforms and extent), **entities** (identity), **components** (terrain, renderable, body, semantic part, audio source, behavior, camera, light), **relationships** (contains, attached to, adjacent, supports, owns, interacts), **events and actions** (what happens, when, by whom), **constraints** (permissions, collision, locks, budgets), and **time** (clock, ordered changes and animation state). Define a small semantic vocabulary and permit namespaced extension components. Unknown extensions survive round trips and are marked unsupported at a consumer; do not silently reinterpret them.

Authoritative positions, heights, contacts, ownership, action targets and history never come from pixels or a shader. Coordinate adapters declare handedness, axes, units and local/world transforms. Flat wrap, spherical navigation and nested spaces are distinct topology implementations; a curved artistic render does not change pathfinding or collision. The Tiled map, 3D renderer, Toonworld cartoon perspective, Godot scene and future medium are **projections or adapters** over the same canonical identity and accepted world changes. They need not contain identical pixels or runtime features; document what each representation preserves and what it cannot express.

Separate four entry points over the same validation and transaction core:

| Entry point | What it needs |
| --- | --- |
| Creator UI | Select, drag, label, preview, compare, accept, undo; show the exact object and value that changed. |
| Programmer API | Typed exact geometry, components, events, batch operations, stable serialization, predictable errors and transactional edits independent of any model. |
| Agent API | Bounded semantic inspection, capability discovery, structured intent, proposed operations, provenance, uncertainty, diagnostics, cost estimates and preview before commit. No requirement to manipulate editor pixels. |
| Adapters | Tiled terrain and layers, Blender/glTF meshes and animation, eventual Godot scenes and other media, each with import/export manifests and conflict reports. |

An agent and programmer must be able to perform equivalent accepted edits without separate hidden rules. Different surfaces may offer different convenience operations; a capability advertises what is actually implemented and the exact schema it accepts. No agent model is required to play, render, validate or run programmer scripts. Agents never acquire broader project or network permissions merely by reading a scene.

## The inspectable footholds Codex should build toward

1. **Capabilities manifest:** `project.inspectCapabilities` reports schema version, supported operation types, terrain/material vocabulary, topology, supported adapters and limitations, coordinate conventions, grants and resource budgets. Capability discovery should distinguish `implemented`, `experimental` and `proposed` in docs; the machine-readable runtime response lists only callable operations. Supply compact JSON schemas and runnable examples instead of prose-only affordances.
2. **Scoped queries:** `space.inspect`, `region.inspect`, `entity.inspect`, `component.inspect`, `relation.query`, `asset.inspectParts`, `action.inspect` and `event.inspect` return stable IDs, semantic labels, source/provenance, confidence, dependencies, revisions and bounded/paginated results. A caller can ask which ground surface supports an object, which drawing polygon is a hand, what a move is allowed to hit and what changed since revision N. Unknown stays unknown.
3. **Plan and apply:** `world.plan` produces a typed graph of operations and preconditions, affected IDs/cells, required grants, seed, warnings, approximate performance cost and alternative repairs. `world.preview` returns a non-mutating diff and optional cheap visual. `world.commit` validates *every* operation at commit time, including hand-built requests; either all changes persist or none do. Revision conflicts and undo are explicit. Reuse v1's protected base/locked-region/sparse-patch semantics rather than weakening them.
4. **Spatial diagnostics:** Provide an opt-in explanation of authoritative vs rendered coordinates, chosen projection, topology/wrap distance, surface normal, occlusion order, collision/contact and why placement or action failed. Keep ordinary mode cheap, debug bounded and deep debug opt-in. Diagnostics refer to the same operation and entity IDs that UI and API expose.
5. **Asset and character meaning:** Define contact surfaces and anchors (`base`, `entrance`, `grip`, `gaze`, etc.), selected mesh parts or drawn polygons, asset hashes and licenses, adjustable rigs and camera-specific 2D views. The first marker may be a simple quad or point; detailed polygon/volume binding and Toonworld learning come later. A changed mesh or drawing must either keep a verified binding or produce an actionable rebind conflict.
6. **Time and behavior:** Future actions declare inputs, preconditions, effects, contacts, timing, authority and event outputs. Gameplay scripts can invoke them exactly; an agent can inspect and propose them; models may author dialogue or style without overriding deterministic validation. Speech generation, personality and mannerism models are optional, authorized services with provenance, fallbacks and separately recorded licenses.

Illustrative shape, **not an implemented API**:

```json
{
  "schemaVersion": 2,
  "projectId": "my-world",
  "expectedRevision": 7,
  "actor": "creator-agent",
  "operationId": "place-watchtower-12",
  "operations": [{
    "type": "entity.place",
    "entityId": "watchtower-12",
    "assetId": "watchtower-model",
    "supportSurfaceId": "cliff-top-4",
    "anchorId": "base",
    "facing": {"towardEntityId": "road-west"}
  }]
}
```

The response must identify the resolved transform, supported component versions, contact/collision result, authored cells at risk, affected IDs and proposed diff, or report a precise error with a repair option. It cannot assume `entity.place` exists in v1.

## First Codex assignment: prove the foundation without pretending to finish an engine

Work on a new branch based on the latest world API branch; avoid landing speculative schema changes directly on an unrelated PR. Read `AGENTS.md`, `docs/CODEX_HANDOFF.md`, `docs/WORLD_API_V1.md`, this proposal and the related asset proposal. Keep the browser viewer and existing API intact. First produce a **small v1-compatible inspection extension**: one runtime capability manifest and one bounded region/operation inspection response that explicitly reports supported terrain, coordinate/topology conventions, permission requirement, protected/locked status and known limits. Add one structured placement-surface **fixture** that references an existing region and exposes stable ID, bounds, height/normal and a `supportsObject` diagnostic; do not claim arbitrary GLB placement or modify source maps. Prefer a JSON schema plus library/CLI example if it can reuse existing project IO. Keep the manifest truthful; experimental and future operations belong in docs, not callable capability lists.

Tests should show the programmer and agent views return the same IDs and surface facts; a locked or protected placement reports why it fails; queries remain bounded; repeated inspection does not change the revision or log; a failed hand-built mutation stays atomic; serialized output reopens without losing identity. Run `npm test`, `npm run build` and the existing 500 × 500 CLI smoke flow. Document actual results and clearly state which parts remain only a fixture. Only after this slice passes should Codex propose the next implementation for generalized entities, asset part bindings and time/action contracts.

## Longer proof sequence

1. **Geography:** Multiple distinct Tiled regions on a sparse, expansive master world with implicit ocean, numeric elevation, seams, topology and exact reimport. The artist can move one landmass without rewriting the others.
2. **Objects:** Import a Blender GLB, label base and entrance, place it on a named surface; inspect, preview, commit, export/reimport, undo and rebind safely. Prove a Godot starter-scene handoff with explicit feature limits.
3. **Game actions:** One browser-playable interaction: a labeled hand grabs a labeled object with correct collision, event sequence and camera-aware layering, scripted before model-assisted variation.
4. **Multimodal creation:** A book plus images becomes cited, reviewable places, geography, characters and proposed speech/behaviors. Preserve uncertainty, references, licensing, exact artist corrections and stable world identities; test on a held-out authored brief before claiming fidelity.

For each slice report startup, plan/commit latency, peak JS/GPU memory and frame time on a 4 GB Windows target when available. Define measurable budgets from a real baseline. The long-term ambition is worlds entire; the quality bar is that a small creator or an expert programmer can always understand and reshape the result.
