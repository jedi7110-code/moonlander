import * as THREE from 'three';

// Solid removable lids have seated bases, visible sidewalls and machined
// bevels. Every layer follows the actual tapered skin beneath it.
export function addConformalServiceFairings(parent,{surfaces,paint,metal,addMesh}){
  parent.updateWorldMatrix(true,true);
  const inverse=parent.matrixWorld.clone().invert(),normalMatrix=new THREE.Matrix3().getNormalMatrix(parent.matrixWorld);
  // The visible seam jumps at the diagonal through the tapered bay, halfway
  // between x=6.1 and x=9, not at the structural collar at its aft end.
  const outline=[[7.05,-.12],[7.05,.12],[7.17,.165],[7.93,.165],
    [8.05,.12],[8.05,-.12],[7.93,-.165],[7.17,-.165]];
  function surfaceAt(x,angle){
    const radial=new THREE.Vector3(0,Math.cos(angle),Math.sin(angle));
    const origin=new THREE.Vector3(x,radial.y*12,radial.z*12).applyMatrix4(parent.matrixWorld);
    const outward=radial.clone().applyMatrix3(normalMatrix).normalize();
    const hit=new THREE.Raycaster(origin,outward.clone().negate(),0,30).intersectObjects(surfaces,false)[0];
    if(!hit)throw new Error('Utility cover has no supporting pressure skin');
    return{point:hit.point.clone().applyMatrix4(inverse),radial};
  }
  const covers=[];
  // Cover the seams through the upper/lower sloping side facets. These lie
  // midway between the octagonal corners, clear of the dorsal antennas.
  for(const center of [1,3,5,7].map(step=>step*Math.PI/4)){
    const positions=[],uvs=[],indices=[];
    // Turn the entire left-side assembly in its mounting plane, including
    // paint UVs, retainers and the warning's position and reading direction.
    const turn=Math.sin(center)<0?-1:1;
    const panelSurfaceAt=(x,offset)=>surfaceAt(7.55+(x-7.55)*turn,center+offset*turn);
    function vertex(x,offset,height){
      const {point,radial}=panelSurfaceAt(x,offset);
      point.addScaledVector(radial,height);positions.push(...point.toArray());
      // Dedicated atlas tile shares the hull paint and fine abrasion without
      // enlarging its stains or painting seams across the removable lid.
      uvs.push(.015+.47*(x-7.05),1.02+.96*(offset+.165)/.33);
      return positions.length/3-1;
    }
    const rings=[];
    for(const [inset,height]of [[0,-.002],[0,.075],[.065,.105]]){
      rings.push(outline.map(([x,offset])=>vertex(7.55+(x-7.55)*(1-inset),offset*(1-inset),height)));
    }
    for(let layer=0;layer<rings.length-1;layer++)for(let j=0;j<8;j++){
      const k=(j+1)%8,a=rings[layer][j],b=rings[layer][k],c=rings[layer+1][j],d=rings[layer+1][k];
      indices.push(a,b,c,b,d,c);
    }
    const top=vertex(7.55,0,.105),base=vertex(7.55,0,-.002);
    for(let j=0;j<8;j++){const k=(j+1)%8;indices.push(top,rings[2][j],rings[2][k],base,rings[0][k],rings[0][j]);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const cover=addMesh(parent,geometry,paint,'Conformal utility inspection fairing');covers.push(cover);
    geometry.computeBoundingBox();
    const bounds=geometry.boundingBox.clone().expandByScalar(.001);
    (parent.userData.panelKeepouts??=[]).push({min:bounds.min.toArray(),max:bounds.max.toArray()});
    const label=panelSurfaceAt(7.55,.065);label.point.addScaledVector(label.radial,.105);
    cover.userData.warning={point:label.point.toArray(),normal:label.radial.toArray(),up:[0,Math.sin(center)*turn,-Math.cos(center)*turn]};
    const sealPositions=[],sealIndices=[];
    for(const scale of [1.016,1])for(const [x,offset]of outline){
      const {point,radial}=panelSurfaceAt(7.55+(x-7.55)*scale,offset*scale);
      sealPositions.push(...point.addScaledVector(radial,.014).toArray());
    }
    for(let j=0;j<8;j++){const k=(j+1)%8;sealIndices.push(j,k,j+8,k,k+8,j+8);}
    const seal=new THREE.BufferGeometry();seal.setAttribute('position',new THREE.Float32BufferAttribute(sealPositions,3));
    seal.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(32),2));seal.setIndex(sealIndices);seal.computeVertexNormals();
    addMesh(parent,seal,metal,'Inspection lid perimeter seal');
    // Opposing flush quarter-turn retainers, like the existing service covers.
    for(const [x,offset]of [[7.22,-.105],[7.88,.105]]){
      const {point,radial}=panelSurfaceAt(x,offset);point.addScaledVector(radial,.108);
      const latch=addMesh(parent,new THREE.BoxGeometry(.028,.006,.10),metal,'Inspection lid flush retainer',point.toArray());
      latch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),radial);
    }
  }
  return covers;
}
