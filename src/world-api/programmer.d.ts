export interface Bounds { x: number; y: number; width: number; height: number }
export interface Provenance { kind: string; seed?: number; referenceId?: string | null; [key: string]: unknown }
export interface Region { id: string; kind?: string; bounds: Bounds; tiles: number[]; heights?: number[]; writeMask?: boolean[]; locked?: boolean; provenance?: Provenance }
export type DebugLevel = 'off'|'regular'|'deep';
export interface TraceStep { sequence:number; code:string; outcome:'allow'|'deny'|'rollback'; facts:Record<string,unknown> }
export interface DiagnosticRecord { schemaVersion:1; code:string; severity:'info'|'warning'|'error'; level:'info'|'warning'|'error'; message:string; phase:string; operationId:string|null; context:{projectId:string|null;revision:number|null}; affected:Record<string,unknown>; suggestedRepair:string|null; repairs:string[]; trace?:{steps:TraceStep[];truncated:boolean;limit:number} }
export interface OperationLogEntry { operationId:string; actor:string; revision:number; kind:'commit'|'undo'; undoToken?:string }
export interface UndoRecord { token:string; revision:number; regions:Region[] }
export interface Project { schemaVersion: 1; projectId: string; revision: number; width: number; height: number; baseGround: number[]; baseHeights: number[]; regions: Region[]; permissions: Record<string,string[]>; operationLog: OperationLogEntry[]; undoStack: UndoRecord[] }
export interface OperationEnvelope { schemaVersion: 1; operationId: string; projectId: string; expectedRevision: number; actor: string; debug?:DebugLevel }
export interface Page<T> { schemaVersion:1;projectId:string;revision:number;offset:number;limit:number;total:number;items:T[];nextOffset:number|null }
export interface RegionSummary { id:string;kind:string;bounds:Bounds;cellCount:number;hasNumericHeights:boolean;locked:boolean;protectedBaseCells:number;provenance:Provenance;revision:number;placementSurfaceId:string }
export interface MapCell { x:number;y:number;terrainId:number;height:number }
export interface CapabilityOperation { type:string;requiredGrant:string;fixture?:true;inputSchemaId:string;outputSchemaId:string }
export interface CapabilityManifest { schemaVersion:1;projectId:string;revision:number;coordinates:object;topology:object;terrain:object;operations:CapabilityOperation[];actor:{id:string;grants:string[]};budgets:Record<string,number>;adapters:object[];limitations:string[] }
export interface RegionPlaceOperation { type: 'region.place'; region: Region; previous: Region | null }
export interface PatchCell { x: number; y: number; terrainId: 1|2|3|4|5|6; height: number }
export declare class ProgrammerWorldApi {
  constructor(project: Project);
  inspectCapabilities(actor:string): CapabilityManifest;
  inspectRegions(actor:string, page?:{offset?:number;limit?:number}): Page<RegionSummary>;
  inspectRegion(actor:string, id:string): RegionSummary & {schemaVersion:1;projectId:string};
  inspectOperations(actor:string, page?:{offset?:number;limit?:number}): Page<OperationLogEntry>;
  inspectPlacementSurface(actor:string, id:string): object;
  inspectMap(actor:string, bounds?: Partial<Bounds>): {schemaVersion:1; projectId:string; revision:number; bounds:Bounds; cells:MapCell[]};
  explainCell(actor:string, cell:{x:number;y:number}): CellExplanation;
  placeRegion(region: Region): RegionPlaceOperation;
  patchCells(change: {id:string; cells:PatchCell[]; locked?:boolean; provenance?:Provenance}): RegionPlaceOperation;
}
export declare function projectProjection(project: Project): {ground:number[]; heights:number[]};
export interface CellExplanation { schemaVersion:1;projectId:string;revision:number;cell:{x:number;y:number};base:{terrainId:number;terrainName:string;elevation:number;protected:boolean;provenance:Provenance};projected:{terrainId:number;terrainName:string;elevation:number;provenance:Provenance};owner:{regionId:string;locked:boolean;provenance:Provenance}|null;writeProposal:{allowed:boolean;reasons:Array<{code:string;message:string}>;snapshotOnly:true;message:string} }
export declare function applyTransaction(project: Project, request: OperationEnvelope, operations: RegionPlaceOperation[]): {project:Project; revision:number; committed?:boolean; idempotent?:boolean; undoToken:string|null; diagnostics?:DiagnosticRecord[]};
export declare function undoTransaction(project: Project, request: OperationEnvelope, token: string): Project;
