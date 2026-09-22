import * as THREE from "three";
import {curvatureDrop,globeSurface,GLOBE_RADIUS} from "./horizon.js";

const UP=new THREE.Vector3(0,1,0);
// The island is a semantic 3D object, not a sky-dome decoration. At altitude,
// place it at the SAME spherical X/Z + drop as the canonical land/ocean mesh.
// Its outward-facing top normal points away from the globe center, keeping
// the underside toward Earth while preserving its original dimensions.
export function islandVisualTransform(ship,worldPosition,curvature,globeReveal,planetRadius=GLOBE_RADIUS){
 const dx=worldPosition.x-ship.x,dz=worldPosition.z-ship.z;
 const distance=Math.hypot(dx,dz);
 const fraction=THREE.MathUtils.clamp(globeReveal,0,1);
 const spherical=globeSurface(distance,planetRadius);
 const low=curvatureDrop(distance,THREE.MathUtils.clamp(curvature,0,1),475*planetRadius/GLOBE_RADIUS);
 const ratio=distance>1e-8?spherical.horizontal/distance:1;
 const x=worldPosition.x+(ship.x+dx*ratio-worldPosition.x)*fraction;
 const z=worldPosition.z+(ship.z+dz*ratio-worldPosition.z)*fraction;
 const y=worldPosition.y-THREE.MathUtils.lerp(low,spherical.drop,fraction);
 const arc=Math.min(distance/planetRadius,Math.PI);
 const normal=new THREE.Vector3(
  distance>1e-8?dx/distance*Math.sin(arc):0,
  Math.cos(arc),
  distance>1e-8?dz/distance*Math.sin(arc):0
 );
 normal.lerpVectors(UP,normal,fraction).normalize();
 return {position:new THREE.Vector3(x,y,z),normal};
}
export function positionIslandVisual(item,group,ship,profile){
 const base=group.position.clone();
 const transform=islandVisualTransform(ship,base,profile.curvature,profile.globeReveal,profile.planetRadius??GLOBE_RADIUS);
 group.position.copy(transform.position);
 group.quaternion.setFromUnitVectors(UP,transform.normal);
 const spritePosition=transform.position.clone().addScaledVector(
  transform.normal,item.heightCenter);
 item.mid.position.copy(spritePosition);
 item.far.position.copy(spritePosition);
 // Geometry and billboard sizes remain unchanged at ALL altitudes.
}
export function cinematicShipScale(globeReveal){return 1+10*THREE.MathUtils.clamp(globeReveal,0,1);}
export function cameraAscentHeight(baseHeight,globeReveal){
 return baseHeight+118*THREE.MathUtils.clamp(globeReveal,0,1);
}
