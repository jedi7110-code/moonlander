import {placeCatPaw,CAT_WALK} from './cat-walk.js';

export function applyCatHop(root,hop){
  if(!hop)return;
  const {body,legs,neck,head}=root.userData,t=hop.age/hop.duration;
  const flight=hop.phase==='flight';
  const crouch=hop.phase==='prepare'?Math.sin(Math.PI*t):hop.phase==='land'?Math.sin(Math.PI*t):0;
  const tuck=flight?Math.sin(Math.PI*t):0;
  body.position.y=-.075*crouch;
  body.rotation.x=flight?-.12*Math.sin(2*Math.PI*t):0;
  body.scale.set(1,1,1);neck.rotation.x=flight?-.08:0;head.rotation.y=0;
  for(const leg of legs){
    // Lift and fold the paws in flight; keep them planted while absorbing the landing.
    const y=CAT_WALK.pawHeight+.10*tuck-body.position.y;
    const z=(leg.rear?-.215:.205)+(leg.rear?.075:-.025)*tuck;
    placeCatPaw(leg,leg.side*.101,y,z);
  }
}
