import {Box3,BufferAttribute,BufferGeometry,Frustum,Matrix4,Plane,Vector3} from 'three';

// Retain the bounds/index ranges of the original fixtures before batching.
// This is CPU metadata only; it never duplicates vertices or textures.
const sectionsByGeometry=new WeakMap();
export function registerMirrorSections(geometry,parts){
  let start=0;
  const sections=parts.map(part=>{
    if(!part.boundingBox)part.computeBoundingBox();
    const section={start,count:part.index.count,box:part.boundingBox.clone().expandByScalar(.025)};
    start+=section.count;return section;
  });
  sectionsByGeometry.set(geometry,sections);
}

function releaseFiltered(state){
  if(!state.filtered)return;
  // Geometry.dispose deletes its GPU attributes. Those belong to the real
  // cabin, so detach them first and release ONLY the mirror's index buffer.
  for(const name of Object.keys(state.filtered.attributes))state.filtered.deleteAttribute(name);
  state.filtered.dispose();state.filtered=null;
}

// Solid laundry walls occlude other rooms even when they fall in the camera
// frustum. Keep its interior OR the cone through the open doorway. This is
// conservative: the octagonal doorway is enclosed by a slightly larger rectangle.
export function createMirrorRoomVisibility(room){
  if(!room)return null;
  const {portal:p,bounds}=room,eye=new Vector3(),worldBox=new Box3(),support=new Vector3();
  const corners=[[p.left,p.bottom],[p.right,p.bottom],[p.right,p.top],[p.left,p.top]].map(([x,y])=>new Vector3(x,y,p.z));
  const center=new Vector3((p.left+p.right)/2,(p.bottom+p.top)/2,p.z);
  const planes=Array.from({length:4},()=>new Plane());let portalAhead=false;
  return {
    update(camera){
      eye.setFromMatrixPosition(camera.matrixWorld);portalAhead=eye.z<p.z;
      if(portalAhead)for(let i=0;i<4;i++){
        const plane=planes[i].setFromCoplanarPoints(eye,corners[i],corners[(i+1)%4]);
        if(plane.distanceToPoint(center)<0)plane.negate();
      }
    },
    intersects(box,matrix){
      worldBox.copy(box).applyMatrix4(matrix);
      if(worldBox.intersectsBox(bounds))return true;
      if(!portalAhead||worldBox.max.z<p.z-.025)return false;
      for(const {normal:n,constant} of planes){
        support.set(n.x>=0?worldBox.max.x:worldBox.min.x,n.y>=0?worldBox.max.y:worldBox.min.y,n.z>=0?worldBox.max.z:worldBox.min.z);
        if(n.dot(support)+constant<-.025)return false;
      }
      return true;
    },
  };
}

export function createMirrorBatchFilter({room=null}={}){
  const states=new Map(),restore=[],projection=new Matrix4(),matrix=new Matrix4(),frustum=new Frustum();
  const roomVisibility=createMirrorRoomVisibility(room);
  const stats={sourceTriangles:0,selectedTriangles:0,indexUploads:0,indexBytes:0};
  function select(source,sections,worldMatrix){
    let state=states.get(source);
    if(!state){
      state={matrix:new Matrix4(),worldMatrix:new Matrix4(),valid:false,mask:new Uint8Array(sections.length),count:0,filtered:null};
      states.set(source,state);
    }
    if(state.valid&&state.matrix.equals(matrix)&&state.worldMatrix.equals(worldMatrix))return state.count===source.index.count?source:state.count?state.filtered:null;
    frustum.setFromProjectionMatrix(matrix);
    let count=0,changed=!state.valid;
    for(let i=0;i<sections.length;i++){
      const visible=Number(frustum.intersectsBox(sections[i].box)&&(!roomVisibility||roomVisibility.intersects(sections[i].box,worldMatrix)));
      if(visible)count+=sections[i].count;
      if(state.mask[i]!==visible)changed=true;
      state.mask[i]=visible;
    }
    state.matrix.copy(matrix);state.worldMatrix.copy(worldMatrix);state.valid=true;state.count=count;
    if(!count)return null;
    if(count===source.index.count)return source;
    if(changed){
      if(!state.filtered||state.filtered.index.count<count){
        if(state.filtered)stats.indexBytes-=state.filtered.index.array.byteLength;
        releaseFiltered(state);
        const geometry=state.filtered=new BufferGeometry();
        for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
        // Headroom avoids reallocations during small head turns, without a
        // second full-cabin buffer. The index ordering stays exactly original.
        const capacity=Math.min(source.index.count,Math.ceil(count*1.25/1024)*1024);
        geometry.setIndex(new BufferAttribute(new source.index.array.constructor(capacity),1));
        if(!source.boundingSphere)source.computeBoundingSphere();
        geometry.boundingSphere=source.boundingSphere;geometry.boundingBox=source.boundingBox;
        stats.indexBytes+=geometry.index.array.byteLength;
      }
      const index=state.filtered.index;let offset=0;
      for(let i=0;i<sections.length;i++)if(state.mask[i]){
        const {start,count:length}=sections[i];
        index.array.set(source.index.array.subarray(start,start+length),offset);offset+=length;
      }
      index.updateRange.offset=0;index.updateRange.count=count;index.needsUpdate=true;
      state.filtered.setDrawRange(0,count);stats.indexUploads++;
    }
    return state.filtered;
  }
  return {
    stats,
    begin(scene,camera){
      stats.sourceTriangles=stats.selectedTriangles=0;
      projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      roomVisibility?.update(camera);
      scene.traverseVisible(mesh=>{
        const source=mesh.geometry,sections=source&&sectionsByGeometry.get(source);
        if(!mesh.isMesh||!sections)return;
        matrix.multiplyMatrices(projection,mesh.matrixWorld);
        const filtered=select(source,sections,mesh.matrixWorld);
        stats.sourceTriangles+=source.index.count/3;
        stats.selectedTriangles+=filtered?(filtered===source?source.index.count:filtered.drawRange.count)/3:0;
        restore.push({mesh,source,visible:mesh.visible});
        if(filtered)mesh.geometry=filtered;else mesh.visible=false;
      });
    },
    end(){
      for(const {mesh,source,visible} of restore){mesh.geometry=source;mesh.visible=visible;}
      restore.length=0;
    },
    dispose(){this.end();for(const state of states.values())releaseFiltered(state);states.clear();stats.indexBytes=0;},
  };
}
