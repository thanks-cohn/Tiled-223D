import {ID,wrap} from "./world-data.js";

// Sparse *separate* continent, following the expansive-ocean visual strategy.
// The source Tiled islands are not rewritten or recolored.
export const DEFAULT_EXPANSIVE_DIRT=Object.freeze({
 enabled:true,areaFraction:1/3,seed:7319,
 baseHeight:8,rollingHeight:13,highPointHeight:36,
 shadeVariation:.38,outlineStrength:.22,
 rampCoverage:Object.freeze({large:.10,medium:.09,small:.30}),
 expansion:"expansive"
});
const validatedRules=new WeakSet();
const sizes=Object.freeze({large:{spacing:110,length:68,width:25,height:19},
 medium:{spacing:52,length:28,width:12,height:9},
 small:{spacing:20,length:10,width:5,height:3}});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;
function hash(x,z,seed){
 let n=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(seed|0,1442695041);
 n=Math.imul(n^(n>>>13),1274126177);
 return ((n^(n>>>16))>>>0)/4294967296;
}
function noise(x,z,seed,period){
 const xx=x/period,zz=z/period,ix=Math.floor(xx),iz=Math.floor(zz);
 const tx=smooth(xx-ix),tz=smooth(zz-iz);
 return mix(mix(hash(ix,iz,seed),hash(ix+1,iz,seed),tx),
  mix(hash(ix,iz+1,seed),hash(ix+1,iz+1,seed),tx),tz);
}
export function validateExpansiveDirt(input={}){
 if(!input||Array.isArray(input)||typeof input!=="object")throw Error("Invalid expansive dirt rules");
 if(validatedRules.has(input))return input;
 const keys=["enabled","areaFraction","seed","baseHeight","rollingHeight","highPointHeight",
  "shadeVariation","outlineStrength","rampCoverage","expansion"];
 for(const k of Object.keys(input))if(!keys.includes(k))throw Error("Unknown expansive dirt rule "+k);
 const r={...DEFAULT_EXPANSIVE_DIRT,...input,
  rampCoverage:{...DEFAULT_EXPANSIVE_DIRT.rampCoverage,...input.rampCoverage}};
 if(typeof r.enabled!=="boolean"||!Number.isSafeInteger(r.seed)||
  !["expansive","local","custom"].includes(r.expansion)||
  ![r.areaFraction,r.shadeVariation,r.outlineStrength,...Object.values(r.rampCoverage)]
   .every(v=>Number.isFinite(v)&&v>=0&&v<=1)||
  ![r.baseHeight,r.rollingHeight,r.highPointHeight]
   .every(v=>Number.isFinite(v)&&v>=0&&v<=10000)||
  Object.keys(r.rampCoverage).some(k=>!["large","medium","small"].includes(k))||
  Object.values(r.rampCoverage).reduce((a,b)=>a+b,0)>1)
  throw Error("Invalid expansive dirt rule values");
 validatedRules.add(r);
 return r;
}
const signed=(value,center,period)=>wrap(value-center+period/2,period)-period/2;
// Large elliptical landmass occupies ~1/3 of the *available world area*.
// The shoreline is organically perturbed but never allocated as a huge grid.
export function dirtLandSample(x,z,width,height,config=DEFAULT_EXPANSIVE_DIRT,protectedPlaces=[]){
 if(![x,z,width,height].every(Number.isFinite)||width<=0||height<=0)
  throw Error("Invalid expansive dirt coordinate");
 const rule=validateExpansiveDirt(config);
 if(!rule.enabled)return {ground:ID.ocean,height:0,shade:0,ramp:null};
 const dx=signed(x,width*.5,width),dz=signed(z,height*.5,height);
 const r=Math.sqrt(rule.areaFraction/Math.PI);
 const rx=width*r*1.08,rz=height*r/1.08;
 const normalized=Math.hypot(dx/rx,dz/rz);
 const broad=noise(dx,dz,rule.seed,Math.max(30,Math.min(width,height)*.07));
 const coastalEdge=1+(broad-.5)*.09;
 if(normalized>=coastalEdge)return {ground:ID.ocean,height:0,shade:0,ramp:null};
 // Keep the authored islands and their surrounding water visibly distinct.
 for(const p of protectedPlaces){
  const px=signed(x,p.x,width),pz=signed(z,p.z,height);
  if(Math.hypot(px,pz)<p.radius+Math.max(12,Math.min(width,height)*.018))
   return {ground:ID.ocean,height:0,shade:0,ramp:null};
 }
 const biome=noise(dx,dz,rule.seed+17,Math.max(18,Math.min(width,height)*.038));
 const close=noise(dx,dz,rule.seed+31,Math.max(5,Math.min(width,height)*.008));
 const outline=noise(dx,dz,rule.seed+59,Math.max(3,Math.min(width,height)*.003));
 const shades=clamp(.67*biome+.24*close+.09*outline,0,1);
 // Coherent rolling elevations, with occasional high points; no per-cell
 // elevation allocation and no rewriting the original authored height grid.
 const rise=Math.pow(Math.max(0,noise(dx,dz,rule.seed+71,Math.max(25,Math.min(width,height)*.028))-.60)/.4,2);
 const shoreline=clamp((coastalEdge-normalized)*Math.min(width,height)*.35,0,1);
 let elevation=shoreline*(rule.baseHeight+rule.rollingHeight*(.55*biome+.45*close)+rule.highPointHeight*rise);
 let ramp=null,extraHeight=0;
 // Three sparse, stable families of coherent actual mathematical ramps. The
 // configured fractions are target density/footprint weights, not an exact
 // guarantee of occupied land area, since shorelines/regions exclude tiles.
 for(const name of ["large","medium","small"]){
  const type=sizes[name],stride=Math.max(type.spacing,Math.min(width,height)*.012);
  const gx=Math.floor(dx/stride),gz=Math.floor(dz/stride);
  const cx=(gx+.5)*stride,cz=(gz+.5)*stride;
  const active=hash(gx,gz,rule.seed+({large:101,medium:211,small:317}[name]))<
   rule.rampCoverage[name];
  if(!active)continue;
  const turn=hash(gx,gz,rule.seed+543)<.5;
  const along=(turn?dx-cx:dz-cz)/(type.length*.5);
  const across=(turn?dz-cz:dx-cx)/(type.width*.5);
  if(Math.abs(along)>=1||Math.abs(across)>=1)continue;
  // Continuous parabolic launch incline and smooth edges: the same sampling
  // function is used for physical ground height and visual vertex heights.
  const edge=smooth(clamp((1-Math.abs(across))/.27,0,1));
  const longitudinal=smooth(clamp((along+1)/1.7,0,1));
  const taper=smooth(clamp((1-along)/.3,0,1));
  extraHeight+=type.height*longitudinal*taper*edge;
  ramp={kind:name,id:`${name}:${gx}:${gz}`,orientation:turn?"x":"z"};
 }
 elevation+=extraHeight*shoreline;
 const shade=shades<.34?0:shades<.53?1:shades<.72?2:3;
 return {ground:ID.dirt,height:elevation,shade,outline:
  outline>.64&&close<.54?rule.outlineStrength:0,ramp};
}
export function expansiveDirtFootprint(width,height,rules=DEFAULT_EXPANSIVE_DIRT){
 const r=validateExpansiveDirt(rules);
 const radius=Math.sqrt(r.areaFraction/Math.PI);
 return {id:"expansive-dirt:continent",x:width*.5,z:height*.5,
  radiusX:width*radius*1.08,radiusZ:height*radius/1.08,
  targetAreaFraction:r.areaFraction,source:"sparse-procedural",rules:r};
}
