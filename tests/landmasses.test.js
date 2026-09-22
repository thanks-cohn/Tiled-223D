import test from "node:test";
import assert from "node:assert/strict";
import {sampleWorld,ID} from "../src/world-data.js";
import {landmasses,nearestWrappedOffset} from "../src/landmasses.js";

test("500 by 500 demo has two uniquely rendered ground islands, not nine repeating copies",()=>{
 const world=sampleWorld(),regions=landmasses(world);
 assert.equal(regions.length,2);
 assert.ok(regions.every(region=>region.cells.length>1000));
 const allCells=regions.flatMap(region=>region.cells);
 assert.equal(new Set(allCells).size,allCells.length);
 assert.ok(allCells.every(i=>world.ground[i]!==ID.ocean));
 assert.ok(regions[0].centerX<regions[1].centerX);
});

test("nearest wrapped island offsets keep only one appearance per region",()=>{
 assert.equal(nearestWrappedOffset(140,145,500),0);
 assert.equal(nearestWrappedOffset(640,145,500),500);
 assert.equal(nearestWrappedOffset(-380,145,500),-500);
 assert.equal(nearestWrappedOffset(850,345,500),500);
 assert.throws(()=>nearestWrappedOffset(0,0,0),/Invalid wrapped/);
});

test("separate landmasses keep their individual positions instead of shifting an entire map",()=>{
 const regions=landmasses(sampleWorld());
 const shipX=495,worldSize=500;
 const positions=regions.map(region=>region.centerX+
  nearestWrappedOffset(shipX,region.centerX,worldSize));
 assert.equal(positions.length,2);
 assert.ok(positions.every(x=>Math.abs(x-shipX)<=worldSize/2));
 assert.notEqual(positions[0],positions[1]);
});
