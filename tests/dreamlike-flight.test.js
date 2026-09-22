import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {altitudeProfile,targetTravelSpeed,damp,smoothstep,LIMITS} from "../src/flight-model.js";
import {createPlanetVisuals,curvatureDrop,VISUAL_PLANET_RADIUS} from "../src/planet-visuals.js";
import {sampleWorld} from "../src/world-data.js";

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
test("visual planet has real curvature while local ground remains canonical",()=>{
 const R=VISUAL_PLANET_RADIUS;
 assert.equal(curvatureDrop(0),0);
 assert.ok(curvatureDrop(40)>0);
 assert.ok(curvatureDrop(200)>curvatureDrop(40));
 assert.equal(curvatureDrop(R),R);
 const world=sampleWorld(),scene=new THREE.Scene();
 const flatOcean=new THREE.Mesh(new THREE.PlaneGeometry(10,10),
  new THREE.MeshBasicMaterial({color:"#19598d"}));
 const visuals=createPlanetVisuals(scene,flatOcean,world);
 const globe=scene.getObjectByName("altitude-visual-ocean-sphere");
 visuals.update({x:145,y:30,z:280},altitudeProfile(30),world);
 assert.equal(flatOcean.visible,true);assert.equal(globe.visible,false);
 visuals.update({x:145,y:180,z:280},altitudeProfile(180),world);
 assert.equal(globe.visible,true);assert.ok(globe.material.opacity>0 && globe.material.opacity<1);
 visuals.update({x:145,y:325,z:280},altitudeProfile(325),world);
 assert.equal(flatOcean.visible,false);assert.equal(globe.material.opacity,1);
 const proxies=scene.children.filter(child=>child.name.startsWith("planet-proxy:"));
 assert.equal(proxies.length,2);
 visuals.dispose();
 assert.equal(scene.getObjectByName("altitude-visual-ocean-sphere"),undefined);
 flatOcean.geometry.dispose();flatOcean.material.dispose();
});
