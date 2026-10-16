import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3,Mesh,PlaneGeometry,MeshStandardMaterial,DoubleSide} from 'three';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {createExteriorPanelStudy} from '../src/obs/exterior-panel-study.js';
import {HABITAT_ENVELOPE} from '../src/obs/habitat-envelope.js';

test('optional panel version toggles without modifying the approved model geometry or material',()=>{
  const ship=createExteriorShip(),original=[];
  ship.root.traverse(mesh=>{if(mesh.isMesh)original.push([mesh,mesh.geometry,mesh.material]);});
  const study=createExteriorPanelStudy(ship),overlays=[];
  try{
    ship.root.traverse(group=>{if(group.name==='Optional panel detail comparison')overlays.push(group);});
    assert.equal(overlays.length,4);assert.ok(overlays.every(group=>!group.visible));
    study.setEnabled(true);assert.ok(overlays.every(group=>group.visible));
    study.setEnabled(false);assert.ok(overlays.every(group=>!group.visible));
    assert.ok(study.stats.plates>100&&study.stats.triangles>100);
    for(const [mesh,geometry,material]of original){assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);}
    study.dispose();assert.ok(overlays.every(group=>!group.parent));
  }finally{ship.dispose();}
});

test('probe plates remain seated on actual painted facets, including tapered cabin surfaces',()=>{
  const ship=createExteriorShip(),base=[];
  ship.dockedLander.traverse(mesh=>{if(mesh.isMesh&&['Probe aged pressure panels','Replacement panel','Aged Macintosh beige','Habitat service skin'].includes(mesh.material.name))base.push(mesh);});
  const study=createExteriorPanelStudy(ship,{probeOnly:true});
  try{
    ship.root.updateMatrixWorld(true);
    let checked=0;const point=new Vector3(),normal=new Vector3(),vertex=new Vector3();
    ship.dockedLander.traverse(mesh=>{
      if(!mesh.isMesh||mesh.material.name!=='Study / segmented exterior plates')return;
      const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
      for(let i=0;i<p.count;i+=Math.max(3,Math.floor(p.count/240/3)*3)){
        point.set(0,0,0);for(let j=0;j<3;j++)point.add(vertex.fromBufferAttribute(p,i+j));point.multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld);
        normal.fromBufferAttribute(n,i).transformDirection(mesh.matrixWorld);
        const origin=point.clone().addScaledVector(normal,.02);
        const hits=new Raycaster(origin,normal.clone().negate(),0,.06).intersectObjects(base,false);
        assert.ok(hits.length,'no plate may float across a window opening or miss its supporting skin');checked++;
      }
    });
    assert.ok(checked>100);
  }finally{study.dispose();ship.dispose();}
});

test('bow end stays continuous across its horizontal center',()=>{
  const ship=createExteriorShip(),study=createExteriorPanelStudy(ship),panels=[];
  try{
    study.setEnabled(true);ship.root.updateMatrixWorld(true);
    ship.core.traverse(mesh=>{if(mesh.material?.name==='Study / segmented exterior plates'||mesh.material?.name==='Study / recessed joints and retainers')panels.push(mesh);});
    for(const z of [-.8,0,.8]){
      const origin=ship.core.localToWorld(new Vector3(17.5,-.075,z));
      const direction=new Vector3(-1,0,0).transformDirection(ship.core.matrixWorld);
      const hit=new Raycaster(origin,direction,0,1).intersectObjects(panels,false)[0];
      assert.equal(hit?.object.material.name,'Study / segmented exterior plates','no horizontal joint may cross the bow center');
    }
  }finally{study.dispose();ship.dispose();}
});

test('optional panel seams never cross EVA or habitat hatch leaves',()=>{
  const ship=createExteriorShip();ship.setCoreScale(2.6);ship.setAngle(.7);
  const original=[];ship.root.traverse(mesh=>{if(mesh.isMesh&&!mesh.material.transparent)original.push(mesh);});
  const study=createExteriorPanelStudy(ship),panels=[];
  try{
    study.setEnabled(true);ship.root.updateMatrixWorld(true);
    ship.root.traverse(mesh=>{if(mesh.material?.name==='Study / segmented exterior plates'||mesh.material?.name==='Study / recessed joints and retainers')panels.push(mesh);});
    const samples=[];
    for(const hatch of ship.evaHatches){
      const side=Math.sign(hatch.position.z),normal=new Vector3(0,0,side).transformDirection(hatch.matrixWorld);
      for(const y of [-.55,0,.55])samples.push({point:hatch.localToWorld(new Vector3(-.35,y,side*.28)),normal});
    }
    const z=(-HABITAT_ENVELOPE.front+HABITAT_ENVELOPE.rearRoomBack)/2;
    for(const pod of ship.pods)for(const side of [-1,1]){
      samples.push({point:pod.localToWorld(new Vector3(side*(HABITAT_ENVELOPE.right+2.01),-.8,z)),normal:new Vector3(side,0,0).transformDirection(pod.matrixWorld)});
    }
    for(const {point,normal}of samples){
      const ray=new Raycaster(point.clone().addScaledVector(normal,1),normal.clone().negate(),0,2);
      const door=ray.intersectObjects(original,false)[0],overlay=ray.intersectObjects(panels,false)[0];
      assert.ok(door,'sample must hit an actual hatch');
      assert.ok(!overlay||overlay.distance>door.distance+.02,'panel geometry must stay behind the continuous hatch leaf');
    }
  }finally{study.dispose();ship.dispose();}
});

test('aft wordmark ink clears B plates from frontal and oblique views on both sides',()=>{
  const ship=createExteriorShip(),material=new MeshStandardMaterial({side:DoubleSide});
  material.userData.exteriorInk=true;
  const facet=Math.cos(Math.PI/8),slope=facet*(8.3-8.5)/3.7,tilt=Math.atan(-slope);
  for(const side of [-1,1]){
    const logo=new Mesh(new PlaneGeometry(3,.4),material);
    logo.position.set(-13.5,-.9,side*(facet*8.5+slope*2+.006));
    logo.rotation.y=side>0?tilt:Math.PI-tilt;ship.core.add(logo);
  }
  const study=createExteriorPanelStudy(ship,{replaceSkin:true});study.setEnabled(true);
  try{
    const ink=[];ship.core.traverse(mesh=>{if(mesh.name==='Study B / preserved wordmark ink')ink.push(mesh);});
    assert.equal(ink.length,2);
    for(const scale of [1,2.6]){
      ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
      const surfaces=[];ship.core.traverseVisible(mesh=>{if(mesh.isMesh&&!mesh.material.transparent)surfaces.push(mesh);});
      for(const logo of ink)for(const offset of [-1,0,1])for(const oblique of [-2,0,2]){
        // Cloned ink geometry is expressed in the core coordinate system.
        const side=Math.sign(logo.geometry.attributes.position.getZ(0));
        const point=ship.core.localToWorld(new Vector3(-13.5+offset,-.9,side*(facet*8.5+slope*(2+offset))));
        const normal=new Vector3(-slope,0,side).normalize();
        const direction=normal.clone().add(new Vector3(oblique,0,0)).normalize();
        const hit=new Raycaster(point.clone().addScaledVector(direction,3),direction.negate(),0,6).intersectObjects(surfaces,false)[0];
        assert.equal(hit?.object,logo,'raised panels must not cover the wordmark from an oblique camera');
      }
    }
    study.setEnabled(false);assert.ok(ink.every(mesh=>!mesh.parent.visible),'A/B switching restores the original ink');
  }finally{study.dispose();ship.dispose();}
});
