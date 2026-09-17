import * as THREE from 'three';
import {CABIN_PIXEL_RATIO,CABIN_SHADOW_SIZE,limitCabinLights} from './lighting.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials} from './materials.js';
import {buildShip,positionX,positionY,HABITAT_VIEW} from './ship.js';
import {createMilo,animateMilo} from './characters.js';
import {loadCabinLucy as loadLucy,createCabinLucy as createLucy,animateCabinLucy as animateLucy,disposeCabinLucy as disposeLucy} from './lucy-cabin.js';
import {currentAction} from './state.js';
import {animatePlants} from './plants.js';
import {loadMiloHead} from './head.js';
import {animateDelivery} from './delivery.js';
import {animateVerticalShutter} from './shutter.js';
import {animateGym,BIKE} from './gym.js';
import {CAT_PORT,CAT_SOFA,LOUNGE_SEAT,CABIN_AISLE,FLOORS,getStation} from './layout.js';
import {animateAirlock} from './eva.js';
import {loadEVAGarment} from './eva-garment.js';
import {loadMiloBody} from './milo-body.js';
import {animateMedical,medicalExitTime,medicalReadings} from './medical.js';
import {BUNK_BED,reclineProgress,reclineExitProgress} from './recline.js';
import {animateBunk} from './bunk.js';
import {BUNK_PHASE_SECONDS} from './bunk-visit.js';
import {diningPhase,DINING_APPROACH} from './dining.js';
import {loungeExitPose,loungeEntryAge} from './lounge-exit.js';

