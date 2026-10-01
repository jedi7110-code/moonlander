import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials,box} from './obs/materials.js';
import {industrialMaterials} from './obs/industrial.js';
import {loadMiloHead} from './obs/head.js';
import {loadMiloBody} from './obs/milo-body.js';
import {createMilo} from './obs/characters.js';
import {createMiloToon} from './obs/milo-toon.js';
import {createCabinToon} from './obs/cabin-toon.js';
import {createEVAHatch,animateAirlock,animateHatchFault} from './obs/eva.js';
import {HATCH_REPAIR_LABELS} from './obs/hatch-repair.js';
import {HATCH_SERVICE_POINT} from './obs/hatch-repair-pose.js';
import {REPAIR_STUDY_DEFAULTS,REPAIR_STUDY_GENTLE,REPAIR_STUDY_PHASES,REPAIR_STUDY_DURATION,repairRange,poseRepairStudy} from './hatch-repair-study-model.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const number=(key,fallback,min,max)=>{const n=Number(params.get(key));return params.has(key)&&Number.isFinite(n)?THREE.MathUtils.clamp(n,min,max):fallback;};
let time=number('time',11.8,0,REPAIR_STUDY_DURATION),mode=params.get('mode')==='tuned'?'tuned':'current';
let view=['hands','side','front','wide'].includes(params.get('view'))?params.get('view'):'hands';
let tuning={amplitude:number('amplitude',REPAIR_STUDY_DEFAULTS.amplitude,0,Math.PI/6),frequency:number('frequency',REPAIR_STUDY_DEFAULTS.frequency,.1,1),reachSeconds:number('reach',1.4,.5,3),stabilizeEntry:params.get('stabilize')!=='0'};
let playing=false,dirty=true,last=performance.now(),frame;

