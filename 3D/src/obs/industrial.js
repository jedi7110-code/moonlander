import * as THREE from 'three';
import {box,ball,cylinder,pipe,rod} from './materials.js';
import {CABIN_AISLE,DECK} from './layout.js';
import {CABIN_LIGHT_COLOR,CABIN_WARM_LIGHT_COLOR,CABIN_DECK_LIGHT} from './lighting.js';

const WORK_LIGHTS=[[-10.3,29],[-7.35,18],[-4.4,25],[-1.65,16],[1.75,16],[4.3,32],[7.6,18],[10.9,27]];
const LOUNGE_LIGHTS=[6.25,8.65];

// Local, deterministic surface maps: no downloads or per-frame texture work.
function surfaceMaps(kind,baseImage) {
  const painted=kind==='paint';
  let seed=kind==='paint'?7710:4903;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const make=()=>{const c=document.createElement('canvas');c.width=c.height=1024;return c;};
  const color=make(),rough=make(),bump=make();
  const c=color.getContext('2d'),r=rough.getContext('2d'),b=bump.getContext('2d');
  for(const ctx of [c,r,b])ctx.scale(2,2);
  c.fillStyle=painted?'#deddd3':'#646765';c.fillRect(0,0,512,512);
  // Keep the ivory paint dominant; the aged base supplies only subtle variation.
  if(baseImage){c.globalAlpha=painted?.42:1;c.drawImage(baseImage,0,0,512,512);c.globalAlpha=1;}
  r.fillStyle=kind==='paint'?'#c0c0c0':'#949494';r.fillRect(0,0,512,512);
  b.fillStyle='#808080';b.fillRect(0,0,512,512);
  for(let i=0;i<13500;i++){
    const x=random()*512,y=random()*512,v=45+random()*170;
    c.fillStyle=`rgba(${v},${v},${v},${(.015+random()*.09)*(painted?.30:1)})`;
    c.fillRect(x,y,1+random()*3,kind==='paint'?1+random()*3:.6);
  }
  // Dirt collects under joints; exposed paint edges carry irregular chips.
  for(let i=0;i<(painted?18:32);i++){
    const side=random()<.5,x=side?random()*16:496+random()*16,y=random()*512;
    const w=2+random()*12,h=1+random()*6;
    const exposed=random()<.7;
    c.fillStyle=painted?(exposed?'#777b7180':'#98908180'):(exposed?'#444740':'#746552');c.fillRect(x,y,w,h);
    b.fillStyle=painted?'#727272':'#484848';b.fillRect(x,y,w,h);
    r.fillStyle=painted?'#adadad':'#707070';r.fillRect(x,y,w,h);
  }
  for(let i=0;i<(painted?8:18);i++){
    const x=random()*512,nearJoint=random()<.6,y=painted?random()*35:(nearJoint?random()*35:random()*512),len=12+random()*(painted?75:170);
    const g=c.createLinearGradient(0,y,0,y+len);g.addColorStop(0,painted?'#292b2424':'#292b2460');g.addColorStop(1,'#292b2400');
    c.fillStyle=g;c.fillRect(x,y,1+random()*6,len);
    r.fillStyle=painted?'#aeaeae':'#747474';r.fillRect(x,y,1+random()*3,len*.6);
  }
  for(let i=0;i<(painted?70:180);i++){
    c.strokeStyle=painted?'#eeeadb1c':'#dad4bc30';c.lineWidth=.5+random();c.beginPath();
    const x=random()*512,y=random()*512;c.moveTo(x,y);c.lineTo(x+random()*18,y+random()*2);c.stroke();
  }
  const maps=[color,rough,bump].map((canvas,i)=>{
    const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;
    if(i===0)map.colorSpace=THREE.SRGBColorSpace;
    return map;
  });
  return {map:maps[0],roughnessMap:maps[1],bumpMap:maps[2]};
}

