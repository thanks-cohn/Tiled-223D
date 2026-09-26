import { ID } from "../world-data.js";

export const DIRT_CAPABILITY_VERSION = "dirt-v1";
export const DIRT_ALGORITHM_VERSION = "canonical-dirt-1";
export const CANONICAL_DIRT_ID = "dirt-landmass-01";
export const DEFAULT_DIRT_RULES = Object.freeze({
  targetWholeWorldCoverage: 1 / 3,
  seed: 7319,
  baseElevation: 8,
  undulationAmplitude: 1.25,
  highPointHeight: 7,
  candidateProbability: Object.freeze({ large: 0.05, medium: 0.03, small: 0.10 }),
  minimumSeparation: Object.freeze({ large: 55, medium: 32, small: 18 }),
  palette: Object.freeze(["#76502f", "#93683e", "#5c3d28", "#aa7b4b"])
});

export const RAMP_TYPES = Object.freeze({
  large: Object.freeze({ length: 36, width: 14, height: 9, zone: 28 }),
  medium: Object.freeze({ length: 22, width: 10, height: 6, zone: 20 }),
  small: Object.freeze({ length: 12, width: 6, height: 3.5, zone: 12 })
});

const hashInt = (x, z, seed) => {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
};
const random = (x, z, seed) => hashInt(x, z, seed) / 4294967296;
const smooth = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;
function noise(x, z, seed, period) {
  const px=x/period,pz=z/period,ix=Math.floor(px),iz=Math.floor(pz),tx=smooth(px-ix),tz=smooth(pz-iz);
  return mix(mix(random(ix,iz,seed),random(ix+1,iz,seed),tx),mix(random(ix,iz+1,seed),random(ix+1,iz+1,seed),tx),tz);
}
const distanceToBounds=(x,z,b)=>Math.hypot(Math.max(b.x-x,0,x-(b.x+b.width)),Math.max(b.y-z,0,z-(b.y+b.height)));

