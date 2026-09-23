# Proposal: Surface Docking, Local RPG Worlds, and Cinematic Transitions

Status: **proposal — not implemented**. Scope: standalone Tiled-223D World Engine first; FrameChute/SUBSTRATE integration later.

## Goal

Let a player fly through the inexpensive 3D overworld, land on any **suitable detected surface** of an island or placed structure, transition into a localized RPG world associated with the landed object, explore it, and return to the same docked ship to depart. The transition between docking and the RPG scene is creator-configurable. Keep the authoritative world understandable to agents as structured data.

## Player experience

1. The flight engine checks the surface beneath or ahead of the ship, including the top of a moving floating island, rooftop, platform, and regular land. It selects an appropriate candidate, rather than requiring a pre-authored landing pad.
2. Docking is permitted only if the surface is solid and dockable, its normal/slope and available footprint fit the ship, approach speed is safe, and there is sufficient clearance. Water is not a solid dock unless that world explicitly enables water landing. Objects can forbid docking.
3. Once docked, store the world ID, semantic target object/part ID, contact position and normal, the ship's **local transform relative to its supporting object**, and the active world state. A ship docked on a moving island remains attached to that object's current transform.
4. Play the selected optional transition (or a default inexpensive fade). Then load a small local RPG map derived from or associated with the supporting object's surface, and spawn the RPG character beside the ship.
5. In the local RPG world, use the landed object's local coordinates. The distant overworld may be paused, simplified, or advanced analytically; it need not render its full 3D scene.
6. Returning to the ship may play a separate outbound cinematic. Then restore overworld flight at the **current world transform** of the supporting object plus the saved local docking offset, not the island's stale arrival coordinates.

A dock can load an authored RPG scene if one is available. Automatically generating an RPG map from the object's top-down footprint, accessible upper surfaces, elevations and openings is a **future converter capability**; no claim is made that this currently works for arbitrary GLBs.

## Semantic record (illustrative)

```json
{
  "id": "island_A",
  "parent": "sky_archipelago",
  "type": "floating_island",
  "at": [145, 47, 279],
  "dock": {
    "enabled": true,
    "surfaceSelection": "detected",
    "maxSlopeDegrees": 18,
    "minClearance": 2.5,
    "maxRelativeSpeed": 4,
    "destination": {
      "mode": "2d",
      "sceneId": "island_A_local",
      "map": "worlds/island_A/rpg.json",
      "spawn": "near_ship"
    },
    "transitions": {
      "arrival": {
        "kind": "video",
        "src": "worlds/island_A/media/landing.mp4",
        "fallback": "fade",
        "skippable": true
      },
      "departure": {
        "kind": "fade",
        "durationMs": 900
      }
    }
  }
}
```

This adds optional docking fields to an existing semantic object; it does not replace the current floating-island geometry syntax. No `dock` entry means the engine may use a configurable, safe generic surface-docking rule; `enabled:false` forbids docking. Stable parent/part IDs matter more than a model's temporary mesh indices.

## Creator-selectable transition types

- **fade (default):** fade to black and/or simple camera animation. Always available, low memory cost, and the fallback for missing assets.
- **video:** locally supplied or authorized MP4; load near transition time, release decoding resources afterward, honor mute/autoplay restrictions, and provide a skip control.
- **scene3d:** a short scripted **Three.js** scene or timeline, reusing the existing world renderer where possible. If a host later chooses Babylon.js, use an engine-neutral transition interface rather than instantiating both renderers for one scene.
- **liquid (advanced):** optional user-authored Liquid transition code, executed through a permissioned, isolated scripting interface. Do **not** run arbitrary untrusted script with `eval`, direct DOM access, or unrestricted file/network/agent privileges in the world page. Expose only documented transition commands (camera, audio, safe animation, scene change); an unsafe or unavailable script falls back to fade.

A transition is a presentation hook, not the authoritative action that decides docking or loads files. The docking state machine must make progress even if video fails, a scene crashes, or a creator script times out.

## Proposed transition/event contract

`approaching -> dock_candidate -> docked -> transition_in -> local_world -> transition_out -> overworld`

