import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {sampleWorld,ID} from "../src/world-data.js";
import {protectedRegions,travelRegion,EXPANSE} from "../src/travel-regions.js";
import {targetTravelSpeed,altitudeProfile} from "../src/flight-model.js";
import {islandVisualTransform,cinematicShipScale,cameraAscentHeight} from "../src/visual-anchors.js";
import {curvatureDrop,globeSurface,GLOBE_RADIUS} from "../src/horizon.js";

const floating=[
 {id:"island_A",parent:"sky_archipelago",at:[145,47,279],
  parts:[{footprint:{radii:[12,10]}}]},
 {id:"island_B",parent:"sky_archipelago",at:[121,35,272],
  parts:[{footprint:{radii:[5.7,5.5]}}]},
 {id:"island_C",parent:"sky_archipelago",at:[169,55,269],
  parts:[{footprint:{radii:[6.2,6]}}]}
];
function demo(){const world=sampleWorld();world.objects=floating;return world;}

test("small ground and sky archipelago share a 1:1 local-speed sanctuary",()=>{
 const w=demo(),regions=protectedRegions(w);
 assert.equal(regions.length,2);
 assert.ok(regions.some(r=>r.id.includes("sky_archipelago")));
 assert.ok(regions.every(r=>r.radius*2>=EXPANSE.localMinimumDiameter));
 assert.ok(regions.every(r=>r.radius*2<=EXPANSE.maxProtectedDiameter));
 for(const p of [[145,235],[145,279],[121,272],[169,269],[345,270]]){
  const local=travelRegion(w,regions,...p,35,false);
  assert.equal(local.factor,1,"Preserve original speed at "+p);
  assert.equal(local.mode,"local");
 }
});

test("ocean takes longer at low altitude without changing map dimensions",()=>{
 const w=demo(),regions=protectedRegions(w),oldWidth=w.width,oldHeight=w.height;
 const near=travelRegion(w,regions,145,235,35,false);
 const crossing=travelRegion(w,regions,240,270,35,false);
 assert.equal(near.factor,1);
 assert.equal(crossing.mode,"expansive-ocean");
 assert.ok(Math.abs(crossing.factor-EXPANSE.oceanCruiseFactor)<1e-8);
 const normalSpeed=targetTravelSpeed(35)*crossing.factor;
 const nearSpeed=targetTravelSpeed(35)*near.factor;
 assert.ok(normalSpeed<nearSpeed/5);
 assert.equal(w.width,oldWidth);
 assert.equal(w.height,oldHeight);
 assert.equal(w.ground.length,oldWidth*oldHeight);
 assert.equal(w.ground[270*w.width+240],ID.ocean);
});

test("Shift remains fast and high altitude restores rapid planetary traversal",()=>{
 const w=demo(),regions=protectedRegions(w);
 const low=travelRegion(w,regions,240,270,35,false);
 const turbo=travelRegion(w,regions,240,270,35,true);
 assert.ok(Math.abs(turbo.factor-EXPANSE.oceanTurboFactor)<1e-8);
 assert.ok(targetTravelSpeed(35,true)*turbo.factor>
  targetTravelSpeed(35,false)*low.factor*10);
 const high=travelRegion(w,regions,240,270,300,false);
 assert.equal(high.factor,1);
 assert.ok(targetTravelSpeed(300)*high.factor>targetTravelSpeed(35)*low.factor);
});

test("speed transitions smoothly and are periodic at wraparound edges",()=>{
 const w=demo(),regions=protectedRegions(w);
 const epsilon=1e-3;
 for(let x=165;x<245;x+=.25){
  const a=travelRegion(w,regions,x,270,35,false);
  const b=travelRegion(w,regions,x+epsilon,270,35,false);
  assert.ok(Math.abs(a.factor-b.factor)<.003,"Abrupt speed change near "+x);
 }
 const left=travelRegion(w,regions,-260,270,35,false);
 const right=travelRegion(w,regions,240,270,35,false);
 assert.ok(Math.abs(left.factor-right.factor)<1e-10);
 const atSea=travelRegion(w,regions,240,270,95,false);
 const above=travelRegion(w,regions,240,270,260,false);
 assert.ok(atSea.factor<=above.factor);
 assert.throws(()=>travelRegion(w,regions,NaN,0,35),/Invalid/);
});

test("spherical visual island anchors keep their bottoms radially outward",()=>{
 const ship={x:145,y:465,z:245};
 const close={x:145,y:47,z:245};
 const distant={x:210,y:47,z:295};
 const original=islandVisualTransform(ship,distant,0,0);
 assert.ok(original.position.distanceTo(new THREE.Vector3(210,47,295))<1e-9);
 assert.ok(original.normal.distanceTo(new THREE.Vector3(0,1,0))<1e-9);
 const reveal=islandVisualTransform(ship,distant,1,1);
 const distance=Math.hypot(distant.x-ship.x,distant.z-ship.z);
 const sphere=globeSurface(distance,GLOBE_RADIUS);
 assert.ok(Math.abs(reveal.position.y-(distant.y-sphere.drop))<1e-9);
 assert.ok(Math.abs(reveal.normal.length()-1)<1e-10);
 assert.ok(reveal.normal.y<1);
 const anchor=islandVisualTransform(ship,close,1,1);
 assert.equal(anchor.position.y,close.y);
 assert.ok(anchor.normal.distanceTo(new THREE.Vector3(0,1,0))<1e-9);
 assert.equal(cinematicShipScale(0),1);
 assert.ok(cinematicShipScale(1)>1);
 assert.ok(cameraAscentHeight(26,1)>cameraAscentHeight(26,0));
});