async function init(){
  const [m,head]=await Promise.all([materials(),loadMiloHead(),loadMiloBody()]);
  head.userData.setAppearance({hair:'crop',beard:'none'});
  const canvas=$('repair-view'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x263136);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
  scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe8f0e8,0x566975,1.7));
  const key=new THREE.DirectionalLight(0xffedda,2.2);key.position.set(3,4,3);scene.add(key);
  const fill=new THREE.DirectionalLight(0xc5e4f3,1.1);fill.position.set(8,3,-3);scene.add(fill);
  const milo=createMilo(m,head),worn=industrialMaterials(m),hatch=createEVAHatch(worn,0,true);scene.add(milo,hatch);
  animateAirlock(hatch.userData.door,hatch.userData.signal,0);animateHatchFault(hatch.userData.signal,{fault:{id:'innerHatch'}});
  const floor=new THREE.Group();box(floor,worn.dark,6.2,-.035,0,4,.06,3.8);scene.add(floor);
  const miloToon=createMiloToon(milo),cabinToon=createCabinToon([hatch,floor]);cabinToon.setStyle('cartoon');
  const camera=new THREE.PerspectiveCamera(38,1,.01,40),controls=new OrbitControls(camera,canvas);
  controls.minDistance=.22;controls.maxDistance=9;controls.enableDamping=false;controls.screenSpacePanning=true;
  const guides=new THREE.Group();scene.add(guides);guides.visible=params.get('guides')==='1';$('guides').checked=guides.visible;
  function dot(color,radius){const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,10,8),new THREE.MeshBasicMaterial({color,depthTest:false}));mesh.renderOrder=20;guides.add(mesh);return mesh;}
  const screwDot=dot(0x72f7a9,.009),tipDot=dot(0xffb367,.006),joints=Array.from({length:6},()=>dot(0x70cfff,.006));
  const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(24),3));
  const lines=new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:0x70cfff,depthTest:false}));lines.renderOrder=19;guides.add(lines);
  let width=1,height=1;
  const range=()=>repairRange($('range').value);
  $('speed').value=String(number('speed',.25,.1,1));if(!$('speed').value)$('speed').value='.25';
  if(['all','inspect','repair','verify'].includes(params.get('range')))$('range').value=params.get('range');
  $('loop').checked=params.get('loop')!=='0';$('door').checked=params.get('door')!=='0';
  function saveURL(){
    const url=new URL(location.href);
    const values={time:time.toFixed(3),mode,view,amplitude:tuning.amplitude.toFixed(6),frequency:tuning.frequency.toFixed(6),reach:tuning.reachSeconds,stabilize:Number(tuning.stabilizeEntry),speed:$('speed').value,range:$('range').value,loop:Number($('loop').checked),guides:Number(guides.visible),door:Number($('door').checked)};
    values.eye=camera.position.toArray().map(value=>value.toFixed(4)).join(',');values.target=controls.target.toArray().map(value=>value.toFixed(4)).join(',');
    Object.entries(values).forEach(([key,value])=>url.searchParams.set(key,value));history.replaceState(null,'',url);
  }
  function update(){
    const {visit,tip,screw,contact}=poseRepairStudy(milo,time,mode==='tuned'?tuning:null);
    tipDot.position.copy(tip);screwDot.position.copy(screw);
    const points=milo.userData.arms.flatMap(rig=>[rig.arm,rig.elbow,rig.hand].map(joint=>joint.getWorldPosition(new THREE.Vector3())));
    points.forEach((point,i)=>joints[i].position.copy(point));
    [0,1,1,2,3,4,4,5].forEach((index,i)=>lineGeometry.attributes.position.setXYZ(i,...points[index].toArray()));lineGeometry.attributes.position.needsUpdate=true;lines.frustumCulled=false;
    $('phase-label').textContent=HATCH_REPAIR_LABELS[visit.phase][0];
    $('contact-label').textContent=contact?`工具先端とネジの距離 ${(tip.distanceTo(screw)*1000).toFixed(2)} mm`:'手を伸ばす・戻す動作も確認できます';
    $('mode-label').textContent=mode==='current'?'現行 / OBS':'調整案 / スタディーのみ';
    $('time-output').textContent=`${time.toFixed(3)} / ${REPAIR_STUDY_DURATION.toFixed(1)} 秒`;
    $('repair-time').value=time;$('repair-time').setAttribute('aria-valuetext',`${time.toFixed(3)}秒・${HATCH_REPAIR_LABELS[visit.phase][0]}`);
    $('current').setAttribute('aria-pressed',mode==='current');$('tuned').setAttribute('aria-pressed',mode==='tuned');
    document.querySelectorAll('[data-phase]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.phase===visit.phase));dirty=true;
  }
  function setPlaying(value){playing=value;last=performance.now();$('play').textContent=value?'一時停止':'再生';$('play').setAttribute('aria-pressed',value);if(!value)saveURL();}
  function seek(value){setPlaying(false);time=THREE.MathUtils.clamp(value,0,REPAIR_STUDY_DURATION);update();saveURL();}
  function showView(){
    const point=new THREE.Vector3(HATCH_SERVICE_POINT.x,HATCH_SERVICE_POINT.y,HATCH_SERVICE_POINT.z);
    const presets={hands:{target:point.clone().add(new THREE.Vector3(-.18,.08,0)),offset:[-1.25,.48,1.45]},side:{target:point.clone().add(new THREE.Vector3(-.25,.08,0)),offset:[0,.08,1.75]},front:{target:point.clone().add(new THREE.Vector3(-.20,.10,0)),offset:[1.55,.14,0]},wide:{target:new THREE.Vector3(6.6,1.35,0),offset:[-3.2,1.3,4.7]}};
    const preset=presets[view];controls.target.copy(preset.target);camera.position.copy(preset.target).add(new THREE.Vector3(...preset.offset));controls.update();
    hatch.visible=view!=='front'&&$('door').checked;$('door').disabled=view==='front';
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.view===view));dirty=true;
  }
  function tuningUI(){
    $('stabilize').checked=tuning.stabilizeEntry;
    $('amplitude').value=THREE.MathUtils.radToDeg(tuning.amplitude);$('frequency').value=tuning.frequency;$('reach').value=tuning.reachSeconds;
    $('amplitude-value').textContent=`±${THREE.MathUtils.radToDeg(tuning.amplitude).toFixed(1)}°`;$('frequency-value').textContent=`${tuning.frequency.toFixed(2)} 回/秒`;$('reach-value').textContent=`${tuning.reachSeconds.toFixed(1)} 秒`;
  }
  function togglePlay(){if(!playing){const {start,end}=range();if(time<start||time>=end)time=start;update();}setPlaying(!playing);}
  $('play').onclick=togglePlay;$('restart').onclick=()=>{time=0;$('range').value='all';update();saveURL();setPlaying(true);};
  $('step-back').onclick=()=>seek(time-1/60);$('step-forward').onclick=()=>seek(time+1/60);
  $('repair-time').max=REPAIR_STUDY_DURATION;$('repair-time').oninput=()=>seek(Number($('repair-time').value));
  $('range').onchange=()=>seek(range().start);$('speed').onchange=$('loop').onchange=saveURL;
  for(const id of ['current','tuned'])$(id).onclick=()=>{mode=id;update();saveURL();};
  for(const id of ['amplitude','frequency','reach'])$(id).oninput=()=>{
    tuning={...tuning,amplitude:THREE.MathUtils.degToRad(Number($('amplitude').value)),frequency:Number($('frequency').value),reachSeconds:Number($('reach').value)};mode='tuned';tuningUI();update();saveURL();
  };
  $('stabilize').onchange=()=>{tuning.stabilizeEntry=$('stabilize').checked;mode='tuned';update();saveURL();};
  $('gentle').onclick=()=>{tuning={...REPAIR_STUDY_GENTLE};mode='tuned';tuningUI();update();saveURL();};
  $('reset-tuning').onclick=()=>{tuning={...REPAIR_STUDY_DEFAULTS};mode='current';tuningUI();update();saveURL();};
  $('guides').onchange=()=>{guides.visible=$('guides').checked;dirty=true;saveURL();};
  $('door').onchange=()=>{hatch.visible=$('door').checked&&view!=='front';dirty=true;saveURL();};
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;showView();saveURL();});
  const phaseNames=['方向転換','扉へ近づく','扉に正対','ロック点検','修理','復旧確認','手を戻す','向き直る','通路へ戻る','終了姿勢'];
  for(const [i,phase]of REPAIR_STUDY_PHASES.entries()){const button=document.createElement('button');button.dataset.phase=phase.id;button.textContent=phaseNames[i];button.title=`${phase.start.toFixed(1)}秒 / ${phase.label}`;button.onclick=()=>{$('range').value=['inspect','repair','verify'].includes(phase.id)?phase.id:'all';seek(phase.start);};document.querySelector('.phases').append(button);}
  $('copy-link').onclick=async()=>{setPlaying(false);try{await navigator.clipboard.writeText(location.href);$('copy-status').textContent='URLをコピーしました。同じ時刻・視点・調整値を再現できます。';}catch{$('copy-status').textContent='コピーできませんでした。アドレスバーのURLをコピーしてください。';}};
  canvas.addEventListener('keydown',event=>{if(['Space','ArrowLeft','ArrowRight'].includes(event.code)){event.preventDefault();if(event.code==='Space')togglePlay();else seek(time+(event.code==='ArrowRight'?1:-1)/60);}});
  controls.addEventListener('change',()=>dirty=true);
  controls.addEventListener('end',saveURL);
  const resize=()=>{const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  document.querySelectorAll('button,input,select').forEach(control=>control.disabled=false);
  tuningUI();showView();
  const vectorParam=key=>{const values=params.get(key)?.split(',').map(Number);return values?.length===3&&values.every(value=>Number.isFinite(value)&&Math.abs(value)<40)?new THREE.Vector3(...values):null;};
  const savedEye=vectorParam('eye'),savedTarget=vectorParam('target');
  if(savedEye&&savedTarget&&savedEye.distanceTo(savedTarget)>.1){camera.position.copy(savedEye);controls.target.copy(savedTarget);controls.update();}
  update();saveURL();$('loading').hidden=true;
  function tick(now){
    frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.1);last=now;if(document.hidden)return;
    if(playing){const {start,end}=range();time+=dt*Number($('speed').value);if(time>=end){if($('loop').checked)time=start+(time-end)%(end-start);else{time=end;setPlaying(false);}}update();}
    if(dirty){miloToon.update(width,height);cabinToon.update(width,height,2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),15);renderer.render(scene,camera);dirty=false;}
  }
  frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();miloToon.dispose();cabinToon.dispose();environment.dispose();const geometry=new Set(),usedMaterials=new Set(),textures=new Set();scene.traverse(object=>{if(object.geometry)geometry.add(object.geometry);for(const material of [].concat(object.material??[])){usedMaterials.add(material);Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value);});}});geometry.forEach(value=>value.dispose());usedMaterials.forEach(value=>value.dispose());textures.forEach(value=>value.dispose());renderer.dispose();},{once:true});
}
init().catch(error=>{console.error(error);$('loading').textContent=`読み込みに失敗しました: ${error.message}`;$('loading').setAttribute('role','alert');});
