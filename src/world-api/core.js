export const WORLD_API_SCHEMA_VERSION = 1;
export const TERRAIN = Object.freeze({ grass: 1, dirt: 2, sand: 3, ocean: 4, river: 5, lake: 6 });
export const ERROR_CODES = Object.freeze({
  invalid: 'INVALID_REQUEST', bounds: 'OUT_OF_BOUNDS', overlap: 'OVERLAP', locked: 'OVERLAP_LOCKED',
  revision: 'REVISION_CONFLICT', permission: 'PERMISSION_DENIED', capacity: 'CAPACITY_EXCEEDED', duplicate: 'DUPLICATE_ID',
  protected: 'PROTECTED_CELL', empty: 'NO_VALID_OPERATIONS', plan: 'PLAN_HAS_DIAGNOSTICS'
});
export const DEBUG_LEVELS = Object.freeze(['off', 'regular', 'deep']);
export const DIAGNOSTIC_BUDGETS = Object.freeze({records: 8, traceSteps: 32, textLength: 512});

export class WorldApiError extends Error {
  constructor(code, message, repairs = []) { super(message); this.name = 'WorldApiError'; this.code = code; this.repairs = repairs; }
}
export const clone = value => structuredClone(value);
export const indexAt = (x, y, width) => y * width + x;
export function assertEnvelope(request, project, capability) {
  if (request?.schemaVersion !== WORLD_API_SCHEMA_VERSION) throw new WorldApiError(ERROR_CODES.invalid, 'schemaVersion must be 1.');
  if (!request.operationId || !request.actor || request.projectId !== project.projectId)
    throw new WorldApiError(ERROR_CODES.invalid, 'operationId, actor and matching projectId are required.');
  if (request.expectedRevision !== project.revision)
    throw new WorldApiError(ERROR_CODES.revision, `Expected revision ${request.expectedRevision}; current revision is ${project.revision}.`, ['Inspect the project and retry against the current revision.']);
  const grants = project.permissions?.[request.actor] || [];
  if (!grants.includes(capability)) throw new WorldApiError(ERROR_CODES.permission, `${request.actor} lacks ${capability} permission.`);
}
export function assertGrant(project, actor, capability = 'inspect') {
  if (!actor || typeof actor !== 'string') throw new WorldApiError(ERROR_CODES.invalid, 'An actor is required for inspection.');
  const grants = project.permissions?.[actor] || [];
  if (!grants.includes(capability)) throw new WorldApiError(ERROR_CODES.permission, `${actor} lacks ${capability} permission.`);
  return grants;
}
export function boundsOverlap(a, b, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
export function validateBounds(bounds, project) {
  for (const key of ['x', 'y', 'width', 'height']) if (!Number.isInteger(bounds?.[key]))
    throw new WorldApiError(ERROR_CODES.invalid, `Region ${key} must be an integer.`);
  if (bounds.width < 1 || bounds.height < 1 || bounds.x < 0 || bounds.y < 0 ||
      bounds.x + bounds.width > project.width || bounds.y + bounds.height > project.height)
    throw new WorldApiError(ERROR_CODES.bounds, 'Region footprint is outside the project canvas.', ['Move or resize the region inside the canvas.']);
}
export function createDiagnosticContext(project, request = {}, phase = 'validation') {
  const debug = DEBUG_LEVELS.includes(request.debug) ? request.debug : 'off';
  const trace = [];
  return {
    debug, phase, operationId: request.operationId || null,
    projectId: project.projectId, revision: project.revision,
    step(code, outcome, facts = {}) {
      if (debug !== 'deep') return;
      if (trace.length < DIAGNOSTIC_BUDGETS.traceSteps) trace.push({sequence:trace.length + 1, code, outcome, facts:clone(facts)});
    },
    trace,
    get truncated(){ return debug === 'deep' && trace.length >= DIAGNOSTIC_BUDGETS.traceSteps; }
  };
}
export function validateRegion(region, project, ignoringId = null, context = null) {
  if (!region?.id || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(region.id)) throw new WorldApiError(ERROR_CODES.invalid, 'Region needs a stable filesystem-safe ID.');
  validateBounds(region.bounds, project);
  context?.step('BOUNDS_CHECK','allow',{regionId:region.id,bounds:region.bounds});
  const size = region.bounds.width * region.bounds.height;
  if (!Array.isArray(region.tiles) || region.tiles.length !== size || region.tiles.some(v => !Object.values(TERRAIN).includes(v)))
    throw new WorldApiError(ERROR_CODES.invalid, `Region ${region.id} must contain exactly ${size} terrain-v1 tile IDs.`);
  if (region.heights != null && (!Array.isArray(region.heights) || region.heights.length !== size || region.heights.some(v => !Number.isFinite(v) || Math.abs(v) > 1e9)))
    throw new WorldApiError(ERROR_CODES.invalid, `Region ${region.id} has an invalid numeric height field.`);
  if (region.writeMask != null && (!Array.isArray(region.writeMask) || region.writeMask.length !== size || region.writeMask.some(v => typeof v !== 'boolean') || !region.writeMask.some(Boolean)))
    throw new WorldApiError(ERROR_CODES.invalid, `Region ${region.id} has an invalid or empty writeMask.`);
  const replacement = project.regions.find(existing => existing.id === ignoringId);
  for (let ry=0; ry<region.bounds.height; ry++) for (let rx=0; rx<region.bounds.width; rx++) {
    const source=ry*region.bounds.width+rx;
    if (region.writeMask && !region.writeMask[source]) continue;
    const x=region.bounds.x+rx, y=region.bounds.y+ry, target=indexAt(x,y,project.width);
    for (const existing of project.regions) if (existing.id !== ignoringId && regionWritesCell(existing,x,y)) {
      const code = existing.locked ? ERROR_CODES.locked : ERROR_CODES.overlap;
      context?.step(existing.locked?'REGION_LOCK_CHECK':'REGION_OWNERSHIP_CHECK','deny',{regionId:region.id,ownerRegionId:existing.id,x,y});
      const error=new WorldApiError(code, `${region.id} edits a cell authored by ${existing.id}${existing.locked ? ', which is locked' : ''}.`, ['Move the proposed cells.', 'Explicitly replace an unlocked region by ID.']); error.affected={regionId:region.id,ownerRegionId:existing.id,cell:{x,y}}; throw error;
    }
    // Ocean at zero elevation is the v1 blank canvas. Non-default source cells are
    // authored facts; only an existing, unlocked region may rewrite its own cells.
    if ((!replacement || !regionWritesCell(replacement,x,y)) && (project.baseGround[target] !== TERRAIN.ocean || project.baseHeights[target] !== 0))
      { context?.step('BASE_PROTECTION_CHECK','deny',{regionId:region.id,x,y}); const error=new WorldApiError(ERROR_CODES.protected, `${region.id} would replace authored base data at (${x}, ${y}).`, ['Choose blank ocean at elevation 0.', 'Edit the source map explicitly outside world API v1.']); error.affected={regionId:region.id,cell:{x,y}}; throw error; }
  }
  context?.step('WRITE_MASK_CHECK','allow',{regionId:region.id,writtenCells:region.writeMask?region.writeMask.filter(Boolean).length:size});
}
export function regionWritesCell(region,x,y) {
  const rx=x-region.bounds.x, ry=y-region.bounds.y;
  if (rx<0||ry<0||rx>=region.bounds.width||ry>=region.bounds.height) return false;
  return !region.writeMask || region.writeMask[ry*region.bounds.width+rx];
}
export function diagnostic(error, context = null) {
  const message=String(error.message||'Request failed.').slice(0,DIAGNOSTIC_BUDGETS.textLength);
  const record={schemaVersion:1,code:error.code||ERROR_CODES.invalid,severity:'error',level:'error',message,
    phase:context?.phase||'request',operationId:context?.operationId||null,
    context:{projectId:context?.projectId||null,revision:context?.revision??null},
    affected:clone(error.affected||{}),suggestedRepair:(error.repairs||[])[0]||null,repairs:(error.repairs||[]).slice(0,4)};
  if(context?.debug==='deep') record.trace={steps:clone(context.trace),truncated:context.truncated,limit:DIAGNOSTIC_BUDGETS.traceSteps};
  return record;
}
