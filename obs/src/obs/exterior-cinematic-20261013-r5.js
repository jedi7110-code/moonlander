// Saved camera take before trimming the first two seconds of scene 05 motion.
// Keep this revision immutable; current playback lives in exterior-cinematic.js.
import {EXTERIOR,exteriorAngle} from './exterior-mothership.js';
import {EXTERIOR_CRUISE_SPEED} from './exterior-cruise.js';
import {sampleExteriorLogo} from './exterior-logo.js';
import {sampleExteriorProbeFlight} from './exterior-probe-flight.js';
import {sampleExteriorCinema as sampleSavedCinema,sampleExteriorCinemaFrame as sampleSavedFrame,
  exteriorCinemaShots as savedShots} from './exterior-cinematic-20261013-r1.js';
import {sampleExteriorCinema as samplePreviousCinema,sampleExteriorCinemaFrame as samplePreviousFrame,
  exteriorCinemaShots as previousShots} from './exterior-cinematic-20261013-r2.js';

import {sampleExteriorCinema as sampleLowCinema,sampleExteriorCinemaFrame as sampleLowFrame,
  exteriorCinemaShots as lowShots} from './exterior-cinematic-20261013-r3.js';

import {sampleExteriorCinema as sampleFastCinema,sampleExteriorCinemaFrame as sampleFastFrame,
  exteriorCinemaShots as fastShots} from './exterior-cinematic-20261013-r4.js';

// Distinguish an observer in space from a camera bolted to the hull. The
// second observer slides sideways; the other fixed shots stay in place. The opening approach
// tilts at a fixed position; flight stays at 2 m/s apart from the two flyovers
// and extreme-wide planet transit.
export const CINEMA_SHOTS=Object.freeze([
  // The 1.5s dissolve starts at 36s, centred on the 36.75s edit point.
  // Trim the hold while retaining the original 38s tilt motion.
  {id:'overhead',number:1,name:'ティルト / 斜め上から・奥から手前へ接近',mode:'tilt',duration:36.75,sourceDuration:38,speed:10.12*.97,flightOrigin:5.9,anchor:0,probeStage:'away',
    eye:[[315,115,35]],target:[[0,0,0]],tilt:[44.1,60],tiltOffset:-1,tiltOffsetStart:11.4,tiltOffsetDuration:8,fov:42,near:5},
  {id:'planet',number:2,name:'横移動カメラ / 惑星を横切る遥かな船',mode:'lateral',duration:12,speed:48,probeStage:'away',cameraSlide:[-120,120],cameraOffset:260,
    eye:[[0,350,3900]],target:[[0,100,0]],fov:42,wide:true,planet:true,near:5,far:60000},
  {id:'distant',number:3,name:'固定カメラ / 下から接近する探査機',mode:'fixed',duration:8,probeStage:'approach',
    eye:[[235,72,255]],target:[[0,8,0]],fov:38,wide:true},
  // Start 4.5 seconds into the original capture; hold for 2.5 seconds after contact.
  {id:'lander',number:7,name:'右下から / 探査機のドッキング',mode:'follow',duration:10.75,sourceOffset:4.5,sourceDuration:14.75,captureDuration:12,probeStage:'dock',
    eye:[[16,-10,24]],target:[[0,1,0]],fov:40,zoomTo:32,lander:true,fitAspect:true,hideHabitats:true},
  {id:'crossing',number:4,name:'超望遠 / 大きな惑星を背景に横切る船',mode:'fixed',duration:10,
    eye:[[0,7,2100]],target:[[0,0,0]],fov:3.5,wide:true,planet:[1600,-200,-78000],near:10,far:150000},
  {id:'mounted',number:5,name:'船体固定カメラ / 回転する重力区画',mode:'mounted',duration:8,
    eye:[[12.8,3.85,1.8]],target:[[-1.6,6,0]],fov:58,core:true},
  {id:'flyby',number:9,name:'固定カメラ / 背後から通過・彼方へ航行',mode:'fixed',duration:60,speed:6,anchor:0,
    optics:{strength:.34,streakRatio:2.4,haloRatio:.14},
    eye:[[18,-31,20.5]],target:[[338,-1,0]],fov:56,near:.25,far:1e8},
]);
export const OPENING_DURATION=CINEMA_SHOTS.reduce((sum,shot)=>sum+shot.duration,0);
export const EXTERIOR_VIEW_DURATION=OPENING_DURATION*4/3;
export const CINEMA_DISSOLVE_SECONDS=1.5;
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const sample=(points,u)=>points.length===1?[...points[0]]:lerp(points[0],points[1],u);
// Optional study of scene 05. Keep the approved film's timing and flight path;
// this changes only the penultimate observer when the preview selects it.
const bowView=Object.freeze({name:'船首斜め下 / 母艦とドッキング済み探査機',mode:'fixed',
  eye:[[60,-18,50]],target:[[2,-1,0]],fov:44,core:true,fitAspect:true});
