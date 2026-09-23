# V8 semantic binding — altitude parallax cloud choreography

**Read with** [Bugs registry](../Bugs/README.md), [flight-scale findings](../Bugs/flight-and-scale.md), and [atmosphere issues](../Bugs/atmosphere-and-release.md). This branch derives from experimental V7 (`feature/scale-profiles-floating-origin-v7`) and does **not** change `main`.

## Why this change exists

The user wants **four distinct altitude-specific feelings of speed**, not just randomized sky decoration. Repetition, regular spacing and six identically shaped clouds made both the low-hover sky and Massive-world travel feel artificial. The clouds must work together to maximize *parallax*, including different visual lifetimes: nearer clouds pass out of view quickly, while distant upper formations stay long enough to communicate vast distance. This relationship changes as the pilot ascends. A timer is a compute budget, never a fake motion source.

## Implemented source of truth

- `src/cloud-choreography.js`: pure seeded cloud hash/appearance/placement, four mood emphasis profiles, per-deck recycle distance/timer/quota. No DOM/THREE import. All layers use current pilot position, actual heading and signed speed to decide where a *new* cloud is assigned.
- `src/atmosphere-renderer.js`: 27 logical pooled formations, each represented by a low-altitude sprite and high-altitude ground-tangent plane (the two are cross-faded, not both fully drawn simultaneously). Four tiny shared procedural family textures are generated once at startup. An assigned formation maintains its world-space anchor and only receives gentle independent wind movement. Its pool slot can be reassigned **only** when it is outside the useful range or has passed behind, AND the layer's separate timer/work quota allows it. New assignments fade in.
- `src/main.js`: passes signed momentum, true global pilot coordinates, rendering origin and yaw to the atmosphere; **never** modifies pilot velocity or position in this visual system.
- `tests/cloud-choreography.test.js`: pure tests for the four profiles, smooth transitions, seeded variation, stable return values and fixed work quotas.

## Four elevation experiences

| Altitude mood | Nearby parallax | Slow reference | Intended visual feeling |
| --- | --- | --- | --- |
| Cinematic hover | Small reachable low-cloud flybys and ocean glints | Long-lived large upper cloud forms | Calm California-highway ocean cruise; warm, spacious horizon |
| Active flight | Low/middle clouds sweep by at different rates | Upper clouds remain relatively steady | Noticeable "vroom" during acceleration |
| Expansive ascent | Fast near formations above and beneath the ship, with other decks at varying distance | Broad higher/planetary fields | World feels huge but the pilot still perceives acceleration |
| Planetary | Broad cloud patterns across the curved globe; coastline motion in future geography work | Far atmospheric reference | Large-scale orbital travel, not the same low-altitude trick |

These are **presentation roles**. Apparent speed comes from real ship movement and actual perspective; do not arbitrarily drag all clouds opposite movement or re-randomize them in place each frame.

## Recycling and appearance rules

A formation's assignment persists even while the ship moves. On a schedule derived from current altitude, speed and layer, check whether it has become irrelevant because it passed behind or moved past its useful range. Only then assign a fresh seeded position ahead, using the reused slot and shared family texture. Limit each check to at most three Low, two Middle, one High or one Planetary reassignment. At extreme speed, skip all unseen intermediate regions and compute only the current relevant assignment; no unbounded catch-up loop. Upper layers have longer visual range and lower allowed work per check.

Variations are created by four **different procedural silhouettes** (cumulus, wisps, cloud bank, broken), seeded horizontal/vertical scale, opacity, slight orientation and irregular placement. Do not multiply geometry or generate a new texture on every frame. Stable world anchors and irregular separation avoid the previous ring of identical clouds. Each slot has its own seeded appearance while it remains visible.

## Invariants and limits

- Four logical layers and four altitude moods; original 27-formation pool unchanged, with four tiny startup textures and one shared plane geometry. No volumetric cloud simulation.
- Always use the same floating render origin as pilot/camera/terrain, regardless of Massive world size.
- Near-cloud flybys preserve actual motion; distant layers remain stable longer. No time-driven fake translation to imply speed.
- In orbital view, **all displayed cloud planes align their normals to the local outward spherical ground normal**. Low-altitude sprite-to-plane transition remains smooth.
- Clouds do not change ship X/Z/Y, collision, global position, world scale or island momentum. V7 first-person view, W/S-lock and unexpected pilot reset remain open in `Bugs/` and are NOT fixed by this cloud branch.
- Windows malware/ZIP detection remains separately tracked and unresolved. Never suggest disabling protection.
- Continuous in-browser visual and FPS validation on the owner's 4 GB machine is required. CI unit tests and bundle success cannot establish cinematic appearance or hardware performance.

## Future work

Art-directed sunset, night moonlight, thunderstorms and regional semantic geography are **proposals**, not part of this change. Future weather fronts may override cloud-family distribution by a stable region seed while retaining a fixed pool and the same motion/proximity semantics. At extreme travel speeds, consider broad cloud-coverage masks or controlled streaks without dropping near flyby references.
