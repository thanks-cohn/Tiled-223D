# Codex request — ÆXIS composable motion-profile engine

## Status and sequencing

This request defines the next reusable ÆXIS movement architecture. **Do not let it distract from validating the recovered precompiled-dirt performance work in PR #32.** Complete/verify the dirt-runtime correction first. Then implement this request as a narrow, reviewable follow-up on top of the recovered branch.

Do not merge without creator approval.

## Why this exists

The current prototype still contains an early binary travel model: local/protected regions versus open expanse. Expansive dirt is intentionally treated like ocean for acceleration in `src/travel-regions.js`, so it inherits the same very low open-expanse acceleration factor. That prototype rule is now too coarse.

ÆXIS needs a reusable movement system in which:

- flying over land,
- flying over ocean,
- gliding over land,
- gliding over ocean,
- driving over land,
- future hover / underwater / cinematic / low-gravity modes,

can all have distinct behavior without hardcoding a new movement loop for every combination.

The defining engine principle is:

> **Motion behavior is composed from independent profiles, and ÆXIS must always know when two active profiles are trying to control the same property. Silent profile collisions are forbidden.**

The user-facing system should remain simple, but the programmer/agent surface must be explicit and inspectable.

---

# 1. Core architecture

Replace the idea of one monolithic "movement profile" with composable domains.

Initial domains:

1. **speed**
   - forward/reverse speed limits or speed curves
   - optional soft-limit behavior

2. **acceleration**
   - forward/reverse thrust response
   - optional acceleration curve versus current speed

3. **drag**
   - passive momentum loss
   - separate forward/lateral/angular drag where needed

4. **gravity**
   - direction
   - magnitude
   - optional curve/state dependence
   - default planar prototype gravity may be constant world -Y at approximately 9.81 world-units/s² only when world-units are configured as meters

5. **steering**
   - yaw/turn response
   - optional lateral steering response

6. **surface-response**
   - traction
   - slope influence
   - future suspension/contact coupling
   - must not own unrelated speed or gravity fields

7. **lift/glide** (optional for the first vertical slice if it can remain cleanly isolated)
   - lift response
   - glide drag coupling
   - stall/angle-of-attack work may remain future scope

Each profile must declare:
- stable ID
- schema version
- domain
- owned properties
- role for each contribution
- combination operator
- source/provenance
- optional priority only where priority is an explicitly allowed resolution method

Do not rely on JavaScript object-spread order or "last write wins" semantics.

---

# 2. Non-competing profile composition

A profile contribution is not automatically a conflict just because it touches a property.

Example:

- `land-driving-base` owns the base forward acceleration.
- `turbo-boost` explicitly multiplies forward acceleration by 1.35.
- `wet-ground` explicitly multiplies it by 0.85.

That is valid composition because their roles/operators are declared.

A real collision occurs when two active contributions make incompatible claims, for example:
- two `base + replace` contributions for `forwardAcceleration` at the same resolution layer,
- two exclusive gravity-direction owners,
- an undeclared operator for a property already controlled by another active profile.

The resolver must detect these conditions deterministically.

Supported initial operators should be small and explicit:
- `replace`
- `multiply`
- `add`
- `min`
- `max`
- `blend`
- `priority`
- `forbidden`

Do not add operators merely for completeness. Each supported operator must have deterministic semantics and tests.

A profile should be able to declare an operator per property rather than requiring one operator for the entire profile.

---

# 3. Collision policy

**Silent profile collisions are forbidden.**

When two contributions are incompatible, the resolver must:
1. identify the exact property,
2. identify all competing sources,
3. identify each role/operator,
4. either resolve by an explicitly declared rule or return a structured collision,
5. never silently choose one by incidental evaluation order.

Example diagnostic:

```json
{
  "kind": "motion-profile-collision",
  "domain": "acceleration",
  "property": "forwardAcceleration",
  "sources": [
    {"profileId": "land-driving", "role": "base", "operator": "replace"},
    {"profileId": "cinematic-driving", "role": "base", "operator": "replace"}
  ],
  "resolution": "error"
}
```

