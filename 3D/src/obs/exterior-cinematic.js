import {EXTERIOR,exteriorAngle} from './ship-exterior.js';
import {EXTERIOR_CRUISE_SPEED} from './exterior-cruise.js';
import {EXTERIOR_LOGO,sampleExteriorLogo} from './exterior-logo.js';
import {sampleExteriorProbeFlight} from './exterior-probe-flight.js';

// Distinguish an observer in space from a camera bolted to the hull. Fixed
// shots never pan/translate to keep the ship centered. The opening approach
// tilts at a fixed position; flight stays at 2 m/s apart from the two flyovers
// and extreme-wide planet transit.
export const CINEMA_SHOTS=Object.freeze([
  {id:'overhead',number:1,name:'ティルト / 斜め上から・奥から手前へ接近',mode:'tilt',duration:38,speed:9.2,delay:EXTERIOR_LOGO.end,anchor:0,probeStage:'away',
    eye:[[315,115,35]],target:[[0,0,0]],tilt:[44.5,60],fov:42},
  {id:'planet',number:2,name:'固定カメラ / 惑星を横切る遥かな船',mode:'fixed',duration:12,speed:48,probeStage:'away',
    eye:[[0,350,3900]],target:[[0,100,0]],fov:42,wide:true,planet:true,near:5,far:60000},
  {id:'distant',number:3,name:'固定カメラ / 下から接近する探査機',mode:'fixed',duration:8,probeStage:'approach',
    eye:[[235,72,255]],target:[[0,8,0]],fov:38,wide:true},
  // Start 4.5 seconds into the original capture; hold for 2.5 seconds after contact.
  {id:'lander',number:7,name:'船体下 / 探査機のドッキング',mode:'follow',duration:10.75,sourceOffset:4.5,sourceDuration:14.75,captureDuration:12,probeStage:'dock',
    eye:[[-16,-10,24]],target:[[0,1,0]],fov:40,zoomTo:32,lander:true,fitAspect:true,hideHabitats:true},
  {id:'crossing',number:4,name:'超望遠 / 大きな惑星を背景に横切る船',mode:'fixed',duration:10,
    eye:[[0,7,2100]],target:[[0,0,0]],fov:3.5,wide:true,planet:[1600,-200,-78000],near:10,far:150000},
  {id:'mounted',number:5,name:'船体固定カメラ / 回転する重力区画',mode:'mounted',duration:8,
    eye:[[12.8,3.85,1.8]],target:[[-1.6,6,0]],fov:58,core:true},
  {id:'flyby',number:9,name:'固定カメラ / 背後から通過・彼方へ航行',mode:'fixed',duration:60,speed:6,anchor:0,
    eye:[[18,-31,20.5]],target:[[338,-1,0]],fov:56,near:.25,far:1e8},
]);
export const OPENING_DURATION=CINEMA_SHOTS.reduce((sum,shot)=>sum+shot.duration,0);
export const EXTERIOR_VIEW_DURATION=OPENING_DURATION*4/3;
export const CINEMA_DISSOLVE_SECONDS=1.5;
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const sample=(points,u)=>points.length===1?[...points[0]]:lerp(points[0],points[1],u);

