import {CanvasTexture,SRGBColorSpace,MeshStandardMaterial,PlaneGeometry,CylinderGeometry,Mesh} from 'three';

// Fictional service prints, in the same ink/paper palette as equipment-labels.
// Seven former per-sign textures become one half-1K sheet; nothing redraws per frame.
export const PLANT_LABEL_SIZE=[1024,512];
export const PLANT_LABEL_TILES={
  rack:[0,0,1024,80],filter:[0,80,192,320],uv:[192,80,384,184],
  sensor:[576,80,448,192],nutrientA:[192,264,160,248],nutrientB:[352,264,160,248],
  reservoir:[512,272,512,128],
};
export const PLANT_STENCIL_KEYS=new Set(['rack','uv','sensor','reservoir']);
const cache=new WeakMap(),stencilCache=new WeakMap();

function drawPrint(c,key,w,h){
  const direct=PLANT_STENCIL_KEYS.has(key),ink=direct?'#e7e2cd':'#222d2b',paper=direct?'#182927':'#e7e2cd';
  const green=direct?'#9abbac':'#3b6257',amber='#d3b45d';
  const rect=(x,y,w,h,color=ink)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const text=(value,x,y,size=12,color=ink,weight=500)=>{
    c.fillStyle=color;c.font=`${weight} ${size}px Arial`;c.textAlign='left';c.textBaseline='alphabetic';c.fillText(value,x,y);
  };
  const line=(points,color=ink,width=1)=>{
    c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
  };
  const arrow=(x,y,length=25)=>line([[x,y],[x+length,y],[x+length-5,y-4],[x+length,y],[x+length-5,y+4]]);
  const barcode=(x,y,width,serial)=>{
    let seed=7110;for(const char of serial)seed=(Math.imul(seed,31)+char.charCodeAt(0))>>>0;
    for(let pos=0;pos<width-4;){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const bar=1+seed%3;rect(x+pos,y,bar,15);pos+=bar+2;}
    text(serial,x,y+28,9);
  };
  const hazard=(x,y)=>{line([[x,y],[x-12,y+21],[x+12,y+21],[x,y]],ink,2);text('!',x-2,y+17,15,ink,800);};
  if(!direct){
    rect(0,0,w,h,paper);rect(4,4,w-8,h-8,'#f1eddb');
    c.strokeStyle='#a8a38f';c.lineWidth=1;c.strokeRect(7,7,w-14,h-14);
  }
  if(key==='rack'){
    rect(12,12,81,56,green);text('HP',23,39,25,paper,800);text('03 / BIO',23,58,12,paper,700);
    text('HYDROPONICS',111,45,34,ink,800);text('CLOSED-LOOP CULTIVATION / THREE GROW BEDS',113,63,11);
    line([[459,17],[459,64]],'#a8a38f');
    text('TARAIRON / LIFE SUPPORT',480,32,14,green,700);text('HUMIDITY RECOVERY  >  NUTRIENT RETURN',480,54,12);
    barcode(817,20,179,'HP03-0711 / REV.02');
  }else if(key==='filter'){
    rect(12,12,w-24,45,green);text('01',22,43,27,paper,800);text('RECOVERY',70,30,12,paper,700);text('CIRCUIT',70,46,12,paper);
    text('FILTER',18,89,29,ink,800);text('CONDENSATE',19,110,14,ink,700);text('REPLACEABLE CARTRIDGE',19,129,10);
    // Flow direction and cartridge element, printed rather than modeled.
    c.strokeStyle=ink;c.strokeRect(22,151,50,53);
    for(let x=30;x<70;x+=9)line([[x,156],[x,199]],green);
    arrow(91,177,57);text('IN',91,160,11);text('OUT',137,196,11);
    line([[18,218],[174,218]],'#a8a38f');
    text('ISOLATE LOOP BEFORE',19,239,11,ink,700);text('REMOVING CARTRIDGE',19,254,11,ink,700);
    text('CHANGE / ______  TECH / ___',19,274,9);barcode(19,281,150,'HP-F01 / SERVICE ELEMENT');
  }else if(key==='uv'){
    rect(12,12,w-24,32,green);text('02 / UV TREATMENT',23,35,20,paper,800);
    text('ENCLOSED CHAMBER',21,71,24,ink,800);text('CONDENSATE RECOVERY / HP-UV02',22,92,12);
    line([[16,107],[w-16,107]],amber,2);hazard(35,114);text('CAUTION / UV RADIATION',57,123,14,amber,800);
    text('ISOLATE POWER BEFORE OPENING',57,138,11,ink,700);
    text('KEEP COVER CLOSED',22,165,12,ink,700);text('SERVICE / ______',251,165,11);
  }else if(key==='sensor'){
    rect(12,12,w-24,30,green);text('03 / NUTRIENT LOOP',23,33,18,paper,800);
    text('EC / pH',23,87,40,ink,800);text('SAMPLE MANIFOLD',212,65,15,ink,700);text('HP-S03 / RECIRCULATION',212,87,11);
    line([[22,102],[426,102]],'#a8a38f');
    text('SAMPLE',24,123,12,ink,700);arrow(103,118,29);text('CHECK',150,123,12,ink,700);arrow(223,118,29);text('RETURN',272,123,12,ink,700);
    text('RINSE PROBES AFTER CALIBRATION',24,150,13);
    text('CAL / __________    TECH / ______',24,174,11);text('NON-POTABLE',325,174,10,green,700);
  }else if(key==='nutrientA'||key==='nutrientB'){
    const part=key==='nutrientA'?'A':'B';
    rect(12,12,w-24,29,green);text('NUTRIENT',22,32,16,paper,800);
    text(part,20,109,73,green,800);text('PART',87,74,12,ink,700);text('HP-D0'+(part==='A'?'1':'2'),87,94,9);
    text('DOSING CONCENTRATE',17,132,10,ink,700);line([[17,143],[143,143]],'#a8a38f');
    text('DILUTE SEPARATELY',17,164,10,ink,700);text('DO NOT MIX STOCKS',17,181,10,ink,700);
    barcode(18,194,120,`HP-${part} / LOT 07-218`);
    text('NOT FOR DRINKING',18,235,10,green,700);
  }else if(key==='reservoir'){
    rect(12,12,57,42,green);text('04',21,41,28,paper,800);
    text('NUTRIENT RETURN',82,39,28,ink,800);text('CLOSED LOOP / HP-R04 / NON-POTABLE',83,57,11);
    line([[19,70],[493,70]],'#a8a38f');
    text('FILTER',20,91,12,ink,700);arrow(82,87,20);text('UV',118,91,12,ink,700);arrow(148,87,20);
    text('EC / pH',184,91,12,ink,700);arrow(252,87,20);text('RESERVOIR',287,91,12,ink,700);arrow(389,87,20);text('BEDS',433,91,12,ink,700);
    text('KEEP RETURN LINE CLEAR / CLEAN BETWEEN CROP CYCLES',20,114,11);
  }
  let seed=key.length*7110;for(let i=0;i<80;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=8+(seed%997)/997*(w-16);
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=8+(seed%991)/991*(h-16);
    rect(x,y,2,1,'#71695210');
  }
}

