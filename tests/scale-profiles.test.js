import test from "node:test";
import assert from "node:assert/strict";
import {sampleWorld,ID} from "../src/world-data.js";
import {makeScaleWorld,SCALE_PRESETS,RENDER_BUDGET,localRenderPoint} from "../src/scale-world.js";
import {altitudeProfile} from "../src/flight-model.js";
import {makeHorizonState,setHorizonPosition,buildOceanGeometry} from "../src/horizon.js";
import {travelRegion} from "../src/travel-regions.js";
import {createFlybyTracker,resetFlybyTracker,updateFlybys} from "../src/flight-momentum.js";
import islandData from "../src/worlds/floating-islands.json" with {type:"json"};

function source(){const world=sampleWorld();world.objects=islandData.objects;return world;}
test("exactly three scale presets; massive grows area by 1024x, not tile allocations",()=>{
 assert.deepEqual(Object.keys(SCALE_PRESETS),["current","bigger","massive"]);
 assert.equal(SCALE_PRESETS.current.width,500);
 assert.equal(SCALE_PRESETS.bigger.width,2500);
 assert.equal(SCALE_PRESETS.massive.width,16000);
 assert.equal((SCALE_PRESETS.massive.width/500)**2,1024);
 assert.equal(RENDER_BUDGET.localMapTiles,250000);
 assert.equal(RENDER_BUDGET.worldTilesAllocatedPerScaleChange,0);
 for(const preset of Object.values(SCALE_PRESETS)){
  const scene=makeScaleWorld(source(),preset.id);
  assert.equal(scene.nav.width,preset.width);
  assert.equal(scene.nav.height,preset.height);
  assert.equal(scene.nav.placements.length,2);
  assert.equal(scene.nav.objects.length,islandData.objects.length);
  assert.equal(scene.nav.spawns.length,2);
  assert.equal(scene.nav.ground?.length||0,preset.id==="current"?250000:0);
  assert.equal(scene.nav.heights?.length||0,preset.id==="current"?250000:0);
 }
});
test("both original island sizes, local collision elevations and floating structures survive relocation",()=>{
 const local=source();
 const old=makeScaleWorld(local,"current");
 const big=makeScaleWorld(local,"massive");
 for(let i=0;i<2;i++){
  const a=old.nav.placements[i],b=big.nav.placements[i];
  assert.equal(a.radius,b.radius);
  assert.ok(Math.abs(a.x-b.x)>1000);
  assert.ok(Math.abs(a.z-b.z)>1000);
  assert.deepEqual(big.groundAt(b.x,b.z),old.groundAt(a.x,a.z));
 }
 for(const obj of local.objects){
  const placed=big.nav.objects.find(item=>item.id===obj.id);
  assert.ok(placed);
  assert.equal(placed.at[1],obj.at[1]);
  assert.deepEqual(placed.parts,obj.parts);
 }
 assert.equal(big.nav.ground,null);
 assert.equal(big.nav.heights,null);
});
test("expansive dirt and actual ocean coexist; seam wraps the authored destination",()=>{
 const huge=makeScaleWorld(source(),"massive"),a=huge.nav.placements[0];
 assert.equal(huge.groundAt(8000,8000).ground,ID.dirt);
 assert.equal(huge.groundAt(8000,0).ground,ID.ocean);
 assert.equal(huge.groundAt(a.x,a.z).ground,huge.groundAt(a.x+16000,a.z).ground);
 assert.equal(huge.nav.isOcean(8000,8000),false);
 assert.equal(huge.nav.isOcean(8000,0),true);
 assert.equal(huge.pathNearLand(0,0,200,0),false);
 assert.equal(huge.pathNearLand(a.x-150,a.z,a.x+150,a.z),true);
 const land=huge.nearestLandInstance({x:a.x+16000,z:a.z+16000},a);
 assert.equal(land.x-a.offsetX,16000);
 assert.equal(land.z-a.offsetZ,16000);
});
test("per-planet globe altitude and ocean curvature scale without new geometry",()=>{
 const low=altitudeProfile(34);
 assert.equal(low.globeReveal,0);
 for(const preset of Object.values(SCALE_PRESETS)){
  const lowAltitude=altitudeProfile(35*preset.altitudeScale,preset.altitudeScale);
  const orbit=altitudeProfile(445*preset.altitudeScale,preset.altitudeScale);
  assert.equal(orbit.globeReveal,1);
  assert.equal(orbit.planetRadius,preset.radius);
  assert.equal(lowAltitude.curvature,low.curvature);
  const state=makeHorizonState();
  setHorizonPosition(state,{x:0,z:0},1,1,preset.radius);
  assert.equal(state.globeRadius.value,preset.radius);
  const sea=buildOceanGeometry(preset.radius);
  assert.equal(sea.getAttribute("position").count,1+54*120);
  assert.equal(sea.index.count,120*3+53*120*6);
  sea.dispose();
 }
});
test("crossing the empty massive ocean retains momentum and protected island bonus",()=>{
 const w=makeScaleWorld(source(),"massive").nav,regions=w.regions;
 const a=w.placements[0];
 assert.equal(travelRegion(w,regions,a.x,a.z,35).factor,1);
 assert.ok(travelRegion(w,regions,8000,8000,35).factor<.1);
 assert.equal(travelRegion(w,regions,8000,8000,10000).factor,1);
 const tracker=createFlybyTracker();
 resetFlybyTracker(tracker,w,regions,a.x,a.z);
 const edge=Math.max(...regions.map(r=>r.radius));
 const flyby=updateFlybys(tracker,w,regions,a.x+edge+60,a.z,35,60,20);
 assert.ok(flyby.reward>0);
});
test("floating-origin relative rendering uses exact subtraction, not 16000-size GPU coordinates",()=>{
 const p=localRenderPoint({x:16000.125,z:16000.875},{x:16000,z:16000});
 assert.deepEqual(p,{x:.125,z:.875});
 assert.throws(()=>localRenderPoint({x:NaN,z:0},{x:0,z:0}),/Invalid/);
});
