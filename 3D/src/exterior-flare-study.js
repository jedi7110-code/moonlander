import * as THREE from 'three';
import {createExteriorShip} from './obs/ship-exterior.js';
import {createExteriorOptics,projectedShipSize,sampleExteriorOptics} from './obs/exterior-optics.js';
import {sampleExteriorCinema} from './obs/exterior-cinematic.js';
import {createExteriorShadow} from './obs/exterior-shadow.js';
import {createDistantStars} from './obs/exterior-stars.js';
import {createExteriorDissolve} from './obs/exterior-dissolve.js';

const cases=[['縦長',.6,56],['16:9',16/9,56],['横長',2.4,56],['狭い画角',16/9,32],['広い画角',16/9,80]];
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(4);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const dissolve=createExteriorDissolve(renderer);
const scene=new THREE.Scene();scene.background=new THREE.Color('#030609');
const ship=createExteriorShip();ship.setCoreScale(2.6);scene.add(ship.root);
const optics=createExteriorOptics(ship),sun=new THREE.DirectionalLight(0xfff2d4,3.15),shadows=createExteriorShadow(sun,ship);
const bounce=new THREE.DirectionalLight(0x8ca7bd,.65),stars=createDistantStars();
scene.add(sun,sun.target,bounce,bounce.target,stars.haze,stars.field,new THREE.HemisphereLight(0xc4d5e1,0x394b53,.68));
for(const [label,aspect,fov]of cases){
  const shot=sampleExteriorCinema(126,{opening:true,aspect}),viewport=new THREE.Vector2(Math.round(280*aspect),280);
  renderer.setSize(viewport.x,viewport.y,false);renderer.getDrawingBufferSize(viewport);
  const camera=new THREE.PerspectiveCamera(fov,viewport.x/viewport.y,shot.near,shot.far);
  camera.position.fromArray(shot.eye);camera.lookAt(new THREE.Vector3(...shot.target));
  ship.root.position.x=shot.shipX;ship.setAngle(shot.angle);shadows.update(shot);
  bounce.position.set(shot.shipX-38,-15,-30);bounce.target.position.set(shot.shipX,0,0);stars.follow(camera);
  optics.update(camera,viewport,shot.optics);await renderer.compileAsync(scene,camera);
  for(let frame=0;frame<2;frame++)dissolve.render({from:shot,to:null,mix:0},()=>renderer.render(scene,camera));
  const sample=sampleExteriorOptics(ship,camera,viewport,shot.optics)[0],size=projectedShipSize(ship,camera,viewport);
  const figure=document.createElement('figure'),caption=document.createElement('figcaption'),image=document.createElement('img'),metric=document.createElement('div');
  caption.textContent=`${label} / 比率 ${aspect.toFixed(2)} / 画角 ${fov}°`;image.src=renderer.domElement.toDataURL('image/png');image.alt=caption.textContent;
  metric.className='metric';metric.textContent=`フレア / 船尾区画 ${(sample.streakSize/size).toFixed(2)}倍 · 強さ ${sample.strength.toFixed(3)}`;
  figure.append(caption,image,metric);document.getElementById('cases').append(figure);
}
document.getElementById('status').textContent='5条件の描画完了';document.body.dataset.ready='true';
optics.dispose();ship.dispose();dissolve.dispose();renderer.dispose();
