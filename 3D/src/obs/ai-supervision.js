import {CanvasTexture,SRGBColorSpace,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import {consoleTelemetry} from './console-screens.js';
import {FLOORS} from './layout.js';

const W=1024,H=238;
const C={bg:'#071114',panel:'#0c2024',line:'#285057',dim:'#70969b',text:'#b2c8c6',white:'#d6e4d6',crew:'#adddb8',cat:'#dfc48a',droid:'#8fc9df',red:'#ef9c80'};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const code=value=>String(value??'STANDBY').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').toUpperCase();
const stationNames={bunk:'BUNK',lounge:'LOUNGE',galley:'GALLEY',hydro:'WATER',gym:'EXERCISE',console:'CONSOLE',medical:'MEDICAL',airlock:'EVA HATCH',innerHatch:'INNER HATCH',grooming:'GROOMING',smoking:'SMOKING',plant:'HYDROPONICS',shower:'SHOWER',toilet:'WC'};
const jobNames={cargo:'CARGO TRANSFER',harvest:'HARVEST',laundry:'LAUNDRY',toilet:'WC CLEANING',shower:'SHOWER CLEANING',cook:'MEAL PREPARATION',feed:'LUCY FEEDING'};
const floorHeight=index=>(870-FLOORS[index].y)*.016;
const percentage=value=>Number.isFinite(value)?clamp(Math.round(value),0,100):null;

function crewActivity(brain,actor){
  if(!brain)return 'AWAITING TELEMETRY';
  if(actor?.climbing)return 'IN TRANSIT / SHAFT';
  if(actor?.waitingForHatch||actor?.waitingForCat||actor?.waitingForDroid)return 'HOLD / AISLE CLEARANCE';
  const destination=stationNames[brain.cur?.id]??code(brain.cur?.id);
  if(actor?.busy||brain.state==='goingTo')return `TRANSIT > ${destination}`;
  if(brain.hatchRepair)return `EVA / ${code(brain.hatchRepair.phase)}`;
  if(brain.state==='playingGame')return 'LOUNGE / GAME';
  if(brain.bunkVisit?.phase==='sleeping')return 'BUNK / REST';
  if(brain.state==='performing')return destination;
  return code(brain.state);
}
function track(id,name,color,motion,world=false,status='STANDBY'){
  if(!motion||!Number.isFinite(motion.x))return null;
  const floor=clamp(motion.floor??0,0,2),height=Number.isFinite(motion.y)?(world?motion.y:(870-motion.y)*.016):floorHeight(floor);
  return{id,name,color,x:clamp(world?motion.x:(motion.x-700)*.022,-13,13),
    deck:clamp((floorHeight(0)-height)/(floorHeight(0)-floorHeight(1)),0,2),status};
}

export function supervisionTelemetry(state={}){
  const {brain,care,catRoutine:cat,droid,airlock}=state,actor=state.actor??brain?.actor;
  const basic=consoleTelemetry(state),crewStatus=crewActivity(brain,actor);
  const catStatus=cat?.motion?.hidden?'REAR PASSAGE':cat?code(cat.mode):'AWAITING TELEMETRY';
  const droidStatus=!droid?'AWAITING TELEMETRY':droid.docked?'DOCKED / CHARGING':droid.waiting?'HOLD / SHAFT':droid.returning?'RETURN TO DOCK':jobNames[droid.job]??code(droid.step?.action);
  const needs=brain?.statusNeeds??brain?.needs??{};
  const room=id=>{
    const visit=brain?.bathroom?.id===id?brain.bathroom.pose:null;
    if(visit?.inside)return 'OCCUPIED';
    const opening=visit?.opening??(droid?.door===id?droid.opening:0);
    return opening>=.999?'OPEN':opening>.001?'MOVING':'CLOSED';
  };
  return{...basic,crewStatus,catStatus,droidStatus,
    crew:{food:percentage(needs.hunger),water:percentage(needs.thirst),rest:percentage(needs.energy),health:percentage(brain?.health?.value??needs.health)},
    cat:{food:percentage(cat?.hunger),rest:percentage(cat?.energy)},
    healthStage:brain?.health?code(brain.health.stage):'NO SIGNAL',
    alarms:Number(basic.fault)+Number(Boolean(brain?.health?.needsCare)),
    rooms:{inner:airlock?.opening>.001?(airlock.opening>=.999?'OPEN':'MOVING'):'CLOSED',toilet:room('toilet'),shower:room('shower')},
    tracks:[track('C01','MILO',C.crew,actor,false,crewStatus),track('F01','LUCY',C.cat,cat?.motion,false,catStatus),track('R17','DROID 3817',C.droid,droid?.position,true,droidStatus)].filter(Boolean),
    source:brain?'LOCAL INPUTS ONLINE':'WAITING FOR LOCAL INPUTS',
    supplyState:code(care?.phase??'idle')};
}

function text(ctx,value,x,y,size=20,color=C.text,align='left'){
  ctx.font=`500 ${size}px "Courier New",monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(String(value),x,y);
}
function line(ctx,x1,y1,x2,y2,color=C.line,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function box(ctx,x,y,w,h,color=C.line,fill=null){if(fill){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);}ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);}
function header(ctx,index,title,t){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);box(ctx,5,5,W-10,H-10);
  text(ctx,`0${index+1} / ${title}`,22,30,22,C.white);text(ctx,t.shipTime,1000,30,20,C.dim,'right');line(ctx,18,42,1006,42);
  line(ctx,18,211,1006,211);
}
function footer(ctx,left,right,color=C.dim){text(ctx,left,22,229,15,color);text(ctx,right,1000,229,15,C.dim,'right');}
function marker(ctx,x,y,id,color){
  ctx.fillStyle=color;ctx.fillRect(x-4,y-4,8,8);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(x-8,y-8,16,16);
  const left=x>566,labelY=y+(id==='C01'?-10:id==='F01'?19:5);
  text(ctx,id,x+(left?-13:13),labelY,16,color,left?'right':'left');
}
function tracking(ctx,t){
  header(ctx,0,'HABITAT / POSITION TRACKING',t);
  const x=102,w=499,ys=[77,130,182];
  for(let deck=0;deck<3;deck++){
    text(ctx,['01 OPS','02 HAB','03 SVC'][deck],22,ys[deck]+5,17,C.dim);
    box(ctx,x,ys[deck]-18,w,35,C.line,C.panel);
    for(const xx of [x+w*.22,x+w*.38,x+w*.66,x+w*.82])line(ctx,xx,ys[deck]-18,xx,ys[deck]+17,C.line,1);
    line(ctx,x+w/2-5,ys[deck]-19,x+w/2-5,ys[deck]+19,C.dim,2);line(ctx,x+w/2+5,ys[deck]-19,x+w/2+5,ys[deck]+19,C.dim,2);
  }
  line(ctx,x+w/2,59,x+w/2,200,C.dim,1);
  if(t.fault)box(ctx,x+w-20,59,20,36,C.red);
  for(const actor of t.tracks)marker(ctx,x+(actor.x+13)/26*w,ys[0]+actor.deck*(ys[1]-ys[0]),actor.id,actor.color);
  line(ctx,641,55,641,200);
  [['C01','MILO',C.crew,t.crewStatus],['F01','LUCY',C.cat,t.catStatus],['R17','DROID 3817',C.droid,t.droidStatus]].forEach(([id,name,color,status],i)=>{
    const y=73+i*52;text(ctx,`${id} ${name}`,667,y,21,color);text(ctx,status.slice(0,28),667,y+22,16,C.dim);
  });
  footer(ctx,`${t.tracks.length} TRACKS / INTERNAL POSITION FEED`,'HABITAT SECTION A-A');
}
function bar(ctx,label,value,x,y,w,color=C.crew){
  const live=value!==null,active=live&&value<25?C.red:color;
  text(ctx,label,x,y,17,C.dim);text(ctx,live?`${value}%`:'--',x+w,y,22,active,'right');
  box(ctx,x,y+9,w,9,C.line);if(live){ctx.fillStyle=active;ctx.fillRect(x+2,y+11,(w-4)*value/100,5);}
}
function occupants(ctx,t){
  header(ctx,1,'OCCUPANTS / CARE STATUS',t);
  text(ctx,'C01 / M. JARVIS',22,72,22,C.crew);text(ctx,t.crewStatus,638,72,18,C.text,'right');
  bar(ctx,'FOOD',t.crew.food,22,116,278);bar(ctx,'WATER',t.crew.water,354,116,278);
  bar(ctx,'REST',t.crew.rest,22,178,278);bar(ctx,'HEALTH',t.crew.health,354,178,278);
  line(ctx,661,55,661,199);text(ctx,'F01 / LUCY',685,72,22,C.cat);
  bar(ctx,'FOOD',t.cat.food,685,116,315,C.cat);bar(ctx,'REST',t.cat.rest,685,178,315,C.cat);
  footer(ctx,`CREW / ${t.healthStage}`,`LUCY / ${t.catStatus}`,t.alarms?C.red:C.dim);
}
function systems(ctx,t){
  header(ctx,2,'ENVIRONMENT / INTERLOCKS',t);
  text(ctx,'CABIN TEMP',22,76,17,C.dim);text(ctx,t.temperature.toFixed(1),22,122,47,C.white);text(ctx,'°C',153,121,21,C.text);
  text(ctx,'PRESSURE',224,76,17,C.dim);text(ctx,t.pressure.toFixed(1),224,122,47,C.white);text(ctx,'kPa',382,121,21,C.text);
  text(ctx,t.fault?'EVA LOCK / ATTENTION':'PRESSURE BOUNDARY / SEALED',22,166,20,t.fault?C.red:C.crew);
  text(ctx,t.fault?`MAINTENANCE / ${code(t.faultStage)}`:'LOCAL ENVIRONMENT CONTROL',22,194,17,C.dim);
  line(ctx,454,55,454,198);
  [['OPS INNER',t.rooms.inner],['WC',t.rooms.toilet],['SHOWER',t.rooms.shower]].forEach(([name,status],i)=>{
    const y=80+i*43;text(ctx,name,479,y,20,C.text);text(ctx,status,990,y,21,status==='CLOSED'?C.dim:C.cat,'right');line(ctx,479,y+10,992,y+10,C.line,1);
  });
  footer(ctx,t.alarms?`${t.alarms} ACTIVE ALERT${t.alarms===1?'':'S'} / SUPERVISOR ATTENTION`:'INTERLOCKS / MONITORING',`CARGO / ${t.supplyState}`,t.alarms?C.red:C.dim);
}
function journal(ctx,t,events){
  header(ctx,3,'SUPERVISOR / EVENT JOURNAL',t);
  if(!events.length){text(ctx,'--:--  LOCAL INPUT HANDSHAKE',22,87,21,C.dim);text(ctx,'       AWAITING CABIN STATE',22,121,20,C.dim);}
  events.slice(-4).reverse().forEach((event,i)=>{
    const y=77+i*36;text(ctx,event.time,22,y,19,C.dim);text(ctx,event.source,108,y,19,event.alert?C.red:C.droid);
    text(ctx,event.message,270,y,20,event.alert?C.red:C.text);
  });
  footer(ctx,t.source,`RECORDS / ${String(events.length).padStart(2,'0')}`);
}
export function drawSupervisionScreen(canvas,index,t,events=[]){
  const ctx=canvas.getContext('2d');ctx.save();ctx.scale(canvas.width/W,canvas.height/H);
  [tracking,occupants,systems,journal][index](ctx,t,events);
  ctx.fillStyle='#00000013';for(let y=0;y<H;y+=4)ctx.fillRect(6,y,W-12,1);ctx.restore();
}

function displayKey(index,t,events){
  let values;
  switch(index){
    case 0:values=[t.fault,t.crewStatus,t.catStatus,t.droidStatus,t.tracks.map(track=>[track.id,Math.round((track.x+13)/26*499),Math.round(track.deck*53)])];break;
    case 1:values=[t.crewStatus,t.healthStage,t.catStatus,t.alarms,t.crew,t.cat];break;
    case 2:values=[t.temperature.toFixed(1),t.pressure.toFixed(1),t.fault,t.faultStage,t.rooms,t.alarms,t.supplyState];break;
    case 3:values=[t.source,events.length,events.slice(-4)];break;
  }
  return JSON.stringify([t.shipTime,values]);
}

// A bounded observer of the existing simulation: no separate actions, random
// values, timers or fabricated events. Pausing the cabin freezes the readouts.
export class AISupervision {
  constructor(){this.displays=[];this.events=[];this.previous=null;this.lastClock=null;}
  add(parent,x,y,z,w,h,index){
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=Math.round(W*h/w);
    drawSupervisionScreen(canvas,index,supervisionTelemetry());
    const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
    const material=new MeshBasicMaterial({name:`AI supervision display ${index+1}`,map:texture,toneMapped:false});material.userData.cabinAlwaysPowered=true;
    const mesh=new Mesh(new PlaneGeometry(w,h),material);mesh.name=material.name;mesh.position.set(x,y,z);parent.add(mesh);
    this.displays.push({canvas,texture,index});return mesh;
  }
  update(state){
    const suppliedClock=state?.brain?.environment?.clock??state?.clock??0,now=Number.isFinite(suppliedClock)?Math.max(0,suppliedClock):0;
    if(this.lastClock!==null&&now>=this.lastClock&&now-this.lastClock<.5)return false;
    const t=supervisionTelemetry(state);
    if(this.lastClock!==null&&t.clock<this.lastClock){this.events=[];this.previous=null;}
    const snapshot={CREW:t.crewStatus,LUCY:t.catStatus,DROID:t.droidStatus,
      'EVA LOCK':t.fault?code(t.faultStage):'SEALED',HEALTH:t.healthStage,CARGO:t.supplyState};
    if(!this.previous)this.events.push({time:t.shipTime,source:'SUPERVISOR',message:t.source,alert:false});
    else for(const [source,message]of Object.entries(snapshot))if(message!==this.previous[source]){
      this.events.push({time:t.shipTime,source,message,alert:source==='EVA LOCK'&&t.fault||source==='HEALTH'&&['WARNING','URGENT','CRITICAL'].includes(message)});
    }
    this.events=this.events.slice(-24);this.previous=snapshot;this.lastClock=t.clock;
    // Upload only changed pixels; an unchanged journal or gauge keeps its GPU
    // texture and mipmaps even while the position screen is following movement.
    for(const display of this.displays){
      const key=displayKey(display.index,t,this.events);if(display.key===key)continue;
      drawSupervisionScreen(display.canvas,display.index,t,this.events);display.texture.needsUpdate=true;display.key=key;
    }
    return true;
  }
}
