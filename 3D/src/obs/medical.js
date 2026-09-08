import * as THREE from 'three';
import {box,ball,cylinder,rod,pipe,label} from './materials.js';
import {MEDICAL} from './layout.js';

export const MED_BED={x:(MEDICAL.x-700)*.022,depth:-.22,top:.86,length:2.78,width:1.06,transition:2};
const smooth=value=>{const t=THREE.MathUtils.clamp(value,0,1);return t*t*(3-2*t);};

export function medicalRecline(time,duration=MEDICAL.dur/1000){
  return smooth(Math.min(time,duration-time)/MED_BED.transition);
}
export function applyMedicalPose(root,time,duration){
  const p=medicalRecline(time,duration),angle=-Math.PI/2*p,hip=.988;
  const {body,head,arms,legs}=root.userData;
  root.rotation.y=Math.PI/2;
  // Rotate around the hips, so the patient settles onto the couch rather than orbiting the feet.
  body.rotation.x=angle;
  body.position.set(0,hip+(MED_BED.top+.12-hip)*p-Math.cos(angle)*hip,-Math.sin(angle)*hip);
  head.rotation.set(0,0,0);
  for(const {arm,elbow}of arms){arm.rotation.x=-.1;elbow.rotation.x=-.18;}
  const sitting=Math.sin(p*Math.PI);
  for(const {leg,knee,boot}of legs){leg.rotation.x=-1.25*sitting;knee.rotation.x=1.4*sitting;boot.rotation.x=-.15*sitting;}
}

// Fictional instrument values; checkups and treatment never refill food, water or energy.
export function medicalReadings(needs,health=null){
  const condition=health?.condition,severity=condition?(100-health.value)/100:0;
  const recovery=health?.treatment?Math.max(0,1-health.treatment.elapsed/health.treatment.duration):1;
  return{pulse:Math.round(64+(100-needs.energy)*.18+Math.max(0,45-needs.thirst)*.22+severity*35*recovery),
    respiration:Math.round(13+(100-needs.energy)*.045+severity*8*recovery),temperature:36.6+(condition?.kind==='fever'?(1.4+severity)*recovery:0),
    advice:needs.thirst<35?'water':needs.energy<35?'rest':'routine'};
}

function monitor(parent,m,x,y){
  box(parent,m.dark,x,y,-1.00,1.65,1.05,.44,.06);
  box(parent,m.enamel,x,y,-.757,1.55,.95,.065,.025);
  box(parent,m.rubber,x-.12,y+.06,-.71,1.24,.72,.055,.026);
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=330;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(1.16,.65),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));
  face.position.set(x-.12,y+.06,-.675);parent.add(face);
  for(let i=0;i<3;i++)cylinder(parent,m.black,x+.65,y+.25-i*.22,-.68,.047,.045,.047,16).rotation.x=Math.PI/2;
  for(let i=0;i<4;i++)box(parent,i===3?m.teal:m.dark,x-.52+i*.26,y-.37,-.699,.17,.065,.026,.008);
  return{texture,canvas,frame:null};
}

