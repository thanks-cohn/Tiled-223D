import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import * as THREE from 'three';
import {openCompiledAssets} from '../src/dirt/asset-loader.js';
import {fileFetch,loadStored,persistProfile} from '../scripts/dirt-compiled-storage.mjs';
import {compileCanonical,compileProfile,createCompiledSampler,hydrateProduction,sourceKey,CHUNK_SIZE,NEAR_STEP} from '../src/dirt/compiled.js';
import {createChunkScheduler,buildChunk} from '../src/dirt/chunks.js';
import {ProgrammerDirtApi,AgentDirtApi} from '../src/dirt/api.js';
import {makeScaleWorld} from '../src/scale-world.js';
import {sampleWorld,ID} from '../src/world-data.js';
import {validateExpansiveDirt} from '../src/expansive-dirt-land.js';
import {createExpansiveDirtRenderer} from '../src/expansive-dirt-renderer.js';
import {makeHorizonState} from '../src/horizon.js';
const store=await openCompiledAssets('public/dirt/compiled-v1',fileFetch),source=store.source,production=hydrateProduction(source),assets=new Map();
for(const id of ['current','bigger','massive'])assets.set(id,await store.load(id));
const req=(operation,input={},extra={})=>({schemaVersion:'dirt-v1',operation,actorId:'creator',projectId:'demo-world',input,...extra});
function core(){const api=new ProgrammerDirtApi({schemaVersion:'dirt-v1',projectId:'demo-world',revision:0,rules:production.rules,policy:{mode:'inherit-world'},production,history:[]});api.compiledSource=source;api.compiledAssets=new Map(assets);api.compilationExclusions=Object.fromEntries([...assets].map(([id,a])=>[id,a.profile.exclusions]));return api;}

