import {ProgrammerWorldApi, applyTransaction} from '../src/world-api/programmer.js';
import {TERRAIN} from '../src/world-api/core.js';

const project={schemaVersion:1,projectId:'diagnostic-example',revision:0,width:2,height:2,baseGround:[4,1,4,4],baseHeights:[0,7,0,0],regions:[],permissions:{agent:['inspect','commit']},operationLog:[],undoStack:[]};
const api=new ProgrammerWorldApi(project);
console.log(JSON.stringify(api.explainCell('agent',{x:1,y:0}),null,2));
const operation={type:'region.place',region:{id:'example',bounds:{x:1,y:0,width:1,height:1},tiles:[TERRAIN.sand],heights:[1],locked:false},previous:null};
for(const debug of ['regular','deep']) {
  const result=applyTransaction(project,{schemaVersion:1,operationId:`example-${debug}`,projectId:project.projectId,expectedRevision:0,actor:'agent',debug},[operation]);
  console.log(JSON.stringify({debug,diagnostic:result.diagnostics[0]},null,2));
}
