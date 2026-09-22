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
