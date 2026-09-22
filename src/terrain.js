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
 const canvas=document.createElement("canvas");canvas.width=128;canvas.height=64;
 const g=canvas.getContext("2d");g.fillStyle="rgba(255,255,255,0.82)";
 for(const [x,y,r] of [[33,38,18],[55,28,23],[80,35,19],[102,42,12]]){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}
 const texture=new THREE.CanvasTexture(canvas),sprites=[];
 for(let i=0;i<14;i++){
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.68,depthWrite:false,fog:false}));
  sprite.scale.set(27+(i%4)*10,12+(i%3)*4,1);scene.add(sprite);sprites.push(sprite);
 }
 return {update(x,z,time){sprites.forEach((s,i)=>{const a=i*2.39996,r=115+(i%5)*34;
  s.position.set(x+Math.cos(a)*r+Math.sin(time*.014+i)*5,30+(i%4)*24,z+Math.sin(a)*r);
 });}};
}
