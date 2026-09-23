// Camera-independent, bounded speed-perception model. All intensity derives
// from measured ship displacement, not the camera's motion or a fake timer.
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const smooth=(x)=>x*x*(3-2*x);
export function speedVisualProfile(actualSpeed,normalizedAltitude,boosting=false,overviewWeight=0){
 if(![actualSpeed,normalizedAltitude,overviewWeight].every(Number.isFinite)||
  normalizedAltitude<0)throw Error("Invalid speed visualization input");
 // A wide and smooth response: visible at ordinary cruise, increasingly rich
 // with real travel, bounded at turbo speeds on the 16,000-unit planet.
 const speed=Math.abs(actualSpeed);
 const base=smooth(clamp((Math.log1p(speed)-Math.log1p(24))/
  (Math.log1p(750)-Math.log1p(24)),0,1));
 const altitude=clamp(normalizedAltitude,0,2000);
 // The scenic highway is subtle. The active middle atmosphere has the most
 // near-pass motion; upper planet uses fewer but longer horizon/edge cues.
 const mid=smooth(clamp((altitude-65)/95,0,1));
 const high=smooth(clamp((altitude-200)/240,0,1));
 const level=.55+.45*mid-.36*high;
 const overview=clamp(overviewWeight,0,1);
 const power=clamp(base*level*(boosting?1.12:1),0,1);
 return {
  power,
  opacity:Math.min(.26,power*(.21-.06*overview)),
  length:.045+power*.19,
  peripheralInset:.07+power*.045,
  // The flight view retains subtle speed cues; external camera keeps the
  // center of the globe clear.
  visible:power>.025,
  altitudeMood:altitude<110?"scenic":altitude<225?"active":
   altitude<390?"expansive":"planetary"
 };
}
export function measuredTravelSpeed(from,to,dt){
 if(!from||!to||![from.x,from.z,to.x,to.z,dt].every(Number.isFinite)||
  dt<0)throw Error("Invalid ship travel measurement");
 return dt>0?Math.hypot(to.x-from.x,to.z-from.z)/dt:0;
}
// World-distance drives the recycled peripheral trail pattern. No cloud,
// region or island is moved/reassigned just to make it look faster.
export function travelPhase(distance,index){
 if(!Number.isFinite(distance)||!Number.isInteger(index))
  throw Error("Invalid speed trail phase");
 const fract=x=>x-Math.floor(x);
 return fract(distance*.0045+fract((index+1)*.618033988749895));
}
