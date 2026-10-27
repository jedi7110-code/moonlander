// Match computeVertexNormals around a set of moving vertices. Include every
// incident face of their neighbours, so shared-edge normals remain identical
// to a full mesh update without scanning the unaffected torso and legs.
export function createLocalNormalUpdater(geometry,moving){
  const index=geometry.index.array,normal=geometry.attributes.normal,vertices=new Set(moving),affected=new Set();
  for(let i=0;i<index.length;i+=3){
    if(vertices.has(index[i])||vertices.has(index[i+1])||vertices.has(index[i+2])){
      affected.add(index[i]);affected.add(index[i+1]);affected.add(index[i+2]);
    }
  }
  const faces=[];
  for(let i=0;i<index.length;i+=3){
    if(affected.has(index[i])||affected.has(index[i+1])||affected.has(index[i+2]))faces.push(index[i],index[i+1],index[i+2]);
  }
  const sums=new Float32Array(normal.array.length);
  return()=>{
    const p=geometry.attributes.position;
    for(const i of affected){const k=i*3;sums[k]=sums[k+1]=sums[k+2]=0;}
    for(let i=0;i<faces.length;i+=3){
      const a=faces[i],b=faces[i+1],c=faces[i+2];
      const x=p.getX(c)-p.getX(b),y=p.getY(c)-p.getY(b),z=p.getZ(c)-p.getZ(b);
      const u=p.getX(a)-p.getX(b),v=p.getY(a)-p.getY(b),w=p.getZ(a)-p.getZ(b);
      const nx=y*w-z*v,ny=z*u-x*w,nz=x*v-y*u;
      for(let offset=0;offset<3;offset++){
        const j=faces[i+offset];if(!affected.has(j))continue;
        const k=j*3;sums[k]+=nx;sums[k+1]+=ny;sums[k+2]+=nz;
      }
    }
    for(const i of affected){const k=i*3,length=Math.hypot(sums[k],sums[k+1],sums[k+2])||1;normal.setXYZ(i,sums[k]/length,sums[k+1]/length,sums[k+2]/length);}
    normal.needsUpdate=true;
  };
}
