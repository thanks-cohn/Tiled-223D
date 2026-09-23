// Massive-world overview presentation only. The ship's authoritative pilot
// stays at its real world coordinates; this returns a CAMERA-LOCAL visual
// transform so the same ship mesh stays legible while the globe is centered.
export function massiveShipPresentation({worldId,normalizedAltitude,
 overviewWeight,cameraNear,fieldOfView,visualExtent}){
 if(![normalizedAltitude,overviewWeight,cameraNear,fieldOfView,visualExtent]
  .every(Number.isFinite)||cameraNear<=0||fieldOfView<=0||
  fieldOfView>=150||visualExtent<=0)throw Error("Invalid ship presentation");
 const active=worldId==="massive"&&normalizedAltitude>=185&&
  overviewWeight>.98;
 if(!active)return {active:false};
 const depth=Math.max(6,cameraNear*3.2);
 const halfHeight=depth*Math.tan(fieldOfView*Math.PI/360);
 return {active:true,x:0,y:-halfHeight*.43,z:-depth,
  scale:(halfHeight*.30)/visualExtent};
}
