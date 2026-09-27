import {Euler,MathUtils,Quaternion,Vector3} from 'three';

// Starting rig limits for this study, not measured anatomical specifications.
export const LOOK_PROFILES=Object.freeze({
  milo:{label:'MILO',yaw:75,up:40,down:50,response:11,fov:72},
  cat:{label:'LUCY',yaw:85,up:55,down:60,response:15,fov:78},
  droid:{label:'3817',yaw:100,up:35,down:45,response:8,fov:70},
});
const rad=MathUtils.degToRad;
export class LookInput{
  constructor(id='milo'){this.setProfile(id);}
  setProfile(id){this.profile=LOOK_PROFILES[id];this.reset();}
  reset(){this.yaw=this.pitch=this.targetYaw=this.targetPitch=0;}
  setNormalized(x,y){
    const p=this.profile;this.targetYaw=MathUtils.clamp(x,-1,1)*rad(p.yaw);
    this.targetPitch=MathUtils.clamp(y,-1,1)*rad(y>0?p.up:p.down);
  }
  drag(dx,dy){
    const p=this.profile;this.targetYaw=MathUtils.clamp(this.targetYaw+dx*.004,-rad(p.yaw),rad(p.yaw));
    this.targetPitch=MathUtils.clamp(this.targetPitch-dy*.004,-rad(p.down),rad(p.up));
  }
  update(dt,freedom=1){
    const k=1-Math.exp(-this.profile.response*Math.max(0,Math.min(.1,dt)));
    this.yaw=MathUtils.lerp(this.yaw,this.targetYaw*freedom,k);this.pitch=MathUtils.lerp(this.pitch,this.targetPitch*freedom,k);
  }
}

// Work in the skull's anatomical frame, independent of a GLB bone's local axes.
// Undo this additive pose before the next animation sample (also while paused).
export class HeadLookRig{
  constructor(head,reference,eyeLocal,{neckAnchor=null}={}){
    this.head=head;this.reference=reference;this.eyeLocal=eyeLocal.clone();this.neckAnchor=neckAnchor;
    head.updateWorldMatrix(true,false);
    this.frame=head.getWorldQuaternion(new Quaternion()).invert().multiply(reference.getWorldQuaternion(new Quaternion()));
    this.saved=null;
  }
  restore(){if(!this.saved)return;this.head.position.copy(this.saved.p);this.head.quaternion.copy(this.saved.q);this.saved=null;}
  apply(yaw,pitch){
    this.restore();const head=this.head;this.saved={p:head.position.clone(),q:head.quaternion.clone()};
    const delta=new Quaternion().setFromEuler(new Euler(-pitch,-yaw,0,'YXZ'));
    head.quaternion.multiply(this.frame.clone().multiply(delta).multiply(this.frame.clone().invert()));
    if(this.neckAnchor){
      const pivot=this.neckAnchor.clone().applyQuaternion(this.saved.q).add(this.saved.p);
      head.position.copy(pivot.sub(this.neckAnchor.clone().applyQuaternion(head.quaternion)));
    }
    head.updateWorldMatrix(true,true);
  }
  eyePosition(out=new Vector3()){return this.head.localToWorld(out.copy(this.eyeLocal));}
  orientation(out=new Quaternion()){return this.head.getWorldQuaternion(out).multiply(this.frame);}
}
