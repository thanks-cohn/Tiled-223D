# Independent Expansive Dirt — first working browser slice

**Status:** Initial sparse terrain renderer and navigation sampler on the active PR branch. This is **not** the complete Expansive Road / four-layer forest / authored Tiled destination implementation.

## Placement and purpose

The default **Bigger** (2,500 × 2,500) and **Massive** (16,000 × 16,000) demo worlds now contain an **independent** expansive dirt continent centered in the previously mostly-ocean expanse, with an elliptical target footprint of approximately one third of the total map area. It does **not** recolor one third of the existing small authored islands. Their original ground/elevation arrays are kept untouched, and the sparse dirt sampling excludes protected areas around them. Imported user Tiled maps and the unexpanded Current demo keep their original terrain.

The new continent uses seeded, continuous multi-scale mathematical noise to produce coherent mostly-brown patches (light, medium and dark brown), occasional line-like outline variation, rolling heights, rare higher points and three families of procedural ramp-shaped elevations. The exact world footprint may be somewhat less than one third because the organic coastline and protected island/moat exclusions take precedence. There is **no** 16k × 16k semantic tile/elevation allocation.

The renderer has a bounded coarse continent mesh (113 × 113 samples) and a small close-up mesh (97 × 97 samples), updated only after a movement/time threshold. Both sample the same analytical elevation function as navigation. Curvature uses the same shared horizon material deformation as the ocean. The low-end budget is a design target; performance/visual correctness on an actual 4 GB PC and seamless blending between coarse and near meshes still require browser/device validation.

## Programmer controls

```js
// Browser console; intentionally explicit world-authoring operation.
const api = window.tiledWorldDirtApi;
api.capabilities();
api.footprint();
api.getRule();
api.sample(1250, 1250); // semantic type, height, brown shade and any ramp
api.setLandmassRule("expansive-dirt:continent", {
  areaFraction: 1/3,
  seed: 7319,
  baseHeight: 8,
  rollingHeight: 13,
  highPointHeight: 36,
  shadeVariation: .38,
  outlineStrength: .22,
  rampCoverage: {large: .10, medium: .09, small: .30},
  expansion: "expansive"
});
```

The defaults above govern the standalone sparse continent; the existing islands are separately protected. `setRule(patch)` updates the same continent. Invalid, unknown, nonfinite or out-of-range rule settings are rejected.

**Ramp percentages in this first slice mean probability per eligible, spatially separated candidate zone**, not a measured guarantee that precisely 10%, 9% and 30% of the continent's *total surface area* is physically covered by ramps. Their actual visible area also varies with coastline and position. If the design requires area-exact quotas, a separate deterministic zone budget/occupancy solver is needed. The analytical ramps modify true ground elevation; a nearby visual mesh uses the same mathematical sampling. At large world scales, the coarse mesh does not yet capture every small ramp until the player is near it.

The `expansion` setting can be `"expansive"`, `"local"` or `"custom"`. Only `"expansive"` currently opts the new dirt into the existing ocean-like perceptual travel/acceleration behavior. `"custom"` reserves future per-landmass rules rather than promising an unsupported road or physics behavior.

## Explicit non-goals and next checks

No playable procedurally extended driving road, wheel/suspension system, user-facing slider editor, four forest layers, imported Tiled location placement or area-exact ramp quota is implemented here. No terrain source map is overwritten. The current local near/coarse mesh overlap can exhibit LOD seams or coarse topography discrepancies and needs an actual screenshot/flight pass and a refined distance mask/blend before merging.

Validate: switch from Current to Bigger/Massive; use the bounded map overview to find the separate brown continent; fly toward it without reset; confirm no sudden ocean-only collision bypass, land elevation and ramps are consistent near the ship; compare local/expanded height at original two islands and check original camera views. Test low/medium/high ramps under multiple seeds, reverse travel, wrap boundaries, globe curvature and the 4 GB machine. Keep PR unmerged until visual and low-end checks are reviewed.
