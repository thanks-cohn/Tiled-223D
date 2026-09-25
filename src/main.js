import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {sampleWorld,fromTiled,wrap} from "./world-data.js";
import {terrainGroup,oceanPlane,clouds} from "./terrain.js";
import islandData from "./worlds/floating-islands.json";
import {buildFloatingIslands,disposeFloatingIslands} from "./floating-islands.js";
import {spatialHit} from "./spatial.js";
import {createWorldMap} from "./world-map.js";
import {validateExpansiveDirt,dirtLandSample} from "./expansive-dirt-land.js";
import {createExpansiveDirtRenderer} from "./expansive-dirt-renderer.js";
import {createIslandImpostors,updateIslandImpostor,disposeIslandImpostors} from "./island-impostors.js";
import {altitudeProfile,damp,LIMITS} from "./flight-model.js";
import {makeHorizonState,setHorizonPosition,buildOceanGeometry} from "./horizon.js";
import {makeScaleWorld,SCALE_PRESETS,transferScalePosition} from "./scale-world.js";
import {cameraViewProfile,nextCameraChoice,overviewCameraScale,forwardLookAngle,overviewFocusHeight,planetOverviewFov} from "./camera-modes.js";
import {travelRegion} from "./travel-regions.js";
import {positionIslandVisual,cinematicShipScale,cameraAscentHeight} from "./visual-anchors.js";
import {advanceMomentum,createFlybyTracker,resetFlybyTracker,updateFlybys} from "./flight-momentum.js";
import {sweepHorizontal} from "./horizontal-flight.js";
import {makeOceanSpeedCues} from "./ocean-speed-cues.js";
import {createCameraController,cameraDisplayName,setCameraOffset,setCameraLookAt,setShipFacing,createLegacyShipFacing,LEGACY_SHIP_FACING_IDS,restoreCamera,evaluateCameraPose,fitShipCamera,shouldHandleCameraKey,previewViewport} from "./cinematic-cameras.js";

const view=document.getElementById("view");
const positionUI=document.getElementById("position"),statusUI=document.getElementById("status");
const notice=document.getElementById("notice"),exitUI=document.getElementById("exit");
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"low-power"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,0.8));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;view.append(renderer.domElement);
const scene=new THREE.Scene();
const skyDay=new THREE.Color("#8ad3f8"),skySpace=new THREE.Color("#070d20");
scene.background=skyDay.clone();
// This default map wraps every 500 units; 350 clipped islands when turning.
// 900 keeps every nearest repeated island inside the viewable range.
const camera=new THREE.PerspectiveCamera(69,innerWidth/innerHeight,.5,4000);
const previewCamera=new THREE.PerspectiveCamera(69,16/9,.5,4000);
const sun=new THREE.DirectionalLight("#fff5db",1.35);sun.position.set(-80,160,-70);scene.add(sun);
scene.add(new THREE.HemisphereLight("#fff6dc","#52768a",2.1));
const horizonState=makeHorizonState();
const ocean=oceanPlane(horizonState);scene.add(ocean);
const cloudSystem=clouds(scene);
const speedCues=makeOceanSpeedCues(scene);
const dirtRenderer=createExpansiveDirtRenderer(scene,horizonState);

const ship=new THREE.Group();
const sphere=new THREE.Mesh(new THREE.SphereGeometry(.9,9,6),new THREE.MeshLambertMaterial({color:"#fbdf77",flatShading:true}));
sphere.scale.set(1,.6,1.7);ship.add(sphere);scene.add(ship);
// Cache local model bounds once rather than traversing meshes every frame.
let shipVisualBounds={center:new THREE.Vector3(),radius:2};
function refreshShipVisualBounds(){
 const position=ship.position.clone(),rotation=ship.rotation.clone(),scale=ship.scale.clone();
 ship.position.set(0,0,0);ship.rotation.set(0,0,0);ship.scale.setScalar(1);
 ship.updateMatrixWorld(true);
 const sphereBounds=new THREE.Box3().setFromObject(ship).getBoundingSphere(new THREE.Sphere());
 shipVisualBounds={center:sphereBounds.center.clone(),radius:Math.max(.05,sphereBounds.radius)};
 ship.position.copy(position);ship.rotation.copy(rotation);ship.scale.copy(scale);
 ship.updateMatrixWorld(true);
}
refreshShipVisualBounds();
// Files placed at public/ship/ship.glb are available at /ship/ship.glb.
// An absent model is deliberately nonfatal: the procedural sphere always works.
new GLTFLoader().load("/ship/ship.glb",gltf=>{
 ship.remove(sphere);gltf.scene.scale.setScalar(1);
 ship.add(gltf.scene);refreshShipVisualBounds();
},undefined,()=>{ /* no uploaded model yet: retain the sphere */ });

let sourceWorld=sampleWorld(),expansiveDirtRule=validateExpansiveDirt(),
 copies=[],floatingInstances=[],islandCards=[],yaw=0,
 mode="world",quality="low",time=0,last=performance.now();
