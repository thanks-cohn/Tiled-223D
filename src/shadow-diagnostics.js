export const SHADOW_TRACE_SCHEMA_VERSION="1.0.0";
const clone=value=>value===undefined?undefined:structuredClone(value);
const finite=(value)=>Number.isFinite(value);
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
const error=(code,message)=>({schemaVersion:SHADOW_TRACE_SCHEMA_VERSION,error:{code,message}});
const overlap=(a,b)=>!a||!b?true:!(a.maxU<b.minU||a.minU>b.maxU||a.maxV<b.minV||a.minV>b.maxV);
const pointIn=(p,b)=>!p||!b?true:p.u>=b.minU&&p.u<=b.maxU&&p.v>=b.minV&&p.v<=b.maxV;

/** Bounded, capture-on-demand evidence store. It never traverses a scene. */
export function createShadowDiagnostics({diagnostics,readFrame,now=()=>performance.now(),maxFrames=24,maxBytes=262144}={}){
 if(!diagnostics||typeof readFrame!=="function")throw Error("Invalid shadow diagnostics adapter");
 let history=[],usedBytes=0,captures=0;
 const disabled=()=>error("DIAGNOSTICS_DISABLED","Shadow tracing requires Deep Debug mode.");
 const trim=()=>{while(history.length>maxFrames||usedBytes>maxBytes){const old=history.shift();usedBytes-=old._traceBytes;}};
 const capture=({reason="explicit-shadow-capture",frame=null}={})=>{
  if(diagnostics.mode!=="deep")return disabled();
  const raw=readFrame(frame);if(!raw)return error("FRAME_DATA_UNAVAILABLE","A completed render frame is required.");
  const record={schemaVersion:SHADOW_TRACE_SCHEMA_VERSION,runId:raw.runId,frameId:raw.frameId,
   timestampMs:raw.timestampMs??now(),reason:String(reason).slice(0,120),status:"captured",
   provenance:{sample:"completed-render-frame",pixelAttribution:"unverified",gpuDepth:"unavailable"},...clone(raw)};
  if(!record.runId||!finite(record.frameId))return error("INVALID_FRAME_DATA","runId and numeric frameId are required.");
  record.anomalies=detectShadowAnomalies(record);record._traceBytes=bytes(record);captures++;
  if(record._traceBytes>maxBytes)return error("TRACE_BUDGET_EXCEEDED","One trace exceeds the byte budget.");
  history.push(record);usedBytes+=record._traceBytes;trim();return clean(record);
 };
 const find=id=>history.find(item=>item.frameId===id);
 const clean=value=>{const out=clone(value);if(out)delete out._traceBytes;return out;};
 const contributors=({frameId,viewportPoint,region}={})=>{
  if(diagnostics.mode!=="deep")return disabled();const item=frameId===undefined?history.at(-1):find(frameId);
  if(!item)return error("FRAME_NOT_CAPTURED","Capture the requested completed frame first.");
  return {schemaVersion:SHADOW_TRACE_SCHEMA_VERSION,runId:item.runId,frameId:item.frameId,
   coordinateSpace:"normalized-viewport",units:"u,v (top-left origin)",pixelAttribution:"unverified",
   contributors:(item.contributors||[]).filter(c=>pointIn(viewportPoint,c.viewportBounds)&&overlap(region,c.viewportBounds)).map(clone)};
 };
 return Object.freeze({
  inspect(){if(diagnostics.mode==="performance")return disabled();if(diagnostics.mode==="debug")return {schemaVersion:SHADOW_TRACE_SCHEMA_VERSION,status:"light",mode:"debug",captures:history.length};return history.length?clean(history.at(-1)):error("NO_CAPTURE","Request a completed-frame shadow capture.");},
  getContributors:contributors,capture,
  history({limit=12}={}){if(diagnostics.mode!=="deep")return disabled();const n=Math.max(0,Math.min(24,Math.floor(limit)));return history.slice(-n).map(clean);},
  transition(beforeFrameId,afterFrameId){if(diagnostics.mode!=="deep")return disabled();const a=find(beforeFrameId),b=find(afterFrameId);if(!a||!b)return error("FRAME_NOT_CAPTURED","Both completed frames must be captured.");return compareShadowFrames(a,b);},
  explain({frameId,entityId,region}={}){if(diagnostics.mode!=="deep")return disabled();const item=frameId===undefined?history.at(-1):find(frameId);if(!item)return error("FRAME_NOT_CAPTURED","Capture the requested frame first.");const candidates=contributors({frameId:item.frameId,region});const selected=entityId?(item.contributors||[]).filter(x=>x.entityId===entityId):candidates.contributors;return {schemaVersion:SHADOW_TRACE_SCHEMA_VERSION,runId:item.runId,frameId:item.frameId,entityId:entityId??null,findings:item.anomalies,candidates:selected,pixelAttribution:"unverified",conclusion:selected.length===1?`Candidate ${selected[0].entityId}; GPU pixel attribution remains unverified.`:"Multiple or no candidates; do not identify the circle from color alone.",nextActions:["Isolate one candidate with the authorized display-only preview.","Capture before and after at completed frame boundaries.","Compare world extents, effective mesh extents, and projected boundary points."]};},
  stats(){return {captures,retained:history.length,bytes:usedBytes,maxFrames,maxBytes};}
 });
}

