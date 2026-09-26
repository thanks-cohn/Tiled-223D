import {compileCanonical,compileProfile,createCompiledSampler,sourceKey,inspectCompiled,COMPILED_VERSION,WORLD_SIZES} from './compiled.js';
export const COMPILATION_OPERATIONS=['dirt.inspectCompilation','dirt.listCompiledProfiles','dirt.inspectCompiledAsset','dirt.planCompilation','dirt.previewCompilation','dirt.validateCompilation','dirt.compileProfile','dirt.inspectVisualAt','dirt.inspectPhysicalAt','dirt.diffCompiledProfiles','dirt.validateCompiledTerrain','dirt.inspectRuntimePerformance','dirt.explainStutter'];
export function compilationOperation(core,request){
 const op=request.operation,input=request.input||{},state=core.state,p=state.production,worldId=input.worldId||input.plan?.worldId||'current';
 const allowed=new Set(['worldId','policy','plan','position','coordinateSpace','atMs']);
 if(Object.keys(input).some(k=>!allowed.has(k)))throw Error('INVALID_REQUEST: unsupported compilation input');
 if(op==='dirt.compileProfile'&&Object.keys(input).some(k=>k!=='plan'))throw Error('INVALID_REQUEST: compile only the reviewed input.plan');
 core.compiledAssets??=new Map();
 const key=sourceKey(p),policy=input.policy||input.plan?.policy||state.policy;
 if(!WORLD_SIZES[worldId])throw Error('INVALID_PROFILE');
 const freshSource=core.compiledSource?.metadata.sourceKey===key;
 const asset=core.compiledAssets.get(worldId),fresh=freshSource&&asset?.profile.sourceKey===key&&JSON.stringify(asset.profile.policy)===JSON.stringify(policy);
 if(op==='dirt.inspectRuntimePerformance'||op==='dirt.explainStutter'){
  if(!core.runtimeObserver)throw Error('RUNTIME_UNAVAILABLE: CLI cannot observe a separate live browser');
  const data=core.runtimeObserver();if(op==='dirt.inspectRuntimePerformance')return data;
  const at=input.atMs;if(!Number.isFinite(at)||at<0)throw Error('INVALID_COORDINATE');
  const events=data.events.filter(e=>Math.abs(e.atMs-at)<=1000).slice(-32);
  return {atMs:at,events,explanation:events.some(e=>e.type==='terrain-mesh-build')?'Terrain CPU work occurred in this window; compare event start/end with frame gaps.':'No retained terrain-build evidence in this window. Inspect browser timeline for unrelated tasks, throttling or GPU work.',gpuCause:'not-observed'};
 }
 if(op==='dirt.listCompiledProfiles'||op==='dirt.inspectCompilation')return {schemaVersion:COMPILED_VERSION,sourceKey:key,profiles:['current','bigger','massive'].map(id=>{const a=core.compiledAssets.get(id);return {worldId:id,state:!a?'missing':a.profile.sourceKey===key?'valid':'stale',assetId:a?.profile.key||null,paths:a?.paths||null,bytes:a?.fileBytes||null};}),runtime:core.runtimeObserver?'attached':'unavailable',unsupported:['arbitrary-2d-warp','automatic-browser-file-write','GPU-timing']};
 if(op==='dirt.planCompilation'||op==='dirt.previewCompilation'||op==='dirt.validateCompilation'){
  // Validate the effective profile without compiling a world or mutating source.
  const {buildExpansionPlan}=core.compilationDependencies;
  const plan=buildExpansionPlan(p,worldId,policy);
  if(input.plan&&(input.plan.baseRevision!==state.revision||input.plan.sourceKey!==key))throw Error('STALE_REVISION');
  return {kind:'compiled-profile',schemaVersion:COMPILED_VERSION,baseRevision:state.revision,sourceKey:key,worldId,policy,effectiveProfile:plan.profile,committable:true,valid:true,nonMutating:true,sourceCells:250000,nearStep:.25,baseStep:2,maxChunkEntries:96,estimatedBytes:sourceBytes()+600000,previousBytes:asset?.fileBytes||null,invalidates:[worldId],viewerCompatible:Math.abs(plan.experienceLength-WORLD_SIZES[worldId])<1e-6,limitations:['one-main-route','replacement with a different journey length requires a separate experience chart; viewer activation is rejected'],cancellation:'synchronous explicit preparation; publishes atomically after success, no source mutation'};
 }
 if(op==='dirt.compileProfile'){
  const reviewed=input.plan;
  if(!reviewed||reviewed.schemaVersion!==COMPILED_VERSION||reviewed.kind!=='compiled-profile'||reviewed.baseRevision!==state.revision||reviewed.sourceKey!==key||request.expectedRevision!==state.revision)throw Error('STALE_REVISION');
  if(!request.operationId)throw Error('INVALID_REQUEST: operationId required');
  const source=freshSource?{...core.compiledSource,metadata:{...core.compiledSource.metadata,rules:p.rules,palette:p.rules.palette.slice(0,3)}}:compileCanonical(p);
  // Exclusions are trusted source-derived placements, never caller controlled.
  const exclusions=core.compilationExclusions?.[worldId]||[];
  const next=compileProfile(source,worldId,reviewed.policy,exclusions);
  core.compiledSource=source;core.compiledAssets.set(worldId,next);
  return {...inspectCompiled(source,next),persisted:false,sourceMutated:false,progress:{phase:'complete',fraction:1},rollback:'prior cache retained until successful compilation; source revision unchanged'};
 }
 if(!asset)throw Error('MISSING_COMPILED_PROFILE: explicitly compile or load this profile');
 if(!fresh)throw Error('STALE_COMPILED_ASSET: explicitly recompile effective source/profile');
 if(op==='dirt.inspectCompiledAsset')return {...inspectCompiled(core.compiledSource,asset),paths:asset.paths||null,fileBytes:asset.fileBytes||null,loaded:true};
 const sampler=createCompiledSampler(core.compiledSource,asset.profile);
 if(op==='dirt.inspectVisualAt'||op==='dirt.inspectPhysicalAt'){
  const {x,z}=input.position||{};if(input.coordinateSpace!=='experience'||!Number.isFinite(x)||!Number.isFinite(z)||x<0||x>=asset.profile.experienceWidth||z<0||z>=asset.profile.size)throw Error('INVALID_COORDINATE_SPACE: explicit bounded experience coordinates required');
  const physical=sampler(x,z),vertex=sampler.raw(x,z),nearest=asset.profile.features.reduce((best,f)=>{const distance=Math.hypot(x-f.x,z-f.z);return !best||distance<best.distance?{id:f.id,distance}:best;},null);
  return {worldId,coordinateSpace:'experience',position:{x,z},assetId:asset.profile.key,sourceKey:key,physical,nearVisualHeight:physical.height,nearInterpolationError:0,analyticHeight:vertex.height,analyticDifference:physical.height-vertex.height,nearestFeature:nearest,color:physical.tone?core.compiledSource.metadata.palette[physical.shade]:null,lod:'near triangle model; live readiness requires runtime inspection',farCollisionReady:false};
 }
 if(op==='dirt.diffCompiledProfiles'){
  const items=[...core.compiledAssets.values()];if(items.length<2)throw Error('MISSING_COMPILED_PROFILE: load or compile at least two profiles');
  const reference=JSON.stringify(p.features.map(f=>({id:f.id,geometry:f.geometry,collision:f.collision})));
  return {profiles:items.map(a=>({worldId:a.profile.worldId,assetId:a.profile.key,sourceKey:a.profile.sourceKey,experienceLength:a.profile.experienceWidth,sameFixedGeometry:reference===JSON.stringify(a.profile.features.map(f=>({id:f.id,geometry:f.geometry,collision:f.collision})))})),sameSource:items.every(a=>a.profile.sourceKey===key)};
 }
 if(op==='dirt.validateCompiledTerrain'){
  const errors=[],samples=[];let maxAnalyticError=0;
  for(const f of asset.profile.features){const hit=sampler(f.x,f.z),raw=sampler.raw(f.x,f.z);maxAnalyticError=Math.max(maxAnalyticError,Math.abs(hit.height-raw.height));if(hit.ramp!==f.id)errors.push({code:'FEATURE_MASK_CONFLICT',featureId:f.id});samples.push({featureId:f.id,physicalHeight:hit.height,analyticHeight:raw.height});}
  return {valid:errors.length===0,errors,samples,maxAnalyticError,nearTriangleParity:'shared interpolation',sourceKey:key,gpuUploadBudget:'not observed by headless validation'};
 }
 throw Error('NOT_IMPLEMENTED');
}
const sourceBytes=()=>250000+501*501*4;
