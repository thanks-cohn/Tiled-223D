export const DIRT_PROFILES=Object.freeze({
  current:Object.freeze({id:"current",version:1,gapFactor:1}),
  bigger:Object.freeze({id:"bigger",version:1,gapFactor:5}),
  massive:Object.freeze({id:"massive",version:1,gapFactor:32}),
  "expansive-ocean":Object.freeze({id:"expansive-ocean",version:1,gapFactor:12})
});

export function resolveExpansionProfile(worldId,policy={mode:"inherit-world"}){
  const inherited=DIRT_PROFILES[worldId];if(!inherited)throw new Error(`INVALID_PROFILE: ${worldId}`);
  if(policy.mode==="inherit-world")return {...inherited,mode:policy.mode,provenance:`world:${worldId}`};
  if(policy.mode!=="replace"||!DIRT_PROFILES[policy.profileId])throw new Error("INVALID_PROFILE: use inherit-world or one supported replacement");
  const selected=DIRT_PROFILES[policy.profileId];
  return {...selected,mode:"replace",provenance:`landmass:${policy.profileId}`};
}

/** Monotone route mapping: protected intervals keep physical length; only gaps expand. */
export function buildExpansionPlan(production,worldId,policy={mode:"inherit-world"}){
  const profile=resolveExpansionProfile(worldId,policy),features=[...production.features].sort((a,b)=>a.canonical.x-b.canonical.x||a.id.localeCompare(b.id));
  const sourceLength=500,intervals=[];let cursor=0,experienced=0;
  for(const feature of features){const half=feature.geometry.length/2,start=Math.max(cursor,feature.canonical.x-half),end=Math.max(start,feature.canonical.x+half);
    if(start>cursor){const length=start-cursor,expandedLength=length*profile.gapFactor;intervals.push({id:`gap:${intervals.length}`,kind:"gap",sourceStart:cursor,sourceEnd:start,experienceStart:experienced,experienceEnd:experienced+expandedLength});experienced+=expandedLength;}
    const length=end-start;intervals.push({id:`feature:${feature.id}`,kind:"feature",featureId:feature.id,sourceStart:start,sourceEnd:end,experienceStart:experienced,experienceEnd:experienced+length});experienced+=length;cursor=end;
  }
  if(cursor<sourceLength){const length=sourceLength-cursor;intervals.push({id:`gap:${intervals.length}`,kind:"gap",sourceStart:cursor,sourceEnd:sourceLength,experienceStart:experienced,experienceEnd:experienced+length*profile.gapFactor});experienced+=length*profile.gapFactor;}
  return Object.freeze({id:`expansion:${production.id}:${worldId}:${profile.id}:v${profile.version}`,landmassId:production.id,worldId,profile,sourceLength,experienceLength:experienced,intervals:Object.freeze(intervals)});
}

export function mapRouteDistance(plan,value,from="canonical"){
  if(!Number.isFinite(value)||!["canonical","experience"].includes(from))throw new Error("INVALID_COORDINATE_SPACE");
  const fromStart=from==="canonical"?"sourceStart":"experienceStart",fromEnd=from==="canonical"?"sourceEnd":"experienceEnd",toStart=from==="canonical"?"experienceStart":"sourceStart",toEnd=from==="canonical"?"experienceEnd":"sourceEnd";
  const max=from==="canonical"?plan.sourceLength:plan.experienceLength;if(value<0||value>max)throw new Error("INVALID_COORDINATE_SPACE: route distance is out of bounds");
  const interval=plan.intervals.find((entry,index)=>value>=entry[fromStart]&&(value<entry[fromEnd]||index===plan.intervals.length-1));
  if(!interval)return {value:max,interval:null};const width=interval[fromEnd]-interval[fromStart],t=width? (value-interval[fromStart])/width:0;
  return {value:interval[toStart]+t*(interval[toEnd]-interval[toStart]),interval};
}
