import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LAND = new Set([1, 2, 3]);
const idx = (x, y, width) => y * width + x;
const noise = (x, y, seed) => {
  let v = Math.imul(x + 37, 374761393) ^ Math.imul(y + 71, 668265263) ^ Math.imul(seed, 1442695041);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
};
function flatValues(elevation, w, h) {
  if (!elevation) return null;
  const values = Array.isArray(elevation.values?.[0]) ? elevation.values.flat() : elevation.values;
  if (elevation.width !== w || elevation.height !== h || !Array.isArray(values) || values.length !== w * h ||
      values.some(v => !Number.isFinite(v) || Math.abs(v) > 1e9)) throw Error('Elevation grid does not match this map or contains invalid heights.');
  return values;
}
function components(marked, w, h) {
  const seen = new Uint8Array(marked.length), groups = [];
  for (let start = 0; start < marked.length; start++) {
    if (!marked[start] || seen[start]) continue;
    const queue = [start], cells = []; seen[start] = 1;
    let xMin=w,yMin=h,xMax=0,yMax=0;
    for (let head = 0; head < queue.length; head++) {
      const p = queue[head], x = p % w, y = Math.floor(p / w); cells.push(p);
      xMin=Math.min(xMin,x);yMin=Math.min(yMin,y);xMax=Math.max(xMax,x);yMax=Math.max(yMax,y);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx, ny=y+dy; if (nx<0 || ny<0 || nx>=w || ny>=h) continue;
        const n=idx(nx,ny,w); if (marked[n] && !seen[n]) {seen[n]=1;queue.push(n);}
      }
    }
    groups.push({cells,rect:{x:xMin,y:yMin,width:xMax-xMin+1,height:yMax-yMin+1}});
  }
  return groups;
}
/** The Additions layer is a placement marker: no difference guessing required. */
export function assembleLowWorld(map, existingElevation = null, {seed = 1} = {}) {
  if (map?.orientation !== 'orthogonal' || !Number.isInteger(map.width) || !Number.isInteger(map.height) ||
      map.width < 1 || map.height < 1 || map.width * map.height > 1_000_000)
    throw Error('Use a finite orthogonal Tiled map of at most one million tiles.');
  if (!Number.isInteger(seed) || Math.abs(seed) > 1_000_000_000) throw Error('Seed must be an integer between -1 billion and 1 billion.');
  const w=map.width,h=map.height,n=w*h;
  const ground=map.layers?.find(l=>l.name==='Ground' && l.type==='tilelayer');
  const additions=map.layers?.find(l=>l.name==='Additions' && l.type==='tilelayer');
  if (!ground || !additions || !Array.isArray(ground.data) || !Array.isArray(additions.data) ||
      ground.data.length!==n || additions.data.length!==n)
    throw Error('The exported map needs full-size Ground and Additions tile layers. Paste the small map into Additions.');
  const base=ground.data.map((raw,i)=>{
    const id=(raw>>>0)&0x1fffffff;
    if (![1,2,3,4,5,6].includes(id)) throw Error(`Unknown Ground tile at index ${i}; use the terrain-v1 tileset.`);
    return id;
  });
  const overlay=additions.data.map((raw,i)=>{
    const id=(raw>>>0)&0x1fffffff;
    if (id!==0 && !LAND.has(id)) throw Error(`Additions cell ${i} must be empty, grass, dirt, or sand; use matching terrain-v1 tiles.`);
    return id;
  });
  const marked=Uint8Array.from(overlay,v=>Number(v!==0));
  const groups=components(marked,w,h);
  if (!groups.length) throw Error('Additions is empty. Paste the 50 × 50 map Ground layer into Additions before exporting.');
  const original=existingElevation || map.substrateElevation || null;
  const sourceHeights=flatValues(original,w,h);
  const heights=sourceHeights ? sourceHeights.slice() : Array(n).fill(0);
  const output=base.slice();
  const distance=new Int16Array(n).fill(-1), queue=[];
  let oldLandNeighbor=false;
  for (let i=0;i<n;i++) if(marked[i]) {
    output[i]=overlay[i]; distance[i]=0; queue.push(i);
    const x=i%w,y=Math.floor(i/w);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<w&&ny<h&&LAND.has(base[idx(nx,ny,w)])&&!marked[idx(nx,ny,w)]) oldLandNeighbor=true;
    }
  }
  // Local breadth-first distances produce organic beach skirts near the insert.
  for(let head=0;head<queue.length;head++) {
    const p=queue[head],d=distance[p];if(d>=5)continue;
    const x=p%w,y=Math.floor(p/w);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
      const j=idx(nx,ny,w);if(distance[j]!==-1)continue;
      distance[j]=d+1;queue.push(j);
    }
  }
  for(let p=0;p<n;p++) {
    const d=distance[p];if(d<0)continue;
    const x=p%w,y=Math.floor(p/w);
    if(marked[p]) {
      // Preserve original authored heights; new insertions stay low.
      if(sourceHeights && LAND.has(base[p]) && sourceHeights[p]!==0) continue;
      let inherited=0,count=0;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
        const j=idx(nx,ny,w);
        if(!marked[j]&&LAND.has(base[j])&&sourceHeights){inherited+=sourceHeights[j];count++;}
      }
      const low=overlay[p]===3 ? 1.5+noise(x,y,seed)*1.2 : 3+noise(x,y,seed)*3;
      heights[p]=count?Math.max(1,inherited/count + (low-3)*.3):low;
    } else if(base[p]===4 && d>=1 && d<=4) {
      // Preserve existing non-ocean terrain and all original elevations.
      const chance=[0,1,.92,.68,.2][d];
      const broad=Math.sin(x*.19+seed*.37)*.12+Math.cos(y*.23-seed*.21)*.12;
      if(noise(x,y,seed+17) < chance+broad){output[p]=3;heights[p]=Math.max(.35,2.5-d*.52)+noise(x,y,seed+23)*.24;}
    }
  }
  const outputMap={...map,layers:map.layers.filter(l=>l!==additions).map(l=>
    l===ground?{...ground,data:output}:l),
    substrateElevation:{width:w,height:h,values:heights},
    substrateGeneration:{version:1,mode:'low-ground',seed,
      regions:groups.map(g=>({at:[g.rect.x,g.rect.y],size:[g.rect.width,g.rect.height],
        sourceTiles:g.cells.length,connection:oldLandNeighbor?'near existing land':'new low island'}))}};
  return {map:outputMap,regions:outputMap.substrateGeneration.regions,seed,
    warnings:sourceHeights?[]:['No original elevation grid supplied: unchanged land uses flat baseline heights. Supply the original elevation JSON to preserve existing hills.']};
}
async function main(args) {
  const options={};
  for(let i=0;i<args.length;i++){
    if(!args[i].startsWith('--')||!args[i+1])throw Error('Expected --map FILE [--elevation FILE] [--out FILE] [--seed INTEGER].');
    options[args[i].slice(2)]=args[++i];
  }
  if(!options.map)throw Error('Usage: node scripts/assemble-low-world.mjs --map edited-500.json [--elevation original-elevation.json] [--out generated/low-world.json] [--seed 42]');
  const source=JSON.parse(fs.readFileSync(options.map,'utf8'));
  const elev=options.elevation?JSON.parse(fs.readFileSync(options.elevation,'utf8')):null;
  const seed=options.seed===undefined?Math.floor(Math.random()*1_000_000_000):Number(options.seed);
  const result=assembleLowWorld(source,elev,{seed});
  const out=path.resolve(options.out||'generated/low-world.json');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(result.map));
  for(const region of result.regions) console.log(`No heights detected for new ${region.size[0]}×${region.size[1]} region at (${region.at[0]}, ${region.at[1]}). Created ${region.connection}, Low to the ground.`);
  for(const warning of result.warnings)console.warn('NOTE:',warning);
  console.log(`Saved ${out}\nVariation seed: ${seed}. Load this ONE JSON file in the browser viewer using Import Tiled JSON → Load map.`);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch(error=>{console.error('World generator:',error.message);process.exitCode=1;});
