import {Mesh,PlaneGeometry} from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {createCabinMirror} from '../../src/obs/cabin-mirror.js';
import {ObservationView} from '../../src/obs/view.js';
import {CabinBrain} from '../../src/obs/brain.js';
import {Supplies,CrewMotion,CatRoutine,getStation} from '../../src/obs/state.js';
import {GroomingVisit} from '../../src/obs/grooming-visit.js';
import {createDirectMirror} from './direct-mirror.js';

const $=id=>document.getElementById(id);
async function init(){
  const care=new Supplies(),actor=new CrewMotion(getStation('grooming')),cat=new CatRoutine(care,{turns:true});
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{hideWant(){}}},actor,{care,random:()=>.9});
  brain.grooming=new GroomingVisit(1);brain.grooming.age=41;brain.state='grooming';brain.actStation='grooming';
  const view=await ObservationView.create($('mirror-view'),{characterViews:true});
  const current=view.groomingMirror,legacy=new Reflector(new PlaneGeometry(.72,.89),{color:0xa8b5b5,textureWidth:256,textureHeight:384,clipBias:.002,multisample:0});
  legacy.getRenderTarget().stencilBuffer=true;legacy.visible=false;current.parent.add(legacy);
  const previousMirror=createCabinMirror({cullStatic:false}),off=new Mesh(current.geometry,view.restingMirror.material);
  const direct=createDirectMirror({room:view.ship.groomingStation.mirrorRoom});
  off.visible=false;current.parent.add(previousMirror,off,direct);
  const variants={direct,current,previous:previousMirror,legacy,off},titles={direct:'直接反転（膜なし）',current:'現在のOBS',previous:'軽量化前',legacy:'以前の粗い画質',off:'反射なし'};
  const sequence=['off','current','direct'];
  let variant='direct',frame=0,run=null,settle=60,previous=performance.now(),results=[],playing=false;
  const renderer=view.renderer,gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];
  let reflection={calls:0,triangles:0,cpu:0};
  for(const mirror of [current,previousMirror,legacy,direct]){
    const reflect=mirror.onBeforeRender;
    mirror.onBeforeRender=function(...args){
      const before={...renderer.info.render},start=performance.now();reflect.apply(this,args);
      reflection={calls:renderer.info.render.calls-before.calls,triangles:renderer.info.render.triangles-before.triangles,cpu:performance.now()-start};
    };
  }
  function select(id='milo',pov=true){view.setMode(id);if(pov&&id!=='all')view.characterCamera.toggleFirstPerson();settle=60;}
  function quality(id){Object.values(variants).forEach(mirror=>mirror.visible=false);variant=id;view.groomingMirror=variants[id];for(const key of Object.keys(variants))$(key).setAttribute('aria-pressed',String(key===id));settle=60;}
  $('pov').onclick=()=>select();$('follow').onclick=()=>select('milo',false);$('wide').onclick=()=>select('all',false);$('cat').onclick=()=>select('cat');
  for(const id of Object.keys(variants))$(id).onclick=()=>quality(id);
  $('pose').onchange=()=>{brain.grooming.age=Number($('pose').value);select();};
  $('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'動作を停止':'動作を再生';settle=60;};
  for(const [id,x] of [['look-left',-1],['look-center',0],['look-right',1]])$(id).onclick=()=>{view.characterCamera.look.setNormalized(x,0);settle=60;};
  const quantile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)]:null;
  function begin(id){quality(id);run={variant:id,age:0,cpu:[],gpu:[],frames:[],calls:[],triangles:[],reflectionCalls:[],reflectionTriangles:[],reflectionCpu:[]};}
  $('measure').onclick=()=>{playing=false;$('play').textContent='動作を再生';brain.grooming.age=Number($('pose').value);select();results=[];begin(sequence[0]);document.querySelectorAll('button,select').forEach(button=>button.disabled=true);};
  select();quality('direct');renderer.info.autoReset=false;
  const wake=()=>{settle=60;},resizeObserver=new ResizeObserver(wake);resizeObserver.observe($('mirror-view'));
  for(const type of ['pointerdown','pointermove','wheel'])$('mirror-view').addEventListener(type,wake,{passive:true});
  function tick(now){
    const frameTime=now-previous;previous=now;if(document.hidden||(!run&&!playing&&settle<=0))return;
    settle--;
    while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
      const item=pending.shift();if(!gl.getParameter(ext.GPU_DISJOINT_EXT))item.run.gpu.push(gl.getQueryParameter(item.query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(item.query);
    }
    const sample=run&&run.age>=40&&run.age<160,query=sample&&ext?gl.createQuery():null;
    renderer.info.reset();if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    reflection={calls:0,triangles:0,cpu:0};
    if(playing){brain.grooming.age+=Math.min(frameTime/1000,.05);if(brain.grooming.age>48)brain.grooming.age=10;}
    const start=performance.now();view.render(1/60,39,actor,brain,cat,care,true);const cpu=performance.now()-start;
    if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,run});}
    if(sample){run.cpu.push(cpu);run.frames.push(frameTime);run.calls.push(renderer.info.render.calls);run.triangles.push(renderer.info.render.triangles);run.reflectionCalls.push(reflection.calls);run.reflectionTriangles.push(reflection.triangles);run.reflectionCpu.push(reflection.cpu);}
    if(run&&++run.age===170){
      const target=view.groomingMirror.getRenderTarget?.();
      results.push({mode:run.variant,cpuMedianMs:quantile(run.cpu,.5),cpuP95Ms:quantile(run.cpu,.95),gpuMedianMs:quantile(run.gpu,.5),gpuP95Ms:quantile(run.gpu,.95),frameMedianMs:quantile(run.frames,.5),drawCalls:quantile(run.calls,.5),triangles:quantile(run.triangles,.5),reflectionCalls:quantile(run.reflectionCalls,.5),reflectionTriangles:quantile(run.reflectionTriangles,.5),reflectionCpuMs:quantile(run.reflectionCpu,.5),texture:target?[target.width,target.height]:null,staticBatches:view.groomingMirror.userData.mirrorQuality?.batches});
      $('metrics').dataset.results=JSON.stringify(results);
      $('metrics').textContent=results.map(result=>`${titles[result.mode]}: GPU ${result.gpuMedianMs?.toFixed(2)??'取得不可'} ms / CPU ${result.cpuMedianMs.toFixed(2)} ms / 鏡 ${result.reflectionCalls} calls・${result.reflectionTriangles.toLocaleString()} triangles (中央値)`).join('\n');
      const next=sequence[sequence.indexOf(run.variant)+1];
      if(next)begin(next);else{run=null;settle=20;document.querySelectorAll('button,select').forEach(button=>button.disabled=false);}
    }
    if(++frame%20===0){
      const target=view.groomingMirror.getRenderTarget?.(),active=variant!=='off'&&view.groomingMirror.visible&&reflection.calls>0;
      const resolution=variant==='direct'?`画面へ直接 ${direct.userData.mirrorQuality.width} × ${direct.userData.mirrorQuality.height}px / MSAA ${direct.userData.mirrorQuality.samples} / 色・ガラス加工なし`:target?`${target.width} × ${target.height}px / MSAA ${target.samples}`:'金属面のみ';
      $('status').textContent=`${titles[variant]} / 反射 ${active?'ON':'OFF'} / ${resolution} / ${run?'測定中…':playing?'動作再生中':'停止した動作で比較'}`;
    }
  }
  renderer.setAnimationLoop(tick);
  addEventListener('pagehide',()=>{resizeObserver.disconnect();for(const type of ['pointerdown','pointermove','wheel'])$('mirror-view').removeEventListener(type,wake);pending.forEach(({query})=>gl.deleteQuery(query));view.groomingMirror=current;legacy.dispose();legacy.geometry.dispose();previousMirror.dispose();previousMirror.geometry.dispose();direct.dispose();direct.geometry.dispose();view.dispose();},{once:true});
}
if(location.protocol==='file:')$('status').textContent='このスタディーはHTTPで開いてください: http://127.0.0.1:8772/3D/studies/milo/mirror.html';
else init().catch(error=>{$('status').textContent=error.message??`読み込み失敗: ${error.target?.src??'不明なアセット'}`;console.error(error);});
