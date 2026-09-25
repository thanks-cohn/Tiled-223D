import test from "node:test";
import assert from "node:assert/strict";
import {sampleWorld,ID} from "../src/world-data.js";
import {landmasses} from "../src/landmasses.js";
import {createDirtWorld,validateDirtRule,dirtShade} from "../src/expansive-dirt.js";

test("default one-third dirt is per-landmass, deterministic, and never changes elevation/source",()=>{
 const source=sampleWorld();
 const originalGround=source.ground.slice(),originalHeights=source.heights.slice();
 const first=createDirtWorld(source),second=createDirtWorld(source);
 assert.deepEqual(first.ground,second.ground);
 assert.deepEqual(source.ground,originalGround);
 assert.deepEqual(source.heights,originalHeights);
 assert.strictEqual(first.heights,source.heights);
 assert.equal(first.dirtTreatment.plans.length,landmasses(source).length);
 for(const p of first.dirtTreatment.plans){
  assert.equal(p.dirtCells,Math.round(p.eligible/3));
  assert.ok(Math.abs(p.coverage-1/3)<1/Math.max(1,p.eligible));
 }
 for(let i=0;i<source.ground.length;i++){
  if(first.ground[i]!==source.ground[i])
   assert.equal(source.ground[i],ID.grass);
 }
});

test("targeted landmass overrides preserve the other landmass and authored ground",()=>{
 const source=sampleWorld(),regions=landmasses(source);
 const normal=createDirtWorld(source);
 const changed=createDirtWorld(source,{[regions[0].id]:{coverage:.6,seed:412,rampProbability:1,expansion:"expansive"}});
 const first=changed.dirtTreatment.plans[0],second=changed.dirtTreatment.plans[1];
 assert.equal(first.dirtCells,Math.round(first.eligible*.6));
 assert.equal(first.rule.expansion,"expansive");
 assert.ok(first.rampCandidates>0);
 assert.equal(second.dirtCells,normal.dirtTreatment.plans[1].dirtCells);
 for(const i of regions[1].cells)assert.equal(changed.ground[i],normal.ground[i]);
 for(const ramp of changed.dirtTreatment.rampCandidates){
  assert.equal(changed.ground[ramp.z*source.width+ramp.x],ID.dirt);
 }
});

test("imported or protected non-grass cells cannot be overwritten by dirt treatment",()=>{
 const source=sampleWorld(),region=landmasses(source)[0],index=region.cells.find(i=>source.ground[i]===ID.grass);
 source.ground[index]=ID.sand;
 const generated=createDirtWorld(source);
 assert.equal(generated.ground[index],ID.sand);
 assert.equal(generated.heights[index],source.heights[index]);
 assert.throws(()=>validateDirtRule({coverage:1.2}),/Invalid dirt/);
 assert.throws(()=>validateDirtRule({expansion:"planet"}),/Invalid dirt/);
 assert.throws(()=>validateDirtRule({extraFeature:true}),/Unknown dirt/);
 for(let i=0;i<30;i++)assert.ok(dirtShade(i,14)>=0&&dirtShade(i,14)<=3);
});
