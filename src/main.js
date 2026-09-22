import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {sampleWorld,fromTiled,cell,wrap,ID} from "./world-data.js";
import {terrainGroup,oceanPlane,clouds} from "./terrain.js";
import islandData from "./worlds/floating-islands.json";
import {buildFloatingIslands,disposeFloatingIslands} from "./floating-islands.js";
import {spatialHit} from "./spatial.js";
import {createWorldMap} from "./world-map.js";
import {createIslandImpostors,updateIslandImpostor,disposeIslandImpostors} from "./island-impostors.js";
import {nearestWrappedOffset} from "./landmasses.js";
import {altitudeProfile,damp,targetTravelSpeed,LIMITS} from "./flight-model.js";
import {makeHorizonState,setHorizonPosition} from "./horizon.js";

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

const ship=new THREE.Group();
const sphere=new THREE.Mesh(new THREE.SphereGeometry(.9,9,6),new THREE.MeshLambertMaterial({color:"#fbdf77",flatShading:true}));
sphere.scale.set(1,.6,1.7);ship.add(sphere);scene.add(ship);
// Files placed at public/ship/ship.glb are available at /ship/ship.glb.
// An absent model is deliberately nonfatal: the procedural sphere always works.
new GLTFLoader().load("/ship/ship.glb",gltf=>{
 ship.remove(sphere);gltf.scene.scale.setScalar(1);
 ship.add(gltf.scene);
},undefined,()=>{ /* no uploaded model yet: retain the sphere */ });

