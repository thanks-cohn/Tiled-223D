import type {CapabilityManifest, OperationEnvelope, OperationLogEntry, Page, Project, RegionPlaceOperation, RegionSummary} from './programmer.js';
export interface RegionIntent { id:string; kind?:string; width?:number; height?:number; at?:[number,number]; anchor?:{area:'north'|'south'|'east'|'west'|'center'}; lockedAfterAccept?:boolean; referenceId?:string; referenceUse?:string }
export interface PlanRequest extends OperationEnvelope { seed?:number; regions:RegionIntent[] }
export interface WorldPlan { schemaVersion:1; kind:'world-plan'; projectId:string; baseRevision:number; seed:number; operations:RegionPlaceOperation[]; diagnostics:object[]; explanation?:string; alternatives?:string[] }
export declare class AgentWorldApi {
  constructor(project: Project);
  inspectCapabilities(actor:string): CapabilityManifest;
  inspectRegions(actor:string, page?:{offset?:number;limit?:number}): Page<RegionSummary>;
  inspectRegion(actor:string, id:string): RegionSummary & {schemaVersion:1;projectId:string};
  inspectOperations(actor:string, page?:{offset?:number;limit?:number}): Page<OperationLogEntry>;
  inspectPlacementSurface(actor:string, id:string): object;
  explainCell(actor:string, cell:{x:number;y:number}): import('./programmer.js').CellExplanation;
  /** Compatibility summary. `regions` is a first page (maximum 25), not an unbounded array. */
  inspect(actor:string): {schemaVersion:1;projectId:string;revision:number;canvas:{width:number;height:number;unit:'tiled-cell'};regions:{offset:number;limit:number;total:number;items:object[];nextOffset:number|null};regionsTruncated:boolean;capabilities:string[]};
  plan(request: PlanRequest): WorldPlan;
  preview(plan: WorldPlan, options:{actor:string;width?:number;height?:number}): {mediaType:'image/svg+xml';width:number;height:number;artifact:string;diagnostics:object[]};
  commit(request: OperationEnvelope, plan: WorldPlan): ReturnType<typeof import('./programmer.js').applyTransaction>;
}
