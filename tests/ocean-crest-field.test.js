import test from "node:test";
import assert from "node:assert/strict";
import {sampleCrest,crestIdentity,oceanAltitudeProfile,CREST_SEGMENTS} from "../src/ocean-crest-field.js";

test("crests are deterministic curves anchored to world geography, not heading",()=>{
 const a=sampleCrest(3,7),b=sampleCrest(3,7);assert.deepEqual(a,b);assert.equal(a.points.length,CREST_SEGMENTS+1);
 const chord={x:(a.points[0].x+a.points.at(-1).x)/2,z:(a.points[0].z+a.points.at(-1).z)/2};
 assert.ok(Math.hypot(a.points[3].x-chord.x,a.points[3].z-chord.z)>.01);
});
test("wrapped seams retain stable identity and LODs share the source crest",()=>{
 assert.equal(crestIdentity(-1,2,500,500),crestIdentity(499,2,500,500));
 assert.equal(sampleCrest(4,5,{lod:0}).id,sampleCrest(4,5,{lod:2}).id);
});
test("four altitude moods blend continuously and hovering produces no fake flow",()=>{
 assert.equal(oceanAltitudeProfile(0,0).visible,false);
 const moods=[20,130,300,445].map(x=>oceanAltitudeProfile(x,100).mood);assert.deepEqual(moods,["low","middle","high","top"]);
 for(let y=1;y<445;y++)assert.ok(oceanAltitudeProfile(y+1,100).grid>=oceanAltitudeProfile(y,100).grid);
});