test('saved production preserves actual viewer baseline ramps, mask, elevations and source key',()=>{
 const original=makeScaleWorld(sampleWorld(),'current',validateExpansiveDirt()).expansiveDirt.production;
 assert.deepEqual(production.features,original.features);assert.deepEqual(production.mask,original.mask);assert.equal(production.features.length,37);assert.equal(sourceKey(production),source.metadata.sourceKey);
 const compiled=compileCanonical(production);assert.deepEqual(compiled.tones,source.tones);assert.deepEqual(compiled.heights,source.heights);
});
test('cold/restart loader verifies file digests and refuses missing, corrupt and stale assets',async()=>{
 for(const mode of ['missing','corrupt','stale']){
  const bad=async url=>{if(url.endsWith('heights.f32')){if(mode==='missing')return new Response('',{status:404});const data=fs.readFileSync(url);data[0]^=1;return new Response(data);}if(mode==='stale'&&url.endsWith('manifest.json')){const m=JSON.parse(fs.readFileSync(url));m.schemaVersion='old';return Response.json(m);}return fileFetch(url);};
  await assert.rejects(openCompiledAssets('public/dirt/compiled-v1',bad),/COMPILED/);
 }
 const restart=await openCompiledAssets('public/dirt/compiled-v1',fileFetch);assert.deepEqual((await restart.load('massive')).profile,assets.get('massive').profile);assert.deepEqual(restart.inspect().loaded,['massive']);
});
test('all profiles preserve fixed geometry, source and bounded file sizes without expanded grids',()=>{
 for(const a of assets.values()){
  assert.equal(a.profile.sourceKey,source.metadata.sourceKey);assert.equal(a.atlas.byteLength,250000);assert.equal(a.far.length,8450);
  assert.deepEqual(a.profile.features.map(({x,z,...f})=>f),production.features);
  const recompiled=compileProfile(source,a.profile.worldId,a.profile.policy,a.profile.exclusions);delete recompiled.profile.compileMs;assert.deepEqual(recompiled.profile,a.profile);assert.deepEqual(recompiled.atlas,a.atlas);
 }
 assert.ok(Object.values(store.manifest.files).reduce((n,f)=>n+f.bytes,0)<3_000_000);
});
test('near collision equals actual emitted triangles at fractional contact coordinates',()=>{
 const a=assets.get('current'),sampler=createCompiledSampler(source,a.profile),f=a.profile.features[0],cx=Math.floor(f.x/CHUNK_SIZE),cz=Math.floor(f.z/CHUNK_SIZE),gen=buildChunk(sampler,cx,cz);let next;do{next=gen.next();}while(!next.done);const mesh=next.value;
 for(let n=0;n<mesh.indices.length;n+=3){const ids=mesh.indices.slice(n,n+3),points=[...ids].map(i=>Array.from(mesh.positions.slice(i*3,i*3+3))),x=points.reduce((s,p)=>s+p[0],0)/3,z=points.reduce((s,p)=>s+p[2],0)/3,y=points.reduce((s,p)=>s+p[1],0)/3;assert.ok(Math.abs(sampler(x,z).height-y)<2e-6);}
});
test('ramp contacts, reversal, wrapping and original islands remain protected at all scales',()=>{
 const local=sampleWorld();
 for(const [id,a] of assets){const scene=makeScaleWorld(local,id,validateExpansiveDirt(),{mode:'inherit-world'},{source,asset:a}),sample=scene.sampleExpansiveDirt;
  for(const f of a.profile.features){assert.equal(sample(f.x,f.z).ramp,f.id);assert.equal(scene.groundAt(f.x,f.z).height,sample(f.x,f.z).height);assert.ok(Math.abs(sample(f.x+a.profile.size,f.z+a.profile.size).height-sample(f.x,f.z).height)<1e-9);}
  for(const p of scene.nav.placements){assert.equal(sample(p.x,p.z).ground,ID.ocean);assert.equal(scene.groundAt(p.x,p.z).ground,local.ground[Math.floor(p.localZ)*500+Math.floor(p.localX)]);}
 }
});
test('chunk scheduler obeys cache bound, permits reversal and never constructs a 9409-vertex job',()=>{
 const a=assets.get('massive'),sampler=createCompiledSampler(source,a.profile),scheduler=createChunkScheduler(sampler,{maxEntries:3,budgetMs:2});
 for(let x=490;x<500;x++){scheduler.request([[x,500]]);for(let i=0;i<100&&!scheduler.ready(x*16,8000);i++)scheduler.tick();assert.ok(scheduler.ready(x*16,8000));assert.ok(scheduler.cache.size<=3);assert.ok([81,4225].includes(scheduler.cache.get(`${x},500`).samples));}
 assert.ok(scheduler.snapshot().evictions>=7);scheduler.dispose();assert.equal(scheduler.cache.size,0);
});
test('compiler APIs enforce grants/revisions, atomic publication and color-only physical reuse',()=>{
 const api=core(),plan=api.execute(req('dirt.planCompilation',{worldId:'bigger'})).result;
 assert.equal(api.execute(req('dirt.compileProfile',{plan},{actorId:'agent',expectedRevision:0,operationId:'denied'})).error.code,'UNAUTHORIZED');
 assert.equal(api.execute(req('dirt.compileProfile',{plan},{expectedRevision:1,operationId:'stale'})).error.code,'STALE_REVISION');
 const old=api.compiledAssets.get('bigger');const bad={...plan,policy:{mode:'replace',profileId:'missing'}};assert.equal(api.execute(req('dirt.compileProfile',{plan:bad},{expectedRevision:0,operationId:'bad'})).status,'error');assert.equal(api.compiledAssets.get('bigger'),old);
 api.state.rules={...api.state.rules,palette:['#663322','#996633','#442211']};api.state.production={...production,rules:api.state.rules};
 const changed=api.execute(req('dirt.compileProfile',{plan},{expectedRevision:0,operationId:'color'}));assert.equal(changed.status,'ok');assert.equal(api.compiledSource.heights,source.heights);assert.deepEqual(api.compiledSource.metadata.palette,api.state.rules.palette);assert.equal(api.compiledAssets.get('massive'),assets.get('massive'));
});
test('custom replacement compiles independently and never stacks inherited expansion',()=>{
 const api=core(),policy={mode:'replace',profile:{id:'custom:wide',version:2,gapFactor:7}};
 const plan=api.execute(req('dirt.planCompilation',{worldId:'bigger',policy}));assert.equal(plan.status,'ok');assert.equal(plan.result.effectiveProfile.gapFactor,7);assert.equal(plan.result.viewerCompatible,false);
 const compiled=api.execute(req('dirt.compileProfile',{plan:plan.result},{expectedRevision:0,operationId:'custom'}));assert.equal(compiled.status,'ok');assert.equal(api.compiledAssets.get('current'),assets.get('current'));
});
test('source edits mark assets stale; core, programmer and agent report actual capabilities',()=>{
 const api=core();assert.equal(api.execute(req('dirt.inspectRuntimePerformance')).error.code,'RUNTIME_UNAVAILABLE');
 assert.equal(api.execute(req('dirt.inspectPhysicalAt',{worldId:'massive',coordinateSpace:'world',position:{x:10,z:10}})).error.code,'INVALID_COORDINATE_SPACE');
 assert.equal(api.execute(req('dirt.validateCompiledTerrain',{worldId:'massive'})).result.valid,true);
 assert.equal(api.execute(req('dirt.diffCompiledProfiles')).result.sameSource,true);
 api.state.production={...production,sourceRevision:2};assert.equal(api.execute(req('dirt.inspectCompiledAsset')).error.code,'STALE_COMPILED_ASSET');
 const agent=new AgentDirtApi(api.state);assert.equal(agent.execute(req('dirt.planCompilation',{}, {actorId:'agent'})).status,'ok');
});
test('file-backed compilation persists and reloads safely through the real CLI',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dirt-compile-'));try{
  const api=core(),plan=api.execute(req('dirt.planCompilation',{worldId:'current'})).result,requestPath=path.join(temp,'request.json');
  fs.writeFileSync(requestPath,JSON.stringify(req('dirt.compileProfile',{plan},{expectedRevision:0,operationId:'persist'})));
  const run=spawnSync(process.execPath,['scripts/dirt-api-cli.mjs','--request',requestPath,'--state',path.join(temp,'state.json'),'--compiled-dir',path.join(temp,'compiled')],{encoding:'utf8'});assert.equal(run.status,0,run.stderr+run.stdout);const response=JSON.parse(run.stdout);assert.equal(response.result.persisted,true);
  const loaded=await openCompiledAssets(response.result.persistence.directory,fileFetch);assert.equal((await loaded.load('current')).profile.sourceKey,source.metadata.sourceKey);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('renderer selects prepared far buffers, reuses bounded chunks and disposes resources',()=>{
 const scene=new THREE.Scene(),renderer=createExpansiveDirtRenderer(scene,makeHorizonState()),a=assets.get('current'),world=makeScaleWorld(sampleWorld(),'current',validateExpansiveDirt(),{mode:'inherit-world'},{source,asset:a});renderer.rebuild(world);
 const f=a.profile.features[0];for(let i=0;i<100;i++)renderer.update({x:f.x,z:f.z,y:20});assert.ok(renderer.readyAt(f.x,f.z));assert.ok(renderer.snapshot().cache.entries<=96);
 for(const mesh of scene.children){const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};mesh.material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('dirtPalette'));}
 renderer.dispose();assert.equal(scene.children.length,0);
});

test('published compilation envelopes and responses satisfy the actual JSON schema',async()=>{
 const {default:Ajv}=await import('ajv'),ajv=new Ajv(),schema=JSON.parse(fs.readFileSync('schemas/compiled-terrain-v1.schema.json')),validate=ajv.compile(schema),success=ajv.compile({definitions:schema.definitions,$id:'success-test', $ref:'#/definitions/success'}),api=core();
 for(const file of ['plan-compilation','inspect-compilation','validate-compiled']){const request=JSON.parse(fs.readFileSync(`API/Dirt/examples/${file}.json`));assert.ok(validate(request),JSON.stringify(validate.errors));const response=api.execute(request);assert.equal(response.status,'ok');assert.ok(success(response),JSON.stringify(success.errors));}
 const plan=api.execute(req('dirt.planCompilation')).result;assert.ok(validate(req('dirt.compileProfile',{plan},{expectedRevision:0,operationId:'schema'})));
});
