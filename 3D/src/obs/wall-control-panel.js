import * as THREE from 'three';
import {removeFrontCap,openPanelBox,panelFaceGeometry} from './panel-surfaces.js';

const W=512,H=1024;
const CONTROLS=[
  [296,172,64,86,.018],
  [212,469,224,76,.016],
  [246,588,42,58,.024],
  [356,588,42,58,.024],
  [301,684,42,58,.024],
  [296,788,64,86,.018],
];

function panelTexture(){
  // One atlas shared by every cabinet; small hardware is painted, not meshed.
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d');
  const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const text=(value,x,y,size=11,color='#494c44')=>{
    c.fillStyle=color;c.font=`${size}px monospace`;c.fillText(value,x,y);
  };
  const inset=(x,y,w,h)=>{
    rect(x,y,w,h,'#555a51');rect(x+2,y+3,w-3,h-3,'#d1d0bd');
    rect(x+4,y+4,w-8,h-8,'#a9ada0');
  };
  rect(0,0,W,H,'#b4b7ad');
  rect(12,12,W-24,2,'#d7d8cb');rect(12,H-14,W-24,2,'#777c73');
  inset(156,62,314,880);
  text('DS / 01',355,102,18);text('AUXILIARY',183,111,11);
  text('SERVICE CONTROL',183,132,11);
  inset(185,150,256,305);inset(185,760,256,146);
  text('LOCAL',205,186);text('REMOTE',365,186);
  text('RESET',205,827);text('TEST',373,827);
  for(const y of [172,788]){
    rect(296,y,64,86,'#292f2d');
    for(let row=0;row<6;row++)for(let col=0;col<4;col++){
      rect(303+col*13,y+7+row*12,8,7,'#676e65');
      rect(303+col*13,y+7+row*12,8,1,'#94998a');
    }
  }
  for(const y of [306,379])for(const x of [232,365]){
    inset(x,y,38,44);rect(x+11,y+9,15,27,'#676f62');
    rect(x+11,y+9,4,27,'#c8c9b6');
    text(y===306?'01':'02',x,y-9,10);
  }
  rect(212,469,224,76,'#303732');
  for(let row=0;row<2;row++)for(let col=0;col<8;col++){
    const x=219+col*27,y=476+row*34;
    rect(x,y,20,25,'#777c6c');rect(x+1,y,18,19,'#d3d0b8');
    rect(x+1,y,18,3,'#ece8d4');
    text(String(col+1),x+5,y+14,9,'#777969');
  }
  text('CIRCUIT SELECT',213,461,11);
  for(const [x,y,w,h] of CONTROLS.slice(2,5)){
    rect(x,y,w,h,'#343b34');rect(x+8,y+6,w-16,h-13,'#bec2b4');
    rect(x+8,y+6,w-16,8,'#ebe9d9');rect(x+8,y+h-19,w-16,6,'#808779');
    text('ON',x+10,y-9,10);text('OFF',x+7,y+h+17,10);
  }
  // Stencilled safety labels sit on the blank side of the cabinet door.
  rect(40,82,62,82,'#802e2a');rect(45,87,52,4,'#c88970');
  text('ISOLATE',46,110,10,'#e3bc9b');text('POWER',48,126,10,'#e3bc9b');
  for(let i=0;i<3;i++)rect(48,146+i*5,39-i*5,2,'#c78f74');
  rect(35,661,78,172,'#4b4c36');rect(39,669,70,156,'#c5a33e');
  text('CAUTION',44,689,12,'#373d30');
  c.beginPath();c.moveTo(76,704);c.lineTo(58,737);c.lineTo(88,737);c.closePath();
  c.strokeStyle='#454a32';c.lineWidth=3;c.stroke();text('!',70,732,23,'#454a32');
  for(let i=0;i<9;i++)rect(46,751+i*7,54-(i%3)*9,2,'#6f6538');
  for(const [x,y] of [[22,30],[490,30],[22,994],[490,994],[168,78],[458,78],[168,926],[458,926]]){
    rect(x-4,y-4,8,8,'#70776b');rect(x-3,y-1,6,2,'#41493f');
  }
  inset(269,958,114,25);rect(278,965,96,5,'#666e60');
  let seed=731;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1900;i++){
    rect(random()*W,random()*H,1+random()*3,1+random()*2,i%2?'#e1decd18':'#3c463918');
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  texture.name='Shared wall control cabinet artwork';return texture;
}

export function createWallControlMaterials(){
  return {
    shell:new THREE.MeshStandardMaterial({name:'Control cabinet / grey enamel',color:0xb4b7ad,roughness:.82,metalness:.18}),
    edge:new THREE.MeshStandardMaterial({name:'Control cabinet / recessed hardware',color:0x61695e,roughness:.76,metalness:.28}),
    face:new THREE.MeshStandardMaterial({name:'Control cabinet / shared control atlas',color:0xffffff,map:panelTexture(),roughness:.85,metalness:.12}),
  };
}

export function createWallControlPanel(materials,width=.62){
  const root=new THREE.Group();root.name='Wall auxiliary control cabinet';
  const height=1.09;
  // Eight flat corners, with a single bevel, keep the metal enclosure inexpensive.
  const a=width/2-.006,b=height/2-.006,k=.012,shape=new THREE.Shape();
  [[-a+k,-b],[a-k,-b],[a,-b+k],[a,b-k],[a-k,b],[-a+k,b],[-a,b-k],[-a,-b+k]]
    .forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
  shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.15,steps:1,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1,curveSegments:1});
  geo.translate(0,0,-.15);
  removeFrontCap(geo);
  const shell=new THREE.Mesh(geo,materials.shell);shell.name='Shallow cabinet shell';
  shell.castShadow=shell.receiveShadow=true;root.add(shell);
  const fw=width-.012,fh=height-.012;
  function face(x,y,w,h,z,holes=[],corner=0){
    const plane=panelFaceGeometry(w/W*fw,h/H*fh,holes,corner),uv=plane.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(x+uv.getX(i)*w)/W,1-(y+(1-uv.getY(i))*h)/H);
    const mesh=new THREE.Mesh(plane,materials.face);
    mesh.position.set(((x+w/2)/W-.5)*fw,(.5-(y+h/2)/H)*fh,z);
    mesh.receiveShadow=true;root.add(mesh);return mesh;
  }
  face(0,0,W,H,.006,CONTROLS.map(([x,y,w,h])=>[x/W,y/H,w/W,h/H]),k).name='Cabinet door markings';
  for(const [x,y,w,h,depth] of CONTROLS){
    const cx=((x+w/2)/W-.5)*fw,cy=(.5-(y+h/2)/H)*fh;
    openPanelBox(root,materials.edge,cx,cy,.006+depth/2,w/W*fw,h/H*fh,depth).name='Raised control housing';
    face(x,y,w,h,.006+depth).name='Control face';
  }
  return root;
}
