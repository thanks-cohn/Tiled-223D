import {CHUNK_SIZE,NEAR_STEP} from './compiled.js';

// Generator yields after each row. The scheduler caps elapsed CPU work and
// publishes at most one completed buffer per animation frame.
export function* buildChunk(sampler,cx,cz){
 const step=sampler.stepAt(cx*CHUNK_SIZE,cz*CHUNK_SIZE),N=CHUNK_SIZE/step,STRIDE=N+1;
 const positions=new Float32Array(STRIDE*STRIDE*3),mask=new Uint8Array(STRIDE*STRIDE),indices=new Uint16Array(N*N*6);let count=0;const stages={samplingMs:0,triangulationMs:0};
 for(let j=0;j<=N;j++){const start=performance.now();
  for(let i=0;i<=N;i++){const k=j*STRIDE+i,x=cx*CHUNK_SIZE+i*step,z=cz*CHUNK_SIZE+j*step,s=sampler.raw(x,z);positions.set([x,s.height,z],k*3);mask[k]=s.tone;}
  stages.samplingMs+=performance.now()-start;yield;
 }
 for(let j=0;j<N;j++){const start=performance.now();
  for(let i=0;i<N;i++){const a=j*STRIDE+i,b=a+1,c=a+STRIDE,d=c+1;if(mask[a]&&mask[b]&&mask[c]){indices.set([a,c,b],count);count+=3;}if(mask[b]&&mask[c]&&mask[d]){indices.set([b,c,d],count);count+=3;}}
  stages.triangulationMs+=performance.now()-start;yield;
 }
 return {positions,indices:indices.slice(0,count),samples:STRIDE*STRIDE,step,stages};
}
export function createChunkScheduler(sampler,{maxEntries=96,budgetMs=2,onBuild=()=>{},onEvict=()=>{}}={}){
 const cache=new Map();let queue=[],job=null,hits=0,misses=0,evictions=0,builds=0,lastWorkMs=0,maxWorkMs=0;
 function request(addresses){const wanted=new Set(addresses.map(([x,z])=>`${x},${z}`));
  queue=addresses.filter(([x,z])=>!cache.has(`${x},${z}`));
  if(job&&!wanted.has(job.key))job=null;
  for(const [x,z] of addresses){const k=`${x},${z}`;if(cache.has(k)){hits++;const item=cache.get(k);cache.delete(k);cache.set(k,item);}else misses++;}
 }
 function tick(){const start=performance.now();let rows=0;
  if(!job){const next=queue.shift();if(!next){lastWorkMs=0;return;}const [x,z]=next,key=`${x},${z}`;job={key,x,z,iterator:buildChunk(sampler,x,z),workMs:0};}
  while(rows++<65&&performance.now()-start<budgetMs){const result=job.iterator.next();if(result.done){
   job.workMs+=performance.now()-start;const item={...result.value,key:job.key,x:job.x,z:job.z,buildMs:job.workMs};cache.set(job.key,item);builds++;onBuild(item);job=null;
   while(cache.size>maxEntries){const key=cache.keys().next().value;onEvict(cache.get(key));cache.delete(key);evictions++;}break;
  }}
  lastWorkMs=performance.now()-start;maxWorkMs=Math.max(maxWorkMs,lastWorkMs);if(job)job.workMs+=lastWorkMs;
 }
 return {cache,request,tick,ready:(x,z)=>cache.has(`${Math.floor(x/CHUNK_SIZE)},${Math.floor(z/CHUNK_SIZE)}`),dispose(){for(const item of cache.values())onEvict(item);cache.clear();queue=[];job=null;},snapshot:()=>({entries:cache.size,maxEntries,hits,misses,evictions,builds,queued:queue.length,pending:job?.key||null,lastWorkMs,maxWorkMs,budgetMs,geometryBytes:[...cache.values()].reduce((n,c)=>n+c.positions.byteLength+c.indices.byteLength,0)})};
}
