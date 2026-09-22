import * as THREE from "three";
import {cell,ID} from "./world-data.js";
import {landmasses} from "./landmasses.js";
// One mesh per terrain material, not one mesh or draw call per tile.
const materials=[
 new THREE.MeshLambertMaterial({color:"#65a44f",side:THREE.DoubleSide}),
 new THREE.MeshLambertMaterial({color:"#9d7654",side:THREE.DoubleSide}),
 new THREE.MeshLambertMaterial({color:"#e2cb88",side:THREE.DoubleSide}),
 new THREE.MeshLambertMaterial({color:"#806d59",side:THREE.DoubleSide})
];
export function terrainGroup(world) {
 const root=new THREE.Group();
 const regions=landmasses(world);
 // A single group per connected island: NEVER nine copies of each region.
 // Adjacent height samples share vertex elevations, so no detached tile spikes.
 const water=new Set([ID.ocean,ID.river,ID.lake]);
 const vertexHeight=(x,z)=>{
  let sum=0;
  for(const dx of [-1,0])for(const dz of [-1,0]){
   const c=cell(world,x+dx,z+dz);
   if(!water.has(c.ground))sum+=c.height;
  }
  return sum/4;
 };
 const regionOfCell=new Int32Array(world.width*world.height);
 regions.forEach((region,i)=>region.cells.forEach(index=>{regionOfCell[index]=i+1;}));
 const treesByRegion=regions.map(()=>[]);
 for(const tree of world.trees||[]){
  const x=Math.floor(tree.x),z=Math.floor(tree.z);
  if(x<0||z<0||x>=world.width||z>=world.height)continue;
  const index=regionOfCell[z*world.width+x]-1;
  if(index>=0)treesByRegion[index].push(tree);
 }
 regions.forEach((region,i)=>{
  const rootForIsland=new THREE.Group();
  rootForIsland.name=region.id;
  rootForIsland.userData={centerX:region.centerX,centerZ:region.centerZ,
   cellCount:region.cells.length};
  const batches=[[],[],[],[]];
  const quad=(points,material)=>{
   const out=batches[material];for(const k of [0,1,2,0,2,3])out.push(...points[k]);
  };
  for(const index of region.cells){
   const x=index%world.width,z=Math.floor(index/world.width);
   const c=cell(world,x,z);
   const material=c.ground===ID.sand?2:c.ground===ID.dirt?1:0;
   const h00=vertexHeight(x,z),h01=vertexHeight(x,z+1);
   const h11=vertexHeight(x+1,z+1),h10=vertexHeight(x+1,z);
   quad([[x,h00,z],[x,h01,z+1],[x+1,h11,z+1],[x+1,h10,z]],material);
  }
  batches.forEach((data,material)=>{
   if(!data.length)return;
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute("position",new THREE.Float32BufferAttribute(data,3));
   geometry.computeVertexNormals();
   rootForIsland.add(new THREE.Mesh(geometry,materials[material]));
  });
  const trees=treesByRegion[i];
  if(trees.length){
   const trunks=new THREE.InstancedMesh(
    new THREE.CylinderGeometry(.09,.12,.85,5),
    new THREE.MeshLambertMaterial({color:"#81532d"}),trees.length);
   const crowns=new THREE.InstancedMesh(
    new THREE.ConeGeometry(.47,1.3,5),
    new THREE.MeshLambertMaterial({color:"#387945"}),trees.length);
   const dummy=new THREE.Object3D();
   trees.forEach((tree,index)=>{
    const elevation=cell(world,tree.x,tree.z).height;
    dummy.position.set(tree.x+.5,elevation+.43,tree.z+.5);
    dummy.updateMatrix();trunks.setMatrixAt(index,dummy.matrix);
    dummy.position.y=elevation+1.35;
    dummy.updateMatrix();crowns.setMatrixAt(index,dummy.matrix);
   });
   trunks.instanceMatrix.needsUpdate=true;crowns.instanceMatrix.needsUpdate=true;
   rootForIsland.add(trunks,crowns);
  }
  root.add(rootForIsland);
 });
 return root;
}
export function oceanPlane(){
 // A camera-centered ocean plane extends beyond the camera far clip. A small
 // circular disk exposes a curved edge, which looked like floating islands.
 const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshBasicMaterial({color:"#19598d",side:THREE.DoubleSide,depthWrite:true,fog:false}));
 ocean.rotation.x=-Math.PI/2;ocean.position.y=-.35;return ocean;
}
export function clouds(scene){
 // ONE small reusable texture for both horizon decoration and reachable clouds.
 // Soft alpha (rather than opaque white circles) makes the nearby layers dreamy.
 const canvas=document.createElement("canvas");
 canvas.width=128;canvas.height=64;
 const ctx=canvas.getContext("2d");
 for(const [x,y,rx,ry] of [[27,39,25,18],[48,27,29,23],[76,34,28,20],[99,42,20,15]]) {
  ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
  const glow=ctx.createRadialGradient(0,0,.12,0,0,1);
  glow.addColorStop(0,"rgba(255,255,255,.77)");
  glow.addColorStop(.60,"rgba(252,254,255,.49)");
  glow.addColorStop(1,"rgba(250,253,255,0)");
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.minFilter=THREE.LinearFilter;
 texture.magFilter=THREE.LinearFilter;
 const makeSprite=(opacity,width,height)=>{
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
   map:texture,transparent:true,opacity,depthWrite:false,depthTest:true,
   fog:false,rotation:0
  }));
  sprite.scale.set(width,height,1);scene.add(sprite);return sprite;
 };
 // Far/background decoration: intentionally unreachable. All these sprites
 // stay hundreds of units away, following the camera like the sky dome.
 const distant=Array.from({length:10},(_,i)=>makeSprite(.41,66+(i%4)*20,21+(i%3)*7));
 // Exactly four world-anchored cloud formations with three layered sprites each.
 // They do NOT follow the ship; you can actually fly into and through them.
 const reachable=Array.from({length:4},()=>Array.from({length:3},(_,j)=>
  makeSprite(j===1?.42:.30,32+j*10,12+j*3)));
 const bases=[
  [.29,.405,92,17],[.245,.55,111,15],
  [.69,.44,101,18],[.745,.57,125,15]
 ];
 const cloudFog=new THREE.FogExp2("#eaf3f7",.033);
 let inside=false;
 return {
  update(ship,world,time){
   const altitudeFade=THREE.MathUtils.clamp((310-ship.y)/90,0,1);
   distant.forEach((sprite,i)=>{
    const angle=i*2.399963,radius=525+(i%4)*64;
    sprite.position.set(ship.x+Math.cos(angle)*radius,
      ship.y+67+(i%4)*34,ship.z+Math.sin(angle)*radius);
    sprite.material.opacity=altitudeFade*.41;
    sprite.visible=altitudeFade>.001;
   });
   let inAny=false;
   reachable.forEach((layers,i)=>{
    const [fx,fz,y,radius]=bases[i];
    const logicalX=world.width*fx,logicalZ=world.height*fz;
    const x=logicalX+Math.round((ship.x-logicalX)/world.width)*world.width;
    const z=logicalZ+Math.round((ship.z-logicalZ)/world.height)*world.height;
    const drift=Math.sin(time*.11+i)*1.8;
    layers.forEach((sprite,j)=>{
     const dx=[-7,1,8][j],dz=[3,-2,-1][j];
     sprite.position.set(x+dx+drift,y+(j-1)*2,z+dz);
     sprite.material.opacity=altitudeFade*(j===1?.44:.31);
     sprite.visible=altitudeFade>.001 &&
       Math.hypot(sprite.position.x-ship.x,sprite.position.z-ship.z)<420;
    });
    if(Math.hypot(ship.x-x-drift,ship.z-z)<radius && Math.abs(ship.y-y)<11)
     inAny=true;
   });
   inside=inAny && altitudeFade>.001;
   // Passing THROUGH a fixed cloud gives a soft haze without a solid collider,
   // full-screen video effect, or CPU-heavy particle/volumetric simulation.
   scene.fog=inside?cloudFog:null;
   return {inside};
  },
  dispose(){
   for(const sprite of [...distant,...reachable.flat()]) {
    scene.remove(sprite);sprite.material.dispose();
   }
   texture.dispose();
  }
 };
}
