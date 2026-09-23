import {OCEAN_FAMILY_IDS,OCEAN_MOOD_IDS} from "./ocean-visual-presets.js";
const clamp=n=>Math.max(0,Math.min(1,n));
const smoother=n=>{n=clamp(n);return n*n*n*(n*(n*6-15)+10);};
export function oceanMoodWeights(normalizedAltitude){
 if(!Number.isFinite(normalizedAltitude))throw Error("Altitude must be finite");
 const t=clamp(normalizedAltitude),centers=[0,.34,.68,1],raw=centers.map((c,i)=>i===0?clamp(1-t/.34):i===3?clamp((t-.68)/.32):clamp(1-Math.abs(t-c)/.34)).map(smoother);
 const total=raw.reduce((a,b)=>a+b,0)||1;return Object.fromEntries(OCEAN_MOOD_IDS.map((id,i)=>[id,raw[i]/total]));
}
export function evaluateOceanMood({normalizedAltitude,speed=0,worldScale=1,preset}){
 if(!preset||![speed,worldScale].every(Number.isFinite)||worldScale<=0)throw Error("Invalid ocean mood input");
 const moods=oceanMoodWeights(normalizedAltitude),families={};
 for(const id of OCEAN_FAMILY_IDS){let weight=0;for(const mood of OCEAN_MOOD_IDS)weight+=moods[mood]*preset.moods[mood].weights[id];const source=preset.families[id];families[id]={id,weight:clamp(weight),opacity:source.alpha*clamp(.58+Math.log1p(Math.abs(speed))/8),worldGrid:source.grid*Math.pow(worldScale,.16),worldLength:source.length*Math.pow(worldScale,.22)};}
 const t=clamp(normalizedAltitude);return {normalizedAltitude:t,moods,families,shadow:{radius:preset.shadow.minRadius+(preset.shadow.maxRadius-preset.shadow.minRadius)*smoother(t),alpha:preset.shadow.minAlpha+(preset.shadow.maxAlpha-preset.shadow.minAlpha)*smoother(t),softness:preset.shadow.softness},explanation:`${Object.entries(moods).sort((a,b)=>b[1]-a[1])[0][0]} mood; actual travel ${Math.abs(speed).toFixed(1)} world units/s`};
}
