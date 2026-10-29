import * as THREE from 'three';

export function addBowRadiators(parent,{materials,addMesh,box}){
  const units=[],rows=Array.from({length:4},(_,index)=>.90-index*.62);
  const finCenters=Array.from({length:6},(_,index)=>(index-2.5)*.27);
  for(const side of [-1,1]){
    const unit=new THREE.Group();unit.name=`Bow thermal radiator / ${side>0?'starboard':'port'}`;
    unit.position.set(11.9,0,side*3.14);if(side<0)unit.rotation.y=Math.PI;
    unit.userData.panelDetailExclude=true;unit.userData.radiator={side,rows:[...rows],finCenters:[...finCenters]};
    parent.add(unit);units.push(unit);
    for(const height of rows){
      box(unit,materials.steel,[0,height,.03],[2.10,.40,.10],'Radiator cassette mounting plate');
      addMesh(unit,new THREE.PlaneGeometry(1.66,.24),materials.dark,'Radiator dark heat-spreader face',[0,height,.085]);
    }
    const positions=[],uvs=[];
    for(const height of rows)for(const center of finCenters){
      const vertices=[[-.045,-.10,.078],[0,-.10,.160],[.045,-.10,.078],
        [-.045,.10,.078],[0,.10,.160],[.045,.10,.078]];
      for(const indices of [[0,1,3],[3,1,4],[1,2,4],[4,2,5],[0,2,1],[3,4,5]])for(const index of indices){
        const [horizontal,vertical,depth]=vertices[index];
        positions.push(center+horizontal,height+vertical,depth);uvs.push(horizontal/.09+.5,vertical/.20+.5);
      }
    }
    const fins=new THREE.BufferGeometry();fins.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    fins.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));fins.computeVertexNormals();
    addMesh(unit,fins,materials.pipe,'Radiator folded metal fins');
    for(const horizontal of [-.97,.97]){
      box(unit,materials.pipe,[horizontal,-.03,.08],[.12,2.32,.14],'Radiator sealed coolant header');
      for(const vertical of [-1.19,1.13])box(unit,materials.dark,[horizontal,vertical,.08],[.18,.13,.18],'Radiator header bulkhead coupling');
    }
  }
  return units;
}
