import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials} from './materials.js';
import {buildShip,positionX,positionY,HABITAT_VIEW} from './ship.js';
import {createMilo,createCat,animateMilo,animateCat} from './characters.js';
import {currentAction} from './state.js';
import {loadMiloHead} from './head.js';
import {animateDelivery} from './delivery.js';
import {animateGym,BIKE} from './gym.js';
import {CAT_PORT} from './layout.js';
import {animateAirlock} from './eva.js';
import {animateMedical,medicalRecline,medicalReadings,MED_BED} from './medical.js';
import {BUNK_BED,reclineProgress} from './recline.js';

export class ObservationView {
  static async create(canvas){const [m,head]=await Promise.all([materials(),loadMiloHead()]);return new ObservationView(canvas,m,head);}
  constructor(canvas,m,head){
    this.canvas=canvas;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x090d0f);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const pmrem=new THREE.PMREMGenerator(this.renderer),environment=new RoomEnvironment();
    this.envTarget=pmrem.fromScene(environment,.04);this.scene.environment=this.envTarget.texture;environment.dispose();pmrem.dispose();
    Object.values(m).forEach(mat=>{if(mat.isMeshStandardMaterial)mat.envMapIntensity=.24;});
    this.scene.add(new THREE.HemisphereLight(0xdce9ed,0x2e3432,1.05));
    const key=new THREE.DirectionalLight(0xffefd5,2.5);key.position.set(-5,12,15);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-16,right:16,top:11,bottom:-10,near:.1,far:60});key.shadow.bias=-.0001;key.shadow.normalBias=.024;key.target.position.set(0,5,0);this.scene.add(key,key.target);
    const fill=new THREE.DirectionalLight(0xb9d0d8,.80);fill.position.set(12,7,9);this.scene.add(fill);
    this.ship=buildShip(m);this.scene.add(this.ship.staticMesh,this.ship.animated);
    this.milo=createMilo(m,head);this.cat=createCat(m);this.scene.add(this.milo,this.cat);
    this.camera=new THREE.OrthographicCamera(-16,16,8,-8,.1,150);this.camera.position.set(0,6.7,40);this.camera.lookAt(0,5.0,0);
    this.mode='all';this.zoom=1;this.center=new THREE.Vector3(0,HABITAT_VIEW.centerY,0);this.targetCenter=this.center.clone();this.viewHeight=15;this.targetHeight=15;
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.onStation=null;this.onModeChange=null;this.feedback=null;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=()=>{const r=canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);this.fitHeight=Math.max(HABITAT_VIEW.minHeight,29.4/(r.width/r.height));if(this.mode==='all')this.targetHeight=this.fitHeight/this.zoom;this.setFrustum();};
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
    this.bind('pointerdown',e=>{if(e.button!==0||e.isPrimary===false||drag)return;drag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,cx:this.targetCenter.x,cy:this.targetCenter.y,target:this.targetAt(e),moved:false};this.canvas.setPointerCapture(e.pointerId);});
    this.bind('pointermove',e=>{if(!drag){this.hoverTarget(this.targetAt(e));return;}if(e.pointerId!==drag.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){this.hover(null);this.canvas.style.cursor='grabbing';if(this.mode!=='manual'){this.mode='manual';this.onModeChange?.(this.mode);}this.targetCenter.x=THREE.MathUtils.clamp(drag.cx-dx*this.viewHeight/this.height,-13,13);this.targetCenter.y=THREE.MathUtils.clamp(drag.cy+dy*this.viewHeight/this.height,HABITAT_VIEW.panMinY,HABITAT_VIEW.panMaxY);}});
    this.bind('pointerup',e=>{if(!drag||e.pointerId!==drag.pointerId)return;const {target,moved}=drag;drag=null;this.hover(null);if(moved||!target)return;if(target.type==='character')this.setMode(target.id);else this.onStation?.(target.id);});
    this.bind('pointercancel',e=>{if(drag&&e.pointerId!==drag.pointerId)return;drag=null;this.hover(null);});
    this.bind('lostpointercapture',e=>{if(drag&&e.pointerId!==drag.pointerId)return;drag=null;this.hover(null);});
    this.bind('pointerleave',()=>this.hover(null));
    this.bind('wheel',e=>{e.preventDefault();this.changeZoom(e.deltaY<0?1.15:1/1.15);},{passive:false});
  }
  setMode(mode){this.hover(null);this.mode=mode;this.zoom=1;this.targetHeight=mode==='all'?this.fitHeight:mode==='cat'?3.3:5.3;if(mode==='all')this.targetCenter.set(0,HABITAT_VIEW.centerY,0);this.onModeChange?.(mode);}
  changeZoom(ratio){this.hover(null);this.zoom=THREE.MathUtils.clamp(this.zoom*ratio,.8,5);const base=this.mode==='all'||this.mode==='manual'?this.fitHeight:this.mode==='cat'?3.3:5.3;this.targetHeight=THREE.MathUtils.clamp(base/this.zoom,1.9,this.fitHeight*1.25);}
  setFrustum(){const half=this.viewHeight/2,aspect=this.width/this.height;this.camera.left=-half*aspect;this.camera.right=half*aspect;this.camera.top=half;this.camera.bottom=-half;this.camera.updateProjectionMatrix();}
  render(dt,time,actor,brain,catRoutine,care,paused=false,airlock=null){
    const action=currentAction(brain),catMotion=catRoutine.motion;
    const actionTime=brain.state==='performing'?brain.curDurSec-brain.performT:time;
    if(action==='gym')animateGym(this.ship.gym,actionTime);
    this.milo.position.set(positionX(actor.x),positionY(actor.y),actor.climbing?.48:.78);
    animateMilo(this.milo,{moving:actor.busy,waiting:actor.waitingForHatch,climbing:actor.climbing,facing:actor.facing,action,time,actionTime,actionDuration:brain.curDurSec,knock:actor.knockTime,health:brain.health});
    const treating=Boolean(brain.health.treatment);
    animateMedical(this.ship.medical,actionTime,action==='medical',action==='medical'?(treating?medicalReadings(brain.needs,brain.health):brain.medicalSample):brain.lastMedicalReport,{duration:brain.curDurSec,treating,alert:brain.health.needsCare});
    if(airlock)animateAirlock(this.ship.innerDoor,this.ship.innerSignal,airlock.opening);
    const passage=catMotion.passagePose,catMoving=passage?['enter','exit'].includes(passage.phase):catMotion.busy;
    this.cat.position.set(positionX(catMotion.x),positionY(catMotion.y),catMotion.z);this.cat.visible=!catMotion.hidden;
    animateCat(this.cat,{time,moving:catMoving,climbing:false,facing:catMotion.facing,mode:catRoutine.mode,passage,actionTime:catRoutine.modeTime,remaining:catRoutine.remaining});
    const couch=!passage&&catMotion.floor===0?THREE.MathUtils.clamp((catMotion.x-970)/65,0,1):0;
    this.cat.position.y+=couch*.64;this.cat.position.z-=couch*1.14;
    if(action==='lounge')this.milo.position.z=-.28;
    if(action==='bunk')this.milo.position.z=THREE.MathUtils.lerp(.78,BUNK_BED.depth,reclineProgress(actionTime,brain.curDurSec,BUNK_BED.transition));
    if(action==='gym')this.milo.position.z=BIKE.depth;
    if(action==='medical')this.milo.position.z=THREE.MathUtils.lerp(.78,MED_BED.depth,medicalRecline(actionTime,brain.curDurSec));
    if(!paused)this.ship.fan.children.slice(1).forEach(blade=>blade.rotation.z+=dt*3.0);
    animateDelivery(this.ship,care,this.reducedMotion);
    this.ship.foodGroup.visible=care.has('catfood')||catRoutine.mode==='eat';
    for(const [id,{group,material}]of Object.entries(this.ship.indicators)){
      const shipment=id==='hatch'&&care.delivery&&!['queued','transmitting'].includes(care.phase);
      const signal=shipment?{color:care.phase==='unloading'?0x85e3af:0xf3bd62,intensity:this.reducedMotion?1:.75+.25*Math.sin(time*3)}:this.feedback?.signal(id,this.reducedMotion)||(id==='gym'&&action==='gym'?{color:0x85e3af,intensity:1}:null);group.visible=Boolean(signal);
      if(signal){material.color.setHex(signal.color);material.opacity=signal.intensity;}
    }
    if(this.mode==='milo')this.targetCenter.copy(this.milo.position).add(new THREE.Vector3(0,.9,0));
    if(this.mode==='cat')this.targetCenter.copy(this.cat.position).add(new THREE.Vector3(0,.37,0));
    const lerp=1-Math.exp(-dt*5);this.center.lerp(this.targetCenter,lerp);this.viewHeight=THREE.MathUtils.lerp(this.viewHeight,this.targetHeight,lerp);this.setFrustum();
    this.camera.position.set(this.center.x,this.center.y+1.6,40);this.camera.lookAt(this.center.x,this.center.y,0);this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.observer.disconnect();this.listeners.forEach(([type,fn,options])=>this.canvas.removeEventListener(type,fn,options));const geometries=new Set(),mats=new Set(),textures=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});mats.forEach(m=>Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);}));geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.envTarget.dispose();this.renderer.dispose();}
}
