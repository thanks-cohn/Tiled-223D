import * as THREE from "three";
import {ID} from "./world-data.js";
import {curveMaterial} from "./horizon.js";
import {oceanSpeedStyle} from "./ocean-speed-style.js";

// Exactly ONE ocean-surface draw call, no textures or particle systems.
// Bright strokes follow the SAME globe/horizon vertex projection as the
// ocean and land; they therefore remain legible when altitude increases.
const COLS=9,ROWS=8,COUNT=COLS*ROWS;
const fract=v=>v-Math.floor(v);
const rand=(x,z,seed)=>fract(Math.sin(x*127.1+z*311.7+seed*19.19)*43758.5453);
export function makeOceanSpeedCues(scene,horizonState){
 if(!horizonState)throw Error("Horizon state is required for curved sea glints");
 const positions=new Float32Array(COUNT*2*3);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
 const material=curveMaterial(new THREE.LineBasicMaterial({
  color:0xeaffff,transparent:true,opacity:0,depthWrite:false,
  depthTest:true,toneMapped:false,fog:false
 }),horizonState);
 const strokes=new THREE.LineSegments(geometry,material);
 strokes.frustumCulled=false;strokes.visible=false;
 strokes.name="world-anchored-high-contrast-ocean-speed-glints";
 scene.add(strokes);
 const clear=(i)=>{const n=i*6;positions[n+1]=positions[n+4]=-10000;};
 return {
  update(ship,world,speed,heading,openness=0,origin={x:0,z:0},profile=null){
   const normalizedAltitude=profile?.atmosphericAltitude??ship.y;
   const planetRadius=profile?.planetRadius??235;
   const style=oceanSpeedStyle(speed,Math.max(0,normalizedAltitude),
    planetRadius/235,openness,world.width);
   strokes.visible=style.visible;
   if(!strokes.visible)return;
   material.opacity=style.opacity;
   const grid=style.grid,axisX=-Math.sin(heading),axisZ=-Math.cos(heading);
   // Bias the fixed patch slightly AHEAD so Forward view sees meaningful
   // real geography, not a tiny pattern entirely beneath/behind the pilot.
   const gx=Math.floor(ship.x/grid)+Math.round(axisX*2);
   const gz=Math.floor(ship.z/grid)+Math.round(axisZ*2);
   const lineHeight=Math.max(.35,planetRadius*.00018);
   for(let i=0;i<COUNT;i++){
    const tx=gx+(i%COLS)-Math.floor(COLS/2);
    const tz=gz+Math.floor(i/COLS)-Math.floor(ROWS/2);
    const x=(tx+rand(tx,tz,1))*grid;
    const z=(tz+rand(tx,tz,2))*grid;
    const ocean=typeof world.isOcean==="function"?world.isOcean(x,z):
     world.ground[(((Math.floor(z)%world.height)+world.height)%world.height)*world.width+
      (((Math.floor(x)%world.width)+world.width)%world.width)]===ID.ocean;
    if(!ocean){clear(i);continue;}
    // Orientation and displacement reflect real heading and REAL ship motion;
    // the seeded marks do not follow the camera or spawn new render objects.
    const half=style.length*(.45+rand(tx,tz,3)*.55)*.5;
    const n=i*6;
    positions[n]=x-origin.x-axisX*half;
    positions[n+1]=lineHeight;
    positions[n+2]=z-origin.z-axisZ*half;
    positions[n+3]=x-origin.x+axisX*half;
    positions[n+4]=lineHeight;
    positions[n+5]=z-origin.z+axisZ*half;
   }
   geometry.attributes.position.needsUpdate=true;
  },
  getBudget(){return {strokes:COUNT,drawCalls:1,textures:0,extraOceanMeshes:0};},
  dispose(){scene.remove(strokes);geometry.dispose();material.dispose();}
 };
}
