export const OCEAN_PRESET_SCHEMA_VERSION="1.1.0";
export const OCEAN_FAMILY_IDS=Object.freeze(["near-crest","middle-swell","broad-band","planetary-contour"]);
export const OCEAN_MOOD_IDS=Object.freeze(["low","middle","high","top"]);

const family=(id,values)=>Object.freeze({id,enabled:true,...values});
export const DEFAULT_OCEAN_PRESET=Object.freeze({
 schemaVersion:OCEAN_PRESET_SCHEMA_VERSION,id:"ocean-beauty-v10",seed:223,quality:"low",drift:0,
 families:Object.freeze({
  "near-crest":family("near-crest",{mode:"crest",grid:34,length:42,curvature:.055,groupSpacing:2.6,fragments:2,density:.72,alpha:.38,color:"#b9e7e7",width:.55,softness:.62,taper:.88,gapRhythm:.12,glint:.36,depthFalloff:.76}),
  "middle-swell":family("middle-swell",{mode:"tonal",grid:78,length:105,curvature:.042,groupSpacing:8,fragments:2,density:.58,alpha:.25,color:"#3d91b4",width:3.2,softness:.82,taper:.78,gapRhythm:.07,glint:.08,depthFalloff:.52}),
  "broad-band":family("broad-band",{mode:"tonal",grid:165,length:245,curvature:.03,groupSpacing:22,fragments:2,density:.42,alpha:.20,color:"#2777a2",width:9,softness:.9,taper:.72,gapRhythm:.03,glint:0,depthFalloff:.30}),
  "planetary-contour":family("planetary-contour",{mode:"tonal",grid:340,length:520,curvature:.018,groupSpacing:48,fragments:1,density:.28,alpha:.16,color:"#4a8eaa",width:22,softness:.94,taper:.68,gapRhythm:0,glint:0,depthFalloff:.14})
 }),
 moods:Object.freeze({
  low:{center:0,width:.30,whiteStrength:.42,tonalStrength:.72,weights:{"near-crest":1,"middle-swell":.18,"broad-band":.02,"planetary-contour":0},note:"Two connected shallow crest bands over a quiet blue swell."},
  middle:{center:.34,width:.32,whiteStrength:.28,tonalStrength:1,weights:{"near-crest":.58,"middle-swell":.92,"broad-band":.48,"planetary-contour":.02},note:"Three scales, led by blue rhythm rather than equal bright curls."},
  high:{center:.68,width:.32,whiteStrength:.03,tonalStrength:.92,weights:{"near-crest":.02,"middle-swell":.42,"broad-band":1,"planetary-contour":.16},note:"Generous blue-on-blue bands with a quiet counter-rhythm."},
  top:{center:1,width:.30,whiteStrength:0,tonalStrength:.75,weights:{"near-crest":0,"middle-swell":.01,"broad-band":.13,"planetary-contour":1},note:"A few broad planetary tonal contours; no white strokes."}
 }),
 shadow:Object.freeze({enabled:false,policy:"vertical-below",minRadius:2.5,maxRadius:92,minAlpha:.008,maxAlpha:.28,softness:.84,elongation:1.28,color:"#082743",shoreFade:12,horizonFade:.16}),
 budget:Object.freeze({maxCrests:76,maxSegmentsPerCrest:48,maxVertices:8192,maxDrawCalls:5,cacheEntries:256,qualityScale:.7})
});

const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const color=value=>typeof value==="string"&&/^#[\da-f]{6}$/i.test(value);
export function validateOceanPreset(value){
 const errors=[],rootKeys=new Set(["schemaVersion","id","seed","quality","drift","families","moods","shadow","budget"]);
 for(const key of Object.keys(value??{}))if(!rootKeys.has(key))errors.push(`unsupported property ${key}`);
 if(!value||value.schemaVersion!==OCEAN_PRESET_SCHEMA_VERSION)errors.push(`schemaVersion must be ${OCEAN_PRESET_SCHEMA_VERSION}`);
 if(!Number.isInteger(value?.seed))errors.push("seed must be an integer");
 if(!["low","balanced","high"].includes(value?.quality))errors.push("invalid quality");
 for(const id of OCEAN_FAMILY_IDS){const f=value?.families?.[id];if(!f)errors.push(`missing family ${id}`);else{
  if(!["crest","tonal"].includes(f.mode))errors.push(`${id}.mode must be crest or tonal`);if(!color(f.color))errors.push(`${id}.color invalid`);
  for(const [key,min,max] of [["grid",8,1000],["length",4,2000],["curvature",0,.25],["groupSpacing",.25,100],["fragments",1,4],["density",0,1],["alpha",0,1],["width",.1,60],["softness",0,1],["taper",0,1],["gapRhythm",0,.5],["glint",0,1],["depthFalloff",0,1]])if(!finite(f[key],min,max))errors.push(`${id}.${key} outside ${min}..${max}`);
 }}
 for(const id of OCEAN_MOOD_IDS){const mood=value?.moods?.[id];if(!mood)errors.push(`missing mood ${id}`);else{if(!finite(mood.center,0,1)||!finite(mood.width,.05,.6)||!finite(mood.whiteStrength,0,1)||!finite(mood.tonalStrength,0,1))errors.push(`invalid mood ${id}`);for(const familyId of OCEAN_FAMILY_IDS)if(!finite(mood.weights?.[familyId],0,1))errors.push(`invalid ${id} weight ${familyId}`);}}
 const s=value?.shadow;if(!s||!finite(s.minRadius,0,200)||!finite(s.maxRadius,s?.minRadius??0,1000)||!finite(s.minAlpha,0,.5)||!finite(s.maxAlpha,s?.minAlpha??0,.65)||!finite(s.softness,.1,.98)||!finite(s.elongation,.5,3)||!color(s.color))errors.push("invalid shadow curve");
 const b=value?.budget;if(!b||!Number.isInteger(b.maxCrests)||!finite(b.maxCrests,8,256)||!finite(b.maxVertices,96,8192)||!finite(b.maxDrawCalls,1,6)||!finite(b.cacheEntries,b.maxCrests,1024)||!finite(b.qualityScale,.25,1))errors.push("invalid render budget");
 return {ok:errors.length===0,errors};
}
export function cloneOceanPreset(value=DEFAULT_OCEAN_PRESET){return structuredClone(value);}
export function mergeOceanPreset(base,patch){const merge=(a,b)=>{if(!b||typeof b!=="object"||Array.isArray(b))return b;const out={...a};for(const [k,v] of Object.entries(b))out[k]=v&&typeof v==="object"&&!Array.isArray(v)?merge(a?.[k]??{},v):v;return out;};const result=merge(base,patch),validation=validateOceanPreset(result);if(!validation.ok)throw Error(`Invalid ocean preset: ${validation.errors.join("; ")}`);return result;}
