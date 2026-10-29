import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3,Mesh,PlaneGeometry,MeshStandardMaterial,DoubleSide,Color} from 'three';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {collectPaintPlanes,createExteriorPanelStudy} from '../src/obs/exterior-panel-study.js';
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

test('aft bulge plates share axial seams and stay continuous across their internal triangle diagonals',()=>{
  for(const replaceSkin of [false,true]){
    const ship=createExteriorShip();
    const study=createExteriorPanelStudy(ship,{replaceSkin}),panels=[];
    try{
      study.setEnabled(true);
      ship.core.traverse(mesh=>{if(['Study / segmented exterior plates','Study / recessed joints and retainers'].includes(mesh.material?.name))panels.push(mesh);});
      const section=(axial,height,width,index)=>{
        const angle=index*Math.PI/4+Math.PI/8;
        return new Vector3(axial,Math.cos(angle)*height,Math.sin(angle)*width);
      };
      for(const scale of [1,2.6]){
        ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
        const rear=[-15.5,4.85,8.5],front=[-11.8,4.95,8.3];
        for(let face=0;face<8;face++){
          const corners=[section(...rear,face),section(...rear,face+1),section(...front,face),section(...front,face+1)];
          const surfaceAt=(axial,circumferential)=>axial+circumferential<=1?
            corners[0].clone().addScaledVector(corners[2].clone().sub(corners[0]),axial).addScaledVector(corners[1].clone().sub(corners[0]),circumferential):
            corners[3].clone().addScaledVector(corners[1].clone().sub(corners[3]),1-axial).addScaledVector(corners[2].clone().sub(corners[3]),1-circumferential);
          const normal=corners[1].clone().sub(corners[0]).cross(corners[2].clone().sub(corners[0])).normalize().transformDirection(ship.core.matrixWorld);
          const materialAt=(axial,circumferential)=>{
            const point=ship.core.localToWorld(surfaceAt(axial,circumferential));
            return new Raycaster(point.addScaledVector(normal,.2*scale),normal.clone().negate(),0,.4*scale).intersectObjects(panels,false)[0]?.object.material.name;
          };
          for(const circumferential of [.13,.42,.79]){
            assert.equal(materialAt(.5,circumferential),'Study / recessed joints and retainers','the middle axial joint aligns around every aft facet');
            for(const offset of [-.02,.02])assert.equal(materialAt(.5+offset,circumferential),'Study / segmented exterior plates','both sides of the shared joint remain painted');
          }
          for(const axial of [.2,.37,.71])for(const offset of [-.002,0,.002]){
            assert.equal(materialAt(axial,1-axial+offset),'Study / segmented exterior plates','an internal triangulation edge cannot restart the panel grid or expose a false joint');
          }
        }
      }
    }finally{study.dispose();ship.dispose();}
  }
});

test('the tapered aft shoulder retains its original planar layout instead of bending joints across its triangle diagonals',()=>{
  const ship=createExteriorShip();
  try{
    const patches=ship.core.userData.panelPatches;
    assert.equal(patches.length,8,'shared unwrapping applies only to the broad aft casing');
    assert.ok(patches.every(corners=>corners.every(point=>point[0]>=-15.50001&&point[0]<=-11.79999)));
    const shoulderPlanes=planes=>[...planes.values()].filter(plane=>plane.area>.35&&plane.sources.every(({mesh,start})=>{
      const positions=mesh.geometry.attributes.position,indices=mesh.geometry.index;
      return [0,1,2].every(corner=>{
        const axial=positions.getX(indices?indices.getX(start+corner):start+corner);
        return axial>=-11.80001&&axial<=-8.79999;
      });
    })).map(plane=>({normal:plane.normal.toArray(),d:plane.d,min:plane.min,max:plane.max,triangles:plane.triangles,surfaces:plane.surfaces}));
    const current=shoulderPlanes(collectPaintPlanes(ship.core));
    ship.core.userData.panelPatches=[];
    const original=shoulderPlanes(collectPaintPlanes(ship.core));
    ship.core.userData.panelPatches=patches;
    assert.ok(current.length>=8,'every exposed shoulder facet remains covered');
    assert.deepEqual(current,original,'the shoulder uses the exact original per-plane projection and grid extents');
    assert.ok(current.every(plane=>plane.surfaces.every(surface=>!surface)),'no shared quad mapping can introduce a kink into a shoulder joint');
    assert.equal(ship.commandSideWindows.length,4,'the newly approved command windows stay in place');
  }finally{ship.dispose();}
});

