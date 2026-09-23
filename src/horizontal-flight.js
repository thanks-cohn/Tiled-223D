import {terrainBlocksEntry,objectBlocksEntry} from "./flight-collision.js";

// Near-surface movement is continuous, not all-or-nothing: advance to the
// last safe sample if a destination is blocked. Never warp pilot to spawn.
// Collision checks run ONLY in the caller's near-land/low-altitude broad phase.
export function sweepHorizontal({start,target,altitude,groundAt,hitAt,stepSize=.75}){
 if(!start||!target||![start.x,start.z,target.x,target.z,altitude,stepSize]
  .every(Number.isFinite)||stepSize<=0||
  typeof groundAt!=="function"||typeof hitAt!=="function")
  throw Error("Invalid horizontal flight sweep");
 const dx=target.x-start.x,dz=target.z-start.z;
 const distance=Math.hypot(dx,dz);
 const samples=Math.max(1,Math.ceil(distance/stepSize));
 // Unbounded sampling can freeze a low-memory browser at super speed.
 // Do NOT silently skip samples and tunnel through authored colliders.
 if(samples>5000)return {
  x:start.x,z:start.z,blocked:"LOW FLIGHT · Ascend before extreme-speed travel",
  sampled:0
 };
 const currentGround=groundAt(start.x,start.z);
 const currentHit=hitAt(start.x,start.z);
 let x=start.x,z=start.z;
 for(let i=1;i<=samples;i++){
  const fraction=i/samples;
  const px=start.x+dx*fraction,pz=start.z+dz*fraction;
  if(terrainBlocksEntry(currentGround,groundAt(px,pz),altitude))
   return {x,z,blocked:"RIDGE AHEAD · Reverse or ascend to clear the surface",
    sampled:i};
  const obstacle=hitAt(px,pz);
  if(objectBlocksEntry(currentHit,obstacle))
   return {x,z,blocked:"FLOATING ISLAND · "+obstacle.objectId+
    " · Reverse or ascend",sampled:i};
  x=px;z=pz;
 }
 return {x:target.x,z:target.z,blocked:null,sampled:samples};
}
