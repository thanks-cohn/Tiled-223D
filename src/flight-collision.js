import {ID} from "./world-data.js";

// Boundary equality should not be treated as embedding: the ship is allowed
// to fly parallel to the surface at groundHeight+clearance.
export function terrainBlocksEntry(current,next,altitude,clearance=2){
 if(!Number.isFinite(altitude)||!Number.isFinite(clearance))throw Error("Invalid flight altitude");
 if(next.ground===ID.ocean||next.height+clearance<=altitude+1e-4)return false;
 const initiallyInside=current.ground!==ID.ocean &&
  current.height+clearance>=altitude-1e-4;
 // If already inside a ridge (e.g. from descending or rounding), let the
 // pilot travel horizontally on the same/lower surface to escape. An uphill
 // step still blocks; R/Up remain emergency ascent controls.
 if(initiallyInside)return next.height>current.height+1e-4;
 return true;
}
export function objectBlocksEntry(currentHit,nextHit){
 if(!nextHit)return false;
 // Never trap the ship inside a collider: any direction that remains within
 // its current object is allowed until the ship finds clear space again.
 return !(currentHit && currentHit.objectId===nextHit.objectId);
}
