import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createChessPieceGeometry} from '../src/obs/chess-geometry.js';
import {createChessRevealCap} from '../src/obs/chess-reveal-cap.js';
import {CHESS_REVEAL} from '../src/obs/chess-reveal.js';

test('all six pieces have filled, upward facing sections throughout the build',()=>{
  for(const type of 'prnbqk'){
    const piece=createChessPieceGeometry(type),maximum=piece.boundingBox.max.y;
    for(let layer=1;layer<CHESS_REVEAL.layers;layer++){
      const height=maximum*layer/CHESS_REVEAL.layers,cap=createChessRevealCap(piece,height),positions=cap.attributes.position;
      if(height>=piece.boundingBox.min.y){
        assert.ok(positions.count>0,type+' has a filled slice at '+height);
        assert.ok(positions.array.every(Number.isFinite));
        for(let i=0;i<positions.count;i++)assert.ok(Math.abs(positions.getY(i)-height)<1e-6);
        assert.ok(cap.attributes.normal.array.every((value,i)=>value===(i%3===1?1:0)));
      }
      cap.dispose();
    }
    piece.dispose();
  }
});
test('real crown openings remain open while overlapping solid body parts stay filled',()=>{
  const material=new THREE.MeshBasicMaterial(),ray=new THREE.Raycaster(new THREE.Vector3(0,2,0),new THREE.Vector3(0,-1,0));
  for(const [type,height,centerFilled]of [['r',.93,false],['q',1.20,false],['p',.60,true]]){
    const piece=createChessPieceGeometry(type),cap=createChessRevealCap(piece,height),mesh=new THREE.Mesh(cap,material);
    assert.equal(ray.intersectObject(mesh).length>0,centerFilled,type+' preserves the correct interior');
    ray.ray.origin.x=type==='r'?.25:type==='q'?.18:.10;
    assert.ok(ray.intersectObject(mesh).length>0,type+' has a filled rim or body');
    ray.ray.origin.x=0;cap.dispose();piece.dispose();
  }
  material.dispose();
});
