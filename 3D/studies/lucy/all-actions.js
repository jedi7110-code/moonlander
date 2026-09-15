import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
import {addLucyWhiskerPads} from './whisker-pads.js';
import {addLucyPawPads} from './paw-pads.js';
import {addLucyPupilShape} from './pupil-study.js';
import {createGroomSurface} from './groom-surface.js';
import {prepareGroomPlayback} from './groom-playback.js';
import {layLucyOnSide,addSideSleepBreathing} from './side-sleep.js';
import {createSleepTailTap} from './sleep-tail-tap.js';
import {createJumpStudy} from './jump-study.js';
import {createStretchStudy,STRETCH_DURATION} from './stretch-study.js';
import {createLucyTurnRig} from '../../src/obs/lucy-turn.js';
import {createCatTurn,sampleCatTurn} from '../../src/obs/cat-turn.js';
import {createProneStudy,PRONE_DURATION} from './prone-study.js';

export const STUDY_ACTIONS=[
  {id:'idle',label:'待機',clip:'Idle'},
  {id:'walk',label:'歩く・尻尾上',clip:'Walk',tail:0},
  {id:'walk-level',label:'歩く・尻尾水平',clip:'WalkLevel',tail:1},
  {id:'walk-low',label:'歩く・尻尾下',clip:'WalkLow',tail:2},
  {id:'sit',label:'座る',clip:'Sit',mode:'look'},
  {id:'groom',label:'毛繕い',clip:'Groom',mode:'groom'},
  {id:'eat',label:'食べる',clip:'Eat',mode:'eat'},
  {id:'play',label:'遊ぶ',clip:'Play',mode:'play'},
  {id:'sleep',label:'横寝',clip:'Sleep',mode:'sleep'},
  {id:'crouch',label:'くぐる',clip:'Crouch'},
  {id:'jump',label:'ジャンプ',clip:'Jump'},
  {id:'stretch',label:'伸び'},
  {id:'turn',label:'方向転換'},
  {id:'prone',label:'伏せ'},
];

