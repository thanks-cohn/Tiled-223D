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
