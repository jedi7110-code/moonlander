import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {batchStatic} from './materials.js';
import {PAD_FINISH,PAD_SCREENS,nextPadScreen,padCanvas,paintPadScreen} from './pad-screen.js';

// Same local axes and face dimensions as the cabin pad: +Y is the screen.
export const PAD_SIZE={width:.23,depth:.30,thickness:.030};

function outline(w,h,c,cx=0,cy=0,Path=THREE.Shape){
  const p=new Path(),points=[[-w/2+c,-h/2],[w/2-c,-h/2],[w/2,-h/2+c],[w/2,h/2-c],[w/2-c,h/2],[-w/2+c,h/2],[-w/2,h/2-c],[-w/2,-h/2+c]];
  points.forEach(([x,y],i)=>i?p.lineTo(x+cx,y+cy):p.moveTo(x+cx,y+cy));p.closePath();return p;
}

export function createPadModel(){
  const root=new THREE.Group();root.name='Pad / rugged study';
  const standard=(name,color,roughness=.65,metalness=.1)=>new THREE.MeshStandardMaterial({name,color,roughness,metalness});
  const shell=standard('Pad / painted alloy',PAD_FINISH.color,.68,.38);
  const edge=standard('Pad / exposed alloy',0x99a099,.42,.8);
  const rubber=standard('Pad / protective rubber',0x242c29,.94,.02);
  const recess=standard('Pad / recessed sockets',0x0a1210,.83,0);
  const keyMat=standard('Pad / keys',0x535e56,.83,.03);
  const amber=standard('Pad / safety ochre',0xc8a05f,.67,.1);
  const gold=standard('Pad / contacts',0xbda974,.35,.8);
  const mesh=(name,geometry,material,x=0,y=0,z=0)=>{
    const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;
  };
  const box=(name,mat,x,y,z,w,h,d,r=.001)=>mesh(name,new RoundedBoxGeometry(w,h,d,2,Math.min(r,h/2,w/2,d/2)),mat,x,y,z);
  const slab=(name,mat,w,d,h,y,c=.008,hole)=>{
    const shape=outline(w,d,c);if(hole)shape.holes.push(outline(hole.w,hole.d,.003,0,-hole.z,THREE.Path));
    const geo=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:1,steps:1});geo.rotateX(-Math.PI/2);geo.translate(0,-h/2,0);
    return mesh(name,geo,mat,0,y,0);
  };
  slab('Lower alloy chassis',edge,.224,.294,.014,-.002);
  slab('Continuous perimeter seal',rubber,.228,.298,.003,.0055);
  slab('Upper shell with recessed screen opening',shell,.23,.30,.010,.012,.009,{w:.183,d:.223,z:-.012});
  box('Display gasket',recess,0,.010,-.012,.187,.005,.227,.003);

  const screenCanvas=padCanvas(768,936);
  const screenTexture=screenCanvas?new THREE.CanvasTexture(screenCanvas):null;if(screenTexture){screenTexture.colorSpace=THREE.SRGBColorSpace;screenTexture.anisotropy=4;}
  const screenMaterial=new THREE.MeshBasicMaterial({name:'Pad / monochrome display',map:screenTexture,toneMapped:false});
  const screen=mesh('Inset display',new THREE.PlaneGeometry(.179,.219),screenMaterial,0,.013,-.012);screen.rotation.x=-Math.PI/2;screen.castShadow=false;
  const glass=new THREE.MeshPhysicalMaterial({name:'Pad / matte cover glass',color:0xb6d0bc,transparent:true,opacity:.075,roughness:.25,metalness:0,clearcoat:1,depthWrite:false});
  const cover=mesh('Display cover glass',new THREE.PlaneGeometry(.180,.220),glass,0,.0132,-.012);cover.rotation.x=-Math.PI/2;cover.castShadow=false;

  // Printing is flat on the casing; panel gaps, guards and fasteners have depth.
  const print=(name,w,h,x,y,z,draw,back=false)=>{
    const canvas=padCanvas(1024,Math.max(64,Math.round(1024*h/w)));
    if(canvas)draw(canvas.getContext('2d'),canvas.width,canvas.height);
    const map=canvas?new THREE.CanvasTexture(canvas):null;if(map){map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;}
    const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false});
    const label=mesh(name,new THREE.PlaneGeometry(w,h),material,x,y,z);label.rotation.x=back?Math.PI/2:-Math.PI/2;if(back)label.rotation.z=Math.PI;label.castShadow=false;return label;
  };
  const text=(ctx,str,x,y,size=30,color='#d9d9c4')=>{ctx.fillStyle=color;ctx.font=`500 ${size}px monospace`;ctx.fillText(str,x,y);};
  print('Top identification',.171,.015,0,.0172,-.136,(ctx,w,h)=>{
    text(ctx,'TARAIRON',0,h*.70,51);text(ctx,'PAD / 04',w*.67,h*.70,36);
  });
  print('Front inventory marking',.054,.006,-.063,.0172,.138,(ctx,w,h)=>text(ctx,'HABITAT EQUIPMENT',0,h*.72,68));

  function screw(x,z,y=.0173,back=false){
    const bolt=mesh('Captive slotted screw',new THREE.CylinderGeometry(.0025,.0025,.001,12),edge,x,y,z);
    box('Screw slot',recess,x,y+(back?-.00055:.00055),z,.0037,.00018,.00055,.00005);
    return bolt;
  }
  for(const x of [-.103,.103])for(const z of [-.132,.011,.13])screw(x,z);
  for(const x of [-1,1])for(const z of [-1,1]){
    box('Replaceable corner bumper',rubber,x*.102,0,z*.132,.031,.030,.037,.005);
    box('Corner guard inset',keyMat,x*.102,.0152,z*.135,.016,.0018,.015,.001);
  }
  for(const side of [-1,1]){
    box('Side grip',rubber,side*.111,-.002,0,.012,.016,.181,.003);
    for(let i=0;i<12;i++)box('Grip rib',keyMat,side*.117,-.001,-.075+i*.014,.0018,.012,.0024,.0005);
  }
  const buttons=[];
  for(const [i,label]of ['BACK','UP','DOWN','ENTER'].entries()){
    const x=-.058+i*.038;
    box('Key well',recess,x,.0174,.119,.034,.002,.019,.002);
    const key=box(`Physical key / ${label}`,i===3?amber:keyMat,x,.0195,.119,.029,.004,.014,.0015);buttons.push(key);
    print(`Key legend / ${label}`,.025,.006,x,.0216,.119,(ctx,w,h)=>{ctx.textAlign='center';text(ctx,label,w/2,h*.75,110,i===3?'#25302a':'#e4e5d5');});
  }
  box('Protected power key',amber,.116,.001,-.087,.008,.007,.018,.002);
  for(let i=0;i<3;i++){
    const material=new THREE.MeshBasicMaterial({color:i===2?0xb99a5a:0x9dbda2,toneMapped:false});
    box('Status indicator',material,.065+i*.007,.0176,.138,.003,.0008,.002,.0002);
  }
  box('Back panel gasket',rubber,0,-.0095,0,.181,.003,.237,.003);
  box('Removable service cover',shell,0,-.0115,0,.177,.003,.233,.003);
  for(const x of [-.079,.079])for(const z of [-.105,.105])screw(x,z,-.0134,true);
  for(const side of [-1,1]){
    box('Rear finger rest',rubber,side*.062,-.0145,-.01,.032,.004,.143,.002);
    for(let i=0;i<9;i++)box('Rear grip groove',keyMat,side*.062,-.0166,-.066+i*.014,.026,.0007,.0016,.0002);
  }
  box('Battery hatch seam',recess,0,-.0134,.081,.092,.001,.054,.002);
  box('Battery hatch',edge,0,-.0143,.081,.087,.0014,.049,.002);
  box('Battery latch recess',recess,0,-.0151,.099,.029,.001,.008,.001);
  box('Battery latch',rubber,0,-.016,.099,.013,.002,.006,.001);
  print('Rear equipment plate',.074,.066,0,-.0133,-.028,(ctx,w,h)=>{
    ctx.fillStyle='#c1c4b0';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#384339';ctx.lineWidth=8;ctx.strokeRect(16,16,w-32,h-32);
    text(ctx,'TARAIRON',55,115,80,'#263b32');text(ctx,'PORTABLE TERMINAL',55,190,45,'#263b32');
    text(ctx,'UNIT 04 / HABITAT',55,282,49,'#263b32');text(ctx,'24 V DC / 18 W',55,364,47,'#263b32');
    text(ctx,'ISOLATE BEFORE SERVICE',55,450,39,'#263b32');
    for(let i=0;i<62;i++){ctx.fillStyle='#263b32';ctx.fillRect(55+i*14,535,i%3===0?8:3,100);}
    text(ctx,'TR-HAB-004-071',55,720,54,'#263b32');
  },true);
  // Recessed docking contact face on the bottom edge.
  const socket=mesh('Dock contact recess',new THREE.PlaneGeometry(.058,.010),recess,0,0,.1471);
  for(let i=0;i<6;i++)box('Dock contact',gold,-.018+i*.007,-.001,.148,.0025,.006,.001,.0003);
  box('Dock upper lip',rubber,0,.007,.148,.069,.005,.007,.001);
  box('Dock lower lip',rubber,0,-.008,.148,.069,.004,.007,.001);

  const wear=print('Paint edge wear',.23,.30,0,.0174,0,(ctx,w,h)=>{
    let seed=19;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<190;i++){
      const side=i%2,x=side?(rand()<.5?17:w-18):35+rand()*(w-70),y=side?30+rand()*(h-60):(rand()<.5?13:h-16);
      ctx.strokeStyle=`rgba(190,193,176,${.12+rand()*.5})`;ctx.lineWidth=.5+rand()*1.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2+rand()*12,y+(rand()-.5)*3);ctx.stroke();
    }
  });wear.material.opacity=PAD_FINISH.wear;wear.visible=PAD_FINISH.wear>0;

  function drawScreen(on=PAD_FINISH.on,brightness=PAD_FINISH.brightness,page='lounge'){
    paintPadScreen(screenCanvas,{on,page});
    screenMaterial.color.setScalar(on?brightness:1);if(screenTexture)screenTexture.needsUpdate=true;
  }
  drawScreen();
  root.traverse(o=>{if(o.material){o.material.userData.cabinKeepSurface=true;if(!o.castShadow)o.material.userData.castShadow=false;}});
  return{root,screen,buttons,shell,wear,drawScreen,setColor:color=>shell.color.set(color),setWear:value=>{wear.material.opacity=value;wear.visible=value>0;}};
}

