import test from 'node:test';
import assert from 'node:assert/strict';
import {createExteriorMothership} from '../src/obs/exterior-mothership.js';
import {Raycaster,Vector3} from 'three';

test('three parallel pressurant tanks on each hull face have rounder twenty-four-sided shells and chamfers without changing their size or draw batches',()=>{
  const ship=createExteriorMothership();
  try{
    const tanks=[-1,1].flatMap(side=>[-1.7,0,1.7].map(offset=>({
      height:side*5.50,width:offset,vertices:[],caps:new Set()
    })));
    ship.machinery.traverse(mesh=>{
      if(!mesh.isMesh||mesh.material.name!=='Worn insulation')return;
      const positions=mesh.geometry.attributes.position;
      for(let index=0;index<positions.count;index++){
        const axial=positions.getX(index),height=positions.getY(index),width=positions.getZ(index);
        if(axial<-15.20001||axial>-10.09999)continue;
        const tank=tanks.find(item=>Math.hypot(height-item.height,width-item.width)<.70001);
        assert.ok(tank,'all tank vertices stay within six separate cylinder envelopes');
        tank.vertices.push([axial,height,width]);
        if(Math.hypot(height-tank.height,width-tank.width)<1e-5)tank.caps.add(axial.toFixed(2));
      }
    });
    for(const tank of tanks){
      assert.deepEqual([...tank.caps].map(Number).sort((left,right)=>left-right),[-15.2,-10.1],'the tanks move aft while retaining their 5.1-unit length');
      assert.ok(tank.vertices.length>0);
      const heights=tank.vertices.map(point=>point[1]),widths=tank.vertices.map(point=>point[2]);
      assert.ok(Math.abs(Math.max(...heights)-Math.min(...heights)-1.4)<1e-5);
      assert.ok(Math.abs(Math.max(...widths)-Math.min(...widths)-1.4)<1e-5);
      for(const [axial,radius]of [[-15.2,.46],[-14.96,.70],[-10.34,.70],[-10.1,.46]]){
        const section=tank.vertices.filter(point=>Math.abs(point[0]-axial)<1e-5);
        assert.ok(section.length>0,'both ends have a shoulder and a smaller cap');
        const perimeter=new Set();
        for(const point of section){
          const distance=Math.hypot(point[1]-tank.height,point[2]-tank.width);
          if(distance<1e-5)continue;
          assert.ok(Math.abs(distance-radius)<1e-5,'the chamfer tapers symmetrically to the end cap');
          perimeter.add(point.slice(1).map(value=>value.toFixed(5)).join('/'));
        }
        assert.equal(perimeter.size,24,'each shoulder has twenty-four facets while retaining its chamfer profile');
      }
    }
    const markings=[];
    ship.core.traverse(mesh=>{
      for(const entry of mesh.userData.markings??[])if(entry.key==='tank')markings.push(entry);
    });
    assert.equal(markings.length,6);
    for(const tank of tanks)assert.ok(markings.some(entry=>
      Math.abs(entry.point[2]-tank.width)<1e-5&&Math.sign(entry.point[1])===Math.sign(tank.height)
    ),'each tank has its own surface warning');
    let meshes=0;ship.root.traverse(mesh=>{if(mesh.isMesh)meshes++;});
    assert.equal(meshes,99,'additional tanks add geometry, not draw batches');
  }finally{ship.dispose();}
});

test('all retaining bands match the twenty-four-sided tank circumference without increasing their cross-section geometry',()=>{
  const ship=createExteriorMothership();
  try{
    const bands=[];
    for(const side of [-1,1])for(const lateral of [-1.7,0,1.7])for(const axial of [-14.35,-10.95]){
      bands.push({height:side*5.50,lateral,axial,perimeter:new Set()});
    }
    ship.machinery.traverse(mesh=>{
      if(!mesh.isMesh||mesh.material.name!=='Unpainted structure')return;
      const positions=mesh.geometry.attributes.position;
      for(let index=0;index<positions.count;index++){
        const axial=positions.getX(index),height=positions.getY(index),lateral=positions.getZ(index);
        for(const band of bands){
          if(Math.abs(axial-band.axial)>1e-5)continue;
          if(Math.abs(Math.hypot(height-band.height,lateral-band.lateral)-.80)>1e-5)continue;
          band.perimeter.add([height,lateral].map(value=>value.toFixed(5)).join('/'));
        }
      }
    });
    for(const band of bands)assert.equal(band.perimeter.size,24,'the thin retaining straps follow the rounder shells');
  }finally{ship.dispose();}
});

test('all six tanks stand clear of the hull and their saddle feet bear on its actual slope at every core scale',()=>{
  const ship=createExteriorMothership();
  try{
    const hull=ship.core.children.filter(mesh=>mesh.isMesh&&mesh.material.name==='Aged Macintosh beige');
    const shells=[],structure=[];
    ship.machinery.traverse(mesh=>{
      if(!mesh.isMesh)return;
      if(mesh.material.name==='Worn insulation')shells.push(mesh);
      if(mesh.material.name==='Unpainted structure')structure.push(mesh);
    });
    const cast=(point,direction,meshes)=>{
      const origin=ship.core.localToWorld(new Vector3(...point));
      const outward=new Vector3(...direction).transformDirection(ship.core.matrixWorld);
      const hit=new Raycaster(origin,outward).intersectObjects(meshes,false)[0];
      assert.ok(hit,'the sampled real mesh must be present');
      return ship.core.worldToLocal(hit.point.clone());
    };
    for(const scale of [1,1.6,2.6,2.8]){
      ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
      for(const side of [-1,1])for(const offset of [-1.7,0,1.7]){
        const shell=cast([-12.65,0,offset],[0,side,0],shells);
        const roof=cast([-12.65,side*7,offset],[0,-side,0],hull);
        const gap=side*(shell.y-roof.y);
        assert.ok(gap>.20&&gap<.30,'the low saddles leave a small visible gap without lifting the tanks too high');
        for(const axial of [-14.35,-10.95])for(const lateral of [-.5,.5]){
          const point=[axial+.23,side*7,offset+side*lateral+.10];
          const bearing=cast(point,[0,-side,0],structure),skin=cast(point,[0,-side,0],hull);
          const clearance=side*(bearing.y-skin.y);
          assert.ok(clearance>.08&&clearance<.14,'all twenty-four load-spreading feet follow the hull surface');
        }
      }
    }
  }finally{ship.dispose();}
});
