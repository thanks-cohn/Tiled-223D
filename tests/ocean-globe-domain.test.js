import test from "node:test";
import assert from "node:assert/strict";
import {buildOceanGeometry,globeSurface} from "../src/horizon.js";
import {SCALE_PRESETS} from "../src/scale-world.js";

test("every ocean ring ends at the actual antipode on all three world scales",()=>{
 for(const scale of Object.values(SCALE_PRESETS)){
  const R=scale.radius,geometry=buildOceanGeometry(R),positions=geometry.getAttribute("position");
  assert.equal(positions.count,1+54*120,"bounded fixed mesh budget");
  let largest=0;
  for(let i=0;i<positions.count;i++){
   const radius=Math.hypot(positions.getX(i),positions.getZ(i));
   largest=Math.max(largest,radius);
   assert.ok(radius<=Math.PI*R+R*1e-5,
    `${scale.id} ring ${i} extends past the antipode by ${radius-Math.PI*R}`);
  }
  assert.ok(Math.abs(largest-Math.PI*R)<Math.max(.02,R*1e-5),
   `${scale.id} last ring must reach, but not overshoot, the antipode`);
  const terminal=globeSurface(Math.PI*R,R);
  assert.ok(Math.abs(terminal.horizontal)<1e-8*R);
  geometry.dispose();
 }
});

test("small-world sea remains wider than the authored 500-unit map in flat flight",()=>{
 const geometry=buildOceanGeometry(SCALE_PRESETS.current.radius);
 const pos=geometry.getAttribute("position");let max=0;
 for(let i=0;i<pos.count;i++)max=Math.max(max,Math.hypot(pos.getX(i),pos.getZ(i)));
 assert.ok(max>500,"low-altitude sea must not end inside the authored world");
 assert.ok(max<925,"former oversized sea skirt must be removed");
 geometry.dispose();
});
