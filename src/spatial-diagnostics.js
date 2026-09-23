import {projectPoint,projectBounds,SPATIAL_SCHEMA_VERSION} from "./spatial-math.js";
export const DIAGNOSTIC_MODES=Object.freeze(["performance","debug","deep"]);
const clone=value=>value===undefined?undefined:structuredClone(value);
export function createSpatialDiagnostics({mode="performance",maxRecords=256,maxBytes=262144,runId=`run-${Date.now().toString(36)}`,now=()=>performance.now()}={}){
 if(!DIAGNOSTIC_MODES.includes(mode)||maxRecords<1||maxBytes<1024)throw Error("Invalid diagnostics options");
 let currentMode=mode,frameId=0,bytes=0;const records=[],entities=new Map(),causes=new Map();
 const trim=()=>{while(records.length>maxRecords||bytes>maxBytes){const old=records.shift();bytes-=old._bytes;}};
 const record=(eventType,data={})=>{
  if(currentMode==="performance")return null;
  const event={schemaVersion:SPATIAL_SCHEMA_VERSION,runId,frameId,timestampMs:now(),eventType,
   objectId:data.objectId??null,worldId:data.worldId??null,viewMode:data.viewMode??null,
   coordinateSpace:data.coordinateSpace??"unknown",causeId:data.causeId??"unknown",...clone(data)};
  const line=JSON.stringify(event);event._bytes=new TextEncoder().encode(line).length+1;
  records.push(event);bytes+=event._bytes;trim();
  if(event.objectId)causes.set(event.objectId,event);return clone(event);
 };
 return {
  get mode(){return currentMode;},setMode(next){if(!DIAGNOSTIC_MODES.includes(next))throw Error("Unknown diagnostics mode");currentMode=next;if(next==="performance"){records.length=0;bytes=0;}},
  nextFrame(){frameId++;},register(id,reader){if(!id||typeof reader!=="function")throw Error("Invalid spatial entity");entities.set(id,reader);return ()=>entities.delete(id);},
  record,getObjectSpatialState(id,{detail="standard"}={}){const reader=entities.get(id);if(!reader)return {error:{code:"UNKNOWN_OBJECT",id}};return clone(reader({detail,frameId}));},
  getViewportPosition(id){const state=this.getObjectSpatialState(id);return state.error?state:{physical:state.projection?.physical??null,visible:state.projection?.visible??null};},
  getCameraState(){return this.getObjectSpatialState("camera");},
  getSpatialSnapshot({ids=[...entities.keys()],detail="standard"}={}){if(currentMode==="performance")return {error:{code:"DIAGNOSTICS_DISABLED"}};return {schemaVersion:SPATIAL_SCHEMA_VERSION,runId,frameId,objects:ids.map(id=>this.getObjectSpatialState(id,{detail}))};},
  getSpatialRelationship(a,b){const A=this.getObjectSpatialState(a),B=this.getObjectSpatialState(b);if(A.error||B.error)return {error:{code:"UNKNOWN_OBJECT"}};const p=A.authoritative?.position,q=B.authoritative?.position;if(!p||!q)return {distance:"unknown",reason:"no-common-authoritative-space"};return {space:A.authoritative.space,distance:Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z),delta:{x:q.x-p.x,y:q.y-p.y,z:q.z-p.z}};},
  getCoordinateTransform(from,to){return from===to?{type:"identity",matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}:{error:{code:"UNAVAILABLE_TRANSFORM",from,to}};},
  explainPositionChange(id,frameA,frameB){return {objectId:id,frameA,frameB,events:records.filter(e=>e.objectId===id&&e.frameId>=frameA&&e.frameId<=frameB).map(({_bytes,...e})=>e),latestCause:clone(causes.get(id))??"unknown"};},
  exportJSONL(){return records.map(({_bytes,...event})=>JSON.stringify(event)).join("\n");},
  incidentReport(id){const events=this.explainPositionChange(id,0,frameId).events;return `Spatial incident ${runId}\nObject: ${id}\nFrames: 0-${frameId}\nRecorded events: ${events.length}\nLatest cause: ${events.at(-1)?.causeId??"unknown"}\nOcclusion is unknown without a depth measurement.`;},
  stats(){return {schemaVersion:SPATIAL_SCHEMA_VERSION,runId,frameId,mode:currentMode,records:records.length,bytes,maxRecords,maxBytes,registered:entities.size}}
 };
}
export {projectPoint,projectBounds};
