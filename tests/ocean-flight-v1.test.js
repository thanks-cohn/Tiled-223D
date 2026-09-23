import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_OCEAN_PRESET,cloneOceanPreset,mergeOceanPreset,validateOceanPreset,OCEAN_FAMILY_IDS} from "../src/ocean-visual-presets.js";
import {oceanMoodWeights,evaluateOceanMood} from "../src/ocean-mood-model.js";
import {sampleWaveGroup,waveIdentity} from "../src/ocean-wave-field.js";
import {oceanShadowState} from "../src/ocean-shadow.js";
import {readFileSync} from "node:fs";

test("the versioned preset defines four bounded families and four intentional moods",()=>{
 assert.equal(validateOceanPreset(DEFAULT_OCEAN_PRESET).ok,true);
 assert.deepEqual(Object.keys(DEFAULT_OCEAN_PRESET.families),OCEAN_FAMILY_IDS);
 const broken=cloneOceanPreset();broken.families["near-crest"].density=2;
 assert.equal(validateOceanPreset(broken).ok,false);
 assert.throws(()=>mergeOceanPreset(DEFAULT_OCEAN_PRESET,{shadow:{maxAlpha:1}}),/Invalid ocean preset/);
});

test("machine-readable schema and runtime validator share version and required identities",()=>{
 const schema=JSON.parse(readFileSync(new URL("../Semantic-Bindings/ocean-flight-v1.schema.json",import.meta.url)));
 assert.equal(schema.properties.schemaVersion.const,DEFAULT_OCEAN_PRESET.schemaVersion);
 assert.deepEqual(schema.properties.families.required,OCEAN_FAMILY_IDS);
 assert.deepEqual(schema.properties.moods.required,["low","middle","high","top"]);
 assert.equal(validateOceanPreset(JSON.parse(JSON.stringify(DEFAULT_OCEAN_PRESET))).ok,true);
});

test("mood weights are normalized, smooth, reversible, and compositions stay distinct",()=>{
 let previous=oceanMoodWeights(0);for(let i=1;i<=100;i++){const t=i/100,next=oceanMoodWeights(t);assert.ok(Math.abs(Object.values(next).reduce((a,b)=>a+b,0)-1)<1e-12);for(const id of Object.keys(next))assert.ok(Math.abs(next[id]-previous[id])<.08);previous=next;}
 assert.deepEqual(oceanMoodWeights(.37),oceanMoodWeights(.37));
 const low=evaluateOceanMood({normalizedAltitude:0,speed:0,worldScale:1,preset:DEFAULT_OCEAN_PRESET});
 const middle=evaluateOceanMood({normalizedAltitude:.34,speed:80,worldScale:1,preset:DEFAULT_OCEAN_PRESET});
 const high=evaluateOceanMood({normalizedAltitude:.68,speed:80,worldScale:1,preset:DEFAULT_OCEAN_PRESET});
 const top=evaluateOceanMood({normalizedAltitude:1,speed:80,worldScale:1,preset:DEFAULT_OCEAN_PRESET});
 assert.ok(low.families["near-crest"].weight>.9);assert.ok(middle.families["middle-swell"].weight>.8);assert.ok(high.families["broad-band"].weight>.8);assert.ok(top.families["planetary-contour"].weight>.9);
 assert.ok(low.families["near-crest"].opacity>0,"water structure remains visible at rest");
});

test("wave groups are stable geographic shallow nested bands across altitude, heading and wrap",()=>{
 const family=DEFAULT_OCEAN_PRESET.families["middle-swell"],options={worldWidth:500,worldHeight:500,seed:223,worldScale:1};
 const a=sampleWaveGroup(family,-1,4,options),b=sampleWaveGroup(family,-1,4,options);
 assert.deepEqual(a,b);assert.equal(a.bands.length,3);assert.ok(a.bands.every(band=>band.length===13));
 assert.equal(waveIdentity(family.id,-1,4,500,500,a.seed),waveIdentity(family.id,499,4,500,500,a.seed));
 const large=sampleWaveGroup(family,-1,4,{...options,worldScale:32});assert.equal(a.id,large.id,"world scale changes presentation scale, not source identity");
});

test("shadow grows and darkens continuously, stays under a hovering ship, and clips off water",()=>{
 const ship={x:12,y:100,z:34},world={};let previous={radius:0,alpha:0};
 for(let i=0;i<=100;i++){const mood=evaluateOceanMood({normalizedAltitude:i/100,speed:0,worldScale:1,preset:DEFAULT_OCEAN_PRESET}),state=oceanShadowState({ship,mood,world,isOcean:()=>true,profile:{planetRadius:235,globeReveal:i/100}});assert.deepEqual(state.worldCenter,{x:12,y:0,z:34});assert.ok(state.radius>=previous.radius&&state.alpha>=previous.alpha);previous=state;}
 const mood=evaluateOceanMood({normalizedAltitude:.5,speed:0,worldScale:1,preset:DEFAULT_OCEAN_PRESET});assert.equal(oceanShadowState({ship,mood,world,isOcean:()=>false,profile:{}}).visible,false);
});

test("visual preset patches cannot contain physical pilot or terrain controls",()=>{
 assert.throws(()=>mergeOceanPreset(DEFAULT_OCEAN_PRESET,{pilot:{x:99}}),/Invalid ocean preset/);
});
