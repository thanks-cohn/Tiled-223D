import test from "node:test";
import assert from "node:assert/strict";
import {
 ATMOSPHERE_BANDS,CLOUD_LAYERS,CLOUD_RENDER_BUDGET,
 altitudeCloudProfile,apparentCloudMotion,smoothBand
} from "../src/atmosphere-model.js";

test("four semantic cloud decks and four cinematic altitude moods are explicit",()=>{
 assert.deepEqual(CLOUD_LAYERS.map(layer=>layer.id),[
  "low","middle","high","planetary"
 ]);
 assert.deepEqual(ATMOSPHERE_BANDS.map(band=>band.id),[
  "cinematic-hover","active-flight","expansive-ascent","planetary"
 ]);
 assert.equal(CLOUD_RENDER_BUDGET.sprites,27);
 assert.equal(CLOUD_RENDER_BUDGET.sharedTextures,1);
 assert.equal(CLOUD_RENDER_BUDGET.volumetricPasses,0);
 assert.ok(CLOUD_LAYERS.every(layer=>layer.count>0&&layer.height>=0));
});

test("hover remains cinematic with reachable and overhead high clouds",()=>{
 const p=altitudeCloudProfile(34,0);
 assert.equal(p.dominant,"cinematic-hover");
 assert.ok(p.layers.low>.8);
 assert.ok(p.layers.middle>.7);
 assert.ok(p.layers.high>.8);
 assert.equal(p.layers.planetary,0);
 assert.ok(CLOUD_LAYERS[2].height>CLOUD_LAYERS[0].height);
});

test("four heights change cloud roles gradually without hard visibility pops",()=>{
 const low=altitudeCloudProfile(34,0);
 const active=altitudeCloudProfile(125,0);
 const high=altitudeCloudProfile(260,.3);
 const orbit=altitudeCloudProfile(465,1);
 assert.equal(active.dominant,"active-flight");
 assert.equal(high.dominant,"expansive-ascent");
 assert.equal(orbit.dominant,"planetary");
 assert.ok(active.layers.low>low.layers.low);
 assert.ok(high.layers.middle>low.layers.middle);
 assert.ok(high.layers.planetary>0);
 assert.ok(orbit.layers.planetary>high.layers.planetary);
 assert.ok(orbit.layers.low<.002);
 assert.ok(orbit.layers.high>0);
 for(let altitude=0;altitude<550;altitude+=.25){
  const a=altitudeCloudProfile(altitude,Math.min(1,altitude/445));
  const b=altitudeCloudProfile(altitude+.25,Math.min(1,(altitude+.25)/445));
  const total=a.moods.reduce((sum,n)=>sum+n,0);
  assert.ok(Math.abs(total-1)<1e-9,"mood weights no longer partition altitude");
  for(const id of CLOUD_LAYERS.map(layer=>layer.id)){
   assert.ok(a.layers[id]>=0&&a.layers[id]<=1,`Invalid layer alpha ${id}`);
   assert.ok(Math.abs(a.layers[id]-b.layers[id])<.013,
    `Popping cloud layer at ${altitude}: ${id}`);
  }
 }
});

test("near clouds move faster perceptually than overhead and planet decks",()=>{
 const near=apparentCloudMotion("low",65,140);
 const mid=apparentCloudMotion("middle",65,140);
 const high=apparentCloudMotion("high",65,140);
 const planet=apparentCloudMotion("planetary",65,140);
 assert.ok(near>mid&&mid>high&&high>planet);
 assert.ok(apparentCloudMotion("low",65,240)>near);
 assert.throws(()=>apparentCloudMotion("unknown",30,10),/Invalid/);
 assert.throws(()=>smoothBand(2,2,2),/Invalid/);
});

test("a non-globe altitude never draws projected planetary clouds",()=>{
 assert.equal(altitudeCloudProfile(260,0).layers.planetary,0);
 assert.equal(altitudeCloudProfile(500,0).layers.planetary,0);
 assert.ok(altitudeCloudProfile(500,1).layers.planetary>.8);
 assert.throws(()=>altitudeCloudProfile(Number.NaN),/Invalid/);
});
