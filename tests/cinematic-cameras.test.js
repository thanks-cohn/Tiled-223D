import test from "node:test";
import assert from "node:assert/strict";
import {SHIP_CAMERA_PRESETS,FEET_TO_WORLD_UNITS,createShipCameraLibrary,cameraDisplayName,isCameraModified,setCameraOffset,moveCamera,restoreCamera,setShipFacing,createLegacyShipFacing,LEGACY_SHIP_FACING_IDS,shipLocalOffset,evaluateCameraPose,fitShipCamera,createCameraController,shouldHandleCameraKey,previewViewport} from "../src/cinematic-cameras.js";

test("six exact ship presets use ship targets and requested mirrored offsets",()=>{
 assert.equal(SHIP_CAMERA_PRESETS.length,6);
 assert.deepEqual(SHIP_CAMERA_PRESETS.map(p=>p.semanticName),["Rear Chase","Front Portrait","Low Front Fisheye","High Front Left","High Front Right","Overhead"]);
 assert.ok(SHIP_CAMERA_PRESETS.every(p=>p.lookAt.enabled&&p.lookAt.target.kind==="controlled-ship"));
 const low=SHIP_CAMERA_PRESETS[2],left=SHIP_CAMERA_PRESETS[3],right=SHIP_CAMERA_PRESETS[4],overhead=SHIP_CAMERA_PRESETS[5];
 assert.deepEqual([low.offset.forward,low.offset.up],[10,-2]);
 assert.deepEqual([left.offset.forward,left.offset.right,left.offset.up],[15,-10,14]);
 assert.deepEqual([right.offset.forward,right.offset.right,right.offset.up],[15,10,14]);
 assert.deepEqual([overhead.offset.forward,overhead.offset.right,overhead.offset.up],[0,0,20]);
});

test("semantic status derives from normalized values and reset, never stacks suffixes",()=>{
 const camera=createShipCameraLibrary()[5];
 assert.equal(cameraDisplayName(camera),"Overhead (Customizable)");
 moveCamera(camera,{up:5});
 assert.equal(cameraDisplayName(camera),"Overhead (Modified)");
 assert.equal(isCameraModified(camera),true);
 setCameraOffset(camera,{up:20+1e-10});
 assert.equal(cameraDisplayName(camera),"Overhead (Customizable)");
 camera.mode="liquid";
 assert.equal(cameraDisplayName(camera),"Overhead (Modified)");
 restoreCamera(camera);
 assert.equal(cameraDisplayName(camera),"Overhead (Customizable)");
});

test("ship-local offsets rotate through yaw, pitch and roll with explicit feet conversion",()=>{
 assert.deepEqual(shipLocalOffset({forward:10,right:0,up:0},0),{x:0,y:0,z:-10*FEET_TO_WORLD_UNITS});
 const yaw=shipLocalOffset({forward:10,right:0,up:0},Math.PI/2);
 assert.ok(Math.abs(yaw.x+10*FEET_TO_WORLD_UNITS)<1e-10);
 const pitch=shipLocalOffset({forward:10,right:0,up:0},0,Math.PI/2);
 assert.ok(Math.abs(pitch.y-10*FEET_TO_WORLD_UNITS)<1e-10);
 const roll=shipLocalOffset({forward:0,right:10,up:0},0,0,Math.PI/2);
 assert.ok(Math.abs(roll.y-10*FEET_TO_WORLD_UNITS)<1e-10);
});

test("pose follows one entity and independently aims at its stable aim point",()=>{
 const camera=createShipCameraLibrary()[0];
 const pose=evaluateCameraPose(camera,{follow:{x:4,y:5,z:6},aimPoint:{x:4,y:6,z:6}});
 assert.deepEqual(pose.target,{x:4,y:6,z:6});
 assert.notDeepEqual(pose.position,pose.target);
 camera.lookAt.enabled=false;
 assert.equal(evaluateCameraPose(camera,{follow:{x:4,y:5,z:6}}).target,null);
});

test("preview selection is independent and C-style swap is exactly reversible",()=>{
 const controller=createCameraController();
 const before=controller.selections();
 const after=controller.swap();
 assert.deepEqual(after,{mainId:before.previewId,previewId:before.mainId});
 assert.deepEqual(controller.swap(),before);
 controller.selectPreview("ship.camera.overhead");
 assert.equal(controller.selections().mainId,before.mainId);
 controller.selectMain("ship.camera.overhead");
 assert.deepEqual(controller.selections(),{mainId:"ship.camera.overhead",previewId:before.mainId});
});

