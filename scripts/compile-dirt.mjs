import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sampleWorld} from '../src/world-data.js';
import {makeScaleWorld} from '../src/scale-world.js';
import {validateExpansiveDirt} from '../src/expansive-dirt-land.js';
import {compileCanonical,compileProfile,hydrateProduction} from '../src/dirt/compiled.js';
const out=path.resolve('public/dirt/compiled-v1');fs.mkdirSync(out,{recursive:true});
// Existing saved geography wins on every subsequent reproducible build.
const savedPath=path.join(out,'canonical.json');
const saved=fs.existsSync(savedPath)?{metadata:JSON.parse(fs.readFileSync(savedPath)),tones:new Uint8Array(fs.readFileSync(path.join(out,'tones.bin')))}:null;
const production=saved?hydrateProduction(saved):makeScaleWorld(sampleWorld(),'current',validateExpansiveDirt()).expansiveDirt.production;
const source=compileCanonical(production),files={};
function write(name,data){const buffer=typeof data==='string'?Buffer.from(data):Buffer.from(data.buffer,data.byteOffset,data.byteLength);fs.writeFileSync(path.join(out,name),buffer);files[name]={path:name,bytes:buffer.byteLength,sha256:createHash('sha256').update(buffer).digest('hex')};}
// Timings are observations in the build report, excluded from deterministic assets.
const canonicalMs=source.metadata.compileMs;delete source.metadata.compileMs;
write('canonical.json',JSON.stringify(source.metadata));write('tones.bin',source.tones);write('heights.f32',source.heights);
const profiles={};for(const worldId of ['current','bigger','massive']){
 const world=makeScaleWorld(sampleWorld(),worldId,validateExpansiveDirt());
 const asset=compileProfile(source,worldId,undefined,world.nav.placements.map(p=>({x:p.x,z:p.z,radius:p.radius+10})));
 const ms=asset.profile.compileMs;delete asset.profile.compileMs;
 write(`${worldId}.json`,JSON.stringify(asset.profile));write(`${worldId}.tones.bin`,asset.atlas);write(`${worldId}.far.f32`,asset.far);write(`${worldId}.overview.bin`,asset.overviewAtlas);
 profiles[worldId]={key:asset.profile.key,metadata:`${worldId}.json`,atlas:`${worldId}.tones.bin`,far:`${worldId}.far.f32`,overview:`${worldId}.overview.bin`};
 console.log(JSON.stringify({worldId,compileMs:ms,features:asset.profile.features.length}));
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({schemaVersion:'compiled-terrain-v1',sourceKey:source.metadata.sourceKey,canonical:'canonical.json',tones:'tones.bin',heights:'heights.f32',profiles,files},null,2)+'\n');
console.log(JSON.stringify({canonicalCompileMs:canonicalMs,bytes:Object.values(files).reduce((n,f)=>n+f.bytes,0)}));
