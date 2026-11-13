// Walking study: the cabin's current walk (top) against the planned walk of
// src/obs/milo-gait.js (bottom), over the same distance from the same cue.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {materials} from '../../src/obs/materials.js';
import {createMilo,animateMilo} from '../../src/obs/characters.js';
import {createMiloToon} from '../../src/obs/milo-toon.js';
import {miloWalkData} from '../../src/obs/mocap-walk.js';
import {MILO_GAIT,planMiloWalk,poseMiloWalk,miloWalkSpeed,naturalStepLength} from '../../src/obs/milo-gait.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const CABIN_SPEED=54*.022;                                     // CREW_WALK_SPEED in metres per second
const DISTANCES=[1,2,4,6,9];
const SPEEDS=[{id:'normal',label:'通常',factor:1},{id:'tired',label:'不調（68%）',factor:.68},{id:'ill',label:'重い不調（48%）',factor:.48}];
const SAMPLES=[
  {id:'full',label:'すべて',name:'改善案（すべて）',note:'歩幅と歩調を速さに合わせ、立ち姿勢から歩き出して、足をそろえて止まる'},
  {id:'noswing',label:'腕と体の調整なし',name:'改善案（腕と体の調整なし）',note:'歩幅・歩き始め・止まり方だけ。腕の振りと体の揺れは実測のまま'},
  {id:'step',label:'歩幅と歩調だけ',name:'改善案（歩幅と歩調だけ）',note:'速さは一定のまま、歩幅と歩調だけを速さに合わせる。歩き始めと止まり方は現在と同じ'},
];
const VIEWS=[{id:'follow',label:'横（追従）'},{id:'all',label:'横（全体）'},{id:'feet',label:'足元'},{id:'oblique',label:'斜め前'},{id:'front',label:'正面'}];
const LEAD=.8,HOLD=1.6,STEP=miloWalkData.cycleDistance/2;
const pick=(list,key,fallback)=>list.find(item=>String(item.id??item)===params.get(key))??fallback;
const state={distance:pick(DISTANCES,'distance',6),speed:pick(SPEEDS,'speed',SPEEDS[0]),sample:pick(SAMPLES,'sample',SAMPLES[0]),view:pick(VIEWS,'view',VIEWS[0]),
  time:Math.max(0,Number(params.get('t'))||0),playing:params.get('play')!=='0',marks:params.get('marks')!=='0'};