export function createPlantLabelTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');[canvas.width,canvas.height]=PLANT_LABEL_SIZE;
  const c=canvas.getContext('2d');
  for(const [key,[x,y,w,h]]of Object.entries(PLANT_LABEL_TILES)){
    c.save();c.translate(x,y);drawPrint(c,key,w,h);c.restore();
  }
  const map=new CanvasTexture(canvas);map.name='Hydroponics / shared service print atlas';map.colorSpace=SRGBColorSpace;map.anisotropy=4;return map;
}

function matteInk(material){
  // Keep the same restrained highlight range as the toon cabin. Light still
  // darkens the print, but nearby grow lamps must not bleach the dark lettering.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
      'outgoingLight = min(outgoingLight, diffuseColor.rgb * 1.5);\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=> 'hydroponics-matte-ink-v1';
  return material;
}

export function plantLabelMaterial(materials,{stencil=false}={}){
  if(!cache.has(materials)){
    const material=new MeshStandardMaterial({name:'Hydroponics / matte service prints',map:createPlantLabelTexture(),color:0xffffff,roughness:1,metalness:0,envMapIntensity:.1,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    Object.assign(material.userData,{castShadow:false,cabinKeepSurface:true,cabinNoOutline:true});cache.set(materials,matteInk(material));
  }
  if(stencil){
    if(!stencilCache.has(materials)){
      const material=cache.get(materials).clone();material.name='Hydroponics / direct equipment printing';material.alphaTest=.35;material.roughness=.94;
      stencilCache.set(materials,matteInk(material));
    }
    return stencilCache.get(materials);
  }
  return cache.get(materials);
}

export function addPlantLabel(parent,materials,key,{x,y,z,width,height,radius=0}){
  const tile=PLANT_LABEL_TILES[key];if(!tile)throw new Error(`Unknown plant label: ${key}`);
  const angle=radius?width/radius:0,geometry=radius?
    new CylinderGeometry(radius,radius,height,8,1,true,-angle/2,angle):new PlaneGeometry(width,height);
  const uv=geometry.attributes.uv,[tx,ty,tw,th]=tile,[w,h]=PLANT_LABEL_SIZE;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(tx+1+uv.getX(i)*(tw-2))/w,1-(ty+th-1-uv.getY(i)*(th-2))/h);
  const direct=PLANT_STENCIL_KEYS.has(key);
  const mesh=new Mesh(geometry,plantLabelMaterial(materials,{stencil:direct}));mesh.name=`Plant label / ${key}`;mesh.userData.plantLabel=key;mesh.userData.printApplication=direct?'direct':'replaceable label';
  mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