sourceWorld.objects=islandData.objects;
let scaleScene=makeScaleWorld(sourceWorld,"current",expansiveDirtRule),world=scaleScene.nav;
let regions=world.regions;
const pilot=new THREE.Vector3();
const cameraController=createCameraController();
const cameraInitialized=new Set();
let legacyCameraActive=false,cameraChoice="auto";
// Visual-only facing is stored per shot; no change to pilot heading or collision.
const legacyShipFacing={
 [LEGACY_SHIP_FACING_IDS.overview]:createLegacyShipFacing(),
 [LEGACY_SHIP_FACING_IDS.forward]:createLegacyShipFacing()
};
function facingFor(id){
 if(id in legacyShipFacing)return legacyShipFacing[id];
 return cameraController.get(id).shipFacing;
}
function setFacingFor(id,angles){
 const setting=facingFor(id);
 setShipFacing({shipFacing:setting},angles);
 return {...setting};
}
function applyVisualShipFacing(id){
 const facing=facingFor(id),degrees=THREE.MathUtils.degToRad;
 ship.rotation.set(pitch+degrees(facing.pitch),yaw+degrees(facing.yaw),bank+degrees(facing.roll));
 ship.updateWorldMatrix(true,false);
}
function currentShipVisualBounds(){
 ship.updateWorldMatrix(true,false);
 return {center:ship.localToWorld(shipVisualBounds.center.clone()),
  radius:shipVisualBounds.radius*ship.scale.x};
}
const flybys=createFlybyTracker();
let atmosphereWarned=false,cruise=false,forwardVelocity=0,verticalVelocity=0,bank=0,pitch=0;
let safeFlightCeiling=0;
const held=new Set();
const mapUI=createWorldMap({
 panel:document.getElementById("mapPanel"),canvas:document.getElementById("mapCanvas"),
 label:document.getElementById("mapLabel"),worldGetter:()=>world,
 positionGetter:()=>pilot,headingGetter:()=>yaw
});
document.getElementById("mapButton").addEventListener("click",()=>{held.clear();mapUI.toggle();});
document.getElementById("closeMap").addEventListener("click",()=>{mapUI.close();held.clear();});
function pointGround(x,z){return scaleScene.groundAt(x,z);}
function setMessage(message){notice.textContent=message;}
function makeTerrain(){
 regions=world.regions;
 // Keep the planet visible at the highest permitted altitude. Camera near is
 // raised only when sufficiently distant so the 4 GB GPU retains depth
 // precision instead of shimmering at enormous far/near clipping ratios.
 const cameraFar=Math.max(4000,scaleScene.preset.radius*7,
  2400*scaleScene.preset.altitudeScale+scaleScene.preset.radius*3);
 for(const renderCamera of [camera,previewCamera]){renderCamera.far=cameraFar;renderCamera.updateProjectionMatrix();}
 dirtRenderer.rebuild(scaleScene);
 const oldOcean=ocean.geometry;
 ocean.geometry=buildOceanGeometry(scaleScene.preset.radius);
 oldOcean.dispose();
 setHorizonPosition(horizonState,{x:0,z:0},0,0,scaleScene.preset.radius);
 // Above every authoritative terrain and object top, turbo flight needs no
 // per-substep collision queries; never skip collision near actual surfaces.
 safeFlightCeiling=sourceWorld.heights.reduce((maximum,height)=>Math.max(maximum,height),0);
 for(const object of world.objects||[])for(const part of object.parts||[])
  safeFlightCeiling=Math.max(safeFlightCeiling,object.at[1]+part.height[1]);
 if(scaleScene.expansiveDirt) safeFlightCeiling=Math.max(safeFlightCeiling,
  expansiveDirtRule.baseHeight+expansiveDirtRule.rollingHeight+
  expansiveDirtRule.highPointHeight+19+9+3);
 safeFlightCeiling+=5;
 disposeIslandImpostors(islandCards,scene);
 islandCards=[];
 for(const item of floatingInstances)scene.remove(item.group);
 disposeFloatingIslands(floatingInstances);
 floatingInstances=world.objects?.length?buildFloatingIslands(world.objects,islandData.cluster.id):[];
 for(const item of floatingInstances){
  scene.add(item.group);
  const card=createIslandImpostors(item.object);
  islandCards.push(card);
  scene.add(card.mid,card.far);
 }
 // Clones share terrain geometry: release it only after all old instances detach.
 const oldGeometry=new Set();
 for(const instance of copies) {
  instance.traverse(node=>{if(node.isMesh && node.geometry)oldGeometry.add(node.geometry);});
  scene.remove(instance);
 }
 oldGeometry.forEach(geometry=>geometry.dispose());
 copies=[];
 const base=terrainGroup(sourceWorld,horizonState);
 // Only ONE rendered instance of each semantic landmass exists.
 // Its own group is repositioned to the closest wrapped world coordinate,
 // so a long view distance never exposes 9 repeated maps at once.
 scene.add(base);copies.push(base);
}
// Separate, sparse expansive continent. Does NOT recolor source Tiled islands.
function refreshExpansiveDirt(){
 const selected=scaleScene.preset.id;
 scaleScene=makeScaleWorld(sourceWorld,selected,expansiveDirtRule);
 world=scaleScene.nav;makeTerrain();cameraInitialized.clear();mapUI.refreshWorld();
 return window.tiledWorldDirtApi.getRule();
}
window.tiledWorldDirtApi={
 listLandmasses:()=>[...world.placements.map(p=>({id:p.id,kind:"authored-protected"})),
  ...(scaleScene.expansiveDirt?[{id:"expansive-dirt:continent",kind:"sparse-procedural"}]:[])],
 getRule:()=>({...expansiveDirtRule,rampCoverage:{...expansiveDirtRule.rampCoverage}}),
 setRule:patch=>{
  if(!patch||typeof patch!=="object"||Array.isArray(patch))throw Error("Invalid expansive dirt patch");
  expansiveDirtRule=validateExpansiveDirt({...expansiveDirtRule,...patch,
   rampCoverage:{...expansiveDirtRule.rampCoverage,...patch.rampCoverage}});
  return refreshExpansiveDirt();
 },
 setLandmassRule:(id,patch)=>{
  if(id!=="expansive-dirt:continent")throw Error("Authored islands are protected; target expansive-dirt:continent");
  return window.tiledWorldDirtApi.setRule(patch);
 },
 sample:(x,z)=>scaleScene.sampleExpansiveDirt(x,z),
 footprint:()=>scaleScene.expansiveDirt?{...scaleScene.expansiveDirt,
  rules:window.tiledWorldDirtApi.getRule()}:null,
 capabilities:()=>({separateLandmass:true,sourcePreserved:true,
  largeMediumSmallRamps:"sparse-analytic-elevation-with-matching-near-mesh",
  exactCoverage:false,lowCost:"bounded-near-and-coarse-global-mesh",
  worldScope:"Current/Bigger/Massive demo worlds",roadGameplay:"not-yet-implemented"})
};
function resetSpawn(reason="initialization"){
 // Never reset spawn inside the flight loop or a camera/LOD transition.
 console.info("[Tiled-223D] explicit spawn:",reason);
 const p=world.spawns[0]||{x:world.width/2,z:world.height/2};
 // Begin the two-island flight offshore, facing the near coast. Starting over
 // a tall ridge made W/S feel broken because movement was blocked at spawn.
 const offshore=world.width>120 ? 60 : 0;
 const startZ=p.z+offshore;
 pilot.set(p.x,Math.max(offshore?34:75,pointGround(p.x,startZ).height+23),startZ);
 ship.position.set(0,pilot.y,0);
 cameraInitialized.clear();
 resetFlybyTracker(flybys,world,regions,pilot.x,pilot.z);
 yaw=0;cruise=false;forwardVelocity=0;verticalVelocity=0;bank=0;pitch=0;
 document.getElementById("cruise").textContent="Fly forward: Off";
 atmosphereWarned=false;setMessage(offshore?"Press W or Fly forward to approach the island. A/D turns.":"");
}
makeTerrain();resetSpawn("initialization");

