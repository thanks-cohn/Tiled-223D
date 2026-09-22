import * as THREE from "three";
import {landmasses,nearestWrappedOffset} from "./landmasses.js";

// Lightweight visual projection only. The canonical Tiled world and flight
// collision continue to use their original flat coordinates. A true spherical
// navigation/physics system can replace this visual adapter in a later phase.
export const VISUAL_PLANET_RADIUS=420;
const UP=new THREE.Vector3(0,1,0);
export function curvatureDrop(distance,radius=VISUAL_PLANET_RADIUS) {
 if(!Number.isFinite(distance)||distance<0||!Number.isFinite(radius)||radius<=0)
  throw Error("Invalid curvature dimensions");
 const d=Math.min(distance,radius);
 return radius-Math.sqrt(Math.max(0,radius*radius-d*d));
}
export function createPlanetVisuals(scene,flatOcean,world) {
 const water=new THREE.Mesh(
  new THREE.SphereGeometry(VISUAL_PLANET_RADIUS,48,28),
  new THREE.MeshBasicMaterial({
   color:"#19598d",transparent:true,opacity:0,depthWrite:false,fog:false
  })
 );
 water.name="altitude-visual-ocean-sphere";
 water.visible=false;scene.add(water);
 let caps=[];
 function setWorld(nextWorld) {
  for(const cap of caps) {
   scene.remove(cap.group);
   cap.group.traverse(node=>{
    if(node.isMesh){node.geometry.dispose();node.material.dispose();}
   });
  }
  caps=landmasses(nextWorld).map(region=>{
   // These two tiny colored discs are planet-scale, high-altitude LOD for the
   // real Tiled islands; they do not contain new land or affect collisions.
   const rx=(region.bounds[2]-region.bounds[0])/2;
   const rz=(region.bounds[3]-region.bounds[1])/2;
   const group=new THREE.Group();
   group.name="planet-proxy:"+region.id;
   for(const [scale,color,elevation] of [[1,"#e8cf8a",0],[.77,"#65a44f",.08]]) {
    const geometry=new THREE.CircleGeometry(Math.max(1,rx),24);
    geometry.rotateX(-Math.PI/2);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
     color,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide
    }));
    mesh.scale.z=Math.max(.15,rz/Math.max(1,rx));
    mesh.position.y=elevation;
    group.add(mesh);
   }
   group.visible=false;scene.add(group);return {group,region};
  });
 }
 setWorld(world);
 return {
  setWorld,
  update(ship,profile,currentWorld) {
   const opacity=profile.curvature;
   flatOcean.material.transparent=true;
   flatOcean.material.opacity=1-opacity;
   flatOcean.material.depthWrite=opacity<.01;
   flatOcean.visible=opacity<.999;
   water.visible=opacity>.001;
   water.material.opacity=opacity;
   // Move the visual planet with the local tangent point. Its uppermost point
   // stays at sea level; the rest curves away, revealing a curved horizon.
   water.position.set(ship.x,-VISUAL_PLANET_RADIUS-.35,ship.z);
   for(const {group,region} of caps) {
    const x=region.centerX+
     nearestWrappedOffset(ship.x,region.centerX,currentWorld.width);
    const z=region.centerZ+
     nearestWrappedOffset(ship.z,region.centerZ,currentWorld.height);
    const dx=x-ship.x,dz=z-ship.z;
    const d=Math.hypot(dx,dz);
    const vertical=Math.sqrt(Math.max(0,VISUAL_PLANET_RADIUS**2-d*d));
    group.position.set(x,vertical-VISUAL_PLANET_RADIUS-.35+.7,z);
    const outward=new THREE.Vector3(dx,vertical,dz).normalize();
    group.quaternion.setFromUnitVectors(UP,outward);
    group.visible=opacity>.001 && d<VISUAL_PLANET_RADIUS-5;
    for(const mesh of group.children)mesh.material.opacity=opacity;
   }
  },
  dispose() {
   for(const cap of caps){scene.remove(cap.group);cap.group.traverse(node=>{
    if(node.isMesh){node.geometry.dispose();node.material.dispose();}
   });}
   scene.remove(water);water.geometry.dispose();water.material.dispose();
  }
 };
}
