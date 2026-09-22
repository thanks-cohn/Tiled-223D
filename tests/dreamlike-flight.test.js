import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {altitudeProfile,targetTravelSpeed,damp,smoothstep,LIMITS} from "../src/flight-model.js";
import {curvatureDrop,HORIZON_FLAT_RADIUS,makeHorizonState,setHorizonPosition,curveMaterial,horizonOcean} from "../src/horizon.js";

test("altitude speed increases continuously and descending restores normal travel",()=>{
 const low=altitudeProfile(30),mid=altitudeProfile(175),high=altitudeProfile(380);
 assert.equal(low.layer,"overworld");
 assert.equal(high.layer,"near-space");
 assert.ok(low.travelMultiplier < mid.travelMultiplier);
 assert.ok(mid.travelMultiplier < high.travelMultiplier);
 assert.equal(altitudeProfile(30).travelMultiplier,low.travelMultiplier);
 assert.ok(targetTravelSpeed(320) > targetTravelSpeed(30));
 assert.ok(targetTravelSpeed(100,true)>targetTravelSpeed(100));
 assert.equal(LIMITS.exit,500);
});
test("curvature, sky tint and cloud fade blend rather than switching abruptly",()=>{
 for(let y=0;y<500;y+=.5){
  const a=altitudeProfile(y),b=altitudeProfile(y+.5);
  for(const prop of ["curvature","skyFade","cloudFade"]){
   assert.ok(a[prop]>=0 && a[prop]<=1);
   assert.ok(Math.abs(a[prop]-b[prop])<.015,`Altitude pop at ${y} for ${prop}`);
  }
 }
 assert.equal(altitudeProfile(30).curvature,0);
 assert.equal(altitudeProfile(300).curvature,1);
 assert.ok(altitudeProfile(30).cloudFade>altitudeProfile(300).cloudFade);
 assert.throws(()=>smoothstep(3,3,1),/Invalid/);
});
test("damping is frame-rate independent for constant input",()=>{
 const first=damp(0,100,3,.05),second=damp(first,100,3,.05);
 assert.ok(Math.abs(second-damp(0,100,3,.1))<1e-10);
 assert.ok(first>0 && first<100);
 assert.throws(()=>damp(0,10,4,-1),/Invalid/);
});
test("horizon stays flat nearby, then grows smoothly with altitude",()=>{
 assert.equal(curvatureDrop(0),0);
 assert.equal(curvatureDrop(HORIZON_FLAT_RADIUS),0);
 assert.equal(curvatureDrop(HORIZON_FLAT_RADIUS+10,0),0);
 assert.ok(curvatureDrop(HORIZON_FLAT_RADIUS+50,.4)>0);
 assert.ok(curvatureDrop(HORIZON_FLAT_RADIUS+100,1)>curvatureDrop(HORIZON_FLAT_RADIUS+50,1));
 assert.ok(curvatureDrop(HORIZON_FLAT_RADIUS+75,.6)<curvatureDrop(HORIZON_FLAT_RADIUS+75,1));
 assert.throws(()=>curvatureDrop(-1),/Invalid/);
});
test("a single opaque ocean and land share one curvature uniform",()=>{
 const state=makeHorizonState(),ship={x:152,y:195,z:271};
 setHorizonPosition(state,ship,altitudeProfile(ship.y).curvature);
 assert.equal(state.center.value.x,ship.x);
 assert.equal(state.center.value.y,ship.z);
 const ocean=horizonOcean(state);
 assert.equal(ocean.name,"single-curved-horizon-ocean");
 assert.equal(ocean.material.transparent,false);
 assert.equal(ocean.material.opacity,1);
 assert.ok(ocean.geometry.getAttribute("position").count<5000);
 assert.equal(ocean.material.userData.horizonState,state);
 const groundMaterial=curveMaterial(new THREE.MeshLambertMaterial(),state);
 assert.equal(groundMaterial.userData.horizonState,ocean.material.userData.horizonState);
 const shader={uniforms:{},vertexShader:"#include <common>\n#include <begin_vertex>"};
 groundMaterial.onBeforeCompile(shader);
 assert.ok(shader.vertexShader.includes("horizonWorldVertex"));
 assert.equal(shader.uniforms.uHorizonStrength,state.strength);
 ocean.geometry.dispose();ocean.material.dispose();groundMaterial.dispose();
});
