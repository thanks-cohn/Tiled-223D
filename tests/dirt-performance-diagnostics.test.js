import test from "node:test";
import assert from "node:assert/strict";
import {createDirtPerformanceDiagnostics} from "../src/dirt/performance-diagnostics.js";

test("bounded observed dirt profiler captures frame gaps, mesh cost and source-neutral snapshots",()=>{
 const perf=createDirtPerformanceDiagnostics();
 perf.start();
 perf.frameBegin(1000);perf.sceneBegin();perf.meshBuild({level:"near",ms:83.125,samples:9409,vertices:9409,triangles:18000,coordinate:{x:4,z:8}});
 perf.frameEnd();
 perf.frameBegin(1168);perf.sceneBegin();perf.frameEnd();
 const snap=perf.stop();
 assert.equal(snap.schemaVersion,"dirt-performance-v1");
 assert.equal(snap.kind,"observed-browser-runtime");
 assert.equal(snap.frames,2);
 assert.equal(snap.frameGapsOver100Ms,1);
 assert.equal(snap.terrain.meshBuilds,1);
 assert.equal(snap.terrain.terrainSamples,9409);
 assert.equal(snap.terrain.meshTriangles,18000);
 assert.ok(snap.events.some(e=>e.type==="frame-gap"&&e.gapMs===168));
 assert.ok(snap.events.some(e=>e.type==="terrain-mesh-build"&&e.level==="near"&&e.ms===83.13));
 assert.ok(snap.caveats.some(s=>s.includes("not GPU completion")));
 const count=snap.events.length;perf.meshBuild({level:"near",ms:1,samples:1,vertices:1,triangles:1,coordinate:{x:0,z:0}});
 assert.equal(perf.snapshot().events.length,count);
 perf.start();assert.equal(perf.snapshot().terrain.meshBuilds,0);
});

test("dirt profiler events and history have bounded memory",()=>{
 const perf=createDirtPerformanceDiagnostics();
 for(let i=0;i<350;i++)perf.event("mark",{value:i});
 const snapshot=perf.snapshot();
 assert.equal(snapshot.events.length,96);
 assert.equal(snapshot.events[0].value,254);
 assert.equal(snapshot.events[95].value,349);
});