let world=sampleWorld(),copies=[],floatingInstances=[],islandCards=[],yaw=0,mode="world",quality="low",time=0,last=performance.now();
world.objects=islandData.objects;
let atmosphereWarned=false,cruise=false,forwardVelocity=0,verticalVelocity=0,bank=0,pitch=0;
let safeFlightCeiling=0;
const held=new Set();
const mapUI=createWorldMap({
 panel:document.getElementById("mapPanel"),canvas:document.getElementById("mapCanvas"),
 label:document.getElementById("mapLabel"),worldGetter:()=>world,
 positionGetter:()=>ship.position,headingGetter:()=>yaw
});
document.getElementById("mapButton").addEventListener("click",()=>{held.clear();mapUI.toggle();});
document.getElementById("closeMap").addEventListener("click",()=>{mapUI.close();held.clear();});
function pointGround(x,z){return cell(world,x,z);}
function setMessage(message){notice.textContent=message;}
function makeTerrain(){
 // Above every authoritative terrain and object top, turbo flight needs no
 // per-substep collision queries; never skip collision near actual surfaces.
 safeFlightCeiling=world.heights.reduce((maximum,height)=>Math.max(maximum,height),0);
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
 const base=terrainGroup(world,horizonState);
 // Only ONE rendered instance of each semantic landmass exists.
 // Its own group is repositioned to the closest wrapped world coordinate,
 // so a long view distance never exposes 9 repeated maps at once.
 scene.add(base);copies.push(base);
}
function resetSpawn(){
 const p=world.spawns[0]||{x:world.width/2,z:world.height/2};
 // Begin the two-island flight offshore, facing the near coast. Starting over
 // a tall ridge made W/S feel broken because movement was blocked at spawn.
 const offshore=world.width>120 ? 60 : 0;
 const startZ=p.z+offshore;
 ship.position.set(p.x,Math.max(offshore?34:75,pointGround(p.x,startZ).height+23),startZ);
 yaw=0;cruise=false;forwardVelocity=0;verticalVelocity=0;bank=0;pitch=0;
 document.getElementById("cruise").textContent="Fly forward: Off";
 atmosphereWarned=false;setMessage(offshore?"Press W or Fly forward to approach the island. A/D turns.":"");
}
makeTerrain();resetSpawn();

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
   worldId:world.name,position:{x:wrap(ship.position.x,world.width),y:ship.position.y,z:wrap(ship.position.z,world.height)}
  }}));
 },1250);
}
function enter(){
 exitUI.classList.remove("show");ship.position.y=Math.max(75,pointGround(ship.position.x,ship.position.z).height+25);
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
  next.objects=[];world=next;makeTerrain();
  resetSpawn();mode="world";exitUI.classList.remove("show");
  mapUI.refreshWorld();mapUI.close();
  statusUI.textContent=world.name+" · "+world.width+" × "+world.height+(heights?" · elevated":" · flat (no elevation file)");
 }catch(err){statusUI.textContent="Import error: "+err.message;}
});
addEventListener("keydown",e=>{
 if(e.code==="KeyM"&&!e.repeat&&mode==="world"){
  e.preventDefault();held.clear();mapUI.toggle();return;
 }
 if(e.code==="Escape"&&mapUI.isOpen()){
  e.preventDefault();mapUI.close();held.clear();return;
 }
 if(mapUI.isOpen())return;
 if(["ArrowUp","ArrowDown","Space"].includes(e.code))e.preventDefault();
 held.add(e.code);
 if(e.code==="KeyR"&&mode==="world")ship.position.y=Math.max(ship.position.y,pointGround(ship.position.x,ship.position.z).height+35);
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
  const profile=altitudeProfile(ship.position.y);
  const turn=(held.has("KeyA")?1:0)-(held.has("KeyD")?1:0);
  const boost=held.has("ShiftLeft")||held.has("ShiftRight");
  // At altitude the ship turns more gracefully, covering large distances
  // without turning the planet into a jittering texture beneath the camera.
  yaw+=turn*(1.38-.35*profile.cruise)*dt;
  bank=damp(bank,-turn*.22,4,dt);
  const forward=((held.has("KeyW")||cruise)?1:0)-(held.has("KeyS")?1:0);
  const requestedSpeed=targetTravelSpeed(ship.position.y,boost)*forward;
  forwardVelocity=damp(forwardVelocity,requestedSpeed,forward?(boost?2.4:3.1):2.2,dt);
  if(Math.abs(forwardVelocity)<.02)forwardVelocity=0;
  const distance=forwardVelocity*dt;
  const nextX=ship.position.x-Math.sin(yaw)*distance;
  const nextZ=ship.position.z-Math.cos(yaw)*distance;
  // Even at high-altitude cruise, test the intervening terrain and objects
  // rather than teleporting through an imported tall obstacle.
  let blocked=null;
  if(ship.position.y<=safeFlightCeiling){
   const steps=Math.max(1,Math.ceil(Math.abs(distance)/.75));
   for(let step=1;step<=steps;step++){
    const fraction=step/steps,px=THREE.MathUtils.lerp(ship.position.x,nextX,fraction);
    const pz=THREE.MathUtils.lerp(ship.position.z,nextZ,fraction);
    const ground=pointGround(px,pz);
    if(ground.ground!==ID.ocean && ground.height+2>=ship.position.y){
     blocked="RIDGE AHEAD · Ascend to clear terrain";break;
    }
    const obstacle=spatialHit(world.objects,px,ship.position.y,pz,.85,world.width,world.height);
    if(obstacle){
     blocked="FLOATING ISLAND · "+obstacle.objectId+" · Fly over, under, or through its opening";break;
    }
   }
  }
  if(!blocked){ship.position.x=nextX;ship.position.z=nextZ;}
  else if(distance!==0){forwardVelocity=0;setMessage(blocked);}
  const climb=(held.has("ArrowUp")?1:0)-(held.has("ArrowDown")?1:0);
  verticalVelocity=damp(verticalVelocity,climb*(32+11*profile.cruise),climb?4.5:3.2,dt);
  if(Math.abs(verticalVelocity)<.015)verticalVelocity=0;
  const proposedY=ship.position.y+verticalVelocity*dt;
  let verticalObstacle=null;
  if(Math.min(proposedY,ship.position.y)<=safeFlightCeiling){
   const vSteps=Math.max(1,Math.ceil(Math.abs(proposedY-ship.position.y)/.75));
   for(let i=1;i<=vSteps;i++){
    verticalObstacle=spatialHit(world.objects,ship.position.x,
     THREE.MathUtils.lerp(ship.position.y,proposedY,i/vSteps),
     ship.position.z,.85,world.width,world.height);
    if(verticalObstacle)break;
   }
  }
  if(!verticalObstacle)ship.position.y=proposedY;
  else{verticalVelocity=0;setMessage("FLOATING ISLAND · "+verticalObstacle.objectId+" · Surface reached");}
  const floor=pointGround(ship.position.x,ship.position.z).height;
  if(ship.position.y<floor+2){
   ship.position.y=floor+2;verticalVelocity=0;
   if(climb<0)setMessage("Touchdown · Press ↑ to ascend");
  }
  ship.position.y=Math.min(2000,Math.max(1.8,ship.position.y));
  pitch=damp(pitch,-climb*.11,4,dt);
  if(ship.position.y>=LIMITS.warning&&!atmosphereWarned){
   atmosphereWarned=true;setMessage("NOTICE NOTICE · Leaving "+world.name+" atmosphere");
  }
  if(ship.position.y<LIMITS.warning-30&&atmosphereWarned){
   atmosphereWarned=false;setMessage("");
  }
  // Continue free flight above the globe. Wake/Return button is always available.
 }
 const profile=altitudeProfile(ship.position.y);
 ship.rotation.y=yaw;
 ship.rotation.z=bank;
 ship.rotation.x=pitch;
 // Small idle sway is applied only to the default sphere's visual child,
 // never to the ship's authoritative navigation or collision transform.
 sphere.position.y=Math.sin(time*.72)*.09;
 scene.background.copy(skyDay).lerp(skySpace,profile.skyFade);
 sun.intensity=1.35*(1-.35*profile.skyFade);
 ocean.position.x=ship.position.x;ocean.position.z=ship.position.z;
 setHorizonPosition(horizonState,ship.position,profile.curvature,profile.globeReveal);
 cloudSystem.update(ship.position,world,time,profile,Math.abs(forwardVelocity));
 // Independently wrap each distinct island to its single nearest appearance.
 // A player can still travel continuously, but cannot see repeated clones.
 for(const terrain of copies)for(const mass of terrain.children){
  mass.position.set(
   nearestWrappedOffset(ship.position.x,mass.userData.centerX,world.width),
   0,
   nearestWrappedOffset(ship.position.z,mass.userData.centerZ,world.height)
  );
  // Keep actual islands fully opaque and bend their GPU vertices with
  // precisely the same horizon function as the sea. No detached land proxy,
  // blue overlay, or per-frame transparency/material traversal.
 }
 // A cheap billboard replaces each floating island as it recedes.
 // The card follows the same wrapped coordinate as the real 3D parent;
 // no object ever vanishes merely because it crossed an arbitrary LOD band.
 // Floating islands remain deliberately airborne, bright and readable.
 // Their semantic positions and near/mid/far impostors are unchanged.
 for(let i=0;i<floatingInstances.length;i++)
  updateIslandImpostor(islandCards[i],floatingInstances[i].group,ship.position,world);
 const dx=Math.sin(yaw),dz=Math.cos(yaw);
 const desired=new THREE.Vector3(
  ship.position.x+dx*profile.cameraDistance,
  ship.position.y+profile.cameraHeight,
  ship.position.z+dz*profile.cameraDistance
 );
 camera.position.lerp(desired,1-Math.exp(-3.2*dt));
 // Approach the true globe view gradually: the planet becomes the camera's
 // primary subject, not a thin tip at the bottom of the screen. The ship and
 // authoritative world remain freely navigable throughout this transition.
 const globe=profile.globeReveal;
 const focusX=THREE.MathUtils.lerp(ship.position.x-dx*(33+70*profile.curvature),ship.position.x,globe);
 const focusZ=THREE.MathUtils.lerp(ship.position.z-dz*(33+70*profile.curvature),ship.position.z,globe);
 const focusY=THREE.MathUtils.lerp(ship.position.y-profile.lookDown,-horizonState.globeRadius.value,globe);
 camera.lookAt(focusX,focusY,focusZ);
 camera.rotateZ(bank*.12*(1-globe*.8));
 const boosting=held.has("ShiftLeft")||held.has("ShiftRight");
 const nextFov=damp(camera.fov,profile.fieldOfView+(boosting?7:0),4,dt);
 if(Math.abs(camera.fov-nextFov)>.012){camera.fov=nextFov;camera.updateProjectionMatrix();}
 if(mode==="world")positionUI.textContent=
  `X ${wrap(ship.position.x,world.width).toFixed(1)} · Z ${wrap(ship.position.z,world.height).toFixed(1)} · ALT ${ship.position.y.toFixed(1)} · GROUND ${pointGround(ship.position.x,ship.position.z).height.toFixed(1)} · SPEED ${Math.abs(forwardVelocity).toFixed(0)} · ${profile.layer.toUpperCase()}`;
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
