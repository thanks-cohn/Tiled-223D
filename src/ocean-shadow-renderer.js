import * as THREE from "three";
import {curveMaterial} from "./horizon.js";
export function createOceanShadowRenderer(scene,horizonState,preset){
 const geometry=new THREE.CircleGeometry(1,32);geometry.rotateX(-Math.PI/2);
 const canvas=document.createElement("canvas");canvas.width=canvas.height=64;const context=canvas.getContext("2d"),texture=new THREE.CanvasTexture(canvas);let lastSoftness=-1;
 const paint=softness=>{context.clearRect(0,0,64,64);const gradient=context.createRadialGradient(32,32,1,32,32,32);gradient.addColorStop(0,"#fff");gradient.addColorStop(softness,"#ffffff8f");gradient.addColorStop(1,"#ffffff00");context.fillStyle=gradient;context.fillRect(0,0,64,64);texture.needsUpdate=true;lastSoftness=softness;};paint(preset.shadow.softness);
 const material=curveMaterial(new THREE.MeshBasicMaterial({color:preset.shadow.color,alphaMap:texture,transparent:true,opacity:0,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false,fog:false}),horizonState);
 const mesh=new THREE.Mesh(geometry,material);mesh.name="stylized-ship-ocean-shadow";mesh.renderOrder=0;mesh.frustumCulled=false;scene.add(mesh);
 return {update(state,origin,activePreset){if(activePreset.shadow.softness!==lastSoftness)paint(activePreset.shadow.softness);mesh.visible=activePreset.shadow.enabled&&state.visible;mesh.position.set(state.worldCenter.x-origin.x,.24,state.worldCenter.z-origin.z);mesh.scale.set(state.radius*activePreset.shadow.elongation,1,state.radius);material.opacity=state.alpha;material.color.set(activePreset.shadow.color);},get mesh(){return mesh;},dispose(){scene.remove(mesh);geometry.dispose();material.dispose();texture.dispose();}};
}
