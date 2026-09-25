import test from "node:test";
import assert from "node:assert/strict";
import {AgentDirtApi,createDirtState,ProgrammerDirtApi} from "../src/dirt/api.js";

const request=(operation,input={},extra={})=>({schemaVersion:"dirt-v1",operation,actorId:"creator",projectId:"demo-world",landmassId:"dirt-landmass-01",input,...extra});

test("programmer and agent surfaces expose bounded truthful dirt capabilities",()=>{
  const state=createDirtState(),programmer=new ProgrammerDirtApi(state),agent=new AgentDirtApi(state);
  const capabilities=programmer.execute(request("dirt.capabilities"));
  assert.equal(capabilities.status,"ok");assert.ok(capabilities.result.operations.every(x=>x.implemented));
  assert.ok(capabilities.result.unsupported.includes("arbitrary-2d-warp"));
  assert.equal(agent.execute(request("dirt.listFeatures",{limit:101})).error.code,"QUERY_LIMIT_EXCEEDED");
  const list=agent.execute(request("dirt.listFeatures",{limit:3}));assert.equal(list.result.items.length,3);assert.ok(list.result.nextOffset);
});

test("inspection identifies canonical source, fixed geometry and collision authority",()=>{
  const api=new AgentDirtApi(createDirtState()),diff=api.execute(request("dirt.diffWorldScales",{limit:3}));
  assert.equal(diff.result.invariants.samePhysicalGeometry,true);
  const feature=diff.result.scales[0].features[0],at=api.execute(request("dirt.explainAt",{coordinateSpace:"canonical",position:feature.canonical}));
  assert.equal(at.result.samples[0].ramp,feature.id);assert.equal(at.result.samples[0].collisionAuthority,"canonical-height-sampler");
});

test("replacement plan commit is revisioned, permission checked, non-stacking and undoable",()=>{
  const state=createDirtState(),api=new ProgrammerDirtApi(state),planned=api.execute(request("dirt.planExpansion",{worldId:"massive",policy:{mode:"replace",profileId:"expansive-ocean"}}));
  assert.equal(planned.result.plan.profile.gapFactor,12);
  const denied=new DirtWorldCoreForTest(state).execute({...request("dirt.commitPlan",{plan:planned.result}),actorId:"agent",expectedRevision:0,operationId:"denied"});assert.equal(denied.error.code,"UNAUTHORIZED");
  const committed=api.execute({...request("dirt.commitPlan",{plan:planned.result}),expectedRevision:0,operationId:"policy-1"});assert.equal(committed.result.committed,true);assert.equal(state.revision,1);
  const stale=api.execute({...request("dirt.commitPlan",{plan:planned.result}),expectedRevision:0,operationId:"stale"});assert.equal(stale.error.code,"STALE_REVISION");
  const undone=api.execute({...request("dirt.undo",{undoToken:committed.result.undoToken}),expectedRevision:1,operationId:"undo-1"});assert.equal(undone.result.undone,true);assert.equal(state.policy.mode,"inherit-world");
});

// Use the exported class behavior while retaining the default agent grants.
class DirtWorldCoreForTest extends AgentDirtApi {}

test("hand-crafted canonical changes cannot bypass validation",()=>{
  const api=new ProgrammerDirtApi(createDirtState());
  const invalid={kind:"canonical-regeneration",baseRevision:0,rules:{targetWholeWorldCoverage:.9}};
  const result=api.execute({...request("dirt.commitPlan",{plan:invalid}),expectedRevision:0,operationId:"bad"});
  assert.equal(result.status,"error");assert.equal(api.state.revision,0);
});
