import * as THREE from 'three';
import {createLander} from '../js/models.js';
import {createParabolicAntenna} from './exterior-antenna.js';
import {createExteriorDecals} from './exterior-decals.js';
import {createExteriorProbeThrusters} from './exterior-probe-thrusters.js';
import {addProbeDockPort,addMotherDockPort,cutDockPassage} from './exterior-docking.js';

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
  // Seat a whole fitting on an actual cabin facet, including its upward
  // normal from the tapered hull. The back of the frame embeds slightly.
  const cabinSurfaces=[];
  lander.traverse(object=>{if(object.isMesh&&object.material.name==='Probe aged pressure panels')cabinSurfaces.push(object);});
  function attachCabinPanel(name,position,direction,standOff,width,height,depth){
    lander.updateWorldMatrix(true,true);
    const normal=new THREE.Vector3(...direction).normalize().transformDirection(lander.matrixWorld);
    const origin=lander.localToWorld(new THREE.Vector3(...position)).addScaledVector(normal,.5);
    const hit=new THREE.Raycaster(origin,normal.clone().negate(),0,1).intersectObjects(cabinSurfaces,false)[0];
    if(!hit)throw new Error(`No cabin surface for ${name}`);
    const localNormal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).transformDirection(lander.matrixWorld.clone().invert());
    const right=new THREE.Vector3(0,1,0).cross(localNormal).normalize(),up=localNormal.clone().cross(right).normalize();
    const fitting=new THREE.Group();fitting.name=name;
    fitting.position.copy(lander.worldToLocal(hit.point.clone())).addScaledVector(localNormal,standOff);
    fitting.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,localNormal));
    fitting.userData.cabinFitting={width,height,depth};lander.add(fitting);return fitting;
  }
  for(let j=0;j<8;j++){
    const a=Math.PI/8+j*Math.PI/4;
    rod(lander,m.steel,[Math.sin(a)*1.915,2.46,Math.cos(a)*1.915*.9],
      [Math.sin(a)*1.465,5.04,Math.cos(a)*1.465*.9],.018,'Cabin panel retention seam');
  }
  const hatch=attachCabinPanel('Probe conformal hatch',[0,3.70,1.4],[0,.15,1],.035,1.04,2.32,.10);
  chamferBox(hatch,m.steel,[0,0,0],[1.04,2.32,.10],'Probe hatch pressure frame');
  chamferBox(hatch,m.dark,[0,0,.07],[.86,2.12,.065],'Probe sealed hatch leaf');
  addMesh(hatch,new THREE.TorusGeometry(.18,.025,6,18),m.pipe,'Probe hatch porthole rim',[0,.70,.12]);
  const port=addMesh(hatch,new THREE.CircleGeometry(.15,24),m.glass,'Probe hatch porthole',[0,.70,.128]);port.castShadow=false;
  rod(hatch,m.pipe,[.29,-.45,.15],[.29,-.06,.15],.023,'Probe hatch handle');
  for(const y of [-.85,.02,.88])box(hatch,m.steel,[-.49,y,.08],[.12,.16,.11],'Probe hatch hinge');
  for(const x of [-.55,.55]){
    const hullZ=.9*Math.cos(Math.PI/8)*(1.9-(2.61-2.45)*.45/2.6);
    rod(lander,m.steel,[x,2.61,hullZ-.015],[x,2.61,1.93],.05,'Probe ladder stand-off mount');
  }

  for(const side of [-1,1]){
    const window=attachCabinPanel(`Probe conformal observation window ${side<0?'left':'right'}`,[side*1.02,4.36,.93],[side*.707,.16,.786],.020,.82,.66,.065);
    chamferBox(window,m.steel,[0,0,0],[.82,.66,.065],'Probe observation window surround');
    chamferBox(window,m.glass,[0,0,.045],[.65,.49,.026],'Probe recessed observation glass');
    for(const x of [-.34,.34])for(const y of [-.25,.25])box(window,m.pipe,[x,y,.05],[.026,.026,.025],'Window pressure bolt');
    // Both lateral jets share a manifold rooted in the cabin wall. The jet
    // module owns the actual nozzles/lips so there is no second offset set.
    box(lander,m.steel,[side*1.70,3.10,0],[.32,.60,1.34],'Probe attitude-control manifold');
    for(const front of [-1,1])box(lander,m.steel,[side*1.60,2.64,front*1.40],[.30,.20,.30],'Probe braking thruster mounting block');
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
    // Attach to the structural frame below the thermal cover, with no leg
    // crossing the spherical blanket surface.
    const hip=[x*1.20,.80,z*1.10],knee=[x*2.37,1.16,z*2.12],foot=[x*2.95,.39,z*2.65];
    rod(lander,m.steel,hip,knee,.205,'Probe upper landing strut');
    rod(lander,m.pipe,knee,foot,.172,'Probe telescopic landing piston');
    rod(lander,m.dark,[x*2.30,1.30,z*2.05],[x*2.45,1.04,z*2.20],.245,'Probe piston gland');
    const braceJoint=knee.map((value,index)=>THREE.MathUtils.lerp(value,foot[index],.8));
    rod(lander,m.pipe,[x*1.05,1.2,z*1.22],braceJoint,.052,'Probe secondary leg brace');
    addMesh(lander,new THREE.SphereGeometry(.14,10,6),m.steel,'Probe landing pad pivot',foot);
    // The game pad is radius .50 and spans y=.11-.25. Keep the added
    // metal rim outside that cylinder rather than sharing its side faces.
    const pad=addMesh(lander,new THREE.CylinderGeometry(.54,.54,.08,20),m.steel,'Probe landing pad rim',[foot[0],.23,foot[2]]);
    for(let j=0;j<5;j++)box(lander,m.pipe,[foot[0]-.32+j*.16,.277,foot[2]],[.055,.018,.60],'Landing pad traction rib');
  }
  return paintedMaterials;
}

