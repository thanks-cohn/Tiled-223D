# Authorized Spatial Development Interface v1

This development-only browser API extends Spatial Truth without granting world assets filesystem, network, browser, or unrestricted mutation access. It is available at `window.tiledSpatialDevelopment`. Calls return structured `{error:{code,message}}` values when permission, scope, references, or bounds are invalid.

## Authorization and threat boundary

The public facade cannot authorize itself. A human must click **Authorize agent tools**; the application verifies the event is trusted, grants the five bounded scopes for 15 minutes, and enables Deep Debug. Synthetic script clicks have `isTrusted=false` and fail. Authorization expires, can be revoked by application code, and is never persisted. The scopes are:

- `inspect`: read registered semantic spatial state and explain captured discontinuities.
- `replay`: record bounded controls, restore an explicit physical checkpoint, replay fixed-step controls, and export a compact local reproduction bundle.
- `capture`: request a capture on the next completed render frame. Image capture is opt-in and byte-capped.
- `adjust`: preview only whitelisted presentation values and roll them back.
- `experiment`: assign synchronized captures to baseline/candidate arms and compare measured viewport/parent/physical values.

No interface evaluates source, imports a URL, uploads data, changes collision geometry, or offers arbitrary object/property mutation.

## Agent workflow: reproduce → measure → preview → compare → rollback

```js
const dev = window.tiledSpatialDevelopment;
dev.status(); // first confirm authorized=true
const replay = dev.createMassiveOverviewReproduction();
dev.loadReplay(replay);

const before = dev.requestFrameCapture({reason: "massive-before-preview"});
// capture resolves on the next completed rendered frame; inspect listCaptures()
const experiment = dev.beginExperiment("Massive lower-centre composition");
dev.addExperimentCapture(experiment.id, "baseline", before.id);

const adjustment = dev.applyPreview({
  anchorU: 0.5,
  anchorV: 0.70,
  heightFraction: 0.14,
  transitionSeconds: 0.7,
  fovBiasDegrees: -2
}, "candidate-A");
const after = dev.requestFrameCapture({reason: "massive-after-preview"});
dev.addExperimentCapture(experiment.id, "candidate", after.id);
dev.compareExperiment(experiment.id);
dev.explainDiscontinuity(before.id, after.id);
dev.rollback(adjustment.id);
```

Capture requests return immediately but their IDs only appear in `listCaptures()` after the next render boundary. Add an experiment reference only after that boundary. `explainDiscontinuity` calculates physical and visible viewport displacement and records render-parent/camera/projection changes; a visible jump with negligible physical displacement is classified separately from physical motion. It never guesses depth occlusion.

## Deterministic replay contract

`startRecording(metadata)` stores an authoritative checkpoint and only normalized controls plus bounded `dt` values. `stopRecording()` returns a versioned bundle. `loadReplay(bundle)` validates schema, ordering, time steps, frame count, and encoded size before restoring the checkpoint. The fixed built-in Massive sequence has 888 × 1/60-second frames: four ascent phases, a Forward/Overview/Auto verification matrix at low/middle/high/top targets, rapid interrupted toggles, then Auto descent. Every frame explicitly selects the Massive scale. Matrix frame indices are stable capture landmarks; the synchronized physical altitude remains the evidence of the reached band.

Replay deliberately changes physical state only when `loadReplay` restores the recorded checkpoint and when the ordinary flight integrator consumes replay controls. Presentation previews cannot write pilot coordinates, velocity, collision, world ID, map data, or authored geometry.

## Synchronized capture and experiments

A capture contains one frame ID and timestamp plus physical, camera, visible render, physical/displayed viewport projection, and presentation records from that same completed frame. An optional WebP canvas image is local and individually capped. Captures are FIFO bounded. Experiments store copies of selected captures, never a second world or render loop. `exportReproBundle()` includes captures, bounded JSONL events, active presentation settings, and budget/status metadata.

## Whitelisted preview values

| Property | Meaning | Bounds |
| --- | --- | --- |
| `anchorU`, `anchorV` | top-left normalized displayed-ship anchor | 0…1 |
| `heightFraction` | apparent viewport height target | >0…0.5 |
| `transitionSeconds` | composition retarget duration | >0…5 seconds |
| `fovBiasDegrees` | visual camera lens experiment | −15…15 degrees |

`applyPreview()` returns an adjustment ID and pre-change snapshot. `rollback(id)` restores that snapshot and removes that adjustment and newer ones, making rollback deterministic. Revocation restores defaults.

## Low-memory limits and Performance mode

Defaults are 1,800 replay frames, 1 MiB replay JSON, 48 synchronized captures, and 512 KiB capture metadata. Requested images are at most 256 KiB. Old captures are evicted FIFO; replay recording stops adding frames at its cap and records one bounded diagnostic reason. Normal Performance flight does not construct capture matrices, serialize records, take canvas images, traverse the scene, or allocate frame snapshots: `main.js` calls the capture path only while recording or a capture is pending.

## Exact old mathematical cause

The historical discontinuity combined two presentation operations while authoritative pilot coordinates remained continuous: camera mode handlers cleared `cameraInitialized`, making the next frame copy a different camera endpoint, while the Massive ship crossed a view/altitude policy and was reparented from scene space to a fixed camera-space transform. A synchronized before/after pair exposes unchanged `physical.position`, changed `visual.parentId`, camera/projection deltas, and displayed `(u,v)` displacement. The current implementation retains the existing camera pose and retargets visual composition from current interpolated state. The development interface lets an agent measure rather than infer this from screenshots.
