import {assertGrant, clone, ERROR_CODES, indexAt, regionWritesCell, TERRAIN, WorldApiError} from './core.js';

const MAX_PAGE_SIZE = 100;
const terrainVocabulary = Object.entries(TERRAIN).map(([name,id])=>({id,name,walkable:!['ocean','river','lake'].includes(name)}));
function projectProjection(project) {
  const ground=project.baseGround.slice(),heights=project.baseHeights.slice();
  for(const region of project.regions)for(let y=region.bounds.y;y<region.bounds.y+region.bounds.height;y++)for(let x=region.bounds.x;x<region.bounds.x+region.bounds.width;x++){
    if(!regionWritesCell(region,x,y))continue;const source=(y-region.bounds.y)*region.bounds.width+x-region.bounds.x,target=indexAt(x,y,project.width);
    ground[target]=region.tiles[source];if(region.heights)heights[target]=region.heights[source];
  }
  return {ground,heights};
}

function page(items,{offset=0,limit=25}={},mapItem=item=>item) {
  if (!Number.isInteger(offset)||!Number.isInteger(limit)||offset<0||limit<1||limit>MAX_PAGE_SIZE)
    throw new WorldApiError(ERROR_CODES.bounds, `Inspection pages require offset >= 0 and limit between 1 and ${MAX_PAGE_SIZE}.`);
  return {offset,limit,total:items.length,items:items.slice(offset,offset+limit).map(mapItem),nextOffset:offset+limit<items.length?offset+limit:null};
}
function regionSummary(region,project) {
  let cellCount=0,protectedCellCount=0;
  for(let y=region.bounds.y;y<region.bounds.y+region.bounds.height;y++)for(let x=region.bounds.x;x<region.bounds.x+region.bounds.width;x++) {
    if(!regionWritesCell(region,x,y))continue;
    cellCount++;
    const i=indexAt(x,y,project.width);
    if(project.baseGround[i]!==TERRAIN.ocean||project.baseHeights[i]!==0)protectedCellCount++;
  }
  return {id:region.id,kind:region.kind||'terrain-patch',bounds:clone(region.bounds),cellCount,hasNumericHeights:Boolean(region.heights),locked:Boolean(region.locked),protectedBaseCells:protectedCellCount,provenance:clone(region.provenance||{kind:'unknown'}),revision:project.revision,placementSurfaceId:`region:${region.id}:surface`};
}
function normalAt(project,projection,x,y) {
  const height=(sx,sy)=>projection.heights[indexAt(Math.max(0,Math.min(project.width-1,sx)),Math.max(0,Math.min(project.height-1,sy)),project.width)];
  const nx=height(x-1,y)-height(x+1,y),nz=height(x,y-1)-height(x,y+1),ny=2,length=Math.hypot(nx,ny,nz)||1;
  return {x:nx/length,y:ny/length,z:nz/length};
}