let cabinTemplate;
export function createPadTerminal({random=Math.random}={}){
  if(!cabinTemplate){
    const model=createPadModel();model.root.remove(model.screen,model.wear);
    const batched=batchStatic(model.root);
    model.root.traverse(o=>o.geometry?.dispose());model.root.clear();
    // In the reading pose +Z points toward the top of the page. Keep the
    // physical keys at the reader's lower edge, without changing the hand rig.
    const reading=new THREE.Group();reading.name='Pad / reading orientation';reading.rotation.y=Math.PI;reading.add(batched,model.screen);model.root.add(reading);
    model.wear.geometry.dispose();model.wear.material.map?.dispose();model.wear.material.dispose();
    cabinTemplate=model.root;
  }
  const root=cabinTemplate.clone(true),screen=root.getObjectByName('Inset display'),canvas=padCanvas(768,936);
  screen.material=screen.material.clone();screen.material.map=canvas?new THREE.CanvasTexture(canvas):null;
  if(screen.material.map){screen.material.map.colorSpace=THREE.SRGBColorSpace;screen.material.map.anisotropy=4;}
  const setPage=page=>{
    if(!PAD_SCREENS.includes(page))return;
    root.userData.padPage=page;paintPadScreen(canvas,{page,on:PAD_FINISH.on});screen.material.color.setScalar(PAD_FINISH.brightness);
    if(screen.material.map)screen.material.map.needsUpdate=true;
  };
  root.userData.setPadPage=setPage;
  root.userData.nextPadPage=()=>setPage(nextPadScreen(root.userData.padPage,random));
  root.userData.nextPadPage();return root;
}