export class ObservationView {
  static async create(canvas){const [m,head,lucy]=await Promise.all([materials(),loadMiloHead(),loadLucy(),loadEVAGarment(),loadMiloBody()]);return new ObservationView(canvas,m,head,lucy);}
  constructor(canvas,m,head,lucy){
    this.canvas=canvas;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x090d0f);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.localClippingEnabled=true;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,CABIN_PIXEL_RATIO));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.28;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const pmrem=new THREE.PMREMGenerator(this.renderer),environment=new RoomEnvironment();
    this.envTarget=pmrem.fromScene(environment,.04);this.scene.environment=this.envTarget.texture;environment.dispose();pmrem.dispose();
    Object.values(m).forEach(mat=>{if(mat.isMeshStandardMaterial)mat.envMapIntensity=.24;});
    this.scene.add(new THREE.HemisphereLight(0xdce9ed,0x2e3432,1.05));
    const key=new THREE.DirectionalLight(0xffefd5,2.5);key.position.set(-5,12,15);key.castShadow=true;key.shadow.mapSize.set(CABIN_SHADOW_SIZE,CABIN_SHADOW_SIZE);Object.assign(key.shadow.camera,{left:-16,right:16,top:11,bottom:-10,near:.1,far:60});key.shadow.bias=-.0001;key.shadow.normalBias=.024;key.target.position.set(0,5,0);this.scene.add(key,key.target);
    const fill=new THREE.DirectionalLight(0xb9d0d8,.80);fill.position.set(12,7,9);this.scene.add(fill);
    this.ship=buildShip(m);limitCabinLights(this.ship.animated);this.scene.add(this.ship.staticMesh,this.ship.animated);
    this.milo=createMilo(m,head);this.cat=createLucy(lucy);this.scene.add(this.milo,this.cat);
    this.camera=new THREE.PerspectiveCamera(24,1,.1,150);
    this.mode='all';this.zoom=1;this.center=new THREE.Vector3(0,HABITAT_VIEW.centerY,0);this.targetCenter=this.center.clone();this.viewHeight=15;this.targetHeight=15;
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.onStation=null;this.onModeChange=null;this.feedback=null;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=()=>{const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.zoomAnchor=null;this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);this.fitHeight=Math.max(HABITAT_VIEW.minHeight,29.4/(r.width/r.height));if(this.mode==='all')this.targetHeight=this.fitHeight/this.zoom;this.setFrustum();};
    this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);this.resize();this.viewHeight=this.targetHeight;this.setFrustum();
    this.listeners=[];this.bindControls();
    const stars=new Float32Array(420*3);for(let i=0;i<420;i++){stars[i*3]=(Math.sin(i*162.2)*.5)*90;stars[i*3+1]=(Math.sin(i*714.1)*.5)*52+5;stars[i*3+2]=-9-Math.abs(Math.sin(i))*10;}
    const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(stars,3));this.scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9bafb5,size:.028,transparent:true,opacity:.36})));
  }
  bind(type,fn,options){this.canvas.addEventListener(type,fn,options);this.listeners.push([type,fn,options]);}
  targetAt(event){
    const rect=this.canvas.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    // Station hit volumes extend in front of furniture, so visible characters win.
    for(const hit of this.raycaster.intersectObjects([this.milo,this.cat],true)){
      if(!hit.object.isMesh)continue;
      let node=hit.object,visible=true,id=null;
      while(node){if(!node.visible){visible=false;break;}if(node===this.milo)id='milo';if(node===this.cat)id='cat';node=node.parent;}
      if(visible&&id){if(id==='cat'&&hit.point.z<CAT_PORT.wallZ)continue;return{type:'character',id};}
    }
    const id=this.raycaster.intersectObjects(this.ship.targets)[0]?.object.userData.station;
    return id?{type:'station',id}:null;
  }
  hover(id){if(this.feedback)this.feedback.hovered=id;this.canvas.style.cursor=id?'pointer':'grab';}
  hoverTarget(target){this.hover(target?.type==='station'?target.id:null);if(target?.type==='character')this.canvas.style.cursor='zoom-in';}
  bindControls(){
    let drag=null;
    this.bind('pointerdown',e=>{if(e.button!==0||e.isPrimary===false||drag)return;this.zoomAnchor=null;drag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,cx:this.targetCenter.x,cy:this.targetCenter.y,target:this.targetAt(e),moved:false};this.canvas.setPointerCapture(e.pointerId);});
    this.bind('pointermove',e=>{if(!drag){this.hoverTarget(this.targetAt(e));return;}if(e.pointerId!==drag.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){this.hover(null);this.canvas.style.cursor='grabbing';if(this.mode!=='manual'){this.mode='manual';this.onModeChange?.(this.mode);}this.targetCenter.x=THREE.MathUtils.clamp(drag.cx-dx*this.viewHeight/this.height,-13,13);this.targetCenter.y=THREE.MathUtils.clamp(drag.cy+dy*this.viewHeight/this.height,HABITAT_VIEW.panMinY,HABITAT_VIEW.panMaxY);}});
    this.bind('pointerup',e=>{if(!drag||e.pointerId!==drag.pointerId)return;const {target,moved}=drag;drag=null;this.hover(null);if(moved||!target)return;if(target.type==='character')this.setMode(target.id);else this.onStation?.(target.id);});
    this.bind('pointercancel',e=>{if(drag&&e.pointerId!==drag.pointerId)return;drag=null;this.hover(null);});
    this.bind('lostpointercapture',e=>{if(drag&&e.pointerId!==drag.pointerId)return;drag=null;this.hover(null);});
    this.bind('pointerleave',()=>this.hover(null));
    this.bind('wheel',e=>{if(e.deltaY===0)return;e.preventDefault();this.changeZoom(e.deltaY<0?1.15:1/1.15,e);},{passive:false});
  }
  setMode(mode){this.hover(null);this.zoomAnchor=null;this.mode=mode;this.zoom=1;this.targetHeight=mode==='all'?this.fitHeight:mode==='cat'?3.3:5.3;if(mode==='all')this.targetCenter.set(0,HABITAT_VIEW.centerY,0);this.onModeChange?.(mode);}
  changeZoom(ratio,pointer=null){
    if(!Number.isFinite(ratio)||ratio<=0||ratio===1)return;
    const height=THREE.MathUtils.clamp((this.targetHeight??this.viewHeight)/ratio,1.9,this.fitHeight*1.25);
    if(height===this.targetHeight)return;
    this.hover(null);
    if(pointer){
      const rect=this.canvas.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return;
      const x=(pointer.clientX-rect.left)/rect.width*2-1,y=1-(pointer.clientY-rect.top)/rect.height*2;
      const ndc=new THREE.Vector2(x,y),plane=new THREE.Plane(new THREE.Vector3(0,0,1),-this.center.z);
      const ray=new THREE.Raycaster();ray.setFromCamera(ndc,this.camera);
      this.zoomAnchor={ndc,plane,point:ray.ray.intersectPlane(plane,new THREE.Vector3()),ray};
      // Pin the focus plane; other depths retain their natural perspective shift.
      this.targetCenter.copy(this.center);
      if(this.mode!=='manual'){this.mode='manual';this.onModeChange?.(this.mode);}
    }else this.zoomAnchor=null;
    const base=this.mode==='all'||this.mode==='manual'?this.fitHeight:this.mode==='cat'?3.3:5.3;
    this.targetHeight=height;this.zoom=base/height;
  }
  setFrustum(){
    const distance=40;
    this.camera.aspect=this.width/this.height;
    this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(this.viewHeight/(2*distance)));
    this.camera.updateProjectionMatrix();
    const pose=()=>{
      const x=this.reducedMotion?0:THREE.MathUtils.clamp(this.center.x*.32,-4,4);
      const y=this.reducedMotion?1.6:THREE.MathUtils.clamp(1.6+(this.center.y-HABITAT_VIEW.centerY)*.22,.25,3);
      this.camera.position.set(this.center.x+x,this.center.y+y,this.center.z+Math.sqrt(distance*distance-x*x-y*y));
      this.camera.lookAt(this.center);this.camera.updateMatrixWorld(true);
    };
    pose();
    const anchor=this.zoomAnchor;
    if(!anchor?.point)return;
    // Correct the small orbit-induced drift without extra scene raycasts or render passes.
    const hit=new THREE.Vector3();
    for(let i=0;i<8;i++){
      anchor.ray.setFromCamera(anchor.ndc,this.camera);
      if(!anchor.ray.ray.intersectPlane(anchor.plane,hit))break;
      const dx=anchor.point.x-hit.x,dy=anchor.point.y-hit.y;
      if(Math.abs(dx)+Math.abs(dy)<1e-10)break;
      this.center.x+=dx;this.center.y+=dy;pose();
    }
    this.targetCenter.copy(this.center);
  }
  render(dt,time,actor,brain,catRoutine,care,paused=false,airlock=null){
    const action=currentAction(brain),catMotion=catRoutine.motion;
    const actionTime=brain.reclineExit?.actionTime??brain.loungeExit?.actionTime??(brain.loungeEntry?0:brain.state==='performing'?brain.curDurSec-brain.performT:time);
    animateGym(this.ship.gym,brain.gymVisit?.pedalTime??brain.gymPedalTime??0);
    animateBunk(this.ship.bunk,brain.bunkVisit?.pose);
    if(brain.plants)animatePlants(this.ship.plants,brain.plants,time);
    this.milo.position.set(positionX(actor.x),positionY(actor.y),actor.climbing?.48:CABIN_AISLE.crewZ);
    const bathroom=brain.bathroom?.pose;
    if(action==='plant')this.milo.position.z=.78-.76*THREE.MathUtils.smoothstep(Math.min(actionTime,brain.curDurSec-actionTime),0,1.2);
    if(['galley','hydro'].includes(action))this.milo.position.z=.78-DINING_APPROACH*diningPhase(actionTime,brain.curDurSec).approach;
    if(brain.gymVisit)brain.gymVisit.startYaw??=this.milo.rotation.y;
    if(brain.bunkVisit)brain.bunkVisit.startYaw??=this.milo.rotation.y;
    animateMilo(this.milo,{moving:actor.busy,waiting:actor.waitingForHatch||actor.waitingForCat,climbing:actor.climbing,facing:actor.facing,walkDistance:positionX(actor.walkDistance)-positionX(0),action,time,dt:paused?0:dt,actionTime,actionDuration:brain.curDurSec,callingTime:brain.state==='knocking'?brain.knockT:null,health:brain.health,bathroom,diningDocks:this.ship.diningDocks[action],leisure:brain.loungeExit?.leisure??(brain.state==='performing'||brain.loungeEntry?brain.leisure:null),catReady:catRoutine.mode==='play',loungeExit:brain.loungeExit,gymVisit:brain.gymVisit,loungeEntry:brain.loungeEntry,reclineExit:brain.reclineExit,bunkVisit:brain.bunkVisit});
    for(const [id,fixture]of Object.entries(this.ship.bathrooms)){
      animateVerticalShutter(fixture.door,brain.bathroom?.id===id?(bathroom?.opening??0):0);
    }
    for(const [id,docks]of Object.entries(this.ship.diningDocks)){
      docks.mug.visible=id==='hydro'&&action!==id;
      docks.bowl.visible=id==='galley'&&action!==id;docks.spoon.visible=docks.bowl.visible;
      docks.meal.visible=care.has('food');
    }
    const treating=Boolean(brain.health.treatment);
    const medicalTime=brain.reclineExit?.id==='medical'?medicalExitTime(brain.reclineExit):actionTime;
    animateMedical(this.ship.medical,medicalTime,action==='medical',action==='medical'?(treating?medicalReadings(brain.needs,brain.health):brain.medicalSample):brain.lastMedicalReport,{duration:brain.curDurSec,treating,alert:brain.health.needsCare,patient:this.milo,scanTime:brain.reclineExit?.id==='medical'?brain.reclineExit.actionTime:medicalTime});
    if(airlock)animateAirlock(this.ship.innerDoor,this.ship.innerSignal,airlock.opening);
    const turn=catMotion.turnPose,passage=catMotion.passagePose,catMoving=!turn&&!catMotion.waitingForCrew&&(passage?['enter','exit'].includes(passage.phase):catMotion.busy);
    const hop=catMotion.hop&&!turn?{...catMotion.hop,yaw:Math.atan2((positionX(CAT_SOFA.seatX)-positionX(CAT_SOFA.floorX))*(catMotion.hop.up?1:-1),(LOUNGE_SEAT.centerDepth-CAT_SOFA.approachZ)*(catMotion.hop.up?1:-1))}:null;
    this.cat.position.set(positionX(catMotion.x),positionY(catMotion.y)+catMotion.elevation,catMotion.z);this.cat.visible=!catMotion.hidden;
    let wakeHop=null;
    const wake=catRoutine.bunkWake?.visit;
    if(wake&&['sleeping','waking','leaving'].includes(wake.phase)){
      const floorY=positionY(FLOORS[getStation('bunk').floor].y),bedX=positionX(getStation('bunk').x+24),bedZ=BUNK_BED.depth+.26;
      if(wake.phase==='leaving'){
        const u=THREE.MathUtils.clamp(wake.age/BUNK_PHASE_SECONDS.leaving,0,1),s=u*u*(3-2*u);
        this.cat.position.set(bedX,floorY+THREE.MathUtils.lerp(BUNK_BED.top,0,s)+Math.sin(Math.PI*u)*.32,THREE.MathUtils.lerp(bedZ,CAT_PORT.walkZ,s));
        wakeHop={up:false,phase:'flight',age:u*.56,duration:.56,yaw:0};
      }else this.cat.position.set(bedX,floorY+BUNK_BED.top,bedZ);
    }
    animateLucy(this.cat,{time,dt:paused?0:dt,moving:catMoving,facing:catMotion.facing,yaw:catRoutine.poseYaw,mode:catRoutine.mode,walkDistance:positionX(catMotion.walkDistance)-positionX(0)+catMotion.portalWalkDistance+catMotion.depthWalkDistance,passage,hop:wakeHop??hop,turn,actionTime:catRoutine.modeTime,remaining:catRoutine.remaining,playRelease:catRoutine.playRelease});
    if(action==='lounge'&&!actor.busy)this.milo.position.z=brain.loungeEntry?loungeExitPose(loungeEntryAge(brain.loungeEntry.age)).depth:brain.loungeExit?loungeExitPose(brain.loungeExit.age).depth:LOUNGE_SEAT.depth;
    if(action==='bunk')this.milo.position.z=THREE.MathUtils.lerp(.78,BUNK_BED.depth,reclineProgress(actionTime,brain.curDurSec,BUNK_BED.transition));
    if(action==='gym')this.milo.position.z=brain.gymVisit?.pose.depth??BIKE.depth;
    if(brain.reclineExit?.id==='bunk')this.milo.position.z=THREE.MathUtils.lerp(.78,BUNK_BED.depth,reclineExitProgress(brain.reclineExit));
    if(brain.bunkVisit)this.milo.position.z=brain.bunkVisit.pose.depth;
    if(!paused)this.ship.fan.children.slice(1).forEach(blade=>blade.rotation.z+=dt*3.0);
    animateDelivery(this.ship,care,this.reducedMotion);
    this.ship.foodGroup.visible=care.has('catfood')||catRoutine.mode==='eat';
    for(const [id,{group,material}]of Object.entries(this.ship.indicators)){
      const shipment=id==='hatch'&&care.delivery&&!['queued','transmitting'].includes(care.phase);
      const signal=shipment?{color:care.phase==='unloading'?0x85e3af:0xf3bd62,intensity:this.reducedMotion?1:.75+.25*Math.sin(time*3)}:this.feedback?.signal(id,this.reducedMotion)||(id==='gym'&&action==='gym'?{color:0x85e3af,intensity:1}:null);group.visible=Boolean(signal);
      if(signal){material.color.setHex(signal.color);material.opacity=signal.intensity;}
    }
    if(this.mode==='milo')this.targetCenter.copy(this.milo.position).add(new THREE.Vector3(0,.9,0));
    if(this.mode==='cat')this.targetCenter.copy(this.cat.position).add(new THREE.Vector3(0,.37*this.cat.scale.y,0));
    const lerp=1-Math.exp(-dt*5);this.center.lerp(this.targetCenter,lerp);this.viewHeight=THREE.MathUtils.lerp(this.viewHeight,this.targetHeight,lerp);this.setFrustum();
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.milo.userData.bodySkin?.skeleton.dispose();disposeLucy(this.cat);this.observer.disconnect();this.listeners.forEach(([type,fn,options])=>this.canvas.removeEventListener(type,fn,options));const geometries=new Set(),mats=new Set(),textures=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});const tabletFit=this.milo.userData.tabletHandFit;if(tabletFit){geometries.add(tabletFit.original);geometries.add(tabletFit.geometry);}mats.forEach(m=>Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);}));geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.envTarget.dispose();this.renderer.dispose();}
}
