import * as THREE from 'three';
import {box,cylinder,rod} from './materials.js';
import {createMachinedMetals} from './machined-metals.js';

function panel(parent,material,shape,depth,bevel,transform){
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,
    bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:8});
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const point=transform(positions.getX(i),positions.getY(i),positions.getZ(i));
    positions.setXYZ(i,...point);
  }
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function backShape(){
  const shape=new THREE.Shape();
  shape.moveTo(-.22,.55);shape.quadraticCurveTo(-.33,.56,-.35,.70);
  shape.lineTo(-.35,1.10);shape.quadraticCurveTo(-.34,1.20,-.29,1.28);
  shape.lineTo(-.26,1.47);shape.quadraticCurveTo(-.25,1.55,-.17,1.56);
  shape.quadraticCurveTo(0,1.59,.17,1.56);shape.quadraticCurveTo(.25,1.55,.26,1.47);
  shape.lineTo(.29,1.28);shape.quadraticCurveTo(.34,1.20,.35,1.10);
  shape.lineTo(.35,.70);shape.quadraticCurveTo(.33,.56,.22,.55);shape.closePath();return shape;
}

function cushion(parent,material,x,y,z,w,h,d,r){
  // A broad rounded edge and a slight recline keep the pads soft in toon light.
  const mesh=box(parent,material,x,y,z,w,h,d,r);mesh.rotation.x=-.11;return mesh;
}

export function createPilotSeat(metals=createMachinedMetals()){
  const root=new THREE.Group();root.name='Pilot seat';
  const {shell,alloy}=metals;
  const pad=new THREE.MeshStandardMaterial({name:'Pilot seat / charcoal cushions',color:0x293130,roughness:.9,metalness:0});
  const red=new THREE.MeshStandardMaterial({name:'Pilot seat / release red',color:0xad3d2b,roughness:.6});

  // A bolted plinth and paired articulated supports replace the office-chair legs.
  box(root,shell,0,.05,.025,.70,.10,.76,.06);
  box(root,pad,0,.108,.025,.39,.025,.46,.012);
  for(const side of [-1,1]){
    const support=new THREE.Shape();support.moveTo(-.17,.12);support.lineTo(.07,.12);
    support.lineTo(.18,.43);support.quadraticCurveTo(.19,.49,.10,.50);
    support.lineTo(-.09,.50);support.lineTo(-.22,.23);support.quadraticCurveTo(-.25,.15,-.17,.12);
    panel(root,shell,support,.058,.015,(z,y,x)=>[side*.16-x+.029,y,z]);
    for(const [y,z]of [[.19,-.10],[.43,.07]]){
      const hinge=cylinder(root,alloy,side*.211,y,z,.08,.045,.08,20);hinge.rotation.z=Math.PI/2;
      const cap=cylinder(root,pad,side*.24,y,z,.047,.018,.047,16);cap.rotation.z=Math.PI/2;
    }
    for(const z of [-.23,.29]){
      cylinder(root,alloy,side*.27,.105,z,.022,.015,.022,8);
    }
  }
  box(root,pad,0,.48,-.005,.42,.14,.48,.04);
  box(root,shell,0,.535,.02,.69,.10,.65,.055);
  box(root,pad,0,.625,.055,.55,.15,.54,.07);

  // A continuous tapered shell with curved shoulders and a separate head cushion.
  panel(root,shell,backShape(),.075,.025,(x,y,z)=>[x,y,z-.335-(y-.55)*.12]);
  cushion(root,pad,0,.83,-.205,.46,.32,.16,.075);
  cushion(root,pad,0,1.14,-.246,.54,.43,.18,.085);
  cushion(root,pad,0,1.455,-.294,.43,.205,.18,.08);

  // Rear reinforcement follows the shell's contour, visible from the cabin camera.
  const rear=new THREE.Shape();rear.moveTo(-.15,.63);rear.lineTo(-.25,.82);rear.lineTo(-.25,1.12);
  rear.quadraticCurveTo(-.24,1.19,-.19,1.23);rear.lineTo(.19,1.23);
  rear.quadraticCurveTo(.24,1.19,.25,1.12);rear.lineTo(.25,.82);rear.lineTo(.15,.63);rear.closePath();
  panel(root,alloy,rear,.012,.018,(x,y,z)=>[x,y,z-.374-(y-.55)*.12]);
  box(root,shell,0,.88,-.433,.085,.36,.045,.02).rotation.x=-.12;
  box(root,pad,0,1.385,-.458,.28,.035,.015,.012);

  for(const side of [-1,1]){
    // Swept side cheeks and padded armrests grow out of the bucket shell.
    const cheek=new THREE.Shape();cheek.moveTo(-.24,.56);cheek.lineTo(.21,.53);
    cheek.quadraticCurveTo(.35,.54,.34,.65);cheek.quadraticCurveTo(.34,.72,.24,.75);
    cheek.lineTo(-.02,.78);cheek.lineTo(-.15,.96);cheek.quadraticCurveTo(-.25,.99,-.25,.89);cheek.closePath();
    panel(root,shell,cheek,.07,.025,(z,y,x)=>[side*.33-x+.035,y,z]);
    box(root,shell,side*.37,.94,.015,.17,.075,.43,.035);
    box(root,pad,side*.37,.989,.035,.14,.055,.36,.025);
    const pivot=cylinder(root,alloy,side*.394,.72,-.16,.06,.04,.06,16);pivot.rotation.z=Math.PI/2;
    rod(root,red,[side*.285,.69,-.205],[side*.285,.88,-.285],.024);
    box(root,pad,side*.285,.82,-.26,.055,.025,.055,.009);
  }
  return root;
}