// Pure time sampling: playback and seeking agree without accumulated camera
// state. Unequal holds replace the identical start/stop tweens.
function sampleCinemaShot(seconds,{opening=false,aspect=16/9,coreScale=2.6,phase=55*Math.PI/180,rpm=EXTERIOR.rpm}={},forcedIndex=null){
  const duration=opening?OPENING_DURATION:EXTERIOR_VIEW_DURATION;
  const elapsed=Math.max(0,Number.isFinite(seconds)?seconds:0);
  const time=elapsed;
  const timingScale=duration/OPENING_DURATION;
  let index=0,start=0,distance=0;
  while(index<CINEMA_SHOTS.length-1&&(forcedIndex===null?time>=start+CINEMA_SHOTS[index].duration*timingScale:index<forcedIndex)){
    const previous=CINEMA_SHOTS[index],hold=previous.duration*timingScale;
    distance+=Math.max(0,hold-(previous.delay??0))*(previous.speed??EXTERIOR_CRUISE_SPEED);start+=hold;index++;
  }
  const shot=CINEMA_SHOTS[index],shotDuration=shot.duration*timingScale,end=start+shotDuration,sourceOffset=(shot.sourceOffset??0)*timingScale;
  const sourceDuration=shot.sourceDuration===undefined?shotDuration+sourceOffset:shot.sourceDuration*timingScale;
  const u=Math.max(0,Math.min(1,(time-start+sourceOffset)/sourceDuration));
  const fov=shot.zoomTo===undefined?shot.fov:shot.fov+(shot.zoomTo-shot.fov)*u;
  let eye=sample(shot.eye,u),target=sample(shot.target,u);
  if(shot.tilt){
    // A vertical tilt changes pitch only: position, horizontal bearing and
    // focal length stay fixed while the real ship grows as it approaches.
    // The approaching ship crosses the upper edge through its own forward
    // motion. The camera begins tilting down only after the logo has gone.
    const flight=Math.max(0,Math.min(1,(time-start-(shot.delay??0))/(shotDuration-(shot.delay??0))));
    const pitch=(shot.tilt[0]+(shot.tilt[1]-shot.tilt[0])*flight*flight)*Math.PI/180;
    target[1]=eye[1]-Math.hypot(target[0]-eye[0],target[2]-eye[2])*Math.tan(pitch);
  }
  if(shot.core){eye=eye.map((v,i)=>i===0?(v-EXTERIOR.rotorX)*coreScale+EXTERIOR.rotorX:v*coreScale);target=target.map((v,i)=>i===0?(v-EXTERIOR.rotorX)*coreScale+EXTERIOR.rotorX:v*coreScale);}
  if(shot.lander){
    const origin=[(10.4-EXTERIOR.rotorX)*coreScale+EXTERIOR.rotorX,-2.65*coreScale-7.25+3.1,0];
    eye=eye.map((v,i)=>v+origin[i]);target=target.map((v,i)=>v+origin[i]);
  }
  if(shot.wide||shot.fitAspect){
    const fit=Math.max(1,1/Math.max(.25,aspect)),size=shot.wide?Math.max(1,coreScale/2.6):1;
    eye=eye.map((v,i)=>target[i]+(v-target[i])*fit*size);
  }
  const shipSpeed=shot.speed??EXTERIOR_CRUISE_SPEED;
  // Incoming shots already move during the overlap before their nominal start.
  // Only scene 01 waits for the introductory logo.
  const flightTime=shot.delay?Math.max(0,time-start-shot.delay):time-start;
  const shipX=distance+flightTime*shipSpeed;
  // Place a fixed camera once at the shot midpoint. Only the ship advances
  // after that; copying shipX into eye and target would fake a pass-by.
  const cameraX=shot.mode==='fixed'||shot.mode==='tilt'?distance+(shot.anchor??shotDuration/2*shipSpeed):shipX;
  eye[0]+=cameraX;target[0]+=cameraX;
  // The last fixed observer remains in place indefinitely. There is no
  // reset, closing fade, or automatic entry into the cabin.
  const fade=0;
  const logo=sampleExteriorLogo(time);
  const titleOpacity=logo.opacity;
  const approachDuration=CINEMA_SHOTS.find(s=>s.probeStage==='approach').duration*timingScale;
  const docking=CINEMA_SHOTS.find(s=>s.probeStage==='dock'),captureDuration=docking.captureDuration*timingScale;
  const approachStart=CINEMA_SHOTS.slice(0,CINEMA_SHOTS.findIndex(s=>s.probeStage==='approach')).reduce((sum,s)=>sum+s.duration*timingScale,0);
  // Reach the trimmed close-up smoothly in scene 03. Both dissolve cameras
  // sample one continuous flight, without a position or velocity jump.
  const approachProgress=Math.max(0,Math.min(1,(time-approachStart)/approachDuration));
  const advance=approachProgress**3*(approachProgress*(approachProgress*6-15)+10)*(docking.sourceOffset??0)*timingScale;
  const probe=shot.probeStage==='approach'||shot.probeStage==='dock'?
    sampleExteriorProbeFlight(time-approachStart+advance,{approachDuration,captureDuration,coreScale}):
    {visible:shot.probeStage!=='away',position:[0,0,0],rotation:[0,0,0],latched:shot.probeStage!=='away'};
  const planet=Array.isArray(shot.planet)?shot.planet:[2200,900,-11000];
  return{index,number:shot.number,id:shot.id,name:shot.name,mode:shot.mode,eye,target,up:shot.up??[0,1,0],fov,shipX,shipSpeed,probe,
    logoReveal:logo.reveal,logoFlicker:logo.flicker,
    shipVisible:time>=EXTERIOR_LOGO.end,
    habitatsVisible:shot.hideHabitats!==true,
    planet:shot.planet?{position:[cameraX+planet[0],planet[1],planet[2]]}:null,near:shot.near??.1,far:shot.far??2400,
    angle:phase+exteriorAngle(elapsed,rpm),fade,titleOpacity,done:false,cruising:time>=duration,duration,time,start,end};
}

export function sampleExteriorCinema(seconds,options){return sampleCinemaShot(seconds,options);}

// Dissolves straddle each existing edit point. Both viewpoints advance on the
// same film clock, so pausing, seeking and slow loading never freeze a layer.
export function sampleExteriorCinemaFrame(seconds,options){
  const shot=sampleCinemaShot(seconds,options),half=CINEMA_DISSOLVE_SECONDS/2;
  let boundary,index;
  if(shot.index>0&&shot.time<shot.start+half){boundary=shot.start;index=shot.index-1;}
  else if(shot.index<CINEMA_SHOTS.length-1&&shot.time>=shot.end-half){boundary=shot.end;index=shot.index;}
  else return{shot,from:shot,to:null,mix:0};
  const progress=Math.max(0,Math.min(1,(shot.time-boundary+half)/CINEMA_DISSOLVE_SECONDS));
  return{shot,from:sampleCinemaShot(seconds,options,index),to:sampleCinemaShot(seconds,options,index+1),mix:progress*progress*(3-2*progress)};
}
