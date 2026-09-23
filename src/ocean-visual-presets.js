export const OCEAN_PRESET_SCHEMA_VERSION="1.0.0";
export const OCEAN_FAMILY_IDS=Object.freeze(["near-crest","middle-swell","broad-band","planetary-contour"]);
export const OCEAN_MOOD_IDS=Object.freeze(["low","middle","high","top"]);

const family=(id,values)=>Object.freeze({id,enabled:true,...values});
export const DEFAULT_OCEAN_PRESET=Object.freeze({
 schemaVersion:OCEAN_PRESET_SCHEMA_VERSION,id:"cinematic-ocean-v1",seed:223,
 quality:"low",drift:0,
 families:Object.freeze({
  "near-crest":family("near-crest",{grid:24,length:19,curvature:.13,groupSpacing:2.8,fragments:3,density:1,alpha:.52,color:"#d8fbf4",depthFalloff:.72}),
  "middle-swell":family("middle-swell",{grid:54,length:48,curvature:.10,groupSpacing:5.5,fragments:3,density:.68,alpha:.34,color:"#b9eee9",depthFalloff:.52}),
  "broad-band":family("broad-band",{grid:112,length:108,curvature:.075,groupSpacing:10,fragments:2,density:.46,alpha:.27,color:"#8fd7dc",depthFalloff:.34}),
  "planetary-contour":family("planetary-contour",{grid:230,length:235,curvature:.055,groupSpacing:18,fragments:2,density:.24,alpha:.23,color:"#78c9d5",depthFalloff:.18})
 }),
 moods:Object.freeze({
  low:{center:0,width:.30,weights:{"near-crest":1,"middle-swell":.08,"broad-band":.03,"planetary-contour":0},note:"Intimate grouped foam crests with a distant hint of scale."},
  middle:{center:.34,width:.32,weights:{"near-crest":.72,"middle-swell":.9,"broad-band":.52,"planetary-contour":.02},note:"The richest three-distance parallax composition."},
  high:{center:.68,width:.32,weights:{"near-crest":.04,"middle-swell":.38,"broad-band":.92,"planetary-contour":.12},note:"Long broad bands and a restrained medium counter-rhythm."},
  top:{center:1,width:.30,weights:{"near-crest":0,"middle-swell":.06,"broad-band":.18,"planetary-contour":1},note:"Quiet planetary contours with a sparse changing secondary layer."}
 }),
 shadow:Object.freeze({enabled:true,policy:"vertical-below",minRadius:2.5,maxRadius:82,minAlpha:.015,maxAlpha:.34,softness:.72,elongation:1.22,color:"#061e35",shoreFade:10,horizonFade:.16}),
 budget:Object.freeze({maxCrests:76,maxSegmentsPerCrest:12,maxVertices:1824,maxDrawCalls:5,cacheEntries:256,qualityScale:.7})
});

const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
export function validateOceanPreset(value){
 const errors=[];
 const rootKeys=new Set(["schemaVersion","id","seed","quality","drift","families","moods","shadow","budget"]);
 for(const key of Object.keys(value??{}))if(!rootKeys.has(key))errors.push(`unsupported property ${key}`);
 if(!value||value.schemaVersion!==OCEAN_PRESET_SCHEMA_VERSION)errors.push("schemaVersion must be 1.0.0");
 if(!Number.isInteger(value?.seed))errors.push("seed must be an integer");
 for(const id of OCEAN_FAMILY_IDS){const f=value?.families?.[id];if(!f)errors.push(`missing family ${id}`);
  else for(const [key,min,max] of [["grid",8,1000],["length",4,2000],["curvature",0,.4],["groupSpacing",.25,100],["fragments",1,4],["density",0,1],["alpha",0,1],["depthFalloff",0,1]])if(!finite(f[key],min,max))errors.push(`${id}.${key} outside ${min}..${max}`);
 }
 for(const id of OCEAN_MOOD_IDS){const mood=value?.moods?.[id];if(!mood)errors.push(`missing mood ${id}`);else{if(!finite(mood.center,0,1)||!finite(mood.width,.05,.6))errors.push(`invalid mood ${id}`);for(const familyId of OCEAN_FAMILY_IDS)if(!finite(mood.weights?.[familyId],0,1))errors.push(`invalid ${id} weight ${familyId}`);}}
 const s=value?.shadow;if(!s||!finite(s.minRadius,0,200)||!finite(s.maxRadius,s?.minRadius??0,1000)||!finite(s.minAlpha,0,.5)||!finite(s.maxAlpha,s?.minAlpha??0,.65)||!finite(s.softness,.1,.95)||!finite(s.elongation,.5,3))errors.push("invalid shadow curve");
 const b=value?.budget;if(!b||!Number.isInteger(b.maxCrests)||!finite(b.maxCrests,8,256)||!finite(b.maxVertices,96,8192)||!finite(b.maxDrawCalls,1,6)||!finite(b.cacheEntries,b.maxCrests,1024)||!finite(b.qualityScale,.25,1))errors.push("invalid render budget");
 return {ok:errors.length===0,errors};
}
export function cloneOceanPreset(value=DEFAULT_OCEAN_PRESET){return structuredClone(value);}
export function mergeOceanPreset(base,patch){
 const merge=(a,b)=>{if(!b||typeof b!=="object"||Array.isArray(b))return b;const out={...a};for(const [k,v] of Object.entries(b))out[k]=v&&typeof v==="object"&&!Array.isArray(v)?merge(a?.[k]??{},v):v;return out;};
 const result=merge(base,patch),validation=validateOceanPreset(result);if(!validation.ok)throw Error(`Invalid ocean preset: ${validation.errors.join("; ")}`);return result;
}
