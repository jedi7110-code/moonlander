import * as THREE from 'three';

export const CAT_FOOD_PRINT='assets/obs/cat-food-luna.webp';
export const CAT_FOOD_PRINT_SIZE=[1024,512];

export function createCatFoodMaterial(map=null){
  if(map){map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;}
  const material=new THREE.MeshStandardMaterial({name:'Cat food / LUNA retail print',map,color:0xffffff,roughness:.74,metalness:0});
  material.userData.cabinKeepSurface=true;
  return material;
}

// One printed mesh, including the pinched heat seals and side gussets. The back
// uses the second half of the same atlas; empty wrappers retain the same print.
export function createCatFoodPouch(material,{empty=false}={}){
  const depth=empty?.05:.14,positions=[],uvs=[];
  const ys=[-.125,-.104,.102,.125],widths=[.106,.115,.115,.112];
  const point=(row,col,side)=>{
    const seal=row===0||row===3;
    const z=seal?.006:depth/2*(col===1?1:.88);
    return [(col-1)*widths[row],ys[row],side*z];
  };
  const quad=(points,uv)=>{
    for(const i of [0,1,2,0,2,3]){positions.push(...points[i]);uvs.push(...uv[i]);}
  };
  for(const side of [1,-1])for(let row=0;row<3;row++)for(let col=0;col<2;col++){
    const indices=[[row,col],[row,col+1],[row+1,col+1],[row+1,col]];
    if(side<0)indices.reverse();
    quad(indices.map(([r,c])=>point(r,c,side)),indices.map(([r,c])=>[
      side>0?.001+c*.249:.999-c*.249,
      .001+(ys[r]+.125)/.25*.998,
    ]));
  }
  const green=[.995,.025],cream=[.505,.975],ochre=[.005,.025];
  for(let row=0;row<3;row++){
    quad([point(row,0,-1),point(row,0,1),point(row+1,0,1),point(row+1,0,-1)],[green,green,green,green]);
    quad([point(row,2,1),point(row,2,-1),point(row+1,2,-1),point(row+1,2,1)],[green,green,green,green]);
  }
  quad([point(3,0,1),point(3,2,1),point(3,2,-1),point(3,0,-1)],[cream,cream,cream,cream]);
  quad([point(0,0,-1),point(0,2,-1),point(0,2,1),point(0,0,1)],[ochre,ochre,ochre,ochre]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=empty?'Cat food / empty LUNA pouch':'Cat food / sealed LUNA pouch';
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

export function createCatFoodCarton(material){
  const geometry=new THREE.BoxGeometry(.61,.272,.43),uv=geometry.attributes.uv;
  // BoxGeometry: right, left, top, bottom, front, back. Keep the artwork upright.
  for(let face=0;face<6;face++)for(let i=0;i<4;i++){
    const index=face*4+i,u=uv.getX(index),v=uv.getY(index);
    if(face===4)uv.setXY(index,.001+u*.998,.001+v*.998);
    else if(face===5)uv.setXY(index,.501+u*.498,.001+v*.998);
    else uv.setXY(index,face===2?.505:.995,face===2?.975:.025);
  }
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Cat food / LUNA supply carton';
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
