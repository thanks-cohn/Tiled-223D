export const DEVELOPMENT_SCHEMA_VERSION="1.0.0";
export const DEVELOPMENT_SCOPES=Object.freeze(["inspect","replay","capture","adjust","experiment"]);
const copy=value=>value===undefined?undefined:structuredClone(value);
const denied=(code="UNAUTHORIZED",message="A trusted user must authorize development access.")=>({error:{code,message}});
const finiteObject=(value,keys)=>value&&keys.every(key=>Number.isFinite(value[key]));
const byteLength=value=>new TextEncoder().encode(JSON.stringify(value)).length;

// This controller is deliberately capability-based. Only application code gets
// grantAuthorization; assets and the public facade cannot mint permissions.
export function createSpatialDevelopmentController({diagnostics,adapter,now=()=>performance.now(),
 maxReplayFrames=1800,maxReplayBytes=1_048_576,maxCaptures=48,maxCaptureBytes=524_288}={}){
 if(!diagnostics||!adapter||![maxReplayFrames,maxReplayBytes,maxCaptures,maxCaptureBytes].every(Number.isFinite))
  throw Error("Invalid spatial development controller");
 let grant=null,recording=null,replay=null,pending=[],captureBytes=0,captureSequence=0;
 const captures=[],experiments=new Map(),adjustments=[];
 const allowed=scope=>grant&&grant.expiresAt>now()&&grant.scopes.has(scope);
 const requireScope=scope=>allowed(scope)?null:denied(grant?"SCOPE_DENIED":"UNAUTHORIZED",
  `Authorized ${scope} scope is required.`);
 const publicStatus=()=>({schemaVersion:DEVELOPMENT_SCHEMA_VERSION,authorized:Boolean(grant&&grant.expiresAt>now()),
  scopes:grant&&grant.expiresAt>now()?[...grant.scopes]:[],recording:Boolean(recording),
  replaying:Boolean(replay),captures:captures.length,adjustments:adjustments.length,
  budgets:{maxReplayFrames,maxReplayBytes,maxCaptures,maxCaptureBytes}});
 const validateBundle=bundle=>{
  if(!bundle||bundle.schemaVersion!==DEVELOPMENT_SCHEMA_VERSION||!Array.isArray(bundle.frames)||
   !bundle.frames.length||bundle.frames.length>maxReplayFrames)throw Error("Invalid or oversized replay bundle");
  if(byteLength(bundle)>maxReplayBytes)throw Error("Replay bundle exceeds byte budget");
  bundle.frames.forEach((frame,index)=>{
   if(frame.index!==index||!Number.isFinite(frame.dt)||frame.dt<=0||frame.dt>.05||!frame.controls)
    throw Error("Invalid deterministic replay frame");
  });
 };
 const capture=(request,frame)=>{
  const state={schemaVersion:DEVELOPMENT_SCHEMA_VERSION,captureId:request.id,
   frameId:frame.frameId,timestampMs:frame.timestampMs,reason:request.reason,
   physical:copy(frame.physical),camera:copy(frame.camera),visual:copy(frame.visual),
   projection:copy(frame.projection),presentation:copy(frame.presentation),image:null,
   observationalLimits:["depth occlusion unknown without explicit readback","GPU shader deformation sampled on CPU only"]};
  if(request.includeImage&&typeof adapter.captureImage==="function"){
   const image=adapter.captureImage();
   if(typeof image==="string"&&byteLength(image)<=request.maxImageBytes)state.image=image;
   else state.imageError="IMAGE_UNAVAILABLE_OR_OVER_BUDGET";
  }
  const size=byteLength(state);state.byteLength=size;
  while(captures.length>=maxCaptures||captureBytes+size>maxCaptureBytes){
   const old=captures.shift();if(!old)break;captureBytes-=old.byteLength;
  }
  if(size<=maxCaptureBytes){captures.push(state);captureBytes+=size;}
  diagnostics.record("synchronized-frame-capture",{objectId:"ship-visible",coordinateSpace:"multi-space",
   causeId:request.reason,captureId:request.id,frameId:frame.frameId});
  return state;
 };
 const facade=Object.freeze({
  status:publicStatus,
  inspect(id,options){const error=requireScope("inspect");return error||diagnostics.getObjectSpatialState(id,options);},
  createMassiveOverviewReproduction(){const error=requireScope("replay");if(error)return error;
   // Fixed-step, deterministic controls cover every camera policy and the old
   // 185-unit threshold in both ascent and descent, then rapid retargeting.
   const frames=[];const push=(count,controls)=>{for(let i=0;i<count;i++)frames.push({index:frames.length,dt:1/60,controls:{...controls}});};
   const verificationMatrix=[];
   for(const [band,targetNormalizedAltitude] of [["low",35],["middle",130],["high",260],["top",445]]){
    push(120,{scale:"massive",camera:"auto",climb:1,forward:0});
    for(const camera of ["forward","overview","auto"]){
     verificationMatrix.push({band,camera,targetNormalizedAltitude,frameIndex:frames.length});
     push(12,{scale:"massive",camera,climb:1,forward:camera==="overview"?1:0});
    }
   }
   // Exercise rapid interruption from the current interpolation, then descend.
   push(12,{scale:"massive",camera:"forward",climb:0,forward:1});
   push(12,{scale:"massive",camera:"overview",climb:0,forward:1});
   push(240,{scale:"massive",camera:"auto",climb:-1,forward:0});
   const checkpoint=copy(adapter.readPhysicalState());checkpoint.worldScale="massive";
   return {schemaVersion:DEVELOPMENT_SCHEMA_VERSION,name:"massive-overview-ascent-toggle-descent",
    fixedStepSeconds:1/60,checkpoint,verificationMatrix,frames};
  },
  startRecording(metadata={}){const error=requireScope("replay");if(error)return error;
   recording={metadata:copy(metadata),checkpoint:copy(adapter.readPhysicalState()),frames:[],bytes:0,startedAt:now()};
   return {ok:true,checkpoint:copy(recording.checkpoint)};},
  stopRecording(){const error=requireScope("replay");if(error)return error;if(!recording)return denied("NOT_RECORDING","No replay recording is active.");
   const bundle={schemaVersion:DEVELOPMENT_SCHEMA_VERSION,metadata:recording.metadata,
    fixedStepSeconds:1/60,checkpoint:recording.checkpoint,frames:recording.frames,stoppedAt:now()};recording=null;return bundle;},
  loadReplay(bundle){const error=requireScope("replay");if(error)return error;validateBundle(bundle);
   adapter.restorePhysicalState(copy(bundle.checkpoint),"development-replay-checkpoint");
   replay={bundle:copy(bundle),cursor:0};diagnostics.record("replay-start",{objectId:"pilot",coordinateSpace:"authoritative-world",causeId:bundle.name||"loaded-replay"});
   return {ok:true,frames:bundle.frames.length};},
  stopReplay(){const error=requireScope("replay");if(error)return error;replay=null;return {ok:true};},
  requestFrameCapture({reason="agent-request",includeImage=false,maxImageBytes=131072}={}){const error=requireScope("capture");if(error)return error;
   if(!Number.isFinite(maxImageBytes)||maxImageBytes<0||maxImageBytes>262144)return denied("INVALID_CAPTURE_LIMIT","Invalid image byte limit.");
   const request={id:`capture-${Math.round(now())}-${++captureSequence}`,reason:String(reason).slice(0,120),includeImage,maxImageBytes};pending.push(request);return copy(request);},
  listCaptures(){const error=requireScope("capture");return error||copy(captures);},
  applyPreview(patch,label="agent-preview"){const error=requireScope("adjust");if(error)return error;
   const valid=patch&&Object.keys(patch).length&&Object.keys(patch).every(key=>["anchorU","anchorV","heightFraction","transitionSeconds","fovBiasDegrees"].includes(key))&&
    Object.values(patch).every(Number.isFinite);
   if(!valid||patch.anchorU<0||patch.anchorU>1||patch.anchorV<0||patch.anchorV>1||patch.heightFraction<=0||patch.heightFraction>.5||
    patch.transitionSeconds<=0||patch.transitionSeconds>5||Math.abs(patch.fovBiasDegrees)>15)
    return denied("INVALID_PRESENTATION_PATCH","Only bounded visual/camera presentation values are accepted.");
   const before=copy(adapter.readPresentation());adapter.applyPresentation(copy(patch),"development-preview");
   const change={id:`adjustment-${adjustments.length+1}`,label:String(label).slice(0,80),before,patch:copy(patch),timestampMs:now()};adjustments.push(change);
   diagnostics.record("presentation-preview",{objectId:"ship-visible",coordinateSpace:"visual-presentation",before,after:adapter.readPresentation(),causeId:change.id});return copy(change);
  },
  rollback(adjustmentId){const error=requireScope("adjust");if(error)return error;const index=adjustments.findIndex(item=>item.id===adjustmentId);if(index<0)return denied("UNKNOWN_ADJUSTMENT","Adjustment does not exist.");
   const change=adjustments[index];adapter.restorePresentation(copy(change.before),"development-rollback");adjustments.splice(index);
   diagnostics.record("presentation-rollback",{objectId:"ship-visible",coordinateSpace:"visual-presentation",causeId:adjustmentId});return {ok:true,presentation:copy(adapter.readPresentation())};},
  beginExperiment(name){const error=requireScope("experiment");if(error)return error;const id=`experiment-${experiments.size+1}`;
   experiments.set(id,{id,name:String(name).slice(0,80),baseline:[],candidate:[],createdAt:now()});return {id};},
  addExperimentCapture(id,arm,captureId){const error=requireScope("experiment");if(error)return error;const experiment=experiments.get(id),item=captures.find(x=>x.captureId===captureId);
   if(!experiment||!item||!["baseline","candidate"].includes(arm))return denied("INVALID_EXPERIMENT_REFERENCE","Unknown experiment, arm, or capture.");experiment[arm].push(copy(item));return {ok:true};},
  compareExperiment(id){const error=requireScope("experiment");if(error)return error;const experiment=experiments.get(id);if(!experiment)return denied("UNKNOWN_EXPERIMENT","Experiment does not exist.");
   const metrics=arm=>arm.map(item=>({frameId:item.frameId,u:item.projection?.visible?.viewport?.u??null,v:item.projection?.visible?.viewport?.v??null,
    heightFraction:item.presentation?.heightFraction??null,physical:item.physical?.position??null,parentId:item.visual?.parentId??null}));
   const baselineMetrics=metrics(experiment.baseline),candidateMetrics=metrics(experiment.candidate),count=Math.min(baselineMetrics.length,candidateMetrics.length);
   const pairs=Array.from({length:count},(_,index)=>{const a=baselineMetrics[index],b=candidateMetrics[index];return {
    viewportDelta:[a.u,a.v,b.u,b.v].every(Number.isFinite)?Math.hypot(b.u-a.u,b.v-a.v):null,
    physicalDelta:finiteObject(a.physical,["x","y","z"])&&finiteObject(b.physical,["x","y","z"])?Math.hypot(b.physical.x-a.physical.x,b.physical.y-a.physical.y,b.physical.z-a.physical.z):null,
    parentChanged:a.parentId!==b.parentId};});
   const known=key=>pairs.map(pair=>pair[key]).filter(Number.isFinite);
   const viewport=known("viewportDelta"),physical=known("physicalDelta");
   return {...copy(experiment),baselineMetrics,candidateMetrics,comparison:{pairedFrames:count,
    meanViewportDelta:viewport.length?viewport.reduce((a,b)=>a+b,0)/viewport.length:null,
    maxPhysicalDelta:physical.length?Math.max(...physical):null,parentChanges:pairs.filter(pair=>pair.parentChanged).length}};
  },
  explainDiscontinuity(beforeCaptureId,afterCaptureId){const error=requireScope("inspect");if(error)return error;
   const before=captures.find(x=>x.captureId===beforeCaptureId),after=captures.find(x=>x.captureId===afterCaptureId);if(!before||!after)return denied("UNKNOWN_CAPTURE","Capture does not exist.");
   const p0=before.physical?.position,p1=after.physical?.position,v0=before.projection?.visible?.viewport,v1=after.projection?.visible?.viewport;
   const physicalDelta=finiteObject(p0,["x","y","z"])&&finiteObject(p1,["x","y","z"])?Math.hypot(p1.x-p0.x,p1.y-p0.y,p1.z-p0.z):null;
   const viewportDelta=finiteObject(v0,["u","v"])&&finiteObject(v1,["u","v"])?Math.hypot(v1.u-v0.u,v1.v-v0.v):null;
   const causes=[];if(before.visual?.parentId!==after.visual?.parentId)causes.push("render-parent-change");if(JSON.stringify(before.camera)!==JSON.stringify(after.camera))causes.push("camera-or-projection-change");if(physicalDelta>1e-6)causes.push("physical-motion");
   return {beforeCaptureId,afterCaptureId,physicalDelta,viewportDelta,causes:causes.length?causes:["unknown"],
    classification:physicalDelta<=1e-6&&viewportDelta>.02?"visual-discontinuity-without-physical-teleport":"continuous-or-physical-change"};
  },
  exportReproBundle(){const error=requireScope("replay");if(error)return error;return {schemaVersion:DEVELOPMENT_SCHEMA_VERSION,
   exportedAt:now(),status:publicStatus(),captures:copy(captures),events:diagnostics.exportJSONL(),presentation:copy(adapter.readPresentation())};}
 });
 return {
  facade,
  grantAuthorization({trustedUserGesture=false,scopes=DEVELOPMENT_SCOPES,ttlMs=15*60_000}={}){
   if(!trustedUserGesture)return denied("TRUSTED_GESTURE_REQUIRED","Use the in-app authorization control.");
   if(!Array.isArray(scopes)||!scopes.every(scope=>DEVELOPMENT_SCOPES.includes(scope))||!Number.isFinite(ttlMs)||ttlMs<1000||ttlMs>3_600_000)
    return denied("INVALID_GRANT","Invalid scopes or lifetime.");
   grant={scopes:new Set(scopes),expiresAt:now()+ttlMs};return publicStatus();
  },
  revoke(){grant=null;recording=null;replay=null;pending=[];adapter.restoreDefaultPresentation?.("development-access-revoked");return publicStatus();},
  needsFrameData(){return Boolean(recording||pending.length);},
  controlsForFrame(liveControls){if(!replay)return liveControls;const frame=replay.bundle.frames[replay.cursor++];if(!frame){replay=null;return liveControls;}adapter.applyReplayContext?.(frame.controls);return copy(frame.controls);},
  timestep(liveDt){return replay?replay.bundle.frames[replay.cursor]?.dt??liveDt:liveDt;},
  onFrame(frame){
   if(recording){const item={index:recording.frames.length,dt:frame.dt,controls:copy(frame.controls)};const size=byteLength(item);
    if(recording.frames.length<maxReplayFrames&&recording.bytes+size<=maxReplayBytes){recording.frames.push(item);recording.bytes+=size;}else diagnostics.record("replay-budget-reached",{objectId:"pilot",causeId:"bounded-memory-policy"});}
   const requests=pending.splice(0);return requests.map(request=>capture(request,frame));
  }
 };
}