async function init(){
  const [m,headA,headB]=await Promise.all([materials(),loadMiloHead(),loadMiloHead(),loadMiloBody()]);
  const canvas=$('walk-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
  const lanes=[headA,headB].map(head=>{
    head.userData.setAppearance({hair:'crop',beard:'none'});
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x222d2e);scene.environment=environment.texture;
    scene.add(new THREE.HemisphereLight(0xf4f5e7,0x657b7b,2.1));
    const key=new THREE.DirectionalLight(0xfff1d7,2.6);key.position.set(3,5,4);scene.add(key);
    const fill=new THREE.DirectionalLight(0xc5dce7,1.1);fill.position.set(-3,2,-2);scene.add(fill);
    const floor=new THREE.Group(),marks=new THREE.Group();scene.add(floor,marks);
    const milo=createMilo(m,head);milo.rotation.y=Math.PI/2;scene.add(milo);
    return {scene,milo,floor,marks,camera:new THREE.OrthographicCamera(-1,1,1,-1,.02,60),toon:createMiloToon(milo),x:0};
  });
  const floorMaterial=new THREE.MeshStandardMaterial({color:0x43504f,roughness:1});
  const line=(color,opacity=1)=>new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity});
  const lines={metre:line(0x9aa6a2,.75),tenth:line(0x6f7c79,.45),start:line(0xe6c66f),goal:line(0x8fd0c0)};
  const footMaterials={Left:new THREE.MeshBasicMaterial({color:0x7fc7d9}),Right:new THREE.MeshBasicMaterial({color:0xe2b25e})};
  const footShape=new THREE.PlaneGeometry(.26,.085);footShape.rotateX(-Math.PI/2);
  let plan=null,durations=[0,0],cycle=1,width=2,height=2,dirty=true,last=performance.now(),frame;

  // ---- What each lane does at time t of the walk (t<0: still standing) ------
  const speed=()=>CABIN_SPEED*state.speed.factor;
  const stand=(milo,time)=>animateMilo(milo,{moving:false,climbing:false,facing:1,action:null,time,dt:0});
  // the cabin's walk: constant speed, the measured cycle driven by distance; standing in one frame
  function cabinWalk(lane,time,t,stride=1){
    const v=speed(),T=state.distance/v,x=Math.min(state.distance,Math.max(0,v*t)),moving=t>0&&t<T;
    lane.milo.rotation.y=Math.PI/2;
    if(moving)animateMilo(lane.milo,{moving:true,climbing:false,facing:1,walkYaw:Math.PI/2,action:null,time,dt:0,walkDistance:x/stride,walkStride:stride});
    else stand(lane.milo,time);
    lane.x=x;lane.speed=moving?v:0;lane.milo.rotation.y=Math.PI/2;
  }
  function plannedWalk(lane,time,t){
    lane.milo.rotation.y=Math.PI/2;stand(lane.milo,time);
    if(t<=0){lane.x=0;lane.speed=0;return;}
    if(t>=plan.duration){lane.x=state.distance;lane.speed=0;return;}
    const walk=poseMiloWalk(lane.milo,plan,t,{swing:state.sample.id==='full'});
    lane.x=walk.x;lane.speed=walk.pace;
  }
  function pose(){
    const t=state.time-LEAD,[top,bottom]=lanes;
    cabinWalk(top,state.time,t);
    if(state.sample.id==='step')cabinWalk(bottom,state.time,t,naturalStepLength(speed())/STEP);else plannedWalk(bottom,state.time,t);
    for(const lane of lanes){lane.milo.position.set(lane.x,0,0);lane.milo.updateMatrixWorld(true);lane.milo.userData.bodySkin?.skeleton.update();}
    const v=speed(),stepB=state.sample.id==='step'?naturalStepLength(v):plan.steady,cadenceB=state.sample.id==='step'?v/stepB*60:plan.cadence;
    $('numbers-top').textContent=`歩幅 ${STEP.toFixed(2)} m ／ 歩調 ${(v/STEP*60).toFixed(0)} 歩/分\n所要 ${(state.distance/v).toFixed(2)} 秒 ／ いま ${top.speed.toFixed(2)} m/s`;
    $('numbers-bottom').textContent=`歩幅 ${stepB.toFixed(2)} m ／ 歩調 ${cadenceB.toFixed(0)} 歩/分${state.sample.id==='step'?'':` ／ ${plan.count} 歩`}\n所要 ${durations[1].toFixed(2)} 秒 ／ いま ${bottom.speed.toFixed(2)} m/s`;
    $('time').value=state.time;$('clock').textContent=`${state.time.toFixed(2)} / ${cycle.toFixed(2)}秒`;
    placeCameras();dirty=true;
  }

  // ---- Scene dressing ------------------------------------------------------
  function rebuild(){
    plan=planMiloWalk(state.distance,speed());
    durations=[state.distance/speed(),state.sample.id==='step'?state.distance/speed():plan.duration];
    cycle=LEAD+Math.max(...durations)+HOLD;$('time').max=cycle;state.time=Math.min(state.time,cycle);
    const D=state.distance;
    lanes.forEach((lane,index)=>{
      for(const group of [lane.floor,lane.marks]){for(const child of [...group.children]){group.remove(child);if(child.geometry!==footShape)child.geometry?.dispose();}}
      const slab=new THREE.Mesh(new THREE.PlaneGeometry(D+8,5),floorMaterial);slab.rotation.x=-Math.PI/2;slab.position.set(D/2,-.002,0);lane.floor.add(slab);
      const segments=(xs,material,z0=-2.5,z1=2.5)=>{const points=xs.flatMap(x=>[x,.001,z0,x,.001,z1]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));lane.floor.add(new THREE.LineSegments(g,material));};
      const metres=[],tenths=[];for(let i=-30;i<=Math.round((D+3)*10);i++)(i%10?tenths:metres).push(i/10);
      segments(tenths.filter(x=>Math.round(x*10)%5===0),lines.tenth);segments(metres,lines.metre);segments([0],lines.start);segments([D],lines.goal);
      // where the feet land: planned (bottom) or one measured step after another (top and "step only")
      const planned=index===1&&state.sample.id!=='step',feet=[];
      if(planned)plan.footfalls.forEach((x,i)=>{const stood=i<=1||i>=plan.footfalls.length-2,foot=plan.owners[i];feet.push({x,foot,z:(foot==='Left'?-1:1)*(stood?MILO_GAIT.standHalfWidth:.055)});});
      else{const step=index===1?naturalStepLength(speed()):STEP;for(let k=0;k*step<=D+.4;k++)feet.push({x:k*step+.36*step/STEP,foot:k%2?'Left':'Right',z:(k%2?-1:1)*.055});}
      for(const {x,foot,z} of feet){const mark=new THREE.Mesh(footShape,footMaterials[foot]);mark.position.set(x+.04,.0015,-z);lane.marks.add(mark);}
      lane.marks.visible=state.marks;
    });
    $('sample-name').textContent=state.sample.name;$('sample-note').textContent=state.sample.note;
  }
  function placeCameras(){
    const aspect=width/(height/2),view=state.view.id;
    for(const lane of lanes){
      const follow=view!=='all',target=new THREE.Vector3(follow?lane.x:state.distance/2,view==='feet'?.30:.93,0);
      const half=view==='all'?Math.max(1.2,(state.distance/2+1.4)/aspect):view==='feet'?.52:1.16;
      const camera=lane.camera;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
      camera.position.copy(target).add(view==='front'?new THREE.Vector3(9,.9,0):view==='oblique'?new THREE.Vector3(5.2,1.9,6.4):new THREE.Vector3(0,view==='feet'?1.9:1.3,9));
      camera.lookAt(target);
    }
  }
  function url(){
    const next=new URL(location.href);
    for(const [key,value] of [['distance',state.distance],['speed',state.speed.id],['sample',state.sample.id],['view',state.view.id]])next.searchParams.set(key,value);
    history.replaceState(null,'',next);
  }

  // ---- Controls ------------------------------------------------------------
  function choices(container,list,key,label,after){
    for(const item of list){
      const button=document.createElement('button');button.textContent=label(item);button.setAttribute('aria-pressed',item===state[key]);
      button.onclick=()=>{state[key]=item;for(const other of $(container).children)other.setAttribute('aria-pressed',other===button);after();url();};
      $(container).append(button);
    }
  }
  const restart=()=>{state.time=0;rebuild();pose();};
  choices('distances',DISTANCES,'distance',d=>`${d} m`,restart);
  choices('speeds',SPEEDS,'speed',s=>`${s.label} ${(CABIN_SPEED*s.factor).toFixed(2)} m/s`,restart);
  choices('samples',SAMPLES,'sample',s=>s.label,()=>{rebuild();pose();});
  choices('views',VIEWS,'view',v=>v.label,()=>{placeCameras();dirty=true;});
  const setPlaying=value=>{state.playing=value;$('play').textContent=value?'一時停止':'再生';last=performance.now();};
  $('play').onclick=()=>setPlaying(!state.playing);
  $('restart').onclick=()=>{state.time=0;pose();setPlaying(true);};
  $('time').oninput=()=>{setPlaying(false);state.time=Number($('time').value);pose();};
  $('marks').checked=state.marks;$('marks').onchange=()=>{state.marks=$('marks').checked;lanes.forEach(lane=>lane.marks.visible=state.marks);dirty=true;};
  addEventListener('keydown',event=>{
    if(event.target instanceof HTMLInputElement&&event.target.type!=='range'||event.target instanceof HTMLSelectElement)return;
    if(event.code==='Space'){event.preventDefault();setPlaying(!state.playing);}
    else if(event.code==='ArrowRight'||event.code==='ArrowLeft'){event.preventDefault();setPlaying(false);state.time=Math.min(cycle,Math.max(0,state.time+(event.code==='ArrowRight'?1:-1)/30));pose();}
  });

  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(2,Math.round(rect.width));height=Math.max(2,Math.round(rect.height));renderer.setSize(width,height,false);placeCameras();dirty=true;}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  rebuild();resize();pose();setPlaying(state.playing);
  document.querySelectorAll('button,input,select').forEach(control=>control.disabled=false);$('loading').hidden=true;
  function draw(){
    const half=Math.floor(height/2);renderer.setScissorTest(true);
    lanes.forEach((lane,index)=>{const y=index?0:height-half,h=index?height-half:half;renderer.setViewport(0,y,width,h);renderer.setScissor(0,y,width,h);lane.toon.update(width,h);renderer.render(lane.scene,lane.camera);});
    renderer.setScissorTest(false);dirty=false;
  }
  function tick(now){
    frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;
    if(state.playing){state.time+=dt*Number($('rate').value);if(state.time>=cycle)state.time=0;pose();}
    if(dirty)draw();
  }
  frame=requestAnimationFrame(tick);
  // for checking the study from the console or a test page
  globalThis.walkStudy={state,lanes,renderer,get plan(){return plan;},get cycle(){return cycle;},LEAD,
    set(options){Object.assign(state,{distance:options.distance??state.distance,speed:SPEEDS.find(s=>s.id===options.speed)??state.speed,sample:SAMPLES.find(s=>s.id===options.sample)??state.sample,view:VIEWS.find(v=>v.id===options.view)??state.view});rebuild();pose();},
    seek(time){setPlaying(false);state.time=time;pose();draw();},draw,miloWalkSpeed};
  addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();lanes.forEach(lane=>lane.toon.dispose());environment.dispose();renderer.dispose();});
}
init().catch(error=>{console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='スタディを読み込めませんでした。'+error.message;});
