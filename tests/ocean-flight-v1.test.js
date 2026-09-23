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
 assert.ok(top.whiteStrength<.001,"TOP defaults to negligible white contribution through the smooth overlap");
 assert.ok(high.tonalStrength>.8&&high.families["broad-band"].weight>.8);
 assert.notDeepEqual(low.families,middle.families);assert.notDeepEqual(high.families,top.families);
});

test("wave groups are stable geographic shallow nested bands across altitude, heading and wrap",()=>{
 const family=DEFAULT_OCEAN_PRESET.families["middle-swell"],options={worldWidth:500,worldHeight:500,seed:223,worldScale:1};
 const a=sampleWaveGroup(family,-1,4,options),b=sampleWaveGroup(family,-1,4,options);
 assert.deepEqual(a,b);assert.equal(a.bands.length,2);assert.ok(a.bands.every(band=>band.length===13));
 assert.equal(waveIdentity(family.id,-1,4,500,500,a.seed),waveIdentity(family.id,499,4,500,500,a.seed));
 const large=sampleWaveGroup(family,-1,4,{...options,worldScale:32});assert.equal(a.id,large.id,"world scale changes presentation scale, not source identity");
});

test("V10 default flight renders no under-ship height shadow at any altitude or world mode",()=>{
 assert.equal(DEFAULT_OCEAN_PRESET.shadow.enabled,false,
  "height shadow must remain off for the user-facing default at every scale/altitude");
 assert.equal(cloneOceanPreset().shadow.enabled,false);
 assert.equal(mergeOceanPreset(DEFAULT_OCEAN_PRESET,{moods:{top:{whiteStrength:0}}}).shadow.enabled,false,
  "normal ocean styling must not reenable the retired shadow");
 assert.equal(validateOceanPreset(DEFAULT_OCEAN_PRESET).ok,true);
 // Explicit developer-only inspection/preview can still enable the reversible
 // legacy module; it is not enabled by loading or switching ordinary modes.
 assert.equal(mergeOceanPreset(DEFAULT_OCEAN_PRESET,{shadow:{enabled:true}}).shadow.enabled,true);
});

test("shadow grows and darkens continuously, stays under a hovering ship, and clips off water",()=>{
 const ship={x:12,y:100,z:34},world={};let previous={radius:0,alpha:0};
 for(let i=0;i<=100;i++){const mood=evaluateOceanMood({normalizedAltitude:i/100,speed:0,worldScale:1,preset:DEFAULT_OCEAN_PRESET}),state=oceanShadowState({ship,mood,world,isOcean:()=>true,profile:{planetRadius:235,globeReveal:i/100}});assert.deepEqual(state.worldCenter,{x:12,y:0,z:34});assert.ok(state.radius>=previous.radius&&state.alpha>=previous.alpha);previous=state;}
 const mood=evaluateOceanMood({normalizedAltitude:.5,speed:0,worldScale:1,preset:DEFAULT_OCEAN_PRESET});assert.equal(oceanShadowState({ship,mood,world,isOcean:()=>false,profile:{}}).visible,false);
});

test("visual preset patches cannot contain physical pilot or terrain controls",()=>{
 assert.throws(()=>mergeOceanPreset(DEFAULT_OCEAN_PRESET,{pilot:{x:99}}),/Invalid ocean preset/);
});


test("beauty controls validate and geographic ribbon morphology stays bounded",()=>{
 const family=DEFAULT_OCEAN_PRESET.families["broad-band"];
 assert.equal(family.mode,"tonal");assert.ok(family.width>family.groupSpacing/4);
 const group=sampleWaveGroup(family,2,3,{worldWidth:500,worldHeight:500,seed:223,worldScale:1});
 assert.ok(group.bands.flat().every(point=>point.taper>=0&&point.taper<=1));
 assert.throws(()=>mergeOceanPreset(DEFAULT_OCEAN_PRESET,{families:{"broad-band":{width:100}}}),/Invalid ocean preset/);
 const softer=mergeOceanPreset(DEFAULT_OCEAN_PRESET,{shadow:{softness:.95}});
 assert.equal(softer.shadow.softness,.95);assert.equal(DEFAULT_OCEAN_PRESET.shadow.softness,.84);
});

test("shadow shoreline sampling fades broad footprints without changing their anchor",()=>{
 const mood=evaluateOceanMood({normalizedAltitude:1,speed:0,worldScale:1,preset:DEFAULT_OCEAN_PRESET}),ship={x:0,y:445,z:0};
 const full=oceanShadowState({ship,mood,world:{},isOcean:()=>true,profile:{planetRadius:235,globeReveal:1}});
 const shore=oceanShadowState({ship,mood,world:{},isOcean:(x)=>x<=0,profile:{planetRadius:235,globeReveal:1}});
 assert.deepEqual(shore.worldCenter,full.worldCenter);assert.equal(shore.clipping.maskSamples,9);assert.ok(shore.alpha<full.alpha&&shore.alpha>0);
});
