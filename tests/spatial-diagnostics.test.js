import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {projectPoint,projectBounds,rayFromViewport,curveSurfacePoint} from "../src/spatial-math.js";
import {createSpatialDiagnostics} from "../src/spatial-diagnostics.js";
import {createCompositionTransition} from "../src/camera-transition.js";

test("projection reports clip W, top-left viewport, DPR and behind/frustum separately",()=>{
 const camera=new THREE.PerspectiveCamera(60,2,.1,100);camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
 const center=projectPoint({x:0,y:0,z:0},vp,{left:10,top:20,width:800,height:400,dpr:2});
 assert.deepEqual(center.viewport,{u:.5,v:.5});assert.deepEqual(center.cssPixels,{x:410,y:220});
 assert.deepEqual(center.drawingBufferPixels,{x:800,y:400});assert.equal(center.status,"in-frustum");assert.equal(center.occlusion,"unknown");
 assert.equal(projectPoint({x:0,y:0,z:10},vp,{width:800,height:400}).status,"behind-camera");
 const bounds=projectBounds([{x:-1,y:-1,z:0},{x:1,y:1,z:0}],vp,{width:800,height:400});assert.equal(bounds.approximate,true);
});
test("inverse viewport ray round-trips center and CPU curvature matches globe limits",()=>{
 const camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),inverse=vp.clone().invert();
 const ray=rayFromViewport(.5,.5,inverse.elements);assert.ok(Math.abs(ray.direction.x)<1e-12);assert.ok(ray.direction.z<-.999);
 const flat=curveSurfacePoint({x:10,y:0,z:0},{globe:0}),globe=curveSurfacePoint({x:10,y:0,z:0},{globe:1,globeRadius:235});
 assert.equal(flat.x,10);assert.ok(globe.x<10);assert.equal(globe.injective,true);
});
test("composition retargets from current interpolation without a discontinuity",()=>{
 const transition=createCompositionTransition({u:.2,v:.3,heightFraction:.1});transition.retarget({u:.5,v:.73,heightFraction:.15},1);
 const middle=transition.update(.4);transition.retarget({u:.4,v:.6,heightFraction:.12},1);const first=transition.update(0);
 assert.equal(first.u,middle.u);assert.equal(first.v,middle.v);
 let previous=first;for(let i=0;i<20;i++){const next=transition.update(.05);assert.ok(Math.hypot(next.u-previous.u,next.v-previous.v)<.04);previous=next;}
 assert.equal(previous.active,false);
});
test("diagnostic modes are bounded, schema-valid and performance has no history",()=>{
 let now=0;const d=createSpatialDiagnostics({mode:"performance",maxRecords:3,maxBytes:4096,now:()=>++now});
 d.register("pilot",()=>({authoritative:{space:"world",position:{x:1,y:2,z:3}}}));d.record("spawn",{objectId:"pilot"});assert.equal(d.stats().records,0);
 assert.equal(d.getSpatialSnapshot().error.code,"DIAGNOSTICS_DISABLED");d.setMode("deep");
 for(let i=0;i<6;i++){d.nextFrame();d.record("projection-change",{objectId:"pilot",coordinateSpace:"viewport",causeId:`test:${i}`});}
 assert.equal(d.stats().records,3);const lines=d.exportJSONL().split("\n");assert.equal(lines.length,3);
 for(const line of lines){const event=JSON.parse(line);assert.equal(event.schemaVersion,"1.0.0");assert.ok(event.runId);assert.ok(Number.isFinite(event.timestampMs));}
 assert.equal(d.getSpatialRelationship("pilot","pilot").distance,0);assert.match(d.incidentReport("pilot"),/Occlusion is unknown/);
});
