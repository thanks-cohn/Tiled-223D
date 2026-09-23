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
import {cameraViewProfile,nextCameraChoice,overviewCameraScale,forwardLookAngle,overviewFocusHeight,planetOverviewFov} from "./camera-modes.js";
import {travelRegion} from "./travel-regions.js";
import {positionIslandVisual,cinematicShipScale,cameraAscentHeight} from "./visual-anchors.js";
import {advanceMomentum,createFlybyTracker,resetFlybyTracker,updateFlybys} from "./flight-momentum.js";
import {sweepHorizontal} from "./horizontal-flight.js";
import {createOceanVisualController} from "./ocean-visual-controller.js";
import {measuredTravelSpeed} from "./speed-perception.js";
import {makeSpeedPerception} from "./speed-perception-renderer.js";
import {massiveShipPresentation} from "./massive-ship-presentation.js";
import {createCompositionTransition} from "./camera-transition.js";
import {createMassiveFlightFraming} from "./cinematic-flight-framing.js";
import {createSpatialDiagnostics,projectPoint} from "./spatial-diagnostics.js";
import {createSpatialDevelopmentController} from "./spatial-development.js";
import {createShadowDiagnostics} from "./shadow-diagnostics.js";
import {curveSurfacePoint,projectBounds} from "./spatial-math.js";

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
scene.add(camera);
const speedFeeling=makeSpeedPerception(camera);
const diagnostics=createSpatialDiagnostics();
const oceanVisual=createOceanVisualController({scene,horizonState,diagnostics,
 project:point=>projectionOf(point)});
const composition=createCompositionTransition();
const massiveFraming=createMassiveFlightFraming();
const lookCamera=new THREE.PerspectiveCamera();
const presentationTuning={anchorU:.5,anchorV:.73,heightFraction:.15,
 transitionSeconds:.6,fovBiasDegrees:0};

const ship=new THREE.Group();
const sphere=new THREE.Mesh(new THREE.SphereGeometry(.9,9,6),new THREE.MeshLambertMaterial({color:"#fbdf77",flatShading:true}));
sphere.scale.set(1,.6,1.7);ship.add(sphere);scene.add(ship);
ship.userData.baseVisualExtent=3.4;
// Files placed at public/ship/ship.glb are available at /ship/ship.glb.
// An absent model is deliberately nonfatal: the procedural sphere always works.
new GLTFLoader().load("/ship/ship.glb",gltf=>{
 ship.remove(sphere);gltf.scene.scale.setScalar(1);
 // Measure the unparented asset before it inherits the world-scale ship
 // transform or the Massive camera presentation. Otherwise loading a GLB
 // mid-flight could accidentally make its displayed angular size microscopic.
 const dimensions=new THREE.Box3().setFromObject(gltf.scene)
  .getSize(new THREE.Vector3());
 ship.userData.baseVisualExtent=Math.max(.1,dimensions.x,dimensions.y,dimensions.z);
 ship.add(gltf.scene);
},undefined,()=>{ /* no uploaded model yet: retain the sphere */ });

let sourceWorld=sampleWorld(),copies=[],floatingInstances=[],islandCards=[],yaw=0,
 mode="world",quality="low",time=0,last=performance.now();
