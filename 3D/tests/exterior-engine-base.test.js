import test from 'node:test';
import assert from 'node:assert/strict';
import {createExteriorMothership} from '../src/obs/exterior-mothership.js';
import {Raycaster,Vector3} from 'three';

function section(ship,materialName,axial){
  const points=new Map();
  for(const mesh of ship.core.children){
    if(!mesh.isMesh||mesh.material.name!==materialName)continue;
    const positions=mesh.geometry.attributes.position;
    for(let index=0;index<positions.count;index++){
      if(Math.abs(positions.getX(index)-axial)>1e-5)continue;
      const point=[positions.getY(index),positions.getZ(index)];
      points.set(point.map(value=>value.toFixed(5)).join('/'),point);
    }
  }
  return [...points.values()];
}
const normalized=points=>{
  const height=Math.max(...points.map(point=>Math.abs(point[0]))),width=Math.max(...points.map(point=>Math.abs(point[1])));
  return points.map(point=>[point[0]/height,point[1]/width].map(value=>value.toFixed(5)).join('/')).sort();
};

test('the black engine bulkhead has eight aligned corners and a small projecting rim without adding draw batches',()=>{
  const ship=createExteriorMothership();
  try{
    const aft=section(ship,'Recessed machinery',-16.7),forward=section(ship,'Recessed machinery',-15.55);
    const hull=section(ship,'Aged Macintosh beige',-15.5);
    assert.equal(aft.length,8);assert.equal(forward.length,8);assert.equal(hull.length,8);
    assert.deepEqual(normalized(aft),normalized(hull));
    assert.deepEqual(normalized(forward),normalized(hull));
    for(const points of [aft,forward])for(const dimension of [0,1]){
      const extent=Math.max(...points.map(point=>Math.abs(point[dimension])));
      const hullExtent=Math.max(...hull.map(point=>Math.abs(point[dimension])));
      assert.ok(Math.abs(extent/hullExtent-1.02)<1e-6,'the rim projects only two percent beyond the hull');
    }
    assert.equal(ship.engines.length,7);
    let meshes=0;ship.root.traverse(mesh=>{if(mesh.isMesh)meshes++;});
    assert.equal(meshes,99,'changing the contour adds no draw batches');
  }finally{ship.dispose();}
});

test('all thrust shoes and perimeter markings fit the octagonal bulkhead at every core scale',()=>{
  const ship=createExteriorMothership();
  try{
    const markings=new Map();
    ship.machinery.traverse(mesh=>{
      if(!mesh.isMesh||mesh.material.name!=='Faded service ochre')return;
      const positions=mesh.geometry.attributes.position;
      for(let index=0;index<positions.count;index++){
        if(positions.getX(index)<-16.78||positions.getX(index)>-16.69)continue;
        const point=[positions.getY(index),positions.getZ(index)];
        markings.set(point.map(value=>value.toFixed(5)).join('/'),point);
      }
    });
    assert.equal(markings.size,32,'eight rectangular markings follow the eight faces');
    for(const scale of [1,1.6,2.6,2.8]){
      ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
      const bulkhead=ship.core.children.filter(mesh=>mesh.isMesh&&mesh.material.name==='Recessed machinery');
      for(const [height,width]of markings.values()){
        const origin=ship.core.localToWorld(new Vector3(-17.7,height,width));
        const direction=new Vector3(1,0,0).transformDirection(ship.core.matrixWorld);
        const hit=new Raycaster(origin,direction).intersectObjects(bulkhead,false)[0];
        assert.ok(hit,'perimeter markings never float beyond the clipped corners');
        assert.ok(Math.abs(ship.core.worldToLocal(hit.point.clone()).x+16.7)<1e-5);
      }
      for(const engine of ship.engines)for(let index=0;index<4;index++){
        const angle=index*Math.PI/2,radius=engine.userData.mountRadius;
        for(const radial of [-.29,.29])for(const tangent of [-.36,.36]){
          const height=engine.position.y+Math.cos(angle)*(radius+radial)-Math.sin(angle)*tangent;
          const width=engine.position.z+Math.sin(angle)*(radius+radial)+Math.cos(angle)*tangent;
          const origin=ship.core.localToWorld(new Vector3(-17.7,height,width));
          const direction=new Vector3(1,0,0).transformDirection(ship.core.matrixWorld);
          const hit=new Raycaster(origin,direction).intersectObjects(bulkhead,false)[0];
          assert.ok(hit,'the entire thrust-shoe footprint bears on the bulkhead');
          const local=ship.core.worldToLocal(hit.point.clone());
          assert.ok(Math.abs(local.x+16.7)<1e-5,'the contact face stays on the existing mounting plane');
        }
      }
    }
  }finally{ship.dispose();}
});

test('four heat exchangers and their fins on each side sit aft of the side-panel edge',()=>{
  const ship=createExteriorMothership();
  try{
    const centers=[-14.75,-14,-13.25,-12.5];
    for(const side of [-1,1])for(const [material,depth,halfWidth]of [
      ['Recessed machinery',7.9,.26],['Warm service metal',8.05,.21]
    ]){
      const axialCorners=new Set();
      ship.machinery.traverse(mesh=>{
        if(!mesh.isMesh||mesh.material.name!==material)return;
        const positions=mesh.geometry.attributes.position;
        for(let index=0;index<positions.count;index++){
          const axial=positions.getX(index),height=positions.getY(index);
          if(Math.abs(positions.getZ(index)-side*depth)>1e-5||height<.19||height>2.81)continue;
          axialCorners.add(Number(axial.toFixed(5)));
        }
      });
      const expected=centers.flatMap(center=>[center-halfWidth,center+halfWidth]).map(value=>Number(value.toFixed(5)));
      assert.deepEqual([...axialCorners].sort((left,right)=>left-right),expected);
    }
    assert.ok(centers[0]-.26>-15.5+.4,'the rear unit clears the engine bulkhead');
    assert.ok(centers.at(-1)+.26<-11.8-.4,'the forward unit clears the tapered side-panel transition');
  }finally{ship.dispose();}
});
