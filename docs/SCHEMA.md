# SUBSTRATE terrain-v1 schema

Each tile is a semantic type, **not a color guess**. Stable identifiers: `grass`, `dirt`, `sand`, `ocean`, `river`, `lake`, `tree`.

## Coordinate and placement rules

- Orthogonal finite Tiled map, 32 × 32 image pixels per tile, one world unit per tile, +Y vertical in 3D.
- Tiled grid cell `(x,y)` maps to horizontal 3D world cell `(x,z=y)`, center `(x+0.5,0,y+0.5)`. A tree is centered above its ground cell.
- `Ground` is the terrain/water layer. `Structures` is an independent overlay of trees. `Spawns` contains `LandingPoint` in Tiled pixel coordinates; divide by 32 to get world X/Z.
- A water cell has physical material `water` with semantic `ocean`, `river` or `lake`; it is not a walkable landing surface. These are distinct visual modes, not a hydrological simulation.
- Tile GIDs 1–7 and `assets3d/<semantic>.gltf` are the stable starter mappings; do not infer semantics from an arbitrary PNG color. Tile metadata is the source of truth.
- Trees occupy `Structures` and block their own cell in the first version. Grass remains underneath. Trees are 3D props, not a second ground plane.
- Unknown tile semantic or misplaced structure must generate an explicit export error, not be silently converted to grass.

## Future-safe architecture

Visual tiles, GLBs, physics proxies and semantic records are different projections of one world. A future renderer may merge terrain meshes and use instanced tree GLBs, while retaining cell IDs and material/interaction metadata. Unknown imported tiles can later be assigned explicit semantic labels and new adapters; avoid making this first atlas a hard-coded ceiling.

## Prototype limits

The 3D assets are simple, original low-poly colored geometry: ground slabs for grass/dirt/sand, thin water slabs for ocean/river/lake and a trunk/canopy tree. No terrain elevations, real water physics, forest generation or runtime world switch is implemented yet. The Tiled plugin exports semantic records only.