A conflicting composition must not partially mutate the authoritative actor state.

---

# 4. Resolution layers

Use a clear precedence/composition model. Suggested initial layers:

1. actor defaults
2. locomotion mode
3. world/region
4. surface/material
5. temporary gameplay effect
6. explicit creator override

These are **resolution layers, not arbitrary overwrite layers**.

A later layer may only alter a property according to its declared role/operator. It does not gain permission to replace everything merely because it is later.

The engine must preserve provenance through resolution.

---

# 5. Locomotion modes

Introduce a stable locomotion-mode identifier independent of terrain.

Initial supported identifiers:

- `flying`
- `gliding`
- `driving`

Do not implement full suspension physics in this request.

The important requirement is that the same surface can select different profile compositions by locomotion mode.

For example:

```js
{
  locomotion: "flying",
  surface: "dirt",
  profiles: {
    speed: "land-flight-speed",
    acceleration: "land-flight-acceleration",
    drag: "air-low-drag",
    gravity: "earthlike",
    steering: "flight-steering"
  }
}
```

versus:

```js
{
  locomotion: "driving",
  surface: "dirt",
  profiles: {
    speed: "land-drive-speed",
    acceleration: "land-drive-acceleration",
    drag: "rolling-drag",
    gravity: "earthlike",
    steering: "vehicle-steering",
    surfaceResponse: "dirt-contact"
  }
}
```

No single `isLand` flag should dictate all motion behavior.

---

# 5A. Four altitude motion bands

Altitude must be a first-class **motion context selector**, not just a camera/visual input.

The current prototype already changes camera/visual/travel behavior continuously with altitude in `src/flight-model.js`. Generalize that idea so motion-profile selection can also change as the actor climbs, while keeping camera and motion systems independent.

Create an authoritative altitude-context layer with **four configurable motion bands**. Initial conceptual bands may be:

1. **low / surface**
2. **cruise**
3. **upper-atmosphere**
4. **near-space**

Do not hardcode those names or thresholds as permanent engine truth. The creator/artist must be able to:
- rename bands,
- configure band altitude ranges,
- configure blend/transition ranges,
- choose different motion profile compositions per band,
- inherit a world/default band set,
- override the band set for a specific actor/object/vehicle where allowed.

The existing camera system may consume the same altitude-context calculation, but **camera profiles must not own motion values and motion profiles must not own camera values**. They share altitude context; they do not overwrite one another.

A change in altitude band may select or modify:
- speed profile,
- acceleration profile,
- drag profile,
- gravity profile,
- steering profile,
- lift/glide profile,
- surface-response profile where meaningful.

Example concept:

```js
{
  altitudeBands: {
    "low": {
      range: [0, 80],
      motion: {
        speed: "land-flight-low-speed",
        acceleration: "land-flight-low-accel"
      }
    },
    "cruise": {
      range: [65, 180],
      blend: [65, 95],
      motion: {
        speed: "land-flight-cruise-speed",
        acceleration: "land-flight-cruise-accel",
        drag: "air-cruise-drag"
      }
    },
    "upper-atmosphere": {
      range: [165, 300],
      blend: [165, 210],
      motion: {
        speed: "high-altitude-speed",
        acceleration: "high-altitude-thrust"
      }
    },
    "near-space": {
      range: [285, null],
      blend: [285, 340],
      motion: {
        speed: "near-space-speed",
        acceleration: "near-space-thrust",
        drag: "thin-air-drag"
      }
    }
  }
}
```

These values are illustrative only. Preserve the existing prototype's continuous altitude behavior until creator-approved tuning replaces it.

## Altitude-band composition rules

Altitude bands are another **resolution context**, not a hidden second physics system.

Suggested resolution order becomes:

1. actor defaults
2. locomotion mode
3. altitude band
4. world/region
5. surface/material
6. temporary gameplay effect
7. explicit creator override

As elsewhere, a later context may only affect properties through declared ownership/operator rules.

