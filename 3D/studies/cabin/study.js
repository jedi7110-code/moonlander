import {ObservationView} from '../../src/obs/view.js';
import {CabinBrain} from '../../src/obs/brain.js';
import {CrewMotion,Supplies,CatRoutine} from '../../src/obs/state.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const styles={current:{name:'今のver',tag:'01 / CURRENT',description:'現在の船内材質。反射・細かな凹凸・汚れを含む表示です。'},
  cartoon:{name:'cartoon ver',tag:'02 / CARTOON',description:'三段階の陰影。船内の輪郭線は全景で0px、拡大につれて1pxへ。表示板・ガラス・濡れた鎖や床の艶は残します。'},
  flat:{name:'cartoon 線なしver',tag:'03 / CARTOON — NO OUTLINE',description:'船内の輪郭線だけを省いた、同じカートゥーン材質です。猫・マイロの表示は共通です。'}};
const cameras={all:null,habitation:{x:6,y:5.2,height:5.8},galley:{x:-8.7,y:1.4,height:5.4},
  operations:{x:-6.6,y:8.1,height:5.5},machinery:{x:8.1,y:1.4,height:5.5}};
const average=a=>a.length?a.reduce((sum,n)=>sum+n,0)/a.length:null;
const rounded=n=>n==null?'—':n.toFixed(1);
let view,effect,signage,request,mode='current',preset='all',running=false,measuring=false,time=1.2;

