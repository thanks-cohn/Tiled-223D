export interface Bounds { x: number; y: number; width: number; height: number }
export interface Provenance { kind: string; seed?: number; referenceId?: string | null; [key: string]: unknown }
export interface Region { id: string; kind?: string; bounds: Bounds; tiles: number[]; heights?: number[]; writeMask?: boolean[]; locked?: boolean; provenance?: Provenance }
export interface Project { schemaVersion: 1; projectId: string; revision: number; width: number; height: number; baseGround: number[]; baseHeights: number[]; regions: Region[]; permissions: Record<string,string[]>; operationLog: object[]; undoStack: object[] }
export interface OperationEnvelope { schemaVersion: 1; operationId: string; projectId: string; expectedRevision: number; actor: string }
export interface RegionPlaceOperation { type: 'region.place'; region: Region; previous: Region | null }
export interface PatchCell { x: number; y: number; terrainId: 1|2|3|4|5|6; height: number }
export declare class ProgrammerWorldApi {
  constructor(project: Project);
  inspectMap(bounds?: Partial<Bounds> & {limit?: number}): {schemaVersion:1; projectId:string; revision:number; bounds:Bounds; cells:Array<PatchCell>};
  placeRegion(region: Region): RegionPlaceOperation;
  patchCells(change: {id:string; cells:PatchCell[]; locked?:boolean; provenance?:Provenance}): RegionPlaceOperation;
}
export declare function projectProjection(project: Project): {ground:number[]; heights:number[]};
export declare function applyTransaction(project: Project, request: OperationEnvelope, operations: RegionPlaceOperation[]): {project:Project; revision:number; committed?:boolean; idempotent?:boolean; undoToken:string|null; diagnostics?:object[]};
export declare function undoTransaction(project: Project, request: OperationEnvelope, token: string): Project;
