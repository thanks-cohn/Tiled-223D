import {assertEnvelope, clone, diagnostic, ERROR_CODES, indexAt, validateRegion, WorldApiError} from './core.js';

/** Precise programmer surface. Methods accept versioned operation envelopes and return immutable next-state proposals. */
export class ProgrammerWorldApi {
  constructor(project) { this.project = project; }
  inspectMap({x = 0, y = 0, width = this.project.width, height = this.project.height, limit = 4096} = {}) {
    if (![x,y,width,height,limit].every(Number.isInteger) || width < 1 || height < 1 || x < 0 || y < 0 || x+width > this.project.width || y+height > this.project.height || width*height > limit)
      throw new WorldApiError(ERROR_CODES.bounds, `Inspection rectangle must be in bounds and contain at most ${limit} cells.`);
    const projection = projectProjection(this.project), cells=[];
    for(let row=y;row<y+height;row++) for(let col=x;col<x+width;col++) { const i=indexAt(col,row,this.project.width); cells.push({x:col,y:row,terrainId:projection.ground[i],height:projection.heights[i]}); }
    return {schemaVersion:1,projectId:this.project.projectId,revision:this.project.revision,bounds:{x,y,width,height},cells};
  }
  placeRegion(region) {
    const replacing = this.project.regions.find(r=>r.id===region.id);
    if (replacing?.locked) throw new WorldApiError(ERROR_CODES.locked, `${region.id} is locked.`);
    validateRegion(region, this.project, region.id);
    return {type:'region.place',region:clone(region),previous:replacing ? clone(replacing) : null};
  }
  patchCells({id, cells, locked=false, provenance={kind:'programmer'}}) {
    if (!Array.isArray(cells) || !cells.length) throw new WorldApiError(ERROR_CODES.invalid, 'map.patch requires cells.');
    const xs=cells.map(c=>c.x), ys=cells.map(c=>c.y), x=Math.min(...xs), y=Math.min(...ys), width=Math.max(...xs)-x+1, height=Math.max(...ys)-y+1;
    const projection=projectProjection(this.project), tiles=[], heights=[];
    for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++){const i=indexAt(col,row,this.project.width);tiles.push(projection.ground[i]);heights.push(projection.heights[i]);}
    for(const cell of cells){if(!Number.isInteger(cell.x)||!Number.isInteger(cell.y)||!Object.values({a:1,b:2,c:3,d:4,e:5,f:6}).includes(cell.terrainId)||!Number.isFinite(cell.height))throw new WorldApiError(ERROR_CODES.invalid,'Each patch cell needs integer x/y, terrain-v1 terrainId and finite height.'); const i=(cell.y-y)*width+cell.x-x;tiles[i]=cell.terrainId;heights[i]=cell.height;}
    return this.placeRegion({id,bounds:{x,y,width,height},tiles,heights,locked,provenance});
  }
}

export function projectProjection(project) {
  const ground=project.baseGround.slice(), heights=project.baseHeights.slice();
  for(const region of project.regions) for(let ry=0;ry<region.bounds.height;ry++)for(let rx=0;rx<region.bounds.width;rx++){
    const source=ry*region.bounds.width+rx,target=indexAt(region.bounds.x+rx,region.bounds.y+ry,project.width);
    if(region.tiles[source]!==0) ground[target]=region.tiles[source];
    if(region.heights) heights[target]=region.heights[source];
  }
  return {ground,heights};
}

export function applyTransaction(project, request, operations) {
  assertEnvelope(request, project, 'commit');
  const prior=clone(project), next=clone(project);
  if(next.operationLog.some(e=>e.operationId===request.operationId)) return {project,revision:project.revision,idempotent:true,undoToken:null};
  try { for(const operation of operations){ if(operation.type!=='region.place')throw new WorldApiError(ERROR_CODES.invalid,`Unsupported operation ${operation.type}.`); const at=next.regions.findIndex(r=>r.id===operation.region.id); if(at>=0&&next.regions[at].locked)throw new WorldApiError(ERROR_CODES.locked,`${operation.region.id} is locked.`); validateRegion(operation.region,next,operation.region.id); if(at<0)next.regions.push(clone(operation.region));else next.regions[at]=clone(operation.region); } }
  catch(error){ return {project,revision:project.revision,committed:false,diagnostics:[diagnostic(error)]}; }
  next.revision++; const undoToken=`undo-${request.operationId}`;
  next.operationLog.push({operationId:request.operationId,actor:request.actor,revision:next.revision,kind:'commit'});
  next.undoStack.push({token:undoToken,revision:next.revision,regions:prior.regions});
  return {project:next,revision:next.revision,committed:true,undoToken};
}

export function undoTransaction(project, request, token) {
  assertEnvelope(request, project, 'commit');
  const record=project.undoStack.at(-1); if(!record||record.token!==token)throw new WorldApiError(ERROR_CODES.revision,'Undo token is not the latest committed change.');
  const next=clone(project);next.regions=record.regions;next.undoStack.pop();next.revision++;next.operationLog.push({operationId:request.operationId,actor:request.actor,revision:next.revision,kind:'undo',undoToken:token});return next;
}
