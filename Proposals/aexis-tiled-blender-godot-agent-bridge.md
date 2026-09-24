# ÆXIS bridge: Tiled geography, Blender assets, agent semantics, Godot games

**Status:** Proposal, not a shipped integration. **Scope:** Tiled-223D's canonical world, APIs and standalone browser preview. Companion proposals belong in SUBSTRATE and FrameChute. Read [world API v1](../docs/WORLD_API_V1.md), [the world handoff](../docs/CODEX_HANDOFF.md) and [the expansive-world vision](aexis-agentic-book-to-expansive-world.md) for the current limits and longer goal.

## Promise and communities

Bring a Tiled map or several small maps, or begin with a description, book, images and an empty world. Bring existing Blender-made GLBs, or add assets later. ÆXIS should turn these inputs into one versioned, editable world with an intelligible 2D map, traversable 3D preview and semantic objects. A creator can use the UI; a programmer can call precise operations; any suitably equipped agent can inspect capabilities and propose the same changes. The first creative communities are Tiled map makers and Blender asset makers. Godot is the first proposed game-engine handoff after those workflows prove reliable, not a replacement for ÆXIS's browser viewer.

> The goal is enough semantic, logical and mathematical footholds that an agent can use the world's existing maps and assets, add new ones, and assemble a game more easily than it could by guessing everything from screenshots and prompts alone. The creator should be able to correct every proposal and keep what they have authored.

## How the current workflow actually works

The standalone Vite/Three.js viewer accepts ordinary Tiled JSON with terrain semantics and numeric elevation, and has a procedural sample world with wrap, ocean, flight and an optional ship GLB. A separate Tiled exporter emits `.sworld.json`, but its output is not yet a fully aligned viewer-import contract. A narrow low-ground insertion script recognizes a starter `Additions` layer, preserves supplied prior elevation and generates a low connected coastline. World API v1 separately offers programmer cell/region edits and agent intent plans for two or three rectangular terrain regions, with previews, protections, atomic commit, undo and Tiled JSON export. Those are related building blocks, **not yet one seamless multi-map import, asset-labeling, or engine-export workflow**.

The first useful unified path is: import existing Tiled terrain and elevation; inspect differences and protected authored cells; propose a new or changed region; preview; apply through the shared world core; render nearby terrain in the browser; edit in Tiled and reimport supported changes with clear conflicts. A later path accepts sparse local maps on an expansive master extent with implicit ocean instead of allocating ocean tiles for every unit of distance. Preserve local landmass scale, stable identities and real wrapped distances independently of curved visual presentation.

## Asset semantics: a Blender-friendly entrance

The Blender artist keeps making and revising their model in Blender. ÆXIS imports a GLB and shows it beside its 2D footprint and the world surface on which it may stand. A small visual labeling interface lets a creator mark `base`, `front`, `roof`, `door`, `walkable top`, `collision`, `attachment point` or other project-defined roles on the whole object, a point or a selected region. Start with quads and simple named mesh parts or local surface patches; later allow precise faces, polygon sets and volumetric segmentation. A labeled quad is a selected surface region, not a requirement that every source mesh be remodeled as quads.

Store a versioned sidecar semantic record keyed to a source asset hash and durable node/region IDs; use glTF metadata where it round-trips reliably, without relying on engine-specific interpretation of arbitrary `extras`. Keep coordinate frame, units, transform, footprint, oriented bounds, surface normal, local anchor, clearance, contact rules and source/confidence for inferred labels. If a Blender export changes topology or names, reconcile anchors explicitly and show unresolved bindings; never silently relabel a different face as the door. The agent may inspect and suggest labels, but corrections become authoritative. Offer a sensible whole-model default even if no face is labeled yet.

An agent can now ask: find ground with a compatible normal and footprint, place this asset with its base on that surface, face its entrance toward the road, keep its doorway clear and do not overwrite the coast. The same contract can eventually drive buildings, props, ships, characters, motion sockets and attached effects. Placement checks must use world coordinates and collision truth rather than screen-space or aesthetic curvature.

## Agent and Godot contracts

### Toonworld: flat artwork with a spatial rig

An artist may bring a flat character drawing, layered 2D artwork or a sprite rather than a sculpted GLB. Display it as a thin paper-like figure facing the chosen camera or constrained by an authored facing rule. Give it an editable rig underneath: named joints, handles, pivots, hit regions and depth anchors bound to recognizable art regions. Dragging the visible hand, jaw, eye or torso moves the appropriate control; the artist can adjust the binding instead of manipulating invisible bones by guesswork. The art can bend, swap frames, stretch and animate while retaining its intended drawn look.

For moments when Toonworld leaks into the 3D world, selected animated art or rig-linked pieces can protrude in depth: an arm reaches out of the plane, an eye bulges or a jaw moves forward. Define which region can protrude, its depth limits, layer order, collision behavior and return pose. The rest can stay flat. Asset-part labels and surface/point anchors should serve this 2D/3D hybrid too; do not assume every semantic asset is a closed 3D mesh. This is a proposed artist workflow requiring a small rigged example and visual validation, not a current animation feature.

Expose discoverable versioned operations for world/region/asset inspection, reference provenance, semantic surface queries, constraints, plan, preview, commit and undo. A plan contains exact stable IDs, expected revision, source attribution, seed, coordinate transforms, intended edits, diagnostics and rough cost; both programmer and agent operations pass commit-time validation of locks, permissions, protected cells, overlap and asset binding. The AI can do repetitive assembly while the artist moves a continent, repaints terrain or changes the labeled base and regenerates only affected results. The model is an optional planning tool; rendering and gameplay do not need a per-frame LLM call.

The eventual Godot adapter should export or import: a terrain/height representation, placed GLB scene instances, collision/placement proxies, metadata for named surfaces and anchors, stable IDs, and a manifest of units, source files and supported semantics. Run a reproducible Godot starter-scene smoke test. Ordinary Tiled JSON and glTF do not automatically preserve every ÆXIS rule in Godot; declare supported subsets and retain an ÆXIS sidecar where needed. Godot owns game rules, runtime scenes and scripting. ÆXIS provides a legible world and placement operations so an agent can implement gameplay against actual structure instead of reverse-engineering an image.

## Delivery proof

1. Round-trip one Tiled region and numeric elevation into the authoritative world without losing prior authored cells, and show a browser preview.
2. Import one Blender GLB, label its base, entrance and one attachment point with the simplest quad/part UI, save and reload, and place it against an object-ready ground surface with a matching Tiled marker and canonical instance ID.
3. Let an agent inspect the same data, propose a different valid placement, preview a failed placement with a reason, and commit a valid one through the same permissions and revision checks.
4. Reexport the GLB from Blender with a changed mesh and demonstrate resolved versus unresolved bindings, without corrupting accepted labels.
5. Bring the accepted scene into a Godot starter project with correct location, scale, facing, ground contact, metadata and collision; show explicit limits rather than claiming a complete game export.

Measure load time, frame time, peak JS/GPU memory and preview latency on the 4 GB Windows target. This bridge does not yet generate finished game logic, infer complete books, solve arbitrary topology or replace Blender, Tiled or Godot. It creates a reliable path through which future agents and creators can build those richer worlds.
