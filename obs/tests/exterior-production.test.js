import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,CanvasTexture,Raycaster,Vector3,Box3} from 'three';
import {createProductionExterior,EXTERIOR_SOFT_PANEL_LINES} from '../src/obs/exterior-production.js';
import {createProbeLineStudy} from '../src/obs/exterior-probe-line-study.js';

test('production adopts B without a duplicate painted skin and keeps the probe lazy and geometrically unchanged',async()=>{
  const ship=createProductionExterior({panelLines:EXTERIOR_SOFT_PANEL_LINES}),original=createProductionExterior({original:true});
  const count=root=>{let n=0;root.traverse(m=>{if(m.isMesh)n+=m.geometry.index?.count??m.geometry.attributes.position.count;});return n;};
  try{
    assert.equal(ship.dockedLander,null);assert.ok(ship.finish.panels.replacedTriangles>2000);
    ship.root.updateMatrixWorld(true);
    const surfaces=[];ship.core.traverseVisible(m=>{if(m.isMesh)surfaces.push(m);});
    const hit=new Raycaster(new Vector3(18,-.075,.6),new Vector3(-1,0,0),0,1).intersectObjects(surfaces,false)[0];
    assert.equal(hit?.object.material.name,'Study / segmented exterior plates');
    await Promise.all([ship.prepareProbe(),original.prepareProbe()]);
    assert.equal(count(ship.dockedLander),count(original.dockedLander),'probe A gains no geometry');
    const probe=ship.dockedLander;await ship.prepareProbe();assert.equal(ship.dockedLander,probe);
    const finish=hit.object.material,vertices=count(ship.root);
    ship.setWear(false);assert.equal(finish.roughness,.74,'free-view clean paint reaches the B finish');
    ship.setWear(true);assert.equal(finish.roughness,.90);
    assert.equal(count(ship.root),vertices,'wear controls retain the approved panel geometry');
  }finally{ship.dispose();original.dispose();}
});