Host events (proposed, not yet in code): `world:dock-candidate`, `world:docked`, `world:local-enter`, `world:local-exit`, `world:undocked`. Each carries `worldId`, `objectId`, `surfaceId`, and relevant local/world transforms; no personal file data is included.

Keep one canonical object graph and one stored ship state. Docking/undocking and world-entry APIs should be callable equally from human controls and authorized agents.

## Build order

1. Add a simple downward surface query over the existing terrain and named floating-island parts. Verify slope, clearance, solid/walkable flag, proximity, and relative speed. Do not confuse the highest visible 2D sprite with actual available collision geometry; holes and underneath passages remain empty.
2. Allow docking against the main floating island and one ordinary ground cell; persist a relative ship transform and reject water and unsupported undersides.
3. Attach one authored, very small RPG map; enter via fade and spawn near the docked ship. Return through ship interaction and resume flight at the moved island's current position.
4. Implement a transition registry for fade and MP4. Add optional scene3d and permissioned Liquid adapters later, without blocking the default experience.
5. Extend the geometry-to-local-map converter: project accessible top surfaces and openings, output layered 2D tiles/elevation/collision data, and let Tiled or a creator correct uncertain geometry. Preserve semantic ownership and identity.

## Lightweight / safety constraints

Only load the local world being visited; stop unnecessary overworld rendering while inside it. Validate map and asset paths and file limits, handle unloaded assets with fallbacks, offer an immediate skip/escape, and use bounded collision queries rather than full-scene physics. A future 2D RPG camera may hide characters **behind an island's top-down surface when they pass underneath**, while retaining character position/collision and allowing openings to reveal them (see `docs/SPATIAL_GEOMETRY.md`). That occlusion is a renderer behavior, not a despawn.

## MVP acceptance

- A ship can dock on a suitable, non-pre-marked solid surface of an island or ordinary terrain but cannot dock on invalid water or a surface without clearance.
- Docking saves the target object ID and a local attachment transform; the character enters a local RPG scene via a fade; returning puts the ship beside the **currently located** moving island.
- An optional MP4 can play before entry without preventing entry if missing/unplayable; player may skip.
- Advanced scene3d and Liquid types can be declared in data, but must explicitly report unsupported until their safe runtimes are implemented; no silent execution of arbitrary text.
- The demo keeps an independent standalone launch and exposes a small future host integration surface.

## Addendum — Creator-authored islands, agent-generated expansive geography

Status: **future proposal, not currently implemented**. Applies to the world-scale architecture above docking/local-world transitions. A creator should be able to spend their time detailing **islands and their offshoots** (houses, towns, caves, labs, docking areas, short nearby coasts), then optionally grant an agent **scoped authority to generate the surrounding large-world terrain**. The Massive world should not demand that creators manually paint 16,000 × 16,000 individual terrain cells.

### Creation workflow and authorship boundary

1. The creator places their authored islands and selected local 500 × 500 (or smaller) maps at named **global-world coordinates** and describes the desired surrounding setting, e.g. "connect this island to a green coastline, add a western desert, place rocky highlands and two rivers, keep the village unchanged."
2. An authorized agent produces a **proposed geographical plan** for the otherwise expansive area: continent/coastline shapes, broad elevations, regions of grass, sand, dirt, rock, river/lake/ocean, transitions and named landmarks. Generate simple, conceivable terrain first; high-detail sculpting is optional and local.
3. Creator-authored zones are **locked by default**. The agent can edit only its explicitly delegated geographic regions and approved material types. Where generated land approaches an island, generate a transitional border respecting the island's actual shoreline, elevation, water level, entrances, docking clearances and authored structure IDs. If constraints conflict, report the issue and ask the creator instead of silently altering their map.
4. Show the creator a **small synchronized overview** and a few representative local previews of the proposed continent before committing. The creator can regenerate an area, constrain it further or approve it, with deterministic seeds/versioned changes supporting reproducible results and undo. Agent generation is an **authoring operation**, not a network/LLM dependency during ordinary gameplay.

### Two maps, one geographical source of truth

