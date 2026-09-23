// Presentation coordinates are expressed as FRACTIONS OF THE RENDER VIEWPORT:
// (0,0)=top-left, (1,1)=bottom-right. The pilot remains in physical world
// coordinates for movement, collision, landing, semantic bindings and map UI.
// The same ship visual is camera-local throughout Massive Overview; NEVER
// switch representations at an altitude threshold (the V9 teleport bug).
export const MASSIVE_SHIP_ANCHOR=Object.freeze({
 u:.5,v:.73,heightFraction:.15
});
export function massiveShipPresentation({worldId,normalizedAltitude,
 overviewWeight,cameraNear,fieldOfView,visualExtent,aspect=16/9,
 composition=MASSIVE_SHIP_ANCHOR}){
 if(![normalizedAltitude,overviewWeight,cameraNear,fieldOfView,visualExtent,aspect]
  .every(Number.isFinite)||normalizedAltitude<0||cameraNear<=0||
  fieldOfView<=0||fieldOfView>=150||visualExtent<=0||aspect<=0)
  throw Error("Invalid ship presentation");
 // IMPORTANT: No altitude cutoff. The old >=185 test changed the ship parent
 // mid-ascent; its projected position instantly jumped from above the viewport
 // to lower center. Anchor from the FIRST frame Overview is selected.
 // Keep the representation attached to the camera for the ENTIRE Massive
 // world. Forward is hidden by zero apparent size, not by re-parenting.
 const active=worldId==="massive";
 if(!active)return {active:false};
 if(![composition.u,composition.v,composition.heightFraction].every(Number.isFinite)||
  composition.heightFraction<0)throw Error("Invalid composition");
 const {u,v,heightFraction}=composition;
 const depth=Math.max(6,cameraNear*3.2);
 const halfHeight=depth*Math.tan(fieldOfView*Math.PI/360);
 const halfWidth=halfHeight*aspect;
 return {active:true,
  x:(u-.5)*2*halfWidth,
  y:(.5-v)*2*halfHeight,
  z:-depth,
  scale:(2*halfHeight*heightFraction)/visualExtent,
  viewport:{u,v,heightFraction},visible:heightFraction>1e-5
 };
}
