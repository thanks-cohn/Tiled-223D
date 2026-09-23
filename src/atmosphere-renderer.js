import * as THREE from "three";
import {CLOUD_LAYERS,CLOUD_RENDER_BUDGET,altitudeCloudProfile,smoothBand} from "./atmosphere-model.js";
import {GLOBE_RADIUS} from "./horizon.js";
import {cloudAppearance,cloudMotionProfile,cloudRecyclePolicy,seededCloudPlacement,CLOUD_FAMILIES} from "./cloud-choreography.js";

// All 4 decks reuse one tiny alpha texture; no volumetric lighting, new water
// body, weather simulation, external images, or continuously created geometry.
function makeSoftCloudTexture(family=0){
 const canvas=document.createElement("canvas");
 canvas.width=128;canvas.height=64;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Cloud texture canvas unavailable");
 // Four deliberately different families, drawn ONCE per engine startup.
 // Reusing the same four tiny texture objects provides variety without
 // generating images or materials while flying.
 const shapes=[
  [[27,40,24,15],[48,29,23,24],[77,30,26,22],[103,40,20,14]],
  [[18,39,19,6],[40,29,29,7],[80,37,38,7],[106,27,20,5]],
  [[24,42,32,10],[59,37,39,15],[91,36,32,12],[115,43,16,8]],
  [[17,44,15,8],[45,24,16,19],[66,39,19,8],[96,31,18,14],[116,43,10,6]]
 ];
 for(const [x,y,rx,ry] of shapes[family]||shapes[0]){
  ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
  const glow=ctx.createRadialGradient(0,0,.05,0,0,1);
  glow.addColorStop(0,"rgba(255,255,255,.90)");
  glow.addColorStop(.57,"rgba(253,254,255,.62)");
  glow.addColorStop(1,"rgba(250,254,255,0)");
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();
  ctx.restore();
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.minFilter=THREE.LinearFilter;
 texture.magFilter=THREE.LinearFilter;
 return texture;
}
const fract=value=>value-Math.floor(value);
const hash=(x,z,seed)=>fract(Math.sin(x*127.1+z*311.7+seed*53.71)*43758.5453);
const layerStyle={
 low:{spacing:90,width:39,height:17,alpha:.48,fadeNear:105,fadeFar:205},
 middle:{spacing:165,width:83,height:29,alpha:.37,fadeNear:260,fadeFar:455},
 high:{spacing:270,width:151,height:43,alpha:.36,fadeNear:820,fadeFar:1150},
 planetary:{spacing:94,width:61,height:21,alpha:.36,fadeNear:190,fadeFar:335}
};
function makeCloudSprite(texture,width,height){
 const material=new THREE.SpriteMaterial({
  map:texture,transparent:true,opacity:0,depthWrite:false,depthTest:true,
  fog:false,toneMapped:false
 });
 const sprite=new THREE.Sprite(material);
 sprite.scale.set(width,height,1);
 sprite.visible=false;return sprite;
}
export function createAtmosphere(scene){
 // Four tiny shared texture variants total 128 KiB of raw RGBA pixels.
 // Cloud objects, geometries and textures NEVER grow with map dimensions.
 const textures=CLOUD_FAMILIES.map((_,i)=>makeSoftCloudTexture(i));
 const planeGeometry=new THREE.PlaneGeometry(1,1);
 const planeNormal=new THREE.Vector3(0,0,1),up=new THREE.Vector3(0,1,0);
 const surfaceNormal=new THREE.Vector3(),flatPosition=new THREE.Vector3();
 const surfacePosition=new THREE.Vector3();
 const clouds=[];
 for(const deck of CLOUD_LAYERS){
  const style=layerStyle[deck.id],slots=[];
  for(let i=0;i<deck.count;i++){
   const sprite=makeCloudSprite(textures[0],style.width,style.height);
   const plane=new THREE.Mesh(planeGeometry,new THREE.MeshBasicMaterial({
    map:textures[0],transparent:true,opacity:0,depthWrite:false,
    depthTest:true,side:THREE.DoubleSide,toneMapped:false
   }));
   plane.scale.set(style.width,style.height,1);
   plane.visible=false;plane.frustumCulled=false;
   scene.add(sprite,plane);
   slots.push({sprite,plane,anchor:null,sequence:i,slotIndex:i});
  }
  clouds.push({deck,style,slots,nextCheck:0});
 }
 const count=clouds.reduce((sum,item)=>sum+item.slots.length,0);
 if(count!==CLOUD_RENDER_BUDGET.sprites)throw Error("Cloud budget mismatch");
 let entered=false;
 function reassign(slot,deck,ship,world,heading,radius,time){
  const placement=seededCloudPlacement(ship,heading,deck.id,
   slot.sequence,world,radius);
  slot.sequence+=deck.count;
  slot.anchor=placement;
  slot.assignedAt=time;
  const texture=textures[Math.max(0,CLOUD_FAMILIES.indexOf(placement.family))];
  slot.sprite.material.map=texture;
  slot.plane.material.map=texture;
  slot.sprite.material.rotation=placement.spin;
  slot.sprite.material.needsUpdate=true;
  slot.plane.material.needsUpdate=true;
 }
 return {
  update(ship,world,time,profile=null,speed=0,origin={x:0,z:0},camera=null,heading=0){
   const reveal=profile?.globeReveal??0;
   const altitude=profile?.atmosphericAltitude??ship.y;
   const state=altitudeCloudProfile(altitude,reveal);
   const motion=cloudMotionProfile(altitude,reveal);
   const radius=profile?.planetRadius??GLOBE_RADIUS;
   const unfold=smoothBand(.08,.75,reveal);
   const shipSpeed=Math.abs(speed);
   const travelHeading=heading+(speed<0?Math.PI:0);
   let withinReachableCloud=false;
   for(const deckState of clouds){
    const {deck,style,slots}=deckState;
    const weight=state.layers[deck.id]*
     (.65+.35*motion.emphasis[deck.id]);
    if(weight<.003){
     for(const slot of slots){slot.sprite.visible=false;slot.plane.visible=false;}
     continue;
    }
    const planetRatio=deck.id==="planetary"?
     Math.max(1,radius/GLOBE_RADIUS):1;
    const fadeScale=deck.id==="planetary"?planetRatio:1;
    const near=style.fadeNear*fadeScale,far=style.fadeFar*fadeScale;
    const policy=cloudRecyclePolicy(deck.id,altitude,shipSpeed,radius);
    const canCheck=time>=deckState.nextCheck;
    let available=canCheck?policy.maxReassignments:0;
    if(canCheck)deckState.nextCheck=time+policy.interval;
    for(const slot of slots){
     if(!slot.anchor)reassign(slot,deck,ship,world,travelHeading,radius,time);
     let assignment=slot.anchor;
     let x=assignment.x+time*deck.wind;
     let z=assignment.z-time*deck.wind*.42;
     let dx=x-ship.x,dz=z-ship.z;
     let distance=Math.hypot(dx,dz);
     const ahead=-Math.sin(travelHeading)*dx-
      Math.cos(travelHeading)*dz;
     // Recycle only after a formation is behind/outside its layer's useful
     // field. Existing clouds never jump or accelerate to chase the ship.
     // Each layer gets an independent timer AND per-check work quota.
     const expired=distance>far*1.04||
      (ahead< -near*.6 && distance>near*.83);
     if(expired&&available>0){
      reassign(slot,deck,ship,world,travelHeading,radius,time);
      available--;
      assignment=slot.anchor;
      x=assignment.x+time*deck.wind;
      z=assignment.z-time*deck.wind*.42;
      dx=x-ship.x;dz=z-ship.z;distance=Math.hypot(dx,dz);
     }
     const fade=1-smoothBand(near,far,distance);
     // Prevent instant popping at a new assignment; incoming clouds grow
     // visible softly while older cloud silhouettes drift out of range.
     const birthFade=smoothBand(0,.65,time-slot.assignedAt);
     const opacity=style.alpha*weight*assignment.opacityScale*fade*birthFade;
     if(opacity<.006){
      slot.sprite.visible=false;slot.plane.visible=false;continue;
     }
     const opticalScale=deck.id==="planetary"?
      Math.pow(planetRatio,.75):1;
     const visualWidth=style.width*assignment.widthScale*opticalScale;
     const visualHeight=style.height*assignment.heightScale*opticalScale;
     slot.sprite.scale.set(visualWidth,visualHeight,1);
     slot.plane.scale.copy(slot.sprite.scale);
     const height=deck.height+
      (cloudHashForHeight(assignment)*16-8);
     const arc=Math.min(distance/radius,Math.PI);
     const projectedDistance=(radius+height)*Math.sin(arc);
     const ratio=distance>1e-5?projectedDistance/distance:1;
     const curvedX=ship.x+dx*ratio;
     const curvedZ=ship.z+dz*ratio;
     const curvedY=height-(radius+height)*(1-Math.cos(arc));
     flatPosition.set(x-origin.x,height,z-origin.z);
     surfacePosition.set(curvedX-origin.x,curvedY,curvedZ-origin.z);
     slot.sprite.position.copy(flatPosition);
     slot.sprite.material.opacity=opacity*(1-unfold);
     slot.sprite.visible=slot.sprite.material.opacity>.006;
     slot.plane.position.copy(flatPosition).lerp(surfacePosition,reveal);
     surfaceNormal.set(
      distance>1e-5?dx/distance*Math.sin(arc):0,
      Math.cos(arc),
      distance>1e-5?dz/distance*Math.sin(arc):0
     ).lerpVectors(up,surfaceNormal,reveal).normalize();
     slot.plane.quaternion.setFromUnitVectors(planeNormal,surfaceNormal);
     slot.plane.rotateZ(assignment.spin);
     slot.plane.material.opacity=opacity*unfold;
     slot.plane.visible=slot.plane.material.opacity>.006;
     if(deck.id==="low"&&distance<visualWidth*.37&&
      Math.abs(ship.y-height)<visualHeight*.44)
      withinReachableCloud=true;
    }
   }
   entered=withinReachableCloud;
   return {inside:entered,band:state.dominant,speed:shipSpeed};
  },
  getSummary(){
   return {layers:clouds.map(({deck,slots})=>({
    id:deck.id,count:slots.length,
    visible:slots.filter(s=>s.sprite.visible||s.plane.visible).length
   })),formations:count,textures:textures.length,volumetricPasses:0};
  },
  dispose(){
   for(const {slots} of clouds)for(const {sprite,plane} of slots){
    scene.remove(sprite,plane);
    sprite.material.dispose();plane.material.dispose();
   }
   planeGeometry.dispose();
   for(const texture of textures)texture.dispose();
  }
 };
}
// Stable tiny variation within an assigned cloud (not random per frame).
function cloudHashForHeight(assignment){
 return (assignment.widthScale*.61803398875+
  assignment.heightScale*.38196601125)%1;
}
