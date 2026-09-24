# Workflow: one overhead image to a Within Reason world

**Status:** Proposed workflow. See [the full ÆXIS proposal](../Proposals/aexis-within-reason-single-image-world.md). Nothing here describes a shipped image-to-world feature.

1. **Import:** Drop one overhead image. Aexis checks file type, size, viewpoint and likely scale; the image stays local. Optional known distance calibrates world units. Without one, clearly label all dimensions approximate.
2. **Recognize:** Produce colored overlays for building footprints/roofs, roads, grass, trees, bushes, cars and discernible bicycles or conifers. Show uncertain and unknown regions. Associate each recognized object with an editable name, stable ID, outline, color and orientation.
3. **Propose:** Within Reason proposes building story/height ranges, vegetation dimensions and a logical neighborhood graph. Check relationships, shadows where trustworthy, streets, neighboring footprints and sensible proportional bounds. Surface notable conflicts; the user can correct individual objects or accept defaults immediately.
4. **Generate:** Save canonical versioned Aexis scene JSON and an editable Tiled map with semantic layers and stable IDs. Preview simple color-matched building blocks, roads, vegetation and individualized car proxies or style assets. Generation is deterministic for the same source, seed, model and edits.
5. **Refine:** In 3D, select a building and side. Choose door-facing side, door/window counts, generalized or specific pattern, and optional front/side reference photos. Constraint rules fit reusable licensed art to wall geometry and explain impossible layouts. Drag roof corners/edges or add a roof segment and raise the bounded section. See the changed rendition immediately.
6. **Round trip:** Tiled edits to supported footprints and semantic layers return to the Aexis scene by stable ID, with conflicts displayed before applying. The scene JSON remains authoritative for roof and façade controls. Optional desktop Tiled launching/switching is a separate integration milestone.

## Default example for the reference city-block photo

The road intersection remains at ground level; colored roofs become simple extruded buildings with plausible, editable heights; tree crowns become distinct vegetation; parked vehicles get individual position, orientation, approximate size and color. No single-image estimate is labeled surveyed height. Roof color is observed; façade colors and unseen doors are generated defaults until a user supplies a front photo or chooses a side.

## Release checks

- A single click on **Generate** after import yields a recognizable, attractive neighborhood without mandatory per-building questions.
- A corrected label or building height survives save/reload and does not rearrange other objects.
- Doors stay on their chosen wall at a valid height; three doors either fit with margins or produce a clear alternative. Roof segment dragging remains valid.
- Publish measured per-class detection accuracy, image-domain failures, peak memory, recognition time, preview time and frame time on the target 4 GB Windows hardware. Lower resolution and correction-first fallback must remain usable if inference is too heavy.
- Third-party models and assets have a verified license and credits entry; Tiled and Aexis donations are visibly separate.
