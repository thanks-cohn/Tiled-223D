# Minimal visual-world assembly test: add a 50 × 50 map, generate low terrain

**Status:** First local/offline test implementation, not the full planned GLB/world editor.

**Terminology:** 500 × 500 and 50 × 50 here mean **Tiled cells**, not image pixels. At 32 image pixels per tile, a 500 × 500 tile map corresponds to 16,000 × 16,000 image pixels.

## Six steps

1. **Choose your big map.** If you already have your editable 500 × 500 Tiled map, use it and keep its **original elevation JSON**. If you want to recreate the current procedural two-island demo as a real editable map, run `node scripts/create-starter-map.mjs` from the project folder. This writes `generated/starter-500.json` and `generated/starter-elevation.json` without modifying any source files.
2. **Open two maps in Tiled:** the big 500 × 500 map and `maps/low-town-50x50.json`. Both must be orthogonal, have 32 px cells, and use the same terrain-v1 atlas/global IDs: grass 1, dirt 2, sand 3, ocean 4, river 5, lake 6, tree 7. The small example is an irregular low town-site with simple grass, sand, paths and trees; **it is not a GLB town**.
3. **Paste into a distinct layer:** in the big map create a tile layer called exactly **`Additions`** above `Ground` (the generated starter already has it). In the small map select its `Ground` layer, select all, Copy. Select the large map's `Additions` layer, position the paste at the desired tile coordinates, Paste. Keep the original `Ground` layer intact. The separate `Additions` layer tells the generator which tiles are new and need elevations. Copy the test map's `Structures` trees into a destination Structures layer at the same offset separately if you want the trees, but they are optional for the first terrain test.
4. **Export the large edited map as ordinary, uncompressed Tiled JSON** with array-valued tile data; use a new filename so your original is preserved. Tiled may drop custom top-level height metadata on export, so retain your original elevation JSON separately.
5. **Generate:** drag the edited JSON onto `generate-low-world.bat` (or double-click the BAT and enter its path). When asked, supply your original elevation JSON to keep your original mountains and hills. The generator prints the new region bounds and variation seed and creates **`generated/low-world.json`** with both merged Tiled terrain and numeric elevations embedded. Cross-platform equivalent: `node scripts/assemble-low-world.mjs --map edited-map.json --elevation original-elevation.json --out generated/low-world.json`.
6. **Fly:** launch `start-world.bat`. Choose **Import Tiled JSON** and select `generated/low-world.json`, then click **Load map**. Leave **Optional elevation JSON** empty: this generated map already has its elevation grid embedded, and the browser now knows how to load it. A raw, unprocessed map with populated `Additions` will instead show a useful error telling you to run the generator.

## What the initial Low to the ground option actually does

The generator reads the existing original terrain, imported grass/dirt/sand pattern, and old elevation data if provided. It assigns low, finite numeric heights to inserted terrain without deleting your painted tiles; generates an irregular sandy skirt on nearby **previously empty ocean cells only**; and leaves existing land and its supplied heights intact. A placed patch out at sea becomes a low island, while a nearby patch can join existing terrain. This prototype is intentionally **not** a finished high-elevation terrain-join solver, and its output should be visually inspected, especially at intersections with existing steep terrain.

**Variation without chaos:** each generation uses a new random seed for small, constrained changes in the low terrain and beach fringe. Saved output is fixed. Rerun the generator on the *original edited map*, rather than on an already generated map, to request a variation; to reproduce an exact variation, pass `--seed NUMBER` on the CLI. The generator never changes your source maps.

## Current limits

- The first pass relies on the named `Additions` layer. If you paste straight into `Ground`, a Tiled JSON export alone gives no reliable way to distinguish new and existing regions; the generator therefore will not guess.
- Initial support is for the repository's existing terrain-v1 GIDs and uncompressed orthogonal map JSON. Foreign tilesets, arbitrary unknown materials, compressed maps, 2D/3D paired object placement, floating disks, floating islands, mountains and automatic GLB connection planes remain future work.
- If you do not supply original elevation data, the previously authored land is not deleted, but its old hills can appear flat because standard Tiled ground tiles alone do not encode altitude. The generator warns you rather than pretending that old elevations can be recovered from colors or images.
- The current browser flight viewer accepts the combined JSON, but a live browser/4 GB hardware smoke test still needs to be done on the target machine.
