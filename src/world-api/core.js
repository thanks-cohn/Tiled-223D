export const WORLD_API_SCHEMA_VERSION = 1;
export const TERRAIN = Object.freeze({ grass: 1, dirt: 2, sand: 3, ocean: 4, river: 5, lake: 6 });
export const ERROR_CODES = Object.freeze({
  invalid: 'INVALID_REQUEST', bounds: 'OUT_OF_BOUNDS', overlap: 'OVERLAP', locked: 'OVERLAP_LOCKED',
  revision: 'REVISION_CONFLICT', permission: 'PERMISSION_DENIED', capacity: 'CAPACITY_EXCEEDED', duplicate: 'DUPLICATE_ID',
  protected: 'PROTECTED_CELL', empty: 'NO_VALID_OPERATIONS', plan: 'PLAN_HAS_DIAGNOSTICS'
});

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
export function validateRegion(region, project, ignoringId = null) {
  if (!region?.id || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(region.id)) throw new WorldApiError(ERROR_CODES.invalid, 'Region needs a stable filesystem-safe ID.');
  validateBounds(region.bounds, project);
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
      throw new WorldApiError(code, `${region.id} edits a cell authored by ${existing.id}${existing.locked ? ', which is locked' : ''}.`, ['Move the proposed cells.', 'Explicitly replace an unlocked region by ID.']);
    }
    // Ocean at zero elevation is the v1 blank canvas. Non-default source cells are
    // authored facts; only an existing, unlocked region may rewrite its own cells.
    if ((!replacement || !regionWritesCell(replacement,x,y)) && (project.baseGround[target] !== TERRAIN.ocean || project.baseHeights[target] !== 0))
      throw new WorldApiError(ERROR_CODES.protected, `${region.id} would replace authored base data at (${x}, ${y}).`, ['Choose blank ocean at elevation 0.', 'Edit the source map explicitly outside world API v1.']);
  }
}
export function regionWritesCell(region,x,y) {
  const rx=x-region.bounds.x, ry=y-region.bounds.y;
  if (rx<0||ry<0||rx>=region.bounds.width||ry>=region.bounds.height) return false;
  return !region.writeMask || region.writeMask[ry*region.bounds.width+rx];
}
export function diagnostic(error) {
  return { level: 'error', code: error.code || ERROR_CODES.invalid, message: error.message, repairs: error.repairs || [] };
}
