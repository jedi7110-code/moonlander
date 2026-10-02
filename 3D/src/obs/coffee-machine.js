import * as THREE from 'three';
import {box,cylinder,rod} from './materials.js';
import {createLoungeTitanium} from './machined-metals.js';
import {createLoungeCoffee} from './lounge-table-props.js';

// An original shipboard bean-to-cup appliance. All lettering is baked once;
// the dispensing bay is open geometry, not a black rectangle on a solid box.
export const COFFEE_PRINT_SIZE=[1024,512];
const tiles={brand:[0,0,768,96],screen:[0,96,512,304],gauge:[768,0,256,256],
  espresso:[512,96,256,120],americano:[512,216,256,120],service:[512,336,512,96],tray:[0,432,512,80]};

export function createCoffeePrint(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');[canvas.width,canvas.height]=COFFEE_PRINT_SIZE;
  const c=canvas.getContext('2d'),ink='#e2e5dc',dim='#81968e',amber='#ccb477';
  const text=(value,x,y,size=14,color=ink,weight=500)=>{
    c.fillStyle=color;c.font=`${weight} ${size}px Arial`;c.textAlign='left';c.textBaseline='alphabetic';c.fillText(value,x,y);
  };
  const line=(x,y,a,b,color=dim,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.stroke();};
  c.fillStyle='#182220';c.fillRect(0,0,1024,512);
  text('TARAIRON',24,43,30,ink,600);line(238,16,238,73);
  text('ATELIER / 02',265,49,39,ink,500);text('PRECISION COFFEE SYSTEM',268,75,12,dim);
  // Recessed, quiet green UI: no fake flashing scanlines or per-frame uploads.
  text('BEAN TO CUP',30,134,15,dim);text('READY',30,183,38,ink,500);
  line(30,206,479,206);text('PLACE YOUR MUG',30,244,20);
  text('01  ESPRESSO',30,294,24,amber,600);text('02  AMERICANO',30,332,24,ink,600);
  text('DUAL BOILER   /   FRESH GRIND',30,373,13,dim);
  for(const [key,title,sub]of [['espresso','ESPRESSO','01 / SHORT EXTRACTION'],['americano','AMERICANO','02 / ESPRESSO + HOT WATER']]){
    const [x,y]=tiles[key];text(title,x+17,y+46,27,ink,600);text(sub,x+17,y+76,11,dim);
    line(x+17,y+95,x+238,y+95,amber,2);
  }
  // The pressure dial is a printed face under a real metal bezel.
  c.fillStyle='#d3d6c7';c.beginPath();c.arc(896,128,113,0,Math.PI*2);c.fill();
  for(let i=0;i<=24;i++){
    const angle=Math.PI*.75+i/24*Math.PI*1.5,r=i%4===0?79:87;
    line(896+Math.cos(angle)*r,128+Math.sin(angle)*r,896+Math.cos(angle)*99,128+Math.sin(angle)*99,'#26322f',i%4===0?3:1);
  }
  text('BREW',864,106,18,'#35413e',700);text('bar',881,163,18,'#35413e');
  line(896,128,857,80,'#8c4b36',5);
  text('THERMAL / PRESSURE CONTROL',532,365,19);text('TWIN BOILER   /   CLOSED SERVICE CIRCUIT',532,393,13,dim);
  text('HOT SURFACE  /  KEEP HANDS CLEAR',532,415,12,amber);
  text('MUG ONLY',25,464,18,ink,600);text('REMOVE CUP AFTER DISPENSING',25,490,12,dim);
  const map=new THREE.CanvasTexture(canvas);map.name='Coffee / static control atlas';map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  return map;
}

function print(root,material,key,x,y,z,w,h){
  const g=key==='gauge'?new THREE.CircleGeometry(w/2,24):new THREE.PlaneGeometry(w,h),uv=g.attributes.uv,[tx,ty,tw,th]=tiles[key];
  for(let i=0;i<uv.count;i++)uv.setXY(i,(tx+2+uv.getX(i)*(tw-4))/1024,1-(ty+th-2-uv.getY(i)*(th-4))/512);
  const mesh=new THREE.Mesh(g,material);mesh.name=`Coffee / ${key} print`;mesh.position.set(x,y,z);root.add(mesh);return mesh;
}

// One bevel ring, unlike the many-segment rounded boxes used on soft furnishings.
function housing(root,material,name,x,y,z,w,h,d,corner=.025,opening=null){
  const a=w/2,b=h/2,r=Math.min(corner,w*.2,h*.2),s=new THREE.Shape();
  const points=[[-a+r,-b],[a-r,-b],[a,-b+r],[a,b-r],[a-r,b],[-a+r,b],[-a,b-r],[-a,-b+r]];
  points.forEach(([px,py],i)=>i?s.lineTo(px,py):s.moveTo(px,py));s.closePath();
  if(opening){
    const [ow,oh]=opening,hole=new THREE.Path();
    hole.moveTo(-ow/2,-oh/2);hole.lineTo(-ow/2,oh/2);hole.lineTo(ow/2,oh/2);hole.lineTo(ow/2,-oh/2);hole.closePath();s.holes.push(hole);
  }
  const bevel=Math.min(.004,d/4),g=new THREE.ExtrudeGeometry(s,{depth:d-bevel*2,steps:1,curveSegments:1,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1});
  g.translate(0,0,-(d-bevel*2)/2);const mesh=new THREE.Mesh(g,material);mesh.name=`Coffee / ${name}`;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
}

