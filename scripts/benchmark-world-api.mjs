import {performance} from 'node:perf_hooks';
import {ProgrammerWorldApi} from '../src/world-api/programmer.js';
import {TERRAIN} from '../src/world-api/core.js';
const width=500,height=500,regions=[];
for(let n=0;n<100;n++){const x=(n*47)%490,y=(n*83)%490;regions.push({id:`r${n}`,bounds:{x,y,width:10,height:10},tiles:Array(100).fill(TERRAIN.grass),heights:Array(100).fill(n),writeMask:Array(100).fill(true),provenance:{kind:'benchmark'}});}
const project={schemaVersion:1,projectId:'benchmark-500',revision:0,width,height,baseGround:Array(width*height).fill(TERRAIN.ocean),baseHeights:Array(width*height).fill(0),regions,permissions:{bench:['inspect','commit']},operationLog:[],undoStack:[]};
const api=new ProgrammerWorldApi(project);
function run(name,count,fn){global.gc?.();const before=process.memoryUsage().heapUsed,start=performance.now();for(let i=0;i<count;i++)fn(i);const elapsed=performance.now()-start,delta=process.memoryUsage().heapUsed-before;console.log(JSON.stringify({name,iterations:count,elapsedMs:+elapsed.toFixed(3),meanMs:+(elapsed/count).toFixed(4),heapDeltaBytes:delta}));}
console.log(JSON.stringify({environment:{node:process.version,platform:process.platform,arch:process.arch,world:'500x500',regions:regions.length,gcExposed:Boolean(global.gc)}}));
run('explain-cell',1000,i=>api.explainCell('bench',{x:i%500,y:(i*17)%500}));
run('inspect-map-1x1',1000,i=>api.inspectMap('bench',{x:i%500,y:(i*17)%500,width:1,height:1}));
run('inspect-map-64x64',20,i=>api.inspectMap('bench',{x:(i*7)%437,y:(i*11)%437,width:64,height:64}));