The proposed Massive world has a single authoritative geographical representation: global coordinates, compact landmass footprints/polygons, material-region boundaries, coarse elevation functions or sampled patches, river polylines and references to detailed authored local maps. The two maps are **derived views**, not separately painted competing sources:

- **Planetary overview (e.g. 500 × 500 pixels):** a downsampled, low-cost visual index of the entire world. For a 16,000 × 16,000 coordinate extent, `overviewX = worldX / 16000 * 500` and `overviewZ = worldZ / 16000 * 500` (with the correct wrap/viewport transform). A 32-world-unit-per-pixel representation can communicate continents and prominent rivers, but cannot preserve narrow streams, fine beaches or every individual building.
- **Large navigable world:** uses the same global geography to answer `materialAt(worldX,worldZ)`, `heightAt(worldX,worldZ)` and semantic feature queries; renders only a bounded neighborhood and the appropriate speed/distance/altitude LOD. An overview pixel references world coordinates, **not** a huge stored list of child tile IDs.
- **Local detailed map:** an attached creator-authored Tiled/elevation/structure map with its own local coordinates, plus a deterministic local-to-world transform, protected footprint and versioned asset references. As the player approaches it, this source takes precedence over generated ground in its protected footprint. It must not be stretched 32× to represent a continent.

Large mass does not imply uniform land: broad grassland, sandy areas, rock fields, dirt, lakes, rivers and oceans can be compact *semantic material masks/regions* with optional fine regional detail. A river may be stored as a width-bearing polyline: the 500-pixel overview draws its generalized course, while a local render samples its real course/shoreline at higher precision. Preserve consistent world IDs, material/elevation values, and access permissions so the agent, minimap, flight physics and close-up renderer refer to the SAME feature.

### Runtime and low-memory constraints

- Never allocate a 16,000² material/elevation grid or load all regional 500² maps to cruise over the Massive world. Keep the existing small overview budget and a bounded cache of nearby regional chunks; stream/precompute lazily only when approaching a relevant area.
- At low speed near authored locations, use detailed terrain and collision; over broad generated expanses use low-cost material variation and simplified land shapes. As speed/altitude grows, prioritize regional color tiles, coastlines, large landmarks and sky parallax without erasing authoritative collision or geographical identity. Avoid abrupt level-of-detail switches with hysteresis/fades.
- The generation agent may create detailed output *offline or ahead of time*. Flight should query cached/compiled terrain data and must not block waiting for an agent response. At extreme velocity skip intermediate chunks rather than loading every region crossed.
- Offer creator-controlled limits for generated area, asset count, height complexity and target memory/LOD budget. A 4 GB client should not need more rendered geometry just because a world has more semantic land.
- A failed/missing regional asset falls back to a simplified version of the same feature rather than teleporting the ship, silently turning authored land to ocean, or resetting its location.

### Illustrative future schema (not parsed by the current engine)

```json
{
  "worldId": "massive_world",
  "extent": [16000, 16000],
  "geography": "regions/massive_world/geo.json",
  "overview": {"size": [500, 500], "derivedFrom": "geography"},
  "authoredLocations": [
    {
      "id": "home_island",
      "worldAt": [4480, 0, 4960],
      "localMap": "locations/home_island/map.json",
      "protected": true,
      "agentEditable": false
    }
  ],
  "agentGeneration": {
    "enabled": true,
    "editableRegionIds": ["western_continent_expanses"],
    "allowedMaterials": ["grass", "dirt", "sand", "rock", "river", "lake", "ocean"],
    "seed": 39281,
    "requiresCreatorApproval": true
  }
}
```

**Acceptance criterion:** A creator authors two or three detailed islands and landmarks, authorizes a large surrounding region for agent generation, then inspects a varied continent with recognizable coastlines, grass/sand/rock, a river and a lake. The bounded overview and flight renderer agree on each material boundary and destination coordinate; entering an authored local area recovers its original unscaled terrain and docking geometry. The Massive world must remain navigable without a giant tile array or runtime LLM calls, and the agent must not modify protected work without permission.

## Addendum — One placed asset, optional 2D/2.5D RPG views and semantic portals

