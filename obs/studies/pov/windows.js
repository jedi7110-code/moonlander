import {Group,Mesh,MeshBasicMaterial,PlaneGeometry,MathUtils,Scene,Vector2,WebGLRenderTarget} from 'three';
import {ObservationView} from '../../src/obs/view.js';
import {CabinBrain} from '../../src/obs/brain.js';
import {Supplies,CrewMotion,CatRoutine} from '../../src/obs/state.js';
import {FLOOR_Y} from '../../src/obs/ship.js';
import {createSpaceBackdrop,createSpaceStars,SPACE_COLOR} from '../../src/obs/space-stars.js';
import {VIEWING_WALL,viewingWallPanelX} from '../../src/obs/viewing-wall-profile.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
async function init(){
  const care=new Supplies(),actor=new CrewMotion({floor:1,x:300}),cat=new CatRoutine(care,{turns:true});
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{hideWant(){}}},actor,{care,random:()=>.9});
  const view=await ObservationView.create($('window-view'),{characterViews:true});
  // The only legacy geometry lives in this comparison page, never in OBS.
  const fixed=view.characterCamera.wall.getObjectByName('POV / space beyond windows'),legacy=new Group(),full=new Group();
  const windows=FLOOR_Y.flatMap(floor=>[2,5,8,11,14].map(i=>({x:viewingWallPanelX(i),y:floor+VIEWING_WALL.windowY,z:VIEWING_WALL.faceZ+.145,width:VIEWING_WALL.windowWidth,height:VIEWING_WALL.windowHeight,cut:.12})));
  const oldSky=createSpaceBackdrop();oldSky.renderOrder=-1;
  full.add(oldSky,createSpaceStars({panoramic:true,windows,optimizeWindows:false}));
  const card=new Mesh(new PlaneGeometry(240,140),new MeshBasicMaterial({color:SPACE_COLOR,toneMapped:false,depthWrite:false}));
  card.position.set(0,6,90);card.rotation.y=Math.PI;card.renderOrder=-1;legacy.add(card,createSpaceStars());
  view.characterCamera.wall.add(legacy,full);
  const variants={fixed,full,legacy},titles={fixed:'軽量版',full:'軽量化前',legacy:'初期の背景板'};
  const stars=Object.fromEntries(Object.entries(variants).map(([id,group])=>[id,group.getObjectByName('POV / stars')]));
  for(const [type,fn,options]of view.listeners)$('window-view').removeEventListener(type,fn,options);view.listeners=[];
  view.setMode('milo');view.characterCamera.toggleFirstPerson();
  let variant='fixed',walking=false,settle=60,previous=performance.now(),phase=0,run=null,results=[];
  const renderer=view.renderer,gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[],sequence=['full','fixed','full','fixed'];
  // A query around each tiny draw forces GPU pass boundaries and overwhelms
  // the work being measured. Batch 200 isolated sky renders in one query.
  // This is a microbenchmark, not the whole cabin's FPS or the depth-cull gain.
  function measureSky(sample){
    if(!ext)return;
    const size=renderer.getDrawingBufferSize(new Vector2()),target=new WebGLRenderTarget(size.x,size.y),scene=new Scene();
    const backdrop=createSpaceBackdrop(),field=createSpaceStars({panoramic:true,windows,optimizeWindows:sample.variant==='fixed'});
    if(sample.variant==='full')backdrop.renderOrder=-1;
    scene.add(backdrop,field);
    const previousTarget=renderer.getRenderTarget(),query=gl.createQuery(),iterations=200;
    try{
      renderer.setRenderTarget(target);
      for(let i=0;i<10;i++)renderer.render(scene,view.camera);
      gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
      for(let i=0;i<iterations;i++)renderer.render(scene,view.camera);
      gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,run:sample,divisor:iterations});
    }finally{renderer.setRenderTarget(previousTarget);target.dispose();for(const object of [backdrop,field]){object.geometry.dispose();object.material.dispose();}}
  }
  const median=values=>values.length?[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]:null;
  for(const id of ['angle','deck','window','distance'])if(params.has(id))$(id).value=params.get(id);
  const wake=()=>{settle=30;};
  function mode(id){variant=id;for(const [name,group]of Object.entries(variants)){group.visible=name===id;$(name).setAttribute('aria-pressed',String(name===id));}wake();}
  for(const id of Object.keys(variants))$(id).onclick=()=>mode(id);
  mode(Object.hasOwn(variants,params.get('mode'))?params.get('mode'):'fixed');
  function begin(id){mode(id);run={variant:id,age:0,cpu:[],gpu:[],skyGpu:[],points:[]};}
  $('measure').onclick=()=>{walking=false;$('walk').textContent='左右に歩く';results=[];begin(sequence[0]);document.querySelectorAll('button,select,input').forEach(control=>control.disabled=true);};
  for(const [id,angle]of [['front',0],['left',-65],['right',65]])$(id).onclick=()=>{$('angle').value=angle;wake();};
  for(const id of ['angle','deck','window','distance'])$(id).oninput=wake;
  $('walk').onclick=()=>{walking=!walking;$('walk').textContent=walking?'停止':'左右に歩く';wake();};
  view.setFrustum=()=>{
    const camera=view.camera,floor=FLOOR_Y[Number($('deck').value)],x=viewingWallPanelX(Number($('window').value));
    const angle=Number($('angle').value),targetZ=VIEWING_WALL.faceZ+.1;
    // Move closer at the end windows, keeping the eye inside the pressure hull.
    const depth=Math.min(targetZ-Number($('distance').value),(12.1-Math.abs(x))/Math.max(.01,Math.abs(Math.tan(MathUtils.degToRad(angle)))));
    camera.position.set(x-depth*Math.tan(MathUtils.degToRad(angle)),floor+1.62,targetZ-depth);
    camera.up.set(0,1,0);camera.lookAt(x,floor+VIEWING_WALL.windowY,targetZ);
    camera.fov=70;camera.aspect=view.width/view.height;camera.near=.025;camera.far=150;
    camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  };
  const resize=new ResizeObserver(wake);resize.observe($('window-view'));
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    if(document.hidden||(!run&&!walking&&settle--<=0))return;
    while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
      const item=pending.shift();if(!gl.getParameter(ext.GPU_DISJOINT_EXT)){
        const ms=gl.getQueryParameter(item.query,gl.QUERY_RESULT)/1e6;
        if(item.divisor)item.run.skyGpu.push(ms/item.divisor);else item.run.gpu.push(ms);
      }gl.deleteQuery(item.query);
    }
    if(walking){phase+=dt*.35;$('angle').value=Math.round(Math.sin(phase)*75);}
    const sample=run&&run.age>=40&&run.age<160,query=sample&&ext?gl.createQuery():null;
    if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    const started=performance.now();
    view.render(1/60,39,actor,brain,cat,care,true);
    const cpu=performance.now()-started,points=Math.min(stars[variant].geometry.drawRange.count,stars[variant].geometry.attributes.position.count);
    if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,run});}
    if(sample){run.cpu.push(cpu);run.points.push(points);}
    if(run&&++run.age===165)measureSky(run);
    if(run&&run.age>=180&&(!ext||run.skyGpu.length||run.age>=300)){
      results.push({mode:run.variant,cpuMs:median(run.cpu),gpuMs:median(run.gpu),skyGpuMs:median(run.skyGpu),submittedStars:median(run.points)});
      $('metrics').dataset.results=JSON.stringify(results);
      $('metrics').textContent=results.map((r,i)=>`${i+1}. ${titles[r.mode]}: 星 ${r.submittedStars} 個 / 全体CPU ${r.cpuMs.toFixed(2)} ms / 全体GPU ${r.gpuMs?.toFixed(3)??'取得不可'} ms / 星空単独 ${r.skyGpuMs?.toFixed(3)??'取得不可'} ms`).join('\n')+'\n全体は120フレームの中央値。星空単独は専用バッファへ200回描く平均（船内全体のFPSとは別）。';
      if(results.length<sequence.length)begin(sequence[results.length]);else{run=null;mode('fixed');document.querySelectorAll('button,select,input').forEach(control=>control.disabled=false);}
    }
    $('status').textContent=`${titles[variant]} / 角度 ${$('angle').value}° / 星の描画 ${points.toLocaleString()} 個 / ${run?'測定中…':walking?'歩行中':'停止中'}`;
    history.replaceState(null,'',`?angle=${$('angle').value}&deck=${$('deck').value}&window=${$('window').value}&distance=${$('distance').value}&mode=${variant}`);
  });
  addEventListener('pagehide',()=>{resize.disconnect();pending.forEach(({query})=>gl.deleteQuery(query));view.dispose();},{once:true});
}
init().catch(error=>{$('status').textContent=`読み込み失敗: ${error.message??error}`;console.error(error);});
