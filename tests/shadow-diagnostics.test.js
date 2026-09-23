import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createShadowDiagnostics,detectShadowAnomalies,compareShadowFrames} from "../src/shadow-diagnostics.js";

test("machine-readable shadow trace schema matches runtime version",()=>{
 const schema=JSON.parse(readFileSync(new URL("../Semantic-Bindings/shadow-deep-debug-v1.schema.json",import.meta.url)));
 assert.equal(schema.properties.schemaVersion.const,"1.0.0");assert.ok(schema.required.includes("contributors"));
});

const frame=(id,overrides={})=>({runId:"run-test",frameId:id,timestampMs:id*16,
 physical:{ship:{position:{x:10,y:374,z:20}},scale:{id:"current",relativePosition:{u:.02,v:.04}}},
 shadow:{postClampRadius:12,elongation:1.5,effectiveAlpha:.2,moodWeights:{high:.8}},
 presentation:{mesh:{effectiveRadiusX:18,effectiveRadiusZ:12,opacity:.2,parentId:"scene",resource:{geometryId:"g",materialId:"m",textureId:"t"}},duplicateCount:0},
 projection:{shadow:{viewportAreaFraction:.08}},viewport:{cssWidth:800,cssHeight:600,dpr:1},
 contributors:[{entityId:"base-ocean-globe",viewportBounds:{minU:0,maxU:1,minV:0,maxV:1},overlapsShadow:true},{entityId:"ship-ocean-shadow",viewportBounds:{minU:.4,maxU:.6,minV:.4,maxV:.6},overlapsShadow:true}],...overrides});

test("performance mode does no tracing and deep captures are bounded typed records",()=>{
 let mode="performance",reads=0;const diagnostics={get mode(){return mode;}};
 const collector=createShadowDiagnostics({diagnostics,readFrame:value=>{reads++;return value;},maxFrames:2,maxBytes:20000});
 assert.equal(collector.capture({frame:frame(1)}).error.code,"DIAGNOSTICS_DISABLED");assert.equal(reads,0);assert.equal(collector.stats().captures,0);
 mode="deep";collector.capture({frame:frame(1)});collector.capture({frame:frame(2)});collector.capture({frame:frame(3)});
 assert.equal(reads,3);assert.deepEqual(collector.history({limit:10}).map(x=>x.frameId),[2,3]);assert.equal(collector.inspect().schemaVersion,"1.0.0");
 const contributors=collector.getContributors({viewportPoint:{u:.5,v:.5}});assert.deepEqual(contributors.contributors.map(x=>x.entityId),["base-ocean-globe","ship-ocean-shadow"]);assert.equal(contributors.pixelAttribution,"unverified");
});

test("mismatch, duplicate, parenting, huge projection and non-shadow overlap are detected",()=>{
 const bad=frame(4,{presentation:{mesh:{effectiveRadiusX:99,effectiveRadiusZ:12,opacity:.7,parentId:"camera"},duplicateCount:1},projection:{shadow:{viewportAreaFraction:.9}},contributors:[{entityId:"base-ocean-globe",overlapsShadow:true,unexpectedOverlap:true}]});
 const codes=detectShadowAnomalies(bad).map(x=>x.code);
 for(const expected of ["EFFECTIVE_RADIUS_MISMATCH","WRONG_SHADOW_PARENT","DUPLICATE_SHADOW_MESH","ALPHA_MISMATCH","PROJECTED_FOOTPRINT_FILLS_VIEWPORT","OVERLAPPING_BLUE_CONTRIBUTOR"])assert.ok(codes.includes(expected));
 assert.equal(detectShadowAnomalies(frame(1)).some(x=>x.code==="EFFECTIVE_RADIUS_MISMATCH"),false);
});

test("world scale comparisons report declared relative mapping instead of absolute-jump claims",()=>{
 const before=frame(1),after=frame(2,{physical:{ship:{position:{x:50,y:1870,z:100}},scale:{id:"bigger",relativePosition:{u:.02,v:.04}}}});
 const report=compareShadowFrames(before,after);assert.ok(report.causeCategories.includes("profile/world-scale-transform"));assert.deepEqual(report.declaredScaleMapping.relativeBefore,report.declaredScaleMapping.relativeAfter);
});

test("explanations retain epistemic limits and safe next actions",()=>{
 const diagnostics={mode:"deep"};const collector=createShadowDiagnostics({diagnostics,readFrame:value=>value});collector.capture({frame:frame(9)});
 const explanation=collector.explain({frameId:9,entityId:"base-ocean-globe"});assert.equal(explanation.pixelAttribution,"unverified");assert.equal(explanation.nextActions.length,3);assert.match(explanation.conclusion,/GPU pixel attribution remains unverified/);
 assert.equal(collector.transition(8,9).error.code,"FRAME_NOT_CAPTURED");
});