Status: **future proposal — not implemented in the current standalone viewer.** Extends the earlier creator-authored-location/agent-generated-expanses addendum and the surface-docking / local-RPG transition design. **Do not conflate the optional RPG presentation with the original flight world's actual 3D geometry, coordinates, or collision.** The creator drops an asset once and can derive the appearances required by either RPG presentation.

### Stage 0 — Upload and orient the creator's 3D flying asset

Provide a small **Flying Asset Setup** stage before assigning a model to a controllable ship, mount, aircraft, or other flying object:

1. Upload/import an authorized 3D asset (e.g. GLB); show it on a simple compass stage with visible **N / S / E / W** world-axis markers, a ground plane, and a highlighted forward arrow. The creator rotates/repositions/scales the asset to align its *actual nose/front* with the engine's documented canonical forward direction. Existing flight code uses `-Z` for yaw 0; show this as **North**, `+Z` as **South**, `+X` East and `-X` West in the authoring stage. Clarify whether a model's built-in glTF axes differ; save an explicit corrective local transform rather than secretly rewriting its source vertices.
2. Let the creator declare/preview **front, back, left, right, up, down** and the ship's pivot, silhouette, nose and optional animation bones or clips. Show front/left/rear/right previews and exercise yaw, bank, pitch, climb, descent and movement animation bindings on the staged model. If a source clip is unavailable, use a documented idle/rigid-transform fallback; never pretend missing rigged animations exist.
3. Store a canonical `forwardAxis` / `northAlignment`, corrective `modelRotation`, `scale`, `pivotOffset`, optional animation clip mapping and physics/collision parameters **separately from its visual representation**. Directional captures for RPG sprites and flight visuals must use the *corrected orientation*, so turning north/east/south/west, directional shadows, triggers, and transition animations all agree with world coordinates.
4. Validate a short authoring test (forward heading indicator, four cardinal turns, bank left/right, takeoff/landing or hover, overhead and side preview) before publishing. Allow the creator to revisit alignment without changing the ship's authoritative world position or recapturing unrelated assets.

Illustrative **future-only** asset binding:

```json
{
  "assetId": "creator_airship",
  "source": "assets/creator-airship.glb",
  "flyingAssetSetup": {
    "worldNorth": "-Z",
    "worldEast": "+X",
    "sourceForwardAxis": "+X",
    "correctiveYawDegrees": 90,
    "pivotOffset": [0, 0, 0],
    "uniformScale": 1,
    "animationClips": {
      "idle": "Idle",
      "forward": "Cruise",
      "turnLeft": "BankLeft",
      "turnRight": "BankRight",
      "climb": "Ascent",
      "descend": "Descent"
    }
  }
}
```

Clip names and rotation values above are illustrative only. The authoring stage must preview and validate the actual imported file, and should not assume a particular mesh axis, animation name, or available skeleton.

### Stage 1 — Place an asset once and automatically capture RPG appearances

A creator drops any 3D object at a chosen world coordinate, with a stable semantic object ID and local-map transform. The engine captures the asset **once on import/placement or when the asset/style/camera changes**, using an isolated transparent render target with alpha, not an expensive background-removal service on every frame. Cache the resultant image and an optional clean white padded outline. Preserve the original 3D source, parent, world anchor, collision and any openings, irrespective of which 2D image is displayed.

Provide **two separate optional render modes**, alongside retaining the original 3D experience:

- **Classic flat Tiled RPG (2D):** capture a top-down or creator-chosen view; put its transparent cutout **flat on the ground/map layer at the same mapped X/Z coordinates** where the 3D asset was placed. Use normal Tiled-style terrain/material layers for grass, sand, rivers, roads and water. Order/occlude by the configured 2D layers, not by the 3D object's arbitrary visual height. A flat object can occupy more than one tile; preserve its projected footprint and entrance/interact position.
- **Paper 2.5D RPG:** capture a viewpoint matched to the selected fixed/angled RPG camera; prop the transparent toon cutout **upright on a cheap flat plane**, anchored at its actual contact point, with a soft inexpensive ground shadow and an **optional white padding/sticker outline**. The object is a *propped-up image*, not a newly generated detailed 3D model. Grass, rivers, sand, dirt, roads and other terrain remain **perspective-correct ground-conforming material/contour surfaces**, not upright cards. Perspective-correctness for a single capture is limited to its capture camera; offer directional captures and view selection later if the RPG camera can rotate.

