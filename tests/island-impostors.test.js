import test from "node:test";
import assert from "node:assert/strict";
import {islandDistanceBands} from "../src/island-impostors.js";

test("islands have a visible representation at every distance band",()=>{
 for(const d of [0,40,98,105,115,136,138,185,222,250,279,350,900,2500]){
  const v=islandDistanceBands(d);
  assert.ok(v.mesh+v.mid+v.far>.7,`No island representation at distance ${d}`);
  assert.ok(Object.values(v).every(x=>x>=0&&x<=1),`Invalid opacity at ${d}`);
 }
});
test("close is 3D, middle is a painted card, distant is a dark silhouette",()=>{
 const near=islandDistanceBands(20),mid=islandDistanceBands(180),far=islandDistanceBands(400);
 assert.equal(near.mesh,1);assert.equal(near.mid,0);assert.equal(near.far,0);
 assert.equal(mid.mesh,0);assert.ok(mid.mid>.9);assert.equal(mid.far,0);
 assert.equal(far.mesh,0);assert.equal(far.mid,0);assert.ok(far.far>.8);
});
test("transitions are smooth rather than popping between fixed distances",()=>{
 for(let d=90;d<=290;d+=.5){
  const a=islandDistanceBands(d),b=islandDistanceBands(d+.5);
  for(const key of ["mesh","mid","far"])
   assert.ok(Math.abs(a[key]-b[key])<.05,`Pop in ${key} at ${d}`);
 }
});
