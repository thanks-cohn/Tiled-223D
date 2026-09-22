import * as THREE from "three";
import {cell,ID} from "./world-data.js";
// One mesh per terrain material, not one mesh or draw call per tile.
const materials=[
 new THREE.MeshLambertMaterial({color:"#65a44f",side:THREE.DoubleSide}),
 new THREE.MeshLambertMaterial({color:"#9d7654",side:THREE.DoubleSide}),
 new THREE.MeshLambertMaterial({color:"#e2cb88",side:THREE.DoubleSide}),
 new THREE.MeshLambertMaterial({color:"#806d59",side:THREE.DoubleSide})
];
export function terrainGroup(world) {
 const batches=[[],[],[],[]],root=new THREE.Group();
 const quad=(points,mat)=>{const p=batches[mat];for(const i of [0,1,2,0,2,3])p.push(...points[i]);};
 const water=new Set([ID.ocean,ID.river,ID.lake]);
 for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++){
  const c=cell(world,x,z);if(water.has(c.ground))continue;
  const y=c.height,material=c.ground===ID.sand?2:c.ground===ID.dirt?1:0;
  quad([[x,y,z],[x,y,z+1],[x+1,y,z+1],[x+1,y,z]],material);
  for(const [dx,dz,edge] of [
    [1,0,[[x+1,z+1],[x+1,z]]],[-1,0,[[x,z],[x,z+1]]],
    [0,1,[[x,z+1],[x+1,z+1]]],[0,-1,[[x+1,z],[x,z]]]
  ]){
   const neighbor=cell(world,x+dx,z+dz),nh=water.has(neighbor.ground)?0:neighbor.height;
   if(y<=nh)continue;
   quad([[edge[0][0],y,edge[0][1]],[edge[1][0],y,edge[1][1]],
    [edge[1][0],nh,edge[1][1]],[edge[0][0],nh,edge[0][1]]],3);
  }
 }
 batches.forEach((data,i)=>{
  if(!data.length)return;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(data,3));
  geo.computeVertexNormals();
  root.add(new THREE.Mesh(geo,materials[i]));
 });
 if(world.trees.length){
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.12,.85,5),new THREE.MeshLambertMaterial({color:"#81532d"}),world.trees.length);
  const canopy=new THREE.InstancedMesh(new THREE.ConeGeometry(.47,1.3,5),new THREE.MeshLambertMaterial({color:"#387945"}),world.trees.length);
  const dummy=new THREE.Object3D();
  world.trees.forEach((t,i)=>{const y=cell(world,t.x,t.z).height;
   dummy.position.set(t.x+.5,y+.43,t.z+.5);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
   dummy.position.y=y+1.35;dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);
  });trunk.instanceMatrix.needsUpdate=true;canopy.instanceMatrix.needsUpdate=true;
  root.add(trunk,canopy);
 }
 return root;
}
export function oceanPlane(){
 const ocean=new THREE.Mesh(new THREE.CircleGeometry(620,96),new THREE.MeshBasicMaterial({color:"#19598d",side:THREE.DoubleSide}));
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
