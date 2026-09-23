// V8 semantic choreography. Pure deterministic recipes: NO mesh allocation,
// no ship-speed edits, no per-frame RNG and no full-world cloud array.
import {smoothBand} from "./atmosphere-model.js";
export const CLOUD_FAMILIES=Object.freeze(["cumulus","wisps","cloud-bank","broken"]);
export const CLOUD_CHOREOGRAPHY=Object.freeze({
 cinematicHover:Object.freeze({id:"cinematic-hover",near:1,middle:.58,high:.17,planetary:.05,
  purpose:"California-highway cruising: low wisps slide past; far sky holds its composition"}),
 activeFlight:Object.freeze({id:"active-flight",near:1,middle:.82,high:.24,planetary:.06,
  purpose:"dramatic close cloud flybys contrasted against a steady upper sky"}),
 expansiveAscent:Object.freeze({id:"expansive-ascent",near:.62,middle:1,high:.66,planetary:.25,
  purpose:"distinct motion above and below, with long-lived far formations"}),
 planetary:Object.freeze({id:"planetary",near:.12,middle:.25,high:.4,planetary:1,
  purpose:"large slow-moving ground-parallel cloud patterns across the globe"})
});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const mix=(a,b,t)=>a+(b-a)*t;
// True proximity controls scene motion: speed does not teleport existing clouds.
export function cloudMotionProfile(altitude,globeReveal=0){
 if(!Number.isFinite(altitude)||!Number.isFinite(globeReveal))
  throw Error("Invalid cloud altitude");
 const t0=smoothBand(65,110,altitude),t1=smoothBand(160,225,altitude);
 const t2=smoothBand(300,390,altitude);
 const bands=[(1-t0),t0*(1-t1),t1*(1-t2),t2];
 const defs=Object.values(CLOUD_CHOREOGRAPHY);
 const layerIds=["low","middle","high","planetary"];
 const emphasis=Object.fromEntries(layerIds.map((id,j)=>[
  id,bands.reduce((sum,weight,i)=>sum+weight*
   defs[i][["near","middle","high","planetary"][j]],0)
 ]));
 emphasis.planetary*=clamp(globeReveal,0,1);
 return {bands,emphasis,dominant:defs[bands.indexOf(Math.max(...bands))].id};
}
// Small 32-bit integer hash stays deterministic on return to a region and
// doesn't rely on Math.sin precision for massive world coordinates.
export function cloudHash(x,z,seed=0){
 let n=(Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^
  Math.imul(seed|0,2246822519))|0;
 n=Math.imul(n^(n>>>13),1274126177);
 return ((n^(n>>>16))>>>0)/4294967296;
}
export function cloudAppearance(x,z,seed,layerId){
 const r=cloudHash(x,z,seed);
 const r2=cloudHash(x,z,seed+13);
 const r3=cloudHash(x,z,seed+29);
 const bias=layerId==="high"?.62:layerId==="planetary"?.47:0;
 const familyIndex=Math.min(3,Math.floor(((r+bias)%1)*4));
 return {
  family:CLOUD_FAMILIES[familyIndex],
  widthScale:.68+r2*.95,
  heightScale:.62+r3*.75,
  opacityScale:.68+cloudHash(x,z,seed+41)*.32,
  spin:(cloudHash(x,z,seed+53)-.5)*.24
 };
}
// Reuse is triggered by leaving a layer's usable view; the cadence ONLY caps
// work. At super speed skip all intermediate regions, evaluate current location.
export function cloudRecyclePolicy(layerId,altitude,speed,planetRadius=235){
 const nominal={low:72,middle:153,high:282,planetary:12}[layerId];
 if(nominal===undefined||![altitude,speed,planetRadius].every(Number.isFinite)||
  planetRadius<=0)throw Error("Invalid recycle policy input");
 const horizontal={low:145,middle:330,high:1000,planetary:planetRadius*.53}[layerId];
 const distance=horizontal*(layerId==="planetary"?1:1+
  .45*clamp(Math.abs(altitude-nominal)/400,0,1));
 const closeness=1/(1+Math.abs(altitude-nominal)/160);
 const displacement=Math.abs(speed)*closeness;
 // Farther layers get more geographical persistence at identical ship speed.
 const interval=clamp(distance/(Math.max(12,displacement)*5),.13,
  layerId==="high"?2.4:layerId==="planetary"?3.5:1.3);
 return {distance,interval,
  maxReassignments:layerId==="low"?3:layerId==="middle"?2:1};
}
export function seededCloudPlacement(ship,yaw,layerId,sequence,world,planetRadius=235){
 if(!ship||!Number.isFinite(ship.x)||!Number.isFinite(ship.z)||
  !Number.isFinite(yaw)||!Number.isInteger(sequence)||
  !world||!Number.isFinite(world.width)||!Number.isFinite(world.height))
  throw Error("Invalid cloud placement inputs");
 const cell={low:84,middle:172,high:510,planetary:Math.max(240,planetRadius*.33)}[layerId];
 if(!cell)throw Error("Unknown cloud layer");
 const gx=Math.floor(ship.x/cell),gz=Math.floor(ship.z/cell);
 // Spatial sequence differs by slot and region; broad sky is asymmetrical.
 const seed=sequence*17+["low","middle","high","planetary"].indexOf(layerId)*71;
 const a=cloudHash(gx,gz,seed),b=cloudHash(gx,gz,seed+1);
 const longitudinal=(.58+a*1.12)*cell;
 const sideways=(b-.5)*cell*2.6;
 const aheadX=-Math.sin(yaw),aheadZ=-Math.cos(yaw);
 const x=ship.x+aheadX*longitudinal-aheadZ*sideways;
 const z=ship.z+aheadZ*longitudinal+aheadX*sideways;
 // Use stable WORLD grid to choose appearance; the cloud never rerolls while
 // visible. Planet width affects its coordinates, not memory allocation.
 const appearance=cloudAppearance(Math.floor(x/cell),Math.floor(z/cell),seed,layerId);
 return {x,z,...appearance};
}
