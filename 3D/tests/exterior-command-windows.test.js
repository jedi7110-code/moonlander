import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3} from 'three';
import {createExteriorMothership} from '../src/obs/exterior-mothership.js';
import {createExteriorPanelStudy} from '../src/obs/exterior-panel-study.js';

test('the command module gains one chamfer pane and one side pane on each side without extra draw batches',()=>{
  const ship=createExteriorMothership();
  try{
    assert.equal(ship.commandSideWindows.length,4);
    assert.deepEqual(ship.commandSideWindows.map(group=>[group.userData.commandWindow.side,group.userData.commandWindow.face]),[[-1,'chamfer'],[-1,'side'],[1,'chamfer'],[1,'side']]);
    let meshes=0,triangles=0;ship.root.traverse(mesh=>{if(mesh.isMesh){meshes++;triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;}});
    assert.equal(meshes,99);assert.ok(triangles<57000,'four framed windows remain within the existing geometry budget');
    for(const group of ship.commandSideWindows){assert.equal(group.parent,ship.core);assert.deepEqual(group.scale.toArray(),[1,1,1]);}
    for(const face of ['chamfer','side']){
      const pair=ship.commandSideWindows.filter(group=>group.userData.commandWindow.face===face);
      assert.ok(Math.abs(pair[0].position.x-pair[1].position.x)<1e-7);
      assert.ok(Math.abs(pair[0].position.y-pair[1].position.y)<1e-7);
      assert.ok(Math.abs(pair[0].position.z+pair[1].position.z)<1e-7);
    }
  }finally{ship.dispose();}
});

test('new command glazing stays exposed, recessed inside pressure rims, and free of panel lines at every core scale',()=>{
  for(const replaceSkin of [false,true]){
    const ship=createExteriorMothership(),panels=createExteriorPanelStudy(ship,{replaceSkin});
    try{
      panels.setEnabled(true);
      for(const scale of [1,1.6,2.6,2.8]){
        ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
        const surfaces=[],paint=[];
        ship.core.traverseVisible(mesh=>{
          if(!mesh.isMesh||mesh.material.transparent)return;
          surfaces.push(mesh);
          if(['Aged Macintosh beige','Study / segmented exterior plates','Study / recessed joints and retainers'].includes(mesh.material.name))paint.push(mesh);
        });
        for(const window of ship.commandSideWindows){
          const {outer,opening}=window.userData.commandWindow;
          const outward=new Vector3(0,0,1).transformDirection(window.matrixWorld);
          const horizontal=new Vector3(1,0,0).transformDirection(window.matrixWorld);
          const cast=(point,normal=outward,objects=surfaces)=>new Raycaster(point.clone().addScaledVector(normal,.25*scale),normal.clone().negate(),0,.5*scale).intersectObjects(objects,false)[0];
          for(const portion of [0,.35,.7])for(const corner of opening){
            const local=new Vector3(corner[0]*portion,corner[1]*portion,0),point=window.localToWorld(local);
            for(const tilt of [-.4,0,.4]){
              const hit=cast(point,outward.clone().addScaledVector(horizontal,tilt).normalize());
              assert.equal(hit?.object.material.name,'Small pressure window','neither the hull, panel overlay nor adjacent armour can bury the added glass');
              assert.ok(Math.abs(window.worldToLocal(hit.point.clone()).z-.022)<1e-4,'the glass stays behind the frame lip');
            }
            assert.ok(!cast(point,outward,paint),'every glazing sample has an actual opening through the painted command skin');
            const back=cast(point,outward.clone().negate());
            assert.equal(back?.object.material.name,'Small pressure window','the pane has an opaque inner surface rather than a missing back face');
          }
          for(let edge=0;edge<outer.length;edge++){
            const next=(edge+1)%outer.length;
            const local=new Vector3((outer[edge][0]+outer[next][0]+opening[edge][0]+opening[next][0])/4,
              (outer[edge][1]+outer[next][1]+opening[edge][1]+opening[next][1])/4,0);
            const hit=cast(window.localToWorld(local));
            assert.equal(hit?.object.material.name,'Unpainted structure','all four pane edges retain their machined pressure rim');
            assert.ok(Math.abs(window.worldToLocal(hit.point.clone()).z-.056)<1e-4,'the pressure rim has restrained, consistent relief above the skin');
          }
        }
        const skylights=ship.core.getObjectByName('Inclined command skylights');
        for(let pane=0;pane<4;pane++){
          const forward=ship.core.localToWorld(new Vector3(15.616,1.95,(pane-1.5)*.74));
          const forwardNormal=new Vector3(1,0,0).transformDirection(ship.core.matrixWorld);
          const forwardHit=new Raycaster(forward.addScaledVector(forwardNormal,.2*scale),forwardNormal.negate(),0,.4*scale).intersectObjects(surfaces,false)[0];
          assert.equal(forwardHit?.object.material.name,'Small pressure window','all four approved forward panes remain exposed');
          const edge=pane===0?-1:pane===3?1:0;
          const roof=skylights.localToWorld(new Vector3(0,.016,(pane-1.5)*.69+edge*.09));
          const roofNormal=new Vector3(0,1,0).transformDirection(skylights.matrixWorld);
          const roofHit=new Raycaster(roof.addScaledVector(roofNormal,.2*scale),roofNormal.negate(),0,.4*scale).intersectObjects(surfaces,false)[0];
          assert.equal(roofHit?.object.material.name,'Small pressure window','all four approved skylights remain exposed');
        }
      }
    }finally{panels.dispose();ship.dispose();}
  }
});