Both modes derive from the same location and semantic data. Switching mode must not relocate, duplicate, resize arbitrarily or recreate the physical 3D object. Captured textures and shadows are cached, pooled, and generated outside the ordinary frame loop; avoid full-scene alpha readbacks or a new material per tile.

### Stage 2 — Right-click a placed object to assign interactions

A creator right-clicks a placed asset or its generated RPG sprite/card to open **Object → Interaction**. The interaction is attached to the **semantic object identity** and designated contact/proximity/entrance region, not to pixels in its sprite. Provide an ordinary no-code dropdown and an optional advanced **Liquid reaction**. Proposed presets include:

- **Make Space / Open 3D Space:** attach a validated local asset/scene reference (e.g. `spaces/house/interior.glb`), named destination `spaceId`, entry spawn/portal ID, and explicit return location at the original doorway. Optional transition visual/audio can be a lightweight fade by default. Enter the referenced 3D room when the player walks to the object's intended doorway and activates it (or on creator-selected proximity/contact); preserve the exact exterior semantic position for the return trip.
- **Open RPG Map / Make Room:** load a linked local Tiled scene at its named entrance; stay in classic 2D or 2.5D according to the creator's selected presentation.
- **Other predefined actions:** dialogue, collect/use item, play animation, activate a door, change a world-state flag, or teleport to an explicitly permitted location. Decorative / no interaction is valid.
- **Liquid reaction (advanced):** bind authorized `onApproach`, `onInteract`, `onEnter`, `onExit` or `onCollision` hooks through a documented, isolated, permissioned event/API surface. Expose only the selected semantic object and approved world actions. **Do not give a world asset unrestricted filesystem, browser, network, desktop, or agent privileges merely because the character approaches it.** Require explicit grants for any host-level effects; invalid/unavailable Liquid logic must leave the default interaction safe and not strand the player.

In the editor, show trigger type (**press interact**, **approach**, **contact**), interaction footprint/door anchor, linked reference picker, missing-reference warnings, and a preview of enter/exit. A default exit/escape route should remain available if an interior or custom transition fails.

### Illustrative future-only object binding

```json
{
  "id": "home_001",
  "parent": "village_west",
  "worldAt": [120, 0, 85],
  "source3d": "assets/home.glb",
  "rpgAppearance": {
    "classic2d": {"kind": "flat-ground-cutout", "capture": "top-down", "whiteOutline": true},
    "paper25d": {"kind": "upright-cutout", "capture": "rpg-camera", "shadow": "cheap-ground", "whiteOutline": true}
  },
  "interaction": {
    "trigger": "interact",
    "region": "front_door",
    "action": "open_space",
    "destination": {
      "spaceId": "home_interior",
      "asset": "spaces/home/interior.glb",
      "spawn": "front_entrance"
    },
    "returnTo": {"objectId": "home_001", "anchor": "front_door"},
    "liquid": null
  }
}
```

### Relationship to the nested-world desktop

The same location/interaction interface should be extensible beyond a house: a cave under an island may open an expanded world, and leaving a planet may hand the user into a distinct SUBSTRATE spatial desktop with its own coordinates, windows and floating models. These are **explicit named, permissioned transitions** that preserve origin, destination and return state, not an automatic permission escalation. An agent can inspect or propose bindings through the semantic JSON graph, but only perform operations within the creator's authorized scope.

### MVP acceptance

Import and orient one creator ship using N/S/E/W controls so forward movement and turning match its nose. Place one 3D house and one tree; generate and cache two appearances for each (flat Tiled sprite and upright 2.5D cutout with optional outline/shadow). Switch RPG modes without changing underlying object IDs or location. Right-click the house, select **Make Space**, link a tiny 3D room, approach/interact at the configured doorway, enter and return to the same exterior anchor. A second object can trigger a no-code dialogue; optional Liquid is exposed as a declared extension rather than silently executed. Do all of this without runtime AI image generation or loading unrelated rooms/planet-sized terrain grids.