async function start(){
  view=await ObservationView.create($('ship-view'),{cabinStyle:'current'});
  signage=view.cabinSignage;
  const signSamples=$('sign-samples');
  for(const {before,after,spec}of signage.samples){
    const item=document.createElement('figure'),caption=document.createElement('figcaption');
    caption.textContent=spec.text.replaceAll('\n',' / ');item.append(caption);
    for(const [name,source]of [['変更前',before],['NASA参考',after]]){
      const label=document.createElement('span'),copy=document.createElement('canvas');label.textContent=name;
      copy.width=source.width;copy.height=source.height;copy.getContext('2d').drawImage(source,0,0);item.append(label,copy);
    }
    item.dataset.fits=String(spec.fits);signSamples.append(item);
  }
  $('sign-summary').textContent=`${signage.samples.length}枚のサイン／Helvetica Neue 500／字間0em・左揃え`;
  const care=new Supplies(),actor=new CrewMotion(),cat=new CatRoutine(care,{random:()=>.5});
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{}},actor,{care,name:'MILO',random:()=>.5});
  effect=view.cabinToon;
  const gl=view.renderer.getContext(),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let pending=[],epoch=0,gpu=[],intervals=[],last=performance.now(),lastHUD=last,frames=0;
  function clearReadings(){epoch++;gpu=[];intervals=[];for(const {query}of pending)gl.deleteQuery(query);pending=[];last=performance.now();}
  function updateURL(){const url=new URL(location.href);url.searchParams.set('style',mode);url.searchParams.set('view',preset);history.replaceState(null,'',url);}
  function setStyle(next){
    if(!styles[next])return;
    mode=next;effect.setStyle(mode);clearReadings();
    for(const button of document.querySelectorAll('[data-style]'))button.setAttribute('aria-pressed',String(button.dataset.style===mode));
    $('version').textContent=styles[mode].tag;$('description').textContent=styles[mode].description;updateURL();
  }
  function setCamera(next){
    if(!Object.hasOwn(cameras,next))return;
    if(next==='all')view.setMode('all');
    else{const camera=cameras[next];view.setMode('manual');view.targetCenter.set(camera.x,camera.y,0);view.targetHeight=camera.height;}
    preset=next;$('view').value=next;
    view.center.copy(view.targetCenter);view.viewHeight=view.targetHeight;view.setFrustum();clearReadings();updateURL();
  }
  view.onModeChange=next=>{if(next==='manual'){preset='manual';$('view').value='manual';}};
  view.onStation=null;
  function draw(dt){view.render(dt,time,actor,brain,cat,care,true);}
  function poll(){
    while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
      const sample=pending.shift();if(sample.epoch===epoch&&!gl.getParameter(timer.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(sample.query,gl.QUERY_RESULT)/1e6);
      gl.deleteQuery(sample.query);if(gpu.length>30)gpu.shift();
    }
  }
  function measuredDraw(dt){
    let query=null;
    if(timer&&frames++%8===0&&pending.length<6){query=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}
    draw(dt);
    if(query){gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push({query,epoch});}
    if(timer)poll();
  }
  function frame(now){
    request=requestAnimationFrame(frame);
    const delta=now-last;last=now;
    if(document.hidden||measuring)return;
    const dt=Math.min(delta/1000,.05);
    if(running){time+=dt;cat.modeTime+=dt;view.ship.fan.rotation.z+=dt*3;}
    measuredDraw(dt);intervals.push(delta);if(intervals.length>90)intervals.shift();
    if(now-lastHUD>600){lastHUD=now;
      $('outline-width').textContent=effect.width.toFixed(2)+'px';
      $('status').textContent=`${styles[mode].name}　FPS ${rounded(1000/average(intervals))}　GPU ${timer?rounded(average(gpu))+' ms':'取得不可'}　描画 ${view.renderer.info.render.calls} 回　${Math.round(view.width)} × ${Math.round(view.height)}`;
    }
  }
  const controls=[...document.querySelectorAll('button,select')];
  $('signage').onclick=()=>{$('sign-dialog').showModal();};
  $('close-signs').onclick=()=>{$('sign-dialog').close();};
  for(const button of document.querySelectorAll('[data-style]'))button.onclick=()=>setStyle(button.dataset.style);
  $('view').onchange=()=>setCamera($('view').value);
  $('in').onclick=()=>view.changeZoom(1.25);$('out').onclick=()=>view.changeZoom(.8);
  $('reset').onclick=()=>setCamera(preset==='manual'?'all':preset);
  $('animate').onclick=()=>{running=!running;$('animate').textContent=running?'動きを停止':'動きを再生';$('animate').setAttribute('aria-pressed',String(running));clearReadings();};
  const raf=()=>new Promise(requestAnimationFrame);
  $('close-comparison').onclick=()=>{$('comparison').hidden=true;};
  $('measure').onclick=async()=>{
    $('error').hidden=true;
    $('comparison').hidden=true;
    measuring=true;controls.forEach(c=>c.disabled=true);$('ship-view').style.pointerEvents='none';
    const saved={mode,running,preset,center:view.center.clone(),target:view.targetCenter.clone(),height:view.viewHeight,targetHeight:view.targetHeight,cameraMode:view.mode};
    const width=view.width,height=view.height;view.targetCenter.copy(view.center);view.targetHeight=view.viewHeight;view.mode='manual';
    const results=[],activeQueries=new Set();
    try{
      for(const [index,style]of ['current','cartoon','flat','flat','cartoon','current'].entries()){
        setStyle(style);$('status').textContent=`比較計測 ${index+1}/6：${styles[style].name}`;
        for(let i=0;i<25;i++){await raf();draw(0);}
        const intervals=[],times=[],calls=[],queries=[];let previous=await raf();
        for(let i=0;i<100;i++){
          const now=await raf();
          if(document.hidden||view.width!==width||view.height!==height)throw new Error('画面の状態が変わったため計測を中断しました。');
          intervals.push(now-previous);previous=now;
          let query=null;if(timer&&i%8===0){query=gl.createQuery();activeQueries.add(query);gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}
          draw(0);calls.push(view.renderer.info.render.calls);
          if(query){gl.endQuery(timer.TIME_ELAPSED_EXT);queries.push(query);}
          while(queries.length&&gl.getQueryParameter(queries[0],gl.QUERY_RESULT_AVAILABLE)){
            const q=queries.shift();if(!gl.getParameter(timer.GPU_DISJOINT_EXT))times.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);activeQueries.delete(q);
          }
        }
        for(const query of queries){gl.deleteQuery(query);activeQueries.delete(query);}
        results.push({style,fps:1000/average(intervals),gpu:average(times),calls:average(calls)});
      }
      $('measurements').replaceChildren();
      for(const style of Object.keys(styles)){
        const samples=results.filter(r=>r.style===style),row=document.createElement('tr');
        for(const text of [styles[style].name,rounded(average(samples.map(r=>r.fps))),timer?rounded(average(samples.flatMap(r=>r.gpu==null?[]:[r.gpu])))+' ms':'取得不可',Math.round(average(samples.map(r=>r.calls)))]){
          const cell=document.createElement('td');cell.textContent=text;row.append(cell);
        }
        $('measurements').append(row);
      }
      $('measured-context').textContent=`${$('view').selectedOptions[0].textContent}　${Math.round(width)} × ${Math.round(height)}／静止状態で2回測定`;
      $('comparison').hidden=false;
    }catch(error){$('error').textContent=error.message;$('error').hidden=false;}
    finally{
      for(const query of activeQueries)gl.deleteQuery(query);
      view.center.copy(saved.center);view.targetCenter.copy(saved.target);view.viewHeight=saved.height;view.targetHeight=saved.targetHeight;view.mode=saved.cameraMode;
      running=saved.running;preset=saved.preset;setStyle(saved.mode);measuring=false;controls.forEach(c=>c.disabled=false);$('ship-view').style.pointerEvents='';last=performance.now();
    }
  };
  setStyle(styles[params.get('style')]?params.get('style'):'current');
  setCamera(Object.hasOwn(cameras,params.get('view'))?params.get('view'):'all');
  controls.forEach(control=>control.disabled=false);$('loading').hidden=true;
  request=requestAnimationFrame(frame);
}
window.addEventListener('pagehide',event=>{if(!event.persisted){cancelAnimationFrame(request);view?.dispose();}});
start().catch(error=>{console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='船内を読み込めませんでした。'+error.message;});
