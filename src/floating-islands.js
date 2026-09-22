import * as THREE from "three";
import {validateIslands} from "./spatial.js";

// One semantic object -> one parent Group. Parts stay local to the object;
// moving the parent updates stone, clay, dirt, grass and openings together.
const COLORS=Object.freeze({stone:"#7b7775",clay:"#ae8065",dirt:"#805b3d",grass:"#75b660",sand:"#e1c987"});
function ellipsePoints(rx,rz,segments,centerX=0,centerZ=0,reverse=false) {
 const result=[];
 for(let i=0;i<segments;i++){
  const t=(reverse?-1:1)*i*Math.PI*2/segments;
  result.push(new THREE.Vector2(centerX+rx*Math.cos(t),-(centerZ+rz*Math.sin(t))));
 }
 return result;
}
function sectionShape(part) {
 const [rx,rz]=part.footprint.radii,segments=Math.max(12,Math.min(48,part.footprint.segments||24));
 const shape=new THREE.Shape(ellipsePoints(rx,rz,segments));
 for(const opening of part.openings||[]){
  const [hrx,hrz]=opening.radii;
  const hole=new THREE.Path(ellipsePoints(hrx,hrz,Math.min(24,segments),opening.at[0],opening.at[1],true));
  shape.holes.push(hole);
 }
 return shape;
}
export function buildFloatingIslands(objects,clusterId) {
 validateIslands(objects,clusterId);
 return objects.map(object=>{
  const group=new THREE.Group();
  group.name=object.id;group.userData={objectId:object.id,parent:object.parent,type:object.type};
  for(const part of object.parts) {
   const [bottom,top]=part.height,shape=sectionShape(part);
   const geometry=new THREE.ExtrudeGeometry(shape,{
    depth:top-bottom,steps:1,bevelEnabled:false,curveSegments:3
   });
   // Extrude from XY into +Z, then rotate to world XZ with extrusion along +Y.
   geometry.rotateX(-Math.PI/2);
   geometry.translate(0,bottom,0);
   const mesh=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({
    color:COLORS[part.material]||"#999999",
    side:THREE.DoubleSide,
    flatShading:true
   }));
   mesh.name=part.id;mesh.userData={partId:part.id,parent:part.parent,material:part.material};
   group.add(mesh);
  }
  group.position.set(...object.at);
  return {object,group};
 });
}
export function disposeFloatingIslands(instances) {
 for(const {group} of instances)group.traverse(node=>{
  if(node.isMesh){node.geometry.dispose();node.material.dispose();}
 });
}
