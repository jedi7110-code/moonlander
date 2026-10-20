import * as THREE from 'three';

export const DOCK_CAPTURE=Object.freeze({delay:.12,swing:.62,preload:.18,pivotRadius:1.14,pivotY:6.042,openAngle:Math.PI*.39,closedAngle:-.022});
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>value*value*(3-2*value);

export function sampleDockCapture(seconds,timeScale=1){
  return clamp((seconds/timeScale-DOCK_CAPTURE.delay)/(DOCK_CAPTURE.swing+DOCK_CAPTURE.preload));
}

export function dockCaptureAngle(progress){
  const split=DOCK_CAPTURE.swing/(DOCK_CAPTURE.swing+DOCK_CAPTURE.preload);
  return DOCK_CAPTURE.openAngle*(1-smooth(clamp(progress/split)))+
    DOCK_CAPTURE.closedAngle*smooth(clamp((progress-split)/(1-split)));
}

export function addDockCaptureClaws(cradle,materials,{addMesh,box,rod}){
  const group=new THREE.Group();group.name='Six articulated hard-capture claws';
  group.userData.bakeBoundary=true;group.userData.panelDetailExclude=true;cradle.add(group);
  const outline=[[-.08,.07],[.08,.07],[.08,-.62],[.01,-.70],[-.31,-.70],[-.31,-.65],[-.08,-.65]];
  const shape=new THREE.Shape();outline.forEach(([radial,vertical],index)=>index?shape.lineTo(radial,vertical):shape.moveTo(radial,vertical));shape.closePath();
  const clawGeometry=new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false,steps:1,curveSegments:1});clawGeometry.translate(0,0,-.11);
  if(materials.steel.emissiveMap?.channel===1)clawGeometry.setAttribute('uv1',new THREE.Float32BufferAttribute(new Float32Array(clawGeometry.attributes.position.count*2),2));
  const claws=new THREE.InstancedMesh(clawGeometry,materials.steel,6);claws.name='Pivoted capture hooks';
  const barrels=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.09,.29,8),materials.dark,6);barrels.name='Capture actuator barrels';
  const rods=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.035,1,8),materials.pipe,6);rods.name='Capture actuator piston rods';
  for(const mesh of [claws,barrels,rods]){
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(mesh);
  }
  for(let index=0;index<6;index++){
    const angle=index*Math.PI/3,mount=new THREE.Group();mount.rotation.y=-angle;cradle.add(mount);
    box(mount,materials.steel,[.94,6.30,0],[.48,.16,.36],'Capture-claw structural foundation');
    for(const side of [-1,1]){
      box(mount,materials.steel,[DOCK_CAPTURE.pivotRadius,DOCK_CAPTURE.pivotY+.04,side*.165],[.23,.24,.08],'Capture hinge clevis cheek');
    }
    rod(mount,materials.pipe,[1.35,6.50,-.12],[1.35,6.50,.12],.045,'Capture actuator rear bearing');
    rod(mount,materials.pipe,[DOCK_CAPTURE.pivotRadius,DOCK_CAPTURE.pivotY,-.23],[DOCK_CAPTURE.pivotRadius,DOCK_CAPTURE.pivotY,.23],.065,'Capture-claw hinge pin');
    rod(mount,materials.steel,[.86,6.32,0],[1.35,6.50,0],.075,'Capture actuator reaction bracket');
    box(mount,materials.ochre,[1.195,6.13,.21],[.10,.08,.025],'Capture-claw safety witness mark');
  }
  const radialMatrix=new THREE.Matrix4(),hingeMatrix=new THREE.Matrix4(),matrix=new THREE.Matrix4(),cylinderMatrix=new THREE.Matrix4();
  const anchor=new THREE.Vector3(1.35,6.50,0),tip=new THREE.Vector3(),direction=new THREE.Vector3(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  let current=-1;
  const setProgress=value=>{
    const progress=clamp(Number(value)||0);if(progress===current)return;current=progress;
    const angle=dockCaptureAngle(progress);
    hingeMatrix.makeRotationZ(angle);hingeMatrix.setPosition(DOCK_CAPTURE.pivotRadius,DOCK_CAPTURE.pivotY,0);
    tip.set(.035,-.27,0).applyMatrix4(hingeMatrix);direction.copy(tip).sub(anchor);
    const length=direction.length();direction.normalize();rotation.setFromUnitVectors(up,direction);
    for(let index=0;index<6;index++){
      radialMatrix.makeRotationY(-index*Math.PI/3);matrix.multiplyMatrices(radialMatrix,hingeMatrix);claws.setMatrixAt(index,matrix);
      position.copy(anchor).addScaledVector(direction,.145);scale.set(1,1,1);cylinderMatrix.compose(position,rotation,scale);
      matrix.multiplyMatrices(radialMatrix,cylinderMatrix);barrels.setMatrixAt(index,matrix);
      position.copy(anchor).addScaledVector(direction,(.21+length)/2);scale.set(1,length-.21,1);cylinderMatrix.compose(position,rotation,scale);
      matrix.multiplyMatrices(radialMatrix,cylinderMatrix);rods.setMatrixAt(index,matrix);
    }
    for(const mesh of [claws,barrels,rods]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
    group.userData.capture={progress,locked:progress===1,angle};
  };
  setProgress(1);
  return {group,claws,barrels,rods,setProgress,get progress(){return current;}};
}
