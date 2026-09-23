import * as THREE from "three";
import {curveMaterial} from "./horizon.js";
import {OCEAN_FAMILY_IDS} from "./ocean-visual-presets.js";
import {sampleWaveGroup} from "./ocean-wave-field.js";

const FAMILY_LAYOUT={"near-crest":[5,4],"middle-swell":[4,3],"broad-band":[3,3],"planetary-contour":[3,2]};
export function createOceanWaveRenderer(scene,horizonState,preset){
 const layers=new Map();let lastSummary={drawCalls:0,vertices:0,cacheSize:0,visibleCrests:0};
 for(const id of OCEAN_FAMILY_IDS){const [cols,rows]=FAMILY_LAYOUT[id],count=cols*rows,maxSegments=preset.families[id].fragments*12,positions=new Float32Array(count*maxSegments*6);positions.fill(-10000);const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));const material=curveMaterial(new THREE.LineBasicMaterial({color:preset.families[id].color,transparent:true,opacity:0,depthWrite:false,depthTest:true,toneMapped:false,fog:false}),horizonState);const object=new THREE.LineSegments(geometry,material);object.name=`ocean-wave-family:${id}`;object.frustumCulled=false;object.renderOrder=1;scene.add(object);layers.set(id,{id,cols,rows,count,maxSegments,positions,geometry,material,object,cache:new Map(),signature:"",selected:null});}
 const clear=(layer,index)=>{for(let n=index*layer.maxSegments*6;n<(index+1)*layer.maxSegments*6;n++)layer.positions[n]=-10000;};
 const update=({ship,origin,world,mood,worldScale,lineHeight,preset:activePreset})=>{
  let vertices=0,drawCalls=0,cacheSize=0,visibleCrests=0;
  for(const id of OCEAN_FAMILY_IDS){const layer=layers.get(id),family=activePreset.families[id],style=mood.families[id],visible=family.enabled&&style.weight>.012;layer.object.visible=visible;if(!visible)continue;drawCalls++;layer.material.opacity=style.opacity*style.weight;layer.material.color.set(family.color);const grid=style.worldGrid,signature=[world.width,world.height,activePreset.seed,grid,family.length,family.curvature,family.fragments].join(":");if(signature!==layer.signature){layer.cache.clear();layer.signature=signature;}const gx=Math.floor(ship.x/grid),gz=Math.floor(ship.z/grid);layer.selected=null;
   for(let i=0;i<layer.count;i++){if(i>=Math.ceil(layer.count*family.density*activePreset.budget.qualityScale)){clear(layer,i);continue;}const cx=gx+(i%layer.cols)-Math.floor(layer.cols/2),cz=gz+Math.floor(i/layer.cols)-Math.floor(layer.rows/2),key=`${cx}:${cz}`;let crest=layer.cache.get(key);if(!crest){crest=sampleWaveGroup({...family,grid},cx,cz,{worldWidth:world.width,worldHeight:world.height,seed:activePreset.seed,worldScale});if(layer.cache.size>=activePreset.budget.cacheEntries)layer.cache.clear();layer.cache.set(key,crest);}if(!layer.selected)layer.selected=crest;let segmentIndex=0,accepted=0;for(const band of crest.bands)for(let s=0;s<band.length-1;s++){const a=band[s],b=band[s+1],midX=(a.x+b.x)/2,midZ=(a.z+b.z)/2,ocean=world.isOcean(midX,midZ),n=(i*layer.maxSegments+segmentIndex)*6;if(!a.visible||!b.visible||!ocean){for(let j=0;j<6;j++)layer.positions[n+j]=-10000;segmentIndex++;continue;}layer.positions[n]=a.x-origin.x;layer.positions[n+1]=lineHeight;layer.positions[n+2]=a.z-origin.z;layer.positions[n+3]=b.x-origin.x;layer.positions[n+4]=lineHeight;layer.positions[n+5]=b.z-origin.z;segmentIndex++;accepted++;}for(;segmentIndex<layer.maxSegments;segmentIndex++){const n=(i*layer.maxSegments+segmentIndex)*6;for(let j=0;j<6;j++)layer.positions[n+j]=-10000;}if(!accepted)clear(layer,i);else{visibleCrests++;vertices+=accepted*2;}}
   layer.geometry.attributes.position.needsUpdate=true;cacheSize+=layer.cache.size;
  }
  lastSummary={drawCalls,vertices,cacheSize,visibleCrests};return lastSummary;
 };
 return {update,getSummary:()=>({...lastSummary}),getSelected:id=>structuredClone(layers.get(id)?.selected??null),dispose(){for(const layer of layers.values()){scene.remove(layer.object);layer.geometry.dispose();layer.material.dispose();layer.cache.clear();}}};
}
