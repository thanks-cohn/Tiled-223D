// Rendering, movement and atmosphere share these continuous altitude curves.
// Gameplay uses authoritative flat X/Z/Y coordinates; these values only
// determine speed and the VISUAL projection of the low-memory prototype.
export const LIMITS=Object.freeze({
  low:65,transition:115,nearSpace:270,warning:350,exit:500
});
export function smoothstep(start,end,value) {
 if(!Number.isFinite(value)||!(end>start))throw Error("Invalid smoothstep input");
 const t=Math.max(0,Math.min(1,(value-start)/(end-start)));
 return t*t*(3-2*t);
}
export function damp(current,target,rate,dt) {
 if(![current,target,rate,dt].every(Number.isFinite)||rate<0||dt<0)
  throw Error("Invalid damping parameter");
 return current+(target-current)*(1-Math.exp(-rate*dt));
}
export function altitudeProfile(altitude) {
 if(!Number.isFinite(altitude))throw Error("Invalid altitude");
 const cruise=smoothstep(65,285,altitude);
 const curvature=smoothstep(105,265,altitude);
 const space=smoothstep(225,445,altitude);
 const travelMultiplier=1+2.8*cruise+1.2*space;
 return {
  layer:altitude<110?"overworld":altitude<285?"atmosphere":"near-space",
  cruise,curvature,space,travelMultiplier,
  cloudFade:1-smoothstep(210,315,altitude),
  cameraDistance:13+12*cruise+5*space,
  cameraHeight:6+8*cruise+12*space,
  lookDown:3+30*curvature+15*space,
  fieldOfView:69+5*cruise+2*space,
  skyFade:smoothstep(185,455,altitude)
 };
}
// Distinguish faster TRAVEL at altitude from the apparent motion of terrain:
// a fixed world speed actually makes distant ground drift more slowly onscreen.
export function targetTravelSpeed(altitude,boost=false) {
 const p=altitudeProfile(altitude);
 return (boost?65:27)*p.travelMultiplier;
}
