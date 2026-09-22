import {ID} from "./world-data.js";

const WATER=new Set([ID.ocean,ID.river,ID.lake]);

// Find connected land masses once per map change, not on every frame.
// A region gets ONE visual instance at its nearest wrapped coordinate, so
// increasing view distance cannot make two islands look like forty islands.
export function landmasses(world) {
 const {width:w,height:h,ground}=world;
 const seen=new Uint8Array(w*h);
 const regions=[];
 for(let start=0;start<ground.length;start++) {
  if(seen[start]||WATER.has(ground[start]))continue;
  const cells=[],queue=[start];
  seen[start]=1;
  let sumX=0,sumZ=0,loX=w,hiX=0,loZ=h,hiZ=0;
  for(let head=0;head<queue.length;head++) {
   const i=queue[head],x=i%w,z=Math.floor(i/w);
   cells.push(i);sumX+=x+.5;sumZ+=z+.5;
   loX=Math.min(loX,x);hiX=Math.max(hiX,x+1);
   loZ=Math.min(loZ,z);hiZ=Math.max(hiZ,z+1);
   for(const [nx,nz] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]) {
    if(nx<0||nz<0||nx>=w||nz>=h)continue;
    const next=nz*w+nx;
    if(!seen[next]&&!WATER.has(ground[next])){seen[next]=1;queue.push(next);}
   }
  }
  regions.push({id:"landmass:"+regions.length,cells,centerX:sumX/cells.length,
   centerZ:sumZ/cells.length,bounds:[loX,loZ,hiX,hiZ]});
 }
 return regions;
}
export function nearestWrappedOffset(position,center,size) {
 if(!Number.isFinite(position)||!Number.isFinite(center)||!Number.isFinite(size)||size<=0)
  throw Error("Invalid wrapped position or size");
 const turns=Math.round((position-center)/size);
 return turns===0?0:turns*size; // avoid negative zero at the central copy
}
