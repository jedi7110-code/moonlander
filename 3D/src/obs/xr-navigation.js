import {Quaternion,Vector3} from 'three';

export const XR_MOVE_SPEED=.8; // headset-space metres per second
export const XR_TURN_SPEED=Math.PI/4;
const Y=new Vector3(0,1,0),DEAD_ZONE=.18;
const axis=value=>Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;
const deadZone=value=>Math.abs(value)<=DEAD_ZONE?0:Math.sign(value)*(Math.abs(value)-DEAD_ZONE)/(1-DEAD_ZONE);

// Use handedness, never controller connection order. Quest Touch reserves
// axes 0/1 for a missing touchpad; the stick is always axes 2/3 in xr-standard.
export class XRNavigation {
  constructor(rig){
    this.rig=rig;this.buttons=new Map();
    this.input={turn:0,strafe:0,advance:0,menu:false,wide:false};
    this.pivot=new Vector3();this.offset=new Vector3();this.forward=new Vector3();this.right=new Vector3();this.rotation=new Quaternion();
  }
  reset(){this.buttons.clear();}
  read(sources=[]){
    const input=this.input;Object.assign(input,{turn:0,strafe:0,advance:0,menu:false,wide:false});
    for(const source of this.buttons.keys())if(!Array.prototype.includes.call(sources,source))this.buttons.delete(source);
    for(const source of sources){
      const pad=source.gamepad,hand=source.handedness;
      if(!pad||pad.connected===false||pad.mapping!=='xr-standard'||!['left','right'].includes(hand)){this.buttons.delete(source);continue;}
      const menu=Boolean(pad.buttons[4]?.pressed),wide=Boolean(pad.buttons[5]?.pressed);
      const previous=this.buttons.get(source);
      // Seed a new/reconnected controller without firing buttons already held.
      if(previous){input.menu||=menu&&!previous.menu;input.wide||=wide&&!previous.wide;previous.menu=menu;previous.wide=wide;}
      else this.buttons.set(source,{menu,wide});
      if(hand==='left')input.turn=deadZone(axis(pad.axes[2]));
      else{
        const x=axis(pad.axes[2]),y=axis(pad.axes[3]),length=Math.hypot(x,y);
        const amount=length>DEAD_ZONE?(Math.min(length,1)-DEAD_ZONE)/(1-DEAD_ZONE):0;
        input.strafe=length?x/length*amount:0;input.advance=length?-y/length*amount:0;
      }
    }
    return input;
  }
  move(pose,dt){
    const {rig,input}=this,step=Number.isFinite(dt)?Math.max(0,Math.min(dt,.05)):0;
    if(input.turn){
      // Rotate around the current physical head, not the room's origin.
      this.offset.copy(pose.position).multiplyScalar(rig.scale.x).applyQuaternion(rig.quaternion);
      this.pivot.copy(rig.position).add(this.offset);
      this.rotation.setFromAxisAngle(Y,-input.turn*XR_TURN_SPEED*step);
      rig.quaternion.premultiply(this.rotation);
      rig.position.copy(this.pivot).sub(this.offset.copy(pose.position).multiplyScalar(rig.scale.x).applyQuaternion(rig.quaternion));
    }
    if(input.advance||input.strafe){
      // Heading follows the headset; looking up/down never changes eye height.
      this.forward.set(0,0,-1).applyQuaternion(pose.orientation);this.forward.y=0;
      if(this.forward.lengthSq()<1e-6)this.forward.set(0,0,-1);
      this.forward.normalize().applyQuaternion(rig.quaternion);
      this.right.crossVectors(this.forward,Y);
      const distance=XR_MOVE_SPEED*rig.scale.x*step;
      rig.position.addScaledVector(this.forward,input.advance*distance).addScaledVector(this.right,input.strafe*distance);
    }
    rig.updateMatrixWorld(true);
  }
}