/** Shared, read-only inspection core used by programmer and agent surfaces. */
export class WorldInspection {
  constructor(project){this.project=project;}
  capabilities(actor) {
    const grants=assertGrant(this.project,actor);
    return {schemaVersion:1,projectId:this.project.projectId,revision:this.project.revision,
      coordinates:{mapAxes:{x:'world-x',y:'world-z'},elevationAxis:'world-y',unit:'tiled-cell'},
      topology:{kind:'finite-canvas',extent:{width:this.project.width,height:this.project.height},wrap:'none-in-world-api-v1'},
      terrain:{vocabulary:'terrain-v1',values:terrainVocabulary},
      operations:[
        {type:'project.inspectCapabilities',requiredGrant:'inspect'},{type:'map.inspect',requiredGrant:'inspect'},
        {type:'region.inspect',requiredGrant:'inspect'},{type:'operation.inspect',requiredGrant:'inspect'},
        {type:'placementSurface.inspect',requiredGrant:'inspect',fixture:true},
        {type:'map.patch',requiredGrant:'commit'},{type:'region.place',requiredGrant:'commit'},
        {type:'world.plan',requiredGrant:'draft'},{type:'world.preview',requiredGrant:'draft'},
        {type:'world.commit',requiredGrant:'commit'},{type:'world.undo',requiredGrant:'commit'},
        {type:'world.exportTiledJson',requiredGrant:'export'}],
      actor:{id:actor,grants:clone(grants)},budgets:{mapInspectCells:4096,pageSizeMax:MAX_PAGE_SIZE,plannedRegionsPerRequest:3},
      adapters:[{id:'tiled-json',direction:['import','export'],status:'implemented'},{id:'numeric-elevation-json',direction:['import'],status:'implemented'}],
      limitations:['Placement surfaces are computed inspection fixtures; they do not place entities or GLB assets.','Only terrain-v1 rectangular regions and sparse cell patches are mutable.','The world API uses a finite canvas; browser rendering wrap is not spherical topology.']};
  }
  regions(actor,options){assertGrant(this.project,actor);return {schemaVersion:1,projectId:this.project.projectId,revision:this.project.revision,...page(this.project.regions,options,region=>regionSummary(region,this.project))};}
  region(actor,id){assertGrant(this.project,actor);const found=this.project.regions.find(r=>r.id===id);if(!found)throw new WorldApiError(ERROR_CODES.invalid,`Unknown region ${id}.`);return {schemaVersion:1,projectId:this.project.projectId,...regionSummary(found,this.project)};}
  operations(actor,options){assertGrant(this.project,actor);return {schemaVersion:1,projectId:this.project.projectId,revision:this.project.revision,...page(this.project.operationLog,options,clone)};}
  placementSurface(actor,surfaceId) {
    assertGrant(this.project,actor);const match=/^region:(.+):surface$/.exec(surfaceId||''),region=match&&this.project.regions.find(r=>r.id===match[1]);
    if(!region)throw new WorldApiError(ERROR_CODES.invalid,`Unknown placement-surface fixture ${surfaceId}.`);
    const projection=projectProjection(this.project);let minHeight=Infinity,maxHeight=-Infinity,water=false,holes=false,protectedCells=0;
    for(let y=region.bounds.y;y<region.bounds.y+region.bounds.height;y++)for(let x=region.bounds.x;x<region.bounds.x+region.bounds.width;x++){
      if(!regionWritesCell(region,x,y)){holes=true;continue;}const i=indexAt(x,y,this.project.width),height=projection.heights[i];minHeight=Math.min(minHeight,height);maxHeight=Math.max(maxHeight,height);water ||= [TERRAIN.ocean,TERRAIN.river,TERRAIN.lake].includes(projection.ground[i]);protectedCells += this.project.baseGround[i]!==TERRAIN.ocean||this.project.baseHeights[i]!==0?1:0;
    }
    const cx=Math.floor(region.bounds.x+(region.bounds.width-1)/2),cy=Math.floor(region.bounds.y+(region.bounds.height-1)/2),reasons=[];
    if(region.locked)reasons.push({code:ERROR_CODES.locked,message:`Region ${region.id} is locked.`});
    if(protectedCells)reasons.push({code:ERROR_CODES.protected,message:`The fixture covers ${protectedCells} protected base cell(s).`});
    if(water)reasons.push({code:'NON_WALKABLE_TERRAIN',message:'The fixture includes water terrain.'});
    if(holes)reasons.push({code:'SPARSE_SURFACE',message:'The fixture has cells not owned by its region.'});
    return {schemaVersion:1,projectId:this.project.projectId,revision:this.project.revision,id:surfaceId,fixture:true,regionId:region.id,bounds:clone(region.bounds),
      height:{min:minHeight,max:maxHeight,sample:{x:cx,y:projection.heights[indexAt(cx,cy,this.project.width)],z:cy}},normal:normalAt(this.project,projection,cx,cy),
      locked:Boolean(region.locked),protectedBaseCells:protectedCells,supportsObject:{supported:reasons.length===0,reasons,scope:'diagnostic-only-no-entity-placement'}};
  }
}