export function industrialMaterials(source){
  const warmLamp=source.lamp.clone();warmLamp.name='Lounge warm diffuser';
  warmLamp.color.setHex(CABIN_WARM_LIGHT_COLOR);warmLamp.emissive.setHex(CABIN_WARM_LIGHT_COLOR);warmLamp.emissiveIntensity=2.2;
  const paint=surfaceMaps('paint',(source.shipPaint?.map??source.enamel.map)?.image),steel=surfaceMaps('steel',source.metal.map?.image);
  const make=(name,color,roughness,metalness,maps,extra={})=>{
    const material=new THREE.MeshStandardMaterial({color,roughness,metalness,...maps,bumpScale:.009,envMapIntensity:.46,...extra});
    material.name='Industrial / '+name;return material;
  };
  // Inherit character/fixture materials; weathering overrides only ship surfaces.
  return Object.assign(Object.create(source),{
    warmLamp,
    enamel:make('worn ivory',0xd3d2c5,.91,.35,paint,{bumpScale:.004}),
    dark:make('structural iron',0x4b4a40,.87,.72,steel),
    metal:make('brushed steel',0xb5b0a0,.68,.82,steel),
    white:make('equipment enamel',0xdeded2,.84,.18,paint,{bumpScale:.004}),
    rubber:make('rubber',0x131714,.9,.04,steel,{bumpScale:.003}),
    wetSteel:make('wet chain',0x697477,.24,.92,steel,{envMapIntensity:1.15,bumpScale:.004}),
    pipeSteel:make('pipe casing',0x85836f,.65,.75,steel),
    cable:make('cable jacket',0x151b19,.42,.12,steel,{bumpScale:.002}),
    brass:make('aged brass',0x9c7840,.54,.8,steel),
    rope:make('cargo rope',0x89785b,.98,0,{}),
    wetFloor:new THREE.MeshPhysicalMaterial({name:'Industrial / wet floor',color:0x343d39,roughness:.20,metalness:.5,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:.85,...steel,bumpScale:.004}),
  });
}

function flange(root,m,x,y,z,r){
  const disc=cylinder(root,m.pipeSteel,x,y,z,r*1.46,.055,r*1.46,16);disc.rotation.z=Math.PI/2;
  for(let i=0;i<6;i++){
    const angle=i*Math.PI/3;
    const bolt=cylinder(root,m.metal,x+.04,y+Math.sin(angle)*r*1.18,z+Math.cos(angle)*r*1.18,.018,.06,.018,6);bolt.rotation.z=Math.PI/2;
  }
}

function cableRun(root,m,left,right,y,z,count=4,sag=.42){
  for(let i=0;i<count;i++){
    const offset=i*.061,mid=(left+right)/2,drop=sag+(i%3)*.033;
    pipe(root,m.cable,[[left,y-offset,z],[left+.30,y-.11-offset,z+.07],[mid-.40+(i%2)*.23,y-drop-offset,z+.14+i*.028],[right-.25,y-.12-offset,z+.06],[right,y-offset,z]],.029+i*.009);
    for(const x of [left+.06,right-.06])box(root,m.metal,x,y-.08-offset,z+.035,.10,.16,.12,.012);
  }
}

function chain(root,m,x,top,bottom,z){
  const geometry=new THREE.TorusGeometry(.064,.018,6,12);
  geometry.scale(1,1.43,1);
  for(let i=0,y=top;y>bottom;y-=.123,i++){
    const mesh=new THREE.Mesh(geometry,m.wetSteel);mesh.position.set(x+Math.sin(i*.17)*.012,y,z);
    mesh.rotation.y=i%2?Math.PI/2:.12;mesh.castShadow=true;root.add(mesh);
  }
}

function hoist(root,m,x,y){
  const z=2.86;
  box(root,m.dark,x,y+2.91,z,.74,.13,.43,.03);
  for(const dx of [-.25,.25]){const wheel=cylinder(root,m.metal,x+dx,y+2.96,z,.11,.20,.11,12);wheel.rotation.x=Math.PI/2;}
  box(root,m.yellow,x,y+2.62,z,.43,.43,.28,.06);
  for(const dx of [-.12,.12]){const stripe=box(root,m.dark,x+dx,y+2.62,z+.15,.07,.37,.012);stripe.rotation.z=-.45;}
  chain(root,m,x-.12,y+2.43,y+.63,z);chain(root,m,x+.12,y+2.43,y+1.03,z+.05);
  // Open hook, rather than another closed chain link.
  const hook=new THREE.Mesh(new THREE.TorusGeometry(.11,.031,8,18,Math.PI*1.55),m.wetSteel);
  hook.position.set(x-.12,y+.57,z);hook.rotation.z=.4;root.add(hook);
}

