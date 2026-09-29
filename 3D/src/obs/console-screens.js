import {CanvasTexture,SRGBColorSpace,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';

const W=768,H=470;
const C={background:'#07110e',panel:'#0d1c16',line:'#294c39',muted:'#688c70',text:'#accda6',bright:'#d1e6b7',green:'#90cc9e',amber:'#dbbf79',red:'#f19077'};
export const CONSOLE_CHANNELS=['FLIGHT','ATMOSPHERE','POWER'];
export const CONSOLE_REFRESH_SECONDS=1;
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;

// Local 28 V service bus estimates, not the mothership's propulsion power.
// A load changes when its corresponding equipment actually starts or stops.
export function consoleTelemetry({brain,care,airlock,droid,clock=0}={}){
  const environment=brain?.environment,activity=brain?.state==='performing'?brain.cur?.id:null;
  const doorMoving=airlock?.opening>0&&airlock.opening<1;
  const heating=activity==='galley'||droid?.step?.action==='cook-stir';
  const washing=Boolean(droid?.washingUntil>droid?.time);
  const loads=[
    {name:'AIR / CIRCULATION',watts:120,rating:200},
    {name:'CABIN LIGHTING',watts:96,rating:160},
    {name:'GALLEY',watts:heating?420:8,rating:500},
    {name:'MEDICAL',watts:activity==='medical'?180:12,rating:250},
    {name:'UTILITY / DOORS',watts:24+(washing?180:0)+(doorMoving?96:0)+(brain?.hatchRepair?32:0),rating:400},
    {name:'DROID DOCK',watts:droid?.docked===false?0:84,rating:120},
  ];
  const watts=loads.reduce((sum,load)=>sum+load.watts,0),voltage=28.4;
  const hour=finite(brain?.hour,8),minutes=Math.floor(hour*60);
  return{clock:Math.max(0,finite(environment?.clock,clock)),
    shipTime:`${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`,
    temperature:finite(environment?.temperature,21.4),pressure:finite(environment?.pressure,101.3),
    fault:Boolean(environment?.fault),faultStage:environment?.fault?.stage??null,
    innerDoor:airlock?.opening>.01?'OPEN':'CLOSED',loads,voltage,watts,amps:watts/voltage,
    freight:care?.phase??'idle',stock:{food:care?.supplies?.food??3,water:care?.supplies?.water??4,catfood:care?.supplies?.catfood??3}};
}

function text(ctx,value,x,y,size=20,color=C.text,align='left'){
  ctx.font=`500 ${size}px "Courier New",monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(String(value),x,y);
}
function line(ctx,x1,y1,x2,y2,color=C.line,width=2){
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
}
function box(ctx,x,y,w,h,color=C.line,fill=null){
  if(fill){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);}ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);
}
function circle(ctx,x,y,r,color=C.line,fill=null){
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=2;
  if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.stroke();
}
function diamond(ctx,x,y,r,color=C.bright){
  ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.stroke();
}
function header(ctx,index,title,telemetry){
  ctx.fillStyle=C.background;ctx.fillRect(0,0,W,H);
  box(ctx,8,8,W-16,H-16);text(ctx,`TARAIRON  /  ${String(index+1).padStart(2,'0')}`,24,34,18,C.muted);
  text(ctx,telemetry.shipTime,744,34,20,C.text,'right');line(ctx,24,45,744,45);
  text(ctx,title,24,77,30,C.bright);line(ctx,24,398,744,398);
}
function footer(ctx,left,right,color=C.green){
  ctx.fillStyle=color;ctx.fillRect(24,422,8,8);text(ctx,left,43,435,20,color);text(ctx,right,744,435,18,C.muted,'right');
}

function flight(ctx,t){
  header(ctx,0,'ORBIT / ATTITUDE',t);
  // An orbit-hold reference diagram, not a made-up altitude or spin model.
  const x=231,y=248,r=132;
  text(ctx,'LUNAR REFERENCE',24,108,18,C.muted);
  for(const offset of [-88,-44,0,44,88]){
    line(ctx,x-r,y+offset,x+r,y+offset,C.panel,1);line(ctx,x+offset,y-r,x+offset,y+r,C.panel,1);
  }
  circle(ctx,x,y,r,C.green);circle(ctx,x,y,44,C.muted,C.panel);
  line(ctx,x-r-10,y,x+r+10,y);line(ctx,x,y-r-10,x,y+r+10);
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12,outer=r+(i%6===0?10:5);
    line(ctx,x+Math.cos(a)*r,y+Math.sin(a)*r,x+Math.cos(a)*outer,y+Math.sin(a)*outer,C.muted,1);
  }
  text(ctx,'MOON',x,y+6,18,C.text,'center');
  text(ctx,'090',x+r+17,y+6,16,C.muted);text(ctx,'270',x-r-17,y+6,16,C.muted,'right');
  const px=x+r*.7071,py=y-r*.7071;
  line(ctx,x+35,y-35,px-12,py+12,C.muted,1);diamond(ctx,px,py,8);
  line(ctx,px+8,py,385,py,C.text);text(ctx,'TARAIRON',385,py-12,18,C.bright,'right');
  text(ctx,'REFERENCE TRACK',x,383,16,C.muted,'center');

  line(ctx,447,96,447,382);
  text(ctx,'CORE ATTITUDE',477,112,20,C.text);text(ctx,'INERTIAL HOLD',477,139,17,C.muted);
  const ax=609,ay=215;
  circle(ctx,ax,ay,53,C.line);circle(ctx,ax,ay,6,C.green);
  line(ctx,ax-70,ay,ax-17,ay,C.green);line(ctx,ax+17,ay,ax+70,ay,C.green);
  line(ctx,ax,ay-66,ax,ay-17,C.green);line(ctx,ax,ay+17,ax,ay+66,C.green);
  for(const delta of [-28,28])line(ctx,ax-20,ay+delta,ax+20,ay+delta,C.muted,1);
  [['PITCH',477],['YAW',576],['ROLL',675]].forEach(([label,xx])=>{text(ctx,label,xx,310,16,C.muted);text(ctx,'+0.0°',xx,338,26,C.bright);});
  text(ctx,'RATE',477,373,18,C.muted);text(ctx,'0.000 DEG/S',738,373,20,C.text,'right');
  footer(ctx,'ATTITUDE HOLD',t.freight==='transmitting'?'COMMS / UPLINK':'MAIN DRIVE / INHIBITED');
}

function pressureTrend(ctx,t,history){
  const x=81,y=247,w=332,h=100,low=100.8,high=101.8;
  text(ctx,'PRESSURE HISTORY / kPa',24,225,18,C.muted);
  for(const value of [101.8,101.3,100.8]){
    const yy=y+h*(high-value)/(high-low);line(ctx,x,yy,x+w,yy,C.line,1);text(ctx,value.toFixed(1),x-10,yy+5,15,C.muted,'right');
  }
  for(const age of [120,60,0]){
    const xx=x+w*(1-age/120);line(ctx,xx,y,xx,y+h,C.line,1);text(ctx,age?`-${age}s`:'NOW',xx,370,15,C.muted,age===120?'left':age===0?'right':'center');
  }
  const visible=history.filter(sample=>sample.clock>=t.clock-120);
  ctx.strokeStyle=C.green;ctx.lineWidth=3;ctx.beginPath();
  visible.forEach((sample,i)=>{
    const xx=x+w*Math.max(0,1-(t.clock-sample.clock)/120),yy=y+h*(high-sample.pressure)/(high-low);
    if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);
  });ctx.stroke();
  const yy=y+h*(high-t.pressure)/(high-low);ctx.fillStyle=C.bright;ctx.fillRect(x+w-3,yy-3,6,6);
}
function atmosphere(ctx,t,history){
  header(ctx,1,'CABIN / ATMOSPHERE',t);
  for(const [x,label,value,unit]of [[24,'TEMPERATURE',t.temperature.toFixed(1),'°C'],[390,'PRESSURE',t.pressure.toFixed(1),'kPa']]){
    box(ctx,x,97,354,94,C.line,C.panel);text(ctx,label,x+14,123,18,C.muted);
    text(ctx,value,x+12,175,54,C.bright);text(ctx,unit,x+336,172,26,C.text,'right');
  }
  pressureTrend(ctx,t,history);
  line(ctx,447,212,447,381);text(ctx,'PRESSURE BOUNDARY',469,225,18,C.muted);
  for(const [label,y]of [['OPS',244],['HAB',291],['SVC',338]]){
    box(ctx,478,y,98,33,C.muted);text(ctx,label,527,y+23,20,C.text,'center');
  }
  line(ctx,491,277,491,291,C.muted);line(ctx,491,324,491,338,C.muted);
  line(ctx,576,260,607,260,t.innerDoor==='OPEN'?C.green:C.muted);
  if(t.innerDoor==='CLOSED')line(ctx,590,251,590,269,C.text,3);
  box(ctx,607,244,102,33,t.fault?C.red:C.green);text(ctx,'EVA',658,267,20,t.fault?C.red:C.green,'center');
  line(ctx,719,243,719,279,t.fault?C.red:C.green,4);
  text(ctx,'INNER',602,313,16,C.muted);text(ctx,t.innerDoor,602,338,20,C.text);
  footer(ctx,t.fault?'EVA LOCK / FAULT':'OUTER HATCH / SEALED','LOCAL SENSOR FEED',t.fault?C.red:C.green);
}

const freightLabels={idle:'STANDBY',queued:'ORDER QUEUED',transmitting:'TRANSMITTING',inbound:'INBOUND',unloading:'UNLOADING'};
const repairLabels={detected:'INSPECTION REQUIRED',inspect:'INSPECTING CONTACT',repair:'CONTACT ADJUSTMENT',verify:'VERIFYING LOCK'};
function power(ctx,t){
  header(ctx,2,'POWER / DISTRIBUTION',t);
  for(const [x,label,value,unit]of [[24,'SERVICE BUS',t.voltage.toFixed(1),'V'],[278,'CURRENT',t.amps.toFixed(1),'A'],[522,'TOTAL LOAD',(t.watts/1000).toFixed(2),'kW']]){
    text(ctx,label,x,108,17,C.muted);text(ctx,value,x,151,42,C.bright);text(ctx,unit,x+165,149,24,C.text);
  }
  line(ctx,24,168,744,168);
  box(ctx,24,189,126,56,C.green,C.panel);text(ctx,'BUS A',87,214,24,C.bright,'center');text(ctx,'ONLINE',87,236,16,C.green,'center');
  line(ctx,150,217,186,217,C.green,3);line(ctx,186,194,186,339,C.green,3);
  box(ctx,24,281,126,56,C.line);text(ctx,'BUS B',87,306,24,C.muted,'center');text(ctx,'RESERVE',87,328,16,C.muted,'center');
  line(ctx,150,310,162,310,C.muted);line(ctx,162,310,176,295,C.muted);line(ctx,180,310,186,310,C.muted);
  t.loads.forEach((load,i)=>{
    const y=194+i*29,active=load.watts>0;
    line(ctx,186,y,206,y,active?C.green:C.muted,2);text(ctx,load.name,218,y+6,17,active?C.text:C.muted);
    box(ctx,454,y-7,159,12,C.line);ctx.fillStyle=active?C.green:C.line;ctx.fillRect(457,y-4,153*Math.min(1,load.watts/load.rating),6);
    text(ctx,`${String(load.watts).padStart(3,' ')} W`,743,y+7,20,active?C.bright:C.muted,'right');
  });
  const status=t.fault?`EVA LOCK / ${repairLabels[t.faultStage]??'CHECK REQUIRED'}`:'PROTECTION / NO TRIPPED CIRCUITS';
  text(ctx,status,24,382,18,t.fault?C.red:C.muted);
  footer(ctx,`CARGO / ${freightLabels[t.freight]??'STANDBY'}`,`F:${t.stock.food} W:${t.stock.water} C:${t.stock.catfood}`,t.freight==='idle'?C.green:C.amber);
}

export function drawConsoleScreen(canvas,index,telemetry,history=[]){
  const ctx=canvas.getContext('2d');ctx.save();ctx.scale(canvas.width/W,canvas.height/H);
  [flight,atmosphere,power][index](ctx,telemetry,history);
  // Restrained phosphor raster; labels remain sharp when the camera approaches.
  ctx.fillStyle='#00000018';for(let y=0;y<H;y+=4)ctx.fillRect(9,y,W-18,1);
  ctx.restore();
}

export class ConsoleScreens {
  constructor(){this.displays=[];this.history=[];this.lastClock=null;}
  add(parent,x,y,z,w,h,index){
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=Math.round(canvas.width*h/w);
    drawConsoleScreen(canvas,index,consoleTelemetry());
    const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
    const material=new MeshBasicMaterial({name:`Console / ${CONSOLE_CHANNELS[index]}`,map:texture,toneMapped:false});
    material.userData.cabinAlwaysPowered=true;
    const mesh=new Mesh(new PlaneGeometry(w,h),material);mesh.name=material.name;mesh.position.set(x,y,z);parent.add(mesh);
    this.displays.push({canvas,texture,index});return mesh;
  }
  update(state){
    const now=Math.max(0,finite(state?.brain?.environment?.clock,finite(state?.clock,0)));
    if(this.lastClock!==null&&now>=this.lastClock&&now-this.lastClock<CONSOLE_REFRESH_SECONDS)return false;
    if(this.lastClock!==null&&now<this.lastClock)this.history=[];
    const telemetry=consoleTelemetry(state);this.lastClock=now;
    this.history.push({clock:now,pressure:telemetry.pressure});
    this.history=this.history.filter(sample=>sample.clock>=now-120);
    for(const {canvas,texture,index}of this.displays){drawConsoleScreen(canvas,index,telemetry,this.history);texture.needsUpdate=true;}
    return true;
  }
}
