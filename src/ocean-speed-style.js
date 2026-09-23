// Ocean speed cues are a small fixed number of WORLD-ANCHORED high-contrast
// glints, not a time-based scroll or a second ocean mesh.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function oceanSpeedStyle(speed,normalizedAltitude,planetScale=1,
 openness=1,worldWidth=500){
 if(![speed,normalizedAltitude,planetScale,openness,worldWidth]
  .every(Number.isFinite)||normalizedAltitude<0||planetScale<=0||
  worldWidth<=0)throw Error("Invalid ocean speed style");
 const absolute=Math.abs(speed),fast=absolute/(absolute+140);
 const visible=absolute>12;
 const opacity=visible?clamp((.20+.72*fast)*
  (.85+.15*clamp(openness,0,1)),0,.91):0;
 const grid=Math.min(Math.max(21,worldWidth/7),
  21+normalizedAltitude*.65*Math.sqrt(planetScale));
 return {visible,opacity,grid,
  // When cruising fast at a high altitude, lengths grow with the physical
  // surface cell size; they do not become microscopic as the planet expands.
  length:grid*(.14+.45*fast),
  // Bright mint-white vs the existing deep blue (#19598d) sea.
  color:0xeaffff};
}
