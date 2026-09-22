import {ID,cell,wrap} from "./world-data.js";
import {landmasses} from "./landmasses.js";
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

export function makeScaleWorld(local,id="current"){
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
  for(const placement of placements){
   const dx=signed(x,placement.x,scale.width);
   const dz=signed(z,placement.z,scale.height);
   // Only tiny original island surroundings are tile-backed. Everything
   // outside those patches is procedural ocean: NO huge ground array.
   if(Math.abs(dx)>placement.radius+3||Math.abs(dz)>placement.radius+3)continue;
   const hit=cell(local,placement.localX+dx,placement.localZ+dz);
   if(hit.ground!==ID.ocean)return hit;
  }
  return {ground:ID.ocean,height:0};
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
  sparse:scale.id!=="current",altitudeScale:scale.altitudeScale,
  localWidth:local.width,localHeight:local.height
 };
 const pathNearLand=(x0,z0,x1,z1)=>{
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
 return {preset:scale,nav,groundAt,pathNearLand,
  placementOf:(id)=>placements.find(x=>x.id===id),
  nearestLandInstance:(pilot,placement)=>({
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
