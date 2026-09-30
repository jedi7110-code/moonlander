import {PlaneGeometry} from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {ObservationView} from '../../src/obs/view.js';
import {CabinBrain} from '../../src/obs/brain.js';
import {Supplies,CrewMotion,CatRoutine,getStation} from '../../src/obs/state.js';
import {GroomingVisit} from '../../src/obs/grooming-visit.js';

const $=id=>document.getElementById(id);
async function init(){
  const care=new Supplies(),actor=new CrewMotion(getStation('grooming')),cat=new CatRoutine(care,{turns:true});
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{hideWant(){}}},actor,{care,random:()=>.9});
  brain.grooming=new GroomingVisit(1);brain.grooming.age=41;brain.state='grooming';brain.actStation='grooming';
  const view=await ObservationView.create($('mirror-view'),{characterViews:true});
  const current=view.groomingMirror,legacy=new Reflector(new PlaneGeometry(.72,.89),{color:0xa8b5b5,textureWidth:256,textureHeight:384,clipBias:.002,multisample:0});
  legacy.getRenderTarget().stencilBuffer=true;legacy.visible=false;current.parent.add(legacy);
  let variant='current',frame=0,run=null,settle=60,previous=performance.now(),results=[];
  const renderer=view.renderer,gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];
  function select(id='milo',pov=true){view.setMode(id);if(pov&&id!=='all')view.characterCamera.toggleFirstPerson();settle=60;}
  function quality(id){current.visible=legacy.visible=false;variant=id;view.groomingMirror=id==='current'?current:legacy;for(const key of ['current','legacy'])$(key).setAttribute('aria-pressed',String(key===id));settle=60;}
  $('pov').onclick=()=>select();$('follow').onclick=()=>select('milo',false);$('wide').onclick=()=>select('all',false);$('cat').onclick=()=>select('cat');
  $('current').onclick=()=>quality('current');$('legacy').onclick=()=>quality('legacy');
  const quantile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)]:null;
  function begin(id){quality(id);run={variant:id,age:0,cpu:[],gpu:[],frames:[],calls:[],triangles:[]};}
  $('measure').onclick=()=>{select();results=[];begin('legacy');document.querySelectorAll('button').forEach(button=>button.disabled=true);};
  select();renderer.info.autoReset=false;
  function tick(now){
    const frameTime=now-previous;previous=now;if(document.hidden||(!run&&settle<=0))return;
    settle--;
    while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
      const item=pending.shift();if(!gl.getParameter(ext.GPU_DISJOINT_EXT))item.run.gpu.push(gl.getQueryParameter(item.query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(item.query);
    }
    const sample=run&&run.age>=40&&run.age<160,query=sample&&ext?gl.createQuery():null;
    renderer.info.reset();if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    const start=performance.now();view.render(1/60,39,actor,brain,cat,care,true);const cpu=performance.now()-start;
    if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,run});}
    if(sample){run.cpu.push(cpu);run.frames.push(frameTime);run.calls.push(renderer.info.render.calls);run.triangles.push(renderer.info.render.triangles);}
    if(run&&++run.age===170){
      results.push({mode:run.variant,cpuMedianMs:quantile(run.cpu,.5),cpuP95Ms:quantile(run.cpu,.95),gpuMedianMs:quantile(run.gpu,.5),gpuP95Ms:quantile(run.gpu,.95),frameMedianMs:quantile(run.frames,.5),drawCalls:quantile(run.calls,.5),triangles:quantile(run.triangles,.5),texture:[view.groomingMirror.getRenderTarget().width,view.groomingMirror.getRenderTarget().height]});
      $('metrics').dataset.results=JSON.stringify(results);
      $('metrics').textContent=results.map(result=>`${result.mode==='current'?'改善後':'以前'}: GPU ${result.gpuMedianMs?.toFixed(2)??'取得不可'} ms / CPU ${result.cpuMedianMs.toFixed(2)} ms / ${result.drawCalls} draw calls (中央値)`).join('\n');
      if(run.variant==='legacy')begin('current');else{run=null;settle=20;document.querySelectorAll('button').forEach(button=>button.disabled=false);}
    }
    if(++frame%20===0){const target=view.groomingMirror.getRenderTarget();$('status').textContent=`${variant==='current'?'改善後':'以前'} / 反射 ${view.groomingMirror.visible?'ON':'OFF'} / ${target.width} × ${target.height}px / MSAA ${target.samples} / ${run?'測定中…':'停止した動作で比較'}`;}
  }
  renderer.setAnimationLoop(tick);
  addEventListener('pagehide',()=>{pending.forEach(({query})=>gl.deleteQuery(query));view.groomingMirror=current;legacy.dispose();legacy.geometry.dispose();view.dispose();},{once:true});
}
init().catch(error=>{$('status').textContent=error.message??`読み込み失敗: ${error.target?.src??'不明なアセット'}`;console.error(error);});
