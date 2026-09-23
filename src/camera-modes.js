// Presentation-only camera policy: identical normalized altitude rules on
// Current, Bigger and Massive. These functions NEVER modify pilot movement.
export const CAMERA_CHOICES=Object.freeze(["auto","forward","overview"]);
export function cameraViewProfile(atmosphericAltitude,choice="auto"){
 if(!Number.isFinite(atmosphericAltitude)||!CAMERA_CHOICES.includes(choice))
  throw Error("Invalid camera profile");
 // Forward through low and middle flight, gradual transition to the existing
 // overview across the third layer, unchanged overview at the fourth.
 const t=Math.max(0,Math.min(1,(atmosphericAltitude-175)/50));
 const overviewBlend=t*t*(3-2*t);
 const overviewWeight=choice==="forward"?0:
  choice==="overview"?1:overviewBlend;
 return {
  forwardWeight:1-overviewWeight,
  overviewWeight,
  label:choice==="auto"?
   (overviewBlend>=.5?"Overview (Auto)":"Forward (Auto)"):
   choice==="forward"?"Forward":"Overview"
 };
}
// One press ALWAYS changes what the player actually sees, including when the
// automatic choice is already Forward or Overview; do not cycle through an
// indistinguishable Auto step.
export function nextCameraChoice(choice,atmosphericAltitude=35){
 const current=cameraViewProfile(atmosphericAltitude,choice);
 return current.overviewWeight>=.5?"forward":"overview";
}
export function overviewCameraScale(atmosphericAltitude,altitudeScale){
 if(!Number.isFinite(atmosphericAltitude)||!Number.isFinite(altitudeScale)||
  altitudeScale<1)throw Error("Invalid camera scale");
 // Crucial: X/Z following distance and Y camera height use the SAME scale.
 // At sea level all worlds keep the same local close-follow presentation;
 // at planetary altitude all worlds have identical camera geometry relative
 // to planetary radius. Scaling only Y caused the 16k viewport to malfunction.
 const t=Math.max(0,Math.min(1,(atmosphericAltitude-75)/150));
 const ease=t*t*(3-2*t);
 return 1+(altitudeScale-1)*ease;
}
export function forwardLookAngle(atmosphericAltitude,globeReveal=0){
 if(!Number.isFinite(atmosphericAltitude)||!Number.isFinite(globeReveal))
  throw Error("Invalid forward look angle");
 const t=Math.max(0,Math.min(1,(atmosphericAltitude-55)/175));
 const ease=t*t*(3-2*t);
 const globe=Math.max(0,Math.min(1,globeReveal));
 // Look slightly below the flat local horizon, progressively pitch toward
 // the expanding world while ascending; in orbit keep the globe in frame
 // even if the pilot manually chooses Forward. NEVER look upward.
 return .045+.39*ease+.85*globe;
}
export function overviewFocusHeight(pilotAltitude,atmosphericAltitude,planetRadius,globeReveal,lookDown){
 if(![pilotAltitude,atmosphericAltitude,planetRadius,globeReveal,lookDown]
  .every(Number.isFinite)||planetRadius<=0)throw Error("Invalid overview focus");
 // Aiming almost horizontally from thousands of units above the 16k ocean
 // previously left the entire viewport in the sky until full globe reveal.
 // Start lowering the aim towards the actual curved surface BEFORE the
 // sphere transition, using normalized altitude consistently on all worlds.
 const t=Math.max(0,Math.min(1,(atmosphericAltitude-125)/110));
 const groundAim=t*t*(3-2*t);
 const globe=Math.max(0,Math.min(1,globeReveal));
 return (pilotAltitude-lookDown)*(1-groundAim)-
  planetRadius*globe*groundAim;
}
export function planetOverviewFov(baseFov,globeReveal,overviewWeight){
 if(![baseFov,globeReveal,overviewWeight].every(Number.isFinite))
  throw Error("Invalid planet framing");
 const amount=Math.min(1,Math.max(0,globeReveal))*
  Math.min(1,Math.max(0,overviewWeight));
 return baseFov+(46-baseFov)*amount;
}
