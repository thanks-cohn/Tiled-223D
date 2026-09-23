// The same visual ship remains camera-parented for the entire Massive mode.
// Visibility and apparent size are continuous functions of desired Overview
// weight; world-space pilot position/flight physics remain authoritative.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createMassiveFlightFraming({
 anchorU=.5,anchorV=.71,heightFraction=.17,rate=4.8
}={}){
 if(![anchorU,anchorV,heightFraction,rate].every(Number.isFinite)||
  anchorU<0||anchorU>1||anchorV<0||anchorV>1||
  heightFraction<=0||heightFraction>.5||rate<=0)
  throw Error("Invalid Massive framing defaults");
 let visibility=0,goal=0,initialized=false;
 let position={u:anchorU,v:anchorV,heightFraction};
 const update=({overviewWeight,dt,target=position}={})=>{
  if(!Number.isFinite(overviewWeight)||!Number.isFinite(dt)||
   dt<0||![target?.u,target?.v,target?.heightFraction].every(Number.isFinite))
   throw Error("Invalid Massive framing update");
  goal=clamp(overviewWeight,0,1);
  // Smooth both directions without altitude gates or changing render parent.
  // First frame of a newly selected world starts at zero size (invisible),
  // not at a preselected camera-space position that causes a visual teleport.
  const alpha=1-Math.exp(-rate*dt);
  visibility+=(goal-visibility)*alpha;
  if(Math.abs(visibility-goal)<1e-5)visibility=goal;
  for(const key of ["u","v","heightFraction"])
   position[key]+=(target[key]-position[key])*alpha;
  initialized=true;
  const amplitude=visibility*visibility*(3-2*visibility);
  return {u:position.u,v:position.v,
   heightFraction:position.heightFraction*amplitude,
   engagement:visibility,visible:amplitude>1e-5,
   overviewTarget:goal,initialized};
 };
 return {
  update,
  reset(){visibility=0;goal=0;initialized=false;},
  state(){return {visibility,goal,initialized,...position};}
 };
}
