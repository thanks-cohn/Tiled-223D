// Coordinate contract: right-handed Three.js world (+X east, +Y up, +Z south).
// Matrices are column-major and transform column vectors: clip=P*V*M*p.
export const SPATIAL_SCHEMA_VERSION="1.0.0";
const finite=(values)=>values.every(Number.isFinite);
export function multiplyMatrixVector(m,[x,y,z,w=1]){
 if(!Array.isArray(m)&&!(m instanceof Float32Array)&&!(m instanceof Float64Array) || m.length!==16 || !finite([x,y,z,w]))
  throw Error("Invalid matrix/vector");
 return [m[0]*x+m[4]*y+m[8]*z+m[12]*w,
  m[1]*x+m[5]*y+m[9]*z+m[13]*w,
  m[2]*x+m[6]*y+m[10]*z+m[14]*w,
  m[3]*x+m[7]*y+m[11]*z+m[15]*w];
}
export function projectPoint(point,viewProjection,{left=0,top=0,width,height,dpr=1}={}){
 if(!point||!finite([point.x,point.y,point.z,width,height,dpr])||width<=0||height<=0||dpr<=0)
  throw Error("Invalid projection input");
 const clip=multiplyMatrixVector(viewProjection,[point.x,point.y,point.z,1]);
 const w=clip[3],behind=w<=0,ndc=w!==0?clip.slice(0,3).map(v=>v/w):[NaN,NaN,NaN];
 const inXY=!behind&&Math.abs(ndc[0])<=1&&Math.abs(ndc[1])<=1;
 const inDepth=!behind&&ndc[2]>=-1&&ndc[2]<=1;
 const u=(ndc[0]+1)/2,v=(1-ndc[1])/2;
 return {space:"viewport-normalized-top-left",clip:{x:clip[0],y:clip[1],z:clip[2],w},
  ndc:{x:ndc[0],y:ndc[1],z:ndc[2]},viewport:{u,v},
  cssPixels:{x:left+u*width,y:top+v*height},
  drawingBufferPixels:{x:u*width*dpr,y:v*height*dpr},
  status:behind?"behind-camera":!inDepth?"clipped-depth":!inXY?"outside-viewport":"in-frustum",
  frustumVisible:inXY&&inDepth,occlusion:"unknown"};
}
export function projectBounds(points,matrix,viewport){
 if(!Array.isArray(points)||!points.length)throw Error("Bounds require representative points");
 const samples=points.map(point=>projectPoint(point,matrix,viewport));
 const visible=samples.filter(sample=>Number.isFinite(sample.viewport.u)&&!sample.status.startsWith("behind"));
 if(!visible.length)return {approximate:true,status:"behind-camera",samples};
 return {approximate:true,status:samples.some(s=>s.frustumVisible)?"partly-in-frustum":"outside-frustum",
  viewport:{minU:Math.min(...visible.map(s=>s.viewport.u)),maxU:Math.max(...visible.map(s=>s.viewport.u)),
   minV:Math.min(...visible.map(s=>s.viewport.v)),maxV:Math.max(...visible.map(s=>s.viewport.v))},samples};
}
export function rayFromViewport(u,v,inverseViewProjection){
 if(!finite([u,v])||u<0||u>1||v<0||v>1)throw Error("Invalid viewport coordinate");
 const unproject=z=>{const p=multiplyMatrixVector(inverseViewProjection,[u*2-1,1-v*2,z,1]);
  if(Math.abs(p[3])<1e-12)throw Error("Unprojection has zero W");return {x:p[0]/p[3],y:p[1]/p[3],z:p[2]/p[3]};};
 const near=unproject(-1),far=unproject(1),length=Math.hypot(far.x-near.x,far.y-near.y,far.z-near.z);
 return {space:"authoritative-world",origin:near,direction:{x:(far.x-near.x)/length,y:(far.y-near.y)/length,z:(far.z-near.z)/length}};
}
export function curveSurfacePoint(point,{origin={x:0,z:0},strength=0,radius=475,flat=105,globe=0,globeRadius=235}){
 const dx=point.x-origin.x,dz=point.z-origin.z,d=Math.hypot(dx,dz),beyond=Math.max(0,d-flat);
 const low=strength*beyond*beyond/(2*radius),arc=Math.min(d/globeRadius,Math.PI);
 const horizontal=globeRadius*Math.sin(arc),factor=d>1e-9?horizontal/d:1;
 return {x:point.x+(origin.x+dx*factor-point.x)*globe,
  y:point.y-((1-globe)*low+globe*globeRadius*(1-Math.cos(arc))),
  z:point.z+(origin.z+dz*factor-point.z)*globe,approximate:false,
  injective:d<Math.PI*globeRadius};
}
