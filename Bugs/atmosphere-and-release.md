# Atmosphere, visuals and download/release issues

These are reports carried from V5–V8. Separate the symptom, code evidence and validation state.

## CLOUD-001 — Same five/six cloud positions repeat in Massive world

- Status: **confirmed design limitation; V8 procedural variation in progress, browser outcome unverified**.
- Actual: User reports a near-identical distant set of clouds at the same angles in Bigger/Massive; beneath the ship, planetary cloud patches repeat in a recognizable fixed sequence.
- Evidence: V7 `src/atmosphere-renderer.js` places six high clouds in a player-centered evenly spaced ring and six planetary patches at fixed fractions of world width and height. Low/middle decks sample a regular grid. That rigid choreography cannot generate non-repeating sky compositions.
- Expected: World-relative staggered and seeded formations with varied asymmetrical spacing, persistent visible identities and changed compositions as the ship crosses real distance. Upper distant scenery lasts longer than passing nearby cloud groups. No per-frame `Math.random()` or camera-following flyby cloud positions.
- Reproduce: Hover at low altitude then fly across large world, rotate and ascend; compare cloud arrangement before/after travel, count repeated positions and abrupt swaps.

## CLOUD-002 — Clouds appear the same size and shape; slow cruising feels visually flat

- Status: **confirmed source limitation; V8 work in progress**.
- Actual: User sees uniform clouds; high-speed travel disguises repetition but stationary/slow sky is not cinematic.
- Evidence: V7 uses a single 128×64 generated cloud sprite texture with only tiny slot-index size differences.
- Expected: Small shared pool of a few genuinely distinct cloud families, correlated but non-identical sizes/proportions/opacity and intentional clear-sky gaps, layered sky bands and occasional larger formations. Reuse texture/geometry and existing fixed sprite pool. Do not generate costly brand-new textures each frame.
- Verification: At hover, each of the four layers has visible compositional variety, not a repeated five-cloud ring; at speed, distinct nearby cloud flybys remain visible.

## CLOUD-003 — Altitude-specific parallax must communicate speed AND scale

- Status: **explicit design requirement, V8 implementation in progress**.
- User-defined four experiences: 1) low "California highway" cruise, beautiful slow upper sky with small near flybys; 2) mid-level acceleration, fast close clouds against persistent upper ones; 3) high expansive flight, compelling separate motion above/below but still fast; 4) orbital view where broad clouds follow the planet, while surrounding scenery changes as real travel occurs.
- Expected: A cloud has a real stable anchor while visible; layer-specific distances, apparent velocities and replacement intervals depend on proximity to pilot, altitude, view direction and speed. Timers throttle updates but NEVER directly simulate fake travel. At extreme speed skip intermediary cloud-region assignments, preserve fixed work per update.
- Verify: Hover, cruise, Shift boost, climb and descend at all three world scales, check upper forms persist longer than fast nearby clouds where geometrically appropriate.

## CLOUD-004 — High-altitude cloud cards should lie parallel to the planet

- Status: **V7 implemented visual tangent-plane crossfade, browser outcome unverified**.
- Actual earlier: Clouds all billboard face camera even from orbit, looking upright or misplaced relative to globe.
- Expected: At large globe reveal, planes align their normals to the spherical ground's local outward radial direction; never show a blue translucent full-globe overlay obscuring islands. Preserve local low-altitude billboard atmosphere and smooth crossfade.

## CLOUD-005 — Cloud visibility, reachability and repeating horizon atmosphere

- Status: **historic reported issue; actual current browser outcome unverified**.
- Actual: Clouds were too distant or could not be reached despite seeing them; turning could make distant islands disappear abruptly; excessive blue haze marred geometry.
- Expected: Have some genuinely world-anchored reachable low formations and separate decorative distant layers; do not imply every sky-dome sprite can be touched. Distant island silhouettes must preserve position rather than replicate visible duplicates.

## SEC-001 — ZIP triggers Windows Security / Chrome malware detection

- Status: **unresolved separate release/security investigation**.
- Actual: User saw `Trojan:Script/Wacatac.B!ml` detection, identifying `extension/substrate-world.js` in repository ZIP; Chrome blocked the download. The original Tiled exporter was restored at the user's request.
- Source inspection found ordinary Tiled exporter code but does not prove archive safety or establish a false positive.
- Expected: Investigate exact artifact and security engine verdict, submit suspected false positive to vendor if justified, and/or repair any confirmed unsafe code. Do not advise turning off antivirus, forcing a blocked archive or deleting a legitimate feature without authorization. This issue is NOT fixed by V7/V8 rendering changes.

## PERF-002 — Cloud variation must preserve fixed low-memory workload

- Status: **design invariant; hardware result unverified**.
- Expected: Fixed pooled 27 logical clouds, bounded light texture atlas/family textures, no volumetric passes, no all-world cloud data or per-frame creation/deletion. Reassignment is limited per update; high-speed travel skips unseen cloud regions. Measure on the 4 GB Windows test machine before claiming success.
