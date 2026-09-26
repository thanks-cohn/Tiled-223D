# The World's ÆXIS — Single Plane Expression, Multiple Plane Collision Avoidance

## Status

Engineering standard proposal for The World's ÆXIS JavaScript codebase.

This proposal does **not** add a second debugger, telemetry stack, or competing runtime authority. It defines a common contract so the existing developer APIs, diagnostics, tests, and future agents can answer the same questions about system ownership and interactions.

The motivating failure mode is familiar:

> “It works, but how?”

followed later by:

> “It does not work, but how?”

In a large JavaScript/browser system, behavior can emerge from application code, event listeners, animation loops, timers, DOM state, shader hooks, callbacks, imported libraries, cached state, and asynchronous work. The purpose of this standard is to make those interactions explicit enough that developers and agents can trace them without reconstructing the whole program from scratch.

---

# 1. Core principle

## Single Plane Expression

For any authoritative runtime target or property, ÆXIS should be able to identify **one canonical expression of its final state**.

Examples:

- actor forward acceleration
- actor gravity vector
- camera FOV
- terrain chunk visibility
- land/ocean authority at a world coordinate
- selected compiled dirt profile
- active locomotion mode
- world position
- render-layer visibility
- lifecycle state of a scene object

“Single plane” does **not** mean only one system may ever influence a value.

It means the final value has one inspectable resolution path.

The engine should be able to answer:

1. What is the target?
2. What is its current authoritative value/state?
3. Which systems may affect it?
4. Which systems are affecting it now?
5. What role does each system play?
6. In what order or composition rule are they resolved?
7. Which source produced the final value?
8. Are any systems making incompatible claims?

If those answers are unavailable, the target is not yet compliant with this standard.

## Multiple Plane Collision Avoidance

ÆXIS may contain many systems operating in parallel:

- terrain
- physics
- movement
- camera
- renderer
- editor
- world API
- diagnostics
- input
- transitions
- cinematic systems
- cache/scheduler systems
- temporary effects
- creator overrides

Those are separate planes of responsibility.

They may interact, but they must not silently compete for the same authoritative target.

The standard therefore requires explicit ownership, contribution roles, provenance, and collision detection at the boundaries where systems meet.

---

# 2. What this is not

This proposal is **not**:

- a new logging framework,
- a second diagnostics system,
- a requirement to wrap every variable in a proxy,
- a requirement to instrument every line of JavaScript,
- a global event bus replacing existing APIs,
- an excuse to add metadata everywhere,
- a rewrite of working subsystems,
- a requirement that all state live in one object,
- a ban on local implementation details.

Use the existing diagnostics and APIs where they already provide sufficient visibility.

Add new handles only where a developer or agent otherwise cannot answer an ownership/provenance question that matters to correctness.

---

# 3. System manifests

Every substantial runtime subsystem that can authoritatively change shared state should have a small machine-readable manifest.

A manifest should be static or cheap to produce.

Conceptual shape:

```js
{
  systemId: "motion.acceleration",
  version: 1,
  kind: "resolver",
  owns: [
    "actor.motion.forwardAcceleration",
    "actor.motion.reverseAcceleration"
  ],
  modifies: [],
  observes: [
    "actor.locomotionMode",
    "world.surface",
    "world.altitudeBand"
  ],
  lifecycle: [
    "initialize",
    "resolve",
    "dispose"
  ],
  entryPoints: [
    "advanceMomentum"
  ]
}
```

The exact schema may evolve, but stable IDs and semantic ownership matter more than verbose metadata.

Small internal helpers do not need their own manifests unless they independently write shared authoritative state.

---

# 4. Target registry

Shared authoritative targets should be addressable by stable semantic IDs.

Examples:

```text
actor:player.motion.forwardVelocity
actor:player.motion.forwardAcceleration
actor:player.motion.gravity
camera:main.fov
camera:main.pose
terrain:dirt.runtime.profile
terrain:dirt.chunk:12,4.visibility
world:current.surfaceAt
scene:ocean.visibility
```

