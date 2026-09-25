import {ID,cell,wrap} from "./world-data.js";
import {landmasses} from "./landmasses.js";
import {createCanonicalDirtProduction,sampleCanonicalDirt} from "./dirt/canonical.js";
import {buildExpansionPlan,mapRouteDistance} from "./dirt/expansion.js";
import {protectedRegions} from "./travel-regions.js";

// SURFACE AREA multipliers, not linear dimensions. Massive is 32² = 1,024×
// current area, while only the original 500×500 tile patch is allocated.
export const SCALE_PRESETS=Object.freeze({
 current:Object.freeze({id:"current",label:"Current",linear:1,width:500,height:500,
  radius:235,altitudeScale:1,accelerationScale:1}),
 bigger:Object.freeze({id:"bigger",label:"Bigger",linear:5,width:2500,height:2500,
  radius:1175,altitudeScale:5,accelerationScale:2}),
 massive:Object.freeze({id:"massive",label:"Massive",linear:32,width:16000,height:16000,
  radius:7520,altitudeScale:32,accelerationScale:6})
});
export const RENDER_BUDGET=Object.freeze({localMapTiles:250000,
 detailedLandmasses:2,planetOceanMeshes:1,atmosphereSprites:27,
 overviewPixels:500*500,worldTilesAllocatedPerScaleChange:0});
const signed=(value,center,period)=>{
 const delta=wrap(value-center+period/2,period)-period/2;
 return delta;
};
const nearest=(position,center,size)=>Math.round((position-center)/size)*size;
const dirtProductionCache=new WeakMap();

function canonicalProduction(local,config){
 const key=JSON.stringify(config);let cached=dirtProductionCache.get(local);
 if(cached?.key===key)return cached.production;
 const production=createCanonicalDirtProduction(local,{
  seed:config.seed,targetWholeWorldCoverage:config.areaFraction,baseElevation:config.baseHeight,
  undulationAmplitude:config.rollingHeight==null?undefined:Math.min(10,config.rollingHeight*.1),highPointHeight:config.highPointHeight,
  candidateProbability:config.rampCoverage?{large:config.rampCoverage.large,medium:config.rampCoverage.medium,small:config.rampCoverage.small}:undefined
 });
 dirtProductionCache.set(local,{key,production});return production;
}

