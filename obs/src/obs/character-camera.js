import {Vector3,Quaternion,MathUtils} from 'three';
import {HeadLookRig,LookInput,LOOK_PROFILES} from './first-person-look.js';
import {StableFirstPersonCamera,maskSelfView} from './first-person-camera.js';
import {sleepView,catSleepView} from './first-person-sleep.js';
import {medicalView} from './first-person-medical.js';
import {createViewingWall,cabinWallMaterials} from './viewing-wall.js';
import {pupilShells} from '../../studies/lucy/pupil-study.js';
import {updateMiloNeck} from './milo-neck.js';
import {HABITAT_VIEW} from './ship.js';

export const FOLLOW_ANGLES=['front','left','right'];
// The lounge study's oblique camera, mirrored for its other side.
export const FOLLOW_OBLIQUE={x:2.7,y:1.65,z:5.5,fov:35};
const cameraForward=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI);
const inactiveRest=()=>({locked:false,recline:0,closure:0});

export function createCharacterLookRigs(view){
  const {milo,cat:lucy}=view,head=milo.userData.head,eyes=[];
  head.traverse(mesh=>{if(mesh.name==='Fitted Milo eye surface')eyes.push(mesh);});
  const miloEye=new Vector3();
  for(const mesh of eyes)miloEye.add(head.worldToLocal(mesh.localToWorld(new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,0))));
  if(eyes.length)miloEye.divideScalar(eyes.length);else miloEye.set(-.11,1.69,2.55);
  const skull=lucy.getObjectByName('Bone004');let pupils;
  lucy.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.material?.name==='Pupils and eye margin')pupils=mesh;});
  pupils.updateWorldMatrix(true,false);pupils.skeleton.update();
  const lucyEye=new Vector3(),point=new Vector3(),shells=pupilShells(pupils.geometry);
  for(const shell of shells){
    const centre=new Vector3();for(const i of shell.indices)centre.add(pupils.getVertexPosition(i,point));
    lucyEye.add(centre.divideScalar(shell.indices.length).applyMatrix4(pupils.matrixWorld));
  }
  lucyEye.divideScalar(shells.length);skull.worldToLocal(lucyEye);
  const robot=view.droidBay.droid;
  robot.update(0,'idle');robot.root.updateMatrixWorld(true);
  const rigs={
    milo:new HeadLookRig(head,milo.userData.body,miloEye,{neckAnchor:new Vector3(0,-.030,.009)}),
    cat:new HeadLookRig(skull,lucy,lucyEye),
    droid:new HeadLookRig(robot.head,robot.root,new Vector3(0,.026,.148)),
  };
  robot.update(0,'charging');
  return rigs;
}

