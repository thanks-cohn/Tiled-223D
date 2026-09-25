import {ID} from "./world-data.js";
import {landmasses} from "./landmasses.js";

// A small, deterministic authoring layer: keep exact height samples intact.
// Dirt is a semantic ground tile; ramps are only *candidate descriptors* until
// a matching collision-safe ramp surface is implemented.
export const DEFAULT_DIRT_RULE=Object.freeze({
 enabled:true,coverage:1/3,seed:2317,rampProbability:0.025,
 expansion:"normal",shadeVariation:0.32
});
const WATER=new Set([ID.ocean,ID.river,ID.lake]);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function hash(x,z,seed){
 let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(seed,1442695041);
 n=Math.imul(n^(n>>>13),1274126177);
 return ((n^(n>>>16))>>>0)/4294967296;
}
function smooth(t){return t*t*(3-2*t);}
function valueNoise(x,z,seed,period){
 const fx=x/period,fz=z/period,ix=Math.floor(fx),iz=Math.floor(fz);
 const tx=smooth(fx-ix),tz=smooth(fz-iz);
 const a=hash(ix,iz,seed),b=hash(ix+1,iz,seed);
 const c=hash(ix,iz+1,seed),d=hash(ix+1,iz+1,seed);
 return (a+(b-a)*tx)*(1-tz)+(c+(d-c)*tx)*tz;
}
export function dirtPattern(x,z,seed=DEFAULT_DIRT_RULE.seed){
 return .67*valueNoise(x,z,seed,12)+.25*valueNoise(x,z,seed+31,4)+
  .08*hash(x,z,seed+71);
}
export function validateDirtRule(input={}){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Invalid dirt rule");
 const allowed=["enabled","coverage","seed","rampProbability","expansion","shadeVariation"];
 for(const key of Object.keys(input))if(!allowed.includes(key))throw Error("Unknown dirt rule: "+key);
 const result={...DEFAULT_DIRT_RULE,...input};
 if(typeof result.enabled!=="boolean"||
  ![result.coverage,result.rampProbability,result.shadeVariation].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||
  !Number.isSafeInteger(result.seed)||!["normal","expansive","custom"].includes(result.expansion))
  throw Error("Invalid dirt rule values");
 return result;
}
export function createDirtWorld(source,rules={}){
 if(!source?.ground||!source?.heights||source.ground.length!==source.heights.length)
  throw Error("A finite semantic ground and elevation map is required");
 const regions=landmasses(source),next={...source,ground:new Uint8Array(source.ground),
  heights:source.heights,trees:source.trees,objects:source.objects};
 const plans=[],rampCandidates=[];
 for(const region of regions){
  const rule=validateDirtRule(rules[region.id]||{});
  const eligible=region.cells.filter(i=>source.ground[i]===ID.grass);
  const target=rule.enabled?Math.round(eligible.length*rule.coverage):0;
  // Contiguous low-frequency noise creates coherent, varying dirt patches;
  // deterministic ranking targets precisely one third of eligible grass.
  const ranked=eligible.map(i=>({i,score:dirtPattern(i%source.width,Math.floor(i/source.width),rule.seed)}));
  ranked.sort((a,b)=>b.score-a.score||a.i-b.i);
  const selected=new Set(ranked.slice(0,target).map(p=>p.i));
  for(const i of selected)next.ground[i]=ID.dirt;
  // Candidate records only: physical ramp geometry and collision must be
  // implemented together. Never render a deceptive non-collidable ramp.
  for(const i of selected){
   const x=i%source.width,z=Math.floor(i/source.width);
   const adjacent=[i-1,i+1,i-source.width,i+source.width];
   if(x<1||z<1||x>=source.width-1||z>=source.height-1||
    !adjacent.every(j=>selected.has(j)))continue;
   if(hash(x,z,rule.seed+103)<rule.rampProbability)
    rampCandidates.push({landmassId:region.id,x,z,orientation:hash(x,z,rule.seed+211)<.5?"x":"z"});
  }
  plans.push({id:region.id,cells:region.cells.length,eligible:eligible.length,
   dirtCells:target,coverage:eligible.length?target/eligible.length:0,
   rampCandidates:rampCandidates.filter(r=>r.landmassId===region.id).length,rule});
 }
 next.dirtTreatment={plans,rampCandidates,rendererVersion:1};
 return next;
}
export function dirtShade(x,z,seed=DEFAULT_DIRT_RULE.seed){
 const n=dirtPattern(x,z,seed+713);
 return n<.36?0:n<.53?1:n<.71?2:3;
}
