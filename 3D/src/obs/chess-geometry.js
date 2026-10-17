import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const foot=[[0,.035],[.24,.035],[.29,.055],[.32,.09],[.32,.13],[.30,.16],[.275,.18],[.275,.205],[.245,.23],[.245,.255],[.205,.275]];
const lathe=points=>new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),48);
const sphere=()=>new THREE.SphereGeometry(1,28,18);

function neck(sections){
  const count=40,vertices=[],indices=[];
  for(const {y,z,rx,rz} of sections)for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2;vertices.push(Math.sin(a)*rx,y,z+Math.cos(a)*rz);
  }
  for(let row=0;row<sections.length-1;row++)for(let i=0;i<count;i++){
    const a=row*count+i,b=row*count+(i+1)%count,c=a+count,d=b+count;
    indices.push(a,b,c,b,d,c);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

// The horse's forehead, nasal bridge and muzzle form one continuous volume.
// Cross sections narrow along the bridge, widening again at the closed muzzle;
// the deeper rear sections describe the cheek and the cut-in under the jaw.
function horseHead(){
  const sections=[
    [.13,1.13,.99,.015],[.09,1.22,.90,.10],
    [.015,1.265,.865,.145],[-.07,1.265,.845,.157],
    [-.15,1.215,.85,.144],[-.24,1.145,.815,.127],
    [-.33,1.075,.77,.112],[-.42,1.005,.728,.113],
    [-.49,.97,.71,.123],[-.555,.947,.742,.119],
    [-.59,.928,.79,.103],[-.595,.87,.855,.001]
  ];
  const around=40,rows=80,vertices=[],indices=[];
  const interpolate=(a,b,c,d,t)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  for(let row=0;row<=rows;row++){
    const u=row/rows*(sections.length-1),i=Math.min(sections.length-2,Math.floor(u)),t=u-i;
    const section=sections[0].map((_,axis)=>interpolate(sections[Math.max(0,i-1)][axis],sections[i][axis],sections[i+1][axis],sections[Math.min(sections.length-1,i+2)][axis],t));
    const [headZ,top,bottom,width]=section;
    // Compress the face forward of the cheek without thinning the jaw.
    const z=headZ<-.07?-.07+(headZ+.07)*.85:headZ;
    for(let n=0;n<around;n++){
      const a=n/around*Math.PI*2,vertical=Math.cos(a);
      // A broad cheek flows into a narrower, flatter forehead, without an eye bump.
      const x=Math.sin(a)*width*(1-.18*Math.max(0,vertical));
      vertices.push(x,(top+bottom)/2+vertical*(top-bottom)/2,z);
    }
  }
  for(let row=0;row<rows;row++)for(let n=0;n<around;n++){
    const a=row*around+n,b=row*around+(n+1)%around,c=a+around,d=b+around;
    indices.push(a,b,c,b,d,c);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

// Turned Staunton bodies with sculpted crowns and an arched, horse-shaped knight.
// The six reusable meshes are shared by every piece of that type.
export function createChessPieceGeometry(type){
  const parts=[];
  const add=(geometry,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0])=>{
    geometry.scale(...scale);geometry.rotateX(rotation[0]);geometry.rotateY(rotation[1]);geometry.rotateZ(rotation[2]);
    geometry.translate(...position);parts.push(geometry);
  };
  const body=profile=>add(lathe([...foot,...profile]));
  if(type==='p'){
    body([[.175,.32],[.13,.43],[.115,.5],[.15,.55],[.175,.575],[.175,.61],[.12,.64],[0,.66]]);
    add(sphere(),[0,.746,0],[.172,.172,.172]);
  }else if(type==='r'){
    body([[.19,.31],[.175,.42],[.175,.73],[.22,.78],[.28,.81],[.29,.85],[.29,.97],[.205,.97],[.205,.875],[0,.875]]);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      add(new RoundedBoxGeometry(.145,.175,.15,2,.012),[Math.sin(a)*.245,1.035,Math.cos(a)*.245],[1,1,1],[0,a,0]);
    }
  }else if(type==='n'){
    body([[.22,.3],[.235,.335],[.235,.38],[.205,.405],[0,.405]]);
    add(neck([
      {y:.35,z:.055,rx:0,rz:0},{y:.38,z:.055,rx:.21,rz:.225},
      {y:.48,z:.09,rx:.195,rz:.235},{y:.62,z:.115,rx:.166,rz:.225},
      {y:.78,z:.135,rx:.14,rz:.195},{y:.94,z:.115,rx:.124,rz:.16},
      {y:1.065,z:.06,rx:.12,rz:.135},{y:1.17,z:.025,rx:.105,rz:.10},
      {y:1.235,z:.01,rx:.07,rz:.07},{y:1.26,z:.0,rx:0,rz:0}
    ]));
    add(horseHead());
    for(const side of [-1,1]){
      // Short leaf-shaped ears spring from the poll, rather than cone horns.
      add(neck([
        {y:0,z:0,rx:.047,rz:.045},{y:.045,z:.012,rx:.056,rz:.038},
        {y:.095,z:.005,rx:.041,rz:.028},{y:.15,z:-.015,rx:.018,rz:.013},
        {y:.175,z:-.025,rx:.001,rz:.001}
      ]),[side*.085,1.225,.035],[1,1,1],[0,0,-side*.13]);
    }
    const mane=new THREE.Shape();
    mane.moveTo(.18,.43);mane.bezierCurveTo(.32,.66,.32,.99,.06,1.26);
    mane.lineTo(.095,1.29);
    const crest=[[.17,1.21],[.23,1.13],[.28,1.05],[.32,.97],[.345,.89],[.355,.81],[.35,.73],[.33,.65],[.30,.57],[.255,.49]];
    for(const [z,y]of crest){
      mane.lineTo(z+.025,y+.018);mane.lineTo(z,y-.018);
    }
    mane.lineTo(.18,.43);
    const ridge=new THREE.ExtrudeGeometry(mane,{depth:.065,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,curveSegments:18});
    // Shape x/y is the horse's back z/y; extrusion supplies its narrow width.
    const p=ridge.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setX(i,z-.0325);p.setZ(i,x);}
    // Swapping x/z reverses winding.
    const non=ridge.index?ridge.toNonIndexed():ridge,a=non.attributes.position;
    for(let i=0;i<a.count;i+=3)for(let axis=0;axis<3;axis++){
      const v=a.array[(i+1)*3+axis];a.array[(i+1)*3+axis]=a.array[(i+2)*3+axis];a.array[(i+2)*3+axis]=v;
    }
    non.computeVertexNormals();if(non!==ridge)ridge.dispose();add(non);
  }else if(type==='b'){
    body([[.18,.32],[.135,.49],[.115,.76],[.145,.83],[.21,.86],[.21,.9],[.15,.935],[0,.96]]);
    const hat=new THREE.Shape();
    hat.moveTo(0,.94);
    hat.bezierCurveTo(-.27,1.01,-.20,1.16,0,1.40);
    hat.lineTo(.106,1.265);hat.lineTo(-.07,1.09);hat.lineTo(-.027,1.048);
    hat.lineTo(.153,1.225);hat.bezierCurveTo(.235,1.10,.225,1.005,0,.94);
    add(new THREE.ExtrudeGeometry(hat,{depth:.17,bevelEnabled:true,bevelSize:.018,bevelThickness:.065,bevelSegments:5,curveSegments:24}),[0,0,-.085]);
    add(sphere(),[0,1.405,0],[.047,.047,.047]);
  }else if(type==='q'){
    body([[.18,.33],[.125,.58],[.105,.85],[.13,.95],[.20,.99],[.205,1.035],[.145,1.075],[.16,1.14],[.225,1.24],[.235,1.29],[.18,1.29],[.13,1.18],[0,1.16]]);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      add(new THREE.ConeGeometry(.038,.17,16),[Math.sin(a)*.205,1.315,Math.cos(a)*.205],[1,1,1],[Math.cos(a)*.17,0,-Math.sin(a)*.17]);
      add(sphere(),[Math.sin(a)*.219,1.405,Math.cos(a)*.219],[.046,.046,.046]);
    }
    add(sphere(),[0,1.30,0],[.07,.085,.07]);
  }else if(type==='k'){
    body([[.19,.33],[.14,.53],[.115,.86],[.14,1.0],[.215,1.055],[.22,1.10],[.17,1.145],[.19,1.19],[.22,1.255],[.2,1.30],[.12,1.33],[0,1.33]]);
    add(sphere(),[0,1.345,0],[.095,.08,.095]);
    add(new RoundedBoxGeometry(.067,.26,.078,3,.009),[0,1.485,0]);
    add(new RoundedBoxGeometry(.225,.061,.078,3,.009),[0,1.51,0]);
  }else throw new Error('Unknown chess piece: '+type);

  const flat=parts.map(geometry=>{
    const result=geometry.index?geometry.toNonIndexed():geometry;
    for(const name of Object.keys(result.attributes))if(!['position','normal'].includes(name))result.deleteAttribute(name);
    return result;
  });
  const result=mergeGeometries(flat);result.computeBoundingBox();result.computeBoundingSphere();
  new Set([...parts,...flat]).forEach(geometry=>geometry.dispose());
  result.name='Staunton '+type;return result;
}

export function chessSquarePosition(square){
  return new THREE.Vector3('abcdefgh'.indexOf(square[0])-3.5,0,4.5-Number(square[1]));
}
export function chessSquareAt(point,flipped=false){
  const x=flipped?-point.x:point.x,z=flipped?-point.z:point.z;
  if(x< -4||x>=4||z< -4||z>=4)return null;
  return 'abcdefgh'[Math.floor(x+4)]+(8-Math.floor(z+4));
}

// Project the accessible 800px grid onto exactly the same y=0 plane as WebGL.
// This is a homography, so keyboard focus outlines survive perspective/resize.
export function chessGridMatrix(camera,width,height){
  const m=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
  const row=(component,sign,extent)=>{
    const a=(m[3]+sign*m[component])*extent/2,b=(m[11]+sign*m[component+8])*extent/2;
    const c=(m[15]+sign*m[component+12])*extent/2;
    return[a/100,b/100,c-4*a-4*b];
  };
  const [a,b,c]=row(0,1,width),[d,e,f]=row(1,-1,height);
  return[a,d,0,m[3]/100,b,e,0,m[11]/100,0,0,1,0,c,f,0,m[15]-4*m[3]-4*m[11]];
}
