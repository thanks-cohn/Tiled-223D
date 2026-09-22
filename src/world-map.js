import {ID,wrap} from "./world-data.js";

// Ground IDs are authoritative; the canvas is only a cheap 2D presentation.
const COLORS={
 [ID.grass]:[78,146,71], [ID.dirt]:[143,101,67],
 [ID.sand]:[220,190,120], [ID.ocean]:[24,84,141],
 [ID.river]:[55,157,205], [ID.lake]:[68,122,185]
};
export function mapColor(terrain,height=0) {
 const rgb=COLORS[terrain]||[210,75,94];
 const lift=(terrain===ID.grass||terrain===ID.dirt||terrain===ID.sand)
   ?Math.min(48,Math.log1p(Math.max(0,Number.isFinite(height)?height:0))*7):0;
 return rgb.map(c=>Math.min(255,Math.round(c+lift)));
}
export function mapCoordinates(world,x,z) {
 return {x:wrap(x,world.width),z:wrap(z,world.height)};
}
export function createWorldMap({panel,canvas,label,worldGetter,positionGetter,headingGetter}) {
 if(!panel||!canvas||!label)throw Error("Missing map UI");
 const context=canvas.getContext("2d",{alpha:false});
 if(!context)throw Error("2D map canvas is unavailable");
 let visible=false,base=null,builtFor=null;
 const redraw=()=>{
  const world=worldGetter(),w=world.width,h=world.height;
  if(builtFor!==world) {
   canvas.width=w;canvas.height=h;
   const pixels=context.createImageData(w,h);
   for(let i=0;i<world.ground.length;i++) {
    const c=mapColor(world.ground[i],world.heights[i]),p=i*4;
    pixels.data[p]=c[0];pixels.data[p+1]=c[1];pixels.data[p+2]=c[2];pixels.data[p+3]=255;
   }
   // Trees and other sparse overlays are cheap to annotate on the map.
   for(const tree of world.trees||[]) {
    const x=Math.floor(wrap(tree.x,w)),z=Math.floor(wrap(tree.z,h)),i=(z*w+x)*4;
    pixels.data[i]=31;pixels.data[i+1]=94;pixels.data[i+2]=42;
   }
   base=pixels;builtFor=world;
  }
  context.putImageData(base,0,0);
  for(const object of world.objects||[]) {
   if(!Array.isArray(object.at))continue;
   const {x,z}=mapCoordinates(world,object.at[0],object.at[2]);
   const size=Math.max(1,Math.min(w,h)*.009);
   context.strokeStyle="#f9e8b2";context.lineWidth=Math.max(1,size*.45);
   context.beginPath();context.arc(x,z,size,0,Math.PI*2);context.stroke();
  }
  const pos=positionGetter(),p=mapCoordinates(world,pos.x,pos.z),heading=headingGetter();
  const radius=Math.max(1.5,Math.min(w,h)*.012);
  context.fillStyle="#ffed85";context.strokeStyle="#16263c";context.lineWidth=Math.max(1,radius*.4);
  // Ship points toward its actual heading in the map's X-right, Z-down plane.
  context.beginPath();
  const fx=-Math.sin(heading),fz=-Math.cos(heading),rx=-fz,rz=fx;
  context.moveTo(p.x+fx*radius*1.6,p.z+fz*radius*1.6);
  context.lineTo(p.x-fx*radius+rx*radius*.85,p.z-fz*radius+rz*radius*.85);
  context.lineTo(p.x-fx*radius-rx*radius*.85,p.z-fz*radius-rz*radius*.85);
  context.closePath();context.stroke();context.fill();
  label.textContent=world.name+" · "+w+" × "+h+" · Ship X "+p.x.toFixed(1)+" · Z "+p.z.toFixed(1)+" · Alt "+pos.y.toFixed(1);
 };
 return {
  isOpen:()=>visible,
  refreshWorld:()=>{builtFor=null;base=null;if(visible)redraw();},
  open:()=>{redraw();visible=true;panel.hidden=false;},
  close:()=>{visible=false;panel.hidden=true;},
  toggle(){if(visible)this.close();else this.open();}
 };
}
