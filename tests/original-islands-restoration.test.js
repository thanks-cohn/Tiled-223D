import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sampleWorld,ID} from "../src/world-data.js";
import {landmasses} from "../src/landmasses.js";
import {makeScaleWorld} from "../src/scale-world.js";

test("original authored islands remain the only canonical 500x500 landmasses",()=>{
 const source=sampleWorld(),islands=landmasses(source);
 assert.equal(islands.length,2);
 for(const region of islands){
  assert.ok(region.cells.length>0);
  for(const i of region.cells){
   assert.ok(source.ground[i]===ID.grass||source.ground[i]===ID.sand,
    "original islands must not be procedurally recolored as dirt");
  }
 }
 for(const size of ["current","bigger","massive"]){
  const scene=makeScaleWorld(source,size);
  for(const p of scene.nav.placements){
   const expected=source.ground[Math.floor(p.localZ)*source.width+Math.floor(p.localX)];
   assert.equal(scene.groundAt(p.x,p.z).ground,expected);
  }
 }
});

test("running app never applies the obsolete per-island dirt generator or shaded renderer",()=>{
 const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
 const terrain=readFileSync(new URL("../src/terrain.js",import.meta.url),"utf8");
 assert.doesNotMatch(main,/createDirtWorld\s*\(/);
 assert.doesNotMatch(main,/refreshDirtTreatment\s*\(/);
 assert.doesNotMatch(terrain,/dirtShade\s*\(/);
 assert.match(main,/sourceWorld=sampleWorld\(\)/);
 assert.match(main,/Original islands are protected/);
});
