import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3} from 'three';
import {createExteriorMothership} from '../src/obs/exterior-mothership.js';

test('all four hull collars align with real facet boundaries and the aft collar sits immediately ahead of the logo panel',()=>{
  const ship=createExteriorMothership();
  try{
    assert.deepEqual(ship.hullCollars.map(group=>group.userData.hullCollar.station),[-11.8,-8.8,6.1,8.8]);
    for(const group of ship.hullCollars){
      assert.equal(group.userData.hullCollar.corners,8);
      assert.equal(group.parent,ship.core);assert.deepEqual(group.scale.toArray(),[1,1,1]);
    }
    const stern=ship.hullCollars[0].userData.hullCollar;
    assert.ok(stern.span[0]> -12.0,'the entire aft band stays ahead of the original wordmark');
    assert.ok(Math.abs((stern.span[0]+stern.span[1])/2+11.8)<1e-9,'the collar straddles the broad logo panel to shoulder crease');
    assert.equal(ship.hullCollars[3].userData.hullCollar.span[0],8.8,'the bow collar starts at the faceted forward casing edge');
  }finally{ship.dispose();}
});

test('faceted collars remain exposed around the whole hull without sunken circular arcs or floating corners at every core scale',()=>{
  const ship=createExteriorMothership();
  try{
    const hull=ship.core.children.filter(mesh=>mesh.isMesh&&mesh.material.name==='Aged Macintosh beige');
    const steel=ship.core.children.filter(mesh=>mesh.isMesh&&mesh.material.name==='Unpainted structure');
    for(const scale of [1,1.6,2.6,2.8]){
      ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
      for(const group of ship.hullCollars){
        const {span}=group.userData.hullCollar,axial=(span[0]+span[1])/2;
        for(let sample=0;sample<32;sample++){
          const angle=sample*Math.PI/16,radial=new Vector3(0,Math.cos(angle),Math.sin(angle));
          const origin=ship.core.localToWorld(new Vector3(axial,radial.y*20,radial.z*20));
          const direction=radial.clone().negate().transformDirection(ship.core.matrixWorld);
          const ray=new Raycaster(origin,direction,0,40*scale),skin=ray.intersectObjects(hull,false)[0],band=ray.intersectObjects(steel,false)[0];
          assert.ok(skin&&band,'both the hull and the fitted collar exist around the complete circumference');
          const clearance=(skin.distance-band.distance)/scale;
          assert.ok(clearance>.07&&clearance<.12,`the beveled band stays just outside the real hull: ${clearance}`);
          if(sample%4===0)assert.ok(Math.abs(skin.face.normal.dot(band.face.normal))>.97,'collar flats follow the hull facets rather than a circular tube');
        }
      }
    }
  }finally{ship.dispose();}
});

test('fitted collars leave the central bearing races and doors untouched without extra draw batches',()=>{
  const ship=createExteriorMothership();
  try{
    assert.deepEqual(ship.evaHatches.map(group=>group.position.toArray()),[[4,.02,-3.10],[4,.02,3.10]]);
    const steel=ship.core.children.filter(mesh=>mesh.isMesh&&mesh.material.name==='Unpainted structure');
    ship.root.updateMatrixWorld(true);
    for(const axial of [-3.72,.52]){
      const hit=new Raycaster(new Vector3(axial,5,0),new Vector3(0,-1,0)).intersectObjects(steel,false)[0];
      assert.ok(hit&&Math.abs(hit.point.y-3.83)<1e-5,'fixed bearing races retain their original 3.6m radius and .23m tube');
    }
    let meshes=0,triangles=0;ship.root.traverse(mesh=>{
      if(mesh.isMesh){meshes++;triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;}
    });
    assert.equal(meshes,99);assert.ok(triangles<57000,'fitted bands and the approved exterior equipment retain the shared geometry budget');
  }finally{ship.dispose();}
});
