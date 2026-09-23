import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {sampleWorld,fromTiled,wrap} from "./world-data.js";
import {terrainGroup,oceanPlane,clouds} from "./terrain.js";
import islandData from "./worlds/floating-islands.json";
import {buildFloatingIslands,disposeFloatingIslands} from "./floating-islands.js";
import {spatialHit} from "./spatial.js";
import {createWorldMap} from "./world-map.js";
import {createIslandImpostors,updateIslandImpostor,disposeIslandImpostors} from "./island-impostors.js";
import {altitudeProfile,damp,LIMITS} from "./flight-model.js";
import {makeHorizonState,setHorizonPosition,buildOceanGeometry} from "./horizon.js";
import {makeScaleWorld,SCALE_PRESETS,transferScalePosition} from "./scale-world.js";
import {cameraViewProfile,nextCameraChoice} from "./camera-modes.js";
import {travelRegion} from "./travel-regions.js";
import {positionIslandVisual,cinematicShipScale,cameraAscentHeight} from "./visual-anchors.js";
import {advanceMomentum,createFlybyTracker,resetFlybyTracker,updateFlybys} from "./flight-momentum.js";
import {terrainBlocksEntry,objectBlocksEntry} from "./flight-collision.js";
import {makeOceanSpeedCues} from "./ocean-speed-cues.js";

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
const sun=new THREE.DirectionalLight("#fff5db",1.35);sun.position.set(-80,160,-70);scene.add(sun);
scene.add(new THREE.HemisphereLight("#fff6dc","#52768a",2.1));
const horizonState=makeHorizonState();
const ocean=oceanPlane(horizonState);scene.add(ocean);
const cloudSystem=clouds(scene);
const speedCues=makeOceanSpeedCues(scene);

const ship=new THREE.Group();
const sphere=new THREE.Mesh(new THREE.SphereGeometry(.9,9,6),new THREE.MeshLambertMaterial({color:"#fbdf77",flatShading:true}));
sphere.scale.set(1,.6,1.7);ship.add(sphere);scene.add(ship);
// Files placed at public/ship/ship.glb are available at /ship/ship.glb.
// An absent model is deliberately nonfatal: the procedural sphere always works.
new GLTFLoader().load("/ship/ship.glb",gltf=>{
 ship.remove(sphere);gltf.scene.scale.setScalar(1);
 ship.add(gltf.scene);
},undefined,()=>{ /* no uploaded model yet: retain the sphere */ });

let sourceWorld=sampleWorld(),copies=[],floatingInstances=[],islandCards=[],yaw=0,
 mode="world",quality="low",time=0,last=performance.now();
sourceWorld.objects=islandData.objects;
let scaleScene=makeScaleWorld(sourceWorld,"current"),world=scaleScene.nav;
let regions=world.regions;
const pilot=new THREE.Vector3();
let cameraInitialized=false,cameraChoice="auto";
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
 camera.far=Math.max(4000,scaleScene.preset.radius*7,
  2400*scaleScene.preset.altitudeScale+scaleScene.preset.radius*3);
 camera.updateProjectionMatrix();
 const oldOcean=ocean.geometry;
 ocean.geometry=buildOceanGeometry(scaleScene.preset.radius);
 oldOcean.dispose();
 setHorizonPosition(horizonState,{x:0,z:0},0,0,scaleScene.preset.radius);
 // Above every authoritative terrain and object top, turbo flight needs no
 // per-substep collision queries; never skip collision near actual surfaces.
 safeFlightCeiling=sourceWorld.heights.reduce((maximum,height)=>Math.max(maximum,height),0);
 for(const object of world.objects||[])for(const part of object.parts||[])
  safeFlightCeiling=Math.max(safeFlightCeiling,object.at[1]+part.height[1]);
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
 cameraInitialized=false;
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
const cameraButton=document.getElementById("cameraMode");
function syncCameraButton(){
 const view=cameraViewProfile(pilot.y/scaleScene.preset.altitudeScale,cameraChoice);
 cameraButton.textContent="View: "+view.label;
 cameraButton.setAttribute("aria-pressed",String(cameraChoice!=="auto"));
}
function toggleCamera(){
 cameraChoice=nextCameraChoice(cameraChoice);
 syncCameraButton();
}
cameraButton.addEventListener("click",toggleCamera);
syncCameraButton();

const scaleSelector=document.getElementById("worldScale");
scaleSelector.addEventListener("change",()=>{
 if(!SCALE_PRESETS[scaleSelector.value])return;
 // Changing map scale is an intentional UI action, not a spawn request.
 const oldScene=scaleScene,nextScene=makeScaleWorld(sourceWorld,scaleSelector.value);
 const transferred=transferScalePosition(pilot,oldScene,nextScene);
 scaleScene=nextScene;world=scaleScene.nav;
 pilot.set(transferred.x,transferred.y,transferred.z);
 scaleSelector.blur();held.clear();makeTerrain();
 ship.position.set(0,pilot.y,0);
 cameraInitialized=false;
 resetFlybyTracker(flybys,world,world.regions,pilot.x,pilot.z);
 mapUI.refreshWorld();syncCameraButton();
 statusUI.textContent=world.name+" · "+world.width+" × "+world.height+
  " · location preserved · sparse ocean · fixed terrain budget";
});

