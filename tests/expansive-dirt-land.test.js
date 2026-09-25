import test from "node:test";
import assert from "node:assert/strict";
import {ID,sampleWorld} from "../src/world-data.js";
import {makeScaleWorld} from "../src/scale-world.js";
import {dirtLandSample,expansiveDirtFootprint,validateExpansiveDirt} from "../src/expansive-dirt-land.js";

test("expansive mode adds independent sparse dirt continent without altering authored islands or a 16k grid",()=>{
 const local=sampleWorld(),original=local.ground.slice(),heights=local.heights.slice();
 const massive=makeScaleWorld(local,"massive");
 const bigger=makeScaleWorld(local,"bigger");
 assert.equal(massive.nav.ground,null);
 assert.equal(massive.nav.heights,null);
 assert.equal(massive.expansiveDirt.id,"expansive-dirt:continent");
 assert.equal(massive.expansiveDirt.targetAreaFraction,1/3);
 assert.equal(massive.groundAt(8000,8000).ground,ID.dirt);
 assert.equal(bigger.groundAt(1250,1250).ground,ID.dirt);
 assert.equal(makeScaleWorld(local,"current").expansiveDirt,null);
 assert.deepEqual(local.ground,original);
 assert.deepEqual(local.heights,heights);
 const island=massive.nav.placements[0];
 assert.notEqual(massive.groundAt(island.x,island.z).ground,ID.dirt);
});

test("dirt sampling is deterministic, multi-shade, elevated and has three configurable ramp types",()=>{
 const options=validateExpansiveDirt({seed:27,rampCoverage:{large:1,medium:1,small:1}});
 const sample=(x,z)=>dirtLandSample(x,z,2500,2500,options,[]);
 assert.deepEqual(sample(1250,1250),sample(1250,1250));
 const shades=new Set(),ramps=new Set();let heights=0;
 for(let x=750;x<=1750;x+=7)for(let z=750;z<=1750;z+=9){
  const s=sample(x,z);if(s.ground!==ID.dirt)continue;
  shades.add(s.shade);if(s.ramp)ramps.add(s.ramp.kind);
  heights+=Number(s.height>0);
 }
 assert.ok(shades.size>=3);
 assert.ok(heights>100);
 assert.ok(ramps.has("large")&&ramps.has("medium")&&ramps.has("small"));
 assert.equal(dirtLandSample(0,0,2500,2500,options).ground,ID.ocean);
 assert.throws(()=>validateExpansiveDirt({rampCoverage:{large:.7,medium:.5}}),/Invalid expansive dirt/);
 assert.throws(()=>validateExpansiveDirt({areaFraction:2}),/Invalid expansive dirt/);
 assert.throws(()=>validateExpansiveDirt({expansion:"unknown"}),/Invalid expansive dirt/);
});

test("protected authored footprint cannot be swallowed by separate continent",()=>{
 const opts=validateExpansiveDirt({areaFraction:.5});
 const loc=[{x:1250,z:1250,radius:75}];
 assert.equal(dirtLandSample(1250,1250,2500,2500,opts,loc).ground,ID.ocean);
 assert.equal(dirtLandSample(1350,1250,2500,2500,opts,loc).ground,ID.dirt);
 const footprint=expansiveDirtFootprint(16000,16000);
 assert.ok(footprint.radiusX>0&&footprint.radiusZ>0);
});
