import * as THREE from 'three';

export function addHullCollars(parent,{pressureSections,forwardSections,material,addMesh}){
  const collars=[];
  const sectionAt=(sections,axial)=>{
    const upper=sections.findIndex((section,index)=>index>0&&section[0]>=axial);
    const index=upper<0?sections.length-1:upper,start=sections[index-1],end=sections[index];
    const amount=THREE.MathUtils.clamp((axial-start[0])/(end[0]-start[0]),0,1);
    return start.slice(1).map((value,component)=>THREE.MathUtils.lerp(value,end[component+1],amount));
  };
  const ringAt=(axial,forward)=>{
    if(forward){
      const [bottom,top,width,cut]=sectionAt(forwardSections,axial);
      return [[bottom,-width+cut],[bottom+cut,-width],[top-cut,-width],[top,-width+cut],
        [top,width-cut],[top-cut,width],[bottom+cut,width],[bottom,width-cut]];
    }
    const [height,width]=sectionAt(pressureSections,axial);
    return Array.from({length:8},(_,index)=>{
      const angle=index*Math.PI/4+Math.PI/8;return [Math.cos(angle)*height,Math.sin(angle)*width];
    });
  };
  const offsetRing=(ring,distance)=>ring.map((point,index)=>{
    const previous=ring[(index+7)%8],next=ring[(index+1)%8];
    const before=new THREE.Vector2(point[1]-previous[1],previous[0]-point[0]).normalize();
    const after=new THREE.Vector2(next[1]-point[1],point[0]-next[0]).normalize();
    const offset=before.clone().add(after).multiplyScalar(distance/(1+before.dot(after)));
    return [point[0]+offset.x,point[1]+offset.y];
  });
  for(const [station,forward]of [[-11.8,false],[-8.8,false],[6.1,false],[8.8,true]]){
    const start=forward?station:station-.12,end=forward?station+.24:station+.12,middle=(start+end)/2;
    const profile=[[start,.005],[start,.045],[start+.035,.085],[middle,.085],
      [end-.035,.085],[end,.045],[end,.005]],positions=[],uvs=[],indices=[];
    for(const [row,[axial,distance]]of profile.entries()){
      const ring=offsetRing(ringAt(axial,forward),distance);
      for(const [index,[height,width]]of ring.entries()){
        positions.push(axial-station,height,width);uvs.push(row/(profile.length-1),index/8);
      }
    }
    for(let row=0;row<profile.length;row++)for(let index=0;index<8;index++){
      const next=(index+1)%8,after=(row+1)%profile.length;
      const current=row*8+index,edge=row*8+next,opposite=after*8+index,diagonal=after*8+next;
      indices.push(current,edge,opposite,opposite,edge,diagonal);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const group=new THREE.Group();group.name='Faceted hull structural collar';group.position.x=station;
    group.userData.hullCollar={station,span:[start,end],corners:8,forward};parent.add(group);collars.push(group);
    addMesh(group,geometry,material,'Hull collar / seated eight-corner beveled band');
  }
  return collars;
}