export function createCoffeeMachine(m={},titanium=createLoungeTitanium()){
  const root=new THREE.Group();root.name='Atelier coffee vending machine';
  const dark=new THREE.MeshStandardMaterial({name:'Coffee / graphite ceramic',color:0x172021,metalness:.25,roughness:.43});
  const map=createCoffeePrint(),ink=new THREE.MeshStandardMaterial({name:'Coffee / enamel control print',map,roughness:.6,metalness:.1,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    userData:{cabinKeepSurface:true,cabinNoOutline:true,castShadow:false}});
  const screen=new THREE.MeshBasicMaterial({name:'Coffee / recessed control display',map,color:0x93b6a5,toneMapped:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    userData:{cabinAlwaysPowered:true,cabinKeepSurface:true,cabinNoOutline:true,castShadow:false}});
  const light=new THREE.MeshBasicMaterial({name:'Coffee / warm work strip',color:0xd7c7a2,toneMapped:false,
    userData:{cabinAlwaysPowered:true,castShadow:false}});
  // Strong side cheeks, a recessed back and removable bottom pan.
  // Reuse the lounge leg's satin titanium, including trim, controls and spouts.
  housing(root,titanium,'rear casing',0,.73,-.24,1.00,1.40,.18);
  for(const side of [-1,1]){
    housing(root,titanium,'machined side cheek',side*.48,.73,.045,.09,1.43,.61);
    box(root,titanium,side*.433,.73,.352,.008,1.33,.012);
    for(const y of [.17,1.31]){
      const bolt=cylinder(root,titanium,side*.48,y,.357,.014,.009,.014,6);bolt.rotation.x=Math.PI/2;bolt.name='Coffee / captive fastener';
    }
    // Brackets end on the wall surface; no dangling hoses below the appliance.
    box(root,titanium,side*.38,.40,-.40,.065,.80,.10).name='Coffee / wall mounting rail';
    rod(root,titanium,[side*.38,.06,.23],[side*.38,-.06,-.43],.022).name='Coffee / load bracket';
  }
  housing(root,titanium,'top cap',0,1.45,.02,1.055,.075,.65);
  housing(root,dark,'control fascia',0,1.12,.13,.86,.58,.40);
  print(root,ink,'brand',0,1.345,.338,.80,.10);
  // A real aperture, not a solid metal face 2.5 mm behind the display. The
  // screen sits inside the rim and retains separation at the wide OBS camera.
  housing(root,titanium,'screen bezel',-.15,1.09,.348,.49,.34,.033,.012,[.445,.264]);
  print(root,screen,'screen',-.15,1.09,.350,.453,.272);
  const gauge=cylinder(root,titanium,.315,1.185,.362,.080,.048,.080,24);gauge.rotation.x=Math.PI/2;
  print(root,ink,'gauge',.315,1.185,.394,.137,.137);
  const dial=cylinder(root,titanium,.315,.98,.365,.060,.048,.060,20);dial.rotation.x=Math.PI/2;dial.name='Coffee / rotary selector';
  box(root,titanium,.315,1.013,.393,.007,.022,.004);
  // Physical beverage keys, rather than a single generic sticker.
  for(const [key,x]of [['espresso',-.219],['americano',.219]]){
    housing(root,titanium,`${key} key`,x,.80,.33,.409,.145,.05,.012);
    print(root,ink,key,x,.80,.363,.386,.128);
  }
  housing(root,dark,'dispensing recess',0,.44,-.115,.86,.62,.065);
  housing(root,titanium,'brew head',-.065,.59,.115,.23,.27,.26,.012);
  box(root,dark,-.065,.467,.258,.19,.027,.013);
  for(const x of [-.11,-.02]){
    cylinder(root,titanium,x,.427,.22,.017,.065,.020,12).name='Coffee / espresso nozzle';
    cylinder(root,dark,x,.393,.22,.011,.004,.011,12).name='Coffee / nozzle opening';
  }
  rod(root,titanium,[.265,.64,.04],[.265,.45,.21],.016).name='Coffee / independent hot water spout';
  cylinder(root,titanium,.265,.431,.21,.019,.039,.019,12);
  box(root,light,0,.719,.07,.53,.012,.023).name='Coffee / cup bay light';
  housing(root,titanium,'drip tray',0,.105,.04,1.02,.105,.66,.019);
  box(root,dark,0,.162,.07,.79,.009,.48).name='Coffee / drain well';
  for(let i=0;i<18;i++)box(root,titanium,-.37+i*.0435,.175,.08,.018,.019,.43).name='Coffee / removable drain grate';
  print(root,ink,'tray',0,.107,.376,.43,.067);
  // Park the empty mug on the left of the grid, with its handle turned toward
  // the aisle. Keep the cup upright and the dispensing area clear.
  const mug=createLoungeCoffee(m,{filled:false});mug.name='Coffee / TARAIRON mug';
  mug.position.set(-.285,.185,.19);mug.rotation.y=-Math.PI/4;root.add(mug);
  // Closed twin-grinder cartridges give the upper housing a purposeful service seam.
  for(const x of [-.215,.215]){
    housing(root,dark,'sealed bean cartridge',x,1.51,-.07,.365,.11,.37,.014);
    box(root,titanium,x,1.572,-.065,.23,.018,.04);
  }
  // Put the service decal on the lounge-facing outer cheek, not behind the
  // dispensing head. Keep a small gap beyond the bevel to avoid z-fighting.
  const servicePrint=print(root,ink,'service',-.533,.97,.045,.46,.08625);
  servicePrint.rotation.y=-Math.PI/2;
  root.userData.coffee={mug,atlas:map,options:['espresso','americano']};
  return root;
}
