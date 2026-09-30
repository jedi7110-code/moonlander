import {CanvasTexture,SRGBColorSpace,MeshStandardMaterial,PlaneGeometry,CylinderGeometry,CircleGeometry,BoxGeometry,BufferGeometry,Float32BufferAttribute,Mesh} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// One 1K sheet per cabin, shared by all safety and stores labels. Original,
// fictional shipboard artwork: no brand logos or real certification marks.
export const LABEL_TILES={
  extinguisher:[0,0,256,512],gauge:[256,0,256,256],inspection:[256,256,256,256],
  rations:[512,0,512,256],water:[512,256,512,256],parts:[512,512,512,256],
  hygiene:[512,768,512,256],tin:[0,512,256,256],detergent:[256,512,256,256],underdeck:[0,768,512,192],
};
const SIZE=1024,cache=new WeakMap(),stencilCache=new WeakMap(),ink='#222d2b',paper='#e7e2cd';

function artwork(c,key,w,h){
  const rect=(x,y,width,height,color)=>{c.fillStyle=color;c.fillRect(x,y,width,height);};
  const text=(value,x,y,size=14,color=ink,weight=500)=>{
    c.fillStyle=color;c.font=`${weight} ${size}px Arial`;c.textAlign='left';c.textBaseline='alphabetic';c.fillText(value,x,y);
  };
  const line=(points,width=2,color=ink)=>{
    c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.beginPath();
    points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
  };
  const barcode=(x,y,width,height,serial)=>{
    let n=17;for(const char of serial)n=(Math.imul(n,31)+char.charCodeAt(0))>>>0;
    let pos=0;while(pos<width-4){n=(Math.imul(n,1664525)+1013904223)>>>0;const bar=1+(n%3);rect(x+pos,y,bar,height,ink);pos+=bar+2+(n%2);}
    text(serial,x,y+height+13,11);
  };
  const arrow=(x,y)=>{line([[x,y+28],[x,y],[x-7,y+9]],3);line([[x,y],[x+7,y+9]],3);};
  const dry=(x,y)=>{
    c.strokeStyle=ink;c.lineWidth=3;c.beginPath();c.arc(x,y+14,17,Math.PI,Math.PI*2);c.stroke();
    line([[x-17,y+14],[x+17,y+14]],2);line([[x,y+14],[x,y+35],[x+7,y+35]],3);
    for(const dx of [-13,0,13])line([[x+dx,y-10],[x+dx-3,y-4]],2);
  };
  if(key==='underdeck'){
    // Transparent ink occupies an unused atlas slot; no extra texture or plate.
    const yellow='#d8bd58';
    text('CAUTION',12,39,38,yellow,800);
    text('UNDERDECK SERVICE TANK',217,22,15,yellow,700);
    text('PRESSURIZED PIPEWORK / MAINTENANCE',217,40,10,yellow,600);
    line([[12,51],[500,51]],2,yellow);
    const warnings=[
      '01  ISOLATE AND LOCK OUT THE CONNECTED SYSTEM.',
      '02  RELIEVE RESIDUAL PRESSURE BEFORE SERVICING.',
      '03  DO NOT LOOSEN FITTINGS WHILE PRESSURIZED.',
      '04  KEEP VENT AND RELIEF CONNECTIONS CLEAR.',
      '05  INSPECT SUPPORT BANDS, JOINTS AND SEALS.',
      '06  DO NOT DRILL, WELD OR USE AS A STEP.',
    ];
    warnings.forEach((value,i)=>text(value,13,70+i*17,12,yellow,600));
    line([[12,166],[500,166]],1,yellow);
    text('AUTHORIZED SERVICE PERSONNEL ONLY',13,181,10,yellow,700);
    text('TARAIRON / UT-S / REV.03',347,181,9,yellow,600);
    return;
  }
  rect(0,0,w,h,paper);rect(4,4,w-8,h-8,'#f1eddb');
  c.strokeStyle='#a8a38f';c.lineWidth=1;c.strokeRect(7,7,w-14,h-14);
  if(key==='extinguisher'){
    rect(12,12,w-24,61,'#a73127');text('FIRE',24,39,26,'#fff5dc',800);text('EXTINGUISHER',24,61,21,'#fff5dc',800);
    text('ABC DRY POWDER  /  2 kg',18,94,15,ink,700);text('FE-04   •   CABIN SAFETY',18,113,12);
    const steps=[['PULL PIN','Break seal; pull ring.'],['AIM LOW','Direct nozzle at base.'],['SQUEEZE','Press operating lever.'],['SWEEP','Move nozzle side to side.']];
    steps.forEach(([title,detail],i)=>{
      const y=133+i*64;rect(14,y,228,1,'#aaa592');rect(17,y+11,23,23,ink);text(String(i+1),23,y+28,17,paper,700);
      // Bottle, hose and directional arrows are drawn as printed pictograms.
      c.strokeStyle=ink;c.lineWidth=2;c.strokeRect(52,y+24,15,26);line([[57,y+24],[57,y+17],[64,y+17],[64,y+24]],2);
      line([[65,y+20],[75,y+24],[81,y+44]],2);
      if(i===0){line([[60,y+13],[78,y+7],[71,y+6]],2);}
      if(i===1){line([[76,y+33],[86,y+46],[86,y+39]],2);}
      if(i===2){line([[69,y+3],[69,y+14],[64,y+9]],2);}
      if(i===3){line([[76,y+49],[89,y+49],[85,y+45]],2);line([[76,y+49],[80,y+45]],2);}
      text(title,94,y+27,16,ink,800);text(detail,94,y+44,10);
    });
    rect(14,397,228,29,ink);text('RECHARGE AFTER ANY USE',23,417,13,paper,700);
    text('CHECK GAUGE & SEAL BEFORE SERVICE',17,444,10);barcode(19,458,138,18,'FE04-0711-028');
    text('TARAIRON',169,469,12,ink,800);text('SAFETY SYS.',169,484,9);
  }else if(key==='gauge'){
    rect(0,0,w,h,'#e9e6d4');
    for(const [a,b,color]of [[Math.PI*.82,Math.PI*1.33,'#a14a35'],[Math.PI*1.33,Math.PI*1.67,'#487449'],[Math.PI*1.67,Math.PI*2.18,'#a14a35']]){
      c.strokeStyle=color;c.lineWidth=21;c.beginPath();c.arc(128,133,87,a,b);c.stroke();
    }
    for(let i=0;i<=20;i++){const a=Math.PI*(.82+i*1.36/20);line([[128+Math.cos(a)*70,133+Math.sin(a)*70],[128+Math.cos(a)*(i%5?79:85),133+Math.sin(a)*(i%5?79:85)]],i%5?1:3);}
    text('PRESSURE',82,128,17,ink,700);text('READY',101,163,14);text('bar',116,187,12);
    line([[128,145],[128,62]],5);c.fillStyle=ink;c.beginPath();c.arc(128,133,8,0,Math.PI*2);c.fill();
  }else if(key==='inspection'){
    rect(12,12,232,39,'#3b6257');text('SERVICE RECORD',23,38,22,paper,800);
    text('TARAIRON  /  EQUIPMENT',19,73,14);text('UNIT  FE-04 / 028',19,96,16,ink,700);
    text('DATE',22,124,12);text('CHECK',109,124,12);text('TECH',190,124,12);
    for(let i=0;i<3;i++){const y=142+i*25;line([[18,y+9],[238,y+9]],1,'#8d9487');text(`07-${String(i+1).padStart(2,'0')}`,22,y,14);text('PASS',109,y,13,'#345d49',700);text('MJ',195,y,13);}
    text('INSPECT SEAL / GAUGE / HOSE',20,235,12);
  }else if(['tin','detergent'].includes(key)){
    const food=key==='tin',color=food?'#526446':'#3d6d70';
    rect(10,10,236,61,color);text(food?'PANTRY':'CABIN CARE',23,37,20,paper,800);text(food?'PRESERVED FOOD':'LOW-FOAM FORMULA',23,58,12,paper);
    text(food?'VEGETABLE':'LAUNDRY',22,102,25,ink,800);text(food?'STEW':'DETERGENT',22,128,24,ink,800);
    text(food?'READY TO HEAT / 400 g':'CONCENTRATE / 1 L',22,154,14);
    text(food?'LOT 07-218  •  MEAL 03':'KEEP SEPARATE FROM FOOD',22,175,11);
    barcode(23,189,151,28,food?'FD-0400-218':'HC-1000-031');text(food?'03':'HC',192,217,23,color,800);
  }else{
    const data={
      rations:['RATIONS','MEAL PACK / 12 UNITS','FD-012-2049','GROSS 8.4 kg','STORE COOL / KEEP DRY','#5d6546'],
      water:['POTABLE WATER','SEALED RESERVE / 6 UNITS','H2O-006-2049','GROSS 12.8 kg','KEEP SEALED UNTIL USE','#3f727b'],
      parts:['SERVICE PARTS','FILTERS / SEALS / FASTENERS','SP-031-2049','GROSS 6.2 kg','CLEAN STORES / KEEP DRY','#5c6470'],
      hygiene:['HYGIENE KIT','WIPES / LINEN / CREW CARE','HC-024-2049','QTY 24 PACKS','NON-FOOD / DRY STORAGE','#567167'],
    }[key];
    rect(12,12,w-24,31,data[5]);text('TARAIRON   /   LOGISTICS',24,34,16,paper,700);text(data[0],23,87,34,ink,800);
    text(data[1],24,111,17,ink,700);line([[23,123],[w-23,123]],2,'#8b8f80');
    text(`LOT ${data[2]}`,24,145,14);text(data[3],285,145,14);text(data[4],24,169,13);
    barcode(24,184,249,35,data[2]);arrow(349,185);arrow(370,185);dry(432,184);
    text('THIS WAY UP',320,238,10);text('KEEP DRY',408,238,10);
  }
  // Restrained edge scuffing and ink variation, baked once into the sheet.
  let seed=key.length*7110;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<180;i++){
    const x=8+random()*(w-16),y=8+random()*(h-16),edge=x<15||x>w-15||y<15||y>h-15;
    rect(x,y,1+random()*3,1,edge?'#a8a18b66':'#7169520b');
  }
}

