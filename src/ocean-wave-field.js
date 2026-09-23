import {wrap} from "./world-data.js";
const fract=n=>n-Math.floor(n),hash=(x,z,s)=>fract(Math.sin(x*127.1+z*311.7+s*19.19)*43758.5453);
export function waveIdentity(familyId,cellX,cellZ,worldWidth,worldHeight,seed){return `wave:${familyId}:${wrap(cellX,Math.ceil(worldWidth))}:${wrap(cellZ,Math.ceil(worldHeight))}:${seed}`;}
export function sampleWaveGroup(family,cellX,cellZ,{worldWidth,worldHeight,seed=223,worldScale=1}={}){
 if(!family||![cellX,cellZ,worldWidth,worldHeight,seed,worldScale].every(Number.isFinite))throw Error("Invalid wave field input");
 const familySeed=seed+[...family.id].reduce((n,c)=>n+c.charCodeAt(0),0),grid=family.grid*Math.pow(worldScale,.16),anchor={x:(cellX+hash(cellX,cellZ,familySeed))*grid,z:(cellZ+hash(cellX,cellZ,familySeed+1))*grid};
 const angle=(hash(Math.floor(cellX/4),Math.floor(cellZ/4),familySeed+2)-.5)*Math.PI*.72,length=family.length*Math.pow(worldScale,.22),tangent={x:Math.cos(angle),z:Math.sin(angle)},normal={x:-Math.sin(angle),z:Math.cos(angle)};
 const bands=[];for(let band=0;band<family.fragments;band++){const offset=(band-(family.fragments-1)/2)*family.groupSpacing;const points=[];for(let i=0;i<=12;i++){const q=i/12*2-1,broken=hash(cellX*17+i,cellZ*13+band,familySeed+5)>.91;points.push({x:anchor.x+tangent.x*q*length/2+normal.x*(offset+length*family.curvature*(1-q*q)),y:.18,z:anchor.z+tangent.z*q*length/2+normal.z*(offset+length*family.curvature*(1-q*q)),visible:!broken});}bands.push(points);}
 return {id:waveIdentity(family.id,cellX,cellZ,worldWidth,worldHeight,familySeed),familyId:family.id,seed:familySeed,cell:{x:cellX,z:cellZ},anchor,angle,bands,space:"authoritative-ocean-world",sourceControls:{grid,length,curvature:family.curvature,groupSpacing:family.groupSpacing}};
}
