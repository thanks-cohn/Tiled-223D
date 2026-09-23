import test from "node:test";
import assert from "node:assert/strict";
import {sampleWorld} from "../src/world-data.js";
import {makeScaleWorld,SCALE_PRESETS,transferScalePosition} from "../src/scale-world.js";
import {cameraViewProfile,nextCameraChoice,overviewCameraScale,forwardLookAngle,overviewFocusHeight,planetOverviewFov} from "../src/camera-modes.js";
import {sweepHorizontal} from "../src/horizontal-flight.js";
import {advanceMomentum} from "../src/flight-momentum.js";
import {ID} from "../src/world-data.js";

test("low/mid auto default forward; high/top overview; every altitude permits manual choice",()=>{
 for(const height of [34,125,160]){
  assert.equal(cameraViewProfile(height,"auto").forwardWeight,1);
  assert.equal(cameraViewProfile(height,"auto").overviewWeight,0);
 }
 for(const height of [225,260,445]){
  assert.equal(cameraViewProfile(height,"auto").overviewWeight,1);
  assert.equal(cameraViewProfile(height,"forward").forwardWeight,1);
  assert.equal(cameraViewProfile(height,"overview").overviewWeight,1);
 }
 assert.equal(cameraViewProfile(35,"overview").forwardWeight,0);
 assert.equal(cameraViewProfile(445,"forward").overviewWeight,0);
 // Each button press switches the ACTUAL view, never stalls on Auto.
 assert.equal(nextCameraChoice("auto",35),"overview");
 assert.equal(nextCameraChoice("auto",445),"forward");
 assert.equal(nextCameraChoice("forward",445),"overview");
 assert.equal(nextCameraChoice("overview",35),"forward");
 assert.equal(nextCameraChoice(nextCameraChoice("auto",35),35),"forward");
 assert.equal(nextCameraChoice(nextCameraChoice("auto",445),445),"overview");
 assert.throws(()=>cameraViewProfile(NaN),/Invalid/);
});
test("Massive shares the same camera perspective as Current and Bigger",()=>{
 const worldScales=[1,5,32];
 for(const normalizedAltitude of [34,130,175,200,225,330,445]){
  const localScale=overviewCameraScale(normalizedAltitude,1);
  assert.equal(localScale,1);
  const ratios=worldScales.map(scale=>
   overviewCameraScale(normalizedAltitude,scale)/scale);
  if(normalizedAltitude>=445)
   for(const ratio of ratios)assert.ok(Math.abs(ratio-1)<1e-10);
  // Important: X/Z following distance and Y elevation must use the SAME
  // world-scale factor; no 32× vertical-only camera on the Massive planet.
  for(const scale of worldScales){
   const factor=overviewCameraScale(normalizedAltitude,scale);
   assert.equal((14*factor)/(7*factor),2);
   const result=cameraViewProfile(normalizedAltitude,"auto");
   assert.ok(result.overviewWeight>=0&&result.overviewWeight<=1);
   assert.equal(result.forwardWeight+result.overviewWeight,1);
  }
 }
 assert.equal(overviewCameraScale(34,32),1);
 assert.equal(overviewCameraScale(225,32),32);
 assert.equal(overviewCameraScale(445,32),32);
 assert.equal(overviewCameraScale(445,5),5);
 assert.throws(()=>overviewCameraScale(35,0),/Invalid/);
});
test("forward flight never points the camera above the horizon while climbing",()=>{
 for(const height of [0,34,65,110,145,175,200,225,285,445,2000]){
  const globe=Math.max(0,Math.min(1,(height-235)/210));
  const angle=forwardLookAngle(height,globe);
  assert.ok(angle>0&&angle<Math.PI/2);
  const horizontal=130+7520*.6*Math.max(0,Math.min(1,height/445));
  const upDisplacement=-horizontal*Math.tan(angle);
  assert.ok(upDisplacement<0);
 }
 assert.ok(forwardLookAngle(190) > forwardLookAngle(34));
 assert.ok(forwardLookAngle(445,1)>forwardLookAngle(190));
 assert.throws(()=>forwardLookAngle(NaN),/Invalid/);
});
test("Massive overview points at surface during ascent instead of empty sky",()=>{
 for(const planetScale of [1,5,32]){
  const radius=235*planetScale;
  const low=overviewFocusHeight(34,34,radius,0,2);
  const mid=overviewFocusHeight(160*planetScale,160,radius,0,5);
  const high=overviewFocusHeight(225*planetScale,225,radius,0,8);
  const orbit=overviewFocusHeight(445*planetScale,445,radius,1,10);
  assert.equal(low,32);
  assert.ok(mid<160*planetScale-5);
  assert.ok(high<225*planetScale*.1);
  assert.equal(orbit,-radius);
 }
 assert.throws(()=>overviewFocusHeight(500,225,0,0,8),/Invalid/);
});
test("planet overview fills more of frame than V7 without changing forward-view lens",()=>{
 assert.equal(planetOverviewFov(76,0,1),76);
 assert.equal(planetOverviewFov(76,1,0),76);
 assert.equal(planetOverviewFov(76,1,1),46);
 assert.ok(planetOverviewFov(76,.5,1)<76);
 assert.throws(()=>planetOverviewFov(Infinity,1,1),/Invalid/);
});
test("sparse island visual transform keeps exact relocated center instead of visual teleport",()=>{
 const source=sampleWorld();
 for(const key of Object.keys(SCALE_PRESETS)){
  const scaled=makeScaleWorld(source,key);
  for(const mass of scaled.nav.placements){
   const instance=scaled.nearestLandInstance({x:mass.x,z:mass.z},mass);
   assert.equal(instance.x+mass.localX,mass.x);
   assert.equal(instance.z+mass.localZ,mass.z);
   const across=scaled.nearestLandInstance({
    x:mass.x+scaled.nav.width,z:mass.z-scaled.nav.height
   },mass);
   assert.equal(across.x+mass.localX,mass.x+scaled.nav.width);
   assert.equal(across.z+mass.localZ,mass.z-scaled.nav.height);
  }
 }
});
test("world-size changes preserve relative destination position and altitude",()=>{
 const source=sampleWorld(),small=makeScaleWorld(source,"current");
 const big=makeScaleWorld(source,"massive");
 const island=small.nav.placements[0],dest=big.nav.placements[0];
 const p={x:island.x+12,y:80,z:island.z-14};
 const moved=transferScalePosition(p,small,big);
 assert.equal(moved.x,dest.x+12);
 assert.equal(moved.z,dest.z-14);
 assert.equal(moved.y,80*32);
 assert.deepEqual(transferScalePosition(moved,big,small),p);
 const open=transferScalePosition({x:250,y:45,z:450},small,big);
 assert.equal(open.x,8000);
 assert.equal(open.z,14400);
 assert.throws(()=>transferScalePosition({x:NaN,y:0,z:0},small,big),/Invalid/);
});
test("collision sweep stops at last safe sample instead of resetting or entering a wall",()=>{
 const groundAt=(x,z)=>({ground:x>=2?ID.grass:ID.ocean,height:x>=2?10:0});
 const hitAt=()=>null;
 const result=sweepHorizontal({start:{x:0,z:0},target:{x:4,z:0},
  altitude:3,groundAt,hitAt,stepSize:.5});
 assert.equal(result.blocked.includes("RIDGE"),true);
 assert.ok(result.x>=1.5&&result.x<2);
 assert.equal(result.z,0);
 const away=sweepHorizontal({start:{x:result.x,z:0},target:{x:-3,z:0},
  altitude:3,groundAt,hitAt});
 assert.equal(away.blocked,null);
 assert.equal(away.x,-3);
});
test("island collider blocks entry but never blocks reversing from its edge",()=>{
 const groundAt=()=>({ground:ID.ocean,height:0});
 const hitAt=(x)=>x>=1&&x<=3?{objectId:"island_A"}:null;
 const first=sweepHorizontal({start:{x:0,z:0},target:{x:5,z:0},
  altitude:34,groundAt,hitAt});
 assert.ok(first.blocked.includes("FLOATING ISLAND"));
 assert.ok(first.x<1);
 const reverse=sweepHorizontal({start:{x:first.x,z:0},target:{x:-3,z:0},
  altitude:34,groundAt,hitAt});
 assert.equal(reverse.blocked,null);
 assert.equal(reverse.x,-3);
 const huge=sweepHorizontal({start:{x:0,z:0},target:{x:10000,z:0},
  altitude:34,groundAt,hitAt});
 assert.ok(huge.blocked.includes("Ascend"));
 assert.equal(huge.x,0);
});
test("manual S reverse thrust from cruise produces reverse motion after stopping",()=>{
 const speed=advanceMomentum(0,-1,.05,{accelerationFactor:1});
 assert.ok(speed<0);
});