test('production dark ink replaces only the probe texture without changing its shared source',()=>{
  const previous=globalThis.document,sourceImage={width:2048,height:1024},source=new CanvasTexture(sourceImage);
  let strokes=0;const canvas={getContext:()=>({drawImage(){},save(){},translate(){},strokeRect(){strokes++;},restore(){}})};
  globalThis.document={createElement:()=>canvas};
  const material=new MeshStandardMaterial({map:source});material.name='Probe aged pressure panels';
  const lander=new Group(),mesh=new Mesh(new BoxGeometry(),material);lander.add(mesh);
  const lines=createProbeLineStudy({dockedLander:lander});
  try{
    lines.setEnabled(true);assert.equal(strokes,32);assert.notEqual(material.map,source);
    assert.notEqual(material.map.source,source.source);assert.equal(source.image,sourceImage);
    assert.equal(material.map.name,'Probe A / existing panel seams in darker ink');
  }finally{lines.dispose();assert.equal(material.map,source);mesh.geometry.dispose();material.dispose();source.dispose();if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('production disposal while the probe loads does not attach late resources',async()=>{
  const ship=createProductionExterior(),pending=ship.prepareProbe();ship.dispose();await pending;
  assert.equal(ship.dockedLander,null);
});

test('production adopts both cargo doors with metre-sized personnel hatches but no study people or extra visible batches',()=>{
  const ship=createProductionExterior({panelLines:EXTERIOR_SOFT_PANEL_LINES});
  const visibleMeshes=()=>{const meshes=[];ship.root.traverseVisible(mesh=>{if(mesh.isMesh)meshes.push(mesh);});return meshes;};
  const previousDraws=visibleMeshes().length;
  try{
    assert.equal(ship.cargoHatches,null);ship.setCoreScale(2.6);ship.root.updateMatrixWorld(true);
    assert.equal(ship.finish.cargoHatches,true);assert.equal(ship.cargoHatches.roots.length,2);
    assert.equal(visibleMeshes().length,previousDraws,'five new batches replace each original hatch’s five batches');
    assert.ok(ship.evaHatches.every(hatch=>!hatch.visible));
    for(const root of ship.cargoHatches.roots){
      assert.ok(root.visible);assert.equal(root.userData.cargoHatch.referenceHuman,false);
      assert.ok(root.getWorldScale(new Vector3()).distanceTo(new Vector3(1,1,1))<1e-10);
      const access=root.getObjectByName('Personnel access hatch');
      assert.deepEqual(access.userData.dimensions,{frame:[1.50,2.18],leaf:[1.30,1.94]});
      assert.equal(root.getObjectByName('Study / 1.85m suited scale reference'),undefined);
      assert.ok(!root.children.some(mesh=>mesh.material?.name==='Worn insulation'));
      const paint=root.children.find(mesh=>mesh.material?.name==='Replacement panel');
      const size=new Box3().setFromObject(paint).getSize(new Vector3());
      assert.ok(Math.abs(size.x-3.38)<1e-5);assert.ok(Math.abs(size.y-5.044)<1e-5);
      const normal=new Vector3(0,0,1).transformDirection(root.matrixWorld);
      const origin=root.localToWorld(access.position.clone().add(new Vector3(0,.5,1)));
      const hit=new Raycaster(origin,normal.negate(),0,2).intersectObjects(root.children.filter(mesh=>mesh.isMesh),false)[0];
      assert.equal(hit?.object.material.name,'Replacement panel');
    }
    const cargo=ship.cargoHatches;ship.setWear(false);ship.setWear(true);
    assert.equal(ship.cargoHatches,cargo,'weathering does not rebuild the adopted hatch');
  }finally{ship.dispose();}
});

test('production scale controls keep personnel doors at human size and clean up superseded cargo geometry and ink',()=>{
  const ship=createProductionExterior();
  const ink=[];ship.core.traverse(mesh=>{if(mesh.userData.exteriorDecal||mesh.name==='Study B / preserved warning ink')ink.push({mesh,geometry:mesh.geometry});});
  const oldHatches=ship.evaHatches.map(hatch=>({hatch,position:hatch.position.clone()}));
  let hatchDisposals=0,inkDisposals=0;
  try{
    ship.setCoreScale(2.6);const cargo=ship.cargoHatches;
    const geometry=cargo.roots[0].children.find(mesh=>mesh.isMesh).geometry;
    geometry.addEventListener('dispose',()=>{hatchDisposals++;});
    ink[0].mesh.geometry.addEventListener('dispose',()=>{inkDisposals++;});
    ship.setCoreScale(2.6);assert.equal(ship.cargoHatches,cargo);assert.equal(hatchDisposals,0);
    ship.setCoreScale(2.8);assert.notEqual(ship.cargoHatches,cargo);
    assert.equal(hatchDisposals,1);assert.equal(inkDisposals,1);assert.ok(cargo.roots.every(root=>!root.parent));
    for(const scale of [2.3,2.6,2.8]){
      ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
      const roots=[];ship.root.traverse(root=>{if(root.userData.cargoHatch)roots.push(root);});assert.equal(roots.length,2);
      for(const root of roots){
        const access=root.getObjectByName('Personnel access hatch');
        assert.ok(root.getWorldScale(new Vector3()).distanceTo(new Vector3(1,1,1))<1e-10);
        assert.ok(access.position.x+.75<root.userData.cargoHatch.leaf[0]/2,'the fixed-size wicket frame fits inside the cargo leaf');
      }
    }
    ship.setCoreScale(1);assert.equal(ship.cargoHatches,null);assert.equal(ship.finish.cargoHatches,false);
    for(const {hatch,position}of oldHatches){assert.ok(hatch.visible);assert.ok(hatch.position.equals(position));}
    for(const {mesh,geometry}of ink)assert.equal(mesh.geometry,geometry,'small-hull fallback restores original caution geometry');
    ship.setCoreScale(2.6);assert.ok(ship.cargoHatches);assert.ok(ship.evaHatches.every(hatch=>!hatch.visible));
  }finally{ship.dispose();}
});

test('production disposes adopted cargo before panel ink and does not dispose shared buffers twice',()=>{
  const ship=createProductionExterior();ship.setCoreScale(2.6);
  const roots=ship.cargoHatches.roots,counts=new Map();
  ship.root.traverse(mesh=>{if(mesh.isMesh&&!counts.has(mesh.geometry)){
    const geometry=mesh.geometry;counts.set(geometry,0);geometry.addEventListener('dispose',()=>counts.set(geometry,counts.get(geometry)+1));
  }});
  ship.dispose();ship.dispose();
  assert.ok(roots.every(root=>!root.parent));
  assert.ok([...counts.values()].every(count=>count===1),'both replacement warning buffers and every base/panel geometry are released once');
});
