import * as THREE from 'three';
import {box,cylinder,rod,label} from './materials.js';

export const BIKE={seat:.95,bodyLift:.10,depth:.30,crankY:.43,crankZ:.32,radius:.155,cadence:4.2,gripY:1.35,gripZ:.55};

export function pedalPosition(time,side){
  const phase=-time*BIKE.cadence+(side<0?Math.PI:0);
  return{x:side*.14,y:BIKE.crankY+Math.sin(phase)*BIKE.radius,z:BIKE.crankZ+Math.cos(phase)*BIKE.radius,phase};
}

// Two linked hinges in the sagittal plane, measured from the downward axis.
export function hingeAngles(y,z,upper,lower,bend=1){
  const distance=THREE.MathUtils.clamp(Math.hypot(y,z),Math.abs(upper-lower)+1e-6,upper+lower-1e-6);
  const bearing=Math.atan2(-z,-y);
  const alpha=Math.acos(THREE.MathUtils.clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1));
  const beta=Math.PI-Math.acos(THREE.MathUtils.clamp((upper*upper+lower*lower-distance*distance)/(2*upper*lower),-1,1));
  return{upper:bearing-bend*alpha,lower:bend*beta};
}

export function applyCyclingPose(root,time){
  const {body,chest,head,arms,legs}=root.userData,lean=.14,pivot=1.08;
  root.rotation.y=Math.PI/2;body.position.set(0,BIKE.bodyLift,0);
  chest.rotation.x=lean;chest.position.set(0,pivot*(1-Math.cos(lean)),-pivot*Math.sin(lean));
  head.position.set(0,pivot+(1.637-pivot)*Math.cos(lean)+.009*Math.sin(lean),(1.637-pivot)*Math.sin(lean)-.009*Math.cos(lean));
  head.rotation.set(-.04,0,0);
  for(const {leg,knee,boot,side}of legs){
    const pedal=pedalPosition(time,side);leg.position.x=pedal.x;
    const targetY=pedal.y+.1245-BIKE.bodyLift-leg.position.y,targetZ=pedal.z-.024;
    const angles=hingeAngles(targetY,targetZ,.435,Math.hypot(.425,.013));
    leg.rotation.set(angles.upper,0,0);knee.rotation.x=angles.lower+Math.atan2(.013,.425);
    boot.rotation.x=-(leg.rotation.x+knee.rotation.x);
  }
  for(const {arm,elbow,hand}of arms){
    arm.position.y=pivot+(1.488-pivot)*Math.cos(lean);arm.position.z=(1.488-pivot)*Math.sin(lean);
    const targetY=BIKE.gripY-.007-BIKE.bodyLift-arm.position.y,targetZ=BIKE.gripZ-.045-arm.position.z;
    const angles=hingeAngles(targetY,targetZ,.310,.274,-1);
    arm.rotation.set(angles.upper,0,0);elbow.rotation.x=angles.lower;hand.rotation.x=-Math.PI/2-angles.upper-angles.lower;
  }
}

export function createGym(m,x){
  const root=new THREE.Group();root.name='Ship gym';root.position.set(x,0,BIKE.depth);root.rotation.y=Math.PI/2;
  box(root,m.rubber,0,.019,.28,1.12,.035,1.86,.02);
  for(const z of [-.26,.91]){
    rod(root,m.metal,[-.42,.095,z],[.42,.095,z],.04);
    for(const side of [-1,1])box(root,m.black,side*.40,.05,z,.13,.085,.16,.018);
  }
  rod(root,m.enamel,[0,.13,-.25],[0,.13,.91],.067);
  rod(root,m.enamel,[0,.14,-.24],[0,.79,-.03],.062);
  rod(root,m.enamel,[0,.16,.74],[0,.68,.02],.054);
  rod(root,m.metal,[0,.57,-.065],[0,BIKE.seat-.04,-.025],.032);
  box(root,m.black,0,BIKE.seat-.047,-.025,.32,.095,.30,.04);
  const housing=cylinder(root,m.dark,0,.38,.66,.30,.18,.30,48);housing.rotation.z=Math.PI/2;
  for(const side of [-1,1]){
    const cover=cylinder(root,m.metal,side*.10,.38,.66,.275,.025,.275,40);cover.rotation.z=Math.PI/2;
    const disc=cylinder(root,m.black,side*.115,.38,.66,.24,.012,.24,40);disc.rotation.z=Math.PI/2;
  }
  const flywheel=new THREE.Group();flywheel.position.set(-.128,.38,.66);root.add(flywheel);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;rod(flywheel,m.metal,[0,0,0],[0,Math.cos(a)*.23,Math.sin(a)*.23],.013);}
  for(const side of [-1,1]){
    rod(root,m.enamel,[side*.22,.18,.76],[side*.22,1.19,.71],.031);
    rod(root,m.metal,[side*.22,1.19,.71],[side*.22,BIKE.gripY,BIKE.gripZ],.028);
  }
  rod(root,m.rubber,[-.29,BIKE.gripY,BIKE.gripZ],[.29,BIKE.gripY,BIKE.gripZ],.029);
  rod(root,m.metal,[-.22,1.19,.71],[.22,1.19,.71],.023);
  rod(root,m.dark,[0,1.19,.71],[0,1.44,.71],.022);
  box(root,m.dark,0,1.44,.71,.25,.16,.055,.018);
  label(root,'ERG / 01',0,1.448,.745,.22,.065,{fg:'#b9dbc7',size:45});
  const cranks=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(0,BIKE.crankY,BIKE.crankZ);root.add(arm);
    rod(arm,m.metal,[side*.10,0,0],[side*.14,0,BIKE.radius],.017);
    const pedal=new THREE.Group();pedal.position.set(side*.14,0,BIKE.radius);arm.add(pedal);
    box(pedal,m.black,0,0,0,.16,.035,.19,.009);
    for(const x of [-.055,.055])rod(pedal,m.metal,[x,.025,-.08],[x,.025,.08],.006);
    cranks.push({arm,pedal,side});
  }
  const gym={root,cranks,flywheel};animateGym(gym,0);return gym;
}

export function animateGym(gym,time){
  for(const {arm,pedal,side}of gym.cranks){const {phase}=pedalPosition(time,side);arm.rotation.x=-phase;pedal.rotation.x=phase;}
  gym.flywheel.rotation.x=-pedalPosition(time,1).phase*3;
}
