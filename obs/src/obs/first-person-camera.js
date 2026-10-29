import {Euler,Quaternion,Vector3} from 'three';

const up=new Vector3(0,1,0),cameraForward=new Quaternion().setFromAxisAngle(up,Math.PI);

// Walking animation belongs to the visible skeleton, not the viewer's horizon.
export class StableFirstPersonCamera{
  constructor(root,neutralEye,{forwardOffset=.04}={}){
    this.root=root;this.neutralEye=root.worldToLocal(neutralEye.clone());this.forwardOffset=forwardOffset;this.reset();
  }
  reset(){this.position=null;this.heading=null;}
  update(camera,{eye,yaw,pitch,dt,standing=true,climbing=false,recline=0,attachedOrientation=null}){
    const forward=new Vector3(0,0,1).applyQuaternion(this.root.getWorldQuaternion(new Quaternion()));
    const heading=new Quaternion().setFromAxisAngle(up,Math.atan2(forward.x,forward.z));
    if(attachedOrientation){
      // Boarding and waking use the very same animated head as the outside view.
      // Do not replace its turn/recline with a separate camera animation.
      const clearance=this.forwardOffset*(1-recline)+.035*recline;
      camera.position.copy(eye).add(new Vector3(0,0,clearance).applyQuaternion(attachedOrientation));
      camera.quaternion.copy(attachedOrientation).multiply(cameraForward);
      this.position=camera.position.clone();this.heading=heading.clone();
      return;
    }
    // On a ladder the torso leans back from the rungs. Keep the actual eyes on
    // that side too, instead of projecting the standing eye anchor through them.
    const target=standing&&!climbing?this.root.localToWorld(this.neutralEye.clone()):eye.clone();
    target.add(new Vector3(0,0,climbing?0:this.forwardOffset).applyQuaternion(heading));
    const seconds=Math.max(0,Math.min(.1,dt));
    if(!this.position||this.position.distanceTo(target)>4){this.position=target.clone();this.heading=heading.clone();}
    else{
      // Lagging horizontal travel puts the eyes back inside the walking torso.
      // Ease changes of height only; the forward clearance follows every turn.
      this.position.x=target.x;this.position.z=target.z;
      this.position.y+=(target.y-this.position.y)*(1-Math.exp(-12*seconds));
      this.heading.slerp(heading,1-Math.exp(-9*seconds));
    }
    camera.position.copy(this.position);
    camera.quaternion.copy(this.heading)
      .multiply(new Quaternion().setFromEuler(new Euler(-pitch,-yaw,0,'YXZ')))
      .multiply(cameraForward);
  }
}

// Suppress only this camera's fragments. The head stays in the scene for other
// views, mirror passes and shadows. No visibility state survives a resize/switch.
export function maskSelfView(mesh,camera,active){
  const before=mesh.onBeforeRender,after=mesh.onAfterRender,states=[];
  mesh.onBeforeRender=function(renderer,scene,renderCamera,geometry,material,group){
    before.call(this,renderer,scene,renderCamera,geometry,material,group);
    const state=renderCamera===camera&&active()?{material,colorWrite:material.colorWrite,depthWrite:material.depthWrite,stencilWrite:material.stencilWrite}:null;
    states.push(state);
    if(state){material.colorWrite=false;material.depthWrite=false;material.stencilWrite=false;}
  };
  mesh.onAfterRender=function(...args){
    const state=states.pop();if(state){const{material,...values}=state;Object.assign(material,values);}
    after.apply(this,args);
  };
  return()=>{mesh.onBeforeRender=before;mesh.onAfterRender=after;};
}
