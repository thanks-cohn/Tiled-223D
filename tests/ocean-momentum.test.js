import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {sampleWorld,ID} from "../src/world-data.js";
import {protectedRegions,travelRegion,EXPANSE} from "../src/travel-regions.js";
import {advanceMomentum,createFlybyTracker,resetFlybyTracker,updateFlybys,flybyImpulse} from "../src/flight-momentum.js";
import {terrainBlocksEntry,objectBlocksEntry} from "../src/flight-collision.js";
import {makeOceanSpeedCues} from "../src/ocean-speed-cues.js";
import {makeHorizonState} from "../src/horizon.js";

test("ocean requires about twice the V4 acceleration effort but does not strip speed",()=>{
 const w=sampleWorld(),regions=protectedRegions(w);
 const local=travelRegion(w,regions,145,235,35,false);
 const ocean=travelRegion(w,regions,240,270,35,false);
 assert.equal(local.factor,1);
 assert.ok(Math.abs(ocean.factor-.055)<1e-10);
 assert.ok(Math.abs(travelRegion(w,regions,240,270,35,true).factor-.11)<1e-10);
 const earned=180;
 const next=advanceMomentum(earned,1,.05,{accelerationFactor:ocean.factor,openness:1});
 assert.ok(next>earned,"Entering the ocean while accelerating must NEVER snap velocity down");
 const coast=advanceMomentum(earned,0,1,{accelerationFactor:ocean.factor,openness:1});
 assert.ok(coast>175,"One second of coasting should preserve nearly all earned momentum");
 const high=advanceMomentum(0,1,.05,{accelerationFactor:1,altitudeMultiplier:5});
 assert.ok(high>next-earned);
});

test("acceleration decreases with speed but holding throttle keeps gaining speed",()=>{
 const opts={accelerationFactor:1,boost:true};
 const atRest=advanceMomentum(0,1,.05,opts);
 const fast=advanceMomentum(250,1,.05,opts);
 assert.ok(atRest>0);
 assert.ok(fast>250);
 assert.ok(fast-250<atRest);
 const backwards=advanceMomentum(80,-1,.05,{});
 assert.ok(backwards<80);
 assert.equal(advanceMomentum(80,1,0,{}),80);
 assert.throws(()=>advanceMomentum(1,1,-1,{}),/Invalid/);
});

test("departing an island awards signed additive momentum, never once per frame",()=>{
 const w=sampleWorld(),regions=protectedRegions(w),near=regions[0];
 const tracker=createFlybyTracker();
 resetFlybyTracker(tracker,w,regions,near.x,near.z);
 const p=(distance,time,speed=55)=>updateFlybys(tracker,w,regions,
  near.x+distance,near.z,45,speed,time);
 assert.equal(p(0,1).reward,0);
 assert.equal(p(near.radius+28,2).reward,flybyImpulse(55));
 assert.equal(p(near.radius+40,3).reward,0);
 assert.equal(p(near.radius,4).reward,0);
 assert.equal(p(near.radius+29,5).reward,0,"Cooldown prevents boundary farming");
 assert.ok(p(near.radius,21).reward>0,"Returning after cooldown is rewarding");
});

test("forward and reverse cannot remain blocked by equality or existing collisions",()=>{
 const ocean={ground:ID.ocean,height:0},level={ground:ID.grass,height:32};
 assert.equal(terrainBlocksEntry(level,level,34),false);
 assert.equal(terrainBlocksEntry(level,level,33),false);
 assert.equal(terrainBlocksEntry(level,{ground:ID.grass,height:31},33),false);
 assert.equal(terrainBlocksEntry(level,{ground:ID.grass,height:40},33),true);
 assert.equal(terrainBlocksEntry(ocean,level,33),true);
 assert.equal(terrainBlocksEntry(level,ocean,33),false);
 const a={objectId:"island_A",partId:"grass"},b={objectId:"island_B",partId:"dirt"};
 assert.equal(objectBlocksEntry(a,a),false);
 assert.equal(objectBlocksEntry(a,null),false);
 assert.equal(objectBlocksEntry(a,b),true);
 assert.equal(objectBlocksEntry(null,a),true);
});

test("one high-contrast ocean-line buffer follows real movement at low and orbital heights",()=>{
 const world=sampleWorld(),scene=new THREE.Scene();
 const horizon=makeHorizonState();
 const cues=makeOceanSpeedCues(scene,horizon);
 const lines=scene.getObjectByName("world-anchored-high-contrast-ocean-speed-glints");
 assert.ok(lines);
 cues.update({x:240,y:35,z:270},world,0,0,1);
 assert.equal(lines.visible,false);
 cues.update({x:240,y:35,z:270},world,160,0,1);
 assert.equal(lines.visible,true);
 assert.ok(lines.material.opacity>.4&&lines.material.opacity<=.91);
 assert.equal(lines.geometry.getAttribute("position").count,72*6*2);
 cues.update({x:240,y:170,z:270},world,160,0,1,
  {x:240,z:270},{atmosphericAltitude:170,planetRadius:235});
 assert.equal(lines.visible,true);
 assert.deepEqual(cues.getBudget(),{crests:72,segments:432,drawCalls:1,
  textures:0,extraOceanMeshes:0});
 cues.dispose();
 assert.equal(scene.getObjectByName(
  "world-anchored-high-contrast-ocean-speed-glints"),undefined);
});