export function makeScaleWorld(local,id="current",dirtConfig={},dirtExpansionPolicy={mode:"inherit-world"}){
 const preset=SCALE_PRESETS[id];
 if(!preset)throw Error("Unknown world scale "+id);
 if(!Number.isInteger(local.width)||!Number.isInteger(local.height))throw Error("Invalid local map");
 // Imported maps are currently a single local region. Preserve their exact
 // bounds and coordinates instead of pretending they have a sparse atlas.
 const demo=local.width===500&&local.height===500&&local.name==="Two Islands";
 const scale=demo?preset:{...SCALE_PRESETS.current,width:local.width,height:local.height};
 const islands=landmasses(local);
 const placements=islands.map((mass,index)=>{
  const cx=mass.centerX,cz=mass.centerZ;
  const pos=scale.id==="current"?[cx,cz]:
   index===0?[scale.width*.28,scale.height*.31]:
   index===1?[scale.width*.71,scale.height*.67]:
   [scale.width*(.18+(index%4)*.15),scale.height*(.18+(Math.floor(index/4)%4)*.15)];
  return {id:mass.id,localX:cx,localZ:cz,x:pos[0],z:pos[1],
   offsetX:pos[0]-cx,offsetZ:pos[1]-cz,
   radius:Math.hypot(mass.bounds[2]-mass.bounds[0],mass.bounds[3]-mass.bounds[1])/2+5};
 });
 const nearestPlacement=(x,z)=>{
  let best=placements[0],dist=Infinity;
  for(const placement of placements){
   const distance=Math.hypot(x-placement.localX,z-placement.localZ);
   if(distance<dist){best=placement;dist=distance;}
  }
  return best;
 };
 const canonicalDirt=demo?canonicalProduction(local,dirtConfig):null;
 const dirtExpansion=canonicalDirt?buildExpansionPlan(canonicalDirt,scale.id,dirtExpansionPolicy):null;
 const dirtFootprint=canonicalDirt?{id:"expansive-dirt:continent",canonicalId:canonicalDirt.id,x:scale.width/2,z:scale.height/2,
  radiusX:scale.width/2,radiusZ:scale.height/2,targetAreaFraction:dirtConfig.areaFraction??1/3,measuredAreaFraction:canonicalDirt.coverage.wholeWorldFraction,
  source:"canonical-saved-production",rules:{enabled:true,expansion:"expansive",...dirtConfig},production:canonicalDirt}:null;
 const sampleExpansiveDirt=(x,z)=>{
  if(!canonicalDirt)return null;
  // X is actual on-ground experience distance. Invert the canonical expansion
  // plan so gameplay, collision, and near rendering use the same gap mapping.
  const experienceX=wrap(x,scale.width);
  const canonicalX=mapRouteDistance(dirtExpansion,Math.min(experienceX,dirtExpansion.experienceLength),"experience").value;
  const canonicalZ=wrap(z,scale.height)/scale.height*500;
  const base=sampleCanonicalDirt(canonicalDirt,canonicalX,canonicalZ,{includeRamps:false});
  if(base.ground!==ID.dirt)return base;
  let height=base.height,ramp=null;
  for(const feature of canonicalDirt.features){const centerX=mapRouteDistance(dirtExpansion,feature.canonical.x,"canonical").value,centerZ=feature.canonical.z/500*scale.height,g=feature.geometry;
   const dx=signed(x,centerX,scale.width),dz=signed(z,centerZ,scale.height),along=(feature.orientation==="x"?dx:dz)/(g.length/2),across=(feature.orientation==="x"?dz:dx)/(g.width/2);
   if(Math.abs(along)<=1&&Math.abs(across)<=1){const clamp=v=>Math.max(0,Math.min(1,v)),smooth=t=>t*t*(3-2*t);height+=g.height*smooth(clamp((1-Math.abs(across))/.25))*smooth(clamp((along+1)/1.65))*smooth(clamp((1-along)/.35));ramp=feature.id;break;}
  }
  return {...base,height,ramp,source:ramp?"saved-ramp":base.source};
 };
 const objects=(local.objects||[]).map(object=>{
  const host=nearestPlacement(object.at[0],object.at[2]);
  return {...object,at:[object.at[0]+(host?.offsetX||0),
   object.at[1],object.at[2]+(host?.offsetZ||0)]};
 });
 const regions=protectedRegions(local).map(region=>{
  const host=nearestPlacement(region.x,region.z);
  return {...region,x:wrap(region.x+(host?.offsetX||0),scale.width),
   z:wrap(region.z+(host?.offsetZ||0),scale.height)};
 });
 function groundAt(x,z){
  // All three demo sizes receive the same separate procedural continent.
  // The authored local tile map wins wherever it contains actual land:
  // do not overwrite any of the existing island cells or elevations.
  if(scale.id==="current"){
   const authored=cell(local,x,z);
   if(authored.ground!==ID.ocean||!dirtFootprint)return authored;
   const dirt=sampleExpansiveDirt(x,z);
   return dirt?.ground===ID.dirt?dirt:authored;
  }
  for(const placement of placements){
   const dx=signed(x,placement.x,scale.width);
   const dz=signed(z,placement.z,scale.height);
   // Only tiny original island surroundings are tile-backed. Everything
   // outside those patches is procedural ocean: NO huge ground array.
   if(Math.abs(dx)>placement.radius+3||Math.abs(dz)>placement.radius+3)continue;
   const hit=cell(local,placement.localX+dx,placement.localZ+dz);
   if(hit.ground!==ID.ocean)return hit;
  }
  const dirt=sampleExpansiveDirt(x,z);
  return dirt&&dirt.ground===ID.dirt?dirt:{ground:ID.ocean,height:0};
 }
 const spawns=local.spawns.map(spawn=>{
  const host=nearestPlacement(spawn.x,spawn.z);
  return {...spawn,x:spawn.x+(host?.offsetX||0),z:spawn.z+(host?.offsetZ||0)};
 });
 const mapMarkers=placements.map(placement=>({id:placement.id,
  x:placement.x,z:placement.z,radius:placement.radius}));
 const nav={
  width:scale.width,height:scale.height,name:local.name+" · "+scale.label,
  ground:scale.id==="current"?local.ground:null,
  heights:scale.id==="current"?local.heights:null,
  trees:scale.id==="current"?local.trees:[],
  objects,spawns,placements,regions,mapMarkers,
  groundAt:(x,z)=>groundAt(x,z).ground,
  isOcean:(x,z)=>groundAt(x,z).ground===ID.ocean,
  sparse:scale.id!=="current"||!!dirtFootprint,altitudeScale:scale.altitudeScale,
  localWidth:local.width,localHeight:local.height,
  expansiveDirt:dirtFootprint
 };
 const pathNearLand=(x0,z0,x1,z1)=>{
  // Sparse dirt is physically elevated. A flight over it must not skip
  // collision merely because the only *authored* island is far away.
  if(dirtFootprint?.rules.enabled){
   const dx=x1-x0,dz=z1-z0;
   const d=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(d/Math.max(8,Math.min(scale.width,scale.height)*.015)));
   for(let i=0;i<=steps;i++){
    const c=sampleExpansiveDirt(x0+dx*i/steps,z0+dz*i/steps);
    if(c?.ground===ID.dirt)return true;
   }
  }
  // Broad-phase only: skip per-0.75-unit terrain/object checks over vast
  // empty ocean. Check a bounded number of existing semantic destinations.
  const midX=(x0+x1)/2,midZ=(z0+z1)/2;
  const lengthSquared=(x1-x0)**2+(z1-z0)**2;
  for(const region of regions){
   const cx=region.x+nearest(midX,region.x,scale.width);
   const cz=region.z+nearest(midZ,region.z,scale.height);
   const fraction=lengthSquared>0?Math.max(0,Math.min(1,
    ((cx-x0)*(x1-x0)+(cz-z0)*(z1-z0))/lengthSquared)):0;
   if(Math.hypot(cx-(x0+(x1-x0)*fraction),
    cz-(z0+(z1-z0)*fraction))<region.radius+7)return true;
  }
  return false;
 };
 return {preset:scale,nav,groundAt,pathNearLand,expansiveDirt:dirtFootprint,dirtExpansion,
  sampleExpansiveDirt,
  placementOf:(id)=>placements.find(x=>x.id===id),
  nearestLandInstance:(pilot,placement)=>({
   // nearest() is ONLY an integer wrap-period offset (zero near the
   // canonical island), not the island's absolute coordinate. The source
   // terrain vertices already contain placement.localX/Z, so translate by
   // the semantic relocation exactly once plus the nearest wrap period.
   x:placement.offsetX+nearest(pilot.x,placement.x,scale.width),
   z:placement.offsetZ+nearest(pilot.z,placement.z,scale.height)
  })
 };
}
export function localRenderPoint(global,origin){
 if(![global.x,global.z,origin.x,origin.z].every(Number.isFinite))
  throw Error("Invalid floating-origin coordinates");
 return {x:global.x-origin.x,z:global.z-origin.z};
}

