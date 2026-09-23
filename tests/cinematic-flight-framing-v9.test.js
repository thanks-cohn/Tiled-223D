import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {createMassiveFlightFraming} from "../src/cinematic-flight-framing.js";
import {massiveShipPresentation} from "../src/massive-ship-presentation.js";
import {projectPoint} from "../src/spatial-math.js";

const options=(fraction,aspect=16/9)=>({
 worldId:"massive",normalizedAltitude:350,overviewWeight:1,
 cameraNear:40,fieldOfView:46,aspect,visualExtent:3.4,
 composition:fraction
});

test("Massive ship maintains one representation; actual projected size fades continuously for both view directions",()=>{
 const framing=createMassiveFlightFraming();
 let last=framing.state().visibility;
 let lastFraction=0;
 for(let i=0;i<150;i++){
  const a=framing.update({overviewWeight:1,dt:1/60,
   target:{u:.5,v:.73,heightFraction:.15}});
  const p=massiveShipPresentation(options(a));
  assert.equal(p.active,true);
  assert.ok(a.engagement>=last);
  assert.ok(a.heightFraction>=lastFraction);
  assert.ok(a.heightFraction-lastFraction<.009);
  assert.ok(a.heightFraction<=.151);
  assert.ok(Math.abs(p.viewport.v-.73)<.02);
  last=a.engagement;lastFraction=a.heightFraction;
 }
 assert.ok(last>.999);
 // No new spatial parent, threshold or sudden disappearance on repeated
 // Forward/Overview retargets or across the historical altitude 185 boundary.
 for(const target of [0,1,0,1,0,1,0]){
  const previous=framing.state().visibility;
  const current=framing.update({overviewWeight:target,dt:1/60,
   target:{u:.5,v:.73,heightFraction:.15}});
  assert.ok(Math.abs(current.engagement-previous)<.12);
  for(const height of [35,130,184.99,185,225,445,1200]){
   const p=massiveShipPresentation({...options(current),normalizedAltitude:height,
    overviewWeight:target});
   assert.equal(p.active,true);
   assert.equal(p.visible,current.visible);
   assert.ok(p.scale>=0);
  }
 }
 for(let i=0;i<180;i++)framing.update({overviewWeight:0,dt:1/60,
  target:{u:.5,v:.73,heightFraction:.15}});
 const hidden=framing.update({overviewWeight:0,dt:1/60,
  target:{u:.5,v:.73,heightFraction:.15}});
 assert.equal(hidden.visible,false);
 assert.equal(massiveShipPresentation(options(hidden)).scale,0);
});
test("Massive camera-relative display always projects onto its declared viewport anchor at varied FOV and aspect",()=>{
 const camera=new THREE.PerspectiveCamera(46,16/9,40,50000);
 camera.position.set(0,0,0);
 camera.updateMatrixWorld(true);
 const target={u:.45,v:.71,heightFraction:.13};
 for(const aspect of [4/3,16/9,21/9]){
  for(const fov of [43,46,68]){
   camera.aspect=aspect;camera.fov=fov;camera.updateProjectionMatrix();
   const p=massiveShipPresentation({...options(target,aspect),
    fieldOfView:fov});
   const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,
    camera.matrixWorldInverse).elements;
   const out=projectPoint({x:p.x,y:p.y,z:p.z},vp,{width:1200,height:700});
   assert.equal(out.status,"in-frustum");
   assert.ok(Math.abs(out.viewport.u-target.u)<1e-10);
   assert.ok(Math.abs(out.viewport.v-target.v)<1e-10);
   assert.ok(Math.abs(2*(-p.z)*Math.tan(fov*Math.PI/360)*
    target.heightFraction/p.scale-3.4)<1e-9);
  }
 }
});
test("smaller worlds are never reparented by Massive-only presentation",()=>{
 for(const worldId of ["current","bigger"]){
  const p=massiveShipPresentation({...options({u:.5,v:.7,heightFraction:.15}),
   worldId});
  assert.equal(p.active,false);
 }
});
