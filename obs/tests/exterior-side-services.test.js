import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3} from 'three';
import {createExteriorMothership} from '../src/obs/exterior-mothership.js';

test('side equipment has distinct thermal, airlock-control and coolant-isolation zones seated on the pressure facets',()=>{
  const ship=createExteriorMothership();
  try{
    const modules=ship.sideServices.modules;
    assert.equal(modules.length,6);
    const hull=ship.core.children.filter(mesh=>mesh.isMesh&&!mesh.material.transparent);
    for(const scale of [1,2.6,2.8]){
      ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
      for(const group of modules){
        const {role,width,height}=group.userData.externalService;
        assert.equal(group.userData.panelDetailExclude,true);
        if(role.startsWith('Aft'))assert.ok(group.position.x< -7.4&&group.position.y>1.5);
        if(role.startsWith('Airlock'))assert.ok(group.position.x>1&&group.position.x+width/2<3.0);
        if(role.startsWith('Forward'))assert.ok(group.position.x-width/2>6.0&&group.position.x+width/2<7.0&&group.position.y< -1.5);
        const outward=new Vector3(0,0,1).transformDirection(group.matrixWorld);
        for(const horizontal of [-width*.35,width*.35])for(const vertical of [-height*.35,height*.35]){
          const origin=group.localToWorld(new Vector3(horizontal,vertical,.35));
          const hit=new Raycaster(origin,outward.clone().negate(),0,scale).intersectObjects(hull,false)[0];
          assert.ok(hit,'every equipment foundation is backed by the actual painted pressure hull');
          const local=group.worldToLocal(hit.point.clone());
          assert.ok(Math.abs(local.z)<.045,`${role} has a conformal bearing plane, not a floating case: ${local.z}`);
        }
      }
    }
  }finally{ship.dispose();}
});

test('service routes avoid the structural collars, hatch opening and inspection-cover footprints and remain outside the hull',()=>{
  const ship=createExteriorMothership();
  try{
    ship.root.updateMatrixWorld(true);
    const hull=ship.core.children.filter(mesh=>mesh.isMesh&&!mesh.material.transparent);
    assert.equal(ship.sideServices.routes.length,14);
    for(const route of ship.sideServices.routes){
      assert.equal(route.terminals.length,2);
      for(let index=1;index<route.points.length;index++){
        const start=new Vector3(...route.points[index-1]),end=new Vector3(...route.points[index]);
        for(const amount of [0,.25,.5,.75,1]){
          const point=start.clone().lerp(end,amount),radial=new Vector3(0,point.y,point.z).normalize();
          for(const collar of [...ship.hullCollars.map(group=>group.userData.hullCollar.station),-3.72,.52])assert.ok(Math.abs(point.x-collar)>.22,`${route.name} does not cross a structural collar`);
          if(point.x>3.0&&point.x<5.0)assert.ok(Math.abs(point.y)>1.06+route.radius,`${route.name} keeps the human and cargo door clear`);
          if(point.x>7.04&&point.x<8.06){
            const angle=Math.atan2(Math.abs(point.z),point.y);
            for(const coverAngle of [Math.PI/4,3*Math.PI/4])assert.ok(Math.abs(angle-coverAngle)>.22,`${route.name} avoids the removable inspection lid`);
          }
          const hit=new Raycaster(point.clone().addScaledVector(radial,1),radial.clone().negate(),0,3).intersectObjects(hull,false)[0];
          assert.ok(hit,'service routing follows a real hull facet');
          const clearance=point.clone().sub(hit.point).dot(radial);
          assert.ok(clearance>route.radius*.8,`${route.name} must not disappear into the hull: ${clearance}`);
          assert.ok(clearance<.42,`${route.name} stays on short supported standoffs: ${clearance}`);
        }
      }
    }
  }finally{ship.dispose();}
});

test('five bearing-service cartridges on each side sit above the red warning without overlapping collars or other services',()=>{
  const ship=createExteriorMothership();
  try{
    const cartridges=ship.sideServices.cartridges;
    assert.equal(cartridges.length,10);
    const surfaces=[];ship.machinery.traverse(mesh=>{if(mesh.isMesh)surfaces.push(mesh);});
    const hull=ship.core.children.filter(mesh=>mesh.isMesh&&mesh.material.name==='Aged Macintosh beige');
    for(const scale of [1,2.6,2.8]){
      ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
      for(const side of [-1,1]){
        const row=cartridges.filter(group=>group.userData.serviceCartridge.side===side);
        assert.equal(row.length,5);
        for(const [index,group]of row.entries()){
          const {width,height}=group.userData.serviceCartridge;
          assert.ok(group.position.x-width/2> -7.0&&group.position.x+width/2< -3.95);
          assert.ok(group.position.y-height/2> -.57,'the red rotating-assembly warning stays clear below the row');
          if(index>0)assert.ok(group.position.x-row[index-1].position.x>width+.09);
          const outward=new Vector3(0,0,1).transformDirection(group.matrixWorld);
          const origin=group.localToWorld(new Vector3(0,0,.6));
          const front=new Raycaster(origin,outward.clone().negate(),0,scale).intersectObjects(surfaces,false)[0];
          assert.equal(front?.object.material.name,'Warm service metal','each small square housing retains its visible replaceable cartridge');
          const skin=new Raycaster(origin,outward.clone().negate(),0,scale).intersectObjects(hull,false)[0];
          assert.ok(skin);assert.ok(Math.abs(group.worldToLocal(skin.point.clone()).z)<1e-5,'the row follows the actual hull facet');
        }
      }
    }
  }finally{ship.dispose();}
});

test('service reorganisation retains the door anchors and the existing draw and geometry budgets',()=>{
  const ship=createExteriorMothership();
  try{
    for(const scale of [1,2.6,2.8]){
      ship.setCoreScale(scale);
      assert.deepEqual(ship.evaHatches.map(hatch=>hatch.position.toArray()),[[4,.02,-3.10],[4,.02,3.10]]);
    }
    let meshes=0,triangles=0;ship.root.traverse(mesh=>{
      if(mesh.isMesh){meshes++;triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;}
    });
    assert.equal(meshes,99);assert.ok(triangles<57000);
  }finally{ship.dispose();}
});