The registry does not need to hold every value itself.

It may be an index describing:
- the target ID,
- owning system,
- current resolver/adapter,
- allowed contributors,
- inspection function,
- lifecycle.

The purpose is to make the target discoverable to developers and agents.

---

# 5. Roles: owner, contributor, modifier, observer

Every shared-state interaction should fall into a small set of roles.

## Owner

The system responsible for the authoritative final value or lifecycle.

There should normally be one owner per target at a given semantic layer.

Example:

```text
actor.motion.forwardVelocity
owner = motion runtime
```

## Contributor

Provides one input to a resolver but does not directly own the final state.

Example:

```text
altitude band -> acceleration profile selection
surface -> acceleration profile selection
boost -> acceleration multiplier
```

## Modifier

Explicitly transforms an owned value according to a declared operation.

Examples:
- multiply
- add
- clamp
- blend

Modifiers must be declared. Incidental assignment is not a modifier contract.

## Observer

Reads state or receives events but must not mutate the authoritative target.

Examples:
- HUD
- diagnostics
- performance capture
- debug inspector

This distinction is important for debugging itself: a diagnostics system should normally be an **observer**, not another owner of gameplay state.

---

# 6. Collision definition

A collision occurs when two or more active systems make incompatible claims over the same semantic target.

Examples:

### Two owners

```text
motion-system -> forwardAcceleration = 70
legacy-travel-system -> forwardAcceleration = 4
```

If both believe they are the authoritative base value, that is a collision.

### Two lifecycle owners

```text
terrain scheduler -> dispose chunk
LOD manager -> dispose same chunk independently
```

If neither knows the other exists, object lifetime is ambiguous.

### Two render visibility authorities

```text
distance LOD -> mesh.visible = false
cinematic layer -> mesh.visible = true
```

If both assign directly, final behavior depends on execution order.

### Two diagnostics systems altering runtime behavior

```text
profiler A wraps update and throttles it
profiler B independently wraps update and changes scheduling
```

If both are intended only to observe, this is a forbidden collision.

### Valid composition is not a collision

```text
base acceleration = 70
altitude modifier × 1.3
surface modifier × 0.9
boost modifier × 1.4
```

This is valid if the roles and operators are explicit and one resolver computes the final expression.

---

# 7. Collision classes

Use a small shared vocabulary.

## OWNERSHIP_COLLISION

Two systems claim authoritative ownership of the same target.

## WRITE_COLLISION

Multiple systems write the same target without a declared composition/resolution contract.

## LIFECYCLE_COLLISION

Multiple systems independently create, destroy, reset, activate, or dispose the same semantic object.

## ORDER_DEPENDENCY

Correctness depends on incidental callback/event/frame ordering that is not declared.

## OBSERVER_MUTATION

A system classified as an observer changes authoritative state.

## DUPLICATE_PIPELINE

Two systems independently calculate the same semantic result.

Example: two acceleration pipelines or two competing terrain visibility pipelines.

## STALE_AUTHORITY

A legacy system remains capable of writing a target after a replacement system has become authoritative.

## HIDDEN_SIDE_EFFECT

A public API/handler appears to perform one operation but mutates unrelated shared targets without declaring them.

These classes should be reusable by tests, runtime inspection, and agent tooling.

---

# 8. Resolution contracts

When more than one system legitimately influences a target, there must be one explicit resolver.

Example:

```text
target:
actor:player.motion.forwardAcceleration

owner:
motion.resolver

contributors:
locomotion.flight
altitude.cruise
surface.dirt
effect.boost

resolution:
base
  -> altitude multiplier
  -> surface multiplier
  -> temporary effect multiplier
  -> safety bound

final:
82.53
```

The exact order must be deterministic and inspectable.

Do not use:
- object spread order,
- import order,
- callback registration order,
- event listener order,
- frame timing,
- “whichever ran last”

as hidden resolution policy.

---

# 9. Provenance chain

For compliant shared targets, ÆXIS should preserve enough provenance to answer:

> Where did this value come from?

Conceptual machine-readable result:

