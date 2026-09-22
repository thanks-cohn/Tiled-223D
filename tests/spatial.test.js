import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateIslands,spatialHit} from "../src/spatial.js";

const data=JSON.parse(readFileSync(new URL("../src/worlds/floating-islands.json",import.meta.url),"utf8"));
const objects=data.objects;

test("three islands are one semantic cluster with uniquely owned material parts",()=>{
 assert.equal(objects.length,3);
 assert.equal(validateIslands(objects,data.cluster.id),true);
 assert.deepEqual(objects.map(o=>o.id),["island_A","island_B","island_C"]);
 assert.ok(objects.every(o=>o.parent===data.cluster.id&&o.parts.every(p=>p.parent===o.id)));
});
test("under and above are empty; material is solid beside the through-hole",()=>{
 assert.equal(spatialHit(objects,145,30,279),null);
 assert.equal(spatialHit(objects,145,80,279),null);
 assert.equal(spatialHit(objects,147,58,278,.2),null);
 const hit=spatialHit(objects,145,58,279,.2);
 assert.equal(hit?.objectId,"island_A");
 assert.ok(["stone","clay","dirt","grass"].includes(hit.material));
});
test("moving the parent moves its collision without rewriting child positions",()=>{
 const moved=structuredClone(objects);
 moved[0].at[1]+=50;
 assert.equal(spatialHit(moved,145,58,279,.2),null);
 assert.equal(spatialHit(moved,145,108,279,.2)?.objectId,"island_A");
});
test("periodic map collision samples the nearest copy of a named island",()=>{
 assert.equal(spatialHit(objects,645,58,279,.2,500,500)?.objectId,"island_A");
 assert.equal(spatialHit(objects,-355,58,279,.2,500,500)?.objectId,"island_A");
});
