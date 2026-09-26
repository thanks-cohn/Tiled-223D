import * as THREE from 'three';
import {curveMaterial} from './horizon.js';
import {CHUNK_SIZE} from './dirt/compiled.js';
import {createChunkScheduler} from './dirt/chunks.js';

const RADIUS=4,SIDE=RADIUS*2+1;
export function createExpansiveDirtRenderer(scene,horizonState,diagnostics=null){
 let world=null,scheduler=null,far=null,nearMaterial=null,farMaterial=null,atlas=null,overviewAtlas=null,coverage=null;
 let centerX=NaN,centerZ=NaN,overview=false,prefetch=null;
 const origin={value:new THREE.Vector2()},offset={value:new THREE.Vector2()},chartSize={value:new THREE.Vector2()},coverageOrigin={value:new THREE.Vector2()},useCoverage={value:0};
 const meshes=new Map();
 function texture(bytes,w,h){const t=new THREE.DataTexture(bytes,w,h,THREE.RedFormat);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;}
 function material(isNear){
  const m=curveMaterial(new THREE.MeshBasicMaterial({side:THREE.DoubleSide,fog:false}),horizonState),curve=m.onBeforeCompile;
  const palette=world.compiled.source.metadata.palette.map(hex=>new THREE.Color(hex));
  m.onBeforeCompile=shader=>{curve(shader);Object.assign(shader.uniforms,{dirtAtlas:{value:atlas},dirtPalette:{value:palette},dirtChart:chartSize,dirtOffset:isNear?{value:new THREE.Vector2()}:offset,dirtCoverage:{value:coverage},dirtCoverageOrigin:coverageOrigin,dirtUseCoverage:useCoverage});
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 dirtPoint; uniform vec2 dirtOffset;').replace('#include <begin_vertex>','#include <begin_vertex>\ndirtPoint = position.xz + dirtOffset;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying vec2 dirtPoint; uniform sampler2D dirtAtlas; uniform vec3 dirtPalette[3]; uniform vec2 dirtChart;
 uniform sampler2D dirtCoverage; uniform vec2 dirtCoverageOrigin; uniform float dirtUseCoverage;`)
    .replace('#include <color_fragment>',`#include <color_fragment>
 float tone=floor(texture2D(dirtAtlas,fract(dirtPoint/dirtChart)).r*255.0+0.5);
 ${isNear?'tone=max(1.0,tone);':`if(tone<0.5) discard;
 vec2 cover=(dirtPoint-dirtCoverageOrigin)/${SIDE*CHUNK_SIZE}.0;
 if(dirtUseCoverage>0.5 && all(greaterThanEqual(cover,vec2(0.0))) && all(lessThan(cover,vec2(1.0))) && texture2D(dirtCoverage,cover).r>0.5) discard;`}
 diffuseColor.rgb= tone<1.5?dirtPalette[0]:(tone<2.5?dirtPalette[1]:dirtPalette[2]);`);
   m.userData.shader=shader;
  };m.customProgramCacheKey=()=>`compiled-dirt-${isNear?'near':'far'}-v1`;return m;
 }
 function clear(){scheduler?.dispose();scheduler=null;if(far){scene.remove(far);far.geometry.dispose();far=null;}nearMaterial?.dispose();farMaterial?.dispose();atlas?.dispose();overviewAtlas?.dispose();coverage?.dispose();meshes.clear();}
 function farGeometry(){const {profile,far:data}=world.compiled.asset,size=profile.size,width=profile.experienceWidth,positions=new Float32Array(65*65*3),indices=[];
  for(let z=0;z<=64;z++)for(let x=0;x<=64;x++){const k=z*65+x;positions.set([x/64*width,data[k*2+1],z/64*size],k*3);}
  for(let z=0;z<64;z++)for(let x=0;x<64;x++){const a=z*65+x;indices.push(a,a+65,a+1,a+1,a+65,a+66);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(indices);return g;
 }
 function rebuild(next){clear();world=next;centerX=centerZ=NaN;overview=false;prefetch=null;
  if(!world.compiled||!world.expansiveDirt?.rules.enabled){diagnostics?.event('compiled-terrain-unavailable',{reason:'No compatible compiled asset; no synchronous fallback'});return;}
  const start=performance.now(),{source,asset}=world.compiled;
  atlas=texture(asset.atlas,500,500);overviewAtlas=texture(asset.overviewAtlas,500,500);coverage=texture(new Uint8Array(SIDE*SIDE),SIDE,SIDE);
  chartSize.value.set(asset.profile.experienceWidth,asset.profile.size);nearMaterial=material(true);farMaterial=material(false);
  far=new THREE.Mesh(farGeometry(),farMaterial);far.frustumCulled=false;scene.add(far);
  scheduler=createChunkScheduler(world.sampleExpansiveDirt,{onBuild(item){
   const start=performance.now(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(item.positions,3));g.setIndex(new THREE.BufferAttribute(item.indices,1));
   const mesh=new THREE.Mesh(g,nearMaterial);mesh.frustumCulled=false;meshes.set(item.key,mesh);scene.add(mesh);
   diagnostics?.meshBuild({level:'near-chunk',ms:item.buildMs,stages:item.stages,samples:item.samples,vertices:item.samples,triangles:item.indices.length/3,coordinate:{x:item.x*CHUNK_SIZE,z:item.z*CHUNK_SIZE}});
   diagnostics?.event('geometry-publish',{ms:performance.now()-start,bytes:item.positions.byteLength+item.indices.byteLength,chunk:item.key,gpuMs:null});
  },onEvict(item){const mesh=meshes.get(item.key);if(mesh){scene.remove(mesh);mesh.geometry.dispose();meshes.delete(item.key);}}});
  diagnostics?.event('compiled-asset-select',{worldId:asset.profile.worldId,key:asset.profile.key,ms:performance.now()-start,farVertices:65*65});
 }
 function requestAt(x,z){const cx=Math.floor(x/CHUNK_SIZE),cz=Math.floor(z/CHUNK_SIZE);if(cx===centerX&&cz===centerZ&&!prefetch)return;
  centerX=cx;centerZ=cz;let list=[];for(let dz=-RADIUS;dz<=RADIUS;dz++)for(let dx=-RADIUS;dx<=RADIUS;dx++)list.push([cx+dx,cz+dz]);
  list.sort((a,b)=>Math.hypot(a[0]-cx,a[1]-cz)-Math.hypot(b[0]-cx,b[1]-cz));
  if(prefetch){const px=Math.floor(prefetch.x/CHUNK_SIZE),pz=Math.floor(prefetch.z/CHUNK_SIZE),steps=Math.max(Math.abs(px-cx),Math.abs(pz-cz));const corridor=[];
   for(let i=1;i<=Math.min(steps,4);i++){const p=[Math.round(cx+(px-cx)*i/steps),Math.round(cz+(pz-cz)*i/steps)];if(!corridor.some(([x,z])=>x===p[0]&&z===p[1]))corridor.push(p);}
   list=list.filter(([x,z])=>!corridor.some(([a,b])=>a===x&&b===z));list.splice(1,0,...corridor);prefetch=null;}
  scheduler.request(list);
 }
 function update(pilot){if(!scheduler)return;const {profile,data}=world.compiled.asset,{size,experienceWidth:width}=profile;
  const active=pilot.y-world.groundAt(pilot.x,pilot.z).height<250;
  const nextOverview=!active;if(nextOverview!==overview){overview=nextOverview;
   // A geographic overview is explicitly non-collision-ready. Returning low
   // switches to the same experience chart used by contact and near chunks.
   const a=far.geometry.attributes.position;for(let k=0;k<a.count;k++)a.setY(k,world.compiled.asset.far[k*2+(overview?0:1)]);a.needsUpdate=true;
   if(farMaterial.userData.shader)farMaterial.userData.shader.uniforms.dirtAtlas.value=overview?overviewAtlas:atlas;
  }
  const ox=Math.round((pilot.x-width/2)/width)*width,oz=Math.round((pilot.z-size/2)/size)*size;offset.value.set(ox,oz);far.position.set(ox-pilot.x,0,oz-pilot.z);
  if(active){requestAt(pilot.x,pilot.z);const started=performance.now();scheduler.tick();diagnostics?.event("terrain-work-slice",{ms:performance.now()-started,budgetMs:2});}
  const bytes=coverage.image.data;bytes.fill(0);coverageOrigin.value.set((centerX-RADIUS)*CHUNK_SIZE,(centerZ-RADIUS)*CHUNK_SIZE);useCoverage.value=active?1:0;
  for(const [key,mesh] of meshes){const item=scheduler.cache.get(key),dx=item.x-centerX,dz=item.z-centerZ;mesh.visible=active&&Math.abs(dx)<=RADIUS&&Math.abs(dz)<=RADIUS;mesh.position.set(-pilot.x,0,-pilot.z);if(mesh.visible)bytes[(dz+RADIUS)*SIDE+dx+RADIUS]=255;}
  coverage.needsUpdate=active;
 }
 function readyAt(x,z){if(!scheduler||world.sampleExpansiveDirt(x,z)?.ground!==2)return true;return scheduler.ready(x,z);}
 return {rebuild,update,dispose:clear,readyAt,prefetch(x,z){prefetch={x,z};},snapshot:()=>({available:!!scheduler,assetId:world?.compiled?.asset.profile.key,overview,cache:scheduler?.snapshot()||null,gpuTimings:'unavailable'})};
}