For example:
- a cruise altitude band may multiply acceleration,
- a near-space band may replace the base drag profile,
- an object's custom altitude rules may select a different speed profile,
- none of these may silently collide with another active `replace` owner.

Band transitions must be smooth and deterministic. Crossing a threshold must not abruptly reset velocity or produce a one-frame parameter snap unless the authored band explicitly requests a hard transition.

The resolver/inspector must report:
- current altitude,
- current band,
- adjacent/target band during a transition,
- blend weight,
- profiles contributed by each band,
- any collisions caused by altitude-selected profiles.

## Per-object / per-actor customization

Creators must be able to assign altitude behavior at an appropriate semantic level, for example:
- world default,
- vehicle archetype,
- specific vehicle/actor/object,
- authored region where applicable.

Do not duplicate the entire profile library per object. Objects should normally reference stable profile IDs and band-set IDs, with small explicit overrides.

A specific object may therefore say conceptually:

```js
{
  objectId: "nea",
  motionBandSet: "fast-ship-altitude-v1",
  motionOverrides: {
    "near-space": {
      speed: "nea-near-space-speed"
    }
  }
}
```

This must still pass through the same collision detector and explanation system as every other motion contribution.

The engine should be able to answer:

> Why did this specific object's speed rules change at this altitude?

with provenance that identifies the object, altitude band, locomotion mode, surface/region context, and resulting profile chain.

---

# 6. Surface/region movement presets

The creator requested three broad selectable behaviors for land traversal. Implement them as reusable presets composed from domain profiles, not as special-case branches.

### A. Character
A deliberately authored land personality.
- distinct from ocean
- can have stronger traction / different acceleration / different drag
- should remain enjoyable rather than intentionally slow

### B. Ocean parity
Land keeps its own handling identity while achieving broadly comparable practical traversal speed to ocean.
- do not simply copy every ocean parameter
- preserve momentum across the boundary
- blend changes instead of snapping

### C. Artist / mathematical
Explicit creator-defined domain profiles and values.
- creator can select or author speed, acceleration, drag, gravity, steering, etc. independently
- one domain may remain inherited while another is custom

Do not encode "character/parity/artist" as a second competing physics authority. They should resolve to ordinary profile selections.

---

# 7. Preserve momentum across boundaries

Crossing ocean -> dirt or dirt -> ocean must not arbitrarily destroy already-earned velocity.

Current code already attempts to preserve momentum while changing new acceleration behavior. Preserve that useful principle.

When active profiles change:
- existing velocity remains state,
- acceleration/drag/steering/gravity parameters transition,
- configurable parameters may blend over a short deterministic transition,
- do not hard-clamp velocity unless a profile explicitly declares a safety clamp.

Provide a default blend mechanism suitable for crossing surface/region boundaries.

The resolved-state inspector must show both current and target profile composition during a blend.

---

# 8. Gravity must be independently composable

Gravity is its own domain.

Initial default planar-world implementation may support:
- constant world-down vector,
- configurable acceleration magnitude,
- deterministic fixed-step integration boundary.

Future-compatible architecture should permit:
- lower/higher gravity,
- cartoon/delayed gravity,
- hover attraction,
- underwater downward pull,
- surface-normal or local gravity adapters,
- future spherical/local-normal gravity.

Do **not** implement all of those now.

Do not couple gravity magnitude to max speed, acceleration, or surface traction.

If two active profiles both claim exclusive control over gravity direction/magnitude without a declared resolution, report a collision.

---

# 9. Deterministic resolver

Create a renderer-independent resolver, for example under a clear motion module such as:

`src/motion/`

Possible internal pieces:
- profile schema/validation
- registry
- contribution normalization
- collision detection
- deterministic resolution
- provenance/explanation
- optional transition/blend state

Do not put the resolver inside Three.js rendering code.

The resolver should be usable by:
- browser viewer
- tests
- future desktop adapter
- programmer API
- agent API

No renderer objects in the core resolved representation.

---

# 10. Explainability and diagnostics

A defining feature of ÆXIS should be that a creator/programmer/agent can ask:

> Why is this actor moving at this speed / acceleration / gravity right now?

Provide bounded inspection operations conceptually equivalent to:

- `motion.inspectResolved`
- `motion.inspectConflicts`
- `motion.explain(property)`
- `motion.listActiveProfiles`
- `motion.previewComposition`

Use the repository's existing versioned programmer/agent API patterns rather than inventing an unrelated interface.

Example explanation:

```text
forwardAcceleration = 80.92

base:
  land-driving = 68

modifiers:
  wet-ground × 0.85
  turbo-boost × 1.40

final:
  80.92
```

Machine-readable output is authoritative; human-readable explanation may be derived from it.

Expose:
- final value
- base contribution
- modifier chain
- source profile IDs
- resolution layers
- operators
- blend state where applicable
- conflicts/warnings

Keep histories and logs bounded for ~4 GB hardware.

---

# 11. Integrate the existing prototype without rewriting it

Inspect the current movement code first, especially:
- `src/travel-regions.js`
- `src/flight-momentum.js`
- `src/flight-model.js`
- movement sections of `src/main.js`

Current behavior to preserve unless intentionally replaced:
- signed momentum state
- reverse-thrust responsiveness
- altitude travel multiplier
- flyby/slipstream behavior
- existing camera/visual speed cues
- collision and terrain-readiness safeguards

Current behavior to remove/generalize:
- expansive dirt being hardcoded into the same open-expanse acceleration rule as ocean
- binary `local` versus `open expanse` serving as the primary motion-authority abstraction

Do not reimplement terrain, dirt compilation, islands, cameras, or collision in this task.

---

# 12. Current dirt-specific correction

As part of the first integration, stop treating expansive dirt as ocean merely because it is an expansive surface.

The new resolver should allow at least:
- ocean flight composition,
- dirt flight composition,
- dirt glide composition scaffold,
- dirt drive composition scaffold.

Only flying currently needs to be wired to actual gameplay if gliding/driving modes do not yet exist.

For unavailable locomotion modes:
- schemas and profile definitions may exist,
- do not pretend runtime driving/gliding is implemented,
- capability output must say what is and is not live.

Provide a sensible land-flight default that is enjoyable and does not inherit the current 0.055 ocean acceleration solely because the ground is expansive dirt.

Do not invent final artistic tuning without documenting it as an initial preset subject to creator tuning.

---

# 13. Safety and stability

Movement integration must use a bounded timestep.

The browser can experience long frame stalls. Do not integrate gravity or acceleration using an unbounded multi-second `dt` after a stalled/background frame.

Preserve or strengthen the existing `dt` clamp / fixed-step boundary.

No NaN/Infinity profile values.

Validate:
- finite numeric values
- meaningful ranges
- valid operators
- valid ownership declarations
- acyclic/valid inheritance if inheritance is introduced

Do not allocate or resolve large graphs per frame.

Cache stable composition results and re-resolve only when relevant inputs change.

---

# 14. Suggested schema shape

Do not treat this exact syntax as mandatory, but preserve its separation of concerns:

```json
{
  "schemaVersion": "motion-profile-v1",
  "id": "land-drive-acceleration",
  "domain": "acceleration",
  "contributions": {
    "forwardAcceleration": {
      "role": "base",
      "operator": "replace",
      "value": 68
    },
    "reverseAcceleration": {
      "role": "base",
      "operator": "replace",
      "value": 45
    }
  }
}
```

A modifier:

```json
{
  "schemaVersion": "motion-profile-v1",
  "id": "turbo-boost",
  "domain": "acceleration",
  "contributions": {
    "forwardAcceleration": {
      "role": "modifier",
      "operator": "multiply",
      "value": 1.35
    }
  }
}
```

A composition references profiles by stable ID instead of copying values everywhere.

---

# 15. Tests

Add focused tests before wiring broad UI.

At minimum test:

