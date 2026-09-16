import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MeshStandardMaterial,Raycaster,Vector3,Box3} from 'three';
import {BULKHEAD_GATE,gateWall,createBulkheadGate} from '../src/obs/bulkhead-gate.js';

test('the eight-sided opening cuts through the hull and exposes a separate rear room',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material}),walls=new Group();
  const g=BULKHEAD_GATE;
  for(const [z,depth]of [[-2.175,.19],[-2.09,.22],[-1.68,.12]]){
    gateWall(walls,material,{left:-3.435,right:-.405,bottom:g.floor+.07,top:g.floor+2.81,z,depth});
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
  for(const root of [walls,gate.root])root.traverse(mesh=>mesh.geometry?.dispose());material.dispose();
});
