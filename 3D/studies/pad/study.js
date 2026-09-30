import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createLeisureProps} from '../../src/obs/leisure.js';
import {createPadStudy} from './model.js';
import {PAD_FINISH,nextPadScreen} from '../../src/obs/pad-screen.js';

const $=id=>document.getElementById(id),canvas=$('pad-view');
try{
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x303831);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);
  scene.environment=env.texture;room.dispose();pmrem.dispose();
  const ambient=new THREE.HemisphereLight(0xe1e9d7,0x4b5149,1.7);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xffedd6,2.6);key.position.set(-.5,1,.7);scene.add(key);
  const fill=new THREE.DirectionalLight(0xc1d3dc,1.1);fill.position.set(.5,.4,-.7);scene.add(fill);
  const underside=new THREE.DirectionalLight(0xd4dcc9,1.1);underside.position.set(-.3,-.7,.5);scene.add(underside);
  const study=createPadStudy();scene.add(study.root);
  $('wear').value=String(PAD_FINISH.wear*100);$('wear-value').textContent=$('wear').value+'%';
  $('brightness').value=String(PAD_FINISH.brightness*100);$('brightness-value').textContent=$('brightness').value+'%';
  $('screen').checked=PAD_FINISH.on;
  document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===PAD_FINISH.color)));
  $('color-name').textContent='チャコール';
  const stock=new THREE.Group(),steel=await new THREE.TextureLoader().loadAsync('/3D/assets/obs/steel.webp');
  steel.colorSpace=THREE.SRGBColorSpace;steel.wrapS=steel.wrapT=THREE.RepeatWrapping;steel.anisotropy=4;
  const standard=(color,roughness,metalness,map=null)=>new THREE.MeshStandardMaterial({color,roughness,metalness,map});
  const original=createLeisureProps(stock,{dark:standard(0x343d3e,.66,.6,steel),metal:standard(0xaab8ba,.38,.83,steel),rubber:standard(0x151c1d,.93,.02),olive:standard(0x859273,.93,0),red:standard(0x963f32,.56,.25)});
  const current=original.tablet;current.visible=false;scene.add(current);
  const grid=new THREE.GridHelper(.8,16,0x7c8b72,0x56634f);grid.position.y=-.018;grid.visible=false;scene.add(grid);
  const camera=new THREE.PerspectiveCamera(34,1,.001,10);camera.up.set(0,0,-1);
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;controls.minDistance=.12;controls.maxDistance=2;controls.screenSpacePanning=true;
  controls.rotateSpeed=.7;controls.zoomSpeed=.7;
  const views={oblique:[.65,1.65,.85],front:[0,1,.0001],back:[0,-1,.0001],edge:[1,.13,.1],dock:[.12,.2,1]};
  const buttons=selector=>[...document.querySelectorAll(selector)];
  const select=(selector,key,value)=>buttons(selector).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===value)));
  const entryView=new URLSearchParams(location.search).get('view');
  let pending=0,preset=Object.hasOwn(views,entryView)?entryView:'oblique',mode='study',light='studio';
  function render(){pending=0;renderer.render(scene,camera);}
  function requestRender(){if(!pending&&!document.hidden)pending=requestAnimationFrame(render);}
  function setView(view){
    preset=view;camera.up.set(0,0,-1);
    const direction=new THREE.Vector3(...views[view]).normalize(),right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
    const slope=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=.26;
    for(const x of [-.122,.122])for(const y of [-.020,.023])for(const z of [-.153,.153]){
      const corner=new THREE.Vector3(x,y,z);
      distance=Math.max(distance,corner.dot(direction)+1.38*Math.max(Math.abs(corner.dot(up))/slope,Math.abs(corner.dot(right))/(slope*camera.aspect)));
    }
    controls.target.set(0,0,0);camera.position.copy(direction).multiplyScalar(distance);controls.update();select('[data-view]','view',view);requestRender();
  }
  controls.addEventListener('change',requestRender);
  controls.addEventListener('start',()=>{preset=null;select('[data-view]','view',null);});
  buttons('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
  $('reset').onclick=()=>setView('oblique');canvas.ondblclick=()=>setView('oblique');
  buttons('[data-model]').forEach(button=>button.onclick=()=>{
    mode=button.dataset.model;study.root.visible=mode==='study';current.visible=mode==='current';$('design').disabled=mode==='current';
    select('[data-model]','model',mode);$('edition').textContent=mode==='study'?'01 / 業務端末案':'00 / 現行の端末';
    $('model-note').textContent=mode==='study'?'保護バンパーと物理キーを備えた船内備品。画面は筐体の縁より一段奥へ。':'本編へ反映した端末。チャコール・擦れ 0%・明るさ 85%。画面はランダムに選択。';requestRender();
  });
  buttons('[data-color]').forEach(button=>button.onclick=()=>{study.setColor(button.dataset.color);select('[data-color]','color',button.dataset.color);$('color-name').textContent=button.getAttribute('aria-label');requestRender();});
  $('wear').oninput=()=>{study.setWear(Number($('wear').value)/100);$('wear-value').textContent=$('wear').value+'%';requestRender();};
  let page='lounge';
  function screen(){study.drawScreen($('screen').checked,Number($('brightness').value)/100,page);$('brightness-value').textContent=$('brightness').value+'%';requestRender();}
  buttons('[data-page]').forEach(button=>button.onclick=()=>{page=button.dataset.page==='random'?nextPadScreen(page):button.dataset.page;select('[data-page]','page',page);screen();});
  $('brightness').oninput=screen;$('screen').onchange=screen;
  buttons('[data-light]').forEach(button=>button.onclick=()=>{
    light=button.dataset.light;const dim=light==='cabin';ambient.intensity=dim?.18:1.7;key.intensity=dim?.38:2.6;fill.intensity=dim?.12:1.1;
    underside.intensity=dim?.08:1.1;
    scene.environment=dim?null:env.texture;scene.background.set(dim?0x151f1a:0x303831);select('[data-light]','light',light);requestRender();
  });
  $('grid').onchange=()=>{grid.visible=$('grid').checked;requestRender();};
  const observer=new ResizeObserver(()=>{
    const {width,height}=canvas.getBoundingClientRect();renderer.setSize(Math.max(1,width),Math.max(1,height),false);camera.aspect=width/height;camera.updateProjectionMatrix();
    if(preset)setView(preset);else requestRender();
  });observer.observe(canvas);document.addEventListener('visibilitychange',requestRender);$('status').hidden=true;
  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;
    cancelAnimationFrame(pending);observer.disconnect();controls.dispose();env.dispose();
    const geometries=new Set(),materials=new Set(),textures=new Set([steel]);
    for(const parent of [scene,stock])parent.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material??[])){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();
  },{once:true});
}catch(error){$('status').hidden=false;$('status').textContent=`読み込みに失敗しました: ${error.message}`;console.error(error);}
