import test from "node:test";
import assert from "node:assert/strict";
import {
 CLOUD_FAMILIES,CLOUD_CHOREOGRAPHY,cloudHash,cloudAppearance,
 cloudMotionProfile,cloudRecyclePolicy,seededCloudPlacement
} from "../src/cloud-choreography.js";
import {CLOUD_RENDER_BUDGET} from "../src/atmosphere-model.js";

test("all four altitude moods preserve distinct parallax hierarchies",()=>{
 assert.equal(Object.keys(CLOUD_CHOREOGRAPHY).length,4);
 const hover=cloudMotionProfile(35,0),flight=cloudMotionProfile(130,0);
 const ascent=cloudMotionProfile(260,.4),orbit=cloudMotionProfile(445,1);
 assert.equal(hover.dominant,"cinematic-hover");
 assert.equal(flight.dominant,"active-flight");
 assert.equal(ascent.dominant,"expansive-ascent");
 assert.equal(orbit.dominant,"planetary");
 assert.ok(flight.emphasis.low>flight.emphasis.high);
 assert.ok(ascent.emphasis.middle>ascent.emphasis.low);
 assert.ok(ascent.emphasis.middle>ascent.emphasis.planetary);
 assert.ok(orbit.emphasis.planetary>orbit.emphasis.high);
 assert.equal(hover.emphasis.planetary,0);
});
test("mood transitions partition altitude continuously with no hard band switch",()=>{
 for(let h=0;h<500;h+=.25){
  const a=cloudMotionProfile(h,Math.min(1,h/445));
  const b=cloudMotionProfile(h+.25,Math.min(1,(h+.25)/445));
  assert.ok(Math.abs(a.bands.reduce((x,y)=>x+y,0)-1)<1e-8);
  for(const key of ["low","middle","high","planetary"]){
   assert.ok(a.emphasis[key]>=0&&a.emphasis[key]<=1);
   assert.ok(Math.abs(a.emphasis[key]-b.emphasis[key])<.025);
  }
 }
});
test("seeded placement produces variety without creating full world cloud data",()=>{
 const world={width:16000,height:16000},ship={x:4050,z:3090};
 const placements=Array.from({length:12},(_,i)=>
  seededCloudPlacement(ship,.4,"middle",i,world,7520));
 assert.ok(new Set(placements.map(p=>p.family)).size>1);
 assert.ok(new Set(placements.map(p=>p.widthScale.toFixed(3))).size>7);
 assert.ok(new Set(placements.map(p=>p.x.toFixed(2)+","+p.z.toFixed(2))).size===12);
 assert.deepEqual(placements[0],
  seededCloudPlacement(ship,.4,"middle",0,world,7520));
 assert.notDeepEqual(placements[0],
  seededCloudPlacement({x:ship.x+3400,z:ship.z},.4,"middle",0,world,7520));
 assert.deepEqual(CLOUD_FAMILIES,["cumulus","wisps","cloud-bank","broken"]);
 assert.equal(CLOUD_RENDER_BUDGET.sprites,27);
});
test("near deck refreshes sooner than far high deck at comparable speed",()=>{
 const low=cloudRecyclePolicy("low",130,120),upper=cloudRecyclePolicy("high",130,120);
 assert.ok(low.interval<upper.interval);
 assert.ok(low.distance<upper.distance);
 assert.equal(low.maxReassignments,3);
 assert.equal(upper.maxReassignments,1);
 assert.ok(cloudRecyclePolicy("low",130,10000).interval>=.13);
 assert.ok(cloudRecyclePolicy("planetary",445,10000,7520).maxReassignments<=1);
 assert.throws(()=>cloudRecyclePolicy("invalid",30,100),/Invalid/);
 assert.throws(()=>seededCloudPlacement({x:NaN,z:0},0,"low",0,{width:500,height:500}),/Invalid/);
});
test("hash and appearance are reproducible on very large coordinates",()=>{
 for(const x of [0,500,16000,1000000]){
  const a=cloudHash(x,1429,23);
  assert.ok(a>=0&&a<1);
  assert.equal(a,cloudHash(x,1429,23));
  const appearance=cloudAppearance(x,1429,23,"high");
  assert.ok(CLOUD_FAMILIES.includes(appearance.family));
  assert.ok(appearance.widthScale>=.68&&appearance.widthScale<1.63);
  assert.ok(appearance.opacityScale>=.68&&appearance.opacityScale<=1);
 }
});
