import * as THREE from "three";
import {ID} from "./world-data.js";
import {curveMaterial} from "./horizon.js";
import {oceanSpeedStyle} from "./ocean-speed-style.js";
import {sampleCrest,CREST_SEGMENTS,oceanAltitudeProfile} from "./ocean-crest-field.js";

// Exactly ONE ocean-surface draw call, no textures or particle systems.
// Bright strokes follow the SAME globe/horizon vertex projection as the
// ocean and land; they therefore remain legible when altitude increases.
const COLS=9,ROWS=8,COUNT=COLS*ROWS;
export function makeOceanSpeedCues(scene,horizonState){
 if(!horizonState)throw Error("Horizon state is required for curved sea glints");
 const positions=new Float32Array(COUNT*CREST_SEGMENTS*2*3);
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
 const clear=(i)=>{for(let n=i*CREST_SEGMENTS*6;n<(i+1)*CREST_SEGMENTS*6;n+=3)positions[n+1]=-10000;};
 return {
  update(ship,world,speed,heading,openness=0,origin={x:0,z:0},profile=null){
   const normalizedAltitude=profile?.atmosphericAltitude??ship.y;
   const planetRadius=profile?.planetRadius??235;
   const style=oceanSpeedStyle(speed,Math.max(0,normalizedAltitude),
    planetRadius/235,openness,world.width);
   const field=oceanAltitudeProfile(Math.max(0,normalizedAltitude),speed,planetRadius/235);
   strokes.visible=style.visible;
   if(!strokes.visible)return;
   material.opacity=style.opacity;
   const grid=field.grid;
   const gx=Math.floor(ship.x/grid),gz=Math.floor(ship.z/grid);
   const lineHeight=Math.max(.35,planetRadius*.00018);
   for(let i=0;i<COUNT;i++){
    const tx=gx+(i%COLS)-Math.floor(COLS/2);
    const tz=gz+Math.floor(i/COLS)-Math.floor(ROWS/2);
    const crest=sampleCrest(tx,tz,{grid,worldWidth:world.width,
     worldHeight:world.height,lod:field.lod});
    const x=crest.anchor.x,z=crest.anchor.z;
    const ocean=typeof world.isOcean==="function"?world.isOcean(x,z):
     world.ground[(((Math.floor(z)%world.height)+world.height)%world.height)*world.width+
      (((Math.floor(x)%world.width)+world.width)%world.width)]===ID.ocean;
    if(!ocean){clear(i);continue;}
    for(let segment=0;segment<CREST_SEGMENTS;segment++){
     const a=crest.points[segment],b=crest.points[segment+1];
     const n=(i*CREST_SEGMENTS+segment)*6;
     positions[n]=a.x-origin.x;positions[n+1]=lineHeight;positions[n+2]=a.z-origin.z;
     positions[n+3]=b.x-origin.x;positions[n+4]=lineHeight;positions[n+5]=b.z-origin.z;
    }
   }
   geometry.attributes.position.needsUpdate=true;
  },
  getBudget(){return {crests:COUNT,segments:COUNT*CREST_SEGMENTS,drawCalls:1,textures:0,extraOceanMeshes:0};},
  dispose(){scene.remove(strokes);geometry.dispose();material.dispose();}
 };
}
