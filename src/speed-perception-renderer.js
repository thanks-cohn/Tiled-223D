import * as THREE from "three";
import {speedVisualProfile,travelPhase} from "./speed-perception.js";

// A fixed-size, single-draw-call set of subtle, peripheral airflow streaks.
// They are an optical speed cue, NOT fake clouds/land geometry or a second
// planet. Reuse exactly one buffer/material and keep the center of view clear.
const STROKES=32;
export function makeSpeedPerception(camera){
 const coords=new Float32Array(STROKES*6);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute("position",new THREE.BufferAttribute(coords,3));
 const material=new THREE.LineBasicMaterial({
  color:"#dcf2ff",transparent:true,opacity:0,depthWrite:false,
  depthTest:false,toneMapped:false
 });
 const lines=new THREE.LineSegments(geometry,material);
 lines.name="cinematic-peripheral-speed-cues";
 lines.frustumCulled=false;lines.renderOrder=100;
 camera.add(lines);
 lines.visible=false;
 let distance=0;
 const hash=(i,seed)=>{const n=Math.sin(i*127.1+seed*311.7)*43758.5453;
  return n-Math.floor(n);};
 return {
  update({actualSpeed,travelDistance,normalizedAltitude,boosting=false,
   overviewWeight=0,dt=0}){
   const feel=speedVisualProfile(actualSpeed,normalizedAltitude,
    boosting,overviewWeight);
   lines.visible=feel.visible;
   if(!lines.visible)return feel;
   distance+=Math.min(100000,Math.max(0,travelDistance||0));
   material.opacity=feel.opacity;
   // Preserve fixed dimensions in camera space, all 32 lines in peripheral
   // bands. Near the horizon and planet center stays unobstructed.
   // The high-altitude camera increases its near clip plane; a fixed -3.2
   // cue distance would disappear from the Massive-world orbital view.
   const depth=-Math.max(3.2,camera.near+1);
   const fovRadians=camera.fov*Math.PI/180;
   const halfY=Math.abs(depth)*Math.tan(fovRadians/2);
   const halfX=halfY*camera.aspect;
   for(let i=0;i<STROKES;i++){
    const side=i%2===0?-1:1;
    const ring=Math.floor(i/2);
    const randomX=hash(ring,1),randomY=hash(ring,2);
    const p=travelPhase(distance,i);
    const x=side*halfX*(.69+.23*randomX);
    const y=halfY*(-.80+1.60*(.13+randomY*.74));
    const flow=(.13+p*.78);
    const xStart=x*(.76+.18*flow);
    const yStart=y*(.72+.20*flow);
    // Trails extend away from vanishing point: they signal acceleration,
    // but never replace real parallax from clouds and world-anchored glints.
    const length=feel.length*(.45+randomX*.55);
    const xEnd=xStart+side*halfX*length*.33;
    const yEnd=yStart+Math.sign(y||1)*halfY*length*.27;
    const n=i*6;
    coords[n]=xStart;coords[n+1]=yStart;coords[n+2]=depth;
    coords[n+3]=xEnd;coords[n+4]=yEnd;coords[n+5]=depth;
   }
   geometry.attributes.position.needsUpdate=true;
   return feel;
  },
  hide(){lines.visible=false;},
  dispose(){camera.remove(lines);geometry.dispose();material.dispose();},
  getBudget(){return {strokes:STROKES,drawCalls:1,textures:0,
   particles:0,additionalClouds:0};}
 };
}