export function addIndustrialDeck(root,m,y,level){
  const front=CABIN_AISLE.deckFront+.19;
  if(level===DECK.HABITATION)for(const x of LOUNGE_LIGHTS){
    for(const dx of [-.47,.47])rod(root,m.dark,[x+dx,y+2.98,-.08],[x+dx,y+2.69,-.08],.022);
    box(root,m.dark,x,y+2.68,-.08,1.26,.13,.43,.025).name='Lounge overhead light housing';
    box(root,m.metal,x,y+2.603,-.08,1.15,.026,.38);
    box(root,m.warmLamp,x,y+2.58,-.08,1.06,.025,.30).name='Lounge overhead diffuser';
  }
  for(const [x] of WORK_LIGHTS){
    box(root,m.dark,x,y+2.78,.37,.89,.14,.49,.03).name='Ceiling work light housing';
    box(root,m.metal,x,y+2.70,.37,.80,.055,.41,.015);
    box(root,level===DECK.OPERATIONS?m.coolLamp:m.lamp,x,y+2.66,.37,.71,.024,.32,.008).name='Ceiling work light diffuser';
    for(const dx of [-.27,0,.27])rod(root,m.dark,[x+dx,y+2.64,.16],[x+dx,y+2.64,.58],.012);
  }
  // Deep front fascia and overhead trunking flank the open ladder shaft.
  for(const side of [-1,1]){
    const center=side*6.88;
    box(root,m.dark,center,y-.23,front,12.56,.31,.22,.02);
    box(root,m.pipeSteel,center,y-.10,front+.025,12.56,.055,.27);
    rod(root,m.pipeSteel,[side*.74,y+3.08,1.85],[side*12.9,y+3.08,1.85],.102);
    for(let x=1.1;x<12.8;x+=1.43){
      flange(root,m,side*x,y+3.08,1.85,.102);
      box(root,m.dark,side*x,y+3.16,1.87,.08,.22,.35);
      const screw=cylinder(root,m.metal,side*x,y-.23,front+.13,.023,.025,.023,6);screw.rotation.x=Math.PI/2;
    }
  }
  // Reinforced rear ribs leave the two movement lanes unobstructed.
  for(const x of [-12.62,-6.24,3.12,12.61]){
    box(root,m.dark,x,y+1.48,-1.05,.22,2.96,.43,.035);
    box(root,m.enamel,x,y+1.46,-.81,.12,2.89,.08,.015);
    for(const h of [.24,1.10,2.62]){
      box(root,m.pipeSteel,x,y+h,-.73,.30,.13,.11,.015);
      for(const dx of [-.10,.10]){const bolt=cylinder(root,m.metal,x+dx,y+h,-.66,.025,.025,.025,6);bolt.rotation.x=Math.PI/2;}
    }
  }
  // Unequal service loops create a near silhouette without crossing head height.
  cableRun(root,m,-12.87,-9.45+level*.32,y+3.18,front+.13,5,.40-level*.035);
  cableRun(root,m,-6.15,-3.37-level*.23,y+3.13,front+.08,3,.24+level*.045);
  cableRun(root,m,3.39+level*.19,7.07,y+3.18,front+.09,5,.41+level*.045);
  cableRun(root,m,10.68-level*.13,12.96,y+3.10,front+.10,3,.30+level*.05);
  // Front-facing knee braces give the removed wall a substantial section edge.
  for(const side of [-1,1]){
    const x=side*12.94;
    box(root,m.dark,x,y+1.48,front,.17,2.98,.29,.025);
    box(root,m.pipeSteel,x,y+1.48,front+.17,.075,2.98,.065);
    rod(root,m.dark,[x,y+2.28,front],[x-side*.59,y+3.00,front],.075);
    for(const h of [.3,1.5,2.74]){
      box(root,m.pipeSteel,x,y+h,front+.16,.26,.16,.07,.014);
      for(const dx of [-.075,.075]){const fastener=cylinder(root,m.metal,x+dx,y+h,front+.21,.021,.025,.021,6);fastener.rotation.x=Math.PI/2;}
    }
  }
  for(const x of [-12.8,12.82])for(let i=0;i<4;i++){
    const xx=x+(x<0?1:-1)*i*.062;
    pipe(root,m.cable,[[xx,y+.18,.78],[xx,y+1.2,.78],[xx,y+2.66,.78],[xx+(x<0?.34:-.34),y+2.97,.86]],.022);
    for(const h of [.49,1.69,2.47])box(root,m.metal,xx,y+h,.8,.09,.08,.12);
  }
  // Recessed cable trays and service panels between the ceiling ribs.
  for(const x of [-10.4,-7.25,-3.35,2.13,5.24,8.37,11.47]){
    box(root,m.dark,x,y+2.74,-1.14,1.06,.27,.32,.025);
    for(let i=0;i<7;i++)box(root,m.pipeSteel,x-.45+i*.15,y+2.75,-.94,.025,.20,.045);
    cableRun(root,m,x-.60,x+.62,y+2.52,-1.19,2,.12);
  }
  // Exposed services in the formerly bare wall bays; never in the ladder well.
  for(const [x,width] of (level===DECK.HABITATION?[[-4.2,1.5],[3.0,.7],[10.55,.8]]:level===DECK.OPERATIONS?[]:[[1.65,1.2]])){
    box(root,m.dark,x,y+1.95,-1.40,width,.64,.18,.035);
    for(let i=0;i<3;i++){
      const yy=y+1.72+i*.21;
      rod(root,i===1?m.brass:m.pipeSteel,[x-width/2,yy,-1.23],[x+width/2,yy,-1.23],.049);
      for(const end of [-1,1])flange(root,m,x+end*(width/2-.12),yy,-1.23,.049);
    }
    box(root,m.enamel,x+width/2-.09,y+1.95,-1.12,.09,.74,.08,.012);
    pipe(root,m.cable,[[x-width*.3,y+1.61,-1.24],[x-width*.3,y+1.30,-1.24],[x+width*.3,y+1.24,-1.24],[x+width*.3,y+1.61,-1.24]],.025);
  }
  // Grated edge strips: surfaces are flush and the ladder opening stays open.
  for(const side of [-1,1])for(let i=0;i<57;i++){
    const x=side*(.75+i*.214);
    box(root,m.dark,x,y+.009,2.19,.018,.017,.54);
    if(i%4===0)box(root,m.metal,x,y+.019,2.19,.024,.017,.53);
  }
  if(level===2){
    hoist(root,m,11.36,y);
    chain(root,m,-12.77,y+3.09,y+.18,front+.16);
    // Condensation sheen belongs beside coolant equipment, not the galley.
    for(const [x,width] of [[5.69,1.76],[11.43,1.32]]){
      box(root,m.wetFloor,x,y+.024,1.49,width,.009,1.87,.003);
      for(let i=0;i<19;i++)box(root,m.dark,x-width/2+i*width/19,y+.032,1.49,.021,.014,1.87);
    }
    for(const x of [4.66,6.58]){
      pipe(root,m.pipeSteel,[[x,y+.18,-.79],[x,y+.25,-.52],[x,y+2.55,-.52],[x-.32,y+2.70,-.65]],.088);
      for(const h of [.44,1.63,2.35]){
        const collar=cylinder(root,m.brass,x,y+h,-.52,.12,.07,.12,16);
        collar.name='Coolant pipe collar';
      }
      for(let i=0;i<12;i++)ball(root,m.wetSteel,x+.04*Math.sin(i*4),y+.35+i*.17,-.425,.013,.024,.009);
    }
  }else if(level===DECK.OPERATIONS){
    chain(root,m,-12.68,y+3.12,y+1.66,front+.14);
  }
}