1. independent domains do not conflict
2. valid base + multiply composition resolves deterministically
3. two undeclared/competing base replace owners produce a structured collision
4. operator order is deterministic
5. provenance is preserved
6. creator override affects only fields it owns
7. gravity and acceleration can coexist without overwriting one another
8. locomotion mode changes composition without resetting velocity
9. surface boundary changes profiles without silently clamping momentum
10. transition/blend has deterministic results
11. expansive dirt no longer automatically receives ocean acceleration merely because it is expansive
12. existing reverse-thrust behavior remains functional
13. invalid NaN/Infinity/profile schemas are rejected
14. conflict failure leaves prior authoritative state unchanged
15. inspection/explain output matches actual resolver math
16. four altitude motion bands can select different speed/acceleration/etc. profiles deterministically
17. altitude-band transitions blend without resetting velocity
18. camera and motion may share altitude context without owning each other's properties
19. a per-object altitude-band/profile override resolves through the same collision/provenance system
20. conflicting altitude-selected profile ownership is surfaced as a structured collision

Add regression coverage for the current movement path.

---

# 16. Minimal creator UI

Do not build a huge editor.

A first UI may expose:
- locomotion mode (where implemented)
- surface movement preset: Character / Ocean parity / Artist
- selected domain profile IDs
- concise conflict indicator
- resolved values inspector

Artist mode can initially expose a small reviewed set of fields rather than every future parameter.

The programmer/agent API is more important than a large visual editor for this slice.

---

# 17. Performance target

This resolver is infrastructure, not a per-frame expensive graph solver.

Requirements:
- stable profile registry
- cached resolved compositions
- no full-registry scan every animation frame
- bounded diagnostics
- no large allocations in the ordinary movement loop
- suitable for the project's ~4 GB Windows target

Provide simple timing observations for resolution and transition updates, but do not create a heavy profiler.

---

# 18. Documentation

Document:
- profile domains
- ownership rules
- operator semantics
- collision definition
- resolution layers
- transition/blend semantics
- locomotion/surface composition
- exact inspection API calls
- current capabilities versus future placeholders

Add a short explanation that **composition is not collision**:
- compatible declared modifiers may affect the same property,
- incompatible ownership claims must be surfaced.

---

# 19. Implementation workflow

1. Read `AGENTS.md`.
2. Read `docs/CODEX_HANDOFF.md`.
3. Read this request completely.
4. Inspect the recovered PR #32 movement and terrain integration before editing.
5. Run the existing tests/build before implementation when authorized and record baseline.
6. Implement the renderer-independent resolver and tests first.
7. Integrate current flying behavior.
8. Generalize expansive dirt away from the old ocean-only acceleration rule.
9. Add bounded diagnostics / programmer API.
10. Add only the minimal UI required.
11. Run tests/build.
12. Report browser-validation limitations honestly.
13. Open a reviewable draft PR. Do not merge without creator approval.

---

# Acceptance criteria

The slice is acceptable when:

- motion behavior is composed from independent domains,
- every resolved property has traceable provenance,
- incompatible profile ownership is detected rather than silently overwritten,
- the engine can explain a resolved speed/acceleration/gravity value,
- flying on expansive dirt no longer inherits ocean acceleration as an accidental hardcoded consequence,
- land flight can have a distinct enjoyable profile,
- profile changes preserve existing momentum unless an explicit rule says otherwise,
- four configurable altitude motion bands can change the active profile composition as elevation changes,
- altitude-band transitions are deterministic and inspectable rather than hidden hardcoded speed changes,
- creators can assign/reference altitude-band behavior per actor/object/vehicle without duplicating the core profile system,
- camera and motion systems can share altitude context while remaining non-competing domains,
- the architecture can represent separate future gliding and driving compositions without pretending those runtimes already exist,
- existing terrain/camera/collision work is preserved,
- tests cover conflict detection and deterministic composition,
- no merge occurs without creator approval.

## Core design principle

ÆXIS should give creators enormous mathematical freedom while retaining a precise answer to:

**What is controlling this motion value right now, and why?**

If the engine cannot answer that question for a speed, acceleration, drag, gravity, steering, or surface-response value, the implementation is incomplete.
