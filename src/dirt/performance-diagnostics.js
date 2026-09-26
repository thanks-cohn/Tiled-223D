// Runtime-only bounded diagnostic collector. No network, GPU timers or source-file reads.
// Records the true viewer loop and terrain mesh timings instead of modeled budgets.
const MAX_EVENTS=96,MAX_SAMPLES=240;
const round=n=>Math.round(n*100)/100;
export function createDirtPerformanceDiagnostics(){
 let enabled=true,frames=0,lastFrame=NaN,frameStart=NaN,sceneStart=NaN;
 let frameSum=0,frameMax=0,sceneSum=0,sceneMax=0,gaps=0,meshBuilds=0,meshMs=0,meshMax=0;
 let samplingMs=0,triangulationMs=0;
 let terrainSamples=0,meshVertices=0,meshTriangles=0,periodStart=performance.now();
 const events=[],history=[];
 const add=(type,details)=>{events.push({atMs:round(performance.now()-periodStart),frame:frames,type,...details});
  if(events.length>MAX_EVENTS)events.shift();};
 const api={
  get enabled(){return enabled;},
  start(){enabled=true;api.reset();add("capture-start",{});},
  stop(){enabled=false;return api.snapshot();},
  reset(){frames=0;lastFrame=NaN;frameStart=NaN;sceneStart=NaN;frameSum=frameMax=sceneSum=sceneMax=0;
   gaps=meshBuilds=meshMs=meshMax=terrainSamples=meshVertices=meshTriangles=samplingMs=triangulationMs=0;events.length=0;history.length=0;
   periodStart=performance.now();},
  frameBegin(now){if(!enabled)return;frames++;frameStart=performance.now();
   if(Number.isFinite(lastFrame)){
    const gap=now-lastFrame;
    if(gap>100){gaps++;add("frame-gap",{gapMs:round(gap)});}
   }
   lastFrame=now;},
  sceneBegin(){if(enabled)sceneStart=performance.now();},
  frameEnd(){if(!enabled||!Number.isFinite(frameStart))return;
   const end=performance.now(),total=end-frameStart,scene=Number.isFinite(sceneStart)?end-sceneStart:0;
   frameSum+=total;frameMax=Math.max(frameMax,total);sceneSum+=scene;sceneMax=Math.max(sceneMax,scene);
   if(total>50)add("long-frame",{totalMs:round(total),renderMs:round(scene)});
   if(frames%60===0){history.push({frame:frames,totalMs:round(total),averageMs:round(frameSum/frames),maxMs:round(frameMax)});
    if(history.length>MAX_SAMPLES)history.shift();}
   frameStart=sceneStart=NaN;},
  meshBuild(data){if(!enabled)return;meshBuilds++;meshMs+=data.ms;meshMax=Math.max(meshMax,data.ms);
   samplingMs+=data.stages?.samplingMs||0;triangulationMs+=data.stages?.triangulationMs||0;
   terrainSamples+=data.samples;meshVertices+=data.vertices;meshTriangles+=data.triangles;
   add("terrain-mesh-build",{level:data.level,ms:round(data.ms),samples:data.samples,
    vertices:data.vertices,triangles:data.triangles,coordinate:data.coordinate,stages:data.stages||null,cpuWorkMs:round(data.ms),incremental:data.level==="near-chunk",endMs:round(performance.now()-periodStart)});
  },
  event(type,details={}){if(enabled)add(type,details);},
  snapshot(){return {schemaVersion:"dirt-performance-v1",kind:"observed-browser-runtime",
   enabled,elapsedMs:round(performance.now()-periodStart),frames,frameGapsOver100Ms:gaps,
   frame:{averageLoopMs:frames?round(frameSum/frames):null,maxLoopMs:round(frameMax),
    averageRenderMs:frames?round(sceneSum/frames):null,maxRenderMs:round(sceneMax)},
   terrain:{meshBuilds,totalBuildMs:round(meshMs),maxBuildMs:round(meshMax),
    terrainSamples,meshVertices,meshTriangles,stages:{samplingMs:round(samplingMs),triangulationMs:round(triangulationMs),normalGenerationMs:0,normalGenerationReason:"unlit three-tone material needs no computed normals"}},events:events.slice(),history:history.slice(),
   caveats:["Performance timings are main-thread wall time; render time includes CPU render submission, not GPU completion.",
    "No GPU, browser heap or OS memory measurement is available from this collector.",
    "Frame gaps can include background-tab pauses and unrelated browser work.",
    "Saved source and terrain math are not modified by performance capture."]};}
 };
 return api;
}
