export const CAMERA_SCHEMA_VERSION=1;
export const FEET_TO_WORLD_UNITS=0.3048;

const PRESETS=[
 ["ship.camera.rear-chase","Rear Chase",-15,0,0,"perspective",69,0],
 ["ship.camera.front-portrait","Front Portrait",15,0,0,"perspective",62,0],
 ["ship.camera.low-front-fisheye","Low Front Fisheye",10,0,-2,"perspective",92,.35],
 ["ship.camera.high-front-left","High Front Left",15,-10,14,"perspective",66,0],
 ["ship.camera.high-front-right","High Front Right",15,10,14,"perspective",66,0],
 ["ship.camera.overhead","Overhead",0,0,20,"perspective",58,0]
];

function clone(value){return JSON.parse(JSON.stringify(value));}
function finite(value,label){if(!Number.isFinite(value))throw Error(`${label} must be finite`);return value;}
function normalized(value){return Math.round(value*1e8)/1e8;}
function comparable(camera){
 return JSON.stringify({
  mode:camera.mode,offset:Object.fromEntries(Object.entries(camera.offset).map(([key,value])=>[key,normalized(value)])),
  angleOffset:Object.fromEntries(Object.entries(camera.angleOffset).map(([key,value])=>[key,normalized(value)])),
  lookAt:camera.lookAt,projection:camera.projection,
  smoothing:Object.fromEntries(Object.entries(camera.smoothing).map(([key,value])=>[key,normalized(value)]))
 });
}

export const SHIP_CAMERA_PRESETS=Object.freeze(PRESETS.map(([id,name,forward,right,up,type,fov,fisheyeStrength])=>Object.freeze({
 schemaVersion:CAMERA_SCHEMA_VERSION,id,semanticName:name,rig:{kind:"controlled-ship"},
 offset:{forward,right,up,unit:"ft"},angleOffset:{pitch:0,yaw:0,roll:0,unit:"deg"},
 lookAt:{enabled:true,target:{kind:"controlled-ship"},anchor:"aim-point"},
 projection:{type,fov,fisheyeStrength,near:.5,far:4000},
 smoothing:{position:8,rotation:10},mode:"standard"
})));

export function createCameraDefinition(preset){
 const original=clone(preset);
 return {...clone(preset),originalPreset:original};
}
export function createShipCameraLibrary(){return SHIP_CAMERA_PRESETS.map(createCameraDefinition);}
export function isCameraModified(camera){return comparable(camera)!==comparable(camera.originalPreset);}
export function cameraDisplayName(camera){return `${camera.semanticName} (${isCameraModified(camera)?"Modified":"Customizable"})`;}

export function setCameraOffset(camera,offset){
 for(const axis of ["forward","right","up"])if(axis in offset)camera.offset[axis]=finite(offset[axis],axis);
 return camera;
}
export function moveCamera(camera,delta){
 for(const axis of ["forward","right","up"])if(axis in delta)camera.offset[axis]=finite(camera.offset[axis]+delta[axis],axis);
 return camera;
}
export function setCameraAngleOffset(camera,angles){
 for(const axis of ["pitch","yaw","roll"])if(axis in angles)camera.angleOffset[axis]=finite(angles[axis],axis);
 return camera;
}
export function setCameraLookAt(camera,{enabled,target}={}){
 if(enabled!==undefined)camera.lookAt.enabled=Boolean(enabled);
 if(target){
  if(target.kind!=="controlled-ship")throw Error(`Target kind is not registered: ${target.kind}`);
  camera.lookAt.target=clone(target);
 }
 return camera;
}
export function restoreCamera(camera){
 const original=clone(camera.originalPreset);
 for(const key of ["offset","angleOffset","lookAt","projection","smoothing","mode"])camera[key]=original[key];
 return camera;
}

export function shipLocalOffset(offset,yaw,pitch=0,roll=0,worldUnitsPerFoot=FEET_TO_WORLD_UNITS){
 for(const value of [yaw,pitch,roll,worldUnitsPerFoot])finite(value,"ship transform");
 // Intrinsic ship frame: local nose is -Z, starboard is +X, up is +Y.
 let x=offset.right*worldUnitsPerFoot,y=offset.up*worldUnitsPerFoot,z=-offset.forward*worldUnitsPerFoot;
 const cr=Math.cos(roll),sr=Math.sin(roll);[x,y]=[x*cr-y*sr,x*sr+y*cr];
 const cp=Math.cos(pitch),sp=Math.sin(pitch);[y,z]=[y*cp-z*sp,y*sp+z*cp];
 const cy=Math.cos(yaw),sy=Math.sin(yaw);[x,z]=[x*cy+z*sy,-x*sy+z*cy];
 return {x,y,z};
}

export function evaluateCameraPose(camera,{follow,aimPoint=follow,yaw=0,pitch=0,roll=0,worldUnitsPerFoot=FEET_TO_WORLD_UNITS}){
 if(!follow||![follow.x,follow.y,follow.z].every(Number.isFinite))throw Error("A finite follow position is required");
 const local=shipLocalOffset(camera.offset,yaw,pitch,roll,worldUnitsPerFoot);
 const position={x:follow.x+local.x,y:follow.y+local.y,z:follow.z+local.z};
 const target=camera.lookAt.enabled&&aimPoint?{x:aimPoint.x,y:aimPoint.y,z:aimPoint.z}:null;
 return {position,target,angleOffset:{...camera.angleOffset},projection:{...camera.projection}};
}

export function createCameraController(definitions=createShipCameraLibrary(),mainId="ship.camera.rear-chase",previewId="ship.camera.high-front-left"){
 const cameras=new Map(definitions.map(camera=>[camera.id,camera]));
 const requireId=id=>{if(!cameras.has(id))throw Error(`Unknown camera: ${id}`);return id;};
 let main=requireId(mainId),preview=requireId(previewId);
 return {
  list:()=>[...cameras.values()],get:id=>cameras.get(requireId(id)),
  selections:()=>({mainId:main,previewId:preview}),
  selectMain:id=>{main=requireId(id);},selectPreview:id=>{preview=requireId(id);},
  swap:()=>{[main,preview]=[preview,main];return {mainId:main,previewId:preview};}
 };
}

export function shouldHandleCameraKey(event){
 const tag=event?.target?.tagName?.toLowerCase();
 return !event?.repeat&&!event?.ctrlKey&&!event?.metaKey&&!event?.altKey&&
  !event?.target?.isContentEditable&&!['input','textarea','select'].includes(tag);
}
