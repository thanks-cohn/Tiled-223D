import {ID,wrap} from "./world-data.js";
import {landmasses} from "./landmasses.js";

// Perceptual travel model, NOT a change to map dimensions or island size.
// Each small semantic location keeps its existing 1:1 flight-speed zone.
// Ocean demands roughly twice the earlier acceleration effort. This factor
// now controls NEW acceleration only: earned momentum must not be erased.
export const EXPANSE=Object.freeze({
 localMinimumDiameter:100,
 maxProtectedDiameter:158,
 boundaryBlend:20,
 oceanCruiseFactor:.055,
 oceanTurboFactor:.11,
 altitudeRecoveryStart:95,
 altitudeRecoveryEnd:260
});
const smooth=(a,b,x)=>{
 const v=Math.max(0,Math.min(1,(x-a)/(b-a)));
 return v*v*(3-2*v);
};
const distanceWrapped=(a,b,size)=>{
 const delta=Math.abs(wrap(a-b,size));
 return Math.min(delta,size-delta);
};
function buildLandRegion(mass) {
 const [xmin,zmin,xmax,zmax]=mass.bounds;
 const radius=Math.min(EXPANSE.maxProtectedDiameter/2,
  Math.max(EXPANSE.localMinimumDiameter/2,Math.hypot(xmax-xmin,zmax-zmin)/2+15));
 return {id:mass.id,material:"land",x:mass.centerX,z:mass.centerZ,radius};
}
function floatingClusters(world) {
 const grouped=new Map();
 for(const object of world.objects||[]){
  if(!Array.isArray(object.at)||!Array.isArray(object.parts))continue;
  const parent=object.parent||object.id;
  const radius=Math.max(0,...object.parts.map(part=>
   Math.max(...(part.footprint?.radii||[0]))));
  if(!grouped.has(parent))grouped.set(parent,[]);
  grouped.get(parent).push({x:wrap(object.at[0],world.width),
   z:wrap(object.at[2],world.height),radius,id:object.id});
 }
 return [...grouped].map(([id,items])=>{
  // Keep cluster members together in periodic coordinates. This demo's
  // sky_archipelago is an ordinary small group, not a new landmass.
  const anchor=items[0];
  const x=items.reduce((sum,item)=>sum+anchor.x+
   Math.atan2(Math.sin((item.x-anchor.x)*2*Math.PI/world.width),
   Math.cos((item.x-anchor.x)*2*Math.PI/world.width))
    *world.width/(2*Math.PI),0)/items.length;
  const z=items.reduce((sum,item)=>sum+anchor.z+
   Math.atan2(Math.sin((item.z-anchor.z)*2*Math.PI/world.height),
   Math.cos((item.z-anchor.z)*2*Math.PI/world.height))
    *world.height/(2*Math.PI),0)/items.length;
  const radius=Math.min(EXPANSE.maxProtectedDiameter/2,Math.max(
   EXPANSE.localMinimumDiameter/2,
   ...items.map(item=>Math.hypot(distanceWrapped(x,item.x,world.width),
    distanceWrapped(z,item.z,world.height))+item.radius+12)));
  return {id,material:"structure-cluster",x:wrap(x,world.width),
   z:wrap(z,world.height),radius};
 });
}
export function protectedRegions(world){
 const ground=landmasses(world).map(buildLandRegion);
 const sky=floatingClusters(world);
 // Merge a sky archipelago and the ground island directly below it into ONE
 // familiar-speed destination, rather than two overlapping speed boundaries.
 for(const region of sky){
  const host=ground.find(mass=>Math.hypot(
   distanceWrapped(region.x,mass.x,world.width),
   distanceWrapped(region.z,mass.z,world.height)) < mass.radius+region.radius);
  if(!host){ground.push(region);continue;}
  const dx=((region.x-host.x+world.width/2)%world.width+world.width)%world.width-world.width/2;
  const dz=((region.z-host.z+world.height/2)%world.height+world.height)%world.height-world.height/2;
  const cx=wrap(host.x+dx*.5,world.width),cz=wrap(host.z+dz*.5,world.height);
  host.radius=Math.min(EXPANSE.maxProtectedDiameter/2,
   Math.max(EXPANSE.localMinimumDiameter/2,
    Math.hypot(distanceWrapped(cx,host.x,world.width),distanceWrapped(cz,host.z,world.height))+host.radius,
    Math.hypot(distanceWrapped(cx,region.x,world.width),distanceWrapped(cz,region.z,world.height))+region.radius));
  host.x=cx;host.z=cz;host.id+="+"+region.id;
 }
 return ground;
}
export function travelRegion(world,regions,x,z,altitude,boost=false){
 if(![x,z,altitude].every(Number.isFinite))throw Error("Invalid flight coordinates");
 if(!Number.isFinite(world.width)||!Number.isFinite(world.height))throw Error("Invalid world");
 const tile=typeof world.groundAt==="function"?world.groundAt(x,z):
  world.ground[Math.floor(wrap(z,world.height))*world.width+
   Math.floor(wrap(x,world.width))];
 let closest=Infinity,inside=null;
 for(const region of regions){
  const distance=Math.hypot(distanceWrapped(x,region.x,world.width),
   distanceWrapped(z,region.z,world.height))-region.radius;
  if(distance<closest){closest=distance;inside=region.id;}
 }
 const locallyProtected=1-smooth(0,EXPANSE.boundaryBlend,closest);
 const atmosphericAltitude=altitude/(world.altitudeScale||1);
 const altitudeRecovery=smooth(EXPANSE.altitudeRecoveryStart,
  EXPANSE.altitudeRecoveryEnd,atmosphericAltitude);
 // Only ocean is enabled in V4. Land/sand expansion can be opted into by
 // semantic terrain class later without changing this spatial schema.
 const openOcean=tile===ID.ocean;
 const expansiveness=openOcean*(1-locallyProtected)*(1-altitudeRecovery);
 const lowFactor=boost?EXPANSE.oceanTurboFactor:EXPANSE.oceanCruiseFactor;
 return {factor:1-expansiveness*(1-lowFactor),
  openness:expansiveness,within:inside,
  mode:expansiveness>.5?"expansive-ocean":"local"};
}
