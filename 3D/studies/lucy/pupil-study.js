import {Float32BufferAttribute,Vector3} from 'three';

// Eye margins and pupils share a material. Select the two small disconnected
// pupil shells, never the surrounding sockets or the iris.
export function pupilShells(geometry){
  const p=geometry.attributes.position,parent=Array.from({length:p.count},(_,i)=>i);
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const index=geometry.index;
  for(let i=0;i<(index?.count??p.count);i+=3){
    const a=index?index.getX(i):i;
    for(let j=1;j<3;j++)parent[find(index?index.getX(i+j):i+j)]=find(a);
  }
  const groups=new Map();
  for(let i=0;i<p.count;i++){const key=find(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
  return [...groups.values()].map(indices=>{
    const xs=indices.map(i=>p.getX(i)),zs=indices.map(i=>p.getZ(i));
    const min=Math.min(...xs),max=Math.max(...xs);
    return {indices,center:(min+max)/2,width:max-min,z:Math.min(...zs)};
  }).filter(g=>g.indices.length>100&&g.width>.002&&g.width<.004&&g.z>.259);
}

export function addLucyPupilShape(root){
  root.traverse(mesh=>{
    if(mesh.material?.name!=='Pupils and eye margin'||mesh.morphTargetDictionary?.PupilOval!==undefined)return;
    const geometry=mesh.geometry.clone(),shells=pupilShells(geometry);
    if(shells.length!==2)throw new Error(`Expected two Lucy pupil shells, found ${shells.length}`);
    const p=geometry.attributes.position,delta=new Float32Array(p.count*3),normal=new Float32Array(delta.length);
    const scale=2.2,before=new Vector3(),after=new Vector3();
    for(const shell of shells)for(const i of shell.indices){
      delta[i*3]=(p.getX(i)-shell.center)*(scale-1);
      before.fromBufferAttribute(geometry.attributes.normal,i);
      after.copy(before);after.x/=scale;after.normalize().sub(before);normal.set(after.toArray(),i*3);
    }
    const count=geometry.morphAttributes.position?.length??0;
    geometry.morphAttributes.position??=[];
    geometry.morphAttributes.normal??=Array.from({length:count},()=>new Float32BufferAttribute(new Float32Array(delta.length),3));
    geometry.morphAttributes.position.push(new Float32BufferAttribute(delta,3));
    geometry.morphAttributes.normal.push(new Float32BufferAttribute(normal,3));
    geometry.morphTargetsRelative=true;
    const dict={...mesh.morphTargetDictionary},weights=[...(mesh.morphTargetInfluences??[])];
    mesh.geometry=geometry;mesh.updateMorphTargets();
    mesh.morphTargetDictionary={...dict,PupilOval:count};mesh.morphTargetInfluences=[...weights,1];
  });
}