function worldExit(){
 if(mode!=="world")return;
 mapUI.close();held.clear();
 mode="exiting";setMessage("NOTICE · Exiting "+world.name+" atmosphere");
 exitUI.classList.add("show");
 setTimeout(()=>{
  if(mode!=="exiting")return;
  mode="canvas";setMessage("");
  // FrameChute/SUBSTRATE can listen to this event and replace the placeholder.
  window.dispatchEvent(new CustomEvent("substrate:world-exit",{detail:{
   worldId:world.name,position:{x:wrap(pilot.x,world.width),y:pilot.y,z:wrap(pilot.z,world.height)}
  }}));
 },1250);
}
function enter(){
 exitUI.classList.remove("show");pilot.y=Math.max(75,pointGround(pilot.x,pilot.z).height+25);
 atmosphereWarned=false;forwardVelocity=0;verticalVelocity=0;bank=0;pitch=0;
 mode="world";setMessage("");held.clear();
 window.dispatchEvent(new CustomEvent("substrate:world-enter",{detail:{worldId:world.name}}));
}
document.getElementById("wake").addEventListener("click",worldExit);
document.getElementById("cruise").addEventListener("click",()=>{
 cruise=!cruise;
 document.getElementById("cruise").textContent="Fly forward: "+(cruise?"On":"Off");
});
document.getElementById("reenter").addEventListener("click",enter);
const mainCameraSelect=document.getElementById("mainCamera"),previewCameraSelect=document.getElementById("previewCamera");
const previewFrame=document.getElementById("cameraPreviewFrame"),previewCaption=document.getElementById("cameraPreviewCaption");
const offsetInputs={forward:document.getElementById("cameraForward"),right:document.getElementById("cameraRight"),up:document.getElementById("cameraUp")};
const lookAtInput=document.getElementById("cameraLookAt"),previewEnabledInput=document.getElementById("previewEnabled");
const cameraButton=document.getElementById("cameraMode"),autoCameraButton=document.getElementById("cameraAuto");
const overviewShipFacing=document.getElementById("overviewShipFacing");
const overviewShipFacingLabel=document.getElementById("overviewShipFacingLabel");
function syncOverviewShipFacingUI(){
 const isOverview=legacyCameraActive&&
  cameraViewProfile(pilot.y/scaleScene.preset.altitudeScale,cameraChoice).overviewWeight>=.5;
 overviewShipFacing.hidden=!isOverview;overviewShipFacingLabel.hidden=!isOverview;
 overviewShipFacing.value=String(legacyShipFacing[LEGACY_SHIP_FACING_IDS.overview].yaw);
}
overviewShipFacing.addEventListener("change",()=>{
 setFacingFor(LEGACY_SHIP_FACING_IDS.overview,{yaw:Number(overviewShipFacing.value)});
 syncOverviewShipFacingUI();
});
function syncLegacyCameraUI(){
 const view=cameraViewProfile(pilot.y/scaleScene.preset.altitudeScale,cameraChoice);
 const label=view.overviewWeight>=.5?"Overview":"Forward";
 cameraButton.textContent=legacyCameraActive?`Legacy view: ${label}`:"Legacy view: Off";
 cameraButton.setAttribute("aria-pressed",String(legacyCameraActive));
 autoCameraButton.textContent=legacyCameraActive&&cameraChoice==="auto"?"Legacy auto: On":"Legacy auto";
 autoCameraButton.setAttribute("aria-pressed",String(legacyCameraActive&&cameraChoice==="auto"));
 syncOverviewShipFacingUI();
}
function toggleLegacyCamera(){
 legacyCameraActive=true;
 cameraChoice=nextCameraChoice(cameraChoice,pilot.y/scaleScene.preset.altitudeScale);
 cameraInitialized.clear();syncLegacyCameraUI();
}
function enableLegacyAuto(){legacyCameraActive=true;cameraChoice="auto";cameraInitialized.clear();syncLegacyCameraUI();}
function syncCameraUI(){
 const {mainId,previewId}=cameraController.selections();
 for(const select of [mainCameraSelect,previewCameraSelect]){
  const selected=select===mainCameraSelect?mainId:previewId;
  select.replaceChildren(...cameraController.list().map(definition=>{
   const option=document.createElement("option");option.value=definition.id;option.textContent=cameraDisplayName(definition);return option;
  }));select.value=selected;
 }
 const main=cameraController.get(mainId);
 for(const axis of Object.keys(offsetInputs))offsetInputs[axis].value=main.offset[axis];
 lookAtInput.checked=main.lookAt.enabled;
 previewCaption.textContent=cameraDisplayName(cameraController.get(previewId));
 previewFrame.hidden=!previewEnabledInput.checked;
}
mainCameraSelect.addEventListener("change",()=>{legacyCameraActive=false;cameraController.selectMain(mainCameraSelect.value);cameraInitialized.clear();syncCameraUI();syncLegacyCameraUI();});
previewCameraSelect.addEventListener("change",()=>{cameraController.selectPreview(previewCameraSelect.value);cameraInitialized.delete(previewCameraSelect.value);syncCameraUI();});
for(const [axis,input] of Object.entries(offsetInputs))input.addEventListener("change",()=>{setCameraOffset(cameraController.get(cameraController.selections().mainId),{[axis]:Number(input.value)});cameraInitialized.clear();syncCameraUI();});
lookAtInput.addEventListener("change",()=>{setCameraLookAt(cameraController.get(cameraController.selections().mainId),{enabled:lookAtInput.checked});syncCameraUI();});
document.getElementById("cameraReset").addEventListener("click",()=>{restoreCamera(cameraController.get(cameraController.selections().mainId));cameraInitialized.clear();syncCameraUI();});
previewEnabledInput.addEventListener("change",syncCameraUI);
cameraButton.addEventListener("click",toggleLegacyCamera);
autoCameraButton.addEventListener("click",enableLegacyAuto);
// Renderer-independent definitions remain accessible to integrations without
// exposing Three.js cameras or granting world mutation permissions.
window.tiledWorldCameraApi={...cameraController,
 setPosition:(id,value)=>{setCameraOffset(cameraController.get(id),value);syncCameraUI();},
 setLookAt:(id,value)=>{setCameraLookAt(cameraController.get(id),value);syncCameraUI();},
 // Visual-only offsets in degrees. Includes the six presets and both legacy shots.
 getShipFacing:id=>({...facingFor(id)}),
 setShipFacing:(id,angles)=>{
  const updated=setFacingFor(id,angles);
  syncCameraUI();syncOverviewShipFacingUI();
  return updated;
 },
 restoreDefaults:id=>{
  if(id in legacyShipFacing)legacyShipFacing[id]=createLegacyShipFacing();
  else restoreCamera(cameraController.get(id));
  syncCameraUI();syncOverviewShipFacingUI();
 }
};
syncCameraUI();
syncLegacyCameraUI();

