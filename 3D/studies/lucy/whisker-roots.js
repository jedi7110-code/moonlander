import {Ray,Vector3} from 'three';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

// Sample the actual narrowed, inflated muzzle, not an assumed sphere. Root
// centers sit just under its surface; the thin tube emerges without a gap.
export function createWhiskerRootOffsets(coat,whiskers,padOffset){
  function refined(mesh,i,inflate=false){
    const a=mesh.geometry.attributes.position,p=new Vector3().fromBufferAttribute(a,i);
    const face=mesh.morphTargetDictionary?.FaceRefine;
    if(face!==undefined)p.add(new Vector3().fromBufferAttribute(mesh.geometry.morphAttributes.position[face],i));
    if(inflate)p.add(new Vector3(...padOffset(a.getX(i),a.getY(i),a.getZ(i))));
    return p;
  }
  const a=whiskers.geometry.attributes.position,index=whiskers.geometry.index;
  const parent=Array.from({length:a.count},(_,i)=>i);
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const join=(i,j)=>{parent[find(i)]=find(j);};
  const welded=new Map();
  for(let i=0;i<a.count;i++){
    const key=[a.getX(i),a.getY(i),a.getZ(i)].map(v=>v.toFixed(7)).join(',');
    if(welded.has(key))join(i,welded.get(key));else welded.set(key,i);
  }
  for(let i=0;i<index.count;i+=3){join(index.getX(i),index.getX(i+1));join(index.getX(i),index.getX(i+2));}
  const groups=new Map();
  for(let i=0;i<a.count;i++){const id=find(i);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(i);}
  const strands=[...groups.values()].map(ids=>{
    const min=Math.min(...ids.map(i=>Math.abs(a.getX(i))));
    const roots=ids.filter(i=>Math.abs(a.getX(i))<min+.0002);
    const unique=[...new Map(roots.map(i=>[[a.getX(i),a.getY(i),a.getZ(i)].join(','),i])).values()];
    const center=unique.reduce((sum,i)=>sum.add(refined(whiskers,i)),new Vector3()).divideScalar(unique.length);
    return {ids,roots,center,side:Math.sign(center.x),min};
  });
  const positions=Array.from({length:coat.geometry.attributes.position.count},(_,i)=>refined(coat,i,true));
  const coatIndex=coat.geometry.index,ray=new Ray(),hit=new Vector3(),offsetsByVertex=[],anchors=[];
  for(const side of [-1,1]){
    const ordered=strands.filter(s=>s.side===side).sort((a,b)=>a.center.y-b.center.y);
    ordered.forEach((strand,row)=>{
      const x=side*(.0128+[0,.0007,.0002,-.0006][row%4]),y=.164+row*.002;
      ray.set(new Vector3(x,y,.32),new Vector3(0,0,-1));
      let z=-Infinity;
      for(let i=0;i<coatIndex.count;i+=3){
        if(ray.intersectTriangle(positions[coatIndex.getX(i)],positions[coatIndex.getX(i+1)],positions[coatIndex.getX(i+2)],false,hit))z=Math.max(z,hit.z);
      }
      if(!Number.isFinite(z))throw new Error('Whisker root missed the muzzle surface');
      const target=new Vector3(x,y,z-.00012),delta=target.clone().sub(strand.center);
      for(const i of strand.ids)offsetsByVertex[i]={delta,min:strand.min};
      anchors.push({indices:strand.roots,target:target.toArray(),surfaceZ:z});
    });
  }
  return {
    anchors,
    offset(x,y,z,i){
      const strand=offsetsByVertex[i],weight=1-smooth(strand.min+.003,.056,Math.abs(x));
      return strand.delta.toArray().map(v=>v*weight);
    },
  };
}