// Alternatives for scene 05 only. Track the cruising hull while translating
// through a short, continuous camera path; geometry and edit times are shared.
const penultimateViews=Object.freeze({
  bow:bowView,
  'bow-slide':{name:'船首越し / 奥行きを見せる横移動',mode:'follow',core:true,fitAspect:true,cameraEase:true,
    eye:[[22,-4,10],[22,-4,15]],target:[[-1.6,-3,0]],fov:52},
  underside:{name:'船底すれすれ / 宇宙へ抜ける移動',mode:'follow',core:true,fitAspect:true,cameraEase:true,
    eye:[[8,-18,4],[-4,-20,9]],target:[[3,-1,0]],fov:58},
  'probe-wide':{name:'探査機越し / 母艦のスケール',mode:'follow',core:false,fitAspect:true,cameraEase:true,
    eye:[[39,-22,13],[35,-21,17]],target:[[4,4,-3]],fov:62},
});
// Alternate ending: the B camera slides in space while aiming at the cruising
// ship. Never carry the observer with the hull: that would halt relative motion
// when the eight-second slide eases out, before the ship starts receding again.
const undersideEndingShots=Object.freeze([...CINEMA_SHOTS.slice(0,-2),{
  ...CINEMA_SHOTS.at(-2),...penultimateViews.underside,id:'underside-ending',mode:'tracking',
  name:'船底から船体の高さへ / 後方からエンドレス航行を見送る',duration:68,speed:EXTERIOR_CRUISE_SPEED*1.05,cameraDuration:8,compensateCameraEnd:true,flightScale:.95,settleDuration:16,settleEye:[-4,0,14],settleTarget:[3,0,0],near:1,far:1e8,
  optics:{strength:.34,streakRatio:2.4,haloRatio:.14},
}]);
export const exteriorCinemaShots=(options={})=>options.revision==='20261013-r1'?savedShots(options):
  options.revision==='20261013-r2'?previousShots(options):
  options.revision==='20261013-r3'?lowShots(options):
  options.revision==='20261013-r4'?fastShots(options):
  options.ending==='underside'?undersideEndingShots:CINEMA_SHOTS;