document.getElementById("quality").addEventListener("click",()=>{
 quality=quality==="low"?"balanced":"low";
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality==="low"?.8:1.25));
 renderer.setSize(innerWidth,innerHeight);
 document.getElementById("quality").textContent="Quality: "+(quality==="low"?"Low":"Balanced");
});
document.getElementById("import").addEventListener("click",async()=>{
 const mapFile=document.getElementById("mapFile").files[0];
 const heightFile=document.getElementById("heightFile").files[0];
 if(!mapFile){statusUI.textContent="Choose a Tiled JSON map first.";return;}
 try{
  if(mapFile.size>20_000_000 || (heightFile&&heightFile.size>30_000_000))throw Error("Map file exceeds prototype limits.");
  const map=JSON.parse(await mapFile.text());
  const heights=heightFile?JSON.parse(await heightFile.text()):null;
  const next=fromTiled(map,heights);
  next.objects=[];sourceWorld=next;scaleScene=makeScaleWorld(next,"current");world=scaleScene.nav;
  document.getElementById("worldScale").value="current";
  document.getElementById("worldScale").disabled=true;
  makeTerrain();
  resetSpawn("map import");mode="world";exitUI.classList.remove("show");
  cameraChoice="auto";syncCameraButton();
  mapUI.refreshWorld();mapUI.close();
  statusUI.textContent=world.name+" · "+world.width+" × "+world.height+(heights?" · elevated":" · flat (no elevation file)");
 }catch(err){statusUI.textContent="Import error: "+err.message;}
});
addEventListener("keydown",e=>{
 if(e.code==="KeyV"&&!e.repeat&&mode==="world"&&!mapUI.isOpen()){
  e.preventDefault();toggleCamera();return;
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
  let blocked=null;
  if(pilot.y<=safeFlightCeiling && Math.abs(distance)>1e-7 &&
    (!world.sparse||scaleScene.pathNearLand(pilot.x,pilot.z,nextX,nextZ))){
   const startingGround=pointGround(pilot.x,pilot.z);
   const startingHit=spatialHit(world.objects,pilot.x,pilot.y,
    pilot.z,.85,world.width,world.height);
   const steps=Math.max(1,Math.ceil(Math.abs(distance)/.75));
   for(let step=1;step<=steps;step++){
    const fraction=step/steps,px=THREE.MathUtils.lerp(pilot.x,nextX,fraction);
    const pz=THREE.MathUtils.lerp(pilot.z,nextZ,fraction);
    if(terrainBlocksEntry(startingGround,pointGround(px,pz),pilot.y)){
     blocked="RIDGE AHEAD · Reverse or ascend to clear the surface";break;
    }
    const obstacle=spatialHit(world.objects,px,pilot.y,pz,.85,
     world.width,world.height);
    if(objectBlocksEntry(startingHit,obstacle)){
     blocked="FLOATING ISLAND · "+obstacle.objectId+" · Reverse or ascend";break;
    }
   }
  }
  if(!blocked){
   pilot.x=nextX;pilot.z=nextZ;
   const flyby=updateFlybys(flybys,world,regions,pilot.x,pilot.z,
    pilot.y,forwardVelocity,time);
   if(flyby.reward){
    // Additive world-speed impulse. No target-speed damping can erase it on
    // the following frame, even after leaving the cluster for open ocean.
    forwardVelocity+=flyby.reward;
    setMessage("ISLAND SLIPSTREAM "+(flyby.reward>0?"+":"")+
     Math.round(flyby.reward)+" · "+flyby.passed);
   }
  }else if(Math.abs(distance)>1e-7){
   forwardVelocity=0;setMessage(blocked);
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
 if(Math.abs(camera.near-near)>.08){
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
 const dx=Math.sin(yaw),dz=Math.cos(yaw);
 const desired=new THREE.Vector3(
  dx*profile.cameraDistance,
  pilot.y+cameraAscentHeight(profile.cameraHeight,profile.globeReveal)*
   scaleScene.preset.altitudeScale,
  dz*profile.cameraDistance
 );
 // At turbo speeds, shorten camera lag so the ship cannot outrun the frame.
 const followRate=3.2+15*profile.globeReveal+Math.min(10,Math.abs(forwardVelocity)/80);
 if(!cameraInitialized){camera.position.copy(desired);cameraInitialized=true;}
 else camera.position.lerp(desired,1-Math.exp(-followRate*dt));
 // Approach the true globe view gradually: the planet becomes the camera's
 // primary subject, not a thin tip at the bottom of the screen. The ship and
 // authoritative world remain freely navigable throughout this transition.
 const globe=profile.globeReveal;
 const focusX=THREE.MathUtils.lerp(-dx*(33+70*profile.curvature),0,globe);
 const focusZ=THREE.MathUtils.lerp(-dz*(33+70*profile.curvature),0,globe);
 const focusY=THREE.MathUtils.lerp(pilot.y-profile.lookDown,
  -horizonState.globeRadius.value,globe);
 // Both camera position and gaze share a stable local origin; far-away
 // planets no longer rotate on floating-point global coordinate jitter.
 camera.lookAt(focusX,focusY,focusZ);
 camera.rotateZ(bank*.12*(1-globe*.8));
 const nextFov=damp(camera.fov,profile.fieldOfView+(boosting?7:0),4,dt);
 if(Math.abs(camera.fov-nextFov)>.012){camera.fov=nextFov;camera.updateProjectionMatrix();}
 cloudSystem.update(pilot,world,time,profile,forwardVelocity,pilot,camera,yaw);
 if(mode==="world")positionUI.textContent=
  `X ${wrap(pilot.x,world.width).toFixed(1)} · Z ${wrap(pilot.z,world.height).toFixed(1)} · ALT ${pilot.y.toFixed(1)} · GROUND ${pointGround(pilot.x,pilot.z).height.toFixed(1)} · MOMENTUM ${Math.abs(forwardVelocity).toFixed(0)} · ${currentTravel.mode.toUpperCase()} · ${profile.layer.toUpperCase()}`;
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
