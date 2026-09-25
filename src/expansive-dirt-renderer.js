import * as THREE from "three";
import {ID} from "./world-data.js";
import {curveMaterial} from "./horizon.js";

// Two fixed-budget surfaces: broad cheap continent LOD and small close-up
// mesh sharing the EXACT same elevation sampler as navigation. No 16k grid.
const COLORS=["#986f4c","#b78c60","#80563d","#684832"];
const HALF=192,STEP=4,GRID=96;
function color(sample){
 const result=new THREE.Color(COLORS[sample.shade]||COLORS[0]);
 const factor=1+(sample.outline||0)*.25;
 result.multiplyScalar(factor);
 return result;
}
function geometryFromGrid(sampler,x0,z0,dx,dz,nx,nz){
 const vertices=[],colors=[],indices=[];
 // One sample per vertex rather than three/four repeated noise evaluations
 // per cell, and indexed triangles for the 4 GB hardware budget.
 const samples=new Array((nx+1)*(nz+1));
 const c=new THREE.Color();
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const x=x0+i*dx,z=z0+j*dz;
  const sample=sampler(x,z);
  samples[j*(nx+1)+i]=sample;
  const shade=color(sample);c.copy(shade);
  vertices.push(x,sample.height,z);colors.push(c.r,c.g,c.b);
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const a=j*(nx+1)+i,b=a+1,c=a+(nx+1),d=c+1;
  // Never bridge procedurally absent water or authored-island exclusion zones.
  if([samples[a],samples[b],samples[c]].every(v=>v.ground===ID.dirt))
   indices.push(a,c,b);
  if([samples[b],samples[c],samples[d]].every(v=>v.ground===ID.dirt))
   indices.push(b,c,d);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
 g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
 g.setIndex(indices);g.computeVertexNormals();
 return g;
}
export function createExpansiveDirtRenderer(scene,horizonState,diagnostics=null){
 const material=curveMaterial(new THREE.MeshLambertMaterial({
  color:"#ffffff",vertexColors:true,side:THREE.DoubleSide
 }),horizonState);
 const distant=new THREE.Mesh(new THREE.BufferGeometry(),material);
 const near=new THREE.Mesh(new THREE.BufferGeometry(),material);
 for(const m of [distant,near]){m.frustumCulled=false;scene.add(m);}
 let world=null,lastX=NaN,lastZ=NaN,lastTick=-Infinity;
 function rebuild(scaleScene){
  const started=performance.now();
  world=scaleScene;lastX=NaN;lastZ=NaN;lastTick=-Infinity;
  const old=distant.geometry;
  distant.visible=!!world.expansiveDirt?.rules.enabled;
  near.visible=false;
  if(distant.visible){
   const {radiusX, radiusZ,x,z}=world.expansiveDirt;
   const sampler=(px,pz)=>world.sampleExpansiveDirt(px,pz);
   distant.geometry=geometryFromGrid(sampler,x-radiusX*1.065,z-radiusZ*1.065,
    radiusX*2.13/112,radiusZ*2.13/112,112,112);
  }else distant.geometry=new THREE.BufferGeometry();
  old.dispose();
  if(distant.visible)diagnostics?.meshBuild({level:"far",ms:performance.now()-started,
   samples:113*113,vertices:113*113,triangles:distant.geometry.index?.count/3||0,
   coordinate:{x:world.expansiveDirt.x,z:world.expansiveDirt.z}});
 }
 function update(pilot,now=0){
  if(!world?.expansiveDirt?.rules.enabled){distant.visible=near.visible=false;return;}
  distant.visible=true;
  distant.position.set(-pilot.x,0,-pilot.z);
  const active=pilot.y-world.groundAt(pilot.x,pilot.z).height<250;
  if(!active){near.visible=false;return;}
  if(!Number.isFinite(lastX)||Math.hypot(pilot.x-lastX,pilot.z-lastZ)>32&&now-lastTick>.2){
   const ox=Math.floor(pilot.x/STEP)*STEP-HALF;
   const oz=Math.floor(pilot.z/STEP)*STEP-HALF;
   const buildStart=performance.now();
   const geometry=geometryFromGrid(world.sampleExpansiveDirt,ox,oz,STEP,STEP,GRID,GRID);
   diagnostics?.meshBuild({level:"near",ms:performance.now()-buildStart,samples:(GRID+1)**2,
    vertices:(GRID+1)**2,triangles:geometry.index?.count/3||0,
    coordinate:{x:ox,z:oz}});
   near.geometry.dispose();near.geometry=geometry;
   lastX=pilot.x;lastZ=pilot.z;lastTick=now;
  }
  near.visible=true;near.position.copy(distant.position);
  // The near mesh uses the authoritative sampled heights. It is drawn last,
  // with a small depth bias over the broad LOD; a future seamless clip/blend
  // pass can remove the remaining coarse/fine overlap at the edge.
  near.renderOrder=1;
 }
 function dispose(){
  for(const mesh of [distant,near]){scene.remove(mesh);mesh.geometry.dispose();}
  material.dispose();
 }
 return {rebuild,update,dispose};
}
