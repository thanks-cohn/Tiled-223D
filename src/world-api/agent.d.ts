import type {OperationEnvelope, Project, RegionPlaceOperation} from './programmer.js';
export interface RegionIntent { id:string; kind?:string; width?:number; height?:number; at?:[number,number]; anchor?:{area:'north'|'south'|'east'|'west'|'center'}; lockedAfterAccept?:boolean; referenceId?:string; referenceUse?:string }
export interface PlanRequest extends OperationEnvelope { seed?:number; regions:RegionIntent[] }
export interface WorldPlan { schemaVersion:1; kind:'world-plan'; projectId:string; baseRevision:number; seed:number; operations:RegionPlaceOperation[]; diagnostics:object[]; explanation?:string; alternatives?:string[] }
export declare class AgentWorldApi {
  constructor(project: Project);
  inspect(): object;
  plan(request: PlanRequest): WorldPlan;
  preview(plan: WorldPlan, size?:{width?:number;height?:number}): {mediaType:'image/svg+xml';width:number;height:number;artifact:string;diagnostics:object[]};
  commit(request: OperationEnvelope, plan: WorldPlan): ReturnType<typeof import('./programmer.js').applyTransaction>;
}

