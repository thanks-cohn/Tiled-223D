// Shared semantic altitude presentation. This is VISUAL ONLY: no change to
// terrain geometry, world size, island positions, collision or ship momentum.
// Four atmospheric decks stay identifiable across four overlapping flight moods.
export const ATMOSPHERE_BANDS=Object.freeze([
 Object.freeze({id:"cinematic-hover",range:[0,110],mood:"calm open ocean and majestic high sky"}),
 Object.freeze({id:"active-flight",range:[65,225],mood:"near-cloud rush and growing parallax"}),
 Object.freeze({id:"expansive-ascent",range:[160,390],mood:"layered depth; clouds above and below"}),
 Object.freeze({id:"planetary",range:[300,2000],mood:"planet centered; subtle surface cloud bands"})
]);
export const CLOUD_LAYERS=Object.freeze([
 Object.freeze({id:"low",height:72,wind:0.36,relativeMotion:1,
  role:"reachable fly-through formations and near-field acceleration cues",count:9}),
 Object.freeze({id:"middle",height:153,wind:0.15,relativeMotion:0.46,
  role:"mid-depth parallax and soft cinematic overcast",count:6}),
 Object.freeze({id:"high",height:282,wind:0.045,relativeMotion:0.12,
  role:"enormous slow-drifting clouds visible even when hovering at sea level",count:6}),
 Object.freeze({id:"planetary",height:12,wind:0.018,relativeMotion:0.035,
  role:"cheap globe-following cloud cards seen from above",count:6})
]);
export function smoothBand(a,b,value){
 if(![a,b,value].every(Number.isFinite)||b<=a)throw Error("Invalid altitude band");
 const t=Math.min(1,Math.max(0,(value-a)/(b-a)));
 return t*t*(3-2*t);
}
export function altitudeCloudProfile(altitude,globeReveal=0){
 if(!Number.isFinite(altitude)||!Number.isFinite(globeReveal))
  throw Error("Invalid cloud altitude");
 const a=smoothBand(65,110,altitude);
 const b=smoothBand(160,225,altitude);
 const c=smoothBand(300,390,altitude);
 const moods=[1-a,a*(1-b),b*(1-c),c];
 const [hover,active,ascent,orbit]=moods;
 const layers={
  low:.82*hover+.96*active+.32*ascent,
  middle:.72*hover+.88*active+.89*ascent+.14*orbit,
  high:.86*hover+.9*active+.95*ascent+.18*orbit,
  planetary:(.25*ascent+.85*orbit)*Math.min(1,Math.max(0,globeReveal))
 };
 const dominant=ATMOSPHERE_BANDS[moods.indexOf(Math.max(...moods))].id;
 return {moods,layers,dominant};
}
// Spatial separation is the chief source of real apparent speed. These
// configured values also bound decorative wind/parallax in each cloud deck.
export function apparentCloudMotion(layerId,altitude,shipSpeed){
 const layer=CLOUD_LAYERS.find(x=>x.id===layerId);
 if(!layer||![altitude,shipSpeed].every(Number.isFinite))
  throw Error("Invalid cloud motion input");
 const proximity=1/(1+Math.abs(altitude-layer.height)/90);
 return Math.abs(shipSpeed)*proximity*layer.relativeMotion+layer.wind;
}
export const CLOUD_RENDER_BUDGET=Object.freeze({
 sprites:CLOUD_LAYERS.reduce((sum,layer)=>sum+layer.count,0),
 sharedTextures:4,volumetricPasses:0
});
