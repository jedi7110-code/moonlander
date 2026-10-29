// Follow the imported hand's connected surface, rather than assigning fingers
// by each vertex's X coordinate. A spread index finger crosses that heuristic's
// boundary and gets pulled by two unrelated fingers when the grip closes.
export function repairDigitLabels(geometry){
  const p=geometry.attributes.position,a=geometry.attributes.armRegion;
  const vertices=[],neighbors=new Map(),weld=new Map();
  for(let i=0;i<p.count;i++)if(p.getX(i)<-.14&&p.getY(i)<.89&&a.getX(i)>.95){
    vertices.push(i);neighbors.set(i,new Set());
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e6)).join(',');
    if(!weld.has(key))weld.set(key,[]);weld.get(key).push(i);
  }
  const join=(i,j)=>{if(neighbors.has(i)&&neighbors.has(j)){neighbors.get(i).add(j);neighbors.get(j).add(i);}};
  for(const ids of weld.values())for(let k=1;k<ids.length;k++)join(ids[0],ids[k]);
  const index=geometry.index.array;
  for(let i=0;i<index.length;i+=3){join(index[i],index[i+1]);join(index[i+1],index[i+2]);join(index[i+2],index[i]);}
  const seen=new Set(),groups=[];
  for(const i of vertices){
    if(p.getY(i)>=.810||seen.has(i))continue;
    const group=[],queue=[i];seen.add(i);
    for(let q=0;q<queue.length;q++){
      const id=queue[q];group.push(id);
      for(const next of neighbors.get(id))if(p.getY(next)<.810&&!seen.has(next)){seen.add(next);queue.push(next);}
    }
    if(group.length>8)groups.push(group);
  }
  groups.sort((x,y)=>x.reduce((s,i)=>s+p.getX(i),0)/x.length-y.reduce((s,i)=>s+p.getX(i),0)/y.length);
  if(groups.length!==5)throw new Error('Repair grip requires four connected fingers and a thumb');
  const labels=new Map(),queue=[];
  groups.forEach((group,label)=>group.forEach(i=>{labels.set(i,label);queue.push(i);}));
  for(let q=0;q<queue.length;q++)for(const next of neighbors.get(queue[q]))if(!labels.has(next)){
    labels.set(next,labels.get(queue[q]));queue.push(next);
  }
  return labels;
}