export function detectShadowAnomalies(frame){
 const out=[],shadow=frame.shadow,mesh=frame.presentation?.mesh;
 const add=(code,severity,evidence)=>out.push({code,severity,evidence});
 if(!shadow||!mesh)add("MISSING_SHADOW_DATA","WARNING",{shadow:Boolean(shadow),mesh:Boolean(mesh)});
 else{
  const expectedX=shadow.postClampRadius*shadow.elongation,expectedZ=shadow.postClampRadius;
  const tolerance=Math.max(.001,Math.abs(expectedZ)*.002);
  if(!finite(mesh.effectiveRadiusX)||!finite(mesh.effectiveRadiusZ))add("INVALID_NUMERIC_INPUT","CONFIRMED",{});
  else if(Math.abs(mesh.effectiveRadiusX-expectedX)>tolerance||Math.abs(mesh.effectiveRadiusZ-expectedZ)>tolerance)add("EFFECTIVE_RADIUS_MISMATCH","CONFIRMED",{expected:{x:expectedX,z:expectedZ},actual:{x:mesh.effectiveRadiusX,z:mesh.effectiveRadiusZ},tolerance});
  if(mesh.parentId!=="scene")add("WRONG_SHADOW_PARENT","CONFIRMED",{actual:mesh.parentId,expected:"scene"});
  if(frame.presentation?.duplicateCount>0)add("DUPLICATE_SHADOW_MESH","CONFIRMED",{duplicateCount:frame.presentation.duplicateCount});
  if(finite(mesh.opacity)&&Math.abs(mesh.opacity-shadow.effectiveAlpha)>.002)add("ALPHA_MISMATCH","CONFIRMED",{model:shadow.effectiveAlpha,material:mesh.opacity});
 }
 for(const c of frame.contributors||[])if(c.entityId!=="ship-ocean-shadow"&&c.overlapsShadow&&c.unexpectedOverlap)add("OVERLAPPING_BLUE_CONTRIBUTOR","WARNING",{entityId:c.entityId,pixelAttribution:"unverified"});
 if(frame.projection?.shadow?.viewportAreaFraction>.8)add("PROJECTED_FOOTPRINT_FILLS_VIEWPORT","WARNING",{areaFraction:frame.projection.shadow.viewportAreaFraction,cameraDependentTolerance:true});
 return out;
}

export function compareShadowFrames(a,b){
 const categories=[];const changed=(x,y)=>JSON.stringify(x)!==JSON.stringify(y);
 if(changed(a.physical?.ship?.position,b.physical?.ship?.position))categories.push("physical-travel-or-altitude-change");
 if(a.physical?.scale?.id!==b.physical?.scale?.id)categories.push("profile/world-scale-transform");
 if(changed(a.camera,b.camera))categories.push("camera-pose/FOV");
 if(changed(a.shadow?.moodWeights,b.shadow?.moodWeights))categories.push("preset/mood-mix");
 if(changed(a.presentation?.mesh?.resource,b.presentation?.mesh?.resource))categories.push("mesh-recreation");
 if(changed(a.viewport,b.viewport))categories.push("viewport-resize/DPR");
 const mapping=a.physical?.scale&&b.physical?.scale?{from:a.physical.scale.id,to:b.physical.scale.id,relativeBefore:a.physical.scale.relativePosition,relativeAfter:b.physical.scale.relativePosition}:null;
 return {schemaVersion:SHADOW_TRACE_SCHEMA_VERSION,runId:b.runId,beforeFrameId:a.frameId,afterFrameId:b.frameId,causeCategories:categories.length?categories:["uncertainty"],declaredScaleMapping:mapping,beforeAnomalies:a.anomalies,afterAnomalies:b.anomalies,pixelAttribution:"unverified"};
}
