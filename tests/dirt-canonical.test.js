import test from "node:test";
import assert from "node:assert/strict";
import {sampleWorld,ID} from "../src/world-data.js";
import {createCanonicalDirtProduction,sampleCanonicalDirt} from "../src/dirt/canonical.js";
import {buildExpansionPlan,mapRouteDistance} from "../src/dirt/expansion.js";

test("one saved canonical dirt mask is exactly one third while authored islands remain untouched",()=>{
  const world=sampleWorld(),beforeGround=world.ground.slice(),beforeHeights=world.heights.slice(),production=createCanonicalDirtProduction(world);
  assert.equal(production.coverage.cells,Math.round(500*500/3));
  assert.ok(Math.abs(production.coverage.wholeWorldFraction-1/3)<1/250000);
  assert.deepEqual(world.ground,beforeGround);assert.deepEqual(world.heights,beforeHeights);
  for(let i=0;i<world.ground.length;i++)if(world.ground[i]!==ID.ocean)assert.equal(production.mask[i],0);
  assert.ok(production.features.length>=3);assert.deepEqual(createCanonicalDirtProduction(world).features,production.features);
});

test("saved ramp geometry is scale invariant and only gaps expand",()=>{
  const production=createCanonicalDirtProduction(sampleWorld()),current=buildExpansionPlan(production,"current"),massive=buildExpansionPlan(production,"massive");
  assert.deepEqual(production.features.map(f=>f.geometry),production.features.map(f=>f.geometry));
  const currentFeatures=current.intervals.filter(i=>i.kind==="feature"),massiveFeatures=massive.intervals.filter(i=>i.kind==="feature");
  currentFeatures.forEach((interval,index)=>assert.ok(Math.abs((interval.experienceEnd-interval.experienceStart)-(massiveFeatures[index].experienceEnd-massiveFeatures[index].experienceStart))<1e-9));
  assert.ok(massive.experienceLength>current.experienceLength);
  for(const value of [0,125,250,499.9])assert.ok(Math.abs(mapRouteDistance(massive,mapRouteDistance(massive,value).value,"experience").value-value)<1e-8);
});

test("replacement expansion never stacks with selected world profile",()=>{
  const p=createCanonicalDirtProduction(sampleWorld()),inherited=buildExpansionPlan(p,"massive"),replacement=buildExpansionPlan(p,"massive",{mode:"replace",profileId:"expansive-ocean"});
  assert.equal(inherited.profile.requestedGapFactor,32);assert.equal(inherited.experienceLength,16000);
  assert.equal(replacement.profile.gapFactor,12);assert.equal(replacement.profile.mode,"replace");
});

test("visual shade is independent from physical elevation and ramps replay",()=>{
  const p=createCanonicalDirtProduction(sampleWorld()),feature=p.features[0],a=sampleCanonicalDirt(p,feature.canonical.x,feature.canonical.z),b=sampleCanonicalDirt(p,feature.canonical.x,feature.canonical.z);
  assert.deepEqual(a,b);assert.equal(a.ramp,feature.id);assert.equal(a.source,"saved-ramp");
});