async function start(){
  const $=id=>document.getElementById(id),loader=new GLTFLoader();
  const [base,bed,donor,jumpAsset,stretchAsset,turnAsset,proneAsset]=await Promise.all([
    loader.loadAsync('/review/outline-study.glb'),loader.loadAsync('/review/outline-study.glb'),loader.loadAsync('/review/sleep-side.glb'),
    loader.loadAsync('/review/outline-study.glb'),loader.loadAsync('/review/outline-study.glb'),loader.loadAsync('/review/outline-study.glb'),
    loader.loadAsync('/review/outline-study.glb'),
  ]);
  bed.animations=bed.animations.map(clip=>clip.name==='Sleep'?donor.animations.find(c=>c.name==='Sleep'):clip);
  const cat=createLucy(base,{random:()=>.5}),sleep=createLucy(bed,{random:()=>.5});
  addLucyPupilShape(cat);addLucyPupilShape(sleep);
  addLucyWhiskerPads(cat);addLucyPawPads(cat);
  const groom=await prepareGroomPlayback(cat,createGroomSurface(cat),{
    yieldFrame:()=>new Promise(resolve=>requestAnimationFrame(resolve)),
    onProgress:p=>{$('status').textContent=`毛繕いの皮膚補正を準備中 ${Math.round(p*100)}%`;},
  });
  animateLucy(sleep,{dt:.1,time:2.7,actionTime:2.7,mode:'sleep',remaining:100,yaw:0});
  layLucyOnSide(sleep);
  const breathe=addSideSleepBreathing(sleep),tail=createSleepTailTap(sleep);
  const jumping=createLucy(jumpAsset,{random:()=>.5});addLucyWhiskerPads(jumping);addLucyPawPads(jumping);
  addLucyPupilShape(jumping);
  animateLucy(jumping,{dt:.1,time:0,actionTime:0,mode:'idle',yaw:0});
  const jump=createJumpStudy(jumping);
  const stretching=createLucy(stretchAsset,{random:()=>.5});
  addLucyWhiskerPads(stretching);addLucyPawPads(stretching);addLucyPupilShape(stretching);
  animateLucy(stretching,{dt:.1,time:0,mode:'idle',yaw:0});
  const stretch=createStretchStudy(stretching);
  const turning=createLucy(turnAsset,{random:()=>.5});
  addLucyWhiskerPads(turning);addLucyPawPads(turning);addLucyPupilShape(turning);
  animateLucy(turning,{dt:.1,time:0,mode:'idle',yaw:0});
  const turnRig=createLucyTurnRig(turning);
  const lying=createLucy(proneAsset,{random:()=>.5});
  addLucyWhiskerPads(lying);addLucyPawPads(lying);addLucyPupilShape(lying);
  animateLucy(lying,{dt:.1,time:0,mode:'idle',yaw:0});
  const prone=createProneStudy(lying);
  const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x62676b);scene.add(cat,sleep,jumping,stretching,turning,lying,new THREE.HemisphereLight(0xffffff,0x414749,2));
  const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-1,right:1,top:1,bottom:-1,near:.1,far:10});key.shadow.bias=-.0001;key.shadow.normalBias=.002;scene.add(key);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0x626868,roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,30);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.5;controls.maxZoom=5;controls.maxPolarAngle=Math.PI/2-.015;
  let current=STUDY_ACTIONS.find(a=>a.id===location.hash.slice(1))??STUDY_ACTIONS[4],time=0,paused=false,dirty=true,last=performance.now();
  let reportStart=last,poseCount=0,poseCost=0;
  const turnHalfDuration=createCatTurn(0,Math.PI).duration+.9;
  function duration(){return current.id==='prone'?PRONE_DURATION:current.id==='turn'?turnHalfDuration*2:current.id==='stretch'?STRETCH_DURATION:current.id==='sleep'?48:current.id==='jump'?3:cat.userData.actions[current.clip].getClip().duration;}
  function pose(dt=1/60){
    const sleeping=current.id==='sleep',isJump=current.id==='jump',isStretch=current.id==='stretch',isTurn=current.id==='turn',isProne=current.id==='prone';cat.visible=!sleeping&&!isJump&&!isStretch&&!isTurn&&!isProne;sleep.visible=sleeping;jumping.visible=isJump;stretching.visible=isStretch;turning.visible=isTurn;lying.visible=isProne;
    let jumpPhase='';
    if(sleeping){breathe(time);tail.update(time);}
    else if(isJump){jumpPhase=jump.update(time).phase;}
    else if(isStretch){jumpPhase=stretch.update(time).phase;}
    else if(isProne){jumpPhase=prone.update(time).phase;}
    else if(isTurn){const turn=createCatTurn(time<turnHalfDuration?0:Math.PI,time<turnHalfDuration?Math.PI:0);turn.age=Math.max(0,Math.min(turn.duration,time%turnHalfDuration-.45));turnRig.update(sampleCatTurn(turn));}
    else{
      cat.position.set(0,0,0);
      const d=duration(),options={dt,time:time+2*d,actionTime:time+2*d,mode:current.mode??'idle',remaining:100,yaw:0};
      if(current.tail!==undefined){
        cat.userData.tail.weights=[0,0,0];cat.userData.tail.weights[current.tail]=1;
        cat.userData.tail.remaining=100;cat.userData.tail.transition=null;
        options.moving=true;options.walkDistance=time/1.2*.175*cat.scale.x*2.25;
      }
      if(current.id==='crouch')options.passage={crouch:1,yaw:0};
      animateLucy(cat,options);groom.update(current.id==='groom',time);
    }
    $('time').value=time;$('clock').value=`${time.toFixed(2)}秒`;
    $('status').textContent=`${current.label} / ${isJump||isStretch||isProne?jumpPhase:current.tail!==undefined?'足運びをその場でループ確認':current.id==='sleep'?'横寝・呼吸・時々尻尾トントン':'ループ再生'} — 読み込み完了`;
    dirty=false;
  }
  function view(){
    if(dirty)pose();
    const v=$('view').value,target=new THREE.Vector3(0,current.id==='sleep'?.10:.22,current.id==='jump'?.085:0);
    let az=.75,el=.28;camera.zoom=1;
    if(v==='front')az=0;
    if(v==='side'||v==='floor')az=-Math.PI/2;
    if(v==='back')az=Math.PI;
    if(v==='top')el=1.5;
    if(v==='floor'){el=.02;target.y=.045;}
    if(v==='face'){
      const box=new THREE.Box3(),p=new THREE.Vector3();
      (current.id==='sleep'?sleep:current.id==='jump'?jumping:current.id==='stretch'?stretching:current.id==='turn'?turning:current.id==='prone'?lying:cat).traverse(m=>{if(!m.isSkinnedMesh||m.material?.name!=='Lucy calico coat')return;m.skeleton.update();const a=m.geometry.attributes.position;
        for(let i=0;i<a.count;i++)if(a.getZ(i)>.225&&a.getY(i)>.153)box.expandByPoint(m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld));});
      target.copy(box.getCenter(new THREE.Vector3()));camera.zoom=2.8;az=0;el=.06;
    }
    controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(Math.sin(az)*Math.cos(el)*3,Math.sin(el)*3,Math.cos(az)*Math.cos(el)*3));camera.lookAt(target);camera.updateProjectionMatrix();controls.update();
  }
  for(const action of STUDY_ACTIONS){
    const button=document.createElement('button');button.textContent=action.label;button.dataset.action=action.id;button.setAttribute('aria-pressed',action===current);
    button.onclick=()=>{
      current=action;time=0;dirty=true;cat.userData.initialized=false;cat.userData.walkAmount=action.tail===undefined?0:1;
      if(action.id==='jump'){paused=false;$('pause').textContent='一時停止';}
      for(const b of $('actions').children)b.setAttribute('aria-pressed',b===button);
      $('time').max=duration();$('tap').disabled=action.id!=='sleep';pose();if($('view').value==='face')$('view').value='oblique';view();
    };$('actions').append(button);
  }
  $('pause').onclick=()=>{if(paused&&current.id==='jump'&&time>=duration())time=0;paused=!paused;$('pause').textContent=paused?'再生':'一時停止';};
  $('restart').onclick=()=>{time=0;dirty=true;if(current.id==='jump'){paused=false;$('pause').textContent='一時停止';}};
  $('time').oninput=()=>{time=Number($('time').value);paused=true;$('pause').textContent='再生';dirty=true;};
  $('tap').onclick=()=>{time=4;paused=false;$('pause').textContent='一時停止';dirty=true;};
  $('view').onchange=view;$('reset').onclick=()=>{$('view').value='oblique';view();};
  function resize(){const w=innerWidth,h=innerHeight,half=Math.max(.36,.52*h/w);renderer.setSize(w,h,false);camera.top=half;camera.bottom=-half;camera.left=-half*w/h;camera.right=half*w/h;camera.updateProjectionMatrix();}
  addEventListener('resize',resize);resize();$('time').max=duration();pose();view();
  function frame(now){
    const dt=Math.min(.1,(now-last)/1000);last=now;
    if(!paused){
      const next=time+dt*Number($('speed').value);
      if(current.id==='jump'){
        time=Math.min(duration(),next);
        if(time>=duration()){paused=true;$('pause').textContent='再生';}
      }else time=next%duration();
      dirty=true;
    }
    if(dirty){const before=performance.now();pose(dt*Number($('speed').value));poseCost+=performance.now()-before;poseCount++;}
    if(now-reportStart>=1000){
      renderer.domElement.dataset.poseFps=(poseCount*1000/(now-reportStart)).toFixed(1);
      renderer.domElement.dataset.poseMs=(poseCost/Math.max(1,poseCount)).toFixed(2);
      reportStart=now;poseCount=0;poseCost=0;
    }
    controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
start().catch(error=>{console.error(error);document.getElementById('status').textContent='読み込みに失敗しました';document.getElementById('error').textContent=error.message;});