export class CharacterCamera {
  constructor(view,{rigs=createCharacterLookRigs(view),wall=createViewingWall(cabinWallMaterials(view.ship.staticMesh))}={}){
    this.view=view;this.rigs=rigs;this.wall=wall;view.scene.add(wall);
    this.look=new LookInput();this.comfort=new StableFirstPersonCamera(view.milo,rigs.milo.eyePosition());
    this.selected=null;this.angle='front';this.firstPerson=false;this.transition=null;this.rest=inactiveRest();this.touch=null;
    this.unmask=[];
    const headMeshes=new Set();view.milo.userData.head.traverse(mesh=>{if(mesh.isMesh)headMeshes.add(mesh);});
    for(const [id,root]of Object.entries({milo:view.milo,cat:view.cat,droid:view.droidBay.droid.root}))root.traverse(mesh=>{
      if(mesh.isMesh&&(headMeshes.has(mesh)||/ink|outline/i.test(mesh.material?.name??''))){
        this.unmask.push(maskSelfView(mesh,view.camera,()=>this.active&&this.selected===id));
      }
    });
  }
  get available(){return Boolean(this.selected&&!this.view.immersive?.active);}
  get active(){return this.available&&this.firstPerson;}
  restorePose(){Object.values(this.rigs).forEach(rig=>rig.restore());}
  notify(){this.view.onCameraChange?.();}
  select(mode){
    this.restorePose();this.selected=Object.hasOwn(LOOK_PROFILES,mode)?mode:null;
    this.angle='front';this.firstPerson=false;this.transition=null;this.touch=null;this.eye=null;this.context=null;this.rest=inactiveRest();this.wall.visible=false;
    if(this.selected)this.look.setProfile(this.selected);
    this.comfort.reset();this.view.onFirstPersonFrame?.(this.rest,false);
  }
  cycleAngle(){
    if(!this.available)return;
    const wasFirstPerson=this.firstPerson;
    this.restorePose();this.firstPerson=false;this.wall.visible=false;this.touch=null;
    const offset=this.view.camera.position.clone().sub(this.view.center);
    this.transition=wasFirstPerson?null:{age:0,yaw:Math.atan2(offset.x,offset.z),pitch:Math.atan2(offset.y,Math.hypot(offset.x,offset.z)),fov:this.view.camera.fov};
    this.angle=FOLLOW_ANGLES[(FOLLOW_ANGLES.indexOf(this.angle)+1)%FOLLOW_ANGLES.length];
    this.comfort.reset();this.notify();
  }
  toggleFirstPerson(){
    if(!this.available)return;
    this.restorePose();this.firstPerson=!this.firstPerson;this.transition=null;this.touch=null;
    this.look.reset();this.comfort.reset();this.wall.visible=this.active;this.notify();
  }
  pointerDown(event){
    if(!this.active)return false;
    if(event.pointerType!=='mouse'&&!this.rest.locked){this.touch={id:event.pointerId,x:event.clientX,y:event.clientY};this.view.canvas.setPointerCapture(event.pointerId);}
    return true;
  }
  pointerMove(event){
    if(!this.active)return false;
    if(this.rest.locked)return true;
    if(event.pointerType==='mouse'){
      const r=this.view.canvas.getBoundingClientRect();
      this.look.setNormalized((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);
    }else if(this.touch?.id===event.pointerId){
      this.look.drag(event.clientX-this.touch.x,event.clientY-this.touch.y);this.touch.x=event.clientX;this.touch.y=event.clientY;
    }
    return true;
  }
  pointerEnd(event){if(this.touch?.id===event.pointerId)this.touch=null;return this.active;}
  update(dt,{actor,brain,catRoutine}){
    this.wall.visible=this.active;
    this.view.deckStyle?.setFootlightsVisible(this.wall.visible);
    if(this.transition)this.transition.age+=this.view.reducedMotion?1:dt;
    if(!this.active){this.rest=inactiveRest();this.view.onFirstPersonFrame?.(this.rest,false);return;}
    const medical=medicalView(brain,this.selected);
    this.rest=medical.active?{...medical,closure:0,medical:true}:this.selected==='cat'?
      catSleepView(this.view.cat.userData.cabin?.sleepWeight):sleepView(brain.bunkVisit?.pose,this.selected);
    if(this.rest.locked)this.look.reset();
    const freedom=this.selected==='milo'?(brain.grooming?.18:brain.bunkVisit?.25:brain.state==='performing'?.55:1):
      this.selected==='cat'?(['sleep','groom','eat'].includes(catRoutine.mode)?.3:1):
      this.view.droidRoutine?.docked?.45:this.view.droidRoutine?.pose.mode==='work'?.6:1;
    this.look.update(dt,freedom);
    const rig=this.rigs[this.selected];rig.apply(this.look.yaw*(1-this.rest.recline),this.look.pitch*(1-this.rest.recline));
    if(this.selected==='milo')updateMiloNeck(this.view.milo,{attached:true});
    this.eye=rig.eyePosition();this.orientation=rig.orientation();this.context={actor,brain,dt};
    this.view.onFirstPersonFrame?.(this.rest,true);
  }
  applyCamera(){
    if(!this.available)return false;
    const v=this.view,camera=v.camera;
    camera.aspect=v.width/v.height;camera.up.set(0,1,0);camera.far=150;
    if(this.firstPerson&&this.eye){
      const {actor,brain,dt}=this.context;
      camera.near=.025;camera.fov=LOOK_PROFILES[this.selected].fov;
      camera.position.copy(this.eye);camera.quaternion.copy(this.orientation).multiply(cameraForward);
      if(this.selected==='milo')this.comfort.update(camera,{eye:this.eye,yaw:this.look.yaw,pitch:this.look.pitch,dt,climbing:actor.climbing,recline:this.rest.recline,
        attachedOrientation:brain.bunkVisit||this.rest.medical?this.orientation:null,
        standing:actor.busy||(!brain.grooming&&!brain.bunkVisit&&brain.state!=='performing'&&!brain.loungeEntry&&!brain.loungeStow&&!brain.loungeExit&&!brain.reclineExit)});
    }else if(this.angle!=='front'||this.transition){
      let yaw,pitch,fov;camera.near=.1;
      if(this.angle==='front'){
        const x=v.reducedMotion?0:MathUtils.clamp(v.center.x*.32,-4,4),y=v.reducedMotion?1.6:MathUtils.clamp(1.6+(v.center.y-HABITAT_VIEW.centerY)*.22,.25,3),z=Math.sqrt(1600-x*x-y*y);
        yaw=Math.atan2(x,z);pitch=Math.atan2(y,Math.hypot(x,z));fov=MathUtils.radToDeg(2*Math.atan(v.viewHeight/80));
      }else{
        const {x,y,z}=FOLLOW_OBLIQUE;yaw=(this.angle==='left'?-1:1)*Math.atan2(x,z);pitch=Math.atan2(y,Math.hypot(x,z));fov=FOLLOW_OBLIQUE.fov;
      }
      if(this.transition){
        const from=this.transition,t=MathUtils.smoothstep(from.age,0,.32);
        yaw=MathUtils.lerp(from.yaw,yaw,t);pitch=MathUtils.lerp(from.pitch,pitch,t);fov=MathUtils.lerp(from.fov,fov,t);
        if(t===1)this.transition=null;
      }
      const distance=v.viewHeight/(2*Math.tan(MathUtils.degToRad(fov)/2));
      camera.position.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(distance).add(v.center);
      camera.lookAt(v.center);camera.fov=fov;
    }else return false;
    camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return true;
  }
  dispose(){this.restorePose();this.unmask.forEach(restore=>restore());}
}