## Addendum — Expandable landmark models and slow descent into immense structures

Status: **future proposal, not implemented**. A distant structure may initially be represented by one compact 3D model, low-poly silhouette, or 2D/2.5D proxy. As the player chooses to approach it, the landmark can **expand into a vast, navigable structure** and the ship can descend *slowly and deliberately* through its increasing architectural detail. The point is not just a teleport or sudden scene swap: make the destination feel enormous as towers, terraces, courtyards, hangars, caves, rooms, and local geography resolve around the player. This is an optional creator-authored experience, not a requirement that every map or room have a 3D equivalent.

### Creator controls and two valid scale treatments

- **Reveal an already large structure (default):** the far model is a deliberately compressed visual proxy. On approach, transition to a separately authored or derived large-scale destination. The player perceives the structure growing in the view while canonical position, dimensions, entrances, collision, and walkable regions come from that destination's real semantic data. Do not turn a tiny visual proxy's mesh triangles into fictitious walkable architecture.
- **Actually expand the structure (optional cinematic):** a creator may author a transformation timeline in which a model's world-space scale or assembled parts grow from compact to colossal. Animate anchored geometry, collision and docking surfaces coherently, prevent player/ship clipping, and specify whether the effect is a real world-state change or a presentation-only transition. A visual-only expansion must never silently change physics or stored world distances.
- The creator configures starting view, target scale / linked destination, descent path and pace, camera framing, sound/atmosphere, an optional pause or sightseeing speed, and the point where manual flight, docking, or 2D/2.5D RPG movement takes over. Allow reverse ascent and a clear skip/exit without losing the origin or return coordinates.

### Intended experience

1. At overworld altitude the player sees an inexpensive landmark silhouette or small model with a stable semantic ID. They select it or begin an approach; the engine resolves its linked expanded-space ID and verifies that the destination is available.
2. The camera and ship move along a smooth, creator-configurable approach. The destination grows in apparent size and parallax; broad shapes resolve before local details. Begin a gradual descent rather than forcing a jump into a full-detail scene.
3. Stream only the structure's nearby chunks, tiled surfaces, material regions, large features, and necessary collision. Bring in towers, streets, entrances and interactive parts as the player reaches them, with hysteresis/crossfades to avoid abrupt popping. The distant proxy can fade away once its detailed counterpart is visually aligned.
4. Slow horizontal and vertical travel as the ship enters the structure so the player can appreciate its scale. Preserve deliberate steering and a safe landing/docking trajectory; the transition may continue in 3D or hand off at a named anchor to classic 2D or paper 2.5D. A linked 2D room is fully valid without a corresponding complete 3D interior.
5. On exit, restore the saved origin transform or the current transform of a moving parent object, reverse the presentation if desired, and unload distant interior chunks. The player's canonical world/local positions and semantic object identities must remain consistent in every presentation mode.

### Architecture and low-end performance

Represent the compact landmark and expansive destination as **two representations linked by semantic ID and an explicit local-to-world transform**. Store named entry/exit anchors, bounding volumes, scale policy, terrain/elevation/collision references, and optional 2D/2.5D map references. Keep camera zoom, proxy size, authored physical scale and player speed as separate controls. Use impostors / paper cards at long range, a small intermediate low-poly shell during descent, then bounded tiled chunks for immediate geometry and interactions. Prefer reusing existing assets, instancing repeated structures, caching captures, and pausing offscreen simulation; never load an entire giant structure merely to run its reveal. If a detailed model or chunk is unavailable, keep a coherent low-poly fallback and a safe return path.

**Acceptance goal:** A distant miniature-looking station, city, floating island, or tower resolves into a visibly enormous navigable structure during a smooth, slow descent. The player can fly beside recognizable large features, enter one nearby authored area, choose a valid 2D/2.5D/3D local experience, and return to the same overworld anchor. On a low-memory client, far and hidden structure details do not all remain loaded, and visual scale changes never invent walkable space or alter canonical collision accidentally.
