import {COMPILED_VERSION,COMPILER_VERSION,coherence} from './compiled.js';
export async function openCompiledAssets(base='/dirt/compiled-v1',fetcher=fetch){
 async function get(name){const r=await fetcher(`${base}/${name}`);if(!r.ok)throw Error(`MISSING_COMPILED_ASSET: ${name}`);return r;}
 const manifest=await (await get('manifest.json')).json();
 if(manifest.schemaVersion!==COMPILED_VERSION)throw Error('INVALID_COMPILED_MANIFEST');
 async function bytes(name){const f=manifest.files[name];if(!f||f.path!==name||name.includes('..'))throw Error('INVALID_COMPILED_MANIFEST');
  const b=await (await get(name)).arrayBuffer();if(b.byteLength!==f.bytes)throw Error(`CORRUPT_COMPILED_ASSET: ${name}`);
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');if(sha!==f.sha256)throw Error(`CORRUPT_COMPILED_ASSET: ${name}`);return b;}
 const [m,t,h]=await Promise.all([bytes(manifest.canonical),bytes(manifest.tones),bytes(manifest.heights)]);
 const source={metadata:JSON.parse(new TextDecoder().decode(m)),tones:new Uint8Array(t),heights:new Float32Array(h)};
 if(source.metadata.sourceKey!==manifest.sourceKey||source.metadata.compilerVersion!==COMPILER_VERSION||source.tones.length!==250000||source.heights.length!==501*501)throw Error('STALE_COMPILED_ASSET');
 const cache=new Map();
 return {manifest,source,async load(worldId){
  if(cache.has(worldId))return cache.get(worldId);
  const record=manifest.profiles[worldId];if(!record)throw Error('MISSING_COMPILED_PROFILE');
  const [j,a,f,o]=await Promise.all([bytes(record.metadata),bytes(record.atlas),bytes(record.far),bytes(record.overview)]);
  const asset={profile:JSON.parse(new TextDecoder().decode(j)),atlas:new Uint8Array(a),far:new Float32Array(f),overviewAtlas:new Uint8Array(o)};
  if(asset.profile.sourceKey!==source.metadata.sourceKey||asset.profile.key!==record.key||asset.profile.worldId!==worldId||asset.profile.compilerVersion!==COMPILER_VERSION||asset.atlas.length!==250000||asset.far.length!==65*65*2)throw Error('STALE_COMPILED_ASSET');
  asset.paths={metadata:record.metadata,atlas:record.atlas,far:record.far};asset.fileBytes=[record.metadata,record.atlas,record.far,record.overview].reduce((n,p)=>n+manifest.files[p].bytes,0);
  cache.clear();cache.set(worldId,asset);return asset;
 },inspect(){return {sourceKey:manifest.sourceKey,loaded:[...cache.keys()],profiles:manifest.profiles,files:manifest.files};}};
}
