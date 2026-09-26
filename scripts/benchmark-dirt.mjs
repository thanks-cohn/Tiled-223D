import os from 'node:os';
import * as THREE from 'three';
import {openCompiledAssets} from '../src/dirt/asset-loader.js';
import {fileFetch} from './dirt-compiled-storage.mjs';
import {createCompiledSampler} from '../src/dirt/compiled.js';
import {makeScaleWorld} from '../src/scale-world.js';
import {sampleWorld} from '../src/world-data.js';
import {validateExpansiveDirt} from '../src/expansive-dirt-land.js';
import {makeHorizonState} from '../src/horizon.js';
import {createExpansiveDirtRenderer} from '../src/expansive-dirt-renderer.js';
import {createDirtPerformanceDiagnostics} from '../src/dirt/performance-diagnostics.js';
const start=performance.now(),store=await openCompiledAssets('public/dirt/compiled-v1',fileFetch),reports=[];
for(const worldId of ['current','bigger','massive']){
 const asset=await store.load(worldId),sampler=createCompiledSampler(store.source,asset.profile),world=makeScaleWorld(sampleWorld(),worldId,validateExpansiveDirt(),{mode:'inherit-world'},{source:store.source,asset}),scene=new THREE.Scene(),diagnostics=createDirtPerformanceDiagnostics(),renderer=createExpansiveDirtRenderer(scene,makeHorizonState(),diagnostics);
 const selected=performance.now();renderer.rebuild(world);const selectMs=performance.now()-selected;
 const samplePassMs=[];for(let run=0;run<3;run++){const t=performance.now();for(let j=0;j<97;j++)for(let i=0;i<97;i++)sampler(asset.profile.size/2+i*4,asset.profile.size/2+j*4);samplePassMs.push(performance.now()-t);}
 const f=asset.profile.features[0],updates=[];let readinessMisses=0,maxAnalyticError=0;
 // 30 seconds of simulated 60 Hz motion at 120 units/second, reversal at 15s.
 // No sleeping: these are CPU workload measurements, not observed RAF/FPS.
 for(let frame=0;frame<1800;frame++){
  const distance=frame<900?frame*2:(1800-frame)*2,x=f.x+distance,z=f.z+Math.sin(frame/120)*12,y=sampler(x,z).height+10;
  const t=performance.now();renderer.prefetch(x+(frame<900?1:-1)*32,z);renderer.update({x,z,y});updates.push(performance.now()-t);if(!renderer.readyAt(x,z))readinessMisses++;
 }
 for(const feature of asset.profile.features)for(let iz=0;iz<25;iz++)for(let ix=0;ix<49;ix++){
  const {geometry:g}=feature,dx=(ix/48-.5)*(feature.orientation==='x'?g.length:g.width),dz=(iz/24-.5)*(feature.orientation==='x'?g.width:g.length),x=feature.x+dx,z=feature.z+dz,physical=sampler(x,z),raw=sampler.raw(x,z);if(physical.ground===2&&raw.ground===2)maxAnalyticError=Math.max(maxAnalyticError,Math.abs(physical.height-raw.height));
 }
 const sorted=[...updates].sort((a,b)=>a-b);reports.push({worldId,selectMs,sample9409PassMs:samplePassMs,simulation:{steps:1800,virtualSeconds:30,speed:120,reversalAtSeconds:15},cpuUpdate:{averageMs:updates.reduce((a,b)=>a+b,0)/updates.length,p99Ms:sorted[Math.floor(sorted.length*.99)],maxMs:Math.max(...updates),over16_7ms:updates.filter(x=>x>16.7).length,over1000ms:updates.filter(x=>x>=1000).length},readinessMisses,maxAnalyticError,renderer:renderer.snapshot(),terrain:diagnostics.snapshot().terrain});renderer.dispose();
}
console.log(JSON.stringify({method:'Node CPU workload; no WebGL, RAF, GPU, target-device or FPS claim',node:process.version,platform:process.platform,cpu:os.cpus()[0].model,elapsedMs:performance.now()-start,assetBytes:Object.values(store.manifest.files).reduce((n,f)=>n+f.bytes,0),reports},null,2));
