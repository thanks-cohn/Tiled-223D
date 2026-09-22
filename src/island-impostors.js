import * as THREE from "three";

// The card is generated ONCE from each island's authoritative material
// footprints and height ranges. No runtime screenshot, ML, or extra model.
const PALETTE=Object.freeze({
 grass:["#83c46d","#548c53"],dirt:["#a4744f","#634638"],
 clay:["#c18f79","#855b55"],stone:["#a4a4a8","#696c78"],
 sand:["#eed79c","#ac9162"]
});
export function islandDistanceBands(distance) {
 const smooth=(low,high)=>{const t=THREE.MathUtils.clamp((distance-low)/(high-low),0,1);return t*t*(3-2*t);};
 const toCard=smooth(98,137),toSilhouette=smooth(222,280);
 return {
  mesh:1-toCard,
  mid:toCard*(1-toSilhouette)*.96,
  far:toCard*toSilhouette*.88
 };
}
function graphic(object,style) {
 const SIZE=160,canvas=document.createElement("canvas");
 canvas.width=SIZE;canvas.height=SIZE;
 const g=canvas.getContext("2d");
 const parts=[...object.parts].sort((a,b)=>a.height[0]-b.height[0]);
 const maxRadius=Math.max(...parts.map(p=>Math.max(...p.footprint.radii)));
 const bottom=Math.min(...parts.map(p=>p.height[0]));
 const top=Math.max(...parts.map(p=>p.height[1]));
 const height=Math.max(1,top-bottom),sx=Math.min(5.4,65/maxRadius),sy=Math.min(4.8,95/height);
 const centerX=SIZE/2,base=SIZE-20;
 const isFar=style==="far";
 g.clearRect(0,0,SIZE,SIZE);
 // Every band is derived from the same named radii, material and Y intervals
 // used to make the physical model. This is a one-view stylized approximation,
 // NOT a view-correct capture of arbitrary 3D mesh geometry.
 for(const part of parts){
  const r=(part.footprint.radii[0]+part.footprint.radii[1])*.5*sx;
  const yTop=base-(part.height[1]-bottom)*sy;
  const yBottom=base-(part.height[0]-bottom)*sy;
  const depth=Math.min(11,r*.22);
  const [topColor,sideColor]=isFar?["#526982","#283d59"]:(PALETTE[part.material]||["#aaa","#777"]);
  g.beginPath();g.moveTo(centerX-r,yTop);g.lineTo(centerX+r,yTop);
  g.lineTo(centerX+r*.88,yBottom);g.lineTo(centerX-r*.88,yBottom);g.closePath();
  g.fillStyle=sideColor;g.fill();
  g.beginPath();g.ellipse(centerX,yTop,r,depth,0,0,Math.PI*2);
  g.fillStyle=topColor;g.fill();
  if(!isFar){
   g.strokeStyle="rgba(242,245,218,0.22)";g.lineWidth=1;
   g.beginPath();g.ellipse(centerX,yTop,r,depth,0,Math.PI,2*Math.PI);g.stroke();
   if(part.openings?.length && part===parts[parts.length-1]){
    // A visible inset, not a fabricated transparent hole in a side-on view.
    g.fillStyle="#27394b";for(const opening of part.openings){
     const [hx,hz]=opening.at,[rx,rz]=opening.radii;
     g.beginPath();g.ellipse(centerX+hx*sx,yTop-hz*.18*sx,
       Math.max(1,rx*sx),Math.max(1,rz*.18*sx),0,0,Math.PI*2);g.fill();
    }
   }
  }
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.magFilter=THREE.NearestFilter;
 texture.minFilter=THREE.LinearFilter;
 return {texture,bottom,top,maxRadius};
}
export function createIslandImpostors(object) {
 const middle=graphic(object,"mid"),distant=graphic(object,"far");
 const width=middle.maxRadius*2.35;
 const height=(middle.top-middle.bottom)+middle.maxRadius*.65;
 const make=(data)=>new THREE.Sprite(new THREE.SpriteMaterial({
  map:data.texture,transparent:true,depthWrite:false,depthTest:true,
  opacity:0,toneMapped:false
 }));
 const mid=make(middle),far=make(distant);
 mid.scale.set(width,height,1);far.scale.copy(mid.scale);
 return {object,mid,far,heightCenter:(middle.bottom+middle.top)/2};
}
export function updateIslandImpostor(item,group,ship,world) {
 // Match the exact wrapped placement of the real island; there is only one
 // semantic island, and all repetitions reuse its two tiny textures.
 const obj=item.object;
 const x=obj.at[0]+Math.round((ship.x-obj.at[0])/world.width)*world.width;
 const z=obj.at[2]+Math.round((ship.z-obj.at[2])/world.height)*world.height;
 const y=obj.at[1]+item.heightCenter;
 group.position.set(x,obj.at[1],z);
 const dist=Math.hypot(ship.x-x,ship.y-y,ship.z-z);
 const lod=islandDistanceBands(dist);
 // When blending at the boundary, fade the physical surface instead of
 // creating a hard pop. Collision continues to use the original geometry.
 group.visible=lod.mesh>.001;
 group.traverse(node=>{
  if(!node.isMesh)return;
  node.material.transparent=lod.mesh<.999;
  node.material.depthWrite=lod.mesh>=.999;
  node.material.opacity=lod.mesh;
 });
 for(const [sprite,opacity] of [[item.mid,lod.mid],[item.far,lod.far]]){
  sprite.position.set(x,y,z);sprite.material.opacity=opacity;
  sprite.visible=opacity>.001;
 }
}
export function disposeIslandImpostors(items,scene) {
 for(const item of items)for(const sprite of [item.mid,item.far]){
  scene.remove(sprite);
  sprite.material.map.dispose();sprite.material.dispose();
 }
}
