import * as THREE from 'three';
import {createCurtis} from './curtis-model.js?v=print10';
import {animateMilo} from './characters.js';
import {applyCabinLadder} from './cabin-ladder.js';
import {loungeExitPose} from './lounge-exit.js';
import {applyLeisurePose} from './leisure.js';
import {setTabletHandFit} from './tablet-pose.js';
import {reachCup,cupGripPose} from './dining.js';
import {createMiloToonSteps} from './milo-toon.js';
import {CabinStartupLighting} from './startup-lighting.js';
import {limitShadowCasters} from './lighting.js';
import {runPreparationSteps,nextPreparationFrame} from './background-preparation.js';
import {CURTIS} from './curtis-routine.js';
import {solveHingeArm} from './arm-ik.js';
import {curtisCoffeePose} from './curtis-coffee.js';
import {updateCupWater} from './cup-water.js';

export class CurtisView {
  static async create(view){
    const root=await createCurtis();root.visible=false;
    const result=new CurtisView(root,view);
    try{
      result.toon=await runPreparationSteps(createMiloToonSteps(root));
      result.lighting=new CabinStartupLighting([root],{start:false});
      const clip=new THREE.Plane(new THREE.Vector3(0,-1,0),13.3);
      root.traverse(mesh=>{
        for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material]).filter(Boolean)){
          material.clippingPlanes=[clip];material.clipShadows=true;material.needsUpdate=true;
        }
      });
      limitShadowCasters(root);
      // Prepare only Curtis's programs after the first scene is already usable.
      // Submission is spread over frames, not added to cabin startup compilation.
      const pending=[],leaves=[];root.traverse(mesh=>{if(mesh.material)leaves.push(mesh);});
      for(const mesh of leaves){pending.push(view.renderer.compileAsync(mesh,view.camera,view.scene));await nextPreparationFrame();}
      await Promise.all(pending);
      return result;
    }catch(error){result.dispose();throw error;}
  }
  constructor(root,view){
    this.root=root;this.view=view;
    const {water}=root.userData.dining;
    for(const part of [water,water.userData.edge]){
      part.material=part.material.clone();part.material.color.set('#231007');part.material.opacity=1;part.material.transparent=false;
    }
    this.dock=new THREE.Object3D();this.dock.position.set(9.915,3.392+1.005+.064,-.93);
    this.dock.rotation.y=Math.PI;
    this.cupHome=this.dock.position.clone();
    this.cupPour=this.cupHome.clone().add(new THREE.Vector3(.22,.025,.03));
    this.stream=new THREE.Mesh(new THREE.CylinderGeometry(.005,.006,.09,8),new THREE.MeshBasicMaterial({color:0x482311}));
    this.stream.position.copy(this.cupPour).add(new THREE.Vector3(0,.112,0));
    this.stream.visible=false;view.scene.add(this.stream);
  }
  render(routine,dt,{actor}={}){
    const root=this.root,s=routine.step;
    this.stream.visible=false;
    if(!routine.active||!s){root.visible=false;if(this.view.ship.coffeeMug)this.view.ship.coffeeMug.visible=true;return;}
    const p=routine.trafficPosition??routine.position,age=routine.age;
    const coffee=s.kind==='coffee'?curtisCoffeePose(age):null;
    this.dock.position.copy(this.cupHome);
    if(coffee)this.dock.position.copy(this.cupPour).lerp(this.cupHome,coffee.returning);
    root.position.set(p.x,p.y,p.z);
    const seated=['sit','relax','stand'].includes(s.kind);
    // Reuse only the vertical sit/rise phase, without the table-side shuffle
    // or the belongings-handling phase that lifts the hands.
    const lowering=THREE.MathUtils.clamp((age-.6)/(s.duration-.6),0,1);
    const poseAge=s.kind==='sit'?THREE.MathUtils.lerp(2.2,.8,lowering):
      s.kind==='stand'?THREE.MathUtils.lerp(.8,2.2,age/s.duration):null;
    const exit=poseAge===null?null:{age:poseAge,turnYaw:0};
    if(s.kind==='climb')s.startYaw??=root.rotation.y;
    if(seated){
      const pose=exit?loungeExitPose(poseAge):{depth:.06};
      root.position.x=CURTIS.seatX;root.position.z=pose.depth;
    }
    animateMilo(root,{moving:s.kind==='walk',waiting:routine.waiting,climbing:false,
      facing:Math.sign(Math.sin(routine.yaw))||1,walkYaw:routine.yaw,walkDistance:routine.walkDistance,
      action:seated?'lounge':s.kind==='coffee'?'hydro':null,
      time:routine.time,dt,actionTime:coffee?(coffee.brewing?0:coffee.drinkTime):age,actionDuration:coffee?coffee.drinkDuration:s.duration,
      loungeExit:exit,diningDocks:s.kind==='coffee'?{mug:this.dock}:null});
    if(seated){
      if(s.kind==='sit')root.rotation.y+=Math.PI*(1-THREE.MathUtils.smoothstep(age,0,.6));
      const weight=s.kind==='sit'?THREE.MathUtils.smoothstep(lowering,0,1):s.kind==='stand'?1-THREE.MathUtils.smoothstep(age,0,s.duration):1;
      for(const {arm,elbow,hand,side}of root.userData.arms){
        arm.rotation.set(THREE.MathUtils.lerp(-.05,-.15,weight),0,side*.08);
        elbow.rotation.set(THREE.MathUtils.lerp(-.08,-.65,weight),0,0);
        hand.rotation.set(.12*weight,root.userData.bodySkin?side*Math.PI/2:0,0);
      }
      for(const prop of ['tablet','phones','toy'])root.userData.leisure[prop].visible=false;
    }
    if(s.kind==='climb'){
      applyCabinLadder(root,{height:p.y,startHeight:s.enter?s.from.y+2:s.from.y,
        endHeight:s.leave?s.to.y+2:s.to.y,startYaw:s.enter?Math.PI:s.startYaw,startDepth:s.from.z,
        endYaw:s.enter?Math.PI/2:-Math.PI/2,endDepth:s.to.z});
    }else if(s.kind==='relax'){
      // Rest on the thighs; the visitor's seat is left of Milo and Lucy.
      root.userData.head.rotation.y=.17*Math.sin(age*.16);
    }else if(['work','window'].includes(s.kind)||coffee?.brewing){
      if(!coffee)root.rotation.y+=Math.atan2(Math.sin(Math.PI-root.rotation.y),Math.cos(Math.PI-root.rotation.y))*(1-Math.exp(-5*dt));
      const ease=THREE.MathUtils.smoothstep(Math.min(age,s.duration-age),0,1.5);
      if(s.kind==='work'){
        applyLeisurePose(root,'tablet',age,s.duration);setTabletHandFit(root,true);
        // A personal terminal at the rear workbench, independent of Milo's pad.
        root.userData.head.rotation.x=.23*ease;
      }else if(s.kind==='window'){
        root.userData.head.rotation.set(-.08*ease,.16*Math.sin(age*.12)*ease,0);
      }else{
        const {body,dining}=root.userData,{mug,water}=dining;
        const {reach,transfer,press}=coffee;
        const position=this.cupHome.clone().lerp(this.cupPour,transfer);
        position.y+=.07*Math.sin(Math.PI*transfer);
        root.updateWorldMatrix(true,true);
        mug.visible=true;mug.position.copy(body.worldToLocal(position));
        mug.quaternion.copy(body.getWorldQuaternion(new THREE.Quaternion())).invert().multiply(this.dock.quaternion);
        reachCup(root,mug,reach,cupGripPose(0));
        // The left hand stays on the cup while the free hand presses ESPRESSO.
        const rig=root.userData.arms[0],rest=body.worldToLocal(rig.hand.getWorldPosition(new THREE.Vector3()));
        const button=body.worldToLocal(this.cupHome.clone().add(new THREE.Vector3(.066,.551,.173)));
        // Solve fingertip contact with a straight wrist. The palm follows the
        // forearm, rather than being forced to face the panel independently.
        if(press>0){
          const straight=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),rig.hand.position.clone().normalize())
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rig.side*Math.PI/2));
          const pole=new THREE.Vector3(rig.side*.65,-1,.08),tip=new THREE.Vector3(0,-.12,0).multiply(rig.hand.scale);
          const wrist=button.clone().add(new THREE.Vector3(0,0,-.12));
          for(let i=0;i<30;i++){
            const pose=solveHingeArm(rig,wrist,pole);
            const rotation=pose.upper.clone().multiply(pose.lower).multiply(straight);
            wrist.lerp(button.clone().sub(tip.clone().applyQuaternion(rotation)),.65);
          }
          const pose=solveHingeArm(rig,rest.lerp(wrist,press),pole);
          rig.arm.quaternion.copy(pose.upper);rig.elbow.quaternion.copy(pose.lower);
          rig.hand.quaternion.copy(straight);
        }
        this.stream.visible=coffee.pouring;
        water.scale.y=1;updateCupWater(water,THREE.MathUtils.lerp(-.05,.047,coffee.fill));water.visible=age>=3.8;
        root.userData.updateWristTwists?.();
      }
    }
    root.visible=true;
    if(!coffee?.brewing){root.userData.dining.water.scale.y=1;root.userData.dining.water.visible=true;}
    if(this.view.ship.coffeeMug)this.view.ship.coffeeMug.visible=!coffee;
    this.toon.update(this.view.width,this.view.height);
    root.updateMatrixWorld(true);
  }
  dispose(){
    this.stream.removeFromParent();this.stream.geometry.dispose();this.stream.material.dispose();
    this.root.removeFromParent();this.toon?.dispose();this.lighting?.dispose();
    this.root.userData.bodySkin?.skeleton.dispose();
    // Character builders share some geometry and materials. Never dispose a
    // resource still used by Milo or the cabin when a late load is cancelled.
    const live=new Set(),own=new Set();
    const collect=(root,set)=>root.traverse(o=>{
      if(o.geometry)set.add(o.geometry);
      for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){
        set.add(m);for(const v of Object.values(m))if(v?.isTexture)set.add(v);
      }
    });
    collect(this.view.scene,live);collect(this.root,own);own.add(this.root.userData.curtisPrint);
    for(const resource of own)if(resource&&!live.has(resource))resource.dispose();
  }
}
