import test from "node:test";
import assert from "node:assert/strict";
import {speedVisualProfile,measuredTravelSpeed,travelPhase} from "../src/speed-perception.js";
test("speed cues remain absent while hovering or blocked",()=>{
 for(const h of [0,135,275,445,1000]){
  const stopped=speedVisualProfile(0,h,true,1);
  assert.equal(stopped.visible,false);
  assert.equal(stopped.power,0);
 }
 assert.equal(measuredTravelSpeed({x:0,z:0},{x:0,z:0},.02),0);
 assert.equal(measuredTravelSpeed({x:0,z:0},{x:0,z:10},.02),500);
});
test("actual faster motion progressively strengthens but bounds speed feeling",()=>{
 const a=speedVisualProfile(38,140),b=speedVisualProfile(120,140);
 const c=speedVisualProfile(500,140),d=speedVisualProfile(100000,140,true);
 assert.ok(a.power>0&&a.power<b.power&&b.power<c.power);
 assert.ok(c.power<=d.power&&d.power<=1&&d.opacity<=.26);
 assert.ok(speedVisualProfile(120,140,true).power>=b.power);
 assert.ok(speedVisualProfile(120,140,false,1).opacity<b.opacity);
 assert.ok(speedVisualProfile(120,140).power>
  speedVisualProfile(120,445).power);
});
test("same actual speed communicates differing altitude moods",()=>{
 assert.equal(speedVisualProfile(160,34).altitudeMood,"scenic");
 assert.equal(speedVisualProfile(160,150).altitudeMood,"active");
 assert.equal(speedVisualProfile(160,300).altitudeMood,"expansive");
 assert.equal(speedVisualProfile(160,445).altitudeMood,"planetary");
});
test("screen-space motion is distance-driven and deterministic",()=>{
 assert.equal(travelPhase(950,8),travelPhase(950,8));
 assert.notEqual(travelPhase(950,8),travelPhase(970,8));
 assert.ok(travelPhase(1e9,30)>=0&&travelPhase(1e9,30)<1);
 assert.throws(()=>travelPhase(NaN,3),/Invalid/);
 assert.throws(()=>measuredTravelSpeed({x:0,z:0},{x:1,z:0},-1),/Invalid/);
 assert.throws(()=>speedVisualProfile(Infinity,20),/Invalid/);
});
