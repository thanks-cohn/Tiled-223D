import fs from 'node:fs';
import path from 'node:path';
import {sampleWorld} from '../src/world-data.js';

// The default 500x500 demo is procedural JS, not an existing Tiled file.
// Export it for repeatable assembly tests without overwriting user maps.
const world=sampleWorld();
const tileset=JSON.parse(fs.readFileSync(new URL('../maps/low-town-50x50.json',import.meta.url),'utf8')).tilesets[0];
const layer=(id,name,data)=>({id,name,type:'tilelayer',width:world.width,height:world.height,x:0,y:0,visible:true,opacity:1,data});
const map={type:'map',version:'1.10',tiledversion:'1.11.2',
 orientation:'orthogonal',renderorder:'right-down',width:world.width,height:world.height,
 tilewidth:32,tileheight:32,infinite:false,nextlayerid:4,nextobjectid:3,
 layers:[layer(1,'Ground',Array.from(world.ground)),
 layer(2,'Additions',Array(world.width*world.height).fill(0)),
 {id:3,name:'Spawns',type:'objectgroup',draworder:'topdown',visible:true,opacity:1,
 objects:world.spawns.map((spawn,i)=>({id:i+1,name:'LandingPoint'+spawn.id,type:'landing',
 x:spawn.x*32,y:spawn.z*32,width:0,height:0,point:true}))}],tilesets:[tileset]};
const out=path.resolve('generated');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'starter-500.json'),JSON.stringify(map));
fs.writeFileSync(path.join(out,'starter-elevation.json'),
 JSON.stringify({width:world.width,height:world.height,values:Array.from(world.heights)}));
console.log('Created generated/starter-500.json and generated/starter-elevation.json.');
console.log('Edit the map in Tiled. Keep the original elevation file for the generator.');
