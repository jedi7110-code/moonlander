import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {materials} from '../../src/obs/materials.js';
import {createMilo,animateMilo} from '../../src/obs/characters.js';
import {createMiloToon} from '../../src/obs/milo-toon.js';
import {updateMiloWatch} from '../../src/obs/milo-watch.js';
import {attachElbowStudy} from './elbow-deformation.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let angle=THREE.MathUtils.clamp(Number(params.get('angle')??90)||0,0,140),view=['side','oblique','front'].includes(params.get('view'))?params.get('view'):'side',playing=false;
async function init(){
  const [m,leftHead,rightHead]=await Promise.all([materials(),loadMiloHead(),loadMiloHead(),loadMiloBody()]);
  const canvas=$('elbow-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
  const entries=[leftHead,rightHead].map((head,index)=>{
    head.userData.setAppearance({hair:'crop',beard:'none'});
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x202b2c);scene.environment=environment.texture;
    scene.add(new THREE.HemisphereLight(0xf4f5e7,0x657b7b,2.1));
    const key=new THREE.DirectionalLight(0xfff1d7,2.6);key.position.set(3,5,4);scene.add(key);
    const fill=new THREE.DirectionalLight(0xc5dce7,1.1);fill.position.set(-3,2,-2);scene.add(fill);
    const milo=createMilo(m,head);scene.add(milo);animateMilo(milo,{moving:false,action:null,time:0});
    const fix=index?attachElbowStudy(milo):null,skin=milo.userData.bodySkin;
    const clay=new THREE.MeshStandardMaterial({color:0xc5b6a3,roughness:.8}),surface=skin.material;
    const wireMaterial=new THREE.MeshBasicMaterial({color:0x123b34,wireframe:true,transparent:true,opacity:.42,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const wireGeometry=new THREE.BufferGeometry(),wireIndices=[],attrs=skin.geometry.attributes,indices=skin.geometry.index;
    for(const [name,attribute]of Object.entries(attrs))wireGeometry.setAttribute(name,attribute);
    for(let k=0;k<indices.count;k+=3){const ids=[indices.getX(k),indices.getX(k+1),indices.getX(k+2)];if(ids.every(i=>attrs.armRegion.getX(i)>.95&&attrs.position.getY(i)>1.07&&attrs.position.getY(i)<1.30))wireIndices.push(...ids);}
    wireGeometry.setIndex(wireIndices);
    const wire=new THREE.SkinnedMesh(wireGeometry,wireMaterial);wire.bind(skin.skeleton,skin.bindMatrix);wire.frustumCulled=false;wire.visible=false;wire.renderOrder=3;
    const camera=new THREE.OrthographicCamera(-1,1,1,-1,.02,20),toon=createMiloToon(milo);
    skin.parent.add(wire);
    return{scene,milo,skin,fix,camera,toon,wire,clay,surface};
  });
  let width=1,height=1,dirty=true,last=performance.now(),phase=Math.asin(angle/70-1),frame;
  function updateURL(){const url=new URL(location.href);url.searchParams.set('angle',String(Math.round(angle)));url.searchParams.set('view',view);history.replaceState(null,'',url);}
  function cameras(){
    const side=Number($('arm').value),target=new THREE.Vector3();
    // Use the original hinge for both cameras: identical framing and scale.
    const original=entries[0].milo,rig=original.userData.arms.find(r=>r.side===side);
    original.updateMatrixWorld(true);rig.elbow.getWorldPosition(target);target.y+=.075;target.z+=.065;
    const full=view==='front';let half=Math.max(.33,.285*height/(width/2));
    if(full){
      const wrists=entries.map(entry=>entry.milo.userData.arms.find(r=>r.side===side).hand.getWorldPosition(new THREE.Vector3()));
      const top=Math.max(1.86,...wrists.map(p=>p.y+.18)),bottom=Math.min(.90,...wrists.map(p=>p.y-.16));
      target.set(0,(top+bottom)/2,.10);half=Math.max((top-bottom)/2+.035,.36*height/(width/2));
    }
    const az=full?side*.18:side*(view==='side'?Math.PI/2:1.08),el=full?.07:.04;
    for(const entry of entries){
      const camera=entry.camera;camera.left=-half*(width/2)/height;camera.right=-camera.left;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
      camera.position.copy(target).add(new THREE.Vector3(Math.sin(az)*3,el,Math.cos(az)*3));camera.lookAt(target);
    }
    dirty=true;
  }
  function pose(){
    const chosen=Number($('arm').value),raised=$('pose').value,rotation=raised==='overhead'?-1.7:raised==='reach'?-.70:-.10;
    for(const entry of entries){
      const {milo}=entry;
      animateMilo(milo,{moving:false,action:null,time:0});milo.rotation.set(0,0,0);
      for(const rig of milo.userData.arms){
        rig.arm.rotation.set(rig.side===chosen?rotation:-.08,0,rig.side*.13);
        rig.elbow.rotation.set(rig.side===chosen?-THREE.MathUtils.degToRad(angle):-.08,0,0);rig.hand.rotation.set(0,rig.side*Math.PI/2,0);
      }
      milo.userData.updateWristTwists?.();milo.userData.bandage.visible=false;updateMiloWatch(milo,8);
      milo.updateMatrixWorld(true);entry.skin.skeleton.update();
    }
    $('bend').value=angle;$('bend-output').textContent=Math.round(angle)+'°';$('bend').setAttribute('aria-valuetext',Math.round(angle)+'度');
    document.querySelectorAll('[data-bend]').forEach(button=>button.setAttribute('aria-pressed',Number(button.dataset.bend)===Math.round(angle)));
    $('status').textContent=(chosen<0?'右腕':'左腕')+' / スタディのみ';cameras();dirty=true;
  }
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(2,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));renderer.setSize(width,height,false);cameras();}
  function setPlaying(value){playing=value;$('play').textContent=playing?'一時停止':'曲げ伸ばしを再生';$('play').setAttribute('aria-pressed',playing);phase=Math.asin(THREE.MathUtils.clamp(angle/70-1,-1,1));last=performance.now();if(!value)updateURL();}
  $('bend').oninput=()=>{setPlaying(false);angle=Number($('bend').value);pose();updateURL();};
  document.querySelectorAll('[data-bend]').forEach(button=>button.onclick=()=>{setPlaying(false);angle=Number(button.dataset.bend);pose();updateURL();});
  document.querySelectorAll('[data-view]').forEach(button=>{button.setAttribute('aria-pressed',button.dataset.view===view);button.onclick=()=>{view=button.dataset.view;document.querySelectorAll('[data-view]').forEach(item=>item.setAttribute('aria-pressed',item===button));cameras();updateURL();};});
  $('play').onclick=()=>setPlaying(!playing);$('arm').onchange=pose;$('pose').onchange=pose;
  $('wire').onchange=()=>{entries.forEach(entry=>entry.wire.visible=$('wire').checked);dirty=true;};
  $('shading').onchange=()=>{
    for(const entry of entries){entry.toon?.dispose();entry.toon=null;entry.skin.material=$('shading').value==='clay'?entry.clay:entry.surface;if($('shading').value==='toon')entry.toon=createMiloToon(entry.milo);}
    dirty=true;
  };
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();pose();
  document.querySelectorAll('button,input,select').forEach(control=>control.disabled=false);$('loading').hidden=true;
  function draw(){renderer.setScissorTest(true);entries.forEach((entry,i)=>{const x=i*Math.floor(width/2),w=i?width-x:Math.floor(width/2);renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);entry.toon?.update(w,height);renderer.render(entry.scene,entry.camera);});renderer.setScissorTest(false);dirty=false;}
  function tick(now){frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;if(playing){phase+=dt*.85;angle=70+70*Math.sin(phase);pose();}if(dirty)draw();}
  frame=requestAnimationFrame(tick);
  addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();entries.forEach(entry=>{entry.toon?.dispose();entry.fix?.dispose();entry.wire.geometry.dispose();entry.wire.material.dispose();entry.clay.dispose();});environment.dispose();renderer.dispose();});
}
init().catch(error=>{console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='スタディを読み込めませんでした。'+error.message;});
