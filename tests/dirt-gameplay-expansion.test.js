import test from "node:test";
import assert from "node:assert/strict";
import {sampleWorld,ID} from "../src/world-data.js";
import {makeScaleWorld,transferScalePosition} from "../src/scale-world.js";
import {mapRouteDistance} from "../src/dirt/expansion.js";

test("gameplay sampler uses the canonical expansion plan and keeps saved ramp dimensions physical",()=>{
  const source=sampleWorld(),scenes=["current","bigger","massive"].map(id=>makeScaleWorld(source,id));
  const feature=scenes[0].expansiveDirt.production.features.find(f=>f.orientation==="x");
  assert.ok(feature,"fixture needs an X-oriented ramp");
  const measured=[];
  for(const scene of scenes){
    assert.equal(scene.dirtExpansion.experienceLength,scene.preset.width);
    const centerX=mapRouteDistance(scene.dirtExpansion,feature.canonical.x,"canonical").value;
    const centerZ=feature.canonical.z/500*scene.preset.height;
    assert.equal(scene.sampleExpansiveDirt(centerX,centerZ).ramp,feature.id);
    // The same saved ramp ends at the same physical half-length in gameplay.
    assert.equal(scene.sampleExpansiveDirt(centerX+feature.geometry.length/2+.01,centerZ).ramp,null);
    assert.equal(scene.sampleExpansiveDirt(centerX-feature.geometry.length/2-.01,centerZ).ramp,null);
    measured.push({centerX,width:feature.geometry.length,height:feature.geometry.height});
  }
  assert.deepEqual(measured.map(x=>[x.width,x.height]),Array(3).fill([feature.geometry.length,feature.geometry.height]));
  assert.ok(measured[2].centerX-measured[1].centerX>measured[1].centerX-measured[0].centerX);
});

test("expanded dirt collision height and terrain sample are identical at a saved ramp",()=>{
  const scene=makeScaleWorld(sampleWorld(),"massive"),feature=scene.expansiveDirt.production.features[0];
  const x=mapRouteDistance(scene.dirtExpansion,feature.canonical.x,"canonical").value,z=feature.canonical.z/500*scene.preset.height;
  const physical=scene.sampleExpansiveDirt(x,z),navigation=scene.groundAt(x,z);
  assert.equal(physical.ground,ID.dirt);assert.equal(physical.ramp,feature.id);assert.equal(navigation.height,physical.height);
});

test("world-scale transition keeps the same saved ramp and canonical route position",()=>{
  const source=sampleWorld(),current=makeScaleWorld(source,"current"),massive=makeScaleWorld(source,"massive"),feature=current.expansiveDirt.production.features.find(f=>current.nav.placements.every(p=>Math.hypot(f.canonical.x-p.x,f.canonical.z-p.z)>p.radius+90));
  assert.ok(feature,"fixture needs a ramp outside island transition neighborhoods");
  const x=mapRouteDistance(current.dirtExpansion,feature.canonical.x,"canonical").value,z=feature.canonical.z;
  const moved=transferScalePosition({x,y:current.groundAt(x,z).height+4,z},current,massive);
  assert.equal(massive.sampleExpansiveDirt(moved.x,moved.z).ramp,feature.id);
  const canonical=mapRouteDistance(massive.dirtExpansion,moved.x,"experience").value;
  assert.ok(Math.abs(canonical-feature.canonical.x)<1e-9);
});