test('recessed shoulder folds have continuous panel joints without outlining coplanar triangulation',()=>{
  for(const replaceSkin of [false,true])for(const seamWidth of [1,1.5]){
    const ship=createExteriorShip(),study=createExteriorPanelStudy(ship,{replaceSkin,seamWidth}),panels=[];
    try{
      study.setEnabled(true);
      ship.core.traverse(mesh=>{if(['Study / segmented exterior plates','Study / recessed joints and retainers'].includes(mesh.material?.name))panels.push(mesh);});
      const section=(axial,height,width,index)=>{
        const angle=index*Math.PI/4+Math.PI/8;
        return new Vector3(axial,Math.cos(angle)*height,Math.sin(angle)*width);
      };
      for(const scale of [1,2.6]){
        ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
        for(let facet=0;facet<8;facet++){
          const corners=[section(-11.8,4.95,8.3,facet),section(-11.8,4.95,8.3,facet+1),
            section(-8.8,3.45,3.45,facet),section(-8.8,3.45,3.45,facet+1)];
          const halves=[[corners[0],corners[1],corners[2]],[corners[2],corners[1],corners[3]]].map(vertices=>({
            normal:vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize(),
            center:vertices.reduce((total,point)=>total.add(point),new Vector3()).multiplyScalar(1/3),
          }));
          const folded=halves[0].normal.dot(halves[1].normal)<.999;
          const outward=halves[0].normal.clone().add(halves[1].normal).normalize();
          const cast=(point,normal)=>{
            const origin=ship.core.localToWorld(point.clone()),direction=normal.clone().transformDirection(ship.core.matrixWorld);
            return new Raycaster(origin.addScaledVector(direction,.2*scale),direction.negate(),0,.4*scale).intersectObjects(panels,false)[0]?.object.material.name;
          };
          let painted=0;
          for(const fraction of [.19,.38,.61,.83]){
            const point=corners[1].clone().lerp(corners[2],fraction);
            const material=cast(point,outward);
            if(folded){
              assert.equal(material,'Study / recessed joints and retainers','the true recessed fold retains an unbroken dark joint on every side');
              const tangent=corners[2].clone().sub(corners[1]).normalize();
              for(const half of halves){
                const inside=half.center.clone().sub(point);inside.addScaledVector(tangent,-inside.dot(tangent)).normalize();
                const finishes=[.045,.075,.105].map(offset=>cast(point.clone().addScaledVector(inside,offset*seamWidth),half.normal));
                assert.ok(finishes.includes('Study / segmented exterior plates'),'paint remains beside the narrow joint instead of becoming a broad dark stripe');
              }
            }else if(material==='Study / segmented exterior plates')painted++;
          }
          if(!folded)assert.ok(painted>=2,'flat faces do not gain a diagonal joint along their hidden triangulation');
        }
      }
    }finally{study.dispose();ship.dispose();}
  }
});

