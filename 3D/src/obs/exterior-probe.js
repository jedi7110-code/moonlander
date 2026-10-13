import * as THREE from 'three';
import {createLander} from '../js/models.js';
import {createExteriorProbeThrusters} from './exterior-probe-thrusters.js';

export function createExteriorProbe(root,m,build){
  const {random,addMesh,box,rod,pipe,axisRing,chamferBox,label,bake}=build;
function probeFoilMaps(){
  if(typeof document==='undefined')return{color:null,bump:null};
  const color=document.createElement('canvas'),bump=document.createElement('canvas');color.width=bump.width=512;color.height=bump.height=512;
  const c=color.getContext('2d'),b=bump.getContext('2d'),r=random(1963);
  c.fillStyle='#9f8c61';c.fillRect(0,0,512,512);b.fillStyle='#808080';b.fillRect(0,0,512,512);
  for(let i=0;i<1100;i++){
    const x=r()*512,y=r()*512,length=3+r()*70,angle=r()*Math.PI*2,dx=Math.cos(angle)*length,dy=Math.sin(angle)*length;
    for(const [context,dark,light]of [[c,'rgba(35,29,19,.15)','rgba(227,203,154,.18)'],[b,'rgba(15,15,15,.65)','rgba(242,242,242,.60)']]){
      context.lineWidth=.6+r()*2;context.strokeStyle=dark;context.beginPath();context.moveTo(x,y);context.lineTo(x+dx,y+dy);context.stroke();
      context.strokeStyle=light;context.beginPath();context.moveTo(x+1.4,y+1.4);context.lineTo(x+dx+1.4,y+dy+1.4);context.stroke();
    }
  }
  for(let j=0;j<4;j++){
    c.fillStyle='#d3b88388';c.fillRect(j*128,0,5,512);b.fillStyle='#aaa';b.fillRect(j*128,0,5,512);
  }
  const map=new THREE.CanvasTexture(color),relief=new THREE.CanvasTexture(bump);map.colorSpace=THREE.SRGBColorSpace;
  map.name='BARRAMUNDI / folded thermal blanket';relief.name='BARRAMUNDI / foil wrinkle relief';return{color:map,bump:relief};
}

function detailDockedProbe(lander,m){
  const foil=probeFoilMaps(),paintedMaterials=[],handled=new Set();
  // The exterior's raised hatch and service cover extend farther forward
  // than the game model. Stand the ladder off those faces instead of
  // letting the upper rungs cut through them and their contact shadows.
  lander.userData.ladder.position.z=.16;
  for(const x of [-.55,.55])rod(lander,m.steel,[x,2.61,1.79],[x,2.61,1.93],.05,'Probe ladder stand-off mount');
  lander.traverse(object=>{
    if(!object.isMesh)return;
    for(const material of [].concat(object.material)){
      if(handled.has(material))continue;handled.add(material);
      const color=material.color?.getHex();
      if(color===0xac7828){
        material.name='Probe wrinkled thermal blanket';material.color.set(0xffffff);material.map=foil.color;
        material.bumpMap=foil.bump;material.bumpScale=.018;material.roughness=.70;material.metalness=.65;
      }else if(color===0xd7d7cb){
        material.name='Probe aged pressure panels';material.color.set(0xf1eee3);material.map=m.paint.map;
        material.roughness=.86;material.metalness=.18;material.flatShading=true;paintedMaterials.push(material);
      }else if(color===0x8d9899){
        material.name='Probe mechanical silver';material.roughness=.55;material.metalness=.65;
      }else if(color===0x242e31){
        material.name='Probe machinery and seals';material.color.set(0x303a35);material.roughness=.80;
      }
    }
  });
  for(let j=0;j<8;j++){
    const a=Math.PI/8+j*Math.PI/4;
    rod(lander,m.steel,[Math.sin(a)*1.915,2.46,Math.cos(a)*1.915*.9],
      [Math.sin(a)*1.465,5.04,Math.cos(a)*1.465*.9],.018,'Cabin panel retention seam');
  }
  chamferBox(lander,m.steel,[0,3.70,1.74],[1.04,2.32,.10],'Probe hatch pressure frame');
  chamferBox(lander,m.dark,[0,3.70,1.81],[.86,2.12,.065],'Probe sealed hatch leaf');
  addMesh(lander,new THREE.TorusGeometry(.18,.025,6,18),m.pipe,'Probe hatch porthole rim',[0,4.40,1.86]);
  const port=addMesh(lander,new THREE.CircleGeometry(.15,24),m.glass,'Probe hatch porthole',[0,4.40,1.868]);port.castShadow=false;
  rod(lander,m.pipe,[.29,3.25,1.89],[.29,3.64,1.89],.023,'Probe hatch handle');
  for(const y of [2.85,3.72,4.58])box(lander,m.steel,[-.49,y,1.82],[.12,.16,.11],'Probe hatch hinge');
  label(lander,'BARRAMUNDI',[0,2.83,1.858],.72,.10,{size:43});
  for(const side of [-1,1]){
    const window=new THREE.Group();window.position.set(side*1.12,4.36,1.34);window.rotation.y=side*.43;lander.add(window);
    chamferBox(window,m.steel,[0,0,0],[.82,.66,.065],'Probe observation window surround');
    chamferBox(window,m.glass,[0,0,.045],[.65,.49,.026],'Probe recessed observation glass');
    for(const x of [-.34,.34])for(const y of [-.25,.25])box(window,m.pipe,[x,y,.05],[.026,.026,.025],'Window pressure bolt');
    box(lander,m.steel,[side*1.76,3.17,.28],[.20,.57,.66],'Probe attitude-control manifold');
    for(const z of [.05,.48]){
      const nozzle=addMesh(lander,new THREE.CylinderGeometry(.08,.115,.22,10,1,true),m.dark,'Probe attitude nozzle',[side*1.93,3.10,z]);nozzle.rotation.z=side*Math.PI/2;
      addMesh(lander,new THREE.TorusGeometry(.112,.018,5,12),m.pipe,'Probe attitude nozzle rim',[side*2.04,3.10,z]).rotation.y=Math.PI/2;
    }
    const bay=new THREE.Group();bay.position.set(side*2.20,1.85,.12);bay.rotation.y=side*Math.PI/2;lander.add(bay);
    chamferBox(bay,m.steel,[0,0,0],[1.1,.85,.10],'Probe exposed service bay');
    box(bay,m.patch,[.19,.02,.085],[.45,.64,.08],'Probe service electronics');
    for(let k=0;k<5;k++)box(bay,m.pipe,[-.30,-.25+k*.12,.10],[.23,.035,.07],'Probe cooling fin');
    pipe(lander,m.pipe,[[side*1.79,2.43,.35],[side*2.25,2.35,.35],[side*2.25,1.45,-.15]],.033,'Probe coolant feed');
  }
  const bay=new THREE.Group();bay.position.set(0,1.76,1.86);lander.add(bay);
  chamferBox(bay,m.steel,[0,0,0],[1.60,.88,.12],'Descent-stage inspection frame');
  chamferBox(bay,m.patch,[0,0,.08],[1.42,.71,.065],'Descent-stage removable cover');
  for(const x of [-.63,.63])for(const y of [-.27,.27])box(bay,m.pipe,[x,y,.13],[.046,.046,.035],'Descent cover fastener');
  label(bay,'SERVICE / 02',[0,.13,.13],.85,.10,{size:45});
  for(const x of [-1,1])for(const z of [-1,1]){
    // Attach on top of the pad: an angled cylinder ending at its center
    // extends below its endpoint by its radius and used to pierce the sole.
    const hip=[x*1.70,2.30,z*1.50],knee=[x*2.37,1.16,z*2.12],foot=[x*2.95,.30,z*2.65];
    rod(lander,m.steel,hip,knee,.205,'Probe upper landing strut');
    rod(lander,m.pipe,knee,foot,.172,'Probe telescopic landing piston');
    rod(lander,m.dark,[x*2.30,1.30,z*2.05],[x*2.45,1.04,z*2.20],.245,'Probe piston gland');
    box(lander,m.steel,hip,[.43,.32,.40],'Probe leg pivot bracket');
    rod(lander,m.pipe,[x*1.05,1.2,z*1.22],[x*2.63,.43,z*2.35],.052,'Probe secondary leg brace');
    // The game pad is radius .50 and spans y=.11-.25. Keep the added
    // metal rim outside that cylinder rather than sharing its side faces.
    const pad=addMesh(lander,new THREE.CylinderGeometry(.54,.54,.08,20),m.steel,'Probe landing pad rim',[foot[0],.23,foot[2]]);
    for(let j=0;j<5;j++)box(lander,m.pipe,[foot[0]-.32+j*.16,.277,foot[2]],[.055,.018,.60],'Landing pad traction rib');
  }
  return paintedMaterials;
}

function dockedProbe(root,m){
  const dock=new THREE.Group();dock.name='BARRAMUNDI / underside docking cradle';root.add(dock);
  const lander=createLander({labels:typeof document!=='undefined',footJointHeight:.30});lander.name='Moonlander game / BARRAMUNDI';dock.add(lander);
  lander.userData.flame.visible=false;lander.userData.flame.removeFromParent();
  // Game geometry/materials are module-wide caches. Give this study its own
  // resources so baking and disposal cannot alter a second game instance.
  const geometries=new Map(),materials=new Map();
  lander.traverse(object=>{
    if(!object.isMesh)return;
    if(!geometries.has(object.geometry))geometries.set(object.geometry,object.geometry.clone());
    object.geometry=geometries.get(object.geometry);
    const isolate=material=>{if(!materials.has(material))materials.set(material,material.clone());return materials.get(material);};
    object.material=Array.isArray(object.material)?object.material.map(isolate):isolate(object.material);
  });
  const paintedMaterials=detailDockedProbe(lander,m);bake(lander);
  const thrusters=createExteriorProbeThrusters(lander,{nozzleMaterial:m.dark,rimMaterial:m.pipe});
  const cradle=new THREE.Group();cradle.name='Probe docking hardpoints';dock.add(cradle);
  chamferBox(cradle,m.steel,[0,7.25,0],[2.8,.22,2.2],'Underside docking plate');
  const collar=axisRing(cradle,m.pipe,0,.36,.05,'Probe docking collar');collar.rotation.set(Math.PI/2,0,0);collar.position.set(0,5.43,0);
  rod(cradle,m.steel,[0,5.35,0],[0,7.25,0],.30,'Probe pressure coupling');
  for(const x of [-1,1])for(const z of [-1,1]){
    rod(cradle,m.steel,[x*.68,5.32,z*.53],[x*1.2,7.14,z*.9],.07,'Probe retention strut');
    box(cradle,m.patch,[x*.68,5.33,z*.53],[.38,.14,.32],'Probe roof clamp');
  }
  label(cradle,'PROBE / 01',[0,7.06,1.12],1.6,.22,{size:44});
  bake(cradle);return{dock,lander,cradle,paintedMaterials,thrusters};
}

  return dockedProbe(root,m);
}
