import * as THREE from "three";
import {ID} from "./world-data.js";

// One draw call, one buffer, no particle system. The white-blue glints are
// world-anchored; their relative motion is real because the ship moves past.
const COUNT=54,GRID=21;
const fract=v=>v-Math.floor(v);
const rand=(x,z,seed)=>fract(Math.sin(x*127.1+z*311.7+seed*19.19)*43758.5453);
export function makeOceanSpeedCues(scene){
 const positions=new Float32Array(COUNT*2*3);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
 const material=new THREE.LineBasicMaterial({
  color:"#b5d9e7",transparent:true,opacity:0,depthWrite:false,
  depthTest:true,toneMapped:false
 });
 const strokes=new THREE.LineSegments(geometry,material);
 strokes.frustumCulled=false;strokes.visible=false;
 strokes.name="world-anchored-ocean-speed-glints";
 scene.add(strokes);
 const clear=(i)=>{const n=i*6;positions[n+1]=positions[n+4]=-10000;};
 return {
  update(ship,world,speed,heading,openness=0,origin={x:0,z:0}){
   const altitude=Math.min(1,Math.max(0,(ship.y-85)/65));
   const intensity=Math.min(.29,Math.max(0,(Math.abs(speed)-16)/400))*
    (1-altitude)*(0.45+0.55*Math.min(1,openness));
   strokes.visible=intensity>.002;
   if(!strokes.visible)return;
   material.opacity=intensity;
   const gx=Math.floor(ship.x/GRID),gz=Math.floor(ship.z/GRID);
   const axisX=-Math.sin(heading),axisZ=-Math.cos(heading);
   const streakLength=1.2+Math.min(9,Math.abs(speed)/43);
   // Reuse a modest grid of ocean glints within the near field. No per-frame
   // ocean textures, giant transparency layers, or geometry allocations.
   for(let i=0;i<COUNT;i++){
    const tx=gx+(i%9)-4,tz=gz+Math.floor(i/9)-3;
    const x=(tx+rand(tx,tz,1)) * GRID;
    const z=(tz+rand(tx,tz,2)) * GRID;
    const ocean=typeof world.isOcean==="function"?world.isOcean(x,z):
     world.ground[(((Math.floor(z)%world.height)+world.height)%world.height)*world.width+
      (((Math.floor(x)%world.width)+world.width)%world.width)]===ID.ocean;
    if(!ocean){clear(i);continue;}
    const n=i*6,half=streakLength*(.45+rand(tx,tz,3)*.5)*.5;
    positions[n]=x-origin.x-axisX*half;positions[n+1]=.10;positions[n+2]=z-origin.z-axisZ*half;
    positions[n+3]=x-origin.x+axisX*half;positions[n+4]=.10;positions[n+5]=z-origin.z+axisZ*half;
   }
   geometry.attributes.position.needsUpdate=true;
  },
  dispose(){scene.remove(strokes);geometry.dispose();material.dispose();}
 };
}
