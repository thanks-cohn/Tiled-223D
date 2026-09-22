# V5 — Ocean momentum, island slipstreams, and readable speed

This is a new experimental branch from `feature/expansive-ocean-clusters-v4`. V4, V3 and `main` are unchanged.

## What changed

**Momentum is stored, not repeatedly forced toward the ocean's low target speed.** V4 used altitude × local/ocean factor as a target and damped the current velocity to it on every frame. Leaving an island therefore erased the very speed you had earned. V5 instead keeps signed horizontal velocity and applies per-frame *acceleration*. In open ocean, gaining **new** speed takes roughly twice the effort compared with V4 (low-altitude cruise factor 0.055, Shift factor 0.11). But arriving with 80 units/s still means entering the ocean at 80 units/s. The existing map, island dimensions, wraparound and collision coordinates are unchanged.

**Acceleration naturally tapers as the ship gets faster**, via a speed-dependent falloff in `src/flight-momentum.js`. While holding W or Shift, speed continues to increase rather than stopping at a target cap. On release, coasting drag is small over open ocean; momentum gradually dissipates instead of snapping to ocean cruise speed. Pressing S while moving forward applies genuine counter-thrust, then eventually reverses the ship. Altitude still boosts acceleration and Shift still produces stronger thrust.

**Passing a destination is rewarding.** Entering or departing a named protected island/archipelago region awards a signed additive *island slipstream impulse*, provided the ship has some speed and remains below a configurable altitude. The impulse scales partly with your existing speed, is bounded for the demo, and has an 18-second per-region cooldown plus departure/reentry hysteresis so it cannot be farmed every frame. You can leave an island with additional velocity and preserve that bonus across the ocean. The game HUD displays actual momentum and a brief slipstream message on a successful pass.

**No W/S deadlock after contacting terrain.** V4 could forbid movement whenever a sampled ground height plus clearance was equal to the ship's current height, and both directions might be treated as embedded. V5 allows the ship to slide along a surface at equality. If it is already inside land or a floating-island collider, it can move toward level/lower ground or out of that same collider rather than becoming trapped until it ascends. Uphill/new obstacle entry still blocks. The existing R/upward recovery remains available.

**The ocean feeds back the actual speed.** One tiny, bounded batch of world-anchored, pale blue-white mathematical line glints appears on ocean cells close to the ship at low altitude. Their lengths and subtle opacity increase with actual speed, not simply with the Shift key. They drift past naturally as the ship moves and vanish when the ship slows or ascends. They do not require a particle simulation, volumetric effects, screenshots or another water mesh. The previous cloud parallax layers remain enabled.

## Controls and tuning

W accelerates, S counter-thrusts/brakes/reverses, Shift increases thrust, A/D steer and ↑/↓ change altitude. Free travel remains available above the planet, with manual Return to SUBSTRATE. Set acceleration, diminishing returns, slipstream amount/cooldown, and coasting drag in `src/flight-momentum.js`; protected-region boundaries and ocean acceleration multipliers are in `src/travel-regions.js`. The visual effect lives in `src/ocean-speed-cues.js`.

## Limits to test

The 500 × 500 world was *not physically enlarged*. With sufficient stored speed, a ship can still circle the small world quickly; intentionally, V5 does not destroy earned momentum to fake a larger planet. True long-distance geographic scaling must be implemented as a separate navigational system if required. Collision and rendering remain tied to the existing flat-map gameplay/spherical-display prototype, not real orbital physics.

Run `npm install && npm test && npm run build && npm run dev -- --open`. Try cruising out of the starting cluster, holding Shift while passing another island, releasing W, and continuing across ocean. Verify that reverse flight works after skimming a ridge, that speed does not collapse at ocean boundaries, and that the subtle white-blue ocean glints do not obscure the terrain. Automated tests verify the numeric/collision rules but cannot validate appearance or frame rate on a 4 GB Windows machine.
