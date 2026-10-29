import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,CylinderGeometry,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {addConformalServiceFairings} from '../src/obs/exterior-service-fairing.js';

test('utility covers seat against tapered octagonal skin with embedded rims',()=>{
  const parent=new Group(),paint=new MeshStandardMaterial(),metal=new MeshStandardMaterial();
  const skin=new Mesh(new CylinderGeometry(3,3.3,4,8,1,true),paint);skin.rotation.z=-Math.PI/2;skin.position.x=7.3;parent.add(skin);
  const addMesh=(parent,geometry,material,name,position=[0,0,0])=>{const mesh=new Mesh(geometry,material);mesh.name=name;mesh.position.fromArray(position);parent.add(mesh);return mesh;};
  try{
    const covers=addConformalServiceFairings(parent,{surfaces:[skin],paint,metal,addMesh});
    assert.equal(covers.length,4);parent.updateMatrixWorld(true);
    for(const cover of covers){
      const p=cover.geometry.attributes.position;
      cover.geometry.computeBoundingBox();
      const size=cover.geometry.boundingBox.getSize(new Vector3());
      assert.ok(size.x<1.1,'inspection lid must remain a short cover, not a longitudinal rail');
      assert.ok(Math.hypot(size.y,size.z)>.85,'compact lid must retain a broad footprint');
      assert.ok(cover.geometry.boundingBox.min.x>7&&cover.geometry.boundingBox.max.x>8,
        'lid must cover the mid-bay seam break, clear of the aft collar');
      // Boundary vertices belong to an edge used by only one triangle.
      const index=cover.geometry.index,edges=new Map();
      for(let t=0;t<index.count;t+=3)for(let j=0;j<3;j++){
        const a=index.getX(t+j),b=index.getX(t+(j+1)%3),key=[a,b].sort((a,b)=>a-b).join('/');
        edges.set(key,(edges.get(key)||0)+1);
      }
      const rimVertices=new Set([...edges].filter(([,count])=>count===1).flatMap(([key])=>key.split('/').map(Number)));
      for(let i=0;i<p.count;i++){
        const point=new Vector3().fromBufferAttribute(p,i),radial=new Vector3(0,point.y,point.z).normalize();
        const origin=new Vector3(point.x,radial.y*12,radial.z*12),hit=new Raycaster(origin,radial.clone().negate()).intersectObject(skin)[0];
        const clearance=point.clone().sub(hit.point).dot(radial);
        assert.ok(clearance>=-.00201&&clearance<=.10501,'lid thickness must follow the sloping skin');
        if(rimVertices.has(i))assert.ok(clearance<0,'outer rims and ends must embed instead of floating');
      }
      assert.ok([...edges.values()].every(count=>count===2),'thick cover must have closed sidewalls and a back');
      assert.ok(cover.userData.warning,'each lid provides a surface for its red warning stencil');
    }
  }finally{parent.traverse(o=>o.geometry?.dispose());paint.dispose();metal.dispose();}
});
