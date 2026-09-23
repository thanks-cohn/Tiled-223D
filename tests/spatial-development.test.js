import test from "node:test";
import assert from "node:assert/strict";
import {createSpatialDevelopmentController,DEVELOPMENT_SCHEMA_VERSION} from "../src/spatial-development.js";

function fixture(options={}){
 let time=100,physical={worldScale:"massive",position:{x:10,y:170,z:20},yaw:0,forwardVelocity:0,verticalVelocity:0,cameraChoice:"auto"};
 let presentation={anchorU:.5,anchorV:.73,heightFraction:.15,transitionSeconds:.6,fovBiasDegrees:0};
 const events=[],images=[];
 const diagnostics={record:(type,data)=>events.push({type,...data}),getObjectSpatialState:id=>({id}),exportJSONL:()=>events.map(JSON.stringify).join("\n")};
 const adapter={readPhysicalState:()=>structuredClone(physical),restorePhysicalState:value=>{physical=structuredClone(value);},
  readPresentation:()=>structuredClone(presentation),applyPresentation:patch=>Object.assign(presentation,patch),restorePresentation:value=>{presentation=structuredClone(value);},
  restoreDefaultPresentation:()=>{presentation={anchorU:.5,anchorV:.73,heightFraction:.15,transitionSeconds:.6,fovBiasDegrees:0};},
  captureImage:()=>{images.push(1);return "data:image/webp;base64,AA==";}};
 const controller=createSpatialDevelopmentController({diagnostics,adapter,now:()=>time,...options});
 return {controller,facade:controller.facade,events,images,get physical(){return physical;},get presentation(){return presentation;},advance:ms=>time+=ms};
}
const authorize=f=>f.controller.grantAuthorization({trustedUserGesture:true});
const frame=(id,overrides={})=>({dt:1/60,controls:{turn:0,forward:0,climb:1,boost:false,camera:"auto",scale:"massive"},frameId:id,timestampMs:id*16.67,
 physical:{position:{x:10,y:170+id,z:20}},camera:{fov:60,viewMode:"auto"},visual:{parentId:"scene"},
 projection:{visible:{viewport:{u:.5,v:.3+id/100}}},presentation:{heightFraction:.15},...overrides});

test("public development API requires trusted, scoped, expiring authorization",()=>{
 const f=fixture();assert.equal(f.facade.inspect("pilot").error.code,"UNAUTHORIZED");
 assert.equal(f.controller.grantAuthorization({trustedUserGesture:false}).error.code,"TRUSTED_GESTURE_REQUIRED");
 f.controller.grantAuthorization({trustedUserGesture:true,scopes:["inspect"],ttlMs:1000});
 assert.deepEqual(f.facade.inspect("pilot"),{id:"pilot"});assert.equal(f.facade.startRecording().error.code,"SCOPE_DENIED");
 f.advance(1001);assert.equal(f.facade.inspect("pilot").error.code,"SCOPE_DENIED");
});

test("recording and replay use bounded ordered frames and restore an authoritative checkpoint",()=>{
 const f=fixture({maxReplayFrames:3,maxReplayBytes:4096});authorize(f);f.facade.startRecording({case:"massive"});
 for(let i=0;i<5;i++)f.controller.onFrame(frame(i));
 const bundle=f.facade.stopRecording();assert.equal(bundle.schemaVersion,DEVELOPMENT_SCHEMA_VERSION);assert.equal(bundle.frames.length,3);
 assert.deepEqual(bundle.frames.map(x=>x.index),[0,1,2]);
 f.physical.position.x=999;assert.deepEqual(f.facade.loadReplay(bundle),{ok:true,frames:3});assert.equal(f.physical.position.x,10);
 for(const expected of bundle.frames){assert.equal(f.controller.timestep(.01),expected.dt);assert.deepEqual(f.controller.controlsForFrame({}),expected.controls);}
 assert.deepEqual(f.controller.controlsForFrame({live:true}),{live:true});
 assert.ok(f.events.some(event=>event.type==="replay-budget-reached"));
});

