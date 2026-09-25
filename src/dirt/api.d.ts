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
