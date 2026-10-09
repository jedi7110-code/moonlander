import * as THREE from 'three';
import {CABIN_PIXEL_RATIO,CABIN_SHADOW_SIZE,CABIN_AMBIENCE,limitCabinLights,limitShadowCasters} from './lighting.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials,createStaticShadowProxy} from './materials.js';
import {buildShip,positionX,positionY,HABITAT_VIEW} from './ship.js';
import {createMilo,animateMilo} from './characters.js';
import {loadCabinLucy as loadLucy,createCabinLucy as createLucy,animateCabinLucy as animateLucy,disposeCabinLucy as disposeLucy} from './lucy-cabin.js';
import {currentAction} from './state.js';
import {animatePlants} from './plants.js';
import {createHarvestDelivery} from './harvest-delivery.js';
import {loadMiloHead} from './head.js';
import {animateDelivery} from './delivery.js';
import {animateBathroom} from './bathroom.js';
import {animateCatPorts} from './cat-ports.js';
import {animateGym,BIKE} from './gym.js';
import {CAT_PORT,CAT_SOFA,LOUNGE_SEAT,CABIN_AISLE,FLOORS,getStation} from './layout.js';
import {animateAirlock,animateHatchFault} from './eva.js';
import {loadEVAGarment} from './eva-garment.js';
import {loadMiloBody} from './milo-body.js';
import {animateMedical,medicalExitTime,medicalReadings} from './medical.js';
import {BUNK_BED,reclineProgress,reclineExitProgress} from './recline.js';
import {animateBunk} from './bunk.js';
import {BUNK_PHASE_SECONDS} from './bunk-visit.js';
import {diningPhase,diningApproach} from './dining.js';
import {loungeExitPose,loungeEntryAge} from './lounge-exit.js';
import {applyCabinLadder,updateCabinClimb} from './cabin-ladder.js';
import {crewWalkway} from './cabin-walkway.js';
import {updateTableLeisureProps} from './lounge-table-props.js';
import {createLucyToon} from './lucy-toon.js';
import {createLucyRunRig} from './lucy-run-rig.js';
import {createCabinMouse} from './mouse.js';
import {createMiloToon} from './milo-toon.js';
import {createCabinToon} from './cabin-toon.js';
import {createCabinSignage} from './cabin-signage.js';
import {finishCabinFixtures} from './cabin-fixtures.js';
import {updateMiloBandage} from './milo-bandage.js';
import {createDroidChargingBay,DROID_DOCK} from './droid-charging.js';
import {createDroidServiceRig} from './droid-service.js';
import {CabinStartupLighting} from './startup-lighting.js';
import {createCabinMirror,isMiloMirrorView} from './cabin-mirror.js';
import {attachHairGrowth} from './hair-growth.js';
import {createGroomingTools,prepareGroomingMotion} from './grooming.js';
import {createMachinedMetals} from './machined-metals.js';
import {CharacterCamera} from './character-camera.js';
import {createMetalDeckStyle} from './metal-deck.js';
import {createCutawayStars} from './space-stars.js';

