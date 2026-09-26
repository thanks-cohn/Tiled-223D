import {ID,wrap} from '../world-data.js';
import {sampleCanonicalDirt} from './canonical.js';
import {buildExpansionPlan,mapRouteDistance} from './expansion.js';

export const COMPILED_VERSION='compiled-terrain-v1';
export const COMPILER_VERSION='dirt-compiler-1';
export const WORLD_SIZES={current:500,bigger:2500,massive:16000};
export const NEAR_STEP=.25,BASE_STEP=2,CHUNK_SIZE=16;
const smooth=t=>t*t*(3-2*t),clamp=v=>Math.max(0,Math.min(1,v));
// Deterministic coherence key, not a cryptographic integrity signature. Files
// additionally carry SHA-256 digests in the distribution manifest.
export function coherence(value){let h=2166136261;const str=typeof value==='string'?value:JSON.stringify(value);for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');}
export function sourceKey(p){const {palette,...rules}=p.rules;return coherence({version:COMPILER_VERSION,rules,revision:p.sourceRevision,features:p.features,mask:Array.from(p.mask)});}
export function compileCanonical(p){
 const started=performance.now(),tones=new Uint8Array(250000),heights=new Float32Array(501*501);
 // Sample unmasked base elevations so interpolation never pulls coast vertices
 // down towards an absent-water zero. Mask and physical heights stay separate.
 const unmasked={...p,mask:new Uint8Array(250000).fill(1)};
 for(let z=0;z<=500;z++)for(let x=0;x<=500;x++)heights[z*501+x]=sampleCanonicalDirt(unmasked,Math.min(x,499.999999),Math.min(z,499.999999),{includeRamps:false}).height;
 for(let z=0;z<500;z++)for(let x=0;x<500;x++)if(p.mask[z*500+x])tones[z*500+x]=1+Math.min(2,sampleCanonicalDirt(p,x+.5,z+.5,{includeRamps:false}).shade);
 const {mask,...metadata}=p;
 return {metadata:{...metadata,schemaVersion:COMPILED_VERSION,compilerVersion:COMPILER_VERSION,sourceKey:sourceKey(p),palette:p.rules.palette.slice(0,3),heightDensity:1,compileMs:performance.now()-started},tones,heights};
}
export function hydrateProduction(source){return {...source.metadata,schemaVersion:'dirt-v1',mask:Uint8Array.from(source.tones,v=>v?1:0)};}
export function baseHeight(source,x,z){
 const ix=Math.min(499,Math.max(0,Math.floor(x))),iz=Math.min(499,Math.max(0,Math.floor(z))),tx=clamp(x-ix),tz=clamp(z-iz),i=iz*501+ix,h=source.heights;
 return (h[i]*(1-tx)+h[i+1]*tx)*(1-tz)+(h[i+501]*(1-tx)+h[i+502]*tx)*tz;
}
function indexedRoute(plan,value,from='experience'){
 const a=from==='experience'?'experienceStart':'sourceStart',b=from==='experience'?'experienceEnd':'sourceEnd',c=from==='experience'?'sourceStart':'experienceStart',d=from==='experience'?'sourceEnd':'experienceEnd';
 let lo=0,hi=plan.intervals.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(value>=plan.intervals[mid][b])lo=mid+1;else hi=mid;}
 const i=plan.intervals[lo];return i[c]+(value-i[a])/(i[b]-i[a]||1)*(i[d]-i[c]);
}
export function compileProfile(source,worldId,policy={mode:'inherit-world'},exclusions=[]){
 const started=performance.now(),size=WORLD_SIZES[worldId];if(!size)throw Error('INVALID_PROFILE');
 const p=hydrateProduction(source),plan=buildExpansionPlan(p,worldId,policy);
 if(!Number.isFinite(plan.experienceLength)||plan.experienceLength<500)throw Error('INVALID_PROFILE: expansion cannot compress fixed terrain');
 // A replacement longer than the exterior world is a separate experience
 // chart. The viewer must explicitly enter it; never clamp/wrap it into 500.
 const features=p.features.map(f=>({...f,x:mapRouteDistance(plan,f.canonical.x).value,z:f.canonical.z/500*size}));
 const bins={};for(let index=0;index<features.length;index++){
  const f=features[index],hx=(f.orientation==='x'?f.geometry.length:f.geometry.width)/2,hz=(f.orientation==='x'?f.geometry.width:f.geometry.length)/2;
  for(let z=Math.floor((f.z-hz)/32);z<=Math.floor((f.z+hz)/32);z++)for(let x=Math.floor((f.x-hx)/32);x<=Math.floor((f.x+hx)/32);x++)(bins[`${x},${z}`]??=[]).push(index);
 }
 const profile={schemaVersion:COMPILED_VERSION,compilerVersion:COMPILER_VERSION,worldId,sourceKey:source.metadata.sourceKey,sourceRevision:p.sourceRevision,policy,plan,features,bins,exclusions,size,experienceWidth:plan.experienceLength,nearStep:NEAR_STEP,baseStep:BASE_STEP,chunkSize:CHUNK_SIZE,
  limitations:['one-main-route; not an arbitrary 2D warp','overview and experience are distinct charts'],};
 profile.key=coherence({sourceKey:profile.sourceKey,palette:source.metadata.palette,nearStep:NEAR_STEP,baseStep:BASE_STEP,worldId,policy,profile:plan.profile,exclusions});
 const sample=createCompiledSampler(source,profile),atlas=new Uint8Array(250000),overviewAtlas=source.tones.slice(),far=new Float32Array(65*65*2);
 for(let z=0;z<500;z++)for(let x=0;x<500;x++)atlas[z*500+x]=sample.raw((x+.5)/500*profile.experienceWidth,(z+.5)/500*size).tone;
 for(let z=0;z<=64;z++)for(let x=0;x<=64;x++){
  const i=(z*65+x)*2,cx=Math.min(499.999,x/64*500),cz=Math.min(499.999,z/64*500);
  far[i]=baseHeight(source,cx,cz);far[i+1]=baseHeight(source,indexedRoute(plan,x/64*profile.experienceWidth),cz);
 }
 for(let z=0;z<500;z++)for(let x=0;x<500;x++)if(exclusions.some(e=>Math.hypot((x+.5)/500*size-e.x,(z+.5)/500*size-e.z)<e.radius))overviewAtlas[z*500+x]=0;
 profile.compileMs=performance.now()-started;
 return {profile,atlas,overviewAtlas,far};
}
export function createCompiledSampler(source,profile){
 if(profile.sourceKey!==source.metadata.sourceKey)throw Error('STALE_COMPILED_ASSET');
 const {size,experienceWidth:width,plan,features,bins,exclusions}=profile;
 const ocean=Object.freeze({ground:ID.ocean,height:0,shade:0,tone:0,ramp:null,source:'ocean',physical:true});
 function raw(x,z){
  x=wrap(x,width);z=wrap(z,size);
  for(const e of exclusions){const dx=wrap(x-e.x+width/2,width)-width/2,dz=wrap(z-e.z+size/2,size)-size/2;if(Math.hypot(dx,dz)<e.radius)return ocean;}
  const cx=indexedRoute(plan,x),cz=z/size*500,tone=source.tones[Math.min(499,Math.floor(cz))*500+Math.min(499,Math.floor(cx))];
  if(!tone)return ocean;
  let height=baseHeight(source,cx,cz),ramp=null;
  for(const index of bins[`${Math.floor(x/32)},${Math.floor(z/32)}`]||[]){const f=features[index],dx=x-f.x,dz=z-f.z,g=f.geometry,along=(f.orientation==='x'?dx:dz)/(g.length/2),across=(f.orientation==='x'?dz:dx)/(g.width/2);
   if(Math.abs(along)<=1&&Math.abs(across)<=1){height+=g.height*smooth(clamp((1-Math.abs(across))/.25))*smooth(clamp((along+1)/1.65))*smooth(clamp((1-along)/.35));ramp=f.id;break;}
  }
  return {ground:ID.dirt,height,shade:tone-1,tone,ramp,source:ramp?'saved-ramp':'compiled-height',canonical:{x:cx,z:cz},physical:true};
 }
 // Vertex sampler remains analytical for exact saved ramp identities. Contact
 // interpolates the same adaptive triangles used by the near renderer.
 function stepAt(x,z){const x0=Math.floor(x/CHUNK_SIZE)*CHUNK_SIZE,z0=Math.floor(z/CHUNK_SIZE)*CHUNK_SIZE;
  for(const dx of [0,CHUNK_SIZE])for(const dz of [0,CHUNK_SIZE])if(bins[`${Math.floor(wrap(x0+dx,width)/32)},${Math.floor(wrap(z0+dz,size)/32)}`]?.length)return NEAR_STEP;
  return BASE_STEP;
 }
 function sample(x,z){const hit=raw(x,z);if(!hit.tone)return hit;
  const NEAR_STEP=stepAt(x,z);
  const x0=Math.floor(x/NEAR_STEP)*NEAR_STEP,z0=Math.floor(z/NEAR_STEP)*NEAR_STEP,u=(x-x0)/NEAR_STEP,v=(z-z0)/NEAR_STEP;
  const a=raw(x0,z0),b=raw(x0+NEAR_STEP,z0),c=raw(x0,z0+NEAR_STEP),d=raw(x0+NEAR_STEP,z0+NEAR_STEP),tri=u+v<=1?[a,b,c]:[b,c,d];
  if(tri.some(p=>!p.tone))return {...ocean,source:'conservative-shore-triangle'};
  const height=u+v<=1?a.height+(b.height-a.height)*u+(c.height-a.height)*v:d.height+(c.height-d.height)*(1-u)+(b.height-d.height)*(1-v);
  return {...hit,height};
 }
 sample.raw=raw;sample.stepAt=stepAt;return sample;
}
export function inspectCompiled(source,asset){return {schemaVersion:COMPILED_VERSION,assetId:asset.profile.key,worldId:asset.profile.worldId,sourceKey:source.metadata.sourceKey,sourceRevision:source.metadata.sourceRevision,profile:asset.profile.plan.profile,fixedFeatures:asset.profile.features.length,gaps:asset.profile.plan.intervals.filter(i=>i.kind==='gap').length,bytes:{canonical:source.tones.byteLength+source.heights.byteLength,profile:asset.atlas.byteLength+asset.overviewAtlas.byteLength+asset.far.byteLength},compileMs:asset.profile.compileMs??null,valid:asset.profile.sourceKey===source.metadata.sourceKey,collisionReady:true,nearStep:NEAR_STEP};}
