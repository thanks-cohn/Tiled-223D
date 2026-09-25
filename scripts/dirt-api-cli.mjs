#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createDirtState,DirtWorldCore,serializeDirtState} from "../src/dirt/api.js";

const arg=(name)=>{const i=process.argv.indexOf(`--${name}`);return i<0?null:process.argv[i+1];};
const requestPath=arg("request"),statePath=path.resolve(arg("state")||"generated/dirt-api-state.json");
if(!requestPath){console.error("Usage: npm run dirt-api -- --request request.json [--state generated/dirt-api-state.json]");process.exit(2);}
const saved=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,"utf8")):{};
const core=new DirtWorldCore(createDirtState(saved)),request=JSON.parse(fs.readFileSync(path.resolve(requestPath),"utf8")),response=core.execute(request);
if(response.status==="ok"&&["dirt.commitPlan","dirt.undo"].includes(request.operation)){fs.mkdirSync(path.dirname(statePath),{recursive:true});const temp=`${statePath}.tmp`;fs.writeFileSync(temp,JSON.stringify(serializeDirtState(core.state),null,2));fs.renameSync(temp,statePath);}
console.log(JSON.stringify(response,null,2));if(response.status!=="ok")process.exitCode=1;

export const cliPath=fileURLToPath(import.meta.url);