export class ObservationView {
  static async create(canvas,{cabinStyle='cartoon',floorBuilder,characterViews=false,deferGroomCache=false}={}){
    const [m,head,lucy]=await Promise.all([materials(),loadMiloHead(),loadLucy({deferGroomCache}),loadEVAGarment(),loadMiloBody()]);
    head.userData.setAppearance({hair:'crop',beard:'none'});
    const deckStyle=floorBuilder?null:createMetalDeckStyle();
    const view=new ObservationView(canvas,m,head,lucy,{floorBuilder:floorBuilder??deckStyle.buildFloor});
    view.deckStyle=deckStyle;
    try{
      finishCabinFixtures(view);
      const roots=[view.ship.staticMesh,view.ship.animated,view.droidBay.root,view.droidService.root,view.harvestDelivery.root];
      view.cabinSignage=await createCabinSignage(roots);
      view.cabinToon=createCabinToon(roots);
      view.cabinToon.setStyle(cabinStyle);
      // Practical lighting also exists in studies that don't replay startup.
      view.startupLighting=new CabinStartupLighting([...roots,view.milo,view.cat,view.mouse.root],{reducedMotion:view.reducedMotion,start:false});
      if(characterViews)view.characterCamera=new CharacterCamera(view);
      return view;
    }catch(error){view.dispose();throw error;}
  }
  constructor(canvas,m,head,lucy,{floorBuilder}={}){
    this.canvas=canvas;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x090d0f);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true,powerPreference:'high-performance'});
    this.renderer.localClippingEnabled=true;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,CABIN_PIXEL_RATIO));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=CABIN_AMBIENCE.exposure;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const pmrem=new THREE.PMREMGenerator(this.renderer),environment=new RoomEnvironment();
    this.envTarget=pmrem.fromScene(environment,.04);this.scene.environment=this.envTarget.texture;environment.dispose();pmrem.dispose();
    Object.values(m).forEach(mat=>{if(mat.isMeshStandardMaterial)mat.envMapIntensity=CABIN_AMBIENCE.environment;});
    this.scene.add(new THREE.HemisphereLight(CABIN_AMBIENCE.sky,CABIN_AMBIENCE.ground,CABIN_AMBIENCE.ambient));
    const key=new THREE.DirectionalLight(CABIN_AMBIENCE.key,CABIN_AMBIENCE.keyPower);key.position.set(-5,12,15);key.castShadow=true;key.shadow.mapSize.set(CABIN_SHADOW_SIZE,CABIN_SHADOW_SIZE);Object.assign(key.shadow.camera,{left:-16,right:16,top:11,bottom:-10,near:.1,far:60});key.shadow.bias=-.0001;key.shadow.normalBias=.024;key.target.position.set(0,5,0);this.scene.add(key,key.target);
    const fill=new THREE.DirectionalLight(CABIN_AMBIENCE.fill,CABIN_AMBIENCE.fillPower);fill.position.set(12,7,9);this.scene.add(fill);
    this.ship=buildShip(m,{floorBuilder});limitCabinLights(this.ship.animated);this.scene.add(this.ship.staticMesh,this.ship.animated);
    this.shadowProxy=createStaticShadowProxy(this.ship.staticMesh);if(this.shadowProxy)this.scene.add(this.shadowProxy);
    this.droidBay=createDroidChargingBay(positionY(FLOORS[DROID_DOCK.floor].y));this.scene.add(this.droidBay.root);
    this.droidService=createDroidServiceRig(this.droidBay,this.ship);this.scene.add(this.droidService.root);
    // Preserve the powered-down pose until the live routine is attached.
    this.droidService.actorRoot.position.copy(this.droidBay.root.position);
    this.hairGrowth=attachHairGrowth(head);this.hairGrowth.setGrowth(0);
    this.milo=createMilo(m,head);this.cat=createLucy(lucy);this.scene.add(this.milo,this.cat);
    this.catRun=createLucyRunRig(this.cat);this.mouse=createCabinMouse({clipAtStudyWalls:false});this.mouse.root.visible=false;this.scene.add(this.mouse.root);
    this.harvestDelivery=createHarvestDelivery(m,this.scene);
    this.groomingTools=createGroomingTools(this.milo.userData.body,m,createMachinedMetals());
    this.groomingMotion=prepareGroomingMotion(this.milo,this.ship.groomingStation,this.groomingTools,{origin:this.ship.groomingStation.origin});
    this.characterToon=[createMiloToon(this.milo),createLucyToon(this.cat)];
    for(const tool of Object.values(this.groomingTools)){
      tool.visible=false;
      tool.traverse(part=>{if(part.material?.anisotropy>0)part.material.defines.USE_UV='';});
    }
    this.groomingMirror=createCabinMirror({room:this.ship.groomingStation.mirrorRoom});
    this.restingMirror=new THREE.Mesh(new THREE.PlaneGeometry(.72,.89),new THREE.MeshStandardMaterial({color:0xa8b5b5,metalness:1,roughness:.08}));
    this.restingMirror.material.userData.cabinKeepSurface=true;
    this.ship.groomingStation.mirror.add(this.groomingMirror,this.restingMirror);
    this.camera=new THREE.PerspectiveCamera(24,1,.1,150);
    this.mode='all';this.zoom=1;this.center=new THREE.Vector3(0,HABITAT_VIEW.centerY,0);this.targetCenter=this.center.clone();this.viewHeight=15;this.targetHeight=15;
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.onStation=null;this.onModeChange=null;this.feedback=null;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=()=>{if(this.renderer.xr.isPresenting)return;const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.zoomAnchor=null;this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);this.fitHeight=Math.max(HABITAT_VIEW.minHeight,29.4/(r.width/r.height));if(this.mode==='all')this.targetHeight=this.fitHeight/this.zoom;this.setFrustum();};
    this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);this.resize();this.viewHeight=this.targetHeight;this.setFrustum();
    this.listeners=[];this.bindControls();
    this.scene.add(createCutawayStars());
    limitShadowCasters(this.scene);
  }
  bind(type,fn,options){this.canvas.addEventListener(type,fn,options);this.listeners.push([type,fn,options]);}
  // Compile every program in parallel behind the loading screen; three's
  // compileAsync polls KHR_parallel_shader_compile so the page stays live.
  // compile() has two gaps covered here: it uses whatever clipping state the
  // last draw left, and it never prepares the shadow pass. A throwaway 1x1
  // draw sets the clipping state for each plane count before the materials
  // with that count compile, and probe meshes prepare the shadow-pass depth
  // variants. Every compile starts synchronously; all are awaited together.
  async compilePrograms(){
    const {renderer,scene,camera}=this;
    const planeCount=material=>Math.max(...(Array.isArray(material)?material:[material]).map(m=>m?.clipIntersection?0:(m?.clippingPlanes?.length||0)));
    const group=(map,key,value)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(value);};
    const clipped=new Map(),depth=new Map();
    scene.traverse(object=>{if(object.material){const count=planeCount(object.material);if(count)group(clipped,count,object);}});
    // The characters toggle eyelids, eyes and tools per frame, so all of their
    // parts count as shadow casters; elsewhere only visible casters do.
    const characters=new Set([this.milo,this.cat].filter(Boolean));
    const underCharacter=object=>{for(let o=object;o;o=o.parent)if(characters.has(o))return true;return false;};
    const casting=object=>{if(underCharacter(object))return true;for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;};
    for(const probe of this.shadowDepthProbes(casting))group(depth,probe.userData.clippingCount,probe);
    const target=new THREE.WebGLRenderTarget(1,1),pending=[];
    for(const count of new Set([0,...clipped.keys(),...depth.keys()])){
      this.primeClipping(count,target);
      // The shadow pass renders into a target, which is part of the program key.
      for(const probe of depth.get(count)??[])pending.push(renderer.compileAsync(probe,camera,scene));
      renderer.setRenderTarget(null);
      if(count){for(const object of clipped.get(count)??[])pending.push(renderer.compileAsync(object,camera,scene));continue;}
      // Clipped materials would compile here with no planes; leave them to their own pass.
      const stash=new Map();
      for(const object of [...clipped.values()].flat()){stash.set(object,object.material);object.material=undefined;}
      try{pending.push(renderer.compileAsync(scene,camera));}
      finally{for(const [object,material] of stash)object.material=material;}
    }
    target.dispose();
    // Keep the probes' depth materials until dispose(): they hold the programs
    // for casters that only appear later (eyelids, grooming tools).
    this.depthProbeMaterials=[...depth.values()].flat().filter(probe=>probe.userData.ownsMaterial).map(probe=>probe.material);
    await Promise.all(pending);
  }
  primeClipping(count,target){
    const planes=count?Array.from({length:count},()=>new THREE.Plane()):null;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({clippingPlanes:planes}));
    mesh.frustumCulled=false;
    this.renderer.setRenderTarget(target);this.renderer.render(new THREE.Scene().add(mesh),this.camera);
    mesh.geometry.dispose();mesh.material.dispose();
  }
  // Mirror WebGLShadowMap.getDepthMaterial: one detached probe per distinct
  // depth program the first shadow pass will build (custom depth materials,
  // and the shared depth material's side / alpha / clipping / rig variants).
  shadowDepthProbes(visible){
    const {renderer,scene}=this,probes=[],seen=new Set();
    const shadowSide={[THREE.FrontSide]:THREE.BackSide,[THREE.BackSide]:THREE.FrontSide,[THREE.DoubleSide]:THREE.DoubleSide};
    scene.traverse(object=>{
      if(!object.isMesh||!object.castShadow||!visible(object)||Array.isArray(object.material))return;
      const material=object.material,geometry=object.geometry;
      const clippingCount=renderer.localClippingEnabled&&material.clipShadows===true&&Array.isArray(material.clippingPlanes)&&material.clippingPlanes.length?material.clippingPlanes.length:0;
      const rig=[!!object.isSkinnedMesh,!!object.isInstancedMesh,geometry.morphAttributes.position?.length??0,geometry.morphAttributes.normal?.length??0,geometry.morphAttributes.color?.length??0].join('|');
      let depthMaterial,key;
      if(object.customDepthMaterial){depthMaterial=object.customDepthMaterial;key=`custom|${depthMaterial.uuid}|${rig}`;}
      else{
        key=[material.shadowSide??shadowSide[material.side],!!material.map,material.map?.channel??0,!!material.alphaMap,material.alphaMap?.channel??0,material.alphaTest>0,!!material.displacementMap&&material.displacementScale!==0,clippingCount,!!material.clipIntersection,rig].join('|');
        if(seen.has(key))return;
        depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
      }
      if(seen.has(key))return;
      seen.add(key);
      // The shadow pass copies these onto its depth material every frame,
      // custom ones included; the program key depends on them.
      depthMaterial.side=material.shadowSide??shadowSide[material.side];
      depthMaterial.alphaMap=material.alphaMap;depthMaterial.alphaTest=material.alphaTest;depthMaterial.map=material.map;
      depthMaterial.displacementMap=material.displacementMap;depthMaterial.displacementScale=material.displacementScale;depthMaterial.displacementBias=material.displacementBias;
      depthMaterial.clipShadows=material.clipShadows;depthMaterial.clippingPlanes=material.clippingPlanes;depthMaterial.clipIntersection=material.clipIntersection;
      const probe=object.isSkinnedMesh?new THREE.SkinnedMesh(geometry,depthMaterial):object.isInstancedMesh?new THREE.InstancedMesh(geometry,depthMaterial,1):new THREE.Mesh(geometry,depthMaterial);
      if(object.isSkinnedMesh)probe.bind(object.skeleton,object.bindMatrix);
      probe.userData.clippingCount=clippingCount;probe.userData.ownsMaterial=!object.customDepthMaterial;
      probes.push(probe);
    });
    return probes;
  }
  startLighting({waitForActivation=false}={}){
    if(this.startupLighting){this.startupLighting.restart(this.reducedMotion,{waitForActivation});return;}
    this.startupLighting=new CabinStartupLighting([this.ship.staticMesh,this.ship.animated,this.droidBay.root,this.droidService.root,this.harvestDelivery.root,this.milo,this.cat,this.mouse.root],{reducedMotion:this.reducedMotion,waitForActivation});
  }
  targetAt(event){
    const rect=this.canvas.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    const target=this.targetFromRay(this.raycaster);
    return target?{type:target.type,id:target.id}:null;
  }
  targetFromRay(raycaster){
    // Station hit volumes extend in front of furniture, so visible characters win.
    const droid=this.droidBay?.droid?.root,characters=[this.milo,this.cat];if(droid)characters.push(droid);
    for(const hit of raycaster.intersectObjects(characters,true)){
      if(!hit.object.isMesh)continue;
      let node=hit.object,visible=true,id=null;
      while(node){if(!node.visible){visible=false;break;}if(node===this.milo)id='milo';if(node===this.cat)id='cat';if(node===droid)id='droid';node=node.parent;}
      if(visible&&id){if(id==='cat'&&hit.point.z<CAT_PORT.wallZ)continue;return{type:'character',id,point:hit.point,distance:hit.distance};}
    }
    const hit=raycaster.intersectObjects(this.ship.targets)[0],id=hit?.object.userData.station;
    return id?{type:'station',id,point:hit.point,distance:hit.distance}:null;
  }
  hover(id){if(this.feedback)this.feedback.hovered=id;this.canvas.style.cursor=id?'pointer':'grab';}
  hoverTarget(target){this.hover(target?.type==='station'?target.id:null);if(target?.type==='character')this.canvas.style.cursor='zoom-in';}
  bindControls(){
    let drag=null;
    this.bind('pointerdown',e=>{if(this.characterCamera?.pointerDown(e))return;if(e.button!==0||e.isPrimary===false||drag)return;this.zoomAnchor=null;drag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,cx:this.targetCenter.x,cy:this.targetCenter.y,target:this.targetAt(e),moved:false};this.canvas.setPointerCapture(e.pointerId);});
    this.bind('pointermove',e=>{if(this.characterCamera?.pointerMove(e))return;if(!drag){this.hoverTarget(this.targetAt(e));return;}if(e.pointerId!==drag.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){this.hover(null);this.canvas.style.cursor='grabbing';if(this.mode!=='manual'){this.mode='manual';this.characterCamera?.select('manual');this.onModeChange?.(this.mode);}this.targetCenter.x=THREE.MathUtils.clamp(drag.cx-dx*this.viewHeight/this.height,-13,13);this.targetCenter.y=THREE.MathUtils.clamp(drag.cy+dy*this.viewHeight/this.height,HABITAT_VIEW.panMinY,HABITAT_VIEW.panMaxY);}});
    // The first dark-scene tap powers the lights, not a station order with a
    // pitched acknowledgement. Clear drag normally so subsequent taps work.
    this.bind('pointerup',e=>{if(this.characterCamera?.pointerEnd(e))return;if(!drag||e.pointerId!==drag.pointerId)return;const {target,moved}=drag;drag=null;this.hover(null);if(moved||!target)return;if(target.type==='character')this.setMode(target.id);else if(!this.startupLighting?.waiting)this.onStation?.(target.id);});
    this.bind('pointercancel',e=>{this.characterCamera?.pointerEnd(e);if(drag&&e.pointerId!==drag.pointerId)return;drag=null;this.hover(null);});
    this.bind('lostpointercapture',e=>{this.characterCamera?.pointerEnd(e);if(drag&&e.pointerId!==drag.pointerId)return;drag=null;this.hover(null);});
    this.bind('pointerleave',()=>this.hover(null));
    this.bind('wheel',e=>{if(e.deltaY===0)return;e.preventDefault();this.changeZoom(e.deltaY<0?1.15:1/1.15,e);},{passive:false});
  }
  setMode(mode){this.hover(null);this.zoomAnchor=null;this.mode=mode;this.characterCamera?.select(mode);this.zoom=['milo','cat','droid'].includes(mode)?1.3:1;this.targetHeight=(mode==='all'?this.fitHeight:mode==='cat'?3.3:mode==='droid'?3.5:5.3)/this.zoom;if(mode==='all')this.targetCenter.set(0,HABITAT_VIEW.centerY,0);this.onModeChange?.(mode);}
  miloHeadScreenPosition(){
    if(!this.milo.visible)return null;
    // The head origin is at the neck; add the crown height in world units so
    // the scanned head's own import scale does not shrink the popup offset.
    const point=this.milo.userData.head.getWorldPosition(new THREE.Vector3());
    point.y+=.26;point.project(this.camera);
    return{x:(point.x+1)*this.width/2,y:(1-point.y)*this.height/2,z:point.z};
  }
  changeZoom(ratio,pointer=null){
    if(this.characterCamera?.active)return;
    if(this.characterCamera?.available&&this.characterCamera.angle!=='front')pointer=null;
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
      if(this.mode!=='manual'){this.mode='manual';this.characterCamera?.select('manual');this.onModeChange?.(this.mode);}
    }else this.zoomAnchor=null;
    const base=this.mode==='all'||this.mode==='manual'?this.fitHeight:this.mode==='cat'?3.3:this.mode==='droid'?3.5:5.3;
    this.targetHeight=height;this.zoom=base/height;
  }
  setFrustum(){
    // WebXR supplies a projection and pose for each eye; desktop following must
    // never overwrite the headset pose or the XR rig's locomotion/following.
    if(this.immersive?.active)return;
    if(this.characterCamera?.applyCamera())return;
    this.camera.near=.1;this.camera.up.set(0,1,0);
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
  render(dt,time,actor,brain,catRoutine,care,paused=false,airlock=null,xrFrame=null){
    this.characterCamera?.restorePose();
    this.ship.consoleScreens?.update({brain,care,airlock,droid:this.droidRoutine,clock:time});
    this.ship.aiSupervision?.update({actor,brain,catRoutine,care,airlock,droid:this.droidRoutine,clock:time});
    const action=brain.harvestDelivery&&!actor.busy?'plant':currentAction(brain),catMotion=catRoutine.motion;
    const actionTime=brain.reclineExit?.actionTime??brain.loungeStow?.actionTime??brain.loungeExit?.actionTime??(brain.loungeEntry?0:brain.state==='performing'?brain.curDurSec-brain.performT:time);
    animateGym(this.ship.gym,brain.gymVisit?.pedalTime??brain.gymPedalTime??0);
    animateBunk(this.ship.bunk,brain.bunkVisit?.pose);
    if(brain.plants)animatePlants(this.ship.plants,brain.plants,time);
    const walkway=crewWalkway(positionX(actor.x),actor.floor,actor.facing);
    this.milo.position.set(positionX(actor.x),positionY(actor.y),walkway.z);
    const climb=actor.climbing?actor.queue[0]:null,nextX=actor.queue[1]?.x??actor.x;
    this.cabinClimb=updateCabinClimb(this.cabinClimb,climb?{
      height:positionY(actor.y),startHeight:positionY(FLOORS[actor.floor].y),startYaw:this.milo.rotation.y,startDepth:walkway.z,
      endHeight:positionY(climb.y),endYaw:(Math.sign(nextX-actor.x)||actor.facing)*Math.PI/2,endDepth:crewWalkway(0,climb.floor).z,
    }:null);
    const bathroom=brain.bathroom?.pose;
    if(action==='plant'&&!brain.harvestDelivery)this.milo.position.z=.78-.76*THREE.MathUtils.smoothstep(Math.min(actionTime,brain.curDurSec-actionTime),0,1.2);
    if(['galley','hydro'].includes(action))this.milo.position.z=CABIN_AISLE.crewZ-diningApproach(action)*diningPhase(actionTime,brain.curDurSec).approach;
    if(action==='gym')this.milo.position.z=brain.gymVisit?.pose.depth??BIKE.depth;
    if(brain.gymVisit)brain.gymVisit.startYaw??=this.milo.rotation.y;
    if(brain.bunkVisit)brain.bunkVisit.startYaw??=this.milo.rotation.y;
    if(action==='lounge'&&!actor.busy){
      if(brain.loungeEntry)brain.loungeEntry.startYaw??=this.milo.rotation.y;
      const passage=brain.loungeEntry?loungeExitPose(loungeEntryAge(brain.loungeEntry.age)):brain.loungeExit?loungeExitPose(brain.loungeExit.age):{x:0,depth:LOUNGE_SEAT.depth};
      this.milo.position.x=positionX(getStation('lounge').x)+passage.x;this.milo.position.z=passage.depth;
    }
    if(!brain.grooming)animateMilo(this.milo,{moving:actor.busy&&!actor.climbing,waiting:actor.waitingForHatch||actor.waitingForCat||actor.waitingForDroid,climbing:false,facing:actor.facing,walkYaw:walkway.yaw,walkDistance:positionX(actor.walkDistance)-positionX(0),action,time,shipHour:brain.hour,dt:paused?0:dt,actionTime,actionDuration:brain.curDurSec,callingTime:brain.state==='knocking'?brain.knockT:null,health:brain.health,bathroom,diningDocks:this.ship.diningDocks[action],leisure:brain.loungeStow?.leisure??brain.loungeExit?.leisure??(brain.state==='performing'||brain.loungeEntry?brain.leisure:null),catReady:catRoutine.mode==='play',loungeDocks:this.ship.loungeProps,loungeStow:brain.loungeStow,loungeExit:brain.loungeExit,gymVisit:brain.gymVisit,loungeEntry:brain.loungeEntry,reclineExit:brain.reclineExit,bunkVisit:brain.bunkVisit,smokingVisit:brain.smokingVisit,hatchRepair:brain.hatchRepair});
    if(this.cabinClimb)applyCabinLadder(this.milo,this.cabinClimb);
    this.harvestDelivery.update(this.milo,brain);
    for(const [id,fixture]of Object.entries(this.ship.bathrooms)){
      const cleaning=this.droidRoutine?.door===id?{opening:this.droidRoutine.opening,inside:false}:null;
      animateBathroom(fixture,brain.bathroom?.id===id?bathroom:cleaning,paused?0:dt);
    }
    animateCatPorts(this.ship.catPorts,catMotion.portal);
    for(const [id,docks]of Object.entries(this.ship.diningDocks)){
      docks.mug.visible=id==='hydro'&&action!==id;
      docks.bowl.visible=id==='galley'&&action!==id;docks.spoon.visible=docks.bowl.visible;
      docks.meal.visible=care.has('food');
    }
    const treating=Boolean(brain.health.treatment);
    const medicalTime=brain.reclineExit?.id==='medical'?medicalExitTime(brain.reclineExit):actionTime;
    animateMedical(this.ship.medical,medicalTime,action==='medical',action==='medical'?(treating?medicalReadings(brain.needs,brain.health):brain.medicalSample):brain.lastMedicalReport,{duration:brain.curDurSec,treating,alert:brain.health.needsCare,patient:this.milo,scanTime:brain.reclineExit?.id==='medical'?brain.reclineExit.actionTime:medicalTime});
    if(airlock)animateAirlock(this.ship.innerDoor,this.ship.innerSignal,airlock.opening);
    animateHatchFault(this.ship.innerSignal,brain.environment,{opening:airlock?.opening??0});
    const turn=catMotion.turnPose,passage=catMotion.passagePose,catMoving=!turn&&!catMotion.waitingForCrew&&!catMotion.waitingForDroid&&(catMotion.chase?catMotion.chase.speed>.03:passage?['enter','exit'].includes(passage.phase):catMotion.busy);
    const hop=catMotion.hop&&!turn?{...catMotion.hop,yaw:Math.atan2((positionX(CAT_SOFA.seatX)-positionX(CAT_SOFA.floorX))*(catMotion.hop.up?1:-1),(LOUNGE_SEAT.centerDepth-CAT_SOFA.approachZ)*(catMotion.hop.up?1:-1))}:null;
    this.cat.position.set(positionX(catMotion.x),positionY(catMotion.y)+catMotion.elevation,catMotion.z);this.cat.visible=!catMotion.hidden;
    const wakeHop=catRoutine.bunkHop;
    const wake=catRoutine.bunkWake?.visit;
    if(wake&&['sleeping','waking','leaving'].includes(wake.phase)){
      const floorY=positionY(FLOORS[getStation('bunk').floor].y),bedX=positionX(getStation('bunk').x+24),bedZ=BUNK_BED.depth+.26;
      if(wake.phase==='leaving'){
        const u=THREE.MathUtils.clamp(wake.age/BUNK_PHASE_SECONDS.leaving,0,1),s=u*u*(3-2*u);
        this.cat.position.set(bedX,floorY+THREE.MathUtils.lerp(BUNK_BED.top,0,s)+Math.sin(Math.PI*u)*.32,THREE.MathUtils.lerp(bedZ,CAT_PORT.walkZ,s));
      }else this.cat.position.set(bedX,floorY+BUNK_BED.top,bedZ);
    }
    animateLucy(this.cat,{time,dt:paused?0:dt,moving:catMoving,facing:catMotion.facing,yaw:catRoutine.poseYaw,headingControlled:catMotion.turns,mode:catRoutine.mode,walkDistance:positionX(catMotion.walkDistance)-positionX(0)+catMotion.portalWalkDistance+catMotion.depthWalkDistance,passage,hop:wakeHop??hop,turn,actionTime:catRoutine.modeTime,remaining:catRoutine.remaining,playRelease:catRoutine.playRelease});
    const pursuit=catRoutine.mouseChase,run=pursuit?.pose,mouse=pursuit?.mouse;
    if(!paused&&run&&run.speed>.45)this.catRun.update({distance:run.distance,speed:run.speed});
    this.mouse.root.visible=Boolean(mouse?.visible);
    if(mouse?.visible){
      this.mouse.root.position.set(mouse.x,positionY(FLOORS[mouse.floor].y),mouse.z);this.mouse.root.rotation.y=mouse.yaw;
      this.mouse.update(mouse);
    }
    if(action==='bunk')this.milo.position.z=THREE.MathUtils.lerp(.78,BUNK_BED.depth,reclineProgress(actionTime,brain.curDurSec,BUNK_BED.transition));
    if(brain.reclineExit?.id==='bunk')this.milo.position.z=THREE.MathUtils.lerp(.78,BUNK_BED.depth,reclineExitProgress(brain.reclineExit));
    if(brain.bunkVisit)this.milo.position.z=brain.bunkVisit.pose.depth;
    updateTableLeisureProps(this.ship.loungeProps,this.milo.userData.leisure);
    const grooming=brain.grooming;
    if(grooming){
      if(grooming.startYaw===null){grooming.startYaw=this.milo.rotation.y;this.groomingMotion.beginVisit();}
      const pose=grooming.pose;
      this.groomingMotion.update(grooming.time,{...pose,health:brain.health});this.hairGrowth.setGrowth(pose.hair,pose.beard);
    }else this.hairGrowth.setGrowth(brain.hairGrowth?.progress??0);
    for(const tool of Object.values(this.groomingTools))tool.visible=Boolean(grooming);
    // The mirror is useful only through Milo's eyes; other cameras and XR
    // keep the inexpensive metal surface. Offscreen reflections are culled.
    this.groomingMirror.visible=isMiloMirrorView(this.characterCamera,this.renderer.xr.isPresenting);
    this.restingMirror.visible=!this.groomingMirror.visible;
    if(!paused)this.ship.fan.rotation.z+=dt*3.0;
    animateDelivery(this.ship,care,this.reducedMotion);
    this.ship.foodGroup.visible=(this.droidRoutine?care.catBowl>0:care.has('catfood'))||catRoutine.mode==='eat';
    if(this.droidRoutine)this.droidService.update(this.droidRoutine);
    for(const [id,{group,material}]of Object.entries(this.ship.indicators)){
      const shipment=id==='hatch'&&care.delivery&&!['queued','transmitting'].includes(care.phase);
      const signal=shipment?{color:care.phase==='unloading'?0x85e3af:0xf3bd62,intensity:this.reducedMotion?1:.75+.25*Math.sin(time*3)}:this.feedback?.signal(id,this.reducedMotion)||(id==='gym'&&action==='gym'?{color:0x85e3af,intensity:1}:null);group.visible=Boolean(signal);
      if(signal){material.color.setHex(signal.color);material.opacity=signal.intensity;}
    }
    if(this.mode==='milo')this.targetCenter.copy(this.milo.position).add(new THREE.Vector3(0,.9,0));
    if(this.mode==='cat')this.targetCenter.copy(this.cat.position).add(new THREE.Vector3(0,.37*this.cat.scale.y,0));
    if(this.mode==='droid')this.targetCenter.copy(this.droidService.actorRoot.position).add(new THREE.Vector3(0,.9,0));
    const lerp=1-Math.exp(-dt*5);this.center.lerp(this.targetCenter,lerp);this.viewHeight=THREE.MathUtils.lerp(this.viewHeight,this.targetHeight,lerp);
    this.characterCamera?.update(dt,{actor,brain,catRoutine});this.setFrustum();
    // Late ladder/medical fitting must reach the bandage before GPU upload.
    updateMiloBandage(this.milo);
    this.immersive?.update(dt,xrFrame);
    const eye=this.renderer.xr.isPresenting?this.renderer.xr.getCamera().cameras[0]?.viewport:null;
    const width=eye?.z||this.width,height=eye?.w||this.height;
    this.characterToon.forEach(toon=>toon.update(width,height));
    this.cabinToon?.update(width,height,this.viewHeight,this.fitHeight);
    const quality=this.immersive?.active?this.immersive.quality:null;
    quality?.beginFrame(this.mode);
    try{this.renderer.render(this.scene,this.camera);}
    finally{quality?.endFrame();}
  }
  dispose(){this.depthProbeMaterials?.forEach(material=>material.dispose());this.shadowProxy?.geometry.dispose();this.shadowProxy?.material.dispose();this.characterCamera?.dispose();this.catRun?.dispose();this.startupLighting?.dispose();this.renderer.setAnimationLoop(null);this.groomingMotion?.dispose();this.groomingMirror?.dispose();this.immersive?.dispose();this.cabinToon?.dispose();this.cabinSignage?.dispose();this.characterToon.forEach(toon=>toon.dispose());this.milo.userData.bodySkin?.skeleton.dispose();disposeLucy(this.cat);this.observer.disconnect();this.listeners.forEach(([type,fn,options])=>this.canvas.removeEventListener(type,fn,options));const geometries=new Set(),mats=new Set(),textures=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});for(const fit of [this.milo.userData.tabletHandFit,this.milo.userData.ladderHandFit])if(fit){geometries.add(fit.original);geometries.add(fit.geometry);if(fit.watch){geometries.add(fit.watch.original);geometries.add(fit.watch.geometry);}}mats.forEach(m=>Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);}));geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.envTarget.dispose();this.renderer.dispose();}
}