// Pure time sampling: playback and seeking agree without accumulated camera
// state. Unequal holds replace the identical start/stop tweens.
function sampleCinemaShot(seconds,{opening=false,aspect=16/9,coreScale=2.6,phase=55*Math.PI/180,rpm=EXTERIOR.rpm,penultimate=null,approach=null,ending=null,docking:dockingView=null}={},forcedIndex=null){
  const shots=exteriorCinemaShots({ending});
  const duration=opening?OPENING_DURATION:EXTERIOR_VIEW_DURATION;
  const elapsed=Math.max(0,Number.isFinite(seconds)?seconds:0);
  const time=elapsed;
  const timingScale=duration/OPENING_DURATION;
  let index=0,start=0,distance=0;
  while(index<shots.length-1&&(forcedIndex===null?time>=start+shots[index].duration*timingScale:index<forcedIndex)){
    const previous=shots[index],hold=previous.duration*timingScale;
    distance+=(hold-(previous.flightOrigin??0))*(previous.speed??EXTERIOR_CRUISE_SPEED);start+=hold;index++;
  }
  const definition=shots[index];
  const alternative=Object.hasOwn(penultimateViews,penultimate)?penultimateViews[penultimate]:null;
  const shot=definition.id==='mounted'&&alternative?{...definition,...alternative}:
    definition.id==='distant'&&approach==='bow'?{...definition,...bowView,fov:definition.fov,wide:false,
      name:'船首斜め下 / 探査機の接近・03の画角'}:
    definition.id==='lander'&&dockingView==='left'?{...definition,eye:[[-16,-10,24]],
      name:'左下から / 探査機のドッキング'}:definition;
  const shotDuration=shot.duration*timingScale,end=start+shotDuration,sourceOffset=(shot.sourceOffset??0)*timingScale;
  const sourceDuration=shot.sourceDuration===undefined?shotDuration+sourceOffset:shot.sourceDuration*timingScale;
  const u=Math.max(0,Math.min(1,(time-start+sourceOffset)/sourceDuration));
  const fov=shot.zoomTo===undefined?shot.fov:shot.fov+(shot.zoomTo-shot.fov)*u;
  const cameraU=shot.cameraDuration===undefined?u:Math.max(0,Math.min(1,(time-start)/(shot.cameraDuration*timingScale)));
  const cameraProgress=shot.cameraEase?cameraU*cameraU*(3-2*cameraU):cameraU;
  let eye=sample(shot.eye,cameraProgress),target=sample(shot.target,cameraProgress);
  if(shot.settleEye){
    // After the broad slide, rise smoothly to hull height. Keep world X fixed
    // so the accelerated ship continues passing the observer without slowing.
    const riseU=Math.max(0,Math.min(1,(time-start-shot.cameraDuration*timingScale)/(shot.settleDuration*timingScale)));
    const rise=riseU*riseU*(3-2*riseU);
    eye=lerp(eye,shot.settleEye,rise);target=lerp(target,shot.settleTarget,rise);
  }
  if(shot.tilt){
    // A vertical tilt changes pitch only: position, horizontal bearing and
    // focal length stay fixed while the real ship grows as it approaches.
    // Ease into the tilt over empty space, then hold one speed through the
    // logo and hull arrival. Accelerate later to finish at the chosen pitch.
    const elapsed=Math.max(0,Math.min(sourceDuration,time-start));
    const reveal=shot.flightOrigin??0,rate=.3,ease=1.2,steadyUntil=15*timingScale;
    const advance=t=>t<ease?rate*ease*((t/ease)**3-(t/ease)**4/2):rate*(t-ease/2);
    const initialPitch=shot.tilt[0]-advance(reveal),steadyPitch=initialPitch+advance(steadyUntil);
    const after=Math.max(0,elapsed-steadyUntil),remaining=sourceDuration-steadyUntil;
    const acceleration=(shot.tilt[1]-steadyPitch-rate*remaining)/(remaining*remaining);
    const pitchDegrees=elapsed<=steadyUntil?initialPitch+advance(elapsed):steadyPitch+rate*after+acceleration*after*after;
    // Settle the new upward framing after the original logo/ship reveal.
    // A gradual offset avoids an angle jump or an earlier hull appearance.
    const offsetU=shot.tiltOffsetDuration?Math.max(0,Math.min(1,(elapsed-shot.tiltOffsetStart*timingScale)/(shot.tiltOffsetDuration*timingScale))):1;
    const offset=(shot.tiltOffset??0)*offsetU*offsetU*(3-2*offsetU);
    const pitch=(pitchDegrees+offset)*Math.PI/180;
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
  let shipSpeed=shot.speed??EXTERIOR_CRUISE_SPEED;
  // Incoming shots already move during the overlap before their nominal start.
  // The first ship is already approaching outside the frame during the logo.
  // Negative flight time places it farther away instead of hiding a stopped hull.
  const flightTime=time-start-(shot.flightOrigin??0);
  let flightDistance=flightTime*shipSpeed;
  if(shot.compensateCameraEnd){
    // In the second half of the smoothstep slide, camera speed falls from its
    // peak to zero. Add exactly that lost speed to the hull's forward motion.
    // Integrate the ramp analytically: seeking and playback share one path,
    // and neither position nor velocity jumps when the camera settles.
    const moveSeconds=shot.cameraDuration*timingScale,rampSeconds=moveSeconds/2;
    const fit=shot.fitAspect?Math.max(1,1/Math.max(.25,aspect)):1;
    const cameraTravel=(shot.eye[0][0]-shot.eye[1][0])*(shot.core?coreScale:1)*fit;
    const gain=Math.max(0,cameraTravel)*1.5/moveSeconds;
    const rampElapsed=Math.max(0,flightTime-rampSeconds),progress=Math.min(1,rampElapsed/rampSeconds);
    shipSpeed+=gain*progress*progress;
    flightDistance+=gain*(rampSeconds*progress**3/3+Math.max(0,rampElapsed-rampSeconds));
  }
  // Scale flight and its acceleration together without changing the camera path.
  shipSpeed*=shot.flightScale??1;flightDistance*=shot.flightScale??1;
  const shipX=distance+flightDistance;
  // Anchor the observer at the shot midpoint. Scene 02 then slides the
  // camera and its target together, keeping its bearing fixed as the ship passes.
  const cameraX=['fixed','tilt','lateral'].includes(shot.mode)?distance+(shot.anchor??shotDuration/2*shipSpeed)+(shot.cameraOffset??0):shipX;
  const slide=shot.cameraSlide?shot.cameraSlide[0]+(shot.cameraSlide[1]-shot.cameraSlide[0])*u*u*(3-2*u):0;
  const observerX=shot.mode==='tracking'?distance:cameraX;
  eye[0]+=observerX+slide;target[0]+=cameraX+slide;
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
    sampleExteriorProbeFlight(time-approachStart+advance,{approachDuration,captureDuration,coreScale,
      controlTime:time-approachStart,controlAdvance:(docking.sourceOffset??0)*timingScale}):
    {visible:shot.probeStage!=='away',position:[0,0,0],rotation:[0,0,0],latched:shot.probeStage!=='away'};
  const planet=Array.isArray(shot.planet)?shot.planet:[2200,900,-11000];
  return{index,number:shot.number,id:shot.id,name:shot.name,mode:shot.mode,eye,target,up:shot.up??[0,1,0],fov,shipX,shipSpeed,probe,optics:shot.optics,
    logoReveal:logo.reveal,logoClip:logo.clipPath,
    shipVisible:true,
    habitatsVisible:shot.hideHabitats!==true,
    planet:shot.planet?{position:[cameraX+planet[0],planet[1],planet[2]]}:null,near:shot.near??.1,far:shot.far??2400,
    angle:phase+exteriorAngle(elapsed,rpm),fade,titleOpacity,done:false,cruising:time>=duration,duration,time,start,end};
}

export function sampleExteriorCinema(seconds,options){return options?.revision==='20261013-r1'?
  sampleSavedCinema(seconds,options):options?.revision==='20261013-r2'?
  samplePreviousCinema(seconds,options):options?.revision==='20261013-r3'?
  sampleLowCinema(seconds,options):options?.revision==='20261013-r4'?
  sampleFastCinema(seconds,options):sampleCinemaShot(seconds,options);}

// Dissolves straddle each existing edit point. Both viewpoints advance on the
// same film clock, so pausing, seeking and slow loading never freeze a layer.
export function sampleExteriorCinemaFrame(seconds,options){
  if(options?.revision==='20261013-r1')return sampleSavedFrame(seconds,options);
  if(options?.revision==='20261013-r2')return samplePreviousFrame(seconds,options);
  if(options?.revision==='20261013-r3')return sampleLowFrame(seconds,options);
  if(options?.revision==='20261013-r4')return sampleFastFrame(seconds,options);
  const shot=sampleCinemaShot(seconds,options),half=CINEMA_DISSOLVE_SECONDS/2;
  let boundary,index;
  if(shot.index>0&&shot.time<shot.start+half){boundary=shot.start;index=shot.index-1;}
  else if(shot.index<exteriorCinemaShots(options).length-1&&shot.time>=shot.end-half){boundary=shot.end;index=shot.index;}
  else return{shot,from:shot,to:null,mix:0};
  const progress=Math.max(0,Math.min(1,(shot.time-boundary+half)/CINEMA_DISSOLVE_SECONDS));
  return{shot,from:sampleCinemaShot(seconds,options,index),to:sampleCinemaShot(seconds,options,index+1),mix:progress*progress*(3-2*progress)};
}