function dockedProbe(root,m){
  const dock=new THREE.Group();dock.name='BARRAMUNDI / underside docking cradle';root.add(dock);
  const lander=createLander({labels:false,antennaDish:false,antennaMasts:false,lateralFins:false,octagonalBase:true,cabinFixtures:false,landingStruts:false});lander.name='Moonlander game / BARRAMUNDI';dock.add(lander);
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
  lander.updateWorldMatrix(true,true);const inverse=lander.matrixWorld.clone().invert();
  lander.traverse(mesh=>{
    if(mesh.isMesh&&mesh.material.color?.getHex()===0xd7d7cb)
      cutDockPassage(mesh,inverse.clone().multiply(mesh.matrixWorld),{radius:.63,minY:5.0,maxY:5.4});
  });
  const paintedMaterials=detailDockedProbe(lander,m),probeHatch=addProbeDockPort(lander,m,build);
  // Seat the neighboring beacon mast into the sloping roof as well.
  rod(lander,m.steel,[-1.12,4.94,-.65],[-1.12,6.10,-.65],.04,'Outboard beacon mast clear of docking port');
  box(lander,m.pipe,[-1.12,6.15,-.65],[.10,.10,.10],'Probe beacon head');
  const antenna=createParabolicAntenna({radius:.38,depth:.13,material:m.patch,structureMaterial:m.steel,feedMaterial:m.dark,name:'Probe directional communications antenna'});
  antenna.position.set(1.64,4.95,-.68);antenna.rotation.x=.55;lander.add(antenna);antenna.updateMatrix();
  const supportTop=new THREE.Vector3(...antenna.userData.antenna.mountPoint).applyMatrix4(antenna.matrix).toArray();
  rod(lander,m.steel,[1.22,4.74,-.55],supportTop,.06,'Outboard dish support clear of docking envelope');bake(antenna);
  bake(lander);
  const decals=createExteriorDecals();
  decals.add(lander,'pressure',[0,3.93,1.89],[0,0,1],.65,.26);
  decals.add(lander,'service',[0,1.63,2.03],[0,0,1],1.10,.31);
  for(const side of [-1,1]){
    decals.add(lander,'rcs',[side*1.87,3.1,0],[side,0,0],.38,.23);
    decals.add(lander,'connector',[side*2.30,1.83,.12],[side,0,0],.72,.25);
  }
  decals.flush();
  const thrusters=createExteriorProbeThrusters(lander,{nozzleMaterial:m.dark,rimMaterial:m.pipe});
  const cradle=new THREE.Group();cradle.name='Probe docking hardpoints';dock.add(cradle);
  const motherPort=addMotherDockPort(cradle,m,build);
  dock.userData.docking={clearDiameter:1.2,mode:'unpressurized until hard-capture and seal check'};
  return{dock,lander,cradle,paintedMaterials,thrusters,capture:motherPort.capture,setCapture:motherPort.capture.setProgress,hatches:[probeHatch.hinge,motherPort.hatch.hinge],setScale:motherPort.setScale,
    setTransferOpen(value){probeHatch.setOpen(value);motherPort.hatch.setOpen(value);}};
}

  return dockedProbe(root,m);
}