test('the grey beak and black bow rear face stay confined to their approved regions while other panels retain beige paint',()=>{
  for(const replaceSkin of [false,true]){
    const ship=createExteriorShip(),study=createExteriorPanelStudy(ship,{replaceSkin});
    try{
      let checked=0,accentVertices=0,bandVertices=0,sideBandVertices=0,backVertices=0;
      const beakPaint=new Color(0x7e837a),neckBackPaint=new Color(0x252b28);
      for(const group of [ship.core,...ship.pods]){
        const paint=group===ship.core?new Color(0xc7c1ac):new Color(0xe0ded0).multiply(new Color(0xc1baa5));
        group.traverse(mesh=>{
          if(mesh.material?.name!=='Study / segmented exterior plates')return;
          const colors=mesh.geometry.attributes.color,positions=mesh.geometry.attributes.position;
          for(let index=0;index<colors.count;index++){
            const beakRed=colors.getX(index)/beakPaint.r,beakGreen=colors.getY(index)/beakPaint.g,beakBlue=colors.getZ(index)/beakPaint.b;
            const accent=Math.abs(beakRed-beakGreen)<1e-5&&Math.abs(beakRed-beakBlue)<1e-5;
            const neckRed=colors.getX(index)/neckBackPaint.r,neckGreen=colors.getY(index)/neckBackPaint.g,neckBlue=colors.getZ(index)/neckBackPaint.b;
            const black=Math.abs(neckRed-neckGreen)<1e-5&&Math.abs(neckRed-neckBlue)<1e-5;
            if(black){
              assert.ok(group===ship.core,'habitat panels do not gain black paint');
              assert.ok(Math.abs(positions.getX(index)-8.79)<1e-4,'black paint remains on the rear-facing bow bulkhead beside the antennas');
              backVertices++;
            }
            if(accent){
              assert.ok(group===ship.core,'the accent never replaces beige habitat panels');
              const axial=positions.getX(index),height=positions.getY(index);
              const tip=axial>=15.59&&axial<=17.32&&height<=1.52;
              const lowerBand=axial>=13.39&&axial<=15.62&&height<=-.49;
              assert.ok(tip||lowerBand,'the accent stays on the beak and the marked lower transition band');
              if(lowerBand&&axial<15.59)bandVertices++;
              if(lowerBand&&axial<15.59&&height>-.99)sideBandVertices++;
              accentVertices++;
            }
            const tint=black?neckBackPaint:accent?beakPaint:paint;
            const red=colors.getX(index)/tint.r,green=colors.getY(index)/tint.g,blue=colors.getZ(index)/tint.b;
            assert.ok(Math.abs(red-green)<1e-5&&Math.abs(red-blue)<1e-5,'all panels retain their specified paint hue');
            assert.ok(red>=.97-1e-6&&red<=1.02+1e-6,'paint variation stays subtle instead of becoming a contrasting patch');
          }
          checked++;
        });
      }
      assert.equal(checked,4,'the fixed hull and all three habitats are covered');
      assert.ok(accentVertices>0,'the beak uses the requested slightly lighter grey');
      assert.ok(bandVertices>0,'the accent extends onto the lower band behind the beak');
      assert.ok(sideBandVertices>0,'the narrow strip immediately beneath the inspection cover uses the accent too');
      assert.ok(backVertices>0,'the marked rear face of the bow uses the requested black paint');
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
        assert.ok(Math.abs(red-green)<1e-5&&Math.abs(red-blue)<1e-5,'the marked lower strips use the lighter grey while upper side panels remain beige');
      }
    }finally{study.dispose();ship.dispose();}
  }
});

test('only the bow rear cheeks beside the antennas are charcoal while the neck underside returns to beige',()=>{
  for(const replaceSkin of [false,true]){
    const ship=createExteriorShip(),study=createExteriorPanelStudy(ship,{replaceSkin}),panels=[];
    try{
      study.setEnabled(true);
      ship.core.traverse(mesh=>{if(mesh.material?.name==='Study / segmented exterior plates')panels.push(mesh);});
      const black=new Color(0x252b28),beige=new Color(0xc7c1ac);
      for(const scale of [1,2.6]){
        ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
        const assertTint=(hit,paint)=>{
          assert.ok(hit,'the sampled surface retains its painted panels');
          const colors=hit.object.geometry.attributes.color,index=hit.face.a;
          const red=colors.getX(index)/paint.r,green=colors.getY(index)/paint.g,blue=colors.getZ(index)/paint.b;
          assert.ok(Math.abs(red-green)<1e-5&&Math.abs(red-blue)<1e-5,'black is confined to the marked rear cheeks rather than the neck underside');
        };
        const assertPaint=(axial,angle,paint)=>{
          const radial=new Vector3(0,Math.cos(angle),Math.sin(angle));
          const origin=ship.core.localToWorld(new Vector3(axial,radial.y*6,radial.z*6));
          const inward=radial.clone().negate().transformDirection(ship.core.matrixWorld);
          const hit=new Raycaster(origin,inward,0,12*scale).intersectObjects(panels,false)[0];
          assert.ok(hit,`the sampled neck or adjacent bay retains its painted surface at ${axial}, ${angle}`);
          assertTint(hit,paint);
        };
        for(const side of [-1,1])for(const [height,width]of [[2.05,2.3],[2.25,2.15],[1.75,2.75]]){
          const origin=ship.core.localToWorld(new Vector3(8.55,height,side*width));
          const forward=new Vector3(1,0,0).transformDirection(ship.core.matrixWorld);
          const hit=new Raycaster(origin,forward,0,.5*scale).intersectObjects(panels,false)[0];
          assertTint(hit,black);
          assert.ok(Math.abs(ship.core.worldToLocal(hit.point.clone()).x-8.79)<1e-4,'the visible black face is the back of the bow, not its bottom');
        }
        for(const axial of [6.65,8.45])for(const angle of [Math.PI+.03,Math.PI*3/4+.025,Math.PI*5/4+.05])assertPaint(axial,angle,beige);
        for(const angle of [.05,Math.PI/2+.08,Math.PI*3/2+.08])assertPaint(7.3,angle,beige);
        for(const axial of [5.5,12.5])assertPaint(axial,Math.PI+.03,beige);
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
