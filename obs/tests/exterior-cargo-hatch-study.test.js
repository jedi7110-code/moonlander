import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Raycaster,Vector3} from 'three';
import {readFile} from 'node:fs/promises';
import {createExteriorMothership} from '../src/obs/exterior-mothership.js';
import {createCargoHatchStudy} from '../src/obs/exterior-cargo-hatch-study.js';
import {createExteriorPanelStudy} from '../src/obs/exterior-panel-study.js';

test('the optional cargo sample preserves the large door and gives both sides a metre-sized wicket and 1.85m reference',()=>{
  const ship=createExteriorMothership();ship.setCoreScale(2.6);
  const sample=createCargoHatchStudy(ship);
  try{
    assert.equal(sample.roots.length,2);sample.setEnabled(true);ship.root.updateMatrixWorld(true);
    for(const root of sample.roots){
      assert.ok(root.visible);assert.equal(root.userData.panelDetailExclude,true);
      assert.ok(root.getWorldScale(new Vector3()).distanceTo(new Vector3(1,1,1))<1e-10);
      const paint=root.children.find(mesh=>mesh.material?.name==='Replacement panel');
      const size=new Box3().setFromObject(paint).getSize(new Vector3());
      assert.ok(Math.abs(size.x-3.38)<1e-5);assert.ok(Math.abs(size.y-5.044)<1e-5);
      const access=root.getObjectByName('Personnel access hatch');
      assert.deepEqual(access.userData.dimensions.leaf,[1.30,1.94]);
      assert.deepEqual(access.userData.dimensions.frame,[1.50,2.18]);
      const meshes=root.children.filter(mesh=>mesh.isMesh);
      const cast=(point)=>{
        const normal=new Vector3(0,0,1).transformDirection(root.matrixWorld);
        const origin=root.localToWorld(new Vector3(...point));
        return new Raycaster(origin,normal.negate(),0,2).intersectObjects(meshes,false)[0];
      };
      for(const horizontal of [-.59,.59])for(const vertical of [-.80,.80]){
        const hit=cast([access.position.x+horizontal,access.position.y+vertical,access.position.z+1]);
        assert.equal(hit?.object.material.name,'Replacement panel','the human door has a real visible leaf, not only a dimension marker');
      }
      const frame=cast([access.position.x+.71,access.position.y,access.position.z+1]);
      assert.equal(frame?.object.material.name,'Unpainted structure');
      const human=root.getObjectByName('Study / 1.85m suited scale reference');
      assert.ok(human.position.x< -2.61,'the reference person stands outside the cargo frame and does not obscure the caution label');
      const suit=root.children.find(mesh=>mesh.material?.name==='Worn insulation');
      const humanSize=new Box3().setFromObject(suit).getSize(new Vector3());
      assert.ok(Math.abs(humanSize.y-1.85)<1e-5);assert.equal(human.userData.height,1.85);
      assert.ok(Math.abs(human.position.y-(access.position.y-1.09))<1e-10,'the person and the access sill share one height datum');
      const warning=cast([0,.15*2.6,.28*2.6+.5]);
      assert.equal(warning?.object.material.name,'Replacement panel','reinforcing ribs leave the existing pressure warning unobstructed');
      assert.ok(meshes.length<=6,'all static details and the reference share six existing material batches');
    }
  }finally{sample.dispose();ship.dispose();}
});

