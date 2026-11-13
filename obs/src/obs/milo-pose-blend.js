import {updateMiloSpine} from './milo-spine.js';
import {updateMiloNeck} from './milo-neck.js';

// A safety net for hand-overs between two authored motions. Where one motion
// ends in another pose than the next one starts in, the figure would change
// pose within one frame. Any such jump (a joint turning faster than a person's
// could, or the pelvis moving faster within the figure) is taken up over a
// short moment instead: the figure goes on from the pose it was shown in.
// Motions that hand over properly (the planned walk, the turns, the stair
// trips) never reach these limits and pass through untouched.
export const MILO_POSE_BLEND=Object.freeze({
  // s to take a jump up in: longer for a larger one (sitting down at the console is not done in a quarter second)
  seconds:.28,perMetre:.6,perRadian:.14,longest:.75,
  // rad/s by part (walking and climbing stay below these)
  turn:{trunk:11,arm:27,leg:25},
  // m/s of a joint's own position (the pelvis within the figure)
  shift:1.6,
  // the figure's own frame: moved or turned faster than this (m/s, rad/s), it has been put somewhere else
  frame:{shift:3.5,turn:14},
});
const ease=t=>t*t*t*(10+t*(-15+6*t));

export class MiloPoseBlend{
  constructor(root){
    const {body,chest,head,arms,legs}=root.userData,T=MILO_POSE_BLEND.turn;
    this.root=root;
    this.joints=[[body,T.trunk],[chest,T.trunk],[head,T.trunk],...arms.flatMap(a=>[[a.arm,T.arm],[a.elbow,T.arm],[a.hand,T.arm]]),...legs.flatMap(l=>[[l.leg,T.leg],[l.knee,T.leg],[l.boot,T.leg]])];
    this.raw=null;this.shown=null;this.from=null;this.age=0;
  }
  snapshot(){return this.joints.map(([joint])=>({q:joint.quaternion.clone(),p:joint.position.clone()}));}
  reset(){this.raw=this.shown=this.from=null;}
  // Take up whatever the next frame's pose differs by from the one shown now (for a hand-over
  // known not to be exact: a short walk running on into a stair trip).
  begin(){this.pending=true;}
  // Call once the frame's pose is complete. Returns true while a jump is being taken up.
  // detect: look for jumps (false where the motion itself is quick and exact: the ladder, the
  // stair flights; a blend asked for with begin() is still carried out)
  apply(dt,{detect=true}={}){
    if(!(dt>0)){return Boolean(this.from);}
    const raw=this.snapshot(),step=Math.min(dt,.05),place=this.root.position.clone(),facing=this.root.quaternion.clone();
    // Where the figure's frame itself is put somewhere else (onto the exercise bike and off it:
    // the frame changes and the pelvis' offset with it, the body staying where it is), the
    // poses kept from before are carried over into the new frame. A frame that also turns
    // at once is a new start: there is nothing to take up.
    const old=this.place,turned=this.facing&&facing.angleTo(this.facing)>MILO_POSE_BLEND.frame.turn*step;
    this.place=place;this.facing=facing;
    if(turned){this.raw=raw;this.shown=raw;this.from=null;this.pending=false;return false;}
    if(old&&place.distanceTo(old)>MILO_POSE_BLEND.frame.shift*step){
      const shift=old.clone().sub(place).applyQuaternion(facing.clone().invert());
      // (joint 0 is the pelvis; the kept poses may be one and the same)
      for(const pose of new Set([this.raw,this.shown,this.from]))if(pose)pose[0].p.add(shift);
    }
    if(this.raw){
      const jumped=this.joints.some(([,limit],i)=>raw[i].q.angleTo(this.raw[i].q)>limit*step||raw[i].p.distanceTo(this.raw[i].p)>MILO_POSE_BLEND.shift*step);
      if((jumped&&detect)||this.pending){
        this.from=this.shown;this.age=0;
        const B=MILO_POSE_BLEND,shift=Math.max(...raw.map((joint,i)=>joint.p.distanceTo(this.shown[i].p))),turn=Math.max(...raw.map((joint,i)=>joint.q.angleTo(this.shown[i].q)));
        this.seconds=Math.min(B.longest,B.seconds+B.perMetre*shift+B.perRadian*turn);
      }
    }
    this.pending=false;
    this.raw=raw;
    if(this.from){
      this.age+=dt;
      const w=ease(Math.min(1,this.age/this.seconds));
      if(w>=1)this.from=null;
      else{
        this.joints.forEach(([joint],i)=>{joint.quaternion.copy(this.from[i].q.clone().slerp(raw[i].q,w));joint.position.lerpVectors(this.from[i].p,raw[i].p,w);});
        this.root.userData.updateWristTwists?.();updateMiloSpine(this.root);updateMiloNeck(this.root);
      }
    }
    this.shown=this.from?this.snapshot():raw;
    return Boolean(this.from);
  }
}
