import * as THREE from "three";
import {CLOUD_LAYERS,CLOUD_RENDER_BUDGET,altitudeCloudProfile,smoothBand} from "./atmosphere-model.js";
import {globeSurface,GLOBE_RADIUS} from "./horizon.js";

// All 4 decks reuse one tiny alpha texture; no volumetric lighting, new water
// body, weather simulation, external images, or continuously created geometry.
function makeSoftCloudTexture(){
 const canvas=document.createElement("canvas");
 canvas.width=128;canvas.height=64;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Cloud texture canvas unavailable");
 for(const [x,y,rx,ry] of [[29,39,27,18],[50,27,28,24],[78,31,27,23],[101,43,20,14]]){
  ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
  const glow=ctx.createRadialGradient(0,0,.05,0,0,1);
  glow.addColorStop(0,"rgba(255,255,255,.81)");
  glow.addColorStop(.58,"rgba(253,254,255,.55)");
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
 const texture=makeSoftCloudTexture(),clouds=[];
 for(const deck of CLOUD_LAYERS){
  const style=layerStyle[deck.id],sprites=[];
  for(let i=0;i<deck.count;i++){
   const sprite=makeCloudSprite(texture,style.width*(.84+(i%3)*.13),
    style.height*(.9+(i%2)*.2));
   scene.add(sprite);sprites.push(sprite);
  }
  clouds.push({deck,style,sprites});
 }
 const count=clouds.reduce((n,deck)=>n+deck.sprites.length,0);
 if(count!==CLOUD_RENDER_BUDGET.sprites)throw Error("Atmosphere sprite budget mismatch");
 const origin=new THREE.Vector3();
 let entered=false;
 return {
  update(ship,world,time,profile=null,speed=0){
   const reveal=profile?.globeReveal??0;
   const state=altitudeCloudProfile(profile?.atmosphericAltitude??ship.y,reveal);
   const movement=Math.abs(speed);
   let withinReachableCloud=false;
   for(const {deck,style,sprites} of clouds){
    const weight=state.layers[deck.id];
    // Invisible decks do not update expensive pixel/sprite placement.
    if(weight<.003){
     for(const sprite of sprites)sprite.visible=false;
     continue;
    }
    const spacing=style.spacing;
    const cx=Math.floor(ship.x/spacing),cz=Math.floor(ship.z/spacing);
    for(let i=0;i<sprites.length;i++){
     const sprite=sprites[i];
     const dx=(i%3)-1,dz=Math.floor(i/3)-(deck.id==="planetary"?.5:1);
     const gx=cx+dx,gz=cz+dz;
     // Deterministic world-anchored clouds rather than sprites made on each
     // frame or clouds that follow the ship's movement at identical speeds.
     const jx=(hash(gx,gz,11)-.5)*spacing*.48;
     const jz=(hash(gx,gz,17)-.5)*spacing*.48;
     let x=(gx+.5)*spacing+jx+time*deck.wind;
     let z=(gz+.5)*spacing+jz-time*deck.wind*.42;
     if(deck.id==="high"){
      // Distant sky decoration, not a reachable physical cloud. A sparse
      // slow-moving ring keeps high clouds in the view even while hovering
      // near the ocean and looking toward (rather than above) the horizon.
      // Its enormous depth causes it to drift much more slowly than the
      // world-anchored low clouds during a Shift acceleration.
      const angle=2*Math.PI*i/sprites.length+
       (ship.x+ship.z)*.00006+time*deck.wind*.0003;
      const radius=655+(i%3)*53;
      x=ship.x+Math.cos(angle)*radius;
      z=ship.z+Math.sin(angle)*radius;
     }
     const distance=Math.hypot(x-ship.x,z-ship.z);
     const fading=1-smoothBand(style.fadeNear,style.fadeFar,distance);
     const opacity=style.alpha*weight*fading;
     if(opacity<.006){sprite.visible=false;continue;}
     let px=x,py=deck.height+((hash(gx,gz,23)-.5)*16),pz=z;
     if(deck.id==="planetary"){
      // Same local globe equations as the ocean's shared deformation. At
      // near-space altitude the cloud cards sit just above the opaque planet.
      const curved=globeSurface(distance,profile?.planetRadius??GLOBE_RADIUS);
      const ratio=distance>1e-5?curved.horizontal/distance:1;
      px=ship.x+(x-ship.x)*ratio;
      pz=ship.z+(z-ship.z)*ratio;
      py=deck.height-curved.drop;
     }
     sprite.position.set(px,py,pz);
     sprite.material.opacity=opacity;
     sprite.visible=true;
     // The near deck is the ONLY reachable cloud deck. Passing through it
     // adds soft local opacity without blue fogging over the entire landscape.
     if(deck.id==="low"&&distance<sprite.scale.x*.37 &&
       Math.abs(ship.y-py)<sprite.scale.y*.44)
      withinReachableCloud=true;
    }
   }
   entered=withinReachableCloud;
   return {inside:entered,band:state.dominant,speed:movement};
  },
  getSummary(){
   return {layers:clouds.map(({deck,sprites})=>({id:deck.id,
    height:deck.height,wind:deck.wind,count:sprites.length,
    visible:sprites.filter(sprite=>sprite.visible).length})),
    sprites:count,textures:1,volumetricPasses:0};
  },
  dispose(){
   for(const {sprites} of clouds)for(const sprite of sprites){
    scene.remove(sprite);sprite.material.dispose();
   }
   texture.dispose();
  }
 };
}