// Preserve the pilot's geographical neighborhood when switching scale instead
// of silently calling resetSpawn(). The 500² local island geometry is NOT
// enlarged: we relocate the same offset relative to its semantic anchor.
export function transferScalePosition(pilot,previous,next){
 if(!pilot||![pilot.x,pilot.y,pilot.z].every(Number.isFinite))
  throw Error("Invalid pilot position");
 const from=previous?.nav,to=next?.nav;
 if(!from||!to)throw Error("Invalid scale transition");
 let nearestRegion=null,minDistance=Infinity;
 for(const source of from.placements){
  const dx=signed(pilot.x,source.x,from.width);
  const dz=signed(pilot.z,source.z,from.height);
  const d=Math.hypot(dx,dz);
  if(d<minDistance){minDistance=d;nearestRegion={source,dx,dz};}
 }
 const destination=nearestRegion&&to.placements.find(p=>p.id===nearestRegion.source.id);
 // Close to a destination: keep the EXACT local distance to that feature.
 // In open ocean: preserve relative coordinates across the planet.
 const local=destination&&minDistance<=nearestRegion.source.radius+90;
 const onDirt=!local&&previous.sampleExpansiveDirt?.(pilot.x,pilot.z)?.ground===ID.dirt&&previous.dirtExpansion&&next.dirtExpansion;
 // A scale transition made while travelling on dirt keeps the same canonical
 // route coordinate, then evaluates it in the destination experience plan.
 // This is the same mapping used by gameplay sampling, not a percentage guess.
 const canonicalRoute=onDirt?mapRouteDistance(previous.dirtExpansion,wrap(pilot.x,from.width),"experience").value:null;
 const x=local?destination.x+nearestRegion.dx:onDirt?
  mapRouteDistance(next.dirtExpansion,canonicalRoute,"canonical").value:
  wrap(pilot.x,from.width)/from.width*to.width;
 const z=local?destination.z+nearestRegion.dz:
  wrap(pilot.z,from.height)/from.height*to.height;
 return {
  x,z,
  y:Math.max(next.groundAt(x,z).height+2,
   pilot.y/previous.preset.altitudeScale*next.preset.altitudeScale)
 };
}
