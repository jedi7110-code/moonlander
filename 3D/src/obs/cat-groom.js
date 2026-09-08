import {MathUtils} from 'three';
import {hingeAngles} from './gym.js';

const smooth=value=>{const t=MathUtils.clamp(value,0,1);return t*t*(3-2*t);};
const envelope=(time,start,end)=>smooth((time-start)/.35)*smooth((end-time)/.35);

export function groomingSequence(time){
  const t=((time%9.6)+9.6)%9.6;
  return{lick:envelope(t,.6,2.9),wipe:envelope(t,2.9,5.2),flank:envelope(t,5.7,9.0),
    stroke:.5-.5*Math.cos((t-3.1)*Math.PI*2/1.05),lap:Math.max(0,Math.sin(t*Math.PI*2/.46))};
}

function setPaw(leg,x,y,z,weight){
  const {hip,knee,rear}=leg,dx=x-hip.position.x,dz=z-hip.position.z;
  const yaw=Math.abs(dx)>.0001?Math.atan2(dx,dz):0;
  const forward=yaw?Math.hypot(dx,dz):dz;
  const upperOffset=rear?Math.atan2(.025,.14):0,lowerOffset=Math.atan2(.025,.151);
  const angles=hingeAngles(y-hip.position.y,forward,Math.hypot(.14,rear?.025:0),Math.hypot(.151,.025),rear?1:-1);
  hip.rotation.set(MathUtils.lerp(hip.rotation.x,angles.upper-upperOffset,weight),yaw*weight,0,'YXZ');
  knee.rotation.x=MathUtils.lerp(knee.rotation.x,angles.lower+upperOffset+lowerOffset,weight);
}

export function applyCatGrooming(root,{time,actionTime=time,remaining=Infinity,active,facing,passage}){
  const {body,neck,head,legs,eyes,tongue,groom}=root.userData;
  const dt=groom.lastTime===null?0:MathUtils.clamp(time-groom.lastTime,0,.1);groom.lastTime=time;
  const target=active?smooth(actionTime/.55)*smooth(remaining/.6):0;
  if(active){groom.time=actionTime;if(groom.weight<.01)groom.side=-facing;}
  groom.weight=passage?0:MathUtils.lerp(groom.weight,target,1-Math.exp(-dt*12));
  if(groom.weight<.001)groom.weight=0;
  tongue.visible=false;
  const weight=groom.weight;if(!weight)return 0;
  const pose=groomingSequence(groom.time),side=groom.side;
  body.rotation.x=MathUtils.lerp(body.rotation.x,-.18,weight);
  body.position.y=MathUtils.lerp(body.position.y,-.035,weight);
  body.scale.y=MathUtils.lerp(body.scale.y,1,weight);body.scale.z=MathUtils.lerp(body.scale.z,1,weight);
  const turn=side*(pose.lick*.25+pose.wipe*.20+pose.flank*2.10);
  const dip=pose.lick*(.52+pose.lap*.10)+pose.wipe*.24+pose.flank*(.85+pose.lap*.09);
  neck.rotation.set(MathUtils.lerp(neck.rotation.x,dip,weight),turn*weight,0,'YXZ');
  neck.position.y=MathUtils.lerp(neck.position.y,.414-pose.flank*.035,weight);
  head.rotation.y*=1-weight;
  for(const eye of eyes)eye.scale.y=MathUtils.lerp(eye.scale.y,.62,weight);
  const c=Math.cos(body.rotation.x),s=Math.sin(body.rotation.x);
  for(const leg of legs){
    // Keep supporting paws on the deck while the body settles and one forepaw lifts.
    const deckZ=leg.rear?-.25:.225,deckY=.039-body.position.y;
    let x=leg.side*.101,y=(deckY*c+deckZ*s)/body.scale.y,z=(-deckY*s+deckZ*c)/body.scale.z;
    const raised=!leg.rear&&leg.side===side?Math.max(pose.lick,pose.wipe):0;
    if(raised){
      x=MathUtils.lerp(x,side*(.12+pose.wipe*.045),raised);
      y=MathUtils.lerp(y,.305+pose.wipe*pose.stroke*.20,raised);
      z=MathUtils.lerp(z,.397-pose.wipe*pose.stroke*.115,raised);
    }
    setPaw(leg,x,y,z,weight);
    leg.foot.rotation.x=-(body.rotation.x+leg.hip.rotation.x+leg.knee.rotation.x)*weight*(1-raised);
  }
  tongue.visible=active&&weight>.85&&Math.max(pose.lick,pose.flank)>.65&&pose.lap>.35;
  tongue.scale.z=.014+pose.lap*.014;
  return weight;
}
