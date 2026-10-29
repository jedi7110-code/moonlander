import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function createExteriorCargoHatches(ship,{referenceHuman=false}={}){
  const roots=[],resources=[],warningEdits=[],originals=ship.evaHatches.map(hatch=>({hatch,visible:hatch.visible}));
  const scale=ship.coreScale,leafWidth=1.30*scale,leafHeight=1.94*scale,face=.27*scale;
  const materials=new Map();ship.root.traverse(mesh=>{
    if(mesh.isMesh&&!Array.isArray(mesh.material))materials.set(mesh.material.name,mesh.material);
  });
  const steel=materials.get('Unpainted structure'),paint=materials.get('Replacement panel');
  const dark=materials.get('Recessed machinery'),pipe=materials.get('Warm service metal');
  const ochre=materials.get('Faded service ochre'),suit=materials.get('Worn insulation');
  for(const {hatch}of originals){
    const side=Math.sign(hatch.position.z),root=new THREE.Group(),batches=new Map();
    root.name='Cargo door with personnel access';root.visible=false;root.userData.panelDetailExclude=true;
    root.userData.cargoHatch={scale,leaf:[leafWidth,leafHeight],referenceHuman};
    root.position.copy(hatch.position);root.rotation.y=side>0?0:Math.PI;root.scale.setScalar(1/scale);hatch.parent.add(root);roots.push(root);
    const add=(geometry,material,position=[0,0,0])=>{
      geometry.translate(...position);const expanded=geometry.index?geometry.toNonIndexed():geometry;
      if(expanded!==geometry)geometry.dispose();
      if(material.emissiveMap?.channel===1)expanded.setAttribute('uv1',new THREE.Float32BufferAttribute(new Float32Array(expanded.attributes.position.count*2),2));
      const geometries=batches.get(material)??[];geometries.push(expanded);batches.set(material,geometries);
    };
    const box=(material,position,size)=>add(new THREE.BoxGeometry(...size),material,position);
    const plate=(material,position,width,height,depth,cut=Math.min(width,height)*.14)=>{
      const shape=new THREE.Shape(),outline=[[-width/2+cut,-height/2],[width/2-cut,-height/2],
        [width/2,-height/2+cut],[width/2,height/2-cut],[width/2-cut,height/2],[-width/2+cut,height/2],
        [-width/2,height/2-cut],[-width/2,-height/2+cut]];
      outline.forEach(([horizontal,vertical],index)=>index?shape.lineTo(horizontal,vertical):shape.moveTo(horizontal,vertical));shape.closePath();
      const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1});geometry.translate(0,0,-depth/2);add(geometry,material,position);
    };
    const rail=(material,start,end,radius)=>{
      const direction=new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
      const geometry=new THREE.CylinderGeometry(radius,radius,direction.length(),6);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
      add(geometry,material,start.map((value,index)=>(value+end[index])/2));
    };
    plate(steel,[0,0,0],1.70*scale,2.36*scale,.22*scale);
    plate(dark,[0,0,.13*scale],1.46*scale,2.12*scale,.10*scale);
    plate(paint,[0,0,.21*scale],leafWidth,leafHeight,.12*scale);
    for(const height of [.85,1.45,2.05])box(steel,[0,height,face+.05],[leafWidth-.65,.13,.10]);
    for(const height of [-1.7,0,1.7]){
      box(steel,[-.74*scale,height,.15*scale],[.15*scale,.20*scale,.24*scale]);
      rail(pipe,[-.74*scale,height-.25,.32*scale],[-.74*scale,height+.25,.32*scale],.075);
      box(steel,[.76*scale,height,.16*scale],[.36,.34,.16]);
      box(pipe,[.70*scale,height,.21*scale],[.31,.11,.14]);
    }
    for(const horizontal of [-1,1])for(const vertical of [-1,1]){
      box(ochre,[horizontal*.69*scale,vertical*.93*scale,.15*scale],[.10*scale,.10*scale,.10*scale]);
    }
    box(ochre,[0,leafHeight/2-.23,face+.012],[leafWidth-.90,.065,.025]);
    const access=new THREE.Group();access.name='Personnel access hatch';access.position.set(.68,-leafHeight/2+.16+1.09,face);root.add(access);
    access.userData.dimensions={frame:[1.50,2.18],leaf:[1.30,1.94]};
    const center=access.position;
    const accessAt=(horizontal,vertical,depth)=>[center.x+horizontal,center.y+vertical,center.z+depth];
    plate(steel,accessAt(0,0,.065),1.50,2.18,.13,.16);
    plate(dark,accessAt(0,0,.135),1.40,2.06,.035,.13);
    plate(paint,accessAt(0,0,.175),1.30,1.94,.065,.12);
    for(const height of [-.65,.65])box(steel,accessAt(-.71,height,.17),[.12,.20,.16]);
    const wheel=new THREE.TorusGeometry(.12,.022,5,12);add(wheel,pipe,accessAt(.34,-.20,.255));
    box(steel,accessAt(.34,-.20,.215),[.12,.12,.08]);
    rail(pipe,accessAt(-.43,-.20,.26),accessAt(-.43,.31,.26),.025);
    box(ochre,accessAt(0,-.89,.215),[.72,.055,.025]);
    const sill=-leafHeight/2+.16;
    box(steel,[.68,sill-.055,face+.22],[1.55,.11,.50]);
    if(referenceHuman){
      const human=new THREE.Group();human.name='Study / 1.85m suited scale reference';human.position.set(-2.75,sill,face+.67);root.add(human);
      human.userData.height=1.85;
      const humanAt=(horizontal,vertical,depth=0)=>[human.position.x+horizontal,human.position.y+vertical,human.position.z+depth];
      box(suit,humanAt(0,1.10),[.54,.64,.36]);box(suit,humanAt(0,.70),[.42,.24,.34]);
      box(suit,humanAt(0,1.10,-.21),[.42,.51,.30]);
      add(new THREE.SphereGeometry(1,10,8).scale(.16,.19,.16),suit,humanAt(0,1.66));
      box(dark,humanAt(0,1.68,.145),[.23,.11,.04]);
      for(const horizontal of [-1,1]){
        rail(suit,humanAt(horizontal*.32,.815),humanAt(horizontal*.32,1.425),.08);
        rail(suit,humanAt(horizontal*.14,.10),humanAt(horizontal*.14,.64),.09);
        box(suit,humanAt(horizontal*.14,.07,.10),[.18,.14,.38]);
      }
    }
    for(const [material,geometries]of batches){
      const geometry=mergeGeometries(geometries,false);geometries.forEach(part=>part.dispose());
      const mesh=new THREE.Mesh(geometry,material);mesh.name='Cargo hatch / '+material.name;
      mesh.castShadow=material!==suit;mesh.receiveShadow=true;root.add(mesh);resources.push(geometry);
    }
  }
  const ink=[];ship.core.traverse(mesh=>{if(mesh.userData.exteriorDecal)ink.push(mesh);});
  for(const source of ink){
    const markings=source.userData.markings.filter(entry=>entry.key==='pressure'&&Math.abs(entry.point[0]-4)<.01);
    if(!markings.length)continue;
    const copies=[];ship.core.traverse(mesh=>{
      if(mesh===source||mesh.name==='Study B / preserved warning ink'&&mesh.geometry.attributes.position.count===source.geometry.attributes.position.count)copies.push(mesh);
    });
    for(const mesh of copies){
      const original=mesh.geometry,geometry=original.clone(),positions=geometry.attributes.position;
      for(const entry of markings){
        const side=Math.sign(entry.normal[2]),hatch=originals.find(item=>Math.sign(item.hatch.position.z)===side).hatch;
        const horizontal=-side*.84/scale,vertical=hatch.position.y+(-leafHeight/2+.16+1.10)/scale-entry.point[1];
        for(let index=entry.vertexStart;index<entry.vertexStart+entry.vertexCount;index++)positions.setXYZ(index,positions.getX(index)+horizontal,positions.getY(index)+vertical,positions.getZ(index));
      }
      geometry.computeBoundingBox();geometry.computeBoundingSphere();warningEdits.push({mesh,original,geometry});
    }
  }
  let disposed=false;
  return {roots,setEnabled(value){
    if(disposed)return;
    for(const root of roots)root.visible=Boolean(value);
    for(const {hatch,visible}of originals)hatch.visible=value?false:visible;
    for(const {mesh,original,geometry}of warningEdits)mesh.geometry=value?geometry:original;
  },dispose(){
    if(disposed)return;disposed=true;
    for(const root of roots)root.removeFromParent();for(const geometry of resources)geometry.dispose();
    for(const {mesh,original,geometry}of warningEdits){mesh.geometry=original;geometry.dispose();}
    for(const {hatch,visible}of originals)hatch.visible=visible;
  }};
}
