// Signed world-space speed, not a target that changes every time the ship
// crosses a semantic boundary. Ocean affects new acceleration, never erases
// velocity already earned near a destination or from an island flyby.
export const MOMENTUM=Object.freeze({
 localAcceleration:72,
 boostAcceleration:3.8,
 speedFalloff:90,
 coastingDragLocal:.24,
 coastingDragOcean:.022,
 counterThrust:105,
 flybyBase:30,
 flybyVelocityFactor:.20,
 flybyMaximum:135,
 flybyCooldownSeconds:18,
 flybyMaximumAltitude:170
});
export function advanceMomentum(speed,input,dt,{accelerationFactor=1,altitudeMultiplier=1,boost=false,openness=0}={}){
 if(![speed,input,dt,accelerationFactor,altitudeMultiplier,openness].every(Number.isFinite)||
  dt<0||dt>10||Math.abs(input)>1||accelerationFactor<0||altitudeMultiplier<0)
  throw Error("Invalid momentum step");
 if(dt===0)return speed;
 if(input===0){
  // Open ocean feels spacious but momentum remains: coasting never snaps to
  // the slow ocean acceleration factor, and resistance is especially small.
  const drag=MOMENTUM.coastingDragLocal*(1-Math.min(1,openness))+
   MOMENTUM.coastingDragOcean*Math.min(1,openness);
  const next=speed*Math.exp(-drag*dt);
  return Math.abs(next)<.008?0:next;
 }
 const direction=Math.sign(input);
 if(Math.sign(speed)===-direction && Math.abs(speed)>.008){
  // Reverse thrust is always responsive, even if the ship was carrying a
  // large ocean-crossing bonus. It can cross zero then accelerate backwards.
  const decel=MOMENTUM.counterThrust*(boost?1.8:1)*altitudeMultiplier*dt;
  return Math.abs(speed)<=decel?0:speed+direction*decel;
 }
 const acceleration=MOMENTUM.localAcceleration*
  (boost?MOMENTUM.boostAcceleration:1)*altitudeMultiplier*accelerationFactor/
  (1+Math.abs(speed)/MOMENTUM.speedFalloff);
 return speed+direction*acceleration*dt;
}
export function flybyImpulse(speed){
 if(!Number.isFinite(speed))throw Error("Invalid flyby velocity");
 if(Math.abs(speed)<9)return 0;
 return Math.sign(speed)*Math.min(MOMENTUM.flybyMaximum,
  MOMENTUM.flybyBase+Math.abs(speed)*MOMENTUM.flybyVelocityFactor);
}
const wrappedDelta=(a,b,period)=>{
 const d=((a-b+period/2)%period+period)%period-period/2;
 return d;
};
export function regionDistance(world,region,x,z){
 return Math.hypot(wrappedDelta(x,region.x,world.width),
  wrappedDelta(z,region.z,world.height));
}
export function createFlybyTracker(){
 return {inside:new Set(),lastAward:new Map()};
}
export function resetFlybyTracker(tracker,world,regions,x,z){
 tracker.inside.clear();tracker.lastAward.clear();
 // Initial spawn within an island's region does not grant a free bonus.
 for(const region of regions){
  if(regionDistance(world,region,x,z)<=region.radius+8)
   tracker.inside.add(region.id);
 }
}
export function updateFlybys(tracker,world,regions,x,z,y,speed,elapsedSeconds){
 if(!Number.isFinite(elapsedSeconds))throw Error("Invalid elapsed time");
 let reward=0,passed=null;
 for(const region of regions){
  const dist=regionDistance(world,region,x,z);
  const near=dist<=region.radius+8;
  const wasInside=tracker.inside.has(region.id);
  const departed=wasInside&&dist>region.radius+24;
  const arrived=near&&!wasInside;
  if(arrived)tracker.inside.add(region.id);
  if(departed)tracker.inside.delete(region.id);
  // The ship may start inside a cluster. Departing that familiar-speed
  // region also earns the slipstream, not just approaching an island.
  if(arrived||departed){
   const last=tracker.lastAward.get(region.id)??-Infinity;
   if(y<=MOMENTUM.flybyMaximumAltitude &&
      elapsedSeconds-last>=MOMENTUM.flybyCooldownSeconds){
    const candidate=flybyImpulse(speed);
    if(candidate!==0){
     reward+=candidate;
     tracker.lastAward.set(region.id,elapsedSeconds);passed=region.id;
    }
   }
  }
 }
 return {reward,passed};
}
