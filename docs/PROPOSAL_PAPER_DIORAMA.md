# Proposal: Geometry-faithful paper diorama rendering

Status: proposal, not a shipped render mode. Related: `docs/SPATIAL_GEOMETRY.md` (canonical 3D geometry and parent identity).

## Vision
A creator can build or import a 3D island, house, mountain, or other structure and ask the engine to render it as a stylized **paper-diorama / pop-up-book object**. The resulting 2D/2.5D card is *derived from the source geometry*: its outline, contours, holes, surface regions, and approximate visible depth should remain recognizable. As a player approaches, a distant dark silhouette can become a stylized multi-layer card, then full 3D geometry when needed for landing or interaction. A creator may also deliberately keep the paper style at close range.

This is not just mapping the model's photo onto a rectangle: preserve its geometry-linked identity and the distinction between its *appearance proxy* and its authoritative 3D collision/surface model. A paper sprite must never replace actual dockability, pathfinding, or collision truth.

## Lightweight first implementation — no machine learning required
1. Render the source low-poly mesh offscreen from a small set of fixed horizontal viewing angles (e.g. 4 or 8), with transparency. Capture a *color/albedo image*, an *opaque silhouette/alpha mask*, and optionally a small *depth map*, *normal map*, *object-ID mask*, and edge/contour mask.
2. Extract contours deterministically from depth and surface normals; honor actual holes when visible from the selected angle. Separate authored semantic materials (grass, dirt, clay, stone) using the existing part IDs.
3. Transform the image(s) into selectable paper styles: hard ink-like outlines, cut-paper color blocks, pixel/dither look, gentle drop shadows and limited-layer depth/parallax. Quantize and simplify **appearance**, not canonical 3D geometry or collision data.
4. Render as a billboard for the absolute cheapest case. Angle-selecting impostors (4–8 views) or several shallow depth-separated cutout planes are optional upgrades. Keep the object's ground anchor and apparent scale stable when switching representation. A single always-facing image is not view-correct from every direction; select the nearest angle when that mismatch becomes noticeable.
5. Level of detail: far = geometry-faithful dark/tinted silhouette; middle = stylized paper image/card(s); near = low-poly 3D or optional persistent paper style. Crossfade/dither with hysteresis to avoid popping and oscillation. Do not recompute all views every frame: cache by `objectId + geometryVersion + styleId + viewAngle`.
6. Generate captures when the model is imported/edited, or on demand on a stronger computer. Ship only the low-resolution cached images needed for the chosen quality. Motion of a parent cluster should simply transform its cards at runtime, not require rerendering the object's source mesh.

## Future optional learned stylizer
Explore a **trained model** that maps (color render + silhouette + depth + normals + contours + semantic part masks) to a chosen paper/pixel/diorama treatment, with geometry-consistency constraints across neighboring viewpoints. The system should aim to retain the object's outer contours, genuine openings, semantic material boundaries, and readable approximate depth. Use a deterministic model-independent rendering path first and always provide it as a fallback.

A learned image stylizer can hallucinate edges, invent holes, or change geometry between angles. Treat generated imagery as visual only. Evaluate against ground-truth silhouette/edge/depth masks and test multi-view consistency; do not infer collision or docking from its pixels. Training requires appropriate rights to source images/models and a curated dataset; it is an optional later enhancement, not a requirement for the low-memory prototype.

## Data sketch (future schema, not currently parsed)
```json
{
  "id": "island_A",
  "representation": {
    "mode": "auto",
    "paperStyle": "ink-cutout",
    "far": {"kind": "silhouette", "maxTexture": 128},
    "mid": {"kind": "angle-impostor", "views": 8, "maxTexture": 256, "depthLayers": 2},
    "near": {"kind": "mesh", "allowPaperOverride": true},
    "source": "canonical-geometry",
    "collisionSource": "canonical-geometry"
  }
}
```

## Acceptance goal
A three-material floating island can be viewed and circled from the flight world: it remains recognizable in all distance bands; its projected edges and a visible opening follow the actual model; distant paper cards are visibly cheap yet deliberate; moving the island's parent moves all representations; flight/docking collision always uses the real semantic/geometry model; and the feature remains usable with no AI service or training dependency.

## Addendum — A miniature landmark that opens into a colossal destination

Status: **future proposal, not implemented**. A distant paper-diorama card, silhouette, or miniature-looking 3D model may stand in for a **much larger linked structure**. On approach, let it grow naturally in the player's view and resolve into a detailed, navigable destination while the ship makes a slow cinematic descent. Towers, platforms, streets, courtyards, and openings should reveal themselves progressively rather than arriving in one abrupt scene switch. Creators may choose either a perspective/level-of-detail reveal of a structure that was always large, or an explicitly authored *actual expansion* animation; those are different behaviors and must not be conflated.

The original card/model is an appearance proxy linked by stable semantic ID and local-to-world transform to the destination's real geometry, tiled regions, entrances and collision. Transition from distant silhouette -> layered paper card / cheap shell -> nearby bounded 3D chunks, or stop at an authored 2D/2.5D local map if no complete 3D interior exists. Keep its apparent anchor aligned during crossfades, slow the descent for legible scale, and preserve safe player motion, entry and return points. An actual expansion must coherently update physical scale/collision only when explicitly enabled; mere camera zoom or proxy enlargement must not invent walkable geometry. Stream nearby details, cache derived paper captures, and unload far sections so low-memory devices do not pay for the entire interior.

See [Surface docking and cinematics — expandable landmark models](PROPOSAL_DOCKING_AND_CINEMATICS.md#addendum--expandable-landmark-models-and-slow-descent-into-immense-structures) for the creator workflow, optional real-scale transformation, return-state contract, and acceptance goal.