const scaleSelector=document.getElementById("worldScale");
scaleSelector.addEventListener("change",()=>{
 if(!SCALE_PRESETS[scaleSelector.value])return;
 // Changing map scale is an intentional UI action, not a spawn request.
 const oldScene=scaleScene,nextScene=makeScaleWorld(sourceWorld,scaleSelector.value,expansiveDirtRule);
 const transferred=transferScalePosition(pilot,oldScene,nextScene);
 scaleScene=nextScene;world=scaleScene.nav;
 pilot.set(transferred.x,transferred.y,transferred.z);
 scaleSelector.blur();held.clear();makeTerrain();
 ship.position.set(0,pilot.y,0);
 cameraInitialized.clear();
 resetFlybyTracker(flybys,world,world.regions,pilot.x,pilot.z);
 mapUI.refreshWorld();
 syncLegacyCameraUI();
 statusUI.textContent=world.name+" · "+world.width+" × "+world.height+
  " · location preserved · sparse ocean · fixed terrain budget";
});

document.getElementById("quality").addEventListener("click",()=>{
 quality=quality==="low"?"balanced":"low";
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality==="low"?.8:1.25));
 renderer.setSize(innerWidth,innerHeight);
 document.getElementById("quality").textContent="Quality: "+(quality==="low"?"Low":"Balanced");
});
function importParsedMap(map,heights=null){
  const next=fromTiled(map,heights);
  next.objects=[];sourceWorld=next;scaleScene=makeScaleWorld(next,"current",expansiveDirtRule);world=scaleScene.nav;
  document.getElementById("worldScale").value="current";
  document.getElementById("worldScale").disabled=true;
  makeTerrain();
  resetSpawn("map import");mode="world";exitUI.classList.remove("show");
  cameraInitialized.clear();syncCameraUI();
  mapUI.refreshWorld();mapUI.close();
  statusUI.textContent=world.name+" · "+world.width+" × "+world.height+((heights||map.substrateElevation)?" · elevated":" · flat (no elevation file)");
  return {name:world.name,width:world.width,height:world.height};
}

