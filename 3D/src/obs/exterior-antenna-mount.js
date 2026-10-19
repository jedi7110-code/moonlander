import * as THREE from 'three';

export function addAntennaFoundation(parent,antenna,surface,materials,{addMesh,box,axisCylinder,pipe}){
  parent.updateWorldMatrix(true,false);surface.updateWorldMatrix(true,false);
  const inverse=parent.matrixWorld.clone().invert(),down=new THREE.Vector3(0,-1,0).transformDirection(parent.matrixWorld);
  const roofAt=(axial,lateral)=>{
    const origin=parent.localToWorld(new THREE.Vector3(axial,8,lateral));
    const hit=new THREE.Raycaster(origin,down,0,16).intersectObject(surface,false)[0];
    if(!hit)throw new Error('Antenna foundation has no hull bearing surface');
    return hit.point.clone().applyMatrix4(inverse);
  };
  const {radius,mountPoint}=antenna.userData.antenna,anchor=roofAt(antenna.position.x,antenna.position.z);
  antenna.position.y=anchor.y+.40;antenna.updateMatrix();
  const pivot=new THREE.Vector3(...mountPoint).applyMatrix4(antenna.matrix);
  const foundation=new THREE.Group();foundation.name='Bolted antenna azimuth and elevation mount';parent.add(foundation);
  const halfLength=Math.max(.28,radius*.50),halfWidth=Math.max(.22,radius*.34),chamfer=.07,baseTop=anchor.y+.08;
  const outline=[[-halfLength+chamfer,-halfWidth],[halfLength-chamfer,-halfWidth],
    [halfLength,-halfWidth+chamfer],[halfLength,halfWidth-chamfer],
    [halfLength-chamfer,halfWidth],[-halfLength+chamfer,halfWidth],
    [-halfLength,halfWidth-chamfer],[-halfLength,-halfWidth+chamfer]];
  const positions=[],indices=[];
  for(const upper of [false,true])for(const [axial,lateral]of outline){
    const point=roofAt(anchor.x+axial,anchor.z+lateral);
    positions.push(point.x,upper?baseTop:point.y-.015,point.z);
  }
  for(let index=0;index<8;index++){
    const next=(index+1)%8;indices.push(index,index+8,next,next,index+8,next+8);
  }
  for(let index=1;index<7;index++)indices.push(0,index,index+1,8,8+index+1,8+index);
  const plate=new THREE.BufferGeometry();plate.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));plate.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));plate.setIndex(indices);plate.computeVertexNormals();
  addMesh(foundation,plate,materials.steel,'Conformal antenna load-spreading foundation');
  for(const axial of [-1,1])for(const lateral of [-1,1]){
    addMesh(foundation,new THREE.CylinderGeometry(.035,.035,.055,6),materials.pipe,'Antenna hull anchor bolt',
      [anchor.x+axial*halfLength*.75,baseTop+.0275,anchor.z+lateral*halfWidth*.66]);
  }
  const turnRadius=Math.max(.16,radius*.31),forkHalf=Math.max(.13,radius*.27),cheekThickness=.07;
  addMesh(foundation,new THREE.CylinderGeometry(turnRadius*.92,turnRadius,.10,12),materials.dark,'Antenna azimuth bearing housing',[anchor.x,baseTop+.05,anchor.z]);
  addMesh(foundation,new THREE.CylinderGeometry(turnRadius,turnRadius,.04,12),materials.steel,'Antenna azimuth bearing flange',[anchor.x,baseTop+.105,anchor.z]);
  box(foundation,materials.steel,[anchor.x,baseTop+.145,anchor.z],[forkHalf*2+.16,.08,halfWidth*1.4],'Antenna yoke crosshead');
  const footReach=halfWidth*.6,topReach=.10,footHeight=baseTop+.17;
  const headFront=new THREE.Vector3(0,-.025,topReach).applyMatrix4(antenna.matrix);
  const headRear=new THREE.Vector3(0,-.025,-topReach).applyMatrix4(antenna.matrix);
  for(const side of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(anchor.z-footReach,footHeight);shape.lineTo(anchor.z+footReach,footHeight);
    shape.lineTo(headFront.z,headFront.y);shape.lineTo(headRear.z,headRear.y);shape.closePath();
    const cheek=new THREE.ExtrudeGeometry(shape,{depth:cheekThickness,bevelEnabled:false,steps:1,curveSegments:1});
    cheek.translate(0,0,-cheekThickness/2);cheek.rotateY(-Math.PI/2);cheek.translate(anchor.x+side*forkHalf,0,0);
    addMesh(foundation,cheek,materials.steel,'Antenna elevation yoke cheek');
  }
  const trunnion=new THREE.Group();trunnion.name='Antenna elevation trunnion';trunnion.position.copy(pivot);foundation.add(trunnion);
  const pinRadius=Math.max(.035,radius*.075);
  axisCylinder(trunnion,materials.pipe,0,pinRadius,2*forkHalf+cheekThickness+.08,'Antenna elevation axis pin',12);
  for(const side of [-1,1])axisCylinder(trunnion,materials.steel,side*forkHalf,pinRadius*1.4,cheekThickness+.035,'Antenna elevation pivot bearing',12);
  const driveX=pivot.x+forkHalf+.09;
  box(foundation,materials.dark,[driveX,pivot.y-.015,pivot.z-.015],[.12,.12,.14],'Antenna elevation drive housing');
  pipe(foundation,materials.pipe,[[driveX,pivot.y-.075,pivot.z-.015],[driveX,baseTop+.05,pivot.z-.10],[anchor.x+.15,baseTop+.015,anchor.z-.17]],.023,'Restrained antenna drive cable');
  return foundation;
}
