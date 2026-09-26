export type DirtCoordinateSpace = 'canonical'|'world'|'experience'|'render-local';
export type DirtActorGrant = 'inspect'|'plan'|'commit'|'undo';
export interface DirtRequest { schemaVersion:'dirt-v1'; operation:string; actorId:string; projectId:string; landmassId?:'dirt-landmass-01'; operationId?:string; expectedRevision?:number; input?:Record<string,unknown>; }
export interface DirtSuccess { status:'ok'; capabilityVersion:'dirt-v1'; operation:string; revision:number; result:unknown; }
export interface DirtFailure { status:'error'; capabilityVersion:'dirt-v1'; error:{code:string;message:string;[key:string]:unknown}; }
export type DirtResponse=DirtSuccess|DirtFailure;
export declare function createDirtState(saved?:Record<string,unknown>): Record<string,unknown>;
export declare class DirtWorldCore { state:Record<string,unknown>; constructor(state?:Record<string,unknown>,permissions?:Record<string,DirtActorGrant[]>); execute(request:DirtRequest):DirtResponse; }
export declare class ProgrammerDirtApi extends DirtWorldCore {}
export declare class AgentDirtApi extends DirtWorldCore {}
export declare function serializeDirtState(state:Record<string,unknown>):Record<string,unknown>;

export type CompiledWorldId='current'|'bigger'|'massive';
export type CompiledPolicy={mode:'inherit-world'}|{mode:'replace';profileId:string}|{mode:'replace';profile:{id:`custom:${string}`;version:number;gapFactor:number}};
export interface CompilationPlan {kind:'compiled-profile';schemaVersion:'compiled-terrain-v1';baseRevision:number;sourceKey:string;worldId:CompiledWorldId;policy:CompiledPolicy;committable:boolean;viewerCompatible:boolean;estimatedBytes:number;nearStep:0.25;baseStep:2;maxChunkEntries:96;}
export interface CompiledAssetInspection {schemaVersion:'compiled-terrain-v1';assetId:string;worldId:CompiledWorldId;sourceKey:string;sourceRevision:number;fixedFeatures:number;gaps:number;bytes:{canonical:number;profile:number};valid:boolean;collisionReady:boolean;nearStep:number;}
export interface CompiledContact {worldId:CompiledWorldId;coordinateSpace:'experience';position:{x:number;z:number};assetId:string;sourceKey:string;nearVisualHeight:number;nearInterpolationError:0;analyticHeight:number;analyticDifference:number;farCollisionReady:false;}
