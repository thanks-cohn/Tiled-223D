const clamp=n=>Math.max(0,Math.min(1,n));
export function oceanShadowState({ship,mood,world,isOcean,profile}){
 const center={x:ship.x,y:0,z:ship.z},ocean=Boolean(isOcean(center.x,center.z)),sampleRadius=mood.shadow.radius*.72;
 const offsets=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]];
 const coverageSamples=offsets.map(([x,z])=>{const point={x:center.x+x*sampleRadius,y:0,z:center.z+z*sampleRadius};return {...point,ocean:Boolean(isOcean(point.x,point.z))};});
 const oceanCoverage=coverageSamples.reduce((sum,sample)=>sum+Number(sample.ocean),0)/offsets.length;
 const horizonVisible=(profile?.globeReveal??0)<.98||Math.hypot(center.x-ship.x,center.z-ship.z)<(profile?.planetRadius??235)*1.8;
 return {id:"ship-ocean-shadow",policy:"vertical-below-flat-canonical-y0",space:"authoritative-ocean-world",units:"world-units",surfacePolicy:{surfaceId:"canonical-ocean",height:0,normal:{x:0,y:1,z:0},sampled:false,assumptions:["navigation ocean is flat at canonical Y=0","horizon curvature is visual-only"]},physicalShip:{x:ship.x,y:ship.y,z:ship.z},oceanIntersection:center,worldCenter:center,preClampRadius:mood.shadow.radius,postClampRadius:mood.shadow.radius,radius:mood.shadow.radius,alpha:ocean&&horizonVisible?clamp(mood.shadow.alpha*oceanCoverage):0,softness:mood.shadow.softness,coverageSamples,visible:ocean&&horizonVisible&&oceanCoverage>0&&mood.shadow.alpha>.001,clipping:{ocean,oceanCoverage,maskSamples:offsets.length,frontHemisphere:horizonVisible,shoreMasked:oceanCoverage<1},changeReason:"altitude-curve-and-shore-coverage"};
}
