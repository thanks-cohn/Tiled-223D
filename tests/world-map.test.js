import test from "node:test";
import assert from "node:assert/strict";
import {ID} from "../src/world-data.js";
import {mapColor,mapCoordinates} from "../src/world-map.js";

test("map paints semantic terrain with distinct water types",()=>{
 const ocean=mapColor(ID.ocean,0),river=mapColor(ID.river,0),lake=mapColor(ID.lake,0);
 assert.notDeepEqual(ocean,river);
 assert.notDeepEqual(ocean,lake);
 assert.notDeepEqual(river,lake);
 assert.ok(ocean[2]>ocean[0]);
 assert.ok(mapColor(ID.grass,100)[1]>mapColor(ID.grass,0)[1]);
});
test("ship marker uses the same wrapping as the world",()=>{
 const world={width:500,height:500};
 assert.deepEqual(mapCoordinates(world,-1,501),{x:499,z:1});
 assert.deepEqual(mapCoordinates(world,1000,0),{x:0,z:0});
});
