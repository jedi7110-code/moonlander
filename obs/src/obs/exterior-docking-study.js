import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PROBE_DOCK} from './exterior-docking.js';

export function createDockingClearanceStudy(ship){
  const materials=new Set();ship.root.traverse(mesh=>{for(const material of [].concat(mesh.material??[]))materials.add(material);});
  const plane=new THREE.Plane(new THREE.Vector3(0,0,-1),0),group=new THREE.Group();group.name='Study only / suited crew clearance';group.visible=false;ship.probeDock.add(group);
  const parts=[],part=(geometry,position)=>{geometry.translate(...position);parts.push(geometry);};
  part(new THREE.BoxGeometry(.54,.64,.36),[0,1.10,.08]);
  part(new THREE.BoxGeometry(.42,.24,.34),[0,.70,.07]);
  part(new THREE.BoxGeometry(.42,.51,.30),[0,1.10,-.21]);
  part(new THREE.CylinderGeometry(.11,.11,.12,8),[0,1.47,.10]);
  part(new THREE.SphereGeometry(1,10,8).scale(.16,.19,.16),[0,1.66,.10]);
  for(const side of [-1,1]){
    part(new THREE.CylinderGeometry(.08,.08,.61,6),[side*.32,1.12,.08]);
    part(new THREE.CylinderGeometry(.09,.09,.54,6),[side*.14,.37,.07]);
    part(new THREE.BoxGeometry(.18,.14,.38),[side*.14,.07,.17]);
  }
  const expanded=parts.map(geometry=>geometry.toNonIndexed()),geometry=mergeGeometries(expanded,false);
  parts.forEach(part=>part.dispose());expanded.forEach(part=>part.dispose());
  const material=new THREE.MeshStandardMaterial({color:0xc9dac1,roughness:.85,metalness:.03}),human=new THREE.Mesh(geometry,material);
  human.name='1.85m suited human / 0.80m by 0.72m envelope';human.position.y=5.72;group.add(human);
  const boundsBox=new THREE.BoxGeometry(PROBE_DOCK.suitWidth,PROBE_DOCK.suitHeight,PROBE_DOCK.suitDepth);
  const boundsGeometry=new THREE.EdgesGeometry(boundsBox);boundsBox.dispose();
  const lineMaterial=new THREE.LineBasicMaterial({color:0xe7bb65,depthTest:false,transparent:true,opacity:.75});
  const envelope=new THREE.LineSegments(boundsGeometry,lineMaterial);envelope.position.set(0,5.72+PROBE_DOCK.suitHeight/2,0);group.add(envelope);
  const diameterGeometry=new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-.60,6.3,.02),new THREE.Vector3(.60,6.3,.02),
    new THREE.Vector3(-.60,6.23,.02),new THREE.Vector3(-.60,6.37,.02),
    new THREE.Vector3(.60,6.23,.02),new THREE.Vector3(.60,6.37,.02),
  ]);
  group.add(new THREE.LineSegments(diameterGeometry,lineMaterial));
  return {setEnabled(value){
    group.visible=Boolean(value);ship.setDockTransferOpen(value);
    for(const material of materials){material.clippingPlanes=value?[plane]:[];material.needsUpdate=true;}
  },dispose(){
    for(const material of materials)material.clippingPlanes=[];
    group.removeFromParent();geometry.dispose();boundsGeometry.dispose();diameterGeometry.dispose();material.dispose();lineMaterial.dispose();
  }};
}
