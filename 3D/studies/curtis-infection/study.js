import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createCurtis} from '../../../obs/src/obs/curtis-model.js';
import {createMonsterArm} from './monster-arm.js';
import {updateMiloNeck} from '../../../obs/src/obs/milo-neck.js';
import {prepareFloorPose} from './floor-pose.js';
import {createFullBodyInfection} from './full-body.js';
import {knuckleWalk} from './gait.js';
import {createInjuryBandage} from './injury-bandage.js';

const $=id=>document.getElementById(id);
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
const canvas=document.querySelector('canvas'),viewport=document.querySelector('.viewport');
const scene=new THREE.Scene();scene.background=new THREE.Color('#1d292d');
const camera=new THREE.PerspectiveCamera(36,1,.02,60);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const controls=new OrbitControls(camera,canvas);controls.minDistance=.5;controls.maxDistance=9;controls.enableDamping=true;
const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(room,.04);
scene.environment=env.texture;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight('#d9e8ec','#41423b',2.0));
for(const [color,intensity,pos] of [['#ffe3bf',3.0,[2,4,4]],['#b4d9ed',2.0,[-3,3,0]],['#c5cfc6',1,[0,3,-3]]]){
  const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);scene.add(light);
  if(pos[0]===2){
    light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.normalBias=.005;
    Object.assign(light.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.1,far:10});
  }
}
const floor=new THREE.Mesh(new THREE.CircleGeometry(3,96),new THREE.MeshStandardMaterial({color:'#243236',roughness:.92}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.008;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(6,30,'#405054','#304044');grid.position.y=-.006;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);

let phase=2,playing=false,walking=false,walkTime=0,lastWalkFrame=0,last=0,root,arm,rest,monster,bandage,floorPose,fullBody,uniform={value:1},currentView='front';
function resize(){const {width,height}=viewport.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();view(currentView);}
const observer=new ResizeObserver(resize);observer.observe(viewport);resize();
function view(name='front'){
  currentView=name;
  const target=new THREE.Vector3(-.18,.78,.22);
  const offsets={front:[1.8,1.25,4.3],side:[-4.7,.5,.6],back:[-.7,.8,-4.9],arm:[-.5,.3,.8],face:[-.35,.12,1.25],feet:[-.8,.8,2]};
  if(name==='arm'){
    if(arm){root.updateMatrixWorld(true);arm.elbow.getWorldPosition(target);target.lerp(arm.hand.getWorldPosition(new THREE.Vector3()),.55);}
    else target.set(-.30,.48,.48);
  }
  if(name==='feet')target.set(0,.16,.12);
  if(name==='face'){
    if(root){root.updateMatrixWorld(true);root.userData.head.getWorldPosition(target);target.y+=.07;target.z+=.11;}
    else target.set(-.06,1.05,.65);
  }
  const offset=new THREE.Vector3(...offsets[name]);
  const width=name==='face'?.72:name==='feet'?1.03:name==='arm'?.70+smooth(.2,1,phase)*.45:2.25;
  const fitDistance=width/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect);
  offset.setLength(Math.max(offset.length(),fitDistance));
  controls.target.copy(target);camera.position.copy(target).add(offset);controls.update();
}
view();

