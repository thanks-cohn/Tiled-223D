# ÆXIS: from a book and reference images to an editable expansive world

**Status:** Product and technical proposal; the complete workflow is not implemented. **Home:** Tiled-223D. **Related:** [world API v1](../docs/WORLD_API_V1.md), [scale profiles](../docs/SCALE_PROFILES_V7.md), [expansive ocean](../docs/EXPANSIVE_OCEAN_V4.md), [Within Reason](aexis-within-reason-single-image-world.md).

## Guiding vision

> The end goal is for the ÆXIS world engine to bridge the gap between what we can describe and the worlds we hold in our hearts and dreams. Whether someone brings Tiled maps, a book, a written description, photographs, or pictures with notes, agentic intelligence should help carry their vision into a world they can explore, understand, and keep shaping. As the engine grows beyond today's agent tools, that creative control should grow with it.

This promise applies across every stage. The first terrain plan may be simple; future stages can add semantic assets, towns, animation and skies. Every stage should accept the creator's corrections and preserve the parts they already made their own.

## The creator's experience

Give ÆXIS a book or description, a few overhead or side images, and optional existing assets. Say: “Build this world in my format.” An agent reads the material, identifies places and spatial relationships, and proposes a master geography with individually editable landmasses. ÆXIS does the repetitive layout, coast, ridge, elevation and map assembly work with constrained generation. The creator sees a quick Tiled-editable map and a corresponding low-cost 3D view, then moves a landmass, changes a distance, redraws a coast, corrects a mistaken interpretation, or asks the agent to refine it. The author remains able to adjust every accepted decision. Later passes can place towns, props, animated assets and lighting without forcing them into the first terrain pass.

Source material needs provenance and suitable reuse rights for the intended project. A free download, open-source engine, or famous franchise name does not itself grant the right to redistribute its text, world or art. With restricted material, the agent can still help the creator build an original world from permitted descriptions and references; it must not silently ship borrowed assets.

## A single world, several representations

The canonical ÆXIS project is a versioned semantic scene, rather than either its Tiled file or its Three.js meshes. A **master map** stores world extent, horizontal wrapping, implicit ocean, landmass placement, travel distances and identity. Each **local detail map** stores the landmass's authored terrain cells, numeric elevations, coast shape, anchors and later roads or structures. Export ordinary Tiled maps for editing; generate a bounded 3D view from the same project. Reimport supported edits without discarding IDs or unrelated manual decisions. Record the source and confidence of agent inferences, accepted edits and conflicts.

World-space X/Z positions, heights, collision, navigation and agent distances have one stable meaning. A rendered world's curvature, folded appearance, horizon or distant view is a presentation transform. The firmament is a separately editable sky and lighting model, potentially with suns and moons. Default horizontal edge wrap means opposite sides meet through periodic coordinates; it is a flat repeating topology, not a true sphere with poles. A genuine spherical world would need its own later topology and coordinate adapter.

## Expansive ocean as a scale rule

Keep detailed landmasses at their authored local scale and position them farther apart on a much larger master extent. Ocean not occupied by a landmass is implicit: sample it as ocean at sea level; draw only bounded nearby sea, horizon and distant land representations. The size choice is principally a **master extent and placement multiplier**, not an instruction to allocate or generate a proportionally larger array of ocean tiles. For example, a 10× increase in each horizontal dimension yields roughly 100× the *area*; a 100× increase in separation means something different and must be labeled explicitly. If the creator asks for 100× the open-sea distance, preserve island footprints and expand their separation accordingly.

Scale alone does not choose appealing placement, travel speed, horizon, asset visibility or valid edge seams. Those follow from the same world-space distances and authored style rules. A flat wrapping world's east/west and north/south seams need matching sampling, coastline continuity where applicable, shortest wrapped distances, consistent shadows and stable object identities. Distant render proxies must resolve to the same objects when approached. An optional ocean travel-speed profile may change the *feel* of crossing without changing geographical distances; record those controls separately.

The existing Current/Bigger/Massive demo already reuses two 500 × 500 island clusters over sparse larger extents, with implicit ocean. This proposal generalizes that idea to arbitrary creator-placed landmasses and agent plans; it does not assert that arbitrary Tiled imports can already use the sparse profiles.

