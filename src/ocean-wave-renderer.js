import * as THREE from "three";
import {curveMaterial} from "./horizon.js";
import {OCEAN_FAMILY_IDS} from "./ocean-visual-presets.js";
import {sampleWaveGroup} from "./ocean-wave-field.js";

// One pooled ribbon draw per family. Tonal families are real, tapered surface
// areas rather than repainted one-pixel lines; no second sea or screen blur.
const FAMILY_LAYOUT={"near-crest":[5,4],"middle-swell":[4,3],"broad-band":[3,3],"planetary-contour":[3,2]},SEGMENTS=12,MAX_FRAGMENTS=4,VERTICES_PER_SEGMENT=6;
export function createOceanWaveRenderer(scene,horizonState,preset){
 const layers=new Map();let lastSummary={drawCalls:0,vertices:0,cacheSize:0,visibleCrests:0,capacityVertices:0};
 for(const id of OCEAN_FAMILY_IDS){const [cols,rows]=FAMILY_LAYOUT[id],count=cols*rows,capacity=count*MAX_FRAGMENTS*SEGMENTS*VERTICES_PER_SEGMENT,positions=new Float32Array(capacity*3);positions.fill(-10000);const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));const material=curveMaterial(new THREE.MeshBasicMaterial({color:preset.families[id].color,transparent:true,opacity:0,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false,fog:false}),horizonState);const object=new THREE.Mesh(geometry,material);object.name=`ocean-ribbon-family:${id}`;object.frustumCulled=false;object.renderOrder=1;scene.add(object);layers.set(id,{id,cols,rows,count,capacity,positions,geometry,material,object,cache:new Map(),signature:"",selected:null});}
 const hide=(array,vertex)=>{const n=vertex*3;array[n]=array[n+1]=array[n+2]=-10000;};
 const update=({ship,origin,world,mood,worldScale,lineHeight,preset:activePreset})=>{
  let vertices=0,drawCalls=0,cacheSize=0,visibleCrests=0,capacityVertices=0;
  for(const id of OCEAN_FAMILY_IDS){const layer=layers.get(id),family=activePreset.families[id],style=mood.families[id],visible=family.enabled&&style.weight>.012&&style.opacity>.001;layer.object.visible=visible;capacityVertices+=layer.capacity;if(!visible)continue;drawCalls++;layer.material.opacity=style.opacity*style.weight;layer.material.color.set(family.color);const grid=style.worldGrid,signature=[world.width,world.height,activePreset.seed,grid,family.length,family.curvature,family.fragments,family.width,family.taper,family.gapRhythm].join(":");if(signature!==layer.signature){layer.cache.clear();layer.signature=signature;}const gx=Math.floor(ship.x/grid),gz=Math.floor(ship.z/grid);layer.selected=null;let cursor=0;
   for(let i=0;i<layer.count;i++){if(i>=Math.ceil(layer.count*family.density*activePreset.budget.qualityScale))continue;const cx=gx+(i%layer.cols)-Math.floor(layer.cols/2),cz=gz+Math.floor(i/layer.cols)-Math.floor(layer.rows/2),key=`${cx}:${cz}`;let group=layer.cache.get(key);if(!group){group=sampleWaveGroup({...family,grid},cx,cz,{worldWidth:world.width,worldHeight:world.height,seed:activePreset.seed,worldScale});if(layer.cache.size>=activePreset.budget.cacheEntries)layer.cache.clear();layer.cache.set(key,group);}if(!layer.selected)layer.selected=group;let accepted=0;
    for(const band of group.bands)for(let s=0;s<band.length-1;s++){const a=band[s],b=band[s+1],ocean=world.isOcean((a.x+b.x)/2,(a.z+b.z)/2),withinBudget=vertices+6<=activePreset.budget.maxVertices&&visibleCrests<activePreset.budget.maxCrests;if(!a.visible||!b.visible||!ocean||!withinBudget){for(let n=0;n<VERTICES_PER_SEGMENT;n++)hide(layer.positions,cursor++);continue;}const dx=b.x-a.x,dz=b.z-a.z,inv=1/(Math.hypot(dx,dz)||1),nx=-dz*inv,nz=dx*inv,wa=style.worldWidth*(.18+.82*a.taper),wb=style.worldWidth*(.18+.82*b.taper),quad=[[a,-wa],[a,wa],[b,wb],[a,-wa],[b,wb],[b,-wb]];for(const [point,width] of quad){const n=cursor++*3;layer.positions[n]=point.x+nx*width-origin.x;layer.positions[n+1]=lineHeight+(family.mode==="tonal"?.015:.05);layer.positions[n+2]=point.z+nz*width-origin.z;}accepted++;vertices+=6;}if(accepted)visibleCrests++;
   }
   for(;cursor<layer.capacity;cursor++)hide(layer.positions,cursor);layer.geometry.attributes.position.needsUpdate=true;layer.geometry.setDrawRange(0,layer.capacity);cacheSize+=layer.cache.size;
  }
  lastSummary={drawCalls,vertices,cacheSize,visibleCrests,capacityVertices};return lastSummary;
 };
 return {update,getSummary:()=>({...lastSummary}),getSelected:id=>structuredClone(layers.get(id)?.selected??null),dispose(){for(const layer of layers.values()){scene.remove(layer.object);layer.geometry.dispose();layer.material.dispose();layer.cache.clear();}}};
}