export function addWorkLights(root,y,level){
  // Keep the two-light budget while warming and gently dimming each deck.
  const deckLight=new THREE.PointLight(CABIN_DECK_LIGHT.color,level===DECK.HABITATION?CABIN_DECK_LIGHT.livingPower:CABIN_DECK_LIGHT.power,20,2);
  deckLight.name='Legacy deck light';deckLight.position.set(-5,y+2.3,.6);root.add(deckLight);
  const secondLight=new THREE.PointLight(CABIN_DECK_LIGHT.fillColor,CABIN_DECK_LIGHT.fillPower,17,2);
  secondLight.name='Legacy deck fill';secondLight.position.set(6,y+2.3,.6);root.add(secondLight);
  if(level===DECK.HABITATION)for(const x of LOUNGE_LIGHTS){
    const light=new THREE.SpotLight(CABIN_WARM_LIGHT_COLOR,20,4.9,.91,.6,2);light.name='Lounge seat light';
    light.position.set(x,y+2.54,-.08);light.target.position.set(x,y+.48,-.10);root.add(light,light.target);
  }
  for(const [x,power] of WORK_LIGHTS){
    const light=new THREE.SpotLight(CABIN_LIGHT_COLOR,level===DECK.OPERATIONS?power*.9:power,6.3,1.03,.65,2);
    light.name='Ceiling work light';
    light.position.set(x,y+2.50,.37);root.add(light);
    light.target.position.set(x,y+.7,-.70);root.add(light.target);
    // One shadowed practical per deck keeps fixture contact readable at bounded cost.
    if(x===4.3){
      light.castShadow=true;light.shadow.mapSize.set(512,512);
      light.shadow.bias=-.0002;light.shadow.normalBias=.025;
    }
  }
}