## Agent-assisted creation workflow

1. **Gather and interpret.** Accept an authorized text, descriptions and reference images. Extract named regions, adjacency, direction, relative distances, terrain and elevation hints, mood and unknowns. Keep citations to the provided material and distinguish explicit facts from inference. Side views can inform ridges and silhouettes but cannot by themselves determine a precise overhead footprint.
2. **Propose a world plan.** The agent selects a master extent, a stated scale definition, landmass count and separated placements; local maps are generated with stable IDs. Mathematical constraints govern shore connectivity, terrain slopes, ridge height ranges, water access, minimum clear ocean, and protected edits. “Within Reason” is tunable by biome and intent; unusual fictional terrain remains possible when the creator asks for it.
3. **Generate only necessary detail.** Compose coast and elevation fields per landmass; keep open ocean implicit. Offer a fast master-map preview, then Tiled-editable local maps and a cheap rendered preview. Use deterministic seeds and record both the requested source references and actual generation parameters.
4. **Review and refine.** Show uncertainty and disagreements between book, images and artist instructions. The creator can change a parameter or directly manipulate a landmass or terrain cell. Regenerate only selected regions, preserve unrelated authored cells and metadata, and show an explicit diff before commit. Undo, revision checks, permissions and locks use the same core for GUI, programmer and agent actions.
5. **Grow the world.** A later asset catalog may attach semantic labels and anchors to an entire GLB or to selected faces/regions: base, doorway, roof, north side, attachment socket. Start with editable quadrilateral regions; later support richer mesh polygons and voxel-like selections. The agent may suggest labels from geometry and images, but the artist accepts or corrects them. Asset placement uses slope, footprint, orientation, collision, proximity, source and license rules rather than only image resemblance. Towns, characters, lighting and animations can be proposed in separate passes.

## Agent API contract to grow toward

Provide inspectable, versioned capabilities: `inspectWorld`, `inspectRegion`, `inspectReferences`, `proposeWorld`, `previewPlan`, `commitPlan`, `undo`, and later `inspectAssetParts`/`proposeAssetPlacement`. Plans are structured operations with stable IDs, expected revision, seed, provenance, constraints, diagnostics, rough memory cost and a human-readable summary. The programmer surface exposes exact coordinates and edit masks; the agent surface exposes intent and uncertainty. Both commit through the same validator. No model call is needed during flight or per rendered frame. Do not let a model bypass locks, protected base data, asset permissions or failed transaction atomicity.

To support a book with many places, add paginated semantic inspection, explicit containment and adjacency graphs, sparse master placement, irregular footprints, altitude constraints, cross-map coordinate transforms, reimport conflicts and targeted regeneration. The existing v1 agent API supports deterministic plans for two or three rectangular terrain regions, not ingestion of a book, images or a complete 3D world.

## Delivery stages and proof

1. **Sparse geographic contract:** Define master extent, scale units, implicit ocean, local map origin and wrapping conversion. Move and place several independently editable landmasses without copying the ocean grid. Verify point sampling, coastline seams, short wrapped routes and save/export/reload/undo across two scale choices.
2. **Agent planning:** Introduce a structured, source-attributed world brief and landmass plan. Feed a small written fixture with contradictory and uncertain clues; preview and correct the layout without overwriting an accepted region. Test direct hand-built operations against the same commit rules.
3. **Reference inputs:** Add optional overhead and side image interpretation with visible uncertainty and artist corrections. Benchmark speed and peak memory on a 4 GB Windows machine; avoid mandatory remote inference and per-frame LLM work.
4. **Semantic assets and sky:** Add a small quadrilateral-labeled asset example and separately editable firmament. Check that placement semantics and lighting remain coherent in flat/wrapped and visual-curvature views. Expand to richer mesh segments only after this path works.

Measure world load time, peak JS/GPU memory, frame time during ocean travel and approaching a coast, wrap seam continuity, preview/commit latency and Tiled round-trip fidelity on the 4 GB target. Set numeric performance budgets from a measured baseline rather than claiming the multiplier makes all future content free. Larger geography can be cheap; authored settlements, high-detail assets, animation and long-distance visibility still have costs.
