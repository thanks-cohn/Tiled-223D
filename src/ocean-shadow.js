const clamp=n=>Math.max(0,Math.min(1,n));
export function oceanShadowState({ship,mood,world,isOcean,profile}){
 const center={x:ship.x,y:0,z:ship.z},ocean=Boolean(isOcean(center.x,center.z)),sampleRadius=mood.shadow.radius*.72;
 const offsets=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]];
 const oceanCoverage=offsets.reduce((sum,[x,z])=>sum+Number(isOcean(center.x+x*sampleRadius,center.z+z*sampleRadius)),0)/offsets.length;
 const horizonVisible=(profile?.globeReveal??0)<.98||Math.hypot(center.x-ship.x,center.z-ship.z)<(profile?.planetRadius??235)*1.8;
 return {id:"ship-ocean-shadow",policy:"vertical-below",space:"authoritative-ocean-world",physicalShip:{x:ship.x,y:ship.y,z:ship.z},oceanIntersection:center,worldCenter:center,radius:mood.shadow.radius,alpha:ocean&&horizonVisible?clamp(mood.shadow.alpha*oceanCoverage):0,softness:mood.shadow.softness,visible:ocean&&horizonVisible&&oceanCoverage>0&&mood.shadow.alpha>.001,clipping:{ocean,oceanCoverage,maskSamples:offsets.length,frontHemisphere:horizonVisible,shoreMasked:oceanCoverage<1},changeReason:"altitude-curve-and-shore-coverage"};
}
