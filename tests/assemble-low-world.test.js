import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assembleLowWorld} from '../scripts/assemble-low-world.mjs';
import {sampleWorld,fromTiled,cell,ID} from '../src/world-data.js';

const idx=(x,y,w)=>y*w+x;
function fixture(){
 const w=120,h=110,n=w*h,ground=Array(n).fill(4),additions=Array(n).fill(0),values=Array(n).fill(0);
 for(let y=7;y<18;y++)for(let x=8;x<20;x++){const i=idx(x,y,w);ground[i]=1;values[i]=75;}
 for(let y=35;y<85;y++)for(let x=35;x<85;x++){
  const dx=x-60,dy=y-60;
  if(Math.hypot(dx,dy)<22+Math.sin(y*.43)*2+Math.cos(x*.31)*2) additions[idx(x,y,w)]=1;
 }
 const layer=(name,data)=>({name,type:'tilelayer',width:w,height:h,data});
 return {orientation:'orthogonal',width:w,height:h,
  layers:[layer('Ground',ground),layer('Additions',additions)],
  substrateElevation:{width:w,height:h,values}};
}

test('new pasted region becomes low island; existing terrain heights and source remain unchanged',()=>{
 const source=fixture(),{map,regions}=assembleLowWorld(source,null,{seed:42});
 assert.equal(regions.length,1);
 assert.deepEqual(regions[0].at,[36,35]);
 assert.equal(map.layers.length,1);
 assert.equal(map.layers[0].data[idx(60,60,120)],1);
 assert.ok(map.substrateElevation.values[idx(60,60,120)]>0);
 assert.equal(map.layers[0].data[idx(8,8,120)],1);
 assert.equal(map.substrateElevation.values[idx(8,8,120)],75);
 assert.equal(map.layers[0].data[idx(1,1,120)],4);
 assert.equal(map.substrateElevation.values[idx(1,1,120)],0);
 assert.ok(map.layers[0].data.some((id,i)=>id===3&&source.layers[0].data[i]===4));
 assert.equal(source.layers[0].data[idx(60,60,120)],4,'source must remain unchanged');
});

test('different generation seeds produce varied but coherent terrain and fixed seeds reproduce it',()=>{
 const source=fixture();
 const a=assembleLowWorld(source,null,{seed:11}).map;
 const b=assembleLowWorld(source,null,{seed:11}).map;
 const c=assembleLowWorld(source,null,{seed:12}).map;
 assert.deepEqual(a.substrateElevation.values,b.substrateElevation.values);
 assert.notDeepEqual(a.substrateElevation.values,c.substrateElevation.values);
 assert.equal(a.layers[0].data[idx(8,8,120)],c.layers[0].data[idx(8,8,120)]);
 assert.equal(a.substrateElevation.values[idx(8,8,120)],c.substrateElevation.values[idx(8,8,120)]);
});

test('reject unprocessed map, unknown painted semantics and mismatched height grids',()=>{
 const map=fixture();
 assert.throws(()=>assembleLowWorld({...map,layers:[map.layers[0]]}),/Additions/);
 const bad=fixture();bad.layers[1].data[idx(60,60,120)]=7;
 assert.throws(()=>assembleLowWorld(bad),/grass, dirt, or sand/);
 assert.throws(()=>assembleLowWorld(map,{width:3,height:3,values:Array(9).fill(0)}),/Elevation grid/);
 assert.throws(()=>fromTiled(map),/unprocessed Additions/);
});

test('full 500x500 workflow: a real 50x50 Tiled asset is placed in ocean and browser importer loads numeric heights',()=>{
 const existing=sampleWorld();
 const asset=JSON.parse(fs.readFileSync(new URL('../maps/low-town-50x50.json',import.meta.url),'utf8'));
 const placed=Array(500*500).fill(0),x0=220,z0=135;
 for(let z=0;z<50;z++)for(let x=0;x<50;x++)
   placed[(z0+z)*500+x0+x]=asset.layers[0].data[z*50+x];
 const source={orientation:'orthogonal',width:500,height:500,tilewidth:32,tileheight:32,
   layers:[{type:'tilelayer',name:'Ground',data:Array.from(existing.ground)},
           {type:'tilelayer',name:'Additions',data:placed}],
   substrateElevation:{width:500,height:500,values:Array.from(existing.heights)}};
 const result=assembleLowWorld(source,null,{seed:97});
 const loaded=fromTiled(result.map);
 assert.ok(result.regions.length>=1);
 assert.equal(cell(loaded,x0+24,z0+24).ground,ID.dirt);
 assert.ok(cell(loaded,x0+24,z0+24).height>0);
 assert.equal(cell(loaded,145,235).height,cell(existing,145,235).height);
 assert.equal(cell(loaded,245,250).ground,ID.ocean);
 assert.equal(result.map.substrateGeneration.seed,97);
});
