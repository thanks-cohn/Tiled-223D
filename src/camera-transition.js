const clamp01=x=>Math.max(0,Math.min(1,x));
const ease=x=>x*x*(3-2*x);
export function createCompositionTransition(initial={u:.5,v:.73,heightFraction:.15}){
 let current={...initial},start={...current},target={...current},elapsed=0,duration=0,active=false,id=0;
 return {
  retarget(next,seconds=.55){if(!next||![next.u,next.v,next.heightFraction,seconds].every(Number.isFinite)||seconds<=0)throw Error("Invalid composition transition");start={...current};target={...next};elapsed=0;duration=seconds;active=true;id++;return {id,start:{...start},target:{...target}};},
  update(dt){if(!Number.isFinite(dt)||dt<0)throw Error("Invalid transition timestep");if(active){elapsed+=dt;const t=ease(clamp01(elapsed/duration));for(const key of ["u","v","heightFraction"])current[key]=start[key]+(target[key]-start[key])*t;if(elapsed>=duration){current={...target};active=false;}}return this.state();},
  state(){return {...current,active,progress:duration?clamp01(elapsed/duration):1,transitionId:id};}
 };
}