test('cargo caution ink moves to the lower-left panel in both original and raised-panel copies and restores on comparison',()=>{
  const ship=createExteriorMothership();ship.setCoreScale(2.6);
  const panels=createExteriorPanelStudy(ship);panels.setEnabled(true);
  const ink=[],original=[];ship.core.traverse(mesh=>{
    if(mesh.userData.exteriorDecal)original.push(mesh);
    if(mesh.userData.exteriorDecal||mesh.name==='Study B / preserved warning ink')ink.push({mesh,geometry:mesh.geometry});
  });
  const entries=original.flatMap(mesh=>mesh.userData.markings.filter(entry=>entry.key==='pressure'&&Math.abs(entry.point[0]-4)<.01));
  const sample=createCargoHatchStudy(ship);
  try{
    assert.equal(entries.length,2);assert.equal(ink.length,2);sample.setEnabled(true);ship.root.updateMatrixWorld(true);
    for(const {mesh,geometry}of ink){
      assert.ok(mesh.geometry!==geometry);
      const positions=mesh.geometry.attributes.position,previous=geometry.attributes.position;
      for(const entry of entries){
        const side=Math.sign(entry.normal[2]),root=sample.roots.find(group=>Math.sign(group.position.z)===side);
        const access=root.getObjectByName('Personnel access hatch');
        for(let index=entry.vertexStart;index<entry.vertexStart+entry.vertexCount;index++){
          assert.ok(Math.abs(positions.getX(index)-previous.getX(index)+side*.84/2.6)<1e-5);
          const point=mesh.localToWorld(new Vector3().fromBufferAttribute(positions,index));root.worldToLocal(point);
          assert.ok(point.x> -1.69&&point.x<access.position.x-.75,'all caution ink stays left of the personnel door');
          assert.ok(point.y> -2.0&&point.y< -.8,'the warning is below every reinforcement rib');
        }
      }
    }
    sample.setEnabled(false);for(const {mesh,geometry}of ink)assert.ok(mesh.geometry===geometry);
  }finally{sample.dispose();panels.dispose();ship.dispose();}
});

test('toggling or disposing the cargo sample restores the original hatches without modifying their buffers or shared materials',()=>{
  const ship=createExteriorMothership();ship.setCoreScale(2.6);
  const originals=ship.evaHatches.map(hatch=>({hatch,meshes:hatch.children.filter(mesh=>mesh.isMesh).map(mesh=>({mesh,geometry:mesh.geometry,positions:mesh.geometry.attributes.position.array.slice(),material:mesh.material}))}));
  const sample=createCargoHatchStudy(ship);
  try{
    assert.ok(sample.roots.every(root=>!root.visible));assert.ok(ship.evaHatches.every(hatch=>hatch.visible));
    for(const enabled of [true,false,true,false]){
      sample.setEnabled(enabled);assert.ok(ship.evaHatches.every(hatch=>hatch.visible===!enabled));
      assert.ok(sample.roots.every(root=>root.visible===enabled));
    }
    sample.setEnabled(true);sample.dispose();
    for(const {hatch,meshes}of originals){
      assert.ok(hatch.visible);
      for(const {mesh,geometry,positions,material}of meshes){
        assert.ok(mesh.geometry===geometry);assert.ok(mesh.material===material);
        assert.deepEqual(mesh.geometry.attributes.position.array,positions);
      }
    }
    assert.ok(sample.roots.every(root=>!root.parent));
    let draws=0;ship.root.traverse(mesh=>{if(mesh.isMesh)draws++;});assert.equal(draws,99);
  }finally{ship.dispose();}
});

test('production shares the adopted cargo builder while only the craft study requests a comparison person',async()=>{
  const source=await readFile(new URL('../src/exterior-craft-study.js',import.meta.url),'utf8');
  const production=await readFile(new URL('../src/obs/exterior-production.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../src/exterior-craft-study.html',import.meta.url),'utf8');
  const study=await readFile(new URL('../src/obs/exterior-cargo-hatch-study.js',import.meta.url),'utf8');
  assert.match(source,/query\.get\('hatch'\)!=='original'/);assert.match(source,/cargoHatch\?\.dispose\(\)/);
  assert.match(html,/id="cargo-hatch"/);assert.match(html,/比較人型はスタディー専用/);
  assert.match(production,/createExteriorCargoHatches\(ship\)/);assert.doesNotMatch(production,/cargo-hatch-study|referenceHuman:true/);
  assert.match(study,/referenceHuman:true/);
});