document.getElementById("import").addEventListener("click",async()=>{
 const mapFile=document.getElementById("mapFile").files[0];
 const heightFile=document.getElementById("heightFile").files[0];
 if(!mapFile){statusUI.textContent="Choose a Tiled JSON map first.";return;}
 try{
  if(mapFile.size>20_000_000 || (heightFile&&heightFile.size>30_000_000))throw Error("Map file exceeds prototype limits.");
  const map=JSON.parse(await mapFile.text());
  const heights=heightFile?JSON.parse(await heightFile.text()):null;
  importParsedMap(map,heights);
 }catch(err){statusUI.textContent="Import error: "+err.message;}
});

// Desktop-only bridge: the native shell reads the selected project map and
// dispatches bytes here. Browser users keep the original file-picker path.
if(window.qt?.webChannelTransport){
 let desktopActive=true;
 window.__aexisDesktopSetActive=active=>{desktopActive=!!active;held.clear();};
 const script=document.createElement("script");
 script.src="qrc:///qtwebchannel/qwebchannel.js";
 script.onload=()=>new window.QWebChannel(window.qt.webChannelTransport,channel=>{
  const host=channel.objects.aexisHost;
  window.__aexisDesktopImport=encoded=>{
   try{
    if(encoded.length>10_700_000)throw Error("Map exceeds desktop import limit.");
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const map=JSON.parse(new TextDecoder().decode(bytes));
    const result=importParsedMap(map);
    host.reportImport("ok",`${result.name} · ${result.width} × ${result.height}`);
    return "ok";
   }catch(err){
    const detail=String(err?.message||err);
    statusUI.textContent="Import error: "+detail;
    host.reportImport("error",detail);
    return "error";
   }
  };
  host.reportImport("ready","desktop bridge connected");
 });
 script.onerror=()=>{statusUI.textContent="Desktop bridge could not load.";};
 document.head.appendChild(script);
 // The desktop host keeps the web view alive, but need not render its world
 // while the native Map tab covers it. Standalone browser mode is unchanged.
 window.__aexisDesktopIsActive=()=>desktopActive;
}
addEventListener("keydown",e=>{
 if(e.code==="KeyC"&&shouldHandleCameraKey(e)&&mode==="world"&&!mapUI.isOpen()){
  e.preventDefault();legacyCameraActive=false;cameraController.swap();cameraInitialized.clear();syncCameraUI();syncLegacyCameraUI();
  return;
 }
 if(e.code==="KeyV"&&shouldHandleCameraKey(e)&&mode==="world"&&!mapUI.isOpen()){
  e.preventDefault();if(e.shiftKey)enableLegacyAuto();else toggleLegacyCamera();
  return;
 }
 if(e.code==="KeyM"&&!e.repeat&&mode==="world"){
  e.preventDefault();held.clear();mapUI.toggle();return;
 }
 if(e.code==="Escape"&&mapUI.isOpen()){
  e.preventDefault();mapUI.close();held.clear();return;
 }
 if(mapUI.isOpen())return;
 if(["ArrowUp","ArrowDown","Space"].includes(e.code))e.preventDefault();
 held.add(e.code);
 if(e.code==="KeyR"&&mode==="world")pilot.y=Math.max(pilot.y,pointGround(pilot.x,pilot.z).height+35);
});
addEventListener("keyup",e=>held.delete(e.code));
addEventListener("blur",()=>held.clear());
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

