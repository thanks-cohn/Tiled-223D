import * as THREE from "three";

// Horizon-first visual-only geometry. The collision map stays in flat X/Z/Y;
// ocean AND terrain use the SAME vertex deformation to avoid hovering shores.
export const HORIZON_RADIUS=475;
export const HORIZON_FLAT_RADIUS=105;
export function curvatureDrop(distance,strength=1,radius=HORIZON_RADIUS,flat=HORIZON_FLAT_RADIUS){
 if(![distance,strength,radius,flat].every(Number.isFinite)||
  distance<0||strength<0||strength>1||radius<=0||flat<0)throw Error("Invalid horizon settings");
 const beyond=Math.max(0,distance-flat);
 return strength*beyond*beyond/(2*radius);
}
export function makeHorizonState(){
 return {
  center:{value:new THREE.Vector2()},
  strength:{value:0},
  radius:{value:HORIZON_RADIUS},
  flat:{value:HORIZON_FLAT_RADIUS}
 };
}
export function setHorizonPosition(state,ship,curvature){
 state.center.value.set(ship.x,ship.z);
 state.strength.value=THREE.MathUtils.clamp(curvature,0,1);
}
// Called once at material construction. The shared uniforms change each frame,
// but mesh geometry, materials and textures are NEVER re-created per frame.
export function curveMaterial(material,state){
 if(material.userData.horizonState===state)return material;
 material.userData.horizonState=state;
 material.onBeforeCompile=(shader)=>{
  shader.uniforms.uHorizonCenter=state.center;
  shader.uniforms.uHorizonStrength=state.strength;
  shader.uniforms.uHorizonRadius=state.radius;
  shader.uniforms.uHorizonFlat=state.flat;
  shader.vertexShader=shader.vertexShader
   .replace("#include <common>",`#include <common>
uniform vec2 uHorizonCenter;
uniform float uHorizonStrength;
uniform float uHorizonRadius;
uniform float uHorizonFlat;`)
   .replace("#include <begin_vertex>",`#include <begin_vertex>
// World-space displacement keeps the shoreline tied to the same curved sea.
// Instancing is handled for the trees without moving authoritative world data.
vec4 horizonWorldVertex = vec4(position, 1.0);
#ifdef USE_INSTANCING
 horizonWorldVertex = instanceMatrix * horizonWorldVertex;
#endif
horizonWorldVertex = modelMatrix * horizonWorldVertex;
float horizonDistance = length(horizonWorldVertex.xz-uHorizonCenter);
float horizonBeyond = max(0.0,horizonDistance-uHorizonFlat);
transformed.y -= uHorizonStrength*horizonBeyond*horizonBeyond/(2.0*uHorizonRadius);`);
 };
 material.customProgramCacheKey=()=> "shared-horizon-v2";
 material.needsUpdate=true;
 return material;
}
export function horizonOcean(state){
 // A compact radial disc has a true curved edge as altitude rises.
 // Unlike a second transparent globe, this is the ONLY sea mesh and it
 // never paints a blue layer over islands or doubles full-screen overdraw.
 const sectors=144,rings=28,extent=925;
 const verts=[0,0,0],index=[];
 for(let ring=1;ring<=rings;ring++){
  const radius=extent*Math.pow(ring/rings,1.15);
  for(let segment=0;segment<sectors;segment++){
   const angle=2*Math.PI*segment/sectors;
   verts.push(Math.cos(angle)*radius,0,Math.sin(angle)*radius);
  }
 }
 for(let segment=0;segment<sectors;segment++){
  index.push(0,1+segment,1+(segment+1)%sectors);
 }
 for(let ring=1;ring<rings;ring++)for(let segment=0;segment<sectors;segment++){
  const a=1+(ring-1)*sectors+segment;
  const b=1+(ring-1)*sectors+(segment+1)%sectors;
  const c=1+ring*sectors+segment;
  const d=1+ring*sectors+(segment+1)%sectors;
  index.push(a,c,b,b,c,d);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
 geometry.setIndex(index);
 geometry.computeVertexNormals();
 const material=curveMaterial(new THREE.MeshBasicMaterial({
  color:"#19598d",side:THREE.DoubleSide,depthWrite:true,
  transparent:false,fog:false
 }),state);
 const ocean=new THREE.Mesh(geometry,material);
 ocean.name="single-curved-horizon-ocean";
 ocean.position.y=-.35;
 // The GPU bends the real vertices; let the renderer consider the disc
 // potentially visible even when its flat bounding box misses the frustum.
 ocean.frustumCulled=false;
 return ocean;
}
