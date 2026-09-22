export const SIZE = 500;
export const ID = Object.freeze({grass:1,dirt:2,sand:3,ocean:4,river:5,lake:6,tree:7});
export const wrap=(v,n)=>((v%n)+n)%n;
const at=(w,x,z)=>z*w.width+x;
function world(width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1000||height>1000)throw Error("Invalid map dimensions.");
 return {width,height,ground:new Uint8Array(width*height).fill(ID.ocean),heights:new Float64Array(width*height),trees:[],spawns:[],name:"Toon World"};
}
const peak=(x,z,cx,cz,rx,rz,h)=>h*Math.exp(-1.7*(((x-cx)/rx)**2+((z-cz)/rz)**2));
function island(w,cx,cz,rx,rz,seed){
 for(let z=Math.floor(cz-rz-2);z<=Math.ceil(cz+rz+2);z++)for(let x=Math.floor(cx-rx-2);x<=Math.ceil(cx+rx+2);x++){
  if(x<1||z<1||x>=w.width-1||z>=w.height-1)continue;
  const r=Math.hypot((x-cx)/rx,(z-cz)/rz)*(1+.035*Math.sin(x*.37+seed)+.035*Math.cos(z*.44-seed));
  if(r>=1)continue;
  const beach=r>.78,i=at(w,x,z);
  w.ground[i]=beach?ID.sand:ID.grass;
  w.heights[i]=beach?Math.max(1,Math.round(3*(1-r))):
   Math.round(5+15*(1-r)+peak(x,z,cx-5,cz-5,5,6,110)+peak(x,z,cx+6,cz+2,6,5,75)+peak(x,z,cx,cz+8,8,3,50));
 }
 const coast=[];
 for(let z=Math.floor(cz-rz-2);z<=Math.ceil(cz+rz+2);z++)for(let x=Math.floor(cx-rx-2);x<=Math.ceil(cx+rx+2);x++){
  if(x<1||z<1||x>=w.width-1||z>=w.height-1)continue;
  const i=at(w,x,z);if(w.ground[i]===ID.ocean)continue;
  if(w.ground[i-1]===ID.ocean||w.ground[i+1]===ID.ocean||w.ground[i-w.width]===ID.ocean||w.ground[i+w.width]===ID.ocean)coast.push(i);
 }
 for(const i of coast){w.ground[i]=ID.sand;w.heights[i]=Math.min(3,w.heights[i]);}
}
export function sampleWorld(){
 const w=world(SIZE,SIZE);w.name="Two Islands";
 island(w,145,235,25,24,1);island(w,345,270,24,25,3);
 w.spawns=[{id:"West",x:145.5,z:250.5},{id:"East",x:345.5,z:285.5}];return w;
}
export function cell(w,x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))throw Error("Invalid coordinate.");
 const i=at(w,Math.floor(wrap(x,w.width)),Math.floor(wrap(z,w.height)));
 return {ground:w.ground[i],height:w.heights[i]};
}
export function fromTiled(map,elev=null){
 if(map?.orientation!=="orthogonal")throw Error("Use an orthogonal Tiled JSON map.");
 const w=world(map.width,map.height);
 const ground=map.layers?.find(l=>l.type==="tilelayer"&&l.name==="Ground");
 if(!ground||!Array.isArray(ground.data)||ground.data.length!==w.ground.length)throw Error("Ground layer missing or invalid.");
 ground.data.forEach((v,i)=>{const id=(v>>>0)&0x1fffffff;if(!Number.isInteger(v)||id<1||id>6)throw Error("Unsupported ground tile at "+i);w.ground[i]=id;});
 const trees=map.layers.find(l=>l.type==="tilelayer"&&l.name==="Structures");
 if(trees){if(!Array.isArray(trees.data)||trees.data.length!==w.ground.length)throw Error("Invalid Structures layer.");trees.data.forEach((v,i)=>{if(((v>>>0)&0x1fffffff)===7)w.trees.push({x:i%w.width,z:Math.floor(i/w.width)});});}
 if(elev){
  const vals=Array.isArray(elev.values?.[0])?elev.values.flat():elev.values;
  if(elev.width!==w.width||elev.height!==w.height||!Array.isArray(vals)||vals.length!==w.heights.length)throw Error("Elevation grid does not match map.");
  vals.forEach((v,i)=>{if(!Number.isFinite(v)||Math.abs(v)>1e9)throw Error("Invalid elevation at "+i);w.heights[i]=v;});
 }
 const spawns=map.layers.find(l=>l.type==="objectgroup"&&l.name==="Spawns");
 w.spawns=(spawns?.objects||[]).filter(o=>o.type==="landing"||o.name?.startsWith("LandingPoint")).map(o=>({id:o.name,x:o.x/map.tilewidth,z:o.y/map.tileheight}));
 if(!w.spawns.length)w.spawns=[{id:"center",x:w.width/2,z:w.height/2}];
 w.name="Imported Tiled World";return w;
}