export function createEquipmentLabelTexture(){
  // Geometry-only Node tests run without a DOM, as with the other cabin prints.
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;
  const c=canvas.getContext('2d');
  for(const [key,[x,y,w,h]]of Object.entries(LABEL_TILES)){
    c.save();c.translate(x,y);artwork(c,key,w,h);c.restore();
  }
  const map=new CanvasTexture(canvas);map.name='Cabin equipment / shared printed label atlas';
  map.colorSpace=SRGBColorSpace;map.anisotropy=4;return map;
}

export function equipmentLabelMaterial(materials){
  if(!cache.has(materials)){
    const material=new MeshStandardMaterial({name:'Cabin equipment / matte printed labels',map:createEquipmentLabelTexture(),color:0xffffff,roughness:.84,metalness:0,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    material.userData.castShadow=false;material.userData.cabinKeepSurface=true;material.userData.cabinNoOutline=true;
    cache.set(materials,material);
  }
  return cache.get(materials);
}

function mapLabelUVs(geometry,key){
  const tile=LABEL_TILES[key];if(!tile)throw new Error(`Unknown equipment label: ${key}`);
  const uv=geometry.attributes.uv,[tx,ty,tw,th]=tile;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(tx+1+uv.getX(i)*(tw-2))/SIZE,1-(ty+th-1-uv.getY(i)*(th-2))/SIZE);
}

export function addEquipmentLabel(parent,materials,key,{x=0,y=0,z=0,width=.30,height=.15,radius=0,round=false}={}){
  const angle=radius?width/radius:0;
  const geometry=round?new CircleGeometry(width/2,24):radius?
    new CylinderGeometry(radius,radius,height,16,1,true,-angle/2,angle):new PlaneGeometry(width,height);
  mapLabelUVs(geometry,key);
  const mesh=new Mesh(geometry,equipmentLabelMaterial(materials));mesh.name=`Equipment label / ${key}`;
  mesh.userData.equipmentLabel=key;mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

// The paper replaces the backing plate's centre face instead of hovering just
// 1–2 mm above another opaque polygon. Keep a metal rim, sides and back, but no
// competing front surface under the print (especially at the OBS wide camera).
export function addEquipmentLabelPlate(parent,materials,key,{x=0,y=0,z=0,width=.30,height=.15,border=.008,depth=.010}={}){
  const w=width/2,h=height/2,a=w+border,b=h+border;
  const shell=new BoxGeometry(a*2,b*2,depth);
  const front=shell.groups[4];
  shell.setIndex(Array.from(shell.index.array).filter((_,i)=>i<front.start||i>=front.start+front.count));shell.clearGroups();
  // Local z=0 is the only front face; the other plate faces are behind it.
  shell.translate(0,0,-depth/2);
  const positions=[],uvs=[],normals=[];
  for(const [left,bottom,right,top]of [[-a,h,a,b],[-a,-b,a,-h],[-a,-h,-w,h],[w,-h,a,h]]){
    const corners=[[left,bottom],[right,bottom],[right,top],[left,top]];
    for(const i of [0,1,2,0,2,3]){
      const [px,py]=corners[i];positions.push(px,py,0);normals.push(0,0,1);uvs.push((px+a)/(a*2),(py+b)/(b*2));
    }
  }
  const rim=new BufferGeometry();rim.setAttribute('position',new Float32BufferAttribute(positions,3));
  rim.setAttribute('normal',new Float32BufferAttribute(normals,3));rim.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  const sides=shell.toNonIndexed(),geometry=mergeGeometries([sides,rim],false);
  shell.dispose();sides.dispose();rim.dispose();
  const frame=new Mesh(geometry,materials.metal);frame.name=`Equipment label frame / ${key}`;
  frame.position.set(x,y,z);frame.castShadow=frame.receiveShadow=true;parent.add(frame);
  return addEquipmentLabel(parent,materials,key,{x,y,z,width,height});
}

export function addTankCaution(parent,materials){
  if(!stencilCache.has(materials)){
    const ink=equipmentLabelMaterial(materials).clone();ink.name='Cabin equipment / yellow tank stencil';
    ink.alphaTest=.35;ink.roughness=.94;stencilCache.set(materials,ink);
  }
  // Four faces exactly follow the front quarter of the 16-sided tank.
  const geometry=new CylinderGeometry(.282,.282,1.06,4,1,true,-Math.PI/4,Math.PI/2);
  geometry.rotateZ(Math.PI/2);
  const uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,1-v,u);}
  mapLabelUVs(geometry,'underdeck');
  const mesh=new Mesh(geometry,stencilCache.get(materials));mesh.name='Underdeck tank / yellow caution stencil';
  mesh.userData.equipmentLabel='underdeck';mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