export function createMedicalBay(m,y){
  const root=new THREE.Group();root.name='Medical bay';const {x,depth,top,length,width}=MED_BED;
  box(root,m.enamel,4.15,y+1.40,-1.49,5.04,2.65,.10,.035);
  box(root,m.teal,4.15,y+2.45,-1.425,5.02,.075,.02);
  label(root,'MEDICAL / 02',4.62,y+2.88,1.80,2.60,.15,{fg:'#dce6df',bg:'#335653',size:49});
  // Sealed supply cabinet, with a green first-aid mark distinct from the EVA bay.
  box(root,m.dark,2.14,y+1.24,-.90,1.28,2.46,1.04,.045);
  for(const side of [-1,1]){
    box(root,m.enamel,2.14+side*.31,y+1.25,-.354,.59,2.36,.08,.024);
    box(root,m.metal,2.14+side*.08,y+1.12,-.286,.035,.34,.05,.007);
    for(const yy of [.2,2.2])box(root,m.dark,2.14+side*.55,y+yy,-.286,.055,.12,.05,.008);
  }
  box(root,m.teal,2.14,y+1.77,-.285,.57,.53,.025,.018);
  box(root,m.white,2.14,y+1.77,-.266,.105,.35,.013);
  box(root,m.white,2.14,y+1.77,-.258,.35,.105,.013);
  label(root,'MED SUPPLIES',2.14,y+2.26,-.282,1.04,.13,{size:47});
  label(root,'SEALED / 04',2.14,y+.30,-.282,.92,.12,{size:47});
  const bed=new THREE.Group();bed.name='Examination couch';bed.position.set(x,y,depth);root.add(bed);
  for(const xx of [-.82,.82]){
    box(bed,m.dark,xx,.09,0,.49,.13,.87,.025);
    cylinder(bed,m.metal,xx,.39,0,.09,.52,.09,24);
    cylinder(bed,m.enamel,xx,.28,0,.14,.32,.14,24);
  }
  box(bed,m.dark,0,top-.22,0,length+.10,.15,width+.07,.045);
  box(bed,m.enamel,0,top-.13,0,length+.16,.09,width+.10,.035);
  box(bed,m.teal,0,top-.045,0,length,.09,width,.045);
  box(bed,m.cloth,-.08,top+.004,0,length-.18,.016,width-.10,.018);
  box(bed,m.cloth,-.90,top+.07,0,.43,.13,.77,.05);
  for(const zz of [-width/2-.03,width/2+.03]){
    for(const xx of [-.6,.55])rod(bed,m.metal,[xx,top-.18,zz],[xx,top+.19,zz],.023);
    rod(bed,m.metal,[-.6,top+.19,zz],[.55,top+.19,zz],.025);
  }
  box(bed,m.dark,.76,top-.135,width/2+.075,.47,.085,.025,.01);
  for(let i=0;i<3;i++)box(bed,i===2?m.teal:m.white,.62+i*.14,top-.13,width/2+.092,.055,.037,.012,.004);
  pipe(root,m.rubber,[[x+.85,y+.4,-.35],[x+1.1,y+.22,-1.1],[x+1.1,y+1.4,-1.36]],.024);
  const display=monitor(root,m,3.87,y+1.81);
  // Articulated examination light and a wall-mounted diagnostic head.
  box(root,m.dark,5.8,y+2.25,-1.32,.25,.28,.20,.024);
  rod(root,m.metal,[5.8,y+2.25,-1.18],[5.53,y+2.48,-.68],.035);
  rod(root,m.metal,[5.53,y+2.48,-.68],[5.02,y+2.23,-.03],.028);
  for(const [xx,yy,zz]of [[5.8,2.25,-1.18],[5.53,2.48,-.68],[5.02,2.23,-.03]])ball(root,m.dark,xx,y+yy,zz,.064,.064,.064);
  box(root,m.enamel,4.97,y+2.17,-.01,.65,.12,.40,.04);
  box(root,m.coolLamp,4.97,y+2.10,-.01,.54,.023,.31,.02);
  box(root,m.dark,6.14,y+1.63,-1.25,.45,.81,.25,.025);
  label(root,'AUTO\nSCAN',6.14,y+1.68,-1.10,.32,.24,{size:56});
  const lampMaterial=new THREE.MeshBasicMaterial({color:0x485e58,toneMapped:false});
  box(root,lampMaterial,6.14,y+1.96,-1.10,.22,.055,.025,.007);
  for(const side of [-1,1])pipe(root,m.rubber,[[6.14+side*.09,y+1.30,-1.13],[6.14+side*.16,y+1.11,-1.10],[6.3+side*.1,y+1.23,-1.09]],.014);
  return{root,bed,display,lampMaterial};
}

export function animateMedical(bay,time,active,readings,{duration=MEDICAL.dur/1000,treating=false,alert=false}={}){
  const phase=active?time<MED_BED.transition?'POSITIONING':time>duration-MED_BED.transition?'COMPLETE':treating?'TREATING':'ACQUIRING':readings?'LAST CHECK':'STANDBY';
  bay.lampMaterial.color.setHex(alert&&!active?0xf17d68:['ACQUIRING','TREATING'].includes(phase)?0x85e3af:active?0xf3bd62:0x485e58);
  const live=['ACQUIRING','TREATING'].includes(phase);
  const key=live?`${phase}:${Math.floor(time*10)}`:phase+JSON.stringify(readings);
  if(bay.display.frame===key)return;
  bay.display.frame=key;
  const ctx=bay.display.canvas.getContext('2d'),width=600,height=330;
  ctx.fillStyle='#061715';ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='#173632';ctx.lineWidth=1;
  for(let x=20;x<580;x+=25){ctx.beginPath();ctx.moveTo(x,65);ctx.lineTo(x,251);ctx.stroke();}
  for(let y=65;y<252;y+=25){ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(579,y);ctx.stroke();}
  ctx.fillStyle='#b5d7c5';ctx.font='22px monospace';ctx.fillText('MED-02 / '+phase,20,35);
  if(readings&&(live||phase==='COMPLETE'||!active)){
    ctx.fillStyle='#a0e5cc';ctx.font='26px monospace';ctx.fillText(`PULSE ${readings.pulse}   RESP ${readings.respiration}`,22,286);
    ctx.font='19px monospace';ctx.fillText('TEMP '+readings.temperature.toFixed(1)+' C',22,315);
    for(let row=0;row<2;row++){
      ctx.strokeStyle=row?'#ddc581':'#87e2c4';ctx.lineWidth=2.5;ctx.beginPath();
      for(let x=0;x<558;x++){
        const t=x/150-(live?time:0),beat=((t%1)+1)%1;
        const value=row?Math.sin(t*1.6)*14:Math.sin(t*6.28)*3-11*Math.exp(-(((beat-.34)/.05)**2))+53*Math.exp(-(((beat-.40)/.017)**2))-18*Math.exp(-(((beat-.45)/.027)**2));
        const y=112+row*99-value;x?ctx.lineTo(21+x,y):ctx.moveTo(21+x,y);
      }
      ctx.stroke();
    }
  }else{
    ctx.fillStyle='#87a398';ctx.font='23px monospace';ctx.fillText(active?'PATIENT POSITIONING':'NO PATIENT',165,168);
  }
  bay.display.texture.needsUpdate=true;
}