sourceWorld.objects=islandData.objects;
let scaleScene=makeScaleWorld(sourceWorld,"current"),world=scaleScene.nav;
let regions=world.regions;
const pilot=new THREE.Vector3();
let cameraInitialized=false,cameraChoice="auto";
let previousCompositionTarget="";
const flybys=createFlybyTracker();
let atmosphereWarned=false,cruise=false,forwardVelocity=0,verticalVelocity=0,bank=0,pitch=0;
let safeFlightCeiling=0;
const held=new Set();
let development;
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
const autoCameraButton=document.getElementById("cameraAuto");
let lastCameraLabel="";
function syncCameraButton(){
 const view=cameraViewProfile(pilot.y/scaleScene.preset.altitudeScale,cameraChoice);
 const label=view.overviewWeight>=.5?"Overview":"Forward";
 // On each click View changes the actual rendered mode. Auto is an
 // independent control, never a third indistinguishable view-button step.
 if(label!==lastCameraLabel){
  cameraButton.textContent="View: "+label;
  lastCameraLabel=label;
 }
 cameraButton.setAttribute("aria-pressed",String(label==="Forward"));
 autoCameraButton.textContent="Auto camera: "+(cameraChoice==="auto"?"On":"Off");
 autoCameraButton.setAttribute("aria-pressed",String(cameraChoice==="auto"));
}
function toggleCamera(){
 cameraChoice=nextCameraChoice(cameraChoice,
  pilot.y/scaleScene.preset.altitudeScale);
 diagnostics.record("camera-mode-requested",{objectId:"camera",worldId:world.name,
  coordinateSpace:"view",causeId:"ui:camera-toggle"});
 syncCameraButton();
}
function enableAutoCamera(){
 cameraChoice="auto";
 diagnostics.record("camera-mode-requested",{objectId:"camera",worldId:world.name,
  coordinateSpace:"view",causeId:"ui:auto-camera"});
 syncCameraButton();
}
cameraButton.addEventListener("click",toggleCamera);
autoCameraButton.addEventListener("click",enableAutoCamera);
syncCameraButton();

