import * as THREE from 'three';
import {createExteriorShip} from './obs/ship-exterior.js';
import {createExteriorOptics,projectedShipSize,sampleExteriorOptics} from './obs/exterior-optics.js';
import {sampleExteriorCinema} from './obs/exterior-cinematic.js';
import {createExteriorShadow} from './obs/exterior-shadow.js';
import {createDistantStars} from './obs/exterior-stars.js';
import {createExteriorDissolve} from './obs/exterior-dissolve.js';

const query=new URLSearchParams(location.search),lengthComparison=query.get('compare')==='length',cameraComparison=query.get('compare')==='camera-height';
const time=Number(query.get('time'))||(cameraComparison?106.62:lengthComparison?106.96:104.73);
const aspectCases=[['縦長',360,640,1],['正方形',720,720,1],['HD',1280,720,1],['フルHD',1920,1080,1],['4K',3840,2160,1],['高密度表示',1280,720,2],['横長',2560,1080,1]];
const cases=cameraComparison?[['変更前',1920,1080,1,undefined,'lower'],['変更後 · 10m上',1920,1080,1,undefined,'higher10']]:lengthComparison?[2.4,2,1.5,1].map(ratio=>[`${ratio}倍${ratio===2.4?'（変更前）':''}`,1920,1080,1,ratio]):aspectCases;
if(lengthComparison){
  document.body.classList.add('length-comparison');
  document.querySelector('h1').textContent='シーン05 — フレアの長さ比較';
  document.getElementById('description').innerHTML='同じカメラ・同じ時刻 <span id="time"></span> 秒。船尾区画に対する長さを2.4・2・1.5・1倍で比較。光量とハローは共通。';
}
if(cameraComparison){
  document.title='シーン05 / 最終カメラ高さの比較';
  document.body.classList.add('length-comparison');
  document.querySelector('h1').textContent='シーン05 — 上昇後のカメラ位置';
  document.getElementById('description').innerHTML='同じ <span id="time"></span> 秒・同じ画角。変更後は停止位置を10m上へ（−26m → −16m）。元のイージングで上昇を16秒→22秒に延長。フレアの長さは両方1.3倍。';
}
for(const link of document.querySelectorAll('[data-time]')){
  const params=new URLSearchParams({time:link.dataset.time});
  if(lengthComparison)params.set('compare','length');
  if(cameraComparison)params.set('compare','camera-height');
  link.href=`?${params}`;
}
let baseline,maxDifference=0;
document.getElementById('time').textContent=time.toFixed(3);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const dissolve=createExteriorDissolve(renderer);
const scene=new THREE.Scene();scene.background=new THREE.Color('#030609');
const ship=createExteriorShip();ship.setCoreScale(2.6);scene.add(ship.root);
const optics=createExteriorOptics(ship),sun=new THREE.DirectionalLight(0xfff2d4,3.15),shadows=createExteriorShadow(sun,ship);
const bounce=new THREE.DirectionalLight(0x8ca7bd,.65),stars=createDistantStars();
scene.add(sun,sun.target,bounce,bounce.target,stars.haze,stars.field,new THREE.HemisphereLight(0xc4d5e1,0x394b53,.68));
for(const [label,width,height,density,streakRatio,endingCamera]of cases){
  const aspect=width/height,shot=sampleExteriorCinema(time,{opening:true,ending:'underside',docking:'probe-follow',endingCamera,aspect}),viewport=new THREE.Vector2();
  renderer.setPixelRatio(density);renderer.setSize(width,height,false);renderer.getDrawingBufferSize(viewport);
  const camera=new THREE.PerspectiveCamera(shot.fov,aspect,shot.near,shot.far);
  camera.position.fromArray(shot.eye);camera.up.fromArray(shot.up??[0,1,0]);camera.lookAt(new THREE.Vector3(...shot.target));
  ship.root.position.x=shot.shipX;ship.setAngle(shot.angle);shadows.update(shot);
  bounce.position.set(shot.shipX-38,-15,-30);bounce.target.position.set(shot.shipX,0,0);stars.follow(camera);
  const settings=streakRatio===undefined?shot.optics:{...shot.optics,streakRatio};
  optics.update(camera,viewport,settings);await renderer.compileAsync(scene,camera);
  for(let frame=0;frame<2;frame++)dissolve.render({from:shot,to:null,mix:0},()=>renderer.render(scene,camera));
  const samples=sampleExteriorOptics(ship,camera,viewport,settings),sample=samples[0],size=projectedShipSize(ship,camera,viewport);
  baseline??=samples.map(item=>item.strength);
  maxDifference=Math.max(maxDifference,...samples.map((item,i)=>Math.abs(item.strength-baseline[i])));
  const figure=document.createElement('figure'),caption=document.createElement('figcaption'),image=document.createElement('img'),metric=document.createElement('div');
  caption.textContent=`${label} / ${width}×${height} / DPR ${density}`;image.src=renderer.domElement.toDataURL('image/png');image.alt=caption.textContent;
  metric.className='metric';metric.textContent=`フレア / 船尾区画 ${(sample.streakSize/size).toFixed(2)}倍 · 強さ ${sample.strength.toFixed(3)}`;
  figure.append(caption,image,metric);
  if(lengthComparison||cameraComparison){
    const preview=document.createElement('a');
    preview.href=`./ship-exterior-cinema.html?mode=opening&approach=bow&ending=underside&docking=probe-follow&time=${time}${streakRatio===undefined?'':`&flareRatio=${streakRatio}`}${endingCamera?'&endingCamera='+endingCamera:''}`;
    preview.textContent='この設定で再生';figure.append(preview);
    if(cameraComparison){
      metric.textContent=`カメラ高さ ${shot.eye[1].toFixed(1)}m · フレア${settings.streakRatio.toFixed(1)}倍`;
      const save=document.createElement('a');save.href=image.src;save.download=`scene05-camera-${endingCamera==='lower'?'before':'after'}-${time}.png`;save.textContent='スクショを保存';save.style.marginLeft='16px';figure.append(save);
    }
  }
  document.getElementById('cases').append(figure);
}
document.getElementById('status').textContent=cameraComparison?'変更前後の描画完了':lengthComparison?'4パターンの描画完了':`7条件の描画完了 · エンジン別の強度差 ${maxDifference.toFixed(10)}`;document.body.dataset.ready='true';
optics.dispose();ship.dispose();dissolve.dispose();renderer.dispose();
