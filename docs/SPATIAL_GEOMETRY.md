# Spatial geometry v1 — an agent-readable archipelago

The starter world uses **one main floating island and two nearby satellites**. Their canonical definitions live in [src/worlds/floating-islands.json](../src/worlds/floating-islands.json); Three.js translates those records into actual low-poly colored geometry using [src/floating-islands.js](../src/floating-islands.js). The 2D terrain and ocean remain unchanged beneath the islands.

## Minimal vocabulary

- `id`: stable name; `parent`: semantic owner, not necessarily physical containment. An island belongs to a cluster, parts belong to an island. Parent moves preserve each child's local coordinates.
- `at: [x,y,z]`: parent position in the world (X/Z horizontal, Y altitude).
- `parts[]`: independently identified material volumes.
- `height: [bottom,top]`: local **Y** range relative to the island parent, not a global limit or discrete height preset. Ends use world units and must be finite; values are not limited to 0–4.
- `footprint: {type:"ellipse", radii:[rx,rz],segments:24}`: the part's top-down shape relative to the parent; only that footprint between the height boundaries is solid.
- `material`: stone, clay, dirt or grass; the renderer maps it to a lightweight colored surface. New materials can be registered later.
- `openings[]`: absent/empty means none. Each `at:[x,z]` and `radii:[rx,rz]` removes a vertical passage from the part's solid volume for the specified local `height` range. Outside declared material volumes is **empty space**, not an invisible solid block.
- `walkable:true`: top surface is eligible for a future grounded character/landing controller. Current prototype offers ship contact rejection and coarse collision, NOT a full walkable RPG implementation.
- Semantic child identity does not imply that every visitor/ship moves along with its parent. A future `attachedTo` relation will distinguish occupants/attachments from simple proximity.

## Tiny example

```json
{
  "id": "island_A",
  "parent": "sky_archipelago",
  "type": "floating_island",
  "at": [145, 47, 279],
  "parts": [
    {
      "id": "island_A.stone",
      "parent": "island_A",
      "height": [0, 9],
      "material": "stone",
      "footprint": {"type": "ellipse", "radii": [8.3, 7.4], "segments": 24},
      "openings": [
        {"id": "island_A.shaft", "at": [2, -1], "radii": [1.5, 1.5], "height": [0, 21]}
      ]
    }
  ]
}
```

The entire `island_A` example is anchored at world (145,47,279). Its stone extends from Y=47 to Y=56. The opening removes stone at local X/Z (2,-1) over the stated vertical interval. In the committed full example, the same shaft is subtracted from all four stacked layers, producing a through-hole. Moving `island_A.at` moves **all parts and their holes** without editing child geometry. Islands B and C have distinct altitude, footprints, and materials.

## Current rendering and collision

The renderer converts each named part into one cheap polygonal extruded mesh; each island has one parent Group. Its footprint is elliptical now, but the schema can extend to polygons/masks, irregular cutouts, authored GLBs and multi-height pieces. `src/spatial.js` provides a coarse geometric hit test for flights through, under or over these volumes. Shapes and collisions are approximate, not yet a complete mesh-accurate physics or loading/streaming engine.

The island group is shifted to the nearest **rendered repetition** of the 500×500 world for wraparound flight. Only one semantic object exists in world data. The sphere ship can pass beneath a sufficiently elevated island and through its main opening, subject to the simplified hit test.

## Future 2D/2.5D RPG occlusion: IMPORTANT

When an RPG character **walks beneath** a floating island, they should naturally **disappear from view behind the island's top-down sprite/foreground mask** wherever it covers them from that camera angle; they **reappear** in uncovered regions and openings. Keep the character's canonical position, motion and collision running while hidden. This is a **depth/occlusion rule**, not a teleport, despawn, deletion or universal rule to hide everyone at a lower altitude. A hole in the island's footprint must remain see-through. The 2D image and optional GLB will share the island's ID, footprint, height ranges and chosen draw layer. This behavior is a **future feature**, not presently implemented for 2D characters.

## Agent instructions

An agent should reference semantic IDs, e.g. "Move `island_A` up by 30" changes only its `at[1]` value. "Add a house to the main island" creates a house with `parent:"island_A"` and a local anchor; it must not embed the house in one anonymous vertex buffer. Do not infer ownership from geometric overlap. Nested identity can grow to world → island → mountain → house → room. Future `supportedBy`, `attachedTo` and `inside` relationships should be explicitly differentiated from `parent`.

The ocean's horizon does not become the island's bottom; the floating objects are positioned **above** the existing world and ocean. Water never automatically fills the empty space below an island.
