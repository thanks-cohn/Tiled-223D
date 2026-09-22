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
 const planeGeometry=new THREE.PlaneGeometry(1,1);
 const planeNormal=new THREE.Vector3(0,0,1),up=new THREE.Vector3(0,1,0);
 const surfaceNormal=new THREE.Vector3(),flatPosition=new THREE.Vector3(),surfacePosition=new THREE.Vector3();
 for(const deck of CLOUD_LAYERS){
  const style=layerStyle[deck.id],sprites=[],planes=[];
  for(let i=0;i<deck.count;i++){
   const width=style.width*(.84+(i%3)*.13),
    height=style.height*(.9+(i%2)*.2);
   const sprite=makeCloudSprite(texture,width,height);
   const plane=new THREE.Mesh(planeGeometry,new THREE.MeshBasicMaterial({
    map:texture,transparent:true,opacity:0,depthWrite:false,depthTest:true,
    side:THREE.DoubleSide,toneMapped:false
   }));
   plane.scale.set(width,height,1);
   plane.visible=false;
   plane.frustumCulled=false; // GPU projection matches its local position.
   scene.add(sprite,plane);sprites.push(sprite);planes.push(plane);
  }
  clouds.push({deck,style,sprites,planes});
 }
 const count=clouds.reduce((n,deck)=>n+deck.sprites.length,0);
 if(count!==CLOUD_RENDER_BUDGET.sprites)throw Error("Atmosphere sprite budget mismatch");
 let entered=false;
 return {
  update(ship,world,time,profile=null,speed=0,origin={x:0,z:0}){
   const reveal=profile?.globeReveal??0;
   const state=altitudeCloudProfile(profile?.atmosphericAltitude??ship.y,reveal);
   const movement=Math.abs(speed);
   const radius=profile?.planetRadius??GLOBE_RADIUS;
   const unfold=smoothBand(.08,.75,reveal);
   let withinReachableCloud=false;
   for(const {deck,style,sprites,planes} of clouds){
    const weight=state.layers[deck.id];
    // Invisible decks do not update expensive pixel/sprite placement.
    if(weight<.003){
     for(const sprite of sprites)sprite.visible=false;
     for(const plane of planes)plane.visible=false;
     continue;
    }
    // Planet cloud patches scale optically with radius, not by adding
    // sprites. The other three decks keep their current near-flight sizes.
    const planetRatio=deck.id==="planetary"?
     Math.max(1,radius/GLOBE_RADIUS):1;
    const spacing=deck.id==="planetary"?
     Math.max(style.spacing,radius*.42):style.spacing;
    const cx=Math.floor(ship.x/spacing),cz=Math.floor(ship.z/spacing);
    for(let i=0;i<sprites.length;i++){
     const sprite=sprites[i],plane=planes[i];
     const dx=(i%3)-1,dz=Math.floor(i/3)-(deck.id==="planetary"?.5:1);
     const gx=cx+dx,gz=cz+dz;
     // Deterministic world-anchored clouds rather than sprites made on each
     // frame or clouds that follow the ship's movement at identical speeds.
     const jx=(hash(gx,gz,11)-.5)*spacing*.48;
     const jz=(hash(gx,gz,17)-.5)*spacing*.48;
     let x=(gx+.5)*spacing+jx+time*deck.wind;
     let z=(gz+.5)*spacing+jz-time*deck.wind*.42;
     if(deck.id==="planetary"){
      // Six stable semantic formations on the logical world, not an
      // infinite player-following grid that repaints itself at high speed.
      const anchorX=world.width*([.22,.49,.77][i%3]);
      const anchorZ=world.height*([.24,.69][Math.floor(i/3)]);
      x=anchorX+Math.round((ship.x-anchorX)/world.width)*world.width+
       time*deck.wind;
      z=anchorZ+Math.round((ship.z-anchorZ)/world.height)*world.height-
       time*deck.wind*.42;
      const visualScale=Math.pow(planetRatio,.75);
      const w=style.width*(.84+(i%3)*.13)*visualScale;
      const h=style.height*(.9+(i%2)*.2)*visualScale;
      sprite.scale.set(w,h,1);
      plane.scale.copy(sprite.scale);
     }
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
     const fadeScale=deck.id==="planetary"?planetRatio:1;
     const fading=1-smoothBand(style.fadeNear*fadeScale,
      style.fadeFar*fadeScale,distance);
     // Repeated world-coordinate anchors are safely invisible before
     // switching to another wrapped copy at the far periodic seam.
     const seamFade=deck.id==="planetary"?
      1-smoothBand(world.width*.28,world.width*.42,
       Math.max(Math.abs(x-ship.x),Math.abs(z-ship.z))):1;
     const opacity=style.alpha*weight*fading*seamFade;
     if(opacity<.006){sprite.visible=false;plane.visible=false;continue;}
     const height=deck.height+((hash(gx,gz,23)-.5)*16);
     const arc=Math.min(distance/radius,Math.PI);
     const projectedDistance=(radius+height)*Math.sin(arc);
     const radialRatio=distance>1e-5?projectedDistance/distance:1;
     const curvedX=ship.x+(x-ship.x)*radialRatio;
     const curvedZ=ship.z+(z-ship.z)*radialRatio;
     const curvedY=height-(radius+height)*(1-Math.cos(arc));
     // Both representations share exactly the same source formation.
     // At sea level, translucent sprites face the pilot for an iconic sky.
     // As the globe appears, those sprites CROSSFADE into tangent planes:
     // their local normal points away from the planet, never toward camera.
     flatPosition.set(x-origin.x,height,z-origin.z);
     surfacePosition.set(curvedX-origin.x,curvedY,curvedZ-origin.z);
     sprite.position.copy(flatPosition);
     sprite.material.opacity=opacity*(1-unfold);
     sprite.visible=sprite.material.opacity>.006;
     plane.position.copy(flatPosition).lerp(surfacePosition,reveal);
     surfaceNormal.set(
      distance>1e-5?(x-ship.x)/distance*Math.sin(arc):0,
      Math.cos(arc),
      distance>1e-5?(z-ship.z)/distance*Math.sin(arc):0
     );
     surfaceNormal.lerpVectors(up,surfaceNormal,reveal).normalize();
     plane.quaternion.setFromUnitVectors(planeNormal,surfaceNormal);
     plane.material.opacity=opacity*unfold;
     plane.visible=plane.material.opacity>.006;
     // No new material, texture or geometry is created in the update loop.
     // The near deck is the ONLY reachable cloud deck. Passing through it
     // adds soft local opacity without blue fogging over the entire landscape.
     if(deck.id==="low"&&distance<sprite.scale.x*.37 &&
       Math.abs(ship.y-height)<sprite.scale.y*.44)
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
   for(const {sprites,planes} of clouds){
    for(const sprite of sprites){scene.remove(sprite);sprite.material.dispose();}
    for(const plane of planes){scene.remove(plane);plane.material.dispose();}
   }
   planeGeometry.dispose();texture.dispose();
  }
 };
}
