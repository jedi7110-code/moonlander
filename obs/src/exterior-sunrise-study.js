import * as THREE from 'three';
import {createProductionExterior} from './obs/exterior-production.js';
import {createExteriorPlanet} from './obs/exterior-planet.js';
import {sampleExteriorCinema,CINEMA_SHOTS} from './obs/exterior-cinematic.js';
import {createExteriorShadow} from './obs/exterior-shadow.js';
import {createDistantStars} from './obs/exterior-stars.js';
import {createSunriseStudy} from './obs/exterior-sunrise-study.js';

// Do not await the lazy probe at module scope: an isolated study build shares
// model helpers with that chunk, which must be able to import this module.
async function startStudy(){
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
const scene04=query.get('scene')==='04',number=scene04?'04':'02';
const startOf=number=>CINEMA_SHOTS.slice(0,CINEMA_SHOTS.findIndex(shot=>shot.number===number)).reduce((sum,shot)=>sum+shot.duration,0);
const selected=CINEMA_SHOTS.find(shot=>shot.number===(scene04?4:2)),start=startOf(selected.number);
const range=[start+(scene04?0:CINEMA_SHOTS[0].dissolve/2),start+selected.duration-.01];
const reveal=(scene04?[.5,8.5]:[5,13]).map(offset=>start+offset);
const sunriseSettings={...(scene04?{direction:[-.9,.435]}:{}),reveal};
for(const link of document.querySelectorAll('nav a')){
  const url=new URL(link.href),number=Number(url.searchParams.get('scene'));
  const shot=CINEMA_SHOTS.find(shot=>shot.number===number);
  url.searchParams.set('time',Math.min(startOf(number)+(number===4?8.5:13),startOf(number)+shot.duration-.01));link.href=url.href;
}
document.title=number+' / 惑星の縁からの恒星';document.querySelector('h1').textContent=number+' — 惑星の縁からの恒星';
$('description').textContent=(scene04?'惑星の影側・左上の縁から':'惑星の右下の縁から')+'、白い光と暖色の眩しさが画面全体に広がるサンプル。'+number+'をループ再生。スタディー限定。';
$('view').setAttribute('aria-label','シーン'+number+'の恒星フレア比較');
$('time').min=range[0];$('time').max=range[1];
$('note').textContent=(reveal[0]+3.5).toFixed(1)+'〜'+reveal[1].toFixed(1)+'秒ごろに、輪郭のない白い光と暖色のかぶりが広がります。「光の広がり」で局所的な光と比較できます。';
$('production').textContent='本番の'+number+'を開く';
const productionURL=new URL($('production').href);productionURL.searchParams.set('time',start+(scene04?5:3.5));$('production').href=productionURL.href;
const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#030609');
const ship=createProductionExterior();ship.setCoreScale(2.6);scene.add(ship.root);
if(scene04)await ship.prepareProbe();
const planet=createExteriorPlanet({variant:'rust'});scene.add(planet.body);
const camera=new THREE.PerspectiveCamera(42,16/9,5,60000),target=new THREE.Vector3();
const stars=createDistantStars();scene.add(stars.haze,stars.field,new THREE.HemisphereLight(0xc4d5e1,0x394b53,.68));
const light=new THREE.DirectionalLight(0xfff2d4,3.15),bounce=new THREE.DirectionalLight(0x8ca7bd,.65),shadows=createExteriorShadow(light,ship);scene.add(light,light.target,bounce,bounce.target);
const sunrise=createSunriseStudy();scene.add(sunrise.mesh);
const stellarLight=new THREE.Vector3(),originalPlanetLight=planet.body.material.uniforms.lightDirection.value.clone();
let time=THREE.MathUtils.clamp(Number(query.get('time'))||(start+(scene04?5:3.5)),...range),playing=query.get('paused')!=='1',enabled=true,last=0,frame,disposed=false;
let spread=query.get('look')!=='local';$('look').value=spread?'wide':'local';
function draw(){
  const shot=sampleExteriorCinema(time,{opening:true,approach:'bow',ending:'underside',docking:'probe-follow',aspect:camera.aspect});
  camera.position.fromArray(shot.eye);
  // Fit the complete horizontal composition in the optional portrait study.
  camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(shot.fov/2))*Math.max(1,(16/9)/camera.aspect)));
  camera.near=shot.near;camera.far=shot.far;camera.up.fromArray(shot.up);camera.updateProjectionMatrix();camera.lookAt(target.fromArray(shot.target));
  ship.root.position.x=shot.shipX;ship.root.scale.setScalar(shot.shipScale??1);ship.setAngle(shot.angle);
  planet.body.scale.setScalar(shot.planet.scale);planet.show(shot.planet.position);stars.follow(camera);shadows.update(shot);
  bounce.position.set(shot.shipX-38,-15,-30);bounce.target.position.set(shot.shipX,0,0);
  const visible=sunrise.update(camera,planet.body,time,{enabled,spread,...sunriseSettings});
  // The star is behind the planet. Its visible face must therefore be in
  // shadow, with a lit upper-left rim, rather than lit from the old lower-right.
  if(scene04&&enabled){
    sunrise.lightDirection(camera,stellarLight);
    planet.body.material.uniforms.lightDirection.value.copy(stellarLight);
    light.position.copy(light.target.position).addScaledVector(stellarLight,150);
  }else planet.body.material.uniforms.lightDirection.value.copy(originalPlanetLight);
  renderer.render(scene,camera);$('clock').textContent=time.toFixed(2)+' 秒';$('time').value=time;
  $('state').textContent=!enabled?'現在の'+number:visible===0?'惑星の背後':spread?'画面に広がる眩しさ':'局所的なにじみ';
}
function resize(){const r=$('film').getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/r.height;draw();}
function play(value){playing=value;last=0;$('play').textContent=value?'一時停止':'再生';}
$('play').onclick=()=>play(!playing);$('restart').onclick=()=>{time=range[0];draw();play(true);};
$('effect').onclick=()=>{enabled=!enabled;$('effect').setAttribute('aria-pressed',String(enabled));$('effect').textContent='恒星＋フレア：'+(enabled?'ON':'OFF');draw();};
$('time').oninput=()=>{play(false);time=Number($('time').value);draw();};
$('look').onchange=()=>{spread=$('look').value==='wide';draw();};
$('aspect').onchange=()=>{$('film').style.aspectRatio=$('aspect').value;$('film').style.maxWidth=(74*Number($('aspect').value))+'vh';};
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('film'));resize();await renderer.compileAsync(scene,camera);draw();play(playing);document.body.dataset.ready='true';
function tick(now){if(disposed)return;frame=requestAnimationFrame(tick);if(document.hidden){last=0;return;}if(playing&&last){time+=(now-last)/1000;if(time>range[1])time=range[0];draw();}last=now;}
frame=requestAnimationFrame(tick);
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);resizeObserver.disconnect();sunrise.dispose();planet.dispose();stars.dispose();ship.dispose();renderer.dispose();},{once:true});
}
startStudy().catch(error=>{console.error(error);document.getElementById('state').textContent='描画の準備に失敗しました。再読み込みしてください。';});
