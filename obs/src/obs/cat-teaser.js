import {Group,Mesh,Vector3,Quaternion,Matrix4,CatmullRomCurve3,TubeGeometry,MathUtils} from 'three';
import {rod,ball} from './materials.js';

const restingCord=[[.38,.008,0],[.43,.003,.02],[.41,.003,.07],[.34,.003,.082],[.29,.003,.060]];
const restingLure=new Vector3(.28,.018,.06),segments=32,sides=6,radius=.0015;

export function createCatTeaser(toy,m){
  rod(toy,m.olive,[0,.012,0],[.085,.012,0],.012).name='Cat teaser handle';
  rod(toy,m.olive,[.08,.008,0],[.38,.008,0],.006).name='Cat teaser rod';
  const rest=new CatmullRomCurve3(restingCord.map(p=>new Vector3(...p)));
  const cord=new Mesh(new TubeGeometry(rest,segments,radius,sides,false),m.dark);
  cord.name='Cat teaser cord';toy.add(cord);
  const lure=new Group();lure.name='Cat teaser red lure';lure.position.copy(restingLure);toy.add(lure);
  ball(lure,m.red,0,0,0,.018,.018,.027);
  for(const [x,z,angle]of [[-.03,0,-.35],[-.01,.032,.20]]){
    const feather=ball(lure,m.red,x,-.014,z,.013,.004,.035);feather.rotation.y=angle;
  }
  toy.userData.catTeaser={cord,lure,rest,length:rest.getLength()};
}

// Quasi-static gravity, evaluated from the current pose so scrubbing and
// interrupted returns do not depend on the last rendered frame. As the tip
// rises, the lifted length hangs down and the remaining cord rests on the table.
export function updateCatTeaser(toy,home){
  const fit=toy.userData.catTeaser;if(!fit)return;
  const {cord,lure,rest,length}=fit;
  toy.updateWorldMatrix(true,false);
  if(fit.lastMatrix?.equals(toy.matrixWorld))return;
  (fit.lastMatrix??=new Matrix4()).copy(toy.matrixWorld);
  const tip=toy.localToWorld(rest.getPointAt(0)),restTip=rest.getPointAt(0).applyQuaternion(home.quaternion).add(home.position);
  const table=toy.userData.tableSupport,localTip=tip.clone().sub(home.position).applyQuaternion(home.quaternion.clone().invert());
  const outside=table&&(localTip.x<table.minX||localTip.x>table.maxX||localTip.z<table.minZ||localTip.z>table.maxZ);
  const height=Math.max(0,tip.y-restTip.y),lift=outside?length:Math.min(length,height);
  const supported=rest.getPointAt(lift/length).applyQuaternion(home.quaternion),points=[];
  for(let i=0;i<=segments;i++){
    const distance=length*i/segments,point=tip.clone();
    if(distance<=lift)point.y-=distance;
    else point.add(rest.getPointAt(i/segments).applyQuaternion(home.quaternion).sub(supported)).add(new Vector3(0,-lift,0));
    points.push(toy.worldToLocal(point));
  }
  const curve=new CatmullRomCurve3(points),frames=curve.computeFrenetFrames(segments,false);
  const {position,normal}=cord.geometry.attributes;
  for(let i=0;i<=segments;i++){
    const point=curve.getPointAt(i/segments);
    for(let j=0;j<=sides;j++){
      const angle=j/sides*Math.PI*2,n=frames.normals[i].clone().multiplyScalar(-Math.cos(angle)).addScaledVector(frames.binormals[i],Math.sin(angle));
      const k=i*(sides+1)+j;
      normal.setXYZ(k,n.x,n.y,n.z);position.setXYZ(k,point.x+radius*n.x,point.y+radius*n.y,point.z+radius*n.z);
    }
  }
  position.needsUpdate=true;normal.needsUpdate=true;cord.geometry.computeBoundingBox();cord.geometry.computeBoundingSphere();
  const hanging=outside?1:MathUtils.smoothstep(height,length,length+.045);
  const restOffset=restingLure.clone().sub(rest.getPointAt(1)).applyQuaternion(home.quaternion);
  const end=toy.localToWorld(points.at(-1).clone());
  end.add(restOffset.lerp(new Vector3(0,-.018,0),hanging));
  if(hanging<1)end.y=Math.max(end.y,home.position.y+restingLure.y);
  lure.position.copy(toy.worldToLocal(end));
  const downward=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2);
  lure.quaternion.copy(toy.getWorldQuaternion(new Quaternion()).invert()).multiply(home.quaternion.clone().slerp(downward,hanging));
}
