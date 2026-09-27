import * as THREE from 'three';
import {box,cylinder,rod} from './materials.js';

// One palette/legend atlas for all three desks, so the small fittings still
// merge into the cabin's static batches. Indicator lenses add no scene lights.
export function createConsoleMaterials(){
  const finish=(name,color,metalness=.1,roughness=.62)=>new THREE.MeshPhysicalMaterial({name:`Console / ${name}`,color,metalness,roughness});
  const m={
    edge:finish('anodised edges',0x777b75,.65,.46),
    panel:finish('charcoal faceplates',0x303a39,.25,.72),
    socket:finish('recessed sockets',0x101817,0,.84),
    key:finish('grey keycaps',0x707972,0,.62),
    ivory:finish('ivory keycaps',0xc5c4b1,0,.7),
    red:finish('red safety cap',0x873a2e,0,.48),
    metal:finish('switch hardware',0xb8c2be,.75,.33),
  };
  m.lenses=[0xe76b4e,0xeac16a,0x83c79a,0x78c8d3,0xd0d6c4].map((color,i)=>{
    const material=new THREE.MeshBasicMaterial({name:`Console / indicator ${i}`,color,toneMapped:false});
    material.userData.cabinAlwaysPowered=true;return material;
  });
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d');
  ctx.font='500 23px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#b8c1b7';
  const text=['PWR / DISTRIBUTION','ENV / LIFE SUPPORT','ATT / GUIDANCE','BUS A / BUS B','PUMP / VALVE','CHANNEL SELECT','TRIM / RATE','STBY    TEST    RUN','MAIN    AUX    LINK','01   02   03   04   05   06','VOLTS','AMPS','GAIN','AUTO / MAN','ON / OFF','SYSTEM MONITOR'];
  text.forEach((line,i)=>ctx.fillText(line,512,i*32+16));
  const atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;
  m.legend=new THREE.MeshBasicMaterial({name:'Console / engraved legends',map:atlas,transparent:true,alphaTest:.1,depthWrite:false,toneMapped:false});
  return m;
}

function legend(parent,m,row,x,y,w,h=.018,z=.019){
  const geometry=new THREE.PlaneGeometry(w,h),uv=geometry.attributes.uv;
  // Trim the empty left/right margins of the shared text atlas.
  const spans=[.29,.32,.24,.21,.21,.28,.20,.30,.30,.36,.07,.06,.06,.18,.14,.28],span=spans[row];
  for(let i=0;i<uv.count;i++)uv.setXY(i,.5+(uv.getX(i)-.5)*span*2,1-(row+1)/16+uv.getY(i)/16);
  const mesh=new THREE.Mesh(geometry,m.legend);mesh.position.set(x,y,z);parent.add(mesh);
}

// Fittings use a common panel space: XY is the face, +Z points at the operator.
function plate(parent,m,x,y,w,h,title){
  const root=new THREE.Group();root.position.set(x,y,0);parent.add(root);
  root.name='Console removable instrument panel';
  box(root,m.edge,0,0,-.018,w,h,.04,.008);
  box(root,m.panel,0,0,.005,w-.012,h-.012,.012);
  for(const sx of [-1,1])for(const sy of [-1,1]){
    const screw=cylinder(root,m.metal,sx*(w/2-.019),sy*(h/2-.019),.014,.006,.008,.006,8);screw.rotation.x=Math.PI/2;
    box(root,m.socket,screw.position.x,screw.position.y,.019,.007,.0017,.002);
  }
  legend(root,m,title,0,h/2-.045,w-.08);
  return root;
}
function indicator(parent,m,x,y,color=2,w=.025,h=.018){
  box(parent,m.socket,x,y,.021,w+.01,h+.009,.017);
  box(parent,m.lenses[color],x,y,.032,w,h,.008).name='Console lit indicator';
}
function key(parent,m,x,y,{color=null,ivory=false,w=.039,h=.037}={}){
  box(parent,m.socket,x,y,.018,w+.009,h+.009,.021);
  // Plain caps: a 3 mm corner radius is invisible from the cabin cameras but costs 25x the triangles.
  box(parent,color===null?(ivory?m.ivory:m.key):m.lenses[color],x,y,.034,w,h,.025).name='Console pushbutton';
  // A short engraved key legend is visible even on the unlit caps.
  box(parent,color===null?m.socket:m.ivory,x,y-.003,.047,w*.37,.002,.001);
}
function toggle(parent,m,x,y,on=true){
  const collar=cylinder(parent,m.metal,x,y,.021,.013,.018,.013,10);collar.rotation.x=Math.PI/2;
  const tip=[x,y+(on?.014:-.014),.067];
  rod(parent,m.metal,[x,y,.030],tip,.0055);
  const cap=cylinder(parent,m.ivory,...tip,.0065,.021,.0065,8);cap.rotation.x=on?.45:-.45;
  box(parent,m.ivory,x,y+.034,.017,.014,.002,.002);
  box(parent,m.ivory,x,y-.033,.017,.009,.002,.002);
}
function knob(parent,m,x,y,angle=0,r=.026){
  const rim=cylinder(parent,m.edge,x,y,.021,r+.008,.013,r+.008,20);rim.rotation.x=Math.PI/2;
  const dial=cylinder(parent,m.socket,x,y,.046,r,.046,r,16);dial.rotation.x=Math.PI/2;
  const dx=Math.sin(angle),dy=Math.cos(angle);
  rod(parent,m.ivory,[x+dx*r*.35,y+dy*r*.35,.071],[x+dx*r*.84,y+dy*r*.84,.071],.002);
  for(let i=0;i<7;i++){
    const a=(-.75+i*.25)*Math.PI,s=Math.sin(a),c=Math.cos(a);
    rod(parent,m.ivory,[x+s*(r+.012),y+c*(r+.012),.017],[x+s*(r+.018),y+c*(r+.018),.017],.0012);
  }
}
function meter(parent,m,x,y,seed=0){
  box(parent,m.socket,x,y,.022,.116,.105,.026,.005);
  box(parent,m.ivory,x,y,.037,.096,.079,.008);
  for(let i=0;i<7;i++)box(parent,m.socket,x-.036+i*.012,y+.018,.042,.0017,i%3===0?.016:.009,.001);
  rod(parent,m.red,[x,y-.024,.043],[x-.022+seed*.013,y+.014,.043],.0017);
  legend(parent,m,seed%2?11:10,x,y-.022,.037,.008,.045);
}