test("all cinematic positions remain outside the fallback ship and mirror through motion",()=>{
 const definitions=createShipCameraLibrary();
 for(const camera of definitions){
  const pose=evaluateCameraPose(camera,{follow:{x:0,y:10,z:0},yaw:.7,pitch:-.11,roll:.2});
  assert.ok(Math.hypot(pose.position.x,pose.position.y-10,pose.position.z)>2.4,camera.semanticName);
 }
 const left=evaluateCameraPose(definitions[3],{follow:{x:0,y:0,z:0}}).position;
 const right=evaluateCameraPose(definitions[4],{follow:{x:0,y:0,z:0}}).position;
 assert.equal(left.x,-right.x);assert.equal(left.y,right.y);assert.equal(left.z,right.z);
});

test("preview viewport stays bottom-right, 16:9, and bounded after resize",()=>{
 assert.deepEqual(previewViewport(1280,800),{x:906,y:14,width:360,height:202.5});
 const small=previewViewport(320,180);
 assert.ok(small.x>=0&&small.y>=0&&small.width<=292&&small.height<=152);
 assert.equal(small.width/small.height,16/9);
});

test("camera keyboard shortcuts ignore typing and modified/repeated keys",()=>{
 assert.equal(shouldHandleCameraKey({target:{tagName:"CANVAS"}}),true);
 assert.equal(shouldHandleCameraKey({target:{tagName:"INPUT"}}),false);
 assert.equal(shouldHandleCameraKey({target:{isContentEditable:true}}),false);
 assert.equal(shouldHandleCameraKey({target:{tagName:"CANVAS"},repeat:true}),false);
});

test("runtime ship fitting preserves exact authored offsets and never clips the scaled hull",()=>{
 const definition=createShipCameraLibrary()[2];
 const before=JSON.stringify(definition);
 for(const radius of [1.85,8.65,650]){
  for(const sceneNear of [.5,2.1,40.5]){
   const fitted=fitShipCamera({
    position:{x:0,y:-.6096,z:-3.048},
    shipCenter:{x:0,y:0,z:0},shipRadius:radius,
    fov:92,aspect:16/9,sceneNear,orbitalBlend:radius>100?1:0
   });
   const range=Math.hypot(fitted.position.x,fitted.position.y,fitted.position.z);
   assert.ok(range>=fitted.minimumDistance-1e-8,"ship must fit within FOV");
   assert.ok(fitted.near>0&&fitted.near<range-radius,"near must not clip ship");
   if(radius>100)assert.ok(fitted.position.y>0,"orbital context lifts front camera toward planet-facing composition");
  }
 }
 assert.equal(JSON.stringify(definition),before,"automatic safety must never mark preset modified");
 assert.equal(cameraDisplayName(definition),"Low Front Fisheye (Customizable)");
});

test("effective near distance is independent for main and preview, including portrait aspect",()=>{
 const input={position:{x:0,y:0,z:5},shipCenter:{x:0,y:0,z:0},
  shipRadius:3,fov:70,sceneNear:40};
 const main=fitShipCamera({...input,aspect:16/9});
 const narrow=fitShipCamera({...input,aspect:.5});
 assert.ok(narrow.minimumDistance>main.minimumDistance);
 for(const result of [main,narrow]){
  assert.ok(result.near<=40);
  assert.ok(result.near<Math.hypot(result.position.x,result.position.y,result.position.z)-3);
 }
 assert.throws(()=>fitShipCamera({...input,aspect:0}),/Invalid cinematic camera fitting/);
});

test("per-camera facing is cosmetic, independent, validated and resettable",()=>{
 const cameras=createShipCameraLibrary();
 const original=JSON.stringify(cameras[1]);
 setShipFacing(cameras[0],{yaw:90,pitch:12,roll:-4});
 assert.deepEqual([cameras[0].shipFacing.yaw,cameras[0].shipFacing.pitch,cameras[0].shipFacing.roll],[90,12,-4]);
 assert.deepEqual(cameras[1].shipFacing,{yaw:0,pitch:0,roll:0,unit:"deg"});
 assert.equal(JSON.stringify(cameras[1]),original);
 assert.equal(cameraDisplayName(cameras[0]),"Rear Chase (Modified)");
 assert.throws(()=>setShipFacing(cameras[0],{yaw:Infinity}),/must be finite/);
 assert.throws(()=>setShipFacing(cameras[0],{roll:NaN}),/must be finite/);
 restoreCamera(cameras[0]);
 assert.equal(cameras[0].shipFacing.yaw,0);
 assert.equal(cameraDisplayName(cameras[0]),"Rear Chase (Customizable)");
 const overview=createLegacyShipFacing(),forward=createLegacyShipFacing();
 setShipFacing({shipFacing:overview},{yaw:180});
 assert.equal(forward.yaw,0);
 assert.equal(overview.yaw,180);
 assert.equal(LEGACY_SHIP_FACING_IDS.overview,"ship.camera.legacy-overview");
});
