import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {altitudeProfile,targetTravelSpeed,damp,smoothstep,LIMITS} from "../src/flight-model.js";
import {curvatureDrop,HORIZON_FLAT_RADIUS,GLOBE_RADIUS,globeSurface,makeHorizonState,setHorizonPosition,curveMaterial,horizonOcean} from "../src/horizon.js";

test("altitude speed increases continuously and descending restores normal travel",()=>{
 const low=altitudeProfile(30),mid=altitudeProfile(175),high=altitudeProfile(380);
 assert.equal(low.layer,"overworld");
 assert.equal(high.layer,"near-space");
 assert.ok(low.travelMultiplier < mid.travelMultiplier);
 assert.ok(mid.travelMultiplier < high.travelMultiplier);
 assert.equal(altitudeProfile(30).travelMultiplier,low.travelMultiplier);
 assert.ok(targetTravelSpeed(320) > targetTravelSpeed(30));
 assert.ok(targetTravelSpeed(100,true)>targetTravelSpeed(100));
 assert.equal(LIMITS.exit,Number.POSITIVE_INFINITY);
 assert.ok(targetTravelSpeed(35,true)>=targetTravelSpeed(35,false)*8);
 assert.ok(altitudeProfile(445).globeReveal>0.999);
});
test("curvature, sky tint and cloud fade blend rather than switching abruptly",()=>{
 for(let y=0;y<500;y+=.5){
  const a=altitudeProfile(y),b=altitudeProfile(y+.5);
  for(const prop of ["curvature","skyFade","cloudFade","globeReveal"]){
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
 assert.equal(state.globe.value,0);
 setHorizonPosition(state,ship,1,1);
 assert.equal(state.globe.value,1);
 const ocean=horizonOcean(state);
 assert.equal(ocean.name,"single-curved-horizon-ocean");
 assert.equal(ocean.material.transparent,false);
 assert.equal(ocean.material.opacity,1);
 assert.ok(ocean.geometry.getAttribute("position").count<8000);
 assert.equal(ocean.material.userData.horizonState,state);
 const groundMaterial=curveMaterial(new THREE.MeshLambertMaterial(),state);
 assert.equal(groundMaterial.userData.horizonState,ocean.material.userData.horizonState);
 const shader={uniforms:{},vertexShader:"#include <common>\n#include <begin_vertex>"};
 groundMaterial.onBeforeCompile(shader);
 assert.ok(shader.vertexShader.includes("horizonWorldVertex"));
 assert.ok(shader.vertexShader.includes("sphereHorizontal"));
 assert.ok(shader.vertexShader.includes("projectedXZ"));
 assert.equal(shader.uniforms.uGlobeReveal,state.globe);
 assert.equal(shader.uniforms.uHorizonStrength,state.strength);
 ocean.geometry.dispose();ocean.material.dispose();groundMaterial.dispose();
});

test("high-altitude sphere positions are bounded and preserve sea/land projection",()=>{
 const center=globeSurface(0);
 const equator=globeSurface(GLOBE_RADIUS*Math.PI/2);
 const opposite=globeSurface(GLOBE_RADIUS*Math.PI);
 assert.equal(center.horizontal,0);
 assert.equal(center.drop,0);
 assert.ok(Math.abs(equator.horizontal-GLOBE_RADIUS)<1e-9);
 assert.ok(Math.abs(equator.drop-GLOBE_RADIUS)<1e-9);
 assert.ok(Math.abs(opposite.horizontal)<1e-8);
 assert.ok(Math.abs(opposite.drop-2*GLOBE_RADIUS)<1e-8);
 assert.deepEqual(globeSurface(100),globeSurface(100));
 assert.throws(()=>globeSurface(-5),/Invalid/);
});
test("the globe stays in view while flying beyond its first reveal altitude",()=>{
 const revealAt=altitudeProfile(445),higher=altitudeProfile(900);
 assert.equal(revealAt.globeReveal,1);
 assert.equal(higher.globeReveal,1);
 assert.equal(revealAt.layer,"near-space");
 assert.ok(targetTravelSpeed(900,true)>targetTravelSpeed(900,false));
});
