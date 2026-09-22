import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {sampleWorld,fromTiled,cell,wrap,ID} from "./world-data.js";
import {terrainGroup,oceanPlane,clouds} from "./terrain.js";

const view=document.getElementById("view");
const positionUI=document.getElementById("position"),statusUI=document.getElementById("status");
const notice=document.getElementById("notice"),exitUI=document.getElementById("exit");
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"low-power"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,0.8));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;view.append(renderer.domElement);
const scene=new THREE.Scene();
const skyDay=new THREE.Color("#8ad3f8"),skySpace=new THREE.Color("#070d20");
scene.background=skyDay.clone();
const camera=new THREE.PerspectiveCamera(69,innerWidth/innerHeight,.1,750);
const sun=new THREE.DirectionalLight("#fff5db",1.35);sun.position.set(-80,160,-70);scene.add(sun);
scene.add(new THREE.HemisphereLight("#fff6dc","#52768a",2.1));
const ocean=oceanPlane();scene.add(ocean);
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

let world=sampleWorld(),copies=[],yaw=0,mode="world",quality="low",time=0,last=performance.now();
let atmosphereWarned=false;
const held=new Set();
function pointGround(x,z){return cell(world,x,z);}
function setMessage(message){notice.textContent=message;}
function makeTerrain(){
 for(const instance of copies)scene.remove(instance);
 copies=[];
 const base=terrainGroup(world);
 // Nine lightweight copies share the SAME mesh/texture/geometry. Only render
 // copies near camera; seamless repeated tile data does not allocate new ocean cells.
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  const duplicate=base.clone(true);duplicate.userData={dx,dz};scene.add(duplicate);copies.push(duplicate);
 }
}
function resetSpawn(){
 const p=world.spawns[0]||{x:world.width/2,z:world.height/2};
 ship.position.set(p.x,Math.max(75,pointGround(p.x,p.z).height+25),p.z);
 yaw=0;atmosphereWarned=false;setMessage("");
}
makeTerrain();resetSpawn();

function worldExit(){
 if(mode!=="world")return;
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
 atmosphereWarned=false;mode="world";setMessage("");held.clear();
 window.dispatchEvent(new CustomEvent("substrate:world-enter",{detail:{worldId:world.name}}));
}
document.getElementById("wake").addEventListener("click",worldExit);
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
  world=next;makeTerrain();resetSpawn();mode="world";exitUI.classList.remove("show");
  statusUI.textContent=world.name+" · "+world.width+" × "+world.height+(heights?" · elevated":" · flat (no elevation file)");
 }catch(err){statusUI.textContent="Import error: "+err.message;}
});
addEventListener("keydown",e=>{
 if(["ArrowUp","ArrowDown","Space"].includes(e.code))e.preventDefault();
 held.add(e.code);
 if(e.code==="KeyR"&&mode==="world")ship.position.y=Math.max(ship.position.y,pointGround(ship.position.x,ship.position.z).height+35);
});
addEventListener("keyup",e=>held.delete(e.code));
addEventListener("blur",()=>held.clear());
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

function frame(now){
 requestAnimationFrame(frame);
 const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;time+=dt;
 if(mode==="world"){
  const turn=(held.has("KeyA")?1:0)-(held.has("KeyD")?1:0);
  yaw+=turn*1.4*dt;
  const forward=(held.has("KeyW")?1:0)-(held.has("KeyS")?1:0);
  const speed=(held.has("ShiftLeft")||held.has("ShiftRight")?65:27)*dt*forward;
  const nextX=wrap(ship.position.x-Math.sin(yaw)*speed,world.width);
  const nextZ=wrap(ship.position.z-Math.cos(yaw)*speed,world.height);
  const current=pointGround(ship.position.x,ship.position.z),target=pointGround(nextX,nextZ);
  // A high ridge is an actual approach obstacle. Do not teleport through it.
  if(target.height+2 < ship.position.y || target.ground===ID.ocean){
   ship.position.x=nextX;ship.position.z=nextZ;
  }else if(forward){setMessage("RIDGE AHEAD · Ascend to clear terrain");}
  const climb=(held.has("ArrowUp")?1:0)-(held.has("ArrowDown")?1:0);
  ship.position.y+=climb*32*dt;
  const floor=pointGround(ship.position.x,ship.position.z).height;
  if(ship.position.y<floor+2){ship.position.y=floor+2;if(climb<0)setMessage("Touchdown · Press ↑ to ascend");}
  ship.position.y=Math.min(2000,Math.max(1.8,ship.position.y));
  if(ship.position.y>=350&&!atmosphereWarned){atmosphereWarned=true;setMessage("NOTICE NOTICE · Leaving "+world.name+" atmosphere");}
  if(ship.position.y<320&&atmosphereWarned){atmosphereWarned=false;setMessage("");}
  if(ship.position.y>=500)worldExit();
 }
 ship.rotation.y=yaw;
 const fade=THREE.MathUtils.clamp((ship.position.y-270)/280,0,1);
 scene.background.copy(skyDay).lerp(skySpace,fade);
 sun.intensity=1.35*(1-.35*fade);
 // Keep sky pale and ocean deep: never merge their colors at the horizon.
 ocean.position.x=ship.position.x;ocean.position.z=ship.position.z;
 cloudSystem.update(ship.position.x,ship.position.z,time);
 for(const instance of copies){
  instance.position.set(instance.userData.dx*world.width,0,instance.userData.dz*world.height);
  instance.visible=Math.abs((instance.userData.dx+.5)*world.width-ship.position.x)<world.width*1.5
    && Math.abs((instance.userData.dz+.5)*world.height-ship.position.z)<world.height*1.5;
 }
 const behind=13,dx=Math.sin(yaw),dz=Math.cos(yaw);
 const desired=new THREE.Vector3(ship.position.x+dx*behind,ship.position.y+6,ship.position.z+dz*behind);
 camera.position.lerp(desired,Math.min(1,dt*6));
 camera.lookAt(ship.position.x-dx*16,ship.position.y+1,ship.position.z-dz*16);
 if(mode==="world")positionUI.textContent=
  `X ${wrap(ship.position.x,world.width).toFixed(1)} · Z ${wrap(ship.position.z,world.height).toFixed(1)} · ALT ${ship.position.y.toFixed(1)} · GROUND ${pointGround(ship.position.x,ship.position.z).height.toFixed(1)}`;
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