export function validateDirtRules(input={}) {
  const clean=Object.fromEntries(Object.entries(input).filter(([,value])=>value!==undefined));
  const rules={...DEFAULT_DIRT_RULES,...clean,
    candidateProbability:{...DEFAULT_DIRT_RULES.candidateProbability,...(input.candidateProbability||{})},
    minimumSeparation:{...DEFAULT_DIRT_RULES.minimumSeparation,...(input.minimumSeparation||{})}};
  if(!Number.isSafeInteger(rules.seed)||!Number.isFinite(rules.targetWholeWorldCoverage)||rules.targetWholeWorldCoverage<0.25||rules.targetWholeWorldCoverage>0.38)
    throw new Error("INVALID_DIRT_RULES: coverage must be 0.25..0.38 and seed must be a safe integer");
  for(const [name,value] of Object.entries(rules.candidateProbability))
    if(!RAMP_TYPES[name]||!Number.isFinite(value)||value<0||value>1)throw new Error(`INVALID_RAMP_PROBABILITY: ${name}`);
  for(const value of [rules.baseElevation,rules.undulationAmplitude,rules.highPointHeight,...Object.values(rules.minimumSeparation)])
    if(!Number.isFinite(value)||value<0||value>10000)throw new Error("INVALID_DIRT_RULES: finite bounded values required");
  if(!Array.isArray(rules.palette)||rules.palette.length<3||rules.palette.length>4||rules.palette.some(c=>typeof c!=="string"||!/^#[0-9a-f]{6}$/i.test(c)))throw new Error("INVALID_PALETTE: provide three hexadecimal brown colors (legacy fourth entry accepted)");
  return rules;
}

/** Build the one canonical 500x500 production. `source` is read only. */
export function createCanonicalDirtProduction(source, input={}) {
  if(source.width!==500||source.height!==500)throw new Error("INVALID_SOURCE: canonical dirt requires the 500x500 production map");
  const rules=validateDirtRules(input),total=source.width*source.height,target=Math.round(total*rules.targetWholeWorldCoverage);
  const protectedMask=new Uint8Array(total),protectedBounds=[];
  // Preserve every authored cell plus an explicit water clearance. This derives
  // protection from canonical semantics, never from renderer colors.
  for(let i=0;i<total;i++)if(source.ground[i]!==ID.ocean){const x=i%500,z=Math.floor(i/500);for(let dz=-10;dz<=10;dz++)for(let dx=-10;dx<=10;dx++){const nx=x+dx,nz=z+dz;if(nx>=0&&nz>=0&&nx<500&&nz<500&&dx*dx+dz*dz<=100)protectedMask[nz*500+nx]=1;}}
  // Stable authored-island bounds are included for diagnostics and API guards.
  for(const [id,x,y,width,height] of [["original-island-A",108,198,74,74],["original-island-B",308,232,74,76]])
    protectedBounds.push({id,x,y,width,height});
  const eligible=[];
  for(let z=0;z<500;z++)for(let x=0;x<500;x++)if(!protectedMask[z*500+x]){
    // An irregular, connected-biased ranking produces an exact measured area.
    const dx=(x-250)/245,dz=(z-250)/215;
    const score=dx*dx+dz*dz+(noise(x,z,rules.seed,38)-.5)*.24+(noise(x,z,rules.seed+9,91)-.5)*.16;
    eligible.push({i:z*500+x,x,z,score});
  }
  if(eligible.length<target){const e=new Error("INSUFFICIENT_CANONICAL_AREA");e.capacity=eligible.length;throw e;}
  eligible.sort((a,b)=>a.score-b.score||a.i-b.i);
  const mask=new Uint8Array(total);for(let n=0;n<target;n++)mask[eligible[n].i]=1;
  const features=[],candidateCounts={large:0,medium:0,small:0},rejections={probability:0,footprint:0,spacing:0};
  for(const kind of ["large","medium","small"]){const type=RAMP_TYPES[kind];
    for(let z=type.zone/2;z<500;z+=type.zone)for(let x=type.zone/2;x<500;x+=type.zone){candidateCounts[kind]++;
      if(random(x,z,rules.seed+type.zone)>=rules.candidateProbability[kind]){rejections.probability++;continue;}
      const orientation=random(x,z,rules.seed+444)<.5?"x":"z",half=Math.ceil(Math.max(type.length,type.width)/2+8);
      let fits=true;for(let dz=-half;dz<=half&&fits;dz+=2)for(let dx=-half;dx<=half;dx+=2)if(!mask[(Math.floor(z+dz))*500+Math.floor(x+dx)]){fits=false;break;}
      if(!fits){rejections.footprint++;continue;}
      const clearance=rules.minimumSeparation[kind];
      if(features.some(f=>Math.hypot(f.canonical.x-x,f.canonical.z-z)<Math.max(clearance,rules.minimumSeparation[f.kind]))){rejections.spacing++;continue;}
      const id=`ramp-${kind}-${String(features.filter(f=>f.kind===kind).length+1).padStart(3,"0")}`;
      features.push(Object.freeze({id,kind,canonical:Object.freeze({x,z}),orientation,
        geometry:Object.freeze({length:type.length,width:type.width,height:type.height}),
        collision:Object.freeze({shape:"height-field",length:type.length,width:type.width,height:type.height}),
        approach:Object.freeze({before:type.length,after:type.length*.75,width:type.width*1.5})}));
    }
  }
  const record={schemaVersion:DIRT_CAPABILITY_VERSION,id:CANONICAL_DIRT_ID,sourceMapId:"two-islands-500",sourceRevision:1,
    algorithmVersion:DIRT_ALGORITHM_VERSION,width:500,height:500,rules:Object.freeze(rules),mask,
    coverage:{cells:target,wholeWorldFraction:target/total,eligibleCells:eligible.length},protectedBounds:Object.freeze(protectedBounds),
    features:Object.freeze(features),generation:Object.freeze({candidateCounts,rejections,probabilityMetric:"per-eligible-candidate-zone"})};
  return Object.freeze(record);
}

export function sampleCanonicalDirt(production,x,z,{includeRamps=true}={}) {
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new Error("INVALID_COORDINATE");
  const cx=Math.floor(x),cz=Math.floor(z);
  if(cx<0||cz<0||cx>=500||cz>=500||!production.mask[cz*500+cx])return {ground:ID.ocean,height:0,shade:0,ramp:null,source:"ocean"};
  const r=production.rules,broad=noise(x,z,r.seed+21,44),detail=noise(x,z,r.seed+41,13);
  let height=r.baseElevation+r.undulationAmplitude*((broad-.5)*1.4+(detail-.5)*.35),ramp=null;
  if(includeRamps)for(const feature of production.features){const g=feature.geometry,dx=x-feature.canonical.x,dz=z-feature.canonical.z;
    const along=(feature.orientation==="x"?dx:dz)/(g.length/2),across=(feature.orientation==="x"?dz:dx)/(g.width/2);
    if(Math.abs(along)<=1&&Math.abs(across)<=1){const edge=smooth(Math.max(0,Math.min(1,(1-Math.abs(across))/.25)));const rise=smooth(Math.max(0,Math.min(1,(along+1)/1.65)));const taper=smooth(Math.max(0,Math.min(1,(1-along)/.35)));height+=g.height*edge*rise*taper;ramp=feature.id;break;}
  }
  const shade=Math.min(3,Math.floor((.7*broad+.3*detail)*4));
  return {ground:ID.dirt,height,shade,ramp,source:ramp?"saved-ramp":"canonical-dirt",physical:true};
}

export function isProtectedCoordinate(production,x,z){return production.protectedBounds.some(b=>distanceToBounds(x,z,b)===0);}