// Add a local surface treatment after Curtis's existing skin and clothing shader.
// The bind-space mask excludes the torso, face, right arm and shirt sleeve.
function infectionMaterial(skin){
  const mat=skin.material,original=mat.onBeforeCompile;
  mat.onBeforeCompile=function(shader,...args){
    original.call(this,shader,...args);shader.uniforms.infection=uniform;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float infection;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float affected=smoothstep(.88,.98,armRegion)*(1.-smoothstep(-.12,-.06,position.x))*(1.-smoothstep(1.19,1.28,position.y));
      float ridges=pow(.5+.5*sin(position.y*92.+position.z*76.+sin(position.y*31.)*1.2),5.);
      transformed+=normal*affected*infection*(.007*ridges+.002*sin(position.y*43.+position.z*37.));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float infection;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float affected=smoothstep(.88,.98,vArmRegion)*(1.-smoothstep(-.12,-.06,vBodyPosition.x))*(1.-smoothstep(1.19,1.28,vBodyPosition.y));
      float vein=1.-smoothstep(.02,.18,abs(sin(vBodyPosition.y*48.+vBodyPosition.z*77.+sin(vBodyPosition.y*25.+vBodyPosition.x*57.)*1.4)));
      float mottling=.5+.5*sin(vBodyPosition.y*37.)*sin(vBodyPosition.z*90.+vBodyPosition.x*61.);
      vec3 altered=mix(vec3(.055,.068,.043),vec3(.012,.021,.016),vein*.8+mottling*.16);
      diffuseColor.rgb=mix(diffuseColor.rgb,altered,affected*infection*.85);
      roughnessFactor=mix(roughnessFactor,.52,affected*infection);
    `);
  };
  mat.customProgramCacheKey=()=> 'curtis-infection-study-v1';mat.needsUpdate=true;
}

function apply(){
  if(!root)return;
  // Always restore the same rest pose: scrubbing backwards must undo every change.
  for(const [object,p,q,s] of rest){object.position.copy(p);object.quaternion.copy(q);object.scale.copy(s);}
  const extension=smooth(.18,.95,phase),claw=smooth(.48,1,phase),reach=$('pose').value==='reach';
  const ground=$('pose').value==='ground'?smooth(.2,.85,phase):0;
  uniform.value=$('surface').checked?smooth(0,.8,phase):0;
  arm.arm.rotation.set(reach?-.95:-.25,0,reach?-.72:-.42);
  // Relocate the elbow itself: upper arm grows, and the hinge shifts out/back.
  // Hand offset below is relative to this NEW elbow, not the original pivot.
  arm.elbow.position.add(new THREE.Vector3(-.045*extension,-.13*extension,-.045*extension));
  arm.elbow.rotation.set(reach?-.5:-.85+extension*.2,extension*.12,-extension*.17);
  // Move the wrist through the existing weighted skin instead of stretching
  // its parent scale, which shears the palm at the mixed wrist/finger weights.
  arm.hand.position.y-=extension*.28;
  const handRest=rest.find(([obj])=>obj===arm.hand)[3];
  arm.hand.scale.copy(handRest).multiply(new THREE.Vector3(1+claw*.32,1+claw*.25,1+claw*.28));
  arm.hand.rotation.x=-claw*.30;arm.hand.rotation.z=claw*.13;
  arm.fingers.forEach((finger,i)=>{
    const length=claw*(1+[.1,.4,.25,0][i]);
    finger.rotation.x=-.08-claw*.12;finger.rotation.z=(i-1.5)*(.025+claw*.06);
    finger.userData.links.forEach((link,j)=>{
      link.position.y-=(j?.012:.018)*length;
      link.rotation.x=j?.03+claw*.65:.28+claw*.5;
    });
  });
  arm.thumb.scale.y=1+claw*.25;arm.thumb.rotation.z=-claw*.3;
  const spread=Math.max(0,phase-1);
  fullBody.prepare(spread);
  root.userData.head.rotation.set(.10+Math.min(phase,1)*.09-smooth(.38,1,spread)*1.02,-.26,-.05);
  const gait=walking?knuckleWalk(walkTime):null;
  leanWithArmWeight(root,smooth(.22,1,phase)*(.32-ground*.19)+(gait?.lean??0),ground*.40,ground*.80);
  const contact=floorPose.apply(ground,spread,gait);
  canvas.dataset.walking=String(walking);canvas.dataset.walkPhase=String(gait?.phase??0);
  canvas.dataset.handContact=String(contact.contact);
  canvas.dataset.handFloorY=String(contact.minY??'');
  canvas.dataset.footFloorY=contact.feetY?.join(',')??'';
  canvas.dataset.otherHandContact=String(contact.otherContact??false);
  canvas.dataset.otherHandFloorY=String(contact.otherMinY??'');
  canvas.dataset.elbowKneeDistances=contact.elbowKneeDistances?.join(',')??'';
  monster.update(phase,$('joints').checked);
  bandage.update(phase);
  fullBody.update(spread,$('surface').checked,$('joints').checked);
  root.userData.updateWristTwists?.();updateMiloNeck(root,{attached:true});root.updateMatrixWorld(true);
  root.traverse(o=>{if(o.isSkinnedMesh){o.frustumCulled=false;o.skeleton.update();}});
  renderer.shadowMap.needsUpdate=true;
  const names=['00 / 通常','01 / 異変','02 / 伸長','03 / 片腕変貌','04 / 全身へ侵食','05 / 全身変貌'];
  const texts=['月面でエイリアンに負傷させられた右腕には、通常時から包帯を巻いている。','包帯の下で右腕の関節が移動し始め、肘と前腕が膨らむ。',ground?'膨らむ右腕で包帯が裂ける。腰と膝を曲げ、下向きの拳を床へ下ろしていく。':'右腕の膨張で包帯が裂け、腕の重さに引かれて右肩が下がる。',ground?'腰と膝を曲げ、丸めた右手の拳と両足で体重を支える。':'指先は丸いまま。足を接地させ、重い右腕側へ胴と肩が傾く。','右肩から背中と胴へ侵食が広がる。左肘も移動し、もう一方の腕が伸び始める。','両腕の拳で体を支え、服は裂け落ち、靴も脱落する。肩と背中は甲殻に覆われ、顔と足指まで変貌する。'];
  const index=phase<.08?0:phase<.45?1:phase<.85?2:phase<=1.04?3:phase<1.84?4:5;
  $('phase-name').textContent=names[index];$('description').textContent=texts[index];
  $('amount').value=`${Math.round(phase/2*100)}%`;$('progress').value=phase;
  document.querySelectorAll('[data-phase]').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-pressed',String(i===index));});
  if(currentView==='face')view('face');
}

function leanWithArmWeight(character,angle,forward=0,hipBend=0){
  // Curve the spine above the pelvis. The hips and leg drivers stay in their
  // rest positions, so leaning never lifts a boot or tilts the whole figure.
  const {spine,chest,head,arms}=character.userData;
  const origin=1,span=.56;
  function frame(y){
    const length=y-origin,arc=THREE.MathUtils.clamp(length,0,span),bend=Math.hypot(angle,forward),k=bend/span;
    const axis=bend>1e-8?new THREE.Vector3(forward,0,angle).normalize():new THREE.Vector3(0,0,1);
    const theta=k*arc,curve=new THREE.Quaternion().setFromAxisAngle(axis,theta);
    const hip=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),hipBend);
    const q=hip.clone().multiply(curve),up=new THREE.Vector3(0,1,0);
    const point=up.clone().multiplyScalar(k<1e-7?arc:Math.sin(theta)/k);
    if(k>=1e-7)point.addScaledVector(axis.clone().cross(up),(1-Math.cos(theta))/k);
    point.addScaledVector(up.clone().applyQuaternion(curve),length-arc).applyQuaternion(hip).add(new THREE.Vector3(0,origin,0));
    const translation=point.sub(new THREE.Vector3(0,y,0).applyQuaternion(q));
    return {q,translation};
  }
  spine.drivers.forEach((bone,i)=>{
    const {q,translation}=frame(spine.levels[i]);bone.quaternion.copy(q);bone.position.copy(translation);
  });
  const torso=frame(1.488);chest.quaternion.copy(torso.q);chest.position.copy(torso.translation);
  for(const {arm:shoulder} of arms){
    const {q,translation}=frame(shoulder.position.y);
    shoulder.position.applyQuaternion(q).add(translation);shoulder.quaternion.premultiply(q);
  }
  const skull=frame(head.position.y);head.position.applyQuaternion(skull.q).add(skull.translation);head.quaternion.premultiply(skull.q);
}
function pause(){playing=false;$('play').textContent='変化を再生';}
function stopWalking(){walking=false;walkTime=0;$('walk').textContent='歩行を見る';$('walk').setAttribute('aria-pressed','false');}
try{
  root=await createCurtis();scene.add(root);root.rotation.set(0,0,0);
  arm=root.userData.arms.find(a=>a.side===-1);
  // A strap would stretch with the wrist and obscure the deformation under study.
  if(root.userData.watch)root.userData.watch.group.visible=false;
  rest=[];root.traverse(object=>rest.push([object,object.position.clone(),object.quaternion.clone(),object.scale.clone()]));
  floorPose=prepareFloorPose(root,arm);
  monster=createMonsterArm(root,arm);
  bandage=createInjuryBandage(root,arm,monster.forearmSurfaces);
  fullBody=createFullBodyInfection(root,arm);
  root.traverse(o=>{if(o.isMesh&&o.material?.depthTest!==false)o.castShadow=true;});
  infectionMaterial(root.userData.bodySkin);apply();
  await renderer.compileAsync(scene,camera);$('loading').hidden=true;
  for(const id of ['progress','play','reset','pose','surface','joints','walk'])$(id).disabled=false;
  $('progress').oninput=()=>{pause();stopWalking();phase=Number($('progress').value);apply();};
  $('play').onclick=()=>{stopWalking();playing=!playing;if(playing&&phase>=2)phase=1;$('play').textContent=playing?'一時停止':'変化を再生';apply();};
  $('reset').onclick=()=>{pause();stopWalking();phase=0;apply();};
  $('walk').onclick=()=>{
    pause();
    if(walking)stopWalking();
    else{walking=true;walkTime=0;lastWalkFrame=0;phase=2;$('pose').value='ground';$('walk').textContent='歩行を止める';$('walk').setAttribute('aria-pressed','true');view('side');}
    apply();
  };
  $('pose').onchange=()=>{stopWalking();apply();};$('surface').onchange=apply;$('joints').onchange=apply;
  document.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{pause();stopWalking();phase=Number(b.dataset.phase);apply();});
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
  // Read-only scene handle for inspection and targeted visual checks.
  window.curtisInfectionStudy={root,scene,camera,renderer,get phase(){return phase;},get playing(){return playing;}};
}catch(error){$('loading').textContent=`読み込みに失敗しました: ${error.message}`;console.error(error);}
renderer.setAnimationLoop(now=>{
  const dt=last?Math.min((now-last)/1000,.08):0;last=now;
  if(playing&&!document.hidden){phase=Math.min(2,phase+dt/12);apply();if(phase===2)pause();}
  if(walking&&!document.hidden){walkTime+=dt;if(walkTime-lastWalkFrame>=1/30){lastWalkFrame=walkTime;apply();}}
  controls.update();renderer.render(scene,camera);
});
window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();env.dispose();renderer.dispose();},{once:true});
