import * as THREE from 'three';
import {createExteriorMothership} from './obs/exterior-mothership.js';
import {createExteriorPlanet,EXTERIOR_PLANET_VARIANTS} from './obs/exterior-planet.js';
import {sampleExteriorCinema} from './obs/exterior-cinematic.js';
import {createExteriorShadow} from './obs/exterior-shadow.js';
import {createDistantStars} from './obs/exterior-stars.js';
import {createExteriorDissolve} from './obs/exterior-dissolve.js';

const query=new URLSearchParams(location.search),beforeAfter=query.get('compare')==='before-after';
const time=Number(query.get('time'))||51.56;
const shot=sampleExteriorCinema(time,{opening:true,approach:'bow',ending:'underside',docking:'probe-follow',aspect:16/9});
document.getElementById('description').textContent=`シーン${String(shot.number).padStart(2,'0')} / ${time.toFixed(3)}秒。同じ船・カメラ・光で、惑星の模様と色を比較。${shot.number===2?'02本番はBの赤褐色。惑星＋15％・船は元のサイズ。':'04本番もBの赤褐色。'}`;
const variants=beforeAfter?[
  {id:'current',label:'変更前',description:'青灰色の惑星 · 惑星100％ / 船100％',planetScale:1,shipScale:1},
  {id:shot.planet?.variant??'current',label:'変更後',description:shot.number===2?'Bの赤褐色 · 惑星115％ / 船100％':'Bの赤褐色 · サイズは変更なし',planetScale:shot.planet?.scale??1,shipScale:shot.shipScale??1},
]:EXTERIOR_PLANET_VARIANTS;
if(beforeAfter){
  document.title='シーン'+String(shot.number).padStart(2,'0')+' / 変更前後のスクショ';
  document.querySelector('h1').textContent='シーン'+String(shot.number).padStart(2,'0')+' — 変更前 / 変更後';
  document.getElementById('description').textContent=`${time.toFixed(3)}秒 · 1920×1080。同じカメラ・開始位置・船速・照明で描画。各画像を原寸で保存できます。`;
  for(const link of document.querySelectorAll('nav a')){
    const url=new URL(link.href);url.searchParams.set('compare','before-after');link.href=url.href;
  }
}
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(1920,1080,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#030609');
const ship=createExteriorMothership();ship.setCoreScale(2.6);ship.root.scale.setScalar(shot.shipScale??1);ship.root.position.x=shot.shipX;ship.setAngle(shot.angle);scene.add(ship.root);
const planet=createExteriorPlanet();planet.body.scale.setScalar(shot.planet?.scale??1);planet.show(shot.planet?.position);scene.add(planet.body);
const camera=new THREE.PerspectiveCamera(shot.fov,16/9,shot.near,shot.far);
camera.position.fromArray(shot.eye);camera.up.fromArray(shot.up);camera.lookAt(new THREE.Vector3(...shot.target));
const sun=new THREE.DirectionalLight(0xfff2d4,3.15),bounce=new THREE.DirectionalLight(0x8ca7bd,.65);
const shadows=createExteriorShadow(sun,ship);shadows.update(shot);
bounce.position.set(shot.shipX-38,-15,-30);bounce.target.position.set(shot.shipX,0,0);
const stars=createDistantStars();stars.follow(camera);
scene.add(sun,sun.target,bounce,bounce.target,stars.haze,stars.field,new THREE.HemisphereLight(0xc4d5e1,0x394b53,.68));
const dissolve=createExteriorDissolve(renderer);
await renderer.compileAsync(scene,camera);
for(const variant of variants){
  ship.root.scale.setScalar(variant.shipScale??shot.shipScale??1);
  planet.body.scale.setScalar(variant.planetScale??shot.planet?.scale??1);planet.setVariant(variant.id);
  dissolve.render({from:shot,to:null,mix:0},()=>renderer.render(scene,camera));
  const figure=document.createElement('figure'),caption=document.createElement('figcaption'),image=document.createElement('img'),description=document.createElement('p');
  caption.textContent=variant.label+(!beforeAfter&&variant.id===(shot.planet?.variant??'current')?'（このシーンの採用案）':'');image.alt=variant.label;image.src=renderer.domElement.toDataURL('image/png');
  description.className='description';description.textContent=variant.description;figure.append(caption,image,description);
  if(beforeAfter){
    const save=document.createElement('a');save.href=image.src;save.download=`scene-${shot.number}-${variant.label==='変更前'?'before':'after'}-${time.toFixed(3)}.png`;
    save.textContent='スクショを保存（1920×1080）';figure.append(save);
  }
  for(const paused of beforeAfter?[]:[true,false]){
    const link=document.createElement('a'),url=new URL('./ship-exterior-cinema.html',location.href);
    url.search=new URLSearchParams({mode:'opening',approach:'bow',ending:'underside',docking:'probe-follow',time:time.toFixed(3),planetVariant:variant.id,...(paused?{paused:'1'}:{})});
    link.href=url.href;link.textContent=paused?'大きく見る':'この惑星で再生';figure.append(link);
  }
  document.getElementById('cases').append(figure);
}
document.getElementById('status').textContent=beforeAfter?'変更前後のスクショ描画完了':'4パターンの描画完了';document.body.dataset.ready='true';
planet.dispose();stars.dispose();ship.dispose();dissolve.dispose();renderer.dispose();
