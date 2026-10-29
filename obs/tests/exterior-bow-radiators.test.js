import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3} from 'three';
import {createExteriorMothership} from '../src/obs/exterior-mothership.js';
import {createExteriorPanelStudy} from '../src/obs/exterior-panel-study.js';

test('four-row thermal cassettes replace the bow cheek windows on both sides without extra draw batches',()=>{
  const ship=createExteriorMothership();
  try{
    assert.equal(ship.bowRadiators.length,2);
    assert.deepEqual(ship.bowRadiators.map(unit=>unit.userData.radiator.side),[-1,1]);
    for(const unit of ship.bowRadiators){
      assert.equal(unit.parent,ship.machinery);assert.equal(unit.userData.radiator.rows.length,4);
      assert.equal(unit.userData.radiator.finCenters.length,6);assert.deepEqual(unit.scale.toArray(),[1,1,1]);
    }
    assert.equal(ship.commandSideWindows.length,4,'the newly added command windows remain in place');
    let meshes=0,triangles=0;ship.root.traverse(mesh=>{if(mesh.isMesh){meshes++;triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;}});
    assert.equal(meshes,99);assert.ok(triangles<57000,'folded fins retain the existing geometry budget');
  }finally{ship.dispose();}
});

test('radiator fins, dark spreaders and coolant headers remain exposed and seated instead of reading as glass',()=>{
  for(const replaceSkin of [false,true]){
    const ship=createExteriorMothership(),panels=createExteriorPanelStudy(ship,{replaceSkin});
    try{
      panels.setEnabled(true);
      for(const scale of [1,1.6,2.6,2.8]){
        ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
        const surfaces=[];ship.core.traverseVisible(mesh=>{if(mesh.isMesh&&!mesh.material.transparent)surfaces.push(mesh);});
        for(const unit of ship.bowRadiators){
          const {rows,finCenters}=unit.userData.radiator,outward=new Vector3(0,0,1).transformDirection(unit.matrixWorld);
          const cast=(horizontal,vertical)=>{
            const point=unit.localToWorld(new Vector3(horizontal,vertical,.30));
            return new Raycaster(point,outward.clone().negate(),0,.6*scale).intersectObjects(surfaces,false)[0];
          };
          for(const height of rows){
            const spreader=cast(0,height);
            assert.equal(spreader?.object.material.name,'Recessed machinery','the old blue glass is replaced by a dark heat-spreader face');
            assert.ok(Math.abs(unit.worldToLocal(spreader.point.clone()).z-.085)<1e-5);
            for(const center of finCenters){
              const fin=cast(center,height);
              assert.equal(fin?.object.material.name,'Warm service metal','every row has visible, folded metal fins');
              assert.ok(Math.abs(unit.worldToLocal(fin.point.clone()).z-.160)<1e-5);
            }
            const plate=cast(.88,height);
            assert.equal(plate?.object.material.name,'Unpainted structure');
            assert.ok(Math.abs(unit.worldToLocal(plate.point.clone()).z-.08)<1e-5);
          }
          for(const horizontal of [-.97,.97]){
            const header=cast(horizontal,.58);
            assert.equal(header?.object.material.name,'Warm service metal','the four rows share sealed supply and return headers');
            assert.ok(Math.abs(unit.worldToLocal(header.point.clone()).z-.15)<1e-5);
            for(const vertical of [-1.19,1.13])assert.equal(cast(horizontal,vertical)?.object.material.name,'Recessed machinery','both ends terminate in bulkhead couplings');
          }
          const backing=surfaces.filter(mesh=>['Replacement panel','Study / segmented exterior plates'].includes(mesh.material.name));
          const point=unit.localToWorld(new Vector3(.88,rows[1],.3));
          const skin=new Raycaster(point,outward.clone().negate(),0,.6*scale).intersectObjects(backing,false)[0];
          assert.ok(skin,'the mounting plate has a solid armour cheek behind it');
          const skinDepth=unit.worldToLocal(skin.point.clone()).z;
          assert.ok(skinDepth>=-1e-5&&skinDepth<=.01001,'the unit bears on the original cheek or its raised panel finish');
          const steel=surfaces.filter(mesh=>mesh.material.name==='Unpainted structure');
          const rear=unit.localToWorld(new Vector3(.88,rows[1],-.10));
          const plateBack=new Raycaster(rear,outward,0,.12*scale).intersectObjects(steel,false)[0];
          assert.ok(plateBack&&Math.abs(unit.worldToLocal(plateBack.point.clone()).z+.02)<1e-5,'mounting plate backs embed into their backing instead of floating');
        }
      }
    }finally{panels.dispose();ship.dispose();}
  }
});
