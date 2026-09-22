# Tiled-223D

A lightweight, agent-readable bridge from Tiled maps to a simple 3D landing surface for SUBSTRATE.

## First test map

- `maps/test-world.tmx`: editable 30 × 20 orthogonal Tiled map, using 32 × 32 pixels per tile, with a complete grass ground and central `LandingPoint`.
- `maps/test-world.json`: matching Tiled-style JSON map for a TypeScript converter.
- `tilesets/grass.png`: original 32 × 32 pixel grass tile (included with this starter project).

Open `maps/test-world.tmx` in Tiled. The image path is relative to the map, so keep the folders together. This is an **example map**, not a replacement for any unsaved map you already have open in Tiled.

## World conversion contract (v0)

Read the `Ground` tile layer, treat one tile as one world unit, put the landing surface in the XZ plane with +Y up, and map map-cell `(column,row)` to world position `(column,0,row)`. A nonzero tile ID is visible and walkable unless overridden by semantic tile metadata. Use `LandingPoint` from the `Spawns` object layer (in map pixels) to determine the initial location, converting pixels to world units by dividing by 32. Preserve tile IDs and layer/object IDs in the semantic world representation.

Next milestone: a TypeScript converter and low-poly 3D preview with textured ground, correct collision, and a descent landing marker. This repository does not yet contain that runtime.

## Design principles

The semantic world is authoritative. Renderer meshes and collision proxies are generated representations. Start with batched low-poly ground and simple collision, and progressively add heights, walls, materials, surface interactions, and agent-friendly named regions.
