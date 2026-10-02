import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {createEVAHatch,createEVAPartitions,EVA_BAY,EVA_HATCH_FIT} from '../src/obs/eva.js';
import {createPressureHatch,PRESSURE_HATCH,REFERENCE_HATCH_CASSETTE,animatePressureHatch} from '../src/obs/pressure-hatch.js';
import {CABIN_AISLE} from '../src/obs/layout.js';
import {coplanarSurfaces} from './helpers/coplanar-surfaces.js';

test('the complete reference is enlarged uniformly, including leaves, window, locks and upper panel',()=>{
  for(const inner of [true,false]){
    const reference=createPressureHatch({inner,cassette:REFERENCE_HATCH_CASSETTE,mountingSeal:true});
    const hatch=createEVAHatch(null,0,inner);hatch.position.set(0,0,0);hatch.rotation.y=0;
    reference.updateMatrixWorld(true);hatch.updateMatrixWorld(true);
    const a=[],b=[];reference.traverse(o=>{if(o.isMesh)a.push(o);});hatch.traverse(o=>{if(o.isMesh)b.push(o);});
    assert.equal(a.length,b.length,'no extra covers, wiring or decorations');
    for(let i=0;i<a.length;i++){
      assert.equal(a[i].name,b[i].name);
      assert.equal(a[i].geometry.attributes.position.count,b[i].geometry.attributes.position.count,'no added polygons from enlargement');
      const oldBounds=new Box3().setFromObject(a[i]),newBounds=new Box3().setFromObject(b[i]);
      assert.ok(oldBounds.min.multiplyScalar(EVA_HATCH_FIT.scale).distanceTo(newBounds.min)<1e-6);
      assert.ok(oldBounds.max.multiplyScalar(EVA_HATCH_FIT.scale).distanceTo(newBounds.max)<1e-6,`${b[i].name} retains its proportions`);
    }
    assert.ok(hatch.getObjectByName('Upper housing end cap'),'retain the top panel in the supplied reference');
    assert.equal(hatch.getObjectByName('Outer hatch / covered service surround'),undefined);
  }
});

test('enlarged units remain above the floor and inside both walls and ceilings',()=>{
  for(const inner of [true,false]){
    const hatch=createEVAHatch(null,0,inner);hatch.updateMatrixWorld(true);
    const housing=new Box3().setFromObject(hatch.getObjectByName('Pocket cassette cover / front'));
    assert.ok(Math.abs(housing.getSize(new Vector3()).z-EVA_HATCH_FIT.width)<1e-6);
    assert.ok(Math.abs(housing.getSize(new Vector3()).y-EVA_HATCH_FIT.height)<1e-6);
    assert.ok(Math.abs(housing.min.y-.01)<1e-6,'same sill height; the assembly grows upwards');
    const envelope=new Box3().setFromObject(hatch);
    assert.ok(envelope.min.z>-1.87&&envelope.max.z<CABIN_AISLE.deckFront,'no protrusion outside the ship');
    assert.ok(envelope.min.y>0&&envelope.max.y<3.242);
    assert.ok(Math.abs(hatch.position.z-CABIN_AISLE.crewZ)<.1,'the walking lane still passes near the center');
  }
});

test('both bulkhead openings follow the enlarged reference and keep the wall above sealed',()=>{
  const material=new MeshStandardMaterial(),walls=createEVAPartitions({enamel:material},0);walls.updateMatrixWorld(true);
  const probe=(x,y,z)=>new Raycaster(new Vector3(x-.5,y,z),new Vector3(1,0,0),0,1).intersectObject(walls,true);
  for(const x of [EVA_BAY.innerX,EVA_BAY.hatchX]){
    for(const z of [EVA_BAY.depth-1.6,EVA_BAY.depth+1.6])assert.equal(probe(x,1.4,z).length,0);
    assert.equal(probe(x,2.9,EVA_BAY.depth).length,0);
    assert.ok(probe(x,3.15,EVA_BAY.depth).length>0);
  }
});

test('mounting gaskets seal the resized installation clearance on both faces',()=>{
  const hatch=createEVAHatch(null,0,false);hatch.position.set(0,0,0);hatch.rotation.y=0;hatch.updateMatrixWorld(true);
  const {width,height,offsetY}=REFERENCE_HATCH_CASSETTE,s=EVA_HATCH_FIT.scale;
  for(const face of [-1,1])for(const edge of [-1,1]){
    for(const [x,y]of [[edge*(width/2+.001),offsetY],[0,offsetY+edge*(height/2+.001)]]){
      const hits=new Raycaster(new Vector3(x*s,y*s,face),new Vector3(0,0,-face)).intersectObject(hatch,true);
      assert.ok(hits.some(hit=>hit.object.name==='Cassette mounting gasket'));
    }
  }
});

test('resized doors stay free of flickering surfaces, open fully, and contain the sliding leaves',()=>{
  for(const inner of [true,false]){
    const hatch=createEVAHatch(null,0,inner);hatch.position.set(0,EVA_HATCH_FIT.centerY,0);hatch.rotation.y=0;
    for(const opening of [0,.25,.5,.75,1]){
      animatePressureHatch(hatch.userData.door,opening);
      assert.deepEqual(coplanarSurfaces([hatch]),[],`no coplanar surfaces at ${opening}`);
      hatch.updateMatrixWorld(true);
      for(const leaf of hatch.userData.door.userData.leaves){
        const bounds=new Box3().setFromObject(leaf);
        assert.ok(bounds.min.x>-EVA_HATCH_FIT.width/2&&bounds.max.x<EVA_HATCH_FIT.width/2,'no leaf escapes its pocket');
      }
    }
    for(const side of [-1,1])for(const x of [-.43,0,.43])for(const y of [.3,1.1,2.15]){
      const hits=new Raycaster(new Vector3(x,y,side),new Vector3(0,0,-side)).intersectObject(hatch,true);
      assert.equal(hits.length,0,'passage opens fully');
    }
    const openingWidth=PRESSURE_HATCH.width*EVA_HATCH_FIT.scale;
    assert.ok(openingWidth>1.08&&openingWidth<1.3,'central leaves enlarge with the rest of the unit');
  }
});