const scaleSelector=document.getElementById("worldScale");
scaleSelector.addEventListener("change",()=>{
 if(!SCALE_PRESETS[scaleSelector.value])return;
 // Changing map scale is an intentional UI action, not a spawn request.
 const oldScene=scaleScene,nextScene=makeScaleWorld(sourceWorld,scaleSelector.value);
 scaleSelector.dataset.previousScale=oldScene.preset.id;
 const transferred=transferScalePosition(pilot,oldScene,nextScene);
 scaleScene=nextScene;world=scaleScene.nav;
 pilot.set(transferred.x,transferred.y,transferred.z);
 scaleSelector.blur();held.clear();makeTerrain();
 ship.position.set(0,pilot.y,0);
 cameraInitialized=false;
 massiveFraming.reset();
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
  e.preventDefault();
  if(e.shiftKey)enableAutoCamera();
  else toggleCamera();
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
 const liveDt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 const liveControls={
  turn:(held.has("KeyA")?1:0)-(held.has("KeyD")?1:0),
  forward:held.has("KeyS")?-1:(held.has("KeyW")||cruise)?1:0,
  climb:(held.has("ArrowUp")?1:0)-(held.has("ArrowDown")?1:0),
  boost:held.has("ShiftLeft")||held.has("ShiftRight"),camera:cameraChoice,
  scale:scaleScene.preset.id
 };
 const dt=development.timestep(liveDt);
 const controls=development.controlsForFrame(liveControls);
 if(controls.camera&&controls.camera!==cameraChoice){cameraChoice=controls.camera;syncCameraButton();}
 diagnostics.nextFrame();
 // Map is a paused, inexpensive 2D inspection mode; do not run flight,
 // redraw the 3D scene or move the ship while the overlay is open.
 if(mapUI.isOpen()){speedFeeling.hide();return;}
 time+=dt;
 const startingFlightPosition={x:pilot.x,z:pilot.z};
 if(mode==="world"){
  const profile=altitudeProfile(pilot.y,scaleScene.preset.altitudeScale);
  const turn=controls.turn;
  const boost=controls.boost;
  // At altitude the ship turns more gracefully, covering large distances
  // without turning the planet into a jittering texture beneath the camera.
  yaw+=turn*(1.38-.35*profile.cruise)*dt;
  bank=damp(bank,-turn*.22,4,dt);
  // Manual reverse MUST override auto-cruise. Previously S + cruise=0,
  // making W/S seem locked when the forward button was enabled.
  const forward=controls.forward;
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
  const climb=controls.climb;
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
 // Drive visuals from actual displacement, not attempted thrust or camera
 // movement. Collision and hovering must not fake speed.
 const traveled=mode==="world"?Math.hypot(
  pilot.x-startingFlightPosition.x,pilot.z-startingFlightPosition.z):0;
 const actualTravelSpeed=mode==="world"?measuredTravelSpeed(
  startingFlightPosition,pilot,dt):0;
 const profile=altitudeProfile(pilot.y,scaleScene.preset.altitudeScale);
 const near=0.5+Math.min(40,profile.globeReveal*
  Math.sqrt(scaleScene.preset.radius)*.25);
 if(Math.abs(camera.near-near)>.08){
  camera.near=near;camera.updateProjectionMatrix();
 }
 // Visual ship presentation is chosen after the camera pose is established.
 // Pilot coordinates remain authoritative independent of the displayed mesh.
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
 const boosting=controls.boost;
 const currentTravel=travelRegion(world,regions,pilot.x,pilot.z,
  pilot.y,boosting);
 oceanVisual.update({ship:pilot,world,speed:Math.abs(forwardVelocity),origin:pilot,
  profile:{...profile,planetRadius:scaleScene.preset.radius},frameId:Math.round(time*1000)});
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
 const viewProfile=cameraViewProfile(profile.atmosphericAltitude,cameraChoice);
 syncCameraButton();
 const globe=profile.globeReveal;
 const viewMix=viewProfile.overviewWeight;
 // Retarget only if a developer actually changes the composition settings.
 // Continuously changing Auto viewMix must NOT restart the animation.
 const targetSignature=[presentationTuning.anchorU,presentationTuning.anchorV,
  presentationTuning.heightFraction,presentationTuning.transitionSeconds].join(":");
 if(targetSignature!==previousCompositionTarget){
  if(previousCompositionTarget)composition.retarget({
   u:presentationTuning.anchorU,v:presentationTuning.anchorV,
   heightFraction:presentationTuning.heightFraction},
   presentationTuning.transitionSeconds);
  previousCompositionTarget=targetSignature;
 }
 const compositionState=composition.update(dt);
 const shipFraming=scaleScene.preset.id==="massive"?
  massiveFraming.update({overviewWeight:viewMix,dt,target:compositionState}):null;
 // The forward cockpit and existing external/planetary camera are independent
 // of navigation. Low/mid default to forward; high/top default to the existing
 // overview. Manual Forward/Overview overrides altitude at any level.
 const forwardPosition=new THREE.Vector3(0,pilot.y+1.65,0);
 const scale=overviewCameraScale(profile.atmosphericAltitude,
  scaleScene.preset.altitudeScale);
 // Keep the actual terrain inside the forward viewport as altitude rises:
 // at Massive scale a perfectly horizontal cockpit ray sees only empty sky
 // thousands of units above the sea for most of the ascent.
 const forwardRange=130+scaleScene.preset.radius*.6*
  THREE.MathUtils.smoothstep(profile.atmosphericAltitude,65,445);
 const forwardAngle=forwardLookAngle(
  profile.atmosphericAltitude,globe);
 const forwardFocus=new THREE.Vector3(
  -dx*forwardRange,
  forwardPosition.y-forwardRange*Math.tan(forwardAngle),
  -dz*forwardRange
 );
 // Scale BOTH horizontal follow distance and camera height. The previous
 // 16k world multiplied ONLY camera Y by 32, creating a near-vertical view
 // and a large lingering mismatch with the forward camera.
 const overviewPosition=new THREE.Vector3(
  dx*profile.cameraDistance*scale,
  pilot.y+cameraAscentHeight(profile.cameraHeight,globe)*scale,
  dz*profile.cameraDistance*scale
 );
 const overviewFocus=new THREE.Vector3(
  THREE.MathUtils.lerp(-dx*(33+70*profile.curvature),0,globe),
  overviewFocusHeight(pilot.y,profile.atmosphericAltitude,
   scaleScene.preset.radius,globe,profile.lookDown),
  THREE.MathUtils.lerp(-dz*(33+70*profile.curvature),0,globe)
 );
 const desired=forwardPosition.lerp(overviewPosition,viewMix);
 const focus=forwardFocus.lerp(overviewFocus,viewMix);
 // High altitude: frame the WHOLE planet around the center of the view.
 // A narrower overview lens makes the sphere occupy more of the screen
 // without changing planetary geometry, camera clipping, or ship coordinates.
 const goalFov=planetOverviewFov(
  profile.fieldOfView+(boosting?7:0)+presentationTuning.fovBiasDegrees,globe,viewMix);
 const followRate=4.8+15*globe+Math.min(12,Math.abs(forwardVelocity)/80);
 const massive=scaleScene.preset.id==="massive";
 const followAlpha=1-Math.exp(-(massive?Math.min(5.6,followRate):followRate)*dt);
 if(!cameraInitialized){camera.position.copy(desired);cameraInitialized=true;}
 else camera.position.lerp(desired,followAlpha);
 // The smaller worlds retain their old lens behavior. Massive interpolates
 // the CURRENT camera rotation toward the target rather than snapping to an
 // entirely different aim when the view is changed.
 if(massive){
  lookCamera.position.copy(camera.position);
  lookCamera.lookAt(focus);
  lookCamera.rotateZ(bank*.12*(1-globe*.8)*viewMix);
  camera.quaternion.slerp(lookCamera.quaternion,followAlpha);
 }else{
  camera.lookAt(focus);
  camera.rotateZ(bank*.12*(1-globe*.8)*viewMix);
 }
 const nextFov=damp(camera.fov,goalFov,5,dt);
 if(Math.abs(camera.fov-nextFov)>.012){
  camera.fov=nextFov;camera.updateProjectionMatrix();
 }
 // Only Massive Overview needs a separate ship presentation: the original
 // planet-centered camera otherwise makes the real-position mesh a tiny blip
 // or sends it above the viewport. Re-parent the SAME ship mesh to the
 // camera. Physics, pilot coordinates, clouds and land never follow it.
 const shipView=massiveShipPresentation({
  worldId:scaleScene.preset.id,
  normalizedAltitude:profile.atmosphericAltitude,
  overviewWeight:viewMix,cameraNear:camera.near,
  fieldOfView:camera.fov,
  visualExtent:ship.userData.baseVisualExtent,aspect:camera.aspect,
  composition:shipFraming||compositionState
 });
 if(shipView.active){
  if(ship.parent!==camera){
   const beforeParent=ship.parent===scene?"scene":"other";
   camera.add(ship);
   diagnostics.record("render-parent-change",{objectId:"ship-visible",
    worldId:world.name,coordinateSpace:"render-parent",
    before:{parentId:beforeParent},after:{parentId:"camera"},
    causeId:"world-scale:massive-presentation"});
  }
  ship.position.set(shipView.x,shipView.y,shipView.z);
  ship.rotation.set(pitch,0,bank);
  ship.scale.setScalar(shipView.scale);
  ship.visible=shipView.visible;
  ship.userData.projectedHeightFraction=shipView.viewport.heightFraction;
  ship.userData.screenAnchor=shipView.viewport;
 }else{
  if(ship.parent!==scene){
   scene.add(ship);
   diagnostics.record("render-parent-change",{objectId:"ship-visible",
    worldId:world.name,coordinateSpace:"render-parent",
    before:{parentId:"camera"},after:{parentId:"scene"},
    causeId:"world-scale:non-massive-presentation"});
  }
  ship.userData.projectedHeightFraction=null;
  ship.userData.screenAnchor=null;
  ship.position.set(0,pilot.y,0);
  ship.rotation.set(pitch,yaw,bank);
  ship.scale.setScalar(cinematicShipScale(profile.globeReveal)*
   (1+(scaleScene.preset.altitudeScale-1)*profile.globeReveal));
  ship.visible=viewMix>.88;
 }
 cloudSystem.update(pilot,world,time,profile,forwardVelocity,pilot,camera,yaw);
 if(mode==="world")speedFeeling.update({
  actualSpeed:actualTravelSpeed,travelDistance:traveled,
  normalizedAltitude:profile.atmosphericAltitude,
  boosting:boosting,overviewWeight:viewMix,dt
 });
 else speedFeeling.hide();
 if(mode==="world")positionUI.textContent=
  `X ${wrap(pilot.x,world.width).toFixed(1)} · Z ${wrap(pilot.z,world.height).toFixed(1)} · ALT ${pilot.y.toFixed(1)} · GROUND ${pointGround(pilot.x,pilot.z).height.toFixed(1)} · MOMENTUM ${Math.abs(forwardVelocity).toFixed(0)} · ${currentTravel.mode.toUpperCase()} · ${profile.layer.toUpperCase()}`;
 renderer.render(scene,camera);
 if(development.needsFrameData())development.onFrame({dt,controls,
  frameId:Math.round(time*1000),timestampMs:now,
  physical:{position:{x:pilot.x,y:pilot.y,z:pilot.z},velocity:{forward:forwardVelocity,vertical:verticalVelocity},yaw},
  camera:{position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},fov:camera.fov,near:camera.near,far:camera.far,viewMode:cameraChoice},
  visual:{parentId:ship.parent===camera?"camera":"scene",matrix:ship.matrixWorld.toArray()},
  projection:{physical:projectionOf({x:0,y:pilot.y,z:0}),visible:(()=>{const p=new THREE.Vector3();ship.getWorldPosition(p);return projectionOf(p);})()},
  presentation:{...presentationTuning,...composition.state(),framing:massiveFraming.state()}});
}
const projectionOf=point=>{
 camera.updateMatrixWorld();
 const matrix=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 return projectPoint(point,matrix.elements,{width:renderer.domElement.clientWidth,
  height:renderer.domElement.clientHeight,dpr:renderer.getPixelRatio()});
};
diagnostics.register("pilot",()=>({id:"pilot",worldId:world.name,
 authoritative:{space:"global-world-units",position:{x:pilot.x,y:pilot.y,z:pilot.z},
  velocity:{forward:forwardVelocity,vertical:verticalVelocity},orientation:{yaw,pitch,bank}},
 render:{space:"floating-origin-render-units",position:{x:0,y:pilot.y,z:0},parentId:"scene"},
 projection:{physical:projectionOf({x:0,y:pilot.y,z:0})}}));
diagnostics.register("ship-visible",()=>{const p=new THREE.Vector3();ship.getWorldPosition(p);return {id:"ship-visible",worldId:world.name,
 authoritative:{space:"global-world-units",position:{x:pilot.x,y:pilot.y,z:pilot.z}},
 render:{space:"scene-world-units",position:{x:p.x,y:p.y,z:p.z},parentId:ship.parent===camera?"camera":"scene",matrix:ship.matrixWorld.toArray(),visible:ship.visible,projectedHeightFraction:ship.userData.projectedHeightFraction??null,screenAnchor:ship.userData.screenAnchor??null},
 projection:{physical:projectionOf({x:0,y:pilot.y,z:0}),visible:projectionOf(p)},
 presentationPolicy:ship.parent===camera?"massive-camera-relative-continuous-composition":"physical-floating-origin",transition:composition.state(),framing:massiveFraming.state()};});
diagnostics.register("camera",()=>({id:"camera",worldId:world.name,authoritative:null,
 render:{space:"floating-origin-render-units",position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},matrix:camera.matrixWorld.toArray()},
 camera:{fovDegrees:camera.fov,near:camera.near,far:camera.far,aspect:camera.aspect,viewMode:cameraChoice,projectionMatrix:camera.projectionMatrix.toArray()},
 observationalLimits:["depth occlusion unknown without GPU readback","shader-deformed surface inverse is non-unique"]}));
