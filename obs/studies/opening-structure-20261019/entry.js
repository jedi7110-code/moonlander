import * as THREE from 'three';
import {createProductionExterior,EXTERIOR_SOFT_PANEL_LINES} from '../../src/obs/exterior-production.js';
import {createExteriorOptics} from '../../src/obs/exterior-optics.js';
import {createDistantStars} from '../../src/obs/exterior-stars.js';
import {createExteriorPlanet} from '../../src/obs/exterior-planet.js';
import {createExteriorShadow} from '../../src/obs/exterior-shadow.js';
import {createExteriorDissolve} from '../../src/obs/exterior-dissolve.js';
import {createExteriorGasPass} from '../../src/obs/exterior-gas-pass.js';
import {applyExteriorProbePose} from '../../src/obs/exterior-probe-flight.js';
import {sampleExteriorExportFrame} from '../../src/obs/exterior-export.js';

const root=document.getElementById('root'),width=Number(root.dataset.width),height=Number(root.dataset.height);
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('film'),antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#030609');
const ship=createProductionExterior({panelLines:EXTERIOR_SOFT_PANEL_LINES});
await ship.prepareProbe();ship.setCoreScale(2.6);scene.add(ship.root);
const optics=createExteriorOptics(ship),stars=createDistantStars(),planet=createExteriorPlanet();
scene.add(stars.haze,stars.field,planet.body,new THREE.HemisphereLight(0xc4d5e1,0x394b53,.68));
const sun=new THREE.DirectionalLight(0xfff2d4,3.15),shadows=createExteriorShadow(sun,ship);
const bounce=new THREE.DirectionalLight(0x8ca7bd,.65);scene.add(sun,bounce,sun.target,bounce.target);
const camera=new THREE.PerspectiveCamera(38,width/height,.1,2400),target=new THREE.Vector3(),size=new THREE.Vector2(width,height);
const dissolve=createExteriorDissolve(renderer,{samples:EXTERIOR_SOFT_PANEL_LINES.samples});
const gasPass=createExteriorGasPass(renderer,ship.probeThrusters.gas);
const identity=document.querySelector('.identity'),reveal=document.querySelector('.logo-reveal');
function drawView(shot,renderTarget,gasTarget){
  ship.root.scale.setScalar(shot.shipScale??1);ship.root.position.x=shot.shipX;ship.root.visible=shot.shipVisible;
  ship.setAngle(shot.angle);camera.position.fromArray(shot.eye);target.fromArray(shot.target);applyExteriorProbePose(ship,shot.probe);
  ship.rotor.visible=shot.rotorVisible!==false;for(const pod of ship.pods)pod.visible=shot.habitatsVisible;
  camera.fov=shot.fov;camera.near=shot.near;camera.far=shot.far;camera.up.fromArray(shot.up);camera.updateProjectionMatrix();camera.lookAt(target);
  planet.setVariant(shot.planet?.variant??'current');planet.body.scale.setScalar(shot.planet?.scale??1);planet.show(shot.planet?.position);
  shadows.update(shot);bounce.position.set(shot.shipX-38,-15,-30);bounce.target.position.set(shot.shipX,0,0);
  stars.follow(camera);optics.update(camera,size,shot.optics);
  return gasPass.render(scene,camera,renderTarget,gasTarget);
}
function renderAt(time){
  const film=sampleExteriorExportFrame(time,{opening:true,approach:'bow',ending:'underside',docking:'probe-follow',aspect:width/height,coreScale:2.6});
  dissolve.render(film,drawView);const shot=film.shot;
  identity.style.opacity=String(shot.titleOpacity*.88);reveal.style.visibility=shot.logoReveal>0?'visible':'hidden';reveal.style.clipPath=shot.logoClip;
}
window.addEventListener('hf-seek',event=>renderAt(event.detail.time));
await document.querySelector('.logo-image').decode();
renderAt(80);await renderer.compileAsync(scene,camera);renderAt(0);window.resolveOpening();
