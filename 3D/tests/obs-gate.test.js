import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MeshStandardMaterial,Raycaster,Vector3,Box3} from 'three';
import {BULKHEAD_GATE,gateWall,createBulkheadGate} from '../src/obs/bulkhead-gate.js';
import {buildShip,REAR_ROOM_GATES,RECESSED_OPENINGS,FLOOR_Y} from '../src/obs/ship.js';

test('the eight-sided opening cuts through the hull and exposes a separate rear room',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material}),walls=new Group();
  const g=BULKHEAD_GATE;
  for(const [z,depth,openingClearance]of [[-2.30,.19,0],[-2.09,.22,0],[-1.68,.12,.02]]){
    gateWall(walls,material,{left:-3.435,right:-.405,bottom:g.floor+.07,top:g.floor+2.81,z,depth,openingClearance});
  }
  walls.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(g.x,g.floor+1.8,5),new Vector3(0,0,-1));
  assert.equal(ray.intersectObject(walls,true).length,0,'all wall layers must be open');
  ray.ray.origin.x=g.x+1.1;assert.ok(ray.intersectObject(walls,true).length>0,'wall beside the gate remains closed');
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}})})};
  let gate;try{gate=createBulkheadGate(m);}finally{delete globalThis.document;}
  gate.root.updateMatrixWorld(true);ray.ray.origin.x=g.x;
  const hit=ray.intersectObject(gate.root,true)[0];assert.ok(hit&&hit.point.z<-4,'see through both frames into the rear room');
  const frame=gate.root.getObjectByName('Eight-sided gate frame');
  assert.equal(frame.geometry.parameters.shapes.extractPoints().shape.length-1,8);
  assert.equal(frame.geometry.parameters.shapes.holes.length,1);
  assert.ok(new Box3().setFromObject(gate.root).max.z<0,'the gate stays behind the crew and cat lanes');
  assert.equal(gate.lights.children.filter(child=>child.isPointLight).length,2);
  for(const name of ['Recessed rear-room floor','Rear-room floor cap']){
    const bounds=new Box3().setFromObject(gate.root.getObjectByName(name));
    assert.ok(bounds.max.z< -1.60,`${name} stays behind the white trim`);
  }
  for(const root of [walls,gate.root])root.traverse(mesh=>mesh.geometry?.dispose());material.dispose();
});

test('the assembled gate reveal has one surface per wall layer, without coplanar overlaps',()=>{
  const ctx=new Proxy({measureText:t=>({width:t.length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
  const material=new MeshStandardMaterial();let ship;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{ship=buildShip(new Proxy({},{get:()=>material}));}finally{delete globalThis.document;}
  ship.staticMesh.updateMatrixWorld(true);
  for(const opening of RECESSED_OPENINGS){
    const x=(opening.left+opening.right)/2,y=FLOOR_Y[opening.floor];
    for(const offset of [-.3,0,.3]){
      const ray=new Raycaster(new Vector3(x+offset,y+1.5,0),new Vector3(0,0,-1));
      const hit=ray.intersectObject(ship.staticMesh,true)[0];
      assert.ok(hit&&hit.point.z<-3,`${opening.id} exposes its recessed interior, not a solid wall`);
    }
  }
  // Check the assembled scene, including dressing, not just the isolated frame.
  // The old tool board and service pipes occupied the left side of this opening.
  for(const door of REAR_ROOM_GATES)for(const u of [-.38,0,.38])for(const height of [.70,1.3,1.9]){
    const ray=new Raycaster(new Vector3(door.x+u*door.width,door.floor+height,0),new Vector3(0,0,-1));
    const hit=ray.intersectObject(ship.staticMesh,true)[0];
    assert.ok(hit&&hit.point.z< -2.4,`deck at ${door.floor}, doorway ${u}/${height} must expose the rear room without equipment in front`);
  }
  const g=BULKHEAD_GATE;
  for(const side of [-1,1])for(const z of [-2.23,-2.04,-1.62,-1.57,-1.35]){
    const ray=new Raycaster(new Vector3(g.x,g.floor+1.78,z),new Vector3(side,0,0));
    const hits=ray.intersectObject(ship.staticMesh,true).filter(hit=>Math.abs(hit.point.x-(g.x+side*g.width/2))<1e-5);
    assert.equal(hits.length,1,`one visible reveal at side ${side}, depth ${z}`);
  }
  for(const side of [-1,1]){
    const ray=new Raycaster(new Vector3(g.x+side*1.12,g.floor+.082,0),new Vector3(0,0,-1));
    const hits=ray.intersectObject(ship.staticMesh,true);
    assert.equal(hits.filter(hit=>Math.abs(hit.point.z+1.56)<1e-5).length,1,'only white trim occupies the sill face');
    assert.equal(hits.filter(hit=>Math.abs(hit.point.z+1.62)<1e-5).length,1,'the dark floor nose is recessed separately');
  }
  const geometries=new Set(),materials=new Set();
  for(const root of [ship.staticMesh,ship.animated])root.traverse(part=>{
    if(part.geometry)geometries.add(part.geometry);
    if(part.material)for(const m of Array.isArray(part.material)?part.material:[part.material])materials.add(m);
  });
  for(const geometry of geometries)geometry.dispose();
  for(const m of materials){m.map?.dispose();m.bumpMap?.dispose();m.roughnessMap?.dispose();m.dispose();}
});
