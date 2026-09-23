import * as THREE from "three";
import {ID} from "./world-data.js";
import {curveMaterial} from "./horizon.js";
import {oceanSpeedStyle} from "./ocean-speed-style.js";
import {sampleCrest,CREST_SEGMENTS,oceanCrestLayers} from "./ocean-crest-field.js";

// Two tiny, fixed, world-anchored crest lattices use the existing ocean's
// curvature shader. Their geographic anchors NEVER depend on altitude or
// ship heading. At low altitude only near lines render; at orbital height
// only distant arcs render; the two crossfade without teleporting the sea.
const SPECS=Object.freeze([
 {key:"near",cols:8,rows:7,name:"world-anchored-high-contrast-ocean-speed-glints"},
 {key:"far",cols:8,rows:4,name:"world-anchored-expansive-ocean-crests"}
]);
export function makeOceanSpeedCues(scene,horizonState){
 if(!horizonState)throw Error("Horizon state is required for curved sea crests");
 const layers=SPECS.map(spec=>{
  const count=spec.cols*spec.rows;
  const positions=new Float32Array(count*CREST_SEGMENTS*6);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  const material=curveMaterial(new THREE.LineBasicMaterial({
   color:0xeaffff,transparent:true,opacity:0,depthWrite:false,
   depthTest:true,toneMapped:false,fog:false
  }),horizonState);
  const strokes=new THREE.LineSegments(geometry,material);
  strokes.frustumCulled=false;strokes.visible=false;strokes.name=spec.name;
  scene.add(strokes);
  const cache=new Map();
  let cacheProfile="";
  const clear=i=>{
   for(let n=i*CREST_SEGMENTS*6;n<(i+1)*CREST_SEGMENTS*6;n+=6)
    positions[n+1]=positions[n+4]=-10000;
  };
  return {
   strokes,material,geometry,count,
   update({ship,world,origin,style,profile,config,lineHeight}){
    strokes.visible=style.visible&&config.weight>.003;
    if(!strokes.visible)return;
    material.opacity=style.opacity*config.weight;
    // Fixed lattice per planet scale; ascent only changes opacity. Never
    // make grid a continuously varying function of altitude.
    const grid=config.grid;
    const signature=[world.width,world.height,config.seed,grid].join(":");
    if(signature!==cacheProfile){cache.clear();cacheProfile=signature;}
    const gx=Math.floor(ship.x/grid),gz=Math.floor(ship.z/grid);
    for(let i=0;i<count;i++){
     const tx=gx+(i%spec.cols)-Math.floor(spec.cols/2);
     const tz=gz+Math.floor(i/spec.cols)-Math.floor(spec.rows/2);
     const key=tx+":"+tz;
     let crest=cache.get(key);
     if(!crest){
      crest=sampleCrest(tx,tz,{grid,worldWidth:world.width,
       worldHeight:world.height,seed:config.seed,lod:config.lod});
      if(cache.size>=count*3)cache.clear();
      cache.set(key,crest);
     }
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
   dispose(){scene.remove(strokes);geometry.dispose();material.dispose();cache.clear();}
  };
 });
 return {
  update(ship,world,speed,heading,openness=0,origin={x:0,z:0},profile=null){
   const normalizedAltitude=profile?.atmosphericAltitude??ship.y;
   const planetRadius=profile?.planetRadius??235;
   const planetScale=planetRadius/235;
   const style=oceanSpeedStyle(speed,Math.max(0,normalizedAltitude),
    planetScale,openness,world.width);
   const profiles=oceanCrestLayers(Math.max(0,normalizedAltitude),planetScale);
   const lineHeight=Math.max(.35,planetRadius*.00018);
   for(let i=0;i<layers.length;i++){
    layers[i].update({ship,world,origin,style,profile,
     config:profiles[SPECS[i].key],lineHeight});
   }
  },
  getBudget(){return {crests:88,segments:88*CREST_SEGMENTS,
   drawCalls:2,textures:0,extraOceanMeshes:0};},
  dispose(){for(const layer of layers)layer.dispose();}
 };
}
