import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {materials} from '../../src/obs/materials.js';
import {createMilo,animateMilo} from '../../src/obs/characters.js';
import {createMiloToon} from '../../src/obs/milo-toon.js';
import {attachGrowthStudy,growthAtDay,studyDate,GROWTH_DAYS} from './growth-model.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let day=growthAtDay(params.get('day')??15).day,start=params.get('start')??'2026-09-24',view='oblique',playing=false;
if(!studyDate(start,1))start='2026-09-24';
$('start-date').value=start;
async function init(){
  const [m,leftHead,rightHead]=await Promise.all([materials(),loadMiloHead(),loadMiloHead(),loadMiloBody()]);
  const canvas=$('growth-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
  const scenes=[leftHead,rightHead].map(head=>{
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x202b2c);scene.environment=environment.texture;
    scene.add(new THREE.HemisphereLight(0xf4f5e7,0x657b7b,2.1));
    const key=new THREE.DirectionalLight(0xfff1d7,2.6);key.position.set(-3,5,5);scene.add(key);
    const fill=new THREE.DirectionalLight(0xc5dce7,1.2);fill.position.set(3,2,2);scene.add(fill);
    const growth=attachGrowthStudy(head),milo=createMilo(m,head);scene.add(milo);
    animateMilo(milo,{moving:false,action:null,time:0,actionTime:0});
    const toon=createMiloToon(milo),camera=new THREE.OrthographicCamera(-1,1,1,-1,.05,20);
    return{scene,milo,growth,toon,camera};
  });
  scenes[0].growth.setDay(1);
  let width=0,height=0,last=performance.now(),frame=0,dirty=true;
  function cameras(){
    const full=view==='body',half=full?1.08:.275,target=new THREE.Vector3(0,full?.91:1.705,.015);
    const az=view==='front'?0:view==='side'?Math.PI/2:.52;
    for(const entry of scenes){
      entry.camera.left=-half*(width/2)/height;entry.camera.right=-entry.camera.left;
      entry.camera.top=half;entry.camera.bottom=-half;entry.camera.updateProjectionMatrix();
      entry.camera.position.copy(target).add(new THREE.Vector3(Math.sin(az)*3,.07,Math.cos(az)*3));entry.camera.lookAt(target);
    }
    dirty=true;
  }
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));renderer.setSize(width,height,false);cameras();}
  function updateURL(){const url=new URL(location.href);url.searchParams.set('day',String(Math.round(day*100)/100));url.searchParams.set('start',start);history.replaceState(null,'',url);}
  function updateDay(value,{url=true}={}){
    const state=scenes[1].growth.setDay(value);day=state.day;
    const label='DAY '+Math.floor(day);
    $('current-day').textContent=label;$('day-output').textContent=label+' / 15';$('growth-day').value=day;
    $('growth-day').setAttribute('aria-valuetext',label);
    for(const [id,value]of [['baseline-date',studyDate(start,1)],['current-date',studyDate(start,day)]]){
      $(id).dateTime=value;$(id).textContent=value.replaceAll('-','.')+' / 08:00';
    }
    $('growth-description').textContent=day===1?'短髪A・髭なし':day<5?'毛流れに沿って伸び始め・薄い無精髭':day<10?'毛束と毛先が伸びる・頬と顎に無精髭':day<15?'前のスタディの長さへ・濃い無精髭':'前のスタディの髪型・最終の長さ';
    $('day16-link').href='./grooming.html?time=0&start='+start;
    for(const button of document.querySelectorAll('[data-day]'))button.setAttribute('aria-pressed',Number(button.dataset.day)===Math.floor(day));
    if(url)updateURL();dirty=true;
  }
  function setPlaying(value){playing=value;$('growth-play').textContent=playing?'一時停止':'15日間を再生';$('growth-play').setAttribute('aria-pressed',playing);last=performance.now();if(!playing)updateURL();}
  $('growth-day').oninput=()=>{setPlaying(false);updateDay($('growth-day').value);};
  for(const button of document.querySelectorAll('[data-day]'))button.onclick=()=>{setPlaying(false);updateDay(button.dataset.day);};
  for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{view=button.dataset.view;for(const item of document.querySelectorAll('[data-view]'))item.setAttribute('aria-pressed',item===button);cameras();};
  $('growth-play').onclick=()=>{if(day>=GROWTH_DAYS)updateDay(1);setPlaying(!playing);};
  $('start-date').onchange=()=>{if(studyDate($('start-date').value,1)){start=$('start-date').value;updateDay(day);}else $('start-date').value=start;};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();updateDay(day);
  document.querySelectorAll('button,input').forEach(control=>control.disabled=false);$('loading').hidden=true;
  function draw(){
    renderer.setScissorTest(true);
    scenes.forEach((entry,i)=>{
      const x=i*Math.floor(width/2),w=i?width-x:Math.floor(width/2);
      renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);
      entry.toon.update(w,height);renderer.render(entry.scene,entry.camera);
    });
    renderer.setScissorTest(false);dirty=false;
  }
  function tick(now){
    frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.1);last=now;
    if(document.hidden)return;
    if(playing){updateDay(Math.min(15,day+dt*14/18),{url:false});if(day===15){setPlaying(false);updateURL();}}
    if(dirty)draw();
  }
  frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();scenes.forEach(entry=>entry.toon.dispose());environment.dispose();renderer.dispose();});
}
init().catch(error=>{console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='スタディを読み込めませんでした。'+error.message;});
