import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,CanvasTexture,Raycaster,Vector3} from 'three';
import {createProductionExterior} from '../src/obs/exterior-production.js';
import {createProbeLineStudy} from '../src/obs/exterior-probe-line-study.js';

test('production adopts B without a duplicate painted skin and keeps the probe lazy and geometrically unchanged',async()=>{
  const ship=createProductionExterior(),original=createProductionExterior({original:true});
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
