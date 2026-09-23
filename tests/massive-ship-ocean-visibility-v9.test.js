import test from "node:test";
import assert from "node:assert/strict";
import {massiveShipPresentation} from "../src/massive-ship-presentation.js";
import {oceanSpeedStyle} from "../src/ocean-speed-style.js";

test("only Massive high-altitude Overview gets a screen-stable visible ship",()=>{
 for(const worldId of ["current","bigger"]){
  assert.equal(massiveShipPresentation({worldId,normalizedAltitude:445,
   overviewWeight:1,cameraNear:40,fieldOfView:46,visualExtent:3.4}).active,false);
 }
 // The render parent is stable even in Forward: visibility is continuously
 // reduced by framing rather than a discrete world-to-camera transfer.
 for(const overviewWeight of [0,.02,.4,.98,1]){
  assert.equal(massiveShipPresentation({worldId:"massive",normalizedAltitude:445,
   overviewWeight,cameraNear:40,fieldOfView:46,visualExtent:3.4}).active,true);
 }
 // There is deliberately no altitude handoff: Massive Overview uses one
 // representation from its first blended frame through planetary flight.
 assert.equal(massiveShipPresentation({worldId:"massive",normalizedAltitude:130,
  overviewWeight:1,cameraNear:1,fieldOfView:72,visualExtent:3.4}).active,true);
 for(const altitude of [185,225,300,445,1200]){
  const position=massiveShipPresentation({worldId:"massive",
   normalizedAltitude:altitude,overviewWeight:1,
   cameraNear:40,fieldOfView:46,visualExtent:3.4});
  assert.equal(position.active,true);
  assert.ok(position.z < -40);
  assert.ok(position.y<0);
  assert.ok(position.scale>0);
  const halfHeight=-position.z*Math.tan(46*Math.PI/360);
  // Occupies the same angular size and lower-centre viewing region,
  // independently of planet size and full-altitude distance to terrain.
  assert.ok(Math.abs(position.y/halfHeight+.46)<1e-10);
  assert.ok(Math.abs(position.scale*3.4/halfHeight-.30)<1e-10);
 }
 assert.throws(()=>massiveShipPresentation({worldId:"massive",
  normalizedAltitude:445,overviewWeight:1,cameraNear:0,
  fieldOfView:46,visualExtent:3.4}),/Invalid/);
});
test("ocean lines remain high contrast and visible while actually moving at every altitude",()=>{
 for(const [altitude,scale,width] of [
  [34,1,500],[135,1,500],[225,5,2500],[445,32,16000]
 ]){
  const style=oceanSpeedStyle(250,altitude,scale,1,width);
  assert.equal(style.visible,true);
  assert.ok(style.opacity>.5);
  assert.equal(style.color,0xeaffff);
  assert.ok(style.length>0);
  assert.ok(style.grid>=21);
 }
 for(const altitude of [34,225,445]){
  assert.equal(oceanSpeedStyle(0,altitude,32,1,16000).visible,false);
  assert.equal(oceanSpeedStyle(0,altitude,32,1,16000).opacity,0);
 }
 const cruise=oceanSpeedStyle(40,35,1,.9,500);
 const turbo=oceanSpeedStyle(600,35,1,.9,500);
 assert.ok(turbo.opacity>cruise.opacity);
 assert.ok(turbo.length>cruise.length);
 assert.ok(turbo.opacity<=.91);
 assert.throws(()=>oceanSpeedStyle(NaN,40),/Invalid/);
});
