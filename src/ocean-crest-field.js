import {wrap} from "./world-data.js";
const fract=x=>x-Math.floor(x);
const hash=(x,z,s)=>fract(Math.sin(x*127.1+z*311.7+s*19.19)*43758.5453);
export const CREST_SEGMENTS=6;
export function crestIdentity(cellX,cellZ,worldWidth,worldHeight,seed=223){
 return `ocean-crest:${wrap(cellX,worldWidth)}:${wrap(cellZ,worldHeight)}:${seed}`;
}
export function sampleCrest(cellX,cellZ,{grid=32,worldWidth=500,worldHeight=500,seed=223,lod=0}={}){
 if(![cellX,cellZ,grid,worldWidth,worldHeight,seed,lod].every(Number.isFinite)||grid<=0||worldWidth<=0||worldHeight<=0)throw Error("Invalid crest field");
 const id=crestIdentity(cellX,cellZ,worldWidth,worldHeight,seed);
 const x=(cellX+hash(cellX,cellZ,seed))*grid,z=(cellZ+hash(cellX,cellZ,seed+1))*grid;
 // Low-frequency orientation belongs to geography, never ship/camera heading.
 const angle=(hash(Math.floor(cellX/3),Math.floor(cellZ/3),seed+2)-.5)*Math.PI;
 const length=grid*(.55+hash(cellX,cellZ,seed+3)*.45)*(1+lod*.55);
 const bend=length*(.12+(hash(cellX,cellZ,seed+4)-.5)*.18);
 const tangent={x:Math.cos(angle),z:Math.sin(angle)},normal={x:-tangent.z,z:tangent.x};
 const point=t=>{const q=(t-.5)*2;return {x:x+tangent.x*q*length/2+normal.x*bend*(1-q*q),y:.12,z:z+tangent.z*q*length/2+normal.z*bend*(1-q*q)};};
 return {id,seed,space:"authoritative-ocean-world",anchor:{x,z},lod,
  controls:[point(0),point(.5),point(1)],points:Array.from({length:CREST_SEGMENTS+1},(_,i)=>point(i/CREST_SEGMENTS))};
}
export function oceanAltitudeProfile(altitude,speed,worldScale=1){
 if(![altitude,speed,worldScale].every(Number.isFinite)||altitude<0||worldScale<=0)throw Error("Invalid ocean profile");
 const t=Math.max(0,Math.min(1,altitude/445));
 return {mood:t<.23?"low":t<.5?"middle":t<.82?"high":"top",blend:t,
  grid:(24+190*t*t)*worldScale**.25,lod:t>.76?2:t>.35?1:0,
  opacity:speed<=.01?0:Math.min(.82,.28+Math.log1p(Math.abs(speed))/10),visible:speed>.01};
}

// Two fixed, world-anchored crest lattices. Crucially, altitude ONLY changes
// their crossfade; it NEVER rescales their source coordinates or rotates them
// with the ship/camera. This eliminates the old ascent-driven sea-line crawl.
export function oceanCrestLayers(atmosphericAltitude,planetScale=1){
 if(![atmosphericAltitude,planetScale].every(Number.isFinite)||
  atmosphericAltitude<0||planetScale<=0)
  throw Error("Invalid layered ocean profile");
 const x=Math.min(1,Math.max(0,(atmosphericAltitude-155)/210));
 const distant=x*x*(3-2*x);
 return {
  near:{grid:26*Math.pow(planetScale,.10),seed:223,lod:0,weight:1-distant},
  far:{grid:88*Math.pow(planetScale,.75),seed:827,lod:0,weight:distant}
 };
}
