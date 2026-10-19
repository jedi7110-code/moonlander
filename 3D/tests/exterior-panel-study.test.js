import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3,Mesh,PlaneGeometry,MeshStandardMaterial,DoubleSide,Color} from 'three';
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

test('only the bow beak and its lower transition band are grey while hull and habitat panels retain beige paint',()=>{
  for(const replaceSkin of [false,true]){
    const ship=createExteriorShip(),study=createExteriorPanelStudy(ship,{replaceSkin});
    try{
      let checked=0,greyVertices=0,bandVertices=0,sideBandVertices=0;
      const beakPaint=new Color(0x767b72);
      for(const group of [ship.core,...ship.pods]){
        const paint=group===ship.core?new Color(0xc7c1ac):new Color(0xe0ded0).multiply(new Color(0xc1baa5));
        group.traverse(mesh=>{
          if(mesh.material?.name!=='Study / segmented exterior plates')return;
          const colors=mesh.geometry.attributes.color,positions=mesh.geometry.attributes.position;
          for(let index=0;index<colors.count;index++){
            const beakRed=colors.getX(index)/beakPaint.r,beakGreen=colors.getY(index)/beakPaint.g,beakBlue=colors.getZ(index)/beakPaint.b;
            const grey=Math.abs(beakRed-beakGreen)<1e-5&&Math.abs(beakRed-beakBlue)<1e-5;
            if(grey){
              assert.ok(group===ship.core,'grey never appears on a habitat');
              const axial=positions.getX(index),height=positions.getY(index);
              const tip=axial>=15.59&&axial<=17.32&&height<=1.52;
              const lowerBand=axial>=13.39&&axial<=15.62&&height<=-.49;
              assert.ok(tip||lowerBand,'grey stays on the beak and the marked lower transition band');
              if(lowerBand&&axial<15.59)bandVertices++;
              if(lowerBand&&axial<15.59&&height>-.99)sideBandVertices++;
              greyVertices++;
            }
            const tint=grey?beakPaint:paint;
            const red=colors.getX(index)/tint.r,green=colors.getY(index)/tint.g,blue=colors.getZ(index)/tint.b;
            assert.ok(Math.abs(red-green)<1e-5&&Math.abs(red-blue)<1e-5,'all panels retain their specified paint hue');
            assert.ok(red>=.97-1e-6&&red<=1.02+1e-6,'paint variation stays subtle instead of becoming a contrasting patch');
          }
          checked++;
        });
      }
      assert.equal(checked,4,'the fixed hull and all three habitats are covered');
      assert.ok(greyVertices>0,'the beak uses the requested grey');
      assert.ok(bandVertices>0,'grey extends onto the lower band behind the beak');
      assert.ok(sideBandVertices>0,'the narrow strip immediately beneath the inspection cover is grey too');
      ship.root.updateMatrixWorld(true);
      const panels=[];ship.core.traverse(mesh=>{if(mesh.material?.name==='Study / segmented exterior plates')panels.push(mesh);});
      for(const [point,normal,paint=beakPaint]of [
        [[14.5,-1.95,0],[.22,-.98,0]],
        [[14.5,-1.6,2.175],[.32,-.67,.67]],
        [[14.5,-1.6,-2.175],[.32,-.67,-.67]],
        [[14.5,-.9,2.525],[.28,0,.96]],
        [[14.5,-.9,-2.525],[.28,0,-.96]],
        [[15.35,0,2.274],[.28,0,.96],new Color(0xc7c1ac)],
        [[15.35,0,-2.274],[.28,0,-.96],new Color(0xc7c1ac)],
      ]){
        const surface=ship.core.localToWorld(new Vector3(...point));
        const outward=new Vector3(...normal).normalize().transformDirection(ship.core.matrixWorld);
        const hit=new Raycaster(surface.clone().addScaledVector(outward,.5),outward.negate(),0,1).intersectObjects(panels,false)[0];
        assert.ok(hit,'the lower band and both sloping chines retain their real panel surfaces');
        const colors=hit.object.geometry.attributes.color,index=hit.face.a;
        const red=colors.getX(index)/paint.r,green=colors.getY(index)/paint.g,blue=colors.getZ(index)/paint.b;
        assert.ok(Math.abs(red-green)<1e-5&&Math.abs(red-blue)<1e-5,'the marked lower strips are grey while upper side panels remain beige');
      }
    }finally{study.dispose();ship.dispose();}
  }
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
        assert.ok(hit?.object===logo,'raised panels must not cover the wordmark from an oblique camera');
      }
    }
    study.setEnabled(false);assert.ok(ink.every(mesh=>!mesh.parent.visible),'A/B switching restores the original ink');
  }finally{study.dispose();ship.dispose();}
});