const defaultPresentation={...presentationTuning};
const developmentAdapter={
 readPhysicalState:()=>({worldScale:scaleScene.preset.id,position:{x:pilot.x,y:pilot.y,z:pilot.z},
  yaw,forwardVelocity,verticalVelocity,cameraChoice}),
 restorePhysicalState:(state,cause)=>{
  if(!state?.position||![state.position.x,state.position.y,state.position.z,state.yaw,
   state.forwardVelocity,state.verticalVelocity].every(Number.isFinite))throw Error("Invalid replay checkpoint");
  if(state.worldScale&&state.worldScale!==scaleScene.preset.id&&SCALE_PRESETS[state.worldScale]){
   scaleSelector.value=state.worldScale;scaleSelector.dispatchEvent(new Event("change"));
  }
  pilot.set(state.position.x,state.position.y,state.position.z);yaw=state.yaw;
  forwardVelocity=state.forwardVelocity;verticalVelocity=state.verticalVelocity;
  if(["auto","forward","overview"].includes(state.cameraChoice))cameraChoice=state.cameraChoice;
  diagnostics.record("replay-checkpoint-restored",{objectId:"pilot",worldId:world.name,
   coordinateSpace:"authoritative-world",causeId:cause});
 },
 applyReplayContext:controls=>{
  if(controls.scale&&controls.scale!==scaleScene.preset.id&&SCALE_PRESETS[controls.scale]){
   scaleSelector.value=controls.scale;scaleSelector.dispatchEvent(new Event("change"));
  }
 },
 readPresentation:()=>({...presentationTuning}),
 applyPresentation:(patch)=>Object.assign(presentationTuning,patch),
 restorePresentation:(state)=>Object.assign(presentationTuning,state),
 restoreDefaultPresentation:()=>Object.assign(presentationTuning,defaultPresentation),
 captureImage:()=>renderer.domElement.toDataURL("image/webp",.55),
 ocean:{getPreset:()=>oceanVisual.getPreset(),preview:(patch,reason)=>oceanVisual.preview(patch,reason),
  rollback:id=>oceanVisual.rollback(id),resetToDefaults:()=>oceanVisual.resetToDefaults(),
  importPreset:value=>oceanVisual.importPreset(value),exportPreset:()=>oceanVisual.exportPreset(),
  compare:(before,after)=>oceanVisual.compare(before,after)},
 shadow:null
};
const shadowDiagnostics=createShadowDiagnostics({diagnostics,readFrame:frame=>{
 const inspected=oceanVisual.inspectShadow(),model=inspected.model,mesh=inspected.mesh;
 if(!frame||!model||!mesh)return null;
 camera.updateMatrixWorld();const viewProjection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
 const viewport={width:renderer.domElement.clientWidth,height:renderer.domElement.clientHeight,dpr:renderer.getPixelRatio()};
 const curve={origin:{x:0,z:0},strength:horizonState.strength.value,radius:horizonState.radius.value,flat:horizonState.flat.value,globe:horizonState.globe.value,globeRadius:horizonState.globeRadius.value};
 const boundary=Array.from({length:16},(_,index)=>{const angle=index*Math.PI/8;return curveSurfacePoint({x:Math.cos(angle)*mesh.effectiveRadiusX,y:.24,z:Math.sin(angle)*mesh.effectiveRadiusZ},curve);});
 const projected=projectBounds([{x:0,y:.24,z:0},...boundary],viewProjection,viewport),bounds=projected.viewport??null;
 const area=bounds?Math.max(0,Math.min(1,bounds.maxU)-Math.max(0,bounds.minU))*Math.max(0,Math.min(1,bounds.maxV)-Math.max(0,bounds.minV)):0;
 const preset=inspected.preset,shadow={...model,postClampRadius:model.postClampRadius,elongation:preset.shadow.elongation,effectiveAlpha:model.alpha,enabled:preset.shadow.enabled,color:preset.shadow.color,moodWeights:inspected.mood?.weights??Object.fromEntries(Object.entries(inspected.mood?.families??{}).map(([id,value])=>[id,value.weight])),sources:{radius:"activePreset.shadow.radius blended by ocean-mood-model",alpha:"activePreset mood shadow alpha × 9-sample ocean coverage",elongation:"activePreset.shadow.elongation",presetId:preset.id,presetSchemaVersion:preset.schemaVersion}};
 const oceanBounds={minU:0,maxU:1,minV:0,maxV:1};
 return {runId:diagnostics.stats().runId,frameId:frame.frameId,timestampMs:frame.timestampMs,input:{worldId:world.name,scaleId:scaleScene.preset.id,presetId:preset.id,presetVersion:preset.schemaVersion},physical:{ship:{position:{x:pilot.x,y:pilot.y,z:pilot.z},velocity:{forward:forwardVelocity,vertical:verticalVelocity}},world:{id:world.name,width:world.width,height:world.height,wrapFormula:"((v % size) + size) % size",oceanId:"ocean"},scale:{id:scaleScene.preset.id,previousId:scaleSelector.dataset.previousScale||null,width:scaleScene.preset.width,height:scaleScene.preset.height,planetRadius:scaleScene.preset.radius,altitudeScale:scaleScene.preset.altitudeScale,relativePosition:{u:wrap(pilot.x,world.width)/world.width,v:wrap(pilot.z,world.height)/world.height}},altitude:{physicalY:pilot.y,normalizedAtmospheric:inspected.state?.normalizedAltitude??null,sourceField:"pilot.y / altitudeProfile"}},shadow,presentation:{mesh,duplicateCount:scene.children.filter(child=>child.name==="stylized-ship-ocean-shadow"&&child.uuid!==mesh.meshId).length,floatingOrigin:{x:pilot.x,z:pilot.z},scaleTransform:{physicalToRender:"subtract pilot X/Z; Y unchanged"}},camera:{worldPosition:camera.position.toArray(),quaternion:camera.quaternion.toArray(),targetPolicy:cameraChoice,fovDegrees:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,viewMatrix:camera.matrixWorldInverse.toArray(),projectionMatrix:camera.projectionMatrix.toArray()},viewport:{cssWidth:viewport.width,cssHeight:viewport.height,drawingBufferWidth:Math.round(viewport.width*viewport.dpr),drawingBufferHeight:Math.round(viewport.height*viewport.dpr),dpr:viewport.dpr},projection:{chain:["authoritative-world","floating-origin","horizon-deformed-render","camera","clip","NDC","normalized-viewport","CSS-pixels"],ship:frame.projection.physical,shadow:{center:projected.samples[0],boundarySamples:projected.samples.slice(1),viewportBounds:bounds,viewportAreaFraction:area,occlusion:"unknown",cpuHorizonEquivalent:true}},contributors:[{entityId:"base-ocean-globe",semanticType:"canonical-ocean-surface",sourceModule:"src/horizon.js",geometry:{meshId:ocean.uuid,type:ocean.geometry.type,radius:scaleScene.preset.radius,curvedByShader:true},material:{color:`#${ocean.material.color.getHexString()}`,opacity:ocean.material.opacity,transparent:ocean.material.transparent,depthWrite:ocean.material.depthWrite,depthTest:ocean.material.depthTest},viewportBounds:oceanBounds,overlapsShadow:true,pixelAttribution:"unverified"},{entityId:"ship-ocean-shadow",semanticType:"shadow-footprint",sourceModule:"src/ocean-shadow-renderer.js",geometry:{worldRadiusX:mesh.effectiveRadiusX,worldRadiusZ:mesh.effectiveRadiusZ},material:mesh.material,viewportBounds:bounds,overlapsShadow:true,pixelAttribution:"unverified"},...Object.entries(inspected.mood?.families??{}).filter(([,value])=>value.weight>.012).map(([id,value])=>({entityId:`ocean-ribbon-family:${id}`,semanticType:"tonal-ribbon-family",sourceModule:"src/ocean-wave-renderer.js",geometry:{boundedPool:true,worldWidth:value.worldWidth},material:{opacity:value.opacity},viewportBounds:null,overlapsShadow:true,pixelAttribution:"unverified"})),{entityId:"sky-atmosphere",semanticType:"background",sourceModule:"src/main.js + src/atmosphere-renderer.js",viewportBounds:oceanBounds,overlapsShadow:true,pixelAttribution:"unverified"}],observationalLimits:["candidate overlap is not GPU pixel attribution","depth and transparent compositing are unmeasured","horizon boundary is sampled with the CPU equivalent"]};
}});
developmentAdapter.shadow={capture:options=>shadowDiagnostics.capture(options),history:options=>shadowDiagnostics.history(options),transition:(a,b)=>shadowDiagnostics.transition(a,b),explain:options=>shadowDiagnostics.explain(options),isolate:(_id,visible)=>oceanVisual.setShadowVisibility(visible)};
development=createSpatialDevelopmentController({diagnostics,adapter:developmentAdapter});
window.tiledSpatial=Object.freeze({
 getObjectSpatialState:(...a)=>diagnostics.getObjectSpatialState(...a),getViewportPosition:(...a)=>diagnostics.getViewportPosition(...a),
 getCameraState:()=>diagnostics.getCameraState(),getSpatialSnapshot:(...a)=>diagnostics.getSpatialSnapshot(...a),
 getSpatialRelationship:(...a)=>diagnostics.getSpatialRelationship(...a),getCoordinateTransform:(...a)=>diagnostics.getCoordinateTransform(...a),
 explainPositionChange:(...a)=>diagnostics.explainPositionChange(...a),exportJSONL:()=>diagnostics.exportJSONL(),incidentReport:(...a)=>diagnostics.incidentReport(...a),
 getShadowDiagnostics:()=>shadowDiagnostics.inspect(),shadow:Object.freeze({inspect:()=>shadowDiagnostics.inspect(),getContributors:options=>shadowDiagnostics.getContributors(options)}),
 ocean:Object.freeze({getPreset:()=>oceanVisual.getPreset(),getMoodState:()=>oceanVisual.getMoodState(),getFamilyState:id=>oceanVisual.getFamilyState(id),getFootprintState:()=>oceanVisual.getFootprintState(),getRenderBudget:()=>oceanVisual.getRenderBudget(),getSelectedCrest:id=>oceanVisual.getSelectedCrest(id)})
});
window.tiledSpatialDevelopment=development.facade;
const diagnosticMode=document.getElementById("diagnosticMode"),diagnosticOverlay=document.getElementById("diagnosticOverlay");
diagnosticMode.addEventListener("change",()=>{diagnostics.setMode(diagnosticMode.value);diagnosticOverlay.hidden=diagnosticMode.value==="performance";});
document.getElementById("exportDiagnostics").addEventListener("click",()=>{const blob=new Blob([diagnostics.exportJSONL()],{type:"application/x-ndjson"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="tiled-spatial-trace.jsonl";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);});
const authorizeDevelopment=document.getElementById("authorizeDevelopment");
authorizeDevelopment.addEventListener("click",event=>{
 const result=development.grantAuthorization({trustedUserGesture:event.isTrusted});
 authorizeDevelopment.textContent=result.error?"Authorization requires a real click":"Agent tools: Authorized (15 min)";
 if(!result.error){diagnostics.setMode("deep");diagnosticMode.value="deep";diagnosticOverlay.hidden=false;}
});
const oceanStudio=document.getElementById("oceanStudio"),oceanPanel=document.getElementById("oceanPanel"),oceanMood=document.getElementById("oceanMood"),oceanDensity=document.getElementById("oceanDensity"),oceanWhite=document.getElementById("oceanWhite"),oceanWidth=document.getElementById("oceanWidth"),oceanContinuity=document.getElementById("oceanContinuity"),oceanSoftness=document.getElementById("oceanSoftness"),oceanShadow=document.getElementById("oceanShadow");
let studioPreview=null;
oceanStudio.addEventListener("click",()=>{oceanPanel.hidden=!oceanPanel.hidden;if(!oceanPanel.hidden)oceanDensity.focus();});
document.getElementById("closeOceanStudio").addEventListener("click",()=>{oceanPanel.hidden=true;oceanStudio.focus();});
document.getElementById("previewOcean").addEventListener("click",()=>{if(!development.facade.status().authorized){setMessage("Authorize agent tools before previewing ocean changes.");return;}if(studioPreview)development.facade.oceanRollback(studioPreview.id);const mood=oceanMood.value,family=mood==="low"?"near-crest":mood==="middle"?"middle-swell":mood==="high"?"broad-band":"planetary-contour";studioPreview=development.facade.oceanPreview({moods:{[mood]:{whiteStrength:Number(oceanWhite.value),weights:{[family]:Number(oceanDensity.value)}}},families:{[family]:{width:Number(oceanWidth.value),gapRhythm:1-Number(oceanContinuity.value),softness:Number(oceanSoftness.value)}},shadow:{enabled:oceanShadow.checked}},`Ocean Studio ${mood}`);setMessage(studioPreview.error?.message||"Ocean preview applied · use A/B or Reset");});
document.getElementById("compareOcean").addEventListener("click",()=>{if(!studioPreview?.id)return;development.facade.oceanRollback(studioPreview.id);studioPreview=null;setMessage("A/B baseline restored. Preview again to compare.");});
document.getElementById("resetOcean").addEventListener("click",()=>{const result=development.facade.oceanResetToDefaults();studioPreview=null;setMessage(result.error?.message||"Ocean defaults restored.");});
setInterval(()=>{if(diagnostics.mode==="performance")return;const state=diagnostics.getObjectSpatialState("ship-visible"),v=state.projection?.visible?.viewport;diagnosticOverlay.textContent=v?`RENDER VIEWPORT u=${v.u.toFixed(3)} v=${v.v.toFixed(3)} · ${state.projection.visible.status}\nPHYSICAL X=${pilot.x.toFixed(1)} Y=${pilot.y.toFixed(1)} Z=${pilot.z.toFixed(1)} · ${ship.parent===camera?"camera-relative presentation":"world representation"}`:"Projection unavailable";},250);
requestAnimationFrame(frame);
