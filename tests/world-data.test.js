import test from "node:test";
import assert from "node:assert/strict";
import { SIZE, ID, wrap, sampleWorld, cell, fromTiled } from "../src/world-data.js";

test("wrap handles positive, negative and boundary positions", () => {
  assert.equal(wrap(0, 500), 0);
  assert.equal(wrap(500, 500), 0);
  assert.equal(wrap(-1, 500), 499);
  assert.equal(wrap(1001, 500), 1);
});

test("the 500 by 500 prototype contains two islands with sand at ocean-facing edges", () => {
  const world = sampleWorld();
  assert.equal(world.width, SIZE);
  assert.equal(world.height, SIZE);
  assert.equal(world.ground.length, 250000);
  assert.equal(cell(world, 245, 250).ground, ID.ocean); // sea between the islands
  assert.equal(cell(world, 0, 0).ground, ID.ocean);
  assert.equal(world.spawns.length, 2);
  let land = 0, maxHeight = 0;
  for (let z=0; z<world.height; z++) for (let x=0; x<world.width; x++) {
    const c = cell(world, x, z);
    if (c.ground===ID.ocean) continue;
    land++;
    maxHeight=Math.max(maxHeight,c.height);
    const touchesOcean=[[1,0],[-1,0],[0,1],[0,-1]]
      .some(([dx,dz]) => cell(world,x+dx,z+dz).ground === ID.ocean);
    if (touchesOcean) assert.equal(c.ground, ID.sand, `Coast at ${x},${z} must be sand`);
  }
  assert.ok(land>2000 && land<5500);
  assert.ok(maxHeight>80, "The demo needs high ridges for a descent");
  for (const spawn of world.spawns) assert.notEqual(cell(world,spawn.x,spawn.z).ground,ID.ocean);
});

test("Tiled import retains numeric elevations beyond small presets", () => {
  const map = {orientation:"orthogonal",width:2,height:2,tilewidth:32,tileheight:32,
    layers:[{name:"Ground",type:"tilelayer",data:[3,1,4,1]},
      {name:"Structures",type:"tilelayer",data:[0,7,0,0]},
      {name:"Spawns",type:"objectgroup",objects:[{id:1,name:"LandingPoint",type:"landing",x:16,y:16}]}]};
  const world = fromTiled(map,{width:2,height:2,values:[[2,700000],[0,3]]});
  assert.equal(cell(world,1,0).height,700000);
  assert.equal(world.trees.length,1);
  assert.equal(world.spawns[0].x,.5);
  assert.throws(() => fromTiled(map,{width:2,height:2,values:[1]}),/Elevation grid/);
});