export function addConsoleControls(parent,m,{x,y,width=1.56,seed=0}){
  const root=new THREE.Group();root.name='Dense flight console controls';root.position.set(x,y,0);root.scale.x=width/1.56;parent.add(root);
  const desk=new THREE.Group();desk.name='Console desktop controls';desk.position.set(0,1.245,-.102);desk.rotation.x=-Math.PI/2;root.add(desk);
  const power=plate(desk,m,-.493,0,.425,.55,0);
  for(let col=0;col<3;col++)knob(power,m,-.126+col*.126,.107,(col-1)*.8+seed*.15);
  legend(power,m,3,0,.015,.29,.014);
  for(let col=0;col<4;col++)toggle(power,m,-.144+col*.096,-.060,(col+seed)%3!==0);
  for(let col=0;col<6;col++)indicator(power,m,-.145+col*.058,-.183,col===0?0:col<3?1:2,.021,.012);
  legend(power,m,7,0,-.223,.31,.012);

  const keys=plate(desk,m,.05,0,.625,.55,seed===1?2:5);
  for(let col=0;col<8;col++)indicator(keys,m,-.238+col*.068,.156,col<3?3:col===7?0:2,.029,.014);
  for(let row=0;row<4;row++)for(let col=0;col<8;col++)key(keys,m,-.238+col*.068,.076-row*.079,{
    ivory:row!==3&&col<5,color:row===3&&col>4?(col===7?0:col===6?2:1):null,w:.042,h:.044,
  });

  const systems=plate(desk,m,.548,0,.335,.55,1);
  meter(systems,m,-.071,.118,seed);meter(systems,m,.071,.118,seed+1);
  for(let row=0;row<2;row++)for(let col=0;col<3;col++)key(systems,m,-.098+col*.098,-.026-row*.083,{color:row===0?2:col===0?0:1,w:.044,h:.031});
  for(let col=0;col<3;col++)toggle(systems,m,-.098+col*.098,-.204,col!==1);

  const trim=new THREE.Group();trim.position.set(.618,1.72,-.357);root.add(trim);
  const side=plate(trim,m,0,0,.172,.79,6);
  for(let row=0;row<3;row++)knob(side,m,0,.21-row*.178,-.6+row*.5,.023);
  for(let col=0;col<3;col++)indicator(side,m,-.041+col*.041,-.28,col===2?1:2,.015,.025);
  legend(side,m,12,0,-.332,.068,.012);
  const status=new THREE.Group();status.position.set(-.10,1.283,-.372);root.add(status);
  for(let i=0;i<12;i++)indicator(status,m,-.456+i*.083,0,i<4?3:i<9?2:1,.028,.013);

  // Angled canopy attached to the cabinet, safely behind the walking aisle.
  const overhead=new THREE.Group();overhead.name='Console overhead switch bank';overhead.position.set(0,2.51,-.43);overhead.rotation.x=.58;root.add(overhead);
  box(overhead,m.edge,0,0,-.070,1.52,.57,.11,.017);
  for(const sx of [-.65,.65])rod(root,m.edge,[sx,2.78,-.76],[sx,2.52,-.57],.022);
  const alarms=plate(overhead,m,-.497,0,.465,.53,1);
  for(let row=0;row<4;row++)for(let col=0;col<6;col++)key(alarms,m,-.170+col*.068,.134-row*.086,{color:row===0?1:row===3?0:(col+row+seed)%5===0?null:row===1?2:3,w:.028,h:.023});
  const bus=plate(overhead,m,0,0,.49,.53,0);
  for(let row=0;row<3;row++)for(let col=0;col<6;col++){
    const cx=-.174+col*.069,cy=.12-row*.112;
    indicator(bus,m,cx,cy+.025,(col+seed)%4===0?1:2,.017,.010);
    key(bus,m,cx,cy-.013,{ivory:col%3===0,w:.025,h:.035});
  }
  legend(bus,m,9,0,-.209,.36,.012);
  const aux=plate(overhead,m,.497,0,.465,.53,8);
  for(let col=0;col<3;col++)knob(aux,m,-.136+col*.136,.119,(col-1)*.8,.021);
  for(let row=0;row<2;row++)for(let col=0;col<5;col++)toggle(aux,m,-.158+col*.079,-.015-row*.11,(col+row+seed)%3!==0);
  legend(aux,m,14,0,-.215,.17,.012);
  return root;
}