function frame(now){
 requestAnimationFrame(frame);
 if(window.__aexisDesktopIsActive?.()===false){last=now;return;}
 const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 // Map is a paused, inexpensive 2D inspection mode; do not run flight,
 // redraw the 3D scene or move the ship while the overlay is open.
 if(mapUI.isOpen())return;
 time+=dt;
 if(mode==="world"){
  const profile=altitudeProfile(pilot.y,scaleScene.preset.altitudeScale);
  const turn=(held.has("KeyA")?1:0)-(held.has("KeyD")?1:0);
  const boost=held.has("ShiftLeft")||held.has("ShiftRight");
  // At altitude the ship turns more gracefully, covering large distances
  // without turning the planet into a jittering texture beneath the camera.
  yaw+=turn*(1.38-.35*profile.cruise)*dt;
  bank=damp(bank,-turn*.22,4,dt);
  // Manual reverse MUST override auto-cruise. Previously S + cruise=0,
  // making W/S seem locked when the forward button was enabled.
  const forward=held.has("KeyS")?-1:(held.has("KeyW")||cruise)?1:0;
  // Ocean now slows how quickly NEW momentum is earned, never hard-clamps
  // speed that the player accumulated near an island or from a flyby.
  const travel=travelRegion(world,regions,pilot.x,pilot.z,pilot.y,boost);
  forwardVelocity=advanceMomentum(forwardVelocity,forward,dt,{
   accelerationFactor:travel.factor,
   altitudeMultiplier:profile.travelMultiplier*(1+(scaleScene.preset.accelerationScale-1)*profile.cruise),
   boost,openness:travel.openness
  });
  const distance=forwardVelocity*dt;
  const nextX=pilot.x-Math.sin(yaw)*distance;
  const nextZ=pilot.z-Math.cos(yaw)*distance;
  // Even at high-altitude cruise, test the intervening terrain and objects
  // rather than teleporting through an imported tall obstacle.
  let move={x:nextX,z:nextZ,blocked:null,sampled:0};
  if(pilot.y<=safeFlightCeiling && Math.abs(distance)>1e-7 &&
    (!world.sparse||scaleScene.pathNearLand(pilot.x,pilot.z,nextX,nextZ))){
   move=sweepHorizontal({
    start:{x:pilot.x,z:pilot.z},target:{x:nextX,z:nextZ},altitude:pilot.y,
    groundAt:pointGround,
    hitAt:(x,z)=>spatialHit(world.objects,x,pilot.y,z,.85,
     world.width,world.height)
   });
  }
  // Even on collision, retain all progress up to the LAST safe sample.
  // A blocked forward thrust is cleared; pressing S immediately reverses
  // regardless of whether the Fly forward button was previously enabled.
  const moved=Math.hypot(move.x-pilot.x,move.z-pilot.z)>1e-7;
  pilot.x=move.x;pilot.z=move.z;
  if(moved){
   const flyby=updateFlybys(flybys,world,regions,pilot.x,pilot.z,
    pilot.y,forwardVelocity,time);
   if(flyby.reward){
    forwardVelocity+=flyby.reward;
    setMessage("ISLAND SLIPSTREAM "+(flyby.reward>0?"+":"")+
     Math.round(flyby.reward)+" · "+flyby.passed);
   }
  }
  if(move.blocked && Math.abs(distance)>1e-7){
   forwardVelocity=0;setMessage(move.blocked);
  }
  const climb=(held.has("ArrowUp")?1:0)-(held.has("ArrowDown")?1:0);
  const climbScale=1+(scaleScene.preset.altitudeScale-1)*
   THREE.MathUtils.smoothstep(pilot.y,35,170);
  verticalVelocity=damp(verticalVelocity,climb*(32+11*profile.cruise)*climbScale,
   climb?4.5:3.2,dt);
  if(Math.abs(verticalVelocity)<.015)verticalVelocity=0;
  const proposedY=pilot.y+verticalVelocity*dt;
  let verticalObstacle=null;
  if(Math.min(proposedY,pilot.y)<=safeFlightCeiling){
   const vSteps=Math.max(1,Math.ceil(Math.abs(proposedY-pilot.y)/.75));
   for(let i=1;i<=vSteps;i++){
    verticalObstacle=spatialHit(world.objects,pilot.x,
     THREE.MathUtils.lerp(pilot.y,proposedY,i/vSteps),
     pilot.z,.85,world.width,world.height);
    if(verticalObstacle)break;
   }
  }
  if(!verticalObstacle)pilot.y=proposedY;
  else{verticalVelocity=0;setMessage("FLOATING ISLAND · "+verticalObstacle.objectId+" · Surface reached");}
  const floor=pointGround(pilot.x,pilot.z).height;
  if(pilot.y<floor+2){
   pilot.y=floor+2;verticalVelocity=0;
   if(climb<0)setMessage("Touchdown · Press ↑ to ascend");
  }
  pilot.y=Math.min(2000*scaleScene.preset.altitudeScale,Math.max(1.8,pilot.y));
  pitch=damp(pitch,-climb*.11,4,dt);
  if(pilot.y>=LIMITS.warning*scaleScene.preset.altitudeScale&&!atmosphereWarned){
   atmosphereWarned=true;setMessage("NOTICE NOTICE · Leaving "+world.name+" atmosphere");
  }
  if(pilot.y<(LIMITS.warning-30)*scaleScene.preset.altitudeScale&&atmosphereWarned){
   atmosphereWarned=false;setMessage("");
  }
  // Continue free flight above the globe. Wake/Return button is always available.
 }
 const profile=altitudeProfile(pilot.y,scaleScene.preset.altitudeScale);
 const near=0.5+Math.min(40,profile.globeReveal*
  Math.sqrt(scaleScene.preset.radius)*.25);
 // Legacy planet view uses the global near plane. Each cinematic view
 // computes its own near plane after fitting the displayed ship geometry.
 if(legacyCameraActive&&Math.abs(camera.near-near)>.08){
  camera.near=near;camera.updateProjectionMatrix();
 }
 ship.position.set(0,pilot.y,0);
 ship.rotation.y=yaw;
 ship.rotation.z=bank;
 ship.rotation.x=pitch;
 // The visual ship stays recognizable even when the camera centers the globe.
 // Physics uses the unscaled semantic ship position and its explicit radius.
 ship.scale.setScalar(cinematicShipScale(profile.globeReveal)*
  (1+(scaleScene.preset.altitudeScale-1)*profile.globeReveal));
 ship.updateWorldMatrix(true,false);
 // Small idle sway is applied only to the default sphere's visual child,
 // never to the ship's authoritative navigation or collision transform.
 sphere.position.y=Math.sin(time*.72)*.09;
 scene.background.copy(skyDay).lerp(skySpace,profile.skyFade);
 sun.intensity=1.35*(1-.35*profile.skyFade);
 // Floating-origin render space: the ship is always (0, Y, 0), regardless
 // of global 16,000-unit traversal. ALL scenery uses matching local X/Z.
 ocean.position.x=0;ocean.position.z=0;
 setHorizonPosition(horizonState,{x:0,z:0},profile.curvature,
  profile.globeReveal,scaleScene.preset.radius);
 const boosting=held.has("ShiftLeft")||held.has("ShiftRight");
 const currentTravel=travelRegion(world,regions,pilot.x,pilot.z,
  pilot.y,boosting);
 speedCues.update(pilot,world,Math.abs(forwardVelocity),yaw,currentTravel.openness,pilot);
 dirtRenderer.update(pilot,time);
 // Independently wrap each distinct island to its single nearest appearance.
 // A player can still travel continuously, but cannot see repeated clones.
 for(const terrain of copies)for(const mass of terrain.children){
  const placement=scaleScene.placementOf(mass.name);
  if(!placement){mass.visible=false;continue;}
  const near=scaleScene.nearestLandInstance(pilot,placement);
  mass.position.set(near.x-pilot.x,0,near.z-pilot.z);
  // Do not render far-away land geometry when its surface patch is on the
  // other side of the planet. Keep the full local island untouched.
  mass.visible=Math.hypot(near.x-pilot.x,near.z-pilot.z)<
   Math.min(world.width*.8,scaleScene.preset.radius*2.6);
  // Keep actual islands fully opaque and bend their GPU vertices with
  // precisely the same horizon function as the sea. No detached land proxy,
  // blue overlay, or per-frame transparency/material traversal.
 }
 // A cheap billboard replaces each floating island as it recedes.
 // The card follows the same wrapped coordinate as the real 3D parent;
 // no object ever vanishes merely because it crossed an arbitrary LOD band.
 // Floating islands remain deliberately airborne, bright and readable.
 // Their semantic positions and near/mid/far impostors are unchanged.
 for(let i=0;i<floatingInstances.length;i++){
  const island=floatingInstances[i],card=islandCards[i];
  updateIslandImpostor(card,island.group,pilot,world);
  positionIslandVisual(card,island.group,pilot,profile);
  island.group.position.x-=pilot.x;island.group.position.z-=pilot.z;
  for(const sprite of [card.mid,card.far]){
   sprite.position.x-=pilot.x;sprite.position.z-=pilot.z;
  }
 }
 const {mainId,previewId}=cameraController.selections();
 function updateLegacyCamera(){
  const dx=Math.sin(yaw),dz=Math.cos(yaw);
  const viewProfile=cameraViewProfile(profile.atmosphericAltitude,cameraChoice);
  const globe=profile.globeReveal,viewMix=viewProfile.overviewWeight;
  const forwardPosition=new THREE.Vector3(0,pilot.y+1.65,0);
  const scale=overviewCameraScale(profile.atmosphericAltitude,scaleScene.preset.altitudeScale);
  const forwardRange=130+scaleScene.preset.radius*.6*
   THREE.MathUtils.smoothstep(profile.atmosphericAltitude,65,445);
  const forwardAngle=forwardLookAngle(profile.atmosphericAltitude,globe);
  const forwardFocus=new THREE.Vector3(-dx*forwardRange,
   forwardPosition.y-forwardRange*Math.tan(forwardAngle),-dz*forwardRange);
  const overviewPosition=new THREE.Vector3(dx*profile.cameraDistance*scale,
   pilot.y+cameraAscentHeight(profile.cameraHeight,globe)*scale,
   dz*profile.cameraDistance*scale);
  const overviewFocus=new THREE.Vector3(
   THREE.MathUtils.lerp(-dx*(33+70*profile.curvature),0,globe),
   overviewFocusHeight(pilot.y,profile.atmosphericAltitude,
    scaleScene.preset.radius,globe,profile.lookDown),
   THREE.MathUtils.lerp(-dz*(33+70*profile.curvature),0,globe));
  const desired=forwardPosition.lerp(overviewPosition,viewMix);
  const focus=forwardFocus.lerp(overviewFocus,viewMix);
  const followRate=4.8+15*globe+Math.min(12,Math.abs(forwardVelocity)/80);
  if(!cameraInitialized.has("legacy")){camera.position.copy(desired);cameraInitialized.add("legacy");}
  else camera.position.lerp(desired,1-Math.exp(-followRate*dt));
  camera.up.set(0,1,0);camera.lookAt(focus);camera.rotateZ(bank*.12*(1-globe*.8)*viewMix);
  const goalFov=planetOverviewFov(profile.fieldOfView+(boosting?7:0),globe,viewMix);
  const nextFov=damp(camera.fov,goalFov,5,dt);
  if(Math.abs(camera.fov-nextFov)>.012||camera.aspect!==innerWidth/innerHeight){
   camera.fov=nextFov;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  }
  return viewMix>.88;
 }
 function updateRenderCamera(renderCamera,id,aspect){
  const definition=cameraController.get(id);
  const {center:shipWorldCenter,radius:shipWorldRadius}=currentShipVisualBounds();
  const initializationKey=(renderCamera===camera?"main:":"preview:")+id;
  const pose=evaluateCameraPose(definition,{
   follow:{x:0,y:pilot.y,z:0},
   aimPoint:{x:shipWorldCenter.x,y:shipWorldCenter.y,z:shipWorldCenter.z},
   yaw,pitch,roll:bank
  });
  // Fit *effective* poses without overwriting creator preset offsets.
  // Orbital framing raises non-overhead ship-facing cameras smoothly while
  // preserving the front-low underside composition near the ground.
  const orbitalBlend=definition.id==="ship.camera.overhead"||!definition.lookAt.enabled?
   0:THREE.MathUtils.smoothstep(profile.atmosphericAltitude,245,395);
  const fitted=fitShipCamera({
   position:pose.position,shipCenter:shipWorldCenter,shipRadius:shipWorldRadius,
   fov:Math.min(pose.projection.fov,renderCamera.fov),aspect,sceneNear:near,orbitalBlend
  });
  const desired=new THREE.Vector3(fitted.position.x,fitted.position.y,fitted.position.z);
  if(!cameraInitialized.has(initializationKey)){renderCamera.position.copy(desired);cameraInitialized.add(initializationKey);}
  else renderCamera.position.lerp(desired,1-Math.exp(-definition.smoothing.position*dt));
  // Smoothing must not strand the camera inside the altitude-enlarged mesh.
  const effective=fitShipCamera({
   position:renderCamera.position,shipCenter:shipWorldCenter,shipRadius:shipWorldRadius,
   fov:Math.min(pose.projection.fov,renderCamera.fov),aspect,sceneNear:near
  });
  renderCamera.position.set(effective.position.x,effective.position.y,effective.position.z);
  if(Math.abs(renderCamera.near-effective.near)>.02){
   renderCamera.near=effective.near;renderCamera.updateProjectionMatrix();
  }
  renderCamera.up.set(0,1,0);
  if(pose.target){
   const horizontalDistance=Math.hypot(pose.position.x-pose.target.x,pose.position.z-pose.target.z);
   if(horizontalDistance<1e-6)renderCamera.up.set(-Math.sin(yaw),0,-Math.cos(yaw));
   renderCamera.lookAt(pose.target.x,pose.target.y,pose.target.z);
  }
  else renderCamera.rotation.set(pitch,yaw,bank,"YXZ");
  renderCamera.rotateX(THREE.MathUtils.degToRad(pose.angleOffset.pitch));
  renderCamera.rotateY(THREE.MathUtils.degToRad(pose.angleOffset.yaw));
  renderCamera.rotateZ(THREE.MathUtils.degToRad(pose.angleOffset.roll));
  const nextFov=damp(renderCamera.fov,pose.projection.fov+(boosting?5:0),5,dt);
  if(Math.abs(renderCamera.fov-nextFov)>.012||renderCamera.aspect!==aspect){
   renderCamera.fov=nextFov;renderCamera.aspect=aspect;renderCamera.updateProjectionMatrix();
  }
 }
 // Each viewport may show a different cosmetic ship direction.
 const mainFacingId=legacyCameraActive?
  (cameraViewProfile(profile.atmosphericAltitude,cameraChoice).overviewWeight>=.5?
   LEGACY_SHIP_FACING_IDS.overview:LEGACY_SHIP_FACING_IDS.forward):mainId;
 applyVisualShipFacing(mainFacingId);
 const mainShowsShip=legacyCameraActive?updateLegacyCamera():
  (updateRenderCamera(camera,mainId,innerWidth/innerHeight),true);
 const previewBounds=previewViewport(innerWidth,innerHeight);
 const {width:previewWidth,height:previewHeight}=previewBounds;
 applyVisualShipFacing(previewId);
 updateRenderCamera(previewCamera,previewId,previewWidth/previewHeight);
 ship.visible=mainShowsShip;
 cloudSystem.update(pilot,world,time,profile,forwardVelocity,pilot,camera,yaw);
 syncLegacyCameraUI();
 if(mode==="world")positionUI.textContent=
  `X ${wrap(pilot.x,world.width).toFixed(1)} · Z ${wrap(pilot.z,world.height).toFixed(1)} · ALT ${pilot.y.toFixed(1)} · GROUND ${pointGround(pilot.x,pilot.z).height.toFixed(1)} · MOMENTUM ${Math.abs(forwardVelocity).toFixed(0)} · ${currentTravel.mode.toUpperCase()} · ${profile.layer.toUpperCase()}`;
 applyVisualShipFacing(mainFacingId);
 renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
 renderer.render(scene,camera);
 if(mode==="world"&&previewEnabledInput.checked){
  // A second view of the authoritative scene, never a second simulation tick.
  applyVisualShipFacing(previewId);
  ship.visible=true;renderer.setScissorTest(true);
  renderer.setViewport(previewBounds.x,previewBounds.y,previewWidth,previewHeight);
  renderer.setScissor(previewBounds.x,previewBounds.y,previewWidth,previewHeight);
  renderer.render(scene,previewCamera);
  renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
 }
 ship.visible=true;
}
requestAnimationFrame(frame);