test("the built-in Massive issue replay crosses ascent, modes, threshold and descent deterministically",()=>{
 const f=fixture();authorize(f);const replay=f.facade.createMassiveOverviewReproduction();
 assert.equal(replay.fixedStepSeconds,1/60);assert.equal(replay.frames.length,888);
 assert.equal(replay.verificationMatrix.length,12);
 assert.deepEqual(new Set(replay.verificationMatrix.map(x=>x.band)),new Set(["low","middle","high","top"]));
 assert.deepEqual(new Set(replay.verificationMatrix.map(x=>x.camera)),new Set(["forward","overview","auto"]));
 assert.ok(replay.frames.some(x=>x.controls.camera==="forward"));assert.ok(replay.frames.some(x=>x.controls.camera==="overview"));
 assert.ok(replay.frames.some(x=>x.controls.camera==="auto"&&x.controls.climb<0));
 assert.ok(replay.frames.every((item,index)=>item.index===index&&item.controls.scale==="massive"));
});

test("captures occur on frame boundaries, remain bounded, and image capture is explicit",()=>{
 const f=fixture({maxCaptures:2,maxCaptureBytes:10000});authorize(f);
 const first=f.facade.requestFrameCapture({reason:"before"});assert.equal(f.facade.listCaptures().length,0);
 f.controller.onFrame(frame(10));assert.equal(f.facade.listCaptures()[0].captureId,first.id);assert.equal(f.images.length,0);
 f.facade.requestFrameCapture({reason:"with image",includeImage:true});f.controller.onFrame(frame(11));assert.equal(f.images.length,1);
 f.facade.requestFrameCapture({reason:"evicts oldest"});f.controller.onFrame(frame(12));
 const captures=f.facade.listCaptures();assert.equal(captures.length,2);assert.ok(!captures.some(x=>x.captureId===first.id));
});

test("visual preview cannot mutate physical truth and rollback restores presentation",()=>{
 const f=fixture();authorize(f);const before=structuredClone(f.physical);
 assert.equal(f.facade.applyPreview({anchorU:2}).error.code,"INVALID_PRESENTATION_PATCH");
 assert.equal(f.facade.applyPreview({positionX:999}).error.code,"INVALID_PRESENTATION_PATCH");
 const change=f.facade.applyPreview({anchorV:.66,fovBiasDegrees:-3},"candidate A");
 assert.deepEqual(f.physical,before);assert.equal(f.presentation.anchorV,.66);assert.equal(f.presentation.fovBiasDegrees,-3);
 assert.equal(f.facade.rollback(change.id).ok,true);assert.equal(f.presentation.anchorV,.73);assert.deepEqual(f.physical,before);
});

test("experiments compare synchronized arms and classify a parent/projection jump without teleport",()=>{
 const f=fixture();authorize(f);const experiment=f.facade.beginExperiment("Massive handoff");
 const a=f.facade.requestFrameCapture({reason:"baseline"});f.controller.onFrame(frame(20));
 const b=f.facade.requestFrameCapture({reason:"candidate"});f.controller.onFrame(frame(21,{physical:{position:{x:10,y:190,z:20}},visual:{parentId:"camera"},projection:{visible:{viewport:{u:.5,v:.73}}}}));
 assert.equal(f.facade.addExperimentCapture(experiment.id,"baseline",a.id).ok,true);assert.equal(f.facade.addExperimentCapture(experiment.id,"candidate",b.id).ok,true);
 const comparison=f.facade.compareExperiment(experiment.id);assert.equal(comparison.baselineMetrics.length,1);assert.equal(comparison.candidateMetrics[0].parentId,"camera");
 assert.equal(comparison.comparison.pairedFrames,1);assert.equal(comparison.comparison.maxPhysicalDelta,0);assert.equal(comparison.comparison.parentChanges,1);
 const explanation=f.facade.explainDiscontinuity(a.id,b.id);assert.equal(explanation.physicalDelta,0);assert.ok(explanation.viewportDelta>.02);
 assert.equal(explanation.classification,"visual-discontinuity-without-physical-teleport");assert.ok(explanation.causes.includes("render-parent-change"));
});

test("revocation stops active work, clears authorization, and restores defaults",()=>{
 const f=fixture();authorize(f);f.facade.startRecording();f.facade.applyPreview({anchorU:.4});
 const status=f.controller.revoke();assert.equal(status.authorized,false);assert.equal(status.recording,false);assert.equal(f.presentation.anchorU,.5);
 assert.equal(f.facade.exportReproBundle().error.code,"UNAUTHORIZED");
});
