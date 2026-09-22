// Renderer-independent spatial volumes. Parent identity governs ownership;
// positions are local to the owning island; unoccupied space is always empty.
export function validateIslands(objects, clusterId) {
 if (!Array.isArray(objects)) throw Error("objects must be an array");
 const ids=new Set();
 for(const obj of objects) {
  if(typeof obj.id!=="string"||ids.has(obj.id)||obj.parent!==clusterId)
   throw Error("Invalid island id or parent");
  ids.add(obj.id);
  if(!Array.isArray(obj.at)||obj.at.length!==3||!obj.at.every(Number.isFinite))
   throw Error("Island position must be finite [x,y,z]");
  if(!Array.isArray(obj.parts)||!obj.parts.length)throw Error("Island has no parts");
  for(const part of obj.parts) {
   if(part.parent!==obj.id||typeof part.id!=="string"||ids.has(part.id))throw Error("Invalid part identity");
   ids.add(part.id);
   if(!Array.isArray(part.height)||part.height.length!==2||
       !part.height.every(Number.isFinite)||part.height[1]<=part.height[0])throw Error("Invalid height interval");
   const f=part.footprint;
   if(f?.type!=="ellipse"||!Array.isArray(f.radii)||f.radii.length!==2||
      !f.radii.every(r=>Number.isFinite(r)&&r>0))throw Error("Invalid footprint");
   for(const hole of part.openings||[]) {
    if(!Array.isArray(hole.at)||hole.at.length!==2||!hole.at.every(Number.isFinite)||
      !Array.isArray(hole.radii)||hole.radii.length!==2||!hole.radii.every(r=>Number.isFinite(r)&&r>0))
      throw Error("Invalid opening");
   }
  }
 }
 return true;
}
export function occupies(part, object, x, y, z, radius=0) {
 const dx=x-object.at[0], dz=z-object.at[2], ly=y-object.at[1], [a,b]=part.height;
 if (ly+radius<a||ly-radius>b)return false;
 const [rx,rz]=part.footprint.radii;
 if((dx/(rx+radius))**2+(dz/(rz+radius))**2>1)return false;
 for(const hole of part.openings||[]) {
  const [hx,hz]=hole.at,[hrx,hrz]=hole.radii;
  const y0=hole.height?.[0]??a,y1=hole.height?.[1]??b;
  if(ly-radius>=y0 && ly+radius<=y1 && hrx>radius && hrz>radius &&
      ((dx-hx)/(hrx-radius))**2+((dz-hz)/(hrz-radius))**2<1)return false;
 }
 return true;
}
export function spatialHit(objects, x, y, z, radius=.85, worldWidth=null, worldHeight=null) {
 for(const obj of objects||[]) {
  // Evaluate against the nearest repeating instance while retaining a single
  // authoritative object. Objects do not duplicate in the semantic world.
  const cx=worldWidth?obj.at[0]+Math.round((x-obj.at[0])/worldWidth)*worldWidth:obj.at[0];
  const cz=worldHeight?obj.at[2]+Math.round((z-obj.at[2])/worldHeight)*worldHeight:obj.at[2];
  const near={...obj,at:[cx,obj.at[1],cz]};
  for(const part of obj.parts) if(occupies(part,near,x,y,z,radius))
    return {objectId:obj.id,partId:part.id,material:part.material};
 }
 return null;
}