```json
{
  "target": "actor:player.motion.forwardAcceleration",
  "value": 82.53,
  "owner": "motion.resolver",
  "contributors": [
    {
      "system": "locomotion.flight",
      "role": "base",
      "operation": "replace",
      "value": 70
    },
    {
      "system": "altitude.cruise",
      "role": "modifier",
      "operation": "multiply",
      "value": 1.3
    },
    {
      "system": "surface.dirt",
      "role": "modifier",
      "operation": "multiply",
      "value": 0.907
    }
  ],
  "conflicts": []
}
```

This is the foundation for both human and agent debugging.

---

# 10. Developer and agent inspection surface

Do not create a separate debugger if the existing world/programmer APIs can host these operations.

Provide operations conceptually equivalent to:

```text
systems.list()
systems.inspect(systemId)
systems.targets(systemId)

targets.inspect(targetId)
targets.writers(targetId)
targets.observers(targetId)
targets.explain(targetId)

collisions.list()
collisions.inspect(collisionId)

graph.trace(targetId)
graph.traceSystem(systemId)
```

Names may follow existing repository conventions.

The important requirement is programmatic access.

A developer or agent should be able to ask:
- “Who can write this?”
- “Who wrote it?”
- “What is observing it?”
- “What owns its lifecycle?”
- “What changed since the previous frame/state transition?”
- “Are two systems duplicating responsibility?”

without scraping console text.

Human-readable debug UI may be layered on the same structured results.

---

# 11. Static map + runtime activation

The system map has two useful levels.

## Static capability map

What systems **can** affect a target.

Example:

```text
forwardAcceleration can be affected by:
- locomotion mode
- altitude band
- surface profile
- temporary boost
- creator override
```

## Runtime activation map

What systems **are currently** affecting it.

Example:

```text
currently active:
- locomotion.flight
- altitude.upper-atmosphere
- surface.ocean
- boost.off
```

This distinction prevents false collision reports merely because two systems are capable of affecting the same target in mutually exclusive conditions.

---

# 12. JavaScript/browser-specific sources of hidden behavior

ÆXIS should explicitly account for common browser-side sources of invisible interaction.

When they modify shared authoritative state, they must be attributable to a system ID.

Important sources include:

- `requestAnimationFrame`
- `setTimeout` / `setInterval`
- DOM event listeners
- custom events
- promises / async continuations
- worker messages
- observers
- loader callbacks
- Three.js `onBeforeCompile`
- scene graph lifecycle changes
- cached state
- module-level mutable state
- browser visibility/focus events
- input handlers
- editor callbacks
- API callbacks

We do **not** instrument all of them globally.

We require shared-state mutations originating from them to enter through known subsystem boundaries.

---

# 13. Handles and footholds

A **handle** is the smallest programmatic entry point needed to inspect or control one existing subsystem without reimplementing it.

Examples:
- inspect current dirt renderer profile
- inspect terrain scheduler cache
- inspect current motion composition
- inspect active camera controller
- inspect current world scale
- inspect authoritative surface sample

A handle is justified when:
1. the subsystem owns or materially contributes to shared state,
2. no existing API can explain that state,
3. future agents would otherwise need to reverse-engineer private implementation details.

A handle is **not** justified merely because more telemetry might be interesting.

Before adding a new handle, check whether an existing programmer API, diagnostics API, or inspector can expose the needed information.

---

# 14. Debugging systems follow the same rule

Debug systems are not exempt.

Every diagnostics/profiling system should declare:
- what it observes,
- whether it wraps or intercepts execution,
- whether it may alter scheduling,
- whether it stores history,
- whether it is safe to run alongside another profiler.

Two debugging tools that both modify the same timing/update path must be treated as a potential collision.

The preferred model is:

```text
authoritative runtime
     ↓
structured events / inspection handles
     ↓
one or more read-only observers
```

rather than:

```text
runtime
 ↓
wrapper debugger A
 ↓
wrapper debugger B
 ↓
runtime behavior changes
```

---

