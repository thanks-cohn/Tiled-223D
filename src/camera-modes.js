// V8 camera choice is PRESENTATION ONLY. It may never edit the authoritative
// pilot, momentum, collision, heading, or world scale.
export const CAMERA_CHOICES=Object.freeze(["auto","forward","overview"]);
export function nextCameraChoice(choice){
 const i=CAMERA_CHOICES.indexOf(choice);
 if(i===-1)throw Error("Unknown camera choice");
 return CAMERA_CHOICES[(i+1)%CAMERA_CHOICES.length];
}
export function cameraViewProfile(atmosphericAltitude,choice="auto"){
 if(!Number.isFinite(atmosphericAltitude)||!CAMERA_CHOICES.includes(choice))
  throw Error("Invalid camera profile");
 const t=Math.max(0,Math.min(1,(atmosphericAltitude-205)/35));
 const overviewBlend=t*t*(3-2*t);
 return {
  // Auto: forward for low and middle, unchanged overview by high/planetary.
  // Manual: either camera can be held at ANY altitude.
  forwardWeight:choice==="forward"?1:choice==="overview"?0:1-overviewBlend,
  overviewWeight:choice==="overview"?1:choice==="forward"?0:overviewBlend,
  label:choice==="auto"?(overviewBlend>=.5?"Overview (Auto)":"Forward (Auto)"):
   choice==="forward"?"Forward (Manual)":"Overview (Manual)"
 };
}
