import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {openCompiledAssets} from '../src/dirt/asset-loader.js';
export const fileFetch=async url=>{try{return new Response(fs.readFileSync(url));}catch{return new Response('',{status:404});}};
export async function loadStored(core,dir='generated/dirt-compiled'){
 const shipped=await openCompiledAssets('public/dirt/compiled-v1',fileFetch);
 core.compiledSource=shipped.source;core.compiledAssets=new Map();core.compilationExclusions={};
 for(const id of ['current','bigger','massive']){const a=await shipped.load(id);core.compiledAssets.set(id,a);core.compilationExclusions[id]=a.profile.exclusions;}
 const index=path.join(dir,'index.json');if(fs.existsSync(index)){
  const entries=JSON.parse(fs.readFileSync(index));
  for(const [id,key] of Object.entries(entries)){if(!/^[0-9a-f]{8}$/.test(key)||!['current','bigger','massive'].includes(id))throw Error('INVALID_COMPILED_MANIFEST');const stored=await openCompiledAssets(path.join(dir,key),fileFetch);const a=await stored.load(id);if(stored.source.metadata.sourceKey===core.compiledSource.metadata.sourceKey||stored.source.metadata.sourceKey===a.profile.sourceKey){core.compiledSource=stored.source;core.compiledAssets.set(id,a);}}
 }
 return shipped;
}
export function persistProfile(core,worldId,dir='generated/dirt-compiled'){
 const source=core.compiledSource,a=core.compiledAssets.get(worldId),key=a.profile.key,final=path.join(dir,key),temp=path.join(dir,`${key}.tmp-${process.pid}`),files={};
 fs.mkdirSync(temp,{recursive:true});
 function write(name,data){const b=typeof data==='string'?Buffer.from(data):Buffer.from(data.buffer,data.byteOffset,data.byteLength);fs.writeFileSync(path.join(temp,name),b);files[name]={path:name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
 try{write('canonical.json',JSON.stringify(source.metadata));write('tones.bin',source.tones);write('heights.f32',source.heights);write(`${worldId}.json`,JSON.stringify(a.profile));write(`${worldId}.tones.bin`,a.atlas);write(`${worldId}.overview.bin`,a.overviewAtlas);write(`${worldId}.far.f32`,a.far);
  const profiles={[worldId]:{key,metadata:`${worldId}.json`,atlas:`${worldId}.tones.bin`,overview:`${worldId}.overview.bin`,far:`${worldId}.far.f32`}};
  fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify({schemaVersion:'compiled-terrain-v1',sourceKey:source.metadata.sourceKey,canonical:'canonical.json',tones:'tones.bin',heights:'heights.f32',profiles,files},null,2));
  // Content-addressed immutable generation; only the tiny catalog is replaced.
  if(!fs.existsSync(final))fs.renameSync(temp,final);else fs.rmSync(temp,{recursive:true});
  const indexPath=path.join(dir,'index.json'),entries=fs.existsSync(indexPath)?JSON.parse(fs.readFileSync(indexPath)):{};entries[worldId]=key;
  fs.writeFileSync(`${indexPath}.tmp`,JSON.stringify(entries,null,2));fs.renameSync(`${indexPath}.tmp`,indexPath);
  return {directory:final,manifest:path.join(final,'manifest.json'),bytes:Object.values(files).reduce((n,f)=>n+f.bytes,0)};
 }catch(e){fs.rmSync(temp,{recursive:true,force:true});throw e;}
}