# 15. Replacement rule: old systems must lose authority

When a new implementation replaces an old one, do not merely stop calling the old code “most of the time.”

The old system should explicitly lose write authority.

A migration should record:

```text
target: terrain:dirt.nearGeometry
old owner: legacy-grid-renderer
new owner: compiled-chunk-renderer
status: legacy owner disabled
```

Tests should fail if the deprecated owner becomes active in a production path.

This directly addresses the earlier ÆXIS dirt problem where an old `near / 9409` terrain path could still be mistaken for the new compiled path.

---

# 16. Change protocol

Before changing an existing shared target, an agent/developer should perform a short ownership check:

1. Identify the semantic target.
2. Find its current owner.
3. Find known contributors/modifiers.
4. Find lifecycle owner if the target is an object/resource.
5. Check whether a replacement/legacy system exists.
6. Decide whether the change modifies an existing resolver or introduces a genuinely new domain.
7. Add a new system only if no existing owner can correctly absorb the responsibility.
8. Update the system/target map with the change.

This should become standard practice for ÆXIS changes.

---

# 17. Agent workflow

Before implementing a cross-system change, an agent should be able to issue a structured query equivalent to:

```text
trace target actor:player.motion.forwardAcceleration
```

and receive:
- owner,
- allowed contributors,
- current contributors,
- source files/entry points,
- current value,
- resolution rule,
- collision state.

For a scene/resource target:

```text
trace target terrain:dirt.chunk:12,4
```

should identify:
- scheduler owner,
- renderer owner,
- geometry lifecycle,
- visibility resolver,
- cache owner,
- diagnostic observers.

This reduces the chance that an agent “fixes” a symptom by adding a second system.

---

# 18. Minimal implementation strategy

Do not attempt to register the entire codebase at once.

### Phase 1 — critical shared targets

Start with systems currently under active development:

- expansive dirt renderer
- dirt chunk scheduler
- world/surface authority
- flight/motion state
- travel-region rules
- camera controller
- altitude context

### Phase 2 — replacement/collision assertions

Add cheap assertions/tests for known high-risk collisions:
- legacy dirt renderer vs compiled dirt renderer
- multiple acceleration owners
- multiple gravity owners
- duplicate camera FOV authorities
- duplicate chunk lifecycle owners

### Phase 3 — API inspection

Expose existing system manifests and target provenance through the current programmer/agent API.

### Phase 4 — broader adoption

As subsystems are touched, register them.

Do not perform a repository-wide instrumentation rewrite.

---

# 19. Required qualities

The framework must remain:

- deterministic,
- lightweight,
- renderer-independent where possible,
- programmatically inspectable,
- usable by developers and agents,
- bounded in memory,
- compatible with the ~4 GB target,
- explicit about unsupported/unregistered areas,
- additive to existing diagnostics rather than competitive with them.

---

# 20. Acceptance criteria

This standard is useful when all of the following are true:

1. A developer can identify the authoritative owner of a registered shared target.
2. An agent can programmatically retrieve the same information.
3. Multiple legitimate contributors use an explicit resolver.
4. Multiple illegitimate writers are detectable as a collision.
5. A diagnostics system can be distinguished from an authoritative system.
6. Replaced legacy systems can be proven inactive.
7. Object lifecycle ownership can be traced.
8. Runtime ordering is not silently used as a conflict-resolution mechanism.
9. Existing APIs/diagnostics are reused where sufficient.
10. New handles are added only where they close a real inspection gap.
11. The system can explain both:
   - “Why does this work?”
   - “Why did this stop working?”

---

# 21. Core ÆXIS standard

> **Every important shared runtime result should have one inspectable expression, even when many systems contribute to it.**

> **Every contributing system should declare what it owns, what it modifies, and what it merely observes.**

> **If two systems can silently fight over the same target, ÆXIS should treat that as an architectural defect, not an ordinary debugging surprise.**

This is the intended meaning of:

# Single Plane Expression, Multiple Plane Collision Avoidance

The goal is not less complexity.

The goal is **known complexity**.
