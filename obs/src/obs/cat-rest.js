import {MathUtils} from 'three';
import {placeCatPaw} from './cat-walk.js';

export const CAT_RISE_TIME=1.2;
const smooth=value=>{const t=MathUtils.clamp(value,0,1);return t*t*(3-2*t);};
export const restWeight=(age,remaining,enter=1.8)=>smooth(age/enter)*smooth(remaining/CAT_RISE_TIME);

export function catLookDirection(time){
  const t=((time%9)+9)%9;
  const keys=[[0,0],[1.6,0],[2.4,.65],[4.0,.65],[5.1,-.60],[6.9,-.60],[7.8,0],[9,0]];
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
    const [a,p]=keys[i-1],[b,q]=keys[i];return MathUtils.lerp(p,q,smooth((t-a)/(b-a)));
  }
  return 0;
}

export function applyCatSitting(root,weight,time){
  if(!weight)return;
  const {body,neck,head,legs,ears}=root.userData;
  body.rotation.x=-.50*weight;body.position.y=-.06*weight;
  neck.rotation.x=.28*weight;head.rotation.y=catLookDirection(time)*weight;
  head.rotation.x=.04*Math.sin(time*.7)*weight;
  ears.forEach((ear,i)=>{ear.rotation.z=(i?1:-1)*Math.abs(head.rotation.y)*.08;});
  const c=Math.cos(body.rotation.x),s=Math.sin(body.rotation.x);
  for(const leg of legs){
    const z=leg.rear?MathUtils.lerp(-.215,-.12,weight):MathUtils.lerp(.205,.10,weight),y=.036-body.position.y;
    placeCatPaw(leg,leg.side*.101,y*c+z*s,-y*s+z*c);
  }
}
